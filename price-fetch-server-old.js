/**
 * Playwright対応価格取得サーバー
 * Cloudflare保護やJavaScript必須サイトにも対応
 */

import express from 'express';
import { chromium } from 'playwright';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3456;

// 為替レート
const EXCHANGE_RATES = {
  USD: 150,
  HKD: 19,
  SGD: 110,
  EUR: 160,
  GBP: 190
};

// ブラウザインスタンスを保持
let browser = null;

// ブラウザの初期化
async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

// 価格取得関数
async function fetchPriceWithPlaywright(url, siteName) {
  const browser = await initBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();
  let price = null;

  try {
    console.log(`Fetching price from: ${url}`);

    // ページを開く（最大30秒待機）
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // サイト別の価格取得ロジック
    if (url.includes('apmex.com')) {
      // APMEX - 複数のセレクタを試す
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
              console.log(`APMEX price found: $${usdPrice}`);

              // 価格の妥当性チェック
              if (usdPrice > 500 && usdPrice < 5000) {
                price = Math.round(usdPrice * EXCHANGE_RATES.USD);
                console.log(`Converted to JPY: ¥${price}`);
                break;
              }
            }
          }
        } catch (e) {
          // このセレクタは存在しない
        }
      }

      // JavaScriptから価格を取得
      if (!price) {
        const jsPrice = await page.evaluate(() => {
          // グローバル変数やDataLayerをチェック
          if (typeof dataLayer !== 'undefined') {
            for (const item of dataLayer) {
              if (item.ecommerce && item.ecommerce.detail) {
                return item.ecommerce.detail.products[0].price;
              }
            }
          }
          // 価格を含むテキストを探す
          const priceElements = document.querySelectorAll('*');
          for (const el of priceElements) {
            const text = el.textContent;
            if (text && text.match(/\$[\d,]+\.\d{2}/)) {
              const match = text.match(/\$([\d,]+\.\d{2})/);
              if (match) {
                return parseFloat(match[1].replace(',', ''));
              }
            }
          }
          return null;
        });

        if (jsPrice && jsPrice > 500 && jsPrice < 5000) {
          price = Math.round(jsPrice * EXCHANGE_RATES.USD);
          console.log(`JS extracted price: $${jsPrice} → ¥${price}`);
        }
      }
    }

    else if (url.includes('bullionstar.com')) {
      // BullionStar - 価格要素が動的に生成されるのを待つ
      console.log('Loading BullionStar page...');

      // 価格要素が表示されるまで待機
      try {
        await page.waitForSelector('.product-price-update', { timeout: 10000 });
        await page.waitForTimeout(3000);
        console.log('Price element loaded');
      } catch (e) {
        console.log('Warning: Price element selector not found, continuing...');
      }

      // 日本円価格を直接探す（BullionStarは日本からアクセスすると円表示）
      console.log('Extracting BullionStar prices...');

      const extractedPrice = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // ¥マークを含む価格を探す
        const yenPattern = /¥([\d,]+(?:\.\d{2})?)/g;
        const matches = [...bodyText.matchAll(yenPattern)];

        const validPrices = [];
        for (const match of matches) {
          const priceValue = parseFloat(match[1].replace(/,/g, ''));
          // 金貨の妥当な価格範囲（10万〜100万円）
          if (priceValue > 100000 && priceValue < 1000000) {
            validPrices.push(priceValue);
          }
        }

        // 20万〜40万円の範囲を優先（1/2オンス金貨の適正価格）
        const halfOuncePrices = validPrices.filter(p => p > 200000 && p < 400000);
        if (halfOuncePrices.length > 0) {
          return halfOuncePrices[0];
        }

        // それ以外の妥当な価格を返す
        return validPrices.length > 0 ? validPrices[0] : null;
      });

      if (extractedPrice) {
        price = Math.round(extractedPrice);
        console.log(`BullionStar price successfully extracted: ¥${price}`);
      } else {
        console.log('BullionStar: No valid price found in page');
      }
    }

    else if (url.includes('lpm.hk')) {
      // LPM - 価格取得
      console.log('Loading LPM page...');
      await page.waitForTimeout(3000);

      // Check if page loaded successfully
      const pageTitle = await page.title();
      if (pageTitle.includes('503') || pageTitle.includes('Error')) {
        console.log('LPM page returned error:', pageTitle);
        throw new Error('LPM site returned error 503');
      }

      // Try to find prices in multiple currencies
      const priceData = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Search for HKD prices
        const hkdPattern = /HK\$\s*([\d,]+\.?\d*)/g;
        const hkdMatches = [...bodyText.matchAll(hkdPattern)];

        // Search for JPY prices (in case it shows JPY)
        const jpyPattern = /¥([\d,]+(?:\.\d{2})?)/g;
        const jpyMatches = [...bodyText.matchAll(jpyPattern)];

        const hkdPrices = [];
        const jpyPrices = [];

        for (const match of hkdMatches) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (price > 5000 && price < 50000) {
            hkdPrices.push(price);
          }
        }

        for (const match of jpyMatches) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (price > 200000 && price < 400000) {
            jpyPrices.push(price);
          }
        }

        return { hkdPrices, jpyPrices };
      });

      if (priceData.hkdPrices.length > 0) {
        const hkdPrice = priceData.hkdPrices[0];
        price = Math.round(hkdPrice * EXCHANGE_RATES.HKD);
        console.log(`LPM price found: HK$ ${hkdPrice} → ¥${price}`);
      } else if (priceData.jpyPrices.length > 0) {
        price = Math.round(priceData.jpyPrices[0]);
        console.log(`LPM price found (JPY): ¥${price}`);
      } else {
        console.log('No valid price found for LPM');
      }
    }

    else if (url.includes('ybx.jp')) {
      // YBX - 日本円価格
      console.log('Loading YBX page...');
      await page.waitForTimeout(3000);

      console.log('Extracting YBX price...');
      const jsPrice = await page.evaluate(() => {
        const bodyText = document.body.innerText;

        // 円表記の価格を探す
        const yenPattern = /([\d,]+)円/g;
        const matches = [...bodyText.matchAll(yenPattern)];

        const validPrices = [];
        for (const match of matches) {
          const priceValue = parseInt(match[1].replace(/,/g, ''));
          // 金貨の妥当な価格範囲（10万〜100万円）
          // 送料などを除外
          if (priceValue > 100000 && priceValue < 1000000) {
            validPrices.push(priceValue);
          }
        }

        // 最初の妥当な価格を返す
        return validPrices.length > 0 ? validPrices[0] : null;
      });

      if (jsPrice) {
        price = jsPrice;
        console.log(`YBX price successfully extracted: ¥${price}`);
      } else {
        console.log('YBX: No valid price found in page');
      }
    }

  } catch (error) {
    console.error(`Error fetching price: ${error.message}`);
  } finally {
    await context.close();
  }

  return price;
}

// APIエンドポイント
app.post('/api/fetch-price', async (req, res) => {
  const { url, siteName } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL is required'
    });
  }

  try {
    const price = await fetchPriceWithPlaywright(url, siteName);

    if (price) {
      res.json({
        success: true,
        price: price,
        currency: 'JPY',
        siteName: siteName,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: false,
        error: 'Price not found',
        siteName: siteName
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      siteName: siteName
    });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Price fetch server running on http://localhost:${PORT}`);
  console.log('Initializing browser...');
  initBrowser().then(() => {
    console.log('Browser initialized successfully');
  }).catch(err => {
    console.error('Failed to initialize browser:', err);
  });
});

// 終了処理
process.on('SIGINT', async () => {
  console.log('Closing browser...');
  if (browser) {
    await browser.close();
  }
  process.exit();
});