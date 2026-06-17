"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface ProjectPage {
  id: string;
  url: string;
  title: string | null;
  wordCount: number | null;
  lastCrawledAt: string | null;
  _count: { audits: number };
  audits: Array<{ id: string; score: number; createdAt: string }>;
}

export default function ProjectPagesPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [pages, setPages] = useState<ProjectPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const url = new URL(`/api/projects/${projectId}/pages`, window.location.origin);
    if (search) url.searchParams.set("search", search);
    const res = await fetch(url);
    const json = await res.json();
    setPages(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
            ← 返回项目
          </Link>
          <h1 className="text-2xl font-semibold">已抓取页面</h1>
        </div>
        <Link
          href={`/audits`}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          + 新建诊断
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="search"
          placeholder="按 URL / 标题搜索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => void load()}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          搜索
        </button>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">页面</th>
              <th className="px-3 py-2 text-left font-medium">字数</th>
              <th className="px-3 py-2 text-left font-medium">最近分数</th>
              <th className="px-3 py-2 text-left font-medium">诊断数</th>
              <th className="px-3 py-2 text-left font-medium">最后抓取</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : pages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  暂无页面，先在「页面诊断」中新建一次诊断
                </td>
              </tr>
            ) : (
              pages.map((p) => {
                const latest = p.audits[0];
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{p.title ?? "(无标题)"}</div>
                      <div className="text-xs text-muted-foreground">{p.url}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {p.wordCount ?? "-"}
                    </td>
                    <td className="px-3 py-2">
                      {latest ? (
                        latest.id ? (
                          <Link
                            href={`/audits/${latest.id}`}
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              latest.score >= 80
                                ? "bg-green-100 text-green-700"
                                : latest.score >= 60
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                            }`}
                          >
                            {latest.score}
                          </Link>
                        ) : (
                          <span>{latest.score}</span>
                        )
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{p._count.audits}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.lastCrawledAt ? new Date(p.lastCrawledAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
