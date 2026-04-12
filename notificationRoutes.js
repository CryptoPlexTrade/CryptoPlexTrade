const express = require('express');
const db = require('./database');
const logger = require('./logger');
const { authenticateToken } = require('./authMiddleware');

const router = express.Router();

const formatNotification = (item) => {
    if (!item || !item.id) {
        return null; // Or return a default/error notification object
    }

    // Use the new user_transaction_number if it exists, otherwise fallback to the global id.
    const displayId = item.user_transaction_number || item.id;
    let message = '';
    let link = `/transactions.html`; // Generic link

    if (item.source === 'order') {
        if (item.order_type === 'buy') {
            message = `Your buy order for ${item.product} (ID: #${displayId}) has been submitted.`;
        } else {
            message = `Your sell order for ${item.product} (ID: #${displayId}) has been submitted.`;
        }
        link = `/transactions.html#order-${displayId}`;
    }
    // Future notification types like 'profile_update' or 'status_change' can be added here.

    return {
        id: `${item.source}-${item.id}`,
        message,
        link,
        timestamp: item.created_at,
    };
};

router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    try {
        const [orders] = await db.query(`
            SELECT o.*, 'order' AS source,
                   ROW_NUMBER() OVER (PARTITION BY o.user_id ORDER BY o.created_at DESC) AS user_transaction_number
            FROM orders o
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT 10
        `, [userId]);

        const notifications = orders.map(formatNotification).filter(Boolean);
        res.status(200).json(notifications);
    } catch (error) {
        logger.error('Failed to fetch notifications:', error);
        res.status(500).json({ message: 'Server error while fetching notifications.' });
    }
});

module.exports = router;