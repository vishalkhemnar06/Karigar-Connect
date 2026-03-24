// client/src/pages/auth/FaceVerification.jsx
// Liveness detection using MediaPipe Face Mesh (loaded from CDN — no Vite issues).
// Challenges: LOOK_STRAIGHT → BLINK → LOOK_FINAL (auto-capture)
//
// Props:
//   onComplete(result) — called when all challenges pass
//     result: { photoDataUrl: string, livenessScore: number }
//   onCancel() — user dismissed
//   title — heading text (default "Identity Verification")
//   subtitle — subheading text

import { useState, useEffect, useRef, useCallback } from 'react';

// ── MediaPipe eye landmark indices (Face Mesh 468 points) ────────────────────
const LEFT_EYE  = [362, 385, 387, 263, 373, 380]; // outer,top-out,top-in,inner,bot-in,bot-out
const RIGHT_EYE = [33,  160, 158, 133, 153, 144];
const NOSE_TIP  = 1;
const L_EYE_OUT = 33;
const R_EYE_OUT = 263;

// ── Challenge definitions ─────────────────────────────────────────────────────
const CHALLENGES = [
    {
        id:          'LOOK',
        label:       'Look straight at the camera',
        instruction: 'Position your face in the oval and look directly at the camera',
        icon:        '👁️',
        durationMs:  2000,   // must hold for 2s
        type:        'hold',
    },
    {
        id:          'BLINK',
        label:       'Blink your eyes',
        instruction: 'Slowly blink both eyes once',
        icon:        '😉',
        durationMs:  0,
        type:        'event',
    },
    {
        id:          'LOOK_FINAL',
        label:       'Return to front and hold',
        instruction: 'Your face is now captured. Hold still for verification',
        icon:        '📸',
        durationMs:  1200,
        type:        'hold',
    },
];

const CHALLENGE_TIMEOUT_MS = 15_000; // 15 seconds per challenge
const EAR_BLINK_THRESHOLD  = 0.20;
const HEAD_TURN_THRESHOLD  = 0.05; // normalised nose offset

// ── Geometry helpers ─────────────────────────────────────────────────────────
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const calcEAR = (lm, indices) => {
    const p = indices.map(i => lm[i]);
    const ver = (dist(p[1], p[5]) + dist(p[2], p[4])) / 2;
    const hor = dist(p[0], p[3]);
    return hor < 0.001 ? 1 : ver / hor;
};

const calcNoseOffset = (lm) => {
    const cx   = (lm[L_EYE_OUT].x + lm[R_EYE_OUT].x) / 2;
    return lm[NOSE_TIP].x - cx;
};

