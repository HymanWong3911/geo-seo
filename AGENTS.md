# GEO-SEO 多 Agent 协作规则（规则真源）

> 本文件是 GEO-SEO 仓库及其 worktree 的唯一协作规则真源。`CLAUDE.md` 如存在，只能作为指向本文件的薄桥。

## 角色与授权

- 总指挥：当前由用户任命的 Codex harness 会话。负责合同、任务拆分、验收、合并裁决、跨机交接和战场卫生；除治理文档外不直接写业务代码。
- 实施者：Codex/Claude/其他 coding agent。只在专属分支与 worktree 开发，提交可执行证据，不得自批门禁。
- 用户（PO）：负责范围、发布、付费、外部授权、生产数据和最终放行。
- 同一任务的实施者不得兼任该任务的验收签署者。

## 开工协议

1. 完整读取本文件。
2. 执行 `git status --short --branch`、`git worktree list`、`git branch -vv`。
3. 阅读 `docs/CROSS-HOST-HANDOFF.md` 与当前 release 合同/证据。
4. 向总指挥报到，取得带验收条件的任务合同后再写代码。

## 分支、worktree 与提交

- 分支格式：`<agent>/<release>-<theme>`；worktree 放在主仓同级目录。
- 业务代码禁止直接提交 `main`。治理文档也应优先走治理分支，经复核后合并。
- 每个可独立验收的任务单独提交，并立即 push；不得把多个任务压成一个大提交。
- 不回滚、不覆盖其他 agent 或用户的未提交改动。

## 合同与门禁

- 无合同不开工。合同至少包含：范围、非目标、文件所有权、验收命令、外部依赖、回滚方式。
- G1：实施完成且证据齐备；G2：独立复核与落地终验。实施者不得为自己签署。
- 基础门禁：锁文件安装、Prisma generate/validate、TypeScript、lint、Vitest、Next build；涉及容器时增加 web/worker Docker build；涉及数据库或外部渠道时增加隔离环境 E2E。
- 证据必须记录可复现命令、真实结果、HEAD SHA、环境与时间，不接受口头“已通过”。

## 跨机器交接

- 以“发送方 push 完整 SHA → 接收方 fetch → 接收方核对相同 SHA → 双方 ACK”为完成条件。
- 必须同时报告未提交文件、未跟踪文件、stash、worktree、后台 writer/worker、数据库 migration 与外部副作用。
- 未完成上述闭环前，接收方只能把远端仓库视为“已推送基线”，不能宣称完整接管。

## 安全红线

- 不读取、输出或提交 `.env` 与凭据值；文档只记录变量名或密钥管理器引用。
- 已进入 Git 历史的凭据必须立即轮换；仅删除当前文件内容不能消除历史泄露。
- 生产部署、真实分发、真实搜索 API、大规模抓取、数据库破坏性操作和付费行为必须由用户明确批准。
- 本机默认不启动常驻 worker、scheduler、daemon 或自动发布任务。

## 收尾协议

1. `git status` 如实，分支已 push 且 ahead=0。
2. release evidence 写明完成项、未完成项、测试、风险、G1/G2 状态。
3. 汇报保留/可清理的 worktree、临时目录、容器与后台进程；未经核验不删除。

