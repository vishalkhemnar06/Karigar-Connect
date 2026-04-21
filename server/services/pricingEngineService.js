/**
 * Pricing Engine Service
 * 
 * Handles:
 * 1. Price fetching with fallback chain (market rates → nearby city → base rates)
 * 2. Multiplier calculations (locality, demand-supply, urgency, complexity)
 * 3. Price range generation (min/expected/max)
 * 4. Confidence scoring
 */

const BaseRate = require('../models/baseRateModel');
const MarketRate = require('../models/marketRateModel');
const LocalityFactor = require('../models/localityFactorModel');
const DemandSnapshot = require('../models/demandSnapshotModel');
const Job = require('../models/jobModel');

// Normalized skill-to-key mapping
const SKILL_KEY_MAP = {
    'painter': 'painter',
    'plumber': 'plumber',
    'electrician': 'electrician',
    'carpenter': 'carpenter',
    'mason': 'mason',
    'masonry': 'mason',
    'bricklayer': 'mason',
    'tiler': 'tiler',
    'welder': 'welder',
    'ac_technician': 'ac_technician',
    'ac technician': 'ac_technician',
    'deep_cleaning': 'deep_cleaning',
    'cleaner': 'deep_cleaning',
    'cleaning': 'deep_cleaning',
    'housekeeping': 'deep_cleaning',
    'pest_control': 'pest_control',
    'handyman': 'handyman',
    'general_helper': 'handyman',
    'waterproofing': 'waterproofing',
    'false_ceiling': 'false_ceiling',
    'interior_designer': 'interior_designer',
    'roofer': 'roofer',
    'flooring': 'flooring',
    'furniture_assembler': 'furniture_assembler',
    'geyser_repair': 'geyser_repair',
    'ro_service': 'ro_service',
    'washing_machine_repair': 'washing_machine_repair',
    'tv_repair': 'tv_repair',
    'mobile_repair': 'mobile_repair',
    'computer_repair': 'computer_repair',
    'sofa_cleaning': 'sofa_cleaning',
    'landscaping': 'landscaping',
    'gardener': 'landscaping',
    'security_guard': 'security_guard',
    'driver': 'driver',
    'chauffeur': 'driver',
    'packers_movers': 'packers_movers',
    'construction_labour': 'construction_labour',
    'other': 'other',
};

// Normalize city name to key
const normalizeCityKey = (city) => {
    if (!city) return null;
    return String(city || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '')
        .replace(/\(.*?\)/g, '')  // remove parenthetical regions
        .replace(/capital/i, '')
        .replace(/national/i, '');
};

// Normalize skill to key
const normalizeSkillKey = (skill) => {
    if (!skill) return 'other';
    const normalized = String(skill || '')
        .toLowerCase()
        .trim()
        .replace(/\s*\/\s*/g, '_')       // "mason / bricklayer" → "mason_bricklayer"
        .replace(/[^\w_]/g, '_')         // remove special chars
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');          // trim underscores
    
    return SKILL_KEY_MAP[normalized] || 'other';
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeBillingUnit = (value) => {
    const unit = String(value || '').trim().toLowerCase();
    if (['hour', 'hours', 'hr', 'hrs', 'hourly'].includes(unit)) return 'hour';
    if (['day', 'days', 'daily'].includes(unit)) return 'day';
    if (['visit', 'visits', 'job', 'task'].includes(unit)) return 'visit';
    return 'day';
};

const safeQuantity = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : 1;
};

const firstPositiveNumber = (...values) => {
    for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
};

const roundToNearestTen = (value) => Math.round((Number(value) || 0) / 10) * 10;

/**
 * Fetch base rate from CSV bootstrap
 */
const fetchBaseRate = async (skillKey, cityKey) => {
    try {
        const rate = await BaseRate.findOne({
            skillKey: skillKey,
            cityKey: cityKey,
            isActive: true,
        }).sort({ effectiveFrom: -1 }).limit(1);
        
        return rate;
    } catch (err) {
        console.error('fetchBaseRate error:', err.message);
        return null;
    }
};

/**
 * Fetch market rate (derived from completed jobs)
 */
const fetchMarketRate = async (skillKey, cityKey) => {
    try {
        const rate = await MarketRate.findOne({
            skillKey: skillKey,
            cityKey: cityKey,
            isActive: true,
        });
        
        return rate;
    } catch (err) {
        console.error('fetchMarketRate error:', err.message);
        return null;
    }
};

/**
 * Fetch nearby city market rate (fallback)
 */
