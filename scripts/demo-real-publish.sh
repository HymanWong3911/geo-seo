#!/usr/bin/env bash
# 端到端真实发布 demo：
# 1. 启动本地 webhook echo 接收器（端口 3099）
# 2. 把现有 CUSTOM_WEBHOOK 测试目标的 config.url 指向它
# 3. 找一个 APPROVED 草稿，调用 /api/drafts/{id}/distribute
# 4. 验证 DistributionLog 状态 = SUCCESS + externalUrl 已写库
# 5. 验证 echo server 真的收到了 payload
# 用法：./scripts/demo-real-publish.sh [projectId] [draftId]
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

PROJECT_ID="${1:-cmq9d9xzp001io8hucplvl783}"
WEBHOOK_PORT=3099
WEBHOOK_URL="http://127.0.0.1:${WEBHOOK_PORT}/hook"
COOKIE_FILE="${COOKIE_FILE:-/tmp/cookies.txt}"
BASE="${BASE:-http://localhost:3010}"

step() { echo; echo "==> $*"; }

# 1. 启动 echo server（如未跑）
step "确保 webhook echo server 在 :${WEBHOOK_PORT}"
if ! lsof -iTCP:${WEBHOOK_PORT} -sTCP:LISTEN -n -P >/dev/null 2>&1; then
  rm -rf /tmp/webhook-echo
  node -e "const{spawn}=require('child_process'),fs=require('fs');const out=fs.openSync('/tmp/webhook-echo.log','w');const c=spawn('node',['scripts/webhook-echo-server.mjs','${WEBHOOK_PORT}'],{detached:true,stdio:['ignore',out,out]});c.unref();"
  sleep 1
fi
curl -sS -X POST -H "Content-Type: application/json" -d '{"smoke":true}' "${WEBHOOK_URL}" >/dev/null
echo "    OK -> $WEBHOOK_URL"

# 2. 找一个 CUSTOM_WEBHOOK 目标并写入 url
step "配置 CUSTOM_WEBHOOK target -> $WEBHOOK_URL"
TARGET_ID=$(node -e "
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const t=await p.distributionTarget.findFirst({where:{projectId:'${PROJECT_ID}',platform:'CUSTOM_WEBHOOK',active:true}});console.log(t?.id??'');await p.\$disconnect();})();
")
if [ -z "$TARGET_ID" ]; then
  echo "    没有 CUSTOM_WEBHOOK 目标，请先在 UI 里添加"
  exit 1
fi
curl -sS -b "$COOKIE_FILE" -X PATCH -H "Content-Type: application/json" \
  -d "{\"config\":{\"url\":\"${WEBHOOK_URL}\"}}" \
  "${BASE}/api/distribution-targets/${TARGET_ID}" -o /dev/null
echo "    OK -> targetId=$TARGET_ID"

# 3. 找 APPROVED 草稿
DRAFT_ID="${2:-}"
if [ -z "$DRAFT_ID" ]; then
  step "找一个 APPROVED 草稿"
  DRAFT_ID=$(node -e "
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{const d=await p.contentDraft.findFirst({where:{projectId:'${PROJECT_ID}',status:'APPROVED'},orderBy:{createdAt:'desc'}});console.log(d?.id??'');await p.\$disconnect();})();
")
fi
if [ -z "$DRAFT_ID" ]; then
  echo "    没有 APPROVED 草稿"
  exit 1
fi
echo "    OK -> draftId=$DRAFT_ID"

# 4. 触发 distribution
step "POST /api/drafts/$DRAFT_ID/distribute"
RESP=$(curl -sS -b "$COOKIE_FILE" -X POST -H "Content-Type: application/json" \
  -d "{\"targetIds\":[\"${TARGET_ID}\"]}" \
  "${BASE}/api/drafts/${DRAFT_ID}/distribute")
echo "    response: $RESP"

# 5. 验证 DistributionLog
step "查询 DistributionLog"
node -e "
const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();
(async()=>{
  const log=await p.distributionLog.findFirst({where:{targetId:'${TARGET_ID}'},orderBy:{createdAt:'desc'},include:{target:{select:{name:true,platform:true}},draft:{select:{title:true}}}});
  if(!log){console.log('    NO LOG');process.exit(1);}
  console.log('    status        =', log.status, log.status==='SUCCESS'?'✓':'✗');
  console.log('    externalId    =', log.externalId);
  console.log('    externalUrl   =', log.externalUrl);
  console.log('    attempts      =', log.attempts);
  console.log('    errorMessage  =', log.errorMessage??'none');
  console.log('    target        =', log.target.name);
  console.log('    draft         =', log.draft?.title);
  await p.\$disconnect();
})();
"

step "echo server 最近一条记录"
LAST=$(ls -t /tmp/webhook-echo/*.json 2>/dev/null | head -1)
if [ -n "$LAST" ]; then
  echo "    file = $LAST"
  head -c 400 "$LAST"
  echo
fi
echo
echo "✅ 端到端真实发布 demo 完成"
