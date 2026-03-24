// client/src/pages/client/ClientAIAssist.jsx
// AI Advisor v2 — Mobile Optimized
// Features: Two-tab layout, Budget input, Questions, Opinions, Report with collapsible sections, History

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    aiGenerateQuestions, getAIAdvisorReport,
    saveAIAnalysis, getClientAIHistory, getAIHistoryItem,
    updateAIHistoryItem, deleteAIHistoryItem, clearClientAIHistory,
    getImageUrl,
} from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtINR = n => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
const sanitizeNonNegativeInput = (value) => {
    if (value === '') return '';
    const normalized = String(value).replace(/[^\d.]/g, '');
    if (!normalized) return '';
    const [whole, ...rest] = normalized.split('.');
    return rest.length ? `${whole}.${rest.join('')}` : whole;
};
const preventNegativeKey = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
};

const SKILL_ICONS = { painter:'🎨', plumber:'🔧', electrician:'⚡', carpenter:'🪚', mason:'🧱', tiler:'🏠', welder:'⚒️', cleaner:'🧹', handyman:'🔨', gardener:'🌿', ac_technician:'❄️', pest_control:'🐛' };
const si = s => SKILL_ICONS[s?.toLowerCase()] || '👷';

const buildHistoryReport = (item) => {
    if (item?.report) {
        return {
            ...item.report,
            _notes: item.notes || '',
        };
    }

    return {
        jobTitle: item?.title || item?.workDescription?.slice(0, 60) || 'Saved Analysis',
        problemSummary: item?.workDescription || '',
        durationDays: item?.durationDays || 1,
        budgetBreakdown: item?.budgetBreakdown || null,
        recommendation: item?.recommendation || '',
        clientBudget: item?.clientBudget || 0,
        grandTotal: item?.budgetBreakdown?.totalEstimated || 0,
        topWorkers: [],
        skillBlocks: [],
        materialsBreakdown: [],
        equipmentBreakdown: [],
        materialsTotal: 0,
        equipmentTotal: 0,
        workPlan: [],
        timeEstimate: {},
        expectedOutcome: item?.recommendation ? [item.recommendation] : [],
        colourAndStyleAdvice: '',
        designSuggestions: [],
        improvementIdeas: [],
        imageFindings: [],
        warnings: ['This is an older saved analysis. Full advisor detail was not stored at the time it was created.'],
        visualizationDescription: '',
        budgetAdvice: '',
        _notes: item?.notes || '',
    };
};

// ── Phase Indicator (Mobile Optimized) ────────────────────────────────────────────
const PHASES = ['describe','questions','budget','opinions','image','loading','report'];
const PHASE_LABELS = { describe:'Describe', questions:'Questions', budget:'Budget', opinions:'Prefs', image:'Photo', loading:'...', report:'Report' };

