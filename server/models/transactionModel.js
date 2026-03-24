// server/models/transactionModel.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    shop:           { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    worker:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coupon:         { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
    product:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productPhoto:   { type: String },          // photo uploaded at purchase time
    originalPrice:  { type: Number, required: true },
    discountPct:    { type: Number, required: true },
    discountAmount: { type: Number, required: true },
    finalPrice:     { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);