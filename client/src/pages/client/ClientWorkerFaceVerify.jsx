import React, { useEffect, useRef, useState } from 'react';
import { verifyAssignedWorkerFace } from '../../api';

const ClientWorkerFaceVerify = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cameraOn, setCameraOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream && stream.getTracks) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError('Unable to access camera. Please allow camera permission.');
    }
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('capture_failed');

      const fd = new FormData();
      fd.append('livePhoto', blob, 'worker_scan.jpg');

      const { data } = await verifyAssignedWorkerFace(fd);
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-5 sm:p-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Assigned Worker Face Verification</h1>
          <p className="text-gray-600 mt-2">
            Scan worker face and verify against assigned workers in your active jobs.
          </p>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="rounded-xl overflow-hidden border border-orange-200 bg-black aspect-video flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              </div>
              <canvas ref={canvasRef} className="hidden" />

              <div className="mt-4 flex flex-wrap gap-3">
                {!cameraOn ? (
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700"
                  >
                    Start Camera
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300"
                  >
                    Stop Camera
                  </button>
                )}

                <button
                  onClick={captureAndVerify}
                  disabled={!cameraOn || loading}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Scan & Verify'}
                </button>
              </div>
            </div>

            <div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 min-h-[260px]">
                <h2 className="font-bold text-gray-900">Verification Result</h2>

                {error && <p className="mt-3 text-red-600 font-medium">{error}</p>}

                {!error && !result && (
                  <p className="mt-3 text-gray-600">Start camera and scan worker face to verify.</p>
                )}

                {result?.verified === false && (
                  <div className="mt-3">
                    <p className="text-red-600 font-semibold">Not Verified</p>
                    <p className="text-gray-700 mt-1">{result.message || 'No matching worker found.'}</p>
                    {typeof result.bestSimilarity === 'number' && (
                      <p className="text-sm text-gray-600 mt-1">Best Similarity: {result.bestSimilarity}</p>
                    )}
                  </div>
                )}

                {result?.verified && (
                  <div className="mt-3 space-y-2">
                    <p className="text-green-700 font-semibold">Verified</p>
                    <p><span className="font-semibold">Name:</span> {result.worker?.name}</p>
                    <p><span className="font-semibold">KarigarID:</span> {result.worker?.karigarId}</p>
                    <p><span className="font-semibold">Mobile:</span> {result.worker?.mobile || 'N/A'}</p>
                    <p><span className="font-semibold">Rating:</span> {result.worker?.avgStars || 0} ({result.worker?.totalRatings || 0} ratings)</p>
                    <p><span className="font-semibold">Points:</span> {result.worker?.points || 0}</p>
                    <p><span className="font-semibold">Similarity:</span> {result.similarity}</p>

                    <div className="pt-2">
                      <p className="font-semibold text-gray-900">Current Assigned Tasks</p>
                      {Array.isArray(result.currentAssignedTasks) && result.currentAssignedTasks.length > 0 ? (
                        <ul className="mt-2 space-y-2">
                          {result.currentAssignedTasks.map((t, idx) => (
                            <li key={`${t.jobId}-${idx}`} className="rounded-lg bg-white border border-orange-100 p-3 text-sm">
                              <p><span className="font-semibold">Job:</span> {t.jobTitle}</p>
                              <p><span className="font-semibold">Skill:</span> {t.skill}</p>
                              <p><span className="font-semibold">Job Status:</span> {t.jobStatus}</p>
                              <p><span className="font-semibold">Slot Status:</span> {t.slotStatus}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-600 text-sm mt-1">No active assigned tasks found.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientWorkerFaceVerify;
