# Redis分散キャッシュシステム

## 概要

このシステムは、複数のインスタンス間で同期された高性能な分散キャッシュを提供します。メモリキャッシュ、Redisキャッシュ、ファイルキャッシュの3つの階層を組み合わせることで、高速なアクセスと永続性を両立しています。

## 主な機能

- **階層型キャッシュ**: メモリ、Redis、ファイルの3層構造
- **分散同期**: Redis PubSubを使用した複数インスタンス間の同期
- **モデル別キャッシュ管理**: 特定のモデルのキャッシュをクリア可能
- **詳細な統計情報**: キャッシュのヒット率、サイズ、パフォーマンスなどの統計
- **パフォーマンス分析**: キャッシュの使用パターンと最適化の推奨事項
- **環境変数による設定**: 柔軟な設定オプション
- **データ圧縮**: zlib圧縮によるメモリ使用量の削減とネットワーク転送の最適化

## アーキテクチャ

システムは以下のコンポーネントで構成されています：

1. **EmbeddingCache**: 主要なキャッシュクラス。階層型キャッシュを管理し、高レベルのAPIを提供します。
2. **RedisCacheManager**: Redis接続とPubSub機能を管理します。
3. **LRUCache**: メモリ内キャッシュの実装。最近使用されていないアイテムを削除します。

## セットアップ

### 環境変数

以下の環境変数を設定して、キャッシュの動作をカスタマイズできます：

```
# Redis分散キャッシュの設定
REDIS_URL=redis://localhost:6379
REDIS_CACHE_ENABLED=true
REDIS_CACHE_TTL=86400
REDIS_CACHE_PREFIX=harca
ENABLE_MEMORY_CACHE=true
ENABLE_FILE_CACHE=true
CACHE_DIR=.cache/embeddings
ENABLE_CACHE_COMPRESSION=true
CACHE_COMPRESSION_LEVEL=6
CACHE_COMPRESSION_THRESHOLD=100
```

### インストール

Redisサーバーをインストールして起動します：

```bash
# Macの場合
brew install redis
brew services start redis

# Linuxの場合
sudo apt-get install redis-server
sudo systemctl start redis-server
```

## 使用方法

### 基本的な使用法

```javascript
const { EmbeddingCache } = require('./embedding-cache');

// キャッシュインスタンスを作成
const cache = new EmbeddingCache({
  enableMemoryCache: true,
  enableRedisCache: true,
  enableFileCache: true,
  redisUrl: 'redis://localhost:6379',
  cacheDir: './cache',
  enableCacheCompression: true,
  cacheCompressionLevel: 6,
  cacheCompressionThreshold: 100
});

// データをキャッシュに保存
await cache.set('テキスト', [0.1, 0.2, 0.3], 'model-name');

// キャッシュからデータを取得
const embedding = await cache.get('テキスト', 'model-name');

// 特定のモデルのキャッシュをクリア
await cache.clearModelCache('model-name');

// すべてのキャッシュをクリア
await cache.clear();

// キャッシュの統計情報を取得
const stats = await cache.getStats();

// キャッシュのパフォーマンスを分析
const analysis = await cache.analyzePerformance();

// リソースを解放
await cache.close();
```

### 分散キャッシュの同期

複数のインスタンスでキャッシュを使用する場合、同じRedisサーバーを指定することで、自動的に同期されます：

```javascript
// インスタンス1
const cache1 = new EmbeddingCache({
  redisUrl: 'redis://localhost:6379'
});

// インスタンス2（別のプロセスまたはサーバー）
const cache2 = new EmbeddingCache({
  redisUrl: 'redis://localhost:6379'
});

// インスタンス1でキャッシュを設定すると、インスタンス2でも利用可能になります
await cache1.set('テキスト', [0.1, 0.2, 0.3], 'model-name');

// インスタンス2でデータを取得
const embedding = await cache2.get('テキスト', 'model-name');

// インスタンス1でモデルキャッシュをクリアすると、インスタンス2でもクリアされます
await cache1.clearModelCache('model-name');
```

