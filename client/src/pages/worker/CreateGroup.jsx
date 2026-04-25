import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, ArrowLeft, AlertCircle,
  CheckCircle, Sparkles, Hash, FileText, User,
  Info, Shield, Loader2, X, Crown, Users2,
  Briefcase, Building2, Target, Heart, TrendingUp,
  Star, Gift, Zap, Calendar
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
  <AnimatePresence>
    {toasts.map(t => (
      <motion.div
        key={t.id}
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xl ${
          t.type === 'error' ? 'bg-gradient-to-r from-red-500 to-red-600' : 'bg-gradient-to-r from-emerald-500 to-green-600'
        }`}
      >
        {t.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
        {t.msg}
      </motion.div>
    ))}
  </AnimatePresence>
);

const Field = ({ label, required, error, hint, children, icon: Icon, optional }) => (
  <div className="flex flex-col gap-1.5 sm:gap-2">
    <label className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-1.5">
      {Icon && <Icon size={12} className="text-orange-500" />}
      {label}
      {required && <span className="text-red-500 text-sm">*</span>}
      {optional && <span className="text-[10px] text-gray-400 font-normal ml-1">(Optional)</span>}
    </label>
    {children}
    {hint && !error && (
      <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium flex items-center gap-1">
        <Info size={10} /> {hint}
      </p>
    )}
    {error && (
      <motion.p
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-[10px] sm:text-[11px] text-red-500 font-semibold flex items-center gap-1"
      >
        <AlertCircle size={10} /> {error}
      </motion.p>
    )}
  </div>
);

export default function CreateGroup() {
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', description: '', memberUserId: '' });
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
    let storedUser = null;
    try { storedUser = JSON.parse(localStorage.getItem('user') || '{}'); } catch { storedUser = {}; }
    const currentUserId = (storedUser?.userId || storedUser?.karigarId || '').toUpperCase();

    if (!form.name.trim()) e.name = 'Group name is required';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    else if (form.name.trim().length > 60) e.name = 'Name cannot exceed 60 characters';
    
    if (!form.memberUserId.trim()) e.memberUserId = "Second member's User ID is required";
    else if (!/^K\d+$/i.test(form.memberUserId.trim())) e.memberUserId = 'Format: K followed by digits (e.g., K123456)';
    else if (form.memberUserId.trim().toUpperCase() === currentUserId) {
      e.memberUserId = 'You cannot add yourself as a member';
    }
    return e;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      const firstError = document.querySelector('.border-red-300');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setLoading(true);
    try {
      await createGroupAPI(form);
      setSuccess(true);
      toast.success('Group created successfully! 🎉');
      setTimeout(() => navigate('/worker/my-groups'), 2000);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Error creating group. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const charLeft = 200 - (form.description?.length || 0);
  const isUserIdValid = form.memberUserId && /^K\d+$/i.test(form.memberUserId.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
      <ToastList toasts={toast.toasts} />

      {/* Success Overlay */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-orange-50/95 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center"
          >
            <div className="text-center p-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-xl"
              >
                <CheckCircle size={38} className="text-white" />
              </motion.div>
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl sm:text-2xl font-bold text-gray-900 mb-2"
              >
                Group Created!
              </motion.h2>
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-sm text-gray-500"
              >
                Redirecting to My Groups...
              </motion.p>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
          data-guide-id="worker-page-create-group"
          className="mb-6"
        >
          <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Users2 size="24" className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-black">Create Work Group</h1>
                  <p className="text-white/90 text-sm mt-0.5">Form a team with other karigars</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate('/worker/my-groups')}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
              >
                <ArrowLeft size="14" /> Back to My Groups
              </motion.button>
            </div>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Card 1: Group Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all overflow-hidden"
          >
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 border-b border-orange-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center shadow-sm">
                  <Briefcase size="14" className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Group Information</h2>
                  <p className="text-[10px] text-gray-500">Basic details about your team</p>
                </div>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              <Field 
                label="Group Name" 
                required 
                error={errors.name} 
                icon={Hash}
                hint="Choose a unique name that represents your team"
              >
                <div className="relative">
                  <Hash size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g., Elite Painters & Decorators"
                    maxLength={60}
                    autoCapitalize="words"
                    className={`w-full pl-9 pr-3 py-3 border rounded-xl text-sm font-medium transition-all ${
                      errors.name 
                        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100' 
                        : focusedField === 'name'
                          ? 'border-orange-400 bg-white ring-2 ring-orange-100'
                          : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                    }`}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] text-gray-400">
                    {form.name?.length || 0}/60 characters
                  </p>
                  {form.name && form.name.length >= 50 && (
                    <p className="text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertCircle size="8" /> Getting long
                    </p>
                  )}
                </div>
              </Field>

              <Field 
                label="Description" 
                hint="Describe what your group specialises in" 
                optional
                error={errors.description}
                icon={FileText}
              >
                <div className="relative">
                  <FileText size="14" className="absolute left-3 top-3 text-orange-400" />
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    maxLength={200}
                    placeholder="e.g., We specialise in interior painting, waterproofing, wall finishes, and home renovation..."
                    className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm font-medium bg-gray-50 focus:bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-[10px] font-medium ${charLeft < 30 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {charLeft} characters remaining
                  </p>
                  {form.description && charLeft < 50 && (
                    <p className="text-[10px] text-amber-600">Keep it concise</p>
                  )}
                </div>
              </Field>
            </div>
          </motion.div>

          {/* Card 2: Add Member */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-lg transition-all overflow-hidden"
          >
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-4 border-b border-orange-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center shadow-sm">
                  <UserPlus size="14" className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">Add Initial Member</h2>
                  <p className="text-[10px] text-gray-500">Groups need at least 2 members to start</p>
                </div>
              </div>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Info Banner */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
                <Shield size="14" className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-blue-700 font-medium">Enter the <strong>User ID</strong> of the second member</p>
                  <code className="inline-block mt-1.5 bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
                    K531792
                  </code>
                </div>
              </div>

              <Field 
                label="Second Member's User ID" 
                required 
                error={errors.memberUserId}
                icon={User}
                hint="Format: K followed by 6+ digits (e.g., K123456)"
              >
                <div className="relative">
                  <User size="14" className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400" />
                  <input
                    name="memberUserId"
                    value={form.memberUserId}
                    onChange={handleChange}
                    onFocus={() => setFocusedField('userId')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="K123456"
                    autoCapitalize="characters"
                    className={`w-full pl-9 pr-3 py-3 border rounded-xl text-sm font-mono font-semibold tracking-wider uppercase transition-all ${
                      errors.memberUserId 
                        ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                        : focusedField === 'userId'
                          ? 'border-orange-400 bg-white ring-2 ring-orange-100'
                          : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                    }`}
                  />
                </div>
              </Field>

              {/* Valid Format Indicator */}
              <AnimatePresence>
                {form.memberUserId && !errors.memberUserId && isUserIdValid && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
                      <CheckCircle size="12" className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-800">{form.memberUserId.toUpperCase()}</p>
                      <p className="text-[10px] text-emerald-600">Valid user ID format ✓</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Invalid Format Warning */}
              <AnimatePresence>
                {form.memberUserId && !errors.memberUserId && !isUserIdValid && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3"
                  >
                    <AlertCircle size="14" className="text-amber-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-amber-800">Invalid Format</p>
                      <p className="text-[10px] text-amber-600">User ID should start with 'K' followed by digits</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Preview Section */}
          <AnimatePresence>
            {(form.name.trim() || form.memberUserId.trim()) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100 p-5 shadow-md"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size="12" className="text-orange-500" />
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Group Preview</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-400 flex items-center justify-center shadow-md">
                    <Users size="18" className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm truncate">
                      {form.name.trim() || <span className="text-gray-300">Group name...</span>}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] font-bold bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded-full shadow-sm flex items-center gap-0.5">
                        <Crown size="8" /> You (Admin)
                      </span>
                      {form.memberUserId.trim() && isUserIdValid && (
                        <span className="text-[9px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                          {form.memberUserId.toUpperCase()}
                        </span>
                      )}
                      {form.memberUserId.trim() && !isUserIdValid && (
                        <span className="text-[9px] font-bold bg-red-400 text-white px-2 py-0.5 rounded-full shadow-sm">
                          Invalid ID
                        </span>
                      )}
                    </div>
                    {form.description && (
                      <p className="text-[10px] text-gray-500 mt-2 line-clamp-2">
                        {form.description}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading || success}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-60 transition-all"
          >
            {loading ? (
              <>
                <Loader2 size="18" className="animate-spin" />
                Creating Group...
              </>
            ) : (
              <>
                <Users2 size="18" />
                Create Work Group
              </>
            )}
          </motion.button>

          {/* Cancel Link */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/worker/my-groups')}
              className="text-xs text-gray-400 font-medium hover:text-orange-500 transition-colors"
            >
              Cancel — return to My Groups
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}