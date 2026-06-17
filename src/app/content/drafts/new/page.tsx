"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NewDraftPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [mode, setMode] = useState<"manual" | "ai">("ai");
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [length, setLength] = useState(1500);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAIGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setGenerating(true);
    const res = await fetch(`/api/projects/${projectId}/drafts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        targetKeywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        length,
      }),
    });
    const json = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "生成失败");
      return;
    }
    // 跳转到编辑器
    router.push(`/content/drafts/${json.data.draftId}?projectId=${projectId}`);
  }

  async function handleManualCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const res = await fetch(`/api/projects/${projectId}/drafts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content: "",
        contentFormat: "html",
        targetKeywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "创建失败");
      return;
    }
    router.push(`/content/drafts/${json.data.id}?projectId=${projectId}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">新建内容草稿</h1>

      <div className="flex gap-1 border-b border-border pb-3">
        <button
          onClick={() => setMode("ai")}
          className={`rounded px-3 py-1 text-sm ${mode === "ai" ? "bg-primary text-primary-foreground" : "border border-border"}`}
        >
          AI 生成
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`rounded px-3 py-1 text-sm ${mode === "manual" ? "bg-primary text-primary-foreground" : "border border-border"}`}
        >
          手动写
        </button>
      </div>

      {mode === "ai" ? (
        <form onSubmit={handleAIGenerate} className="space-y-4 rounded-md border border-border bg-background p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">主题 *</label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：如何选择企业 SEO 工具"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">目标关键词 *</label>
            <input
              type="text"
              required
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="SEO 工具, 企业 SEO, GEO 优化"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">目标字数</label>
            <input
              type="number"
              min={200}
              max={10000}
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={generating}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {generating ? "AI 生成中（可能需要 30 秒）..." : "AI 生成并创建草稿"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleManualCreate} className="space-y-4 rounded-md border border-border bg-background p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">标题 *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">目标关键词（逗号分隔）</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "创建中..." : "创建空草稿"}
          </button>
        </form>
      )}
    </div>
  );
}
