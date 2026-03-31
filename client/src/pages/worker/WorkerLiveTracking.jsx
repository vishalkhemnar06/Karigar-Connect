// client/src/pages/worker/WorkerLiveTracking.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// NEW PAGE — Worker's live tracking view
//
// Route: /worker/live-tracking/:jobId
//
// What it does:
//   - Requests GPS permission from the worker's device
//   - Continuously watches the worker's position with watchPosition()
//   - Sends position to server every 5 seconds via PUT /api/location/worker/update
//   - Shows the worker's own live pin on a map
//   - Shows the client's static pin on the same map
//   - Displays sharing status badge, accuracy info, and toggle button
//
// Add to your worker routes in App.jsx / router:
//   <Route path="/worker/live-tracking/:jobId" element={<WorkerLiveTracking />} />
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LiveMap from '../../components/LiveMap';
import useWorkerLocationSharing from '../../hooks/useWorkerLocationSharing';
import { getJobLocationData } from '../../api';

export default function WorkerLiveTracking() {
    const { jobId }  = useParams();
    const navigate   = useNavigate();

    // Sharing hook
    const {
        sharing,
        coords,
        permError,
        serverErr,
        startSharing,
        stopSharing,
    } = useWorkerLocationSharing(jobId);

    // Server snapshot (for client's static location)
    const [locationData, setLocationData]  = useState(null);
    const [loadingSnap,  setLoadingSnap]   = useState(true);
    const [snapError,    setSnapError]     = useState('');
    const pollRef = useRef(null);

    // Fetch location snapshot every 5 s to get latest data
    const fetchSnapshot = useCallback(async () => {
        try {
            const { data } = await getJobLocationData(jobId);
            setLocationData(data);
            setSnapError('');
        } catch (err) {
            setSnapError(err?.response?.data?.message || 'Could not load location data.');
        } finally {
            setLoadingSnap(false);
        }
    }, [jobId]);

    useEffect(() => {
        fetchSnapshot();
        pollRef.current = setInterval(fetchSnapshot, 5000);
        return () => clearInterval(pollRef.current);
    }, [fetchSnapshot]);

    // Automatically start sharing when page loads (prompt for permission)
    useEffect(() => {
        startSharing();
        return () => stopSharing();
    }, []); // eslint-disable-line

    // Build worker marker for current user's own position
    const myWorkerMarker = coords
        ? [{
            lat:          coords.lat,
            lng:          coords.lng,
            accuracy:     coords.accuracy,
            heading:      coords.heading,
            speed:        coords.speed,
            name:         'You',
            sharingActive: sharing,
          }]
        : [];

    const clientMarker = locationData?.clientLocation?.lat
        ? locationData.clientLocation
        : null;

    return (
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px', fontFamily: 'Inter, sans-serif' }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');`}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151', fontFamily: 'inherit' }}>
                    ← Back
                </button>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 900, color: '#111827', margin: 0 }}>
                        📍 Live Location Sharing
                    </h1>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0', fontWeight: 500 }}>
                        Your location is being shared with the client
                    </p>
                </div>
            </div>

            {/* ── Sharing Status Banner ── */}
            <div style={{
                background: sharing ? '#f0fdf4' : '#fef2f2',
                border: `1.5px solid ${sharing ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 14,
                padding: '14px 18px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: sharing ? '#22c55e' : '#ef4444',
                        boxShadow: sharing ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
                        animation: sharing ? 'wlt-pulse 1.5s infinite' : 'none',
                    }} />
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: sharing ? '#15803d' : '#dc2626' }}>
                            {sharing ? '🟢 Sharing Live Location' : '🔴 Location Sharing Off'}
                        </div>
                        {coords && sharing && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                                {coords.accuracy ? ` · ±${Math.round(coords.accuracy)}m` : ''}
                                {coords.speed    ? ` · ${(coords.speed * 3.6).toFixed(1)} km/h` : ''}
                            </div>
                        )}
                    </div>
                </div>
                <button
                    onClick={sharing ? stopSharing : startSharing}
                    style={{
                        background: sharing ? '#ef4444' : '#22c55e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '9px 18px',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        transition: 'opacity 0.15s',
                    }}>
                    {sharing ? '⏹ Stop Sharing' : '▶ Start Sharing'}
                </button>
            </div>

            {/* ── Errors ── */}
            {permError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                    ⚠️ {permError}
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 400 }}>
                        Go to your browser settings → Site Settings → Location → Allow
                    </div>
                </div>
            )}
            {serverErr && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#c2410c' }}>
                    ⚠️ {serverErr}
                </div>
            )}
            {snapError && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#c2410c' }}>
                    ⚠️ {snapError}
                </div>
            )}

            {/* ── Map ── */}
            <div style={{ marginBottom: 16 }}>
                <LiveMap
                    workerMarkers={myWorkerMarker}
                    clientMarker={clientMarker}
                    height="420px"
                    showAccuracy={true}
                />
            </div>

            {/* ── Legend ── */}
            <div style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 14,
                padding: '14px 18px',
                marginBottom: 16,
                display: 'flex',
                gap: 20,
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#f97316', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Your position (live)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#3b82f6', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Client location (static)</span>
                </div>
            </div>

            {/* ── Client location info ── */}
            {clientMarker && (
                <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 14, padding: '14px 18px', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                        📍 Client Job Site
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
                        {clientMarker.address || `${clientMarker.lat?.toFixed(5)}, ${clientMarker.lng?.toFixed(5)}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                        This is the job location — navigate here to reach the client's site
                    </div>
                </div>
            )}

            {/* ── Info card ── */}
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: '14px 18px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>ℹ️ How this works</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#9a3412', lineHeight: 1.7 }}>
                    <li>Your live position is sent to the client every 5 seconds while sharing is ON</li>
                    <li>The client can see your pin moving on their map in real time</li>
                    <li>You can pause sharing at any time — the client will see your last known position</li>
                    <li>Sharing stops automatically when your browser tab is closed</li>
                </ul>
            </div>

            <style>{`
                @keyframes wlt-pulse {
                    0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.25); }
                    50%       { box-shadow: 0 0 0 6px rgba(34,197,94,0.10); }
                }
            `}</style>
        </div>
    );
}