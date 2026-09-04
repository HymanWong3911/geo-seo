# GEO-SEO 跨机协作与交接协议

## 当前拓扑（2026-09-04）

- iMac：GEO-SEO 当前主开发机与 custody coordinator。
- MacBook：远端协作节点，通过 SSH alias `mbp` 与原生 Codex Remote/SSH 通道被 iMac 发现；反向通道也已验收。
- 已验证的远端身份为 `MacBook-Pro.lan`，iMac 侧发现路由为 `remote-ssh-discovered:mbp`。
- SSH、Codex 登录和 host discovery 是协作前置条件，不是代码真源；每次重要交接仍必须完成 Git SHA ACK。
- 不把局域网 IP、凭据、cookie、token、私钥或完整连接配置写入仓库。

## Worktree lease

每个跨机任务必须由 iMac coordinator 发出可审计 lease，至少包含：

```text
task id / owner host / agent：
base ref + full SHA：
branch：
worktree absolute path：
owned files or modules：
explicit non-goals：
acceptance commands：
external side effects：
rollback plan：
lease end condition：
independent reviewer：
```

- 一个 branch/worktree 同时只允许一个 writer。
- 消息可更新状态，但写入权只能由明确 lease 授予；“能看到远端任务”不等于获得写入权。
- 未取得 lease 的主机只可做只读审计，不能修改业务代码、规则或发布状态。

## 标准交接流程

1. **FREEZE**：发送方停止相关 writer/worker，确认没有正在写目标 worktree 的进程。
2. **INVENTORY**：报告 branch/HEAD/upstream、status、worktree、stash、未跟踪文件、migration、后台进程、外部调用及验证结果。
3. **SAFE SNAPSHOT**：按合同提交；需要保全 stash 或脏工作区时使用单独 recovery ref，不把证据混入业务提交。
4. **PUSH**：发送方 push 命名 ref，并发送完整 40 位 SHA。
5. **FETCH + VERIFY**：iMac fetch 指定 ref，核对 remote SHA、本地 SHA、父链与工作区状态。
6. **ACK**：双方消息记录 `CODE_CUSTODY_ACK`、ref、完整 SHA、验证范围及未验证项。
7. **LEASE CLOSE**：coordinator 明确旧 writer 是否保持冻结、worktree/stash 是否继续保留；未授权不得清理。

消息通道只报告这些动作。任何“已完成”都必须能回到 Git ref、完整 SHA 与 evidence。

## 状态词约束

- `DISCOVERED`：能看到远端 host/task，尚未核对 Git。
- `PUSHED`：发送方已推送，接收方尚未验证。
- `CUSTODY_ACCEPTED`：接收方已 fetch 并核对完整 SHA；不代表功能通过。
- `G1`：实现完成且任务证据齐备，由非实施者确认。
- `G2`：独立复核和落地终验完成。
- `RELEASED`：用户授权且发布证据完成。

禁止把 `PUSHED` 或 `CUSTODY_ACCEPTED` 写成“测试通过”“已签 release”。

## 失败与回滚

- SSH/Codex discovery 失败：停止消息侧派单，保留本地提交，通过已有 Git remote 继续 SHA 交接；不绕过 MFA 或人工确认。
- push 认证失败：保留本地 branch 与对象，采用经验证的已有认证通道传输；不得把 token 写进命令、URL、日志或文档。
- SHA 不一致：拒绝 ACK，冻结双方 writer，比较 refspec、对象与父链后重新交接。
- writer 未冻结或工作区不干净：只创建 recovery ref，不宣称正式 handoff；由 coordinator 决定后续整合。
- 任何回滚优先回到已记录的完整 SHA；不使用破坏性 reset 覆盖未知改动。
