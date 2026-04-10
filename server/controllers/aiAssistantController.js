// controllers/aiAssistantController.js
// UPDATES (AI Advisor v2):
//  1. generateAdvisorReport: considers clientBudget in estimate
//  2. Opinion questions added (color, finish, style preferences)
//  3. Equipment rates updated to 2024-25 Indian market
//  4. Nearby workers filtered by city match
//  5. generateQuestions: returns both work questions + opinion questions
//  6. All other exports unchanged

const Groq = require('groq-sdk');
const User = require('../models/userModel');
const { calculateStructuredBudget, BASE_RATES } = require('../utils/rateTable');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── SYSTEM PROMPT: Question Generation ────────────────────────────────────────
const QUESTIONS_SYSTEM_PROMPT = `You are KarigarConnect's smart job intake assistant for India.

Given a work description and optional city, generate 6-8 targeted clarifying questions to accurately estimate labour, material and total budget.

Output ONLY a valid JSON object (NOT an array at root level):
{
  "questions": [
    { "id": "q1", "question": "...", "type": "select|number|text", "options": ["..."] }
  ],
  "opinionQuestions": [
    { "id": "op1", "question": "...", "type": "select|text|color", "options": ["..."], "category": "color|style|material|preference" }
  ]
}

Work questions cover: trade skills needed, scope/area, complexity, hours, workers, urgency.
Opinion questions cover: aesthetic preferences specific to this work type.

Examples of opinion questions:
- Painting: "What colour scheme do you prefer?" (color type), "What finish do you prefer?" (Matte/Satin/Gloss/Not sure)
- Tiling: "What tile style do you prefer?" (Modern/Traditional/Marble-look/Not sure), "Preferred grout colour?"
- Carpentry: "What wood finish do you prefer?" (Natural wood/Painted/Laminate/Not sure)
- Electrical: "Do you prefer concealed or surface wiring?"
- Plumbing: "Which fixture brand do you prefer?" (Hindware/Cera/Jaquar/Any)

Rules:
- Work questions: 6-8, SPECIFIC to the described work
- Ensure at least 3 questions are directly about cost drivers (area/quantity, material quality, urgency/timeline, access constraints, worker count)
- Opinion questions: 1-3, ONLY if relevant to the work type described
- Do NOT ask opinion questions for purely repair/maintenance work (e.g., "fix a leak" needs no opinion questions)
- Keep questions short and practical
- Use "color" type for colour preference questions
- Output ONLY valid JSON, NO markdown`;

const titleCase = (v = '') =>
    String(v)
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');

const getRateTableCities = () =>
    Object.keys(BASE_RATES)
        .filter((key) => key !== 'default')
        .map((key) => ({ key, label: titleCase(key) }));

const MIN_WORK_QUESTIONS = 6;

const ensureQuestionShape = (q, index) => ({
    id: q?.id || `q${index + 1}`,
    question: String(q?.question || '').trim(),
    type: ['select', 'number', 'text'].includes(q?.type) ? q.type : 'text',
    options: Array.isArray(q?.options) ? q.options.filter(Boolean).map((opt) => String(opt).trim()) : [],
});

const fallbackWorkQuestions = [
    { id: 'q1', question: 'What is the exact work scope and area size (sq ft)?', type: 'text' },
    { id: 'q2', question: 'How many workers do you want for this job?', type: 'number' },
    { id: 'q3', question: 'What material quality do you prefer?', type: 'select', options: ['Economy', 'Standard', 'Premium'] },
    { id: 'q4', question: 'What is the target completion timeline?', type: 'select', options: ['1 day', '2-3 days', '4-7 days', 'More than 1 week'] },
    { id: 'q5', question: 'Is this work urgent?', type: 'select', options: ['Yes', 'No'] },
    { id: 'q6', question: 'Are there any site access constraints affecting effort or transport cost?', type: 'text' },
];

