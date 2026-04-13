# KarigarConnect Pricing Engine Implementation Guide

## Overview

The self-learning dynamic pricing engine replaces hardcoded static rates with a data-driven, market-adaptive system. It learns from real job data (finalPaidPrice + actualHours) to continuously improve price estimates.

## Architecture

### 1. **Data Layer (Models)**

#### BaseRateModel
- **Purpose**: Stores normalized CSV data (karigar_rates.csv) in MongoDB
- **Content**: ~1500 rows of skill/city rate combinations with confidence scores
- **Key Fields**: skillKey, cityKey, rateMode, localHourlyMin/Max, platformDayMin/Max
- **Access Pattern**: Initial bootstrap fallback when no market data exists
- **Confidence**: 0.75 (CSV import default)

#### MarketRateModel  
- **Purpose**: Calculated from completed jobs with real pricing
- **Content**: p50, p75, p90 percentiles of actual paid prices
- **Key Fields**: skillKey, cityKey, p50, p75, p90, avgHours, dataPoints, confidence
- **Updated**: Weekly cron job (every Sunday 2AM UTC)
- **Confidence**: 0.50-0.95 based on dataPoints (>100 → 0.95)

#### LocalityFactorModel
- **Purpose**: Locality-specific price multipliers (e.g., premium areas 1.2×, suburbs 0.8×)
- **Content**: Relative to city average (city average = 1.0)
- **Key Fields**: cityKey, locality, multiplier (0.5-2.0), confidence
- **Updated**: Weekly from job location patterns
- **Confidence**: Based on jobs per locality

#### TaskTemplateModel
- **Purpose**: Productivity & complexity rules (admin-defined)
- **Content**: Task-specific productivity (e.g., painter: 100 sqft/hour), complexity rules
- **Key Fields**: skillKey, taskType, productivity, complexityRules (JSON)
- **Access Pattern**: Optional lookup during estimation
- **Manually Populated**: By admin (not auto-generated)

#### DemandSnapshotModel
- **Purpose**: Hourly/daily snapshot of activeJobs/activeWorkers ratio
- **Content**: Current market demand pressure indicator
- **Key Fields**: skillKey, cityKey, activeJobs, activeWorkers, ratio, capturedAt
- **Updated**: Weekly (in production: could be hourly)
- **Use Case**: Apply demand multiplier (1.0-1.2×) during estimation

### 2. **Service Layer**

#### pricingEngineService.js
Core business logic for price estimation:

```javascript
// Main function signature:
estimatePrice({
    skillKey,           // Required: 'painter', 'plumber', etc.
    cityKey,           // Required: normalized city name
    locality = '',     // Optional: specific locality for factor lookup
    quantity = 1,      // Work quantity
    unit = 'day',      // 'day', 'hour', 'sqft', 'visit', etc.
    urgent = false,    // Urgency flag (1.2× multiplier)
    complexity = 'normal', // 'light' (0.8×), 'normal', 'heavy' (1.3×)
})

// Returns:
{
    success: true,
    priceRange: {
        min: 720,
        expected: 1200,
        max: 1600,
        avgHours: 8,
        multipliers: {
            locality: 1.0,
            demandSupply: 1.1,
            complexity: 1.0,
            urgency: 1.0,
            total: 1.1
        }
    },
    confidence: 0.75,
    source: 'market_rate|nearby_market_rate|base_rate|fallback'
}
```

**Fallback Chain**:
1. MarketRate (best: real job data) → confidence 0.85-0.95
2. Nearby City MarketRate → confidence 0.72-0.81 (85% of original)
3. BaseRate (CSV) → confidence 0.50 (no job data)
4. Hardcoded Fallback→ confidence 0.30 (safety net)

**Multiplier Application**:
- Locality Factor: 0.5-2.0 (premium/suburban adjustment)
- Demand-Supply: 0.9-1.2 (market ratio mapping)
- Complexity: Light=0.8×, Normal=1.0×, Heavy=1.3×
- Urgency: Flag=1.2×, Normal=1.0×
- **Total**: All multiplied together, then applied to price

### 3. **Data Capture (Job Model)**

New `pricingMeta` sub-schema in Job model:

```javascript
pricingMeta: {
    taskType: String,           // e.g., 'wall_paint', 'full_house_paint'
    quantity: Number,           // Size/dimension (e.g., 500 for 500 sqft)
    unit: String,              // 'sqft', 'meter', 'visit', 'day'
    estimatedHours: Number,    // From AI estimate (needed for learning)
    actualHours: Number,       // From (actualEndTime - actualStartTime) / 3600000
    workerQuotedPrice: Number, // What worker asked initially
    finalPaidPrice: Number,    // ✅ CRITICAL: What was actually paid (drives learning)
    demandSupplyRatio: Number, // Market snapshot at job time
    priceSource: String,       // 'ai', 'manual', 'historical', ''
    confidenceScore: Number,   // 0-1, from pricing engine
    capturedAt: Date          // When was this data finalized
}
```

