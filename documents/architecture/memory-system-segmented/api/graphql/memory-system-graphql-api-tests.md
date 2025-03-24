---
title: "多階層記憶システム GraphQL API テスト"
date: "2025-03-23"
author: "HARCA開発チーム"
version: "1.0.0"
status: "ドラフト"
---

# 多階層記憶システム GraphQL API テスト

*作成日: 2025年3月23日*
*更新日: 2025年3月23日*

## 1. 概要

本ドキュメントでは、HARCA多階層記憶システムのGraphQL APIに対する統合テストについて詳細に記述します。このテストは、GraphQLスキーマ、クエリ、ミューテーションが設計通りに機能し、各記憶モジュールと適切に連携することを確認することを目的としています。

## 2. テスト対象

### 2.1 GraphQL APIコンポーネント

1. **スキーマ定義**
   - 型定義
   - クエリ定義
   - ミューテーション定義

2. **クエリ操作**
   - 短期記憶クエリ
   - 中期記憶クエリ
   - 長期記憶クエリ
   - 検索クエリ

3. **ミューテーション操作**
   - 短期記憶ミューテーション
   - 中期記憶ミューテーション
   - 長期記憶ミューテーション
   - 記憶昇格ミューテーション

## 3. テスト環境

### 3.1 テスト環境構成

- **GraphQLサーバー**: Apollo Server v4.0+
- **データベース**:
  - Redis v7.0+ (短期記憶)
  - PostgreSQL v15.0+ (中期・長期記憶)
  - pgvector拡張 (ベクトル検索)
- **テストツール**:
  - Jest v29.0+
  - Apollo Client Testing
  - GraphQL Playground

### 3.2 テストデータ

- 各記憶層のテストデータ
- 様々なタイプとメタデータを持つ記憶データ
- 複雑なクエリとフラグメント用のデータ

### 3.3 テスト前提条件

- GraphQLサーバーが稼働していること
- データベースが適切に初期化されていること
- テスト用の認証トークンが利用可能であること

## 4. スキーマ検証テスト

### 4.1 型定義検証

#### TC-GQL-SCHEMA-001: 基本型定義の検証

**目的**: GraphQLスキーマの基本型定義が正しいことを確認する

**テストステップ**:
1. GraphQLスキーマの内省クエリを実行する
2. 返されたスキーマ情報を検証する
3. 各型の定義が設計仕様と一致することを確認する

**期待結果**:
- 内省クエリが成功する
- すべての型が正しく定義されている
- フィールド名、型、非null制約が仕様と一致する

#### TC-GQL-SCHEMA-002: 列挙型定義の検証

**目的**: GraphQLスキーマの列挙型定義が正しいことを確認する

**テストステップ**:
1. GraphQLスキーマの内省クエリを実行し、列挙型に焦点を当てる
2. 返された列挙型情報を検証する
3. 各列挙型の値が設計仕様と一致することを確認する

**期待結果**:
- すべての列挙型が正しく定義されている
- 列挙値が仕様と一致する
- 列挙型が適切な場所で使用されている

### 4.2 クエリ定義検証

#### TC-GQL-SCHEMA-003: クエリ定義の検証

**目的**: GraphQLスキーマのクエリ定義が正しいことを確認する

**テストステップ**:
1. GraphQLスキーマの内省クエリを実行し、クエリ型に焦点を当てる
2. 返されたクエリ型情報を検証する
3. 各クエリフィールドの引数と戻り値の型が設計仕様と一致することを確認する

**期待結果**:
- すべてのクエリフィールドが正しく定義されている
- 引数と戻り値の型が仕様と一致する
- 必須引数が適切に定義されている

### 4.3 ミューテーション定義検証

#### TC-GQL-SCHEMA-004: ミューテーション定義の検証

**目的**: GraphQLスキーマのミューテーション定義が正しいことを確認する

**テストステップ**:
1. GraphQLスキーマの内省クエリを実行し、ミューテーション型に焦点を当てる
2. 返されたミューテーション型情報を検証する
3. 各ミューテーションフィールドの引数と戻り値の型が設計仕様と一致することを確認する

