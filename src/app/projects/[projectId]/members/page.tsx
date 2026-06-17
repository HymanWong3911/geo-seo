"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AddMemberDialog } from "@/components/forms/AddMemberDialog";

interface Member {
  id: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  user: {
    id: string;
    email: string;
    name: string | null;
    role: "ADMIN" | "MEMBER";
    active: boolean;
    lastLoginAt: string | null;
  };
}

export default function MembersPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/members`);
    const json = await res.json();
    setMembers(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function changeRole(m: Member, role: Member["role"]) {
    const res = await fetch(`/api/members/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, role } : x)));
    } else {
      const json = await res.json();
      alert(json?.error?.message ?? "修改失败");
    }
  }

  async function remove(m: Member) {
    if (!confirm(`确认移除 ${m.user.email}？`)) return;
    const res = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
    } else {
      const json = await res.json();
      alert(json?.error?.message ?? "移除失败");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
            ← 返回项目列表
          </Link>
          <h1 className="text-2xl font-semibold">项目成员</h1>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          + 添加成员
        </button>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">用户</th>
              <th className="px-3 py-2 text-left font-medium">全局角色</th>
              <th className="px-3 py-2 text-left font-medium">项目角色</th>
              <th className="px-3 py-2 text-left font-medium">最后登录</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                  暂无成员
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <div>{m.user.email}</div>
                    {m.user.name && (
                      <div className="text-xs text-muted-foreground">{m.user.name}</div>
                    )}
                    {!m.user.active && (
                      <div className="text-xs text-red-500">已停用</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs ${
                        m.user.role === "ADMIN" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {m.user.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={m.role}
                      onChange={(e) => void changeRole(m, e.target.value as Member["role"])}
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="EDITOR">EDITOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {m.user.lastLoginAt ? new Date(m.user.lastLoginAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => void remove(m)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      移除
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddMemberDialog
          projectId={projectId}
          existingMemberIds={members.map((m) => m.user.id)}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
