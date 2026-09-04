# GEO-SEO Offline Worker Runtime Profile v1

> **Status: PROPOSED / NOT IMPLEMENTED / NOT RELEASE APPROVED**
> Owner: GEO-SEO（iMac custody coordinator）
> Contract: geo-seo.worker-runtime-profile.v1
> Date: 2026-09-04 (Asia/Hong_Kong)
> Revision: v1.1 addendum — closes the HF-P2 receipt-loader and test-lease gaps; runtime contract id remains v1

本文件是 GEO-SEO 产品内的 Harness-first 合同草案，定义 effect capability、worker runtime profile、装载/调用门禁、队列隔离和证据接口。它不是实现、生产配置、发布批准或 CASTR 业务合同。实现前必须独立 reviewer 复核，并由独立 task 按本文档 lease 实施。

## 1. Problem and evidence

### 1.1 已确认问题

现有 src/workers/index.ts 在模块顶层 eager import 并创建 page-audit、geo-run、content-analysis、report、scheduler、cms-publish 和 distribution worker。入口还注册 scheduler repeat jobs、安装 brand-monitor timer，并在启动约 5 秒后无条件执行 runBrandMonitorTick()。

所以 GEO_RUN_MOCK_LLM=true 只替换 LLM provider，不等于离线 worker：完整 worker 仍可能读取搜索配置、执行 brand monitor 并访问搜索来源；被挂载的发布和调度组件也不会因 LLM mock 自动消失。

### 1.2 证据来源

docs/handoff/IMAC_PRIMARY_M0_TRUST_REPLAY_EVIDENCE_20260904.md 记录：

- mock LLM 运行中，完整 worker 仍访问本机 SearXNG 配置以及 Bing、DuckDuckGo、360 等公共搜索来源，并在隔离数据库写入 brand mentions；
- worker 外部网络隔离为 FAIL，不能报告为离线通过；
- 根因是完整 worker eager mounting 与 brand-monitor startup tick，不是 mock LLM 输出；
- 未观察到 credentialed provider、CMS、分发、通知、发稿、付费或其它外部写入，但只读网络越界已经足以阻断离线信任基线；
- 先前 Compose 验证曾将端口发布到 0.0.0.0，后续已清理；offline profile 不得复用该默认暴露方式。

本合同只处理 worker runtime 与 effect boundary。依赖漏洞、PDF/Chromium runtime、API 首次改密响应等仍由独立 task 处理。

## 2. Universal SafetyFloor

SafetyFloorV1 是所有 profile（包括 legacy-all-v0）之上的不可覆盖约束。profile 只能收窄能力，不能授予用户、caller 或 worker 原本没有的权限。

1. 真实外部写入、生产数据访问和付费操作永远需要独立、明确、可追溯的用户或 PO 授权。profile、provider、环境变量、job payload 或 caller 自报 approval=true 都不能替代授权。
2. external-write 默认 deny；legacy-all-v0 也默认 deny，不得以兼容旧行为为理由绕过审批。
3. CMS、分发、通知、生产数据库写入、付费 API、真实发稿和其它外部 side effect，必须在可信 approval store 验证后才可能进入边界 invoke；本 v1 合同不提供授予这些权限的 profile。
4. approval 的有效结果只能来自可信存储验证，并产生 approvalCheckpointRef；该 ref 只引用 checkpoint，不携带 token、cookie、密钥、完整配置或批准正文。
5. 未知 outcome、超时后可能已产生副作用、无法证明幂等或无法验证授权时，一律停止盲重试并转 reconciliation。
6. 任何 profile 都不得通过 per-run override、legacy wrapper、动态插件或 provider adapter 放宽 SafetyFloor。

## 3. Effect capability vocabulary

Capability 是稳定的 effect seam，不是产品领域编排。新增 effect 必须增加合同版本或经过兼容性评审。

### 3.1 CapabilityName v1

| CapabilityName | effect | 边界责任 | offline-test-v1 |
|---|---|---|---|
| search.query | 搜索读取 | 受控 search adapter；不得拥有产品编排 | synthetic builtin:llm-simulation |
| llm.complete | 模型推理 | 受控 LLM adapter；标记 provenance | synthetic builtin:mock |
| product-state.read | 产品状态读取 | 通过产品内稳定 state port 读取 DB/Redis | isolated-state |
| product-state.write | 产品状态写入 | 通过产品内稳定 state port 写 DB/Redis | isolated-state |
| web.crawl | 页面网络读取 | 仅 allowlist/fixture contract | deny |
| notification.send | 通知发送 | recipient policy、审批、幂等 | deny |
| schedule.register | 注册周期任务 | 只注册授权产品任务 | deny |
| retention.execute | 数据归档/清理 | 只使用授权 retention policy | deny |
| artifact.write | 写文件或对象 artifact | 仅文件/对象存储；不代替产品状态或运行证据 | deny |
| cms.publish | CMS 外部写入 | 独立 publish profile、审批和 reconciliation | deny |
| content.distribute | 内容外部分发 | 独立 publish profile、审批和 reconciliation | deny |

CapabilityNameV1 的封闭枚举为 search.query、llm.complete、product-state.read、product-state.write、web.crawl、notification.send、schedule.register、retention.execute、artifact.write、cms.publish、content.distribute。未知名称必须按 deny 处理。

geo.run、content.analysis、report.generate、page.audit、brand.monitor 等是 GEO-SEO 产品编排或工作流名称，不是 CapabilityName；必须通过一个或多个 effect capability 完成工作。

### 3.2 WorkerId、RuntimeComponentId、TriggerId

三种身份不可互相替代：

- WorkerId 是产品 worker 身份：geo-run、page-audit、content-analysis、report、brand-monitor、scheduler、cms-publisher、distribution。
- RuntimeComponentId 是运行时组件/adapter 身份，格式为 worker/<worker-id>、adapter/<capability>/<provider-ref>、runtime/<name> 或 sink/<name>。例：worker/geo-run、adapter/llm.complete/builtin:mock。
- TriggerId 固定为 manual、operator-replay、scheduled、retry、system-startup。

Worker 到 capability 是多对多：

| WorkerId（产品编排） | 可能使用的 effect capabilities |
|---|---|
| geo-run | search.query、llm.complete、product-state.read、product-state.write；notification.send 必须注入 deny/null port |
| content-analysis | llm.complete、web.crawl、product-state.read、product-state.write、artifact.write |
| page-audit | web.crawl、llm.complete、product-state.read、product-state.write、artifact.write |
| report | product-state.read、artifact.write；未来 document.render（新合同） |
| brand-monitor | search.query、product-state.read、product-state.write |
| scheduler | schedule.register |
| cms-publisher | cms.publish |
| distribution | content.distribute |
| alert/retention 编排 | notification.send、retention.execute |

上表是 registry 候选关系；profile 和 policy 仍可拒绝任意 effect。现有 index.ts eager mounting 不构成合法 registry。

## 4. Stable interfaces and decisions

### 4.1 ExecutionContextV1

