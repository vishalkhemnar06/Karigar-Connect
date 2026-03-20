// utils/smsHelper.js
// FIXES:
//  1. CRITICAL — sendSms() base function was MISSING (the file said
//     "// existing code unchanged above..." but the actual Twilio call
//     was never there). Every SMS call threw ReferenceError: sendSms is not defined.
//  2. Duplicate export of sendGroupInviteSms removed (was exported twice).
//  3. All exported functions now safely catch Twilio errors so an SMS failure
//     does not crash the calling controller.

const twilio = require('twilio');

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

// ── BASE FUNCTION ─────────────────────────────────────────────────────────────
// All other helpers call this. Errors are caught here so a failed SMS never
// throws and never crashes the controller that called it.
const sendSms = async (to, body) => {
    if (!to || !body) return;
    try {
        await client.messages.create({
            body,
            from: process.env.TWILIO_PHONE_NUMBER,
            // Normalise: prefix +91 only if not already a full E.164 number
            to: to.startsWith('+') ? to : `+91${to}`,
        });
    } catch (err) {
        // Log but do not re-throw — SMS failure should never break the API response
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
            return; // Don't send for unknown statuses
    }
    await sendSms(to, body);
};

// ── GROUP / JOB HELPERS ───────────────────────────────────────────────────────
// FIX: sendGroupInviteSms was exported TWICE — duplicate removed.
exports.sendGroupInviteSms = async (to) => {
    await sendSms(to, 'You have received a group invitation on KarigarConnect. Open the app to respond.');
};

exports.sendNewJobSmsToGroup = async (to) => {
    await sendSms(to, 'A new group job is available on KarigarConnect. Open the app to view and apply.');
};

exports.sendJobResponseSmsToClient = async (to, status) => {
    await sendSms(to, `A worker has ${status} your KarigarConnect group job proposal.`);
};