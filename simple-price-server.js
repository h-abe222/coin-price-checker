#!/usr/bin/env node

/**
 * シンプルな価格取得サーバー - デバッグ版
 */

import express from 'express';
import { chromium } from 'playwright';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 即座にログ出力するように設定
process.stdout.write = (function(write) {
  return function(string, encoding, fd) {
    write.apply(process.stdout, arguments);
    if (process.stdout.isTTY) {
      process.stdout._handle.flushBuffer && process.stdout._handle.flushBuffer();
    }
  };
})(process.stdout.write);

console.log('Starting simple price server...');

let browser = null;

async function getBrowser() {
  if (!browser) {
    console.log('Creating new browser instance...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox']
    });
    console.log('Browser created');
  }
  return browser;
}

app.post('/api/fetch-price', async (req, res) => {
  const { url, siteName } = req.body;
  console.log(`\n=== Request received: ${siteName} ===`);
  console.log(`URL: ${url}`);

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    console.log('New page created');

    // ページを開く
    console.log('Loading page...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Page loaded');

    // 少し待機
    await page.waitForTimeout(3000);

    let price = null;

    // BullionStar
    if (url.includes('bullionstar.com')) {
      console.log('Extracting BullionStar price...');

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

      console.log('BullionStar price:', price);
    }

    // APMEX
    else if (url.includes('apmex.com')) {
      console.log('Extracting APMEX price...');

      // メタタグから価格を取得
      const metaPrice = await page.$eval(
        'meta[property="product:price:amount"]',
        el => el.getAttribute('content')
      ).catch(() => null);

      if (metaPrice) {
        const usd = parseFloat(metaPrice);
        price = Math.round(usd * 150);
        console.log(`APMEX price: $${usd} = ¥${price}`);
      }
    }

    await page.close();
    console.log('Page closed');

    if (price) {
      console.log(`Success: ${siteName} = ¥${price}`);
      res.json({
        success: true,
        price: price,
        currency: 'JPY',
        siteName: siteName
      });
    } else {
      console.log(`Failed: ${siteName} - no price found`);
      res.json({
        success: false,
        error: 'Price not found',
        siteName: siteName
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
    res.json({
      success: false,
      error: error.message,
      siteName: siteName
    });
  }
});

const PORT = 3456;
app.listen(PORT, () => {
  console.log(`Simple server running on http://localhost:${PORT}`);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (browser) await browser.close();
  process.exit();
});