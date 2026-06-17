"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface ProjectDetail {
  id: string;
  name: string;
  domain: string;
  primaryBrand: string;
  language: string;
  region: string;
  status: "ACTIVE" | "ARCHIVED";
  geoDailyEnabled: boolean;
  geoChannels: string[];
  createdAt: string;
}

interface GeoMetrics {
  score: number;
  brandMentioned: number;
  brandRecommended: number;
  totalQuestions: number;
  trend: "up" | "down" | "stable";
}

export default function ProjectOverviewPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [metrics, setMetrics] = useState<GeoMetrics | null>(null);
  const [keywordCount, setKeywordCount] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [brandCount, setBrandCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [p, m, kw, qs, br] = await Promise.all([
        fetch(`/api/projects/${projectId}`).then((r) => r.json()),
        fetch(`/api/projects/${projectId}/geo/metrics`).then((r) => r.json()),
        fetch(`/api/projects/${projectId}/keywords`).then((r) => r.json()),
        fetch(`/api/projects/${projectId}/geo/questions`).then((r) => r.json()),
        fetch(`/api/projects/${projectId}/brands`).then((r) => r.json()),
      ]);
      if (p.data) setProject(p.data);
      if (m.data) setMetrics(m.data);
      setKeywordCount((kw.data ?? []).length);
      setQuestionCount((qs.data ?? []).length);
      setBrandCount((br.data ?? []).length);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <p className="text-red-500">项目不存在或无权限</p>
        <Link href="/projects" className="text-sm text-blue-600 hover:underline">
          ← 返回项目列表
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
            ← 项目列表
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{project.name}</h1>
          <p className="text-sm text-muted-foreground">
            {project.domain} · {project.language} · {project.region}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
          {project.status === "ARCHIVED" && (
            <span className="rounded bg-muted px-2 py-0.5">归档</span>
          )}
          <span>
            主品牌：<span className="font-medium text-foreground">{project.primaryBrand}</span>
          </span>
        </div>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="GEO 评分"
          value={metrics ? `${metrics.score}` : "-"}
          hint={
            metrics
              ? `趋势：${metrics.trend === "up" ? "↑" : metrics.trend === "down" ? "↓" : "—"}`
              : "尚无数据"
          }
        />
        <MetricCard
          label="GEO 渠道"
          value={project.geoChannels.length.toString()}
          hint={project.geoChannels.join(", ")}
        />
        <MetricCard
          label="关键词数"
          value={keywordCount.toString()}
          hint={`${questionCount} 个 GEO 问题`}
        />
        <MetricCard
          label="品牌 / 竞品"
          value={brandCount.toString()}
          hint="含主品牌 + 竞品"
        />
      </div>

      {/* 快捷入口 */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">子模块</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NavCard href={`/projects/${projectId}/health`} title="健康度仪表" desc="5 维度综合评分 + 风险信号" badge="NEW" />
          <NavCard href={`/projects/${projectId}/activity`} title="活动流 + 趋势" desc="最近 30 天事件时间线" badge="NEW" />
          <NavCard href={`/projects/${projectId}/brands`} title="品牌与竞品" desc="管理主品牌、别名、竞品列表" />
          <NavCard href={`/projects/${projectId}/pages`} title="页面与诊断" desc="查看已抓取页面与 SEO 分数" />
          <NavCard href={`/keywords?projectId=${projectId}`} title="关键词" desc="SEO 关键词库" />
          <NavCard href={`/geo?projectId=${projectId}`} title="GEO 问题" desc="AI 搜索监测问题库" />
          <NavCard href={`/tasks?projectId=${projectId}`} title="优化任务" desc="人工 + 自动生成的优化任务" />
          <NavCard href={`/content?projectId=${projectId}`} title="内容工作流" desc="AI 生成 / 改写 / 审核 / 发布" />
          <NavCard href={`/settings/distribution?projectId=${projectId}`} title="分发配置" desc="知乎/微信/飞书/Webhook" />
          <NavCard href={`/reports?projectId=${projectId}`} title="报告" desc="周报 / 月报 / 单次诊断" />
          <NavCard href={`/brand/monitor?projectId=${projectId}`} title="品牌监控" desc="全网品牌提及扫描" />
          {isAdmin && (
            <NavCard
              href={`/projects/${projectId}/members`}
              title="成员管理"
              desc="项目级别权限（OWNER / EDITOR / VIEWER）"
            />
          )}
          <NavCard href={`/projects/${projectId}/settings`} title="项目设置" desc="语言/地区/GEO 渠道/Sitemap" />
        </div>

        {/* 跨项目工具 */}
        <div className="mt-6 rounded-md border border-info/20 bg-info/5 p-3 text-center font-mono text-[11px] text-muted-foreground">
          // TOOLS
          <span className="ml-3">
            <Link href={`/projects/compare?ids=${projectId}`} className="text-info hover:underline">
              加入多项目对比
            </Link>
          </span>
          <span className="ml-3 text-muted-foreground/40">·</span>
          <span className="ml-3">
            <Link href="/projects/new?mode=clone" className="text-info hover:underline">
              克隆此项目
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function NavCard({ href, title, desc, badge }: { href: string; title: string; desc: string; badge?: string }) {
  return (
    <Link
      href={href}
      className="relative block rounded-md border border-border bg-background p-4 transition-colors hover:border-primary hover:bg-muted/50"
    >
      {badge && (
        <span className="absolute right-2 top-2 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary">
          {badge}
        </span>
      )}
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </Link>
  );
}
