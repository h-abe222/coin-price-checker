/**
 * Cloudflare Worker v2 - 複数サイト価格管理システム
 * 商品ごとに複数の外部サイトURLを管理し、価格を並列表示
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
    <title>価格比較ダッシュボード - 複数サイト価格管理システム</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .price-card {
            transition: all 0.3s ease;
        }
        .price-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        }
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
        }
        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- ログイン画面 -->
    <div id="loginScreen" class="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
        <div class="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div class="text-center mb-6">
                <i class="fas fa-lock text-5xl text-purple-600 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800">管理画面ログイン</h2>
            </div>
            <div class="space-y-4">
                <input type="password" id="password" placeholder="パスワードを入力"
                       class="w-full px-4 py-3 border rounded-lg focus:outline-none focus:border-purple-500"
                       onkeypress="if(event.key==='Enter')login()">
                <button onclick="login()"
                        class="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 font-semibold">
                    <i class="fas fa-sign-in-alt mr-2"></i>ログイン
                </button>
                <div id="loginError" class="hidden text-red-600 text-sm text-center"></div>
            </div>
        </div>
    </div>

    <!-- メインコンテンツ -->
    <div id="mainScreen" class="hidden">
        <!-- ヘッダー -->
        <header class="gradient-bg text-white py-6 px-4">
            <div class="max-w-7xl mx-auto flex justify-between items-center">
                <div>
                    <h1 class="text-3xl font-bold">
                        <i class="fas fa-chart-line mr-3"></i>
                        価格比較ダッシュボード
                    </h1>
                    <p class="mt-2 text-purple-100">複数サイト価格管理システム</p>
                </div>
                <div class="flex space-x-4">
                    <button onclick="showCreateProductModal()"
                            class="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-lg transition">
                        <i class="fas fa-plus mr-2"></i>商品を追加
                    </button>
                    <button onclick="showYBXImportModal()"
                            class="bg-indigo-700 hover:bg-indigo-800 px-4 py-2 rounded-lg transition">
                        <i class="fas fa-download mr-2"></i>YBXから一括インポート
                    </button>
                    <button onclick="logout()"
                            class="bg-purple-700 hover:bg-purple-800 px-4 py-2 rounded-lg transition">
                        <i class="fas fa-sign-out-alt mr-2"></i>ログアウト
                    </button>
                </div>
            </div>
        </header>

        <!-- 商品リスト -->
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="bg-white rounded-lg shadow-lg p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">
                        <i class="fas fa-box mr-2"></i>監視商品一覧
                    </h2>
                    <div class="flex space-x-2">
                        <button id="bulkDeleteBtn" onclick="toggleBulkDelete()"
                                class="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition">
                            <i class="fas fa-check-square mr-2"></i>選択モード
                        </button>
                        <button id="deleteSelectedBtn" onclick="deleteSelectedProducts()"
                                class="hidden bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">
                            <i class="fas fa-trash mr-2"></i>選択削除
                        </button>
                        <button onclick="refreshAllPrices()"
                                class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
                            <i class="fas fa-sync-alt mr-2"></i>全価格更新
                        </button>
                    </div>
                </div>
                <div id="bulkSelectBar" class="hidden bg-gray-100 p-3 rounded mb-4">
                    <div class="flex items-center justify-between">
                        <label class="flex items-center">
                            <input type="checkbox" id="selectAllProducts" onchange="toggleAllProducts()" class="mr-2">
                            <span>すべて選択</span>
                        </label>
                        <span id="selectedCount" class="text-sm text-gray-600">0個選択中</span>
                    </div>
                </div>
                <div id="productsList" class="space-y-4">
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                        <p>読み込み中...</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- YBXインポートモーダル -->
    <div id="ybxImportModal" class="modal">
        <div class="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
            <h3 class="text-xl font-bold mb-4">YBX.jpから商品をインポート</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-2">インポートするカテゴリを選択</label>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <label class="flex items-center">
                            <input type="checkbox" value="gold" class="ybx-category mr-2" checked>
                            <span>金（Gold）</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" value="silver" class="ybx-category mr-2" checked>
                            <span>銀（Silver）</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" value="platinum" class="ybx-category mr-2">
                            <span>プラチナ（Platinum）</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" value="bar" class="ybx-category mr-2">
                            <span>バー（Bar）</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" value="premium" class="ybx-category mr-2">
                            <span>プレミアム（Premium）</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" value="other" class="ybx-category mr-2">
                            <span>その他（Other）</span>
                        </label>
                    </div>
                </div>
                <div id="ybxImportProgress" class="hidden">
                    <div class="bg-blue-50 border border-blue-200 rounded p-4">
                        <div class="flex items-center">
                            <i class="fas fa-spinner fa-spin mr-2"></i>
                            <span id="ybxImportStatus">商品を取得中...</span>
                        </div>
                        <div class="mt-2">
                            <div class="bg-gray-200 rounded-full h-2">
                                <div id="ybxProgressBar" class="bg-blue-600 h-2 rounded-full transition-all" style="width: 0%"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div id="ybxProductList" class="hidden max-h-96 overflow-y-auto border rounded p-4">
                    <!-- 商品リストが動的に挿入される -->
                </div>
                <div class="flex space-x-2">
                    <button onclick="startYBXImport()"
                            id="ybxImportBtn"
                            class="flex-1 bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">
                        <i class="fas fa-download mr-2"></i>商品を取得
                    </button>
                    <button onclick="closeYBXImportModal()"
                            class="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 商品作成モーダル -->
    <div id="createProductModal" class="modal">
        <div class="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 class="text-xl font-bold mb-4">新規商品登録</h3>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1">商品名</label>
                    <input type="text" id="newProductName"
                           placeholder="例: Canadian Silver Maple Leaf 1oz"
                           class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-600">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">自社商品URL（オプション）</label>
                    <input type="text" id="newProductOwnUrl"
                           placeholder="https://myshop.com/products/..."
                           class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-600">
                </div>
                <div>
                    <label class="block text-sm font-medium mb-1">商品画像URL（オプション）</label>
                    <input type="text" id="newProductImageUrl"
                           placeholder="https://example.com/image.jpg"
                           class="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-600">
                </div>
                <div class="flex space-x-2">
                    <button onclick="createProduct()"
                            class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700">
                        <i class="fas fa-save mr-2"></i>保存
                    </button>
                    <button onclick="closeCreateProductModal()"
                            class="flex-1 bg-gray-500 text-white py-2 rounded hover:bg-gray-600">
                        キャンセル
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- URL管理モーダル -->
    <div id="urlManageModal" class="modal">
        <div class="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 class="text-xl font-bold mb-4">
                <span id="urlManageProductName"></span> - URL管理
            </h3>
            <input type="hidden" id="urlManageProductKey">

            <!-- URL追加フォーム -->
            <div class="bg-gray-50 p-4 rounded mb-4">
                <h4 class="font-semibold mb-2">新しいURLを追加</h4>
                <div class="flex space-x-2">
                    <input type="text" id="newSiteUrl"
                           placeholder="https://www.bullionstar.com/buy/product/..."
                           class="flex-1 p-2 border rounded">
                    <input type="text" id="newSiteName"
                           placeholder="サイト名（例: BullionStar）"
                           class="w-40 p-2 border rounded">
                    <button onclick="addSiteUrl()"
                            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-plus"></i> 追加
                    </button>
                </div>
            </div>

            <!-- 登録済みURL一覧 -->
            <div id="siteUrlsList" class="space-y-2 mb-4">
                <!-- 動的に生成 -->
            </div>

            <div class="flex justify-end">
                <button onclick="closeUrlManageModal()"
                        class="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">
                    閉じる
                </button>
            </div>
        </div>
    </div>

    <script>
        // 設定
        let API_URL = window.location.origin;
        let ADMIN_PASSWORD = localStorage.getItem('adminPassword') || 'admin123';
        const LOGIN_PASSWORD = 'admin123';
        let currentProducts = {};

        // 相対時間を表示する関数
        function getRelativeTime(timestamp) {
            if (!timestamp) return '未更新';

            const now = new Date();
            const updateTime = new Date(timestamp);
            const diffMs = now - updateTime;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) return 'たった今';
            if (diffMin < 60) return diffMin + '分前';
            if (diffHour < 24) return diffHour + '時間前';
            if (diffDay < 7) return diffDay + '日前';
            return updateTime.toLocaleDateString('ja-JP');
        }

        // 日時をフォーマットする関数
        function formatDateTime(timestamp) {
            if (!timestamp) return '-';
            const date = new Date(timestamp);
            return date.toLocaleString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        // ログイン
        function login() {
            const password = document.getElementById('password').value;
            console.log('Login attempt - Password entered:', password);
            console.log('Login attempt - Expected password:', LOGIN_PASSWORD);
            console.log('Login attempt - Match:', password === LOGIN_PASSWORD);

            if (password === LOGIN_PASSWORD) {
                sessionStorage.setItem('authenticated', 'true');
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('mainScreen').classList.remove('hidden');
                loadProducts();
            } else {
                const errorDiv = document.getElementById('loginError');
                errorDiv.textContent = 'パスワードが正しくありません（入力: ' + password + '）';
                errorDiv.classList.remove('hidden');
            }
        }

        // ログアウト
        function logout() {
            sessionStorage.removeItem('authenticated');
            location.reload();
        }

        // 商品一覧を読み込み
        async function loadProducts() {
            const container = document.getElementById('productsList');
            if (!container) {
                console.error('productsList container not found!');
                return {};
            }

            // ローディング表示
            container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fas fa-spinner fa-spin text-4xl mb-4"></i><p>読み込み中...</p></div>';

            try {
                console.log('Loading products from:', API_URL + '/api/products');
                const response = await fetch(API_URL + '/api/products');
                if (!response.ok) {
                    console.error('Response not OK:', response.status, response.statusText);
                    throw new Error('Failed to fetch products: ' + response.status);
                }
                const products = await response.json();
                console.log('Loaded products:', Object.keys(products).length, 'items');
                currentProducts = products;
                displayProducts(products);
                return products;
            } catch (error) {
                console.error('Error loading products:', error);
                // エラー時はエラーメッセージを表示
                container.innerHTML = '<div class="text-center py-8 text-red-500"><i class="fas fa-exclamation-triangle text-4xl mb-4"></i><p>商品の読み込みに失敗しました: ' + error.message + '</p></div>';
                currentProducts = {};
                return {};
            }
        }

        // 商品を表示
        function displayProducts(products) {
            const container = document.getElementById('productsList');
            if (!container) {
                console.error('Products list container not found!');
                return;
            }
            const productArray = Object.entries(products || {});
            console.log('Displaying products:', productArray.length, 'items');

            if (productArray.length === 0) {
                container.innerHTML = \`
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-inbox text-5xl mb-4"></i>
                        <p>商品が登録されていません</p>
                        <button onclick="showCreateProductModal()"
                                class="mt-4 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                            <i class="fas fa-plus mr-2"></i>最初の商品を追加
                        </button>
                    </div>
                \`;
                return;
            }

            container.innerHTML = productArray.map(([key, product]) => {
                const sitePrices = product.site_prices ? JSON.parse(product.site_prices) : {};
                const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};

                return \`
                    <div class="border rounded-lg p-4 price-card" data-product-key="\${key}">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-start">
                                    <input type="checkbox" class="product-select-checkbox mr-3 mt-1 hidden" value="\${key}" onchange="updateSelectedCount()">
                                    <div class="flex-1">
                                        <h3 class="text-xl font-bold text-gray-800 mb-2">
                                            \${product.image_url ? '<img src="' + product.image_url + '" class="inline-block w-8 h-8 mr-2 rounded">' : ''}
                                            \${product.name}
                                        </h3>
                                        \${product.own_url ? \`
                                            <a href="\${product.own_url}" target="_blank"
                                               class="text-blue-600 hover:underline text-sm">
                                                <i class="fas fa-external-link-alt mr-1"></i>自社商品ページ
                                            </a>
                                        \` : ''}

                                        <!-- 価格一覧 -->
                                        <div class="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    \${Object.entries(siteUrls).map(([siteKey, siteUrl]) => {
                                        const siteName = siteKey.replace(/_/g, '.');
                                        const priceData = sitePrices[siteKey] || {};
                                        const hasPrice = priceData.price && priceData.price > 0;
                                        const isBest = product.best_site === siteName;
                                        const updateTime = priceData.timestamp || priceData.updated_at;

                                        return '<a href="' + (siteUrl || '#') + '" target="_blank"' +
                                               ' class="block p-3 border rounded ' + (isBest ? 'border-green-500 bg-green-50' : hasPrice ? 'border-gray-300' : 'border-gray-200 bg-gray-50') + ' hover:shadow-md transition">' +
                                                '<div class="text-sm text-gray-600">' + siteName + '</div>' +
                                                '<div class="text-lg font-bold ' + (isBest ? 'text-green-600' : hasPrice ? 'text-gray-800' : 'text-gray-400') + '">' +
                                                    (hasPrice ? '¥' + priceData.price.toLocaleString() : '未取得') +
                                                '</div>' +
                                                (isBest ? '<div class="text-xs text-green-600">🏆 最安値</div>' : '') +
                                                (hasPrice && updateTime ?
                                                    '<div class="text-xs text-gray-500" title="' + formatDateTime(updateTime) + '">' +
                                                    '<i class="far fa-clock"></i> ' + getRelativeTime(updateTime) + '</div>' : '') +
                                                (!hasPrice ? '<div class="text-xs text-gray-500">価格更新をクリック</div>' : '') +
                                            '</a>';
                                    }).join('') || '<div class="text-gray-500 col-span-full">URLが登録されていません</div>'}
                                        </div>

                                        <!-- 全体の最終更新時刻 -->
                                        <div class="mt-3 pt-3 border-t text-xs text-gray-500 text-right">
                                            <i class="far fa-clock"></i> 最終更新: \${getRelativeTime(product.updated_at) || '未更新'}
                                            <span class="text-gray-400">(\${formatDateTime(product.updated_at)})</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- アクションボタン -->
                            <div class="ml-4 space-y-2">
                                <button onclick="showUrlManageModal('\${key}')"
                                        class="block w-full bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                                    <i class="fas fa-link mr-1"></i>URL管理
                                </button>
                                <button onclick="refreshProductPrices('\${key}')"
                                        class="block w-full bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                                    <i class="fas fa-sync mr-1"></i>価格更新
                                </button>
                                <button onclick="deleteProduct('\${key}')"
                                        class="block w-full bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                                    <i class="fas fa-trash mr-1"></i>削除
                                </button>
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');
        }

        // YBXインポートモーダルを表示
        function showYBXImportModal() {
            document.getElementById('ybxImportModal').classList.add('show');
        }

        // YBXインポートモーダルを閉じる
        function closeYBXImportModal() {
            document.getElementById('ybxImportModal').classList.remove('show');
            document.getElementById('ybxImportProgress').classList.add('hidden');
            document.getElementById('ybxProductList').classList.add('hidden');
            document.getElementById('ybxImportBtn').disabled = false;
        }

        // YBXから商品をインポート
        async function startYBXImport() {
            const selectedCategories = Array.from(document.querySelectorAll('.ybx-category:checked'))
                .map(cb => cb.value);

            if (selectedCategories.length === 0) {
                alert('少なくとも1つのカテゴリを選択してください');
                return;
            }

            const progressDiv = document.getElementById('ybxImportProgress');
            const productListDiv = document.getElementById('ybxProductList');
            const importBtn = document.getElementById('ybxImportBtn');
            const statusSpan = document.getElementById('ybxImportStatus');
            const progressBar = document.getElementById('ybxProgressBar');

            progressDiv.classList.remove('hidden');
            productListDiv.classList.add('hidden');
            importBtn.disabled = true;

            try {
                // カテゴリURLの定義
                const categoryURLs = {
                    gold: 'https://ybx.jp/?mode=grp&gid=3110187',
                    silver: 'https://ybx.jp/?mode=grp&gid=3110193',
                    platinum: 'https://ybx.jp/?mode=grp&gid=3119343',
                    other: 'https://ybx.jp/?mode=grp&gid=3119344',
                    bar: 'https://ybx.jp/?mode=grp&gid=3110196',
                    premium: 'https://ybx.jp/?mode=grp&gid=3110197'
                };

                const allProducts = [];
                let processedCategories = 0;

                // 各カテゴリから商品を取得
                for (const category of selectedCategories) {
                    statusSpan.textContent = category + 'カテゴリの商品を取得中...';

                    const response = await fetch(API_URL + '/api/ybx/fetch-products', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + ADMIN_PASSWORD
                        },
                        body: JSON.stringify({
                            categoryUrl: categoryURLs[category],
                            category: category
                        })
                    });

                    if (response.ok) {
                        const products = await response.json();
                        allProducts.push(...products);
                    }

                    processedCategories++;
                    progressBar.style.width = (processedCategories / selectedCategories.length) * 100 + '%';
                }

                // 商品リストを表示
                if (allProducts.length > 0) {
                    statusSpan.textContent = allProducts.length + '個の商品が見つかりました';
                    displayYBXProducts(allProducts);
                    productListDiv.classList.remove('hidden');

                    // インポートボタンを更新
                    importBtn.innerHTML = '<i class="fas fa-check mr-2"></i>選択した商品を登録';
                    importBtn.onclick = () => importSelectedYBXProducts(allProducts);
                    importBtn.disabled = false;
                } else {
                    statusSpan.textContent = '商品が見つかりませんでした';
                    importBtn.disabled = false;
                }
            } catch (error) {
                console.error('YBX import error:', error);
                alert('商品の取得中にエラーが発生しました: ' + error.message);
                importBtn.disabled = false;
                progressDiv.classList.add('hidden');
            }
        }

        // YBX商品リストを表示
        function displayYBXProducts(products) {
            const listDiv = document.getElementById('ybxProductList');

            let html = '<div class="space-y-2">';
            html += '<div class="flex items-center justify-between mb-2">';
            html += '<label class="flex items-center font-medium">';
            html += '<input type="checkbox" id="ybxSelectAll" onchange="toggleAllYBXProducts()" checked>';
            html += '<span class="ml-2">すべて選択</span>';
            html += '</label>';
            html += '<span class="text-sm text-gray-600">' + products.length + '個の商品</span>';
            html += '</div>';

            products.forEach((product, index) => {
                html += '<label class="flex items-start p-3 hover:bg-gray-50 rounded border-b">';
                html += '<input type="checkbox" class="ybx-product-select mt-4 mr-3" value="' + index + '" checked>';

                // 商品画像
                if (product.imageUrl) {
                    html += '<img src="' + product.imageUrl + '" alt="' + (product.name || '') + '" class="w-16 h-16 object-cover rounded mr-3">';
                } else {
                    html += '<div class="w-16 h-16 bg-gray-200 rounded mr-3 flex items-center justify-center">';
                    html += '<i class="fas fa-image text-gray-400"></i>';
                    html += '</div>';
                }

                html += '<div class="flex-1">';
                html += '<div class="font-medium text-lg">' + (product.name || ('商品 ' + product.id)) + '</div>';
                html += '<div class="text-sm text-gray-600 mt-1">';
                html += '<span class="mr-4"><i class="fas fa-tag mr-1"></i>ID: ' + product.id + '</span>';
                html += '<span class="mr-4"><i class="fas fa-folder mr-1"></i>' + product.category + '</span>';
                html += '<a href="' + product.url + '" target="_blank" class="text-blue-600 hover:underline">';
                html += '<i class="fas fa-external-link-alt mr-1"></i>商品ページを開く';
                html += '</a>';
                html += '</div>';
                html += '</div>';
                html += '</label>';
            });

            html += '</div>';
            listDiv.innerHTML = html;
        }

        // YBX商品の全選択/解除
        function toggleAllYBXProducts() {
            const selectAll = document.getElementById('ybxSelectAll');
            const checkboxes = document.querySelectorAll('.ybx-product-select');
            checkboxes.forEach(cb => cb.checked = selectAll.checked);
        }

        // 選択したYBX商品をインポート
        async function importSelectedYBXProducts(allProducts) {
            const selectedIndexes = Array.from(document.querySelectorAll('.ybx-product-select:checked'))
                .map(cb => parseInt(cb.value));

            if (selectedIndexes.length === 0) {
                alert('インポートする商品を選択してください');
                return;
            }

            const selectedProducts = selectedIndexes.map(index => allProducts[index]);
            const statusSpan = document.getElementById('ybxImportStatus');
            const progressBar = document.getElementById('ybxProgressBar');
            let imported = 0;
            let failed = 0;
            let skipped = 0;

            // 既存商品のURLリストを取得
            const existingProducts = await loadProducts();
            const existingUrls = new Set();
            Object.values(existingProducts).forEach(product => {
                if (product.site_urls) {
                    const urls = JSON.parse(product.site_urls);
                    Object.values(urls).forEach(url => {
                        if (url) existingUrls.add(url);
                    });
                }
            });

            statusSpan.textContent = selectedProducts.length + '個の商品を処理中...';
            progressBar.style.width = '0%';

            for (const product of selectedProducts) {
                try {
                    // 重複チェック - URLが既に登録されている場合はスキップ
                    if (existingUrls.has(product.url)) {
                        console.log('Skipping duplicate URL:', product.url);
                        skipped++;
                        const progress = ((imported + failed + skipped) / selectedProducts.length) * 100;
                        progressBar.style.width = progress + '%';
                        statusSpan.textContent = '処理中: ' + imported + '個登録、' + skipped + '個スキップ、' + failed + '個失敗';
                        continue;
                    }

                    // 商品を作成（YBXのURLを自社商品ページとして設定）
                    const productName = product.name || 'YBX商品 ' + product.id;
                    const response = await fetch(API_URL + '/api/products-v2', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + ADMIN_PASSWORD
                        },
                        body: JSON.stringify({
                            name: productName,
                            ownUrl: product.url, // YBXのURLを自社商品ページとして設定
                            imageUrl: product.imageUrl || ''
                        })
                    });

                    if (response.ok) {
                        const newProduct = await response.json();
                        imported++;
                        // 登録成功したURLを既存リストに追加（同一セッション内での重複防止）
                        existingUrls.add(product.url);
                    } else {
                        failed++;
                    }
                } catch (error) {
                    console.error('Failed to import product:', error);
                    failed++;
                }

                const progress = ((imported + failed + skipped) / selectedProducts.length) * 100;
                progressBar.style.width = progress + '%';
                statusSpan.textContent = '処理中: ' + imported + '個登録、' + skipped + '個スキップ、' + failed + '個失敗';
            }

            statusSpan.textContent = '完了: ' + imported + '個の商品を登録、' + skipped + '個スキップ、' + failed + '個失敗';

            if (imported > 0) {
                setTimeout(() => {
                    closeYBXImportModal();
                    loadProducts();
                }, 2000);
            } else if (skipped > 0 && failed === 0) {
                statusSpan.textContent += ' (すべて既に登録済みです)';
            }
        }

        // 商品作成モーダルを表示
        function showCreateProductModal() {
            document.getElementById('createProductModal').classList.add('show');
        }

        // 商品作成モーダルを閉じる
        function closeCreateProductModal() {
            document.getElementById('createProductModal').classList.remove('show');
            document.getElementById('newProductName').value = '';
            document.getElementById('newProductOwnUrl').value = '';
            document.getElementById('newProductImageUrl').value = '';
        }

        // 商品を作成
        async function createProduct() {
            const name = document.getElementById('newProductName').value.trim();
            const ownUrl = document.getElementById('newProductOwnUrl').value.trim();
            const imageUrl = document.getElementById('newProductImageUrl').value.trim();

            if (!name) {
                alert('商品名を入力してください');
                return;
            }

            try {
                const response = await fetch(API_URL + '/api/products-v2', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + ADMIN_PASSWORD
                    },
                    body: JSON.stringify({ name, ownUrl, imageUrl })
                });

                if (response.ok) {
                    closeCreateProductModal();
                    loadProducts();
                } else {
                    alert('商品の作成に失敗しました');
                }
            } catch (error) {
                alert('エラー: ' + error.message);
            }
        }

        // URL管理モーダルを表示
        function showUrlManageModal(productKey) {
            const product = currentProducts[productKey];
            if (!product) return;

            document.getElementById('urlManageProductName').textContent = product.name;
            document.getElementById('urlManageProductKey').value = productKey;

            // 既存のURL一覧を表示
            const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
            displaySiteUrls(siteUrls);

            document.getElementById('urlManageModal').classList.add('show');
        }

        // URL管理モーダルを閉じる
        function closeUrlManageModal() {
            document.getElementById('urlManageModal').classList.remove('show');
            // ダッシュボードを更新
            loadProducts();
        }

        // サイトURL一覧を表示
        function displaySiteUrls(siteUrls) {
            const container = document.getElementById('siteUrlsList');
            const entries = Object.entries(siteUrls);

            if (entries.length === 0) {
                container.innerHTML = '<p class="text-gray-500">まだURLが登録されていません</p>';
                return;
            }

            container.innerHTML = entries.map(([siteKey, url]) =>
                '<div class="flex items-center space-x-2 p-2 border rounded">' +
                    '<span class="font-semibold w-32">' + siteKey.replace(/_/g, '.') + '</span>' +
                    '<input type="text" value="' + url + '" readonly' +
                           ' class="flex-1 p-1 bg-gray-50 border rounded">' +
                    '<button onclick="removeSiteUrl(\\'' + siteKey + '\\')"' +
                            ' class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">' +
                        '<i class="fas fa-trash"></i>' +
                    '</button>' +
                '</div>'
            ).join('');
        }

        // サイトURLを追加
        async function addSiteUrl() {
            const productKey = document.getElementById('urlManageProductKey').value;
            const url = document.getElementById('newSiteUrl').value.trim();
            let siteName = document.getElementById('newSiteName').value.trim();

            if (!url) {
                alert('URLを入力してください');
                return;
            }

            // サイト名が未入力の場合はURLから生成
            if (!siteName) {
                try {
                    const urlObj = new URL(url);
                    siteName = urlObj.hostname.replace('www.', '');
                } catch (e) {
                    alert('正しいURLを入力してください');
                    return;
                }
            }

            try {
                const response = await fetch(API_URL + '/api/products-v2/' + productKey + '/urls', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + ADMIN_PASSWORD
                    },
                    body: JSON.stringify({ url, siteName })
                });

                if (response.ok) {
                    document.getElementById('newSiteUrl').value = '';
                    document.getElementById('newSiteName').value = '';

                    // 商品リストを再読み込みしてから、URL一覧を更新
                    await loadProducts();
                    const updatedProduct = currentProducts[productKey];
                    if (updatedProduct && updatedProduct.site_urls) {
                        const siteUrls = JSON.parse(updatedProduct.site_urls);
                        displaySiteUrls(siteUrls);
                    }
                    // ダッシュボードを即座に更新（モーダルが開いていても表示を更新）
                    displayProducts(currentProducts);

                    alert('URLを追加しました');
                } else {
                    const error = await response.text();
                    console.error('URL追加エラー:', error);
                    alert('URLの追加に失敗しました: ' + error);
                }
            } catch (error) {
                console.error('エラー:', error);
                alert('エラー: ' + error.message);
            }
        }

        // サイトURLを削除
        async function removeSiteUrl(siteKey) {
            if (!confirm('このURLを削除しますか？')) return;

            const productKey = document.getElementById('urlManageProductKey').value;

            try {
                const response = await fetch(API_URL + '/api/products-v2/' + productKey + '/urls/' + siteKey, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + ADMIN_PASSWORD
                    }
                });

                if (response.ok) {
                    loadProducts().then(() => {
                        const product = currentProducts[productKey];
                        const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
                        delete siteUrls[siteKey];
                        displaySiteUrls(siteUrls);
                        // ダッシュボードを即座に更新
                        displayProducts(currentProducts);
                    });
                } else {
                    alert('URLの削除に失敗しました');
                }
            } catch (error) {
                alert('エラー: ' + error.message);
            }
        }

        // 商品を削除
        async function deleteProduct(productKey) {
            if (!confirm('この商品を削除しますか？')) return;

            try {
                const response = await fetch(API_URL + '/api/products/' + productKey, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Bearer ' + ADMIN_PASSWORD
                    }
                });

                if (response.ok) {
                    loadProducts();
                } else {
                    alert('削除に失敗しました');
                }
            } catch (error) {
                alert('エラー: ' + error.message);
            }
        }

        // 商品の価格を更新
        async function refreshProductPrices(productKey) {
            if (!confirm('この商品の価格を更新しますか？')) return;

            const button = event.target;
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>更新中';
            button.disabled = true;

            try {
                const response = await fetch(API_URL + '/api/products/' + encodeURIComponent(productKey) + '/update-prices', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + ADMIN_PASSWORD
                    }
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // 成功メッセージを表示
                    const message = result.updatedCount > 0
                        ? '価格を更新しました：' + result.updatedCount + '件'
                        : '価格情報が取得できませんでした';

                    // トースト通知風に表示
                    showToast(message, result.updatedCount > 0 ? 'success' : 'warning');

                    // 3秒後に商品リストを再読み込み
                    setTimeout(() => {
                        loadProducts();
                    }, 2000);
                } else {
                    // デバッグ情報を含むエラーメッセージを表示
                    let errorMessage = '価格更新に失敗しました\\n\\n';

                    if (result.error) {
                        errorMessage += 'エラー: ' + result.error + '\\n';
                    }

                    if (result.debug) {
                        errorMessage += '\\n=== デバッグ情報 ===\\n';
                        errorMessage += '商品キー: ' + result.debug.productKey + '\\n';
                        errorMessage += '登録URL数: ' + result.debug.registeredUrls + '\\n';
                        errorMessage += '試行サイト数: ' + result.debug.sitesAttempted + '\\n';

                        if (result.debug.details && result.debug.details.length > 0) {
                            errorMessage += '\\n各サイトの詳細:\\n';
                            result.debug.details.forEach((site, index) => {
                                errorMessage += '\\n' + (index + 1) + '. ' + site.site + '\\n';
                                errorMessage += '   URL: ' + site.url + '\\n';
                                if (site.attempts && site.attempts.length > 0) {
                                    site.attempts.forEach(attempt => {
                                        errorMessage += '   - 手法: ' + attempt.method + ', 状態: ' + attempt.status;
                                        if (attempt.error) {
                                            errorMessage += ', エラー: ' + attempt.error;
                                        }
                                        if (attempt.httpStatus) {
                                            errorMessage += ', HTTPステータス: ' + attempt.httpStatus;
                                        }
                                        errorMessage += '\\n';
                                    });
                                }
                            });
                        }
                    }

                    // コンソールに詳細情報を出力
                    console.error('価格更新エラー詳細:');
                    console.error('レスポンス全体:', result);
                    if (result.debug && result.debug.details) {
                        console.error('サイト別詳細:');
                        result.debug.details.forEach((site, index) => {
                            console.error((index + 1) + '. ' + site.site + ':', site);
                        });
                    }

                    // 簡潔なエラーメッセージを表示（詳細はコンソールへ）
                    if (result.debug && result.debug.details && result.debug.details.length > 0) {
                        const firstError = result.debug.details[0];
                        if (firstError.attempts && firstError.attempts[0]) {
                            const attempt = firstError.attempts[0];
                            if (attempt.error && attempt.error.includes('fetch failed')) {
                                alert('価格更新エラー\\n\\nCloudflare WorkerからのCORS制限により、外部サイトへ直接アクセスできません。\\n\\n解決方法：\\n1. ローカルでプロキシサーバーを起動してください\\n   node price-update-proxy.js\\n\\n2. またはCLIツールを使用してください\\n   node multi-site-parallel-updater.js\\n\\n詳細はコンソールログをご確認ください。');
                            } else {
                                alert(errorMessage);
                            }
                        } else {
                            alert(errorMessage);
                        }
                    } else {
                        alert(errorMessage);
                    }
                }
            } catch (error) {
                console.error('価格更新中にエラーが発生しました:', error);
                alert('価格更新中にエラーが発生しました：\\n' + error.message + '\\n\\nコンソールログを確認してください。');
            } finally {
                button.innerHTML = originalHTML;
                button.disabled = false;
            }
        }

        // トースト通知を表示
        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            const bgColor = type === 'success' ? 'bg-green-600' :
                          type === 'warning' ? 'bg-yellow-600' :
                          type === 'error' ? 'bg-red-600' : 'bg-blue-600';
            toast.className = 'fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 ' + bgColor;

            const iconClass = type === 'success' ? 'check-circle' :
                            type === 'warning' ? 'exclamation-triangle' :
                            type === 'error' ? 'times-circle' : 'info-circle';
            toast.innerHTML = '<i class="fas fa-' + iconClass + ' mr-2"></i>' + message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.style.transition = 'opacity 0.5s';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 3000);
        }

        // 全商品の価格を更新
        async function refreshAllPrices() {
            if (!confirm('価格更新をリクエストしますか？\\n\\n注意：更新には数分かかる場合があります。')) return;

            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>リクエスト中...';
            button.disabled = true;

            try {
                const response = await fetch(API_URL + '/api/trigger-update', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + ADMIN_PASSWORD
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    alert('価格更新をリクエストしました。\\n\\n更新は数分後に自動的に実行されます。\\nページを更新して最新価格をご確認ください。');

                    // 30秒後に自動的にページを更新
                    setTimeout(() => {
                        loadProducts();
                    }, 30000);
                } else {
                    alert('価格更新リクエストに失敗しました。\\n\\n手動で更新する場合は、ターミナルで以下を実行：\\nnode dynamic-price-updater.js');
                }
            } catch (error) {
                alert('エラー: ' + error.message);
            } finally {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }

        // 一括削除モードの切り替え
        let bulkDeleteMode = false;
        function toggleBulkDelete() {
            bulkDeleteMode = !bulkDeleteMode;
            const checkboxes = document.querySelectorAll('.product-select-checkbox');
            const bulkSelectBar = document.getElementById('bulkSelectBar');
            const deleteBtn = document.getElementById('deleteSelectedBtn');
            const bulkBtn = document.getElementById('bulkDeleteBtn');

            if (bulkDeleteMode) {
                checkboxes.forEach(cb => cb.classList.remove('hidden'));
                bulkSelectBar.classList.remove('hidden');
                deleteBtn.classList.remove('hidden');
                bulkBtn.innerHTML = '<i class="fas fa-times mr-2"></i>キャンセル';
                bulkBtn.classList.remove('bg-gray-600');
                bulkBtn.classList.add('bg-gray-500');
            } else {
                checkboxes.forEach(cb => {
                    cb.classList.add('hidden');
                    cb.checked = false;
                });
                bulkSelectBar.classList.add('hidden');
                deleteBtn.classList.add('hidden');
                bulkBtn.innerHTML = '<i class="fas fa-check-square mr-2"></i>選択モード';
                bulkBtn.classList.remove('bg-gray-500');
                bulkBtn.classList.add('bg-gray-600');
                document.getElementById('selectAllProducts').checked = false;
                updateSelectedCount();
            }
        }

        // 全商品の選択/解除
        function toggleAllProducts() {
            const selectAll = document.getElementById('selectAllProducts');
            const checkboxes = document.querySelectorAll('.product-select-checkbox');
            checkboxes.forEach(cb => cb.checked = selectAll.checked);
            updateSelectedCount();
        }

        // 選択数の更新
        function updateSelectedCount() {
            const checked = document.querySelectorAll('.product-select-checkbox:checked');
            document.getElementById('selectedCount').textContent = checked.length + '個選択中';

            const deleteBtn = document.getElementById('deleteSelectedBtn');
            if (checked.length > 0) {
                deleteBtn.classList.remove('opacity-50');
                deleteBtn.disabled = false;
            } else {
                deleteBtn.classList.add('opacity-50');
                deleteBtn.disabled = true;
            }
        }

        // 選択した商品を一括削除
        async function deleteSelectedProducts() {
            const checked = document.querySelectorAll('.product-select-checkbox:checked');
            if (checked.length === 0) {
                alert('削除する商品を選択してください');
                return;
            }

            if (!confirm(checked.length + '個の商品を削除しますか？\\n\\nこの操作は取り消せません。')) {
                return;
            }

            const productKeys = Array.from(checked).map(cb => cb.value);
            let deleted = 0;
            let failed = 0;

            // プログレス表示
            const deleteBtn = document.getElementById('deleteSelectedBtn');
            const originalText = deleteBtn.innerHTML;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>削除中...';
            deleteBtn.disabled = true;

            for (const key of productKeys) {
                try {
                    const response = await fetch(API_URL + '/api/products/' + key, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': 'Bearer ' + ADMIN_PASSWORD
                        }
                    });

                    if (response.ok) {
                        deleted++;
                        // UIから商品を削除
                        const card = document.querySelector('.price-card[data-product-key="' + key + '"]');
                        if (card) {
                            card.style.opacity = '0.5';
                            card.style.transition = 'opacity 0.3s';
                        }
                    } else {
                        failed++;
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    failed++;
                }
            }

            deleteBtn.innerHTML = originalText;
            deleteBtn.disabled = false;

            if (deleted > 0) {
                alert(deleted + '個の商品を削除しました' + (failed > 0 ? '（' + failed + '個失敗）' : ''));
                // リストを再読み込み
                loadProducts();
                toggleBulkDelete(); // 選択モードを解除
            } else {
                alert('商品の削除に失敗しました');
            }
        }

        // ページ読み込み時
        window.onload = function() {
            if (sessionStorage.getItem('authenticated') === 'true') {
                document.getElementById('loginScreen').classList.add('hidden');
                document.getElementById('mainScreen').classList.remove('hidden');
                loadProducts();
            }
        };
    </script>
</body>
</html>`;

        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }

      // 既存のAPIエンドポイント（互換性のため維持）
      if (path === '/api/products' && request.method === 'GET') {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY created_at DESC"
        ).all();

        const products = {};
        for (const product of results) {
          products[product.key] = product;
        }

        return new Response(JSON.stringify(products), {
          headers: corsHeaders
        });
      }

      // 新しい商品作成API
      if (path === '/api/products-v2' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const body = await request.json();
        const { name, ownUrl, imageUrl } = body;

        if (!name) {
          return new Response(JSON.stringify({ error: 'Product name is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // ユニークなキーを生成（タイムスタンプとランダム値付き）
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const nameSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
        const key = `${nameSlug}-${timestamp}-${random}`;

        try {
          const result = await env.DB.prepare(
            `INSERT INTO products (key, name, url, own_url, image_url, site_urls, site_prices, enabled, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, '{}', '{}', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).bind(
            key,
            name,
            ownUrl || '', // urlフィールドには自社URLを設定
            ownUrl || null,
            imageUrl || null
          ).run();

          return new Response(JSON.stringify({
            success: true,
            key: key, // フロントエンドが期待するフィールド名
            productKey: key
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

      // URL追加API
      if (path.startsWith('/api/products-v2/') && path.endsWith('/urls') && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const parts = path.split('/');
        const productKey = parts[3];
        const body = await request.json();
        const { url, siteName } = body;

        if (!url) {
          return new Response(JSON.stringify({ error: 'URL is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // 現在の商品を取得
        const { results } = await env.DB.prepare(
          "SELECT site_urls FROM products WHERE key = ?"
        ).bind(productKey).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        // URLsを更新
        const currentUrls = results[0].site_urls ? JSON.parse(results[0].site_urls) : {};
        const siteKey = (siteName || new URL(url).hostname).replace(/\./g, '_');
        currentUrls[siteKey] = url;

        await env.DB.prepare(
          "UPDATE products SET site_urls = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?"
        ).bind(JSON.stringify(currentUrls), productKey).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders
        });
      }

      // URL削除API
      if (path.match(/^\/api\/products-v2\/[^\/]+\/urls\/[^\/]+$/) && request.method === 'DELETE') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const parts = path.split('/');
        const productKey = parts[3];
        const siteKey = parts[5];

        // 現在の商品を取得
        const { results } = await env.DB.prepare(
          "SELECT site_urls, site_prices FROM products WHERE key = ?"
        ).bind(productKey).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        // URLsと価格を更新
        const currentUrls = results[0].site_urls ? JSON.parse(results[0].site_urls) : {};
        const currentPrices = results[0].site_prices ? JSON.parse(results[0].site_prices) : {};

        delete currentUrls[siteKey];
        delete currentPrices[siteKey];

        await env.DB.prepare(
          "UPDATE products SET site_urls = ?, site_prices = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?"
        ).bind(JSON.stringify(currentUrls), JSON.stringify(currentPrices), productKey).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: corsHeaders
        });
      }

      // KVストアアクセス（モニター用）
      if (path.startsWith('/api/kv/') && (request.method === 'GET' || request.method === 'DELETE')) {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const key = path.replace('/api/kv/', '');

        if (request.method === 'GET') {
          const value = await env.PRODUCTS.get(key);
          if (value) {
            return new Response(value, {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        if (request.method === 'DELETE') {
          await env.PRODUCTS.delete(key);
          return new Response(JSON.stringify({ success: true }), {
            headers: corsHeaders
          });
        }
      }

      // HTMLエンティティと文字化けをデコードする関数
      function decodeProductName(str) {
        if (!str) return '';

        // HTMLエンティティをデコード
        str = str
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
          .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));

        // 既知の商品名パターンを抽出
        const productPatterns = [
          /\d{4}\s+メイプルリーフ[^<]+/,
          /\d{4}\s+ウィーン[^<]+/,
          /\d{4}\s+ブリタニア[^<]+/,
          /\d{4}\s+カンガルー[^<]+/,
          /\d{4}\s+イーグル[^<]+/,
          /金貨[^<]+/,
          /銀貨[^<]+/,
          /プラチナ[^<]+/
        ];

        // パターンにマッチする部分を抽出
        for (const pattern of productPatterns) {
          const match = str.match(pattern);
          if (match) {
            return match[0].trim();
          }
        }

        return str;
      }

      // YBX商品取得API
      if (path === '/api/ybx/fetch-products' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        try {
          const body = await request.json();
          const { categoryUrl, category } = body;

          // まず、KVストレージから事前インポート済みのYBXデータを探す
          const kvKeys = await env.PRODUCTS.list({ prefix: 'product_ybx_' });
          if (kvKeys.keys && kvKeys.keys.length > 0) {
            console.log(`Found ${kvKeys.keys.length} pre-imported YBX products in KV`);

            const products = [];
            for (const key of kvKeys.keys.slice(0, 50)) { // 最大50個まで
              const productData = await env.PRODUCTS.get(key.name);
              if (productData) {
                const product = JSON.parse(productData);
                const productId = key.name.replace('product_ybx_', '');
                products.push({
                  id: productId,
                  url: product.sites?.ybx?.url || `https://ybx.jp/?pid=${productId}`,
                  name: product.name,
                  imageUrl: product.imageUrl || `https://img21.shop-pro.jp/PA01517/852/product/${productId}.png`,
                  category: category
                });
              }
            }

            if (products.length > 0) {
              return new Response(JSON.stringify(products), {
                headers: corsHeaders
              });
            }
          }

          // KVにデータがない場合は、以前のフォールバック処理を継続
          console.log('No pre-imported YBX data found, falling back to direct fetch');

          // フォールバック: 直接フェッチ（エンコーディング問題あり）
          const response = await fetch(categoryUrl);
          const html = await response.text();

          // HTMLから商品情報を抽出
          const products = [];
          const processedIds = new Set();

          // 商品リンクのパターンを複数定義
          const productPatterns = [
            // パターン1: aタグ内に画像とテキストがある場合
            /<a[^>]+href=["']([^"']*\?pid=(\d+)[^"']*)[^>]*>([\s\S]*?)<\/a>/gi,
            // パターン2: 商品リストの構造
            /<div[^>]*class=["'][^"']*productlist[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi
          ];

          // 最初のパターンで商品を探す
          const linkPattern = /<a[^>]+href=["']([^"']*\?pid=(\d+)[^"']*)[^>]*>([\s\S]*?)<\/a>/gi;
          let linkMatch;

          while ((linkMatch = linkPattern.exec(html)) !== null) {
            const href = linkMatch[1];
            const productId = linkMatch[2];
            const linkContent = linkMatch[3];

            if (!processedIds.has(productId)) {
              processedIds.add(productId);

              // 商品名を抽出（imgのalt属性またはテキスト）
              let productName = '';
              const imgMatch = linkContent.match(/<img[^>]+alt=["']([^"']+)["']/i);
              if (imgMatch) {
                // HTMLエンティティをデコード
                productName = decodeProductName(imgMatch[1]);
              } else {
                // テキストコンテンツから商品名を抽出
                const textMatch = linkContent.match(/>([^<]+)</);
                if (textMatch && textMatch[1].trim()) {
                  productName = decodeProductName(textMatch[1].trim());
                }
              }

              // 画像URLを抽出（複数パターン対応）
              let imageUrl = '';

              // パターン1: 通常のimg src
              const imgSrcMatch = linkContent.match(/<img[^>]+src=["']([^"']+)["']/i);
              if (imgSrcMatch) {
                imageUrl = imgSrcMatch[1];
              }

              // パターン2: data-src属性（遅延読み込み）
              if (!imageUrl) {
                const dataSrcMatch = linkContent.match(/<img[^>]+data-src=["']([^"']+)["']/i);
                if (dataSrcMatch) {
                  imageUrl = dataSrcMatch[1];
                }
              }

              // 相対URLの場合は絶対URLに変換
              if (imageUrl && !imageUrl.startsWith('http')) {
                if (imageUrl.startsWith('//')) {
                  imageUrl = 'https:' + imageUrl;
                } else {
                  imageUrl = 'https://ybx.jp' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
                }
              }

              // HTMLタグを除去
              productName = productName.replace(/<[^>]*>/g, '').trim();

              // 商品名が空の場合はデフォルト名を設定
              if (!productName || productName.length < 3) {
                productName = category.toUpperCase() + ' Product ' + productId;
              }

              products.push({
                id: productId,
                url: 'https://ybx.jp/?pid=' + productId,
                name: productName,
                imageUrl: imageUrl,
                category: category
              });
            }
          }

          // 各商品の詳細ページから追加情報を取得（最初の10個のみ）
          const productsToFetch = products.slice(0, Math.min(10, products.length));
          await Promise.all(productsToFetch.map(async (product) => {
            try {
              const detailResponse = await fetch(product.url);
              const detailHtml = await detailResponse.text();

              // 詳細ページから商品名を取得（複数のパターンを試す）
              let productName = '';

              // パターン1: h1タグ内のテキスト
              const h1Match = detailHtml.match(/<h1[^>]*>([^<]+)<\/h1>/i);
              if (h1Match && h1Match[1].trim() && !h1Match[1].includes('MENU')) {
                productName = h1Match[1].trim();
              }

              // パターン2: 商品名のdivタグ
              if (!productName) {
                const nameMatch = detailHtml.match(/class=["']product[_-]?name["'][^>]*>([^<]+)</i);
                if (nameMatch && nameMatch[1].trim()) {
                  productName = nameMatch[1].trim();
                }
              }

              // パターン3: タイトルタグ
              if (!productName) {
                const titleMatch = detailHtml.match(/<title>([^<]+)<\/title>/i);
                if (titleMatch && titleMatch[1].trim()) {
                  // タイトルから店名などを除去
                  productName = titleMatch[1].replace(/\s*[\|｜-].*$/, '').trim();
                }
              }

              if (productName && !productName.includes('MENU')) {
                product.name = productName;
              }

              // 詳細ページから画像を取得
              let imageUrl = '';

              // パターン1: 商品IDを含む画像
              const productIdPattern = new RegExp('src=["\']([^"\']*/product/' + product.id + '[^"\']*)["\']', 'i');
              const productImgMatch = detailHtml.match(productIdPattern);
              if (productImgMatch) {
                imageUrl = productImgMatch[1];
              }

              // パターン2: メイン商品画像
              if (!imageUrl) {
                const mainImgMatch = detailHtml.match(/<img[^>]+(?:id|class)=["'][^"']*(?:main|product|item)[^"']*["'][^>]+src=["']([^"']+)["']/i);
                if (mainImgMatch) {
                  imageUrl = mainImgMatch[1];
                }
              }

              // パターン3: 最初の大きな画像
              if (!imageUrl) {
                const largeImgMatch = detailHtml.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|gif))["'][^>]*>/i);
                if (largeImgMatch) {
                  imageUrl = largeImgMatch[1];
                }
              }

              // パターン2: shop-proのproduct画像
              if (!imageUrl) {
                const shopProMatch = detailHtml.match(/src=["']([^"']*shop-pro[^"']*\/product\/[^"']+)["']/i);
                if (shopProMatch) {
                  imageUrl = shopProMatch[1];
                }
              }

              // パターン3: 一般的なproduct画像
              if (!imageUrl) {
                const productImgMatch = detailHtml.match(/<img[^>]*src=["']([^"']*\/product\/[^"']+\.(?:jpg|jpeg|png|gif)[^"']*)["']/i);
                if (productImgMatch) {
                  imageUrl = productImgMatch[1];
                }
              }

              if (imageUrl && !imageUrl.includes('icons')) {
                if (!imageUrl.startsWith('http')) {
                  imageUrl = 'https://ybx.jp' + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
                }
                product.imageUrl = imageUrl;
              }

              // 価格も取得
              const priceMatch = detailHtml.match(/([\d,]+)円/);
              if (priceMatch) {
                product.price = priceMatch[1];
              }
            } catch (err) {
              console.log('Failed to fetch product details for', product.id);
            }
          }));

          return new Response(JSON.stringify(products), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('YBX fetch error:', error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }

      // 個別商品の価格更新
      if (path.match(/^\/api\/products\/([^\/]+)\/update-prices$/) && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const productKey = decodeURIComponent(path.split('/')[3]);

        // 商品を取得
        const { results } = await env.DB.prepare(
          "SELECT * FROM products WHERE key = ?"
        ).bind(productKey).all();

        if (results.length === 0) {
          return new Response(JSON.stringify({ error: 'Product not found' }), {
            status: 404,
            headers: corsHeaders
          });
        }

        const product = results[0];
        const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
        const sitePrices = {};
        const debugInfo = [];
        let updatedCount = 0;
        let bestPrice = Infinity;
        let bestSite = '';

        // URLが登録されているか確認
        if (Object.keys(siteUrls).length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: '価格チェック用のURLが登録されていません',
            debug: 'No URLs registered for this product'
          }), {
            status: 400,
            headers: corsHeaders
          });
        }

        // 価格取得関数（Vercel API経由）
        async function fetchPriceFromSite(url, siteName) {
          const siteDebug = {
            site: siteName,
            url: url,
            attempts: []
          };

          try {
            // Vercel APIを使用（CORS制限を回避）
            const VERCEL_API_URL = env.VERCEL_API_URL || 'https://coin-price-checker.vercel.app/api/fetch-price';

            if (VERCEL_API_URL) {
              try {
                siteDebug.attempts.push({ method: 'vercel-api', status: 'trying' });
                const response = await fetch(VERCEL_API_URL, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    url: url,
                    siteName: siteName
                  })
                });

                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.price) {
                    siteDebug.attempts[siteDebug.attempts.length - 1].status = 'success';
                    siteDebug.attempts[siteDebug.attempts.length - 1].price = result.price;
                    siteDebug.success = true;
                    debugInfo.push(siteDebug);
                    return result.price;
                  } else {
                    siteDebug.attempts[siteDebug.attempts.length - 1].status = 'no_price';
                    siteDebug.attempts[siteDebug.attempts.length - 1].error = result.error || 'No price in response';
                  }
                } else {
                  siteDebug.attempts[siteDebug.attempts.length - 1].status = 'failed';
                  siteDebug.attempts[siteDebug.attempts.length - 1].httpStatus = response.status;
                }
              } catch (proxyError) {
                siteDebug.attempts[siteDebug.attempts.length - 1].status = 'error';
                siteDebug.attempts[siteDebug.attempts.length - 1].error = proxyError.message;
                console.error('Proxy failed, falling back to direct fetch:', proxyError);
              }
            }

            // 直接フェッチを試みる（CORS制限がある場合は失敗する可能性）
            siteDebug.attempts.push({ method: 'direct', status: 'trying' });
            const response = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; PriceChecker/1.0)',
                'Accept': 'text/html,application/xhtml+xml'
              }
            });

            if (!response.ok) {
              siteDebug.attempts[siteDebug.attempts.length - 1].status = 'failed';
              siteDebug.attempts[siteDebug.attempts.length - 1].httpStatus = response.status;
              debugInfo.push(siteDebug);
              return null;
            }

            const html = await response.text();
            siteDebug.attempts[siteDebug.attempts.length - 1].htmlLength = html.length;

            // サイトごとの価格パターンマッチング
            let price = null;

            // APMEX
            if (url.includes('apmex.com')) {
              const patterns = [
                /data-price="([\d.]+)"/,
                /class="price[^"]*"[^>]*>\s*\$([\d,]+\.?\d*)/,
                /\$\s*([\d,]+\.?\d*)/
              ];

              for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                  const usdPrice = parseFloat(match[1].replace(/,/g, ''));
                  price = Math.round(usdPrice * 150); // USD to JPY
                  break;
                }
              }
            }
            // YBX
            else if (url.includes('ybx.jp')) {
              const patterns = [
                /価格[:：]\s*([\d,]+)円/,
                /販売価格[:：]\s*([\d,]+)円/,
                /([\d,]+)円/
              ];

              for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match) {
                  price = parseFloat(match[1].replace(/,/g, ''));
                  if (price >= 1000) break;
                }
              }
            }
            // その他
            else {
              const pricePattern = /(?:¥|￥|円|JPY)\s*([\d,]+(?:\.\d{2})?)/i;
              const match = html.match(pricePattern);
              if (match) {
                price = parseFloat(match[1].replace(/,/g, ''));
              }
            }

            if (price) {
              siteDebug.attempts[siteDebug.attempts.length - 1].status = 'success';
              siteDebug.attempts[siteDebug.attempts.length - 1].price = price;
              siteDebug.success = true;
            } else {
              siteDebug.attempts[siteDebug.attempts.length - 1].status = 'no_price_found';
            }

            debugInfo.push(siteDebug);
            return price;
          } catch (error) {
            const errorInfo = {
              status: 'error',
              error: error.message,
              stack: error.stack
            };
            if (siteDebug.attempts.length > 0) {
              siteDebug.attempts[siteDebug.attempts.length - 1] = { ...siteDebug.attempts[siteDebug.attempts.length - 1], ...errorInfo };
            } else {
              siteDebug.attempts.push(errorInfo);
            }
            siteDebug.success = false;
            debugInfo.push(siteDebug);
            console.error('Error fetching price from', siteName, ':', error);
            return null;
          }
        }

        // 各サイトから価格を取得
        for (const [siteKey, url] of Object.entries(siteUrls)) {
          if (url) {
            const price = await fetchPriceFromSite(url, siteKey);

            if (price) {
              sitePrices[siteKey] = {
                price: price,
                currency: 'JPY',
                timestamp: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                status: 'success'
              };
              updatedCount++;

              if (price < bestPrice) {
                bestPrice = price;
                bestSite = siteKey.replace(/_/g, '.');
              }
            } else {
              // 価格取得失敗の場合、既存の価格を保持
              const existingPrices = product.site_prices ? JSON.parse(product.site_prices) : {};
              if (existingPrices[siteKey]) {
                sitePrices[siteKey] = existingPrices[siteKey];
              }
            }
          }
        }

        // データベースを更新
        if (Object.keys(sitePrices).length > 0) {
          await env.DB.prepare(`
            UPDATE products
            SET site_prices = ?,
                current_price = ?,
                best_site = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
          `).bind(
            JSON.stringify(sitePrices),
            bestPrice === Infinity ? 0 : bestPrice,
            bestSite || null,
            productKey
          ).run();
        }

        // デバッグ情報を含むレスポンスを返す
        const responseData = {
          success: updatedCount > 0,
          updatedCount: updatedCount,
          prices: sitePrices,
          debug: {
            productKey: productKey,
            registeredUrls: Object.keys(siteUrls).length,
            sitesAttempted: debugInfo.length,
            details: debugInfo
          }
        };

        if (updatedCount === 0) {
          responseData.error = '価格を取得できませんでした。デバッグ情報を確認してください。';
        }

        return new Response(JSON.stringify(responseData), {
          status: updatedCount > 0 ? 200 : 400,
          headers: corsHeaders
        });
      }

      // 価格更新トリガー（全商品）
      if (path === '/api/trigger-update' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        // KVストアに更新リクエストを記録
        const updateRequest = {
          requested_at: new Date().toISOString(),
          status: 'pending',
          message: '価格更新がリクエストされました。定期実行で処理されます。'
        };

        await env.PRODUCTS.put('update_request', JSON.stringify(updateRequest));

        return new Response(JSON.stringify({
          success: true,
          message: updateRequest.message,
          requested_at: updateRequest.requested_at
        }), {
          headers: corsHeaders
        });
      }

      // 商品削除（既存）
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


      // 複数サイト商品更新（既存）
      if (path === '/api/update-multi-site-product' && request.method === 'POST') {
        if (!checkAuth(request, env)) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: corsHeaders
          });
        }

        const body = await request.json();
        const {
          key,
          name,
          current_price,
          currency,
          site_prices,
          site_urls,
          best_site,
          price_spread_percent,
          total_sites,
          image_url
        } = body;

        if (!key) {
          return new Response(JSON.stringify({ error: 'Product key is required' }), {
            status: 400,
            headers: corsHeaders
          });
        }

        try {
          const { results: existingProduct } = await env.DB.prepare(
            "SELECT id FROM products WHERE key = ?"
          ).bind(key).all();

          let productId;

          if (existingProduct.length > 0) {
            productId = existingProduct[0].id;

            const updateResult = await env.DB.prepare(
              `UPDATE products SET
                 name = ?,
                 current_price = ?,
                 currency = ?,
                 site_prices = ?,
                 site_urls = ?,
                 best_site = ?,
                 price_spread_percent = ?,
                 total_sites = ?,
                 image_url = ?,
                 updated_at = CURRENT_TIMESTAMP
               WHERE key = ?`
            ).bind(
              name || 'Product',
              current_price || 0,
              currency || 'JPY',
              site_prices || '{}',
              site_urls || '{}',
              best_site || 'unknown',
              price_spread_percent || 0,
              total_sites || 1,
              image_url || null,
              key
            ).run();

            if (updateResult.meta.changes === 0) {
              return new Response(JSON.stringify({ error: 'Failed to update product' }), {
                status: 500,
                headers: corsHeaders
              });
            }

          } else {
            const insertResult = await env.DB.prepare(
              `INSERT INTO products (
                 key, name, url, current_price, currency,
                 site_prices, site_urls, best_site,
                 price_spread_percent, total_sites, image_url,
                 enabled, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
            ).bind(
              key,
              name || 'Product',
              '',
              current_price || 0,
              currency || 'JPY',
              site_prices || '{}',
              site_urls || '{}',
              best_site || 'unknown',
              price_spread_percent || 0,
              total_sites || 1,
              image_url || null
            ).run();

            productId = insertResult.meta.last_row_id;
          }

          // 価格履歴に追加
          await env.DB.prepare(
            "INSERT INTO price_history (product_id, price, currency, recorded_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
          ).bind(productId, current_price || 0, currency || 'JPY').run();

          return new Response(JSON.stringify({
            success: true,
            message: 'Product updated successfully',
            productId: productId,
            key: key
          }), {
            headers: corsHeaders
          });

        } catch (error) {
          console.error('Product update error:', error);
          return new Response(JSON.stringify({
            error: 'Failed to update product',
            details: error.message
          }), {
            status: 500,
            headers: corsHeaders
          });
        }
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
  },

  // Cron トリガーで定期実行される関数
  async scheduled(event, env, ctx) {
    console.log('Scheduled price update triggered');

    try {
      // 更新リクエストをチェック
      const updateRequest = await env.PRODUCTS.get('update_request');
      const forceUpdate = updateRequest ? JSON.parse(updateRequest).status === 'pending' : false;

      // 10分ごとの実行では手動リクエストのみ処理
      const now = new Date();
      const minute = now.getMinutes();
      const hour = now.getUTCHours();

      // 定期更新は1日2回、手動リクエストは10分ごとにチェック
      const isScheduledTime = (hour === 0 || hour === 12) && minute < 10;

      if (!forceUpdate && !isScheduledTime) {
        return; // 何もしない
      }

      console.log(forceUpdate ? 'Processing manual update request' : 'Running scheduled update');

      // 簡易的な価格取得関数
      async function fetchPriceFromHTML(url, siteName) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; PriceBot/1.0)'
            }
          });

          if (!response.ok) return null;
          const html = await response.text();

          // 価格パターンマッチング
          let price = null;
          if (siteName.includes('bullionstar')) {
            const match = html.match(/¥([\d,]+(?:\.\d{2})?)/);
            if (match) {
              price = parseFloat(match[1].replace(/,/g, ''));
            }
          }

          return price;
        } catch (error) {
          console.error('Error fetching ' + url + ':', error);
          return null;
        }
      }

      // 全商品を取得
      const { results } = await env.DB.prepare(
        "SELECT * FROM products WHERE enabled = 1"
      ).all();

      let updateCount = 0;

      // 各商品の価格を更新
      for (const product of results) {
        const siteUrls = product.site_urls ? JSON.parse(product.site_urls) : {};
        const sitePrices = {};
        let bestPrice = Infinity;
        let bestSite = '';

        for (const [siteKey, url] of Object.entries(siteUrls)) {
          const price = await fetchPriceFromHTML(url, siteKey);

          if (price) {
            sitePrices[siteKey] = {
              price: price,
              currency: 'JPY',
              timestamp: new Date().toISOString(), // フロントエンド用
              updated_at: new Date().toISOString(), // 互換性のため両方保存
              status: 'success'
            };

            if (price < bestPrice) {
              bestPrice = price;
              bestSite = siteKey.replace(/_/g, '.');
            }
          }
        }

        // データベース更新
        if (Object.keys(sitePrices).length > 0) {
          await env.DB.prepare(`
            UPDATE products
            SET site_prices = ?,
                current_price = ?,
                best_site = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE key = ?
          `).bind(
            JSON.stringify(sitePrices),
            bestPrice === Infinity ? 0 : bestPrice,
            bestSite || null,
            product.key
          ).run();

          updateCount++;
        }
      }

      // 更新リクエストをクリア
      if (forceUpdate) {
        await env.PRODUCTS.delete('update_request');
      }

      // 更新履歴を保存
      await env.PRODUCTS.put('last_update', JSON.stringify({
        updated_at: new Date().toISOString(),
        count: updateCount,
        triggered_by: forceUpdate ? 'manual' : 'scheduled'
      }));

      console.log('Updated ' + updateCount + ' products');

    } catch (error) {
      console.error('Scheduled update error:', error);
    }
  }
};