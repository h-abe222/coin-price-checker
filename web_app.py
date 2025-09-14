#!/usr/bin/env python3
"""
Web UI for BullionStar Price Monitor
監視対象商品を管理するためのWebインターフェース
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for
from flask_cors import CORS
import json
import asyncio
from pathlib import Path
from datetime import datetime
import aiohttp
from playwright.async_api import async_playwright
import re
import os

app = Flask(__name__)
CORS(app)

# データファイルのパス
PRODUCTS_FILE = Path("data/products.json")
PRODUCTS_FILE.parent.mkdir(exist_ok=True)

def load_products():
    """商品リストを読み込み"""
    if PRODUCTS_FILE.exists():
        with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_products(products):
    """商品リストを保存"""
    with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, indent=2, ensure_ascii=False)

async def detect_product_id(url):
    """URLから商品IDを自動検出"""
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context()
    page = await context.new_page()

    product_id = None
    product_name = None

    try:
        # APIコールを監視
        api_calls = []

        async def handle_request(request):
            if 'services.bullionstar.com' in request.url and 'productIds' in request.url:
                api_calls.append(request.url)

        page.on('request', handle_request)

        await page.goto(url, wait_until='networkidle', timeout=30000)

        # APIコールから商品IDを抽出
        for api_url in api_calls:
            match = re.search(r'productIds=(\d+)', api_url)
            if match:
                product_id = int(match.group(1))
                break

        # 商品名を取得
        try:
            h1_element = await page.query_selector('h1')
            if h1_element:
                product_name = await h1_element.inner_text()
                product_name = product_name.strip()
        except:
            pass

        # IDが見つからない場合はHTMLから探す
        if not product_id:
            html = await page.content()
            match = re.search(r'productId["\']?\s*[:=]\s*["\']?(\d+)', html)
            if match:
                product_id = int(match.group(1))

    except Exception as e:
        print(f"Error detecting product ID: {e}")

    finally:
        await context.close()
        await browser.close()

    return product_id, product_name

async def test_product_price(product_id, currency="JPY"):
    """商品IDから価格を取得してテスト"""
    url = "https://services.bullionstar.com/product/v2/prices"
    params = {
        "currency": currency,
        "locationId": 1,
        "productIds": product_id
    }

    async with aiohttp.ClientSession() as session:
        async with session.get(url, params=params) as response:
            if response.status == 200:
                data = await response.json()
                if 'products' in data and len(data['products']) > 0:
                    product = data['products'][0]
                    price_str = product.get('price', '')
                    if price_str:
                        match = re.search(r'([\d,]+\.?\d*)', price_str)
                        if match:
                            return float(match.group(1).replace(',', ''))
    return None

@app.route('/')
def index():
    """メインページ"""
    products = load_products()
    return render_template('index.html', products=products)

@app.route('/api/products', methods=['GET'])
def get_products():
    """商品リストを取得"""
    products = load_products()
    return jsonify(products)

@app.route('/api/products', methods=['POST'])
def add_product():
    """商品を追加"""
    data = request.json
    url = data.get('url')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # 商品IDと名前を自動検出（非同期処理）
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    product_id, product_name = loop.run_until_complete(detect_product_id(url))
    loop.close()

    if not product_id:
        return jsonify({'error': 'Could not detect product ID from URL'}), 400

    # 価格テスト
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    price = loop.run_until_complete(test_product_price(product_id))
    loop.close()

    if not price:
        return jsonify({'error': 'Could not fetch price for this product'}), 400

    # 商品を保存
    products = load_products()
    product_key = f"product_{product_id}"

    products[product_key] = {
        'id': product_id,
        'url': url,
        'name': product_name or data.get('name', f'Product {product_id}'),
        'added_at': datetime.now().isoformat(),
        'enabled': True,
        'current_price': price
    }

    save_products(products)

    return jsonify({
        'success': True,
        'product': products[product_key]
    })

@app.route('/api/products/<product_key>', methods=['DELETE'])
def delete_product(product_key):
    """商品を削除"""
    products = load_products()

    if product_key in products:
        del products[product_key]
        save_products(products)
        return jsonify({'success': True})

    return jsonify({'error': 'Product not found'}), 404

@app.route('/api/products/<product_key>/toggle', methods=['POST'])
def toggle_product(product_key):
    """商品の有効/無効を切り替え"""
    products = load_products()

    if product_key in products:
        products[product_key]['enabled'] = not products[product_key].get('enabled', True)
        save_products(products)
        return jsonify({'success': True, 'enabled': products[product_key]['enabled']})

    return jsonify({'error': 'Product not found'}), 404

@app.route('/api/test-url', methods=['POST'])
def test_url():
    """URLをテストして商品情報を取得"""
    data = request.json
    url = data.get('url')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # 商品IDと名前を自動検出
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    product_id, product_name = loop.run_until_complete(detect_product_id(url))

    if product_id:
        # 価格を取得
        price = loop.run_until_complete(test_product_price(product_id))
        loop.close()

        return jsonify({
            'success': True,
            'product_id': product_id,
            'product_name': product_name,
            'price': price,
            'currency': os.getenv('CURRENCY', 'JPY')
        })

    loop.close()
    return jsonify({'error': 'Could not detect product information'}), 400

@app.route('/api/prices/history', methods=['GET'])
def get_price_history():
    """価格履歴を取得"""
    history_file = Path("data/price_history.json")
    if history_file.exists():
        with open(history_file, 'r') as f:
            return jsonify(json.load(f))
    return jsonify({})

if __name__ == '__main__':
    app.run(debug=True, port=5000)