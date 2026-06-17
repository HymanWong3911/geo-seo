"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";

export default function SearchSubmissionPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [pingUrl, setPingUrl] = useState("");

  async function submitSitemap() {
    if (!projectId) return;
    setSubmitting(true);
    setResult(null);
    const res = await fetch(`/api/projects/${projectId}/search-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "sitemap", engine: "both" }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (res.ok) {
      const lines = (json.data?.results ?? []).map((r: { success: boolean; message: string }) => `  ${r.success ? "✓" : "✗"} ${r.message}`);
      setResult(`Sitemap 提交结果：\n${lines.join("\n")}`);
    } else {
      setResult(`错误：${json?.error?.message}`);
    }
  }

  async function submitPing() {
    if (!projectId) return;
    if (!pingUrl) {
      setResult("请输入 URL");
      return;
    }
    setSubmitting(true);
    setResult(null);
    const res = await fetch(`/api/projects/${projectId}/search-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ping", url: pingUrl, engine: "all" }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (res.ok) {
      const lines = (json.data?.results ?? []).map((r: { success: boolean; message: string }) => `  ${r.success ? "✓" : "✗"} ${r.message}`);
      setResult(`URL ping 结果：\n${lines.join("\n")}`);
    } else {
      setResult(`错误：${json?.error?.message}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold">搜索引擎提交</h1>
        <ProjectSelector />
      </div>

      {!projectId ? (
        <p className="text-muted-foreground">请先选择项目</p>
      ) : (
        <>
          <div className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">提交 Sitemap</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              推送给 Google / 百度（使用项目配置的 sitemapUrl）
            </p>
            <button
              onClick={submitSitemap}
              disabled={submitting}
              className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "提交中..." : "提交 Sitemap"}
            </button>
          </div>

          <div className="rounded-md border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">URL Ping</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              实时告知搜索引擎某个 URL 有新内容
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="url"
                value={pingUrl}
                onChange={(e) => setPingUrl(e.target.value)}
                placeholder="https://example.com/new-page"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={submitPing}
                disabled={submitting}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Ping
              </button>
            </div>
          </div>

          {result && (
            <pre className="rounded-md border border-border bg-muted p-3 text-xs whitespace-pre-wrap">
              {result}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
