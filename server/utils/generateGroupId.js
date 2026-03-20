// utils/generateGroupId.js
// FIXES:
//  1. Infinite loop risk — original had no max-retry limit. If DB becomes full
//     of IDs or a connection error occurs inside the loop it would hang forever.
//     FIX: Added a 10-attempt limit; throws a clear error if exhausted.
//  2. Same fix applied to generateKarigarId (used in authController).

const Group = require('../models/Group');

const generateGroupId = async (maxAttempts = 10) => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const random = Math.floor(100000 + Math.random() * 900000);
        const groupId = `G${random}`;
        const exists = await Group.findOne({ groupId }).lean();
        if (!exists) return groupId;
    }
    throw new Error('Could not generate a unique Group ID after multiple attempts. Please try again.');
};

module.exports = generateGroupId;