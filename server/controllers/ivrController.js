const axios = require('axios');
const Groq = require('groq-sdk');

const User = require('../models/userModel');
const Job = require('../models/jobModel');
const IvrSession = require('../models/ivrSessionModel');
const IvrUnregisteredLead = require('../models/ivrUnregisteredLeadModel');
const { sendCustomSms } = require('../utils/smsHelper');
const {
    applyForJobByWorker,
    cancelPendingApplicationByWorker,
    CANCEL_APPLICATION_CUTOFF_MINUTES,
} = require('../services/jobApplicationService');

let groq = null;
try {
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
} catch (err) {
    console.error('⚠️  Groq SDK initialization failed:', err.message);
    console.error('    IVR speech intent extraction will be disabled.');
}

const twilio = require('twilio');

const REGISTRATION_LINK = process.env.REGISTRATION_URL || 'https://www.karigarconnect.in/register';
const VOICE_ACTION_URL = `${process.env.NODE_BASE_URL || 'http://localhost:5000'}/api/ivr/twilio/state`;

const SKILL_MENU = {
    '1': 'plumber',
    '2': 'electrician',
    '3': 'carpenter',
    '4': 'painter',
    '5': 'cleaner',
    '6': 'handyman',
};

const LANG_MENU = { '1': 'hi', '2': 'mr', '3': 'en' };

