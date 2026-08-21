# 桌面端 Skill 兼容矩阵

本矩阵只约束本仓库。桌面端使用独立的兼容快照，不读取、执行或修改 Codex + `.claude/` 的运行系统。

## 第一阶段：日反馈

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 最小材料 | 目标日志、最近前次日反馈、桌面端本地审计记录 | `daily-runtime.test.ts` | 本阶段实现 |
| A-D 输入等级 | 程序生成证据卡并按等级限制模型行为 | `daily-evidence.test.ts` | 本阶段实现 |
| D 级降级 | 仅提出一个补证问题；反馈生成不调用模型、不保存反馈；判级阶段允许至多一次语义复核短调用，确认本人经历则保守升至 C，失败回落原 D | `daily-runtime.test.ts`、`generate-daily-review.test.ts`、`daily-evidence-gold.test.ts` | 本阶段实现 |
| A/B/C 级差 | 正则判级与语义判据在 B/C 边界存在级差（只影响反馈深度，不影响反馈有无），登记为已知差异，不修 | `daily-evidence-gold.test.ts` | 已知差异 |
| 昨日闭环 | 读取最近前次日反馈；无明确反证时只能标记证据不足，并将闭环状态写入本地审计 | `generate-daily-review.test.ts`、`daily-audit-recorder.test.ts` | 本阶段实现 |
| 单洞察、单行动与预测 | 使用严格 JSON Schema、确定性渲染；常规 260 字上限与例外 320 字写入提示词（不加代码硬校验） | `generate-daily-review.test.ts` | 已有，迁入 Runtime |
| 正式反馈写入 | 原子写入并由仓储复读 | `generate-daily-review.test.ts` | 已有，保留 |
| 验证沉淀写回 | JSONL 仅追加审计：记录证据等级、结果、昨日行动状态；不创建未经验证的长期模式 | `daily-audit-recorder.test.ts` | 本阶段实现 |
| 分发、提醒、飞书、滴答 | 不属于桌面第一阶段 | 不适用 | 排除 |

## 第二阶段：周期复盘（周/月/项目）

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 下游沉淀优先 | 周复盘以日反馈为主材料；月复盘以周复盘为主材料；原始日志仅在下游沉淀不足时补全文，充足时只保留索引 | `periodic-materials.test.ts`、`generate-periodic-review.test.ts` | 本阶段实现 |
| A-D 输入等级 | 程序生成周期证据卡并按等级限制模型行为 | `periodic-evidence.test.ts` | 本阶段实现 |
| D 级降级 | 仅提出一个补证问题；不调用模型、不保存复盘 | `periodic-runtime.test.ts`、`generate-periodic-review.test.ts` | 本阶段实现 |
| 复盘六问 | 使用严格 JSON Schema（chatSummary/goalReview/resultEvaluation/causesPositive/causesNegative/ifRedone/nextPlan/directionAnchors/qualitySelfCheck）、确定性渲染：标题 + 聊天摘要 + 六问一级标题（含回顾目标）+ 方向锚点缺席检查 + 质量自检，与 Skill 侧 review-synthesis 契约同构 | `periodic-review-v1.test.ts` | 本阶段实现 |
| 硬质量门 | 提示词要求证据或降级、关键判断附反例或限制；B/C 级降级标注与方向锚点缺席披露由代码强制注入质量自检，不依赖提示词自觉 | `periodic-review-v1.test.ts`、`periodic-runtime.test.ts` | 本阶段实现 |
| 方向锚点缺席检查 | 模型按五态（有推进/缺席-未执行/缺席-未记录/目标变化/证据不足）逐个标注，zod 枚举强制；空锚点时渲染显式披露 | `periodic-review-v1.test.ts` | 本阶段实现 |
| 周报深度 | 原因分析只做 3Why；下周规划必含目标 + 手段 + 检查方式 | `periodic-review-v1.test.ts` | 本阶段实现 |
| 月报深度 | 正式写报告前归并 2-3 个主主题（主题名/支持视角/关键证据/反例或证据不足/对重来或下月规划的意义），下月规划含目标+手段+检查点+假说；触发条件（长期方向冲突/重复卡点/工作观人生观冲突/只能局部修补）满足时输出一条基于证据的升级提醒，指向复盘页的方向校准（life-design），不自动生成；主主题不足时代码强制披露不硬凑 | `periodic-review-v1.test.ts`、`periodic-runtime.test.ts` | 本阶段实现 |
| 月报额外一级标题（D3） | 月报渲染额外输出 `## 主主题`、`## 方向锚点缺席检查` 一级标题；Skill 契约要求主主题只在六问内归并 | `periodic-review-v1.test.ts` | 有意差异（主主题与方向锚点的显式披露在桌面语境有价值，2026-08-14 登记） |
| 月复盘视角证据包层（D4） | Skill 侧 monthly-processor 按视角生成证据包；桌面端月复盘以周复盘为主材料，无视角证据包层 | 不适用 | 设计性差异，不实现（复刻视角层不符合桌面单次调用架构，2026-08-14 登记） |
| 材料预览与确认 | 预览材料并生成 digest；确认后才执行生成 | `generate-periodic-review.test.ts` | 已有，保留 |
| 正式复盘写入 | 原子写入并由仓储保存 | `generate-periodic-review.test.ts` | 已有，保留 |
| 分发、提醒、飞书、滴答 | 不属于桌面第二阶段 | 不适用 | 排除 |

