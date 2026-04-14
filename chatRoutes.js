/**
 * chatRoutes.js
 * Live chat REST API (DB-polling, Vercel-compatible — no WebSockets required).
 *
 * Public (customer) routes:
 *   POST /api/chat/session          – start or resume a session (returns session_id)
 *   GET  /api/chat/:sessionId       – poll messages for a session
 *   POST /api/chat/:sessionId/send  – customer sends a message
 *
 * Admin routes (require admin-token cookie):
 *   GET  /api/admin/chat/sessions         – list all chat sessions
 *   GET  /api/admin/chat/:sessionId       – get messages for a session
 *   POST /api/admin/chat/:sessionId/reply – admin sends a reply
 *   PUT  /api/admin/chat/:sessionId/close – close a session
 */

const express = require('express');
const db = require('./database');
const logger = require('./logger');
const { authenticateAdminToken } = require('./authMiddleware');
const { adminOnly } = require('./adminAuthMiddleware');
const { sendLiveChatNotification } = require('./emailService');

const router = express.Router();

// ── Ensure tables exist ────────────────────────────────────────────
let tablesReady = false;
async function ensureTables() {
    if (tablesReady) return;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id          SERIAL PRIMARY KEY,
                session_key VARCHAR(64) NOT NULL UNIQUE,
                guest_name  VARCHAR(100) NOT NULL DEFAULT 'Guest',
                status      VARCHAR(20) NOT NULL DEFAULT 'open',
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id          SERIAL PRIMARY KEY,
                session_id  INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
                sender      VARCHAR(20) NOT NULL DEFAULT 'customer',
                message     TEXT NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        tablesReady = true;
    } catch (err) {
        logger.error('Error creating chat tables:', err);
    }
}

// ═══════════════════════════════════════════════════════════════════
//  PUBLIC (CUSTOMER) ROUTES
// ═══════════════════════════════════════════════════════════════════

// POST /api/chat/session  – start or resume a session
router.post('/session', async (req, res) => {
    await ensureTables();
    try {
        const { sessionKey, guestName } = req.body;
        if (!sessionKey) return res.status(400).json({ message: 'sessionKey is required.' });

        const [rows] = await db.query(
            'SELECT id, guest_name, status FROM chat_sessions WHERE session_key = ?',
            [sessionKey]
        );

        if (rows.length > 0) {
            return res.json({ sessionId: rows[0].id, guestName: rows[0].guest_name, status: rows[0].status });
        }

        const name = (guestName || 'Guest').substring(0, 100);
        const [result] = await db.query(
            'INSERT INTO chat_sessions (session_key, guest_name) VALUES (?, ?) RETURNING id',
            [sessionKey, name]
        );
        const newId = result[0]?.id;

        // Auto-greet
        await db.query(
            'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)',
            [newId, 'admin', '👋 Hi there! Welcome to CryptoPlexTrade support. How can we help you today?']
        );

        // Notify admin about new live chat
        sendLiveChatNotification(name, newId).catch(err => {
            logger.error('Failed to send live chat notification email:', err);
        });

        res.json({ sessionId: newId, guestName: name, status: 'open' });
    } catch (err) {
        logger.error('Chat /session error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/chat/:sessionId  – poll messages (+ since timestamp)
router.get('/:sessionId', async (req, res) => {
    await ensureTables();
    try {
        const { sessionId } = req.params;
        const since = req.query.since || '1970-01-01';

        const [session] = await db.query(
            'SELECT id, guest_name, status FROM chat_sessions WHERE id = ?',
            [sessionId]
        );
        if (session.length === 0) return res.status(404).json({ message: 'Session not found.' });

        const [messages] = await db.query(
            'SELECT id, sender, message, created_at FROM chat_messages WHERE session_id = ? AND created_at > ? ORDER BY created_at ASC',
            [sessionId, since]
        );

        res.json({ status: session[0].status, messages });
    } catch (err) {
        logger.error('Chat poll error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/chat/:sessionId/send  – customer sends a message
router.post('/:sessionId/send', async (req, res) => {
    await ensureTables();
    try {
        const { sessionId } = req.params;
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

        const [session] = await db.query(
            'SELECT id, status FROM chat_sessions WHERE id = ?',
            [sessionId]
        );
        if (session.length === 0) return res.status(404).json({ message: 'Session not found.' });
        if (session[0].status === 'closed') return res.status(400).json({ message: 'This chat session is closed.' });

        await db.query(
            'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)',
            [sessionId, 'customer', message.trim().substring(0, 2000)]
        );

        await db.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?', [sessionId]);

        res.json({ success: true });
    } catch (err) {
        logger.error('Chat send error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});


// ═══════════════════════════════════════════════════════════════════
//  ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════
const adminChat = express.Router();
adminChat.use(authenticateAdminToken, adminOnly);

// GET /api/admin/chat/sessions
adminChat.get('/sessions', async (req, res) => {
    await ensureTables();
    try {
        const [sessions] = await db.query(`
            SELECT s.id, s.guest_name, s.status, s.created_at, s.updated_at,
                   (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count,
                   (SELECT message FROM chat_messages m WHERE m.session_id = s.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
            FROM chat_sessions s
            ORDER BY s.updated_at DESC
        `);
        res.json(sessions);
    } catch (err) {
        logger.error('Admin chat sessions error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// GET /api/admin/chat/:sessionId
adminChat.get('/:sessionId', async (req, res) => {
    await ensureTables();
    try {
        const { sessionId } = req.params;
        const [session] = await db.query('SELECT * FROM chat_sessions WHERE id = ?', [sessionId]);
        if (session.length === 0) return res.status(404).json({ message: 'Session not found.' });

        const [messages] = await db.query(
            'SELECT id, sender, message, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC',
            [sessionId]
        );
        res.json({ session: session[0], messages });
    } catch (err) {
        logger.error('Admin chat get session error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// POST /api/admin/chat/:sessionId/reply
adminChat.post('/:sessionId/reply', async (req, res) => {
    await ensureTables();
    try {
        const { sessionId } = req.params;
        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ message: 'Message is required.' });

        await db.query(
            'INSERT INTO chat_messages (session_id, sender, message) VALUES (?, ?, ?)',
            [sessionId, 'admin', message.trim().substring(0, 2000)]
        );
        await db.query('UPDATE chat_sessions SET updated_at = NOW() WHERE id = ?', [sessionId]);

        res.json({ success: true });
    } catch (err) {
        logger.error('Admin chat reply error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

// PUT /api/admin/chat/:sessionId/close
adminChat.put('/:sessionId/close', async (req, res) => {
    await ensureTables();
    try {
        const { sessionId } = req.params;
        await db.query("UPDATE chat_sessions SET status = 'closed', updated_at = NOW() WHERE id = ?", [sessionId]);
        res.json({ success: true });
    } catch (err) {
        logger.error('Admin chat close error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
});

module.exports = { publicRouter: router, adminRouter: adminChat };
