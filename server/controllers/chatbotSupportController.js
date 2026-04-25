const mongoose = require('mongoose');
const ChatbotSupportRequest = require('../models/chatbotSupportRequestModel');
const User = require('../models/userModel');

const SUPPORT_WAIT_MS = 10 * 60 * 1000;
const IDLE_CLOSE_MS = 5 * 60 * 1000;
const MAX_MESSAGES = 100;

const toPlainObjectId = (value) => (value ? String(value) : null);

const sanitizeText = (value, maxLength = 1200, fallback = '') => {
    if (typeof value !== 'string') return fallback;
    const text = value.trim();
    if (!text) return fallback;
    return text.slice(0, maxLength);
};

const getAdminIdentity = async (adminUser) => {
    if (!adminUser) {
        return {
            adminId: null,
            adminName: 'Admin',
            adminMobile: null,
        };
    }

    if (adminUser.name || adminUser.mobile) {
        return {
            adminId: adminUser._id || adminUser.id || null,
            adminName: adminUser.name || 'Admin',
            adminMobile: adminUser.mobile || adminUser.phone || null,
        };
    }

    if (!adminUser._id && !adminUser.id) {
        return {
            adminId: null,
            adminName: 'Admin',
            adminMobile: null,
        };
    }

    const userId = adminUser._id || adminUser.id;
    const user = await User.findById(userId).select('name mobile').lean();
    return {
        adminId: userId,
        adminName: user?.name || 'Admin',
        adminMobile: user?.mobile || null,
    };
};

const buildMessage = (senderType, message, sender = {}) => ({
    senderType,
    senderId: sender.senderId ? new mongoose.Types.ObjectId(sender.senderId) : null,
    senderName: sender.senderName || null,
    message: sanitizeText(message, 2000),
    createdAt: new Date(),
});

const expireRequestIfNeeded = async (requestDoc) => {
    if (!requestDoc) return requestDoc;

    const now = Date.now();
    const expiresAt = requestDoc.expiresAt ? new Date(requestDoc.expiresAt).getTime() : 0;

    if (requestDoc.status === 'pending') {
        if (expiresAt && now <= expiresAt) return requestDoc;

        requestDoc.status = 'expired';
        requestDoc.closedAt = new Date();
        requestDoc.closedReason = 'No admin accepted within 10 minutes';
        requestDoc.connectionDurationSeconds = 0;
        requestDoc.lastActivityAt = new Date();
        await requestDoc.save();
        return requestDoc;
    }

    if (requestDoc.status === 'accepted') {
        const lastActivityAt = requestDoc.lastActivityAt
            ? new Date(requestDoc.lastActivityAt).getTime()
            : requestDoc.acceptedAt
                ? new Date(requestDoc.acceptedAt).getTime()
                : requestDoc.requestedAt
                    ? new Date(requestDoc.requestedAt).getTime()
                    : now;

        if (now - lastActivityAt > IDLE_CLOSE_MS) {
            const connectionStartedAt = requestDoc.connectionStartedAt || requestDoc.acceptedAt || requestDoc.requestedAt || now;
            const durationSeconds = Math.max(0, Math.floor((now - new Date(connectionStartedAt).getTime()) / 1000));

            requestDoc.status = 'closed';
            requestDoc.closedAt = new Date();
            requestDoc.closedReason = 'Closed due to 5 minutes of inactivity';
            requestDoc.connectionDurationSeconds = durationSeconds;
            requestDoc.lastActivityAt = new Date();
            requestDoc.messages = requestDoc.messages || [];
            requestDoc.messages.push(buildMessage('system', 'Chat closed automatically after 5 minutes of inactivity.', { senderName: 'System' }));
            if (requestDoc.messages.length > MAX_MESSAGES) {
                requestDoc.messages = requestDoc.messages.slice(-MAX_MESSAGES);
            }
            await requestDoc.save();
        }

        return requestDoc;
    }

    return requestDoc;
};

const getLatestRequestForClient = async (clientId) => {
    const request = await ChatbotSupportRequest.findOne({ clientId })
        .sort({ requestedAt: -1 })
        .exec();

    if (!request) return null;
    return expireRequestIfNeeded(request);
};

