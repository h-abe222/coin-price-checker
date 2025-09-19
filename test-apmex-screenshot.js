import { chromium } from 'playwright';

async function testAPMEX() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();
  const url = 'https://www.apmex.com/product/304146/2025-canada-1-2-oz-gold-maple-leaf-bu';

  try {
    console.log('Opening APMEX page...');
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('Waiting 8 seconds for price to load...');
    await page.waitForTimeout(8000);

    // スクリーンショット
    await page.screenshot({ path: 'apmex-test.png', fullPage: false });
    console.log('Screenshot saved as apmex-test.png');

    // ページのテキストを取得
    const pageText = await page.evaluate(() => document.body.innerText);
    
    // USD価格パターンで検索
    const usdMatches = pageText.match(/\$[\d,]+\.\d{2}/g);
    if (usdMatches) {
      console.log('\nFound USD prices on page:');
      usdMatches.forEach(match => {
        const value = parseFloat(match.replace(/[$,]/g, ''));
        if (value > 1000 && value < 3000) {
          console.log(`  ✓ ${match} (¥${Math.round(value * 150)})`);
        } else {
          console.log(`  - ${match} (out of range)`);
        }
      });
    } else {
      console.log('No USD prices found on page');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

testAPMEX().catch(console.error);
