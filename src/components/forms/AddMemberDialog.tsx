"use client";

import { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
}

export function AddMemberDialog({
  projectId,
  existingMemberIds,
  onClose,
  onAdded,
}: {
  projectId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"OWNER" | "EDITOR" | "VIEWER">("VIEWER");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 列出所有未加入该项目的用户
    void (async () => {
      const res = await fetch("/api/users?pageSize=100");
      const json = await res.json();
      const available = (json.data ?? []).filter(
        (u: User) => !existingMemberIds.includes(u.id),
      );
      setUsers(available);
    })();
  }, [existingMemberIds]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json?.error?.message ?? "添加失败");
      return;
    }
    onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">添加项目成员</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">用户 *</label>
          <select
            required
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">-- 请选择 --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
                {u.name ? ` (${u.name})` : ""}
              </option>
            ))}
          </select>
          {users.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              没有可添加的用户（所有用户都已是成员或没有用户）
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">项目角色</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "OWNER" | "EDITOR" | "VIEWER")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="VIEWER">VIEWER（只读）</option>
            <option value="EDITOR">EDITOR（可编辑）</option>
            <option value="OWNER">OWNER（可管理成员）</option>
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
            disabled={loading || !userId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "添加中..." : "添加"}
          </button>
        </div>
      </form>
    </div>
  );
}
