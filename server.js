const express = require('express');
const cors = require('cors');
const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const supportRoutes = require('./supportRoutes');
const adminRoutes = require('./adminRoutes'); // Import admin routes
const notificationRoutes = require('./notificationRoutes'); // Import notification routes
const fetch = require('node-fetch'); // You might need to install this: npm install node-fetch@2
const path = require('path'); // Import the path module
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const logger = require('./logger');
const crypto = require('crypto');
const db = require('./database');
const { getRates } = require('./rates');

const app = express();
const PORT = process.env.PORT || 5008;

// Simple in-memory cache for news to reduce API calls and improve performance
const newsCache = {
    data: null,
    lastFetch: 0,
    cacheDuration: 15 * 60 * 1000, // Cache for 15 minutes
};

// Middleware
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore' })); // Serve static files from the 'public' directory

// Apply security headers. A functional CSP for the current architecture.
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net/npm/chart.js"], // 'unsafe-inline' is required for inline scripts in static HTML
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"], // 'unsafe-inline' is required for inline styles
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://www.cryptocompare.com"],
        connectSrc: ["'self'", "https://min-api.cryptocompare.com", "https://api.coingecko.com"],
    }
}));
// Allow credentialed requests (cookies) from the frontend origin.
// If FRONTEND_ORIGIN is unset, allow same-origin by default (serving static files from same server).
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true
}));
app.use(express.json()); // Allows the server to understand JSON data
app.use(cookieParser()); // Allows the server to parse cookies

// Serve the admin login page for the /admin-login route
app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// A simple root route to confirm the server is running
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the CryptoPlexTrade API! The server is running.' });
});

// A simple endpoint to get the current user's name for the welcome message
// This requires the user to be authenticated.
const { authenticateToken } = require('./authMiddleware');
app.get('/api/user/me', authenticateToken, async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, fullname, referral_code FROM users WHERE id = ?', [req.user.userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const user = users[0];

        // If user has no referral code, generate and save one now.
        if (!user.referral_code) {
            const namePart = user.fullname.replace(/\s+/g, '').substring(0, 10).toUpperCase();
            const randomPart = crypto.randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
            user.referral_code = `CE-${namePart}${randomPart}`;
            await db.query('UPDATE users SET referral_code = ? WHERE id = ?', [user.referral_code, user.id]);
        }

        res.json({ name: user.fullname, userId: user.id, referral_code: user.referral_code, appUrl: process.env.APP_URL || `http://localhost:${PORT}` });
    } catch (error) {
        logger.error('Error fetching user /me data:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// API Routes
app.use('/api', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes); // Use admin routes
app.use('/api/support', supportRoutes);
app.use('/api/notifications', notificationRoutes); // Use notification routes

// A simple endpoint to simulate admin-controlled rates
app.get('/api/rates', (req, res) => {
    res.status(200).json(getRates());
});

// A simple proxy endpoint to fetch crypto news
app.get('/api/news', async (req, res) => {
    const now = Date.now();

    // If we have fresh data in the cache, serve it immediately.
    if (newsCache.data && (now - newsCache.lastFetch < newsCache.cacheDuration)) {
        // logger.info('Serving news from cache.');
        return res.status(200).json(newsCache.data);
    }

    try {
        // logger.info('Fetching fresh news from API.');
        const newsResponse = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
        const newsData = await newsResponse.json();
        newsCache.data = newsData; // Store data in cache
        newsCache.lastFetch = now; // Update the timestamp
        res.status(200).json(newsCache.data);
    } catch (error) {
        logger.error('News fetch error:', error);
        res.status(500).json({ message: 'Failed to fetch news' });
    }
});


// Start the server natively if run directly, or export it if imported by Vercel
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Server is running on http://localhost:${PORT}`);
        logger.info(`Admin portal is available at http://localhost:${PORT}/admin-login`);
    });
}

module.exports = app;