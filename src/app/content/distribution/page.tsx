"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectSelector } from "@/components/forms/ProjectSelector";
import { Skeleton } from "@/components/ui/Skeleton";

interface DistributionTarget {
  id: string;
  name: string;
  platform: string;
  active: boolean;
  publishMode: "MANUAL" | "AUTO";
  autoPublishOn: string;
  _count: { logs: number };
  lastLog?: {
    status: string;
    sentAt: string | null;
    errorMessage: string | null;
  };
}

const PLATFORM_LABELS: Record<string, { name: string; icon: string }> = {
  ZHIHU: { name: "知乎", icon: "💬" },
  WECHAT_MP: { name: "微信公众号", icon: "💚" },
  FEISHU_DOC: { name: "飞书文档", icon: "✈️" },
  NOTION: { name: "Notion", icon: "📝" },
  BAIJIAHAO: { name: "百家号", icon: "📰" },
  DOUYIN: { name: "抖音/头条", icon: "🎵" },
  XIAOHONGSHU: { name: "小红书", icon: "📕" },
  COZE: { name: "字节扣子", icon: "🤖" },
  BAIDU_WENXIN: { name: "百度文心", icon: "🔍" },
  TENCENT_YUANBAO: { name: "腾讯元宝", icon: "🐧" },
  DINGTALK: { name: "钉钉", icon: "📌" },
  BAIDU_SEARCH: { name: "百度搜索", icon: "🔎" },
  SOGOU_SEARCH: { name: "搜狗搜索", icon: "🐶" },
  SO360_SEARCH: { name: "360搜索", icon: "🔱" },
  SHENMA_SEARCH: { name: "神马搜索", icon: "🐴" },
  CITATION_SITE: { name: "引用站点", icon: "📎" },
  INDEX_SITE: { name: "收录站点", icon: "📑" },
  CUSTOM_WEBHOOK: { name: "自定义", icon: "🔗" },
};

const PLATFORM_GROUPS = [
  { label: "社交平台", platforms: ["ZHIHU", "WECHAT_MP", "FEISHU_DOC", "NOTION"] },
  { label: "内容平台", platforms: ["BAIJIAHAO", "DOUYIN", "XIAOHONGSHU"] },
  { label: "AI 智能体", platforms: ["COZE", "BAIDU_WENXIN", "TENCENT_YUANBAO", "DINGTALK"] },
  { label: "搜索引擎", platforms: ["BAIDU_SEARCH", "SOGOU_SEARCH", "SO360_SEARCH", "SHENMA_SEARCH"] },
  { label: "引用/收录", platforms: ["CITATION_SITE", "INDEX_SITE"] },
];