const serializeRequest = (doc, { includeMessages = true } = {}) => {
    if (!doc) return null;

    const now = Date.now();
    const requestedAt = doc.requestedAt ? new Date(doc.requestedAt).getTime() : now;
    const expiresAt = doc.expiresAt ? new Date(doc.expiresAt).getTime() : requestedAt + SUPPORT_WAIT_MS;
    const acceptedAt = doc.acceptedAt ? new Date(doc.acceptedAt).getTime() : null;
    const connectionStartedAt = doc.connectionStartedAt ? new Date(doc.connectionStartedAt).getTime() : acceptedAt;
    const waitingSecondsRemaining = doc.status === 'pending'
        ? Math.max(0, Math.ceil((expiresAt - now) / 1000))
        : 0;
    const connectionSecondsElapsed = doc.status === 'accepted' && connectionStartedAt
        ? Math.max(0, Math.floor((now - connectionStartedAt) / 1000))
        : doc.connectionDurationSeconds || 0;
    const inactivitySeconds = doc.status === 'accepted'
        ? Math.max(0, Math.floor((now - new Date(doc.lastActivityAt || doc.acceptedAt || doc.requestedAt || now).getTime()) / 1000))
        : 0;

    const payload = {
        id: doc._id,
        clientId: toPlainObjectId(doc.clientId),
        clientName: doc.clientName,
        clientMobile: doc.clientMobile,
        currentRoute: doc.currentRoute,
        initialMessage: doc.initialMessage,
        status: doc.status,
        requestedAt: doc.requestedAt,
        expiresAt: doc.expiresAt,
        acceptedAt: doc.acceptedAt,
        connectionStartedAt: doc.connectionStartedAt,
        closedAt: doc.closedAt,
        closedByAdminId: toPlainObjectId(doc.closedByAdminId),
        closedReason: doc.closedReason,
        connectionDurationSeconds: doc.status === 'accepted' ? connectionSecondsElapsed : doc.connectionDurationSeconds || 0,
        acceptedByAdmin: doc.acceptedByAdmin ? {
            adminId: toPlainObjectId(doc.acceptedByAdmin.adminId),
            adminName: doc.acceptedByAdmin.adminName,
            adminMobile: doc.acceptedByAdmin.adminMobile,
        } : null,
        rejectedByAdmins: Array.isArray(doc.rejectedByAdmins)
            ? doc.rejectedByAdmins.map((entry) => ({
                adminId: toPlainObjectId(entry.adminId),
                adminName: entry.adminName,
                adminMobile: entry.adminMobile,
                rejectedAt: entry.rejectedAt,
            }))
            : [],
        lastClientMessageAt: doc.lastClientMessageAt,
        lastAdminMessageAt: doc.lastAdminMessageAt,
        lastActivityAt: doc.lastActivityAt,
        waitingSecondsRemaining,
        connectionSecondsElapsed,
        inactivitySeconds,
        messageCount: Array.isArray(doc.messages) ? doc.messages.length : 0,
    };

    if (includeMessages) {
        payload.conversationSnapshot = Array.isArray(doc.conversationSnapshot)
            ? doc.conversationSnapshot.map((item) => ({
                role: item.role,
                text: item.text,
            }))
            : [];
        payload.messages = Array.isArray(doc.messages)
            ? doc.messages.map((item) => ({
                senderType: item.senderType,
                senderId: toPlainObjectId(item.senderId),
                senderName: item.senderName,
                message: item.message,
                createdAt: item.createdAt,
            }))
            : [];
    }

    return payload;
};

const appendMessage = async (requestDoc, message) => {
    requestDoc.messages = Array.isArray(requestDoc.messages) ? requestDoc.messages : [];
    requestDoc.messages.push(message);
    if (requestDoc.messages.length > MAX_MESSAGES) {
        requestDoc.messages = requestDoc.messages.slice(-MAX_MESSAGES);
    }
    requestDoc.lastActivityAt = new Date();
    await requestDoc.save();
    return requestDoc;
};

