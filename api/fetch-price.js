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

    // サイト別の価格抽出ロジック（改良版）
    if (url.includes('bullionstar.com')) {
      // BullionStar - より正確な価格抽出
      // 1. 構造化データを優先的に探す
      let sgdPrice = null;

      // JSON-LD構造化データ
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.offers && jsonData.offers.price) {
            sgdPrice = parseFloat(jsonData.offers.price);
            console.log('Structured data price:', sgdPrice);
          }
        } catch (e) {
          console.log('JSON-LD parse error:', e.message);
        }
      }

      // メタタグ価格
      if (!sgdPrice) {
        const metaMatch = html.match(/<meta[^>]*property="product:price:amount"[^>]*content="([\d.]+)"/);
        if (metaMatch) {
          sgdPrice = parseFloat(metaMatch[1]);
          console.log('Meta tag price:', sgdPrice);
        }
      }

      // 価格表示パターン（より厳密に）
      if (!sgdPrice) {
        // 価格が表示される特定のコンテキストを探す
        const priceContextMatch = html.match(/(?:price|Price)[\s\S]{0,50}?SGD\s*([\d,]+\.?\d*)/);
        if (priceContextMatch) {
          sgdPrice = parseFloat(priceContextMatch[1].replace(/,/g, ''));
          console.log('Context price:', sgdPrice);
        }
      }

      // 商品タイプに応じた価格範囲チェック
      if (sgdPrice) {
        let isValidPrice = false;

        if (url.includes('1-oz') || url.includes('one-oz')) {
          // 1オンス金貨（SGD 3,500-7,000）
          isValidPrice = sgdPrice > 3500 && sgdPrice < 7000;
        } else if (url.includes('half-oz') || url.includes('1-2-oz')) {
          // 1/2オンス金貨（SGD 2,000-3,500）
          isValidPrice = sgdPrice > 2000 && sgdPrice < 3500;
        } else if (url.includes('quarter-oz') || url.includes('1-4-oz')) {
          // 1/4オンス金貨（SGD 1,000-2,000）
          isValidPrice = sgdPrice > 1000 && sgdPrice < 2000;
        } else {
          // デフォルト範囲
          isValidPrice = sgdPrice > 1000 && sgdPrice < 7000;
        }

        if (isValidPrice) {
          price = Math.round(sgdPrice * EXCHANGE_RATES.SGD);
          console.log('Final BullionStar price:', sgdPrice, 'SGD →', price, 'JPY');
        }
      }
    } else if (url.includes('apmex.com')) {
      // APMEX - より正確な価格抽出
      let usdPrice = null;

      // 1. メタタグから価格を取得（最も信頼性が高い）
      const metaMatch = html.match(/<meta property="product:price:amount" content="([\d.]+)"/);
      if (metaMatch) {
        usdPrice = parseFloat(metaMatch[1]);
        console.log('APMEX meta price:', usdPrice);
      }

      // 2. 構造化データ
      if (!usdPrice) {
        const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
        if (jsonLdMatch) {
          try {
            const jsonData = JSON.parse(jsonLdMatch[1]);
            if (jsonData.offers && jsonData.offers.price) {
              usdPrice = parseFloat(jsonData.offers.price);
              console.log('APMEX structured data price:', usdPrice);
            }
          } catch (e) {
            console.log('APMEX JSON-LD parse error:', e.message);
          }
        }
      }

      // 3. data-price属性
      if (!usdPrice) {
        const dataPriceMatch = html.match(/data-price="([\d.]+)"/);
        if (dataPriceMatch) {
          usdPrice = parseFloat(dataPriceMatch[1]);
          console.log('APMEX data-price:', usdPrice);
        }
      }

      // 商品タイプに応じた価格範囲チェック
      if (usdPrice) {
        let isValidPrice = false;

        if (url.includes('1-oz') || url.includes('one-ounce')) {
          // 1オンス金貨（USD 2,500-3,500）
          isValidPrice = usdPrice > 2500 && usdPrice < 3500;
        } else if (url.includes('1-2-oz') || url.includes('half-ounce')) {
          // 1/2オンス金貨（USD 1,300-1,800）
          isValidPrice = usdPrice > 1300 && usdPrice < 1800;
        } else if (url.includes('1-4-oz') || url.includes('quarter-ounce')) {
          // 1/4オンス金貨（USD 650-900）
          isValidPrice = usdPrice > 650 && usdPrice < 900;
        } else if (url.includes('100-euro')) {
          // 100ユーロ金貨（1オンス相当）
          isValidPrice = usdPrice > 2500 && usdPrice < 3500;
        } else {
          // デフォルト範囲（広めに）
          isValidPrice = usdPrice > 500 && usdPrice < 3500;
        }

        if (isValidPrice) {
          price = Math.round(usdPrice * EXCHANGE_RATES.USD);
          console.log('Final APMEX price:', usdPrice, 'USD →', price, 'JPY');
        } else {
          console.log('APMEX price out of range:', usdPrice);
        }
      }
    } else if (url.includes('lpm.hk')) {
      // LPM - より正確な価格抽出
      let hkdPrice = null;

      // 価格パターン（より厳密に）
      const pricePatterns = [
        /<span[^>]*class="[^"]*price[^"]*"[^>]*>HK\$\s*([\d,]+\.?\d*)<\/span>/,
        /<div[^>]*class="[^"]*price[^"]*"[^>]*>HK\$\s*([\d,]+\.?\d*)<\/div>/,
        /HK\$\s*([\d,]+\.?\d*)(?:<\/|[\s<])/
      ];

      for (const pattern of pricePatterns) {
        const match = html.match(pattern);
        if (match) {
          const tempPrice = parseFloat(match[1].replace(/,/g, ''));

          // 商品タイプに応じた価格範囲チェック
          let isValidPrice = false;
          if (url.includes('1-oz') || url.includes('one-ounce')) {
            // 1オンス金貨（HKD 20,000-30,000）
            isValidPrice = tempPrice > 20000 && tempPrice < 30000;
          } else if (url.includes('1-2-oz') || url.includes('half-ounce')) {
            // 1/2オンス金貨（HKD 10,000-15,000）
            isValidPrice = tempPrice > 10000 && tempPrice < 15000;
          } else if (url.includes('100-euro')) {
            // 100ユーロ金貨（1オンス相当）
            isValidPrice = tempPrice > 20000 && tempPrice < 30000;
          } else {
            // デフォルト範囲
            isValidPrice = tempPrice > 10000 && tempPrice < 30000;
          }

          if (isValidPrice) {
            hkdPrice = tempPrice;
            console.log('LPM price found:', hkdPrice);
            break;
          }
        }
      }

      if (hkdPrice) {
        price = Math.round(hkdPrice * EXCHANGE_RATES.HKD);
        console.log('Final LPM price:', hkdPrice, 'HKD →', price, 'JPY');
      }
    } else if (url.includes('ybx.jp')) {
      // YBX - 日本円価格（1/2オンス金貨 = 約30万円）
      const jpyMatch = html.match(/([\d,]+)\s*円/);
      if (jpyMatch) {
        const jpyPrice = parseInt(jpyMatch[1].replace(/,/g, ''));
        // 1/2オンス金貨の適正価格範囲（20万-40万円）
        if (jpyPrice > 200000 && jpyPrice < 400000) {
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