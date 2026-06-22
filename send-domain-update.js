/**
 * send-domain-update.js
 * ─────────────────────────────────────────────────────────────
 * One-time script to notify all users about the domain change.
 *
 * Each user receives an INDIVIDUAL email (no CC/BCC) so no user
 * can see any other user's email address.
 *
 * Usage:   node send-domain-update.js
 *          node send-domain-update.js --dry-run   (preview without sending)
 * ─────────────────────────────────────────────────────────────
 */

const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

// ── Config ───────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_BETWEEN_EMAILS_MS = 2000; // 2 seconds between sends (Gmail limit ~20/sec, stay safe)
const SENDER_NAME = 'CryptoPlexTrade';

// ── DB Connection ────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── SMTP Transporter ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: true },
  name: 'cryptoplextrades.com',
});

const getSender = () => `"${SENDER_NAME}" <${process.env.SMTP_USER}>`;
const getReplyTo = () => process.env.ADMIN_EMAIL || process.env.SMTP_USER;

// ── Email Template ───────────────────────────────────────────
function buildEmail(userName) {
  const greeting = userName ? `Dear ${userName},` : 'Dear Valued User,';

  const subject = 'Important Update — New Domain for CryptoPlexTrade';

  const textBody = [
    greeting,
    '',
    'We would like to inform you of an important update regarding access to your Crypto Plex Trade account.',
    '',
    'Our platform has moved to a new domain. You can now access the website at:',
    '',
    'https://www.cryptoplextrades.com',
    '',
    'Please note:',
    '  • Your existing login credentials remain the same',
    '  • There is no need to create a new account',
    '  • All account information and balances remain unchanged',
    '',
    'We recommend updating your bookmarks to ensure seamless access moving forward.',
    '',
    'If you experience any issues logging in or have questions, please contact our support team for assistance.',
    '',
    'Thank you for your continued trust and support.',
    '',
    'Best regards,',
    'Crypto Plex Trade Team',
  ].join('\r\n');

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f7ff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,91,170,0.12);max-width:600px;width:100%;border:1px solid #dde9f7;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg, #005baa, #00a9e0);padding:32px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${SENDER_NAME}</h1>
            <p style="margin:8px 0 0;font-size:13px;color:#b3d4f0;">Important Platform Update</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">We would like to inform you of an important update regarding access to your Crypto Plex Trade account.</p>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">Our platform has moved to a new domain. You can now access the website at:</p>

            <!-- New Domain Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#005baa;border-radius:8px;">
                  <a href="https://www.cryptoplextrades.com" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">www.cryptoplextrades.com</a>
                </td>
              </tr>
            </table>

            <!-- Info Box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#e8f4fd;border:1px solid #b3d4f0;border-radius:10px;padding:20px 24px;">
                  <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#005baa;">Please note:</p>
                  <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#334155;line-height:2;">
                    <tr><td style="padding:0 8px 0 0;vertical-align:top;">✓</td><td>Your existing login credentials remain the same</td></tr>
                    <tr><td style="padding:0 8px 0 0;vertical-align:top;">✓</td><td>There is no need to create a new account</td></tr>
                    <tr><td style="padding:0 8px 0 0;vertical-align:top;">✓</td><td>All account information and balances remain unchanged</td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.7;">We recommend updating your bookmarks to ensure seamless access moving forward.</p>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">If you experience any issues logging in or have questions, please contact our support team for assistance.</p>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 24px;">

            <p style="margin:0 0 4px;font-size:14px;color:#1e293b;">Thank you for your continued trust and support.</p>
            <p style="margin:0;font-size:14px;color:#1e293b;font-weight:600;">Best regards,</p>
            <p style="margin:4px 0 0;font-size:14px;color:#005baa;font-weight:700;">Crypto Plex Trade Team</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 6px;font-size:12px;color:#64748b;">${SENDER_NAME}</p>
            <p style="margin:0;font-size:11px;color:#94a3b8;"><a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#005baa;text-decoration:none;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, textBody, htmlBody };
}

// ── Helpers ──────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════════════');
  console.log('  CryptoPlexTrade — Domain Update Email Sender');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN (no emails sent)' : '📨 LIVE SEND'}`);
  console.log('════════════════════════════════════════════════════\n');

  // 1. Fetch all user emails
  console.log('📥 Fetching users from database...');
  const result = await pool.query('SELECT email, fullname FROM users ORDER BY id');
  const users = result.rows;
  console.log(`   Found ${users.length} users.\n`);

  if (users.length === 0) {
    console.log('No users found. Exiting.');
    await pool.end();
    return;
  }

  // 2. Verify SMTP connection
  if (!DRY_RUN) {
    console.log('🔌 Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('   ✅ SMTP connection OK.\n');
    } catch (err) {
      console.error('   ❌ SMTP connection failed:', err.message);
      await pool.end();
      process.exit(1);
    }
  }

  // 3. Send emails one-by-one
  let sent = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const { subject, textBody, htmlBody } = buildEmail(user.fullname);
    const progress = `[${i + 1}/${users.length}]`;

    if (DRY_RUN) {
      console.log(`${progress} 🔍 Would send to: ${user.email} (${user.fullname || 'no name'})`);
      sent++;
      continue;
    }

    try {
      await transporter.sendMail({
        from: getSender(),
        replyTo: getReplyTo(),
        to: user.email,           // Individual email — no CC/BCC, full privacy
        subject,
        text: textBody,
        html: htmlBody,
        headers: {
          'Message-ID': `<${Date.now()}.domain-update-${i}@cryptoplextrades.com>`,
        },
      });
      console.log(`${progress} ✅ Sent to: ${user.email}`);
      sent++;

      // Rate-limit delay (skip after last email)
      if (i < users.length - 1) {
        await sleep(DELAY_BETWEEN_EMAILS_MS);
      }
    } catch (err) {
      console.error(`${progress} ❌ Failed for ${user.email}: ${err.message}`);
      failed++;
      failures.push({ email: user.email, error: err.message });
    }
  }

  // 4. Summary
  console.log('\n════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════');
  console.log(`  Total users:  ${users.length}`);
  console.log(`  Sent:         ${sent}`);
  console.log(`  Failed:       ${failed}`);
  if (failures.length > 0) {
    console.log('\n  Failed addresses:');
    failures.forEach(f => console.log(`    - ${f.email}: ${f.error}`));
  }
  console.log('════════════════════════════════════════════════════\n');

  await pool.end();
  console.log('Done. Database connection closed.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
