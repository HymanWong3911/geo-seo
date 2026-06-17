"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useI18n } from "@/lib/i18n";
import { CreateUserDialog } from "@/components/forms/CreateUserDialog";
import { ResetPasswordDialog } from "@/components/forms/ResetPasswordDialog";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "MEMBER";
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const pageSize = 20;

  const isAdmin = session?.user?.role === "ADMIN";

  async function load() {
    setLoading(true);
    const url = new URL("/api/users", window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    if (search) url.searchParams.set("search", search);
    const res = await fetch(url);
    const json = await res.json();
    setUsers(json.data ?? []);
    setTotal(json.meta?.total ?? 0);
    setLoading(false);
  }

  // 首次加载 + 翻页 + 搜索
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  async function toggleActive(u: User) {
    const action = u.active ? "disable" : "enable";
    const res = await fetch(`/api/users/${u.id}/${action}`, { method: "POST" });
    if (res.ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !u.active } : x)));
    } else {
      alert("操作失败");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">用户管理</h1>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            + 新建用户
          </button>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.users}</p>

      <div className="flex items-center gap-2">
        <input
          type="search"
          placeholder="按邮箱 / 姓名搜索"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => void load()}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          搜索
        </button>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">邮箱</th>
              <th className="px-3 py-2 text-left font-medium">姓名</th>
              <th className="px-3 py-2 text-left font-medium">角色</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">最后登录</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  暂无用户
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">{u.email}</td>
                  <td className="px-3 py-2">{u.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${
                        u.role === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {u.active ? (
                      <span className="text-green-600">活跃</span>
                    ) : (
                      <span className="text-muted-foreground">已停用</span>
                    )}
                    {u.mustChangePassword && (
                      <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700">
                        待改密
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setResetTarget(u)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          重置密码
                        </button>
                        {u.id !== session?.user?.id && (
                          <button
                            onClick={() => void toggleActive(u)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            {u.active ? "停用" : "启用"}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">共 {total} 个用户</span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
            >
              上一页
            </button>
            <span className="px-2">第 {page} 页</span>
            <button
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-border px-3 py-1 disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserDialog
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}
