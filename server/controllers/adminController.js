// server/controllers/adminController.js

const User = require('../models/userModel');
const Job  = require('../models/jobModel');
const { sendStatusUpdateSms } = require('../utils/smsHelper');

const SENSITIVE_FIELDS = '-password -resetPasswordToken -resetPasswordExpire';

exports.getAllWorkers = async (req, res) => {
    try {
        const workers = await User.find({ role: 'worker' })
            .select(SENSITIVE_FIELDS)
            .sort({ createdAt: -1 });
        return res.json(workers);
    } catch (err) {
        console.error('getAllWorkers error:', err);
        return res.status(500).json({ message: 'Server error fetching workers.' });
    }
};

exports.getAllClients = async (req, res) => {
    try {
        const clients = await User.find({ role: 'client' })
            .select(SENSITIVE_FIELDS)
            .sort({ createdAt: -1 });
        return res.json(clients);
    } catch (err) {
        console.error('getAllClients error:', err);
        return res.status(500).json({ message: 'Server error fetching clients.' });
    }
};

exports.updateWorkerStatus = async (req, res) => {
    try {
        let { workerId, status, points, rejectionReason } = req.body;

        console.log('[updateWorkerStatus] received:', { workerId, status, points });

        const worker = await User.findById(workerId);
        if (!worker) {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        // 'unblocked' is frontend-only — map to 'approved' for the DB
        const isUnblock = (status === 'unblocked');
        const finalStatus = isUnblock ? 'approved' : status;

        console.log('[updateWorkerStatus] finalStatus:', finalStatus, '| isUnblock:', isUnblock);

        // Build update using $set with only schema-valid fields
        const updateFields = {
            verificationStatus: finalStatus,
        };

        // Points only for a genuine fresh approval (not unblock, not block, not reject)
        if (finalStatus === 'approved' && !isUnblock) {
            const manualPoints = Number(points) || 0;
            if (manualPoints < 1 || manualPoints > 50) {
                return res.status(400).json({ message: 'Admin points must be between 1 and 50.' });
            }
            const experienceYears = Number(worker.experience) || 0;
            updateFields.points = manualPoints + (experienceYears * 10);
        }

        if (finalStatus === 'rejected') {
            updateFields.rejectedAt = new Date();
            updateFields.rejectionReason = (rejectionReason || '').trim() || 'No reason provided by admin.';
        } else {
            updateFields.rejectionReason = null;
        }

        // Use findByIdAndUpdate with $set to avoid touching other fields
        // runValidators: false prevents Mongoose from re-validating required
        // fields that aren't part of this update
        const updatedWorker = await User.findByIdAndUpdate(
            workerId,
            { $set: updateFields },
            { new: true, runValidators: false }
        ).select(SENSITIVE_FIELDS);

        if (!updatedWorker) {
            return res.status(404).json({ message: 'Worker not found after update.' });
        }

        console.log('[updateWorkerStatus] updated verificationStatus:', updatedWorker.verificationStatus);

        // SMS only for statuses that have a template in smsHelper
        if (!isUnblock && ['approved', 'rejected', 'blocked'].includes(finalStatus)) {
            try {
                await sendStatusUpdateSms(updatedWorker.mobile, updatedWorker.name, finalStatus);
            } catch (smsErr) {
                console.error('SMS failed (non-fatal):', smsErr.message);
            }
        }

        return res.status(200).json({
            message: `Worker status updated to ${finalStatus}.`,
            worker:  updatedWorker,
        });

    } catch (err) {
        console.error('[updateWorkerStatus] FULL ERROR:', err);
        return res.status(500).json({ message: err.message || 'Server error updating worker status.' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const deleted = await User.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'User not found.' });
        return res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        console.error('deleteUser error:', err);
        return res.status(500).json({ message: 'Server error deleting user.' });
    }
};

exports.getAdminStats = async (req, res) => {
    try {
        const [workerCount, clientCount, totalJobs, openJobs, runningJobs] = await Promise.all([
            User.countDocuments({ role: 'worker' }),
            User.countDocuments({ role: 'client' }),
            Job.countDocuments({}),
            Job.countDocuments({ status: 'open' }),
            Job.countDocuments({ status: 'running' }),
        ]);
        return res.json({ workers: workerCount, clients: clientCount, jobs: totalJobs, openJobs, runningJobs });
    } catch (err) {
        console.error('getAdminStats error:', err);
        return res.status(500).json({ message: 'Server error fetching stats.' });
    }
};

exports.getAllJobs = async (req, res) => {
    try {
        const jobs = await Job.find({})
            .populate('postedBy', 'name mobile')
            .sort({ createdAt: -1 })
            .limit(200);
        return res.json(jobs);
    } catch (err) {
        console.error('getAllJobs error:', err);
        return res.status(500).json({ message: 'Server error fetching jobs.' });
    }
};