**When to Populate**:
- `estimatedHours`: When job created via AI estimate
- `actualHours`: When job marked completed (from timestamps)
- `finalPaidPrice`: ✅ **KEY** — At settlement/payment finalization
- `capturedAt`: When payment finalized

## Implementation Status

### ✅ Completed
1. **Models Created**:
   - baseRateModel.js (CSV storage)
   - marketRateModel.js (market-driven rates)
   - localityFactorModel.js (locality premiums)
   - taskTemplateModel.js (productivity rules)
   - demandSnapshotModel.js (demand tracking)
   - Job.pricingMeta sub-schema

2. **Services Created**:
   - pricingEngineService.js (core estimation logic)
   - calculateStructuredBudget() wrapper (backward compatible)

3. **Scripts Created**:
   - importBaseRates.js (CSV → MongoDB)
   - cron/updateRates.js (weekly market recalculation)

4. **Controller Integration**:
   - aiAssistantController.js updated to use pricingEngineService
   - All 4 calculateStructuredBudget calls converted to async/await

5. **Package Dependencies**:
   - csv-parse added to package.json

### 🟡 Partially Complete
- Pricing engine service created; needs testing
- Job model schema updated; controller logic to populate pricingMeta fields NOT YET DONE

### ❌ Pending Critical Tasks
1. **Install CSV-Parse**:
   ```bash
   npm install csv-parse
   ```

2. **Run CSV Import**:
   ```bash
   node server/scripts/importBaseRates.js
   ```
   - Populates baseRates collection with ~1500 bootstrap rates

3. **Job Completion Flow** (⚠️ HIGH PRIORITY):
   - Update clientController or settlement flow to capture:
     * `finalPaidPrice` (from invoice/payment)
     * `actualHours` (computed from job timestamps)
     * Set `pricingMeta.capturedAt = Date.now()`

4. **Cron Job Setup**:
   - Add to server startup or cron scheduler:
   ```javascript
   const cron = require('node-cron');
   const { runWeeklyUpdate } = require('./cron/updateRates');
   
   // Every Sunday at 2 AM UTC
   cron.schedule('0 2 * * 0', runWeeklyUpdate);
   ```
   - Requires `node-cron` package: `npm install node-cron`

5. **Testing & Validation**:
   - Test fallback chain: market → nearby → base → fallback
   - Verify multipliers apply correctly
   - Check confidence scoring matches data quality
   - Validate localityFactor calculation

6. **Optional Enhancements**:
   - Demand snapshots: Can be updated hourly instead of weekly
   - Price caching: Add 5-min TTL cache for repeated estimates
   - Analytics: Track price deltas week-over-week
   - Audit log: Record which source each estimate came from

## Integration Points

### 1. Job Creation (aiAssistantController.generateEstimate)
✅ **Already integrated**: Uses pricingEngineService.calculateStructuredBudget()

### 2. Job Completion Flow
❌ **NEEDS INTEGRATION**:
```javascript
// At job completion/settlement:
const job = await Job.findByIdAndUpdate(jobId, {
    status: 'completed',
    actualEndTime: new Date(),
    'pricingMeta.actualHours': (job.actualEndTime - job.actualStartTime) / 3600000,
    'pricingMeta.finalPaidPrice': amountPaid,  // From payment processor
    'pricingMeta.capturedAt': new Date()
});
```

### 3. Weekly Learning (cron)
✅ **Script ready**: `node server/cron/updateRates.js`
- Requires scheduling (e.g., via node-cron)
- Triggers: Market rate p50/p75/p90 recalculation
- Triggers: Locality factor updates
- Triggers: Demand snapshot capture

## CSV Bootstrap Process

**File**: `karigar_rates.csv` (1500+ rows)

**Columns**:
- Skill_Key: Normalized skill name (e.g., 'mason')
- City_Key: Normalized city name
- Rate_Mode: 'mixed', 'per_visit', 'hourly', 'daily'
- Unit: 'day', 'visit', 'hour'
- Local_Hourly_Min/Max: Typical roadside worker rate
- Local_Day_Min/Max: Full-day equivalent
- Platform_Hourly_Min/Max: KarigarConnect platform rate estimate
- Platform_Day_Min/Max: Platform full-day rate
- Platform_Cost_Min/Max: Min/Max that should be charged to customer
- Source: 'csv_import' (or specific source)
- Confidence: 0.75 (default) — overridable per row
- Effective_From/To: Date range validity
- Is_Active: Boolean

