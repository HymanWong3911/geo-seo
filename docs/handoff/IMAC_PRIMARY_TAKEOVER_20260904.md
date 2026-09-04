# GEO-SEO iMac-primary 接管回执

## 回执范围

- 日期：2026-09-04（Asia/Hong_Kong）
- 接收方：iMac，GEO-SEO custody coordinator
- 发送方：MacBook 远端开发现场
- 本回执只确认 Git 代码保全、SHA 核对与治理接管；不确认功能正确性，不签署 release。

## 已保全 refs

| ref | 完整 SHA | 用途 | 接收状态 |
|---|---|---|---|
| `recovery/geo-seo-c77a586-20260904` | `c77a586bb3b7dc1874aa64a616f1c9c63a188eef` | MacBook 原 debug 分支的 32 个未推送历史提交保全点 | iMac 已 fetch 并核对 |
| `handoff/geo-seo-custody-20260904` | `6c4d4fc48d9453f404668e22a8d8243281480fb4` | 在 recovery 基线上对工作区进行分组 custody snapshot 后的交接头 | iMac 已 fetch、建立独立 worktree 并核对 |
| `recovery/geo-seo-stash-20260720` | `5c9b49d7d8b7b5dc45ce9c04d1d0a383d20802cd` | 原 `DEBUG_SESSION_20260720_protect` stash 的独立恢复快照 | iMac 已 fetch 并核对；原 stash 暂不授权删除 |

补充治理来源：`dsh/r0-harness-takeover` 位于 `648f1c2325b6ca1dfc302898c7a62b1f87a58090`。本次治理分支基于 custody HEAD 重建有效规则，没有把旧治理提交中的陈旧运行事实直接合并进来。

## iMac 落点

- 原 `main` 基线保持 `9c46c081b0683da88c239735c2c48ef14f170c1d`，本次不合并、不改写。
- custody 验收 worktree：`/Users/hymanwong/Documents/dev/my-products/GEO-SEO-custody-20260904`。
- iMac-primary 治理 worktree：`/Users/hymanwong/Documents/dev/my-products/GEO-SEO-imac-primary-20260904`。
- 治理分支：`coord/geo-seo-imac-primary-20260904`，base 为 custody SHA `6c4d4fc48d9453f404668e22a8d8243281480fb4`。

## 已核对

- 三个 remote refs 均可解析到表中完整 SHA。
- custody worktree 从指定 handoff SHA 建立，接管时 Git 工作区干净。
- custody 链与旧 `main` 的共同祖先为 `9c46c081b0683da88c239735c2c48ef14f170c1d`。
- MacBook 脏工作区与 stash 已使用独立 handoff/recovery refs 保全，没有要求把 recovery ref 当作 release branch。
- 治理规则已按当前事实修正：双向 SSH/Codex 通道已验收；Node 以 `.nvmrc` 的 22 和 `package.json` 的 `>=22.13.0` 为准；跨项目不共享业务代码。

## 明确未完成

- 本回执创建时未安装依赖、未启动数据库/Redis/web/worker，也未执行 unit、E2E、typecheck、lint、Next build 或 Docker build。接管后的独立可开发基线验证已经完成依赖安装、Prisma generate、typecheck、lint、150 个测试和 Next build；后续证据见 `docs/handoff/IMAC_PRIMARY_BOOTSTRAP_EVIDENCE_20260904.md`。
- 未对 MacBook snapshot 中的产品行为、migration、真实 provider、发布/发稿或外部副作用做功能验收。
- 未签署 G1、G2 或任何 release；未部署、未真实发布、未调用付费渠道。
- 未把 custody 或本治理分支合并到 `main`，也未在本回执创建时 push 本治理分支。

## 后续接管门禁

1. 由独立 reviewer 复核 custody diff、migration 顺序、敏感信息扫描结果和 recovery 完整性。
2. 在 Node 22.13+、锁定 pnpm 版本和隔离依赖环境中执行基础门禁，形成首份当前机器的 executable evidence。
3. 对真实 provider/发布路径保持 mock 或隔离验证，直到用户明确批准外部副作用。
4. 任何 harness 结构改造先完成接口合同、双项目迁移/回滚方案与独立 contract tests。
5. 通过评审后再决定本治理分支与 custody 代码进入哪一个 release；不得因“已接管”跳过 G1/G2。
