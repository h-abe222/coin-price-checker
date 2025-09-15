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

        // BullionStarのJPY設定のためクッキーを設定
        await page.goto('https://www.bullionstar.com/', { waitUntil: 'networkidle', timeout: 30000 });

        // 通貨をJPYに設定
        try {
            // 通貨設定ドロップダウンをクリック
            await page.click('.currency-dropdown, .currency-selector, [data-currency]', { timeout: 5000 });
            await page.waitForTimeout(1000);

            // JPYオプションを選択
            await page.click('a[href*="currency=JPY"], [data-currency="JPY"], option[value="JPY"]', { timeout: 5000 });
            await page.waitForTimeout(2000);
        } catch (e) {
            console.log('Currency setting attempt failed, proceeding...');
        }

        // 商品ページにアクセス
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // 価格要素を探す（BullionStarの価格セレクター）
        const priceSelectors = [
            '.product-price .price',
            '.price-now',
            '.product-detail-price',
            '[data-price]',
            '.price',
            '.product-price',
            '#product-price'
        ];

        let price = null;
        let currency = 'JPY';

        for (const selector of priceSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    console.log(`Price text from ${selector}: ${text}`);

                    // 日本円の価格を優先的に抽出
                    if (text.includes('¥') || text.includes('JPY')) {
                        const match = text.match(/¥?\s*([\d,]+)/);
                        if (match) {
                            price = parseInt(match[1].replace(/,/g, ''));
                            currency = 'JPY';
                            console.log(`Found JPY price with selector ${selector}: ¥${price}`);
                            break;
                        }
                    }

                    // ドル価格の場合は為替換算を試行
                    if (text.includes('$') || text.includes('USD')) {
                        const match = text.match(/\$?\s*([\d,]+\.?\d*)/);
                        if (match) {
                            const usdPrice = parseFloat(match[1].replace(/,/g, ''));
                            // 概算レート150円/ドルで換算
                            price = Math.round(usdPrice * 150);
                            currency = 'JPY';
                            console.log(`Found USD price $${usdPrice}, converted to ¥${price}`);
                            break;
                        }
                    }

                    // 通貨記号がない場合の数値
                    const match = text.match(/[\d,]+/);
                    if (match && match[0].length >= 4) {
                        const numPrice = parseInt(match[0].replace(/,/g, ''));
                        // 4桁以上で1万以下なら恐らくドル、それ以上なら円
                        if (numPrice < 10000) {
                            price = Math.round(numPrice * 150); // ドルと仮定して換算
                            currency = 'JPY';
                            console.log(`Found number ${numPrice}, assumed USD, converted to ¥${price}`);
                        } else {
                            price = numPrice; // 円と仮定
                            currency = 'JPY';
                            console.log(`Found number ${numPrice}, assumed JPY: ¥${price}`);
                        }
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

        // 商品名を取得
        let productName = null;
        const nameSelectors = [
            'h1',
            '.product-name',
            '.product-title',
            '[data-product-name]',
            '.page-title',
            'title'
        ];

        for (const selector of nameSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text && text.trim().length > 0) {
                        productName = text.trim();
                        console.log(`Found product name: ${productName}`);
                        break;
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // 商品画像を取得
        let imageUrl = null;
        console.log('Searching for product images...');

        try {
            // BullionStarの商品画像の特定パターンを検索
            const productImages = await page.$$eval('img', imgs => {
                return imgs
                    .filter(img => {
                        // 商品の名前がalt属性に含まれている画像
                        const hasProductAlt = img.alt && (
                            img.alt.includes('Buffalo') ||
                            img.alt.includes('Maple') ||
                            img.alt.includes('Panda') ||
                            img.alt.includes('Merlion') ||
                            img.alt.includes('Silver') ||
                            img.alt.includes('Gold') ||
                            img.alt.includes('Bullion') ||
                            img.alt.includes('Coin') ||
                            img.alt.includes('Bar')
                        ) && !img.alt.includes('thumbnail');

                        // 300x300サイズの画像（高解像度商品画像）
                        const isLargeProductImage = img.width === 300 && img.height === 300;

                        // BullionStarの商品画像URLパターン
                        const hasProductUrl = img.src && (
                            img.src.includes('/files/') &&
                            (img.src.includes('300_300') || img.src.includes('coin') || img.src.includes('bar'))
                        );

                        return hasProductAlt || isLargeProductImage || hasProductUrl;
                    })
                    .map(img => ({
                        src: img.src,
                        alt: img.alt,
                        width: img.width,
                        height: img.height,
                        id: img.id
                    }))
                    .sort((a, b) => {
                        // 300x300の画像を最優先
                        if (a.width === 300 && a.height === 300) return -1;
                        if (b.width === 300 && b.height === 300) return 1;

                        // 大きい画像を優先
                        return (b.width * b.height) - (a.width * a.height);
                    });
            });

            console.log('Product images found:', JSON.stringify(productImages, null, 2));

            if (productImages.length > 0) {
                const selectedImage = productImages[0];
                imageUrl = selectedImage.src;
                console.log(`Selected product image: ${imageUrl} (${selectedImage.width}x${selectedImage.height})`);
            } else {
                console.log('No product images found with the expected patterns');
            }

        } catch (e) {
            console.log('Error searching for images:', e.message);
        }

        return { price, productName, imageUrl };
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

            const result = await fetchPrice(browser, product.url);

            if (result && result.price) {
                const updateData = {
                    key: key,
                    price: result.price,
                    currency: 'JPY'
                };

                // 商品名が取得できた場合は含める
                if (result.productName) {
                    updateData.name = result.productName;
                }

                // 画像URLが取得できた場合は含める
                if (result.imageUrl) {
                    updateData.imageUrl = result.imageUrl;
                }

                updates.push(updateData);
                console.log(`${result.productName || product.name}: ¥${result.price.toLocaleString()}`);
                if (result.imageUrl) {
                    console.log(`  Image: ${result.imageUrl}`);
                }
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