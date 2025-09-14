# Git・システム構成ガイド - 金価格監視ツール完全セットアップ

## 1. 初期環境セットアップ

### 1.1 必要なツールのインストール

```bash
# 開発環境の前提条件
# - Git 2.40以上
# - Python 3.11以上
# - GitHub CLI（推奨）

# GitHub CLI のインストール（Mac）
brew install gh

# GitHub CLI のインストール（Ubuntu/Debian）
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Python環境のセットアップ
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install --upgrade pip
```

### 1.2 Gitの初期設定

```bash
# グローバル設定
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input  # Mac/Linux
# git config --global core.autocrlf true  # Windows

# 推奨設定
git config --global pull.rebase false
git config --global fetch.prune true
git config --global diff.colorMoved zebra
```

## 2. プロジェクト初期化

### 2.1 リポジトリ作成とクローン

```bash
# GitHub CLIを使用した作成（推奨）
gh repo create gold-price-monitor \
  --public \
  --description "BullionStar等の金価格を自動監視してメール通知するツール" \
  --clone \
  --gitignore Python \
  --license MIT

cd gold-price-monitor

# または既存リポジトリをクローン
git clone https://github.com/YOUR_USERNAME/gold-price-monitor.git
cd gold-price-monitor
```

### 2.2 プロジェクト構造の作成

```bash
# ディレクトリ構造を一括作成
mkdir -p .github/{workflows,ISSUE_TEMPLATE} \
         src/{scrapers,notifiers,analyzers,utils} \
         data \
         tests \
         scripts \
         docs \
         config

# 空の__init__.pyファイルを作成
touch src/__init__.py \
      src/scrapers/__init__.py \
      src/notifiers/__init__.py \
      src/analyzers/__init__.py \
      src/utils/__init__.py \
      tests/__init__.py

# 基本ファイルを作成
touch .env.example \
      requirements.txt \
      requirements-dev.txt \
      README.md \
      CONTRIBUTING.md \
      .gitignore \
      run_monitor.py
```

### 2.3 .gitignore設定

**.gitignore**
```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
env/
ENV/
.venv

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# プロジェクト固有
.env
.env.local
*.log
logs/
data/price_history.json
data/last_alert.json
data/*.bak

# テスト
.coverage
htmlcov/
.pytest_cache/
.tox/

# Playwright
playwright-report/
test-results/

# 一時ファイル
*.tmp
temp/
tmp/
```

### 2.4 環境変数テンプレート

**.env.example**
```bash
# Gmail設定（送信元）
GMAIL_ADDRESS=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_specific_password

# 通知先
RECIPIENT_EMAIL=recipient@example.com

# オプション: 複数の通知先（カンマ区切り）
# RECIPIENT_EMAILS=email1@example.com,email2@example.com

# オプション: Slack Webhook（将来の拡張用）
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ

# デバッグ設定
DEBUG=false
LOG_LEVEL=INFO

# スクレイピング設定
RATE_LIMIT_DELAY=2
MAX_RETRIES=3
TIMEOUT=30
```

## 3. Git ブランチ戦略

### 3.1 ブランチ構成

```bash
main (or master)
├── develop
│   ├── feature/initial-scraper
│   ├── feature/email-notification
│   ├── feature/multi-site-support
│   └── feature/price-analysis
├── hotfix/critical-bug-fix
└── release/v1.0.0
```

### 3.2 ブランチ運用ルール

```bash
# 開発ブランチの作成
git checkout -b develop
git push -u origin develop

# 機能開発の開始
git checkout develop
git pull origin develop
git checkout -b feature/bullionstar-scraper

# 作業とコミット
git add .
git commit -m "feat: Add BullionStar scraper implementation"

# developへのマージ（プルリクエスト推奨）
git push origin feature/bullionstar-scraper
# GitHub上でPull Requestを作成

# ローカルでのマージ（小規模な変更の場合）
git checkout develop
git merge --no-ff feature/bullionstar-scraper
git push origin develop
```

