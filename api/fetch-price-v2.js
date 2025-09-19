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
      await new Promise(resolve => setTimeout(resolve, 8000));

      const usdPrice = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const usdPattern = /\$([\d,]+\.\d{2})/g;
        const matches = [...bodyText.matchAll(usdPattern)];

        for (const match of matches) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          // 1/2オンス金貨の適正範囲
          if (price > 1000 && price < 3000) {
            return price;
          }
        }
        return null;
      });

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