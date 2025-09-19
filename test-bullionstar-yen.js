import { chromium } from 'playwright';

async function testBullionStarYen() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();
  const url = 'https://www.bullionstar.com/buy/product/gold-coin-canadian-maple-half-oz-2025';

  try {
    console.log('Opening BullionStar page...');
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Waiting for price elements...');
    try {
      await page.waitForSelector('.product-price-update', { timeout: 10000 });
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('Timeout waiting for price element');
    }

    // Extract all Yen prices
    const priceText = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      console.log('Body text length:', bodyText.length);

      // Find all Yen prices
      const yenPattern = /¥([\d,]+(?:\.\d{2})?)/g;
      const matches = [...bodyText.matchAll(yenPattern)];

      const allPrices = [];
      const validPrices = [];

      for (const match of matches) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        allPrices.push({ text: match[0], value: price });
        
        // 1/2オンス金貨の妥当な価格範囲（20万〜40万円）
        if (price > 200000 && price < 400000) {
          validPrices.push(price);
        }
      }

      return {
        allPrices: allPrices.slice(0, 20), // First 20 prices
        validPrices: validPrices,
        firstValid: validPrices.length > 0 ? validPrices[0] : null
      };
    });

    console.log('\n=== Results ==="');
    console.log('All Yen prices found (first 20):', priceText.allPrices);
    console.log('\nValid prices (200k-400k range):', priceText.validPrices);
    console.log('\nSelected price:', priceText.firstValid);

    if (priceText.firstValid) {
      console.log(`\n✅ Success: BullionStar price = ¥${priceText.firstValid.toLocaleString()}`);
    } else {
      console.log('\n❌ No valid price found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testBullionStarYen().catch(console.error);