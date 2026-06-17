"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Brand {
  id: string;
  name: string;
  aliases: string[];
  products: string[];
  description: string | null;
  isPrimary: boolean;
}

interface Competitor {
  id: string;
  name: string;
  domain: string | null;
  aliases: string[];
  notes: string | null;
}

export default function BrandsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [brands, setBrands] = useState<Brand[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [showAddComp, setShowAddComp] = useState(false);

  async function load() {
    setLoading(true);
    const [b, c] = await Promise.all([
      fetch(`/api/projects/${projectId}/brands`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/competitors`).then((r) => r.json()),
    ]);
    setBrands(b.data ?? []);
    setCompetitors(c.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function deleteBrand(b: Brand) {
    if (!confirm(`确认删除品牌 "${b.name}"？`)) return;
    const res = await fetch(`/api/brands/${b.id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  async function deleteComp(c: Competitor) {
    if (!confirm(`确认删除竞品 "${c.name}"？`)) return;
    const res = await fetch(`/api/competitors/${c.id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
          ← 返回项目
        </Link>
        <h1 className="text-2xl font-semibold">品牌与竞品</h1>
      </div>

      {/* 品牌 */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">主品牌</h2>
          <button
            onClick={() => setShowAddBrand(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            + 添加品牌
          </button>
        </div>
        <div className="mt-2 rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">品牌名</th>
                <th className="px-3 py-2 text-left font-medium">别名</th>
                <th className="px-3 py-2 text-left font-medium">产品</th>
                <th className="px-3 py-2 text-left font-medium">主品牌</th>
                <th className="px-3 py-2 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">加载中...</td></tr>
              ) : brands.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">暂无品牌</td></tr>
              ) : (
                brands.map((b) => (
                  <tr key={b.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{b.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {b.aliases.join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {b.products.join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2">
                      {b.isPrimary ? (
                        <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                          主品牌
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => void deleteBrand(b)} className="text-xs text-red-600 hover:underline">
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 竞品 */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">竞品</h2>
          <button
            onClick={() => setShowAddComp(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            + 添加竞品
          </button>
        </div>
        <div className="mt-2 rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">竞品名</th>
                <th className="px-3 py-2 text-left font-medium">域名</th>
                <th className="px-3 py-2 text-left font-medium">别名</th>
                <th className="px-3 py-2 text-left font-medium">备注</th>
                <th className="px-3 py-2 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">加载中...</td></tr>
              ) : competitors.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">暂无竞品</td></tr>
              ) : (
                competitors.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.domain ?? "-"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.aliases.join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.notes ?? "-"}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => void deleteComp(c)} className="text-xs text-red-600 hover:underline">
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddBrand && (
        <AddBrandDialog
          projectId={projectId}
          onClose={() => setShowAddBrand(false)}
          onAdded={() => {
            setShowAddBrand(false);
            void load();
          }}
        />
      )}
      {showAddComp && (
        <AddCompetitorDialog
          projectId={projectId}
          onClose={() => setShowAddComp(false)}
          onAdded={() => {
            setShowAddComp(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function AddBrandDialog({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({
    name: "",
    aliases: "",
    products: "",
    description: "",
    isPrimary: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const body = {
      name: form.name,
      aliases: form.aliases.split(",").map((s) => s.trim()).filter(Boolean),
      products: form.products.split(",").map((s) => s.trim()).filter(Boolean),
      description: form.description || null,
      isPrimary: form.isPrimary,
    };
    const res = await fetch(`/api/projects/${projectId}/brands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
        <h2 className="text-lg font-semibold">添加品牌</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">品牌名 *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">别名（逗号分隔）</label>
          <input
            type="text"
            value={form.aliases}
            onChange={(e) => setForm({ ...form, aliases: e.target.value })}
            placeholder="Acme Inc, Acme 公司"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">产品（逗号分隔）</label>
          <input
            type="text"
            value={form.products}
            onChange={(e) => setForm({ ...form, products: e.target.value })}
            placeholder="Acme SEO, Acme GEO"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">描述</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
          />
          设为主品牌（仅 1 个）
        </label>
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

function AddCompetitorDialog({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ name: "", domain: "", aliases: "", notes: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const body = {
      name: form.name,
      domain: form.domain || null,
      aliases: form.aliases.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes || null,
    };
    const res = await fetch(`/api/projects/${projectId}/competitors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
        <h2 className="text-lg font-semibold">添加竞品</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">竞品名 *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">域名</label>
          <input
            type="text"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
            placeholder="competitor.com"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">别名（逗号分隔）</label>
          <input
            type="text"
            value={form.aliases}
            onChange={(e) => setForm({ ...form, aliases: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">备注</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
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
