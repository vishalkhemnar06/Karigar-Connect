// src/pages/worker/CreateGroup.jsx
// MOBILE-FRIENDLY VERSION
//   - All converted to Tailwind with responsive design
//   - Touch-friendly buttons (min-height 48px)
//   - Improved spacing and layout for mobile
//   - Better form validation feedback
//   - Smooth animations and transitions

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, ArrowLeft, AlertCircle,
  CheckCircle, Sparkles, Hash, FileText, User,
  Info, Shield, Loader2, X
} from 'lucide-react';
import { createGroupAPI } from '../../api';

let _tid = 0;
const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const show = (msg, type = 'success') => {
    const id = ++_tid;
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  return { toasts, success: m => show(m, 'success'), error: m => show(m, 'error') };
};

const ToastList = ({ toasts }) => (
  <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-5 sm:top-5 z-[9999] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div 
        key={t.id} 
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl animate-in slide-in-from-top duration-300 ${
          t.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-green-500 to-emerald-600'
        }`}
      >
        {t.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
        {t.msg}
      </div>
    ))}
  </div>
);

const Field = ({ label, required, error, hint, children, icon: Icon }) => (
  <div className="flex flex-col gap-1.5 sm:gap-2">
    <label className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-1">
      {Icon && <Icon size={12} className="text-orange-500" />}
      {label}
      {required && <span className="text-red-500 text-sm">*</span>}
    </label>
    {children}
    {hint && !error && (
      <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium flex items-center gap-1">
        <Info size={10} /> {hint}
      </p>
    )}
    {error && (
      <p className="text-[10px] sm:text-[11px] text-red-500 font-semibold flex items-center gap-1 animate-in fade-in slide-in-from-left">
        <AlertCircle size={10} /> {error}
      </p>
    )}
  </div>
);

export default function CreateGroup() {
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', description: '', memberKarigarId: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleChange = e => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Group name is required';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    else if (form.name.trim().length > 60) e.name = 'Name cannot exceed 60 characters';
    
    if (!form.memberKarigarId.trim()) e.memberKarigarId = "Second member's Karigar ID is required";
    else if (!/^K\d+$/i.test(form.memberKarigarId.trim())) e.memberKarigarId = 'Format: K followed by digits (e.g., K123456)';
    else if (form.memberKarigarId.trim().toUpperCase() === localStorage.getItem('user')?.karigarId?.toUpperCase()) {
      e.memberKarigarId = 'You cannot add yourself as a member';
    }
    return e;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Scroll to first error
      const firstError = document.querySelector('.border-red-300');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLoading(true);
    try {
      await createGroupAPI(form);
      setSuccess(true);
      toast.success('Group created successfully! 🎉');
      setTimeout(() => navigate('/worker/my-groups'), 1800);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Error creating group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const charLeft = 200 - (form.description?.length || 0);
  const isKarigarIdValid = form.memberKarigarId && /^K\d+$/i.test(form.memberKarigarId.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/40 via-white to-orange-50/20 p-3 sm:p-4 pb-24 sm:pb-8">
      <ToastList toasts={toast.toasts} />

      {/* Success Overlay */}
      {success && (
        <div className="fixed inset-0 bg-orange-50/95 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center animate-in fade-in">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-xl"
            >
              <CheckCircle size={38} className="text-white" />
            </motion.div>
            <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-2">Group Created!</h2>
            <p className="text-sm text-gray-500">Redirecting to My Groups...</p>
            <div className="mt-4 w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto" style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.13rem' }}>
        {/* Header - Mobile Optimized */}
        <div className="flex items-center gap-3 mb-5 sm:mb-6">
          <button
            onClick={() => navigate('/worker/my-groups')}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-2 border-orange-200 bg-white flex items-center justify-center text-gray-500 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-500 transition-all active:scale-95 flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Create Group
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 font-medium">Form a work team with other karigars</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:gap-5">
          {/* Card 1: Group Details */}
          <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 sm:px-5 py-3 sm:py-4 border-b border-orange-100 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Users size={14} className="text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-900">Group Details</p>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium">Name and describe your group</p>
              </div>
            </div>
            
            <div className="p-4 sm:p-5 flex flex-col gap-4 sm:gap-5">
              <Field 
                label="Group Name" 
                required 
                error={errors.name} 
                icon={Hash}
                hint="Choose a unique name for your team"
              >
                <div className="relative">
                  <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g., Elite Painters Team"
                    maxLength={60}
                    autoCapitalize="words"
                    className={`w-full pl-9 pr-3 py-3 border-2 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                      errors.name 
                        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-50' 
                        : focusedField === 'name'
                          ? 'border-orange-400 bg-white ring-4 ring-orange-50'
                          : 'border-orange-200 bg-orange-50 focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-50'
                    }`}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-gray-400">
                    {form.name?.length || 0}/60 characters
                  </p>
                  {form.name && form.name.length >= 50 && (
                    <p className="text-[10px] text-orange-500">Getting long</p>
                  )}
                </div>
              </Field>

              <Field 
                label="Description" 
                hint="Optional — describe what your group specialises in" 
                error={errors.description}
                icon={FileText}
              >
                <div className="relative">
                  <FileText size={14} className="absolute left-3 top-3 text-orange-400 pointer-events-none" />
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    maxLength={200}
                    placeholder="e.g., We specialise in interior painting, waterproofing, and wall finishes..."
                    className="w-full pl-9 pr-3 py-3 border-2 border-orange-200 rounded-xl text-sm font-medium bg-orange-50 focus:bg-white focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-50 transition-all resize-none"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-[10px] font-medium ${charLeft < 30 ? 'text-orange-500' : 'text-gray-400'}`}>
                    {charLeft} characters remaining
                  </p>
                  {form.description && charLeft < 50 && (
                    <p className="text-[10px] text-orange-500">Keep it concise</p>
                  )}
                </div>
              </Field>
            </div>
          </div>

          {/* Card 2: Add Member */}
          <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 sm:px-5 py-3 sm:py-4 border-b border-orange-100 flex items-center gap-3">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm">
                <UserPlus size={14} className="text-white" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-gray-900">Add Initial Member</p>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium">Groups need at least 2 members</p>
              </div>
            </div>
            
            <div className="p-4 sm:p-5 flex flex-col gap-4">
              {/* Info Banner */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                <Shield size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs sm:text-sm text-blue-700 font-medium leading-relaxed">
                    Enter the <strong>Karigar ID</strong> of the second member
                  </p>
                  <code className="inline-block mt-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono">
                    K531792
                  </code>
                </div>
              </div>

              <Field 
                label="Second Member's Karigar ID" 
                required 
                error={errors.memberKarigarId}
                icon={User}
                hint="Format: K followed by 6+ digits"
              >
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
                  <input
                    name="memberKarigarId"
                    value={form.memberKarigarId}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('karigarId')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="K123456"
                    autoCapitalize="characters"
                    inputMode="text"
                    className={`w-full pl-9 pr-3 py-3 border-2 rounded-xl text-sm font-mono font-semibold tracking-wider uppercase transition-all min-h-[48px] ${
                      errors.memberKarigarId 
                        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-50'
                        : focusedField === 'karigarId'
                          ? 'border-orange-400 bg-white ring-4 ring-orange-50'
                          : 'border-orange-200 bg-orange-50 focus:bg-white focus:border-orange-400 focus:ring-4 focus:ring-orange-50'
                    }`}
                  />
                </div>
              </Field>

              {/* Valid Format Indicator */}
              {form.memberKarigarId && !errors.memberKarigarId && isKarigarIdValid && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4 flex items-center gap-3 animate-in fade-in slide-in-from-left">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CheckCircle size={14} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs sm:text-sm font-bold text-green-800">{form.memberKarigarId.toUpperCase()}</p>
                    <p className="text-[10px] sm:text-[11px] text-green-600 font-medium">Valid format ✓</p>
                  </div>
                </div>
              )}

              {/* Invalid Format Warning */}
              {form.memberKarigarId && !errors.memberKarigarId && !isKarigarIdValid && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4 flex items-center gap-3 animate-in fade-in slide-in-from-left">
                  <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-amber-800">Invalid format</p>
                    <p className="text-[10px] sm:text-[11px] text-amber-600">Karigar ID should start with K followed by digits</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Section - Mobile Optimized */}
          {(form.name.trim() || form.memberKarigarId.trim()) && (
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-4 sm:p-5 shadow-sm animate-in fade-in slide-in-from-bottom">
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                <Sparkles size={10} /> Group Preview
              </p>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Users size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm sm:text-base truncate">
                    {form.name.trim() || <span className="text-gray-300">Group name...</span>}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[8px] sm:text-[9px] font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                      You (Admin)
                    </span>
                    {form.memberKarigarId.trim() && isKarigarIdValid && (
                      <span className="text-[8px] sm:text-[9px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                        {form.memberKarigarId.toUpperCase()}
                      </span>
                    )}
                    {form.memberKarigarId.trim() && !isKarigarIdValid && (
                      <span className="text-[8px] sm:text-[9px] font-bold bg-red-400 text-white px-2 py-0.5 rounded-full shadow-sm">
                        Invalid ID
                      </span>
                    )}
                  </div>
                  {form.description && (
                    <p className="text-[10px] sm:text-[11px] text-gray-500 mt-2 line-clamp-2">
                      {form.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Submit Button - Touch Optimized */}
          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-200 hover:shadow-orange-300 disabled:opacity-60 transition-all min-h-[52px] active:scale-[0.98] hover:scale-[1.01]"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Creating Group...
              </>
            ) : (
              <>
                <Users size={18} />
                Create Group
              </>
            )}
          </button>

          {/* Cancel Button */}
          <button
            type="button"
            onClick={() => navigate('/worker/my-groups')}
            className="text-gray-400 text-xs sm:text-sm font-semibold py-2 hover:text-orange-500 transition-colors active:scale-95"
          >
            Cancel — go back to My Groups
          </button>
        </form>
      </div>

      {/* Add custom styles for animations */}
      <style jsx>{`
        @keyframes slide-in-from-top {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes slide-in-from-left {
          from {
            transform: translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slide-in-from-bottom {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-in {
          animation-duration: 0.3s;
          animation-fill-mode: both;
        }
        
        .slide-in-from-top {
          animation-name: slide-in-from-top;
        }
        
        .slide-in-from-left {
          animation-name: slide-in-from-left;
        }
        
        .slide-in-from-bottom {
          animation-name: slide-in-from-bottom;
        }
        
        .fade-in {
          animation-name: fade-in;
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}