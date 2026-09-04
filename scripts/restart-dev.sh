#!/usr/bin/env bash
# 一键重启 GEO-SEO 本地开发服务(web + worker,数据保留)
# 用法: ./scripts/restart-dev.sh
set -u
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

echo "🔧 清理旧进程..."
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "tsx.*workers/index" 2>/dev/null
pkill -f "supervise-next" 2>/dev/null
pkill -f "supervise-worker" 2>/dev/null
sleep 2

echo "🐘 检查数据库..."
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'geo-seo-postgres-1'; then
  echo "  启动 postgres + redis..."
  docker compose up -d postgres redis 2>&1 | tail -3
  sleep 3
else
  echo "  ✓ postgres + redis 已在跑"
fi

echo "🌐 启动 Web (next dev :3010)..."
nohup ./node_modules/.bin/next dev -p 3010 > /tmp/next-direct.log 2>&1 < /dev/null &
disown
nohup bash scripts/supervise-worker.sh > /dev/null 2>&1 < /dev/null &
disown

echo "⏳ 等待服务就绪..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3010/api/health 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo ""
    echo "✅ 服务已就绪"
    echo ""
    echo "   Web:    http://localhost:3010"
    echo "   登录:   admin@example.com / Admin@2026"
    echo "   日志:   tail -f /tmp/next-direct.log"
    echo "           tail -f /tmp/worker-supervisor.log"
    exit 0
  fi
  echo -n "."
done
echo ""
echo "⚠️  30s 内未就绪,查看日志: tail -f /tmp/next-direct.log"
