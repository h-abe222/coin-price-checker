/**
 * Cloudflare Worker with D1 Database
 * 完全にWeb上で商品管理が可能
 */

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// 認証チェック
function checkAuth(request, env) {
  const auth = request.headers.get('Authorization');
  const password = env.ADMIN_PASSWORD || 'admin123';
  return auth === `Bearer ${password}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // プリフライトリクエスト
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 商品一覧取得
      if (path === '/api/products' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY created_at DESC"
        ).all();

        // 配列形式をオブジェクト形式に変換（互換性のため）
        const products = {};
        for (const product of results) {
          products[product.key] = product;
        }

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
        const { url: productUrl, name, selectors } = body;

        if (!productUrl) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // URLから商品キーを生成
        const urlObj = new URL(productUrl);
        const pathParts = urlObj.pathname.split('/');
        const productKey = pathParts[pathParts.length - 1] || `product-${Date.now()}`;

        // サイト名を取得
        const site = urlObj.hostname.replace('www.', '');

        try {
          // データベースに挿入
          const result = await env.DB.prepare(
            `INSERT INTO products (key, url, name, site, selectors, enabled, current_price)
             VALUES (?, ?, ?, ?, ?, 1, 0)`
          ).bind(
            productKey,
            productUrl,
            name || `新商品 - ${productKey}`,
            site,
            selectors ? JSON.stringify(selectors) : null
          ).run();

          // 挿入した商品を取得
          const { results } = await env.DB.prepare(
            "SELECT * FROM products WHERE id = ?"
          ).bind(result.meta.last_row_id).all();

          return new Response(JSON.stringify({
            success: true,
            product: results[0]
          }), {
            headers: corsHeaders
          });

        } catch (error) {
          if (error.message.includes('UNIQUE')) {
            return new Response(JSON.stringify({
              error: 'この商品は既に登録されています'
            }), {
              status: 400,
              headers: corsHeaders
            });
          }
          throw error;
        }
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

        const result = await env.DB.prepare(
          "DELETE FROM products WHERE key = ?"
        ).bind(productKey).run();

        if (result.meta.changes === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

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

        // 現在の状態を取得
        const { results: current } = await env.DB.prepare(
          "SELECT enabled FROM products WHERE key = ?"
        ).bind(productKey).all();

        if (current.length === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        // 状態を反転
        const newEnabled = !current[0].enabled;
        await env.DB.prepare(
          "UPDATE products SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?"
        ).bind(newEnabled ? 1 : 0, productKey).run();

        return new Response(JSON.stringify({
          success: true,
          enabled: newEnabled
        }), {
          headers: corsHeaders
        });
      }

      // 価格履歴取得
      if (path === '/api/prices' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT
            ph.*,
            p.name as product_name,
            p.key as product_key
           FROM price_history ph
           JOIN products p ON ph.product_id = p.id
           ORDER BY ph.recorded_at DESC
           LIMIT 1000`
        ).all();

        return new Response(JSON.stringify({
          prices: results,
          last_update: results[0]?.recorded_at || null
        }), {
          headers: corsHeaders
        });
      }

      // 価格更新（Playwrightから呼ばれる）
      if (path === '/api/update-prices' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const body = await request.json();
        const { updates } = body; // [{key: 'xxx', price: 123}, ...]

        if (!updates || !Array.isArray(updates)) {
          return new Response(JSON.stringify({ error: 'Invalid updates format' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const changes = [];

        for (const update of updates) {
          // 商品を更新（価格、商品名、画像URL）
          let sql = `UPDATE products SET current_price = ?, updated_at = CURRENT_TIMESTAMP`;
          let params = [update.price];

          if (update.name) {
            sql += `, name = ?`;
            params.push(update.name);
          }

          if (update.imageUrl) {
            sql += `, image_url = ?`;
            params.push(update.imageUrl);
          }

          sql += ` WHERE key = ?`;
          params.push(update.key);

          const result = await env.DB.prepare(sql).bind(...params).run();

          if (result.meta.changes > 0) {
            // 商品IDを取得
            const { results: product } = await env.DB.prepare(
              "SELECT id, name FROM products WHERE key = ?"
            ).bind(update.key).all();

            if (product.length > 0) {
              // 価格履歴に追加
              await env.DB.prepare(
                "INSERT INTO price_history (product_id, price, currency) VALUES (?, ?, ?)"
              ).bind(product[0].id, update.price, update.currency || 'JPY').run();

              changes.push({
                product: product[0].name,
                price: update.price
              });
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          updated: changes.length,
          changes: changes
        }), {
          headers: corsHeaders
        });
      }

      // 商品検索
      if (path === '/api/search' && request.method === 'GET') {
        const params = url.searchParams;
        const query = params.get('q') || '';
        const site = params.get('site') || '';

        let sql = "SELECT * FROM products WHERE 1=1";
        const bindings = [];

        if (query) {
          sql += " AND (name LIKE ? OR url LIKE ?)";
          bindings.push(`%${query}%`, `%${query}%`);
        }

        if (site) {
          sql += " AND site = ?";
          bindings.push(site);
        }

        sql += " ORDER BY created_at DESC";

        const stmt = env.DB.prepare(sql);
        if (bindings.length > 0) {
          stmt.bind(...bindings);
        }

        const { results } = await stmt.all();

        return new Response(JSON.stringify(results), {
          headers: corsHeaders
        });
      }

      // 統計情報
      if (path === '/api/stats' && request.method === 'GET') {
        const [totalProducts, enabledProducts, totalPrices, sites] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) as count FROM products").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM products WHERE enabled = 1").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM price_history").first(),
          env.DB.prepare("SELECT DISTINCT site FROM products WHERE site IS NOT NULL").all()
        ]);

        return new Response(JSON.stringify({
          total_products: totalProducts.count,
          enabled_products: enabledProducts.count,
          total_price_records: totalPrices.count,
          sites: sites.results.map(s => s.site)
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
      console.error('Worker error:', error);
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