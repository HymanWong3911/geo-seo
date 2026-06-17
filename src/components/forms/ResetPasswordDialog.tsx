"use client";

import { useState } from "react";

interface User {
  id: string;
  email: string;
  name: string | null;
}

export function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReset() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/users/${user.id}/reset-password`, {
      method: "POST",
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "重置失败");
      return;
    }
    setTempPassword(json.data.tempPassword);
  }

  if (tempPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg">
          <h2 className="text-lg font-semibold">密码已重置</h2>
          <p className="text-sm text-muted-foreground">
            {user.email} 的临时密码（仅显示一次）：
          </p>
          <code className="block break-all rounded bg-muted p-3 font-mono text-sm">
            {tempPassword}
          </code>
          <p className="text-xs text-muted-foreground">
            请通过 IM 把密码发给用户。用户登录后会被要求修改密码。
          </p>
          <button
            onClick={onClose}
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
      <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">重置密码</h2>
        <p className="text-sm text-muted-foreground">
          确认重置 <strong>{user.email}</strong> 的密码？系统会生成一个 16 位临时密码。
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "重置中..." : "确认重置"}
          </button>
        </div>
      </div>
    </div>
  );
}
