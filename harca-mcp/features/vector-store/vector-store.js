/**
 * HARCA ベクトルストア
 * 
 * 埋め込みベクトルの生成とベクトル検索機能を提供するクラス
 */

const { EmbeddingCache } = require('./embedding-cache');

/**
 * ベクトルストアクラス
 */
class VectorStore {
  /**
   * ベクトルストアを初期化
   * @param {EmbeddingCache} cache - 埋め込みキャッシュインスタンス
   */
  constructor(cache) {
    this.cache = cache || new EmbeddingCache();
  }
  
  /**
   * テキストの埋め込みベクトルを取得
   * @param {string} text - 埋め込みベクトルに変換するテキスト
   * @param {string} model - 使用する埋め込みモデル名
   * @returns {Promise<number[]>} 埋め込みベクトル
   */
  async getEmbedding(text, model = 'text-embedding-ada-002') {
    try {
      // キャッシュから埋め込みベクトルを取得（なければ生成）
      return await this.cache.get(text, model);
    } catch (err) {
      console.error('埋め込みベクトル取得エラー:', err);
      throw new Error(`埋め込みベクトルの取得に失敗しました: ${err.message}`);
    }
  }
  
  /**
   * コサイン類似度を計算
   * @param {number[]} vec1 - ベクトル1
   * @param {number[]} vec2 - ベクトル2
   * @returns {number} コサイン類似度（-1から1の範囲、1が最も類似）
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('ベクトルの次元数が一致しません');
    }
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }
    
    return dotProduct / (norm1 * norm2);
  }
  
  /**
   * ベクトル検索を実行
   * @param {string} query - 検索クエリ
   * @param {Array<{id: string, text: string, metadata?: object}>} documents - 検索対象のドキュメント配列
   * @param {number} topK - 返す結果の数
   * @param {string} model - 使用する埋め込みモデル名
   * @param {object} options - 検索オプション
   * @param {object} options.filters - メタデータフィルタリング条件
   * @param {boolean} options.highlight - 検索結果のハイライト表示を有効にするかどうか
   * @param {number} options.hybridAlpha - ハイブリッド検索の重み（0-1の範囲、0はベクトル検索のみ、1はキーワード検索のみ）
   * @returns {Promise<Array<{id: string, text: string, score: number, metadata?: object, highlights?: Array<{start: number, end: number}>}>>} 検索結果
   */
  async search(query, documents, topK = 5, model = 'text-embedding-ada-002', options = {}) {
    try {
      // デフォルトオプションの設定
      const searchOptions = {
        filters: options.filters || {},
        highlight: options.highlight || false,
        hybridAlpha: options.hybridAlpha !== undefined ? options.hybridAlpha : 0.0
      };
      
      console.log(`検索を実行します: クエリ="${query}", オプション=`, searchOptions);
      
      // クエリの埋め込みベクトルを取得
      const queryEmbedding = await this.getEmbedding(query, model);
      
      // 各ドキュメントの埋め込みベクトルを取得し、類似度を計算
      const results = await Promise.all(
        documents.map(async (doc) => {
          const docEmbedding = await this.getEmbedding(doc.text, model);
          let score = this.cosineSimilarity(queryEmbedding, docEmbedding);
          
          // ハイブリッド検索（ベクトル検索とキーワード検索の組み合わせ）
          if (searchOptions.hybridAlpha > 0) {
            const keywordScore = this._calculateKeywordScore(query, doc.text);
            // ベクトル検索とキーワード検索のスコアを組み合わせる
            score = (1 - searchOptions.hybridAlpha) * score + searchOptions.hybridAlpha * keywordScore;
          }
          
          const result = {
            id: doc.id,
            text: doc.text,
            score
          };
          
          // メタデータがあれば追加
          if (doc.metadata) {
            result.metadata = doc.metadata;
          }
          
          // ハイライト機能が有効な場合、関連部分をハイライト
          if (searchOptions.highlight) {
            result.highlights = this._generateHighlights(query, doc.text);
          }
          
          return result;
        })
      );
      
      // メタデータフィルタリング
      const filteredResults = this._filterByMetadata(results, searchOptions.filters);
      
      // スコアの降順でソート
      filteredResults.sort((a, b) => b.score - a.score);
      
      // 上位K件を返す
      return filteredResults.slice(0, topK);
    } catch (err) {
      console.error('ベクトル検索エラー:', err);
      throw new Error(`ベクトル検索に失敗しました: ${err.message}`);
    }
  }
  
