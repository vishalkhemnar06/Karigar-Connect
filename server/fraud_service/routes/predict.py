"""
server/fraud_service/routes/predict.py

FIXES:
  1. scan-all now saves ALL scanned users to fraudqueue (sorted by fraud %),
     not just ones above the 50% threshold.
  2. /queue route returns all users sorted by fraudProb DESC.
  3. predict single also saves result to queue unconditionally.
  4. All routes use SHORT decorator paths (blueprint prefix is /api/fraud).
  5. BUGFIX: NODE_BASE_URL fallback uses 127.0.0.1 (IPv4) not localhost.
  6. BUGFIX: scan-all purges fraudqueue entries for users that no longer exist
     BEFORE running the scan, so stale rows are cleaned proactively even if
     the user was deleted while the service was offline.
"""

import os
import traceback
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from bson.errors import InvalidId
import requests

from preprocessing.feature_eng import build_feature_vector
from utils.model_loader import get_loader
from utils.notifier import emit_fraud_alert

predict_bp = Blueprint('predict', __name__)

NODE_BASE_URL   = os.environ.get('NODE_BASE_URL',   'http://127.0.0.1:5000')
INTERNAL_SECRET = os.environ.get('INTERNAL_SECRET', 'change_me')


def _utcnow():
    return datetime.now(timezone.utc)


def _find_user(db, user_id):
    """Find user by MongoDB ObjectId string OR karigarId string."""
    try:
        oid  = ObjectId(user_id)
        user = db.users.find_one({'_id': oid})
        if user:
            return user, str(oid)
    except (InvalidId, Exception):
        pass
    user = db.users.find_one({'karigarId': user_id})
    if user:
        return user, str(user['_id'])
    return None, None


def _notify_node(payload):
    try:
        requests.post(
            f'{NODE_BASE_URL}/api/admin/fraud-notify',
            json=payload,
            headers={'x-internal-secret': INTERNAL_SECRET},
            timeout=5,
        )
    except Exception as error:
        print('[WARN] Auto fraud notification failed: {}'.format(error))


def _build_medium_risk_messages(name, role, risk_level, reasons):
    readable_reasons = [reason.get('label') for reason in reasons if reason.get('label')]
    top_reason_text  = '; '.join(readable_reasons[:3]) or 'suspicious activity patterns'
    risk_text        = (risk_level or 'MEDIUM').title()

    message = (
        'Your recent activity is violating our platform guidelines. '
        'Current risk level: {}. '
        'Reasons detected: {}. '
        'Please maintain proper activity, otherwise your account may be blocked.'
    ).format(risk_text, top_reason_text)

    sms_message = (
        'KarigarConnect alert for {}: your activity is violating our guidelines. '
        '{} risk because of: {}. Maintain proper activity or your account may be blocked.'
    ).format(name or role.title(), risk_text, top_reason_text)

    return message, sms_message


def _should_send_medium_warning(previous_queue_item, current_risk_level):
    if current_risk_level not in ('MEDIUM', 'HIGH'):
        return False
    previous_risk = (previous_queue_item or {}).get('riskLevel')
    if previous_risk in ('MEDIUM', 'HIGH'):
        return False
    return True


def _send_medium_warning_if_needed(db, uid_str, role, user_data, result, previous_queue_item=None):
    if not _should_send_medium_warning(previous_queue_item or {}, result['risk_level']):
        return

    mobile = user_data.get('mobile', '')
    if not mobile:
        return

    message, sms_message = _build_medium_risk_messages(
        user_data.get('name', 'User'),
        role,
        result.get('risk_level'),
        result.get('top_reasons', []),
    )

    _notify_node({
        'userId':     uid_str,
        'title':      'Guideline Warning',
        'message':    message,
        'mobile':     mobile,
        'smsMessage': sms_message,
        'action':     'medium-risk-warning',
    })

    db.fraudqueue.update_one(
        {'userId': ObjectId(uid_str)},
        {'$set': {
            'lastMediumRiskWarningAt':      _utcnow(),
            'lastMediumRiskWarningReasons': result.get('top_reasons', []),
        }},
    )


