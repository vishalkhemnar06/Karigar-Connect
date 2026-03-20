// server/controllers/authController.js
// Face verification is integrated into registerWorker and registerClient.
// The Python face service (port 8001) is called AFTER the user record is saved.
// If the face service is unreachable, registration proceeds gracefully with a
// faceVerificationStatus of 'skipped' and a server warning log.

const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const User     = require('../models/userModel');
const faceClient = require('../utils/faceServiceClient');
const { sendOtpSms } = require('../utils/smsHelper');
const { sendOtpEmail } = require('../utils/emailHelper');
const { logAuditEvent } = require('../utils/auditLogger');

// ── OTP store (in-memory; production: use Redis) ──────────────────────────────
const otpStore = new Map(); // key: mobile/email → { otp, expiry }
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateKarigarId = () =>
    'KC-' + Math.random().toString(36).substring(2, 7).toUpperCase() +
    Math.floor(100 + Math.random() * 900);

const signToken = (id, role) =>
    jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

const safeGet = (files, field) => files?.[field]?.[0] ?? null;

// ── OTP ───────────────────────────────────────────────────────────────────────
exports.sendOtp = async (req, res) => {
    try {
        const { mobile, email } = req.body;
        const identifier = mobile || email;
        if (!identifier) return res.status(400).json({ message: 'Mobile or email required.' });

        const otp    = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = Date.now() + OTP_TTL_MS;
        otpStore.set(identifier, { otp, expiry });

        if (mobile) {
            await sendOtpSms(mobile, otp);
        }
        if (email) {
            await sendOtpEmail(email, otp);
        }

        console.log(`[OTP] ${identifier} → ${otp}`);

        return res.json({ message: 'OTP sent successfully.' });
    } catch { return res.status(500).json({ message: 'Failed to send OTP.' }); }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { identifier, otp } = req.body;
        if (!identifier || !otp) return res.status(400).json({ message: 'identifier and otp required.' });

        const record = otpStore.get(identifier);
        if (!record)                     return res.status(400).json({ message: 'OTP not sent or expired.' });
        if (Date.now() > record.expiry)  return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
        if (record.otp !== otp.trim())   return res.status(400).json({ message: 'Invalid OTP.' });

        otpStore.delete(identifier);
        return res.json({ message: 'OTP verified successfully.' });
    } catch { return res.status(500).json({ message: 'Failed to verify OTP.' }); }
};

// Preview similarity for registration UI before final submit.
// Accepts multipart fields: idProof, livePhoto (memory uploads).
exports.previewFaceSimilarity = async (req, res) => {
    try {
        const idProofFile = safeGet(req.files, 'idProof');
        const livePhotoFile = safeGet(req.files, 'livePhoto');

        if (!idProofFile || !livePhotoFile) {
            return res.status(400).json({
                message: 'Both idProof and livePhoto are required.',
            });
        }

        const available = await faceClient.isAvailable();
        if (!available) {
            return res.status(503).json({
                message: 'Face verification service is not available. Please try again shortly.',
            });
        }

        const [idBuffer, liveBuffer] = [idProofFile.buffer, livePhotoFile.buffer];

        const [idResult, liveResult] = await Promise.all([
            faceClient.extractEmbedding(idBuffer, idProofFile.originalname || 'id_card.jpg'),
            faceClient.extractEmbedding(liveBuffer, livePhotoFile.originalname || 'live_face.jpg'),
        ]);

        if (!idResult?.face_detected) {
            return res.json({
                passed: false,
                similarity: 0,
                threshold: faceClient.WORKER_THRESHOLD,
                idFaceDetected: false,
                liveFaceDetected: !!liveResult?.face_detected,
                message: 'Face not detected in ID proof. Upload a clearer ID image.',
            });
        }

        if (!liveResult?.face_detected) {
            return res.json({
                passed: false,
                similarity: 0,
                threshold: faceClient.WORKER_THRESHOLD,
                idFaceDetected: true,
                liveFaceDetected: false,
                message: 'Live face not detected. Keep your face centered and well-lit.',
            });
        }

        const comparison = await faceClient.compareEmbeddings(idResult.embedding, liveResult.embedding);
        const similarity = Number(comparison?.similarity || 0);
        const threshold = Number(faceClient.WORKER_THRESHOLD);

        return res.json({
            passed: similarity >= threshold,
            similarity,
            threshold,
            idFaceDetected: true,
            liveFaceDetected: true,
            message: similarity >= threshold
                ? 'Face similarity check passed.'
                : 'Face similarity is below threshold. Please retry with a clearer face and better ID photo.',
        });
    } catch (err) {
        console.error('previewFaceSimilarity:', err.message);
        return res.status(500).json({ message: 'Unable to check face similarity right now.' });
    }
};

