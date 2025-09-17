# システムアーキテクチャ概要

## 🏗️ 全体構成

コイン価格チェッカーは、**2つの独立したシステム**で構成されています：

```
┌─────────────────────────────────────────────────────────────┐
│                コイン価格チェッカー                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │   既存システム       │    │     CLI価格比較システム      │  │
│  │  (Web UI + DB)     │    │   (Multi-Site Scraper)     │  │
│  └─────────────────────┘    └─────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📊 システム比較

| 特徴 | 既存システム | CLI価格比較システム |
|------|-------------|-------------------|
| **対応サイト** | 1サイト/商品 | 複数サイト/商品 |
| **実行方法** | Web UI | コマンドライン |
| **価格比較** | ❌ なし | ✅ あり（最安値発見） |
| **データ保存** | 個別エントリー | 比較結果含む |
| **自動化** | ✅ Web管理 | ✅ CLI + GitHub Actions |
| **ユーザー** | 一般ユーザー | 開発者・パワーユーザー |

## 🌐 既存システム（Web UI + Database）

### 構成要素
```
Web UI (index.html)
    ↓ API呼び出し
Cloudflare Workers (worker.js)
    ↓ データ操作
D1 Database (SQLite)
    ↓ 価格取得
Single-Site Scraper (price-checker.js)
```

### 特徴
- **1商品 = 1サイト**の制限
- Web管理画面での直感的操作
- リアルタイム価格表示
- 商品追加・削除・有効化

### データ構造
```sql
products (
  id, key, url, name, site,
  current_price, image_url,
  enabled, created_at, updated_at
)
```

## 🚀 CLI価格比較システム

### 構成要素
```
Product Mappings (PRODUCT_MAPPINGS)
    ↓ 商品定義
ScraperFactory
    ↓ スクレイパー管理
Multi-Site Scrapers (BullionStar, LPM)
    ↓ 価格取得
Price Comparison Engine
    ↓ 比較分析
Database Integration
```

### 特徴
- **1商品 = 複数サイト**対応
- 価格比較・最安値発見
- 数量割引価格対応
- 為替レート自動変換

### データフロー
```javascript
PRODUCT_MAPPINGS
  ↓ 商品キー指定
ScraperFactory.scrapeMultipleSites()
  ↓ 各サイトから価格取得
Price Comparison Report
  ↓ 比較結果
Database Save (個別エントリー)
```

## 🔧 技術スタック詳細

### 共通基盤
```yaml
Runtime: Node.js 18+
Browser: Playwright (Chromium)
Database: Cloudflare D1 (SQLite)
Deployment: Cloudflare Workers
Repository: GitHub
```

### 既存システム
```yaml
Frontend: HTML5 + Tailwind CSS + Vanilla JS
API: Cloudflare Workers (RESTful)
Scraping: Single-site focused
Management: Web-based CRUD
```

### CLI価格比較システム
```yaml
Architecture: Plugin-based scrapers
Execution: Command-line interface
Comparison: Multi-site analysis
Automation: npm scripts + GitHub Actions
```

## 📁 ファイル構成マッピング

```
coin-price-checker/
├── 🌐 既存システム
│   ├── index.html                     # Web UI
│   └── cloudflare/
│       ├── worker.js                  # API + Web配信
│       ├── price-checker.js           # 単一サイトスクレイパー
│       ├── wrangler.toml             # Cloudflare設定
│       └── schema.sql                # DB定義
│
├── 🚀 CLI価格比較システム
│   └── cloudflare/
│       ├── multi-site-price-checker.js   # メイン実行
│       └── scrapers/
│           ├── base_scraper.js           # 基底クラス
│           ├── scraper_factory.js        # 管理・比較エンジン
│           ├── bullionstar_scraper.js    # BullionStar専用
│           └── lpm_scraper.js            # LPM専用
│
└── 📚 ドキュメント・その他
    ├── docs/                         # 各種ドキュメント
    ├── archived/                     # レガシーファイル
    ├── python-versions/              # Python版
    └── web-interfaces/               # 代替UI
