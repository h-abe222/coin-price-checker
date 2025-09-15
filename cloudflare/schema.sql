-- 商品テーブル
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  current_price REAL DEFAULT 0,
  currency TEXT DEFAULT 'JPY',
  site TEXT,
  selectors TEXT, -- JSON形式でカスタムセレクターを保存
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 価格履歴テーブル
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'JPY',
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_products_key ON products(key);
CREATE INDEX IF NOT EXISTS idx_products_enabled ON products(enabled);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);