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

function normalizeEmailList(input = []) {
    const values = Array.isArray(input) ? input : [input];
    return [...new Set(
        values
            .flatMap(value => String(value || '').split(/[;,\n]/))
            .map(value => value.trim())
            .filter(Boolean)
    )];
}

function buildAdminRecipientList(extraRecipients = []) {
    const defaults = [
        process.env.ADMIN_EMAIL || 'Supportteam@cryptoplextrades.com',
        'cryptoplextrade@hotmail.com'
    ];
    return normalizeEmailList([...defaults, ...extraRecipients]);
}

const getAdminRecipients = () => buildAdminRecipientList().join(', ');

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
            <h2 style="margin:0 0 16px;font-size:17px;color:#1e293b;">Order Summary (ID: #${orderId})</h2>`;

    if (order_type === 'buy') {
        htmlBody += `
            <ul style="padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
                <li><strong>Product:</strong> ${orderDetails.product}</li>
                <li><strong>Amount User Buys:</strong> ${orderDetails.usd_amount} ${orderDetails.product}</li>
                <li><strong>Total Paid by User (GHS):</strong> ₵${orderDetails.total_paid_ghs.toFixed(2)}</li>
                <li><strong>User's Receiving Wallet:</strong> ${orderDetails.wallet_address}</li>
                <li><strong>User's Payment TXID:</strong> ${orderDetails.user_transaction_id}</li>
            </ul>`;
        textBody += `Order ID: #${orderId}\r\nType: BUY\r\nProduct: ${orderDetails.product}\r\nAmount User Buys: ${orderDetails.usd_amount} ${orderDetails.product}\r\nTotal Paid (GHS): ${orderDetails.total_paid_ghs.toFixed(2)}\r\nUser's Receiving Wallet: ${orderDetails.wallet_address}\r\nUser's Payment TXID: ${orderDetails.user_transaction_id}`;
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
        to:        getAdminRecipients(),
        subject,
        text:      textBody,
        html:      htmlBody,
        headers: {
            'Message-ID': `<${Date.now()}.order-${orderId}@${domain}>`,
            'Precedence': 'bulk',
        },
    });
    logger.info(`Admin notification sent for new order #${orderId} to: ${getAdminRecipients()}`);
}

/**
 * Sends an immediate order confirmation receipt to the customer who placed the order.
 * @param {object} orderDetails - The details of the order.
 * @param {number} orderId - The ID of the newly created order.
 * @param {string} userEmail - Customer's verified email address.
 */
