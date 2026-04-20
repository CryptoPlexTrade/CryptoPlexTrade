/**
 * Database Cleanup Script
 * Deletes ALL data except the admin account (admin@cryptoplextrade.com).
 * Run with: node scratch/cleanup_db.js
 */
require('dotenv').config();
const db = require('../database');

(async () => {
    const ADMIN_EMAIL = 'admin@cryptoplextrade.com';

    console.log('🧹 Starting database cleanup...');
    console.log(`   Preserving admin: ${ADMIN_EMAIL}\n`);

    try {
        // 1. Get the admin user ID
        const [adminRows] = await db.query('SELECT id FROM users WHERE email = ?', [ADMIN_EMAIL]);
        if (adminRows.length === 0) {
            console.error('❌ Admin account not found! Aborting.');
            process.exit(1);
        }
        const adminId = adminRows[0].id;
        console.log(`   ✓ Admin ID: ${adminId}`);

        // 2. Delete all chat messages & sessions
        const [msgDel] = await db.query('DELETE FROM chat_messages');
        console.log(`   ✓ Deleted ${msgDel.affectedRows} chat messages`);

        const [sesDel] = await db.query('DELETE FROM chat_sessions');
        console.log(`   ✓ Deleted ${sesDel.affectedRows} chat sessions`);

        // 3. Delete all ticket replies
        const [repDel] = await db.query('DELETE FROM ticket_replies');
        console.log(`   ✓ Deleted ${repDel.affectedRows} ticket replies`);

        // 4. Delete all support tickets
        const [tickDel] = await db.query('DELETE FROM support_tickets');
        console.log(`   ✓ Deleted ${tickDel.affectedRows} support tickets`);

        // 5. Delete all orders
        const [ordDel] = await db.query('DELETE FROM orders');
        console.log(`   ✓ Deleted ${ordDel.affectedRows} orders`);

        // 6. Clear referred_by_id references on admin (in case it points to a user being deleted)
        await db.query('UPDATE users SET referred_by_id = NULL WHERE id = ?', [adminId]);

        // 7. Delete all users except admin
        const [usrDel] = await db.query('DELETE FROM users WHERE email != ?', [ADMIN_EMAIL]);
        console.log(`   ✓ Deleted ${usrDel.affectedRows} users`);

        // 8. Reset admin's volatile fields to clean state
        await db.query(
            `UPDATE users SET 
                verify_token = NULL, 
                verify_expires = NULL, 
                reset_token = NULL, 
                reset_expires = NULL, 
                airtime_sent = FALSE,
                is_verified = TRUE
             WHERE id = ?`,
            [adminId]
        );
        console.log('   ✓ Admin profile reset to clean state');

        console.log('\n✅ Database cleanup complete! Only the admin account remains.');
    } catch (err) {
        console.error('❌ Cleanup failed:', err.message);
    }

    process.exit(0);
})();
