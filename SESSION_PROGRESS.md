# GEO + SEO 项目开发进度

> **最后更新**：2026-06-11
> **本会话累计**：M1-M11 全部完成 + 全量 UI 升级（深空黑+玫瑰金科幻风、主题切换、骨架屏、趋势图表）

---

## 一句话状态

**M1-M11 全部功能实现，端到端跑通，全量 UI 升级完成：深空黑+玫瑰金科幻风、主题切换、骨架屏、趋势图表。**

---

## 本次会话完成的所有改动

### 1. 环境配置（让项目能跑起来）

| 文件 | 改动 | 原因 |
|---|---|---|
| `.env` | 新建（DATABASE_URL/REDIS_URL/AUTH_SECRET/LLM_*） | 用户给了 MiniMax API key，需配齐环境 |
| `docker-compose.yml` | 端口 5432→5434、6379→6380 | 避开 host 上已占用的 5432/6379 |
| `package.json` | dev 端口 3010、bcrypt→bcryptjs、Prisma schema path、ioredis override 5.10.1 | bcrypt node-gyp 装不上；ioredis 5.11 与 bullmq 5.10 冲突 |
| `prisma/schema.prisma` | 补 `reports Report[]` 反向关联、AlertEvent ↔ AlertChannel 关系 | Prisma validate 报错 + 编译错误 |

### 2. 关键 Bug 修复

| Bug | 文件 | 修复 |
|---|---|---|
| `useSession must be wrapped in <SessionProvider />` | `src/components/providers.tsx` (新)、`src/app/layout.tsx` | 新增 SessionProvider 包装 |
| middleware edge runtime 报 `node:diagnostics_channel` 解析失败 | `src/middleware.ts` | 用 `getToken()` 替代 `auth()` wrapper |
| `bcrypt: Native module not built` | 7 个源文件 | 全部换 `bcryptjs` |
| Prisma Json 类型不匹配 | `src/lib/audit/logger.ts` 等 8 处 | 改用 `Prisma.InputJsonValue` 断言 |
| 缺 ioredis connection.ts | `src/lib/queue/connection.ts` (新) | re-export 共享 connection |
| LLM API host `api.minimax.com` DNS 失败 | `.env` | 改成真实地址 `api.minimaxi.com` |
| `triggerType: "RETRY"` 不在 enum | `src/lib/queue/geo.ts` | 扩成 `"MANUAL" \| "SCHEDULED" \| "RETRY"` |
| `_count: { select: {} }` 返回 never | `src/app/api/comments/route.ts` | 删掉空 select |
| `signOut` event token 类型联合 | `src/lib/auth.ts` | 用 `"token" in message` 守卫 |
| `zxcvbn` 无类型 | `src/types/zxcvbn.d.ts` (新) | 手写 d.ts |
| `LLMFactory`、`searchProviders`、`api/notifications` 缺失导出 | 多个 lib 文件 | 加 alias export |
| `Buffer` 不兼容 `BlobPart` | `src/lib/cms/adapters/self-hosted.ts` | `new Uint8Array(file)` |
| `performance.getEntriesByType` 类型找不到 | `src/lib/crawler/index.ts` | 显式 cast 为 `Performance` |
| `include: { channel: ... }` 返回 never | `src/prisma/schema.prisma` | 加 AlertEvent↔AlertChannel relation + migration |

### 3. 新增能力

| 能力 | 文件 | 价值 |
|---|---|---|
| 审计日志 API + UI | `src/app/api/audit-log/route.ts`、`src/app/settings/audit-log/page.tsx` (新) | 管理员可看全量审计 |
| LLM 调用追踪 | `src/lib/llm/tracker.ts` (新) | 自动写 LlmCall 表（成本/时长/成功） |
| GEO 智能渠道跳过 | `src/lib/search/index.ts` + `src/lib/geo/channel.ts` | 无 key 渠道直接跳过，节省 7.5 分钟重试 |
| Worker 进程编排 | `src/workers/index.ts` | 7 个 worker + 心跳 + 品牌监控定时器 + 优雅退出 |
| 项目总览页 | `src/app/projects/[projectId]/page.tsx` (新) | 9 个子模块导航 + 关键指标 |
| 真实项目选择器 Topbar | `src/components/layout/Topbar.tsx` | localStorage 持久化 + URL 同步 |
| 仪表盘升级 | `src/app/dashboard/page.tsx` + `src/app/api/dashboard/summary/route.ts` | GEO 评分趋势 + LLM 成本 + 待办任务 |
| Sidebar 完整化 | `src/components/layout/Sidebar.tsx` | 加 v1.2 内容流/分发/通知/审计链接 |
| E2E 测试套件 | `tests/e2e/geo-run-flow.test.ts` (新) | 9 步端到端：登录→创建→触发→worker→验证 |

