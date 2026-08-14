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

## 隔离规则

- 日反馈兼容快照版本：`desktop-daily-feedback-v1`。
- 周期复盘兼容快照版本：`desktop-periodic-review-v1`；提示词版本：`periodic-review-v2`。
- 桌面端运行时禁止依赖 `.claude` 路径。
- 原有 Codex + Skill 的开发和日常运行不受桌面端代码、审计或数据影响。
