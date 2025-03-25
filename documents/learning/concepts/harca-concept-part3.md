# ハルカ（HARCA）プロジェクト：技術的実装の詳細

## システムアーキテクチャ

### 全体構成

ハルカは「コンテナ化モジュラーモノリス」アーキテクチャを採用しています。これは各コンポーネントがモジュール化されつつも、緊密に統合された形で動作するように設計されています：

```
┌─────────────────────────────────────────────────────────────┐
│                        HARCA システム                         │
├───────────────┬────────────────────────┬───────────────────┤
│  コア機能      │   メモリ・思考システム   │  IDE連携          │
│  - MCPサーバー │   - メモリコーパス      │  - エディタプラグイン│
│  - ベクトルDB  │   - Sequential Thinking│  - コード分析      │
│  - キャッシュ   │   - 知識ベース         │  - 提案エンジン    │
├───────────────┴────────────────────────┴───────────────────┤
│              LLMインターフェース層                      │
├─────────────────────────────────────────────────────────────┤
│  - プロンプト構築  - コンテキスト管理  - 応答パース          │
├─────────────────────────────────────────────────────────────┤
│                    LLM エンジン                              │
│  (API接続または可能な場合はローカルモデル)                     │
└─────────────────────────────────────────────────────────────┘
```

各層は明確に分離されており、それぞれが独立して開発・改善できるようになっています。特にLLMインターフェース層は、異なるLLMエンジン（API接続またはローカルモデル）に対応できるよう抽象化されています。

### Docker環境構成

ハルカはDocker Composeを使用して、以下のコンテナで構成されています：

```yaml
services:
  harca-server:
    build: ./server
    ports:
      - "3700:3700"
    depends_on:
      - redis
      - postgres
    environment:
      - REDIS_URL=redis://redis:6379
      - POSTGRES_CONNECTION_STRING=postgresql://postgres:postgres@postgres:5432/harca
      - LLM_API_KEY=${LLM_API_KEY}
      
  postgres:
    image: ankane/pgvector
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_USER=postgres
      - POSTGRES_DB=harca
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./init-scripts:/docker-entrypoint-initdb.d
      
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      
  sequential-thinking:
    build: ./sequential-thinking
    ports:
      - "3701:3701"
    depends_on:
      - redis
      - postgres
      
  memory-corpus:
    build: ./memory-corpus
    ports:
      - "3702:3702"
    depends_on:
      - postgres
    environment:
      - POSTGRES_CONNECTION_STRING=postgresql://postgres:postgres@postgres:5432/harca

volumes:
  pg_data:
  redis_data:
```

このDocker Compose設定により、各コンポーネントが独立したコンテナで実行されながらも、相互に通信できる環境が構築されます。ポート番号はHARCA関連サービス用に3700番台を使用する規約を採用しています。

## 階層的記憶システムの実装

### データモデル

ハルカのメモリシステムは、以下のデータモデルに基づいています：

#### 短期記憶（Redis）

Redis内のデータ構造：

```
// キーの形式: user:{userId}:context:current
{
  "conversation": [{
    "role": "user",
    "content": "...",
    "timestamp": 1621500000
  }, {
    "role": "assistant",
    "content": "...",
    "timestamp": 1621500010
  }],
  "activeProject": "project-xyz",
  "activeFiles": ["file1.js", "file2.js"],
  "recentCommands": ["git status", "npm install"],
  "ttl": 3600  // 秒単位のTTL
}

// キーの形式: user:{userId}:cache:{cacheKey}
{
  "content": "キャッシュされた内容",
  "timestamp": 1621500000,
  "ttl": 86400  // 秒単位のTTL
}
```

#### 中期記憶（PostgreSQL）

```sql
CREATE TABLE conversation_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255),
  session_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  importance_score FLOAT DEFAULT 0.5,
  embedding vector(1536),  -- OpenAI埋め込みの場合
  metadata JSONB
);

CREATE TABLE project_context (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  project_id VARCHAR(255) NOT NULL,
  context_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 1,
  importance_score FLOAT DEFAULT 0.5,
  embedding vector(1536),
  metadata JSONB
);
```

