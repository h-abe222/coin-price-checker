/**
 * 複数サイト並列価格更新システム
 * 1つの商品レコードで複数サイトの価格を管理（新スキーマ対応）
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { ScraperFactory, compareProductPrices, PRODUCT_MAPPINGS } from './scrapers/scraper_factory.js';

dotenv.config();

// 設定
const WORKER_URL = process.env.WORKER_URL || 'https://coin-price-checker.h-abe.workers.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * 商品の複数サイト価格データをデータベースに保存
 * @param {Object} comparison - 比較結果
 * @param {string} productKey - 商品キー
 */
async function updateProductWithMultiSiteData(comparison, productKey) {
    try {
        console.log(`\n📝 Updating product with multi-site data: ${comparison.productName}`);

        // site_prices JSONデータを構築
        const sitePrices = {};
        const siteUrls = {};

        comparison.sites.forEach(site => {
            const siteKey = site.site.replace(/\./g, '_');

            sitePrices[siteKey] = {
                price: site.price,
                currency: 'JPY',
                updated_at: new Date().toISOString(),
                price_types: site.allPrices,
                status: 'success'
            };

            siteUrls[siteKey] = site.url;
        });

        // 最安値サイトを特定
        const bestSite = comparison.bestDeal.site;

        // 価格差パーセンテージ
        const priceSpreadPercent = Math.round(comparison.priceRange.spreadPercent);

        // 対応サイト数
        const totalSites = comparison.sitesCompared;

        // 更新データ
        const updateData = {
            key: productKey, // 修正: comparisonオブジェクトではなく引数から取得
            name: comparison.productName,
            current_price: comparison.bestDeal.price,
            currency: 'JPY',
            site_prices: JSON.stringify(sitePrices),
            site_urls: JSON.stringify(siteUrls),
            best_site: bestSite,
            price_spread_percent: priceSpreadPercent,
            total_sites: totalSites,
            image_url: comparison.bestDeal.imageUrl || comparison.sites[0].imageUrl,
            updated_at: new Date().toISOString()
        };

        console.log(`   - Product: ${updateData.name}`);
        console.log(`   - Best price: ¥${updateData.current_price.toLocaleString()} (${bestSite})`);
        console.log(`   - Sites: ${totalSites}, Spread: ${priceSpreadPercent}%`);

        // データベース更新APIを呼び出し
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
            console.log(`✅ Successfully updated multi-site product data`);
            return true;
        } else {
            console.log(`❌ Failed to update product: ${result?.error || 'Unknown error'}`);
            return false;
        }

    } catch (error) {
        console.error('Error updating multi-site product:', error);
        return false;
    }
}

/**
 * メイン処理 - 全商品の複数サイト価格更新
 */
async function main() {
    console.log('🚀 Starting multi-site parallel price update...');
    console.log(`Worker URL: ${WORKER_URL}`);

    // 比較対象商品を取得
    const productsToUpdate = Object.keys(PRODUCT_MAPPINGS);

    if (productsToUpdate.length === 0) {
        console.log('No products configured for update');
        return;
    }

    console.log(`Found ${productsToUpdate.length} products for multi-site update:`, productsToUpdate);

    // ブラウザを起動
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const results = [];

        // 各商品の価格比較・更新を実行
        for (const productKey of productsToUpdate) {
            try {
                console.log(`\n${'='.repeat(60)}`);
                console.log(`Processing: ${productKey}`);
                console.log(`${'='.repeat(60)}`);

                // 価格比較実行
                const comparison = await compareProductPrices(productKey, browser);

                // 結果表示
                displayComparisonResult(comparison);

                // 新スキーマでデータベース更新
                const updateSuccess = await updateProductWithMultiSiteData(comparison, productKey);

                results.push({
                    productKey: productKey,
                    productName: comparison.productName,
                    success: updateSuccess,
                    sitesCompared: comparison.sitesCompared,
                    bestPrice: comparison.bestDeal.price,
                    bestSite: comparison.bestDeal.site,
                    priceSpread: comparison.priceRange.spreadPercent
                });

                // レート制限
                await new Promise(resolve => setTimeout(resolve, 3000));

            } catch (error) {
                console.error(`Error processing ${productKey}:`, error);
                results.push({
                    productKey: productKey,
                    error: error.message,
                    success: false
                });
            }
        }

        // 全体サマリーを表示
        displayUpdateSummary(results);

    } finally {
        await browser.close();
    }

    console.log('\n✅ Multi-site parallel price update completed');
}

