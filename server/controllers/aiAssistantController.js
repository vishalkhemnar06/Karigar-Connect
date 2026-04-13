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
const BaseRate = require('../models/baseRateModel');
const Product = require('../models/productModel');
const MarketRate = require('../models/marketRateModel');
const DemandSnapshot = require('../models/demandSnapshotModel');
const {
    calculateStructuredBudget,
    normalizeCityKey,
    normalizeSkillKey,
} = require('../services/pricingEngineService');
const {
    detectAndTranslateToEnglish,
    translateText,
    translateBatch,
    normalizeLanguage,
} = require('../services/translationService');

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

const fallbackCityOptions = [
    { key: 'mumbai', label: 'Mumbai' },
    { key: 'delhi', label: 'Delhi' },
    { key: 'bangalore', label: 'Bangalore' },
    { key: 'hyderabad', label: 'Hyderabad' },
    { key: 'pune', label: 'Pune' },
    { key: 'chennai', label: 'Chennai' },
    { key: 'kolkata', label: 'Kolkata' },
];

const parseBooleanInput = (value, fallback = true) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['false', '0', 'no', 'off', 'n'].includes(normalized)) return false;
    if (['true', '1', 'yes', 'on', 'y'].includes(normalized)) return true;
    return fallback;
};

const parseOwnershipList = (value) => String(value || '')
    .split(/[\n,;/]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const isOwnedItem = (itemName, ownershipList = []) => {
    const itemText = normalizeText(itemName);
    if (!itemText) return false;
    return ownershipList.some((owned) => {
        const ownedText = normalizeText(owned);
        if (!ownedText) return false;
        return itemText.includes(ownedText) || ownedText.includes(itemText);
    });
};

const filterBreakdownByOwnership = (items = [], ownershipList = []) => {
    const excludedItems = [];
    const filteredItems = (Array.isArray(items) ? items : []).filter((item) => {
        const itemName = String(item?.item || item?.name || '').trim();
        const matched = isOwnedItem(itemName, ownershipList);
        if (matched) excludedItems.push(itemName || 'unknown item');
        return !matched;
    });

    return {
        items: filteredItems,
        excludedItems,
    };
};

const sumEstimatedCost = (items = []) => items.reduce((sum, item) => sum + (Number(item?.estimatedCost) || 0), 0);

const escapeRegex = (text = '') => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMedian = (values = []) => {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const tokenizeItemName = (itemName = '') => String(itemName)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const buildMarketplaceSearchRegex = (itemName = '') => {
    const tokens = tokenizeItemName(itemName);
    if (!tokens.length) return null;
    const selected = tokens.slice(0, 4).map(escapeRegex);
    return new RegExp(selected.join('|'), 'i');
};

const fetchMarketplacePriceStats = async ({ city = '', itemName = '' }) => {
    try {
        const nameRegex = buildMarketplaceSearchRegex(itemName);
        if (!nameRegex) return null;

        const cityRegex = city ? new RegExp(`^${escapeRegex(String(city).trim())}$`, 'i') : null;
        const pipeline = [
            { $match: { isActive: true, name: nameRegex, price: { $gt: 0 } } },
            {
                $lookup: {
                    from: 'shops',
                    localField: 'shop',
                    foreignField: '_id',
                    as: 'shop',
                },
            },
            { $unwind: '$shop' },
            { $match: { 'shop.verificationStatus': 'approved', ...(cityRegex ? { 'shop.city': cityRegex } : {}) } },
            { $project: { _id: 0, price: 1, name: 1, city: '$shop.city', shopName: '$shop.shopName' } },
            { $sort: { price: 1 } },
            { $limit: 60 },
        ];

        const rows = await Product.aggregate(pipeline);
        if (!rows.length) return null;

        const prices = rows.map((row) => Number(row.price)).filter((price) => Number.isFinite(price) && price > 0);
        if (!prices.length) return null;

        return {
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
            medianPrice: getMedian(prices),
            sampleSize: prices.length,
            matchedProducts: rows.slice(0, 5),
        };
    } catch (error) {
        console.error('fetchMarketplacePriceStats error:', error.message);
        return null;
    }
};

const formatCurrencyValue = (value) => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

const getBenchmarkFromBudget = (budgetResult = {}) => {
    const labourTotal = Number(budgetResult.totalEstimated) || 0;
    const workerCount = Math.max(1, Number(budgetResult.totalWorkers) || 1);
    const dayBenchmark = labourTotal > 0 ? labourTotal / workerCount : 0;
    return dayBenchmark > 0 ? dayBenchmark : 1200;
};

const buildMarketInsight = async ({ city = '', skillBlocks = [], budgetResult = {} }) => {
    const cityKey = normalizeCityKey(city);
    const skillKeys = [...new Set((skillBlocks || []).map((block) => normalizeSkillKey(block.skill)).filter(Boolean))];
    const fallbackSkills = skillKeys.length ? skillKeys : ['handyman'];

    const marketRates = await MarketRate.find({
        cityKey,
        skillKey: { $in: fallbackSkills },
        isActive: true,
    }).select('skillKey p50 p75 p90 avgHours dataPoints confidence lastUpdated');

    const demandSnapshots = await DemandSnapshot.find({
        cityKey,
        skillKey: { $in: fallbackSkills },
    }).sort({ capturedAt: -1 }).limit(fallbackSkills.length || 1).select('skillKey activeJobs activeWorkers ratio capturedAt');

    const avgDailyRate = marketRates.length
        ? marketRates.reduce((sum, row) => sum + (Number(row.p50) || 0), 0) / marketRates.length
        : getBenchmarkFromBudget(budgetResult);

    const avgRatio = demandSnapshots.length
        ? demandSnapshots.reduce((sum, row) => sum + (Number(row.ratio) || 1), 0) / demandSnapshots.length
        : 1;

    const demandLevel = avgRatio >= 1.25 ? 'High' : avgRatio <= 0.85 ? 'Low' : 'Normal';
    const availability = avgRatio >= 1.25 ? 'Low' : avgRatio <= 0.85 ? 'High' : 'Moderate';

    return {
        city,
        cityKey,
        avgDailyRate: Math.round(avgDailyRate),
        demandLevel,
        availability,
        avgDemandRatio: Number(avgRatio.toFixed(2)),
        marketRates: marketRates.map((row) => ({
            skillKey: row.skillKey,
            p50: row.p50,
            p75: row.p75,
            p90: row.p90,
            avgHours: row.avgHours,
            dataPoints: row.dataPoints,
            confidence: row.confidence,
            lastUpdated: row.lastUpdated,
        })),
        demandSnapshots: demandSnapshots.map((row) => ({
            skillKey: row.skillKey,
            activeJobs: row.activeJobs,
            activeWorkers: row.activeWorkers,
            ratio: row.ratio,
            capturedAt: row.capturedAt,
        })),
    };
};

const buildPriceReasoning = ({
    city,
    budgetResult = {},
    signals = {},
    includeMaterials = true,
    includeEquipment = true,
    ownedMaterialList = [],
    ownedEquipmentList = [],
    marketInsight = {},
    requiredMaterialsTotal = 0,
    optionalMaterialsTotal = 0,
    requiredEquipmentTotal = 0,
    optionalEquipmentTotal = 0,
}) => {
    const reasons = [];
    const smallArea = Number(signals.areaSqft) > 0 && Number(signals.areaSqft) <= 250;

    reasons.push(`Labour is based on current ${city || 'city'} market rates for ${Math.max(1, Number(budgetResult.totalWorkers) || 1)} worker(s) across ${Math.max(1, Number(budgetResult.durationDays) || 1)} day(s).`);

    if (smallArea) {
        reasons.push(`Small wall area (${Math.round(signals.areaSqft)} sqft) limits material usage.`);
    }

    if (signals.hasCracks) {
        reasons.push('Surface damage is present, so extra prep material like putty may be required.');
    } else {
        reasons.push('No major surface damage detected, so heavy prep usage can be reduced.');
    }

    if (!includeMaterials) {
        reasons.push('Material cost is excluded because you selected labour-only pricing.');
    } else if (ownedMaterialList.length > 0) {
        reasons.push(`You already have ${ownedMaterialList.length} material item(s), so they were removed from the quote.`);
    }

    if (!includeEquipment) {
        reasons.push('Equipment cost is excluded because you selected labour-only pricing.');
    } else if (ownedEquipmentList.length > 0) {
        reasons.push(`You already have ${ownedEquipmentList.length} equipment item(s), so they were removed from the quote.`);
    }

    if (marketInsight.avgDemandRatio > 1.25) {
        reasons.push(`Local demand in ${city || 'your city'} is above average, which can push prices up.`);
    } else if (marketInsight.avgDemandRatio < 0.85) {
        reasons.push(`Worker availability in ${city || 'your city'} is strong, which keeps prices competitive.`);
    }

    return reasons;
};

const buildCostSavingSuggestions = ({
    signals = {},
    includeMaterials = true,
    includeEquipment = true,
    ownedMaterialList = [],
    ownedEquipmentList = [],
    marketInsight = {},
}) => {
    const suggestions = [];

    if (signals.hasCracks) {
        suggestions.push('Skip putty only if the wall is already crack-free; otherwise it is still needed for finish quality.');
    }

    if (signals.hasGoodSurface) {
        suggestions.push('A smooth wall can reduce prep and touch-up material usage.');
    }

    if (ownedMaterialList.length > 0) {
        suggestions.push('Reuse the materials you already have to avoid duplicate purchases.');
    }

    if (ownedEquipmentList.length > 0) {
        suggestions.push('Use your existing tools/equipment where possible to cut tool charges.');
    }

    if (marketInsight.avgDemandRatio > 1.15) {
        suggestions.push('Book when demand is lower if your schedule is flexible; high-demand periods raise rates.');
    }

    if (includeMaterials || includeEquipment) {
        suggestions.push('Combine all nearby walls or related tasks into one visit to spread the setup cost.');
    }

    if (signals.areaSqft > 0 && signals.areaSqft <= 250) {
        suggestions.push('For a small wall, buy only the exact consumables needed instead of full packs.');
    }

    return suggestions.slice(0, 5);
};

const buildNegotiationRange = ({ expected = 0, confidence = 0, demandRatio = 1 }) => {
    if (!expected) return { min: 0, max: 0 };
    const spread = clamp(0.08 + (1 - Math.min(1, confidence)) * 0.07 + (demandRatio > 1 ? 0.02 : 0), 0.08, 0.18);
    return {
        min: Math.round(expected * (1 - spread)),
        max: Math.round(expected * (1 + spread * 0.6)),
    };
};

const splitMaterialBuckets = (items = []) => {
    const requiredItems = [];
    const optionalItems = [];
    for (const item of items) {
        if (item?.optional) optionalItems.push(item);
        else requiredItems.push(item);
    }
    return { requiredItems, optionalItems };
};

const buildProjectSummary = ({
    labourMin = 0,
    labourExpected = 0,
    labourMax = 0,
    materialsRequired = 0,
    materialsOptional = 0,
    equipmentRequired = 0,
    equipmentOptional = 0,
}) => {
    const bestCase = labourMin + materialsRequired + equipmentRequired;
    const expected = labourExpected + materialsRequired + materialsOptional + equipmentRequired + equipmentOptional;
    const worstCase = labourMax + materialsRequired + materialsOptional + equipmentRequired + equipmentOptional;
    return { bestCase, expected, worstCase };
};

const parseFirstNumber = (text = '') => {
    const match = String(text || '').match(/\b(\d+(?:\.\d+)?)\b/);
    return match ? Number(match[1]) : 0;
};

const estimateMaterialOrEquipmentItem = async ({
    item = {},
    kind = 'material',
    signals = {},
    marketInsight = {},
    city = '',
}) => {
    const name = String(item.item || item.name || '').toLowerCase();
    const benchmark = Math.max(1, Number(marketInsight.avgDailyRate) || 0);
    const areaSqft = Math.max(0, Number(signals.areaSqft) || 0);
    const wallCount = Math.max(1, Number(signals.wallCount) || 1);
    const marketplaceStats = await fetchMarketplacePriceStats({ city, itemName: item.item || item.name || '' });
    const unitBase = marketplaceStats?.medianPrice || (kind === 'material' ? benchmark * 0.12 : benchmark * 0.08);

    let optional = kind === 'equipment';
    let multiplier = 1;
    let note = String(item.note || '').trim();

    if (kind === 'material') {
        if (/paint|emulsion|distemper/.test(name)) {
            optional = false;
            const litresNeeded = areaSqft > 0 ? Math.max(1, Math.ceil(areaSqft / 75)) : 1;
            multiplier = litresNeeded * 0.85;
            note = note || `Estimated from ${areaSqft ? Math.round(areaSqft) : 'unknown'} sqft and paint coverage.`;
        } else if (/primer/.test(name)) {
            optional = !signals.isPaintJob;
            multiplier = Math.max(0.4, areaSqft > 0 ? Math.ceil(areaSqft / 120) * 0.5 : 0.5);
            note = note || 'Applied only when surface preparation is needed.';
        } else if (/putty/.test(name)) {
            optional = !signals.hasCracks && !signals.hasGoodSurface;
            multiplier = signals.hasCracks ? Math.max(0.35, wallCount * 0.35) : 0.18;
            note = note || (signals.hasCracks ? 'Required for visible cracks or uneven surface.' : 'Only a small touch-up amount is usually needed for smooth walls.');
        } else if (/sandpaper/.test(name)) {
            optional = true;
            multiplier = Math.max(0.12, wallCount * 0.08);
            note = note || 'Used only in limited quantity for surface prep.';
        } else if (/masking|tape/.test(name)) {
            optional = true;
            multiplier = Math.max(0.08, wallCount * 0.06);
            note = note || 'Optional when clean edge protection is required.';
        } else if (/drop cloth|plastic sheet|protection/.test(name)) {
            optional = true;
            multiplier = Math.max(0.06, wallCount * 0.05);
            note = note || 'Optional when furniture/floor protection is needed.';
        } else {
            multiplier = 0.15;
        }
    } else {
        if (/roller|brush/.test(name)) {
            optional = true;
            multiplier = Math.max(0.14, wallCount * 0.08);
            note = note || 'Usually only charged when the client needs dedicated consumables.';
        } else if (/drop cloth|sheet|tape|sandpaper/.test(name)) {
            optional = true;
            multiplier = Math.max(0.07, wallCount * 0.05);
            note = note || 'Consumable tool item for site preparation.';
        } else {
            multiplier = 0.1;
        }
    }

    const baseCost = Math.max(1, Math.round(unitBase * multiplier));
    const bestCaseCost = Math.max(1, Math.round((marketplaceStats?.minPrice || (unitBase * 0.85)) * multiplier));
    const worstCaseCost = Math.max(baseCost, Math.round((marketplaceStats?.maxPrice || (unitBase * 1.2)) * multiplier));

    return {
        ...item,
        optional,
        estimatedCost: baseCost,
        bestCaseCost,
        worstCaseCost,
        priceSource: marketplaceStats ? 'marketplace_product_prices' : 'derived_market_benchmark',
        marketplaceSampleSize: marketplaceStats?.sampleSize || 0,
        marketplaceUnitPrice: marketplaceStats?.medianPrice || 0,
        note,
    };
};

const summarizeBuckets = (items = []) => {
    const requiredItems = [];
    const optionalItems = [];
    for (const item of items) {
        if (item?.optional) optionalItems.push(item);
        else requiredItems.push(item);
    }
    return {
        requiredItems,
        optionalItems,
        requiredTotal: sumEstimatedCost(requiredItems),
        optionalTotal: sumEstimatedCost(optionalItems),
        total: sumEstimatedCost(items),
    };
};

const getRateTableCities = async () => {
    try {
        const rows = await BaseRate.aggregate([
            { $match: { isActive: true } },
            {
                $group: {
                    _id: '$cityKey',
                    key: { $first: '$cityKey' },
                    label: { $first: '$city' },
                },
            },
            { $project: { _id: 0, key: 1, label: 1 } },
            { $sort: { label: 1 } },
        ]);

        const options = (rows || [])
            .map((row) => ({
                key: String(row?.key || '').trim(),
                label: String(row?.label || '').trim() || titleCase(String(row?.key || '')),
            }))
            .filter((row) => row.key && row.label);

        return options.length ? options : fallbackCityOptions;
    } catch (err) {
        console.error('getRateTableCities data error:', err.message);
        return fallbackCityOptions;
    }
};

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

const mandatoryConditionQuestions = [
    { id: 'q_condition_1', question: 'What is the current wall or surface condition?', type: 'select', options: ['Smooth', 'Minor cracks', 'Major cracks', 'Peeling paint', 'Dampness'], required: true },
    { id: 'q_condition_2', question: 'Do you already have any materials or tools for this job?', type: 'text', required: true },
    { id: 'q_condition_3', question: 'Are protective items like masking tape or drop cloth already available?', type: 'select', options: ['Yes', 'No', 'Some items available'], required: true },
    { id: 'q_condition_4', question: 'How many walls or areas need work?', type: 'number', required: true },
];

const mergeMandatoryQuestions = (questions = []) => {
    const existing = new Set((Array.isArray(questions) ? questions : []).map((q) => String(q?.question || '').toLowerCase().trim()));
    const merged = [...(Array.isArray(questions) ? questions : [])];
    for (const question of mandatoryConditionQuestions) {
        if (!existing.has(question.question.toLowerCase())) {
            merged.push(question);
        }
    }
    return merged;
};

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
    const merged = mergeMandatoryQuestions(cleaned);
    const mandatorySet = new Set(mandatoryConditionQuestions.map((q) => q.question.toLowerCase()));
    const mandatoryQuestions = merged.filter((q) => mandatorySet.has(String(q.question || '').toLowerCase()));
    const otherQuestions = merged.filter((q) => !mandatorySet.has(String(q.question || '').toLowerCase()));
    return [...mandatoryQuestions, ...otherQuestions].slice(0, 8);
};

const getAnswerBlob = (answers = {}) => Object.entries(answers)
    .filter(([, value]) => value)
    .map(([, value]) => String(value).toLowerCase())
    .join(' ');

const deriveConditionSignals = ({ workDescription = '', answers = {} }) => {
    const text = `${String(workDescription || '').toLowerCase()} ${getAnswerBlob(answers)}`;
    const areaMatch = text.match(/(\b\d+(?:\.\d+)?\b)\s*(sq\s*ft|sqft|square feet|square foot)/);
    const wallMatch = text.match(/(\b\d+(?:\.\d+)?\b)\s*(walls?|areas?)/);
    return {
        isPaintJob: /paint|painting|repaint|whitewash|wall/.test(text),
        hasCracks: /crack|peel|peeling|damp|leak|patch|rough/.test(text),
        hasGoodSurface: /smooth|good condition|fine condition|already painted/.test(text),
        hasToolsOrMaterials: /have|already|available|own|got/.test(text),
        hasProtectionAvailable: /masking|drop cloth|sheet|protection/.test(text),
        areaSqft: areaMatch ? Number(areaMatch[1]) : 0,
        wallCount: wallMatch ? Number(wallMatch[1]) : 1,
    };
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
- Material estimates must be quantity-based and local-market realistic. Do not assume bulk packs for small jobs.
- For paint work, use coverage logic: 1L covers about 120-150 sqft for 1 coat; for 2 coats, effective coverage is about 70-80 sqft per litre.
- For small residential paint jobs, material totals should usually stay in the low-thousands unless the area is very large.
- Do not add full tool kits by default. Only include consumable tools or explicit rentals/purchases needed for the job.
- If Include Materials Cost = No, return an empty materialsBreakdown array.
- If Include Equipment Cost = No, return an empty equipmentBreakdown array.
- If the client already has any listed materials or equipment, do not include those items in the relevant breakdown.
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
    const cleaned = String(text || '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const direct = (() => {
        try { return JSON.parse(cleaned); } catch (_err) { return null; }
    })();
    if (direct) return direct;

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
        const sliced = cleaned.slice(start, end + 1);
        try {
            return JSON.parse(sliced);
        } catch (_err) {
            return null;
        }
    }
    return null;
};

