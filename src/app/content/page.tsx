"use client";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ProjectSelector } from "@/components/forms/ProjectSelector";

interface ContentAnalysisResult {
  url?: string;
  title?: string;
  description?: string;
  wordCount: number;
  seoSuggestions: {
    titleSuggestions: string[];
    descriptionSuggestions: string[];
    headingSuggestions: string[];
    keywordGaps: string[];
    internalLinkSuggestions: string[];
    schemaSuggestions: string[];
    improvements: string[];
  };
  geoSuggestions: {
    definitionParagraph: string;
    faqSuggestions: Array<{ question: string; answer: string }>;
    comparisonTable: string;
    citableSnippets: string[];
    brandMentionsToAdd: string[];
    missedOpportunities: string[];
    improvements: string[];
  };
  taskSuggestions: Array<{
    title: string;
    description: string;
    priority: number;
    source: "SEO" | "GEO";
  }>;
  findings: Array<{ code: string; severity: string; title: string; description: string; recommendation: string }>;
}

const SEVERITY_BADGE: Record<string, string> = {
  high: "badge-error",
  medium: "badge-warning",
  low: "badge-info",
};

const SOURCE_BADGE: Record<string, string> = {
  SEO: "badge-info",
  GEO: "badge-gold",
};

const ERROR_MESSAGES: Record<string, string> = {
  select_project_first: "please select a project first",
  keywords_required: "at least one keyword is required",
  url_required: "page URL is required",
  content_too_short: "content must be at least 50 characters",
  analysis_failed: "analysis failed — check input and try again",
};