## データ圧縮

埋め込みキャッシュは、zlibライブラリを使用してデータを圧縮することができます。これにより、メモリ使用量を削減し、ネットワーク転送を最適化できます。

### 圧縮設定

圧縮機能は以下の環境変数で設定できます：

- `ENABLE_CACHE_COMPRESSION`: 圧縮機能の有効化（デフォルト: `true`）
- `CACHE_COMPRESSION_LEVEL`: 圧縮レベル（1-9、9が最高圧縮率、デフォルト: `6`）
- `CACHE_COMPRESSION_THRESHOLD`: 圧縮を適用するデータサイズの閾値（バイト、デフォルト: `100`）

### 圧縮アルゴリズム

圧縮には、Node.jsの標準ライブラリである`zlib`モジュールを使用しています。圧縮レベルを調整することで、圧縮率と処理速度のバランスを取ることができます。

### 圧縮の効果

圧縮を有効にすると、以下の効果が期待できます：

- **メモリ使用量の削減**: 埋め込みベクトルなどの大きなデータを圧縮することで、メモリ使用量を削減できます
- **ネットワーク転送の最適化**: Redis経由でのデータ転送が効率化されます
- **ディスク使用量の削減**: ファイルキャッシュのサイズが削減されます

圧縮の効果はキャッシュダッシュボードで確認できます。圧縮率や節約されたバイト数などの統計情報が表示されます。

### 圧縮のベストプラクティス

- 小さなデータ（100バイト未満）は圧縮しても効果が低いため、`CACHE_COMPRESSION_THRESHOLD`で閾値を設定しています
- 圧縮レベルを高くすると圧縮率は向上しますが、CPU使用率も増加します。バランスの取れた設定（レベル6）を推奨します
- 圧縮が有効な場合、キャッシュの読み書きに若干のオーバーヘッドが発生します。パフォーマンスへの影響を監視してください

## パフォーマンス評価

キャッシュのパフォーマンスを評価するには、ベンチマークスクリプトを実行します：

```bash
node features/vector-store/benchmark-cache.js
```

このスクリプトは以下の項目を測定します：

- 書き込み速度（セット操作）
- 読み取り速度（ゲット操作）
- キャッシュヒット率
- Redis同期の遅延
- メモリ使用量

### 最新のベンチマーク結果

最新のベンチマーク結果（2025年3月16日実施）は以下の通りです：

| 指標 | 値 |
|-----|-----|
| メモリキャッシュ書き込み速度 | 約377,554操作/秒 |
| キャッシュ読み取り速度 | 約2,174操作/秒 |
| キャッシュヒット率 | 100% |
| 同期遅延 | 約102ms |
| 同期成功率 | 100% |

これらの結果から、キャッシュシステムは高速かつ安定して動作していることが確認できます。特に書き込み操作の速度が非常に高く、読み取り操作も効率的に処理されています。また、同期機能も安定して動作しており、複数インスタンス間でのキャッシュの一貫性が保たれています。

## トラブルシューティング

### 接続エラー

Redisサーバーに接続できない場合：

1. Redisサーバーが実行中であることを確認します
2. 接続URLが正しいことを確認します
3. ファイアウォールの設定を確認します

### メモリ使用量の問題

メモリ使用量が多い場合：

1. `memoryLimit`パラメータを調整します
2. `enableDetailedStats`を`false`に設定します
3. 不要なモデルのキャッシュをクリアします

### 同期の問題

インスタンス間の同期に問題がある場合：

1. 両方のインスタンスが同じRedisサーバーを使用していることを確認します
2. PubSub機能が有効になっていることを確認します
3. ネットワークの遅延を確認します

## 今後の改善点

1. **キャッシュの有効期限**: アイテムごとのTTL設定
2. **圧縮オプション**: 大きな埋め込みベクトルの圧縮
3. **シャーディング**: 大規模データセット用のRedisシャーディング
4. **フォールバックメカニズム**: Redis接続失敗時のフォールバック
5. **キャッシュの予熱**: 頻繁にアクセスされるアイテムの事前ロード
