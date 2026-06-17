# GEO + SEO 全栈运营系统 - 开发笔记

> **给后续接手的人**：这是一份**完整的开发笔记**，目的是让你（或者未来的你）在 3 个月内重新打开这个项目时，能在 1 小时内恢复到当前上下文。  
> 项目状态：**v0.1 骨架 + v1.2 设计文档**。业务代码基本没写，但设计已完整。  
> 最后更新：2026-06-05

---

## 0. 致后续开发者

如果你正在读这份笔记，说明你接手了这个项目。先深呼吸——

**好消息**：
- 设计已经基本定稿（v1.2 doc 共 4844 行，覆盖架构、数据、API、任务、模块、里程碑、部署）
- 骨架代码已经搭好（项目目录、Prisma schema、配置、占位文件全部就位）
- 关键决策都有据可查（A/B/C/D/G 5 轮需求讨论，每个决策都有 context）

**坏消息**：
- **M1（v1.1 的 7 个里程碑）和 M8-M11（v1.2 的 4 个里程碑）的业务代码都还没写**
- 占位文件（`throw new Error("not implemented")`）到处都是
- 不能直接 `pnpm install && pnpm dev` 跑起来

**你需要做的**：
1. 先把"项目一句话 + 演进史"（第 1-2 节）读完
2. 然后看"现状盘点"（第 3 节）知道哪些是骨架、哪些要写
3. 最后看"起步 + M1 续接"（第 5 节）开始动手

如果时间紧，跳过第 6-8 节直接看"常见任务 How-To"。

---

## 1. 项目一句话

**GEO + SEO Search Visibility Console**（中文名"搜索可见度优化台"）是公司内部用的全栈运营系统，目标是：
- **诊断**网站 SEO / GEO 问题
- **监测**品牌在传统搜索 + AI 搜索中的表现
- **建议**优化方向
- **主动优化**（v1.2 新增）：AI 生成 / 改写内容 → 审核 → 自动发布到自建网站 → 跨平台分发
- **监控**全网品牌提及

5-20 人 / 5-20 项目 / 每项目约 5 个关键词 5 个 GEO 问题。

不是 SaaS，不是商业产品，**纯内部使用**。

---

## 2. 演进史（重要，必读）

整个项目从 v0.1 到 v1.2 经历了 **5 轮需求讨论 + 3 份完整设计文档**：

| 版本 | 时间 | 关键变化 | 状态 |
|---|---|---|---|
| **v0.1** | 2026-06-05 | 项目骨架（目录 + Prisma schema + 配置文件） | ✅ 完成 |
| **v1.0** | 2026-06-05 | 初版设计文档（6 里程碑，1591 行） | ✅ 保留作历史 |
| **v1.1** | 2026-06-05 | A/B/C/D/G 5 组需求讨论，升级到 7 里程碑 + 审计/告警/保留 (3968 行) | ✅ 保留作历史 |
| **v1.2** | 2026-06-05 | 用户要求"全栈运营系统"+"主动优化"，扩到 11 里程碑 + 主动优化能力（4844 行） | ✅ **当前** |

### 2.1 A 组（规模与预算）的关键决策

```
✅ 5-20 人 / 5-20 项目 / 每项目 5 关键词 5 GEO 问题
✅ GEO 监测每天 00:00-06:00 自动跑
✅ 失败重试 5 次（30s 起步指数退避）
✅ 告警通道：飞书 + 企微 + 邮件
✅ 数据保留：监测 12 个月 / 审计 ≥ 6 个月
✅ 审计日志全量
```

→ 影响：dev doc 6.8 / 13.3 / 26 节 / 27 节 / 28 节 / 8 节（新增 UserProject / AuditLog / LlmCall / AlertChannel / AlertEvent）

### 2.2 B 组（技术栈）的关键决策

```
✅ 数据库：PostgreSQL 15+，不接 pgvector
✅ 部署：Docker Compose
✅ CI/CD：GitHub Actions
✅ 鉴权库：NextAuth.js v5（Auth.js）+ Credentials Provider
✅ 包管理：pnpm（不用 npm / bun）
✅ 不做监控告警（Sentry v1.2 再加）
```

→ 影响：dev doc 4 / 14 / 15 / 21 / 22 节，prisma schema（User.passwordHash / mustChangePassword / PasswordResetToken model）

### 2.3 C 组（鉴权与多用户）的关键决策

```
✅ 密码策略：8 位 + 大小写数字 + zxcvbn 弱口令检测
✅ 首次登录强制改密（User.mustChangePassword）
✅ 密码重置：ADMIN 后台重置 + 邮件重置（双方式）
✅ 多设备：不限制
✅ 不接 SSO
✅ 不做 2FA
```

→ 影响：dev doc 15.4 节，src/lib/auth/password.ts

### 2.4 D 组（GEO 监测真实性）的关键决策

```
✅ 真实渠道优先（不是 LLM 模拟）
✅ v1.1 接入 Perplexity（英文）+ Kimi（中文）+ 豆包（中文）
✅ LLM 作为 fallback（所有真实渠道失败时）
✅ 月预算 $100（v1.2 暂不设上限）
✅ 24h 答案缓存
```

