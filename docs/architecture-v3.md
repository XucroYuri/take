# take Architecture v3 — Provider 层重构（对齐 DeepSeek Harness 范式）

> 状态：定稿 ｜ 日期：2026-08-14 ｜ 前置：docs/architecture.md（总体架构）
> 目标：独立核心 + 接缝语义 + 未来可插拔进 dsh

## 一、设计原则

1. **接缝三角（Service Definition / Service Provider / Consumer）**：Consumer 只依赖 Seam，
   不依赖具体 Provider——这是未来插 dsh 的前提。
2. **错误 = 稳定 code + cause 链**：错误码语义与 dsh `LlmError` 对齐，未来翻译零成本。
3. **retry 独立于服务**：`RetryPolicy` 是 Provider 注册元数据，执行器独立成层。
4. **适配器内部五职责分离**：wire types / 请求序列化 / 传输解析 / 块翻译 / 适配器类。
5. **长任务 = 后台 Job 协议**：对齐 dsh `ctx.jobs` 语义（start/get/kill/wait + owner 隔离）。
6. **配置 = 插件组合，秘密走凭据缝**：`apiKeyEnv` 引用 + 可挂载 credentials 提供者。
7. **注册即可逆（effect 语义）**：所有注册返回 disposer。

## 二、包结构

```
packages/provider/src/
├── seam.ts          # ProviderSeam（Service Definition 角色）
├── errors.ts        # TakeError + provider-neutral codes（对齐 dsh）
├── transport/       # httpClient（重试/限流/超时/错误分类/attribution）
├── adapters/        # openai-compatible / volcengine-ark / minimax / mock
│   └── (每适配器内部: wire/request/parse/translate/adapter 五职责)
├── jobs.ts          # JobRegistry 语义（start/get/read/kill/wait）+ jobs-local 实现
├── capabilities/    # CapabilityRegistry（对齐 dsh resolveModelInfo 心智）
├── router.ts        # CapabilityRouter（接缝消费方，不再内嵌 retry）
├── retry.ts         # RetryPolicy + 执行器（独立层）
├── config.ts        # v1/v2 配置解析与迁移
└── index.ts
```

## 三、错误模型（对齐 dsh LlmError codes）

```ts
type TakeErrorCode =
  | 'RATE_LIMIT' | 'QUOTA_EXCEEDED' | 'INVALID_CREDENTIAL' | 'MISSING_CREDENTIAL'
  | 'UNSUPPORTED' | 'TIMEOUT' | 'ABORTED' | 'NO_ADAPTER' | 'DUPLICATE_ADAPTER'
  | 'EMPTY_RESPONSE' | 'CONTEXT_WINDOW_EXCEEDED';
```

- `TakeError` 基类：稳定 `code` + `message` + `cause` 链。
- 错误分类：`retryable`（RATE_LIMIT/5xx/超时/网络）vs `non-retryable`（400/401/404）。
- 未来 take-dsh 适配层做 code 映射，不是语义重写。

## 四、Job 协议（对齐 dsh ctx.jobs）

```ts
interface JobSpec {
  kind: string;              // 'take-video' | 'take-image'
  owner: string;             // SessionId 语义，本地实现 = project path
  run: (ctrl: { signal: AbortSignal; cancel(): void }) => Promise<JobResult>;
  outputLimitBytes?: number;
}
class JobRegistry {
  start(spec): JobId;
  get(id, caller?): JobSnapshot;
  kill(id, caller?, reason?): void;
  wait(id, timeoutMs, caller?, signal?): Promise<JobSnapshot>;
}
```

本地实现：`.take/jobs.json` 事件日志 + 幂等（shot_id + 输入哈希）。未来映射 dsh `ctx.jobs.start()`。

## 五、迁移路径

| 阶段 | 内容 | 对齐点 | 状态 |
|---|---|---|---|
| P0 | 目录重构 + errors.ts + seam.ts 三角色划分 | 范式 1、2 | ✅ |
| P1 | transport（重试策略独立/限流/超时分级/attribution） | 范式 3 | ✅ |
| P2 | OpenAICompatibleAdapter 通用化（五职责）+ 同步/异步识别 | 范式 4 | ✅ |
| P3 | jobs.ts + .take/jobs.json + CLI/MCP 接线 | 范式 5 | ✅ |
| P4 | capabilities 元数据 + 预校验 | dsh resolveModelInfo | ✅ |
| P5 | 配置 v2 + v1 自动迁移 | 范式 6 | ✅ |
| P6 | retry 执行器独立接线 | 范式 3 完成态 | ✅ |
| P7 | 工程范式（AGENTS.md/Agent Note/invariant） | dsh 工程纪律 | ✅ |
| P8 | take-dsh 适配层（未来） | 方向 C 终局 | ⏳ 等真实使用验证收敛 |

## 六、与 dsh 的边界（红线）

- take 核心**不 import** dsh 任何包。
- take-dsh 适配层**不重复** take 逻辑，只做翻译（code 映射、JobSpec→ctx.jobs、工具注册）。
- 接缝语义是 take 核心与 dsh 的**唯一契约面**。
