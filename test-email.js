require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

async function run() {
    try {
        console.log("Sending email from process.env.SMTP_FROM...");
        let info1 = await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to: process.env.ADMIN_EMAIL,
            subject: "Test 1: From SMTP_FROM",
            text: "Testing from noreply..."
        });
        console.log("Sent test 1:", info1.messageId);

        console.log("Sending email from process.env.SMTP_USER...");
        let info2 = await transporter.sendMail({
            from: process.env.SMTP_USER,
            to: process.env.ADMIN_EMAIL,
            subject: "Test 2: From SMTP_USER",
            text: "Testing from Support directly..."
        });
        console.log("Sent test 2:", info2.messageId);
    } catch(e) {
        console.error(e);
    }
}
run();
