// server/controllers/workerController.js (append at end)
// API: GET /api/worker/shopping-history
// Returns all transactions for the logged-in worker, with shop and product details

const Transaction = require('../models/transactionModel');
const Shop = require('../models/shopModel');
const Product = require('../models/productModel');

exports.getShoppingHistory = async (req, res) => {
    try {
        const workerId = req.user.id;
        const txns = await Transaction.find({ worker: workerId })
            .populate('shop', 'shopName address city pincode locality category shopLogo')
            .populate('product', 'name price description image')
            .populate('coupon', 'code discountPct')
            .sort({ createdAt: -1 });
        res.json(txns);
    } catch (err) {
        console.error('getShoppingHistory:', err);
        res.status(500).json({ message: 'Failed to fetch shopping history.' });
    }
};
