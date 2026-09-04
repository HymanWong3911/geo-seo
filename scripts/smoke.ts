// 端到端冒烟测试 - 验证所有关键路径跑通
// 用法: npx tsx --env-file=.env scripts/smoke.ts
import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const EMAIL = process.env.SMOKE_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? "";
const PASSWORD = process.env.SMOKE_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "";
if (!EMAIL || !PASSWORD) throw new Error("请配置 SMOKE_EMAIL / SMOKE_PASSWORD");
let projectId = process.env.SMOKE_PROJECT_ID ?? "";
const DEBUG = process.env.SMOKE_DEBUG === "1";

interface Check { name: string; status: "PASS" | "FAIL"; detail: string; ms: number; }
const checks: Check[] = [];
let cookieJar = new Map<string, string>();

function parseAndStore(c: string) {
  const semi = c.indexOf(";");
  const pair = semi >= 0 ? c.slice(0, semi) : c;
  const eqIdx = pair.indexOf("=");
  if (eqIdx < 0) return;
  const k = pair.slice(0, eqIdx).trim();
  const v = decodeURIComponent(pair.slice(eqIdx + 1)).trim();
  if (k) {
    cookieJar.set(k, v);
    if (DEBUG) console.log(`   [cookie] ${k}=${v.slice(0, 30)}${v.length > 30 ? "..." : ""}`);
  }
}

function setCookies(headers: Headers) {
  const all = (headers as any).getSetCookie?.() ?? null;
  if (Array.isArray(all) && all.length > 0) {
    for (const c of all) parseAndStore(c);
    return;
  }
  const raw = headers.get("set-cookie") ?? "";
  if (!raw) return;
  const re = /,\s*(?=[^,;=\s]+\s*=)/g;
  const parts = raw.split(re);
  for (const p of parts) parseAndStore(p);
}

function cookieHeader(): string {
  return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function call(
  path: string,
  opts: { method?: string; body?: unknown; formBody?: URLSearchParams; auth?: boolean; sendCookies?: boolean; timeout?: number } = {},
): Promise<{ status: number; body: any }> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.body) headers["Content-Type"] = "application/json";
  if (opts.formBody) headers["Content-Type"] = "application/x-www-form-urlencoded";
  // 默认请求都发送已收集的 cookie (signin 需要 csrf cookie)
  if (opts.sendCookies !== false) headers["Cookie"] = cookieHeader();
  if (opts.auth) headers["Cookie"] = cookieHeader();
  const res = await fetch(`${BASE}${path}`, {
    method, headers,
    body: opts.body ? JSON.stringify(opts.body) : opts.formBody ? opts.formBody.toString() : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(opts.timeout ?? 30000),
  });
  setCookies(res.headers);
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch {}
  return { status: res.status, body };
}

async function check(name: string, fn: () => Promise<{ ok: boolean; detail: string }>) {
  const start = Date.now();
  try {
    const r = await fn();
    checks.push({ name, status: r.ok ? "PASS" : "FAIL", detail: r.detail, ms: Date.now() - start });
  } catch (e: any) {
    checks.push({ name, status: "FAIL", detail: e.message, ms: Date.now() - start });
  }
}

async function login(): Promise<boolean> {
  await call("/api/auth/csrf");
  const csrfToken: string = cookieJar.get("authjs.csrf-token") ?? "";
  // csrfToken 格式: "value|hash", 取前半部分
  const csrfValue = csrfToken.split("|")[0];
  const params = new URLSearchParams();
  params.append("csrfToken", csrfValue);
  params.append("email", EMAIL);
  params.append("password", PASSWORD);
  params.append("redirect", "false");
  params.append("callbackUrl", `${BASE}/`);
  await call("/api/auth/callback/credentials", { method: "POST", formBody: params });
  const session = await call("/api/auth/session", { auth: true });
  return !!session.body?.user;
}

