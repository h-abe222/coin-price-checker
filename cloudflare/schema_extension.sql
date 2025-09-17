-- データベーススキーマ拡張: 複数サイト価格並列表示対応
-- 実行日: 2025-09-15

-- 既存のproductsテーブルに新しいカラムを追加
ALTER TABLE products ADD COLUMN site_prices TEXT; -- JSON: サイト別価格データ
ALTER TABLE products ADD COLUMN site_urls TEXT;   -- JSON: サイト別URL
ALTER TABLE products ADD COLUMN best_site TEXT;   -- 最安値サイト名
ALTER TABLE products ADD COLUMN image_url TEXT;   -- 商品画像URL（既存の場合はスキップ）
ALTER TABLE products ADD COLUMN price_spread_percent INTEGER; -- 価格差(%)
ALTER TABLE products ADD COLUMN total_sites INTEGER;          -- 対応サイト数

-- site_pricesカラムのJSONスキーマ例:
-- {
--   "bullionstar.com": {
--     "price": 5835,
--     "currency": "JPY",
--     "updated_at": "2025-09-15T12:00:00Z",
--     "price_types": {
--       "retail": 5835
--     },
--     "status": "success"
--   },
--   "lpm.hk": {
--     "price": 6100,
--     "currency": "JPY",
--     "updated_at": "2025-09-15T12:00:00Z",
--     "price_types": {
--       "retail": 6100,
--       "bulk_5": 6050,
--       "bulk_100": 5950
--     },
--     "status": "success"
--   }
-- }

-- site_urlsカラムのJSONスキーマ例:
-- {
--   "bullionstar.com": "https://www.bullionstar.com/buy/product/silver-maple-leaf-1oz-various",
--   "lpm.hk": "https://www.lpm.hk/en/products/silver-coins/canadian-maple-leaf-1oz",
--   "apmex.com": "https://www.apmex.com/product/12345/canadian-silver-maple"
-- }

-- 新しいインデックス追加
CREATE INDEX IF NOT EXISTS idx_products_best_site ON products(best_site);
CREATE INDEX IF NOT EXISTS idx_products_total_sites ON products(total_sites);

-- 複数サイト価格比較用のビュー作成
CREATE VIEW IF NOT EXISTS v_product_comparison AS
SELECT
  id,
  key,
  name,
  current_price,
  best_site,
  total_sites,
  price_spread_percent,
  site_prices,
  site_urls,
  image_url,
  updated_at,
  -- 最安値との差額計算用の仮想カラム
  CASE
    WHEN site_prices IS NOT NULL
    THEN json_extract(site_prices, '$.' || replace(best_site, '.', '_') || '.price')
    ELSE current_price
  END as best_price
FROM products
WHERE total_sites > 1  -- 複数サイト対応商品のみ
ORDER BY name;

-- データ整合性チェック用のビュー
CREATE VIEW IF NOT EXISTS v_data_integrity_check AS
SELECT
  id,
  key,
  name,
  CASE
    WHEN site_prices IS NULL THEN 'Missing site_prices'
    WHEN site_urls IS NULL THEN 'Missing site_urls'
    WHEN best_site IS NULL THEN 'Missing best_site'
    WHEN total_sites IS NULL OR total_sites = 0 THEN 'Invalid total_sites'
    ELSE 'OK'
  END as status,
  total_sites,
  best_site
FROM products
WHERE status != 'OK';  -- 問題のあるレコードのみ表示