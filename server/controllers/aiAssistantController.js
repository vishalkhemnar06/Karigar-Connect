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
const Rating = require('../models/ratingModel');
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
const {
    deriveConditionSignals,
    estimateMaterialOrEquipmentItem,
    generateFullMaterialList,
} = require('../utils/materialEstimator');
const {
    calculateDemandMultipliers,
    calculateEndTime,
    getSeason,
    getDayType,
    getTimePeriod,
} = require('../utils/demandAndFestivalService');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── SYSTEM PROMPT: Question Generation ────────────────────────────────────────
const QUESTIONS_SYSTEM_PROMPT = `You are KarigarConnect's smart job intake assistant for India.

Your job is to generate dynamic, context-aware intake questions from the work description using strict rules.

Output ONLY valid JSON (no markdown) in this exact shape:
{
    "questions": [
        {
            "id": "q1",
            "question": "...",
            "type": "number|select|text",
            "options": ["..."],
            "multiSelect": true,
            "allowNotSure": false,
            "required": true
        }
    ],
    "opinionQuestions": []
}

Hard rules:
1. Generate EXACTLY 10 work questions.
2. Do NOT return static/template wording. Adapt to the given work description and inferred skill(s).
3. Keep all 10 as required=true.
4. Question 1 MUST be a number question for job scope quantity/size.
5. Questions must cover these mandatory topics:
     - current condition
     - location/access complexity
     - material responsibility (who provides materials)
     - timeline/start expectation (no exact date/time ask)
     - first-time vs maintenance vs redo
6. Remaining questions must be skill-specific cost drivers (sub-task type, quality level, worker preference, constraints, safety/access issues, equipment readiness, etc.).
7. For select questions:
     - include meaningful options based on context
     - ALWAYS include "Not sure" and "N/A"
     - set multiSelect=true
8. For number questions:
     - keep type=number
     - include options ["Not sure", "N/A"]
     - set allowNotSure=true
9. Never ask budget/cost/price.
10. Never ask for city, locality, exact date, exact time, or urgency level (already captured elsewhere).
11. Avoid awkward generic unit hints like "(units/items)" or "(hours or days)".
12. No duplicates or near-duplicates.

Do not generate opinion questions for this endpoint; return opinionQuestions as an empty array.`;

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

// ── CONFIGURATION: Travel cost by city ──────────────────────────────────────
const TRAVEL_COST_BY_CITY = {
    'pune': 55,
    'mumbai': 85,
    'delhi': 95,
    'bangalore': 70,
    'hyderabad': 65,
    'kolkata': 75,
    'default': 55,
};

const getTravelCostForCity = (city = '') => {
    const cityKey = String(city || '').toLowerCase().trim();
    return TRAVEL_COST_BY_CITY[cityKey] || TRAVEL_COST_BY_CITY.default;
};

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

