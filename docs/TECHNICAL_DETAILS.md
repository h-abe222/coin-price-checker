# 技術仕様書 - コイン価格チェッカー

## 🏗️ システム構成

### アーキテクチャ概要
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub Pages  │    │ Cloudflare      │    │   BullionStar   │
│   (Frontend)    │────│ Workers + D1    │────│   (Target Site) │
│                 │    │ (Backend/API)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                │
                        ┌─────────────────┐
                        │   Playwright    │
                        │ (Price Scraper) │
                        └─────────────────┘
```

---

## 📋 API仕様

### Base URL
- **Production**: `https://coin-price-checker.h-abe.workers.dev`
- **Development**: `http://localhost:8787`

### 認証方式
```http
Authorization: Bearer {ADMIN_PASSWORD}
```

### エンドポイント一覧

#### 1. 商品管理

**GET /api/products**
```json
// Response
{
  "product-key": {
    "id": 1,
    "key": "product-key",
    "url": "https://...",
    "name": "Product Name",
    "current_price": 12345,
    "image_url": "https://...",
    "enabled": true,
    "created_at": "2025-09-15T00:00:00Z"
  }
}
```

**POST /api/products**
```json
// Request
{
  "url": "https://www.bullionstar.com/buy/product/...",
  "name": "Product Name (optional)"
}

// Response
{
  "success": true,
  "product": { /* product object */ }
}
```

**DELETE /api/products/{key}**
```json
// Response
{
  "success": true
}
```

**POST /api/products/{key}/toggle**
```json
// Response
{
  "success": true,
  "enabled": false
}
```

#### 2. 価格更新

**POST /api/update-prices**
```json
// Request
{
  "updates": [
    {
      "key": "product-key",
      "price": 12345,
      "currency": "JPY",
      "name": "Updated Product Name",
      "imageUrl": "https://..."
    }
  ]
}

// Response
{
  "success": true,
  "updated": 1,
  "changes": [
    {
      "product": "Product Name",
      "price": 12345
    }
  ]
}
```

#### 3. 価格履歴

**GET /api/prices**
```json
// Response
{
  "prices": [
    {
      "id": 1,
      "product_id": 1,
      "price": 12345,
      "currency": "JPY",
      "recorded_at": "2025-09-15T00:00:00Z",
      "product_name": "Product Name",
      "product_key": "product-key"
    }
  ],
  "last_update": "2025-09-15T00:00:00Z"
}
```

#### 4. 検索・統計

**GET /api/search?q={query}&site={site}**
```json
// Response
[
  {
    "id": 1,
    "key": "product-key",
    "name": "Product Name",
    "url": "https://...",
    "site": "bullionstar.com"
  }
]
```

**GET /api/stats**
```json
// Response
{
  "total_products": 10,
  "enabled_products": 8,
  "total_price_records": 150,
  "sites": ["bullionstar.com", "apmex.com"]
}
```

---

## 🎨 フロントエンド仕様

### UI Components

#### 1. ログイン画面
```html
<div id="loginScreen">
  <input type="password" id="password" />
  <button onclick="login()">ログイン</button>
</div>
```

#### 2. メインダッシュボード
```html
<div id="mainScreen">
  <header class="gradient-bg">
    <h1>コイン価格チェッカー</h1>
  </header>

  <!-- ステータスバー -->
  <div class="status-bar">
    <div>監視中: <span id="activeCount">0</span></div>
    <div>総数: <span id="totalCount">0</span></div>
    <div>最終更新: <span id="lastUpdate">--:--</span></div>
  </div>

  <!-- タブメニュー -->
  <nav class="tabs">
    <button onclick="showTab('products')">アイテム一覧</button>
    <button onclick="showTab('add')">新規登録</button>
    <button onclick="showTab('settings')">API設定</button>
  </nav>
</div>
```

#### 3. 商品リスト表示
```html
<div class="product-item">
  <img src="{image_url}" class="w-16 h-16" />
  <div class="product-info">
    <h3>{product_name}</h3>
    <a href="{product_url}">商品ページを開く</a>
  </div>
  <div class="product-price">¥{price}</div>
  <div class="product-actions">
    <button onclick="toggleProduct('{key}')">切替</button>
    <button onclick="deleteProduct('{key}')">削除</button>
  </div>
</div>
```

### CSS フレームワーク
- **Tailwind CSS 2.2.19**: ユーティリティファースト
- **Font Awesome 6.0.0**: アイコンライブラリ
- **カスタムCSS**: グラデーション、アニメーション

### JavaScript 機能
```javascript
// 主要関数
async function login()          // ログイン処理
async function loadProducts()   // 商品一覧読み込み
async function addProduct()     // 商品追加
async function deleteProduct()  // 商品削除
async function toggleProduct()  // 有効/無効切替
function showTab()             // タブ切替
function saveSettings()        // 設定保存
```

---

