FROM redis:alpine

COPY redis.conf /usr/local/etc/redis/redis.conf

# ヘルスチェック設定
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD redis-cli ping || exit 1

# 起動コマンド
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
