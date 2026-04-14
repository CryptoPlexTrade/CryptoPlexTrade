/**
 * paymentMethodsManager.js
 * Database-backed storage for payment methods.
 */
const db = require('./database');
const logger = require('./logger');

const DEFAULT_DATA = {
    momoAccounts: [],
    bank: { bankName: '', accountName: '', accountNumber: '' },
    wallets: { BTC: '', ETH: '', USDT_TRC20: '', USDT_ERC20: '' },
    updatedAt: ''
};

// In-memory cache to avoid hitting the DB on every single page load
let cache = null;
let isInitialized = false;

async function ensureTable() {
    if (isInitialized) return;
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS system_settings (
                key VARCHAR(50) PRIMARY KEY,
                value JSONB NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);
        isInitialized = true;
    } catch (err) {
        logger.error('Error creating system_settings table:', err);
    }
}

async function get() {
    await ensureTable();
    try {
        const [rows] = await db.query("SELECT value FROM system_settings WHERE key = 'payment_methods'");
        if (rows.length > 0) {
            cache = rows[0].value;
            return cache;
        }
        return { ...DEFAULT_DATA };
    } catch (err) {
        logger.error('Error fetching payment methods from DB:', err);
        return cache || { ...DEFAULT_DATA };
    }
}

async function save(data) {
    await ensureTable();
    cache = data;
    try {
        await db.query(`
            INSERT INTO system_settings (key, value, updated_at) 
            VALUES ('payment_methods', ?::jsonb, NOW())
            ON CONFLICT (key) DO UPDATE 
            SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at
            RETURNING key
        `, [JSON.stringify(data)]);
        logger.info('Payment methods persisted to database.');
    } catch (err) {
        logger.error('Could not persist payment methods to DB:', err);
    }
}

module.exports = { get, save };
