# GEO-SEO M0 exact-SHA 信任基线复验证据

## 结论

- 执行日期：2026-09-04（Asia/Hong_Kong）
- 执行主机：`iMac.lan`
- 验证分支：`codex/geo-m0-trust-replay-20260904`
- 验证 worktree：`/Users/hymanwong/Documents/dev/my-products/GEO-SEO-m0-trust-replay-20260904`
- 被验证的完整 SHA：`fb462c48ab81eaef3ec7a4b8d7655982d600f558`
- 目标执行模式：隔离/mock。确定性 GEO run 使用 mock LLM；但完整 worker 启动后意外访问了真实公开搜索来源，所以本轮整体的“无外部网络”门禁为 FAIL。未观察到 credentialed provider、CMS、分发、通知、发稿、付费或外部写入。
- 总结：源码、迁移和确定性 E2E 基线通过；生产依赖审计发现 8 个漏洞（其中 6 个 high）；web 镜像构建被 registry 超时阻断，worker 镜像与 runtime smoke 未执行。因此本证据状态为 **NOT RELEASE-CLEARED**。

本文件不签署 G1/G2，不批准 merge、release、production 或任何真实外部发布。

## 隔离与安全边界

- 使用任务专属 PostgreSQL、Redis、容器、named volume、端口、web 与 worker 进程。
- 首次创建的数据库/Redis 容器错误地使用了 Docker 默认 `0.0.0.0` 发布；coordinator 在进入数据库验证前立即中止并精确删除了该批容器和 volume。该失败 checkpoint 不计入通过证据。
- 安全重跑时，PostgreSQL `25434` 和 Redis `26380` 均显式发布到 `127.0.0.1`；`docker inspect` 中两者 `HostIp` 均精确为 `127.0.0.1`。web 只监听 `127.0.0.1:13010`，worker 未发布端口。
- 未读取、复制或 source 项目 `.env` / `.env.local`；真实 provider/CMS credential 未进入 Git 或正式门禁日志。诊断脚本曾把短期 CSRF 值/cookie 写入临时调试日志，安全复核发现后已精确删除；该事件不作为通过证据。
- Compose 未执行：当前 `docker-compose.yml` 会加载项目 `.env`，且默认端口映射未限定 loopback，不符合本次 lease 的隔离条件。
- 完整 worker 入口会在启动 5 秒后无条件执行 brand monitor。该路径并发请求配置的 SearXNG（缺省为本机 `:8888`）以及 Bing、DuckDuckGo、360 公共搜索，并在任务隔离库写入了两组共 20 条 mention；隔离 volume 后续已删除。这是本轮真实只读 provider 越界和 Harness 默认安全配置缺口，不计作验收通过。

## 可执行门禁结果

| 门禁 | 结果 | 证据摘要 |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | PASS | 使用仓库锁定的 `pnpm@11.25.0`，15.3 秒完成，锁文件未漂移 |
| `corepack pnpm prisma:generate` | PASS | Prisma Client `5.22.0` 生成成功 |
| Prisma schema validate | PASS | `src/prisma/schema.prisma` 校验成功 |
| `corepack pnpm typecheck` | PASS | `tsc --noEmit` 退出码 0 |
| `corepack pnpm lint` | PASS | ESLint 退出码 0 |
| `corepack pnpm test` | PASS | 34 个测试文件、150/150 tests 通过 |
| `corepack pnpm build` | PASS | Next.js `15.5.25` production build 成功 |
| PostgreSQL/Redis loopback 与健康检查 | PASS | 两个任务容器健康；HostIp 均为 `127.0.0.1` |
| 空库 `prisma migrate deploy` | PASS | 8 个 migration 按顺序全部应用成功 |
| 数据库对 schema diff | PASS | 输出 `This is an empty migration.`，无 schema drift |
| 隔离 seed | PASS | 3 个项目及完整演示数据建立成功；密码未输出 |
| 确定性 GEO E2E | PASS | 正式原测试文件 1/1、9/9 tests 通过，6.08 秒；`GEO_RUN_MOCK_LLM=true` |
| worker 外部网络隔离 | FAIL | worker 启动后 brand monitor 仍向真实公共搜索来源发出只读请求；mock LLM 不等于完整 offline profile |
| `pnpm audit --prod` | FAIL | 官方 advisory 返回 8 个漏洞：1 low、1 moderate、6 high |
| `Dockerfile.web` exact-SHA image build | BLOCKED | 多轮标准构建在 `pnpm install --frozen-lockfile` 下载阶段遭 registry error `(23)`；最完整一次到 797/799 后超时，未产生目标镜像 |
| `Dockerfile.worker` image/runtime smoke | NOT RUN | CI 中 worker 与 web 为独立 matrix；本轮在 web 构建失败后停止，没有把 worker 误记为已构建或被技术性前置阻断 |

