# DeepSeek Harness（DSH）阶段 A/B/C/D1 接入核验

更新：2026-08-21
范围：阶段 0 核验结论与阶段 A/B/C/D1 实现记录；阶段 C 接入高层正式工作流，阶段 D1 接入 Agent 会话生命周期，但不绕过既有 Schema、预览、确认、取消和仓储。

## 第一性原理结论

待解决的问题是让桌面端在不绕过既有领域服务、确认边界和本地数据保护的前提下，执行跨日志、复盘和项目的连续任务。DSH 提供会话、Agent loop、模型—工具循环和事件流；密钥、领域校验与正式产物仍由知己 Main Process 持有。阶段 A 的最小路径是已发布核心包在 Electron Utility Process 内运行，通过 `MessagePort` 向 Main 请求模型流。阶段 B 起，现有每日反馈、周/月复盘等能力可按收益接入为领域工具，但必须复用既有校验、确认、取消与保存链路；不把当前阶段的工具空集误写成永久产品限制。主题讨论不再属于桌面端产品范围，继续由 Skill/CLI 按需承载。

## 已核验的源码与构建

| 项目 | 证据 |
|---|---|
| 源码目录 | `D:\AI\deepseek-harness`；当前执行进程已读取 `DSH_SOURCE_ROOT=D:\AI\deepseek-harness`，User/Machine 持久化变量未设定；本阶段只读/构建该目录，后续启动需确保进程继承该变量。 |
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
| `@deepseek-ai/dsh-session-persistence` + `@deepseek-ai/dsh-session-persistence-jsonl`（直接使用） | `JsonlSessionPersistence` 的 `root`、`append`、`prepare`、`load`、`inspect`、`list`；根目录由 Main Process 解析为当前数据目录下的 `agent/sessions/`，使用 plain JSONL，纳入迁移/备份校验。 | `packages/session/session-persistence-jsonl/lib/types/index.d.ts` |
| `@deepseek-ai/dsh-sdk-protocol`（协议参考和子进程降级候选） | `session/prompt` 请求及 `session.event`、`session.status` 通知。 | `packages/sdk/protocol/lib/types/index.d.ts`；`packages/sdk/protocol/lib/types/types.d.ts` |
| `@deepseek-ai/dsh-sdk-client`（不作为首选） | `DeepSeekHarness`/`HarnessSession` 会启动并拥有一个 stdio runtime subprocess。仅当 Utility Process 无法运行时才评估受控 Node 子进程降级。 | `packages/sdk/client/lib/types/api.d.ts`；`packages/sdk/client/lib/types/types.d.ts` |

## 进程与工具协议

1. Renderer 只能经既有 Preload 具名 API 调用 Main Process；不导入 DSH、不会看到模型密钥。
2. Main Process 创建 Electron Utility Process，并以 Electron `MessagePort` 建立双向协议。Utility Process 保有 DSH loop 和会话状态，不持有 API Key。
3. Main → Utility：`session.start/list/send/cancel`、`runtime.shutdown` 与 `model.delta/completed/failed/cancelled`。Utility → Main：ready、session status/snapshot、消息流、模型请求/取消、`tool.request/tool.cancel` 与运行错误；工具结果走 `tool.result` 回传。每条消息带 sessionId/requestId，并由共享 Zod schema 解析。
4. `cancel` 映射到 DSH `Agent.cancel` 并等待 `whenIdle()`；领域工作流的取消通过 `tool.cancel` 继续传递既有 `AbortSignal`。工具执行必须等待已启动操作静止后才返回，不能以遗留半写入换取快速停止。
5. DSH 的 JSONL 持久化要求绝对 `root` 与每个 session 的绝对 `cwd`。阶段 A 的 Utility Process 冒烟测试必须证明 Electron Utility Process 的内嵌 Node 满足 DSH Node 要求，并验证 ESM/原生依赖在打包后可加载；失败时保持同一协议，改为受控 Node 子进程，仍不使用 Web UI。

## 阶段 B：只读工具桥

