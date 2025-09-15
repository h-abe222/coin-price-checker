// Vercel Serverless Function for product management
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  // 認証チェック
  const auth = req.headers.authorization;
  const isAuthenticated = auth === `Bearer ${ADMIN_PASSWORD}`;

  try {
    // 商品一覧取得
    if (req.method === 'GET') {
      const products = await kv.get('products') || {};
      return res.status(200).json(products);
    }

    // 認証が必要な操作
    if (!isAuthenticated) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 商品追加
    if (req.method === 'POST') {
      const { url, name } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      // URLから商品キーを抽出
      const match = url.match(/product\/([^\/]+)/);
      if (!match) {
        return res.status(400).json({ error: 'Invalid BullionStar URL' });
      }

      const productKey = match[1];
      const products = await kv.get('products') || {};

      if (products[productKey]) {
        return res.status(400).json({ error: 'Product already exists' });
      }

      // 商品を追加
      products[productKey] = {
        id: Date.now(),
        url: url,
        name: name || `新商品 - ${productKey}`,
        enabled: true,
        added_at: new Date().toISOString()
      };

      await kv.set('products', products);

      return res.status(200).json({
        success: true,
        product: products[productKey]
      });
    }

    // 商品削除
    if (req.method === 'DELETE') {
      const { productKey } = req.query;

      if (!productKey) {
        return res.status(400).json({ error: 'Product key is required' });
      }

      const products = await kv.get('products') || {};

      if (!products[productKey]) {
        return res.status(404).json({ error: 'Product not found' });
      }

      delete products[productKey];
      await kv.set('products', products);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}