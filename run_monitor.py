#!/usr/bin/env python3
import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv

# プロジェクトのパスを追加
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.scrapers.bullionstar import BullionStarScraper
from src.notifiers.email_notifier import EmailNotifier
from src.analyzers.price_analyzer import PriceAnalyzer

# ロギング設定
def setup_logging():
    """ロギングの設定"""
    log_level = os.getenv("LOG_LEVEL", "INFO")
    log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    logging.basicConfig(
        level=getattr(logging, log_level),
        format=log_format,
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler(f"monitor_{datetime.now().strftime('%Y%m%d')}.log")
        ]
    )

logger = logging.getLogger(__name__)

class GoldPriceMonitor:
    """金価格監視システムのメインクラス"""

    def __init__(self):
        # 環境変数を読み込み
        load_dotenv()

        # 設定を取得
        self.gmail_address = os.getenv("GMAIL_ADDRESS")
        self.gmail_password = os.getenv("GMAIL_APP_PASSWORD")
        self.recipient_email = os.getenv("RECIPIENT_EMAIL")
        self.threshold_price = float(os.getenv("THRESHOLD_PRICE", "3000"))
        self.check_interval = int(os.getenv("CHECK_INTERVAL", "3600"))  # デフォルト1時間

        # 設定の検証
        self._validate_config()

        # コンポーネントを初期化
        self.scraper = BullionStarScraper()
        self.notifier = EmailNotifier(self.gmail_address, self.gmail_password)
        self.analyzer = PriceAnalyzer()

    def _validate_config(self):
        """設定の検証"""
        required = {
            "GMAIL_ADDRESS": self.gmail_address,
            "GMAIL_APP_PASSWORD": self.gmail_password,
            "RECIPIENT_EMAIL": self.recipient_email
        }

        missing = [key for key, value in required.items() if not value]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

    async def run_once(self) -> bool:
        """1回の監視サイクルを実行"""
        try:
            logger.info("Starting price check cycle")

            # 価格を取得
            async with self.scraper as scraper:
                prices = await scraper.scrape_prices()

            if not prices:
                logger.warning("No prices were scraped")
                return False

            logger.info(f"Successfully scraped {len(prices)} prices")

            # 価格を分析
            alerts = self.analyzer.analyze_prices(prices, self.threshold_price)

            # アラートがある場合はメール送信
            if alerts:
                logger.info(f"Found {len(alerts)} alerts")

                # アラート情報を整理
                alert_info = {
                    "message": "\n".join([alert.message for alert in alerts]),
                    "price_history": []
                }

                # メール送信
                success = self.notifier.send_price_alert(
                    self.recipient_email,
                    prices,
                    alert_info
                )

                if success:
                    logger.info("Alert email sent successfully")
                    # 最後のアラート送信時刻を更新
                    for alert in alerts:
                        self.analyzer.update_last_alert(alert.type)
                else:
                    logger.error("Failed to send alert email")

            # 定期レポート（1日1回、正午）
            current_hour = datetime.now().hour
            if current_hour == 12:
                if self.analyzer.should_send_alert("daily_report", cooldown_hours=23):
                    self._send_daily_report(prices)
                    self.analyzer.update_last_alert("daily_report")

            return True

        except Exception as e:
            logger.error(f"Error in monitoring cycle: {e}", exc_info=True)

            # エラー通知を送信
            try:
                self.notifier.send_error_notification(
                    self.recipient_email,
                    str(e)
                )
            except:
                pass

            return False

    def _send_daily_report(self, prices):
        """日次レポートを送信"""
        try:
            # 各商品のサマリーを取得
            summaries = []
            for product_name in prices.keys():
                summary = self.analyzer.get_price_summary(product_name, hours=24)
                if summary:
                    summaries.append(summary)

            # レポート本文を作成
            report_body = self._create_daily_report_body(summaries)

            # メール送信
            self.notifier.send_email(
                self.recipient_email,
                f"金価格日次レポート - {datetime.now().strftime('%Y-%m-%d')}",
                report_body,
                html=True
            )

            logger.info("Daily report sent")

        except Exception as e:
            logger.error(f"Failed to send daily report: {e}")

    def _create_daily_report_body(self, summaries) -> str:
        """日次レポートの本文を作成"""
        html = """
        <html>
        <body>
            <h2>金価格日次レポート</h2>
            <p>日時: {timestamp}</p>
            <table border="1" style="border-collapse: collapse;">
                <tr>
                    <th>商品名</th>
                    <th>現在価格</th>
                    <th>最安値</th>
                    <th>最高値</th>
                    <th>平均価格</th>
                    <th>データ数</th>
                </tr>
        """.format(timestamp=datetime.now().strftime('%Y-%m-%d %H:%M'))

        for summary in summaries:
            html += f"""
                <tr>
                    <td>{summary['product_name']}</td>
                    <td>S$ {summary['current']:.2f}</td>
                    <td>S$ {summary['min']:.2f}</td>
                    <td>S$ {summary['max']:.2f}</td>
                    <td>S$ {summary['avg']:.2f}</td>
                    <td>{summary['count']}</td>
                </tr>
            """

        html += """
            </table>
        </body>
        </html>
        """

        return html

    async def run_continuous(self):
        """継続的な監視を実行"""
        logger.info(f"Starting continuous monitoring (interval: {self.check_interval}s)")

        while True:
            try:
                await self.run_once()
            except Exception as e:
                logger.error(f"Unexpected error: {e}")

            # 次のチェックまで待機
            logger.info(f"Waiting {self.check_interval} seconds until next check")
            await asyncio.sleep(self.check_interval)

async def main():
    """メイン関数"""
    setup_logging()
    logger.info("Gold Price Monitor starting...")

    try:
        monitor = GoldPriceMonitor()

        # コマンドライン引数をチェック
        if len(sys.argv) > 1 and sys.argv[1] == "--once":
            # 1回だけ実行
            success = await monitor.run_once()
            sys.exit(0 if success else 1)
        else:
            # 継続的に実行
            await monitor.run_continuous()

    except KeyboardInterrupt:
        logger.info("Monitoring stopped by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())