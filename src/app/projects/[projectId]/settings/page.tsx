"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

const GEO_CHANNELS = [
  { value: "perplexity", label: "Perplexity（英文）" },
  { value: "kimi", label: "Kimi（中文）" },
  { value: "doubao", label: "豆包（中文）" },
  { value: "llm_simulation", label: "LLM 模拟（fallback）" },
];

interface Project {
  id: string;
  name: string;
  domain: string;
  primaryBrand: string;
  language: string;
  region: string;
  sitemapUrl: string | null;
  robotsUrl: string | null;
  status: "ACTIVE" | "ARCHIVED";
  geoDailyEnabled: boolean;
  geoChannels: string[];
}

export default function ProjectSettingsPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const projectId = params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");

  // 表单状态
  const [form, setForm] = useState({
    name: "",
    domain: "",
    primaryBrand: "",
    language: "zh-CN",
    region: "CN",
    sitemapUrl: "",
    robotsUrl: "",
    geoDailyEnabled: true,
    geoChannels: ["perplexity", "kimi", "doubao"] as string[],
  });

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/projects/${projectId}`);
      const json = await res.json();
      if (json.data) {
        setProject(json.data);
        setForm({
          name: json.data.name,
          domain: json.data.domain,
          primaryBrand: json.data.primaryBrand,
          language: json.data.language,
          region: json.data.region,
          sitemapUrl: json.data.sitemapUrl ?? "",
          robotsUrl: json.data.robotsUrl ?? "",
          geoDailyEnabled: json.data.geoDailyEnabled,
          geoChannels: json.data.geoChannels,
        });
      }
      setLoading(false);
    })();
  }, [projectId]);

  function toggleChannel(ch: string) {
    setForm((prev) =>
      prev.geoChannels.includes(ch)
        ? { ...prev, geoChannels: prev.geoChannels.filter((c) => c !== ch) }
        : { ...prev, geoChannels: [...prev.geoChannels, ch] },
    );
  }

  async function save() {
    setError("");
    setSuccess("");
    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "保存失败");
      return;
    }
    setSuccess("✓ 已保存");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function archive() {
    if (!confirm("确定归档该项目？归档后不会出现在主列表，可在「显示已归档」中查看")) return;
    const res = await fetch(`/api/projects/${projectId}/archive`, { method: "POST" });
    if (res.ok) {
      router.push("/projects");
      router.refresh();
    }
  }

  async function unarchive() {
    const res = await fetch(`/api/projects/${projectId}/unarchive`, { method: "POST" });
    if (res.ok) {
      router.push("/projects");
      router.refresh();
    }
  }

  async function hardDelete() {
    if (session?.user?.role !== "ADMIN") {
      setError("只有 ADMIN 可以硬删除项目");
      return;
    }
    if (confirmDelete !== project?.name) {
      setError(`要确认删除请输入项目名称：${project?.name}`);
      return;
    }
    if (!confirm(`确认硬删除项目「${project?.name}」？所有数据将级联删除（关键词、品牌、GEO、任务、草稿、成员等），无法恢复！`)) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/projects");
      router.refresh();
    } else {
      const json = await res.json();
      setError(json?.error?.message ?? "删除失败");
    }
  }

  if (loading) {
    return (
      <div className="card py-12 text-center">
        <span className="status-dot idle" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card py-12 text-center text-sm text-destructive">
        项目不存在或无权限
        <div className="mt-3">
          <Link href="/projects" className="text-primary hover:underline">
            ← 返回项目列表
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // M01 · PROJECT SETTINGS
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">{project.name}</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            <Link href={`/projects/${projectId}`} className="hover:text-foreground">
              ← 返回总览
            </Link>
          </p>
        </div>
      </div>

      {/* 基本信息 */}
      <div className="card space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // BASIC
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
              placeholder="example.com"
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
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="zh-CN">简体中文</option>
                <option value="en-US">English (US)</option>
                <option value="ja-JP">日本語</option>
                <option value="ko-KR">한국어</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                地区
              </label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Sitemap URL
            </label>
            <input
              value={form.sitemapUrl}
              onChange={(e) => setForm({ ...form, sitemapUrl: e.target.value })}
              className="w-full rounded-md border border-input bg-background/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              placeholder="https://example.com/sitemap.xml"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Robots.txt URL
            </label>
            <input
              value={form.robotsUrl}
              onChange={(e) => setForm({ ...form, robotsUrl: e.target.value })}
              className="w-full rounded-md border border-input bg-background/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              placeholder="https://example.com/robots.txt"
            />
          </div>
        </div>
      </div>

      {/* GEO 监测配置 */}
      <div className="card space-y-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // GEO MONITORING
        </div>
        <label className="flex items-center gap-3 rounded-md border border-border bg-background/50 p-3">
          <input
            type="checkbox"
            checked={form.geoDailyEnabled}
            onChange={(e) => setForm({ ...form, geoDailyEnabled: e.target.checked })}
            className="h-4 w-4"
          />
          <div>
            <div className="font-mono text-sm font-semibold text-foreground">
              启用每日 GEO 监测
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              调度器每天 00:30 自动入队所有启用项目
            </div>
          </div>
        </label>

        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            GEO 监测渠道
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {GEO_CHANNELS.map((ch) => (
              <label
                key={ch.value}
                className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={form.geoChannels.includes(ch.value)}
                  onChange={() => toggleChannel(ch.value)}
                  className="h-4 w-4"
                />
                <span className="text-sm">{ch.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            无 key 的渠道会自动跳过。LLM 模拟总是可用（fallback）。
          </p>
        </div>
      </div>

      {/* 错误/成功提示 */}
      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 font-mono text-xs text-success">
          {success}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>
        <div className="flex gap-2">
          {project.status === "ACTIVE" ? (
            <button onClick={archive} className="btn-ghost text-warning">
              归档项目
            </button>
          ) : (
            <button onClick={unarchive} className="btn-ghost text-success">
              取消归档
            </button>
          )}
        </div>
      </div>

      {/* 危险操作：硬删除（仅 ADMIN） */}
      {isAdmin && (
        <div className="card border-destructive/30 bg-destructive/5">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-destructive">
            // DANGER ZONE
          </div>
          <div className="text-sm text-foreground">
            硬删除项目：级联删除所有关联数据（关键词、品牌、GEO、任务、草稿、成员、审计、报表），不可恢复。
          </div>
          <div className="mt-3 flex items-end gap-3">
            <div className="flex-1">
              <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                输入项目名称 "{project.name}" 以确认
              </label>
              <input
                value={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.value)}
                className="w-full rounded-md border border-destructive/30 bg-background px-3 py-2 text-sm outline-none focus:border-destructive"
              />
            </div>
            <button
              onClick={hardDelete}
              disabled={confirmDelete !== project.name}
              className="rounded-md border border-destructive bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-all hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              永久删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}