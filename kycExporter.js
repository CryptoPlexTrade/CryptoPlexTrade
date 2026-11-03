/**
 * kycExporter.js — Automated KYC Document Exporter & Weekly Scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * • Exports newly submitted KYC documents to ADMIN_EMAIL via nodemailer
 * • Idempotent & non-duplicating: Tracks `kyc_exported_at` timestamp
 * • Zero-spam: If no new KYC documents exist, skips execution entirely
 * • Packages high-resolution ID images + manifest audit CSV & HTML report
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const db = require('./database');
const logger = require('./logger');
const nodemailer = require('nodemailer');
require('dotenv').config();

function createTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }
    return nodemailer.createTransport({
        pool: true,
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT, 10) || 465,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false }
    });
}

/**
 * Extracts raw binary Buffer and extension from a Data URI
 */
function parseDataUri(dataUri, defaultName = 'image.jpg') {
    if (!dataUri) return null;
    let base64 = dataUri;
    let ext = 'jpg';

    if (dataUri.startsWith('data:')) {
        const commaIdx = dataUri.indexOf(',');
        const header = dataUri.substring(5, commaIdx);
        base64 = dataUri.substring(commaIdx + 1);
        if (header.includes('image/png')) ext = 'png';
        else if (header.includes('image/webp')) ext = 'webp';
        else if (header.includes('application/pdf')) ext = 'pdf';
    }

    try {
        const buffer = Buffer.from(base64, 'base64');
        return { buffer, ext };
    } catch (_) {
        return null;
    }
}

/**
 * Core function to find new KYC documents and export them via email
 */
async function exportNewKYC() {
    // 1. Fetch only records that have documents and haven't been exported yet
    const [users] = await db.query(`
        SELECT id, fullname, email, phone, role, id_type, kyc_status, 
               id_front, id_back, id_selfie, created_at, updated_at
        FROM users
        WHERE (id_front IS NOT NULL AND id_front != '' 
            OR id_back IS NOT NULL AND id_back != '' 
            OR id_selfie IS NOT NULL AND id_selfie != '')
          AND kyc_exported_at IS NULL
        ORDER BY created_at ASC
    `);

    if (!users || users.length === 0) {
        logger.info('[KYC Exporter] No new unexported KYC documents found. Skipping export.');
        return {
            exported: 0,
            message: 'No new KYC documents to export. Skipped.'
        };
    }

    logger.info(`[KYC Exporter] Found ${users.length} new unexported KYC records. Preparing package...`);

    const transporter = createTransporter();
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    if (!transporter || !adminEmail) {
        throw new Error('SMTP transporter or ADMIN_EMAIL is not configured in .env');
    }

    // 2. Create a clean temporary directory for assembling the archive
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const tempDir = path.join(os.tmpdir(), `cpt-kyc-${timestampStr}-${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const userIds = [];
    let csvRows = ['User ID,Full Name,Email,Phone,ID Type,KYC Status,Submission Date'];
    let htmlTableRows = '';

    for (const u of users) {
        userIds.push(u.id);
        const cleanName = (u.fullname || 'user').replace(/[^a-zA-Z0-9_-]/g, '_');
        const userFolder = path.join(tempDir, `user_${u.id}_${cleanName}`);
        fs.mkdirSync(userFolder, { recursive: true });

        let filesSaved = [];

        // Save Front ID
        const front = parseDataUri(u.id_front);
        if (front) {
            const frontPath = path.join(userFolder, `01_front.${front.ext}`);
            fs.writeFileSync(frontPath, front.buffer);
            filesSaved.push(`01_front.${front.ext}`);
        }

        // Save Back ID
        const back = parseDataUri(u.id_back);
        if (back) {
            const backPath = path.join(userFolder, `02_back.${back.ext}`);
            fs.writeFileSync(backPath, back.buffer);
            filesSaved.push(`02_back.${back.ext}`);
        }

        // Save Selfie
        const selfie = parseDataUri(u.id_selfie);
        if (selfie) {
            const selfiePath = path.join(userFolder, `03_selfie.${selfie.ext}`);
            fs.writeFileSync(selfiePath, selfie.buffer);
            filesSaved.push(`03_selfie.${selfie.ext}`);
        }

        // CSV row
        csvRows.push(`"${u.id}","${(u.fullname||'').replace(/"/g, '""')}","${u.email}","${u.phone||''}","${u.id_type||'N/A'}","${u.kyc_status||'pending'}","${u.created_at}"`);

        // HTML row
        htmlTableRows += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px 14px;font-family:monospace;font-size:13px;">#${u.id}</td>
                <td style="padding:10px 14px;font-weight:bold;color:#0f172a;">${u.fullname}</td>
                <td style="padding:10px 14px;color:#005baa;"><a href="mailto:${u.email}">${u.email}</a></td>
                <td style="padding:10px 14px;font-family:monospace;">${u.phone || 'N/A'}</td>
                <td style="padding:10px 14px;">${u.id_type || 'Unspecified'}</td>
                <td style="padding:10px 14px;"><span style="display:inline-block;padding:3px 8px;border-radius:9999px;font-size:11px;font-weight:bold;background:#e0f2fe;color:#005baa;">${(u.kyc_status || 'pending').toUpperCase()}</span></td>
                <td style="padding:10px 14px;font-size:12px;color:#64748b;">${filesSaved.join(', ')}</td>
            </tr>
        `;
    }

    // Write manifest CSV inside the ZIP
    fs.writeFileSync(path.join(tempDir, 'manifest.csv'), csvRows.join('\r\n'), 'utf8');

    // Write manifest HTML inside the ZIP
    const manifestHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>KYC Dossier Manifest — CryptoPlexTrade</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; }
.card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 24px; max-width: 1100px; margin: 0 auto; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
h1 { font-size: 22px; color: #005baa; margin: 0 0 8px; }
table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
th { background: #f1f5f9; padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; }
</style>
</head>
<body>
<div class="card">
    <h1>CryptoPlexTrade — Compliance KYC Export</h1>
    <p style="color:#64748b;font-size:13px;margin:0 0 16px;">Export generated on: ${new Date().toUTCString()} &bull; Total Dossiers: ${users.length}</p>
    <table>
        <thead>
            <tr><th>ID</th><th>Legal Name</th><th>Email</th><th>Phone</th><th>Document Type</th><th>Status</th><th>Files</th></tr>
        </thead>
        <tbody>
            ${htmlTableRows}
        </tbody>
    </table>
</div>
</body>
</html>`;
    fs.writeFileSync(path.join(tempDir, 'manifest.html'), manifestHtml, 'utf8');

    // 3. Compress folder into ZIP archive
    const zipFilePath = path.join(os.tmpdir(), `CPT-KYC-Export-${timestampStr}.zip`);
    await new Promise((resolve, reject) => {
        execFile('/usr/bin/zip', ['-r', zipFilePath, '.'], { cwd: tempDir }, (error) => {
            if (error) reject(error);
            else resolve();
        });
    });

    const zipBuffer = fs.readFileSync(zipFilePath);

    // 4. Send email with attached ZIP
    const emailSubject = `[CryptoPlexTrade] Automated KYC Weekly Export — ${users.length} New Verified Dossier${users.length === 1 ? '' : 's'}`;
    const emailHtml = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f4f7fb;padding:30px 16px;margin:0;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #dce6f2;overflow:hidden;">
    <div style="background:#005baa;padding:24px 30px;color:#ffffff;">
      <h2 style="margin:0;font-size:20px;">CryptoPlexTrade Compliance Desk</h2>
      <p style="margin:4px 0 0;font-size:13px;color:#b4d5f4;">Weekly KYC Verification Export Automation</p>
    </div>
    <div style="padding:28px 30px;color:#1e293b;">
      <p style="font-size:15px;line-height:1.6;margin-top:0;">
        Hello Compliance Admin,
      </p>
      <p style="font-size:14px;line-height:1.6;color:#475569;">
        The automated weekly KYC export routine has packaged <strong>${users.length} new customer verification dossier${users.length === 1 ? '' : 's'}</strong> for archival and statutory compliance records.
      </p>
      <div style="background:#f8fafc;border-left:4px solid #00a9e0;padding:14px 18px;margin:20px 0;font-size:13px;color:#334155;">
        <strong>Archive Contents:</strong><br>
        &bull; <strong>${users.length}</strong> user sub-folders containing original Front ID, Back ID, and Live Selfie photos.<br>
        &bull; <code>manifest.csv</code> (Tabular spreadsheet export)<br>
        &bull; <code>manifest.html</code> (Formatted compliance audit sheet)
      </div>
      <p style="font-size:13px;color:#64748b;">
        Attached file: <strong>CPT-KYC-Export-${timestampStr}.zip</strong> (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB).
      </p>
      <p style="font-size:12px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px;">
        These records have now been marked as exported in the database. They will not be re-exported in subsequent batches.
      </p>
    </div>
  </div>
