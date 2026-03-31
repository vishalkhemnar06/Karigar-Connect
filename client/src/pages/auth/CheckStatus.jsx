// client/src/pages/auth/CheckStatus.jsx
// Worker Application Status Check Page
// Similar layout to Login page

import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Search, Clock, CheckCircle, XCircle, AlertCircle, Home } from 'lucide-react';

// ─── Stable sub-components ────────────────────────────────────────────

const TextInput = ({ label, type, placeholder, value, onChange, required, maxLength, prefix, inputMode, name }) => (
    <div className="space-y-1.5">
        {label && (
            <label className="block text-xs font-black text-gray-500 uppercase tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>
                {label}
            </label>
        )}
        <div className="relative flex items-center">
            {prefix && (
                <span className="absolute left-4 text-gray-400 text-sm font-medium select-none pointer-events-none z-10" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {prefix}
                </span>
            )}
            <input
                type={type || 'text'}
                name={name}
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
                maxLength={maxLength}
                inputMode={inputMode}
                className={[
                    'w-full border-2 rounded-xl py-3 pr-12 bg-gray-50 text-gray-900',
                    'placeholder-gray-300 text-sm font-medium',
                    'focus:border-orange-400 focus:ring-4 focus:ring-orange-50 focus:outline-none focus:bg-white',
                    'transition-all duration-200',
                    prefix ? 'pl-14' : 'pl-4',
                    'border-gray-200',
                ].join(' ')}
                style={{ fontFamily: 'Inter, sans-serif' }}
            />
        </div>
    </div>
);

const SubmitBtn = ({ loading, children }) => (
    <button type="submit" disabled={loading}
        className={[
            'w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-black text-sm',
            'hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2',
        ].join(' ')}
        style={{ fontFamily: 'Inter, sans-serif' }}>
        {loading ? (
            <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Checking...</span>
            </>
        ) : children}
    </button>
);

const StatusBadge = ({ status }) => {
    const statusConfig = {
        pending: { icon: Clock, color: 'yellow', label: 'Pending Review', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
        approved: { icon: CheckCircle, color: 'green', label: 'Approved', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
        rejected: { icon: XCircle, color: 'red', label: 'Rejected', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
        blocked: { icon: AlertCircle, color: 'gray', label: 'Blocked', bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <div className={`${config.bg} ${config.text} border-2 ${config.border} rounded-2xl p-6 mt-6 flex items-start gap-4`}>
            <Icon size={32} className="flex-shrink-0 mt-1" />
            <div className="flex-1">
                <h3 className="text-lg font-black">{config.label}</h3>
            </div>
        </div>
    );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────

const CheckStatus = () => {
    const navigate = useNavigate();
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const onIdentifierChange = useCallback(e => setIdentifier(e.target.value), []);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const input = identifier.trim();

        if (!input) {
            setError('Please enter your phone number or KarigarID.');
            setResult(null);
            return;
        }

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const { data } = await api.getWorkerApplicationStatus({ identifier: input });
            
            if (data.registered) {
                setResult(data);
            } else {
                setError('No application found. Please check your phone number or KarigarID.');
                setResult(null);
            }
        } catch (err) {
            const msg = err?.response?.data?.message || 'Unable to fetch application status. Please try again.';
            setError(msg);
            setResult(null);
        } finally {
            setLoading(false);
        }
    }, [identifier]);

    return (
        <div className="min-h-screen flex bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
            {/* ── LEFT ── */}
            <div className="w-full lg:w-[56%] flex flex-col justify-center px-6 py-10 lg:px-12 bg-gradient-to-br from-orange-50 to-white">
                {/* Back button */}
                <Link to="/"
                    className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold mb-8 group">
                    <Home size={18} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                {/* Brand */}
                <div className="mb-8">
                    <div className="inline-flex items-center gap-2 bg-orange-100 px-3 py-1.5 rounded-full mb-4">
                        <span className="text-orange-600 text-xs font-black uppercase tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>KarigarConnect</span>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black text-gray-900 tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>Check Your Status 🔍</h1>
                    <p className="text-gray-600 text-base mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>Know your application status using your phone number or KarigarID</p>
                </div>

                {/* Form card */}
                <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
                        <h2 className="text-white font-black text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>Application Status</h2>
                        <p className="text-white/70 text-sm mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>Check your verification status</p>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
                            <TextInput
                                label="Phone Number or KarigarID"
                                type="text"
                                placeholder="Enter 10-digit phone or KarigarID"
                                value={identifier}
                                onChange={onIdentifierChange}
                                required
                                name="status_identifier"
                            />

                            <SubmitBtn loading={loading}>
                                <Search size={16} /><span>Check Status</span>
                            </SubmitBtn>

                            {/* Error message */}
                            {error && (
                                <div className="mt-4 p-4 rounded-xl bg-red-50 border-2 border-red-200 flex items-start gap-3">
                                    <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-red-700 text-sm" style={{ fontFamily: 'Inter, sans-serif' }}>{error}</p>
                                </div>
                            )}

                            {/* Success result */}
                            {result && (
                                <div className="mt-6 space-y-4">
                                    <StatusBadge status={result.status} />

                                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 space-y-3">
                                        <div>
                                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Name</p>
                                            <p className="text-lg font-bold text-gray-900">{result.worker?.name || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">KarigarID</p>
                                            <p className="text-lg font-mono font-bold text-gray-800">{result.worker?.karigarId || result.identifier}</p>
                                        </div>
                                        {result.worker?.phone && (
                                            <div>
                                                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Phone</p>
                                                <p className="text-lg font-mono text-gray-800">+91 {result.worker.phone}</p>
                                            </div>
                                        )}
                                    </div>

                                    {result.statusMessage && (
                                        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-4">
                                            <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">Message</p>
                                            <p className="text-gray-800 text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>{result.statusMessage}</p>
                                        </div>
                                    )}

                                    {result.status === 'rejected' && result.rejectionReason && (
                                        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Rejection Reason</p>
                                            <p className="text-red-800 text-sm font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>{result.rejectionReason}</p>
                                        </div>
                                    )}

                                    {result.status === 'pending' && (
                                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
                                            <p className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Note</p>
                                            <p className="text-yellow-900 text-sm mt-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                                                Your application is under review. Please check back soon for updates.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-base text-gray-700" style={{ fontFamily: 'Inter, sans-serif' }}>
                        Want to apply?{' '}
                        <Link to="/register" className="font-bold text-orange-600 hover:text-orange-800">Register now</Link>
                    </p>
                </div>
            </div>

            {/* ── RIGHT ── */}
            <div className="hidden lg:flex lg:w-[44%] relative overflow-hidden bg-gray-900">
                <img 
                    src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1032&q=80"
                    alt="Status Check"
                    className="absolute inset-0 w-full h-full object-cover opacity-70 transition-all duration-700" 
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="relative z-10 h-full flex items-end p-8 lg:p-10">
                    <div className="max-w-sm">
                        <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                            Track Your Progress
                        </h2>
                        <p className="text-white/80 text-base leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                            Monitor your application status and get real-time updates about your verification process.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CheckStatus;
