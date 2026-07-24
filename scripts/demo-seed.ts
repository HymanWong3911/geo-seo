// Demo 准备脚本:一次性触发 5 项目 GEO run + 抓所有关键 JSON 端点 dump。
// 投资人 demo 期间随时跑一次保证数据鲜活。
//
// 用法: pnpm tsx --env-file=.env scripts/demo-seed.ts
// 输出: /tmp/demo-dumps/{01..08}-*.json
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3010";
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@example.com";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "Admin@2026";
const POLL_TIMEOUT_MS = 8 * 60 * 1000;
const OUT_DIR = "/tmp/demo-dumps";

interface Cookies {
  jar: Map<string, string>;
}
function cookieHeader(c: Cookies): string {
  return Array.from(c.jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}
function setCookie(c: Cookies, raw: string | null) {
  if (!raw) return;
  for (const part of raw.split(/,(?=[^;]+;)/)) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const k = pair.slice(0, eq).trim();
    const v = decodeURIComponent(pair.slice(eq + 1).trim());
    if (k) c.jar.set(k, v);
  }
}

async function login(): Promise<Cookies> {
  const jar = new Map<string, string>();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  setCookie({ jar }, csrfRes.headers.get("set-cookie"));
  const csrfJson = (await csrfRes.json()) as { csrfToken: string };
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader({ jar }),
    },
    body: new URLSearchParams({
      email: EMAIL,
      password: PASSWORD,
      csrfToken: csrfJson.csrfToken,
      callbackUrl: `${BASE}/dashboard`,
      json: "true",
    }),
    redirect: "manual",
  });
  setCookie({ jar }, loginRes.headers.get("set-cookie"));
  console.log(`✓ 登录 ${EMAIL} (cookies: ${jar.size})`);
  return { jar };
}

async function getJson(c: Cookies, path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader(c) } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as unknown;
}

async function postJson(c: Cookies, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(c) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`);
  return (await res.json()) as unknown;
}

async function pickFirstProjectId(c: Cookies): Promise<string> {
  const r = (await getJson(c, "/api/projects?pageSize=20")) as { data: Array<{ id: string }> };
  if (!r.data?.length) throw new Error("no projects");
  return r.data[0].id;
}

async function waitAllRunsFinish(c: Cookies, timeoutMs = POLL_TIMEOUT_MS) {
  const start = Date.now();
  let last = { active: -1, completed: 0, failed: 0 };
  while (Date.now() - start < timeoutMs) {
    const h = (await getJson(c, "/api/system/health")) as {
      data: { queues: { "geo-run": { active: number; completed: number; failed: number } } };
    };
    const q = h.data.queues["geo-run"];
    last = { active: q.active, completed: q.completed, failed: q.failed };
    if (q.active === 0) return last;
    await sleep(3000);
  }
  return last;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[demo-seed] base=${BASE} out=${OUT_DIR}`);

  const c = await login();

  // 1) 触发 5 项目 bulk
  const bulk = (await postJson(c, "/api/geo/runs/bulk", {})) as {
    data: { kind: string; queued: number; jobs: Array<{ projectId: string; jobId: string }> };
  };
  console.log(`✓ 触发 bulk: ${bulk.data.queued} 个项目`);
  for (const j of bulk.data.jobs) {
    console.log(`  ${j.projectId.slice(-8)} → jobId ${j.jobId.slice(-8)}`);
  }

  // 2) 等所有跑完
  console.log("✓ 等所有 GEO run 完成...");
  const last = await waitAllRunsFinish(c);
  console.log(`✓ active=0  completed=${last.completed}  failed=${last.failed}`);

  // 3) 抓所有关键 JSON
  const projectId = await pickFirstProjectId(c);
  const endpoints: Array<[string, string]> = [
    ["01-dashboard", "/api/dashboard/summary"],
    ["02-insights", "/api/insights"],
    ["03-system-health", "/api/system/health"],
    ["04-llm-usage-today", "/api/llm/usage?days=1"],
    ["05-llm-usage-7d", "/api/llm/usage?days=7"],
    ["06-geo-metrics", `/api/projects/${projectId}/geo/metrics`],
    ["07-project-llm-usage", `/api/projects/${projectId}/llm/usage?days=7`],
    ["08-project-geo-history", `/api/projects/${projectId}/geo/history?days=30`],
  ];
  for (const [name, endpoint] of endpoints) {
    try {
      const data = await getJson(c, endpoint);
      const file = path.join(OUT_DIR, `${name}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
      const sizeKb = (fs.statSync(file).size / 1024).toFixed(1);
      console.log(`✓ ${name}.json  (${sizeKb} KB)  ← ${endpoint}`);
    } catch (e) {
      console.error(`✗ ${name}: ${(e as Error).message}`);
    }
  }
  console.log(`\n[demo-seed] 全部 dump 到 ${OUT_DIR},demo 可以开始了。`);
}

main().catch((e) => {
  console.error("demo-seed failed:", e);
  process.exit(1);
});
