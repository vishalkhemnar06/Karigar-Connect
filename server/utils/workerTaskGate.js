const Job = require('../models/jobModel');
const { TRAVEL_BUFFER_HOURS } = require('./scheduleHelper');

const ACTIVE_TASK_STATUSES = ['filled', 'scheduled', 'running'];

const parseScheduledDateTime = (scheduledDate, scheduledTime) => {
    if (!scheduledDate) return null;
    const dt = new Date(scheduledDate);
    if (Number.isNaN(dt.getTime())) return null;

    let hours = 9;
    let minutes = 0;
    const raw = String(scheduledTime || '').trim();
    if (raw) {
        const m = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
        if (m) {
            const h = Number(m[1]);
            const mm = Number(m[2] || '0');
            const meridiem = String(m[3] || '').toLowerCase();
            if (Number.isFinite(h) && Number.isFinite(mm)) {
                hours = h;
                minutes = mm;
                if (meridiem === 'pm' && hours < 12) hours += 12;
                if (meridiem === 'am' && hours === 12) hours = 0;
            }
        }
    }

    dt.setHours(hours, minutes, 0, 0);
    return dt.getTime();
};

const findActiveWorkerTask = async (workerId) => {
    const wid = String(workerId || '').trim();
    if (!wid) return null;

    const jobs = await Job.find({
        workerSlots: {
            $elemMatch: {
                assignedWorker: wid,
                status: { $in: ACTIVE_TASK_STATUSES },
            },
        },
    }).select('title subTaskSkill scheduledDate scheduledTime actualStartTime workerSlots status');

    if (!jobs?.length) return null;

    const now = Date.now();
    const blockers = [];

    jobs.forEach((job) => {
        (job.workerSlots || []).forEach((slot) => {
            const assignedId = slot?.assignedWorker?._id?.toString() || slot?.assignedWorker?.toString() || '';
            const slotStatus = String(slot?.status || '').toLowerCase();
            if (assignedId !== wid || !ACTIVE_TASK_STATUSES.includes(slotStatus)) return;

            const startMs =
                (slot?.actualStartTime ? new Date(slot.actualStartTime).getTime() : null)
                || (job?.actualStartTime ? new Date(job.actualStartTime).getTime() : null)
                || parseScheduledDateTime(job?.scheduledDate, job?.scheduledTime);

            const durationHours = Math.max(0, Number(slot?.hoursEstimated || 0));
            const endMs = Number.isFinite(startMs)
                ? startMs + (durationHours + TRAVEL_BUFFER_HOURS) * 60 * 60 * 1000
                : null;

            const blocksNow = slotStatus === 'running'
                || (Number.isFinite(startMs) && Number.isFinite(endMs) && now >= startMs && now < endMs);

            if (blocksNow) {
                blockers.push({ job, slot, startMs, endMs });
            }
        });
    });

    if (!blockers.length) return null;

    blockers.sort((a, b) => {
        const aEnd = Number.isFinite(a.endMs) ? a.endMs : Number.MAX_SAFE_INTEGER;
        const bEnd = Number.isFinite(b.endMs) ? b.endMs : Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
    });

    return blockers[0];
};

const getActiveTaskBlockMessage = (activeTask) => {
    const jobTitle = activeTask?.job?.title || 'your current task';
    const skill = String(activeTask?.slot?.skill || activeTask?.job?.subTaskSkill || '').trim();
    const skillLabel = skill ? ` (${skill})` : '';
    return `You still have an active task in "${jobTitle}"${skillLabel}. Wait for the client to mark it done before applying to new jobs.`;
};

module.exports = {
    ACTIVE_TASK_STATUSES,
    findActiveWorkerTask,
    getActiveTaskBlockMessage,
};