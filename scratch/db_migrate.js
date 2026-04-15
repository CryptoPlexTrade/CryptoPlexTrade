const db = require('./database');

async function migrate() {
    try {
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires BIGINT');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token VARCHAR(255)');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_expires BIGINT');
        console.log("Migration successful");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
migrate();
