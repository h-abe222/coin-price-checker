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
      // BullionStar - SGD価格（1/2オンス金貨の適正価格範囲で判定）
      const sgdMatches = html.match(/SGD\s*([\d,]+\.?\d*)/g);
      console.log('BullionStar SGD matches:', sgdMatches ? sgdMatches.slice(0, 5) : 'none');

      if (sgdMatches) {
        for (const match of sgdMatches) {
          const sgdPrice = parseFloat(match.replace(/SGD\s*/g, '').replace(/,/g, ''));
          console.log('SGD price found:', sgdPrice);
          // 1/2オンス金貨の適正価格範囲（SGD 1,000-5,000程度）
          if (sgdPrice > 1000 && sgdPrice < 5000) {
            price = Math.round(sgdPrice * EXCHANGE_RATES.SGD);
            console.log('Using SGD price:', sgdPrice, '→ JPY:', price);
            break;
          }
        }
      }

      // 価格が見つからない場合、別のパターンを試す
      if (!price) {
        const pricePattern = /"price":\s*"?([\d.]+)"?/;
        const priceMatch = html.match(pricePattern);
        if (priceMatch) {
          const sgdPrice = parseFloat(priceMatch[1]);
          console.log('JSON price found:', sgdPrice);
          if (sgdPrice > 1000 && sgdPrice < 5000) {
            price = Math.round(sgdPrice * EXCHANGE_RATES.SGD);
          }
        }
      }
    } else if (url.includes('apmex.com')) {
      // APMEX - USD価格（1/2オンス金貨の適正価格範囲）
      const patterns = [
        /<meta property="product:price:amount" content="([\d.]+)"/,
        /data-price="([\d.]+)"/,
        /\$\s*([\d,]+\.?\d*)/
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const usdPrice = parseFloat(match[1].replace(/,/g, ''));
          // 1/2オンス金貨の適正価格範囲（USD 800-2,000程度）
          if (usdPrice > 800 && usdPrice < 2000) {
            price = Math.round(usdPrice * EXCHANGE_RATES.USD);
            break;
          }
        }
      }
    } else if (url.includes('lpm.hk')) {
      // LPM - HKD価格（1/2オンス金貨の適正価格範囲）
      const hkdMatches = html.match(/HK\$\s*([\d,]+\.?\d*)/g);
      if (hkdMatches) {
        for (const match of hkdMatches) {
          const hkdPrice = parseFloat(match.replace(/HK\$\s*/g, '').replace(/,/g, ''));
          // 1/2オンス金貨の適正価格範囲（HKD 8,000-20,000程度）
          if (hkdPrice > 8000 && hkdPrice < 20000) {
            price = Math.round(hkdPrice * EXCHANGE_RATES.HKD);
            break;
          }
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

    // 汎用価格パターン（フォールバック）- 一時的に無効化
    // if (!price) {
    //   const patterns = [
    //     { regex: /\$\s*([\d,]+\.?\d*)/, rate: EXCHANGE_RATES.USD },
    //     { regex: /€\s*([\d,]+\.?\d*)/, rate: EXCHANGE_RATES.EUR },
    //     { regex: /£\s*([\d,]+\.?\d*)/, rate: EXCHANGE_RATES.GBP },
    //     { regex: /([\d,]+)\s*円/, rate: 1 }
    //   ];

    //   for (const { regex, rate } of patterns) {
    //     const match = html.match(regex);
    //     if (match) {
    //       const value = parseFloat(match[1].replace(/,/g, ''));
    //       if (value > 100) {
    //         price = Math.round(value * rate);
    //         break;
    //       }
    //     }
    //   }
    // }

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