ExecutionContextV1 是传给 CapabilityPort 的最小调用上下文，只含以下字段。不得加入完整 profile、credentialRef、caller policy 或 caller 自报 approval。

~~~ts
type ExecutionContextV1<TInput extends InputRef = InputRef> = {
  runId: string;
  stageId: string;
  attempt: number;              // integer >= 1
  trigger: TriggerId;
  idempotencyKey: string;       // stable, non-secret
  input: TInput;                // controlled reference, not secret payload
  deadline?: string;            // RFC 3339 UTC
};
~~~

InputRef 只能引用产品允许的输入或 artifact；不得内嵌 Authorization、cookie、密码、token、完整 URL query 或隐藏推理。ExecutionContext 不携带授权结论；授权由边界层独立验证。

### 4.2 CapabilityPortV1

~~~ts
interface CapabilityPortV1<TInput extends InputRef, TOutput> {
  readonly capabilityName: CapabilityName;
  execute(context: ExecutionContextV1<TInput>): Promise<TOutput>;
}
~~~

CapabilityPortV1 是业务 core 依赖的稳定 interface。provider SDK、profile、网络策略、credential resolver、Queue、数据库和 approval store 不得成为 port 参数。adapter 只能在 BoundaryBinding 完成后实现该 interface。

### 4.3 ProductStatePortV1

ProductStatePort 是 GEO-SEO 产品内稳定 state seam，与 EvidenceSinkPort 和 artifact.write 分离：ProductStatePort 读写产品 DB/Redis 状态；EvidenceSinkPort 只保存可重建的运行/门禁证据；artifact.write 只写文件或对象 artifact。

~~~ts
interface ProductStatePortV1 {
  read(context: ExecutionContextV1<ProductStateQueryRef>): Promise<ProductStateSnapshotRef>;
  write(context: ExecutionContextV1<ProductStateChangeRef>): Promise<ProductStateReceiptRef>;
}
~~~

offline ProductStatePort 只能绑定 resource receipt 证明的 task-isolated PostgreSQL/Redis；不得通过字符串、默认连接或共享数据库扩大 scope。产品状态写入成功不等于 EvidenceSink 已记录，反之亦然。

### 4.4 BoundaryBindingV1

~~~ts
type BoundaryBindingV1 = {
  runtimeComponentId: RuntimeComponentId;
  capabilityName: CapabilityName;
  profileId: 'offline-test-v1' | 'production-v1' | 'legacy-all-v0';
  policyFingerprint: string;      // non-secret hash/reference
  providerRef?: ProviderRef;
  credentialRef?: CredentialRef;
  queueBinding?: QueueBindingV1;
};
~~~

BoundaryBinding 只存在于边界层，不下传 ExecutionContext。调用方不能用 binding 自报 policy 或 approval；binding 必须由 resolver 按 profile registry 构造并冻结。

provider-backed capability 必须提供 ProviderRef；product-state.read/write 等非 provider capability 禁止伪造 ProviderRef，它们只使用 receipt-bound InfrastructureBinding/ProductStatePort。credentialRef 只能与已允许的 provider-backed capability 同时出现。实现应使用 discriminated binding 或等价的严格 schema 表达这一约束。

ProviderRef 和 CredentialRef 语法：

~~~text
ProviderRef  = builtin:* | provider://name@version
CredentialRef = env:UPPER_CASE | secret://path#version
~~~

offline-test-v1 的 CredentialRef 集合必须为空，不调用 credential resolver；只使用 builtin:llm-simulation 与 builtin:mock。production-v1 只在 parse 阶段验证 reference shape；获准 invoke 到达 adapter 边界后才允许 resolver 解析值。值不得进入 port、decision、日志或 evidence。

### 4.5 分层结果合同

~~~ts
type PolicyDecisionV1 = {
  decision: 'allow' | 'deny' | 'defer';
  reasonCode: 'MOUNT_ALLOWED' | 'INVOKE_ALLOWED' | 'PROFILE_NOT_ALLOWED'
    | 'CAPABILITY_NOT_MOUNTED' | 'TRIGGER_NOT_ALLOWED' | 'NETWORK_DENIED'
    | 'APPROVAL_REQUIRED' | 'CREDENTIAL_REFERENCE_INVALID'
    | 'DEPENDENCY_UNHEALTHY' | 'IDEMPOTENCY_CONFLICT' | 'POLICY_VIOLATION';
  profileId: 'offline-test-v1' | 'production-v1' | 'legacy-all-v0';
  policyFingerprint: string;
  approvalCheckpointRef?: string;
};

type StageOutcomeV1 = {
  status: 'success' | 'failed' | 'unknown' | 'cancelled';
  reasonCode?: 'TIMEOUT' | 'PROVIDER_RETRYABLE' | 'PROVIDER_NON_RETRYABLE'
    | 'OUTCOME_UNKNOWN' | 'POLICY_VIOLATION';
  outputRef?: string;
  evidenceRef?: string;
};

type RetryDispositionV1 = {
  disposition: 'retry' | 'do-not-retry' | 'reconcile-first';
  nextAttempt?: number;
  retryAfterMs?: number;
  reasonCode: 'SAFE_IDEMPOTENT' | 'RETRY_BUDGET_EXHAUSTED'
    | 'NON_RETRYABLE' | 'UNKNOWN_SIDE_EFFECT' | 'APPROVAL_REQUIRED';
};
~~~

PolicyDecision、StageOutcome、RetryDisposition 不是同一个枚举。PolicyDecision 只含 profile id 和 policy fingerprint 作为上下文身份，不含 providerRef、credentialRef、完整 profile、caller policy 或 secret。approvalCheckpointRef 只有 trusted approval store 验证成功时才可产生。allow 只表示可尝试 effect，不表示业务成功；external-write 在响应前断连时为 unknown + reconcile-first，不得直接 retry。

## 5. WorkerRuntimeProfileV1

### 5.1 Strict schema

~~~ts
type QueueBindingV1 = {
  logicalName: string;
  prefix: string;                 // controlled Bull/BullMQ prefix
  scopeId: string;                // task/environment scope, non-secret
};

type InfrastructureBindingV1 = {
  kind: 'postgres' | 'redis' | 'web';
  bindingId: string;
  addressHost: string;             // exact host, never wildcard
  addressPort: number;
  networkMode: 'docker-internal' | 'loopback';
  resourceReceiptRef: string;      // proves ownership/isolation
};

type WorkerRuntimeProfileV1 = {
  profileId: 'offline-test-v1' | 'production-v1' | 'legacy-all-v0';
  contractVersion: 'geo-seo.worker-runtime-profile.v1';
  enabledWorkers: WorkerId[];
  allowedTriggers: TriggerId[];
  capabilityPolicies: Record<CapabilityName,
    'deny' | 'synthetic' | 'isolated-state' | 'allowlisted'>;
  providerEgress: 'deny' | 'allowlisted';
  providerAllowlist: string[];     // policy ids/ProviderRefs, never URLs/secrets
  infrastructureConnections: InfrastructureBindingV1[];
  queueBindings: QueueBindingV1[];
  providerBindings: BoundaryBindingV1[];
  externalWrite: 'deny';           // v1 SafetyFloor
  humanApprovalForExternalWrite: true;
  evidence: 'contract-only' | 'required';
};
~~~

