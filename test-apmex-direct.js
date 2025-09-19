import { chromium } from 'playwright';

const EXCHANGE_RATES = {
  USD: 150
};

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
    console.log('URL:', url);

    // 異なるwaitUntilオプションを試す
    const strategies = [
      { waitUntil: 'domcontentloaded', name: 'DOM loaded' },
      { waitUntil: 'load', name: 'Page loaded' },
      { waitUntil: 'networkidle', name: 'Network idle' }
    ];

    for (const strategy of strategies) {
      console.log(`\nTrying strategy: ${strategy.name}...`);
      
      try {
        const start = Date.now();
        await page.goto(url, {
          waitUntil: strategy.waitUntil,
          timeout: 15000
        });
        const elapsed = Date.now() - start;
        console.log(`✅ Success with ${strategy.name} (${elapsed}ms)`);
        break;
      } catch (e) {
        console.log(`❌ Failed with ${strategy.name}: ${e.message}`);
        if (strategy === strategies[strategies.length - 1]) {
          throw e;
        }
      }
    }

    console.log('\nWaiting for price elements...');
    await page.waitForTimeout(8000);

    // スクリーンショットを保存
    await page.screenshot({ path: 'apmex-page.png', fullPage: false });
    console.log('Screenshot saved as apmex-page.png');

    // 価格を抽出
    console.log('\nExtracting price...');

    // 方法1: メタタグ
    try {
      const metaPrice = await page.$eval(
        'meta[property="product:price:amount"]',
        el => el.getAttribute('content')
      );
      if (metaPrice) {
        const usd = parseFloat(metaPrice);
        const jpy = Math.round(usd * EXCHANGE_RATES.USD);
        console.log(`Meta tag price: $${usd} = ¥${jpy}`);
      }
    } catch (e) {
      console.log('Meta tag not found');
    }

    // 方法2: data-product-price属性
    try {
      const dataPrice = await page.$eval(
        '[data-product-price]',
        el => el.getAttribute('data-product-price')
      );
      if (dataPrice) {
        const usd = parseFloat(dataPrice);
        const jpy = Math.round(usd * EXCHANGE_RATES.USD);
        console.log(`Data attribute price: $${usd} = ¥${jpy}`);
      }
    } catch (e) {
      console.log('Data attribute not found');
    }

    // 方法3: テキストから直接抽出
    const jsPrice = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const usdPattern = /\$([\d,]+\.\d{2})/g;
      const matches = [...bodyText.matchAll(usdPattern)];
      
      for (const match of matches) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (price > 1000 && price < 3000) { // 1/2オンス金貨の適正範囲
          return price;
        }
      }
      return null;
    });

    if (jsPrice) {
      const jpy = Math.round(jsPrice * EXCHANGE_RATES.USD);
      console.log(`JavaScript extracted: $${jsPrice} = ¥${jpy}`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }
}

testAPMEX().catch(console.error);