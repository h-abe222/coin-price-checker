import asyncio
import aiohttp
import json
from typing import Dict, Optional
from datetime import datetime
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

class BullionStarScraper:
    """BullionStar APIスクレイパー"""

    # APIエンドポイント
    API_URL = "https://services.bullionstar.com/product/v2/prices"
    PRODUCTS_FILE = Path("data/products.json")

    def load_products(self):
        """商品リストを読み込み"""
        # Web UIで設定した商品リストを優先
        if self.PRODUCTS_FILE.exists():
            with open(self.PRODUCTS_FILE, 'r', encoding='utf-8') as f:
                products = json.load(f)
                # 有効な商品のみ返す
                return {k: v for k, v in products.items() if v.get('enabled', True)}

        # フォールバック: デフォルト商品
        return {
            "gold-maple-1-2oz": {
                "id": 628,
                "url": "https://www.bullionstar.com/buy/product/gold-maple-1-2oz-various-years",
                "name": "Canadian Gold Maple Leaf 1/2 oz",
                "enabled": True
            }
        }

    def __init__(self):
        self.session = None

    async def initialize(self):
        """セッションを初期化"""
        self.session = aiohttp.ClientSession()
        logger.info("API session initialized")

    async def cleanup(self):
        """セッションをクリーンアップ"""
        if self.session:
            await self.session.close()
        logger.info("API session cleaned up")

    async def scrape_prices(self) -> Dict[str, Dict]:
        """全商品の価格をAPIから取得"""
        results = {}

        # 商品リストを読み込み
        products = self.load_products()

        if not products:
            logger.warning("No products configured for monitoring")
            return results

        # 通貨を設定から取得（デフォルト: JPY）
        currency = os.getenv("CURRENCY", "JPY")

        for product_key, product_info in products.items():
            try:
                logger.info(f"Fetching price for {product_info['name']} in {currency}")

                # APIパラメータ
                params = {
                    "currency": currency,
                    "locationId": 1,
                    "productIds": product_info['id']
                }

                # APIコール
                async with self.session.get(self.API_URL, params=params) as response:
                    if response.status == 200:
                        data = await response.json()

                        # 価格を抽出
                        price = self._extract_price_from_api(data)
                        if price:
                            results[product_key] = {
                                'name': product_info['name'],
                                'price': price,
                                'url': product_info['url'],
                                'timestamp': datetime.now().isoformat()
                            }
                            # 通貨に応じた表示
                            if currency == "JPY":
                                logger.info(f"Price found: ¥{price:,.0f}")
                            else:
                                logger.info(f"Price found: {currency} ${price:,.2f}")
                        else:
                            logger.warning(f"No price in API response for {product_info['name']}")
                    else:
                        logger.error(f"API error: HTTP {response.status}")

            except Exception as e:
                logger.error(f"Error fetching {product_key}: {e}")

            # レート制限対策
            await asyncio.sleep(1)

        return results

    def _extract_price_from_api(self, data: Dict) -> Optional[float]:
        """価格をAPIレスポンスから抽出"""
        try:
            if 'products' in data and len(data['products']) > 0:
                product = data['products'][0]

                # 価格文字列から数値を抽出
                price_str = product.get('price', '')
                if price_str:
                    # "S$2,613.25" -> 2613.25
                    import re
                    match = re.search(r'([\d,]+\.?\d*)', price_str)
                    if match:
                        return float(match.group(1).replace(',', ''))

                # lowestPriceを試す
                lowest_price = product.get('lowestPrice', '')
                if lowest_price:
                    match = re.search(r'([\d,]+\.?\d*)', lowest_price)
                    if match:
                        return float(match.group(1).replace(',', ''))
        except Exception as e:
            logger.error(f"Error extracting price: {e}")
        return None

    async def run(self) -> Dict[str, Dict]:
        """スクレイピングを実行"""
        try:
            await self.initialize()
            return await self.scrape_prices()
        finally:
            await self.cleanup()