// client/src/components/LiveMap.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// Shared map component used by both:
//   - ClientLiveTracking.jsx  (client watches worker move)
//   - WorkerLiveTracking.jsx  (worker sees himself + client's static pin)
//
// Props:
//   workerMarkers  — array of { lat, lng, name, photo, heading, accuracy, sharingActive }
//   clientMarker   — { lat, lng, address } | null
//   height         — string CSS height, default '420px'
//   showAccuracy   — bool, draw accuracy circle around worker, default true
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';

// Lazy-load Leaflet only when the component mounts (avoids SSR issues)
let _L = null;
const loadLeaflet = async () => {
    if (_L) return _L;
    const mod = await import('leaflet');
    _L = mod.default || mod;
    if (!document.getElementById('leaflet-css-livemap')) {
        const link   = document.createElement('link');
        link.id      = 'leaflet-css-livemap';
        link.rel     = 'stylesheet';
        link.href    = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
    }
    return _L;
};

// Build a coloured div-icon for Leaflet
const makeIcon = (L, colour, emoji, label, size = 38) => L.divIcon({
    className: '',
    iconSize:  [size, size + 8],
    iconAnchor:[size / 2, size + 8],
    popupAnchor: [0, -(size + 8)],
    html: `
        <div style="
            position:relative;
            width:${size}px;
            text-align:center;
        ">
            <div style="
                width:${size}px;
                height:${size}px;
                background:${colour};
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                border:3px solid #fff;
                box-shadow:0 3px 12px rgba(0,0,0,.35);
                display:flex;
                align-items:center;
                justify-content:center;
            ">
                <span style="transform:rotate(45deg);font-size:${Math.round(size * 0.45)}px;line-height:1;">${emoji}</span>
            </div>
            ${label ? `<div style="
                margin-top:3px;
                background:${colour};
                color:#fff;
                font-size:9px;
                font-weight:800;
                border-radius:6px;
                padding:1px 4px;
                white-space:nowrap;
                max-width:72px;
                overflow:hidden;
                text-overflow:ellipsis;
                text-align:center;
                box-shadow:0 1px 4px rgba(0,0,0,.2);
            ">${label}</div>` : ''}
        </div>
    `,
});

const WORKER_COLOUR = '#f97316';
const CLIENT_COLOUR = '#3b82f6';

export default function LiveMap({
    workerMarkers = [],
    clientMarker  = null,
    height        = '420px',
    showAccuracy  = true,
}) {
    const containerRef   = useRef(null);
    const mapRef         = useRef(null);
    const workerRefsMap  = useRef({});   // key: index → { marker, circle }
    const clientRef      = useRef(null);
    const [ready, setReady] = useState(false);

    // ── Initialise map once ──────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;
        loadLeaflet().then(L => {
            if (!alive || !containerRef.current || mapRef.current) return;

            // Default centre: India geographic centre
            const defaultLat = clientMarker?.lat || workerMarkers[0]?.lat || 20.5937;
            const defaultLng = clientMarker?.lng || workerMarkers[0]?.lng || 78.9629;
            const defaultZoom = clientMarker?.lat || workerMarkers[0]?.lat ? 14 : 5;

            const map = L.map(containerRef.current, {
                zoomControl:      true,
                scrollWheelZoom:  true,
                attributionControl: true,
            }).setView([defaultLat, defaultLng], defaultZoom);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
                maxZoom: 19,
            }).addTo(map);

            mapRef.current = map;
            setReady(true);
        });

        return () => {
            alive = false;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                workerRefsMap.current = {};
                clientRef.current     = null;
            }
        };
    }, []); // eslint-disable-line

    // ── Sync worker markers whenever workerMarkers prop changes ─────────────
    useEffect(() => {
        if (!ready || !mapRef.current) return;
        const L   = _L;
        const map = mapRef.current;

        workerMarkers.forEach((w, idx) => {
            if (!w.lat || !w.lng) return;

            const existing = workerRefsMap.current[idx];
            const icon     = makeIcon(
                L,
                w.sharingActive ? WORKER_COLOUR : '#9ca3af',
                '🧑‍🔧',
                w.name ? w.name.split(' ')[0] : 'Worker',
            );

            const popupContent = `
                <div style="font-family:sans-serif;min-width:150px;">
                    <div style="font-weight:800;color:#111827;margin-bottom:4px;">${w.name || 'Worker'}</div>
                    <div style="font-size:11px;color:#6b7280;">
                        ${w.sharingActive
                            ? `<span style="color:#16a34a;font-weight:700;">● Live</span>`
                            : `<span style="color:#9ca3af;">● Sharing paused</span>`}
                    </div>
                    ${w.accuracy ? `<div style="font-size:10px;color:#9ca3af;margin-top:2px;">Accuracy: ±${Math.round(w.accuracy)}m</div>` : ''}
                    ${w.speed    ? `<div style="font-size:10px;color:#9ca3af;">Speed: ${(w.speed * 3.6).toFixed(1)} km/h</div>` : ''}
                </div>
            `;

            if (existing) {
                existing.marker.setLatLng([w.lat, w.lng]);
                existing.marker.setIcon(icon);
                existing.marker.getPopup()?.setContent(popupContent);

                if (showAccuracy && w.accuracy && existing.circle) {
                    existing.circle.setLatLng([w.lat, w.lng]);
                    existing.circle.setRadius(w.accuracy);
                } else if (showAccuracy && w.accuracy && !existing.circle) {
                    const circle = L.circle([w.lat, w.lng], {
                        radius: w.accuracy, color: WORKER_COLOUR,
                        fillColor: WORKER_COLOUR, fillOpacity: 0.08, weight: 1,
                    }).addTo(map);
                    workerRefsMap.current[idx] = { ...existing, circle };
                }
            } else {
                const marker = L.marker([w.lat, w.lng], { icon })
                    .addTo(map)
                    .bindPopup(popupContent);

                let circle = null;
                if (showAccuracy && w.accuracy) {
                    circle = L.circle([w.lat, w.lng], {
                        radius: w.accuracy, color: WORKER_COLOUR,
                        fillColor: WORKER_COLOUR, fillOpacity: 0.08, weight: 1,
                    }).addTo(map);
                }
                workerRefsMap.current[idx] = { marker, circle };
            }
        });

        // Auto-fit bounds if we have both client and workers
        const allPoints = [];
        if (clientMarker?.lat) allPoints.push([clientMarker.lat, clientMarker.lng]);
        workerMarkers.forEach(w => { if (w.lat) allPoints.push([w.lat, w.lng]); });
        if (allPoints.length >= 2) {
            try { map.fitBounds(allPoints, { padding: [50, 50], maxZoom: 16 }); } catch {}
        } else if (allPoints.length === 1) {
            map.setView(allPoints[0], 15);
        }
    }, [ready, workerMarkers, showAccuracy]); // eslint-disable-line

    // ── Sync client marker (static — only placed once, never moved) ──────────
    useEffect(() => {
        if (!ready || !mapRef.current || !clientMarker?.lat || !clientMarker?.lng) return;
        const L   = _L;
        const map = mapRef.current;

        if (!clientRef.current) {
            const icon = makeIcon(L, CLIENT_COLOUR, '🏠', 'Client', 36);
            const popup = `
                <div style="font-family:sans-serif;min-width:140px;">
                    <div style="font-weight:800;color:#1d4ed8;margin-bottom:3px;">📍 Client Location</div>
                    <div style="font-size:11px;color:#6b7280;">${clientMarker.address || 'Job site'}</div>
                    <div style="font-size:10px;color:#9ca3af;margin-top:2px;">Static — captured at booking</div>
                </div>
            `;
            clientRef.current = L.marker([clientMarker.lat, clientMarker.lng], { icon })
                .addTo(map)
                .bindPopup(popup);
        }
        // NOTE: We intentionally do NOT update clientRef position — it is static.
    }, [ready, clientMarker]);

    return (
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #e5e7eb' }}>
            <div ref={containerRef} style={{ width: '100%', height }} />
            {!ready && (
                <div style={{
                    position: 'absolute', inset: 0, background: '#f9fafb',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                    <div style={{ width: 32, height: 32, border: '3px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'lm-spin 0.8s linear infinite' }} />
                    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>Loading map…</span>
                </div>
            )}
            <style>{`@keyframes lm-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}