// ── REGISTER WORKER ───────────────────────────────────────────────────────────
exports.registerWorker = async (req, res) => {
    try {
        const {
            name, dob, mobile, email, password, confirmPassword,
            city, pincode, locality, overallExperience, experience,
            aadharNumber, gender, eShramNumber, idDocumentType,
            emergencyContactName, emergencyContactMobile, phoneType, skills, references,
        } = req.body;

        // ── Basic validation ──────────────────────────────────────────────────
        if (!name?.trim())    return res.status(400).json({ message: 'Full name is required.' });
        if (!mobile)          return res.status(400).json({ message: 'Mobile number is required.' });
        if (!password)        return res.status(400).json({ message: 'Password is required.' });
        if (password !== confirmPassword)
            return res.status(400).json({ message: 'Passwords do not match.' });
        if (dob && new Date().getFullYear() - new Date(dob).getFullYear() < 18)
            return res.status(400).json({ message: 'You must be at least 18 years old.' });

        // ── Duplicate check ───────────────────────────────────────────────────
        if (await User.findOne({ mobile }))
            return res.status(409).json({ message: 'Mobile number is already registered.' });
        if (email && await User.findOne({ email }))
            return res.status(409).json({ message: 'Email is already registered.' });

        // ── Uploaded file URLs (Cloudinary via multer) ────────────────────────
        const photoFile     = safeGet(req.files, 'photo');
        const idProofFile   = safeGet(req.files, 'idProof');
        const eShramFile    = safeGet(req.files, 'eShramCard');
        const livePhotoFile = safeGet(req.files, 'livePhoto');  // face capture

        if (!photoFile)   return res.status(400).json({ message: 'Profile photo is required.' });
        if (!idProofFile) return res.status(400).json({ message: 'ID proof is required.' });

        const skillCerts = req.files?.skillCertificates?.map(f => f.path) || [];
        const portfolio  = req.files?.portfolioPhotos?.map(f => f.path)   || [];

        let parsedSkills = [];
        try { parsedSkills = JSON.parse(skills || '[]'); } catch {}

        let parsedRefs = [];
        try { parsedRefs = JSON.parse(references || '[]'); } catch {}

        // ── Create user ───────────────────────────────────────────────────────
        const hashed = await bcrypt.hash(password, 12);
        const user   = await User.create({
            karigarId: generateKarigarId(),
            role: 'worker', name: name.trim(), dob, mobile, phoneType,
            email: email || null, password: hashed,
            address:   { city, pincode, locality },
            idProof:   { idType: idDocumentType || 'Aadhar Card', filePath: idProofFile.path },
            photo:     photoFile.path,
            gender,    aadharNumber, eShramNumber,
            eShramCardPath: eShramFile?.path || null,
            overallExperience, experience: Number(experience) || 0,
            skills: parsedSkills, references: parsedRefs,
            skillCertificates: skillCerts, portfolioPhotos: portfolio,
            emergencyContact: { name: emergencyContactName, mobile: emergencyContactMobile },
            verificationStatus: 'pending',
            faceVerificationStatus: 'pending_review',
        });

        // ── Face verification (non-blocking) ─────────────────────────────────
        if (livePhotoFile) {
            runWorkerFaceVerification(user, idProofFile.path, livePhotoFile.path)
                .catch(err => console.error('[FaceVerification] Worker async error:', err.message));
        } else {
            await User.findByIdAndUpdate(user._id, { faceVerificationStatus: 'skipped' });
            console.warn(`[FaceVerification] No live photo for worker ${user._id} — skipped`);
        }

        return res.status(201).json({
            message: 'Registration submitted. Your profile is under review.',
            requiresApproval: true,
            faceVerification: livePhotoFile ? 'processing' : 'skipped',
        });

    } catch (err) {
        console.error('registerWorker:', err);
        return res.status(500).json({ message: err.message || 'Registration failed.' });
    }
};

