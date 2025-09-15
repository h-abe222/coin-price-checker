# 🚀 Supabase無料データベース設定ガイド

## これで商品の追加・削除がWeb上で完結します！

## 📋 設定手順（5分で完了）

### 1. Supabaseアカウント作成
1. https://supabase.com にアクセス
2. 「Start your project」をクリック
3. GitHubアカウントでログイン

### 2. プロジェクト作成
1. 「New Project」をクリック
2. 以下を入力：
   - **Name**: bullionstar-monitor
   - **Database Password**: 任意のパスワード
   - **Region**: Northeast Asia (Tokyo)
3. 「Create new project」をクリック

### 3. テーブル作成
1. 左メニューの「Table Editor」をクリック
2. 「Create a new table」をクリック
3. 以下の設定でテーブル作成：

```sql
-- テーブル名: products
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  current_price INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. APIキーを取得
1. 左メニューの「Settings」→「API」
2. 以下をコピー：
   - **Project URL**: `https://xxx.supabase.co`
   - **Anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 5. Webアプリに設定
1. https://h-abe222.github.io/coin-price-checker/index-with-api.html にアクセス
2. パスワード（admin123）でログイン
3. 「設定」タブを開く
4. Supabase URLとAnon Keyを入力
5. 「設定を保存」をクリック

## ✅ 完了！

これで以下が可能になります：
- 商品の追加（Web上で完結）
- 商品の削除（Web上で完結）
- データの永続保存
- どこからでもアクセス可能

## 🎯 メリット
- **完全無料**（500MBまで）
- **リアルタイムデータベース**
- **自動バックアップ**
- **高速・安定**

## 📱 使い方
1. 「新規登録」タブから商品URL入力
2. 「商品を追加」をクリック
3. すぐに商品一覧に反映！

## ⚡ 代替URL

Supabase版のアプリ：
```
https://h-abe222.github.io/coin-price-checker/index-with-api.html
```

通常版（GitHub編集）：
```
https://h-abe222.github.io/coin-price-checker/
```