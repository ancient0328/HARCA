/**
 * HARCA ベクトルストアAPI 拡張検索機能テスト
 * 
 * メタデータフィルタリング、ハイブリッド検索、ハイライト機能をテストします
 */

const axios = require('axios');

// APIのベースURL
const API_BASE_URL = process.env.VECTOR_STORE_API_URL || 'http://localhost:3701';

// Axiosのデフォルト設定
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30秒でタイムアウト
  headers: {
    'Content-Type': 'application/json'
  }
});

// Axiosのインターセプターを設定
axiosInstance.interceptors.request.use(request => {
  console.log(`リクエスト送信: ${request.method.toUpperCase()} ${request.url}`);
  return request;
});

axiosInstance.interceptors.response.use(
  response => {
    console.log(`レスポンス受信: ${response.status} ${response.statusText}`);
    return response;
  },
  error => {
    if (error.response) {
      console.error(`エラーレスポンス: ${error.response.status} ${error.response.statusText}`);
      console.error('エラーデータ:', error.response.data);
    } else if (error.request) {
      console.error('レスポンスが受信されませんでした');
      console.error('リクエスト:', error.request);
    } else {
      console.error('リクエスト設定エラー:', error.message);
    }
    return Promise.reject(error);
  }
);

// テストデータ
const testDocuments = [
  {
    id: '1',
    text: '人工知能（AI）は、人間の知能を模倣するコンピュータシステムです。',
    metadata: {
      category: 'AI',
      level: 'beginner',
      tags: ['AI', '入門', 'コンピュータサイエンス'],
      date: new Date('2024-01-15').toISOString(),
      wordCount: 23
    }
  },
  {
    id: '2',
    text: '機械学習は、AIの一分野で、データからパターンを学習します。',
    metadata: {
      category: 'AI',
      level: 'intermediate',
      tags: ['AI', '機械学習', 'データサイエンス'],
      date: new Date('2024-02-20').toISOString(),
      wordCount: 19
    }
  },
  {
    id: '3',
    text: 'ディープラーニングは、ニューラルネットワークを使用した機械学習の一種です。',
    metadata: {
      category: 'AI',
      level: 'advanced',
      tags: ['AI', 'ディープラーニング', 'ニューラルネットワーク'],
      date: new Date('2024-03-10').toISOString(),
      wordCount: 25
    }
  },
  {
    id: '4',
    text: 'プログラミング言語は、コンピュータに命令を与えるための形式言語です。',
    metadata: {
      category: 'Programming',
      level: 'beginner',
      tags: ['プログラミング', 'コンピュータサイエンス'],
      date: new Date('2024-01-05').toISOString(),
      wordCount: 22
    }
  },
  {
    id: '5',
    text: 'Pythonは、読みやすさと簡潔さを重視した高水準プログラミング言語です。',
    metadata: {
      category: 'Programming',
      level: 'intermediate',
      tags: ['Python', 'プログラミング言語'],
      date: new Date('2024-02-10').toISOString(),
      wordCount: 24
    }
  }
];

// 基本的な検索テスト
async function testBasicSearch() {
  console.log('\nテスト1: 基本的な検索');
  try {
    const response = await axiosInstance.post('/api/search', {
      query: '機械学習とは何ですか？',
      documents: testDocuments,
      topK: 3,
      model: 'text-embedding-ada-002'
    });
    
    console.log('検索結果:');
    response.data.results.forEach((result, index) => {
      console.log(`${index + 1}. ID: ${result.id}, スコア: ${result.score.toFixed(4)}`);
      console.log(`   テキスト: ${result.text}`);
    });
    
    return true;
  } catch (error) {
    console.error('基本的な検索テスト中にエラーが発生しました:', error.message);
    return false;
  }
}

// メタデータフィルタリングテスト
async function testMetadataFiltering() {
  console.log('\nテスト2: メタデータフィルタリング');
  try {
    const response = await axiosInstance.post('/api/search', {
      query: 'プログラミング',
      documents: testDocuments,
      topK: 3,
      model: 'text-embedding-ada-002',
      filters: {
        level: 'beginner'
      }
    });
    
    console.log('フィルタリング条件: level=beginner');
    console.log('検索結果:');
    response.data.results.forEach((result, index) => {
      console.log(`${index + 1}. ID: ${result.id}, スコア: ${result.score.toFixed(4)}`);
      console.log(`   テキスト: ${result.text}`);
      console.log(`   メタデータ: ${JSON.stringify(result.metadata)}`);
    });
    
    return true;
  } catch (error) {
    console.error('メタデータフィルタリングテスト中にエラーが発生しました:', error.message);
    return false;
  }
}

