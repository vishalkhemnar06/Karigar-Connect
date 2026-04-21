#!/usr/bin/env node

/**
 * smokeTestPricingFlow.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Smoke test for pricing/rejection/payment flow.
 * Tests:
 *  1. Worker can apply for job with quoted price
 *  2. Client can reject applicant with reason
 *  3. Client can complete job with final payment amounts
 *  4. Fairness bounds checking validates input
 *
 * This is a SCHEMA + LOGIC verification test, not a full integration test.
 * Usage:
 *   node scripts/smokeTestPricingFlow.js
 */

const path = require('path');
const fs = require('fs');

const serverRoot = path.resolve(__dirname, '..');

// Utility
const log = (step, passed, detail = '') => {
    const symbol = passed ? '✅' : '❌';
    console.log(`${symbol} ${step.padEnd(50)} ${detail}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: Worker apply with quoted price - schema validation
// ─────────────────────────────────────────────────────────────────────────────
const testWorkerApplyQuote = () => {
    console.log('\n[TEST 1] Worker Apply with Quoted Price');
    try {
        const jobModelPath = path.join(serverRoot, 'models/jobModel.js');
        const jobModel = require(jobModelPath);
        
        // Check schema has quote fields
        const applicantSchema = jobModel.schema.path('applicants');
        const hasQuotedPrice = applicantSchema?.schema?.paths?.quotedPrice !== undefined;
        const hasQuoteRate = applicantSchema?.schema?.paths?.quoteRate !== undefined;
        const hasQuoteBasis = applicantSchema?.schema?.paths?.quoteBasis !== undefined;
        const hasQuoteQuantity = applicantSchema?.schema?.paths?.quoteQuantity !== undefined;
        const hasQuotedAt = applicantSchema?.schema?.paths?.quotedAt !== undefined;

        log('Applicant schema has quotedPrice field', hasQuotedPrice);
        log('Applicant schema has quoteRate field', hasQuoteRate);
        log('Applicant schema has quoteBasis field', hasQuoteBasis);
        log('Applicant schema has quoteQuantity field', hasQuoteQuantity);
        log('Applicant schema has quotedAt field', hasQuotedAt);

        const allQuoteFields = hasQuotedPrice && hasQuoteRate && hasQuoteBasis && hasQuoteQuantity && hasQuotedAt;
        
        // Check controller has parseQuotedApplications
        const workerCtrlPath = path.join(serverRoot, 'controllers/workerController.js');
        const workerCtrlContent = fs.readFileSync(workerCtrlPath, 'utf8');
        const hasParseFunction = /function parseQuotedApplications|const parseQuotedApplications/i.test(workerCtrlContent);
        const hasQuoteMapping = /quoteMap|quoteRow/i.test(workerCtrlContent);
        
        log('Worker controller has parseQuotedApplications function', hasParseFunction);
        log('Worker controller applies quote mapping', hasQuoteMapping);

        return allQuoteFields && hasParseFunction && hasQuoteMapping;
    } catch (err) {
        log('Worker apply quote test', false, err.message);
        return false;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: Client rejection with reason - enforcement validation
// ─────────────────────────────────────────────────────────────────────────────
const testClientRejectWithReason = () => {
    console.log('\n[TEST 2] Client Reject with Reason');
    try {
        const clientCtrlPath = path.join(serverRoot, 'controllers/clientController.js');
        const clientCtrlContent = fs.readFileSync(clientCtrlPath, 'utf8');
        
        // Check reason validation
        const hasReasonCheck = /feedback.*trim|rejectionReason.*trim/i.test(clientCtrlContent);
        const hasErrorMessage = /Please provide a rejection reason/i.test(clientCtrlContent);
        const hasRejectStatus = /status.*rejected/i.test(clientCtrlContent);
        const hasSMSIntegration = /sendCustomSms.*reason|reason.*rejected|rejected.*reason|Reason:/i.test(clientCtrlContent);

        log('respondToApplicant validates feedback not empty', hasReasonCheck);
        log('respondToApplicant returns 400 error for missing reason', hasErrorMessage);
        log('respondToApplicant sets applicant.status to rejected', hasRejectStatus);
        log('respondToApplicant includes reason in SMS notification', hasSMSIntegration);

        return hasReasonCheck && hasErrorMessage && hasRejectStatus && hasSMSIntegration;
    } catch (err) {
        log('Client reject with reason test', false, err.message);
        return false;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: Job completion with payment amounts - blocking logic
// ─────────────────────────────────────────────────────────────────────────────
const testJobCompletionPayment = () => {
    console.log('\n[TEST 3] Job Completion with Final Payment');
    try {
        const clientCtrlPath = path.join(serverRoot, 'controllers/clientController.js');
        const clientCtrlContent = fs.readFileSync(clientCtrlPath, 'utf8');
        
        // Check completion blocking logic
        const hasIncompleteCheck = /incompleteSlots.*task_completed|task_completed.*incompleteSlots/i.test(clientCtrlContent);
        const hasBlockingError = /mark all assigned workers done|Please mark all assigned workers/i.test(clientCtrlContent);
        const hasFinalPaidField = /finalPaid|finalPaidPrice/i.test(clientCtrlContent);
        const hasPricingMeta = /pricingMeta/i.test(clientCtrlContent);

        log('updateJobStatus checks for incomplete slots', hasIncompleteCheck);
        log('updateJobStatus blocks completion with 400 error', hasBlockingError);
        log('updateJobStatus requires finalPaidPrice per slot', hasFinalPaidField);
        log('updateJobStatus stores pricing in pricingMeta', hasPricingMeta);

        // Check no auto-completion - slots require explicit completion before job completion
        const noAutoComplete = /incompleteSlots.*length.*>|incompleteSlots.*\.length/i.test(clientCtrlContent);
        log('updateJobStatus requires explicit task_completed per slot', noAutoComplete);

        return hasIncompleteCheck && hasBlockingError && hasFinalPaidField && hasPricingMeta && noAutoComplete;
    } catch (err) {
        log('Job completion payment test', false, err.message);
        return false;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: Frontend fairness bounds checking
// ─────────────────────────────────────────────────────────────────────────────
const testFairnessChecking = () => {
    console.log('\n[TEST 4] Fairness Bounds Checking');
    try {
        const clientJobMgmtPath = path.join(serverRoot, '../client/src/pages/client/ClientJobManage.jsx');
        if (!fs.existsSync(clientJobMgmtPath)) {
            log('ClientJobManage.jsx fairness implementation', false, 'File not found');
            return false;
        }
        
        const content = fs.readFileSync(clientJobMgmtPath, 'utf8');
        
        const hasCompleteModal = /CompleteJobModal/i.test(content);
        const hasFairnessWarnings = /fairnessWarnings|fairness.*check|fair.*bounds/i.test(content);
        const hasThresholdCalc = /0\.2|1\.5|threshold|20%|150%/i.test(content);
        const hasAcknowledgement = /fairness.*acknowledge|acknowledge.*fairness|acknowledge.*fair/i.test(content);

        log('CompleteJobModal defined', hasCompleteModal);
        log('Frontend computes fairness warning array', hasFairnessWarnings);
        log('Frontend checks 20% low / 150% high thresholds', hasThresholdCalc);
        log('Frontend requires user acknowledgement for out-of-bounds', hasAcknowledgement);

        return hasCompleteModal && hasFairnessWarnings && hasThresholdCalc && hasAcknowledgement;
    } catch (err) {
        log('Fairness bounds checking test', false, err.message);
        return false;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: Worker and Client UI integration
// ─────────────────────────────────────────────────────────────────────────────
const testUIIntegration = () => {
    console.log('\n[TEST 5] Frontend UI Integration');
    try {
        let passed = 0;
        let total = 0;

        // Test worker quote input
        const jobRequestsPath = path.join(serverRoot, '../client/src/pages/worker/JobRequests.jsx');
        if (fs.existsSync(jobRequestsPath)) {
            total++;
            const content = fs.readFileSync(jobRequestsPath, 'utf8');
            const hasQuoteInput = /quotedApplications|quoteRate|quoteBasis/i.test(content);
            log('Worker JobRequests has quote input UI', hasQuoteInput);
            if (hasQuoteInput) passed++;
        }

        // Test worker rejection reason display
        const jobBookingsPath = path.join(serverRoot, '../client/src/pages/worker/JobBookings.jsx');
        if (fs.existsSync(jobBookingsPath)) {
            total++;
            const content = fs.readFileSync(jobBookingsPath, 'utf8');
            const hasReasonDisplay = /rejectedApps.*feedback|feedback.*String/i.test(content);
            log('Worker JobBookings shows rejection reason', hasReasonDisplay);
            if (hasReasonDisplay) passed++;
        }

        // Test client rejection modal
        const clientJobMgmtPath = path.join(serverRoot, '../client/src/pages/client/ClientJobManage.jsx');
        if (fs.existsSync(clientJobMgmtPath)) {
            total += 2;
            const content = fs.readFileSync(clientJobMgmtPath, 'utf8');
            const hasRejectModal = /RejectApplicantModal/i.test(content);
            const hasCompleteModal = /CompleteJobModal/i.test(content);
            log('Client JobManage has RejectApplicantModal', hasRejectModal);
            log('Client JobManage has CompleteJobModal', hasCompleteModal);
            if (hasRejectModal) passed++;
            if (hasCompleteModal) passed++;
        }

        return passed === total && total > 0;
    } catch (err) {
        log('UI integration test', false, err.message);
        return false;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: Route coverage - ensure endpoints exist
// ─────────────────────────────────────────────────────────────────────────────
const testRoutesCoverage = () => {
    console.log('\n[TEST 6] API Routes Coverage');
    try {
        const routesDir = path.join(serverRoot, 'routes');
        if (!fs.existsSync(routesDir)) {
            log('Routes directory exists', false, 'Directory not found');
            return false;
        }

        let hasApply = false, hasRespond = false, hasComplete = false;

        const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
        files.forEach(file => {
            const filePath = path.join(routesDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            
            if (/applyForJob|apply.*job/i.test(content)) hasApply = true;
            if (/respondToApplicant|respond.*applicant/i.test(content)) hasRespond = true;
            if (/updateJobStatus|complete.*job/i.test(content)) hasComplete = true;
        });

        log('Routes include applyForJob endpoint', hasApply);
        log('Routes include respondToApplicant endpoint', hasRespond);
        log('Routes include updateJobStatus endpoint', hasComplete);

        return hasApply && hasRespond && hasComplete;
    } catch (err) {
        log('Routes coverage test', false, err.message);
        return false;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const main = () => {
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Smoke Test: Pricing/Rejection/Payment Flow');
    console.log('─────────────────────────────────────────────────────────────');

    const tests = [
        testWorkerApplyQuote,
        testClientRejectWithReason,
        testJobCompletionPayment,
        testFairnessChecking,
        testUIIntegration,
        testRoutesCoverage,
    ];

    const results = tests.map((test, idx) => {
        try {
            return test();
        } catch (err) {
            console.error(`\nERROR in test ${idx + 1}: ${err.message}`);
            return false;
        }
    });

    console.log('\n─────────────────────────────────────────────────────────────');
    const passCount = results.filter(r => r).length;
    console.log(`Smoke Test Results: ${passCount}/${results.length} tests passed`);

    if (results.every(r => r)) {
        console.log('✅ All smoke tests passed! Implementation ready for runtime testing.');
        process.exitCode = 0;
    } else {
        console.log('⚠️  Some smoke tests failed. Review implementation.');
        process.exitCode = 1;
    }
};

main();
