/**
 * ツールメタデータ管理システム
 * 利用可能なツールとそのメタデータを管理し、推奨アルゴリズムの基盤となるモジュール
 */
/**
 * ツールのカテゴリ定義
 */
export var ToolCategory;
(function (ToolCategory) {
    ToolCategory["ANALYSIS"] = "analysis";
    ToolCategory["CODING"] = "coding";
    ToolCategory["DOCUMENTATION"] = "documentation";
    ToolCategory["COMMUNICATION"] = "communication";
    ToolCategory["RESEARCH"] = "research";
    ToolCategory["PLANNING"] = "planning";
    ToolCategory["DEBUGGING"] = "debugging";
    ToolCategory["TESTING"] = "testing";
    ToolCategory["DEPLOYMENT"] = "deployment";
    ToolCategory["OTHER"] = "other";
})(ToolCategory || (ToolCategory = {}));
/**
 * ツールの使用コンテキスト定義
 */
export var ToolContext;
(function (ToolContext) {
    ToolContext["PROBLEM_DEFINITION"] = "problem_definition";
    ToolContext["SOLUTION_DESIGN"] = "solution_design";
    ToolContext["IMPLEMENTATION"] = "implementation";
    ToolContext["REVIEW"] = "review";
    ToolContext["REFACTORING"] = "refactoring";
    ToolContext["LEARNING"] = "learning";
    ToolContext["COLLABORATION"] = "collaboration";
    ToolContext["DECISION_MAKING"] = "decision_making";
})(ToolContext || (ToolContext = {}));
/**
 * ツールメタデータマネージャークラス
 */
export class ToolMetadataManager {
    tools = new Map();
    /**
     * ツールを登録する
     */
    registerTool(tool) {
        if (this.tools.has(tool.id)) {
            throw new Error(`Tool with ID ${tool.id} already exists`);
        }
        this.tools.set(tool.id, tool);
    }
    /**
     * ツールを更新する
     */
    updateTool(id, updates) {
        const tool = this.tools.get(id);
        if (!tool) {
            throw new Error(`Tool with ID ${id} not found`);
        }
        this.tools.set(id, { ...tool, ...updates, lastUpdated: new Date() });
    }
    /**
     * ツールを削除する
     */
    removeTool(id) {
        return this.tools.delete(id);
    }
    /**
     * ツールを取得する
     */
    getTool(id) {
        return this.tools.get(id);
    }
    /**
     * すべてのツールを取得する
     */
    getAllTools() {
        return Array.from(this.tools.values());
    }
    /**
     * カテゴリでツールをフィルタリングする
     */
    getToolsByCategory(category) {
        return this.getAllTools().filter(tool => tool.category === category);
    }
    /**
     * コンテキストでツールをフィルタリングする
     */
    getToolsByContext(context) {
        return this.getAllTools().filter(tool => tool.contexts.includes(context));
    }
    /**
     * キーワードでツールを検索する
     */
    searchToolsByKeyword(keyword) {
        const lowerKeyword = keyword.toLowerCase();
        return this.getAllTools().filter(tool => tool.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
            tool.name.toLowerCase().includes(lowerKeyword) ||
            tool.description.toLowerCase().includes(lowerKeyword));
    }
    /**
     * 指定した条件に基づいてツールを検索する
     */
    findTools(options = {}) {
        let results = [...this.tools.values()];
        // カテゴリでフィルタリング
        if (options.category) {
            results = results.filter(tool => tool.category === options.category);
        }
        // コンテキストでフィルタリング
        if (options.context !== undefined) {
            results = results.filter(tool => tool.contexts.includes(options.context));
        }
        // キーワードでフィルタリング
        if (options.keyword) {
            const keyword = options.keyword.toLowerCase();
            results = results.filter(tool => tool.keywords.some(k => k.toLowerCase().includes(keyword)) ||
                tool.name.toLowerCase().includes(keyword) ||
                tool.description.toLowerCase().includes(keyword));
        }
        // 最小効果でフィルタリング
        if (typeof options.minEffectiveness === 'number') {
            const minEffectiveness = options.minEffectiveness;
            results = results.filter(tool => tool.effectiveness >= minEffectiveness);
        }
        // 最大複雑さでフィルタリング
        if (typeof options.maxComplexity === 'number') {
            const maxComplexity = options.maxComplexity;
            results = results.filter(tool => tool.complexity <= maxComplexity);
        }
        return results;
    }
}
/**
 * デフォルトのツールメタデータマネージャーのインスタンス
 */
export const defaultToolMetadataManager = new ToolMetadataManager();
