"""
価格変動分析
前回価格との比較と通知判定
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

class PriceAnalyzer:
    """価格変動を分析"""

    def __init__(self, history_file: Path = Path("data/price_history.json")):
        self.history_file = history_file
        self.history_file.parent.mkdir(exist_ok=True)

    def load_history(self) -> Dict:
        """価格履歴を読み込み"""
        if self.history_file.exists():
            with open(self.history_file, 'r') as f:
                return json.load(f)
        return {}

    def save_history(self, history: Dict):
        """価格履歴を保存"""
        with open(self.history_file, 'w') as f:
            json.dump(history, f, indent=2)

    def analyze(self, current_prices: Dict[str, Dict], threshold: float = 3.0) -> List[Dict]:
        """
        価格変動を分析

        Args:
            current_prices: 現在の価格データ
            threshold: 通知閾値（%）

        Returns:
            通知が必要な価格変動のリスト
        """
        history = self.load_history()
        alerts = []

        for product_id, current_data in current_prices.items():
            current_price = current_data['price']

            # 前回価格と比較
            if product_id in history:
                previous_price = history[product_id]['price']

                # 変動率計算
                change_percent = ((current_price - previous_price) / previous_price) * 100

                # 閾値チェック
                if abs(change_percent) >= threshold:
                    alerts.append({
                        'product_id': product_id,
                        'product_name': current_data['name'],
                        'current_price': current_price,
                        'previous_price': previous_price,
                        'change_percent': change_percent,
                        'url': current_data['url']
                    })

            # 履歴更新
            history[product_id] = current_data

        # 履歴保存
        self.save_history(history)

        return alerts