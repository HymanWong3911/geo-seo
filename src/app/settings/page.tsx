import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <PageHeader
        eyebrow="// M18 — Settings"
        title="设置"
        description="修改密码、配置 CMS 集成、管理告警渠道、查看系统信息"
      />
      <div className="card p-6">
        <p className="text-sm text-muted-foreground">
          通过左侧菜单进入各个设置子页面：用户管理、CMS 集成、审计日志、分发配置、告警通道等。
        </p>
      </div>
    </main>
  );
}
