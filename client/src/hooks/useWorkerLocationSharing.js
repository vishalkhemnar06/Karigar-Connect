// client/src/hooks/useWorkerLocationSharing.js
// ═══════════════════════════════════════════════════════════════════════════════
// Custom React hook that:
//   1. Requests Geolocation permission from the browser
//   2. Watches the worker's position continuously with watchPosition()
//   3. POSTs the position to the server every UPDATE_INTERVAL ms
//   4. Returns status, coords, error, and control functions
//
// Usage in WorkerLiveTracking.jsx and WorkerDashboard.jsx:
//   const { sharing, coords, permError, startSharing, stopSharing } =
//       useWorkerLocationSharing(jobId);
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import { updateWorkerLocation, toggleWorkerLocationSharing } from '../api';

const UPDATE_INTERVAL  = 5000;   // send to server every 5 seconds
const GEO_OPTIONS = {
    enableHighAccuracy: true,
    timeout:            15000,
    maximumAge:         2000,
};

export default function useWorkerLocationSharing(jobId) {
    const [sharing,   setSharing]   = useState(false);
    const [coords,    setCoords]    = useState(null);   // { lat, lng, accuracy, heading, speed }
    const [permError, setPermError] = useState('');     // '' | permission denied msg
    const [serverErr, setServerErr] = useState('');

    const watchIdRef      = useRef(null);
    const sendTimerRef    = useRef(null);
    const latestCoordsRef = useRef(null);  // always holds freshest position
    const activeRef       = useRef(false); // avoids stale closure issues

    // ── Send latest position to server ──────────────────────────────────────
    const sendPosition = useCallback(async () => {
        if (!activeRef.current || !latestCoordsRef.current || !jobId) return;
        try {
            await updateWorkerLocation(
                jobId,
                latestCoordsRef.current.lat,
                latestCoordsRef.current.lng,
                {
                    accuracy: latestCoordsRef.current.accuracy,
                    heading:  latestCoordsRef.current.heading,
                    speed:    latestCoordsRef.current.speed,
                }
            );
            setServerErr('');
        } catch (err) {
            setServerErr(err?.response?.data?.message || 'Could not reach server.');
        }
    }, [jobId]);

    // ── Start sharing ────────────────────────────────────────────────────────
    const startSharing = useCallback(() => {
        if (!jobId) { setPermError('No job ID provided.'); return; }
        if (!navigator.geolocation) {
            setPermError('Geolocation is not supported by your browser.');
            return;
        }

        setPermError('');
        setServerErr('');
        activeRef.current = true;

        // Watch GPS position continuously
        watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                const c = {
                    lat:      pos.coords.latitude,
                    lng:      pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    heading:  pos.coords.heading,
                    speed:    pos.coords.speed,
                };
                latestCoordsRef.current = c;
                setCoords(c);
            },
            (err) => {
                let msg = 'Location permission denied.';
                if (err.code === 1) msg = 'Location permission denied. Please allow location access to share your position.';
                if (err.code === 2) msg = 'Location unavailable. Check device GPS settings.';
                if (err.code === 3) msg = 'Location request timed out.';
                setPermError(msg);
                setSharing(false);
                activeRef.current = false;
            },
            GEO_OPTIONS
        );

        // Interval that sends to server every UPDATE_INTERVAL ms
        sendTimerRef.current = setInterval(sendPosition, UPDATE_INTERVAL);
        setSharing(true);

        // Also notify server immediately
        toggleWorkerLocationSharing(jobId, true).catch(() => {});
    }, [jobId, sendPosition]);

    // ── Stop sharing ─────────────────────────────────────────────────────────
    const stopSharing = useCallback(() => {
        activeRef.current = false;
        setSharing(false);

        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
        if (sendTimerRef.current !== null) {
            clearInterval(sendTimerRef.current);
            sendTimerRef.current = null;
        }
        if (jobId) {
            toggleWorkerLocationSharing(jobId, false).catch(() => {});
        }
    }, [jobId]);

    // ── Cleanup on unmount or jobId change ────────────────────────────────────
    useEffect(() => {
        return () => {
            activeRef.current = false;
            if (watchIdRef.current !== null)   navigator.geolocation.clearWatch(watchIdRef.current);
            if (sendTimerRef.current !== null)  clearInterval(sendTimerRef.current);
        };
    }, []);

    return {
        sharing,
        coords,
        permError,
        serverErr,
        startSharing,
        stopSharing,
    };
}