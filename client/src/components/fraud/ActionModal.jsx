// client/src/components/fraud/ActionModal.jsx
// Block / Delete confirmation modal with editable pre-filled message.

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { takeAdminAction } from '../../store/slices/fraudSlice';
import toast from 'react-hot-toast';
import { AlertTriangle, Shield, Trash2, Send, X, Loader2 } from 'lucide-react';

const BLOCK_MSG = (name, role, reason) =>
    `Hi ${name}, your ${role} account on our platform has been temporarily blocked due to suspicious activity.\n\nReason: ${reason || 'Violation of platform terms and conditions'}.\n\nPlease contact our support team to restore your account access.`;

const DELETE_MSG = (name, role, reason) =>
    `Dear ${name}, your ${role} account has been permanently removed from our platform.\n\nReason: ${reason || 'Fraudulent activity detected on your account'}.\n\nIf you believe this is an error, please contact support within 7 days.`;

export function ActionModal({ alert, action, onClose }) {
    const dispatch = useDispatch();
    const { actionLoading } = useSelector(s => s.fraud);
    const inputRef = useRef(null);
    const isDelete = action === 'delete';
    const topReason = alert?.top_reasons?.[0]?.label || '';

    const [message, setMessage] = useState('');
    const [confirmed, setConfirmed] = useState('');
    const [error, setError] = useState('');

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
            user_id: alert.user_id,
            user_role: alert.user_role,
            action,
            reason: message.trim(),
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
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className={`p-5 ${isDelete ? 'bg-gradient-to-r from-red-500 to-rose-500' : 'bg-gradient-to-r from-orange-500 to-amber-500'} text-white`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                                {isDelete ? <Trash2 size="18" className="text-white" /> : <Shield size="18" className="text-white" />}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">{isDelete ? 'Delete Account' : 'Block Account'}</h3>
                                <p className="text-white/80 text-xs">{isDelete ? 'This action is permanent and cannot be undone.' : 'User will receive SMS and in-app notification.'}</p>
                            </div>
                        </div>
                    </div>

                    {/* User Summary */}
                    <div className="p-5 border-b border-gray-100 bg-gray-50">
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Name</p>
                                <p className="text-sm font-semibold text-gray-800 mt-1">{alert.name || '—'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Role</p>
                                <p className="text-sm font-semibold text-gray-800 capitalize mt-1">{alert.user_role}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Risk</p>
                                <p className={`text-sm font-bold mt-1 ${
                                    alert.risk_level === 'HIGH' ? 'text-red-600' :
                                    alert.risk_level === 'MEDIUM' ? 'text-orange-600' : 'text-yellow-600'
                                }`}>
                                    {alert.risk_level} — {Math.round((alert.fraud_probability || 0) * 100)}%
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Message Textarea */}
                    <div className="p-5">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                            Message to User
                        </label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={5}
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                            placeholder="Message content..."
                        />
                        <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                            <Send size="10" /> Sent via SMS + In-app notification
                        </p>
                    </div>

                    {/* Delete Confirmation */}
                    {isDelete && (
                        <div className="px-5 pb-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                Type <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">DELETE</span> to confirm
                            </label>
                            <input
                                ref={inputRef}
                                type="text"
                                value={confirmed}
                                onChange={e => { setConfirmed(e.target.value.toUpperCase()); setError(''); }}
                                placeholder="Type DELETE here"
                                className={`w-full border-2 rounded-xl p-3 text-sm focus:outline-none transition-all ${
                                    confirmed === 'DELETE' 
                                        ? 'border-green-400 bg-green-50' 
                                        : 'border-gray-200 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                                }`}
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mx-5 mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                            <AlertTriangle size="14" className="text-red-600" />
                            <p className="text-xs text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div className="p-5 border-t border-gray-100 flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={actionLoading}
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={actionLoading || (isDelete && confirmed !== 'DELETE')}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                isDelete 
                                    ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600' 
                                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {actionLoading ? <Loader2 size="14" className="animate-spin" /> : isDelete ? <Trash2 size="14" /> : <Shield size="14" />}
                            {isDelete ? 'Delete Account' : 'Block Account'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}