- Utility Process 只注册 `zhiji.journals/reviews/projects/patterns/web` 的高层只读工具，以及 `zhiji.ui.navigate` 与 `zhiji.ui.present`；没有 Shell、文件系统、任意 URL、工作区编辑或写入/工作流工具。
- 每个 `tool.request` 在 Main Process 由 `AgentToolDispatcher` 以共享严格 Zod schema 再次解析。dispatcher 只复用现有仓储/服务方法，返回固定长度的任务摘要；绝对路径、URL、凭证和原始实现错误不会跨回 Utility 或 Renderer。
- `web.read-source` 只接收既有 `WebSearchService.search()` 返回的 `searchSessionId + sourceId`。浏览器 URL 保留在 Main 的搜索会话内，Agent 只得到标题、摘要与 sourceId。
- 工具结果、失败、活动、导航和展示卡片均走同一 MessagePort schema。Renderer 再验证 `NavigationTarget`，只映射到既有产品页面；卡片链接不是 URL，也不执行任何内容。

## 阶段 C：正式工作流桥

第一性原理复核：用户需要的是“完成一次可验证的知己闭环”，不是让 DSH 获得直接文件写权限。因此 DSH 只调用 Main Process 中已有的高层用例，工具输入和结果仍经共享 Zod；正式日志/复盘的 Markdown 仓储继续是唯一权威。

| 工具 | Main Process 委托 | 确认与安全边界 | 结果 |
|---|---|---|---|
| `zhiji.journals.create` / `journals.update` | `CreateJournal` / `UpdateJournal` | 用户明确要求后调用；复用未来日期拒绝、`journal_` ID、`expectedUpdatedAt` 乐观并发 | 仅返回日志摘要与既有日志页导航 |
| `zhiji.reviews.generate-daily` | `GenerateDailyReview` | 复用 D0-D6 证据降级、快路径、审计和原子保存；D 级只返回补证问题 | 返回每日反馈摘要与日志记录页导航 |
| `zhiji.reviews.preview-periodic` | `GeneratePeriodicReview.preview` | 返回材料摘录和 `previewToken`；Main 另签发 30 分钟内一次性 `approvalId` | Renderer 展示材料和确认按钮 |
| `zhiji.reviews.generate-periodic` | `GeneratePeriodicReview.execute` | 必须匹配同一 session 的 `previewToken + approvalId`；材料 digest 变化时仍由既有服务拒绝 | 返回脱敏复盘摘要与既有复盘页导航 |
| `zhiji.reviews.preview-insight` / `generate-insight` | `GenerateInsightReview.preview/execute` | 与周期复盘相同；模型或普通消息不能代替页面确认 | 返回脱敏洞察摘要与既有复盘页导航 |

确认不是模型输出字段：Main 进程保存短期 pending approval，Renderer 通过具名 `agent:confirm` IPC 提交按钮动作，`AgentFacade` 才向 DSH 恢复下一轮。审批项过期、会话不匹配、重复使用或 Utility 崩溃都会要求重新预览。

取消链路：DSH `ToolRunContext.signal` abort 时发送 `tool.cancel`；Main 为该 request 建立 `AbortController`，并把它连接到三类生成用例的 `ReviewTaskManager`。任务在 saving 前取消时，既有仓储不会收到保存调用；模型失败仍由既有错误和任务状态机处理。

当前接入不是永久能力上限：后续若有新的核心复盘需求，可以继续把高层能力接入，但必须先复核其必要性、确认和数据生命周期边界；不开放通用文件、Shell、任意 URL 或批量删除。

## 阶段 D1：Agent 会话生命周期

第一性原理复核：Agent 要能在重启后继续上下文，真正需要持久化的是 DSH 事件日志；正式日志、日反馈、周/月复盘和项目仍由知己既有仓储负责。因而 D1 只增加会话日志的可靠生命周期，不复制领域正文。