#### 長期記憶（PostgreSQL + pgvector）

```sql
CREATE TABLE memory_corpus (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  memory_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_accessed TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 1,
  importance_score FLOAT NOT NULL,
  shared BOOLEAN DEFAULT FALSE,
  embedding vector(1536) NOT NULL,
  metadata JSONB
);

CREATE TABLE knowledge_base (
  id SERIAL PRIMARY KEY,
  knowledge_domain VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  source VARCHAR(255),
  confidence_score FLOAT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  embedding vector(1536) NOT NULL,
  metadata JSONB
);

-- インデックス作成（高速な類似性検索のため）
CREATE INDEX memory_corpus_embedding_idx ON memory_corpus USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX knowledge_base_embedding_idx ON knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 記憶の重要度評価アルゴリズム

記憶の重要度は以下の要素を組み合わせて評価されます：

```javascript
function calculateImportanceScore(memory) {
  // 基本スコア（0.1-1.0）
  let score = 0.5;
  
  // 明示的フィードバック（ユーザーのフラグや反応）
  if (memory.userMarkedImportant) {
    score += 0.3;
  }
  
  // 暗黙的フィードバック（参照頻度）
  score += Math.min(0.3, (memory.accessCount / 10) * 0.3);
  
  // 時間減衰係数（古い記憶は徐々に重要度が下がる）
  const daysSinceCreation = daysBetween(new Date(), memory.createdAt);
  const decayFactor = Math.exp(-0.05 * daysSinceCreation);
  
  // 最終アクセスからの時間（最近アクセスされた記憶は重要）
  const daysSinceLastAccess = daysBetween(new Date(), memory.lastAccessed);
  const recencyFactor = Math.exp(-0.1 * daysSinceLastAccess);
  
  // コンテキスト関連性（現在のプロジェクトに関連する記憶は重要）
  if (memory.projectId === currentProjectId) {
    score += 0.2;
  }
  
  // 他の記憶との関連性
  score += 0.1 * memory.relationCount / 5;
  
  // 時間要素を適用
  score = score * (0.3 + 0.7 * decayFactor * recencyFactor);
  
  // スコアの範囲を0-1に正規化
  return Math.max(0, Math.min(1, score));
}
```

このアルゴリズムは、単純な時間経過による減衰だけでなく、記憶の使用パターン、ユーザーフィードバック、現在のコンテキストとの関連性などの複数要素を考慮しています。これにより、人間の記憶システムのように、重要な情報は長期間保持され、そうでない情報は徐々に忘却されていきます。

### 記憶の検索と活性化

現在のコンテキストに関連する記憶を取得するプロセス：

```javascript
async function retrieveRelevantMemories(currentContext, userId, options = {}) {
  // 現在のコンテキストからクエリ埋め込みを生成
  const queryEmbedding = await generateEmbedding(currentContext);
  
  // デフォルトオプション
  const defaults = {
    maxResults: 10,
    minSimilarity: 0.7,
    includeShortTerm: true,
    includeMediumTerm: true,
    includeLongTerm: true,
    projectFilter: null
  };
  
  const settings = { ...defaults, ...options };
  const allMemories = [];
  
  // 短期記憶から検索（Redis）
  if (settings.includeShortTerm) {
    const shortTermMemories = await retrieveFromShortTermMemory(userId);
    allMemories.push(...shortTermMemories);
  }
  
  // 中期記憶から検索（PostgreSQL）
  if (settings.includeMediumTerm) {
    const mediumTermQuery = buildMediumTermQuery(userId, settings.projectFilter);
    const mediumTermMemories = await db.query(mediumTermQuery);
    
    // 埋め込みベクトルの類似性計算
    const filteredMediumTerm = mediumTermMemories.filter(memory => {
      return calculateCosineSimilarity(queryEmbedding, memory.embedding) >= settings.minSimilarity;
    });
    
    allMemories.push(...filteredMediumTerm);
  }
  
  // 長期記憶から検索（PostgreSQL + pgvector）
  if (settings.includeLongTerm) {
    const longTermQuery = `
      SELECT *, 1 - (embedding <=> $1) as similarity
      FROM memory_corpus
      WHERE user_id = $2
        ${settings.projectFilter ? "AND metadata->>'projectId' = $3" : ""}
      ORDER BY embedding <=> $1
      LIMIT $4
    `;
    
    const queryParams = [
      queryEmbedding,
      userId,
      ...(settings.projectFilter ? [settings.projectFilter] : []),
      settings.maxResults
    ];
    
    const longTermMemories = await db.query(longTermQuery, queryParams);
    const filteredLongTerm = longTermMemories.filter(memory => 
      memory.similarity >= settings.minSimilarity
    );
    
    allMemories.push(...filteredLongTerm);
  }
  
  // 記憶の結合と重複排除
  const uniqueMemories = removeDuplicates(allMemories);
  
  // 重要度でソート
  const sortedMemories = uniqueMemories.sort((a, b) => {
    // 類似性と重要度のバランスを取る
    const scoreA = (a.similarity || 0.7) * 0.7 + (a.importance_score || 0.5) * 0.3;
    const scoreB = (b.similarity || 0.7) * 0.7 + (b.importance_score || 0.5) * 0.3;
    return scoreB - scoreA;
  });
  
  // アクセス記録の更新（非同期）
  updateAccessStats(sortedMemories.map(m => m.id)).catch(console.error);
  
  // 上位の結果を返す
  return sortedMemories.slice(0, settings.maxResults);
}
```

この関数は、短期・中期・長期の各記憶層から関連情報を検索し、それらを統合して最も関連性の高い記憶を返します。また、記憶へのアクセスを記録することで、重要度評価アルゴリズムのための使用統計が更新されます。

### 記憶の移行メカニズム

記憶が階層間を移動するプロセス：

```javascript
async function memoryMigrationJob() {
  console.log('メモリ移行ジョブを開始...');
  
  try {
    // 短期→中期への移行候補を特定
    const shortTermCandidates = await identifyShortToMediumCandidates();
    for (const memory of shortTermCandidates) {
      await migrateShortToMedium(memory);
      console.log(`短期→中期移行: ${memory.id}`);
    }
    
    // 中期→長期への移行候補を特定
    const mediumTermCandidates = await identifyMediumToLongCandidates();
    for (const memory of mediumTermCandidates) {
      await migrateMediumToLong(memory);
      console.log(`中期→長期移行: ${memory.id}`);
    }
    
    // 長期記憶の重要度再評価
    const longTermMemories = await getLongTermMemoriesForReassessment();
    for (const memory of longTermMemories) {
      const newScore = calculateImportanceScore(memory);
      if (newScore < 0.2) {
        // 忘却候補
        await markForForgetting(memory.id);
        console.log(`忘却候補マーク: ${memory.id}`);
      } else {
        // 重要度更新
        await updateImportanceScore(memory.id, newScore);
      }
    }
    
    // 忘却処理（低重要度で長期間アクセスされていない記憶）
    const forgettingCandidates = await getForgettingCandidates();
    for (const memory of forgettingCandidates) {
      await forgetMemory(memory.id);
      console.log(`記憶を忘却: ${memory.id}`);
    }
    
    console.log('メモリ移行ジョブ完了');
  } catch (error) {
    console.error('メモリ移行処理中にエラー:', error);
  }
}

