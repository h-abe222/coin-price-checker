#!/usr/bin/env python3
"""
日本円（JPY）での価格取得テスト
"""

import asyncio
import sys
from pathlib import Path
import os

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

# 日本円を設定
os.environ["CURRENCY"] = "JPY"

from src.scrapers.bullionstar import BullionStarScraper

async def test_jpy_price():
    """日本円で価格を取得"""
    print("BullionStar価格取得テスト（日本円）")
    print("=" * 70)

    scraper = BullionStarScraper()

    try:
        # スクレイパーを実行
        prices = await scraper.run()

        if prices:
            print("\n✅ 価格取得成功（日本円）:")
            for product_id, price_data in prices.items():
                print(f"\n商品: {price_data['name']}")
                print(f"  価格: ¥{price_data['price']:,.0f}")
                print(f"  URL: {price_data['url']}")
                print(f"  取得時刻: {price_data['timestamp']}")

            # SGDとの比較（参考）
            print("\n" + "=" * 70)
            print("通貨比較（参考）:")
            jpy_price = list(prices.values())[0]['price']
            sgd_price = 2613.25  # 先ほど取得したSGD価格
            exchange_rate = jpy_price / sgd_price
            print(f"  JPY価格: ¥{jpy_price:,.0f}")
            print(f"  SGD価格: S${sgd_price:,.2f}")
            print(f"  為替レート（推定）: 1 SGD = ¥{exchange_rate:.2f}")

        else:
            print("\n❌ 価格を取得できませんでした")

    except Exception as e:
        print(f"\n❌ エラー: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 70)
    print("テスト完了")

if __name__ == "__main__":
    asyncio.run(test_jpy_price())