严格要求：

- profileId、version、worker/trigger 集合、egress、allowlist、binding、queue prefix 和 evidence mode 都是受控字段；不接受任意 JSON merge。
- capabilityPolicies 必须覆盖 CapabilityNameV1 的完整封闭枚举；未知或缺失 capability 的有效 policy 一律为 deny，不允许继承宽松默认值。
- addressHost/addressPort 必须与 task resource receipt 精确匹配；不使用 broad loopback allow，字符串也不是 DB/Redis 隔离证明。
- providerEgress=deny 时 providerAllowlist 必须为空；禁止本机 SearXNG、代理、DNS fallback、redirect 和公网 provider。
- profile 缺失、未知、重复、版本不兼容、越权字段、namespace 不匹配、invalid reference 或 receipt 缺失都 fail closed。
- externalWrite 固定 deny；future publish profile 必须升级合同，不得由本 profile 或 per-run 参数授予写权限。

### 5.2 Exact precedence and field allowlist

配置合成顺序固定为：

1. Schema validation：只确定类型和必填性；不选择默认 profile，不默认 egress、worker 或 credential。
2. Immutable profile bundle：确定 profileId、version、enabledWorkers、allowedTriggers、capability policy、provider mode、queue prefix 和 side-effect floor。
3. Task resource receipt：只注入精确 DB/Redis/web binding、scopeId 和 receipt reference。
4. Environment/provider registry：只提供 profile 已 allowlist 的 ProviderRef/CredentialRef shape；不改变 capability、egress、worker、queue prefix 或 approval。
5. Per-run allowlist：仅允许 runId、stageId、attempt、trigger、idempotencyKey、input、deadline；不能覆盖 profile、binding、policy、provider、credential、approval 或 namespace。

未列出的字段在每层都拒绝；后层只能收窄前层，不能扩大权限。选择只接受受控 profile reference，例如 WORKER_RUNTIME_PROFILE=offline-test-v1，不接受完整 profile JSON 或 .env 内容。

### 5.3 Selection and fail-closed order

专用 entrypoint 的顺序：

1. 在 clean environment 中读取唯一 profile selector 和 task resource receipt reference；
2. 解析并校验 profile/schema/precedence/SafetyFloor；
3. 执行 pre-import 静态 manifest 检查：只检查 allowlisted import paths、runtime component manifest、禁止 eager side-effect 标记；不能以此推断 provider 健康；
4. 验证精确 infrastructure receipts、queue bindings 和 provider reference shape；
5. 配置错误以 exit 78 终止；输出只能含 profile id、field name、reason code 和 evidence ref；
6. 通过后才动态 import/mount allowlisted worker 和 adapter；
7. 最后创建 Queue/consumer、注册 schedule、安装 timer 或进入 ready。

resolver 必须早于任何 env file 读取、Prisma import、Redis/BullMQ import、provider SDK import、browser import 或 worker factory import。旧 load-env.ts 不满足此顺序。

### 5.4 HF-P2 bootstrap construction boundary

HF-P2 只交付可验证的 bootstrap/mount boundary，不交付真实 worker invocation。它必须保持以下三层输入分离：

1. `WORKER_RUNTIME_PROFILE` 只选择编译进 `mount-registry.ts` 的 immutable profile bundle；不得从 env、JSON 字符串或任意文件构造 profile。
2. `OFFLINE_RESOURCE_RECEIPT_REF` 只接受已经过 P1 validator 的 `ResourceReceiptRefV1` 形状；它是非敏感身份，不是文件路径或连接信息。
3. receipt bytes 只能通过注入的 `TaskResourceReceiptFileReaderV1` port 取得；未来 HF-PR adapter 必须使用 opaque task-root directory handle 与固定文件名 `receipt.json`，不得从 env、profile、job payload 或任意绝对路径选择文件。缺任一输入、身份不一致或 reader/verifier 不可信都以 exit 78 fail closed，不得默认 legacy、共享 DB/Redis 或 localhost。

receipt envelope 的 exact schema 为：

~~~ts
// Runtime syntax: /^receipt:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.
// The brand is produced only by the P1 validator; raw strings are untrusted.
type ResourceReceiptRefV1 = string & { readonly __brand: 'ResourceReceiptRefV1' };

type TaskResourceReceiptV1 = {
  scopeId: string; // /^[a-z][a-z0-9-]*$/
  infrastructureBindings: InfrastructureBindingV1[];
  queueBindings: QueueBindingV1[];
};

type SignedTaskResourceReceiptEnvelopeV1 = {
  schemaVersion: 'geo-seo.task-resource-receipt.v1';
  issuerId: string;        // /^[a-z][a-z0-9-]*$/
  keyId: string;           // /^[a-z][a-z0-9-]*$/
  issuedAt: string;        // RFC 3339 UTC
  expiresAt: string;       // RFC 3339 UTC; maximum TTL 15 minutes
  nonce: string;           // cryptographically random, single-use safe identifier
  audience: string;        // exact approved candidate/image identity
  purpose: 'validate-only' | 'network-none-contract' | 'internal-e2e';
  receiptRef: ResourceReceiptRefV1;
  receipt: TaskResourceReceiptV1;
  payloadDigest: `sha256:${string}`;
  signature: `ed25519:${string}`;
};

type TrustedTaskRootHandleV1 = unknown & {
  readonly __brand: 'TrustedTaskRootHandleV1';
};

interface TaskResourceReceiptFileReaderV1 {
  load(receiptRef: ResourceReceiptRefV1,
       taskRoot: TrustedTaskRootHandleV1,
       fileName: 'receipt.json'): Promise<unknown>;
}

interface TaskResourceReceiptVerifierPortV1 {
  verify(envelope: unknown): Promise<
    | { ok: true; receipt: VerifiedTaskResourceReceiptV1 }
    | { ok: false; reasonCode: 'RECEIPT_INVALID' | 'RECEIPT_EXPIRED'
        | 'RECEIPT_ISSUER_UNTRUSTED' | 'RECEIPT_SIGNATURE_INVALID' }
  >;
}
~~~

上面的 `InfrastructureBindingV1` 与 `QueueBindingV1` 是 §5.1 的 exact shapes；它们、`TaskResourceReceiptV1` 和 signed envelope 顶层都拒绝未知字段。每个 `infrastructureBindings[].resourceReceiptRef` 必须通过同一个 `ResourceReceiptRefV1` validator、在集合内唯一并受签名 payload 覆盖；每个 `queueBindings[].scopeId` 必须与 `receipt.scopeId` 完全一致，queue prefix 也必须满足对应 profile/scope 合同。`resolveRuntimeProfileV1()` 仍对完整 infrastructure/queue exact set、scope 和 precedence 做最终验证。