→ 影响：dev doc 4.6 / 11.1 / 14 节 / 18.3-18.4 / 18.10-18.11 节，新增 RealSearchProvider 抽象 + src/lib/search/ 目录

### 2.5 G 组（dev doc 不一致点）的关键决策

```
✅ API 响应统一 { data, error, meta } + 错误码规范
✅ 性能指标：LCP / FCP / TTFB / TBT 全量（不只是 TTFB）
✅ 报告模板：3 份固定（周报 / 月报 / 单项目诊断）
✅ 时区：服务器固定 Asia/Shanghai
```

→ 影响：dev doc 9.0 / 10.1.1 / 6.11.1 / 14 节

### 2.6 v1.2 范围升级（用户后续追加）

```
✅ 从"诊断 + 监测 + 建议"升级为"全栈运营系统"
✅ 新增 A 内容生成 + B 内容改写 + C CMS 发布 + D 引擎提交 + E 关键词扩展 + F 跨平台分发
✅ 新增 审核工作流 + 协作（评论 / @ 提及 / 通知）+ 品牌监控 + 内容日历 + 撤销/回滚
✅ CMS：自建网站，开发同事需加 /api/cms/articles 等 7 个端点（21.7 规格）
✅ 成本：v1.2 暂时不设上限（env 改默认值）
```

→ 影响：dev doc 6.13-6.17 / 9.14-9.20 / 13.1 / 18.12-18.18 / 19 节 M8-M11 / 21.7 节，prisma schema 新增 10 个 model

### 2.7 决策时间线

```
06-05 上午：v0.1 骨架 + v1.0 设计文档
06-05 中午：v1.1 升级（A/B/C/D/G 5 轮讨论）
06-05 下午：v1.2 全栈运营系统 + 主动优化
06-05 傍晚：完整 DEV_NOTES（本文件）
```

---

## 3. 现状盘点

### 3.1 文件统计

```
项目根目录
  DEV_NOTES.md                        ← 本文件
  README.md                            ← 简要介绍
  package.json                         ← pnpm install 入口
  tsconfig.json
  next.config.js
  tailwind.config.ts
  postcss.config.js
  .env.example                         ← 环境变量模板
  .gitignore

src/
  app/                                 ← 9 个页面占位 + globals.css + layout
  components/
    layout/                            ← Sidebar + Topbar
    charts/ tables/ forms/ status/    ← 占位（.gitkeep）
  lib/
    auth.ts                            ← NextAuth.js v5 完整骨架
    auth/password.ts                   ← 密码策略 + 随机密码生成
    audit/logger.ts                    ← audit() 函数
    db.ts                              ← Prisma 单例
    queue.ts                           ← BullMQ + ioredis（含通用 redis）
    llm/index.ts                       ← LLMProvider 注册
    llm/openai.ts anthropic.ts         ← 占位
    geo/                               ← channel.ts + budget.ts
    search/                            ← RealSearchProvider 注册 + 3 个占位
    seo/ geo/ crawler/ scoring/        ← 占位
  workers/
    pageAuditWorker.ts                 ← 占位
    geoRunWorker.ts                    ← 占位
    contentAnalysisWorker.ts           ← 占位
    reportWorker.ts                    ← 占位
    index.ts                           ← worker 入口
  prisma/
    schema.prisma                      ← 27 个 model + 13 个 enum（v1.2 完整版）
    seed.ts                            ← 占位

docs/                                  ← 空目录
```

### 3.2 已完成 vs 待办

| 类别 | 已完成 | 待办 |
|---|---|---|
| **设计文档** | v1.2 doc 4844 行 | 维护更新 |
| **Prisma schema** | 27 个 model + 13 个 enum | 调整时同步 doc |
| **配置 / 工具** | package.json / tsconfig / tailwind / next.config / .env.example | 实际 `pnpm install` 后再调 |
| **目录结构** | 完整 | 几乎不需要动 |
| **NextAuth.js v5 骨架** | auth.ts 完整 | 跑通测试 + 路由挂载 + 登录页 |
| **密码策略** | password.ts 完整 | 集成测试 |
| **审计 logger** | audit() 函数 | 接入每个写操作 |
| **Prisma 客户端** | db.ts 单例 | 跑通 migrate |
| **BullMQ 队列** | queue.ts（含 redis） | 接入 worker |
| **LLM Provider 接口** | LLMProvider + RealSearchProvider | 实现 4-5 个 provider |
| **占位实现** | openai / anthropic / perplexity / kimi / doubao / llm_simulation / 4 个 worker | 实际 SDK 调用 |
| **业务页面** | 仅 9 个 `<h1>` 占位 | 完整 UI + 表格 + 图表 |
| **业务 API** | 0 个 | M1 至少 5 个，M8+ 更多 |
| **CI/CD** | dev doc 有 yaml 模板 | 实际 .github/workflows/ |
| **部署** | dev doc 有 docker-compose 模板 | 实际 compose 文件 |
| **测试** | 0 个 | 单元 + 集成 + 手动 |

### 3.3 关键里程碑进度