exports.requestHumanSupport = async (req, res) => {
    try {
        const clientId = req.user?._id || req.user?.id;
        if (!clientId) {
            return res.status(401).json({ success: false, message: 'Client authentication required.' });
        }

        const client = await User.findById(clientId).select('name mobile').lean();
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client account not found.' });
        }

        const existingRequest = await getLatestRequestForClient(clientId);
        if (existingRequest && ['pending', 'accepted'].includes(existingRequest.status)) {
            return res.status(200).json({
                success: true,
                message: 'Support request already exists.',
                request: serializeRequest(existingRequest),
            });
        }

        const currentRoute = sanitizeText(req.body?.currentRoute, 120, '/client/dashboard');
        const initialMessage = sanitizeText(req.body?.initialMessage, 1200, 'Client requested human support.');
        const conversationSnapshot = Array.isArray(req.body?.conversationSnapshot)
            ? req.body.conversationSnapshot
                .filter((entry) => entry && typeof entry === 'object')
                .slice(-20)
                .map((entry) => ({
                    role: ['user', 'bot', 'admin', 'system'].includes(entry.role) ? entry.role : 'system',
                    text: sanitizeText(entry.text, 1200, ''),
                }))
                .filter((entry) => entry.text)
            : [];

        const now = new Date();
        const requestDoc = await ChatbotSupportRequest.create({
            clientId,
            clientName: client.name || 'Client',
            clientMobile: client.mobile || req.user?.mobile || 'N/A',
            currentRoute,
            initialMessage,
            conversationSnapshot,
            status: 'pending',
            requestedAt: now,
            expiresAt: new Date(now.getTime() + SUPPORT_WAIT_MS),
            acceptedByAdmin: null,
            lastClientMessageAt: now,
            lastActivityAt: now,
            messages: [
                buildMessage('system', 'Human support requested.', { senderName: 'System' }),
                buildMessage('client', initialMessage, {
                    senderId: clientId,
                    senderName: client.name || 'Client',
                }),
            ],
        });

        return res.status(201).json({
            success: true,
            message: 'Human support request created.',
            request: serializeRequest(requestDoc),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to create support request.', error: error.message });
    }
};

exports.getMySupportRequest = async (req, res) => {
    try {
        const clientId = req.user?._id || req.user?.id;
        if (!clientId) {
            return res.status(401).json({ success: false, message: 'Client authentication required.' });
        }

        const requestDoc = await getLatestRequestForClient(clientId);
        if (!requestDoc) {
            return res.status(200).json({ success: true, request: null });
        }

        return res.status(200).json({ success: true, request: serializeRequest(requestDoc) });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to load support request.', error: error.message });
    }
};

exports.sendClientSupportMessage = async (req, res) => {
    try {
        const clientId = req.user?._id || req.user?.id;
        if (!clientId) {
            return res.status(401).json({ success: false, message: 'Client authentication required.' });
        }

        const requestId = req.body?.requestId;
        const message = sanitizeText(req.body?.message, 2000);
        if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: 'A valid support request is required.' });
        }
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required.' });
        }

        const requestDoc = await ChatbotSupportRequest.findOne({ _id: requestId, clientId }).exec();
        if (!requestDoc) {
            return res.status(404).json({ success: false, message: 'Support request not found.' });
        }
        await expireRequestIfNeeded(requestDoc);
        if (requestDoc.status !== 'accepted') {
            return res.status(409).json({ success: false, message: 'Human support is not connected yet.' });
        }

        const now = new Date();
        requestDoc.lastClientMessageAt = now;
        await appendMessage(requestDoc, buildMessage('client', message, {
            senderId: clientId,
            senderName: req.user?.name || requestDoc.clientName,
        }));

        return res.status(200).json({
            success: true,
            message: 'Message sent to admin.',
            request: serializeRequest(requestDoc),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to send support message.', error: error.message });
    }
};

