// テスト用スクリプト - 価格抽出のデバッグ
import fetch from 'node-fetch';

const EXCHANGE_RATES = {
  USD: 150,
  HKD: 19,
  SGD: 110,
  EUR: 160,
  GBP: 190
};

async function testPriceExtraction(url, siteName) {
  console.log(`\n=== Testing ${siteName} ===`);
  console.log(`URL: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8'
      }
    });

    const html = await response.text();
    console.log(`HTML Length: ${html.length}`);

    let price = null;

    if (url.includes('apmex.com')) {
      // APMEXの価格を探す
      console.log('\n--- APMEX Price Search ---');

      // 1. data-product-price
      const dataPriceMatch = html.match(/data-product-price="([\d.]+)"/);
      if (dataPriceMatch) {
        console.log(`data-product-price: $${dataPriceMatch[1]}`);
      }

      // 2. itemprop="price"
      const itemPropMatch = html.match(/itemprop="price"[^>]*content="([\d.]+)"/);
      if (itemPropMatch) {
        console.log(`itemprop price: $${itemPropMatch[1]}`);
      }

      // 3. class="price"
      const classPriceMatch = html.match(/class="[^"]*price[^"]*"[^>]*>\s*\$\s*([\d,]+\.?\d*)/);
      if (classPriceMatch) {
        console.log(`class price: $${classPriceMatch[1]}`);
      }

      // 4. JSON内の価格
      const jsonMatch = html.match(/"price":\s*"?([\d.]+)"?/);
      if (jsonMatch) {
        console.log(`JSON price: $${jsonMatch[1]}`);
      }

      // 5. すべての$価格
      const allPrices = html.match(/\$\s*([\d,]+\.?\d*)/g);
      if (allPrices) {
        console.log(`All $ prices found: ${allPrices.slice(0, 10).join(', ')}`);
      }
    }

    if (url.includes('bullionstar.com')) {
      // BullionStarの価格を探す
      console.log('\n--- BullionStar Price Search ---');

      // 1. SGD価格
      const sgdMatches = html.match(/SGD\s*([\d,]+\.?\d*)/g);
      if (sgdMatches) {
        console.log(`SGD prices: ${sgdMatches.slice(0, 5).join(', ')}`);
      }

      // 2. JSON-LD
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.offers) {
            console.log(`JSON-LD offers:`, jsonData.offers);
          }
        } catch (e) {
          console.log(`JSON-LD parse error: ${e.message}`);
        }
      }

      // 3. data-price属性
      const dataPriceMatch = html.match(/data-price="([\d.]+)"/);
      if (dataPriceMatch) {
        console.log(`data-price: ${dataPriceMatch[1]}`);
      }
    }

    if (url.includes('lpm.hk')) {
      // LPMの価格を探す
      console.log('\n--- LPM Price Search ---');

      // HKD価格
      const hkdMatches = html.match(/HK\$\s*([\d,]+\.?\d*)/g);
      if (hkdMatches) {
        console.log(`HKD prices: ${hkdMatches.slice(0, 5).join(', ')}`);
      }
    }

  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

// テスト実行
async function runTests() {
  const tests = [
    {
      url: 'https://www.apmex.com/product/304146/2025-canada-1-2-oz-gold-maple-leaf-bu',
      siteName: 'APMEX 1/2oz Maple'
    },
    {
      url: 'https://www.bullionstar.com/buy/product/gold-coin-canadian-maple-half-oz-2025',
      siteName: 'BullionStar 1/2oz Maple'
    },
    {
      url: 'https://www.lpm.hk/en/2025-1-2-oz-canada-maple-leaf-9999-gold-bu-coin.html',
      siteName: 'LPM 1/2oz Maple'
    }
  ];

  for (const test of tests) {
    await testPriceExtraction(test.url, test.siteName);
  }
}

runTests().catch(console.error);