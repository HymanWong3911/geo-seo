"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ReviewItem {
  id: string;
  title: string;
  sourceType: string;
  excerpt: string | null;
  authorId: string;
  submittedAt: string;
  project: { id: string; name: string };
}

export default function ReviewQueuePage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 简化：列出所有 PENDING_REVIEW 草稿（按项目过滤；MEMBER 看自己有权限的项目）
  async function load() {
    setLoading(true);
    // 先列出有权限的项目
    const projectsRes = await fetch("/api/projects?pageSize=100");
    const projectsJson = await projectsRes.json();
    const projects = projectsJson.data ?? [];

    // 收集所有 PENDING_REVIEW
    const all: ReviewItem[] = [];
    for (const p of projects) {
      const res = await fetch(`/api/projects/${p.id}/drafts?status=PENDING_REVIEW`);
      const json = await res.json();
      if (json.data) {
        for (const d of json.data) {
          all.push({ ...d, project: { id: p.id, name: p.name } });
        }
      }
    }
    all.sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
    setItems(all);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">审核队列</h1>

      {loading ? (
        <p className="text-muted-foreground">加载中...</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">暂无待审核草稿</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <Link
              key={d.id}
              href={`/content/drafts/${d.id}?projectId=${d.project.id}`}
              className="block rounded-md border border-yellow-300 bg-yellow-50 p-4 hover:bg-yellow-100"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{d.title}</div>
                  {d.excerpt && <div className="mt-1 text-sm text-muted-foreground line-clamp-1">{d.excerpt}</div>}
                  <div className="mt-2 text-xs text-muted-foreground">
                    {d.project.name} · {d.sourceType} · 提交 {new Date(d.submittedAt).toLocaleString()}
                  </div>
                </div>
                <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">待审</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
