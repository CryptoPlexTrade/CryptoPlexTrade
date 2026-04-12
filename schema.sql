-- ============================================================
--  CryptoPlexTrade – PostgreSQL Database Schema
--  Target: Supabase (PostgreSQL 15+)
--  Run once to initialise a fresh database.
-- ============================================================

-- ── Extensions ─────────────────────────────────────────────
-- pgcrypto gives us gen_random_uuid() if needed later
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
--  TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    fullname        VARCHAR(150)        NOT NULL,
    phone           VARCHAR(30)         NOT NULL,
    email           VARCHAR(255)        NOT NULL UNIQUE,
    password        VARCHAR(255)        NOT NULL,
    role            VARCHAR(20)         NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    referral_code   VARCHAR(50)         UNIQUE,
    referred_by_id  INTEGER             REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Index for fast login lookups
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by   ON users(referred_by_id);

-- ── Seed a default admin account (password: Admin@1234) ────
-- Hash generated with bcrypt rounds=10.  Change after first login.
INSERT INTO users (fullname, phone, email, password, role)
VALUES (
    'System Admin',
    '+0000000000',
    'admin@cryptoplextrade.com',
    '$2b$10$VVz13RggXAJEgOsfrMRfz.ZeS3/rSjUJsDnXWVd3Bn1WquwVPrTha',   -- Admin@1234
    'admin'
)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
--  TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_type      VARCHAR(10)         NOT NULL CHECK (order_type IN ('buy', 'sell')),
    product         VARCHAR(20)         NOT NULL,                   -- 'BTC' | 'ETH' etc.
    usd_amount      NUMERIC(18, 8)      NOT NULL DEFAULT 0,         -- crypto amount (USD face value)
    ghs_amount      NUMERIC(18, 2)      NOT NULL DEFAULT 0,         -- GHS equivalent
    fee_ghs         NUMERIC(18, 2)      NOT NULL DEFAULT 0,         -- miner fee in GHS (buy orders)
    total_paid      NUMERIC(18, 2)      NOT NULL DEFAULT 0,         -- final amount paid / received
    wallet_address  TEXT                NOT NULL,                   -- crypto wallet OR JSON payout info (sell)
    transaction_id  VARCHAR(255)        NOT NULL,                   -- payment reference supplied by user
    status          VARCHAR(50)         NOT NULL DEFAULT 'pending_confirmation',
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);


-- ============================================================
--  TABLE: support_tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject     VARCHAR(255)        NOT NULL,
    status      VARCHAR(20)         NOT NULL DEFAULT 'open'   -- 'open' | 'answered' | 'closed'
                CHECK (status IN ('open', 'answered', 'closed')),
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_user_id  ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON support_tickets(status);


-- ============================================================
--  TABLE: ticket_replies
-- ============================================================
CREATE TABLE IF NOT EXISTS ticket_replies (
    id          SERIAL PRIMARY KEY,
    ticket_id   INTEGER             NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id     INTEGER             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message     TEXT                NOT NULL,
    is_admin    BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_ticket_id ON ticket_replies(ticket_id);


-- ============================================================
--  Auto-update updated_at columns via trigger
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to users
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to orders
DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to support_tickets
DROP TRIGGER IF EXISTS trg_tickets_updated_at ON support_tickets;
CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
