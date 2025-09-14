/**
 * BullionStar価格取得スクリプト
 * Playwrightを使用してBullionStarから価格を取得し、
 * Cloudflare WorkerのAPIに送信
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

// 設定
const WORKER_URL = process.env.WORKER_URL || 'https://coin-price-checker.h-abe.workers.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// 価格を取得
async function fetchPrice(browser, url) {
    const page = await browser.newPage();

    try {
        console.log(`Fetching price from: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // 価格要素を探す（BullionStarの価格セレクター）
        const priceSelectors = [
            '.product-price .price',
            '.price-now',
            '.product-detail-price',
            '[data-price]',
            '.price'
        ];

        let price = null;
        for (const selector of priceSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    // 価格を抽出（数字のみ）
                    const match = text.match(/[\d,]+/);
                    if (match) {
                        price = parseInt(match[0].replace(/,/g, ''));
                        console.log(`Found price with selector ${selector}: ${price}`);
                        break;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        if (!price) {
            // JavaScriptで価格を取得
            price = await page.evaluate(() => {
                // 価格っぽいテキストを探す
                const elements = document.querySelectorAll('*');
                for (const elem of elements) {
                    const text = elem.textContent || '';
                    if (text.includes('¥') || text.includes('JPY')) {
                        const match = text.match(/[\d,]+/);
                        if (match && match[0].length >= 5) {
                            return parseInt(match[0].replace(/,/g, ''));
                        }
                    }
                }
                return null;
            });
        }

        return price;
    } catch (error) {
        console.error(`Error fetching price from ${url}:`, error);
        return null;
    } finally {
        await page.close();
    }
}

// 商品リストを取得
async function getProducts() {
    try {
        const response = await fetch(`${WORKER_URL}/api/products`);
        const products = await response.json();
        return products;
    } catch (error) {
        console.error('Error fetching products:', error);
        return {};
    }
}

// 価格を更新
async function updatePrices(updates) {
    try {
        const response = await fetch(`${WORKER_URL}/api/update-prices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_PASSWORD}`
            },
            body: JSON.stringify({ updates })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating prices:', error);
        return null;
    }
}

// メイン処理
async function main() {
    console.log('Starting price check...');
    console.log(`Worker URL: ${WORKER_URL}`);

    // 商品リストを取得
    const products = await getProducts();
    const productEntries = Object.entries(products);

    if (productEntries.length === 0) {
        console.log('No products to check');
        return;
    }

    console.log(`Found ${productEntries.length} products to check`);

    // ブラウザを起動
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const updates = [];

        // 各商品の価格を取得
        for (const [key, product] of productEntries) {
            if (!product.enabled) {
                console.log(`Skipping disabled product: ${product.name}`);
                continue;
            }

            const price = await fetchPrice(browser, product.url);

            if (price) {
                updates.push({
                    key: key,
                    price: price,
                    currency: 'JPY'
                });
                console.log(`${product.name}: ¥${price.toLocaleString()}`);
            } else {
                console.log(`Failed to get price for: ${product.name}`);
            }

            // レート制限を避けるため少し待つ
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // 価格を更新
        if (updates.length > 0) {
            console.log(`\nUpdating ${updates.length} prices...`);
            const result = await updatePrices(updates);

            if (result && result.success) {
                console.log(`Successfully updated ${result.updated} prices`);
                if (result.changes) {
                    result.changes.forEach(change => {
                        console.log(`  - ${change.product}: ¥${change.price.toLocaleString()}`);
                    });
                }
            } else {
                console.log('Failed to update prices');
            }
        } else {
            console.log('No prices to update');
        }

    } finally {
        await browser.close();
    }

    console.log('\nPrice check completed');
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    process.exit(1);
});

// 実行
main().catch(console.error);