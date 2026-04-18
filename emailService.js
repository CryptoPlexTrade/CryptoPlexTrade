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
        // Improve deliverability
        tls: { rejectUnauthorized: true },
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

// Consistent sender identity — always use the same From address & name
const SENDER_NAME  = 'CryptoPlexTrade';
const getSender    = () => `"${SENDER_NAME}" <${process.env.SMTP_USER}>`;
const getReplyTo   = () => process.env.ADMIN_EMAIL || process.env.SMTP_USER;
const getAppDomain = () => process.env.APP_URL || 'cryptoplextrade.com';

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
    let textBody = `A new order has been placed by ${user_email}.\r\n\r\n`;
    let htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dde9f7;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#005baa;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;">${SENDER_NAME}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#b3d4f0;">New Order Alert</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">A new <strong>${order_type.toUpperCase()}</strong> order has been placed by <strong>${user_email}</strong>.</p>
            <h2 style="margin:0 0 16px;font-size:17px;color:#1e293b;">Order Summary (ID: ${formattedId})</h2>`;

    if (order_type === 'buy') {
        htmlBody += `
            <ul style="padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
                <li><strong>Product:</strong> ${orderDetails.product}</li>
                <li><strong>Amount User Buys:</strong> ${orderDetails.usd_amount} ${orderDetails.product}</li>
                <li><strong>Total Paid by User (GHS):</strong> ₵${orderDetails.total_paid_ghs.toFixed(2)}</li>
                <li><strong>User's Receiving Wallet:</strong> ${orderDetails.wallet_address}</li>
                <li><strong>User's Payment TXID:</strong> ${orderDetails.user_transaction_id}</li>
            </ul>`;
        textBody += `Order ID: ${formattedId}\r\nType: BUY\r\nProduct: ${orderDetails.product}\r\nAmount User Buys: ${orderDetails.usd_amount} ${orderDetails.product}\r\nTotal Paid (GHS): ${orderDetails.total_paid_ghs.toFixed(2)}\r\nUser's Receiving Wallet: ${orderDetails.wallet_address}\r\nUser's Payment TXID: ${orderDetails.user_transaction_id}`;
    } else { // Sell Order
        htmlBody += `
            <ul style="padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
                <li><strong>Product:</strong> ${orderDetails.product}</li>
                <li><strong>Amount User Sells:</strong> ${orderDetails.product_amount} ${orderDetails.product}</li>
                <li><strong>GHS to Pay User:</strong> ₵${orderDetails.ghs_to_receive.toFixed(2)}</li>
                <li><strong>User's Crypto TXID:</strong> ${orderDetails.user_transaction_id}</li>
            </ul>
            <h3 style="margin:16px 0 8px;font-size:15px;color:#1e293b;">User Payout Information:</h3>
            <ul style="padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
                <li><strong>Method:</strong> ${orderDetails.payout_info.method === 'momo' ? 'Mobile Money' : 'Bank Transfer'}</li>
                ${orderDetails.payout_info.method === 'momo'
                    ? `<li><strong>MoMo Number:</strong> ${orderDetails.payout_info.number}</li><li><strong>MoMo Name:</strong> ${orderDetails.payout_info.name}</li>`
                    : `<li><strong>Bank Name:</strong> ${orderDetails.payout_info.bankName}</li><li><strong>Account Name:</strong> ${orderDetails.payout_info.accountName}</li><li><strong>Account Number:</strong> ${orderDetails.payout_info.accountNumber}</li>`
                }
            </ul>`;
        textBody += `Order ID: #${orderId}\r\nType: SELL\r\nProduct: ${orderDetails.product}\r\nAmount User Sells: ${orderDetails.product_amount} ${orderDetails.product}\r\nGHS to Pay User: ${orderDetails.ghs_to_receive.toFixed(2)}\r\nUser's Crypto TXID: ${orderDetails.user_transaction_id}\r\n\r\nPayout Method: ${orderDetails.payout_info.method}`;
    }

    htmlBody += `
            <p style="margin:24px 0 0;font-size:14px;color:#475569;">Please log in to the admin panel to review and process the order.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">${SENDER_NAME} &middot; <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#94a3b8;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    textBody += `\r\n\r\nPlease log in to the admin panel to review and process the order.`;

    const domain = getAppDomain();
    await transporter.sendMail({
        from:      getSender(),
        replyTo:   getReplyTo(),
        to:        process.env.ADMIN_EMAIL,
        subject,
        text:      textBody,
        html:      htmlBody,
        headers: {
            'Message-ID': `<${Date.now()}.order-${orderId}@${domain}>`,
            'Precedence': 'bulk',
        },
    });
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

    const domain    = getAppDomain();
    const messageId = `<${Date.now()}.reset@${domain}>`;
    const subject   = 'Your password reset link';

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
        `${process.env.ADMIN_EMAIL}`,
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
            <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;">${SENDER_NAME}</p>
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
                <td style="background:#005baa;border-radius:6px;">
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
            <p style="margin:0;font-size:11px;color:#94a3b8;">${SENDER_NAME} &middot; <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#94a3b8;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from:    getSender(),
        replyTo: getReplyTo(),
        to:      user.email,
        subject,
        text:    textBody,
        html:    htmlBody,
        headers: {
            'Message-ID':       messageId,
            'List-Unsubscribe': `<mailto:${process.env.ADMIN_EMAIL}?subject=unsubscribe>`,
            'Precedence':       'bulk',
        },
    });
    logger.info(`Password reset email sent to ${user.email}`);
}

/**
 * Sends an email notification to the admin about a new live chat session.
 * @param {string} guestName - The name of the guest who started the chat.
 * @param {number} sessionId - The ID of the chat session.
 */
async function sendLiveChatNotification(guestName, sessionId) {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping live chat notification.');
        return;
    }

    const subject = `New Live Chat Initiated - ${guestName}`;
    const domain = getAppDomain();
    const adminUrl = `${process.env.APP_URL || 'http://' + domain}/admin/livechat.html`;

    const textBody = `A new live chat session has been started by ${guestName}.\r\n\r\n` +
                     `Session ID: #${sessionId}\r\n` +
                     `You can reply to this chat in the admin panel: ${adminUrl}`;

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
            <p style="margin:0;font-size:20px;font-weight:bold;color:#ffffff;">${SENDER_NAME}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#b3d4f0;">Live Chat Alert</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">A new live chat session has been started by <strong>${guestName}</strong>.</p>
            <p style="margin:0 0 16px;font-size:14px;color:#475569;">Session ID: <strong>#${sessionId}</strong></p>
            <!-- Button -->
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:#005baa;border-radius:6px;">
                  <a href="${adminUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Reply to Chat</a>
                </td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Access the admin panel to manage all active conversations.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">${SENDER_NAME} &middot; <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#94a3b8;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from:      getSender(),
        replyTo:   getReplyTo(),
        to:        process.env.ADMIN_EMAIL,
        subject,
        text:      textBody,
        html:      htmlBody,
        headers: {
            'Message-ID': `<${Date.now()}.chat-${sessionId}@${domain}>`,
            'Precedence': 'bulk',
        },
    });
    logger.info(`Admin notification sent for new chat session #${sessionId}`);
}

