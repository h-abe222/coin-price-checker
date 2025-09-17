/**
 * ベーススクレイパークラス
 * すべてのサイト専用スクレイパーの基底クラス
 */

class BaseScraper {
    constructor(browser) {
        this.browser = browser;
        this.exchangeRates = null; // キャッシュ用
    }

    /**
     * 商品価格を取得（サブクラスで実装）
     * @param {Object} productConfig - 商品設定
     * @returns {Promise<Object>} 価格情報
     */
    async scrapeProduct(productConfig) {
        throw new Error('scrapeProduct method must be implemented by subclass');
    }

    /**
     * 価格抽出（複数セレクターに対応）
     * @param {Page} page - Playwrightページオブジェクト
     * @param {Array} selectors - CSSセレクターリスト
     * @returns {Promise<number|null>} 抽出された価格
     */
    async extractPrice(page, selectors) {
        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    console.log(`Price text from ${selector}: ${text}`);

                    // 価格パターンマッチング
                    const priceMatch = text.match(/[\d,]+\.?\d*/);
                    if (priceMatch) {
                        const price = parseFloat(priceMatch[0].replace(/,/g, ''));
                        if (price > 0) {
                            console.log(`Extracted price: ${price}`);
                            return price;
                        }
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    /**
     * 商品画像を取得
     * @param {Page} page - Playwrightページオブジェクト
     * @param {Array} patterns - 画像パターン設定
     * @returns {Promise<string|null>} 画像URL
     */
    async extractImage(page, patterns = []) {
        try {
            const images = await page.$$eval('img', (imgs, patterns) => {
                return imgs
                    .filter(img => {
                        // サイズフィルター
                        if (img.width >= 200 && img.height >= 200) return true;

                        // alt属性フィルター
                        if (img.alt && patterns.some(p =>
                            img.alt.toLowerCase().includes(p.toLowerCase())
                        )) return true;

                        // URLパターンフィルター
                        if (img.src && patterns.some(p =>
                            img.src.includes(p)
                        )) return true;

                        return false;
                    })
                    .map(img => ({
                        src: img.src,
                        alt: img.alt,
                        width: img.width,
                        height: img.height
                    }))
                    .sort((a, b) => (b.width * b.height) - (a.width * a.height));
            }, patterns);

            return images.length > 0 ? images[0].src : null;
        } catch (error) {
            console.log('Error extracting image:', error.message);
            return null;
        }
    }

    /**
     * 商品名を抽出
     * @param {Page} page - Playwrightページオブジェクト
     * @param {Array} selectors - セレクターリスト
     * @returns {Promise<string|null>} 商品名
     */
    async extractProductName(page, selectors = ['h1', '.product-name', '.product-title']) {
        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const text = await element.textContent();
                    if (text && text.trim().length > 0) {
                        return text.trim();
                    }
                }
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    /**
     * 為替レート取得
     * @param {string} from - 元通貨
     * @param {string} to - 対象通貨
     * @returns {Promise<number>} 為替レート
     */
    async getExchangeRate(from, to) {
        if (from === to) return 1;

        // キャッシュチェック（1時間有効）
        const cacheKey = `${from}_${to}`;
        const now = Date.now();

        if (this.exchangeRates &&
            this.exchangeRates[cacheKey] &&
            (now - this.exchangeRates[cacheKey].timestamp) < 3600000) {
            return this.exchangeRates[cacheKey].rate;
        }

        try {
            // 為替レートAPI呼び出し（例：ExchangeRate-API）
            const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
            const data = await response.json();
            const rate = data.rates[to];

            // キャッシュに保存
            if (!this.exchangeRates) this.exchangeRates = {};
            this.exchangeRates[cacheKey] = {
                rate: rate,
                timestamp: now
            };

            return rate;
        } catch (error) {
            console.log(`Exchange rate fetch failed: ${error.message}`);
            // フォールバック固定レート
            const fallbackRates = {
                'USD_JPY': 150,
                'HKD_JPY': 19.2,
                'EUR_JPY': 162,
                'GBP_JPY': 190
            };
            return fallbackRates[`${from}_${to}`] || 1;
        }
    }

    /**
     * 通貨を検出
     * @param {string} text - 価格テキスト
     * @returns {string} 通貨コード
     */
    detectCurrency(text) {
        const currencySymbols = {
            '$': 'USD',
            '¥': 'JPY',
            '€': 'EUR',
            '£': 'GBP',
            'HK$': 'HKD',
            'USD': 'USD',
            'JPY': 'JPY',
            'HKD': 'HKD'
        };

        for (const [symbol, code] of Object.entries(currencySymbols)) {
            if (text.includes(symbol)) {
                return code;
            }
        }
        return 'USD'; // デフォルト
    }

    /**
     * サイト名を取得
     * @returns {string} サイト名
     */
    getSiteName() {
        return this.constructor.name.replace('Scraper', '').toLowerCase();
    }

    /**
     * リトライ機能付きページアクセス
     * @param {Page} page - Playwrightページ
     * @param {string} url - アクセスURL
     * @param {number} maxRetries - 最大リトライ回数
     * @returns {Promise<boolean>} 成功フラグ
     */
    async navigateWithRetry(page, url, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: 30000
                });
                return true;
            } catch (error) {
                console.log(`Navigation attempt ${i + 1} failed: ${error.message}`);
                if (i === maxRetries - 1) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
            }
        }
        return false;
    }
}

export default BaseScraper;