</body>
</html>`;

    await transporter.sendMail({
        from: `"CryptoPlex Compliance" <${process.env.SMTP_USER}>`,
        to: adminEmail,
        subject: emailSubject,
        html: emailHtml,
        attachments: [
            {
                filename: `CPT-KYC-Export-${timestampStr}.zip`,
                content: zipBuffer
            }
        ]
    });

    logger.info(`[KYC Exporter] Email successfully sent to ${adminEmail} with ${users.length} dossiers.`);

    // 5. Mark users as exported in database so they are NEVER re-exported
    await db.query(`UPDATE users SET kyc_exported_at = NOW() WHERE id IN (${userIds.map(() => '?').join(',')})`, userIds);

    // 6. Cleanup temporary files
    try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.unlinkSync(zipFilePath);
    } catch (_) {}

    return {
        exported: users.length,
        userIds,
        message: `Successfully exported ${users.length} new KYC dossiers via email to ${adminEmail}.`
    };
}

/**
 * Initializes weekly cron scheduler in the background
 */
function initKycWeeklyScheduler() {
    // Run once every 7 days (7 * 24 * 60 * 60 * 1000 ms)
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    // Check periodically (e.g. initial check 2 minutes after startup, then weekly)
    setTimeout(async () => {
        try {
            await exportNewKYC();
        } catch (e) {
            logger.error('[KYC Weekly Scheduler Error]:', e);
        }
    }, 120000); // 2 minutes post boot

    setInterval(async () => {
        try {
            logger.info('[KYC Weekly Scheduler] Triggering weekly KYC export routine...');
            await exportNewKYC();
        } catch (e) {
            logger.error('[KYC Weekly Scheduler Error]:', e);
        }
    }, ONE_WEEK_MS);

    logger.info('[KYC Exporter] Weekly automated background export scheduler armed.');
}

module.exports = {
    exportNewKYC,
    initKycWeeklyScheduler
};

