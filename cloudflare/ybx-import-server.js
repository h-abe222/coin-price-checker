import express from 'express';
import cors from 'cors';
import YBXScraper from './scrapers/ybx_scraper.js';

const app = express();
const PORT = 8081;

app.use(cors());
app.use(express.json());

// YBXカテゴリから商品リストを取得
app.post('/api/ybx/fetch-category', async (req, res) => {
    const { category } = req.body;

    try {
        console.log(`Fetching YBX products for category: ${category}`);
        const scraper = new YBXScraper();
        const products = await scraper.fetchProductList(category);

        // 商品データを整形
        const formattedProducts = products.map(product => ({
            id: product.id,
            url: product.url,
            name: product.name ? product.name
                .replace(/<[^>]*>/g, '') // HTMLタグを除去
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim() : `Product ${product.id}`,
            imageUrl: product.imageUrl || '',
            category: product.category || category
        }));

        console.log(`Found ${formattedProducts.length} products`);
        res.json(formattedProducts);
    } catch (error) {
        console.error('Error fetching YBX products:', error);
        res.status(500).json({ error: error.message });
    }
});

// 個別商品の詳細を取得
app.post('/api/ybx/fetch-details', async (req, res) => {
    const { productUrl } = req.body;

    try {
        console.log(`Fetching YBX product details: ${productUrl}`);
        const scraper = new YBXScraper();
        const details = await scraper.fetchProductDetails(productUrl);

        res.json({
            name: details.name || '',
            price: details.price || 0,
            imageUrl: details.imageUrl || '',
            description: details.description || '',
            stockStatus: details.stockStatus || ''
        });
    } catch (error) {
        console.error('Error fetching YBX details:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`YBX Import Server running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  POST http://localhost:${PORT}/api/ybx/fetch-category`);
    console.log(`  POST http://localhost:${PORT}/api/ybx/fetch-details`);
});