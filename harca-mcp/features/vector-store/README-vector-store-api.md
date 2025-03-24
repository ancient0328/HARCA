# HARCA ベクトルストアAPI

## 概要

HARCA ベクトルストアAPIは、テキスト埋め込みとベクトル検索機能を提供するHTTP APIサーバーです。このAPIを使用することで、分散キャッシュを活用した高速なベクトル検索を外部アプリケーションから利用できます。

## 機能

- **テキスト埋め込み**: テキストを埋め込みベクトルに変換
- **ベクトル検索**: 類似度に基づいてドキュメントを検索
- **キャッシュ管理**: キャッシュ統計の取得とクリア
- **分散キャッシュ**: Redis分散キャッシュを活用した高速な処理
- **データ圧縮**: 効率的なデータ保存と転送

## 設定

ベクトルストアAPIは以下の環境変数で設定できます：

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| `VECTOR_STORE_API_PORT` | APIサーバーのポート番号 | `3701` |
| `REDIS_URL` | Redis接続URL | `redis://localhost:6379` |
| `CACHE_TTL` | キャッシュエントリのTTL（秒） | `3600` |
| `CACHE_PREFIX` | Redisキーのプレフィックス | `harca:embedding:` |
| `ENABLE_MEMORY_CACHE` | メモリキャッシュの有効化 | `true` |
| `MEMORY_CACHE_MAX_ITEMS` | メモリキャッシュの最大アイテム数 | `1000` |
| `ENABLE_REDIS_CACHE` | Redisキャッシュの有効化 | `true` |
| `ENABLE_FILE_CACHE` | ファイルキャッシュの有効化 | `true` |
| `FILE_CACHE_DIR` | ファイルキャッシュのディレクトリ | `.cache/api-embeddings` |
| `ENABLE_PREFETCH` | プリフェッチの有効化 | `true` |
| `PREFETCH_THRESHOLD` | プリフェッチの類似度しきい値 | `0.7` |
| `PREFETCH_MAX_ITEMS` | プリフェッチの最大アイテム数 | `5` |
| `ENABLE_CACHE_COMPRESSION` | データ圧縮の有効化 | `true` |
| `CACHE_COMPRESSION_LEVEL` | 圧縮レベル（1-9） | `6` |
| `CACHE_COMPRESSION_THRESHOLD` | 圧縮閾値（バイト） | `100` |
| `DEFAULT_EMBEDDING_MODEL` | デフォルトの埋め込みモデル | `text-embedding-ada-002` |

## インストールと起動

### 依存関係のインストール

```bash
cd /path/to/harca-mcp/features/vector-store
pnpm install
```

### サーバーの起動

```bash
node start-vector-store-api.js
```

または、環境変数を指定して起動：

```bash
VECTOR_STORE_API_PORT=3701 REDIS_URL=redis://localhost:6379 node start-vector-store-api.js
```

## API エンドポイント

### ルートエンドポイント

APIの基本情報と利用可能なエンドポイントを取得します。

- **URL**: `/`
- **メソッド**: `GET`
- **レスポンス例**:

```json
{
  "name": "HARCA Vector Store API",
  "version": "1.0.0",
  "endpoints": [
    { "path": "/api/embed", "method": "POST", "description": "テキストを埋め込みベクトルに変換" },
    { "path": "/api/search", "method": "POST", "description": "ベクトル検索を実行" },
    { "path": "/api/cache/stats", "method": "GET", "description": "キャッシュ統計情報を取得" },
    { "path": "/api/cache/clear", "method": "POST", "description": "キャッシュをクリア" }
  ]
}
```

### 埋め込みエンドポイント

テキストを埋め込みベクトルに変換します。

- **URL**: `/api/embed`
- **メソッド**: `POST`
- **リクエストボディ**:

```json
{
  "text": "埋め込みに変換するテキスト",
  "model": "text-embedding-ada-002"  // オプション、デフォルト値を使用する場合は省略可
}
```

- **レスポンス例**:

```json
{
  "success": true,
  "model": "text-embedding-ada-002",
  "embedding": [0.0023, -0.0118, 0.0076, ...],  // 埋め込みベクトル
  "dimensions": 1536  // ベクトルの次元数
}
```

### 検索エンドポイント

クエリに類似したドキュメントを検索します。

