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