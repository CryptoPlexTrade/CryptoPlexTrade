/**
 * aiSupport.js
 * Rule-based support assistant restricted to CryptoPlexTrade topics.
 * No external AI service is used, so answers never leave the platform's
 * published help content.
 */

'use strict';

const SUPPORT_EMAIL = 'Supportteam@cryptoplextrades.com';
const SUPPORT_PHONE = '0246556706';

const HANDOFF_HINT = `If you need anything beyond CryptoPlexTrade support, tap Contact Agent and a human agent will take over. You can also email ${SUPPORT_EMAIL} or call ${SUPPORT_PHONE} (Mon–Sat).`;

const OUT_OF_SCOPE = `I can only answer CryptoPlexTrade questions about accounts, buying and selling, payments, KYC, security and order status. ${HANDOFF_HINT}`;

const AGENT_REQUEST_RE = /\b(human|real person|live person|representative|supervisor|manager|agent)\b/i;

const INTENTS = [
    {
        id: 'agent',
        keywords: [
            ['talk to a human', 8], ['speak to a human', 8], ['real person', 8],
            ['live person', 8], ['human agent', 8], ['contact agent', 8],
            ['speak to someone', 6], ['talk to someone', 6], ['customer service', 4]
        ],
        answer: null
    },
    {
        id: 'wrong_address',
        keywords: [
            ['wrong address', 8], ['wrong wallet', 8], ['incorrect address', 8],
            ['incorrect wallet', 8], ['sent to the wrong', 8], ['wrong network', 6],
            ['mistake', 3]
        ],
        answer: `Blockchain transfers are irreversible once broadcast, so always verify the address and network before sending. If your order has not been processed yet, tap Contact Agent immediately with your Order ID so the desk can try to hold the transfer.`
    },
    {
        id: 'buy',
        keywords: [
            ['how do i buy', 8], ['how to buy', 8], ['buy crypto', 5], ['buy bitcoin', 5],
            ['buy btc', 5], ['buy eth', 5], ['buy usdt', 5], ['buying', 4], ['buy', 3],
            ['purchase', 3], ['top up', 2]
        ],
        answer: `Here is how to buy crypto on CryptoPlexTrade:
1. Open Trade and choose the asset and network (BTC, ETH, USDT TRC-20 or USDT ERC-20).
2. Enter the USD amount or the GHS amount and review the conversion and network fee.
3. Enter and verify your destination wallet address.
4. Continue to the order instructions and pay using the method shown on that page.
5. Submit the payment reference, then follow the order status in History.
Use only the payment details shown inside your own order flow.`
    },
    {
        id: 'sell',
        keywords: [
            ['how do i sell', 8], ['how to sell', 8], ['sell crypto', 5], ['sell bitcoin', 5],
            ['sell btc', 5], ['sell usdt', 5], ['cash out', 5], ['selling', 4], ['sell', 3],
            ['withdraw', 3], ['payout', 3]
        ],
        answer: `Here is how to sell crypto for Ghana Cedis:
1. Open Trade, choose the asset and network, then enter the crypto quantity.
2. Review the estimated GHS payout shown for your order.
3. Send the quoted crypto amount to the deposit address in the order summary.
4. Submit the transaction hash (TXID) and your payout details (Mobile Money or bank).
5. Follow the recorded status in History.
Only send crypto to the deposit address shown inside your own order.`
    },
    {
        id: 'kyc',
        keywords: [
            ['ghana card', 8], ['tier 1', 8], ['kyc', 6], ['verify my account', 6],
            ['verification', 4], ['verify', 3], ['document', 3], ['passport', 3],
            ['driver', 2], ['identity', 3]
        ],
        answer: `For Tier 1 verification, upload a clear photo of your Ghana Card, National Passport or Driver's License on the Profile page. Verification is typically reviewed within 2 to 6 hours. If a review is still pending after that, tap Contact Agent with your registered email.`
    },
    {
        id: 'login',
        keywords: [
            ['forgot password', 8], ['reset password', 8], ['cannot log in', 8],
            ['can not log in', 8], ['cant log in', 8], ['cannot sign in', 8],
            ['account locked', 8], ['login', 4], ['log in', 4], ['sign in', 4],
            ['password', 3], ['locked', 3]
        ],
        answer: `If you cannot sign in, open the Sign In page and choose Forgot Password. A single-use reset link is sent to your registered email address. If the link does not arrive or the account is still locked, tap Contact Agent with your registered email address.`
    },
    {
        id: 'security',
        keywords: [
            ['two factor', 8], ['two-factor', 8], ['2fa', 8], ['authenticator', 6],
            ['google authenticator', 8], ['authy', 6], ['security', 3],
            ['phishing', 5], ['scam', 5], ['hacked', 5]
        ],
        answer: `Recommended security steps: enable 2FA in Profile > Security using Google Authenticator or Authy, use a unique password, and never share your sign-in details. Always verify the cryptocurrency network and destination address before sending. Treat payment instructions from unverified messages as fraudulent.`
    },
    {
        id: 'fees',
        keywords: [
            ['what are your fees', 8], ['fees', 5], ['fee', 4], ['charges', 4],
            ['spread', 4], ['rates', 4], ['rate', 3], ['price', 3], ['hidden', 3]
        ],
        answer: `The trade form and order review show the conversion and any applicable network fee before you submit. Final order values use the active server rates at submission, so there are no hidden fees beyond the amounts displayed. Current rates are on the Rates page.`
    },
    {
        id: 'settlement',
        keywords: [
            ['how long', 8], ['settlement', 6], ['not received', 8], ['not yet received', 8],
            ['when will', 6], ['still pending', 8], ['delayed', 5], ['delay', 4],
            ['order status', 6], ['where is my order', 8], ['my order', 4],
            ['status', 3], ['pending', 3], ['stuck', 5]
        ],
        answer: `Settlement timing depends on payment processing, blockchain network confirmation and order review. Open History to see the latest recorded status for your order. If an order stays pending, tap Contact Agent and share your Order ID so the desk can check it.`
    },
    {
        id: 'payment',
        keywords: [
            ['mobile money', 8], ['momo', 6], ['mtn', 6], ['telecel', 6],
            ['vodafone cash', 6], ['at money', 6], ['bank transfer', 6],
            ['payment method', 8], ['payment methods', 8], ['payments', 4],
            ['payment', 4], ['bank', 3], ['pay', 2]
        ],
        answer: `We accept Mobile Money and bank transfer. Mobile Money: MTN MoMo, Telecel Cash and AT Money. Banks: GCB, Ecobank, Stanbic, Absa, Zenith and other major licensed Ghanaian banks. The exact payment details for your order are shown on the order instructions page. Never use payment details sent from an unverified message.`
    },
    {
        id: 'assets',
        keywords: [
            ['which coins', 8], ['supported assets', 8], ['what assets', 8],
            ['which crypto', 8], ['supported', 4], ['assets', 4], ['networks', 5],
            ['bitcoin', 3], ['btc', 3], ['ethereum', 3], ['eth', 3], ['usdt', 3],
            ['trc-20', 4], ['trc20', 4], ['erc-20', 4], ['erc20', 4]
        ],
        answer: `CryptoPlexTrade currently supports Bitcoin (BTC), Ethereum (ETH), USDT on TRC-20 and USDT on ERC-20. Always confirm you selected the correct network before sending or receiving crypto; sending on the wrong network can result in loss.`
    },
    {
        id: 'order_help',
        keywords: [
            ['cancel my order', 8], ['cancel order', 8], ['refund', 8], ['rejected', 6],
            ['failed', 5], ['cancelled', 5], ['canceled', 5], ['cancellation', 5],
            ['cancel', 4], ['problem with my order', 8], ['order is stuck', 8]
        ],
        answer: `I cannot change or cancel an order from chat. If an order is rejected, failed, cancelled or stuck, tap Contact Agent with your Order ID so the support desk can review it. If it has not been processed yet, they may be able to hold it.`
    },
    {
        id: 'contact',
        keywords: [
            ['contact support', 6], ['support email', 8], ['phone number', 8],
            ['hotline', 8], ['opening hours', 8], ['trading hours', 8],
            ['email', 4], ['contact', 4], ['support', 3]
        ],
        answer: `You can reach the CryptoPlexTrade support desk at ${SUPPORT_EMAIL} or ${SUPPORT_PHONE} during trading desk hours (Mon–Sat). You can also tap Contact Agent for a live human agent, or open a formal ticket under Support.`
    },
    {
        id: 'greeting',
        keywords: [
            ['good morning', 4], ['good afternoon', 4], ['good evening', 4],
            ['hello', 2], ['hey', 2], ['hi', 2]
        ],
        answer: `Hi! I am the CryptoPlex AI assistant. I can help with buying, selling, payments, KYC, security and order status. What do you need help with?`
    },
    {
        id: 'thanks',
        keywords: [
            ['thank you', 4], ['thanks', 3], ['okay', 2], ['ok', 2], ['great', 2], ['perfect', 2]
        ],
        answer: `You're welcome. If you need anything else about CryptoPlexTrade, just ask. For a human agent, tap Contact Agent at any time.`
    }
];

