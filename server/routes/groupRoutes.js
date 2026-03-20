// routes/groupRoutes.js
// FIXES:
//  1. Added worker role guard — groups are only for workers.
//     Original had protect but no role check, so clients could create worker groups.

const express = require('express');
const router  = express.Router();
const { protect, worker } = require('../middleware/authMiddleware');
const {
    createGroup, getMyGroups, addMember,
    leaveGroup, editGroup, deleteGroup,
} = require('../controllers/groupController');

// All group routes: must be authenticated AND be a worker
router.use(protect, worker);

router.post('/',                createGroup);
router.get('/my',               getMyGroups);
router.put('/:groupId/add',     addMember);
router.put('/:groupId/leave',   leaveGroup);
router.put('/:groupId',         editGroup);
router.delete('/:groupId',      deleteGroup);

module.exports = router;