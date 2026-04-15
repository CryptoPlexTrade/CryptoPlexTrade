require('dotenv').config();
const db = require('../database');
const crypto = require('crypto');

(async () => {
    try {
        const fullname = "Test User";
        const email = "test2@example.com";
        const phone = "123456789";
        const password = "password123";

        const [result] = await db.query(
            'INSERT INTO users (fullname, phone, email, password, role, is_verified) VALUES (?, ?, ?, ?, ?, ?)',
            [fullname, phone, email, password, 'user', false]
        );
        console.log("Insert result meta:", result);
        console.log("Extracted insertId:", result.insertId);
        
        const newUserId = result.insertId;
        const [updateResult] = await db.query('UPDATE users SET verify_token = ?, verify_expires = ? WHERE id = ?', ["999999", Date.now() + 500000, newUserId]);
        console.log("Update meta:", updateResult);

        const [userAfterUpdate] = await db.query('SELECT verify_token, verify_expires FROM users WHERE id = ?', [newUserId]);
        console.log("User after update:", userAfterUpdate[0]);

        await db.query('DELETE FROM users WHERE id = ?', [newUserId]);
        process.exit(0);
    } catch(e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
})();
