const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
        await page.goto('http://localhost:5008/index.html', { waitUntil: 'load' });
        // wait 2 seconds for loader animation
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: 'loader_screenshot.png' });
        await browser.close();
        console.log("Screenshot saved at loader_screenshot.png");
    } catch (e) { console.error(e); }
})();