### 3.3 コミットメッセージ規約

```bash
# Conventional Commits形式を採用
<type>(<scope>): <subject>

# type:
# - feat: 新機能
# - fix: バグ修正
# - docs: ドキュメント
# - style: コードスタイル変更
# - refactor: リファクタリング
# - test: テスト追加・修正
# - chore: ビルド・補助ツール変更

# 例:
git commit -m "feat(scraper): Add retry logic for network errors"
git commit -m "fix(email): Correct price formatting in notifications"
git commit -m "docs: Update installation instructions"
git commit -m "chore(deps): Update playwright to v1.41.0"
```

## 4. GitHub設定

### 4.1 GitHub Secrets設定（必須）

```bash
# GitHub CLIで設定
gh secret set GMAIL_ADDRESS
gh secret set GMAIL_APP_PASSWORD
gh secret set RECIPIENT_EMAIL

# または GitHub Web UIで設定:
# Settings > Secrets and variables > Actions > New repository secret
```

### 4.2 GitHub Actions権限設定

```yaml
# リポジトリ設定で Actions の権限を確認
# Settings > Actions > General > Workflow permissions
# "Read and write permissions" を選択（価格履歴をコミットするため）
```

### 4.3 Branch Protection Rules

```bash
# main ブランチの保護設定
# Settings > Branches > Add rule

# 推奨設定:
- Require pull request reviews before merging
- Dismiss stale pull request approvals when new commits are pushed
- Require status checks to pass before merging
  - Required checks: test
- Include administrators
- Restrict who can push to matching branches
```

## 5. CI/CD パイプライン

### 5.1 テスト用ワークフロー

**.github/workflows/test.yml**
```yaml
name: Test

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.11', '3.12']
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Cache pip packages
      uses: actions/cache@v3
      with:
        path: ~/.cache/pip
        key: ${{ runner.os }}-pip-${{ hashFiles('requirements*.txt') }}
    
    - name: Install dependencies
      run: |
        pip install --upgrade pip
        pip install -r requirements.txt
        pip install -r requirements-dev.txt
        playwright install chromium
        playwright install-deps chromium
    
    - name: Run linting
      run: |
        # flake8チェック
        flake8 src tests --max-line-length=120
        
        # black形式チェック
        black --check src tests
    
    - name: Run tests
      run: |
        pytest tests/ -v --cov=src --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        fail_ci_if_error: false
```

### 5.2 セキュリティチェック

**.github/workflows/security.yml**
```yaml
name: Security Check

on:
  schedule:
    - cron: '0 0 * * 1'  # 毎週月曜日
  push:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Run Bandit Security Check
      uses: gaurav-nelson/bandit-action@v1
      with:
        path: "src/"
    
    - name: Safety check
      run: |
        pip install safety
        safety check --json
    
    - name: Dependency Review
      uses: actions/dependency-review-action@v3
      if: github.event_name == 'pull_request'
```

## 6. 開発環境セットアップ

### 6.1 仮想環境と依存関係

**requirements.txt**
```txt
playwright==1.41.0
python-dotenv==1.0.0
pydantic==2.5.0
aiohttp==3.9.1
jinja2==3.1.2
pyyaml==6.0.1
```

**requirements-dev.txt**
```txt
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
black==23.12.0
flake8==6.1.0
mypy==1.7.1
pre-commit==3.6.0
```

### 6.2 Pre-commit設定

**.pre-commit-config.yaml**
```yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-json
      - id: check-merge-conflict
      
  - repo: https://github.com/psf/black
    rev: 23.12.0
    hooks:
      - id: black
        language_version: python3.11
        
  - repo: https://github.com/PyCQA/flake8
    rev: 6.1.0
    hooks:
      - id: flake8
        args: ['--max-line-length=120', '--ignore=E203,W503']
```

```bash
# pre-commit インストール
pip install pre-commit
pre-commit install
pre-commit run --all-files  # 初回チェック
```