const fetchNearbyMarketRate = async (skillKey, cityKey) => {
    // Define nearby cities mapping
    const nearbyMap = {
        'mumbai': ['thane', 'navimumbai', 'pune', 'bangalore'],
        'delhi': ['noida', 'gurgaon', 'faridabad', 'bangalore'],
        'bangalore': ['hyderabad', 'pune', 'delhi', 'mumbai'],
        'pune': ['mumbai', 'bangalore', 'delhi'],
        'hyderabad': ['bangalore', 'mumbai', 'delhi'],
    };
    
    const nearby = nearbyMap[cityKey] || [];
    
    for (const nearCity of nearby) {
        const rate = await fetchMarketRate(skillKey, nearCity);
        if (rate && rate.p50 > 0) {
            return rate;
        }
    }
    
    return null;
};

/**
 * Get locality multiplier
 */
const getLocalityMultiplier = async (cityKey, locality) => {
    if (!locality) return 1.0;
    
    try {
        const factor = await LocalityFactor.findOne({
            cityKey: cityKey,
            locality: new RegExp(locality, 'i'),
            isActive: true,
        });
        
        return factor ? factor.multiplier : 1.0;
    } catch (err) {
        console.error('getLocalityMultiplier error:', err.message);
        return 1.0;
    }
};

/**
 * Get demand-supply multiplier
 */
const getDemandSupplyMultiplier = async (skillKey, cityKey) => {
    try {
        const snapshot = await DemandSnapshot.findOne({
            skillKey: skillKey,
            cityKey: cityKey,
        }).sort({ capturedAt: -1 }).limit(1);
        
        if (!snapshot || snapshot.ratio <= 0) return 1.0;
        
        // Clamp ratio to reasonable bounds and convert to multiplier
        // ratio = 1.0 → normal pricing (1.0x)
        // ratio = 1.5 → high demand (1.15x)
        // ratio = 0.7 → low demand (0.95x)
        const clampedRatio = Math.max(0.5, Math.min(2.0, snapshot.ratio));
        const multiplier = 0.9 + (clampedRatio - 0.5) * 0.2;  // map 0.5-2.0 → 0.9-1.2
        
        return multiplier;
    } catch (err) {
        console.error('getDemandSupplyMultiplier error:', err.message);
        return 1.0;
    }
};

/**
 * Main: Fetch price with fallback strategy
 * Returns: { source, basePrice, p50, p75, p90 }
 */
const fetchPrice = async (skillKey, cityKey, locality, options = {}) => {
    const { preferBaseRate = false } = options;
    skillKey = normalizeSkillKey(skillKey);
    cityKey = normalizeCityKey(cityKey);

    const resolveBaseRatePrice = async () => {
        let baseRate = await fetchBaseRate(skillKey, cityKey);
        if (!baseRate) {
            const nearbyBaseRates = await BaseRate.find({
                skillKey: skillKey,
                isActive: true,
            }).limit(5);

            if (nearbyBaseRates.length) {
                baseRate = nearbyBaseRates[0];
            }
        }

        if (!baseRate) return null;

        // Build local market daily rates as primary baseline.
        // Platform cost columns can be useful as guardrails, but should not dominate
        // short-job expected prices for local service estimates.
        const localMin = firstPositiveNumber(
            baseRate.localDayMin,
            firstPositiveNumber(baseRate.localHourlyMin) * 8,
            baseRate.platformDayMin,
            firstPositiveNumber(baseRate.platformHourlyMin) * 8,
            800
        );
        const localMax = firstPositiveNumber(
            baseRate.localDayMax,
            firstPositiveNumber(baseRate.localHourlyMax) * 8,
            baseRate.platformDayMax,
            firstPositiveNumber(baseRate.platformHourlyMax) * 8,
            baseRate.platformCostMax,
            localMin
        );
        const localMid = firstPositiveNumber((localMin + localMax) / 2, localMin, 1000);
        const p50 = roundToNearestTen(localMid);
        const p75 = roundToNearestTen(firstPositiveNumber(localMax, localMid * 1.08, p50));
        const p90 = roundToNearestTen(firstPositiveNumber(localMax * 1.15, p75 * 1.1, p75));
        const hourlyMid = firstPositiveNumber(
            baseRate.localHourlyMin && baseRate.localHourlyMax
                ? (Number(baseRate.localHourlyMin) + Number(baseRate.localHourlyMax)) / 2
                : 0,
            p50 / 8,
            120
        );

        return {
            source: 'base_rate',
            cityKey,
            skillKey,
            p50,
            p75,
            p90,
            avgHours: 8,
            hourlyMid: roundToNearestTen(hourlyMid),
            confidence: baseRate.confidence || 0.5,
            dataPoints: 0,
        };
    };

    if (preferBaseRate) {
        const preferredBase = await resolveBaseRatePrice();
        if (preferredBase) return preferredBase;
    }
    
    // Step 1: Try market rates (best data)
    let marketRate = await fetchMarketRate(skillKey, cityKey);
    if (marketRate && marketRate.p50 > 0) {
        return {
            source: 'market_rate',
            cityKey,
            skillKey,
            p50: marketRate.p50,
            p75: marketRate.p75,
            p90: marketRate.p90,
            avgHours: marketRate.avgHours || 8,
            confidence: marketRate.confidence || 0.7,
            dataPoints: marketRate.dataPoints,
        };
    }
    
    // Step 2: Try nearby city market rates
    let nearbyRate = await fetchNearbyMarketRate(skillKey, cityKey);
    if (nearbyRate && nearbyRate.p50 > 0) {
        return {
            source: 'nearby_market_rate',
            cityKey: nearbyRate.cityKey,
            skillKey,
            p50: nearbyRate.p50,
            p75: nearbyRate.p75,
            p90: nearbyRate.p90,
            avgHours: nearbyRate.avgHours || 8,
            confidence: (nearbyRate.confidence || 0.7) * 0.85,  // reduce confidence for nearby
            dataPoints: nearbyRate.dataPoints,
        };
    }
    
    // Step 3: Fall back to base rates (CSV bootstrap)
    const fallbackBase = await resolveBaseRatePrice();
    if (fallbackBase) return fallbackBase;
    
    // Ultimate fallback: generic price
    return {
        source: 'fallback',
        cityKey,
        skillKey,
        p50: 1000,
        p75: 1500,
        p90: 2000,
        avgHours: 8,
        hourlyMid: 150,
        confidence: 0.3,
        dataPoints: 0,
    };
};

