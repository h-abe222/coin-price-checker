"""
設定管理
環境変数と定数の管理
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# .envファイルを読み込み
load_dotenv()

class Config:
    """設定クラス"""

    # Gmail設定
    GMAIL_ADDRESS = os.getenv("GMAIL_ADDRESS")
    GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD")
    RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL")

    # 価格変動閾値（%）
    PRICE_CHANGE_THRESHOLD = float(os.getenv("PRICE_CHANGE_THRESHOLD", "3.0"))

    # 通貨設定
    CURRENCY = os.getenv("CURRENCY", "JPY")  # デフォルトを日本円に設定

    # デバッグモード
    DEBUG = os.getenv("DEBUG", "false").lower() == "true"

    # ファイルパス
    DATA_DIR = Path("data")
    HISTORY_FILE = DATA_DIR / "price_history.json"

    @classmethod
    def validate(cls):
        """設定を検証"""
        required = ["GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "RECIPIENT_EMAIL"]
        missing = [var for var in required if not getattr(cls, var)]

        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")

        return True

# ロギング設定
import logging

def setup_logging():
    """ロギングを設定"""
    level = logging.DEBUG if Config.DEBUG else logging.INFO

    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )