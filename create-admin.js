const bcrypt = require('bcryptjs');
const db = require('./database');
const logger = require('./logger');
require('dotenv').config();

/**
 * A command-line script to create an admin user or reset their password.
 *
 * Usage:
 * node create-admin.js <email> <password>
 *
 * Example:
 * node create-admin.js admin@chainexchange.com "new-secure-password"
 */

async function createOrUpdateAdmin() {
    const email = process.argv[2];
    const password = process.argv[3];

    if (!email || !password) {
        logger.error('Usage: node create-admin.js <email> <password>');
        logger.warn('Please provide an email and a password. If your password has special characters, wrap it in quotes.');
        return;
    }

    try {
        // Hash the password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Check if the user already exists
        const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);

        if (users.length > 0) {
            // User exists, update their password and ensure they are an admin
            await db.query('UPDATE users SET password = ?, role = ? WHERE email = ?', [hashedPassword, 'admin', email]);
            logger.info(`Admin user '${email}' already existed. Their password has been reset and role confirmed as admin.`);
        } else {
            // User does not exist, create a new admin user
            await db.query('INSERT INTO users (fullname, email, phone, password, role) VALUES (?, ?, ?, ?, ?)', ['Administrator', email, '', hashedPassword, 'admin']);
            logger.info(`Successfully created new admin user with email '${email}'.`);
        }
    } catch (error) {
        logger.error('An error occurred while creating/updating the admin user:', error);
    } finally {
        await db.end(); // Close the database connection
    }
}

createOrUpdateAdmin();