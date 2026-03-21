// server/routes/authRoutes.js
const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const {
    registerWorker, registerClient,
    loginWithPassword, loginWithOtp,
    sendOtp, verifyOtp,
    getWorkerApplicationStatus,
    previewFaceSimilarity,
    forgotPassword, resetPassword,
} = require('../controllers/authController');
const { createUploader } = require('../utils/cloudinary');

// Uploader that accepts images AND PDFs (for ID documents)
const workerUpload = createUploader('karigarconnect/worker-docs', ['image', 'application/pdf']);
const clientUpload = createUploader('karigarconnect/client-docs', ['image', 'application/pdf']);
const previewUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/send-otp',    sendOtp);
router.post('/verify-otp',  verifyOtp);
router.post('/worker-application-status', getWorkerApplicationStatus);
router.post('/face-similarity-preview',
    previewUpload.fields([
        { name: 'idProof', maxCount: 1 },
        { name: 'livePhoto', maxCount: 1 },
    ]),
    previewFaceSimilarity
);

router.post('/register/worker',
    workerUpload.fields([
        { name: 'photo',              maxCount: 1  },
        { name: 'idProof',            maxCount: 1  },
        { name: 'skillCertificates',  maxCount: 5  },
        { name: 'portfolioPhotos',    maxCount: 10 },
        { name: 'eShramCard',         maxCount: 1  },
        { name: 'livePhoto',          maxCount: 1  }, // ← face verification capture
    ]),
    registerWorker
);

router.post('/register/client',
    clientUpload.fields([
        { name: 'photo',      maxCount: 1 },
        { name: 'idProof',    maxCount: 1 },
        { name: 'livePhoto',  maxCount: 1 }, // ← face verification capture
    ]),
    registerClient
);

router.post('/login-password',       loginWithPassword);
router.post('/login-otp',            loginWithOtp);
router.post('/forgot-password',      forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;
