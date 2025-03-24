/**
 * ドキュメント処理クラス
 * Markdownなどのドキュメントを読み込み、チャンク分割し、メタデータを抽出する
 */
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const config = require('../config/default');
const logger = require('./utils/logger');

class DocumentProcessor {
  /**
   * DocumentProcessorのコンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.options = {
      sourceDir: options.sourceDir || config.document.sourceDir,
      supportedFormats: options.supportedFormats || config.document.supportedFormats,
      chunkSize: options.chunkSize || config.document.chunkSize,
      chunkOverlap: options.chunkOverlap || config.document.chunkOverlap,
      extractMetadata: options.extractMetadata !== undefined ? options.extractMetadata : config.document.extractMetadata,
      metadataFields: options.metadataFields || config.document.metadataFields,
      maxConcurrentProcessing: options.maxConcurrentProcessing || config.processing.maxConcurrentProcessing,
      processingInterval: options.processingInterval || config.processing.processingInterval,
      maxBatchSize: options.maxBatchSize || config.processing.maxBatchSize
    };
    
    logger.info(`DocumentProcessor initialized with sourceDir: ${this.options.sourceDir}`);
  }

  /**
   * ディレクトリ内のすべてのドキュメントを処理する
   * @returns {Promise<Array>} 処理されたドキュメントの配列
   */
  async processDirectory() {
    try {
      logger.info(`Processing directory: ${this.options.sourceDir}`);
      const files = await this.findDocumentFiles(this.options.sourceDir);
      logger.info(`Found ${files.length} document files`);
      
      // バッチ処理のためにファイルを分割
      const batches = this.splitIntoBatches(files, this.options.maxBatchSize);
      
      let allDocuments = [];
      for (let i = 0; i < batches.length; i++) {
        logger.info(`Processing batch ${i+1}/${batches.length}`);
        const batchDocuments = await this.processBatch(batches[i]);
        allDocuments = [...allDocuments, ...batchDocuments];
        
        // 次のバッチ処理前に少し待機（システム負荷軽減のため）
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, this.options.processingInterval));
        }
      }
      
      logger.info(`Processed ${allDocuments.length} documents successfully`);
      return allDocuments;
    } catch (error) {
      logger.error(`Error processing directory: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * ファイルのバッチを処理する
   * @param {Array} batch - 処理するファイルパスの配列
   * @returns {Promise<Array>} 処理されたドキュメントの配列
   */
  async processBatch(batch) {
    // 同時処理数を制限して並列処理
    const promises = [];
    const results = [];
    
    for (const filePath of batch) {
      // 同時処理数の制限
      if (promises.length >= this.options.maxConcurrentProcessing) {
        // いずれかのPromiseが完了するのを待つ
        await Promise.race(promises);
        // 完了したPromiseを削除
        const completedIndex = await Promise.race(
          promises.map(async (p, i) => {
            try {
              await p;
              return i;
            } catch (e) {
              return i;
            }
          })
        );
        promises.splice(completedIndex, 1);
      }
      
      // 新しいファイル処理を追加
      const promise = this.processFile(filePath)
        .then(docs => {
          results.push(...docs);
          return docs;
        })
        .catch(err => {
          logger.error(`Error processing file ${filePath}: ${err.message}`);
          return [];
        });
      
      promises.push(promise);
    }
    
    // 残りのすべての処理が完了するのを待つ
    await Promise.all(promises);
    
    return results;
  }

  /**
   * ディレクトリ内のドキュメントファイルを再帰的に検索する
   * @param {string} dir - 検索するディレクトリパス
   * @returns {Promise<Array>} ファイルパスの配列
   */
  async findDocumentFiles(dir) {
    const files = [];
    
    async function scan(directory) {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase().substring(1);
          if (config.document.supportedFormats.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await scan(dir);
    return files;
  }
  
  /**
   * 配列をバッチに分割する
   * @param {Array} array - 分割する配列
   * @param {number} batchSize - バッチサイズ
   * @returns {Array} バッチの配列
   */
  splitIntoBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 単一のファイルを処理する
   * @param {string} filePath - 処理するファイルパス
   * @returns {Promise<Array>} 処理されたドキュメントチャンクの配列
   */
  async processFile(filePath) {
    try {
      logger.debug(`Processing file: ${filePath}`);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Front Matterからメタデータを抽出（Markdownの場合）
      const { data: frontMatter, content: textContent } = matter(content);
      
      // ファイル情報からメタデータを作成
      const fileInfo = await fs.stat(filePath);
      const metadata = {
        source: filePath,
        documentPath: filePath,
        filename: path.basename(filePath),
        extension: path.extname(filePath).substring(1),
        created: fileInfo.birthtime,
        modified: fileInfo.mtime,
        ...frontMatter
      };
      
      // ドキュメントをチャンクに分割
      const textChunks = this.splitIntoChunks(textContent);
      
      // ドキュメントIDを生成
      const docId = `${path.basename(filePath, path.extname(filePath))}_${Date.now()}`;
      
      // チャンク情報を作成
      const chunks = textChunks.map((content, index) => ({
        index,
        content
      }));
      
      // ドキュメント情報を返す
      return [{
        id: docId,
        path: filePath,
        content: textContent,
        metadata,
        chunks
      }];
    } catch (error) {
      logger.error(`Error processing file ${filePath}: ${error.message}`);
      throw error;
    }
  }

  /**
   * テキストをチャンクに分割する
   * @param {string} text - 分割するテキスト
   * @returns {Array} チャンクの配列
   */
  splitIntoChunks(text) {
    const { chunkSize, chunkOverlap } = this.options;
    const chunks = [];
    
    // 段落ごとに分割（空行で区切る）
    const paragraphs = text.split(/\n\s*\n/);
    
    let currentChunk = '';
    for (const paragraph of paragraphs) {
      // 段落が単体でchunkSizeを超える場合は、さらに分割
      if (paragraph.length > chunkSize) {
        // 現在のチャンクが空でない場合は追加
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        
        // 長い段落を文単位で分割
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        
        let sentenceChunk = '';
        for (const sentence of sentences) {
          if (sentenceChunk.length + sentence.length <= chunkSize) {
            sentenceChunk += sentence;
          } else {
            chunks.push(sentenceChunk);
            sentenceChunk = sentence;
          }
        }
        
        if (sentenceChunk.length > 0) {
          currentChunk = sentenceChunk;
        }
      } 
      // 通常の段落処理
      else if (currentChunk.length + paragraph.length + 2 <= chunkSize) {
        // 現在のチャンクに段落を追加
        currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
      } else {
        // 現在のチャンクが一杯になったら追加
        chunks.push(currentChunk);
        currentChunk = paragraph;
      }
    }
    
    // 最後のチャンクを追加
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    // オーバーラップを適用
    if (chunkOverlap > 0 && chunks.length > 1) {
      const overlappedChunks = [];
      
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          // 最初のチャンクはそのまま
          overlappedChunks.push(chunks[i]);
        } else {
          // 前のチャンクの末尾を含める
          const prevChunk = chunks[i - 1];
          const overlapText = prevChunk.substring(Math.max(0, prevChunk.length - chunkOverlap));
          overlappedChunks.push(overlapText + chunks[i]);
        }
      }
      
      return overlappedChunks;
    }
    
    return chunks;
  }
}

module.exports = DocumentProcessor;