export default function ContentPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [contentFormat, setContentFormat] = useState<"html" | "text">("text");
  const [keywords, setKeywords] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ContentAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [createdCount, setCreatedCount] = useState(0);
  const { t } = useI18n();

  // 用 ref 读 DOM 实际值，避免 React state 批处理延迟
  const urlRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const keywordsRef = useRef<HTMLInputElement>(null);

  async function analyze() {
    if (!projectId) { setError("select_project_first"); return; }
    // 用 ref 读 DOM 实际值，确保点击时拿到最新输入
    const kwRaw = keywordsRef.current?.value ?? keywords;
    const kwList = kwRaw.split(",").map((s: string) => s.trim()).filter(Boolean);
    if (kwList.length === 0) { setError("keywords_required"); return; }

    setError("");
    setResult(null);
    setAnalyzing(true);
    setCreatedCount(0);

    const body: Record<string, unknown> = { targetKeywords: kwList };
    if (inputType === "url") {
      const urlVal = urlRef.current?.value ?? url;
      if (!urlVal) { setAnalyzing(false); setError("url_required"); return; }
      body.url = urlVal;
    } else {
      const contentVal = contentRef.current?.value ?? content;
      if (!contentVal || contentVal.length < 50) { setAnalyzing(false); setError("content_too_short (min 50 chars)"); return; }
      body.content = contentVal;
      body.contentFormat = contentFormat;
    }

    const res = await fetch(`/api/projects/${projectId}/content/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setAnalyzing(false);
    if (!res.ok) { setError(json?.error?.message ?? "analysis_failed"); return; }
    setResult(json.data);
  }

  async function createTasks(tasks: ContentAnalysisResult["taskSuggestions"]) {
    if (!projectId || !result) return;
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        tasks: tasks.map((t) => ({
          title: t.title,
          description: t.description,
          sourceType: "CONTENT_ANALYSIS",
          sourceId: result?.url ?? undefined,
          url: result?.url,
          priority: t.priority,
        })),
      }),
    });
    const json = await res.json();
    if (res.ok) setCreatedCount(json.data?.count ?? tasks.length);
    else alert(json?.error?.message ?? "create_tasks_failed");
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* page header */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// M08 — Content Optimization</div>
          <h1 className="mt-2">Content Analysis</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
        </div>
      </header>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.content}</p>

      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> select_project_first
        </div>
      ) : (
        <>
          {/* 输入区 */}
          <div className="card p-6 mb-8">
            {/* 输入模式切换 */}
            <div className="tabs mb-6">
              <button
                onClick={() => setInputType("url")}
                className={`tab ${inputType === "url" ? "active" : ""}`}
              >
                url_crawl
              </button>
              <button
                onClick={() => setInputType("text")}
                className={`tab ${inputType === "text" ? "active" : ""}`}
              >
                paste_content
              </button>
            </div>

            <div className="space-y-5">
              {inputType === "url" ? (
                <div>
                  <label className="mono-line block mb-2">page_url *</label>
                  <div className="input-field">
                    <span className="input-field-icon">›</span>
                    <input
                      ref={urlRef}
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://example.com/page"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={contentFormat === "text"}
                        onChange={() => setContentFormat("text")}
                        className="accent-primary"
                      />
                      <span className="mono-line">plain_text</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={contentFormat === "html"}
                        onChange={() => setContentFormat("html")}
                        className="accent-primary"
                      />
                      <span className="mono-line">html</span>
                    </label>
                  </div>
                  <div>
                    <label className="mono-line block mb-2">content *</label>
                    <textarea
                      ref={contentRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                      className="input-full font-mono text-xs"
                      placeholder="Paste your content here..."
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mono-line block mb-2">target_keywords * <span className="text-muted-foreground">(comma separated)</span></label>
                <div className="input-field">
                  <span className="input-field-icon">›</span>
                  <input
                    ref={keywordsRef}
                    type="text"
                    required
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="SEO optimization, GEO tools, search ranking"
                  />
                </div>
              </div>

              {error && (
                <div className="border border-destructive/50 bg-destructive/5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-destructive">
                  [ error ] {ERROR_MESSAGES[error] ?? error}
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={analyze}
                  disabled={analyzing || !keywords.trim()}
                  className="btn-primary"
                >
                  {analyzing ? (
                    <>
                      <span className="cursor-blink">▌</span> analyzing...
                    </>
                  ) : (
                    "→ analyze"
                  )}
                </button>
                {result && (
                  <span className="mono-line text-xs">
                    {result.wordCount.toLocaleString()} words · {result.findings.length} findings
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 结果区 */}
          {result && (
            <div className="space-y-6">
              {/* 页面信息 */}
              {result.title && (
                <div className="card p-6">
                  <div className="eyebrow mb-3">page_info</div>
                  <div className="text-lg">{result.title}</div>
                  {result.description && (
                    <div className="mono-line mt-1 text-xs">{result.description}</div>
                  )}
                  <div className="mt-3 flex items-center gap-4 mono-line text-[10px]">
                    <span>{result.wordCount.toLocaleString()} words</span>
                    {result.url && (
                      <a href={result.url} target="_blank" rel="noreferrer" className="text-info hover:text-primary">
                        {result.url}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* 一键建任务 */}
              {result.taskSuggestions.length > 0 && (
                <div className="card p-6 flex items-center justify-between">
                  <div>
                    <div className="eyebrow">suggested_tasks</div>
                    <div className="mt-1">{result.taskSuggestions.length} tasks generated from analysis</div>
                  </div>
                  <button
                    onClick={() => void createTasks(result.taskSuggestions)}
                    className="btn-gold"
                  >
                    + create_tasks ({result.taskSuggestions.length})
                    {createdCount > 0 && ` · ${createdCount} done`}
                  </button>
                </div>
              )}

              {/* SEO 建议 */}
              {result.seoSuggestions && (
                <SuggestionCard title="SEO Suggestions" icon="◎">
                  <div className="grid gap-6">
                    <Section title="Title Suggestions" items={result.seoSuggestions.titleSuggestions} />
                    <Section title="Meta Description" items={result.seoSuggestions.descriptionSuggestions} />
                    <Section title="Heading Structure" items={result.seoSuggestions.headingSuggestions} />
                    <Section title="Keyword Gaps" items={result.seoSuggestions.keywordGaps} />
                    <Section title="Internal Links" items={result.seoSuggestions.internalLinkSuggestions} />
                    <Section title="Schema Markup" items={result.seoSuggestions.schemaSuggestions} />
                    <Section title="General Improvements" items={result.seoSuggestions.improvements} />
                  </div>
                </SuggestionCard>
              )}

              {/* GEO 建议 */}
              {result.geoSuggestions && (
                <SuggestionCard title="GEO Suggestions" icon="◉">
                  <div className="grid gap-6">
                    {result.geoSuggestions.definitionParagraph && (
                      <div>
                        <div className="mono-line text-xs mb-2">// recommended definition paragraph</div>
                        <div className="card card-gold p-3 font-mono text-xs leading-relaxed">
                          {result.geoSuggestions.definitionParagraph}
                        </div>
                      </div>
                    )}
                    {result.geoSuggestions.faqSuggestions.length > 0 && (
                      <div>
                        <div className="mono-line text-xs mb-2">// recommended FAQ</div>
                        <div className="space-y-2">
                          {result.geoSuggestions.faqSuggestions.map((f, i) => (
                            <div key={i} className="card p-3">
                              <div className="font-medium text-sm">Q: {f.question}</div>
                              <div className="mt-1 text-muted-foreground text-sm">A: {f.answer}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {result.geoSuggestions.citableSnippets.length > 0 && (
                      <Section title="AI-Citable Snippets" items={result.geoSuggestions.citableSnippets} />
                    )}
                    <Section title="Brand Facts to Add" items={result.geoSuggestions.brandMentionsToAdd} />
                    <Section title="GEO Improvements" items={result.geoSuggestions.improvements} />
                  </div>
                </SuggestionCard>
              )}

              {/* SEO Findings */}
              {result.findings.length > 0 && (
                <SuggestionCard title={`SEO Findings (${result.findings.length})`} icon="!">
                  <div className="space-y-2">
                    {result.findings.map((f, i) => (
                      <div key={i} className={`card p-4 ${f.severity === "high" ? "card-accent" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`badge ${SEVERITY_BADGE[f.severity] ?? "badge-muted"}`}>
                              <span className={`status-dot ${f.severity === "high" ? "error" : f.severity === "medium" ? "warning" : "info"}`} />
                              {f.severity}
                            </span>
                            <span className="font-medium text-sm">{f.title}</span>
                          </div>
                          <code className="mono-line text-[10px] text-muted-foreground shrink-0">{f.code}</code>
                        </div>
                        {f.recommendation && (
                          <div className="mt-2 text-sm text-muted-foreground">{f.recommendation}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </SuggestionCard>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
        <span className="font-mono text-primary text-lg">{icon}</span>
        <h2 className="text-lg">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="mono-line text-xs mb-2">// {title}</div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="text-primary mt-0.5">›</span>
            <span className="text-muted-foreground">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
