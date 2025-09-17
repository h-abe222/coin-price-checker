#!/usr/bin/env node

import fetch from 'node-fetch';
import { chromium } from 'playwright';

/**
 * CLIから価格を更新するツール
 * Cloudflare WorkerのCORS制限を回避するため、ローカル環境から実行
 */

const WORKER_URL = 'https://coin-price-checker-production.h-abe.workers.dev';
const ADMIN_PASSWORD = 'admin123';

// 価格を取得する関数
async function fetchPriceFromSite(url, siteName) {
    console.log(`  📊 ${siteName}: ${url}`);

    try {
        // YBXサイトの場合はPlaywrightを使用
        if (url.includes('ybx.jp')) {
            const browser = await chromium.launch({
                headless: true,
                args: ['--lang=ja-JP']
            });

            try {
                const page = await browser.newPage();
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);

                const price = await page.evaluate(() => {
                    const patterns = [
                        /価格[:：]\s*([\d,]+)円/,
                        /販売価格[:：]\s*([\d,]+)円/,
                        /([\d,]+)円/
                    ];

                    const bodyText = document.body.textContent || '';
                    for (const pattern of patterns) {
                        const matches = bodyText.match(pattern);
                        if (matches && matches[1]) {
                            const priceNum = parseInt(matches[1].replace(/,/g, ''));
                            if (priceNum >= 1000 && priceNum < 100000000) {
                                return priceNum;
                            }
                        }
                    }
                    return null;
                });

                if (price) {
                    console.log(`    ✅ 価格取得成功: ¥${price.toLocaleString()}`);
                    return price;
                } else {
                    console.log(`    ⚠️ 価格が見つかりませんでした`);
                    return null;
                }
            } finally {
                await browser.close();
            }
        }
        // その他のサイト
        else {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.ok) {
                const html = await response.text();

                // 価格パターンマッチング
                let price = null;

                if (url.includes('apmex.com')) {
                    const patterns = [
                        /data-price="([\d.]+)"/,
                        /class="price[^"]*"[^>]*>\s*\$([\d,]+\.?\d*)/,
                        /\$\s*([\d,]+\.?\d*)/
                    ];

                    for (const pattern of patterns) {
                        const match = html.match(pattern);
                        if (match) {
                            const usdPrice = parseFloat(match[1].replace(/,/g, ''));
                            price = Math.round(usdPrice * 150); // USD to JPY
                            break;
                        }
                    }
                } else {
                    const pricePattern = /(?:¥|￥|円|JPY)\s*([\d,]+(?:\.\d{2})?)/i;
                    const match = html.match(pricePattern);
                    if (match) {
                        price = parseFloat(match[1].replace(/,/g, ''));
                    }
                }

                if (price) {
                    console.log(`    ✅ 価格取得成功: ¥${price.toLocaleString()}`);
                    return price;
                } else {
                    console.log(`    ⚠️ 価格が見つかりませんでした`);
                    return null;
                }
            } else {
                console.log(`    ❌ HTTPエラー: ${response.status}`);
                return null;
            }
        }
    } catch (error) {
        console.log(`    ❌ エラー: ${error.message}`);
        return null;
    }
}

// 商品リストを取得
async function getProducts() {
    const response = await fetch(`${WORKER_URL}/api/products-v2`, {
        headers: {
            'Authorization': `Bearer ${ADMIN_PASSWORD}`
        }
    });

    if (!response.ok) {
        throw new Error('商品リストの取得に失敗しました');
    }

    return await response.json();
}

// 商品の価格を更新
async function updateProductPrices(product) {
    console.log(`\n📦 ${product.name}`);

    const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
    const sitePrices = {};
    let updatedCount = 0;

    for (const [siteKey, url] of Object.entries(siteUrls)) {
        if (url) {
            const price = await fetchPriceFromSite(url, siteKey);
            if (price) {
                sitePrices[siteKey] = {
                    price: price,
                    currency: 'JPY',
                    timestamp: new Date().toISOString()
                };
                updatedCount++;
            }
        }
    }

    if (updatedCount > 0) {
        // データベースを更新
        const response = await fetch(`${WORKER_URL}/api/products/update-batch`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ADMIN_PASSWORD}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: product.key,
                site_prices: JSON.stringify(sitePrices),
                current_price: Math.min(...Object.values(sitePrices).map(p => p.price)),
                best_site: Object.entries(sitePrices)
                    .sort((a, b) => a[1].price - b[1].price)[0][0]
            })
        });

        if (response.ok) {
            console.log(`  ✅ データベース更新成功: ${updatedCount}サイト`);
            return updatedCount;
        } else {
            console.log(`  ❌ データベース更新失敗`);
            return 0;
        }
    }

    return 0;
}

// メイン処理
async function main() {
    console.log('🚀 価格更新CLIツール');
    console.log('====================\n');

    try {
        // 商品リストを取得
        console.log('📋 商品リストを取得中...');
        const products = await getProducts();
        console.log(`  ✅ ${products.length}個の商品を取得しました\n`);

        // 各商品の価格を更新
        let totalUpdated = 0;
        for (const product of products) {
            const count = await updateProductPrices(product);
            totalUpdated += count;
        }

        console.log('\n====================');
        console.log(`✅ 完了: ${totalUpdated}件の価格を更新しました`);

    } catch (error) {
        console.error('\n❌ エラー:', error.message);
        process.exit(1);
    }
}

// 引数処理
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log('使用方法: node price-update-cli.js');
    console.log('Cloudflare Workerのデータベースの価格を更新します');
    process.exit(0);
}

main();