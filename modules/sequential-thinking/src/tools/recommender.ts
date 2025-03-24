/**
 * ツール推奨アルゴリズム
 * コンテキスト分析結果とツールメタデータを組み合わせて、最適なツールを推奨するモジュール
 */

import { ToolMetadata, ToolMetadataManager, defaultToolMetadataManager, ToolCategory, ToolContext } from './metadata.js';
import { 
  ContextAnalysisResult, 
  ContextAnalyzer, 
  ThoughtAnalysisResult,
  defaultContextAnalyzer 
} from './context-analyzer.js';

/**
 * 推奨ツールの結果インターフェース
 */
export interface ToolRecommendation {
  tool: ToolMetadata;
  score: number; // 0-1の範囲
  reasons: string[];
  usageHint?: string;
}

/**
 * ツール推奨オプションのインターフェース
 */
export interface RecommendationOptions {
  maxResults?: number;
  minScore?: number;
  userExperienceLevel?: number; // 1-10のスケール（1が初心者、10が専門家）
  preferredCategories?: string[];
  excludedTools?: string[];
  includeUsageHints?: boolean;
}

/**
 * ツール推奨エンジンクラス
 */
export class ToolRecommender {
  private metadataManager: ToolMetadataManager;
  private contextAnalyzer: ContextAnalyzer;
  
  constructor(
    metadataManager: ToolMetadataManager = defaultToolMetadataManager,
    contextAnalyzer: ContextAnalyzer = defaultContextAnalyzer
  ) {
    this.metadataManager = metadataManager;
    this.contextAnalyzer = contextAnalyzer;
  }
  
  /**
   * 思考データに基づいてツールを推奨する
   */
  public recommendToolsForThought(
    thought: string,
    options: RecommendationOptions = {}
  ): ToolRecommendation[] {
    // 思考を分析
    const thoughtAnalysis = this.contextAnalyzer.analyzeThought(thought);
    
    // コンテキストを分析
    const contextAnalysis = this.contextAnalyzer.analyzeContext(thought);
    
    // デバッグ情報
    console.log('思考分析結果:', JSON.stringify(thoughtAnalysis, null, 2));
    console.log('コンテキスト分析結果:', JSON.stringify(contextAnalysis, null, 2));
    
    // 分析結果に基づいてツールを推奨
    return this.recommendTools(thoughtAnalysis, contextAnalysis, options);
  }
  