## 第三阶段：验证模式沉淀

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 模型只能提出候选 | 从单篇复盘提取 0-3 条可验证行为假说候选，严格 JSON Schema，不落库 | `verified-patterns.test.ts` | 本阶段实现 |
| 用户确认/拒绝后才变更 | 确认后写入单一 JSON 快照；拒绝无任何持久化 | `pattern-panel.test.tsx`、`verified-patterns.test.ts` | 本阶段实现 |
| 快照完整性 | 原子写入 + Zod 复读校验；快照损坏时报错而不是静默重置 | `verified-pattern-repository.test.ts` | 本阶段实现 |
| 向量库、自动人格归纳、跨设备同步 | 不属于桌面第三阶段 | 不适用 | 排除 |

## 第四阶段：主题思考（桌面端已移除）与受控联网

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 主题讨论—提案—确认—沉淀 | 桌面端不再提供页面、IPC、会话、仓储或 DSH 主题工具；既有 `topics/` 数据不删除，但不再读写 | 无（相关桌面端实现与测试已删除） | 已移除（2026-08-20） |
| Skill 侧主题讨论 | 继续由 Skill/CLI 按需讨论并在用户确认后沉淀；不受桌面端裁决影响 | Skill 侧既有契约与测试 | 保留在桌面端范围之外 |
| DSH 受控联网 | 搜索只能由 Agent 显式调用；结果在 Main Process 的搜索会话内绑定，Renderer 不获得通用 web API | `web-search-service.test.ts`、`agent-tool-dispatcher.test.ts` | 阶段 B 实现 |
| sourceId 会话绑定 | readSource 校验搜索会话存在且 sourceId 属于该会话，拒绝伪造 ID；仅 http/https | `web-search-service.test.ts` | 本阶段实现 |
| 向量检索、自动归档、任意 URL 执行 | 不属于桌面第四阶段 | 不适用 | 排除 |

## 第五阶段：模糊意图路由（已下线）

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 模糊意图路由全链路（确定性匹配/枚举选择/澄清回退/路由映射） | 已下线（2026-08-14 用户决策）：首页意图输入框、出发/前往按钮、`intent:resolve` IPC、`intent-routing` 服务与提示词整体删除；首页保留建议下一步卡片与能力链接 | 无（相关测试已删除） | 已下线 |

## 洞察工具（coach / yearly / life-design）

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| coach ≥3 篇门槛与文案 | 与 Skill 逐字一致；取最近 40 篇 | `generate-insight-review.test.ts`、`insight-materials.test.ts` | 已有，保留 |
| coach A-D 就绪度与六步法 | 判据与 Skill 一致；六步法命名对齐方法论权威（回忆事实/筛选重点/评估结果/洞察思考/行为改进/分享讨论）；directionWarning 需四类方向信号中至少两类，单日低落或普通任务压力不触发 | `generate-insight-review.test.ts` | 本阶段实现 |
| yearly 6 份月报门槛 | 同为 6 份；<6 份桌面硬拦截（Skill 为警告继续生成部分综合），预览-确认交互下不生成残缺报告 | `insight-materials.test.ts`、`generate-insight-review.test.ts` | 设计性差异，登记 |
| yearly 升级提醒 | 四类触发条件（长期方向冲突/重复卡点/工作观人生观冲突/无法局部优化）满足时追加提醒，指向复盘页方向校准入口，不出现命令字样、不输出方向校准报告内容 | `generate-insight-review.test.ts` | 本阶段实现 |
| yearly 输出结构 | 简洁五要素自由 Markdown（Skill 为 13 节固定长报告），桌面定位轻量本地复盘 | `generate-insight-review.test.ts` | 设计性差异，登记 |
| life-design 材料与输出 | 月>周>日复盘 + 日志混排取 40 条；问题重述/张力与资源/两个方向/7 天实验/可观察判据/下次如何验证；仅 quick 模式（Skill 另有 standard/full/odyssey） | `generate-insight-review.test.ts`、`insight-materials.test.ts` | 本阶段实现；仅 quick 为设计性差异 |
| 材料预览与确认 | 三链路同一预览-digest 确认门 | `generate-insight-review.test.ts` | 已有，保留 |
| standard/full/odyssey 模式、部分综合 | 不属于桌面端洞察范围 | 不适用 | 排除 |

## 数据平面（D1 已知差异）

