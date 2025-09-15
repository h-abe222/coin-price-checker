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