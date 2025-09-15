/**
 * 複数サイト価格チェッカー
 * 同じ商品の価格を複数サイトから取得して比較
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { ScraperFactory, compareProductPrices, PRODUCT_MAPPINGS } from './scrapers/scraper_factory.js';

dotenv.config();

// 設定
const WORKER_URL = process.env.WORKER_URL || 'https://coin-price-checker.h-abe.workers.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/**
 * メイン処理
 */
async function main() {
    console.log('Starting multi-site price comparison...');
    console.log(`Worker URL: ${WORKER_URL}`);

    // 比較対象商品を取得
    const productsToCompare = Object.keys(PRODUCT_MAPPINGS);

    if (productsToCompare.length === 0) {
        console.log('No products configured for comparison');
        return;
    }

    console.log(`Found ${productsToCompare.length} products for comparison:`, productsToCompare);

    // ブラウザを起動
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const allComparisons = [];

        // 各商品の価格比較を実行
        for (const productKey of productsToCompare) {
            try {
                console.log(`\\n${'='.repeat(60)}`);
                console.log(`Processing: ${productKey}`);
                console.log(`${'='.repeat(60)}`);

                const comparison = await compareProductPrices(productKey, browser);
                allComparisons.push(comparison);

                // 結果表示
                displayComparisonResult(comparison);

                // データベース更新
                await updateDatabaseWithComparison(comparison);

                // レート制限
                await new Promise(resolve => setTimeout(resolve, 3000));

            } catch (error) {
                console.error(`Error comparing ${productKey}:`, error);
                allComparisons.push({
                    productKey: productKey,
                    error: error.message,
                    success: false
                });
            }
        }

        // 全体サマリーを表示
        displayOverallSummary(allComparisons);

    } finally {
        await browser.close();
    }

    console.log('\\nMulti-site price comparison completed');
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

    console.log(`\\n📊 Price Comparison Results for ${comparison.productName}`);
    console.log(`   Sites compared: ${comparison.sitesCompared}`);
    console.log(`   Price range: ¥${comparison.priceRange.min.toLocaleString()} - ¥${comparison.priceRange.max.toLocaleString()}`);
    console.log(`   Average: ¥${comparison.priceRange.average.toLocaleString()}`);
    console.log(`   Spread: ¥${comparison.priceRange.spread.toLocaleString()} (${comparison.priceRange.spreadPercent}%)`);

    console.log(`\\n🏆 Best Deal: ${comparison.bestDeal.site}`);
    console.log(`   Price: ¥${comparison.bestDeal.price.toLocaleString()}`);
    console.log(`   Product: ${comparison.bestDeal.productName}`);

    console.log(`\\n📋 All Sites:`);
    comparison.sites.forEach((site, index) => {
        const badge = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(`   ${badge} ${site.site}: ¥${site.price.toLocaleString()}`);

        // 複数価格がある場合は表示
        if (site.priceTypes.length > 1) {
            Object.entries(site.allPrices).forEach(([type, price]) => {
                if (type !== 'retail') {
                    console.log(`      └─ ${type}: ¥${price.toLocaleString()}`);
                }
            });
        }
    });
}

/**
 * 全体サマリーを表示
 * @param {Array} allComparisons - 全比較結果
 */
function displayOverallSummary(allComparisons) {
    const successful = allComparisons.filter(c => !c.error);
    const failed = allComparisons.filter(c => c.error);

    console.log(`\\n${'='.repeat(60)}`);
    console.log('📈 OVERALL SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total products: ${allComparisons.length}`);
    console.log(`Successful comparisons: ${successful.length}`);
    console.log(`Failed comparisons: ${failed.length}`);

    if (successful.length > 0) {
        console.log(`\\n🏆 Best Deals Found:`);
        successful.forEach(comp => {
            console.log(`   ${comp.productName}: ${comp.bestDeal.site} - ¥${comp.bestDeal.price.toLocaleString()}`);
        });

        console.log(`\\n💰 Largest Price Spreads:`);
        const sortedBySpreads = successful
            .sort((a, b) => b.priceRange.spreadPercent - a.priceRange.spreadPercent)
            .slice(0, 3);

        sortedBySpreads.forEach(comp => {
            console.log(`   ${comp.productName}: ${comp.priceRange.spreadPercent}% (¥${comp.priceRange.spread.toLocaleString()})`);
        });
    }

    if (failed.length > 0) {
        console.log(`\\n❌ Failed Products:`);
        failed.forEach(comp => {
            console.log(`   ${comp.productKey}: ${comp.error}`);
        });
    }
}

/**
 * データベースに比較結果を更新
 * @param {Object} comparison - 比較結果
 */
async function updateDatabaseWithComparison(comparison) {
    try {
        const updates = comparison.sites.map(site => ({
            // 既存のキー形式に合わせてサイト名を含むキーを生成
            key: `${site.site.replace('.', '-')}-${comparison.productName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            price: site.price,
            currency: 'JPY',
            name: `${site.productName} (${site.site})`,
            imageUrl: site.imageUrl,
            site: site.site,
            comparisonData: {
                priceTypes: site.priceTypes,
                allPrices: site.allPrices,
                rank: comparison.sites.indexOf(site) + 1,
                totalSites: comparison.sitesCompared,
                priceSpread: comparison.priceRange.spreadPercent
            }
        }));

        console.log(`\\n📝 Updating database with ${updates.length} entries...`);

        const response = await fetch(`${WORKER_URL}/api/update-prices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_PASSWORD}`
            },
            body: JSON.stringify({ updates })
        });

        const result = await response.json();

        if (result && result.success) {
            console.log(`✅ Successfully updated ${result.updated} prices in database`);
            if (result.changes) {
                result.changes.forEach(change => {
                    console.log(`   - ${change.product}: ¥${change.price.toLocaleString()}`);
                });
            }
        } else {
            console.log('❌ Failed to update prices in database');
        }

    } catch (error) {
        console.error('Error updating database:', error);
    }
}

/**
 * 特定商品の価格比較を実行
 * @param {string} productKey - 商品キー
 */
async function compareSingleProduct(productKey) {
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
        await updateDatabaseWithComparison(comparison);
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
    console.log('📦 Available Products for Comparison:');
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

if (command === 'compare' && args[1]) {
    // 特定商品の比較
    compareSingleProduct(args[1]).catch(console.error);
} else if (command === 'sites') {
    // サポートサイト一覧表示
    listSupportedSites();
} else if (command === 'help') {
    // ヘルプ表示
    console.log('Multi-Site Price Checker Commands:');
    console.log('  node multi-site-price-checker.js                    - Compare all products');
    console.log('  node multi-site-price-checker.js compare <product>  - Compare specific product');
    console.log('  node multi-site-price-checker.js sites              - List supported sites');
    console.log('  node multi-site-price-checker.js help               - Show this help');
} else {
    // 全商品比較（デフォルト）
    main().catch(console.error);
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});