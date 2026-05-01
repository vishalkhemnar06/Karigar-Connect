const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Verify transport connection once on load
transport.verify((error, success) => {
    if (error) {
        console.error('[EMAIL] ❌ Transporter error:', error.message);
    } else {
        console.log('[EMAIL] ✅ Transporter ready');
    }
});

exports.sendOtpEmail = async (to, otp) => {
    if (!to || !otp) {
        throw new Error('Email and OTP are required.');
    }

    try {
        const result = await transport.sendMail({
            from: `KarigarConnect <${process.env.EMAIL_USER}>`,
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
        console.log(`[EMAIL] ✅ OTP sent to ${to}. Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId };
    } catch (err) {
        console.error(`[EMAIL] ❌ Failed to send OTP to ${to}:`, err.message);
        throw err;
    }
};
