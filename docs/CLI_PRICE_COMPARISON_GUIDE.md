# CLI価格比較システム - 完全ガイド

## 🎯 システム概要

CLI価格比較システムは、同一商品を複数サイトから価格取得し、最安値を発見するための専用ツールです。

### 🏗️ システム構成

```
CLI価格比較システム
├── 商品マッピング（PRODUCT_MAPPINGS）
│   └── 1商品 = 複数サイトURL
├── マルチサイトスクレイパー
│   ├── BullionStarScraper
│   └── LPMScraper
├── 価格比較エンジン
│   └── 最安値・価格差分析
└── データベース保存
    └── 各サイト結果を個別エントリー
```

## 📋 商品マッピング設定

### 現在の設定商品

#### 1. Canadian Silver Maple Leaf 1oz
```javascript
'canadian-silver-maple-1oz': [
  {
    site: 'bullionstar.com',
    url: 'https://www.bullionstar.com/buy/product/silver-maple-leaf-1oz-various',
    name: 'Canadian Silver Maple Leaf 1oz'
  },
  {
    site: 'lpm.hk',
    url: 'https://www.lpm.hk/en/products/silver-coins/canadian-maple-leaf-1oz',
    name: 'Canadian Silver Maple Leaf 1oz'
  }
]
```

#### 2. American Gold Eagle 1oz
```javascript
'american-gold-eagle-1oz': [
  {
    site: 'bullionstar.com',
    url: 'https://www.bullionstar.com/buy/product/gold-eagle-1oz-various',
    name: 'American Gold Eagle 1oz'
  },
  {
    site: 'lpm.hk',
    url: 'https://www.lpm.hk/en/products/gold-coins/american-eagle-1oz',
    name: 'American Gold Eagle 1oz'
  }
]
```

#### 3. Silver Bar 1kg
```javascript
'silver-bar-1kg': [
  {
    site: 'bullionstar.com',
    url: 'https://www.bullionstar.com/buy/product/silver-bullionstar-1kg',
    name: 'Silver Bar 1kg'
  },
  {
    site: 'lpm.hk',
    url: 'https://www.lpm.hk/en/products/silver-bars/generic-1kg',
    name: 'Silver Bar 1kg'
  }
]
```

## 🚀 使用方法

### 基本コマンド

#### 1. サポートサイト・商品確認
```bash
npm run list-sites
```

**出力例:**
```
🌐 Supported Sites:
   - bullionstar.com (BullionStar)
   - lpm.hk (LPM Group Limited)

📦 Available Products for Comparison:
   - canadian-silver-maple-1oz: Canadian Silver Maple Leaf 1oz
   - american-gold-eagle-1oz: American Gold Eagle 1oz
   - silver-bar-1kg: Silver Bar 1kg
```

#### 2. 全商品価格比較
```bash
npm run compare-prices
```

#### 3. 特定商品比較
```bash
# Canadian Silver Maple比較
npm run compare-product canadian-silver-maple-1oz

# American Gold Eagle比較
npm run compare-product american-gold-eagle-1oz

# Silver Bar 1kg比較
npm run compare-product silver-bar-1kg
```

### 高度なコマンド

#### 直接実行（詳細オプション）
```bash
# 全商品比較
node cloudflare/multi-site-price-checker.js

# 特定商品比較
node cloudflare/multi-site-price-checker.js compare canadian-silver-maple-1oz

# ヘルプ表示
node cloudflare/multi-site-price-checker.js help
```

## 📊 価格比較レポート詳細

### 出力フォーマット

#### 1. 個別商品結果
```
📊 Price Comparison Results for Canadian Silver Maple Leaf 1oz
   Sites compared: 2
   Price range: ¥5,835 - ¥6,100
   Average: ¥5,967
   Spread: ¥265 (4%)

🏆 Best Deal: bullionstar.com
   Price: ¥5,835
   Product: Canadian Silver Maple Leaf 1oz

📋 All Sites:
   🥇 bullionstar.com: ¥5,835
   🥈 lpm.hk: ¥6,100
      └─ bulk_5: ¥6,050
      └─ bulk_100: ¥5,950
```

#### 2. 全体サマリー
```
📈 OVERALL SUMMARY
Total products: 3
Successful comparisons: 3
Failed comparisons: 0

🏆 Best Deals Found:
   Canadian Silver Maple Leaf 1oz: bullionstar.com - ¥5,835
   American Gold Eagle 1oz: lpm.hk - ¥245,800
   Silver Bar 1kg: bullionstar.com - ¥158,520

💰 Largest Price Spreads:
   American Gold Eagle 1oz: 8% (¥20,450)
   Canadian Silver Maple Leaf 1oz: 4% (¥265)
   Silver Bar 1kg: 2% (¥3,180)
```

