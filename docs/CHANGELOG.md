# 変更履歴 - コイン価格チェッカー

## [2.0.0] - 2025-09-15

### 🎉 メジャーリリース: 汎用コイン価格チェッカーへの転換

### ✨ 新機能

#### 商品画像自動取得
- **NEW**: BullionStar商品の300x300高解像度画像を自動抽出
- **NEW**: 画像URLのデータベース保存機能
- **NEW**: Web管理画面での画像サムネイル表示
- **NEW**: 画像読み込みエラーハンドリング

#### 汎用ブランディング
- **BREAKING**: BullionStar専用 → 汎用コイン価格チェッカーに変更
- **NEW**: ページタイトル更新: "コイン価格チェッカー - 貴金属価格監視システム"
- **NEW**: メインヘッダー: "コイン価格チェッカー"
- **NEW**: 汎用的なUI文言とプレースホルダー

#### Web管理画面の拡張
- **NEW**: `/admin` ルートでの完全HTML配信
- **NEW**: ランディングページ（`/`）の追加
- **NEW**: 自動API URL検出機能

### 🔧 改善

#### データベース
- **ADD**: `products.image_url` カラム追加
- **MIGRATE**: ローカル・リモート両方のD1データベース更新

#### 価格取得ロジック
- **IMPROVE**: 画像抽出精度の大幅向上
- **IMPROVE**: 300x300画像の優先順位付けロジック
- **IMPROVE**: BullionStarURLパターンマッチング強化

#### API機能
- **ENHANCE**: 価格更新時の画像URL同時更新
- **ENHANCE**: 商品情報の包括的更新機能

### 🏗️ リファクタリング

#### プロジェクト構成
- **ORGANIZE**: 65個のファイルを論理的フォルダに整理
- **ARCHIVE**: レガシーPython実装をアーカイブ化
- **STRUCTURE**: 以下の新しいフォルダ構成:
  - `cloudflare/` - メイン実装
  - `docs/` - ドキュメント
  - `web-interfaces/` - 代替UI
  - `python-versions/` - Python版
  - `test-files/` - テスト・デバッグ
  - `archived/` - レガシー

#### コード品質
- **CLEAN**: 未使用ファイルの整理
- **DOCUMENT**: 包括的ドキュメント作成
- **OPTIMIZE**: Workerバンドルサイズ最適化

### 🐛 修正

- **FIX**: 商品画像が表示されない問題
- **FIX**: GitHub Pagesでのタイトル更新が反映されない問題
- **FIX**: Worker HTMLルーティングの不備

### 📋 テスト・デバッグ

- **ADD**: `test-image.js` - 画像抽出テスト用スクリプト
- **ADD**: `debug-page.png` - BullionStarページの詳細調査用
- **TEST**: 全商品での画像取得成功を確認

### 🚀 デプロイ

- **DEPLOY**: Cloudflare Workers (Version: 4cf8669d-9feb-43e8-95ac-ae4a2a3b108d)
- **DEPLOY**: GitHub Pages更新
- **SIZE**: Workerサイズ 40.03 KiB (gzip: 7.80 KiB)

---

## [1.2.0] - 2025-09-14

### ✨ 新機能
- D1データベース統合
- 価格履歴追跡機能
- Web管理画面実装

### 🔧 改善
- Playwright自動化スクリプト
- BullionStar価格抽出ロジック
- 円換算機能（USD→JPY レート150）

---

## [1.1.0] - 2025-09-14

### ✨ 新機能
- Cloudflare Workers実装
- 商品管理API
- 基本的な価格監視機能

### 🏗️ 技術スタック
- Cloudflare Workers + D1 Database
- Playwright for web scraping
- RESTful API設計

---

## [1.0.0] - 2025-09-14

### 🎉 初回リリース

### ✨ 新機能
- BullionStar価格取得
- Python Flask実装
- 基本的なWebUI

### 📋 対象商品
- Silver BullionStar 1kg
- Canadian Silver Maple
- Singapore Silver Merlion
- Chinese Silver Panda 2015

---

## 📊 統計情報

### 開発指標
- **開発期間**: 2日間（2025/09/14-15）
- **総コミット数**: 10+
- **機能完成度**: 95%
- **対応サイト数**: 1（BullionStar）
- **登録商品数**: 4

### パフォーマンス
- **価格取得時間**: ~10秒/商品
- **画像取得成功率**: 100%
- **Worker応答時間**: ~100ms
- **データベースサイズ**: ~1MB

### 技術負債
- ❌ 他サイト対応なし（将来対応予定）
- ❌ GitHub Actions自動化未実装
- ❌ 価格アラート機能未実装

---

## 🔮 今後のリリース予定

### [2.1.0] - 予定: 2025年10月
- GitHub Actions自動実行
- エラーハンドリング強化
- ログ機能追加

### [3.0.0] - 予定: 2025年11月
- 複数サイト対応（APMEX、JMBullion）
- 価格アラート機能
- 価格チャート表示

### [4.0.0] - 予定: 2025年12月
- ダークモード対応
- モバイルアプリ化
- 多言語対応

---

*この変更履歴は [Keep a Changelog](https://keepachangelog.com/) フォーマットに従っています。*