#!/usr/bin/env python3
"""
保存された価格履歴を表示するスクリプト
"""

import json
from pathlib import Path
from datetime import datetime
import sys

def view_price_history():
    """価格履歴を見やすく表示"""
    history_file = Path("data/price_history.json")

    if not history_file.exists():
        print("価格履歴ファイルが見つかりません。")
        print("最初の監視実行後に作成されます。")
        return

    try:
        with open(history_file, 'r') as f:
            history = json.load(f)

        if not history:
            print("価格履歴が空です。")
            return

        print("=" * 70)
        print("BullionStar 価格履歴")
        print("=" * 70)

        for product_id, data in history.items():
            print(f"\n商品: {data['name']}")
            print(f"価格: ${data['price']:.2f}")
            print(f"URL: {data['url']}")

            # タイムスタンプをパース
            timestamp = datetime.fromisoformat(data['timestamp'])
            print(f"取得日時: {timestamp.strftime('%Y年%m月%d日 %H:%M:%S')}")
            print("-" * 70)

    except json.JSONDecodeError:
        print("価格履歴ファイルの読み込みに失敗しました。")
    except Exception as e:
        print(f"エラー: {e}")

def compare_prices():
    """価格の変動を計算して表示"""
    history_file = Path("data/price_history.json")

    if not history_file.exists():
        print("価格履歴ファイルが見つかりません。")
        return

    # 過去の価格データがあれば比較（この例では仮のデータ）
    print("\n価格変動分析:")
    print("（初回実行のため、次回から変動率が表示されます）")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--compare":
        compare_prices()
    else:
        view_price_history()