## 证据绑定与独立复核

以下 coordinator 复核在同一 worktree、base HEAD 仍为 `fb462c48ab81eaef3ec7a4b8d7655982d600f558` 时，于 2026-09-04 20:24–20:27 HKT 独立执行；唯一 staged 变更是本证据文件：

| 命令 | 退出码 | 复核结果 |
|---|---:|---|
| Node / pnpm version | 0 | `v22.23.2` / `11.25.0` |
| Prisma validate（只给语法所需的 dummy loopback URL，不连接数据库） | 0 | schema valid |
| `corepack pnpm typecheck` | 0 | `tsc --noEmit` |
| `corepack pnpm lint` | 0 | ESLint 通过 |
| `corepack pnpm test` | 0 | 34 files、150/150 tests |
| `corepack pnpm build` | 0 | Next.js `15.5.25`，78/78 static pages |
| staged diff check / sensitive literal scan | 0 | 只含本文件；未发现高置信 credential literal |
| 任务容器、volume、三个监听端口与记录 PID 复核 | 0 | 输出为空 |

数据库 migration、schema diff、seed、E2E、执行时 `HostIp` 与健康状态来自执行器 attestation，并由 coordinator 在资源销毁前现场复核；它们没有独立的 inspect 原始文件，因此不应被描述为可脱离本任务上下文重放的 durable raw evidence。保留的脱敏正式日志已改为目录 `0700`、文件 `0600`，并以 SHA-256 绑定如下：

```text
7cf347e44a7c8122f82b6d426de5265e7178067c9dea43bc01cfbc42e435bcf0  install.log
80eac842369bfcffdb364a7999a40b069752a43304b8b5c44601b778ddfc7e8a  prisma-gen.log
962f78344cb88ac16c2def8520263eae57d1d3f134d2882f248e8b1341ebd971  prisma-validate.log
8366207267355d3e3d5bf3bf6e8c94c5f93f6078c34f08973fa2b38cdda6cc92  typecheck.log
9ef9ae25234cdb4b4e4e777f941a63ce045dd8435239cfd89a6285a12ab5fcb2  lint.log
b37d39f4b494b65a894413e266398f2f4aa2933be2a6e269a4facb110bb13621  test.log
e04c707c0612ccec22b9eb2716d27e7dc2f9f7d0249c5052a81490b0acd22e93  build.log
c9259c56db024588d98f9637675cdf2ffd46f90ecb42da484968f4a0d829fbde  migrate-deploy-2.log
e69c9f21be2b53770b13ea52bf6c4f304a9fc86b41f1e932729ec2de45574341  schema-diff.log
aa2ea63a8bc2832ddf2108ec52ab10b1e430a28836a185362160593fda904beb  seed3.log
882404b15ea22a1d4a1e5c717e231de4973dd244050eec6cb1dc0bda98745d6d  e2e.log
9400ab03d58941f51b04da9c0a9fffb8312ae83757afee7edce40d8124635456  audit-prod.log
f0978b83db87daf0d6a7b537210741ecf8d6bb99b8c2e51ccc60a32a4178554d  web-build-host.log
6acc73e694ad34ab80887c168b01b31b536033bdf6688f129d117c1e7dc158a4  worker.log
```

## E2E 初次失败与纠正

初次 E2E 显示 suite failed、9 tests skipped，并报 `Unexpected token '<'`。追踪证据表明：

