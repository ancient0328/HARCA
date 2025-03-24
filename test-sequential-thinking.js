/**
 * HARCAサーバーとSequential Thinkingサービスの連携テスト
 * 
 * このスクリプトは、HARCAサーバーを通じてSequential Thinkingサービスに
 * リクエストを送信し、応答を確認するためのテストクライアントです。
 */

import fetch from 'node-fetch';

// HARCAサーバーのエンドポイント
const HARCA_ENDPOINT = 'http://localhost:3700';
const SEQUENTIAL_THINKING_ENDPOINT = 'http://localhost:3740';

// Sequential Thinkingサービスのテスト
async function testSequentialThinking() {
  console.log('Sequential Thinkingサービス連携テストを開始します...');
  
  try {
    // 1. HARCAサーバーのヘルスチェック
    console.log('1. HARCAサーバーのヘルスチェックを実行中...');
    const healthResponse = await fetch(`${HARCA_ENDPOINT}/health`);
    
    if (!healthResponse.ok) {
      throw new Error(`HARCAサーバーのヘルスチェックに失敗しました: ${healthResponse.status} ${healthResponse.statusText}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('ヘルスチェック結果:', JSON.stringify(healthData, null, 2));
    
    // 2. Sequential Thinkingサービスのツール一覧を取得
    console.log('\n2. Sequential Thinkingサービスのツール一覧を取得しています...');
    
    try {
      // mcp.listToolsリクエストの作成
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: '1',
        method: 'mcp.listTools',
        params: {}
      };
      
      const listToolsResponse = await fetch(SEQUENTIAL_THINKING_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(listToolsRequest)
      });
      
      if (listToolsResponse.ok) {
        console.log('ツール一覧取得成功');
        const listToolsData = await listToolsResponse.json();
        console.log('利用可能なツール:', JSON.stringify(listToolsData, null, 2));
        
        // 3. Sequential Thinkingツールを実行
        console.log('\n3. Sequential Thinkingツールを実行しています...');
        
        const runToolRequest = {
          jsonrpc: '2.0',
          id: '2',
          method: 'mcp.runTool',
          params: {
            name: 'sequentialthinking',
            arguments: {
              thought: 'HARCAプロジェクトの構造を分析する',
              nextThoughtNeeded: true,
              thoughtNumber: 1,
              totalThoughts: 5,
              includeToolRecommendations: true
            }
          }
        };
        
        const runToolResponse = await fetch(SEQUENTIAL_THINKING_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(runToolRequest)
        });
        
        if (runToolResponse.ok) {
          console.log('ツール実行成功');
          const runToolData = await runToolResponse.json();
          console.log('レスポンス:', JSON.stringify(runToolData, null, 2));
        } else {
          const errorText = await runToolResponse.text();
          console.log(`ツール実行失敗: ${runToolResponse.status} ${runToolResponse.statusText}`);
          console.log('エラー詳細:', errorText);
        }
      } else {
        const errorText = await listToolsResponse.text();
        console.log(`ツール一覧取得失敗: ${listToolsResponse.status} ${listToolsResponse.statusText}`);
        console.log('エラー詳細:', errorText);
      }
    } catch (error) {
      console.log(`Sequential Thinkingサービスへのアクセス失敗: ${error.message}`);
    }
    
    // 4. Docker内部からSequential Thinkingサービスへのアクセスをテスト
    console.log('\n4. Docker内部からSequential Thinkingサービスへのアクセスをテストします...');
    
    try {
      // HARCAコンテナ内からSequential Thinkingサービスにwgetでアクセス
      const { exec } = await import('child_process');
      
      // ツール一覧取得リクエストを試す
      const dockerListToolsCommand = `docker exec harca-server wget -q -O - --header="Content-Type: application/json" --post-data='{"jsonrpc":"2.0","id":"1","method":"mcp.listTools","params":{}}' http://sequential-thinking:3740`;
      
      exec(dockerListToolsCommand, (error, stdout, stderr) => {
        if (error) {
          console.log(`Docker内部からのツール一覧取得リクエスト失敗: ${error.message}`);
          
          // コンテナ間のネットワーク接続を確認
          const networkCheckCommand = `docker exec harca-server ping -c 2 sequential-thinking`;
          exec(networkCheckCommand, (pingError, pingStdout, pingStderr) => {
            if (pingError) {
              console.log(`コンテナ間のネットワーク接続に問題があります: ${pingError.message}`);
              console.log(pingStderr);
            } else {
              console.log('コンテナ間のネットワーク接続は正常です:');
              console.log(pingStdout);
            }
            
            // ホスト名解決を確認
            const dnsCheckCommand = `docker exec harca-server nslookup sequential-thinking`;
            exec(dnsCheckCommand, (dnsError, dnsStdout, dnsStderr) => {
              if (dnsError) {
                console.log(`ホスト名解決に問題があります: ${dnsError.message}`);
                console.log(dnsStderr);
              } else {
                console.log('ホスト名解決は正常です:');
                console.log(dnsStdout);
              }
              
              console.log('\nテスト完了: 詳細なログを確認してください');
            });
          });
          
          return;
        }
        
        if (stderr) {
          console.log(`Docker内部からのツール一覧取得リクエストエラー: ${stderr}`);
          console.log('\nテスト完了: 詳細なログを確認してください');
          return;
        }
        
        console.log('Docker内部からのツール一覧取得リクエスト成功:');
        console.log(stdout.substring(0, 500) + (stdout.length > 500 ? '...' : ''));
        
        try {
          // ツール実行リクエストを試す
          const dockerRunToolCommand = `docker exec harca-server wget -q -O - --header="Content-Type: application/json" --post-data='{"jsonrpc":"2.0","id":"2","method":"mcp.runTool","params":{"name":"sequentialthinking","arguments":{"thought":"テスト","nextThoughtNeeded":true,"thoughtNumber":1,"totalThoughts":3,"includeToolRecommendations":true}}}' http://sequential-thinking:3740`;
          
          exec(dockerRunToolCommand, (runError, runStdout, runStderr) => {
            if (runError) {
              console.log(`Docker内部からのツール実行リクエスト失敗: ${runError.message}`);
              console.log('\nテスト完了: 詳細なログを確認してください');
              return;
            }
            
            if (runStderr) {
              console.log(`Docker内部からのツール実行リクエストエラー: ${runStderr}`);
              console.log('\nテスト完了: 詳細なログを確認してください');
              return;
            }
            
            console.log('Docker内部からのツール実行リクエスト成功:');
            console.log(runStdout.substring(0, 500) + (runStdout.length > 500 ? '...' : ''));
            console.log('\nテスト完了: 詳細なログを確認してください');
          });
        } catch (parseError) {
          console.log('Docker内部からのレスポンスのパースに失敗:', parseError.message);
          console.log('\nテスト完了: 詳細なログを確認してください');
        }
      });
    } catch (error) {
      console.log(`Docker内部からのテスト実行エラー: ${error.message}`);
      console.log('\nテスト完了: 詳細なログを確認してください');
    }
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    console.log('\nテスト完了: 詳細なログを確認してください');
  }
}

// テストを実行
testSequentialThinking();
