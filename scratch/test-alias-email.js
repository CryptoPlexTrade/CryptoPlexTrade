require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function testBoth() {
    const target = 'Paulrosshart@yahoo.com';

    // Test 1: Send from noreply alias
    console.log(`\n--- Test 1: Sending from noreply alias to ${target} ---`);
    try {
        const info1 = await transporter.sendMail({
            from: `"CryptoPlexTrade" <${process.env.SMTP_FROM}>`,
            to: target,
            subject: 'Test 1 - From noreply alias',
            text: 'This email is from noreply@cryptoplextrade.com',
        });
        console.log('✅ Sent! Response:', info1.response);
    } catch (err) {
        console.log('❌ Failed:', err.message);
    }

    // Test 2: Send from support (SMTP_USER directly)
    console.log(`\n--- Test 2: Sending from support to ${target} ---`);
    try {
        const info2 = await transporter.sendMail({
            from: `"CryptoPlexTrade" <${process.env.SMTP_USER}>`,
            to: target,
            subject: 'Test 2 - From support address',
            text: 'This email is from Support@cryptoplextrade.com',
        });
        console.log('✅ Sent! Response:', info2.response);
    } catch (err) {
        console.log('❌ Failed:', err.message);
    }

    console.log('\n--- Check inbox AND spam folder on Yahoo ---');
    process.exit(0);
}

testBoth();
