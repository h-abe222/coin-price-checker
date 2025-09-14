/**
 * Cloudflare Worker - Coin Price Checker API
 * KVストレージを使用した商品管理と価格取得API
 */

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// 認証チェック
function checkAuth(request, env) {
  const auth = request.headers.get('Authorization');
  const password = env.ADMIN_PASSWORD || 'admin123';
  return auth === `Bearer ${password}`;
}

// 価格を取得する関数
async function fetchPrice(productUrl) {
  try {
    // BullionStar APIから価格を取得
    const productIdMatch = productUrl.match(/product\/([^\/]+)/);
    if (!productIdMatch) return 0;

    const productKey = productIdMatch[1];

    // BullionStarの商品ページから価格を取得
    // 注: CloudflareワーカーからはAPIエンドポイントを直接呼ぶ
    const apiUrl = `https://www.bullionstar.com/api/products/detail/${productKey}?currency=JPY`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CoinPriceChecker/1.0)'
      }
    });

    if (!response.ok) {
      // APIが利用できない場合は、HTMLから価格を取得
      const htmlResponse = await fetch(productUrl);
      const html = await htmlResponse.text();

      // 価格を正規表現で抽出（BullionStarのHTML構造に依存）
      const priceMatch = html.match(/data-price-jpy="(\d+)"|price['"]:[\s]*(\d+)|¥[\s]*([\d,]+)/);
      if (priceMatch) {
        const price = priceMatch[1] || priceMatch[2] || priceMatch[3].replace(/,/g, '');
        return parseInt(price) || 0;
      }
    } else {
      const data = await response.json();
      return data.price || 0;
    }
  } catch (error) {
    console.error('Price fetch error:', error);
  }
  return 0;
}

// リクエストハンドラー
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // プリフライトリクエスト
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ルーティング
    try {
      // 商品一覧取得
      if (path === '/api/products' && request.method === 'GET') {
        const products = await env.PRODUCTS.get('all', { type: 'json' }) || {};
        return new Response(JSON.stringify(products), {
          headers: corsHeaders
        });
      }

      // 商品追加
      if (path === '/api/products' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const body = await request.json();
        const { url: productUrl, name } = body;

        if (!productUrl) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // URLから商品キーを抽出
        const match = productUrl.match(/product\/([^\/]+)/);
        if (!match) {
          return new Response(JSON.stringify({ error: 'Invalid BullionStar URL' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const productKey = match[1];
        const products = await env.PRODUCTS.get('all', { type: 'json' }) || {};

        if (products[productKey]) {
          return new Response(JSON.stringify({ error: 'Product already exists' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // 価格を取得
        const price = await fetchPrice(productUrl);

        // 新商品を追加
        products[productKey] = {
          id: Date.now(),
          url: productUrl,
          name: name || `新商品 - ${productKey}`,
          enabled: true,
          current_price: price,
          added_at: new Date().toISOString(),
          last_updated: new Date().toISOString()
        };

        // KVに保存
        await env.PRODUCTS.put('all', JSON.stringify(products));

        return new Response(JSON.stringify({
          success: true,
          product: products[productKey]
        }), {
          headers: corsHeaders
        });
      }

      // 商品削除
      if (path.startsWith('/api/products/') && request.method === 'DELETE') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const productKey = path.split('/').pop();
        const products = await env.PRODUCTS.get('all', { type: 'json' }) || {};

        if (!products[productKey]) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        delete products[productKey];
        await env.PRODUCTS.put('all', JSON.stringify(products));

        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders
        });
      }

      // 商品の有効/無効切り替え
      if (path.startsWith('/api/products/') && path.endsWith('/toggle') && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const productKey = path.split('/')[3];
        const products = await env.PRODUCTS.get('all', { type: 'json' }) || {};

        if (!products[productKey]) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        products[productKey].enabled = !products[productKey].enabled;
        await env.PRODUCTS.put('all', JSON.stringify(products));

        return new Response(JSON.stringify({
          success: true,
          enabled: products[productKey].enabled
        }), {
          headers: corsHeaders
        });
      }

      // 価格履歴取得
      if (path === '/api/prices' && request.method === 'GET') {
        const history = await env.PRODUCTS.get('price_history', { type: 'json' }) || {
          prices: [],
          last_update: null
        };
        return new Response(JSON.stringify(history), {
          headers: corsHeaders
        });
      }

      // 全商品の価格を更新
      if (path === '/api/update-prices' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const products = await env.PRODUCTS.get('all', { type: 'json' }) || {};
        const updatedProducts = {};
        const priceUpdates = [];

        for (const [key, product] of Object.entries(products)) {
          if (product.enabled) {
            const newPrice = await fetchPrice(product.url);
            updatedProducts[key] = {
              ...product,
              current_price: newPrice,
              last_updated: new Date().toISOString()
            };

            if (newPrice !== product.current_price) {
              priceUpdates.push({
                product: product.name,
                old_price: product.current_price,
                new_price: newPrice,
                change: newPrice - product.current_price
              });
            }
          } else {
            updatedProducts[key] = product;
          }
        }

        // 更新された商品を保存
        await env.PRODUCTS.put('all', JSON.stringify(updatedProducts));

        // 価格履歴を更新
        const history = await env.PRODUCTS.get('price_history', { type: 'json' }) || {
          prices: [],
          last_update: null
        };

        const timestamp = new Date().toISOString();
        for (const [key, product] of Object.entries(updatedProducts)) {
          if (product.enabled && product.current_price > 0) {
            history.prices.push({
              product_key: key,
              product_name: product.name,
              price: product.current_price,
              timestamp: timestamp
            });
          }
        }

        history.last_update = timestamp;
        // 履歴は最新1000件のみ保持
        if (history.prices.length > 1000) {
          history.prices = history.prices.slice(-1000);
        }

        await env.PRODUCTS.put('price_history', JSON.stringify(history));

        return new Response(JSON.stringify({
          success: true,
          updated: Object.keys(updatedProducts).length,
          changes: priceUpdates
        }), {
          headers: corsHeaders
        });
      }

      // 404
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};