/**
 * Calculate final price with multipliers
 */
const calculateFinalPrice = async (priceData, multipliers = {}) => {
    const {
        p50, p75, p90, avgHours,
    } = priceData;
    
    const {
        localityMultiplier = 1.0,
        demandSupplyMultiplier = 1.0,
        urgency = false,
        complexity = 'normal',
        quantity = 1,
        unit = 'day',
    } = multipliers;
    
    // Complexity multipliers
    const complexityMap = {
        light: 0.8,
        normal: 1.0,
        heavy: 1.3,
    };
    const complexityFactor = complexityMap[complexity] || 1.0;
    
    // Urgency multiplier
    const urgencyFactor = urgency ? 1.2 : 1.0;
    
    // Apply all multipliers
    const totalMultiplier = localityMultiplier * demandSupplyMultiplier * complexityFactor * urgencyFactor;
    const billingUnit = normalizeBillingUnit(unit);
    const qty = safeQuantity(quantity);
    const hoursPerDay = Math.max(1, Number(avgHours) || 8);

    const toAmountForUnit = (dailyAmount) => {
        const safeDaily = Math.max(0, Number(dailyAmount) || 0);
        if (billingUnit === 'hour') return (safeDaily / hoursPerDay) * qty;
        if (billingUnit === 'visit') return safeDaily * qty;
        return safeDaily * qty;
    };

    const minDaily = p50 * totalMultiplier * 0.9;
    const expectedDaily = p75 * totalMultiplier;
    const maxDaily = p90 * totalMultiplier * 1.1;
    
    return {
        min: Math.round(toAmountForUnit(minDaily)),    // 10% below expected
        expected: Math.round(toAmountForUnit(expectedDaily)),
        max: Math.round(toAmountForUnit(maxDaily)),    // 10% above p90
        avgHours,
        quantity: qty,
        unit: billingUnit,
        multipliers: {
            locality: localityMultiplier,
            demandSupply: demandSupplyMultiplier,
            complexity: complexityFactor,
            urgency: urgencyFactor,
            total: totalMultiplier,
        },
    };
};

/**
 * Estimate price range for a job
 */
const estimatePrice = async ({
    skillKey,
    cityKey,
    locality = '',
    quantity = 1,
    unit = 'day',
    urgent = false,
    complexity = 'normal',
    preferBaseRate = false,
}) => {
    try {
        // Fetch base price
        const priceData = await fetchPrice(skillKey, cityKey, locality, { preferBaseRate });
        
        // Get multipliers
        const localityMult = await getLocalityMultiplier(normalizeCityKey(cityKey), locality);
        const demandMult = await getDemandSupplyMultiplier(normalizeSkillKey(skillKey), normalizeCityKey(cityKey));
        
        // Calculate final range
        const finalPrice = await calculateFinalPrice(priceData, {
            localityMultiplier: localityMult,
            demandSupplyMultiplier: demandMult,
            urgency: urgent,
            complexity,
            quantity,
            unit,
        });
        
        return {
            success: true,
            priceRange: finalPrice,
            priceData,
            confidence: priceData.confidence,
            source: priceData.source,
        };
    } catch (err) {
        console.error('estimatePrice error:', err.message);
        return {
            success: false,
            error: err.message,
        };
    }
};

