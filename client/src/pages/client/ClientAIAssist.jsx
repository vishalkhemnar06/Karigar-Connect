// client/src/pages/client/ClientAIAssist.jsx
// Professional AI Advisor with Complete Report - Orange Theme

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    aiGenerateQuestions, getAIAdvisorReport,
    saveAIAnalysis, getClientAIHistory, getAIHistoryItem,
    updateAIHistoryItem, deleteAIHistoryItem, clearClientAIHistory,
    getImageUrl, getRateTableCities,
} from '../../api/index';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
    IndianRupee, Clock, MapPin, Briefcase, User, Users,
    AlertCircle, CheckCircle, FileText, Image, Camera,
    Settings, TrendingUp, Award, Calendar, Download, Save,
    Trash2, Edit2, Plus, X, Loader2, Sparkles, Target,
    Layers, HardHat, Palette, Wrench, Truck, PenTool
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Utilities
// ─────────────────────────────────────────────────────────────────────────────

const PHASES = ['describe', 'questions', 'budget', 'preferences', 'image', 'loading', 'report'];
const PHASE_LABELS = {
    describe: 'Project Details',
    questions: 'Requirements',
    budget: 'Budget',
    preferences: 'Preferences',
    image: 'Visual Reference',
    loading: 'Analysis',
    report: 'Report'
};

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
};

const sanitizeNumber = (value) => {
    if (value === '') return '';
    const sanitized = String(value).replace(/[^\d.]/g, '');
    const parts = sanitized.split('.');
    return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized;
};

const MIN_AI_DESCRIPTION_CHARS = 60;
const OTHER_CITY_OPTION = '__OTHER_CITY__';

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