- **URL**: `/api/search`
- **メソッド**: `POST`
- **リクエストボディ**:

```json
{
  "query": "検索クエリ",
  "documents": [
    { "id": "1", "text": "ドキュメント1のテキスト" },
    { "id": "2", "text": "ドキュメント2のテキスト" },
    ...
  ],
  "model": "text-embedding-ada-002",  // オプション
  "topK": 5  // 返す結果の数、オプション
}
```

- **レスポンス例**:

```json
{
  "success": true,
  "query": "検索クエリ",
  "model": "text-embedding-ada-002",
  "results": [
    { "id": "2", "text": "ドキュメント2のテキスト", "score": 0.89 },
    { "id": "5", "text": "ドキュメント5のテキスト", "score": 0.76 },
    ...
  ]
}
```

### キャッシュ統計情報エンドポイント

キャッシュの統計情報を取得します。

- **URL**: `/api/cache/stats`
- **メソッド**: `GET`
- **レスポンス例**:

```json
{
  "success": true,
  "stats": {
    "cacheSize": 120,
    "hitRate": 0.85,
    "missRate": 0.15,
    "models": {
      "text-embedding-ada-002": {
        "count": 120,
        "hitRate": 0.85
      }
    },
    "compression": {
      "enabled": true,
      "compressionRatio": 0.45,
      "savedBytes": 1024000
    }
  }
}
```

### キャッシュクリアエンドポイント

キャッシュをクリアします。

- **URL**: `/api/cache/clear`
- **メソッド**: `POST`
- **リクエストボディ**:

```json
{
  "model": "text-embedding-ada-002"  // オプション、特定のモデルのキャッシュのみをクリア
}
```

- **レスポンス例**:

```json
{
  "success": true,
  "message": "モデル text-embedding-ada-002 のキャッシュをクリアしました"
}
```

## パフォーマンス指標

ベクトルストアAPIのパフォーマンステストの結果は以下の通りです：

### 埋め込み生成速度

| テキストサイズ | 平均処理時間 | 標準偏差 |
|--------------|------------|---------|
| 短いテキスト   | 3.41ms     | ±0.68ms |
| 中程度のテキスト | 2.68ms     | ±0.44ms |
| 長いテキスト   | 2.59ms     | ±0.31ms |
| 非常に長いテキスト | 2.36ms   | ±0.15ms |

### 検索操作速度

| ドキュメント数 | 平均処理時間 | 標準偏差 |
|--------------|------------|---------|
| 少数ドキュメント | 8.08ms     | ±0.42ms |
| 中程度ドキュメント | 42.80ms   | ±13.40ms |
| 多数ドキュメント | 152.39ms   | ±19.68ms |

### 並列処理性能

| 並列度 | リクエスト/秒 | 成功率 |
|-------|------------|-------|
| 1     | 377.04     | 100.00% |
| 5     | 452.96     | 100.00% |
| 10    | 609.23     | 100.00% |
| 20    | 551.10     | 100.00% |

### キャッシュパフォーマンス

| 指標 | 値 |
|-----|-----|
| メモリキャッシュ書き込み速度 | 約377,554操作/秒 |
| キャッシュ読み取り速度 | 約2,174操作/秒 |
| キャッシュヒット率 | 100% |
| 同期遅延 | 約102ms |

## エラーハンドリング

ベクトルストアAPIは以下のエラーパターンに対応しています：

### サポートされているエラーパターン

| エラータイプ | 説明 | 重大度 | 回復戦略 |
|------------|------|-------|---------|
| authentication | 認証エラー（APIキー無効など） | critical | ユーザーアクション要求 |
| rate_limit | レート制限エラー | warning | 指数バックオフによる再試行 |
| timeout | リクエストタイムアウト | warning | 指数バックオフによる再試行 |
| network | ネットワーク接続エラー | warning | 指数バックオフによる再試行 |
| invalid_request | 不正なリクエストパラメータ | critical | エラーレスポンス返却 |
| server | サーバー側エラー | warning | フォールバックモデル使用 |
| model | モデル関連エラー | critical | フォールバックモデル使用 |
| input | 入力コンテンツエラー | warning | 入力の修正または代替処理 |

### エラー回復戦略

