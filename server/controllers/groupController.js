const mongoose = require("mongoose");
const Group = require("../models/Group");
const User = require("../models/userModel");
const generateGroupId = require("../utils/generateGroupId");

// CREATE GROUP: Admin is defined as the creatorId at the moment of creation
const createGroup = async (req, res) => {
  try {
    const { name, description, memberKarigarId } = req.body;
    const creatorId = req.user.id;

    const secondMember = await User.findOne({ karigarId: memberKarigarId });
    if (!secondMember) return res.status(404).json({ msg: "Member not found" });

    if (secondMember._id.toString() === creatorId) {
      return res.status(400).json({ msg: "Cannot add yourself" });
    }

    const groupId = await generateGroupId();

    const group = await Group.create({
      groupId,
      name,
      description,
      creator: creatorId, // Sets the primary admin
      members: [creatorId, secondMember._id],
    });

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// GET MY GROUPS: Enhanced with a server-side isAdmin flag
const getMyGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const groups = await Group.find({ members: userId })
      .populate("members", "name karigarId photo")
      .sort({ createdAt: -1 })
      .lean(); // Converts to plain JS objects to allow adding the isAdmin flag

    // Attach isAdmin flag based on the database creator field
    const enrichedGroups = groups.map(group => ({
      ...group,
      isAdmin: group.creator.toString() === userId
    }));

    res.json(enrichedGroups);
  } catch (err) {
    console.error("GET MY GROUPS ERROR:", err);
    res.status(500).json({ msg: err.message });
  }
};

// ADD MEMBER: Restricted strictly to the group creator
const addMember = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { karigarId } = req.body;

    const group = await Group.findOne({ groupId });
    if (!group) return res.status(404).json({ msg: "Group not found" });

    // Admin Verification
    if (group.creator.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only the creator can add members" });
    }

    const worker = await User.findOne({ karigarId });
    if (!worker) return res.status(404).json({ msg: "Worker not found" });

    // Use atomic update to prevent duplicate members
    const updatedGroup = await Group.findOneAndUpdate(
      { groupId, members: { $ne: worker._id } },
      { $push: { members: worker._id } },
      { new: true }
    ).populate("members", "name karigarId photo");

    if (!updatedGroup) return res.status(400).json({ msg: "Worker already in group" });

    res.json(updatedGroup);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// LEAVE GROUP: Any member can leave; Creators are blocked to prevent "ownerless" groups
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

// EDIT GROUP: Restricted strictly to the group creator
const editGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    const group = await Group.findOne({ groupId });
    if (!group) return res.status(404).json({ msg: "Group not found" });

    if (group.creator.toString() !== req.user.id) {
      return res.status(403).json({ msg: "Only creator can edit" });
    }

    if (name) group.name = name;
    if (description) group.description = description;

    await group.save();
    res.json(group);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
};

// DELETE GROUP: Restricted strictly to the group creator
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

module.exports = {
  createGroup,
  getMyGroups,
  addMember,
  leaveGroup,
  editGroup,
  deleteGroup,
};