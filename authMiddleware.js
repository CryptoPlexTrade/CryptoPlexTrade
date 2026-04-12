const jwt = require('jsonwebtoken');

// ── Regular user sessions (cookie: "token") ──────────────────
function authenticateToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('JWT Verification Error:', error.message);
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
}

// ── Admin sessions (cookie: "admin-token") ───────────────────
// Kept separate so a regular user logged in on the same browser
// is NOT kicked out when an admin logs into the admin portal,
// and vice-versa. Each role has its own independent cookie slot.
function authenticateAdminToken(req, res, next) {
    const token = req.cookies['admin-token'];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No admin token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Admin JWT Verification Error:', error.message);
        return res.status(403).json({ message: 'Invalid or expired admin token.' });
    }
}

module.exports = { authenticateToken, authenticateAdminToken };