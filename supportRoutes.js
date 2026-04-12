const express = require('express');
const db = require('./database');
const logger = require('./logger');
const { authenticateToken } = require('./authMiddleware');

const router = express.Router();

// === GET ALL TICKETS FOR A USER ===
router.get('/tickets', authenticateToken, async (req, res) => {
    try {
        const [tickets] = await db.query(
            'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY updated_at DESC',
            [req.user.userId]
        );
        res.status(200).json(tickets);
    } catch (error) {
        logger.error('Error fetching tickets:', error);
        res.status(500).json({ message: 'Server error while fetching tickets.' });
    }
});

// === CREATE A NEW TICKET ===
router.post('/tickets', authenticateToken, async (req, res) => {
    const { subject, message } = req.body;
    if (!subject || !message) {
        return res.status(400).json({ message: 'Subject and message are required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [ticketRows] = await connection.query(
            'INSERT INTO support_tickets (user_id, subject, status) VALUES (?, ?, ?)',
            [req.user.userId, subject, 'open']
        );
        const ticketId = ticketRows[0]?.id;

        if (!ticketId) {
            throw new Error('Failed to retrieve ticket ID after insert.');
        }
        await connection.query(
            'INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES (?, ?, ?)',
            [ticketId, req.user.userId, message]
        );

        await connection.commit();
        res.status(201).json({ message: 'Ticket created successfully!', ticketId });

    } catch (error) {
        await connection.rollback();
        logger.error('Error creating ticket:', error);
        res.status(500).json({ message: 'Server error while creating ticket.' });
    } finally {
        connection.release();
    }
});

// === GET A SINGLE TICKET WITH REPLIES ===
router.get('/tickets/:id', authenticateToken, async (req, res) => {
    try {
        // Admin can view any ticket, users can only view their own.
        const query = req.user.role === 'admin'
            ? 'SELECT * FROM support_tickets WHERE id = ?'
            : 'SELECT * FROM support_tickets WHERE id = ? AND user_id = ?';
        const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.userId];

        const [tickets] = await db.query(query, params);
        if (tickets.length === 0) {
            return res.status(404).json({ message: 'Ticket not found or access denied.' });
        }

        const [replies] = await db.query('SELECT * FROM ticket_replies WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id]);

        res.status(200).json({ ticket: tickets[0], replies });
    } catch (error) {
        logger.error('Error fetching ticket details:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// === ADD A REPLY TO A TICKET ===
router.post('/tickets/:id/reply', authenticateToken, async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ message: 'Reply message cannot be empty.' });
    }

    try {
        // First, verify the user owns the ticket
        const [tickets] = await db.query('SELECT id FROM support_tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.userId]);
        if (tickets.length === 0) {
            return res.status(403).json({ message: 'Access denied.' });
        }

        await db.query('INSERT INTO ticket_replies (ticket_id, user_id, message) VALUES (?, ?, ?)', [req.params.id, req.user.userId, message]);
        await db.query("UPDATE support_tickets SET status = 'open', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [req.params.id]);

        res.status(201).json({ message: 'Reply added successfully.' });
    } catch (error) {
        logger.error('Error adding reply:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = router;