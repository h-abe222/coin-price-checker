import { chromium } from 'playwright';

async function testLPM() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });

  const page = await context.newPage();
  const url = 'https://www.lpm.hk/en/2025-1-2-oz-canada-maple-leaf-9999-gold-bu-coin.html';

  try {
    console.log('Opening LPM page...');
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('Waiting for page to load...');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'lpm-page.png', fullPage: false });
    console.log('Screenshot saved as lpm-page.png');

    // Get all text content
    const pageText = await page.evaluate(() => {
      return document.body.innerText;
    });

    console.log('\n=== Searching for prices ==="');

    // Search for HKD prices
    const hkdMatches = pageText.match(/HK\$\s*([\d,]+\.?\d*)/g);
    if (hkdMatches) {
      console.log('HKD prices found:', hkdMatches.slice(0, 10));
    }

    // Search for JPY prices
    const jpyMatches = pageText.match(/¥([\d,]+(?:\.\d{2})?)/g);
    if (jpyMatches) {
      console.log('JPY prices found:', jpyMatches.slice(0, 10));
    }

    // Search for USD prices
    const usdMatches = pageText.match(/\$\s*([\d,]+\.?\d*)/g);
    if (usdMatches) {
      console.log('USD prices found:', usdMatches.slice(0, 10));
    }

    // Try to extract price from specific selectors
    const selectors = [
      '.product-price',
      '.price',
      '[itemprop="price"]',
      '.product-info-price',
      '.regular-price',
      '.special-price'
    ];

    for (const selector of selectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`\nFound ${elements.length} elements with selector: ${selector}`);
          for (let i = 0; i < Math.min(3, elements.length); i++) {
            const text = await elements[i].textContent();
            if (text && text.trim()) {
              console.log(`  Element ${i + 1}: ${text.trim()}`);
            }
          }
        }
      } catch (e) {
        // Selector not found
      }
    }

    // Check meta tags
    const metaPrice = await page.evaluate(() => {
      const metaTags = document.querySelectorAll('meta[property*="price"], meta[itemprop="price"]');
      const prices = [];
      metaTags.forEach(tag => {
        const content = tag.getAttribute('content');
        if (content) {
          prices.push(content);
        }
      });
      return prices;
    });

    if (metaPrice.length > 0) {
      console.log('\nMeta tag prices:', metaPrice);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testLPM().catch(console.error);