## 🗄️ データベース設計

### テーブル構造

#### products
```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,           -- URL由来のユニークキー
    url TEXT NOT NULL,                  -- 商品URL
    name TEXT,                          -- 商品名
    site TEXT,                          -- サイト名（例：bullionstar.com）
    current_price INTEGER DEFAULT 0,    -- 現在価格（円）
    image_url TEXT,                     -- 商品画像URL
    enabled INTEGER DEFAULT 1,          -- 監視有効フラグ
    selectors TEXT,                     -- カスタムセレクター（JSON）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### price_history
```sql
CREATE TABLE price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,                 -- products.id への外部キー
    price INTEGER NOT NULL,             -- 価格（円）
    currency TEXT DEFAULT 'JPY',       -- 通貨コード
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### インデックス
```sql
CREATE INDEX idx_products_key ON products(key);
CREATE INDEX idx_products_enabled ON products(enabled);
CREATE INDEX idx_price_history_product_id ON price_history(product_id);
CREATE INDEX idx_price_history_recorded_at ON price_history(recorded_at);
```

---

## 🤖 価格取得ロジック

### Playwright設定
```javascript
const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### 通貨設定
```javascript
// BullionStar JPY設定
await page.goto('https://www.bullionstar.com/');
await page.click('.currency-dropdown');
await page.click('a[href*="currency=JPY"]');
```

### 価格抽出
```javascript
const priceSelectors = [
    '.product-price .price',
    '.price-now',
    '.product-detail-price',
    '[data-price]',
    '.price'
];

// 優先順位：JPY > USD変換 > 数値推定
if (text.includes('¥') || text.includes('JPY')) {
    // 直接円価格
} else if (text.includes('$') || text.includes('USD')) {
    // USD→JPY換算（レート150）
} else {
    // 数値のみの場合の推定
}
```

### 画像抽出
```javascript
const productImages = await page.$$eval('img', imgs => {
    return imgs
        .filter(img => {
            // 商品名がalt属性に含まれる
            const hasProductAlt = img.alt && keywords.some(k =>
                img.alt.includes(k)
            );

            // 300x300の高解像度商品画像
            const isLargeProductImage =
                img.width === 300 && img.height === 300;

            // BullionStarの商品画像URLパターン
            const hasProductUrl = img.src &&
                img.src.includes('/files/') &&
                img.src.includes('300_300');

            return hasProductAlt || isLargeProductImage || hasProductUrl;
        })
        .sort((a, b) => (b.width * b.height) - (a.width * a.height));
});
```

---

## 🔒 セキュリティ

### 認証
- **Bearer Token**: シンプルなパスワードベース認証
- **CORS**: 全オリジン許可（`Access-Control-Allow-Origin: *`）

### データ保護
- **環境変数**: `ADMIN_PASSWORD` で管理
- **SQLインジェクション対策**: Prepared Statements使用
- **XSS対策**: HTML エスケープ実装

### レート制限
```javascript
// 価格取得間の待機時間
await new Promise(resolve => setTimeout(resolve, 2000));
```

---

## 📊 パフォーマンス

### Cloudflare Workers
- **Cold Start**: ~100ms
- **Execution Time**: ~50ms（DB クエリ含む）
- **Memory Usage**: ~20MB
- **Bundle Size**: 40KB（gzip: 7.8KB）

### データベース
- **D1 Database**: SQLite（Edge分散）
- **Query Performance**: ~10ms
- **Storage**: ~1MB（商品・価格履歴含む）

### Playwright
- **Browser Launch**: ~3秒
- **Page Load**: ~5秒（BullionStar）
- **Data Extraction**: ~2秒
- **Total per Product**: ~10秒

---

## 🔧 開発環境

### ローカル開発
```bash
# 依存関係インストール
npm install

# ローカルWorker起動
npx wrangler dev

# 価格チェック実行
npm run check-prices

# D1 データベース確認
npx wrangler d1 execute coin-price-db --local --command "SELECT * FROM products;"
```

### 環境変数
```bash
# .env
WORKER_URL=https://coin-price-checker.h-abe.workers.dev
ADMIN_PASSWORD=admin123

# wrangler.toml
[env.production.vars]
ADMIN_PASSWORD = "your-secure-password"
```

### デプロイ
```bash
# Cloudflare Workers
npx wrangler deploy

# GitHub Pages
git push origin main
```

---

## 📝 ログ・モニタリング

### エラーハンドリング
```javascript
try {
    // 処理
} catch (error) {
    console.error('Worker error:', error);
    return new Response(JSON.stringify({
        error: 'Internal server error',
        details: error.message
    }), { status: 500 });
}
```

### Cloudflare Analytics
- **Request Volume**: リクエスト数
- **Error Rate**: エラー率
- **Response Time**: レスポンス時間
- **Geographic Distribution**: 地理的分散

---

*この技術仕様書は実装に応じて随時更新されます。*