/** Background task: extract ID + live embeddings, compare, store result */
const runWorkerFaceVerification = async (user, idProofUrl, livePhotoUrl) => {
    const available = await faceClient.isAvailable();
    if (!available) {
        await User.findByIdAndUpdate(user._id, { faceVerificationStatus: 'skipped' });
        console.warn(`[FaceVerification] Face service unavailable for worker ${user._id}`);
        return;
    }

    try {
        // Download images from Cloudinary
        const [idBuffer, liveBuffer] = await Promise.all([
            faceClient.downloadImage(idProofUrl),
            faceClient.downloadImage(livePhotoUrl),
        ]);

        // Extract embeddings
        const [idResult, liveResult] = await Promise.all([
            faceClient.extractEmbedding(idBuffer,   'id_card.jpg'),
            faceClient.extractEmbedding(liveBuffer, 'live_face.jpg'),
        ]);

        if (!idResult.face_detected) {
            await User.findByIdAndUpdate(user._id, {
                faceVerificationStatus: 'failed',
                liveFacePhoto: livePhotoUrl,
            });
            console.warn(`[FaceVerification] No face in ID card for worker ${user._id}`);
            return;
        }
        if (!liveResult.face_detected) {
            await User.findByIdAndUpdate(user._id, {
                faceVerificationStatus: 'failed',
                liveFacePhoto: livePhotoUrl,
            });
            console.warn(`[FaceVerification] No face in live photo for worker ${user._id}`);
            return;
        }

        // Compare
        const comparison = await faceClient.compareEmbeddings(
            idResult.embedding, liveResult.embedding
        );

        const passed = comparison.similarity >= faceClient.WORKER_THRESHOLD;

        await User.findByIdAndUpdate(user._id, {
            faceEmbedding:          liveResult.embedding,
            idFaceEmbedding:        idResult.embedding,
            liveFacePhoto:          livePhotoUrl,
            faceVerificationScore:  comparison.similarity,
            faceVerified:           passed,
            faceVerifiedAt:         new Date(),
            faceVerificationStatus: passed ? 'passed' : 'failed',
        });

        console.log(
            `[FaceVerification] Worker ${user._id} — similarity=${comparison.similarity.toFixed(3)} ${passed ? '✅ PASSED' : '❌ FAILED'}`
        );
    } catch (err) {
        await User.findByIdAndUpdate(user._id, { faceVerificationStatus: 'skipped' });
        console.error(`[FaceVerification] Worker ${user._id} error:`, err.message);
    }
};

