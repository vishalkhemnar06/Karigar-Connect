// server/middleware/communityUpload.js
// Handles community post media uploads to Cloudinary
// Works for both images and videos
// Uses multer-storage-cloudinary if available, falls back to disk storage

const path    = require('path');
const fs      = require('fs');
const multer  = require('multer');

// ─────────────────────────────────────────────────────────────────────────────
// Try to use Cloudinary (multer-storage-cloudinary)
// If not configured / package not installed, fall back to local disk storage
// and serve files as static assets
// ─────────────────────────────────────────────────────────────────────────────

let storage;
let useCloudinary = false;

try {
    const cloudinary             = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');

    // Cloudinary must be configured in .env:
    //   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
    if (
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY    &&
        process.env.CLOUDINARY_API_SECRET
    ) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key:    process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });

        storage = new CloudinaryStorage({
            cloudinary,
            params: async (req, file) => {
                const isVideo = file.mimetype.startsWith('video/');
                return {
                    folder:         'karigarconnect/community',
                    resource_type:  isVideo ? 'video' : 'image',
                    allowed_formats: isVideo
                        ? ['mp4', 'mov', 'avi', 'webm', 'mkv']
                        : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                    transformation: isVideo
                        ? []
                        : [{ width: 1200, crop: 'limit', quality: 'auto' }],
                };
            },
        });
        useCloudinary = true;
        console.log('✅  Community uploads → Cloudinary');
    }
} catch (err) {
    // multer-storage-cloudinary not installed or cloudinary not configured
}

// ── Fallback: local disk storage ──────────────────────────────────────────────
if (!useCloudinary) {
    const uploadDir = path.join(__dirname, '../uploads/community');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename:    (req, file, cb) => {
            const ext  = path.extname(file.originalname).toLowerCase();
            const name = `community_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
            cb(null, name);
        },
    });
    console.log('ℹ️   Community uploads → local disk (set CLOUDINARY_* env vars for Cloudinary)');
}

// ── Multer instance ───────────────────────────────────────────────────────────
const communityUpload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            return cb(null, true);
        }
        cb(new Error('Only image or video files are allowed.'));
    },
});

// ── Helper: extract public URL from uploaded file ─────────────────────────────
// Works for both Cloudinary (file.path / file.secure_url) and disk (file.filename)
const getMediaUrl = (req, file) => {
    if (!file) return null;

    // Cloudinary via multer-storage-cloudinary
    if (file.path && file.path.startsWith('http')) return file.path;
    if (file.secure_url)  return file.secure_url;
    if (file.url)         return file.url;

    // Local disk — build URL from request
    if (file.filename) {
        const protocol = req.protocol || 'http';
        const host     = req.get('host') || `localhost:${process.env.PORT || 5000}`;
        return `${protocol}://${host}/uploads/community/${file.filename}`;
    }

    return null;
};

const getMediaType = (file) => {
    if (!file) return null;
    const mime = file.mimetype || '';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('image/')) return 'image';
    return null;
};

module.exports = { communityUpload, getMediaUrl, getMediaType };