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
} from 'lucide-react';

const PublicProfile = () => {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await api.getPublicWorkerProfile(workerId);
        setWorker(data);
      } catch (err) {
        setError("Could not find this worker's profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [workerId]);

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

  const age = getAge(worker?.dob);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-orange-700">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="bg-white shadow-xl rounded-2xl p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Profile Not Found</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="bg-orange-500 text-white px-5 py-2 rounded-lg">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-white py-10 px-4">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-6">
          <ChevronRight className="rotate-180" /> Back
        </button>

        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="h-44 bg-gradient-to-r from-orange-500 to-amber-500" />

          <div className="relative px-6 pb-6">
            <div className="absolute -top-16 left-6 flex items-end gap-4">
              <img
                src={
                  getImageUrl(worker.photo, `https://ui-avatars.com/api/?name=${worker?.name}&background=ea580c&color=fff&size=200`)
                }
                alt={worker.name}
                className="w-32 h-32 rounded-2xl border-4 border-white object-cover shadow-xl"
              />

              <div className="mb-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{worker.name}</h1>
                  {worker.verificationStatus === 'approved' && <CheckCircle className="text-green-500" />}
                </div>
                <p className="text-sm text-orange-600 font-mono">{worker.karigarId}</p>
              </div>
            </div>
          </div>

          <div className="px-6 pt-20 pb-8 space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Rank" value={worker.rank ? `#${worker.rank}` : '-'} />
              <Stat label="Points" value={worker.points || 0} />
              <Stat label="Average Rating" value={worker.avgStars > 0 ? `${worker.avgStars}★` : 'New'} />
              <Stat label="Jobs Completed" value={worker.completedJobs || 0} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {worker.mobile && <Info icon={<Phone />} text={`Contact: ${worker.mobile}`} />}
              {addressText && <Info icon={<MapPin />} text={addressText} />}
              {worker.dob && (
                <Info
                  icon={<Calendar />}
                  text={`DOB: ${new Date(worker.dob).toLocaleDateString('en-IN')}${age !== null ? ` (${age} years)` : ''}`}
                />
              )}
              {worker.overallExperience && <Info icon={<Briefcase />} text={`Experience Level: ${worker.overallExperience}`} />}
              {worker.gender && <Info icon={<ShieldCheck />} text={`Gender: ${worker.gender}`} />}
              {worker.karigarId && <Info icon={<BadgeIndianRupee />} text={`ID: ${worker.karigarId}`} />}
            </div>

            <Section title="Skills" icon={<Award />}>
              <div className="flex flex-wrap gap-2">
                {skills.length ? (
                  skills.map((s, i) => (
                    <span key={i} className="bg-orange-500 text-white px-3 py-1 rounded-lg text-sm">
                      {s.name || s}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500">No skills added</p>
                )}
              </div>
            </Section>

            <Section title="Previous Work Images" icon={<Image />}>
              {workPhotos.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {workPhotos.map((img, i) => (
                    <img
                      key={`${img}-${i}`}
                      src={getImageUrl(img)}
                      alt={`work-${i + 1}`}
                      className="h-28 w-full object-cover rounded-lg border border-orange-100"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No work images available yet.</p>
              )}
            </Section>

            <Section title="Feedback From Clients" icon={<ThumbsUp />}>
              {ratings.length ? (
                <div className="space-y-4">
                  {ratings.map((r) => (
                    <div key={r._id} className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={getImageUrl(r?.client?.photo, `https://ui-avatars.com/api/?name=${r?.client?.name || 'Client'}&background=f97316&color=fff`)}
                            alt={r?.client?.name || 'Client'}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <p className="font-semibold text-gray-800">{r?.client?.name || 'Client'}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star key={s} size={14} className={s <= (r.stars || 0) ? 'text-yellow-500 fill-current' : 'text-gray-300'} />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{r.message || 'No written feedback.'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No feedback yet.</p>
              )}
            </Section>

            {worker.verificationStatus === 'approved' && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2">
                <CheckCircle size={16} /> This worker is verified on KarigarConnect.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Small Components ---------- */

const Stat = ({ label, value }) => (
  <div className="bg-orange-50 rounded-xl p-4 text-center">
    <p className="text-xl font-bold text-orange-600">{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);

const Info = ({ icon, text }) => (
  <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-xl">
    <div className="text-orange-600">{icon}</div>
    <p className="text-sm font-medium text-gray-700">{text}</p>
  </div>
);

const Section = ({ title, icon, children }) => (
  <div>
    <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
      {icon} {title}
    </h3>
    {children}
  </div>
);

export default PublicProfile;