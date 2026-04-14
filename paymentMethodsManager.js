/**
 * paymentMethodsManager.js
 * Shared module for payment methods data.
 * Both adminRoutes.js and server.js import from here
 * so they share the same in-memory cache.
 */
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const filePath = path.join(__dirname, 'paymentMethods.json');

const DEFAULT_DATA = {
    momoAccounts: [],
    bank: { bankName: '', accountName: '', accountNumber: '' },
    wallets: { BTC: '', ETH: '', USDT_TRC20: '', USDT_ERC20: '' },
    updatedAt: ''
};

// Single in-memory cache shared across the entire app
let cache = null;

function get() {
    if (cache) return cache;
    try {
        cache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return cache;
    } catch {
        return { ...DEFAULT_DATA };
    }
}

function save(data) {
    cache = data; // Always update in-memory (works on Vercel)
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        logger.info('Payment methods persisted to file.');
    } catch (err) {
        logger.warn('Could not persist payment methods to file (read-only fs). Using in-memory cache.');
    }
}

module.exports = { get, save };
