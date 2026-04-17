/**
 * database.js
 * ─────────────────────────────────────────────────────────────
 * PostgreSQL connection using the DATABASE_URL from .env (Supabase).
 *
 * Provides a thin mysql2-compatible wrapper so all existing route
 * files can keep using  db.query('SELECT … WHERE id = ?', [id])
 * without any changes.  The wrapper converts ? placeholders to
 * PostgreSQL's $1, $2 … style automatically.
 *
 * Also exposes getConnection() returning a pseudo-connection with
 * beginTransaction / commit / rollback / release / query helpers
 * so the transactional code in supportRoutes.js keeps working.
 *
 * Resilience: transient DNS/network errors (ENOTFOUND, ECONNRESET,
 * ETIMEDOUT) are automatically retried up to 3 times with
 * exponential backoff before propagating to the caller.
 * ─────────────────────────────────────────────────────────────
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },    // Required for Supabase / hosted PG
    max: 3,                                // Keep low for Supabase free-tier pooler
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    allowExitOnIdle: true,                 // Don't hang the process on shutdown
});

pool.on('error', (err) => {
    // Log but don't crash — the pool will create a new client on next request
    console.error('[DB] Pool client error (will recover):', err.message);
});

// ── Transient error codes that are safe to retry ─────────────
const RETRYABLE_CODES = new Set([
    'ENOTFOUND',   // DNS failure (transient)
    'ECONNRESET',  // Connection reset by peer
    'ECONNREFUSED',// Server not ready yet
    'ETIMEDOUT',   // Network timeout
    'EAI_AGAIN',   // DNS temporary failure
    '57P01',       // Postgres: admin_shutdown
    '08006',       // Postgres: connection_failure
    '08001',       // Postgres: sqlclient_unable_to_establish_sqlconnection
]);

function isRetryable(err) {
    return RETRYABLE_CODES.has(err.code) || RETRYABLE_CODES.has(err.routine);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Helper: convert mysql2 `?` placeholders to pg `$1, $2…` ─
function toPostgresParams(sql, params = []) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return { pgSql, params };
}

// ── Internal: run one query attempt ──────────────────────────
async function runQuery(sql, params = []) {
    const { pgSql, params: pgParams } = toPostgresParams(sql, params);

    // Auto-append RETURNING id to INSERT statements so insertId works
    const isInsert = /^\s*INSERT/i.test(pgSql);
    const finalSql = isInsert && !/RETURNING/i.test(pgSql) ? `${pgSql} RETURNING id` : pgSql;

    const result = await pool.query(finalSql, pgParams);

    // Mimic mysql2 insertId / affectedRows on the result
    result.rows.insertId     = result.rows[0]?.id ?? null;
    result.rows.affectedRows = result.rowCount ?? 0;

    const meta = {
        insertId:     result.rows.insertId,
        affectedRows: result.rows.affectedRows,
        rows:         result.rows,
    };

    return [result.rows, meta];
}

// ── mysql2-compatible query(sql, params) with retry ──────────
// Returns  [rows, fields]  just like mysql2 promise pool.
async function query(sql, params = [], { maxRetries = 3, baseDelayMs = 500 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await runQuery(sql, params);
        } catch (err) {
            lastErr = err;
            if (attempt < maxRetries && isRetryable(err)) {
                const delay = baseDelayMs * Math.pow(2, attempt); // 500ms → 1s → 2s
                console.warn(
                    `[DB] Transient error (${err.code || err.message}) — retrying in ${delay}ms` +
                    ` (attempt ${attempt + 1}/${maxRetries})`
                );
                await sleep(delay);
            } else {
                throw err; // Non-retryable or out of retries
            }
        }
    }
    throw lastErr;
}

// ── getConnection() – returns a client with transaction helpers ─
async function getConnection() {
    const client = await pool.connect();

    return {
        async query(sql, params = []) {
            const { pgSql, params: pgParams } = toPostgresParams(sql, params);
            const isInsert = /^\s*INSERT/i.test(pgSql);
            const finalSql = isInsert && !/RETURNING/i.test(pgSql) ? `${pgSql} RETURNING id` : pgSql;
            const result = await client.query(finalSql, pgParams);
            result.rows.insertId = result.rows[0]?.id ?? null;
            result.rows.affectedRows = result.rowCount ?? 0;
            const meta = {
                insertId:     result.rows.insertId,
                affectedRows: result.rows.affectedRows,
            };
            return [result.rows, meta];
        },

        async beginTransaction() { await client.query('BEGIN'); },
        async commit()           { await client.query('COMMIT'); },
        async rollback()         { await client.query('ROLLBACK'); },
        release()                { client.release(); },
    };
}

module.exports = { query, getConnection };