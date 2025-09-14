import pytest
import json
from datetime import datetime, timedelta
from pathlib import Path
from src.analyzers.price_analyzer import PriceAnalyzer, PriceAlert, PricePoint

@pytest.fixture
def analyzer(tmp_path):
    """テスト用のアナライザーインスタンス"""
    return PriceAnalyzer(data_dir=str(tmp_path))

def test_price_point_creation():
    """PricePointデータクラスのテスト"""
    point = PricePoint(
        timestamp="2024-01-01T12:00:00",
        price=3000.0,
        product_name="1 oz Gold",
        source="BullionStar"
    )
    assert point.price == 3000.0
    assert point.product_name == "1 oz Gold"

def test_save_and_load_history(analyzer):
    """履歴の保存と読み込みテスト"""
    # 初期状態
    history = analyzer.load_history()
    assert history == {"prices": [], "alerts": []}

    # データを追加
    analyzer.add_price_point("Test Product", 1000.0)

    # 読み込み確認
    history = analyzer.load_history()
    assert len(history["prices"]) == 1
    assert history["prices"][0]["product_name"] == "Test Product"
    assert history["prices"][0]["price"] == 1000.0

def test_threshold_check(analyzer):
    """閾値チェックのテスト"""
    # 閾値を下回る場合
    alert = analyzer.check_threshold(2900, 3000, "Gold Bar")
    assert alert is not None
    assert alert.type == "threshold"
    assert "下回りました" in alert.message

    # 閾値を上回る場合
    alert = analyzer.check_threshold(3100, 3000, "Gold Bar")
    assert alert is None

def test_percentage_change_check(analyzer):
    """価格変動率チェックのテスト"""
    # 履歴データを準備
    old_time = (datetime.now() - timedelta(hours=25)).isoformat()
    history = {
        "prices": [
            {
                "timestamp": old_time,
                "price": 3000.0,
                "product_name": "Gold Bar",
                "source": "Test"
            }
        ],
        "alerts": []
    }
    analyzer.save_history(history)

    # 5%以上の上昇
    alert = analyzer.check_percentage_change("Gold Bar", 3200.0, hours=24)
    assert alert is not None
    assert alert.type == "percentage_change"
    assert "上昇" in alert.message

    # 5%未満の変動
    alert = analyzer.check_percentage_change("Gold Bar", 3100.0, hours=24)
    assert alert is None

def test_price_summary(analyzer):
    """価格サマリーのテスト"""
    # テストデータを追加
    for i, price in enumerate([3000, 3100, 2950, 3050]):
        analyzer.add_price_point("Gold Bar", float(price))

    # サマリーを取得
    summary = analyzer.get_price_summary("Gold Bar", hours=24)

    assert summary["product_name"] == "Gold Bar"
    assert summary["min"] == 2950
    assert summary["max"] == 3100
    assert summary["count"] == 4
    assert summary["avg"] == 3025.0

def test_alert_cooldown(analyzer):
    """アラートクールダウンのテスト"""
    # 初回は送信可能
    assert analyzer.should_send_alert("test_alert", cooldown_hours=1) is True

    # アラートを記録
    analyzer.update_last_alert("test_alert")

    # クールダウン期間中は送信不可
    assert analyzer.should_send_alert("test_alert", cooldown_hours=1) is False

    # 別のタイプは送信可能
    assert analyzer.should_send_alert("other_alert", cooldown_hours=1) is True