const db = require('../database');
const logger = require('../logger');

async function migrate() {
    try {
        console.log('Adding is_verified column to users table...');
        await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;');
        console.log('Updating existing users to be verified...');
        await db.query('UPDATE users SET is_verified = TRUE WHERE is_verified = FALSE;');
        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