def _upsert_queue(db, uid_str, role, user_data, result, features):
    """
    Save or update this user's fraud score in the queue.
    ALL users are saved — not just flagged ones.
    """
    db.fraudqueue.update_one(
        {'userId': ObjectId(uid_str)},
        {'$set': {
            'userId':             ObjectId(uid_str),
            'userRole':           role,
            'userName':           user_data.get('name', ''),
            'mobile':             user_data.get('mobile', ''),
            'karigarId':          user_data.get('karigarId', '') or user_data.get('karigar_id', ''),
            'verificationStatus': user_data.get('verificationStatus', '') or user_data.get('verification_status', ''),
            'fraudProb':          result['fraud_probability'],
            'fraudPercent':       result['fraud_percent'],
            'riskLevel':          result['risk_level'],
            'isFraud':            result['is_fraud'],
            'topReasons':         result['top_reasons'],
            'featuresSnapshot':   features,
            'flaggedAt':          _utcnow(),
            'actioned':           False,
        }},
        upsert=True,
    )


def _save_history(db, uid_str, role, result, features):
    """Persist prediction to fraudpredictions for trend tracking."""
    try:
        db.fraudpredictions.insert_one({
            'userId':           ObjectId(uid_str),
            'userRole':         role,
            'fraudProb':        result['fraud_probability'],
            'fraudPercent':     result['fraud_percent'],
            'riskLevel':        result['risk_level'],
            'isFraud':          result['is_fraud'],
            'topReasons':       result['top_reasons'],
            'featuresSnapshot': features,
            'predictedAt':      _utcnow(),
        })
    except Exception as e:
        print('[WARN] save history failed: {}'.format(e))


def _cleanup_stale_queue(db, live_user_ids: set):
    """
    Remove fraudqueue entries whose userId is NOT in live_user_ids.
    Called at the start of scan-all so stale rows are proactively cleared
    even for users deleted while the fraud service was offline.
    """
    live_oids = {
        oid if isinstance(oid, ObjectId) else ObjectId(str(oid))
        for oid in live_user_ids
    }

    # Find all queue entries that are NOT in the live set
    stale = list(db.fraudqueue.find(
        {'userId': {'$nin': list(live_oids)}},
        {'_id': 1, 'userId': 1, 'userName': 1}
    ))

    if stale:
        stale_oids = [s['userId'] for s in stale]
        result = db.fraudqueue.delete_many({'userId': {'$in': stale_oids}})
        print(
            '[scan-all] Pre-scan cleanup: removed {} stale fraudqueue entries '
            'for deleted users: {}'.format(
                result.deleted_count,
                [s.get('userName', str(s.get('userId', '?'))) for s in stale]
            )
        )


# ── POST /api/fraud/predict ───────────────────────────────────────────────────
@predict_bp.route('/predict', methods=['POST'])
def predict():
    """
    Body: { "user_id": "<mongo _id OR karigarId>", "user_role": "worker"|"client" }
    Saves result to queue unconditionally so the monitor always shows it.
    """
    body      = request.get_json(force=True)
    user_id   = (body.get('user_id') or '').strip()
    user_role = (body.get('user_role') or '').strip()

    if not user_id or user_role not in ('worker', 'client'):
        return jsonify({'error': 'user_id and user_role (worker|client) required'}), 400

    db     = current_app.config['MONGO_DB']
    loader = get_loader()

    try:
        user, resolved_id = _find_user(db, user_id)
        if not user:
            return jsonify({'error': 'User not found: {}'.format(user_id)}), 404

        features = build_feature_vector(resolved_id, db)
        result   = loader.predict(features, user_role)

        payload = {
            'user_id':             resolved_id,
            'user_role':           user_role,
            'name':                user.get('name', 'Unknown'),
            'mobile':              user.get('mobile', ''),
            'karigar_id':          user.get('karigarId', ''),
            'verification_status': user.get('verificationStatus', ''),
            **result,
            'features_snapshot': features,
            'predicted_at':      _utcnow().isoformat(),
        }

        previous_queue_item = db.fraudqueue.find_one({'userId': ObjectId(resolved_id)})

        _save_history(db, resolved_id, user_role, result, features)
        _upsert_queue(db, resolved_id, user_role, {
            'name':               user.get('name', ''),
            'mobile':             user.get('mobile', ''),
            'karigarId':          user.get('karigarId', ''),
            'verificationStatus': user.get('verificationStatus', ''),
        }, result, features)

        _send_medium_warning_if_needed(db, resolved_id, user_role, user, result, previous_queue_item)

        if result['is_fraud']:
            emit_fraud_alert(current_app.config['SOCKETIO'], payload)

        return jsonify(payload), 200

    except ValueError as e:
        return jsonify({'error': str(e)}), 404
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Prediction failed'}), 500


