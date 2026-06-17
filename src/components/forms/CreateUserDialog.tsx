"use client";

import { useState } from "react";

export function CreateUserDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json?.error?.message ?? "创建失败");
      return;
    }
    setTempPassword(json.data.tempPassword);
  }

  if (tempPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg">
          <h2 className="text-lg font-semibold">用户已创建</h2>
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="mb-2">临时密码（仅显示一次，请复制给用户）：</p>
            <code className="block break-all rounded bg-background p-2 font-mono">
              {tempPassword}
            </code>
          </div>
          <p className="text-xs text-muted-foreground">
            用户首次登录将被要求修改密码。
          </p>
          <button
            onClick={onCreated}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
          >
            完成
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">新建用户</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">邮箱 *</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">姓名 *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">角色</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "ADMIN" | "MEMBER")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="MEMBER">MEMBER（普通成员）</option>
            <option value="ADMIN">ADMIN（管理员）</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "创建中..." : "创建"}
          </button>
        </div>
      </form>
    </div>
  );
}
