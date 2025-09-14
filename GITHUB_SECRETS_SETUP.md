# GitHub Secrets 設定ガイド

## 必要なSecrets一覧

以下のSecretsをGitHubリポジトリに設定してください。

### 設定URL
```
https://github.com/h-abe222/coin-price-checker/settings/secrets/actions
```

### 設定項目

| Secret名 | 値の例 | 説明 |
|----------|--------|------|
| `GMAIL_ADDRESS` | info@ybx.jp | Google Workspace送信元メール |
| `GMAIL_APP_PASSWORD` | xxxx xxxx xxxx xxxx | アプリパスワード（スペース含む） |
| `RECIPIENT_EMAIL` | notify@example.com | 通知先メールアドレス |
| `ADMIN_PASSWORD` | admin123 | 管理画面パスワード |
| `CURRENCY` | JPY | 通貨設定（JPY/SGD/USD） |

## 設定手順

1. 上記URLにアクセス
2. 「New repository secret」をクリック
3. Name欄にSecret名を入力
4. Value欄に値を入力
5. 「Add secret」をクリック

## Google Workspaceアプリパスワードの取得

1. info@ybx.jp でGoogleアカウントにログイン
2. https://myaccount.google.com/apppasswords へアクセス
3. アプリ：「メール」、デバイス：「その他」→「BullionStar」
4. 生成された16文字のパスワードをコピー

## 設定確認

すべてのSecretsを設定後、GitHub Actionsで手動実行してテスト：
1. https://github.com/h-abe222/coin-price-checker/actions
2. 「Price Monitor」ワークフロー
3. 「Run workflow」をクリック

---
設定完了後、毎日朝9:00（日本時間）に自動実行されます。