const ensureMinimumWorkQuestions = (questions = []) => {
    const cleaned = (Array.isArray(questions) ? questions : [])
        .map((q, idx) => ensureQuestionShape(q, idx))
        .filter((q) => q.question);

    if (cleaned.length >= MIN_WORK_QUESTIONS) return cleaned.slice(0, 8);

    const existing = new Set(cleaned.map((q) => q.question.toLowerCase()));
    for (const q of fallbackWorkQuestions) {
        if (!existing.has(q.question.toLowerCase())) cleaned.push(q);
        if (cleaned.length >= MIN_WORK_QUESTIONS) break;
    }
    return cleaned.slice(0, 8);
};

// ── SYSTEM PROMPT: Full Estimate ──────────────────────────────────────────────
const ESTIMATE_SYSTEM_PROMPT = `You are KarigarConnect's job estimation engine for India.
Output ONLY valid JSON, NO markdown:
{
  "jobTitle": "Short specific title (max 60 chars)",
  "skillBlocks": [{ "skill": "painter", "count": 2, "hours": 16, "complexity": "normal", "description": "..." }],
  "durationDays": 2, "urgent": false,
  "recommendation": "One sentence recommendation"
}
skill must be one of: plumber, electrician, carpenter, painter, tiler, mason, welder, ac_technician, pest_control, cleaner, handyman, gardener
hours = total for the skill (not per worker). Be realistic. Estimate using current city-specific Indian labour rates and keep the final labour total aligned with those rates.`;

// ── SYSTEM PROMPT: Full Advisory Report ──────────────────────────────────────
const ADVISOR_SYSTEM_PROMPT = `You are KarigarConnect's expert AI Advisor — a professional home consultant for Indian clients (2025).

Generate a COMPLETE advisory report. Output ONLY valid JSON, NO markdown:

{
  "jobTitle": "Short professional title (max 60 chars)",
  "problemSummary": "2-3 sentence expert summary",
  "skillBlocks": [
    { "skill": "painter", "count": 2, "hours": 16, "complexity": "normal", "description": "Interior painting of living room" }
  ],
  "materialsBreakdown": [
    { "item": "Interior Emulsion Paint (20L, Asian Paints)", "estimatedCost": 3400, "quantity": "2 cans", "note": "2 coats on ~400 sqft" },
    { "item": "Wall Putty Birla White (10kg)", "estimatedCost": 680, "quantity": "2 bags", "note": "Crack filling and smoothening" },
    { "item": "Primer — Berger WeatherCoat (5L)", "estimatedCost": 950, "quantity": "1 can", "note": "Improves adhesion" }
  ],
  "equipmentBreakdown": [
    { "item": "9-inch Paint Roller Set (3 rollers + tray)", "estimatedCost": 450, "note": "Standard quality" },
    { "item": "Paint Brushes (set of 3 — 1\", 2\", 3\")", "estimatedCost": 280, "note": "For edges and corners" },
    { "item": "Drop Cloth / Plastic Sheet Protection", "estimatedCost": 150, "note": "Floor and furniture protection" },
    { "item": "Sandpaper Set (60/80/120 grit)", "estimatedCost": 120, "note": "Surface preparation" },
    { "item": "Masking Tape (3 rolls)", "estimatedCost": 180, "note": "Edge protection" }
  ],
  "workPlan": [
    { "step": 1, "title": "Site Inspection", "description": "Inspect walls, mark cracks, moisture, damage", "estimatedTime": "30 min" }
  ],
  "timeEstimate": {
    "totalDays": 1,
    "totalHours": 10,
    "phases": [
      { "phase": "Preparation", "hours": 2.5, "description": "Crack filling, sanding, masking" }
    ]
  },
  "expectedOutcome": ["Smooth even finish", "Cracks sealed", "Brighter appearance"],
  "colourAndStyleAdvice": "Specific colour and style recommendation based on the client's stated preferences. Include paint code / shade name suggestions.",
  "designSuggestions": ["Light beige for better light reflection", "Accent wall behind sofa for modern look"],
  "improvementIdeas": [
    { "idea": "Moisture-resistant paint", "benefit": "Prevents damp marks during monsoon", "estimatedExtraCost": 800 }
  ],
  "imageFindings": [],
  "warnings": [],
  "visualizationDescription": "Describe what the completed work will look like — colours, finish, specific visual result the client can expect. Write this as if describing a 'before and after' photo.",
  "budgetAdvice": "How the work fits within the client's stated budget, and any suggestions to stay within budget.",
  "durationDays": 1,
  "urgent": false
}

STRICT RULES:
- skill: plumber, electrician, carpenter, painter, tiler, mason, welder, ac_technician, pest_control, cleaner, handyman, gardener ONLY
- materialsBreakdown: use real Indian brand names (Asian Paints, Berger, Pidilite, Birla White, Jaquar, Havells, Polycab, etc.)
- equipmentBreakdown: 2025 Indian market rates — roller ₹400-500, brushes ₹200-350, drop cloth ₹100-200, sandpaper ₹100-150/set, masking tape ₹150-200/3 rolls, drill ₹800-1200, grinder ₹600-900, tile cutter ₹500-800
- labour costs must use the current city-specific Indian rate table and realistic worker counts/hours
- return labour, material, equipment, and grand total so the UI can show one combined estimate block
- colourAndStyleAdvice: ONLY populate if opinions about colour/style were provided. Otherwise empty string.
- visualizationDescription: vivid, specific, 2-3 sentences describing the final result
- budgetAdvice: ALWAYS provide if clientBudget was specified — be honest if budget is too low
- workPlan: 4-7 steps, SPECIFIC to this exact job
- All costs in INR, 2024-25 Indian market rates
- imageFindings: empty array if no image provided`;

