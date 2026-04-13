# 🚀 Pricing Engine Implementation Checklist

## Phase 1: Setup (5 minutes)

- [ ] **Install Dependencies**
  ```bash
  cd server
  npm install csv-parse node-cron
  npm install   # Update node_modules
  ```

- [ ] **Verify Models Exist** (should see these files)
  ```bash
  ls -la server/models/base*Model.js
  ls -la server/models/market*Model.js
  ls -la server/models/locality*Model.js
  ls -la server/models/demand*Model.js
  ls -la server/models/task*Model.js
  ```

## Phase 2: Bootstrap Data (5 minutes)

- [ ] **Run CSV Import**
  ```bash
  node server/scripts/importBaseRates.js
  ```
  - Expected output: "Successfully imported ~1500 records"
  - Check file: Should process `karigar_rates.csv`

- [ ] **Verify MongoDB Population** (in MongoDB CLI or Compass)
  ```javascript
  db.baserates.countDocuments()  // Should be ~1500
  db.baserates.findOne({skillKey: 'painter'})  // Sample doc
  ```

## Phase 3: Controller Integration (Already Done ✅)

- [x] **aiAssistantController.js Updated**
  - Import changed from rateTable → pricingEngineService
  - All 4 calculateStructuredBudget calls are now async/await
  - Ready to serve market-driven prices

## Phase 4: Job Completion Flow (CRITICAL - 30 minutes)

⚠️ **THIS IS THE MOST IMPORTANT STEP** — Without it, learning doesn't work!

- [x] **Find Job Completion Code**
  - Search for where jobs are marked "completed"
  - Likely in: `server/controllers/clientController.js` or similar
  - Look for patterns like: `status: 'completed'`, payment finalization, settlement

- [x] **Add pricingMeta Population**
  ```javascript
  // At the point where job payment/completion is finalized:
  
  const jobUpdate = {
    status: 'completed',
    actualEndTime: new Date(),
    'pricingMeta.actualHours': job.actualEndTime && job.actualStartTime 
      ? (new Date(job.actualEndTime) - new Date(job.actualStartTime)) / (1000 * 60 * 60)
      : 0,
    'pricingMeta.finalPaidPrice': Number(finalPaymentAmount),  // From payment processor
    'pricingMeta.capturedAt': new Date()
  };
  
  await Job.findByIdAndUpdate(jobId, jobUpdate);
  ```

- [x] **Document Where You Added This**
  - Implemented in `server/controllers/clientController.js`
  - Helper added: `applyPricingCompletionMeta()`
  - Called in:
    - `updateJobStatus()` when `status === 'completed'` (captures `finalPaidPrice`, `actualHours`, `capturedAt`)
    - `completeWorkerTask()` when all slots complete (captures timing metadata)

## Phase 5: Cron Job Scheduling (15 minutes)

- [x] **Add to server.js Startup**
  ```javascript
  // Add near top of server.js (after other requires):
  const cron = require('node-cron');
  const { runWeeklyUpdate } = require('./cron/updateRates');
  
  // After app initialization, add:
  
  // Weekly rate update: Every Sunday at 2 AM UTC
  cron.schedule('0 2 * * 0', () => {
    console.log('Starting weekly pricing engine update...');
    runWeeklyUpdate().catch(err => {
      console.error('Weekly update failed:', err);
      // Could send alert/notification here
    });
  });
  
  console.log('✅ Pricing engine cron job scheduled');
  ```

- [x] **Test Cron Manually (Optional)**
  ```bash
  # Run the update script directly to verify it works:
  node server/cron/updateRates.js
  
  # Should output: 
  # ════════════════════════════════════════════════════════════════════════════════
  # 🔄 WEEKLY RATE UPDATE - START
  # [... logs for each pipeline ...]
  # ✅ WEEKLY RATE UPDATE - COMPLETE
  ```

## Phase 6: Testing (1 hour)

### 6.1 CSV Bootstrap Verification
- [x] Count baseRates documents
  ```javascript
  // In MongoDB CLI:
  use karigarconnect
  db.baserates.countDocuments()  // Should be ~1500
  db.baserates.countDocuments({isActive: true})  // Should be ~1500
  
  // Check a few samples:
  db.baserates.find({skillKey: 'painter', cityKey: 'mumbai'}).pretty()
  db.baserates.find({skillKey: 'plumber', cityKey: 'delhi'}).pretty()
  ```

### 6.2 Pricing Engine Service Test
- [x] Test estimatePrice() directly
  ```javascript
  // In Node REPL or test file:
  const pricingEngine = require('./server/services/pricingEngineService');
  
  // Test 1: Basic estimate
  const result = await pricingEngine.estimatePrice({
      skillKey: 'painter',
      cityKey: 'mumbai',
      urgent: false,
      complexity: 'normal'
  });
  console.log(result);
  // Should return: { success: true, priceRange: {...}, confidence: 0.5-0.95, source: '...' }
  
  // Test 2: Nearby fallback (non-existent city)
  const result2 = await pricingEngine.estimatePrice({
      skillKey: 'plumber',
      cityKey: 'xyz_nonexistent',
      urgent: false
  });
  console.log(result2.source);  // Should be 'fallback'
  
  // Test 3: With multipliers
  const result3 = await pricingEngine.estimatePrice({
      skillKey: 'painter',
      cityKey: 'mumbai',
      urgent: true,
      complexity: 'heavy'
  });
  console.log(result3.priceRange.multipliers.total);  // Should be >1.0
  ```

