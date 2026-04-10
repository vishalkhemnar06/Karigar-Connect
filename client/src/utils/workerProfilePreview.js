export const WORKER_PROFILE_PREVIEW_EVENT = 'client:open-worker-profile';

export const getWorkerPreviewId = (worker) => {
    if (!worker) return '';
    if (typeof worker === 'string' || typeof worker === 'number') return String(worker).trim();

    return String(
        worker._id || worker.userId || worker.workerId || worker.id || worker.karigarId || ''
    ).trim();
};

export const openWorkerProfilePreview = (worker) => {
    if (typeof window === 'undefined') return false;

    const workerId = getWorkerPreviewId(worker);
    if (!workerId) return false;

    window.dispatchEvent(new CustomEvent(WORKER_PROFILE_PREVIEW_EVENT, {
        detail: { workerId },
    }));

    return true;
};