// ── HELPER: Parse JSON ────────────────────────────────────────────────────────
const parseGroqJson = (text) => {
    const cleaned = text
        .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
};

// ── HELPER: Format worker ─────────────────────────────────────────────────────
const formatWorker = (w) => ({
    id:               w._id,
    karigarId:        w.karigarId,
    name:             w.name,
    photo:            w.photo,
    mobile:           w.mobile,
    skills:           Array.isArray(w.skills) ? w.skills.map(s => s?.name || s || '') : [],
    overallExperience: w.overallExperience,
    points:           w.points,
    city:             w.address?.city || '',
    locality:         w.address?.locality || '',
});

// ── HELPER: Normalize city for matching ──────────────────────────────────────
const normCity = (c = '') => c.toLowerCase().trim().replace(/\s+/g, '');

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateConfidenceScore = ({
    workDescription = '',
    answers = {},
    opinions = {},
    imageUploaded = false,
    imageFindings = [],
    skillBlocks = [],
    topWorkers = [],
}) => {
    const descLen = String(workDescription || '').trim().length;
    const answeredCount = Object.keys(answers || {}).filter(k => answers[k]).length;
    const opinionsCount = Object.keys(opinions || {}).filter(k => opinions[k]).length;

    const imageClarityScore = imageUploaded
        ? clamp(55 + (Array.isArray(imageFindings) ? imageFindings.length * 8 : 0), 55, 95)
        : 45;
    const inputCompletenessScore = clamp(
        (descLen >= 10 ? 60 : 35) + answeredCount * 8 + opinionsCount * 4,
        40,
        98
    );
    const similarJobsScore = clamp(50 + skillBlocks.length * 8 + Math.min(topWorkers.length, 8) * 4, 50, 95);

    const weighted = (
        imageClarityScore * 0.25 +
        inputCompletenessScore * 0.45 +
        similarJobsScore * 0.30
    );

    return {
        score: clamp(Math.round(weighted), 1, 99),
        factors: {
            imageClarity: imageClarityScore,
            userInputs: inputCompletenessScore,
            similarPastJobs: similarJobsScore,
        },
        basedOn: [
            imageUploaded ? 'Image clarity and visible work conditions' : 'No photo uploaded (confidence slightly reduced)',
            `${answeredCount} work-detail answers and ${opinionsCount} preference answers`,
            `${skillBlocks.length} detected skill block(s) and ${Math.min(topWorkers.length, 8)} matching workers`,
        ],
    };
};