const M = {
    hi: {
        unregistered: 'Aap KarigarConnect par registered nahi hain.',
        unregisteredMenu: 'Registration ki jankari ke liye 1 dabayein. Registration link SMS paane ke liye 2 dabayein. Options dobara sunane ke liye 7 dabayein.',
        unregisteredInfo: 'Register karne ke liye KarigarConnect app ya web portal par jaakar apni details bhar kar account banaiye.',
        thankYouRegister: 'Dhanyawad. Kripya register karne ke baad phir se call karein.',
        languageMenu: 'Bhasha chuniyega. Hindi ke liye 1, Marathi ke liye 2, English ke liye 3 dabaiye. Options dobara sunane ke liye 7 dabaiye.',
        welcomeLocalized: 'KarigarConnect mein aapka swagat hai.',
        mainMenu: 'Main menu. Availability update ke liye 1. Nearby jobs ke liye 2. Leaderboard ke liye 3. Profile summary ke liye 4. Help ke liye 5. Bhasha badalne ke liye 8. Call band karne ke liye 0 dabaiye. Options dobara sunane ke liye 7 dabaiye.',
        availabilityMenu: 'Availability set karne ke liye 1 available, 2 busy dabaiye. Main menu ke liye 9 dabaiye. Options dobara sunane ke liye 7 dabaiye.',
        availabilityUpdated: 'Aapki availability update ho gayi hai.',
        busyCannotApply: 'Aap dusre kaam mein vyast hain. Pehle availability available kariye.',
        jobModeMenu: 'Job search mode. Bolkar search ke liye 1. Skill manually chunne ke liye 2 dabaiye. Main menu ke liye 9 dabaiye. Options dobara sunane ke liye 7 dabaiye.',
        speakPrompt: 'Kripya boliye, jaise: mujhe Pimpri mein plumber ki job chahiye.',
        skillMenu: 'Skill chuniyega. Plumber 1, Electrician 2, Carpenter 3, Painter 4, Cleaner 5, Handyman 6. Main menu ke liye 9 dabaiye. Options dobara sunane ke liye 7 dabaiye.',
        locationMenu: 'Default location se search ke liye 1 dabaiye. Sabhi shehron me search ke liye 2 dabaiye. Main menu ke liye 9 dabaiye. Options dobara sunane ke liye 7 dabaiye.',
        noJobs: 'Filhaal koi matching job nahi mili. Main menu par wapas ja rahe hain.',
        jobOptions: 'Job details SMS ke liye 1. Dobara sunne ke liye 2. Apply ke liye 3. Agli job ke liye 4. Main menu ke liye 5. Applied job cancel ke liye 6. Quick summary ke liye 7. Options dobara sunane ke liye 8. Call band karne ke liye 0 dabaiye.',
        appliedSuccess: 'Aapki application bhej di gayi hai.',
        cancelAppliedSuccess: 'Aapki application cancel kar di gayi hai.',
        cancelAppliedNotFound: 'Aapne abhi tak apply nahi kiya hai.',
        cancelAppliedTooLate: `Application cancel sirf ${CANCEL_APPLICATION_CUTOFF_MINUTES} minute ke andar allowed hai.`,
        helpMain: 'Sahayata: 1 se availability set hoti hai. 2 se nearby jobs milti hain. 3 se leaderboard sun sakte hain. 4 se profile summary milegi. Kisi bhi time galat input par system dobara menu sunayega.',
        profileSummaryPrefix: 'Aapki profile summary.',
        availabilityAvailable: 'Aap is waqt available hain.',
        availabilityBusy: 'Aap is waqt busy hain.',
        pointsLine: 'Aapke points',
        cityLine: 'Aapka default shehar',
        unknownCity: 'set nahi hai',
        callEnding: 'Call samapt ki ja rahi hai. Dhanyawad.',
        quickSummaryPrefix: 'Quick summary.',
        quickSummaryJobsLeft: 'Bache hue jobs',
        smsSent: 'SMS bhej diya gaya hai.',
        invalid: 'Galat input. Kripya dobara prayas kariye.',
        goodbye: 'Dhanyawad. KarigarConnect ko call karne ke liye shukriya.',
    },
    mr: {
        unregistered: 'Tumhi KarigarConnect var registered nahi aahat.',
        unregisteredMenu: 'Registration mahitisaathi 1 daba. Registration link SMS saathi 2 daba. Options punha aiknyasathi 7 daba.',
        unregisteredInfo: 'KarigarConnect app kiwa web portal var details bharun account tayar kara.',
        thankYouRegister: 'Dhanyavad. Registration nantar punha call kara.',
        languageMenu: 'Bhasha niwada. Hindi sathi 1, Marathi sathi 2, English sathi 3 daba. Options punha aiknyasathi 7 daba.',
        welcomeLocalized: 'KarigarConnect madhe tumcha swagat aahe.',
        mainMenu: 'Main menu. Availability update sathi 1. Nearby jobs sathi 2. Leaderboard sathi 3. Profile summary sathi 4. Help sathi 5. Bhasha badalnyasathi 8 daba. Call band sathi 0 daba. Options punha aiknyasathi 7 daba.',
        availabilityMenu: 'Availability update sathi 1 available, 2 busy daba. Main menu sathi 9 daba. Options punha aiknyasathi 7 daba.',
        availabilityUpdated: 'Tumchi availability update zali aahe.',
        busyCannotApply: 'Tumhi dusrya kaamat vyast aahat.',
        jobModeMenu: 'Job search mode. Bolun search sathi 1. Skill manually sathi 2 daba. Main menu sathi 9 daba. Options punha aiknyasathi 7 daba.',
        speakPrompt: 'Kripya bola, udaharan: mala Pimpri madhe plumber chi job pahije.',
        skillMenu: 'Skill niwada. Plumber 1, Electrician 2, Carpenter 3, Painter 4, Cleaner 5, Handyman 6. Main menu sathi 9 daba. Options punha aiknyasathi 7 daba.',
        locationMenu: 'Default location sathi 1. Sarva city sathi 2. Main menu sathi 9 daba. Options punha aiknyasathi 7 daba.',
        noJobs: 'Sadhya matching job nahi. Main menu var jaat aahot.',
        jobOptions: 'Job SMS sathi 1. Punha aiknyasathi 2. Apply sathi 3. Pudhil job sathi 4. Main menu sathi 5. Applied cancel sathi 6. Quick summary sathi 7. Options punha aiknyasathi 8 daba. Call band sathi 0 daba.',
        appliedSuccess: 'Tumchi application pathavli geli aahe.',
        cancelAppliedSuccess: 'Tumchi application cancel keli aahe.',
        cancelAppliedNotFound: 'Tumhi ajun apply kele nahi.',
        cancelAppliedTooLate: `Application cancel fakt ${CANCEL_APPLICATION_CUTOFF_MINUTES} minitanchya aat allowed aahe.`,
        helpMain: 'Madat: 1 ne availability update hote. 2 ne nearby jobs miltat. 3 ne leaderboard aikata yeto. 4 ne profile summary milte. Chukicha input asel tar system punha menu sangel.',
        profileSummaryPrefix: 'Tumchi profile summary.',
        availabilityAvailable: 'Tumhi sadhya available aahat.',
        availabilityBusy: 'Tumhi sadhya busy aahat.',
        pointsLine: 'Tumche points',
        cityLine: 'Tumcha default city',
        unknownCity: 'set nahi',
        callEnding: 'Call samapta hot aahe. Dhanyavad.',
        quickSummaryPrefix: 'Quick summary.',
        quickSummaryJobsLeft: 'Uralelya jobs',
        smsSent: 'SMS pathavla aahe.',
        invalid: 'Chukicha input. Punha prayatna kara.',
        goodbye: 'Dhanyavad. KarigarConnect la call kelyabaddal abhar.',
    },
    en: {
        unregistered: 'You are not registered on KarigarConnect.',
        unregisteredMenu: 'Press 1 for registration information. Press 2 to receive registration link by SMS. Press 7 to hear options again.',
        unregisteredInfo: 'Please register using KarigarConnect app or web portal and complete your profile details.',
        thankYouRegister: 'Thank you. Please call again after registration.',
        languageMenu: 'Select language. Press 1 for Hindi, 2 for Marathi, 3 for English. Press 7 to hear options again.',
        welcomeLocalized: 'Welcome to KarigarConnect.',
        mainMenu: 'Main menu. Press 1 for availability update. Press 2 for nearby jobs. Press 3 for leaderboard. Press 4 for profile summary. Press 5 for help. Press 8 to change language. Press 0 to end call. Press 7 to hear options again.',
        availabilityMenu: 'Press 1 for available. Press 2 for busy. Press 9 for main menu. Press 7 to hear options again.',
        availabilityUpdated: 'Your availability has been updated.',
        busyCannotApply: 'You are currently busy with another task.',
        jobModeMenu: 'Job search mode. Press 1 to speak. Press 2 to choose skill manually. Press 9 for main menu. Press 7 to hear options again.',
        speakPrompt: 'Please speak now. Example: I need a plumber job in Pimpri.',
        skillMenu: 'Choose skill. Plumber 1, Electrician 2, Carpenter 3, Painter 4, Cleaner 5, Handyman 6. Press 9 for main menu. Press 7 to hear options again.',
        locationMenu: 'Press 1 to use default location. Press 2 to search all cities. Press 9 for main menu. Press 7 to hear options again.',
        noJobs: 'No matching jobs found right now. Returning to main menu.',
        jobOptions: 'Press 1 for job SMS. Press 2 to repeat. Press 3 to apply. Press 4 for next job. Press 5 for main menu. Press 6 to cancel applied job. Press 7 for quick summary. Press 8 to hear options again. Press 0 to end call.',
        appliedSuccess: 'Your application has been submitted.',
        cancelAppliedSuccess: 'Your application has been cancelled.',
        cancelAppliedNotFound: 'You have not applied yet.',
        cancelAppliedTooLate: `Application cancellation is allowed only within ${CANCEL_APPLICATION_CUTOFF_MINUTES} minutes.`,
        helpMain: 'Help: Press 1 to update availability. Press 2 to search jobs. Press 3 to hear leaderboard. Press 4 for profile summary. If you enter a wrong key, the menu is repeated.',
        profileSummaryPrefix: 'Your profile summary.',
        availabilityAvailable: 'You are currently available.',
        availabilityBusy: 'You are currently busy.',
        pointsLine: 'Your points are',
        cityLine: 'Your default city is',
        unknownCity: 'not set',
        callEnding: 'Ending this call. Thank you.',
        quickSummaryPrefix: 'Quick summary.',
        quickSummaryJobsLeft: 'Jobs remaining',
        smsSent: 'SMS sent successfully.',
        invalid: 'Invalid input. Please try again.',
        goodbye: 'Thank you for calling KarigarConnect.',
    },
};

