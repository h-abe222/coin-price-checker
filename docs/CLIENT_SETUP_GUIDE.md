# 🪙 コイン価格チェッカー - クライアント向けセットアップガイド

## 📌 概要

このシステムは、複数のオンラインショップから金貨・銀貨の価格を自動取得し、Web画面で確認できるツールです。

## 🌐 Web画面へのアクセス

### URL
```
https://coin-price-checker-production.h-abe.workers.dev
```

### ログイン情報
- パスワード: `admin123`

## ⚠️ 重要な制限事項

**Web画面の「価格更新」ボタンは現在使用できません。**

理由：Cloudflareのセキュリティ制限により、Web画面から直接価格を取得することができません。

## ✅ 価格更新の方法

価格更新は以下の2つの方法で行えます：

### 方法1: GitHub Actionsによる自動更新（推奨）

**自動的に1日3回価格が更新されます**
- 日本時間 9:00
- 日本時間 15:00
- 日本時間 21:00

#### セットアップ手順

1. **GitHubアカウントを作成**
   - https://github.com でアカウント作成（無料）

2. **リポジトリをフォーク**
   - このプロジェクトのGitHubページで「Fork」ボタンをクリック

3. **Cloudflare APIトークンを取得**
   - Cloudflareにログイン
   - 「My Profile」→「API Tokens」→「Create Token」
   - 「Custom token」を選択
   - 以下の権限を設定：
     - Account: Cloudflare Workers Scripts:Edit
     - Account: D1:Edit

4. **GitHub Secretsを設定**
   - フォークしたリポジトリの「Settings」→「Secrets and variables」→「Actions」
   - 以下のSecretを追加：
     - `CLOUDFLARE_API_TOKEN`: 上記で作成したトークン
     - `CLOUDFLARE_ACCOUNT_ID`: CloudflareのアカウントID

5. **GitHub Actionsを有効化**
   - リポジトリの「Actions」タブ
   - 「I understand my workflows, go ahead and enable them」をクリック

### 方法2: 手動実行

GitHubから手動で価格更新を実行できます：

1. GitHubのリポジトリページで「Actions」タブを開く
2. 「価格自動更新」をクリック
3. 「Run workflow」ボタンをクリック
4. 「Run workflow」（緑）をクリック

約2-3分で価格が更新されます。

## 📊 商品管理

### 新しい商品の追加

1. Web画面にログイン
2. 「商品を追加」ボタンをクリック
3. 必要情報を入力：
   - 商品名（例：2025 メイプルリーフ 金貨 1オンス）
   - 自社商品ページURL（任意）
   - 画像URL（任意）

### 価格チェックURLの追加

1. 商品一覧から商品を選択
2. 「URL追加」をクリック
3. 価格をチェックしたいサイトのURLを入力
   - 対応サイト：BullionStar、APMEX、LPM、YBX.jp など

### 対応サイト

現在、以下のサイトから価格を自動取得できます：

- **BullionStar** (シンガポール) - SGD → JPY自動変換
- **APMEX** (アメリカ) - USD → JPY自動変換
- **LPM Group** (香港) - HKD → JPY自動変換
- **YBX.jp** (日本) - 日本円価格

## 🛠️ トラブルシューティング

### 価格が更新されない場合

1. **GitHub Actionsの実行状況を確認**
   - GitHubの「Actions」タブで実行履歴を確認
   - エラーが出ている場合は赤い×マークが表示されます

2. **手動実行を試す**
   - 上記「方法2」の手順で手動実行

3. **Cloudflare APIトークンを確認**
   - トークンの権限が正しく設定されているか確認
   - 必要に応じて新しいトークンを作成

### よくある質問

**Q: なぜWeb画面から価格更新できないの？**
A: セキュリティ上の制限により、Cloudflareから外部サイトへの直接アクセスが制限されているためです。

**Q: 価格更新の頻度を変更できる？**
A: はい。`.github/workflows/update-prices.yml`の`cron`設定を編集してください。

**Q: 新しいショップサイトを追加できる？**
A: 技術的には可能ですが、プログラムの修正が必要です。ご相談ください。

## 📞 サポート

問題が解決しない場合は、以下の情報を添えてご連絡ください：

- エラーメッセージのスクリーンショット
- 実行した手順
- 発生した日時

## 📝 更新履歴

- 2025/09/16: 初版作成
- GitHub Actions自動更新機能追加
- Web画面からの価格更新制限について記載