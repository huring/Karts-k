const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'C:/Users/lahu/Documents/GitHub/Kartsok_screenshot.png' });
  const title = await page.title();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await browser.close();
  console.log('title:', title);
  console.log('errors:', JSON.stringify(errors));
})();
