# GEO-SEO Source of Truth

## 事实层级

从高到低按以下顺序裁决冲突：

1. 用户对范围、生产发布、付费与最终放行的明确决定；
2. `AGENTS.md` 中的平台无关协作与安全规则；
3. Git 中的实现、schema/migration、自动化测试、锁文件与版本声明；
4. 当前 release contract、可执行 evidence 与 handoff receipt；
5. README、进度说明、演示材料和历史会话记录。

低层材料不得覆盖高层事实。宣传性“已完成”、历史测试数字或消息中的口头状态，都不能替代当前代码与可复现证据。

## 代码与协作真源

- Git remote 上可解析的完整 commit SHA 是代码、规则和交接状态的唯一真源。
- Codex task/chat 只作为派单与状态面；消息必须附 branch、worktree、完整 SHA 或明确说明“尚未提交”。
- iMac 是当前 GEO-SEO custody coordinator；MacBook 只有在取得显式 task + branch + worktree lease 时才可写入指定范围。
- `main` 只代表已合并基线，不自动代表通过功能验收、G1/G2 或生产发布。
- 当前接管基线和 recovery refs 见 `docs/handoff/IMAC_PRIMARY_TAKEOVER_20260904.md`。

## 规则与平台桥接

- `AGENTS.md` 是唯一项目规则真源。
- `CLAUDE.md` 是 Claude Code 薄桥，不得复制或演化另一套规则。
- 子目录如有更具体的 `AGENTS.md`，只在其目录范围内追加约束，不得放宽根规则的安全边界。
- castr 有自己的仓库与规则真源；本仓文件不能替代 castr 的合同、验收或发布决定。

## 架构与共享边界

- GEO-SEO 产品实现以本仓代码、schema、migration 与测试为准。
- 跨项目仅允许共享版本化的 Capability/Port 合同、无产品领域逻辑的 provider adapter、合规门禁与 contract tests。
- UI、业务代码、产品编排、产品数据库和产品运行状态永不以共享层为真源。
- 共享能力若被批准，应拥有独立版本、兼容策略、测试与发布记录；两个产品通过依赖版本消费，不能直接跨仓引用源码。
- 详细边界见 `docs/architecture/HARNESS_FIRST_CROSS_PROJECT_BOUNDARIES.md`。

## 文档保鲜规则

- release evidence 与 handoff receipt 必须记录生成时间、完整 SHA、验证范围、未验证项与签署状态。
- Node 与包管理器版本以 `.nvmrc`、`package.json#engines`、`package.json#packageManager` 和锁文件为准；文档只解释，不另建版本真源。
- 发现文档、消息与代码冲突时，先记录冲突，再由任务合同决定修复；不得通过改写历史证据掩盖漂移。
