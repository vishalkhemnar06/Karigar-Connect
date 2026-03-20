"""
server/fraud_service/utils/notifier.py
Socket.IO emit helpers — push fraud events to admin dashboard.
"""

from datetime import datetime, timezone


def emit_fraud_alert(socketio, payload: dict):
    """Emits to all admin clients connected to /fraud namespace."""
    full = {**payload, 'alertedAt': datetime.now(timezone.utc).isoformat()}
    socketio.emit('fraud_alert', full, namespace='/fraud')
    return full


def emit_action_taken(socketio, data: dict):
    """Tells all admin dashboards to remove the alert card for user_id."""
    socketio.emit('fraud_action_taken', data, namespace='/fraud')