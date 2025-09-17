import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { chromium } from 'playwright';

const app = express();
const PORT = 8083;

app.use(cors());
app.use(express.json());

// 価格取得API
app.post('/api/fetch-price', async (req, res) => {
    const { url, siteName } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Fetching price from: ${url} (${siteName})`);

    try {
        let price = null;

        // YBXサイトの場合はPlaywrightを使用
        if (url.includes('ybx.jp')) {
            const browser = await chromium.launch({
                headless: true,
                args: ['--lang=ja-JP']
            });

            try {
                const page = await browser.newPage();
                await page.goto(url, { waitUntil: 'domcontentloaded' });
                await page.waitForTimeout(2000);

                // 価格を取得
                price = await page.evaluate(() => {
                    // 複数の価格パターンを試す
                    const patterns = [
                        // パターン1: 価格表示領域
                        /価格[:：]\s*([\d,]+)円/,
                        // パターン2: 販売価格
                        /販売価格[:：]\s*([\d,]+)円/,
                        // パターン3: 通常の円表記
                        /([\d,]+)円/,
                        // パターン4: ￥記号付き
                        /[￥¥]([\d,]+)/
                    ];

                    const bodyText = document.body.textContent || '';

                    for (const pattern of patterns) {
                        const matches = bodyText.match(pattern);
                        if (matches && matches[1]) {
                            const priceStr = matches[1].replace(/,/g, '');
                            const priceNum = parseInt(priceStr);
                            // 妥当な価格範囲をチェック（1000円以上、1億円未満）
                            if (priceNum >= 1000 && priceNum < 100000000) {
                                return priceNum;
                            }
                        }
                    }

                    // 価格要素を直接探す
                    const priceElements = document.querySelectorAll('.price, .product-price, .item-price, [class*="price"]');
                    for (const element of priceElements) {
                        const text = element.textContent || '';
                        const match = text.match(/([\d,]+)/);
                        if (match) {
                            const priceNum = parseInt(match[1].replace(/,/g, ''));
                            if (priceNum >= 1000 && priceNum < 100000000) {
                                return priceNum;
                            }
                        }
                    }

                    return null;
                });

                console.log(`YBX price found: ${price}`);
            } finally {
                await browser.close();
            }
        }
        // APMEXサイトの場合
        else if (url.includes('apmex.com')) {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const html = await response.text();

                // APMEXの価格パターンを複数試す
                const patterns = [
                    /data-price="([\d.]+)"/,
                    /class="price[^"]*"[^>]*>\s*\$([\d,]+\.?\d*)/,
                    /\$\s*([\d,]+\.?\d*)/
                ];

                for (const pattern of patterns) {
                    const match = html.match(pattern);
                    if (match) {
                        const usdPrice = parseFloat(match[1].replace(/,/g, ''));
                        price = Math.round(usdPrice * 150); // USD to JPY (簡易レート)
                        console.log(`APMEX price found: $${usdPrice} = ¥${price}`);
                        break;
                    }
                }
            }
        }
        // その他のサイト
        else {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (response.ok) {
                const html = await response.text();

                // 一般的な価格パターン
                const patterns = [
                    /(?:¥|￥|円|JPY)\s*([\d,]+(?:\.\d{2})?)/i,
                    /([\d,]+)\s*円/,
                    /price[^>]*>([\d,]+)/i
                ];

                for (const pattern of patterns) {
                    const match = html.match(pattern);
                    if (match) {
                        price = parseFloat(match[1].replace(/,/g, ''));
                        console.log(`Price found: ¥${price}`);
                        break;
                    }
                }
            }
        }

        if (price && price > 0) {
            res.json({
                success: true,
                price: price,
                currency: 'JPY',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                error: 'Price not found on page',
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('Error fetching price:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'price-update-proxy' });
});

app.listen(PORT, () => {
    console.log(`Price Update Proxy Server running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  POST http://localhost:${PORT}/api/fetch-price`);
    console.log(`  GET  http://localhost:${PORT}/health`);
});