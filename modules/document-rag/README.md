# Document RAG Module

## 概要

このモジュールは、HARCAプロジェクトのドキュメント（特にプロジェクト記録）をRAG（Retrieval Augmented Generation）化するための機能を提供します。既存のHARCAのベクトルストアとキャッシュ機能を活用し、ドキュメントの検索性と活用性を高めます。

## 主な機能

- Markdownドキュメントの処理とチャンク分割
- OpenAI埋め込みモデルを使用したベクトル化
- PostgreSQLのpgvector拡張を活用した効率的な保存
- メタデータを活用した高度な検索機能
- 既存のHARCAキャッシュシステムとの統合

## 使用方法

### 初期設定

```bash
# モジュールの初期化
cd /app/modules/document-rag
npm install
```

### 基本的な使用例

```javascript
const { DocumentRAG } = require('/app/modules/document-rag');

// RAGインスタンスの初期化
const documentRag = new DocumentRAG({
  sourceDir: '/app/docs',
  vectorNamespace: 'document_vectors',
  cachePrefix: 'harca:docs:embedding:'
});

// ドキュメントの処理と保存
await documentRag.processAndStoreDocuments();

// 類似ドキュメントの検索
const results = await documentRag.search('HARCAとWindsurfの連携方法', 5);
console.log(results);
```

## 設定オプション

`config/default.js`ファイルで以下の設定が可能です：

- `chunkSize`: ドキュメントの分割サイズ（デフォルト: 1000文字）
- `chunkOverlap`: チャンク間のオーバーラップ（デフォルト: 200文字）
- `embeddingModel`: 使用する埋め込みモデル（デフォルト: text-embedding-3-small）
- `maxConcurrentProcessing`: 同時処理数の上限（デフォルト: 2）
- `scheduledUpdateTime`: 自動更新の時間（デフォルト: 毎日3:00 AM）

## 環境変数

このモジュールは以下の環境変数を使用します：

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| `HARCA_ROOT` | HARCAプロジェクトのルートディレクトリ | 自動検出（`../../..`） |
| `NODE_ENV` | 実行環境（development/production） | なし（指定推奨） |

### 環境変数の設定方法

#### 開発環境

```bash
# .env.localファイルに追加
HARCA_ROOT=/path/to/harca
NODE_ENV=development
```

#### Docker環境

```yaml
# docker-compose.ymlに追加
services:
  harca-server:
    environment:
      - HARCA_ROOT=/app
      - NODE_ENV=production
    volumes:
      - ./logs:/app/modules/document-rag/logs
```

## ログ

ログファイルは `modules/document-rag/logs/document-rag.log` に出力されます。
ログレベルは環境変数 `NODE_ENV` によって自動的に設定されます：

- `development`: debugレベル（詳細なログ）
- `production`: infoレベル（重要な情報のみ）

## 依存関係

- HARCAのベクトルストア機能
- HARCAのキャッシュシステム
- OpenAI API（埋め込みモデル用）
- PostgreSQL（pgvector拡張）

## 注意事項

- 大量のドキュメントを一度に処理すると、システムリソースに負荷がかかる可能性があります
- 機密情報を含むドキュメントの処理には注意してください
- 定期的なインデックスのメンテナンスを推奨します
