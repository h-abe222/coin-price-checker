/**
 * 動的価格更新システム
 * UIから登録された商品とURLに基づいて価格を取得・更新
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { BullionStarScraper } from './scrapers/bullionstar_scraper.js';
import { LPMScraper } from './scrapers/lpm_scraper.js';
import { APMEXScraper } from './scrapers/apmex_scraper.js';
import YBXScraper from './scrapers/ybx_scraper.js';

dotenv.config();

// 設定
const WORKER_URL = process.env.WORKER_URL || 'https://coin-price-checker.h-abe.workers.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * データベースから全商品を取得
 */
async function fetchProducts() {
    try {
        const response = await fetch(`${WORKER_URL}/api/products`);
        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.status}`);
        }
        const products = await response.json();
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return {};
    }
}

/**
 * URLからスクレイパーを選択
 */
function getScraperForUrl(url, browser) {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('bullionstar.com')) {
        return new BullionStarScraper(browser);
    } else if (hostname.includes('lpm.hk')) {
        return new LPMScraper(browser);
    } else if (hostname.includes('apmex.com')) {
        return new APMEXScraper(browser);
    } else if (hostname.includes('ybx.jp')) {
        return new YBXScraper();
    }

    console.log(`No scraper available for: ${hostname}`);
    return null;
}

/**
 * 商品の価格を更新
 */
async function updateProductPrices(product, browser) {
    console.log(`\n📦 Processing: ${product.name}`);

    // URLsを解析
    const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
    const siteEntries = Object.entries(siteUrls);

    if (siteEntries.length === 0) {
        console.log('  No URLs registered for this product');
        return null;
    }

    const sitePrices = {};
    let bestPrice = Infinity;
    let bestSite = '';

    // 各URLから価格を取得
    for (const [siteKey, url] of siteEntries) {
        console.log(`  Checking ${siteKey}: ${url}`);

        const scraper = getScraperForUrl(url, browser);
        if (!scraper) {
            console.log(`    ⚠️ No scraper available`);
            continue;
        }

        try {
            const result = await scraper.scrapeProduct({
                url: url,
                name: product.name
            });

            if (result && (result.price || result.primaryPrice)) {
                const price = result.price || result.primaryPrice;
                console.log(`    ✅ Price: ¥${price.toLocaleString()}`);

                sitePrices[siteKey] = {
                    price: price,
                    currency: result.currency || 'JPY',
                    updated_at: new Date().toISOString(),
                    status: 'success'
                };

                if (price < bestPrice) {
                    bestPrice = price;
                    bestSite = siteKey.replace(/_/g, '.');
                }
            } else {
                console.log(`    ❌ Failed to get price`);
                sitePrices[siteKey] = {
                    price: 0,
                    currency: 'JPY',
                    updated_at: new Date().toISOString(),
                    status: 'failed'
                };
            }
        } catch (error) {
            console.error(`    ❌ Error: ${error.message}`);
            sitePrices[siteKey] = {
                price: 0,
                currency: 'JPY',
                updated_at: new Date().toISOString(),
                status: 'error',
                error: error.message
            };
        }

        // レート制限
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 価格データがある場合のみ更新
    if (Object.keys(sitePrices).length === 0) {
        console.log('  No prices collected');
        return null;
    }

    // 価格差計算
    const prices = Object.values(sitePrices)
        .filter(p => p.price > 0)
        .map(p => p.price);

    let priceSpreadPercent = 0;
    if (prices.length > 1) {
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        priceSpreadPercent = Math.round(((maxPrice - minPrice) / minPrice) * 100);
    }

    return {
        key: product.key,
        name: product.name,
        current_price: bestPrice === Infinity ? 0 : bestPrice,
        currency: 'JPY',
        site_prices: JSON.stringify(sitePrices),
        site_urls: JSON.stringify(siteUrls),
        best_site: bestSite || null,
        price_spread_percent: priceSpreadPercent,
        total_sites: siteEntries.length,
        image_url: product.image_url
    };
}

/**
 * データベースを更新
 */
async function updateDatabase(updateData) {
    try {
        const response = await fetch(`${WORKER_URL}/api/update-multi-site-product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_PASSWORD}`
            },
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (result && result.success) {
            console.log(`  ✅ Database updated successfully`);
            return true;
        } else {
            console.log(`  ❌ Database update failed: ${result?.error || 'Unknown error'}`);
            return false;
        }
    } catch (error) {
        console.error('  ❌ Database update error:', error);
        return false;
    }
}

/**
 * メイン処理
 */
async function main() {
    console.log('🚀 Starting Dynamic Price Update System');
    console.log('=' .repeat(60));

    // 商品を取得
    console.log('📥 Fetching products from database...');
    const products = await fetchProducts();
    const productList = Object.values(products);

    if (productList.length === 0) {
        console.log('No products found in database');
        return;
    }

    console.log(`Found ${productList.length} products`);

    // ブラウザを起動
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        let successCount = 0;
        let failCount = 0;

        // 各商品の価格を更新
        for (const product of productList) {
            const updateData = await updateProductPrices(product, browser);

            if (updateData) {
                const success = await updateDatabase(updateData);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } else {
                console.log(`  ⏭️ Skipped: ${product.name}`);
            }
        }

        // サマリー表示
        console.log('\n' + '=' .repeat(60));
        console.log('📊 UPDATE SUMMARY');
        console.log('=' .repeat(60));
        console.log(`✅ Success: ${successCount} products`);
        console.log(`❌ Failed: ${failCount} products`);
        console.log(`⏭️ Skipped: ${productList.length - successCount - failCount} products`);

    } finally {
        await browser.close();
    }

    console.log('\n✨ Dynamic price update completed!');
}

// 特定商品の更新
async function updateSingleProduct(productKey) {
    console.log(`🎯 Updating single product: ${productKey}`);

    const products = await fetchProducts();
    const product = products[productKey];

    if (!product) {
        console.error(`Product not found: ${productKey}`);
        return;
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const updateData = await updateProductPrices(product, browser);

        if (updateData) {
            const success = await updateDatabase(updateData);
            if (success) {
                console.log('✅ Product updated successfully');
            } else {
                console.log('❌ Product update failed');
            }
        }
    } finally {
        await browser.close();
    }
}

// コマンドライン引数処理
const args = process.argv.slice(2);
const command = args[0];

if (command === 'update' && args[1]) {
    // 特定商品の更新
    updateSingleProduct(args[1]).catch(console.error);
} else if (command === 'help') {
    // ヘルプ表示
    console.log('Dynamic Price Updater Commands:');
    console.log('  node dynamic-price-updater.js              - Update all products');
    console.log('  node dynamic-price-updater.js update <key> - Update specific product');
    console.log('  node dynamic-price-updater.js help         - Show this help');
} else {
    // 全商品更新（デフォルト）
    main().catch(console.error);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});