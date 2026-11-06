const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSellPayout } = require('../orderQuotes');

test('calculates a BTC sell payout from crypto units, spot USD, and GHS conversion', () => {
    const result = calculateSellPayout(0.01, 76000, 11.8);

    assert.equal(result.usdAmount, 760);
    assert.equal(result.ghsToReceive, 8968);
});

test('calculates a USDT sell payout using its USD spot reference', () => {
    const result = calculateSellPayout(125, 1, 11.8);

    assert.equal(result.usdAmount, 125);
    assert.equal(result.ghsToReceive, 1475);
});

test('rejects invalid crypto quantities and rate inputs', () => {
    assert.throws(() => calculateSellPayout(0, 76000, 11.8), /Crypto amount/);
    assert.throws(() => calculateSellPayout(0.01, 0, 11.8), /Market spot price/);
    assert.throws(() => calculateSellPayout(0.01, 76000, NaN), /Platform sell rate/);
});