// 移行条件の評価関数
function shouldMigrateToLongTerm(memory) {
  // 重要度が高い
  const isImportant = memory.importance_score >= 0.7;
  
  // 繰り返しアクセスされている
  const isFrequentlyAccessed = memory.access_count >= 5;
  
  // 一定期間が経過している
  const isOldEnough = daysBetween(new Date(), memory.created_at) >= 14;
  
  // 明示的に重要とマークされている
  const isExplicitlyMarked = memory.metadata && memory.metadata.explicitly_marked;
  
  // 条件の組み合わせ
  return (isImportant && isOldEnough) || 
         (isFrequentlyAccessed && isOldEnough) || 
         isExplicitlyMarked;
}
```

このバックグラウンドジョブは定期的に実行され、重要度、アクセス頻度、経過時間などの基準に基づいて記憶の階層間移動を管理します。これにより、人間の脳における海馬から皮質への記憶固定化プロセスに類似した動的な記憶管理が実現されます。

## Sequential Thinkingの実装

### プロンプト設計

Sequential Thinkingモジュールの核心は、段階的思考プロセスを促すプロンプト設計にあります：

```javascript
function buildSequentialThinkingPrompt(query, context, options = {}) {
  const defaults = {
    steps: 5,
    includeReasoning: true,
    includeCritique: true,
    domainSpecific: null
  };
  
  const settings = { ...defaults, ...options };
  
  // 基本システムプロンプト
  let systemPrompt = `
  # 思考プロセス指示
  以下の問題に取り組む際、段階的な思考プロセスに従って検討してください。
  各ステップを明示的に示し、推論を丁寧に展開してください。
  
  ## プロセスステップ:
  1. 問題の分析と理解: 与えられた問題を分解し、本質的な課題を特定する
  2. 関連する情報の特定: 提供されたコンテキストから関連情報を抽出する
  3. 可能な解決策の検討: 複数の選択肢を挙げて検討する
  4. 分析と評価: 各選択肢の長所と短所を分析する
  5. 結論と推奨: 最適な解決策を選び、理由を説明する
  `;
  
  // ドメイン固有のガイダンスを追加（オプション）
  if (settings.domainSpecific === 'programming') {
    systemPrompt += `
    ## プログラミング固有のガイダンス:
    - コードの読みやすさとメンテナンス性を優先する
    - エッジケースと例外処理を考慮する
    - パフォーマンスとスケーラビリティの影響を評価する
    - 既存のコードベースとの一貫性を維持する
    `;
  } else if (settings.domainSpecific === 'architecture') {
    systemPrompt += `
    ## アーキテクチャ設計固有のガイダンス:
    - システムの責任範囲を明確に定義する
    - コンポーネント間の依存関係を最小化する
    - スケーラビリティと拡張性を考慮する
    - セキュリティとパフォーマンスの要件を評価する
    `;
  }
  
  // 自己批評ステップを追加（オプション）
  if (settings.includeCritique) {
    systemPrompt += `
    ## 自己批評:
    推論プロセスの最後に、あなたの分析の潜在的な弱点、見落としている可能性のある重要な要素、
    および代替的な視点を検討してください。
    `;
  }
  
  // コンテキスト情報の追加
  let fullPrompt = `
  ${systemPrompt}
  
  # コンテキスト情報
  ${context}
  
  # ユーザークエリ
  ${query}
  `;
  
  return fullPrompt;
}
```

このプロンプト設計は、単に回答を生成するのではなく、問題解決への段階的アプローチを促すよう設計されています。これにより、思考プロセスが透明化され、より構造化された問題解決が可能になります。

### 思考プロセスの解析と保存

Sequential Thinkingの結果を解析し、将来の参照のために保存するプロセス：

```javascript
async function processSequentialThinkingResult(result, userId, query, projectId) {
  // 思考ステップの抽出
  const stepsPattern = /(\d+\.\s+[^:]+):\s+([^\n]+(?:\n(?!\d+\.\s+)[^\n]+)*)/g;
  const matches = Array.from(result.matchAll(stepsPattern));
  
  const steps = matches.map(match => ({
    stepTitle: match[1].trim(),
    content: match[2].trim()
  }));
  
  // 結論の抽出
  const conclusionPattern = /(?:結論|まとめ|推奨|結論と推奨|Conclusion)[:：]?\s*([^\n]+(?:\n[^\n]+)*)/i;
  const conclusionMatch = result.match(conclusionPattern);
  const conclusion = conclusionMatch ? conclusionMatch[1].trim() : null;
  
  // 自己批評の抽出
  const critiquePattern = /(?:自己批評|critique|limitations|弱点|考慮点)[:：]?\s*([^\n]+(?:\n[^\n]+)*)/i;
  const critiqueMatch = result.match(critiquePattern);
  const critique = critiqueMatch ? critiqueMatch[1].trim() : null;
  
  // 構造化データの作成
  const structuredThinking = {
    query,
    timestamp: new Date(),
    userId,
    projectId,
    steps,
    conclusion,
    critique,
    fullResponse: result
  };
  
  // 埋め込みベクトルの生成
  const queryEmbedding = await generateEmbedding(query);
  const contentEmbedding = await generateEmbedding(result);
  
  // データベースに保存
  await db.query(`
    INSERT INTO sequential_thinking_results
      (user_id, project_id, query, result, structured_data, query_embedding, content_embedding, created_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `, [
    userId,
    projectId,
    query,
    result,
    JSON.stringify(structuredThinking),
    queryEmbedding,
    contentEmbedding,
    new Date()
  ]);
  
  // 関連する記憶へのリンク作成
  await createMemoryReferences(structuredThinking, userId, projectId);
  
  return structuredThinking;
}
```

この関数は、LLMからの生のテキスト応答を解析して構造化データに変換し、将来の参照のために保存します。また、関連する記憶へのリンクを作成することで、思考プロセスとメモリコーパスの統合を促進します。

### 推論の品質評価

Sequential Thinkingの結果を評価し、必要に応じて改善するメカニズム：

```javascript
async function evaluateAndEnhanceReasoning(reasoningResult, query, context) {
  // 評価基準に基づくスコア計算
  const evaluation = {
    completeness: evaluateCompleteness(reasoningResult, query),
    logicalCoherence: evaluateLogicalCoherence(reasoningResult),
    evidenceUse: evaluateEvidenceUse(reasoningResult, context),
    alternativesConsideration: evaluateAlternativesConsideration(reasoningResult),
    biasAwareness: evaluateBiasAwareness(reasoningResult)
  };
  
  // 総合スコアの計算
  const totalScore = Object.values(evaluation).reduce((sum, score) => sum + score, 0) / 
    Object.values(evaluation).length;
  
  // 改善が必要かどうかの判断
  if (totalScore < 0.7) {
    // 最も低いスコアの領域を特定
    const weakestAreas = Object.entries(evaluation)
      .sort(([, scoreA], [, scoreB]) => scoreA - scoreB)
      .slice(0, 2)
      .map(([area]) => area);
    
    // 改善プロンプトの作成
    const enhancementPrompt = `
      元のクエリ: ${query}
      
      あなたの思考プロセスについて、以下の点での改善が必要です:
      ${weakestAreas.map(area => `- ${translateEvaluationArea(area)}`).join('\n')}
      
      元の思考プロセス:
      ${reasoningResult}
      
      上記の思考プロセスを改善し、特に指摘された点に注意して再構築してください。
    `;
    
    // 思考プロセスの改善
    const enhancedReasoning = await callLLM(enhancementPrompt);
    
    return {
      original: reasoningResult,
      enhanced: enhancedReasoning,
      evaluation,
      totalScore,
      wasEnhanced: true
    };
  }
  
  // 十分な品質の場合はそのまま返す
  return {
    original: reasoningResult,
    enhanced: null,
    evaluation,
    totalScore,
    wasEnhanced: false
  };
}

