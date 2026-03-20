// server/routes/groupRoutes.js
// Added: public group browse routes (for clients)
// All original routes preserved exactly

const express = require('express');
const router  = express.Router();
const { protect, worker, client } = require('../middleware/authMiddleware');
const {
    createGroup,
    getMyGroups,
    addMember,
    leaveGroup,
    editGroup,
    deleteGroup,
    getAllGroupsPublic,
    getGroupByIdPublic,
} = require('../controllers/groupController');

// ── PUBLIC BROWSE (clients) ────────────────────────────────────────────────
// GET /api/groups/browse?search=&skill=&page=1
router.get('/browse',              protect, client, getAllGroupsPublic);

// GET /api/groups/:groupId/public
router.get('/:groupId/public',     protect, client, getGroupByIdPublic);

// ── WORKER ROUTES (unchanged) ──────────────────────────────────────────────
// All group management routes: authenticated workers only
router.post('/',                   protect, worker, createGroup);
router.get('/my',                  protect, worker, getMyGroups);
router.put('/:groupId/add',        protect, worker, addMember);
router.put('/:groupId/leave',      protect, worker, leaveGroup);
router.put('/:groupId',            protect, worker, editGroup);
router.delete('/:groupId',         protect, worker, deleteGroup);

module.exports = router;