# BullionStar価格監視ツール開発指示書

## プロジェクト概要

**目的**: BullionStarの金・銀製品の価格を毎日自動監視し、価格変動時にメール通知する

**主要機能**:
- BullionStarから指定商品の価格を自動取得
- 前回価格との比較・変動率計算
- 閾値超過時のメール通知
- GitHub Actions による完全自動化（無料）

## 技術要件

```yaml
プログラミング言語: Python 3.11
スクレイピング: Playwright
通知: Gmail SMTP
自動化: GitHub Actions
データ保存: JSON (GitHubリポジトリ内)
実行頻度: 1日1回（拡張可能）
コスト: 0円/月
```

## プロジェクト構造

```
bullionstar-price-monitor/
├── .github/
│   └── workflows/
│       └── monitor.yml          # 自動実行設定
├── src/
│   ├── scraper.py              # BullionStarスクレイパー
│   ├── analyzer.py             # 価格分析
│   ├── notifier.py             # メール通知
│   └── config.py               # 設定管理
├── data/
│   └── .gitkeep                # 空フォルダ保持
├── monitor.py                  # メインスクリプト
├── requirements.txt            # 依存パッケージ
├── .env.example               # 環境変数テンプレート
├── .gitignore                 # Git除外設定
└── README.md                  # プロジェクト説明
```

## 実装コード

### 1. 依存パッケージ定義

**requirements.txt**
```txt
playwright==1.41.0
python-dotenv==1.0.0
aiofiles==23.2.1
```

### 2. 環境変数テンプレート

**.env.example**
```bash
# Gmail設定（2段階認証とアプリパスワードが必要）
GMAIL_ADDRESS=your_email@gmail.com
GMAIL_APP_PASSWORD=xxxx_xxxx_xxxx_xxxx

# 通知先メールアドレス
RECIPIENT_EMAIL=recipient@example.com

# 価格変動の閾値（%）
PRICE_CHANGE_THRESHOLD=3.0

# デバッグモード
DEBUG=false
```

### 3. Git除外設定

**.gitignore**
```gitignore
# 環境変数
.env

# Python
__pycache__/
*.py[cod]
.venv/
venv/

# データファイル
data/*.json
!data/.gitkeep

# ログ
*.log

# IDE
.vscode/
.idea/
```

### 4. メインスクレイパー実装

**src/scraper.py**
```python
"""
BullionStar価格スクレイパー
動的レンダリングされるページから価格データを取得
"""

import asyncio
import re
from typing import Dict, Optional
from datetime import datetime
from playwright.async_api import async_playwright, Page
import logging

logger = logging.getLogger(__name__)

class BullionStarScraper:
    """BullionStar専用スクレイパー"""
    
    # 監視対象商品の定義
    PRODUCTS = {
        "gold-maple-1-2oz": {
            "url": "https://www.bullionstar.com/buy/product/gold-maple-1-2oz-various-years",
            "name": "Canadian Gold Maple Leaf 1/2 oz"
        },
        "gold-maple-1oz": {
            "url": "https://www.bullionstar.com/buy/product/gold-maple-1oz-various-years",
            "name": "Canadian Gold Maple Leaf 1 oz"
        },
        "silver-maple-1oz": {
            "url": "https://www.bullionstar.com/buy/product/silver-maple-1oz-various-years",
            "name": "Canadian Silver Maple Leaf 1 oz"
        }
    }
    
    def __init__(self):
        self.browser = None
        self.context = None
        
    async def initialize(self):
        """ブラウザを初期化"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        )
        logger.info("Browser initialized")
    
    async def cleanup(self):
        """リソースをクリーンアップ"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        logger.info("Browser cleaned up")
    
    async def scrape_prices(self) -> Dict[str, Dict]:
        """全商品の価格を取得"""
        results = {}
        page = await self.context.new_page()
        
        for product_id, product_info in self.PRODUCTS.items():
            try:
                logger.info(f"Scraping {product_info['name']}")
                price = await self._scrape_single_product(page, product_info['url'])
                
                if price:
                    results[product_id] = {
                        'name': product_info['name'],
                        'price': price,
                        'url': product_info['url'],
                        'timestamp': datetime.now().isoformat()
                    }
                    logger.info(f"Price found: ${price:.2f}")
                else:
                    logger.warning(f"No price found for {product_info['name']}")
                
                # レート制限対策
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Error scraping {product_id}: {e}")
        
        await page.close()
        return results
    
    async def _scrape_single_product(self, page: Page, url: str) -> Optional[float]:
        """単一商品の価格を取得"""
        await page.goto(url, wait_until='networkidle')
        
        # 価格取得の複数戦略
        price = None
        
        # 戦略1: メインの価格セレクター
        try:
            price_element = await page.wait_for_selector(
                '.product-price .price-value, .product-info .price, [data-price]',
                timeout=10000
            )
            if price_element:
                price_text = await price_element.inner_text()
                price = self._parse_price(price_text)
        except:
            pass
        
        # 戦略2: JavaScript評価
        if not price:
            try:
                price = await page.evaluate("""
                    () => {
                        // 価格要素を探す
                        const priceEl = document.querySelector('[data-price]') || 
                                       document.querySelector('.price-value') ||
                                       document.querySelector('.product-price');
                        if (priceEl) {
                            const priceText = priceEl.textContent || priceEl.dataset.price;
                            return parseFloat(priceText.replace(/[^0-9.]/g, ''));
                        }
                        return null;
                    }
                """)
            except:
                pass
        
        return price
    
    def _parse_price(self, price_text: str) -> float:
        """価格テキストを数値に変換"""
        # $記号、カンマ、空白を削除
        cleaned = re.sub(r'[\$,\s]', '', price_text)
        # 数値部分を抽出
        match = re.search(r'(\d+\.?\d*)', cleaned)
        if match:
            return float(match.group(1))
        raise ValueError(f"Cannot parse price: {price_text}")
    
    async def run(self) -> Dict[str, Dict]:
        """スクレイピングを実行"""
        try:
            await self.initialize()
            return await self.scrape_prices()
        finally:
            await self.cleanup()
```

