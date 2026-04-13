// server/controllers/groupController.js
// Added: getAllGroupsPublic, getGroupByIdPublic — for client browsing
// All original functions preserved exactly

const mongoose = require("mongoose");
const Group = require("../models/Group");
const User  = require("../models/userModel");
const generateGroupId = require("../utils/generateGroupId");

const findUserByIdentifier = (identifier) => {
  const value = String(identifier || '').trim();
  if (!value) return null;
  return User.findOne({
    $or: [
      { userId: value },
      { karigarId: value },
    ],
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EXISTING — unchanged
// ─────────────────────────────────────────────────────────────────────────────

const createGroup = async (req, res) => {
  try {
    const { name, description, memberUserId, memberKarigarId } = req.body;
    const creatorId = req.user.id;
    const memberIdentifier = memberUserId || memberKarigarId;

    const secondMember = await findUserByIdentifier(memberIdentifier);
    if (!secondMember) return res.status(404).json({ msg: "Member not found" });

    if (secondMember._id.toString() === creatorId) {
      return res.status(400).json({ msg: "Cannot add yourself" });
    }

    const groupId = await generateGroupId();

    const group = await Group.create({
      groupId,
      name,
      description,
      creator: creatorId,
      members: [creatorId, secondMember._id],
    });

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

const getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await Group.find({ members: userId })
      .populate("members", "name userId karigarId photo skills overallExperience mobile email")
      .sort({ createdAt: -1 })
      .lean();

    const enrichedGroups = groups.map(group => ({
      ...group,
      isAdmin: group.creator.toString() === userId,
    }));

    res.json(enrichedGroups);
  } catch (err) {
    console.error("GET MY GROUPS ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
};

const addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId, karigarId } = req.body;
    const memberIdentifier = userId || karigarId;

    const group = await Group.findOne({ groupId });
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (group.creator.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only the creator can add members" });
    }

    const worker = await findUserByIdentifier(memberIdentifier);
    if (!worker) return res.status(404).json({ msg: "Worker not found" });

    const updatedGroup = await Group.findOneAndUpdate(
      { groupId, members: { $ne: worker._id } },
      { $push: { members: worker._id } },
      { new: true }
    ).populate("members", "name userId karigarId photo skills overallExperience mobile email");

    if (!updatedGroup) return res.status(400).json({ msg: "Worker already in group" });

    res.json(updatedGroup);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findOne({ groupId });
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (group.creator.toString() === userId) {
      return res.status(400).json({ msg: "Creators cannot leave. Delete the group instead." });
    }

    group.members = group.members.filter(m => m.toString() !== userId);
    await group.save();
    res.json({ msg: "Left group successfully" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

const editGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    const group = await Group.findOne({ groupId });
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (group.creator.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only creator can edit" });
    }

    if (name)        group.name        = name;
    if (description) group.description = description;

    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findOne({ groupId });

    if (!group) return res.status(404).json({ msg: "Group not found" });
    if (group.creator.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only creator can delete" });
    }

    await group.deleteOne();
    res.json({ msg: "Group deleted successfully" });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW — public group browsing for clients
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/groups/browse?search=&skill=&page=1
// Returns all groups with member profiles (mobile/email of admin only for client)
const getAllGroupsPublic = async (req, res) => {
  try {
    const { search, skill, page = 1, limit = 12 } = req.query;

    // Build filter
    let memberFilter = {};
    if (skill) {
      // Find workers who have the requested skill
      const workers = await User.find({
        role: 'worker',
        verificationStatus: 'approved',
        'skills.name': { $regex: new RegExp(skill, 'i') },
      }).select('_id');
      memberFilter = { members: { $in: workers.map(w => w._id) } };
    }

    let groupQuery = { ...memberFilter };

    if (search) {
      groupQuery.$or = [
        { name:        { $regex: new RegExp(search, 'i') } },
        { description: { $regex: new RegExp(search, 'i') } },
      ];
    }

    const total  = await Group.countDocuments(groupQuery);
    const groups = await Group.find(groupQuery)
      .populate({
        path:   'members',
        select: 'name userId karigarId photo skills overallExperience experience verificationStatus',
        // Do NOT include mobile/email in the member list — privacy
      })
      .populate({
        path:   'creator',
        select: 'name userId karigarId photo mobile email', // Admin contact info for client
      })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      groups,
      total,
      page:       Number(page),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error('getAllGroupsPublic error:', err);
    return res.status(500).json({ msg: 'Failed to fetch groups.' });
  }
};

// GET /api/groups/:groupId/public
// Full group detail — member profiles + admin contact
const getGroupByIdPublic = async (req, res) => {
  try {
    const group = await Group.findOne({ groupId: req.params.groupId })
      .populate({
        path:   'members',
        select: 'name userId karigarId photo skills overallExperience experience verificationStatus address',
      })
      .populate({
        path:   'creator',
        select: 'name userId karigarId photo mobile email',
      })
      .lean();

    if (!group) return res.status(404).json({ msg: 'Group not found.' });

    return res.status(200).json({ group });
  } catch (err) {
    console.error('getGroupByIdPublic error:', err);
    return res.status(500).json({ msg: 'Failed to fetch group.' });
  }
};

module.exports = {
  createGroup,
  getMyGroups,
  addMember,
  leaveGroup,
  editGroup,
  deleteGroup,
  getAllGroupsPublic,
  getGroupByIdPublic,
};