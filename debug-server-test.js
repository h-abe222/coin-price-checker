// デバッグ用テストスクリプト
import fetch from 'node-fetch';

const TEST_URLS = [
  {
    name: 'BullionStar',
    url: 'https://www.bullionstar.com/buy/product/gold-coin-canadian-maple-half-oz-2025'
  },
  {
    name: 'APMEX',
    url: 'https://www.apmex.com/product/304146/2025-canada-1-2-oz-gold-maple-leaf-bu'
  },
  {
    name: 'YBX',
    url: 'https://www.ybx.jp/view.php?id=M-18'
  }
];

async function testServer() {
  console.log('Starting server tests...');
  console.log('Making requests to http://localhost:3456/api/fetch-price\n');

  for (const test of TEST_URLS) {
    console.log(`Testing ${test.name}...`);
    
    try {
      const response = await fetch('http://localhost:3456/api/fetch-price', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: test.url,
          siteName: test.name
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ ${test.name}: ¥${data.price}`);
      } else {
        console.log(`❌ ${test.name}: ${data.error}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Request failed - ${error.message}`);
    }
  }

  console.log('\nTest complete.');
}

testServer().catch(console.error);