- Main Process 将 `dataRoot/agent/sessions/` 作为 `JsonlSessionPersistence.root` 传给 Utility Process；不会把 API Key 或凭证写入会话。
- `session.list` 调用 DSH persistence 的 `list + inspect`，只向 Renderer 投影有限长度、脱敏的 `session.snapshot`；`session.send` 对不在内存的 ID 调用 `AgentRegistry.resume`。
- `DataRootHolder.changeLocation` 已递归复制整个数据根，因此会话随数据目录迁移；`DataTransferService` 的便携路径白名单接纳 `agent/sessions/<project>/<agent>/session.jsonl`，业务校验用 DSH `Session.fromRestore` 检查 header、事件类型、顺序和序号。
- 发现损坏 JSONL 时，导出/恢复返回 `IMPORT_REJECTED`，运行时返回“会话数据损坏”并保留原文件；不静默删除、重置或降级成空会话。
- 桌面端主题思考已移除：不再初始化 `TopicThinkingService`、`TopicSessionStore` 或主题仓储；已有 `topics/` 与 `runtime/topic-sessions/` 数据不主动删除，但桌面端不再读取或写入。每日分析、周复盘和月复盘不受影响。

验证证据：`dsh-runtime.test.ts` 覆盖写入—重启—列表—resume 与损坏日志显式报错；`agent-facade.test.ts` 覆盖 snapshot 投影；`data-transfer.test.ts` 覆盖会话导出/恢复与损坏拒绝。主题范围清理后的全量回归为 `npm test` 51 files / 286 tests，Lint 为 0 error / 6 个既有 warning；D1 的 JSONL focused tests 继续通过。

## 主题思考当前裁决：从桌面端移除（2026-08-20）

主题思考只是“与 AI 讨论后沉淀认识”的辅助便利，不是复盘工具的核心闭环。继续维护独立页面、会话、提案、差异、确认和 DSH 读工具，会增加运行时、IPC、测试和文档负担；当前没有证据证明它能改善日志复盘结果。

本轮直接删除桌面端主题页面、IPC、提示词、服务、主题仓储、会话存储、主题 DSH 工具及复盘页跳转按钮。用户已有主题文件不删除，Skill/CLI 侧契约不修改；D2 不再适用于桌面端。这样把维护成本归零，同时保留用户通过 Skill 讨论和沉淀认识的路径。

## 发布包与源码构建的裁决

当前接入面已由发布包覆盖，且 npm registry 与已构建源码均为 `0.1.0-rc.8`，因此阶段 A 先锁定发布包。源码仅用于接口核验、构建复验与问题定位。只有阶段 A 的 Utility Process 冒烟测试证明某个必须的宿主接口未发布或打包产物不可用时，才在 `BLOCKED.md` 记录具体缺口，再决定是否构建受控外部产物；当前没有该证据，也没有理由维护上游 fork。

## 阶段 A 实现与验证

- 实际依赖为 `@deepseek-ai/cordis@4.0.1` 与 `@deepseek-ai/dsh-{agent,agent-loop,llm,session,system-prompt,tools,settings,scope,invariants}@0.1.0-rc.8`，均来自 npm 发布包；lockfile 不含外部源码 `file:` 路径。
- Utility Process 只组合 DSH 的 LLM、session、system prompt、tool registry、agent registry 与 agent loop。未加载官方默认 bundle，因为它还会安装 Shell、文件系统、技能与联网工具；这不是永久排除知己领域能力，后续能力应通过 Main Process 受校验地复用既有服务、确认与正式写入链路。
- 当前协议为 Main → Utility 的 `session.start/list/send/cancel`、`runtime.shutdown`、`model.delta/completed/failed/cancelled`，以及反向的 ready、session status/snapshot、消息流、模型请求/取消与运行错误；每条消息使用共享 Zod schema 并带 sessionId/requestId。
- `tests/unit/dsh-runtime.test.ts` 使用真实 DSH Agent loop 与假模型 relay 验证启动、消息、流事件、完成和取消；`agent-facade.test.ts` 使用假 DSH 覆盖两轮消息、退出和崩溃中文降级；`agent-page.test.tsx` 和 schema 测试覆盖 Renderer 具名 API。
- `npm run package` 已通过；已在产物 `app.asar` 确认 `.vite/build/main.js`、`preload.js` 与独立 `.vite/build/utility.js`。主题范围清理后全量回归为 `npm test` 51 files / 286 tests；另有会话重启/损坏显式报错与备份拒绝 focused tests。

