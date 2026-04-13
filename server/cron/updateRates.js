/**
 * Weekly Rate Update Cron Job
 * 
 * Recalculates market rates (p50/p75/p90), locality factors, and demand snapshots
 * from completed jobs with captured finalPaidPrice and actualHours.
 * 
 * Triggered weekly (e.g., Sunday 2 AM UTC)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Job = require('../models/jobModel');
const User = require('../models/userModel');
const MarketRate = require('../models/marketRateModel');
const LocalityFactor = require('../models/localityFactorModel');
const DemandSnapshot = require('../models/demandSnapshotModel');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/karigarconnect';

// Normalize city name to key
const normalizeCityKey = (city) => {
    if (!city) return null;
    return String(city || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/capital/i, '')
        .replace(/national/i, '');
};

// Normalize skill to key
const normalizeSkillKey = (skill) => {
    if (!skill) return 'other';
    return String(skill || '')
        .toLowerCase()
        .trim()
        .replace(/\s*\/\s*/g, '_')
        .replace(/[^\w_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
};

/**
 * Calculate percentiles from an array of values
 */
function calculatePercentiles(values) {
    if (!values || values.length === 0) {
        return { p50: 0, p75: 0, p90: 0, mean: 0, min: 0, max: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    
    const percentile = (arr, p) => {
        const index = Math.ceil((p / 100) * arr.length) - 1;
        return arr[Math.max(0, index)];
    };
    
    return {
        p50: percentile(sorted, 50),
        p75: percentile(sorted, 75),
        p90: percentile(sorted, 90),
        mean: Math.round(mean),
        min: sorted[0],
        max: sorted[sorted.length - 1],
    };
}

/**
 * Remove outliers using interquartile range (IQR) method
 */
function removeOutliers(values) {
    if (values.length < 4) return values;
    
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return sorted.filter(v => v >= lowerBound && v <= upperBound);
}

/**
 * Pipeline 1: Recalculate market rates
 */
async function updateMarketRates() {
    console.log('[\n📊 MARKET RATES] Starting calculation...');
    
    try {
        // Fetch completed jobs with pricing metadata
        const completedJobs = await Job.find({
            status: 'completed',
            'pricingMeta.finalPaidPrice': { $gt: 0 },
            'pricingMeta.capturedAt': { $exists: true },
        }).select('skills location pricingMeta').lean();
        
        console.log(`Found ${completedJobs.length} completed jobs with pricing data`);
        
        // Group by (skillKey, cityKey)
        const jobsBySkillCity = {};
        completedJobs.forEach(job => {
            const skill = job.skills?.[0] || 'other';
            const skillKey = normalizeSkillKey(skill);
            const city = job.location?.city || 'unknown';
            const cityKey = normalizeCityKey(city);
            
            const key = `${skillKey}|${cityKey}`;
            if (!jobsBySkillCity[key]) {
                jobsBySkillCity[key] = {
                    skillKey,
                    cityKey,
                    prices: [],
                    hours: [],
                    dataPoints: 0,
                };
            }
            
            if (job.pricingMeta?.finalPaidPrice > 0) {
                jobsBySkillCity[key].prices.push(job.pricingMeta.finalPaidPrice);
            }
            if (job.pricingMeta?.actualHours > 0) {
                jobsBySkillCity[key].hours.push(job.pricingMeta.actualHours);
            }
            jobsBySkillCity[key].dataPoints++;
        });
        
        // Calculate and upsert market rates
        let marketRateUpdates = 0;
        for (const [key, data] of Object.entries(jobsBySkillCity)) {
            if (data.prices.length < 3) {
                console.log(`  ⏭️  Skipping ${key} (${data.prices.length} prices, need >= 3)`);
                continue;
            }
            
            // Remove outliers
            const cleanedPrices = removeOutliers(data.prices);
            const cleanedHours = removeOutliers(data.hours);
            
            const percentiles = calculatePercentiles(cleanedPrices);
            const avgHours = cleanedHours.length > 0
                ? Math.round(cleanedHours.reduce((s, h) => s + h, 0) / cleanedHours.length * 100) / 100
                : 8;
            
            // Confidence based on data points
            let confidence = 0.5;
            if (cleanedPrices.length >= 100) confidence = 0.95;
            else if (cleanedPrices.length >= 50) confidence = 0.85;
            else if (cleanedPrices.length >= 20) confidence = 0.75;
            else if (cleanedPrices.length >= 10) confidence = 0.65;
            else confidence = 0.50;
            
            // Upsert market rate
            await MarketRate.findOneAndUpdate(
                { skillKey: data.skillKey, cityKey: data.cityKey },
                {
                    skillKey: data.skillKey,
                    cityKey: data.cityKey,
                    p50: Math.round(percentiles.p50),
                    p75: Math.round(percentiles.p75),
                    p90: Math.round(percentiles.p90),
                    avgHours,
                    dataPoints: cleanedPrices.length,
                    confidence,
                    isActive: true,
                    lastUpdated: new Date(),
                },
                { upsert: true, new: true }
            );
            
            marketRateUpdates++;
            console.log(`  ✅ ${key}: p50=${percentiles.p50}, p75=${percentiles.p75}, p90=${percentiles.p90} (${cleanedPrices.length} data points, conf=${confidence})`);
        }
        
        console.log(`\n✅ Market rates updated: ${marketRateUpdates} skill/city combinations\n]`);
        return marketRateUpdates;
    } catch (err) {
        console.error('updateMarketRates error:', err.message);
        throw err;
    }
}

/**
 * Pipeline 2: Recalculate locality factors
 */
async function updateLocalityFactors() {
    console.log('[\n🏘️  LOCALITY FACTORS] Starting calculation...');
    
    try {
        // Group jobs by (cityKey, locality) and (cityKey, overall)
        const localityData = {};
        
        const completedJobs = await Job.find({
            status: 'completed',
            'pricingMeta.finalPaidPrice': { $gt: 0 },
        }).select('location pricingMeta').lean();
        
        completedJobs.forEach(job => {
            const city = job.location?.city || 'unknown';
            const cityKey = normalizeCityKey(city);
            const locality = job.location?.locality || 'general';
            const price = job.pricingMeta?.finalPaidPrice || 0;
            
            // City-wide average
            const cityKeyOnly = `${cityKey}|general`;
            if (!localityData[cityKeyOnly]) {
                localityData[cityKeyOnly] = { prices: [], cityKey, locality: 'general' };
            }
            localityData[cityKeyOnly].prices.push(price);
            
            // Locality-specific
            if (locality !== 'general') {
                const localityKey = `${cityKey}|${locality}`;
                if (!localityData[localityKey]) {
                    localityData[localityKey] = { prices: [], cityKey, locality };
                }
                localityData[localityKey].prices.push(price);
            }
        });
        
        // Calculate multipliers
        let factorUpdates = 0;
        for (const [key, data] of Object.entries(localityData)) {
            if (data.prices.length < 5) continue;
            
            const avg = data.prices.reduce((s, p) => s + p, 0) / data.prices.length;
            
            // For "general", use as baseline (multiplier = 1.0)
            // For specific localities, calculate relative to city average
            let multiplier = 1.0;
            if (data.locality !== 'general') {
                const cityAvg = localityData[`${data.cityKey}|general`]?.prices
                    .reduce((s, p) => s + p, 0) / localityData[`${data.cityKey}|general`].prices.length || avg;
                multiplier = Math.round((avg / cityAvg) * 100) / 100;
            }
            
            // Clamp to reasonable range
            multiplier = Math.max(0.5, Math.min(2.0, multiplier));
            
            await LocalityFactor.findOneAndUpdate(
                { cityKey: data.cityKey, locality: data.locality },
                {
                    cityKey: data.cityKey,
                    locality: data.locality,
                    localityKey: data.locality.toLowerCase().replace(/\s+/g, ''),
                    multiplier,
                    dataPoints: data.prices.length,
                    confidence: Math.min(0.95, Math.max(0.5, data.prices.length / 100)),
                    isActive: true,
                    lastUpdated: new Date(),
                },
                { upsert: true, new: true }
            );
            
            factorUpdates++;
            console.log(`  ✅ ${data.cityKey}/${data.locality}: ${multiplier}x (${data.prices.length} jobs)`);
        }
        
        console.log(`\n✅ Locality factors updated: ${factorUpdates} factors\n]`);
        return factorUpdates;
    } catch (err) {
        console.error('updateLocalityFactors error:', err.message);
        throw err;
    }
}

/**
 * Pipeline 3: Snapshot current demand-supply ratios
 */
async function captureDemandsupplySnapshot() {
    console.log('[\n📈 DEMAND-SUPPLY SNAPSHOT] Starting capture...');
    
    try {
        // Find active jobs
        const activeJobs = await Job.find({
            status: { $in: ['open', 'assigned', 'in_progress'] },
        }).select('skills location').lean();
        
        // Find active workers (by recent activity — last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const activeWorkers = await User.find(
            { role: 'worker', lastActive: { $gte: thirtyDaysAgo } }
        ).select('skills address').lean();
        
        // Group by (skillKey, cityKey)
        const demandBySkillCity = {};
        const supplyBySkillCity = {};
        
        activeJobs.forEach(job => {
            (job.skills || []).forEach(skill => {
                const skillKey = normalizeSkillKey(skill);
                const cityKey = normalizeCityKey(job.location?.city || 'unknown');
                const key = `${skillKey}|${cityKey}`;
                demandBySkillCity[key] = (demandBySkillCity[key] || 0) + 1;
            });
        });
        
        activeWorkers.forEach(worker => {
            (worker.skills || []).forEach(skillObj => {
                const skillKey = normalizeSkillKey(skillObj.name || skillObj);
                const cityKey = normalizeCityKey(worker.address?.city || 'unknown');
                const key = `${skillKey}|${cityKey}`;
                supplyBySkillCity[key] = (supplyBySkillCity[key] || 0) + 1;
            });
        });
        
        // Calculate ratios and upsert
        let snapshots = 0;
        const allKeys = new Set([...Object.keys(demandBySkillCity), ...Object.keys(supplyBySkillCity)]);
        
        for (const key of allKeys) {
            const [skillKey, cityKey] = key.split('|');
            const activeJobs = demandBySkillCity[key] || 0;
            const activeWorkers = supplyBySkillCity[key] || 0;
            const ratio = activeWorkers > 0 ? activeJobs / activeWorkers : 0;
            
            await DemandSnapshot.create({
                skillKey,
                cityKey,
                activeJobs,
                activeWorkers,
                ratio: Math.round(ratio * 100) / 100,
                capturedAt: new Date(),
            });
            
            snapshots++;
            console.log(`  📸 ${key}: ${activeJobs} jobs / ${activeWorkers} workers = ${ratio.toFixed(2)}x`);
        }
        
        console.log(`\n✅ Demand snapshots captured: ${snapshots} skill/city combinations\n]`);
        return snapshots;
    } catch (err) {
        console.error('captureDemandsupplySnapshot error:', err.message);
        throw err;
    }
}

/**
 * Main: Run all pipelines
 */
async function runWeeklyUpdate() {
    console.log('\n' + '═'.repeat(80));
    console.log('🔄 WEEKLY RATE UPDATE - START');
    console.log('═'.repeat(80) + '\n');
    
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        const startTime = Date.now();
        
        const marketRateUpdates = await updateMarketRates();
        const localityFactorUpdates = await updateLocalityFactors();
        const demandSnapshotUpdates = await captureDemandsupplySnapshot();
        
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        console.log('\n' + '═'.repeat(80));
        console.log('✅ WEEKLY RATE UPDATE - COMPLETE');
        console.log('═'.repeat(80));
        console.log(`Market Rates:        ${marketRateUpdates} updated`);
        console.log(`Locality Factors:    ${localityFactorUpdates} updated`);
        console.log(`Demand Snapshots:    ${demandSnapshotUpdates} recorded`);
        console.log(`Duration:            ${duration}s`);
        console.log(`Timestamp:           ${new Date().toISOString()}`);
        console.log('═'.repeat(80) + '\n');
        
    } catch (err) {
        console.error('\n❌ WEEKLY RATE UPDATE - FAILED');
        console.error(err);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

// If run directly
if (require.main === module) {
    runWeeklyUpdate();
}

module.exports = { runWeeklyUpdate };
