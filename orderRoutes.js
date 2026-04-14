const express = require('express');
const db = require('./database');
const { authenticateToken } = require('./authMiddleware');
const { getRates } = require('./rates'); // Assuming rates are managed in a separate file
const logger = require('./logger');
const { sendNewOrderNotification } = require('./emailService');
const { ORDER_STATUS } = require('./constants');

const router = express.Router();

// === CREATE ORDER ENDPOINT ===
router.post('/create', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Get user ID from the authenticated token
    const {
        product,
        usdAmount,
        minerFeeValue, // Client sends the selected fee value, not the calculated GHS fee
        walletAddress,
        transactionId
    } = req.body;

    // Basic validation
    if (!product || !usdAmount || minerFeeValue === undefined || !walletAddress || !transactionId) {
        return res.status(400).json({ message: 'Missing required order information.' });
    }

    try {
        const rates = getRates(); // Get current, trusted rates from the server
        const productRates = rates[product];
        if (!productRates) {
            return res.status(400).json({ message: `Invalid product selected: ${product}` });
        }
        const exchangeRate = productRates.buy; // Use the "buy" rate because the user is buying from us

        // Find the selected miner fee from the product's fee list
        const productMinerFees = productRates.minerFees || [];
        const selectedMinerFee = productMinerFees.find(f => f.value === minerFeeValue);
        if (!selectedMinerFee) {
            return res.status(400).json({ message: 'Invalid miner fee selected.' });
        }

        // --- SERVER-SIDE CALCULATION ---
        const parsedUsdAmount = parseFloat(usdAmount);
        const calculatedGhsAmount = parsedUsdAmount * exchangeRate;
        const calculatedFeeGhs = selectedMinerFee.value * exchangeRate;
        const calculatedTotalPaid = calculatedGhsAmount + calculatedFeeGhs;
        // --- END SERVER-SIDE CALCULATION ---

        // Insert new order into the database
        const [, orderMeta] = await db.query(
            `INSERT INTO orders (user_id, order_type, product, usd_amount, ghs_amount, fee_ghs, total_paid, wallet_address, transaction_id, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, 'buy', product, parsedUsdAmount, calculatedGhsAmount, calculatedFeeGhs, calculatedTotalPaid, walletAddress, transactionId, ORDER_STATUS.PENDING_CONFIRMATION]
        );
        const newOrderId = orderMeta.insertId;

        const [users] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
        const userEmail = users.length > 0 ? users[0].email : 'N/A';

        // Send email notification to admin
        sendNewOrderNotification({
            order_type: 'buy',
            product: product,
            usd_amount: parsedUsdAmount,
            total_paid_ghs: calculatedTotalPaid,
            wallet_address: walletAddress,
            user_transaction_id: transactionId,
            user_email: userEmail
        }, newOrderId).catch(emailError => {
            logger.error(`Failed to send admin notification email for order #${newOrderId}:`, emailError);
        });

        res.status(201).json({ message: 'Order created successfully!', orderId: newOrderId });

    } catch (error) {
        logger.error('Order creation error:', error);
        res.status(500).json({ message: 'Server error during order creation.' });
    }
});

// === GET ORDER HISTORY ENDPOINT ===
router.get('/history', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const [orders] = await db.query(
            `
            SELECT 
                o.*,
                ROW_NUMBER() OVER(PARTITION BY o.user_id ORDER BY o.created_at ASC) as user_transaction_number
            FROM orders o
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            `, [userId]
        );
        res.status(200).json(orders);
    } catch (error) {
        logger.error('Order history fetch error:', error);
        res.status(500).json({ message: 'Server error while fetching order history.' });
    }
});

// === CREATE SELL ORDER ENDPOINT ===
router.post('/create-sell-order', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const {
        product,
        productAmount,
        transactionId,
        payoutInfo
    } = req.body;

    // Basic validation
    if (!product || !productAmount || !transactionId || !payoutInfo) {
        return res.status(400).json({ message: 'Missing required sell order information.' });
    }

    try {
        const rates = getRates();
        const productRates = rates[product];
        if (!productRates) {
            return res.status(400).json({ message: `Invalid product selected: ${product}` });
        }
        const exchangeRate = productRates.sell; // Use the "sell" rate because the user is selling to us

        // --- SERVER-SIDE CALCULATION ---
        const parsedProductAmount = parseFloat(productAmount);
        const calculatedGhsToReceive = parsedProductAmount * exchangeRate; // Calculate what the user will get
        // --- END SERVER-SIDE CALCULATION ---

        const payoutDetailsString = JSON.stringify(payoutInfo);

        // Insert new sell order into the database
        const [, sellMeta] = await db.query(
            `INSERT INTO orders (user_id, order_type, product, usd_amount, ghs_amount, total_paid, wallet_address, transaction_id, status) 
             VALUES (?, 'sell', ?, ?, ?, ?, ?, ?, ?)`,
            [userId, product, parsedProductAmount, calculatedGhsToReceive, calculatedGhsToReceive, payoutDetailsString, transactionId, ORDER_STATUS.PENDING_CONFIRMATION]
        );
        const newSellOrderId = sellMeta.insertId;

        const [users] = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
        const userEmail = users.length > 0 ? users[0].email : 'N/A';

        // Send email notification to admin
        sendNewOrderNotification({
            order_type: 'sell',
            product: product,
            product_amount: parsedProductAmount,
            ghs_to_receive: calculatedGhsToReceive,
            user_transaction_id: transactionId,
            payout_info: payoutInfo, // The original object, not the string
            user_email: userEmail
        }, newSellOrderId).catch(emailError => {
            logger.error(`Failed to send admin notification email for sell order #${newSellOrderId}:`, emailError);
        });

        res.status(201).json({ message: 'Sell order created successfully!', orderId: newSellOrderId });

    } catch (error) {
        logger.error('Sell order creation error:', error);
        res.status(500).json({ message: 'Server error during sell order creation.' });
    }
});

module.exports = router;