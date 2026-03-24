"""
server/fraud_service/preprocessing/feature_eng.py
Builds feature vectors from live MongoDB data for XGBoost inference.
Accepts user_id as MongoDB ObjectId string OR karigarId string.
All fields are null-safe — works even for brand-new empty profiles.
"""

from datetime import datetime, timedelta, timezone
from bson import ObjectId
from bson.errors import InvalidId

VERIF_MAP = {'pending': 0, 'approved': 1, 'rejected': 2, 'blocked': 3}


def _utcnow():
    return datetime.now(timezone.utc)


def _aware(dt):
    """
    Ensure a datetime is timezone-aware UTC.
    Handles: datetime objects, ISO strings, and None.
    """
    if dt is None:
        return _utcnow()
    # Already a datetime
    if isinstance(dt, datetime):
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    # String — try parsing ISO format (e.g. "2025-11-13T13:22:53.976+00:00")
    if isinstance(dt, str):
        try:
            # Python 3.11+ handles +00:00; older versions need manual strip
            s = dt.replace('Z', '+00:00')
            parsed = datetime.fromisoformat(s)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            return _utcnow()
    return _utcnow()


def _resolve_user(user_id, db):
    """
    Find user by ObjectId string OR by karigarId string.
    Returns (user_doc, ObjectId). Raises ValueError if not found.
    """
    try:
        oid = ObjectId(user_id)
        user = db.users.find_one({'_id': oid})
        if user:
            return user, oid
    except (InvalidId, Exception):
        pass

    user = db.users.find_one({'karigarId': user_id})
    if user:
        return user, user['_id']

    raise ValueError(
        'User not found: "{}". Check DB_NAME — your URI uses karigarConnect.'.format(user_id)
    )


def build_feature_vector(user_id, db):
    """
    Entry point called by predict routes.
    user_id : MongoDB _id string  OR  karigarId string (e.g. "K409540")
    db      : PyMongo database object from app.config['MONGO_DB']
    """
    user, uid = _resolve_user(user_id, db)
    role = user.get('role', '')
    if role == 'worker':
        return _worker_features(uid, user, db)
    elif role == 'client':
        return _client_features(uid, user, db)
    else:
        raise ValueError('Unsupported role: "{}" for user {}'.format(role, user_id))