// 評価領域の日本語訳
function translateEvaluationArea(area) {
  const translations = {
    completeness: "包括性：すべての重要な側面が考慮されているか",
    logicalCoherence: "論理的一貫性：推論の流れに飛躍や矛盾がないか",
    evidenceUse: "根拠の使用：提供されたコンテキストや情報が適切に活用されているか",
    alternativesConsideration: "代替案の検討：複数の選択肢や視点が検討されているか",
    biasAwareness: "バイアスへの認識：自身の推論の限界や偏りへの認識があるか"
  };
  
  return translations[area] || area;
}
```

この機能により、思考プロセスの品質を評価し、必要に応じて改善するフィードバックループが実現されます。これはメタ認知能力の一側面を模倣しており、自己の思考を監視・評価・修正する能力を実装しています。

## MCPプロトコル連携

### MCPサーバー実装

HARCAはMachine Comprehension Protocol (MCP)に準拠したサーバーを実装しています。これにより、Windsurf、VS Code、Cursorなどの様々なIDEと連携できます：

```javascript
class MCPServer {
  constructor(options = {}) {
    this.port = options.port || 3700;
    this.server = null;
    this.tools = new Map();
    this.sequentialThinkingService = options.sequentialThinkingService;
    this.memoryCorpusService = options.memoryCorpusService;
    this.llmService = options.llmService;
  }
  
