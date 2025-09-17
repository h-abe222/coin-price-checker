#!/usr/bin/env node

import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// YBX商品を KVストレージに直接インポート
async function importYBXToKV(category = 'gold') {
    console.log(`\n🔄 YBX商品を管理画面用にKVへインポート: ${category}カテゴリ`);

    try {
        // 1. プロキシサーバーから商品リストを取得
        console.log('📥 商品リストを取得中...');
        const response = await fetch('http://localhost:8082/api/ybx/fetch-products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category })
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch products: ${response.statusText}`);
        }

        const products = await response.json();
        console.log(`✅ ${products.length}個の商品を取得しました`);

        // 2. YBXインポート用の一時データをKVに保存
        const ybxImportData = {
            products: products.map(product => ({
                id: product.id,
                url: product.url,
                name: product.name,
                imageUrl: product.imageUrl || `https://img21.shop-pro.jp/PA01517/852/product/${product.id}.png`,
                category: category
            })),
            timestamp: new Date().toISOString()
        };

        // 3. KVに保存（一時インポートキーとして）
        const importKey = `ybx_import_${category}_${Date.now()}`;
        const command = `npx wrangler kv key put --namespace-id 86a3f08465d14695ad7fde49cf624a96 "${importKey}" '${JSON.stringify(ybxImportData)}'`;

        console.log('💾 KVストレージに保存中...');
        await execAsync(command);
        console.log(`✅ ${importKey} として保存しました`);

        // 4. 商品リストを表示
        console.log('\n📝 インポートした商品:');
        products.slice(0, 5).forEach((product, index) => {
            console.log(`${index + 1}. ${product.name}`);
            console.log(`   ID: ${product.id}`);
            console.log(`   URL: ${product.url}`);
        });

        if (products.length > 5) {
            console.log(`... 他 ${products.length - 5} 商品`);
        }

        console.log('\n✨ インポート完了！');
        console.log('管理画面でこれらの商品を確認できます。');

        // 5. 各商品を個別にKVに保存（製品として）
        console.log('\n📦 商品を個別に登録中...');
        let savedCount = 0;

        for (const product of products.slice(0, 10)) { // 最初の10個のみ
            const productKey = `product_ybx_${product.id}`;
            const productData = {
                name: product.name,
                sites: {
                    ybx: {
                        url: product.url,
                        name: 'YBX.jp'
                    }
                },
                imageUrl: product.imageUrl || `https://img21.shop-pro.jp/PA01517/852/product/${product.id}.png`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            try {
                const saveCommand = `npx wrangler kv key put --namespace-id 86a3f08465d14695ad7fde49cf624a96 "${productKey}" '${JSON.stringify(productData)}'`;
                await execAsync(saveCommand);
                savedCount++;
                console.log(`  ✓ ${productKey} を保存しました`);
            } catch (error) {
                console.log(`  ⚠️ ${productKey} の保存に失敗: ${error.message}`);
            }
        }

        console.log(`\n📊 ${savedCount}個の商品を個別に保存しました`);

    } catch (error) {
        console.error('\n❌ エラーが発生しました:', error.message);
        console.error(error.stack);
    }
}

// CLIパラメーター処理
const args = process.argv.slice(2);
const category = args[0] || 'gold';

const validCategories = ['gold', 'silver', 'platinum', 'other', 'bar', 'premium'];
if (!validCategories.includes(category)) {
    console.log('使用方法: node import-ybx-to-kv.js [category]');
    console.log('カテゴリ: gold, silver, platinum, other, bar, premium');
    console.log('例: node import-ybx-to-kv.js gold');
    process.exit(1);
}

// プロキシサーバーが起動しているか確認
console.log('🔍 プロキシサーバーの状態を確認中...');
fetch('http://localhost:8082/api/ybx/fetch-products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'test' })
})
.then(() => {
    console.log('✅ プロキシサーバーが稼働中です');
    // 実行
    importYBXToKV(category).catch(console.error);
})
.catch(() => {
    console.error('❌ プロキシサーバーが起動していません');
    console.log('先に以下のコマンドでプロキシサーバーを起動してください:');
    console.log('  node ybx-proxy-server.js');
    process.exit(1);
});