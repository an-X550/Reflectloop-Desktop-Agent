# 桌面端 Skill 兼容矩阵

本矩阵只约束 `apps/zhiji-desktop/`。桌面端使用独立的兼容快照，不读取、执行或修改 Codex + `.claude/` 的运行系统。

## 第一阶段：日反馈

| 已冻结规则能力 | 桌面端行为 | 验收测试 | 状态 |
|---|---|---|---|
| 最小材料 | 目标日志、最近前次日反馈、桌面端验证记录 | `daily-runtime.test.ts` | 本阶段实现 |
| A-D 输入等级 | 程序生成证据卡并按等级限制模型行为 | `daily-evidence.test.ts` | 本阶段实现 |
| D 级降级 | 仅提出一个补证问题；不调用模型、不保存反馈 | `daily-runtime.test.ts`、`generate-daily-review.test.ts` | 本阶段实现 |
| 昨日闭环 | 无明确反证时只能标记证据不足 | `generate-daily-review.test.ts` | 本阶段实现 |
| 单洞察、单行动与预测 | 使用严格 JSON Schema、确定性渲染 | `generate-daily-review.test.ts` | 已有，迁入 Runtime |
| 正式反馈写入 | 原子写入并由仓储复读 | `generate-daily-review.test.ts` | 已有，保留 |
| 验证沉淀写回 | 独立的长期模式记录 | 后续垂直切片 | 延后 |
| 分发、提醒、飞书、滴答 | 不属于桌面第一阶段 | 不适用 | 排除 |

## 隔离规则

- 兼容快照版本：`desktop-daily-feedback-v1`。
- 桌面端运行时禁止依赖 `.claude` 路径。
- 原有 Codex + Skill 的开发和日常运行不受桌面端代码、审计或数据影响。
