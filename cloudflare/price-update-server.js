/**
 * 価格更新サーバー
 * ローカルまたはVPS上で動作させる
 * Web UIからのリクエストを受けて価格を更新
 */

import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { BullionStarScraper } from './scrapers/bullionstar_scraper.js';
import { APMEXScraper } from './scrapers/apmex_scraper.js';
import { LPMScraper } from './scrapers/lpm_scraper.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.UPDATE_SERVER_PORT || 3001;
const WORKER_URL = process.env.WORKER_URL || 'https://coin-price-checker.h-abe.workers.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const API_KEY = process.env.UPDATE_API_KEY || 'update-key-123';

// 認証ミドルウェア
function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// スクレイパー選択
function getScraperForUrl(url, browser) {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('bullionstar.com')) {
        return new BullionStarScraper(browser);
    } else if (hostname.includes('lpm.hk')) {
        return new LPMScraper(browser);
    } else if (hostname.includes('apmex.com')) {
        return new APMEXScraper(browser);
    }

    return null;
}

// 価格更新処理
async function updateProductPrice(productKey) {
    const browser = await chromium.launch({ headless: true });

    try {
        // 商品情報を取得
        const response = await fetch(`${WORKER_URL}/api/products`);
        const products = await response.json();
        const product = products[productKey];

        if (!product) {
            throw new Error('Product not found');
        }

        const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
        const sitePrices = {};
        let bestPrice = Infinity;
        let bestSite = '';

        // 各URLから価格を取得
        for (const [siteKey, url] of Object.entries(siteUrls)) {
            const scraper = getScraperForUrl(url, browser);
            if (!scraper) continue;

            try {
                const result = await scraper.scrapeProduct({
                    url: url,
                    name: product.name
                });

                if (result && (result.price || result.primaryPrice)) {
                    const price = result.price || result.primaryPrice;
                    sitePrices[siteKey] = {
                        price: price,
                        currency: result.currency || 'JPY',
                        updated_at: new Date().toISOString(),
                        status: 'success'
                    };

                    if (price < bestPrice) {
                        bestPrice = price;
                        bestSite = siteKey.replace(/_/g, '.');
                    }
                }
            } catch (error) {
                console.error(`Error scraping ${siteKey}:`, error);
                sitePrices[siteKey] = {
                    price: 0,
                    currency: 'JPY',
                    updated_at: new Date().toISOString(),
                    status: 'error',
                    error: error.message
                };
            }
        }

        // データベースを更新
        const updateResponse = await fetch(`${WORKER_URL}/api/update-multi-site-product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ADMIN_PASSWORD}`
            },
            body: JSON.stringify({
                key: productKey,
                name: product.name,
                current_price: bestPrice === Infinity ? 0 : bestPrice,
                currency: 'JPY',
                site_prices: JSON.stringify(sitePrices),
                site_urls: JSON.stringify(siteUrls),
                best_site: bestSite || null,
                image_url: product.image_url
            })
        });

        const updateResult = await updateResponse.json();
        return {
            success: updateResult.success,
            productKey: productKey,
            prices: sitePrices,
            bestPrice: bestPrice === Infinity ? 0 : bestPrice,
            bestSite: bestSite
        };

    } finally {
        await browser.close();
    }
}

// API エンドポイント

// 単一商品の価格更新
app.post('/api/update-price/:productKey', authenticate, async (req, res) => {
    try {
        const result = await updateProductPrice(req.params.productKey);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 全商品の価格更新
app.post('/api/update-all-prices', authenticate, async (req, res) => {
    try {
        const response = await fetch(`${WORKER_URL}/api/products`);
        const products = await response.json();
        const productKeys = Object.keys(products);

        let updated = 0;
        let failed = 0;
        const results = [];

        for (const key of productKeys) {
            try {
                const result = await updateProductPrice(key);
                if (result.success) {
                    updated++;
                } else {
                    failed++;
                }
                results.push(result);
            } catch (error) {
                failed++;
                results.push({ productKey: key, error: error.message });
            }
        }

        res.json({
            success: true,
            updated: updated,
            failed: failed,
            total: productKeys.length,
            results: results
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`Price update server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});