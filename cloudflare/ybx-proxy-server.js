import express from 'express';
import cors from 'cors';
import YBXScraper from './scrapers/ybx_scraper.js';
import fetch from 'node-fetch';
import iconv from 'iconv-lite';

const app = express();
const PORT = 8082;

app.use(cors());
app.use(express.json());

// YBXのHTMLを取得してUTF-8に変換
app.post('/api/ybx/fetch-html', async (req, res) => {
    const { url } = req.body;

    try {
        console.log(`Fetching YBX page: ${url}`);

        // バイナリデータとして取得
        const response = await fetch(url);
        const buffer = await response.buffer();

        // EUC-JPからUTF-8に変換
        const html = iconv.decode(buffer, 'EUC-JP');

        res.json({
            html: html,
            encoding: 'UTF-8'
        });

    } catch (error) {
        console.error('Error fetching YBX HTML:', error);
        res.status(500).json({ error: error.message });
    }
});

// YBXカテゴリから商品リストを取得（スクレイパー使用）
app.post('/api/ybx/fetch-products', async (req, res) => {
    const { category } = req.body;

    try {
        console.log(`Fetching YBX products for category: ${category}`);
        const scraper = new YBXScraper();
        const products = await scraper.fetchProductList(category);

        // 商品データをクリーンアップ
        const cleanProducts = products.map(product => {
            // 商品名のクリーンアップ
            let cleanName = product.name || '';

            // HTMLタグを除去
            cleanName = cleanName.replace(/<[^>]*>/g, '');

            // HTMLエンティティをデコード
            cleanName = cleanName
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ');

            // 余分な空白を削除
            cleanName = cleanName.replace(/\s+/g, ' ').trim();

            return {
                id: product.id,
                url: product.url,
                name: cleanName,
                imageUrl: product.imageUrl || '',
                category: product.category || category
            };
        });

        console.log(`Returning ${cleanProducts.length} clean products`);
        res.json(cleanProducts);

    } catch (error) {
        console.error('Error fetching YBX products:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`YBX Proxy Server running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  POST http://localhost:${PORT}/api/ybx/fetch-html`);
    console.log(`  POST http://localhost:${PORT}/api/ybx/fetch-products`);
});