**期待結果**:
- すべてのミューテーションフィールドが正しく定義されている
- 引数と戻り値の型が仕様と一致する
- 入力型が適切に定義されている

## 5. 短期記憶クエリテスト

### 5.1 単一短期記憶クエリ

#### TC-GQL-STM-001: IDによる短期記憶クエリ

**目的**: IDを使用して単一の短期記憶を取得できることを確認する

**テストステップ**:
1. テスト用の短期記憶データを作成し、IDを取得する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query GetShortTermMemory($id: ID!) {
     shortTermMemory(id: $id) {
       id
       type
       content
       created
       expires
       metadata {
         importance
         confidence
         tags
       }
     }
   }
   ```
3. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 返されたデータが期待通りの短期記憶データと一致する
- すべての要求されたフィールドが含まれている

#### TC-GQL-STM-002: 存在しないIDによる短期記憶クエリ

**目的**: 存在しないIDを使用した場合のエラー処理を確認する

**テストステップ**:
1. 存在しない短期記憶IDを生成する
2. TC-GQL-STM-001と同じクエリを実行する
3. レスポンスとエラー情報を検証する

**期待結果**:
- クエリは成功するが、データはnullを返す
- エラー情報が含まれ、存在しないIDであることが示されている
- エラーコードが適切である

### 5.2 複数短期記憶クエリ

#### TC-GQL-STM-003: フィルタによる短期記憶リストクエリ

**目的**: フィルタを使用して複数の短期記憶を取得できることを確認する

**テストステップ**:
1. 様々なタイプとコンテキストIDを持つテスト用の短期記憶データを複数作成する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query GetShortTermMemories($contextId: ID, $type: MemoryType, $limit: Int) {
     shortTermMemories(contextId: $contextId, type: $type, limit: $limit) {
       id
       type
       content
       created
     }
   }
   ```
3. 異なるフィルタパラメータでクエリを複数回実行する
4. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 返されたデータが指定されたフィルタ条件に一致する
- 結果数が指定された制限内である
- 結果が作成日時の降順で並んでいる

## 6. 中期記憶クエリテスト

### 6.1 単一中期記憶クエリ

#### TC-GQL-MTM-001: IDによる中期記憶クエリ

**目的**: IDを使用して単一の中期記憶を取得できることを確認する

**テストステップ**:
1. テスト用の中期記憶データを作成し、IDを取得する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query GetMidTermMemory($id: ID!) {
     midTermMemory(id: $id) {
       id
       type
       content
       created
       expires
       metadata {
         importance
         confidence
         tags
         relatedMemories
       }
       accessCount
       lastAccessed
     }
   }
   ```
3. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 返されたデータが期待通りの中期記憶データと一致する
- アクセスカウントが増加している
- 最終アクセス日時が更新されている

### 6.2 関連中期記憶クエリ

#### TC-GQL-MTM-002: 関連メモリを含む中期記憶クエリ

**目的**: 関連メモリ情報を含む中期記憶を取得できることを確認する

**テストステップ**:
1. テスト用の中期記憶データと関連する短期・長期記憶データを作成する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query GetMidTermMemoryWithRelated($id: ID!) {
     midTermMemory(id: $id) {
       id
       type
       content
       metadata {
         relatedMemories
       }
       # 関連記憶の取得
       relatedShortTermMemories: shortTermMemories(limit: 5) @requires(fields: "metadata.relatedMemories") {
         id
         type
         content
       }
       relatedLongTermMemories: longTermMemories(limit: 5) @requires(fields: "metadata.relatedMemories") {
         id
         type
         content
       }
     }
   }
   ```
3. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 中期記憶データと関連する短期・長期記憶データが返される
- 関連記憶のIDが`metadata.relatedMemories`と一致する

## 7. 長期記憶クエリテスト

### 7.1 単一長期記憶クエリ

#### TC-GQL-LTM-001: IDによる長期記憶クエリ

