# Redisサービスのモジュール化と永続化設定

**日付**: 2025年3月19日
**担当者**: HARCA開発チーム

## 概要

本記録では、HARCAシステムのRedisサービスをモジュール化し、永続化設定を実装したことを報告します。これらの変更により、プロジェクト構造の一貫性が向上し、キャッシュデータの信頼性が強化されました。

## 変更内容

### 1. Redisサービスのモジュール化

プロジェクト構造の一貫性を高めるため、以下の変更を実施しました：

1. **`/modules/redis`ディレクトリの作成**
   - PostgreSQLと同様に、Redisもモジュール構造に統合
   - サービスの独立性と管理の容易さを向上

2. **カスタム設定ファイルの作成**
   - `redis.conf`: Redisの動作設定を明示的に定義
   - `Dockerfile`: カスタム設定を適用したRedisイメージのビルド定義

3. **docker-compose.ymlの更新**
   - Redisサービスの定義を更新し、イメージ直接使用から`./modules/redis`内のDockerfileビルドに変更
   - ボリュームマウントと健全性チェックの設定を維持

### 2. Redis永続化設定の実装

HARCAプロジェクト固有ルールに基づき、Redisの永続化設定を実装しました：

1. **AOF永続化の有効化**
   - `appendonly yes`: すべての書き込み操作をログに記録
   - `appendfsync everysec`: 1秒ごとにディスクに同期（パフォーマンスとデータ安全性のバランス）

2. **RDBスナップショット設定**
   - `save 900 1`: 15分以内に1回以上の変更があれば保存
   - `save 300 10`: 5分以内に10回以上の変更があれば保存

3. **メモリ管理の最適化**
   - `maxmemory 256mb`: メモリ使用量の上限を設定
   - `maxmemory-policy allkeys-lru`: メモリ上限到達時にLRU（最近最も使われていない）キーを削除

## 実装の詳細

### 1. redis.confの設定

以下の設定をredis.confに実装しました：

```
# 基本設定
port 6379
bind 0.0.0.0

# 永続化設定
appendonly yes
appendfsync everysec

# RDBスナップショット設定
save 900 1
save 300 10

# データディレクトリ
dir /data

# メモリ管理
maxmemory 256mb
maxmemory-policy allkeys-lru

# TTL設定（HARCAプロジェクトルールに基づく）
# デフォルトTTLは15分
# キャッシュキー命名規則: service:entity:id:action

# その他の最適化
tcp-keepalive 300
```

### 2. Dockerfileの作成

以下の内容でDockerfileを作成しました：

```dockerfile
FROM redis:alpine

COPY redis.conf /usr/local/etc/redis/redis.conf

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD redis-cli ping || exit 1

# 起動コマンド
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
```

### 3. docker-compose.ymlの更新

Redisサービスの定義を以下のように更新しました：

```yaml
redis:
  build:
    context: ./modules/redis
    dockerfile: Dockerfile
  container_name: harca-redis
  restart: unless-stopped
  ports:
    - "${REDIS_PORT:-3710}:6379"
  volumes:
    - redis-data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
  networks:
    - harca-network
```

## 実装の利点

この変更により、以下の利点が得られました：

1. **データの永続性向上**
   - コンテナ再起動時もキャッシュデータが保持される
   - システム障害からの回復が容易になる

2. **プロジェクト要件への準拠**
   - HARCAプロジェクト固有ルールで定義された「L2: Redis (with persistence configuration)」要件を満たす
   - 3層キャッシュ戦略のL2レイヤーが適切に構成される

3. **モジュール構造の一貫性**
   - PostgreSQLと同様にRedisもモジュールとして管理
   - サービス管理の一貫性と理解しやすさの向上

4. **将来の拡張性**
   - 必要に応じて設定を容易に調整可能
   - 高度なRedis機能（RedisJSON、RediSearchなど）の追加が容易

## 検証結果

変更後、以下の検証を行いました：

1. **Docker環境の起動**
   - Redisサービスが新しい設定で正常に起動
   - ヘルスチェックが正常に通過

2. **永続化機能の確認**
   - データを追加した後にコンテナを再起動し、データが保持されていることを確認
   - AOFファイルが正常に生成されていることを確認

3. **HARCAサーバーとの連携**
   - HARCAサーバーがRedisに正常に接続できることを確認
   - キャッシュ機能が期待通りに動作

## 今後の課題と展望

1. **キャッシュ戦略の最適化**
   - 実際の使用パターンに基づくTTL設定の調整
   - キャッシュヒット率のモニタリングと最適化

2. **高度な機能の追加**
   - 必要に応じてRedisモジュール（RedisJSON、RediSearchなど）の追加
   - クラスタリングやレプリケーションの検討（スケーラビリティ向上のため）

3. **モニタリングの強化**
   - Redisのパフォーマンスメトリクスの収集と分析
   - キャッシュ使用状況のダッシュボード作成

## まとめ

Redisサービスのモジュール化と永続化設定の実装により、HARCAシステムのキャッシュ層の信頼性と永続性が向上し、プロジェクト全体の安定性が強化されました。また、プロジェクト構造の一貫性が向上し、将来的な拡張や管理が容易になりました。

この変更は、HARCAプロジェクト固有ルールに準拠したL2キャッシュレイヤーの適切な実装を実現し、3層キャッシュ戦略の効果的な運用を可能にしました。