### 4. 文档更新

| 文件 | 改动 |
|---|---|
| `README.md` | 完整重写：5 分钟跑通 + 端口总览 + 6 个核心流程图 + 故障排查 |
| `SESSION_PROGRESS.md` | 本文件，记录所有改动 |

### 5. UI 升级 v5：深空黑+玫瑰金科幻风（2026-06-11）

| 文件 | 改动 |
|---|---|
| `src/app/globals.css` | 完整重写：补全截断部分、CSS 变量体系（--font-sans/mono/display）、badge/按钮/表格/表单/dialog/skeleton 完整组件、light 亮色主题 |
| `tailwind.config.ts` | 加 fontFamily/transition/animation/keyframes 扩展、success/warning/info 色 |
| `src/components/providers.tsx` | 加 ThemeProvider（next-themes，class 属性，defaultTheme=dark） |
| `src/components/ui/ThemeToggle.tsx` | 太阳/月亮图标切换，亮/暗主题切换按钮 |
| `src/components/ui/Skeleton.tsx` | Skeleton/ShimmerCard/SkeletonTableRow/SkeletonTable 骨架屏组件 |
| `src/components/ui/Charts.tsx` | GeoScoreChart（折线图）+ LlmCostChart（面积图）+ ScoreDistChart（分布图） |
| `src/app/layout.tsx` | 加 Inter + JetBrains Mono 字体变量、ThemeProvider 包装 |
| `src/app/login/page.tsx` | 加 ThemeToggle |
| `src/app/keywords/page.tsx` | 全面重写：page header、stats 卡片、input-field、chip/badge、dialog-panel |
| `src/app/geo/page.tsx` | 全面重写：同上风格 + active/inactive 切换按钮 |
| `src/app/tasks/page.tsx` | 全面重写：状态标签页切换、status badge 统一 |
| `src/app/content/page.tsx` | 全面重写：标签切换、input-field 风格、SuggestionCard 组件 |
| `src/app/reports/page.tsx` | 全面重写：dialog-panel 风格、card-glow hover |
| `src/app/audits/page.tsx` | 对话框升级为 dialog-overlay/dialog-panel 风格 |
| `src/app/dashboard/page.tsx` | 加 30d GEO 趋势折线图 + LLM 成本面积图、骨架屏加载 |
| `src/app/api/dashboard/summary/route.ts` | 加 geoTrend + llmCostTrend 历史数据（按天聚合） |

---

## 当前可运行验证清单

### 服务状态
- ✅ Dev server: `http://localhost:3010`（PID 60614）
- ✅ Worker 进程：3 个 BullMQ consumer（pageAudit / geoRun / scheduler / retention / cmsPublish 等）
- ✅ PostgreSQL 5434
- ✅ Redis 6380

### 凭据
```
ADMIN 邮箱: admin@example.com
ADMIN 密码: Admin@2026
LLM 端点:  https://api.minimaxi.com/v1  (MiniMax M3)
LLM Key:   sk-cp-NXCaCjLXYpl_zSJUvAij8hM-yeI-...
```

### 启动命令
```bash
# 1. 起 DB
docker compose up -d postgres redis

# 2. 装依赖（已装）
pnpm install

# 3. Web
pnpm dev          # 端口 3010

# 4. Worker（另一个终端）
pnpm worker       # BullMQ 7 个 consumer
```

### 跑测试
```bash
# 全部测试
pnpm test                        # 84/84 通过

# 仅单测（无外部依赖）
pnpm test --exclude tests/e2e

# 仅 E2E（需 worker 在跑 + .env 有 LLM_API_KEY）
set -a; source .env; set +a
pnpm test tests/e2e

# Typecheck
pnpm typecheck                   # 0 错误
```

