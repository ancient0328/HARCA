# Redis PubSubトラブルシューティングレポート

## 概要

Redis PubSubを使用した分散キャッシュ無効化機能において、無限ループとキャッシュキー生成の不一致という2つの重大な問題を特定し、解決しました。このドキュメントでは、問題の詳細な分析、解決策、および学んだ教訓を記録します。

## 問題1: キャッシュキー生成の不一致

### 問題の詳細
EmbeddingCacheクラスとRedisCacheManagerクラスで異なるハッシュアルゴリズムを使用してキャッシュキーを生成していました：
- EmbeddingCache: SHA-256ハッシュ（generateKeyメソッド）
- RedisCacheManager: MD5ハッシュ（_getCacheKeyメソッド）

これにより、同じテキストとモデル名に対して異なるキーが生成され、キャッシュの無効化が正しく機能していませんでした。

### 問題の影響
- 同じデータに対して複数のキャッシュエントリが作成される
- キャッシュ無効化イベントが正しく伝播されない
- メモリとストレージの無駄な使用

### 解決策
1. EmbeddingCacheのgetメソッドを修正：
   ```javascript
   // 修正前
   const redisResult = await this.redisCache.get(key);
   
   // 修正後
   const redisResult = await this.redisCache.get(text, modelName);
   ```

2. EmbeddingCacheのdeleteメソッドを修正：
   ```javascript
   // 修正前
   await this.redisCache.delete(key);
   this.redisCache.publishInvalidationEvent(key, modelName);
   
   // 修正後
   await this.redisCache.delete(text, modelName);
   this.redisCache.publishInvalidationEvent(text, modelName);
   ```

3. RedisCacheManagerのpublishInvalidationEventメソッドを修正：
   ```javascript
   // 修正前
   publishInvalidationEvent(key, modelName) {
     this._publishMessage('invalidate', key, { modelName });
   }
   
   // 修正後
   publishInvalidationEvent(text, modelName) {
     const key = this._getCacheKey(text, modelName);
     this._publishMessage('invalidate', key, { modelName });
   }
   ```

## 問題2: clearModelCacheメソッドの無限ループと伝播の問題

### 問題の詳細
テストが `モデル test-model-1 のキャッシュをクリアします...` から進まなくなる問題を特定しました。`clearModelCache`メソッドに複数の問題がありました：

1. **無限ループの問題**：
   - EmbeddingCacheのclearModelCacheメソッドがRedisCacheManagerのclearModelCacheメソッドを呼び出す
   - RedisCacheManagerが'clearModel'イベントを発行する
   - EmbeddingCacheの'clearModel'イベントリスナーが再びclearModelCacheメソッドを呼び出す
   - これにより無限ループが発生する

2. **ファイルキャッシュの処理問題**：
   - ファイル名のパターンマッチングが正しく機能していない
   - 実際のファイル名パターンと一致していない正規表現を使用

3. **Redis PubSub伝播の問題**：
   - RedisCacheManagerのclearModelCacheメソッドでのキー検索が適切でない
   - モデル名に基づくキー検索が正しく行われていない

### 問題の影響
- テストが無限ループに陥り、完了しない
- CPU使用率の急上昇
- Redis接続の過負荷
- メモリリーク

### 解決策

#### 1. 無限ループの解決
EmbeddingCacheのclearModelCacheメソッドを修正：
```javascript
// 修正前
if (this.config.enableRedisCache && this.redisCache && sourceInstanceId !== this.config.instanceId) {
  await this.redisCache.clearModelCache(modelName, this.config.instanceId);
}

// 修正後
if (this.config.enableRedisCache && this.redisCache && sourceInstanceId !== this.instanceId) {
  await this.redisCache.clearModelCache(modelName, this.instanceId);
}
```

イベントリスナーでの自分自身が発行したイベントを無視する処理を追加：
```javascript
// 送信元のインスタンスIDを確認
if (sourceInstance === this.instanceId) {
  console.log('自分自身が発行したイベントのため、処理をスキップします');
  return;
}
```

#### 2. ファイルキャッシュの処理修正
ファイル内容を読み取ってmodelNameをチェックするように変更：
```javascript
// ファイル内容を読み取ってmodelNameをチェックする
for (const file of files) {
  const filePath = path.join(this.config.cacheDir, file);
  try {
    // ファイルの内容を読み取る
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const cacheEntry = JSON.parse(fileContent);
    
    // モデル名が一致するかチェック
    if (cacheEntry && cacheEntry.modelName === modelName) {
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  } catch (fileError) {
    console.error(`ファイル ${file} の処理中にエラーが発生しました:`, fileError);
  }
}
```

#### 3. Redis PubSub伝播の修正
RedisCacheManagerのclearModelCacheメソッドを修正：
```javascript
// 修正前
const keys = await this.redis.keys(`${this.config.keyPrefix}:*`);

// 修正後
const keys = await this.redis.keys(`${this.config.keyPrefix}*`);
```

## テスト結果

修正後、テストが正常に完了し、以下の点が確認されました：
- キャッシュインスタンスが正常に初期化される
- データの設定と取得が正常に機能する
- モデルキャッシュのクリア処理が正しく動作し、無限ループが発生しない
- 自分自身が発行したイベントは適切にスキップされる

## 学んだ教訓

1. **分散システムの設計における注意点**
   - イベント伝播時の無限ループを防ぐためのソースIDチェックの重要性
   - 同一データに対する一貫したキー生成の必要性

2. **テスト設計の改善点**
   - タイムアウト設定の重要性（無限ループの早期検出）
   - 詳細なログ出力によるデバッグの容易化

3. **コード品質の向上策**
   - インスタンスIDの参照を統一（config.instanceId vs instanceId）
   - ファイル操作時の適切なエラーハンドリング

4. **将来の改善案**
   - ユニットテストの追加（特にエッジケースのテスト）
   - パフォーマンスモニタリングの強化
   - 自動リカバリーメカニズムの実装

## 結論

Redis PubSubを使用した分散キャッシュ無効化の仕組みが正常に動作するようになり、複数のインスタンス間でキャッシュの一貫性が維持されるようになりました。このトラブルシューティングの経験は、分散システムにおけるイベント伝播の設計と実装に関する貴重な知見を提供しました。