# ── POST /api/fraud/scan-all ──────────────────────────────────────────────────
@predict_bp.route('/scan-all', methods=['POST'])
def scan_all():
    """
    Scans ALL active users. Saves every user to fraudqueue sorted by fraud %.
    The Fraud Monitor shows all users — not just ones above the 50% threshold.

    BUGFIX: Purges stale fraudqueue entries for deleted users BEFORE scanning,
    so the queue always reflects only real users in the DB.
    """
    db       = current_app.config['MONGO_DB']
    socketio = current_app.config['SOCKETIO']
    loader   = get_loader()

    users = list(db.users.find(
        {'role': {'$in': ['worker', 'client']}, 'verificationStatus': {'$ne': 'blocked'}},
        {'_id': 1, 'role': 1, 'name': 1, 'mobile': 1, 'karigarId': 1, 'verificationStatus': 1},
    ))

    total_in_db = db.users.count_documents({})
    print('[scan-all] DB={} | total_users={} | active={}'.format(
        db.name, total_in_db, len(users)
    ))

    # ── CORE FIX: purge queue rows for users deleted since last scan ──────────
    live_ids = {user['_id'] for user in users}
    _cleanup_stale_queue(db, live_ids)
    # ─────────────────────────────────────────────────────────────────────────

    if not users:
        return jsonify({
            'scanned':       0,
            'flagged_count': 0,
            'all_results':   [],
            'flagged':       [],
            'by_risk':       {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'SAFE': 0},
            'errors':        [],
            'scanned_at':    _utcnow().isoformat(),
            'message':       'No active users found in DB "{}".'.format(db.name),
        }), 200

    all_results = []
    flagged     = []
    errors      = []
    risk_counts = {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'SAFE': 0}

    for user in users:
        uid  = str(user['_id'])
        role = user['role']
        try:
            features            = build_feature_vector(uid, db)
            result              = loader.predict(features, role)
            previous_queue_item = db.fraudqueue.find_one({'userId': ObjectId(uid)})

            risk_level = result['risk_level']
            risk_counts[risk_level] = risk_counts.get(risk_level, 0) + 1

            entry = {
                'user_id':             uid,
                'user_role':           role,
                'name':                user.get('name', ''),
                'mobile':              user.get('mobile', ''),
                'karigar_id':          user.get('karigarId', ''),
                'verification_status': user.get('verificationStatus', ''),
                **result,
            }
            all_results.append(entry)

            _upsert_queue(db, uid, role, user, result, features)
            _save_history(db, uid, role, result, features)
            _send_medium_warning_if_needed(db, uid, role, user, result, previous_queue_item)

            if result['is_fraud']:
                flagged.append(entry)
                emit_fraud_alert(socketio, entry)

        except Exception as e:
            traceback.print_exc()
            errors.append({'user_id': uid, 'error': str(e)})

    all_results.sort(key=lambda x: x['fraud_probability'], reverse=True)
    flagged.sort(key=lambda x: x['fraud_probability'], reverse=True)

    print('[scan-all] done — scanned={} flagged={} errors={}'.format(
        len(all_results), len(flagged), len(errors)
    ))

    return jsonify({
        'scanned':       len(all_results),
        'flagged_count': len(flagged),
        'all_results':   all_results,
        'flagged':       flagged,
        'by_risk':       risk_counts,
        'errors':        errors,
        'scanned_at':    _utcnow().isoformat(),
    }), 200


