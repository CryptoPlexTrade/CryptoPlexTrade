import re

with open('public/rates.html', 'r') as f:
    rates = f.read()

rates = re.sub(r'<main class="hero">.*?</main>', '', rates, flags=re.DOTALL)
rates = re.sub(r'<section class="how-it-works">.*?</section>', '', rates, flags=re.DOTALL)
rates = re.sub(r'<section class="why-us" id="why-us">.*?</section>', '', rates, flags=re.DOTALL)
rates = re.sub(r'<section class="cta-section">.*?</section>', '', rates, flags=re.DOTALL)
rates = rates.replace('<section class="live-rates"', '<section class="live-rates" style="padding-top: 120px; min-height: 70vh;"')
rates = re.sub(r'<title>.*?</title>', '<title>Live Rates - CryptoPlexTrade</title>', rates)

with open('public/rates.html', 'w') as f:
    f.write(rates)

with open('public/why-us.html', 'r') as f:
    whyus = f.read()

whyus = re.sub(r'<main class="hero">.*?</main>', '', whyus, flags=re.DOTALL)
whyus = re.sub(r'<section class="how-it-works">.*?</section>', '', whyus, flags=re.DOTALL)
whyus = re.sub(r'<section class="live-rates".*?>.*?</section>', '', whyus, flags=re.DOTALL)
whyus = whyus.replace('<section class="why-us"', '<section class="why-us" style="padding-top: 120px;"')
whyus = re.sub(r'<title>.*?</title>', '<title>Features - CryptoPlexTrade</title>', whyus)

with open('public/why-us.html', 'w') as f:
    f.write(whyus)

print("Pages fixed successfully with Python!")