file reader 只负责安全载入，绝不自行授予 authority。它必须从可信 launch adapter 提供且已经打开的 task-root directory handle 内解析固定单一文件名，不能把 env 路径当作 trust root；用 `openat(..., O_RDONLY|O_NOFOLLOW)` 或语义等价的 descriptor-confined primitive 打开，并在同一 file descriptor 上 `fstat`、限长读取最多 `65,536` raw bytes、再次 `fstat`，要求 regular/current-uid/`0600` 且 device/inode/size/mtime 不变。task root handle 只能由 HF-PR adapter 对固定 container mount `/run/geo-offline`（或测试注入目录）执行 no-follow directory open 后产生，root 必须 current-uid、`0700`、非 symlink；平台无法提供等价原语时 fail closed。`OFFLINE_RESOURCE_RECEIPT_FILE`/目录路径变量不属于配置合同，存在即拒绝。原始路径、文件内容、地址和端口都不输出。

authority 只来自 `TaskResourceReceiptVerifierPortV1`。它使用 coordinator-approved、out-of-band immutable trust anchor 按 `issuerId + keyId` 查 Ed25519 public key；trust anchor 绝不从 envelope、receipt、env 或同一目录读取。先按 RFC 8785 对除 `payloadDigest`/`signature` 外的 exact fields 做 canonicalization，验证 SHA-256 digest，再验证 signature；同时验证 issued/expiry、最多 15 分钟 TTL、最多 60 秒 clock skew、exact audience/purpose 和 replay cache。replay port 必须在 verifier 返回成功前对 `issuerId + keyId + nonce` 做原子 consume-once；下游失败也不得释放或复用，进程崩溃后保持 consumed 直到 expiry。每个 process/stage 必须得到不同的 signed receipt ref 与 nonce；replay store 状态未知、不可达或原子性无法证明时一律 fail closed。任何 unknown issuer/key、过期、重放、audience/purpose 不匹配、schema/digest/signature/字段错误都拒绝。只有 verifier 产生的 opaque `VerifiedTaskResourceReceiptV1` 才能进入 `resolveRuntimeProfileV1()`；同 uid 自写 `0700/0600` 文件、regex/brand 或 ref 字符串相等都不构成权威证明。

HF-P2 只定义并注入 file-reader/verifier ports，不实现 descriptor-confined reader，也不包含真实 trust anchor、issuer 或 signing key。测试可以注入 memory file reader 和 deterministic fake verifier，以证明 gate 顺序；但默认 standalone CLI 缺任一真实 adapter 时必须以 exit 78 `RESOURCE_RECEIPT_READER_UNAVAILABLE` 或 `RESOURCE_RECEIPT_VERIFIER_UNAVAILABLE` 失败，不能把测试 adapter 当 production fallback。真实 reader、issuer/verifier adapter、trust-anchor lifecycle、rotation/revocation 和 replay store 必须另立 `HF-PR-resource-custody` 合同/lease；其 PASS 是 HF-P3 真实 worker/network 运行的前置门。所有 filesystem、JSON、canonicalization、crypto 和 verifier 异常都归一化为稳定 reason code，不输出 raw error、stack、path、envelope 或 payload。

`mount-registry.ts` 只包含冻结的 opaque component/capability/factory-id registry 和一个可注入的 importer boundary；它不包含 module specifier，也不导入或传递到业务模块。HF-P2 的记录型 fake importer 只能证明 deny/invalid 输入调用次数为 0、全部 gate 通过后 boundary 才恰好被调用，不能证明真实 module map 封闭。真实 factory-id→static module specifier map 由 HF-P3 的新 `src/workers/offline-import-map.ts` 独占，并由新 `tests/contracts/offline-import-closure.v1.test.ts` 证明每个 specifier 是静态 allowlist、无 profile/receipt/env/payload 拼接且递归 import graph 合规。

HF-P2 的默认 CLI 不构造 importer。其唯一模式 authority 是命令行 flag，且只接受恰好一个 `--validate-only`：它在所有 resolver、static-manifest、receipt 和 queue gate 通过后才可能返回成功，但 verifier port 缺失时仍必须 fail closed。`OFFLINE_VALIDATE_ONLY`、`OFFLINE_RESOURCE_RECEIPT_FILE` 和任意 receipt-directory env 都不属于配置合同，存在该变量、缺失/重复 flag 或任何未知参数都以 exit 78 拒绝，不能形成第二套 precedence 或路径 authority。任何真实 mount/invoke 模式在 HF-P3 前同样以 exit 78 和稳定 reason code 拒绝。这不是实际业务 worker、provider 或网络执行证据。

HF-P2 两个源码及两个测试的静态 import graph 只允许 P1 harness 模块、相对的 P2 模块、Vitest/TypeScript 类型以及 CLI 参数解析所需的无副作用 Node 标准库；不得 import `node:fs`/crypto/network 或实现 HF-PR adapter。禁止直接或传递到 `src/workers/index.ts`、`load-env.ts`、任何业务 worker、Prisma、Redis/BullMQ、search/LLM provider、alert/mailer、crawler/browser、scheduler、brand monitor、publisher 或任意外联库。P2 通过不改变旧 `pnpm worker`、`Dockerfile.worker` 或 production entrypoint；它只证明新入口边界可继续进入 HF-PR/HF-P3。

## 6. Exact profile semantics

capabilityPolicies 的完整基线如下；表外、未知或缺失 capability 均为 deny。allowlisted 仍受 SafetyFloor、可信授权、resource receipt 和 invoke gate 约束，不代表用户权限。

| CapabilityName | offline-test-v1 | production-v1 | legacy-all-v0 |
|---|---|---|---|
| search.query | synthetic | allowlisted | allowlisted |
| llm.complete | synthetic | allowlisted | allowlisted |
| product-state.read | isolated-state | allowlisted | allowlisted |
| product-state.write | isolated-state | allowlisted | allowlisted |
| web.crawl | deny | allowlisted | allowlisted |
| notification.send | deny | deny | deny |
| schedule.register | deny | allowlisted | allowlisted |
| retention.execute | deny | allowlisted | allowlisted |
| artifact.write | deny | allowlisted | allowlisted |
| cms.publish | deny | deny | deny |
| content.distribute | deny | deny | deny |

### 6.1 offline-test-v1

用途：parser/bootstrap、纯合同测试和离线安全回归；不是当前已实现或 release-cleared 的运行模式。