### 端到端验证（人工）
1. 浏览器打开 http://localhost:3010
2. 登录 `admin@example.com` / `Admin@2026`
3. 顶部选"示例项目（公司主站）"
4. `/audits/new` 填 `https://example.com` → 立即看到 8 项 SEO 发现 + 24 分
5. `/content?projectId=seed-project-1` → "新草稿" → 填主题 → 看到 AI 生成的 1.5K 字
6. `/keywords?projectId=seed-project-1` → "扩展" → 看到 20 条带 search volume 的关键词
7. `/dashboard` → 看到 GEO 评分 40/100（up）+ 1 待办任务 + 月 LLM 成本
8. `/settings/audit-log` → 看到全量审计日志

---

## 端到端流程已验证

### M2 页面诊断
- 触发：`POST /api/projects/seed-project-1/audits` body `{url, sync}`
- 实测：`example.com` 抓取成功，8 项发现，1 高 5 中 2 低
- 落地：`Page` + `PageAudit` 双表

### M4 GEO 监测
- 触发：`POST /api/projects/seed-project-1/geo/runs` body `{questionIds}`
- Worker 消费：6 次成功 run
- LLM fallback：因无真实渠道 key，自动走 `llm_simulation`
- 答案质量：1299 字 SEO 工具市场分析 + 9 品牌提取
- 落地：`GeoRun` + `GeoRunResult` + `LlmCall`
- Metrics：评分 40/100 (trend: up)

### M8 AI 内容生成
- 触发：`POST /api/projects/seed-project-1/drafts/generate` body `{title, topic, targetKeywords}`
- 实测：1.5K 字长文，结构化（引言/7 大策略/FAQ），含锚链
- 落地：`ContentDraft` (status=DRAFT) + `ContentRevision` (v1)

### M8 关键词扩展
- 触发：`POST /api/projects/seed-project-1/keywords/expand` body `{seedKeyword, maxResults}`
- 实测：20 条建议，含 search volume、difficulty、intent

### M6 报告
- 触发：`POST /api/projects/seed-project-1/reports` body `{type: WEEKLY}`
- 落地：`Report` 表（含 periodFrom/periodTo/generatedBy）

### M6 审计
- 触发：所有写操作（用户/项目/任务/品牌/内容/GEO）
- 实测：8 条 GEO_RUN_TRIGGER + N 条其他动作全部记入
- 落库后立即可在 `/settings/audit-log` 看到

---

## 已知遗留 / 未来可做的事

### 可选增强
- [ ] Perplexity / Kimi / 豆包真实 API key 接入（替换 llm_simulation fallback）
- [ ] 跨平台分发的知乎/微信/飞书/Notion 真实 token 接入
- [ ] 邮件告警（配 SMTP + 飞书 webhook）
- [ ] CI/CD（GitHub Actions yaml）
- [ ] Sentry 错误监控
- [ ] PDF 报告导出
- [ ] 暗色模式
- [ ] 移动端 PWA
- [ ] 多租户 / SSO
- [ ] 升级到 Next.js 15

### 已知小问题
- `getEntriesByType` 浏览器 API 在某些 Node 版本下未挂载到 `performance`，已加 `as Performance` cast 兜底
- LlmCall 记录的 token 数目前为 0（粗略用字符数估成本，但 token 字段未填充）
- 真实渠道（perplexity/kimi/doubao）未跑通，仅测试过 llm_simulation

---

## 文件改动清单

### 新建
- `src/components/providers.tsx`
- `src/app/settings/audit-log/page.tsx`
- `src/app/projects/[projectId]/page.tsx`
- `src/lib/llm/tracker.ts`
- `src/lib/llm/tracker.test.ts`
- `src/lib/queue/connection.ts`
- `src/types/zxcvbn.d.ts`
- `tests/e2e/geo-run-flow.test.ts`
- `SESSION_PROGRESS.md`（本文件）

