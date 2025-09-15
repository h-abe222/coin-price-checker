import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict

logger = logging.getLogger(__name__)

@dataclass
class PricePoint:
    """価格ポイントのデータクラス"""
    timestamp: str
    price: float
    product_name: str
    source: str

@dataclass
class PriceAlert:
    """価格アラートの条件"""
    type: str  # "threshold", "percentage_change", "new_low", "new_high"
    value: float
    message: str
    triggered_at: str

class PriceAnalyzer:
    """価格データの分析と追跡"""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.history_file = self.data_dir / "price_history.json"
        self.alert_file = self.data_dir / "last_alert.json"

    def load_history(self) -> Dict:
        """価格履歴を読み込み"""
        if self.history_file.exists():
            try:
                with open(self.history_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Failed to load history: {e}")
        return {"prices": [], "alerts": []}

    def save_history(self, history: Dict) -> bool:
        """価格履歴を保存"""
        try:
            with open(self.history_file, 'w') as f:
                json.dump(history, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Failed to save history: {e}")
            return False

    def add_price_point(self, product_name: str, price: float, source: str = "BullionStar") -> None:
        """新しい価格ポイントを追加"""
        history = self.load_history()

        price_point = PricePoint(
            timestamp=datetime.now().isoformat(),
            price=price,
            product_name=product_name,
            source=source
        )

        history["prices"].append(asdict(price_point))

        # 古いデータを削除（30日以上前）
        cutoff_date = (datetime.now() - timedelta(days=30)).isoformat()
        history["prices"] = [
            p for p in history["prices"]
            if p["timestamp"] > cutoff_date
        ]

        self.save_history(history)
        logger.info(f"Added price point: {product_name} - {price}")

    def check_threshold(self, current_price: float, threshold: float, product_name: str) -> Optional[PriceAlert]:
        """閾値チェック"""
        if current_price <= threshold:
            return PriceAlert(
                type="threshold",
                value=threshold,
                message=f"{product_name}の価格が閾値を下回りました: S${current_price:.2f} <= S${threshold:.2f}",
                triggered_at=datetime.now().isoformat()
            )
        return None

    def check_percentage_change(self, product_name: str, current_price: float, hours: int = 24) -> Optional[PriceAlert]:
        """指定時間内の価格変動率をチェック"""
        history = self.load_history()
        cutoff_time = (datetime.now() - timedelta(hours=hours)).isoformat()

        # 該当商品の過去価格を取得
        past_prices = [
            p for p in history["prices"]
            if p["product_name"] == product_name and p["timestamp"] < cutoff_time
        ]

        if not past_prices:
            return None

        # 最も古い価格と比較
        old_price = past_prices[0]["price"]
        change_percent = ((current_price - old_price) / old_price) * 100

        if abs(change_percent) >= 5:  # 5%以上の変動
            direction = "上昇" if change_percent > 0 else "下落"
            return PriceAlert(
                type="percentage_change",
                value=change_percent,
                message=f"{product_name}が{hours}時間で{abs(change_percent):.1f}%{direction}: S${old_price:.2f} → S${current_price:.2f}",
                triggered_at=datetime.now().isoformat()
            )
        return None

    def check_new_extremes(self, product_name: str, current_price: float, days: int = 7) -> Optional[PriceAlert]:
        """新しい最高値・最安値をチェック"""
        history = self.load_history()
        cutoff_time = (datetime.now() - timedelta(days=days)).isoformat()

        # 該当期間の価格を取得
        recent_prices = [
            p["price"] for p in history["prices"]
            if p["product_name"] == product_name and p["timestamp"] > cutoff_time
        ]

        if not recent_prices:
            return None

        min_price = min(recent_prices)
        max_price = max(recent_prices)

        if current_price < min_price:
            return PriceAlert(
                type="new_low",
                value=current_price,
                message=f"{product_name}が過去{days}日間の最安値を更新: S${current_price:.2f}",
                triggered_at=datetime.now().isoformat()
            )
        elif current_price > max_price:
            return PriceAlert(
                type="new_high",
                value=current_price,
                message=f"{product_name}が過去{days}日間の最高値を更新: S${current_price:.2f}",
                triggered_at=datetime.now().isoformat()
            )
        return None

    def analyze_prices(self, prices: Dict, threshold: Optional[float] = None) -> List[PriceAlert]:
        """価格を分析してアラートを生成"""
        alerts = []

        for product_name, price_data in prices.items():
            current_price = price_data.price_sgd

            # 価格履歴に追加
            self.add_price_point(product_name, current_price)

            # 各種チェック
            if threshold:
                alert = self.check_threshold(current_price, threshold, product_name)
                if alert:
                    alerts.append(alert)

            # 価格変動チェック
            alert = self.check_percentage_change(product_name, current_price)
            if alert:
                alerts.append(alert)

            # 新しい最高値・最安値チェック
            alert = self.check_new_extremes(product_name, current_price)
            if alert:
                alerts.append(alert)

        # アラートを保存
        if alerts:
            self._save_alerts(alerts)

        return alerts

    def _save_alerts(self, alerts: List[PriceAlert]) -> None:
        """アラートを保存"""
        history = self.load_history()
        for alert in alerts:
            history["alerts"].append(asdict(alert))

        # 古いアラートを削除（7日以上前）
        cutoff_date = (datetime.now() - timedelta(days=7)).isoformat()
        history["alerts"] = [
            a for a in history["alerts"]
            if a["triggered_at"] > cutoff_date
        ]

        self.save_history(history)

    def get_price_summary(self, product_name: str, hours: int = 24) -> Dict:
        """指定商品の価格サマリーを取得"""
        history = self.load_history()
        cutoff_time = (datetime.now() - timedelta(hours=hours)).isoformat()

        prices = [
            p["price"] for p in history["prices"]
            if p["product_name"] == product_name and p["timestamp"] > cutoff_time
        ]

        if not prices:
            return {}

        return {
            "product_name": product_name,
            "current": prices[-1] if prices else None,
            "min": min(prices),
            "max": max(prices),
            "avg": sum(prices) / len(prices),
            "count": len(prices),
            "period_hours": hours
        }

    def should_send_alert(self, alert_type: str, cooldown_hours: int = 1) -> bool:
        """アラートを送信すべきかチェック（クールダウン期間を考慮）"""
        if not self.alert_file.exists():
            return True

        try:
            with open(self.alert_file, 'r') as f:
                last_alerts = json.load(f)

            if alert_type in last_alerts:
                last_sent = datetime.fromisoformat(last_alerts[alert_type])
                if datetime.now() - last_sent < timedelta(hours=cooldown_hours):
                    return False
        except Exception as e:
            logger.error(f"Failed to check last alert: {e}")

        return True

    def update_last_alert(self, alert_type: str) -> None:
        """最後のアラート送信時刻を更新"""
        last_alerts = {}
        if self.alert_file.exists():
            try:
                with open(self.alert_file, 'r') as f:
                    last_alerts = json.load(f)
            except:
                pass

        last_alerts[alert_type] = datetime.now().isoformat()

        try:
            with open(self.alert_file, 'w') as f:
                json.dump(last_alerts, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to update last alert: {e}")