exports.closeMySupportRequest = async (req, res) => {
    try {
        const clientId = req.user?._id || req.user?.id;
        if (!clientId) {
            return res.status(401).json({ success: false, message: 'Client authentication required.' });
        }

        const requestId = req.body?.requestId;
        let requestDoc = null;

        if (requestId && mongoose.Types.ObjectId.isValid(requestId)) {
            requestDoc = await ChatbotSupportRequest.findOne({ _id: requestId, clientId }).exec();
        }

        if (!requestDoc) {
            requestDoc = await ChatbotSupportRequest.findOne({
                clientId,
                status: { $in: ['pending', 'accepted'] },
            }).sort({ requestedAt: -1 }).exec();
        }

        if (!requestDoc) {
            return res.status(404).json({ success: false, message: 'No active support request found.' });
        }

        if (!['pending', 'accepted'].includes(requestDoc.status)) {
            return res.status(409).json({ success: false, message: 'Unable to cancel or close this request.' });
        }

        const previousStatus = requestDoc.status;
        const now = new Date();
        const connectionStartedAt = requestDoc.connectionStartedAt || requestDoc.acceptedAt || requestDoc.requestedAt || now;
        const durationSeconds = previousStatus === 'accepted'
            ? Math.max(0, Math.floor((now.getTime() - new Date(connectionStartedAt).getTime()) / 1000))
            : 0;

        requestDoc.status = 'closed';
        requestDoc.closedAt = now;
        requestDoc.closedByAdminId = null;
        requestDoc.closedReason = previousStatus === 'pending'
            ? 'Cancelled by client before connection'
            : 'Closed by client after connection';
        requestDoc.connectionDurationSeconds = durationSeconds;
        requestDoc.lastActivityAt = now;
        requestDoc.messages = Array.isArray(requestDoc.messages) ? requestDoc.messages : [];
        requestDoc.messages.push(buildMessage('system', previousStatus === 'pending'
            ? 'The client cancelled the human support request before an admin connected.'
            : 'The client closed the chat session.', { senderName: 'System' }));
        if (requestDoc.messages.length > MAX_MESSAGES) {
            requestDoc.messages = requestDoc.messages.slice(-MAX_MESSAGES);
        }

        await requestDoc.save();

        return res.status(200).json({
            success: true,
            message: previousStatus === 'pending'
                ? 'Support request cancelled.'
                : 'Chat session closed.',
            request: serializeRequest(requestDoc),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to cancel/close support request.', error: error.message });
    }
};

exports.listSupportRequests = async (req, res) => {
    try {
        const adminIdentity = await getAdminIdentity(req.user);
        const status = sanitizeText(req.query?.status, 20, 'all');
        let filter = {};

        if (status === 'pending') {
            filter = { status: 'pending' };
        } else if (status === 'accepted') {
            filter = {
                status: 'accepted',
                'acceptedByAdmin.adminId': adminIdentity.adminId,
            };
        } else {
            filter = {
                $or: [
                    { status: 'pending' },
                    { 'acceptedByAdmin.adminId': adminIdentity.adminId },
                ],
            };
        }

        const requests = await ChatbotSupportRequest.find(filter)
            .sort({ requestedAt: -1 })
            .exec();

        const normalized = [];
        for (const requestDoc of requests) {
            const maybeExpired = await expireRequestIfNeeded(requestDoc);
            normalized.push(serializeRequest(maybeExpired, { includeMessages: false }));
        }

        return res.status(200).json({
            success: true,
            requests: normalized,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to load support requests.', error: error.message });
    }
};

exports.getSupportRequestById = async (req, res) => {
    try {
        const requestId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: 'Invalid support request id.' });
        }

        const requestDoc = await ChatbotSupportRequest.findById(requestId).exec();
        if (!requestDoc) {
            return res.status(404).json({ success: false, message: 'Support request not found.' });
        }

        const adminIdentity = await getAdminIdentity(req.user);
        if (requestDoc.status === 'accepted' || requestDoc.status === 'closed' || requestDoc.status === 'expired') {
            if (requestDoc.acceptedByAdmin?.adminId && String(requestDoc.acceptedByAdmin.adminId) !== String(adminIdentity.adminId)) {
                return res.status(403).json({ success: false, message: 'You do not have access to this chat.' });
            }
        }

        await expireRequestIfNeeded(requestDoc);

        return res.status(200).json({
            success: true,
            request: serializeRequest(requestDoc),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to load support request.', error: error.message });
    }
};

exports.acceptSupportRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: 'Invalid support request id.' });
        }

        const adminIdentity = await getAdminIdentity(req.user);
        const now = new Date();

        const updatedRequest = await ChatbotSupportRequest.findOneAndUpdate(
            {
                _id: requestId,
                status: 'pending',
                $or: [
                    { acceptedByAdmin: null },
                    { 'acceptedByAdmin.adminId': null },
                ],
                expiresAt: { $gt: now },
            },
            {
                $set: {
                    status: 'accepted',
                    acceptedAt: now,
                    connectionStartedAt: now,
                    acceptedByAdmin: adminIdentity,
                    lastAdminMessageAt: now,
                    lastActivityAt: now,
                },
                $push: {
                    messages: buildMessage('system', `${adminIdentity.adminName} connected to this chat.`, {
                        senderName: 'System',
                    }),
                },
            },
            { new: true }
        ).exec();

        if (!updatedRequest) {
            return res.status(409).json({
                success: false,
                message: 'This support request has already been accepted, closed, or expired.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Support request accepted.',
            request: serializeRequest(updatedRequest),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to accept support request.', error: error.message });
    }
};

exports.rejectSupportRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: 'Invalid support request id.' });
        }

        const adminIdentity = await getAdminIdentity(req.user);
        const requestDoc = await ChatbotSupportRequest.findById(requestId).exec();
        if (!requestDoc) {
            return res.status(404).json({ success: false, message: 'Support request not found.' });
        }
        if (requestDoc.status !== 'pending') {
            return res.status(409).json({ success: false, message: 'Only pending requests can be rejected.' });
        }
        if (String(requestDoc.acceptedByAdmin?.adminId || '') === String(adminIdentity.adminId || '')) {
            return res.status(409).json({ success: false, message: 'You already accepted this request.' });
        }

        const alreadyRejected = Array.isArray(requestDoc.rejectedByAdmins)
            && requestDoc.rejectedByAdmins.some((entry) => String(entry.adminId || '') === String(adminIdentity.adminId || ''));

        if (!alreadyRejected) {
            requestDoc.rejectedByAdmins.push({
                adminId: adminIdentity.adminId,
                adminName: adminIdentity.adminName,
                adminMobile: adminIdentity.adminMobile,
                rejectedAt: new Date(),
            });
            await requestDoc.save();
        }

        return res.status(200).json({
            success: true,
            message: 'Request rejected for your queue.',
            request: serializeRequest(requestDoc),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to reject support request.', error: error.message });
    }
};