/**
 * Calculate structured budget from AI skill blocks (backward compatible with rateTable)
 * Used by aiAssistantController to estimate prices with new engine while maintaining same output format
 */
const calculateStructuredBudget = async (skillBlocks = [], city = '', urgent = false, options = {}) => {
    const { preferBaseRate = false } = options;
    try {
        const breakdown = [];
        let subtotal = 0;
        let subtotalMin = 0;
        let subtotalMax = 0;
        let hourlyModelSubtotal = 0;
        let dailyModelSubtotal = 0;
        let visitModelSubtotal = 0;
        
        for (const block of skillBlocks) {
            const skillKey = normalizeSkillKey(block.skill);
            const cityKey = normalizeCityKey(city);
            
            // Use pricing engine for this skill/city
            const estimateResult = await estimatePrice({
                skillKey,
                cityKey,
                quantity: block.quantity || 1,
                unit: block.unit || 'day',
                // Apply urgency once at grand-total level to avoid double counting.
                urgent: false,
                complexity: block.complexity || 'normal',
                preferBaseRate,
            });
            
            if (!estimateResult.success) {
                console.warn(`Price estimation failed for ${block.skill}/${city}, using fallback`);
                // Fallback: use generic rate
                estimateResult.priceRange = {
                    min: 800,
                    expected: 1200,
                    max: 1600,
                    avgHours: block.hours || 8,
                };
                estimateResult.priceData = {
                    source: 'fallback',
                    confidence: 0.45,
                    hourlyMid: 150,
                };
                estimateResult.confidence = 0.45;
                estimateResult.source = 'fallback';
            }
            
            const priceData = estimateResult.priceRange;
            const ratePerDay = priceData.expected;
            const rawHourly = firstPositiveNumber(estimateResult.priceData?.hourlyMid, ratePerDay / 8, 120);
            const ratePerHour = roundToNearestTen(rawHourly);
            const sourceConfidence = Number(estimateResult.confidence || 0.55);
            const confidenceFloor = estimateResult.source === 'market_rate' || estimateResult.source === 'nearby_market_rate'
                ? 0.7
                : estimateResult.source === 'base_rate'
                    ? 0.72
                    : 0.55;
            const confidenceCeiling = estimateResult.source === 'market_rate'
                ? 0.9
                : estimateResult.source === 'nearby_market_rate'
                    ? 0.85
                    : estimateResult.source === 'base_rate'
                        ? 0.85
                        : 0.65;
            const adjustedConfidence = clamp(sourceConfidence + 0.22, confidenceFloor, confidenceCeiling);
            const urgencyFactor = urgent ? 1.2 : 1;
            
            // AI provides total hours for this skill block (not per worker)
            const hours = Math.max(1, Number(block.hours || priceData.avgHours || 8));
            
            // Worker count from AI block
            const count = Math.max(1, Math.round(block.count || 1));
            
            // Convert total skill-hours into per-worker billed hours.
            // This prevents under/over estimation when quantity-driven workloads adjust hours.
            const perWorkerHours = Math.max(0.5, hours / count);
            const minimumServiceCharge = ratePerDay * 0.6;
            const minimumServiceChargeMin = priceData.min * 0.6;
            const minimumServiceChargeMax = priceData.max * 0.6;

            const perWorkerHourlyModel = roundToNearestTen((ratePerHour * perWorkerHours) * urgencyFactor);
            const perWorkerDailyModel = roundToNearestTen((ratePerDay * Math.max(1, Math.ceil(perWorkerHours / 8))) * urgencyFactor);
            const perWorkerVisitModel = roundToNearestTen(Math.max(perWorkerHourlyModel, minimumServiceCharge * urgencyFactor));

            const perWorkerCostBase = perWorkerHours <= 8
                ? Math.max(ratePerHour * perWorkerHours, minimumServiceCharge)
                : ratePerDay * Math.ceil(perWorkerHours / 8);
            const perWorkerMinBase = perWorkerHours <= 8
                ? Math.max((priceData.min / 8) * perWorkerHours, minimumServiceChargeMin)
                : priceData.min * Math.ceil(perWorkerHours / 8);
            const perWorkerMaxBase = perWorkerHours <= 8
                ? Math.max((priceData.max / 8) * perWorkerHours, minimumServiceChargeMax)
                : priceData.max * Math.ceil(perWorkerHours / 8);

            const perWorkerCost = roundToNearestTen(perWorkerCostBase * urgencyFactor);
            const perWorkerMinCost = roundToNearestTen(perWorkerMinBase * urgencyFactor);
            const perWorkerMaxCost = roundToNearestTen(perWorkerMaxBase * urgencyFactor);
            const ratePerVisit = perWorkerCost;
            
            const skillSubtotal = perWorkerCost * count;
            const skillSubtotalMin = perWorkerMinCost * count;
            const skillSubtotalMax = perWorkerMaxCost * count;
            const skillHourlySubtotal = perWorkerHourlyModel * count;
            const skillDailySubtotal = perWorkerDailyModel * count;
            const skillVisitSubtotal = perWorkerVisitModel * count;
            subtotal += skillSubtotal;
            subtotalMin += skillSubtotalMin;
            subtotalMax += skillSubtotalMax;
            hourlyModelSubtotal += skillHourlySubtotal;
            dailyModelSubtotal += skillDailySubtotal;
            visitModelSubtotal += skillVisitSubtotal;
            
            breakdown.push({
                skill: skillKey,
                displaySkill: block.skill,
                tier: 'dynamic',  // Using market-driven rates
                complexity: block.complexity || 'normal',
                count,
                hours,
                sourceRatePerDayBase: ratePerDay,
                sourceRatePerHourBase: ratePerHour,
                sourceRatePerVisitBase: ratePerVisit,
                ratePerDay,
                ratePerHour,
                ratePerVisit,
                perWorkerCost,
                perWorkerMinCost,
                perWorkerMaxCost,
                perWorkerHourlyModel,
                perWorkerDailyModel,
                perWorkerVisitModel,
                subtotal: skillSubtotal,
                subtotalMin: skillSubtotalMin,
                subtotalMax: skillSubtotalMax,
                subtotalHourlyModel: skillHourlySubtotal,
                subtotalDailyModel: skillDailySubtotal,
                subtotalVisitModel: skillVisitSubtotal,
                rateRange: {
                    min: priceData.min,
                    max: priceData.max,
                },
                priceSource: estimateResult.source,
                confidence: adjustedConfidence,
                urgencyApplied: !!urgent,
            });
        }

        const distinctSkills = breakdown.length;
        const coordinationFactor = clamp(1 + Math.max(0, distinctSkills - 1) * 0.06, 1, 1.35);
        const handoffOverhead = Math.max(0, distinctSkills - 1) * 120;
        const baseExpected = Math.max(subtotal, visitModelSubtotal);
        let totalEstimated = Math.round((baseExpected * coordinationFactor) + handoffOverhead);
        const totalMinEstimated = Math.round(Math.max(subtotalMin, hourlyModelSubtotal * (1 + Math.max(0, distinctSkills - 1) * 0.02)));
        const totalMaxEstimated = Math.round(Math.max(subtotalMax, dailyModelSubtotal * coordinationFactor * 1.08));
        totalEstimated = Math.max(totalMinEstimated, Math.min(totalEstimated, totalMaxEstimated));
        const totalWorkers = breakdown.reduce((s, b) => s + b.count, 0);
        const durationDays = Math.max(1, Math.ceil(
            Math.max(...breakdown.map((b) => {
                const skillHours = Number(b.hours) || 8;
                const workerCount = Math.max(1, Number(b.count) || 1);
                return skillHours / (workerCount * 8);
            }))
        ));
        const totalHours = breakdown.reduce((s, b) => s + (Number(b.hours) || 0), 0);
        
        return {
            breakdown,
            subtotal,
            subtotalMin,
            subtotalMax,
            urgent,
            totalMinEstimated,
            totalMaxEstimated,
            totalEstimated,
            totalWorkers,
            totalHours,
            durationDays,
            pricingModels: {
                hourly: Math.round(hourlyModelSubtotal),
                daily: Math.round(dailyModelSubtotal),
                visit: Math.round(visitModelSubtotal),
                coordinationFactor: Number(coordinationFactor.toFixed(2)),
                handoffOverhead,
            },
            city,
            cityTier: 'dynamic',
            globalComplexity: 'normal',
            calculatedAt: new Date().toISOString(),
        };
    } catch (err) {
        console.error('calculateStructuredBudget error:', err.message);
        throw err;
    }
};

module.exports = {
    estimatePrice,
    fetchPrice,
    calculateFinalPrice,
    getLocalityMultiplier,
    getDemandSupplyMultiplier,
    normalizeSkillKey,
    normalizeCityKey,
    calculateStructuredBudget,
};