const xmlEscape = (text = '') =>
    String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const TTS_LANG_MAP = {
    hi: 'hi-IN',
    mr: 'mr-IN',
    en: 'en-IN',
};

const TTS_VOICE_MAP = {
    hi: process.env.TWILIO_TTS_VOICE_HI || 'hi-IN-Standard-A',
    mr: process.env.TWILIO_TTS_VOICE_MR || 'mr-IN-Standard-A',
    en: process.env.TWILIO_TTS_VOICE_EN || 'en-IN-Chirp3-HD-Kore',
};

const getTtsLanguage = (session) => TTS_LANG_MAP[getLang(session)] || 'en-IN';

const getTtsVoiceByLanguage = (language = '') => {
    if (String(language).startsWith('mr')) return TTS_VOICE_MAP.mr;
    if (String(language).startsWith('hi')) return TTS_VOICE_MAP.hi;
    if (String(language).startsWith('en')) return TTS_VOICE_MAP.en;
    return TTS_VOICE_MAP.en;
};

const say = (text, language = '') => {
    const langAttr = language ? ` language="${xmlEscape(language)}"` : '';
    const voice = language ? getTtsVoiceByLanguage(language) : '';
    const voiceAttr = voice ? ` voice="${xmlEscape(voice)}"` : '';
    return `<Say${langAttr}${voiceAttr}>${xmlEscape(text)}</Say>`;
};
const hangup = () => '<Hangup/>';
const gather = ({ session = null, prompt, action = VOICE_ACTION_URL, numDigits = 1, timeout = 8, sid = '' }) => {
    const actionUrl = sid && !action.includes('?') 
        ? `${action}?sid=${encodeURIComponent(sid)}` 
        : action;
    return `<Gather action="${xmlEscape(actionUrl)}" method="POST" numDigits="${numDigits}" timeout="${timeout}">${say(prompt, session ? getTtsLanguage(session) : '')}</Gather>`;
};
const xmlResponse = (...parts) => `<?xml version="1.0" encoding="UTF-8"?><Response>${parts.join('')}</Response>`;

const normalizePhone = (input = '') => {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return digits;
    if (digits.length > 10) return digits.slice(-10);
    return digits;
};

const getRequestPhone = (body = {}) =>
    body.From || body.from || body.Caller || body.CallFrom || body.PhoneNumber || '';

const getCallSid = (body = {}) =>
    body.CallSid || body.CallUUID || body.call_sid || body.callSid || body.CallId || '';

const getDigits = (body = {}) =>
    String(body.Digits ?? body.digits ?? body.dtMfDigits ?? body.input ?? '').trim();

const getSpeechText = (body = {}) =>
    String(body.SpeechResult || body.speech || body.transcript || '').trim();

const findWorkerByPhone = async (phone) => {
    const clean = normalizePhone(phone);
    if (!clean) return null;
    const candidates = [
        clean,
        `+91${clean}`,
        `91${clean}`,
        phone,
    ];

    return User.findOne({
        role: 'worker',
        mobile: { $in: [...new Set(candidates)] },
    }).select('name mobile role verificationStatus availability skills address points');
};

const pushEvent = (session, type, detail = '', data = undefined) => {
    session.events.push({ type, detail, data });
};

const getLang = (session) => session?.language || 'hi';
const msg = (session, key) => M[getLang(session)][key] || M.hi[key] || '';

const upsertUnregisteredLead = async (phone) => {
    const clean = normalizePhone(phone);
    if (!clean) return;
    const doc = await IvrUnregisteredLead.findOne({ phone: clean });
    if (doc) {
        // Document exists, increment calls
        await IvrUnregisteredLead.findOneAndUpdate(
            { phone: clean },
            {
                $set: { lastSeenAt: new Date() },
                $inc: { callsCount: 1 },
            },
            { new: true }
        );
    } else {
        // Document doesn't exist, create it with callsCount = 1
        await IvrUnregisteredLead.create({
            phone: clean,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
            callsCount: 1,
        });
    }
};

const markLeadSmsSent = async (phone) => {
    const clean = normalizePhone(phone);
    if (!clean) return;
    await IvrUnregisteredLead.findOneAndUpdate(
        { phone: clean },
        {
            $set: { lastSeenAt: new Date(), lastRegistrationSmsAt: new Date() },
            $inc: { registrationSmsSentCount: 1 },
        },
        { upsert: true, new: true }
    );
};

const tryTriggerCallback = async (phone, callSid) => {
    // Twilio callback is handled via twiml.gather action, not explicit callback trigger
    return { attempted: false, reason: 'twilio_uses_gather_action' };
};