## 7. デプロイ手順

### 7.1 初回デプロイチェックリスト

```bash
# 1. 依存関係のインストール
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 2. 環境変数の設定
cp .env.example .env
# .env ファイルを編集

# 3. ローカルテスト実行
python scripts/test_local.py

# 4. ユニットテスト実行
pytest tests/ -v

# 5. GitHub Secrets設定
gh secret set GMAIL_ADDRESS < .env
gh secret set GMAIL_APP_PASSWORD < .env
gh secret set RECIPIENT_EMAIL < .env

# 6. 初回コミット
git add .
git commit -m "feat: Initial implementation of gold price monitor"
git push origin main

# 7. GitHub Actions の手動実行
gh workflow run price_monitor.yml

# 8. 実行結果の確認
gh run list --workflow=price_monitor.yml
gh run view  # 最新の実行を表示
```

### 7.2 本番環境チェック

```bash
# Actions の実行状態確認
gh workflow list
gh run list --limit 5

# ログの確認
gh run view --log

# Secrets の確認（値は表示されない）
gh secret list
```

## 8. トラブルシューティング

### 8.1 よくある問題と解決方法

```bash
# Permission denied (publickey) エラー
ssh-keygen -t ed25519 -C "your_email@example.com"
gh ssh-key add ~/.ssh/id_ed25519.pub

# GitHub Actions が実行されない
# - workflows フォルダのパスを確認: .github/workflows/
# - YAMLファイルの構文を確認
# - ブランチ名が on: で指定したものと一致しているか確認

# Secrets が読み込めない
# - Secrets名が環境変数名と完全一致しているか確認
# - Secretsがリポジトリレベルで設定されているか確認

# Playwright のインストールエラー
playwright install-deps  # システム依存関係をインストール
```

### 8.2 デバッグモード

```bash
# ローカルでの詳細ログ出力
DEBUG=true LOG_LEVEL=DEBUG python run_monitor.py

# GitHub Actions でのデバッグ
# workflow ファイルに追加:
env:
  ACTIONS_RUNNER_DEBUG: true
  ACTIONS_STEP_DEBUG: true
```

## 9. リリース管理

### 9.1 バージョニング

```bash
# Semantic Versioning (SemVer) を採用
# MAJOR.MINOR.PATCH (例: 1.0.0)

# タグの作成
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# GitHub Release の作成
gh release create v1.0.0 \
  --title "Release v1.0.0" \
  --notes "Initial release with BullionStar scraper support"
```

### 9.2 変更履歴管理

**CHANGELOG.md**
```markdown
# Changelog

## [1.0.0] - 2024-01-XX
### Added
- Initial BullionStar scraper implementation
- Email notification system
- GitHub Actions automation
- Price history tracking

### Changed
- N/A

### Fixed
- N/A
```

## 10. セキュリティベストプラクティス

### 10.1 機密情報の管理

```bash
# 絶対にコミットしてはいけないファイル
# - .env (環境変数)
# - *.pem, *.key (秘密鍵)
# - data/price_history.json (必要に応じて)

# 誤ってコミットした場合の対処
git rm --cached .env
git commit -m "Remove .env from repository"
git push origin main

# 履歴からも完全に削除する場合（注意）
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

### 10.2 依存関係の管理

```bash
# 定期的な依存関係の更新
pip list --outdated
pip-audit  # セキュリティ脆弱性チェック

# Dependabot の有効化（GitHub）
# Settings > Security & analysis > Dependabot alerts を有効化
```

## まとめ

このガイドに従うことで、以下が実現できます：

1. **適切なGit管理** - ブランチ戦略とコミット規約
2. **自動化されたCI/CD** - テスト、セキュリティチェック、デプロイ
3. **セキュアな運用** - Secrets管理、依存関係の監視
4. **保守性の高い構造** - 明確なディレクトリ構成とドキュメント

開発開始時はこのガイドの手順を上から順に実行していけば、プロフェッショナルな開発環境が構築できます。