# 🚀 デプロイメントガイド

## 推奨構成：GitHub Actions + GitHub Pages（完全無料）

### なぜこの構成が最適か？

| 項目 | GitHub Actions + Pages | Vercel | Render | Railway |
|------|----------------------|---------|---------|----------|
| **月額費用** | **$0** | $0〜$20 | $0〜$7 | $5〜 |
| **無料枠** | 2000分/月 | 100GB帯域 | 750時間 | なし |
| **制限** | なし | API制限 | スリープあり | 無料なし |
| **セットアップ** | 簡単 | 簡単 | 普通 | 普通 |
| **データ永続化** | Git履歴 | 外部DB必要 | 外部DB必要 | 外部DB必要 |

## セットアップ手順（5分で完了）

### 1. GitHub Pages を有効化

```bash
# リポジトリ設定
Settings → Pages → Source → Deploy from a branch
Branch: main → /docs → Save
```

### 2. GitHub Secrets を設定

```
Settings → Secrets and variables → Actions → New repository secret

必須:
- GMAIL_ADDRESS: 送信元Gmail
- GMAIL_APP_PASSWORD: アプリパスワード
- RECIPIENT_EMAIL: 通知先メール

オプション:
- CURRENCY: JPY（デフォルト）
- PRICE_CHANGE_THRESHOLD: 3.0
```

### 3. 商品を設定

`data/products.json` を編集してコミット：

```json
{
  "gold-maple-1-2oz": {
    "id": 628,
    "url": "https://www.bullionstar.com/buy/product/gold-maple-1-2oz-various-years",
    "name": "Canadian Gold Maple Leaf 1/2 oz",
    "enabled": true
  }
}
```

### 4. 動作確認

Actions タブから手動実行：
```
Actions → BullionStar Price Monitor → Run workflow
```

## 管理画面URL

デプロイ後、以下のURLでアクセス：
```
https://[あなたのユーザー名].github.io/coin-price-checker/
```

## システム構成

```
┌─────────────────────────────────────┐
│         GitHub Pages (無料)          │
│   静的Web UI（管理画面・状況確認）    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       GitHub Actions (無料)          │
│   ・毎日9時に自動実行                │
│   ・価格取得・比較・メール通知       │
│   ・価格履歴をGitに保存             │
└─────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│     BullionStar API / Gmail         │
└─────────────────────────────────────┘
```

## 機能一覧

### ✅ 実装済み機能
- 価格自動取得（毎日実行）
- 価格変動メール通知
- 価格履歴の永続保存
- 日本円対応
- Web管理画面（読み取り専用）
- 手動実行

### 🔄 制限事項
- 商品追加はGitHub上で編集
- リアルタイム更新なし（1日1回）
- 認証なし（パブリック）

## 他のホスティングサービスとの比較

### Vercel（静的サイト向け）
```bash
# デプロイ
vercel --prod

# 問題点
- APIの実行時間制限（10秒）
- データベース別途必要
- 定期実行は有料
```

### Render（フルスタック向け）
```bash
# render.yaml
services:
  - type: web
    name: price-monitor
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app

# 問題点
- 無料プランはスリープあり
- PostgreSQL別途必要（$7/月）
```

### Railway（本格運用向け）
```bash
# railway.json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "python app.py"
  }
}

# 問題点
- 無料プランなし
- 最低$5/月
```

## まとめ

**GitHub Actions + GitHub Pages** が最もコスト効率的：

- ✅ **完全無料**
- ✅ **メンテナンス不要**
- ✅ **データ永続化**（Git履歴）
- ✅ **高可用性**（GitHub SLA 99.9%）
- ✅ **セキュア**（Secrets管理）

クライアント様への納品には、この構成が最適です。