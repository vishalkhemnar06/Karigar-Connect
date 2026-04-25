"""
server/fraud_service/routes/actions.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /api/fraud/action          — block or delete a flagged user
POST /api/fraud/warn            — send warning SMS/notification
GET  /api/fraud/queue           — current fraud alert queue (sorted by risk)
GET  /api/fraud/metrics         — model performance metrics
DELETE /api/fraud/queue/<id>    — dismiss (remove from queue without action)
GET  /api/fraud/actions         — action history log

BUGFIX (IPv4): NODE_BASE_URL fallback uses 127.0.0.1 not localhost.

BUGFIX (stale queue entries):
  The fraudqueue collection is a cache — it is written whenever a scan runs
  but is never automatically cleaned when a user is deleted from the users
  collection.  This caused deleted users to permanently appear in the Fraud
  Monitor even after removal from the DB.

  Fix: _purge_deleted_users() is called inside GET /queue before building
  the response.  It does ONE extra DB round-trip to find which userId values
  in the fetched batch no longer exist in users, deletes those fraudqueue
  documents, and returns only the live items.  The monitor count now always
  matches the real user count.

  Additionally, take_action(action="delete") now immediately hard-deletes the
  fraudqueue entry instead of just marking it actioned, so it cannot reappear
  even before the next GET /queue call.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os, traceback, requests
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from utils.notifier import emit_action_taken

actions_bp = Blueprint('actions', __name__)

NODE_BASE_URL   = os.environ.get('NODE_BASE_URL',   'http://127.0.0.1:5000')
INTERNAL_SECRET = os.environ.get('INTERNAL_SECRET', 'change_me')


def _utcnow():
    return datetime.now(timezone.utc)


def _notify_node(payload: dict):
    """Fire-and-forget call to Node.js to send SMS + in-app notification."""
    try:
        print(f'[notify_node] Calling {NODE_BASE_URL}/api/admin/fraud-notify with payload:')
        print(f'  - userId: {payload.get("userId")}')
        print(f'  - action: {payload.get("action")}')
        print(f'  - mobile: {payload.get("mobile")}')
        
        response = requests.post(
            f'{NODE_BASE_URL}/api/admin/fraud-notify',
            json=payload,
            headers={'x-internal-secret': INTERNAL_SECRET},
            timeout=5,
        )
        print(f'[notify_node] ✅ Response from Node: {response.status_code}')
        if response.status_code != 200:
            print(f'[notify_node] ⚠️  Response body: {response.text}')
    except Exception as e:
        print(f'[notify_node] ❌ Failed: {e}')


# ── CORE FIX ──────────────────────────────────────────────────────────────────
def _purge_deleted_users(db, queue_items: list) -> list:
    """
    Cross-reference a batch of fraudqueue documents against the live users
    collection.  Any item whose userId no longer exists in users is:
      1. Deleted from fraudqueue (hard delete — won't reappear on next scan).
      2. Excluded from the returned list.

    This is the single source-of-truth fix: no matter how a user was deleted
    (admin panel, direct DB op, fraud action, etc.) their queue entry is
    cleaned up the next time the monitor fetches the queue.
    """
    if not queue_items:
        return []

    # Build a set of ObjectIds from the queue batch
    oid_map = {}   # ObjectId → original queue item
    for item in queue_items:
        uid = item.get('userId')
        if uid is None:
            continue
        oid = uid if isinstance(uid, ObjectId) else ObjectId(str(uid))
        oid_map[oid] = item

    if not oid_map:
        return queue_items

    # Single round-trip: which of these ids still exist in users?
    existing_ids = {
        doc['_id']
        for doc in db.users.find(
            {'_id': {'$in': list(oid_map.keys())}},
            {'_id': 1}
        )
    }

    live_items = []
    stale_oids = []

    for oid, item in oid_map.items():
        if oid in existing_ids:
            live_items.append(item)
        else:
            stale_oids.append(oid)

    # Hard-delete stale fraudqueue entries so they never come back
    if stale_oids:
        result = db.fraudqueue.delete_many({'userId': {'$in': stale_oids}})
        print(
            f'[queue] Purged {result.deleted_count} stale entries '
            f'for non-existent users: {[str(o) for o in stale_oids]}'
        )

    return live_items
# ─────────────────────────────────────────────────────────────────────────────


@actions_bp.route('/action', methods=['POST'])
def take_action():
    """
    Body:
    {
      "user_id":   "<mongo_id>",
      "user_role": "worker"|"client",
      "action":    "block"|"delete",
      "reason":    "Text shown to user via SMS + in-app notification"
    }
    """
    body      = request.get_json(force=True)
    user_id   = (body.get('user_id')   or '').strip()
    user_role = (body.get('user_role') or '').strip()
    action    = (body.get('action')    or '').strip()
    reason    = (body.get('reason')    or '').strip()

    if not all([user_id, user_role, action]):
        return jsonify({'error': 'user_id, user_role, action all required'}), 400
    if action not in ('block', 'delete', 'unblock'):
        return jsonify({'error': "action must be 'block', 'unblock', or 'delete'"}), 400
    if action in ('block', 'delete') and not reason:
        return jsonify({'error': 'reason is required for block or delete'}), 400

    db       = current_app.config['MONGO_DB']
    socketio = current_app.config['SOCKETIO']

    try:
        uid  = ObjectId(user_id)
        user = db.users.find_one({'_id': uid}, {'name': 1, 'mobile': 1, 'role': 1})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        name   = user.get('name',   'User')
        mobile = user.get('mobile', '')

        # ── 1. Apply action in MongoDB ────────────────────────────────────────
        if action == 'block':
            db.users.update_one(
                {'_id': uid},
                {'$set': {
                    'verificationStatus': 'blocked',
                    'blockedAt':          _utcnow(),
                    'blockReason':        reason,
                }},
            )
            notif_title   = 'Account Blocked'
            notif_message = (
                f'Hi {name}, your {user_role} account has been temporarily blocked '
                f'due to suspicious activity. Reason: {reason}. '
                f'Please contact our support team to resolve this.'
            )
        elif action == 'unblock':
            db.users.update_one(
                {'_id': uid},
                {'$set': {
                    'verificationStatus': 'approved',
                    'blockedAt':          None,
                    'blockReason':        None,
                }},
            )
            notif_title   = 'Account Restored'
            notif_message = (
                f'Hi {name}, your {user_role} account has been restored and is now active. '
                f'You can log in again now.'
            )
        else:  # delete
            db.users.delete_one({'_id': uid})
            # FIX: Hard-delete from fraudqueue immediately on user deletion
            # so it cannot reappear in the monitor before the next purge.
            db.fraudqueue.delete_one({'userId': uid})
            notif_title   = 'Account Removed'
            notif_message = (
                f'Your {user_role} account has been permanently removed from the '
                f'platform. Reason: {reason}. '
                f'If you believe this is an error, contact support within 7 days.'
            )

        # ── 2. Notify user via Node.js (SMS + in-app) ─────────────────────────
        _notify_node({
            'userId':     user_id,
            'title':      notif_title,
            'message':    notif_message,
            'mobile':     mobile,
            'smsMessage': notif_message,
            'action':     action,
        })

        # ── 3. Record in fraudactions collection ──────────────────────────────
        db.fraudactions.insert_one({
            'userId':   uid,
            'userRole': user_role,
            'userName': name,
            'mobile':   mobile,
            'action':   action,
            'reason':   reason,
            'takenAt':  _utcnow(),
            'takenBy':  'admin',
        })

        # ── 4. Mark actioned in fraudqueue (block only; delete already removed it)
        if action == 'block':
            db.fraudqueue.update_one(
                {'userId': uid},
                {'$set': {'actioned': True, 'actionedAt': _utcnow(), 'actionTaken': action}},
            )
        elif action == 'unblock':
            db.fraudqueue.delete_one({'userId': uid})

        # ── 5. Emit socket → remove card from all admin dashboards ────────────
        emit_action_taken(socketio, {
            'user_id': user_id,
            'action':  action,
            'message': f'{action.capitalize()} applied to {name}',
        })

        return jsonify({'success': True, 'message': f'{name} has been {action}ed.'}), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to apply action'}), 500


@actions_bp.route('/warn', methods=['POST'])
def warn_user():
    """
    Send a warning message to a user without blocking/deleting.
    Body: { "user_id": "<mongo_id>", "user_role": "worker"|"client", "message": "..." }
    """
    body      = request.get_json(force=True)
    user_id   = (body.get('user_id')   or '').strip()
    user_role = (body.get('user_role') or '').strip()
    message   = (body.get('message')   or '').strip()

    if not all([user_id, user_role, message]):
        return jsonify({'error': 'user_id, user_role, message all required'}), 400

    db = current_app.config['MONGO_DB']

    try:
        uid  = ObjectId(user_id)
        user = db.users.find_one({'_id': uid}, {'name': 1, 'mobile': 1})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        name   = user.get('name',   'User')
        mobile = user.get('mobile', '')

        _notify_node({
            'userId':     user_id,
            'title':      '⚠️ Platform Warning',
            'message':    message,
            'mobile':     mobile,
            'smsMessage': f'KarigarConnect Warning: {message}',
            'action':     'warn',
        })

        db.fraudactions.insert_one({
            'userId':   uid,
            'userRole': user_role,
            'userName': name,
            'mobile':   mobile,
            'action':   'warn',
            'reason':   message,
            'takenAt':  _utcnow(),
            'takenBy':  'admin',
        })

        db.fraudqueue.update_one(
            {'userId': uid},
            {'$set': {'lastWarningAt': _utcnow()}, '$inc': {'warningCount': 1}},
        )

        return jsonify({'success': True, 'message': f'Warning sent to {name}'}), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to send warning'}), 500


def _serialise(obj):
    """Recursively convert MongoDB BSON types → JSON-safe Python types."""
    from bson import ObjectId as ObjId
    from datetime import datetime as dt_type
    if isinstance(obj, dict):
        return {k: _serialise(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialise(v) for v in obj]
    if isinstance(obj, ObjId):
        return str(obj)
    if isinstance(obj, dt_type):
        return obj.isoformat()
    return obj


@actions_bp.route('/queue', methods=['GET'])
def get_queue():
    """
    Returns live users sorted by fraudProb DESC.
    Stale entries (users deleted from the users collection) are automatically
    purged from fraudqueue before the response is built.
    Supports ?role=worker|client and ?risk=HIGH|MEDIUM|LOW|SAFE filters.
    """
    db = current_app.config['MONGO_DB']

    role_filter = request.args.get('role', 'all')
    risk_filter = request.args.get('risk', 'all')

    query = {'actioned': {'$ne': True}}
    if role_filter in ('worker', 'client'):
        query['userRole'] = role_filter
    if risk_filter in ('HIGH', 'MEDIUM', 'LOW', 'SAFE'):
        query['riskLevel'] = risk_filter

    raw = list(
        db.fraudqueue
        .find(query)
        .sort('fraudProb', -1)
        .limit(200)
    )

    # ── CORE FIX: drop ghost entries for users deleted outside this service ───
    live_raw = _purge_deleted_users(db, raw)
    # ─────────────────────────────────────────────────────────────────────────

    result = []
    for item in live_raw:
        clean = _serialise(item)

        clean['fraud_probability']   = clean.get('fraudProb',         clean.get('fraud_probability',   0))
        clean['fraud_percent']       = clean.get('fraudPercent',       clean.get('fraud_percent',       0))
        clean['risk_level']          = clean.get('riskLevel',          clean.get('risk_level',          'SAFE'))
        clean['top_reasons']         = clean.get('topReasons',         clean.get('top_reasons',         []))
        clean['name']                = clean.get('userName',           clean.get('name',                ''))
        clean['user_role']           = clean.get('userRole',           clean.get('user_role',           ''))
        clean['user_id']             = clean.get('userId',             clean.get('user_id',             ''))
        clean['karigar_id']          = clean.get('karigarId',          clean.get('karigar_id',          ''))
        clean['verification_status'] = clean.get('verificationStatus', clean.get('verification_status', ''))
        clean['features_snapshot']   = clean.get('featuresSnapshot',   clean.get('features_snapshot',   {}))
        clean['is_fraud']            = clean.get('isFraud',            clean.get('is_fraud',            False))

        flagged_at = clean.get('flaggedAt')
        if flagged_at:
            clean['alertedAt'] = flagged_at

        result.append(clean)

    return jsonify(result), 200


@actions_bp.route('/queue/<user_id>', methods=['DELETE'])
def dismiss_alert(user_id: str):
    """Dismiss a fraud alert without taking action (mark as reviewed)."""
    try:
        db = current_app.config['MONGO_DB']
        db.fraudqueue.update_one(
            {'userId': ObjectId(user_id)},
            {'$set': {
                'actioned':    True,
                'actionedAt':  _utcnow(),
                'actionTaken': 'dismissed',
            }},
        )
        emit_action_taken(current_app.config['SOCKETIO'], {
            'user_id': user_id,
            'action':  'dismissed',
        })
        return jsonify({'success': True}), 200
    except Exception:
        return jsonify({'error': 'Dismiss failed'}), 500


@actions_bp.route('/actions', methods=['GET'])
def get_action_history():
    """Returns last 50 fraud actions taken by admins."""
    db    = current_app.config['MONGO_DB']
    limit = int(request.args.get('limit', 50))

    actions = list(
        db.fraudactions
        .find({}, {'_id': 0, 'userId': 0})
        .sort('takenAt', -1)
        .limit(limit)
    )
    for a in actions:
        if 'takenAt' in a and hasattr(a['takenAt'], 'isoformat'):
            a['takenAt'] = a['takenAt'].isoformat()

    return jsonify(actions), 200


@actions_bp.route('/metrics', methods=['GET'])
def get_metrics():
    from utils.model_loader import get_loader
    loader = get_loader()
    return jsonify(loader.get_all_metrics()), 200