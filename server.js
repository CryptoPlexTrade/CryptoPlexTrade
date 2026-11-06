const express = require('express');
const cors = require('cors');
const fs = require('fs');
const authRoutes = require('./authRoutes');
const orderRoutes = require('./orderRoutes');
const supportRoutes = require('./supportRoutes');
const adminRoutes = require('./adminRoutes'); // Import admin routes
const notificationRoutes = require('./notificationRoutes'); // Import notification routes
const fetch = require('node-fetch'); // You might need to install this: npm install node-fetch@2
const path = require('path'); // Import the path module
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const logger = require('./logger');
const crypto = require('crypto');
const db = require('./database');
const { getRates } = require('./rates');
const { getLiveMarketRates } = require('./marketRates');

const app = express();
const PORT = process.env.PORT || 5008;

// Simple in-memory cache for news to reduce API calls and improve performance
const newsCache = {
    data: null,
    lastFetch: 0,
    cacheDuration: 15 * 60 * 1000, // Cache for 15 minutes
};

// === MAINTENANCE MODE — shared module (Vercel-safe) ===
const maintenance = require('./maintenanceManager');

// Maintenance check BEFORE static files so dashboard pages get intercepted
const userPages = ['/index.html', '/', '/dashboard.html', '/trade.html', '/transactions.html', '/profile.html', '/support.html'];
app.use(compression()); // gzip/brotli-style compression for HTML, CSS, JS and JSON
app.use(cookieParser()); // Parse cookies early so auth guards can inspect them

app.use(async (req, res, next) => {
    try {
        const p = req.path.toLowerCase();
        if (!userPages.includes(p)) return next(); // skip the DB/cache lookup for assets and API calls
        const data = await maintenance.get();
        if (!data.active) return next();
        if (userPages.includes(p)) {
            return res.redirect('/maintenance.html');
        }
    } catch (_) {}
    next();
});

// --- Guard Protected Pages from Unauthenticated Direct Access and Browser Back Swipe ---
const userProtectedHtmlPages = [
    '/dashboard', '/dashboard.html',
    '/profile', '/profile.html',
    '/transactions', '/transactions.html',
    '/trade', '/trade.html',
    '/support', '/support.html',
    '/order_summary', '/order_summary.html',
    '/buyconfirm', '/buyconfirm.html',
    '/sell_order_summary', '/sell_order_summary.html',
    '/sell_payment_method', '/sell_payment_method.html',
    '/sell_payout_details', '/sell_payout_details.html',
    '/sell_send_crypto', '/sell_send_crypto.html',
    '/create_ticket', '/create_ticket.html',
    '/ticket_detail', '/ticket_detail.html'
];

app.use((req, res, next) => {
    const p = req.path.toLowerCase();

    // Guard Admin Portal HTML pages (excluding login page and static assets)
    if (p.startsWith('/admin') && !p.startsWith('/admin-login') && !/\.(css|js|png|jpe?g|svg|ico|webp)$/i.test(p)) {
        const adminToken = req.cookies && req.cookies['admin-token'];
        if (!adminToken) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return res.redirect('/admin-login?reason=unauthorized');
        }
        try {
            const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
            if (decoded.role !== 'admin') {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
                return res.redirect('/admin-login?reason=forbidden');
            }
        } catch (_) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return res.redirect('/admin-login?reason=session_expired');
        }
    }

    // Guard User Portal HTML pages
    if (userProtectedHtmlPages.some(protectedPage => p === protectedPage || p === protectedPage + '/')) {
        const token = req.cookies && req.cookies.token;
        if (!token) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            const requestedPage = userProtectedHtmlPages.find(page => p === page || p === page + '/');
            const redirectPage = requestedPage?.replace(/^\//, '').replace(/\/$/, '') || 'dashboard.html';
            return res.redirect(`/login.html?reason=unauthorized&redirect=${encodeURIComponent(redirectPage)}`);
        }
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (_) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
            return res.redirect('/login.html?reason=session_expired');
        }
    }

    next();
});

// Middleware
app.use(express.static(path.join(__dirname, 'public'), { 
    dotfiles: 'ignore',
    etag: true,
    setHeaders: (res, filePath) => {
        if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        } else if (/\.(css|js)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        } else {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    },
    extensions: ['html'] // This allows extensionless URLs (e.g. /login instead of /login.html)
})); // Serve static files from the 'public' directory
// Apply security headers. A functional CSP for the current architecture.
app.use(helmet.contentSecurityPolicy({
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net/npm/chart.js"], // 'unsafe-inline' is required for inline scripts in static HTML
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"], // 'unsafe-inline' is required for inline styles
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "https://www.cryptocompare.com", "https://assets.coingecko.com"],
        connectSrc: ["'self'", "https://min-api.cryptocompare.com", "https://api.coingecko.com", "https://api.binance.com"],
    }
}));
// Allow credentialed requests (cookies) from the frontend origin.
// If FRONTEND_ORIGIN is unset, allow same-origin by default (serving static files from same server).
app.use(cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true
}));
app.use(express.json()); // Allows the server to understand JSON data

