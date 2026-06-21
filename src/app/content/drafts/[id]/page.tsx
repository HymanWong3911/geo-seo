"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProgressBar, ScoreRing, EmptyState } from "@/components/ui/DashboardWidgets";

// TipTap 是 client-only，dynamic import 避免 SSR
const RichEditor = dynamic(
  () => import("@/components/editor/RichEditor").then((m) => m.RichEditor),
  { ssr: false, loading: () => <div className="card p-4 text-sm text-muted-foreground">加载编辑器...</div> },
);

interface Draft {
  id: string;
  title: string;
  content: string;
  contentFormat: "html" | "markdown";
  excerpt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED" | "ARCHIVED";
  sourceType: string;
  targetUrl: string | null;
  targetKeywords: string[];
  authorId: string;
  reviewerId: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Revision {
  id: string;
  version: number;
  title: string;
  changeNote: string | null;
  createdById: string;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border border-border",
  PENDING_REVIEW: "bg-warning/15 text-warning border border-warning/30",
  APPROVED: "bg-success/15 text-success border border-success/30",
  REJECTED: "bg-destructive/15 text-destructive border border-destructive/30",
  PUBLISHED: "bg-info/15 text-info border border-info/30",
  ARCHIVED: "bg-muted text-muted-foreground border border-border",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待审",
  APPROVED: "已审",
  REJECTED: "已驳回",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

// 简易 HTML → 纯文本
function htmlToText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// SEO 评分
function calculateSeoScore(opts: {
  title: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}): { score: number; tips: string[]; stats: { wordCount: number; paragraphCount: number; charCount: number; keywordDensity: Record<string, number> } } {
  const tips: string[] = [];
  let score = 0;

  const text = htmlToText(opts.content);
  const wordCount = text.length; // 中文按字符数
  const paragraphCount = (opts.content.match(/<p[^>]*>/g) ?? []).length;
  const charCount = text.length;

  // 关键词密度
  const keywordDensity: Record<string, number> = {};
  for (const kw of opts.keywords) {
    if (!kw) continue;
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = text.match(re);
    const count = matches?.length ?? 0;
    keywordDensity[kw] = wordCount > 0 ? Math.round((count / wordCount) * 100 * 100) / 100 : 0;
  }

  // 1. 字数 (0-30)
  if (wordCount >= 1500) { score += 30; }
  else if (wordCount >= 800) { score += 22; }
  else if (wordCount >= 400) { score += 14; }
  else if (wordCount >= 100) { score += 7; tips.push("字数偏少,建议 ≥ 800 字"); }
  else { tips.push("字数过少,SEO 很难做起来"); }

  // 2. 标题 (0-15)
  if (opts.title.length >= 20 && opts.title.length <= 60) score += 15;
  else if (opts.title.length > 0) { score += 8; tips.push("标题建议 20-60 字"); }

  // 3. Meta Title (0-15)
  const mt = opts.metaTitle.trim();
  if (mt.length >= 20 && mt.length <= 60) score += 15;
  else if (mt.length > 0) { score += 8; tips.push("Meta Title 建议 20-60 字"); }
  else tips.push("缺少 Meta Title");

  // 4. Meta Description (0-15)
  const md = opts.metaDescription.trim();
  if (md.length >= 80 && md.length <= 160) score += 15;
  else if (md.length > 0) { score += 8; tips.push("Meta Description 建议 80-160 字"); }
  else tips.push("缺少 Meta Description");

  // 5. 关键词覆盖 (0-15)
  const usedKw = opts.keywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
  if (opts.keywords.length === 0) {
    score += 5; // 没目标词,不扣
  } else if (usedKw.length === opts.keywords.length) {
    score += 15;
  } else if (usedKw.length > 0) {
    score += Math.round((usedKw.length / opts.keywords.length) * 15);
    tips.push(`有 ${opts.keywords.length - usedKw.length} 个关键词未在正文出现`);
  } else {
    tips.push("正文未出现任何目标关键词");
  }

  // 6. 段落 (0-10)
  if (paragraphCount >= 5) score += 10;
  else if (paragraphCount >= 3) score += 6;
  else tips.push("段落过少,建议 ≥ 5 段");

  return {
    score: Math.min(100, score),
    tips,
    stats: { wordCount, paragraphCount, charCount, keywordDensity },
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  return "text-destructive";
}

export default function DraftEditPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId") ?? "";

  const [draft, setDraft] = useState<Draft | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [reviewComments, setReviewComments] = useState("");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");

  async function load() {
    setLoading(true);
    const [d, r] = await Promise.all([
      fetch(`/api/drafts/${params.id}`).then((r) => r.json()),
      fetch(`/api/drafts/${params.id}/revisions`).then((r) => r.json()),
    ]);
    if (d.data) {
      setDraft(d.data);
      setTitle(d.data.title);
      setContent(d.data.content);
      setMetaTitle(d.data.metaTitle ?? "");
      setMetaDescription(d.data.metaDescription ?? "");
    }
    setRevisions(r.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, metaTitle, metaDescription }),
    });
    if (res.ok) {
      setLastSavedAt(new Date().toLocaleTimeString());
    }
    setSaving(false);
    void load();
  }, [draft, title, content, metaTitle, metaDescription]);

  // 自动保存（debounce 1.5s）
  useEffect(() => {
    if (!draft) return;
    const timer = setTimeout(() => {
      if (draft.status === "DRAFT" || draft.status === "REJECTED") {
        void saveDraft();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, content, metaTitle, metaDescription, draft, saveDraft]);

  // SEO 评分
  const seo = useMemo(() => calculateSeoScore({
    title,
    content,
    metaTitle,
    metaDescription,
    keywords: draft?.targetKeywords ?? [],
  }), [title, content, metaTitle, metaDescription, draft]);

  async function submitReview() {
    if (!draft) return;
    if (!confirm("提交审核后将无法直接编辑，确定吗？")) return;
    const res = await fetch(`/api/drafts/${draft.id}/submit-review`, { method: "POST" });
    if (res.ok) void load();
  }

  async function approve() {
    if (!draft) return;
    const res = await fetch(`/api/drafts/${draft.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: reviewComments }),
    });
    if (res.ok) {
      setReviewComments("");
      void load();
    }
  }

  async function reject() {
    if (!draft) return;
    if (!reviewComments.trim()) {
      alert("请填写驳回原因");
      return;
    }
    const res = await fetch(`/api/drafts/${draft.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: reviewComments }),
    });
    if (res.ok) {
      setReviewComments("");
      void load();
    }
  }

  async function restoreVersion(version: number) {
    if (!confirm(`确认回滚到 v${version}？当前内容会变成该版本`)) return;
    const res = await fetch(`/api/drafts/${draft!.id}/restore/${version}`, { method: "POST" });
    if (res.ok) void load();
  }

  if (loading || !draft) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-16" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const isReadOnly = !(draft.status === "DRAFT" || draft.status === "REJECTED");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* 顶部 header */}
      <header className="page-header sticky top-0 bg-background/80 backdrop-blur z-10 -mx-4 px-4 py-3 border-b border-border">
        <div className="page-header-left flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
            <Link href={`/content/drafts?projectId=${projectId}`} className="hover:text-primary">← drafts</Link>
            <span>·</span>
            <span>{draft.sourceType}</span>
            <span>·</span>
            <span>v{revisions[0]?.version ?? 1}</span>
            <span>·</span>
            <span>更新 {new Date(draft.updatedAt).toLocaleString()}</span>
            {lastSavedAt && (
              <>
                <span>·</span>
                <span className="text-success">已保存 {lastSavedAt}</span>
              </>
            )}
            {saving && <span className="text-warning">保存中...</span>}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isReadOnly}
            className="mt-1 w-full bg-transparent text-2xl font-semibold focus:outline-none disabled:opacity-70"
            placeholder="标题"
          />
          <div className="mt-1">
            <span className={`badge text-[10px] ${STATUS_BADGE[draft.status]}`}>
              {STATUS_LABEL[draft.status]}
            </span>
          </div>
        </div>
        <div className="page-header-right">
          {draft.status === "DRAFT" || draft.status === "REJECTED" ? (
            <button onClick={submitReview} className="btn-primary">
              提交审核
            </button>
          ) : null}
        </div>
      </header>

      {draft.reviewNotes && draft.status === "REJECTED" && (
        <div className="card p-4 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-2">
            <span className="text-destructive">⚠</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-destructive">驳回原因</div>
              <div className="mt-1 text-sm text-foreground/90">{draft.reviewNotes}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-4">
        {/* 主编辑区 */}
        <div className="space-y-4 lg:col-span-3">
          <RichEditor
            content={content}
            onChange={setContent}
            editable={!isReadOnly}
            placeholder="开始写你的内容..."
          />

          {/* Meta 设置 */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">SEO Meta</h3>
              <span className="text-[10px] font-mono text-muted-foreground">搜索引擎展示</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium">Meta Title</label>
                <span className={`text-[10px] font-mono ${metaTitle.length > 60 ? "text-destructive" : metaTitle.length >= 20 ? "text-success" : "text-muted-foreground"}`}>
                  {metaTitle.length}/60
                </span>
              </div>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                disabled={isReadOnly}
                className="input-field w-full"
                placeholder="浏览器标签页和搜索结果标题,20-60 字最佳"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium">Meta Description</label>
                <span className={`text-[10px] font-mono ${metaDescription.length > 160 ? "text-destructive" : metaDescription.length >= 80 ? "text-success" : "text-muted-foreground"}`}>
                  {metaDescription.length}/160
                </span>
              </div>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                disabled={isReadOnly}
                rows={3}
                className="input-field w-full"
                placeholder="搜索结果下方的描述,80-160 字最佳"
              />
            </div>
          </div>

          {/* 审核操作 */}
          {draft.status === "PENDING_REVIEW" && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">审核操作(OWNER / ADMIN)</h3>
                <span className="text-[10px] font-mono text-muted-foreground">pending_review</span>
              </div>
              <textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                rows={2}
                placeholder="审核意见(驳回时必填)"
                className="input-field w-full"
              />
              <div className="mt-3 flex gap-2">
                <button onClick={approve} className="px-4 py-2 rounded-md bg-success text-success-foreground text-sm font-medium hover:bg-success/90">
                  ✓ 通过
                </button>
                <button onClick={reject} className="px-4 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90">
                  ✗ 驳回
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 右侧面板:SEO 评分 + 统计 + 关键词 + 版本 */}
        <div className="space-y-4">
          {/* SEO 评分 */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="eyebrow">seo_score</h3>
              <span className={`metric-number-sm ${getScoreColor(seo.score)}`}>{seo.score}/100</span>
            </div>
            <div className="flex items-center justify-center mb-3">
              <ScoreRing score={seo.score} size={100} strokeWidth={6} showLabel={false} />
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-muted-foreground">字数 ({seo.stats.wordCount})</span>
                  <span>{Math.min(100, Math.round(seo.stats.wordCount / 1500 * 100))}%</span>
                </div>
                <ProgressBar value={Math.min(100, Math.round(seo.stats.wordCount / 1500 * 100))} color={seo.stats.wordCount >= 800 ? "success" : seo.stats.wordCount >= 400 ? "warning" : "error"} size="sm" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-muted-foreground">段落 ({seo.stats.paragraphCount})</span>
                  <span>{Math.min(100, seo.stats.paragraphCount * 20)}%</span>
                </div>
                <ProgressBar value={Math.min(100, seo.stats.paragraphCount * 20)} color="info" size="sm" />
              </div>
            </div>
            {seo.tips.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border space-y-1">
                <div className="text-[10px] font-mono text-muted-foreground mb-1">suggestions</div>
                {seo.tips.map((tip, i) => (
                  <div key={i} className="text-[11px] text-warning/90 flex gap-1.5">
                    <span>•</span><span>{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 关键词密度 */}
          {draft.targetKeywords.length > 0 && (
            <div className="card p-5">
              <h3 className="eyebrow mb-3">keyword_density</h3>
              <div className="space-y-2">
                {draft.targetKeywords.map((kw, i) => {
                  const d = seo.stats.keywordDensity[kw] ?? 0;
                  const isGood = d >= 0.5 && d <= 3;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="truncate">{kw}</span>
                        <span className={`font-mono ${d === 0 ? "text-destructive" : isGood ? "text-success" : "text-warning"}`}>
                          {d}%
                        </span>
                      </div>
                      <ProgressBar
                        value={Math.min(100, d * 25)}
                        color={d === 0 ? "error" : isGood ? "success" : "warning"}
                        size="sm"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-[10px] font-mono text-muted-foreground">
                建议密度 0.5% - 3%
              </div>
            </div>
          )}

          {/* 版本历史 */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="eyebrow">version_history</h3>
              <span className="text-[10px] font-mono text-muted-foreground">{revisions.length} versions</span>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {revisions.length === 0 ? (
                <EmptyState icon="∅" description="暂无版本" />
              ) : (
                revisions.map((r) => (
                  <div key={r.id} className="rounded-md border border-border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="font-mono font-medium">v{r.version}</div>
                      {r.version > 1 && (
                        <button
                          onClick={() => void restoreVersion(r.version)}
                          className="text-[10px] text-primary hover:underline"
                        >
                          回滚
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.changeNote && (
                      <div className="mt-1 italic text-muted-foreground">{r.changeNote}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
