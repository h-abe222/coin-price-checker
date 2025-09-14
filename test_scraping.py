#!/usr/bin/env python3
"""
BullionStarの特定ページから価格を取得するテストスクリプト
"""

import asyncio
from playwright.async_api import async_playwright
import re

async def test_scrape_page():
    """指定されたページから価格を取得"""
    url = "https://www.bullionstar.com/buy/product/gold-maple-1-2oz-various-years"

    print(f"Testing URL: {url}")
    print("=" * 70)

    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-setuid-sandbox']
    )

    context = await browser.new_context(
        viewport={'width': 1920, 'height': 1080},
        user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        locale='en-SG',  # シンガポールのロケール設定
        extra_http_headers={
            'Accept-Language': 'en-SG,en;q=0.9'
        }
    )

    page = await context.new_page()

    try:
        print("ページを読み込み中...")
        await page.goto(url, wait_until='networkidle', timeout=30000)
        print("✓ ページ読み込み完了")

        # 通貨セレクターを探してSGDに切り替え
        print("\n通貨をSGDに切り替え中...")
        try:
            # 通貨セレクタを探す
            currency_selector = await page.query_selector('.currency-selector, select[name="currency"], .dropdown-currency')
            if currency_selector:
                await currency_selector.select_option('SGD')
                await page.wait_for_timeout(2000)  # 価格更新を待つ
                print("  ✓ 通貨をSGDに切り替えました")
            else:
                # URLパラメータで通貨を指定
                sgd_url = url + "?currency=SGD"
                await page.goto(sgd_url, wait_until='networkidle', timeout=30000)
                print("  ✓ SGD URLで再読み込み")
        except:
            print("  通貨切り替えをスキップ")

        # 複数の戦略で価格を探す
        price = None

        # 戦略1: 一般的な価格セレクター
        selectors = [
            '.product-price',
            '.price-value',
            '.product-info .price',
            '[data-price]',
            '.price',
            'span.price',
            'div.price',
            '.product-detail-price',
            '.current-price'
        ]

        print("\n価格要素を検索中...")
        for selector in selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    print(f"  Found with {selector}: {text}")
                    # 価格をパース
                    cleaned = re.sub(r'[\$,\s]', '', text)
                    match = re.search(r'(\d+\.?\d*)', cleaned)
                    if match:
                        price = float(match.group(1))
                        print(f"  ✓ Parsed price: ${price:.2f}")
                        break
            except:
                pass

        # 戦略2: JavaScript評価
        if not price:
            print("\nJavaScriptで価格を検索中...")
            try:
                price = await page.evaluate("""
                    () => {
                        // 価格を含む可能性のある要素を探す
                        const priceElements = document.querySelectorAll('*');
                        for (let el of priceElements) {
                            const text = el.textContent || '';
                            // SGDまたは$を含む要素を探す
                            if (text.includes('SGD') || text.includes('S$')) {
                                const match = text.match(/[S$]*\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
                                if (match) {
                                    return parseFloat(match[1].replace(/,/g, ''));
                                }
                            }
                        }
                        return null;
                    }
                """)
                if price:
                    print(f"  ✓ Found via JavaScript: ${price:.2f}")
            except:
                pass

        # 戦略3: テキスト全体から価格パターンを検索
        if not price:
            print("\nページ全体のテキストから価格を検索中...")
            try:
                page_text = await page.content()
                # SGD価格のパターンを探す
                patterns = [
                    r'SGD\s*([0-9,]+\.?\d*)',
                    r'S\$\s*([0-9,]+\.?\d*)',
                    r'\$\s*([0-9,]+\.?\d*)'
                ]

                for pattern in patterns:
                    matches = re.findall(pattern, page_text)
                    if matches:
                        # 最初の有効な価格を使用
                        for match in matches:
                            try:
                                value = float(match.replace(',', ''))
                                if value > 100:  # 金価格として妥当な値
                                    price = value
                                    print(f"  ✓ Found in page text: ${price:.2f}")
                                    break
                            except:
                                pass
                    if price:
                        break
            except:
                pass

        # デバッグ情報を取得
        if not price:
            print("\n価格が見つかりませんでした。デバッグ情報を収集中...")

            # スクリーンショットを保存
            await page.screenshot(path="debug_screenshot.png")
            print("  スクリーンショット保存: debug_screenshot.png")

            # ページのタイトルと一部のテキストを表示
            title = await page.title()
            print(f"  ページタイトル: {title}")

            # 商品名を取得
            product_name = await page.query_selector('h1')
            if product_name:
                name_text = await product_name.inner_text()
                print(f"  商品名: {name_text}")

        print("\n" + "=" * 70)
        if price:
            print(f"✅ 成功: Canadian Gold Maple Leaf 1/2 oz")
            print(f"   価格: SGD ${price:.2f}")
        else:
            print("❌ 価格を取得できませんでした")
            print("   BullionStarのページ構造が変更された可能性があります")

    except Exception as e:
        print(f"❌ エラー発生: {e}")

    finally:
        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_scrape_page())