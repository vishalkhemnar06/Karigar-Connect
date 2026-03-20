// server/utils/faceServiceClient.js
// Node.js client for the Python InsightFace microservice.
// All heavy ML work happens in Python; this module handles HTTP calls.

const axios = require('axios');
const FormData = require('form-data');

const BASE = process.env.FACE_SERVICE_URL || 'http://localhost:8001';
const TIMEOUT_EXTRACT = 30_000;  // 30s — model inference
const TIMEOUT_COMPARE = 10_000;  // 10s — pure math
const TIMEOUT_HEALTH  =  3_000;

/** Worker: ID card face vs live face similarity threshold */
const WORKER_THRESHOLD = 0.50;

/** Client: duplicate face detection threshold (stricter) */
const DUPLICATE_THRESHOLD = 0.85;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check whether the Python face service is reachable.
 * Returns true/false — never throws.
 */
const isAvailable = async () => {
    try {
        const { data } = await axios.get(`${BASE}/health`, { timeout: TIMEOUT_HEALTH });
        return data?.status === 'ok' && data?.models_loaded === true;
    } catch {
        return false;
    }
};

/**
 * Download an image from a URL (e.g. Cloudinary) into a Buffer.
 */
const downloadImage = async (url) => {
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 15_000 });
    return Buffer.from(resp.data);
};

/**
 * Extract a 512-dim ArcFace embedding from an image.
 * @param {Buffer} imageBuffer
 * @param {string} [filename='image.jpg']
 * @returns {{ face_detected: boolean, embedding: number[]|null, detection_score: number|null, message: string }}
 */
const extractEmbedding = async (imageBuffer, filename = 'image.jpg') => {
    const fd = new FormData();
    fd.append('image', imageBuffer, { filename, contentType: 'image/jpeg' });
    const { data } = await axios.post(`${BASE}/extract-embedding`, fd, {
        headers: fd.getHeaders(),
        timeout: TIMEOUT_EXTRACT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
    });
    return data;
};

/**
 * Compare two embeddings.
 * @returns {{ similarity: number, match: boolean, confidence: string }}
 */
const compareEmbeddings = async (emb1, emb2) => {
    const { data } = await axios.post(
        `${BASE}/compare`,
        { embedding1: emb1, embedding2: emb2 },
        { timeout: TIMEOUT_COMPARE }
    );
    return data;
};

/**
 * Check if a new embedding is a duplicate of any stored embedding.
 * @param {number[]} embedding
 * @param {number[][]} storedEmbeddings   — fetched from MongoDB
 * @param {number} [threshold=0.85]
 * @returns {{ max_similarity: number, is_duplicate: boolean }}
 */
const checkDuplicate = async (embedding, storedEmbeddings, threshold = DUPLICATE_THRESHOLD) => {
    const { data } = await axios.post(
        `${BASE}/check-duplicate`,
        { embedding, stored_embeddings: storedEmbeddings, threshold },
        { timeout: TIMEOUT_COMPARE }
    );
    return data;
};

module.exports = {
    isAvailable,
    downloadImage,
    extractEmbedding,
    compareEmbeddings,
    checkDuplicate,
    WORKER_THRESHOLD,
    DUPLICATE_THRESHOLD,
};
