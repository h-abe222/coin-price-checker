"""
汎用コイン価格スクレイパー
複数のコイン販売サイトから価格を取得
"""

import asyncio
import json
import os
import re
from typing import Dict, Optional, List
from datetime import datetime
from playwright.async_api import async_playwright, Page
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CoinPriceScraper:
    """汎用コイン価格スクレイパー"""

    def __init__(self):
        self.browser = None
        self.context = None
        self.currency = os.getenv('CURRENCY', 'JPY')

    async def initialize(self):
        """ブラウザを初期化"""
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        self.context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            locale='ja-JP' if self.currency == 'JPY' else 'en-US'
        )
        logger.info("Browser initialized")

    async def cleanup(self):
        """リソースをクリーンアップ"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        logger.info("Browser cleaned up")

    async def scrape_price(self, url: str, selectors: Dict = None) -> Optional[Dict]:
        """汎用価格スクレイピング"""
        page = await self.context.new_page()

        try:
            logger.info(f"Scraping: {url}")

            # サイトを判定
            site_type = self._detect_site_type(url)

            # ページを読み込み
            await page.goto(url, wait_until='networkidle', timeout=30000)
            await page.wait_for_timeout(3000)  # JavaScriptの実行を待つ

            # サイトタイプに応じた処理
            if site_type == 'bullionstar':
                result = await self._scrape_bullionstar(page, url)
            elif site_type == 'goldsilver':
                result = await self._scrape_goldsilver(page, url)
            elif site_type == 'apmex':
                result = await self._scrape_apmex(page, url)
            elif site_type == 'jmbullion':
                result = await self._scrape_jmbullion(page, url)
            else:
                # 汎用スクレイピング
                result = await self._scrape_generic(page, url, selectors)

            await page.close()
            return result

        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            await page.close()
            return None

    def _detect_site_type(self, url: str) -> str:
        """URLからサイトタイプを判定"""
        if 'bullionstar.com' in url:
            return 'bullionstar'
        elif 'goldsilver.com' in url:
            return 'goldsilver'
        elif 'apmex.com' in url:
            return 'apmex'
        elif 'jmbullion.com' in url:
            return 'jmbullion'
        else:
            return 'generic'

    async def _scrape_bullionstar(self, page: Page, url: str) -> Optional[Dict]:
        """BullionStar専用スクレイピング"""
        try:
            price = None
            product_name = None

            # 商品名を取得
            try:
                name_elem = await page.query_selector('h1')
                if name_elem:
                    product_name = await name_elem.inner_text()
            except:
                pass

            # 価格を取得（JPY）
            if self.currency == 'JPY':
                # JPYラジオボタンをクリック
                try:
                    jpy_radio = await page.query_selector('input[type="radio"][value="JPY"]')
                    if jpy_radio:
                        await jpy_radio.click()
                        await page.wait_for_timeout(2000)
                except:
                    pass

                # 価格を探す
                price_patterns = [
                    r'¥\s*([\d,]+)',
                    r'JPY\s*([\d,]+)',
                    r'円\s*([\d,]+)'
                ]

                for pattern in price_patterns:
                    price_elements = await page.query_selector_all('td, span, div')
                    for elem in price_elements:
                        text = await elem.inner_text()
                        match = re.search(pattern, text)
                        if match:
                            price = float(match.group(1).replace(',', ''))
                            break
                    if price:
                        break

            if price:
                return {
                    'url': url,
                    'name': product_name or 'Unknown Product',
                    'price': price,
                    'currency': self.currency,
                    'site': 'BullionStar',
                    'timestamp': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"BullionStar scraping error: {e}")

        return None

    async def _scrape_goldsilver(self, page: Page, url: str) -> Optional[Dict]:
        """GoldSilver.com専用スクレイピング"""
        try:
            price = None
            product_name = None

            # 商品名
            name_elem = await page.query_selector('.product-name, h1')
            if name_elem:
                product_name = await name_elem.inner_text()

            # 価格
            price_elem = await page.query_selector('.price-now, .product-price, [itemprop="price"]')
            if price_elem:
                text = await price_elem.inner_text()
                match = re.search(r'[\d,]+\.?\d*', text)
                if match:
                    price = float(match.group(0).replace(',', ''))

            if price:
                return {
                    'url': url,
                    'name': product_name or 'Unknown Product',
                    'price': price,
                    'currency': 'USD',  # GoldSilverは主にUSD
                    'site': 'GoldSilver.com',
                    'timestamp': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"GoldSilver scraping error: {e}")

        return None

    async def _scrape_apmex(self, page: Page, url: str) -> Optional[Dict]:
        """APMEX専用スクレイピング"""
        try:
            price = None
            product_name = None

            # 商品名
            name_elem = await page.query_selector('h1.product-title')
            if name_elem:
                product_name = await name_elem.inner_text()

            # 価格
            price_elem = await page.query_selector('.price-value, .product-price')
            if price_elem:
                text = await price_elem.inner_text()
                match = re.search(r'[\d,]+\.?\d*', text)
                if match:
                    price = float(match.group(0).replace(',', ''))

            if price:
                return {
                    'url': url,
                    'name': product_name or 'Unknown Product',
                    'price': price,
                    'currency': 'USD',
                    'site': 'APMEX',
                    'timestamp': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"APMEX scraping error: {e}")

        return None

    async def _scrape_jmbullion(self, page: Page, url: str) -> Optional[Dict]:
        """JM Bullion専用スクレイピング"""
        try:
            price = None
            product_name = None

            # 商品名
            name_elem = await page.query_selector('h1.title')
            if name_elem:
                product_name = await name_elem.inner_text()

            # 価格
            price_elem = await page.query_selector('.price-per-unit, .product-price')
            if price_elem:
                text = await price_elem.inner_text()
                match = re.search(r'[\d,]+\.?\d*', text)
                if match:
                    price = float(match.group(0).replace(',', ''))

            if price:
                return {
                    'url': url,
                    'name': product_name or 'Unknown Product',
                    'price': price,
                    'currency': 'USD',
                    'site': 'JM Bullion',
                    'timestamp': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"JM Bullion scraping error: {e}")

        return None

    async def _scrape_generic(self, page: Page, url: str, selectors: Dict = None) -> Optional[Dict]:
        """汎用スクレイピング"""
        try:
            price = None
            product_name = None

            # カスタムセレクターまたはデフォルトセレクター
            if not selectors:
                selectors = {
                    'name': ['h1', '.product-name', '.product-title', '[itemprop="name"]'],
                    'price': ['.price', '.product-price', '[itemprop="price"]', '.price-now']
                }

            # 商品名を取得
            for selector in selectors.get('name', []):
                elem = await page.query_selector(selector)
                if elem:
                    product_name = await elem.inner_text()
                    break

            # 価格を取得
            for selector in selectors.get('price', []):
                elem = await page.query_selector(selector)
                if elem:
                    text = await elem.inner_text()
                    # 数値を抽出
                    match = re.search(r'[\d,]+\.?\d*', text)
                    if match:
                        price = float(match.group(0).replace(',', ''))
                        break

            # JavaScriptから価格を取得
            if not price:
                price_data = await page.evaluate("""
                    () => {
                        // 価格を含む要素を探す
                        const priceElements = document.querySelectorAll('[data-price], .price, .product-price');
                        for (let elem of priceElements) {
                            const text = elem.textContent || elem.dataset.price || '';
                            const match = text.match(/[\d,]+\.?\d*/);
                            if (match) {
                                return parseFloat(match[0].replace(/,/g, ''));
                            }
                        }
                        return null;
                    }
                """)
                if price_data:
                    price = price_data

            if price:
                # URLからサイト名を推定
                from urllib.parse import urlparse
                site_name = urlparse(url).hostname or 'Unknown Site'

                return {
                    'url': url,
                    'name': product_name or 'Unknown Product',
                    'price': price,
                    'currency': self._detect_currency(await page.content()),
                    'site': site_name,
                    'timestamp': datetime.now().isoformat()
                }

        except Exception as e:
            logger.error(f"Generic scraping error: {e}")

        return None

    def _detect_currency(self, html: str) -> str:
        """HTMLから通貨を推定"""
        if '¥' in html or 'JPY' in html or '円' in html:
            return 'JPY'
        elif '€' in html or 'EUR' in html:
            return 'EUR'
        elif '£' in html or 'GBP' in html:
            return 'GBP'
        elif 'S$' in html or 'SGD' in html:
            return 'SGD'
        else:
            return 'USD'  # デフォルト

    async def scrape_multiple(self, products: Dict[str, Dict]) -> Dict[str, Dict]:
        """複数の商品をスクレイピング"""
        results = {}

        for product_key, product_info in products.items():
            if not product_info.get('enabled', True):
                continue

            url = product_info.get('url')
            if not url:
                continue

            # カスタムセレクターがあれば使用
            selectors = product_info.get('selectors')

            result = await self.scrape_price(url, selectors)

            if result:
                # 商品情報で上書き
                if product_info.get('name'):
                    result['name'] = product_info['name']

                results[product_key] = result
                logger.info(f"✓ {result['name']}: {result['currency']} {result['price']:,.2f}")
            else:
                logger.warning(f"✗ {product_info.get('name', product_key)}: Failed to get price")

            # レート制限対策
            await asyncio.sleep(2)

        return results

    async def run(self, products: Dict[str, Dict]) -> Dict[str, Dict]:
        """スクレイピングを実行"""
        try:
            await self.initialize()
            return await self.scrape_multiple(products)
        finally:
            await self.cleanup()


# テスト用
if __name__ == "__main__":
    async def test():
        scraper = CoinPriceScraper()

        # テスト商品（複数サイト）
        test_products = {
            "bullionstar-gold": {
                "url": "https://www.bullionstar.com/buy/product/gold-maple-1oz-various-years",
                "name": "Canadian Gold Maple Leaf 1 oz",
                "enabled": True
            },
            # 他のサイトも追加可能
            # "apmex-silver": {
            #     "url": "https://www.apmex.com/product/1/1-oz-american-silver-eagle",
            #     "name": "American Silver Eagle 1 oz",
            #     "enabled": True
            # }
        }

        results = await scraper.run(test_products)
        print(json.dumps(results, indent=2, ensure_ascii=False))

    asyncio.run(test())