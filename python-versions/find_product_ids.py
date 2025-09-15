#!/usr/bin/env python3
"""
BullionStarの商品IDを特定するスクリプト
"""

import asyncio
from playwright.async_api import async_playwright
import re

async def find_product_ids():
    """各商品ページから商品IDを抽出"""

    products = [
        {
            "url": "https://www.bullionstar.com/buy/product/gold-maple-1-2oz-various-years",
            "name": "Canadian Gold Maple Leaf 1/2 oz"
        },
        {
            "url": "https://www.bullionstar.com/buy/product/gold-maple-1oz-various-years",
            "name": "Canadian Gold Maple Leaf 1 oz"
        },
        {
            "url": "https://www.bullionstar.com/buy/product/silver-maple-1oz-various-years",
            "name": "Canadian Silver Maple Leaf 1 oz"
        }
    ]

    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()

    print("BullionStar商品ID検出")
    print("=" * 70)

    for product in products:
        try:
            print(f"\n商品: {product['name']}")
            print(f"URL: {product['url']}")

            # APIコールを監視
            api_calls = []

            async def handle_request(request):
                if 'services.bullionstar.com' in request.url and 'productIds' in request.url:
                    api_calls.append(request.url)

            page.on('request', handle_request)

            await page.goto(product['url'], wait_until='networkidle')

            # APIコールから商品IDを抽出
            for api_url in api_calls:
                match = re.search(r'productIds=(\d+)', api_url)
                if match:
                    product_id = match.group(1)
                    print(f"✅ 商品ID: {product_id}")
                    break
            else:
                # ページのHTMLから商品IDを探す
                html = await page.content()
                match = re.search(r'productId["\']?\s*[:=]\s*["\']?(\d+)', html)
                if match:
                    product_id = match.group(1)
                    print(f"✅ 商品ID (HTML): {product_id}")
                else:
                    print("❌ 商品IDが見つかりませんでした")

        except Exception as e:
            print(f"❌ エラー: {e}")

        await asyncio.sleep(2)

    await context.close()
    await browser.close()

    print("\n" + "=" * 70)
    print("検出完了")

if __name__ == "__main__":
    asyncio.run(find_product_ids())