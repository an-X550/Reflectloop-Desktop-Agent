# ReflectLoop Desktop（知己 Windows 客户端）

> A local-first Windows app for evidence-grounded journaling, reflection, and action verification.

ReflectLoop Desktop 面向希望在 Windows 本地写日志、管理项目和进行复盘，但不想配置 CLI 或 Skill 的用户。数据默认保存在自己的电脑上；AI 只在你配置模型并主动发起请求时参与。

- [下载 v2.6.5](https://github.com/an-X550/zhiji-desktop/releases/tag/v2.6.5)
- [提交问题](https://github.com/an-X550/zhiji-desktop/issues)
- [查看主项目](https://github.com/an-X550/knowing-yourself)
- 许可证：[MIT](LICENSE)

## 下载与当前状态

- 当前代码与最新发布版本：`2.6.5`。
- 当前支持目标：Windows 本地单用户。
- 普通用户下载 `Zhiji-Setup-v2.6.5.exe`；GitHub 自动生成的 `Source code (zip)` 是源码，不是安装程序。
- 应用可以离线写日志、管理项目和查看已有内容；生成 AI 反馈、复盘或使用 Agent 需要可用的模型配置。
- 当前安装包未进行代码签名，也不承诺应用内自动更新或完整的 Windows 10/11 干净机安装矩阵。SmartScreen 显示“未知发布者”时，应先确认下载来源。

## 先判断它是否适合你

适合以下使用方式：

- 你想把日志和复盘保存在自己的 Windows 电脑上；
- 你愿意配置 OpenAI、DeepSeek 或其他 OpenAI 兼容服务的 API Key；
- 你希望 AI 区分事实、推断、建议和证据不足，而不是把日志改写成泛泛摘要；
- 你接受这是单机单用户工具，不是云端协作平台。

它不适合以下需求：

- 手机、macOS、Linux 或多用户协作；
- 自动后台同步、云端数据托管或跨设备实时同步；
- 任意文件读取、Shell、浏览器控制或通用 Computer Use；
- 自动同步桌面数据与主仓库 Skill、用户分发包或 DSH 插件。

## 第一次使用

### 1. 安装应用

从 [v2.6.5 Release](https://github.com/an-X550/zhiji-desktop/releases/tag/v2.6.5) 下载 `Zhiji-Setup-v2.6.5.exe`，双击运行并按 Windows 提示完成安装。

### 2. 配置 AI 服务

打开 `设置 → AI 与个性化`：

1. 选择 OpenAI、DeepSeek 或其他 OpenAI 兼容服务；
2. 填写模型名称；使用自定义服务时填写 API 地址；
3. 填写自己的 API Key；
4. 点击“保存并测试”。

API Key 由 Electron 主进程交给 Windows `safeStorage` 加密保存，界面不会再次显示原值。没有 API Key 时仍可写日志和管理本地数据，但 AI 生成功能不可用。

### 3. 完成最小闭环

进入 `日志`，记录今天实际发生的事件、行为、结果和状态。保存后生成今日反馈，应用会优先给出一个有原文支撑的主要洞察、一个少于五分钟的行动和一个明天可观察的验证点。

下一次记录时补上行动结果：

```text
上次行动：做了 / 没做 / 做了一部分
结果：发生了什么
判断：支持原假说 / 出现反例 / 仍待验证
```

这条“记录—复盘—行动—验证—校准”链路是 ReflectLoop 的核心。先完成一次验证，再使用更长周期的复盘。

## 主要能力

| 入口 | 解决的问题 |
| --- | --- |
| 开始 | 根据本地数据给出当前最值得完成的一项动作 |
| Agent | 检索受限的本地证据，按需读取公开来源，并在确认边界内调用工具 |
| 日志 | 保存多篇本地 Markdown 日志、关联项目和使用自定义模板 |
| 复盘 | 生成日反馈、周报、月报、项目复盘、年度回顾、方向校准和日志质量检查 |
| 项目 | 管理项目、关联日志、归档与恢复 |
| 设置 | 管理 AI 服务、个人背景、本地数据位置、备份和隐私选项 |

日反馈和复盘正文以 Markdown 保存在本地，界面会安全渲染标题、引用、列表和表格，不执行日志中的原始 HTML。周期复盘会先预览材料，确认后才生成，不会把全部日志机械拼接成摘要。

## Agent 能力与边界

Agent 是完成复盘闭环的一种受控能力，不是能够操作整台电脑的通用代理。

- **本地证据**：只读检索日志、日反馈、周期复盘、项目和已确认验证模式，并返回有限的可核实摘录；
- **公开来源**：通过受控搜索和来源读取获取公开信息，不接受任意 URL，也不获得浏览器控制；
- **有限工具回合**：可以在当前会话中组合已注册的高层工具，但不能执行 Shell 或任意文件操作；
- **确认边界**：正式日志、反馈和复盘的改变先预览，再由用户确认；
- **会话生命周期**：支持本地保存和恢复会话，但不会后台常驻或自行定时运行。

材料不足或来源冲突时，Agent 应降低结论强度并明确证据缺口，而不是补写用户经历。

## 数据、备份与隐私

默认业务数据目录是 Windows“文档”文件夹下的 `知己`：

| 目录或文件 | 内容 |
| --- | --- |
| `journals/` | 日志 Markdown |
| `reviews/` | 日反馈、周报、月报、项目复盘和洞察结果 |
| `projects/` | 项目状态与关联关系 |
| `profile/about-me.md` | 只有用户主动提供并允许 AI 使用时才参与分析的个人背景 |
| `templates/` | 日志模板 |
| `runtime/` | Agent 会话和有限运行状态 |

应用级公开配置与加密凭据通常位于：

```text
%APPDATA%\知己\zhiji-config.json
%APPDATA%\知己\credentials.json
```

- `设置 → 数据与隐私 → 更改位置` 可以迁移现有数据，重启后生效；
- `设置 → 数据与隐私 → 创建备份` 可以导出 `.zhiji.zip`；恢复采用空目录模型，不自动合并同名文件；
- 备份包含日志、复盘、项目、个人背景和公开配置，不包含 API Key 或缓存；
- Renderer 不直接接触 API Key、任意网络或文件系统；文件、密钥和网络只通过具名 IPC 访问；
- 真实日志默认只保存在用户选择的本地目录，但本地保存本身不等于磁盘加密或访问控制。

## 与其他 ReflectLoop 入口的关系

桌面客户端是独立运行时：

- 不读取、执行或修改 Claude/Codex 的 `.claude` Skill 系统；
- 不要求安装 DeepSeek Harness，也不读取 DSH 源码；
- 使用自己的数据目录结构，不与 Skill、`zhiji-user` 或 DSH 插件自动互通；
- 主题讨论和长期认识沉淀继续由 Skill/CLI 按需承载，不属于桌面运行时。

因此，桌面客户端和其他入口可以同时存在，但它们不是同一个运行实例，也不会因为位于同一台电脑上就自动共享日志。

## 从源码运行

需要 Windows、Git、Node.js 22 或更新版本以及 npm：

```powershell
git clone https://github.com/an-X550/zhiji-desktop.git
cd zhiji-desktop
npm ci
npm start
```

不要直接双击源码目录，也不要用 `electron .` 替代 `npm start`；Electron Forge 需要先生成正确入口。

常用验证与构建命令：

```powershell
npm test
npm run typecheck
npm run lint
npm run provider:smoke
npm run package
npm run make
npm run test:e2e
```

更多开发资料：

- [安装、打包与分发指南](docs/install-package-distribute.md)
- [Skill 兼容矩阵](docs/skill-compatibility-matrix.md)
- [架构说明](docs/architecture.md)
- [DSH 集成说明](docs/dsh-integration-notes.md)

## 许可证

[MIT](LICENSE)