## 阶段 E 当前收敛证据

- 生产 `app.asar` 保留 DSH 包自己的 `package.json` 相对解析，并带入 `@deepseek-ai/*`、`koffi` 与 `@koromix`；Koffi 的 `.node` 文件按 asar unpack 规则落到 `app.asar.unpacked`。这修复了启动时的 `../package.json` 与 `@deepseek-ai/dsh-session` 缺失错误。
- Electron Utility Process 按运行时契约从 `process.parentPort` 接收端口；不依赖不存在的 `electron.parentPort`。`npm run test:e2e` 使用打包后的 `app.asar` 验证 Agent 页面、新建会话、日志写入、每日反馈、周复盘和历史阅读，结果为 1 passed。
- 无 API Key 时，Main Process 仍只读取 safeStorage 中的凭证并返回中文错误；Agent 页面把该错误映射为“打开设置”动作，恢复路径仍是既有设置页，不新增密钥存储或 Renderer 读取 Key 的路径。

## 阶段 F：API 凭据恢复（2026-08-20）

- 真实截图错误对应 `safeStorage.decryptString` 无法解开旧密文（常见于切换 Electron `userData`、应用身份或 Windows 密钥环变化），不是 API 地址或模型响应错误。
- `CredentialStore.read()` 仅捕获解密失败并返回 `null`；`credentials.json` 不删除、不搬入数据目录、不降级明文。`settings:get` 因此仍能返回服务商配置和 `hasApiKey: false`，用户可在既有设置页重新保存 API Key，让当前密钥环重新加密。
- 回归：`credential-store.test.ts` 覆盖密文失配后的设置恢复语义；安全存储不可用仍返回明确错误，文件损坏仍不被静默吞掉。

## 阶段 G：DeepSeek 连接可用性（2026-08-21）

- DeepSeek 官方当前 Chat Completions 模型清单为 `deepseek-v4-flash` / `deepseek-v4-pro`；桌面端默认切换到 `deepseek-v4-flash`，`deepseek-chat` / `deepseek-reasoner` 旧配置在 `ConfigureAi.readConfig()` 中迁移，避免用户换 Key 后仍请求停用模型。
- 设置页“测试连接”现在使用 `stream: false`、`max_tokens: 1` 的短请求，只验证 API Key、模型和基础响应；正式复盘/Agent 的流式请求不变。
- 验证依据：DeepSeek API 无 Key 网络请求在本机约 250ms 返回 401；provider、旧配置迁移和设置页 focused tests 覆盖状态。

## 阶段 H：Agent 工具协议兼容（2026-08-21）

- 复现证据：普通 `deepseek-v4-flash` 请求返回 200；携带桌面端原有工具定义时，DeepSeek 返回 400，明确拒绝 `tools[0].function.name` 中的 `.`。这是 Agent 失败而每日反馈成功的直接原因。
- 修复边界：DSH 内部继续使用 `zhiji.journals.list` 等可读名称；`OpenAiCompatibleProvider` 发往兼容 API 时把非 `[A-Za-z0-9_-]` 字符转换为 `_`（并限制 64 字符），模型返回后按本次请求映射恢复内部名称，后续工具回合重新发回助手消息时也使用 API 名称。工具 action、Main Process dispatcher、权限和持久化会话不变。
- DeepSeek V4 的工具思考回合需要回传 `reasoning_content`，而当前桌面桥接协议只保存文本和工具调用；DeepSeek Agent 因此显式使用 `thinking: { type: 'disabled' }`，避免在未实现完整 reasoning replay 前产生第二类 400。普通每日/周期复盘仍保留原有生成模式。
- provider focused regression（16 tests）覆盖 API 合法工具名、内部名称恢复、后续助手工具回合和 DeepSeek Agent 非思考字段；实际 API 诊断确认转换后请求可返回 200。
