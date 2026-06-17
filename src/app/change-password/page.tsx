"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const mustChange = session?.user?.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    if (newPassword.length < 8) {
      setError("新密码至少 8 位");
      return;
    }

    setLoading(true);

    const endpoint = mustChange
      ? "/api/auth/first-login-change-password"
      : "/api/auth/change-password";

    const body = mustChange
      ? { newPassword }
      : { currentPassword, newPassword };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    const json = await res.json();
    if (!res.ok) {
      setError(json?.error?.message ?? "改密失败");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-border bg-background p-8 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">修改密码</h1>
          {mustChange && (
            <p className="mt-1 text-sm text-orange-500">
              首次登录请修改初始密码后再使用。
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!mustChange && (
            <div>
              <label className="mb-1 block text-sm font-medium">当前密码</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">新密码（至少 8 位）</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">确认新密码</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {loading ? "提交中..." : "修改密码"}
          </button>
        </form>
      </div>
    </div>
  );
}
