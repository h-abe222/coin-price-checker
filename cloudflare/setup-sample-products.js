/**
 * サンプル商品をセットアップ
 * BullionStarの商品を登録
 */

import dotenv from 'dotenv';

dotenv.config();

const WORKER_URL = process.env.WORKER_URL || 'https://coin-price-checker.h-abe.workers.dev';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// サンプル商品データ
const SAMPLE_PRODUCTS = [
    {
        name: 'Silver Maple Leaf 1oz',
        ownUrl: '',
        imageUrl: 'https://static.bullionstar.com/files/silver-coins/300_300_coin-silver-ca-maple-2024-b.webp',
        urls: [
            {
                siteName: 'BullionStar',
                url: 'https://www.bullionstar.com/buy/product/silver-maple-leaf-1oz-various'
            }
        ]
    },
    {
        name: 'Silver Bar 1kg',
        ownUrl: '',
        imageUrl: 'https://static.bullionstar.com/files/silver-bars/300_300_bar-silver-bs-new-bullionstar-b.webp',
        urls: [
            {
                siteName: 'BullionStar',
                url: 'https://www.bullionstar.com/buy/product/silver-bullionstar-1kg'
            }
        ]
    },
    {
        name: 'Gold Eagle 1oz',
        ownUrl: '',
        imageUrl: 'https://static.bullionstar.com/files/gold-coins/300_300_coin-gold-us-eagle-2024-b.webp',
        urls: [
            {
                siteName: 'BullionStar',
                url: 'https://www.bullionstar.com/buy/product/gold-eagle-1oz-various'
            }
        ]
    }
];

/**
 * 商品を作成
 */
async function createProduct(productData) {
    const response = await fetch(`${WORKER_URL}/api/products-v2`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ADMIN_PASSWORD}`
        },
        body: JSON.stringify({
            name: productData.name,
            ownUrl: productData.ownUrl,
            imageUrl: productData.imageUrl
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create product: ${error}`);
    }

    const result = await response.json();
    return result.productKey;
}

/**
 * URLを追加
 */
async function addUrl(productKey, urlData) {
    const response = await fetch(`${WORKER_URL}/api/products-v2/${productKey}/urls`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ADMIN_PASSWORD}`
        },
        body: JSON.stringify({
            url: urlData.url,
            siteName: urlData.siteName
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to add URL: ${error}`);
    }

    return true;
}

/**
 * 既存商品をクリア
 */
async function clearExistingProducts() {
    console.log('🗑️  Clearing existing products...');

    const response = await fetch(`${WORKER_URL}/api/products`);
    const products = await response.json();

    for (const [key, product] of Object.entries(products)) {
        console.log(`  Deleting: ${product.name}`);
        await fetch(`${WORKER_URL}/api/products/${key}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${ADMIN_PASSWORD}`
            }
        });
    }

    console.log('✅ All products cleared');
}

/**
 * メイン処理
 */
async function main() {
    console.log('🚀 Setting up sample BullionStar products');
    console.log('=' .repeat(60));
    console.log(`Worker URL: ${WORKER_URL}`);

    try {
        // 既存商品をクリア（オプション）
        const clearAll = process.argv.includes('--clear');
        if (clearAll) {
            await clearExistingProducts();
            console.log('');
        }

        // サンプル商品を登録
        for (const productData of SAMPLE_PRODUCTS) {
            console.log(`\n📦 Creating product: ${productData.name}`);

            // 商品を作成
            const productKey = await createProduct(productData);
            console.log(`  ✅ Product created with key: ${productKey}`);

            // URLを追加
            for (const urlData of productData.urls) {
                console.log(`  🔗 Adding URL from ${urlData.siteName}`);
                await addUrl(productKey, urlData);
                console.log(`    ✅ URL added: ${urlData.url}`);
            }
        }

        console.log('\n' + '=' .repeat(60));
        console.log('✨ Sample products setup completed!');
        console.log('\nNext steps:');
        console.log('1. Visit: ' + WORKER_URL);
        console.log('2. Login with password: admin123');
        console.log('3. Run: npm run update-prices');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// 実行
main().catch(console.error);