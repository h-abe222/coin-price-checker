# 商品マッピング設定ガイド

## 🎯 概要

商品マッピングは、同じ商品の複数サイトでのURL・名称を定義する設定ファイルです。

## 📁 設定ファイル

**ファイル**: `cloudflare/scrapers/scraper_factory.js`

```javascript
export const PRODUCT_MAPPINGS = {
  'product-key': [
    { site: 'site1.com', url: '...', name: '...' },
    { site: 'site2.com', url: '...', name: '...' }
  ]
};
```

## 📋 現在の設定

### 1. Canadian Silver Maple Leaf 1oz
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

### 2. American Gold Eagle 1oz
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

### 3. Silver Bar 1kg
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

## ➕ 新商品追加手順

### ステップ1: 商品キー決定
```javascript
// 命名規則: 商品名-重量-単位
'canadian-gold-maple-1oz'     // カナダ金メープル 1オンス
'american-silver-eagle-1oz'   // アメリカ銀イーグル 1オンス
'pamp-gold-bar-100g'          // PAMP金バー 100g
'perth-silver-kangaroo-1oz'   // パース銀カンガルー 1オンス
```

### ステップ2: URL調査
各サイトで同じ商品のURLを調査：

#### BullionStar URL確認
```bash
# BullionStarサイトで商品検索
https://www.bullionstar.com/buy/silver-coins/canadian-maple-leaf
→ 商品ページのURLをコピー
```

#### LPM URL確認
```bash
# LPMサイトで商品検索
https://www.lpm.hk/en/products/silver-coins/
→ 対応商品のURLをコピー
```

### ステップ3: マッピング追加
```javascript
// cloudflare/scrapers/scraper_factory.js
export const PRODUCT_MAPPINGS = {
  // 既存商品...

  'new-product-key': [
    {
      site: 'bullionstar.com',
      url: 'https://www.bullionstar.com/buy/product/new-product-url',
      name: 'New Product Name'
    },
    {
      site: 'lpm.hk',
      url: 'https://www.lpm.hk/en/products/category/new-product-url',
      name: 'New Product Name'
    }
  ]
};
```

### ステップ4: テスト実行
```bash
# 新商品の価格比較テスト
npm run compare-product new-product-key

# サポート商品リスト確認
npm run list-sites
```

## 🔧 商品マッピングの詳細設定

### 基本構造
```javascript
{
  // 商品キー（一意、英数字-のみ）
  'product-key': [
    {
      site: 'サイトドメイン',        // 例: 'bullionstar.com'
      url: '商品URL',              // 完全URL
      name: '商品名',              // 表示用商品名
      category: 'カテゴリ',        // オプション
      priority: 1                  // オプション（優先度）
    }
  ]
}
```

### 高度な設定例
```javascript
'premium-gold-maple-1oz': [
  {
    site: 'bullionstar.com',
    url: 'https://www.bullionstar.com/buy/product/gold-maple-leaf-1oz',
    name: 'Canadian Gold Maple Leaf 1oz Premium',
    category: 'gold-coins',
    priority: 1,
    notes: 'Singapore-based dealer'
  },
  {
    site: 'lpm.hk',
    url: 'https://www.lpm.hk/en/products/gold-coins/maple-leaf-1oz',
    name: 'Canadian Gold Maple Leaf 1oz Premium',
    category: 'gold-coins',
    priority: 2,
    notes: 'Hong Kong dealer with bulk pricing'
  }
]
```

## 🌐 サイト別URL特徴

### BullionStar URL構造
```bash
基本形式: https://www.bullionstar.com/buy/product/{product-slug}

例:
- silver-maple-leaf-1oz-various
- gold-eagle-1oz-various
- silver-bullionstar-1kg
- gold-buffalo-1oz-various
```

### LPM URL構造
```bash
基本形式: https://www.lpm.hk/en/products/{category}/{product-slug}

カテゴリ:
- silver-coins/
- gold-coins/
- silver-bars/
- gold-bars/

例:
- silver-coins/canadian-maple-leaf-1oz
- gold-coins/american-eagle-1oz
- silver-bars/generic-1kg
```

## 📊 マッピング管理のベストプラクティス

### 1. 命名規則
```javascript
// 良い例
'canadian-silver-maple-1oz'
'american-gold-eagle-1oz'
'pamp-gold-bar-100g'

// 悪い例
'maple'
'gold_coin_1'
'product-123'
```

### 2. URL検証
新しいマッピング追加時は必ずURL検証：

```bash
# URLが有効かテスト
curl -I "https://www.bullionstar.com/buy/product/new-product"
curl -I "https://www.lpm.hk/en/products/category/new-product"
```

### 3. 商品名統一
同じ商品は各サイトで同じ名前に統一：

```javascript
// 統一された商品名
'canadian-silver-maple-1oz': [
  { name: 'Canadian Silver Maple Leaf 1oz' },  // 統一
  { name: 'Canadian Silver Maple Leaf 1oz' }   // 統一
]

// NG: 異なる商品名
'canadian-silver-maple-1oz': [
  { name: 'Canadian Maple Leaf Silver 1oz' },     // 順序が違う
  { name: 'Silver Maple Leaf 1oz (Canadian)' }    // 形式が違う
]
```

## 🔄 マッピング更新・メンテナンス

### URL変更への対応
```javascript
// 旧URL（変更前）
'canadian-silver-maple-1oz': [
  {
    site: 'bullionstar.com',
    url: 'https://www.bullionstar.com/buy/product/old-url',  // 古いURL
    name: 'Canadian Silver Maple Leaf 1oz'
  }
]

// 新URL（変更後）
'canadian-silver-maple-1oz': [
  {
    site: 'bullionstar.com',
    url: 'https://www.bullionstar.com/buy/product/new-url',  // 新しいURL
    name: 'Canadian Silver Maple Leaf 1oz'
  }
]
```

### サイト追加時の拡張
```javascript
// 新サイト追加例
'canadian-silver-maple-1oz': [
  // 既存サイト
  { site: 'bullionstar.com', url: '...', name: '...' },
  { site: 'lpm.hk', url: '...', name: '...' },

  // 新サイト追加
  {
    site: 'apmex.com',
    url: 'https://www.apmex.com/product/12345/canadian-silver-maple',
    name: 'Canadian Silver Maple Leaf 1oz'
  }
]
```

## 🧪 テスト・検証

### 新マッピングのテスト手順
```bash
# 1. 構文チェック
node -c cloudflare/scrapers/scraper_factory.js

# 2. 商品リスト確認
npm run list-sites

# 3. 個別商品テスト
npm run compare-product new-product-key

# 4. 全商品テスト
npm run compare-prices
```

### デバッグ用詳細実行
```bash
# デバッグモードで実行
DEBUG=true npm run compare-product canadian-silver-maple-1oz
```

## 📈 運用監視

### マッピング有効性チェック
```bash
# 定期実行で各マッピングの有効性確認
npm run compare-prices 2>&1 | grep -E "(Failed|Error|404)"
```

### 成功率監視
```javascript
// ログから成功率算出
const totalProducts = Object.keys(PRODUCT_MAPPINGS).length;
const successfulProducts = results.filter(r => r.success).length;
const successRate = (successfulProducts / totalProducts) * 100;
```

---

**商品マッピングの適切な設定により、正確な価格比較が実現されます。**