/**
 * server/controllers/aiAssistantController.js
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * AI Assistant controller for KarigarConnect.
 *
 * ARCHITECTURE:
 *   - generateQuestions  â†’ Groq AI only (questions are language-specific)
 *   - generateEstimate   â†’ rateTable.js for all cost numbers + AI for metadata
 *                          (job title, skill blocks, recommendation text)
 *   - generateAdvisorReport â†’ full AI report, cost section uses rateTable numbers
 *
 * WHY THIS SPLIT:
 *   Costs are now deterministic, city-aware, and based on real market data.
 *   AI is only used for language/analysis tasks where it genuinely helps.
 *
 * UNCHANGED:
 *   - All API response shapes
 *   - generateAdvisorReport (photo, opinions, nearby workers, report sections)
 *   - generateQuestions
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 */

const Groq = require('groq-sdk');
const User = require('../models/userModel');
const {
    calculateStructuredBudget,
    getRateBand,
    getCityTier,
    normaliseSkill,
    resolveSkillKey,
    estimateHours,
    detectComplexity,
    getRate,
} = require('../utils/rateTable');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama3-70b-8192';

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Internal helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const safeJSON = (text, fallback = null) => {
    try {
        const cleaned = text.replace(/```json|```/g, '').trim();
        const start   = cleaned.indexOf('{') !== -1 ? cleaned.indexOf('{') : cleaned.indexOf('[');
        const end     = cleaned.lastIndexOf('}') !== -1 ? cleaned.lastIndexOf('}') : cleaned.lastIndexOf(']');
        if (start === -1 || end === -1) return fallback;
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch { return fallback; }
};

const chat = async (systemPrompt, userPrompt, maxTokens = 1024) => {
    const resp = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
        ],
    });
    return resp.choices[0]?.message?.content || '';
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 1 â€” Generate Questions
//     100% AI â€” unchanged from original behaviour
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const generateQuestions = async (req, res) => {
    try {
        const { workDescription, city } = req.body;
        if (!workDescription?.trim()) {
            return res.status(400).json({ message: 'Work description required' });
        }

        const system = `You are a skilled construction and home-services expert in India.
Your job is to generate 5-8 smart clarifying questions that help understand the scope of work.
Return ONLY a JSON object:
{
  "questions": [
    { "id": "q1", "question": "...", "type": "text" },
    { "id": "q2", "question": "...", "type": "select", "options": ["A","B","C"] },
    { "id": "q3", "question": "...", "type": "number" }
  ],
  "opinionQuestions": [
    { "id": "op1", "question": "What colour/finish do you prefer?", "type": "select", "options": ["White","Off-white","Custom"] }
  ]
}
Return nothing else â€” no preamble, no markdown.`;

        const raw  = await chat(system, `Work: ${workDescription}\nCity: ${city || 'India'}`);
        const data = safeJSON(raw, { questions: [], opinionQuestions: [] });

        return res.json({
            questions:        Array.isArray(data.questions)        ? data.questions        : [],
            opinionQuestions: Array.isArray(data.opinionQuestions) ? data.opinionQuestions : [],
        });
    } catch (err) {
        console.error('generateQuestions error:', err);
        return res.status(200).json({
            questions: [
                { id: 'q1', question: 'What exact work do you want done?', type: 'text' },
                { id: 'q2', question: 'How many rooms/areas are included?', type: 'number' },
                { id: 'q3', question: 'What is the approximate area (sq ft)?', type: 'number' },
                { id: 'q4', question: 'Do you need material included?', type: 'select', options: ['Labour only', 'Labour + material', 'Not sure'] },
                { id: 'q5', question: 'When do you want to start?', type: 'select', options: ['Today', 'Within 2-3 days', 'This week', 'Flexible'] },
            ],
            opinionQuestions: [
                { id: 'op1', question: 'Any style/finish preference?', type: 'text' },
            ],
        });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 2 â€” Generate Estimate
//     Costs: rateTable.js (deterministic, city-aware market data)
//     Job title / skill detection / recommendation: Groq AI
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const generateEstimate = async (req, res) => {
    try {
        const {
            workDescription = '',
            answers         = {},
            city            = '',
            urgent          = false,
            workerCountOverride,
        } = req.body;

        // â”€â”€ STEP 1: Ask AI to identify skills + worker counts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const aiSystem = `You are a construction estimator in India.
Given a job description, return ONLY JSON (no markdown):
{
  "jobTitle": "short descriptive title",
  "skills": ["painter", "plumber"],
  "workerCounts": [1, 1],
  "durationDays": 2,
  "recommendation": "one sentence of practical advice for the client"
}
Rules:
- skills must be plain lowercase trade names (painter, plumber, electrician, carpenter, mason, tiler, welder, ac technician, deep cleaning, pest control, handyman, waterproofing, false ceiling, interior designer, roofer, flooring, furniture assembler, geyser repair, ro service, washing machine repair, tv repair, mobile repair, computer repair, sofa cleaning, landscaping, security guard, driver, packers and movers, construction labour, other)
- workerCounts parallel to skills array
- Return nothing else`;

        const answersText = Object.entries(answers)
            .map(([q, a]) => `Q: ${q}\nA: ${a}`)
            .join('\n');

        const aiRaw  = await chat(
            aiSystem,
            `Job: ${workDescription}\nCity: ${city || 'India'}\n${answersText}`,
            512
        );
        const aiData = safeJSON(aiRaw, {});

        const rawSkills   = Array.isArray(aiData.skills) && aiData.skills.length
            ? aiData.skills
            : ['handyman'];

        const aiCounts = Array.isArray(aiData.workerCounts) ? aiData.workerCounts : [];

        // Respect workerCountOverride â€” spread it proportionally across skills
        let workerCounts;
        if (workerCountOverride && Number(workerCountOverride) > 0) {
            const total    = Number(workerCountOverride);
            const base     = Math.floor(total / rawSkills.length);
            const remainder= total - base * rawSkills.length;
            workerCounts   = rawSkills.map((_, i) => base + (i < remainder ? 1 : 0));
        } else {
            workerCounts = rawSkills.map((_, i) => Math.max(1, Math.round(aiCounts[i] || 1)));
        }

        // â”€â”€ STEP 2: Calculate costs from rateTable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const budget = calculateStructuredBudget({
            skills:       rawSkills,
            city,
            urgent:       Boolean(urgent),
            description:  workDescription,
            answers,
            workerCounts,
        });

        // â”€â”€ STEP 3: Build skillBlocks (for frontend workflow display) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const skillBlocks = rawSkills.map((sk, i) => ({
            skill: resolveSkillKey(normaliseSkill(sk)),
            count: workerCounts[i] || 1,
        }));

        // â”€â”€ STEP 4: Compose response â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        return res.json({
            jobTitle:        aiData.jobTitle      || workDescription.slice(0, 60).trim(),
            recommendation:  aiData.recommendation|| '',
            durationDays:    aiData.durationDays   || budget?.durationDays || 1,
            skillBlocks,
            budgetBreakdown: budget,
            city,
            cityTier:        getCityTier(city),
            // Legacy field â€” keep for any frontend that reads this directly
            totalEstimated:  budget?.totalEstimated || 0,
        });

    } catch (err) {
        console.error('generateEstimate error:', err);
        // Graceful fallback â€” return partial data rather than 500
        return res.status(500).json({
            message:        'Estimate partially failed',
            budgetBreakdown: null,
            skillBlocks:     [],
            totalEstimated:  0,
        });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 3 â€” Generate Advisor Report
//     Full AI report for the Advisor feature.
//     Cost section now uses rateTable numbers (passed as context to AI).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const generateAdvisorReport = async (req, res) => {
    try {
        const {
            description    = '',
            answers        = {},
            opinions       = {},
            clientBudget   = null,
            city           = '',
            imageFindings  = null,
        } = req.body;

        // â”€â”€ Cost context from rateTable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Ask AI to detect skills first (lightweight call)
        const skillRaw = await chat(
            'You are a construction estimator. Return ONLY a JSON array of skill strings. No markdown.',
            `Job description: ${description}`,
            256
        );
        const detectedSkills = safeJSON(skillRaw, ['handyman']);
        const skills = Array.isArray(detectedSkills) ? detectedSkills : ['handyman'];

        const budget = calculateStructuredBudget({
            skills,
            city,
            urgent:      false,
            description,
            answers,
            workerCounts: skills.map(() => 1),
        });

        // Build a concise cost summary to pass as context to the full report
        const costContext = budget
            ? budget.breakdown.map(b =>
                `${b.displaySkill}: â‚¹${b.ratePerDay}/day Ã— ${b.count} worker(s) = â‚¹${b.subtotal} (${b.complexity} complexity, ${b.hours}h)`
              ).join('\n') +
              `\nTotal estimated: â‚¹${budget.totalEstimated}` +
              (budget.urgent ? ` (includes 25% urgency surcharge)` : '')
            : 'Not calculated';

        const budgetAlert = clientBudget && budget && Number(clientBudget) < budget.totalEstimated
            ? `âš ï¸ Client budget â‚¹${clientBudget} is BELOW the estimated â‚¹${budget.totalEstimated}. Flag this clearly.`
            : '';

        // â”€â”€ Build full report prompt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const answersText  = Object.entries(answers) .map(([q,a]) => `Q: ${q}\nA: ${a}`).join('\n');
        const opinionsText = Object.entries(opinions).map(([q,a]) => `Preference â€” ${q}: ${a}`).join('\n');

        const system = `You are KarigarConnect's expert home-services advisor in India.
You produce a comprehensive project report in JSON. Return ONLY valid JSON, no markdown.

JSON structure:
{
  "warnings": ["..."],
  "imageFindings": "...",
  "costBreakdown": {
    "labour": NUMBER,
    "materials": NUMBER,
    "equipment": NUMBER,
    "grandTotal": NUMBER,
    "budgetAdvice": "..."
  },
  "workPlan": ["step1", "step2"],
  "timeEstimate": {
    "totalDays": NUMBER,
    "phases": [{ "phase": "...", "days": NUMBER, "skill": "..." }]
  },
  "expectedOutcome": "...",
  "colourStyleAdvice": "...",
  "designSuggestions": ["..."],
  "optionalUpgrades": ["..."],
  "visualizationDescription": "...",
  "nearbyWorkersTip": "..."
}`;

        const userPrompt = `
Job description: ${description}
City: ${city || 'India'}

Client answers:
${answersText}

Client preferences:
${opinionsText}

Real market cost data (from local rate database):
${costContext}
${budgetAlert}

Client budget: ${clientBudget ? `â‚¹${clientBudget}` : 'Not specified'}
${imageFindings ? `Image analysis findings: ${imageFindings}` : ''}

Generate the full advisor report. For costBreakdown.labour, use the rate database numbers above. For materials and equipment, estimate based on the job scope.`;

        const raw    = await chat(system, userPrompt, 2048);
        const report = safeJSON(raw, {});

        // â”€â”€ Merge rateTable budget into costBreakdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if (budget) {
            if (!report.costBreakdown) report.costBreakdown = {};
            report.costBreakdown.labourBreakdown  = budget.breakdown;
            report.costBreakdown.labourTotal      = budget.subtotal;
            report.costBreakdown.labour           = report.costBreakdown.labour || budget.subtotal;
            report.costBreakdown.grandTotal       = report.costBreakdown.grandTotal ||
                (budget.totalEstimated + (report.costBreakdown.materials || 0) + (report.costBreakdown.equipment || 0));
            report.cityTier                       = budget.cityTier;
            report.rateTableTotal                 = budget.totalEstimated;
        }

        // â”€â”€ Nearby workers (city-filtered from DB) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let nearbyWorkers = [];
        try {
            const workerSkills = skills.map(s => resolveSkillKey(normaliseSkill(s)));
            nearbyWorkers = await User.find({
                role:               'worker',
                verificationStatus: 'approved',
                'location.city':    { $regex: new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
                'skills.name':      { $in: workerSkills },
            })
                .select('name skills avgStars completedJobs photo karigarId')
                .limit(5)
                .lean();
        } catch (e) {
            console.error('nearbyWorkers query failed:', e.message);
        }

        return res.json({
            report,
            budgetBreakdown: budget,
            nearbyWorkers,
            city,
            cityTier: getCityTier(city),
        });

    } catch (err) {
        console.error('generateAdvisorReport error:', err);
        return res.status(500).json({ message: 'Advisor report generation failed' });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 4 â€” AI Assistant (chat)
//     Unchanged â€” free-form assistant for client chat interface
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const aiAssistant = async (req, res) => {
    try {
        const { message, history = [], city = '' } = req.body;
        if (!message?.trim()) {
            return res.status(400).json({ message: 'Message required' });
        }

        // Enrich context with rate lookup if user asks about cost
        let rateContext = '';
        const costKeywords = ['cost', 'price', 'rate', 'charge', 'how much', 'kitna', 'fees', 'amount'];
        if (costKeywords.some(k => message.toLowerCase().includes(k))) {
            // Try to extract skill from message
            const skills = Object.keys(require('../utils/rateTable').SKILL_ALIASES);
            const mentioned = skills.find(s => message.toLowerCase().includes(s));
            if (mentioned && city) {
                const r = getRate(mentioned, city);
                rateContext = `\n[Market rate for ${mentioned} in ${city}: â‚¹${r.min}â€“â‚¹${r.max}/day, avg â‚¹${r.ratePerDay}/day]`;
            }
        }

        const system = `You are KarigarConnect's helpful AI assistant for home services in India.
You help clients understand costs, plan projects, and choose workers.
Be concise, practical, and always in the context of the Indian market.
${city ? `Client is located in ${city}.` : ''}
${rateContext}`;

        const messages = [
            { role: 'system', content: system },
            ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
            { role: 'user', content: message },
        ];

        const resp = await groq.chat.completions.create({
            model:      MODEL,
            max_tokens: 512,
            messages,
        });

        return res.json({ reply: resp.choices[0]?.message?.content || 'I could not process that.' });
    } catch (err) {
        console.error('aiAssistant error:', err);
        return res.status(500).json({ message: 'Assistant error' });
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// 5 â€” Rate Lookup API  (new endpoint â€” no AI, pure rateTable)
//     GET /api/ai/rate?skill=painter&city=pune&hours=8
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const getRateForSkillCity = (req, res) => {
    try {
        const { skill, city, hours } = req.query;
        if (!skill) return res.status(400).json({ message: 'skill query param required' });

        const r          = getRate(skill, city || '');
        const h          = Math.max(1, Number(hours) || 8);
        const costForJob = h <= 8
            ? Math.round(r.ratePerDay * (h / 8))
            : Math.round(r.ratePerDay * Math.ceil(h / 8));

        return res.json({
            skill:       resolveSkillKey(normaliseSkill(skill)),
            city:        city || 'generic',
            tier:        r.tier,
            ratePerHour: r.ratePerHour,
            ratePerDay:  r.ratePerDay,
            rateRange: { min: r.min, max: r.max },
            hours:       h,
            costForJob,
        });
    } catch (err) {
        console.error('getRateForSkillCity error:', err);
        return res.status(500).json({ message: 'Rate lookup failed' });
    }
};

module.exports = {
    generateQuestions,
    generateEstimate,
    generateAdvisorReport,
    aiAssistant,
    getRateForSkillCity,
};

