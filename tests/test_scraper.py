import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from src.scrapers.bullionstar import BullionStarScraper, GoldPrice

@pytest.mark.asyncio
async def test_scraper_initialization():
    """スクレイパーの初期化テスト"""
    scraper = BullionStarScraper(timeout=10000)
    assert scraper.timeout == 10000
    assert scraper.browser is None
    assert scraper.context is None

@pytest.mark.asyncio
async def test_price_parsing():
    """価格パーステスト"""
    scraper = BullionStarScraper()

    # 正常なケース
    assert scraper._parse_price("S$ 3,456.78") == 3456.78
    assert scraper._parse_price("SGD 1234.56") == 1234.56
    assert scraper._parse_price("3,456.78") == 3456.78

    # 異常なケース
    assert scraper._parse_price("invalid") is None
    assert scraper._parse_price("") is None

@pytest.mark.asyncio
async def test_gold_price_model():
    """GoldPriceモデルのテスト"""
    from datetime import datetime

    price = GoldPrice(
        product_name="1 oz Gold Bar",
        price_sgd=3000.50,
        price_per_oz=3000.50,
        timestamp=datetime.now(),
        url="https://example.com"
    )

    assert price.product_name == "1 oz Gold Bar"
    assert price.price_sgd == 3000.50
    assert price.price_per_oz == 3000.50
    assert price.url == "https://example.com"