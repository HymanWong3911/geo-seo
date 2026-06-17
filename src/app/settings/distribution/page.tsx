"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface DistributionTarget {
  id: string;
  projectId: string;
  platform: "ZHIHU" | "WECHAT_MP" | "FEISHU_DOC" | "NOTION" | "CUSTOM_WEBHOOK";
  name: string;
  active: boolean;
  config: Record<string, unknown>;
}

const PLATFORM_LABEL: Record<string, string> = {
  ZHIHU: "知乎",
  WECHAT_MP: "微信公众号",
  FEISHU_DOC: "飞书文档",
  NOTION: "Notion",
  CUSTOM_WEBHOOK: "自定义 Webhook",
};

const PLATFORM_DESC: Record<string, string> = {
  ZHIHU: "同步到知乎专栏文章 / 想法",
  WECHAT_MP: "推送到微信公众号草稿箱",
  FEISHU_DOC: "创建为飞书云文档",
  NOTION: "同步到 Notion 数据库 / 页面",
  CUSTOM_WEBHOOK: "POST 到任意 HTTPS 端点",
};

export default function DistributionSettingsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectId, setProjectId] = useState("");
  const [targets, setTargets] = useState<DistributionTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects?pageSize=100");
      const json = await res.json();
      setProjects(json.data ?? []);
      if ((json.data ?? []).length > 0) {
        setProjectId(json.data[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/distribution-targets`);
      const json = await res.json();
      setTargets(json.data ?? []);
      setLoading(false);
    })();
  }, [projectId]);

  async function deleteTarget(id: string) {
    if (!confirm("确认删除该分发目标？")) return;
    const res = await fetch(`/api/distribution-targets/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTargets((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            // M10 · DISTRIBUTION SETTINGS
          </div>
          <h1 className="text-3xl font-semibold">
            <span className="text-gradient">跨平台分发配置</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            配置内容发布到 知乎 / 微信 / 飞书 / Notion / Webhook
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary"
          disabled={!projectId}
        >
          + 新增分发目标
        </button>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            PROJECT
          </span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-input bg-background/50 px-3 py-1.5 font-mono text-sm"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <span className="status-dot idle" />
            <span className="ml-2 font-mono text-xs text-muted-foreground">LOADING</span>
          </div>
        ) : targets.length === 0 ? (
          <div className="py-12 text-center font-mono text-xs text-muted-foreground">
            [ NO TARGETS ] — 点击右上角新增
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th>PLATFORM</th>
                  <th>NAME</th>
                  <th className="w-24">ACTIVE</th>
                  <th className="w-32">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {targets.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="font-mono text-sm font-semibold text-foreground">
                        {PLATFORM_LABEL[t.platform] ?? t.platform}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        {PLATFORM_DESC[t.platform] ?? ""}
                      </div>
                    </td>
                    <td className="font-mono text-sm">{t.name}</td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] ${
                          t.active
                            ? "border-success/30 bg-success/10 text-success"
                            : "border-muted-foreground/30 bg-muted text-muted-foreground"
                        }`}
                      >
                        <span className={`status-dot ${t.active ? "online" : "idle"}`} />
                        {t.active ? "ON" : "OFF"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => void deleteTarget(t.id)}
                        className="font-mono text-xs text-destructive hover:underline"
                      >
                        DELETE
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 配置说明 */}
      <div className="card">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          // PLATFORM DOCS
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(PLATFORM_LABEL).map(([k, label]) => (
            <div
              key={k}
              className="rounded-md border border-border bg-card/50 p-3"
            >
              <div className="font-mono text-xs font-semibold text-primary">{label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {PLATFORM_DESC[k]}
              </div>
              <div className="mt-2 font-mono text-[10px] text-muted-foreground/60">
                env · {envKeyFor(k)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && projectId && (
        <AddTargetDialog
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            void (async () => {
              const res = await fetch(`/api/projects/${projectId}/distribution-targets`);
              const json = await res.json();
              setTargets(json.data ?? []);
            })();
          }}
        />
      )}
    </div>
  );
}

function envKeyFor(platform: string): string {
  switch (platform) {
    case "ZHIHU": return "ZHIHU_API_TOKEN";
    case "WECHAT_MP": return "WECHAT_MP_APP_ID + SECRET";
    case "FEISHU_DOC": return "FEISHU_APP_ID + SECRET";
    case "NOTION": return "NOTION_API_KEY";
    case "CUSTOM_WEBHOOK": return "DIST_WEBHOOK_URL (per-target)";
    default: return "—";
  }
}

function AddTargetDialog({
  projectId,
  onClose,
  onAdded,
}: {
  projectId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    platform: "ZHIHU" as DistributionTarget["platform"],
    webhookUrl: "",
    config: {} as Record<string, string>,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const config: Record<string, unknown> =
      form.platform === "CUSTOM_WEBHOOK" && form.webhookUrl
        ? { url: form.webhookUrl, ...form.config }
        : form.config;

    const res = await fetch(`/api/projects/${projectId}/distribution-targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        platform: form.platform,
        config,
        active: true,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "创建失败");
      return;
    }
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-md space-y-4"
        style={{ boxShadow: "0 0 60px hsl(190 95% 55% / 0.15)" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">新增分发目标</h2>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-foreground"
          >
            × CLOSE
          </button>
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            NAME *
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
            placeholder="例如：知乎主账号"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            PLATFORM *
          </label>
          <select
            value={form.platform}
            onChange={(e) =>
              setForm({ ...form, platform: e.target.value as DistributionTarget["platform"] })
            }
            className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {Object.entries(PLATFORM_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {PLATFORM_DESC[form.platform]}
          </div>
        </div>
        {form.platform === "CUSTOM_WEBHOOK" && (
          <div>
            <label className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              WEBHOOK_URL *
            </label>
            <input
              type="url"
              required
              value={form.webhookUrl}
              onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
              className="w-full rounded-md border border-input bg-background/50 px-3 py-2 font-mono text-xs outline-none focus:border-primary"
              placeholder="https://example.com/webhook"
            />
          </div>
        )}
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">
            取消
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "创建中..." : "创建"}
          </button>
        </div>
      </form>
    </div>
  );
}
