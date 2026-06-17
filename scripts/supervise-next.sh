#!/usr/bin/env bash
# Next dev 监管脚本：next dev 崩溃后自动重启。
set -u
LOG=/tmp/next-supervisor.log
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT=${NEXT_PORT:-3010}

log() {
  echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*" >> "$LOG"
}

cd "$PROJECT_DIR"

pkill -f "next dev -p $PORT" 2>/dev/null
sleep 2

while true; do
  log "starting next dev on port $PORT..."
  ./node_modules/.bin/next dev -p "$PORT" >> "$LOG" 2>&1
  EXIT=$?
  log "next dev exited with code $EXIT, restarting in 5s..."
  sleep 5
done
