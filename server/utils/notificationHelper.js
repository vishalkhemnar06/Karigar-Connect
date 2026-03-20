const Notification = require('../models/notificationModel');

/**
 * Create an in-app notification for a user.
 * @param {Object} params
 * @param {string} params.userId      - recipient user ID
 * @param {string} params.type        - notification type enum
 * @param {string} params.title       - short title
 * @param {string} params.message     - full message body
 * @param {string} [params.jobId]     - related job ID
 * @param {Object} [params.data]      - extra metadata
 */
const createNotification = async ({ userId, type, title, message, jobId, data }) => {
    try {
        await Notification.create({ userId, type, title, message, jobId, data });
    } catch (err) {
        console.error('⚠️ Notification creation failed:', err.message);
    }
};

/**
 * Notify all workers who applied for a job.
 */
const notifyApplicants = async (applicants, { type, title, message, jobId, data }) => {
    for (const app of applicants) {
        const uid = app.workerId?._id || app.workerId;
        if (uid) await createNotification({ userId: uid, type, title, message, jobId, data });
    }
};

/**
 * Schedule a reminder 30 minutes before job start.
 * (In production, use a cron job or Bull queue — here we use setTimeout for simplicity)
 */
const scheduleStartReminder = (job) => {
    if (!job.schedule?.date || !job.schedule?.preferredStartTime) return;

    try {
        const [h, m] = job.schedule.preferredStartTime.split(':').map(Number);
        const startDate = new Date(job.schedule.date);
        startDate.setHours(h, m, 0, 0);

        const reminderTime = new Date(startDate.getTime() - 30 * 60 * 1000); // 30 min before
        const now = Date.now();
        const delay = reminderTime.getTime() - now;

        if (delay <= 0) return; // Past due

        setTimeout(async () => {
            // Remind the client
            await createNotification({
                userId: job.postedBy,
                type: 'start_reminder',
                title: '⏰ Job Starting Soon',
                message: `Your job "${job.title}" starts in 30 minutes.`,
                jobId: job._id
            });
            // Remind assigned workers
            for (const wId of job.assignedTo) {
                await createNotification({
                    userId: wId,
                    type: 'start_reminder',
                    title: '⏰ Job Starting Soon',
                    message: `You are assigned to "${job.title}" which starts in 30 minutes.`,
                    jobId: job._id
                });
            }
        }, delay);

    } catch (err) {
        console.error('⚠️ Reminder scheduling failed:', err.message);
    }
};

module.exports = { createNotification, notifyApplicants, scheduleStartReminder };