### 5. 価格分析モジュール

**src/analyzer.py**
```python
"""
価格変動分析
前回価格との比較と通知判定
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

class PriceAnalyzer:
    """価格変動を分析"""
    
    def __init__(self, history_file: Path = Path("data/price_history.json")):
        self.history_file = history_file
        self.history_file.parent.mkdir(exist_ok=True)
        
    def load_history(self) -> Dict:
        """価格履歴を読み込み"""
        if self.history_file.exists():
            with open(self.history_file, 'r') as f:
                return json.load(f)
        return {}
    
    def save_history(self, history: Dict):
        """価格履歴を保存"""
        with open(self.history_file, 'w') as f:
            json.dump(history, f, indent=2)
    
    def analyze(self, current_prices: Dict[str, Dict], threshold: float = 3.0) -> List[Dict]:
        """
        価格変動を分析
        
        Args:
            current_prices: 現在の価格データ
            threshold: 通知閾値（%）
        
        Returns:
            通知が必要な価格変動のリスト
        """
        history = self.load_history()
        alerts = []
        
        for product_id, current_data in current_prices.items():
            current_price = current_data['price']
            
            # 前回価格と比較
            if product_id in history:
                previous_price = history[product_id]['price']
                
                # 変動率計算
                change_percent = ((current_price - previous_price) / previous_price) * 100
                
                # 閾値チェック
                if abs(change_percent) >= threshold:
                    alerts.append({
                        'product_id': product_id,
                        'product_name': current_data['name'],
                        'current_price': current_price,
                        'previous_price': previous_price,
                        'change_percent': change_percent,
                        'url': current_data['url']
                    })
            
            # 履歴更新
            history[product_id] = current_data
        
        # 履歴保存
        self.save_history(history)
        
        return alerts
```

### 6. メール通知モジュール

