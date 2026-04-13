// server/controllers/adminController.js

const path = require('path');
const User = require('../models/userModel');
const Job  = require('../models/jobModel');
const IvrSession = require('../models/ivrSessionModel');
const Shop = require('../models/shopModel');
const Coupon = require('../models/couponModel');
const { sendStatusUpdateSms } = require('../utils/smsHelper');
const { upsertWorkerById, removeWorkerById } = require('../services/semanticMatchingService');
const { cloudinary, deleteCloudinaryFolder } = require('../utils/cloudinary');

const SENSITIVE_FIELDS = '-password -resetPasswordToken -resetPasswordExpire';

const isLegacyDocumentPath = (value) => {
    if (typeof value !== 'string') return false;
    const normalized = value.replace(/\\/g, '/').toLowerCase();
    return (
        normalized.includes('/uploads/documents/') ||
        normalized.startsWith('uploads/documents/') ||
        normalized.includes('/uploads/document/') ||
        normalized.startsWith('uploads/document/') ||
        normalized.includes('/uploads/certificates/') ||
        normalized.startsWith('uploads/certificates/') ||
        normalized.includes('/uploads/certificate/') ||
        normalized.startsWith('uploads/certificate/')
    );
};

const isCloudinaryPublicId = (value) => {
    if (!value || typeof value !== 'string') return false;
    const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized) return false;
    return normalized.startsWith('karigarconnect/') || normalized.includes('/karigarconnect/');
};

const resolveCloudinaryPublicId = async (value) => {
    if (!value || typeof value !== 'string') return value;
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').split(/[?#]/)[0];
    if (!normalized) return value;

    const resourceTypes = ['raw', 'image'];
    for (const resourceType of resourceTypes) {
        try {
            const asset = await cloudinary.api.resource(normalized, {
                resource_type: resourceType,
                type: 'upload',
            });
            if (asset?.secure_url) return asset.secure_url;
        } catch {
            // continue
        }
    }

    // Fallback: generate signed URL from public id directly (if asset doesn't exist or no API access)
    try {
        return cloudinary.url(normalized, {
            resource_type: 'raw',
            sign_url: true,
            secure: true,
        });
    } catch {
        return value;
    }
};

