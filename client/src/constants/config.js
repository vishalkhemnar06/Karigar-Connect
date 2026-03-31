// src/constants/config.js
// Central config — import BASE_URL and getImageUrl everywhere instead of
// hardcoding http://localhost:5000 in every component.

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Returns a displayable image URL.
 * - If path is a full Cloudinary/http URL → return as-is
 * - If path is a relative local path → prepend BASE_URL
 * - If path is null/undefined → return fallback
 *
 * @param {string|null} path  - photo field from the DB
 * @param {string} fallback   - fallback image URL
 */
export const getImageUrl = (path, fallback = '/default-avatar.png') => {
    if (!path) return fallback;

    // Absolute or Cloudinary URL
    if (path.startsWith('http://') || path.startsWith('https://')) return path;

    let normalised = String(path).replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalised) return fallback;

    // If path is a Cloudinary public id style, return a Cloudinary hosted URL.
    const cloudinaryIdPattern = /^(?:.+\/)?karigarconnect\/.+/i;
    if (cloudinaryIdPattern.test(normalised)) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dykxnkbav';
        const resourceType = /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(normalised) ? 'image' : 'raw';
        return `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${normalised}`;
    }

    // If a full local disk path was stored (e.g. C:/.../uploads/photos/abc.jpg),
    // strip everything before the uploads/ segment so the server static route
    // `/uploads/...` can serve it correctly.
    const idx = normalised.indexOf('uploads/');
    if (idx > -1) {
        normalised = normalised.slice(idx);
    }

    normalised = normalised.replace(/^\/+/, '');

    return `${BASE_URL}/${normalised}`;
};