/**
 * Sends an email to the customer when their order is marked as completed.
 * @param {object} order - The order object from the DB.
 * @param {string} userEmail - The customer's email address.
 */
async function sendOrderCompletedEmail(order, userEmail) {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping order completed email.');
        return;
    }

    const domain = getAppDomain();
    // Ensure the URL has https:// prefix for email image loading
    let appUrl = process.env.APP_URL || 'https://cryptoplextrade.com';
    if (!appUrl.startsWith('http')) appUrl = 'https://' + appUrl;
    const orderId = order.id;
    const orderType = order.order_type === 'buy' ? 'Purchase' : 'Sale';
    const product = order.product;
    const totalPaid = parseFloat(order.total_paid || 0).toFixed(2);

    const subject = `Your ${orderType} Order #${orderId} is Complete ✓`;

    const textBody = [
        `Dear Valued Customer,`,
        ``,
        `Great news! Your ${orderType.toLowerCase()} order #${orderId} has been successfully completed.`,
        ``,
        `Order Summary:`,
        `  Order ID: #${orderId}`,
        `  Type: ${orderType}`,
        `  Product: ${product}`,
        `  Amount: ₵${totalPaid}`,
        ``,
        `If you have any questions about this transaction, please don't hesitate to reach out to our support team.`,
        ``,
        `Thank you for choosing CryptoPlexTrade!`,
        ``,
        `-- CryptoPlexTrade`,
        `${process.env.ADMIN_EMAIL}`,
    ].join('\r\n');

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f7ff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,91,170,0.12);max-width:600px;width:100%;border:1px solid #dde9f7;">
        <!-- Header with logo -->
        <tr>
          <td style="background:linear-gradient(135deg, #005baa, #00a9e0);padding:32px;text-align:center;">
            <img src="${appUrl}/css/logo.png" alt="CryptoPlexTrade" style="height:50px;width:auto;border-radius:10px;margin-bottom:14px;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Transaction Completed</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 14px;font-size:15px;color:#1e293b;">Dear Valued Customer,</p>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">Great news! Your <strong>${orderType.toLowerCase()} order ${orderId}</strong> has been <strong style="color:#28a745;">successfully completed</strong>.</p>

            <!-- Success Badge -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#e9f5ec;border:1px solid #b8e6c4;border-radius:10px;padding:20px;text-align:center;">
                  <div style="background:#28a745;color:#fff;width:44px;height:44px;line-height:44px;border-radius:50%;font-size:22px;margin:0 auto 10px;">&#10003;</div>
                  <p style="margin:0;font-size:17px;font-weight:700;color:#28a745;">Order Complete</p>
                </td>
              </tr>
            </table>

            <!-- Order Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 28px;">
              <tr>
                <td colspan="2" style="background:#005baa;padding:12px 16px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px;">Order Summary</p>
                </td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:14px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Order ID</td>
                <td style="padding:14px 16px;font-size:14px;color:#1e293b;font-weight:700;border-bottom:1px solid #e2e8f0;text-align:right;">${orderId}</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Type</td>
                <td style="padding:14px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;text-align:right;">${orderType}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:14px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Product</td>
                <td style="padding:14px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;text-align:right;">${product}</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;font-size:13px;color:#64748b;font-weight:600;">Amount (GHS)</td>
                <td style="padding:14px 16px;font-size:16px;color:#005baa;font-weight:700;text-align:right;">₵${totalPaid}</td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:14px;color:#475569;line-height:1.7;">If you have any questions about this transaction, please don't hesitate to contact our support team.</p>
            <p style="margin:20px 0 0;font-size:15px;color:#1e293b;font-weight:600;">Thank you for choosing CryptoPlexTrade! 🚀</p>
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

    await transporter.sendMail({
        from:    getSender(),
        replyTo: getReplyTo(),
        to:      userEmail,
        subject,
        text:    textBody,
        html:    htmlBody,
        headers: {
            'Message-ID':       `<${Date.now()}.completed-${orderId}@${domain}>`,
            'List-Unsubscribe': `<mailto:${process.env.ADMIN_EMAIL}?subject=unsubscribe>`,
            'Precedence':       'bulk',
        },
    });
    logger.info(`Order completed email sent to ${userEmail} for order #${orderId}`);
}
/**
 * Sends a 6-digit OTP verification email for new account sign-ups.
 * @param {string} email - The user's email address.
 * @param {string} otpCode - The 6-digit OTP code to send.
 */
