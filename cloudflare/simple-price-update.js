#!/usr/bin/env node

import fetch from 'node-fetch';
import { chromium } from 'playwright';

/**
 * シンプルな価格更新スクリプト
 * CORS制限を回避してローカルから実行
 */

const WORKER_URL = 'https://coin-price-checker-production.h-abe.workers.dev';
const ADMIN_PASSWORD = 'admin123';

async function testPriceUpdate() {
    console.log('🚀 シンプル価格更新テスト');
    console.log('========================\n');

    // テスト用の商品キー（URLから確認）
    const productKey = '2025-------------50---1-----------------1----------------';

    // 登録されているURL（ログから確認）
    const testUrls = [
        {
            site: 'Bullion Star',
            url: 'https://www.bullionstar.com/buy/product/gold-coin-canadian-maple-half-oz-2025'
        },
        {
            site: 'APMEX',
            url: 'https://www.apmex.com/product/304146/2025-canada-1-2-oz-gold-maple-leaf-bu'
        }
    ];

    console.log(`📦 商品キー: ${productKey}\n`);

    for (const { site, url } of testUrls) {
        console.log(`\n🔍 ${site}の価格を取得中...`);
        console.log(`   URL: ${url}`);

        try {
            if (site === 'APMEX') {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                    }
                });

                if (response.ok) {
                    const html = await response.text();

                    // APMEXの価格パターン
                    const patterns = [
                        /<meta property="product:price:amount" content="([\d.]+)"/,
                        /data-price="([\d.]+)"/,
                        /"price"\s*:\s*"?([\d.]+)"?/,
                        /\$\s*([\d,]+\.?\d*)/
                    ];

                    let price = null;
                    for (const pattern of patterns) {
                        const match = html.match(pattern);
                        if (match) {
                            const usdPrice = parseFloat(match[1].replace(/,/g, ''));
                            price = Math.round(usdPrice * 150); // USD to JPY (簡易レート)
                            console.log(`   ✅ 価格発見: $${usdPrice} = ¥${price.toLocaleString()}`);
                            break;
                        }
                    }

                    if (!price) {
                        // HTMLを一部出力してデバッグ
                        const priceSection = html.match(/<div[^>]*class="[^"]*price[^"]*"[^>]*>[\s\S]{0,500}<\/div>/i);
                        if (priceSection) {
                            console.log('   価格セクション（デバッグ）:', priceSection[0].substring(0, 200));
                        }
                        console.log('   ⚠️ 価格が見つかりませんでした');
                    }
                } else {
                    console.log(`   ❌ HTTPエラー: ${response.status}`);
                }
            } else if (site === 'Bullion Star') {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                if (response.ok) {
                    const html = await response.text();

                    // BullionStarの価格パターン
                    const patterns = [
                        /SGD\s*([\d,]+\.?\d*)/,
                        /\$\s*([\d,]+\.?\d*)/,
                        /"price"\s*:\s*"?([\d.]+)"?/
                    ];

                    let price = null;
                    for (const pattern of patterns) {
                        const match = html.match(pattern);
                        if (match) {
                            const sgdPrice = parseFloat(match[1].replace(/,/g, ''));
                            price = Math.round(sgdPrice * 110); // SGD to JPY (簡易レート)
                            console.log(`   ✅ 価格発見: SGD${sgdPrice} = ¥${price.toLocaleString()}`);
                            break;
                        }
                    }

                    if (!price) {
                        console.log('   ⚠️ 価格が見つかりませんでした');
                    }
                } else {
                    console.log(`   ❌ HTTPエラー: ${response.status}`);
                }
            }
        } catch (error) {
            console.log(`   ❌ エラー: ${error.message}`);
        }
    }

    console.log('\n========================');
    console.log('テスト完了\n');
    console.log('💡 ヒント:');
    console.log('- Cloudflare WorkerからはCORS制限で外部サイトにアクセスできません');
    console.log('- ローカルのプロキシサーバー経由で価格を取得する必要があります');
    console.log('- または、このようなCLIツールから直接データベースを更新します');
}

// 実行
testPriceUpdate().catch(console.error);