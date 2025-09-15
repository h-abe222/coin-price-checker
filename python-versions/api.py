"""
BullionStar Price Monitor - Web API
商品管理とデータ永続化のためのAPI
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime
import hashlib
from functools import wraps

app = Flask(__name__)
CORS(app)

# 設定
DATA_DIR = 'data'
PRODUCTS_FILE = os.path.join(DATA_DIR, 'products.json')
PRICE_HISTORY_FILE = os.path.join(DATA_DIR, 'price_history.json')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

# データディレクトリの作成
os.makedirs(DATA_DIR, exist_ok=True)

def check_password(f):
    """パスワード認証デコレータ"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth = request.headers.get('Authorization')
        if not auth or auth != f'Bearer {ADMIN_PASSWORD}':
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

def load_products():
    """商品データを読み込む"""
    if not os.path.exists(PRODUCTS_FILE):
        return {}
    with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_products(products):
    """商品データを保存"""
    with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

def load_price_history():
    """価格履歴を読み込む"""
    if not os.path.exists(PRICE_HISTORY_FILE):
        return {'prices': [], 'last_update': None}
    with open(PRICE_HISTORY_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_price_history(history):
    """価格履歴を保存"""
    with open(PRICE_HISTORY_FILE, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, indent=2)

@app.route('/')
def index():
    """管理画面を表示"""
    return send_from_directory('.', 'index.html')

@app.route('/api/auth', methods=['POST'])
def authenticate():
    """認証確認"""
    data = request.json
    password = data.get('password', '')

    if password == ADMIN_PASSWORD:
        return jsonify({'success': True, 'token': ADMIN_PASSWORD})
    else:
        return jsonify({'success': False}), 401

@app.route('/api/products', methods=['GET'])
def get_products():
    """商品一覧を取得"""
    products = load_products()
    return jsonify(products)

@app.route('/api/products', methods=['POST'])
@check_password
def add_product():
    """商品を追加"""
    data = request.json
    url = data.get('url', '')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # URLから商品キーを生成
    import re
    match = re.search(r'product/([^/]+)', url)
    if not match:
        return jsonify({'error': 'Invalid BullionStar URL'}), 400

    product_key = match.group(1)
    products = load_products()

    if product_key in products:
        return jsonify({'error': 'Product already exists'}), 400

    # 商品情報を追加
    products[product_key] = {
        'id': len(products) + 1000,
        'url': url,
        'name': data.get('name', f'新商品 - {product_key}'),
        'enabled': True,
        'added_at': datetime.now().isoformat()
    }

    save_products(products)

    # GitHubにも同期（GitHub Actions経由）
    try:
        import subprocess
        subprocess.run(['git', 'add', PRODUCTS_FILE], check=True)
        subprocess.run(['git', 'commit', '-m', f'Add product: {product_key}'], check=True)
        subprocess.run(['git', 'push'], check=True)
    except:
        pass  # Git操作が失敗しても続行

    return jsonify({'success': True, 'product': products[product_key]})

@app.route('/api/products/<product_key>', methods=['DELETE'])
@check_password
def delete_product(product_key):
    """商品を削除"""
    products = load_products()

    if product_key not in products:
        return jsonify({'error': 'Product not found'}), 404

    del products[product_key]
    save_products(products)

    # GitHubにも同期
    try:
        import subprocess
        subprocess.run(['git', 'add', PRODUCTS_FILE], check=True)
        subprocess.run(['git', 'commit', '-m', f'Delete product: {product_key}'], check=True)
        subprocess.run(['git', 'push'], check=True)
    except:
        pass

    return jsonify({'success': True})

@app.route('/api/products/<product_key>/toggle', methods=['POST'])
@check_password
def toggle_product(product_key):
    """商品の有効/無効を切り替え"""
    products = load_products()

    if product_key not in products:
        return jsonify({'error': 'Product not found'}), 404

    products[product_key]['enabled'] = not products[product_key].get('enabled', True)
    save_products(products)

    # GitHubにも同期
    try:
        import subprocess
        status = 'Enable' if products[product_key]['enabled'] else 'Disable'
        subprocess.run(['git', 'add', PRODUCTS_FILE], check=True)
        subprocess.run(['git', 'commit', '-m', f'{status} product: {product_key}'], check=True)
        subprocess.run(['git', 'push'], check=True)
    except:
        pass

    return jsonify({'success': True, 'enabled': products[product_key]['enabled']})

@app.route('/api/prices', methods=['GET'])
def get_prices():
    """価格履歴を取得"""
    history = load_price_history()
    return jsonify(history)

@app.route('/api/check-prices', methods=['POST'])
@check_password
def check_prices_now():
    """今すぐ価格をチェック"""
    try:
        from src.scrapers.bullionstar import BullionStarScraper
        import asyncio

        scraper = BullionStarScraper()
        products = load_products()

        # 価格チェックを実行
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        prices = loop.run_until_complete(scraper.scrape_prices())

        # 価格履歴を更新
        history = load_price_history()
        timestamp = datetime.now().isoformat()

        for product_key, price_data in prices.items():
            history['prices'].append({
                'product_key': product_key,
                'product_name': products.get(product_key, {}).get('name', product_key),
                'price': price_data['price'],
                'currency': price_data['currency'],
                'timestamp': timestamp
            })

        history['last_update'] = timestamp
        save_price_history(history)

        return jsonify({'success': True, 'prices': prices})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)