// ── Data-URL → Blob ───────────────────────────────────────────────────────────
export const dataURLtoBlob = (dataUrl) => {
    const [header, data] = dataUrl.split(',');
    const mime   = header.match(/:(.*?);/)[1];
    const bytes  = atob(data);
    const arr    = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function FaceVerification({
    onComplete,
    onCancel,
    title    = 'Identity Verification',
    subtitle = 'Complete these steps to verify your identity',
}) {
    const videoRef    = useRef(null);
    const canvasRef   = useRef(null);
    const streamRef   = useRef(null);
    const fmRef       = useRef(null);   // FaceMesh instance
    const rafRef      = useRef(null);   // requestAnimationFrame id
    const timerRef    = useRef(null);   // per-challenge timeout
    const captureRef  = useRef(null);   // always-current captureAndFinish fn

    const [status,           setStatus]          = useState('loading');   // loading|running|done|error
    const [challengeIdx,     setChallengeIdx]     = useState(0);
    const [progress,         setProgress]         = useState([]);         // completed challenge ids
    const [faceDetected,     setFaceDetected]     = useState(false);
    const [holdStart,        setHoldStart]        = useState(null);       // ms timestamp
    const [holdPct,          setHoldPct]          = useState(0);
    const [errorMsg,         setErrorMsg]         = useState('');
    const [capturedPhoto,    setCapturedPhoto]    = useState(null);
    const [restartTick,      setRestartTick]      = useState(0);

    const challengeIdxRef = useRef(0);
    const holdStartRef    = useRef(null);
    const progressRef     = useRef([]);

    // Keep refs in sync with state
    useEffect(() => { challengeIdxRef.current = challengeIdx; }, [challengeIdx]);
    useEffect(() => { holdStartRef.current    = holdStart;    }, [holdStart]);
    useEffect(() => { progressRef.current     = progress;     }, [progress]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            cancelAnimationFrame(rafRef.current);
            clearTimeout(timerRef.current);
            stopCamera();
        };
    }, []);

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    // ── Load MediaPipe + start camera ─────────────────────────────────────────
    useEffect(() => {
        let alive = true;

        const init = async () => {
            try {
                // 1. Load MediaPipe face_mesh from CDN (safe for all bundlers)
                await loadMediaPipeFaceMesh();
                if (!alive) return;

                // 2. Start camera
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: 'user' },
                    audio: false,
                });
                if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
                streamRef.current = stream;

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }

                // 3. Create FaceMesh instance
                const faceMesh = new window.FaceMesh({
                    locateFile: (file) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
                });
                faceMesh.setOptions({
                    maxNumFaces:         1,
                    refineLandmarks:     true,
                    minDetectionConfidence: 0.7,
                    minTrackingConfidence:  0.6,
                });
                faceMesh.onResults(handleResults);
                await faceMesh.initialize();
                fmRef.current = faceMesh;
                if (!alive) return;

                setStatus('running');
                startChallengeTimer(0);
                processLoop();

            } catch (err) {
                if (!alive) return;
                if (err.name === 'NotAllowedError') {
                    setErrorMsg('Camera access denied. Please allow camera access in your browser settings.');
                } else {
                    setErrorMsg('Could not start camera. Please ensure you have a working webcam.');
                }
                setStatus('error');
            }
        };

        init();
        return () => { alive = false; };
    }, [restartTick]);

    // ── Animation loop: send video frames to MediaPipe ────────────────────────
    const processLoop = useCallback(() => {
        const tick = async () => {
            if (fmRef.current && videoRef.current && videoRef.current.readyState >= 2) {
                try { await fmRef.current.send({ image: videoRef.current }); } catch {}
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    // ── MediaPipe results handler ─────────────────────────────────────────────
    const handleResults = useCallback((results) => {
        const canvas = canvasRef.current;
        const video  = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;

        // Draw mirrored video
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        const lm = results.multiFaceLandmarks?.[0];
        if (!lm) {
            setFaceDetected(false);
            holdStartRef.current = null;
            setHoldStart(null);
            setHoldPct(0);
            drawOverlay(ctx, canvas, false, null, null);
            return;
        }

        setFaceDetected(true);

        const leftEAR   = calcEAR(lm, LEFT_EYE);
        const rightEAR  = calcEAR(lm, RIGHT_EYE);
        const avgEAR    = (leftEAR + rightEAR) / 2;
        const noseOff   = calcNoseOffset(lm);

        const isFrontFacing = Math.abs(noseOff) < HEAD_TURN_THRESHOLD && avgEAR > EAR_BLINK_THRESHOLD + 0.02;

        const idx       = challengeIdxRef.current;
        const challenge = CHALLENGES[idx];
        if (!challenge || status === 'done') return;

        let conditionMet = false;

        switch (challenge.id) {
            case 'LOOK':
            case 'LOOK_FINAL':
                conditionMet = isFrontFacing;
                break;
            case 'BLINK':
                conditionMet = avgEAR < EAR_BLINK_THRESHOLD;
                break;
        }

        let newPct = 0;

        if (conditionMet) {
            if (!holdStartRef.current) {
                holdStartRef.current = Date.now();
                setHoldStart(Date.now());
            }
            const elapsed = Date.now() - holdStartRef.current;
            const needed  = challenge.durationMs || 300;
            newPct        = Math.min(100, (elapsed / needed) * 100);
            setHoldPct(newPct);

            if (elapsed >= (challenge.durationMs || 300)) {
                advanceChallenge(idx);
            }
        } else {
            // Reset hold for this challenge (unless it was an event-type already fired)
            holdStartRef.current = null;
            setHoldStart(null);
            setHoldPct(0);
        }

        drawOverlay(ctx, canvas, true, noseOff, avgEAR);
    }, [status]);

    // ── Advance to next challenge / finish ────────────────────────────────────
    const advanceChallenge = useCallback((completedIdx) => {
        clearTimeout(timerRef.current);

        const done = [...progressRef.current, CHALLENGES[completedIdx].id];
        progressRef.current = done;
        setProgress(done);
        holdStartRef.current = null;
        setHoldStart(null);
        setHoldPct(0);

        const next = completedIdx + 1;
        if (next >= CHALLENGES.length) {
            // All challenges passed — auto-capture immediately
            captureRef.current?.();
        } else {
            setChallengeIdx(next);
            challengeIdxRef.current = next;
            startChallengeTimer(next);
        }
    }, []);

    const startChallengeTimer = (idx) => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setErrorMsg(`Time's up for "${CHALLENGES[idx].label}". Please try again.`);
            setStatus('error');
        }, CHALLENGE_TIMEOUT_MS);
    };

    // ── Capture final photo (called automatically after all challenges pass) ──
    const captureAndFinish = () => {
        cancelAnimationFrame(rafRef.current);
        clearTimeout(timerRef.current);
        setStatus('done');

        const v = videoRef.current;
        if (!v) return;
        const cap = document.createElement('canvas');
        cap.width  = v.videoWidth  || 640;
        cap.height = v.videoHeight || 480;
        const ctx  = cap.getContext('2d');
        // Capture actual (non-mirrored) frame for backend
        ctx.drawImage(v, 0, 0, cap.width, cap.height);
        const dataUrl = cap.toDataURL('image/jpeg', 0.92);
        setCapturedPhoto(dataUrl);
        stopCamera();
        onComplete({ photoDataUrl: dataUrl, livenessScore: 1.0 });
    };
    // Keep ref current so stable callbacks (advanceChallenge) can call it
    captureRef.current = captureAndFinish;

    // ── Overlay drawing ───────────────────────────────────────────────────────
    const drawOverlay = (ctx, canvas, detected, noseOff, ear) => {
        // Oval guide
        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        const rx = canvas.width  * 0.27;
        const ry = canvas.height * 0.42;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = detected ? '#22c55e' : '#f97316';
        ctx.lineWidth   = 3;
        ctx.stroke();

        // Semi-transparent outside oval
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip('evenodd');
        ctx.fill();
        ctx.restore();
    };

    // ── Retry ─────────────────────────────────────────────────────────────────
    const retry = () => {
        stopCamera();
        setStatus('loading');
        setChallengeIdx(0);
        setProgress([]);
        setFaceDetected(false);
        setHoldPct(0);
        setHoldStart(null);
        setErrorMsg('');
        challengeIdxRef.current = 0;
        holdStartRef.current    = null;
        progressRef.current     = [];
        setRestartTick((v) => v + 1);
    };

    // ── Render ────────────────────────────────────────────────────────────────
    const currentChallenge = CHALLENGES[challengeIdx];

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-black">{title}</h2>
                            <p className="text-sm opacity-80 mt-0.5">{subtitle}</p>
                        </div>
                        <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center font-bold text-white transition-colors">✕</button>
                    </div>
                </div>

                {/* Progress chips */}
                <div className="flex gap-2 px-5 py-3 border-b border-gray-100 overflow-x-auto">
                    {CHALLENGES.map((c, i) => {
                        const done   = progress.includes(c.id);
                        const active = i === challengeIdx && status === 'running';
                        return (
                            <div key={c.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 flex-shrink-0 transition-all ${
                                done   ? 'border-green-400 bg-green-50 text-green-700' :
                                active ? 'border-orange-400 bg-orange-50 text-orange-700 animate-pulse' :
                                'border-gray-200 text-gray-400'
                            }`}>
                                {done ? '✓' : <span>{c.icon}</span>}
                                {c.label}
                            </div>
                        );
                    })}
                </div>

                {/* Camera view */}
                <div className="relative bg-black" style={{ height: 380 }}>
                    <video ref={videoRef} className="hidden" playsInline muted />
                    <canvas ref={canvasRef} className="w-full h-full object-cover" style={{ transform: 'none' }} />

                    {/* Loading overlay */}
                    {status === 'loading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"/>
                            <p className="text-white text-sm font-medium">Starting camera…</p>
                        </div>
                    )}

                    {/* Success overlay */}
                    {status === 'done' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-green-900/80">
                            <div className="text-6xl mb-3">✅</div>
                            <p className="text-white font-bold text-xl">Verification Complete!</p>
                            <p className="text-green-200 text-sm mt-1">All challenges passed</p>
                        </div>
                    )}



                    {/* Error overlay */}
                    {status === 'error' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/80 px-6 text-center">
                            <div className="text-5xl mb-3">⚠️</div>
                            <p className="text-white font-bold text-base">{errorMsg || 'Verification failed'}</p>
                            <button onClick={retry} className="mt-4 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors">Try Again</button>
                        </div>
                    )}

                    {/* No face detected warning */}
                    {status === 'running' && !faceDetected && (
                        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                            <div className="bg-black/70 text-white text-xs px-4 py-2 rounded-full animate-pulse">
                                👤 No face detected — move into the oval
                            </div>
                        </div>
                    )}
                </div>

                {/* Challenge instructions */}
                {status === 'running' && currentChallenge && (
                    <div className="px-5 py-4 border-t border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                                {currentChallenge.icon}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-gray-800 text-sm">{currentChallenge.label}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{currentChallenge.instruction}</p>
                                {holdPct > 0 && holdPct < 100 && (
                                    <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-orange-500 rounded-full transition-all duration-75" style={{ width: `${holdPct}%` }} />
                                    </div>
                                )}
                            </div>
                            <div className="text-right flex-shrink-0">
                                <span className="text-xs text-gray-400">{challengeIdx + 1}/{CHALLENGES.length}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tips */}
                {status === 'running' && (
                    <div className="px-5 pb-4">
                        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                            <p className="text-xs text-blue-700">💡 Tips: Good lighting, face the camera directly, keep your face inside the oval</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Load MediaPipe face_mesh from CDN (avoids Vite/webpack bundle issues) ────
function loadMediaPipeFaceMesh() {
    return new Promise((resolve, reject) => {
        if (window.FaceMesh) { resolve(); return; }
        const script = document.createElement('script');
        script.src         = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
        script.crossOrigin = 'anonymous';
        script.onload  = resolve;
        script.onerror = () => reject(new Error('Failed to load MediaPipe face_mesh'));
        document.head.appendChild(script);
    });
}
