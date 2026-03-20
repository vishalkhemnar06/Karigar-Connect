const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

exports.sendOtpEmail = async (to, otp) => {
    if (!to || !otp) {
        throw new Error('Email and OTP are required.');
    }

    await transport.sendMail({
        from: `KarigarConnect <${process.env.EMAIL_USER}>`,
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
