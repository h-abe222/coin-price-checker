# 価格取得サーバーのセットアップ

## ローカル価格取得サーバー

### 起動方法

```bash
node price-fetch-server.js
```

サーバーは `http://localhost:3456` で起動します。

### 機能

Playwrightを使用してJavaScript必須サイトから価格を取得：
- ✅ APMEX: 正常動作（約32.9万円）
- ❌ BullionStar: 価格取得失敗
- ❌ LPM: 価格取得失敗

### Cloudflare Worker設定

1. ローカルサーバーを起動
2. ngrokまたはトンネルサービスで公開（オプション）
3. `wrangler.toml`のVERCEL_API_URLを以下に変更：
   - ローカル使用時: `http://localhost:3456/api/fetch-price`
   - ngrok使用時: `https://[your-ngrok-url].ngrok.io/api/fetch-price`

### テスト済み価格

- APMEX 1/2oz Maple: ¥328,815（正確）

## 注意事項

- ローカルサーバーが起動していないと価格更新は失敗します
- Playwrightはメモリを消費するため、定期的な再起動を推奨