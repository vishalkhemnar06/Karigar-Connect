// client/src/utils/imageUrl.js
// FIXED:
//   - Normalises Windows backslashes  (uploads\file.jpg → uploads/file.jpg)
//   - Strips accidental leading slash before concatenating with BASE
//   - Handles nested { filePath, path, url } objects  (e.g. idProof field)
//   - Never returns an empty string — always returns the fallback

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

/**
 * Converts any stored file path / URL into a fully-qualified URL.
 *
 * Examples (BASE = http://localhost:5000):
 *   "uploads/photo.jpg"               → "http://localhost:5000/uploads/photo.jpg"
 *   "/uploads/photo.jpg"              → "http://localhost:5000/uploads/photo.jpg"
 *   "uploads\\WhatsApp_Image.jpeg"    → "http://localhost:5000/uploads/WhatsApp_Image.jpeg"
 *   "https://res.cloudinary.com/..."  → unchanged
 *   { filePath: "uploads/doc.pdf" }   → "http://localhost:5000/uploads/doc.pdf"
 *   null / undefined / ""             → fallback
 */
export const getImageUrl = (value, fallback = '/default-avatar.png') => {
    if (!value) return fallback;

    // Unwrap nested document objects  e.g.  idProof: { filePath: '...', idType: '...' }
    if (typeof value === 'object' && !Array.isArray(value)) {
        value = value.filePath || value.path || value.url || '';
    }

    if (!value || typeof value !== 'string') return fallback;
    if (value.trim() === '') return fallback;

    // Already an absolute URL — return as-is
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('//')) return `https:${value}`;

    // Normalise Windows back-slashes and strip leading slashes
    const normalised = value.replace(/\\/g, '/').replace(/^\/+/, '');

    if (!normalised) return fallback;

    return `${BASE}/${normalised}`;
};

/**
 * onError handler for <img> elements.
 * Prevents infinite loops and swaps in a placeholder image.
 *
 * Usage:
 *   <img src={getImageUrl(user.photo)} onError={imgError()} alt="" />
 *   <img src={getImageUrl(shop.logo)} onError={imgError('/shop-placeholder.png')} alt="" />
 */
export const imgError = (fallback = '/default-avatar.png') => (e) => {
    if (e.target.src.endsWith(fallback)) return;   // guard infinite loop
    e.target.onerror = null;
    e.target.src = fallback;
};

export default getImageUrl;