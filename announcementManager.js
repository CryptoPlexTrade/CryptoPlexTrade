/**
 * announcementManager.js
 * ─────────────────────────────────────────────────────────────
 * Database-backed announcement state.
 * Persists across Vercel cold starts and serverless instances.
 *
 * Uses the `site_settings` table with key = 'announcement'.
 * Caches the result for 10 seconds to avoid hammering the DB.
 * ─────────────────────────────────────────────────────────────
 */
const db = require('./database');
const logger = require('./logger');

let tableReady = false;
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10_000; // 10 seconds

const DEFAULT = { active: false, title: '', message: '', updatedAt: '' };

async function ensureTable() {
    if (tableReady) return;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS site_settings (
                key         VARCHAR(64) PRIMARY KEY,
                value       JSONB NOT NULL DEFAULT '{}',
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        tableReady = true;
    } catch (err) {
        logger.error('Error creating site_settings table:', err);
    }
}

async function get() {
    if (cache && (Date.now() - cacheTime) < CACHE_TTL) {
        return cache;
    }

    try {
        await ensureTable();
        const [rows] = await db.query(
            "SELECT value FROM site_settings WHERE key = 'announcement'"
        );
        if (rows.length > 0) {
            cache = rows[0].value;
            cacheTime = Date.now();
            return cache;
        }
    } catch (err) {
        logger.error('Error reading announcement from DB:', err);
        if (cache) return cache;
    }

    return DEFAULT;
}

async function save(data) {
    cache = data;
    cacheTime = Date.now();

    try {
        await ensureTable();
        const json = JSON.stringify(data);
        await db.query(`
            INSERT INTO site_settings (key, value, updated_at)
            VALUES ('announcement', ?::jsonb, NOW())
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            RETURNING key
        `, [json]);
    } catch (err) {
        logger.error('Error saving announcement to DB:', err);
    }
}

module.exports = { get, save };
