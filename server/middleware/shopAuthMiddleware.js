// server/middleware/shopAuthMiddleware.js
const jwt  = require('jsonwebtoken');
const Shop = require('../models/shopModel');

exports.protectShop = async (req, res, next) => {
    try {
        const header = req.headers.authorization;
        if (!header || !header.startsWith('Bearer '))
            return res.status(401).json({ message: 'Not authorised.' });

        const token = header.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.role !== 'shop')
            return res.status(403).json({ message: 'Access denied.' });

        const shop = await Shop.findById(decoded.id).select('-password');
        if (!shop) return res.status(401).json({ message: 'Shop not found.' });
        if (shop.verificationStatus !== 'approved')
            return res.status(403).json({ message: 'Shop not approved.' });

        req.shop = { id: shop._id.toString(), ...shop.toObject() };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token invalid.' });
    }
};