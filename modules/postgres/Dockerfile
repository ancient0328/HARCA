FROM postgres:15-alpine

# 必要なパッケージのインストール
RUN apk add --no-cache \
    git \
    build-base \
    clang \
    llvm \
    postgresql-dev

# pgvectorのインストール
RUN git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && mkdir -p /usr/share/postgresql/extension \
    && mkdir -p /usr/share/postgresql/extension/sql \
    && cp /pgvector/vector.control /usr/share/postgresql/extension/ \
    && cp /pgvector/sql/*.sql /usr/share/postgresql/extension/sql/

# クリーンアップ
RUN apk del git build-base clang llvm \
    && rm -rf /pgvector

# ヘルスチェック用のスクリプトをコピー
COPY ./healthcheck.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/healthcheck.sh

# PostgreSQLの設定ファイルを作成
RUN echo "shared_preload_libraries = 'vector'" >> /usr/local/share/postgresql/postgresql.conf.sample

# デフォルトのポートを3730に設定
ENV PGPORT=3730

HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD ["healthcheck.sh"]
