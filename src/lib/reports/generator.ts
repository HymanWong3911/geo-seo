// 报告生成器。
// 详细说明见 dev doc v1.2 6.11 节。
// 3 份固定模板：WeeklyReport / MonthlyReport / AuditReport
// 输出 Markdown，可直接下载。

import { prisma } from "@/lib/db";
import { calculateProjectGeoMetrics } from "@/lib/scoring/geo";

export type ReportType = "WEEKLY" | "MONTHLY" | "AUDIT";

export interface GenerateReportInput {
  projectId: string;
  type: ReportType;
  fromDays?: number;        // 默认：周报 7 / 月报 30
  auditId?: string;        // AUDIT 类型必填
}

// ============= 公共辅助 =============

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pct(num: number, den: number): string {
  if (den === 0) return "0%";
  return `${((num / den) * 100).toFixed(1)}%`;
}

// ============= 周报 =============

export async function generateWeeklyReport(projectId: string, fromDays = 7): Promise<string> {
  const now = new Date();
  const from = new Date(now.getTime() - fromDays * 24 * 3600 * 1000);
  const prevFrom = new Date(now.getTime() - 2 * fromDays * 24 * 3600 * 1000);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("项目不存在");

  const [recentAudits, prevAudits, recentGeoMetrics, tasksCreated, tasksDone, llmCosts] =
    await Promise.all([
      prisma.pageAudit.findMany({
        where: { page: { projectId }, createdAt: { gte: from } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pageAudit.findMany({
        where: {
          page: { projectId },
          createdAt: { gte: prevFrom, lt: from },
        },
      }),
      calculateProjectGeoMetrics(projectId).catch(() => null),
      prisma.optimizationTask.count({
        where: { projectId, createdAt: { gte: from } },
      }),
      prisma.optimizationTask.count({
        where: { projectId, status: "DONE", updatedAt: { gte: from } },
      }),
      prisma.llmCall.aggregate({
        where: { projectId, createdAt: { gte: from } },
        _sum: { costCents: true, totalTokens: true },
      }),
    ]);

  const recentAvgScore =
    recentAudits.length > 0
      ? Math.round(recentAudits.reduce((s, a) => s + a.score, 0) / recentAudits.length)
      : 0;
  const prevAvgScore =
    prevAudits.length > 0
      ? Math.round(prevAudits.reduce((s, a) => s + a.score, 0) / prevAudits.length)
      : 0;

  // Top 5 待修复问题（按 high 优先 + 最近）
  const allFindings = recentAudits
    .flatMap((a) => (a.findings as Array<{ code: string; severity: string; title: string; recommendation: string }>))
    .filter((f) => f.severity === "high")
    .slice(0, 5);

  // Top 3 缺失机会（从 GEO 提及率 0 倒推）
  let missedOpportunities: string[] = [];
  if (recentGeoMetrics && recentGeoMetrics.totalQuestions > 0) {
    if (recentGeoMetrics.brandMentioned === 0) {
      missedOpportunities.push("本周主品牌在 AI 答案中 0 次提及，急需补充定义型内容");
    }
    if (recentGeoMetrics.brandRecommended === 0) {
      missedOpportunities.push("本周主品牌 0 次被推荐，建议加 FAQ / 对比表 / 第三方背书");
    }
    if (recentGeoMetrics.competitorSuppress > 0) {
      missedOpportunities.push(`${recentGeoMetrics.competitorSuppress} 个问题竞品被推荐但主品牌未`);
    }
  }

  return `# ${project.name} - 周报

**时间范围**：${fmtDate(from)} ~ ${fmtDate(now)}
**生成时间**：${now.toLocaleString("zh-CN")}

---

## 1. 本期总览

| 指标 | 本周 | 上周 | 变化 |
|---|---|---|---|
| SEO 健康分（项目平均） | ${recentAvgScore} | ${prevAvgScore} | ${recentAvgScore - prevAvgScore > 0 ? "+" : ""}${recentAvgScore - prevAvgScore} |
| GEO 可见度分（${fromDays} 天滚动） | ${recentGeoMetrics?.score ?? "-"} | - | - |
| 诊断页面数 | ${recentAudits.length} | ${prevAudits.length} | - |
| LLM 调用成本 | ¥${(Number(llmCosts._sum.costCents ?? 0) / 100).toFixed(2)} | - | - |

## 2. SEO 表现

### 2.1 Top 5 高严重度问题
${allFindings.length === 0 ? "_无_" : allFindings.map((f) => `- **[${f.code}]** ${f.title} — ${f.recommendation}`).join("\n")}

## 3. GEO 表现（${fromDays} 天滚动）

### 3.1 品牌可见度
- 主品牌被提及：${recentGeoMetrics?.brandMentioned ?? 0} / ${recentGeoMetrics?.totalQuestions ?? 0} (${pct(recentGeoMetrics?.brandMentioned ?? 0, recentGeoMetrics?.totalQuestions ?? 0)})
- 主品牌被推荐：${recentGeoMetrics?.brandRecommended ?? 0} / ${recentGeoMetrics?.totalQuestions ?? 0} (${pct(recentGeoMetrics?.brandRecommended ?? 0, recentGeoMetrics?.totalQuestions ?? 0)})
- 竞品压制：${recentGeoMetrics?.competitorSuppress ?? 0} 次

### 3.2 Top 3 缺失机会
${missedOpportunities.length === 0 ? "_无_" : missedOpportunities.map((o) => `- ${o}`).join("\n")}

## 4. 任务进度

| 指标 | 数值 |
|---|---|
| 本周新增任务 | ${tasksCreated} |
| 本周完成任务 | ${tasksDone} |
| 趋势 | ${tasksDone > tasksCreated ? "✓ 进度健康" : "⚠️ 新增 > 完成"} |

## 5. LLM 成本明细

| 指标 | 数值 |
|---|---|
| 调用次数 | - |
| Token 数 | ${llmCosts._sum.totalTokens ?? 0} |
| 估算成本 | ¥${(Number(llmCosts._sum.costCents ?? 0) / 100).toFixed(2)} |

## 6. 下周建议

${recentAvgScore < 60 ? "- 优先修复 high 严重度 SEO 问题\n" : ""}${recentGeoMetrics?.brandRecommended === 0 ? "- 在关键页面补充定义型段落 / FAQ / 对比表\n" : ""}- 保持 GEO 监测每日运行，关注品牌提及率变化
`;
}

// ============= 月报 =============

export async function generateMonthlyReport(projectId: string, fromDays = 30): Promise<string> {
  const now = new Date();
  const from = new Date(now.getTime() - fromDays * 24 * 3600 * 1000);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("项目不存在");

  const weeklyReport = await generateWeeklyReport(projectId, 7);

  // 4 周趋势（每周的 SEO 分）
  const weeklyScores: number[] = [];
  for (let w = 0; w < 4; w++) {
    const wFrom = new Date(now.getTime() - (w + 1) * 7 * 24 * 3600 * 1000);
    const wTo = new Date(now.getTime() - w * 7 * 24 * 3600 * 1000);
    const audits = await prisma.pageAudit.findMany({
      where: { page: { projectId }, createdAt: { gte: wFrom, lt: wTo } },
    });
    const avg = audits.length > 0
      ? Math.round(audits.reduce((s, a) => s + a.score, 0) / audits.length)
      : 0;
    weeklyScores.unshift(avg);
  }

  // Top 10 长期问题
  const allAudits = await prisma.pageAudit.findMany({
    where: { page: { projectId }, createdAt: { gte: from } },
  });
  const codeCount = new Map<string, number>();
  for (const a of allAudits) {
    for (const f of a.findings as Array<{ code: string }>) {
      codeCount.set(f.code, (codeCount.get(f.code) ?? 0) + 1);
    }
  }
  const topIssues = Array.from(codeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([code, count]) => `- **${code}**: 出现 ${count} 次`);

  // 完整任务统计
  const taskStats = await prisma.optimizationTask.groupBy({
    by: ["status"],
    where: { projectId },
    _count: { _all: true },
  });
  const taskStatMap = Object.fromEntries(taskStats.map((t) => [t.status, t._count._all]));

  return `# ${project.name} - 月报

**时间范围**：${fmtDate(from)} ~ ${fmtDate(now)}
**生成时间**：${now.toLocaleString("zh-CN")}

---

## 1. 月度摘要

${weeklyReport}

## 2. 4 周 SEO 分数趋势

| 第 1 周 | 第 2 周 | 第 3 周 | 第 4 周 |
|---|---|---|---|
| ${weeklyScores[0]} | ${weeklyScores[1]} | ${weeklyScores[2]} | ${weeklyScores[3]} |

## 3. Top 10 长期问题

${topIssues.length === 0 ? "_无_" : topIssues.join("\n")}

## 4. 任务统计

| 状态 | 数量 |
|---|---|
| 待办（TODO） | ${taskStatMap.TODO ?? 0} |
| 进行中（DOING） | ${taskStatMap.DOING ?? 0} |
| 待审（REVIEW） | ${taskStatMap.REVIEW ?? 0} |
| 完成（DONE） | ${taskStatMap.DONE ?? 0} |
| 忽略（IGNORED） | ${taskStatMap.IGNORED ?? 0} |
| **合计** | ${Object.values(taskStatMap).reduce((a, b) => a + b, 0)} |

## 5. 下月建议

- 优先解决 Top 10 长期问题
- 持续监测 GEO 提及率与推荐率
- 关注 LLM 成本变化
`;
}

// ============= 单项目诊断报告 =============

export async function generateAuditReport(auditId: string): Promise<string> {
  const audit = await prisma.pageAudit.findUnique({
    where: { id: auditId },
    include: { page: { include: { project: true } } },
  });
  if (!audit) throw new Error("审计不存在");

  const project = audit.page.project;
  const findings = audit.findings as Array<{
    code: string;
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    recommendation: string;
    currentValue?: string | number | null;
    expectedValue?: string | number | null;
  }>;
  const snap = audit.rawSnapshot as {
    title?: string;
    description?: string;
    h1?: string;
    wordCount: number;
    internalLinkCount: number;
    externalLinkCount: number;
    imageCount: number;
    imageWithAltCount: number;
    hasCanonical: boolean;
    hasSchema: boolean;
    hasOpenGraph: boolean;
    performance?: { ttfb: number; fcp: number | null; lcp: number | null; tbt: number };
    crawlMethod?: string;
  };
  const perf = snap.performance;

  const grouped = {
    high: findings.filter((f) => f.severity === "high"),
    medium: findings.filter((f) => f.severity === "medium"),
    low: findings.filter((f) => f.severity === "low"),
  };

  return `# ${snap.title ?? audit.page.url} - 诊断报告

**URL**：${audit.page.url}
**项目**：${project.name}
**诊断时间**：${audit.createdAt.toLocaleString("zh-CN")}

---

## 1. 总分

**${audit.score} / 100**

## 2. 性能指标

| 指标 | 数值 | 阈值 | 状态 |
|---|---|---|---|
| TTFB | ${Math.round(perf?.ttfb ?? 0)}ms | < 800ms | ${(perf?.ttfb ?? 0) <= 800 ? "✓" : "✗"} |
| FCP | ${perf?.fcp ? Math.round(perf.fcp) + "ms" : "未测"} | < 1800ms | ${(perf?.fcp ?? 0) <= 1800 ? "✓" : "✗"} |
| LCP | ${perf?.lcp ? Math.round(perf.lcp) + "ms" : "未测"} | < 2500ms | ${(perf?.lcp ?? 0) <= 2500 ? "✓" : "✗"} |
| TBT | ${Math.round(perf?.tbt ?? 0)}ms | < 200ms | ${(perf?.tbt ?? 0) <= 200 ? "✓" : "✗"} |

## 3. 详细问题清单（${findings.length} 项）

### 3.1 high（${grouped.high.length} 项）
${grouped.high.length === 0 ? "_无_" : grouped.high.map((f) => `- **${f.title}** (${f.code}) — ${f.recommendation}`).join("\n")}

### 3.2 medium（${grouped.medium.length} 项）
${grouped.medium.length === 0 ? "_无_" : grouped.medium.map((f) => `- **${f.title}** (${f.code}) — ${f.recommendation}`).join("\n")}

### 3.3 low（${grouped.low.length} 项）
${grouped.low.length === 0 ? "_无_" : grouped.low.map((f) => `- **${f.title}** (${f.code}) — ${f.recommendation}`).join("\n")}

## 4. 页面快照

| 项 | 值 |
|---|---|
| 标题 | ${snap.title ?? "-"} |
| Meta description | ${snap.description ?? "-"} |
| H1 | ${snap.h1 ?? "-"} |
| 字数 | ${snap.wordCount} |
| 内链 / 外链 | ${snap.internalLinkCount} / ${snap.externalLinkCount} |
| 图片 | ${snap.imageWithAltCount} / ${snap.imageCount}（带 alt） |
| Canonical | ${snap.hasCanonical ? "✓" : "✗"} |
| Schema | ${snap.hasSchema ? "✓" : "✗"} |
| Open Graph | ${snap.hasOpenGraph ? "✓" : "✗"} |
`;
}

// ============= 主入口 =============

export async function generateReport(input: GenerateReportInput): Promise<string> {
  if (input.type === "WEEKLY") {
    return generateWeeklyReport(input.projectId, input.fromDays);
  }
  if (input.type === "MONTHLY") {
    return generateMonthlyReport(input.projectId, input.fromDays);
  }
  if (input.type === "AUDIT") {
    if (!input.auditId) throw new Error("AUDIT 类型必须提供 auditId");
    return generateAuditReport(input.auditId);
  }
  throw new Error("未知报告类型");
}
