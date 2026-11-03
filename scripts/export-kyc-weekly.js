#!/usr/bin/env node
/**
 * Standalone CLI runner for weekly KYC document export.
 * Usage: node scripts/export-kyc-weekly.js
 */
const { exportNewKYC } = require('../kycExporter');

(async () => {
    try {
        console.log('[CLI] Executing KYC Document Weekly Export...');
        const result = await exportNewKYC();
        console.log('[CLI] Export Result:', JSON.stringify(result, null, 2));
        process.exit(0);
    } catch (err) {
        console.error('[CLI] Export Failed:', err.message);
        process.exit(1);
    }
})();

