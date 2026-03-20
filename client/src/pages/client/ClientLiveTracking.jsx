// client/src/pages/client/ClientLiveTracking.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// NEW PAGE — Client watches booked worker's live location
//
// Route: /client/live-tracking/:jobId
//
// What it does:
//   - Polls GET /api/location/:jobId every 5 seconds
//   - Shows all assigned workers as moving pins on a map
//   - Shows client's own static pin (captured at booking time)
//   - Displays each worker's last-seen time, distance, sharing status
//   - Green "Live" badge when worker is actively sharing
//
// Add to your client routes in App.jsx / router:
//   <Route path="/client/live-tracking/:jobId" element={<ClientLiveTracking />} />
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LiveMap from '../../components/LiveMap';
import { getJobLocationData, initClientLocation } from '../../api';

const POLL_INTERVAL = 5000; // ms — refresh worker positions

// Haversine formula: distance in km between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
    const R  = 6371;
    const dL = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lng2 - lng1) * Math.PI) / 180;
    const a  = Math.sin(dL / 2) ** 2 +
               Math.cos((lat1 * Math.PI) / 180) *
               Math.cos((lat2 * Math.PI) / 180) *
               Math.sin(dl / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(dateStr) {
    if (!dateStr) return '—';
    const s = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (s < 10)  return 'just now';
    if (s < 60)  return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
}

export default function ClientLiveTracking() {
    const { jobId }  = useParams();
    const navigate   = useNavigate();

    const [locationData, setLocationData] = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [lastRefresh,  setLastRefresh]  = useState(null);

    // Client location capture state
    const [clientLocStatus, setClientLocStatus] = useState('idle'); // idle | capturing | captured | error
    const pollRef = useRef(null);

    // ── Fetch location snapshot from server ────────────────────────────────
    const fetchSnapshot = useCallback(async () => {
        try {
            const { data } = await getJobLocationData(jobId);
            setLocationData(data);
            setError('');
            setLastRefresh(new Date());
        } catch (err) {
            setError(err?.response?.data?.message || 'Could not load location data.');
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        fetchSnapshot();
        pollRef.current = setInterval(fetchSnapshot, POLL_INTERVAL);
        return () => clearInterval(pollRef.current);
    }, [fetchSnapshot]);

    // ── Capture client's static location once on page load ─────────────────
    useEffect(() => {
        // If no client location stored yet, capture it now
        if (!navigator.geolocation) return;

        const tryCapture = () => {
            setClientLocStatus('capturing');
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
                        } catch {}

                        await initClientLocation(
                            jobId,
                            pos.coords.latitude,
                            pos.coords.longitude,
                            address
                        );
                        setClientLocStatus('captured');
                        // Refresh snapshot so the client pin appears immediately
                        fetchSnapshot();
                    } catch {
                        setClientLocStatus('error');
                    }
                },
                () => setClientLocStatus('error'),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        };

        // Only capture if the snapshot shows no client location yet
        // We wait for the first snapshot before deciding
        const timer = setTimeout(() => {
            if (!locationData?.clientLocation?.lat) {
                tryCapture();
            } else {
                setClientLocStatus('captured');
            }
        }, 1500);

        return () => clearTimeout(timer);
    }, []); // eslint-disable-line — only run once

    // ── Derive map data ────────────────────────────────────────────────────
    const workers = locationData?.workers || [];
    const clientMarker = locationData?.clientLocation?.lat
        ? locationData.clientLocation
        : null;

    const workerMarkers = workers
        .filter(w => w.workerLocation?.lat && w.workerLocation?.lng)
        .map(w => ({
            lat:           w.workerLocation.lat,
            lng:           w.workerLocation.lng,
            accuracy:      w.workerLocation.accuracy,
            heading:       w.workerLocation.heading,
            speed:         w.workerLocation.speed,
            name:          w.workerName,
            photo:         w.workerPhoto,
            sharingActive: w.sharingActive,
        }));

    // Loading state
    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: 'sans-serif' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ width: 40, height: 40, border: '4px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'clt-spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                    <div style={{ color: '#6b7280', fontSize: 14 }}>Loading tracking data…</div>
                </div>
                <style>{`@keyframes clt-spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');`}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151', fontFamily: 'inherit' }}>
                    ← Back
                </button>
                <div style={{ flex: 1 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0 }}>
                        📍 Track Your Workers
                    </h1>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0', fontWeight: 500 }}>
                        Live map updates every 5 seconds
                    </p>
                </div>
                {lastRefresh && (
                    <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                        Updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                )}
            </div>

            {/* ── Error ── */}
            {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                    ⚠️ {error}
                </div>
            )}

            {/* ── No data yet ── */}
            {!locationData && !error && (
                <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 14, padding: '32px 24px', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📍</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 6 }}>No Tracking Data Yet</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                        Workers haven't started sharing their location. This page will auto-update every 5 seconds.
                    </div>
                </div>
            )}

            {/* ── Worker status cards ── */}
            {workers.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                    {workers.map((w, i) => {
                        const hasLoc = w.workerLocation?.lat && w.workerLocation?.lng;
                        const distKm = (hasLoc && clientMarker?.lat)
                            ? haversine(w.workerLocation.lat, w.workerLocation.lng, clientMarker.lat, clientMarker.lng)
                            : null;

                        return (
                            <div key={w.workerId?.toString() || i} style={{
                                background: '#fff',
                                border: `1.5px solid ${w.sharingActive ? '#bbf7d0' : '#e5e7eb'}`,
                                borderRadius: 14,
                                padding: '14px 16px',
                                flex: '1 1 220px',
                                minWidth: 0,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                    {w.workerPhoto
                                        ? <img src={w.workerPhoto} alt={w.workerName} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', border: '2px solid #fed7aa', flexShrink: 0 }} onError={e => { e.target.src = '/admin.png'; }} />
                                        : <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                            {(w.workerName || 'W')[0].toUpperCase()}
                                          </div>
                                    }
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {w.workerName || 'Worker'}
                                        </div>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2,
                                            background: w.sharingActive ? '#f0fdf4' : '#f9fafb',
                                            border: `1px solid ${w.sharingActive ? '#bbf7d0' : '#e5e7eb'}`,
                                            borderRadius: 99, padding: '2px 8px',
                                        }}>
                                            <div style={{
                                                width: 6, height: 6, borderRadius: '50%',
                                                background: w.sharingActive ? '#22c55e' : '#9ca3af',
                                                animation: w.sharingActive ? 'clt-pulse 1.5s infinite' : 'none',
                                            }} />
                                            <span style={{ fontSize: 10, fontWeight: 700, color: w.sharingActive ? '#15803d' : '#6b7280' }}>
                                                {w.sharingActive ? 'Live' : 'Paused'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.8 }}>
                                    {w.workerMobile && (
                                        <a href={`tel:${w.workerMobile}`} style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none', display: 'block' }}>
                                            📞 {w.workerMobile}
                                        </a>
                                    )}
                                    {hasLoc && (
                                        <div>📌 {w.workerLocation.lat.toFixed(4)}, {w.workerLocation.lng.toFixed(4)}</div>
                                    )}
                                    {distKm !== null && (
                                        <div>📏 {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`} from site</div>
                                    )}
                                    {w.workerLocation?.speed > 0 && (
                                        <div>🚗 {(w.workerLocation.speed * 3.6).toFixed(1)} km/h</div>
                                    )}
                                    {w.workerLocation?.updatedAt && (
                                        <div>🕐 {timeAgo(w.workerLocation.updatedAt)}</div>
                                    )}
                                    {!hasLoc && (
                                        <div style={{ color: '#f97316', fontWeight: 600 }}>⏳ Waiting for worker to share location…</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Map ── */}
            <div style={{ marginBottom: 16 }}>
                <LiveMap
                    workerMarkers={workerMarkers}
                    clientMarker={clientMarker}
                    height="460px"
                    showAccuracy={true}
                />
            </div>

            {/* ── Legend ── */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#f97316', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Worker position (live)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#9ca3af', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Worker position (sharing paused)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Your location (static)</span>
                </div>
            </div>

            {/* ── Client location capture status ── */}
            {clientLocStatus === 'capturing' && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '10px 16px', marginBottom: 12, fontSize: 12, color: '#1d4ed8', fontWeight: 600 }}>
                    📡 Capturing your location to show workers where to go…
                </div>
            )}
            {clientLocStatus === 'error' && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 16px', marginBottom: 12, fontSize: 12, color: '#c2410c' }}>
                    ⚠️ Could not capture your location. Workers will navigate using the job address on file.
                </div>
            )}

            {/* ── Info ── */}
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>ℹ️ About Live Tracking</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#9a3412', lineHeight: 1.7 }}>
                    <li>Worker positions update every 5 seconds when they are actively sharing</li>
                    <li>A grey icon means the worker has paused sharing — their last known position is shown</li>
                    <li>Your pin is static — it was captured once when you opened this page</li>
                    <li>Tracking is only available while the job is scheduled or running</li>
                </ul>
            </div>

            <style>{`
                @keyframes clt-pulse {
                    0%, 100% { box-shadow: 0 0 0 2px rgba(34,197,94,0.3); }
                    50%       { box-shadow: 0 0 0 5px rgba(34,197,94,0.0); }
                }
                @keyframes clt-spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}