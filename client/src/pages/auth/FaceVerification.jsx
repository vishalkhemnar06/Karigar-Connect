// client/src/pages/auth/FaceVerification.jsx
// PREMIUM VERSION - Liveness detection using MediaPipe Face Mesh
// Enhanced UI with modern design, animations, and better user feedback

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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
        durationMs:  2000,
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

const CHALLENGE_TIMEOUT_MS = 15_000;
const EAR_BLINK_THRESHOLD  = 0.20;
const HEAD_TURN_THRESHOLD  = 0.05;

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

// ── Load MediaPipe face_mesh from CDN ────────────────────────────────────────
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

// ── Main Component ───────────────────────────────────────────────────────────
export default function FaceVerification({
    onComplete,
    onCancel,
    title    = 'Identity Verification',
    subtitle = 'Complete these steps to verify your identity',
}) {
    const videoRef    = useRef(null);
    const canvasRef   = useRef(null);
    const streamRef   = useRef(null);
    const fmRef       = useRef(null);
    const rafRef      = useRef(null);
    const timerRef    = useRef(null);
    const captureRef  = useRef(null);

    const [status,           setStatus]          = useState('loading');
    const [challengeIdx,     setChallengeIdx]     = useState(0);
    const [progress,         setProgress]         = useState([]);
    const [faceDetected,     setFaceDetected]     = useState(false);
    const [holdStart,        setHoldStart]        = useState(null);
    const [holdPct,          setHoldPct]          = useState(0);
    const [errorMsg,         setErrorMsg]         = useState('');
    const [capturedPhoto,    setCapturedPhoto]    = useState(null);
    const [restartTick,      setRestartTick]      = useState(0);

    const challengeIdxRef = useRef(0);
    const holdStartRef    = useRef(null);
    const progressRef     = useRef([]);

    useEffect(() => { challengeIdxRef.current = challengeIdx; }, [challengeIdx]);
    useEffect(() => { holdStartRef.current    = holdStart;    }, [holdStart]);
    useEffect(() => { progressRef.current     = progress;     }, [progress]);

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

    useEffect(() => {
        let alive = true;

        const init = async () => {
            try {
                await loadMediaPipeFaceMesh();
                if (!alive) return;

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

    const processLoop = useCallback(() => {
        const tick = async () => {
            if (fmRef.current && videoRef.current && videoRef.current.readyState >= 2) {
                try {
                    await fmRef.current.send({ image: videoRef.current });
                } catch (err) {
                    console.debug('Face mesh frame processing failed:', err);
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    const handleResults = useCallback((results) => {
        const canvas = canvasRef.current;
        const video  = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;

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
            holdStartRef.current = null;
            setHoldStart(null);
            setHoldPct(0);
        }

        drawOverlay(ctx, canvas, true, noseOff, avgEAR);
    }, [status]);

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
        ctx.drawImage(v, 0, 0, cap.width, cap.height);
        const dataUrl = cap.toDataURL('image/jpeg', 0.92);
        setCapturedPhoto(dataUrl);
        stopCamera();
        onComplete({ photoDataUrl: dataUrl, livenessScore: 1.0 });
    };
    captureRef.current = captureAndFinish;

    const drawOverlay = (ctx, canvas, detected, noseOff, ear) => {
        const cx = canvas.width  / 2;
        const cy = canvas.height / 2;
        const rx = canvas.width  * 0.27;
        const ry = canvas.height * 0.42;

        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = detected ? '#22c55e' : '#f97316';
        ctx.lineWidth   = 3;
        ctx.stroke();

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.clip('evenodd');
        ctx.fill();
        ctx.restore();
    };

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

    const currentChallenge = CHALLENGES[challengeIdx];
    const completedCount = progress.length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">{title}</h2>
                            <p className="text-sm text-orange-100 mt-0.5">{subtitle}</p>
                        </div>
                        <button
                            onClick={onCancel}
                            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center justify-between gap-2">
                        {CHALLENGES.map((c, i) => {
                            const done = progress.includes(c.id);
                            const active = i === challengeIdx && status === 'running';
                            return (
                                <div key={c.id} className="flex-1 text-center">
                                    <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                        done ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-md' :
                                        active ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md animate-pulse' :
                                        'bg-gray-200 text-gray-400'
                                    }`}>
                                        {done ? '✓' : i + 1}
                                    </div>
                                    <p className={`text-[10px] font-semibold mt-1 ${active ? 'text-orange-600' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                                        {c.label.split(' ')[0]}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Camera View */}
                <div className="relative bg-black" style={{ height: 380 }}>
                    <video ref={videoRef} className="hidden" playsInline muted />
                    <canvas ref={canvasRef} className="w-full h-full object-cover" style={{ transform: 'none' }} />

                    {/* Loading Overlay */}
                    <AnimatePresence>
                        {status === 'loading' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90"
                            >
                                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
                                <p className="text-white text-sm font-medium">Starting camera...</p>
                                <p className="text-white/60 text-xs mt-1">Please allow camera access</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Success Overlay */}
                    <AnimatePresence>
                        {status === 'done' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-900/90"
                            >
                                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 flex items-center justify-center shadow-lg mb-3">
                                    <span className="text-3xl">✅</span>
                                </div>
                                <p className="text-white font-bold text-xl">Verification Complete!</p>
                                <p className="text-emerald-200 text-sm mt-1">All challenges passed successfully</p>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error Overlay */}
                    <AnimatePresence>
                        {status === 'error' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex flex-col items-center justify-center bg-red-900/90 px-6 text-center"
                            >
                                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                                    <span className="text-4xl">⚠️</span>
                                </div>
                                <p className="text-white font-bold text-base">{errorMsg || 'Verification failed'}</p>
                                <button
                                    onClick={retry}
                                    className="mt-4 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-sm transition-all"
                                >
                                    Try Again
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* No Face Detected Warning */}
                    <AnimatePresence>
                        {status === 'running' && !faceDetected && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="absolute bottom-4 left-0 right-0 flex justify-center"
                            >
                                <div className="bg-black/80 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                                    <span className="w-2 h-2 bg-orange-500 rounded-full" />
                                    No face detected — move into the oval
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Challenge Instructions */}
                <AnimatePresence>
                    {status === 'running' && currentChallenge && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="px-5 py-4 border-t border-gray-100"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 bg-gradient-to-r from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                                    {currentChallenge.icon}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-gray-800 text-sm">{currentChallenge.label}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{currentChallenge.instruction}</p>
                                    {holdPct > 0 && holdPct < 100 && (
                                        <div className="mt-2">
                                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                                                    style={{ width: `${holdPct}%` }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${holdPct}%` }}
                                                    transition={{ duration: 0.1 }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-orange-600 mt-1 text-right">{Math.round(holdPct)}%</p>
                                        </div>
                                    )}
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <span className="text-xs text-gray-400">{challengeIdx + 1}/{CHALLENGES.length}</span>
                                    <p className="text-[10px] text-orange-500 font-semibold mt-1">
                                        {completedCount} completed
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tips Section */}
                {status === 'running' && (
                    <div className="px-5 pb-5">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-4 py-3">
                            <div className="flex items-start gap-2">
                                <span className="text-base">💡</span>
                                <div>
                                    <p className="text-xs font-semibold text-blue-800">Tips for best results:</p>
                                    <p className="text-[10px] text-blue-700 mt-0.5">• Good lighting on your face</p>
                                    <p className="text-[10px] text-blue-700">• Face the camera directly</p>
                                    <p className="text-[10px] text-blue-700">• Keep your face inside the oval</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}