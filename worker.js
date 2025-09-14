/**
 * Cloudflare Worker - BullionStar Price Monitor API
 * KVストレージを使用した商品管理API
 */

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// 認証チェック
function checkAuth(request) {
  const auth = request.headers.get('Authorization');
  const password = ADMIN_PASSWORD || 'admin123';
  return auth === `Bearer ${password}`;
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
        if (!checkAuth(request)) {
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

        // 新商品を追加
        products[productKey] = {
          id: Date.now(),
          url: productUrl,
          name: name || `新商品 - ${productKey}`,
          enabled: true,
          current_price: 0,
          added_at: new Date().toISOString()
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
        if (!checkAuth(request)) {
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
        if (!checkAuth(request)) {
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