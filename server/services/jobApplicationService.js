const Job = require('../models/jobModel');
const User = require('../models/userModel');
const { findActiveWorkerTask, getActiveTaskBlockMessage } = require('../utils/workerTaskGate');

const CANCEL_APPLICATION_CUTOFF_MINUTES = 30;

const normalizeSkill = (s = '') => String(s || '').toLowerCase().trim();

const getWorkerSkillNames = (worker) =>
    (worker?.skills || [])
        .map((s) => (typeof s === 'string' ? s : s?.name || ''))
        .map(normalizeSkill)
        .filter(Boolean);

const applyForJobByWorker = async ({
    jobId,
    workerId,
    selectedSkills = [],
    source = 'web',
}) => {
    const job = await Job.findById(jobId);
    if (!job) {
        return { ok: false, status: 404, message: 'Not found.' };
    }

    if (!job.applicationsOpen) {
        return { ok: false, status: 403, message: 'Applications are closed.' };
    }

    if (!['open', 'scheduled'].includes(job.status)) {
        return { ok: false, status: 403, message: 'Not accepting applications.' };
    }

    const activeTask = await findActiveWorkerTask(workerId);
    if (activeTask) {
        return {
            ok: false,
            status: 403,
            message: getActiveTaskBlockMessage(activeTask),
        };
    }

    const worker = await User.findById(workerId).select('skills name');
    if (!worker) {
        return { ok: false, status: 404, message: 'Worker not found.' };
    }

    const workerSkills = getWorkerSkillNames(worker);

    const blockedApplication = job.applicants.find(
        (a) => a.workerId?.toString() === String(workerId) && a.workerCancelled
    );
    if (blockedApplication) {
        return {
            ok: false,
            status: 403,
            message: 'You cancelled this assignment earlier. You cannot apply again for this job.',
        };
    }

    let skillsToApply = [];
    if (Array.isArray(selectedSkills) && selectedSkills.length) {
        if (selectedSkills.length > 2) {
            return { ok: false, status: 400, message: 'Maximum 2 positions per job.' };
        }

        for (const rawSkill of selectedSkills) {
            const skill = normalizeSkill(rawSkill);
            if (!skill) continue;
            if (workerSkills.length > 0 && !workerSkills.includes(skill)) {
                return {
                    ok: false,
                    status: 400,
                    message: `You don't have skill: "${rawSkill}".`,
                };
            }

            const hasOpenSlot = job.workerSlots.find((s) => s.status === 'open' && s.skill === skill);
            if (!hasOpenSlot) {
                return {
                    ok: false,
                    status: 400,
                    message: `No open slot for "${rawSkill}".`,
                };
            }
            skillsToApply.push(skill);
        }
        skillsToApply = [...new Set(skillsToApply)];
    } else {
        const relevantOpen = job.workerSlots.filter((s) => {
            if (s.status !== 'open') return false;
            if (!workerSkills.length) return true;
            return workerSkills.includes(s.skill);
        });

        skillsToApply = [...new Set(relevantOpen.map((s) => s.skill))].slice(0, 2);
        if (!skillsToApply.length) {
            skillsToApply = [normalizeSkill(job.skills?.[0] || 'general')];
        }
    }

    const existingPending = job.applicants
        .filter((a) => a.workerId?.toString() === String(workerId) && a.status === 'pending')
        .map((a) => normalizeSkill(a.skill));

    const newSkills = skillsToApply.filter((s) => !existingPending.includes(s));
    if (!newSkills.length) {
        return { ok: false, status: 400, message: 'Already applied for these positions.' };
    }

    const sourceValue = source === 'ivr' ? 'ivr' : 'web';
    newSkills.forEach((skill) => {
        job.applicants.push({
            workerId,
            skill,
            status: 'pending',
            applicationSource: sourceValue,
            appliedAt: new Date(),
        });
    });

    await job.save();

    return {
        ok: true,
        status: 200,
        message: 'Applied successfully.',
        appliedSkills: newSkills,
        workerName: worker.name,
        job,
    };
};

const cancelPendingApplicationByWorker = async ({
    jobId,
    workerId,
    cutoffMinutes = CANCEL_APPLICATION_CUTOFF_MINUTES,
}) => {
    const job = await Job.findById(jobId);
    if (!job) {
        return { ok: false, status: 404, message: 'Not found.' };
    }

    const pending = job.applicants.filter(
        (a) => a.workerId?.toString() === String(workerId) && a.status === 'pending'
    );

    if (!pending.length) {
        return { ok: false, status: 400, message: 'You have not applied yet.' };
    }

    const now = Date.now();
    const enforceCutoff = Number.isFinite(Number(cutoffMinutes));
    const hasExpired = enforceCutoff && pending.some((app) => {
        const appliedAt = app.appliedAt ? new Date(app.appliedAt).getTime() : 0;
        if (!appliedAt) return true;
        const diffMinutes = (now - appliedAt) / 60000;
        return diffMinutes > Number(cutoffMinutes);
    });

    if (hasExpired) {
        return {
            ok: false,
            status: 403,
            message: `Application cancellation is allowed only within ${cutoffMinutes} minutes.`
        };
    }

    const removedSkills = pending.map((app) => app.skill).filter(Boolean);
    (job.applicants || []).forEach((app) => {
        const isOwnPending = app.workerId?.toString() === String(workerId) && app.status === 'pending';
        if (!isOwnPending) return;
        app.status = 'rejected';
        app.workerCancelled = true;
        app.feedback = 'Cancelled by worker before assignment';
    });

    await job.save();

    return {
        ok: true,
        status: 200,
        message: 'Your application has been cancelled.',
        removedSkills,
        job,
    };
};

module.exports = {
    applyForJobByWorker,
    cancelPendingApplicationByWorker,
    CANCEL_APPLICATION_CUTOFF_MINUTES,
};
