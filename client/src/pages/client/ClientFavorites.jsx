import { useEffect, useState } from 'react';
import { getClientProfile, getWorkerFullProfile, getImageUrl } from '../../api/index';
import { Star, Phone, MapPin, Award, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { openWorkerProfilePreview } from '../../utils/workerProfilePreview';

const openMap = (lat, lng) => {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
        toast.error('Worker location coordinates are not available.');
        return;
    }
    window.open(`https://www.google.com/maps?q=${nLat},${nLng}`, '_blank', 'noopener,noreferrer');
};

export default function ClientFavorites() {
    const [loading, setLoading] = useState(true);
    const [workers, setWorkers] = useState([]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const { data: profile } = await getClientProfile();
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

    return (
        <div className="max-w-6xl mx-auto px-4 py-6 pb-24 space-y-4">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-3xl p-6 text-white">
                <h1 className="text-3xl font-black">Favorite Workers</h1>
                <p className="text-sm text-orange-100 mt-1">Starred workers, full details, call and location access</p>
            </div>

            {loading ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">Loading favorites...</div>
            ) : workers.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">No favorite workers yet.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workers.map((worker) => (
                        <div key={worker._id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <img src={getImageUrl(worker.photo)} alt="" className="w-14 h-14 rounded-full object-cover border border-gray-200" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-black text-gray-900 truncate">{worker.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{worker.karigarId}</p>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-amber-600">
                                        <Star size={12} />
                                        <span>{Number(worker.avgStars || 0).toFixed(1)} rating</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3 space-y-2 text-sm">
                                <p className="flex items-center gap-2 text-gray-700"><Award size={14} className="text-orange-500" />{worker.points || 0} points</p>
                                <p className="flex items-center gap-2 text-gray-700"><Briefcase size={14} className="text-orange-500" />{worker.completedJobs || 0} completed jobs</p>
                                <p className="text-gray-700"><span className="font-semibold">Skills:</span> {(worker.skills || []).map((s) => s.name || s).join(', ') || 'Not listed'}</p>
                                <p className="text-gray-700"><span className="font-semibold">City:</span> {worker.address?.city || 'Not provided'}</p>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                                <a
                                    href={worker.mobile ? `tel:${worker.mobile}` : undefined}
                                    onClick={(e) => { if (!worker.mobile) { e.preventDefault(); toast.error('Worker phone not available.'); } }}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold"
                                >
                                    <Phone size={14} /> Call Now
                                </a>
                                <button
                                    onClick={() => openMap(worker.address?.latitude, worker.address?.longitude)}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-orange-200 text-orange-700 rounded-xl text-sm font-bold hover:bg-orange-50"
                                >
                                    <MapPin size={14} /> View Location
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => openWorkerProfilePreview(worker._id || worker.karigarId)}
                                className="mt-2 w-full inline-flex items-center justify-center px-3 py-2 border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                            >
                                View Profile
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