# ---------------------------------------------------------------------------
# WORKER
# ---------------------------------------------------------------------------
def _worker_features(uid, user, db):
    now = _utcnow()
    t30 = now - timedelta(days=30)
    t7  = now - timedelta(days=7)

    # userModel fields
    created_at             = _aware(user.get('createdAt'))
    account_age_days       = max((now - created_at).days, 0)
    verification_status    = user.get('verificationStatus') or 'pending'
    id_proof               = user.get('idProof') or {}
    doc_verified           = 1 if id_proof.get('filePath') else 0
    has_id_proof           = doc_verified
    points                 = int(user.get('points') or 0)
    phone_is_feature_phone = 1 if user.get('phoneType') == 'Feature Phone' else 0
    skills_count           = len(user.get('skills') or [])
    experience_years       = int(user.get('experience') or 0)
    emergency              = user.get('emergencyContact') or {}
    has_emergency_contact  = 1 if emergency.get('name') else 0
    references_count       = len(user.get('references') or [])
    has_eshram_card        = 1 if user.get('eShramNumber') else 0
    portfolio_photos_count = len(user.get('portfolioPhotos') or [])

    # Audit log signals
    has_audit = 'auditlogs' in db.list_collection_names()

    def ac(action, since):
        if not has_audit:
            return 0
        return db.auditlogs.count_documents(
            {'userId': uid, 'action': action, 'createdAt': {'$gte': since}}
        )

    profile_updates_30d     = ac('profile_update',      t30)
    availability_toggles_7d = ac('availability_toggle', t7)
    logins_per_week         = ac('login',               t7) or 5
    failed_logins_7d        = ac('failed_login',        t7)
    device_changes_30d      = ac('device_change',       t30)
    location_changes_30d    = ac('location_change',     t30)
    suspicious_ip_count     = ac('suspicious_ip',       t30)

    # Job aggregation — written flat to avoid nested-brace confusion
    total_applications      = 0
    jobs_completed          = 0
    job_cancellations_total = 0
    jobs_running_now        = 0

    try:
        match_stage = {
            '$match': {
                '$or': [
                    {'applicants.workerId':  uid},
                    {'assignedTo':           uid},
                    {'cancelledWorkerId':     uid},
                ]
            }
        }

        applicant_filter = {
            '$filter': {
                'input': {'$ifNull': ['$applicants', []]},
                'as':    'a',
                'cond':  {'$eq': ['$$a.workerId', uid]},
            }
        }
        applied_count = {'$size': applicant_filter}
        applied_bool  = {'$cond': [{'$gt': [applied_count, 0]}, 1, 0]}

        assigned_arr = {'$ifNull': ['$assignedTo', []]}
        completed_bool = {
            '$cond': [
                {'$and': [
                    {'$in': [uid, assigned_arr]},
                    {'$eq': ['$status', 'completed']},
                ]},
                1, 0,
            ]
        }
        cancelled_bool = {'$cond': [{'$eq': ['$cancelledWorkerId', uid]}, 1, 0]}
        running_bool   = {
            '$cond': [
                {'$and': [
                    {'$in': [uid, assigned_arr]},
                    {'$eq': ['$status', 'running']},
                ]},
                1, 0,
            ]
        }

        group_stage = {
            '$group': {
                '_id':                      None,
                'total_applications':       {'$sum': applied_bool},
                'jobs_completed':           {'$sum': completed_bool},
                'job_cancellations_total':  {'$sum': cancelled_bool},
                'jobs_running_now':         {'$sum': running_bool},
            }
        }

        agg = list(db.jobs.aggregate([match_stage, group_stage]))
        if agg:
            total_applications      = agg[0].get('total_applications',      0)
            jobs_completed          = agg[0].get('jobs_completed',          0)
            job_cancellations_total = agg[0].get('job_cancellations_total', 0)
            jobs_running_now        = agg[0].get('jobs_running_now',        0)

    except Exception as e:
        print('[WARN] worker job agg error: {}'.format(e))

    # Grace window cancellations
    cancel_within_grace_window_count = 0
    try:
        grace_match = {
            '$match': {
                'cancelledWorkerId': uid,
                'cancelledBy':       'worker',
                'actualStartTime':   {'$exists': True, '$ne': None},
                'cancelledAt':       {'$exists': True, '$ne': None},
            }
        }
        grace_project = {
            '$project': {
                'elapsed_min': {
                    '$divide': [
                        {'$subtract': ['$cancelledAt', '$actualStartTime']},
                        60000,
                    ]
                }
            }
        }
        grace_filter  = {'$match': {'elapsed_min': {'$lte': 45}}}
        grace_count   = {'$count': 'n'}

        grace = list(db.jobs.aggregate([grace_match, grace_project, grace_filter, grace_count]))
        if grace:
            cancel_within_grace_window_count = grace[0].get('n', 0)
    except Exception as e:
        print('[WARN] grace window agg error: {}'.format(e))

    cancellation_rate = round(job_cancellations_total / max(total_applications, 1), 3)
    completion_rate   = round(jobs_completed           / max(total_applications, 1), 3)

    # Ratings
    avg_rating             = 0.0
    total_ratings_received = 0
    rating_variance        = 0.0
    try:
        ragg = list(db.ratings.aggregate([
            {'$match': {'worker': uid}},
            {'$group': {
                '_id':   None,
                'avg':   {'$avg': '$stars'},
                'count': {'$sum': 1},
                'list':  {'$push': '$stars'},
            }},
        ]))
        if ragg:
            avg_rating             = round(float(ragg[0].get('avg') or 0.0), 2)
            total_ratings_received = ragg[0].get('count', 0)
            rlist                  = ragg[0].get('list', [])
            if rlist:
                rating_variance = round(
                    sum((r - avg_rating) ** 2 for r in rlist) / len(rlist), 2
                )
    except Exception as e:
        print('[WARN] worker ratings agg error: {}'.format(e))

    # Complaints
    complaints_filed_count    = 0
    complaints_received_count = 0
    try:
        # Worker-filed tickets from Complaint model
        worker_filed = db.complaints.count_documents({'filedBy': uid})

        # Complaints received by worker can come from:
        # 1) ClientComplaint model (client vs worker): againstWorker
        # 2) Legacy/older Complaint docs using aboutUserId
        received_client_complaints = db.clientcomplaints.count_documents({'againstWorker': uid})
        received_legacy = db.complaints.count_documents({'aboutUserId': uid})

        complaints_filed_count = worker_filed
        complaints_received_count = received_client_complaints + received_legacy
    except Exception as e:
        print('[WARN] complaints query error: {}'.format(e))

    return {
        'account_age_days':                  account_age_days,
        'verification_status_enc':           VERIF_MAP.get(verification_status, 0),
        'doc_verified':                      doc_verified,
        'has_id_proof':                      has_id_proof,
        'points':                            points,
        'phone_is_feature_phone':            phone_is_feature_phone,
        'skills_count':                      skills_count,
        'experience_years':                  experience_years,
        'has_emergency_contact':             has_emergency_contact,
        'references_count':                  references_count,
        'has_eshram_card':                   has_eshram_card,
        'portfolio_photos_count':            portfolio_photos_count,
        'profile_updates_30d':               profile_updates_30d,
        'availability_toggles_7d':           availability_toggles_7d,
        'logins_per_week':                   logins_per_week,
        'failed_logins_7d':                  failed_logins_7d,
        'device_changes_30d':                device_changes_30d,
        'location_changes_30d':              location_changes_30d,
        'suspicious_ip_count':               suspicious_ip_count,
        'total_applications':                total_applications,
        'jobs_completed':                    jobs_completed,
        'job_cancellations_total':           job_cancellations_total,
        'cancel_within_grace_window_count':  cancel_within_grace_window_count,
        'cancellation_rate':                 cancellation_rate,
        'completion_rate':                   completion_rate,
        'jobs_running_now':                  jobs_running_now,
        'avg_rating':                        avg_rating,
        'rating_variance':                   rating_variance,
        'total_ratings_received':            total_ratings_received,
        'complaints_received_count':         complaints_received_count,
        'complaints_filed_count':            complaints_filed_count,
    }


