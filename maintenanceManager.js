/**
 * maintenanceManager.js
 * ─────────────────────────────────────────────────────────────
 * Database-backed maintenance mode state.
 * Persists across Vercel cold starts and serverless instances.
 *
 * Uses a `site_settings` table with a single row (key = 'maintenance').
 * Caches the result for 10 seconds to avoid hammering the DB on every request.
 * ─────────────────────────────────────────────────────────────
 */
const db = require('./database');
const logger = require('./logger');

let tableReady = false;
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 10_000; // 10 seconds

const DEFAULT = { active: false, message: '', updatedAt: '' };

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
    // Return cache if still fresh
    if (cache && (Date.now() - cacheTime) < CACHE_TTL) {
        return cache;
    }

    try {
        await ensureTable();
        const [rows] = await db.query(
            "SELECT value FROM site_settings WHERE key = 'maintenance'"
        );
        if (rows.length > 0) {
            cache = rows[0].value;
            cacheTime = Date.now();
            return cache;
        }
    } catch (err) {
        logger.error('Error reading maintenance state from DB:', err);
        // If DB is down but we have a stale cache, use it
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
            VALUES ('maintenance', ?::jsonb, NOW())
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            RETURNING key
        `, [json]);
    } catch (err) {
        logger.error('Error saving maintenance state to DB:', err);
    }
}

module.exports = { get, save };
