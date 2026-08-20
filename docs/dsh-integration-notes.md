# DeepSeek Harness（DSH）阶段 A 接入核验

更新：2026-08-20
范围：阶段 0 核验结论与阶段 A 实现记录；当前只建立会话、模型传输和页面桥，不接入领域工具或持久化会话。

## 第一性原理结论

待解决的问题是让桌面端在不绕过既有领域服务、确认边界和本地数据保护的前提下，执行跨日志、复盘、主题和项目的连续任务。DSH 提供会话、Agent loop、模型—工具循环和事件流；密钥、领域校验与正式产物仍由知己 Main Process 持有。阶段 A 的最小路径是已发布核心包在 Electron Utility Process 内运行，通过 `MessagePort` 向 Main 请求模型流。阶段 B 起，现有每日反馈、周/月复盘等能力可按收益接入为领域工具，但必须复用既有校验、确认、取消与保存链路；不把当前阶段的工具空集误写成永久产品限制。

## 已核验的源码与构建

| 项目 | 证据 |
|---|---|
| 源码目录 | `D:\AI\deepseek-harness`；当前执行进程及 User/Machine 环境中均未读到 `DSH_SOURCE_ROOT`，因此本阶段按该已验证目录只读/构建。后续执行前应将同一路径设置为 `DSH_SOURCE_ROOT`。 |
| 源码版本 | Git `141eb6fef83422698aef7a981029e843e8161534`，`0.1.0-rc.8`，提交时间 `2026-08-19T23:11:50+08:00`。 |
| 运行要求 | 根 `package.json` 声明 Node `^22.19.0 || >=24.0.0`、`pnpm@11.7.0`；本机构建使用 Node `24.18.0`。 |
| 构建 | 在源码目录执行 `pnpm run build` 成功；`.dsh-build/client-build-environment.json` 更新时间为 2026-08-20 17:37:48。 |
| 上游工作树 | 构建后 `git status --short` 为空；不修改、提交或发布该上游检出。 |

## 将消费的发布包与扩展点

下列 DSH 包均已由 npm registry 读取到 `0.1.0-rc.8`；Cordis 运行时已核验为其发布的 `4.0.1`。阶段 A 必须使用普通 semver 依赖，禁止 `file:D:\...` 或复制上游源码进本仓库。

| 包与状态 | 将使用的导出符号/事件 | 源码证据 |
|---|---|---|
| `@deepseek-ai/dsh-agent`（直接使用） | `AgentRegistry.create/resume`、`Agent.followup`、`Agent.cancel`、`Agent.whenIdle`、`AgentHandle.dispose`；`cancel` 会中止当前 activity，`followup` 启动下一轮。 | `packages/core/agent/lib/types/index.d.ts`；`packages/core/agent/lib/types/runtime-types.d.ts` |
| `@deepseek-ai/dsh-agent-loop`（直接使用） | `AgentLoop` 是 `AgentFactory`，创建/恢复 Agent 和 session 的发布实现。 | `packages/core/agent-loop/lib/types/index.d.ts` |
| `@deepseek-ai/cordis`（直接使用） | DSH 服务组合运行时；`dsh-agent`、`dsh-session`、`dsh-tools` 和 `dsh-llm` 都将它声明为 peer dependency。已核验发布版本 `4.0.1`。 | `vendor/cordis/package.json`；上述包的 `package.json` |
| `@deepseek-ai/dsh-session`（直接使用） | append-only `SessionEvent`；订阅 `session/event`、`session/flush`；关键事件含 `turn/start`、`assistant/chunk`、`assistant/message`、`tool/call`、`tool/result`、`turn/end`。 | `packages/core/session/lib/types/index.d.ts`；`packages/core/session/lib/types/types.d.ts` |
| `@deepseek-ai/dsh-tools`（直接使用） | `ToolRegistry.register/execute` 与 `ToolDefinition`。每个 `zhiji.*` 工具只接收已校验参数、转发 `ToolRunContext.signal`，并返回 lossless JSON；不注册通用工具。 | `packages/core/tools/lib/types/index.d.ts` |
| `@deepseek-ai/dsh-llm`（直接使用） | `LlmRuntime.stream`、`LlmAdapter.stream`、`GenerateOptions.signal`。知己的 `ModelTransport` 负责跨进程请求；API Key 不向 Utility Process、Renderer、session 或备份暴露。 | `packages/llm/llm/lib/types/index.d.ts` |
| `@deepseek-ai/dsh-session-persistence` + `@deepseek-ai/dsh-session-persistence-jsonl`（直接使用） | `JsonlSessionPersistence` 的 `root`、`append`、`prepare`、`load`、`list`。根目录将由 Main Process 解析为当前数据目录下的 `agent/sessions/`，并纳入后续迁移/备份校验。 | `packages/session/session-persistence-jsonl/lib/types/index.d.ts` |
| `@deepseek-ai/dsh-sdk-protocol`（协议参考和子进程降级候选） | `session/prompt` 请求及 `session.event`、`session.status` 通知。 | `packages/sdk/protocol/lib/types/index.d.ts`；`packages/sdk/protocol/lib/types/types.d.ts` |
| `@deepseek-ai/dsh-sdk-client`（不作为首选） | `DeepSeekHarness`/`HarnessSession` 会启动并拥有一个 stdio runtime subprocess。仅当 Utility Process 无法运行时才评估受控 Node 子进程降级。 | `packages/sdk/client/lib/types/api.d.ts`；`packages/sdk/client/lib/types/types.d.ts` |

