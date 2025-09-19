/**
 * 価格取得サーバー - シンプル版
 */

import express from 'express';
import { chromium } from 'playwright';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;

// ブラウザーの初期化（再利用）
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

// 価格取得メイン関数
app.post('/api/fetch-price', async (req, res) => {
  const { url, siteName } = req.body;
  console.log(`\n[${new Date().toISOString()}] ${siteName}: ${url}`);

  try {
    const browser = await getBrowser();

    // User-Agentを設定したコンテキストを作成
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    // ページ読み込み（サイトに応じて調整）
    const waitUntil = url.includes('apmex.com') ? 'domcontentloaded' : 'networkidle';
    await page.goto(url, { waitUntil, timeout: 30000 });
    await page.waitForTimeout(3000);

    let price = null;

    // BullionStar - 日本円で表示される
    if (url.includes('bullionstar.com')) {
      price = await page.evaluate(() => {
        const text = document.body.innerText;
        const matches = text.match(/¥([\d,]+(?:\.\d{2})?)/g);
        if (matches) {
          for (const match of matches) {
            const value = parseFloat(match.replace(/[¥,]/g, ''));
            if (value > 200000 && value < 400000) {
              return Math.round(value);
            }
          }
        }
        return null;
      });
    }

    // APMEX - USD表示
    else if (url.includes('apmex.com')) {
      // APMEXは価格読み込みに時間がかかる（8秒待機）
      await page.waitForTimeout(8000);

      const usdPrice = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const usdPattern = /\$([\d,]+\.\d{2})/g;
        const matches = [...bodyText.matchAll(usdPattern)];

        for (const match of matches) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          // 1/2オンス金貨の適正範囲（テスト済み）
          if (price > 1000 && price < 3000) {
            return price;
          }
        }
        return null;
      });

      if (usdPrice) {
        price = Math.round(usdPrice * 150); // USD to JPY
        console.log(`  USD $${usdPrice} → JPY ¥${price}`);
      } else {
        console.log('  価格が見つかりませんでした');
      }
    }

    // YBX - 日本円表示
    else if (url.includes('ybx.jp')) {
      price = await page.evaluate(() => {
        const text = document.body.innerText;
        const matches = text.match(/([\d,]+)円/g);
        if (matches) {
          for (const match of matches) {
            const value = parseInt(match.replace(/[円,]/g, ''));
            if (value > 100000 && value < 1000000) {
              return value;
            }
          }
        }
        return null;
      });
    }

    await page.close();
    await context.close();

    // レスポンス
    if (price) {
      console.log(`  ✓ 価格取得成功: ¥${price}`);
      res.json({
        success: true,
        price: price,
        currency: 'JPY',
        siteName: siteName,
        timestamp: new Date().toISOString()
      });
    } else {
      console.log(`  ✗ 価格取得失敗`);
      res.json({
        success: false,
        error: 'Price not found',
        siteName: siteName
      });
    }

  } catch (error) {
    console.error(`  ✗ エラー: ${error.message}`);
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
const PORT = 3456;
app.listen(PORT, () => {
  console.log(`価格取得サーバー起動: http://localhost:${PORT}`);
  console.log('対応サイト: BullionStar, APMEX, YBX');
});

// 終了処理
process.on('SIGINT', async () => {
  console.log('\nサーバー終了中...');
  if (browser) await browser.close();
  process.exit();
});