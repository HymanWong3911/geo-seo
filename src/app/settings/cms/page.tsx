"use client";

import { useState, useEffect } from "react";

interface CmsIntegration {
  id: string;
  projectId: string;
  name: string;
  type: string;
  baseUrl: string;
  active: boolean;
  createdAt: string;
  project: { id: string; name: string };
}

export default function CmsIntegrationsPage() {
  const [integrations, setIntegrations] = useState<CmsIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/cms-integrations");
    const json = await res.json();
    setIntegrations(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function testConnection(id: string) {
    const res = await fetch(`/api/cms-integrations/${id}/test`, { method: "POST" });
    const json = await res.json();
    if (res.ok) {
      alert(`✓ 连接成功！适配器：${json.data.adapter}，分类数：${json.data.categoriesCount}`);
    } else {
      alert(`✗ 连接失败：${json?.error?.message ?? "未知错误"}`);
    }
  }

  async function deleteIntegration(c: CmsIntegration) {
    if (!confirm(`确认删除 CMS 集成 "${c.name}"？`)) return;
    const res = await fetch(`/api/cms-integrations/${c.id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">CMS 集成</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          + 添加集成
        </button>
      </div>

      <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm">
        <strong>当前适配器：</strong> {process.env.NEXT_PUBLIC_CMS_ADAPTER ?? "mock（自动）"}
        <br />
        <span className="text-xs text-muted-foreground">
          自建网站 CMS 端点（21.7 节 7 个端点）实现后，移除 env <code>CMS_MOCK=true</code> 并配置 <code>CMS_BASE_URL</code> + <code>CMS_API_KEY</code> 即可切到真实 CMS。
        </span>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">名称</th>
              <th className="px-3 py-2 text-left font-medium">项目</th>
              <th className="px-3 py-2 text-left font-medium">类型</th>
              <th className="px-3 py-2 text-left font-medium">Base URL</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">加载中...</td></tr>
            ) : integrations.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">暂无 CMS 集成</td></tr>
            ) : (
              integrations.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-xs">{c.project.name}</td>
                  <td className="px-3 py-2 text-xs">{c.type}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{c.baseUrl}</td>
                  <td className="px-3 py-2 text-xs">
                    {c.active ? <span className="text-green-600">启用</span> : <span className="text-muted-foreground">停用</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => void testConnection(c.id)} className="text-xs text-blue-600 hover:underline">
                        测试
                      </button>
                      <button onClick={() => void deleteIntegration(c)} className="text-xs text-red-600 hover:underline">
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && <AddIntegrationDialog onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); void load(); }} />}
    </div>
  );
}

function AddIntegrationDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    projectId: "",
    name: "",
    type: "self-hosted",
    baseUrl: "",
    apiKey: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/projects?pageSize=100");
      const json = await res.json();
      setProjects(json.data ?? []);
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/cms-integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">添加 CMS 集成</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">关联项目 *</label>
          <select
            required
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">-- 选择项目 --</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">名称 *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例如：公司主站 CMS"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Base URL *</label>
          <input
            type="url"
            required
            value={form.baseUrl}
            onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://cms.example.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">API Key *</label>
          <input
            type="text"
            required
            minLength={8}
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder="32 字节随机字符串（存哈希，不存明文）"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">取消</button>
          <button type="submit" disabled={loading} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {loading ? "创建中..." : "创建"}
          </button>
        </div>
      </form>
    </div>
  );
}