const SKILL_IDENTIFIERS = new Set([
    'plumber', 'electrician', 'carpenter', 'painter', 'tiler',
    'mason', 'welder', 'ac_technician', 'pest_control', 'cleaner',
    'handyman', 'gardener',
]);

const shouldKeepAsIs = (value = '') => {
    const v = String(value || '').trim();
    if (!v) return true;
    if (SKILL_IDENTIFIERS.has(v.toLowerCase())) return true;
    if (/^https?:\/\//i.test(v)) return true;
    if (/^[a-z0-9_-]{1,32}$/i.test(v) && (v.toLowerCase().startsWith('q') || v.toLowerCase().startsWith('op'))) return true;
    if (/^\d+([.,]\d+)?$/.test(v)) return true;
    return false;
};

const translateQuestionSet = async (questions = [], targetLanguage = 'en') => {
    if (normalizeLanguage(targetLanguage) === 'en') return questions;
    const source = Array.isArray(questions) ? questions : [];
    const strings = [];

    source.forEach((q) => {
        if (q?.question && !shouldKeepAsIs(q.question)) strings.push(q.question);
        if (Array.isArray(q?.options)) {
            q.options.forEach((opt) => {
                if (opt && !shouldKeepAsIs(opt)) strings.push(opt);
            });
        }
    });

    if (!strings.length) return source;
    const translated = await translateBatch({ texts: strings, from: 'en', to: targetLanguage });
    const map = new Map();
    strings.forEach((src, idx) => map.set(src, translated[idx] || src));

    return source.map((q) => ({
        ...q,
        question: map.get(q.question) || q.question,
        options: Array.isArray(q.options)
            ? q.options.map((opt) => map.get(opt) || opt)
            : q.options,
    }));
};

const translateAdvisorReport = async (report = {}, targetLanguage = 'en') => {
    if (normalizeLanguage(targetLanguage) === 'en') return report;

    const texts = [];
    const pushIfText = (value) => {
        if (typeof value === 'string' && value.trim() && !shouldKeepAsIs(value)) texts.push(value);
    };

    pushIfText(report.jobTitle);
    pushIfText(report.problemSummary);
    pushIfText(report.budgetAdvice);
    pushIfText(report.colourAndStyleAdvice);
    pushIfText(report.visualizationDescription);
    pushIfText(report.recommendation);

    (report.workPlan || []).forEach((step) => {
        pushIfText(step?.title);
        pushIfText(step?.description);
        pushIfText(step?.estimatedTime);
        pushIfText(step?.phase);
    });
    (report.expectedOutcome || []).forEach(pushIfText);
    (report.designSuggestions || []).forEach(pushIfText);
    (report.imageFindings || []).forEach(pushIfText);
    (report.warnings || []).forEach(pushIfText);

    (report.materialsBreakdown || []).forEach((item) => {
        pushIfText(item?.item);
        pushIfText(item?.quantity);
        pushIfText(item?.note);
    });
    (report.equipmentBreakdown || []).forEach((item) => {
        pushIfText(item?.item);
        pushIfText(item?.note);
    });
    (report.improvementIdeas || []).forEach((item) => {
        pushIfText(item?.idea);
        pushIfText(item?.benefit);
    });
    (report.skillBlocks || []).forEach((item) => {
        pushIfText(item?.description);
    });

    (report.topWorkers || []).forEach((worker) => {
        pushIfText(worker?.locality);
    });

    if (!texts.length) return report;

    const translated = await translateBatch({ texts, from: 'en', to: targetLanguage });
    const map = new Map();
    texts.forEach((src, idx) => map.set(src, translated[idx] || src));
    const tr = (v) => (typeof v === 'string' ? (map.get(v) || v) : v);

    return {
        ...report,
        jobTitle: tr(report.jobTitle),
        problemSummary: tr(report.problemSummary),
        budgetAdvice: tr(report.budgetAdvice),
        colourAndStyleAdvice: tr(report.colourAndStyleAdvice),
        visualizationDescription: tr(report.visualizationDescription),
        recommendation: tr(report.recommendation),
        workPlan: (report.workPlan || []).map((step) => ({
            ...step,
            title: tr(step?.title),
            description: tr(step?.description),
            estimatedTime: tr(step?.estimatedTime),
            phase: tr(step?.phase),
        })),
        expectedOutcome: (report.expectedOutcome || []).map((v) => tr(v)),
        designSuggestions: (report.designSuggestions || []).map((v) => tr(v)),
        imageFindings: (report.imageFindings || []).map((v) => tr(v)),
        warnings: (report.warnings || []).map((v) => tr(v)),
        materialsBreakdown: (report.materialsBreakdown || []).map((item) => ({
            ...item,
            item: tr(item?.item),
            quantity: tr(item?.quantity),
            note: tr(item?.note),
        })),
        equipmentBreakdown: (report.equipmentBreakdown || []).map((item) => ({
            ...item,
            item: tr(item?.item),
            note: tr(item?.note),
        })),
        improvementIdeas: (report.improvementIdeas || []).map((item) => ({
            ...item,
            idea: tr(item?.idea),
            benefit: tr(item?.benefit),
        })),
        skillBlocks: (report.skillBlocks || []).map((item) => ({
            ...item,
            description: tr(item?.description),
        })),
        topWorkers: (report.topWorkers || []).map((worker) => ({
            ...worker,
            locality: tr(worker?.locality),
        })),
    };
};

const buildTranslatedInput = async ({ workDescription = '', city = '', answers = {}, opinions = {}, preferredLanguage = '' }) => {
    const combined = [
        workDescription,
        city,
        ...Object.keys(answers || {}),
        ...Object.values(answers || {}),
        ...Object.keys(opinions || {}),
        ...Object.values(opinions || {}),
    ].filter(Boolean).join(' ');

    const detection = await detectAndTranslateToEnglish(combined || workDescription || '');
    const inputLanguage = normalizeLanguage(detection.detectedLanguage);
    const selectedLanguage = normalizeLanguage(preferredLanguage || inputLanguage);

    const workDescriptionEn = (await translateText(workDescription, 'en', 'auto')).translatedText;
    const cityEn = city ? (await translateText(city, 'en', 'auto')).translatedText : city;

    const translatedAnswers = {};
    for (const [k, v] of Object.entries(answers || {})) {
        const keyEn = k ? (await translateText(String(k), 'en', 'auto')).translatedText : k;
        const valueEn = v ? (await translateText(String(v), 'en', 'auto')).translatedText : v;
        translatedAnswers[keyEn] = valueEn;
    }

    const translatedOpinions = {};
    for (const [k, v] of Object.entries(opinions || {})) {
        const keyEn = k ? (await translateText(String(k), 'en', 'auto')).translatedText : k;
        const valueEn = v ? (await translateText(String(v), 'en', 'auto')).translatedText : v;
        translatedOpinions[keyEn] = valueEn;
    }

    return {
        inputLanguage,
        selectedLanguage,
        workDescriptionEn,
        cityEn,
        answersEn: translatedAnswers,
        opinionsEn: translatedOpinions,
    };
};

const callGroqJson = async ({ systemPrompt, userPrompt, maxTokens = 1200, temperature = 0.2, fallback = {} }) => {
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const completion = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: attempt === 1
                            ? userPrompt
                            : `${userPrompt}\n\nIMPORTANT: Return only strict JSON object with no markdown and no prose.`,
                    },
                ],
                temperature,
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
            });

            const raw = completion.choices[0]?.message?.content || '{}';
            const parsed = parseGroqJson(raw);
            if (parsed && typeof parsed === 'object') {
                return { parsed, usedFallback: false };
            }
            lastError = new Error('Invalid JSON from Groq');
        } catch (err) {
            lastError = err;
        }
    }

    return {
        parsed: fallback,
        usedFallback: true,
        error: lastError,
    };
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
    const { city = '', preferredLanguage = '' } = req.body;
    const workDescription = String(req.body?.workDescription || req.body?.description || '').trim();
    if (!workDescription) {
        return res.status(400).json({ message: 'Work description is required.' });
    }
    if (workDescription.length < 10) {
        return res.status(400).json({ message: 'Please enter at least 10 characters in work description.' });
    }
    try {
        const { inputLanguage, selectedLanguage, workDescriptionEn, cityEn } = await buildTranslatedInput({
            workDescription,
            city,
            preferredLanguage,
            answers: {},
            opinions: {},
        });

        const { parsed, usedFallback } = await callGroqJson({
            systemPrompt: QUESTIONS_SYSTEM_PROMPT,
            userPrompt: `Work Description: "${workDescriptionEn}"${cityEn ? `\nCity: ${cityEn}` : ''}`,
            maxTokens: 1000,
            temperature: 0.3,
            fallback: {
                questions: ensureMinimumWorkQuestions([]),
                opinionQuestions: [],
            },
        });

        let questions = parsed?.questions || [];
        let opinionQuestions = parsed?.opinionQuestions || [];
        if (!Array.isArray(questions)) questions = [];
        if (!Array.isArray(opinionQuestions)) opinionQuestions = [];
        questions = mergeMandatoryQuestions(ensureMinimumWorkQuestions(questions));

        if (selectedLanguage !== 'en') {
            questions = await translateQuestionSet(questions, selectedLanguage);
            opinionQuestions = await translateQuestionSet(opinionQuestions, selectedLanguage);
        }

        return res.status(200).json({
            questions,
            opinionQuestions,
            language: {
                detected: inputLanguage,
                selected: selectedLanguage,
                translatedToEnglish: true,
                responseTranslated: selectedLanguage !== 'en',
                usedFallback,
            },
        });
    } catch (err) {
        console.error('generateQuestions error:', err.message);
        return res.status(200).json({
            questions: mergeMandatoryQuestions(ensureMinimumWorkQuestions([])),
            opinionQuestions: [],
            language: {
                detected: 'en',
                translatedToEnglish: false,
                responseTranslated: false,
                usedFallback: true,
            },
        });
    }
};