  async start() {
    this.server = rpc.createServer({
      // JSONRPCサーバー設定
      version: 2.0,
      transport: {
        type: 'http',
        port: this.port
      }
    });
    
    // 初期化メソッドの登録
    this.server.addMethod('initialize', this.handleInitialize.bind(this));
    
    // 通知メソッドの登録
    this.server.addMethod('notification', this.handleNotification.bind(this));
    
    // ツール実行メソッドの登録
    this.server.addMethod('executeFunction', this.executeFunction.bind(this));
    
    // HARCAツールの登録
    this.registerDefaultTools();
    
    console.log(`MCPサーバーを起動しました。ポート: ${this.port}`);
    return this.server;
  }
  
  registerDefaultTools() {
    // コード分析ツール
    this.registerTool('analyzeCode', async (params) => {
      const { code, language, filename } = params;
      // コンテキスト情報の取得
      const context = await this.memoryCorpusService.getRelevantMemories({
        content: code,
        projectId: this.currentProject,
        userId: this.currentUser
      });
      
      // Sequential Thinkingによる分析
      return this.sequentialThinkingService.analyze({
        query: `以下のコードを分析してください:\n\n${code}`,
        context: context,
        domainSpecific: 'programming'
      });
    });
    
    // ドキュメント生成ツール
    this.registerTool('generateDocumentation', async (params) => {
      const { code, language, style } = params;
      return this.sequentialThinkingService.analyze({
        query: `以下のコードに対するドキュメントを生成してください（スタイル: ${style || 'standard'}）:\n\n${code}`,
        domainSpecific: 'documentation'
      });
    });
    
    // リファクタリング提案ツール
    this.registerTool('suggestRefactoring', async (params) => {
      const { code, language, goals } = params;
      const projectContext = await this.memoryCorpusService.getProjectStyleGuide(this.currentProject);
      return this.sequentialThinkingService.analyze({
        query: `以下のコードに対するリファクタリングを提案してください（目標: ${goals || '読みやすさと保守性の向上'}）:\n\n${code}`,
        context: projectContext,
        domainSpecific: 'refactoring'
      });
    });
    
    // その他のツール...
  }
  
