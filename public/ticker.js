/**
 * ticker.js
 * ─────────────────────────────────────────────────────────────
 * Real-time continuous market ticker tape for CryptoPlexTrade.
 * Connects to /api/market-rates with multi-tier failover.
 * ─────────────────────────────────────────────────────────────
 */
document.addEventListener('DOMContentLoaded', function() {
    const tickerTrack = document.querySelector('.ticker-tape__track') || document.getElementById('ticker-track');
    if (!tickerTrack) return;

    const coinSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'LTC', 'ADA', 'DOGE', 'USDT'];
    let lastPrices = {};

    // Standard baseline fallback if everything is unreachable
    const FALLBACK_PRICES = {
        BTC: { price: 76850.50, change: -1.55 },
        ETH: { price: 2254.20, change: -0.62 },
        SOL: { price: 91.85, change: -2.45 },
        BNB: { price: 698.50, change: -1.48 },
        XRP: { price: 1.25, change: 0.12 },
        LTC: { price: 53.75, change: -3.20 },
        ADA: { price: 0.188, change: -1.95 },
        DOGE: { price: 0.074, change: -1.45 },
        USDT: { price: 1.00, change: 0.01 }
    };

    function renderTickerFromData(data) {
        let itemsHTML = '';
        coinSymbols.forEach(symbol => {
            let price = 0;
            let change = 0;

            if (data && data.RAW && data.RAW[symbol] && data.RAW[symbol].USD) {
                price = data.RAW[symbol].USD.PRICE;
                change = data.RAW[symbol].USD.CHANGEPCT24HOUR || 0;
            } else if (FALLBACK_PRICES[symbol]) {
                price = FALLBACK_PRICES[symbol].price;
                change = FALLBACK_PRICES[symbol].change;
            } else {
                return;
            }

            const dir = change >= 0 ? 'up' : 'down';
            const sign = dir === 'up' ? '+' : '';
            const arrow = dir === 'up' ? '▲' : '▼';
            const pair = `${symbol}/USD`;
            const formattedPrice = price < 1 
                ? `$${price.toFixed(4)}` 
                : price < 10 
                ? `$${price.toFixed(3)}` 
                : `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            itemsHTML += `
                <div class="ticker-tape__item" data-pair="${symbol}">
                    <span class="pair">${pair}</span>
                    <span class="price">${formattedPrice}</span>
                    <span class="change ${dir}">${sign}${change.toFixed(2)}% ${arrow}</span>
                </div>
            `;

            lastPrices[symbol] = price;
        });

        // Duplicate 3 times to ensure infinite smooth marquee loop without blank seams
        tickerTrack.innerHTML = itemsHTML + itemsHTML + itemsHTML;
    }

    // Immediately render fallback so user sees ticker instantly with zero latency
    renderTickerFromData(null);

    async function fetchLiveRates() {
        try {
            // Priority 1: High-speed server-cached market feed
            const res = await fetch('/api/market-rates');
            if (res.ok) {
                const data = await res.json();
                if (data && data.RAW) {
                    renderTickerFromData(data);
                    return;
                }
            }
            throw new Error('Local API rates unavailable, trying Binance');
        } catch (e1) {
            try {
                // Priority 2: Direct public Binance ticker
                const symbolsParam = encodeURIComponent('["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","LTCUSDT","ADAUSDT","DOGEUSDT"]');
                const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`);
                if (bRes.ok) {
                    const bData = await bRes.json();
                    const raw = {};
                    bData.forEach(item => {
                        const s = item.symbol.replace('USDT', '');
                        raw[s] = {
                            USD: {
                                PRICE: parseFloat(item.lastPrice),
                                CHANGEPCT24HOUR: parseFloat(item.priceChangePercent)
                            }
                        };
                    });
                    raw['USDT'] = { USD: { PRICE: 1.00, CHANGEPCT24HOUR: 0.01 } };
                    renderTickerFromData({ RAW: raw });
                    return;
                }
            } catch (e2) {
                console.warn('Ticker external fetch fallback activated');
            }
        }
    }

    fetchLiveRates();
    setInterval(fetchLiveRates, 15000);
});
