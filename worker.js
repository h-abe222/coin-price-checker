/**
 * Cloudflare Worker with D1 Database
 * 完全にWeb上で商品管理が可能
 */

// CORSヘッダー
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// 認証チェック
function checkAuth(request, env) {
  const auth = request.headers.get('Authorization');
  const password = env.ADMIN_PASSWORD || 'admin123';
  return auth === `Bearer ${password}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // プリフライトリクエスト
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // HTMLページ配信（ルートパス）
      if (path === '/' && request.method === 'GET') {
        const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="pragma" content="no-cache">
    <meta http-equiv="expires" content="0">
    <title>コイン価格チェッカー - 貴金属価格監視システム</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .card-shadow {
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .loading {
            display: none;
        }
        .loading.show {
            display: block;
        }
        .status-badge {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center">
        <div class="text-center">
            <i class="fas fa-coins text-6xl text-purple-600 mb-4"></i>
            <h1 class="text-3xl font-bold text-gray-800 mb-2">コイン価格チェッカー</h1>
            <p class="text-gray-600">貴金属・コイン価格の自動監視システム</p>
            <div class="mt-8">
                <a href="/admin" class="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition">
                    <i class="fas fa-cog mr-2"></i>管理画面へ
                </a>
            </div>
        </div>
    </div>
</body>
</html>`;

        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // 管理画面配信（/admin パス）
      if (path === '/admin' && request.method === 'GET') {
        const adminHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="cache-control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="pragma" content="no-cache">
    <meta http-equiv="expires" content="0">
    <title>コイン価格チェッカー - 貴金属価格監視システム</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .card-shadow {
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .loading {
            display: none;
        }
        .loading.show {
            display: block;
        }
        .status-badge {
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- ログイン画面 -->
    <div id="loginScreen" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl p-8 max-w-md w-full mx-4 card-shadow">
            <div class="text-center mb-6">
                <i class="fas fa-lock text-5xl text-purple-600 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800">管理画面ログイン</h2>
                <p class="text-gray-600 mt-2">パスワードを入力してください</p>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-gray-700 font-semibold mb-2">パスワード</label>
                    <input type="password" id="password"
                           placeholder="パスワードを入力"
                           class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500"
                           onkeypress="if(event.key==='Enter')login()">
                </div>

                <button onclick="login()"
                        class="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold transition">
                    <i class="fas fa-sign-in-alt mr-2"></i>ログイン
                </button>

                <div id="loginError" class="hidden text-red-600 text-sm text-center">
                    <i class="fas fa-exclamation-circle mr-1"></i>
                    パスワードが正しくありません
                </div>
            </div>
        </div>
    </div>

    <!-- メインコンテンツ -->
    <div id="mainScreen" class="hidden">
        <!-- ヘッダー -->
        <header class="gradient-bg text-white py-6 px-4">
            <div class="max-w-7xl mx-auto flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold flex items-center">
                        <i class="fas fa-coins mr-3"></i>
                        コイン価格チェッカー
                    </h1>
                    <p class="mt-2 text-purple-100">貴金属・コイン価格の自動監視システム</p>
                </div>
                <button onclick="logout()" class="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-lg flex items-center transition">
                    <i class="fas fa-sign-out-alt mr-2"></i>ログアウト
                </button>
            </div>
        </header>

        <div class="max-w-7xl mx-auto px-4 py-8">
            <!-- ステータスバー -->
            <div class="bg-white rounded-lg card-shadow p-6 mb-8">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div class="text-center">
                        <div class="text-gray-600 text-sm">監視中のアイテム</div>
                        <div class="text-3xl font-bold text-purple-600" id="activeCount">0</div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-600 text-sm">登録アイテム数</div>
                        <div class="text-3xl font-bold text-gray-800" id="totalCount">0</div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-600 text-sm">最終更新</div>
                        <div class="text-xl font-semibold text-gray-800" id="lastUpdate">--:--</div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-600 text-sm">システム状態</div>
                        <div class="text-xl font-semibold">
                            <span class="status-badge bg-green-500 text-white px-3 py-1 rounded-full text-sm">
                                <i class="fas fa-check-circle"></i> 正常
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- メインパネル -->
            <div class="bg-white rounded-lg card-shadow">

                <!-- タブメニュー -->
                <div class="border-b">
                    <nav class="flex">
                        <button onclick="showTab('products')" id="productsTabBtn"
                                class="tab-btn px-6 py-4 text-purple-600 font-semibold border-b-2 border-purple-600">
                            <i class="fas fa-list mr-2"></i>アイテム一覧
                        </button>
                        <button onclick="showTab('add')" id="addTabBtn"
                                class="tab-btn px-6 py-4 text-gray-600 hover:text-purple-600">
                            <i class="fas fa-plus-circle mr-2"></i>新規登録
                        </button>
                        <button onclick="showTab('settings')" id="settingsTabBtn"
                                class="tab-btn px-6 py-4 text-gray-600 hover:text-purple-600">
                            <i class="fas fa-cog mr-2"></i>API設定
                        </button>
                    </nav>
                </div>

                <!-- 商品一覧タブ -->
                <div id="productsTab" class="tab-content p-6">
                    <div class="flex justify-between mb-4">
                        <h2 class="text-xl font-semibold">監視中のコイン・貴金属</h2>
                        <button onclick="refreshProducts()"
                                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                            <i class="fas fa-sync-alt"></i> 更新
                        </button>
                    </div>
                    <div id="productsList" class="space-y-4">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                            <p>読み込み中...</p>
                        </div>
                    </div>
                </div>

                <!-- 新規登録タブ -->
                <div id="addTab" class="tab-content hidden p-6">
                    <h2 class="text-xl font-semibold mb-4">新しいコイン・貴金属を追加</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">商品URL</label>
                            <input type="text" id="productUrl"
                                   placeholder="https://www.bullionstar.com/buy/product/... または他の貴金属サイト"
                                   class="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">商品名（オプション）</label>
                            <input type="text" id="productName"
                                   placeholder="例: American Gold Eagle 1oz、Silver Maple Leaf 1oz など"
                                   class="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                        </div>
                        <button onclick="addProduct()"
                                class="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-plus mr-2"></i>コイン・貴金属を追加
                        </button>
                        <div id="addMessage" class="hidden p-4 rounded-lg"></div>
                    </div>
                </div>

                <!-- API設定タブ -->
                <div id="settingsTab" class="tab-content hidden p-6">
                    <h2 class="text-xl font-semibold mb-4">API設定</h2>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <p class="text-sm text-gray-600 mb-4">
                            Cloudflare WorkerのAPIエンドポイントを設定してください。
                        </p>
                        <div class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium mb-1">Worker URL</label>
                                <input type="text" id="workerUrl"
                                       placeholder="https://your-worker.username.workers.dev"
                                       class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <div>
                                <label class="block text-sm font-medium mb-1">管理パスワード</label>
                                <input type="password" id="adminPassword"
                                       placeholder="admin123"
                                       class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <button onclick="saveSettings()"
                                    class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                                設定を保存
                            </button>
                            <div id="settingsMessage" class="hidden mt-2 p-3 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- フッター -->
        <footer class="bg-gray-800 text-white py-6 mt-12">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <p>コイン価格チェッカー - Cloudflare D1版</p>
                <p class="mt-2 text-sm text-gray-400">
                    Powered by Cloudflare Workers & D1 Database
                </p>
            </div>
        </footer>
    </div>

    <script>
        // 設定
        let API_URL = localStorage.getItem('workerUrl') || window.location.origin;
        let ADMIN_PASSWORD = localStorage.getItem('adminPassword') || 'admin123';
        const LOGIN_PASSWORD = 'admin123';

        // ログイン
        function login() {
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('loginError');

            if (password === LOGIN_PASSWORD) {
                sessionStorage.setItem('authenticated', 'true');
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('mainScreen').classList.remove('hidden');

                if (!API_URL || API_URL === window.location.origin) {
                    API_URL = window.location.origin;
                    localStorage.setItem('workerUrl', API_URL);
                }

                loadProducts();
                updateStatus();
            } else {
                errorDiv.textContent = 'パスワードが正しくありません';
                errorDiv.classList.remove('hidden');
                document.getElementById('password').value = '';

                setTimeout(() => {
                    errorDiv.classList.add('hidden');
                }, 3000);
            }
        }

        // ログアウト
        function logout() {
            sessionStorage.removeItem('authenticated');
            location.reload();
        }

        // タブ切り替え
        function showTab(tabName) {
            // すべてのタブコンテンツを非表示
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.add('hidden');
            });

            // すべてのタブボタンのスタイルをリセット
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('border-purple-600', 'text-purple-600', 'border-b-2', 'font-semibold');
                btn.classList.add('text-gray-600');
            });

            // 選択されたタブを表示
            document.getElementById(tabName + 'Tab').classList.remove('hidden');
            const btn = document.getElementById(tabName + 'TabBtn');
            btn.classList.add('border-purple-600', 'text-purple-600', 'border-b-2', 'font-semibold');
            btn.classList.remove('text-gray-600');
        }

        // メッセージ表示
        function showMessage(elementId, message, type = 'success') {
            const element = document.getElementById(elementId);
            element.classList.remove('hidden', 'bg-green-100', 'bg-red-100', 'bg-yellow-100',
                                    'text-green-800', 'text-red-800', 'text-yellow-800');

            if (type === 'success') {
                element.classList.add('bg-green-100', 'text-green-800');
            } else if (type === 'error') {
                element.classList.add('bg-red-100', 'text-red-800');
            } else {
                element.classList.add('bg-yellow-100', 'text-yellow-800');
            }

            element.textContent = message;
            setTimeout(() => {
                element.classList.add('hidden');
            }, 5000);
        }

        // 商品一覧を読み込み
        async function loadProducts() {
            if (!API_URL) {
                document.getElementById('productsList').innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <p>APIが設定されていません</p>
                        <button onclick="showTab('settings')" class="mt-2 text-blue-600 hover:underline">
                            設定画面へ
                        </button>
                    </div>
                \`;
                return;
            }

            try {
                const response = await fetch(\`\${API_URL}/api/products\`);
                const products = await response.json();
                displayProducts(products);
            } catch (error) {
                console.error('Error loading products:', error);
                document.getElementById('productsList').innerHTML = \`
                    <div class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-circle text-4xl mb-4"></i>
                        <p>商品の読み込みに失敗しました</p>
                        <p class="text-sm mt-2">\${error.message}</p>
                    </div>
                \`;
            }
        }

        // 商品を表示
        function displayProducts(products) {
            const container = document.getElementById('productsList');
            const productArray = Object.entries(products || {});

            // カウンターを更新
            const enabledCount = productArray.filter(([k, p]) => p.enabled).length;
            document.getElementById('activeCount').textContent = enabledCount;
            document.getElementById('totalCount').textContent = productArray.length;

            if (productArray.length === 0) {
                container.innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-inbox text-5xl mb-4"></i>
                        <p>商品が登録されていません</p>
                        <p class="mt-2">「新規登録」タブから商品を追加してください</p>
                        <button onclick="showTab('add')" class="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition">
                            <i class="fas fa-plus mr-2"></i>商品を追加
                        </button>
                    </div>
                \`;
                return;
            }

            container.innerHTML = productArray.map(([key, product]) => \`
                <div class="border rounded-lg p-4 hover:shadow-lg transition-shadow card-shadow">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center flex-1">
                            \${product.image_url ? \`
                                <div class="flex-shrink-0 mr-4">
                                    <img src="\${product.image_url}"
                                         alt="\${product.name}"
                                         class="w-16 h-16 object-cover rounded-lg border border-gray-200"
                                         onerror="this.style.display='none'">
                                </div>
                            \` : ''}
                            <div class="flex-1">
                                <h3 class="font-semibold text-lg">\${product.name}</h3>
                                <p class="text-sm text-gray-600 mt-1">
                                    <i class="fas fa-link mr-1"></i>
                                    <a href="\${product.url}" target="_blank" class="text-blue-600 hover:underline">
                                        商品ページを開く
                                    </a>
                                </p>
                                <p class="text-xs text-gray-500 mt-1">
                                    追加日: \${new Date(product.created_at || Date.now()).toLocaleDateString('ja-JP')}
                                </p>
                            </div>
                        </div>
                        <div class="text-right ml-4">
                            <div class="text-2xl font-bold text-purple-600 mb-2">
                                ¥\${(product.current_price || 0).toLocaleString()}
                            </div>
                            <div class="mb-2">
                                \${product.enabled ?
                                    '<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">監視中</span>' :
                                    '<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-sm">停止中</span>'
                                }
                            </div>
                            <div class="space-x-2">
                                <button onclick="toggleProduct('\${key}')"
                                        class="p-2 rounded \${product.enabled ? 'text-green-600' : 'text-gray-400'} hover:bg-gray-100 transition">
                                    <i class="fas fa-power-off"></i>
                                </button>
                                <button onclick="deleteProduct('\${key}')"
                                        class="p-2 rounded text-red-600 hover:bg-gray-100 transition">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        // 商品を追加
        async function addProduct() {
            console.log('addProduct called - Version: 2024-09-15-fix');
            const url = document.getElementById('productUrl').value.trim();
            const name = document.getElementById('productName').value.trim();

            if (!url) {
                showMessage('addMessage', 'URLを入力してください', 'error');
                return;
            }

            if (!API_URL) {
                console.error('API_URL is not set:', API_URL);
                showMessage('addMessage', 'APIが設定されていません。設定タブでWorker URLを入力してください。', 'error');
                showTab('settings');
                return;
            }
            console.log('API_URL:', API_URL);

            try {
                const response = await fetch(\`\${API_URL}/api/products\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${ADMIN_PASSWORD}\`
                    },
                    body: JSON.stringify({ url, name })
                });

                const result = await response.json();

                if (response.ok) {
                    showMessage('addMessage', '商品を追加しました！', 'success');
                    document.getElementById('productUrl').value = '';
                    document.getElementById('productName').value = '';
                    setTimeout(() => {
                        showTab('products');
                        loadProducts();
                    }, 1000);
                } else {
                    showMessage('addMessage', result.error || '追加に失敗しました', 'error');
                }
            } catch (error) {
                showMessage('addMessage', \`エラー: \${error.message}\`, 'error');
            }
        }

        // 商品を削除
        async function deleteProduct(productKey) {
            if (!confirm('この商品を削除しますか？')) return;

            try {
                const response = await fetch(\`\${API_URL}/api/products/\${productKey}\`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': \`Bearer \${ADMIN_PASSWORD}\`
                    }
                });

                if (response.ok) {
                    loadProducts();
                } else {
                    const result = await response.json();
                    alert(result.error || '削除に失敗しました');
                }
            } catch (error) {
                alert(\`エラー: \${error.message}\`);
            }
        }

        // 商品の有効/無効を切り替え
        async function toggleProduct(productKey) {
            try {
                const response = await fetch(\`\${API_URL}/api/products/\${productKey}/toggle\`, {
                    method: 'POST',
                    headers: {
                        'Authorization': \`Bearer \${ADMIN_PASSWORD}\`
                    }
                });

                if (response.ok) {
                    loadProducts();
                } else {
                    const result = await response.json();
                    alert(result.error || '更新に失敗しました');
                }
            } catch (error) {
                alert(\`エラー: \${error.message}\`);
            }
        }

        // ステータスを更新
        function updateStatus() {
            const now = new Date();
            document.getElementById('lastUpdate').textContent = now.toLocaleTimeString('ja-JP');
        }

        // 商品リストを更新（価格も更新）
        async function refreshProducts() {
            // 価格を更新
            try {
                const response = await fetch(\`\${API_URL}/api/update-prices\`, {
                    method: 'POST',
                    headers: {
                        'Authorization': \`Bearer \${ADMIN_PASSWORD}\`
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.changes && result.changes.length > 0) {
                        console.log('価格更新:', result.changes);
                    }
                }
            } catch (error) {
                console.error('価格更新エラー:', error);
            }

            // 商品リストを再読み込み
            loadProducts();
        }

        // 設定を保存
        function saveSettings() {
            const url = document.getElementById('workerUrl').value.trim();
            const password = document.getElementById('adminPassword').value.trim();

            if (!url) {
                showMessage('settingsMessage', 'Worker URLを入力してください', 'error');
                return;
            }

            localStorage.setItem('workerUrl', url);
            localStorage.setItem('adminPassword', password || 'admin123');

            API_URL = url;
            ADMIN_PASSWORD = password || 'admin123';

            showMessage('settingsMessage', '設定を保存しました！', 'success');

            setTimeout(() => {
                showTab('products');
                loadProducts();
            }, 1000);
        }

        // ページ読み込み時
        window.onload = function() {
            if (sessionStorage.getItem('authenticated') === 'true') {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('mainScreen').classList.remove('hidden');

                // 設定値を表示
                document.getElementById('workerUrl').value = API_URL;
                document.getElementById('adminPassword').value = ADMIN_PASSWORD;

                if (API_URL) {
                    loadProducts();
                    updateStatus();
                } else {
                    showTab('settings');
                    showMessage('settingsMessage', 'Worker URLを設定してください', 'warning');
                }
            }

            // パスワード入力欄にフォーカス
            document.getElementById('password').focus();
        };
    </script>
</body>
</html>`;

        return new Response(adminHtml, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // 商品一覧取得
      if (path === '/api/products' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY created_at DESC"
        ).all();

        // 配列形式をオブジェクト形式に変換（互換性のため）
        const products = {};
        for (const product of results) {
          products[product.key] = product;
        }

        return new Response(JSON.stringify(products), {
          headers: corsHeaders
        });
      }

      // 商品追加
      if (path === '/api/products' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const body = await request.json();
        const { url: productUrl, name, selectors } = body;

        if (!productUrl) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // URLから商品キーを生成
        const urlObj = new URL(productUrl);
        const pathParts = urlObj.pathname.split('/');
        const productKey = pathParts[pathParts.length - 1] || `product-${Date.now()}`;

        // サイト名を取得
        const site = urlObj.hostname.replace('www.', '');

        try {
          // データベースに挿入
          const result = await env.DB.prepare(
            `INSERT INTO products (key, url, name, site, selectors, enabled, current_price)
             VALUES (?, ?, ?, ?, ?, 1, 0)`
          ).bind(
            productKey,
            productUrl,
            name || `新商品 - ${productKey}`,
            site,
            selectors ? JSON.stringify(selectors) : null
          ).run();

          // 挿入した商品を取得
          const { results } = await env.DB.prepare(
            "SELECT * FROM products WHERE id = ?"
          ).bind(result.meta.last_row_id).all();

          return new Response(JSON.stringify({
            success: true,
            product: results[0]
          }), {
            headers: corsHeaders
          });

        } catch (error) {
          if (error.message.includes('UNIQUE')) {
            return new Response(JSON.stringify({
              error: 'この商品は既に登録されています'
            }), {
              status: 400,
              headers: corsHeaders
            });
          }
          throw error;
        }
      }

      // 商品削除
      if (path.startsWith('/api/products/') && request.method === 'DELETE') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const productKey = path.split('/').pop();

        const result = await env.DB.prepare(
          "DELETE FROM products WHERE key = ?"
        ).bind(productKey).run();

        if (result.meta.changes === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders
        });
      }

      // 商品の有効/無効切り替え
      if (path.startsWith('/api/products/') && path.endsWith('/toggle') && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const productKey = path.split('/')[3];

        // 現在の状態を取得
        const { results: current } = await env.DB.prepare(
          "SELECT enabled FROM products WHERE key = ?"
        ).bind(productKey).all();

        if (current.length === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        // 状態を反転
        const newEnabled = !current[0].enabled;
        await env.DB.prepare(
          "UPDATE products SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?"
        ).bind(newEnabled ? 1 : 0, productKey).run();

        return new Response(JSON.stringify({
          success: true,
          enabled: newEnabled
        }), {
          headers: corsHeaders
        });
      }

      // 価格履歴取得
      if (path === '/api/prices' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT
            ph.*,
            p.name as product_name,
            p.key as product_key
           FROM price_history ph
           JOIN products p ON ph.product_id = p.id
           ORDER BY ph.recorded_at DESC
           LIMIT 1000`
        ).all();

        return new Response(JSON.stringify({
          prices: results,
          last_update: results[0]?.recorded_at || null
        }), {
          headers: corsHeaders
        });
      }

      // 価格更新（Playwrightから呼ばれる）
      if (path === '/api/update-prices' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const body = await request.json();
        const { updates } = body; // [{key: 'xxx', price: 123}, ...]

        if (!updates || !Array.isArray(updates)) {
          return new Response(JSON.stringify({ error: 'Invalid updates format' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        const changes = [];

        for (const update of updates) {
          // 商品を更新（価格、商品名、画像URL）
          let sql = `UPDATE products SET current_price = ?, updated_at = CURRENT_TIMESTAMP`;
          let params = [update.price];

          if (update.name) {
            sql += `, name = ?`;
            params.push(update.name);
          }

          if (update.imageUrl) {
            sql += `, image_url = ?`;
            params.push(update.imageUrl);
          }

          sql += ` WHERE key = ?`;
          params.push(update.key);

          const result = await env.DB.prepare(sql).bind(...params).run();

          if (result.meta.changes > 0) {
            // 商品IDを取得
            const { results: product } = await env.DB.prepare(
              "SELECT id, name FROM products WHERE key = ?"
            ).bind(update.key).all();

            if (product.length > 0) {
              // 価格履歴に追加
              await env.DB.prepare(
                "INSERT INTO price_history (product_id, price, currency) VALUES (?, ?, ?)"
              ).bind(product[0].id, update.price, update.currency || 'JPY').run();

              changes.push({
                product: product[0].name,
                price: update.price
              });
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          updated: changes.length,
          changes: changes
        }), {
          headers: corsHeaders
        });
      }

      // 商品検索
      if (path === '/api/search' && request.method === 'GET') {
        const params = url.searchParams;
        const query = params.get('q') || '';
        const site = params.get('site') || '';

        let sql = "SELECT * FROM products WHERE 1=1";
        const bindings = [];

        if (query) {
          sql += " AND (name LIKE ? OR url LIKE ?)";
          bindings.push(`%${query}%`, `%${query}%`);
        }

        if (site) {
          sql += " AND site = ?";
          bindings.push(site);
        }

        sql += " ORDER BY created_at DESC";

        const stmt = env.DB.prepare(sql);
        if (bindings.length > 0) {
          stmt.bind(...bindings);
        }

        const { results } = await stmt.all();

        return new Response(JSON.stringify(results), {
          headers: corsHeaders
        });
      }

      // 統計情報
      if (path === '/api/stats' && request.method === 'GET') {
        const [totalProducts, enabledProducts, totalPrices, sites] = await Promise.all([
          env.DB.prepare("SELECT COUNT(*) as count FROM products").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM products WHERE enabled = 1").first(),
          env.DB.prepare("SELECT COUNT(*) as count FROM price_history").first(),
          env.DB.prepare("SELECT DISTINCT site FROM products WHERE site IS NOT NULL").all()
        ]);

        return new Response(JSON.stringify({
          total_products: totalProducts.count,
          enabled_products: enabledProducts.count,
          total_price_records: totalPrices.count,
          sites: sites.results.map(s => s.site)
        }), {
          headers: corsHeaders
        });
      }

      // 404
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: corsHeaders
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};