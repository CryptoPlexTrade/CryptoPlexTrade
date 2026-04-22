const express = require('express');
const db = require('./database');
const { authenticateAdminToken } = require('./authMiddleware');
const { adminOnly } = require('./adminAuthMiddleware');
const { getRates, setRates } = require('./rates');
const { sendOrderCompletedEmail, sendKycApprovedEmail, sendKycRejectedEmail, sendKycBackupEmail } = require('./emailService');
const { ORDER_STATUS } = require('./constants');
const logger = require('./logger');

const router = express.Router();

// All admin routes require an admin-token cookie AND admin role
router.use(authenticateAdminToken, adminOnly);

// === ADMIN DASHBOARD STATS ===
router.get('/stats', async (req, res) => {
    try {
        const [[userCount]] = await db.query("SELECT COUNT(*) as count FROM users WHERE is_verified = TRUE OR role = 'admin'");
        const [[orderCount]] = await db.query('SELECT COUNT(*) as count FROM orders');
        const [[ticketCount]] = await db.query("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'");

        // Buy totals (completed)
        const [[buyCompleted]] = await db.query(
            "SELECT COALESCE(COUNT(*),0) as count, COALESCE(SUM(total_paid),0) as total FROM orders WHERE order_type = 'buy' AND status = 'completed'"
        );
        // Sell totals (completed)
        const [[sellCompleted]] = await db.query(
            "SELECT COALESCE(COUNT(*),0) as count, COALESCE(SUM(total_paid),0) as total FROM orders WHERE order_type = 'sell' AND status = 'completed'"
        );
        // Pending orders
        const [[pendingOrders]] = await db.query(
            "SELECT COALESCE(COUNT(*),0) as count FROM orders WHERE status != 'completed' AND status != 'failed' AND status != 'cancelled'"
        );
        // Total revenue (all completed)
        const [[totalRevenue]] = await db.query(
            "SELECT COALESCE(SUM(total_paid),0) as total FROM orders WHERE status = 'completed'"
        );

        res.json({
            users: userCount.count,
            orders: orderCount.count,
            openTickets: ticketCount.count,
            pendingOrders: pendingOrders.count,
            buyCompleted: { count: buyCompleted.count, total: parseFloat(buyCompleted.total) },
            sellCompleted: { count: sellCompleted.count, total: parseFloat(sellCompleted.total) },
            totalRevenue: parseFloat(totalRevenue.total),
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
    // Validate against the defined set of allowed statuses
    const ALLOWED_STATUSES = Object.values(ORDER_STATUS);
    if (!status || !ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}.` });
    }
    try {
        await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);

        // Send email notification when order is completed
        if (status === 'completed') {
            // Fetch the order + user email (fire-and-forget)
            db.query(
                'SELECT o.*, u.email FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?',
                [req.params.id]
            ).then(([rows]) => {
                if (rows.length > 0) {
                    const order = rows[0];
                    sendOrderCompletedEmail(order, order.email).catch(err => {
                        logger.error(`Failed to send completion email for order #${req.params.id}:`, err);
                    });
                }
            }).catch(err => {
                logger.error(`Failed to fetch order for completion email:`, err);
            });
        }

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
            "SELECT id, fullname, email, phone, role, status, created_at FROM users WHERE is_verified = TRUE OR role = 'admin' ORDER BY created_at DESC"
        );
        res.status(200).json(users);
    } catch (error) {
        logger.error('Error fetching all users:', error);
        res.status(500).json({ message: 'Server error while fetching users.' });
    }
});

// === UPDATE USER STATUS ===
router.put('/users/:id/status', async (req, res) => {
    const { status } = req.body;
    if (!['active', 'suspended', 'deactivated'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status.' });
    }
    try {
        await db.query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        res.status(200).json({ message: `User status updated to ${status}.` });
    } catch (error) {
        logger.error('Error updating user status:', error);
        res.status(500).json({ message: 'Server error updating user status.' });
    }
});

// === ADMIN: EDIT USER PROFILE ===
router.put('/users/:id/profile', async (req, res) => {
    const { fullname, phone, email } = req.body;
    if (!fullname || !phone || !email) {
        return res.status(400).json({ message: 'Full name, phone, and email are required.' });
    }
    try {
        const emailLower = email.toLowerCase().trim();
        // Check if email is already taken by another user
        const [existing] = await db.query('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?', [emailLower, req.params.id]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'This email is already used by another account.' });
        }
        await db.query('UPDATE users SET fullname = ?, phone = ?, email = ? WHERE id = ?', [fullname.trim(), phone.trim(), emailLower, req.params.id]);
        res.status(200).json({ message: 'User profile updated successfully.' });
    } catch (error) {
        logger.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Server error updating user profile.' });
    }
});

// === KYC MANAGEMENT ===
router.get('/kyc', async (req, res) => {
    try {
        // Optimization: Exclude heavy base64 image strings from the list view
        const [kyc] = await db.query(
            "SELECT id, fullname, email, kyc_status, id_type, updated_at as created_at FROM users WHERE kyc_status != 'unverified' ORDER BY CASE WHEN kyc_status = 'pending' THEN 1 ELSE 2 END, updated_at DESC"
        );
        res.status(200).json(kyc);
    } catch (error) {
        logger.error('Error fetching KYC documents:', error);
        res.status(500).json({ message: 'Server error while fetching KYC documents.' });
    }
});

