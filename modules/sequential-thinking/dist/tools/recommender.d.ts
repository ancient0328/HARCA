/**
 * ツール推奨アルゴリズム
 * コンテキスト分析結果とツールメタデータを組み合わせて、最適なツールを推奨するモジュール
 */
import { ToolMetadata, ToolMetadataManager } from './metadata.js';
import { ContextAnalysisResult, ContextAnalyzer, ThoughtAnalysisResult } from './context-analyzer.js';
/**
 * 推奨ツールの結果インターフェース
 */
export interface ToolRecommendation {
    tool: ToolMetadata;
    score: number;
    reasons: string[];
    usageHint?: string;
}
/**
 * ツール推奨オプションのインターフェース
 */
export interface RecommendationOptions {
    maxResults?: number;
    minScore?: number;
    userExperienceLevel?: number;
    preferredCategories?: string[];
    excludedTools?: string[];
    includeUsageHints?: boolean;
}
/**
 * ツール推奨エンジンクラス
 */
export declare class ToolRecommender {
    private metadataManager;
    private contextAnalyzer;
    constructor(metadataManager?: ToolMetadataManager, contextAnalyzer?: ContextAnalyzer);
    /**
     * 思考データに基づいてツールを推奨する
     */
    recommendToolsForThought(thought: string, options?: RecommendationOptions): ToolRecommendation[];
    /**
     * 分析結果に基づいてツールを推奨する
     */
    recommendTools(thoughtAnalysis: ThoughtAnalysisResult, contextAnalysis: ContextAnalysisResult, options?: RecommendationOptions): ToolRecommendation[];
    /**
     * ツールのスコアを計算する
     */
    private calculateToolScore;
    /**
     * 思考分析に基づく関連性スコアを計算する
     */
    private calculateRelevanceScore;
    /**
     * 2つのテキスト間の強化された類似性を計算する
     */
    private enhancedTextSimilarity;
    /**
     * 推奨理由を生成する
     */
    private generateRecommendationReasons;
    /**
     * 使用ヒントを生成する
     */
    private generateUsageHint;
}
/**
 * デフォルトのツール推奨エンジンのインスタンス
 */
export declare const defaultToolRecommender: ToolRecommender;
