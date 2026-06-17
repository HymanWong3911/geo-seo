"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Project {
  id: string;
  name: string;
  domain: string;
  primaryBrand: string;
  language: string;
  region: string;
  status: string;
}

const COPY_OPTIONS = [
  { key: "copyKeywords", label: "关键词", icon: "K" },
  { key: "copyQuestions", label: "GEO 问题", icon: "Q" },
  { key: "copyBrands", label: "品牌", icon: "B" },
  { key: "copyCompetitors", label: "竞品", icon: "C" },
  { key: "copyCmsIntegrations", label: "CMS 集成", icon: "M" },
  { key: "copyDistributionTargets", label: "分发目标", icon: "D" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"blank" | "clone">("blank");
  const [projects, setProjects] = useState<Project[]>([]);

  const [form, setForm] = useState({
    name: "",
    domain: "",
    primaryBrand: "",
    language: "zh-CN",
    region: "CN",
  });

  const [cloneForm, setCloneForm] = useState({
    sourceId: "",
    newName: "",
    newDomain: "",
  });
  const [copyOpts, setCopyOpts] = useState<Record<string, boolean>>({
    copyKeywords: false,
    copyQuestions: false,
    copyBrands: false,
    copyCompetitors: false,
    copyCmsIntegrations: false,
    copyDistributionTargets: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects?pageSize=100");
      const json = await res.json();
      setProjects((json.data ?? []).filter((p: Project) => p.status === "ACTIVE"));
    })();
  }, []);

  function toggleCopy(key: string) {
    setCopyOpts((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function createBlank() {
    setError("");
    setSubmitting(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "创建失败");
      return;
    }
    router.push(`/projects/${json.data.id}/settings`);
  }

  async function cloneProject() {
    setError("");
    if (!cloneForm.sourceId || !cloneForm.newName || !cloneForm.newDomain) {
      setError("请填写完整：源项目、新名称、新域名");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/projects/clone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...cloneForm,
        ...copyOpts,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "克隆失败");
      return;
    }
    router.push(`/projects/${json.data.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // M01 · NEW PROJECT
        </div>
        <h1 className="text-3xl font-semibold">
          <span className="text-gradient">新建项目</span>
        </h1>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("blank")}
          className={`flex-1 rounded-md border p-4 text-left transition-all ${
            mode === "blank"
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:border-primary/50"
          }`}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            MODE_01
          </div>
          <div className="mt-1 font-semibold">空白项目</div>
          <div className="mt-1 text-xs text-muted-foreground">
            从零开始：手动填名称、域名、主品牌
          </div>
        </button>
        <button
          onClick={() => setMode("clone")}
          className={`flex-1 rounded-md border p-4 text-left transition-all ${
            mode === "clone"
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:border-primary/50"
          }`}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            MODE_02
          </div>
          <div className="mt-1 font-semibold">从现有项目克隆</div>
          <div className="mt-1 text-xs text-muted-foreground">
            复用源项目的资源（关键词/问题/品牌/竞品等）
          </div>
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      {mode === "blank" ? (
        <div className="card space-y-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // BASIC INFO
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                项目名称 *
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="我的新项目"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                主域名 *
              </label>
              <input
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 font-mono text-sm outline-none focus:border-primary"
                placeholder="newsite.com"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                主品牌 *
              </label>
              <input
                value={form.primaryBrand}
                onChange={(e) => setForm({ ...form, primaryBrand: e.target.value })}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="BrandName"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  语言
                </label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
                >
                  <option value="zh-CN">简体中文</option>
                  <option value="en-US">English (US)</option>
                  <option value="ja-JP">日本語</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  地区
                </label>
                <select
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
                >
                  <option value="CN">中国大陆</option>
                  <option value="US">美国</option>
                  <option value="JP">日本</option>
                  <option value="HK">香港</option>
                  <option value="GLOBAL">全球</option>
                </select>
              </div>
            </div>
          </div>
          <button
            onClick={createBlank}
            disabled={submitting || !form.name || !form.domain || !form.primaryBrand}
            className="btn-primary"
          >
            {submitting ? "创建中..." : "创建项目"}
          </button>
        </div>
      ) : (
        <div className="card space-y-4">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              源项目 *
            </label>
            <select
              value={cloneForm.sourceId}
              onChange={(e) => setCloneForm({ ...cloneForm, sourceId: e.target.value })}
              className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
            >
              <option value="">-- 选择 --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.domain})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                新项目名称 *
              </label>
              <input
                value={cloneForm.newName}
                onChange={(e) => setCloneForm({ ...cloneForm, newName: e.target.value })}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                新域名 *
              </label>
              <input
                value={cloneForm.newDomain}
                onChange={(e) => setCloneForm({ ...cloneForm, newDomain: e.target.value })}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 font-mono text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              复制哪些资源
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {COPY_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                    copyOpts[opt.key] ? "border-primary bg-primary/10" : "border-border bg-background/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={copyOpts[opt.key]}
                    onChange={() => toggleCopy(opt.key)}
                    className="h-4 w-4"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground">
                    [{opt.icon}]
                  </span>
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={cloneProject}
            disabled={
              submitting ||
              !cloneForm.sourceId ||
              !cloneForm.newName ||
              !cloneForm.newDomain
            }
            className="btn-primary"
          >
            {submitting ? "克隆中..." : "克隆项目"}
          </button>
        </div>
      )}
    </div>
  );
}