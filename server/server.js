// server/server.js
// UPDATED: Added workerComplaintRoutes at /api/worker/complaints
//          (mounted BEFORE /api/worker to avoid route conflicts)
// All original code preserved exactly.

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');
const path     = require('path');
const fs       = require('fs');
const axios    = require('axios');

dotenv.config();

const authRoutes             = require('./routes/authRoutes');
const adminRoutes            = require('./routes/adminRoutes');
const workerRoutes           = require('./routes/workerRoutes');
const clientRoutes           = require('./routes/clientRoutes');
const aiRoutes               = require('./routes/aiRoutes');
const groupRoutes            = require('./routes/groupRoutes');
const jobRoutes              = require('./routes/jobRoutes');
const adminFraudRoutes       = require('./routes/adminFraudRoutes');
const clientComplaintRoutes  = require('./routes/clientComplaintRoutes');
const adminWorkerComplaintRoutes = require('./routes/adminWorkerComplaintRoutes');
const workerComplaintRoutes  = require('./routes/workerComplaintRoutes'); // NEW
const communityRoutes        = require('./routes/communityRoutes');
const adminCommunityRoutes   = require('./routes/adminCommunityRoutes');
const locationRoutes         = require('./routes/locationRoutes');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const allowedOrigins = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:5173']
    : ['http://localhost:5173'];

app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error(`CORS policy: Origin ${origin} is not allowed`));
    },
    credentials: true,
}));

// ── Static files ──────────────────────────────────────────────────────────────
const legacyStaticDirs = [
    { url: '/uploads/photos',  dir: 'uploads/photos'  },
    { url: '/uploads/ai',      dir: 'uploads/ai'      },
    { url: '/uploads/clients', dir: 'uploads/clients' },
];
legacyStaticDirs.forEach(({ url, dir }) => {
    const abs = path.join(__dirname, dir);
    if (fs.existsSync(abs)) app.use(url, express.static(abs));
});

const communityUploadDir = path.join(__dirname, 'uploads/community');
if (!fs.existsSync(communityUploadDir)) fs.mkdirSync(communityUploadDir, { recursive: true });
app.use('/uploads/community', express.static(communityUploadDir));

// ── Database ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅  MongoDB connected'))
    .catch(err => { console.error('❌  MongoDB connection failed:', err.message); process.exit(1); });

// ── Routes — specific paths BEFORE their parent prefix ────────────────────────
app.use('/api/auth',                   authRoutes);
app.use('/api/admin/fraud',            adminFraudRoutes);
app.use('/api/admin/worker-complaints',  adminWorkerComplaintRoutes);   // NEW — before /api/admin
app.use('/api/admin/community',        adminCommunityRoutes);   // before /api/admin
app.use('/api/admin',                  adminRoutes);
app.use('/api/client/complaints',      clientComplaintRoutes);  // before /api/client
app.use('/api/client',                 clientRoutes);
app.use('/api/worker/complaints',      workerComplaintRoutes);  // NEW — before /api/worker
app.use('/api/worker',                 workerRoutes);
app.use('/api/community',              communityRoutes);
app.use('/api/ai',                     aiRoutes);
app.use('/api/groups',                 groupRoutes);
app.use('/api/jobs',                   jobRoutes);
app.use('/api/location',               locationRoutes);

// ── Health checks ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', message: '🚀 KarigarConnect API', version: '2.2.0' }));
app.get('/api/health', (req, res) => res.json({
    status: 'ok', uptime: process.uptime(),
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
}));
app.get('/api/fraud/health', async (req, res) => {
    try {
        const { data } = await axios.get(`${process.env.FRAUD_SERVICE_URL || 'http://localhost:5001'}/health`, { timeout: 5000 });
        return res.json({ status: 'ok', service: data });
    } catch (error) {
        return res.status(503).json({ status: 'degraded', message: 'Fraud service unavailable.', error: error.response?.data?.error || error.message });
    }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: `Route ${req.method} ${req.path} not found` }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Global error handler:', err.message);
    if (err.code === 'LIMIT_FILE_SIZE')        return res.status(413).json({ message: 'File too large. Maximum 50 MB.' });
    if (err.code === 'LIMIT_UNEXPECTED_FILE')  return res.status(400).json({ message: `Unexpected file field: ${err.field}` });
    if (err.message?.includes('Only image'))   return res.status(400).json({ message: err.message });
    if (err.message?.includes('Invalid file')) return res.status(400).json({ message: err.message });
    if (err.message?.includes('CORS'))         return res.status(403).json({ message: err.message });
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ message: messages.join(', ') });
    }
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || 'field';
        return res.status(409).json({ message: `Duplicate value for ${field}.` });
    }
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ message: 'Invalid token.' });
    if (err.name === 'TokenExpiredError')  return res.status(401).json({ message: 'Token expired. Please log in again.' });
    return res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT   = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
    console.log(`🚀  Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`)
);
process.on('SIGTERM', () => { server.close(async () => { await mongoose.connection.close().catch(console.error); process.exit(0); }); });
process.on('SIGINT',  () => { server.close(async () => { await mongoose.connection.close().catch(console.error); process.exit(0); }); });