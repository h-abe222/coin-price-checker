/**
 * スクレイパーファクトリー
 * 複数サイトのスクレイパーを管理・実行
 */

import { BullionStarScraper } from './bullionstar_scraper.js';
import { LPMScraper } from './lpm_scraper.js';
import { APMEXScraper } from './apmex_scraper.js';

export class ScraperFactory {
    constructor(browser) {
        this.browser = browser;
        this.scrapers = new Map();
        this.initializeScrapers();
    }

    /**
     * スクレイパーを初期化
     */
    initializeScrapers() {
        this.scrapers.set('bullionstar.com', new BullionStarScraper(this.browser));
        this.scrapers.set('lpm.hk', new LPMScraper(this.browser));
        // APMEXは地域制限のため一時的に無効化
        // this.scrapers.set('apmex.com', new APMEXScraper(this.browser));

        console.log(`Initialized ${this.scrapers.size} scrapers: ${Array.from(this.scrapers.keys()).join(', ')}`);
    }

    /**
     * URLからサイトを判定してスクレイパーを取得
     * @param {string} url - 商品URL
     * @returns {BaseScraper|null} 対応するスクレイパー
     */
    getScraperForUrl(url) {
        const hostname = new URL(url).hostname.replace('www.', '');

        for (const [site, scraper] of this.scrapers) {
            if (hostname.includes(site) || site.includes(hostname)) {
                return scraper;
            }
        }

        console.log(`No scraper found for site: ${hostname}`);
        return null;
    }

    /**
     * 商品情報を取得
     * @param {Object} productConfig - 商品設定
     * @returns {Promise<Object|null>} スクレイピング結果
     */
    async scrapeProduct(productConfig) {
        const scraper = this.getScraperForUrl(productConfig.url);

        if (!scraper) {
            console.log(`Unsupported site for URL: ${productConfig.url}`);
            return null;
        }

        try {
            const result = await scraper.scrapeProduct(productConfig);

            if (result) {
                console.log(`Successfully scraped ${scraper.siteName}: ¥${result.primaryPrice || result.price}`);
                return result;
            }

            return null;
        } catch (error) {
            console.error(`Error scraping with ${scraper.siteName}:`, error);
            return null;
        }
    }

