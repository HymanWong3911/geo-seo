#!/usr/bin/env bash
# Worker 监管脚本：worker 进程崩溃后自动重启。
# 用法：./scripts/supervise-worker.sh
# 写日志到 /tmp/worker-supervisor.log
set -u
LOG=/tmp/worker-supervisor.log
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

log() {
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*" >> "$LOG"
}

cd "$PROJECT_DIR"

# 先杀掉可能残留的 worker
pkill -f "src/workers/index.ts" 2>/dev/null
sleep 2

# 拉取最新代码（如是 git repo）
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  git fetch origin 2>/dev/null || true
  # 不自动 reset，避免覆盖本地修改
fi

while true; do
  log "starting worker..."
  ./node_modules/.bin/tsx src/workers/index.ts >> "$LOG" 2>&1
  EXIT=$?
  log "worker exited with code $EXIT, restarting in 5s..."
  sleep 5
done
