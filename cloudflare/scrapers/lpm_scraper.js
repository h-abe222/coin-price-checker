/**
 * LPM Group Limited スクレイパー
 * 香港の貴金属ディーラー（複数価格帯対応）
 */

import { BaseScraper } from './base_scraper.js';

export class LPMScraper extends BaseScraper {
    constructor(browser) {
        super(browser);
        this.baseUrl = 'https://www.lpm.hk';
        this.siteName = 'lpm.hk';
    }

    /**
     * LPMから商品価格を取得（複数価格帯対応）
     * @param {Object} productConfig - 商品設定
     * @returns {Promise<Object>} 価格情報
     */
    async scrapeProduct(productConfig) {
        const page = await this.browser.newPage();

        try {
            console.log(`Scraping LPM: ${productConfig.url}`);

            // ページアクセス
            await this.navigateWithRetry(page, productConfig.url);

            // 複数の価格帯を取得
            const prices = {};

            // リテール価格（単品価格）
            const retailPrice = await this.extractPrice(page, [
                '.price-now',
                '.retail-price',
                '.product-price',
                '.current-price',
                '[data-price]',
                '.price'
            ]);

            if (retailPrice) {
                const currency = await this.detectPageCurrency(page);
                const convertedPrice = await this.convertToJPY(retailPrice, currency);
                prices.retail = convertedPrice;
            }

            // 数量割引価格を取得
            const bulkPrices = await this.extractBulkPrices(page);
            if (bulkPrices && Object.keys(bulkPrices).length > 0) {
                const currency = await this.detectPageCurrency(page);
                for (const [qty, price] of Object.entries(bulkPrices)) {
                    prices[`bulk_${qty}`] = await this.convertToJPY(price, currency);
                }
            }

            if (Object.keys(prices).length === 0) {
                console.log('No prices found');
                return null;
            }

            // 結果構築
            return await this.buildResult(page, prices, productConfig);

        } catch (error) {
            console.error(`Error scraping LPM ${productConfig.url}:`, error);
            return null;
        } finally {
            await page.close();
        }
    }

    /**
     * 数量割引価格を抽出
     * @param {Page} page - Playwrightページ
     * @returns {Promise<Object>} 数量別価格
     */
    async extractBulkPrices(page) {
        try {
            // Method 1: 価格テーブルから抽出
            const tablePrices = await page.evaluate(() => {
                const priceTable = document.querySelector('.bulk-pricing-table, .quantity-pricing, .price-table');
                if (!priceTable) return {};

                const prices = {};
                const rows = priceTable.querySelectorAll('tr');

                rows.forEach(row => {
                    const qtyElement = row.querySelector('.qty, .quantity, td:first-child');
                    const priceElement = row.querySelector('.price, .amount, td:last-child');

                    if (qtyElement && priceElement) {
                        const qtyText = qtyElement.textContent.trim();
                        const priceText = priceElement.textContent.trim();

                        // 数量の抽出（例: "5+", "100-999", "1000" など）
                        const qtyMatch = qtyText.match(/(\d+)/);
                        const priceMatch = priceText.match(/[\d,]+\.?\d*/);

                        if (qtyMatch && priceMatch) {
                            const qty = qtyMatch[1];
                            const price = parseFloat(priceMatch[0].replace(/,/g, ''));
                            prices[qty] = price;
                        }
                    }
                });

                return prices;
            });

            if (Object.keys(tablePrices).length > 0) {
                console.log('Extracted bulk prices from table:', tablePrices);
                return tablePrices;
            }

            // Method 2: 価格選択ボタンから抽出
            const buttonPrices = await page.evaluate(() => {
                const priceButtons = document.querySelectorAll('.price-option, .qty-price, [data-qty]');
                const prices = {};

                priceButtons.forEach(button => {
                    const qty = button.getAttribute('data-qty') ||
                               button.textContent.match(/(\d+)/)?.[1];
                    const priceText = button.textContent || button.getAttribute('data-price');
                    const priceMatch = priceText?.match(/[\d,]+\.?\d*/);

                    if (qty && priceMatch) {
                        prices[qty] = parseFloat(priceMatch[0].replace(/,/g, ''));
                    }
                });

                return prices;
            });

            if (Object.keys(buttonPrices).length > 0) {
                console.log('Extracted bulk prices from buttons:', buttonPrices);
                return buttonPrices;
            }

            return {};

        } catch (error) {
            console.log('Error extracting bulk prices:', error.message);
            return {};
        }
    }

