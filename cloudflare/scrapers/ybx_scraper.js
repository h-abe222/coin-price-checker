import BaseScraper from './base_scraper.js';
import { chromium } from 'playwright';

class YBXScraper extends BaseScraper {
    constructor() {
        super();
        this.name = 'YBX';
        this.baseURL = 'https://ybx.jp';
        this.supportedDomains = ['ybx.jp'];
    }

    // ブラウザを起動（日本語対応設定付き）
    async launchBrowser() {
        return await chromium.launch({
            headless: true,
            args: [
                '--lang=ja-JP',
                '--accept-lang=ja-JP',
                '--disable-blink-features=AutomationControlled'
            ]
        });
    }

    // ページの初期設定（EUC-JP文字エンコーディング対応）
    async setupPage(page) {
        // User-Agentとロケール設定（EUC-JPサイト対応）
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ja-JP,ja;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Charset': 'euc-jp, utf-8, shift_jis'
        });

        // ビューポート設定
        await page.setViewportSize({ width: 1920, height: 1080 });

        // JavaScriptのロケール設定
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'language', {
                get: () => 'ja-JP'
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['ja-JP', 'ja']
            });
        });

        // ページロード後のエンコーディング確認とデコード
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('ybx.jp')) {
                const contentType = response.headers()['content-type'] || '';

                // EUC-JPの場合の警告（Playwrightは自動的に処理）
                if (contentType.includes('euc-jp') || contentType.includes('EUC-JP')) {
                    console.log(`Note: YBX page uses EUC-JP encoding (${url})`);
                }
            }
        });

        // コンソールログの出力（デバッグ用）
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.error('Page Error:', msg.text());
            }
        });
    }

    // カテゴリURLの定義
    getCategoryURLs() {
        return {
            gold: 'https://ybx.jp/?mode=grp&gid=3110187',
            silver: 'https://ybx.jp/?mode=grp&gid=3110193',
            platinum: 'https://ybx.jp/?mode=grp&gid=3119343',
            other: 'https://ybx.jp/?mode=grp&gid=3119344',
            bar: 'https://ybx.jp/?mode=grp&gid=3110196',
            premium: 'https://ybx.jp/?mode=grp&gid=3110197'
        };
    }

    // カテゴリページから商品リストを取得
    async fetchProductList(category = 'all') {
        const browser = await this.launchBrowser();
        const products = [];

        try {
            const page = await browser.newPage();
            await this.setupPage(page);

            const categoryURLs = category === 'all'
                ? Object.values(this.getCategoryURLs())
                : [this.getCategoryURLs()[category]];

            for (const categoryURL of categoryURLs) {
                console.log(`Fetching products from: ${categoryURL}`);
                await page.goto(categoryURL, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);

                // 商品リンクを取得
                const categoryProducts = await page.evaluate(() => {
                    const products = [];
                    // pidパラメータを持つリンクを探す
                    const links = document.querySelectorAll('a[href*="?pid="]');

                    links.forEach(link => {
                        const href = link.href;
                        const pidMatch = href.match(/\?pid=(\d+)/);
                        if (pidMatch) {
                            const productId = pidMatch[1];
                            const productUrl = `https://ybx.jp/?pid=${productId}`;

                            // 商品名を取得（リンクテキストまたは画像のalt属性から）
                            let productName = link.textContent.trim();
                            if (!productName) {
                                const img = link.querySelector('img');
                                if (img) {
                                    productName = img.alt || img.title || '';
                                }
                            }

                            // 重複を避ける
                            if (!products.find(p => p.id === productId)) {
                                products.push({
                                    id: productId,
                                    url: productUrl,
                                    name: productName,
                                    category: window.location.href
                                });
                            }
                        }
                    });

                    return products;
                });

                products.push(...categoryProducts);
                console.log(`Found ${categoryProducts.length} products in this category`);
            }

            console.log(`Total products found: ${products.length}`);
            return products;

        } catch (error) {
            console.error('Error fetching product list:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }

    // 個別商品の詳細を取得
    async fetchProductDetails(productUrl) {
        const browser = await this.launchBrowser();

        try {
            const page = await browser.newPage();
            await this.setupPage(page);

            console.log(`Fetching product details from: ${productUrl}`);
            await page.goto(productUrl, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const productDetails = await page.evaluate(() => {
                const details = {};

                // 商品名を複数のパターンで取得
                let name = '';

                // パターン1: 商品詳細エリアのタイトル
                const detailTitle = document.querySelector('.product_detail_title, .item-title, .product-title');
                if (detailTitle) {
                    name = detailTitle.textContent.trim();
                }

                // パターン2: og:titleメタタグ
                if (!name || name === 'MENU') {
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle) {
                        name = ogTitle.content.trim();
                    }
                }

                // パターン3: 商品テーブル内のテキスト
                if (!name || name === 'MENU') {
                    const tables = document.querySelectorAll('table');
                    for (const table of tables) {
                        const cells = table.querySelectorAll('td');
                        for (const cell of cells) {
                            const text = cell.textContent.trim();
                            // 商品名らしいパターンを探す
                            if ((text.includes('金貨') || text.includes('銀貨') || text.includes('プラチナ') ||
                                 text.includes('メイプル') || text.includes('ウィーン') || text.includes('ブリタニア')) &&
                                text.length > 10 && text.length < 200 && !text.includes('円')) {
                                name = text;
                                break;
                            }
                        }
                        if (name && name !== 'MENU') break;
                    }
                }

                // パターン4: titleタグから取得
                if (!name || name === 'MENU') {
                    const title = document.querySelector('title');
                    if (title) {
                        name = title.textContent
                            .replace(/\s*[\|｜\-－].*YBX.*$/, '')
                            .replace(/YBX.*$/, '')
                            .trim();
                    }
                }

                details.name = name || 'YBX商品';

                // 価格を取得（"107,999,999円(税込)" のような形式）
                const priceText = document.body.textContent;
                const priceMatch = priceText.match(/([\d,]+)円/);
                if (priceMatch) {
                    const priceStr = priceMatch[1].replace(/,/g, '');
                    details.price = parseInt(priceStr);
                }

                // 商品画像を取得
                const mainImage = document.querySelector('#main-product-image img, img[src*="_o1.png"], img[src*="_th.png"]');
                if (mainImage) {
                    details.imageUrl = mainImage.src;
                }

                // 商品説明を取得
                const descriptionElement = document.querySelector('.product-description, .item-description');
                if (descriptionElement) {
                    details.description = descriptionElement.textContent.trim();
                }

                // 在庫状況
                const stockElement = document.querySelector('.stock-status, .availability');
                if (stockElement) {
                    details.stockStatus = stockElement.textContent.trim();
                }

                return details;
            });

            return productDetails;

        } catch (error) {
            console.error('Error fetching product details:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }

    async scrapePrice(url) {
        // URLからpidを抽出
        const pidMatch = url.match(/\?pid=(\d+)/);
        if (!pidMatch) {
            throw new Error('Invalid YBX product URL');
        }

        const browser = await this.launchBrowser();

        try {
            const page = await browser.newPage();
            await this.setupPage(page);

            console.log(`YBX Scraper: Navigating to ${url}`);
            await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(2000);

            const result = await page.evaluate(() => {
                const data = {};

                // 商品名を複数のパターンで探す
                let productName = '';

                // パターン1: 商品詳細エリアのタイトル
                const detailTitle = document.querySelector('.product_detail_title, .item-title, .product-title');
                if (detailTitle) {
                    productName = detailTitle.textContent.trim();
                }

                // パターン2: og:titleメタタグ
                if (!productName || productName === 'MENU') {
                    const ogTitle = document.querySelector('meta[property="og:title"]');
                    if (ogTitle) {
                        productName = ogTitle.content.trim();
                    }
                }

                // パターン3: titleタグ
                if (!productName || productName === 'MENU') {
                    const title = document.querySelector('title');
                    if (title) {
                        // タイトルから店名を除去
                        productName = title.textContent
                            .replace(/\s*[\|｜\-－].*$/, '')
                            .replace(/YBX.*$/, '')
                            .trim();
                    }
                }

                // パターン4: 商品説明テーブル内
                if (!productName || productName === 'MENU') {
                    const tables = document.querySelectorAll('table');
                    for (const table of tables) {
                        const cells = table.querySelectorAll('td');
                        for (const cell of cells) {
                            const text = cell.textContent.trim();
                            if (text.includes('金貨') || text.includes('銀貨') || text.includes('プラチナ')) {
                                if (text.length > 10 && text.length < 200 && !text.includes('円')) {
                                    productName = text;
                                    break;
                                }
                            }
                        }
                        if (productName && productName !== 'MENU') break;
                    }
                }

                // パターン5: h1～h3タグ（MENUを除外）
                if (!productName || productName === 'MENU') {
                    const headers = document.querySelectorAll('h1, h2, h3');
                    for (const header of headers) {
                        const text = header.textContent.trim();
                        if (text && text !== 'MENU' && text.length > 5) {
                            productName = text;
                            break;
                        }
                    }
                }

                data.productName = productName || 'YBX商品';

                // 価格を探す（複数の方法を試す）
                let price = null;

                // 方法1: 価格を含むテキストを探す
                const pricePattern = /([\d,]+)円/g;
                const bodyText = document.body.textContent;
                const matches = bodyText.match(pricePattern);

                if (matches && matches.length > 0) {
                    // 最初に見つかった妥当な価格を使用
                    for (const match of matches) {
                        const priceStr = match.replace(/[円,]/g, '');
                        const priceNum = parseInt(priceStr);
                        // 妥当な価格範囲をチェック（1000円以上、1億円未満）
                        if (priceNum >= 1000 && priceNum < 100000000) {
                            price = priceNum;
                            break;
                        }
                    }
                }

                // 方法2: 特定のクラスから価格を探す
                if (!price) {
                    const priceElements = document.querySelectorAll('.price, .item-price, .product-price');
                    for (const elem of priceElements) {
                        const text = elem.textContent;
                        const match = text.match(/([\d,]+)/);
                        if (match) {
                            const priceNum = parseInt(match[1].replace(/,/g, ''));
                            if (priceNum >= 1000 && priceNum < 100000000) {
                                price = priceNum;
                                break;
                            }
                        }
                    }
                }

                data.price = price;
                data.currency = 'JPY';
                data.availability = true; // デフォルトで在庫ありとする

                // 在庫状況を確認
                const outOfStockIndicators = ['在庫切れ', '売り切れ', 'SOLD OUT', '完売'];
                const pageText = document.body.textContent.toLowerCase();
                for (const indicator of outOfStockIndicators) {
                    if (pageText.includes(indicator.toLowerCase())) {
                        data.availability = false;
                        break;
                    }
                }

                return data;
            });

            if (!result.price) {
                throw new Error('Price not found on page');
            }

            console.log(`YBX Scraper: Found price ¥${result.price.toLocaleString()}`);
            return {
                price: result.price,
                productName: result.productName,
                currency: result.currency,
                availability: result.availability,
                source: 'YBX',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('YBX Scraper Error:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }
}

export default YBXScraper;