const express = require('express');
const { getVisitorCount, recordUniqueVisitor } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/visitors', getVisitorCount);
router.post('/visitors', recordUniqueVisitor);

module.exports = router;
