/**
 * ツールメタデータ管理システム
 * 利用可能なツールとそのメタデータを管理し、推奨アルゴリズムの基盤となるモジュール
 */
/**
 * ツールのカテゴリ定義
 */
export declare enum ToolCategory {
    ANALYSIS = "analysis",
    CODING = "coding",
    DOCUMENTATION = "documentation",
    COMMUNICATION = "communication",
    RESEARCH = "research",
    PLANNING = "planning",
    DEBUGGING = "debugging",
    TESTING = "testing",
    DEPLOYMENT = "deployment",
    OTHER = "other"
}
/**
 * ツールの使用コンテキスト定義
 */
export declare enum ToolContext {
    PROBLEM_DEFINITION = "problem_definition",
    SOLUTION_DESIGN = "solution_design",
    IMPLEMENTATION = "implementation",
    REVIEW = "review",
    REFACTORING = "refactoring",
    LEARNING = "learning",
    COLLABORATION = "collaboration",
    DECISION_MAKING = "decision_making"
}
/**
 * ツールメタデータのインターフェース
 */
export interface ToolMetadata {
    id: string;
    name: string;
    description: string;
    category: ToolCategory;
    contexts: ToolContext[];
    keywords: string[];
    usageExamples: string[];
    complexity: number;
    effectiveness: number;
    prerequisites?: string[];
    relatedTools?: string[];
    lastUpdated: Date;
}
/**
 * ツールメタデータマネージャークラス
 */
export declare class ToolMetadataManager {
    private tools;
    /**
     * ツールを登録する
     */
    registerTool(tool: ToolMetadata): void;
    /**
     * ツールを更新する
     */
    updateTool(id: string, updates: Partial<ToolMetadata>): void;
    /**
     * ツールを削除する
     */
    removeTool(id: string): boolean;
    /**
     * ツールを取得する
     */
    getTool(id: string): ToolMetadata | undefined;
    /**
     * すべてのツールを取得する
     */
    getAllTools(): ToolMetadata[];
    /**
     * カテゴリでツールをフィルタリングする
     */
    getToolsByCategory(category: ToolCategory): ToolMetadata[];
    /**
     * コンテキストでツールをフィルタリングする
     */
    getToolsByContext(context: ToolContext): ToolMetadata[];
    /**
     * キーワードでツールを検索する
     */
    searchToolsByKeyword(keyword: string): ToolMetadata[];
    /**
     * 指定した条件に基づいてツールを検索する
     */
    findTools(options?: {
        category?: ToolCategory;
        context?: ToolContext;
        keyword?: string;
        minEffectiveness?: number;
        maxComplexity?: number;
    }): ToolMetadata[];
}
/**
 * デフォルトのツールメタデータマネージャーのインスタンス
 */
export declare const defaultToolMetadataManager: ToolMetadataManager;
