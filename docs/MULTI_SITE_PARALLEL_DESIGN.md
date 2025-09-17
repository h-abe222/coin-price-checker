# 複数サイト価格並列表示システム設計

## 🎯 要件定義

### 目標
商品単位で複数サイトの価格を並列表示
```
商品A → BS: ¥5,835 | LPM: ¥6,100 | APMEX: ¥5,950
商品B → BS: ¥245,800 | LPM: ¥248,000 | APMEX: ¥246,500
```

### 現在の課題
```
現在: 各サイト = 個別エントリー
商品A (BullionStar) → 単独エントリー
商品A (LPM)        → 単独エントリー
商品A (APMEX)      → 単独エントリー
```

## 🏗️ 実装方針比較

### 方針1: データベーススキーマ拡張
```sql
-- 新しいテーブル構造
CREATE TABLE product_groups (
    id INTEGER PRIMARY KEY,
    product_key TEXT UNIQUE,
    base_name TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE site_prices (
    id INTEGER PRIMARY KEY,
    product_group_id INTEGER,
    site TEXT,
    url TEXT,
    price INTEGER,
    image_url TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_group_id) REFERENCES product_groups(id)
);
```

**メリット:**
- 正規化されたデータ構造
- 複雑なクエリに対応
- スケーラブル

**デメリット:**
- 既存システムとの互換性なし
- 大幅な改修が必要

### 方針2: JSON形式での価格保存（推奨）
```sql
-- 既存テーブル活用
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE,
    name TEXT,
    current_price INTEGER,        -- 最安値価格
    site_prices TEXT,            -- JSON: サイト別価格
    site_urls TEXT,              -- JSON: サイト別URL
    image_url TEXT,              -- 代表画像
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**メリット:**
- 既存システムとの互換性維持
- 最小限の変更で実現
- 段階的移行可能

**デメリット:**
- JSON操作の複雑性
- 検索性能の制約

## 📊 方針2（JSON形式）の詳細設計

### データ構造
```javascript
// site_prices フィールド (JSON)
{
  "bullionstar.com": {
    "price": 5835,
    "currency": "JPY",
    "updated_at": "2025-09-15T12:00:00Z",
    "price_types": {
      "retail": 5835
    }
  },
  "lpm.hk": {
    "price": 6100,
    "currency": "JPY",
    "updated_at": "2025-09-15T12:00:00Z",
    "price_types": {
      "retail": 6100,
      "bulk_5": 6050,
      "bulk_100": 5950
    }
  },
  "apmex.com": {
    "price": 5950,
    "currency": "JPY",
    "updated_at": "2025-09-15T12:00:00Z",
    "price_types": {
      "retail": 5950,
      "bulk_10": 5900
    }
  }
}

// site_urls フィールド (JSON)
{
  "bullionstar.com": "https://www.bullionstar.com/buy/product/silver-maple-leaf-1oz-various",
  "lpm.hk": "https://www.lpm.hk/en/products/silver-coins/canadian-maple-leaf-1oz",
  "apmex.com": "https://www.apmex.com/product/12345/canadian-silver-maple"
}
```

### Web UI表示例
```html
<div class="product-item">
  <div class="product-info">
    <h3>Canadian Silver Maple Leaf 1oz</h3>
    <div class="price-comparison">
      <span class="site-price best-price">
        <strong>BS:</strong> ¥5,835
      </span>
      <span class="site-price">
        <strong>LPM:</strong> ¥6,100
      </span>
      <span class="site-price">
        <strong>APMEX:</strong> ¥5,950
      </span>
    </div>
    <div class="best-deal">
      🏆 最安値: BullionStar (4%お得)
    </div>
  </div>
</div>
```

## 🔧 実装ステップ

### Step 1: データベーススキーマ拡張
```sql
-- 既存テーブルに新カラム追加
ALTER TABLE products ADD COLUMN site_prices TEXT;
ALTER TABLE products ADD COLUMN site_urls TEXT;
ALTER TABLE products ADD COLUMN best_site TEXT;
```

### Step 2: API拡張
```javascript
// 新しい商品登録API
POST /api/product-groups
{
  "productKey": "canadian-silver-maple-1oz",
  "baseName": "Canadian Silver Maple Leaf 1oz",
  "sites": [
    {
      "site": "bullionstar.com",
      "url": "https://www.bullionstar.com/buy/product/silver-maple-leaf-1oz-various"
    },
    {
      "site": "lpm.hk",
      "url": "https://www.lpm.hk/en/products/silver-coins/canadian-maple-leaf-1oz"
    }
  ]
}