exports.sendAdminSupportMessage = async (req, res) => {
    try {
        const requestId = req.params.id || req.body?.requestId;
        const message = sanitizeText(req.body?.message, 2000);
        if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: 'A valid support request is required.' });
        }
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message is required.' });
        }

        const requestDoc = await ChatbotSupportRequest.findById(requestId).exec();
        if (!requestDoc) {
            return res.status(404).json({ success: false, message: 'Support request not found.' });
        }
        await expireRequestIfNeeded(requestDoc);
        if (requestDoc.status !== 'accepted') {
            return res.status(409).json({ success: false, message: 'Support request is not connected.' });
        }

        const adminIdentity = await getAdminIdentity(req.user);
        if (String(requestDoc.acceptedByAdmin?.adminId || '') !== String(adminIdentity.adminId || '')) {
            return res.status(403).json({ success: false, message: 'Only the accepted admin can reply.' });
        }

        requestDoc.lastAdminMessageAt = new Date();
        await appendMessage(requestDoc, buildMessage('admin', message, {
            senderId: adminIdentity.adminId,
            senderName: adminIdentity.adminName,
        }));

        return res.status(200).json({
            success: true,
            message: 'Admin message sent.',
            request: serializeRequest(requestDoc),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to send admin message.', error: error.message });
    }
};

exports.closeSupportRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: 'Invalid support request id.' });
        }

        const adminIdentity = await getAdminIdentity(req.user);
        const requestDoc = await ChatbotSupportRequest.findById(requestId).exec();
        if (!requestDoc) {
            return res.status(404).json({ success: false, message: 'Support request not found.' });
        }
        if (requestDoc.status !== 'accepted') {
            return res.status(409).json({ success: false, message: 'Only accepted chats can be closed.' });
        }
        if (String(requestDoc.acceptedByAdmin?.adminId || '') !== String(adminIdentity.adminId || '')) {
            return res.status(403).json({ success: false, message: 'Only the accepted admin can close the chat.' });
        }

        const now = new Date();
        const startedAt = requestDoc.connectionStartedAt || requestDoc.acceptedAt || requestDoc.requestedAt || now;
        const durationSeconds = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000));

        requestDoc.status = 'closed';
        requestDoc.closedAt = now;
        requestDoc.closedByAdminId = adminIdentity.adminId;
        requestDoc.closedReason = sanitizeText(req.body?.reason, 180, 'Closed by admin');
        requestDoc.connectionDurationSeconds = durationSeconds;
        requestDoc.lastActivityAt = now;
        requestDoc.messages.push(buildMessage('system', `${adminIdentity.adminName} closed the chat.`, {
            senderName: 'System',
        }));
        if (requestDoc.messages.length > MAX_MESSAGES) {
            requestDoc.messages = requestDoc.messages.slice(-MAX_MESSAGES);
        }
        await requestDoc.save();

        return res.status(200).json({
            success: true,
            message: 'Support chat closed.',
            request: serializeRequest(requestDoc),
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to close support chat.', error: error.message });
    }
};

exports.deleteSupportRequest = async (req, res) => {
    try {
        const requestId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ success: false, message: 'Invalid support request id.' });
        }

        const requestDoc = await ChatbotSupportRequest.findById(requestId).exec();
        if (!requestDoc) {
            return res.status(404).json({ success: false, message: 'Support request not found.' });
        }
        if (['pending', 'accepted'].includes(requestDoc.status)) {
            return res.status(409).json({ success: false, message: 'Close or expire the chat before deleting it.' });
        }

        await requestDoc.deleteOne();
        return res.status(200).json({ success: true, message: 'Support chat deleted.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Failed to delete support chat.', error: error.message });
    }
};
