// server/controllers/shopController.js
// FIXED: normPath() applied to every req.file / req.files save so paths are
//        stored as  "uploads/filename"  (forward slashes, relative, no drive letter).
//        Express serves these at  GET /uploads/filename  via the static middleware.

const Shop        = require('../models/shopModel');
const Product     = require('../models/productModel');
const Coupon      = require('../models/couponModel');
const Transaction = require('../models/transactionModel');
const path        = require('path');

// ── PATH NORMALISATION (same helper as shopAuthController) ────────────────────
const normPath = (filePath) => {
    if (!filePath) return null;
    const normalised = filePath.replace(/\\/g, '/');
    const idx = normalised.indexOf('uploads/');
    if (idx !== -1) return normalised.slice(idx);
    return `uploads/${path.basename(normalised)}`;
};

// ── PROFILE ───────────────────────────────────────────────────────────────────
exports.getShopProfile = async (req, res) => {
    try {
        const shop = await Shop.findById(req.shop.id).select('-password');
        if (!shop) return res.status(404).json({ message: 'Shop not found.' });
        return res.json(shop);
    } catch (err) {
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.updateShopProfile = async (req, res) => {
    try {
        const shop = await Shop.findById(req.shop.id);
        if (!shop) return res.status(404).json({ message: 'Not found.' });

        const fields = ['shopName', 'ownerName', 'address', 'city', 'pincode', 'locality', 'gstNumber', 'category'];
        fields.forEach(f => { if (req.body[f] !== undefined) shop[f] = req.body[f]; });

        const files = req.files || {};
        if (files.shopLogo?.[0])   shop.shopLogo   = normPath(files.shopLogo[0].path);
        if (files.ownerPhoto?.[0]) shop.ownerPhoto = normPath(files.ownerPhoto[0].path);

        await shop.save({ validateBeforeSave: false });
        return res.json(shop);
    } catch (err) {
        console.error('updateShopProfile:', err);
        return res.status(500).json({ message: 'Update failed.' });
    }
};

exports.deleteShopAccount = async (req, res) => {
    try {
        const shop = await Shop.findById(req.shop.id);
        if (!shop) return res.status(404).json({ message: 'Shop not found.' });

        // Delete all products associated with this shop
        await Product.deleteMany({ shop: req.shop.id });

        // Delete all transactions associated with this shop
        await Transaction.deleteMany({ shop: req.shop.id });

        // Delete all coupons associated with this shop
        await Coupon.deleteMany({ shop: req.shop.id });

        // Delete the shop itself
        await Shop.findByIdAndDelete(req.shop.id);

        return res.json({ message: 'Account deleted successfully.' });
    } catch (err) {
        console.error('deleteShopAccount:', err);
        return res.status(500).json({ message: 'Account deletion failed.' });
    }
};

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({ shop: req.shop.id }).sort({ createdAt: -1 });
        return res.json(products);
    } catch {
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.addProduct = async (req, res) => {
    try {
        const { name, description, price, stock } = req.body;
        if (!name || !price) return res.status(400).json({ message: 'Name and price required.' });

        const image = normPath(req.file?.path);   // ← FIX: normalise path
        const product = await Product.create({
            shop: req.shop.id,
            name,
            description: description || '',
            price:  Number(price),
            stock:  Number(stock) || 0,
            image,
        });
        return res.status(201).json(product);
    } catch (err) {
        console.error('addProduct:', err);
        return res.status(500).json({ message: err.message });
    }
};

exports.editProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, shop: req.shop.id });
        if (!product) return res.status(404).json({ message: 'Not found.' });

        const { name, description, price, stock } = req.body;
        if (name !== undefined)        product.name        = name;
        if (description !== undefined) product.description = description;
        if (price !== undefined)       product.price       = Number(price);
        if (stock !== undefined)       product.stock       = Number(stock);
        if (req.file)                  product.image       = normPath(req.file.path);  // ← FIX

        await product.save();
        return res.json(product);
    } catch (err) {
        console.error('editProduct:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        await Product.findOneAndDelete({ _id: req.params.id, shop: req.shop.id });
        return res.json({ message: 'Deleted.' });
    } catch {
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ── COUPON VERIFICATION ───────────────────────────────────────────────────────
exports.verifyCoupon = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ message: 'Coupon code required.' });

        const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() })
            .populate('worker', 'name karigarId photo points experience');

        if (!coupon)       return res.status(404).json({ message: 'Invalid coupon code.' });
        if (coupon.isUsed) return res.status(400).json({ message: 'This coupon has already been used.' });
        if (new Date() > coupon.expiresAt) return res.status(400).json({ message: 'This coupon has expired.' });

        return res.json({
            valid: true,
            coupon: {
                _id:         coupon._id,
                code:        coupon.code,
                discountPct: coupon.discountPct,
                expiresAt:   coupon.expiresAt,
                worker:      coupon.worker,
            },
        });
    } catch (err) {
        console.error('verifyCoupon:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ── APPLY COUPON & RECORD TRANSACTION ─────────────────────────────────────────
exports.applyCoupon = async (req, res) => {
    try {
        const { couponCode, productId } = req.body;

        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase().trim() });
        if (!coupon || coupon.isUsed || new Date() > coupon.expiresAt)
            return res.status(400).json({ message: 'Invalid or expired coupon.' });

        const product = await Product.findOne({ _id: productId, shop: req.shop.id });
        if (!product) return res.status(404).json({ message: 'Product not found.' });
        if (product.price < 1000)
            return res.status(400).json({ message: 'Discount only applies on products with MRP ≥ ₹1000.' });
        if (product.stock < 1)
            return res.status(400).json({ message: 'Product is out of stock.' });

        const productPhoto   = normPath(req.file?.path);   // ← FIX
        const discountAmount = Math.round((coupon.discountPct / 100) * product.price);
        const finalPrice     = product.price - discountAmount;

        // Mark coupon used
        coupon.isUsed = true;
        coupon.usedAt = new Date();
        coupon.usedBy = req.shop.id;
        await coupon.save();

        // Decrease stock
        product.stock -= 1;
        await product.save();

        // Record transaction
        const txn = await Transaction.create({
            shop:           req.shop.id,
            worker:         coupon.worker,
            coupon:         coupon._id,
            product:        product._id,
            productPhoto,
            originalPrice:  product.price,
            discountPct:    coupon.discountPct,
            discountAmount,
            finalPrice,
        });

        // Update shop analytics
        await Shop.findByIdAndUpdate(req.shop.id, {
            $inc: { totalSales: finalPrice, totalDiscounts: discountAmount, totalWorkers: 1 },
        });

        return res.json({ message: 'Coupon applied successfully.', transaction: txn, finalPrice, discountAmount });
    } catch (err) {
        console.error('applyCoupon:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ── TRANSACTION HISTORY ───────────────────────────────────────────────────────
exports.getTransactions = async (req, res) => {
    try {
        const txns = await Transaction.find({ shop: req.shop.id })
            .populate('worker',  'name karigarId photo')
            .populate('product', 'name price image')
            .populate('coupon',  'code discountPct')
            .sort({ createdAt: -1 });
        return res.json(txns);
    } catch {
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ── DASHBOARD ANALYTICS ───────────────────────────────────────────────────────
exports.getShopAnalytics = async (req, res) => {
    try {
        const shopId = req.shop.id;

        const [shop, txns] = await Promise.all([
            Shop.findById(shopId).select('totalSales totalDiscounts totalWorkers'),
            Transaction.find({ shop: shopId }).populate('product', 'name'),
        ]);

        const productCount = {};
        txns.forEach(t => {
            const key = t.product?._id?.toString();
            if (!key) return;
            if (!productCount[key]) productCount[key] = { name: t.product.name, count: 0 };
            productCount[key].count++;
        });
        const mostSold = Object.values(productCount)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return res.json({
            totalSales:     shop.totalSales,
            totalDiscounts: shop.totalDiscounts,
            totalWorkers:   shop.totalWorkers,
            totalTxns:      txns.length,
            mostSold,
        });
    } catch (err) {
        console.error('getShopAnalytics:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ── ALL SHOPS (public, for workers) ──────────────────────────────────────────
exports.getAllApprovedShops = async (req, res) => {
    try {
        const shops = await Shop.find({ verificationStatus: 'approved' })
            .select('-password'); // exclude only sensitive
        
        return res.json(shops);
    } catch (err) {
        console.error('getAllApprovedShops:', err);
        return res.status(500).json({ message: 'Failed.' });
    }
};

// ── SHOP PRODUCTS (public, for workers) ──────────────────────────────────────
exports.getShopProducts = async (req, res) => {
    try {
        const products = await Product.find({ shop: req.params.shopId, isActive: true })
            .sort({ createdAt: -1 });
        return res.json(products);
    } catch {
        return res.status(500).json({ message: 'Failed.' });
    }
};