    /**
     * 複数サイトから同じ商品の価格を比較取得
     * @param {Array} productConfigs - 複数サイトの商品設定
     * @returns {Promise<Array>} 各サイトの結果
     */
    async scrapeMultipleSites(productConfigs) {
        const results = [];

        for (const config of productConfigs) {
            console.log(`\nScraping ${config.url}...`);

            const result = await this.scrapeProduct(config);

            if (result) {
                results.push({
                    success: true,
                    site: result.site,
                    data: result
                });
            } else {
                results.push({
                    success: false,
                    site: this.getScraperForUrl(config.url)?.siteName || 'unknown',
                    error: 'Failed to scrape product'
                });
            }

            // レート制限対策
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        return results;
    }

    /**
     * 価格比較レポートを生成
     * @param {Array} results - スクレイピング結果
     * @param {string} productName - 商品名
     * @returns {Object} 比較レポート
     */
    generatePriceComparison(results, productName) {
        const successfulResults = results.filter(r => r.success);

        if (successfulResults.length === 0) {
            return {
                productName: productName,
                error: 'No successful results found',
                sites: []
            };
        }

        // 価格情報を整理
        const priceData = successfulResults.map(result => {
            const data = result.data;
            return {
                site: data.site,
                price: data.primaryPrice || data.price,
                priceTypes: data.priceTypes || ['retail'],
                allPrices: data.prices || { retail: data.price },
                currency: data.currency,
                productName: data.productName,
                imageUrl: data.imageUrl,
                scrapedAt: data.scrapedAt
            };
        });

        // 価格でソート（安い順）
        priceData.sort((a, b) => a.price - b.price);

        // 最安・最高価格を計算
        const prices = priceData.map(p => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

        return {
            productName: productName,
            sitesCompared: priceData.length,
            priceRange: {
                min: minPrice,
                max: maxPrice,
                average: avgPrice,
                spread: maxPrice - minPrice,
                spreadPercent: Math.round(((maxPrice - minPrice) / minPrice) * 100)
            },
            bestDeal: priceData[0], // 最安値のサイト
            sites: priceData,
            generatedAt: new Date().toISOString()
        };
    }

    /**
     * サポートサイト一覧を取得
     * @returns {Array} サポートサイト情報
     */
    getSupportedSites() {
        return Array.from(this.scrapers.entries()).map(([site, scraper]) => ({
            site: site,
            name: scraper.constructor.name,
            baseUrl: scraper.baseUrl
        }));
    }

    /**
     * 新しいスクレイパーを追加
     * @param {string} siteName - サイト名
     * @param {BaseScraper} scraperInstance - スクレイパーインスタンス
     */
    addScraper(siteName, scraperInstance) {
        this.scrapers.set(siteName, scraperInstance);
        console.log(`Added scraper for ${siteName}`);
    }

    /**
     * 統計情報を取得
     * @returns {Object} 統計情報
     */
    getStats() {
        return {
            totalScrapers: this.scrapers.size,
            supportedSites: Array.from(this.scrapers.keys()),
            lastInitialized: new Date().toISOString()
        };
    }
}

/**
 * 商品マッピング設定
 * 同じ商品の複数サイトでのURL設定
 */
export const PRODUCT_MAPPINGS = {
    'canadian-silver-maple-1oz': [
        {
            site: 'bullionstar.com',
            url: 'https://www.bullionstar.com/buy/product/silver-maple-leaf-1oz-various',
            name: 'Canadian Silver Maple Leaf 1oz'
        },
        {
            site: 'lpm.hk',
            url: 'https://www.lpm.hk/en/products/silver-coins/canadian-maple-leaf-1oz',
            name: 'Canadian Silver Maple Leaf 1oz'
        }
        // APMEXは地域制限のため一時的に無効化
        // {
        //     site: 'apmex.com',
        //     url: 'https://www.apmex.com/product/1090/1-oz-canadian-silver-maple-leaf-coin-bu-random-year',
        //     name: 'Canadian Silver Maple Leaf 1oz'
        // }
    ],
    'american-gold-eagle-1oz': [
        {
            site: 'bullionstar.com',
            url: 'https://www.bullionstar.com/buy/product/gold-eagle-1oz-various',
            name: 'American Gold Eagle 1oz'
        },
        {
            site: 'lpm.hk',
            url: 'https://www.lpm.hk/en/products/gold-coins/american-eagle-1oz',
            name: 'American Gold Eagle 1oz'
        }
        // APMEXは地域制限のため一時的に無効化
        // {
        //     site: 'apmex.com',
        //     url: 'https://www.apmex.com/product/99939/1-oz-american-gold-eagle-coin-bu-random-year',
        //     name: 'American Gold Eagle 1oz'
        // }
    ],
    'silver-bar-1kg': [
        {
            site: 'bullionstar.com',
            url: 'https://www.bullionstar.com/buy/product/silver-bullionstar-1kg',
            name: 'Silver Bar 1kg'
        },
        {
            site: 'lpm.hk',
            url: 'https://www.lpm.hk/en/products/silver-bars/generic-1kg',
            name: 'Silver Bar 1kg'
        }
        // APMEXは地域制限のため一時的に無効化
        // {
        //     site: 'apmex.com',
        //     url: 'https://www.apmex.com/product/101098/1-kilo-silver-bar-secondary-market',
        //     name: 'Silver Bar 1kg'
        // }
    ]
};

/**
 * 価格比較を実行
 * @param {string} productKey - 商品キー
 * @param {Object} browser - Playwrightブラウザ
 * @returns {Promise<Object>} 価格比較結果
 */
export async function compareProductPrices(productKey, browser) {
    const factory = new ScraperFactory(browser);
    const productConfigs = PRODUCT_MAPPINGS[productKey];

    if (!productConfigs) {
        throw new Error(`Product mapping not found for: ${productKey}`);
    }

    console.log(`\n=== Starting price comparison for: ${productKey} ===`);
    console.log(`Checking ${productConfigs.length} sites...`);

    const results = await factory.scrapeMultipleSites(productConfigs);
    const comparison = factory.generatePriceComparison(results, productConfigs[0].name);

    console.log(`\n=== Price Comparison Results ===`);
    console.log(`Product: ${comparison.productName}`);
    console.log(`Sites compared: ${comparison.sitesCompared}`);
    console.log(`Price range: ¥${comparison.priceRange.min.toLocaleString()} - ¥${comparison.priceRange.max.toLocaleString()}`);
    console.log(`Best deal: ${comparison.bestDeal.site} - ¥${comparison.bestDeal.price.toLocaleString()}`);

    return comparison;
}