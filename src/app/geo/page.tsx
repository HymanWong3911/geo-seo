"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { DonutChart, BarChart, EmptyState } from "@/components/ui/DashboardWidgets";

interface GeoQuestion {
  id: string;
  question: string;
  language: string;
  region: string;
  intent: string;
  priority: number;
  active: boolean;
  keywordIds: string[];
}

const INTENTS = [
  "INFORMATIONAL", "COMMERCIAL", "TRANSACTIONAL", "NAVIGATIONAL", "LOCAL", "COMPARISON",
] as const;

const INTENT_LABEL: Record<string, string> = {
  INFORMATIONAL: "📚 信息",
  COMMERCIAL: "💼 商业",
  TRANSACTIONAL: "🛒 交易",
  NAVIGATIONAL: "🧭 导航",
  LOCAL: "📍 本地",
  COMPARISON: "⚖️ 对比",
};

const INTENT_COLORS: Record<string, string> = {
  INFORMATIONAL: "hsl(217 91% 60%)",
  COMMERCIAL: "hsl(262 83% 58%)",
  TRANSACTIONAL: "hsl(142 71% 45%)",
  NAVIGATIONAL: "hsl(38 92% 50%)",
  LOCAL: "hsl(346 84% 61%)",
  COMPARISON: "hsl(187 95% 43%)",
};

const PRIORITY_BADGE: Record<number, string> = {
  1: "bg-destructive/15 text-destructive border border-destructive/30",
  2: "bg-warning/15 text-warning border border-warning/30",
  3: "bg-info/15 text-info border border-info/30",
  4: "bg-primary/15 text-primary border border-primary/30",
  5: "bg-muted text-muted-foreground border border-border",
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "紧急",
  2: "高",
  3: "中",
  4: "低",
  5: "很低",
};