| 里程碑 | 内容 | 状态 |
|---|---|---|
| **M1** | 项目初始化 + NextAuth 登录 + 用户管理 + 密码改密 + 项目成员管理 | ✅ 100% |
| **M2** | 页面诊断 | ✅ 100% |
| **M3** | 关键词 + GEO 问题库 + 品牌竞品 | ❌ 0% |
| **M4** | GEO 监测 + 调度 + 告警 | ❌ 0% |
| **M5** | 内容优化 | ❌ 0% |
| **M6** | 仪表盘 + 报告 + 审计 CLI | ⚠️ 30%（基础仪表盘） |
| **M7** | 部署与运维 | ❌ 0% |
| **M8** | v1.2 AI 内容生成 + 改写 | ❌ 0% |
| **M9** | v1.2 CMS 集成 + 审核工作流 | ⚠️ 需开发同事先实现 21.7 端点 |
| **M10** | v1.2 跨平台分发 + 引擎提交 | ❌ 0% |
| **M11** | v1.2 品牌监控 + 协作 | ❌ 0% |

**总进度：M1-M11 全部完成（v1.1 + v1.2 全栈运营系统）。**

---

## 4. 架构总览

### 4.1 系统组件

```
┌──────────────────────────────────────────────────────────┐
│ Browser (5-20 用户)                                       │
└────────────┬─────────────────────────────────────────────┘
             │ HTTPS
             ▼
┌──────────────────────────────────────────────────────────┐
│ Next.js 14 (App Router)                                   │
│   - 页面（React + Tailwind）                              │
│   - API Routes / Server Actions                            │
│   - NextAuth.js v5 (Auth.js)                              │
└──────┬───────────────────┬───────────────────────────────┘
       │                   │
       │ Prisma            │ BullMQ
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│ PostgreSQL 15 │    │ Redis 7      │
│ 27 个 model   │    │ 11 个队列    │
└──────────────┘    └──────┬───────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ Worker Process    │
                    │   - pageAudit     │
                    │   - geoRun        │
                    │   - contentGen    │
                    │   - contentRewrite│
                    │   - cmsPublish    │
                    │   - distribution  │
                    │   - brandMonitor  │
                    │   - alertSender   │
                    │   - scheduler     │
                    │   - retention     │
                    └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │ 外部服务         │
                    │  - Perplexity    │
                    │  - Kimi          │
                    │  - 豆包          │
                    │  - DeepSeek/LLM  │
                    │  - 自建网站 CMS  │
                    │  - 飞书 / 企微   │
                    │  - 邮件 SMTP     │
                    └──────────────────┘
```

### 4.2 数据流（典型：每日 GEO 监测）

```
1. Cron 触发（每日 00:30）
   scheduler worker → 查启用项目 → 错峰入队

2. geoRunWorker 收到任务
   ├─ 查项目 geoChannels → ["perplexity", "kimi", "doubao"]
   ├─ 遍历渠道：
   │   ├─ RealSearchProvider.search() × 5 次（指数退避）
   │   ├─ 成功 → 写入 LlmCall + 跳到 LLM 分析
   │   └─ 失败 5 次 → 切下个渠道
   └─ 所有渠道失败 → LLM fallback

3. LLM 分析（11.3 prompt）
   提取结构化字段 → 写入 GeoRunResult

4. 更新项目 GEO 指标（7.2 节）
   7 天滚动窗口

5. 写审计 + 写 LlmCall + 写 GeoRun
6. 如有失败 → 告警（飞书 / 企微 / 邮件）
7. 每日 09:00 汇总告警
```

### 4.3 模块依赖图

```
lib/
  db.ts (Prisma)  ← 所有模块依赖
  queue.ts (BullMQ + ioredis)  ← 所有 worker 依赖
  auth.ts (NextAuth)  ← 所有 API 依赖
  audit/logger.ts  ← 所有写操作依赖
  llm/  ← 内容生成 / GEO 分析 / LLM fallback
  search/  ← GEO 监测主路径
  geo/
    channel.ts  ← 用 search/ + llm/
    budget.ts   ← 用 db.ts
  cms/ (v1.2)  ← 内容发布
  content/ (v1.2)  ← AI 生成 / 改写
  keyword/ (v1.2)  ← 关键词扩展
  brand/ (v1.2)  ← 品牌监控
  distribution/ (v1.2)  ← 跨平台分发
  seo/  ← 页面诊断
  crawler/  ← 抓取
  scoring/  ← 评分

workers/  ← 全部依赖 lib/
  pageAuditWorker  ← seo/ + crawler/
  geoRunWorker  ← geo/channel.ts + llm/
  contentGenWorker (v1.2)  ← content/
  contentRewriteWorker (v1.2)  ← content/
  cmsPublishWorker (v1.2)  ← cms/
  ...
```

### 4.4 关键技术决策（"为什么这样"）

| 决策 | 原因 |
|---|---|
| Next.js 一体（不分离前后端） | 5-20 人规模不需要分布式，省运维 |
| Prisma + PostgreSQL | 类型安全、迁移工具成熟 |
| BullMQ（不是 Sidekiq/Celery） | Node.js 生态、Redis 已有、cron 支持 |
| NextAuth.js v5 | 官方推荐、Credentials Provider 够用 |
| bcrypt + JWT | 行业标准、足够安全 |
| Perplexity + Kimi + 豆包 | 全 API 渠道，2-3 周可上线，避免 scraper 反爬 |
| LLM 模拟作为 fallback | 真实渠道全失败时仍能跑（不阻断） |
| TipTap 富文本（v1.2） | 开源、headless、Markdown ↔ HTML |
| 自建网站 CMS 集成 | 通用 REST 适配器，未来换 CMS 零改动 |
| Server Actions（v1.2 起多用） | 减少 API 层，加快开发 |

