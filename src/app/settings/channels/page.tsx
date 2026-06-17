"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/Skeleton";

interface ChannelDiagnostics {
  isConfigured: boolean;
  isAvailable: boolean;
  missingEnvVars: string[];
}

interface Diagnostics {
  perplexity: ChannelDiagnostics;
  kimi: ChannelDiagnostics;
  doubao: ChannelDiagnostics;
  llm_simulation: ChannelDiagnostics;
}

const CHANNEL_INFO = {
  perplexity: {
    name: "Perplexity",
    description: "英文 AI 搜索，真实联网，返回引用来源",
    icon: "🔍",
    features: ["实时联网", "引用来源", "英文为主"],
    docs: "https://www.perplexity.ai/settings/api",
  },
  kimi: {
    name: "Kimi",
    description: "中文 AI 助手（月之暗面）",
    icon: "🌙",
    features: ["中文对话", "长文本处理", "通过 ARK 接入"],
    docs: "https://platform.moonshot.cn",
  },
  doubao: {
    name: "豆包",
    description: "字节跳动大模型",
    icon: "🫛",
    features: ["中文对话", "多模态", "通过 ARK 接入"],
    docs: "https://console.volcengine.com/ark",
  },
  llm_simulation: {
    name: "LLM Fallback",
    description: "当所有渠道不可用时的兜底方案",
    icon: "🔄",
    features: ["纯 LLM 回答", "无需联网", "依赖 LLM_API_KEY"],
    docs: "#",
  },
};

export default function ChannelsPage() {
  const { t } = useI18n();
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/search/channels/diagnostics");
      const json = await res.json();
      setDiagnostics(json.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to load diagnostics:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const availableChannels = diagnostics
    ? Object.entries(diagnostics).filter(([, d]) => d.isAvailable).length
    : 0;
  const totalChannels = diagnostics ? Object.keys(diagnostics).length : 0;

  return (
    <div className="mx-auto max-w-4xl">
      {/* 页头 */}
      <header className="page-header">
        <div className="page-header-left">
          <div className="eyebrow">// SETTINGS — GEO Channels</div>
          <h1 className="mt-2">GEO 渠道配置</h1>
        </div>
        <div className="page-header-right">
          <button onClick={() => void load()} className="btn-ghost btn-sm" disabled={loading}>
            {loading ? "loading..." : "↻ refresh"}
          </button>
        </div>
      </header>

      {/* 概览 */}
      <div className="mb-8 grid grid-cols-3 gap-px bg-border">
        <div className="cell">
          <div className="eyebrow">available</div>
          <div className="metric-number-sm mt-1">
            {availableChannels} <span className="text-muted-foreground">/ {totalChannels}</span>
          </div>
        </div>
        <div className="cell">
          <div className="eyebrow">configured</div>
          <div className="metric-number-sm mt-1">
            {diagnostics ? Object.values(diagnostics).filter(d => d.isConfigured).length : 0}
          </div>
        </div>
        <div className="cell">
          <div className="eyebrow">last_check</div>
          <div className="metric-number-sm mt-1 text-xs">
            {lastRefresh ? lastRefresh.toLocaleTimeString() : "—"}
          </div>
        </div>
      </div>

      {/* 渠道卡片 */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-4 w-64" />
            </div>
          ))}
        </div>
      ) : diagnostics ? (
        <div className="space-y-4">
          {Object.entries(diagnostics).map(([key, diag]) => {
            const info = CHANNEL_INFO[key as keyof typeof CHANNEL_INFO];
            return (
              <div key={key} className={`card card-glow p-6 ${diag.isAvailable ? "border-success/30" : "border-destructive/30"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`text-3xl ${diag.isAvailable ? "" : "opacity-50"}`}>
                      {info.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{info.name}</h3>
                        <span className={`badge ${diag.isAvailable ? "badge-success" : "badge-error"}`}>
                          {diag.isAvailable ? "available" : "unavailable"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{info.description}</p>
                      
                      {/* 功能标签 */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {info.features.map(f => (
                          <span key={f} className="badge badge-muted text-[10px]">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <a
                    href={info.docs}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost btn-sm"
                  >
                    docs →
                  </a>
                </div>

                {/* 缺失的环境变量 */}
                {diag.missingEnvVars.length > 0 && (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      missing_env_vars
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {diag.missingEnvVars.map((v: string) => (
                        <code key={v} className="bg-muted px-2 py-1 text-xs font-mono text-destructive">
                          {v}
                        </code>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      在 <code className="text-[10px]">.env</code> 中配置上述环境变量后刷新页面
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">failed_to_load_diagnostics</div>
      )}

      {/* 配置说明 */}
      <div className="mt-8 card p-6">
        <h3 className="font-semibold mb-4">配置说明</h3>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium text-foreground mb-1">Perplexity</h4>
            <p className="text-muted-foreground">
              需要 <code className="text-xs">PERPLEXITY_API_KEY</code>，在{" "}
              <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                perplexity.ai
              </a>{" "}
              申请。支持真实联网搜索和引用返回。
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Kimi / 豆包</h4>
            <p className="text-muted-foreground">
              可以共用 <code className="text-xs">ARK_API_KEY</code>（火山引擎 ARK Coding Plan 订阅版 key），也可以单独配置{" "}
              <code className="text-xs">KIMI_API_KEY</code> 或 <code className="text-xs">DOUBAO_API_KEY</code>。
              注意：ARK Coding Plan 不支持联网搜索，仅返回 LLM 回答。
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">LLM Fallback</h4>
            <p className="text-muted-foreground">
              当所有真实渠道都不可用时，系统会使用配置的 LLM（如 MiniMax、DeepSeek）作为兜底。
              需要配置 <code className="text-xs">LLM_API_KEY</code>。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
