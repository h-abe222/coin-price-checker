#!/usr/bin/env python3
"""
BullionStar Price Monitor - Production Web Application
クラウドホスティング対応版
"""

import os
import json
import hashlib
import secrets
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from apscheduler.schedulers.background import BackgroundScheduler
import aiohttp
import asyncio
import re
from functools import wraps

# 環境設定
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', secrets.token_hex(32))
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///monitor.db')
if app.config['SQLALCHEMY_DATABASE_URI'].startswith('postgres://'):
    app.config['SQLALCHEMY_DATABASE_URI'] = app.config['SQLALCHEMY_DATABASE_URI'].replace('postgres://', 'postgresql://')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 拡張機能の初期化
db = SQLAlchemy(app)
migrate = Migrate(app, db)
CORS(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# スケジューラーの初期化
scheduler = BackgroundScheduler()

# データベースモデル
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    email = db.Column(db.String(120), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, unique=True, nullable=False)
    url = db.Column(db.String(500), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    enabled = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    current_price = db.Column(db.Float)
    currency = db.Column(db.String(10), default='JPY')

class PriceHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    price = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default='JPY')
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    product = db.relationship('Product', backref='price_history')

class Alert(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    alert_type = db.Column(db.String(50))  # threshold, percentage_change
    threshold_value = db.Column(db.Float)
    message = db.Column(db.Text)
    triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    sent = db.Column(db.Boolean, default=False)
    product = db.relationship('Product', backref='alerts')

# ユーザーローダー
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# 管理者のみアクセス可能なデコレーター
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

# 価格取得関数
async def fetch_price_from_api(product_id, currency='JPY'):
    """BullionStar APIから価格を取得"""
    url = "https://services.bullionstar.com/product/v2/prices"
    params = {
        "currency": currency,
        "locationId": 1,
        "productIds": product_id
    }

    async with aiohttp.ClientSession() as session:
        try:
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
        except Exception as e:
            print(f"Error fetching price: {e}")
    return None

# ルート
@app.route('/')
def index():
    """メインページ"""
    if not current_user.is_authenticated:
        return redirect(url_for('login'))

    products = Product.query.all()
    return render_template('dashboard.html', products=products)

@app.route('/login', methods=['GET', 'POST'])
def login():
    """ログインページ"""
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username')
        password = data.get('password')

        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            return jsonify({'success': True, 'redirect': url_for('index')})

        return jsonify({'error': 'Invalid credentials'}), 401

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    """ログアウト"""
    logout_user()
    return redirect(url_for('login'))

@app.route('/api/products', methods=['GET'])
@login_required
def get_products():
    """商品リストを取得"""
    products = Product.query.all()
    return jsonify([{
        'id': p.id,
        'product_id': p.product_id,
        'name': p.name,
        'url': p.url,
        'enabled': p.enabled,
        'current_price': p.current_price,
        'currency': p.currency,
        'updated_at': p.updated_at.isoformat() if p.updated_at else None
    } for p in products])

@app.route('/api/products', methods=['POST'])
@login_required
def add_product():
    """商品を追加"""
    data = request.json
    url = data.get('url')
    product_id = data.get('product_id')
    name = data.get('name')

    if not all([url, product_id, name]):
        return jsonify({'error': 'Missing required fields'}), 400

    # 重複チェック
    existing = Product.query.filter_by(product_id=product_id).first()
    if existing:
        return jsonify({'error': 'Product already exists'}), 400

    # 価格を取得
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    price = loop.run_until_complete(fetch_price_from_api(product_id))
    loop.close()

    # 商品を保存
    product = Product(
        product_id=product_id,
        url=url,
        name=name,
        current_price=price,
        currency=os.getenv('CURRENCY', 'JPY')
    )
    db.session.add(product)
    db.session.commit()

    # 価格履歴を記録
    if price:
        history = PriceHistory(
            product_id=product.id,
            price=price,
            currency=product.currency
        )
        db.session.add(history)
        db.session.commit()

    return jsonify({
        'success': True,
        'product': {
            'id': product.id,
            'product_id': product.product_id,
            'name': product.name,
            'current_price': product.current_price
        }
    })

@app.route('/api/products/<int:product_id>', methods=['DELETE'])
@login_required
def delete_product(product_id):
    """商品を削除"""
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/products/<int:product_id>/toggle', methods=['POST'])
@login_required
def toggle_product(product_id):
    """商品の有効/無効を切り替え"""
    product = Product.query.get_or_404(product_id)
    product.enabled = not product.enabled
    db.session.commit()
    return jsonify({'success': True, 'enabled': product.enabled})

@app.route('/api/prices/update', methods=['POST'])
@login_required
@admin_required
def update_prices():
    """全商品の価格を更新"""
    products = Product.query.filter_by(enabled=True).all()
    updated = []

    for product in products:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        price = loop.run_until_complete(
            fetch_price_from_api(product.product_id, product.currency)
        )
        loop.close()

        if price:
            # 価格変動チェック
            if product.current_price:
                change_percent = ((price - product.current_price) / product.current_price) * 100

                # アラート条件チェック（3%以上の変動）
                if abs(change_percent) >= 3.0:
                    alert = Alert(
                        product_id=product.id,
                        alert_type='percentage_change',
                        threshold_value=change_percent,
                        message=f'{product.name}: {change_percent:.2f}% change'
                    )
                    db.session.add(alert)

            # 価格更新
            product.current_price = price
            product.updated_at = datetime.utcnow()

            # 履歴記録
            history = PriceHistory(
                product_id=product.id,
                price=price,
                currency=product.currency
            )
            db.session.add(history)

            updated.append({
                'name': product.name,
                'price': price
            })

    db.session.commit()
    return jsonify({'success': True, 'updated': updated})

@app.route('/api/prices/history/<int:product_id>')
@login_required
def get_price_history(product_id):
    """価格履歴を取得"""
    product = Product.query.get_or_404(product_id)
    history = PriceHistory.query.filter_by(product_id=product.id)\
        .order_by(PriceHistory.timestamp.desc())\
        .limit(100).all()

    return jsonify({
        'product': product.name,
        'history': [{
            'price': h.price,
            'currency': h.currency,
            'timestamp': h.timestamp.isoformat()
        } for h in history]
    })

@app.route('/api/alerts')
@login_required
def get_alerts():
    """アラートを取得"""
    alerts = Alert.query.order_by(Alert.triggered_at.desc()).limit(50).all()
    return jsonify([{
        'id': a.id,
        'product': a.product.name,
        'type': a.alert_type,
        'value': a.threshold_value,
        'message': a.message,
        'triggered_at': a.triggered_at.isoformat(),
        'sent': a.sent
    } for a in alerts])

@app.route('/setup', methods=['GET', 'POST'])
def setup():
    """初期セットアップ"""
    # 既にユーザーが存在する場合はリダイレクト
    if User.query.first():
        return redirect(url_for('login'))

    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form

        # 管理者ユーザーを作成
        admin = User(
            username=data.get('username'),
            email=data.get('email'),
            password_hash=generate_password_hash(data.get('password')),
            is_admin=True
        )
        db.session.add(admin)
        db.session.commit()

        return jsonify({'success': True, 'message': 'Setup completed'})

    return render_template('setup.html')

# スケジュールジョブ
def scheduled_price_update():
    """定期的な価格更新"""
    with app.app_context():
        products = Product.query.filter_by(enabled=True).all()
        for product in products:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            price = loop.run_until_complete(
                fetch_price_from_api(product.product_id, product.currency)
            )
            loop.close()

            if price:
                product.current_price = price
                product.updated_at = datetime.utcnow()

                history = PriceHistory(
                    product_id=product.id,
                    price=price,
                    currency=product.currency
                )
                db.session.add(history)

        db.session.commit()

# アプリケーション初期化
@app.before_first_request
def initialize():
    """アプリケーション初期化"""
    db.create_all()

    # スケジューラーを開始
    if not scheduler.running:
        scheduler.add_job(
            func=scheduled_price_update,
            trigger="interval",
            hours=1,
            id='price_update',
            replace_existing=True
        )
        scheduler.start()

@app.teardown_appcontext
def shutdown_scheduler(exception=None):
    """スケジューラーを停止"""
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except:
        pass

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=int(os.getenv('PORT', 5000)))