### 価格比較データ構造

```javascript
{
  productName: "Canadian Silver Maple Leaf 1oz",
  sitesCompared: 2,
  priceRange: {
    min: 5835,           // 最安値
    max: 6100,           // 最高値
    average: 5967,       // 平均価格
    spread: 265,         // 価格差
    spreadPercent: 4     // 価格差率(%)
  },
  bestDeal: {            // 最安値サイト
    site: "bullionstar.com",
    price: 5835,
    productName: "Canadian Silver Maple Leaf 1oz",
    imageUrl: "https://...",
    priceTypes: ["retail"],
    allPrices: { retail: 5835 }
  },
  sites: [               // 全サイト詳細
    {
      site: "bullionstar.com",
      price: 5835,
      priceTypes: ["retail"],
      allPrices: { retail: 5835 },
      currency: "JPY",
      productName: "Canadian Silver Maple Leaf 1oz",
      imageUrl: "https://...",
      scrapedAt: "2025-09-15T12:00:00Z"
    },
    {
      site: "lpm.hk",
      price: 6100,
      priceTypes: ["retail", "bulk_5", "bulk_100"],
      allPrices: {
        retail: 6100,
        bulk_5: 6050,
        bulk_100: 5950
      },
      currency: "JPY",
      productName: "Canadian Silver Maple Leaf 1oz",
      imageUrl: "https://...",
      scrapedAt: "2025-09-15T12:00:00Z"
    }
  ],
  generatedAt: "2025-09-15T12:00:00Z"
}
```

## 🗄️ データベース保存仕様

### 保存形式

各サイトの結果が**個別エントリー**として保存されます：

```sql
-- 保存例
INSERT INTO products (key, name, site, current_price, image_url, ...)
VALUES
  ('bullionstar-com-canadian-silver-maple-leaf-1oz',
   'Canadian Silver Maple Leaf 1oz (bullionstar.com)',
   'bullionstar.com',
   5835,
   'https://static.bullionstar.com/...'),

  ('lpm-hk-canadian-silver-maple-leaf-1oz',
   'Canadian Silver Maple Leaf 1oz (lpm.hk)',
   'lpm.hk',
   6100,
   'https://www.lpm.hk/...');
```

### 拡張データ

比較情報が`comparison_data`フィールドに保存：

```javascript
{
  priceTypes: ["retail", "bulk_5", "bulk_100"],
  allPrices: {
    retail: 6100,
    bulk_5: 6050,
    bulk_100: 5950
  },
  rank: 2,                    // 価格ランキング
  totalSites: 2,             // 比較サイト数
  priceSpread: 4             // 価格差率(%)
}
```

## ⚙️ 技術仕様

### サポートサイト詳細

#### 1. BullionStar (bullionstar.com)
```javascript
{
  baseUrl: 'https://www.bullionstar.com',
  currency: 'JPY',           // 直接JPY設定
  priceTypes: ['retail'],    // 単一価格
  imageSupport: true,        // 300x300高解像度
  特徴: [
    'シンガポール拠点',
    'JPY通貨設定対応',
    '高品質商品画像',
    '安定したAPIレスポンス'
  ]
}
```

#### 2. LPM Group Limited (lpm.hk)
```javascript
{
  baseUrl: 'https://www.lpm.hk',
  currency: 'HKD',           // HKD→JPY変換
  priceTypes: ['retail', 'bulk_5', 'bulk_100'],
  imageSupport: true,
  特徴: [
    '香港拠点',
    '数量割引価格対応',
    'HKD→JPY自動変換',
    'バルク価格テーブル'
  ]
}
```

### 為替レート仕様

#### API統合
```javascript
// ExchangeRate-API使用
const response = await fetch(
  `https://api.exchangerate-api.com/v4/latest/${from}`
);
const rate = response.rates[to];
```

#### キャッシュ仕様
- **有効期間**: 1時間
- **メモリキャッシュ**: セッション単位
- **フォールバック**: 固定レート

#### フォールバックレート
```javascript
const fallbackRates = {
  'USD_JPY': 150,      // 1 USD = 150 JPY
  'HKD_JPY': 19.2,     // 1 HKD = 19.2 JPY
  'EUR_JPY': 162,      // 1 EUR = 162 JPY
  'GBP_JPY': 190       // 1 GBP = 190 JPY
};
```

## 🔧 カスタマイズ・拡張

### 新商品追加方法

#### 1. 商品マッピング追加
```javascript
// cloudflare/scrapers/scraper_factory.js
export const PRODUCT_MAPPINGS = {
  // 既存商品...

  'new-product-key': [
    {
      site: 'bullionstar.com',
      url: 'https://www.bullionstar.com/buy/product/new-product',
      name: 'New Product Name'
    },
    {
      site: 'lpm.hk',
      url: 'https://www.lpm.hk/en/products/new-product',
      name: 'New Product Name'
    }
  ]
};
```

#### 2. 実行確認
```bash
npm run list-sites
npm run compare-product new-product-key
```

### 新サイト追加方法

#### 1. スクレイパークラス作成
```javascript
// cloudflare/scrapers/newsite_scraper.js
import { BaseScraper } from './base_scraper.js';

