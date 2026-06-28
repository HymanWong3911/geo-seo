# GEO/SEO Console — 静态 HTML 演示版

完全脱离 Next.js / Node.js,可直接在浏览器打开查看产品 UI 与真实业务数据快照。

## 文件结构

```
static-demo/
├── style.css            # 共享设计 token(与 globals.css 一致)
├── index.html           # 仪表盘(主页)
├── insights.html        # AI 洞察页(完整 LLM 真实输出快照)
├── audits.html          # 页面审计列表
├── geo-runs.html        # GEO 运行历史
├── distribution.html    # 分发目标 + 17 个平台目录
├── tasks.html           # 任务看板(Kanban)
├── projects.html        # 项目(占位)
├── keywords.html        # 关键词(占位)
├── geo.html             # GEO 概览(占位)
├── content.html         # 内容(占位)
├── drafts.html          # 草稿(占位)
├── review.html          # 审核(占位)
├── reports.html         # 报告(占位)
├── brand-monitor.html   # 品牌监控(占位)
├── llm-usage.html       # LLM 用量(占位)
└── system-health.html   # 系统健康(占位)
```

## 使用方法

### 方法 A:浏览器直接打开
```bash
open /Users/huanghaoming/Documents/项目开发/geo-seo/static-demo/index.html
```

### 方法 B:启动本地 HTTP 服务器
```bash
cd /Users/huanghaoming/Documents/项目开发/geo-seo/static-demo
python3 -m http.server 8088
# 然后访问 http://localhost:8088
```

### 方法 C:部署到任何静态托管
- Vercel / Netlify / GitHub Pages / Cloudflare Pages
- 直接把 `static-demo/` 整个目录上传即可

## 页面分级

**完整版**(5 个,有真实数据 + 完整视觉):
- `index.html` — 仪表盘(AI 洞察速览 + KPI + 活动时间线 + 系统健康)
- `insights.html` — AI 洞察(LLM 真实生成的 4 项机会 / 风险 / 行动)
- `audits.html` — 审计列表(7 条真实数据,含低分页警告)
- `geo-runs.html` — GEO 运行历史(7 条,含成功/失败/部分失败)
- `distribution.html` — 分发目标 + 17 个平台目录
- `tasks.html` — 任务看板(5 列 Kanban,14 个任务)

**占位版**(11 个,显示"模块已就绪,请启动 dev server"卡片):
- 其他导航项

## 设计语言

- 暗色主题(碳黑底 #0A0A0A + 米白字 + 玫瑰金高光 #C5A572)
- JetBrains Mono 用于代码/数字,Inter 用于正文
- 12 列响应式布局
- 圆角 6px,边框 1px,卡片间距 12-16px

## 与运行版的关系

这是**视觉/产品演示版**,不是生产部署。
- 不需要 Node.js、PostgreSQL、Redis
- 数据是快照(来自 2026-06-28 真实数据)
- 链接(`?projectId=...`)和按钮都不会触发真实 API

要完整体验(真实数据 + 真实 LLM + 真实分发):
```bash
./scripts/restart-dev.sh
# 访问 http://localhost:3010
```
