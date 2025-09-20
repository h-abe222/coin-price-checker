/**
 * Vercel API Route - 価格取得API v2
 * Puppeteer Core + Chrome AWS Lambda を使用
 */

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// 為替レート
const EXCHANGE_RATES = {
  USD: 150,
  HKD: 19,
  SGD: 110,
  EUR: 160,
  GBP: 190
};

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS リクエスト処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;

  try {
    const { url, siteName } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Fetching price from: ${url} (${siteName})`);

    // Puppeteerでブラウザを起動
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    // User-Agentを設定したコンテキストを作成
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // ページ読み込み
    const waitUntil = url.includes('apmex.com') ? 'domcontentloaded' : 'networkidle2';
    await page.goto(url, { waitUntil, timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    let price = null;

    // BullionStar - SGDで表示される
    if (url.includes('bullionstar.com')) {
      const sgdPrice = await page.evaluate(() => {
        const text = document.body.innerText;
        // SGD価格を探す（例：SGD 2,345.67 または S$ 2,345.67）
        const patterns = [
          /SGD\s*([\d,]+\.?\d*)/g,
          /S\$\s*([\d,]+\.?\d*)/g,
          /\$\s*([\d,]+\.?\d*)/g  // SGDページではドル記号のみの場合も
        ];

        for (const pattern of patterns) {
          const matches = text.match(pattern);
          if (matches) {
            for (const match of matches) {
              const value = parseFloat(match.replace(/[^\d.]/g, ''));
              // 1/2オンス金貨の適正価格範囲（SGD 2,000-3,500）
              if (value > 2000 && value < 3500) {
                return value;
              }
            }
          }
        }
        return null;
      });

      if (sgdPrice) {
        price = Math.round(sgdPrice * EXCHANGE_RATES.SGD);
        console.log(`SGD ${sgdPrice} → JPY ${price}`);
      }
    }

    // APMEX - USD表示
    else if (url.includes('apmex.com')) {
      // APMEXは価格読み込みに時間がかかる（8秒待機）
      await new Promise(resolve => setTimeout(resolve, 8000));

      const usdPrice = await page.evaluate((pageUrl) => {
        const bodyText = document.body.innerText;
        const usdPattern = /\$([\d,]+\.\d{2})/g;
        const matches = [...bodyText.matchAll(usdPattern)];

        // URLから商品タイプを判定
        let minPrice, maxPrice;
        if (pageUrl.includes('1-oz') || pageUrl.includes('one-ounce')) {
          // 1オンス金貨
          minPrice = 2500;
          maxPrice = 3500;
        } else if (pageUrl.includes('1-2-oz') || pageUrl.includes('half-ounce')) {
          // 1/2オンス金貨
          minPrice = 1300;
          maxPrice = 1800;
        } else if (pageUrl.includes('1-4-oz') || pageUrl.includes('quarter-ounce')) {
          // 1/4オンス金貨
          minPrice = 650;
          maxPrice = 900;
        } else {
          // デフォルト（広めの範囲）
          minPrice = 500;
          maxPrice = 3500;
        }

        for (const match of matches) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (price > minPrice && price < maxPrice) {
            return price;
          }
        }
        return null;
      }, url);

      if (usdPrice) {
        price = Math.round(usdPrice * EXCHANGE_RATES.USD);
        console.log(`USD ${usdPrice} → JPY ${price}`);
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

    await browser.close();

    if (price) {
      return res.status(200).json({
        success: true,
        price: price,
        currency: 'JPY',
        siteName: siteName,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(200).json({
        success: false,
        error: 'Price not found',
        siteName: siteName
      });
    }

  } catch (error) {
    console.error('Error:', error);
    if (browser) await browser.close();
    return res.status(200).json({
      success: false,
      error: error.message,
      siteName: req.body.siteName
    });
  }
}