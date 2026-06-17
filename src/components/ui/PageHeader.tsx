import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;       // 如 "// M02"
  title: string;         // 如 "页面诊断"
  description: string;   // 一句话说明，如 "输入网址，让系统给网站 SEO 打分"
  actions?: ReactNode;  // 右侧按钮
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-8">
      {/* 标题行 */}
      <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-2 text-2xl tracking-tight">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {/* 一句话说明 */}
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
    </header>
  );
}