```

## 🔄 データフロー比較

### 既存システムのデータフロー
```
1. Web UI → 商品URL入力
2. Worker API → products テーブルに保存
3. price-checker.js → 単一サイトから価格取得
4. Worker API → 価格更新
5. Web UI → 更新された価格表示
```

### CLI価格比較システムのデータフロー
```
1. PRODUCT_MAPPINGS → 複数サイト商品定義
2. multi-site-price-checker.js → 実行開始
3. ScraperFactory → 各サイトスクレイパー起動
4. 各Scraper → サイト別価格取得
5. Comparison Engine → 価格比較分析
6. Database Integration → 比較結果保存
7. Console Output → 結果表示
```

## 🗄️ データベース設計

### 既存テーブル（そのまま利用）
```sql
-- 商品マスター
CREATE TABLE products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,           -- 商品キー
    url TEXT NOT NULL,                  -- 商品URL
    name TEXT,                          -- 商品名
    site TEXT,                          -- サイト名
    current_price INTEGER DEFAULT 0,    -- 現在価格
    image_url TEXT,                     -- 商品画像URL
    enabled INTEGER DEFAULT 1,          -- 有効フラグ
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 価格履歴
CREATE TABLE price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,                 -- products.id
    price INTEGER NOT NULL,             -- 価格
    currency TEXT DEFAULT 'JPY',       -- 通貨
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
);
```

### CLI価格比較での利用方法
```javascript
// 各サイトの結果を個別エントリーとして保存
updates = [
  {
    key: 'bullionstar-com-canadian-silver-maple-1oz',
    price: 5835,
    name: 'Canadian Silver Maple Leaf 1oz (bullionstar.com)',
    site: 'bullionstar.com',
    imageUrl: '...',
    comparisonData: {
      rank: 1,
      totalSites: 2,
      priceSpread: 4
    }
  },
  {
    key: 'lpm-hk-canadian-silver-maple-1oz',
    price: 6100,
    name: 'Canadian Silver Maple Leaf 1oz (lpm.hk)',
    site: 'lpm.hk',
    imageUrl: '...',
    comparisonData: {
      rank: 2,
      totalSites: 2,
      priceSpread: 4,
      bulkPrices: { bulk_5: 6050, bulk_100: 5950 }
    }
  }
]
```

## 🔌 API統合ポイント

### 既存Worker API利用
CLI価格比較システムは既存のWorker APIを活用：

```javascript
// 価格更新API利用
const response = await fetch(`${WORKER_URL}/api/update-prices`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_PASSWORD}`
  },
  body: JSON.stringify({ updates })
});
```

### Web UIでの確認
CLI価格比較の結果は既存Web UIで確認可能：
- https://coin-price-checker.h-abe.workers.dev/admin
- 各サイトの価格が個別商品として表示

## 🔧 拡張性・将来設計

### 新サイト追加の容易性
```javascript
// 新スクレイパー追加
class NewSiteScraper extends BaseScraper {
  // サイト固有ロジック実装
}

// ファクトリーに登録
scrapers.set('newsite.com', new NewSiteScraper(browser));

// 商品マッピング更新
PRODUCT_MAPPINGS['product-key'].push({
  site: 'newsite.com',
  url: '...',
  name: '...'
});
```

### システム統合の可能性
将来的には以下の統合が可能：

1. **Web UIでの価格比較表示**
   - 複数サイト価格を一覧表示
   - 最安値ハイライト

2. **自動価格アラート**
   - 価格差が一定値以上で通知
   - 最安値サイト変更時の通知

3. **統合管理画面**
   - 商品マッピング管理UI
   - スケジュール設定

## 📊 パフォーマンス特性

### 既存システム
- **レスポンス時間**: ~100ms (Worker)
- **価格取得**: ~10秒/商品
- **同時ユーザー**: 複数対応
- **リアルタイム性**: 高

### CLI価格比較システム
- **実行時間**: 1-2分（全商品）
- **価格取得**: ~30秒/商品（複数サイト）
- **同時実行**: 1プロセス
- **バッチ処理**: 最適

## 🔄 運用シナリオ

### 日常運用での使い分け

#### Web UI（既存システム）
- **利用シーン**: 日常的な価格確認
- **ユーザー**: 一般ユーザー
- **頻度**: リアルタイム
- **目的**: 個別商品の価格監視

#### CLI価格比較システム
- **利用シーン**: 定期的な価格調査
- **ユーザー**: 管理者・アナリスト
- **頻度**: 1日数回（自動化）
- **目的**: 最安値発見・市場分析

---

**2つのシステムが相互補完的に動作し、包括的な価格監視ソリューションを提供します。**