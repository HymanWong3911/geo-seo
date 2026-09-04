# Harness-first 与跨项目边界

## 决策

GEO-SEO 与 castr 是两个独立产品，不合并仓库、不共享业务代码，也不共享 UI、产品编排、产品数据库或产品运行状态。两者只在稳定边界上复用能力，并保持独立版本与发布节奏。

## 分层模型

```text
GEO-SEO product core                 castr product core
        |                                    |
        +---- stable Capability / Port ------+
                         |
              versioned boundary layer
        contract / provider adapter / gate
                         |
             external provider or service
```

产品 core 拥有各自的用户意图、业务状态机、UI、数据库事务和错误呈现。边界层只翻译稳定合同与外部 provider，不知道 GEO-SEO 项目、castr 节目或其他产品领域实体。

## 允许共享

| 类型 | 允许条件 |
|---|---|
| Capability/Port 合同 | 明确输入、输出、错误、幂等、版本与兼容策略 |
| Provider adapter | 不导入任何产品领域模块；凭据仅使用 reference；可单独测试 |
| 合规/安全/发布门禁 | 默认拒绝，具有可审计的判定与人工放行点 |
| Contract tests | 两个产品分别作为 consumer 运行；覆盖兼容与失败路径 |

共享单元必须作为独立版本化包或服务发布。禁止 Git 子模块式耦合、跨仓相对路径、直接导入另一产品源码或复制粘贴一份后各自演化。

## 禁止共享

| 类型 | 原因 |
|---|---|
| 业务代码/领域模型 | 会把两产品生命周期和语义绑死 |
| UI、路由、页面状态 | 属于产品体验与发布边界 |
| 产品编排与状态机 | 每个产品拥有自己的流程、补偿和 SLA |
| 产品数据库/schema/migration | 会共享故障域与数据所有权 |
| 产品 worker/端口/凭据文件 | 会造成运行时冲突和安全泄露 |
| 产品 release evidence | 验收与发布必须独立签署 |

## Run/Stage 最小合同

边界能力的持久化执行至少应表达：

- `run_id`、capability 与 contract version；
- stage 名称、尝试次数、状态与时间；
- 输入/输出的安全摘要或 artifact reference；
- provider/profile/credential reference（永不包含凭据值）；
- 规范化错误分类、可重试性、幂等键与取消/超时语义；
- 合规门禁结果和需要人工确认的 checkpoint。

产品可用自己的数据库实现这些概念，但共享合同不得要求共用一张表或一个产品数据库。

## 自动发布/发稿能力的抽取顺序

1. 联合盘点 GEO-SEO 与 castr 已有实现、外部 provider、失败模式和合规要求；盘点阶段不复制代码。
2. 定义最小 Capability/Port、错误模型、幂等语义、credential reference 和门禁。
3. 为两仓各写 consumer contract tests，并先确认现状差异。
4. 提交迁移方案与逐产品回滚路径，确定独立共享包/服务的所有权与版本策略。
5. 只抽取无产品领域逻辑的 adapter/gate；产品 UI 与编排留在各自仓库。
6. 先由单一产品灰度消费，再让另一产品升级依赖；两边独立验收、独立发布。

## 结构性改造门禁

以下材料缺一不可，且必须先于实现：

1. 版本化接口合同；
2. GEO-SEO 与 castr 各自的迁移方案；
3. 可执行回滚方案与已知数据影响；
4. 两项目独立运行的 contract tests；
5. 安全、合规、凭据和真实发布的人工 checkpoint；
6. 独立 reviewer 与 G1/G2 验收人。

未经上述门禁，不得以“去重”名义移动、复制或合并两仓业务代码。