- enabledWorkers 固定只有 geo-run；content-analysis、report、page-audit、brand-monitor、scheduler、cms-publisher、distribution 均不 mount，需 v1.1/独立合同。
- search.query 只允许 synthetic builtin:llm-simulation；llm.complete 只允许 synthetic builtin:mock；二者必须带 synthetic provenance。
- product-state.read 与 product-state.write 只允许 isolated-state，并且只能绑定 receipt-bound task-isolated DB/Redis。notification.send 使用 deny/null port；web.crawl、schedule.register、retention.execute、artifact.write、cms.publish、content.distribute 全部 deny；真实 search、SearXNG、CMS、分发、通知和付费操作均 deny。
- providerEgress=deny、providerAllowlist=[]；没有 CredentialRef，不调用 credential resolver。
- allowedTriggers 固定为 manual、operator-replay、retry；retry 只适用于无外部副作用且已知幂等的合同测试；scheduled、system-startup deny。
- infrastructureConnections 只接受 task-scoped、receipt 证明的精确 PostgreSQL/Redis binding，供 ProductStatePort 与 QueueBinding 使用；优先 docker-internal；host publish 只接受 receipt 指定的 127.0.0.1:<port>，不使用 broad loopback allow；worker-only slice 不需要 web binding。
- queue prefix 必须是 task 唯一值，例如 geo-seo:offline-test:v1:<scope-id>；producer/consumer 使用同一 QueueBinding，不扫描或消费其它 namespace。
- artifact.write 继续 deny；它不能代替 ProductStatePort 或 EvidenceSinkPort。evidence=contract-only：EvidenceSinkPort 和 crash/order/permission/contract tests 完成前，不宣称真实 invocation v1 compliant。
- externalWrite=deny 且 humanApprovalForExternalWrite=true；任何 approval 也不能令本 profile 获得 external-write capability。

#### Offline dependency injection decision

HF-P3 采用明确的 dependency injection，不加载完整全局 registry：offline entry 构造 synthetic SearchPort（builtin:llm-simulation）、synthetic LLM CapabilityPort（builtin:mock）、receipt-bound ProductStatePort 和 deny/null NotificationPort，并把它们注入 geo-run 产品编排。

为保证该声明可实施：

- geoRunWorker.ts 与 channel.ts 移除对全局 search registry、全局 LLM registry、Prisma singleton 和 alert sender 的静态 import；
- search/index.ts 与 llm/index.ts 改为 manifest/动态 provider factory，选择 synthetic binding 前不得 import 真实 provider module；
- offline 不 import src/lib/alert/sender.ts，而是注入新的 deny NotificationPort；sender.ts 保留为 production adapter，进入后续独立 lease；
- ProductStatePort 只在 receipt 验证和 dynamic mount 后创建 task-isolated Prisma/Redis binding；
- queue producer/consumer 使用同一冻结 QueueBinding，不从全局 queue singleton 推导连接；
- 任一依赖仍通过全局静态 import 拉入真实 provider、mailer、alert sender、Prisma/Redis singleton 时，worker-only synthetic/network-none 证书必须失败。

### 6.2 production-v1

用途：生产候选运行时合同，不等于 release、G1/G2 或生产批准。

- baseline enabledWorkers 固定为 geo-run、page-audit、content-analysis、report、brand-monitor、scheduler；cms-publisher、distribution 不 mount，需独立 publish profile/合同。
- providerEgress=allowlisted；provider 只通过受控 ProviderRef、host allowlist、TLS、DNS/private-range、timeout、redirect 和 resource policy。
- allowedTriggers 固定为 manual、operator-replay、scheduled、retry；system-startup deny；每个 capability 仍需单独 policy。
- externalWrite=deny 是 v1 SafetyFloor；即使未来有 approval，也必须由升级后的 publish contract 验证。
- queue prefix 固定为 geo-seo:production:v1:<environment>；改变 prefix 前必须 inventory、freeze、drain、replay、接收方 ACK，producer/consumer 一致。
- infrastructure DB/Redis/web binding 必须有精确 resource receipt；字符串或连接串不构成隔离证明。
- production product-state.read/write 的 allowlisted 只表示 capability 可进入授权检查；生产数据访问仍需独立明确授权和可信 approvalCheckpointRef，profile 本身不授予权限。
- CredentialRef 只在 parse 阶段验 shape，在获准 capability invoke 边界解析；值不进入 ExecutionContext、Decision、logs 或 evidence。

### 6.3 legacy-all-v0

用途：显式迁移 wrapper 和旧 backlog 兼容回放；不安全、已弃用，不是 offline 或 release profile。

- 必须先经过同一 profile resolver、SafetyFloor、static manifest 和 resource receipt，再动态 mount；legacy 不能 bypass resolver。
- 可保留旧 worker/trigger 语义（包括 scheduler 和 brand monitor startup），但只能在 resolver 通过、dynamic mount 完成后触发；不得保留 resolver 之前的 eager import。
- providerEgress=allowlisted，allowlist 必须明确；未知 provider/network deny；本机 SearXNG 也不能作为 offline evidence。
- externalWrite=deny、humanApprovalForExternalWrite=true 固定不变。旧 publisher backlog 只能进入 defer/deny 或独立 publish reconciliation，不能自动发稿。
- 真兼容旧 Bull backlog 时，QueueBinding.prefix 必须引用现有 Bull/BullMQ prefix 的 immutable resource receipt；不得猜 prefix 或扫描他人 namespace。
- legacy product-state.read/write 访问生产或既有数据仍需独立明确授权；legacy allowlisted 不授予数据权限。
- 缺少旧 prefix、DB/Redis receipt、provider allowlist 或 profile reference 时 fail closed。
- 每次启动写脱敏弃用 evidence 并设置 sunset task；legacy 结果不能混入 offline 或 production trust evidence。

## 7. Lifecycle, mount gate and invoke gate

### 7.1 Lifecycle

~~~text
SELECTED → PARSED → STATIC_MANIFEST_CHECKED → RECEIPTS_VERIFIED
  → BINDINGS_FROZEN → MOUNTED → READY → INVOKE_CHECKED
  → RUNNING → OUTCOME_RECORDED → DRAINING → CLOSED
~~~

异常状态为 REJECTED、DEFERRED、UNKNOWN；不得自动跳过前置阶段。profile、queue、DB、授权 policy 或 active-job provider 不得热换；新 profile 使用新进程和新 namespace。

### 7.2 Mount gate

对每个 RuntimeComponentId：

1. 校验 profile/version/SafetyFloor；
2. 校验 WorkerId 与 CapabilityName registry（多对多，未注册 effect 拒绝）；
3. 校验 enabled worker、trigger 和 provider binding；
4. 校验 network/effect policy、resource receipt、QueueBinding；
5. 写 mount policy decision；
6. 之后才动态 import factory/adapter；
7. 最后创建 consumer/Queue、注册 schedule、安装 timer、browser 或 provider client。

被 deny 的组件不得 import、实例化、注册 repeat job、创建 Redis consumer、打开 browser 或安装 timer。pre-import 只能做静态 manifest 检查，不能冒充运行时健康检查。

### 7.3 Invoke gate

每个 job/stage 之前重新验证 ExecutionContext 字段、trigger、idempotency、deadline、profile fingerprint、binding 状态、stage 状态、capability policy、trusted approval store（如适用）、provider health 和 retry budget。调用方不能通过 ExecutionContext 自报 profile、credential、policy 或 approval。

PolicyDecision deny 时不调用 adapter；defer 等待可信审批或依赖；allow 只表示可尝试 effect。所有结果必须再写 StageOutcome 和 RetryDisposition。

## 8. Effect, retry and unknown outcome

