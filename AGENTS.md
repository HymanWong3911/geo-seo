# GEO-SEO Harness 协作规则（规则真源）

> 本文件是 GEO-SEO 仓库及所有 worktree 的平台无关协作规则真源。`CLAUDE.md` 只能作为指向本文件与 `SOURCE_OF_TRUTH.md` 的薄桥，不得维护另一套规则。

## 1. 当前指挥与写入权

- iMac 是 GEO-SEO 当前的 custody coordinator，负责合同、派单、验收、合并裁决、跨机交接与发布门禁。
- MacBook 是可协作的远端执行节点；只有取得明确的 task、独立 branch 与独立 worktree lease 后才获得对应范围的写入权。
- 不允许两台机器、两个 agent 或两个 task 同时写同一 branch/worktree。发现租约冲突时立即停止写入并报告。
- Codex 消息通道只承载派单、进度、阻塞和 ACK；Git remote 上可解析的完整 commit SHA 才是代码与文档状态真源。
- 用户（PO）保留产品范围、生产发布、付费行为、真实账号、生产数据与最终放行权。
- 实施者不得为自己的任务签署 G1/G2 验收。

## 2. 开工协议

任何写入前必须：

1. 完整读取 `AGENTS.md`、`SOURCE_OF_TRUTH.md` 与适用目录内更具体的规则文件。
2. 执行并检查 `git status --short --branch`、`git worktree list`、`git branch -vv`。
3. 阅读当前 task/release 合同、最近的 handoff receipt 与可执行证据。
4. 取得任务合同，至少明确：范围、非目标、文件所有权、验收命令、外部依赖、回滚方式、branch/worktree lease 和验收人。
5. 对数据库、外部渠道、发布或常驻进程相关任务，先确认环境隔离与副作用边界。

无合同不开工；无独立 worktree 不并行写入。

## 3. 分支、worktree 与提交

- 分支格式建议为 `<agent-or-role>/<release>-<theme>`；worktree 放在主仓同级目录。
- 业务代码禁止直接提交 `main`。治理变更也应先进入专属治理分支，经复核后合并。
- 每个可独立验收的任务形成聚焦提交；完成本地门禁后 push，并回报完整 SHA。
- 不回滚、不覆盖、不清理其他 agent 或用户的未提交改动、stash、worktree 或临时证据。
- 合并前必须重新确认 base、diff、测试证据与回滚点；custody snapshot 不等于功能验收或 release 签署。

## 4. Harness-first 架构约束

- 业务核心只依赖稳定、版本化的 Capability/Port，不直接依赖具体 provider SDK、账号、凭据或宿主进程。
- provider、profile、credential reference、持久化 run/stage、可选 adapter/plugin 都位于边界层；凭据值不得进入领域对象、日志、文档或 Git。
- 每次执行必须有可追踪的 run/stage 状态、输入/输出摘要、错误分类和幂等/重试语义；不得只靠进程内状态宣称完成。
- adapter 可替换，业务编排归 GEO-SEO 自己所有；adapter 失败不得绕过合规门禁。
- 任何结构性改造必须先提交：接口合同、迁移方案、回滚方案，以及 GEO-SEO 与 castr 都能独立运行的 contract tests。材料未齐不得实施重构。

## 5. 与 castr 的严格边界

GEO-SEO 与 castr 始终是两个独立产品仓库，拥有独立 backlog、版本、发布节奏与故障域。

禁止跨项目共享或复制：

- 业务代码与领域模型；
- 产品 UI、路由和交互状态；
- 产品编排、任务流和 release 状态机；
- 产品数据库、migration、数据记录或内部 repository；
- 项目专属配置、端口、worker、凭据文件或运行时状态。

仅允许通过独立版本与明确契约共享以下边界能力：

- Capability/Port 合同及其版本兼容规则；
- 不包含产品领域逻辑的 provider adapter；
- 合规、安全与发布门禁；
- 针对共享合同的 contract test 套件。

共享能力必须作为可单独测试、可版本化的包或服务被消费，不得直接跨仓引用源码，不得把一方的业务实现复制到另一方。自动发布/发稿属于待抽取的边界能力：先联合盘点两仓现有实现，再定合同与迁移/回滚方案，禁止两边继续各复制一套。

## 6. 环境与验证

- Node 版本以 `.nvmrc` 和 `package.json#engines` 共同为准。当前基线是 Node 22，最低 `22.13.0`；若两处不一致，先停止并修正文档/配置漂移。
- 包管理器及版本以 `package.json#packageManager` 和锁文件为准，禁止无理由重写锁文件。
- 基础门禁按任务相关性至少覆盖：锁文件安装、Prisma generate/validate、TypeScript、lint、Vitest、Next build；容器改动增加 web/worker image build；数据库或真实渠道增加隔离环境 E2E。
- 证据必须包含可复现命令、原始结果摘要、完整 HEAD SHA、环境与时间。历史文档里的“已通过”不能替代当前执行证据。

## 7. 跨机交接与 ACK

- 完成交接的最小闭环：发送方冻结 writer → push 完整 SHA → 接收方 fetch → 接收方核对相同 SHA 与工作区状态 → 双方 ACK。
- 发送方同时报告：未提交/未跟踪文件、stash、worktree、后台 writer/worker、数据库 migration、外部副作用、已运行门禁和未运行门禁。
- 接收方未核对 SHA 前，只能称“发现远端 ref”；核对后只能称“custody 已接收”；功能测试与独立复核完成后才可进入 G1/G2。
- 具体协议与当前拓扑见 `docs/CROSS-HOST-HANDOFF.md`。

## 8. 安全与外部副作用

- 不读取、输出、复制或提交 `.env`、token、cookie、私钥、完整连接配置及其他凭据值；只记录变量名或 credential reference。
- 已进入 Git 历史的真实凭据必须轮换；删除当前文本不能消除历史风险。
- 生产部署、真实分发、真实搜索 API、大规模抓取、数据库破坏性操作和付费行为必须由用户明确批准。
- 默认不启动常驻 worker、scheduler、daemon 或自动发布任务；测试结束后报告并清理自己启动的进程。

## 9. 收尾协议

1. 如实报告 `git status`、branch、完整 HEAD SHA、upstream/push 状态。
2. release evidence 写明完成项、未完成项、验证、风险、回滚点与 G1/G2 状态。
3. 汇报应保留或可清理的 worktree、stash、临时目录、容器与后台进程；未经 custody coordinator 核验不得删除。
4. 只有用户授权的 release 才能部署或对外发布。
