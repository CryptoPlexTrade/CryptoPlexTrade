const fs = require('fs');

// Process rates.html
let ratesHTML = fs.readFileSync('public/rates.html', 'utf8');
ratesHTML = ratesHTML.replace(/<main class="hero">[\s\S]*?<\/main>/, '');
ratesHTML = ratesHTML.replace(/<section class="how-it-works">[\s\S]*?<\/section>/, '');
ratesHTML = ratesHTML.replace(/<section class="why-us" id="why-us">[\s\S]*?<\/section>/, '');
ratesHTML = ratesHTML.replace(/<section class="cta-section">[\s\S]*?<\/section>/, '');
// For layout, we might need a margin on top since hero is gone
ratesHTML = ratesHTML.replace(/<section class="live-rates"/, '<section class="live-rates" style="padding-top: 120px; min-height: 70vh;"');
ratesHTML = ratesHTML.replace(/<title>.*?<\/title>/, '<title>Live Rates - CryptoPlexTrade</title>');
fs.writeFileSync('public/rates.html', ratesHTML);

// Process why-us.html
let whyusHTML = fs.readFileSync('public/why-us.html', 'utf8');
whyusHTML = whyusHTML.replace(/<main class="hero">[\s\S]*?<\/main>/, '');
whyusHTML = whyusHTML.replace(/<section class="how-it-works">[\s\S]*?<\/section>/, '');
whyusHTML = whyusHTML.replace(/<section class="live-rates".*?>[\s\S]*?<\/section>/, '');
// Add padding top
whyusHTML = whyusHTML.replace(/<section class="why-us"/, '<section class="why-us" style="padding-top: 120px;"');
whyusHTML = whyusHTML.replace(/<title>.*?<\/title>/, '<title>Features - CryptoPlexTrade</title>');
fs.writeFileSync('public/why-us.html', whyusHTML);

console.log("Pages fixed!");
