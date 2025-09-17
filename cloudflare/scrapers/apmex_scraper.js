/**
 * APMEX価格スクレイパー
 * 複数支払方法対応（クレジットカード、銀行振込、暗号通貨）
 */

import { BaseScraper } from './base_scraper.js';

export class APMEXScraper extends BaseScraper {
    constructor(browser) {
        super('apmex.com');
        this.browser = browser;
        this.baseUrl = 'https://www.apmex.com';
        // USD to JPY為替レート（定期的に更新が必要）
        this.exchangeRate = 150.0;
    }

    /**
     * 商品価格を取得（インターフェース実装）
     * @param {Object} config - 商品設定
     * @returns {Object} 価格情報
     */
    async scrapeProduct(config) {
        const page = await this.browser.newPage();
        try {
            const result = await this.scrape(config, page);
            return result;
        } finally {
            await page.close();
        }
    }

    /**
     * APMEX価格取得（支払方法別）
     * @param {Object} config - 商品設定
     * @param {Page} page - Playwrightページ
     * @returns {Object} 価格情報
     */
    async scrape(config, page) {
        try {
            const url = config.url.startsWith('http') ? config.url : `${this.baseUrl}${config.url}`;
            console.log(`Scraping APMEX: ${url}`);

            // User-Agentを設定してボット検出を回避
            await page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            });

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // 在庫確認
            const inStock = await this.checkAvailability(page);
            if (!inStock) {
                console.log('APMEX: Product out of stock');
                return null;
            }

