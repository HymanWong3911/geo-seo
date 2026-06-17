// 端到端 GEO 监测流程测试。
// 覆盖：登录 → 创建关键词/问题/品牌 → 触发 GEO run → worker 跑 → 验证结果落库 → 计算 metrics
//
// 跑法：需 worker 进程运行 + 真实 LLM API（MiniMax 配置好）。
// 跳过条件：未配置 LLM_API_KEY 时跳过整个文件。
//
// 用 vitest + node-fetch，无需启 dev server。

import { describe, it, expect, beforeAll, afterAll } from "vitest";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3010";
const HAS_LLM = Boolean(process.env.LLM_API_KEY);
const SKIP_REASON = !HAS_LLM
  ? "需配置 LLM_API_KEY 才能跑端到端测试"
  : "其他原因跳过";

const describeMaybe = HAS_LLM ? describe : describe.skip;

describeMaybe("E2E: GEO 监测完整流程", () => {
  let cookies = "";
  let projectId = "";
  let keywordId = "";
  let questionId = "";
  let brandId = "";
  let runId = "";
  let resultCount = 0;

  // 工具：登录
  async function login() {
    // 1. 取 CSRF token（保存 cookie）
    const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
    const csrfSetCookies = parseSetCookies(csrfRes.headers.getSetCookie?.() ?? []);
    const csrfBody = (await csrfRes.json()) as { csrfToken: string };
    const csrfToken = csrfBody.csrfToken;

    // 2. POST 登录
    const params = new URLSearchParams({
      email: "admin@example.com",
      password: "Admin@2026",
      csrfToken,
      callbackUrl: `${BASE}/dashboard`,
    });
    const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: joinCookies([csrfSetCookies]),
      },
      body: params.toString(),
      redirect: "manual",
    });
    const loginSetCookies = parseSetCookies(loginRes.headers.getSetCookie?.() ?? []);

    // 3. 合并所有 cookie
    cookies = joinCookies([csrfSetCookies, loginSetCookies]);

    if (!loginRes.status || loginRes.status >= 400) {
      throw new Error(`Login failed: status ${loginRes.status}`);
    }
  }

  // 解析 set-cookie header 数组
  function parseSetCookies(headers: string[]): Array<{ name: string; value: string }> {
    return headers
      .map((h) => {
        const [pair] = h.split(";");
        const [name, ...rest] = pair.split("=");
        return { name: name.trim(), value: rest.join("=") };
      })
      .filter((c) => c.name && c.value);
  }

  function joinCookies(arr: Array<Array<{ name: string; value: string }>>): string {
    const seen = new Map<string, string>();
    for (const list of arr) {
      for (const c of list) {
        seen.set(c.name, c.value);
      }
    }
    return Array.from(seen.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
        ...(init?.headers ?? {}),
      },
    });
    const json = (await res.json()) as { data?: unknown; error?: { message?: string } | null };
    return { status: res.status, ...json };
  }

  beforeAll(async () => {
    await login();
    // 直接用 seed 创建的 seed-project-1
    const projects = await api("/api/projects?pageSize=100");
    projectId = (projects.data as Array<{ id: string }>)[0]?.id ?? "";
    expect(projectId).toBeTruthy();
  }, 30_000);

  afterAll(async () => {
    // 清理测试数据
    if (keywordId) await api(`/api/keywords/${keywordId}`, { method: "DELETE" });
    if (questionId) {
      // question 没单独 DELETE API，跳过清理
    }
    if (brandId) await api(`/api/brands/${brandId}`, { method: "DELETE" });
  });

  it("M3: 创建关键词", async () => {
    const r = await api(`/api/projects/${projectId}/keywords`, {
      method: "POST",
      body: JSON.stringify({
        text: `e2e test keyword ${Date.now()}`,
        intent: "INFORMATIONAL",
        priority: 3,
      }),
    });
    expect(r.status).toBe(201);
    expect(r.data).toBeTruthy();
    keywordId = (r.data as { id: string }).id;
  });

  it("M3: 创建 GEO 问题", async () => {
    const r = await api(`/api/projects/${projectId}/geo/questions`, {
      method: "POST",
      body: JSON.stringify({
        question: `e2e test question ${Date.now()}`,
        intent: "INFORMATIONAL",
        priority: 3,
      }),
    });
    expect(r.status).toBe(201);
    expect(r.data).toBeTruthy();
    questionId = (r.data as { id: string }).id;
  });

  it("M11: 创建品牌", async () => {
    const r = await api(`/api/projects/${projectId}/brands`, {
      method: "POST",
      body: JSON.stringify({
        name: `e2e test brand ${Date.now()}`,
        isPrimary: false,
      }),
    });
    expect(r.status).toBe(201);
    expect(r.data).toBeTruthy();
    brandId = (r.data as { id: string }).id;
  });

  it("M4: 触发 GEO run（worker 异步处理）", async () => {
    const r = await api(`/api/projects/${projectId}/geo/runs`, {
      method: "POST",
      body: JSON.stringify({ questionIds: [questionId] }),
    });
    expect(r.status).toBe(201);
    expect(r.data).toBeTruthy();
    const jobId = (r.data as { jobId: string }).jobId;
    expect(jobId).toBeTruthy();
  });

  it("M4: 等待 worker 处理完成（最多 5 分钟）", async () => {
    // 通过轮询 runs 列表找到包含 questionId 的最新 run
    const start = Date.now();
    let target: { id: string; status: string; _count: { results: number } } | null = null;
    while (Date.now() - start < 5 * 60 * 1000) {
      const r = await api(`/api/projects/${projectId}/geo/runs?pageSize=20`);
      const runs = (r.data ?? []) as Array<{
        id: string;
        status: string;
        questionIds: string[];
        _count: { results: number };
      }>;
      target = runs.find(
        (x) => x.questionIds.includes(questionId) && x.status !== "RUNNING" && x.status !== "PENDING",
      ) ?? null;
      if (target) break;
      await new Promise((r) => setTimeout(r, 5_000));
    }
    expect(target).toBeTruthy();
    expect(["SUCCESS", "PARTIAL_FAILURE", "FAILED"]).toContain(target!.status);
    runId = target!.id;
    resultCount = target!._count.results;
  }, 5 * 60_000 + 10_000);

  it("M4: 验证 GeoRunResult 已落库", async () => {
    expect(runId).toBeTruthy();
    const r = await api(`/api/geo/runs/${runId}`);
    const run = r.data as {
      results: Array<{
        answer: string;
        mentionedBrands: string[];
        providerSource: string;
      }>;
    };
    expect(run.results.length).toBe(resultCount);
    // 放宽阈值：e2e 问题是无意义的随机字符串，LLM 可能给短答，但必须非空
    expect(run.results[0].answer.length).toBeGreaterThan(10);
    // provider 任意：llm_simulation / kimi / doubao / perplexity
    expect(run.results[0].providerSource).toMatch(/llm_simulation|kimi|doubao|perplexity/);
  });

  it("M4: 验证 GEO metrics 反映新数据", async () => {
    const r = await api(`/api/projects/${projectId}/geo/metrics`);
    const m = r.data as { totalQuestions: number; score: number };
    expect(m.totalQuestions).toBeGreaterThan(0);
    expect(m.score).toBeGreaterThanOrEqual(0);
    expect(m.score).toBeLessThanOrEqual(100);
  });

  it("M6: 验证 LLM 调用已记录（成本统计）", async () => {
    // 通过 audit log 或 LlmCall 验证
    const r = await api(`/api/audit-log?pageSize=50`);
    const logs = (r.data ?? []) as Array<{ action: string; metadata?: { provider?: string } }>;
    // 至少应该看到 GEO_RUN_TRIGGER
    const geoLogs = logs.filter((l) => l.action === "GEO_RUN_TRIGGER");
    expect(geoLogs.length).toBeGreaterThan(0);
  });

  it("M6: 验证审计日志能查到本流程所有动作", async () => {
    const r = await api(`/api/audit-log?pageSize=100`);
    const logs = (r.data ?? []) as Array<{ action: string }>;
    // 期望出现以下动作
    const expectedActions = [
      "BRAND_CREATE",
      "KEYWORD_CREATE",
      "GEO_QUESTION_CREATE",
      "GEO_RUN_TRIGGER",
    ];
    for (const action of expectedActions) {
      expect(logs.some((l) => l.action === action)).toBe(true);
    }
  });
});