  async handleInitialize(params) {
    const { capabilities, clientInfo } = params;
    this.currentUser = clientInfo.user || 'default';
    this.currentProject = clientInfo.project || 'default';
    
    // ユーザーコンテキストの初期化
    await this.memoryCorpusService.initUserContext(this.currentUser, this.currentProject);
    
    // 応答を返す
    return {
      serverInfo: {
        name: 'HARCA MCP Server',
        version: '1.0.0'
      },
      capabilities: {
        tools: Array.from(this.tools.keys()).map(name => ({
          name,
          description: this.tools.get(name).description
        }))
      }
    };
  }
  
  // その他のメソッド実装...
}
```

このMCPサーバー実装により、HARCAはIDEからのリクエストを受け付け、様々なコード分析や提案機能を提供できます。各ツールはSequential Thinkingとメモリコーパスサービスを活用して、コンテキストに応じた高品質な応答を生成します。

### Windsurfとの連携

特にWindsurf Cascadeとの連携では、以下のような設定ファイルを自動生成します：

```javascript
async function updateWindsurfConfig(serverPath, connectionString) {
  const configDir = path.join(os.homedir(), '.codeium', 'windsurf');
  const configPath = path.join(configDir, 'mcp_config.json');
  
  // 設定ディレクトリが存在しない場合は作成
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  // 既存設定の読み込み（存在する場合）
  let config = { mcpServers: {} };
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configContent);
    } catch (error) {
      console.warn('Windsurfの設定ファイルの解析に失敗しました。新しい設定を作成します:', error);
    }
  }
  
  // HARCA MCPサーバーの設定を追加/更新
  config.mcpServers.harca = {
    command: "node",
    args: [serverPath],
    env: {
      SUPABASE_CONNECTION_STRING: connectionString
    }
  };
  
  // 設定を保存
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  console.log(`Windsurf設定を更新しました: ${configPath}`);
  
  return config;
}
```

これにより、Windsurfが起動時にHARCA MCPサーバーを認識し、利用できるようになります。

## LLMインターフェース

### 複数LLMプロバイダー対応

HARCAは様々なLLMプロバイダーと連携できるよう、抽象化されたインターフェースを実装しています：

```javascript
// LLMサービスの抽象インターフェース
class LLMService {
  constructor(config) {
    this.config = config;
    this.providers = new Map();
    this.defaultProvider = config.defaultProvider || 'openai';
    
    // 利用可能なプロバイダーの登録
    if (config.openai) {
      this.registerProvider('openai', new OpenAIProvider(config.openai));
    }
    if (config.anthropic) {
      this.registerProvider('anthropic', new AnthropicProvider(config.anthropic));
    }
    if (config.localLLM) {
      this.registerProvider('localLLM', new LocalLLMProvider(config.localLLM));
    }
    // その他のプロバイダー...
  }
  
