/**
 * Web UIから価格更新可能なWorker
 * 外部価格APIサービスを使用
 */

// 価格取得APIエンドポイント（簡易版）
async function fetchPriceFromAPI(url, siteName) {
    try {
        // BullionStarのAPIを直接呼び出す（公開APIがある場合）
        if (siteName === 'BullionStar') {
            // BullionStarの価格ページから直接取得を試みる
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; PriceChecker/1.0)'
                }
            });

            if (!response.ok) return null;

            const html = await response.text();

            // 簡易的な価格抽出（正規表現）
            const priceMatch = html.match(/¥[\d,]+(?:\.\d{2})?/);
            if (priceMatch) {
                const price = parseFloat(priceMatch[0].replace(/[¥,]/g, ''));
                return {
                    price: price,
                    currency: 'JPY',
                    timestamp: new Date().toISOString()
                };
            }
        }

        // その他のサイトは価格比較APIサービスを使用
        // 例：CoinGecko API、MetalPrices API など

        return null;
    } catch (error) {
        console.error(`Price fetch error for ${siteName}:`, error);
        return null;
    }
}

// 単一商品の価格更新
async function updateSingleProductPrice(env, productKey) {
    try {
        // 商品情報を取得
        const { results } = await env.DB.prepare(
            "SELECT * FROM products WHERE key = ?"
        ).bind(productKey).all();

        if (results.length === 0) {
            return { error: 'Product not found' };
        }

        const product = results[0];
        const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
        const sitePrices = {};
        let bestPrice = Infinity;
        let bestSite = '';

        // 各URLから価格を取得
        for (const [siteKey, url] of Object.entries(siteUrls)) {
            const siteName = siteKey.replace(/_/g, '.');
            const priceData = await fetchPriceFromAPI(url, siteName);

            if (priceData && priceData.price) {
                sitePrices[siteKey] = {
                    price: priceData.price,
                    currency: priceData.currency,
                    updated_at: priceData.timestamp,
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
        }

        // データベースを更新
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
                productKey
            ).run();

            return {
                success: true,
                productKey: productKey,
                updated: Object.keys(sitePrices).length,
                bestPrice: bestPrice === Infinity ? 0 : bestPrice,
                bestSite: bestSite
            };
        }

        return { error: 'No prices could be fetched' };

    } catch (error) {
        console.error('Update error:', error);
        return { error: error.message };
    }
}

// Worker のfetch関数に追加するエンドポイント
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // 価格更新APIエンドポイント
        if (path.startsWith('/api/update-price/') && request.method === 'POST') {
            // 認証チェック
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || !authHeader.includes(env.ADMIN_PASSWORD)) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const productKey = path.split('/').pop();
            const result = await updateSingleProductPrice(env, productKey);

            return new Response(JSON.stringify(result), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 全商品価格更新
        if (path === '/api/update-all-prices' && request.method === 'POST') {
            // 認証チェック
            const authHeader = request.headers.get('Authorization');
            if (!authHeader || !authHeader.includes(env.ADMIN_PASSWORD)) {
                return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // 全商品を取得
            const { results } = await env.DB.prepare(
                "SELECT key FROM products WHERE enabled = 1"
            ).all();

            let updated = 0;
            let failed = 0;

            // 各商品を更新（並列処理）
            const updatePromises = results.map(async (product) => {
                const result = await updateSingleProductPrice(env, product.key);
                if (result.success) {
                    updated++;
                } else {
                    failed++;
                }
                return result;
            });

            await Promise.all(updatePromises);

            return new Response(JSON.stringify({
                success: true,
                updated: updated,
                failed: failed,
                total: results.length
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 既存のエンドポイント処理...
        return new Response('Not Found', { status: 404 });
    }
};