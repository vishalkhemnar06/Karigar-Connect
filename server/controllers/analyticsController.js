const SiteVisitor = require('../models/siteVisitorModel');

const getVisitorCount = async (req, res) => {
    try {
        const totalVisitors = await SiteVisitor.countDocuments();
        return res.json({ totalVisitors });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load visitor count.', error: error.message });
    }
};

const recordUniqueVisitor = async (req, res) => {
    try {
        const visitorId = String(req.body?.visitorId || '').trim();
        if (!visitorId) {
            return res.status(400).json({ message: 'visitorId is required.' });
        }

        const landingPath = String(req.body?.landingPath || '/home').trim() || '/home';
        const referrer = String(req.body?.referrer || req.get('referer') || '').trim() || null;
        const userAgent = String(req.get('user-agent') || '').trim() || null;
        const now = new Date();

        await SiteVisitor.updateOne(
            { visitorId },
            {
                $setOnInsert: {
                    visitorId,
                    firstSeenAt: now,
                    landingPath,
                    referrer,
                    userAgent,
                },
                $set: {
                    lastSeenAt: now,
                },
            },
            { upsert: true },
        );

        const totalVisitors = await SiteVisitor.countDocuments();
        return res.status(201).json({ totalVisitors });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to record visitor.', error: error.message });
    }
};

module.exports = {
    getVisitorCount,
    recordUniqueVisitor,
};