  registerProvider(name, provider) {
    this.providers.set(name, provider);
  }
  
  async generateText(prompt, options = {}) {
    const providerName = options.provider || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider) {
      throw new Error(`LLMプロバイダー '${providerName}' が登録されていません`);
    }
    
    try {
      return await provider.generateText(prompt, options);
    } catch (error) {
      console.error(`プロバイダー '${providerName}' でのテキスト生成中にエラー:`, error);
      
      // フォールバックプロバイダーが指定されている場合は使用
      if (options.fallbackProvider && options.fallbackProvider !== providerName) {
        console.log(`フォールバックプロバイダー '${options.fallbackProvider}' を使用します`);
        return this.generateText(prompt, {
          ...options,
          provider: options.fallbackProvider,
          fallbackProvider: null  // 無限ループ防止
        });
      }
      
      throw error;
    }
  }
  
  async generateEmbedding(text, options = {}) {
    const providerName = options.embeddingProvider || this.config.embeddingProvider || this.defaultProvider;
    const provider = this.providers.get(providerName);
    
    if (!provider || !provider.generateEmbedding) {
      throw new Error(`埋め込み生成に対応したプロバイダー '${providerName}' が利用できません`);
    }
    
    return provider.generateEmbedding(text, options);
  }
}

// OpenAIプロバイダーの実装例
class OpenAIProvider {
  constructor(config) {
    this.config = config;
    this.client = new OpenAI(config.apiKey);
  }
  
  async generateText(prompt, options = {}) {
    const modelName = options.model || this.config.defaultModel || 'gpt-4';
    
    const response = await this.client.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: options.systemPrompt || this.config.defaultSystemPrompt || '' },
        { role: 'user', content: prompt }
      ],
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2000,
      top_p: options.topP ?? this.config.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? this.config.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? this.config.presencePenalty ?? 0
    });
    
    return response.choices[0].message.content;
  }
  
  async generateEmbedding(text, options = {}) {
    const modelName = options.embeddingModel || this.config.embeddingModel || 'text-embedding-ada-002';
    
    const response = await this.client.embeddings.create({
      model: modelName,
      input: text
    });
    
    return response.data[0].embedding;
  }
}

// ローカルLLMプロバイダーの実装例
class LocalLLMProvider {
  constructor(config) {
    this.config = config;
    this.apiUrl = config.apiUrl || 'http://localhost:8080/v1';
    this.modelName = config.modelName || 'llama3';
  }
  