**目的**: IDを使用して単一の長期記憶を取得できることを確認する

**テストステップ**:
1. テスト用の長期記憶データを作成し、IDを取得する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query GetLongTermMemory($id: ID!) {
     longTermMemory(id: $id) {
       id
       type
       content
       created
       updated
       metadata {
         importance
         confidence
         knowledgeArea
         source
         tags
       }
       accessCount
       lastAccessed
     }
   }
   ```
3. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 返されたデータが期待通りの長期記憶データと一致する
- アクセスカウントが増加している
- 最終アクセス日時が更新されている

### 7.2 知識領域別長期記憶クエリ

#### TC-GQL-LTM-002: 知識領域による長期記憶リストクエリ

**目的**: 知識領域によるフィルタリングで長期記憶を取得できることを確認する

**テストステップ**:
1. 様々な知識領域を持つテスト用の長期記憶データを複数作成する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query GetLongTermMemoriesByArea($knowledgeArea: String!, $limit: Int) {
     longTermMemories(knowledgeArea: $knowledgeArea, limit: $limit) {
       id
       type
       content
       metadata {
         knowledgeArea
         tags
       }
     }
   }
   ```
3. 異なる知識領域パラメータでクエリを複数回実行する
4. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 返されたデータが指定された知識領域に一致する
- 結果数が指定された制限内である

## 8. 検索クエリテスト

### 8.1 統合検索クエリ

#### TC-GQL-SEARCH-001: 基本検索クエリ

**目的**: 統合検索機能を使用して複数の記憶層から結果を取得できることを確認する