| Skill 侧数据面 | 桌面端数据面 | 差异与用户后果 | 状态 |
|---|---|---|---|
| 日志 `日志/YYYY-MM-DD.md`、复盘 `复盘/每日反馈/YYYY-MM-DD.md` 等（`.claude/shared/paths.md` 契约） | 日志 `journals/{年}/{日期}--{id}.md`、复盘 `reviews/{type}/...`（独立目录结构与 frontmatter 格式） | 双轨数据互不可消费：文件命名与格式完全非对称，同时使用两套系统时，任一侧的复盘/昨日闭环/材料选择都读不到另一侧记录，用户需重复录入；单轨使用无影响 | 已知差异（2026-08-14 登记）；若实际双轨使用，优先评估“桌面端导出→Skill 目录导入”单向只读桥，不做双向互通 |

## DSH Agent 阶段 A/B/C/D1

| 现有能力 | 当前 Agent 行为 | 后续接入方式 | 状态 |
|---|---|---|---|
| 日反馈、周/月/项目复盘、验证模式与项目 | 继续由既有页面、应用服务、Schema、预览确认与仓储负责 | DSH 以 Main Process Zod 校验的只读摘要工具读取日志/复盘/项目/验证模式；阶段 C 另以高层工具调用日志保存、每日反馈及周期/洞察复盘，仍不重写或绕过正式产物链路 | 阶段 B 只读接入；阶段 C 已接入日志与正式复盘桥，D1 不改变既有专业入口 |
| Agent 会话与重启 | DSH 事件日志写入当前数据根 `agent/sessions/`，Agent 页列出并恢复会话 | Main 只传递数据根；Utility 使用官方 `JsonlSessionPersistence`，`session.list` 投影有限长度 snapshot，继续消息调用 `AgentRegistry.resume` | 阶段 D1 已实现 |
| Agent 会话备份与迁移 | 会话随数据目录迁移，备份导出/恢复纳入业务校验 | 递归迁移沿用 `DataRootHolder`；备份白名单和 DSH `Session.fromRestore` 校验 JSONL，损坏拒绝且不静默清空 | 阶段 D1 已实现 |
| 主题临时会话 | 桌面端已删除 `TopicSessionStore` 运行时；已有 `runtime/topic-sessions/` 文件不主动删除 | 不再推进 D2 迁移；主题讨论需要时回到 Skill/CLI 侧 | D2 取消（桌面端主题范围已删除） |
| 模型密钥 | Main Process `ConfigureAi` 流式代理 | Utility Process、Renderer、会话事件与数据目录均不接触 API Key | 阶段 A 实现 |
| DSH 联网与 UI | 不加载官方默认 bundle 中的 Shell、文件系统、技能或任意联网工具 | 只复用 `WebSearchService` 的 search/sourceId 绑定；UI 只能请求既有页面和结果卡片，不能提供 URL、DOM 或脚本 | 阶段 B 实现 |
| Agent 正式写入与确认 | 日志可按用户明确要求创建/更新；每日反馈可直接调用既有生成用例；周期/洞察复盘先预览后生成 | `AgentToolDispatcher` 只接受共享 Zod 输入；周期/洞察的 `previewToken` 还必须匹配 Main Process 签发且由 Renderer 页面按钮确认的一次性 `approvalId`；模型或普通文本不能冒充确认 | 阶段 C 实现 |
| Agent 取消 | 既有 `ReviewTaskManager` 负责单任务状态机和 AbortSignal | DSH `tool.cancel` 经 MessagePort 传回 Main，连接到每日/周期/洞察用例；取消时不保存半成品 | 阶段 C 实现 |
| Agent 结果 | 正式日志/复盘仍以 Markdown 仓储为权威 | Agent 只收到脱敏摘要；成功后由 Main 转成受校验结果卡，Renderer 通过既有日志/复盘页面查看，不把聊天文本当正式产物 | 阶段 C 实现 |

## 隔离规则

- 日反馈兼容快照版本：`desktop-daily-feedback-v3`（增记 D 级判级复核）；提示词版本：`daily-review-v3`。
- 周期复盘兼容快照版本：`desktop-periodic-review-v3`（增记月报深度）；提示词版本：`periodic-review-v4`。
- 主题思考：桌面端不再维护提示词或兼容快照；Skill/CLI 侧契约继续独立运行。
- 意图路由已下线（2026-08-14 用户决策）：原 `intent-routing-v1` 提示词与相关实现已删除，Skill 侧 `codex-natural-language-routing.md` 契约（CLI 域）不受影响。
- 洞察工具提示词版本：`journal-coach-v3`、`yearly-review-v2`、`life-design-v2`（语义参考 `.claude/agents/` 与 `.claude/commands/` 对应 command/agent，运行不依赖它们；设计性差异见洞察工具节与契约对照表）。
- 桌面端运行时禁止依赖 `.claude` 路径。
- 原有 Codex + Skill 的开发和日常运行不受桌面端代码、审计或数据影响。
