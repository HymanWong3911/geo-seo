// 端到端业务工作流脚本 — 把系统当工具真实使用
// 用法: pnpm workflow 或 npx tsx --env-file=.env scripts/full-workflow.ts
//
// 流程:
//   1. 健康检查 + 登录
//   2. 找项目里 SEO 均分最低的页面
//   3. 对该页面执行实时审计(真实抓取)
//   4. 从审计发现 + 项目关键词,AI 生成内容草稿
//   5. 自动提交审核 + 批准
//   6. 创建 webhook 目标 + 触发真实分发
//   7. 触发 GEO 运行(问 AI 搜索引擎)
//   8. 等待 GEO 完成
//   9. 生成周报
//  10. 输出业务摘要 + 下一步建议

import "dotenv/config";

const BASE = process.env.WORKFLOW_BASE_URL ?? "http://localhost:3010";
const EMAIL = "admin@example.com";
const PASSWORD = "Admin@2026";
const PROJECT_ID = process.env.WORKFLOW_PROJECT_ID ?? "cmq9d9xzp001io8hucplvl783";
const DEBUG = process.env.WORKFLOW_DEBUG === "1";

const WEBHOOK_TARGET_NAME = "workflow-e2e-webhook";
const WEBHOOK_URL = process.env.WORKFLOW_WEBHOOK_URL ?? "https://httpbin.org/post";

let cookieJar = new Map<string, string>();

function parseAndStore(c: string) {
  const semi = c.indexOf(";");
  const pair = semi >= 0 ? c.slice(0, semi) : c;
  const eqIdx = pair.indexOf("=");
  if (eqIdx < 0) return;
  cookieJar.set(pair.slice(0, eqIdx).trim(), decodeURIComponent(pair.slice(eqIdx + 1)).trim());
}

function setCookies(headers: Headers) {
  const all = (headers as any).getSetCookie?.() ?? null;
  if (Array.isArray(all) && all.length > 0) { for (const c of all) parseAndStore(c); return; }
  const raw = headers.get("set-cookie") ?? "";
  if (!raw) return;
  const re = /,\s*(?=[^,;=\s]+\s*=)/g;
  for (const p of raw.split(re)) parseAndStore(p);
}

function cookieHeader(): string {
  return Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function call(method: string, path: string, body?: unknown, opts: { timeoutMs?: number } = {}): Promise<{ status: number; data: any; text: string }> {
  const controller = new AbortController();
  const timeout = opts.timeoutMs ?? 60_000;
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader(),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    setCookies(res.headers);
    const text = await res.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* keep text */ }
    if (DEBUG) console.log(`   [${method} ${path}] → ${res.status} (${text.length} bytes)`);
    return { status: res.status, data, text };
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error(`TIMEOUT after ${timeout}ms: ${method} ${path}`);
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

function step(emoji: string, title: string) {
  console.log(`\n${emoji}  ${title}`);
}

function ok(msg: string) { console.log(`   ✓ ${msg}`); }
function info(msg: string) { console.log(`   → ${msg}`); }
function warn(msg: string) { console.log(`   ⚠ ${msg}`); }
function fail(msg: string) { console.log(`   ✗ ${msg}`); }

async function login(): Promise<void> {
  step("🔐", "1/10 登录");
  // 先 GET csrf
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  setCookies(csrfRes.headers);
  const csrfData: any = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      json: "true",
    }),
    redirect: "manual",
  });
  setCookies(loginRes.headers);
  // 验证 session
  const sess = await call("GET", "/api/auth/session");
  if (sess.status !== 200) throw new Error("session failed");
  ok(`logged in as ${sess.data?.user?.email ?? "?"}`);
}

async function pickLowestScorePage(): Promise<{ pageId: string; url: string; score: number; title: string | null } | null> {
  // 用 audit-feed 拿最近审计,直接关联 page
  const r = await call("GET", `/api/audit-feed`);
  if (r.status !== 200) {
    warn(`audit-feed status=${r.status}`);
    return null;
  }
  const allAudits: any[] = r.data?.data ?? [];
  // 过滤本项目 + 按 pageId 分组保留最近一次
  const latestByPage = new Map<string, any>();
  for (const a of allAudits) {
    const pid = a.page?.projectId;
    if (pid !== PROJECT_ID) continue;
    if (!latestByPage.has(a.pageId)) latestByPage.set(a.pageId, a);
  }
  if (latestByPage.size === 0) {
    info("no audit history, will run fresh audit");
    const proj = await call("GET", `/api/projects/${PROJECT_ID}`);
    const domain = proj.data?.data?.domain ?? "example.com";
    return { pageId: "n/a", url: `https://${domain}/`, score: 0, title: proj.data?.data?.name ?? null };
  }
  const arr = Array.from(latestByPage.values());
  arr.sort((a, b) => a.score - b.score);
  const worst = arr[0];
  return {
    pageId: worst.pageId,
    url: worst.page?.url ?? "",
    title: worst.page?.title ?? null,
    score: worst.score,
  };
}

