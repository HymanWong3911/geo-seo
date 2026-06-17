"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface AlertChannel {
  id: string;
  name: string;
  type: "FEISHU" | "WECOM" | "EMAIL";
  config: Record<string, unknown>;
  events: string[];
  active: boolean;
  createdAt: string;
}

const TYPE_LABEL = {
  FEISHU: "飞书",
  WECOM: "企微",
  EMAIL: "邮件",
} as const;

export default function AlertsPage() {
  const router = useRouter();
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/alert-channels");
    const json = await res.json();
    setChannels(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggleActive(c: AlertChannel) {
    const res = await fetch(`/api/alert-channels/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    if (res.ok) void load();
  }

  async function testChannel(c: AlertChannel) {
    const res = await fetch(`/api/alert-channels/${c.id}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      alert(json?.error?.message ?? "发送失败");
    } else {
      alert(`测试告警已发送到 ${c.name}，请检查通道是否收到`);
    }
  }

  async function deleteChannel(c: AlertChannel) {
    if (!confirm(`确认删除告警通道 "${c.name}"？`)) return;
    const res = await fetch(`/api/alert-channels/${c.id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/settings" className="text-sm text-muted-foreground hover:underline">
            ← 返回设置
          </Link>
          <h1 className="text-2xl font-semibold">告警通道</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings/alerts/logs"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            告警历史
          </Link>
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            + 添加通道
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">名称</th>
              <th className="px-3 py-2 text-left font-medium">类型</th>
              <th className="px-3 py-2 text-left font-medium">订阅事件</th>
              <th className="px-3 py-2 text-left font-medium">状态</th>
              <th className="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">加载中...</td></tr>
            ) : channels.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">暂无告警通道，建议至少配一个（飞书 / 企微 / 邮件）</td></tr>
            ) : (
              channels.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{TYPE_LABEL[c.type]}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.events.join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    {c.active ? (
                      <span className="text-green-600">启用</span>
                    ) : (
                      <span className="text-muted-foreground">禁用</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={() => void testChannel(c)} className="text-xs text-blue-600 hover:underline">
                        测试
                      </button>
                      <button onClick={() => void toggleActive(c)} className="text-xs text-muted-foreground hover:underline">
                        {c.active ? "禁用" : "启用"}
                      </button>
                      <button onClick={() => void deleteChannel(c)} className="text-xs text-red-600 hover:underline">
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

      {showAdd && (
        <AddChannelDialog
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

function AddChannelDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [type, setType] = useState<"FEISHU" | "WECOM" | "EMAIL">("FEISHU");
  const [name, setName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [emails, setEmails] = useState("");
  const [events, setEvents] = useState<string[]>(["GEO_RUN_FAILED", "DAILY_GEO_SUMMARY"]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const config = type === "EMAIL"
      ? { to: emails.split(",").map((s) => s.trim()).filter(Boolean) }
      : { webhookUrl };

    const res = await fetch("/api/alert-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type, config, events }),
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
        <h2 className="text-lg font-semibold">添加告警通道</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">名称 *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：运维群飞书"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">类型</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "FEISHU" | "WECOM" | "EMAIL")}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="FEISHU">飞书</option>
            <option value="WECOM">企微</option>
            <option value="EMAIL">邮件</option>
          </select>
        </div>
        {type === "EMAIL" ? (
          <div>
            <label className="mb-1 block text-sm font-medium">收件人邮箱（逗号分隔）</label>
            <input
              type="text"
              required
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="ops@example.com, ceo@example.com"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium">Webhook URL</label>
            <input
              type="url"
              required
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder={type === "FEISHU" ? "https://open.feishu.cn/open-apis/bot/v2/hook/xxx" : "https://qyapi.weixin.qq.com/.../send?key=xxx"}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">订阅事件</label>
          <div className="space-y-1 text-sm">
            {["GEO_RUN_FAILED", "DAILY_GEO_SUMMARY", "ANOMALY_DETECTED"].map((e) => (
              <label key={e} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={events.includes(e)}
                  onChange={(ev) => {
                    if (ev.target.checked) setEvents([...events, e]);
                    else setEvents(events.filter((x) => x !== e));
                  }}
                />
                <code className="text-xs">{e}</code>
              </label>
            ))}
          </div>
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
