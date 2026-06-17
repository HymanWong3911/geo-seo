"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useSession } from "next-auth/react";

interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  userId: string | null;
  ip: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null } | null;
  metadata: unknown;
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  const pageSize = 50;
  const { t } = useI18n();

  async function load() {
    setLoading(true);
    const url = new URL("/api/audit-log", window.location.origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));
    if (actionFilter) url.searchParams.set("action", actionFilter);
    const res = await fetch(url);
    const json = await res.json();
    setLogs(json.data ?? []);
    setTotal(json.meta?.total ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter, session?.user?.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">审计日志</h1>
        <div className="text-sm text-muted-foreground">
          共 {total} 条 ·{" "}
          {session?.user?.role === "ADMIN" ? "（管理员视图）" : "（个人视图）"}
        </div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{t.pageDesc.auditLog}</p>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="按 action 过滤（例：USER_LOGIN）"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => {
            setActionFilter("");
            setPage(1);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          清空
        </button>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">时间</th>
              <th className="px-3 py-2 text-left font-medium">用户</th>
              <th className="px-3 py-2 text-left font-medium">动作</th>
              <th className="px-3 py-2 text-left font-medium">对象</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
              <th className="px-3 py-2 text-left font-medium">元数据</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  暂无审计记录
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {l.user?.email ?? <span className="text-muted-foreground">系统</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-mono text-blue-700">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.targetType ? `${l.targetType}:${(l.targetId ?? "").slice(0, 8)}` : "-"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{l.ip ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">
                    {l.metadata ? (
                      <code className="block max-w-md overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        {JSON.stringify(l.metadata)}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
        >
          ← 上一页
        </button>
        <span>
          第 {page} 页 / 共 {Math.max(1, Math.ceil(total / pageSize))} 页
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page * pageSize >= total}
          className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
        >
          下一页 →
        </button>
      </div>
    </div>
  );
}
