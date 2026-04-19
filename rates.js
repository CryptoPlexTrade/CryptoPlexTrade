/**
 * rates.js
 * ─────────────────────────────────────────────────────────────
 * Database-backed exchange rates & mining fees.
 * Persists across Vercel cold starts and serverless instances.
 *
 * Uses the `site_settings` table with key = 'rates'.
 * Caches the result for 30 seconds to avoid hammering the DB.
 * ─────────────────────────────────────────────────────────────
 */
const db = require('./database');
const logger = require('./logger');

let tableReady = false;
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5_000; // 5 seconds — minimises stale-price window across serverless instances

const DEFAULT_RATES = {
    BTC: {
        buy: 13.05,
        sell: 12.95,
        minerFees: [
            { name: 'Priority', value: 3.50 },
            { name: 'Standard', value: 2.50 },
            { name: 'Economy', value: 1.50 }
        ]
    },
    ETH: {
        buy: 10.05,
        sell: 9.95,
        minerFees: [
            { name: 'Priority', value: 5.00 },
            { name: 'Standard', value: 4.50 },
            { name: 'Economy', value: 3.00 }
        ]
    },
    USDT_TRC20: {
        buy: 12.05,
        sell: 11.95,
        minerFees: [
            { name: 'Priority', value: 2.00 },
            { name: 'Standard', value: 1.00 },
            { name: 'Economy', value: 0.50 }
        ]
    },
    USDT_ERC20: {
        buy: 12.05,
        sell: 11.95,
        minerFees: [
            { name: 'Priority', value: 6.00 },
            { name: 'Standard', value: 5.00 },
            { name: 'Economy', value: 4.00 }
        ]
    }
};

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

const getRates = async () => {
    // Return cache if still fresh
    if (cache && (Date.now() - cacheTime) < CACHE_TTL) {
        return cache;
    }

    try {
        await ensureTable();
        const [rows] = await db.query(
            "SELECT value FROM site_settings WHERE key = 'rates'"
        );
        if (rows.length > 0) {
            cache = rows[0].value;
            cacheTime = Date.now();
            return cache;
        }
    } catch (err) {
        logger.error('Error reading rates from DB:', err);
        if (cache) return cache;
    }

    return DEFAULT_RATES;
};

const setRates = async (newRates) => {
    cache = newRates;
    cacheTime = Date.now();

    try {
        await ensureTable();
        const json = JSON.stringify(newRates);
        await db.query(`
            INSERT INTO site_settings (key, value, updated_at)
            VALUES ('rates', ?::jsonb, NOW())
            ON CONFLICT (key)
            DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
            RETURNING key
        `, [json]);
        logger.info('Rates saved to database successfully.');
    } catch (err) {
        logger.error('Error saving rates to DB:', err);
    }
};

module.exports = { getRates, setRates };