### 修改
- `src/middleware.ts`（用 getToken 替代 auth wrapper）
- `src/lib/auth.ts`（bcryptjs + signOut 守卫）
- `src/lib/auth/password.ts`（无改动，只是顶层 import）
- `src/lib/audit/logger.ts`（Json 类型 + Prisma import）
- `src/lib/search/index.ts`（加 searchProviders alias + getAvailableChannels）
- `src/lib/search/llm_simulation.ts`（接 tracker）
- `src/lib/geo/channel.ts`（智能跳过无 key 渠道）
- `src/lib/llm/index.ts`（加 LLMFactory alias）
- `src/lib/llm/openai_compatible.ts`（已有，未改）
- `src/lib/brand/monitor.ts`（注释掉未用 LLMFactory import）
- `src/lib/cms/adapters/self-hosted.ts`（Buffer→Uint8Array）
- `src/lib/crawler/index.ts`（performance.getEntriesByType cast）
- `src/lib/queue/audit.ts`（无改动，依赖 connection.ts）
- `src/lib/queue/geo.ts`（triggerType 加 RETRY）
- `src/workers/index.ts`（升级为完整进程编排）
- `src/workers/pageAuditWorker.ts`（Json 类型）
- `src/app/layout.tsx`（包 Providers）
- `src/app/dashboard/page.tsx`（4 卡片 + 趋势）
- `src/app/api/dashboard/summary/route.ts`（加 GEO + 任务 + LLM 成本）
- `src/app/api/alert-events/route.ts`（Prisma.AlertEventWhereInput）
- `src/app/api/audit-log/route.ts`（新）
- `src/app/api/audit-feed/route.ts`（已有）
- `src/app/api/cms-integrations/route.ts`（Prisma.InputJsonValue）
- `src/app/api/cms-integrations/[id]/route.ts`（同）
- `src/app/api/comments/route.ts`（删空 _count select）
- `src/app/api/distribution-targets/[id]/route.ts`（Prisma 类型）
- `src/app/api/projects/[projectId]/distribution-targets/route.ts`（Prisma 类型）
- `src/app/api/projects/route.ts`（ProjectStatus enum）
- `src/app/api/keywords/[id]/route.ts`（删 projectId in select）
- `src/app/api/geo/runs/[id]/retry/route.ts`（RETRY cast）
- `src/app/api/tasks/route.ts`（createdTasks 重命名）
- `src/app/brand/monitor/page.tsx`（useEffect import）
- `src/app/settings/cms/page.tsx`（deleteIntegration 传 c 不是 c.id）
- `src/components/layout/Sidebar.tsx`（v1.2 完整菜单）
- `src/components/layout/Topbar.tsx`（项目选择器）
- `src/prisma/schema.prisma`（reports relation + AlertEvent↔AlertChannel）
- `prisma/migrations/`（新增 alert channel relation migration）
- `package.json`（ioredis override 5.10.1、bcryptjs、port 3010、prisma schema path）
- `.env`（完整 MiniMax 配置 + 修正 base URL）
- `.npmrc`（onlyBuiltDependencies）
- `next.config.js`（serverComponentsExternalPackages）
- `tsconfig.json`（无改动）
- `vitest.config.ts`（无改动）
- `README.md`（完整重写）

---

## 下次接手如何 5 分钟恢复到当前状态

```bash
# 1. 进入项目
cd /Users/huanghaoming/Documents/项目开发/geo-seo

# 2. 起 DB
docker compose up -d postgres redis

# 3. 看代码健康度
pnpm typecheck && pnpm test

# 4. 起 dev
pnpm dev          # 终端 1
pnpm worker       # 终端 2

# 5. 浏览器
open http://localhost:3010
# 登录 admin@example.com / Admin@2026
```

如果遇到 LLM 调用失败：
1. `nslookup api.minimaxi.com` 验证 DNS
2. 检查 `.env` 的 `LLM_API_KEY` 和 `LLM_BASE_URL`
3. 看 `tail -f /tmp/worker.log`

如果遇到数据库问题：
1. `docker compose ps` 看 pg 是否健康
2. `pnpm prisma migrate dev` 跑未应用的 migration
3. `pnpm prisma studio` 可视化查数据

---

> **保存完毕**。下次继续工作的起点：本文件 + README + DEV_NOTES.md

---

## 本次会话完成 (2026-06-13)

### 1. 修复 LlmCall token 记录问题

