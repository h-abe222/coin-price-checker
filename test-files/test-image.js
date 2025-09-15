/**
 * 画像取得のテスト用スクリプト
 */

import { chromium } from 'playwright';

async function testImageFetch() {
    const browser = await chromium.launch({ headless: false }); // headless: false でブラウザを表示
    const page = await browser.newPage();

    try {
        const url = 'https://www.bullionstar.com/buy/product/gold-buffalo-1oz-various';
        console.log(`Testing image fetch from: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // ページのスクリーンショットを撮る
        await page.screenshot({ path: 'debug-page.png', fullPage: true });
        console.log('Screenshot saved as debug-page.png');

        // すべての画像要素を詳細に調査
        const allImages = await page.$$eval('img', imgs =>
            imgs.map(img => ({
                src: img.src,
                alt: img.alt,
                className: img.className,
                width: img.width,
                height: img.height,
                id: img.id
            }))
        );

        console.log('\n=== All images on page ===');
        allImages.forEach((img, index) => {
            console.log(`Image ${index + 1}:`);
            console.log(`  src: ${img.src}`);
            console.log(`  alt: ${img.alt}`);
            console.log(`  class: ${img.className}`);
            console.log(`  size: ${img.width}x${img.height}`);
            console.log(`  id: ${img.id}`);
            console.log('---');
        });

        // 商品画像を見つける
        let productImage = null;

        // パターン1: 最大の画像
        const largestImage = allImages.reduce((largest, current) => {
            const currentSize = current.width * current.height;
            const largestSize = largest ? largest.width * largest.height : 0;
            return currentSize > largestSize ? current : largest;
        }, null);

        if (largestImage && largestImage.width > 200) {
            productImage = largestImage.src;
            console.log(`\nSelected largest image: ${productImage}`);
        }

        // パターン2: alt属性で判定
        const altMatches = allImages.filter(img =>
            img.alt && (
                img.alt.toLowerCase().includes('buffalo') ||
                img.alt.toLowerCase().includes('gold') ||
                img.alt.toLowerCase().includes('coin') ||
                img.alt.toLowerCase().includes('product')
            )
        );

        if (altMatches.length > 0) {
            console.log(`\nImages with relevant alt text:`);
            altMatches.forEach((img, index) => {
                console.log(`  ${index + 1}: ${img.src} (alt: ${img.alt})`);
            });

            if (!productImage) {
                productImage = altMatches[0].src;
                console.log(`Selected by alt text: ${productImage}`);
            }
        }

        console.log(`\nFinal product image: ${productImage || 'NOT FOUND'}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

testImageFetch().catch(console.error);