  async generateText(prompt, options = {}) {
    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || this.modelName,
        messages: [
          { role: 'system', content: options.systemPrompt || this.config.defaultSystemPrompt || '' },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2000
      })
    });
    
    const result = await response.json();
    return result.choices[0].message.content;
  }
  
  async generateEmbedding(text, options = {}) {
    const response = await fetch(`${this.apiUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.embeddingModel || this.config.embeddingModel || 'all-minilm-l6-v2',
        input: text
      })
    });
    
    const result = await response.json();
    return result.data[0].embedding;
  }
}
```

この柔軟なインターフェース設計により、商用APIとローカルモデルを組み合わせたハイブリッド構成が可能になります。また、特定のプロバイダーに障害が発生した場合のフォールバックメカニズムも実装されています。

### プロンプト最適化

異なるLLMプロバイダーに対応するためのプロンプト最適化メカニズム：

```javascript
// 異なるLLMプロバイダーに合わせたプロンプト調整
const promptAdapters = {
  'openai': {
    formatMemoryContext: (memories) => `関連する過去の情報:\n${memories.join('\n')}`,
    formatSequentialThinking: (steps) => `以下のステップで考えてください:\n${steps.join('\n')}`
  },
  'anthropic': {
    formatMemoryContext: (memories) => `<relevant_memories>\n${memories.join('\n')}\n</relevant_memories>`,
    formatSequentialThinking: (steps) => `<thinking>\n${steps.join('\n')}\n</thinking>`
  },
  'localLLM': {
    formatMemoryContext: (memories) => `# 関連情報\n${memories.map(m => `- ${m}`).join('\n')}`,
    formatSequentialThinking: (steps) => `# 思考ステップ\n${steps.map((s, i) => `${i+1}. ${s}`).join('\n')}`
  }
};

// 適応型プロンプト生成
function generatePrompt(provider, content, memories, thinkingSteps) {
  const adapter = promptAdapters[provider] || promptAdapters['openai'];
  
  return `
    ${adapter.formatMemoryContext(memories)}
    
    ${adapter.formatSequentialThinking(thinkingSteps)}
    
    ユーザークエリ: ${content}
  `;
}
```

このプロンプト適応システムにより、各LLMの特性や好みの入力形式に合わせて最適化されたプロンプトを生成できます。

## 付録：神経科学との対応関係

ハルカの設計における人間の脳の記憶・思考メカニズムとの対応関係の詳細：

| 脳の機能 | 脳の領域 | HARCAでの実装 | 技術的実現方法 |
|---------|---------|--------------|--------------|
| 作業記憶 | 前頭前皮質 | 短期記憶システム | Redis、インメモリキャッシュ |
| 短期エピソード記憶 | 海馬、側頭葉 | 中期記憶システム | PostgreSQL、構造化データ |
| 意味記憶 | 側頭葉、頭頂葉 | 長期記憶システム | PostgreSQL + pgvector |
| 記憶の固定化 | 海馬→皮質への転送 | 記憶移行メカニズム | バックグラウンドジョブ |
| 再固定化 | 想起時の記憶更新 | 記憶アクセス統計更新 | アクセス時の重要度再評価 |
| 選択的強化 | アミグダラを介した感情的重要性 | 重要度評価アルゴリズム | 複合的評価指標 |
| 忘却 | シナプス弱化、干渉 | 選択的忘却メカニズム | 低重要度記憶の削除/抑制 |
| 制御的処理 | 前頭前皮質 | Sequential Thinking | 構造化プロンプト |
| メタ認知 | 前頭極、前帯状皮質 | 推論評価システム | 思考プロセスの自己評価 |
| プライミング効果 | 活性化拡散 | コンテキスト予測活性化 | 関連記憶の先行ロード |
| 活性化調整 | 前頭前皮質の制御 | 関連度フィルタリング | コサイン類似度、閾値設定 |

これらの対応関係は、単なるメタファーではなく、実際の神経科学的知見に基づいてハルカのアーキテクチャに実装されています。このアプローチにより、人間の認知システムの強みを持ちながら、コンピュータシステムとしての効率性と拡張性を兼ね備えたハイブリッドなシステムが実現されています。
