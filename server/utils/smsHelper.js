// utils/smsHelper.js
// UPDATED: Added sendPasswordChangeOtpSms for OTP-based password change flow
// All original functions preserved exactly.

const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// ── BASE FUNCTION ─────────────────────────────────────────────────────────────
const sendSms = async (to, body) => {
    if (!to || !body) return;
    try {
        await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to.startsWith('+') ? to : `+91${to}`,
        });
    } catch (err) {
        console.error(`SMS send failed to ${to}:`, err.message);
    }
};

// ── VERIFICATION HELPERS ──────────────────────────────────────────────────────
exports.sendOtpSms = async (to, otp) => {
    await sendSms(to, `Your KarigarConnect OTP is ${otp}. It is valid for 5 minutes. Do not share it with anyone.`);
};

exports.sendCustomSms = async (to, message) => {
    await sendSms(to, message);
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
    await sendSms(to, body);
};

// ── NEW: Password change OTP ──────────────────────────────────────────────────
exports.sendPasswordChangeOtpSms = async (to, otp, name) => {
    await sendSms(
        to,
        `Hi ${name || 'there'}, your KarigarConnect password change OTP is ${otp}. Valid for 10 minutes. Do not share this with anyone.`
    );
};

// ── GROUP / JOB HELPERS ───────────────────────────────────────────────────────
exports.sendGroupInviteSms = async (to) => {
    await sendSms(to, 'You have received a group invitation on KarigarConnect. Open the app to respond.');
};

exports.sendNewJobSmsToGroup = async (to) => {
    await sendSms(to, 'A new group job is available on KarigarConnect. Open the app to view and apply.');
};

exports.sendJobResponseSmsToClient = async (to, status) => {
    await sendSms(to, `A worker has ${status} your KarigarConnect group job proposal.`);
};