function PhaseBar({ phase }) {
    const active = PHASES.indexOf(phase);
    const visible = ['describe','questions','budget','opinions','image'];
    return (
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
            {visible.map((p,i) => (
                <div key={p} className="flex items-center gap-1 flex-shrink-0">
                    <div className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold border ${
                        active > i ? 'border-green-400 bg-green-50 text-green-700' :
                        active === i ? 'border-orange-400 bg-orange-50 text-orange-700' :
                        'border-gray-200 bg-white text-gray-400'
                    }`}>
                        {active > i ? '✓' : i+1} {PHASE_LABELS[p]}
                    </div>
                    {i < visible.length-1 && <div className={`w-2 h-0.5 rounded ${active > i ? 'bg-green-400' : 'bg-gray-200'}`}/>}
                </div>
            ))}
        </div>
    );
}

// ── Question Widget (Mobile Optimized) ────────────────────────────────────────────
function QWidget({ q, value, onChange }) {
    if (q.type === 'select') return (
        <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{q.question}</label>
            <div className="flex flex-wrap gap-1.5">
                {(q.options||[]).map(opt => (
                    <button key={opt} type="button" onClick={() => onChange(q.id, opt)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${value===opt?'bg-orange-500 text-white border-orange-500':'bg-white text-gray-700 border-gray-200'}`}>
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
    if (q.type === 'color') return (
        <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{q.question}</label>
            <input value={value||''} onChange={e=>onChange(q.id,e.target.value)}
                placeholder="E.g., Light beige, off-white…"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"/>
            <div className="flex flex-wrap gap-1 mt-1.5">
                {['White','Beige','Light grey','Sky blue','Mint','Terracotta'].slice(0,4).map(c=>(
                    <button key={c} type="button" onClick={()=>onChange(q.id,c)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border ${value===c?'border-orange-400 bg-orange-50 text-orange-700':'border-gray-200 text-gray-500'}`}>{c}</button>
                ))}
            </div>
        </div>
    );
    return (
        <div className="mb-3">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">{q.question}</label>
            <input type={q.type==='number'?'number':'text'} min={0} value={value||''}
                onKeyDown={q.type === 'number' ? preventNegativeKey : undefined}
                onChange={e=>onChange(q.id, q.type === 'number' ? sanitizeNonNegativeInput(e.target.value) : e.target.value)}
                placeholder="Your answer…"
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400"/>
        </div>
    );
}

// ── Accordion Section (Mobile Optimized) ─────────────────────────────────────────
function Accordion({ icon, title, badge, defaultOpen=false, accent='orange', children }) {
    const [open, setOpen] = useState(defaultOpen);
    const accents = {
        orange:'border-orange-200', blue:'border-blue-200', green:'border-green-200',
        purple:'border-purple-200', amber:'border-amber-200', teal:'border-teal-200', red:'border-red-200',
    };
    const bg = {
        orange:'bg-orange-50', blue:'bg-blue-50', green:'bg-green-50',
        purple:'bg-purple-50', amber:'bg-amber-50', teal:'bg-teal-50', red:'bg-red-50',
    };
    return (
        <div className={`bg-white rounded-xl border overflow-hidden ${accents[accent]||'border-gray-200'}`}>
            <button onClick={() => setOpen(o=>!o)} className={`w-full flex items-center gap-2 px-3 py-2.5 text-left ${bg[accent]||'bg-gray-50'}`}>
                <span className="text-base flex-shrink-0">{icon}</span>
                <span className="font-bold text-gray-800 flex-1 text-xs">{title}</span>
                {badge && <span className="text-[9px] bg-white/80 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{badge}</span>}
                <span className={`text-gray-400 text-[10px] transition-transform ${open?'rotate-180':''}`}>▼</span>
            </button>
            {open && <div className="px-3 py-2.5">{children}</div>}
        </div>
    );
}

// ── Report View (Mobile Optimized) ───────────────────────────────────────────────
function AdvisorReport({ report, onReset, onSaveNote, onPatchReport }) {
    const {
        jobTitle, problemSummary, skillBlocks=[],
        budgetBreakdown, materialsBreakdown=[], equipmentBreakdown=[],
        materialsTotal=0, equipmentTotal=0, grandTotal=0,
        clientBudget=0, isOverBudget, budgetGap=0, budgetAdvice='',
        workPlan=[], timeEstimate={}, expectedOutcome=[],
        colourAndStyleAdvice='', designSuggestions=[], improvementIdeas=[],
        imageFindings=[], imageUploaded, warnings=[],
        visualizationDescription='', topWorkers=[],
        confidence=null,
    } = report;

    const [notes, setNotes] = useState(report._notes || '');
    const [editingNotes, setEditingNotes] = useState(false);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    return (
        <div className="space-y-2 pb-8 print:space-y-4" id="advisor-report">
            {/* Report Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-3 text-white">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                        <p className="text-[8px] font-bold opacity-70 uppercase mb-0.5">AI Advisory Report</p>
                        <h2 className="text-sm font-black leading-tight">{jobTitle}</h2>
                        {problemSummary && <p className="text-[10px] opacity-90 mt-1 leading-relaxed line-clamp-2">{problemSummary}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                        <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">
                            ~{report.durationDays || 1}d
                        </span>
                        {confidence?.score && (
                            <span className="text-[8px] bg-black/20 px-1.5 py-0.5 rounded-full">{confidence.score}%</span>
                        )}
                    </div>
                </div>
                {skillBlocks.length>0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {skillBlocks.slice(0,4).map((b,i)=>(
                            <span key={i} className="flex items-center gap-0.5 bg-white/20 text-white px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                                {si(b.skill)} {b.skill} ×{b.count}
                            </span>
                        ))}
                    </div>
                )}
                <p className="text-[7px] opacity-60 mt-1.5">⚠️ AI estimate only — not final quote</p>
            </div>

            {/* Budget Alert */}
            {isOverBudget && clientBudget > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                    <p className="font-bold text-amber-800 text-[10px] mb-0.5">⚠️ Over budget</p>
                    <p className="text-[9px] text-amber-700">Budget: {fmtINR(clientBudget)} · Est: {fmtINR(grandTotal)}</p>
                    {budgetAdvice && <p className="text-[8px] text-amber-600 mt-1">{budgetAdvice}</p>}
                </div>
            )}

            {/* Cost Estimate */}
            <Accordion icon="💰" title="Cost Estimate" badge={fmtINR(grandTotal)} defaultOpen accent="green">
                <div className="space-y-2">
                    {budgetBreakdown?.breakdown?.slice(0,3).map((b,i)=>(
                        <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-gray-100">
                            <div className="flex items-center gap-1">
                                <span>{si(b.skill)}</span>
                                <span className="font-semibold capitalize">{b.skill} ×{b.count}</span>
                            </div>
                            <span className="font-bold">{fmtINR(b.subtotal)}</span>
                        </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-gray-200">
                        <span className="text-[10px] font-bold">Total</span>
                        <span className="text-xs font-bold text-orange-600">{fmtINR(grandTotal)}</span>
                    </div>
                </div>
            </Accordion>

            {/* Work Plan */}
            {workPlan.length>0 && (
                <Accordion icon="🛠️" title="Work Plan" badge={`${workPlan.length} steps`} accent="blue">
                    <div className="space-y-2">
                        {workPlan.slice(0,3).map((step,i)=>(
                            <div key={i} className="flex gap-2">
                                <div className="w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center flex-shrink-0">{step.step||i+1}</div>
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-gray-800">{step.title}</p>
                                    {step.description && <p className="text-[8px] text-gray-500">{step.description}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Accordion>
            )}

            {/* Expected Outcome */}
            {expectedOutcome.length>0 && (
                <Accordion icon="🎯" title="Expected Outcome" accent="green">
                    <div className="space-y-1">{expectedOutcome.slice(0,2).map((o,i)=><p key={i} className="text-[9px] text-gray-700">✓ {o}</p>)}</div>
                </Accordion>
            )}

            {/* Design Suggestions */}
            {designSuggestions.length>0 && (
                <Accordion icon="✨" title="Design Ideas" accent="purple">
                    <div className="space-y-1">{designSuggestions.slice(0,2).map((s,i)=><p key={i} className="text-[9px] text-gray-700">• {s}</p>)}</div>
                </Accordion>
            )}

            {/* Nearby Workers */}
            {topWorkers.length>0 && (
                <Accordion icon="👷" title="Nearby Workers" badge={`${topWorkers.length}`} accent="blue">
                    <div className="space-y-1.5">
                        {topWorkers.slice(0,3).map((w,i)=>(
                            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                                <img src={getImageUrl(w.photo)} alt={w.name} className="w-7 h-7 rounded-full object-cover border border-white flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-gray-800 truncate">{w.name}</p>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        {w.skills.slice(0,2).map((sk,si2)=><span key={si2} className="text-[7px] bg-orange-100 text-orange-700 px-1 py-0.5 rounded-full">{sk}</span>)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Accordion>
            )}

            {/* Notes */}
            <div className="bg-white rounded-xl border border-gray-200 p-2.5">
                <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold text-gray-700">📝 My Notes</p>
                    <button onClick={() => setEditingNotes(e=>!e)} className="text-[9px] text-orange-500 font-semibold">{editingNotes?'Done':'Edit'}</button>
                </div>
                {editingNotes
                    ? <textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} onBlur={()=>onSaveNote(notes)} placeholder="Add notes…" className="w-full border border-gray-200 rounded-lg p-2 text-[10px] focus:outline-none focus:border-orange-400 resize-none"/>
                    : <p className="text-[9px] text-gray-500 min-h-[30px]">{notes||'No notes yet.'}</p>
                }
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 print:hidden">
                <button onClick={onReset} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold text-[10px]">← New Analysis</button>
                <button onClick={handlePrint} className="px-3 py-2 bg-orange-500 text-white rounded-lg font-bold text-[10px] flex items-center gap-1">🖨️ PDF</button>
            </div>

            <style>{`@media print { .print\\:hidden { display: none; } body { font-size: 10px; } }`}</style>
        </div>
    );
}

// ── History Panel (Mobile Optimized) ──────────────────────────────────────────────
function HistoryPanel({ onLoad, activeId }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const [editTitle, setEditTitle] = useState('');
    const [confirmClear, setConfirmClear] = useState(false);

    const fetchList = async () => {
        try {
            const { data } = await getClientAIHistory();
            setItems(Array.isArray(data)?data:[]);
        } catch {} finally { setLoading(false); }
    };
    useEffect(() => { fetchList(); }, []);

    const handleLoad = async (id) => {
        try {
            const { data } = await getAIHistoryItem(id);
            onLoad(data);
        } catch { toast.error('Failed to load.'); }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Delete this analysis?')) return;
        try {
            await deleteAIHistoryItem(id);
            setItems(p=>p.filter(i=>i._id!==id));
            toast.success('Deleted.');
        } catch { toast.error('Failed.'); }
    };

    const handleEditSave = async (id) => {
        try {
            await updateAIHistoryItem(id, { title: editTitle });
            setItems(p=>p.map(i=>i._id===id?{...i,title:editTitle}:i));
            setEditId(null);
        } catch { toast.error('Failed.'); }
    };

    const handleClearAll = async () => {
        try {
            await clearClientAIHistory();
            setItems([]);
            setConfirmClear(false);
            toast.success('All cleared.');
        } catch { toast.error('Failed.'); }
    };

    if (loading) return <div className="flex justify-center py-6"><div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/></div>;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-700">History <span className="text-gray-400">({items.length})</span></p>
                {items.length>0 && (
                    confirmClear
                        ? <div className="flex gap-1"><button onClick={handleClearAll} className="text-[9px] text-red-500 font-bold px-1.5 py-0.5">Confirm</button><button onClick={()=>setConfirmClear(false)} className="text-[9px] text-gray-400">No</button></div>
                        : <button onClick={()=>setConfirmClear(true)} className="text-[9px] text-red-400">Clear all</button>
                )}
            </div>

            {items.length===0 ? (
                <div className="text-center py-6 text-gray-400">
                    <div className="text-2xl mb-1">📭</div>
                    <p className="text-[10px] font-semibold">No history yet</p>
                </div>
            ) : (
                items.map(item => (
                    <div key={item._id}
                        onClick={() => handleLoad(item._id)}
                        className={`bg-white border rounded-lg p-2 cursor-pointer transition-all ${activeId===item._id?'border-orange-400 bg-orange-50':'border-gray-100'}`}>
                        <div className="flex items-start gap-1.5">
                            <div className="flex-1 min-w-0">
                                {editId===item._id ? (
                                    <input value={editTitle} onChange={e=>setEditTitle(e.target.value)}
                                        onKeyDown={e=>{if(e.key==='Enter')handleEditSave(item._id);if(e.key==='Escape')setEditId(null);}}
                                        onClick={e=>e.stopPropagation()}
                                        autoFocus
                                        className="w-full border border-orange-300 rounded px-1.5 py-0.5 text-[10px] font-semibold mb-0.5"/>
                                ) : (
                                    <p className="text-[10px] font-bold text-gray-800 line-clamp-1">
                                        {item.title || item.report?.jobTitle || item.workDescription?.slice(0,40) || 'Analysis'}
                                    </p>
                                )}
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    {item.clientBudget>0 && <span className="text-[8px] text-green-600">💰 {fmtINR(item.clientBudget)}</span>}
                                    {item.report?.grandTotal>0 && <span className="text-[8px] text-orange-600">🧾 {fmtINR(item.report.grandTotal)}</span>}
                                    <span className="text-[8px] text-gray-400">{fmtDate(item.createdAt)}</span>
                                </div>
                            </div>
                            <div className="flex gap-0.5 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                                <button onClick={e=>{setEditId(item._id);setEditTitle(item.title||'');}}
                                    className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-[9px]">✏️</button>
                                <button onClick={e=>handleDelete(item._id,e)}
                                    className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-[9px]">🗑</button>
                            </div>
                        </div>
                        {editId===item._id && (
                            <div className="flex gap-1 mt-1" onClick={e=>e.stopPropagation()}>
                                <button onClick={()=>handleEditSave(item._id)} className="text-[8px] px-2 py-0.5 bg-orange-500 text-white rounded">Save</button>
                                <button onClick={()=>setEditId(null)} className="text-[8px] px-2 py-0.5 border border-gray-200 text-gray-500 rounded">Cancel</button>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN (Mobile Optimized)
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientAIAssist() {
    const [activeTab,   setActiveTab]  = useState('advisor');
    const [phase,       setPhase]      = useState('describe');
    const [description, setDescription]= useState('');
    const [city,        setCity]       = useState('');
    const [urgent,      setUrgent]     = useState(false);
    const [clientBudget,setClientBudget]=useState('');
    const [questions,   setQuestions]  = useState([]);
    const [opinionQs,   setOpinionQs]  = useState([]);
    const [answers,     setAnswers]    = useState({});
    const [opinions,    setOpinions]   = useState({});
    const [imageFile,   setImageFile]  = useState(null);
    const [imagePreview,setImagePreview]=useState(null);
    const [report,      setReport]     = useState(null);
    const [savedId,     setSavedId]    = useState(null);
    const [loadingQ,    setLoadingQ]   = useState(false);
    const [loadingR,    setLoadingR]   = useState(false);
    const imageRef = useRef();

    const setAnswer  = (id, val) => setAnswers(p=>({...p,[id]:val}));
    const setOpinion = (id, val) => setOpinions(p=>({...p,[id]:val}));

    const handleImageChange = e => {
        const f = e.target.files?.[0]; if (!f) return;
        setImageFile(f); setImagePreview(URL.createObjectURL(f));
    };

    const handleDescribe = async () => {
        if (!description.trim()) { toast.error('Please describe the work.'); return; }
        try {
            setLoadingQ(true);
            const { data } = await aiGenerateQuestions({ workDescription: description, city });
            setQuestions(data.questions||[]);
            setOpinionQs(data.opinionQuestions||[]);
            setPhase('questions');
        } catch {
            toast.error('Could not load questions.');
            setPhase('budget');
        } finally { setLoadingQ(false); }
    };

    const handleQuestionsDone = () => setPhase('budget');
    const handleBudgetDone = () => setPhase(opinionQs.length>0 ? 'opinions' : 'image');
    const handleOpinionsDone = () => setPhase('image');

    const handleGenerate = async () => {
        try {
            setLoadingR(true); setPhase('loading');

            const answersMap = {};
            questions.forEach(q=>{ if(answers[q.id]) answersMap[q.question]=answers[q.id]; });
            const opinionsMap = {};
            opinionQs.forEach(q=>{ if(opinions[q.id]) opinionsMap[q.question]=opinions[q.id]; });

            const fd = new FormData();
            fd.append('workDescription', description);
            fd.append('answers',  JSON.stringify(answersMap));
            fd.append('opinions', JSON.stringify(opinionsMap));
            fd.append('city',    city);
            fd.append('urgent',  String(urgent));
            if (clientBudget && Number(clientBudget)>0) fd.append('clientBudget', clientBudget);
            if (imageFile) fd.append('workImage', imageFile);

            const { data } = await getAIAdvisorReport(fd);

            try {
                const { data: saved } = await saveAIAnalysis({
                    workDescription: description, city, urgent,
                    clientBudget: clientBudget ? Number(clientBudget) : undefined,
                    answers: answersMap, opinions: opinionsMap, report: data,
                });
                setSavedId(saved._id);
            } catch (e) { console.warn('Auto-save failed'); }

            setReport(data); setPhase('report');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Analysis failed.');
            setPhase('image');
        } finally { setLoadingR(false); }
    };

    const handleSaveNote = async (notes) => {
        if (!savedId) return;
        try { await updateAIHistoryItem(savedId, { notes }); }
        catch { /* silent */ }
    };

    const handleReset = () => {
        setPhase('describe'); setDescription(''); setCity(''); setUrgent(false); setClientBudget('');
        setQuestions([]); setOpinionQs([]); setAnswers({}); setOpinions({});
        setImageFile(null); setImagePreview(null); setReport(null); setSavedId(null);
    };

    const handleLoadHistory = (item) => {
        const loadedReport = buildHistoryReport(item);
        setReport(loadedReport);
        setSavedId(item._id);
        setDescription(item.workDescription || '');
        setCity(item.city || '');
        setUrgent(!!item.urgent);
        setClientBudget(item.clientBudget ? String(item.clientBudget) : '');
        setPhase('report');
        setActiveTab('advisor');
    };

    return (
        <div className="max-w-3xl mx-auto px-3 pt-3 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-3 mb-3 text-white">
                <div className="flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    <div>
                        <h1 className="text-sm font-bold">AI Advisor</h1>
                        <p className="text-[8px] opacity-80">Cost, time, materials, design, workers</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
                {['advisor','history'].map(t=>(
                    <button key={t} onClick={()=>setActiveTab(t)}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${activeTab===t?'bg-orange-500 text-white shadow-sm':'bg-white border border-gray-200 text-gray-600'}`}>
                        {t==='advisor'?'🤖 Advisor':'📂 History'}
                    </button>
                ))}
            </div>

            {/* Advisor Content */}
            {activeTab === 'advisor' && (
                <div className="space-y-3">
                    {phase !== 'report' && phase !== 'loading' && <PhaseBar phase={phase}/>}

                    {/* DESCRIBE */}
                    {phase==='describe' && (
                        <div className="space-y-3">
                            <div className="bg-orange-50 border border-orange-100 rounded-lg p-2.5 text-[10px] text-orange-700 flex gap-2">
                                <span className="text-sm">💡</span>
                                <p className="flex-1">Describe your home repair or renovation need in detail.</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-700 mb-1">Describe the Work <span className="text-red-500">*</span></label>
                                <textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)}
                                    placeholder="Example: I want to repaint my living room walls. The paint is old and there are small cracks near the window..."
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 text-xs focus:outline-none focus:border-orange-400 resize-none"/>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-700 mb-1">City</label>
                                    <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Pune, Mumbai…" className="w-full border-2 border-gray-200 rounded-lg px-2 py-1.5 text-xs"/>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-700 mb-1">Priority</label>
                                    <button onClick={()=>setUrgent(u=>!u)} className={`w-full py-1.5 rounded-lg text-[10px] font-bold border ${urgent?'border-orange-400 bg-orange-50 text-orange-700':'border-gray-200 bg-white text-gray-500'}`}>
                                        {urgent?'⚡ Urgent':'🕐 Normal'}
                                    </button>
                                </div>
                            </div>
                            <button onClick={handleDescribe} disabled={loadingQ||!description.trim()}
                                className="w-full py-2.5 bg-orange-500 text-white font-bold rounded-lg text-xs disabled:opacity-60 flex items-center justify-center gap-1">
                                {loadingQ ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> Loading...</> : '🤖 Get Expert Advice →'}
                            </button>
                        </div>
                    )}

                    {/* QUESTIONS */}
                    {phase==='questions' && (
                        <div className="space-y-3">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                                <p className="text-xs font-bold text-blue-800">🤔 Clarifying Questions</p>
                                <p className="text-[9px] text-blue-500">Answers make the analysis more accurate</p>
                            </div>
                            {questions.length===0 ? <p className="text-xs text-gray-400 text-center py-3">No clarifications needed.</p>
                                : <div className="space-y-2">{questions.map(q=><QWidget key={q.id} q={q} value={answers[q.id]} onChange={setAnswer}/>)}</div>}
                            <div className="flex gap-2">
                                <button onClick={()=>setPhase('describe')} className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold">← Back</button>
                                <button onClick={handleQuestionsDone} className="flex-1 py-2 bg-orange-500 text-white font-bold rounded-lg text-xs">Next →</button>
                            </div>
                        </div>
                    )}

                    {/* BUDGET */}
                    {phase==='budget' && (
                        <div className="space-y-3">
                            <div className="bg-green-50 border border-green-100 rounded-lg p-2.5">
                                <p className="text-xs font-bold text-green-800">💰 Your Budget</p>
                                <p className="text-[9px] text-green-600">AI will give honest advice based on your budget</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-700 mb-1">Budget (₹) <span className="text-gray-400">(optional)</span></label>
                                <input type="number" min={0} value={clientBudget}
                                    onKeyDown={preventNegativeKey}
                                    onChange={e=>setClientBudget(sanitizeNonNegativeInput(e.target.value))}
                                    placeholder="e.g., 10000"
                                    className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"/>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={()=>setPhase('questions')} className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs">← Back</button>
                                <button onClick={handleBudgetDone} className="flex-1 py-2 bg-orange-500 text-white font-bold rounded-lg text-xs">Next →</button>
                            </div>
                        </div>
                    )}

                    {/* OPINIONS */}
                    {phase==='opinions' && (
                        <div className="space-y-3">
                            <div className="bg-purple-50 border border-purple-100 rounded-lg p-2.5">
                                <p className="text-xs font-bold text-purple-800">🎨 Your Preferences</p>
                                <p className="text-[9px] text-purple-500">Help AI make better design suggestions</p>
                            </div>
                            <div className="space-y-2">
                                {opinionQs.map(q=><QWidget key={q.id} q={q} value={opinions[q.id]} onChange={setOpinion}/>)}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={()=>setPhase('budget')} className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs">← Back</button>
                                <button onClick={handleOpinionsDone} className="flex-1 py-2 bg-orange-500 text-white font-bold rounded-lg text-xs">Next →</button>
                            </div>
                        </div>
                    )}

                    {/* IMAGE */}
                    {phase==='image' && (
                        <div className="space-y-3">
                            <div className="bg-purple-50 border border-purple-100 rounded-lg p-2.5">
                                <p className="text-xs font-bold text-purple-800">📷 Upload Photo</p>
                                <p className="text-[9px] text-purple-500">Optional — helps detect visible issues</p>
                            </div>
                            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange}/>
                            {imagePreview ? (
                                <div className="relative">
                                    <img src={imagePreview} alt="Work area" className="w-full rounded-lg object-cover max-h-48 border border-orange-200"/>
                                    <button onClick={()=>{setImageFile(null);setImagePreview(null);}} className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-sm">×</button>
                                </div>
                            ) : (
                                <div onClick={()=>imageRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer">
                                    <div className="text-2xl mb-1">🖼️</div>
                                    <p className="text-[10px] font-bold text-gray-500">Tap to upload photo</p>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <button onClick={()=>setPhase(opinionQs.length>0?'opinions':'budget')} className="px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs">← Back</button>
                                <button onClick={handleGenerate} className="flex-1 py-2 bg-orange-500 text-white font-bold rounded-lg text-xs">
                                    {imageFile?'🔍 Analyze →':'🔍 Generate →'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* LOADING */}
                    {phase==='loading' && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-3">
                            <div className="relative w-12 h-12">
                                <div className="w-12 h-12 border-3 border-orange-100 rounded-full"/>
                                <div className="absolute inset-0 w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"/>
                                <div className="absolute inset-0 flex items-center justify-center text-sm">🤖</div>
                            </div>
                            <p className="text-xs font-bold text-gray-900">Analyzing your request...</p>
                        </div>
                    )}

                    {/* REPORT */}
                    {phase==='report' && report && (
                        <AdvisorReport report={report} onReset={handleReset} onSaveNote={handleSaveNote} onPatchReport={()=>{}}/>
                    )}
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <HistoryPanel onLoad={handleLoadHistory} activeId={savedId}/>
            )}

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}