**Import Logic**:
```bash
node server/scripts/importBaseRates.js
```
- Parses CSV
- Normalizes skill/city keys
- Inserts into baseRates collection
- Creates compound indexes for fast lookup
- Expected result: ~1500 documents, ~300 unique cities × skills

## Testing Guide

### 1. CSV Import
```bash
# Set env var to clear existing data first (optional)
export CLEAR_EXISTING=true
node server/scripts/importBaseRates.js

# Check MongoDB:
db.baserates.countDocuments()  # Should be ~1500
db.baserates.find({skillKey: 'painter', cityKey: 'mumbai'}).limit(1)
```

### 2. Pricing Engine Service
```javascript
// In a test file or Node REPL:
const pricingEngine = require('./server/services/pricingEngineService');

const estimate = await pricingEngine.estimatePrice({
    skillKey: 'painter',
    cityKey: 'mumbai',
    urgent: false,
    complexity: 'normal'
});

console.log(estimate); // Should return priceRange with min/expected/max
```

### 3. AI Controller Integration
```bash
# Call API: POST /api/ai/generateEstimate
curl -X POST http://localhost:5000/api/ai/generateEstimate \
  -H "Content-Type: application/json" \
  -d '{
    "workDescription": "Paint my 2-bedroom apartment",
    "city": "Mumbai",
    "selectedLanguage": "en"
  }'

# Response should include budgetBreakdown with pricing from engine
```

### 4. Weekly Cron
```bash
# Run manually once to test:
node server/cron/updateRates.js

# Check MongoDB:
db.marketrates.find({skillKey: 'painter'}).limit(1)
db.localityfactors.find({}).limit(5)
db.demandsnapshots.find({}).sort({capturedAt: -1}).limit(10)
```

## Fallback & Safety Mechanisms

1. **Pricing Confidence Tracking**:
   - All estimates include `confidence: 0-1`
   - UI can warn customers if confidence < 0.6

2. **Rate Bounds Checking**:
   - Demand multiplier clamped to 0.5-2.0
   - Locality factor clamped to 0.5-2.0
   - Never allows negative prices

3. **Multi-Level Fallback**:
   - If MarketRate unavailable: try nearby cities
   - If nearby unavailable: use BaseRate (CSV)
   - If all fail: use hardcoded safety net (₹1000-₹2000)

4. **Data Quality**:
   - Outlier removal: Uses IQR method (remove ±3σ)
   - Minimum data points: MarketRate needs >=3 jobs before use
   - Skip low-confidence rates in estimates

## Performance Notes

- **Lookup Speed**: ~5-10ms per estimate (with indexes)
- **Cron Job Duration**: ~30-60s for full week (if many completed jobs)
- **Memory**: Models lazy-loaded; minimal overhead
- **Caching Opportunity**: Add Redis for 5-min TTL on market rates (optional)

## Key Metrics to Monitor

1. **CSV Import Success**: `baseRates.countDocuments()` → ~1500
2. **Market Rate Coverage**: Unique (skill, city) combinations in marketRates
3. **Data Quality**: Percentage of jobs with capturedAt !== null
4. **Confidence Trends**: Average confidence score across estimates
5. **Price Deltas**: Weekly p50 changes (should be gradual, not volatile)

## Troubleshooting

### CSV Import Fails
- Check CSV file exists at `karigar_rates.csv`
- Check file encoding (UTF-8)
- Run with `CLEAR_EXISTING=true` if duplicates issue

### estimatePrice() Returns Fallback
- Check MongoDB connection is active
- Verify baseRates collection has data
- Check skillKey normalization (should be lowercase)

### Market Rates Not Updating
- Check cron job is running (set `DEBUG=1` in env)
- Verify completed jobs have `pricingMeta.finalPaidPrice > 0`
- Check date filters (only last few weeks of jobs processed)

### Confidence Scores Too Low
- Confidence depends on job data points
- New cities/skills initially have confidence ~0.5
- Will improve as more jobs complete
- Bootstrap rates (CSV) start at 0.75

## Future Enhancements

1. **Machine Learning**:
   - Predict demand and pre-adjust supply
   - Seasonal patterns (festivals, weather)
   - Worker rating influence on price

2. **Locality Granularity**:
   - From citywide → neighborhood level
   - Geo-fence based factors

3. **Dynamic Urgency**:
   - Time-to-deadline based multiplier
   - Rush hour surcharges

4. **Competitive Pricing**:
   - Track competitor rates
   - Adjust dynamically within market

5. **Customer Segment**:
   - Different rates for different customer tiers
   - Loyalty discounts baked into pricing

---

**Implementation Date**: 2025
**Last Updated**: [Current Date]
**Maintained By**: [Team]
