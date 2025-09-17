#!/usr/bin/env node

import fetch from 'node-fetch';

// テスト用の商品キー（実際のデータベースから取得する必要があります）
const productKey = process.argv[2];

if (!productKey) {
    console.log('Usage: node test-price-update.js <product-key>');
    console.log('Example: node test-price-update.js maple-leaf-1oz-2024');
    process.exit(1);
}

async function testPriceUpdate() {
    console.log(`Testing price update for product: ${productKey}`);

    try {
        // プロキシサーバーが起動しているか確認
        const healthResponse = await fetch('http://localhost:8083/health');
        if (!healthResponse.ok) {
            throw new Error('Price update proxy server is not running');
        }
        console.log('✅ Price update proxy server is running');

        // 価格更新をローカルでテスト
        const testUrls = {
            'ybx_jp': 'https://ybx.jp/?pid=166577663',
            'apmex_com': 'https://www.apmex.com/product/27074/1-oz-canadian-gold-maple-leaf-coin-random-year'
        };

        for (const [siteName, url] of Object.entries(testUrls)) {
            console.log(`\nTesting ${siteName}: ${url}`);

            const response = await fetch('http://localhost:8083/api/fetch-price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, siteName })
            });

            const result = await response.json();

            if (result.success) {
                console.log(`  ✅ Price: ¥${result.price.toLocaleString()}`);
            } else {
                console.log(`  ❌ Failed: ${result.error}`);
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.log('\nMake sure the price update proxy server is running:');
        console.log('  node price-update-proxy.js');
    }
}

testPriceUpdate();