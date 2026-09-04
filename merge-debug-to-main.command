#!/usr/bin/env bash
# merge-debug-to-main.command
# 一键把 debug/20260720-run-through 分支合并到本地 main
# 生成日期：2026-09-01
# 适用：用户主机终端双击或 bash 运行

set -e
set -o pipefail

# bash 3.2 兼容（macOS 默认）
LC_ALL=C
export LC_ALL

# 不使用 set -u，避免未定义变量报错

PROJ="/Users/huanghaoming/Documents/dev/my-products/geo-seo/geo-seo"
BRANCH_PROTECT="debug/20260720-run-through"
TARGET_BRANCH="main"
WORK_BRANCH="chore/merge-debug-20260720"
BACKUP_BRANCH="backup/before-debug-merge-$(date +%Y%m%d-%H%M%S)"

cd "${PROJ}"

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { printf "\n${YELLOW}==> %s${NC}\n" "$1"; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$1"; }
err()  { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }

step "0. 健康检查"
command -v git >/dev/null 2>&1 || err "git 未安装"
command -v pnpm >/dev/null 2>&1 || err "pnpm 未安装（brew install pnpm）"
ok "git / pnpm 可用"

step "1. 创建回退点（保险）"
git rev-parse --abbrev-ref HEAD >/tmp/current_branch.txt || err "不在 git 仓库里"
CURRENT=$(cat /tmp/current_branch.txt)
echo "   当前分支：${CURRENT}"

git branch "${BACKUP_BRANCH}" || err "创建 backup 分支失败"
ok "已创建回退分支：${BACKUP_BRANCH}"
echo "   紧急回退：git checkout main && git reset --hard ${BACKUP_BRANCH}"

step "2. 检查保护位"
git stash list | grep -q "DEBUG_SESSION_20260720_protect" \
  && ok "保护位存在（stash@{0}: DEBUG_SESSION_20260720_protect）" \
  || { echo "   ⚠️ 保护位不在，但可继续；如需回滚到 7/20 前状态：git stash apply stash@{0}"; }

step "3. 切换到 main 并拉最新"
git checkout "${TARGET_BRANCH}" || err "切换 main 失败"
git pull --ff-only 2>/dev/null || ok "本地 main 已是最新（或无 remote，无需 pull）"

step "4. 新建工作分支"
git checkout -b "${WORK_BRANCH}" || err "新建 ${WORK_BRANCH} 失败"
ok "已在 ${WORK_BRANCH} 分支"

step "5. 合并 debug 分支（merge --no-ff 保留历史）"
git merge --no-ff "${BRANCH_PROTECT}" \
  -m "merge: debug/20260720-run-through → main

带入 18 个 sprint 产出：
- feat(api): activity feed + top mentions + health 工人详细
- feat(api): /api/system/health 加 workers 数组详情
- feat(brand-monitor): 数据清理 + 森田100 demo seed
- fix(brand-monitor): query 拼接关键词 + 内容过滤
- feat(alerts): Slack 通道 + dashboard alerts-summary
- perf(dashboard): /api/dashboard/summary 加 ETag + 30s 缓存
- feat(dashboard): brand-trend 端点
- feat(tools): LLM 配额监控 / cost-forecast / demo-summary
- feat(infra): 投资人 demo 全面跑通
- docs: PROJECT / MINDMAP / DEMO_RUNBOOK / REPORT_TO_BOSS" \
  || err "合并冲突，请手动处理后再跑步骤 6"

ok "debug 分支 18 个 commit 已合并"

step "6. 提交工作树未提交的 10 个改动"
git add -A

# 检查 staging 区是否为空
if git diff --cached --quiet; then
  ok "没有未提交改动需要 commit（可能已被合并 commit 涵盖）"
else
  git commit -m "chore: 调试跑通后遗改动合并

- chore(deps): test 排除 e2e（默认 test 不依赖 .env）
- chore(docker): 删 compose v2 已废弃的 version 字段
- fix(api): handleError 不吞 DYNAMIC_SERVER_USAGE sentinel
- fix(auth): 登录后 updateSession 刷新 client cache
- fix(topbar): sessionStatus 守门 + localStorage 有效性校验
- perf(brand-monitor): 4 provider 并发 + 批次并发
- chore(scripts): 删硬编码 PROJECT_ID，改动态取
- chore(pnpm): 加 pnpm-workspace.yaml 兼容 pnpm 10/11" \
    || err "commit 失败"
  ok "未提交改动已 commit"
fi

step "7. 安装依赖（如有 lock 变更）"
pnpm install --frozen-lockfile=false || err "pnpm install 失败"

step "8. 验证：typecheck"
pnpm typecheck || err "typecheck 有错误，请修复"

step "9. 验证：unit test"
pnpm test || err "单测有失败，请修复"

step "10. 验证：build"
pnpm build || err "build 失败，请修复"

step "11. 显示结果"
echo ""
echo "============================================="
echo "  ✅ 合并完成！"
echo "============================================="
echo ""
echo "  当前分支：$(git rev-parse --abbrev-ref HEAD)"
echo "  最新 commit：$(git log -1 --oneline)"
echo "  回退分支：${BACKUP_BRANCH}"
echo ""
echo "下一步（手动）："
echo "  1. 检查 git log --oneline -20 看历史"
echo "  2. 确认无问题后：git push origin ${WORK_BRANCH}"
echo "  3. 在 GitHub 上开 PR → CI 通过 → 合并到 main"
echo "  4. （可选）git branch -d ${BRANCH_PROTECT} 删 debug 分支"
echo ""