// src/pages/worker/CreateGroup.jsx
// FIXES retained:
//   1. Import from "../../api" (not deleted groupService)
//   2. navigate('/worker/my-groups') — correct path
//   3. File location: pages/worker/CreateGroup.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, ArrowLeft, AlertCircle,
  CheckCircle, Sparkles, Hash, FileText, User,
} from 'lucide-react';
import { createGroupAPI } from '../../api';

/* ════════════════════════════════════════════
   TOAST (no external dep)
════════════════════════════════════════════ */
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
  <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
    {toasts.map(t => (
      <div key={t.id} style={{
        background: t.type === 'error' ? '#ef4444' : '#22c55e',
        color: '#fff', padding: '11px 18px', borderRadius: 12, fontWeight: 700,
        fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'inherit', animation: 'cg-in 0.3s ease',
      }}>
        {t.type === 'success' ? '✓' : '✕'} {t.msg}
      </div>
    ))}
  </div>
);

/* ════════════════════════════════════════════
   FIELD COMPONENT
════════════════════════════════════════════ */
const Field = ({ label, required, error, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
      {label}
      {required && <span style={{ color: '#ef4444', fontSize: 14 }}>*</span>}
    </label>
    {children}
    {hint && !error && (
      <p style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, margin: 0 }}>{hint}</p>
    )}
    {error && (
      <p style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertCircle size={11} />{error}
      </p>
    )}
  </div>
);

const inputBase = {
  width: '100%', border: '2px solid #fed7aa', borderRadius: 12,
  padding: '11px 14px', fontSize: 13, fontFamily: 'inherit',
  fontWeight: 500, background: '#fff7ed', outline: 'none',
  color: '#111827', transition: 'border-color 0.18s, box-shadow 0.18s',
  boxSizing: 'border-box',
};

const inputError = {
  borderColor: '#fca5a5',
  background: '#fff5f5',
};

