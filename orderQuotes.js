function calculateSellPayout(cryptoAmount, spotPriceUsd, platformSellRate) {
    const amount = Number(cryptoAmount);
    const spotPrice = Number(spotPriceUsd);
    const conversionRate = Number(platformSellRate);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new TypeError('Crypto amount must be a positive number.');
    }
    if (!Number.isFinite(spotPrice) || spotPrice <= 0) {
        throw new TypeError('Market spot price must be a positive number.');
    }
    if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
        throw new TypeError('Platform sell rate must be a positive number.');
    }

    const usdAmount = amount * spotPrice;
    return {
        usdAmount,
        ghsToReceive: usdAmount * conversionRate
    };
}

module.exports = { calculateSellPayout };