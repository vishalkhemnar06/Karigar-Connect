// client/src/pages/auth/CheckStatus.jsx
// PREMIUM VERSION - Modern gradient design with smooth animations
// Worker Application Status Check Page

import React, { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import * as api from '../../api';
import toast from 'react-hot-toast';
import { Search, Clock, CheckCircle, XCircle, AlertCircle, Home, User, Phone, Mail, Calendar, Shield, Sparkles, ArrowRight } from 'lucide-react';

// ─── Stable sub-components ────────────────────────────────────────────

const TextInput = ({ label, type, placeholder, value, onChange, required, maxLength, prefix, inputMode, name }) => (
    <div className="space-y-1.5">
        {label && (
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {label}
            </label>
        )}
        <div className="relative flex items-center group">
            {prefix && (
                <span className="absolute left-4 text-gray-400 text-sm font-medium select-none pointer-events-none z-10">
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
                    'w-full border border-gray-200 rounded-xl py-3 pr-4 bg-gray-50 text-gray-800',
                    'placeholder:text-gray-300 text-sm font-medium',
                    'focus:border-orange-400 focus:ring-2 focus:ring-orange-100 focus:outline-none focus:bg-white',
                    'transition-all duration-200',
                    prefix ? 'pl-11' : 'pl-4',
                ].join(' ')}
            />
        </div>
    </div>
);

const SubmitBtn = ({ loading, children }) => (
    <motion.button 
        whileTap={{ scale: 0.98 }}
        type="submit" 
        disabled={loading}
        className={[
            'w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white py-3 rounded-xl font-bold text-sm',
            'hover:shadow-lg hover:shadow-orange-200 transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2',
        ].join(' ')}>
        {loading ? (
            <>
                <Loader2 size="16" className="animate-spin" />
                <span>Checking...</span>
            </>
        ) : (
            <>
                <Search size="16" />
                <span>Check Status</span>
                <ArrowRight size="14" className="group-hover:translate-x-1 transition-transform" />
            </>
        )}
    </motion.button>
);

const StatusBadge = ({ status }) => {
    const statusConfig = {
        pending: { icon: Clock, color: 'yellow', label: 'Pending Review', bg: 'from-yellow-50 to-amber-50', text: 'text-yellow-800', border: 'border-yellow-200', gradient: 'from-yellow-500 to-amber-500' },
        approved: { icon: CheckCircle, color: 'green', label: 'Approved', bg: 'from-green-50 to-emerald-50', text: 'text-green-800', border: 'border-green-200', gradient: 'from-emerald-500 to-green-500' },
        rejected: { icon: XCircle, color: 'red', label: 'Rejected', bg: 'from-red-50 to-rose-50', text: 'text-red-800', border: 'border-red-200', gradient: 'from-red-500 to-rose-500' },
        blocked: { icon: AlertCircle, color: 'gray', label: 'Blocked', bg: 'from-gray-50 to-gray-100', text: 'text-gray-800', border: 'border-gray-200', gradient: 'from-gray-500 to-gray-600' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-gradient-to-r ${config.bg} text-${config.color}-800 border-2 ${config.border} rounded-xl p-5 flex items-start gap-3`}
        >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${config.gradient} flex items-center justify-center flex-shrink-0 shadow-md`}>
                <Icon size="20" className="text-white" />
            </div>
            <div className="flex-1">
                <h3 className="text-base font-bold">{config.label}</h3>
                <p className="text-xs text-gray-600 mt-0.5">Your application status</p>
            </div>
        </motion.div>
    );
};

// Helper Loader Component
const Loader2 = ({ size, className }) => (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
);

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
            setError('Please enter your phone number or User ID.');
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
                setError('No application found. Please check your phone number or User ID.');
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
        <div className="min-h-screen flex bg-white">
            {/* ── LEFT SIDE ── */}
            <div className="w-full lg:w-[56%] flex flex-col justify-center px-6 py-10 lg:px-12 bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10">
                
                {/* Back button */}
                <Link to="/"
                    className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-semibold mb-8 group w-fit">
                    <Home size="16" className="group-hover:-translate-x-1 transition-transform" />
                    Back to Home
                </Link>

                {/* Brand */}
                <div className="mb-8">
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 rounded-full mb-4 shadow-sm"
                    >
                        <Sparkles size="12" className="text-white" />
                        <span className="text-white text-[10px] font-black uppercase tracking-wider">KarigarConnect</span>
                    </motion.div>
                    <h1 className="text-3xl lg:text-4xl font-black text-gray-800 tracking-tight">Check Your Status 🔍</h1>
                    <p className="text-gray-500 text-sm mt-2">Know your application status using your phone number or User ID</p>
                </div>

                {/* Form card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
                >
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4">
                        <h2 className="text-white font-bold text-base">Application Status</h2>
                        <p className="text-orange-100 text-xs mt-0.5">Check your verification status</p>
                    </div>

                    <div className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
                            <TextInput
                                label="Phone Number or User ID"
                                type="text"
                                placeholder="Enter 10-digit phone or User ID"
                                value={identifier}
                                onChange={onIdentifierChange}
                                required
                                name="status_identifier"
                            />

                            <SubmitBtn loading={loading} />

                            {/* Error message */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3"
                                    >
                                        <div className="p-1 bg-red-500 rounded-full flex-shrink-0">
                                            <AlertCircle size="12" className="text-white" />
                                        </div>
                                        <p className="text-sm text-red-700 flex-1">{error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Success result */}
                            <AnimatePresence>
                                {result && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4 mt-2"
                                    >
                                        <StatusBadge status={result.status} />

                                        {/* Details Card */}
                                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                                            <div className="flex items-center gap-2 mb-4">
                                                <User size="16" className="text-blue-600" />
                                                <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Worker Details</h3>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Full Name</p>
                                                    <p className="text-sm font-bold text-gray-800 mt-1">{result.worker?.name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">User ID</p>
                                                    <p className="text-sm font-mono font-bold text-gray-800 mt-1">{result.worker?.userId || result.worker?.karigarId || result.identifier}</p>
                                                </div>
                                                {result.worker?.phone && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Phone</p>
                                                        <p className="text-sm font-mono font-bold text-gray-800 mt-1">+91 {result.worker.phone}</p>
                                                    </div>
                                                )}
                                                {result.worker?.email && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Email</p>
                                                        <p className="text-sm font-medium text-gray-700 mt-1 truncate">{result.worker.email}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status Message */}
                                        {result.statusMessage && (
                                            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Shield size="14" className="text-orange-600" />
                                                    <p className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Message</p>
                                                </div>
                                                <p className="text-sm text-gray-700 leading-relaxed">{result.statusMessage}</p>
                                            </div>
                                        )}

                                        {/* Rejection Reason */}
                                        {result.status === 'rejected' && result.rejectionReason && (
                                            <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl p-4 border border-red-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <AlertCircle size="14" className="text-red-600" />
                                                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Rejection Reason</p>
                                                </div>
                                                <p className="text-sm text-red-700 leading-relaxed">{result.rejectionReason}</p>
                                            </div>
                                        )}

                                        {/* Pending Note */}
                                        {result.status === 'pending' && (
                                            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Clock size="14" className="text-yellow-600" />
                                                    <p className="text-[10px] font-bold text-yellow-700 uppercase tracking-wider">Note</p>
                                                </div>
                                                <p className="text-sm text-yellow-800 leading-relaxed">
                                                    Your application is under review. Please check back soon for updates.
                                                </p>
                                            </div>
                                        )}

                                        {/* Additional Info */}
                                        {result.createdAt && (
                                            <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
                                                <p className="text-[10px] text-gray-500">Application Submitted</p>
                                                <p className="text-xs font-medium text-gray-700 mt-1">
                                                    {new Date(result.createdAt).toLocaleDateString('en-IN', { 
                                                        day: 'numeric', 
                                                        month: 'long', 
                                                        year: 'numeric' 
                                                    })}
                                                </p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </form>
                    </div>
                </motion.div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600">
                        Want to apply?{' '}
                        <Link to="/register" className="font-bold text-orange-600 hover:text-orange-700 transition-colors">
                            Register now
                        </Link>
                    </p>
                </div>
            </div>

            {/* ── RIGHT SIDE ── */}
            <div className="hidden lg:flex lg:w-[44%] relative overflow-hidden bg-gray-900">
                <img 
                    src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1032&q=80"
                    alt="Status Check"
                    className="absolute inset-0 w-full h-full object-cover opacity-70 transition-all duration-700 hover:scale-105" 
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="relative z-10 h-full flex flex-col justify-end p-10">
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="max-w-sm"
                    >
                        <div className="mb-4">
                            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1.5 mb-3">
                                <Sparkles size="12" className="text-white" />
                                <span className="text-white text-xs font-semibold">Track Your Progress</span>
                            </div>
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-3">
                            Track Your Application
                        </h2>
                        <p className="text-white/80 text-sm leading-relaxed">
                            Monitor your application status and get real-time updates about your verification process.
                        </p>
                        
                        {/* Feature highlights */}
                        <div className="mt-6 space-y-2">
                            {[
                                'Real-time status updates',
                                'Instant notifications',
                                'Fast verification process'
                            ].map((feature, idx) => (
                                <motion.div 
                                    key={idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + idx * 0.1 }}
                                    className="flex items-center gap-2"
                                >
                                    <CheckCircle size="12" className="text-green-400" />
                                    <span className="text-white/70 text-xs">{feature}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default CheckStatus;