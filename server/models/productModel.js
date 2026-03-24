// server/models/productModel.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    shop:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    price:       { type: Number, required: true, min: 0 },   // MRP in INR
    image:       { type: String },
    stock:       { type: Number, default: 0, min: 0 },
    isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);