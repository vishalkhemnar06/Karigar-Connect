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

const firstPositiveNumber = (...values) => {
    for (const value of values) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
};

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
const fetchPrice = async (skillKey, cityKey, locality) => {
    skillKey = normalizeSkillKey(skillKey);
    cityKey = normalizeCityKey(cityKey);
    
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
    let baseRate = await fetchBaseRate(skillKey, cityKey);
    if (!baseRate) {
        // If exact city not found, try nearby
        const nearbyBaseRates = await BaseRate.find({
            skillKey: skillKey,
            isActive: true,
        }).limit(5);
        
        if (nearbyBaseRates.length) {
            baseRate = nearbyBaseRates[0];
        }
    }
    
    if (baseRate) {
        // Convert base-rate rows to resilient platform estimates.
        // Some CSV rows only have per-visit or platform-cost columns.
        const localMin = firstPositiveNumber(
            baseRate.localDayMin,
            firstPositiveNumber(baseRate.localHourlyMin) * 8,
            baseRate.platformDayMin,
            firstPositiveNumber(baseRate.platformHourlyMin) * 8,
            baseRate.platformCostMin
        );
        const localMax = firstPositiveNumber(
            baseRate.localDayMax,
            firstPositiveNumber(baseRate.localHourlyMax) * 8,
            baseRate.platformDayMax,
            firstPositiveNumber(baseRate.platformHourlyMax) * 8,
            baseRate.platformCostMax,
            localMin
        );
        const localMid = firstPositiveNumber(
            (localMin > 0 && localMax > 0) ? (localMin + localMax) / 2 : 0,
            baseRate.platformCostMin,
            localMin,
            1000
        );
        const p75 = firstPositiveNumber(baseRate.platformCostMax, localMax, localMid, 1200);
        const p90 = firstPositiveNumber(baseRate.platformCostMax, localMax, p75, 1500);
        
        return {
            source: 'base_rate',
            cityKey,
            skillKey,
            p50: localMid,
            p75,
            p90,
            avgHours: 8,  // default assumption
            confidence: baseRate.confidence || 0.5,
            dataPoints: 0,  // bootstrap has no job data
        };
    }
    
    // Ultimate fallback: generic price
    return {
        source: 'fallback',
        cityKey,
        skillKey,
        p50: 1000,
        p75: 1500,
        p90: 2000,
        avgHours: 8,
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
    
    return {
        min: Math.round(p50 * totalMultiplier * 0.9),    // 10% below expected
        expected: Math.round(p75 * totalMultiplier),
        max: Math.round(p90 * totalMultiplier * 1.1),    // 10% above p90
        avgHours,
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
}) => {
    try {
        // Fetch base price
        const priceData = await fetchPrice(skillKey, cityKey, locality);
        
        // Get multipliers
        const localityMult = await getLocalityMultiplier(normalizeCityKey(cityKey), locality);
        const demandMult = await getDemandSupplyMultiplier(normalizeSkillKey(skillKey), normalizeCityKey(cityKey));
        
        // Calculate final range
        const finalPrice = await calculateFinalPrice(priceData, {
            localityMultiplier: localityMult,
            demandSupplyMultiplier: demandMult,
            urgency: urgent,
            complexity,
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
const calculateStructuredBudget = async (skillBlocks = [], city = '', urgent = false) => {
    try {
        const breakdown = [];
        let subtotal = 0;
        let subtotalMin = 0;
        let subtotalMax = 0;
        
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
            }
            
            const priceData = estimateResult.priceRange;
            const ratePerDay = priceData.expected;
            const ratePerHour = Math.round(ratePerDay / 8);
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
            
            // Hours from AI block or default
            const hours = Math.max(1, Number(block.hours || priceData.avgHours || 8));
            
            // Worker count from AI block
            const count = Math.max(1, Math.round(block.count || 1));
            
            // Cost per worker
            const perWorkerCost = hours <= 8
                ? Math.round(ratePerDay * (hours / 8))
                : Math.round(ratePerDay * Math.ceil(hours / 8));
            const perWorkerMinCost = hours <= 8
                ? Math.round(priceData.min * (hours / 8))
                : Math.round(priceData.min * Math.ceil(hours / 8));
            const perWorkerMaxCost = hours <= 8
                ? Math.round(priceData.max * (hours / 8))
                : Math.round(priceData.max * Math.ceil(hours / 8));
            const ratePerVisit = perWorkerCost;
            
            const skillSubtotal = perWorkerCost * count;
            const skillSubtotalMin = perWorkerMinCost * count;
            const skillSubtotalMax = perWorkerMaxCost * count;
            subtotal += skillSubtotal;
            subtotalMin += skillSubtotalMin;
            subtotalMax += skillSubtotalMax;
            
            breakdown.push({
                skill: skillKey,
                displaySkill: block.skill,
                tier: 'dynamic',  // Using market-driven rates
                complexity: block.complexity || 'normal',
                count,
                hours,
                ratePerDay,
                ratePerHour,
                ratePerVisit,
                perWorkerCost,
                perWorkerMinCost,
                perWorkerMaxCost,
                subtotal: skillSubtotal,
                subtotalMin: skillSubtotalMin,
                subtotalMax: skillSubtotalMax,
                rateRange: {
                    min: priceData.min,
                    max: priceData.max,
                },
                priceSource: estimateResult.source,
                confidence: adjustedConfidence,
            });
        }
        
        const urgencyMult = urgent ? 1.2 : 1.0;
        const totalMinEstimated = Math.round(subtotalMin * urgencyMult);
        const totalMaxEstimated = Math.round(subtotalMax * urgencyMult);
        const totalEstimated = Math.round(subtotal * urgencyMult);
        const totalWorkers = breakdown.reduce((s, b) => s + b.count, 0);
        const durationDays = Math.max(1, Math.ceil(
            Math.max(...breakdown.map(b => b.hours || 8)) / 8
        ));
        const totalHours = breakdown.reduce((s, b) => s + ((Number(b.hours) || 0) * (Number(b.count) || 0)), 0);
        
        return {
            breakdown,
            subtotal,
            subtotalMin,
            subtotalMax,
            urgent,
            urgencyMult,
            totalMinEstimated,
            totalMaxEstimated,
            totalEstimated,
            totalWorkers,
            totalHours,
            durationDays,
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
