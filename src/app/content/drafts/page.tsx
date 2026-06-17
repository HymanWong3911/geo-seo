"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ProjectSelector } from "@/components/forms/ProjectSelector";

interface Draft {
  id: string;
  title: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED" | "ARCHIVED";
  sourceType: string;
  excerpt: string | null;
  authorId: string;
  updatedAt: string;
  _count: { revisions: number };
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

export default function DraftsListPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    if (!projectId) {
      setDrafts([]);
      return;
    }
    setLoading(true);
    const url = new URL(`/api/projects/${projectId}/drafts`, window.location.origin);
    if (statusFilter) url.searchParams.set("status", statusFilter);
    const res = await fetch(url);
    const json = await res.json();
    setDrafts(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">内容草稿</h1>
          <ProjectSelector />
        </div>
        {projectId && (
          <Link
            href={`/content/drafts/new?projectId=${projectId}`}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            + 新建草稿
          </Link>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.drafts}</p>

      <div className="flex gap-1">
        <button
          onClick={() => setStatusFilter("")}
          className={`rounded px-3 py-1 text-sm ${!statusFilter ? "bg-primary text-primary-foreground" : "border border-border"}`}
        >
          全部
        </button>
        {(["DRAFT", "PENDING_REVIEW", "APPROVED", "PUBLISHED", "REJECTED"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded px-3 py-1 text-sm ${statusFilter === s ? "bg-primary text-primary-foreground" : "border border-border"}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {!projectId ? (
        <p className="text-muted-foreground">请先选择项目</p>
      ) : (
        <div className="space-y-2">
          {loading ? (
            <p className="text-muted-foreground">加载中...</p>
          ) : drafts.length === 0 ? (
            <p className="text-muted-foreground">暂无草稿</p>
          ) : (
            drafts.map((d) => (
              <Link
                key={d.id}
                href={`/content/drafts/${d.id}?projectId=${projectId}`}
                className="block rounded-md border border-border bg-background p-4 hover:bg-muted"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="font-medium">{d.title}</div>
                    {d.excerpt && (
                      <div className="mt-1 text-sm text-muted-foreground line-clamp-1">{d.excerpt}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[d.status]}`}>
                      {STATUS_LABEL[d.status]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.sourceType} · v{d._count.revisions}
                    </span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  更新 {new Date(d.updatedAt).toLocaleString()}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
