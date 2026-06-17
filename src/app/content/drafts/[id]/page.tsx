"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

// TipTap 是 client-only，dynamic import 避免 SSR
const RichEditor = dynamic(
  () => import("@/components/editor/RichEditor").then((m) => m.RichEditor),
  { ssr: false, loading: () => <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">加载编辑器...</div> },
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

const STATUS_BADGE = {
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING_REVIEW: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  PUBLISHED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-muted text-muted-foreground",
};

const STATUS_LABEL = {
  DRAFT: "草稿",
  PENDING_REVIEW: "待审",
  APPROVED: "已审",
  REJECTED: "已驳回",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

export default function DraftEditPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId") ?? "";

  const [draft, setDraft] = useState<Draft | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    await fetch(`/api/drafts/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, metaTitle, metaDescription }),
    });
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
    return <div className="text-muted-foreground">加载中...</div>;
  }

  const isReadOnly = draft.status === "PENDING_REVIEW" || draft.status === "APPROVED" || draft.status === "PUBLISHED" || draft.status === "ARCHIVED";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Link href={`/content/drafts?projectId=${projectId}`} className="text-sm text-muted-foreground hover:underline">
            ← 返回草稿列表
          </Link>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isReadOnly}
            className="mt-1 w-full bg-transparent text-2xl font-semibold focus:outline-none disabled:opacity-70"
            placeholder="标题"
          />
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded px-2 py-0.5 ${STATUS_BADGE[draft.status]}`}>
              {STATUS_LABEL[draft.status]}
            </span>
            <span>{draft.sourceType}</span>
            <span>· v{revisions[0]?.version ?? 1}</span>
            <span>· 更新 {new Date(draft.updatedAt).toLocaleString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {draft.status === "DRAFT" || draft.status === "REJECTED" ? (
            <button
              onClick={submitReview}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              提交审核
            </button>
          ) : null}
          {saving && <span className="text-xs text-muted-foreground self-center">保存中...</span>}
        </div>
      </div>

      {draft.reviewNotes && draft.status === "REJECTED" && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm">
          <strong>驳回原因：</strong>
          {draft.reviewNotes}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <RichEditor
            content={content}
            onChange={setContent}
            editable={!isReadOnly}
            placeholder="开始写你的内容..."
          />

          <div className="space-y-3 rounded-md border border-border bg-background p-4">
            <h3 className="text-sm font-semibold">SEO 设置</h3>
            <div>
              <label className="mb-1 block text-xs font-medium">Meta Title</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Meta Description</label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                disabled={isReadOnly}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* 审核操作（OWNER/ADMIN） */}
          {draft.status === "PENDING_REVIEW" && (
            <div className="rounded-md border border-border bg-background p-4">
              <h3 className="text-sm font-semibold">审核操作（仅 OWNER / ADMIN）</h3>
              <textarea
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                rows={2}
                placeholder="审核意见（驳回时必填）"
                className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <div className="mt-2 flex gap-2">
                <button onClick={approve} className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white">
                  通过
                </button>
                <button onClick={reject} className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white">
                  驳回
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 版本历史 */}
        <div className="rounded-md border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">版本历史</h3>
          <div className="mt-2 space-y-2">
            {revisions.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无版本</p>
            ) : (
              revisions.map((r) => (
                <div key={r.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">v{r.version}</div>
                    {r.version > 1 && (
                      <button
                        onClick={() => void restoreVersion(r.version)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        回滚
                      </button>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                  {r.changeNote && (
                    <div className="mt-1 italic">{r.changeNote}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
