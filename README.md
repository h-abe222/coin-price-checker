# BullionStar 価格監視システム

Cloudflare Workers + D1 Database + GitHub Actions を使用した金・銀価格の自動監視システム

## 🚀 機能

- **Web管理画面**: 商品の追加・削除・設定をブラウザで完結
- **自動価格取得**: GitHub Actionsで毎日自動実行
- **リアルタイム価格**: Playwrightによる正確なスクレイピング
- **クラウドDB**: Cloudflare D1による高速データベース
- **洗練されたUI**: レスポンシブ対応の美しいインターフェース

## 📱 利用方法

### 1. 管理画面にアクセス
https://h-abe222.github.io/coin-price-checker/

### 2. ログイン
- パスワード: `admin123`

### 3. API設定
- Worker URL: `https://coin-price-checker.h-abe.workers.dev`
- 管理パスワード: `admin123`

### 4. 商品管理
- **新規登録**: BullionStarの商品URLを入力して追加
- **価格確認**: 自動取得された最新価格を表示
- **監視設定**: 商品ごとに監視のON/OFF切り替え

## ⚙️ 自動実行

### GitHub Actions（推奨）
- **実行頻度**: 毎日午前9時（日本時間）
- **手動実行**: GitHubのActionsタブから随時実行可能
- **設定済み**: 追加設定不要で自動実行

### ローカル実行
```bash
# 手動で価格チェック
npm run check-prices

# 依存関係インストール
npm install
npx playwright install
```

## 🛠 技術スタック

- **フロントエンド**: HTML5, TailwindCSS, JavaScript
- **バックエンド**: Cloudflare Workers
- **データベース**: Cloudflare D1 (SQLite)
- **価格取得**: Playwright + Chromium
- **自動実行**: GitHub Actions
- **ホスティング**: GitHub Pages

## 📊 監視対象

BullionStar (https://www.bullionstar.com) の金・銀製品
- 金貨・銀貨
- 金塊・銀塊
- 記念コイン

## 🔧 設定

### 環境変数
```env
WORKER_URL=https://coin-price-checker.h-abe.workers.dev
ADMIN_PASSWORD=admin123
```

### GitHub Secrets（自動実行用）
1. リポジトリの Settings → Secrets → Actions
2. 以下を追加:
   - `WORKER_URL`: `https://coin-price-checker.h-abe.workers.dev`
   - `ADMIN_PASSWORD`: `admin123`

## 📈 価格データ

- **取得頻度**: 1日1回（午前9時）
- **保存期間**: 無制限（D1データベース）
- **価格履歴**: 全て記録・表示可能
- **通貨**: 日本円（JPY）

## 🔄 デプロイ

```bash
# Cloudflare Workerをデプロイ
npm run deploy

# 設定確認
npx wrangler whoami
```

## 📝 ライセンス

MIT License