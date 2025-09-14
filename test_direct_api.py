#!/usr/bin/env python3
"""
BullionStarのAPIから直接価格を取得するテスト
"""

import asyncio
import aiohttp
import json

async def fetch_price_from_api():
    """APIから直接価格を取得"""

    # 商品IDマッピング（URLから推測）
    products = {
        "gold-maple-1-2oz": {
            "id": 628,  # APIで確認されたID
            "name": "Canadian Gold Maple Leaf 1/2 oz"
        },
        "gold-maple-1oz": {
            "id": 629,  # 推測（要確認）
            "name": "Canadian Gold Maple Leaf 1 oz"
        },
        "silver-maple-1oz": {
            "id": 630,  # 推測（要確認）
            "name": "Canadian Silver Maple Leaf 1 oz"
        }
    }

    print("BullionStar API価格取得テスト")
    print("=" * 70)

    async with aiohttp.ClientSession() as session:
        for product_key, product_info in products.items():
            # SGD価格を取得
            url = f"https://services.bullionstar.com/product/v2/prices"
            params = {
                "currency": "SGD",
                "locationId": 1,
                "productIds": product_info["id"]
            }

            try:
                print(f"\n{product_info['name']}:")
                print(f"  API URL: {url}")
                print(f"  Parameters: {params}")

                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"  Response: {json.dumps(data, indent=2)[:500]}")

                        # 価格を抽出
                        if data and isinstance(data, list) and len(data) > 0:
                            price_info = data[0]
                            if "price" in price_info:
                                price = price_info["price"]
                                print(f"  ✅ 価格: SGD ${price:.2f}")
                            elif "prices" in price_info:
                                # 数量別価格がある場合
                                prices = price_info["prices"]
                                if prices and len(prices) > 0:
                                    price = prices[0].get("price", prices[0].get("unitPrice"))
                                    print(f"  ✅ 価格: SGD ${price:.2f}")
                    else:
                        print(f"  ❌ HTTPエラー: {response.status}")

            except Exception as e:
                print(f"  ❌ エラー: {e}")

            await asyncio.sleep(1)  # レート制限対策

    print("\n" + "=" * 70)
    print("APIテスト完了")

if __name__ == "__main__":
    asyncio.run(fetch_price_from_api())