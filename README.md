# GEO + SEO Search Visibility Console

公司内部自用的 **GEO + SEO 搜索可见度优化台**（v1.2 全栈运营系统 MVP）。

> **完整开发文档**：[`DEV_NOTES.md`](./DEV_NOTES.md)
> **设计文档**：`../Codex/2026-06-05/geo-seo/outputs/geo_seo_internal_tool_dev_doc_v1.2.md`

## 状态

- ✅ **M1 项目初始化 + 鉴权**（已实现）
- ✅ **M2 页面诊断**（已实现，8+ 项 SEO 规则）
- ✅ **M3 关键词 / GEO 问题 / 品牌 / 竞品**（已实现）
- ✅ **M4 GEO 监测 + 调度 + 告警**（已实现，含 LLM fallback）
- ✅ **M5 优化任务**（已实现）
- ✅ **M6 报告 + 仪表盘 + 审计**（已实现，含周报/月报/审计日志查看器）
- ✅ **M7 Docker 部署**（web + worker 双镜像，docker-compose 一键起）
- ✅ **M8 AI 内容生成 / 改写 / 关键词扩展**（已实现，MiniMax M3 实测跑通）
- ✅ **M9 CMS 集成 + 审核工作流**（已实现，自建 REST 适配器 + mock 模式）
- ✅ **M10 跨平台分发**（已实现，知乎/微信/飞书/Notion/Webhook 5 渠道）
- ✅ **M11 品牌监控 + 协作**（已实现，DuckDuckGo 扫描 + 评论 + 通知）

**测试覆盖率**：75 个单测 + 9 个 E2E 全过；TypeScript 0 错误。

## 技术栈

- **前端**：Next.js 14 (App Router) + TypeScript + React 18 + Tailwind CSS
- **后端**：Next.js API Routes + Server Actions
- **数据库**：PostgreSQL 15+（27 个 model + 13 个 enum，v1.2）
- **缓存 / 队列**：Redis 7 + BullMQ
- **鉴权**：NextAuth.js v5 + Credentials Provider + JWT + bcryptjs
- **LLM**：MiniMax M3（默认） / DeepSeek / OpenAI / Anthropic / Google / Ollama / 自定义 HTTP
- **真实 AI 搜索**：Perplexity / Kimi / 豆包（+ LLM fallback）
- **爬虫**：Playwright（带性能指标）+ fetch + cheerio
- **富文本**：TipTap v2.5（内容草稿）
- **任务队列**：BullMQ 7 个 worker 并发

## 5 分钟跑通

### 前置依赖

- Node.js 20+
- pnpm 10+
- Docker + Docker Compose

### 1. 装依赖

```bash
pnpm install
```

### 2. 准备环境变量

```bash
cp .env.example .env
```

最少必须填的：
```bash
DATABASE_URL="postgresql://geo_seo:geo_seo_dev@localhost:5434/geo_seo"
REDIS_URL="redis://localhost:6380"
AUTH_SECRET="<32 字节随机 hex，用 `openssl rand -hex 32` 生成>"
LLM_BASE_URL="https://api.minimaxi.com/v1"  # MiniMax 订阅版
LLM_API_KEY="sk-cp-..."
```

### 3. 起 PostgreSQL + Redis（Docker）

```bash
docker compose up -d postgres redis
```

默认端口映射到 host：
- PostgreSQL: `localhost:5434`（容器内 5432）
- Redis: `localhost:6380`（容器内 6379）

> **端口选择原因**：避开 5432/6379/3000-3005 的常见冲突。

### 4. 初始化数据库

```bash
pnpm prisma:generate
pnpm prisma:migrate         # 跑 migration
pnpm prisma:seed            # 创建 ADMIN 账号 + 示例项目
```

### 5. 启动 Web

```bash
pnpm dev
# → http://localhost:3010
```

### 6. 启动 Worker（另一个终端）

```bash
pnpm worker
# → BullMQ consumers: pageAudit / geoRun / contentAnalysis / report / scheduler / retention / cmsPublish
```

Worker 负责：
- 异步处理页面诊断、GEO 监测、内容生成、报告
- 每分钟心跳 + 每日 00:30 自动跑 GEO 监测、09:00 告警汇总、每月 1 日 03:00 清理过期数据
- 每 6 小时自动跑品牌监控

### 7. 登录

打开 http://localhost:3010，用：

```
email:    admin@example.com
password: Admin@2026
```

⚠️ **生产环境请立刻修改 ADMIN 密码。**

## 端口总览

| 服务 | 容器内 | Host 端口 | 用途 |
|---|---|---|---|
| Next.js (web) | 3000 | **3010** | 前端 + API |
| Worker | - | - | BullMQ 消费者 |
| PostgreSQL | 5432 | **5434** | 数据库 |
| Redis | 6379 | **6380** | 缓存 + 队列 |
| MailHog (dev) | 1025/8025 | - | 邮件预览 |

## 常用命令

```bash
# 开发
pnpm dev                # Next.js dev server
pnpm worker             # Worker process

# 数据库
pnpm prisma:generate    # 生成 Prisma client
pnpm prisma:migrate     # 跑 migration（dev）
pnpm prisma:deploy      # 跑 migration（prod）
pnpm prisma:seed        # 跑 seed
pnpm prisma:studio      # 打开 Prisma Studio（可视化）

# 测试 / 质量
pnpm test               # 全部测试（单测 + E2E）
pnpm test:watch         # watch 模式
pnpm typecheck          # tsc --noEmit
pnpm lint               # next lint

# 端到端
pnpm dev                # 终端 1
pnpm worker             # 终端 2
pnpm test tests/e2e     # 终端 3（需 .env 含 LLM_API_KEY）
```

