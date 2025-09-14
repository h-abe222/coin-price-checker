#!/usr/bin/env python3
"""
ローカル環境でのテストスクリプト
環境変数とスクレイパーの動作を確認
"""

import asyncio
import os
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from src.scrapers.bullionstar import BullionStarScraper
from src.notifiers.email_notifier import EmailNotifier
from src.analyzers.price_analyzer import PriceAnalyzer

def check_environment():
    """環境変数をチェック"""
    load_dotenv()

    print("=== 環境変数チェック ===")
    required_vars = ["GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "RECIPIENT_EMAIL"]

    all_set = True
    for var in required_vars:
        value = os.getenv(var)
        if value:
            # パスワードは一部マスク
            if "PASSWORD" in var:
                display_value = value[:3] + "***" + value[-3:] if len(value) > 6 else "***"
            else:
                display_value = value
            print(f"✓ {var}: {display_value}")
        else:
            print(f"✗ {var}: 未設定")
            all_set = False

    optional_vars = ["THRESHOLD_PRICE", "DEBUG", "LOG_LEVEL"]
    print("\n=== オプション設定 ===")
    for var in optional_vars:
        value = os.getenv(var, "デフォルト値")
        print(f"  {var}: {value}")

    return all_set

async def test_scraper():
    """スクレイパーのテスト"""
    print("\n=== スクレイパーテスト ===")
    print("BullionStarから価格を取得中...")

    try:
        async with BullionStarScraper() as scraper:
            prices = await scraper.scrape_prices()

        if prices:
            print(f"✓ {len(prices)}件の価格を取得しました:")
            for name, price_data in list(prices.items())[:3]:
                print(f"  - {name}: SGD {price_data.price_sgd:.2f}")
            return prices
        else:
            print("✗ 価格を取得できませんでした")
            return None

    except Exception as e:
        print(f"✗ エラー: {e}")
        return None

def test_analyzer(prices):
    """アナライザーのテスト"""
    print("\n=== アナライザーテスト ===")

    try:
        analyzer = PriceAnalyzer()

        # 価格を分析
        threshold = float(os.getenv("THRESHOLD_PRICE", "3000"))
        alerts = analyzer.analyze_prices(prices, threshold)

        print(f"✓ 分析完了:")
        print(f"  - 価格データ保存: data/price_history.json")
        print(f"  - アラート数: {len(alerts)}")

        if alerts:
            for alert in alerts[:3]:
                print(f"  - {alert.type}: {alert.message}")

        return True

    except Exception as e:
        print(f"✗ エラー: {e}")
        return False

def test_email_connection():
    """メール接続のテスト（実際には送信しない）"""
    print("\n=== メール設定テスト ===")

    gmail_address = os.getenv("GMAIL_ADDRESS")
    gmail_password = os.getenv("GMAIL_APP_PASSWORD")

    if not gmail_address or not gmail_password:
        print("✗ メール設定が不完全です")
        return False

    try:
        import smtplib

        print("SMTPサーバーへの接続をテスト中...")
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(gmail_address, gmail_password)

        print("✓ メール設定は正常です")
        return True

    except smtplib.SMTPAuthenticationError:
        print("✗ 認証エラー: Gmailアプリパスワードを確認してください")
        print("  参考: https://support.google.com/accounts/answer/185833")
        return False
    except Exception as e:
        print(f"✗ エラー: {e}")
        return False

async def main():
    """メインテスト実行"""
    print("=" * 50)
    print("金価格監視ツール - ローカルテスト")
    print("=" * 50)

    # 環境変数チェック
    env_ok = check_environment()
    if not env_ok:
        print("\n⚠️  環境変数が正しく設定されていません")
        print("  .envファイルを確認してください")
        return

    # スクレイパーテスト
    prices = await test_scraper()
    if not prices:
        print("\n⚠️  スクレイパーテストが失敗しました")
        return

    # アナライザーテスト
    analyzer_ok = test_analyzer(prices)
    if not analyzer_ok:
        print("\n⚠️  アナライザーテストが失敗しました")

    # メール設定テスト
    email_ok = test_email_connection()

    # 結果サマリー
    print("\n" + "=" * 50)
    print("テスト結果サマリー:")
    print(f"  環境変数: {'✓' if env_ok else '✗'}")
    print(f"  スクレイパー: {'✓' if prices else '✗'}")
    print(f"  アナライザー: {'✓' if analyzer_ok else '✗'}")
    print(f"  メール設定: {'✓' if email_ok else '✗'}")

    if all([env_ok, prices, analyzer_ok, email_ok]):
        print("\n✅ すべてのテストが成功しました！")
        print("   本番実行: python run_monitor.py")
    else:
        print("\n⚠️  一部のテストが失敗しました")
        print("   上記のエラーメッセージを確認してください")

if __name__ == "__main__":
    asyncio.run(main())