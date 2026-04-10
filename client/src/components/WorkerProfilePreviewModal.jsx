import React from 'react';
import { X } from 'lucide-react';
import PublicProfile from '../pages/PublicProfile';

export default function WorkerProfilePreviewModal({ workerId, onClose }) {
    if (!workerId) return null;

    return (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="relative w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden my-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/95 text-gray-700 shadow-lg hover:bg-gray-100 transition-all"
                    aria-label="Close worker profile preview"
                >
                    <X size={18} />
                </button>
                <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
                    <PublicProfile workerId={workerId} inline onClose={onClose} />
                </div>
            </div>
        </div>
    );
}