#!/usr/bin/env python3
"""
BullionStarのAPIまたは価格データ構造を調査
"""

import asyncio
from playwright.async_api import async_playwright
import json
import re

async def investigate_price_structure():
    """ページの価格構造を詳細に調査"""
    url = "https://www.bullionstar.com/buy/product/gold-maple-1-2oz-various-years"

    print(f"Investigating: {url}")
    print("=" * 70)

    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=False)  # ブラウザを表示

    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080}
    )

    page = await context.new_page()

    try:
        # ネットワークリクエストを監視
        responses = []

        async def handle_response(response):
            if 'api' in response.url or 'price' in response.url.lower():
                responses.append({
                    'url': response.url,
                    'status': response.status
                })

        page.on('response', handle_response)

        print("ページを読み込み中（ブラウザが開きます）...")
        await page.goto(url, wait_until='networkidle', timeout=30000)

        print("\n通貨切り替えを試行...")
        # 通貨セレクタを探す
        selectors_to_try = [
            'select[name="currency"]',
            '.currency-selector',
            '[data-currency]',
            '.dropdown-toggle:has-text("Currency")',
            'button:has-text("Currency")',
            '.nav-link:has-text("Currency")'
        ]

        for selector in selectors_to_try:
            element = await page.query_selector(selector)
            if element:
                print(f"  Found currency element: {selector}")
                # 要素の情報を取得
                tag_name = await element.evaluate('el => el.tagName')
                inner_text = await element.inner_text()
                print(f"    Tag: {tag_name}, Text: {inner_text}")

        # ページのHTMLから価格関連の情報を抽出
        print("\n価格関連のデータ属性を検索...")
        price_data = await page.evaluate("""
            () => {
                const result = {
                    prices: [],
                    currency: null,
                    dataAttributes: []
                };

                // 価格を含む要素を探す
                document.querySelectorAll('[class*="price"], [data-price]').forEach(el => {
                    if (el.textContent) {
                        result.prices.push({
                            class: el.className,
                            text: el.textContent.trim(),
                            dataPrice: el.dataset?.price
                        });
                    }
                });

                // data属性を持つ要素を探す
                document.querySelectorAll('[data-currency], [data-amount]').forEach(el => {
                    result.dataAttributes.push({
                        currency: el.dataset?.currency,
                        amount: el.dataset?.amount,
                        text: el.textContent.trim()
                    });
                });

                // メタデータやJSONを探す
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                scripts.forEach(script => {
                    try {
                        const data = JSON.parse(script.textContent);
                        if (data.offers || data.price) {
                            result.structuredData = data;
                        }
                    } catch {}
                });

                return result;
            }
        """)

        print("\n検出された価格情報:")
        for price in price_data.get('prices', [])[:5]:
            print(f"  - {price}")

        if price_data.get('dataAttributes'):
            print("\nデータ属性:")
            for attr in price_data.get('dataAttributes', [])[:5]:
                print(f"  - {attr}")

        if price_data.get('structuredData'):
            print("\n構造化データ:")
            print(json.dumps(price_data['structuredData'], indent=2)[:500])

        # APIレスポンスをチェック
        if responses:
            print("\n検出されたAPI呼び出し:")
            for resp in responses[:10]:
                print(f"  - {resp['url'][:100]}...")

        # 手動で通貨を変更する時間を与える
        print("\n" + "=" * 70)
        print("ブラウザで手動で通貨をSGDに変更してください")
        print("変更後、Enterキーを押してください...")
        input()

        # 変更後の価格を取得
        new_price = await page.query_selector('.price')
        if new_price:
            new_price_text = await new_price.inner_text()
            print(f"\n変更後の価格: {new_price_text}")

    except Exception as e:
        print(f"エラー: {e}")

    finally:
        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(investigate_price_structure())