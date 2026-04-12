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
 * ─────────────────────────────────────────────────────────────
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },   // Required for Supabase / hosted PG
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

// ── Helper: convert mysql2 `?` placeholders to pg `$1, $2…` ─
function toPostgresParams(sql, params = []) {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    return { pgSql, params };
}

// ── mysql2-compatible query(sql, params) ─────────────────────
// Returns  [rows, fields]  just like mysql2 promise pool.
async function query(sql, params = []) {
    const { pgSql, params: pgParams } = toPostgresParams(sql, params);

    // Auto-append RETURNING id to INSERT statements so insertId works
    const isInsert = /^\s*INSERT/i.test(pgSql);
    const finalSql = isInsert && !/RETURNING/i.test(pgSql) ? `${pgSql} RETURNING id` : pgSql;

    const result = await pool.query(finalSql, pgParams);

    // Mimic mysql2 insertId / affectedRows on the "result" object
    const meta = {
        insertId:     result.rows[0]?.id ?? null,
        affectedRows: result.rowCount ?? 0,
        rows:         result.rows,
    };

    return [result.rows, meta];
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
            const meta = {
                insertId:     result.rows[0]?.id ?? null,
                affectedRows: result.rowCount ?? 0,
            };
            return [result.rows, meta];
        },

        async beginTransaction() {
            await client.query('BEGIN');
        },

        async commit() {
            await client.query('COMMIT');
        },

        async rollback() {
            await client.query('ROLLBACK');
        },

        release() {
            client.release();
        },
    };
}

module.exports = { query, getConnection };