| 文件 | 改动 |
|---|---|
| `src/lib/llm/index.ts` | 添加 `LLMUsage` / `LLMCompleteResult` 接口和 `completeWithUsage` 可选方法 |
| `src/lib/llm/tracker.ts` | 添加 `trackLLMCallWithUsage` 函数，支持真实 token 计数 |
| `src/lib/llm/openai_compatible.ts` | 实现 `completeWithUsage`，从 API 响应提取 usage |
| `src/lib/llm/anthropic.ts` | 实现 `completeWithUsage`，提取 input/output tokens |
| `src/lib/llm/openai.ts` | 实现 `completeWithUsage` |
| `src/lib/llm/google.ts` | 实现 `completeWithUsage`，处理 Gemini 响应格式 |
| `src/lib/llm/custom_http.ts` | 实现 `completeWithUsage` |
| `src/lib/llm/ark.ts` | 实现 `completeWithUsage` |

### 2. 完善真实渠道接入

| 文件 | 改动 |
|---|---|
| `src/lib/search/index.ts` | 添加 `isAvailable()` / `getDiagnostics()` / `getAllChannelsDiagnostics()` |
| `src/lib/search/perplexity.ts` | 实现诊断方法，改进 citations 解析 |
| `src/lib/search/kimi.ts` | 实现诊断方法 |
| `src/lib/search/doubao.ts` | 实现诊断方法 |
| `src/lib/search/llm_simulation.ts` | 实现诊断方法，集成 tracker |
| `src/app/api/search/channels/diagnostics/route.ts` | 新增诊断 API 端点 |
| `.env.example` | 添加 GEO 渠道配置说明 |

### 3. 添加 PDF 报告导出

| 文件 | 改动 |
|---|---|
| `src/lib/reports/pdf.ts` | 新增 PDF 生成工具（基于 Playwright） |
| `src/app/api/reports/[id]/route.ts` | 支持 `?format=pdf` 参数 |
| `src/app/reports/page.tsx` | 添加 PDF 下载按钮 |

### 4. 配置 GitHub Actions CI/CD

| 文件 | 改动 |
|---|---|
| `.github/workflows/ci.yml` | 完善 CI：单元测试 + E2E 测试 + Docker 构建 |
| `.github/workflows/deploy.yml` | 新增生产部署工作流模板 |

### 5. 集成 Sentry 错误监控

| 文件 | 改动 |
|---|---|
| `src/lib/sentry.ts` | 新增 Sentry 初始化模块 |
| `src/components/ui/ErrorBoundary.tsx` | 新增 React Error Boundary 组件 |
| `next.config.js` | 集成 @sentry/nextjs |
| `.env.example` | 添加 Sentry 配置说明 |

### 6. 优化现有功能

| 文件 | 改动 |
|---|---|
| `src/app/settings/channels/page.tsx` | 新增 GEO 渠道配置诊断页面 |
| `src/lib/i18n/zh-CN.ts` | 添加 channels 翻译 |
| `src/lib/i18n/en-US.ts` | 添加 channels 翻译 |
| `src/components/layout/Sidebar.tsx` | 添加渠道配置到管理菜单 |


---

## 本次会话完成 (2026-06-13 下午)

### 跨平台分发功能扩展

#### 1. 数据库模型扩展
| 改动 | 说明 |
|---|---|
| `schema.prisma` | 扩展 `DistributionPlatform` enum 添加新平台 |
| | 添加 `publishMode` (MANUAL/AUTO) |
| | 添加 `autoPublishOn` 触发条件 |

#### 2. 新增平台支持
| 平台 | 类型 | 说明 |
|---|---|---|
| 百家号 | 内容平台 | 百度百家号文章分发 |
| 抖音/头条号 | 内容平台 | 字节跳动内容平台 |
| 小红书 | 内容平台 | 笔记分发（仅手动） |
| 字节扣子 (Coze) | AI智能体 | 知识库文档上传 |
| 百度文心 | AI智能体 | 知识库文档上传 |
| 腾讯元宝 | AI智能体 | AI 智能体 |
| 钉钉 | AI智能体 | 群消息推送 |
| 百度搜索 | 搜索引擎 | URL 主动推送 |
| 搜狗搜索 | 搜索引擎 | URL 提交 |
| 360搜索 | 搜索引擎 | URL 提交 |
| 神马搜索 | 搜索引擎 | URL 提交 |
| 引用站点 | 引用收录 | 新闻源/媒体平台 |
| 收录站点 | 引用收录 | 导航站/目录站 |