export default function DistributionPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? "";

  const [targets, setTargets] = useState<DistributionTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  async function load() {
    if (!projectId) { setTargets([]); return; }
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}/distribution-targets?includeStats=true`);
    const json = await res.json();
    setTargets(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [projectId]);

  const filteredTargets = activeTab === "all" 
    ? targets 
    : targets.filter(t => {
        const group = PLATFORM_GROUPS.find(g => g.platforms.includes(t.platform));
        return group?.label.toLowerCase().includes(activeTab);
      });

  const stats = {
    total: targets.length,
    manual: targets.filter(t => t.publishMode === "MANUAL").length,
    auto: targets.filter(t => t.publishMode === "AUTO").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 页头 */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// CONTENT — Distribution</div>
          <h1 className="mt-2">跨平台分发</h1>
        </div>
        <div className="page-header-right">
          <ProjectSelector />
          {projectId && (
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              + 添加目标
            </button>
          )}
        </div>
      </header>

      {/* 统计 */}
      {!loading && targets.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="cell">
            <div className="eyebrow">total</div>
            <div className="metric-number-sm mt-1">{stats.total}</div>
          </div>
          <div className="cell">
            <div className="eyebrow">manual</div>
            <div className="metric-number-sm mt-1">{stats.manual}</div>
          </div>
          <div className="cell">
            <div className="eyebrow">auto</div>
            <div className="metric-number-sm mt-1">{stats.auto}</div>
          </div>
        </div>
      )}

      {/* 平台分组标签 */}
      {targets.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab("all")}
            className={`badge ${activeTab === "all" ? "badge-primary" : "badge-muted"} cursor-pointer`}
          >
            全部
          </button>
          {PLATFORM_GROUPS.map(group => (
            <button
              key={group.label}
              onClick={() => setActiveTab(group.label.toLowerCase())}
              className={`badge ${activeTab === group.label.toLowerCase() ? "badge-primary" : "badge-muted"} cursor-pointer`}
            >
              {group.label}
            </button>
          ))}
        </div>
      )}

      {/* 目标列表 */}
      {!projectId ? (
        <div className="empty-state">
          <span className="status-dot idle" /> select_project_first
        </div>
      ) : loading ? (
        <Skeleton className="h-48" />
      ) : filteredTargets.length === 0 ? (
        <div className="empty-state">
          暂无分发目标。点击右上角添加目标开始分发。
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTargets.map(target => (
            <div key={target.id} className={`card p-4 ${target.active ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{PLATFORM_LABELS[target.platform]?.icon || "📦"}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{target.name}</h3>
                      <span className="badge badge-muted text-[10px]">
                        {PLATFORM_LABELS[target.platform]?.name || target.platform}
                      </span>
                      {target.publishMode === "AUTO" && (
                        <span className="badge badge-success text-[10px]">
                          AUTO@{target.autoPublishOn}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>分发 {target._count.logs} 次</span>
                      {target.lastLog?.sentAt && (
                        <span>最近 {new Date(target.lastLog.sentAt).toLocaleDateString()}</span>
                      )}
                      {target.lastLog?.status === "FAILED" && (
                        <span className="text-destructive">{target.lastLog.errorMessage}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${target.active ? "online" : "idle"}`} />
                  <span className="text-xs">{target.active ? "启用" : "停用"}</span>
                  <button className="btn-ghost btn-sm">编辑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加目标对话框 */}
      {showAdd && projectId && (
        <AddTargetDialog
          projectId={projectId}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); void load(); }}
        />
      )}
    </div>
  );
}

function AddTargetDialog({ projectId, onClose, onAdded }: { projectId: string; onClose: () => void; onAdded: () => void }) {
  const [platform, setPlatform] = useState("BAIDU_SEARCH");
  const [name, setName] = useState("");
  const [publishMode, setPublishMode] = useState<"MANUAL" | "AUTO">("MANUAL");
  const [autoTrigger, setAutoTrigger] = useState("APPROVED");
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const configSchema: Record<string, { key: string; label: string; type: string }[]> = {
    BAIDU_SEARCH: [
      { key: "siteUrl", label: "网站地址", type: "url" },
      { key: "token", label: "推送Token", type: "password" },
    ],
    SOGOU_SEARCH: [
      { key: "siteUrl", label: "网站地址", type: "url" },
      { key: "token", label: "推送Token", type: "password" },
    ],
    SO360_SEARCH: [
      { key: "siteUrl", label: "网站地址", type: "url" },
      { key: "token", label: "推送Token", type: "password" },
    ],
    SHENMA_SEARCH: [
      { key: "siteUrl", label: "网站地址", type: "url" },
      { key: "token", label: "推送Token", type: "password" },
    ],
    ZHIHU: [
      { key: "token", label: "Access Token", type: "password" },
      { key: "columnId", label: "专栏ID（可选）", type: "text" },
    ],
    WECHAT_MP: [
      { key: "appId", label: "AppID", type: "text" },
      { key: "appSecret", label: "AppSecret", type: "password" },
    ],
    COZE: [
      { key: "apiKey", label: "API Key", type: "password" },
      { key: "botId", label: "Bot ID", type: "text" },
      { key: "spaceId", label: "Space ID（可选）", type: "text" },
    ],
    BAIJIAHAO: [
      { key: "apiKey", label: "API Key", type: "password" },
      { key: "accountId", label: "账号ID", type: "text" },
    ],
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    const res = await fetch(`/api/projects/${projectId}/distribution-targets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        name, 
        platform, 
        config: configFields,
        publishMode,
        autoPublishOn: autoTrigger,
      }),
    });
    
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json?.error?.message ?? "创建失败"); return; }
    onAdded();
  }

  const fields = configSchema[platform] || [];

  return (
    <div className="dialog-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <form onSubmit={handleSubmit} className="dialog-panel w-full max-w-lg">
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">添加分发目标</h2>
            <button type="button" onClick={onClose} className="btn-icon">×</button>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              [ error ] {error}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">名称 *</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              placeholder="例如：百度搜索提交"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">平台</label>
            <select
              value={platform} onChange={e => { setPlatform(e.target.value); setConfigFields({}); }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {PLATFORM_GROUPS.flatMap(group => 
                group.platforms.map(p => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p]?.icon} {PLATFORM_LABELS[p]?.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">发布模式</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="publishMode" value="MANUAL"
                  checked={publishMode === "MANUAL"}
                  onChange={() => setPublishMode("MANUAL")}
                />
                <span className="text-sm">手动发布</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio" name="publishMode" value="AUTO"
                  checked={publishMode === "AUTO"}
                  onChange={() => setPublishMode("AUTO")}
                />
                <span className="text-sm">自动发布</span>
              </label>
            </div>
          </div>

          {publishMode === "AUTO" && (
            <div>
              <label className="block text-sm font-medium mb-1">触发条件</label>
              <select
                value={autoTrigger} onChange={e => setAutoTrigger(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="APPROVED">审核通过后自动发布</option>
                <option value="PUBLISHED">发布后自动分发</option>
              </select>
            </div>
          )}

          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1">{f.label}</label>
              <input
                type={f.type}
                value={configFields[f.key] ?? ""}
                onChange={e => setConfigFields({ ...configFields, [f.key]: e.target.value })}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">取消</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? "创建中..." : "创建"}
          </button>
        </div>
      </form>
    </div>
  );
}
