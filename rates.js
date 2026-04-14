const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const ratesFilePath = path.join(__dirname, 'rates.json');

let ratesCache = {
    BTC: {
        buy: 13.05, 
        sell: 12.95,
        minerFees: [
            { name: 'Priority', value: 3.50 },
            { name: 'Standard', value: 2.50 },
            { name: 'Economy', value: 1.50 }
        ]
    },
    ETH: {
        buy: 10.05,
        sell: 9.95,
        minerFees: [
            { name: 'Priority', value: 5.00 },
            { name: 'Standard', value: 4.50 },
            { name: 'Economy', value: 3.00 }
        ]
    },
    USDT_TRC20: {
        buy: 12.05,
        sell: 11.95,
        minerFees: [
            { name: 'Priority', value: 2.00 },
            { name: 'Standard', value: 1.00 },
            { name: 'Economy', value: 0.50 }
        ]
    },
    USDT_ERC20: {
        buy: 12.05,
        sell: 11.95,
        minerFees: [
            { name: 'Priority', value: 6.00 },
            { name: 'Standard', value: 5.00 },
            { name: 'Economy', value: 4.00 }
        ]
    }
};

// Load rates from file on startup
(async () => {
    try {
        const data = await fs.readFile(ratesFilePath, 'utf8');
        ratesCache = JSON.parse(data);
        // Simple migration for old structure
        if (ratesCache.btcToGhs) {
            logger.warn('Old rates structure detected. Migrating to new buy/sell structure.');
            const oldBtcRate = ratesCache.btcToGhs;
            const oldEthRate = ratesCache.ethToGhs || oldBtcRate; // Fallback
            ratesCache = {
                BTC: { buy: oldBtcRate + 0.02, sell: oldBtcRate - 0.02 },
                ETH: { buy: oldEthRate + 0.02, sell: oldEthRate - 0.02 },
                minerFees: ratesCache.minerFees
            };
            await setRates(ratesCache); // Save the new structure
        }
        logger.info('Rates loaded from rates.json');
    } catch (error) {
        logger.warn('rates.json not found or invalid. Using default in-memory rates.');
        try {
            await fs.writeFile(ratesFilePath, JSON.stringify(ratesCache, null, 2));
        } catch (writeErr) {
            logger.warn('Could not write rates.json (read-only filesystem). Using in-memory defaults.');
        }
    }
})();

const getRates = () => ratesCache;

const setRates = async (newRates) => {
    ratesCache = newRates;
    try {
        await fs.writeFile(ratesFilePath, JSON.stringify(ratesCache, null, 2));
        logger.info('Rates have been updated and saved to rates.json');
    } catch (err) {
        logger.warn('Could not persist rates to file (read-only filesystem). Rates updated in memory only.');
    }
};

module.exports = { getRates, setRates };