const extractIntentFromSpeech = async (speech) => {
    if (!groq) {
        console.warn('⚠️  Groq not available; using fallback intent parsing');
        return { skill: '', location: '' };
    }
    
    try {
        const prompt = `Extract job intent from this sentence and return only valid JSON with keys skill and location. Sentence: ${speech}`;
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            temperature: 0,
            messages: [
                {
                    role: 'system',
                    content: 'Return JSON only. Example: {"skill":"plumber","location":"pimpri"}.',
                },
                { role: 'user', content: prompt },
            ],
        });

        const raw = completion.choices?.[0]?.message?.content || '{}';
        const cleaned = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();

        const parsed = JSON.parse(cleaned);
        return {
            skill: String(parsed.skill || '').toLowerCase().trim(),
            location: String(parsed.location || '').toLowerCase().trim(),
        };
    } catch (err) {
        console.error('⚠️  Groq call failed:', err.message);
        return { skill: '', location: '' };
    }
};

const normalizeText = (value = '') =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
};

const SKILL_ALIASES = {
    plumber: ['plumber', 'plumbing', 'pipe', 'pipes', 'water line'],
    electrician: ['electrician', 'electrical', 'wiring', 'wireman'],
    carpenter: ['carpenter', 'carpentry', 'woodwork', 'furniture'],
    painter: ['painter', 'painting', 'paint'],
    cleaner: ['cleaner', 'cleaning', 'housekeeping'],
    handyman: ['handyman', 'technician', 'repair', 'maintenance'],
    general: ['general'],
};

const toSkillSet = (value = '') => {
    const normalized = normalizeText(value);
    if (!normalized) return new Set();

    const matches = new Set([normalized]);
    Object.entries(SKILL_ALIASES).forEach(([root, aliases]) => {
        const found = aliases.some((alias) => {
            const normAlias = normalizeText(alias);
            return normalized === normAlias || normalized.includes(normAlias) || normAlias.includes(normalized);
        });
        if (found) {
            matches.add(root);
            aliases.forEach((alias) => matches.add(normalizeText(alias)));
        }
    });
    return matches;
};

const hasWorkerApplication = (job, workerId) => {
    if (!workerId) return false;
    const wid = String(workerId);
    return (job.applicants || []).some((app) => app.workerId?.toString() === wid);
};

const fetchCandidateJobs = async ({ worker, skill = '', city = '', limit = 5 }) => {
    const workerSkills = (worker.skills || [])
        .map((s) => (typeof s === 'string' ? s : s?.name || ''))
        .map((s) => s.toLowerCase().trim())
        .filter(Boolean);

    const skillFilter = skill || workerSkills[0] || '';
    const cityFilter = normalizeText(city || worker.address?.city || '');
    const workerPincode = String(worker.address?.pincode || '').trim();
    const workerLat = toNumber(worker.address?.lat);
    const workerLng = toNumber(worker.address?.lng);
    const maxDistanceKm = Number(process.env.IVR_JOB_MATCH_RADIUS_KM || 20);

    const jobs = await Job.find({
        status: { $in: ['open', 'scheduled'] },
        applicationsOpen: true,
        visibility: true,
    })
        .populate('postedBy', 'name mobile')
        .sort({ createdAt: -1 })
        .limit(100);

    const filtered = jobs.filter((job) => {
        if (hasWorkerApplication(job, worker?._id)) return false;

        const openSlots = (job.workerSlots || []).filter((s) => s.status === 'open');
        if (!openSlots.length) return false;

        if (skillFilter) {
            const requestedSkillSet = toSkillSet(skillFilter);
            const slotSkills = openSlots
                .map((s) => toSkillSet(s.skill || ''))
                .filter(Boolean);
            const jobSkills = (job.skills || [])
                .map((s) => toSkillSet(s))
                .filter(Boolean);

            const hasSkill = [...slotSkills, ...jobSkills].some((candidateSet) => {
                if (!candidateSet?.size) return false;
                return [...requestedSkillSet].some((value) => candidateSet.has(value));
            });
            if (!hasSkill) return false;
        }

        if (cityFilter) {
            const jobCity = normalizeText(job.location?.city || '');
            const jobPincode = String(job.location?.pincode || '').trim();
            const jobLat = toNumber(job.location?.lat);
            const jobLng = toNumber(job.location?.lng);

            const hasAnyLocationSignal = !!jobCity || !!jobPincode || (jobLat !== null && jobLng !== null);
            if (!hasAnyLocationSignal) return true;

            const cityMatches =
                !!jobCity && (jobCity.includes(cityFilter) || cityFilter.includes(jobCity));
            const pincodeMatches = !!workerPincode && !!jobPincode && workerPincode === jobPincode;

            let nearbyMatches = false;
            if (
                workerLat !== null &&
                workerLng !== null &&
                jobLat !== null &&
                jobLng !== null &&
                maxDistanceKm > 0
            ) {
                nearbyMatches = haversineKm(workerLat, workerLng, jobLat, jobLng) <= maxDistanceKm;
            }

            if (!cityMatches && !pincodeMatches && !nearbyMatches) return false;
        }

        return true;
    });

    // If strict location yields no jobs, fallback to skill-only match to avoid false "no jobs" responses.
    if (!filtered.length && cityFilter) {
        return jobs.filter((job) => {
            if (hasWorkerApplication(job, worker?._id)) return false;

            const openSlots = (job.workerSlots || []).filter((s) => s.status === 'open');
            if (!openSlots.length) return false;

            if (!skillFilter) return true;
            const requestedSkillSet = toSkillSet(skillFilter);
            const slotSkills = openSlots.map((s) => toSkillSet(s.skill || ''));
            const jobSkills = (job.skills || []).map((s) => toSkillSet(s));

            return [...slotSkills, ...jobSkills].some((candidateSet) =>
                [...requestedSkillSet].some((value) => candidateSet?.has(value))
            );
        }).slice(0, limit);
    }

    return filtered.slice(0, limit);
};

