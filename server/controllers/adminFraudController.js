const { createNotification } = require('../utils/notificationHelper');
const { sendCustomSms } = require('../utils/smsHelper');
const fraudService = require('../utils/fraudService');

const ensureInternalSecret = (req, res) => {
    const expected = process.env.INTERNAL_SECRET;
    const received = req.headers['x-internal-secret'];
    
    if (!expected) {
        console.warn('[fraudNotify] ⚠️  INTERNAL_SECRET not configured in .env');
        res.status(401).json({ message: 'Unauthorized internal request.' });
        return false;
    }
    
    if (received !== expected) {
        console.warn(`[fraudNotify] ❌ Secret mismatch: received="${received || 'MISSING'}"`);
        res.status(401).json({ message: 'Unauthorized internal request.' });
        return false;
    }
    return true;
};

const handleFraudError = (res, error) => {
    return res.status(error.status || 500).json({
        message: error.message || 'Fraud operation failed.',
        details: error.details || undefined,
    });
};

const maskPhoneNumber = (value = '') => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    return `***${digits.slice(-4)}`;
};

exports.getFraudQueue = async (req, res) => {
    try {
        const data = await fraudService.getFraudQueue(req.query);
        return res.json(data);
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.getFraudMetrics = async (req, res) => {
    try {
        const data = await fraudService.getFraudMetrics();
        return res.json(data);
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.getFraudStats = async (req, res) => {
    try {
        const data = await fraudService.getFraudStats();
        return res.json(data);
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.getFraudActions = async (req, res) => {
    try {
        const data = await fraudService.getFraudActions(req.query);
        return res.json(data);
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.triggerFraudScan = async (req, res) => {
    try {
        const scan = await fraudService.triggerFullScan();
        const queue = await fraudService.getFraudQueue();
        return res.json({ ...scan, queue });
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.takeFraudAction = async (req, res) => {
    try {
        const result = await fraudService.takeFraudAction(req.body);
        return res.json(result);
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.dismissFraudQueueItem = async (req, res) => {
    try {
        const result = await fraudService.dismissFraudQueueItem(req.params.userId);
        return res.json(result);
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.getFraudHealth = async (req, res) => {
    try {
        const data = await fraudService.getFraudHealth();
        return res.json(data);
    } catch (error) {
        return handleFraudError(res, error);
    }
};

exports.fraudNotify = async (req, res) => {
    if (!ensureInternalSecret(req, res)) return;

    try {
        const { userId, title, message, mobile, smsMessage, action } = req.body;
        console.log('[fraudNotify] Received fraud action notification:', { userId, action, mobile: maskPhoneNumber(mobile) });

        if (mobile) {
            const msgToSend = smsMessage || message || title;
            console.log(`[SMS] Sending to ${maskPhoneNumber(mobile)}...`);
            const smsResult = await sendCustomSms(mobile, msgToSend);
            console.log(`[SMS] Result:`, smsResult);
        } else {
            console.warn('[SMS] No mobile number provided, skipping SMS');
        }

        if (userId && action !== 'delete' && title && message) {
            console.log('[Notification] Creating in-app notification for user:', userId);
            await createNotification({
                userId,
                type: 'system',
                title,
                message,
                data: { source: 'fraud-monitor', action },
            });
        }

        console.log('[fraudNotify] ✅ Fraud notification completed');
        return res.json({ success: true });
    } catch (error) {
        console.error('[fraudNotify] ❌ Error:', error.message, error.stack);
        return res.status(500).json({ message: 'Failed to deliver fraud notification.' });
    }
};