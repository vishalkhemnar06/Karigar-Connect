const nodemailer = require('nodemailer');

const parseNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseNumber(process.env.SMTP_PORT, 465);
const smtpSecure = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';

const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    pool: true,
    maxConnections: parseNumber(process.env.SMTP_MAX_CONNECTIONS, 5),
    maxMessages: parseNumber(process.env.SMTP_MAX_MESSAGES, 100),
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: parseNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 10000),
    greetingTimeout: parseNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 10000),
    socketTimeout: parseNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 20000),
    dnsTimeout: parseNumber(process.env.SMTP_DNS_TIMEOUT_MS, 10000),
});

// Verify transport connection once on load
transport.verify((error, success) => {
    if (error) {
        console.error('[EMAIL] Transporter error:', error.message);
    } else {
        console.log(`[EMAIL] Transporter ready (${smtpHost}:${smtpPort}, pool=true)`);
    }
});

const sendEmailMessage = async ({ to, subject, text, html, logPrefix = '[EMAIL]' }) => {
    if (!to || !subject || (!text && !html)) {
        throw new Error('to, subject and text/html are required.');
    }

    const startedAt = Date.now();
    const result = await transport.sendMail({
        from: `KarigarConnect <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html: html || text,
    });

    const elapsedMs = Date.now() - startedAt;
    console.log(`${logPrefix} Sent to ${to} in ${elapsedMs}ms. Message ID: ${result.messageId}`);
    return { success: true, messageId: result.messageId, elapsedMs };
};

exports.sendEmailMessage = sendEmailMessage;

exports.sendOtpEmail = async (to, otp) => {
    if (!to || !otp) {
        throw new Error('Email and OTP are required.');
    }

    try {
        const result = await sendEmailMessage({
            to,
            subject: 'Your KarigarConnect OTP',
            text: `Your KarigarConnect OTP is ${otp}. It is valid for 5 minutes. Do not share this OTP with anyone.`,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
                <h2 style="color:#ea580c;margin-bottom:8px">KarigarConnect OTP Verification</h2>
                <p>Your OTP is:</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:2px;color:#ea580c;margin:8px 0">${otp}</p>
                <p>This OTP is valid for 5 minutes. Do not share it with anyone.</p>
                <hr style="margin:20px 0;border:none;border-top:1px solid #ddd"/>
                <p style="font-size:12px;color:#999">If you did not request this OTP, please ignore this email.</p>
            </div>`,
        });
        return result;
    } catch (err) {
        console.error(`[EMAIL] Failed to send OTP to ${to}:`, err.message);
        throw err;
    }
};