async function sendVerificationEmail(email, otpCode) {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping verification email.');
        return;
    }

    const domain = getAppDomain();
    let appUrl = process.env.APP_URL || 'https://cryptoplextrade.com';
    if (!appUrl.startsWith('http')) appUrl = 'https://' + appUrl;

    const subject = 'Verify your email address - CryptoPlexTrade';

    const textBody = [
        `Welcome to CryptoPlexTrade!`,
        ``,
        `Your email verification code is: ${otpCode}`,
        ``,
        `This code will expire in 5 minutes.`,
        `If you didn't request this, you can safely ignore this email.`,
        ``,
        `-- CryptoPlexTrade`,
    ].join('\r\n');

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f7ff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,91,170,0.12);max-width:600px;width:100%;border:1px solid #dde9f7;">
        <!-- Header with logo -->
        <tr>
          <td style="background:linear-gradient(135deg, #005baa, #00a9e0);padding:32px;text-align:center;">
            <img src="${appUrl}/css/logo.png" alt="CryptoPlexTrade" style="height:50px;width:auto;border-radius:10px;margin-bottom:14px;">
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Verify Your Email</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">Thank you for registering! Please use the verification code below to complete your sign-up process.</p>

            <!-- OTP Display -->
            <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:10px;padding:24px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;text-transform:uppercase;color:#64748b;font-weight:600;letter-spacing:1px;margin-bottom:8px;">Your Verification Code</p>
              <h2 style="margin:0;font-size:36px;font-weight:800;color:#005baa;letter-spacing:6px;">${otpCode}</h2>
            </div>
            
            <p style="margin:0 0 8px;font-size:13px;color:#64748b;">This code will expire in <strong>5 minutes</strong>.</p>
            <p style="margin:0;font-size:13px;color:#94a3b8;">If you did not request this, please ignore this email.</p>
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

    await transporter.sendMail({
        from:    `"${SENDER_NAME}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        replyTo: getReplyTo(),
        to:      email,
        subject,
        text:    textBody,
        html:    htmlBody,
        headers: {
            'Message-ID':       `<${Date.now()}.verify@${domain}>`
        },
    });
    logger.info(`Verification email sent to ${email}`);
}

/**
 * Sends an email alert to the admin when a user submits KYC documents.
 * @param {object} user - { fullname, email } of the submitting user.
 * @param {string} idType - The type of ID submitted (e.g. 'passport').
 */
async function sendKycSubmissionAlert(user, idType) {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping KYC alert.');
        return;
    }

    const domain   = getAppDomain();
    let appUrl = process.env.APP_URL || 'https://cryptoplextrade.com';
    if (!appUrl.startsWith('http')) appUrl = 'https://' + appUrl;
    const kycAdminUrl = `${appUrl}/admin/kyc.html`;
    const subject     = `🔔 KYC Submission — ${user.fullname || user.email}`;

    const idLabel = (idType || 'Unknown')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    const textBody = [
        `New KYC Submission`,
        ``,
        `A user has submitted their KYC documents and is awaiting approval.`,
        ``,
        `User:     ${user.fullname || 'N/A'}`,
        `Email:    ${user.email}`,
        `ID Type:  ${idLabel}`,
        ``,
        `Review and approve or reject the submission in the admin panel:`,
        kycAdminUrl,
        ``,
        `-- ${SENDER_NAME}`,
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
          <td style="background:linear-gradient(135deg,#005baa,#00a9e0);padding:32px;text-align:center;">
            <img src="${appUrl}/css/logo.png" alt="${SENDER_NAME}" style="height:50px;width:auto;border-radius:10px;margin-bottom:14px;">
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">KYC Verification Submitted</h1>
            <p style="margin:6px 0 0;font-size:13px;color:#b3d4f0;">Action Required — Admin Review Needed</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">A user has submitted their identity documents and is waiting for your approval before they can start trading.</p>

            <!-- Alert Badge -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#fff8e1;border:1px solid #fbbf24;border-radius:10px;padding:16px 20px;">
                  <p style="margin:0;font-size:13px;font-weight:700;color:#92400e;">&#9888; Pending KYC Approval</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#78350f;">This user cannot trade until you approve their submission.</p>
                </td>
              </tr>
            </table>

            <!-- User Details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:0 0 28px;">
              <tr>
                <td colspan="2" style="background:#005baa;padding:12px 16px;">
                  <p style="margin:0;font-size:12px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:0.8px;">Submission Details</p>
                </td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:14px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;width:40%;">Full Name</td>
                <td style="padding:14px 16px;font-size:14px;color:#1e293b;font-weight:700;border-bottom:1px solid #e2e8f0;">${user.fullname || 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding:14px 16px;font-size:13px;color:#64748b;font-weight:600;border-bottom:1px solid #e2e8f0;">Email</td>
                <td style="padding:14px 16px;font-size:14px;color:#005baa;border-bottom:1px solid #e2e8f0;">${user.email}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:14px 16px;font-size:13px;color:#64748b;font-weight:600;">ID Type Submitted</td>
                <td style="padding:14px 16px;font-size:14px;color:#1e293b;font-weight:600;">${idLabel}</td>
              </tr>
            </table>

            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#005baa;border-radius:8px;">
                  <a href="${kycAdminUrl}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Review KYC Submission</a>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">This notification was automatically generated after the user submitted their KYC documents.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#64748b;">${SENDER_NAME}</p>
            <p style="margin:0;font-size:11px;color:#94a3b8;"><a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#005baa;text-decoration:none;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from:    getSender(),
        replyTo: getReplyTo(),
        to:      process.env.ADMIN_EMAIL,
        subject,
        text:    textBody,
        html:    htmlBody,
        headers: {
            'Message-ID': `<${Date.now()}.kyc-${user.email.replace('@','.')}@${domain}>`,
            'Precedence': 'bulk',
        },
    });
    logger.info(`KYC submission alert sent to admin for user: ${user.email}`);
}

/**
 * Sends an approval email to a user when their KYC is approved by admin.
 * @param {object} user - { fullname, email }
 */
async function sendKycApprovedEmail(user) {
    if (!transporter) { logger.warn('Email service not configured. Skipping KYC approved email.'); return; }

    const domain = getAppDomain();
    let appUrl = process.env.APP_URL || 'https://cryptoplextrade.com';
    if (!appUrl.startsWith('http')) appUrl = 'https://' + appUrl;
    const tradeUrl = `${appUrl}/trade.html`;
    const subject  = `✅ Your Account is Verified — You Can Now Trade!`;

    const textBody = [
        `Hi ${user.fullname || 'there'},`,
        ``,
        `Great news! Your identity verification has been approved.`,
        `You can now buy and sell crypto on CryptoPlexTrade.`,
        ``,
        `Start trading: ${tradeUrl}`,
        ``,
        `Thank you for completing the verification process.`,
        `-- ${SENDER_NAME}`,
    ].join('\r\n');

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f7ff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,91,170,0.12);max-width:600px;width:100%;border:1px solid #dde9f7;">
        <tr>
          <td style="background:linear-gradient(135deg,#005baa,#00a9e0);padding:32px;text-align:center;">
            <img src="${appUrl}/css/logo.png" alt="${SENDER_NAME}" style="height:50px;width:auto;border-radius:10px;margin-bottom:14px;">
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Identity Verified &#10003;</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#e9f5ec;border:1px solid #b8e6c4;border-radius:12px;padding:24px;text-align:center;">
                  <div style="background:#28a745;color:#fff;width:52px;height:52px;line-height:52px;border-radius:50%;font-size:26px;margin:0 auto 12px;">&#10003;</div>
                  <p style="margin:0;font-size:18px;font-weight:700;color:#16a34a;">KYC Approved!</p>
                  <p style="margin:8px 0 0;font-size:14px;color:#15803d;">Your account is now fully verified.</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 24px;font-size:15px;color:#1e293b;line-height:1.7;">Hi <strong>${user.fullname || 'there'}</strong>, great news! Your identity has been successfully verified. You can now access all features of CryptoPlexTrade including buying and selling crypto.</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#28a745;border-radius:8px;">
                  <a href="${tradeUrl}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Start Trading Now</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:12px;color:#94a3b8;">Thank you for choosing ${SENDER_NAME}.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">${SENDER_NAME} &middot; <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#005baa;text-decoration:none;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: getSender(), replyTo: getReplyTo(), to: user.email, subject,
        text: textBody, html: htmlBody,
        headers: { 'Message-ID': `<${Date.now()}.kyc-approved@${domain}>`, 'Precedence': 'bulk' },
    });
    logger.info(`KYC approved email sent to ${user.email}`);
}

/**
 * Sends a rejection email to a user when their KYC is rejected by admin.
 * @param {object} user - { fullname, email }
 */
async function sendKycRejectedEmail(user) {
    if (!transporter) { logger.warn('Email service not configured. Skipping KYC rejected email.'); return; }

    const domain = getAppDomain();
    let appUrl = process.env.APP_URL || 'https://cryptoplextrade.com';
    if (!appUrl.startsWith('http')) appUrl = 'https://' + appUrl;
    const kycUrl  = `${appUrl}/kyc.html`;
    const subject = `Action Required — KYC Verification Unsuccessful`;

    const textBody = [
        `Hi ${user.fullname || 'there'},`,
        ``,
        `Unfortunately, we were unable to verify your identity with the documents submitted.`,
        ``,
        `This may be due to:`,
        `  - Blurry or unclear document images`,
        `  - Documents that are expired`,
        `  - Mismatched personal information`,
        ``,
        `Please re-submit your KYC with clearer, valid documents:`,
        kycUrl,
        ``,
        `If you believe this is a mistake, please contact our support team.`,
        `-- ${SENDER_NAME}`,
    ].join('\r\n');

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f7ff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,91,170,0.12);max-width:600px;width:100%;border:1px solid #dde9f7;">
        <tr>
          <td style="background:linear-gradient(135deg,#005baa,#00a9e0);padding:32px;text-align:center;">
            <img src="${appUrl}/css/logo.png" alt="${SENDER_NAME}" style="height:50px;width:auto;border-radius:10px;margin-bottom:14px;">
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Verification Update</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="background:#fff1f0;border:1px solid #fca5a5;border-radius:12px;padding:20px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">&#9888; KYC Submission Unsuccessful</p>
                  <p style="margin:6px 0 0;font-size:13px;color:#b91c1c;">We were unable to verify your identity with the submitted documents.</p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">Hi <strong>${user.fullname || 'there'}</strong>,</p>
            <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.7;">Unfortunately, your KYC submission could not be approved. This is often due to one of the following reasons:</p>
            <ul style="padding-left:20px;color:#475569;font-size:14px;line-height:1.9;margin:0 0 24px;">
              <li>Blurry or unclear document images</li>
              <li>Expired ID or passport</li>
              <li>Mismatched personal information</li>
              <li>Incomplete document (all pages/sides required)</li>
            </ul>
            <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.7;">Please <strong>re-submit your KYC</strong> with clear, valid documents to get your account verified.</p>
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
              <tr>
                <td style="background:#005baa;border-radius:8px;">
                  <a href="${kycUrl}" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Re-submit KYC</a>
                </td>
              </tr>
            </table>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">If you believe this decision is incorrect, please contact our support team by replying to this email.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#94a3b8;">${SENDER_NAME} &middot; <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#005baa;text-decoration:none;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await transporter.sendMail({
        from: getSender(), replyTo: getReplyTo(), to: user.email, subject,
        text: textBody, html: htmlBody,
        headers: { 'Message-ID': `<${Date.now()}.kyc-rejected@${domain}>`, 'Precedence': 'bulk' },
    });
    logger.info(`KYC rejected email sent to ${user.email}`);
}

module.exports = { sendNewOrderNotification, sendPasswordResetEmail, sendLiveChatNotification, sendOrderCompletedEmail, sendVerificationEmail, sendKycSubmissionAlert, sendKycApprovedEmail, sendKycRejectedEmail };