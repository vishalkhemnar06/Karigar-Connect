const nodemailer = require('nodemailer');

const parseNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const smtpPort = 587;
const smtpSecure = false;

const createStartTlsTransport = ({ host, user, pass, pool = false, maxConnections, maxMessages }) => nodemailer.createTransport({
    host,
    port: 587,
    secure: false,
    requireTLS: true,
    tls: {
        minVersion: 'TLSv1.2',
        servername: host,
    },
    pool,
    maxConnections,
    maxMessages,
    connectionTimeout: parseNumber(process.env.SMTP_CONNECTION_TIMEOUT_MS, 60000),
    greetingTimeout: parseNumber(process.env.SMTP_GREETING_TIMEOUT_MS, 30000),
    socketTimeout: parseNumber(process.env.SMTP_SOCKET_TIMEOUT_MS, 60000),
    auth: {
        user,
        pass,
    },
});

const transport = createStartTlsTransport({
    host: smtpHost,
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    pool: false,
    maxConnections: parseNumber(process.env.SMTP_MAX_CONNECTIONS, 5),
    maxMessages: parseNumber(process.env.SMTP_MAX_MESSAGES, 100),
});

// Verify transport connection once on load
transport.verify((error, success) => {
    if (error) {
        console.error('[EMAIL] Transporter error:', error.message);
    } else {
        console.log(`[EMAIL] Transporter ready (${smtpHost}:587, STARTTLS, pool=true)`);
    }
});

const sendEmailMessage = async ({ to, subject, text, html, logPrefix = '[EMAIL]' }) => {
    if (!to || !subject || (!text && !html)) {
        throw new Error('to, subject and text/html are required.');
    }

    const maxRetries = parseNumber(process.env.SMTP_MAX_SEND_RETRIES, 1);
    const baseDelay  = parseNumber(process.env.SMTP_RETRY_BASE_MS, 500);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    let lastError = null;
    for (let attempt = 1; attempt <= (1 + maxRetries); attempt++) {
        try {
            const startedAt = Date.now();
            const result = await transport.sendMail({
                from: `KarigarConnect <${process.env.EMAIL_FROM}>`,
                to,
                subject,
                text,
                html: html || text,
            });
            const elapsedMs = Date.now() - startedAt;
            console.log(`${logPrefix} Sent to ${to} in ${elapsedMs}ms (attempt ${attempt}). Message ID: ${result.messageId}`);
            return { success: true, messageId: result.messageId, elapsedMs };
        } catch (err) {
            lastError = err;
            console.error(`${logPrefix} Attempt ${attempt} failed sending to ${to}:`, err.message || err);
            if (attempt <= maxRetries) {
                const backoff = baseDelay * Math.pow(2, attempt - 1);
                console.log(`${logPrefix} Retrying in ${backoff}ms...`);
                // small delay before retry
                // eslint-disable-next-line no-await-in-loop
                await sleep(backoff);
            }
        }
    }

    // Optional fallback SMTP provider if configured
    const fallbackHost = process.env.SMTP_FALLBACK_HOST || '';
    if (fallbackHost && fallbackHost !== smtpHost) {
        try {
            console.log(`${logPrefix} Trying fallback SMTP provider: ${fallbackHost}`);
            const fallbackTransport = createStartTlsTransport({
                host: fallbackHost,
                user: process.env.SMTP_FALLBACK_USER,
                pass: process.env.SMTP_FALLBACK_PASS,
                pool: false,
            });

            const startedAt = Date.now();
            const result = await fallbackTransport.sendMail({
                from: `KarigarConnect <${process.env.EMAIL_FROM}>`,
                to,
                subject,
                text,
                html: html || text,
            });
            const elapsedMs = Date.now() - startedAt;
            console.log(`${logPrefix} Fallback sent to ${to} in ${elapsedMs}ms. Message ID: ${result.messageId}`);
            return { success: true, messageId: result.messageId, elapsedMs, fallback: true };
        } catch (fbErr) {
            console.error(`${logPrefix} Fallback provider failed:`, fbErr.message || fbErr);
            lastError = fbErr;
        }
    }

    // All attempts failed
    throw lastError || new Error('Failed to send email (unknown error)');
};

exports.sendEmailMessage = sendEmailMessage;

exports.sendOtpEmail = async (to, otp) => {
    if (!to || !otp) {
        throw new Error('Email and OTP are required.');
    }

    const mailOptions = {
        from: `KarigarConnect <${process.env.EMAIL_FROM}>`,
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
    };

    try {
        const startedAt = Date.now();
        const result = await transport.sendMail(mailOptions);
        const elapsedMs = Date.now() - startedAt;
        console.log(`[EMAIL OTP] Sent to ${to} in ${elapsedMs}ms. Message ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId, elapsedMs };
    } catch (err) {
        console.error(`[EMAIL OTP] Primary send failed for ${to}:`, err.message || err);
        // Fallback to retry logic
        try {
            const fallbackResult = await sendEmailMessage({
                to,
                subject: 'Your KarigarConnect OTP',
                text: mailOptions.text,
                html: mailOptions.html,
                logPrefix: '[EMAIL OTP FALLBACK]',
            });
            return fallbackResult;
        } catch (fbErr) {
            console.error(`[EMAIL OTP] Fallback also failed for ${to}:`, fbErr.message || fbErr);
            throw fbErr;
        }
    }
};
