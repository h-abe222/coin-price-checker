/**
 * BullionStarスクレイパー
 * 既存のロジックをクラス化
 */

import { BaseScraper } from './base_scraper.js';

export class BullionStarScraper extends BaseScraper {
    constructor(browser) {
        super(browser);
        this.baseUrl = 'https://www.bullionstar.com';
        this.siteName = 'bullionstar.com';
    }

    /**
     * BullionStarから商品価格を取得
     * @param {Object} productConfig - 商品設定
     * @returns {Promise<Object>} 価格情報
     */
    async scrapeProduct(productConfig) {
        const page = await this.browser.newPage();

        try {
            console.log(`Scraping BullionStar: ${productConfig.url}`);

            // 通貨設定（JPY）
            await this.setCurrency(page);

            // 商品ページアクセス
            await this.navigateWithRetry(page, productConfig.url);

            // 価格抽出
            const price = await this.extractPrice(page, [
                '.product-price .price',
                '.price-now',
                '.product-detail-price',
                '[data-price]',
                '.price',
                '.product-price',
                '#product-price'
            ]);

            if (!price) {
                console.log('No price found with standard selectors, trying JavaScript extraction');
                const jsPrice = await this.extractPriceWithJS(page);
                if (jsPrice) {
                    return await this.buildResult(page, jsPrice, 'JPY', productConfig);
                }
                return null;
            }

            // 通貨検出と変換
            const currency = await this.detectPageCurrency(page);
            const finalPrice = currency === 'JPY' ? price : await this.convertPrice(price, currency, 'JPY');

            return await this.buildResult(page, finalPrice, 'JPY', productConfig);

        } catch (error) {
            console.error(`Error scraping BullionStar ${productConfig.url}:`, error);
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * 通貨をJPYに設定
     * @param {Page} page - Playwrightページ
     */
    async setCurrency(page) {
        try {
            await page.goto('https://www.bullionstar.com/', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // 通貨設定ドロップダウンをクリック
            await page.click('.currency-dropdown, .currency-selector, [data-currency]', {
                timeout: 5000
            });
            await page.waitForTimeout(1000);

            // JPYオプションを選択
            await page.click('a[href*="currency=JPY"], [data-currency="JPY"], option[value="JPY"]', {
                timeout: 5000
            });
            await page.waitForTimeout(2000);

            console.log('Currency set to JPY');
        } catch (e) {
            console.log('Currency setting attempt failed, proceeding...');
        }
    }

    /**
     * JavaScriptで価格を抽出
     * @param {Page} page - Playwrightページ
     * @returns {Promise<number|null>} 価格
     */
    async extractPriceWithJS(page) {
        return await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            for (const elem of elements) {
                const text = elem.textContent || '';
                if (text.includes('¥') || text.includes('JPY')) {
                    const match = text.match(/[\\d,]+/);
                    if (match && match[0].length >= 5) {
                        return parseInt(match[0].replace(/,/g, ''));
                    }
                }
            }
            return null;
        });
    }

    /**
     * ページの通貨を検出
     * @param {Page} page - Playwrightページ
     * @returns {Promise<string>} 通貨コード
     */
    async detectPageCurrency(page) {
        try {
            const currencyElement = await page.$('.currency-display, .current-currency, [data-currency]');
            if (currencyElement) {
                const currencyText = await currencyElement.textContent();
                if (currencyText.includes('JPY') || currencyText.includes('¥')) {
                    return 'JPY';
                }
                if (currencyText.includes('USD') || currencyText.includes('$')) {
                    return 'USD';
                }
            }
        } catch (e) {
            // Ignore
        }
        return 'JPY'; // デフォルト
    }

    /**
     * 価格変換
     * @param {number} price - 元価格
     * @param {string} from - 元通貨
     * @param {string} to - 対象通貨
     * @returns {Promise<number>} 変換後価格
     */
    async convertPrice(price, from, to) {
        if (from === to) return price;

        const rate = await this.getExchangeRate(from, to);
        const convertedPrice = Math.round(price * rate);

        console.log(`Converted ${price} ${from} to ${convertedPrice} ${to} (rate: ${rate})`);
        return convertedPrice;
    }

    /**
     * 結果オブジェクトを構築
     * @param {Page} page - Playwrightページ
     * @param {number} price - 価格
     * @param {string} currency - 通貨
     * @param {Object} productConfig - 商品設定
     * @returns {Promise<Object>} 結果オブジェクト
     */
    async buildResult(page, price, currency, productConfig) {
        // 商品名を取得
        const productName = await this.extractProductName(page, [
            'h1',
            '.product-name',
            '.product-title',
            '[data-product-name]',
            '.page-title',
            'title'
        ]);

        // 商品画像を取得
        const imageUrl = await this.extractBullionStarImage(page);

        return {
            site: this.siteName,
            price: price,
            currency: currency,
            productName: productName || productConfig.name,
            imageUrl: imageUrl,
            scrapedAt: new Date().toISOString()
        };
    }

    /**
     * BullionStar専用画像抽出
     * @param {Page} page - Playwrightページ
     * @returns {Promise<string|null>} 画像URL
     */
    async extractBullionStarImage(page) {
        try {
            const productImages = await page.$$eval('img', imgs => {
                return imgs
                    .filter(img => {
                        // 商品名がalt属性に含まれている画像
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
                        height: img.height
                    }))
                    .sort((a, b) => {
                        // 300x300の画像を最優先
                        if (a.width === 300 && a.height === 300) return -1;
                        if (b.width === 300 && b.height === 300) return 1;

                        // 大きい画像を優先
                        return (b.width * b.height) - (a.width * a.height);
                    });
            });

            console.log(`BullionStar: Found ${productImages.length} product images`);

            if (productImages.length > 0) {
                const selectedImage = productImages[0];
                console.log(`Selected image: ${selectedImage.src} (${selectedImage.width}x${selectedImage.height})`);
                return selectedImage.src;
            }

            return null;
        } catch (error) {
            console.log('Error extracting BullionStar image:', error.message);
            return null;
        }
    }
}