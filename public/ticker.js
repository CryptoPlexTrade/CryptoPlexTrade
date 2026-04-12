document.addEventListener('DOMContentLoaded', function() {
    const tickerTrack = document.querySelector('.ticker-tape__track');
    if (!tickerTrack) return;

    const coinSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'LTC', 'ADA', 'DOGE'];
    const vsCurrency = 'usd';
    let lastPrices = {};

    function updateTicker(data) {
        let itemsHTML = '';
        coinSymbols.forEach(symbol => {
            const coinData = data.RAW[symbol]?.[vsCurrency.toUpperCase()];
            if (!coinData) return;

            const price = coinData.PRICE;
            const change = coinData.CHANGEPCT24HOUR;
            const dir = change >= 0 ? 'up' : 'down';
            const sign = dir === 'up' ? '+' : '';
            const arrow = dir === 'up' ? '▲' : '▼';
            const pair = `${symbol}/USD`;

            itemsHTML += `
                <div class="ticker-tape__item" data-pair="${symbol}">
                    <span class="pair">${pair}</span>
                    <span class="price">${price.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })}</span>
                    <span class="change ${dir}">${sign}${change.toFixed(2)}% ${arrow}</span>
                </div>
            `;

            const priceEl = tickerTrack.querySelector(`[data-pair="${symbol}"] .price`);
            if (priceEl && lastPrices[symbol] && lastPrices[symbol] !== price) {
                const flashClass = price > lastPrices[symbol] ? 'flash-up' : 'flash-down';
                priceEl.classList.remove('flash-up', 'flash-down');
                void priceEl.offsetWidth;
                priceEl.classList.add(flashClass);
            }
            lastPrices[symbol] = price;
        });
        tickerTrack.innerHTML = itemsHTML + itemsHTML;
    }

    async function fetchLiveRates() {
        try {
            const apiUrl = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${coinSymbols.join(',')}&tsyms=${vsCurrency.toUpperCase()}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`CryptoCompare API error: ${response.status}`);
            const data = await response.json();
            updateTicker(data);
        } catch (error) {
            console.error("Failed to fetch ticker data:", error);
        }
    }

    fetchLiveRates();
    setInterval(fetchLiveRates, 60000);
});