# ---------------------------------------------------------------------------
# CLIENT
# ---------------------------------------------------------------------------
def _client_features(uid, user, db):
    now = _utcnow()
    t30 = now - timedelta(days=30)
    t7  = now - timedelta(days=7)

    # userModel fields
    created_at             = _aware(user.get('createdAt'))
    account_age_days       = max((now - created_at).days, 0)
    verification_status    = user.get('verificationStatus') or 'pending'
    id_proof               = user.get('idProof') or {}
    doc_verified           = 1 if id_proof.get('filePath') else 0
    has_id_proof           = doc_verified
    phone_is_feature_phone = 1 if user.get('phoneType') == 'Feature Phone' else 0
    has_workplace_info     = 1 if user.get('workplaceInfo') else 0
    has_social_profile     = 1 if user.get('socialProfile') else 0
    starred_workers_count  = len(user.get('starredWorkers') or [])

    # Audit log signals
    has_audit = 'auditlogs' in db.list_collection_names()

    def ac(action, since):
        if not has_audit:
            return 0
        return db.auditlogs.count_documents(
            {'userId': uid, 'action': action, 'createdAt': {'$gte': since}}
        )

    profile_updates_30d           = ac('profile_update',              t30)
    logins_per_week               = ac('login',                       t7) or 5
    failed_logins_7d              = ac('failed_login',                t7)
    device_changes_30d            = ac('device_change',               t30)
    location_changes_30d          = ac('location_change',             t30)
    suspicious_ip_count           = ac('suspicious_ip',               t30)
    application_toggle_count      = ac('toggle_applications',         t30)
    workers_accepted_then_removed = ac(
        'worker_removed_after_accept', now - timedelta(days=365)
    )

    # Job aggregation
    total_jobs_posted        = 0
    jobs_completed_as_client = 0
    jobs_cancelled_by_client = 0
    total_workers_hired      = 0

    try:
        completed_bool = {
            '$cond': [{'$eq': ['$status', 'completed']}, 1, 0]
        }
        cancelled_bool = {
            '$cond': [{'$eq': ['$cancelledBy', 'client']}, 1, 0]
        }
        hired_count = {
            '$size': {'$ifNull': ['$assignedTo', []]}
        }

        group_stage = {
            '$group': {
                '_id':                      None,
                'total_jobs_posted':        {'$sum': 1},
                'jobs_completed_as_client': {'$sum': completed_bool},
                'jobs_cancelled_by_client': {'$sum': cancelled_bool},
                'total_workers_hired':      {'$sum': hired_count},
            }
        }

        agg = list(db.jobs.aggregate([
            {'$match': {'postedBy': uid}},
            group_stage,
        ]))
        if agg:
            total_jobs_posted        = agg[0].get('total_jobs_posted',        0)
            jobs_completed_as_client = agg[0].get('jobs_completed_as_client', 0)
            jobs_cancelled_by_client = agg[0].get('jobs_cancelled_by_client', 0)
            total_workers_hired      = agg[0].get('total_workers_hired',      0)

    except Exception as e:
        print('[WARN] client job agg error: {}'.format(e))

    client_cancellation_rate = round(
        jobs_cancelled_by_client / max(total_jobs_posted, 1), 3
    )
    client_completion_rate = round(
        jobs_completed_as_client / max(total_jobs_posted, 1), 3
    )

    # Avg hours from job post to cancel
    avg_job_post_to_cancel_hours = 999.0
    try:
        cagg = list(db.jobs.aggregate([
            {
                '$match': {
                    'postedBy':    uid,
                    'cancelledBy': 'client',
                    'cancelledAt': {'$exists': True, '$ne': None},
                }
            },
            {
                '$project': {
                    'hrs': {
                        '$divide': [
                            {'$subtract': ['$cancelledAt', '$createdAt']},
                            3600000,
                        ]
                    }
                }
            },
            {'$group': {'_id': None, 'avg': {'$avg': '$hrs'}}},
        ]))
        if cagg:
            avg_job_post_to_cancel_hours = round(cagg[0].get('avg', 999.0), 2)
    except Exception as e:
        print('[WARN] cancel hours agg error: {}'.format(e))

    # Ratings
    avg_rating_given      = 0.0
    total_ratings_given   = 0
    rating_variance_given = 0.0
    try:
        ragg = list(db.ratings.aggregate([
            {'$match': {'client': uid}},
            {'$group': {
                '_id':   None,
                'avg':   {'$avg': '$stars'},
                'count': {'$sum': 1},
                'list':  {'$push': '$stars'},
            }},
        ]))
        if ragg:
            avg_rating_given    = round(float(ragg[0].get('avg') or 0.0), 2)
            total_ratings_given = ragg[0].get('count', 0)
            rlist               = ragg[0].get('list', [])
            if rlist:
                rating_variance_given = round(
                    sum((r - avg_rating_given) ** 2 for r in rlist) / len(rlist), 2
                )
    except Exception as e:
        print('[WARN] client ratings agg error: {}'.format(e))

    # Complaints
    complaints_filed_count    = 0
    complaints_received_count = 0
    try:
        # Client-filed complaints from ClientComplaint model
        client_filed = db.clientcomplaints.count_documents({'filedBy': uid})

        # Client can be complained against in worker Complaint model via againstUser,
        # and older docs may still use aboutUserId.
        received_worker_complaints = db.complaints.count_documents({'againstUser': uid})
        received_legacy = db.complaints.count_documents({'aboutUserId': uid})

        complaints_filed_count = client_filed
        complaints_received_count = received_worker_complaints + received_legacy
    except Exception as e:
        print('[WARN] complaints query error: {}'.format(e))

    return {
        'account_age_days':               account_age_days,
        'verification_status_enc':        VERIF_MAP.get(verification_status, 0),
        'doc_verified':                   doc_verified,
        'has_id_proof':                   has_id_proof,
        'phone_is_feature_phone':         phone_is_feature_phone,
        'has_workplace_info':             has_workplace_info,
        'has_social_profile':             has_social_profile,
        'starred_workers_count':          starred_workers_count,
        'profile_updates_30d':            profile_updates_30d,
        'logins_per_week':                logins_per_week,
        'failed_logins_7d':               failed_logins_7d,
        'device_changes_30d':             device_changes_30d,
        'location_changes_30d':           location_changes_30d,
        'suspicious_ip_count':            suspicious_ip_count,
        'total_jobs_posted':              total_jobs_posted,
        'jobs_completed_as_client':       jobs_completed_as_client,
        'jobs_cancelled_by_client':       jobs_cancelled_by_client,
        'client_cancellation_rate':       client_cancellation_rate,
        'client_completion_rate':         client_completion_rate,
        'application_toggle_count':       application_toggle_count,
        'workers_accepted_then_removed':  workers_accepted_then_removed,
        'total_workers_hired':            total_workers_hired,
        'avg_job_post_to_cancel_hours':   avg_job_post_to_cancel_hours,
        'avg_rating_given':               avg_rating_given,
        'rating_variance_given':          rating_variance_given,
        'total_ratings_given':            total_ratings_given,
        'complaints_received_count':      complaints_received_count,
        'complaints_filed_count':         complaints_filed_count,
    }