**src/notifier.py**
```python
"""
メール通知
Gmail SMTP経由で価格変動アラートを送信
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict
import os
from datetime import datetime

class EmailNotifier:
    """Gmail経由でメール通知"""
    
    def __init__(self):
        self.smtp_server = "smtp.gmail.com"
        self.smtp_port = 587
        self.sender_email = os.getenv("GMAIL_ADDRESS")
        self.sender_password = os.getenv("GMAIL_APP_PASSWORD")
        self.recipient_email = os.getenv("RECIPIENT_EMAIL")
        
        if not all([self.sender_email, self.sender_password, self.recipient_email]):
            raise ValueError("Email configuration missing. Check environment variables.")
    
    def send_alert(self, alerts: List[Dict]):
        """価格変動アラートを送信"""
        if not alerts:
            return
        
        subject = f"BullionStar Price Alert - {len(alerts)} changes detected"
        body = self._create_email_body(alerts)
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = self.sender_email
        msg['To'] = self.recipient_email
        
        html_part = MIMEText(body, 'html')
        msg.attach(html_part)
        
        with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
            server.starttls()
            server.login(self.sender_email, self.sender_password)
            server.send_message(msg)
        
        print(f"Alert email sent to {self.recipient_email}")
    
    def _create_email_body(self, alerts: List[Dict]) -> str:
        """メール本文をHTML形式で作成"""
        html = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; }}
                .header {{ background-color: #f0f0f0; padding: 20px; }}
                .alert {{ border: 1px solid #ddd; margin: 10px 0; padding: 15px; }}
                .price-up {{ color: #27ae60; }}
                .price-down {{ color: #e74c3c; }}
                .footer {{ margin-top: 30px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>BullionStar Price Alert</h2>
                <p>{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
        """
        
        for alert in alerts:
            change_class = "price-up" if alert['change_percent'] > 0 else "price-down"
            sign = "+" if alert['change_percent'] > 0 else ""
            
            html += f"""
            <div class="alert">
                <h3>{alert['product_name']}</h3>
                <table>
                    <tr>
                        <td><strong>Current Price:</strong></td>
                        <td>${alert['current_price']:.2f}</td>
                    </tr>
                    <tr>
                        <td><strong>Previous Price:</strong></td>
                        <td>${alert['previous_price']:.2f}</td>
                    </tr>
                    <tr>
                        <td><strong>Change:</strong></td>
                        <td class="{change_class}">
                            {sign}{alert['change_percent']:.2f}%
                        </td>
                    </tr>
                </table>
                <p><a href="{alert['url']}">View Product</a></p>
            </div>
            """
        
        html += """
            <div class="footer">
                <p>This is an automated alert from BullionStar Price Monitor.</p>
                <p>To adjust settings, update the GitHub repository configuration.</p>
            </div>
        </body>
        </html>
        """
        
        return html
```

### 7. 設定管理

**src/config.py**
```python
"""
設定管理
環境変数と定数の管理
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# .envファイルを読み込み
load_dotenv()

class Config:
    """設定クラス"""
    
    # Gmail設定
    GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
    GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
    RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL")
    
    # 価格変動閾値（%）
    PRICE_CHANGE_THRESHOLD = float(os.getenv("PRICE_CHANGE_THRESHOLD", "3.0"))
    
    # デバッグモード
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"
    
    # ファイルパス
    DATA_DIR = Path("data")
    HISTORY_FILE = DATA_DIR / "price_history.json"
    
    @classmethod
    def validate(cls):
        """設定を検証"""
        required = ["GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "RECIPIENT_EMAIL"]
        missing = [var for var in required if not getattr(cls, var)]
        
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")
        
        return True

# ロギング設定
import logging

def setup_logging():
    """ロギングを設定"""
    level = logging.DEBUG if Config.DEBUG else logging.INFO
    
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
```

### 8. メインスクリプト

**monitor.py**
```python
#!/usr/bin/env python3
"""
BullionStar価格監視ツール
メインエントリーポイント
"""

import asyncio
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from src.config import Config, setup_logging
from src.scraper import BullionStarScraper
from src.analyzer import PriceAnalyzer
from src.notifier import EmailNotifier
import logging

async def main():
    """メイン処理"""
    # ロギング設定
    setup_logging()
    logger = logging.getLogger(__name__)
    
    logger.info("=" * 50)
    logger.info("BullionStar Price Monitor Started")
    logger.info("=" * 50)
    
    try:
        # 設定検証
        Config.validate()
        
        # 価格取得
        logger.info("Fetching prices from BullionStar...")
        scraper = BullionStarScraper()
        current_prices = await scraper.run()
        
        if not current_prices:
            logger.error("No prices retrieved")
            return 1
        
        logger.info(f"Retrieved {len(current_prices)} prices")
        
        # 価格分析
        logger.info("Analyzing price changes...")
        analyzer = PriceAnalyzer(Config.HISTORY_FILE)
        alerts = analyzer.analyze(current_prices, Config.PRICE_CHANGE_THRESHOLD)
        
        if alerts:
            logger.info(f"Found {len(alerts)} price alerts:")
            for alert in alerts:
                sign = "+" if alert['change_percent'] > 0 else ""
                logger.info(
                    f"  {alert['product_name']}: "
                    f"${alert['current_price']:.2f} "
                    f"({sign}{alert['change_percent']:.2f}%)"
                )
            
            # メール送信
            logger.info("Sending email notification...")
            notifier = EmailNotifier()
            notifier.send_alert(alerts)
            logger.info("Email sent successfully")
        else:
            logger.info("No significant price changes detected")
        
        logger.info("Monitor completed successfully")
        return 0
        
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
```

### 9. GitHub Actions設定