## 进程与工具协议

1. Renderer 只能经既有 Preload 具名 API 调用 Main Process；不导入 DSH、不会看到模型密钥。
2. Main Process 创建 Electron Utility Process，并以 Electron `MessagePort` 建立双向协议。Utility Process 保有 DSH loop 和会话状态，不持有 API Key。
3. Main → Utility：`session.start/send/cancel`、`runtime.shutdown` 与 `model.delta/completed/failed/cancelled`。Utility → Main：ready、session status、消息流、模型请求/取消与运行错误。每条消息带 sessionId/requestId，并由共享 Zod schema 解析。
4. `cancel` 映射到 DSH `Agent.cancel` 并等待 `whenIdle()`；进入领域工作流的取消继续传递既有 `AbortSignal`。工具执行必须等待已启动操作静止后才返回，不能以遗留半写入换取快速停止。
5. DSH 的 JSONL 持久化要求绝对 `root` 与每个 session 的绝对 `cwd`。阶段 A 的 Utility Process 冒烟测试必须证明 Electron Utility Process 的内嵌 Node 满足 DSH Node 要求，并验证 ESM/原生依赖在打包后可加载；失败时保持同一协议，改为受控 Node 子进程，仍不使用 Web UI。

## 发布包与源码构建的裁决

当前接入面已由发布包覆盖，且 npm registry 与已构建源码均为 `0.1.0-rc.8`，因此阶段 A 先锁定发布包。源码仅用于接口核验、构建复验与问题定位。只有阶段 A 的 Utility Process 冒烟测试证明某个必须的宿主接口未发布或打包产物不可用时，才在 `BLOCKED.md` 记录具体缺口，再决定是否构建受控外部产物；当前没有该证据，也没有理由维护上游 fork。

## 阶段 A 实现与验证

- 实际依赖为 `@deepseek-ai/cordis@4.0.1` 与 `@deepseek-ai/dsh-{agent,agent-loop,llm,session,system-prompt,tools,settings,scope,invariants}@0.1.0-rc.8`，均来自 npm 发布包；lockfile 不含外部源码 `file:` 路径。
- Utility Process 只组合 DSH 的 LLM、session、system prompt、tool registry、agent registry 与 agent loop。未加载官方默认 bundle，因为它还会安装 Shell、文件系统、技能与联网工具；这不是永久排除知己领域能力，后续能力应通过 Main Process 受校验地复用既有服务、确认与正式写入链路。
- 当前协议为 Main → Utility 的 `session.start/send/cancel`、`runtime.shutdown`、`model.delta/completed/failed/cancelled`，以及反向的 ready、session status、消息流、模型请求/取消与运行错误；每条消息使用共享 Zod schema 并带 sessionId/requestId。
- `tests/unit/dsh-runtime.test.ts` 使用真实 DSH Agent loop 与假模型 relay 验证启动、消息、流事件、完成和取消；`agent-facade.test.ts` 使用假 DSH 覆盖两轮消息、退出和崩溃中文降级；`agent-page.test.tsx` 和 schema 测试覆盖 Renderer 具名 API。
- `npm run package` 已通过；已在产物 `app.asar` 确认 `.vite/build/main.js`、`preload.js` 与独立 `.vite/build/utility.js`。
