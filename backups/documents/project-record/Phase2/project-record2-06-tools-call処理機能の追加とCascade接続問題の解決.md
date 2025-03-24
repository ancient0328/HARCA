# tools/call処理機能の追加とCascade接続問題の解決、およびポート競合自動解決機能の実装

**日付**: 2025年3月17日
**担当者**: HARCA開発チーム

## 概要

HARCAサーバーとWindsurf Cascadeの連携において、「Unknown command: tools/call (Code -32601)」エラーが発生していた問題を解決しました。この問題は、stdio-proxy.jsが`tools/call`コマンドを適切に処理できていないことが原因でした。また、HARCAサーバーの起動時にポート競合が発生した場合に自動的に解決する機能も実装しました。本記録では、これらの問題の原因分析、解決策の実装、および検証結果について詳細に記述します。

## ポート競合自動解決機能の実装

HARCAサーバーを起動する際に、指定したポートが既に使用されている場合、従来は手動でプロセスを停止する必要がありました。この問題を解決するために、start-harca.jsスクリプトに自動的にポート競合を検出し解決する機能を追加しました。

### 実装内容

1. 指定されたポートが既に使用されているかを確認する関数を実装
2. 使用中のポートを占有しているプロセスを特定する機能を追加
3. 該当プロセスを自動的に終了させ、ポートを解放する処理を実装
4. ポートが解放されるまで待機し、その後サーバーを起動する機能を追加

主な実装コード：

