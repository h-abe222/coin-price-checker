# CLI価格比較システム - クイックスタート

## 🚀 5分で始める価格比較

### 前提条件
- Node.js 18+ がインストール済み
- プロジェクトのclone済み

### ステップ1: 依存関係インストール
```bash
cd coin-price-checker
npm install
npx playwright install
```

### ステップ2: 環境変数設定
```bash
# .envファイル作成
cp .env.example .env

# 必要に応じて編集
WORKER_URL=https://coin-price-checker.h-abe.workers.dev
ADMIN_PASSWORD=admin123
```

### ステップ3: システム確認
```bash
# サポートサイト・商品確認
npm run list-sites
```

### ステップ4: 価格比較実行
```bash
# 全商品比較
npm run compare-prices

# または特定商品のみ
npm run compare-product canadian-silver-maple-1oz
```

## 📊 出力例

```
📊 Price Comparison Results for Canadian Silver Maple Leaf 1oz
   Sites compared: 2
   Price range: ¥5,835 - ¥6,100
   Average: ¥5,967
   Spread: ¥265 (4%)

🏆 Best Deal: bullionstar.com
   Price: ¥5,835

📋 All Sites:
   🥇 bullionstar.com: ¥5,835
   🥈 lpm.hk: ¥6,100
      └─ bulk_5: ¥6,050
      └─ bulk_100: ¥5,950
```

## 🎯 利用可能コマンド

| コマンド | 説明 | 実行時間 |
|----------|------|----------|
| `npm run list-sites` | サポートサイト確認 | 1秒 |
| `npm run compare-prices` | 全商品比較 | 1-2分 |
| `npm run compare-product <name>` | 特定商品比較 | 20-30秒 |

## 💡 今すぐ試せる商品

```bash
# Canadian Silver Maple Leaf 1oz
npm run compare-product canadian-silver-maple-1oz

# American Gold Eagle 1oz
npm run compare-product american-gold-eagle-1oz

# Silver Bar 1kg
npm run compare-product silver-bar-1kg
```

## 🔧 トラブル時の対処

### エラーが出た場合
```bash
# Playwright再インストール
npx playwright install

# 詳細ログで実行
DEBUG=true npm run compare-product canadian-silver-maple-1oz
```

### 価格が取得できない場合
- ネットワーク接続確認
- サイトがアクセス可能か確認
- 時間を置いて再実行

---

**5分で複数サイト価格比較が始められます！**