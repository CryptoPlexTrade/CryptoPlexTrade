const { authenticateToken } = require('./authMiddleware');

function adminOnly(req, res, next) {
    // This middleware must run AFTER authenticateToken
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Admin access required.' });
    }
}

module.exports = { adminOnly };