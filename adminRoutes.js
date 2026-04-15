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
router.get('/rates', async (req, res) => {
    res.json(await getRates());
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
// === ANNOUNCEMENT MANAGEMENT ===
const announcement = require('./announcementManager');

// Admin: Get current announcement
router.get('/announcement', async (req, res) => {
    res.json(await announcement.get());
});

// Admin: Update announcement
router.put('/announcement', async (req, res) => {
    const { active, title, message } = req.body;
    if (active && (!title || !message)) {
        return res.status(400).json({ message: 'Title and message are required for an active announcement.' });
    }
    const data = {
        active: !!active,
        title: title || '',
        message: message || '',
        updatedAt: new Date().toISOString()
    };
    await announcement.save(data);
    logger.info(`Announcement updated: active=${data.active}, title="${data.title}"`);
    res.json({ message: 'Announcement saved successfully.', data });
});

// === MAINTENANCE MODE ===
const maintenance = require('./maintenanceManager');

// Admin: Get maintenance status
router.get('/maintenance', async (req, res) => {
    res.json(await maintenance.get());
});

// Admin: Toggle maintenance mode
router.put('/maintenance', async (req, res) => {
    const { active, message } = req.body;
    const data = {
        active: !!active,
        message: message || 'We\'re performing scheduled maintenance. We\'ll be back shortly!',
        updatedAt: new Date().toISOString()
    };
    await maintenance.save(data);
    logger.info(`Maintenance mode ${data.active ? 'ENABLED' : 'DISABLED'} by admin`);
    res.json({ message: `Maintenance mode ${data.active ? 'enabled' : 'disabled'}.`, data });
});

// === PAYMENT METHODS MANAGEMENT ===
const paymentMethods = require('./paymentMethodsManager');

// Admin: Get current payment methods
router.get('/payment-methods', async (req, res) => {
    res.json(await paymentMethods.get());
});

// Admin: Update payment methods
router.put('/payment-methods', async (req, res) => {
    const { momoAccounts, bank, wallets } = req.body;
    if (!bank) {
        return res.status(400).json({ message: 'Bank details are required.' });
    }
    const data = {
        momoAccounts: Array.isArray(momoAccounts) ? momoAccounts.map(m => ({
            recipientName: (m.recipientName || '').trim(),
            number: (m.number || '').trim(),
            network: (m.network || 'MTN').trim()
        })).filter(m => m.number) : [],
        bank: {
            bankName: (bank.bankName || '').trim(),
            accountName: (bank.accountName || '').trim(),
            accountNumber: (bank.accountNumber || '').trim()
        },
        wallets: {
            BTC: (wallets?.BTC || '').trim(),
            ETH: (wallets?.ETH || '').trim(),
            USDT_TRC20: (wallets?.USDT_TRC20 || '').trim(),
            USDT_ERC20: (wallets?.USDT_ERC20 || '').trim()
        },
        updatedAt: new Date().toISOString()
    };
    await paymentMethods.save(data);
    logger.info('Payment methods updated by admin');
    res.json({ message: 'Payment methods updated successfully.', data });
});

// === ADMIN CHANGE PASSWORD ===
const bcrypt = require('bcryptjs');

router.put('/change-password', async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }

    try {
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Admin user not found.' });
        }

        const isMatch = await bcrypt.compare(currentPassword, users[0].password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.userId]);

        logger.info(`Admin password changed successfully for user ID ${req.user.userId}`);
        res.json({ message: 'Password changed successfully!' });
    } catch (err) {
        logger.error('Admin change password error:', err);
        res.status(500).json({ message: 'Server error while changing password.' });
    }
});

module.exports = router;