async function main() {
  console.log(`\n🔥 GEO-SEO 端到端冒烟测试 -> ${BASE}  ${new Date().toISOString()}\n`);

  await check("1.健康检查", async () => {
    const { status, body } = await call("/api/health");
    if (status !== 200 || body.status !== "ok") return { ok: false, detail: JSON.stringify(body) };
    return { ok: true, detail: `db=${body.checks.database.latencyMs}ms redis=${body.checks.redis.latencyMs}ms runs=${body.data.geoRunCount}` };
  });

  await check("2.登录", async () => {
    const ok = await login();
    return { ok, detail: ok ? `session 已建立 (cookies: ${cookieJar.size})` : `登录失败 (jar=${Array.from(cookieJar.keys()).join(",")})` };
  });

  await check("3.项目列表", async () => {
    const { status, body } = await call("/api/projects", { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    if (!projectId && Array.isArray(list)) projectId = list[0]?.id ?? "";
    return { ok: Array.isArray(list) && list.length > 0, detail: `${list.length} 个项目` };
  });

  await check("4.项目详情", async () => {
    const { status, body } = await call(`/api/projects/${projectId}`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const p = body.data ?? body;
    return { ok: !!p.id, detail: `${p.name} (${p.primaryBrand})` };
  });

  await check("5.LLM渠道诊断", async () => {
    const { status, body } = await call("/api/search/channels/diagnostics", { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const channels = body.data ?? body;
    const available = Object.entries(channels).filter(([, v]: any) => v.isAvailable).map(([k]) => k);
    return { ok: available.length > 0, detail: `可用: ${available.join(",") || "(无)"}` };
  });

  await check("6.GEO runs", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/geo/runs`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const runs = body.data ?? body;
    return { ok: true, detail: `${runs.length} 个 runs` };
  });

  await check("7.关键词", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/keywords`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const kw = body.data ?? body;
    return { ok: true, detail: `${Array.isArray(kw) ? kw.length : "?"} 个关键词` };
  });

  await check("8.品牌", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/brands`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    return { ok: true, detail: `${Array.isArray(list) ? list.length : 0} 个品牌` };
  });

  await check("9.品牌提及", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/brand-mentions?limit=5`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    return { ok: true, detail: `${Array.isArray(list) ? list.length : 0} 条` };
  });

  await check("10.任务", async () => {
    const { status, body } = await call(`/api/tasks?projectId=${projectId}`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    return { ok: true, detail: `${Array.isArray(list) ? list.length : 0} 个任务` };
  });

  await check("11.草稿", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/drafts`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    return { ok: true, detail: `${Array.isArray(list) ? list.length : 0} 个草稿` };
  });

  await check("12.分发目标", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/distribution-targets`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    return { ok: true, detail: `${Array.isArray(list) ? list.length : 0} 个目标` };
  });

  await check("13.分发日志", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/distribution-logs?limit=5`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    return { ok: true, detail: `${Array.isArray(list) ? list.length : 0} 条` };
  });

  await check("14.仪表盘", async () => {
    const { status, body } = await call(`/api/dashboard/summary?projectId=${projectId}`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    return { ok: true, detail: `keys: ${Object.keys(body.data ?? body).slice(0,4).join(",")}` };
  });

  await check("15.项目健康", async () => {
    const { status, body } = await call(`/api/projects/${projectId}/health`, { auth: true });
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    return { ok: true, detail: `status=${JSON.stringify(body.data ?? body).slice(0,80)}` };
  });

  await check("16.LLM 24h 用量统计", async () => {
    const r = await call(`/api/llm/stats?days=1`, { auth: true });
    if (r.status !== 200) return { ok: false, detail: `HTTP ${r.status}` };
    const d = r.body.data ?? r.body;
    const calls = d.totals?.calls ?? 0;
    const tokens = d.totals?.totalTokens ?? 0;
    return { ok: calls > 0, detail: `${calls} calls, ${tokens} tokens` };
  });

  await check("17.队列健康", async () => {
    const r = await call(`/api/queues/stats`, { auth: true });
    if (r.status !== 200) return { ok: false, detail: `HTTP ${r.status}` };
    const d = r.body.data ?? r.body;
    return { ok: true, detail: `total: ${d.total.active} active, ${d.total.failed} failed` };
  });

  console.log("\n" + "=".repeat(78));
  let pass = 0, fail = 0;
  for (const c of checks) {
    console.log(`  ${c.status === "PASS" ? "✅" : "❌"} [${c.status}] ${c.name.padEnd(28)} ${c.ms.toString().padStart(5)}ms  ${c.detail.slice(0, 80)}`);
    if (c.status === "PASS") pass++; else fail++;
  }
  console.log("=".repeat(78));
  console.log(`📈 ${pass} 通过 / ${fail} 失败  (总耗时 ${checks.reduce((s, c) => s + c.ms, 0)}ms)`);
  console.log("=".repeat(78));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("💥", e); process.exit(1); });