const getCurrentJob = async (session) => {
    if (!session.presentedJobIds?.length) return null;
    const idx = Math.min(session.cursor || 0, session.presentedJobIds.length - 1);
    const jobId = session.presentedJobIds[idx];
    return Job.findById(jobId).populate('postedBy', 'name mobile');
};

const jobPrompt = (job, lang = 'hi') => {
    if (!job) return '';
    const city = job.location?.city || 'your area';
    const skill = job.workerSlots?.find((s) => s.status === 'open')?.skill || job.skills?.[0] || 'general';
    const money = job.payment || job.totalEstimatedCost || 0;

    if (lang === 'mr') {
        return `Ek job aahe ${city} madhe, ${skill} kaam, ${money} rupaye.`;
    }
    if (lang === 'en') {
        return `One job found in ${city}, ${skill} work, budget ${money} rupees.`;
    }
    return `Ek job mila hai ${city} mein, ${skill} ka kaam, ${money} rupaye.`;
};

const sendJobSms = async (phone, job) => {
    const text = [
        `Job: ${job.title}`,
        `Skill: ${job.workerSlots?.find((s) => s.status === 'open')?.skill || job.skills?.[0] || 'general'}`,
        `Location: ${job.location?.city || ''}`,
        `Budget: Rs ${job.payment || job.totalEstimatedCost || 0}`,
        `Client: ${job.postedBy?.mobile || 'N/A'}`,
    ].join('\n');
    await sendCustomSms(phone, text);
};

const respondXml = (res, xml) => {
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(xml);
};

