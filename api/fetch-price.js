/**
 * Vercel API Route - 価格取得API
 * Web UIから直接呼び出し可能
 */

// 為替レート（簡易版）
const EXCHANGE_RATES = {
  USD: 150,
  HKD: 19,
  SGD: 110,
  EUR: 160,
  GBP: 190
};

export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS リクエスト処理
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, siteName } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    console.log(`Fetching price from: ${url} (${siteName})`);

    // サイトのHTMLを取得
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    let price = null;
    let currency = 'JPY';

    // サイト別の価格抽出ロジック（シンプル版）
    if (url.includes('bullionstar.com')) {
      // BullionStar - SGD価格
      const sgdMatch = html.match(/SGD\s*([\d,]+\.?\d*)/);
      if (sgdMatch) {
        const sgdPrice = parseFloat(sgdMatch[1].replace(/,/g, ''));
        if (sgdPrice > 100 && sgdPrice < 100000) {
          price = Math.round(sgdPrice * EXCHANGE_RATES.SGD);
        }
      }
    } else if (url.includes('apmex.com')) {
      // APMEX - USD価格
      const patterns = [
        /<meta property="product:price:amount" content="([\d.]+)"/,
        /data-price="([\d.]+)"/,
        /\$\s*([\d,]+\.?\d*)/
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const usdPrice = parseFloat(match[1].replace(/,/g, ''));
          if (usdPrice > 100 && usdPrice < 100000) {
            price = Math.round(usdPrice * EXCHANGE_RATES.USD);
            break;
          }
        }
      }
    } else if (url.includes('lpm.hk')) {
      // LPM - HKD価格
      const hkdMatch = html.match(/HK\$\s*([\d,]+\.?\d*)/);
      if (hkdMatch) {
        const hkdPrice = parseFloat(hkdMatch[1].replace(/,/g, ''));
        if (hkdPrice > 1000 && hkdPrice < 1000000) {
          price = Math.round(hkdPrice * EXCHANGE_RATES.HKD);
        }
      }
    } else if (url.includes('ybx.jp')) {
      // YBX - 日本円価格（Playwrightが必要な場合があるため簡易版）
      const jpyMatch = html.match(/([\d,]+)\s*円/);
      if (jpyMatch) {
        const jpyPrice = parseInt(jpyMatch[1].replace(/,/g, ''));
        if (jpyPrice > 10000 && jpyPrice < 10000000) {
          price = jpyPrice;
        }
      }
    }

    // 汎用価格パターン（フォールバック）
    if (!price) {
      const patterns = [
        { regex: /\$\s*([\d,]+\.?\d*)/, rate: EXCHANGE_RATES.USD },
        { regex: /€\s*([\d,]+\.?\d*)/, rate: EXCHANGE_RATES.EUR },
        { regex: /£\s*([\d,]+\.?\d*)/, rate: EXCHANGE_RATES.GBP },
        { regex: /([\d,]+)\s*円/, rate: 1 }
      ];

      for (const { regex, rate } of patterns) {
        const match = html.match(regex);
        if (match) {
          const value = parseFloat(match[1].replace(/,/g, ''));
          if (value > 100) {
            price = Math.round(value * rate);
            break;
          }
        }
      }
    }

    if (price && price > 1000 && price < 100000000) {
      return res.status(200).json({
        success: true,
        price: price,
        currency: currency,
        siteName: siteName,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(200).json({
        success: false,
        error: 'Price not found or invalid',
        debug: {
          foundPrice: price,
          url: url,
          htmlLength: html.length
        }
      });
    }

  } catch (error) {
    console.error('Error fetching price:', error);
    return res.status(200).json({
      success: false,
      error: error.message
    });
  }
}