// 複合フィルタリングテスト
async function testComplexFiltering() {
  console.log('\nテスト3: 複合フィルタリング');
  try {
    const response = await axiosInstance.post('/api/search', {
      query: 'AI',
      documents: testDocuments,
      topK: 3,
      model: 'text-embedding-ada-002',
      filters: {
        category: 'AI',
        wordCount: { gt: 20 }
      }
    });
    
    console.log('フィルタリング条件: category=AI, wordCount>20');
    console.log('検索結果:');
    response.data.results.forEach((result, index) => {
      console.log(`${index + 1}. ID: ${result.id}, スコア: ${result.score.toFixed(4)}`);
      console.log(`   テキスト: ${result.text}`);
      console.log(`   メタデータ: ${JSON.stringify(result.metadata)}`);
    });
    
    return true;
  } catch (error) {
    console.error('複合フィルタリングテスト中にエラーが発生しました:', error.message);
    return false;
  }
}

// ハイブリッド検索テスト
async function testHybridSearch() {
  console.log('\nテスト4: ハイブリッド検索');
  try {
    // ベクトル検索のみ
    const vectorResponse = await axiosInstance.post('/api/search', {
      query: 'ニューラルネットワーク',
      documents: testDocuments,
      topK: 3,
      model: 'text-embedding-ada-002',
      hybridAlpha: 0.0 // ベクトル検索のみ
    });
    
    console.log('ベクトル検索のみ (hybridAlpha=0.0):');
    vectorResponse.data.results.forEach((result, index) => {
      console.log(`${index + 1}. ID: ${result.id}, スコア: ${result.score.toFixed(4)}`);
      console.log(`   テキスト: ${result.text}`);
    });
    
    // ハイブリッド検索
    const hybridResponse = await axiosInstance.post('/api/search', {
      query: 'ニューラルネットワーク',
      documents: testDocuments,
      topK: 3,
      model: 'text-embedding-ada-002',
      hybridAlpha: 0.5 // ベクトル検索とキーワード検索を同等に重み付け
    });
    
    console.log('\nハイブリッド検索 (hybridAlpha=0.5):');
    hybridResponse.data.results.forEach((result, index) => {
      console.log(`${index + 1}. ID: ${result.id}, スコア: ${result.score.toFixed(4)}`);
      console.log(`   テキスト: ${result.text}`);
    });
    
    return true;
  } catch (error) {
    console.error('ハイブリッド検索テスト中にエラーが発生しました:', error.message);
    return false;
  }
}

// ハイライト機能テスト
async function testHighlighting() {
  console.log('\nテスト5: ハイライト機能');
  try {
    const response = await axiosInstance.post('/api/search', {
      query: 'プログラミング言語',
      documents: testDocuments,
      topK: 2,
      model: 'text-embedding-ada-002',
      highlight: true
    });
    
    console.log('ハイライト機能有効:');
    response.data.results.forEach((result, index) => {
      console.log(`${index + 1}. ID: ${result.id}, スコア: ${result.score.toFixed(4)}`);
      console.log(`   テキスト: ${result.text}`);
      
      if (result.highlights && result.highlights.length > 0) {
        console.log('   ハイライト位置:');
        result.highlights.forEach(highlight => {
          const highlightedText = result.text.substring(highlight.start, highlight.end);
          console.log(`   - [${highlight.start}-${highlight.end}]: "${highlightedText}"`);
        });
      } else {
        console.log('   ハイライトなし');
      }
    });
    
    return true;
  } catch (error) {
    console.error('ハイライト機能テスト中にエラーが発生しました:', error.message);
    return false;
  }
}

// メインテスト関数
async function runTests() {
  console.log('拡張検索機能テストを開始します...');
  
  // テスト1: 基本的な検索
  const basicSearchResult = await testBasicSearch();
  
  // テスト2: メタデータフィルタリング
  const metadataFilteringResult = await testMetadataFiltering();
  
  // テスト3: 複合フィルタリング
  const complexFilteringResult = await testComplexFiltering();
  
  // テスト4: ハイブリッド検索
  const hybridSearchResult = await testHybridSearch();
  
  // テスト5: ハイライト機能
  const highlightingResult = await testHighlighting();
  
  console.log('\nテスト結果サマリー:');
  console.log(`基本的な検索: ${basicSearchResult ? '成功' : '失敗'}`);
  console.log(`メタデータフィルタリング: ${metadataFilteringResult ? '成功' : '失敗'}`);
  console.log(`複合フィルタリング: ${complexFilteringResult ? '成功' : '失敗'}`);
  console.log(`ハイブリッド検索: ${hybridSearchResult ? '成功' : '失敗'}`);
  console.log(`ハイライト機能: ${highlightingResult ? '成功' : '失敗'}`);
  
  const allSuccess = basicSearchResult && metadataFilteringResult && 
                     complexFilteringResult && hybridSearchResult && 
                     highlightingResult;
  
  console.log(`\n総合結果: ${allSuccess ? '成功' : '失敗'}`);
  
  process.exit(allSuccess ? 0 : 1);
}

// テストを実行
runTests().catch(err => {
  console.error('テスト実行エラー:', err);
  process.exit(1);
});
