const nodemailer = require('nodemailer');

const EMAIL_SEND_TIMEOUT_MS = 15000;

const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: EMAIL_SEND_TIMEOUT_MS,
});

const sendMailWithTimeout = (options) =>
    Promise.race([
        transport.sendMail(options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('email_send_timeout')), EMAIL_SEND_TIMEOUT_MS)
        ),
    ]);

exports.sendEmail = async ({ to, subject, text, html, from }) => {
    if (!to || !subject || (!text && !html)) {
        throw new Error('Email to, subject, and content are required.');
    }

    await sendMailWithTimeout({
        from: from || `KarigarConnect <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
        html,
    });
};

exports.sendOtpEmail = async (to, otp) => {
    if (!to || !otp) {
        throw new Error('Email and OTP are required.');
    }

    await exports.sendEmail({
        to,
        subject: 'Your KarigarConnect OTP',
        text: `Your KarigarConnect OTP is ${otp}. It is valid for 5 minutes. Do not share this OTP with anyone.`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
            <h2 style="color:#ea580c;margin-bottom:8px">KarigarConnect OTP Verification</h2>
            <p>Your OTP is:</p>
            <p style="font-size:28px;font-weight:700;letter-spacing:2px;color:#ea580c;margin:8px 0">${otp}</p>
            <p>This OTP is valid for 5 minutes. Do not share it with anyone.</p>
        </div>`,
    });
};
