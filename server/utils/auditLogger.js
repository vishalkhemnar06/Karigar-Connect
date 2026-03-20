const crypto = require('crypto');
const AuditLog = require('../models/auditLogModel');

const hashValue = (value) => {
    if (!value) return null;
    return crypto.createHash('sha256').update(String(value)).digest('hex');
};

const getIpAddress = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
};

const getLocationKey = (req, metadata = {}) => {
    return metadata.locationKey
        || req.headers['x-location-key']
        || req.headers['x-client-city']
        || req.body?.city
        || req.body?.homeLocation
        || req.body?.location?.city
        || null;
};

const createDerivedAuditEvents = async ({ entry, req, metadata }) => {
    if (!entry.userId) return;

    const lastLoginLike = await AuditLog.findOne({
        userId: entry.userId,
        action: { $in: ['login', 'failed_login'] },
        _id: { $ne: entry._id },
    }).sort({ createdAt: -1 });

    const derivedEvents = [];
    if (entry.deviceFingerprint && lastLoginLike?.deviceFingerprint && lastLoginLike.deviceFingerprint !== entry.deviceFingerprint) {
        derivedEvents.push({
            userId: entry.userId,
            role: entry.role,
            action: 'device_change',
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            deviceFingerprint: entry.deviceFingerprint,
            locationFingerprint: entry.locationFingerprint,
            metadata: { sourceAction: entry.action },
        });
    }

    if (entry.locationFingerprint && lastLoginLike?.locationFingerprint && lastLoginLike.locationFingerprint !== entry.locationFingerprint) {
        derivedEvents.push({
            userId: entry.userId,
            role: entry.role,
            action: 'location_change',
            ipAddress: entry.ipAddress,
            userAgent: entry.userAgent,
            deviceFingerprint: entry.deviceFingerprint,
            locationFingerprint: entry.locationFingerprint,
            metadata: { sourceAction: entry.action },
        });
    }

    if (entry.action === 'failed_login' && entry.ipAddress) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const failedCount = await AuditLog.countDocuments({
            ipAddress: entry.ipAddress,
            action: 'failed_login',
            createdAt: { $gte: since },
        });

        if (failedCount >= 5) {
            derivedEvents.push({
                userId: entry.userId,
                role: entry.role,
                action: 'suspicious_ip',
                ipAddress: entry.ipAddress,
                userAgent: entry.userAgent,
                deviceFingerprint: entry.deviceFingerprint,
                locationFingerprint: entry.locationFingerprint,
                metadata: {
                    sourceAction: entry.action,
                    failedCount,
                    mobile: metadata.mobile || null,
                },
            });
        }
    }

    if (derivedEvents.length) {
        await AuditLog.insertMany(derivedEvents, { ordered: false });
    }
};

const logAuditEvent = async ({ userId = null, role = null, action, req, metadata = {} }) => {
    if (!action || !req) return null;

    try {
        const ipAddress = getIpAddress(req);
        const userAgent = req.get('user-agent') || null;
        const deviceKey = req.headers['x-device-id'] || userAgent || null;
        const locationKey = getLocationKey(req, metadata);

        const entry = await AuditLog.create({
            userId,
            role: role || metadata.role || null,
            action,
            ipAddress,
            userAgent,
            deviceFingerprint: hashValue(deviceKey),
            locationFingerprint: hashValue(locationKey),
            metadata,
        });

        if (['login', 'failed_login'].includes(action)) {
            await createDerivedAuditEvents({ entry, req, metadata });
        }

        return entry;
    } catch (error) {
        console.error('auditLogger:', error.message);
        return null;
    }
};

module.exports = { logAuditEvent };