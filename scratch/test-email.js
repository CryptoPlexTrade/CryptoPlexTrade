require('dotenv').config();
const { sendVerificationEmail } = require('../emailService');

(async () => {
    try {
        console.log("Attempting to send a test verification email...");
        await sendVerificationEmail('test@example.com', '123456');
        console.log("Function completed. Did it error?");
    } catch (e) {
        console.error("Error occurred while sending email:", e);
    }
})();
