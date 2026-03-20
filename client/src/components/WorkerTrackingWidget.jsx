// client/src/components/WorkerTrackingWidget.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// Small widget shown on WorkerDashboard when the worker has scheduled/running jobs.
// Shows: job title, sharing status toggle, mini-map with worker's own pin.
//
// ADD this import + usage to WorkerDashboard.jsx (see instructions at bottom).
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useWorkerLocationSharing from '../hooks/useWorkerLocationSharing';
import { getWorkerTrackingJobs } from '../api';

// Inline minimal map for the widget (avoids loading full LiveMap)
let _L2 = null;
const loadLeaflet2 = async () => {
    if (_L2) return _L2;
    const mod = await import('leaflet');
    _L2 = mod.default || mod;
    if (!document.getElementById('leaflet-css-widget')) {
        const lnk   = document.createElement('link');
        lnk.id      = 'leaflet-css-widget';
        lnk.rel     = 'stylesheet';
        lnk.href    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(lnk);
    }
    return _L2;
};

// A tiny map showing only the worker's own dot
function MiniWorkerMap({ lat, lng }) {
    const ref    = useRef(null);
    const mapRef = useRef(null);
    const mkRef  = useRef(null);

    useEffect(() => {
        if (!lat || !lng) return;
        let alive = true;
        loadLeaflet2().then(L => {
            if (!alive || !ref.current) return;
            if (!mapRef.current) {
                const m = L.map(ref.current, { zoomControl: false, dragging: false, scrollWheelZoom: false, attributionControl: false })
                    .setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(m);
                const icon = L.divIcon({
                    className: '',
                    html: `<div style="width:16px;height:16px;background:#f97316;border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);"></div>`,
                    iconSize: [16, 16], iconAnchor: [8, 8],
                });
                mkRef.current  = L.marker([lat, lng], { icon }).addTo(m);
                mapRef.current = m;
            } else {
                mapRef.current.setView([lat, lng], 15);
                mkRef.current?.setLatLng([lat, lng]);
            }
        });
        return () => { alive = false; };
    }, [lat, lng]);

    useEffect(() => {
        return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
    }, []);

    return <div ref={ref} style={{ width: '100%', height: 120, borderRadius: 10, overflow: 'hidden' }} />;
}

// ── Per-job sharing card ──────────────────────────────────────────────────────
function JobSharingCard({ trackingJob }) {
    const navigate = useNavigate();
    const jobId    = trackingJob.job?._id;
    const { sharing, coords, permError, startSharing, stopSharing } = useWorkerLocationSharing(jobId);

    // Auto start sharing when card mounts (user can toggle off)
    useEffect(() => {
        startSharing();
        return () => stopSharing();
    }, []); // eslint-disable-line

    return (
        <div style={{
            background: '#fff',
            border: `1.5px solid ${sharing ? '#bbf7d0' : '#fed7aa'}`,
            borderRadius: 14,
            overflow: 'hidden',
            transition: 'border-color 0.2s',
        }}>
            <div style={{ background: sharing ? '#f0fdf4' : '#fff7ed', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                        {trackingJob.job?.title || 'Job'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: sharing ? '#22c55e' : '#f97316',
                            animation: sharing ? 'wtw-pulse 1.5s infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: sharing ? '#15803d' : '#c2410c' }}>
                            {sharing ? 'Sharing Live Location' : 'Sharing Off'}
                        </span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={sharing ? stopSharing : startSharing}
                        style={{
                            background: sharing ? '#ef4444' : '#22c55e',
                            color: '#fff', border: 'none', borderRadius: 8,
                            padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {sharing ? '⏹ Stop' : '▶ Share'}
                    </button>
                    <button
                        onClick={() => navigate(`/worker/live-tracking/${jobId}`)}
                        style={{
                            background: '#f97316', color: '#fff', border: 'none', borderRadius: 8,
                            padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        📍 View
                    </button>
                </div>
            </div>

            {/* Mini map */}
            {coords && (
                <div style={{ padding: '0 12px 12px' }}>
                    <MiniWorkerMap lat={coords.lat} lng={coords.lng} />
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textAlign: 'center' }}>
                        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                        {coords.accuracy ? ` · ±${Math.round(coords.accuracy)}m` : ''}
                    </div>
                </div>
            )}

            {/* No GPS yet */}
            {sharing && !coords && (
                <div style={{ padding: '8px 14px 12px', textAlign: 'center', fontSize: 12, color: '#6b7280' }}>
                    <div style={{ width: 18, height: 18, border: '2px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'wtw-spin 0.8s linear infinite', display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
                    Acquiring GPS…
                </div>
            )}

            {/* Permission error */}
            {permError && (
                <div style={{ padding: '8px 14px 12px', fontSize: 11, color: '#dc2626' }}>
                    ⚠️ {permError}
                </div>
            )}
        </div>
    );
}

// ── Main exported widget ──────────────────────────────────────────────────────
export default function WorkerTrackingWidget() {
    const [trackingJobs, setTrackingJobs] = useState([]);
    const [loading,      setLoading]      = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await getWorkerTrackingJobs();
                // Only show scheduled / running jobs
                const active = (data || []).filter(t =>
                    ['scheduled', 'running'].includes(t.job?.status)
                );
                setTrackingJobs(active);
            } catch {}
            finally { setLoading(false); }
        })();
    }, []);

    if (loading || trackingJobs.length === 0) return null;

    return (
        <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>
                📍 Location Sharing — Active Jobs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {trackingJobs.map((tj, i) => (
                    <JobSharingCard key={tj.locationId?.toString() || i} trackingJob={tj} />
                ))}
            </div>
            <style>{`
                @keyframes wtw-pulse { 0%,100%{box-shadow:0 0 0 2px rgba(34,197,94,.25);} 50%{box-shadow:0 0 0 5px rgba(34,197,94,.0);} }
                @keyframes wtw-spin  { to{transform:rotate(360deg);} }
            `}</style>
        </div>
    );
}

/*
═══════════════════════════════════════════════════════════════════════════════
HOW TO ADD WorkerTrackingWidget to WorkerDashboard.jsx:

1. Import at the top of WorkerDashboard.jsx:
       import WorkerTrackingWidget from '../../components/WorkerTrackingWidget';

2. Add the widget inside the return JSX, AFTER the "Stats row 2" section
   and BEFORE the "Profile snapshot" section:

       {/* ── Location Tracking Widget ── * /}
       <WorkerTrackingWidget />

That's it. The widget is self-contained and only renders when there are
active jobs with tracking sessions.
═══════════════════════════════════════════════════════════════════════════════
*/