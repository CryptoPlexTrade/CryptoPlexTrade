/**
 * marketRates.js
 * ─────────────────────────────────────────────────────────────
 * Resilient live crypto market feed service for CryptoPlexTrade.
 * Provides real-time spot prices and 24h percentage movements
 * with multi-tier failover (Binance -> CoinGecko -> Cached).
 * ─────────────────────────────────────────────────────────────
 */
const fetch = require('node-fetch');
const logger = require('./logger');

let cache = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds in-memory cache

// Coin metadata definitions
const ASSET_META = {
    BTC: { name: 'Bitcoin', binance: 'BTCUSDT', coingecko: 'bitcoin', category: 'layer1', defaultPrice: 76800.0, defaultChange: -1.2 },
    ETH: { name: 'Ethereum', binance: 'ETHUSDT', coingecko: 'ethereum', category: 'layer1', defaultPrice: 2250.0, defaultChange: 0.8 },
    SOL: { name: 'Solana', binance: 'SOLUSDT', coingecko: 'solana', category: 'layer1', defaultPrice: 92.5, defaultChange: -2.1 },
    BNB: { name: 'BNB', binance: 'BNBUSDT', coingecko: 'binancecoin', category: 'layer1', defaultPrice: 698.0, defaultChange: 0.5 },
    XRP: { name: 'XRP', binance: 'XRPUSDT', coingecko: 'ripple', category: 'velocity', defaultPrice: 1.25, defaultChange: 1.4 },
    LTC: { name: 'Litecoin', binance: 'LTCUSDT', coingecko: 'litecoin', category: 'velocity', defaultPrice: 54.2, defaultChange: -0.9 },
    ADA: { name: 'Cardano', binance: 'ADAUSDT', coingecko: 'cardano', category: 'layer1', defaultPrice: 0.19, defaultChange: -1.5 },
    DOGE: { name: 'Dogecoin', binance: 'DOGEUSDT', coingecko: 'dogecoin', category: 'velocity', defaultPrice: 0.074, defaultChange: 2.1 },
    USDT: { name: 'Tether USD', binance: null, coingecko: 'tether', category: 'stablecoin', defaultPrice: 1.00, defaultChange: 0.01 }
};

// Fetch from Binance public 24hr ticker
async function fetchFromBinance() {
    const symbols = Object.values(ASSET_META)
        .filter(m => m.binance)
        .map(m => `"${m.binance}"`);
    const encodedSymbols = encodeURIComponent(`[${symbols.join(',')}]`);
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodedSymbols}`;

    const res = await fetch(url, { timeout: 4000 });
    if (!res.ok) throw new Error(`Binance returned status ${res.status}`);
    const data = await res.json();

    const priceMap = {};
    for (const item of data) {
        // Find which asset corresponds to item.symbol
        const asset = Object.keys(ASSET_META).find(k => ASSET_META[k].binance === item.symbol);
        if (asset) {
            priceMap[asset] = {
                price: parseFloat(item.lastPrice),
                change24h: parseFloat(item.priceChangePercent)
            };
        }
    }
    // USDT is 1.00 pegged
    priceMap['USDT'] = { price: 1.00, change24h: 0.01 };
    return priceMap;
}

// Fallback: Fetch from CoinGecko simple price
async function fetchFromCoinGecko() {
    const ids = Object.values(ASSET_META).map(m => m.coingecko).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    const res = await fetch(url, { timeout: 4000 });
    if (!res.ok) throw new Error(`CoinGecko returned status ${res.status}`);
    const data = await res.json();

    const priceMap = {};
    for (const [symbol, meta] of Object.entries(ASSET_META)) {
        const item = data[meta.coingecko];
        if (item) {
            priceMap[symbol] = {
                price: item.usd,
                change24h: item.usd_24h_change || 0
            };
        }
    }
    return priceMap;
}

function buildResponsePayload(priceMap) {
    const raw = {};
    const list = [];

    for (const [symbol, meta] of Object.entries(ASSET_META)) {
        const pInfo = priceMap[symbol] || { price: meta.defaultPrice, change24h: meta.defaultChange };
        const price = pInfo.price;
        const change = pInfo.change24h;

        // CryptoCompare compatibility structure
        raw[symbol] = {
            USD: {
                PRICE: price,
                CHANGEPCT24HOUR: change,
                FROMSYMBOL: symbol,
                TOSYMBOL: 'USD',
                IMAGEURL: `/images/coins/${symbol.toLowerCase()}.svg`,
                NAME: meta.name
            }
        };

        list.push({
            symbol,
            name: meta.name,
            category: meta.category,
            price,
            change24h: change,
            imageUrl: `/images/coins/${symbol.toLowerCase()}.svg`
        });
    }

    return {
        success: true,
        timestamp: Date.now(),
        RAW: raw,
        list
    };
}

async function getLiveMarketRates() {
    const now = Date.now();
    if (cache && (now - lastFetchTime) < CACHE_TTL_MS) {
        return cache;
    }

    let priceMap = null;

    // Tier 1: Binance
    try {
        priceMap = await fetchFromBinance();
    } catch (binanceErr) {
        logger.warn('Binance market rates fetch error, falling back to CoinGecko:', binanceErr.message);
        // Tier 2: CoinGecko
        try {
            priceMap = await fetchFromCoinGecko();
        } catch (cgErr) {
            logger.warn('CoinGecko market rates fetch error:', cgErr.message);
        }
    }

    if (priceMap && Object.keys(priceMap).length >= 5) {
        cache = buildResponsePayload(priceMap);
        lastFetchTime = now;
        return cache;
    }

    // Tier 3: Return existing cache if present
    if (cache) {
        return cache;
    }

    // Tier 4: Fallback defaults
    const fallbackMap = {};
    for (const [s, meta] of Object.entries(ASSET_META)) {
        fallbackMap[s] = { price: meta.defaultPrice, change24h: meta.defaultChange };
    }
    cache = buildResponsePayload(fallbackMap);
    lastFetchTime = now;
    return cache;
}

module.exports = {
    getLiveMarketRates
};