const buildPriceReasoningFallback = ({
    city,
    budgetResult = {},
    signals = {},
    skillBlocks = [],
    workDescription = '',
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
    const skillKeys = [...new Set((Array.isArray(skillBlocks) ? skillBlocks : []).map((b) => normalizeSkillKey(b?.skill)).filter(Boolean))];
    const desc = String(workDescription || '').toLowerCase();
    const isLikelyFurnitureJob = skillKeys.includes('carpenter') && /furniture|wardrobe|bed|sofa|dining|modular\s*kitchen|furnishing|setup/.test(desc);
    const isSurfaceDriven = skillKeys.some((k) => ['painter', 'mason', 'tiler'].includes(k));

    reasons.push(`Labour is based on current ${city || 'city'} market rates for ${Math.max(1, Number(budgetResult.totalWorkers) || 1)} worker(s) across ${Math.max(1, Number(budgetResult.durationDays) || 1)} day(s).`);

    if (isSurfaceDriven && Number(signals.areaSqft) > 0 && Number(signals.areaSqft) <= 250) {
        reasons.push(`Smaller execution area (${Math.round(signals.areaSqft)} sqft) keeps material usage and labour hours tighter.`);
    }

    if (isSurfaceDriven && signals.hasCracks) {
        reasons.push('Surface condition indicates repair/prep effort, which can increase labour and consumable cost.');
    } else if (isSurfaceDriven) {
        reasons.push('Surface condition appears manageable, so heavy preparation effort is likely reduced.');
    } else {
        const primarySkill = titleCase(skillKeys[0] || 'handyman');
        reasons.push(`${primarySkill} pricing is derived from job scope, quantity, and expected execution time rather than wall-preparation assumptions.`);
    }

    if (isLikelyFurnitureJob) {
        reasons.push('Furniture/furnishing scope is evaluated component-wise (unit count, fabrication, fitting) to avoid underestimation.');
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

const PRICE_REASONING_SYSTEM_PROMPT = `You are KarigarConnect's pricing auditor for Indian home services.
Generate 3 to 5 concise reasons explaining why this estimate is priced this way.
Output ONLY valid JSON:
{
  "reasons": ["...", "..."]
}
Rules:
- Use the provided job, cost and market data only.
- Do not mention wall/surface prep unless the job is surface-related (painting/masonry/tiling/plastering).
- Keep each reason practical and human-readable.
- No markdown.`;

const buildPriceReasoning = async (params = {}) => {
    const {
        city,
        budgetResult = {},
        skillBlocks = [],
        workDescription = '',
        includeMaterials = true,
        includeEquipment = true,
        ownedMaterialList = [],
        ownedEquipmentList = [],
        marketInsight = {},
        requiredMaterialsTotal = 0,
        optionalMaterialsTotal = 0,
        requiredEquipmentTotal = 0,
        optionalEquipmentTotal = 0,
    } = params;

    const fallback = buildPriceReasoningFallback(params);
    const skillKeys = [...new Set((Array.isArray(skillBlocks) ? skillBlocks : []).map((b) => normalizeSkillKey(b?.skill)).filter(Boolean))];

    try {
        const { parsed, usedFallback } = await callGroqJson({
            systemPrompt: PRICE_REASONING_SYSTEM_PROMPT,
            userPrompt: `Job: ${String(workDescription || '').trim() || 'Home service work'}
City: ${city || 'Unknown'}
Skills: ${skillKeys.join(', ') || 'handyman'}
Workers: ${Number(budgetResult.totalWorkers) || 1}
DurationDays: ${Number(budgetResult.durationDays) || 1}
TotalHours: ${Number(budgetResult.totalHours) || 0}
LabourExpected: ₹${Math.round(Number(budgetResult.totalEstimated) || 0)}
MaterialsRequired: ₹${Math.round(Number(requiredMaterialsTotal) || 0)}
MaterialsOptional: ₹${Math.round(Number(optionalMaterialsTotal) || 0)}
EquipmentRequired: ₹${Math.round(Number(requiredEquipmentTotal) || 0)}
EquipmentOptional: ₹${Math.round(Number(optionalEquipmentTotal) || 0)}
IncludeMaterials: ${includeMaterials ? 'Yes' : 'No'}
IncludeEquipment: ${includeEquipment ? 'Yes' : 'No'}
OwnedMaterialsCount: ${ownedMaterialList.length}
OwnedEquipmentCount: ${ownedEquipmentList.length}
DemandRatio: ${Number(marketInsight.avgDemandRatio) || 1}
DemandLevel: ${marketInsight.demandLevel || 'Normal'}`,
            maxTokens: 450,
            temperature: 0.2,
            fallback: { reasons: fallback },
        });

        const reasons = Array.isArray(parsed?.reasons)
            ? parsed.reasons.map((r) => String(r || '').trim()).filter(Boolean)
            : [];

        if (!usedFallback && reasons.length >= 2) return reasons.slice(0, 5);
        return fallback;
    } catch (_err) {
        return fallback;
    }
};

const FURNITURE_CITY_MULT = {
    mumbai: 1.12,
    delhi: 1.1,
    bangalore: 1.09,
    pune: 1.05,
    hyderabad: 1.04,
    chennai: 1.04,
    kolkata: 1.02,
    default: 1.0,
};

const normalizeFurnitureCityMult = (city = '') => {
    const key = normalizeCityKey(city);
    return FURNITURE_CITY_MULT[key] || FURNITURE_CITY_MULT.default;
};

const extractScopeQuantity = ({ workDescription = '', answers = {} }) => {
    const corpus = [
        String(workDescription || ''),
        ...Object.entries(answers || {}).map(([q, a]) => `${q}: ${a}`),
    ].join(' | ').toLowerCase();

    const quantities = [];
    const pushQty = (raw) => {
        const num = Number(raw);
        if (!Number.isFinite(num)) return;
        if (num <= 1) return;
        if (num > 200) return;
        quantities.push(num);
    };

    const isScopeQuestion = (question = '') => {
        const q = String(question || '').toLowerCase();
        if (!q) return false;
        if (/\bage\b|\byears?\b|\bold\b/.test(q)) return false;
        return /how\s*many|number\s*of|count|qty|quantity|frequency|units?|items?|points?|fixtures?|devices?|fans?|lights?|switches?|sockets?|doors?|windows?/.test(q);
    };

    Object.entries(answers || {}).forEach(([question, answer]) => {
        if (!isScopeQuestion(question)) return;
        const match = String(answer || '').match(/\d+(?:\.\d+)?/);
        if (match) pushQty(match[0]);
    });

    const keywordPattern = /(?:quantity|qty|count|frequency|no\.?|nos\.?|units?|pieces?|items?|points?|fixtures?|devices?)\s*(?:is|=|:)?\s*(\d{1,3})/gi;
    let match;
    while ((match = keywordPattern.exec(corpus)) !== null) {
        pushQty(match[1]);
    }

    const nounPattern = /(\d{1,3})\s*(units?|pieces?|items?|points?|fixtures?|devices?|fans?|lights?|switches?|sockets?|doors?|windows?|chairs?|tables?|beds?|wardrobes?)/gi;
    while ((match = nounPattern.exec(corpus)) !== null) {
        pushQty(match[1]);
    }

    return quantities.length ? Math.max(...quantities) : 1;
};

const applyScopeMultiplierToSkillBlocks = (skillBlocks = [], scopeQuantity = 1) => {
    const multiplier = Math.max(1, Number(scopeQuantity) || 1);
    if (multiplier <= 1) return Array.isArray(skillBlocks) ? skillBlocks : [];

    return (Array.isArray(skillBlocks) ? skillBlocks : []).map((block) => {
        const baseHours = Math.max(1, Number(block?.hours) || 1);
        const effectiveUnits = 1 + (multiplier - 1) * 0.8;
        const scaledHours = Math.max(1, Math.round(baseHours * effectiveUnits));
        const baseCount = Math.max(1, Math.round(Number(block?.count) || 1));
        const scaledCount = Math.max(baseCount, Math.min(3, Math.ceil(scaledHours / 8)));
        return {
            ...block,
            count: scaledCount,
            hours: scaledHours,
            quantity: multiplier,
        };
    });
};

const normalizeSkillBlocksForContext = ({ skillBlocks = [], workDescription = '', answers = {} }) => {
    const blocks = Array.isArray(skillBlocks) ? skillBlocks : [];
    const hints = getSkillHintsFromDescription([
        String(workDescription || ''),
        ...Object.entries(answers || {}).map(([q, a]) => `${q}: ${a}`),
    ].join(' | '));

    const normalized = blocks
        .map((block) => ({
            ...block,
            skill: normalizeSkillKey(block?.skill),
        }))
        .filter((block) => block.skill && SKILL_IDENTIFIERS.has(block.skill));

    if (!normalized.length) {
        return hints.slice(0, 4).map((skill) => ({
            skill,
            count: 1,
            hours: 3,
            complexity: 'normal',
            description: `Detected ${titleCase(skill)} work from job context.`,
        }));
    }

    if (normalized.length === 1 && normalized[0].skill === 'handyman') {
        const specificHints = hints.filter((skill) => skill !== 'handyman');
        if (specificHints.length) {
            const baseHours = Math.max(3, Number(normalized[0]?.hours) || 8);
            const perSkillHours = Math.max(2, Math.round(baseHours / Math.min(3, specificHints.length)));
            return specificHints.slice(0, 4).map((skill) => ({
                ...normalized[0],
                skill,
                count: Math.max(1, Number(normalized[0]?.count) || 1),
                hours: perSkillHours,
                description: `Detected ${titleCase(skill)} work from job context and answers.`,
            }));
        }
    }

    const desc = String(workDescription || '').toLowerCase();
    const isBathroomRenovation = /bathroom|toilet|washroom/.test(desc) && /renovat|remodel|leak|seepage|waterproof|tile/.test(desc);

    if (isBathroomRenovation) {
        const bySkill = new Map(normalized.map((b) => [b.skill, b]));
        // Bathroom renovation: plumber, waterproofing, mason, tiler (removed carpenter - not needed)
        ['plumber', 'waterproofing', 'mason', 'tiler'].forEach((skill) => {
            if (!bySkill.has(skill) && hints.includes(skill)) {
                bySkill.set(skill, {
                    skill,
                    count: 1,
                    hours: 3,
                    complexity: 'normal',
                    description: `Detected ${titleCase(skill)} work from bathroom renovation context.`,
                });
            }
        });
        return [...bySkill.values()];
    }

    // If model detected too few skills but context clearly indicates multi-trade work,
    // merge missing hint-based skills instead of dropping them.
    const normalizedSkillSet = new Set(normalized.map((b) => b.skill));
    const missingHints = hints.filter((skill) => skill !== 'handyman' && !normalizedSkillSet.has(skill));
    const looksMultiTrade = /\b(and|with|plus|along with|&|multi|combined|renovat|remodel|fittings?)\b/.test(desc) || hints.filter((s) => s !== 'handyman').length >= 2;
    if (looksMultiTrade && missingHints.length) {
        const merged = [...normalized];
        missingHints.slice(0, 4).forEach((skill) => {
            merged.push({
                skill,
                count: 1,
                hours: 3,
                complexity: 'normal',
                description: `Detected ${titleCase(skill)} work from job context and answers.`,
            });
        });
        return merged;
    }

    return normalized;
};

const parseItemQty = (item = {}) => {
    const fromQuantity = String(item?.quantity || '').match(/\d+(?:\.\d+)?/);
    const fromName = String(item?.item || '').match(/\d+(?:\.\d+)?/);
    const q = Number(fromQuantity?.[0] || fromName?.[0] || 1);
    return Number.isFinite(q) && q > 0 ? q : 1;
};

const classifyFurnitureComponent = (name = '') => {
    const n = String(name || '').toLowerCase();
    if (/modular\s*kitchen|kitchen\s*unit|kitchen\s*cabinet|kitchen\s*setup/.test(n)) return 'modular_kitchen';
    if (/wardrobe|almirah|closet/.test(n)) return 'wardrobe';
    if (/bed|cot|queen|king/.test(n)) return 'bed';
    if (/sofa|couch|sectional/.test(n)) return 'sofa';
    if (/dining\s*table|dining\s*set/.test(n)) return 'dining';
    if (/tv\s*unit|entertainment\s*unit/.test(n)) return 'tv_unit';
    if (/study\s*table|work\s*desk/.test(n)) return 'study_table';
    if (/shoe\s*rack/.test(n)) return 'shoe_rack';
    return null;
};

const FURNITURE_COMPONENT_BASE = {
    bed: 18000,
    sofa: 35000,
    dining: 22000,
    wardrobe: 25000,
    tv_unit: 12000,
    modular_kitchen: 55000,
    study_table: 9000,
    shoe_rack: 5000,
};

const isFullHomeFurnitureProject = ({ workDescription = '', skillBlocks = [] }) => {
    const desc = String(workDescription || '').toLowerCase();
    const skillKeys = [...new Set((Array.isArray(skillBlocks) ? skillBlocks : []).map((b) => normalizeSkillKey(b?.skill)).filter(Boolean))];
    const furnitureIntent = /furniture|furnishing|setup|full\s*home|complete\s*home|interior\s*setup/.test(desc);
    const homeScale = /2\s*bhk|3\s*bhk|flat|apartment|entire\s*home|whole\s*house/.test(desc);
    return skillKeys.includes('carpenter') && furnitureIntent && homeScale;
};

const normalizeFurnitureMaterials = ({ materials = [], workDescription = '', city = '', locality = '', isFullProject = false }) => {
    const cityMult = normalizeFurnitureCityMult(city);
    const localityMult = String(locality || '').trim() ? 1.03 : 1;
    const adjusted = [];
    const seenTypes = new Set();

    for (const item of (Array.isArray(materials) ? materials : [])) {
        const type = classifyFurnitureComponent(item?.item || '');
        if (!type) {
            adjusted.push(item);
            continue;
        }
        seenTypes.add(type);
        const qty = parseItemQty(item);
        const base = FURNITURE_COMPONENT_BASE[type] || 0;
        const realistic = Math.round(base * qty * cityMult * localityMult);
        const current = Number(item?.estimatedCost) || 0;
        const finalCost = current > realistic * 0.9 ? current : realistic;

        adjusted.push({
            ...item,
            estimatedCost: finalCost,
            bestCaseCost: Math.round(finalCost * 0.85),
            worstCaseCost: Math.round(finalCost * 1.25),
            quantity: item?.quantity || `${qty} unit${qty > 1 ? 's' : ''}`,
            optional: false,
            priceSource: 'furniture_project_rate_2026',
            note: item?.note || 'Adjusted with project-scale furniture pricing for local market realism.',
        });
    }

    if (isFullProject) {
        const desc = String(workDescription || '').toLowerCase();
        const bedroomMatch = desc.match(/(\d+)\s*bhk/);
        const bhkCount = Number(bedroomMatch?.[1] || 2);
        const mandatory = [
            { type: 'bed', label: 'Wooden Bed Frame (Queen Size)', qty: Math.max(1, bhkCount) },
            { type: 'wardrobe', label: 'Wardrobe', qty: Math.max(1, bhkCount) },
            { type: 'sofa', label: 'Sofa Set (3-seater + 1-seater)', qty: 1 },
            { type: 'dining', label: 'Dining Table Set (6-seater)', qty: 1 },
            { type: 'tv_unit', label: 'TV Unit', qty: 1 },
            { type: 'modular_kitchen', label: 'Modular Kitchen Setup', qty: 1 },
        ];

        mandatory.forEach((component) => {
            if (seenTypes.has(component.type)) return;
            const base = FURNITURE_COMPONENT_BASE[component.type] || 0;
            const cost = Math.round(base * component.qty * cityMult * localityMult);
            adjusted.push({
                item: component.label,
                quantity: `${component.qty} unit${component.qty > 1 ? 's' : ''}`,
                estimatedCost: cost,
                bestCaseCost: Math.round(cost * 0.85),
                worstCaseCost: Math.round(cost * 1.25),
                optional: false,
                priceSource: 'furniture_project_rate_2026',
                note: 'Added as mandatory component for full-home furnishing scope.',
            });
        });
    }

    return adjusted;
};

const getDependencyOrderedSkills = ({ skillBlocks = [], workDescription = '' }) => {
    const desc = String(workDescription || '').toLowerCase();
    const skills = [...new Set((Array.isArray(skillBlocks) ? skillBlocks : [])
        .map((b) => normalizeSkillKey(b?.skill))
        .filter(Boolean))];

    const isBathroomRenovation = /bathroom|toilet|washroom/.test(desc) && /renovat|remodel|leak|seepage|waterproof|tile|fixture/.test(desc);
    const preferred = isBathroomRenovation
        ? ['plumber', 'waterproofing', 'mason', 'tiler', 'electrician', 'carpenter']
        : ['plumber', 'mason', 'waterproofing', 'tiler', 'electrician', 'carpenter', 'painter', 'welder', 'ac_technician', 'pest_control', 'deep_cleaning', 'handyman', 'gardener'];

    const ordered = preferred.filter((skill) => skills.includes(skill));
    const leftovers = skills.filter((skill) => !ordered.includes(skill));
    return [...ordered, ...leftovers];
};

const buildDependencyAwarePhases = ({ skillBlocks = [], workDescription = '', fallbackHours = 1 }) => {
    const blocks = Array.isArray(skillBlocks) ? skillBlocks : [];
    if (!blocks.length) {
        return [{ phase: 'Execution', hours: Math.max(1, Number(fallbackHours) || 1), description: 'Estimated execution phase.' }];
    }

    const orderedSkills = getDependencyOrderedSkills({ skillBlocks: blocks, workDescription });
    const hourBySkill = new Map();
    blocks.forEach((b) => {
        const skill = normalizeSkillKey(b?.skill);
        if (!skill) return;
        hourBySkill.set(skill, (hourBySkill.get(skill) || 0) + Math.max(0.5, Number(b?.hours) || 0));
    });

    const labelBySkill = {
        plumber: 'Plumbing Repairs',
        waterproofing: 'Waterproofing',
        mason: 'Masonry & Civil Repairs',
        tiler: 'Tiling and Grouting',
        electrician: 'Electrical Repairs',
        carpenter: 'Carpentry and Fittings',
        painter: 'Surface Finishing / Painting',
        welder: 'Welding / Fabrication',
        ac_technician: 'AC Service / Repair',
        pest_control: 'Pest Control Treatment',
        deep_cleaning: 'Deep Cleaning',
        handyman: 'General Repair Work',
        gardener: 'Gardening Work',
    };

    const descBySkill = {
        plumber: 'Resolve leakage and complete plumbing line/fitting fixes.',
        waterproofing: 'Apply sealing/waterproofing and allow curing/setting preparation before next finishing layers.',
        mason: 'Carry out civil patching/plaster/base correction before finishing tasks.',
        tiler: 'Install or repair tiles and complete grouting/level finishing.',
        electrician: 'Complete safe electrical fault correction and functional testing.',
    };

    const phases = orderedSkills
        .filter((skill) => hourBySkill.has(skill))
        .map((skill) => ({
            phase: labelBySkill[skill] || titleCase(skill),
            hours: Math.max(0.5, Math.round((Number(hourBySkill.get(skill)) || 0) * 10) / 10),
            description: descBySkill[skill] || `Execute ${titleCase(skill)} work as per site condition.`,
        }));

    return phases.length
        ? phases
        : [{ phase: 'Execution', hours: Math.max(1, Number(fallbackHours) || 1), description: 'Estimated execution phase.' }];
};

const toDateKey = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const dayNameFor = (dateObj) => new Intl.DateTimeFormat('en-IN', { weekday: 'long' }).format(dateObj);

const parseTimeToMinutes = (timeStr = '09:00') => {
    const [h, m] = String(timeStr || '09:00').split(':').map((v) => Number(v));
    if (Number.isNaN(h) || Number.isNaN(m)) return 9 * 60;
    return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
};

const formatTimeLabel = (minutes) => {
    const safe = ((Number(minutes) || 0) % (24 * 60) + (24 * 60)) % (24 * 60);
    const h24 = Math.floor(safe / 60);
    const mm = String(safe % 60).padStart(2, '0');
    const suffix = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${mm} ${suffix}`;
};

const formatTime24 = (minutes) => {
    const safe = ((Number(minutes) || 0) % (24 * 60) + (24 * 60)) % (24 * 60);
    const h24 = String(Math.floor(safe / 60)).padStart(2, '0');
    const mm = String(safe % 60).padStart(2, '0');
    return `${h24}:${mm}`;
};

const buildCalendarSchedule = ({ phases = [], jobDate = '', jobStartTime = '09:00' }) => {
    const list = Array.isArray(phases) ? phases : [];
    if (!list.length) {
        return {
            days: [],
            totalProductiveHours: 0,
            totalBreakHours: 0,
            totalCalendarHours: 0,
            endDate: jobDate || '',
            endTime: jobStartTime || '09:00',
            endTimeLabel: formatTimeLabel(parseTimeToMinutes(jobStartTime || '09:00')),
        };
    }

    const DAILY_WORK_HOURS = 8;
    const LUNCH_BREAK_HOURS = 1;
    const HANDOVER_BREAK_HOURS = 1;
    const WORK_WINDOW_START_MINUTES = 6 * 60; // 6:00 AM
    const WORK_WINDOW_END_MINUTES = 21 * 60;  // 9:00 PM
    const NEXT_DAY_RESTART_MINUTES = 9 * 60;  // 9:00 AM

    const startDateObj = jobDate ? new Date(`${jobDate}T00:00:00`) : new Date();
    startDateObj.setHours(0, 0, 0, 0);

    let dateObj = new Date(startDateObj);
    let cursorMinutes = parseTimeToMinutes(jobStartTime || '09:00');
    let productiveToday = 0;
    let lunchTakenToday = false;

    const days = [];
    let totalProductiveHours = 0;
    let totalBreakHours = 0;

    const alignCursorToWindow = (isFirstDay = false) => {
        const minStart = isFirstDay ? WORK_WINDOW_START_MINUTES : NEXT_DAY_RESTART_MINUTES;
        if (cursorMinutes < minStart) cursorMinutes = minStart;
        if (cursorMinutes >= WORK_WINDOW_END_MINUTES) return false;
        return true;
    };

    // Align initial start time to allowed first-day window.
    if (!alignCursorToWindow(true)) {
        dateObj.setDate(dateObj.getDate() + 1);
        cursorMinutes = NEXT_DAY_RESTART_MINUTES;
    }

    const ensureDayBucket = () => {
        const date = toDateKey(dateObj);
        let bucket = days.find((d) => d.date === date);
        if (!bucket) {
            bucket = {
                date,
                dayName: dayNameFor(dateObj),
                startTime: formatTime24(cursorMinutes),
                startTimeLabel: formatTimeLabel(cursorMinutes),
                endTime: formatTime24(cursorMinutes),
                endTimeLabel: formatTimeLabel(cursorMinutes),
                productiveHours: 0,
                breakHours: 0,
                entries: [],
            };
            days.push(bucket);
        }
        return bucket;
    };

    const addEntry = ({ type, title, description = '', durationHours = 0, phaseIndex = -1 }) => {
        const durationMinutes = Math.max(0, Math.round((Number(durationHours) || 0) * 60));
        if (!durationMinutes) return;

        const start = cursorMinutes;
        const end = cursorMinutes + durationMinutes;
        const bucket = ensureDayBucket();

        bucket.entries.push({
            type,
            title,
            description,
            phaseIndex,
            date: bucket.date,
            dayName: bucket.dayName,
            startTime: formatTime24(start),
            endTime: formatTime24(end),
            startTimeLabel: formatTimeLabel(start),
            endTimeLabel: formatTimeLabel(end),
            durationHours: Math.round((durationMinutes / 60) * 10) / 10,
        });

        bucket.endTime = formatTime24(end);
        bucket.endTimeLabel = formatTimeLabel(end);

        if (type === 'task') {
            const h = durationMinutes / 60;
            productiveToday += h;
            bucket.productiveHours = Math.round((bucket.productiveHours + h) * 10) / 10;
            totalProductiveHours += h;
        } else {
            const h = durationMinutes / 60;
            bucket.breakHours = Math.round((bucket.breakHours + h) * 10) / 10;
            totalBreakHours += h;
        }

        cursorMinutes = end;
    };

    const moveToNextDay = () => {
        dateObj.setDate(dateObj.getDate() + 1);
        cursorMinutes = NEXT_DAY_RESTART_MINUTES;
        productiveToday = 0;
        lunchTakenToday = false;
    };

    for (let i = 0; i < list.length; i++) {
        const phase = list[i];
        let remaining = Math.max(0, Number(phase?.hours) || 0);

        while (remaining > 0) {
            if (productiveToday >= DAILY_WORK_HOURS || cursorMinutes >= WORK_WINDOW_END_MINUTES) {
                moveToNextDay();
            }

            if (!alignCursorToWindow(false)) {
                moveToNextDay();
                continue;
            }

            const productiveLimitLeft = Math.max(0, DAILY_WORK_HOURS - productiveToday);
            const windowHoursLeft = Math.max(0, (WORK_WINDOW_END_MINUTES - cursorMinutes) / 60);
            const available = Math.max(0, Math.min(productiveLimitLeft, windowHoursLeft));
            if (available <= 0) {
                moveToNextDay();
                continue;
            }

            const chunk = Math.min(remaining, available);
            addEntry({
                type: 'task',
                title: phase?.phase || `Step ${i + 1}`,
                description: phase?.description || '',
                durationHours: chunk,
                phaseIndex: i,
            });

            remaining -= chunk;

            if (remaining > 0 && (productiveToday >= DAILY_WORK_HOURS || cursorMinutes >= WORK_WINDOW_END_MINUTES)) {
                moveToNextDay();
            }
        }

        const isLastPhase = i === list.length - 1;
        if (!isLastPhase && productiveToday < DAILY_WORK_HOURS && cursorMinutes < WORK_WINDOW_END_MINUTES) {
            if (!lunchTakenToday && (cursorMinutes + (LUNCH_BREAK_HOURS * 60)) <= WORK_WINDOW_END_MINUTES) {
                addEntry({
                    type: 'break',
                    title: 'Lunch Break',
                    description: 'Lunch/rest break before next task.',
                    durationHours: LUNCH_BREAK_HOURS,
                    phaseIndex: i,
                });
                lunchTakenToday = true;
            }

            if ((cursorMinutes + (HANDOVER_BREAK_HOURS * 60)) <= WORK_WINDOW_END_MINUTES) {
                addEntry({
                    type: 'break',
                    title: 'Handover Break',
                    description: 'Trade handover and setup for next task.',
                    durationHours: HANDOVER_BREAK_HOURS,
                    phaseIndex: i,
                });
            }
        }
    }

    const endDay = days[days.length - 1] || null;
    return {
        days,
        totalProductiveHours: Math.round(totalProductiveHours * 10) / 10,
        totalBreakHours: Math.round(totalBreakHours * 10) / 10,
        totalCalendarHours: Math.round((totalProductiveHours + totalBreakHours) * 10) / 10,
        endDate: endDay?.date || toDateKey(startDateObj),
        endDayName: endDay?.dayName || dayNameFor(startDateObj),
        endTime: endDay?.endTime || formatTime24(parseTimeToMinutes(jobStartTime || '09:00')),
        endTimeLabel: endDay?.endTimeLabel || formatTimeLabel(parseTimeToMinutes(jobStartTime || '09:00')),
    };
};

const buildDependencyAwareWorkPlan = ({ phases = [], existingWorkPlan = [], schedule = null }) => {
    if ((!Array.isArray(phases) || !phases.length) && Array.isArray(existingWorkPlan)) return existingWorkPlan;

    return (Array.isArray(phases) ? phases : []).map((phase, idx) => {
        const windows = (schedule?.days || []).flatMap((day) =>
            (day.entries || [])
                .filter((entry) => entry.type === 'task' && entry.phaseIndex === idx)
                .map((entry) => ({
                    date: entry.date,
                    dayName: entry.dayName,
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    startTimeLabel: entry.startTimeLabel,
                    endTimeLabel: entry.endTimeLabel,
                    durationHours: entry.durationHours,
                }))
        );

        return {
            step: idx + 1,
            title: phase.phase,
            description: phase.description,
            estimatedTime: `${Math.max(0.5, Number(phase.hours) || 1)} hours`,
            scheduleWindows: windows,
        };
    });
};

const reconcileTimeline = ({ aiTimeEstimate = {}, aiDurationDays = 1, budgetResult = {}, isFullFurnitureProject = false, skillBlocks = [], workDescription = '', jobDate = '', jobStartTime = '09:00' }) => {
    const workers = Math.max(1, Number(budgetResult.totalWorkers) || 1);
    const budgetHours = Math.max(0, Number(budgetResult.totalHours) || 0);
    const labourDays = Math.max(1, Math.ceil(Math.max(1, budgetHours) / (workers * 8)));
    const aiHours = Number(aiTimeEstimate?.totalHours) || 0;
    const aiPhaseHours = Array.isArray(aiTimeEstimate?.phases)
        ? aiTimeEstimate.phases.reduce((sum, phase) => sum + (Number(phase?.hours) || 0), 0)
        : 0;
    const baseHours = Math.max(1, budgetHours, aiHours, aiPhaseHours);
    let phases = buildDependencyAwarePhases({
        skillBlocks,
        workDescription,
        fallbackHours: baseHours,
    });

    const phaseHours = phases.reduce((sum, phase) => sum + (Number(phase?.hours) || 0), 0);
    const schedule = buildCalendarSchedule({ phases, jobDate, jobStartTime });
    const totalHours = Math.max(1, phaseHours);
    const scheduleDays = Math.max(1, schedule.days.length || Math.ceil(totalHours / 8));
    const baseDays = Math.max(labourDays, Number(aiDurationDays) || 1, scheduleDays);
    const finalDays = isFullFurnitureProject ? Math.max(baseDays, 5) : baseDays;

    return {
        totalDays: finalDays,
        totalHours: Math.round(totalHours * 10) / 10,
        totalBreakHours: schedule.totalBreakHours,
        totalCalendarHours: schedule.totalCalendarHours,
        phases,
        schedule,
        scheduling: {
            workWindow: '06:00 to 21:00',
            nextDayStartTime: '09:00',
            workHoursPerDay: 8,
            lunchBreakHoursPerDay: 1,
            handoverBreakHours: 1,
            effectiveProductiveHoursPerDay: 8,
        },
    };
};

const buildCostSavingSuggestions = ({
    signals = {},
    skillBlocks = [],
    workDescription = '',
    includeMaterials = true,
    includeEquipment = true,
    includeTravelCost = false,
    ownedMaterialList = [],
    ownedEquipmentList = [],
    marketInsight = {},
    city = '',
}) => {
    const suggestions = [];
    const skillKeys = [...new Set((Array.isArray(skillBlocks) ? skillBlocks : [])
        .map((block) => normalizeSkillKey(block?.skill))
        .filter(Boolean))];
    const desc = String(workDescription || '').toLowerCase();
    const isEmergencyJob = /emergency|urgent|immediate|today|asap/.test(desc);

    const pushUnique = (value = '') => {
        const text = String(value || '').trim();
        if (!text) return;
        if (!suggestions.includes(text)) suggestions.push(text);
    };

    if (signals.hasCracks) {
        pushUnique('Fix cracks and patching in one consolidated prep cycle before finishing; repeated rework increases labour and material waste.');
    }

    if (signals.hasGoodSurface) {
        pushUnique('Surface is already in good condition, so ask workers to reduce prep scope and avoid unnecessary consumables.');
    }

    if (ownedMaterialList.length > 0) {
        pushUnique('Reuse your available materials first and buy only missing quantities to avoid duplicate purchases.');
    }

    if (ownedEquipmentList.length > 0) {
        pushUnique('Use your available tools/equipment where possible to reduce rental or consumable-tool charges.');
    }

    if (marketInsight.avgDemandRatio > 1.15) {
        pushUnique(`Demand is high in ${city || 'your area'}; if timeline is flexible, schedule during lower-demand slots for better rates.`);
    } else if (marketInsight.avgDemandRatio < 0.9) {
        pushUnique('Current worker availability is better than usual; negotiate package pricing for labour and service visits.');
    }

    if (includeMaterials || includeEquipment) {
        pushUnique('Group related tasks into one visit so setup, transport, and minimum-visit charges are spread across more work.');
    }

    if (signals.areaSqft > 0 && signals.areaSqft <= 250) {
        pushUnique('For small scope jobs, prefer measured quantities instead of full packs unless future use is planned.');
    }

    if (includeTravelCost) {
        pushUnique('Travel cost is enabled; combining multiple nearby issues in one appointment improves travel-cost efficiency.');
    }

    if (isEmergencyJob) {
        pushUnique('Urgent jobs usually carry a premium; if safe, shifting by even one slot/day can reduce labour surcharge.');
    }

    const skillSuggestionMap = {
        plumber: 'For plumbing, replace only failed fittings first and defer full-line replacement unless pressure/leak tests justify it.',
        electrician: 'For electrical work, batch switch/socket/point replacements in one visit to reduce repeated service call charges.',
        painter: 'For painting, prioritize required prep zones only and finalize shade/finish early to avoid repaint rework cost.',
        tiler: 'For tiling, confirm exact tile size and layout upfront so cutting wastage and adhesive usage stay controlled.',
        carpenter: 'For carpentry, prefer repair and hardware replacement for salvageable units instead of full rebuild.',
        mason: 'For masonry, consolidate patch and plaster areas before finishing to reduce repeated scaffold/setup effort.',
        ac_technician: 'For AC service, run leak and pressure checks before gas refill to avoid repeated refrigerant cost.',
        pest_control: 'For pest control, select targeted treatment zones first and scale only if follow-up inspection requires it.',
        cleaner: 'For deep cleaning, split essential vs optional areas so high-effort zones are prioritized within budget.',
        handyman: 'For handyman work, combine small tasks in one booking to maximize value from minimum-visit labour.',
        gardener: 'For gardening, schedule pruning and maintenance together to minimize repeat travel/service charges.',
        welder: 'For welding, aggregate all fabrication/repair points in a single material run to reduce setup overhead.',
    };

    skillKeys.forEach((skill) => {
        if (skillSuggestionMap[skill]) pushUnique(skillSuggestionMap[skill]);
    });

    if (!suggestions.length) {
        pushUnique('Share exact quantity/scope details to prevent padded estimates and keep the quote tightly aligned to required work.');
    }

    return suggestions.slice(0, 6);
};

const buildScenarioNarratives = ({
    workDescription = '',
    skillBlocks = [],
    signals = {},
    includeMaterials = true,
    includeEquipment = true,
    marketInsight = {},
}) => {
    const skills = [...new Set((Array.isArray(skillBlocks) ? skillBlocks : []).map((b) => normalizeSkillKey(b?.skill)).filter(Boolean))];
    const primarySkill = skills[0] || 'handyman';
    const jobLabel = titleCase(primarySkill);
    const areaText = Number(signals.areaSqft) > 0 ? `${Math.round(Number(signals.areaSqft))} sqft scope` : 'confirmed scope';
    const materialMode = includeMaterials ? 'material rates stay stable' : 'material cost excluded';
    const equipmentMode = includeEquipment ? 'equipment needs stay standard' : 'equipment cost excluded';
    const demandText = Number(marketInsight.avgDemandRatio) > 1.15
        ? 'high local demand'
        : Number(marketInsight.avgDemandRatio) < 0.9
            ? 'good worker availability'
            : 'normal market demand';
    const best = `${jobLabel} work with smooth execution (${areaText}), no extra rework, ${materialMode}, and ${equipmentMode}.`;
    const expected = `${jobLabel} quote under typical on-site conditions in ${demandText}, with standard productivity and routine variation.`;
    const worst = `${jobLabel} quote if hidden issues or rework appear during execution, requiring extra time/visits and additional consumables.`;

    return { best, expected, worst };
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

const getRateSummaryByCity = async (cityKey = '') => {
    if (!cityKey) return null;
    const normalizedCity = String(cityKey || '').trim().toLowerCase();
    if (!normalizedCity) return null;

    const rows = await BaseRate.find({ isActive: true, cityKey: normalizedCity }).lean();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    const values = {
        hours: [],
        days: [],
        visits: [],
    };

    for (const row of rows) {
        const nested = row.rates || {};
        const hourlyCandidates = [nested.hourly, nested.hour, row.platformHourlyMin, row.platformHourlyMax, row.localHourlyMin, row.localHourlyMax]
            .filter((value) => Number.isFinite(Number(value)) && Number(value) > 0)
            .map(Number);
        if (hourlyCandidates.length) {
            values.hours.push(hourlyCandidates.reduce((sum, value) => sum + value, 0) / hourlyCandidates.length);
        }

        const dailyCandidates = [row.platformDayMin, row.platformDayMax, row.localDayMin, row.localDayMax]
            .filter((value) => Number.isFinite(Number(value)) && Number(value) > 0)
            .map(Number);
        if (dailyCandidates.length) {
            values.days.push(dailyCandidates.reduce((sum, value) => sum + value, 0) / dailyCandidates.length);
        }

        const visitCandidates = [];
        if (Number.isFinite(nested.visit) && nested.visit > 0) visitCandidates.push(Number(nested.visit));
        if (Number.isFinite(row.platformCostMin) && row.platformCostMin > 0) visitCandidates.push(Number(row.platformCostMin));
        if (Number.isFinite(row.platformCostMax) && row.platformCostMax > 0) visitCandidates.push(Number(row.platformCostMax));
        if (Number.isFinite(row.localDayMin) && row.localDayMin > 0) visitCandidates.push(Number(row.localDayMin));
        if (Number.isFinite(row.localDayMax) && row.localDayMax > 0) visitCandidates.push(Number(row.localDayMax));
        if (visitCandidates.length) {
            values.visits.push(visitCandidates.reduce((sum, value) => sum + value, 0) / visitCandidates.length);
        }
    }

    const average = (list) => {
        if (!list.length) return 0;
        return Math.round(list.reduce((sum, value) => sum + value, 0) / list.length);
    };

    const skills = new Set(rows.map((row) => normalizeText(row.skillKey || row.skill || '')).filter(Boolean));

    return {
        city: titleCase(rows[0].city || rows[0].cityKey || cityKey),
        cityKey: normalizedCity,
        averageHourlyRate: average(values.hours),
        averageDailyRate: average(values.days),
        averageVisitRate: average(values.visits) || average(values.days),
        skillCount: skills.size,
        source: 'baseRate',
    };
};

const MIN_WORK_QUESTIONS = 6;

const ensureQuestionShape = (q, index) => ({
    id: q?.id || `q${index + 1}`,
    question: String(q?.question || '').trim(),
    type: ['select', 'number', 'text'].includes(q?.type) ? q.type : 'text',
    options: Array.isArray(q?.options) ? q.options.filter(Boolean).map((opt) => String(opt).trim()) : [],
    required: true,
});

const ensureSelectHasNA = (options = []) => {
    const normalized = Array.isArray(options)
        ? options.map((opt) => String(opt || '').trim()).filter(Boolean)
        : [];
    if (!normalized.some((opt) => opt.toLowerCase() === 'n/a')) normalized.push('N/A');
    return [...new Set(normalized)];
};

const getSelectOptionsForQuestion = (question = '') => {
    const q = String(question || '').toLowerCase();

    if (/(urgent|urgency|immediate|asap)/.test(q)) {
        return ['Yes', 'No', 'Not sure', 'N/A'];
    }
    if (/(timeline|completion|complete|deadline|days?|hours?)/.test(q)) {
        return ['Same day', '1-2 days', '3-5 days', '6-10 days', 'Flexible', 'Not sure', 'N/A'];
    }
    if (/(workers?|labourers?|people|persons?)/.test(q)) {
        return ['1', '2', '3', '4', '5+', 'Not sure', 'N/A'];
    }
    if (/(area|sq\s*ft|sqft|square feet|coverage|surface|wall|floor|ceiling)/.test(q)) {
        return ['Under 100 sq ft', '100-250 sq ft', '250-500 sq ft', '500+ sq ft', 'Not sure', 'N/A'];
    }
    if (/(length|pipe|wire|cable|meters?|metres?|feet|distance)/.test(q)) {
        return ['Under 5', '5-10', '10-20', '20+', 'Not sure', 'N/A'];
    }
    if (/(fixtures?|points?|units?|items?|quantity|count|how many)/.test(q)) {
        return ['1', '2-3', '4-6', '7+', 'Not sure', 'N/A'];
    }
    if (/(condition|damage|cracks?|leak|damp|site condition)/.test(q)) {
        return ['Good', 'Minor issue', 'Major issue', 'Not sure', 'N/A'];
    }
    if (/(access|parking|stairs?|permission|constraints?)/.test(q)) {
        return ['No constraints', 'Minor constraints', 'Major constraints', 'Not sure', 'N/A'];
    }
    return [];
};

const enforceQuestionTypeMix = (questions = []) => {
    const source = (Array.isArray(questions) ? questions : [])
        .map((q, idx) => ensureQuestionShape(q, idx))
        .filter((q) => q.question);

    if (!source.length) return source;

    const MAX_NUMBER_QUESTIONS = 2;
    const MIN_SELECT_QUESTIONS = 2;
    const MIN_TEXT_QUESTIONS = 2;

    let numberCount = 0;
    const normalized = source.map((q) => {
        const next = { ...q };

        if (next.type === 'number') {
            numberCount += 1;
            if (numberCount > MAX_NUMBER_QUESTIONS) {
                const selectOptions = getSelectOptionsForQuestion(next.question);
                if (selectOptions.length) {
                    next.type = 'select';
                    next.options = ensureSelectHasNA(selectOptions);
                } else {
                    next.type = 'text';
                    next.options = [];
                }
            }
        }

        if (next.type === 'select') {
            const inferred = getSelectOptionsForQuestion(next.question);
            next.options = ensureSelectHasNA(next.options.length ? next.options : inferred);
        }

        return next;
    });

    const countByType = () => ({
        select: normalized.filter((q) => q.type === 'select').length,
        text: normalized.filter((q) => q.type === 'text').length,
    });

    // Ensure minimum select questions.
    let { select, text } = countByType();
    if (select < MIN_SELECT_QUESTIONS) {
        for (let i = 0; i < normalized.length && select < MIN_SELECT_QUESTIONS; i++) {
            const q = normalized[i];
            if (q.type !== 'text') continue;
            const options = getSelectOptionsForQuestion(q.question);
            if (!options.length) continue;
            q.type = 'select';
            q.options = ensureSelectHasNA(options);
            select += 1;
            text = Math.max(0, text - 1);
        }
    }

    // Ensure minimum text questions.
    ({ select, text } = countByType());
    if (text < MIN_TEXT_QUESTIONS) {
        for (let i = normalized.length - 1; i >= 0 && text < MIN_TEXT_QUESTIONS; i--) {
            const q = normalized[i];
            if (q.type === 'text') continue;
            const wasSelect = q.type === 'select';
            q.type = 'text';
            q.options = [];
            text += 1;
            if (select > 0 && wasSelect) select -= 1;
        }
    }

    return normalized;
};

const addUnitHintToQuestion = (question = '', type = 'text') => {
    const raw = String(question || '').trim();
    if (!raw) return raw;

    const normalized = normalizeText(raw);
    const hints = [];

    const hasHint = (value) => raw.toLowerCase().includes(value.toLowerCase());
    const appendHint = (hint) => {
        if (hint && !hints.includes(hint)) hints.push(hint);
    };

    if (/(area|surface|size|coverage|wall|floor|ceiling|painted|tiling|plaster|sanding|sheet|sq\s*ft|sqft|square feet|sq\s*m|sqm|square meters?)/i.test(normalized)) {
        appendHint('sq ft');
    }
    if (/(length|breadth|width|depth|height|distance|run|pipe|wire|cable|grill|rod|frame|beam|meter|metre|foot|feet|inch|inches)/i.test(normalized)) {
        appendHint('feet or meters');
    }
    if (/(how many|number of|count|qty|quantity|units?|items?|points?|fixtures?|devices?|switches?|sockets?|lights?|doors?|windows?|chairs?|tables?|beds?|wardrobes?)/i.test(normalized)) {
        appendHint('units/items');
    }
    if (/(hours?|time|duration|days?|timeline|deadline|completion)/i.test(normalized)) {
        appendHint('hours or days');
    }
    if (/(workers?|labourers?|people|persons?)/i.test(normalized)) {
        appendHint('workers');
    }
    if (/(temperature|pressure|capacity|tonnage|size of ac|ac type)/i.test(normalized)) {
        appendHint('tons, litres, or capacity');
    }

    if (!hints.length) return raw;

    const suffix = `(${hints.join(', ')})`;
    if (hasHint(suffix) || hasHint('in ') && (hasHint('sq ft') || hasHint('units/items') || hasHint('hours or days'))) {
        return raw;
    }

    if (/[?!.]$/.test(raw)) {
        return `${raw.slice(0, -1)} ${suffix}${raw.slice(-1)}`;
    }
    return `${raw} ${suffix}`;
};

const applyQuestionUnitHints = (questions = []) => (Array.isArray(questions) ? questions : []).map((q) => ({
    ...q,
    question: addUnitHintToQuestion(q?.question, q?.type),
}));

const getSkillHintsFromDescription = (workDescription = '') => {
    const d = normalizeText(workDescription);
    const hints = [];
    const push = (skill) => { if (!hints.includes(skill)) hints.push(skill); };

    if (/leak|pipe|tap|drain|toilet|washbasin|sewer|plumb/.test(d)) push('plumber');
    if (/switch|socket|wiring|mcb|fuse|light|fan|electri/.test(d)) push('electrician');
    if (/wardrobe|bed|cabinet|furniture|wood|carpent/.test(d)) push('carpenter');
    if (/paint|putty|primer|wall\s*finish|emulsion/.test(d)) push('painter');
    if (/tile|grout|marble|floor\s*tile|bathroom\s*tile/.test(d)) push('tiler');
    if (/plaster|brick|cement|wall\s*repair|mason/.test(d)) push('mason');
    if (/weld|grill|gate|fabricat|iron\s*work/.test(d)) push('welder');
    if (/ac\b|air\s*condition|cooling|compressor/.test(d)) push('ac_technician');
    if (/pest|termite|cockroach|rodent|fumigat/.test(d)) push('pest_control');
    if (/deep\s*clean|cleaning|sanitize|housekeeping/.test(d)) push('deep_cleaning');
    if (/garden|lawn|plant|pruning|landscap/.test(d)) push('gardener');
    if (/waterproof|seepage|damp|moisture\s*ingress|water\s*proof/.test(d)) push('waterproofing');

    const bathroomMentioned = /bathroom|toilet|washroom/.test(d);
    const renovationIntent = /renovat|remodel|full\s*work|complete\s*work|rebuild|retile|new\s*installation/.test(d);
    const leakRepairIntent = /\bleak|leakage|drip|seepage|fix|repair|minor\b/.test(d);

    if (bathroomMentioned && (renovationIntent || /tile|plumb|electri/.test(d))) {
        push('plumber');
        if (renovationIntent || /tile|retile|new\s*tile/.test(d)) push('tiler');
        if (renovationIntent || /waterproof|seepage|damp/.test(d)) push('waterproofing');
        if (renovationIntent || /plaster|civil|brick|cement/.test(d)) push('mason');
        if (/switch|wire|light|exhaust|electri/.test(d)) push('electrician');

        // For quick bathroom leak repair, avoid forcing non-essential civil trades.
        if (leakRepairIntent && !renovationIntent) {
            return ['plumber', ...(hints.includes('electrician') ? ['electrician'] : []), ...(hints.includes('waterproofing') ? ['waterproofing'] : [])];
        }
    }

    if (!hints.length) push('handyman');
    return hints;
};

const ESTIMATE_ALLOWED_SKILLS = new Set([
    'plumber', 'electrician', 'carpenter', 'painter', 'tiler', 'mason', 'welder',
    'ac_technician', 'pest_control', 'cleaner', 'handyman', 'gardener',
    'waterproofing', 'deep_cleaning', 'other',
]);

const normalizeSkillList = (items = []) => (Array.isArray(items) ? items : [])
    .map((item) => normalizeSkillKey(item))
    .filter((skill) => skill && ESTIMATE_ALLOWED_SKILLS.has(skill));

const distributeTotalWorkers = (skillBlocks = [], totalWorkers = 0) => {
    const blocks = Array.isArray(skillBlocks) ? [...skillBlocks] : [];
    const target = Math.max(1, Number(totalWorkers) || 0);
    if (!blocks.length || !target) return blocks;

    const currentTotal = blocks.reduce((sum, block) => sum + Math.max(1, Number(block?.count) || 1), 0);
    if (!currentTotal) {
        blocks[0].count = target;
        return blocks;
    }

    const counts = blocks.map((block) => Math.max(1, Math.floor((Math.max(1, Number(block?.count) || 1) / currentTotal) * target)));
    let assigned = counts.reduce((sum, n) => sum + n, 0);
    if (assigned !== target) {
        const idx = counts.reduce((maxIdx, value, i) => value > counts[maxIdx] ? i : maxIdx, 0);
        counts[idx] = Math.max(1, counts[idx] + (target - assigned));
    }

    return blocks.map((block, idx) => ({ ...block, count: counts[idx] }));
};

const applySkillConstraintsToBlocks = ({ skillBlocks = [], selectedSkills = [], removedSkills = [], strictSkillMode = false }) => {
    const normalizedSelected = normalizeSkillList(selectedSkills);
    const removedSet = new Set(normalizeSkillList(removedSkills));
    let blocks = Array.isArray(skillBlocks) ? [...skillBlocks] : [];

    if (normalizedSelected.length > 0) {
        const selectedSet = new Set(normalizedSelected);
        blocks = blocks.filter((block) => selectedSet.has(normalizeSkillKey(block?.skill)) && !removedSet.has(normalizeSkillKey(block?.skill)));

        normalizedSelected.forEach((skill) => {
            const exists = blocks.some((block) => normalizeSkillKey(block?.skill) === skill);
            if (!exists) {
                blocks.push({
                    skill,
                    count: 1,
                    hours: 3,
                    complexity: 'normal',
                    description: `Client selected ${titleCase(skill)} for this job.`,
                });
            }
        });
    } else if (removedSet.size > 0) {
        blocks = blocks.filter((block) => !removedSet.has(normalizeSkillKey(block?.skill)));
    }

    if (strictSkillMode && normalizedSelected.length > 0) {
        const selectedSet = new Set(normalizedSelected);
        blocks = blocks.filter((block) => selectedSet.has(normalizeSkillKey(block?.skill)));
    }

    return blocks;
};

const toSafeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const roundToNearestTenLocal = (value) => Math.round((Number(value) || 0) / 10) * 10;

const normalizeRateInputMode = (mode = '', fallback = 'day') => {
    const normalized = String(mode || '').trim().toLowerCase();
    if (['day', 'visit', 'hour'].includes(normalized)) return normalized;
    return fallback;
};

const detectEstimateJobWeight = ({ workDescription = '', answers = {}, scopeQuantity = 1 }) => {
    const corpus = [
        String(workDescription || ''),
        ...Object.entries(answers || {}).map(([q, a]) => `${q}: ${a}`),
    ].join(' | ').toLowerCase();

    const tinyElectrical = /board|switch|socket|point|mcb|fuse|holder|bulb|light\s*point/.test(corpus)
        && /(one|single|1\s*(?:point|board|switch|socket|unit)?)/.test(corpus);
    if (tinyElectrical) return 'tiny';

    const quickRepair = /\bfix|repair|minor|small|replace|single\b/.test(corpus)
        && !/renovat|remodel|full|complete|new\s*installation|civil|tile|waterproof/.test(corpus);

    const qty = Math.max(1, Number(scopeQuantity) || 1);
    if (quickRepair && qty <= 2) return 'small';
    if (qty <= 6) return 'medium';
    return 'large';
};

const applyAutoDetectedWorkerCaps = ({ skillBlocks = [], workDescription = '', answers = {}, scopeQuantity = 1, profileType = 'general' }) => {
    const blocks = Array.isArray(skillBlocks) ? skillBlocks : [];
    if (!blocks.length) return [];

    const weight = detectEstimateJobWeight({ workDescription, answers, scopeQuantity });
    const maxPerSkill = weight === 'tiny' ? 1 : weight === 'small' ? 2 : 3;
    const maxHoursPerSkill = weight === 'tiny' ? 4 : weight === 'small' ? 6 : 12;

    return blocks.map((block) => {
        const skill = normalizeSkillKey(block?.skill);
        const rawCount = Math.max(1, Number(block?.count) || 1);
        const rawHours = Math.max(1, Number(block?.hours) || 1);

        // Keep quick repair profiles conservative to avoid unrealistic staffing for short jobs.
        const cappedCount = profileType === 'quick_plumbing_repair'
            ? Math.min(2, rawCount)
            : Math.min(maxPerSkill, rawCount);

        const cappedHours = Math.min(maxHoursPerSkill, rawHours);
        return {
            ...block,
            skill,
            count: Math.max(1, cappedCount),
            hours: Math.max(1, cappedHours),
        };
    });
};

const applyRateAndCountOverridesToBudget = ({ budgetResult = {}, skillWorkerCountOverrides = {}, skillRateOverrides = {}, skillRateOverrideModes = {}, skillDurationOverrides = {}, perWorkerMultiplier = 1 }) => {
    const safeMultiplier = Math.max(0.5, toSafeNumber(perWorkerMultiplier, 1));
    const HOURS_PER_DAY = 8;
    const SMALL_JOB_HOUR_THRESHOLD = 3;

    const breakdown = (Array.isArray(budgetResult?.breakdown) ? budgetResult.breakdown : []).map((item) => {
        const skillKey = normalizeSkillKey(item?.skill);
        const overrideCountRaw = toSafeNumber(skillWorkerCountOverrides?.[skillKey], 0);
        const count = Math.min(6, Math.max(1, overrideCountRaw || toSafeNumber(item?.count, 1)));

        const overrideRate = toSafeNumber(skillRateOverrides?.[skillKey], 0);
        const skillDurationOverrideRaw = skillDurationOverrides?.[skillKey];
        const skillDurationOverrideHours = typeof skillDurationOverrideRaw === 'object'
            ? toSafeNumber(skillDurationOverrideRaw?.hours, 0)
            : toSafeNumber(skillDurationOverrideRaw, 0);
        const hours = Math.max(1,
            Number.isFinite(skillDurationOverrideHours) && skillDurationOverrideHours > 0
                ? Math.round(skillDurationOverrideHours)
                : toSafeNumber(item?.hours, 1),
        );
        const perWorkerHours = Math.max(0.5, hours);
        const perWorkerDays = Math.max(1, Math.ceil(perWorkerHours / HOURS_PER_DAY));
        
        let defaultRateInputMode = 'day';
        if (perWorkerHours < SMALL_JOB_HOUR_THRESHOLD) {
            defaultRateInputMode = 'hour';
        } else if (perWorkerHours <= HOURS_PER_DAY) {
            defaultRateInputMode = 'visit';
        }
        
        const selectedRateInputMode = normalizeRateInputMode(skillRateOverrideModes?.[skillKey], defaultRateInputMode);

        const sourceRatePerDayBase = Math.max(100,
            toSafeNumber(item?.sourceRatePerDayBase, 0) ||
            toSafeNumber(item?.ratePerDayBase, 0) ||
            toSafeNumber(item?.ratePerDay, 0) ||
            1200,
        );
        const sourceRatePerHourBase = Math.max(10,
            toSafeNumber(item?.sourceRatePerHourBase, 0) ||
            toSafeNumber(item?.ratePerHourBase, 0) ||
            roundToNearestTenLocal(sourceRatePerDayBase / 8),
        );
        const sourceRatePerVisitBase = Math.max(50,
            toSafeNumber(item?.sourceRatePerVisitBase, 0) ||
            toSafeNumber(item?.ratePerVisitBase, 0) ||
            toSafeNumber(item?.perWorkerCostBase, 0) ||
            toSafeNumber(item?.ratePerVisit, 0) ||
            roundToNearestTenLocal(Math.max(sourceRatePerHourBase * perWorkerHours, sourceRatePerDayBase * 0.6)),
        );

        let ratePerDayBase = sourceRatePerDayBase;
        let ratePerHourBase = sourceRatePerHourBase;
        let perWorkerCostBase;

        if (selectedRateInputMode === 'hour') {
            if (overrideRate > 0) ratePerHourBase = Math.max(10, overrideRate);
            ratePerDayBase = Math.max(100, roundToNearestTenLocal(ratePerHourBase * HOURS_PER_DAY));
            perWorkerCostBase = ratePerHourBase * perWorkerHours;
        } else if (selectedRateInputMode === 'visit') {
            if (overrideRate > 0) {
                perWorkerCostBase = Math.max(50, overrideRate);
            } else {
                perWorkerCostBase = sourceRatePerVisitBase;
            }
            ratePerHourBase = Math.max(10, roundToNearestTenLocal(sourceRatePerHourBase));
            ratePerDayBase = Math.max(100, roundToNearestTenLocal(ratePerHourBase * HOURS_PER_DAY));
        } else {
            if (overrideRate > 0) ratePerDayBase = Math.max(100, overrideRate);
            ratePerHourBase = Math.max(10, roundToNearestTenLocal(ratePerDayBase / HOURS_PER_DAY));
            perWorkerCostBase = ratePerDayBase * perWorkerDays;
        }

        const perWorkerCostBaseRounded = roundToNearestTenLocal(perWorkerCostBase);
        const perWorkerCost = roundToNearestTenLocal(perWorkerCostBase * safeMultiplier);
        const perWorkerMinCost = roundToNearestTenLocal(perWorkerCost * 0.9);
        const perWorkerMaxCost = roundToNearestTenLocal(perWorkerCost * 1.15);
        const ratePerDay = roundToNearestTenLocal(ratePerDayBase * safeMultiplier);
        const ratePerHour = roundToNearestTenLocal(ratePerHourBase * safeMultiplier);
        const effectiveRateInputMode = selectedRateInputMode;
        const rateInputValueBase = effectiveRateInputMode === 'visit'
            ? perWorkerCostBaseRounded
            : effectiveRateInputMode === 'hour'
                ? roundToNearestTenLocal(ratePerHourBase)
                : roundToNearestTenLocal(ratePerDayBase);
        const rateInputValue = roundToNearestTenLocal(rateInputValueBase * safeMultiplier);

        const subtotal = perWorkerCost * count;
        const subtotalBase = perWorkerCostBaseRounded * count;
        const subtotalMin = perWorkerMinCost * count;
        const subtotalMax = perWorkerMaxCost * count;
        const negotiationRange = buildNegotiationRange({
            expected: perWorkerCost,
            confidence: Number(item?.confidence) || 0.65,
            demandRatio: safeMultiplier,
        });

        return {
            ...item,
            skill: skillKey,
            count,
            hours,
            durationDaysForSkill: perWorkerDays,
            sourceRatePerDayBase,
            sourceRatePerHourBase,
            sourceRatePerVisitBase,
            ratePerDayBase: roundToNearestTenLocal(ratePerDayBase),
            ratePerDay,
            ratePerHourBase,
            ratePerHour,
            ratePerVisitBase: perWorkerCostBaseRounded,
            ratePerVisit: perWorkerCost,
            perWorkerCostBase: perWorkerCostBaseRounded,
            perWorkerCost,
            perWorkerMinCost,
            perWorkerMaxCost,
            rateInputMode: effectiveRateInputMode,
            rateInputValueBase,
            rateInputValue,
            subtotalBase,
            subtotal,
            subtotalMin,
            subtotalMax,
            negotiationRange,
            urgencyApplied: safeMultiplier > 1,
            appliedDemandMultiplier: safeMultiplier,
            customRateApplied: overrideRate > 0,
        };
    });

    const subtotalBase = breakdown.reduce((sum, item) => sum + (Number(item?.subtotalBase) || 0), 0);
    const subtotal = breakdown.reduce((sum, item) => sum + (Number(item?.subtotal) || 0), 0);
    const subtotalMin = breakdown.reduce((sum, item) => sum + (Number(item?.subtotalMin) || 0), 0);
    const subtotalMax = breakdown.reduce((sum, item) => sum + (Number(item?.subtotalMax) || 0), 0);
    const multiplierImpactTotal = subtotal - subtotalBase;
    const totalWorkers = breakdown.reduce((sum, item) => sum + Math.max(1, Number(item?.count) || 1), 0);
    const totalHours = breakdown.reduce((sum, item) => sum + (Number(item?.hours) || 0), 0);
    const durationDays = Math.max(1, Math.ceil(totalHours / Math.max(1, totalWorkers) / 8));

    return {
        ...budgetResult,
        breakdown,
        subtotalBase,
        subtotal,
        subtotalMin,
        subtotalMax,
        multiplierImpactTotal,
        totalEstimated: subtotal,
        totalMinEstimated: subtotalMin,
        totalMaxEstimated: subtotalMax,
        totalWorkers,
        totalHours,
        durationDays,
        urgencyMult: safeMultiplier,
        pricingModels: {
            hourly: roundToNearestTenLocal(subtotal * 0.95),
            daily: roundToNearestTenLocal(subtotal),
            visit: roundToNearestTenLocal(subtotal * 1.05),
            coordinationFactor: 1,
            handoffOverhead: 0,
        },
    };
};

const estimateDurationForJob = ({ workDescription = '', skillBlocks = [], scopeQuantity = 1, fallbackHours = 8 }) => {
    const desc = String(workDescription || '').toLowerCase();
    const skillKeys = (Array.isArray(skillBlocks) ? skillBlocks : []).map((b) => normalizeSkillKey(b?.skill));
    const distinctSkills = [...new Set(skillKeys.filter(Boolean))];
    const isQuickFix = /\bfix|repair|leak|leakage|replace|minor|small\b/.test(desc) && !/renovat|remodel|full|complete|new\s*installation/.test(desc);
    const isPipeLeak = /pipe|plumb|tap|drain|leak|leakage/.test(desc) && distinctSkills.every((s) => ['plumber', 'handyman', 'other'].includes(s));

    let totalHours = Math.max(1, Number(fallbackHours) || 8);
    if (isPipeLeak) {
        totalHours = Math.max(2, Math.min(8, 2 + (Math.max(1, Number(scopeQuantity) || 1) - 1) * 1.5));
    } else if (isQuickFix && distinctSkills.length <= 2) {
        totalHours = Math.max(3, Math.min(10, totalHours * 0.6));
    } else if (/renovat|remodel|civil|tile|waterproof|plaster/.test(desc)) {
        totalHours = Math.max(8, totalHours);
    }

    const durationDays = Math.max(1, Math.ceil(totalHours / 8));
    return { totalHours: Math.round(totalHours), durationDays };
};

const buildEstimateSkillProfile = ({ workDescription = '', answers = {} }) => {
    const corpus = [
        String(workDescription || ''),
        ...Object.entries(answers || {}).map(([q, a]) => `${q}: ${a}`),
    ].join(' | ').toLowerCase();

    const has = (re) => re.test(corpus);
    const plumbing = has(/leak|leakage|pipe|plumb|tap|drain|seepage|water\s*line|wc|toilet|washbasin/);
    const electrical = has(/electri|wire|wiring|switch|socket|mcb|light|fan|geyser\s*point|exhaust/);
    const civilRenovation = has(/renovat|remodel|retile|tile\s*work|plaster|civil|brick|cement|mason|demolition|new\s*installation|complete\s*bathroom/);
    const waterproofing = has(/waterproof|damp|moisture/);
    const carpentry = has(/carpent|wardrobe|cabinet|furniture|wood/);
    const painting = has(/paint|putty|primer/);
    const quickFix = has(/\bfix|repair|minor|small|replace\b/) && !civilRenovation;

    // Hard profile for common leak-repair jobs: keep only essential trades.
    if (plumbing && quickFix && !civilRenovation && !carpentry && !painting) {
        return {
            type: 'quick_plumbing_repair',
            allowedSkills: new Set([
                'plumber',
                ...(electrical ? ['electrician'] : []),
                ...(waterproofing ? ['waterproofing'] : []),
                'handyman',
            ]),
        };
    }

    return {
        type: 'general',
        allowedSkills: null,
    };
};

const detectEstimateSkillsFromContext = ({ workDescription = '', answers = {} }) => {
    const corpus = [
        String(workDescription || ''),
        ...Object.entries(answers || {}).map(([q, a]) => `${q}: ${a}`),
    ].join(' | ');

    const hints = normalizeSkillList(getSkillHintsFromDescription(corpus));
    const specific = hints.filter((skill) => skill !== 'handyman');
    if (specific.length) return specific;
    return hints;
};

const getSkillSpecificQuestionSeeds = (skill = '') => {
    switch (skill) {
        case 'plumber':
            return [
                { question: 'Which fixtures are affected (tap, sink, WC, shower, pipe line)?', type: 'text' },
                { question: 'Is the issue constant or intermittent, and since when?', type: 'text' },
            ];
        case 'electrician':
            return [
                { question: 'How many electrical points/components are affected?', type: 'text' },
                { question: 'Any signs of sparking, burning smell, or tripping?', type: 'select', options: ['Yes', 'No', 'Not sure'] },
            ];
        case 'carpenter':
            return [
                { question: 'Which furniture units are included and how many (beds, wardrobes, kitchen units, etc.)?', type: 'text' },
                { question: 'Do you need repair, customization, or full new installation?', type: 'select', options: ['Repair', 'Customization', 'New installation', 'Mixed'] },
            ];
        case 'painter':
            return [
                { question: 'Approx wall/ceiling area to be painted (in sq ft)?', type: 'text' },
                { question: 'Current wall condition before painting?', type: 'select', options: ['Good', 'Minor cracks', 'Major cracks/dampness', 'Not sure'] },
            ];
        case 'tiler':
            return [
                { question: 'Total tiling area and tile size preference?', type: 'text' },
                { question: 'Is old tile removal required?', type: 'select', options: ['Yes', 'No', 'Partially'] },
            ];
        case 'ac_technician':
            return [
                { question: 'AC type and tonnage (split/window/inverter)?', type: 'text' },
                { question: 'Primary AC issue observed?', type: 'text' },
            ];
        default:
            return [];
    }
};

const buildDynamicFallbackWorkQuestions = (workDescription = '') => {
    const skillHints = getSkillHintsFromDescription(workDescription);
    const base = [
        { question: 'What is the exact scope and expected output for this work?', type: 'text' },
        { question: 'What quantity/area/units are involved?', type: 'select', options: ['Small', 'Medium', 'Large', 'Not sure'] },
        { question: 'What is the current site condition related to this work?', type: 'select', options: ['Good', 'Minor issues', 'Major issues', 'Not sure'] },
        { question: 'Are materials, fixtures, or tools already available on site?', type: 'text' },
        { question: 'Preferred completion timeline?', type: 'select', options: ['Same day', '1-2 days', '3-5 days', 'Flexible'] },
        { question: 'Any site-access constraints (timings, parking, permissions, floor level)?', type: 'text' },
    ];

    const skillSpecific = skillHints.flatMap((skill) => getSkillSpecificQuestionSeeds(skill));
    const merged = [...skillSpecific, ...base];
    return merged.slice(0, 8).map((q, idx) => ({
        id: `q${idx + 1}`,
        question: q.question,
        type: q.type || 'text',
        options: Array.isArray(q.options) ? q.options : [],
        required: true,
    }));
};

const normalizeQuestionKey = (value = '') => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isBudgetQuestion = (value = '') => /\b(budget|cost|price|pricing|quotation|quote|₹|rs\.?|rupees?)\b/i.test(String(value || ''));

const dedupeQuestions = (questions = []) => {
    const seen = new Set();
    const unique = [];
    for (const q of (Array.isArray(questions) ? questions : [])) {
        const key = normalizeQuestionKey(q?.question);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        unique.push(q);
    }
    return unique;
};

const ensureMinimumWorkQuestions = (questions = [], workDescription = '') => {
    const cleaned = dedupeQuestions((Array.isArray(questions) ? questions : [])
        .map((q, idx) => ensureQuestionShape(q, idx))
        .filter((q) => q.question && !isBudgetQuestion(q.question)));

    if (cleaned.length >= MIN_WORK_QUESTIONS) {
        return applyQuestionUnitHints(
            enforceQuestionTypeMix(cleaned.slice(0, 8)).map((q) => ({ ...q, required: true }))
        );
    }

    const existing = new Set(cleaned.map((q) => q.question.toLowerCase()));
    const dynamicFallback = buildDynamicFallbackWorkQuestions(workDescription);
    for (const q of dynamicFallback) {
        if (!existing.has(q.question.toLowerCase())) cleaned.push(q);
        if (cleaned.length >= MIN_WORK_QUESTIONS) break;
    }
    return applyQuestionUnitHints(
        enforceQuestionTypeMix(dedupeQuestions(cleaned).slice(0, 8)).map((q) => ({ ...q, required: true }))
    );
};

const QUESTION_FORBIDDEN_PATTERNS = [
    /\bcity\b/i,
    /\blocality\b/i,
    /\bpincode\b/i,
    /\bpin\s*code\b/i,
    /\bexact\s*date\b/i,
    /\bspecific\s*date\b/i,
    /\bexact\s*time\b/i,
    /\bspecific\s*time\b/i,
    /\burgent|urgency|asap|immediate\b/i,
    /\bbudget|cost|price|pricing|quotation|quote|₹|rs\.?|rupees?\b/i,
];

const QUESTION_MANDATORY_COVERAGE = {
    scopeQuantity: /(how many|quantity|qty|area|size|length|volume|coverage|total|points?|fixtures?|units?|rooms?|sections?|ac\s*units?)/i,
    condition: /(condition|damage|crack|leak|current\s*state|existing\s*state|old|new|working\s*condition|problem\s*severity)/i,
    access: /(access|floor|stairs|lift|elevator|parking|entry|restricted|high[-\s]*rise|site\s*access|basement|terrace)/i,
    material: /(material|who\s*will\s*supply|suppl(y|ier)|client\s*provides?|worker\s*bring|purchase\s*materials?)/i,
    timeline: /(start|timeline|when\s*do\s*you\s*want|completion|within|this\s*week|flexible|by\s*when|expected\s*start|deadline)/i,
    history: /(first\s*time|maintenance|redo|repair\s*history|previous\s*work|rework|done\s*before|existing\s*work)/i,
};

const isForbiddenQuestion = (question = '') => {
    const value = String(question || '').trim();
    if (!value) return true;
    return QUESTION_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value));
};

const normalizeGroqGeneratedQuestions = (questions = []) => {
    const incoming = Array.isArray(questions) ? questions : [];
    const normalized = [];
    const seen = new Set();

    incoming.forEach((item, idx) => {
        const question = String(item?.question || '').trim().replace(/\s+/g, ' ');
        if (!question || isForbiddenQuestion(question)) return;

        const key = normalizeQuestionKey(question);
        if (!key || seen.has(key)) return;
        seen.add(key);

        const rawType = String(item?.type || '').toLowerCase().trim();
        const type = ['select', 'number', 'text'].includes(rawType) ? rawType : 'text';

        const base = {
            id: `q${normalized.length + 1}`,
            question,
            type,
            required: true,
        };

        if (type === 'select') {
            const options = [...new Set((Array.isArray(item?.options) ? item.options : [])
                .map((opt) => String(opt || '').trim())
                .filter(Boolean))];
            if (!options.some((opt) => opt.toLowerCase() === 'not sure')) options.push('Not sure');
            if (!options.some((opt) => opt.toLowerCase() === 'n/a')) options.push('N/A');
            normalized.push({
                ...base,
                options,
                multiSelect: true,
                allowNotSure: false,
            });
            return;
        }

        if (type === 'number') {
            normalized.push({
                ...base,
                options: ['Not sure', 'N/A'],
                allowNotSure: true,
            });
            return;
        }

        normalized.push({
            ...base,
            options: [],
            allowNotSure: false,
        });
    });

    return normalized.slice(0, 10);
};

const hasMandatoryQuestionCoverage = (questions = []) => {
    const text = (Array.isArray(questions) ? questions : []).map((q) => String(q?.question || '')).join(' || ');
    if (!text) return false;
    return Object.values(QUESTION_MANDATORY_COVERAGE).every((pattern) => pattern.test(text));
};

const getMissingMandatoryCoverageTopics = (questions = []) => {
    const text = (Array.isArray(questions) ? questions : []).map((q) => String(q?.question || '')).join(' || ');
    return Object.entries(QUESTION_MANDATORY_COVERAGE)
        .filter(([, pattern]) => !pattern.test(text))
        .map(([topic]) => topic);
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
    'mason', 'welder', 'ac_technician', 'pest_control', 'deep_cleaning',
    'handyman', 'gardener', 'waterproofing', 'flooring',
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
    pushIfText(report.festivalName);
    pushIfText(report.scenarioNarratives?.best);
    pushIfText(report.scenarioNarratives?.expected);
    pushIfText(report.scenarioNarratives?.worst);

    (report.workPlan || []).forEach((step) => {
        pushIfText(step?.title);
        pushIfText(step?.description);
        pushIfText(step?.estimatedTime);
        pushIfText(step?.phase);
        (step?.scheduleWindows || []).forEach((window) => {
            pushIfText(window?.dayName);
        });
    });
    (report.timeEstimate?.schedule?.days || []).forEach((day) => {
        pushIfText(day?.dayName);
        (day?.entries || []).forEach((entry) => {
            pushIfText(entry?.title);
            pushIfText(entry?.description);
        });
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
        festivalName: tr(report.festivalName),
        scenarioNarratives: report.scenarioNarratives
            ? {
                best: tr(report.scenarioNarratives.best),
                expected: tr(report.scenarioNarratives.expected),
                worst: tr(report.scenarioNarratives.worst),
            }
            : report.scenarioNarratives,
        workPlan: (report.workPlan || []).map((step) => ({
            ...step,
            title: tr(step?.title),
            description: tr(step?.description),
            estimatedTime: tr(step?.estimatedTime),
            phase: tr(step?.phase),
            scheduleWindows: (step?.scheduleWindows || []).map((window) => ({
                ...window,
                dayName: tr(window?.dayName),
            })),
        })),
        timeEstimate: report.timeEstimate
            ? {
                ...report.timeEstimate,
                schedule: report.timeEstimate?.schedule
                    ? {
                        ...report.timeEstimate.schedule,
                        endDayName: tr(report.timeEstimate.schedule.endDayName),
                        days: (report.timeEstimate.schedule.days || []).map((day) => ({
                            ...day,
                            dayName: tr(day?.dayName),
                            entries: (day?.entries || []).map((entry) => ({
                                ...entry,
                                dayName: tr(entry?.dayName),
                                title: tr(entry?.title),
                                description: tr(entry?.description),
                            })),
                        })),
                    }
                    : report.timeEstimate?.schedule,
            }
            : report.timeEstimate,
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
            const payload = {
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
            };

            // Some Groq model deployments reject response_format; first try strict mode,
            // then retry without response_format while still requesting strict JSON.
            if (attempt === 1) {
                payload.response_format = { type: 'json_object' };
            }

            const completion = await groq.chat.completions.create(payload);

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
const formatWorker = (w, meta = {}) => ({
    id:               w._id,
    _id:              w._id,
    karigarId:        w.karigarId,
    name:             w.name,
    photo:            w.photo,
    mobile:           w.mobile,
    phoneType:        w.phoneType,
    skills:           Array.isArray(w.skills) ? w.skills.map(s => s?.name || s || '') : [],
    matchedSkills:    Array.isArray(meta.matchedSkills) ? meta.matchedSkills : [],
    overallExperience: w.overallExperience,
    points:           w.points,
    availability:     w.availability !== false,
    rating:           Number(meta.avgStars || 0),
    ratingCount:      Number(meta.ratingCount || 0),
    city:             w.address?.city || '',
    locality:         w.address?.locality || '',
    latitude:         Number.isFinite(Number(w.address?.latitude)) ? Number(w.address.latitude) : null,
    longitude:        Number.isFinite(Number(w.address?.longitude)) ? Number(w.address.longitude) : null,
    matchReasons:     Array.isArray(meta.matchReasons) ? meta.matchReasons : [],
    matchScore:       Number(meta.score || 0),
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
    const { city = '', locality = '', preferredLanguage = '' } = req.body;
    const workDescription = String(req.body?.workDescription || req.body?.description || '').trim();
    if (!workDescription) {
        return res.status(400).json({ message: 'Work description is required.' });
    }
    if (workDescription.length < 10) {
        return res.status(400).json({ message: 'Please enter at least 10 characters in work description.' });
    }
    try {
        let inputLanguage = 'en';
        let selectedLanguage = normalizeLanguage(preferredLanguage || 'en');
        let workDescriptionEn = workDescription;
        let cityEn = city;

        try {
            const translated = await buildTranslatedInput({
                workDescription,
                city,
                preferredLanguage,
                answers: {},
                opinions: {},
            });
            inputLanguage = translated.inputLanguage;
            selectedLanguage = translated.selectedLanguage;
            workDescriptionEn = translated.workDescriptionEn;
            cityEn = translated.cityEn;
        } catch (translationErr) {
            console.error('generateQuestions translation fallback:', translationErr.message);
        }

        let localityEn = locality;
        if (locality) {
            try {
                localityEn = (await translateText(locality, 'en', 'auto')).translatedText;
            } catch (localityErr) {
                console.error('generateQuestions locality translation fallback:', localityErr.message);
                localityEn = locality;
            }
        }

        const contextualPrompt = [
            'Generate questions for this job request.',
            `Work description: ${workDescriptionEn || workDescription}`,
            cityEn ? `City context (already known, do not ask): ${cityEn}` : '',
            localityEn ? `Locality context (already known, do not ask): ${localityEn}` : '',
            '',
            'Strict requirements:',
            '- Exactly 10 work questions.',
            '- q1 must be number for scope/quantity.',
            '- Cover condition, access complexity, material responsibility, timeline/start expectation, first-time vs maintenance/redo.',
            '- Keep remaining questions skill-specific and cost-driver focused.',
            '- Select questions must include Not sure and N/A and use multiSelect=true.',
            '- Number questions must include options [Not sure, N/A] and allowNotSure=true.',
            '- Do not ask city/locality/date/time/urgency/budget.',
            '- opinionQuestions must be empty array.',
        ].filter(Boolean).join('\n');

        let usedFallback = false;
        let questions = [];
        let opinionQuestions = [];

        const generationAttempts = [
            {
                prompt: contextualPrompt,
                maxTokens: 1500,
                temperature: 0.15,
            },
            {
                prompt: [
                    contextualPrompt,
                    '',
                    'Regenerate with stricter compliance.',
                    'Ensure q1 is number and all mandatory topics are present exactly once or more.',
                ].join('\n'),
                maxTokens: 1700,
                temperature: 0,
            },
            {
                prompt: [
                    contextualPrompt,
                    '',
                    'Third attempt: prioritize schema correctness and complete 10 questions over creativity.',
                    'No markdown, no explanations, JSON only.',
                ].join('\n'),
                maxTokens: 1700,
                temperature: 0,
            },
        ];

        for (const attempt of generationAttempts) {
            const pass = await callGroqJson({
                systemPrompt: QUESTIONS_SYSTEM_PROMPT,
                userPrompt: attempt.prompt,
                maxTokens: attempt.maxTokens,
                temperature: attempt.temperature,
                fallback: { questions: [], opinionQuestions: [] },
            });
            usedFallback = usedFallback || Boolean(pass?.usedFallback);

            const candidate = normalizeGroqGeneratedQuestions(pass?.parsed?.questions);
            if (candidate.length > questions.length) questions = candidate;

            if (questions.length === 10 && questions[0]?.type === 'number' && hasMandatoryQuestionCoverage(questions)) {
                break;
            }
        }

        // AI top-up for missing coverage topics without static fallback.
        const missingTopics = getMissingMandatoryCoverageTopics(questions);
        if (missingTopics.length > 0) {
            const topUpForMissingTopics = await callGroqJson({
                systemPrompt: QUESTIONS_SYSTEM_PROMPT,
                userPrompt: [
                    'Generate additional questions only for missing mandatory topics.',
                    `Work description: ${workDescriptionEn || workDescription}`,
                    `Missing topics: ${missingTopics.join(', ')}`,
                    'Return 1 short question per missing topic in questions array.',
                    'Do not repeat existing questions.',
                    `Existing questions: ${questions.map((q) => q.question).join(' | ')}`,
                ].join('\n'),
                maxTokens: 1000,
                temperature: 0,
                fallback: { questions: [], opinionQuestions: [] },
            });
            usedFallback = usedFallback || Boolean(topUpForMissingTopics?.usedFallback);
            questions = normalizeGroqGeneratedQuestions([
                ...questions,
                ...(Array.isArray(topUpForMissingTopics?.parsed?.questions) ? topUpForMissingTopics.parsed.questions : []),
            ]);
        }

        // AI top-up for missing count to reach exactly 10.
        if (questions.length < 10) {
            const needed = 10 - questions.length;
            const topUpForCount = await callGroqJson({
                systemPrompt: QUESTIONS_SYSTEM_PROMPT,
                userPrompt: [
                    `Generate exactly ${needed} additional non-duplicate work questions.`,
                    `Work description: ${workDescriptionEn || workDescription}`,
                    `Existing questions: ${questions.map((q) => q.question).join(' | ')}`,
                    'Keep output compatible with the same schema and endpoint rules.',
                ].join('\n'),
                maxTokens: 1100,
                temperature: 0.1,
                fallback: { questions: [], opinionQuestions: [] },
            });
            usedFallback = usedFallback || Boolean(topUpForCount?.usedFallback);
            questions = normalizeGroqGeneratedQuestions([
                ...questions,
                ...(Array.isArray(topUpForCount?.parsed?.questions) ? topUpForCount.parsed.questions : []),
            ]);
        }

        // Final shape enforcement with AI-generated content preserved.
        if (questions[0]?.type !== 'number') {
            const scopeQuestionFix = await callGroqJson({
                systemPrompt: QUESTIONS_SYSTEM_PROMPT,
                userPrompt: [
                    'Generate exactly one scope/quantity number question for q1.',
                    `Work description: ${workDescriptionEn || workDescription}`,
                    'Return JSON with one question in questions array.',
                ].join('\n'),
                maxTokens: 400,
                temperature: 0,
                fallback: { questions: [], opinionQuestions: [] },
            });
            usedFallback = usedFallback || Boolean(scopeQuestionFix?.usedFallback);
            const scopeQuestion = normalizeGroqGeneratedQuestions(scopeQuestionFix?.parsed?.questions).find((q) => q.type === 'number');
            if (scopeQuestion) {
                questions = normalizeGroqGeneratedQuestions([scopeQuestion, ...questions]);
            }
        }

        questions = questions.slice(0, 10);
        const finalValid = questions.length === 10 && questions[0]?.type === 'number' && hasMandatoryQuestionCoverage(questions);

        if (!finalValid) {
            console.error('generateQuestions returned partial compliance after AI recovery', {
                count: questions.length,
                q1Type: questions[0]?.type,
                missingTopics: getMissingMandatoryCoverageTopics(questions),
            });
        }

        if (!questions.length) {
            return res.status(502).json({
                message: 'Unable to generate questions from AI right now. Please try again.',
                questions: [],
                opinionQuestions: [],
                language: {
                    detected: inputLanguage,
                    selected: selectedLanguage,
                    translatedToEnglish: true,
                    responseTranslated: false,
                    usedFallback: true,
                },
            });
        }

        questions = questions.map((q, idx) => ({ ...q, id: `q${idx + 1}`, required: true }));

        if (selectedLanguage !== 'en') {
            questions = await translateQuestionSet(questions, selectedLanguage);
            opinionQuestions = await translateQuestionSet(opinionQuestions, selectedLanguage);
        }

        console.info(`generateQuestions result: usedFallback=${usedFallback} questions=${questions.length} opinions=${opinionQuestions.length}`);

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
        return res.status(502).json({
            message: 'AI question generation failed. Please retry.',
            questions: [],
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

exports.getRateSummaryByCity = async (req, res) => {
    const { cityKey, city } = req.query;
    const summary = await getRateSummaryByCity(cityKey || city || '');
    return res.status(200).json({ summary });
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTE: POST /api/ai/generate-estimate  (UNCHANGED)
// ══════════════════════════════════════════════════════════════════════════════
exports.generateEstimate = async (req, res) => {
    const {
        workDescription,
        answers = {},
        city = '',
        locality = '',
        urgent: urgentInput = false,
        workerCountOverride,
        includeTravelCost,
        preferredLanguage = '',
        selectedSkills = [],
        removedSkills = [],
        strictSkillMode = false,
        skillWorkerCountOverrides = {},
        skillRateOverrides = {},
        skillRateOverrideModes = {},
        skillDurationOverrides = {},
        jobDate = '',
        jobStartTime = '09:00',
        durationDaysOverride,
        durationHoursOverride,
        lockedDemandMultiplier,
    } = req.body;
    const urgent = parseBooleanInput(urgentInput, false);
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

        const { parsed: aiResult, usedFallback: groqFallbackUsed, error: groqFallbackError } = await callGroqJson({
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

        const scopeQuantity = extractScopeQuantity({ workDescription: workDescriptionEn, answers: answersEn });
        const detectedContextSkills = detectEstimateSkillsFromContext({
            workDescription: workDescriptionEn,
            answers: answersEn,
        });
        const inferredSkillBlocks = normalizeSkillBlocksForContext({
            skillBlocks: aiResult.skillBlocks || [],
            workDescription: workDescriptionEn,
            answers: answersEn,
        });
        let skillBlocks = applyScopeMultiplierToSkillBlocks(inferredSkillBlocks, scopeQuantity);
        skillBlocks = applySkillConstraintsToBlocks({
            skillBlocks,
            selectedSkills,
            removedSkills,
            strictSkillMode: parseBooleanInput(strictSkillMode, false),
        });

        const selectedSkillList = normalizeSkillList(selectedSkills);
        const profile = buildEstimateSkillProfile({ workDescription: workDescriptionEn, answers: answersEn });
        if (!selectedSkillList.length && detectedContextSkills.length) {
            const detectedSet = new Set(detectedContextSkills);
            const filteredSkillBlocks = skillBlocks.filter((block) => detectedSet.has(normalizeSkillKey(block?.skill)));

            if (filteredSkillBlocks.length) {
                skillBlocks = filteredSkillBlocks;
            } else if (skillBlocks.length > 0) {
                skillBlocks = detectedContextSkills.map((skill) => ({
                    skill,
                    count: 1,
                    hours: 3,
                    complexity: 'normal',
                    description: `Detected ${titleCase(skill)} from job description and answers.`,
                }));
            }
        }
        if (!selectedSkillList.length && profile.allowedSkills instanceof Set) {
            skillBlocks = skillBlocks.filter((block) => profile.allowedSkills.has(normalizeSkillKey(block?.skill)));
        }

        if (!selectedSkillList.length && profile.type === 'quick_plumbing_repair') {
            skillBlocks = skillBlocks
                .filter((block) => ['plumber', 'electrician', 'waterproofing', 'handyman'].includes(normalizeSkillKey(block?.skill)))
                .slice(0, 2)
                .map((block) => ({
                    ...block,
                    count: 1,
                    hours: Math.max(2, Math.min(4, Number(block?.hours) || 3)),
                    complexity: 'normal',
                }));
        }

        // Ensure retained skills are valid and normalized.
        skillBlocks = skillBlocks
            .map((block) => ({ ...block, skill: normalizeSkillKey(block?.skill) }))
            .filter((block) => block.skill && ESTIMATE_ALLOWED_SKILLS.has(block.skill));

        if (!selectedSkillList.length) {
            skillBlocks = applyAutoDetectedWorkerCaps({
                skillBlocks,
                workDescription: workDescriptionEn,
                answers: answersEn,
                scopeQuantity,
                profileType: profile.type,
            });
        }

        const userCountOverrides = skillWorkerCountOverrides && typeof skillWorkerCountOverrides === 'object'
            ? skillWorkerCountOverrides
            : {};
        const userDurationOverrides = skillDurationOverrides && typeof skillDurationOverrides === 'object'
            ? skillDurationOverrides
            : {};
        if (skillBlocks.length > 0) {
            skillBlocks = skillBlocks.map((block) => {
                const skillKey = normalizeSkillKey(block?.skill);
                const overrideCount = Number(userCountOverrides?.[skillKey]);
                const rawDurationOverride = userDurationOverrides?.[skillKey];
                const overrideHours = typeof rawDurationOverride === 'object'
                    ? Number(rawDurationOverride?.hours)
                    : Number(rawDurationOverride);
                return {
                    ...block,
                    count: Math.min(6, Math.max(1, Number.isFinite(overrideCount) && overrideCount > 0 ? overrideCount : (Number(block?.count) || 1))),
                    hours: Math.max(1, Number.isFinite(overrideHours) && overrideHours > 0 ? Math.round(overrideHours) : (Number(block?.hours) || 1)),
                };
            });
        }

        const override = Number(workerCountOverride);
        if (override > 0 && skillBlocks.length > 0) {
            skillBlocks = distributeTotalWorkers(skillBlocks, override);
        }

        // Base labour-only budget without urgency applied (we apply demand multipliers per worker below).
        let budgetResult = await calculateStructuredBudget(skillBlocks, city, false, { preferBaseRate: true });

        // Derive realistic duration for estimate mode.
        const estimatedDuration = estimateDurationForJob({
            workDescription: workDescriptionEn,
            skillBlocks,
            scopeQuantity,
            fallbackHours: budgetResult.totalHours,
        });

        const overrideDays = Number(durationDaysOverride);
        const overrideHours = Number(durationHoursOverride);
        const finalDurationHours = (Number.isFinite(overrideHours) && overrideHours > 0)
            ? Math.max(1, Math.round(overrideHours))
            : estimatedDuration.totalHours;
        const finalDurationDays = (Number.isFinite(overrideDays) && overrideDays > 0)
            ? Math.max(1, Math.round(overrideDays))
            : estimatedDuration.durationDays;

        budgetResult.totalHours = finalDurationHours;
        budgetResult.durationDays = finalDurationDays;

        // Keep per-skill durations from AI or client overrides; global duration remains editable/display only.

        // AI advisor-compatible demand multipliers (weekday/weekend/holiday/festival/urgent).
        let demandMultipliers = {
            weekendMultiplier: 1,
            timeMultiplier: 1,
            holidayAndFestivalMultiplier: 1,
            urgencyMultiplier: urgent ? 1.3 : 1,
            finalMultiplier: urgent ? 1.3 : 1,
            dayType: 'weekday',
            timePeriod: getTimePeriod(jobStartTime || '09:00'),
            season: getSeason(jobDate || new Date()),
            festivalName: '',
        };
        const hasValidDate = /^\d{4}-\d{2}-\d{2}$/.test(String(jobDate || '').trim());
        if (hasValidDate) {
            demandMultipliers = await calculateDemandMultipliers(
                jobDate,
                String(jobStartTime || '09:00'),
                urgent,
                finalDurationDays > 1
            );
        }
        const lockedMultiplier = Number(lockedDemandMultiplier);
        if (Number.isFinite(lockedMultiplier) && lockedMultiplier > 0) {
            demandMultipliers = {
                ...demandMultipliers,
                finalMultiplier: lockedMultiplier,
            };
        }

        // Apply client overrides and demand multiplier at per-worker level.
        budgetResult = applyRateAndCountOverridesToBudget({
            budgetResult,
            skillWorkerCountOverrides: userCountOverrides,
            skillRateOverrides: skillRateOverrides && typeof skillRateOverrides === 'object' ? skillRateOverrides : {},
            skillRateOverrideModes: skillRateOverrideModes && typeof skillRateOverrideModes === 'object' ? skillRateOverrideModes : {},
            skillDurationOverrides: userDurationOverrides,
            perWorkerMultiplier: Number(demandMultipliers.finalMultiplier) || 1,
        });

        // Keep editable global duration from user input in response metadata only; costing is skill-duration driven.
        budgetResult.totalHours = finalDurationHours;
        budgetResult.durationDays = finalDurationDays;

        const travelCost = parseBooleanInput(includeTravelCost, false) ? 55 : 0;
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
        const topWorkers   = await User.find({ role:'worker', verificationStatus:'approved', skills:{$elemMatch:{name:{$in:skillNames}}} }).sort({points:-1}).limit(10).select('name karigarId photo overallExperience points skills mobile phoneType address');

        const estimatePriceReasoning = await buildPriceReasoning({
            city,
            budgetResult,
            signals: deriveConditionSignals({ workDescription, answers }),
            skillBlocks,
            workDescription,
            includeMaterials: false,
            includeEquipment: false,
            marketInsight,
            ownedMaterialList: [],
            ownedEquipmentList: [],
        });

        let response = {
            jobTitle: aiResult.jobTitle || '',
            durationDays: budgetResult.durationDays || aiResult.durationDays || 1,
            locality,
            skillBlocks,
            scopeQuantity,
            budgetBreakdown: budgetResult,
            breakdownMode: 'labour_only',
            demandMultipliers,
            demandFactor: Number(demandMultipliers.finalMultiplier) || 1,
            festivalName: demandMultipliers.festivalName || '',
            jobDate,
            jobStartTime,
            labourConfidence,
            includeTravelCost: travelCost > 0,
            workerTravelCost: travelCost,
            priceReasoning: estimatePriceReasoning,
            costSavingSuggestions: buildCostSavingSuggestions({
                signals: deriveConditionSignals({ workDescription, answers }),
                skillBlocks,
                workDescription,
                includeMaterials: false,
                includeEquipment: false,
                includeTravelCost: travelCost > 0,
                marketInsight,
                city,
            }),
            localMarketInsight: marketInsight,
            bestCaseTotal: labourMin + travelCost,
            expectedTotal: (Number(budgetResult.totalEstimated) || 0) + travelCost,
            worstCaseTotal: labourMax + travelCost,
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
        const fallbackBudgetRaw = await calculateStructuredBudget(fallbackSkillBlocks, city, false, { preferBaseRate: true });
        const fallbackBudget = applyRateAndCountOverridesToBudget({
            budgetResult: fallbackBudgetRaw,
            skillWorkerCountOverrides: skillWorkerCountOverrides && typeof skillWorkerCountOverrides === 'object' ? skillWorkerCountOverrides : {},
            skillRateOverrides: skillRateOverrides && typeof skillRateOverrides === 'object' ? skillRateOverrides : {},
            skillRateOverrideModes: skillRateOverrideModes && typeof skillRateOverrideModes === 'object' ? skillRateOverrideModes : {},
            skillDurationOverrides: skillDurationOverrides && typeof skillDurationOverrides === 'object' ? skillDurationOverrides : {},
            perWorkerMultiplier: (Number.isFinite(Number(lockedDemandMultiplier)) && Number(lockedDemandMultiplier) > 0)
                ? Number(lockedDemandMultiplier)
                : (urgent ? 1.3 : 1),
        });
        return res.status(200).json({
            jobTitle: workDescription?.slice(0, 60) || 'Home Service Work',
            durationDays: fallbackBudget.durationDays || 1,
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
        city = '', locality = '', urgent: urgentInput = false, clientBudget, preferredLanguage = '',
        includeMaterialCost,
        includeEquipmentCost,
        includeTravelCost,
        ownedMaterials,
        ownedEquipment,
        jobDate = '',
        jobStartTime = '09:00',
    } = req.body;
    const urgent = parseBooleanInput(urgentInput, false);

    // ── INPUT VALIDATION ────────────────────────────────────────────────────
    if (!workDescription?.trim()) return res.status(400).json({ message: 'Work description is required.' });
    
    // Validate date format
    if (jobDate && !/^\d{4}-\d{2}-\d{2}$/.test(jobDate)) {
        return res.status(400).json({ message: 'jobDate must be ISO format (YYYY-MM-DD)' });
    }
    
    // Validate time format
    if (jobStartTime && !/^\d{2}:\d{2}$/.test(jobStartTime)) {
        return res.status(400).json({ message: 'jobStartTime must be HH:MM format' });
    }

    const imageUploaded = !!req.file;
    const imageHint     = imageUploaded
        ? `\nThe client uploaded a photo. Include relevant imageFindings (visible issues commonly seen in such photos).`
        : '';

    const includeMaterials = parseBooleanInput(includeMaterialCost, true);
    const includeEquipment = parseBooleanInput(includeEquipmentCost, true);
    const includeTravel = parseBooleanInput(includeTravelCost, false);
    const workerTravelCost = includeTravel ? getTravelCostForCity(city) : 0;
    const localityInput = String(locality || '').trim();
    const ownedMaterialList = parseOwnershipList(ownedMaterials);
    const ownedEquipmentList = parseOwnershipList(ownedEquipment);

    // Calculate demand multipliers based on job date and time
    let demandMultipliers = {
        weekendMultiplier: 1.0,
        timeMultiplier: 1.0,
        holidayAndFestivalMultiplier: 1.0,
        urgencyMultiplier: 1.0,
        finalMultiplier: 1.0,
        festivalName: '',
        dayType: 'weekday',
        timePeriod: 'morning',
        season: 'summer',
    };
    let dayType = 'weekday', timePeriod = 'morning', festival = '', season = 'summer', jobEndTime = '', jobEndDate = '', jobEndDay = '';

    if (jobDate) {
        try {
            demandMultipliers = await calculateDemandMultipliers(jobDate, jobStartTime, urgent);
            dayType = demandMultipliers.dayType;
            timePeriod = demandMultipliers.timePeriod;
            season = demandMultipliers.season;
            festival = demandMultipliers.festivalName || '';
            // NOTE: jobEndTime will be calculated AFTER timeEstimate is ready (see below)
        } catch (err) {
            console.error('Demand multiplier calculation error:', err.message);
        }
    }

    const budgetNote = clientBudget && Number(clientBudget) > 0
        ? `\nClient Budget: ₹${Number(clientBudget).toLocaleString('en-IN')} (consider this in your estimate and budgetAdvice)`
        : '';
    const demandNote = jobDate ? `\nJob Date: ${jobDate} (${dayType}${festival ? ` - ${festival}` : ''})${timePeriod !== 'morning' ? ` - ${timePeriod}` : ''}` : '';
    const scopeNote = `\nInclude Materials Cost: ${includeMaterials ? 'Yes' : 'No'}\nInclude Equipment Cost: ${includeEquipment ? 'Yes' : 'No'}\nInclude Worker Travel Cost: ${includeTravel ? `Yes (₹${workerTravelCost})` : 'No'}\nMaterials Already Available: ${ownedMaterialList.length ? ownedMaterialList.join(', ') : 'None'}\nEquipment Already Available: ${ownedEquipmentList.length ? ownedEquipmentList.join(', ') : 'None'}`;

    const {
        inputLanguage,
        selectedLanguage,
        workDescriptionEn,
        cityEn,
        answersEn,
        opinionsEn,
    } = await buildTranslatedInput({ workDescription, city, answers, opinions, preferredLanguage });
    const localityEn = localityInput ? (await translateText(localityInput, 'en', 'auto')).translatedText : '';

    const answersText  = Object.entries(answersEn).filter(([,v])=>v).map(([q,a])=>`  - ${q}: ${a}`).join('\n');
    const opinionsText = Object.entries(opinionsEn).filter(([,v])=>v).map(([q,a])=>`  - ${q}: ${a}`).join('\n');

    const userPrompt = `Work: "${workDescriptionEn}"
City: ${cityEn||'Pune'}${localityEn ? `\nLocality: ${localityEn}` : ''}
Urgent: ${urgent?'Yes':'No'}${budgetNote}${demandNote}
    ${scopeNote}
${answersText?`Client Answers:\n${answersText}`:''}
${opinionsText?`Client Preferences (colour/style):\n${opinionsText}`:''}${imageHint}`;

    try {
        const { parsed: aiResult, usedFallback: groqFallbackUsed, error: groqFallbackError } = await callGroqJson({
            systemPrompt: ADVISOR_SYSTEM_PROMPT,
            userPrompt,
            maxTokens: 3000,
            temperature: 0.3,
            fallback: {
                jobTitle: workDescriptionEn.slice(0, 60) || 'Home Service Work',
                problemSummary: 'Basic advisory generated due to temporary AI issue.',
                skillBlocks: [],
                materialsBreakdown: [],
                equipmentBreakdown: [],
                workPlan: [],
                timeEstimate: { totalDays: 1, totalHours: 8, phases: [] },
                expectedOutcome: [],
                colourAndStyleAdvice: '',
                designSuggestions: [],
                improvementIdeas: [],
                imageFindings: [],
                warnings: [],
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

        const fallbackReason = groqFallbackError?.message || '';
        if (fallbackReason) {
            console.error('generateAdvisorReport fallback reason:', fallbackReason);
        }

        const scopeQuantity = extractScopeQuantity({ workDescription: workDescriptionEn, answers: answersEn });
        const inferredSkillBlocks = normalizeSkillBlocksForContext({
            skillBlocks: aiResult.skillBlocks || [],
            workDescription: workDescriptionEn,
            answers: answersEn,
        });
        const skillBlocks  = applyScopeMultiplierToSkillBlocks(inferredSkillBlocks, scopeQuantity);
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

        const fallbackAreaSqft = Math.max(
            120,
            Number(conditionSignals?.totalPaintArea) || 0,
            Number(conditionSignals?.wallAreaSqft) || 0,
            Number(conditionSignals?.areaSqft) || 0,
            (Number(scopeQuantity) || 1) * 60
        );
        const synthesizedBreakdown = generateFullMaterialList({
            skills: skillBlocks.map((b) => normalizeSkillKey(b?.skill)).filter(Boolean),
            areaSqft: fallbackAreaSqft,
            city,
            signals: conditionSignals,
            ownedItems: [...ownedMaterialList, ...ownedEquipmentList],
        });

        const rawMaterialsBreakdown = (Array.isArray(aiResult.materialsBreakdown) && aiResult.materialsBreakdown.length)
            ? aiResult.materialsBreakdown
            : (synthesizedBreakdown.materials || []);
        const rawEquipmentBreakdown = (Array.isArray(aiResult.equipmentBreakdown) && aiResult.equipmentBreakdown.length)
            ? aiResult.equipmentBreakdown
            : (synthesizedBreakdown.equipment || []);
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
            locality: localityInput,
        })));
        const equipmentBreakdown = await Promise.all(filteredEquipment.items.map((item) => estimateMaterialOrEquipmentItem({
            item,
            kind: 'equipment',
            signals: conditionSignals,
            marketInsight,
            city,
            locality: localityInput,
        })));
        const splitMaterials = summarizeBuckets(materialsBreakdown);
        const splitEquipment = summarizeBuckets(equipmentBreakdown);
        const fullFurnitureProject = isFullHomeFurnitureProject({ workDescription, skillBlocks });
        const normalizedMaterialsBreakdown = normalizeFurnitureMaterials({
            materials: materialsBreakdown,
            workDescription,
            city,
            locality: localityInput,
            isFullProject: fullFurnitureProject,
        });
        const finalMaterialsSplit = summarizeBuckets(normalizedMaterialsBreakdown);
        const materialsTotal     = includeMaterials ? sumEstimatedCost(normalizedMaterialsBreakdown) : 0;
        const equipmentTotal     = includeEquipment ? sumEstimatedCost(equipmentBreakdown) : 0;
        const requiredMaterialsTotal = includeMaterials ? finalMaterialsSplit.requiredTotal : 0;
        const optionalMaterialsTotal = includeMaterials ? finalMaterialsSplit.optionalTotal : 0;
        const requiredEquipmentTotal = includeEquipment ? splitEquipment.requiredTotal : 0;
        const optionalEquipmentTotal = includeEquipment ? splitEquipment.optionalTotal : 0;
        const labourTotal        = budgetResult.totalEstimated;
        
        // ── APPLY DEMAND MULTIPLIERS TO PRICES ──────────────────────────────
        let demandMultiplier = demandMultipliers.finalMultiplier || 1.0;
        
        // Will recalculate after duration is determined (see below after timeEstimate calculation)
        let labourTotalAdjusted = labourTotal * demandMultiplier;
        let labourMinAdjusted = labourMin * demandMultiplier;
        let labourMaxAdjusted = labourMax * demandMultiplier;
        
        // Calculate material and equipment totals
        let combinedTotal      = labourTotalAdjusted + materialsTotal + equipmentTotal + workerTravelCost;
        let grandTotal         = combinedTotal;
        const sumCostByKey = (items = [], key = 'estimatedCost') => items.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0);
        const materialBestCaseTotal = includeMaterials ? sumCostByKey(finalMaterialsSplit.requiredItems, 'bestCaseCost') : 0;
        const materialWorstCaseTotal = includeMaterials ? sumCostByKey(normalizedMaterialsBreakdown, 'worstCaseCost') : 0;
        const equipmentBestCaseTotal = includeEquipment ? sumCostByKey(splitEquipment.requiredItems, 'bestCaseCost') : 0;
        const equipmentWorstCaseTotal = includeEquipment ? sumCostByKey(equipmentBreakdown, 'worstCaseCost') : 0;
        
        // Use adjusted labour costs in project summary
        let projectSummary     = {
            bestCase: labourMinAdjusted + materialBestCaseTotal + equipmentBestCaseTotal + workerTravelCost,
            expected: labourTotalAdjusted + materialsTotal + equipmentTotal + workerTravelCost,
            worstCase: labourMaxAdjusted + materialWorstCaseTotal + equipmentWorstCaseTotal + workerTravelCost,
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
        const priceReasoning     = await buildPriceReasoning({
            city,
            budgetResult,
            signals: conditionSignals,
            skillBlocks,
            workDescription,
            includeMaterials,
            includeEquipment,
            ownedMaterialList,
            ownedEquipmentList,
            marketInsight,
            demandMultipliers,
            jobDate,
            jobStartTime,
            demandFactor: demandMultiplier,
            requiredMaterialsTotal,
            optionalMaterialsTotal,
            requiredEquipmentTotal,
            optionalEquipmentTotal,
        });
        const costSavingSuggestions = buildCostSavingSuggestions({
            signals: conditionSignals,
            skillBlocks,
            workDescription,
            includeMaterials,
            includeEquipment,
            includeTravelCost: includeTravel,
            ownedMaterialList,
            ownedEquipmentList,
            marketInsight,
            city,
        });
        const scenarioNarratives = buildScenarioNarratives({
            workDescription,
            skillBlocks,
            signals: conditionSignals,
            includeMaterials,
            includeEquipment,
            marketInsight,
        });
        const timeEstimate = reconcileTimeline({
            aiTimeEstimate: aiResult.timeEstimate || {},
            aiDurationDays: aiResult.durationDays || 1,
            budgetResult,
            isFullFurnitureProject: fullFurnitureProject,
            skillBlocks,
            workDescription,
            jobDate,
            jobStartTime,
        });
        
        // ── INDUSTRY-STANDARD FIX: Multi-day projects should not pay holiday surcharge ──
        // Recalculate demandMultipliers with isMultiDay flag so holiday premium is 1.0
        const projectDays = timeEstimate?.totalDays || 1;
        const isMultiDay = projectDays > 1;
        if (jobDate && isMultiDay) {
            // Recalculate without holiday surcharge for multi-day projects
            demandMultipliers = await calculateDemandMultipliers(jobDate, jobStartTime, isUrgent, true);
            demandMultiplier = demandMultipliers.finalMultiplier || 1.0;
        }
        
                // ── Apply final demand multiplier to labour (capped at 1.3 max) ──
                // Ensure demandMultiplier is always set from recalculated values
                if (!demandMultiplier || demandMultiplier === 0) {
                    demandMultiplier = demandMultipliers.finalMultiplier || 1.0;
                }

        console.info('[PRICING ENGINE]', {
            jobDate,
            jobStartTime,
            jobEndDate: timeEstimate?.schedule?.endDate || '',
            projectDays,
            isMultiDay,
            urgentInput,
            urgentParsed: urgent,
            isUrgent,
            multipliers: {
                weekend: demandMultipliers.weekendMultiplier,
                time: demandMultipliers.timeMultiplier,
                holidayFestival: demandMultipliers.holidayAndFestivalMultiplier,
                urgency: demandMultipliers.urgencyMultiplier,
                final: demandMultipliers.finalMultiplier,
            },
            appliedDemandMultiplier: demandMultiplier,
        });

        labourTotalAdjusted = Math.round(labourTotal * demandMultiplier);
        labourMinAdjusted = Math.round(labourMin * demandMultiplier);
        labourMaxAdjusted = Math.round(labourMax * demandMultiplier);
        
        // ── Recalculate project totals ──
        // (reusing previously calculated case totals without duration multiplication)
        
        projectSummary = {
            bestCase: labourMinAdjusted + materialBestCaseTotal + equipmentBestCaseTotal + workerTravelCost,
            expected: labourTotalAdjusted + materialsTotal + equipmentTotal + workerTravelCost,
            worstCase: labourMaxAdjusted + materialWorstCaseTotal + equipmentWorstCaseTotal + workerTravelCost,
        };
        
        combinedTotal = projectSummary.expected;
        grandTotal = combinedTotal;
        
        // ── Calculate correct jobEndTime based on actual duration ──────────────
        if (jobDate && timeEstimate?.schedule?.endTime) {
            jobEndTime = timeEstimate.schedule.endTime;
            jobEndDate = timeEstimate.schedule.endDate || jobDate;
            jobEndDay = timeEstimate.schedule.endDayName || '';
        } else if (jobDate && timeEstimate?.totalHours) {
            jobEndTime = calculateEndTime(jobStartTime, timeEstimate.totalHours);
            jobEndDate = jobDate;
        }
        
        const workPlan = buildDependencyAwareWorkPlan({
            phases: timeEstimate.phases,
            existingWorkPlan: aiResult.workPlan || [],
            schedule: timeEstimate.schedule,
        });

        const clientBudgetNum = Number(clientBudget) || 0;
        const isOverBudget    = clientBudgetNum > 0 && grandTotal > clientBudgetNum;
        const budgetGap       = isOverBudget ? grandTotal - clientBudgetNum : 0;

        // ── Find nearby workers (skill + city match) ─────────────────────────
        const skillNames    = skillBlocks.map(b=>String(b?.skill || '').trim()).filter(Boolean);
        const cityNorm      = normCity(city);
        const localityNorm  = normCity(localityInput || '');
        const allWorkers    = await User.find({
            role: 'worker',
            verificationStatus: 'approved',
            availability: true,
        }).limit(300).select('name karigarId photo overallExperience points skills mobile phoneType address availability');

        const workerIds = allWorkers.map((w) => w._id);
        const ratingRows = workerIds.length
            ? await Rating.aggregate([
                { $match: { worker: { $in: workerIds } } },
                { $group: { _id: '$worker', avgStars: { $avg: '$stars' }, ratingCount: { $sum: 1 } } },
            ])
            : [];
        const ratingMap = new Map(
            ratingRows.map((row) => [String(row._id), {
                avgStars: Number(row.avgStars || 0),
                ratingCount: Number(row.ratingCount || 0),
            }])
        );

        const normalizedSkillNames = skillNames.map((s) => normalizeSkillKey(s)).filter(Boolean);
        const scoredWorkers = allWorkers.map((w) => {
            const workerId = String(w._id);
            const stats = ratingMap.get(workerId) || { avgStars: 0, ratingCount: 0 };
            const workerSkillNames = Array.isArray(w.skills)
                ? w.skills.map((s) => normalizeSkillKey(s?.name || s || '')).filter(Boolean)
                : [];
            const matchedSkills = normalizedSkillNames.filter((skill) => workerSkillNames.includes(skill));

            const workerCityNorm = normCity(w.address?.city || '');
            const workerLocalityNorm = normCity(w.address?.locality || '');
            const cityMatch = cityNorm ? workerCityNorm.includes(cityNorm) : false;
            const localityMatch = localityNorm ? workerLocalityNorm.includes(localityNorm) : false;
            const availabilityBoost = w.availability === false ? 0 : 15;

            const skillScore = matchedSkills.length > 0 ? matchedSkills.length * 18 : 0;
            const score =
                (cityMatch ? 60 : 0) +
                (localityMatch ? 20 : 0) +
                (stats.avgStars * 25) +
                (Math.min(500, Number(w.points || 0)) / 25) +
                skillScore +
                availabilityBoost;

            const matchReasons = [
                matchedSkills.length ? `${matchedSkills.length} skill match${matchedSkills.length > 1 ? 'es' : ''}` : '',
                cityMatch ? 'city match' : '',
                localityMatch ? 'locality match' : '',
                stats.avgStars > 0 ? `${stats.avgStars.toFixed(1)} rating` : '',
            ].filter(Boolean);

            return {
                worker: w,
                meta: {
                    ...stats,
                    matchedSkills,
                    matchReasons,
                    score,
                },
            };
        });

        scoredWorkers.sort((a, b) => b.meta.score - a.meta.score);

        // Ensure coverage across all required skills before filling remaining slots.
        const selected = [];
        const selectedIds = new Set();
        for (const skill of normalizedSkillNames) {
            const found = scoredWorkers.find((entry) => !selectedIds.has(String(entry.worker._id)) && entry.meta.matchedSkills.includes(skill));
            if (!found) continue;
            selected.push(found);
            selectedIds.add(String(found.worker._id));
        }
        for (const entry of scoredWorkers) {
            if (selected.length >= 12) break;
            const key = String(entry.worker._id);
            if (selectedIds.has(key)) continue;
            selected.push(entry);
            selectedIds.add(key);
        }
        if (!selected.length) {
            console.warn('[AI REPORT] No worker candidates matched after normalized scoring', {
                city,
                locality: localityInput,
                requestedSkills: normalizedSkillNames,
                workerCount: allWorkers.length,
            });
        }
        const topWorkers = selected.map((entry) => formatWorker(entry.worker, entry.meta));
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
            locality: localityInput,
            urgent: !!isUrgent,
            durationDays:         aiResult.durationDays     || 1,
            jobDate,
            jobStartTime,
            jobEndTime,
            jobEndDate,
            jobEndDay,
            festivalName: festival,
            demandMultipliers,
            demandFactor: demandMultiplier,
            scopeQuantity,
            isAIEstimate:         true,
            skillBlocks,
            budgetBreakdown:      budgetResult,
            breakdownMode,
            labourConfidence,
            labourTotal:          labourTotalAdjusted,
            labourTotalUnadjusted: labourTotal,
            projectDays:          projectDays,
            isMultiDayProject:    isMultiDay,
            materialsBreakdown: normalizedMaterialsBreakdown,
            equipmentBreakdown,
            requiredMaterialsBreakdown: finalMaterialsSplit.requiredItems,
            optionalMaterialsBreakdown: finalMaterialsSplit.optionalItems,
            requiredEquipmentBreakdown: splitEquipment.requiredItems,
            optionalEquipmentBreakdown: splitEquipment.optionalItems,
            materialsTotal: includeMaterials ? sumEstimatedCost(normalizedMaterialsBreakdown) : 0,
            equipmentTotal,
            requiredMaterialsTotal,
            optionalMaterialsTotal,
            requiredEquipmentTotal,
            optionalEquipmentTotal,
            combinedTotal,
            grandTotal,
            includeMaterialCost: includeMaterials,
            includeEquipmentCost: includeEquipment,
            includeTravelCost: includeTravel,
            workerTravelCost,
            ownedMaterials: ownedMaterialList,
            ownedEquipment: ownedEquipmentList,
            excludedMaterials: filteredMaterials.excludedItems,
            excludedEquipment: filteredEquipment.excludedItems,
            localMarketInsight: {
                ...marketInsight,
                marketplaceCoverage,
            },
            priceReasoning: [
                ...priceReasoning,
                isMultiDay && demandMultipliers.dayType !== 'weekday' ? `Multi-day project (${projectDays} days): Holiday surcharge waived (cannot complete in single day)` : '',
            ].filter(Boolean),
            costSavingSuggestions,
            bestCaseTotal: projectSummary.bestCase,
            expectedTotal: projectSummary.expected,
            worstCaseTotal: projectSummary.worstCase,
            scenarioNarratives,
            negotiationRange,
            clientBudget:         clientBudgetNum,
            isOverBudget,
            budgetGap,
            budgetAdvice:         aiResult.budgetAdvice     || '',
            workPlan,
            timeEstimate,
            expectedOutcome:      aiResult.expectedOutcome  || [],
            colourAndStyleAdvice: aiResult.colourAndStyleAdvice || '',
            designSuggestions:    aiResult.designSuggestions   || [],
            improvementIdeas:     aiResult.improvementIdeas    || [],
            imageFindings:        imageUploaded ? (aiResult.imageFindings||[]) : [],
            imageUploaded,
            warnings:             aiResult.warnings           || [],
            visualizationDescription: aiResult.visualizationDescription || '',
            topWorkers,
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

        if (groqFallbackUsed) {
            report.warnings = Array.isArray(report.warnings) ? report.warnings.filter(Boolean) : [];
        }

        if (selectedLanguage !== 'en') {
            const translated = await translateAdvisorReport(report, selectedLanguage);
            report = {
                ...translated,
                language: report.language,
            };
        }

        report.durationDays = report.timeEstimate?.totalDays || report.durationDays;

        return res.status(200).json(report);
    } catch (err) {
        console.error('generateAdvisorReport error:', err);
        const fallbackScopeQty = extractScopeQuantity({ workDescription: workDescriptionEn || workDescription, answers: answersEn || answers });
        const fallbackInferred = normalizeSkillBlocksForContext({
            skillBlocks: [],
            workDescription: workDescriptionEn || workDescription,
            answers: answersEn || answers,
        });
        const fallbackSkillBlocks = applyScopeMultiplierToSkillBlocks(fallbackInferred, fallbackScopeQty);
        const budgetResult = await calculateStructuredBudget(fallbackSkillBlocks, city, !!urgent);
        const marketInsight = await buildMarketInsight({ city, skillBlocks: fallbackSkillBlocks, budgetResult });
        const fallbackSignals = deriveConditionSignals({ workDescription, answers });
        const fallbackAreaSqft = Math.max(
            120,
            Number(fallbackSignals?.totalPaintArea) || 0,
            Number(fallbackSignals?.wallAreaSqft) || 0,
            Number(fallbackSignals?.areaSqft) || 0,
            (Number(fallbackScopeQty) || 1) * 60
        );
        const synthesizedBreakdown = generateFullMaterialList({
            skills: fallbackSkillBlocks.map((b) => normalizeSkillKey(b?.skill)).filter(Boolean),
            areaSqft: fallbackAreaSqft,
            city,
            signals: fallbackSignals,
            ownedItems: [...ownedMaterialList, ...ownedEquipmentList],
        });

        const filteredFallbackMaterials = includeMaterials
            ? filterBreakdownByOwnership(synthesizedBreakdown.materials || [], ownedMaterialList)
            : { items: [], excludedItems: [] };
        const filteredFallbackEquipment = includeEquipment
            ? filterBreakdownByOwnership(synthesizedBreakdown.equipment || [], ownedEquipmentList)
            : { items: [], excludedItems: [] };

        const fallbackMaterials = await Promise.all(filteredFallbackMaterials.items.map((item) => estimateMaterialOrEquipmentItem({
            item,
            kind: 'material',
            signals: fallbackSignals,
            marketInsight,
            city,
            locality: localityInput,
        })));
        const fallbackEquipment = await Promise.all(filteredFallbackEquipment.items.map((item) => estimateMaterialOrEquipmentItem({
            item,
            kind: 'equipment',
            signals: fallbackSignals,
            marketInsight,
            city,
            locality: localityInput,
        })));

        const fallbackMaterialsTotal = includeMaterials ? sumEstimatedCost(fallbackMaterials) : 0;
        const fallbackEquipmentTotal = includeEquipment ? sumEstimatedCost(fallbackEquipment) : 0;
        const fallbackBreakdownMode = includeMaterials && includeEquipment
            ? 'full_project'
            : includeMaterials
                ? 'labour_plus_material'
                : 'labour_only';

        const labourConfidence = Math.round(
            ((budgetResult.breakdown || []).reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / Math.max(1, budgetResult.breakdown.length)) * 100
        );
        const labourMin = Number(budgetResult.totalMinEstimated) || Math.round(Number(budgetResult.totalEstimated) * 0.9);
        const labourMax = Number(budgetResult.totalMaxEstimated) || Math.round(Number(budgetResult.totalEstimated) * 1.15);
        const fallbackDemandMultiplier = demandMultipliers.finalMultiplier || 1.0;
        const fallbackLabourExpected = budgetResult.totalEstimated * fallbackDemandMultiplier;
        const fallbackCombinedTotal = fallbackLabourExpected + fallbackMaterialsTotal + fallbackEquipmentTotal + workerTravelCost;
        const fallbackLabourMin = labourMin * fallbackDemandMultiplier;
        const fallbackLabourMax = labourMax * fallbackDemandMultiplier;
        const projectSummary = buildProjectSummary({
            labourMin: fallbackLabourMin,
            labourExpected: fallbackLabourExpected,
            labourMax: fallbackLabourMax,
            materialsRequired: fallbackMaterialsTotal,
            materialsOptional: 0,
            equipmentRequired: fallbackEquipmentTotal,
            equipmentOptional: 0,
        });
        const fallbackPriceReasoning = await buildPriceReasoning({
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
        });

        return res.status(200).json({
            jobTitle: workDescription?.slice(0, 60) || 'Home Service Work',
            problemSummary: 'Unable to generate full advisory at the moment.',
            city,
            locality: localityInput,
            urgent: !!urgent,
            jobDate,
            jobStartTime,
            jobEndTime,
            jobEndDate,
            jobEndDay,
            festivalName: demandMultipliers.festivalName || '',
            demandMultipliers,
            durationDays: 1,
            isAIEstimate: true,
            skillBlocks: fallbackSkillBlocks,
            budgetBreakdown: budgetResult,
            breakdownMode: fallbackBreakdownMode,
            labourConfidence,
            labourTotal: fallbackLabourExpected,
            materialsBreakdown: fallbackMaterials,
            equipmentBreakdown: fallbackEquipment,
            materialsTotal: fallbackMaterialsTotal,
            equipmentTotal: fallbackEquipmentTotal,
            combinedTotal: fallbackCombinedTotal,
            grandTotal: fallbackCombinedTotal,
            includeTravelCost: includeTravel,
            workerTravelCost,
            priceReasoning: fallbackPriceReasoning,
            costSavingSuggestions: buildCostSavingSuggestions({
                signals: fallbackSignals,
                skillBlocks: fallbackSkillBlocks,
                workDescription,
                includeMaterials,
                includeEquipment,
                includeTravelCost: includeTravel,
                marketInsight,
                city,
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
            warnings: [],
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
