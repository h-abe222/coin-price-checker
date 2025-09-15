// Netlify Function for product management
// This stores data in Netlify Blobs (free tier available)

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  // Simple in-memory storage (will reset on redeploy)
  // In production, use Netlify Blobs or connect to a database
  const getProducts = () => {
    try {
      const data = process.env.PRODUCTS_DATA || '{}';
      return JSON.parse(data);
    } catch {
      return {};
    }
  };

  try {
    // Get all products
    if (event.httpMethod === 'GET') {
      const products = getProducts();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(products)
      };
    }

    // Check authentication for write operations
    const auth = event.headers.authorization || '';
    if (auth !== `Bearer ${ADMIN_PASSWORD}`) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Add product
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { url, name } = body;

      if (!url) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'URL is required' })
        };
      }

      // Extract product key from URL
      const match = url.match(/product\/([^\/]+)/);
      if (!match) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid BullionStar URL' })
        };
      }

      const productKey = match[1];
      const products = getProducts();

      if (products[productKey]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Product already exists' })
        };
      }

      // Add new product
      products[productKey] = {
        id: Date.now(),
        url: url,
        name: name || `新商品 - ${productKey}`,
        enabled: true,
        added_at: new Date().toISOString()
      };

      // Note: In production, save to persistent storage here

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          product: products[productKey],
          note: 'Data is stored temporarily. For production, connect to a database.'
        })
      };
    }

    // Delete product
    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {};
      const productKey = params.productKey;

      if (!productKey) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Product key is required' })
        };
      }

      const products = getProducts();

      if (!products[productKey]) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Product not found' })
        };
      }

      delete products[productKey];

      // Note: In production, save to persistent storage here

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
};