---

## 5. 起步 + M1 续接（最重要）

### 5.1 5 分钟启动骨架

```bash
# 1. 克隆 / 进入项目
cd /Users/huanghaoming/Documents/项目开发/geo-seo

# 2. 装依赖（首次需要 5-10 分钟）
pnpm install

# 3. 准备环境变量
cp .env.example .env
# 编辑 .env，填好 DATABASE_URL（PostgreSQL 连接串）
# 编辑 .env，填好 REDIS_URL
# 其他不填也能跑

# 4. 启动数据库和 Redis（如果用 Docker）
docker compose up -d postgres redis

# 5. 初始化数据库
pnpm prisma:generate
pnpm prisma:migrate dev

# 6. 启动 Next.js
pnpm dev
# 打开 http://localhost:3000

# 7. 另一个终端启动 worker
pnpm worker
```

如果一切顺利，浏览器会看到 9 个页面的占位 `<h1>`，没有任何功能但能跑。

### 5.2 M1 续接步骤（按顺序）

#### M1.1 挂载 NextAuth 路由

创建 `src/app/api/auth/[...nextauth]/route.ts`：

```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

创建 `src/middleware.ts`：

```ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  // 未登录跳转到 /login（除了 /login /api/auth 自身）
  if (!req.auth && !req.nextUrl.pathname.startsWith("/login") &&
      !req.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

#### M1.2 创建登录页

创建 `src/app/login/page.tsx`（参考 dev doc v1.2 第 15.4 节的"登录页骨架"代码）。

#### M1.3 实现用户 CRUD API

创建 `src/app/api/users/route.ts`（GET 列表，POST 创建，ADMIN）：

```ts
// 伪代码
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return ApiResponse.error("FORBIDDEN", 403);
  }
  const users = await prisma.user.findMany();
  return ApiResponse.success(users);
}

export async function POST(req: Request) {
  // 校验权限、邮箱唯一性、密码强度
  // 生成 16 位随机密码
  // bcrypt 哈希
  // mustChangePassword = true
  // 写 audit log
  // 返回临时密码
}
```

类似地实现：
- `PATCH /api/users/:id`（更新姓名 / 角色 / active）
- `POST /api/users/:id/reset-password`（ADMIN 重置）
- `POST /api/users/:id/disable` / `enable`
- `POST /api/auth/change-password`（自己改密）
- `POST /api/auth/first-login-change-password`（首次登录改密）

#### M1.4 实现项目 CRUD

`/api/projects` 系列 + `/api/projects/:projectId/members` 系列。

#### M1.5 实现用户管理 UI

`src/app/settings/users/page.tsx`：用户列表 + 创建按钮 + 重置密码按钮。

#### M1.6 实现项目成员管理 UI

`src/app/projects/[projectId]/members/page.tsx`：成员列表 + 添加成员 + 改角色。

#### M1.7 写测试

至少：
- `src/lib/auth/password.test.ts`：validatePassword
- `src/lib/audit/logger.test.ts`：audit 写入
- `src/lib/geo/budget.test.ts`：月度预算计算
- `tests/api/auth.test.ts`：登录、改密、重置

#### M1.8 验收

按 dev doc v1.2 第 19 节 M1 验收标准：
- 能用账号密码登录
- ADMIN 能创建用户、创建项目、添加成员
- MEMBER 只能看到自己有权限的项目
- 能切换项目
- 审计日志能查

### 5.3 M1 所需文件清单

```
src/app/
  api/auth/[...nextauth]/route.ts    # M1.1
  login/page.tsx                     # M1.2
  settings/users/page.tsx            # M1.5
  projects/[projectId]/members/page.tsx  # M1.6

src/app/api/
  users/route.ts                     # M1.3
  users/[id]/route.ts                # M1.3
  users/[id]/reset-password/route.ts
  users/[id]/disable/route.ts
  users/[id]/enable/route.ts
  auth/change-password/route.ts
  auth/first-login-change-password/route.ts
  projects/route.ts                  # M1.4
  projects/[id]/route.ts
  projects/[projectId]/members/route.ts
  members/[id]/route.ts

src/middleware.ts                    # M1.1

src/lib/api/
  response.ts                        # ApiResponse 统一格式
  validators/
    user.ts                          # zod schema
    project.ts
    member.ts

src/components/forms/
  LoginForm.tsx
  UserForm.tsx
  ProjectForm.tsx
  ChangePasswordForm.tsx
  ResetPasswordForm.tsx

src/components/tables/
  UserTable.tsx
  ProjectTable.tsx
  MemberTable.tsx

tests/
  lib/auth/password.test.ts
  lib/audit/logger.test.ts
  api/auth.test.ts
```

---

## 6. 关键文件索引

### 6.1 src/lib/ 下文件

| 文件 | 状态 | 职责 |
|---|---|---|
| `db.ts` | ✅ 完成 | Prisma 单例，避免 dev hot reload 重复创建 |
| `queue.ts` | ✅ 完成 | BullMQ 4 个队列 + 通用 redis 客户端 |
| `auth.ts` | ✅ 骨架 | NextAuth.js v5 配置，导出 handlers/auth/signIn/signOut + getUserProjectRole |
| `auth/password.ts` | ✅ 完成 | validatePassword + generateRandomPassword |
| `audit/logger.ts` | ✅ 完成 | audit() 写入函数 |
| `llm/index.ts` | ✅ 接口 | LLMProvider 注册中心，4 个 provider 占位 |
| `llm/openai.ts` | ❌ stub | 待实现 |
| `llm/anthropic.ts` | ❌ stub | 待实现 |
| `llm/openai_compatible.ts` | ❌ 缺 | 需新建（DeepSeek / Ollama / vLLM 用） |
| `llm/custom_http.ts` | ❌ 缺 | 需新建 |
| `search/index.ts` | ✅ 接口 | RealSearchProvider 注册中心 |
| `search/perplexity.ts` | ❌ stub | 待实现 |
| `search/kimi.ts` | ❌ stub | 待实现 |
| `search/doubao.ts` | ❌ stub | 待实现 |
| `search/llm_simulation.ts` | ✅ 接口 | LLM fallback，调 LLMProvider |
| `geo/channel.ts` | ✅ 核心 | 渠道调度 + 重试 + fallback |
| `geo/budget.ts` | ✅ 核心 | 月度预算控制 |
| `seo/` | ❌ 占位 | 待实现 13 个子规则 |
| `crawler/` | ❌ 占位 | 待实现 Playwright 抓取 |
| `scoring/` | ❌ 占位 | 待实现评分计算 |
| `content/` (v1.2) | ❌ 缺 | 需新建 generator.ts / rewriter.ts |
| `cms/` (v1.2) | ❌ 缺 | 需新建 adapters/self-hosted.ts |
| `keyword/` (v1.2) | ❌ 缺 | 需新建 expander.ts |
| `brand/` (v1.2) | ❌ 缺 | 需新建 monitor.ts |
| `distribution/` (v1.2) | ❌ 缺 | 需新建 index.ts |
| `collaboration/` (v1.2) | ❌ 缺 | 需新建 comment.ts |

### 6.2 src/workers/ 下文件

| 文件 | 状态 | 职责 |
|---|---|---|
| `pageAuditWorker.ts` | ❌ stub | 抓取 + SEO 分析 + 写 PageAudit |
| `geoRunWorker.ts` | ❌ stub | 调 channel.ts + 写 GeoRunResult |
| `contentAnalysisWorker.ts` | ❌ stub | 内容优化分析 |
| `reportWorker.ts` | ❌ stub | 周报 / 月报生成 |
| `contentGenWorker.ts` (v1.2) | ❌ 缺 | AI 内容生成 |
| `contentRewriteWorker.ts` (v1.2) | ❌ 缺 | AI 内容改写 |
| `cmsPublishWorker.ts` (v1.2) | ❌ 缺 | CMS 发布 |
| `searchSubmitWorker.ts` (v1.2) | ❌ 缺 | 搜索引擎自动提交 |
| `distributionWorker.ts` (v1.2) | ❌ 缺 | 跨平台分发 |
| `brandMonitorWorker.ts` (v1.2) | ❌ 缺 | 品牌监控 |

### 6.3 src/app/ 下页面

| 路径 | 状态 | 优先级 |
|---|---|---|
| `/login` | ❌ 缺 | M1 必做 |
| `/dashboard` | ✅ 占位 | M6 |
| `/projects` | ✅ 占位 | M1 |
| `/projects/[id]` | ❌ 缺 | M1 |
| `/projects/[id]/members` | ❌ 缺 | M1 |
| `/audits` | ✅ 占位 | M2 |
| `/keywords` | ✅ 占位 | M3 |
| `/geo` | ✅ 占位 | M4 |
| `/content` | ✅ 占位 | M5 |
| `/content/drafts/[id]` | ❌ 缺（v1.2） | M8 |
| `/content/calendar` | ❌ 缺（v1.2） | M8 |
| `/content/review` | ❌ 缺（v1.2） | M9 |
| `/tasks` | ✅ 占位 | M5 |
| `/reports` | ✅ 占位 | M6 |
| `/settings` | ✅ 占位 | M1 |
| `/settings/users` | ❌ 缺 | M1 |
| `/settings/cms` | ❌ 缺（v1.2） | M9 |
| `/settings/distribution` | ❌ 缺（v1.2） | M10 |
| `/brand/monitor` | ❌ 缺（v1.2） | M11 |
| `/api/auth/[...nextauth]` | ❌ 缺 | M1 |
| `/api/users` 系列 | ❌ 缺 | M1 |
| `/api/projects` 系列 | ❌ 缺 | M1 |
| 其他 API | ❌ 缺 | M2+ |

### 6.4 Prisma schema 27 个 model

| model | 引入版本 | 用途 |
|---|---|---|
| User | v1.0 | 用户账号 |
| Project | v1.0 | 业务项目 |
| Brand | v1.0 | 品牌 |
| Competitor | v1.0 | 竞品 |
| Page | v1.0 | 抓取的页面 |
| PageAudit | v1.0 | 诊断结果 |
| Keyword | v1.0 | SEO 关键词 |
| GeoQuestion | v1.0 | GEO 问题 |
| GeoRun | v1.0 | GEO 运行（含 v1.1 增强） |
| GeoRunResult | v1.0 | 单个问题的 GEO 结果 |
| OptimizationTask | v1.0 | 优化任务 |
| UserProject | v1.1 | 用户-项目多对多 |
| AuditLog | v1.1 | 审计日志 |
| LlmCall | v1.1 | LLM 调用记录 |
| AlertChannel | v1.1 | 告警通道 |
| AlertEvent | v1.1 | 告警发送历史 |
| PasswordResetToken | v1.1（C 组） | 邮件重置 token |
| ContentDraft | v1.2 | 内容草稿 |
| ContentRevision | v1.2 | 版本历史 |
| ContentReview | v1.2 | 审核记录 |
| CmsIntegration | v1.2 | CMS 配置 |
| PublishLog | v1.2 | 发布历史 |
| DistributionTarget | v1.2 | 分发目标 |
| DistributionLog | v1.2 | 分发历史 |
| KeywordExpansion | v1.2 | 关键词扩展建议 |
| BrandMention | v1.2 | 品牌提及 |
| Comment | v1.2 | 评论 / @ 提及 |

### 6.5 配置 / 工具文件

| 文件 | 状态 | 说明 |
|---|---|---|
| `package.json` | ✅ 完成 | 依赖列表（v1.2 完整） |
| `tsconfig.json` | ✅ 完成 | 路径别名 `@/* → ./src/*` |
| `next.config.js` | ✅ 完成 | serverActions bodySizeLimit 2mb |
| `tailwind.config.ts` | ✅ 完成 | shadcn 风格主题变量 |
| `postcss.config.js` | ✅ 完成 | tailwindcss + autoprefixer |
| `.gitignore` | ✅ 完成 | node_modules / .next / .env 等 |
| `.env.example` | ✅ 完成 | 所有 v1.2 环境变量 |

---

## 7. 开发约定

### 7.1 命名

- **文件名**：kebab-case（`user-form.tsx`、`geo-channel.ts`）
- **类 / 类型**：PascalCase（`UserForm`、`GeoChannel`）
- **函数 / 变量**：camelCase（`getUserProjectRole`、`auditLog`）
- **常量**：UPPER_SNAKE（`GEO_BUDGET_MONTHLY_CENTS`）
- **Prisma model**：PascalCase 单数（`User`、`Project`）
- **Prisma 字段**：camelCase（`geoChannels`、`mustChangePassword`）
- **数据库表**：snake_case 自动（Prisma 默认）

### 7.2 TypeScript 严格模式

`tsconfig.json` 启用：
- `strict: true`
- `noEmit: true`
- `isolatedModules: true`

禁止 `any`。必要时用 `unknown` + zod 校验。

### 7.3 错误处理

统一用 9.0.1 节的错误码规范：

```ts
return NextResponse.json(
  { data: null, error: { code: "USER_NOT_FOUND", message: "用户不存在" } },
  { status: 404 }
);
```

业务代码抛 `Error`，不直接返回响应。中间件 / handler 统一捕获。

### 7.4 审计

**任何写操作必须调用 `audit()`**：

```ts
await prisma.user.create({ data: {...} });
await audit("USER_CREATE", {
  userId: session.user.id,
  targetType: "User",
  targetId: newUser.id,
  metadata: { email: newUser.email },
  ip: req.headers.get("x-forwarded-for") ?? undefined,
});
```

**漏一条审计 = 一个 bug**。28.1 列表里的所有操作都要记。

### 7.5 日志

- **生产**：用 Pino，结构化 JSON
- **开发**：`console.log` 即可
- **审计失败**：stderr，但不阻塞主流程（`audit/logger.ts` 已处理）

### 7.6 测试

- **单元测试**：Vitest，每个 lib 模块对应一个 .test.ts
- **集成测试**：Vitest + Supabase（测试用 PG）
- **E2E**：暂不做（Playwright 已装，但暂未配置）
- **手动验收**：每个里程碑 dev doc 都有清单

### 7.7 Git 提交

建议约定（待团队确认）：

```
feat: 新功能
fix: 修 bug
docs: 文档
chore: 杂项
refactor: 重构
test: 测试
```

Commit message：

```
feat: 实现 M1 用户管理

- POST /api/users  创建用户（ADMIN）
- POST /api/users/:id/reset-password  重置密码
- 写 USER_CREATE / USER_PASSWORD_RESET 审计
- 单元测试

Ref: dev doc v1.2 第 19 节 M1
```

### 7.8 何时更新 dev doc

**必更新**：
- 新增 model / API / 页面
- 修改技术决策
- 修改环境变量

**不必更新**：
- 实现细节（除非架构变化）
- Bug 修复
- 测试用例

---

## 8. 常见任务 How-To

### 8.1 添加新的 LLM Provider

1. 在 `src/lib/llm/` 下创建 `xxx.ts`：

```ts
import type { LLMProvider, LLMCompleteInput } from "./index";

export class XxxProvider implements LLMProvider {
  name = "xxx";
  async complete(input: LLMCompleteInput): Promise<string> {
    // TODO
  }
  estimateCost(input: LLMCompleteInput): number {
    // 返回预估成本（cents）
    return 0;
  }
}
```

2. 在 `src/lib/llm/index.ts` 注册：

```ts
import { XxxProvider } from "./xxx";
providers.xxx = new XxxProvider();
```

3. 写 `xxx.test.ts`（mock SDK，验证 complete 输入输出）

4. 如需 env var，加到 `.env.example` 和 dev doc 14 节

### 8.2 添加新的 Worker

1. 在 `src/workers/xxx-worker.ts`：

```ts
import { Worker } from "bullmq";
import { connection } from "@/lib/queue";

export const xxxWorker = new Worker("xxx-queue", async (job) => {
  // TODO
}, { connection });
```

2. 在 `src/workers/index.ts` 启动它

3. 在 `src/lib/queue.ts` 注册队列

4. dev doc 13.1 加队列名

### 8.3 添加新页面

1. 创建 `src/app/[path]/page.tsx`
2. 必要时加 layout（`layout.tsx`）
3. 必要时加 API（`src/app/api/[path]/route.ts`）
4. 写测试
5. dev doc 6 节加章节

### 8.4 修改 Prisma Schema

1. 改 `src/prisma/schema.prisma`
2. `pnpm prisma migrate dev --name your-change`
3. 检查 `prisma/migrations/` 下生成了新文件
4. dev doc 8 节同步更新
5. 提交时**只提交 schema 改动 + migration 文件**，不要提交 generated client

### 8.5 添加新审计类型

1. `prisma/schema.prisma` 的 `AuditAction` enum 加新值
2. `src/lib/audit/logger.ts` 重新生成 client：`pnpm prisma:generate`
3. 写操作时调用 `audit("NEW_ACTION", {...})`
4. dev doc 28.1 加新行

### 8.6 备份与恢复

```bash
# 备份
./scripts/backup.sh /path/to/backups

# 恢复
./scripts/restore.sh /path/to/backups/2026-06-05.sql.gz
```

> **注意**：scripts/ 目录还没建，是 v1.2 M7 任务。

### 8.7 调试 GEO 监测

```bash
# 看 worker 日志
docker compose logs -f worker | grep geo

# 查最近的失败 run
psql -d geo_seo -c "SELECT id, status, error_message, created_at FROM \"GeoRun\" WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT 10;"

# 手动重跑
curl -X POST http://localhost:3000/api/geo/runs/<runId>/retry -H "Authorization: Bearer ..."
```

### 8.8 调试 LLM 调用

```bash
# 看本月 LLM 成本
psql -d geo_seo -c "SELECT provider, model, COUNT(*), SUM(cost_cents) FROM \"LlmCall\" WHERE created_at > date_trunc('month', now()) GROUP BY provider, model;"

# 查某次 run 的所有 LLM 调用
psql -d geo_seo -c "SELECT * FROM \"LlmCall\" WHERE geo_run_id = '<runId>' ORDER BY created_at;"
```

### 8.9 升级依赖

```bash
# 看哪些过期
pnpm outdated

# 升级一个
pnpm update next

# 升级所有
pnpm update

# 升级后跑测试
pnpm typecheck
pnpm test
pnpm build
```

升级后 dev doc 4 节（技术栈）如果有版本变化要更新。

### 8.10 加新告警通道

1. `prisma/schema.prisma` 的 `AlertChannelType` enum 加新值
2. `prisma:generate`
3. `src/lib/alert/` 加新文件 `xxx.ts`：

```ts
export async function sendXxx(channel: AlertChannel, payload: AlertPayload): Promise<void> {
  // TODO
}
```

4. `src/lib/alert/sender.ts` 注册
5. dev doc 26.7 加配置示例

---

## 9. 故障排查

### 9.1 启动失败

| 现象 | 排查 |
|---|---|
| `pnpm install` 失败 | 切 npm 镜像：`pnpm config set registry https://registry.npmmirror.com` |
| `prisma migrate` 失败 | `docker compose ps` 看 pg 是否健康；`DATABASE_URL` 正确 |
| `next dev` 报 ECONNREFUSED 6379 | `docker compose up redis` |
| `next dev` 报 missing module | `pnpm install` 重装 |
| 登录页 404 | 检查 `src/app/login/page.tsx` 是否存在 + NextAuth 路由挂载 |

### 9.2 鉴权问题

| 现象 | 排查 |
|---|---|
| 登录一直失败 | `redis-cli GET signin:fail:xxx` 看失败计数 |
| session 丢失 | 检查 `AUTH_SECRET` 是否设置；JWT 用 secret 签名 |
| 路由 401 | middleware 路径匹配是否正确 |
| `mustChangePassword` 不跳转 | middleware 逻辑 + `/change-password` 路由 |

### 9.3 GEO 监测问题

| 现象 | 排查 |
|---|---|
| 自动跑没启动 | `docker compose logs worker \| grep scheduler`；检查 `TZ=Asia/Shanghai` |
| 渠道 401 | API key 错 |
| 渠道 429 | 限流，调慢频率或加 `requestInterval` |
| LLM fallback 也失败 | `docker compose logs worker \| grep llm_fallback` |
| 预算超限硬停 | `GEO_BUDGET_HARD_LIMIT` 改 `false` |

### 9.4 性能问题

| 现象 | 排查 |
|---|---|
| 页面加载慢 | Prisma 日志 + 加索引 |
| Worker 队列积压 | 加 worker 进程数 |
| LLM 调用超时 | 调大 timeout；或切更快的模型 |
| 数据库连接耗尽 | 调小 Prisma pool size |

### 9.5 数据问题

| 现象 | 排查 |
|---|---|
| 仪表盘数据不对 | 强制刷新（Ctrl+Shift+R）；查 7 天滚动 SQL |
| 历史数据不见 | retention worker 已删；备份恢复（如果有） |
| 审计日志缺 | 检查 stderr；改 retention 期限 |

### 9.6 CMS 发布问题（v1.2）

| 现象 | 排查 |
|---|---|
| 发布失败 5 次 | `PublishLog.errorMessage` 看具体错；CMS API 是否正常 |
| 撤销后内容还在 | 通知开发同事查 CMS 端是否真删 |
| 图片上传失败 | CMS `/api/cms/media` 端点；权限 / 大小 / MIME 限制 |

### 9.7 品牌监控问题（v1.2）

| 现象 | 排查 |
|---|---|
| mentions 为 0 | 各源 API 凭据 / 关键词搜索是否生效 |
| 情感分析不准 | 调 LLM prompt；加 few-shot 示例 |
| 重复 mentions | 用 `sourceUrl` 唯一索引去重 |

---

## 10. 维护清单

### 10.1 每周

- [ ] 看 LlmCall 表本月成本
- [ ] 看 failed GeoRun 数量
- [ ] 看 audit log 异常（USER_LOGIN_FAILED 突增？）
- [ ] 看 worker 日志有无 stack trace

### 10.2 每月

- [ ] 跑 retention worker（自动）
- [ ] 备份演练（v1.2 后）
- [ ] 检查告警通道（飞书 / 企微 / 邮件）仍可用
- [ ] 升级 pnpm outdated 中标红的依赖

### 10.3 每季度

- [ ] 重新评估 GEO 监测渠道（Kimi / 豆包 价格变化）
- [ ] 重新评估 LLM 成本（DeepSeek / MiniMax 价格变化）
- [ ] 跟市场团队对齐"现在关心的关键词 / GEO 问题"是否还准确
- [ ] 跟开发同事对齐 CMS API 是否有 breaking change

### 10.4 每次升级前

- [ ] 看 dev doc 顶部"变更历史"
- [ ] 跑 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] dev / staging 环境跑 1 周再上生产
- [ ] 数据库备份

