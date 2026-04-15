require('dotenv').config();
const db = require('../database');

(async () => {
    try {
        const [users] = await db.query('SELECT id, email, verify_token, verify_expires FROM users WHERE email = ?', ['wisonkeneth@gmail.com']);
        console.log("DB Record for user:", users[0]);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
})();