export default function GeoPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [questions, setQuestions] = useState<GeoQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [intentFilter, setIntentFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!projectId) { setQuestions([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/geo/questions`);
    const json = await res.json();
    setQuestions(json.data ?? []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  async function toggleActive(q: GeoQuestion) {
    const res = await fetch(`/api/geo/questions/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !q.active }),
    });
    if (res.ok) {
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? { ...x, active: !x.active } : x)));
    }
  }

  async function handleDelete(q: GeoQuestion) {
    if (!confirm(`确认删除「${q.question.slice(0, 40)}...」?`)) return;
    const res = await fetch(`/api/geo/questions/${q.id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  const activeCount = questions.filter(q => q.active).length;

  // 过滤
  const filtered = useMemo(() => questions.filter(q => {
    if (intentFilter && q.intent !== intentFilter) return false;
    if (activeFilter === "active" && !q.active) return false;
    if (activeFilter === "inactive" && q.active) return false;
    if (search && !q.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [questions, intentFilter, activeFilter, search]);

  // KPI
  const stats = useMemo(() => ({
    total: questions.length,
    active: activeCount,
    inactive: questions.length - activeCount,
    p1: questions.filter(q => q.priority === 1).length,
    withKeywords: questions.filter(q => q.keywordIds.length > 0).length,
  }), [questions, activeCount]);

  // Intent 饼图
  const intentBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions) m.set(q.intent, (m.get(q.intent) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([intent, value]) => ({
        label: INTENT_LABEL[intent] ?? intent,
        value,
        color: INTENT_COLORS[intent] ?? "hsl(220 9% 60%)",
      }));
  }, [questions]);

  // 优先级柱图
  const priorityBreakdown = useMemo(() => {
    const m = new Map<number, number>();
    for (const q of questions) m.set(q.priority, (m.get(q.priority) ?? 0) + 1);
    return [1, 2, 3, 4, 5].map(p => ({
      label: `P${p} ${PRIORITY_LABEL[p]}`,
      value: m.get(p) ?? 0,
      color: p === 1 ? "hsl(0 84% 60%)" : p === 2 ? "hsl(38 92% 50%)" : p === 3 ? "hsl(217 91% 60%)" : p === 4 ? "hsl(262 83% 58%)" : "hsl(220 9% 46%)",
    })).filter(p => p.value > 0);
  }, [questions]);

  // 语言区域
  const localeBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions) m.set(`${q.language}/${q.region}`, (m.get(`${q.language}/${q.region}`) ?? 0) + 1);
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  }, [questions]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// GEO — Question Bank</div>
          <h1 className="mt-2">GEO Question Bank</h1>
          <p className="text-sm text-muted-foreground mt-1">用户在 AI 搜索引擎里可能问的问题,触发检测看品牌被提及多少次</p>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              + 新建问题
            </button>
          )}
        </div>
      </header>

      {!projectId ? (
        <EmptyState icon="◎" title="选择项目" description="先在右上角选择一个项目,管理 GEO 问题" />
      ) : (
        <>
          {loading ? (
            <SkeletonTable rows={6} />
          ) : questions.length === 0 ? (
            <EmptyState
              icon="💭"
              title="还没有 GEO 问题"
              description="添加用户在 AI 搜索里可能问的问题,触发检测看品牌被提及多少次"
              action={
                <button onClick={() => setShowAdd(true)} className="btn-primary">
                  + 添加第一个问题
                </button>
              }
            />
          ) : (
            <>
              {/* KPI */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="card p-4">
                  <div className="eyebrow">total</div>
                  <div className="metric-number mt-1">{stats.total}</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">active</div>
                  <div className="metric-number mt-1 text-success">{stats.active}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-1">
                    {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%
                  </div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">inactive</div>
                  <div className={`metric-number mt-1 ${stats.inactive > 0 ? "text-muted-foreground" : "text-muted-foreground"}`}>{stats.inactive}</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">with_keywords</div>
                  <div className="metric-number mt-1 text-primary">{stats.withKeywords}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-1">关联关键词</div>
                </div>
                <div className="card p-4">
                  <div className="eyebrow">urgent · P1</div>
                  <div className={`metric-number mt-1 ${stats.p1 > 0 ? "text-destructive" : "text-muted-foreground"}`}>{stats.p1}</div>
                  <div className="text-[10px] font-mono text-muted-foreground mt-1">紧急</div>
                </div>
              </div>

              {/* 可视化区 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="card p-4">
                  <h3 className="eyebrow mb-3">by_intent</h3>
                  <DonutChart
                    segments={intentBreakdown}
                    centerLabel="intents"
                    centerValue={intentBreakdown.length}
                    size={120}
                    thickness={14}
                  />
                </div>
                <div className="card p-4">
                  <h3 className="eyebrow mb-3">by_priority</h3>
                  {priorityBreakdown.length > 0 ? (
                    <BarChart data={priorityBreakdown} defaultColor="hsl(var(--primary))" />
                  ) : (
                    <EmptyState icon="∅" description="暂无" />
                  )}
                </div>
                <div className="card p-4">
                  <h3 className="eyebrow mb-3">by_locale</h3>
                  {localeBreakdown.length > 0 ? (
                    <BarChart data={localeBreakdown} defaultColor="hsl(var(--info))" />
                  ) : (
                    <EmptyState icon="∅" description="暂无" />
                  )}
                </div>
              </div>

              {/* 筛选 */}
              <div className="space-y-3">
                <div className="flex gap-1.5 flex-wrap">
                  <button
                    onClick={() => setActiveFilter("all")}
                    className={`badge cursor-pointer ${activeFilter === "all" ? "bg-primary/20 text-primary border border-primary/40" : "bg-muted text-muted-foreground border border-border"}`}
                  >全部</button>
                  <button
                    onClick={() => setActiveFilter("active")}
                    className={`badge cursor-pointer ${activeFilter === "active" ? "bg-success/20 text-success border border-success/40" : "bg-muted text-muted-foreground border border-border"}`}
                  >活跃</button>
                  <button
                    onClick={() => setActiveFilter("inactive")}
                    className={`badge cursor-pointer ${activeFilter === "inactive" ? "bg-muted text-muted-foreground border border-border" : "bg-muted text-muted-foreground border border-border"}`}
                  >停用</button>
                </div>
                <div className="flex gap-3 flex-wrap items-center">
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索问题..."
                    className="input-field flex-1 min-w-[200px]"
                  />
                  <select
                    value={intentFilter}
                    onChange={e => setIntentFilter(e.target.value)}
                    className="input-field w-44"
                  >
                    <option value="">all_intents</option>
                    {INTENTS.map(i => (
                      <option key={i} value={i}>{INTENT_LABEL[i] ?? i}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 表格 */}
              <div className="card overflow-hidden p-0">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left p-3">question</th>
                      <th className="text-left p-3 w-32">intent</th>
                      <th className="text-left p-3 w-24">priority</th>
                      <th className="text-left p-3 w-32">lang/region</th>
                      <th className="text-center p-3 w-24">keywords</th>
                      <th className="text-center p-3 w-28">status</th>
                      <th className="text-right p-3 w-28">actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(q => (
                      <tr key={q.id} className={`border-t border-border hover:bg-muted/20 ${!q.active ? "opacity-60" : ""}`}>
                        <td className="p-3 text-sm leading-relaxed">{q.question}</td>
                        <td className="p-3">
                          <span className="badge text-[10px] bg-muted text-foreground border border-border">
                            {INTENT_LABEL[q.intent] ?? q.intent}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`badge text-[10px] ${PRIORITY_BADGE[q.priority]}`}>
                            P{q.priority} {PRIORITY_LABEL[q.priority]}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">{q.language}/{q.region}</td>
                        <td className="p-3 text-center font-mono text-xs">
                          {q.keywordIds.length > 0 ? (
                            <span className="badge bg-primary/15 text-primary border border-primary/30 text-[10px]">{q.keywordIds.length}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => void toggleActive(q)}
                            className={`badge cursor-pointer text-[10px] ${q.active ? "bg-success/15 text-success border border-success/30" : "bg-muted text-muted-foreground border border-border"}`}
                          >
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${q.active ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                            {q.active ? "active" : "inactive"}
                          </button>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <button
                              onClick={() => void toggleActive(q)}
                              className="btn-ghost btn-sm"
                              title={q.active ? "停用" : "启用"}
                            >
                              {q.active ? "停用" : "启用"}
                            </button>
                            <button
                              onClick={() => void handleDelete(q)}
                              className="btn-ghost btn-sm text-destructive hover:bg-destructive/10"
                              title="删除"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {showAdd && projectId && (
        <AddQuestionDialog
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); void load(); }}
        />
      )}
    </div>
  );
}

function AddQuestionDialog({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    question: "",
    intent: "INFORMATIONAL",
    priority: 3,
    language: "zh",
    region: "CN",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/geo/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json?.error?.message ?? "创建失败"); return; }
    onAdded();
  }

  return (
    <div className="dialog-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog-panel">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="eyebrow">// GEO — New Question</div>
              <h2 className="mt-1">添加 GEO 问题</h2>
            </div>
            <button onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">问题 <span className="text-destructive">*</span></label>
            <div className="input-field items-start">
              <span className="input-field-icon">›</span>
              <textarea
                required
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                rows={3}
                className="flex-1 bg-transparent outline-none text-sm resize-none py-2"
                placeholder="例如：企业 SEO 工具推荐有哪些?"
                autoFocus
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">意图</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <select value={form.intent}
                  onChange={(e) => setForm({ ...form, intent: e.target.value })}
                  className="flex-1 bg-transparent outline-none text-sm">
                  {INTENTS.map((i) => <option key={i} value={i}>{INTENT_LABEL[i] ?? i}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">优先级</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <select value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) })}
                  className="flex-1 bg-transparent outline-none text-sm">
                  {[1, 2, 3, 4, 5].map(p => (
                    <option key={p} value={p}>P{p} {PRIORITY_LABEL[p]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">语言</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input type="text" value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  placeholder="zh" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">区域</label>
              <div className="input-field">
                <span className="input-field-icon">›</span>
                <input type="text" value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="CN" />
              </div>
            </div>
          </div>
          {error && (
            <div className="border border-destructive/50 bg-destructive/5 px-3 py-2 font-mono text-[10px] text-destructive">
              [ error ] {error}
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" onClick={onClose} className="btn-ghost">取消</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "创建中..." : "创建 →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
