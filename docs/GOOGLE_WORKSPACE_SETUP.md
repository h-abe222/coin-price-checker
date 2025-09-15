# 📧 Google Workspace メール設定ガイド

## info@ybx.jp の設定方法

Google Workspaceで管理されているメールアドレスを使用する場合、以下の手順で設定してください。

## 🔐 方法1: アプリパスワード（推奨）

### 前提条件
- Google Workspace管理者権限
- 2段階認証の有効化

### 設定手順

#### 1. 2段階認証を有効化

1. Google管理コンソールにログイン
   ```
   https://admin.google.com
   ```

2. セキュリティ → 認証 → 2段階認証プロセス

3. info@ybx.jp アカウントで2段階認証を有効化

#### 2. アプリパスワードを生成

1. info@ybx.jp でGoogleアカウントにログイン
   ```
   https://myaccount.google.com
   ```

2. セキュリティ → 2段階認証プロセス → アプリパスワード

3. アプリを選択：「メール」
   デバイスを選択：「その他」→「BullionStar Monitor」

4. 生成された16文字のパスワードをコピー
   例: `abcd efgh ijkl mnop`

#### 3. GitHub Secretsに設定

```
https://github.com/h-abe222/coin-price-checker/settings/secrets/actions
```

| Secret名 | 値 |
|---------|-----|
| `GMAIL_ADDRESS` | info@ybx.jp |
| `GMAIL_APP_PASSWORD` | abcd efgh ijkl mnop（スペース含む） |
| `RECIPIENT_EMAIL` | 通知先メールアドレス |

## 🔑 方法2: OAuth 2.0（上級者向け）

### Google Cloud Consoleでの設定

1. Google Cloud Consoleにアクセス
   ```
   https://console.cloud.google.com
   ```

2. 新しいプロジェクトを作成または選択

3. Gmail APIを有効化
   - APIとサービス → ライブラリ
   - 「Gmail API」を検索して有効化

4. OAuth 2.0 認証情報を作成
   - APIとサービス → 認証情報
   - 「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類：「ウェブアプリケーション」

5. 認証情報をダウンロード（JSON形式）

## ⚙️ 管理者設定（Google Workspace）

### SMTPリレー設定（管理者のみ）

1. Google管理コンソールにログイン
   ```
   https://admin.google.com
   ```

2. アプリ → Google Workspace → Gmail → ルーティング

3. SMTP リレーサービスを設定：
   - 許可する送信者：info@ybx.jp
   - 認証：必須
   - TLS暗号化：必須

### ドメイン認証設定

SPF、DKIM、DMARCレコードの確認：

#### SPFレコード
```
v=spf1 include:_spf.google.com ~all
```

#### DKIMレコード
Google管理コンソールで確認：
- アプリ → Google Workspace → Gmail → ドメインの認証

#### DMARCレコード
```
v=DMARC1; p=none; rua=mailto:admin@ybx.jp
```

## 📝 環境変数設定（.env）

ローカルテスト用：

```env
# Google Workspace設定
GMAIL_ADDRESS=info@ybx.jp
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
RECIPIENT_EMAIL=recipient@example.com

# SMTP設定（カスタマイズ可能）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=true
```

## 🔧 Python コードの調整

`src/notifiers/email_notifier.py` の修正（必要な場合）：

```python
class EmailNotifier:
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = "info@ybx.jp"  # Google Workspace
        self.sender_password = os.getenv("GMAIL_APP_PASSWORD")
        self.recipient_email = os.getenv("RECIPIENT_EMAIL")

        # Google Workspace用の追加設定
        self.sender_name = "YBX価格監視システム"
```

## ✅ 動作確認

### テストメール送信

```python
# test_email.py
import smtplib
from email.mime.text import MIMEText

def test_email():
    sender = "info@ybx.jp"
    password = "your_app_password_here"
    recipient = "test@example.com"

    msg = MIMEText("テストメール from Google Workspace")
    msg['Subject'] = "BullionStar Monitor Test"
    msg['From'] = sender
    msg['To'] = recipient

    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)

    print("送信成功！")

if __name__ == "__main__":
    test_email()
```

## ⚠️ トラブルシューティング

### よくあるエラーと対処法

#### 1. 認証エラー
```
SMTPAuthenticationError: Username and Password not accepted
```
**対処法**:
- 2段階認証が有効か確認
- アプリパスワードが正しいか確認
- スペースも含めて正確に入力

#### 2. 送信制限エラー
```
Daily sending quota exceeded
```
**対処法**:
- Google Workspaceの送信制限を確認（通常2000通/日）
- 管理コンソールで制限を調整

#### 3. ドメイン認証エラー
```
Message rejected due to policy
```
**対処法**:
- SPF/DKIM/DMARC設定を確認
- 管理コンソールでSMTPリレーを許可

## 📊 Google Workspace 送信制限

| プラン | 1日あたりの送信制限 |
|--------|-------------------|
| Business Starter | 2,000通 |
| Business Standard | 2,000通 |
| Business Plus | 2,000通 |
| Enterprise | 10,000通 |

## 🔒 セキュリティ推奨事項

1. **専用サービスアカウントの作成**
   - monitor@ybx.jp などの専用アカウントを作成
   - 最小限の権限のみ付与

2. **IPアドレス制限**
   - GitHub ActionsのIPレンジを許可リストに追加

3. **監査ログの有効化**
   - Google管理コンソールで監査ログを有効化
   - 不正なアクセスを監視

## 📞 サポート

Google Workspace管理者に以下を確認してください：

- [ ] 2段階認証の有効化状態
- [ ] アプリパスワードの生成権限
- [ ] SMTP送信の許可設定
- [ ] 送信制限の確認

---

設定が完了したら、GitHub Secretsに以下を設定：

```
GMAIL_ADDRESS = info@ybx.jp
GMAIL_APP_PASSWORD = [生成されたアプリパスワード]
RECIPIENT_EMAIL = [通知先メールアドレス]
```

これで、info@ybx.jp から価格変動通知メールが送信されます。