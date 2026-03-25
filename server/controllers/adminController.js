// server/controllers/adminController.js

const User = require('../models/userModel');
const Job  = require('../models/jobModel');
const { sendStatusUpdateSms } = require('../utils/smsHelper');
const { upsertWorkerById, removeWorkerById } = require('../services/semanticMatchingService');

const SENSITIVE_FIELDS = '-password -resetPasswordToken -resetPasswordExpire';

exports.getAllWorkers = async (req, res) => {
    try {
        const workers = await User.find({ role: 'worker' })
            .select(SENSITIVE_FIELDS)
            .populate('reviewLock.lockedBy', 'name mobile karigarId')
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

exports.claimWorkerForReview = async (req, res) => {
    try {
        const { workerId } = req.params;
        const adminId = req.user?._id?.toString();
        if (!adminId) return res.status(401).json({ message: 'Admin session invalid.' });

        const alreadyClaimedByAdmin = await User.findOne({
            role: 'worker',
            verificationStatus: 'pending',
            'reviewLock.lockedBy': adminId,
            _id: { $ne: workerId },
        }).select('name karigarId');

        if (alreadyClaimedByAdmin) {
            return res.status(409).json({
                message: `You already claimed ${alreadyClaimedByAdmin.name} (${alreadyClaimedByAdmin.karigarId}). Verify this worker first before claiming another.`,
            });
        }

        const worker = await User.findById(workerId).select('name karigarId role verificationStatus reviewLock');
        if (!worker || worker.role !== 'worker') {
            return res.status(404).json({ message: 'Worker not found.' });
        }
        if (worker.verificationStatus !== 'pending') {
            return res.status(409).json({ message: 'Worker is already verified by another admin.' });
        }

        const lockOwner = worker.reviewLock?.lockedBy?.toString?.();
        if (lockOwner && lockOwner !== adminId) {
            const lockAdmin = await User.findById(lockOwner).select('name karigarId');
            return res.status(409).json({
                message: `This worker is already claimed by ${lockAdmin?.name || 'another admin'}.`,
            });
        }

        const updated = await User.findOneAndUpdate(
            {
                _id: workerId,
                role: 'worker',
                verificationStatus: 'pending',
                $or: [
                    { 'reviewLock.lockedBy': null },
                    { 'reviewLock.lockedBy': { $exists: false } },
                    { 'reviewLock.lockedBy': req.user._id },
                ],
            },
            {
                $set: {
                    'reviewLock.lockedBy': req.user._id,
                    'reviewLock.lockedAt': new Date(),
                },
            },
            { new: true, runValidators: false }
        ).populate('reviewLock.lockedBy', 'name mobile karigarId');

        if (!updated) {
            return res.status(409).json({ message: 'Unable to claim worker due to concurrent update.' });
        }

        return res.json({ message: 'Worker claimed successfully.', worker: updated });
    } catch (err) {
        console.error('claimWorkerForReview error:', err);
        return res.status(500).json({ message: 'Server error while claiming worker.' });
    }
};

exports.updateWorkerStatus = async (req, res) => {
    try {
        let { workerId, status, points, rejectionReason } = req.body;
        const adminId = req.user?._id;
        if (!adminId) return res.status(401).json({ message: 'Admin session invalid.' });

        console.log('[updateWorkerStatus] received:', { workerId, status, points, adminId: adminId.toString() });

        const worker = await User.findById(workerId).select('experience role verificationStatus reviewLock mobile name');
        if (!worker || worker.role !== 'worker') {
            return res.status(404).json({ message: 'Worker not found.' });
        }

        const isUnblock = (status === 'unblocked');
        const finalStatus = isUnblock ? 'approved' : status;

        const updateFields = { verificationStatus: finalStatus };

        if (finalStatus === 'approved' && !isUnblock) {
            const manualPoints = Number(points) || 0;
            if (manualPoints < 1 || manualPoints > 50) {
                return res.status(400).json({ message: 'Admin points must be between 1 and 50.' });
            }
            const experienceYears = Number(worker.experience) || 0;
            updateFields.points = manualPoints + (experienceYears * 10);
            updateFields.rejectedAt = undefined;
            updateFields.rejectionReason = null;
        }

        if (finalStatus === 'rejected') {
            updateFields.rejectedAt = new Date();
            updateFields.rejectionReason = (rejectionReason || '').trim() || 'No reason provided by admin.';
        }

        if (finalStatus === 'blocked') {
            updateFields.rejectionReason = null;
        }

        let query = { _id: workerId, role: 'worker' };

        if (['approved', 'rejected'].includes(finalStatus) && !isUnblock) {
            query = {
                ...query,
                verificationStatus: 'pending',
                'reviewLock.lockedBy': adminId,
            };
            updateFields['reviewLock.lockedBy'] = null;
            updateFields['reviewLock.lockedAt'] = null;
        } else if (finalStatus === 'blocked') {
            query = { ...query, verificationStatus: 'approved' };
        } else if (isUnblock) {
            query = { ...query, verificationStatus: 'blocked' };
            updateFields.rejectionReason = null;
        }

        const updatedWorker = await User.findOneAndUpdate(
            query,
            { $set: updateFields },
            { new: true, runValidators: false }
        )
            .select(SENSITIVE_FIELDS)
            .populate('reviewLock.lockedBy', 'name mobile karigarId');

        if (!updatedWorker) {
            return res.status(409).json({
                message: 'Worker status update conflict. Worker may already be processed or not claimed by you.',
            });
        }

        if (!isUnblock && ['approved', 'rejected', 'blocked'].includes(finalStatus)) {
            try {
                await sendStatusUpdateSms(updatedWorker.mobile, updatedWorker.name, finalStatus);
            } catch (smsErr) {
                console.error('SMS failed (non-fatal):', smsErr.message);
            }
        }

        upsertWorkerById(updatedWorker._id).catch((err) => {
            console.error('semantic upsertWorkerById(updateWorkerStatus):', err.message);
        });

        return res.status(200).json({
            message: `Worker status updated to ${finalStatus}.`,
            worker: updatedWorker,
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
        if (deleted.role === 'worker') {
            removeWorkerById(deleted._id).catch((err) => {
                console.error('semantic removeWorkerById(deleteUser):', err.message);
            });
        }
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