async function sendOrderConfirmationCustomerEmail(orderDetails, orderId, userEmail) {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping customer order receipt.');
        return;
    }
    if (!userEmail || userEmail === 'N/A') {
        logger.warn(`Skipping customer order receipt for #${orderId} due to missing email.`);
        return;
    }

    const { order_type, product } = orderDetails;
    const isBuy = order_type === 'buy';
    const subject = `Order Confirmation: #${orderId} - ${isBuy ? 'Purchase of' : 'Sale of'} ${product}`;
    const domain = getAppDomain();

    const summaryRows = isBuy
        ? `
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Order Type</td>
              <td style="padding:10px 0;font-size:14px;font-weight:700;color:#10b981;text-align:right;border-bottom:1px solid #f1f5f9;">BUY CRYPTO</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Cryptocurrency</td>
              <td style="padding:10px 0;font-size:14px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">${product}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Amount You Buy</td>
              <td style="padding:10px 0;font-size:14px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">${orderDetails.usd_amount} USD (${product})</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Total Paid (GHS)</td>
              <td style="padding:10px 0;font-size:16px;font-weight:800;color:#005baa;text-align:right;border-bottom:1px solid #f1f5f9;">₵${Number(orderDetails.total_paid_ghs).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Receiving Wallet</td>
              <td style="padding:10px 0;font-size:12px;font-family:monospace;color:#334155;text-align:right;word-break:break-all;border-bottom:1px solid #f1f5f9;">${orderDetails.wallet_address}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;">Payment TX / Ref</td>
              <td style="padding:10px 0;font-size:12px;font-family:monospace;color:#334155;text-align:right;word-break:break-all;">${orderDetails.user_transaction_id}</td>
            </tr>`
        : `
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Order Type</td>
              <td style="padding:10px 0;font-size:14px;font-weight:700;color:#f59e0b;text-align:right;border-bottom:1px solid #f1f5f9;">SELL CRYPTO</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Cryptocurrency Sold</td>
              <td style="padding:10px 0;font-size:14px;font-weight:600;color:#0f172a;text-align:right;border-bottom:1px solid #f1f5f9;">${orderDetails.product_amount} ${product}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">GHS Payout to You</td>
              <td style="padding:10px 0;font-size:16px;font-weight:800;color:#005baa;text-align:right;border-bottom:1px solid #f1f5f9;">₵${Number(orderDetails.ghs_to_receive).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;border-bottom:1px solid #f1f5f9;">Crypto TX Hash</td>
              <td style="padding:10px 0;font-size:12px;font-family:monospace;color:#334155;text-align:right;word-break:break-all;border-bottom:1px solid #f1f5f9;">${orderDetails.user_transaction_id}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#64748b;">Payout Destination</td>
              <td style="padding:10px 0;font-size:13px;color:#0f172a;text-align:right;">${orderDetails.payout_info && orderDetails.payout_info.method === 'momo' ? `MoMo: ${orderDetails.payout_info.number} (${orderDetails.payout_info.name})` : 'Bank Transfer'}</td>
            </tr>`;

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#161b22;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;max-width:560px;width:100%;box-shadow:0 12px 36px rgba(0,0,0,0.5);">
        <!-- Sovereign Header -->
        <tr>
          <td style="background:linear-gradient(135deg, #005baa 0%, #004a8a 100%);padding:28px 32px;border-bottom:2px solid #00a9e0;">
            <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${SENDER_NAME}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#b3d4f0;font-weight:500;">Institutional Crypto Settlement Service</p>
          </td>
        </tr>
        <!-- Main Content -->
        <tr>
          <td style="padding:32px;color:#f0f6fc;">
            <div style="display:inline-block;padding:4px 12px;background:rgba(0,169,224,0.15);border:1px solid rgba(0,169,224,0.3);border-radius:999px;font-size:12px;font-weight:700;color:#00a9e0;margin-bottom:16px;">
              ORDER #${orderId} RECEIVED
            </div>
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#ffffff;">Trade Initiated Successfully</h2>
            <p style="margin:0 0 24px;font-size:14px;color:#8b949e;line-height:1.6;">
              Thank you for trading with CryptoPlexTrade. Your order <strong>#${orderId}</strong> has been logged in our secure settlement queue and is awaiting blockchain / payment confirmation.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1117;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:16px 20px;margin-bottom:24px;">
              ${summaryRows}
            </table>

            <div style="background:rgba(56,189,248,0.08);border-left:3px solid #00a9e0;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#bae6fd;line-height:1.5;">
                <strong>Next Step:</strong> Our automated settlement system and compliance operators will verify the transaction hash. Once confirmed, your settlement will complete immediately.
              </p>
            </div>

            <p style="margin:0;font-size:12px;color:#8b949e;line-height:1.5;">
              Security notice: CryptoPlexTrade personnel will never ask for your password, 2FA code, or wallet recovery seed phrases.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0d1117;border-top:1px solid rgba(255,255,255,0.08);padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#8b949e;">&copy; 2026 CryptoPlexTrade. Licensed & Secure Digital Asset Exchange.</p>
            <p style="margin:4px 0 0;font-size:11px;color:#8b949e;">Need support? Contact us at <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#00a9e0;text-decoration:none;">${process.env.ADMIN_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const textBody = `CryptoPlexTrade - Order #${orderId} Received\r\n\r\nYour ${order_type.toUpperCase()} order has been initiated successfully.\r\nOrder ID: #${orderId}\r\nProduct: ${product}\r\nStatus: Pending Confirmation\r\n\r\nOur settlement team is processing your order. You can track this in your dashboard.\r\nSupport: ${process.env.ADMIN_EMAIL}`;

    await transporter.sendMail({
        from: getSender(),
        replyTo: getReplyTo(),
        to: userEmail,
        subject,
        text: textBody,
        html: htmlBody,
        headers: {
            'Message-ID': `<${Date.now()}.receipt-${orderId}@${domain}>`,
            'Precedence': 'bulk',
        },
    });
    logger.info(`Customer order receipt sent to ${userEmail} for order #${orderId}`);
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
        to:        getAdminRecipients(),
        subject,
        text:      textBody,
        html:      htmlBody,
        headers: {
            'Message-ID': `<${Date.now()}.chat-${sessionId}@${domain}>`,
            'Precedence': 'bulk',
        },
    });
    logger.info(`Admin notification sent for new chat session #${sessionId} to ${getAdminRecipients()}`);
}

