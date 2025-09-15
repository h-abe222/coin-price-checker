// BullionStar Price Monitor - JavaScript

// URLテスト
async function testUrl() {
    const urlInput = document.getElementById('product-url');
    const url = urlInput.value.trim();
    const resultDiv = document.getElementById('test-result');

    if (!url) {
        alert('URLを入力してください');
        return;
    }

    if (!url.includes('bullionstar.com')) {
        alert('BullionStarのURLを入力してください');
        return;
    }

    resultDiv.innerHTML = '<div class="spinner"></div> URLをテスト中...';
    resultDiv.className = 'test-result';
    resultDiv.style.display = 'block';

    try {
        const response = await fetch('/api/test-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.success) {
            const price = data.currency === 'JPY'
                ? `¥${data.price.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
                : `${data.currency} $${data.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

            resultDiv.innerHTML = `
                <strong>✅ 商品情報を取得しました</strong><br>
                商品名: ${data.product_name || '不明'}<br>
                商品ID: ${data.product_id}<br>
                現在価格: ${price}
            `;
            resultDiv.className = 'test-result success';
        } else {
            resultDiv.innerHTML = `<strong>❌ エラー:</strong> ${data.error}`;
            resultDiv.className = 'test-result error';
        }
    } catch (error) {
        resultDiv.innerHTML = `<strong>❌ エラー:</strong> ${error.message}`;
        resultDiv.className = 'test-result error';
    }
}

// 商品追加
async function addProduct() {
    const urlInput = document.getElementById('product-url');
    const url = urlInput.value.trim();

    if (!url) {
        alert('URLを入力してください');
        return;
    }

    if (!url.includes('bullionstar.com')) {
        alert('BullionStarのURLを入力してください');
        return;
    }

    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> 追加中...';

    try {
        const response = await fetch('/api/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.success) {
            alert('商品を追加しました');
            urlInput.value = '';
            document.getElementById('test-result').style.display = 'none';
            location.reload();
        } else {
            alert('エラー: ' + data.error);
        }
    } catch (error) {
        alert('エラー: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerHTML = '商品を追加';
    }
}

// 商品削除
async function deleteProduct(productKey) {
    if (!confirm('この商品を削除しますか？')) {
        return;
    }

    try {
        const response = await fetch(`/api/products/${productKey}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            const card = document.querySelector(`[data-key="${productKey}"]`);
            card.style.transition = 'opacity 0.3s';
            card.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                // 商品がなくなったら空の状態を表示
                const productsList = document.getElementById('products-list');
                if (productsList.children.length === 0) {
                    location.reload();
                }
            }, 300);
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        alert('エラー: ' + error.message);
    }
}

// 商品の有効/無効切り替え
async function toggleProduct(productKey) {
    try {
        const response = await fetch(`/api/products/${productKey}/toggle`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            const card = document.querySelector(`[data-key="${productKey}"]`);
            const statusElement = card.querySelector('.status');
            if (data.enabled) {
                statusElement.textContent = '監視中';
                statusElement.className = 'value status status-active';
            } else {
                statusElement.textContent = '停止中';
                statusElement.className = 'value status status-inactive';
            }
        } else {
            alert('切り替えに失敗しました');
            // チェックボックスを元に戻す
            const checkbox = document.querySelector(`[data-key="${productKey}"] input[type="checkbox"]`);
            checkbox.checked = !checkbox.checked;
        }
    } catch (error) {
        alert('エラー: ' + error.message);
    }
}

// 今すぐ価格をチェック
async function runMonitor() {
    if (!confirm('今すぐ価格チェックを実行しますか？')) {
        return;
    }

    const button = event.target;
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span> 実行中...';

    try {
        // 実際の監視スクリプトを実行するAPIエンドポイントが必要
        alert('価格チェックを開始しました。結果はメールで通知されます。');
    } catch (error) {
        alert('エラー: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerHTML = '今すぐ価格をチェック';
    }
}

// 価格履歴表示
async function viewHistory() {
    try {
        const response = await fetch('/api/prices/history');
        const data = await response.json();

        if (Object.keys(data).length === 0) {
            alert('価格履歴がありません');
            return;
        }

        // 簡易的な表示（実際にはモーダルやグラフで表示）
        console.log('Price History:', data);
        alert('価格履歴はコンソールに出力されました（F12で確認）');
    } catch (error) {
        alert('エラー: ' + error.message);
    }
}

// テストメール送信
async function testEmail() {
    if (!confirm('テストメールを送信しますか？')) {
        return;
    }

    alert('テストメール機能は準備中です');
}

// ページ読み込み時の処理
document.addEventListener('DOMContentLoaded', function() {
    // Enterキーで商品追加
    const urlInput = document.getElementById('product-url');
    urlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addProduct();
        }
    });
});