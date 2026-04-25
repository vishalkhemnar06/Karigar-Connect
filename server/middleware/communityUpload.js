// server/middleware/communityUpload.js
// Handles community post media uploads in Cloudinary only.
const { createUploader } = require('../utils/cloudinary');

const communityUpload = createUploader('karigarconnect/community', ['image', 'video']);

// ── Helper: extract public URL from uploaded file ─────────────────────────────
const getMediaUrl = (req, file) => {
    if (!file) return null;

    if (file.path && file.path.startsWith('http')) return file.path;
    if (file.secure_url)  return file.secure_url;
    if (file.url)         return file.url;

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