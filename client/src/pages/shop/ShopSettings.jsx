import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LogOut, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import * as api from '../../api';
import { useShopOnboarding } from '../../context/ShopOnboardingContext';

const ShopSettings = () => {
    const navigate = useNavigate();
    const { restartGuideFromSettings } = useShopOnboarding();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const shop = JSON.parse(localStorage.getItem('shop') || '{}');

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== 'DELETE') {
            toast.error('Please type DELETE to confirm account deletion');
            return;
        }

        setIsDeleting(true);
        try {
            await api.deleteShopAccount();
            
            // Clear localStorage
            localStorage.removeItem('shopToken');
            localStorage.removeItem('shopRole');
            localStorage.removeItem('shop');
            
            toast.success('Account deleted successfully', {
                icon: '👋',
                style: { background: '#ffedd5', color: '#9a3412' }
            });

            // Redirect to login
            setTimeout(() => {
                navigate('/login');
            }, 1500);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete account');
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6 md:p-8" data-guide-id="shop-sidebar-settings">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                            Account Settings
                        </h1>
                        <p className="text-gray-600">
                            Manage your shop account and settings
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={restartGuideFromSettings}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors"
                    >
                        <BookOpen size={16} />
                        User Guide
                    </button>
                </div>

                {/* Settings Cards */}
                <div className="space-y-6">
                    {/* Danger Zone */}
                    <div className="bg-white rounded-2xl border-2 border-red-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                        <div className="bg-gradient-to-r from-red-50 to-pink-50 px-6 py-4 border-b border-red-100">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={24} className="text-red-600" />
                                <h2 className="text-xl font-bold text-red-900">
                                    Danger Zone
                                </h2>
                            </div>
                            <p className="text-sm text-red-700 mt-2 ml-9">
                                Irreversible actions - proceed with caution
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Delete Account Section */}
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            Delete Account Permanently
                                        </h3>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Once deleted, your shop account and all associated data cannot be recovered.
                                        </p>
                                    </div>
                                </div>

                                {!showDeleteConfirm ? (
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 active:scale-95"
                                    >
                                        Delete My Account
                                    </button>
                                ) : (
                                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mt-4">
                                        <div className="flex items-start gap-3 mb-4">
                                            <AlertTriangle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <h4 className="font-bold text-red-900 mb-2">
                                                    Are you absolutely sure?
                                                </h4>
                                                <ul className="text-sm text-red-800 space-y-1 ml-0">
                                                    <li>✗ All your shop data will be permanently deleted</li>
                                                    <li>✗ Your shop profile will no longer be visible to clients</li>
                                                    <li>✗ Active transactions can't be recovered</li>
                                                    <li>✗ This action cannot be undone</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <p className="text-sm font-semibold text-red-900 mb-3">
                                            To confirm, type "<span className="font-bold">DELETE</span>" below:
                                        </p>

                                        <input
                                            type="text"
                                            value={deleteConfirmText}
                                            onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                                            placeholder="Type DELETE to confirm"
                                            className="w-full px-4 py-2.5 border-2 border-red-300 rounded-lg font-monospace font-semibold text-center text-red-900 placeholder-red-300 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-200 mb-4"
                                        />

                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleDeleteAccount}
                                                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                                                className={`flex-1 py-2.5 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                                                    deleteConfirmText === 'DELETE' && !isDeleting
                                                        ? 'bg-red-600 hover:bg-red-700 text-white active:scale-95'
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                }`}
                                            >
                                                {isDeleting ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                                                        Deleting...
                                                    </>
                                                ) : (
                                                    <>
                                                        <LogOut size={16} />
                                                        Delete Account Permanently
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowDeleteConfirm(false);
                                                    setDeleteConfirmText('');
                                                }}
                                                disabled={isDeleting}
                                                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Additional Settings */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-6">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            Shop Information
                        </h2>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div>
                                    <p className="text-sm text-gray-600">Shop Name</p>
                                    <p className="font-semibold text-gray-900">{shop.shopName || 'Not set'}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-gray-100">
                                <div>
                                    <p className="text-sm text-gray-600">Category</p>
                                    <p className="font-semibold text-gray-900">{shop.category || 'Not set'}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm text-gray-600">Account Status</p>
                                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-green-500 rounded-full" />
                                        Active
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShopSettings;
