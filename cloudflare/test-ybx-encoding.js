import YBXScraper from './scrapers/ybx_scraper.js';

async function testYBXEncoding() {
    const scraper = new YBXScraper();

    console.log('=== YBX Encoding Test ===');
    console.log('Testing EUC-JP encoding support...\n');

    try {
        // Test 1: Fetch product list from gold category
        console.log('Test 1: Fetching product list from gold category...');
        const products = await scraper.fetchProductList('gold');

        if (products && products.length > 0) {
            console.log(`✓ Found ${products.length} products`);

            // Display first 3 products to check encoding
            console.log('\nFirst 3 products (checking for encoding issues):');
            products.slice(0, 3).forEach((product, index) => {
                console.log(`${index + 1}. ${product.name || 'No name'}`);
                console.log(`   ID: ${product.id}`);
                console.log(`   URL: ${product.url}`);

                // Check for common encoding issues
                if (product.name) {
                    if (product.name.includes('?') || product.name.includes('□')) {
                        console.log('   ⚠️ Possible encoding issue detected');
                    } else {
                        console.log('   ✓ Text appears correctly encoded');
                    }
                }
                console.log('');
            });
        } else {
            console.log('⚠️ No products found');
        }

        // Test 2: Fetch specific product details
        if (products && products.length > 0) {
            console.log('Test 2: Fetching specific product details...');
            const testProduct = products[0];
            const details = await scraper.fetchProductDetails(testProduct.url);

            console.log('Product Details:');
            console.log(`Name: ${details.name || 'Not found'}`);
            console.log(`Price: ${details.price ? `¥${details.price.toLocaleString()}` : 'Not found'}`);
            console.log(`Image: ${details.imageUrl ? 'Found' : 'Not found'}`);

            // Check encoding
            if (details.name) {
                if (details.name.includes('?') || details.name.includes('□')) {
                    console.log('⚠️ Encoding issue in product name');
                } else {
                    console.log('✓ Product name correctly encoded');
                }
            }
        }

        // Test 3: Price scraping with encoding check
        console.log('\nTest 3: Testing price scraping...');
        const testUrl = 'https://ybx.jp/?pid=185662024'; // Example product
        const priceData = await scraper.scrapePrice(testUrl);

        console.log('Price Data:');
        console.log(`Product: ${priceData.productName || 'Not found'}`);
        console.log(`Price: ¥${priceData.price?.toLocaleString() || 'Not found'}`);
        console.log(`Currency: ${priceData.currency}`);
        console.log(`Available: ${priceData.availability}`);

        if (priceData.productName) {
            if (priceData.productName.includes('?') || priceData.productName.includes('□')) {
                console.log('⚠️ Encoding issue detected in scraped data');
            } else {
                console.log('✓ Data correctly encoded');
            }
        }

    } catch (error) {
        console.error('Test failed:', error);
        console.error('Error details:', error.message);
    }

    console.log('\n=== Test Complete ===');
}

// Run the test
testYBXEncoding().catch(console.error);