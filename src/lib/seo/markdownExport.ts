// 把审计 + 建议渲染成可分享的 Markdown。
// 用途:用户 1-click 下载或复制,粘贴到 Notion / 飞书 / 微信公众号。
import type { Finding } from "./analyzer";
import type { SeoRecommendation } from "./recommendations";

interface AuditExportInput {
  url: string;
  title: string | null;
  score: number;
  statusCode: number | null;
  indexable: boolean | null;
  findings: Finding[];
  recommendations: SeoRecommendation[];
  performance?: {
    ttfb?: number;
    fcp?: number;
    lcp?: number;
    tbt?: number;
  } | null;
  snapshot?: {
    title?: string;
    description?: string;
    h1?: string;
    wordCount?: number;
    internalLinkCount?: number;
    externalLinkCount?: number;
    imageCount?: number;
    imageWithAltCount?: number;
    hasCanonical?: boolean;
    hasSchema?: boolean;
    hasOpenGraph?: boolean;
  } | null;
  generatedAt?: Date;
}

const SEVERITY_EMOJI: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🔵",
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

function fmt(n?: number, unit = "ms"): string {
  if (n === undefined || n === null) return "—";
  return `${n}${unit}`;
}

function severityRank(s: string): number {
  if (s === "high") return 0;
  if (s === "medium") return 1;
  return 2;
}

export function renderAuditMarkdown(input: AuditExportInput): string {
  const {
    url, title, score, statusCode, indexable, findings, recommendations,
    performance, snapshot, generatedAt = new Date(),
  } = input;

  const sorted = [...findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  const high = sorted.filter((f) => f.severity === "high");
  const medium = sorted.filter((f) => f.severity === "medium");
  const low = sorted.filter((f) => f.severity === "low");

  const lines: string[] = [];
  lines.push(`# SEO 审计报告 — ${title ?? url}`);
  lines.push("");
  lines.push(`> **URL**: ${url}`);
  lines.push(`> **生成时间**: ${generatedAt.toISOString().slice(0, 19).replace("T", " ")}`);
  lines.push(`> **SEO 评分**: **${score}** / 100`);
  lines.push(`> **HTTP 状态**: ${statusCode ?? "—"}`);
  lines.push(`> **可索引**: ${indexable ? "✅ 是" : "❌ 否"}`);
  lines.push("");

  // 评分等级
  let grade: string;
  if (score >= 80) grade = "✅ 优秀";
  else if (score >= 60) grade = "⚠️ 良好,需小幅优化";
  else if (score >= 40) grade = "❌ 较差,需要重点优化";
  else grade = "🚨 很差,急需修复";

  lines.push(`## 综合评估: ${grade}`);
  lines.push("");

  // 性能
  if (performance) {
    lines.push("## 性能指标");
    lines.push("");
    lines.push("| 指标 | 实测 | 优秀阈值 |");
    lines.push("|------|------|----------|");
    lines.push(`| TTFB | ${fmt(performance.ttfb)} | < 800ms |`);
    lines.push(`| FCP  | ${fmt(performance.fcp)} | < 1800ms |`);
    lines.push(`| LCP  | ${fmt(performance.lcp)} | < 2500ms |`);
    lines.push(`| TBT  | ${fmt(performance.tbt)} | < 200ms |`);
    lines.push("");
  }

  // 页面快照
  if (snapshot) {
    lines.push("## 页面快照");
    lines.push("");
    lines.push(`- **Title**: ${snapshot.title || "_缺失_"}`);
    lines.push(`- **Meta Description**: ${snapshot.description || "_缺失_"}`);
    lines.push(`- **H1**: ${snapshot.h1 || "_缺失_"}`);
    lines.push(`- **字数**: ${snapshot.wordCount ?? "—"}`);
    lines.push(`- **链接**: 内链 ${snapshot.internalLinkCount ?? 0} / 外链 ${snapshot.externalLinkCount ?? 0}`);
    lines.push(`- **图片**: ${snapshot.imageWithAltCount ?? 0}/${snapshot.imageCount ?? 0} 有 alt`);
    lines.push(`- **Canonical**: ${snapshot.hasCanonical ? "✅" : "❌"}`);
    lines.push(`- **Schema**: ${snapshot.hasSchema ? "✅" : "❌"}`);
    lines.push(`- **Open Graph**: ${snapshot.hasOpenGraph ? "✅" : "❌"}`);
    lines.push("");
  }

  // 问题清单
  lines.push(`## 问题清单 (${findings.length} 项)`);
  lines.push("");
  if (sorted.length === 0) {
    lines.push("✨ 未发现明显问题。");
    lines.push("");
  } else {
    if (high.length) {
      lines.push(`### ${SEVERITY_EMOJI.high} 高优先级 (${high.length})`);
      lines.push("");
      high.forEach((f, i) => lines.push(`${i + 1}. **${f.title}** (${f.code})\n   - ${f.description}\n   - 💡 ${f.recommendation}`));
      lines.push("");
    }
    if (medium.length) {
      lines.push(`### ${SEVERITY_EMOJI.medium} 中优先级 (${medium.length})`);
      lines.push("");
      medium.forEach((f, i) => lines.push(`${i + 1}. **${f.title}** (${f.code})\n   - ${f.description}\n   - 💡 ${f.recommendation}`));
      lines.push("");
    }
    if (low.length) {
      lines.push(`### ${SEVERITY_EMOJI.low} 低优先级 (${low.length})`);
      lines.push("");
      low.forEach((f, i) => lines.push(`${i + 1}. **${f.title}** (${f.code})\n   - ${f.description}\n   - 💡 ${f.recommendation}`));
      lines.push("");
    }
  }

  // 可执行建议
  if (recommendations.length > 0) {
    lines.push(`## ✅ 可执行优化建议 (${recommendations.length} 条)`);
    lines.push("");
    const sortedRecs = [...recommendations].sort((a, b) => a.priority - b.priority);
    sortedRecs.forEach((r, i) => {
      const pLabel = r.priority === 1 ? "🚨 紧急" : r.priority === 2 ? "⚠️ 重要" : "💡 可选";
      lines.push(`### ${i + 1}. ${r.title} [${pLabel}]`);
      lines.push("");
      lines.push(`- **类别**: ${r.category}`);
      lines.push(`- **影响**: ${r.impact} | **难度**: ${r.effort}`);
      lines.push(`- **预期收益**: ${r.expectedBenefit}`);
      lines.push("");
      lines.push(r.description);
      lines.push("");
      if (r.steps.length > 0) {
        lines.push("**执行步骤**:");
        r.steps.forEach((s) => lines.push(`1. ${s}`));
        lines.push("");
      }
      if (r.codeExample) {
        lines.push("**代码示例**:");
        lines.push("```");
        lines.push(r.codeExample);
        lines.push("```");
        lines.push("");
      }
      if (r.references && r.references.length > 0) {
        lines.push(`**参考资料**: ${r.references.join(" / ")}`);
        lines.push("");
      }
    });
  }

  lines.push("---");
  lines.push("");
  lines.push("_本报告由 GEO-SEO 平台自动生成。_");

  return lines.join("\n");
}