- **retry_with_backoff**: 指数バックオフアルゴリズムを使用した再試行
- **fallback_model**: 代替モデルへのフォールバック
- **require_user_action**: ユーザーの介入が必要なエラー
- **abort_with_error**: 処理を中止してエラーを返却

## 開発ステータス

### Phase 1 (完了)

- ベクトルストアAPIの基本機能実装
- Redis分散キャッシュの実装
- パフォーマンステストの実施
- エラーハンドリングテストの実施
- 統合テストの実施

### Phase 2 (計画更新: 2025年3月16日)

優先順位の見直しにより、以下の順序で実装を進めます：

1. **統一された起動スクリプトとDocker Compose対応** (最高優先度)
   - 簡易な起動方法の提供
   - Docker Composeによる環境構築の簡素化
   - 設定の一元管理

2. **ARCHIVEからのコード分析機能移植** (高優先度)
   - コード複雑度分析
   - 重複コード検出
   - コメント率分析
   - セキュリティチェック

3. **基本的な管理ダッシュボードUI** (中〜高優先度)
   - システムステータス表示
   - キャッシュ統計の可視化
   - ベクトル検索のWebインターフェース
   - コード分析結果の表示

4. **追加エディタ対応** (中優先度)
   - RooCode、Clineなど追加エディタの統合
   - エディタ固有の機能拡張

5. **最適化と拡張** (中〜低優先度)
   - パフォーマンスの最適化
   - モニタリング機能の強化
   - スケーラビリティの検証
   - 検索機能の拡張（メタデータフィルタリング、ハイブリッド検索）
   - キャッシュ戦略の最適化
   - APIの拡張（バルク操作、非同期処理）
   - セキュリティの強化

## クライアント例

### Node.js

```javascript
const axios = require('axios');

async function searchDocuments() {
  const documents = [
    { id: '1', text: '人工知能（AI）は、人間の知能を模倣するコンピュータシステムです。' },
    { id: '2', text: '機械学習は、AIの一分野で、データからパターンを学習します。' },
    { id: '3', text: 'ディープラーニングは、ニューラルネットワークを使用した機械学習の手法です。' }
  ];
  
  try {
    const response = await axios.post('http://localhost:3701/api/search', {
      query: '機械学習とは何ですか？',
      documents,
      topK: 2
    });
    
    console.log('検索結果:', response.data.results);
  } catch (error) {
    console.error('エラー:', error);
  }
}

searchDocuments();
```

### Python

```python
import requests
import json

def search_documents():
    documents = [
        {"id": "1", "text": "人工知能（AI）は、人間の知能を模倣するコンピュータシステムです。"},
        {"id": "2", "text": "機械学習は、AIの一分野で、データからパターンを学習します。"},
        {"id": "3", "text": "ディープラーニングは、ニューラルネットワークを使用した機械学習の手法です。"}
    ]
    
    try:
        response = requests.post(
            "http://localhost:3701/api/search",
            json={
                "query": "機械学習とは何ですか？",
                "documents": documents,
                "topK": 2
            }
        )
        
        results = response.json()["results"]
        print("検索結果:", results)
    except Exception as e:
        print("エラー:", e)

search_documents()
```

## エラーハンドリング

APIは以下のようなエラーレスポンスを返す場合があります：

```json
{
  "error": "エラータイプ",
  "message": "エラーの詳細メッセージ"
}
```

一般的なエラーコード：

- `400 Bad Request`: リクエストパラメータが不正
- `500 Internal Server Error`: サーバー内部エラー

## パフォーマンスと制限

- 埋め込みの生成は計算コストが高いため、キャッシュを活用して高速化しています
- 大量のドキュメントを一度に検索する場合は、バッチ処理を検討してください
- APIサーバーはデフォルトで最大10MBのリクエストボディを受け付けます

## セキュリティ

- 本番環境では、適切な認証と認可を実装することを強く推奨します
- HTTPS経由でのアクセスを検討してください
- 信頼できるネットワークからのアクセスに制限することも検討してください

## トラブルシューティング

- APIサーバーが起動しない場合は、Redisサーバーが実行中であることを確認してください
- ポートの競合がある場合は、`VECTOR_STORE_API_PORT`環境変数で別のポートを指定してください
- 詳細なログを確認するには、環境変数`DEBUG=true`を設定してください
