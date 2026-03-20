// models/Group.js — no changes needed, clean original
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    groupId: { type: String, unique: true, required: true },
    name:    { type: String, required: true },
    description: String,
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

groupSchema.index({ members: 1 });
groupSchema.index({ creator: 1 });

module.exports = mongoose.model('Group', groupSchema);