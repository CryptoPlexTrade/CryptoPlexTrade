const express = require('express');
const db = require('./database');
const { authenticateAdminToken } = require('./authMiddleware');
const { adminOnly } = require('./adminAuthMiddleware');
const { getRates, setRates } = require('./rates');
const logger = require('./logger');

const router = express.Router();

// All admin routes require an admin-token cookie AND admin role
router.use(authenticateAdminToken, adminOnly);

// === ADMIN DASHBOARD STATS ===
router.get('/stats', async (req, res) => {
    try {
        const [[userCount]] = await db.query('SELECT COUNT(*) as count FROM users');
        const [[orderCount]] = await db.query('SELECT COUNT(*) as count FROM orders');
        const [[ticketCount]] = await db.query("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'");
        res.json({
            users: userCount.count,
            orders: orderCount.count,
            openTickets: ticketCount.count,
        });
    } catch (error) {
        logger.error('Admin stats fetch error:', error);
        res.status(500).json({ message: 'Server error fetching stats.' });
    }
});

// === ORDER MANAGEMENT ===
router.get('/orders', async (req, res) => {
    try {
        const [orders] = await db.query('SELECT o.*, u.email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC');
        res.json(orders);
    } catch (error) {
        logger.error('Admin orders fetch error:', error);
        res.status(500).json({ message: 'Server error fetching orders.' });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        const [orders] = await db.query('SELECT o.*, u.email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?', [req.params.id]);
        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found.' });
        }
        res.json(orders[0]);
    } catch (error) {
        logger.error(`Admin order fetch error for ID ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error fetching order details.' });
    }
});

router.put('/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!status) {
        return res.status(400).json({ message: 'Status is required.' });
    }
    try {
        await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Order status updated successfully.' });
    } catch (error) {
        logger.error('Admin order status update error:', error);
        res.status(500).json({ message: 'Server error updating order status.' });
    }
});

// === SUPPORT TICKET MANAGEMENT ===
router.get('/tickets', async (req, res) => {
    try {
        const [tickets] = await db.query('SELECT t.*, u.email FROM support_tickets t JOIN users u ON t.user_id = u.id ORDER BY t.updated_at DESC');
        res.json(tickets);
    } catch (error) {
        logger.error('Admin tickets fetch error:', error);
        res.status(500).json({ message: 'Server error fetching tickets.' });
    }
});

// GET a single ticket with its replies (admin version — no user auth required)
router.get('/tickets/:id', async (req, res) => {
    try {
        const [tickets] = await db.query(
            'SELECT t.*, u.email FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ?',
            [req.params.id]
        );
        if (tickets.length === 0) {
            return res.status(404).json({ message: 'Ticket not found.' });
        }
        const [replies] = await db.query(
            'SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json({ ticket: tickets[0], replies });
    } catch (error) {
        logger.error(`Admin ticket detail fetch error for ID ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error fetching ticket details.' });
    }
});

router.post('/tickets/:id/reply', async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ message: 'Reply message cannot be empty.' });
    }
    try {
        await db.query('INSERT INTO ticket_replies (ticket_id, user_id, message, is_admin) VALUES (?, ?, ?, ?)', [req.params.id, req.user.userId, message, true]);
        await db.query("UPDATE support_tickets SET status = 'answered', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);
        res.status(201).json({ message: 'Admin reply added successfully.' });
    } catch (error) {
        logger.error('Admin reply error:', error);
        res.status(500).json({ message: 'Server error adding reply.' });
    }
});

// === RATE MANAGEMENT ===
router.get('/rates', (req, res) => {
    res.json(getRates());
});

router.put('/rates', async (req, res) => {
    const newRates = req.body;
    if (!newRates.BTC || !newRates.ETH || !newRates.USDT_TRC20 || !newRates.USDT_ERC20) {
        return res.status(400).json({ message: 'Incomplete rate information provided. Ensure all currencies are present.' });
    }
    try {
        await setRates(newRates);
        res.json({ message: 'Rates updated successfully.' });
    } catch (error) {
        logger.error('Admin rate update error:', error);
        res.status(500).json({ message: 'Server error updating rates.' });
    }
});

// === USER MANAGEMENT ===
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, fullname, email, phone, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.status(200).json(users);
    } catch (error) {
        logger.error('Error fetching all users:', error);
        res.status(500).json({ message: 'Server error while fetching users.' });
    }
});

// === REFERRAL MANAGEMENT ===
router.get('/referrals', async (req, res) => {
    try {
        const [referrals] = await db.query(`
            SELECT
                referrer.fullname AS referrer_name,
                referrer.email AS referrer_email,
                referred.fullname AS referred_name,
                referred.email AS referred_email,
                referred.created_at AS referred_join_date,
                (SELECT COUNT(*) FROM orders WHERE user_id = referred.id) > 0 AS has_transacted
            FROM users AS referred
            JOIN users AS referrer ON referred.referred_by_id = referrer.id
            WHERE referred.referred_by_id IS NOT NULL
            ORDER BY referred.created_at DESC
        `);
        res.status(200).json(referrals);
    } catch (error) {
        logger.error('Error fetching referral data:', error);
        res.status(500).json({ message: 'Server error while fetching referral data.' });
    }
});

module.exports = router;