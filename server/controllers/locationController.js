// server/controllers/locationController.js
// ADD this file to your server/controllers/ directory
//
// Endpoints:
//   POST   /api/location/init            — Client: capture static location when booking confirmed
//   PUT    /api/location/worker/update   — Worker: push live GPS coordinates (called ~every 5s)
//   GET    /api/location/:jobId          — Client/Worker: get current location snapshot for a job
//   PUT    /api/location/worker/toggle   — Worker: enable/disable sharing for a job
//   GET    /api/location/worker/jobs     — Worker: list all jobs where tracking is active

const Location = require('../models/locationModel');
const Job      = require('../models/jobModel');

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT: Initialise / update static client location when job is confirmed
// Called automatically when client confirms/schedules a job
// POST /api/location/init
// Body: { jobId, lat, lng, address }
// ─────────────────────────────────────────────────────────────────────────────
exports.initClientLocation = async (req, res) => {
    try {
        const { jobId, lat, lng, address } = req.body;
        if (!jobId || lat == null || lng == null) {
            return res.status(400).json({ message: 'jobId, lat, and lng are required.' });
        }

        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ message: 'Job not found.' });

        // Client must own the job
        if (job.postedBy.toString() !== req.user.id.toString()) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        // Collect all assigned worker IDs from worker slots + assignedTo
        const assignedWorkerIds = [];
        (job.workerSlots || []).forEach(slot => {
            if (slot.assignedWorker) assignedWorkerIds.push(slot.assignedWorker.toString());
        });
        (job.assignedTo || []).forEach(id => {
            const idStr = id.toString();
            if (!assignedWorkerIds.includes(idStr)) assignedWorkerIds.push(idStr);
        });

        if (assignedWorkerIds.length === 0) {
            // No workers yet — create a placeholder with just client location
            // Will be linked to workers as they get assigned
            return res.status(200).json({ message: 'No workers assigned yet. Location will be set when workers are assigned.' });
        }

        // Upsert a Location document for each assigned worker
        const ops = assignedWorkerIds.map(workerId =>
            Location.findOneAndUpdate(
                { jobId, workerId },
                {
                    $set: {
                        clientId: req.user.id,
                        'clientLocation.lat':        Number(lat),
                        'clientLocation.lng':        Number(lng),
                        'clientLocation.address':    address || '',
                        'clientLocation.capturedAt': new Date(),
                        jobStatus: job.status,
                        trackingEnabled: true,
                    },
                },
                { upsert: true, new: true }
            )
        );

        await Promise.all(ops);

        return res.status(200).json({
            message: 'Client location saved successfully.',
            workersTracked: assignedWorkerIds.length,
        });
    } catch (err) {
        console.error('initClientLocation error:', err);
        return res.status(500).json({ message: 'Failed to save client location.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER: Push live GPS update
// Called every 5 seconds from worker's device while job is scheduled/running
// PUT /api/location/worker/update
// Body: { jobId, lat, lng, accuracy, heading, speed }
// ─────────────────────────────────────────────────────────────────────────────
exports.updateWorkerLocation = async (req, res) => {
    try {
        const { jobId, lat, lng, accuracy, heading, speed } = req.body;
        if (!jobId || lat == null || lng == null) {
            return res.status(400).json({ message: 'jobId, lat, and lng are required.' });
        }

        const workerId = req.user.id;

        // Verify the worker is actually assigned to this job
        const job = await Job.findById(jobId);
        if (!job) return res.status(404).json({ message: 'Job not found.' });

        const isAssigned =
            (job.assignedTo || []).some(id => id.toString() === workerId.toString()) ||
            (job.workerSlots || []).some(s => s.assignedWorker && s.assignedWorker.toString() === workerId.toString());

        if (!isAssigned) {
            return res.status(403).json({ message: 'You are not assigned to this job.' });
        }

        const updated = await Location.findOneAndUpdate(
            { jobId, workerId },
            {
                $set: {
                    'workerLocation.lat':       Number(lat),
                    'workerLocation.lng':       Number(lng),
                    'workerLocation.accuracy':  accuracy  != null ? Number(accuracy)  : null,
                    'workerLocation.heading':   heading   != null ? Number(heading)   : null,
                    'workerLocation.speed':     speed     != null ? Number(speed)     : null,
                    'workerLocation.updatedAt': new Date(),
                    workerSharingActive: true,
                    clientId: job.postedBy,
                    jobStatus: job.status,
                },
            },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, updatedAt: updated.workerLocation.updatedAt });
    } catch (err) {
        console.error('updateWorkerLocation error:', err);
        return res.status(500).json({ message: 'Failed to update location.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED: Get location snapshot for a specific job
// Used by both client (to see worker moving) and worker (to see his own pin + client's static pin)
// GET /api/location/:jobId
// ─────────────────────────────────────────────────────────────────────────────
exports.getJobLocation = async (req, res) => {
    try {
        const { jobId } = req.params;
        const userId    = req.user.id.toString();

        // Find all location records for this job
        const locations = await Location.find({ jobId })
            .populate('workerId', 'name photo mobile karigarId')
            .lean();

        if (!locations.length) {
            return res.status(404).json({ message: 'No location data found for this job.' });
        }

        // Authorisation: must be the client or one of the workers
        const clientId   = locations[0]?.clientId?.toString();
        const workerIds  = locations.map(l => l.workerId?._id?.toString() || l.workerId?.toString());
        const isClient   = clientId === userId;
        const isWorker   = workerIds.includes(userId);

        if (!isClient && !isWorker) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        return res.status(200).json({
            jobId,
            isClient,
            isWorker,
            clientLocation: locations[0]?.clientLocation || null,
            workers: locations.map(l => ({
                workerId:       l.workerId?._id || l.workerId,
                workerName:     l.workerId?.name    || 'Worker',
                workerPhoto:    l.workerId?.photo   || null,
                workerMobile:   l.workerId?.mobile  || null,
                karigarId:      l.workerId?.karigarId || null,
                workerLocation: l.workerLocation,
                sharingActive:  l.workerSharingActive,
            })),
        });
    } catch (err) {
        console.error('getJobLocation error:', err);
        return res.status(500).json({ message: 'Failed to fetch location data.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER: Toggle their location sharing on/off for a specific job
// PUT /api/location/worker/toggle
// Body: { jobId, active }
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleWorkerSharing = async (req, res) => {
    try {
        const { jobId, active } = req.body;
        const workerId = req.user.id;

        await Location.findOneAndUpdate(
            { jobId, workerId },
            { $set: { workerSharingActive: !!active } },
            { upsert: true }
        );

        return res.status(200).json({
            message: active ? 'Location sharing enabled.' : 'Location sharing paused.',
            sharingActive: !!active,
        });
    } catch (err) {
        console.error('toggleWorkerSharing error:', err);
        return res.status(500).json({ message: 'Failed to toggle sharing.' });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// WORKER: Get list of all jobs where location tracking is relevant
// GET /api/location/worker/jobs
// ─────────────────────────────────────────────────────────────────────────────
exports.getWorkerTrackingJobs = async (req, res) => {
    try {
        const workerId = req.user.id;

        const records = await Location.find({ workerId, trackingEnabled: true })
            .populate('jobId', 'title status scheduledDate scheduledTime location payment')
            .populate('clientId', 'name photo mobile')
            .lean();

        return res.status(200).json(
            records
                .filter(r => r.jobId) // filter out orphaned records
                .map(r => ({
                    locationId:     r._id,
                    job:            r.jobId,
                    client:         r.clientId,
                    clientLocation: r.clientLocation,
                    workerLocation: r.workerLocation,
                    sharingActive:  r.workerSharingActive,
                }))
        );
    } catch (err) {
        console.error('getWorkerTrackingJobs error:', err);
        return res.status(500).json({ message: 'Failed to fetch tracking jobs.' });
    }
};