# ── POST /api/fraud/scan-batch ────────────────────────────────────────────────
@predict_bp.route('/scan-batch', methods=['POST'])
def scan_batch():
    """Body: { "user_ids": ["id1", "id2", ...] }"""
    body     = request.get_json(force=True)
    user_ids = body.get('user_ids', [])
    if not user_ids:
        return jsonify({'error': 'user_ids array required'}), 400

    db     = current_app.config['MONGO_DB']
    loader = get_loader()
    results, errors = [], []

    for uid_str in user_ids[:50]:
        try:
            user, resolved_id = _find_user(db, uid_str)
            if not user:
                errors.append({'user_id': uid_str, 'error': 'not found'})
                continue
            features            = build_feature_vector(resolved_id, db)
            result              = loader.predict(features, user['role'])
            previous_queue_item = db.fraudqueue.find_one({'userId': ObjectId(resolved_id)})
            _upsert_queue(db, resolved_id, user['role'], user, result, features)
            _send_medium_warning_if_needed(db, resolved_id, user['role'], user, result, previous_queue_item)
            results.append({
                'user_id':   resolved_id,
                'user_role': user['role'],
                'name':      user.get('name', ''),
                **result,
            })
        except Exception as e:
            errors.append({'user_id': uid_str, 'error': str(e)})

    results.sort(key=lambda x: x['fraud_probability'], reverse=True)
    return jsonify({'results': results, 'errors': errors}), 200


# ── GET /api/fraud/history/<user_id> ─────────────────────────────────────────
@predict_bp.route('/history/<user_id>', methods=['GET'])
def prediction_history(user_id):
    try:
        db = current_app.config['MONGO_DB']
        user, resolved_id = _find_user(db, user_id)
        if not resolved_id:
            return jsonify({'user_id': user_id, 'history': []}), 200

        history = list(
            db.fraudpredictions
            .find({'userId': ObjectId(resolved_id)}, {'_id': 0, 'featuresSnapshot': 0})
            .sort('predictedAt', -1)
            .limit(10)
        )
        for h in history:
            if 'predictedAt' in h and hasattr(h['predictedAt'], 'isoformat'):
                h['predictedAt'] = h['predictedAt'].isoformat()
        return jsonify({'user_id': user_id, 'history': history}), 200
    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch history'}), 500


# ── GET /api/fraud/stats ──────────────────────────────────────────────────────
@predict_bp.route('/stats', methods=['GET'])
def fraud_stats():
    try:
        db = current_app.config['MONGO_DB']

        agg = list(db.fraudqueue.aggregate([
            {'$match': {'actioned': {'$ne': True}}},
            {'$group': {
                '_id':   {'role': '$userRole', 'risk': '$riskLevel'},
                'count': {'$sum': 1},
            }},
        ]))

        stats = {
            'worker': {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'SAFE': 0, 'total': 0},
            'client': {'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'SAFE': 0, 'total': 0},
        }
        for item in agg:
            role = item['_id']['role']
            risk = item['_id']['risk']
            if role in stats:
                stats[role][risk]    = stats[role].get(risk, 0) + item['count']
                stats[role]['total'] += item['count']

        actioned = list(db.fraudactions.aggregate([
            {'$group': {'_id': '$action', 'count': {'$sum': 1}}}
        ]))
        action_counts = {a['_id']: a['count'] for a in actioned}

        recent = list(
            db.fraudactions.find({}, {'_id': 0}).sort('takenAt', -1).limit(10)
        )
        for a in recent:
            if 'takenAt' in a and hasattr(a['takenAt'], 'isoformat'):
                a['takenAt'] = a['takenAt'].isoformat()

        return jsonify({
            'queue_stats':    stats,
            'action_counts':  action_counts,
            'recent_actions': recent,
            'total_flagged':  stats['worker']['total'] + stats['client']['total'],
        }), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch stats'}), 500