const buildPreviewPrompt = ({ analysis = {}, style = '' }) => {
    const guidance = analysis?.colourAndStyleAdvice || analysis?.visualizationDescription || '';
    const summary = analysis?.problemSummary || analysis?.jobTitle || 'home interior wall';
    const city = analysis?.city || 'India';
    return [
        `Photorealistic interior redesign based on the uploaded room image.`,
        `Apply this style: ${style}.`,
        `Keep architecture, camera angle and furniture layout consistent with the original image.`,
        `Improve only paint/colors/finish and subtle decor coherence.`,
        `Context: ${summary}.`,
        guidance ? `Advisor guidance: ${guidance}` : '',
        `Location context: ${city}.`,
        `High-quality before-after result, natural lighting, realistic textures.`,
    ].filter(Boolean).join(' ');
};

const createPreviewOptions = ({ sourceImageUrl = '', analysis = {}, styleOptions = [] }) => {
    const defaults = [
        {
            style: 'Soft Beige Paint',
            description: 'Warm neutral tone that increases brightness and gives a spacious feel.',
        },
        {
            style: 'Modern Grey Accent',
            description: 'Balanced cool-grey look with deeper contrast for a modern accent-wall finish.',
        },
        {
            style: 'Dual Tone Contemporary',
            description: 'Clean contemporary palette with soft highlights and improved wall texture depth.',
        },
    ];

    const city = analysis?.city || 'your location';
    const selected = Array.isArray(styleOptions) && styleOptions.length
        ? styleOptions.slice(0, 4).map((s, i) => ({
            style: s,
            description: `AI variation for ${s.toLowerCase()} style in ${city}.`,
        }))
        : defaults;

    return selected.map((opt) => ({
        style: opt.style,
        description: opt.description,
        sourceImageUrl,
        prompt: buildPreviewPrompt({ analysis, style: opt.style }),
    }));
};

const fetchImageAsBlob = async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('Failed to fetch source image for AI edit.');
    const arr = await r.arrayBuffer();
    const contentType = r.headers.get('content-type') || 'image/png';
    const ext = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : 'png';
    return {
        blob: new Blob([arr], { type: contentType }),
        filename: `source.${ext}`,
    };
};

const generateWithOpenAIImageEdit = async ({ sourceImageUrl, prompt }) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const { blob, filename } = await fetchImageAsBlob(sourceImageUrl);
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('size', '1024x1024');
    form.append('image', blob, filename);

    const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
        body: form,
    });

    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`OpenAI image edit failed: ${txt}`);
    }

    const data = await response.json();
    const item = data?.data?.[0];
    if (!item) throw new Error('OpenAI image edit returned empty output.');
    if (item.url) return { imageUrl: item.url, source: 'openai-image-edit' };
    if (item.b64_json) return { imageUrl: `data:image/png;base64,${item.b64_json}`, source: 'openai-image-edit' };
    throw new Error('OpenAI image edit returned unknown payload.');
};

// Reliable placeholder fallback using placehold.co — always loads, no API needed.
const generateWithPlaceholderFallback = ({ style = '' }) => {
    const s = style.toLowerCase();
    let bg, fg;
    if (s.includes('beige'))                               { bg = 'F5E6C8'; fg = '5C4A35'; }
    else if (s.includes('grey') || s.includes('gray'))    { bg = 'D0D0D0'; fg = '444444'; }
    else if (s.includes('blue'))                           { bg = 'BFD7ED'; fg = '1A3C5E'; }
    else if (s.includes('green'))                          { bg = 'C8E6C9'; fg = '1B5E20'; }
    else if (s.includes('contemp') || s.includes('dual')) { bg = 'C8D8E8'; fg = '2C3E50'; }
    else if (s.includes('terracotta') || s.includes('warm')){ bg = 'E8C4A0'; fg = '5C2A00'; }
    else                                                   { bg = 'E4DDD0'; fg = '444444'; }
    const label = encodeURIComponent(style || 'AI Preview');
    return {
        imageUrl: `https://placehold.co/768x768/${bg}/${fg}?text=${label}&font=montserrat`,
        source: 'placeholder',
    };
};