1. CSRF endpoint 正常返回 `200 application/json`，`APP_BASE_URL`、`CI=true` 与 `GEO_RUN_MOCK_LLM=true` 已正确进入 Vitest。
2. seed 默认把用户设为 `mustChangePassword=true`；登录后的 `/api/projects` 被 middleware 重定向到 `/change-password`。
3. `fetch` 自动跟随重定向后得到 `200 text/html`，测试在直接执行 `res.json()` 时解析 `<!DOCTYPE>` 失败。
4. 对隔离测试状态应用与 CI 相同的 `mustChangePassword=false` 后，未修改源码的正式 E2E 原文件达到 9/9 PASS。

因此该 checkpoint 的直接根因是复验配置错误，不是 GEO run 业务链失败。与此同时，它暴露了独立的 Harness 加固项：E2E 登录应断言 session/redirect，JSON helper 应先检查 status、content-type 与最终 URL；API 首次改密分支不应让 API 客户端收到 HTML 页面。

## 依赖审计阻断

官方 registry 审计最终返回：`8 vulnerabilities found`，严重度为 `1 low | 1 moderate | 6 high`。已确认的受影响依赖链包括：

- `browserslist`（经 Sentry/Babel/webpack 链路）；
- `fast-uri`（经 Sentry webpack/schema-utils/ajv 链路，多条 high advisory）；
- `@tiptap/core`（moderate）；
- `postcss-selector-parser`（low）。

审计请求期间出现过 registry `503` 和 error `(23)` 重试，日志开头有一次被中断的传输片段；但最终漏洞总数、严重度汇总和上述 advisory 表均已返回。任何依赖修复必须在独立任务中更新锁文件并重跑全部门禁，本任务不顺手改依赖。

## 镜像与运行时阻断

- 本机不存在带当前完整 SHA revision 证据的 GEO-SEO web/worker 镜像，Docker build cache 也没有完成 `pnpm install` 的可信层。
- `Dockerfile.web` 的标准构建与 `--network=host` 诊断构建均在官方 registry 下载阶段超时；未产出 `geo-seo-web:geo-m0-test`。
- worker 镜像构建没有执行。web non-root/只读文件系统/health 与 worker non-root/Chromium runtime smoke 均为 NOT RUN，未宣称通过。
- 不得以基础镜像、dangling layer、旧 tag 或宿主机 `node_modules` 代替 exact-SHA 镜像验收。

静态复核另发现一个需要独立修复和回归的高风险项：PDF API 在 web 进程调用 `generatePdfFromHtml`，而系统 Chromium 只安装在 worker 镜像；`src/lib/reports/pdf.ts` 当前使用裸 `chromium.launch()`，没有消费 worker Dockerfile 声明的 Chromium executable path。报告 HTML 的转义与浏览器网络出口也需要进入同一威胁模型。即使将来 worker Chromium smoke 通过，也不能据此认定 web PDF runtime 可用或安全。

## 清理、回滚与遗留项

- 已终止本任务 web、worker、CLI 与未完成的 Docker build 子进程。
- 已精确删除任务容器 `geo-m0-postgres`、`geo-m0-redis` 及 volumes `geo-m0-pg-data`、`geo-m0-redis-data`；任务容器、volume、监听端口和常驻进程均为零。
- 已删除三份任务临时 credential 文件，以及 24 份调试副本、trace、probe、PID 文件（其中包含写有短期 CSRF 值/cookie 的日志）；不含此类值的正式门禁日志暂存于 `/tmp/geo-m0-replay-logs/`，但不作为长期真源。
- 未触碰其他项目容器、数据库、分支或 worktree。
- 本提交只新增本证据文件；回滚只需反向提交本文件，不涉及 schema、业务数据或运行时状态。

下一步至少分为三个互不重叠的有界节点：

1. 依赖漏洞升级与完整 lockfile/回归门禁；
2. 建立真正的 offline worker profile：默认 deny 外网、显式禁用 brand monitor/scheduler/发布类 worker，再做可复现镜像与 non-root、health、Chromium runtime smoke；
3. web PDF/Chromium 路径、HTML 转义与浏览器网络出口修复，以及 E2E/API 首次改密响应契约加固。

这些节点在 contract、迁移/回滚说明和验收命令完成前，不进入 release 或真实发布。
