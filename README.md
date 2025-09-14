# Gold Price Monitor (金価格監視ツール)

BullionStar等の金価格を自動監視してメール通知するPythonツール

## 機能

- 🔍 BullionStarから金価格を自動取得
- 📧 価格変動時のメール通知
- 📊 価格履歴の追跡と分析
- ⚡ GitHub Actionsによる自動実行
- 🎯 閾値設定による柔軟なアラート

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/h-abe222/coin-price-checker.git
cd coin-price-checker
```

### 2. Python環境のセットアップ

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### 3. 環境変数の設定

`.env.example`をコピーして`.env`を作成：

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```env
GMAIL_ADDRESS=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_specific_password
RECIPIENT_EMAIL=recipient@example.com
THRESHOLD_PRICE=3000
```

### 4. Gmailアプリパスワードの取得

1. [Googleアカウント設定](https://myaccount.google.com/)にアクセス
2. セキュリティ → 2段階認証を有効化
3. アプリパスワードを生成
4. 生成されたパスワードを`GMAIL_APP_PASSWORD`に設定

## 使用方法

### ローカル実行

```bash
# 1回だけ実行
python run_monitor.py --once

# 継続的に監視（1時間ごと）
python run_monitor.py
```

### GitHub Actionsでの自動実行

1. GitHub Secretsを設定：
   - `GMAIL_ADDRESS`
   - `GMAIL_APP_PASSWORD`
   - `RECIPIENT_EMAIL`
   - `THRESHOLD_PRICE`（オプション）

2. Actionsが自動的に1時間ごとに実行されます

## プロジェクト構造

```
coin-price-checker/
├── src/
│   ├── scrapers/       # スクレイピングモジュール
│   ├── notifiers/      # 通知モジュール
│   └── analyzers/      # 分析モジュール
├── tests/              # テストコード
├── data/               # 価格履歴データ
├── .github/workflows/  # GitHub Actions設定
└── run_monitor.py      # メイン実行スクリプト
```

## アラート条件

- 閾値アラート: 設定価格を下回った場合
- 変動率アラート: 24時間で5%以上の変動
- 最高値/最安値アラート: 7日間の新記録

## 開発

### テスト実行

```bash
pip install -r requirements-dev.txt
pytest tests/ -v
```

### コードフォーマット

```bash
black src tests
flake8 src tests --max-line-length=120
```

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずissueを開いて変更内容を議論してください。