const generatePreviewImage = async ({ sourceImageUrl, prompt, style = '' }) => {
    // Priority: OpenAI image edit → placeholder fallback
    if (process.env.OPENAI_API_KEY) {
        try {
            const openai = await generateWithOpenAIImageEdit({ sourceImageUrl, prompt });
            if (openai) return openai;
        } catch (err) {
            console.error(`OpenAI preview failed for style "${style}": ${err.message}`);
        }
    }
    // Not an error - just using the reliable fallback when OpenAI key not set or fails
    return generateWithPlaceholderFallback({ style });
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/ai/generate-questions  (UPDATED — returns opinionQuestions too)
// ══════════════════════════════════════════════════════════════════════════════
exports.generateQuestions = async (req, res) => {
    const { city = '' } = req.body;
    const workDescription = String(req.body?.workDescription || req.body?.description || '').trim();
    if (!workDescription) {
        return res.status(400).json({ message: 'Work description is required.' });
    }
    if (workDescription.length < 10) {
        return res.status(400).json({ message: 'Please enter at least 10 characters in work description.' });
    }
    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: QUESTIONS_SYSTEM_PROMPT },
                { role: 'user',   content: `Work Description: "${workDescription}"${city ? `\nCity: ${city}` : ''}` },
            ],
            temperature: 0.3, max_tokens: 1000, response_format: { type: 'json_object' },
        });
        const raw    = completion.choices[0]?.message?.content || '{}';
        const parsed = parseGroqJson(raw);
        let questions = parsed.questions || [];
        let opinionQuestions = parsed.opinionQuestions || [];
        if (!Array.isArray(questions)) questions = [];
        if (!Array.isArray(opinionQuestions)) opinionQuestions = [];
        questions = ensureMinimumWorkQuestions(questions);
        return res.status(200).json({ questions, opinionQuestions });
    } catch (err) {
        console.error('generateQuestions error:', err.message);
        return res.status(200).json({
            questions: ensureMinimumWorkQuestions([]),
            opinionQuestions: [],
        });
    }
};

