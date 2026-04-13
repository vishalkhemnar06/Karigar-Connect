# 📋 Pricing Engine Quick Reference Card

## Commands Quick Reference

```bash
# 1. Install dependencies
npm install csv-parse node-cron

# 2. Import CSV bootstrap data
node server/scripts/importBaseRates.js

# 3. Test pricing engine
node -e "
const p = require('./server/services/pricingEngineService');
p.estimatePrice({skillKey:'painter', cityKey:'mumbai'}).then(r => console.log(JSON.stringify(r, null, 2)));
"

# 4. Run weekly update manually
node server/cron/updateRates.js

# 5. Check data in MongoDB
mongo karigarconnect --eval "db.baserates.countDocuments()"
mongo karigarconnect --eval "db.marketrates.find().pretty()"
```

## API Reference

### estimatePrice()
```javascript
const result = await estimatePrice({
    skillKey: 'painter',         // Required
    cityKey: 'mumbai',          // Required
    locality: 'bandra',         // Optional
    quantity: 500,              // Optional (default: 1)
    unit: 'sqft',              // Optional (default: 'day')
    urgent: false,             // Optional (default: false)
    complexity: 'normal'       // Optional: 'light'|'normal'|'heavy'
});

// Result:
{
    success: true,
    priceRange: {                // Calculated range
        min: 720,
        expected: 1200,
        max: 1600,
        avgHours: 8,
        multipliers: {           // Applied multipliers
            locality: 1.0,
            demandSupply: 1.1,
            complexity: 1.0,
            urgency: 1.0,
            total: 1.1
        }
    },
    confidence: 0.75,           // 0-1 confidence score
    source: 'market_rate'       // 'market_rate'|'nearby_market_rate'|'base_rate'|'fallback'
}
```

## Fallback Chain

1. **MarketRate** - Real job data, confidence 0.85-0.95
2. **Nearby MarketRate** - Adjacent city data, confidence 0.72-0.81
3. **BaseRate** - CSV bootstrap, confidence 0.50
4. **Hardcoded Fallback** - Safety net, confidence 0.30

## Multiplier Ranges

| Multiplier | Range | Example |
|-----------|-------|---------|
| Locality | 0.5-2.0 | Premium area: 1.2×, Suburb: 0.8× |
| Demand-Supply | 0.9-1.2 | High demand: 1.15×, Low: 0.95× |
| Complexity | 0.8-1.3 | Light: 0.8×, Heavy: 1.3× |
| Urgency | 1.0-1.2 | Urgent: 1.2×, Normal: 1.0× |

## Data Capture in Job Completion

**MUST be populated when job completes**:

```javascript
pricingMeta: {
    estimatedHours: 8,              // From AI estimate
    actualHours: 7.5,              // (actualEndTime - actualStartTime) / 3600000
    finalPaidPrice: 1000,          // ✅ CRITICAL: from payment
    capturedAt: new Date()         // When finalized
}
```

## File Structure

```
server/
├── models/
│   ├── baseRateModel.js           ← CSV storage
│   ├── marketRateModel.js         ← Market rates (p50/p75/p90)
│   ├── localityFactorModel.js     ← Locality multipliers
│   ├── taskTemplateModel.js       ← Productivity rules
│   ├── demandSnapshotModel.js     ← Demand tracking
│   └── jobModel.js                ← Updated with pricingMeta
├── services/
│   └── pricingEngineService.js    ← Core logic
├── scripts/
│   └── importBaseRates.js         ← CSV import
├── cron/
│   └── updateRates.js             ← Weekly recalculation
└── controllers/
    └── aiAssistantController.js   ← Updated to use pricingEngineService
```

## Confidence Scoring

| Data Points | Confidence |
|------------|-----------|
| <10 | 0.50 |
| 10-50 | 0.65-0.75 |
| 50-100 | 0.85 |
| ≥100 | 0.95 |
| CSV Bootstrap | 0.75 |
| Fallback | 0.30 |

## Cron Schedule

```bash
# In server.js:
cron.schedule('0 2 * * 0', runWeeklyUpdate);
# Runs every Sunday at 2:00 AM UTC

# Alternative schedules:
'0 */6 * * *'    # Every 6 hours
'0 2 * * *'      # Daily at 2 AM
'*/30 * * * *'   # Every 30 minutes
```

## Key Normalization Functions

```javascript
// Both available in pricingEngineService:

normalizeSkillKey('painter')        // → 'painter'
normalizeSkillKey('Mason / Bricklayer')  // → 'mason'
normalizeSkillKey('AC Technician')  // → 'ac_technician'

normalizeCityKey('Mumbai')          // → 'mumbai'
normalizeCityKey('New Delhi')       // → 'newdelhi'
normalizeCityKey('Navi Mumbai')     // → 'navimumbai'
```

## Test Estimates

```javascript
// Test 1: Market data available
await estimatePrice({skillKey: 'painter', cityKey: 'mumbai'})
// Expected: source='market_rate', confidence=0.85+

// Test 2: No market data, fallback to CSV
await estimatePrice({skillKey: 'other', cityKey: 'xyz'})
// Expected: source='base_rate', confidence=0.50

// Test 3: No data at all
await estimatePrice({skillKey: 'nonexistent', cityKey: 'nonexistent'})
// Expected: source='fallback', confidence=0.30, price=1000-2000

// Test 4: With urgent flag
await estimatePrice({skillKey: 'painter', cityKey: 'mumbai', urgent: true})
// Expected: max price 20% higher (1.2× multiplier)

// Test 5: With locality
await estimatePrice({skillKey: 'painter', cityKey: 'mumbai', locality: 'bandra'})
// Expected: price adjusted by locality factor (if exists)
```

## Deployment Checklist

- [ ] CSV imported (`baseRates` has ~1500 docs)
- [ ] Package dependencies installed
- [ ] Job completion flow updated with `finalPaidPrice`
- [ ] Cron job scheduled in server.js
- [ ] First weekly update runs successfully
- [ ] marketRates collection populated
- [ ] Confidence scores between 0.3-0.95
- [ ] AI estimates use pricingEngineService
- [ ] Error handling for MongoDB connection failures

## Performance Metrics

| Operation | Duration |
|-----------|----------|
| Single estimatePrice() call | 5-10ms |
| Weekly cron full run | 30-60s |
| CSV import (1500 rows) | 10-20s |
| Market rate calculation | 5-10s |
- MongoDB indexes on: (skillKey, cityKey), (skillKey, cityKey, isActive)

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| CSV import fails | Check file exists, encoding (UTF-8) |
| estimatePrice returns fallback | Verify baseRates populated |
| Cron not running | Check cron.schedule() in server.js |
| finalPaidPrice always 0 | Update job completion flow (Phase 4) |
| Low confidence scores | Normal for new cities/skills; improves over time |
| Wild price swings | Check multiplier bounds; should be 0.5-2.0 |

---

**Last Updated**: 2025
**Quick Questions?** See PRICING_ENGINE_GUIDE.md for details