| 情况 | PolicyDecision | StageOutcome | RetryDisposition | 动作 |
|---|---|---|---|---|
| profile/trigger/effect 不允许 | deny | failed | do-not-retry | 写 reason code，fail closed |
| offline 非 synthetic 或非内部网络 | deny | failed | do-not-retry | 终止，记录目标类别 |
| 无副作用/幂等 local test timeout | allow（gate 通过） | failed | retry | 遵守 retry budget，记录 attempt |
| external write 响应前断连 | allow 前置但结果未知 | unknown | reconcile-first | 保留 idempotency key，人工/adapter reconciliation |
| provider 明确不可重试 | allow 前置 | failed | do-not-retry | 不重复提交 |
| 已取消 | deny/defer | cancelled | do-not-retry | 记录取消来源和时间 |
| 可信审批缺失 | defer | —（不创建 outcome，不调用 adapter） | do-not-retry | 等待 approvalCheckpointRef |

不得把 allow 当作业务成功，不得把 unknown 当作失败后安全重试，不得用换 provider/profile 掩盖副作用不确定性。

## 9. QueueBinding and state isolation

### 9.1 QueueBinding

每个 producer/consumer 必须持有同一份冻结 binding：

~~~ts
type QueueBindingV1 = {
  logicalName: string;
  prefix: string;
  scopeId: string;
};
~~~

实际 Bull/BullMQ queue 名称由 prefix + logicalName 组合，不能使用跨 profile 裸 geo-run、scheduler 或 distribution。producer 与 consumer 任一 logicalName、prefix、scopeId 不一致，都拒绝启动或消费。

### 9.2 Rules

- offline 使用 task-unique prefix，只消费自己的 scope，绝不扫描其它 namespace；
- legacy 兼容旧 backlog 时使用 immutable receipt 证明的现有 Bull prefix；
- production 改 prefix 必须 inventory backlog、freeze producer、drain consumer、按 idempotency replay、接收方核对并 ACK 后切换；
- retry、delayed、failed、repeat metadata、locks 和 idempotency records 在同一 prefix/scope 下；
- DB 隔离由精确 resourceReceiptRef 证明实例/schema/database 和 task scope，不由 URL 字符串、数据库名称或 localhost 证明；
- profile 切换不得在 active job 上热换 DB、Redis、queue、授权 policy 或 provider；未知 stage 进入 reconciliation。

## 10. EvidenceSinkPortV1 and observability

### 10.1 Evidence sink remains unresolved

当前 durable run/stage evidence 的具体存储尚未决定。因此 HF-P1-profile 与 HF-P2-bootstrap 只能完成 parser/bootstrap、静态 manifest、binding 和 deny evidence；不得宣称真实 invocation v1 compliant、完整 offline 或 release-cleared。

未来 evidence sink 必须实现：

~~~ts
type EvidenceEventV1 = {
  sequence: number;
  runId: string;
  stageId: string;
  attempt: number;
  event: 'MOUNT_DECISION' | 'INVOKE_DECISION' | 'STAGE_STARTED'
    | 'STAGE_OUTCOME' | 'RETRY_DISPOSITION' | 'APPROVAL_CHECKED';
  profileId: 'offline-test-v1' | 'production-v1' | 'legacy-all-v0';
  policyFingerprint: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'unknown' | 'cancelled' | 'deferred';
  refs: string[];
  safeSummary?: string;
};

interface EvidenceSinkPortV1 {
  append(event: EvidenceEventV1): Promise<{ evidenceRef: string; sequence: number }>;
}
~~~

真实 invocation 合规前必须有 tests 证明写序/单调 sequence、crash/restart 不丢失或错误重复、sink 权限/scope、unknown/approval/retry 可重建，且 evidence 不含 credential value、secret、token、cookie、完整 .env、Authorization、原始 prompt 或隐藏推理。

live logs 只允许 run/stage、profile id、component、reason code、duration、计数和脱敏 provider label。URL 只能记录受控 provider label/目标分类，不能输出 query、路径参数、header 或 response body。

## 11. Environment and network boundaries

### 11.1 Old entrypoints cannot produce offline evidence

旧 pnpm worker script 会读取项目 .env；src/workers/load-env.ts 会从 cwd/父目录预读 .env；默认 tests/setup.ts 会在测试 bootstrap 阶段读取环境；完整 src/workers/index.ts 在 profile 解析前 import worker/queue/provider 依赖。

因此旧 pnpm worker、load-env.ts 和默认 tests/setup.ts 都不能产出 offline trust evidence。offline 必须使用专用 entrypoint、专用 Vitest config/setup 和 clean/allowlisted environment；不 source 项目 .env，不复制或打印 .env。

### 11.2 Egress and infrastructure

- offline providerEgress=deny 是硬门；本机 SearXNG、公共搜索、DNS fallback、proxy、redirect 和 provider SDK deny；
- infrastructureConnections 只包含 task-scoped 精确 PostgreSQL/Redis/web binding 和 resource receipt；不使用 broad loopback、localhost:* 或所有内部网规则；
- 优先 Docker internal network，不发布 host port；如必须 host publish，只接受 receipt 指定的 127.0.0.1:<port>，并由 docker inspect 核对；
- worker-only 离线证书只证明 worker path，不覆盖 web sync/API/browser/UI/cron 或完整产品网络行为；证书必须显式排除这些 sync paths，并用 manifest/contract test 禁止 worker 调用它们，不能承诺真实 API 拒绝或称全产品 offline。真实 web 行为由未来 WebRuntimeProfile lease 处理。

## 12. Migration, compatibility and rollback

### 12.1 No DB schema change

本合同不改 schema、不新增 migration、不复制产品数据库。durable evidence 若最终需要 schema，另立 migration/rollback/双 consumer contract test 合同；此前只使用独立受控 artifact/evidence store。

### 12.2 Phases

1. Contract：评审本文件和 SafetyFloor，不改 runtime。
2. Profile parser：实现 schema、precedence、reference shape 和 exit 78，不 import worker、不执行 invocation。
3. Bootstrap/mount boundary：实现 static manifest、QueueBinding、可信 file-reader seam、verifier/importer ports 和 deny evidence；只允许 geo-run 目标组件，不包含真实 verifier、module map 或 invocation。
4. Resource custody：另立 HF-PR 合同，验收可信 issuer/public-key anchor、签名/freshness/replay verifier、rotation/revocation 和 exact resource custody；未 PASS 不得进入真实 worker/network。
5. Offline geo slice：由 P3 独占 sealed import map，注入 synthetic SearchPort/LLM、receipt-bound ProductStatePort 和 deny NotificationPort，移除真实 provider/alert/DB/queue singleton 的全局静态 import，完成 network-none、queue isolation 和 worker certificate 的 web-sync exclusion；EvidenceSink 未验收前不宣称真实 invocation compliant。
6. Evidence sink：完成 append order、crash、permission、contract tests 后才扩大真实 stage evidence。
7. v1.1：分别迁移 content-analysis、report、fixture-only page-audit；report/PDF 拆成未来 document.render effect contract；web sync/API 由未来 WebRuntimeProfile lease 处理。
8. Production/publish：单独处理 allowlist、credential resolution、审批、external-write、reconciliation、image/runtime smoke；未完成不切 production。
9. Legacy retirement：inventory、freeze、drain、replay、ACK 旧 backlog 后再移除 wrapper。

