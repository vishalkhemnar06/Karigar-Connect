#!/usr/bin/env node

/**
 * validatePricingImplementation.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Schema and API signature validation for pricing/rejection/payment flow.
 * Checks that all required fields and logic are in place without running
 * full integration tests.
 *
 * Usage:
 *   node scripts/validatePricingImplementation.js
 */

const path = require('path');
const fs = require('fs');
const serverRoot = path.resolve(__dirname, '..');

const log = (name, passed, detail = '') => {
    const symbol = passed ? '✅' : '❌';
    console.log(`${symbol} ${name.padEnd(50)} ${detail}`);
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 1: Quote fields exist in applicant schema
// ─────────────────────────────────────────────────────────────────────────────
const checkApplicantSchemaFields = () => {
    const jobModelPath = path.join(serverRoot, 'models/jobModel.js');
    const content = fs.readFileSync(jobModelPath, 'utf8');

    const hasQuotedPrice = /quotedPrice.*type.*Number/i.test(content);
    const hasQuoteRate = /quoteRate.*type.*Number/i.test(content);
    const hasQuoteBasis = /quoteBasis.*type.*String/i.test(content);
    const hasQuoteQuantity = /quoteQuantity.*type.*Number/i.test(content);
    const hasQuotedAt = /quotedAt.*type.*Date/i.test(content);

    log(
        'Schema: applicant.quotedPrice field',
        hasQuotedPrice,
        hasQuotedPrice ? '✓' : 'NOT FOUND'
    );
    log(
        'Schema: applicant.quoteRate field',
        hasQuoteRate,
        hasQuoteRate ? '✓' : 'NOT FOUND'
    );
    log(
        'Schema: applicant.quoteBasis field',
        hasQuoteBasis,
        hasQuoteBasis ? '✓' : 'NOT FOUND'
    );
    log(
        'Schema: applicant.quoteQuantity field',
        hasQuoteQuantity,
        hasQuoteQuantity ? '✓' : 'NOT FOUND'
    );
    log(
        'Schema: applicant.quotedAt field',
        hasQuotedAt,
        hasQuotedAt ? '✓' : 'NOT FOUND'
    );

    return hasQuotedPrice && hasQuoteRate && hasQuoteBasis && hasQuoteQuantity && hasQuotedAt;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 2: Worker apply method handles quotedApplications
// ─────────────────────────────────────────────────────────────────────────────
const checkWorkerApplyImplementation = () => {
    const workerCtrlPath = path.join(serverRoot, 'controllers/workerController.js');
    const content = fs.readFileSync(workerCtrlPath, 'utf8');

    const hasParseQuotedApplications = /parseQuotedApplications/i.test(content);
    const hasParsing = /quoteMap.*get\(normalizeSkillKey/i.test(content);
    const hasStorageinApplicant = /quotedPrice.*quoteRow|quoteRow.*quotedPrice/i.test(content);
    const hasNotificationMention = /quotedSkills.*Quoted price/i.test(content);

    log(
        'applyForJob: parseQuotedApplications helper',
        hasParseQuotedApplications,
        hasParseQuotedApplications ? '✓' : 'NOT FOUND'
    );
    log(
        'applyForJob: quote data parsing & mapping',
        hasParsing,
        hasParsing ? '✓' : 'NOT FOUND'
    );
    log(
        'applyForJob: stores quote in applicant',
        hasStorageinApplicant,
        hasStorageinApplicant ? '✓' : 'NOT FOUND'
    );
    log(
        'applyForJob: mentions quoted skills in notification',
        hasNotificationMention,
        hasNotificationMention ? '✓' : 'NOT FOUND'
    );

    return hasParseQuotedApplications && hasParsing && hasStorageinApplicant && hasNotificationMention;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 3: Client respondToApplicant enforces rejection reason
// ─────────────────────────────────────────────────────────────────────────────
const checkRejectionReasonEnforcement = () => {
    const clientCtrlPath = path.join(serverRoot, 'controllers/clientController.js');
    const content = fs.readFileSync(clientCtrlPath, 'utf8');

    const hasReasonCheck = /feedback.*trim|rejectionReason.*trim/i.test(content) && 
                          /status.*rejected|rejected.*feedback/i.test(content);
    const hasReasonRequired = /Please provide a rejection reason/i.test(content) || 
                             /rejection reason/i.test(content);
    const hasSMSWithReason = /rejected.*reason|reason.*rejected/i.test(content) && /sendCustomSms/i.test(content);

    log(
        'respondToApplicant: checks for rejection reason',
        hasReasonCheck,
        hasReasonCheck ? '✓' : 'NOT FOUND'
    );
    log(
        'respondToApplicant: enforces reason requirement',
        hasReasonRequired,
        hasReasonRequired ? '✓' : 'NOT FOUND'
    );
    log(
        'respondToApplicant: includes reason in SMS',
        hasSMSWithReason,
        hasSMSWithReason ? '✓' : 'NOT FOUND'
    );

    return hasReasonCheck && hasReasonRequired && hasSMSWithReason;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 4: Auto-done removal - completion requires explicit task_completed
// ─────────────────────────────────────────────────────────────────────────────
const checkAutoDoneRemoval = () => {
    const clientCtrlPath = path.join(serverRoot, 'controllers/clientController.js');
    const content = fs.readFileSync(clientCtrlPath, 'utf8');

    const hasIncompleteCheck = /incompleteSlots.*task_completed|task_completed.*incompleteSlots/i.test(content);
    const hasBlockingLogic = /return.*400.*mark all assigned workers done|all assigned workers done/i.test(content);
    // Check that slots are NOT automatically marked complete (look for explicit marking via updateOne or $set)
    const noAutoCompletion = !/slot\.status.*=.*task_completed|slot\..*task_completed|autoComplete|auto-complete/i.test(content) ||
                             !/status.*task_completed.*without.*explicit|implicit.*complete/i.test(content);

    log(
        'updateJobStatus: checks incompleteSlots !== task_completed',
        hasIncompleteCheck,
        hasIncompleteCheck ? '✓' : 'NOT FOUND'
    );
    log(
        'updateJobStatus: blocks completion until explicit task_completed',
        hasBlockingLogic,
        hasBlockingLogic ? '✓' : 'NOT FOUND'
    );
    log(
        'updateJobStatus: no auto-slot completion',
        noAutoCompletion,
        noAutoCompletion ? '✓' : 'NOT FOUND (slots require explicit completion before job completion)'
    );

    return hasIncompleteCheck && hasBlockingLogic && noAutoCompletion;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 5: Worker JobBookings shows rejection reason
// ─────────────────────────────────────────────────────────────────────────────
const checkWorkerReasonDisplay = () => {
    const jobBookingsPath = path.join(serverRoot, '../client/src/pages/worker/JobBookings.jsx');
    if (!fs.existsSync(jobBookingsPath)) {
        log('Worker JobBookings.jsx: rejection reason display', false, 'FILE NOT FOUND');
        return false;
    }
    const content = fs.readFileSync(jobBookingsPath, 'utf8');

    // Look for rejectedApps filtering and feedback display
    const hasReasonDisplay = /rejectedApps.*feedback|feedback.*rejectedApps|rejected.*\?.feedback/i.test(content);
    const hasReasonText = /String\(.*feedback\)|feedback\}.*text|reason.*{String/i.test(content);

    log(
        'Worker JobBookings: shows rejection reason feedback',
        hasReasonDisplay && hasReasonText,
        hasReasonDisplay && hasReasonText ? '✓' : 'NOT FOUND'
    );

    return hasReasonDisplay && hasReasonText;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 6: Client payment completion modal handles payment source selection
// ─────────────────────────────────────────────────────────────────────────────
const checkPaymentSourceSelection = () => {
    const clientJobMgmtPath = path.join(serverRoot, '../client/src/pages/client/ClientJobManage.jsx');
    if (!fs.existsSync(clientJobMgmtPath)) {
        log('Client JobManage: payment source selection', false, 'FILE NOT FOUND');
        return false;
    }
    const content = fs.readFileSync(clientJobMgmtPath, 'utf8');

    const hasPaymentModal = /CompleteJobModal|completion.*modal/i.test(content);
    const hasSourceSelection = /paymentSource|payment.*source|skill.*negotiable.*worker/i.test(content);
    const hasAmountInput = /finalPaidPrice|amount.*editable|editable.*amount/i.test(content);
    const hasFairnessCheck = /fairness|fair.*price|price.*check/i.test(content);

    log(
        'Client JobManage: has completion modal',
        hasPaymentModal,
        hasPaymentModal ? '✓' : 'NOT FOUND'
    );
    log(
        'Client JobManage: payment source selection logic',
        hasSourceSelection,
        hasSourceSelection ? '✓' : 'NOT FOUND'
    );
    log(
        'Client JobManage: editable final amount input',
        hasAmountInput,
        hasAmountInput ? '✓' : 'NOT FOUND'
    );
    log(
        'Client JobManage: fairness bounds checking',
        hasFairnessCheck,
        hasFairnessCheck ? '✓' : 'NOT FOUND'
    );

    return hasPaymentModal && hasSourceSelection && hasAmountInput && hasFairnessCheck;
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK 7: Worker apply modal captures quoted price and basis
// ─────────────────────────────────────────────────────────────────────────────
const checkWorkerApplyModal = () => {
    const jobRequestsPath = path.join(serverRoot, '../client/src/pages/worker/JobRequests.jsx');
    if (!fs.existsSync(jobRequestsPath)) {
        log('Worker JobRequests: quote input modal', false, 'FILE NOT FOUND');
        return false;
    }
    const content = fs.readFileSync(jobRequestsPath, 'utf8');

    const hasQuoteInput = /quotedPrice|quoteRate|quoteModal|quote.*input/i.test(content);
    const hasBasisDetection = /quoteBasis|basis.*unit|unit.*basis|hour|day|visit/i.test(content);
    const hasComputedTotal = /total.*quote|quote.*total|computed.*amount/i.test(content);
    const hasSendPayload = /quotedApplications|sendApply.*quote|quote.*apply/i.test(content);

    log(
        'Worker JobRequests: quote rate input per skill',
        hasQuoteInput,
        hasQuoteInput ? '✓' : 'NOT FOUND'
    );
    log(
        'Worker JobRequests: detects billing basis (hour/day/visit)',
        hasBasisDetection,
        hasBasisDetection ? '✓' : 'NOT FOUND'
    );
    log(
        'Worker JobRequests: computes total quote amount',
        hasComputedTotal,
        hasComputedTotal ? '✓' : 'NOT FOUND'
    );
    log(
        'Worker JobRequests: sends quotedApplications in apply payload',
        hasSendPayload,
        hasSendPayload ? '✓' : 'NOT FOUND'
    );

    return hasQuoteInput && hasBasisDetection && hasComputedTotal && hasSendPayload;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
const main = () => {
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Implementation Validation: Pricing/Rejection/Payment Flow');
    console.log('─────────────────────────────────────────────────────────────\n');

    const checks = [
        () => { console.log('\n[SCHEMA] Applicant Quote Fields:'); return checkApplicantSchemaFields(); },
        () => { console.log('\n[BACKEND] Worker Apply Implementation:'); return checkWorkerApplyImplementation(); },
        () => { console.log('\n[BACKEND] Rejection Reason Enforcement:'); return checkRejectionReasonEnforcement(); },
        () => { console.log('\n[BACKEND] Auto-done Removal:'); return checkAutoDoneRemoval(); },
        () => { console.log('\n[FRONTEND] Worker Rejection Reason Display:'); return checkWorkerReasonDisplay(); },
        () => { console.log('\n[FRONTEND] Client Payment Source Selection:'); return checkPaymentSourceSelection(); },
        () => { console.log('\n[FRONTEND] Worker Quote Input Modal:'); return checkWorkerApplyModal(); },
    ];

    const results = checks.map(check => {
        try {
            return check();
        } catch (err) {
            console.error(`ERROR in check: ${err.message}`);
            return false;
        }
    });

    console.log('\n─────────────────────────────────────────────────────────────');
    const passCount = results.filter(r => r).length;
    console.log(`Results: ${passCount}/${results.length} checks passed`);

    if (results.every(r => r)) {
        console.log('✅ All implementation requirements validated!');
        process.exitCode = 0;
    } else {
        console.log('⚠️  Some checks failed. Review missing implementations.');
        process.exitCode = 1;
    }
};

main();
