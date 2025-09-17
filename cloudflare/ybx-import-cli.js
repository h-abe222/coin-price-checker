#!/usr/bin/env node

import YBXScraper from './scrapers/ybx_scraper.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// YBX商品をインポートしてKVに保存
async function importYBXProducts(category = 'gold') {
    console.log(`\n🔄 YBX商品インポート開始: ${category}カテゴリ`);

    try {
        // 1. YBXから商品リストを取得
        console.log('📥 商品リストを取得中...');
        const scraper = new YBXScraper();
        const products = await scraper.fetchProductList(category);

        if (!products || products.length === 0) {
            console.log('⚠️ 商品が見つかりませんでした');
            return;
        }

        console.log(`✅ ${products.length}個の商品を取得しました`);

        // 2. 商品詳細を取得（最初の5個）
        console.log('\n📋 商品詳細を取得中...');
        const detailedProducts = [];

        for (let i = 0; i < Math.min(5, products.length); i++) {
            const product = products[i];
            console.log(`  ${i + 1}/${Math.min(5, products.length)}: ${product.name || product.id}`);

            try {
                const details = await scraper.fetchProductDetails(product.url);

                // 商品データを整形
                const formattedProduct = {
                    name: (details.name || product.name || `YBX商品 ${product.id}`)
                        .replace(/<[^>]*>/g, '') // HTMLタグを除去
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/\s*-\s*Yokohama Bullion X.*$/i, '') // 店名を除去
                        .replace(/\s*[\|｜]\s*YBX.*$/i, '') // YBXサフィックスを除去
                        .trim(),
                    sites: {
                        ybx: {
                            url: product.url,
                            name: 'YBX.jp'
                        }
                    },
                    imageUrl: details.imageUrl || product.imageUrl || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                // 画像URLの検証と修正
                if (formattedProduct.imageUrl && !formattedProduct.imageUrl.startsWith('http')) {
                    if (formattedProduct.imageUrl.startsWith('//')) {
                        formattedProduct.imageUrl = 'https:' + formattedProduct.imageUrl;
                    } else {
                        formattedProduct.imageUrl = 'https://ybx.jp' + formattedProduct.imageUrl;
                    }
                }

                detailedProducts.push({
                    key: `product_ybx_${product.id}`,
                    value: formattedProduct
                });

                // 表示用
                console.log(`    ✓ ${formattedProduct.name}`);
                if (formattedProduct.imageUrl) {
                    console.log(`    🖼️ ${formattedProduct.imageUrl}`);
                }
            } catch (error) {
                console.log(`    ⚠️ エラー: ${error.message}`);
            }

            // レート制限対策
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 3. KVに保存
        console.log('\n💾 KVストレージに保存中...');

        for (const item of detailedProducts) {
            const command = `npx wrangler kv key put --namespace-id 86a3f08465d14695ad7fde49cf624a96 "${item.key}" '${JSON.stringify(item.value)}'`;

            try {
                await execAsync(command);
                console.log(`  ✓ ${item.key} を保存しました`);
            } catch (error) {
                console.log(`  ⚠️ ${item.key} の保存に失敗: ${error.message}`);
            }
        }

        console.log('\n✅ インポート完了！');
        console.log(`📊 ${detailedProducts.length}個の商品をKVストレージに保存しました`);

        // 4. 商品リストを表示
        console.log('\n📝 インポートした商品:');
        detailedProducts.forEach((item, index) => {
            const product = item.value;
            console.log(`${index + 1}. ${product.name}`);
            console.log(`   URL: ${product.sites.ybx.url}`);
            if (product.imageUrl) {
                console.log(`   画像: ${product.imageUrl.substring(0, 50)}...`);
            }
        });

    } catch (error) {
        console.error('\n❌ エラーが発生しました:', error.message);
        console.error(error.stack);
    }
}

// CLIパラメーター処理
const args = process.argv.slice(2);
const category = args[0] || 'gold';

const validCategories = ['gold', 'silver', 'platinum', 'other', 'bar', 'premium', 'all'];
if (!validCategories.includes(category)) {
    console.log('使用方法: node ybx-import-cli.js [category]');
    console.log('カテゴリ: gold, silver, platinum, other, bar, premium, all');
    console.log('例: node ybx-import-cli.js gold');
    process.exit(1);
}

// 実行
importYBXProducts(category).catch(console.error);