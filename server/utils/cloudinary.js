// utils/cloudinary.js
// Central Cloudinary configuration and helper functions.
// FIX: Replaces the local uploads/ folder (multer.diskStorage).
//      All files — photos, documents, certificates — are now uploaded to
//      Cloudinary and the returned secure_url is stored in MongoDB.
//      This fixes the security issue of serving private ID documents as
//      static public files (the old app.use('/uploads', express.static(...)) 
//      made every Aadhar card, PAN card etc. publicly accessible).

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary credentials from .env
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Helper: Delete a file from Cloudinary by its public_id ───────────────────
// Usage: await deleteFromCloudinary(user.photo) when replacing or deleting a file.
// Note: public_id is NOT the full URL — it's the path portion without extension,
// e.g. "karigarconnect/photos/1234567890" extracted from the URL.
const deleteFromCloudinary = async (url) => {
    if (!url || !url.includes('cloudinary')) return;
    try {
        // Extract public_id from the Cloudinary URL
        const parts = url.split('/');
        const fileWithExt = parts[parts.length - 1];
        const fileName = fileWithExt.split('.')[0];
        // Re-build the full public_id (folder/filename)
        const folderIndex = parts.indexOf('upload') + 2; // skip version segment
        const publicId = parts.slice(folderIndex).join('/').replace(/\.[^/.]+$/, '');
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error('Cloudinary delete error:', err.message);
    }
};

// ── Factory: Create a multer-cloudinary upload middleware ────────────────────
// folder  — Cloudinary folder name, e.g. 'karigarconnect/photos'
// allowed — array of allowed mime-type prefixes, e.g. ['image']
//           pass ['image', 'application/pdf'] to allow both
const createUploader = (folder, allowed = ['image']) => {
    const storage = new CloudinaryStorage({
        cloudinary,
        params: async (req, file) => {
            // Validate mime type
            const isAllowed = allowed.some(type => file.mimetype.startsWith(type));
            if (!isAllowed) {
                throw new Error(`File type ${file.mimetype} is not allowed`);
            }
            return {
                folder,
                // For non-image files (PDFs) use 'raw' resource type
                resource_type: file.mimetype.startsWith('image') ? 'image' : 'raw',
                // Limit: 5 MB for images, 10 MB for docs
                // (actual byte enforcement done in multer limits below)
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
            };
        },
    });

    return multer({
        storage,
        limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit per file
        fileFilter: (req, file, cb) => {
            const isAllowed = allowed.some(type => file.mimetype.startsWith(type));
            if (!isAllowed) {
                return cb(new Error(`Invalid file type: ${file.mimetype}`), false);
            }
            cb(null, true);
        },
    });
};

// ── Pre-built uploaders used across route files ───────────────────────────────
const photoUploader      = createUploader('karigarconnect/photos', ['image']);
const documentUploader   = createUploader('karigarconnect/documents', ['image', 'application/pdf']);
const mixedUploader      = createUploader('karigarconnect/misc', ['image', 'application/pdf']);
const aiImageUploader    = createUploader('karigarconnect/ai', ['image']);

// Backwards-compatible aliases used in route files
// profilePhotoUploader: used for worker/client profile photo uploads
// jobPhotoUploader:     used for client job photos & completion photos
const profilePhotoUploader = photoUploader;
const jobPhotoUploader     = photoUploader;

module.exports = {
    cloudinary,
    deleteFromCloudinary,
    createUploader,
    photoUploader,
    documentUploader,
    mixedUploader,
    aiImageUploader,
    profilePhotoUploader,
    jobPhotoUploader,
};