/* ════════════════════════════════════════════
   MAIN
════════════════════════════════════════════ */
export default function CreateGroup() {
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ name: '', description: '', memberKarigarId: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const handleChange = e => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Group name is required';
    else if (form.name.trim().length < 3) e.name = 'Name must be at least 3 characters';
    if (!form.memberKarigarId.trim()) e.memberKarigarId = "Second member's Karigar ID is required";
    else if (!/^K\d+$/i.test(form.memberKarigarId.trim())) e.memberKarigarId = 'Format should be K followed by digits (e.g. K123456)';
    return e;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await createGroupAPI(form);
      setSuccess(true);
      toast.success('Group created successfully! 🎉');
      setTimeout(() => navigate('/worker/my-groups'), 1800);
    } catch (err) {
      toast.error(err.response?.data?.msg || 'Error creating group. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const charLeft = 200 - (form.description?.length || 0);
  const nameLen  = form.name?.length || 0;

  return (
    <div style={{ background: '#fff7ed', minHeight: '100%', padding: '24px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes cg-in     { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes cg-fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes cg-spin   { to { transform: rotate(360deg); } }
        @keyframes cg-pop    { 0% { transform: scale(0.8); opacity: 0; } 70% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes cg-pulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
        .cg-input:focus { border-color: #f97316 !important; box-shadow: 0 0 0 3px rgba(249,115,22,0.12) !important; background: #fff !important; }
        .cg-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(249,115,22,0.35) !important; }
        .cg-back:hover { background: #fff7ed !important; color: #f97316 !important; border-color: #fb923c !important; }
      `}</style>

      <ToastList toasts={toast.toasts} />

      {/* ── Success overlay ── */}
      {success && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(255,247,237,0.92)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(4px)',
        }}>
          <div style={{ animation: 'cg-pop 0.5s ease', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#22c55e,#4ade80)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(34,197,94,0.35)' }}>
              <CheckCircle size={38} color="#fff" />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111827', marginBottom: 6 }}>Group Created!</h2>
            <p style={{ fontSize: 13, color: '#6b7280', animation: 'cg-pulse 1s infinite' }}>Redirecting to My Groups…</p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 560, margin: '0 auto', animation: 'cg-fadeUp 0.4s ease' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <button onClick={() => navigate('/worker/my-groups')}
            className="cg-back"
            style={{
              width: 40, height: 40, borderRadius: 11, border: '1.5px solid #fed7aa',
              background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#6b7280', transition: 'all 0.15s', flexShrink: 0,
            }}>
            <ArrowLeft size={17} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: '#111827', margin: 0 }}>Create Group</h1>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, fontWeight: 500 }}>Form a work team with other karigars</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ══ Card 1: Group Details ══ */}
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #fed7aa', overflow: 'hidden', boxShadow: '0 1px 10px rgba(251,146,60,0.07)' }}>
            {/* card header */}
            <div style={{ background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', padding: '14px 20px', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#f97316,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: 0 }}>Group Details</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, fontWeight: 500 }}>Name and describe your group</p>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Group Name */}
              <Field label="Group Name" required error={errors.name}>
                <div style={{ position: 'relative' }}>
                  <Hash size={15} color="#f97316" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    className="cg-input"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Elite Painters Team"
                    maxLength={60}
                    style={{ ...inputBase, ...(errors.name ? inputError : {}), paddingLeft: 38 }}
                  />
                </div>
                {nameLen > 0 && (
                  <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'right', margin: '-2px 0 0', fontWeight: 500 }}>
                    {nameLen}/60
                  </p>
                )}
              </Field>

              {/* Description */}
              <Field label="Description" hint="Optional – describe what your group specialises in" error={errors.description}>
                <div style={{ position: 'relative' }}>
                  <FileText size={15} color="#f97316" style={{ position: 'absolute', left: 13, top: 13, pointerEvents: 'none' }} />
                  <textarea
                    className="cg-input"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={3}
                    maxLength={200}
                    placeholder="e.g. We specialise in interior painting and waterproofing work across Pune…"
                    style={{ ...inputBase, paddingLeft: 38, resize: 'none', lineHeight: 1.65 }}
                  />
                </div>
                <p style={{ fontSize: 10, color: charLeft < 30 ? '#f97316' : '#9ca3af', textAlign: 'right', margin: '-2px 0 0', fontWeight: 500 }}>
                  {charLeft} characters remaining
                </p>
              </Field>
            </div>
          </div>

          {/* ══ Card 2: Add Member ══ */}
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #fed7aa', overflow: 'hidden', boxShadow: '0 1px 10px rgba(251,146,60,0.07)' }}>
            {/* card header */}
            <div style={{ background: 'linear-gradient(135deg,#fff7ed,#ffedd5)', padding: '14px 20px', borderBottom: '1px solid #fed7aa', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#f97316,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: '#111827', margin: 0 }}>Add Initial Member</p>
                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, fontWeight: 500 }}>Groups need at least 2 members</p>
              </div>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* info banner */}
              <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={15} color="#3b82f6" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 500, margin: 0, lineHeight: 1.55 }}>
                  Enter the <strong>Karigar ID</strong> of the second member (format: K followed by digits, e.g. <code style={{ background: '#dbeafe', padding: '1px 6px', borderRadius: 5, fontSize: 11 }}>K531792</code>). You can add more members after creation.
                </p>
              </div>

              {/* Karigar ID input */}
              <Field label="Second Member's Karigar ID" required error={errors.memberKarigarId}>
                <div style={{ position: 'relative' }}>
                  <User size={15} color="#f97316" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    className="cg-input"
                    name="memberKarigarId"
                    value={form.memberKarigarId}
                    onChange={handleChange}
                    placeholder="K123456"
                    style={{
                      ...inputBase,
                      ...(errors.memberKarigarId ? inputError : {}),
                      paddingLeft: 38,
                      fontFamily: 'monospace',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  />
                </div>
              </Field>

              {/* Member preview (when valid) */}
              {form.memberKarigarId && /^K\d+$/i.test(form.memberKarigarId.trim()) && (
                <div style={{
                  background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12,
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
                  animation: 'cg-fadeUp 0.25s ease',
                }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#22c55e,#4ade80)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={14} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#15803d', margin: 0 }}>{form.memberKarigarId.toUpperCase()}</p>
                    <p style={{ fontSize: 11, color: '#16a34a', margin: 0, fontWeight: 500 }}>Valid format ✓</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ══ Preview strip ══ */}
          {(form.name.trim() || form.memberKarigarId.trim()) && (
            <div style={{
              background: '#fff', borderRadius: 18, border: '1px solid #fed7aa',
              padding: '16px 20px', boxShadow: '0 1px 10px rgba(251,146,60,0.07)',
              animation: 'cg-fadeUp 0.3s ease',
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
                <Sparkles size={10} style={{ marginRight: 4 }} />
                Group Preview
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'linear-gradient(135deg,#f97316,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 12px rgba(249,115,22,0.3)' }}>
                  <Users size={20} color="#fff" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {form.name.trim() || <span style={{ color: '#d1d5db' }}>Group name…</span>}
                  </p>
                  {form.description.trim() && (
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {form.description.trim()}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid #fed7aa' }}>
                      You (Admin)
                    </span>
                    {form.memberKarigarId.trim() && (
                      <span style={{ background: '#f0fdf4', color: '#15803d', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, border: '1px solid #86efac' }}>
                        {form.memberKarigarId.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ Submit button ══ */}
          <button
            type="submit"
            disabled={loading || success}
            className="cg-btn"
            style={{
              width: '100%', border: 'none', borderRadius: 16,
              padding: '15px', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg,#f97316,#fbbf24)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              boxShadow: '0 4px 16px rgba(249,115,22,0.28)',
              transition: 'all 0.18s', fontFamily: 'inherit',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.35)', borderTop: '2.5px solid #fff', borderRadius: '50%', animation: 'cg-spin 0.7s linear infinite' }} />Creating Group…</>
              : <><Users size={17} />Create Group</>
            }
          </button>

          {/* cancel link */}
          <button type="button" onClick={() => navigate('/worker/my-groups')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: '4px 0', transition: 'color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#f97316'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
          >
            Cancel — go back to My Groups
          </button>

        </form>
      </div>
    </div>
  );
}