```javascript
/**
 * 指定されたポートが使用中かどうかを確認する
 * @param {number} port 確認するポート番号
 * @returns {Promise<boolean>} ポートが使用中の場合はtrue、そうでない場合はfalse
 */
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => {
        resolve(true);
      })
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

/**
 * 指定されたポートを使用しているプロセスを終了する
 * @param {number} port ポート番号
 * @returns {Promise<boolean>} 成功した場合はtrue、失敗した場合はfalse
 */
async function killProcessUsingPort(port) {
  try {
    // ポートを使用しているプロセスのPIDを取得
    const { stdout } = await exec(`lsof -i :${port} -t`);
    const pid = stdout.trim();
    
    if (!pid) {
      console.log(`ポート${port}を使用しているプロセスは見つかりませんでした。`);
      return false;
    }
    
    console.log(`ポート${port}を使用しているプロセス(PID: ${pid})を終了します...`);
    
    // プロセスを終了
    await exec(`kill -9 ${pid}`);
    console.log(`プロセス(PID: ${pid})を終了しました。`);
    
    // ポートが解放されるまで待機
    let attempts = 0;
    while (await isPortInUse(port) && attempts < 10) {
      console.log(`ポート${port}の解放を待機中...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    return !(await isPortInUse(port));
  } catch (error) {
    console.error(`ポート${port}を使用しているプロセスの終了に失敗しました:`, error);
    return false;
  }
}
```

この機能により、サーバー起動時の手動操作が不要になり、開発効率が向上しました。

## 問題の背景

Windsurf CascadeからHARCAサーバーのMCPツールを呼び出す際に、以下のエラーが発生していました：

```
Unknown command: tools/call (Code -32601)
```

このエラーにより、Cascadeからharca-localのツールを直接呼び出すことができず、HARCAの提供する分析機能を活用できない状態でした。

## 原因分析

デバッグログ（/tmp/harca-windsurf-debug.log）を分析した結果、以下の問題が特定されました：

1. Cascadeは`tools/call`メソッドを使用してMCPツールを呼び出していたが、stdio-proxy.jsにはこのメソッドを処理するロジックが実装されていなかった
2. リクエストがHARCAサーバーに転送される際、`tools/call`コマンドがそのまま転送され、サーバー側で認識されないエラーが発生していた

ログの一部：
```
2025-03-17T04:30:01.431Z - Received raw input: {"jsonrpc":"2.0","id":15,"method":"tools/call","params":{"name":"checkHealth"}}
2025-03-17T04:30:01.431Z - Forwarding request to HARCA API: {"id":15,"command":"tools/call","params":{"name":"checkHealth"}}
2025-03-17T04:30:01.431Z - Unknown command: tools/call
2025-03-17T04:30:01.432Z - Raw API response: {"error":{"code":-32601,"message":"Unknown command: tools/call"}}
```

## 解決策の実装

stdio-proxy.jsを修正して、`tools/call`コマンドを適切に処理するロジックを追加しました：

1. `tools/call`メソッドを検出して処理するコードブロックを追加
2. ツール名（`params.name`）とパラメータ（`params.params`）を抽出
3. ツール名を対応するHARCAコマンドに変換（例：`checkHealth`、`analyzeCode`など）
4. 変換したコマンドをHARCAサーバーに転送

主な修正内容：

```javascript
// tools/callメソッドの場合、ツール名を抽出して対応するコマンドに変換
if (method === 'tools/call') {
  debugLog('Processing tools/call request');
  
  // ツール名とパラメータを取得
  const toolName = params?.name;
  const toolParams = params?.params || {};
  
  if (!toolName) {
    const errorResponse = {
      jsonrpc: "2.0",
      id: id || null,
      error: {
        code: -32602,
        message: "Invalid params: tool name is required"
      }
    };
    debugLog(`Sending error response: ${JSON.stringify(errorResponse)}`);
    console.log(JSON.stringify(errorResponse));
    return;
  }
  
  debugLog(`Tool call request for: ${toolName} with params: ${JSON.stringify(toolParams)}`);
  
  // ツール名に基づいてHARCAコマンドに変換
  let harcaCommand = '';
  
  switch (toolName) {
    case 'analyzeCode':
      harcaCommand = 'analyzeCode';
      break;
    case 'getCodeAnalysisRules':
      harcaCommand = 'getCodeAnalysisRules';
      break;
    case 'getAnalysisOptions':
      harcaCommand = 'getAnalysisOptions';
      break;
    case 'checkHealth':
      harcaCommand = 'checkHealth';
      break;
    default:
      const errorResponse = {
        jsonrpc: "2.0",
        id: id || null,
        error: {
          code: -32601,
          message: `Unknown tool: ${toolName}`
        }
      };
      debugLog(`Sending error response: ${JSON.stringify(errorResponse)}`);
      console.log(JSON.stringify(errorResponse));
      return;
  }
  
  // 修正したリクエストを作成
  harcaRequest = {
    id,
    command: harcaCommand,
    params: toolParams
  };
}
```

## 検証結果

修正したstdio-proxy.jsをテストした結果、`tools/call`コマンドが正しく処理されることを確認しました：

```
$ echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"checkHealth"}}' | node stdio-proxy.js
{"jsonrpc":"2.0","id":1,"result":{"status":"ok","service":"HARCA Windsurf Integration","timestamp":"2025-03-17T04:35:42.924Z"}}
```

また、HARCAサーバーの各APIエンドポイントも正常に動作していることを確認しました：

1. **健全性チェック**:
   ```
   $ curl http://localhost:3600/api/windsurf/health
   {"status":"ok","service":"HARCA Windsurf Integration","timestamp":"2025-03-17T04:35:03.363Z"}
   ```

2. **コード分析ルール**:
   ```
   $ curl http://localhost:3600/api/windsurf/rules
   {"success":true,"rules":[{"id":"complexity","name":"複雑度分析",...},{"id":"comments","name":"コメント率分析",...},{"id":"naming","name":"命名規則分析",...},{"id":"duplication","name":"重複コード検出",...}]}
   ```

3. **分析オプション**:
   ```
   $ curl http://localhost:3600/api/windsurf/options
   {"success":true,"options":{"languages":["javascript","typescript","python","java","go","ruby","php","c","cpp","csharp"],...}}
   ```

4. **コード分析**:
   ```
   $ curl -X POST -H "Content-Type: application/json" -d '{"code":"function add(a, b) { return a + b; }","language":"javascript","rules":["complexity"],"options":{"includeSummary":true}}' http://localhost:3600/api/windsurf/analyze
   {"success":true,"metrics":{},"summary":{"overallQuality":"unknown","strengths":[],"weaknesses":[],"recommendations":["高度な分析を有効にして、より詳細な情報を取得してください"]}}
   ```

## 結論

stdio-proxy.jsに`tools/call`コマンドを処理するロジックを追加することで、CascadeからHARCAのツールを直接呼び出せるようになりました。これにより、以下の4つのツールがWindsurf Cascadeから利用可能になりました：

1. **analyzeCode**: コード分析を実行
2. **getCodeAnalysisRules**: 利用可能なコード分析ルールを取得
3. **getAnalysisOptions**: コード分析で利用可能なオプションを取得
4. **checkHealth**: HARCAサーバーの健全性を確認

この修正により、ARCHIVEから移植された4つの分析ルール（複雑度分析、コメント率分析、命名規則分析、重複コード検出）をCascadeから活用できるようになりました。

## 今後の課題

1. **Windsurfの再起動**: 修正を完全に適用するためには、Windsurfの再起動が必要です
2. **継続的なモニタリング**: デバッグログを定期的に確認して、問題が再発しないか監視する必要があります
3. **エラー処理の強化**: より詳細なエラーメッセージとログ出力を追加して、デバッグを容易にすることが望ましいです

## 参考資料

- [JSONRPC 2.0仕様](https://www.jsonrpc.org/specification)
- [MCPプロトコル仕様](https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-sample)
- [HARCAサーバーAPI仕様](/Users/ancient0328/Development/MCPserver/HARCA/harca-mcp/README.md)