// Public endpoint to check maintenance status
app.get('/api/maintenance', async (req, res) => {
    const data = await maintenance.get();
    res.json({ active: data.active, message: data.message || '' });
});

// Public endpoint to get payment method details (for buy/sell pages)
const paymentMethods = require('./paymentMethodsManager');
app.get('/api/payment-methods', async (req, res) => {
    res.json(await paymentMethods.get());
});

// Block user API calls during maintenance (but allow admin API, login, and maintenance check)
app.use(async (req, res, next) => {
    try {
        const data = await maintenance.get();
        if (!data.active) return next();
        const p = req.path.toLowerCase();
        if (p.startsWith('/api/') && !p.startsWith('/api/admin') && !p.startsWith('/api/maintenance') && !p.startsWith('/api/login') && !p.startsWith('/api/register')) {
            return res.status(503).json({ message: data.message || 'Site is under maintenance.' });
        }
    } catch (_) {}
    next();
});

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

// Live Chat routes
const { publicRouter: chatPublic, adminRouter: chatAdmin } = require('./chatRoutes');
app.use('/api/chat', chatPublic);
app.use('/api/admin/chat', chatAdmin);

// A simple endpoint to simulate admin-controlled rates
app.get('/api/rates', async (req, res) => {
    res.status(200).json(await getRates());
});

// Live market rates endpoint (Binance / CoinGecko feed for tickers & rates table)
app.get('/api/market-rates', async (req, res) => {
    try {
        const data = await getLiveMarketRates();
        res.status(200).json(data);
    } catch (err) {
        logger.error('Error in /api/market-rates:', err);
        res.status(500).json({ error: 'Failed to fetch market rates' });
    }
});

// Public endpoint to get active announcement (no auth needed)
const announcementMgr = require('./announcementManager');
app.get('/api/announcement', async (req, res) => {
    try {
        const data = await announcementMgr.get();
        if (data.active) {
            res.json({ active: true, title: data.title, message: data.message, updatedAt: data.updatedAt });
        } else {
            res.json({ active: false });
        }
    } catch {
        res.json({ active: false });
    }
});

// A simple proxy endpoint to fetch crypto news
app.get('/api/news', async (req, res) => {
    const now = Date.now();

    // If we have fresh data in the cache, serve it immediately.
    if (newsCache.data && (now - newsCache.lastFetch < newsCache.cacheDuration)) {
        return res.status(200).json(newsCache.data);
    }

    try {
        // Try CryptoCompare first (with optional api_key from .env)
        const apiKey = process.env.CRYPTOCOMPARE_API_KEY || '';
        const ccUrl = `https://min-api.cryptocompare.com/data/v2/news/?lang=EN${apiKey ? '&api_key=' + apiKey : ''}`;
        const newsResponse = await fetch(ccUrl);
        const newsData = await newsResponse.json();
        
        // If CryptoCompare returns valid articles, cache and return them
        if (newsData.Data && Array.isArray(newsData.Data) && newsData.Data.length > 0) {
            newsCache.data = newsData;
            newsCache.lastFetch = now;
            return res.status(200).json(newsCache.data);
        }

        // CryptoCompare returned empty — use fallback headlines
        throw new Error('No articles from CryptoCompare');
    } catch (error) {
        logger.warn('News: CryptoCompare unavailable, using fallback headlines.');
        // Return hardcoded placeholder news so the section isn't empty
        res.status(200).json({
            Data: [
                { title: 'Bitcoin continues to dominate the crypto market', url: 'https://www.coingecko.com', source: 'CryptoPlexTrade' },
                { title: 'Ethereum upgrades drive network efficiency', url: 'https://www.coingecko.com', source: 'CryptoPlexTrade' },
                { title: 'USDT remains the top stablecoin by volume', url: 'https://www.coingecko.com', source: 'CryptoPlexTrade' },
                { title: 'Crypto adoption grows across emerging markets', url: 'https://www.coingecko.com', source: 'CryptoPlexTrade' },
                { title: 'Regulatory clarity brings institutional investors', url: 'https://www.coingecko.com', source: 'CryptoPlexTrade' }
            ]
        });
    }
});


// Start the server natively if run directly, or export it if imported by Vercel
if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`Server is running on http://localhost:${PORT}`);
        logger.info(`Admin portal is available at http://localhost:${PORT}/admin-login`);
        
        // Initialize weekly automated KYC document export routine
        try {
            const { initKycWeeklyScheduler } = require('./kycExporter');
            initKycWeeklyScheduler();
        } catch (e) {
            logger.error('Failed to initialize KYC weekly scheduler:', e);
        }
    });
}

module.exports = app;