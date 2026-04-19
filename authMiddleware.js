const jwt = require('jsonwebtoken');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── Regular user sessions (cookie: "token") ──────────────────
function authenticateToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        // CSRF check: reject mutating requests without a valid X-CSRF-Token header.
        // The header value must match the csrfToken embedded in the JWT payload.
        if (!SAFE_METHODS.has(req.method)) {
            const headerToken = req.headers['x-csrf-token'];
            if (!headerToken || headerToken !== decoded.csrfToken) {
                return res.status(403).json({ message: 'Invalid CSRF token.' });
            }
        }

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

        // CSRF check for admin sessions
        if (!SAFE_METHODS.has(req.method)) {
            const headerToken = req.headers['x-csrf-token'];
            if (!headerToken || headerToken !== decoded.csrfToken) {
                return res.status(403).json({ message: 'Invalid CSRF token.' });
            }
        }

        next();
    } catch (error) {
        console.error('Admin JWT Verification Error:', error.message);
        return res.status(403).json({ message: 'Invalid or expired admin token.' });
    }
}

// ── validateCsrf ─────────────────────────────────────────────
// CSRF is now enforced inside authenticateToken and
// authenticateAdminToken above. This export is kept as a no-op
// passthrough so any existing app.use('/api', validateCsrf) call
// in server.js remains harmless without needing a code change there.
function validateCsrf(req, res, next) { next(); }

module.exports = { authenticateToken, authenticateAdminToken, validateCsrf };