router.get('/kyc/:id', async (req, res) => {
    try {
        const [users] = await db.query(
            "SELECT id, fullname, email, kyc_status, id_type, id_front, id_back, id_selfie, updated_at as created_at FROM users WHERE id = ?",
            [req.params.id]
        );
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json(users[0]);
    } catch (error) {
        logger.error(`Error fetching KYC details for user ${req.params.id}:`, error);
        res.status(500).json({ message: 'Server error fetching KYC details.' });
    }
});

router.put('/kyc/:id/status', async (req, res) => {
    const { status } = req.body; // 'approved', 'rejected', or 'pending'
    if (!['approved', 'rejected', 'pending'].includes(status))
        return res.status(400).json({ message: 'Invalid status. Must be approved, rejected, or pending.' });

    try {
        await db.query('UPDATE users SET kyc_status = ? WHERE id = ?', [status, req.params.id]);
        // Respond immediately — the email notification is fire-and-forget
        res.status(200).json({ message: `KYC status updated to ${status}.` });
    } catch (error) {
        logger.error('KYC status update error:', error);
        return res.status(500).json({ message: 'Server error updating KYC status.' });
    }

    // Fire user notification email — kept outside try/catch so it can never
    // trigger a "headers already sent" crash after res.json() above.
    db.query('SELECT fullname, email FROM users WHERE id = ?', [req.params.id])
        .then(([rows]) => {
            const user = rows[0];
            if (!user) return;
            const fn = status === 'approved' ? sendKycApprovedEmail : sendKycRejectedEmail;
            fn(user).catch(err =>
                logger.warn(`KYC ${status} email failed (non-critical):`, err.message)
            );
        })
        .catch(err => logger.warn('Could not fetch user for KYC notification:', err.message));
});

// === EXPORT ALL KYC VIA EMAIL (bulk) ===
// ⚠ Must be registered BEFORE /kyc/:id routes to avoid :id capturing "export-all"
router.post('/kyc/export-all', async (req, res) => {
    try {
        const [users] = await db.query(
            "SELECT id, fullname, email, id_type, id_front, id_back, id_selfie FROM users WHERE kyc_status != 'unverified' AND (id_front IS NOT NULL OR id_back IS NOT NULL OR id_selfie IS NOT NULL)"
        );
        if (users.length === 0) return res.status(400).json({ message: 'No KYC submissions found.' });

        // Respond immediately — process in background
        res.status(200).json({ message: `Exporting ${users.length} KYC record(s) via email. This may take a few minutes.` });

        // Send emails with 3-second delay between each to avoid Gmail rate limits
        for (let i = 0; i < users.length; i++) {
            const u = users[i];
            try {
                await sendKycBackupEmail({ fullname: u.fullname, email: u.email }, u.id_type, u.id_front, u.id_back, u.id_selfie);
                logger.info(`KYC bulk export: sent ${i + 1}/${users.length} — ${u.email}`);
            } catch (err) {
                logger.warn(`KYC bulk export failed for ${u.email}:`, err.message);
            }
            if (i < users.length - 1) await new Promise(r => setTimeout(r, 3000));
        }
        logger.info(`KYC bulk export complete: ${users.length} record(s) processed.`);
    } catch (error) {
        logger.error('KYC bulk export error:', error);
        // Response may already be sent
    }
});

// === EXPORT KYC VIA EMAIL (single user) ===
router.post('/kyc/:id/export-email', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT fullname, email, id_type, id_front, id_back, id_selfie FROM users WHERE id = ?',
            [req.params.id]
        );
        if (users.length === 0) return res.status(404).json({ message: 'User not found.' });
        const u = users[0];
        if (!u.id_front && !u.id_back && !u.id_selfie) {
            return res.status(400).json({ message: 'No KYC documents found for this user.' });
        }
        await sendKycBackupEmail({ fullname: u.fullname, email: u.email }, u.id_type, u.id_front, u.id_back, u.id_selfie);
        res.status(200).json({ message: `KYC backup email sent for ${u.fullname || u.email}.` });
    } catch (error) {
        logger.error('KYC export email error:', error);
        res.status(500).json({ message: 'Failed to send KYC backup email.' });
    }
});

// === REFERRAL MANAGEMENT ===
router.get('/referrals', async (req, res) => {
    try {
        const [referrals] = await db.query(`
            SELECT
                referred.id AS referred_id,
                referrer.fullname AS referrer_name,
                referrer.email AS referrer_email,
                referred.fullname AS referred_name,
                referred.email AS referred_email,
                referred.created_at AS referred_join_date,
                (SELECT COUNT(*) FROM orders WHERE user_id = referred.id) > 0 AS has_transacted,
                COALESCE(referred.airtime_sent, FALSE) AS airtime_sent
            FROM users AS referred
            JOIN users AS referrer ON referred.referred_by_id = referrer.id
            WHERE referred.referred_by_id IS NOT NULL AND referred.is_verified = TRUE
            ORDER BY referred.created_at DESC
        `);
        res.status(200).json(referrals);
    } catch (error) {
        logger.error('Error fetching referral data:', error);
        res.status(500).json({ message: 'Server error while fetching referral data.' });
    }
});

// Toggle airtime sent status for a referred user
router.put('/referrals/:id/airtime', async (req, res) => {
    const { status } = req.body; // 'sent' or 'not_sent'
    if (!['sent', 'not_sent'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be "sent" or "not_sent".' });
    }
    try {
        const isSent = status === 'sent';
        await db.query('UPDATE users SET airtime_sent = ? WHERE id = ?', [isSent, req.params.id]);
        res.status(200).json({ message: `Airtime status updated to ${status}.` });
    } catch (error) {
        logger.error('Airtime status update error:', error);
        res.status(500).json({ message: 'Server error updating airtime status.' });
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