const resolveLegacyDocumentToCloudinary = async (value) => {
    if (!value || typeof value !== 'string') return value;

    // Already a Cloudinary URL: keep as-is
    if (/https?:\/\//.test(value) && value.includes('res.cloudinary.com')) {
        return value;
    }

    // Accept direct Cloudinary public IDs (path format)
    if (isCloudinaryPublicId(value)) {
        return await resolveCloudinaryPublicId(value);
    }

    if (!isLegacyDocumentPath(value)) return value;

    try {
        const cleanValue = String(value || '').replace(/\\/g, '/').split(/[?#]/)[0];
        let decodedValue = cleanValue;
        try {
            decodedValue = decodeURIComponent(cleanValue);
        } catch {
            decodedValue = cleanValue;
        }
        const fileName = path.basename(decodedValue);
        if (!fileName) return value;

        const extension = path.extname(fileName).toLowerCase();
        const publicIdBase = fileName.replace(/\.[^/.]+$/, '');
        const publicIdCandidates = [
            `karigarconnect/worker-docs/${publicIdBase}`,
            `karigarconnect/documents/${publicIdBase}`,
            `karigarconnect/misc/${publicIdBase}`,
        ];
        const resourceTypes = extension === '.pdf' ? ['raw', 'image'] : ['image', 'raw'];

        for (const publicId of publicIdCandidates) {
            for (const resourceType of resourceTypes) {
                try {
                    const asset = await cloudinary.api.resource(publicId, { resource_type: resourceType, type: 'upload' });
                    if (asset?.secure_url) return asset.secure_url;
                } catch {
                    // Try next candidate.
                }
            }
        }

        return value;
    } catch {
        return value;
    }
};

const normalizeWorkerDocumentUrls = async (workerDoc) => {
    const worker = workerDoc?.toObject ? workerDoc.toObject() : { ...(workerDoc || {}) };
    if (!worker || typeof worker !== 'object') return worker;

    if (worker.idProof?.filePath) {
        worker.idProof.filePath = await resolveLegacyDocumentToCloudinary(worker.idProof.filePath);
    }

    if (worker.eShramCardPath) {
        worker.eShramCardPath = await resolveLegacyDocumentToCloudinary(worker.eShramCardPath);
    }

    if (Array.isArray(worker.skillCertificates) && worker.skillCertificates.length) {
        worker.skillCertificates = await Promise.all(
            worker.skillCertificates.map((entry) => resolveLegacyDocumentToCloudinary(entry))
        );
    }

    if (Array.isArray(worker.otherCertificates) && worker.otherCertificates.length) {
        worker.otherCertificates = await Promise.all(
            worker.otherCertificates.map((entry) => resolveLegacyDocumentToCloudinary(entry))
        );
    }

    return worker;
};

const sanitizeWorkerSensitiveFields = (workerDoc) => {
    const worker = workerDoc?.toObject ? workerDoc.toObject() : { ...(workerDoc || {}) };
    if (!worker || typeof worker !== 'object') return worker;

    const idType = String(worker?.idProof?.idType || '').trim();
    const last4 = String(worker?.idProof?.numberLast4 || '').trim();
    const label = idType === 'PAN Card' ? 'PAN' : 'Aadhaar';

    if (worker.idProof) {
        if (Object.prototype.hasOwnProperty.call(worker.idProof, 'numberHash')) {
            delete worker.idProof.numberHash;
        }
        worker.idProof.maskedNumber = last4 ? `${label} ending with ${last4}` : '';
    }

    if (Object.prototype.hasOwnProperty.call(worker, 'aadharNumber')) {
        delete worker.aadharNumber;
    }

    return worker;
};

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

exports.getUserByIdOrKarigarId = async (req, res) => {
    try {
        const idOrKarigarId = String(req.params.id || '').trim();
        let user = null;

        const isObjectId = idOrKarigarId.match(/^[0-9a-fA-F]{24}$/);

        if (isObjectId) {
            user = await User.findById(idOrKarigarId).select('-password -resetPasswordToken -resetPasswordExpire -faceEmbedding -idFaceEmbedding -securityAnswer -passwordChangeOtp -passwordChangeOtpExpiry -passwordChangeVerifiedToken -passwordChangeVerifiedTokenExpiry');
        }

        if (!user) {
            user = await User.findOne({
                $or: [
                    { userId: idOrKarigarId },
                    { karigarId: idOrKarigarId },
                ],
            }).select('-password -resetPasswordToken -resetPasswordExpire -faceEmbedding -idFaceEmbedding -securityAnswer -passwordChangeOtp -passwordChangeOtpExpiry -passwordChangeVerifiedToken -passwordChangeVerifiedTokenExpiry');
        }

        if (!user) return res.status(404).json({ message: 'User not found.' });

        const normalized = await normalizeWorkerDocumentUrls(user);
        const sanitized = sanitizeWorkerSensitiveFields(normalized);

        return res.json(sanitized);
    } catch (err) {
        console.error('getUserByIdOrKarigarId error:', err);
        return res.status(500).json({ message: 'Server error fetching user.' });
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

        if (finalStatus === 'rejected') {
            const folderPath = `karigarconnect/worker-docs/${updatedWorker.mobile}`;
            await deleteCloudinaryFolder(folderPath);
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
        // Calculate date ranges
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Execute all queries in parallel
        const [
            workerCount,
            clientCount,
            totalJobs,
            openJobs,
            runningJobs,
            totalIvrCalls,
            dailyIvrCalls,
            weeklyIvrCalls,
            monthlyIvrCalls,
            totalShops,
            totalCoupons,
            ivrDurationStats,
            skillStats,
            workerStatusBreakdown,
            jobStatusBreakdown,
            clientCount_approval,
            dailyWorkerRegistrations,
            weeklyIVRTrend
        ] = await Promise.all([
            // Basic stats
            User.countDocuments({ role: 'worker' }),
            User.countDocuments({ role: 'client' }),
            Job.countDocuments({}),
            Job.countDocuments({ status: 'open' }),
            Job.countDocuments({ status: 'running' }),

            // IVR stats
            IvrSession.countDocuments({}),
            IvrSession.countDocuments({ createdAt: { $gte: todayStart } }),
            IvrSession.countDocuments({ createdAt: { $gte: weekStart } }),
            IvrSession.countDocuments({ createdAt: { $gte: monthStart } }),

            // Shop & Coupon stats
            Shop.countDocuments({}),
            Coupon.countDocuments({}),

            // IVR Average Duration - calculate from timestamps
            IvrSession.aggregate([
                {
                    $addFields: {
                        duration: {
                            $subtract: [
                                { $ifNull: ['$updatedAt', '$createdAt'] },
                                '$createdAt'
                            ]
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        avgDuration: { $avg: '$duration' },
                        totalDuration: { $sum: '$duration' }
                    }
                }
            ]),

            // Most popular skills
            Job.aggregate([
                { $unwind: '$skills' },
                { $group: { _id: '$skills', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 }
            ]),

            // Worker status breakdown
            User.aggregate([
                {
                    $match: { role: 'worker' }
                },
                {
                    $group: {
                        _id: '$verificationStatus',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Job status breakdown
            Job.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),

            // Approved clients
            User.countDocuments({ role: 'client', verificationStatus: 'approved' }),

            // Daily worker registrations (last 7 days)
            User.aggregate([
                {
                    $match: {
                        role: 'worker',
                        createdAt: { $gte: weekStart }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]),

            // Weekly IVR calls trend (last 4 weeks)
            IvrSession.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-W%V', date: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ])
        ]);

        // Process average call duration (convert from ms to seconds)
        const avgCallDuration = ivrDurationStats[0]
            ? Math.round(ivrDurationStats[0].avgDuration / 1000)
            : 0;

        // Process top skills
        const topSkills = skillStats.map(s => ({
            skill: s._id,
            count: s.count
        }));

        // Process worker status breakdown
        const workerStatusMap = {};
        workerStatusBreakdown.forEach(item => {
            workerStatusMap[item._id || 'unknown'] = item.count;
        });

        // Process job status breakdown
        const jobStatusMap = {};
        jobStatusBreakdown.forEach(item => {
            jobStatusMap[item._id || 'unknown'] = item.count;
        });

        const response = {
            // Worker & Client stats
            workers: workerCount,
            clients: clientCount,

            // Job stats
            jobs: totalJobs,
            openJobs,
            runningJobs,

            // IVR stats
            ivrStats: {
                totalCalls: totalIvrCalls,
                dailyCalls: dailyIvrCalls,
                weeklyCalls: weeklyIvrCalls,
                monthlyCalls: monthlyIvrCalls,
                avgCallDurationSeconds: avgCallDuration
            },

            // Shop & Coupon stats
            shops: totalShops,
            couponsGenerated: totalCoupons,

            // Most popular skills
            topSkills: topSkills,

            // Worker status breakdown
            workerStatusBreakdown: {
                pending: workerStatusMap.pending || 0,
                approved: workerStatusMap.approved || 0,
                rejected: workerStatusMap.rejected || 0,
                blocked: workerStatusMap.blocked || 0
            },

            // Job status breakdown
            jobStatusBreakdown: {
                open: jobStatusMap.open || 0,
                running: jobStatusMap.running || 0,
                completed: jobStatusMap.completed || 0,
                cancelled: jobStatusMap.cancelled || 0
            },

            // Client approval stats
            clientsApproved: clientCount_approval,

            // Growth trends
            dailyWorkerRegistrations: dailyWorkerRegistrations,
            weeklyIVRTrend: weeklyIVRTrend
        };

        return res.json(response);
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

exports.proxyDocument = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) {
            return res.status(400).json({ message: 'URL parameter is required.' });
        }

        // Validate URL is from allowed domains (Cloudinary)
        const allowedDomains = ['res.cloudinary.com'];
        const urlObj = new URL(url);
        if (!allowedDomains.some(domain => urlObj.hostname.includes(domain))) {
            return res.status(403).json({ message: 'URL not allowed.' });
        }

        // Extract public_id from Cloudinary URL
        const pathParts = urlObj.pathname.split('/');
        const uploadIndex = pathParts.indexOf('upload');
        if (uploadIndex === -1) {
            return res.status(400).json({ message: 'Invalid Cloudinary URL format.' });
        }
        // resourceType is before /upload/, e.g. /raw/upload/ or /image/upload/
        const resourceType = pathParts[uploadIndex - 1] || 'raw';
        const publicId = pathParts.slice(uploadIndex + 1).join('/').replace(/\.[^/.]+$/, ''); // Remove extension if present

        // Generate signed URL using Cloudinary SDK
        const signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            sign_url: true,
            secure: true
        });

        const response = await fetch(signedUrl);
        if (!response.ok) {
            return res.status(response.status).json({ message: 'Failed to fetch document.' });
        }

        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        const buffer = await response.arrayBuffer();

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
        res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('proxyDocument error:', err);
        return res.status(500).json({ message: 'Server error proxying document.' });
    }
};