#### 3. 发布模式
- **手动发布 (MANUAL)**: 用户手动触发分发
- **自动发布 (AUTO)**: 审核通过/发布后自动分发

#### 4. 新增文件
- `src/lib/distribution/platforms.ts` - 平台定义
- `src/lib/distribution/adapters/base.ts` - 适配器基类
- `src/lib/distribution/adapters/zhihu.ts`
- `src/lib/distribution/adapters/wechat.ts`
- `src/lib/distribution/adapters/search.ts` - 搜索引擎提交
- `src/lib/distribution/adapters/ai.ts` - AI 智能体
- `src/lib/distribution/adapters/content.ts` - 内容平台
- `src/lib/distribution/adapters/index.ts` - 适配器注册表
- `src/workers/distributionWorker.ts` - 分发 worker
- `src/app/api/distribution/route.ts` - 分发 API
- `src/app/content/distribution/page.tsx` - 分发管理页面（重写）


---

## 本次会话完成 (2026-06-13 下午 - 第二部分)

### 1. 分发功能完善

#### 分发历史页面
- `src/app/content/distribution/history/page.tsx` - 新增
  - 分发历史列表（支持按状态/平台筛选）
  - 统计数据（总数/成功/失败/成功率）
  - 平台分布统计

#### 分发历史 API
- `src/app/api/projects/[projectId]/distribution-logs/route.ts` - 新增

### 2. 任务看板

#### 看板页面
- `src/app/tasks/board/page.tsx` - 新增
  - 5 列 Kanban 布局（待办/进行中/待审核/已完成/已忽略）
  - 拖拽更新任务状态
  - 按优先级排序
  - 统计概览（总数/完成率/高优先级）

### 3. SEO 建议完善

#### 建议生成器
- `src/lib/seo/recommendations.ts` - 新增
  - 20+ 种 SEO 问题的详细建议
  - 每条建议包含：具体步骤、代码示例、参考资料、预期收益
  - 按优先级和影响程度排序
  - 支持创建优化任务

#### 建议 API
- `src/app/api/audits/[id]/recommendations/route.ts` - 新增
  - `GET /api/audits/[id]/recommendations` - 获取建议列表
  - `POST /api/audits/[id]/recommendations` - 创建优化任务

#### 审计详情页面增强
- `src/app/audits/[id]/page.tsx` - 更新
  - 一键生成优化任务按钮
  - 支持选择优先级（仅高/中高低）
  - 任务创建结果反馈


---

## 本次会话完成 (2026-06-13 下午 - 第三部分)

### 视觉迭代优化升级

#### 1. 全局样式增强
- `src/app/globals.css` - 新增视觉增强样式
  - 增强进度条动画（shimmer 效果）
  - 增强状态指示器（脉冲发光动画）
  - 悬浮高亮效果
  - 数字滚动动画
  - 渐变边框效果
  - 快捷入口卡片动画
  - 标签切换组件
  - 增强输入框样式

#### 2. 新增 UI 组件
| 文件 | 说明 |
|---|---|
| `src/components/ui/StatCard.tsx` | 增强统计卡片组件（含进度条、趋势指示） |
| `src/components/ui/QuickAction.tsx` | 快捷操作卡片组件 |
| `src/components/ui/DataTable.tsx` | 增强数据表格组件 |
| `src/components/ui/DashboardWidgets.tsx` | 仪表盘小部件（MiniChart、ScoreRing） |

#### 3. 页面视觉升级
| 文件 | 改动 |
|---|---|
| `src/app/dashboard/page.tsx` | 完全重写，使用新组件，增强视觉层次 |
| `src/app/tasks/board/page.tsx` | 增强看板视觉效果 |
| `src/components/layout/SidebarClient.tsx` | 增强侧边栏导航设计 |

#### 4. 视觉特性亮点
- **动画系统**：进度条 shimmer、状态脉冲、数字滚动、卡片悬浮
- **交互反馈**：增强 hover 效果、拖拽提示、进度环
- **视觉层次**：渐变边框、分组分隔线、金色点缀
- **组件系统**：StatCard、QuickAction、MiniChart、ScoreRing

