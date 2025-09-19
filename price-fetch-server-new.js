import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json());

let browser;

async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

async function fetchBullionStarPrice(url) {
  const browser = await initBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();

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

    console.log('Extracting prices...');
    const extractedPrice = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      console.log('Body text length in evaluate:', bodyText.length);

      const yenPattern = /¥([\d,]+(?:\.\d{2})?)/g;
      const matches = [...bodyText.matchAll(yenPattern)];
      console.log('Total Yen matches found:', matches.length);

      const prices = [];
      for (const match of matches) {
        const price = parseFloat(match[1].replace(/,/g, ''));
        if (price > 200000 && price < 400000) {
          prices.push(price);
        }
      }

      console.log('Valid price candidates:', prices);
      return prices.length > 0 ? prices[0] : null;
    });

    console.log('Extracted price:', extractedPrice);

    if (extractedPrice) {
      const finalPrice = Math.round(extractedPrice);
      console.log(`BullionStar price found (JPY): ¥${finalPrice}`);
      return finalPrice;
    } else {
      console.log('No valid price found for BullionStar');
      return null;
    }

  } catch (error) {
    console.error('Error fetching price:', error.message);
    return null;
  } finally {
    await context.close();
  }
}

// Test endpoint
app.post('/test', async (req, res) => {
  const { url } = req.body;
  const price = await fetchBullionStarPrice(url);
  
  if (price) {
    res.json({ success: true, price });
  } else {
    res.json({ success: false, error: 'Price not found' });
  }
});

const PORT = 3457;
app.listen(PORT, async () => {
  console.log(`Test server running on port ${PORT}`);
  await initBrowser();
  console.log('Browser initialized');

  // Auto test
  console.log('\n=== Running auto test ==="');
  const testUrl = 'https://www.bullionstar.com/buy/product/gold-coin-canadian-maple-half-oz-2025';
  const price = await fetchBullionStarPrice(testUrl);
  console.log('Auto test result:', price ? `¥${price}` : 'Failed');
});