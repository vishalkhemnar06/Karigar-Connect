// client/src/components/fraud/ActionModal.jsx
// Block / Delete confirmation modal with editable pre-filled message.

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { takeAdminAction } from '../../store/slices/fraudSlice';
import toast from 'react-hot-toast';

const BLOCK_MSG = (name, role, reason) =>
    `Hi ${name}, your ${role} account on our platform has been temporarily blocked due to suspicious activity.\n\nReason: ${reason || 'Violation of platform terms and conditions'}.\n\nPlease contact our support team to restore your account access.`;

const DELETE_MSG = (name, role, reason) =>
    `Dear ${name}, your ${role} account has been permanently removed from our platform.\n\nReason: ${reason || 'Fraudulent activity detected on your account'}.\n\nIf you believe this is an error, please contact support within 7 days.`;

export function ActionModal({ alert, action, onClose }) {
    const dispatch          = useDispatch();
    const { actionLoading } = useSelector(s => s.fraud);
    const inputRef          = useRef(null);
    const isDelete          = action === 'delete';
    const topReason         = alert?.top_reasons?.[0]?.label || '';

    const [message,   setMessage]   = useState('');
    const [confirmed, setConfirmed] = useState('');
    const [error,     setError]     = useState('');

    useEffect(() => {
        setMessage(isDelete ? DELETE_MSG(alert?.name, alert?.user_role, topReason) : BLOCK_MSG(alert?.name, alert?.user_role, topReason));
        setConfirmed('');
        setError('');
    }, [alert, action]);

    useEffect(() => {
        if (isDelete) setTimeout(() => inputRef.current?.focus(), 100);
    }, [isDelete]);

    const handleSubmit = async () => {
        if (!message.trim()) return setError('Message cannot be empty.');
        if (isDelete && confirmed !== 'DELETE') return setError('Type DELETE to confirm permanent removal.');

        const result = await dispatch(takeAdminAction({
            userId: alert.user_id, userRole: alert.user_role,
            action, reason: message.trim(),
        }));

        if (takeAdminAction.fulfilled.match(result)) {
            toast.success(isDelete ? `${alert?.name}'s account deleted.` : `${alert?.name}'s account blocked.`);
            onClose();
        } else {
            toast.error(result.payload || 'Action failed.');
        }
    };

    if (!alert || !action) return null;

    return (
        <div onClick={onClose} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
            <div onClick={e => e.stopPropagation()} style={{
                background: '#fff', borderRadius: 14, padding: 28,
                width: '100%', maxWidth: 520,
                boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
                animation: 'modalIn 0.2s ease',
            }}>
                {/* Header */}
                <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 10, flexShrink: 0, fontSize: 20,
                        background: isDelete ? '#fef2f2' : '#fff7ed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {isDelete ? '🗑️' : '🔒'}
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111827' }}>
                            {isDelete ? 'Delete Account' : 'Block Account'}
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                            {isDelete ? 'This is permanent and cannot be undone.' : 'User will receive SMS and in-app notification.'}
                        </p>
                    </div>
                </div>

                {/* User summary */}
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 20 }}>
                    {[
                        ['Name',   alert.name || '—'],
                        ['Role',   alert.user_role],
                        ['Risk',   `${alert.risk_level} — ${Math.round((alert.fraud_probability||0)*100)}%`],
                    ].map(([lbl, val]) => (
                        <div key={lbl}>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>{lbl}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>{val}</div>
                        </div>
                    ))}
                </div>

                {/* Message */}
                <label style={{ display: 'block', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Message sent to user</span>
                        <span style={{ color: '#9ca3af', fontWeight: 400 }}>Sent via SMS + in-app</span>
                    </div>
                    <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={6}
                        style={{
                            width: '100%', padding: '10px 12px',
                            border: '1px solid #d1d5db', borderRadius: 8,
                            fontSize: 13, color: '#111827', lineHeight: 1.6,
                            resize: 'vertical', outline: 'none', fontFamily: 'Inter, sans-serif',
                            boxSizing: 'border-box', background: '#fff',
                        }}
                        onFocus={e => e.target.style.borderColor = '#6366f1'}
                        onBlur={e => e.target.style.borderColor = '#d1d5db'}
                    />
                </label>

                {/* Delete confirmation */}
                {isDelete && (
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                            Type <span style={{ fontFamily: 'Inter, sans-serif', background: '#fef2f2', color: '#dc2626', padding: '1px 5px', borderRadius: 3 }}>DELETE</span> to confirm
                        </label>
                        <input
                            ref={inputRef}
                            value={confirmed}
                            onChange={e => { setConfirmed(e.target.value); setError(''); }}
                            placeholder="Type DELETE"
                            style={{
                                width: '100%', padding: '9px 12px',
                                border: `1px solid ${confirmed === 'DELETE' ? '#16a34a' : '#d1d5db'}`,
                                borderRadius: 8, fontSize: 13, outline: 'none',
                                fontFamily: 'Inter, sans-serif', boxSizing: 'border-box',
                                color: '#111827', background: '#fff',
                            }}
                        />
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 14 }}>
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} disabled={actionLoading}
                        style={{ padding: '9px 20px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={actionLoading || (isDelete && confirmed !== 'DELETE')}
                        style={{
                            padding: '9px 20px', border: 'none', borderRadius: 8,
                            background: actionLoading ? '#e5e7eb' : isDelete ? '#dc2626' : '#d97706',
                            color: actionLoading ? '#9ca3af' : '#fff',
                            fontSize: 13, fontWeight: 700,
                            cursor: actionLoading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            opacity: (isDelete && confirmed !== 'DELETE' && !actionLoading) ? 0.5 : 1,
                            transition: 'opacity 0.15s',
                        }}
                    >
                        {actionLoading && <SpinIcon />}
                        {isDelete ? '🗑️ Delete Account' : '🔒 Block Account'}
                    </button>
                </div>
            </div>
            <style>{`@keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
        </div>
    );
}

const SpinIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'fraud-spin 0.8s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-9-9"/>
    </svg>
);