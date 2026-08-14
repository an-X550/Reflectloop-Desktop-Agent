# 契约-提示词对照表（漂移防护）

> 创建日期：2026-08-14
>
> 目的：登记 `.claude/shared/contracts/` 各契约与桌面端 `src/main-process/prompts/` 的同源关系与关键禁令映射，作为契约变更时的同步检查清单（契约审计 R1 的防护措施）。
>
> 隔离前提：桌面端运行时不依赖 `.claude/`，本表只服务于人工维护与测试断言；对齐语义的权威记录在兼容快照（`skill-runtime/compatibility/`）与本表。

## 使用方法

1. Skill 侧任一契约变更时，先在本表找到对应行，确认桌面端是否承载该语义。
2. 承载的：同步修改桌面端提示词/代码，递增 `xxx-vN` 版本常量，更新兼容快照与本表版本号；跑 `tests/unit/contract-prompt-mapping.test.ts` 与关联测试。
3. 不承载的（有意排除行）：只在本表记录"维持排除"，不引入实现。
4. 关键禁令措辞变化时，同步更新 `contract-prompt-mapping.test.ts` 的断言文本。

## 同源关系总表

| Skill 契约（`.claude/shared/contracts/`） | 桌面端载体 | 提示词版本 | 关系 |
|---|---|---|---|
| `daily-feedback.md` | `prompts/daily-review-v1.ts` + `skill-runtime/daily-runtime.ts` | `daily-review-v3`（快照 `desktop-daily-feedback-v3`） | 同源：输出五段模板、D0-D6、昨日闭环三态、单洞察单行动、常规 260/例外 320 字；快照增记 D 级判级复核 |
| `journal-input.md` | `skill-runtime/daily-evidence.ts` + `skill-runtime/daily-grade-review.ts` + `application/save-journal.ts` | 无提示词（代码实现） | 同源：A-D 证据判据（桌面端为正则实现，见契约审计 R2 对照证据）；正则判 D 时经 D 级语义复核保守升 C；日期由 UI 显式选择，场景消解 |
| `review-synthesis.md` | `prompts/periodic-review-v1.ts` + `skill-runtime/periodic-runtime.ts` | `periodic-review-v3`（快照 `desktop-periodic-review-v2`） | 同源：稳定结构（标题/聊天摘要/六问一级标题/方向锚点缺席检查/质量自检）、硬质量门、五态定义、周报深度；月报深度延后 |
| `evidence-and-verification.md` | `prompts/verified-patterns-v1.ts` + `application/verified-patterns.ts` | `verified-patterns-v1` | 部分同源：确认后才沉淀的精神一致；六状态词流转与升级门槛未实现（有意差异） |
| `topic-thinking.md` + `topic-thinking-persistence.md` | `prompts/topic-thinking-v1.ts` + `application/topic-thinking.ts` | `topic-thinking-v1` | 同源：首稿主线、事实/推断/价值/未知区分、确认后才写主题文件；持久化结构精简为三段 |
| `codex-natural-language-routing.md` | `prompts/intent-routing-v1.ts` + `application/intent-routing.ts` | `intent-routing-v1` | 精神同源：模型不得创建新流程；桌面端收窄为六值枚举且确定性优先 |
| `result-distribution.md` | 无 | 不适用 | 有意排除（飞书/滴答不属于桌面端范围） |
| `readiness-delivery.md` | 无 | 不适用 | 有意排除（闭环缺口提醒投递未实现） |
| `first-principles-analysis.md` | 无 | 不适用 | 有意排除（第一性原理复核入口未实现） |
| `developer-skill-routing.md` | 无 | 不适用 | 不适用（开发域契约） |

## 关键禁令映射

| 契约禁令 | 桌面端提示词措辞 | 载体 | 测试断言 |
|---|---|---|---|
| 不得编造 | `不得编造事实` | daily-review-v1.ts、periodic-review-v1.ts | contract-prompt-mapping.test.ts |
| 不得确定性心理归因 | `不得做确定性心理归因` | daily-review-v1.ts、periodic-review-v1.ts | contract-prompt-mapping.test.ts |
| 不得把单一事件拔高为价值观 | `不得把单一事件拔高为价值观` | daily-review-v1.ts、periodic-review-v1.ts | contract-prompt-mapping.test.ts |
| 禁止"没写=没做" | `不能推断未做`（无证据只能 insufficient） | daily-review-v1.ts | contract-prompt-mapping.test.ts |
| 禁止人格标签/心理诊断/唯一客观答案 | `不得做人格标签、心理诊断`、`不得把用户价值选择写成唯一客观答案` | topic-thinking-v1.ts | contract-prompt-mapping.test.ts |
| 未经确认不沉淀 | `你只提出候选，由用户决定是否沉淀` | verified-patterns-v1.ts | contract-prompt-mapping.test.ts |
| 证据不足降级标注 | B/C 级降级披露由代码注入质量自检 | periodic-review-v1.ts（applyPeriodicQualityGates） | periodic-review-v1.test.ts、periodic-runtime.test.ts |
| 模型不得创建新流程 | 六值枚举 + zod 失败回退澄清（代码强制） | intent-routing-v1.ts + intent-routing.ts | intent-routing.test.ts |
| D 级判级复核纪律 | 至多一次复核短调用；确认本人经历只保守升 C；失败、超时或输出无效回落原 D（代码强制） | daily-grade-review.ts + daily-runtime.ts | daily-runtime.test.ts、daily-evidence-gold.test.ts |

## 未纳入断言的已知部分差异

- 日反馈证据分级 A/B/C 级差：正则判级与语义判据在 B/C 边界存在级差，只影响反馈深度，登记为已知差异不修（R2 对照报告；金样本回归见 `daily-evidence-gold.test.ts`）。
- 日反馈"禁止跨段重复同一判断"：桌面端靠结构化字段天然分隔，无显式提示词约束（契约审计 4.1）。
- 主题"标题必须为判断性短句、禁止空栏目"：桌面端无对应提示词约束（契约审计 4.5）。
- 上述两项若出现真实质量问题样本，再按必要性闸门评估是否补提示词约束。
