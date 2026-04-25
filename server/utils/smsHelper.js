// utils/smsHelper.js
// UPDATED: Added sendPasswordChangeOtpSms for OTP-based password change flow
// All original functions preserved exactly.

const twilio = require('twilio');

const hasTwilioConfig = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
);

const client = hasTwilioConfig
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const maskPhoneNumber = (value = '') => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length <= 4) return '****';
    return `***${digits.slice(-4)}`;
};

// ── BASE FUNCTION ─────────────────────────────────────────────────────────────
const sendSms = async (to, body) => {
    if (!to || !body) {
        console.warn('[SMS] Missing phone or message, skipping SMS');
        return { success: false, reason: 'missing_params' };
    }
    if (!client) {
        console.warn(`[SMS] ⚠️  Twilio not configured, SMS skipped to ${maskPhoneNumber(to)}`);
        return { success: false, reason: 'twilio_not_configured' };
    }
    try {
        const phoneNumber = to.startsWith('+') ? to : `+91${to}`;
        console.log(`[SMS] Sending to ${maskPhoneNumber(phoneNumber)} via Twilio...`);
        const result = await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber,
        });
        console.log(`[SMS] ✅ Sent successfully! SID: ${String(result.sid || '').slice(-8)}`);
        return { success: true, messageSid: result.sid };
    } catch (err) {
        console.error(`[SMS] ❌ Send failed to ${maskPhoneNumber(to)}:`, err.message);
        return { success: false, reason: 'send_error', error: err.message };
    }
};

// ── VERIFICATION HELPERS ──────────────────────────────────────────────────────
exports.sendOtpSms = async (to, otp) => {
    return sendSms(to, `Your KarigarConnect OTP is ${otp}. It is valid for 5 minutes. Do not share it with anyone.`);
};

exports.sendCustomSms = async (to, message) => {
    const result = await sendSms(to, message);
    return result;
};

exports.sendStatusUpdateSms = async (to, name, status) => {
    let body;
    switch (status) {
        case 'approved':
            body = `Congratulations ${name}! Your KarigarConnect profile is approved. Login now to start finding work.`;
            break;
        case 'rejected':
            body = `Hi ${name}, your KarigarConnect profile could not be approved at this time. You may re-apply after 15 days with updated details.`;
            break;
        case 'blocked':
            body = `Hi ${name}, your KarigarConnect account has been blocked due to a terms violation. Contact support for more information.`;
            break;
        default:
            return;
    }
    return sendSms(to, body);
};

// ── NEW: Password change OTP ──────────────────────────────────────────────────
exports.sendPasswordChangeOtpSms = async (to, otp, name) => {
    return sendSms(
        to,
        `Hi ${name || 'there'}, your KarigarConnect password change OTP is ${otp}. Valid for 10 minutes. Do not share this with anyone.`
    );
};

// ── NEW: Address Verification OTP ──────────────────────────────────────────────
exports.sendAddressVerificationOtp = async (to, otp, address) => {
    return sendSms(
        to,
        `Your KarigarConnect address verification OTP is ${otp}. We sent this to the address: ${address}. Valid for 10 minutes. Do not share this with anyone.`
    );
};

// ── GROUP / JOB HELPERS ───────────────────────────────────────────────────────
exports.sendGroupInviteSms = async (to) => {
    return sendSms(to, 'You have received a group invitation on KarigarConnect. Open the app to respond.');
};

exports.sendNewJobSmsToGroup = async (to) => {
    return sendSms(to, 'A new group job is available on KarigarConnect. Open the app to view and apply.');
};

exports.sendJobResponseSmsToClient = async (to, status) => {
    return sendSms(to, `A worker has ${status} your KarigarConnect group job proposal.`);
};

const formatDateTime = (dateValue, timeValue) => {
    const dateLabel = dateValue ? new Date(dateValue).toLocaleDateString('en-IN') : 'N/A';
    const timeLabel = timeValue ? String(timeValue).trim() : 'N/A';
    return `${dateLabel} ${timeLabel}`.trim();
};

const formatAddress = (job = {}) => {
    const parts = [
        job.location?.fullAddress,
        job.location?.buildingName,
        job.location?.unitNumber,
        job.location?.floorNumber,
        job.location?.locality,
        job.location?.city,
        job.location?.state,
    ].filter((part) => String(part || '').trim());

    if (parts.length) return parts.join(', ');

    return String(job.location?.address || job.address || job.location?.city || '').trim() || 'N/A';
};

exports.formatDateTime = formatDateTime;
exports.formatAddress = formatAddress;

exports.buildWorkerApplicationDecisionSms = ({
    accepted,
    jobTitle,
    clientName,
    clientMobile,
    scheduledDate,
    scheduledTime,
    address,
    rejectionReason,
}) => {
    if (accepted) {
        return [
            `KarigarConnect: You have been accepted for job "${jobTitle}".`,
            `Client: ${clientName || 'N/A'} | Mobile: ${clientMobile || 'N/A'}`,
            `Date/Time: ${formatDateTime(scheduledDate, scheduledTime)}`,
            `Address: ${address || 'N/A'}`,
        ].join('\n');
    }

    return [
        `KarigarConnect: Your application for job "${jobTitle}" was rejected.`,
        `Client: ${clientName || 'N/A'} | Mobile: ${clientMobile || 'N/A'}`,
        `Reason: ${rejectionReason || 'Not provided'}`,
    ].join('\n');
};

exports.buildWorkerPaymentSms = ({ jobTitle, amountPaid, clientName, clientMobile, dateTime }) => [
    `KarigarConnect: Payment received for job "${jobTitle}".`,
    `Amount Paid: ₹${Number(amountPaid || 0).toLocaleString('en-IN')}`,
    `Client: ${clientName || 'N/A'} | Mobile: ${clientMobile || 'N/A'}`,
    `Date/Time: ${dateTime || 'N/A'}`,
].join('\n');

exports.buildDirectHireInviteSms = ({ clientName, clientMobile, jobTitle, amount, dateTime, address }) => [
    `KarigarConnect: You have a direct hire invitation for job "${jobTitle}".`,
    `Client: ${clientName || 'N/A'} | Mobile: ${clientMobile || 'N/A'}`,
    `Amount you will get: ₹${Number(amount || 0).toLocaleString('en-IN')}`,
    `Date/Time: ${dateTime || 'N/A'}`,
    `Address: ${address || 'N/A'}`,
].join('\n');

exports.buildIvrJobDetailsSms = ({ jobTitle, clientName, clientMobile, amount, address, dateTime }) => [
    `KarigarConnect IVR Job Details`,
    `Job: ${jobTitle || 'N/A'}`,
    `Client: ${clientName || 'N/A'} | Mobile: ${clientMobile || 'N/A'}`,
    `Amount you will get: ₹${Number(amount || 0).toLocaleString('en-IN')}`,
    `Date/Time: ${dateTime || 'N/A'}`,
    `Address: ${address || 'N/A'}`,
].join('\n');

exports.buildIvrRegistrationSms = ({ registrationLink }) => [
    'Welcome to KarigarConnect!',
    `Register here: ${registrationLink}`,
    'Documents required: Aadhaar card, e-Shram card, photo, and certificates.',
    'Please keep all documents ready before registration.',
].join('\n');