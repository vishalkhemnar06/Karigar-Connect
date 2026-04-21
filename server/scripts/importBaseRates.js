/**
 * CSV Import Script
 * 
 * Imports karigar_rates.csv into MongoDB baseRates collection
 * Usage: node server/scripts/importBaseRates.js
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const csv = require('csv-parse/sync');
require('dotenv').config();

const BaseRate = require('../models/baseRateModel');

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

// Normalize skill name
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

// Parse boolean from various formats
const parseBoolean = (val) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'boolean') return val;
    const str = String(val).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'yes' || str === 'on';
};

// Parse number, return null if empty/invalid
const parseNumber = (val) => {
    if (val === null || val === undefined || val === '') return null;
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
};

// Parse date
const parseDate = (val) => {
    if (!val) return null;
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date;
};

async function importCSV() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');
        
        // Read CSV file
        const csvPath = path.join(__dirname, '../../karigar_rates.csv');
        console.log('Reading CSV from:', csvPath);
        
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }
        
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const records = csv.parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        
        console.log(`Parsed ${records.length} records from CSV`);
        
        // Transform CSV rows to documents
        const documents = records.map((row, idx) => {
            const skillKey = normalizeSkillKey(row.Skill || row.Skill_Key || '');
            const cityKey = normalizeCityKey(row.City || row.City_Key || '');
            
            if (!skillKey || !cityKey) {
                console.warn(`Skipping row ${idx}: missing skill or city`, row);
                return null;
            }
            
            return {
                skill: row.Skill || row.Skill_Key,
                skillKey: skillKey,
                city: row.City || row.City_Key,
                cityKey: cityKey,
                rateMode: (row.Rate_Mode || row.RateMode || 'mixed').toLowerCase(),
                unit: (row.Unit || 'day').toLowerCase(),
                currency: row.Currency || 'INR',
                
                // Hourly rates (nullable)
                localHourlyMin: parseNumber(row.Local_Hourly_Min_INR || row.Local_Hourly_Min || row.LocalHourlyMin),
                localHourlyMax: parseNumber(row.Local_Hourly_Max_INR || row.Local_Hourly_Max || row.LocalHourlyMax),
                platformHourlyMin: parseNumber(row.Platform_Hourly_Min_INR || row.Platform_Hourly_Min || row.PlatformHourlyMin),
                platformHourlyMax: parseNumber(row.Platform_Hourly_Max_INR || row.Platform_Hourly_Max || row.PlatformHourlyMax),
                
                // Day rates (nullable)
                localDayMin: parseNumber(row.Local_Day_Min_INR || row.Local_Day_Min || row.LocalDayMin),
                localDayMax: parseNumber(row.Local_Day_Max_INR || row.Local_Day_Max || row.LocalDayMax),
                platformDayMin: parseNumber(row.Platform_Day_Min_INR || row.Platform_Day_Min || row.PlatformDayMin),
                platformDayMax: parseNumber(row.Platform_Day_Max_INR || row.Platform_Day_Max || row.PlatformDayMax),
                
                // Cost ranges
                platformCostMin: parseNumber(row.Platform_Cost_Min_INR || row.Platform_Cost_Min || row.PlatformCostMin),
                platformCostMax: parseNumber(row.Platform_Cost_Max_INR || row.Platform_Cost_Max || row.PlatformCostMax),
                
                // Metadata
                source: row.Source || 'csv_import',
                confidence: parseNumber(row.Confidence) || 0.75,  // Default 75% confidence for CSV data
                
                effectiveFrom: parseDate(row.Effective_From) || new Date(2025, 0, 1),
                effectiveTo: parseDate(row.Effective_To),
                isActive: parseBoolean(row.Is_Active) !== false,  // Default to true
                
                // Audit
                importedAt: new Date(),
                importBatch: process.env.IMPORT_BATCH || 'initial',
            };
        }).filter(doc => doc !== null);
        
        console.log(`Preparing to insert ${documents.length} documents`);
        
        // Clear existing data (optional: set to false in production if you want to upsert)
        const shouldClear = process.env.CLEAR_EXISTING === 'true';
        if (shouldClear) {
            console.log('Clearing existing baseRates...');
            await BaseRate.deleteMany({});
        }
        
        // Insert with error handling
        const result = await BaseRate.insertMany(documents, {
            ordered: false,  // Continue on error
        });
        
        console.log(`✅ Successfully imported ${result.length} records`);
        console.log('Import complete!');
        
        // Summary statistics
        const summary = {
            total: documents.length,
            skills: new Set(documents.map(d => d.skillKey)).size,
            cities: new Set(documents.map(d => d.cityKey)).size,
            avgConfidence: (documents.reduce((sum, d) => sum + (d.confidence || 0.75), 0) / documents.length).toFixed(2),
        };
        
        console.log('\n📊 Summary:');
        console.log(`  Total documents: ${summary.total}`);
        console.log(`  Unique skills: ${summary.skills}`);
        console.log(`  Unique cities: ${summary.cities}`);
        console.log(`  Avg confidence: ${summary.avgConfidence}`);
        
    } catch (err) {
        console.error('Import error:', err.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
    }
}

// Check if csv-parse is installed
try {
    require('csv-parse/sync');
} catch (err) {
    console.error('ERROR: csv-parse not installed!');
    console.error('Run: npm install csv-parse --save-dev');
    process.exit(1);
}

importCSV();
