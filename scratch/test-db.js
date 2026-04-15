require('dotenv').config();
const db = require('../database');

(async () => {
    try {
        const otpCode = "123456";
        const expiresAt = Date.now() + 5 * 60 * 1000;
        console.log("Updating DB with OTP:", otpCode, "Expires:", expiresAt);
        const [rows, meta] = await db.query('UPDATE users SET verify_token = ?, verify_expires = ? WHERE email = ?', [otpCode, expiresAt, 'wisonkeneth@gmail.com']);
        console.log("Update meta:", meta);

        const [users] = await db.query('SELECT id, email, verify_token, verify_expires FROM users WHERE email = ?', ['wisonkeneth@gmail.com']);
        console.log("DB Record for user:", users[0]);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
