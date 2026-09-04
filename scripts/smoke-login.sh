#!/usr/bin/env bash
# 烟雾测试:登录 → 探 4 个 refactor 路由 → /api/health
# 用法:bash scripts/smoke-login.sh [BASE_URL]
#  默认 BASE_URL=http://localhost:3010
# 退出码:0 全部 2xx / 3xx,1 任一 4xx / 5xx / 网络失败
set -u

BASE="${1:-http://localhost:3010}"
EMAIL="${SMOKE_EMAIL:-${SEED_ADMIN_EMAIL:-}}"
PASSWORD="${SMOKE_PASSWORD:-${SEED_ADMIN_PASSWORD:-}}"
if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  printf '请配置 SMOKE_EMAIL / SMOKE_PASSWORD\n' >&2
  exit 2
fi
COOKIE="$(mktemp -t smoke.XXXXXX)"
trap 'rm -f "$COOKIE"' EXIT

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
blue()   { printf '\033[34m%s\033[0m\n' "$*"; }

probe() {
  # probe <label> <expected_status_regex> <curl_args...>
  local label="$1"; local expect="$2"; shift 2
  local code body
  body="$(curl -sS -o /tmp/smoke.body -w '%{http_code}' "$@" || echo 000)"
  code="$body"
  if [[ "$code" =~ $expect ]]; then
    green "✓ $label  HTTP $code"
    return 0
  else
    red "✗ $label  HTTP $code (expected $expect)"
    yellow "  body:"; head -c 400 /tmp/smoke.body 2>/dev/null; echo
    return 1
  fi
}

fail=0

blue "=== smoke @ $BASE ==="
blue "user: $EMAIL"

# 1. csrf
csrf_json="$(curl -sS -c "$COOKIE" "$BASE/api/auth/csrf")"
csrf="$(printf '%s' "$csrf_json" | sed -n 's/.*"csrfToken":"\([^"]*\)".*/\1/p')"
if [[ -z "$csrf" ]]; then
  red "✗ csrf token 解析失败"
  echo "$csrf_json"; fail=1
else
  green "✓ csrf  token=${csrf:0:12}…"
fi

# 2. login
login_code="$(curl -sS -b "$COOKIE" -c "$COOKIE" \
  -o /tmp/smoke.body -w '%{http_code}' \
  -X POST "$BASE/api/auth/callback/credentials" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "email=$EMAIL" \
  --data-urlencode "password=$PASSWORD" \
  --data-urlencode "csrfToken=$csrf" \
  --data-urlencode "callbackUrl=$BASE/dashboard" \
  --data-urlencode "json=true" \
  || echo 000)"

if [[ "$login_code" =~ ^(200|302)$ ]]; then
  green "✓ login HTTP $login_code"
else
  red "✗ login HTTP $login_code"
  head -c 400 /tmp/smoke.body 2>/dev/null; echo
  fail=1
fi

# 3. session 校验
session="$(curl -sS -b "$COOKIE" "$BASE/api/auth/session")"
if printf '%s' "$session" | grep -q '"user"'; then
  green "✓ session  $(printf '%s' "$session" | head -c 120)…"
else
  yellow "? session $session"
fi

# 4. /api/health (公开)
probe "/api/health"  '^200$' "$BASE/api/health" || fail=1

# 5. 4 个 refactor 路由(都要登录态)
probe "/insights"        '^200$' -b "$COOKIE" "$BASE/insights"        || fail=1
probe "/system/health"   '^200$' -b "$COOKIE" "$BASE/system/health"   || fail=1
probe "/llm/usage"       '^200$' -b "$COOKIE" "$BASE/llm/usage"       || fail=1

# 取最近一次 GEO run id(从 /api/health 拿到)
last_id="$(curl -sS "$BASE/api/health" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p' | head -1)"
if [[ -n "$last_id" ]]; then
  probe "/geo/runs/$last_id" '^200$' -b "$COOKIE" "$BASE/geo/runs/$last_id" || fail=1
else
  yellow "skip /geo/runs/[id] (no recent GEO run)"
fi

# 6. /api/llm/stats
probe "/api/llm/stats"   '^200$' -b "$COOKIE" "$BASE/api/llm/stats?days=7&groupBy=provider" || fail=1

echo
if [[ "$fail" -eq 0 ]]; then
  green "=== smoke OK ==="
  exit 0
else
  red "=== smoke FAIL ==="
  exit 1
fi
