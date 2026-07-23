import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;       // 如 "// M02"
  title: string;         // 如 "页面诊断"
  description: string;   // 一句话说明，如 "输入网址，让系统给网站 SEO 打分"
  actions?: ReactNode;  // 右侧按钮
  children?: ReactNode; // 兼容旧调用方式，等同于 actions
}

export function PageHeader({ eyebrow, title, description, actions, children }: PageHeaderProps) {
  const headerActions = actions ?? children;
  return (
    <header className="mb-8">
      {/* 标题行 */}
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-2 text-2xl tracking-tight">{title}</h1>
        </div>
        {headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
      </div>
      {/* 一句话说明 */}
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </header>
  );
}
