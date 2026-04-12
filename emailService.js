const nodemailer = require('nodemailer');
const logger = require('./logger');
require('dotenv').config();

let transporter;

// Initialize the transporter only if SMTP settings are present
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        pool: true, // Enable connection pooling
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    transporter.verify((error, success) => {
        if (error) {
            logger.error('Email transporter configuration error:', error);
        } else {
            logger.info('Email transporter is configured and ready to send emails.');
        }
    });
} else {
    logger.warn('SMTP configuration is missing. Email notifications will be disabled.');
}

/**
 * Sends an email notification to the admin about a new order.
 * @param {object} orderDetails - The details of the order.
 * @param {number} orderId - The ID of the newly created order.
 */
async function sendNewOrderNotification(orderDetails, orderId) {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping new order notification.');
        return;
    }

    const { order_type, user_email } = orderDetails;
    const subject = `New ${order_type.toUpperCase()} Order Received - #${orderId}`;
    let textBody = `A new order has been placed by ${user_email}.\n\n`;
    let htmlBody = `
        <h1>New Order Notification</h1>
        <p>A new <strong>${order_type.toUpperCase()}</strong> order has been placed by <strong>${user_email}</strong>.</p>
        <h2>Order Summary (ID: #${orderId})</h2>`;

    if (order_type === 'buy') {
        htmlBody += `
            <ul>
                <li><strong>Product:</strong> ${orderDetails.product}</li>
                <li><strong>Amount User Buys:</strong> ${orderDetails.usd_amount} ${orderDetails.product}</li>
                <li><strong>Total Paid by User (GHS):</strong> ₵${orderDetails.total_paid_ghs.toFixed(2)}</li>
                <li><strong>User's Receiving Wallet:</strong> ${orderDetails.wallet_address}</li>
                <li><strong>User's Payment TXID:</strong> ${orderDetails.user_transaction_id}</li>
            </ul>`;
        textBody += `Order ID: #${orderId}\nType: BUY\nProduct: ${orderDetails.product}\nAmount User Buys: ${orderDetails.usd_amount} ${orderDetails.product}\nTotal Paid (GHS): ${orderDetails.total_paid_ghs.toFixed(2)}\nUser's Receiving Wallet: ${orderDetails.wallet_address}\nUser's Payment TXID: ${orderDetails.user_transaction_id}`;
    } else { // Sell Order
        htmlBody += `
            <ul>
                <li><strong>Product:</strong> ${orderDetails.product}</li>
                <li><strong>Amount User Sells:</strong> ${orderDetails.product_amount} ${orderDetails.product}</li>
                <li><strong>GHS to Pay User:</strong> ₵${orderDetails.ghs_to_receive.toFixed(2)}</li>
                <li><strong>User's Crypto TXID:</strong> ${orderDetails.user_transaction_id}</li>
            </ul>
            <h3>User Payout Information:</h3>
            <ul>
                <li><strong>Method:</strong> ${orderDetails.payout_info.method === 'momo' ? 'Mobile Money' : 'Bank Transfer'}</li>
                ${orderDetails.payout_info.method === 'momo'
                    ? `<li><strong>MoMo Number:</strong> ${orderDetails.payout_info.number}</li><li><strong>MoMo Name:</strong> ${orderDetails.payout_info.name}</li>`
                    : `<li><strong>Bank Name:</strong> ${orderDetails.payout_info.bankName}</li><li><strong>Account Name:</strong> ${orderDetails.payout_info.accountName}</li><li><strong>Account Number:</strong> ${orderDetails.payout_info.accountNumber}</li>`
                }
            </ul>`;
        textBody += `Order ID: #${orderId}\nType: SELL\nProduct: ${orderDetails.product}\nAmount User Sells: ${orderDetails.product_amount} ${orderDetails.product}\nGHS to Pay User: ${orderDetails.ghs_to_receive.toFixed(2)}\nUser's Crypto TXID: ${orderDetails.user_transaction_id}\n\nPayout Method: ${orderDetails.payout_info.method}\n... see HTML email for full payout details.`;
    }

    htmlBody += `<p>Please log in to the admin panel to review and process the order.</p>`;
    textBody += `\n\nPlease log in to the admin panel to review and process the order.`;

    await transporter.sendMail({ from: `"CryptoPlexTrade Notifier" <${process.env.SMTP_USER}>`, to: process.env.ADMIN_EMAIL, subject, text: textBody, html: htmlBody });
    logger.info(`Admin notification sent for new order #${orderId}`);
}

/**
 * Sends a password reset email to a user.
 * @param {object} user - The user object ({ fullname, email }).
 * @param {string} resetUrl - The full reset URL with token.
 */
async function sendPasswordResetEmail(user, resetUrl) {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping password reset email.');
        return;
    }

    const senderDomain = (process.env.SMTP_USER || 'noreply@example.com').split('@')[1];
    const messageId    = `<${Date.now()}.reset@${senderDomain}>`;
    const subject      = 'Your password reset link';

    // Plain-text — required and important for spam scoring
    const textBody = [
        `Hi ${user.fullname},`,
        ``,
        `We received a request to reset your CryptoPlexTrade account password.`,
        `Click or paste the link below into your browser to set a new password.`,
        `This link expires in 1 hour.`,
        ``,
        `${resetUrl}`,
        ``,
        `If you did not request this, you can safely ignore this email.`,
        `Your password will not change unless you click the link above.`,
        ``,
        `-- CryptoPlexTrade Support`,
        `support@winningedgeinvestment.com`,
    ].join('\r\n');

    // Clean, simple HTML — avoid CSS tricks that spam filters flag
    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dde9f7;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#005baa;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;">CryptoPlexTrade</p>
            <p style="margin:4px 0 0;font-size:13px;color:#b3d4f0;">Account Security</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">Hi <strong>${user.fullname}</strong>,</p>
            <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">We received a request to reset your password. Click the button below to choose a new one. This link is valid for <strong>1 hour</strong>.</p>
            <!-- Button -->
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#005baa;">
                  <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Reset My Password</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.6;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="margin:0 0 24px;font-size:12px;color:#005baa;word-break:break-all;">${resetUrl}</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">CryptoPlexTrade &middot; <a href="mailto:support@winningedgeinvestment.com" style="color:#94a3b8;">support@winningedgeinvestment.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from:    `"CryptoPlexTrade" <${process.env.SMTP_USER}>`,
        to:      user.email,
        subject,
        text:    textBody,
        html:    htmlBody,
        headers: {
            'Message-ID':      messageId,
            'List-Unsubscribe': `<mailto:${process.env.SMTP_USER}?subject=unsubscribe>`,
            'X-Mailer':        'CryptoPlexTrade Mailer',
        },
    });
    logger.info(`Password reset email sent to ${user.email}`);
}

module.exports = { sendNewOrderNotification, sendPasswordResetEmail };