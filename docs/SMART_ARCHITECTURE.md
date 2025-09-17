# 🎯 スマートなアーキテクチャ提案

## 現在の問題点

1. **Cloudflare Workerの制限**
   - 外部サイトへのアクセス（CORS制限）
   - JavaScript実行環境の制限
   - Playwrightが使用不可

2. **ユーザー体験の問題**
   - Web UIから価格更新ができない
   - GitHub Actionsの設定が複雑
   - 技術知識が必要

## 💡 解決策の選択肢

### オプション1: Supabase Edge Functions（推奨）
**完全無料・簡単セットアップ**

```javascript
// Supabase Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { url } = await req.json()

  // Denoは外部サイトにアクセス可能
  const response = await fetch(url)
  const html = await response.text()

  // 価格を抽出
  const price = extractPrice(html)

  // Cloudflare D1を更新
  await updateDatabase(price)

  return new Response(JSON.stringify({ success: true, price }))
})
```

**メリット:**
- ✅ 無料（月50万リクエストまで）
- ✅ Web UIから直接呼び出し可能
- ✅ CORS制限なし
- ✅ 5分でセットアップ完了

### オプション2: Netlify Functions
**簡単デプロイ・GitHub連携**

```javascript
// netlify/functions/fetch-price.js
exports.handler = async (event) => {
  const { url } = JSON.parse(event.body)

  // Puppeteer Coreで価格取得
  const price = await fetchWithPuppeteer(url)

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ price })
  }
}
```

**メリット:**
- ✅ GitHubと自動連携
- ✅ 月300分の無料枠
- ✅ Puppeteer使用可能

### オプション3: Render.com
**Docker対応・フルコントロール**

```dockerfile
# Dockerfile
FROM node:18-slim
RUN npx playwright install-deps chromium
COPY . .
CMD ["node", "price-server.js"]
```

**メリット:**
- ✅ Playwright完全対応
- ✅ 月750時間無料
- ✅ Dockerで自由な環境構築

## 🚀 最もスマートな構成（推奨）

### アーキテクチャ構成

```
┌─────────────────┐
│   Web UI        │  ← Cloudflare Pages（現在のまま）
│  (Cloudflare)   │
└────────┬────────┘
         │
         ↓ API呼び出し
┌─────────────────┐
│  Price API      │  ← Supabase Edge Functions（新規）
│  (Supabase)     │     - 価格取得
└────────┬────────┘     - CORS対応
         │              - 無料
         ↓
┌─────────────────┐
│   Database      │  ← Cloudflare D1（現在のまま）
│  (Cloudflare)   │
└─────────────────┘
```

### 実装手順

#### 1. Supabaseプロジェクト作成（5分）

```bash
# Supabase CLIインストール
npm install -g supabase

# プロジェクト初期化
supabase init

# Edge Function作成
supabase functions new fetch-price
```

#### 2. 価格取得Function作成

```typescript
// supabase/functions/fetch-price/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts"

serve(async (req: Request) => {
  const { url, siteName } = await req.json()

  try {
    // 外部サイトから価格取得（CORS制限なし！）
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    })

    const html = await response.text()
    const doc = new DOMParser().parseFromString(html, "text/html")

    let price = null

    // サイト別価格抽出
    if (url.includes('bullionstar.com')) {
      const match = html.match(/SGD\s*([\d,]+\.?\d*)/)
      if (match) {
        price = Math.round(parseFloat(match[1].replace(/,/g, '')) * 110)
      }
    }
    // ... 他のサイトも同様

    // Cloudflare D1更新（REST API経由）
    await fetch('https://api.cloudflare.com/client/v4/accounts/YOUR_ID/d1/database/YOUR_DB/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('CF_API_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql: 'UPDATE products SET current_price = ? WHERE key = ?',
        params: [price, productKey]
      })
    })

    return new Response(JSON.stringify({ success: true, price }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

#### 3. Cloudflare Worker更新

```javascript
// worker-v2.js の価格更新部分を修正
async function updateProductPrice(productKey) {
  const product = await getProduct(productKey)
  const siteUrls = JSON.parse(product.site_urls || '{}')

  for (const [site, url] of Object.entries(siteUrls)) {
    // Supabase Edge Functionを呼び出し
    const response = await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/fetch-price', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, siteName: site, productKey })
    })

    const result = await response.json()
    if (result.success) {
      // 価格更新成功
      console.log(`Updated ${site}: ¥${result.price}`)
    }
  }
}
```

### セットアップ手順（クライアント向け）

1. **Supabaseアカウント作成**（無料）
   - https://supabase.com でサインアップ
   - プロジェクト作成

2. **Edge Functionデプロイ**
   ```bash
   supabase functions deploy fetch-price
   ```

3. **環境変数設定**
   - Supabase Dashboard → Settings → Edge Functions
   - `CF_API_TOKEN`: Cloudflare APIトークン
   - `CF_ACCOUNT_ID`: CloudflareアカウントID

4. **完了！**
   - Web UIから価格更新ボタンが使える
   - 自動更新も設定可能

## 比較表

| 項目 | 現在の構成 | Supabase構成 |
|------|-----------|--------------|
| Web UIから価格更新 | ❌ 不可 | ✅ 可能 |
| セットアップ時間 | 30分以上 | 5分 |
| 月額費用 | $0 | $0 |
| 技術知識 | 必要 | 不要 |
| CORS制限 | あり | なし |
| Playwright対応 | ローカルのみ | Edge上で可能 |
| スケーラビリティ | 制限あり | 高い |

## まとめ

**Supabase Edge Functions**を使用することで：
- ✅ Web UIから直接価格更新可能
- ✅ セットアップが簡単（5分）
- ✅ 完全無料
- ✅ CORS制限なし
- ✅ クライアントが自分で管理可能

これが最もスマートで実用的な解決策です。