const PhaseIndicator = ({ currentPhase }) => {
    const currentIndex = PHASES.indexOf(currentPhase);
    const visiblePhases = PHASES.slice(0, 6);

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between">
                {visiblePhases.map((phase, index) => (
                    <div key={phase} className="flex-1 relative">
                        <div className="flex flex-col items-center">
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                                transition-all duration-300
                                ${index < currentIndex 
                                    ? 'bg-orange-500 text-white' 
                                    : index === currentIndex 
                                        ? 'bg-orange-500 text-white ring-4 ring-orange-100' 
                                        : 'bg-gray-100 text-gray-400'
                                }
                            `}>
                                {index < currentIndex ? (
                                    <CheckCircle size={14} />
                                ) : (
                                    <span>{index + 1}</span>
                                )}
                            </div>
                            <span className={`
                                text-xs mt-2 font-medium text-center
                                ${index <= currentIndex ? 'text-gray-700' : 'text-gray-400'}
                            `}>
                                {PHASE_LABELS[phase]}
                            </span>
                        </div>
                        {index < visiblePhases.length - 1 && (
                            <div className={`
                                absolute top-4 left-1/2 w-full h-0.5 -translate-y-1/2
                                ${index < currentIndex ? 'bg-orange-400' : 'bg-gray-200'}
                            `} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const QuestionField = ({ question, value, onChange }) => {
    if (question.type === 'select') {
        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {question.question}
                </label>
                <div className="flex flex-wrap gap-2">
                    {question.options.map(option => (
                        <button
                            key={option}
                            type="button"
                            onClick={() => onChange(question.id, option)}
                            className={`
                                px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${value === option
                                    ? 'bg-orange-500 text-white shadow-sm'
                                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                                }
                            `}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
                {question.question}
            </label>
            {question.type === 'number' ? (
                <input
                    type="number"
                    min={0}
                    value={value || ''}
                    onChange={(e) => onChange(question.id, sanitizeNumber(e.target.value))}
                    placeholder="Enter a number..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
            ) : (
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(question.id, e.target.value)}
                    placeholder="Your answer..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                />
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Enhanced Report Components
// ─────────────────────────────────────────────────────────────────────────────

const ReportSection = ({ title, icon: Icon, children, defaultOpen = true, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="bg-white border border-orange-100 rounded-xl overflow-hidden shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-orange-50/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon size={20} className="text-orange-500" />}
                    <span className="font-semibold text-gray-900">{title}</span>
                    {badge && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                            {badge}
                        </span>
                    )}
                </div>
                {isOpen ? <ChevronUp size={18} className="text-orange-400" /> : <ChevronDown size={18} className="text-orange-400" />}
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-orange-100"
                    >
                        <div className="px-5 py-4 bg-orange-50/30">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const CostBreakdownTable = ({ breakdown, clientBudget, grandTotal }) => {
    if (!breakdown?.breakdown?.length) return null;

    return (
        <div className="space-y-4">
            {/* Labour Costs */}
            <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <HardHat size={16} className="text-orange-500" />
                    Labour Costs
                </h4>
                <div className="space-y-2">
                    {breakdown.breakdown.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 capitalize">
                                        {item.skill}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {item.count} worker{item.count > 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="text-xs text-gray-400">{item.hours} hours</span>
                                    <span className="text-xs text-gray-400 capitalize">{item.complexity} complexity</span>
                                    <span className="text-xs text-gray-400">₹{item.baseRate || 0}/day</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(item.subtotal)}
                                </span>
                                {item.count > 1 && (
                                    <p className="text-xs text-gray-400">₹{Math.round(item.subtotal / item.count)}/worker</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Materials Breakdown */}
            {breakdown.materialsBreakdown?.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Palette size={16} className="text-orange-500" />
                        Materials
                    </h4>
                    <div className="space-y-2">
                        {breakdown.materialsBreakdown.map((item, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                                <div>
                                    <span className="text-sm font-medium text-gray-900 capitalize">
                                        {item.item}
                                    </span>
                                    {item.quantity && (
                                        <p className="text-xs text-gray-500 mt-0.5">{item.quantity}</p>
                                    )}
                                    {item.note && (
                                        <p className="text-xs text-orange-600 mt-0.5">{item.note}</p>
                                    )}
                                </div>
                                <span className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(item.estimatedCost)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Equipment & Tools */}
            {breakdown.equipmentBreakdown?.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Wrench size={16} className="text-orange-500" />
                        Equipment & Tools
                    </h4>
                    <div className="space-y-2">
                        {breakdown.equipmentBreakdown.map((item, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                                <div>
                                    <span className="text-sm font-medium text-gray-900 capitalize">
                                        {item.item}
                                    </span>
                                    {item.quantity && (
                                        <p className="text-xs text-gray-500 mt-0.5">{item.quantity}</p>
                                    )}
                                </div>
                                <span className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(item.estimatedCost)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Additional Costs */}
            {breakdown.additionalCosts?.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <Truck size={16} className="text-orange-500" />
                        Additional Costs
                    </h4>
                    <div className="space-y-2">
                        {breakdown.additionalCosts.map((item, index) => (
                            <div key={index} className="flex items-center justify-between py-2 border-b border-orange-100">
                                <span className="text-sm font-medium text-gray-900 capitalize">
                                    {item.description || item.item}
                                </span>
                                <span className="text-sm font-semibold text-gray-900">
                                    {formatCurrency(item.cost)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Urgency Surcharge */}
            {breakdown.urgent && (
                <div className="flex items-center justify-between py-2 border-t border-orange-200 mt-3 pt-3">
                    <div>
                        <span className="text-sm font-medium text-orange-700">Urgency Surcharge</span>
                        <p className="text-xs text-orange-600 mt-0.5">+{Math.round((breakdown.urgencyMult - 1) * 100)}% for urgent completion</p>
                    </div>
                    <span className="text-sm font-semibold text-orange-700">
                        +{formatCurrency(breakdown.totalEstimated - (breakdown.subtotal + (breakdown.materialsTotal || 0) + (breakdown.equipmentTotal || 0)))}
                    </span>
                </div>
            )}

            {/* Total */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 mt-4">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-white font-semibold text-lg">Total Estimated Cost</span>
                        {clientBudget > 0 && (
                            <p className="text-orange-100 text-sm mt-1">
                                Your budget: {formatCurrency(clientBudget)}
                            </p>
                        )}
                    </div>
                    <div className="text-right">
                        <span className="text-white font-bold text-2xl">
                            {formatCurrency(grandTotal || breakdown.totalEstimated)}
                        </span>
                        {clientBudget > 0 && grandTotal > clientBudget && (
                            <p className="text-orange-200 text-xs mt-1">
                                Over budget by {formatCurrency(grandTotal - clientBudget)}
                            </p>
                        )}
                    </div>
                </div>
                {clientBudget > 0 && grandTotal < clientBudget && (
                    <div className="mt-2 pt-2 border-t border-orange-400">
                        <p className="text-orange-100 text-sm">
                            ✓ Within budget. You have {formatCurrency(clientBudget - grandTotal)} remaining.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

const WorkPlanTimeline = ({ plan, timeEstimate }) => {
    if (!plan?.length) return null;

    return (
        <div className="space-y-4">
            {/* Timeline Overview */}
            {timeEstimate?.totalHours && (
                <div className="bg-orange-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Estimated Timeline</span>
                        <span className="text-sm font-bold text-orange-600">{timeEstimate.totalHours} hours total</span>
                    </div>
                    <div className="h-2 bg-orange-200 rounded-full overflow-hidden">
                        {timeEstimate.phases?.map((phase, idx) => {
                            const percentage = (phase.hours / timeEstimate.totalHours) * 100;
                            return (
                                <div
                                    key={idx}
                                    className="h-full bg-orange-500 float-left"
                                    style={{ width: `${percentage}%` }}
                                    title={`${phase.phase}: ${phase.hours}h`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Detailed Steps */}
            <div className="relative">
                {plan.map((step, index) => (
                    <div key={index} className="relative pl-8 pb-6 last:pb-0">
                        {/* Timeline connector */}
                        {index < plan.length - 1 && (
                            <div className="absolute left-3 top-6 bottom-0 w-0.5 bg-orange-200" />
                        )}
                        {/* Step number */}
                        <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
                            {step.step || index + 1}
                        </div>
                        {/* Step content */}
                        <div>
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{step.title}</h4>
                                {step.estimatedTime && (
                                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                        {step.estimatedTime}
                                    </span>
                                )}
                            </div>
                            {step.description && (
                                <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                            )}
                            {step.subtasks?.length > 0 && (
                                <div className="mt-2 space-y-1">
                                    {step.subtasks.map((task, idx) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs text-gray-500">
                                            <span className="text-orange-400">•</span>
                                            <span>{task}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const MaterialSpecification = ({ materials }) => {
    if (!materials?.length) return null;

    return (
        <div className="space-y-3">
            {materials.map((material, index) => (
                <div key={index} className="border border-orange-100 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{material.item}</h4>
                            <div className="flex flex-wrap gap-3 mt-1">
                                {material.quantity && (
                                    <span className="text-xs text-gray-500">Quantity: {material.quantity}</span>
                                )}
                                {material.specifications && (
                                    <span className="text-xs text-gray-500">Specs: {material.specifications}</span>
                                )}
                                {material.brand && (
                                    <span className="text-xs text-gray-500">Brand: {material.brand}</span>
                                )}
                            </div>
                            {material.note && (
                                <p className="text-xs text-orange-600 mt-2">{material.note}</p>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(material.estimatedCost)}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const DesignRecommendations = ({ colourAdvice, designSuggestions, improvementIdeas }) => {
    return (
        <div className="space-y-4">
            {/* Colour & Style */}
            {colourAdvice && (
                <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Palette size={18} className="text-orange-500" />
                        <h4 className="font-semibold text-gray-900">Colour & Style Recommendations</h4>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{colourAdvice}</p>
                </div>
            )}

            {/* Design Suggestions */}
            {designSuggestions?.length > 0 && (
                <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <PenTool size={16} className="text-orange-500" />
                        Design Suggestions
                    </h4>
                    <div className="space-y-2">
                        {designSuggestions.map((suggestion, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                                <CheckCircle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                <span>{suggestion}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Improvement Ideas */}
            {improvementIdeas?.length > 0 && (
                <div>
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <TrendingUp size={16} className="text-orange-500" />
                        Optional Upgrades
                    </h4>
                    <div className="space-y-2">
                        {improvementIdeas.map((idea, idx) => (
                            <div key={idx} className="border border-orange-100 rounded-lg p-3 bg-white">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{idea.idea}</p>
                                        {idea.benefit && (
                                            <p className="text-xs text-gray-600 mt-1">{idea.benefit}</p>
                                        )}
                                    </div>
                                    {idea.estimatedExtraCost > 0 && (
                                        <span className="text-sm font-semibold text-orange-600 ml-3">
                                            +{formatCurrency(idea.estimatedExtraCost)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const VisualPreview = ({ description, imageUrl }) => {
    if (!description) return null;

    return (
        <div className="space-y-4">
            {imageUrl && (
                <div className="rounded-lg overflow-hidden border border-orange-200">
                    <img src={imageUrl} alt="After completion preview" className="w-full" />
                </div>
            )}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Target size={18} className="text-orange-500" />
                    <h4 className="font-semibold text-gray-900">After Completion Preview</h4>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{description}</p>
            </div>
        </div>
    );
};

const QualityAssurance = ({ assurance }) => {
    if (!assurance) return null;

    return (
        <div className="space-y-3">
            {assurance.warranty && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5" />
                    <div>
                        <span className="text-sm font-medium text-gray-900">Warranty</span>
                        <p className="text-sm text-gray-600">{assurance.warranty}</p>
                    </div>
                </div>
            )}
            {assurance.qualityCheck && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5" />
                    <div>
                        <span className="text-sm font-medium text-gray-900">Quality Assurance</span>
                        <p className="text-sm text-gray-600">{assurance.qualityCheck}</p>
                    </div>
                </div>
            )}
            {assurance.materialSource && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={16} className="text-green-500 mt-0.5" />
                    <div>
                        <span className="text-sm font-medium text-gray-900">Material Sourcing</span>
                        <p className="text-sm text-gray-600">{assurance.materialSource}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

const WorkerRecommendations = ({ workers, projectSkills }) => {
    if (!workers?.length) return null;

    return (
        <div className="space-y-3">
            <p className="text-sm text-gray-600">
                Based on your project requirements ({projectSkills?.join(', ') || 'various skills'}), 
                here are experienced professionals in your area:
            </p>
            <div className="space-y-2">
                {workers.map((worker, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        <img
                            src={getImageUrl(worker.photo)}
                            alt={worker.name}
                            className="w-12 h-12 rounded-full object-cover border-2 border-orange-200"
                            onError={(e) => { e.target.src = '/admin.png'; }}
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900">{worker.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                {worker.skills?.slice(0, 3).map((skill, idx) => (
                                    <span key={idx} className="text-xs text-orange-600 bg-white px-2 py-0.5 rounded-full">
                                        {skill}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                {worker.experience && (
                                    <span className="text-xs text-gray-500">{worker.experience} years exp</span>
                                )}
                                {worker.rating && (
                                    <span className="text-xs text-amber-500">★ {worker.rating}</span>
                                )}
                                {worker.completedJobs && (
                                    <span className="text-xs text-gray-500">{worker.completedJobs} jobs</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm font-bold text-orange-600">
                                {formatCurrency(worker.rate)}/day
                            </div>
                            <button className="mt-1 text-xs text-orange-600 hover:text-orange-700 font-medium">
                                View Profile
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-3 pt-3 border-t border-orange-100">
                <p className="text-xs text-gray-500">
                    💡 Tip: Contact multiple workers to compare quotes and availability before making a decision.
                </p>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ClientAIAssist() {
    const [activeTab, setActiveTab] = useState('advisor');
    const [phase, setPhase] = useState('describe');
    const [isLoading, setIsLoading] = useState({ questions: false, report: false });
    
    // Form data
    const [description, setDescription] = useState('');
    const [city, setCity] = useState('');
    const [urgent, setUrgent] = useState(false);
    const [clientBudget, setClientBudget] = useState('');
    const [questions, setQuestions] = useState([]);
    const [preferenceQuestions, setPreferenceQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [preferences, setPreferences] = useState({});
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [report, setReport] = useState(null);
    const [savedId, setSavedId] = useState(null);
    const [historyItems, setHistoryItems] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [cityOptions, setCityOptions] = useState([]);
    const [isOtherCityMode, setIsOtherCityMode] = useState(false);

    const isKnownCity = cityOptions.some((opt) => opt.label === city);
    const citySelectValue = (isOtherCityMode || (city && !isKnownCity)) ? OTHER_CITY_OPTION : (city || '');
    
    const imageInputRef = useRef(null);

    // Load history
    const loadHistory = useCallback(async () => {
        setIsHistoryLoading(true);
        try {
            const { data } = await getClientAIHistory();
            setHistoryItems(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setIsHistoryLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab, loadHistory]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data } = await getRateTableCities();
                if (!active) return;
                setCityOptions(Array.isArray(data?.cities) ? data.cities : []);
            } catch {
                if (!active) return;
                setCityOptions([]);
            }
        })();
        return () => { active = false; };
    }, []);

    const handleAnswerChange = (id, value) => {
        setAnswers(prev => ({ ...prev, [id]: value }));
    };

    const handlePreferenceChange = (id, value) => {
        setPreferences(prev => ({ ...prev, [id]: value }));
    };

    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleGenerateQuestions = async () => {
        if (!description.trim()) {
            toast.error('Please describe your project');
            return;
        }
        if (description.trim().length < MIN_AI_DESCRIPTION_CHARS) {
            toast.error(`Please enter at least ${MIN_AI_DESCRIPTION_CHARS} characters before generating questions`);
            return;
        }

        setIsLoading(prev => ({ ...prev, questions: true }));
        try {
            const { data } = await aiGenerateQuestions({
                workDescription: description,
                city: city
            });
            setQuestions(data.questions || []);
            setPreferenceQuestions(data.opinionQuestions || []);
            setPhase('questions');
        } catch (error) {
            console.error('Failed to generate questions:', error);
            toast.error('Unable to generate questions. You can proceed without them.');
            setPhase('budget');
        } finally {
            setIsLoading(prev => ({ ...prev, questions: false }));
        }
    };

    const handleGenerateReport = async () => {
        setIsLoading(prev => ({ ...prev, report: true }));
        setPhase('loading');

        try {
            const answersMap = {};
            questions.forEach(q => {
                if (answers[q.id]) answersMap[q.question] = answers[q.id];
            });

            const preferencesMap = {};
            preferenceQuestions.forEach(q => {
                if (preferences[q.id]) preferencesMap[q.question] = preferences[q.id];
            });

            const formData = new FormData();
            formData.append('workDescription', description);
            formData.append('answers', JSON.stringify(answersMap));
            formData.append('opinions', JSON.stringify(preferencesMap));
            formData.append('city', city);
            formData.append('urgent', String(urgent));
            if (clientBudget && Number(clientBudget) > 0) {
                formData.append('clientBudget', clientBudget);
            }
            if (imageFile) {
                formData.append('workImage', imageFile);
            }

            const { data } = await getAIAdvisorReport(formData);
            setReport(data);

            // Auto-save to history
            try {
                const { data: saved } = await saveAIAnalysis({
                    workDescription: description,
                    city,
                    urgent,
                    clientBudget: clientBudget ? Number(clientBudget) : undefined,
                    answers: answersMap,
                    opinions: preferencesMap,
                    report: data,
                });
                setSavedId(saved._id);
            } catch (error) {
                console.warn('Auto-save failed:', error);
            }

            setPhase('report');
        } catch (error) {
            console.error('Report generation failed:', error);
            toast.error(error?.response?.data?.message || 'Analysis failed. Please try again.');
            setPhase('image');
        } finally {
            setIsLoading(prev => ({ ...prev, report: false }));
        }
    };

    const handleSaveNote = async (notes) => {
        if (!savedId) return;
        try {
            await updateAIHistoryItem(savedId, { notes });
        } catch (error) {
            console.error('Failed to save note:', error);
        }
    };

    const handleLoadHistory = async (id) => {
        try {
            const { data } = await getAIHistoryItem(id);
            setReport(data.report);
            setSavedId(data._id);
            setDescription(data.workDescription || '');
            setCity(data.city || '');
            setUrgent(!!data.urgent);
            setClientBudget(data.clientBudget ? String(data.clientBudget) : '');
            setPhase('report');
            setActiveTab('advisor');
            toast.success('Analysis loaded');
        } catch (error) {
            console.error('Failed to load history:', error);
            toast.error('Unable to load analysis');
        }
    };

    const handleEditHistory = async (id, title) => {
        try {
            await updateAIHistoryItem(id, { title });
            setHistoryItems(prev => prev.map(item =>
                item._id === id ? { ...item, title } : item
            ));
            toast.success('Title updated');
        } catch (error) {
            console.error('Failed to update title:', error);
            toast.error('Unable to update title');
        }
    };

    const handleDeleteHistory = async (id) => {
        if (!window.confirm('Delete this analysis? This action cannot be undone.')) return;
        
        try {
            await deleteAIHistoryItem(id);
            setHistoryItems(prev => prev.filter(item => item._id !== id));
            if (savedId === id) {
                setSavedId(null);
            }
            toast.success('Analysis deleted');
        } catch (error) {
            console.error('Failed to delete:', error);
            toast.error('Unable to delete');
        }
    };

    const handleClearAllHistory = async () => {
        if (!window.confirm('Delete all analyses? This action cannot be undone.')) return;
        
        try {
            await clearClientAIHistory();
            setHistoryItems([]);
            toast.success('All analyses cleared');
        } catch (error) {
            console.error('Failed to clear history:', error);
            toast.error('Unable to clear history');
        }
    };

    const handleReset = () => {
        setPhase('describe');
        setDescription('');
        setCity('');
        setIsOtherCityMode(false);
        setUrgent(false);
        setClientBudget('');
        setQuestions([]);
        setPreferenceQuestions([]);
        setAnswers({});
        setPreferences({});
        setImageFile(null);
        setImagePreview(null);
        setReport(null);
        setSavedId(null);
    };

    const handlePrint = () => {
        window.print();
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">AI Advisor</h1>
                            <p className="text-orange-600 mt-1">Get professional analysis for your renovation or repair project</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab('advisor')}
                                className={`
                                    px-4 py-2 rounded-lg font-medium transition-all
                                    ${activeTab === 'advisor'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-orange-50'
                                    }
                                `}
                            >
                                New Analysis
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`
                                    px-4 py-2 rounded-lg font-medium transition-all
                                    ${activeTab === 'history'
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-orange-50'
                                    }
                                `}
                            >
                                History
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {activeTab === 'advisor' ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                                {phase !== 'report' && phase !== 'loading' && (
                                    <PhaseIndicator currentPhase={phase} />
                                )}

                                {/* Describe Phase */}
                                {phase === 'describe' && (
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Project Description <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                rows={6}
                                                value={description}
                                                onChange={(e) => setDescription(e.target.value)}
                                                placeholder="Describe your project in detail. Include dimensions, materials, and any specific requirements..."
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all resize-none"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                {description.length} characters
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Minimum {MIN_AI_DESCRIPTION_CHARS} characters required for AI question generation
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    City
                                                </label>
                                                <select
                                                    value={citySelectValue}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        if (value === OTHER_CITY_OPTION) {
                                                            setIsOtherCityMode(true);
                                                            if (isKnownCity) setCity('');
                                                            return;
                                                        }
                                                        setIsOtherCityMode(false);
                                                        setCity(value);
                                                    }}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all bg-white"
                                                >
                                                    <option value="">Select city</option>
                                                    {cityOptions.map((cityOpt) => (
                                                        <option key={cityOpt.key} value={cityOpt.label}>{cityOpt.label}</option>
                                                    ))}
                                                    <option value={OTHER_CITY_OPTION}>Other (Enter Manually)</option>
                                                </select>
                                                {citySelectValue === OTHER_CITY_OPTION && (
                                                    <input
                                                        type="text"
                                                        value={city}
                                                        onChange={(e) => setCity(e.target.value)}
                                                        placeholder="Enter city name"
                                                        className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                                    />
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Priority
                                                </label>
                                                <button
                                                    onClick={() => setUrgent(!urgent)}
                                                    className={`
                                                        w-full px-4 py-2 rounded-lg font-medium border transition-all
                                                        ${urgent
                                                            ? 'bg-orange-50 border-orange-300 text-orange-700'
                                                            : 'bg-white border-gray-300 text-gray-700 hover:border-orange-300'
                                                        }
                                                    `}
                                                >
                                                    {urgent ? 'Urgent Priority' : 'Standard Timeline'}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleGenerateQuestions}
                                            disabled={isLoading.questions || !description.trim() || description.trim().length < MIN_AI_DESCRIPTION_CHARS}
                                            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {isLoading.questions ? (
                                                <>
                                                    <Loader2 size={18} className="animate-spin" />
                                                    Analyzing...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles size={18} />
                                                    Continue
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}

                                {/* Questions Phase */}
                                {phase === 'questions' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Please answer these questions to help us provide a more accurate analysis.
                                            </p>
                                        </div>

                                        {questions.length === 0 ? (
                                            <p className="text-center text-gray-500 py-8">No additional questions needed.</p>
                                        ) : (
                                            <div className="space-y-4">
                                                {questions.map(q => (
                                                    <QuestionField
                                                        key={q.id}
                                                        question={q}
                                                        value={answers[q.id]}
                                                        onChange={handleAnswerChange}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase('describe')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setPhase('budget')}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg"
                                            >
                                                Continue
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Budget Phase */}
                                {phase === 'budget' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Provide your estimated budget to get personalized advice.
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Estimated Budget <span className="text-gray-400">(Optional)</span>
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={clientBudget}
                                                    onChange={(e) => setClientBudget(sanitizeNumber(e.target.value))}
                                                    placeholder="Enter your budget"
                                                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="flex gap-2 mt-3">
                                                {[5000, 10000, 20000, 50000, 100000].map(amount => (
                                                    <button
                                                        key={amount}
                                                        onClick={() => setClientBudget(String(amount))}
                                                        className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
                                                    >
                                                        ₹{amount.toLocaleString()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase('questions')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setPhase(preferenceQuestions.length > 0 ? 'preferences' : 'image')}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg"
                                            >
                                                Continue
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Preferences Phase */}
                                {phase === 'preferences' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Share your preferences for better design and material recommendations.
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {preferenceQuestions.map(q => (
                                                <QuestionField
                                                    key={q.id}
                                                    question={q}
                                                    value={preferences[q.id]}
                                                    onChange={handlePreferenceChange}
                                                />
                                            ))}
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase('budget')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={() => setPhase('image')}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg"
                                            >
                                                Continue
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Image Phase */}
                                {phase === 'image' && (
                                    <div className="space-y-6">
                                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                                            <p className="text-sm text-orange-800">
                                                Upload photos of the work area for visual analysis (optional).
                                            </p>
                                        </div>

                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleImageUpload}
                                        />

                                        {imagePreview ? (
                                            <div className="relative">
                                                <img
                                                    src={imagePreview}
                                                    alt="Work area"
                                                    className="w-full rounded-lg object-cover max-h-64 border border-orange-200"
                                                />
                                                <button
                                                    onClick={() => {
                                                        setImageFile(null);
                                                        setImagePreview(null);
                                                    }}
                                                    className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                                                >
                                                    <X size={16} className="text-gray-500" />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => imageInputRef.current?.click()}
                                                className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-all"
                                            >
                                                <Camera size={32} className="mx-auto text-gray-400 mb-2" />
                                                <p className="text-sm text-gray-500">Click to upload a photo</p>
                                                <p className="text-xs text-gray-400 mt-1">JPG, PNG - Max 10MB</p>
                                            </button>
                                        )}

                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPhase(preferenceQuestions.length > 0 ? 'preferences' : 'budget')}
                                                className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={handleGenerateReport}
                                                disabled={isLoading.report}
                                                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isLoading.report ? (
                                                    <>
                                                        <Loader2 size={18} className="animate-spin" />
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    'Generate Analysis'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Loading Phase */}
                                {phase === 'loading' && (
                                    <div className="py-16 text-center">
                                        <div className="relative w-16 h-16 mx-auto">
                                            <div className="absolute inset-0 border-4 border-orange-100 rounded-full"></div>
                                            <div className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-900 mt-6">
                                            Analyzing your project
                                        </h3>
                                        <p className="text-orange-600 mt-2">
                                            This may take a few moments
                                        </p>
                                    </div>
                                )}

                                {/* Report Phase - Complete with all sections */}
                                {phase === 'report' && report && (
                                    <div className="space-y-4" id="advisor-report">
                                        {/* Report Header */}
                                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                                            <p className="text-xs font-medium opacity-80 mb-2">AI ANALYSIS REPORT</p>
                                            <h2 className="text-xl font-bold">{report.jobTitle || 'Project Analysis'}</h2>
                                            {report.problemSummary && (
                                                <p className="text-sm opacity-90 mt-2">{report.problemSummary}</p>
                                            )}
                                            <div className="flex flex-wrap items-center gap-3 mt-4">
                                                {report.durationDays && (
                                                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                                                        {report.durationDays} day{report.durationDays > 1 ? 's' : ''}
                                                    </span>
                                                )}
                                                {report.skillBlocks?.slice(0, 4).map((skill, idx) => (
                                                    <span key={idx} className="text-xs bg-white/20 px-3 py-1 rounded-full capitalize">
                                                        {skill.skill}
                                                    </span>
                                                ))}
                                                {report.confidence?.score && (
                                                    <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
                                                        Confidence: {report.confidence.score}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Warnings Section */}
                                        {report.warnings?.length > 0 && (
                                            <ReportSection title="Important Warnings" icon={AlertCircle} defaultOpen>
                                                <div className="space-y-2">
                                                    {report.warnings.map((warning, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg">
                                                            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                                            <span>{warning}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Cost Estimate Section */}
                                        <ReportSection title="Cost Estimate" icon={IndianRupee} defaultOpen badge="Detailed">
                                            <CostBreakdownTable 
                                                breakdown={report.budgetBreakdown} 
                                                clientBudget={report.clientBudget}
                                                grandTotal={report.grandTotal}
                                            />
                                        </ReportSection>

                                        {/* Work Plan Section */}
                                        {report.workPlan?.length > 0 && (
                                            <ReportSection title="Work Plan" icon={TrendingUp} defaultOpen badge={`${report.workPlan.length} steps`}>
                                                <WorkPlanTimeline plan={report.workPlan} timeEstimate={report.timeEstimate} />
                                            </ReportSection>
                                        )}

                                        {/* Time Estimate Section */}
                                        {report.timeEstimate && (
                                            <ReportSection title="Time Estimate" icon={Clock} defaultOpen>
                                                <div className="space-y-3">
                                                    {report.timeEstimate.phases?.map((phase, idx) => (
                                                        <div key={idx}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-sm font-medium text-gray-700">{phase.phase}</span>
                                                                <span className="text-sm text-orange-600">{phase.hours} hours</span>
                                                            </div>
                                                            <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                                                                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(phase.hours / report.timeEstimate.totalHours) * 100}%` }} />
                                                            </div>
                                                            {phase.description && (
                                                                <p className="text-xs text-gray-500 mt-1">{phase.description}</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div className="mt-3 pt-3 border-t border-orange-100">
                                                        <div className="flex items-center justify-between">
                                                            <span className="font-semibold text-gray-900">Total Estimated Time</span>
                                                            <span className="font-bold text-orange-600">{report.timeEstimate.totalHours} hours</span>
                                                        </div>
                                                        {report.durationDays && (
                                                            <p className="text-sm text-gray-600 mt-1">
                                                                ≈ {report.durationDays} day{report.durationDays > 1 ? 's' : ''} of work
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Expected Outcome Section */}
                                        {report.expectedOutcome?.length > 0 && (
                                            <ReportSection title="Expected Outcome" icon={Target} defaultOpen>
                                                <div className="space-y-2">
                                                    {report.expectedOutcome.map((outcome, idx) => (
                                                        <div key={idx} className="flex items-start gap-2">
                                                            <CheckCircle size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
                                                            <span className="text-sm text-gray-700">{outcome}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </ReportSection>
                                        )}

                                        {/* Materials & Specifications */}
                                        {report.materialsBreakdown?.length > 0 && (
                                            <ReportSection title="Materials & Specifications" icon={Layers} defaultOpen badge={`${report.materialsBreakdown.length} items`}>
                                                <MaterialSpecification materials={report.materialsBreakdown} />
                                            </ReportSection>
                                        )}

                                        {/* Design Recommendations */}
                                        {(report.colourAndStyleAdvice || report.designSuggestions?.length > 0 || report.improvementIdeas?.length > 0) && (
                                            <ReportSection title="Design Recommendations" icon={Palette} defaultOpen>
                                                <DesignRecommendations 
                                                    colourAdvice={report.colourAndStyleAdvice}
                                                    designSuggestions={report.designSuggestions}
                                                    improvementIdeas={report.improvementIdeas}
                                                />
                                            </ReportSection>
                                        )}

                                        {/* Visual Preview */}
                                        {report.visualizationDescription && (
                                            <ReportSection title="After Completion Preview" icon={Image} defaultOpen>
                                                <VisualPreview 
                                                    description={report.visualizationDescription}
                                                    imageUrl={report.visualizationImage}
                                                />
                                            </ReportSection>
                                        )}

                                        {/* Quality Assurance */}
                                        {report.qualityAssurance && (
                                            <ReportSection title="Quality Assurance" icon={CheckCircle} defaultOpen>
                                                <QualityAssurance assurance={report.qualityAssurance} />
                                            </ReportSection>
                                        )}

                                        {/* Worker Recommendations */}
                                        {report.topWorkers?.length > 0 && (
                                            <ReportSection title="Nearby Professionals" icon={Users} defaultOpen badge={`${report.topWorkers.length} available`}>
                                                <WorkerRecommendations 
                                                    workers={report.topWorkers}
                                                    projectSkills={report.skillBlocks?.map(s => s.skill)}
                                                />
                                            </ReportSection>
                                        )}

                                        {/* Notes Section */}
                                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                                    <Edit2 size={14} className="text-orange-500" />
                                                    My Notes
                                                </label>
                                                <button
                                                    onClick={() => {
                                                        const notes = prompt('Add your notes:', report._notes || '');
                                                        if (notes !== null) {
                                                            handleSaveNote(notes);
                                                            setReport(prev => ({ ...prev, _notes: notes }));
                                                        }
                                                    }}
                                                    className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-600 min-h-[60px]">
                                                {report._notes || 'No notes added yet. Click Edit to add your thoughts.'}
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-3 pt-4">
                                            <button
                                                onClick={handleReset}
                                                className="flex-1 py-2.5 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 font-medium"
                                            >
                                                New Analysis
                                            </button>
                                            <button
                                                onClick={handlePrint}
                                                className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                                            >
                                                <Download size={18} />
                                                Export Report
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // History Tab
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Analysis History</h2>
                                    {historyItems.length > 0 && (
                                        <button
                                            onClick={handleClearAllHistory}
                                            className="text-sm text-red-600 hover:text-red-700"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </div>

                                {isHistoryLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 size={32} className="animate-spin text-orange-400" />
                                    </div>
                                ) : historyItems.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FileText size={48} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-500">No saved analyses yet</p>
                                        <p className="text-sm text-gray-400 mt-1">Your reports will appear here</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {historyItems.map(item => (
                                            <div
                                                key={item._id}
                                                onClick={() => handleLoadHistory(item._id)}
                                                className={`
                                                    bg-white border rounded-xl p-4 cursor-pointer transition-all
                                                    ${savedId === item._id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/30'}
                                                `}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-gray-900 truncate">
                                                            {item.title || item.report?.jobTitle || 'Untitled Analysis'}
                                                        </h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            {item.city && (
                                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                    <MapPin size={10} />
                                                                    {item.city}
                                                                </span>
                                                            )}
                                                            {item.clientBudget > 0 && (
                                                                <span className="text-xs text-gray-500">
                                                                    Budget: {formatCurrency(item.clientBudget)}
                                                                </span>
                                                            )}
                                                            <span className="text-xs text-gray-400">
                                                                {formatDate(item.createdAt)}
                                                            </span>
                                                        </div>
                                                        {item.notes && (
                                                            <p className="text-xs text-gray-400 mt-2 line-clamp-1">
                                                                {item.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={async () => {
                                                                const newTitle = prompt('Edit title:', item.title || '');
                                                                if (newTitle) {
                                                                    await handleEditHistory(item._id, newTitle);
                                                                }
                                                            }}
                                                            className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteHistory(item._id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar - Tips */}
                    {activeTab === 'advisor' && phase !== 'report' && phase !== 'loading' && (
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6 sticky top-8">
                                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <Sparkles size={18} className="text-orange-500" />
                                    Tips for Better Results
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">1</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Be Specific</p>
                                            <p className="text-xs text-gray-500">Include dimensions, materials, and current issues</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">2</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Add Photos</p>
                                            <p className="text-xs text-gray-500">Visual references help identify potential issues</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">3</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Set Realistic Budget</p>
                                            <p className="text-xs text-gray-500">Helps provide accurate cost advice</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-semibold">4</div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-800">Share Preferences</p>
                                            <p className="text-xs text-gray-500">Colour, style, material choices improve recommendations</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Print styles */}
            <style>{`
                @media print {
                    .print\\:hidden {
                        display: none !important;
                    }
                    body {
                        background: white;
                    }
                    .bg-orange-50, .bg-orange-100 {
                        background-color: #fef3c7 !important;
                    }
                }
            `}</style>
        </div>
    );
}