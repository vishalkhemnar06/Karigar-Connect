"""
server/fraud_service/routes/actions.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /api/fraud/action          — block or delete a flagged user
POST /api/fraud/warn            — send warning SMS/notification
GET  /api/fraud/queue           — current fraud alert queue (sorted by risk)
GET  /api/fraud/metrics         — model performance metrics
DELETE /api/fraud/queue/<id>    — dismiss (remove from queue without action)
GET  /api/fraud/actions         — action history log
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import os, traceback, requests
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from bson import ObjectId
from utils.notifier import emit_action_taken

actions_bp = Blueprint('actions', __name__)

NODE_BASE_URL   = os.environ.get('NODE_BASE_URL',   'http://localhost:5000')
INTERNAL_SECRET = os.environ.get('INTERNAL_SECRET', 'change_me')


def _utcnow():
    return datetime.now(timezone.utc)


def _notify_node(payload: dict):
    """Fire-and-forget call to Node.js to send SMS + in-app notification."""
    try:
        requests.post(
            f'{NODE_BASE_URL}/api/admin/fraud-notify',
            json=payload,
            headers={'x-internal-secret': INTERNAL_SECRET},
            timeout=5,
        )
    except Exception as e:
        print(f'[WARN] Node notification failed: {e}')


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

    if not all([user_id, user_role, action, reason]):
        return jsonify({'error': 'user_id, user_role, action, reason all required'}), 400
    if action not in ('block', 'delete'):
        return jsonify({'error': "action must be 'block' or 'delete'"}), 400

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
        else:  # delete
            db.users.delete_one({'_id': uid})
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

        # ── 4. Mark as actioned in fraudqueue ─────────────────────────────────
        db.fraudqueue.update_one(
            {'userId': uid},
            {'$set': {'actioned': True, 'actionedAt': _utcnow(), 'actionTaken': action}},
        )

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
    Body:
    {
      "user_id":    "<mongo_id>",
      "user_role":  "worker"|"client",
      "message":    "Custom warning text"
    }
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

        # Notify via Node.js
        _notify_node({
            'userId':     user_id,
            'title':      '⚠️ Platform Warning',
            'message':    message,
            'mobile':     mobile,
            'smsMessage': f'KarigarConnect Warning: {message}',
            'action':     'warn',
        })

        # Record warning in fraudactions
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

        # Update queue to note a warning was sent
        db.fraudqueue.update_one(
            {'userId': uid},
            {'$set': {
                'lastWarningAt':  _utcnow(),
                'warningCount':   1,  # $inc would be better in real code
            }, '$inc': {'warningCount': 1}},
        )

        return jsonify({'success': True, 'message': f'Warning sent to {name}'}), 200

    except Exception:
        traceback.print_exc()
        return jsonify({'error': 'Failed to send warning'}), 500


def _serialise(obj):
    """
    Recursively convert a MongoDB document to a JSON-safe dict.
    Handles: ObjectId → str, datetime → ISO string, nested dicts/lists.
    """
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
    Returns all scanned users sorted by fraudProb DESC.
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
        .find(query)          # fetch ALL fields including _id / userId
        .sort('fraudProb', -1)
        .limit(200)
    )

    result = []
    for item in raw:
        # Deep-convert all BSON types → JSON-safe Python types
        clean = _serialise(item)

        # Normalise camelCase → snake_case for the React frontend
        clean['fraud_probability']  = clean.get('fraudProb',    clean.get('fraud_probability',  0))
        clean['fraud_percent']      = clean.get('fraudPercent',  clean.get('fraud_percent',      0))
        clean['risk_level']         = clean.get('riskLevel',     clean.get('risk_level',         'SAFE'))
        clean['top_reasons']        = clean.get('topReasons',    clean.get('top_reasons',        []))
        clean['name']               = clean.get('userName',      clean.get('name',               ''))
        clean['user_role']          = clean.get('userRole',      clean.get('user_role',          ''))
        clean['user_id']            = clean.get('userId',        clean.get('user_id',            ''))
        clean['karigar_id']         = clean.get('karigarId',     clean.get('karigar_id',         ''))
        clean['verification_status']= clean.get('verificationStatus', clean.get('verification_status', ''))
        clean['features_snapshot']  = clean.get('featuresSnapshot',   clean.get('features_snapshot',   {}))
        clean['is_fraud']           = clean.get('isFraud',       clean.get('is_fraud',           False))

        # flaggedAt → alertedAt
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
                'actioned':   True,
                'actionedAt': _utcnow(),
                'actionTaken': 'dismissed',
            }},
        )
        # Emit removal from dashboard
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