// ── REGISTER CLIENT ───────────────────────────────────────────────────────────
exports.registerClient = async (req, res) => {
    try {
        const {
            name, mobile, email, password, confirmPassword,
            city, pincode, homeLocation, houseNumber, idType, workplaceInfo, socialProfile,
        } = req.body;

        // ── Validation ────────────────────────────────────────────────────────
        if (!name?.trim())  return res.status(400).json({ message: 'Name is required.' });
        if (!mobile)        return res.status(400).json({ message: 'Mobile is required.' });
        if (!email)         return res.status(400).json({ message: 'Email is required.' });
        if (!password)      return res.status(400).json({ message: 'Password is required.' });
        if (password !== confirmPassword)
            return res.status(400).json({ message: 'Passwords do not match.' });

        if (await User.findOne({ mobile }))
            return res.status(409).json({ message: 'Mobile number is already registered.' });
        if (await User.findOne({ email }))
            return res.status(409).json({ message: 'Email is already registered.' });

        // ── File URLs ─────────────────────────────────────────────────────────
        const photoFile     = safeGet(req.files, 'photo');
        const idProofFile   = safeGet(req.files, 'idProof');
        const livePhotoFile = safeGet(req.files, 'livePhoto');

        if (!livePhotoFile)
            return res.status(400).json({ message: 'Live face photo is required for identity verification.' });
        if (!idProofFile)
            return res.status(400).json({ message: 'ID proof is required for identity verification.' });

        // ── Face match + duplicate check for clients ─────────────────────────
        const faceServiceUp = await faceClient.isAvailable();
        if (!faceServiceUp) {
            return res.status(503).json({
                message: 'Identity verification service is temporarily unavailable. Please try again in a moment.',
            });
        }

        let faceEmbedding        = null;
        let idFaceEmbedding      = null;
        let faceVerificationScore = null;
        let faceVerified         = false;
        let faceVerificationStatus = 'skipped';
        let liveFacePhoto        = livePhotoFile?.path || null;

        if (faceServiceUp) {
            const [idBuffer, liveBuffer] = await Promise.all([
                faceClient.downloadImage(idProofFile.path),
                faceClient.downloadImage(livePhotoFile.path),
            ]);

            const [idResult, liveResult] = await Promise.all([
                faceClient.extractEmbedding(idBuffer, 'client_id.jpg'),
                faceClient.extractEmbedding(liveBuffer, 'live_face.jpg'),
            ]);

            if (!idResult.face_detected) {
                return res.status(400).json({
                    message: 'No face detected in ID proof. Please upload a clearer ID image.',
                    faceError: true,
                });
            }

            if (!liveResult.face_detected) {
                return res.status(400).json({
                    message: 'No face detected in the live photo. Please redo the face verification with better lighting.',
                    faceError: true,
                });
            }

            const comparison = await faceClient.compareEmbeddings(idResult.embedding, liveResult.embedding);
            const similarity = Number(comparison?.similarity || 0);
            const threshold = Number(faceClient.WORKER_THRESHOLD);

            if (similarity < threshold) {
                return res.status(400).json({
                    message: 'Face similarity is below threshold. Please retry face verification and upload a clearer ID photo.',
                    faceError: true,
                    similarity,
                    threshold,
                });
            }

            // Fetch all existing client face embeddings for duplicate check
            const existingClients = await User.find({ role: 'client', faceEmbedding: { $exists: true, $ne: null } })
                .select('faceEmbedding')
                .lean();
            const storedEmbeddings = existingClients
                .map(c => c.faceEmbedding)
                .filter(e => Array.isArray(e) && e.length === 512);

            if (storedEmbeddings.length > 0) {
                const dupResult = await faceClient.checkDuplicate(liveResult.embedding, storedEmbeddings);
                if (dupResult.is_duplicate) {
                    console.warn(`[FaceVerification] Duplicate face detected (similarity=${dupResult.max_similarity.toFixed(3)})`);
                    return res.status(409).json({
                        message: 'A KarigarConnect account already exists for this face. Duplicate registrations are not allowed.',
                        duplicateFace: true,
                        similarity: dupResult.max_similarity,
                    });
                }
            }

            faceEmbedding          = liveResult.embedding;
            idFaceEmbedding        = idResult.embedding;
            faceVerificationScore  = similarity;
            faceVerified           = true;
            faceVerificationStatus = 'passed';
            console.log(`[FaceVerification] Client verified — similarity=${similarity.toFixed(3)} ✅ no duplicate found`);
        }

        // ── Create client ─────────────────────────────────────────────────────
        const hashed = await bcrypt.hash(password, 12);
        const user   = await User.create({
            karigarId: generateKarigarId(),
            role: 'client', name: name.trim(), mobile, email,
            password: hashed,
            photo:     photoFile?.path || null,
            address:   { city, pincode, homeLocation, houseNumber },
            idProof:   { idType: idType || 'Aadhar', filePath: idProofFile?.path || null },
            workplaceInfo, socialProfile,
            verificationStatus: 'approved',  // clients auto-approved
            faceEmbedding,
            idFaceEmbedding,
            faceVerificationScore,
            liveFacePhoto,
            faceVerified,
            faceVerificationStatus,
            faceVerifiedAt: faceVerified ? new Date() : null,
        });

        const token = signToken(user._id, 'client');
        return res.status(201).json({
            message: 'Account created successfully!',
            token,
            user: {
                id: user._id, name: user.name, role: 'client',
                photo: user.photo, karigarId: user.karigarId,
            },
            faceVerification: faceVerificationStatus,
        });

    } catch (err) {
        console.error('registerClient:', err);
        return res.status(500).json({ message: err.message || 'Registration failed.' });
    }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.loginWithPassword = async (req, res) => {
    try {
        const { role, mobile, password } = req.body;
        if (!mobile || !password) return res.status(400).json({ message: 'Mobile and password required.' });

        if (role === 'admin') {
            const adminMobile = String(process.env.ADMIN_MOBILE || '').trim();
            const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
            const submittedMobile = String(mobile).trim();
            const submittedPassword = String(password).trim();

            if (!adminMobile || !adminPassword) {
                return res.status(500).json({ message: 'Admin credentials are not configured.' });
            }

            if (submittedMobile !== adminMobile || submittedPassword !== adminPassword) {
                await logAuditEvent({ action: 'failed_login', req, metadata: { role: 'admin', mobile: submittedMobile } });
                return res.status(401).json({ message: 'Invalid mobile number or password.' });
            }

            await logAuditEvent({ action: 'login', req, metadata: { role: 'admin', mobile: submittedMobile } });

            const token = jwt.sign(
                { mobile: adminMobile, role: 'admin' },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            return res.json({
                message: 'Login successful.',
                token,
                user: {
                    id: 'admin',
                    name: 'Admin',
                    role: 'admin',
                    photo: null,
                    karigarId: 'ADMIN',
                },
            });
        }

        const user = await User.findOne({ mobile }).select('+password');
        if (!user) {
            await logAuditEvent({ action: 'failed_login', req, metadata: { mobile, reason: 'user_not_found' } });
            return res.status(401).json({ message: 'Invalid mobile number or password.' });
        }
        if (user.verificationStatus === 'blocked') {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { reason: 'blocked' } });
            return res.status(403).json({ message: 'Your account has been blocked. Contact support.' });
        }
        if (user.role === 'worker' && user.verificationStatus !== 'approved') {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { reason: 'worker_not_approved', status: user.verificationStatus } });
            return res.status(403).json({ message: 'Your worker profile is pending admin approval.', status: user.verificationStatus });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            await logAuditEvent({ userId: user._id, role: user.role, action: 'failed_login', req, metadata: { reason: 'password_mismatch' } });
            return res.status(401).json({ message: 'Invalid mobile number or password.' });
        }

        await logAuditEvent({ userId: user._id, role: user.role, action: 'login', req });

        const token = signToken(user._id, user.role);
        return res.json({
            message: 'Login successful.',
            token,
            user: { id: user._id, name: user.name, role: user.role, photo: user.photo, karigarId: user.karigarId },
        });
    } catch { return res.status(500).json({ message: 'Login failed.' }); }
};

