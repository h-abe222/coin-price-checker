import { chromium } from 'playwright';

const EXCHANGE_RATES = {
  SGD: 110
};

async function testBullionStar() {
  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
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

    console.log('Waiting for price to load...');
    await page.waitForTimeout(5000);

    // Take screenshot
    await page.screenshot({ path: 'bullionstar-page.png', fullPage: true });
    console.log('Screenshot saved as bullionstar-page.png');

    // Try to find price
    const pageContent = await page.content();
    console.log('\nSearching for prices in page...');

    // Search for SGD patterns
    const sgdMatches = pageContent.match(/(?:SGD|S\$)\s*([\d,]+\.?\d*)/gi);
    if (sgdMatches) {
      console.log('Found SGD prices:', sgdMatches.slice(0, 10));
    }

    // Try to get price from JavaScript
    const jsPrice = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const patterns = [
        /S\$\s*([\d,]+\.?\d*)/g,
        /SGD\s*([\d,]+\.?\d*)/g
      ];

      const prices = [];
      for (const pattern of patterns) {
        const matches = bodyText.matchAll(pattern);
        for (const match of matches) {
          const price = parseFloat(match[1].replace(/,/g, ''));
          if (price > 100) {
            prices.push(price);
          }
        }
      }
      return prices;
    });

    console.log('\nPrices found via JavaScript:', jsPrice);

    // Check for specific selectors
    const selectors = [
      '.product-price',
      '.price-now',
      '.product-info-price',
      '[class*="price"]',
      '.product-price-update'
    ];

    for (const selector of selectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`\nFound ${elements.length} elements with selector: ${selector}`);
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const text = await elements[i].textContent();
            console.log(`  Element ${i + 1}: ${text.trim()}`);
          }
        }
      } catch (e) {
        // Selector not found
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testBullionStar().catch(console.error);