# GEO-SEO iMac-primary 可开发基线证据

## 证据范围

- 执行日期：2026-09-04（Asia/Hong_Kong）
- 执行主机：`iMac.lan`
- 验证 worktree：`/Users/hymanwong/Documents/dev/my-products/GEO-SEO-imac-primary-20260904`
- 验证分支：`coord/geo-seo-imac-primary-20260904`
- 被验证的完整 SHA：`f5be82ecb373caead9c7cf4c12465639a10e3f45`
- 基础 custody SHA：`6c4d4fc48d9453f404668e22a8d8243281480fb4`

本证据只建立 iMac 上可重复的本地开发基线，不签署 G1/G2，不批准合并、部署、真实发稿、付费调用或 release。

## 隔离环境

- Node：`v22.23.2`，来自 `/usr/local/opt/node@22/bin`；未改写系统默认 Node。
- 包管理器：通过 Corepack 使用仓库 `package.json#packageManager` 指定的 `pnpm@11.25.0`。
- 依赖：使用锁文件冻结安装；安装后 Git 工作区无依赖文件漂移。
- 凭据：确认验证 worktree 中没有 `.env` 或 `.env.local`；未读取、复制或生成真实凭据。

## 已执行门禁

| 门禁 | 结果 | 摘要 |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | PASS | 锁文件冻结安装完成，共解析安装 801 个包；未改写 Git 文件 |
| `corepack pnpm prisma:generate` | PASS | Prisma Client 生成完成 |
| `corepack pnpm typecheck` | PASS | TypeScript 检查退出码 0 |
| `corepack pnpm lint` | PASS | lint 退出码 0 |
| `corepack pnpm test` | PASS | 34 个测试文件、150/150 tests 通过 |
| `corepack pnpm build` | PASS | Next.js 15.5.25 生产构建完成，78 个静态页面生成 |

以上命令均在 Node 22 的项目级 PATH 下执行；没有启动常驻 web、worker 或 scheduler。

## 未完成与限制

- `pnpm audit --audit-level high` 未形成漏洞结论：npm 官方 advisory endpoint 多次返回网络传输错误（pnpm error code 23）。这只表示审计服务本次不可用，不能解释为“0 漏洞”。
- 未连接数据库或 Redis，未执行 migration upgrade/downgrade、隔离环境 E2E、真实 provider、真实发布/发稿或 Docker image build。
- 未审查 MacBook custody snapshot 中每一项产品行为；150 个单元/组件测试通过不等于 release 验收。
- 未签署 G1/G2，未合并 `main`，未部署，未触发外部副作用。

## 后续放行点

1. 由独立 reviewer 复核 custody diff、migration 链和本证据。
2. 在隔离数据库/Redis 上补齐 migration 与 E2E，并单独处理安全审计服务不可用问题。
3. 自动发布/发稿能力先与 CASTR 联合盘点，再提交共享 Capability/Port 合同、迁移/回滚方案和双项目 contract tests；本阶段不得跨仓共享或复制业务代码。
4. 只有独立签署 G1/G2 且用户明确批准后，才可进入合并、部署或真实渠道验证。