### 12.3 Compatibility and rollback

- 旧 pnpm worker 只能由显式 migration wrapper 选择 legacy-all-v0；新入口缺 profile 不默认 legacy；
- legacy provider/network 仍需 allowlist 和 receipt，legacy external-write 仍 deny；
- v1 queue 不消费 v0，v0 不消费 v1；旧 backlog 迁移保留 idempotency key 和 namespace receipt；
- 每个 phase 是独立 commit/full SHA；失败时停止新 consumer，保留 evidence，回到上一已验证 SHA；
- rollback 不在 active job 上切换 queue/DB/provider；先 drain/cancel 新 scope，保留 unknown stage；
- 不删除数据库记录、artifact、evidence、旧 queue 或他人资源；本合同不授权 merge、G1/G2、release、production、真实搜索、发稿或付费操作。

## 13. Non-overlapping implementation leases

一个 task 只能写自己的文件 scope；无新 lease 不得因“只是 import/test”扩大范围。第一 slice 小，不代表所有 adapter 已门控。

依赖顺序为 `HF-P1 → HF-P2 → HF-PR-resource-custody PASS → HF-P3`。HF-PR 尚未在本合同获实现 lease；必须先另产出 interface、issuer/trust-anchor/replay-store、迁移/轮换/撤销和回滚合同并独立复审。没有 HF-PR PASS 时，HF-P2 standalone CLI 的 fail-closed exit 78 是正确结果，不是可绕过 blocker。

| Lease | 允许写入 | 禁止 | 验收重点 |
|---|---|---|---|
| HF-P0-contract | 本文件 | 所有源码、schema、queue、CI、Compose | markdown/content/sensitive scan |
| HF-P1-profile | 新 src/workers/harness/runtime-profile.ts、static-manifest.ts、queue-binding.ts；新 tests/contracts/runtime-profile.v1.test.ts、queue-binding.v1.test.ts、capability-port.v1.test.ts、capability-policy.v1.test.ts、policy-decision.v1.test.ts；新 vitest.offline.config.ts、tests/offline/setup.ts | index.ts、load-env.ts、默认 tests/setup.ts、业务 worker/provider | parser/precedence/exit-78/完整 capabilityPolicies/namespace |
| HF-P2-bootstrap | 新 src/workers/offline-entry.ts、mount-registry.ts；新 tests/contracts/offline-bootstrap.v1.test.ts、mount-registry.v1.test.ts | 真实 file reader/verifier/trust anchor/issuer/replay store、module specifier/import map、node:fs/crypto/network、业务 worker、geo channel/search/llm/alert、schema、默认 setup、package/lock、Dockerfile、offline-deny-brand-monitor/offline-deny-scheduler-publish/worker-certificate/network-none tests；测试只用 memory reader/fake verifier，不新增 tracked fixture | immutable bundle、file-reader/verifier/importer ports、exit 78、pre-import manifest、gate-order、deny/invalid importer count=0；默认 CLI 仅 validate-only且真实 adapters缺失时必须拒绝 |
| HF-P3-geo-offline | src/workers/geoRunWorker.ts、新 src/workers/offline-contract-smoke.ts、src/workers/offline-import-map.ts、src/lib/geo/channel.ts、src/lib/search/index.ts、src/lib/search/llm_simulation.ts、src/lib/llm/index.ts、src/lib/llm/tracker.ts、src/lib/geo/budget.ts、src/lib/audit/logger.ts、src/lib/queue/geo.ts、src/lib/queue/connection.ts；新 src/lib/state/product-state.ts、src/lib/state/geo-run-product-state.ts、src/lib/alert/deny.ts；新 tests/contracts/offline-import-closure.v1.test.ts 及对应 geo/channel/search/llm/state/deny-notification/queue/worker/network-none tests | src/lib/alert/sender.ts、content/report/page/brand/scheduler/publish、EvidenceSink、schema、web/API、Dockerfile；不得自带 issuer私钥或绕过HF-PR | requires HF-PR PASS；sealed static import map、injected synthetic SearchPort/LLM、isolated ProductStatePort、deny NotificationPort、QueueBinding、无真实 provider 静态 import、worker-only network-none |
| HF-P4-alert-retention | src/lib/alert/sender.ts、src/workers/retentionWorker.ts；对应 production adapter/contract tests | geo/channel/search/llm、web/API、publisher、schema | production notification/retention policy；不属于 offline v1 证书 |
| HF-P5-evidence | 新 src/workers/harness/evidence-sink.ts、evidence-sink.v1.test.ts、evidence-crash.v1.test.ts | 产品 DB/schema/migration、业务 worker、默认 setup | append order/crash/permission |
| HF-P6-v11-workers | contentAnalysisWorker.ts、reportWorker.ts、pageAuditWorker.ts、相应 effect adapters/tests；未来 document.render 独立合同 | geo/search/llm/alert、web sync、schema | each capability evidence |
| HF-P7-production-boundary | 独立 production profile/adapter/runtime/CI/container 文件，另立 lease | 产品 UI/编排/schema、CASTR | allowlist/reference/approval/runtime |
| HF-P8-publish | cmsPublisherWorker.ts、distributionWorker.ts、边界 adapters/tests；新的 publish profile contract | SafetyFloor、GEO UI/DB、CASTR | approval/idempotency/unknown |

HF-P3 planned tests 至少包括 tests/contracts/offline-import-closure.v1.test.ts、src/lib/search/index.test.ts、src/lib/search/llm_simulation.test.ts、src/lib/geo/channel.test.ts、src/lib/llm/index.test.ts、src/lib/llm/tracker.test.ts、src/lib/alert/deny.test.ts、src/lib/state/geo-run-product-state.test.ts、src/lib/queue/geo.profile.test.ts、src/workers/geoRunWorker.profile.test.ts、tests/contracts/worker-certificate-excludes-web-sync.v1.test.ts 和 tests/integration/network-none-worker.v1.test.ts。offline-contract-smoke.ts 是被现有 worker 镜像复制规则包含的源码验收入口；本合同不新增 dist 或 build pipeline lease。

`tests/contracts/offline-deny-brand-monitor.v1.test.ts` 与 `offline-deny-scheduler-publish.v1.test.ts` 也归 HF-P3；HF-P2 不得借测试名义读取或加载这些旧业务模块。HF-P2 只拥有上表两个 bootstrap/mount-registry contract tests。

geo channel、search/LLM adapter、deny NotificationPort、ProductStatePort、QueueBinding 和专用 Vitest config/setup 都有明确 owner。src/lib/alert/sender.ts 明确保留给 HF-P4，HF-P3 通过移除其全局静态 import 避免加载。web sync/API 不属于 worker-only v1；本证书只在 manifest 中明确排除，并测试 worker path 不得调用 sync path。真实 API 拒绝行为不在本合同承诺内，未来另立 WebRuntimeProfile lease。

