# 🚀 Netlifyへのデプロイ手順（完全無料）

## なぜNetlifyか？
- **完全無料**（月100GBまで）
- **APIサーバー込み**（Netlify Functions）
- **自動デプロイ**（GitHubと連携）
- **設定が簡単**（5分で完了）

## 📋 デプロイ手順

### 1. Netlifyアカウント作成
1. https://www.netlify.com にアクセス
2. 「Sign up」→「GitHub」でログイン

### 2. 新しいサイトを作成
1. 「Add new site」→「Import an existing project」
2. 「GitHub」を選択
3. `h-abe222/coin-price-checker` リポジトリを選択

### 3. ビルド設定
以下の設定で進める：
- **Build command**: （空欄のまま）
- **Publish directory**: `.`
- 「Deploy site」をクリック

### 4. 環境変数の設定
1. Site settings → Environment variables
2. 以下を追加：
   - `ADMIN_PASSWORD`: admin123
   - `GMAIL_ADDRESS`: info@ybx.jp
   - `GMAIL_APP_PASSWORD`: [Googleアプリパスワード]
   - `RECIPIENT_EMAIL`: [通知先メール]
   - `CURRENCY`: JPY

### 5. デプロイ完了
- URLが発行される（例: https://amazing-site-123.netlify.app）
- このURLでアクセス可能

## 🎯 メリット
- **商品の追加・削除がWeb上で完結**
- **データの永続化**
- **API機能付き**
- **完全無料**

## 📱 使い方
1. 発行されたURLにアクセス
2. パスワード（admin123）でログイン
3. 商品の追加・削除が可能に！

## ⚡ 今すぐデプロイ

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/h-abe222/coin-price-checker)

このボタンをクリックすれば自動でデプロイできます！