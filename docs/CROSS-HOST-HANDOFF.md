# GEO-SEO 跨机接管记录

## 当前接管状态（2026-09-04）

- 接收机：当前 iMac，本地基线目录 `/Users/hymanwong/Documents/dev/my-products/GEO-SEO`。
- 已拉取远端：`https://github.com/HymanWong3911/geo-seo.git`。
- 已验证基线：`main` / `origin/main` 均为 `9c46c08`，clone 后工作区干净。
- 治理 worktree：`dsh/r0-harness-takeover`，用于建立 harness 规则与交接材料。
- 发送机：局域网主机 `macbookpro.lan`（`192.168.6.178`）网络可达。
- 未闭环项：SSH 未授权；Codex App 当前未发现该主机为可控 remote host；因此发送机上的未提交、未跟踪、stash、额外 worktree 与未 push commit 尚未核验。
- 结论：完成“远端已推送基线接管”，尚未完成“发送机工作现场完整接管”。

## 发送方必须回报

```text
repo 绝对路径：
规则真源及 SHA：
当前 branch / HEAD / upstream：
git status --short --branch：
git worktree list：
git branch -vv：
git stash list：
未提交/未跟踪文件用途：
已 push 的最后完整 SHA：
当前任务合同与完成度：
已执行门禁及原始结果：
数据库 migration/数据状态：
正在运行的 worker/scheduler/container：
外部调用或副作用：
可安全停止/保留/清理项：
```

发送方不得粘贴 `.env` 或任何凭据值。发送方完成 push 后，接收方必须 fetch 并核对完整 SHA，再回复 ACK。

## 当前代码事实与风险

- README 宣称 M1-M11 完成，但 `DEV_NOTES.md` 仍描述大量骨架/占位；`SESSION_PROGRESS.md` 的更新时间和测试数字也已落后于 README。后续以代码、测试与 release evidence 为准，不以宣传性状态文字为准。
- `SESSION_PROGRESS.md` 曾包含明文凭据。对应密钥应由用户立即轮换；治理任务需清理当前版本并制定 Git 历史处置方案。
- 仓库尚无 release evidence 与双门禁签署记录，不能把现有“测试全过”描述视为当前机器上的可执行证据。
- 本机 Node 为 25.x，而项目声明 Node 20+、CI 使用 Node 20；首次验收应在 Node 20 环境执行，避免环境漂移。

## 接管后的第一个 release 建议

R0：信任基线，不新增产品功能。

1. 轮换已暴露凭据，清理文档当前版本并裁决 Git 历史处置。
2. 建立 Node 20 可复现环境，跑锁文件安装、Prisma、typecheck、lint、unit/E2E、build、双 Docker build。
3. 逐条验真 README 的 M1-M11，将能力标记为“实现 / 自动验证 / 真实账号验证 / mock-only”。
4. 修复文档真源漂移，建立首份 executable release evidence。
5. G1/G2 通过后再规划功能 release。

## castr 联合指挥接口

- 两项目共用：身份互斥、合同、专属 worktree、立即 push、可执行证据、G1/G2、跨机 SHA ACK、安全红线。
- `castr` 下一里程碑优先为 R1.0 migration 收敛；GEO-SEO 优先为 R0 信任基线。两者不得共享数据库、端口、worker 或凭据文件。
- 跨项目只共享治理模板与经验，不复制业务代码或环境配置。

