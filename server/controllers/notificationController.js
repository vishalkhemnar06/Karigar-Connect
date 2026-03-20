// server/controllers/notificationController.js
const Notification = require('../models/notificationModel');

// GET all notifications for current user (latest 50)
exports.getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);
        const unreadCount = await Notification.countDocuments({ userId: req.user.id, read: false });
        res.status(200).json({ notifications, unreadCount });
    } catch (e) {
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

// PATCH mark single notification as read
exports.markRead = async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { read: true }
        );
        res.status(200).json({ message: 'Marked as read' });
    } catch (e) {
        res.status(500).json({ message: 'Failed' });
    }
};

// PATCH mark all as read
exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
        res.status(200).json({ message: 'All marked as read' });
    } catch (e) {
        res.status(500).json({ message: 'Failed' });
    }
};

// DELETE single notification
exports.deleteNotification = async (req, res) => {
    try {
        const result = await Notification.findOneAndDelete({
            _id:    req.params.id,
            userId: req.user.id,
        });
        if (!result) return res.status(404).json({ message: 'Notification not found.' });
        res.status(200).json({ message: 'Notification deleted.' });
    } catch (e) {
        res.status(500).json({ message: 'Failed to delete notification.' });
    }
};

// DELETE all notifications for current user
exports.clearAllNotifications = async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user.id });
        res.status(200).json({ message: 'All notifications cleared.' });
    } catch (e) {
        res.status(500).json({ message: 'Failed to clear notifications.' });
    }
};