## 14. Acceptance commands and evidence status

以下命令是实现后的验收入口；当前文档状态下 planned/not yet runnable，不是已通过证据。命令不 source 项目 .env，连接信息只来自 task-local environment/receipt。

### 14.1 P1/P2 parser/bootstrap and contract

~~~sh
corepack pnpm exec vitest --config vitest.offline.config.ts run \
  tests/contracts/runtime-profile.v1.test.ts \
  tests/contracts/queue-binding.v1.test.ts \
  tests/contracts/capability-port.v1.test.ts \
  tests/contracts/capability-policy.v1.test.ts \
  tests/contracts/policy-decision.v1.test.ts \
  tests/contracts/offline-bootstrap.v1.test.ts \
  tests/contracts/mount-registry.v1.test.ts
~~~

覆盖缺失/未知 profile、receipt ref/reader/verifier 缺失与不匹配、伪造/过期/重放/unknown issuer/坏签名的 port-level拒绝、exit 78、exact precedence、SafetyFloor 不可覆盖、CapabilityName 完整矩阵/未知或缺失 deny、reference shape、validate-only 不 import、mount boundary importer-after-gates、deny/invalid importer count=0 和 producer/consumer binding 一致性。HF-P2 测试只使用 memory reader/fake verifier；fake PASS 只能证明 port/gate wiring，不能成为 resource custody 证据。task-root/descriptor/owner/mode/symlink/size、真实 signature/trust-anchor/replay tests 归 HF-PR。HF-PR 前不得记录 standalone CLI 正向 PASS。

若 host 没有 `corepack`，可使用项目 `packageManager` 锁定的 exact `pnpm@11.25.0` 二进制替代，并在回执记录 Node/pnpm 版本；不得静默使用未知版本。

### 14.2 HF-P3 + HF-PR real Docker network-none startup/contract

BLOCKED / NO COMMAND AUTHORIZED。network-none 只验证完全无网络的 startup/contract path，不能代替 internal-only E2E；但当前合同尚未定义 HF-PR 的 exact launcher/wiring、trust-anchor/replay-store adapter 或每进程 fresh signed receipt 流程，所以不存在可运行且可据以签收的 Docker 命令。直接在 Docker 中调用 `offline-entry.ts` 无法构造真实 adapter，也不能产生正向证据。

必须先单独批准 HF-PR 合同与 exact implementation lease，并由后续合同修订给出 launcher、wiring、fresh receipt、candidate/image audience 绑定、退出码及清理命令。HF-PR PASS 与 HF-P3 sealed import map 完成前，本门禁保持 BLOCKED；不得把占位命令、默认 standalone exit 78 或测试 fake verifier 记为 network-none PASS。

### 14.3 HF-P3 + HF-PR internal-only E2E and socket sentinel

BLOCKED / NO COMMAND AUTHORIZED。完整 GEO worker E2E 最终应使用 Docker internal network，只连接 task-scoped PostgreSQL/Redis、不发布 host port，并同时运行 socket/egress sentinel；但当前没有获批的 HF-PR launcher/wiring、共享原子 replay store、每进程 fresh signed receipt 或对应清理协议，因此本合同不授权任何 internal-only E2E 命令。

后续独立合同必须为每个 process/stage 签发不同 receipt ref/nonce，并精确定义共享 replay store、内部网络、launcher、sentinel、资源清理与证据格式。获批后才可验证 worker 只连接 receipt 指定的内部 DB/Redis，且没有 public search、SearXNG、真实 provider、CMS、分发、通知或非内部访问；brand monitor/scheduler/publish 没有实例、timer、repeat job 或 consumer。它与 network-none startup/contract 是两个不同门禁，不可混称，也不能据此认证 web/API。

### 14.4 HF-P3 worker certificate exclusion and product gates

~~~sh
corepack pnpm exec vitest --config vitest.offline.config.ts run \
  tests/contracts/offline-deny-brand-monitor.v1.test.ts \
  tests/contracts/offline-deny-scheduler-publish.v1.test.ts \
  tests/contracts/worker-certificate-excludes-web-sync.v1.test.ts
corepack pnpm exec vitest --config vitest.offline.config.ts run \
  tests/integration/network-none-worker.v1.test.ts
~~~

本小节全部属于 HF-P3，不是 HF-P2 acceptance；在 HF-PR contract/PASS 前也不授权 runtime 执行。worker-certificate-excludes-web-sync.v1.test.ts 只验证证书 manifest 排除 web sync/API/browser，并禁止 worker dependency graph 调用 sync path；它不启动 API、也不承诺真实 API 拒绝行为。默认 tests/setup.ts、旧 pnpm worker 和 load-env.ts 的通过结果不能作为本 profile evidence。WebRuntimeProfile 与真实 API negative tests 需未来独立 lease。

实现相关 slice 还需按变更相关性运行：

~~~sh
corepack pnpm prisma:generate
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
~~~

这些基础门禁不自动证明 profile、network-none、internal-only E2E、approval、queue isolation 或 release。

### 14.5 Evidence checklist and current status

正式回执必须包含 repository/worktree、branch、完整 HEAD SHA、status、profile/version、完整 capabilityPolicies、policy fingerprint、QueueBinding、verified receipt ref、issuer/key id、payload digest、脱敏 scope/资源计数摘要、enabled workers、mount/invoke decisions、stage outcomes、retry dispositions、命令结果、network/container/process cleanup、未运行门禁和 rollback SHA；不得记录完整 envelope、地址、端口、路径、signature、secret 或原始错误/stack。

当前合同明确：

- Status: PROPOSED / NOT IMPLEMENTED / NOT RELEASE APPROVED；
- P1/P2 只能是 parser/bootstrap 和静态/拒绝合同，durable EvidenceSink 尚未决定；
- offline 首片只目标 geo-run：synthetic search/LLM、receipt-bound isolated product-state.read/write、deny NotificationPort；artifact/web/schedule/retention/publish/distribute 全 deny；
- 没有 implementation、真实 invocation、全产品 offline 或 G1/G2 证据；
- 不批准 merge、release、production、真实搜索、发稿、通知、付费或外部写入。

## 15. GEO-SEO and CASTR boundary

GEO-SEO 自己拥有 project/question/brand/competitor/draft/report 领域模型、UI/API、业务编排、worker payload、产品 DB/schema/migration、授权和 release state machine。effect capability 只在 GEO 边界层实现，不改变产品所有权。

CASTR 不消费本 GEO-SEO 合同，不导入 GEO-SEO 业务代码、worker、UI、编排、数据库、migration、队列或运行状态；本 task 不读取、修改或验证 CASTR。未来若两产品确实需要共享 effect seam，只能另立独立 package/service、版本、兼容策略、consumer contract tests、迁移/回滚和双方独立验收；共享概念不等于共享业务实现。
