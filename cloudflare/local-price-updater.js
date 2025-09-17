#!/usr/bin/env node

/**
 * ローカル環境から直接価格を更新するツール
 * Cloudflare WorkerのCORS制限を回避
 */

import fetch from 'node-fetch';
import { chromium } from 'playwright';

const WORKER_URL = 'https://coin-price-checker-production.h-abe.workers.dev';
const ADMIN_PASSWORD = 'admin123';

// 価格取得関数（Playwright使用）
async function fetchPriceWithPlaywright(url, siteName) {
    console.log(`  📊 Fetching from ${siteName}: ${url}`);

    const browser = await chromium.launch({
        headless: true,
        args: ['--lang=ja-JP']
    });

    try {
        const page = await browser.newPage();

        // User-Agentを設定
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8'
        });

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // ページ読み込み待機
        await page.waitForTimeout(3000);

        let price = null;

        if (url.includes('ybx.jp')) {
            // YBXの価格取得
            price = await page.evaluate(() => {
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
        } else if (url.includes('bullionstar.com')) {
            // BullionStarの価格取得
            price = await page.evaluate(() => {
                // 価格要素を探す
                const priceElements = document.querySelectorAll('[class*="price"], .product-price, .item-price, [data-price]');

                for (const element of priceElements) {
                    const text = element.textContent || '';
                    // SGDパターン
                    const sgdMatch = text.match(/SGD\s*([\d,]+\.?\d*)/);
                    if (sgdMatch) {
                        const sgdPrice = parseFloat(sgdMatch[1].replace(/,/g, ''));
                        return Math.round(sgdPrice * 110); // SGD to JPY
                    }
                    // $パターン
                    const dollarMatch = text.match(/\$\s*([\d,]+\.?\d*)/);
                    if (dollarMatch) {
                        const usdPrice = parseFloat(dollarMatch[1].replace(/,/g, ''));
                        return Math.round(usdPrice * 150); // USD to JPY
                    }
                }
                return null;
            });
        } else if (url.includes('apmex.com')) {
            // APMEXの価格取得
            price = await page.evaluate(() => {
                // metaタグから価格を取得
                const metaPrice = document.querySelector('meta[property="product:price:amount"]');
                if (metaPrice) {
                    const usdPrice = parseFloat(metaPrice.getAttribute('content'));
                    return Math.round(usdPrice * 150); // USD to JPY
                }

                // data-price属性から取得
                const dataPrice = document.querySelector('[data-price]');
                if (dataPrice) {
                    const usdPrice = parseFloat(dataPrice.getAttribute('data-price'));
                    return Math.round(usdPrice * 150);
                }

                // テキストから価格を探す
                const priceElements = document.querySelectorAll('.price, .product-price');
                for (const element of priceElements) {
                    const text = element.textContent || '';
                    const match = text.match(/\$\s*([\d,]+\.?\d*)/);
                    if (match) {
                        const usdPrice = parseFloat(match[1].replace(/,/g, ''));
                        return Math.round(usdPrice * 150);
                    }
                }

                return null;
            });
        } else {
            // 汎用価格取得
            price = await page.evaluate(() => {
                const patterns = [
                    /(?:¥|￥|円|JPY)\s*([\d,]+(?:\.\d{2})?)/i,
                    /\$\s*([\d,]+\.?\d*)/
                ];

                const bodyText = document.body.textContent || '';
                for (const pattern of patterns) {
                    const match = bodyText.match(pattern);
                    if (match) {
                        const priceNum = parseFloat(match[1].replace(/,/g, ''));
                        if (pattern.toString().includes('$')) {
                            return Math.round(priceNum * 150); // USD to JPY
                        }
                        return priceNum;
                    }
                }
                return null;
            });
        }

        if (price) {
            console.log(`    ✅ 価格取得成功: ¥${price.toLocaleString()}`);
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

// 商品リストを取得
async function getProducts() {
    const response = await fetch(`${WORKER_URL}/api/products`, {
        headers: {
            'Authorization': `Bearer ${ADMIN_PASSWORD}`
        }
    });

    if (!response.ok) {
        throw new Error(`商品リスト取得失敗: ${response.status}`);
    }

    const data = await response.json();

    // オブジェクトを配列に変換
    if (!Array.isArray(data)) {
        return Object.entries(data).map(([key, product]) => ({
            key: key,
            ...product
        }));
    }

    return data;
}

// 価格をデータベースに保存
async function updateProductInDatabase(product, prices) {
    // 既存の価格更新APIを使用
    const response = await fetch(`${WORKER_URL}/api/products/${product.key}/update-prices`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ADMIN_PASSWORD}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prices: prices
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.log(`    エラー詳細: ${errorText}`);
        return false;
    }

    return true;
}

// メイン処理
async function main() {
    console.log('🚀 ローカル価格更新ツール');
    console.log('==========================\n');

    try {
        // 商品リストを取得
        console.log('📋 商品リストを取得中...');
        const products = await getProducts();
        console.log(`  ✅ ${products.length}個の商品を取得しました\n`);

        let totalUpdated = 0;
        let totalPrices = 0;

        // 各商品の価格を更新
        for (const product of products) {
            console.log(`\n📦 ${product.name}`);

            const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
            if (Object.keys(siteUrls).length === 0) {
                console.log('  ⚠️ URLが登録されていません');
                continue;
            }

            const sitePrices = {};

            // 各サイトから価格を取得
            for (const [siteKey, url] of Object.entries(siteUrls)) {
                const siteName = siteKey.replace(/_/g, '.');
                const price = await fetchPriceWithPlaywright(url, siteName);

                if (price) {
                    sitePrices[siteKey] = {
                        price: price,
                        currency: 'JPY',
                        timestamp: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        status: 'success'
                    };
                    totalPrices++;
                }

                // レート制限
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // データベースを更新
            if (Object.keys(sitePrices).length > 0) {
                const success = await updateProductInDatabase(product, sitePrices);
                if (success) {
                    console.log(`  ✅ データベース更新成功`);
                    totalUpdated++;
                } else {
                    console.log(`  ❌ データベース更新失敗`);
                }
            }
        }

        console.log('\n==========================');
        console.log(`✅ 完了: ${totalUpdated}商品、${totalPrices}件の価格を更新しました`);

    } catch (error) {
        console.error('\n❌ エラー:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 実行
main();