async function runAuditOnPage(pageId: string, url: string): Promise<{ auditId: string; score: number; findingsCount: number }> {
  step("🔍", "3/10 实时审计 (抓取 + 评分)");
  info(`url = ${url}`);
  const r = await call("POST", `/api/projects/${PROJECT_ID}/audits`, { url, sync: true, pageId }, { timeoutMs: 120_000 });
  if (r.status !== 201 && r.status !== 200) throw new Error(`audit failed status=${r.status}: ${r.text}`);
  const auditId = r.data?.data?.auditId ?? r.data?.data?.id ?? r.data?.id;
  const score = r.data?.data?.score ?? 0;
  const findingsCount = r.data?.data?.findingsCount ?? 0;
  ok(`audit_id = ${auditId}, score = ${score}, findings = ${findingsCount}`);
  return { auditId, score, findingsCount };
}

async function getKeywords(): Promise<string[]> {
  const r = await call("GET", `/api/projects/${PROJECT_ID}/keywords`);
  const kws: any[] = r.data?.data ?? [];
  return kws.map(k => k.text).slice(0, 5);
}

async function generateDraft(topic: string, keywords: string[]): Promise<{ draftId: string; title: string }> {
  step("🤖", "4/10 AI 生成内容草稿");
  info(`topic = ${topic}, keywords = ${keywords.join(", ")}`);
  const r = await call("POST", `/api/projects/${PROJECT_ID}/drafts/generate`, {
    topic,
    targetKeywords: keywords,
    length: 1200,
    tone: "professional",
    language: "zh-CN",
    saveAsDraft: true,
  }, { timeoutMs: 180_000 });
  if (r.status !== 200 && r.status !== 201) throw new Error(`generate failed status=${r.status}: ${r.text}`);
  const draftId = r.data?.data?.draftId;
  const title = r.data?.data?.generated?.title ?? topic;
  ok(`draft_id = ${draftId}`);
  ok(`title = ${title.slice(0, 60)}`);
  return { draftId, title };
}

async function submitAndApprove(draftId: string): Promise<void> {
  step("📋", "5/10 提交审核 + 批准");
  const sub = await call("POST", `/api/drafts/${draftId}/submit-review`);
  if (sub.status !== 200 && sub.status !== 201) throw new Error(`submit failed: ${sub.text}`);
  ok("submitted");
  const appr = await call("POST", `/api/drafts/${draftId}/approve`, { comments: "auto-approved by workflow script" });
  if (appr.status !== 200 && appr.status !== 201) throw new Error(`approve failed: ${appr.text}`);
  ok("approved");
}

async function ensureWebhookTarget(): Promise<{ targetId: string }> {
  step("🔗", "6/10 准备 webhook 分发目标");
  const list = await call("GET", `/api/projects/${PROJECT_ID}/distribution-targets`);
  const existing = (list.data?.data ?? []).find((t: any) => t.name === WEBHOOK_TARGET_NAME);
  if (existing) {
    ok(`reusing existing target ${existing.id}`);
    return { targetId: existing.id };
  }
  const create = await call("POST", `/api/projects/${PROJECT_ID}/distribution-targets`, {
    name: WEBHOOK_TARGET_NAME,
    platform: "CUSTOM_WEBHOOK",
    config: { url: WEBHOOK_URL },
    autoPublish: false,
  });
  if (create.status !== 201 && create.status !== 200) throw new Error(`create target failed: ${create.text}`);
  ok(`created target ${create.data?.data?.id}`);
  return { targetId: create.data?.data?.id };
}

async function distributeDraft(draftId: string, targetId: string): Promise<{ logId: string; status: string }> {
  info(`distributing draft=${draftId} target=${targetId}`);
  const r = await call("POST", `/api/drafts/${draftId}/distribute`, { targetIds: [targetId] });
  if (r.status !== 200 && r.status !== 201) throw new Error(`distribute failed: ${r.text}`);
  const results = r.data?.data?.results ?? r.data?.results ?? [];
  const firstResult = results[0] ?? {};
  const logId = firstResult.logId ?? firstResult.id;
  const initStatus = firstResult.success ? "QUEUED" : "FAILED";
  ok(`log_id = ${logId}, success = ${firstResult.success}`);
  return { logId, status: initStatus };
}

