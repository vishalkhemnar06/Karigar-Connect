// server/utils/scheduleHelper.js
const WORK_START_HOUR = 6;
const WORK_END_HOUR   = 21;

const timeToMinutes = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
};

const validateWorkTime = (timeStr) => {
    const mins = timeToMinutes(timeStr);
    if (mins === null) return { valid: true };
    const start = WORK_START_HOUR * 60;
    const end   = WORK_END_HOUR   * 60;
    if (mins < start || mins > end) {
        return { valid: false, message: 'Work time must be scheduled between 6:00 AM and 9:00 PM.' };
    }
    return { valid: true };
};

const parseDurationToHours = (d) => {
    if (!d && d !== 0) return 8;
    const s = String(d).toLowerCase().trim();
    const dm = s.match(/(\d+(?:\.\d+)?)\s*day/);
    if (dm) return parseFloat(dm[1]) * 8;
    const hm = s.match(/(\d+(?:\.\d+)?)\s*h/);
    if (hm) return parseFloat(hm[1]);
    const nm = s.match(/^(\d+(?:\.\d+)?)$/);
    if (nm) return parseFloat(nm[1]);
    return 8;
};

const TRAVEL_BUFFER_HOURS = 2;

const getStartFromScheduledDateTime = (scheduledDate, scheduledTime) => {
    if (!scheduledDate || !scheduledTime) return null;
    const [h, m] = String(scheduledTime).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    const start = new Date(scheduledDate);
    start.setHours(h, m, 0, 0);
    if (isNaN(start.getTime())) return null;
    return start;
};

const getWindowFromStartAndDuration = (start, durationHours) => {
    if (!start || isNaN(start.getTime())) return null;
    const dur = Math.max(0, Number(durationHours || 0));
    const end = new Date(start.getTime() + (dur + TRAVEL_BUFFER_HOURS) * 3600 * 1000);
    return { start, end, durationHours: dur };
};

const getBlockedWindow = (job, durationHoursOverride = null) => {
    const start = getStartFromScheduledDateTime(job?.scheduledDate, job?.scheduledTime);
    if (!start) return null;
    const dur = Number.isFinite(Number(durationHoursOverride))
        ? Number(durationHoursOverride)
        : parseDurationToHours(job?.duration);
    return getWindowFromStartAndDuration(start, dur);
};

const getAssignedWorkerSlotWindow = (job, workerId) => {
    const wid = String(workerId || '');
    if (!wid) return null;

    const slot = (job?.workerSlots || []).find((s) => {
        const assignedId = s?.assignedWorker?._id?.toString() || s?.assignedWorker?.toString() || '';
        return assignedId === wid && ['filled', 'scheduled', 'running'].includes(String(s?.status || ''));
    });

    if (!slot) return null;

    const start =
        (slot?.actualStartTime ? new Date(slot.actualStartTime) : null)
        || (job?.actualStartTime ? new Date(job.actualStartTime) : null)
        || getStartFromScheduledDateTime(job?.scheduledDate, job?.scheduledTime);

    if (!start || isNaN(start.getTime())) return null;

    const dur = Math.max(0, Number(slot?.hoursEstimated || 0));
    return getWindowFromStartAndDuration(start, dur);
};

const doWindowsOverlap = (w1, w2) => w1.start < w2.end && w2.start < w1.end;

const checkWorkerScheduleConflict = async (JobModel, workerId, jobId, options = {}) => {
    const target = await JobModel.findById(jobId).lean();
    if (!target) return { conflict: false };

    const targetStart =
        (options?.targetActualStartTime ? new Date(options.targetActualStartTime) : null)
        || getStartFromScheduledDateTime(options?.targetScheduledDate || target.scheduledDate, options?.targetScheduledTime || target.scheduledTime);

    const targetDurationHours = Number.isFinite(Number(options?.targetSlotHours))
        ? Number(options.targetSlotHours)
        : parseDurationToHours(target.duration);

    const tw = getWindowFromStartAndDuration(targetStart, targetDurationHours);
    if (!tw) return { conflict: false };

    const existing = await JobModel.find({ _id: { $ne: jobId }, assignedTo: workerId, status: { $in: ['scheduled','running'] } }).lean();
    for (const ej of existing) {
        const ew = getAssignedWorkerSlotWindow(ej, workerId);
        if (!ew) continue;
        if (doWindowsOverlap(tw, ew)) {
            return { conflict: true, message: 'This worker is already approved for another job during the selected time. Please hire another worker or contact the worker to negotiate availability.' };
        }
    }
    return { conflict: false };
};

// UPDATED: 30-minute cutoff (was 45)
const CANCEL_CUTOFF_MINUTES = 30;

const canWorkerCancelJob = (job) => {
    if (job.status === 'running') {
        return { allowed: false, reason: 'Cancellation is not allowed once a job has started.' };
    }
    if (job.status !== 'scheduled') {
        return { allowed: false, reason: 'This job cannot be cancelled at this stage.' };
    }
    if (!job.scheduledDate || !job.scheduledTime) {
        return { allowed: true };
    }
    const [h, m]    = job.scheduledTime.split(':').map(Number);
    const sched     = new Date(job.scheduledDate);
    sched.setHours(h, m, 0, 0);
    const minsLeft  = (sched.getTime() - Date.now()) / 60000;
    if (minsLeft <= CANCEL_CUTOFF_MINUTES) {
        return {
            allowed: false,
            reason:  `Cancellation is only allowed more than ${CANCEL_CUTOFF_MINUTES} minutes before start. Job starts in ${Math.max(0, Math.floor(minsLeft))} minutes.`,
        };
    }
    return { allowed: true, minutesUntilStart: Math.floor(minsLeft) };
};

/**
 * Check if the job's scheduled start time has been reached.
 * Returns { canStart, minutesUntilStart, scheduledAt }
 */
const canStartJob = (job) => {
    if (!job.scheduledDate || !job.scheduledTime) {
        return { canStart: true, minutesUntilStart: 0, scheduledAt: null };
    }
    const [h, m]    = job.scheduledTime.split(':').map(Number);
    const sched     = new Date(job.scheduledDate);
    sched.setHours(h, m, 0, 0);
    const minsLeft  = (sched.getTime() - Date.now()) / 60000;
    return {
        canStart:          minsLeft <= 0,
        minutesUntilStart: Math.max(0, Math.ceil(minsLeft)),
        scheduledAt:       sched,
    };
};

module.exports = {
    parseDurationToHours,
    getBlockedWindow,
    doWindowsOverlap,
    checkWorkerScheduleConflict,
    canWorkerCancelJob,
    canStartJob,
    validateWorkTime,
    timeToMinutes,
    CANCEL_CUTOFF_MINUTES,
    TRAVEL_BUFFER_HOURS,
    WORK_START_HOUR,
    WORK_END_HOUR,
};
