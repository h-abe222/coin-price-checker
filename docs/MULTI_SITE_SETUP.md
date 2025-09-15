# 複数サイト価格比較システム - セットアップガイド

## 🎯 概要

コイン価格チェッカーに複数サイトからの価格取得・比較機能を追加しました。同じ商品の価格を複数のサイトから取得し、最安値を見つけることができます。

## 🏗️ アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  ScraperFactory │───▶│   BaseScraper   │───▶│  Site-Specific  │
│    (管理)        │    │    (基底)       │    │   Scrapers      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │              ┌────────┴────────┐
         ▼                       ▼              │                 │
┌─────────────────┐    ┌─────────────────┐    ▼                 ▼
│ Price Comparison│    │  Exchange Rate  │ BullionStar      LPM HK
│    Results      │    │   Conversion    │ Scraper        Scraper
└─────────────────┘    └─────────────────┘
```

## 📁 ファイル構成

```
cloudflare/scrapers/
├── base_scraper.js           # 基底スクレイパークラス
├── bullionstar_scraper.js    # BullionStar専用スクレイパー
├── lpm_scraper.js           # LPM Group専用スクレイパー
└── scraper_factory.js       # スクレイパー管理・価格比較

cloudflare/
└── multi-site-price-checker.js  # メイン実行スクリプト
```

## 🚀 使用方法

### 1. サポートサイト確認
```bash
npm run list-sites
```

### 2. 全商品価格比較
```bash
npm run compare-prices
```

### 3. 特定商品比較
```bash
npm run compare-product canadian-silver-maple-1oz
npm run compare-product american-gold-eagle-1oz
npm run compare-product silver-bar-1kg
```

## 🌐 サポートサイト

### 1. BullionStar (bullionstar.com)
- **特徴**: シンガポールの貴金属ディーラー
- **通貨**: JPY設定対応
- **画像**: 300x300高解像度対応
- **価格タイプ**: リテール価格

### 2. LPM Group Limited (lpm.hk)
- **特徴**: 香港の貴金属ディーラー
- **通貨**: HKD → JPY自動変換
- **価格タイプ**: リテール + 数量割引価格
- **複数価格**: bulk_5, bulk_100等

## 📊 価格比較機能

### 比較レポート生成
```javascript
{
  productName: "Canadian Silver Maple Leaf 1oz",
  sitesCompared: 2,
  priceRange: {
    min: 5835,           // 最安値
    max: 6100,           // 最高値
    average: 5967,       // 平均価格
    spread: 265,         // 価格差
    spreadPercent: 4     // 価格差(%)
  },
  bestDeal: {            // 最安値サイト
    site: "bullionstar.com",
    price: 5835,
    productName: "Canadian Silver Maple Leaf 1oz"
  },
  sites: [...]           // 全サイト詳細
}
```

### 出力例
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

## 🔧 技術詳細

### BaseScraper 基底クラス
```javascript
class BaseScraper {
  async extractPrice(page, selectors)     // 価格抽出
  async extractImage(page, patterns)      // 画像抽出
  async extractProductName(page, selectors) // 商品名抽出
  async getExchangeRate(from, to)         // 為替変換
  async navigateWithRetry(page, url)      // リトライ機能
}
```

### 為替レート対応
- **API**: ExchangeRate-API使用
- **キャッシュ**: 1時間有効
- **フォールバック**: 固定レート
  - USD/JPY: 150
  - HKD/JPY: 19.2
  - EUR/JPY: 162
  - GBP/JPY: 190

### 複数価格タイプ対応
```javascript
// LPMスクレイパーの価格例
{
  retail: 6100,        // 単品価格
  bulk_5: 6050,        // 5個以上
  bulk_100: 5950       // 100個以上
}
```

## 📦 商品マッピング設定

### 現在対応商品
```javascript
PRODUCT_MAPPINGS = {
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
  ],
  // ... 他の商品
}
```

### 新商品追加方法
1. `PRODUCT_MAPPINGS`に商品情報を追加
2. 各サイトのURL・商品名を設定
3. 必要に応じてスクレイパーをカスタマイズ

## 🗄️ データベース統合

### 価格更新
- 各サイトの価格を個別にデータベース保存
- 商品キー形式: `{site}-{product-name}`
- 比較データも含めて保存

### 拡張フィールド
```sql
-- products テーブル追加フィールド
site TEXT,              -- サイト名
comparison_data TEXT    -- 比較情報(JSON)
```

## 🔄 自動化スケジュール

### GitHub Actions設定例
```yaml
# .github/workflows/price-comparison.yml
name: Multi-Site Price Comparison
on:
  schedule:
    - cron: '0 */6 * * *'  # 6時間毎
jobs:
  compare-prices:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run compare-prices
```

## 🚀 新しいサイト追加方法

### 1. スクレイパークラス作成
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
  }
}
```

### 2. ファクトリーに登録
```javascript
// scraper_factory.js
import { NewSiteScraper } from './newsite_scraper.js';

initializeScrapers() {
  this.scrapers.set('newsite.com', new NewSiteScraper(this.browser));
  // ...
}
```

### 3. 商品マッピング追加
```javascript
// PRODUCT_MAPPINGS に追加
'product-key': [
  // ... 既存サイト
  {
    site: 'newsite.com',
    url: 'https://newsite.com/product/...',
    name: 'Product Name'
  }
]
```

## 📊 パフォーマンス最適化

### 並列処理
- サイト毎に順次実行（レート制限対策）
- リトライ機能付きページアクセス
- タイムアウト設定: 30秒

### キャッシュ戦略
- 為替レート: 1時間キャッシュ
- 商品情報: セッション単位

### エラーハンドリング
- サイト別エラー分離
- 部分的成功でも結果生成
- 詳細エラーログ

## 🔮 今後の拡張予定

### Phase 1: 基本機能拡張
- [ ] APMEX.com対応
- [ ] JM Bullion対応
- [ ] 価格履歴チャート

### Phase 2: 高度な機能
- [ ] 価格アラート機能
- [ ] 在庫状況チェック
- [ ] 配送料込み価格比較

### Phase 3: UI/UX改善
- [ ] Web UIでの価格比較表示
- [ ] リアルタイム価格更新
- [ ] モバイル対応

---

*このシステムにより、ユーザーは複数サイトから最適な価格で貴金属を購入できるようになります。*