import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import * as api from '../../api';
import { Shield, Key, Phone, Trash2, AlertTriangle } from 'lucide-react';

// FIXES in this file:
//   1. Replaced undefined CSS class `btn-secondary` on Delete Account button
//      with proper Tailwind classes (button was completely unstyled before)

const Settings = () => {
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(false);

    const handleDeleteAccount = async () => {
        if (!window.confirm(
            'WARNING: Are you absolutely sure you want to permanently delete your account?\n\nThis action CANNOT be undone. All your data will be removed.'
        )) return;

        setDeleting(true);
        try {
            await api.deleteAccount();
            toast.success('Your account has been deleted.');
            localStorage.clear();
            navigate('/register');
        } catch {
            toast.error('Failed to delete account. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-8 max-w-lg">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
                <p className="text-gray-500 text-sm mt-1">Manage your account preferences</p>
            </div>

            {/* Account Info Cards */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm divide-y divide-gray-100">
                <div className="p-5 flex items-start gap-4">
                    <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Key className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-800">Change Password</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Use the "Forgot Password" option on the login page to reset your password securely via email.
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
                            Your data is stored securely. Aadhar and ID documents are only accessible to admins for verification purposes.
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
                        {/* FIX: was `btn-secondary bg-red-500 text-white hover:bg-red-600`
                            where btn-secondary is an undefined class — replaced with proper Tailwind */}
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deleting}
                            className="flex-shrink-0 flex items-center gap-2 bg-red-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors disabled:opacity-60"
                        >
                            {deleting ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            ) : (
                                <><Trash2 size={15} /> Delete Account</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;