function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^a-z0-9@.\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function containsPhrase(text, phrase) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(text);
}

function isAgentRequest(text) {
    return AGENT_REQUEST_RE.test(normalize(text));
}

function scoreIntent(text, intent) {
    return intent.keywords.reduce((score, [phrase, weight]) => (
        containsPhrase(text, phrase) ? score + weight : score
    ), 0);
}

/**
 * Generate an answer grounded in CryptoPlexTrade help content.
 * @returns {{ answer: string, intent: string, handoff: boolean }}
 */
function generateReply(rawText) {
    const text = normalize(rawText);
    if (!text) {
        return { answer: OUT_OF_SCOPE, intent: 'empty', handoff: true };
    }

    let best = null;
    let bestScore = 0;
    for (const intent of INTENTS) {
        const score = scoreIntent(text, intent);
        if (score > bestScore) {
            best = intent;
            bestScore = score;
        }
    }

    if (!best) {
        return { answer: OUT_OF_SCOPE, intent: 'out_of_scope', handoff: true };
    }

    if (best.id === 'agent') {
        return { answer: null, intent: 'agent', handoff: true };
    }

    return { answer: best.answer, intent: best.id, handoff: false };
}

module.exports = {
    generateReply,
    isAgentRequest,
    OUT_OF_SCOPE,
    HANDOFF_HINT
};
