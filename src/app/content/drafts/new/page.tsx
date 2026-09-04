"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProjectSelector } from "@/components/forms/ProjectSelector";

type AIMode = "ai" | "manual";
type Tone = "professional" | "casual" | "technical" | "marketing";

const TONE_OPTIONS: { value: Tone; label: string; emoji: string; desc: string }[] = [
  { value: "professional", label: "专业", emoji: "🎩", desc: "正式严谨,适合 B2B / 报告" },
  { value: "casual", label: "轻松", emoji: "☕", desc: "通俗易懂,适合博客" },
  { value: "technical", label: "技术", emoji: "⚙️", desc: "深入细节,适合工程师" },
  { value: "marketing", label: "营销", emoji: "📣", desc: "强调卖点,适合产品" },
];

const LENGTH_PRESETS: Array<{ value: number; label: string; emoji: string }> = [
  { value: 500, label: "短文", emoji: "📝" },
  { value: 1500, label: "中等", emoji: "📄" },
  { value: 3000, label: "长文", emoji: "📚" },
  { value: 6000, label: "深度", emoji: "📖" },
];

export default function NewDraftPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [mode, setMode] = useState<AIMode>("ai");
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [length, setLength] = useState(1500);
  const [tone, setTone] = useState<Tone>("professional");
  const [outline, setOutline] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const keywordList = keywords.split(/[,，]/).map(s => s.trim()).filter(Boolean);

  async function handleAIGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (keywordList.length === 0) {
      setError("请至少输入一个关键词");
      return;
    }
    setError("");
    setGenerating(true);
    const res = await fetch(`/api/projects/${projectId}/drafts/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        targetKeywords: keywordList,
        length,
        tone,
        outline: outline.split("\n").map(s => s.trim()).filter(Boolean),
        saveAsDraft: true,
      }),
    });
    const json = await res.json();
    setGenerating(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "生成失败");
      return;
    }
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
        targetKeywords: keywordList,
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

  if (!projectId) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="page-header">
          <div className="page-header-left">
            <div className="eyebrow">// 新建草稿</div>
            <h1 className="mt-2">新建内容草稿</h1>
          </div>
          <div className="page-header-right"><ProjectSelector /></div>
        </header>
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3 opacity-50">◎</div>
          <div className="text-sm font-medium">请先选择项目</div>
          <div className="text-xs text-muted-foreground mt-1">在右上角选择一个项目后,才能创建草稿</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// CONTENT — New Draft</div>
          <h1 className="mt-2">新建内容草稿</h1>
          <p className="text-sm text-muted-foreground mt-1">AI 智能生成 或 手动编写,选个适合你的方式</p>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          <Link href={`/content/drafts?projectId=${projectId}`} className="btn-ghost">← 返回列表</Link>
        </div>
      </header>

      {/* 模式切换 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          onClick={() => setMode("ai")}
          className={`card p-5 text-left transition-all ${
            mode === "ai" ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20" : "hover:border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="text-3xl">🤖</div>
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                AI 智能生成
                {mode === "ai" && <span className="badge bg-primary/20 text-primary border border-primary/40 text-[10px]">已选</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">输入主题 + 关键词,AI 自动生成结构化长文</div>
              <div className="mt-2 text-[10px] font-mono text-muted-foreground">~ 30s · 自动 SEO Meta</div>
            </div>
          </div>
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`card p-5 text-left transition-all ${
            mode === "manual" ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20" : "hover:border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="text-3xl">✍️</div>
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                手动编写
                {mode === "manual" && <span className="badge bg-primary/20 text-primary border border-primary/40 text-[10px]">已选</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-1">创建空白草稿,自己用编辑器写</div>
              <div className="mt-2 text-[10px] font-mono text-muted-foreground">即时创建 · 实时保存</div>
            </div>
          </div>
        </button>
      </div>

      {error && (
        <div className="card p-3 border-destructive/50 bg-destructive/5 text-sm text-destructive">
          [ error ] {error}
        </div>
      )}

      {mode === "ai" ? (
        <form onSubmit={handleAIGenerate} className="card p-6 space-y-5">
          {/* 主题 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              主题 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="例如：如何选择企业 SEO 工具,2026 年 GEO 趋势解读"
              className="input-field w-full"
            />
            <div className="mt-1 text-[10px] text-muted-foreground font-mono">
              一个清晰的主题 = 更高质量的内容
            </div>
          </div>

          {/* 关键词 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              目标关键词 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="SEO 工具, 企业 SEO, GEO 优化"
              className="input-field w-full"
            />
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono">
              <span className="text-muted-foreground">逗号分隔,建议 3-5 个</span>
              <span className={keywordList.length > 0 ? "text-primary" : "text-muted-foreground"}>
                {keywordList.length} 个
              </span>
            </div>
          </div>

          {/* 语气 */}
          <div>
            <label className="block text-sm font-medium mb-1.5">语气风格</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTone(opt.value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    tone === opt.value
                      ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{opt.emoji}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 字数 preset + slider */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              目标字数 <span className="text-primary font-mono">{length}</span>
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {LENGTH_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setLength(preset.value)}
                  className={`p-2 rounded-lg border text-center text-xs transition-all ${
                    length === preset.value
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card hover:border-border"
                  }`}
                >
                  <div>{preset.emoji}</div>
                  <div className="mt-0.5 font-medium">{preset.label}</div>
                  <div className="text-[10px] text-muted-foreground">{preset.value}</div>
                </button>
              ))}
            </div>
            <input
              type="range"
              min={300}
              max={8000}
              step={100}
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* 可选:大纲 */}
          <details className="border border-border rounded-lg">
            <summary className="cursor-pointer p-3 text-sm font-medium hover:bg-muted/30">
              📑 自定义大纲(可选)
            </summary>
            <div className="p-3 pt-0">
              <textarea
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                placeholder="一行一个小节,例如：&#10;1. 为什么 SEO 很重要&#10;2. 工具的核心功能&#10;3. 实战案例&#10;4. 总结"
                rows={5}
                className="input-field w-full font-mono text-xs"
              />
              <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                {outline.split("\n").filter(s => s.trim()).length} 个小节
              </div>
            </div>
          </details>

          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              type="submit"
              disabled={generating}
              className="btn-primary flex-1"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary-foreground rounded-full animate-pulse" />
                  AI 生成中(可能需要 30 秒)...
                </span>
              ) : (
                "🚀 AI 生成并创建草稿"
              )}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleManualCreate} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">
              标题 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给你的草稿起个标题"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">目标关键词(可选)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="关键词1, 关键词2"
              className="input-field w-full"
            />
            <div className="mt-1 text-[10px] font-mono text-muted-foreground">
              {keywordList.length} 个关键词
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? "创建中..." : "+ 创建空白草稿"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