const renderMainMenu = (session) => {
    session.state = 'main_menu';
    return xmlResponse(gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
};

const profileSummaryPrompt = (session, worker) => {
    const city = worker?.address?.city || msg(session, 'unknownCity');
    const availabilityLine = worker?.availability ? msg(session, 'availabilityAvailable') : msg(session, 'availabilityBusy');
    const points = Number(worker?.points || 0);

    if (session.language === 'en') {
        return `${msg(session, 'profileSummaryPrefix')} ${availabilityLine} ${msg(session, 'pointsLine')} ${points}. ${msg(session, 'cityLine')} ${city}.`;
    }
    if (session.language === 'mr') {
        return `${msg(session, 'profileSummaryPrefix')} ${availabilityLine} ${msg(session, 'pointsLine')} ${points}. ${msg(session, 'cityLine')} ${city}.`;
    }
    return `${msg(session, 'profileSummaryPrefix')} ${availabilityLine} ${msg(session, 'pointsLine')} ${points}. ${msg(session, 'cityLine')} ${city}.`;
};

const jobQuickSummaryPrompt = (session) => {
    const total = session.presentedJobIds?.length || 0;
    const currentIndex = Math.min((session.cursor || 0) + 1, Math.max(total, 1));
    const jobsLeft = Math.max(total - currentIndex, 0);

    if (session.language === 'en') {
        return `${msg(session, 'quickSummaryPrefix')} Job ${currentIndex} of ${Math.max(total, 1)}. ${msg(session, 'quickSummaryJobsLeft')}: ${jobsLeft}.`;
    }
    if (session.language === 'mr') {
        return `${msg(session, 'quickSummaryPrefix')} Job ${currentIndex} paiki ${Math.max(total, 1)}. ${msg(session, 'quickSummaryJobsLeft')}: ${jobsLeft}.`;
    }
    return `${msg(session, 'quickSummaryPrefix')} Job ${currentIndex} mein se ${Math.max(total, 1)}. ${msg(session, 'quickSummaryJobsLeft')}: ${jobsLeft}.`;
};

const handleUnregisteredState = async (session, digits) => {
    if (!digits) {
        session.state = 'unregistered_menu';
        return xmlResponse(
            say(msg(session, 'unregistered')),
            gather({ session, prompt: msg(session, 'unregisteredMenu'), sid: session.callSid })
        );
    }

    if (digits === '7') {
        pushEvent(session, 'menu_selected', 'unregistered_repeat');
        return xmlResponse(gather({ session, prompt: msg(session, 'unregisteredMenu'), sid: session.callSid }));
    }

    if (digits === '1') {
        pushEvent(session, 'menu_selected', 'unregistered_info');
        session.ended = true;
        session.endReason = 'registration_info_provided';
        return xmlResponse(say(msg(session, 'unregisteredInfo')), say(msg(session, 'thankYouRegister')), hangup());
    }

    if (digits === '2') {
        await sendCustomSms(session.phone, `Register here: ${REGISTRATION_LINK}`);
        await markLeadSmsSent(session.phone);
        pushEvent(session, 'sms_sent', 'registration_link');
        session.ended = true;
        session.endReason = 'registration_sms_sent';
        return xmlResponse(say(msg(session, 'smsSent')), say(msg(session, 'thankYouRegister')), hangup());
    }

    session.retries += 1;
    pushEvent(session, 'invalid_input', 'unregistered_menu', { digits });
    if (session.retries >= 2) {
        session.ended = true;
        session.endReason = 'invalid_input_exceeded';
        return xmlResponse(say(msg(session, 'invalid')), say(msg(session, 'goodbye')), hangup());
    }

    return xmlResponse(gather({ session, prompt: `${msg(session, 'invalid')} ${msg(session, 'unregisteredMenu')}`, sid: session.callSid }));
};

const handleRegisteredFlow = async (session, worker, digits, speech) => {
    if (session.state === 'language_menu') {
        if (!digits) {
            return xmlResponse(gather({ session, prompt: msg(session, 'languageMenu'), sid: session.callSid }));
        }

        if (digits === '7') {
            pushEvent(session, 'menu_selected', 'language_menu_repeat');
            return xmlResponse(gather({ session, prompt: msg(session, 'languageMenu'), sid: session.callSid }));
        }

        if (!LANG_MENU[digits]) {
            session.retries += 1;
            pushEvent(session, 'invalid_input', 'language_menu', { digits });
            return xmlResponse(gather({ session, prompt: `${msg(session, 'invalid')} ${msg(session, 'languageMenu')}`, sid: session.callSid }));
        }
        session.language = LANG_MENU[digits];
        session.retries = 0;
        pushEvent(session, 'language_selected', session.language);
        session.state = 'main_menu';
        return xmlResponse(
            say(msg(session, 'welcomeLocalized'), getTtsLanguage(session)),
            gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid })
        );
    }

    if (session.state === 'main_menu') {
        if (digits === '0') {
            session.ended = true;
            session.endReason = 'user_exit_main_menu';
            pushEvent(session, 'menu_selected', 'exit_call');
            return xmlResponse(say(msg(session, 'callEnding')), hangup());
        }
        if (digits === '7') {
            pushEvent(session, 'menu_selected', 'main_menu_repeat');
            return xmlResponse(gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
        }
        if (digits === '8') {
            session.state = 'language_menu';
            pushEvent(session, 'menu_selected', 'change_language');
            return xmlResponse(gather({ session, prompt: msg(session, 'languageMenu'), sid: session.callSid }));
        }
        if (digits === '1') {
            session.state = 'availability_menu';
            pushEvent(session, 'menu_selected', 'availability_update');
            return xmlResponse(gather({ session, prompt: msg(session, 'availabilityMenu'), sid: session.callSid }));
        }
        if (digits === '2') {
            session.state = 'job_mode_menu';
            pushEvent(session, 'menu_selected', 'nearby_jobs');
            return xmlResponse(gather({ session, prompt: msg(session, 'jobModeMenu'), sid: session.callSid }));
        }
        if (digits === '3') {
            const rank = await User.countDocuments({ role: 'worker', points: { $gt: worker.points || 0 } }) + 1;
            pushEvent(session, 'menu_selected', 'leaderboard', { rank, points: worker.points || 0 });
            const line = session.language === 'en'
                ? `Your leaderboard rank is ${rank}. Your points are ${worker.points || 0}.`
                : session.language === 'mr'
                    ? `Tumcha rank ${rank} aahe. Tumche points ${worker.points || 0} aahet.`
                    : `Aapka leaderboard rank ${rank} hai. Aapke points ${worker.points || 0} hain.`;
            return xmlResponse(say(line, getTtsLanguage(session)), gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
        }
        if (digits === '4') {
            pushEvent(session, 'menu_selected', 'profile_summary');
            return xmlResponse(say(profileSummaryPrompt(session, worker), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
        }
        if (digits === '5') {
            pushEvent(session, 'menu_selected', 'help');
            return xmlResponse(say(msg(session, 'helpMain'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
        }

        pushEvent(session, 'invalid_input', 'main_menu', { digits });
        return xmlResponse(gather({ session, prompt: `${msg(session, 'invalid')} ${msg(session, 'mainMenu')}`, sid: session.callSid }));
    }

    if (session.state === 'availability_menu') {
        if (digits === '7') {
            pushEvent(session, 'menu_selected', 'availability_menu_repeat');
            return xmlResponse(gather({ session, prompt: msg(session, 'availabilityMenu'), sid: session.callSid }));
        }
        if (digits === '9') {
            pushEvent(session, 'menu_selected', 'availability_back_to_main');
            return renderMainMenu(session);
        }
        if (digits === '1') worker.availability = true;
        else if (digits === '2') worker.availability = false;
        else {
            pushEvent(session, 'invalid_input', 'availability_menu', { digits });
            return xmlResponse(gather({ session, prompt: `${msg(session, 'invalid')} ${msg(session, 'availabilityMenu')}`, sid: session.callSid }));
        }

        await worker.save();
        session.state = 'main_menu';
        pushEvent(session, 'menu_selected', 'availability_saved', { availability: worker.availability });
        return xmlResponse(say(msg(session, 'availabilityUpdated'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
    }

    if (session.state === 'job_mode_menu') {
        if (digits === '7') {
            pushEvent(session, 'menu_selected', 'job_mode_menu_repeat');
            return xmlResponse(gather({ session, prompt: msg(session, 'jobModeMenu'), sid: session.callSid }));
        }
        if (digits === '9') {
            pushEvent(session, 'menu_selected', 'job_mode_back_to_main');
            return renderMainMenu(session);
        }
        if (digits === '1') {
            session.state = 'ai_collect';
            pushEvent(session, 'job_mode_selected', 'ai_voice');
            return xmlResponse(gather({ session, prompt: msg(session, 'speakPrompt'), numDigits: 1, timeout: 10, sid: session.callSid }));
        }
        if (digits === '2') {
            session.state = 'manual_skill_menu';
            pushEvent(session, 'job_mode_selected', 'manual_skill');
            return xmlResponse(gather({ session, prompt: msg(session, 'skillMenu'), sid: session.callSid }));
        }

        pushEvent(session, 'invalid_input', 'job_mode_menu', { digits });
        return xmlResponse(gather({ session, prompt: `${msg(session, 'invalid')} ${msg(session, 'jobModeMenu')}`, sid: session.callSid }));
    }

    if (session.state === 'manual_skill_menu') {
        if (digits === '7') {
            pushEvent(session, 'menu_selected', 'manual_skill_menu_repeat');
            return xmlResponse(gather({ session, prompt: msg(session, 'skillMenu'), sid: session.callSid }));
        }
        if (digits === '9') {
            pushEvent(session, 'menu_selected', 'manual_skill_back_to_main');
            return renderMainMenu(session);
        }
        const skill = SKILL_MENU[digits || ''];
        if (!skill) {
            pushEvent(session, 'invalid_input', 'manual_skill_menu', { digits });
            return xmlResponse(gather({ session, prompt: `${msg(session, 'invalid')} ${msg(session, 'skillMenu')}`, sid: session.callSid }));
        }

        session.intent.skill = skill;
        session.state = 'location_menu';
        pushEvent(session, 'intent_success', 'manual_skill_selected', { skill });
        return xmlResponse(gather({ session, prompt: msg(session, 'locationMenu'), sid: session.callSid }));
    }

    if (session.state === 'ai_collect') {
        const spoken = speech || '';
        if (!spoken) {
            pushEvent(session, 'stt_failed', 'empty_speech');
            session.state = 'manual_skill_menu';
            return xmlResponse(gather({ session, prompt: msg(session, 'skillMenu'), sid: session.callSid }));
        }

        session.transcript = spoken;
        pushEvent(session, 'stt_success', 'speech_collected', { transcript: spoken });

        try {
            const intent = await extractIntentFromSpeech(spoken);
            session.intent.skill = intent.skill || '';
            session.intent.location = intent.location || '';
            pushEvent(session, 'intent_success', 'groq_parsed', { intent: session.intent });
        } catch (err) {
            pushEvent(session, 'intent_failed', err.message);
            session.state = 'manual_skill_menu';
            return xmlResponse(gather({ session, prompt: msg(session, 'skillMenu'), sid: session.callSid }));
        }

        session.state = 'location_menu';
        return xmlResponse(gather({ session, prompt: msg(session, 'locationMenu'), sid: session.callSid }));
    }

    if (session.state === 'location_menu') {
        if (digits === '7') {
            pushEvent(session, 'menu_selected', 'location_menu_repeat');
            return xmlResponse(gather({ session, prompt: msg(session, 'locationMenu'), sid: session.callSid }));
        }
        if (digits === '9') {
            pushEvent(session, 'menu_selected', 'location_back_to_main');
            return renderMainMenu(session);
        }
        const useDefault = digits !== '2';
        const city = useDefault ? worker.address?.city || '' : '';

        const jobs = await fetchCandidateJobs({
            worker,
            skill: session.intent.skill,
            city: session.intent.location || city,
        });

        if (!jobs.length) {
            pushEvent(session, 'job_presented', 'no_jobs');
            session.state = 'main_menu';
            return xmlResponse(say(msg(session, 'noJobs'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
        }

        session.presentedJobIds = jobs.map((j) => j._id);
        session.cursor = 0;
        session.selectedJobId = jobs[0]._id;
        session.state = 'job_result_menu';
        pushEvent(session, 'job_presented', 'job_list_ready', { jobIds: session.presentedJobIds });

        return xmlResponse(say(jobPrompt(jobs[0], session.language), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
    }

    if (session.state === 'job_result_menu') {
        const currentJob = await getCurrentJob(session);
        if (!currentJob) {
            session.state = 'main_menu';
            return xmlResponse(gather({ session, prompt: msg(session, 'mainMenu'), sid: session.callSid }));
        }

        if (digits === '0') {
            session.ended = true;
            session.endReason = 'user_exit_job_menu';
            pushEvent(session, 'menu_selected', 'exit_call_from_job_menu');
            return xmlResponse(say(msg(session, 'callEnding')), hangup());
        }

        if (digits === '8') {
            pushEvent(session, 'menu_selected', 'job_options_repeat');
            return xmlResponse(gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
        }

        if (digits === '1') {
            await sendJobSms(session.phone, currentJob);
            pushEvent(session, 'sms_sent', 'job_details', { jobId: currentJob._id });
            return xmlResponse(say(msg(session, 'smsSent'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
        }

        if (digits === '2') {
            return xmlResponse(say(jobPrompt(currentJob, session.language), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
        }

        if (digits === '3') {
            if (!worker.availability) {
                return xmlResponse(say(msg(session, 'busyCannotApply'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
            }

            const applyResult = await applyForJobByWorker({
                jobId: currentJob._id,
                workerId: worker._id,
                source: 'ivr',
            });

            if (!applyResult.ok) {
                pushEvent(session, 'system_error', 'ivr_apply_failed', { message: applyResult.message });
                return xmlResponse(say(applyResult.message, getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
            }

            worker.availability = false;
            await worker.save();
            pushEvent(session, 'job_applied', 'ivr_apply_success', { jobId: currentJob._id });
            return xmlResponse(say(msg(session, 'appliedSuccess'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
        }

        if (digits === '4') {
            const nextCursor = (session.cursor || 0) + 1;
            if (nextCursor >= session.presentedJobIds.length) {
                session.cursor = 0;
            } else {
                session.cursor = nextCursor;
            }
            const nextJob = await getCurrentJob(session);
            session.selectedJobId = nextJob?._id || null;
            return xmlResponse(say(jobPrompt(nextJob, session.language), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
        }

        if (digits === '5') {
            return renderMainMenu(session);
        }

        if (digits === '6') {
            const cancelResult = await cancelPendingApplicationByWorker({
                jobId: currentJob._id,
                workerId: worker._id,
                cutoffMinutes: CANCEL_APPLICATION_CUTOFF_MINUTES,
            });

            if (!cancelResult.ok) {
                if (cancelResult.message === 'You have not applied yet.') {
                    return xmlResponse(say(msg(session, 'cancelAppliedNotFound'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
                }
                if (cancelResult.status === 403) {
                    return xmlResponse(say(msg(session, 'cancelAppliedTooLate'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
                }
                return xmlResponse(say(cancelResult.message, getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
            }

            worker.availability = true;
            await worker.save();
            pushEvent(session, 'application_cancelled', 'ivr_cancel_success', { jobId: currentJob._id });
            return xmlResponse(say(msg(session, 'cancelAppliedSuccess'), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
        }

        if (digits === '7') {
            pushEvent(session, 'menu_selected', 'job_quick_summary');
            return xmlResponse(say(jobQuickSummaryPrompt(session), getTtsLanguage(session)), gather({ session, prompt: msg(session, 'jobOptions'), sid: session.callSid }));
        }

        pushEvent(session, 'invalid_input', 'job_result_menu', { digits });
        return xmlResponse(gather({ session, prompt: `${msg(session, 'invalid')} ${msg(session, 'jobOptions')}`, sid: session.callSid }));
    }

    return renderMainMenu(session);
};

exports.twilioVoiceWebhook = async (req, res) => {
    try {
        console.log('[IVR] twilioVoiceWebhook START');
        const callSid = req.body.CallSid || `call-${Date.now()}`;
        const phoneRaw = req.body.From;
        console.log('[IVR] Phone:', phoneRaw, 'CallSid:', callSid);
        const phone = normalizePhone(phoneRaw);
        console.log('[IVR] Normalized phone:', phone);
        
        const worker = await findWorkerByPhone(phone);
        console.log('[IVR] Worker found:', !!worker);

        let session = await IvrSession.findOne({ callSid });
        console.log('[IVR] Session found:', !!session);
        
        if (!session) {
            console.log('[IVR] Creating new session');
            session = await IvrSession.create({
                provider: 'twilio',
                callSid,
                phone,
                workerId: worker?._id || null,
                registered: !!worker,
                workerApproved: worker?.verificationStatus === 'approved',
                state: worker && worker.verificationStatus === 'approved' ? 'language_menu' : 'unregistered_menu',
                defaultLocation: {
                    city: worker?.address?.city || '',
                    pincode: worker?.address?.pincode || '',
                    lat: Number(worker?.address?.lat) || null,
                    lng: Number(worker?.address?.lng) || null,
                },
            });
            console.log('[IVR] Session created:', session._id);
        }

        pushEvent(session, 'call_started', 'call_received', { phone });

        if (!worker || worker.verificationStatus !== 'approved') {
            console.log('[IVR] Unregistered lead detected');
            await upsertUnregisteredLead(phone);
        }

        await session.save();
        console.log('[IVR] Session saved');
        
        const twiml = new twilio.twiml.VoiceResponse();
        console.log('[IVR] TWIML created');
        
        const gather = twiml.gather({
            numDigits: 1,
            timeout: 8,
            action: `${VOICE_ACTION_URL}?sid=${encodeURIComponent(callSid)}`,
            method: 'POST',
        });
        console.log('[IVR] Gather configured');
        
        gather.say(
            { language: 'en-IN', voice: getTtsVoiceByLanguage('en-IN') },
            'Welcome to KarigarConnect. Bhasha chuniyega. Hindi ke liye 1, Marathi ke liye 2, English ke liye 3 dabaiye.'
        );
        console.log('[IVR] Say configured, returning response');
        
        return respondXml(res, twiml.toString());
    } catch (err) {
        console.error('❌ twilioVoiceWebhook ERROR:', err.message);
        console.error('   Stack:', err.stack);
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('System error. Please try again later.');
        return respondXml(res, twiml.toString());
    }
};

exports.twilioStateHandler = async (req, res) => {
    try {
        const sidFromQuery = String(req.query.sid || '').trim();
        const callSid = sidFromQuery || req.body.CallSid || `call-${Date.now()}`;
        const phone = normalizePhone(req.body.From);
        const digits = req.body.Digits || '';
        const speech = req.body.SpeechResult || '';

        const worker = await findWorkerByPhone(phone);
        const isRegisteredWorker = !!worker && worker.verificationStatus === 'approved';

        let session = await IvrSession.findOne({ callSid });
        if (!session) {
            session = new IvrSession({
                provider: 'twilio',
                callSid,
                phone,
                workerId: worker?._id || null,
                registered: !!worker,
                workerApproved: isRegisteredWorker,
                state: isRegisteredWorker ? 'language_menu' : 'unregistered_menu',
                language: 'hi',
                defaultLocation: {
                    city: worker?.address?.city || '',
                    pincode: worker?.address?.pincode || '',
                    lat: Number(worker?.address?.lat) || null,
                    lng: Number(worker?.address?.lng) || null,
                },
            });
            pushEvent(session, 'call_started', 'voice_webhook_started', { phone });
        }

        if (!isRegisteredWorker) {
            await upsertUnregisteredLead(phone);
            const xml = await handleUnregisteredState(session, digits);
            if (session.ended) pushEvent(session, 'call_ended', session.endReason || 'unregistered_flow_end');
            await session.save();
            return respondXml(res, xml);
        }

        if (session.state === 'entry') session.state = 'language_menu';

        const xml = await handleRegisteredFlow(session, worker, digits, speech);
        if (session.ended) pushEvent(session, 'call_ended', session.endReason || 'completed');
        await session.save();
        return respondXml(res, xml);
    } catch (err) {
        console.error('❌ twilioStateHandler ERROR:', err.message);
        console.error('   Stack:', err.stack);
        return respondXml(res, xmlResponse(say('System error. Please try again later.'), hangup()));
    }
};