  /**
   * キーワードベースのスコアを計算
   * @param {string} query - 検索クエリ
   * @param {string} text - ドキュメントテキスト
   * @returns {number} キーワードスコア（0-1の範囲）
   * @private
   */
  _calculateKeywordScore(query, text) {
    // 簡易的なキーワードマッチングスコア計算
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);
    const textLower = text.toLowerCase();
    
    if (queryTerms.length === 0) return 0;
    
    let matchCount = 0;
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        matchCount++;
      }
    }
    
    return matchCount / queryTerms.length;
  }
  
  /**
   * メタデータに基づいてフィルタリング
   * @param {Array<{id: string, text: string, score: number, metadata?: object}>} results - 検索結果
   * @param {object} filters - フィルタリング条件
   * @returns {Array<{id: string, text: string, score: number, metadata?: object}>} フィルタリングされた結果
   * @private
   */
  _filterByMetadata(results, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return results;
    }
    
    return results.filter(result => {
      if (!result.metadata) return false;
      
      // すべてのフィルタ条件に一致するかチェック
      return Object.entries(filters).every(([key, value]) => {
        // メタデータにキーが存在しない場合はfalse
        if (!(key in result.metadata)) return false;
        
        const metadataValue = result.metadata[key];
        
        // 値が配列の場合（OR条件）
        if (Array.isArray(value)) {
          return value.some(v => this._matchValue(metadataValue, v));
        }
        
        // 単一の値
        return this._matchValue(metadataValue, value);
      });
    });
  }
  
  /**
   * メタデータの値がフィルタ条件に一致するかチェック
   * @param {any} metadataValue - メタデータの値
   * @param {any} filterValue - フィルタ条件の値
   * @returns {boolean} 一致するかどうか
   * @private
   */
  _matchValue(metadataValue, filterValue) {
    // 値が等しい場合
    if (metadataValue === filterValue) return true;
    
    // 文字列の場合、部分一致をチェック
    if (typeof metadataValue === 'string' && typeof filterValue === 'string') {
      return metadataValue.toLowerCase().includes(filterValue.toLowerCase());
    }
    
    // 数値の範囲指定の場合
    if (typeof metadataValue === 'number' && typeof filterValue === 'object') {
      if (filterValue.gt !== undefined && metadataValue <= filterValue.gt) return false;
      if (filterValue.gte !== undefined && metadataValue < filterValue.gte) return false;
      if (filterValue.lt !== undefined && metadataValue >= filterValue.lt) return false;
      if (filterValue.lte !== undefined && metadataValue > filterValue.lte) return false;
      return true;
    }
    
    // 日付の範囲指定の場合
    if (metadataValue instanceof Date && typeof filterValue === 'object') {
      const metadataDate = new Date(metadataValue).getTime();
      if (filterValue.after !== undefined && metadataDate <= new Date(filterValue.after).getTime()) return false;
      if (filterValue.before !== undefined && metadataDate >= new Date(filterValue.before).getTime()) return false;
      return true;
    }
    
    return false;
  }
  
  /**
   * 検索クエリに関連する部分のハイライト情報を生成
   * @param {string} query - 検索クエリ
   * @param {string} text - ドキュメントテキスト
   * @returns {Array<{start: number, end: number}>} ハイライト位置の配列
   * @private
   */
  _generateHighlights(query, text) {
    const highlights = [];
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1);
    const textLower = text.toLowerCase();
    
    for (const term of queryTerms) {
      let startIndex = 0;
      let index;
      
      while ((index = textLower.indexOf(term, startIndex)) !== -1) {
        highlights.push({
          start: index,
          end: index + term.length
        });
        startIndex = index + term.length;
      }
    }
    
    // 重複するハイライトをマージ
    return this._mergeOverlappingHighlights(highlights);
  }
  
  /**
   * 重複するハイライト範囲をマージ
   * @param {Array<{start: number, end: number}>} highlights - ハイライト位置の配列
   * @returns {Array<{start: number, end: number}>} マージされたハイライト位置の配列
   * @private
   */
  _mergeOverlappingHighlights(highlights) {
    if (highlights.length <= 1) return highlights;
    
    // 開始位置でソート
    highlights.sort((a, b) => a.start - b.start);
    
    const merged = [highlights[0]];
    
    for (let i = 1; i < highlights.length; i++) {
      const current = highlights[i];
      const previous = merged[merged.length - 1];
      
      // 重複している場合はマージ
      if (current.start <= previous.end) {
        previous.end = Math.max(previous.end, current.end);
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  }
  
  /**
   * 複数クエリのバッチ検索を実行
   * @param {string[]} queries - 検索クエリの配列
   * @param {Array<{id: string, text: string, metadata?: object}>} documents - 検索対象のドキュメント配列
   * @param {number} topK - 各クエリに対して返す結果の数
   * @param {string} model - 使用する埋め込みモデル名
   * @param {object} options - 検索オプション
   * @returns {Promise<Array<Array<{id: string, text: string, score: number, metadata?: object, highlights?: Array<{start: number, end: number}>}>>>} 各クエリに対する検索結果の配列
   */
  async batchSearch(queries, documents, topK = 5, model = 'text-embedding-ada-002', options = {}) {
    try {
      // 各クエリに対して検索を実行
      const results = await Promise.all(
        queries.map(query => this.search(query, documents, topK, model, options))
      );
      
      return results;
    } catch (err) {
      console.error('バッチ検索エラー:', err);
      throw new Error(`バッチ検索に失敗しました: ${err.message}`);
    }
  }
  
  /**
   * ドキュメントをクラスタリング
   * @param {Array<{id: string, text: string}>} documents - クラスタリング対象のドキュメント配列
   * @param {number} numClusters - クラスタ数
   * @param {string} model - 使用する埋め込みモデル名
   * @returns {Promise<Array<{centroid: number[], documents: Array<{id: string, text: string}>}>>} クラスタリング結果
   */
  async clusterDocuments(documents, numClusters = 3, model = 'text-embedding-ada-002') {
    // この実装はシンプルなK-meansクラスタリングのサンプルです
    // 実際のアプリケーションでは、より高度なクラスタリングアルゴリズムを使用することを推奨します
    
    try {
      // 各ドキュメントの埋め込みベクトルを取得
      const embeddings = await Promise.all(
        documents.map(doc => this.getEmbedding(doc.text, model))
      );
      
      // ランダムに初期クラスタ中心を選択
      const centroids = [];
      const usedIndices = new Set();
      
      for (let i = 0; i < numClusters; i++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * embeddings.length);
        } while (usedIndices.has(randomIndex));
        
        usedIndices.add(randomIndex);
        centroids.push([...embeddings[randomIndex]]);
      }
      
      // K-meansクラスタリングを実行（最大10イテレーション）
      const maxIterations = 10;
      let clusters = Array(numClusters).fill().map(() => []);
      
      for (let iter = 0; iter < maxIterations; iter++) {
        // 各ドキュメントを最も近いクラスタに割り当て
        clusters = Array(numClusters).fill().map(() => []);
        
        for (let i = 0; i < documents.length; i++) {
          let bestCluster = 0;
          let bestSimilarity = -Infinity;
          
          for (let j = 0; j < numClusters; j++) {
            const similarity = this.cosineSimilarity(embeddings[i], centroids[j]);
            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestCluster = j;
            }
          }
          
          clusters[bestCluster].push({
            document: documents[i],
            embedding: embeddings[i]
          });
        }
        
        // クラスタ中心を更新
        const newCentroids = [];
        for (let i = 0; i < numClusters; i++) {
          if (clusters[i].length === 0) {
            newCentroids.push(centroids[i]);
            continue;
          }
          
          const dimensions = embeddings[0].length;
          const newCentroid = new Array(dimensions).fill(0);
          
          for (const item of clusters[i]) {
            for (let d = 0; d < dimensions; d++) {
              newCentroid[d] += item.embedding[d];
            }
          }
          
          for (let d = 0; d < dimensions; d++) {
            newCentroid[d] /= clusters[i].length;
          }
          
          newCentroids.push(newCentroid);
        }
        
        // 収束判定
        let converged = true;
        for (let i = 0; i < numClusters; i++) {
          const similarity = this.cosineSimilarity(centroids[i], newCentroids[i]);
          if (similarity < 0.999) {
            converged = false;
            break;
          }
        }
        
        centroids.splice(0, centroids.length, ...newCentroids);
        
        if (converged) {
          break;
        }
      }
      
      // 結果を整形
      return clusters.map((cluster, i) => ({
        centroid: centroids[i],
        documents: cluster.map(item => item.document)
      }));
    } catch (err) {
      console.error('ドキュメントクラスタリングエラー:', err);
      throw new Error(`ドキュメントのクラスタリングに失敗しました: ${err.message}`);
    }
  }
}

module.exports = { VectorStore };
