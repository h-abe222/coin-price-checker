import { chromium } from 'playwright';

const EXCHANGE_RATES = {
  USD: 150,
  HKD: 19,
  SGD: 110
};

async function testAllSites() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];

  // Test BullionStar
  try {
    console.log('\n=== Testing BullionStar ==="');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();
    
    await page.goto('https://www.bullionstar.com/buy/product/gold-coin-canadian-maple-half-oz-2025', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(5000);

    const price = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const yenPattern = /¥([\d,]+(?:\.\d{2})?)/g;
      const matches = [...bodyText.matchAll(yenPattern)];
      
      for (const match of matches) {
        const p = parseFloat(match[1].replace(/,/g, ''));
        if (p > 200000 && p < 400000) return p;
      }
      return null;
    });

    if (price) {
      console.log(`BullionStar: ✅ ¥${Math.round(price)}`);
      results.push({ site: 'BullionStar', success: true, price: Math.round(price) });
    } else {
      console.log('BullionStar: ❌ Failed');
      results.push({ site: 'BullionStar', success: false });
    }
    await context.close();
  } catch (e) {
    console.log(`BullionStar: ❌ Error - ${e.message}`);
    results.push({ site: 'BullionStar', success: false, error: e.message });
  }

  // Test APMEX
  try {
    console.log('\n=== Testing APMEX ==="');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();
    
    await page.goto('https://www.apmex.com/product/304146/2025-canada-1-2-oz-gold-maple-leaf-bu', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(2000);

    let price = null;
    const selectors = [
      '[data-product-price]',
      '.product-price',
      '[itemprop="price"]',
      '.price-value',
      'meta[property="product:price:amount"]'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.count() > 0) {
          let priceText;
          if (selector.startsWith('meta')) {
            priceText = await element.getAttribute('content');
          } else {
            priceText = await element.getAttribute('data-product-price') ||
                       await element.textContent();
          }
          if (priceText) {
            const usdPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));
            if (usdPrice > 500 && usdPrice < 5000) {
              price = Math.round(usdPrice * EXCHANGE_RATES.USD);
              break;
            }
          }
        }
      } catch (e) {}
    }

    if (price) {
      console.log(`APMEX: ✅ ¥${price}`);
      results.push({ site: 'APMEX', success: true, price });
    } else {
      console.log('APMEX: ❌ Failed');
      results.push({ site: 'APMEX', success: false });
    }
    await context.close();
  } catch (e) {
    console.log(`APMEX: ❌ Error - ${e.message}`);
    results.push({ site: 'APMEX', success: false, error: e.message });
  }

  // Test YBX
  try {
    console.log('\n=== Testing YBX ==="');
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();
    
    await page.goto('https://www.ybx.jp/view.php?id=M-18', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.waitForTimeout(3000);

    const price = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const yenPattern = /([\d,]+)円/g;
      const matches = [...bodyText.matchAll(yenPattern)];
      
      for (const match of matches) {
        const p = parseInt(match[1].replace(/,/g, ''));
        if (p > 100000 && p < 1000000) return p;
      }
      return null;
    });

    if (price) {
      console.log(`YBX: ✅ ¥${price}`);
      results.push({ site: 'YBX', success: true, price });
    } else {
      console.log('YBX: ❌ Failed');
      results.push({ site: 'YBX', success: false });
    }
    await context.close();
  } catch (e) {
    console.log(`YBX: ❌ Error - ${e.message}`);
    results.push({ site: 'YBX', success: false, error: e.message });
  }

  await browser.close();

  console.log('\n=== 結果まとめ ==="');
  results.forEach(r => {
    if (r.success) {
      console.log(`${r.site}: ¥${r.price}`);
    } else {
      console.log(`${r.site}: 取得失敗 ${r.error || ''}`);
    }
  });
}

testAllSites().catch(console.error);