export class NewSiteScraper extends BaseScraper {
  constructor(browser) {
    super(browser);
    this.baseUrl = 'https://newsite.com';
    this.siteName = 'newsite.com';
  }

  async scrapeProduct(productConfig) {
    // サイト固有のスクレイピングロジック
    const page = await this.browser.newPage();

    try {
      await this.navigateWithRetry(page, productConfig.url);

      const price = await this.extractPrice(page, [
        '.price', '.amount', '[data-price]'
      ]);

      return await this.buildResult(page, price, 'USD', productConfig);
    } finally {
      await page.close();
    }
  }
}
```

#### 2. ファクトリーに登録
```javascript
// cloudflare/scrapers/scraper_factory.js
import { NewSiteScraper } from './newsite_scraper.js';

initializeScrapers() {
  this.scrapers.set('bullionstar.com', new BullionStarScraper(this.browser));
  this.scrapers.set('lpm.hk', new LPMScraper(this.browser));
  this.scrapers.set('newsite.com', new NewSiteScraper(this.browser)); // 追加
}
```

#### 3. 商品マッピング更新
```javascript
'existing-product': [
  // 既存サイト...
  {
    site: 'newsite.com',
    url: 'https://newsite.com/product/...',
    name: 'Product Name'
  }
]
```

## 🔄 自動化設定

### GitHub Actions設定

#### 定期実行設定
```yaml
# .github/workflows/price-comparison.yml
name: Multi-Site Price Comparison
on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間毎実行
  workflow_dispatch:       # 手動実行も可能

jobs:
  compare-prices:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Install Playwright browsers
        run: npx playwright install

      - name: Compare prices
        run: npm run compare-prices
        env:
          WORKER_URL: ${{ secrets.WORKER_URL }}
          ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
```

#### 必要なシークレット
- `WORKER_URL`: Cloudflare Worker URL
- `ADMIN_PASSWORD`: 管理者パスワード

### 手動実行スケジュール

#### 日次実行例
```bash
# crontabエントリー例
0 9 * * * cd /path/to/coin-price-checker && npm run compare-prices
0 15 * * * cd /path/to/coin-price-checker && npm run compare-prices
0 21 * * * cd /path/to/coin-price-checker && npm run compare-prices
```

## 📊 パフォーマンス・制限

### 実行時間
- **1商品あたり**: 約20-30秒
- **全商品(3個)**: 約1-2分
- **サイト間待機**: 2秒（レート制限対策）

### リソース使用量
- **メモリ**: 約200-300MB (Playwright)
- **CPU**: 中程度（ブラウザレンダリング）
- **ネットワーク**: サイトあたり5-10MB

### エラーハンドリング
- **タイムアウト**: 30秒/ページ
- **リトライ**: 最大3回
- **部分成功**: 一部サイト失敗でも続行
- **為替API**: フォールバック固定レート

## 🔍 トラブルシューティング

### よくある問題

#### 1. 価格が取得できない
```bash
# デバッグ実行
DEBUG=true npm run compare-product canadian-silver-maple-1oz
```

**対処法:**
- サイトの構造変更をチェック
- セレクター更新が必要な場合あり
- ネットワーク接続確認

#### 2. 為替レートエラー
```
Exchange rate fetch failed: Network error
```

**対処法:**
- フォールバック固定レートが自動適用
- 手動レート更新: `base_scraper.js`の`fallbackRates`

#### 3. Playwrightエラー
```bash
# Playwrightブラウザ再インストール
npx playwright install
```

### ログレベル設定

#### 詳細ログ有効化
```javascript
// multi-site-price-checker.js 冒頭に追加
process.env.DEBUG = 'true';
```

## 📈 運用・監視

### 成功指標
- **価格取得成功率**: >90%
- **サイト応答時間**: <30秒
- **価格差検出**: 最低1%以上の差があれば有効

### 監視項目
- 各サイトの取得成功/失敗
- 価格データの妥当性（異常値検出）
- 為替レート取得状況
- 実行時間監視

### データ検証
```bash
# データベース確認
npx wrangler d1 execute coin-price-db --command "
  SELECT site, COUNT(*) as count, MAX(updated_at) as last_update
  FROM products
  GROUP BY site;
"
```

---

**このCLI価格比較システムにより、複数サイトからの最適価格発見が自動化されます。**