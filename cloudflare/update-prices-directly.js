#!/usr/bin/env node

/**
 * Cloudflare D1データベースに直接価格を更新するツール
 * Web UIからの更新が失敗する問題を回避
 */

import { chromium } from 'playwright';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 価格取得（Playwright使用）
async function fetchPriceWithPlaywright(url, siteName) {
    console.log(`  📊 ${siteName}: 取得中...`);

    const browser = await chromium.launch({
        headless: true,
        args: ['--lang=ja-JP', '--no-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8'
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        await page.waitForTimeout(3000);

        let price = null;

        if (url.includes('ybx.jp')) {
            price = await page.evaluate(() => {
                const patterns = [/([\d,]+)円/];
                const bodyText = document.body.textContent || '';
                for (const pattern of patterns) {
                    const matches = bodyText.match(pattern);
                    if (matches && matches[1]) {
                        const priceNum = parseInt(matches[1].replace(/,/g, ''));
                        if (priceNum >= 10000) return priceNum;
                    }
                }
                return null;
            });
        } else if (url.includes('bullionstar.com')) {
            price = await page.evaluate(() => {
                // 価格要素を探す
                const priceText = document.body.textContent || '';

                // SGDパターン
                const sgdMatch = priceText.match(/SGD\s*([\d,]+\.?\d*)/);
                if (sgdMatch) {
                    const sgdPrice = parseFloat(sgdMatch[1].replace(/,/g, ''));
                    if (sgdPrice > 100 && sgdPrice < 100000) {
                        return Math.round(sgdPrice * 110); // SGD to JPY
                    }
                }

                // $パターン（USD）
                const usdMatch = priceText.match(/\$\s*([\d,]+\.?\d*)/);
                if (usdMatch) {
                    const usdPrice = parseFloat(usdMatch[1].replace(/,/g, ''));
                    if (usdPrice > 100 && usdPrice < 100000) {
                        return Math.round(usdPrice * 150); // USD to JPY
                    }
                }

                return null;
            });
        } else if (url.includes('apmex.com')) {
            price = await page.evaluate(() => {
                // metaタグから価格を取得
                const metaPrice = document.querySelector('meta[property="product:price:amount"]');
                if (metaPrice) {
                    const usdPrice = parseFloat(metaPrice.getAttribute('content'));
                    if (usdPrice > 100 && usdPrice < 100000) {
                        return Math.round(usdPrice * 150); // USD to JPY
                    }
                }

                // テキストから価格を探す
                const priceText = document.body.textContent || '';
                const priceMatch = priceText.match(/\$\s*([\d,]+\.?\d*)/);
                if (priceMatch) {
                    const usdPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
                    if (usdPrice > 100 && usdPrice < 100000) {
                        return Math.round(usdPrice * 150);
                    }
                }

                return null;
            });
        } else if (url.includes('lpm.hk')) {
            price = await page.evaluate(() => {
                const priceText = document.body.textContent || '';

                // HKDパターン
                const hkdMatch = priceText.match(/HK\$\s*([\d,]+\.?\d*)/);
                if (hkdMatch) {
                    const hkdPrice = parseFloat(hkdMatch[1].replace(/,/g, ''));
                    if (hkdPrice > 1000 && hkdPrice < 1000000) {
                        return Math.round(hkdPrice * 19); // HKD to JPY
                    }
                }

                // 一般的な$パターン
                const dollarMatch = priceText.match(/\$\s*([\d,]+\.?\d*)/);
                if (dollarMatch) {
                    const price = parseFloat(dollarMatch[1].replace(/,/g, ''));
                    if (price > 1000 && price < 1000000) {
                        return Math.round(price * 19); // HKD to JPY
                    }
                }

                return null;
            });
        }

        if (price) {
            console.log(`    ✅ 価格: ¥${price.toLocaleString()}`);
            return price;
        } else {
            console.log(`    ⚠️ 価格が見つかりませんでした`);
            return null;
        }
    } catch (error) {
        console.log(`    ❌ エラー: ${error.message}`);
        return null;
    } finally {
        await browser.close();
    }
}

// D1データベースを直接更新（Wrangler CLI使用）
async function updateD1Database(productKey, sitePrices) {
    try {
        // 現在の時刻
        const now = new Date().toISOString();

        // 最安値を計算
        const prices = Object.values(sitePrices)
            .filter(p => p && p.price)
            .map(p => p.price);

        if (prices.length === 0) {
            console.log('    ⚠️ 有効な価格がありません');
            return false;
        }

        const minPrice = Math.min(...prices);
        const bestSite = Object.entries(sitePrices)
            .filter(([, p]) => p && p.price === minPrice)[0][0]
            .replace(/_/g, '.');

        // SQLコマンドを作成
        const sql = `
            UPDATE products
            SET site_prices = '${JSON.stringify(sitePrices)}',
                current_price = ${minPrice},
                best_site = '${bestSite}',
                updated_at = '${now}'
            WHERE key = '${productKey}'
        `.replace(/\n\s+/g, ' ');

        // Wrangler経由でD1を更新
        const command = `npx wrangler d1 execute coin-price-db --env production --command "${sql}"`;

        console.log('    💾 データベース更新中...');
        await execAsync(command);
        console.log('    ✅ データベース更新成功');

        return true;
    } catch (error) {
        console.log(`    ❌ データベース更新エラー: ${error.message}`);
        return false;
    }
}

// メイン処理
async function main() {
    console.log('🚀 価格更新ツール（D1直接更新版）');
    console.log('=====================================\n');

    // 特定の商品を更新（テスト用）
    const testProducts = [
        {
            key: '2025-------------50---1-----------------1----------------',
            name: '2025 メイプルリーフ カナダ 1/2オンス金貨',
            urls: {
                'Bullion_Star': 'https://www.bullionstar.com/buy/product/gold-coin-canadian-maple-half-oz-2025',
                'apmex_com': 'https://www.apmex.com/product/304146/2025-canada-1-2-oz-gold-maple-leaf-bu',
                'LPM': 'https://www.lpm.hk/en/2025-1-2-oz-canada-maple-leaf-9999-gold-bu-coin.html'
            }
        }
    ];

    for (const product of testProducts) {
        console.log(`📦 ${product.name}`);
        console.log(`   キー: ${product.key}\n`);

        const sitePrices = {};

        // 各サイトから価格を取得
        for (const [siteKey, url] of Object.entries(product.urls)) {
            const price = await fetchPriceWithPlaywright(url, siteKey.replace(/_/g, '.'));

            if (price) {
                sitePrices[siteKey] = {
                    price: price,
                    currency: 'JPY',
                    timestamp: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    status: 'success'
                };
            } else {
                // 既存の価格を保持するため、nullは入れない
            }

            // レート制限
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // データベースを更新
        if (Object.keys(sitePrices).length > 0) {
            await updateD1Database(product.key, sitePrices);
        }
    }

    console.log('\n=====================================');
    console.log('✅ 価格更新完了');
    console.log('\n💡 Web UIをリロードして更新された価格を確認してください');
}

// 実行
main().catch(console.error);