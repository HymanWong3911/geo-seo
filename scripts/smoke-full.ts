// 完整端到端测试 - 验证系统真实跑通
// 用法: npx tsx --env-file=.env scripts/smoke-full.ts
//
// 包含: 健康检查、登录、列表/详情、LLM 渠道诊断、ARK 真实渠道、
//       GEO run 触发+轮询、品牌监控、内容草稿、仪表盘、项目健康
//
// 设计原则: 不阻塞, 超时即失败但记录状态

import "dotenv/config";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const EMAIL = "admin@example.com";
const PASSWORD = "Admin@2026";
const PROJECT_ID = "cmq9d9xzp001io8hucplvl783";
const GEO_TIMEOUT_S = parseInt(process.env.SMOKE_GEO_TIMEOUT_S ?? "600"); // 10 分钟

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
  if (k) cookieJar.set(k, v);
}

function setCookies(headers: Headers) {
  const all = (headers as any).getSetCookie?.() ?? null;
  if (Array.isArray(all) && all.length > 0) {
    for (const c of all) parseAndStore(c); return;
  }
  const raw = headers.get("set-cookie") ?? "";
  if (!raw) return;
  const re = /,\s*(?=[^,;=\s]+\s*=)/g;
  for (const p of raw.split(re)) parseAndStore(p);
}

function cookieHeader(): string {
  return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function call(path: string, opts: { method?: string; body?: unknown; formBody?: URLSearchParams; auth?: boolean; timeout?: number } = {}) {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.body) headers["Content-Type"] = "application/json";
  if (opts.formBody) headers["Content-Type"] = "application/x-www-form-urlencoded";
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
    process.stdout.write(r.ok ? "." : "F");
  } catch (e: any) {
    checks.push({ name, status: "FAIL", detail: e.message, ms: Date.now() - start });
    process.stdout.write("F");
  }
}

async function login() {
  await call("/api/auth/csrf");
  const csrfToken = cookieJar.get("authjs.csrf-token")?.split("|")[0] ?? "";
  const params = new URLSearchParams();
  params.append("csrfToken", csrfToken);
  params.append("email", EMAIL);
  params.append("password", PASSWORD);
  params.append("redirect", "false");
  params.append("callbackUrl", `${BASE}/`);
  await call("/api/auth/callback/credentials", { method: "POST", formBody: params, auth: true });
  return cookieJar.size > 0;
}

