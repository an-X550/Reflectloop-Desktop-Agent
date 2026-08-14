# 桌面端 Skill 兼容矩阵

本矩阵只约束 `apps/zhiji-desktop/`。桌面端使用独立的兼容快照，不读取、执行或修改 Codex + `.claude/` 的运行系统。

## 第一阶段：日反馈

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 最小材料 | 目标日志、最近前次日反馈、桌面端本地审计记录 | `daily-runtime.test.ts` | 本阶段实现 |
| A-D 输入等级 | 程序生成证据卡并按等级限制模型行为 | `daily-evidence.test.ts` | 本阶段实现 |
| D 级降级 | 仅提出一个补证问题；不调用模型、不保存反馈 | `daily-runtime.test.ts`、`generate-daily-review.test.ts` | 本阶段实现 |
| 昨日闭环 | 读取最近前次日反馈；无明确反证时只能标记证据不足，并将闭环状态写入本地审计 | `generate-daily-review.test.ts`、`daily-audit-recorder.test.ts` | 本阶段实现 |
| 单洞察、单行动与预测 | 使用严格 JSON Schema、确定性渲染 | `generate-daily-review.test.ts` | 已有，迁入 Runtime |
| 正式反馈写入 | 原子写入并由仓储复读 | `generate-daily-review.test.ts` | 已有，保留 |
| 验证沉淀写回 | JSONL 仅追加审计：记录证据等级、结果、昨日行动状态；不创建未经验证的长期模式 | `daily-audit-recorder.test.ts` | 本阶段实现 |
| 分发、提醒、飞书、滴答 | 不属于桌面第一阶段 | 不适用 | 排除 |

## 第二阶段：周期复盘（周/月/项目）

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 下游沉淀优先 | 周复盘以日反馈为主材料；月复盘以周复盘为主材料；原始日志仅在下游沉淀不足时补全文，充足时只保留索引 | `periodic-materials.test.ts`、`generate-periodic-review.test.ts` | 本阶段实现 |
| A-D 输入等级 | 程序生成周期证据卡并按等级限制模型行为 | `periodic-evidence.test.ts` | 本阶段实现 |
| D 级降级 | 仅提出一个补证问题；不调用模型、不保存复盘 | `periodic-runtime.test.ts`、`generate-periodic-review.test.ts` | 本阶段实现 |
| 复盘六问 | 使用严格 JSON Schema（summary/effective/ineffective/evidence/ifRedone/nextAction）、确定性渲染 | `periodic-review-v1.test.ts` | 本阶段实现 |
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

## 第四阶段：主题思考与受控联网

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 讨论—展示差异—确认—沉淀 | 未经确认不写主题文件；更新既有主题时展示旧正文差异，确认后才原子写入 | `topic-thinking.test.ts`、`topics-page.test.tsx` | 本阶段实现 |
| 文件型 checkpoint 恢复 | 会话逐轮原子写入 JSON，重启后可列出并恢复；损坏报错 | `topic-session-store.test.ts` | 本阶段实现 |
| 主题名消毒与索引 | 标题移除路径分隔符等不安全字符；索引损坏报错不静默重置 | `topic-repository.test.ts` | 本阶段实现 |
| 联网仅用户显式触发 | 搜索只由 UI 按钮发起；结果显示来源域名与检索日期 | `topics-page.test.tsx`、`web-search-service.test.ts` | 本阶段实现 |
| sourceId 会话绑定 | readSource 校验搜索会话存在且 sourceId 属于该会话，拒绝伪造 ID；仅 http/https | `web-search-service.test.ts` | 本阶段实现 |
| 向量检索、自动归档、任意 URL 执行 | 不属于桌面第四阶段 | 不适用 | 排除 |

## 隔离规则

- 日反馈兼容快照版本：`desktop-daily-feedback-v1`。
- 周期复盘兼容快照版本：`desktop-periodic-review-v1`；提示词版本：`periodic-review-v2`。
- 主题思考提示词版本：`topic-thinking-v1`（自有快照，不读取 `.claude/shared/contracts/`）。
- 桌面端运行时禁止依赖 `.claude` 路径。
- 原有 Codex + Skill 的开发和日常运行不受桌面端代码、审计或数据影响。