**テストステップ**:
1. 各記憶層に検索可能なテストデータを作成する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query SearchMemories($query: String!, $limit: Int) {
     searchMemories(query: $query, limit: $limit) {
       results {
         id
         memoryType
         type
         content
         relevance
         created
       }
       stats {
         shortTermCount
         midTermCount
         longTermCount
         totalCount
       }
     }
   }
   ```
3. 異なる検索クエリでクエリを複数回実行する
4. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 返された結果が検索クエリに関連している
- 各記憶層からの結果が含まれている
- 結果が関連性スコアに基づいて順序付けられている
- 統計情報が正確である

### 8.2 フィルタ付き検索クエリ

#### TC-GQL-SEARCH-002: フィルタ付き検索クエリ

**目的**: フィルタを適用した検索機能を確認する

**テストステップ**:
1. 様々なタイプとタグを持つテストデータを作成する
2. 以下のGraphQLクエリを実行する:
   ```graphql
   query FilteredSearchMemories(
     $query: String!,
     $contextId: ID,
     $userId: ID,
     $includeShortTerm: Boolean,
     $includeMidTerm: Boolean,
     $includeLongTerm: Boolean,
     $limit: Int
   ) {
     searchMemories(
       query: $query,
       contextId: $contextId,
       userId: $userId,
       includeShortTerm: $includeShortTerm,
       includeMidTerm: $includeMidTerm,
       includeLongTerm: $includeLongTerm,
       limit: $limit
     ) {
       results {
         id
         memoryType
         type
         content
         relevance
       }
       stats {
         shortTermCount
         midTermCount
         longTermCount
         totalCount
       }
     }
   }
   ```
3. 異なるフィルタ組み合わせでクエリを複数回実行する
4. レスポンスを検証する

**期待結果**:
- クエリが成功する
- 返された結果がフィルタ条件に一致する
- 指定された記憶層からのみ結果が含まれている
- 統計情報がフィルタ条件を反映している

## 9. 短期記憶ミューテーションテスト

### 9.1 短期記憶作成ミューテーション

#### TC-GQL-MUT-STM-001: 短期記憶作成

**目的**: GraphQLミューテーションを使用して短期記憶を作成できることを確認する

**テストステップ**:
1. 以下のGraphQLミューテーションを実行する:
   ```graphql
   mutation CreateShortTermMemory($input: CreateShortTermMemoryInput!) {
     createShortTermMemory(input: $input) {
       id
       created
       expires
     }
   }
   ```
   入力データ:
   ```json
   {
     "input": {
       "type": "OBSERVATION",
       "content": "テスト短期記憶コンテンツ",
       "metadata": {
         "importance": 0.7,
         "confidence": 0.9,
         "workingMemoryType": "CONTEXT",
         "contextId": "ctx-test-id",
         "sessionId": "sess-test-id",
         "tags": ["test", "memory"],
         "source": "test",
         "priority": "MEDIUM"
       },
       "ttl": 3600
     }
   }
   ```
2. レスポンスを検証する
3. 作成された短期記憶が取得可能であることを確認する

**期待結果**:
- ミューテーションが成功する
- 新しい短期記憶のIDと作成日時が返される
- 有効期限が適切に設定されている
- 作成された短期記憶が取得可能であり、入力データと一致する

### 9.2 短期記憶更新ミューテーション

#### TC-GQL-MUT-STM-002: 短期記憶更新

**目的**: GraphQLミューテーションを使用して短期記憶を更新できることを確認する

**テストステップ**:
1. テスト用の短期記憶データを作成し、IDを取得する
2. 以下のGraphQLミューテーションを実行する:
   ```graphql
   mutation UpdateShortTermMemory($id: ID!, $input: UpdateShortTermMemoryInput!) {
     updateShortTermMemory(id: $id, input: $input) {
       id
       updated
     }
   }
   ```
   入力データ:
   ```json
   {
     "id": "取得したID",
     "input": {
       "content": "更新された短期記憶コンテンツ",
       "metadata": {
         "importance": 0.8,
         "tags": ["test", "memory", "updated"]
       }
     }
   }
   ```
3. レスポンスを検証する
4. 更新された短期記憶が取得可能であることを確認する

**期待結果**:
- ミューテーションが成功する
- 更新された短期記憶のIDと更新日時が返される
- 更新された短期記憶が取得可能であり、変更が反映されている
- 更新されていないフィールドは元の値を保持している

## 10. 記憶昇格ミューテーションテスト

### 10.1 短期→中期記憶昇格ミューテーション

#### TC-GQL-MUT-PROMOTE-001: 短期から中期への昇格

**目的**: GraphQLミューテーションを使用して短期記憶を中期記憶に昇格できることを確認する

**テストステップ**:
1. テスト用の短期記憶データを作成し、IDを取得する
2. 以下のGraphQLミューテーションを実行する:
   ```graphql
   mutation PromoteToMidTerm($id: ID!, $options: PromoteToMidTermOptions) {
     promoteToMidTerm(id: $id, options: $options) {
       sourceId
       targetId
       success
     }
   }
   ```
   入力データ:
   ```json
   {
     "id": "取得したID",
     "options": {
       "removeFromShortTerm": false,
       "expirationDays": 30
     }
   }
   ```
3. レスポンスを検証する
4. 中期記憶が作成されていることを確認する
5. 短期記憶の状態を確認する

**期待結果**:
- ミューテーションが成功する
- 元の短期記憶IDと新しい中期記憶IDが返される
- 中期記憶が正しく作成され、短期記憶のデータが適切に変換されている
- 短期記憶は削除オプションに応じて保持または削除されている

### 10.2 中期→長期記憶昇格ミューテーション

#### TC-GQL-MUT-PROMOTE-002: 中期から長期への昇格

**目的**: GraphQLミューテーションを使用して中期記憶を長期記憶に昇格できることを確認する

**テストステップ**:
1. テスト用の中期記憶データを作成し、IDを取得する
2. 以下のGraphQLミューテーションを実行する:
   ```graphql
   mutation PromoteToLongTerm($id: ID!, $options: PromoteToLongTermOptions) {
     promoteToLongTerm(id: $id, options: $options) {
       sourceId
       targetId
       success
     }
   }
   ```
   入力データ:
   ```json
   {
     "id": "取得したID",
     "options": {
       "generalizeContent": true
     }
   }
   ```
3. レスポンスを検証する
4. 長期記憶が作成されていることを確認する

**期待結果**:
- ミューテーションが成功する
- 元の中期記憶IDと新しい長期記憶IDが返される
- 長期記憶が正しく作成され、中期記憶のデータが適切に変換・一般化されている
- 中期記憶と長期記憶の間にリンクが確立されている

## 11. エラー処理テスト

### 11.1 バリデーションエラーテスト

#### TC-GQL-ERROR-001: 無効な入力データ

**目的**: 無効な入力データでのミューテーション時のエラー処理を確認する

**テストステップ**:
1. 必須フィールドが欠けている入力データを準備する
2. 短期記憶作成ミューテーションを実行する
3. レスポンスとエラー情報を検証する

**期待結果**:
- ミューテーションは失敗する
- エラー情報が含まれ、どのフィールドが無効かが示されている
- エラーコードが適切である

### 11.2 認証エラーテスト

#### TC-GQL-ERROR-002: 認証エラー

**目的**: 認証エラー時のエラー処理を確認する

**テストステップ**:
1. 無効な認証トークンを準備する
2. 任意のクエリまたはミューテーションを実行する
3. レスポンスとエラー情報を検証する

**期待結果**:
- 操作は失敗する
- 認証エラーが返される
- エラーコードが適切である

## 12. パフォーマンステスト

### 12.1 複雑なクエリのパフォーマンス

#### TC-GQL-PERF-001: 複雑なクエリのパフォーマンス

**目的**: 複雑なクエリのパフォーマンスを評価する

**テストステップ**:
1. 大量のテストデータを準備する
2. ネストされたフィールドと複数のフィルタを含む複雑なクエリを作成する
3. クエリを実行し、応答時間を測定する
4. クエリプランを分析する

**期待結果**:
- クエリが成功する
- 応答時間が許容範囲内である（500ms以下）
- クエリプランが効率的である

### 12.2 バッチ処理のパフォーマンス

#### TC-GQL-PERF-002: DataLoaderを使用したバッチ処理

**目的**: DataLoaderを使用したバッチ処理の効率性を確認する

**テストステップ**:
1. 関連する複数のエンティティを持つテストデータを準備する
2. 複数のエンティティを取得するクエリを作成する
3. クエリを実行し、データベースクエリの数を監視する
4. DataLoaderの有無でパフォーマンスを比較する

**期待結果**:
- DataLoaderを使用した場合、データベースクエリの数が削減される
- N+1問題が発生していない
- 応答時間が改善される

## 13. テスト実行計画

### 13.1 テスト実行順序

1. **スキーマ検証テスト**
   - 型定義検証
   - クエリ定義検証
   - ミューテーション定義検証

2. **クエリテスト**
   - 短期記憶クエリ
   - 中期記憶クエリ
   - 長期記憶クエリ
   - 検索クエリ

3. **ミューテーションテスト**
   - 短期記憶ミューテーション
   - 記憶昇格ミューテーション

4. **エラー処理テスト**
   - バリデーションエラー
   - 認証エラー

5. **パフォーマンステスト**
   - 複雑なクエリ
   - バッチ処理

### 13.2 テスト自動化

1. **Jestテストスイート**
   - Apollo Client Testingを使用したテスト
   - モックリゾルバーの活用

2. **GraphQL Playground**
   - 手動テスト用のクエリコレクション
   - 変数テンプレートの準備

3. **CI/CD統合**
   - GitHubアクションでの自動テスト
   - スキーマ変更の検証

## 14. 結論

GraphQL APIテストは、HARCA多階層記憶システムのGraphQL APIが設計通りに機能し、各記憶モジュールと適切に連携することを確認するための重要なステップです。本ドキュメントで定義されたテストケースと実行計画に従ってテストを実施することで、APIの信頼性と一貫性を確保します。

GraphQLの柔軟なクエリ機能と型安全性を活かした効率的なデータアクセスが実現できているかを検証し、システム全体の品質向上に貢献します。テスト結果は、APIの品質評価と次のフェーズへの移行判断の基礎となります。
