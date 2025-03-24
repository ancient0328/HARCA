FROM node:22-alpine AS build

# 作業ディレクトリの設定
WORKDIR /app

# 依存関係のインストール用ファイルのみをコピー（キャッシュ最適化）
COPY package.json pnpm-lock.yaml ./

# 開発依存関係のインストール
RUN npm install -g pnpm && \
    pnpm install --shamefully-hoist && \
    # iconv-liteの問題を解決するための追加設定
    cd node_modules/iconv-lite && \
    npm install && \
    cd ../..

# ソースコードのコピー（node_modulesを除外）
COPY core ./core
COPY features ./features
COPY scripts ./scripts
COPY index.js ./
COPY package.json ./

# 本番環境用イメージ
FROM node:22-alpine AS production

# 作業ディレクトリの設定
WORKDIR /app

# 環境変数の設定
ENV NODE_ENV=production
ENV PORT=3700
# ESモジュールのサポートを強化
ENV NODE_OPTIONS="--experimental-modules --es-module-specifier-resolution=node"
# 依存関係解決パスの設定
ENV NODE_PATH="/app/node_modules:/app/node_modules/.pnpm"
# AIエージェント連携のための環境変数
ENV RESPONSE_FORMAT=json
ENV WINDSURF_INTEGRATION=true
# HARCAモード設定
ENV HARCA_MODE=http

# ビルドステージから必要なファイルをコピー
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/core /app/core
COPY --from=build /app/features /app/features
COPY --from=build /app/scripts /app/scripts
COPY --from=build /app/index.js /app/
COPY --from=build /app/package.json /app/

# ログディレクトリの作成
RUN mkdir -p /app/logs && \
    # ヘルスチェック用のツールをインストール
    apk add --no-cache wget

# ヘルスチェックの設定
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:3700/health || exit 1

# 公開ポート
EXPOSE 3700

# 起動コマンド
CMD ["node", "scripts/start-harca.js", "--mode=http"]