            // 価格マトリックス取得
            const priceMatrix = await page.evaluate(() => {
                const result = {
                    credit_card: {},
                    bank_wire: {},
                    crypto: {}
                };

                // テーブルから価格を探す（APMEXは価格テーブルを使用）
                const tables = document.querySelectorAll('table');
                let mainPrice = null;

                // テーブル内の価格を探す
                for (const table of tables) {
                    const rows = table.querySelectorAll('tr');
                    for (const row of rows) {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const qtyText = cells[0].textContent || '';
                            const priceText = cells[cells.length - 1].textContent || '';

                            // 数量1の価格を探す
                            if (qtyText.includes('1') && !qtyText.includes('10') && !qtyText.includes('100')) {
                                const priceMatch = priceText.match(/\$?([\d,]+\.?\d*)/);
                                if (priceMatch) {
                                    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
                                    if (price > 0 && price < 100000) { // 妥当な価格範囲
                                        mainPrice = price;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (mainPrice) break;
                }

                // テーブルで見つからない場合は、通常のセレクターを試す
                if (!mainPrice) {
                    const priceSelectors = [
                        '.product-price',
                        '.price',
                        '[data-testid*=price]',
                        '.price-table .product-price',
                        '.price-value',
                        '[data-product-price]',
                        '.item-price'
                    ];

                    for (const selector of priceSelectors) {
                        const priceEl = document.querySelector(selector);
                        if (priceEl) {
                            const priceText = priceEl.textContent || priceEl.innerText;
                            const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                            if (price > 0 && price < 100000) {
                                mainPrice = price;
                                break;
                            }
                        }
                    }
                }

                // クレジットカード価格（メイン価格）
                if (mainPrice) {
                    result.credit_card.qty_1 = mainPrice;

                    // 銀行振込価格（4%割引）
                    result.bank_wire.qty_1 = mainPrice * 0.96;

                    // 暗号通貨価格（銀行振込と同じ）
                    result.crypto.qty_1 = result.bank_wire.qty_1;
                }

                // 数量別価格テーブルがある場合
                const qtyPrices = document.querySelectorAll('.price-break-row, .qty-price-row');
                qtyPrices.forEach(row => {
                    const qtyEl = row.querySelector('.qty, .quantity');
                    const priceEl = row.querySelector('.price, .price-value');

                    if (qtyEl && priceEl) {
                        const qty = parseInt(qtyEl.textContent.replace(/[^0-9]/g, ''));
                        const price = parseFloat(priceEl.textContent.replace(/[^0-9.]/g, ''));

                        if (qty > 0 && price > 0) {
                            result.credit_card[`qty_${qty}`] = price;
                            result.bank_wire[`qty_${qty}`] = price * 0.96;
                            result.crypto[`qty_${qty}`] = price * 0.96;
                        }
                    }
                });

                return result;
            });

            // 日本向け送料計算を追加
            priceMatrix.shipping_to_japan = {
                base: 49.95,
                per_oz: 0.20
            };

            // 商品名を取得
            const productName = await this.extractProductName(page);

            // 画像URLを取得
            const imageUrl = await this.extractImageUrl(page);

            // 最安値を計算（銀行振込価格を使用）
            const bestPrice = priceMatrix.bank_wire.qty_1 || priceMatrix.credit_card.qty_1 || 0;
            const bestPriceJPY = Math.round(bestPrice * this.exchangeRate);

            console.log(`APMEX: Found price $${bestPrice} = ¥${bestPriceJPY}`);

            return {
                price: bestPriceJPY,
                currency: 'JPY',
                originalPrice: bestPrice,
                originalCurrency: 'USD',
                productName: productName || config.name,
                imageUrl: imageUrl,
                url: url,
                site: this.siteName,
                priceTypes: ['credit_card', 'bank_wire', 'crypto'],
                allPrices: {
                    credit_card: Math.round((priceMatrix.credit_card.qty_1 || 0) * this.exchangeRate),
                    bank_wire: Math.round((priceMatrix.bank_wire.qty_1 || 0) * this.exchangeRate),
                    crypto: Math.round((priceMatrix.crypto.qty_1 || 0) * this.exchangeRate)
                },
                priceMatrix: priceMatrix,
                exchangeRate: this.exchangeRate
            };

        } catch (error) {
            console.error('APMEX scraping error:', error);
            return null;
        }
    }

    /**
     * 在庫確認
     * @param {Page} page - Playwrightページ
     * @returns {boolean} 在庫あり
     */
    async checkAvailability(page) {
        const outOfStockSelectors = [
            '.out-of-stock',
            '.sold-out',
            '[data-availability="out-of-stock"]',
            '.unavailable'
        ];

        for (const selector of outOfStockSelectors) {
            const element = await page.$(selector);
            if (element) {
                const isVisible = await element.isVisible();
                if (isVisible) {
                    return false;
                }
            }
        }

        // 「Add to Cart」ボタンの存在で在庫を確認
        const addToCartButton = await page.$('.add-to-cart, .btn-add-to-cart, [data-add-to-cart]');
        if (addToCartButton) {
            const isDisabled = await addToCartButton.evaluate(el => el.disabled);
            return !isDisabled;
        }

        return true;
    }

    /**
     * 商品名を抽出
     * @param {Page} page - Playwrightページ
     * @returns {string} 商品名
     */
    async extractProductName(page) {
        const nameSelectors = [
            'h1.product-title',
            'h1.product-name',
            '.product-detail h1',
            '[data-product-name]',
            'h1'
        ];

        for (const selector of nameSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const name = await element.textContent();
                    if (name && name.trim().length > 0) {
                        return name.trim();
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return 'APMEX Product';
    }

    /**
     * 画像URLを抽出
     * @param {Page} page - Playwrightページ
     * @returns {string} 画像URL
     */
    async extractImageUrl(page) {
        const imageSelectors = [
            '.product-image img',
            '.product-photo img',
            '.main-image img',
            '[data-product-image] img',
            '.gallery-image img'
        ];

        for (const selector of imageSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const src = await element.getAttribute('src');
                    if (src) {
                        // 相対URLを絶対URLに変換
                        if (src.startsWith('/')) {
                            return `${this.baseUrl}${src}`;
                        }
                        return src;
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return null;
    }
}