exports.getRateTableCities = async (_req, res) => {
    return res.status(200).json({ cities: getRateTableCities() });
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/ai/generate-estimate  (UNCHANGED)
// ══════════════════════════════════════════════════════════════════════════════
exports.generateEstimate = async (req, res) => {
    const { workDescription, answers = {}, city = '', urgent = false, workerCountOverride } = req.body;
    if (!workDescription?.trim()) return res.status(400).json({ message: 'Work description is required.' });
    try {
        const answersText = Object.entries(answers).map(([q, a]) => `  - ${q}: ${a}`).join('\n');
        const userPrompt  = `Work: "${workDescription}"\nCity: ${city||'Unknown'}\nUrgent: ${urgent?'Yes':'No'}\n${answersText?`Answers:\n${answersText}`:''}`;
        const completion  = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: ESTIMATE_SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
            temperature: 0.2, max_tokens: 1000, response_format: { type: 'json_object' },
        });
        const raw = completion.choices[0]?.message?.content || '{}';
        const aiResult = parseGroqJson(raw);
        const skillBlocks = aiResult.skillBlocks || [];
        const override = Number(workerCountOverride);
        if (override > 0 && skillBlocks.length > 0) {
            const aiTotal = skillBlocks.reduce((s, b) => s + (b.count||1), 0) || 1;
            if (aiTotal !== override) {
                const counts = skillBlocks.map(b => Math.max(1, Math.floor(((b.count||1)/aiTotal)*override)));
                let ct = counts.reduce((s,c)=>s+c,0);
                if (ct !== override) { const mi = counts.reduce((m,c,i)=>c>counts[m]?i:m,0); counts[mi]=Math.max(1,counts[mi]+(override-ct)); }
                for (let i=0;i<skillBlocks.length;i++) skillBlocks[i].count=counts[i];
            }
        }
        const budgetResult = calculateStructuredBudget(skillBlocks, city, aiResult.urgent||urgent);
        const skillNames   = skillBlocks.map(b=>b.skill).filter(Boolean);
        const topWorkers   = await User.find({ role:'worker', verificationStatus:'approved', skills:{$elemMatch:{name:{$in:skillNames}}} }).sort({points:-1}).limit(10).select('name karigarId photo overallExperience points skills mobile address');
        return res.status(200).json({ jobTitle: aiResult.jobTitle||'', durationDays: aiResult.durationDays||1, skillBlocks, budgetBreakdown: budgetResult, recommendation: aiResult.recommendation||'', topWorkers: topWorkers.map(formatWorker) });
    } catch (err) { console.error('generateEstimate error:', err); return res.status(500).json({ message: 'Failed.' }); }
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/ai/advisor  (UPDATED — budget, opinions, city-filtered workers)
// ══════════════════════════════════════════════════════════════════════════════
exports.generateAdvisorReport = async (req, res) => {
    const {
        workDescription, answers = {}, opinions = {},
        city = '', urgent = false, clientBudget,
    } = req.body;

    if (!workDescription?.trim()) return res.status(400).json({ message: 'Work description is required.' });

    const imageUploaded = !!req.file;
    const imageHint     = imageUploaded
        ? `\nThe client uploaded a photo. Include relevant imageFindings (visible issues commonly seen in such photos).`
        : '';

    const budgetNote = clientBudget && Number(clientBudget) > 0
        ? `\nClient Budget: ₹${Number(clientBudget).toLocaleString('en-IN')} (consider this in your estimate and budgetAdvice)`
        : '';

    const answersText  = Object.entries(answers).filter(([,v])=>v).map(([q,a])=>`  - ${q}: ${a}`).join('\n');
    const opinionsText = Object.entries(opinions).filter(([,v])=>v).map(([q,a])=>`  - ${q}: ${a}`).join('\n');

    const userPrompt = `Work: "${workDescription}"
City: ${city||'Pune'}
Urgent: ${urgent?'Yes':'No'}${budgetNote}
${answersText?`Client Answers:\n${answersText}`:''}
${opinionsText?`Client Preferences (colour/style):\n${opinionsText}`:''}${imageHint}`;

    try {
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: ADVISOR_SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
            temperature: 0.3, max_tokens: 3000, response_format: { type: 'json_object' },
        });

        const raw      = completion.choices[0]?.message?.content || '{}';
        const aiResult = parseGroqJson(raw);

        const skillBlocks  = aiResult.skillBlocks || [];
        const isUrgent     = aiResult.urgent || urgent;
        const budgetResult = calculateStructuredBudget(skillBlocks, city, isUrgent);

        const materialsBreakdown = aiResult.materialsBreakdown || [];
        const equipmentBreakdown = aiResult.equipmentBreakdown || [];
        const materialsTotal     = materialsBreakdown.reduce((s,m)=>s+(Number(m.estimatedCost)||0),0);
        const equipmentTotal     = equipmentBreakdown.reduce((s,e)=>s+(Number(e.estimatedCost)||0),0);
        const labourTotal        = budgetResult.totalEstimated;
        const combinedTotal      = labourTotal + materialsTotal + equipmentTotal;
        const grandTotal         = combinedTotal;

        const clientBudgetNum = Number(clientBudget) || 0;
        const isOverBudget    = clientBudgetNum > 0 && grandTotal > clientBudgetNum;
        const budgetGap       = isOverBudget ? grandTotal - clientBudgetNum : 0;

        // ── Find nearby workers (skill + city match) ─────────────────────────
        const skillNames    = skillBlocks.map(b=>b.skill).filter(Boolean);
        const cityNorm      = normCity(city);
        const allWorkers    = await User.find({
            role: 'worker', verificationStatus: 'approved',
            skills: { $elemMatch: { name: { $in: skillNames } } },
        }).sort({ points: -1 }).limit(30).select('name karigarId photo overallExperience points skills mobile address');

        // Prefer same-city workers first, then others
        const nearbyFirst = allWorkers.filter(w => cityNorm && normCity(w.address?.city||'').includes(cityNorm));
        const others      = allWorkers.filter(w => !cityNorm || !normCity(w.address?.city||'').includes(cityNorm));
        const topWorkers  = [...nearbyFirst, ...others].slice(0, 8);
        const confidence = calculateConfidenceScore({
            workDescription,
            answers,
            opinions,
            imageUploaded,
            imageFindings: aiResult.imageFindings || [],
            skillBlocks,
            topWorkers,
        });

        const report = {
            jobTitle:             aiResult.jobTitle         || workDescription.slice(0,60),
            problemSummary:       aiResult.problemSummary   || '',
            city,
            urgent: !!isUrgent,
            durationDays:         aiResult.durationDays     || 1,
            isAIEstimate:         true,
            skillBlocks,
            budgetBreakdown:      budgetResult,
            labourTotal,
            materialsBreakdown,
            equipmentBreakdown,
            materialsTotal,
            equipmentTotal,
            combinedTotal,
            grandTotal,
            clientBudget:         clientBudgetNum,
            isOverBudget,
            budgetGap,
            budgetAdvice:         aiResult.budgetAdvice     || '',
            workPlan:             aiResult.workPlan         || [],
            timeEstimate:         aiResult.timeEstimate     || {},
            expectedOutcome:      aiResult.expectedOutcome  || [],
            colourAndStyleAdvice: aiResult.colourAndStyleAdvice || '',
            designSuggestions:    aiResult.designSuggestions   || [],
            improvementIdeas:     aiResult.improvementIdeas    || [],
            imageFindings:        imageUploaded ? (aiResult.imageFindings||[]) : [],
            imageUploaded,
            warnings:             aiResult.warnings           || [],
            visualizationDescription: aiResult.visualizationDescription || '',
            topWorkers:           topWorkers.map(formatWorker),
            confidence,
            originalImageUrl:     req.file?.path || '',
            previewOptions:       [],
        };

        return res.status(200).json(report);
    } catch (err) {
        console.error('generateAdvisorReport error:', err);
        return res.status(500).json({ message: 'Failed to generate advisor report.' });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/ai/generate-preview-images
// ══════════════════════════════════════════════════════════════════════════════
exports.generatePreviewImages = async (req, res) => {
    try {
        const rawAnalysis = req.body.analysis;
        const analysis = typeof rawAnalysis === 'string' ? JSON.parse(rawAnalysis) : (rawAnalysis || {});
        const styleOptionsRaw = req.body.styleOptions;
        const styleOptions = typeof styleOptionsRaw === 'string' ? JSON.parse(styleOptionsRaw) : styleOptionsRaw;

        const sourceImageUrl = req.file?.path || analysis?.originalImageUrl || '';
        if (!sourceImageUrl) {
            return res.status(400).json({ message: 'A source image is required (upload workImage or provide originalImageUrl in analysis).' });
        }

        const previewOptions = createPreviewOptions({
            sourceImageUrl,
            analysis: { ...analysis, city: analysis?.city || req.body.city || '' },
            styleOptions: Array.isArray(styleOptions) ? styleOptions : [],
        });

        const generated = [];
        for (const option of previewOptions) {
            const img = await generatePreviewImage({ sourceImageUrl, prompt: option.prompt, style: option.style });
            generated.push({
                style: option.style,
                description: option.description,
                prompt: option.prompt,
                imageUrl: img.imageUrl,
                source: img.source,
            });
            // Prevent burst rate limits on providers.
            await sleep(200);
        }

        return res.status(200).json({
            sourceImageUrl,
            generatedAt: new Date().toISOString(),
            previewOptions: generated,
        });
    } catch (err) {
        console.error('generatePreviewImages error:', err.message);
        return res.status(500).json({ message: 'Failed to generate preview images.' });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// LEGACY: POST /api/ai/assistant  (UNCHANGED)
// ══════════════════════════════════════════════════════════════════════════════
exports.startConversation = async (req, res) => {
    const { workDescription, city = '', urgent = false } = req.body;
    if (!workDescription?.trim()) return res.status(400).json({ message: 'Work description is required.' });
    req.body = { workDescription, answers: {}, city, urgent };
    return exports.generateEstimate(req, res);
};

exports.analyzeWorkScope = async (workDescription, city) => {
    const req = { body: { workDescription, answers: {}, city, urgent: false }, file: null };
    const res = { status: () => res, json: (data) => data };
    return exports.generateEstimate(req, res);
};
