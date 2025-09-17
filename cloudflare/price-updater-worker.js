/**
 * Cloudflare Worker で価格更新
 * Puppeteer Core + Chrome AWS Lambda を使用
 */

// 簡易的な価格取得（HTMLパース）
async function fetchPriceFromSite(url, siteName) {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en;q=0.9',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // サイト別の価格抽出ロジック
        let price = null;
        let currency = 'JPY';

        if (siteName.includes('bullionstar')) {
            // BullionStar の価格パターンを検索
            const patterns = [
                /class="price"[^>]*>([^<]+)</,
                /¥([\d,]+(?:\.\d{2})?)/,
                /"price":\s*"?([\d,]+(?:\.\d{2})?)"?/,
                /data-price="([\d,]+(?:\.\d{2})?)"/
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    const priceText = match[1] || match[0];
                    price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                    if (price > 0 && price < 10000000) { // 妥当な価格範囲
                        break;
                    }
                }
            }
        } else if (siteName.includes('apmex')) {
            // APMEX の価格パターン
            const patterns = [
                /\$?([\d,]+\.\d{2})/,
                /class="product-price"[^>]*>\$?([\d,]+\.\d{2})</,
                /data-product-price="([\d,]+\.\d{2})"/
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    price = parseFloat(match[1].replace(/,/g, ''));
                    currency = 'USD';
                    if (price > 0 && price < 100000) {
                        // USD to JPY 変換（固定レート使用）
                        price = Math.round(price * 150);
                        currency = 'JPY';
                        break;
                    }
                }
            }
        } else if (siteName.includes('lpm')) {
            // LPM の価格パターン
            const patterns = [
                /HK\$?([\d,]+(?:\.\d{2})?)/,
                /class="price"[^>]*>HK\$?([\d,]+(?:\.\d{2})?)</
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                    price = parseFloat(match[1].replace(/,/g, ''));
                    // HKD to JPY 変換（固定レート使用）
                    price = Math.round(price * 19);
                    currency = 'JPY';
                    if (price > 0 && price < 10000000) {
                        break;
                    }
                }
            }
        }

        return price ? { price, currency } : null;

    } catch (error) {
        console.error(`Error fetching ${siteName}:`, error.message);
        return null;
    }
}

// 商品価格更新
async function updateProductPrices(env, product) {
    const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
    const sitePrices = {};
    let bestPrice = Infinity;
    let bestSite = '';

    for (const [siteKey, url] of Object.entries(siteUrls)) {
        const siteName = siteKey.replace(/_/g, '.');
        const priceData = await fetchPriceFromSite(url, siteName);

        if (priceData) {
            sitePrices[siteKey] = {
                price: priceData.price,
                currency: priceData.currency,
                updated_at: new Date().toISOString(),
                status: 'success'
            };

            if (priceData.price < bestPrice) {
                bestPrice = priceData.price;
                bestSite = siteName;
            }
        } else {
            sitePrices[siteKey] = {
                price: 0,
                currency: 'JPY',
                updated_at: new Date().toISOString(),
                status: 'failed'
            };
        }

        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // データベース更新
    if (Object.keys(sitePrices).length > 0) {
        await env.DB.prepare(`
            UPDATE products
            SET site_prices = ?,
                current_price = ?,
                best_site = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
        `).bind(
            JSON.stringify(sitePrices),
            bestPrice === Infinity ? 0 : bestPrice,
            bestSite || null,
            product.key
        ).run();

        return true;
    }

    return false;
}

export default {
    // 通常のHTTPリクエスト処理
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 手動トリガーエンドポイント
        if (url.pathname === '/trigger-update') {
            // 認証チェック
            const auth = request.headers.get('Authorization');
            if (!auth || !auth.includes(env.ADMIN_PASSWORD)) {
                return new Response('Unauthorized', { status: 401 });
            }

            // scheduled 関数を手動実行
            await this.scheduled(null, env, ctx);

            return new Response(JSON.stringify({
                success: true,
                message: '価格更新を開始しました'
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        return new Response('Price Updater Worker', { status: 200 });
    },

    // Cron トリガーで定期実行
    async scheduled(event, env, ctx) {
        console.log('Starting scheduled price update...');

        try {
            // 更新リクエストをチェック
            const updateRequest = await env.PRODUCTS.get('update_request');
            const forceUpdate = updateRequest ? JSON.parse(updateRequest).status === 'pending' : false;

            // 定期実行時間または手動リクエストがある場合のみ実行
            const now = new Date();
            const hour = now.getUTCHours();
            const shouldUpdate = forceUpdate || hour === 0 || hour === 12; // UTC 0時と12時 = JST 9時と21時

            if (!shouldUpdate && !forceUpdate) {
                console.log('Skipping update - not scheduled time');
                return;
            }

            // 全商品を取得
            const { results } = await env.DB.prepare(
                "SELECT * FROM products WHERE enabled = 1"
            ).all();

            let successCount = 0;
            let failCount = 0;

            // 各商品の価格を更新
            for (const product of results) {
                try {
                    const updated = await updateProductPrices(env, product);
                    if (updated) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (error) {
                    console.error(`Error updating ${product.name}:`, error);
                    failCount++;
                }
            }

            // 更新リクエストをクリア
            if (forceUpdate) {
                await env.PRODUCTS.delete('update_request');
            }

            // 更新履歴を保存
            const updateHistory = {
                updated_at: new Date().toISOString(),
                success: successCount,
                failed: failCount,
                total: results.length,
                triggered_by: forceUpdate ? 'manual' : 'scheduled'
            };

            await env.PRODUCTS.put('last_update', JSON.stringify(updateHistory));

            console.log(`Update completed: ${successCount} success, ${failCount} failed`);

        } catch (error) {
            console.error('Scheduled update error:', error);
        }
    }
};