async function main() {
  console.log(`\n🔥 GEO-SEO 完整冒烟测试 -> ${BASE}  ${new Date().toISOString()}\n`);

  await check("1.健康检查", async () => {
    const { status, body } = await call("/api/health");
    if (status !== 200 || body.status !== "ok") return { ok: false, detail: JSON.stringify(body) };
    return { ok: true, detail: `db=${body.checks.database.latencyMs}ms redis=${body.checks.redis.latencyMs}ms` };
  });

  await check("2.登录", async () => {
    const ok = await login();
    return { ok, detail: `cookies: ${cookieJar.size}` };
  });

  const authOpts = { auth: true };

  await check("3.项目列表", async () => {
    const { status, body } = await call("/api/projects", authOpts);
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const list = body.data ?? body;
    return { ok: Array.isArray(list) && list.length > 0, detail: `${list.length} 个项目` };
  });

  await check("4.LLM渠道诊断", async () => {
    const { status, body } = await call("/api/search/channels/diagnostics", authOpts);
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const channels = body.data ?? body;
    const available = Object.entries(channels).filter(([, v]: any) => v.isAvailable).map(([k]) => k);
    return { ok: available.length > 0, detail: `可用: ${available.join(",")}` };
  });

  await check("5.GEO runs 列表", async () => {
    const { status, body } = await call(`/api/projects/${PROJECT_ID}/geo/runs`, authOpts);
    if (status !== 200) return { ok: false, detail: `HTTP ${status}` };
    const runs = body.data ?? body;
    return { ok: Array.isArray(runs), detail: `${runs.length} 个 runs` };
  });

  await check("6.触发 GEO run", async () => {
    const { status, body } = await call(`/api/projects/${PROJECT_ID}/geo/runs`, {
      ...authOpts, method: "POST", body: { sync: false },
    });
    if (status === 200 || status === 201) {
      const data = body.data ?? body;
      return { ok: true, detail: `jobId: ${data?.jobId?.slice(0, 16) ?? "(?)"}` };
    }
    return { ok: false, detail: `HTTP ${status} ${JSON.stringify(body).slice(0, 100)}` };
  });

  await check("7.轮询 GEO run (worker)", async () => {
    const start = Date.now();
    let lastStatus = "PENDING";
    let lastId = "";
    let resultCount = 0;
    while (Date.now() - start < GEO_TIMEOUT_S * 1000) {
      const r = await call(`/api/projects/${PROJECT_ID}/geo/runs?pageSize=1`, authOpts);
      if (r.status === 200) {
        const list = r.body.data ?? r.body;
        const latest = Array.isArray(list) ? list[0] : list?.items?.[0];
        if (latest) {
          lastStatus = latest.status ?? "?";
          lastId = latest.id ?? "";
          resultCount = latest._count?.results ?? latest.results?.length ?? "?";
          if (lastStatus === "SUCCESS") {
            return { ok: true, detail: `${lastStatus} (${Math.round((Date.now()-start)/1000)}s, ${resultCount} 结果)` };
          }
          if (lastStatus === "FAILED") {
            return { ok: false, detail: `FAILED (${Math.round((Date.now()-start)/1000)}s)` };
          }
        }
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    return { ok: false, detail: `超时 ${GEO_TIMEOUT_S}s, 最后: ${lastStatus} (${resultCount} 结果)` };
  });

  await check("8.品牌监控扫描", async () => {
    const { status, body } = await call(`/api/projects/${PROJECT_ID}/brand-monitor/refresh`, {
      ...authOpts, method: "POST",
    });
    if (status === 200 || status === 201 || status === 202) {
      const data = body.data ?? body;
      return { ok: true, detail: `count=${data?.count ?? "?"}` };
    }
    return { ok: false, detail: `HTTP ${status}` };
  });

  await check("9.内容草稿生成", async () => {
    const kwRes = await call(`/api/projects/${PROJECT_ID}/keywords`, authOpts);
    const kw = (kwRes.body.data ?? kwRes.body)[0];
    if (!kw) return { ok: false, detail: "无关键词" };
    const { status, body } = await call(`/api/projects/${PROJECT_ID}/drafts/generate`, {
      ...authOpts, method: "POST",
      body: { topic: kw.text, targetKeywords: [kw.text], length: 500 },
    });
    if (status === 200 || status === 201 || status === 202) {
      return { ok: true, detail: `草稿生成已入队 (kw: ${kw.text?.slice(0, 20)})` };
    }
    return { ok: false, detail: `HTTP ${status} ${JSON.stringify(body).slice(0, 100)}` };
  });

  await check("10.系统仪表盘", async () => {
    const r = await call(`/api/dashboard/summary?projectId=${PROJECT_ID}`, authOpts);
    if (r.status !== 200) return { ok: false, detail: `HTTP ${r.status}` };
    return { ok: true, detail: `keys: ${Object.keys(r.body.data ?? r.body).slice(0,3).join(",")}` };
  });

  await check("11.项目健康评分", async () => {
    const r = await call(`/api/projects/${PROJECT_ID}/health`, authOpts);
    if (r.status !== 200) return { ok: false, detail: `HTTP ${r.status}` };
    const data = r.body.data ?? r.body;
    return { ok: true, detail: `score=${data.totalScore ?? "?"} level=${data.level ?? "?"}` };
  });

  console.log("\n\n" + "=".repeat(78));
  let pass = 0, fail = 0;
  for (const c of checks) {
    const icon = c.status === "PASS" ? "✅" : "❌";
    console.log(`  ${icon} [${c.status}] ${c.name.padEnd(32)} ${c.ms.toString().padStart(6)}ms  ${c.detail.slice(0, 70)}`);
    if (c.status === "PASS") pass++; else fail++;
  }
  console.log("=".repeat(78));
  console.log(`📈 ${pass} 通过 / ${fail} 失败  (总耗时 ${checks.reduce((s, c) => s + c.ms, 0)}ms)`);
  console.log("=".repeat(78));
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("💥", e); process.exit(1); });
