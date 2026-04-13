// client/src/pages/client/ClientLiveTracking.jsx
// FIXED: Geolocation permission prompt now works properly

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LiveMap from '../../components/LiveMap';
import { getJobLocationData, initClientLocation } from '../../api';
import toast from 'react-hot-toast';
import { MapPin, Navigation, AlertCircle, CheckCircle, Clock, User, Phone } from 'lucide-react';

const POLL_INTERVAL = 5000; // ms — refresh worker positions

// Haversine formula: distance in km between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dL = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dL / 2) ** 2 +
              Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
}

export default function ClientLiveTracking() {
    const { jobId } = useParams();
    const navigate = useNavigate();

    const [locationData, setLocationData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [lastRefresh, setLastRefresh] = useState(null);
    const [isManualLocation, setIsManualLocation] = useState(false);

    // Client location capture state
    const [clientLocStatus, setClientLocStatus] = useState('idle'); // idle | requesting | captured | error
    const [clientLocation, setClientLocation] = useState(null);
    const pollRef = useRef(null);

    // ── Fetch location snapshot from server ────────────────────────────────
    const fetchSnapshot = useCallback(async () => {
        try {
            const { data } = await getJobLocationData(jobId);
            setLocationData(data);
            setError('');
            setLastRefresh(new Date());
            
            // Check if client location already exists on server
            if (data?.clientLocation?.lat && clientLocStatus === 'idle') {
                setClientLocStatus('captured');
                setClientLocation(data.clientLocation);
            }
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load location data.');
        } finally {
            setLoading(false);
        }
    }, [jobId, clientLocStatus]);

    useEffect(() => {
        fetchSnapshot();
        pollRef.current = setInterval(fetchSnapshot, POLL_INTERVAL);
        return () => clearInterval(pollRef.current);
    }, [fetchSnapshot]);

    // ── Request location permission with user interaction ─────────────────
    const requestLocationPermission = useCallback(async () => {
        if (!navigator.geolocation) {
            setClientLocStatus('error');
            setError('Geolocation is not supported by your browser.');
            return;
        }

        setClientLocStatus('requesting');
        
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    // Reverse geocode with Nominatim
                    let address = '';
                    try {
                        const r = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
                            { headers: { 'Accept-Language': 'en' } }
                        );
                        const g = await r.json();
                        address = g.display_name || '';
                    } catch (err) {
                        console.warn('Reverse geocoding failed:', err);
                    }

                    await initClientLocation(
                        jobId,
                        pos.coords.latitude,
                        pos.coords.longitude,
                        address
                    );
                    
                    setClientLocation({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude,
                        address
                    });
                    setClientLocStatus('captured');
                    
                    // Refresh snapshot so the client pin appears immediately
                    fetchSnapshot();
                    
                } catch (err) {
                    console.error('Failed to save location:', err);
                    setClientLocStatus('error');
                    setError('Failed to save your location. Please try again.');
                }
            },
            (err) => {
                console.error('Geolocation error:', err);
                setClientLocStatus('error');
                
                let errorMessage = 'Could not get your location. ';
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        errorMessage = 'Location permission denied. Please enable location access in your browser settings to use live tracking.';
                        break;
                    case err.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case err.TIMEOUT:
                        errorMessage = 'Location request timed out. Please try again.';
                        break;
                    default:
                        errorMessage += 'Please check your location settings.';
                }
                setError(errorMessage);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [jobId, fetchSnapshot]);

    // ── Manual location entry ──────────────────────────────────────────────
    const [manualAddress, setManualAddress] = useState('');
    const [manualLat, setManualLat] = useState('');
    const [manualLng, setManualLng] = useState('');
    const [savingManual, setSavingManual] = useState(false);

    const saveManualLocation = async () => {
        if (!manualAddress.trim() || !manualLat || !manualLng) {
            setError('Please fill in all fields');
            return;
        }
        
        setSavingManual(true);
        try {
            await initClientLocation(
                jobId,
                parseFloat(manualLat),
                parseFloat(manualLng),
                manualAddress
            );
            setClientLocation({
                lat: parseFloat(manualLat),
                lng: parseFloat(manualLng),
                address: manualAddress
            });
            setClientLocStatus('captured');
            setIsManualLocation(false);
            fetchSnapshot();
            toast.success('Location saved successfully!');
        } catch {
            setError('Failed to save location. Please try again.');
        } finally {
            setSavingManual(false);
        }
    };

    // ── Derive map data ────────────────────────────────────────────────────
    const workers = locationData?.workers || [];
    const clientMarker = clientLocation || locationData?.clientLocation;

    const workerMarkers = workers
        .filter(w => w.workerLocation?.lat && w.workerLocation?.lng)
        .map(w => ({
            lat: w.workerLocation.lat,
            lng: w.workerLocation.lng,
            accuracy: w.workerLocation.accuracy,
            heading: w.workerLocation.heading,
            speed: w.workerLocation.speed,
            name: w.workerName,
            photo: w.workerPhoto,
            sharingActive: w.sharingActive,
        }));

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Loading tracking data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
            <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all active:scale-95"
                    >
                        ← Back
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                            Live Worker Tracking
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Real-time location updates every 5 seconds
                        </p>
                    </div>
                    {lastRefresh && (
                        <div className="flex items-center gap-1 text-[11px] text-gray-400 bg-white px-3 py-1.5 rounded-full">
                            <Clock size={12} />
                            Updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-start gap-2">
                        <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs sm:text-sm text-red-700 flex-1">{error}</p>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
                    </div>
                )}

                {/* Client Location Setup - Mobile Friendly */}
                {clientLocStatus !== 'captured' && (
                    <div className="bg-white rounded-xl border border-orange-100 p-4 mb-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <MapPin size={18} className="text-orange-500" />
                            <h3 className="font-bold text-gray-800 text-sm">Set Your Location</h3>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Share your current location so workers can navigate to you. This helps workers estimate arrival time.
                        </p>
                        
                        {clientLocStatus === 'requesting' ? (
                            <div className="flex items-center justify-center py-4">
                                <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                <span className="ml-2 text-xs text-gray-500">Requesting location...</span>
                            </div>
                        ) : isManualLocation ? (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    value={manualAddress}
                                    onChange={e => setManualAddress(e.target.value)}
                                    placeholder="Full address"
                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-50"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="number"
                                        step="any"
                                        value={manualLat}
                                        onChange={e => setManualLat(e.target.value)}
                                        placeholder="Latitude"
                                        className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-orange-400"
                                    />
                                    <input
                                        type="number"
                                        step="any"
                                        value={manualLng}
                                        onChange={e => setManualLng(e.target.value)}
                                        placeholder="Longitude"
                                        className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:border-orange-400"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={saveManualLocation}
                                        disabled={savingManual}
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                                    >
                                        {savingManual ? 'Saving...' : 'Save Location'}
                                    </button>
                                    <button
                                        onClick={() => setIsManualLocation(false)}
                                        className="px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-600 text-sm font-semibold active:scale-95"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button
                                    onClick={requestLocationPermission}
                                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
                                >
                                    <Navigation size={16} />
                                    Use My Current Location
                                </button>
                                <button
                                    onClick={() => setIsManualLocation(true)}
                                    className="flex-1 flex items-center justify-center gap-2 border-2 border-orange-200 text-orange-600 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-50 transition-all active:scale-95"
                                >
                                    <MapPin size={16} />
                                    Enter Address Manually
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Location Captured Success Message */}
                {clientLocStatus === 'captured' && clientLocation && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                        <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                        <p className="text-xs sm:text-sm text-green-700 flex-1">
                            Location set: {clientLocation.address || `${clientLocation.lat.toFixed(4)}, ${clientLocation.lng.toFixed(4)}`}
                        </p>
                        <button
                            onClick={() => { setClientLocStatus('idle'); setIsManualLocation(false); }}
                            className="text-green-600 hover:text-green-800 text-xs font-semibold"
                        >
                            Change
                        </button>
                    </div>
                )}

                {/* Worker Status Cards */}
                {workers.length > 0 && (
                    <div className="mb-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <User size={12} /> Assigned Workers ({workers.length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {workers.map((w, i) => {
                                const hasLoc = w.workerLocation?.lat && w.workerLocation?.lng;
                                const distKm = (hasLoc && clientMarker?.lat)
                                    ? haversine(w.workerLocation.lat, w.workerLocation.lng, clientMarker.lat, clientMarker.lng)
                                    : null;

                                return (
                                    <div key={w.workerId?.toString() || i} className={`bg-white rounded-xl border p-3 shadow-sm ${
                                        w.sharingActive ? 'border-green-200' : 'border-gray-100'
                                    }`}>
                                        <div className="flex items-center gap-3 mb-2">
                                            {w.workerPhoto ? (
                                                <img
                                                    src={w.workerPhoto}
                                                    alt={w.workerName}
                                                    className="w-10 h-10 rounded-full object-cover border-2 border-orange-100"
                                                    onError={e => { e.target.src = '/admin.png'; }}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center text-white font-bold">
                                                    {(w.workerName || 'W')[0].toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-gray-800 text-sm truncate">{w.workerName || 'Worker'}</p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <div className={`w-2 h-2 rounded-full ${w.sharingActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                                    <span className={`text-[10px] font-semibold ${w.sharingActive ? 'text-green-600' : 'text-gray-500'}`}>
                                                        {w.sharingActive ? 'Live' : 'Paused'}
                                                    </span>
                                                </div>
                                            </div>
                                            {w.workerMobile && (
                                                <a
                                                    href={`tel:${w.workerMobile}`}
                                                    className="p-1.5 bg-gray-100 rounded-lg text-gray-600 hover:bg-orange-100 hover:text-orange-600 transition-colors"
                                                >
                                                    <Phone size={14} />
                                                </a>
                                            )}
                                        </div>

                                        <div className="space-y-1 text-[11px] text-gray-500">
                                            {hasLoc ? (
                                                <>
                                                    <div className="flex items-center gap-1">
                                                        <MapPin size={10} />
                                                        <span className="font-mono">{w.workerLocation.lat.toFixed(5)}, {w.workerLocation.lng.toFixed(5)}</span>
                                                    </div>
                                                    {distKm !== null && (
                                                        <div className="flex items-center gap-1">
                                                            <Navigation size={10} />
                                                            <span>{distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`} from your location</span>
                                                        </div>
                                                    )}
                                                    {w.workerLocation?.speed > 0 && (
                                                        <div>🚗 {(w.workerLocation.speed * 3.6).toFixed(1)} km/h</div>
                                                    )}
                                                    <div className="flex items-center gap-1">
                                                        <Clock size={10} />
                                                        <span>Updated: {timeAgo(w.workerLocation.updatedAt)}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-orange-500 font-medium">⏳ Waiting for worker to share location...</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* No Data State */}
                {!locationData && !error && workers.length === 0 && (
                    <div className="bg-white rounded-xl border border-orange-100 p-8 text-center mb-4">
                        <MapPin size={48} className="text-gray-300 mx-auto mb-3" />
                        <p className="font-bold text-gray-800">No Tracking Data Yet</p>
                        <p className="text-xs text-gray-500 mt-1">Workers haven't started sharing their location. This page will auto-update every 5 seconds.</p>
                    </div>
                )}

                {/* Map */}
                {(workerMarkers.length > 0 || clientMarker) && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                        <LiveMap
                            workerMarkers={workerMarkers}
                            clientMarker={clientMarker}
                            height="400px"
                            showAccuracy={true}
                        />
                    </div>
                )}

                {/* Legend */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 mb-4 flex flex-wrap gap-4 justify-center">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-white shadow-sm" />
                        <span className="text-[10px] sm:text-xs text-gray-600 font-medium">Worker (Live)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-white shadow-sm" />
                        <span className="text-[10px] sm:text-xs text-gray-600 font-medium">Worker (Paused)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                        <span className="text-[10px] sm:text-xs text-gray-600 font-medium">Your Location</span>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
                        <AlertCircle size={12} /> About Live Tracking
                    </p>
                    <ul className="text-[11px] text-orange-600 space-y-1 list-disc list-inside">
                        <li>Worker positions update every 5 seconds when sharing is active</li>
                        <li>Grey icon means sharing is paused — shows last known position</li>
                        <li>Your location is captured once (you can update it anytime)</li>
                        <li>Tracking is available while the job is scheduled or active</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}