## 关键功能流（端到端）

### 1. 页面诊断

```
用户填 URL → POST /api/projects/:id/audits
  → 调 pageAuditWorker（同步模式 / 队列模式）
    → crawlPage() 抓取（Playwright 优先，fetch fallback）
    → analyzeSeo() 13 项规则检查
    → 写 Page + PageAudit
    → 写 audit log
  → 返回 { score, findings, recommendations }
```

### 2. GEO 监测

```
00:30 cron 触发 scheduler
  → 查所有 ACTIVE + geoDailyEnabled 项目
  → 错峰入队 geoRunQueue
    → geoRunWorker 消费
      → 遍历项目 GEO 问题
        → channel.ts 调度（真实渠道优先，LLM fallback）
          → RealSearchProvider.search()（perplexity/kimi/doubao/llm_simulation）
          → llm 解析答案（JSON 提取 brand/competitor 提及）
        → 写 GeoRun + GeoRunResult + LlmCall
      → 失败告警（飞书/企微/邮件）
  → 09:00 跑 daily summary
  → 7 天滚动窗口算 GEO 评分
```

### 3. AI 内容生成

```
用户填主题 + 关键词 → POST /api/projects/:id/drafts/generate
  → 调 LLM（MiniMax M3）
    → system: 内容生成 prompt（Markdown 格式）
    → user: topic + target keywords
  → 解析 LLM 输出
  → 写 ContentDraft (status=DRAFT) + ContentRevision (v1)
  → 返回 { draftId, content }
```

### 4. 内容审核 → 发布

```
DRAFT → 编辑 → PENDING_REVIEW
  → ADMIN/MEMBER（reviewerId）审批
    → APPROVED / REJECTED
  → 选 CMS 集成 → publish
    → cmsPublisherWorker 调 cmsAdapter.createArticle
    → 写 PublishLog（含 externalId/URL）
    → 失败重试 5 次（指数退避）
```

### 5. 跨平台分发

```
APPROVED 草稿 → 选分发目标
  → 写 DistributionLog
  → 调对应分发器（知乎 / 微信 / 飞书 / Notion / Webhook）
  → 记录 externalId / externalUrl
```

### 6. 品牌监控

```
scheduler 每 6h 触发
  → 对每个项目跑 monitorBrand()
    → DuckDuckGo 搜品牌 + 竞品
    → 关键词情感分析
    → 写 BrandMention
```

## 关键路径与文件

| 文件 | 职责 |
|---|---|
| `src/middleware.ts` | 路由级权限校验（edge runtime，getToken） |
| `src/lib/auth.ts` | NextAuth.js v5 + 项目级权限 |
| `src/lib/audit/logger.ts` | 审计日志写入 |
| `src/lib/queue.ts` | BullMQ + ioredis 连接 + 7 个队列 |
| `src/lib/llm/tracker.ts` | LLM 调用追踪（成本 + 时长） |
| `src/lib/geo/channel.ts` | GEO 渠道调度（智能跳过无 key 渠道） |
| `src/lib/search/index.ts` | RealSearchProvider 注册 + `getAvailableChannels()` |
| `src/workers/index.ts` | Worker 进程入口（启动所有 worker + 品牌监控定时器） |
| `src/workers/geoRunWorker.ts` | GEO 监测消费者 |
| `src/workers/pageAuditWorker.ts` | 页面诊断消费者 |
| `src/workers/schedulerWorker.ts` | 每日调度 + 告警汇总 |
| `src/workers/retentionWorker.ts` | 数据保留清理 |
| `src/prisma/schema.prisma` | 27 个 model + 13 个 enum |
| `src/app/api/audit-log/route.ts` | 审计日志查询 API |

## 端到端测试覆盖

`tests/e2e/` 下：

- `geo-run-flow.test.ts`：登录 → 创建关键词/问题/品牌 → 触发 GEO run → 等 worker 完成 → 验证落库 + metrics + 审计日志

**前提**：需启动 `pnpm dev` + `pnpm worker`，且 `.env` 中 `LLM_API_KEY` 已配置。

## 故障排查速查

| 现象 | 排查 |
|---|---|
| 登录失败 | 查 `redis-cli GET signin:fail:<email>` 看失败计数 |
| GEO run 卡住 | `tail -f /tmp/worker.log`；检查渠道是否有 key |
| LLM 调用 500 | 检查 `LLM_API_KEY` + `LLM_BASE_URL` 是否正确（DNS 解析） |
| 页面 404 | 检查路由文件是否在 `src/app/<path>/page.tsx` |
| 数据库连接失败 | `docker compose ps` + `DATABASE_URL` 端口 |
| 审计日志没记录 | 检查 `audit()` 调用是否带 try/catch（logger 失败不阻塞主流程） |

详见 [`DEV_NOTES.md` 第 9 节](./DEV_NOTES.md#9-故障排查)。

## 配套文档

- `DEV_NOTES.md`：开发笔记（接手必读，1053 行）
- `../Codex/2026-06-05/geo-seo/outputs/geo_seo_internal_tool_dev_doc_v1.2.md`：完整设计文档（4844 行）
- `../Codex/2026-06-05/geo-seo/outputs/geo_seo_internal_tool_dev_doc_v1.1.md`：v1.1 历史（3968 行）
- `../Codex/2026-06-05/geo-seo/outputs/geo_seo_internal_tool_dev_doc.md`：v1.0 历史（1591 行）
