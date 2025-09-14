# 🚀 Cloudflare Workers無料デプロイガイド

## 完全無料で商品管理APIを作成！

Cloudflare Workersなら**月10万リクエストまで無料**で、KVストレージも無料枠があります。

## 📋 設定手順（10分で完了）

### 1. Cloudflareアカウント作成
1. https://cloudflare.com にアクセス
2. 「Sign Up」から無料アカウント作成

### 2. Wranglerインストール（コマンドラインツール）
```bash
npm install -g wrangler
```

### 3. Cloudflareにログイン
```bash
wrangler login
```

### 4. KVネームスペース作成
```bash
# KVストレージを作成
wrangler kv:namespace create "PRODUCTS"
```

出力された`id`をメモしてください。例：
```
{ binding = "PRODUCTS", id = "abcd1234..." }
```

### 5. wrangler.tomlを編集
```toml
name = "bullionstar-monitor"
main = "worker.js"
compatibility_date = "2024-01-01"

[env.production]
vars = { ADMIN_PASSWORD = "admin123" }

[[kv_namespaces]]
binding = "PRODUCTS"
id = "ここに上記のIDを入力"  # 例: "abcd1234..."
```

### 6. デプロイ
```bash
wrangler deploy
```

### 7. URLを取得
デプロイ後に表示されるURL（例：`https://bullionstar-monitor.YOUR-USERNAME.workers.dev`）をコピー

### 8. Webアプリで使用

1. **Cloudflare版アプリにアクセス**
   ```
   https://h-abe222.github.io/coin-price-checker/index-cloudflare.html
   ```

2. **ログイン**
   - パスワード: `admin123`

3. **設定タブでWorker URL入力**
   - Worker URL: 上記でコピーしたURL
   - 管理パスワード: `admin123`

4. **商品の追加開始！**

## ✅ 完了！

これで商品の追加・削除がWeb上で完結します。

## 🎯 メリット

- ✅ **完全無料**（月10万リクエストまで）
- ✅ **高速**（世界中のエッジで動作）
- ✅ **簡単設定**（10分で完了）
- ✅ **データ永続化**（KVストレージ）
- ✅ **スケーラブル**

## 📱 使い方

1. 「新規登録」タブから商品URL入力
2. 「商品を追加」をクリック
3. 即座に商品一覧に反映！
4. 削除もワンクリック

## 🔧 カスタマイズ

### パスワード変更
`wrangler.toml`の`ADMIN_PASSWORD`を変更してデプロイ：
```toml
vars = { ADMIN_PASSWORD = "your-password" }
```

### 複数環境
開発用と本番用を分ける：
```bash
wrangler deploy --env production
```

## 📊 使用量確認

Cloudflareダッシュボードで確認：
1. https://dash.cloudflare.com
2. Workers & Pages → あなたのWorker
3. Analytics タブ

## ⚡ トラブルシューティング

### エラー: "Unauthorized"
→ 設定タブで管理パスワードを確認

### エラー: "Network error"
→ Worker URLが正しいか確認

### データが消えた
→ KVは永続化されますが、無料枠の制限に注意

## 🆚 他のサービスとの比較

| サービス | 無料枠 | 設定時間 | データ永続化 |
|---------|--------|----------|--------------|
| **Cloudflare Workers** | 10万req/日 | 10分 | ✅ KV |
| Vercel | 10万req/月 | 15分 | ❌ 別途必要 |
| Netlify | 125k req/月 | 15分 | ❌ 別途必要 |
| Supabase | 500MB | 20分 | ✅ PostgreSQL |

**Cloudflare Workersが最もシンプルで高速です！**