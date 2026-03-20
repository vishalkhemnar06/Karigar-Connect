const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type:      {
        type: String,
        enum: [
            // Core job lifecycle types (original)
            'job_posted', 'job_assigned', 'job_accepted', 'job_rejected',
            'job_completed', 'job_cancelled', 'job_delayed',
            'new_applicant', 'start_reminder', 'feedback_request',
            'urgent_job', 'system',

            // Additional types used in controllers
            // (keep in sync with NotificationBell TYPE_ICONS and createNotification callers)
            'application',   // worker applied for a job
            'hired',         // worker application approved
            'job_update',    // generic status/info updates
            'cancelled',     // assignment/job cancelled (generic)
            'rating',        // new rating received
        ],
        required: true
    },
    title:     { type: String, required: true },
    message:   { type: String, required: true },
    jobId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
    read:      { type: Boolean, default: false },
    data:      { type: mongoose.Schema.Types.Mixed }   // extra payload
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);