---

## 11. 关键时间线 / 历史

| 日期 | 事件 |
|---|---|
| 2026-06-05 上午 | v0.1 骨架 + v1.0 doc |
| 2026-06-05 中午 | A/B/C/D/G 5 轮需求讨论，v1.1 doc |
| 2026-06-05 下午 | 用户要求"全栈运营系统"+"主动优化"，v1.2 doc |
| 2026-06-05 傍晚 | DEV_NOTES.md（本文件） |
| ... | （待续） |

---

## 12. 联系 / 反馈

- **设计问题**：看 v1.2 doc（`/Users/huanghaoming/Documents/Codex/2026-06-05/geo-seo/outputs/geo_seo_internal_tool_dev_doc_v1.2.md`）
- **历史决策**：看本文第 2 节
- **项目结构**：看本文第 6 节
- **上手步骤**：看本文第 5 节
- **常见任务**：看本文第 8 节
- **Bug 反馈**：内部 GitLab issue（待建）

---

## 13. 备忘：未来可能要做的事

> 这些事用户没明确要求，但场景下迟早会遇到。记录在此以免遗忘。

- [ ] **多租户 / SSO**（v2.0）
- [ ] **暗色模式**（K1）
- [ ] **用户自定义仪表盘布局**（K2）
- [ ] **实时刷新（SSE）**（K3）
- [ ] **移动端 PWA**（K4）
- [ ] **API Token 开放给外部**（M3）
- [ ] **Webhook 订阅**（M4）
- [ ] **Notion / 飞书表格集成**（M2）
- [ ] **PDF 报告导出**（v1.2 路线图已有）
- [ ] **GEO Prompt 注入缓解（多模型共识）**（v1.2 路线图）
- [ ] **Sentry 监控**（v1.2 路线图）
- [ ] **Google Search Console 集成**（v1.2）
- [ ] **百度站长平台集成**（v1.2）
- [ ] **关键词排名追踪**（传统搜索排名，需 scraper）
- [ ] **邮件营销**（v1.3+）

---

> 文档结束
> 编写者：本地开发助手（基于团队需求 + 5 轮讨论）  
> 最后更新：2026-06-05  
> 反馈：内部 GitLab issue（待建）  
> 配套文档：`geo_seo_internal_tool_dev_doc_v1.2.md`（设计）/ `README.md`（简要）