// 価格更新API（複数サイト対応）
POST /api/update-multi-site-prices
{
  "productKey": "canadian-silver-maple-1oz",
  "prices": {
    "bullionstar.com": 5835,
    "lpm.hk": 6100,
    "apmex.com": 5950
  }
}
```

### Step 3: Web UI改修
```javascript
// 商品表示関数
function displayProductWithMultiSites(product) {
  const sitePrices = JSON.parse(product.site_prices || '{}');
  const siteUrls = JSON.parse(product.site_urls || '{}');

  let priceHtml = '';
  let bestPrice = Infinity;
  let bestSite = '';

  for (const [site, priceData] of Object.entries(sitePrices)) {
    const price = priceData.price;
    const isBest = price < bestPrice;

    if (isBest) {
      bestPrice = price;
      bestSite = site;
    }

    priceHtml += `
      <span class="site-price ${isBest ? 'best-price' : ''}">
        <strong>${site.replace('.com', '').toUpperCase()}:</strong>
        ¥${price.toLocaleString()}
      </span>
    `;
  }

  return `
    <div class="product-item">
      <h3>${product.name}</h3>
      <div class="price-comparison">${priceHtml}</div>
      <div class="best-deal">🏆 最安値: ${bestSite}</div>
    </div>
  `;
}
```

### Step 4: CLI価格取得ロジック更新
```javascript
// 複数サイト価格取得・統合
async function updateProductGroupPrices(productKey) {
  const comparison = await compareProductPrices(productKey, browser);

  // 統合データ作成
  const sitePrices = {};
  const siteUrls = {};
  let bestPrice = Infinity;
  let bestSite = '';

  comparison.sites.forEach(siteData => {
    sitePrices[siteData.site] = {
      price: siteData.price,
      currency: siteData.currency,
      updated_at: siteData.scrapedAt,
      price_types: siteData.allPrices
    };

    siteUrls[siteData.site] = siteData.originalUrl;

    if (siteData.price < bestPrice) {
      bestPrice = siteData.price;
      bestSite = siteData.site;
    }
  });

  // データベース更新
  const updateData = {
    key: productKey,
    name: comparison.productName,
    current_price: bestPrice,
    site_prices: JSON.stringify(sitePrices),
    site_urls: JSON.stringify(siteUrls),
    best_site: bestSite,
    image_url: comparison.bestDeal.imageUrl
  };

  await updateProductGroup(updateData);
}
```

## 🎨 UI設計

### 価格比較表示
```css
.price-comparison {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 8px 0;
}

.site-price {
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 14px;
  border: 1px solid #e5e7eb;
}

.site-price.best-price {
  background: #dcfce7;
  border-color: #16a34a;
  color: #15803d;
  font-weight: 600;
}

.best-deal {
  font-size: 12px;
  color: #16a34a;
  font-weight: 500;
  margin-top: 4px;
}
```

### レスポンシブ対応
```css
@media (max-width: 640px) {
  .price-comparison {
    flex-direction: column;
    gap: 6px;
  }

  .site-price {
    justify-content: space-between;
    display: flex;
  }
}
```

## 📱 ユーザーエクスペリエンス

### 表示例
```
┌─────────────────────────────────────────────┐
│ Canadian Silver Maple Leaf 1oz             │
├─────────────────────────────────────────────┤
│ BS: ¥5,835  LPM: ¥6,100  APMEX: ¥5,950    │
│ 🏆 最安値: BullionStar (4%お得)             │
│                                             │
│ [商品ページを開く ▼] [価格更新] [削除]       │
└─────────────────────────────────────────────┘
```

### インタラクション
- **サイト名クリック** → 該当サイトの商品ページを開く
- **価格クリック** → 詳細価格情報（数量割引等）表示
- **最安値表示** → 節約額・割引率を表示

## 🔄 移行戦略

### Phase 1: 新システム構築
1. データベーススキーマ拡張
2. 新API実装
3. CLI価格取得ロジック更新

### Phase 2: 既存データ移行
```javascript
// 既存の個別エントリーを統合
async function migrateExistingProducts() {
  const existingProducts = await getExistingProducts();
  const grouped = groupProductsByName(existingProducts);

  for (const [productName, siteEntries] of grouped) {
    const sitePrices = {};
    const siteUrls = {};

    siteEntries.forEach(entry => {
      sitePrices[entry.site] = {
        price: entry.current_price,
        currency: 'JPY',
        updated_at: entry.updated_at
      };
      siteUrls[entry.site] = entry.url;
    });

    await createProductGroup({
      productKey: generateKey(productName),
      baseName: productName,
      sitePrices: sitePrices,
      siteUrls: siteUrls
    });
  }
}
```

### Phase 3: UI更新・テスト
1. Web UI改修
2. 表示テスト
3. 既存機能との互換性確認

### Phase 4: 旧システム廃止
1. 旧エントリーのアーカイブ
2. 完全移行
3. 性能最適化

## 📊 期待効果

### ユーザーメリット
- **一目で価格比較** - 複数サイトの価格が瞬時に比較可能
- **最安値の発見** - 自動的に最安値サイトをハイライト
- **時間節約** - 個別サイト確認が不要

### システムメリット
- **データ統合** - 重複エントリーの解消
- **管理効率** - 商品単位での管理
- **拡張性** - 新サイト追加が容易

### 運用メリット
- **価格トレンド** - サイト間価格差の分析
- **市場分析** - 競合他社との比較
- **アラート設定** - 価格差閾値での通知

---

**この設計により、商品単位での複数サイト価格並列表示が実現されます。**