exports.getRateTableCities = async (_req, res) => {
    const cities = await getRateTableCities();
    return res.status(200).json({ cities });
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/ai/generate-estimate  (UNCHANGED)
// ══════════════════════════════════════════════════════════════════════════════
exports.generateEstimate = async (req, res) => {
    const { workDescription, answers = {}, city = '', urgent = false, workerCountOverride, preferredLanguage = '' } = req.body;
    if (!workDescription?.trim()) return res.status(400).json({ message: 'Work description is required.' });
    try {
        const { inputLanguage, selectedLanguage, workDescriptionEn, cityEn, answersEn } = await buildTranslatedInput({
            workDescription,
            city,
            preferredLanguage,
            answers,
            opinions: {},
        });

        const answersText = Object.entries(answersEn).map(([q, a]) => `  - ${q}: ${a}`).join('\n');
        const userPrompt = `Work: "${workDescriptionEn}"\nCity: ${cityEn || 'Unknown'}\nUrgent: ${urgent ? 'Yes' : 'No'}\n${answersText ? `Answers:\n${answersText}` : ''}`;

        const { parsed: aiResult, usedFallback: groqFallbackUsed } = await callGroqJson({
            systemPrompt: ESTIMATE_SYSTEM_PROMPT,
            userPrompt,
            maxTokens: 1000,
            temperature: 0.2,
            fallback: {
                jobTitle: workDescriptionEn.slice(0, 60) || 'Home Service Work',
                skillBlocks: [{ skill: 'handyman', count: 1, hours: 8, complexity: 'normal', description: 'General home service task.' }],
                durationDays: 1,
                urgent: !!urgent,
                recommendation: 'Please share more details for a more accurate estimate.',
            },
        });

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
        const budgetResult = await calculateStructuredBudget(skillBlocks, city, aiResult.urgent||urgent);
        const marketInsight = await buildMarketInsight({ city, skillBlocks, budgetResult });
        const labourConfidence = Math.round(
            ((budgetResult.breakdown || []).reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / Math.max(1, budgetResult.breakdown.length)) * 100
        );
        const labourMin = Number(budgetResult.totalMinEstimated) || Math.round(Number(budgetResult.totalEstimated) * 0.9);
        const labourMax = Number(budgetResult.totalMaxEstimated) || Math.round(Number(budgetResult.totalEstimated) * 1.15);
        const negotiationRange = buildNegotiationRange({
            expected: Number(budgetResult.totalEstimated) || 0,
            confidence: labourConfidence / 100,
            demandRatio: Number(marketInsight.avgDemandRatio) || 1,
        });
        const skillNames   = skillBlocks.map(b=>b.skill).filter(Boolean);
        const topWorkers   = await User.find({ role:'worker', verificationStatus:'approved', skills:{$elemMatch:{name:{$in:skillNames}}} }).sort({points:-1}).limit(10).select('name karigarId photo overallExperience points skills mobile address');

        let response = {
            jobTitle: aiResult.jobTitle || '',
            durationDays: aiResult.durationDays || 1,
            skillBlocks,
            budgetBreakdown: budgetResult,
            breakdownMode: 'labour_only',
            labourConfidence,
            priceReasoning: buildPriceReasoning({
                city,
                budgetResult,
                signals: deriveConditionSignals({ workDescription, answers }),
                includeMaterials: false,
                includeEquipment: false,
                marketInsight,
                ownedMaterialList: [],
                ownedEquipmentList: [],
            }),
            costSavingSuggestions: buildCostSavingSuggestions({
                signals: deriveConditionSignals({ workDescription, answers }),
                includeMaterials: false,
                includeEquipment: false,
                marketInsight,
            }),
            localMarketInsight: marketInsight,
            bestCaseTotal: labourMin,
            expectedTotal: Number(budgetResult.totalEstimated) || 0,
            worstCaseTotal: labourMax,
            negotiationRange,
            recommendation: aiResult.recommendation || '',
            topWorkers: topWorkers.map(formatWorker),
            language: {
                detected: inputLanguage,
                selected: selectedLanguage,
                translatedToEnglish: true,
                responseTranslated: selectedLanguage !== 'en',
                usedFallback: groqFallbackUsed,
            },
        };

        if (selectedLanguage !== 'en') {
            const translated = await translateAdvisorReport(response, selectedLanguage);
            response = {
                ...translated,
                skillBlocks: response.skillBlocks.map((block, idx) => ({
                    ...block,
                    description: translated.skillBlocks?.[idx]?.description || block.description,
                })),
                language: response.language,
            };
        }

        return res.status(200).json(response);
    } catch (err) {
        console.error('generateEstimate error:', err);
        const fallbackSkillBlocks = [{ skill: 'handyman', count: 1, hours: 8, complexity: 'normal', description: 'General home service task.' }];
        const fallbackBudget = await calculateStructuredBudget(fallbackSkillBlocks, city, !!urgent);
        return res.status(200).json({
            jobTitle: workDescription?.slice(0, 60) || 'Home Service Work',
            durationDays: 1,
            skillBlocks: fallbackSkillBlocks,
            budgetBreakdown: fallbackBudget,
            breakdownMode: 'labour_only',
            labourConfidence: Math.round(
                ((fallbackBudget.breakdown || []).reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / Math.max(1, fallbackBudget.breakdown.length)) * 100
            ),
            recommendation: 'Please share more details for a more accurate estimate.',
            topWorkers: [],
            priceReasoning: [],
            costSavingSuggestions: [],
            localMarketInsight: await buildMarketInsight({ city, skillBlocks: fallbackSkillBlocks, budgetResult: fallbackBudget }),
            bestCaseTotal: Number(fallbackBudget.totalMinEstimated) || fallbackBudget.totalEstimated,
            expectedTotal: fallbackBudget.totalEstimated,
            worstCaseTotal: Number(fallbackBudget.totalMaxEstimated) || fallbackBudget.totalEstimated,
            negotiationRange: buildNegotiationRange({ expected: fallbackBudget.totalEstimated, confidence: 0.5, demandRatio: 1 }),
            language: {
                detected: 'en',
                translatedToEnglish: false,
                responseTranslated: false,
                usedFallback: true,
            },
        });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/ai/advisor  (UPDATED — budget, opinions, city-filtered workers)
// ══════════════════════════════════════════════════════════════════════════════
exports.generateAdvisorReport = async (req, res) => {
    const {
        workDescription, answers = {}, opinions = {},
        city = '', urgent = false, clientBudget, preferredLanguage = '',
        includeMaterialCost,
        includeEquipmentCost,
        ownedMaterials,
        ownedEquipment,
    } = req.body;

    if (!workDescription?.trim()) return res.status(400).json({ message: 'Work description is required.' });

    const imageUploaded = !!req.file;
    const imageHint     = imageUploaded
        ? `\nThe client uploaded a photo. Include relevant imageFindings (visible issues commonly seen in such photos).`
        : '';

    const includeMaterials = parseBooleanInput(includeMaterialCost, true);
    const includeEquipment = parseBooleanInput(includeEquipmentCost, true);
    const ownedMaterialList = parseOwnershipList(ownedMaterials);
    const ownedEquipmentList = parseOwnershipList(ownedEquipment);

    const budgetNote = clientBudget && Number(clientBudget) > 0
        ? `\nClient Budget: ₹${Number(clientBudget).toLocaleString('en-IN')} (consider this in your estimate and budgetAdvice)`
        : '';
    const scopeNote = `\nInclude Materials Cost: ${includeMaterials ? 'Yes' : 'No'}\nInclude Equipment Cost: ${includeEquipment ? 'Yes' : 'No'}\nMaterials Already Available: ${ownedMaterialList.length ? ownedMaterialList.join(', ') : 'None'}\nEquipment Already Available: ${ownedEquipmentList.length ? ownedEquipmentList.join(', ') : 'None'}`;

    const {
        inputLanguage,
        selectedLanguage,
        workDescriptionEn,
        cityEn,
        answersEn,
        opinionsEn,
    } = await buildTranslatedInput({ workDescription, city, answers, opinions, preferredLanguage });

    const answersText  = Object.entries(answersEn).filter(([,v])=>v).map(([q,a])=>`  - ${q}: ${a}`).join('\n');
    const opinionsText = Object.entries(opinionsEn).filter(([,v])=>v).map(([q,a])=>`  - ${q}: ${a}`).join('\n');

    const userPrompt = `Work: "${workDescriptionEn}"
City: ${cityEn||'Pune'}
Urgent: ${urgent?'Yes':'No'}${budgetNote}
    ${scopeNote}
${answersText?`Client Answers:\n${answersText}`:''}
${opinionsText?`Client Preferences (colour/style):\n${opinionsText}`:''}${imageHint}`;

    try {
        const { parsed: aiResult, usedFallback: groqFallbackUsed } = await callGroqJson({
            systemPrompt: ADVISOR_SYSTEM_PROMPT,
            userPrompt,
            maxTokens: 3000,
            temperature: 0.3,
            fallback: {
                jobTitle: workDescriptionEn.slice(0, 60) || 'Home Service Work',
                problemSummary: 'Basic advisory generated due to temporary AI issue.',
                skillBlocks: [{ skill: 'handyman', count: 1, hours: 8, complexity: 'normal', description: 'General home service task.' }],
                materialsBreakdown: [],
                equipmentBreakdown: [],
                workPlan: [],
                timeEstimate: { totalDays: 1, totalHours: 8, phases: [] },
                expectedOutcome: [],
                colourAndStyleAdvice: '',
                designSuggestions: [],
                improvementIdeas: [],
                imageFindings: [],
                warnings: ['Advisory generated in fallback mode.'],
                visualizationDescription: '',
                budgetAdvice: 'Please review with a local expert before finalizing.',
                durationDays: 1,
                urgent: !!urgent,
                includeMaterialCost: includeMaterials,
                includeEquipmentCost: includeEquipment,
                ownedMaterials: ownedMaterialList,
                ownedEquipment: ownedEquipmentList,
            },
        });

        const skillBlocks  = aiResult.skillBlocks || [];
        const isUrgent     = aiResult.urgent || urgent;
        const budgetResult = await calculateStructuredBudget(skillBlocks, city, isUrgent);

        const conditionSignals = deriveConditionSignals({ workDescription, answers });
        const marketInsight = await buildMarketInsight({ city, skillBlocks, budgetResult });
        const labourConfidence = Math.round(
            ((budgetResult.breakdown || []).reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / Math.max(1, budgetResult.breakdown.length)) * 100
        );
        const labourMin = Number(budgetResult.totalMinEstimated) || Math.round(Number(budgetResult.totalEstimated) * 0.9);
        const labourMax = Number(budgetResult.totalMaxEstimated) || Math.round(Number(budgetResult.totalEstimated) * 1.15);
        const breakdownMode = includeMaterials && includeEquipment
            ? 'full_project'
            : includeMaterials
                ? 'labour_plus_material'
                : 'labour_only';

        const rawMaterialsBreakdown = Array.isArray(aiResult.materialsBreakdown) ? aiResult.materialsBreakdown : [];
        const rawEquipmentBreakdown = Array.isArray(aiResult.equipmentBreakdown) ? aiResult.equipmentBreakdown : [];
        const filteredMaterials = includeMaterials
            ? filterBreakdownByOwnership(rawMaterialsBreakdown, ownedMaterialList)
            : { items: [], excludedItems: rawMaterialsBreakdown.map((item) => String(item?.item || item?.name || 'unknown item')) };
        const filteredEquipment = includeEquipment
            ? filterBreakdownByOwnership(rawEquipmentBreakdown, ownedEquipmentList)
            : { items: [], excludedItems: rawEquipmentBreakdown.map((item) => String(item?.item || item?.name || 'unknown item')) };
        const materialsBreakdown = await Promise.all(filteredMaterials.items.map((item) => estimateMaterialOrEquipmentItem({
            item,
            kind: 'material',
            signals: conditionSignals,
            marketInsight,
            city,
        })));
        const equipmentBreakdown = await Promise.all(filteredEquipment.items.map((item) => estimateMaterialOrEquipmentItem({
            item,
            kind: 'equipment',
            signals: conditionSignals,
            marketInsight,
            city,
        })));
        const splitMaterials = summarizeBuckets(materialsBreakdown);
        const splitEquipment = summarizeBuckets(equipmentBreakdown);
        const materialsTotal     = includeMaterials ? sumEstimatedCost(materialsBreakdown) : 0;
        const equipmentTotal     = includeEquipment ? sumEstimatedCost(equipmentBreakdown) : 0;
        const requiredMaterialsTotal = includeMaterials ? splitMaterials.requiredTotal : 0;
        const optionalMaterialsTotal = includeMaterials ? splitMaterials.optionalTotal : 0;
        const requiredEquipmentTotal = includeEquipment ? splitEquipment.requiredTotal : 0;
        const optionalEquipmentTotal = includeEquipment ? splitEquipment.optionalTotal : 0;
        const labourTotal        = budgetResult.totalEstimated;
        const combinedTotal      = labourTotal + materialsTotal + equipmentTotal;
        const grandTotal         = combinedTotal;
        const sumCostByKey = (items = [], key = 'estimatedCost') => items.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
        const materialBestCaseTotal = includeMaterials ? sumCostByKey(splitMaterials.requiredItems, 'bestCaseCost') : 0;
        const materialWorstCaseTotal = includeMaterials ? sumCostByKey(materialsBreakdown, 'worstCaseCost') : 0;
        const equipmentBestCaseTotal = includeEquipment ? sumCostByKey(splitEquipment.requiredItems, 'bestCaseCost') : 0;
        const equipmentWorstCaseTotal = includeEquipment ? sumCostByKey(equipmentBreakdown, 'worstCaseCost') : 0;
        const projectSummary     = {
            bestCase: labourMin + materialBestCaseTotal + equipmentBestCaseTotal,
            expected: labourTotal + materialsTotal + equipmentTotal,
            worstCase: labourMax + materialWorstCaseTotal + equipmentWorstCaseTotal,
        };
        const marketplaceCoverage = {
            materialsFromMarketplace: materialsBreakdown.filter((item) => item.priceSource === 'marketplace_product_prices').length,
            equipmentFromMarketplace: equipmentBreakdown.filter((item) => item.priceSource === 'marketplace_product_prices').length,
            totalMaterialItems: materialsBreakdown.length,
            totalEquipmentItems: equipmentBreakdown.length,
        };
        const negotiationRange   = buildNegotiationRange({
            expected: projectSummary.expected,
            confidence: labourConfidence / 100,
            demandRatio: Number(marketInsight.avgDemandRatio) || 1,
        });
        const priceReasoning     = buildPriceReasoning({
            city,
            budgetResult,
            signals: conditionSignals,
            includeMaterials,
            includeEquipment,
            ownedMaterialList,
            ownedEquipmentList,
            marketInsight,
            requiredMaterialsTotal,
            optionalMaterialsTotal,
            requiredEquipmentTotal,
            optionalEquipmentTotal,
        });
        const costSavingSuggestions = buildCostSavingSuggestions({
            signals: conditionSignals,
            includeMaterials,
            includeEquipment,
            ownedMaterialList,
            ownedEquipmentList,
            marketInsight,
        });

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

        let report = {
            jobTitle:             aiResult.jobTitle         || workDescription.slice(0,60),
            problemSummary:       aiResult.problemSummary   || '',
            city,
            urgent: !!isUrgent,
            durationDays:         aiResult.durationDays     || 1,
            isAIEstimate:         true,
            skillBlocks,
            budgetBreakdown:      budgetResult,
            breakdownMode,
            labourConfidence,
            labourTotal,
            materialsBreakdown,
            equipmentBreakdown,
            requiredMaterialsBreakdown: splitMaterials.requiredItems,
            optionalMaterialsBreakdown: splitMaterials.optionalItems,
            requiredEquipmentBreakdown: splitEquipment.requiredItems,
            optionalEquipmentBreakdown: splitEquipment.optionalItems,
            materialsTotal,
            equipmentTotal,
            requiredMaterialsTotal,
            optionalMaterialsTotal,
            requiredEquipmentTotal,
            optionalEquipmentTotal,
            combinedTotal,
            grandTotal,
            includeMaterialCost: includeMaterials,
            includeEquipmentCost: includeEquipment,
            ownedMaterials: ownedMaterialList,
            ownedEquipment: ownedEquipmentList,
            excludedMaterials: filteredMaterials.excludedItems,
            excludedEquipment: filteredEquipment.excludedItems,
            localMarketInsight: {
                ...marketInsight,
                marketplaceCoverage,
            },
            priceReasoning,
            costSavingSuggestions,
            bestCaseTotal: projectSummary.bestCase,
            expectedTotal: projectSummary.expected,
            worstCaseTotal: projectSummary.worstCase,
            negotiationRange,
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
            language: {
                detected: inputLanguage,
                selected: selectedLanguage,
                translatedToEnglish: true,
                responseTranslated: selectedLanguage !== 'en',
                usedFallback: groqFallbackUsed,
            },
        };

        if (selectedLanguage !== 'en') {
            const translated = await translateAdvisorReport(report, selectedLanguage);
            report = {
                ...translated,
                language: report.language,
            };
        }

        return res.status(200).json(report);
    } catch (err) {
        console.error('generateAdvisorReport error:', err);
        const fallbackSkillBlocks = [{ skill: 'handyman', count: 1, hours: 8, complexity: 'normal', description: 'General home service task.' }];
        const budgetResult = await calculateStructuredBudget(fallbackSkillBlocks, city, !!urgent);
        const marketInsight = await buildMarketInsight({ city, skillBlocks: fallbackSkillBlocks, budgetResult });
        const labourConfidence = Math.round(
            ((budgetResult.breakdown || []).reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / Math.max(1, budgetResult.breakdown.length)) * 100
        );
        const labourMin = Number(budgetResult.totalMinEstimated) || Math.round(Number(budgetResult.totalEstimated) * 0.9);
        const labourMax = Number(budgetResult.totalMaxEstimated) || Math.round(Number(budgetResult.totalEstimated) * 1.15);
        const projectSummary = buildProjectSummary({
            labourMin,
            labourExpected: budgetResult.totalEstimated,
            labourMax,
            materialsRequired: 0,
            materialsOptional: 0,
            equipmentRequired: 0,
            equipmentOptional: 0,
        });
        return res.status(200).json({
            jobTitle: workDescription?.slice(0, 60) || 'Home Service Work',
            problemSummary: 'Unable to generate full advisory at the moment.',
            city,
            urgent: !!urgent,
            durationDays: 1,
            isAIEstimate: true,
            skillBlocks: fallbackSkillBlocks,
            budgetBreakdown: budgetResult,
            breakdownMode: 'labour_only',
            labourConfidence,
            labourTotal: budgetResult.totalEstimated,
            materialsBreakdown: [],
            equipmentBreakdown: [],
            materialsTotal: 0,
            equipmentTotal: 0,
            combinedTotal: budgetResult.totalEstimated,
            grandTotal: budgetResult.totalEstimated,
            priceReasoning: buildPriceReasoning({
                city,
                budgetResult,
                signals: deriveConditionSignals({ workDescription, answers }),
                includeMaterials: false,
                includeEquipment: false,
                marketInsight,
                ownedMaterialList: [],
                ownedEquipmentList: [],
                requiredMaterialsTotal: 0,
                optionalMaterialsTotal: 0,
                requiredEquipmentTotal: 0,
                optionalEquipmentTotal: 0,
            }),
            costSavingSuggestions: buildCostSavingSuggestions({
                signals: deriveConditionSignals({ workDescription, answers }),
                includeMaterials: false,
                includeEquipment: false,
                marketInsight,
            }),
            localMarketInsight: marketInsight,
            bestCaseTotal: projectSummary.bestCase,
            expectedTotal: projectSummary.expected,
            worstCaseTotal: projectSummary.worstCase,
            negotiationRange: buildNegotiationRange({ expected: projectSummary.expected, confidence: labourConfidence / 100, demandRatio: marketInsight.avgDemandRatio }),
            clientBudget: Number(clientBudget) || 0,
            isOverBudget: false,
            budgetGap: 0,
            budgetAdvice: 'Please try again shortly or consult a verified worker.',
            workPlan: [],
            timeEstimate: { totalDays: 1, totalHours: 8, phases: [] },
            expectedOutcome: [],
            colourAndStyleAdvice: '',
            designSuggestions: [],
            improvementIdeas: [],
            imageFindings: [],
            imageUploaded,
            warnings: ['Fallback response used due to AI processing failure.'],
            visualizationDescription: '',
            topWorkers: [],
            confidence: {
                score: 50,
                factors: { imageClarity: 45, userInputs: 55, similarPastJobs: 50 },
                basedOn: ['Fallback mode'],
            },
            originalImageUrl: req.file?.path || '',
            previewOptions: [],
            language: {
                detected: 'en',
                translatedToEnglish: false,
                responseTranslated: false,
                usedFallback: true,
            },
        });
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
