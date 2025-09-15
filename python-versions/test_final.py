#!/usr/bin/env python3
"""
最終的なスクレイパーのテスト
"""

import asyncio
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from src.scrapers.bullionstar import BullionStarScraper

async def test_scraper():
    """スクレイパーをテスト"""
    print("BullionStar価格取得テスト（API版）")
    print("=" * 70)

    scraper = BullionStarScraper()

    try:
        # スクレイパーを実行
        prices = await scraper.run()

        if prices:
            print("\n✅ 価格取得成功:")
            for product_id, price_data in prices.items():
                print(f"\n商品: {price_data['name']}")
                print(f"  価格: SGD ${price_data['price']:.2f}")
                print(f"  URL: {price_data['url']}")
                print(f"  取得時刻: {price_data['timestamp']}")
        else:
            print("\n❌ 価格を取得できませんでした")

    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 70)
    print("テスト完了")

if __name__ == "__main__":
    asyncio.run(test_scraper())