**.github/workflows/monitor.yml**
```yaml
name: BullionStar Price Monitor

on:
  schedule:
    # 毎日日本時間 9:00 に実行 (UTC 0:00)
    - cron: '0 0 * * *'
  workflow_dispatch:  # 手動実行も可能

jobs:
  monitor:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Cache pip packages
      uses: actions/cache@v3
      with:
        path: ~/.cache/pip
        key: ${{ runner.os }}-pip-${{ hashFiles('requirements.txt') }}
        restore-keys: |
          ${{ runner.os }}-pip-
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
        playwright install chromium
        playwright install-deps chromium
    
    - name: Run monitor
      env:
        GMAIL_ADDRESS: ${{ secrets.GMAIL_ADDRESS }}
        GMAIL_APP_PASSWORD: ${{ secrets.GMAIL_APP_PASSWORD }}
        RECIPIENT_EMAIL: ${{ secrets.RECIPIENT_EMAIL }}
        PRICE_CHANGE_THRESHOLD: ${{ vars.PRICE_CHANGE_THRESHOLD || '3.0' }}
      run: |
        python monitor.py
    
    - name: Commit price history
      if: success()
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add data/price_history.json || true
        git diff --quiet && git diff --staged --quiet || \
          git commit -m "Update price history [skip ci]"
        git push || true
```

### 10. README

**README.md**
```markdown
# BullionStar Price Monitor

自動的にBullionStarの貴金属価格を監視し、価格変動時にメール通知するツール。

## 機能

- 🔍 BullionStarから金・銀製品の価格を自動取得
- 📊 価格変動率の計算と履歴管理
- 📧 閾値を超えた変動時のメール通知
- 🤖 GitHub Actions による完全自動化（無料）

## セットアップ

### 1. リポジトリをフォーク/クローン

```bash
git clone https://github.com/YOUR_USERNAME/bullionstar-price-monitor.git
cd bullionstar-price-monitor
```

### 2. GitHub Secrets設定

リポジトリの Settings > Secrets and variables > Actions で以下を設定：

- `GMAIL_ADDRESS`: 送信元Gmailアドレス
- `GMAIL_APP_PASSWORD`: Gmailアプリパスワード（2段階認証必須）
- `RECIPIENT_EMAIL`: 通知先メールアドレス

### 3. 実行

自動実行: 毎日UTC 0:00（日本時間9:00）
手動実行: Actions タブから "Run workflow" をクリック

## カスタマイズ

### 監視商品の変更

`src/scraper.py` の `PRODUCTS` 辞書を編集：

```python
PRODUCTS = {
    "your-product-id": {
        "url": "https://www.bullionstar.com/buy/product/...",
        "name": "Product Name"
    }
}
```

### 通知閾値の変更

GitHub Variables で `PRICE_CHANGE_THRESHOLD` を設定（デフォルト: 3.0%）

## ライセンス

MIT
```

## 開発開始手順

### ステップ1: 初期セットアップ
```bash
# リポジトリ作成
mkdir bullionstar-price-monitor
cd bullionstar-price-monitor
git init

# ファイル作成
# 上記のコードを各ファイルにコピー

# 依存関係インストール
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

### ステップ2: ローカルテスト
```bash
# .envファイル作成
cp .env.example .env
# .envを編集してGmail情報を設定

# 実行テスト
python monitor.py
```

### ステップ3: GitHubへプッシュ
```bash
git add .
git commit -m "Initial implementation"
git remote add origin https://github.com/YOUR_USERNAME/bullionstar-price-monitor.git
git push -u origin main
```

### ステップ4: GitHub設定
1. Secrets設定（Gmail認証情報）
2. Actions有効化
3. 手動実行でテスト

## 拡張性

このツールは以下の拡張が容易：

1. **商品追加**: `PRODUCTS`辞書に追加するだけ
2. **他サイト対応**: 新規スクレイパークラスを作成
3. **通知方法追加**: Slack、LINE等のNotifierクラスを追加
4. **分析機能強化**: トレンド分析、予測機能等

## トラブルシューティング

### よくある問題

1. **Playwright起動エラー**
   ```bash
   playwright install-deps
   ```

2. **Gmail認証エラー**
   - 2段階認証を有効化
   - アプリパスワードを生成
   - https://myaccount.google.com/apppasswords

3. **価格取得失敗**
   - セレクターの更新が必要な可能性
   - BullionStarのHTML構造を確認

## まとめ

この開発指示書により、Claude Codeを使用して効率的にBullionStar価格監視ツールを実装できます。シンプルな構造ながら、実用的で拡張可能な設計になっています。