    /**
     * ページの通貨を検出
     * @param {Page} page - Playwrightページ
     * @returns {Promise<string>} 通貨コード
     */
    async detectPageCurrency(page) {
        try {
            // 通貨表示要素をチェック
            const currencySelectors = [
                '.currency-display',
                '.current-currency',
                '[data-currency]',
                '.price-currency'
            ];

            for (const selector of currencySelectors) {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    const currency = this.detectCurrency(text);
                    if (currency !== 'USD') {
                        return currency;
                    }
                }
            }

            // 価格テキストから通貨を推測
            const priceElements = await page.$$('.price, .amount, [data-price]');
            for (const element of priceElements) {
                const text = await element.textContent();
                const currency = this.detectCurrency(text);
                if (currency !== 'USD') {
                    return currency;
                }
            }

            // LPMは主に香港ドル
            return 'HKD';

        } catch (error) {
            console.log('Currency detection failed:', error.message);
            return 'HKD'; // LPMのデフォルト通貨
        }
    }

    /**
     * 通貨をJPYに変換
     * @param {number} price - 元価格
     * @param {string} currency - 元通貨
     * @returns {Promise<number>} JPY価格
     */
    async convertToJPY(price, currency) {
        if (currency === 'JPY') return price;

        const rate = await this.getExchangeRate(currency, 'JPY');
        const convertedPrice = Math.round(price * rate);

        console.log(`LPM: Converted ${price} ${currency} to ¥${convertedPrice} (rate: ${rate})`);
        return convertedPrice;
    }

    /**
     * LPM専用画像抽出
     * @param {Page} page - Playwrightページ
     * @returns {Promise<string|null>} 画像URL
     */
    async extractLPMImage(page) {
        try {
            // LPMの商品画像パターン
            const patterns = [
                'product',
                'gold',
                'silver',
                'coin',
                'bar',
                'maple',
                'eagle',
                'buffalo'
            ];

            // 高解像度画像を優先
            const image = await this.extractImage(page, patterns);

            if (image) {
                console.log(`LPM: Selected image: ${image}`);
                return image;
            }

            // LPM特有の画像セレクター
            const lpmImage = await page.evaluate(() => {
                const imageElements = [
                    '.product-image img',
                    '.main-image img',
                    '.item-image img',
                    '[data-product-image] img'
                ];

                for (const selector of imageElements) {
                    const img = document.querySelector(selector);
                    if (img && img.src && img.width > 100) {
                        return img.src;
                    }
                }
                return null;
            });

            return lpmImage;

        } catch (error) {
            console.log('Error extracting LPM image:', error.message);
            return null;
        }
    }

    /**
     * 結果オブジェクトを構築
     * @param {Page} page - Playwrightページ
     * @param {Object} prices - 価格情報
     * @param {Object} productConfig - 商品設定
     * @returns {Promise<Object>} 結果オブジェクト
     */
    async buildResult(page, prices, productConfig) {
        // 商品名を取得
        const productName = await this.extractProductName(page, [
            'h1',
            '.product-title',
            '.item-name',
            '.product-name',
            '.page-title'
        ]);

        // 商品画像を取得
        const imageUrl = await this.extractLPMImage(page);

        return {
            site: this.siteName,
            prices: prices,
            primaryPrice: prices.retail || Object.values(prices)[0], // メイン価格
            currency: 'JPY',
            productName: productName || productConfig.name,
            imageUrl: imageUrl,
            priceTypes: Object.keys(prices), // 取得できた価格タイプ
            scrapedAt: new Date().toISOString()
        };
    }

    /**
     * LPMの商品設定例
     * @returns {Object} 商品設定マップ
     */
    static getProductConfigs() {
        return {
            'maple-gold-1oz': {
                url: 'https://www.lpm.hk/en/products/gold-coins/canadian-maple-leaf-1oz',
                name: 'Canadian Maple Leaf 1oz Gold',
                category: 'gold-coins'
            },
            'pamp-gold-100g': {
                url: 'https://www.lpm.hk/en/products/gold-bars/pamp-suisse-100g',
                name: 'PAMP Suisse Gold Bar 100g',
                category: 'gold-bars'
            },
            'silver-maple-1oz': {
                url: 'https://www.lpm.hk/en/products/silver-coins/canadian-maple-leaf-1oz',
                name: 'Canadian Silver Maple Leaf 1oz',
                category: 'silver-coins'
            },
            'silver-bar-1kg': {
                url: 'https://www.lpm.hk/en/products/silver-bars/generic-1kg',
                name: 'Silver Bar 1kg',
                category: 'silver-bars'
            }
        };
    }
}