/**
 * 比較結果を表示
 * @param {Object} comparison - 比較結果
 */
function displayComparisonResult(comparison) {
    if (comparison.error) {
        console.log(`❌ Error: ${comparison.error}`);
        return;
    }

    console.log(`\n📊 Price Comparison Results for ${comparison.productName}`);
    console.log(`   Sites compared: ${comparison.sitesCompared}`);
    console.log(`   Price range: ¥${comparison.priceRange.min.toLocaleString()} - ¥${comparison.priceRange.max.toLocaleString()}`);
    console.log(`   Best price: ¥${comparison.bestDeal.price.toLocaleString()} (${comparison.bestDeal.site})`);
    console.log(`   Price spread: ${comparison.priceRange.spreadPercent}%`);

    console.log(`\n📋 All Sites:`);
    comparison.sites.forEach((site, index) => {
        const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(`   ${badge} ${site.site}: ¥${site.price.toLocaleString()}`);
    });
}

/**
 * 更新サマリーを表示
 * @param {Array} results - 更新結果
 */
function displayUpdateSummary(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`\n${'='.repeat(60)}`);
    console.log('📈 UPDATE SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total products: ${results.length}`);
    console.log(`Successful updates: ${successful.length}`);
    console.log(`Failed updates: ${failed.length}`);

    if (successful.length > 0) {
        console.log(`\n🏆 Updated Products:`);
        successful.forEach(result => {
            console.log(`   ${result.productName}:`);
            console.log(`     └─ Best: ${result.bestSite} - ¥${result.bestPrice.toLocaleString()}`);
            console.log(`     └─ Sites: ${result.sitesCompared}, Spread: ${result.priceSpread}%`);
        });
    }

    if (failed.length > 0) {
        console.log(`\n❌ Failed Updates:`);
        failed.forEach(result => {
            console.log(`   ${result.productKey}: ${result.error || 'Update failed'}`);
        });
    }
}

/**
 * 特定商品の更新を実行
 * @param {string} productKey - 商品キー
 */
async function updateSingleProduct(productKey) {
    if (!PRODUCT_MAPPINGS[productKey]) {
        console.error(`Product not found: ${productKey}`);
        console.log('Available products:', Object.keys(PRODUCT_MAPPINGS));
        return;
    }

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const comparison = await compareProductPrices(productKey, browser);
        displayComparisonResult(comparison);
        const updateSuccess = await updateProductWithMultiSiteData(comparison, productKey);

        if (updateSuccess) {
            console.log('✅ Single product update completed successfully');
        } else {
            console.log('❌ Single product update failed');
        }
    } finally {
        await browser.close();
    }
}

/**
 * サポートサイト一覧を表示
 */
function listSupportedSites() {
    console.log('🌐 Supported Sites:');
    console.log('   - bullionstar.com (BullionStar)');
    console.log('   - lpm.hk (LPM Group Limited)');
    console.log('');
    console.log('📦 Available Products for Multi-Site Update:');
    Object.keys(PRODUCT_MAPPINGS).forEach(key => {
        const configs = PRODUCT_MAPPINGS[key];
        console.log(`   - ${key}: ${configs[0].name}`);
        configs.forEach(config => {
            console.log(`     └─ ${config.site}`);
        });
    });
}

// コマンドライン引数処理
const args = process.argv.slice(2);
const command = args[0];

if (command === 'update' && args[1]) {
    // 特定商品の更新
    updateSingleProduct(args[1]).catch(console.error);
} else if (command === 'sites') {
    // サポートサイト一覧表示
    listSupportedSites();
} else if (command === 'help') {
    // ヘルプ表示
    console.log('Multi-Site Parallel Price Updater Commands:');
    console.log('  node multi-site-parallel-updater.js                    - Update all products');
    console.log('  node multi-site-parallel-updater.js update <product>  - Update specific product');
    console.log('  node multi-site-parallel-updater.js sites              - List supported sites');
    console.log('  node multi-site-parallel-updater.js help               - Show this help');
} else {
    // 全商品更新（デフォルト）
    main().catch(console.error);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});