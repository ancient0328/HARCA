/**
 * ツールメタデータ管理システム
 * 利用可能なツールとそのメタデータを管理し、推奨アルゴリズムの基盤となるモジュール
 */

/**
 * ツールのカテゴリ定義
 */
export enum ToolCategory {
  ANALYSIS = 'analysis',
  CODING = 'coding',
  DOCUMENTATION = 'documentation',
  COMMUNICATION = 'communication',
  RESEARCH = 'research',
  PLANNING = 'planning',
  DEBUGGING = 'debugging',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  OTHER = 'other'
}

/**
 * ツールの使用コンテキスト定義
 */
export enum ToolContext {
  PROBLEM_DEFINITION = 'problem_definition',
  SOLUTION_DESIGN = 'solution_design',
  IMPLEMENTATION = 'implementation',
  REVIEW = 'review',
  REFACTORING = 'refactoring',
  LEARNING = 'learning',
  COLLABORATION = 'collaboration',
  DECISION_MAKING = 'decision_making'
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
  complexity: number; // 1-10のスケール（1が最も簡単、10が最も複雑）
  effectiveness: number; // 1-10のスケール（1が最も効果が低い、10が最も効果が高い）
  prerequisites?: string[];
  relatedTools?: string[];
  lastUpdated: Date;
}

/**
 * ツールメタデータマネージャークラス
 */
export class ToolMetadataManager {
  private tools: Map<string, ToolMetadata> = new Map();
  
  /**
   * ツールを登録する
   */
  public registerTool(tool: ToolMetadata): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with ID ${tool.id} already exists`);
    }
    this.tools.set(tool.id, tool);
  }
  
  /**
   * ツールを更新する
   */
  public updateTool(id: string, updates: Partial<ToolMetadata>): void {
    const tool = this.tools.get(id);
    if (!tool) {
      throw new Error(`Tool with ID ${id} not found`);
    }
    
    this.tools.set(id, { ...tool, ...updates, lastUpdated: new Date() });
  }
  
  /**
   * ツールを削除する
   */
  public removeTool(id: string): boolean {
    return this.tools.delete(id);
  }
  
  /**
   * ツールを取得する
   */
  public getTool(id: string): ToolMetadata | undefined {
    return this.tools.get(id);
  }
  
  /**
   * すべてのツールを取得する
   */
  public getAllTools(): ToolMetadata[] {
    return Array.from(this.tools.values());
  }
  
  /**
   * カテゴリでツールをフィルタリングする
   */
  public getToolsByCategory(category: ToolCategory): ToolMetadata[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }
  
  /**
   * コンテキストでツールをフィルタリングする
   */
  public getToolsByContext(context: ToolContext): ToolMetadata[] {
    return this.getAllTools().filter(tool => tool.contexts.includes(context));
  }
  
  /**
   * キーワードでツールを検索する
   */
  public searchToolsByKeyword(keyword: string): ToolMetadata[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getAllTools().filter(tool => 
      tool.keywords.some(k => k.toLowerCase().includes(lowerKeyword)) ||
      tool.name.toLowerCase().includes(lowerKeyword) ||
      tool.description.toLowerCase().includes(lowerKeyword)
    );
  }
  
  /**
   * 指定した条件に基づいてツールを検索する
   */
  public findTools(options: {
    category?: ToolCategory;
    context?: ToolContext;
    keyword?: string;
    minEffectiveness?: number;
    maxComplexity?: number;
  } = {}): ToolMetadata[] {
    let results = [...this.tools.values()];
    
    // カテゴリでフィルタリング
    if (options.category) {
      results = results.filter(tool => tool.category === options.category);
    }
    
    // コンテキストでフィルタリング
    if (options.context !== undefined) {
      results = results.filter(tool => tool.contexts.includes(options.context as ToolContext));
    }
    
    // キーワードでフィルタリング
    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      results = results.filter(tool => 
        tool.keywords.some(k => k.toLowerCase().includes(keyword)) ||
        tool.name.toLowerCase().includes(keyword) ||
        tool.description.toLowerCase().includes(keyword)
      );
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
