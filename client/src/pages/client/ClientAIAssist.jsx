// client/src/pages/client/ClientAIAssist.jsx
// AI Advisor v2 — complete rebuild
// Features:
//  - Two-tab layout: Advisor | History
//  - Budget input before generation
//  - Opinion/preference questions (colour, style, material)
//  - Accordion sections in report (each collapsible)
//  - Auto-save to history after generation
//  - History: list, load, edit title/notes, delete, clear all
//  - Download report as PDF
//  - Visualization preview card (text-based "after" description)
//  - Ask client about AI image generation (optional)
//  - Nearby workers filtered by city

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    aiGenerateQuestions, getAIAdvisorReport,
    saveAIAnalysis, getClientAIHistory, getAIHistoryItem,
    updateAIHistoryItem, deleteAIHistoryItem, clearClientAIHistory,
    getImageUrl,
} from '../../api/index';
import toast from 'react-hot-toast';

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

// ── Phase Indicator ────────────────────────────────────────────────────────────
const PHASES = ['describe','questions','budget','opinions','image','loading','report'];
const PHASE_LABELS = { describe:'Describe', questions:'Questions', budget:'Budget', opinions:'Preferences', image:'Photos', loading:'Analyzing', report:'Report' };

function PhaseBar({ phase }) {
    const active = PHASES.indexOf(phase);
    const visible = ['describe','questions','budget','opinions','image'];
    return (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {visible.map((p,i) => (
                <div key={p} className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                        active > i ? 'border-green-400 bg-green-50 text-green-700' :
                        active === i ? 'border-orange-400 bg-orange-50 text-orange-700' :
                        'border-gray-200 bg-white text-gray-400'
                    }`}>
                        {active > i ? '✓' : i+1} {PHASE_LABELS[p]}
                    </div>
                    {i < visible.length-1 && <div className={`w-4 h-0.5 rounded flex-shrink-0 ${active > i ? 'bg-green-400' : 'bg-gray-200'}`}/>}
                </div>
            ))}
        </div>
    );
}

// ── Question Widget ────────────────────────────────────────────────────────────
function QWidget({ q, value, onChange }) {
    if (q.type === 'select') return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{q.question}</label>
            <div className="flex flex-wrap gap-2">
                {(q.options||[]).map(opt => (
                    <button key={opt} type="button" onClick={() => onChange(q.id, opt)}
                        className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${value===opt?'bg-orange-500 text-white border-orange-500':'bg-white text-gray-700 border-gray-200 hover:border-orange-300'}`}>
                        {opt}
                    </button>
                ))}
            </div>
        </div>
    );
    if (q.type === 'color') return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{q.question}</label>
            <input value={value||''} onChange={e=>onChange(q.id,e.target.value)}
                placeholder="E.g., Light beige, off-white, sky blue…"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"/>
            <div className="flex flex-wrap gap-1.5 mt-2">
                {['White','Off-white','Beige','Light grey','Sky blue','Mint green','Pastel yellow','Terracotta'].map(c=>(
                    <button key={c} type="button" onClick={()=>onChange(q.id,c)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${value===c?'border-orange-400 bg-orange-50 text-orange-700':'border-gray-200 text-gray-500 hover:border-orange-200'}`}>{c}</button>
                ))}
            </div>
        </div>
    );
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">{q.question}</label>
            <input type={q.type==='number'?'number':'text'} min={0} value={value||''}
                onKeyDown={q.type === 'number' ? preventNegativeKey : undefined}
                onChange={e=>onChange(q.id, q.type === 'number' ? sanitizeNonNegativeInput(e.target.value) : e.target.value)}
                placeholder="Your answer…"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"/>
        </div>
    );
}

// ── Accordion Section ─────────────────────────────────────────────────────────
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
        <div className={`bg-white rounded-2xl border overflow-hidden ${accents[accent]||'border-gray-200'}`}>
            <button onClick={() => setOpen(o=>!o)} className={`w-full flex items-center gap-3 px-5 py-4 text-left ${bg[accent]||'bg-gray-50'} hover:opacity-90 transition-opacity`}>
                <span className="text-xl flex-shrink-0">{icon}</span>
                <span className="font-bold text-gray-900 flex-1 text-sm">{title}</span>
                {badge && <span className="text-xs bg-white/80 text-gray-600 px-2.5 py-1 rounded-full font-medium border">{badge}</span>}
                <span className={`text-gray-400 ml-1 transition-transform ${open?'rotate-180':''}`}>▼</span>
            </button>
            {open && <div className="px-5 py-4">{children}</div>}
        </div>
    );
}

// ── Report View ───────────────────────────────────────────────────────────────
function AdvisorReport({ report, onReset, onSaveNote, onPatchReport }) {
    const {
        jobTitle, problemSummary, skillBlocks=[], durationDays,
        budgetBreakdown, materialsBreakdown=[], equipmentBreakdown=[],
        materialsTotal=0, equipmentTotal=0, grandTotal=0,
        clientBudget=0, isOverBudget, budgetGap=0, budgetAdvice='',
        workPlan=[], timeEstimate={}, expectedOutcome=[],
        colourAndStyleAdvice='', designSuggestions=[], improvementIdeas=[],
        imageFindings=[], imageUploaded, warnings=[],
        visualizationDescription='', topWorkers=[],
        confidence=null, previewOptions=[], originalImageUrl='',
    } = report;

    const [notes, setNotes] = useState(report._notes || '');
    const [editingNotes, setEditingNotes] = useState(false);

    useEffect(() => {
        // Report loaded, no preview data needed
    }, [previewOptions]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    const generatePreviews = async () => {
        // Feature removed - no OpenAI API credits
    };

    return (
        <div className="space-y-3 pb-10 print:space-y-4" id="advisor-report">
            {/* Report Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <p className="text-[10px] font-bold opacity-70 uppercase tracking-wider mb-1">AI Advisory Report</p>
                        <h2 className="text-xl font-black leading-snug">{jobTitle}</h2>
                        {problemSummary && <p className="text-sm opacity-90 mt-2 leading-relaxed">{problemSummary}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold flex-shrink-0 mt-1">
                            ~{durationDays} day{durationDays>1?'s':''}
                        </span>
                        {confidence?.score && (
                            <span className="text-xs bg-black/20 px-2.5 py-1 rounded-full font-bold">Confidence: {confidence.score}%</span>
                        )}
                    </div>
                </div>
                {skillBlocks.length>0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                        {skillBlocks.map((b,i)=>(
                            <span key={i} className="flex items-center gap-1.5 bg-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">
                                {si(b.skill)} {b.skill} ×{b.count}
                            </span>
                        ))}
                    </div>
                )}
                <p className="text-[10px] opacity-60 mt-3">⚠️ AI estimate only — not a final quote. Costs may vary.</p>
            </div>

            {/* Confidence */}
            {confidence?.score && (
                <Accordion icon="🎯" title="AI Confidence Score" badge={`${confidence.score}%`} defaultOpen accent="teal">
                    <div className="space-y-2">
                        {Object.entries(confidence.factors || {}).map(([k, v]) => (
                            <div key={k}>
                                <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-semibold text-gray-700 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
                                    <span className="text-xs text-gray-500">{v}%</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-400 rounded-full" style={{ width: `${v}%` }} />
                                </div>
                            </div>
                        ))}
                        <div className="pt-2 border-t border-gray-100 space-y-1">
                            {(confidence.basedOn || []).map((b, i) => <p key={i} className="text-xs text-gray-500">• {b}</p>)}
                        </div>
                    </div>
                </Accordion>
            )}

            {/* Budget Alert */}
            {isOverBudget && clientBudget > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
                    <p className="font-bold text-amber-800 text-sm mb-1">⚠️ Estimate exceeds your budget</p>
                    <p className="text-sm text-amber-700">Your budget: <strong>{fmtINR(clientBudget)}</strong> · Estimate: <strong>{fmtINR(grandTotal)}</strong> · Gap: <strong>{fmtINR(budgetGap)}</strong></p>
                    {budgetAdvice && <p className="text-xs text-amber-600 mt-1.5">{budgetAdvice}</p>}
                </div>
            )}
            {!isOverBudget && clientBudget > 0 && budgetAdvice && (
                <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                    <p className="text-sm text-green-700">✅ {budgetAdvice}</p>
                </div>
            )}

            {/* Warnings */}
            {warnings.length>0 && (
                <Accordion icon="⚠️" title="Important Warnings" defaultOpen accent="red">
                    <div className="space-y-2">{warnings.map((w,i)=><p key={i} className="text-sm text-red-700">• {w}</p>)}</div>
                </Accordion>
            )}

            {/* Image findings */}
            {imageUploaded && imageFindings.length>0 && (
                <Accordion icon="📷" title="Photo Analysis" badge={`${imageFindings.length} findings`} defaultOpen accent="blue">
                    <div className="space-y-2">{imageFindings.map((f,i)=><p key={i} className="text-sm text-blue-800 flex gap-2"><span className="text-blue-400 flex-shrink-0">•</span>{f}</p>)}</div>
                </Accordion>
            )}

            {/* Cost */}
            <Accordion icon="💰" title="Cost Estimate" badge={`Total ${fmtINR(grandTotal)}`} defaultOpen accent="green">
                <div className="space-y-3">
                    {budgetBreakdown?.breakdown?.length>0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">👷 Labour</p>
                            {budgetBreakdown.breakdown.map((b,i)=>(
                                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl mb-1.5 border border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <span>{si(b.skill)}</span>
                                        <div><span className="text-sm font-semibold text-gray-800 capitalize">{b.skill} ×{b.count}</span><span className="text-xs text-gray-400 ml-2">{b.hours}h · {b.complexity}</span></div>
                                    </div>
                                    <span className="text-sm font-bold">{fmtINR(b.subtotal)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between px-3 py-2 bg-green-50 rounded-xl"><span className="text-sm text-gray-600 font-semibold">Labour subtotal</span><span className="text-sm font-bold text-green-700">{fmtINR(budgetBreakdown.totalEstimated)}</span></div>
                        </div>
                    )}
                    {materialsBreakdown.length>0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🪣 Materials</p>
                            {materialsBreakdown.map((m,i)=>(
                                <div key={i} className="flex items-start justify-between px-3 py-2 bg-gray-50 rounded-xl mb-1.5 border border-gray-100 gap-2">
                                    <div className="flex-1"><p className="text-sm font-semibold text-gray-800">{m.item}</p>{(m.quantity||m.note)&&<p className="text-xs text-gray-400">{[m.quantity,m.note].filter(Boolean).join(' · ')}</p>}</div>
                                    <span className="text-sm font-bold flex-shrink-0">{fmtINR(m.estimatedCost)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between px-3 py-2 bg-blue-50 rounded-xl"><span className="text-sm text-gray-600 font-semibold">Materials subtotal</span><span className="text-sm font-bold text-blue-700">{fmtINR(materialsTotal)}</span></div>
                        </div>
                    )}
                    {equipmentBreakdown.length>0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">🔧 Equipment & Tools</p>
                            {equipmentBreakdown.map((e,i)=>(
                                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-xl mb-1.5 border border-gray-100">
                                    <span className="text-sm text-gray-700 flex-1">{e.item}</span>
                                    <span className="text-sm font-bold flex-shrink-0">{fmtINR(e.estimatedCost)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center justify-between px-4 py-3 bg-orange-500 rounded-xl">
                        <span className="text-white font-black">Total Estimated Cost</span>
                        <span className="text-white font-black text-xl">{fmtINR(grandTotal)}</span>
                    </div>
                    {clientBudget>0 && <p className="text-xs text-center text-gray-400">Your budget: {fmtINR(clientBudget)}</p>}
                </div>
            </Accordion>

            {/* Work Plan */}
            {workPlan.length>0 && (
                <Accordion icon="🛠️" title="Work Plan" badge={`${workPlan.length} steps`} accent="blue">
                    <div className="space-y-3">
                        {workPlan.map((step,i)=>(
                            <div key={i} className="flex items-start gap-3">
                                <div className="w-7 h-7 rounded-full bg-orange-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">{step.step||i+1}</div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-bold text-gray-800">{step.title}</p>
                                        {step.estimatedTime && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">{step.estimatedTime}</span>}
                                    </div>
                                    {step.description && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.description}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </Accordion>
            )}

            {/* Time Estimate */}
            {timeEstimate?.phases?.length>0 && (
                <Accordion icon="⏱️" title="Time Estimate" badge={`~${timeEstimate.totalHours||'?'}h`} accent="teal">
                    <div className="space-y-2.5">
                        {timeEstimate.phases.map((p,i)=>{
                            const pct = timeEstimate.totalHours>0 ? Math.round((p.hours/timeEstimate.totalHours)*100) : 0;
                            return (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1"><p className="text-sm font-semibold text-gray-700">{p.phase}</p><span className="text-xs text-gray-500">{p.hours}h</span></div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-orange-400 rounded-full" style={{width:`${pct}%`}}/></div>
                                    {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                                </div>
                            );
                        })}
                        <div className="flex justify-between pt-2 border-t border-gray-100">
                            <span className="text-sm font-bold text-gray-700">Estimated completion</span>
                            <span className="text-sm font-bold text-orange-600">{durationDays} day{durationDays>1?'s':''} (~{timeEstimate.totalHours}h)</span>
                        </div>
                    </div>
                </Accordion>
            )}

            {/* Expected Outcome */}
            {expectedOutcome.length>0 && (
                <Accordion icon="🎯" title="Expected Outcome" accent="green">
                    <div className="space-y-2">{expectedOutcome.map((o,i)=><div key={i} className="flex gap-2"><span className="text-green-500 font-bold flex-shrink-0">✓</span><p className="text-sm text-gray-700">{o}</p></div>)}</div>
                </Accordion>
            )}

            {/* Colour & Style */}
            {colourAndStyleAdvice && (
                <Accordion icon="🎨" title="Colour & Style Advice" defaultOpen accent="purple">
                    <p className="text-sm text-gray-700 leading-relaxed">{colourAndStyleAdvice}</p>
                </Accordion>
            )}

            {/* Design Suggestions */}
            {designSuggestions.length>0 && (
                <Accordion icon="✨" title="Design Suggestions" accent="purple">
                    <div className="space-y-2">{designSuggestions.map((s,i)=><div key={i} className="flex gap-2"><span className="text-purple-400 flex-shrink-0 font-bold">•</span><p className="text-sm text-gray-700">{s}</p></div>)}</div>
                </Accordion>
            )}

            {/* Improvement Ideas */}
            {improvementIdeas.length>0 && (
                <Accordion icon="📈" title="Optional Upgrades" badge="Ideas" accent="amber">
                    <div className="space-y-2">
                        {improvementIdeas.map((idea,i)=>(
                            <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                <div className="flex justify-between gap-2 mb-1">
                                    <p className="text-sm font-bold text-gray-800">{idea.idea}</p>
                                    {idea.estimatedExtraCost>0 && <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-bold flex-shrink-0">+{fmtINR(idea.estimatedExtraCost)}</span>}
                                </div>
                                {idea.benefit && <p className="text-xs text-gray-600">{idea.benefit}</p>}
                            </div>
                        ))}
                    </div>
                </Accordion>
            )}

            {/* Visualization */}
            {visualizationDescription && (
                <Accordion icon="🖼️" title="After Completion — Visual Preview" accent="purple">
                    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-100 rounded-xl p-4">
                        <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-2">✨ How it will look</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{visualizationDescription}</p>
                    </div>
                </Accordion>
            )}

            {/* Nearby Workers */}
            {topWorkers.length>0 && (
                <Accordion icon="👷" title={`Nearby Workers`} badge={`${topWorkers.length} found`} accent="blue">
                    <p className="text-xs text-gray-400 mb-3">Workers with matching skills. No commitment required — visit their profiles to learn more.</p>
                    <div className="space-y-2">
                        {topWorkers.map((w,i)=>(
                            <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <img src={getImageUrl(w.photo)} alt={w.name} className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0" onError={e=>{e.target.src='/admin.png'}}/>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 truncate">{w.name}</p>
                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                        {w.skills.slice(0,2).map((sk,si2)=><span key={si2} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold capitalize">{sk}</span>)}
                                        {w.city && <span className="text-[10px] text-gray-400">📍 {w.city}</span>}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-black text-orange-600">🏆 {w.points||0}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <p className="text-xs text-blue-700">💡 Ready to hire? Go to <strong>Post a Job</strong> to find workers. This report does not create a job automatically.</p>
                    </div>
                </Accordion>
            )}

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-700">📝 My Notes</p>
                    <button onClick={() => setEditingNotes(e=>!e)} className="text-xs text-orange-500 hover:text-orange-600 font-semibold">{editingNotes?'Done':'Edit'}</button>
                </div>
                {editingNotes
                    ? <textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} onBlur={()=>onSaveNote(notes)} placeholder="Add your own notes…" className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-orange-400 resize-none"/>
                    : <p className="text-sm text-gray-500 min-h-[40px]">{notes||'No notes yet. Click Edit to add notes.'}</p>
                }
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2 print:hidden">
                <button onClick={onReset} className="flex-1 py-3.5 border-2 border-gray-200 text-gray-600 rounded-2xl font-bold text-sm hover:bg-gray-50">← New Analysis</button>
                <button onClick={handlePrint} className="px-5 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-sm flex items-center gap-2">🖨️ PDF</button>
            </div>

            {/* Print CSS */}
            <style>{`@media print { .print\\:hidden { display: none !important; } body { font-size: 12px; } }`}</style>
        </div>
    );
}

// ── History Panel ──────────────────────────────────────────────────────────────
function HistoryPanel({ onLoad, activeId }) {
    const [items,      setItems]     = useState([]);
    const [loading,    setLoading]   = useState(true);
    const [editId,     setEditId]    = useState(null);
    const [editTitle,  setEditTitle] = useState('');
    const [confirmClear, setConfirmClear] = useState(false);

    const fetchList = async () => {
        try { const { data } = await (await import('../../api/index')).getClientAIHistory(); setItems(Array.isArray(data)?data:[]); }
        catch {} finally { setLoading(false); }
    };
    useEffect(() => { fetchList(); }, []);

    const handleLoad = async (id) => {
        try {
            const { getAIHistoryItem: gh } = await import('../../api/index');
            const { data } = await gh(id);
            onLoad(data);
        } catch { toast.error('Failed to load analysis.'); }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm('Delete this analysis?')) return;
        try {
            const { deleteAIHistoryItem: dh } = await import('../../api/index');
            await dh(id);
            setItems(p=>p.filter(i=>i._id!==id));
            toast.success('Deleted.');
        } catch { toast.error('Failed.'); }
    };

    const handleEditSave = async (id) => {
        try {
            const { updateAIHistoryItem: uh } = await import('../../api/index');
            await uh(id, { title: editTitle });
            setItems(p=>p.map(i=>i._id===id?{...i,title:editTitle}:i));
            setEditId(null);
        } catch { toast.error('Failed.'); }
    };

    const handleClearAll = async () => {
        try {
            const { clearClientAIHistory: ch } = await import('../../api/index');
            await ch();
            setItems([]); setConfirmClear(false);
            toast.success('All cleared.');
        } catch { toast.error('Failed.'); }
    };

    if (loading) return <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"/></div>;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700">Analysis History <span className="text-gray-400 font-normal">({items.length})</span></p>
                {items.length>0 && (
                    confirmClear
                        ? <div className="flex gap-1"><button onClick={handleClearAll} className="text-xs text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded">Confirm</button><button onClick={()=>setConfirmClear(false)} className="text-xs text-gray-400 px-2 py-1">No</button></div>
                        : <button onClick={()=>setConfirmClear(true)} className="text-xs text-red-400 hover:text-red-600 font-medium">Clear all</button>
                )}
            </div>

            {items.length===0 ? (
                <div className="text-center py-10 text-gray-400">
                    <div className="text-4xl mb-2">📭</div>
                    <p className="text-sm font-semibold">No history yet</p>
                    <p className="text-xs mt-1">Your analyses will appear here</p>
                </div>
            ) : (
                items.map(item => (
                    <div key={item._id}
                        onClick={() => handleLoad(item._id)}
                        className={`bg-white border-2 rounded-xl p-3 cursor-pointer hover:border-orange-300 transition-all ${activeId===item._id?'border-orange-400 bg-orange-50':'border-gray-100'}`}>
                        <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                {editId===item._id ? (
                                    <input value={editTitle} onChange={e=>setEditTitle(e.target.value)}
                                        onKeyDown={e=>{if(e.key==='Enter')handleEditSave(item._id);if(e.key==='Escape')setEditId(null);}}
                                        onClick={e=>e.stopPropagation()}
                                        autoFocus
                                        className="w-full border border-orange-300 rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none mb-1"/>
                                ) : (
                                    <p className="text-sm font-bold text-gray-800 line-clamp-2 leading-snug">
                                        {item.title || item.report?.jobTitle || item.workDescription?.slice(0,60) || 'Analysis'}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {item.city && <span className="text-[10px] text-gray-400">📍 {item.city}</span>}
                                    {item.clientBudget>0 && <span className="text-[10px] text-green-600 font-medium">💰 {fmtINR(item.clientBudget)}</span>}
                                    {item.report?.grandTotal>0 && <span className="text-[10px] text-orange-600 font-medium">🧾 {fmtINR(item.report.grandTotal)}</span>}
                                    <span className="text-[10px] text-gray-400">{fmtDate(item.createdAt)}</span>
                                </div>
                                {item.notes && <p className="text-[10px] text-gray-400 mt-1 line-clamp-1 italic">📝 {item.notes}</p>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0" onClick={e=>e.stopPropagation()}>
                                <button onClick={e=>{e.stopPropagation();setEditId(item._id);setEditTitle(item.title||'');}}
                                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-orange-100 flex items-center justify-center text-gray-400 hover:text-orange-500 text-xs">✏️</button>
                                <button onClick={e=>handleDelete(item._id,e)}
                                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-400 hover:text-red-500 text-xs">🗑</button>
                            </div>
                        </div>
                        {editId===item._id && (
                            <div className="flex gap-2 mt-2" onClick={e=>e.stopPropagation()}>
                                <button onClick={()=>handleEditSave(item._id)} className="text-xs px-3 py-1 bg-orange-500 text-white rounded-lg font-bold">Save</button>
                                <button onClick={()=>setEditId(null)} className="text-xs px-3 py-1 border border-gray-200 text-gray-500 rounded-lg">Cancel</button>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientAIAssist() {
    const [activeTab,   setActiveTab]  = useState('advisor'); // 'advisor' | 'history'
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
    const [savedId,     setSavedId]    = useState(null); // ID of saved history item
    const [loadingQ,    setLoadingQ]   = useState(false);
    const [loadingR,    setLoadingR]   = useState(false);
    const imageRef = useRef();

    const setAnswer  = (id, val) => setAnswers(p=>({...p,[id]:val}));
    const setOpinion = (id, val) => setOpinions(p=>({...p,[id]:val}));

    const handleImageChange = e => {
        const f = e.target.files?.[0]; if (!f) return;
        setImageFile(f); setImagePreview(URL.createObjectURL(f));
    };

    // Step 1 → 2
    const handleDescribe = async () => {
        if (!description.trim()) { toast.error('Please describe the work.'); return; }
        try {
            setLoadingQ(true);
            const { data } = await aiGenerateQuestions({ workDescription: description, city });
            setQuestions(data.questions||[]);
            setOpinionQs(data.opinionQuestions||[]);
            setPhase('questions');
        } catch {
            toast.error('Could not load questions. Skipping ahead.');
            setPhase('budget');
        } finally { setLoadingQ(false); }
    };

    // Questions → Budget
    const handleQuestionsDone = () => setPhase('budget');

    // Budget → Opinions (if any) or Image
    const handleBudgetDone = () => setPhase(opinionQs.length>0 ? 'opinions' : 'image');

    // Opinions → Image
    const handleOpinionsDone = () => setPhase('image');

    // Generate report
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

            // Auto-save to history
            try {
                const { data: saved } = await saveAIAnalysis({
                    workDescription: description, city, urgent,
                    clientBudget: clientBudget ? Number(clientBudget) : undefined,
                    answers: answersMap, opinions: opinionsMap, report: data,
                });
                setSavedId(saved._id);
            } catch (e) { console.warn('Auto-save failed:', e.message); }

            setReport(data); setPhase('report');
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Analysis failed. Try again.');
            setPhase('image');
        } finally { setLoadingR(false); }
    };

    const handleSaveNote = async (notes) => {
        if (!savedId) return;
        try { await updateAIHistoryItem(savedId, { notes }); }
        catch { /* silent */ }
    };

    const handlePatchReport = async (patch) => {
        setReport(prev => ({ ...(prev || {}), ...(patch || {}) }));
        if (!savedId) return;
        try {
            await updateAIHistoryItem(savedId, {
                report: { ...(report || {}), ...(patch || {}) },
            });
        } catch {
            /* silent */
        }
    };

    const handleReset = () => {
        setPhase('describe'); setDescription(''); setCity(''); setUrgent(false); setClientBudget('');
        setQuestions([]); setOpinionQs([]); setAnswers({}); setOpinions({});
        setImageFile(null); setImagePreview(null); setReport(null); setSavedId(null);
    };

    // Load from history
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

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="max-w-5xl mx-auto p-4 pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 text-white mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🤖</span>
                    <div>
                        <h1 className="text-xl font-black">AI Advisor</h1>
                        <p className="text-xs opacity-80">Expert consultation — cost, time, materials, design, workers</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
                {['advisor','history'].map(t=>(
                    <button key={t} onClick={()=>setActiveTab(t)}
                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab===t?'bg-orange-500 text-white shadow-sm':'bg-white border-2 border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                        {t==='advisor'?'🤖 Advisor':'📂 History'}
                    </button>
                ))}
            </div>

            {/* Main layout: content + sidebar on desktop */}
            <div className="flex gap-4">
                {/* ── LEFT: Advisor Content ── */}
                {activeTab === 'advisor' && (
                    <div className="flex-1 min-w-0">
                        {/* Phase bar */}
                        {phase !== 'report' && phase !== 'loading' && <div className="mb-4"><PhaseBar phase={phase}/></div>}

                        {/* DESCRIBE */}
                        {phase==='describe' && (
                            <div className="space-y-4">
                                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-sm text-orange-700 flex gap-3">
                                    <span className="text-lg flex-shrink-0">💡</span>
                                    <p>Describe your home repair or renovation need in detail. Mention the area, issues, and size for the most accurate advice.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Describe the Work <span className="text-red-500">*</span></label>
                                    <textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}
                                        placeholder="Example: I want to repaint my living room walls. The paint is old and there are small cracks near the window. Room is about 15×12 ft in a Pune apartment…"
                                        className="w-full border-2 border-gray-200 rounded-2xl p-4 text-sm focus:outline-none focus:border-orange-400 resize-none leading-relaxed"/>
                                    <p className="text-xs text-gray-400 mt-1">{description.length} chars</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Your City</label>
                                        <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Pune, Mumbai…" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400"/>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Priority</label>
                                        <button onClick={()=>setUrgent(u=>!u)} className={`w-full py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${urgent?'border-orange-400 bg-orange-50 text-orange-700':'border-gray-200 bg-white text-gray-400'}`}>
                                            {urgent?'⚡ Urgent':' 🕐 Normal'}
                                        </button>
                                    </div>
                                </div>
                                <button onClick={handleDescribe} disabled={loadingQ||!description.trim()}
                                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl disabled:opacity-60 shadow-lg flex items-center justify-center gap-2 text-base">
                                    {loadingQ ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Generating questions…</> : '🤖 Get Expert Advice →'}
                                </button>
                            </div>
                        )}

                        {/* QUESTIONS */}
                        {phase==='questions' && (
                            <div className="space-y-5">
                                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                                    <span className="text-2xl">🤔</span>
                                    <div><p className="text-sm font-bold text-blue-800">Clarifying Questions</p><p className="text-xs text-blue-500 mt-0.5">Answers make the analysis more accurate</p></div>
                                </div>
                                <div className="bg-gray-50 rounded-xl px-4 py-3">
                                    <p className="text-xs text-gray-400 mb-0.5">Your request</p>
                                    <p className="text-sm text-gray-700 line-clamp-2">{description}</p>
                                    {city && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full mt-1 inline-block">📍 {city}</span>}
                                </div>
                                {questions.length===0 ? <p className="text-sm text-gray-400 text-center py-4">No clarifications needed.</p>
                                    : <div className="space-y-4">{questions.map(q=><QWidget key={q.id} q={q} value={answers[q.id]} onChange={setAnswer}/>)}</div>}
                                <div className="flex gap-3">
                                    <button onClick={()=>setPhase('describe')} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                                    <button onClick={handleQuestionsDone} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Next: Set Budget →</button>
                                </div>
                            </div>
                        )}

                        {/* BUDGET */}
                        {phase==='budget' && (
                            <div className="space-y-5">
                                <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex gap-3">
                                    <span className="text-2xl">💰</span>
                                    <div><p className="text-sm font-bold text-green-800">What is your budget?</p><p className="text-xs text-green-600 mt-0.5">AI will consider your budget and give honest advice if the estimate is over or under.</p></div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Your Approximate Budget (₹) <span className="text-gray-400 font-normal">(optional)</span></label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xl">₹</span>
                                        <input type="number" min={0} value={clientBudget}
                                            onKeyDown={preventNegativeKey}
                                            onChange={e=>setClientBudget(sanitizeNonNegativeInput(e.target.value))}
                                            placeholder="e.g. 10000"
                                            className="w-full pl-9 pr-4 py-3 border-2 border-green-300 focus:border-green-500 rounded-xl text-2xl font-black focus:outline-none bg-white transition-colors text-gray-900"/>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {['5000','10000','20000','50000','100000'].map(b=>(
                                            <button key={b} type="button" onClick={()=>setClientBudget(b)}
                                                className={`px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${clientBudget===b?'border-green-400 bg-green-50 text-green-700':'border-gray-200 text-gray-500 hover:border-green-200'}`}>
                                                ₹{Number(b).toLocaleString('en-IN')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={()=>setPhase('questions')} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                                    <button onClick={handleBudgetDone} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">
                                        {opinionQs.length>0 ? 'Next: Preferences →' : 'Next: Add Photos →'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* OPINIONS */}
                        {phase==='opinions' && (
                            <div className="space-y-5">
                                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex gap-3">
                                    <span className="text-2xl">🎨</span>
                                    <div><p className="text-sm font-bold text-purple-800">Your Preferences</p><p className="text-xs text-purple-500 mt-0.5">Help AI make better design and material suggestions</p></div>
                                </div>
                                <div className="space-y-4">
                                    {opinionQs.map(q=><QWidget key={q.id} q={q} value={opinions[q.id]} onChange={setOpinion}/>)}
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={()=>setPhase('budget')} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                                    <button onClick={handleOpinionsDone} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm">Next: Add Photos →</button>
                                </div>
                            </div>
                        )}

                        {/* IMAGE */}
                        {phase==='image' && (
                            <div className="space-y-5">
                                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex gap-3">
                                    <span className="text-2xl">📷</span>
                                    <div><p className="text-sm font-bold text-purple-800">Upload Work Area Photo</p><p className="text-xs text-purple-500 mt-0.5">Optional — helps detect visible issues like cracks, damp spots, peeling</p></div>
                                </div>
                                <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange}/>
                                {imagePreview ? (
                                    <div className="relative">
                                        <img src={imagePreview} alt="Work area" className="w-full rounded-2xl object-cover max-h-64 border-2 border-orange-200"/>
                                        <button onClick={()=>{setImageFile(null);setImagePreview(null);}} className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center text-gray-500 hover:text-red-500 font-bold text-lg">×</button>
                                    </div>
                                ) : (
                                    <div onClick={()=>imageRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition-all">
                                        <div className="text-4xl mb-2">🖼️</div>
                                        <p className="text-sm font-bold text-gray-500">Tap to upload photo</p>
                                        <p className="text-xs text-gray-400 mt-1">JPG, PNG · optional</p>
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <button onClick={()=>setPhase(opinionQs.length>0?'opinions':'budget')} className="px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">← Back</button>
                                    <button onClick={handleGenerate} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                                        {imageFile?'🔍 Analyze with Photo →':'🔍 Generate Full Report →'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* LOADING */}
                        {phase==='loading' && (
                            <div className="flex flex-col items-center justify-center py-24 space-y-6">
                                <div className="relative">
                                    <div className="w-20 h-20 border-4 border-orange-100 rounded-full"/>
                                    <div className="absolute inset-0 w-20 h-20 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"/>
                                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
                                </div>
                                <div className="text-center"><p className="font-bold text-gray-900 text-lg">Analyzing your request…</p><p className="text-sm text-gray-500 mt-1">Generating cost, work plan, design tips, and nearby workers</p></div>
                                <div className="space-y-2 w-full max-w-xs">
                                    {['Identifying required skills','Calculating material costs','Building work plan','Checking colour preferences','Finding nearby workers'].map((s,i)=>(
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-orange-100 border-2 border-orange-400 animate-pulse flex-shrink-0" style={{animationDelay:`${i*0.25}s`}}/>
                                            <p className="text-xs text-gray-500">{s}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* REPORT */}
                        {phase==='report' && report && (
                            <AdvisorReport report={report} onReset={handleReset} onSaveNote={handleSaveNote} onPatchReport={handlePatchReport}/>
                        )}
                    </div>
                )}

                {/* ── RIGHT / HISTORY TAB ── */}
                {activeTab === 'history' && (
                    <div className="flex-1 min-w-0">
                        <HistoryPanel onLoad={handleLoadHistory} activeId={savedId}/>
                    </div>
                )}

                {/* ── DESKTOP SIDEBAR (always visible on lg+) ── */}
                {activeTab === 'advisor' && (
                    <div className="hidden lg:block w-80 flex-shrink-0">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sticky top-4">
                            <HistoryPanel onLoad={handleLoadHistory} activeId={savedId}/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