  /**
   * 分析結果に基づいてツールを推奨する
   */
  public recommendTools(
    thoughtAnalysis: ThoughtAnalysisResult,
    contextAnalysis: ContextAnalysisResult,
    options: RecommendationOptions = {}
  ): ToolRecommendation[] {
    const {
      maxResults = 5,
      minScore = 0.2, // 最小スコアを0.3から0.2に下げる
      userExperienceLevel = 5,
      preferredCategories = [],
      excludedTools = [],
      includeUsageHints = true
    } = options;
    
    // 利用可能なすべてのツールを取得
    const allTools = this.metadataManager.getAllTools();
    console.log(`利用可能なツール数: ${allTools.length}`);
    
    // 除外ツールをフィルタリング
    const filteredTools = allTools.filter(tool => !excludedTools.includes(tool.id));
    
    // 各ツールのスコアを計算
    const scoredTools = filteredTools.map(tool => {
      const score = this.calculateToolScore(
        tool,
        thoughtAnalysis,
        contextAnalysis,
        userExperienceLevel,
        preferredCategories
      );
      
      const reasons = this.generateRecommendationReasons(
        tool,
        thoughtAnalysis,
        contextAnalysis,
        score
      );
      
      const usageHint = includeUsageHints
        ? this.generateUsageHint(tool, thoughtAnalysis, contextAnalysis)
        : undefined;
      
      console.log(`ツール "${tool.name}" のスコア: ${score.toFixed(2)}`);
      
      return {
        tool,
        score,
        reasons,
        usageHint
      };
    });
    
    // スコアでフィルタリングおよびソート
    const recommendations = scoredTools
      .filter(recommendation => recommendation.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
    
    console.log(`推奨ツール数: ${recommendations.length}`);
    
    return recommendations;
  }
  
  /**
   * ツールのスコアを計算する
   */
  private calculateToolScore(
    tool: ToolMetadata,
    thoughtAnalysis: ThoughtAnalysisResult,
    contextAnalysis: ContextAnalysisResult,
    userExperienceLevel: number,
    preferredCategories: string[]
  ): number {
    // カテゴリマッチングスコア
    const categoryScore = contextAnalysis.categories
      .filter(cat => cat.category === tool.category)
      .reduce((score, cat) => score + cat.confidence, 0);
    
    // コンテキストマッチングスコア
    const contextScore = contextAnalysis.contexts
      .filter(ctx => tool.contexts.includes(ctx.context))
      .reduce((score, ctx) => score + ctx.confidence, 0) / Math.max(tool.contexts.length, 1);
    
    // キーワードマッチングスコア - 改善版
    const keywordMatches = contextAnalysis.keywords
      .filter(kw => tool.keywords.some(toolKw => 
        toolKw.toLowerCase().includes(kw.keyword.toLowerCase()) || 
        kw.keyword.toLowerCase().includes(toolKw.toLowerCase())
      ));
    
    const keywordScore = keywordMatches.length > 0 
      ? keywordMatches.reduce((score, kw) => score + kw.relevance, 0) / keywordMatches.length
      : 0;
    
    // 複雑さの適合性スコア
    // ツールの複雑さとコンテキストの複雑さのギャップが小さいほど高スコア
    const complexityGap = Math.abs(tool.complexity - contextAnalysis.complexityLevel);
    const complexityScore = 1 - (complexityGap / 10);
    
    // ユーザー経験レベルの適合性スコア
    // ユーザーの経験レベルがツールの複雑さより高いほど高スコア
    const experienceScore = userExperienceLevel >= tool.complexity
      ? 1
      : 1 - ((tool.complexity - userExperienceLevel) / 10);
    
    // 優先カテゴリボーナス
    const categoryBonus = preferredCategories.includes(tool.category) ? 0.2 : 0;
    
    // 効果スコア
    const effectivenessScore = tool.effectiveness / 10;
    
    // 思考分析に基づく関連性スコア
    const relevanceScore = this.calculateRelevanceScore(tool, thoughtAnalysis);
    
    // 総合スコアの計算（各要素に重み付け）- 重みを調整
    const weightedScore =
      (categoryScore * 0.15) +
      (contextScore * 0.15) +
      (keywordScore * 0.25) + // キーワードの重みを増加
      (complexityScore * 0.1) +
      (experienceScore * 0.05) +
      (effectivenessScore * 0.15) +
      (relevanceScore * 0.15) + // 関連性の重みを増加
      categoryBonus;
    
    // スコア計算のデバッグ情報
    if (process.env.DEBUG === 'true') {
      console.log(`ツール "${tool.name}" のスコア詳細:`, {
        categoryScore: categoryScore * 0.15,
        contextScore: contextScore * 0.15,
        keywordScore: keywordScore * 0.25,
        complexityScore: complexityScore * 0.1,
        experienceScore: experienceScore * 0.05,
        effectivenessScore: effectivenessScore * 0.15,
        relevanceScore: relevanceScore * 0.15,
        categoryBonus,
        totalScore: weightedScore
      });
    }
    
    // 0-1の範囲に正規化
    return Math.min(Math.max(weightedScore, 0), 1);
  }
  
  /**
   * 思考分析に基づく関連性スコアを計算する
   */
  private calculateRelevanceScore(
    tool: ToolMetadata,
    thoughtAnalysis: ThoughtAnalysisResult
  ): number {
    // 思考の主要な焦点とツールの説明の類似性を評価 - 改善版
    const mainFocusRelevance = this.enhancedTextSimilarity(
      thoughtAnalysis.mainFocus,
      tool.description + ' ' + tool.keywords.join(' ')
    );
    
    // サブトピックとツールのキーワードの類似性を評価 - 改善版
    const subTopicsRelevance = thoughtAnalysis.subTopics.length > 0
      ? thoughtAnalysis.subTopics.reduce((score, topic) => {
          const topicRelevance = this.enhancedTextSimilarity(
            topic, 
            tool.description + ' ' + tool.keywords.join(' ')
          );
          return score + topicRelevance;
        }, 0) / thoughtAnalysis.subTopics.length
      : 0;
    
    // 質問とツールの関連性を評価 - 改善版
    const questionsRelevance = thoughtAnalysis.questionsPosed.length > 0
      ? thoughtAnalysis.questionsPosed.reduce((score, question) => {
          const questionRelevance = this.enhancedTextSimilarity(
            question, 
            tool.description + ' ' + tool.keywords.join(' ')
          );
          return score + questionRelevance;
        }, 0) / thoughtAnalysis.questionsPosed.length
      : 0;
    
    // 次のステップが必要な場合、ツールの効果を考慮
    const nextStepsBonus = thoughtAnalysis.nextStepsNeeded ? (tool.effectiveness / 10) * 0.2 : 0;
    
    // 総合的な関連性スコア - 重みを調整
    return (
      (mainFocusRelevance * 0.5) +
      (subTopicsRelevance * 0.2) +
      (questionsRelevance * 0.3) +
      nextStepsBonus
    );
  }
  
  /**
   * 2つのテキスト間の強化された類似性を計算する
   */
  private enhancedTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    // 両方のテキストを正規化
    const normalizedText1 = text1.toLowerCase();
    const normalizedText2 = text2.toLowerCase();
    
    // 単語を抽出
    const words1 = normalizedText1.split(/\s+/).filter(word => word.length > 2);
    const words2 = normalizedText2.split(/\s+/).filter(word => word.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    // 部分一致を考慮した類似性計算
    let matchCount = 0;
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.includes(word2) || word2.includes(word1)) {
          matchCount++;
          break;
        }
      }
    }
    
    // 直接一致も考慮
    const directMatches = new Set(
      words1.filter(word => words2.includes(word))
    );
    
    // 部分一致と直接一致を組み合わせたスコア
    const partialMatchScore = matchCount / words1.length;
    const directMatchScore = directMatches.size / Math.min(words1.length, words2.length);
    
    // 最終スコア（直接一致に高い重みを与える）
    return (partialMatchScore * 0.4) + (directMatchScore * 0.6);
  }
  
  /**
   * 推奨理由を生成する
   */
  private generateRecommendationReasons(
    tool: ToolMetadata,
    thoughtAnalysis: ThoughtAnalysisResult,
    contextAnalysis: ContextAnalysisResult,
    score: number
  ): string[] {
    const reasons: string[] = [];
    
    // カテゴリマッチング
    const categoryMatch = contextAnalysis.categories.find(cat => cat.category === tool.category);
    if (categoryMatch && categoryMatch.confidence > 0.5) {
      reasons.push(`このツールは${categoryMatch.category}カテゴリに属しており、現在の問題に適しています。`);
    }
    
    // コンテキストマッチング
    const contextMatches = contextAnalysis.contexts
      .filter(ctx => tool.contexts.includes(ctx.context) && ctx.confidence > 0.4);
    if (contextMatches.length > 0) {
      const contexts = contextMatches.map(ctx => ctx.context).join('、');
      reasons.push(`このツールは${contexts}のコンテキストで効果的です。`);
    }
    
    // キーワードマッチング
    const keywordMatches = contextAnalysis.keywords
      .filter(kw => tool.keywords.includes(kw.keyword) && kw.relevance > 0.6);
    if (keywordMatches.length > 0) {
      const keywords = keywordMatches.map(kw => kw.keyword).join('、');
      reasons.push(`このツールは「${keywords}」などの重要なキーワードに関連しています。`);
    }
    
    // 複雑さの適合性
    const complexityGap = Math.abs(tool.complexity - contextAnalysis.complexityLevel);
    if (complexityGap <= 2) {
      reasons.push(`このツールの複雑さレベル(${tool.complexity})は、問題の複雑さ(${contextAnalysis.complexityLevel})に適しています。`);
    }
    
    // 効果
    if (tool.effectiveness >= 8) {
      reasons.push(`このツールは非常に効果的(${tool.effectiveness}/10)で、高品質な結果を提供します。`);
    } else if (tool.effectiveness >= 6) {
      reasons.push(`このツールは効果的(${tool.effectiveness}/10)で、良好な結果を提供します。`);
    }
    
    // 思考分析に基づく関連性
    if (thoughtAnalysis.nextStepsNeeded && tool.effectiveness > 7) {
      reasons.push('このツールは次のステップを進めるのに役立ちます。');
    }
    
    if (thoughtAnalysis.uncertainties.length > 0 && tool.category === 'analysis') {
      reasons.push('このツールは不確実性を解消するのに役立ちます。');
    }
    
    // スコアに基づく総合評価
    if (score > 0.8) {
      reasons.push('総合的に見て、このツールは現在の問題に非常に適しています。');
    } else if (score > 0.6) {
      reasons.push('総合的に見て、このツールは現在の問題に適しています。');
    } else if (score > 0.4) {
      reasons.push('このツールは現在の問題に対して部分的に役立つ可能性があります。');
    }
    
    return reasons;
  }
  
  /**
   * 使用ヒントを生成する
   */
  private generateUsageHint(
    tool: ToolMetadata,
    thoughtAnalysis: ThoughtAnalysisResult,
    contextAnalysis: ContextAnalysisResult
  ): string {
    // ツールの使用例からランダムに選択
    if (tool.usageExamples && tool.usageExamples.length > 0) {
      const randomExample = tool.usageExamples[
        Math.floor(Math.random() * tool.usageExamples.length)
      ];
      return `使用例: ${randomExample}`;
    }
    
    // 使用例がない場合は、カテゴリとコンテキストに基づいて生成
    const category = tool.category;
    const contexts = tool.contexts;
    
    if (category === 'analysis' && contexts.includes(ToolContext.PROBLEM_DEFINITION)) {
      return `このツールを使用して問題の根本原因を特定し、解決策の方向性を明確にしてください。`;
    } else if (category === 'coding' && contexts.includes(ToolContext.IMPLEMENTATION)) {
      return `このツールを使用してコードを効率的に実装し、品質を確保してください。`;
    } else if (category === 'debugging' && contexts.includes(ToolContext.PROBLEM_DEFINITION)) {
      return `このツールを使用して問題を再現し、エラーの原因を特定してください。`;
    }
    
    // デフォルトのヒント
    return `このツールを効果的に使用するには、目的を明確にし、段階的にアプローチしてください。`;
  }
}

/**
 * デフォルトのツール推奨エンジンのインスタンス
 */
export const defaultToolRecommender = new ToolRecommender();
