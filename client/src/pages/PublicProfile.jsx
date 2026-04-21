import { getImageUrl } from '../constants/config';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api';
import {
  CheckCircle,
  Award,
  MapPin,
  Phone,
  Calendar,
  Star,
  Briefcase,
  ThumbsUp,
  ChevronRight,
  ShieldCheck,
  BadgeIndianRupee,
  Image,
  Mail,
  Clock,
  User,
  ChevronLeft,
  Heart,
  Share2,
  Eye,
  ZoomIn,
  X
} from 'lucide-react';

const PublicProfile = ({ workerId: workerIdProp, inline = false, onClose }) => {
  const params = useParams();
  const workerId = workerIdProp || params.workerId;
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    skills: true,
    workPhotos: true,
    feedback: true
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.getPublicWorkerProfile(workerId);
        setWorker(data);
      } catch {
        setError("Could not find this worker's profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [workerId]);

  const handleExit = () => {
    if (inline && onClose) {
      onClose();
      return;
    }

    navigate(-1);
  };

  const getAge = (dob) => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age >= 0 ? age : null;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const age = getAge(worker?.dob);
  const travelMethodLabel = {
    cycle: 'Cycle',
    motorcycle: 'Motorcycle',
    bike: 'Motorcycle',
    bus: 'Bus',
    lift: 'Using Lift',
    other: 'Other',
  }[String(worker?.dailyProfile?.travelMethod || worker?.travelMethod || 'other').toLowerCase()] || 'Other';
  const paymentMethodLabel = {
    cash: 'Cash',
    online: 'Online',
    flexible: 'Flexible',
  }[String(worker?.dailyProfile?.paymentMethod || 'flexible').toLowerCase()] || 'Flexible';
  const dailySkillRates = Array.isArray(worker?.dailyProfile?.skillRates) ? worker.dailyProfile.skillRates : [];
  const addressText = worker?.address
    ? [worker.address.houseNumber, worker.address.locality, worker.address.city, worker.address.pincode]
        .filter(Boolean)
        .join(', ')
    : '';
  const skills = worker?.skills || [];
  const ratings = worker?.ratings || [];
  const workPhotos = worker?.workPhotos || worker?.portfolioPhotos || [];

  if (loading) {
    return (
      <div className={inline ? 'flex items-center justify-center bg-white p-4' : 'min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4'}>
        <div className="text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm sm:text-lg font-semibold text-orange-700">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={inline ? 'flex items-center justify-center bg-white p-4' : 'min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 p-4'}>
        <div className="bg-white shadow-xl rounded-2xl p-6 sm:p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User size={32} className="text-red-500" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Profile Not Found</h2>
          <p className="text-gray-600 text-sm sm:text-base mb-4">{error}</p>
          <button 
            onClick={handleExit} 
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition-all active:scale-95"
          >
            {inline ? 'Close Preview' : 'Go Back'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={inline ? 'w-full bg-white' : 'min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-white pb-20'}>
      {/* Full Screen Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-all z-10"
          >
            <X size={24} />
          </button>
          <img 
            src={selectedImage} 
            alt="Full size" 
            className="max-w-[95vw] max-h-[95vh] object-contain"
          />
        </div>
      )}

      <div className={inline ? 'w-full px-3 sm:px-4 py-4 sm:py-6' : 'max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6'}>
        {/* Back Button */}
        {!inline && (
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-1.5 text-gray-600 hover:text-orange-600 mb-4 sm:mb-6 text-sm sm:text-base font-semibold transition-all active:scale-95"
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}

        {/* Profile Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
          {/* Cover Image */}
          <div className="h-28 sm:h-32 md:h-44 bg-gradient-to-r from-orange-500 to-amber-500 relative">
            {worker.verificationStatus === 'approved' && (
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-white/20 backdrop-blur-sm rounded-full px-2 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1">
                <CheckCircle size={12} className="text-white" />
                <span className="text-white text-[9px] sm:text-[10px] font-bold">Verified</span>
              </div>
            )}
          </div>

          {/* Profile Info */}
          <div className="relative px-4 sm:px-6 pb-6 sm:pb-8">
            <div className="absolute -top-12 sm:-top-14 left-4 sm:left-6 flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4">
              <img
                src={getImageUrl(
                  worker.photo,
                  `https://ui-avatars.com/api/?name=${worker?.name}&background=ea580c&color=fff&size=200`
                )}
                alt={worker.name}
                className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl border-4 border-white object-cover shadow-xl"
              />
              <div className="mb-1 sm:mb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 break-words">{worker.name}</h1>
                  {worker.verificationStatus === 'approved' && (
                    <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs sm:text-sm text-orange-600 font-mono break-all">{worker.karigarId}</p>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-5 sm:space-y-6 md:space-y-8">
            {/* Stats Row */}
            <div className="pt-14 sm:pt-16 md:pt-20 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
                <p className="text-sm sm:text-base md:text-xl font-black text-orange-600">{worker.rank ? `#${worker.rank}` : '-'}</p>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 font-medium">Rank</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
                <p className="text-sm sm:text-base md:text-xl font-black text-orange-600">{worker.points || 0}</p>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 font-medium">Points</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
                <p className="text-sm sm:text-base md:text-xl font-black text-orange-600">{worker.avgStars > 0 ? `${worker.avgStars}★` : 'New'}</p>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 font-medium">Rating</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
                <p className="text-sm sm:text-base md:text-xl font-black text-orange-600">{worker.completedJobs || 0}</p>
                <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 font-medium">Jobs Done</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <div className="sm:col-span-2 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-100 via-orange-100 to-amber-50 p-3 sm:p-4 rounded-xl border border-amber-300 shadow-sm">
                <div className="flex items-center gap-2 sm:gap-3">
                  <MapPin size={16} className="text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-orange-700">Travel Method</p>
                    <p className="text-sm sm:text-base font-extrabold text-orange-900">{travelMethodLabel}</p>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full bg-white text-orange-700 font-bold border border-orange-200">Highlighted</span>
              </div>

              {worker.mobile && (
                <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 p-2.5 sm:p-3 rounded-xl">
                  <Phone size={14} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-gray-700 break-all">{worker.mobile}</p>
                </div>
              )}
              {addressText && (
                <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 p-2.5 sm:p-3 rounded-xl">
                  <MapPin size={14} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-gray-700 break-words">{addressText}</p>
                </div>
              )}
              {worker.dob && (
                <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 p-2.5 sm:p-3 rounded-xl">
                  <Calendar size={14} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-gray-700">
                    {new Date(worker.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {age !== null ? ` (${age} yrs)` : ''}
                  </p>
                </div>
              )}
              {worker.overallExperience && (
                <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 p-2.5 sm:p-3 rounded-xl">
                  <Briefcase size={14} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-gray-700">{worker.overallExperience}</p>
                </div>
              )}
              {worker.gender && (
                <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 p-2.5 sm:p-3 rounded-xl">
                  <User size={14} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-gray-700 capitalize">{worker.gender}</p>
                </div>
              )}
              {worker.email && (
                <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 p-2.5 sm:p-3 rounded-xl">
                  <Mail size={14} className="text-orange-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-gray-700 break-all">{worker.email}</p>
                </div>
              )}
            </div>

            {worker?.dailyProfile && (
              <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50 rounded-2xl border border-orange-100 p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-orange-500">Daily Details</p>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Work location and global prices</h3>
                  </div>
                  <span className="text-[10px] px-2.5 py-1 rounded-full bg-white border border-orange-200 text-orange-700 font-bold">Public</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="bg-white rounded-xl p-3 border border-orange-100">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Travel</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{travelMethodLabel}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-orange-100">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Payment</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{paymentMethodLabel}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-orange-100">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Phone</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{worker?.dailyProfile?.phoneType || 'Not specified'}</p>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-orange-100">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Live location</p>
                    {worker?.dailyProfile?.liveLocation?.latitude && worker?.dailyProfile?.liveLocation?.longitude && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${worker.dailyProfile.liveLocation.latitude},${worker.dailyProfile.liveLocation.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-black uppercase tracking-wide text-orange-600"
                      >
                        Open Map
                      </a>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {worker?.dailyProfile?.liveLocation?.latitude && worker?.dailyProfile?.liveLocation?.longitude
                      ? `${worker.dailyProfile.liveLocation.latitude}, ${worker.dailyProfile.liveLocation.longitude}`
                      : 'Not shared yet'}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Skill pricing</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {dailySkillRates.length ? dailySkillRates.map((skill, index) => (
                      <div key={`${skill.skillName || 'skill'}-${index}`} className="bg-white rounded-xl p-3 border border-orange-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{skill.skillName || 'Skill'}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Preference {skill.preferenceRank || 1}</p>
                          </div>
                          <div className="text-right text-[11px] font-bold text-gray-600">
                            <p>/hour: ₹{Number(skill.hourlyPrice || 0).toLocaleString('en-IN')}</p>
                            <p>/day: ₹{Number(skill.dailyPrice || 0).toLocaleString('en-IN')}</p>
                            <p>/visit: ₹{Number(skill.visitPrice || 0).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-gray-500">No skill pricing has been added yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Skills Section - Collapsible */}
            <div className="border-t border-gray-100 pt-4">
              <button
                onClick={() => toggleSection('skills')}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <h3 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-2">
                  <Award size={16} /> Skills & Expertise
                </h3>
                <ChevronRight size={16} className={`transition-transform ${expandedSections.skills ? 'rotate-90' : ''}`} />
              </button>
              {expandedSections.skills && (
                <div className="mt-3">
                  {skills.length ? (
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {skills.map((s, i) => (
                        <span key={i} className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-sm font-semibold">
                          {s.name || s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs sm:text-sm">No skills added</p>
                  )}
                </div>
              )}
            </div>

            {/* Work Photos Section - Collapsible */}
            <div className="border-t border-gray-100 pt-4">
              <button
                onClick={() => toggleSection('workPhotos')}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <h3 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-2">
                  <Image size={16} /> Previous Work
                </h3>
                <ChevronRight size={16} className={`transition-transform ${expandedSections.workPhotos ? 'rotate-90' : ''}`} />
              </button>
              {expandedSections.workPhotos && (
                <div className="mt-3">
                  {workPhotos.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                      {workPhotos.slice(0, 8).map((img, i) => (
                        <div 
                          key={`${img}-${i}`}
                          className="relative group cursor-pointer"
                          onClick={() => setSelectedImage(getImageUrl(img))}
                        >
                          <img
                            src={getImageUrl(img)}
                            alt={`work-${i + 1}`}
                            className="h-24 sm:h-28 md:h-32 w-full object-cover rounded-lg border border-orange-100 hover:shadow-md transition-all"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <ZoomIn size={20} className="text-white" />
                          </div>
                        </div>
                      ))}
                      {workPhotos.length > 8 && (
                        <div className="flex items-center justify-center h-24 sm:h-28 md:h-32 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-xs text-gray-400">+{workPhotos.length - 8} more</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs sm:text-sm">No work images available yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Feedback Section - Collapsible */}
            <div className="border-t border-gray-100 pt-4">
              <button
                onClick={() => toggleSection('feedback')}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <h3 className="font-bold text-gray-800 text-sm sm:text-base flex items-center gap-2">
                  <ThumbsUp size={16} /> Client Feedback
                </h3>
                <ChevronRight size={16} className={`transition-transform ${expandedSections.feedback ? 'rotate-90' : ''}`} />
              </button>
              {expandedSections.feedback && (
                <div className="mt-3">
                  {ratings.length ? (
                    <div className="space-y-3">
                      {ratings.slice(0, 5).map((r) => (
                        <div key={r._id} className="bg-gradient-to-r from-orange-50 to-amber-50 p-3 sm:p-4 rounded-xl border border-orange-100">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={getImageUrl(
                                  r?.client?.photo,
                                  `https://ui-avatars.com/api/?name=${r?.client?.name || 'Client'}&background=f97316&color=fff`
                                )}
                                alt={r?.client?.name || 'Client'}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full object-cover flex-shrink-0"
                              />
                              <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate">{r?.client?.name || 'Client'}</p>
                            </div>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={12}
                                  className={s <= (r.stars || 0) ? 'text-yellow-500 fill-current' : 'text-gray-300'}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-gray-700 mt-2 break-words">{r.message || 'No written feedback.'}</p>
                          {r.skill && (
                            <span className="inline-block mt-2 text-[9px] sm:text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                              {r.skill}
                            </span>
                          )}
                        </div>
                      ))}
                      {ratings.length > 5 && (
                        <p className="text-center text-xs text-gray-400">+{ratings.length - 5} more reviews</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs sm:text-sm">No feedback yet.</p>
                  )}
                </div>
              )}
            </div>

            {/* Verification Badge */}
            {worker.verificationStatus === 'approved' && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-xs sm:text-sm text-green-700 flex items-center gap-2">
                <CheckCircle size={14} /> This worker is verified on KarigarConnect.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Small Components (Mobile Optimized)
const Stat = ({ label, value }) => (
  <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-2.5 sm:p-3 md:p-4 text-center">
    <p className="text-sm sm:text-base md:text-xl font-black text-orange-600">{value}</p>
    <p className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 font-medium">{label}</p>
  </div>
);

const Info = ({ icon, text }) => (
  <div className="flex items-center gap-2 sm:gap-3 bg-orange-50 p-2.5 sm:p-3 rounded-xl">
    <div className="text-orange-500 flex-shrink-0">{icon}</div>
    <p className="text-xs sm:text-sm font-medium text-gray-700 break-words">{text}</p>
  </div>
);

const Section = ({ title, icon, children }) => (
  <div>
    <h3 className="font-bold text-gray-800 text-sm sm:text-base mb-2 sm:mb-3 flex items-center gap-2">
      {icon} {title}
    </h3>
    {children}
  </div>
);

export default PublicProfile;