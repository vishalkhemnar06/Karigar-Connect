/*
 * Normalize worker skills to the new model:
 * - Keep only valid system skills
 * - Cap to maximum 4 skills
 * - Ensure exactly one primary skill flag (isPrimary)
 *
 * Usage:
 *   node scripts/migrateWorkerSkillsPrimary.js --dry-run
 *   node scripts/migrateWorkerSkillsPrimary.js --apply
 */

const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/userModel');
const { normalizeWorkerSkillSelections } = require('../constants/workerSkills');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/karigarconnect';
const isApplyMode = process.argv.includes('--apply');

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB (${isApplyMode ? 'apply' : 'dry-run'})`);

    const workers = await User.find({ role: 'worker' }).select('_id userId karigarId name skills').lean();

    let changedCount = 0;

    for (const worker of workers) {
        const currentSkills = Array.isArray(worker.skills) ? worker.skills : [];
        const normalizedSkills = normalizeWorkerSkillSelections(currentSkills);

        const before = JSON.stringify(currentSkills.map((s) => ({
            name: String(s?.name || ''),
            isPrimary: !!s?.isPrimary,
            proficiency: s?.proficiency,
        })));
        const after = JSON.stringify(normalizedSkills);

        if (before === after) continue;
        changedCount += 1;

        const idLabel = worker.userId || worker.karigarId || String(worker._id);
        console.log(`Will update worker ${idLabel}: ${before} -> ${after}`);

        if (isApplyMode) {
            await User.updateOne({ _id: worker._id }, { $set: { skills: normalizedSkills } });
        }
    }

    console.log(`\nWorkers scanned: ${workers.length}`);
    console.log(`Workers needing update: ${changedCount}`);
    console.log(isApplyMode ? 'Updates applied.' : 'Dry-run complete. Use --apply to persist changes.');

    await mongoose.disconnect();
}

run().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