exports.loginWithOtp = async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        if (!mobile || !otp) return res.status(400).json({ message: 'Mobile and OTP required.' });

        const record = otpStore.get(mobile);
        if (!record || Date.now() > record.expiry || record.otp !== otp.trim()) {
            const existingUser = await User.findOne({ mobile }).select('_id role');
            await logAuditEvent({
                userId: existingUser?._id,
                role: existingUser?.role,
                action: 'failed_login',
                req,
                metadata: { method: 'otp', reason: 'invalid_or_expired_otp' },
            });
            return res.status(400).json({ message: 'Invalid or expired OTP.' });
        }
        otpStore.delete(mobile);

        const user = await User.findOne({ mobile });
        if (!user) return res.status(404).json({ message: 'No account found for this mobile number.' });

        await logAuditEvent({ userId: user._id, role: user.role, action: 'login', req, metadata: { method: 'otp' } });

        const token = signToken(user._id, user.role);
        return res.json({
            message: 'Login successful.',
            token,
            user: { id: user._id, name: user.name, role: user.role, photo: user.photo, karigarId: user.karigarId },
        });
    } catch { return res.status(500).json({ message: 'Login failed.' }); }
};

// ── PASSWORD RESET ────────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return res.status(400).json({ message: 'Mobile required.' });
        const user = await User.findOne({ mobile });
        if (!user) return res.status(404).json({ message: 'No account found.' });

        const token  = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken  = crypto.createHash('sha256').update(token).digest('hex');
        user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);
        await user.save({ validateBeforeSave: false });

        // In production: send reset link via SMS/Email
        console.log(`[PasswordReset] Token for ${mobile}: ${token}`);
        return res.json({ message: 'Password reset instructions sent.', resetToken: token });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};

exports.resetPassword = async (req, res) => {
    try {
        const hashed = crypto.createHash('sha256').update(req.params.token).digest('hex');
        const user   = await User.findOne({
            resetPasswordToken:  hashed,
            resetPasswordExpire: { $gt: Date.now() },
        });
        if (!user) return res.status(400).json({ message: 'Reset token is invalid or has expired.' });
        user.password            = await bcrypt.hash(req.body.password, 12);
        user.resetPasswordToken  = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        return res.json({ message: 'Password reset successful. Please login.' });
    } catch { return res.status(500).json({ message: 'Failed.' }); }
};
