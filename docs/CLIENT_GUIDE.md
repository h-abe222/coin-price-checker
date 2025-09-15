# 📚 BullionStar価格監視システム - ご利用ガイド

## 🌐 アクセスURL

### メイン管理画面
```
https://h-abe222.github.io/coin-price-checker/
```

### ログイン情報
- **初期パスワード**: `admin123`
- ※セキュリティのため、後で変更することをお勧めします

## 📋 主な機能

### 1. 商品一覧
- 監視中の金・銀商品の一覧表示
- 現在価格の確認
- 監視のON/OFF切り替え
- 商品の削除

### 2. 新規商品登録
- BullionStarの商品URLを入力
- URLテスト機能で事前確認
- ワンクリックで監視リストに追加

### 3. メール通知設定
- 価格変動時の通知先メール設定
- Gmail経由での自動通知
- 変動閾値の設定（デフォルト3%）

### 4. 価格履歴
- 過去30日間の価格推移グラフ
- 商品ごとの詳細履歴
- CSVエクスポート機能（準備中）

## 🚀 初期設定手順

### ステップ1: GitHub Secretsの設定

1. 以下のURLにアクセス
   ```
   https://github.com/h-abe222/coin-price-checker/settings/secrets/actions
   ```

2. 「New repository secret」をクリック

3. 以下の項目を設定：

   | Name | Value | 説明 |
   |------|-------|------|
   | `GMAIL_ADDRESS` | info@ybx.jp | 送信元メール（Google Workspace） |
   | `GMAIL_APP_PASSWORD` | xxxx xxxx xxxx xxxx | Google Workspaceアプリパスワード |
   | `RECIPIENT_EMAIL` | notify@example.com | 通知先メール |
   | `ADMIN_PASSWORD` | 任意のパスワード | 管理画面パスワード |
   | `CURRENCY` | JPY | 通貨（JPY/SGD/USD） |

### ステップ2: Google Workspace (info@ybx.jp) アプリパスワードの取得

1. info@ybx.jp でGoogleアカウントにログイン
   - https://accounts.google.com
   - info@ybx.jp とそのパスワードでログイン

2. セキュリティ設定を開く
   - https://myaccount.google.com/security

3. 2段階認証プロセスを有効化
   - 「2段階認証プロセス」をクリック
   - 電話番号または認証アプリを設定

4. アプリパスワードを生成
   - https://myaccount.google.com/apppasswords
   - アプリを選択：「メール」
   - デバイスを選択：「その他」→「BullionStar」と入力
   - 生成された16文字のパスワードをコピー

※ Google Workspace管理者権限が必要な場合があります

### ステップ3: 商品の登録

1. 管理画面にログイン
2. 「新規登録」タブをクリック
3. BullionStarの商品URLを入力
4. 「URLをテスト」→「商品を登録」

## 📊 データ管理

### 商品データの編集（上級者向け）

直接編集する場合：
```
https://github.com/h-abe222/coin-price-checker/edit/main/data/products.json
```

### データ構造
```json
{
  "product_628": {
    "id": 628,
    "url": "https://www.bullionstar.com/...",
    "name": "Canadian Gold Maple Leaf 1/2 oz",
    "enabled": true,
    "current_price": 302142
  }
}
```

## ⏰ 自動実行スケジュール

- **定期実行**: 毎日朝9:00（日本時間）
- **手動実行**: [GitHub Actions](https://github.com/h-abe222/coin-price-checker/actions)から可能

## 🔔 通知条件

以下の条件で自動通知：
- 価格が3%以上変動
- 7日間の最高値/最安値を更新
- エラー発生時

## 🛠️ トラブルシューティング

### ログインできない場合
1. パスワードが「admin123」であることを確認
2. ブラウザのキャッシュをクリア
3. プライベートブラウジングモードで試す

### 価格が更新されない場合
1. [GitHub Actions](https://github.com/h-abe222/coin-price-checker/actions)で実行状況を確認
2. 赤い×マークがある場合はエラー
3. 「Run workflow」で手動実行

### メールが届かない場合
1. Gmail設定を確認
2. 迷惑メールフォルダを確認
3. アプリパスワードが正しいか確認

## 📞 サポート

### よくある質問

**Q: パスワードを変更したい**
A: GitHub Secrets で `ADMIN_PASSWORD` を更新してください

**Q: 監視頻度を変更したい**
A: `.github/workflows/price_monitor.yml` の cron 設定を編集

**Q: 通貨を変更したい**
A: GitHub Secrets で `CURRENCY` を SGD/USD/EUR 等に変更

**Q: データをエクスポートしたい**
A: `data/price_history.json` をダウンロード

## 🔒 セキュリティ

- パスワードは定期的に変更してください
- GitHub Secretsは暗号化されて保存されます
- 価格データは公開リポジトリに保存されます（機密情報は含まれません）

## 📈 今後の機能追加予定

- [ ] 複数通貨の同時監視
- [ ] LINE通知対応
- [ ] 価格予測機能
- [ ] モバイルアプリ版
- [ ] APIエンドポイント提供

---

## 簡易利用マニュアル

### 毎日の確認方法

1. **管理画面にアクセス**
   ```
   https://h-abe222.github.io/coin-price-checker/
   ```

2. **パスワード入力**
   - 初期: `admin123`

3. **価格確認**
   - 商品一覧タブで現在価格を確認

4. **必要に応じて**
   - 新商品を追加
   - 通知設定を変更

### 緊急時の対応

価格を今すぐ確認したい場合：
1. 商品一覧の「今すぐ価格チェック」ボタン
2. GitHub Actionsページで「Run workflow」

---

このシステムは完全無料でご利用いただけます。
ご不明な点がございましたら、お気軽にお問い合わせください。