/**
 * Sends an urgent email notification to the admin when a user requests to speak with a human live agent.
 * @param {string} guestName - The name of the guest requesting an agent.
 * @param {number} sessionId - The ID of the chat session.
 * @param {string} lastMessage - The user's query or last message.
 */
async function sendAgentRequestNotification(guestName, sessionId, lastMessage = '') {
    if (!transporter) {
        logger.warn('Email service is not configured. Skipping agent request notification.');
        return;
    }

    const subject = `🚨 URGENT: Live Agent Requested by ${guestName} (Session #${sessionId})`;
    const domain = getAppDomain();
    const adminUrl = `${process.env.APP_URL || 'https://' + domain}/admin/livechat.html?session=${sessionId}`;

    const textBody = `🚨 LIVE AGENT REQUESTED!\r\n\r\n` +
                     `Guest Name: ${guestName}\r\n` +
                     `Session ID: #${sessionId}\r\n` +
                     `User Message/Query: ${lastMessage || 'User requested to speak with a human support agent'}\r\n\r\n` +
                     `Join this conversation now in the admin panel: ${adminUrl}`;

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b1329;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b1329;padding:32px 16px;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#0f1d3a;border:1px solid #00a9e0;border-radius:12px;overflow:hidden;max-width:580px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <!-- Alert Header -->
        <tr>
          <td style="background:linear-gradient(135deg, #e11d48, #be123c);padding:24px 32px;">
            <p style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;">🚨 Live Agent Requested</p>
            <p style="margin:4px 0 0;font-size:13px;color:#fecdd3;">A customer is actively waiting for human assistance right now.</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#172545;border-radius:8px;padding:16px;margin-bottom:24px;">
              <tr>
                <td style="padding:6px 0;color:#94a3b8;font-size:14px;width:120px;"><strong>Guest Name:</strong></td>
                <td style="padding:6px 0;color:#ffffff;font-size:15px;font-weight:bold;">${guestName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#94a3b8;font-size:14px;"><strong>Session ID:</strong></td>
                <td style="padding:6px 0;color:#38bdf8;font-size:15px;font-weight:bold;">#${sessionId}</td>
              </tr>
              ${lastMessage ? `
              <tr>
                <td style="padding:6px 0;color:#94a3b8;font-size:14px;vertical-align:top;"><strong>Last Message:</strong></td>
                <td style="padding:6px 0;color:#cbd5e1;font-size:14px;line-height:1.5;">${lastMessage}</td>
              </tr>` : ''}
            </table>

            <!-- Button -->
            <table cellpadding="0" cellspacing="0" style="margin:24px 0 16px;">
              <tr>
                <td style="background:#00a9e0;border-radius:8px;">
                  <a href="${adminUrl}" style="display:inline-block;padding:16px 36px;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;">⚡ Reply to Customer Now</a>
                </td>
              </tr>
            </table>

            <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">Click the button above to open the Live Chat management dashboard and begin messaging the client.</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#091224;border-top:1px solid #1e293b;padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#64748b;">${SENDER_NAME} Priority Escalation System</p>
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
        to:        getAdminRecipients(),
        subject,
        text:      textBody,
        html:      htmlBody,
        priority:  'high',
        headers: {
            'Message-ID': `<${Date.now()}.agentreq-${sessionId}@${domain}>`,
            'X-Priority': '1',
            'Importance': 'High',
            'Precedence': 'urgent',
        },
    });
    logger.info(`Live agent request notification sent for chat session #${sessionId} to ${getAdminRecipients()}`);
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
    const appUrl = process.env.APP_URL || 'https://cryptoplextrade.com';
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
<body style="margin:0;padding:0;background-color:#0f172a;font-family:'Inter', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-width:600px;width:100%;border:1px solid #334155;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg, #005baa, #00a9e0);padding:40px 32px;text-align:center;">
            <div style="margin-bottom:16px;">
              <img src="${appUrl}/css/logo.png" alt="CryptoPlexTrade Logo" style="height:56px;width:auto;border-radius:12px;background:#ffffff;padding:5px;box-shadow:0 4px 12px rgba(0,0,0,0.2);">
            </div>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.2);">Transaction Completed</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#f8fafc;font-weight:500;">Dear Valued Customer,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#cbd5e1;line-height:1.7;">Great news! Your <strong>${orderType.toLowerCase()}</strong> order has been <strong style="color:#4ade80;">successfully completed</strong>.</p>

            <!-- Success Badge -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
              <tr>
                <td style="background:rgba(74, 222, 128, 0.1);border:1px solid rgba(74, 222, 128, 0.2);border-radius:12px;padding:24px;text-align:center;">
                  <div style="background:#22c55e;color:#fff;width:48px;height:48px;line-height:48px;border-radius:50%;font-size:24px;margin:0 auto 12px;box-shadow:0 4px 12px rgba(34, 197, 94, 0.3);">✓</div>
                  <h2 style="margin:0;font-size:20px;font-weight:700;color:#4ade80;letter-spacing:0.5px;">Payment Processed</h2>
                </td>
              </tr>
            </table>

            <!-- Order Details -->
            <div style="background:#0f172a;border-radius:12px;padding:24px;border:1px solid #334155;">
              <h3 style="margin:0 0 16px;font-size:14px;text-transform:uppercase;color:#94a3b8;letter-spacing:1px;border-bottom:1px solid #334155;padding-bottom:12px;">Order Summary</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#94a3b8;">Order ID</td>
                  <td style="padding:8px 0;font-size:15px;color:#f8fafc;font-weight:600;text-align:right;">#${orderId}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#94a3b8;">Type</td>
                  <td style="padding:8px 0;font-size:15px;color:#f8fafc;font-weight:600;text-align:right;">${orderType}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:#94a3b8;">Product</td>
                  <td style="padding:8px 0;font-size:15px;color:#f8fafc;font-weight:600;text-align:right;">${product}</td>
                </tr>
                <tr>
                  <td style="padding:16px 0 0;font-size:14px;color:#94a3b8;border-top:1px dashed #334155;margin-top:8px;">Amount (GHS)</td>
                  <td style="padding:16px 0 0;font-size:18px;color:#38bdf8;font-weight:700;text-align:right;border-top:1px dashed #334155;margin-top:8px;">₵${totalPaid}</td>
                </tr>
              </table>
            </div>

            <p style="margin:32px 0 8px;font-size:14px;color:#cbd5e1;line-height:1.7;text-align:center;">If you have any questions about this transaction, our support team is always here to help.</p>
            <p style="margin:16px 0 0;font-size:15px;color:#f8fafc;font-weight:600;text-align:center;">Thank you for choosing CryptoPlexTrade! 🚀</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#0f172a;border-top:1px solid #334155;padding:24px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#64748b;">${SENDER_NAME} &middot; <a href="mailto:${process.env.ADMIN_EMAIL}" style="color:#38bdf8;text-decoration:none;">${process.env.ADMIN_EMAIL}</a></p>
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

module.exports = {
    normalizeEmailList,
    buildAdminRecipientList,
    getAdminRecipients,
    sendNewOrderNotification,
    sendOrderConfirmationCustomerEmail,
    sendPasswordResetEmail,
    sendLiveChatNotification,
    sendAgentRequestNotification,
    sendOrderCompletedEmail
};