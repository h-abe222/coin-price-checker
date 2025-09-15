#!/usr/bin/env python3
"""
価格更新スクリプト
PlaywrightでBullionStarから価格を取得し、Cloudflare KVに保存
"""

import asyncio
import json
import os
import sys
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

from src.coin_scraper import CoinPriceScraper
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CloudflareKVUpdater:
    """Cloudflare KVに価格データを更新"""

    def __init__(self):
        self.worker_url = os.getenv('WORKER_URL', 'https://coin-price-checker.h-abe.workers.dev')
        self.admin_password = os.getenv('ADMIN_PASSWORD', 'admin123')

    def get_products(self) -> Dict:
        """KVから商品リストを取得"""
        try:
            response = requests.get(f"{self.worker_url}/api/products")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Failed to get products from KV: {e}")
            # ローカルのproducts.jsonを使用
            products_file = Path("data/products.json")
            if products_file.exists():
                with open(products_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            return {}

    def update_product_price(self, product_key: str, price: float) -> bool:
        """商品の価格を更新"""
        try:
            # まず現在の商品データを取得
            products = self.get_products()

            if product_key not in products:
                logger.warning(f"Product {product_key} not found in KV")
                return False

            # 価格を更新
            products[product_key]['current_price'] = price
            products[product_key]['last_updated'] = datetime.now().isoformat()

            # 価格履歴に追加（ローカル保存）
            self.save_price_history(product_key, products[product_key]['name'], price)

            logger.info(f"Updated {product_key}: ¥{price:,.0f}")
            return True

        except Exception as e:
            logger.error(f"Failed to update price for {product_key}: {e}")
            return False

    def save_price_history(self, product_key: str, product_name: str, price: float):
        """価格履歴をローカルに保存"""
        history_file = Path("data/price_history.json")
        history_file.parent.mkdir(exist_ok=True)

        # 既存の履歴を読み込み
        if history_file.exists():
            with open(history_file, 'r', encoding='utf-8') as f:
                history = json.load(f)
        else:
            history = {'prices': [], 'last_update': None}

        # 新しい価格を追加
        history['prices'].append({
            'product_key': product_key,
            'product_name': product_name,
            'price': price,
            'currency': 'JPY',
            'timestamp': datetime.now().isoformat()
        })

        history['last_update'] = datetime.now().isoformat()

        # 最新1000件のみ保持
        if len(history['prices']) > 1000:
            history['prices'] = history['prices'][-1000:]

        # 保存
        with open(history_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)

    def update_all_prices_in_kv(self, price_results: Dict):
        """すべての価格をCloudflare KVに一括更新"""
        try:
            # 現在の商品データを取得
            products = self.get_products()

            # 価格を更新
            updated = []
            for product_key, result in price_results.items():
                if product_key in products:
                    products[product_key]['current_price'] = result['price']
                    products[product_key]['last_updated'] = result['timestamp']
                    updated.append(product_key)

            # Worker API経由で一括更新
            # 注: 現在のWorkerは個別更新のみサポートしているため、
            # GitHub Actionsからdata/products.jsonを直接更新する方法を使用
            self.save_products_locally(products)

            logger.info(f"Updated {len(updated)} products in local storage")
            return True

        except Exception as e:
            logger.error(f"Failed to update prices in KV: {e}")
            return False

    def save_products_locally(self, products: Dict):
        """商品データをローカルに保存（GitHubにコミット用）"""
        products_file = Path("data/products.json")
        products_file.parent.mkdir(exist_ok=True)

        with open(products_file, 'w', encoding='utf-8') as f:
            json.dump(products, f, indent=2, ensure_ascii=False)


async def main():
    """メイン処理"""
    logger.info("=" * 50)
    logger.info("Price Update Started")
    logger.info("=" * 50)

    try:
        # KV Updaterを初期化
        updater = CloudflareKVUpdater()

        # 商品リストを取得
        products = updater.get_products()

        if not products:
            logger.warning("No products to update")
            return 0

        logger.info(f"Found {len(products)} products to check")

        # Playwrightで価格を取得
        scraper = CoinPriceScraper()
        price_results = await scraper.run(products)

        if not price_results:
            logger.error("No prices retrieved")
            return 1

        logger.info(f"Successfully retrieved {len(price_results)} prices")

        # 価格変動をチェック
        changes = []
        for product_key, result in price_results.items():
            if product_key in products:
                old_price = products[product_key].get('current_price', 0)
                new_price = result['price']

                if old_price != new_price:
                    change_percent = ((new_price - old_price) / old_price * 100) if old_price > 0 else 0
                    changes.append({
                        'product': products[product_key]['name'],
                        'old_price': old_price,
                        'new_price': new_price,
                        'change_percent': change_percent
                    })

        # 変動をログ出力
        if changes:
            logger.info("Price changes detected:")
            for change in changes:
                sign = "+" if change['change_percent'] > 0 else ""
                logger.info(
                    f"  {change['product']}: "
                    f"¥{change['old_price']:,.0f} → ¥{change['new_price']:,.0f} "
                    f"({sign}{change['change_percent']:.1f}%)"
                )

        # KVを更新
        updater.update_all_prices_in_kv(price_results)

        # 価格履歴を保存
        for product_key, result in price_results.items():
            if product_key in products:
                updater.save_price_history(
                    product_key,
                    products[product_key]['name'],
                    result['price']
                )

        logger.info("Price update completed successfully")
        return 0

    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)