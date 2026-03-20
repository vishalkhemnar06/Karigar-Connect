import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useDispatch } from 'react-redux';
import { removeAlertByUserId, upsertAlertFromSocket } from '../store/slices/fraudSlice';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_FRAUD_SOCKET_URL || 'http://localhost:5001';

export function useFraudSocket({ onAlert, onActionTaken } = {}) {
    const dispatch = useDispatch();
    const socketRef = useRef(null);
    const onAlertRef = useRef(onAlert);
    const onActionTakenRef = useRef(onActionTaken);

    useEffect(() => {
        onAlertRef.current = onAlert;
        onActionTakenRef.current = onActionTaken;
    }, [onActionTaken, onAlert]);

    useEffect(() => {
        const socket = io(`${SOCKET_URL}/fraud`, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            withCredentials: false,
        });

        socketRef.current = socket;

        socket.on('fraud_alert', (data) => {
            dispatch(upsertAlertFromSocket(data));
            showFraudToast(data);
            onAlertRef.current?.(data);
        });

        socket.on('fraud_action_taken', (data) => {
            if (data?.user_id) {
                dispatch(removeAlertByUserId(data.user_id));
            }
            onActionTakenRef.current?.(data);
        });

        socket.on('connect_error', () => {
            socket.disconnect();
        });

        return () => socket.disconnect();
    }, [dispatch]);

    return socketRef;
}

// ── Toast component ───────────────────────────────────────────────────────────
function showFraudToast(alert) {
    const colors = { HIGH: '#ef4444', MEDIUM: '#f97316', LOW: '#eab308' };
    const color  = colors[alert.risk_level] || '#6b7280';

    toast.custom(t => (
        <div style={{
            background:   '#0f172a',
            border:       `1.5px solid ${color}`,
            borderRadius: 10,
            padding:      '14px 16px',
            minWidth:     320,
            maxWidth:     380,
            boxShadow:    `0 4px 24px ${color}33`,
            fontFamily:   'DM Sans, Inter, sans-serif',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <span style={{
                            background:    color,
                            color:         '#fff',
                            fontSize:      10,
                            fontWeight:    700,
                            padding:       '2px 8px',
                            borderRadius:  4,
                            letterSpacing: '0.05em',
                        }}>
                            {alert.risk_level} RISK
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: 11, textTransform: 'uppercase' }}>
                            {alert.user_role}
                        </span>
                    </div>
                    <div style={{ color: '#f1f5f9', fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                        {alert.name || 'Unknown User'}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.4, marginBottom: 6 }}>
                        {alert.top_reasons?.[0]?.label || 'Suspicious activity detected'}
                    </div>
                    <div style={{ color, fontSize: 13, fontWeight: 700 }}>
                        {Math.round((alert.fraud_probability || 0) * 100)}% fraud probability
                    </div>
                </div>
                <button
                    onClick={() => toast.dismiss(t.id)}
                    style={{
                        background: 'none', border: 'none',
                        color: '#64748b', cursor: 'pointer',
                        fontSize: 20, lineHeight: 1, padding: 0, flexShrink: 0,
                    }}
                >×</button>
            </div>
        </div>
    ), { duration: 8000, position: 'top-right', id: alert.user_id });
}