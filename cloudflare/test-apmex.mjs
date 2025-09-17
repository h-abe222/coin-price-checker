import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

try {
  console.log('Navigating to APMEX page...');
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  });
  
  await page.goto('https://www.apmex.com/product/304146/2025-canada-1-2-oz-gold-maple-leaf-bu', { 
    waitUntil: 'networkidle', 
    timeout: 30000 
  });
  
  console.log('Page loaded. Extracting prices...');
  
  // JavaScript内で価格を探す
  const prices = await page.evaluate(() => {
    const results = [];
    // すべてのテキストノードを検索
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text.match(/\$[\d,]+\.?\d*/)) {
        const parent = node.parentElement;
        results.push({
          text: text,
          parent: parent.tagName,
          class: parent.className
        });
      }
    }
    return results;
  });
  
  console.log('\nPrices found:');
  const uniquePrices = new Map();
  prices.forEach(p => {
    if (!uniquePrices.has(p.text)) {
      uniquePrices.set(p.text, p);
      console.log(`  ${p.text} (in ${p.parent})`);
    }
  });
  
  await page.screenshot({ path: 'apmex-full.png', fullPage: true });
  console.log('\nFull page screenshot saved');
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  setTimeout(() => browser.close(), 3000);
}
