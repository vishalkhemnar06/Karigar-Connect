const { createNotification } = require('../utils/notificationHelper');
const { sendCustomSms } = require('../utils/smsHelper');
const fraudService = require('../utils/fraudService');

const ensureInternalSecret = (req, res) => {
    const expected = process.env.INTERNAL_SECRET;
    const received = req.headers['x-internal-secret'];
    if (!expected || received !== expected) {
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

        if (mobile) {
            await sendCustomSms(mobile, smsMessage || message || title);
        }

        if (userId && action !== 'delete' && title && message) {
            await createNotification({
                userId,
                type: 'system',
                title,
                message,
                data: { source: 'fraud-monitor', action },
            });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('fraudNotify:', error.message);
        return res.status(500).json({ message: 'Failed to deliver fraud notification.' });
    }
};