### 6.3 AI Controller Integration Test
- [x] Test /api/ai/generateEstimate endpoint
  - Verified authenticated `POST /api/ai/generate-estimate` returns `200` with `budgetBreakdown`.
  - Observed output included `totalEstimated`, `ratePerDay`, and `priceSource: market_rate`.
  ```bash
  curl -X POST http://localhost:5000/api/ai/generateEstimate \
    -H "Content-Type: application/json" \
    -d '{
      "workDescription": "I need to paint my 2-bedroom apartment",
      "city": "Mumbai",
      "selectedLanguage": "en"
    }' \
    | jq '.budgetBreakdown.breakdown[0].ratePerDay'
  
  # Should return a number from pricing engine (not hardcoded static rate)
  # Compare with old rateTable to verify it's using new service
  ```

### 6.4 Market Rate Calculation Test
- [x] Complete a dummy job with finalPaidPrice
  ```javascript
  // Create a test completed job:
  const testJob = new Job({
      client: 'clientId',
      skills: ['painter'],
      location: { city: 'Mumbai', locality: 'Bandra' },
      status: 'completed',
      actualStartTime: new Date(Date.now() - 8*60*60*1000),  // 8 hours ago
      actualEndTime: new Date(),
      pricingMeta: {
          estimatedHours: 8,
          actualHours: 7.5,
          finalPaidPrice: 1000,
          capturedAt: new Date()
      }
  });
  await testJob.save();
  ```

- [x] Run weekly update manually
  ```bash
  node server/cron/updateRates.js
  ```
  - Should process your test job
  - Check `db.marketrates.find({skillKey: 'painter'})` → should find p50=1000

- [x] Verify collections updated
  ```javascript
  db.marketrates.countDocuments()  // Should have entries
  db.localityfactors.countDocuments()  // Should have entries
  db.demandsnapshots.countDocuments()  // Should have entries
  ```

## Phase 7: Production Readiness

- [ ] **Monitor Weekly Runs**
  - Check server logs every Sunday 2 AM for "WEEKLY RATE UPDATE"
  - Verify no MongoDB connection errors

- [ ] **Data Quality Checks**
  - Set up alert if marketRates collection is empty
  - Alert if average confidence drops below 0.5

- [ ] **Performance Baseline**
  - Measure time taken for POST /api/ai/generateEstimate
  - Should still be <500ms (pricingEngine adds ~5-10ms per estimate)

- [ ] **Fallback Behavior**
  - Test with non-existent city (should fall back gracefully)
  - Test with skill not in CSV (should still return price)
  - Verify confidence is <0.5 for fallback cases

## Phase 8: Optional Enhancements (Post-Launch)

- [ ] **Add Caching**
  - Redis 5-min TTL on marketRates for repeated estimates
  - Requires: `npm install redis`

- [ ] **Increase Snapshot Frequency**
  - Change from weekly to daily/hourly demand snapshots
  - Modify cron: `'0 */6 * * *'` for every 6 hours

- [ ] **Analytics Dashboard**
  - Track weekly price deltas
  - Confidence distribution by skill
  - Fallback rate monitoring

- [ ] **UI Enhancements**
  - Show confidence score to clients
  - Show price source (market vs bootstrap vs fallback)
  - Confidence → warning: "May vary; based on [N] local jobs"

## Troubleshooting Guide

### Problem: CSV Import Fails
**Solution:**
```bash
# Check file exists
ls -la karigar_rates.csv

# Check permissions
chmod 644 karigar_rates.csv

# Run with verbose:
DEBUG=* node server/scripts/importBaseRates.js
```

### Problem: estimatePrice() Returns Only Fallback
**Solution:**
```javascript
// Verify baseRates data:
db.baserates.find({skillKey: 'painter', cityKey: 'mumbai'}).count()

// Test connection:
const BaseRate = require('./server/models/baseRateModel');
const rate = await BaseRate.findOne({));
console.log(rate);  // If null, baseRates is empty
```

### Problem: Cron Job Not Running
**Solution:**
```bash
# Check cron is initialized in server.js
grep -n "cron.schedule" server/server.js

# Check logs for initialization:
grep -i "pricing engine cron" server/server.js output

# Test manually:
node server/cron/updateRates.js
```

### Problem: finalPaidPrice Not Being Captured
**Solution:**
```javascript
// Verify job completion flow is updated:
grep -n "finalPaidPrice" server/controllers/*.js

// If not found, you haven't completed Phase 4!
// Add the code from Phase 4 to job completion flow
```

## Success Criteria

✅ All checks passing:
- [ ] baseRates collection has ~1500 documents
- [ ] pricingEngineService works (tested directly)
- [ ] AI estimate returns market-driven prices
- [ ] Job completion captures finalPaidPrice
- [ ] Weekly cron runs without errors
- [ ] marketRates collection populated after 1st cron run
- [ ] All confidence scores between 0.3 and 0.95
- [ ] Fallback chain working (no errors on missing cities)

## Timeline

- **Phase 1**: 5 min
- **Phase 2**: 5 min
- **Phase 3**: Already done
- **Phase 4**: 30 min (CRITICAL)
- **Phase 5**: 15 min
- **Phase 6**: 1 hour (testing)
- **Phase 7**: Ongoing
- **Phase 8**: Optional/future

**Total Time**: ~2 hours to full production

---

**Next Action**: Start with Phase 1 (install dependencies)!
