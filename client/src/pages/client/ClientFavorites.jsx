import { useEffect, useState } from 'react';
import { getClientProfile, getWorkerFullProfile, getImageUrl } from '../../api/index';
import { Star, Phone, MapPin, Award, Briefcase, User, Verified, Crown, Diamond, Sparkles, Trophy, Heart, Eye, MessageCircle, ThumbsUp, Calendar, Clock, Shield, Zap, Gift, Rocket, Smile, TrendingUp, Users, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';
import DirectHireModal from '../../components/DirectHireModal';

const openMap = (lat, lng) => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
        toast.error('Worker location coordinates are not available.');
        return;
    }
    window.open(`https://www.google.com/maps?q=${nLat},${nLng}`, '_blank', 'noopener,noreferrer');
};

// Premium Worker Card Component
const WorkerCard = ({ worker, onHireDirect, client }) => {
    const [imageError, setImageError] = useState(false);
    const [expanded, setExpanded] = useState(false);
    
    const imageSrc = worker.photo && !imageError ? getImageUrl(worker.photo) : null;
    const initials = worker.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'W';
    const rating = Number(worker.avgStars || 0);
    const skills = Array.isArray(worker.skills) ? worker.skills.map(s => typeof s === 'object' ? s.name : s) : [];
    const canDirectHire = /smart|android|iphone|ios/.test(String(worker.phoneType || '').toLowerCase());
    const completionRate = worker.completedJobs && worker.totalJobs ? Math.round((worker.completedJobs / worker.totalJobs) * 100) : 0;

    const getSkillProficiencyColor = (proficiency) => {
        if (!proficiency) return 'bg-orange-100 text-orange-700';
        const p = proficiency.toLowerCase();
        if (p === 'expert' || p === 'high') return 'bg-emerald-100 text-emerald-700';
        if (p === 'medium' || p === 'intermediate') return 'bg-amber-100 text-amber-700';
        return 'bg-blue-100 text-blue-700';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4 }}
            className="bg-white rounded-xl border border-gray-100 shadow-md hover:shadow-xl transition-all overflow-hidden group"
        >
            {/* Header Section */}
            <div className="relative bg-gradient-to-r from-orange-50 to-amber-50 p-4">
                <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 border-2 border-orange-200 shadow-md">
                            {imageSrc ? (
                                <img 
                                    src={imageSrc} 
                                    alt={worker.name} 
                                    onError={() => setImageError(true)}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl font-bold text-orange-500">
                                    {initials}
                                </div>
                            )}
                        </div>
                        {worker.verificationStatus === 'approved' && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                                <Verified size={10} className="text-white" />
                            </div>
                        )}
                        {rating >= 4.5 && (
                            <div className="absolute -bottom-1 -left-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                                <Crown size={8} className="text-white" />
                            </div>
                        )}
                    </div>

                    {/* Name & ID */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-bold text-gray-800 text-base truncate">{worker.name}</h3>
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-mono font-semibold">
                                {worker.karigarId}
                            </span>
                        </div>
                        
                        {/* Rating */}
                        <div className="flex items-center gap-2 mt-1">
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <Star key={star} size={12} className={star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                                ))}
                            </div>
                            <span className="text-xs font-semibold text-gray-600">{rating.toFixed(1)}</span>
                            <span className="text-[10px] text-gray-400">({worker.totalRatings || 0} reviews)</span>
                        </div>

                        {/* Location */}
                        {worker.address?.city && (
                            <div className="flex items-center gap-1 mt-1">
                                <MapPin size={10} className="text-orange-400" />
                                <span className="text-[10px] text-gray-500 truncate">{worker.address.city}</span>
                            </div>
                        )}
                    </div>

                    {/* Availability Badge */}
                    <div className={`px-2 py-1 rounded-lg text-[9px] font-bold ${worker.availability !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {worker.availability !== false ? 'Available' : 'Busy'}
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="px-4 pt-3 grid grid-cols-3 gap-2">
                <div className="text-center">
                    <p className="text-xs font-bold text-orange-600">{worker.points || 0}</p>
                    <p className="text-[9px] text-gray-400">Points</p>
                </div>
                <div className="text-center">
                    <p className="text-xs font-bold text-emerald-600">{worker.completedJobs || 0}</p>
                    <p className="text-[9px] text-gray-400">Jobs Done</p>
                </div>
                <div className="text-center">
                    <p className="text-xs font-bold text-blue-600">{completionRate}%</p>
                    <p className="text-[9px] text-gray-400">Success</p>
                </div>
            </div>

            {/* Skills Section */}
            {skills.length > 0 && (
                <div className="px-4 pt-3">
                    <div className="flex flex-wrap gap-1.5">
                        {skills.slice(0, 4).map((skill, idx) => {
                            const proficiency = typeof skill === 'object' ? skill.proficiency : null;
                            const skillName = typeof skill === 'object' ? skill.name : skill;
                            return (
                                <span key={idx} className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${getSkillProficiencyColor(proficiency)}`}>
                                    {skillName}
                                </span>
                            );
                        })}
                        {skills.length > 4 && (
                            <button 
                                onClick={() => setExpanded(!expanded)}
                                className="text-[9px] text-orange-500 font-semibold hover:underline"
                            >
                                +{skills.length - 4} more
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Expanded Details */}
            <AnimatePresence>
                {expanded && skills.length > 4 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="px-4 pb-2"
                    >
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {skills.slice(4).map((skill, idx) => {
                                const proficiency = typeof skill === 'object' ? skill.proficiency : null;
                                const skillName = typeof skill === 'object' ? skill.name : skill;
                                return (
                                    <span key={idx} className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${getSkillProficiencyColor(proficiency)}`}>
                                        {skillName}
                                    </span>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Experience & Details */}
            <div className="px-4 pt-3 pb-2 text-[10px] text-gray-500 space-y-1">
                {worker.experience && (
                    <div className="flex items-center gap-1">
                        <Briefcase size={10} className="text-orange-400" />
                        <span>{worker.experience} years experience</span>
                    </div>
                )}
                {worker.phoneType && (
                    <div className="flex items-center gap-1">
                        <Phone size={10} className="text-orange-400" />
                        <span>{worker.phoneType}</span>
                    </div>
                )}
                {worker.dailyRate && (
                    <div className="flex items-center gap-1">
                        <TrendingUp size={10} className="text-orange-400" />
                        <span>₹{worker.dailyRate.toLocaleString()}/day</span>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="px-4 pb-4 pt-2">
                <div className={`grid gap-2 ${canDirectHire ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {worker.mobile && (
                        <a
                            href={`tel:${worker.mobile}`}
                            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 rounded-lg text-[11px] font-bold hover:shadow-md transition-all active:scale-95"
                        >
                            <Phone size={12} /> Call
                        </a>
                    )}
                    <button
                        onClick={() => openMap(worker.address?.latitude, worker.address?.longitude)}
                        className="flex items-center justify-center gap-1.5 border border-orange-200 text-orange-600 py-2 rounded-lg text-[11px] font-bold hover:bg-orange-50 transition-all active:scale-95"
                    >
                        <MapPin size={12} /> Location
                    </button>
                    {canDirectHire && (
                        <button
                            onClick={() => onHireDirect(worker)}
                            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-2 rounded-lg text-[11px] font-bold hover:shadow-md transition-all active:scale-95"
                        >
                            <Briefcase size={12} /> Hire
                        </button>
                    )}
                </div>

                <button
                    onClick={() => openWorkerProfilePreview(worker._id || worker.karigarId)}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-600 py-2 rounded-lg text-[11px] font-semibold hover:bg-gray-50 transition-all active:scale-95"
                >
                    <Eye size={12} /> View Full Profile
                </button>
            </div>
        </motion.div>
    );
};

// Skeleton Loader Component
const SkeletonCard = () => (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
        <div className="bg-gradient-to-r from-gray-200 to-gray-100 p-4">
            <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-gray-200" />
                <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-24" />
                </div>
            </div>
        </div>
        <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
                <div className="h-12 bg-gray-100 rounded-lg" />
                <div className="h-12 bg-gray-100 rounded-lg" />
                <div className="h-12 bg-gray-100 rounded-lg" />
            </div>
            <div className="flex gap-2">
                <div className="h-6 bg-gray-100 rounded-full w-16" />
                <div className="h-6 bg-gray-100 rounded-full w-20" />
            </div>
            <div className="flex gap-2">
                <div className="h-8 bg-gray-100 rounded flex-1" />
                <div className="h-8 bg-gray-100 rounded flex-1" />
            </div>
        </div>
    </div>
);

// Empty State Component
const EmptyState = () => (
    <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
    >
        <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart size="36" className="text-orange-400" />
        </div>
        <h3 className="font-bold text-gray-800 text-xl mb-2">No Favorite Workers</h3>
        <p className="text-gray-400 text-sm max-w-sm mx-auto">
            Star workers you like from search results or direct invites. They will appear here for quick access.
        </p>
    </motion.div>
);

export default function ClientFavorites() {
    const [loading, setLoading] = useState(true);
    const [workers, setWorkers] = useState([]);
    const [client, setClient] = useState(null);
    const [isDirectHireModalOpen, setIsDirectHireModalOpen] = useState(false);
    const [directHireSelectedWorker, setDirectHireSelectedWorker] = useState(null);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data: profile } = await getClientProfile();
                if (active) setClient(profile || null);
                const ids = Array.isArray(profile?.starredWorkers) ? profile.starredWorkers : [];
                if (ids.length === 0) {
                    if (active) setWorkers([]);
                    return;
                }

                const rows = await Promise.all(ids.map(async (id) => {
                    try {
                        const { data } = await getWorkerFullProfile(id);
                        return data;
                    } catch {
                        return null;
                    }
                }));

                if (!active) return;
                setWorkers(rows.filter(Boolean));
            } catch {
                if (!active) return;
                toast.error('Unable to load favorite workers');
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => { active = false; };
    }, []);

    const handleHireDirect = (worker) => {
        setDirectHireSelectedWorker(worker);
        setIsDirectHireModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50/20 via-white to-orange-50/10 pb-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
                
                {/* Hero Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    data-guide-id="client-page-favorites"
                    className="mb-8"
                >
                    <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                    <Heart size="24" className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black">Favorite Workers</h1>
                                    <p className="text-white/90 text-sm mt-0.5">Starred workers with full details</p>
                                </div>
                            </div>
                            {workers.length > 0 && (
                                <div className="bg-white/15 rounded-xl px-3 py-1.5 text-center">
                                    <p className="text-2xl font-bold">{workers.length}</p>
                                    <p className="text-[10px] text-white/80">Favorites</p>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                    </div>
                ) : workers.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {workers.map((worker) => (
                            <WorkerCard 
                                key={worker._id} 
                                worker={worker} 
                                onHireDirect={handleHireDirect}
                                client={client}
                            />
                        ))}
                    </div>
                )}

                {/* Direct Hire Modal */}
                <DirectHireModal
                    isOpen={isDirectHireModalOpen}
                    worker={directHireSelectedWorker}
                    client={client}
                    onClose={() => setIsDirectHireModalOpen(false)}
                    onSuccess={() => {
                        // No immediate list mutation needed for favorites after request creation
                    }}
                />
            </div>
        </div>
    );
}