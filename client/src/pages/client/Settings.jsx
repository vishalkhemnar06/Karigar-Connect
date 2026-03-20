import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Shield, Key, Phone, Trash2, AlertTriangle, X } from 'lucide-react';
import * as api from '../../api';

const Settings = () => {
    const navigate = useNavigate();
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    const CONFIRM_PHRASE = 'DELETE';

    const handleDeleteAccount = async () => {
        if (confirmText !== CONFIRM_PHRASE) {
            toast.error(`Type "${CONFIRM_PHRASE}" to confirm.`);
            return;
        }
        setDeleting(true);
        try {
            await api.deleteClientAccount();
            toast.success('Your account has been permanently deleted.');
            localStorage.clear();
            navigate('/register');
        } catch {
            toast.error('Failed to delete account. Please try again.');
        } finally {
            setDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
            <div className="max-w-lg mx-auto space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage your account preferences</p>
                </div>

                {/* Info cards */}
                <div className="bg-white rounded-2xl border border-orange-100 shadow-sm divide-y divide-gray-100">
                    <div className="p-5 flex items-start gap-4">
                        <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Key className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-800">Change Password</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Use the "Forgot Password" option on the login page to reset your password securely.
                            </p>
                        </div>
                    </div>

                    <div className="p-5 flex items-start gap-4">
                        <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Phone className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-800">Change Mobile Number</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Your mobile number is tied to your KarigarConnect identity. Contact support to update it.
                            </p>
                        </div>
                    </div>

                    <div className="p-5 flex items-start gap-4">
                        <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Shield className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-gray-800">Privacy & Data</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Your data is stored securely and only accessible to authorised personnel.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div>
                    <h2 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Danger Zone
                    </h2>
                    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <p className="font-semibold text-gray-800">Delete Account</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Once deleted, your profile, job history, and all data will be permanently removed.
                                </p>
                            </div>
                            <button
                                onClick={() => { setConfirmText(''); setShowConfirm(true); }}
                                className="flex-shrink-0 flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors"
                            >
                                <Trash2 size={15} />
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Delete Account</h3>
                            </div>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600">
                                This action is <span className="font-semibold text-red-600">permanent and cannot be undone</span>.
                                All your profile data, job history, and account information will be deleted immediately.
                            </p>
                            <p className="text-sm text-gray-700 font-medium">
                                Type <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{CONFIRM_PHRASE}</span> to confirm:
                            </p>
                            <input
                                type="text"
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={`Type ${CONFIRM_PHRASE} here`}
                                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                                autoFocus
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={deleting || confirmText !== CONFIRM_PHRASE}
                                className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deleting ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                ) : (
                                    <><Trash2 size={14} /> Delete Permanently</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