async function waitForDistribution(logId: string, _targetId: string, timeoutMs = 30_000): Promise<{ status: string; externalUrl: string | null; errorMessage: string | null }> {
  info(`polling distribution log ${logId} ...`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await call("GET", `/api/distribution-logs/${logId}`);
    const log = r.data?.data;
    if (!log) continue;
    if (log.status === "SUCCESS" || log.status === "FAILED") {
      info(`final status = ${log.status} after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      return { status: log.status, externalUrl: log.externalUrl, errorMessage: log.errorMessage };
    }
  }
  warn(`distribution still pending after ${timeoutMs / 1000}s`);
  return { status: "PENDING", externalUrl: null, errorMessage: null };
}

async function triggerGeoRun(): Promise<{ runId: string }> {
  step("🌐", "7/10 触发 GEO 运行 (AI 搜索引擎可见度检测)");
  info("sync 模式:等待全部 Q&A 完成(可能 1-3 分钟)");
  // sync 模式:同步等所有 channel 跑完,直接拿到结果
  const r = await call("POST", `/api/projects/${PROJECT_ID}/geo/runs`, { sync: true }, { timeoutMs: 600_000 });
  if (r.status !== 200 && r.status !== 201) throw new Error(`geo trigger failed: ${r.text}`);
  const data = r.data?.data ?? r.data ?? {};
  const runId = data.runId ?? data.id;
  ok(`run_id = ${runId}`);
  if (data.totalQuestions !== undefined) {
    ok(`questions=${data.totalQuestions}, success=${data.successCount}, failed=${data.failedCount}, cost=¥${(data.totalCost ?? 0).toFixed(4)}`);
  } else {
    // sync 模式已经执行完,直接从 DB 查 status
    if (runId) {
      const listRes = await call("GET", `/api/projects/${PROJECT_ID}/geo/runs?pageSize=20`);
      const runs = listRes.data?.data ?? [];
      const run = runs.find((x: any) => x.id === runId);
      if (run) {
        const cnt = run._count?.results ?? 0;
        ok(`status=${run.status}, results=${cnt}`);
      }
    }
  }
  return { runId: runId ?? "" };
}

async function waitForGeoRun(runId: string, timeoutMs = 60_000): Promise<{ status: string; resultCount: number }> {
  if (!runId) return { status: "UNKNOWN", resultCount: 0 };
  info(`polling GEO run ${runId} ...`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await new Promise(r => setTimeout(r, 3000));
    // 列出最近 runs 找我们的 runId
    const r = await call("GET", `/api/projects/${PROJECT_ID}/geo/runs?pageSize=20`);
    const runs: any[] = r.data?.data ?? [];
    const run = runs.find(x => x.id === runId);
    if (!run) continue;
    if (run.status === "SUCCESS" || run.status === "FAILED" || run.status === "PARTIAL_FAILURE") {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const cnt = run._count?.results ?? run.resultsCount ?? 0;
      info(`final status = ${run.status} after ${elapsed}s, results = ${cnt}`);
      return { status: run.status, resultCount: cnt };
    }
  }
  warn(`GEO run poll timed out after ${timeoutMs / 1000}s`);
  return { status: "TIMEOUT", resultCount: 0 };
}

async function generateWeeklyReport(): Promise<{ reportId: string }> {
  step("📊", "9/10 生成周报");
  const r = await call("POST", `/api/projects/${PROJECT_ID}/reports`, { type: "WEEKLY", fromDays: 7 });
  if (r.status !== 201 && r.status !== 200) throw new Error(`report failed: ${r.text}`);
  const reportId = r.data?.data?.id ?? r.data?.id;
  ok(`report_id = ${reportId}`);
  return { reportId };
}

async function readReport(reportId: string): Promise<{ lines: number; firstLines: string[] }> {
  const r = await call("GET", `/api/reports/${reportId}?format=md`);
  if (r.status !== 200) {
    warn(`report read failed status=${r.status}`);
    return { lines: 0, firstLines: [] };
  }
  const lines = r.text.split("\n");
  ok(`report size = ${lines.length} lines, ${r.text.length} bytes`);
  return { lines: lines.length, firstLines: lines.slice(0, 10) };
}

async function main() {
  const t0 = Date.now();
  console.log(`\n🔥 GEO-SEO 端到端工作流 → ${BASE}`);
  console.log(`   project = ${PROJECT_ID}`);
  console.log(`   started at ${new Date().toISOString()}\n`);

  // 0. 健康检查
  step("❤️", "0/10 健康检查");
  const h = await call("GET", "/api/health");
  if (h.status !== 200) throw new Error("health check failed");
  ok(`db=${h.data?.checks?.database?.latencyMs ?? "?"}ms, redis=${h.data?.checks?.redis?.latencyMs ?? "?"}ms`);
  info(`runs=${h.data?.data?.geoRunCount ?? 0}, mentions=${h.data?.data?.brandMentionCount ?? 0}`);

  // 1. 登录
  await login();

  // 2. 找低分页面 / 项目根
  step("📄", "2/10 找 SEO 均分最低页面");
  let lowestPage = await pickLowestScorePage();
  if (!lowestPage) {
    const proj = await call("GET", `/api/projects/${PROJECT_ID}`);
    const domain = proj.data?.data?.domain ?? "example.com";
    lowestPage = {
      pageId: "n/a",
      url: `https://${domain}/`,
      score: 0,
      title: null,
    };
    info(`fallback to project root: ${lowestPage.url}`);
  } else {
    info(`worst page: ${lowestPage.url} (score=${lowestPage.score})`);
  }

  // 3. 实时审计
  let auditResult: { auditId: string; score: number; findingsCount: number } | null = null;
  if (lowestPage.pageId !== "n/a") {
    try {
      auditResult = await runAuditOnPage(lowestPage.pageId, lowestPage.url);
    } catch (e: any) {
      warn(`audit failed: ${e.message}, continue without`);
    }
  }

  // 4. 关键词 + 生成
  const keywords = await getKeywords();
  const topic = auditResult?.auditId
    ? `${lowestPage.title ?? "网站首页"} 的 SEO 优化指南`
    : `${lowestPage.title ?? "网站"} 内容更新`;
  let draftResult: { draftId: string; title: string } | null = null;
  if (keywords.length > 0) {
    try {
      draftResult = await generateDraft(topic, keywords);
    } catch (e: any) {
      warn(`generate failed: ${e.message}, skip draft`);
    }
  } else {
    warn("no keywords, skip draft generation");
  }

  // 5. 提交 + 批准
  if (draftResult) {
    try {
      await submitAndApprove(draftResult.draftId);
    } catch (e: any) {
      warn(`submit/approve failed: ${e.message}, skip distribution`);
      draftResult = null;
    }
  }

  // 6. 分发
  let distResult: { logId: string; status: string } | null = null;
  if (draftResult) {
    try {
      const { targetId } = await ensureWebhookTarget();
      distResult = await distributeDraft(draftResult.draftId, targetId);
      const finalState = await waitForDistribution(distResult.logId, targetId);
      ok(`distribution final = ${finalState.status}${finalState.externalUrl ? ` → ${finalState.externalUrl}` : ""}`);
      distResult.status = finalState.status;
    } catch (e: any) {
      warn(`distribution failed: ${e.message}`);
    }
  }

  // 7-8. GEO 运行
  let geoResult: { runId: string; status: string; resultCount: number } | null = null;
  try {
    const triggered = await triggerGeoRun();
    if (triggered.runId) {
      const finalState = await waitForGeoRun(triggered.runId);
      geoResult = { runId: triggered.runId, ...finalState };
    } else {
      warn("GEO trigger did not return runId");
    }
  } catch (e: any) {
    warn(`GEO run failed: ${e.message}`);
  }

  // 9. 报告
  let reportId: string | null = null;
  try {
    const r = await generateWeeklyReport();
    reportId = r.reportId;
    await readReport(r.reportId);
  } catch (e: any) {
    warn(`report failed: ${e.message}`);
  }

  // 10. 摘要
  step("📋", "10/10 工作流摘要");
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`
┌──────────────────────────────────────────────────────────────┐
│  🟢 Workflow completed in ${elapsed}s
├──────────────────────────────────────────────────────────────┤
│  Audit       ${auditResult ? `✓ score=${auditResult.score} findings=${auditResult.findingsCount}` : "⊘ skipped"}
│  Draft       ${draftResult ? `✓ id=${draftResult.draftId.slice(-8)}` : "⊘ skipped"}
│  Distribution ${distResult ? `✓ status=${distResult.status}` : "⊘ skipped"}
│  GEO         ${geoResult ? `✓ status=${geoResult.status} results=${geoResult.resultCount}` : "⊘ skipped"}
│  Report      ${reportId ? `✓ id=${reportId.slice(-8)}` : "⊘ skipped"}
└──────────────────────────────────────────────────────────────┘
`);

  console.log("💡 Next steps:");
  console.log(`   • 查看周报:    ${BASE}/reports`);
  console.log(`   • 查看 GEO:    ${BASE}/geo/runs?projectId=${PROJECT_ID}`);
  console.log(`   • 查看分发:    ${BASE}/content/distribution/history?projectId=${PROJECT_ID}`);
  console.log(`   • 仪表盘:      ${BASE}/dashboard`);
}

main().catch(err => {
  console.error("\n💥 WORKFLOW FAILED:", err.message);
  if (DEBUG) console.error(err.stack);
  process.exit(1);
});
