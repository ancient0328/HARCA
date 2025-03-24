FROM node:20-alpine AS builder

WORKDIR /app

# pnpmを使用するための設定
RUN corepack enable && corepack prepare pnpm@latest --activate

# 依存関係のインストールに必要なファイルをコピー
COPY package.json tsconfig.json ./

# 依存関係のインストール
RUN pnpm install

# ソースコードをコピー
COPY src/ ./src/

# ビルド
RUN pnpm build

FROM node:20-alpine AS release

WORKDIR /app

# pnpmを使用するための設定
RUN corepack enable && corepack prepare pnpm@latest --activate

# 本番環境用の設定
ENV NODE_ENV=production
# デバッグモードはデフォルトで無効（環境変数で上書き可能）
ENV DEBUG=false
# ポート設定（環境変数で上書き可能）
ENV PORT=3740

# ビルドした成果物と必要なファイルをコピー
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# 本番環境用の依存関係のみをインストール
RUN pnpm install --prod

# HARCAプロジェクト規約に従ったポート設定
EXPOSE 3740

# 起動コマンド
ENTRYPOINT ["node", "dist/start-server.js"]
