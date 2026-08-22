# 知己 Windows 桌面端

> 一个以 Agent 为执行入口的本地日志闭环：从真实记录中找证据，形成一个小行动，再用下一次记录验证。

知己是一个本地优先的 Windows 桌面应用，内置受控 Agent。Agent 可以检索日志、复盘、项目和已确认验证模式，在必要时搜索公开来源，并把结果收敛为一个可验证的下一步；数据默认保存在本机，AI 只在你配置并发起请求时参与。

- [GitHub 仓库](https://github.com/an-X550/zhiji-desktop)
- [下载与 Releases](https://github.com/an-X550/zhiji-desktop/releases)
- [提交问题](https://github.com/an-X550/zhiji-desktop/issues)
- 许可证：MIT，见 [LICENSE](LICENSE)

## Agent 的真实边界

知己 Agent 不是日记代写器，也不是可以操作整台电脑的通用代理。它只在桌面端注册的工具边界内工作：

- **找证据**：只读检索本地日志、日反馈、周期复盘、项目和已确认验证模式，并保留可核实的来源信息；
- **做有限推理**：在一次会话中按需读取多份材料，区分事实、推断和待验证假说；
- **查公开资料**：通过受控搜索和来源读取获取公开信息，不接收任意网页 URL、Shell 或浏览器控制；
- **守住确认门**：正式日志、反馈和复盘的改变先预览，再由用户确认；会话可保存和恢复，但不会后台常驻、自行定时或绕过确认写入。

核心判断标准不是“Agent 还能做什么”，而是它是否直接改善：

```text
发现模式 → 形成行动 → 后续验证
```

## 先判断它是否适合你

适合以下使用方式：

- 你想把日志和复盘保存在自己的 Windows 电脑上；
- 你愿意配置一个 OpenAI、DeepSeek 或其他 OpenAI 兼容服务的 API Key；
- 你希望 AI 的判断能区分事实、推断、建议和证据不足，而不是把日志改写成一篇泛泛的摘要；
- 你接受这是单机单用户工具，不是云端协作平台。

它不适合以下需求：

- 手机、macOS、Linux 或多用户协作；
- 自动后台同步、云端数据托管或跨设备实时同步；
- 直接读取并执行 Claude/Codex 的 `.claude` Skill，或直接读取 DeepSeek Harness 源码；
- 把桌面端数据自动同步成主仓库 `知己 Skill` 的日志和复盘文件。

## 当前状态

- 当前代码版本：`2.6.5`。
- 当前支持目标：Windows 本地单用户。
- 应用可以离线写日志、管理项目和查看已有内容；生成 AI 反馈、复盘或使用 Agent 需要可用的模型配置。
- 最新可下载发布版是 [v2.6.5 Release](https://github.com/an-X550/zhiji-desktop/releases/tag/v2.6.5)，下载 `Zhiji-Setup-v2.6.5.exe`。GitHub 自动生成的 `Source code (zip)` 是源码，不是安装程序。
- v2.6.5 源码已包含受控 Agent 联网、结构化搜索/读源错误、同轮超时一次重试、重复 query 抑制、provider smoke 和对应回归测试；真实 AI 服务生成仍需配置你自己的 Key 后自行验证。

## 安装

### 普通用户：使用发布包

1. 下载 `Zhiji-Setup-v2.6.5.exe`。
2. 双击运行安装程序，按 Windows 提示完成安装。

当前发布不提供免安装包，也不承诺代码签名、应用内自动更新或完整的 Windows 10/11 干净机安装回归。Windows SmartScreen 出现“未知发布者”提示时，应先确认安装包来源，再决定是否继续。

### 开发者：从源码运行

需要 Windows、Git、Node.js 22 或更新版本以及 npm：

```powershell
git clone https://github.com/an-X550/zhiji-desktop.git
cd zhiji-desktop
npm ci
npm start
```

开发模式启动后会打开 Electron 窗口。不要直接双击源码目录，也不要用 `electron .` 替代 `npm start`；项目需要 Electron Forge 先生成正确的入口。

构建产物：

```powershell
# 生成免安装目录
npm run package

# 生成 Windows 安装包
npm run make
```

通常可在以下位置找到产物：

```text
out/知己-win32-x64/zhiji.exe
out/make/squirrel.windows/x64/Setup.exe
```

项目目录、npm 缓存或 `node_modules` 可以放在 D 盘。桌面端运行依赖 `package.json` 中安装的 npm 包，不会在运行时寻找 `D:\AI\deepseek-harness` 或其他 DSH 源码目录。

## 第一次使用：最小闭环

### 1. 配置 AI 服务

打开 `设置 → AI 与个性化`：

1. 选择 OpenAI、DeepSeek 或其他 OpenAI 兼容服务；
2. 填写模型名称；使用自定义服务时填写 API 地址；
3. 填写自己的 API Key；
4. 点击“保存并测试”；成功后设置会安全保存。

API Key 由 Electron 主进程交给 Windows 安全存储加密保存，界面不会再次显示原值。没有 API Key 时仍可写日志和管理本地数据，但 AI 生成类功能会提示先完成配置。

### 2. 让 Agent 先建立证据

进入 `Agent` 页面，可以直接说：

```text
请先检索我最近的日志和已确认的验证模式，找出一个我可能没看到的重复模式。
区分事实与推断，只给一个明天可验证的小实验，并告诉我下次要记录什么结果。
```

Agent 会把本地证据、必要的公开来源和待验证假说分开；如果需要改变正式日志、反馈或复盘，会先展示预览并等待确认。

### 3. 写一篇真实日志

进入 `日志`，记录今天实际发生的事件、你的行为、结果和状态。尽量写具体事实，不需要先写得完整或漂亮；复盘的质量取决于材料是否可核验。

同一天可以保存多篇日志，已有日志不会因为新建一篇而被覆盖。日志可以关联到 `项目`；在 `日志` 页点击“管理模板”可创建模板，写日志时使用“从模板开始”。

### 4. 生成今日反馈

保存日志后，在日志页生成当天反馈，或从 `开始` 页执行建议动作。反馈会优先给出一个有原文支撑的主要洞察、一个少于五分钟的行动和一个明天可观察的验证点。

材料不足时，应用会明确标记证据不足并降低结论强度，不会为了完整而补写你的经历。

### 5. 再使用周期复盘

在 `复盘` 中按需使用：

| 入口 | 解决的问题 |
| --- | --- |
| 日反馈 | 今天发生了什么，明天验证什么 |
| 周报 | 本周哪些变化真的影响下周决策 |
| 月报 | 本月少量主主题、反例和下月检查点 |
| 项目复盘 | 目标、结果、过程、偏差和后续行动 |
| 更多洞察 | 日志质量检查、年度回顾和方向校准 |

周期复盘会先展示材料预览，确认后才生成；它不是把所有日志机械拼接成摘要。

## 数据、备份与隐私

### 数据放在哪里

默认业务数据目录：

```text
Windows“文档”\知己\
```

主要内容包括：

| 目录或文件 | 内容 |
| --- | --- |
| `journals/` | 日志 Markdown |
| `reviews/` | 日反馈、周报、月报、项目复盘和洞察结果 |
| `projects/` | 项目状态与关联关系 |
| `profile/about-me.md` | 只有你主动提供并允许 AI 使用时才会参与复盘的个人背景 |
| `templates/` | 日志模板 |
| `runtime/` | 运行审计等内部状态 |

应用级配置和凭据位于 Electron 的用户数据目录，通常是：

```text
%APPDATA%\知己\zhiji-config.json
%APPDATA%\知己\credentials.json
```

`zhiji-config.json` 保存数据目录等公开配置；`credentials.json` 保存经过 Windows `safeStorage` 加密的 API Key。不要把这两个目录当作业务日志目录，也不要把 `credentials.json` 分享给别人。

### 更改位置、导出和恢复

- `设置 → 数据与隐私 → 更改位置`：迁移现有数据后，重启应用才会生效；
- `设置 → 数据与隐私 → 创建备份`：导出日志、复盘、项目、个人背景和公开配置；使用“从备份恢复”恢复到空目录；
- 备份不包含 API Key 或缓存；换电脑后需要在新设备重新配置 API Key；
- 恢复备份采用空目录模型，不会把两个目录里的同名文件自动合并。
- Agent 的本地检索保持只读；公开联网只返回受控来源信息，不会把桌面端变成任意浏览器或电脑控制器。

## 与知己 Skill、DSH 的边界

桌面端是独立运行时：

- 不读取、执行或修改 Claude/Codex 的 `.claude` Skill 系统；
- 不要求安装 DeepSeek Harness，也不要求拥有 DSH 源码；
- 使用自己的本地数据目录结构，和 `知己 Skill`、`zhiji-user`、`zhiji-dsh-plugin` 的文件格式不自动互通；
- 桌面端生成的反馈保存在桌面端数据目录，不会自动写入主仓库的正式报告目录；
- 主题讨论和长期认识沉淀仍由 Skill/CLI 按需承载，不属于桌面端运行时。

因此，桌面端和 DSH 插件可以同时存在，但它们不是同一个运行实例，也不会因为放在同一台电脑上就自动共享日志。

## 常见问题

### AI 请求失败

先在 `设置 → AI 与个性化` 重新检查服务商、API 地址、模型名称和 API Key，然后点击“保存并测试”。自定义服务通常必须使用 HTTPS；模型或 API Key 的可用性由你选择的服务商决定，不由桌面端提供。

### 更改数据位置后看不到旧日志

打开 `设置 → 数据与隐私`，确认当前显示的实际路径；迁移完成后重启应用。不要手动把单个文件塞进新目录，优先使用应用的迁移或备份恢复流程。

### 源码启动失败

确认使用的是 Node.js 22+，重新执行 `npm ci`，再运行 `npm start`。如果只是想使用应用，应使用发布包，不要直接运行 TypeScript 源文件。

### 安装后想迁移到另一台电脑

在旧电脑导出 `.zhiji.zip`，在新电脑恢复到空数据目录，然后在新电脑重新配置 API Key。备份不会携带密钥。

## 开发与验证

```powershell
npm test
npm run typecheck
npm run lint
npm run package
npm run provider:smoke
npm run test:e2e
```

`npm run test:e2e` 会生成 Electron 构建入口并启动隔离测试窗口。安装、打包、分发和文件职责的细节见：

- [安装、打包与分发指南](docs/install-package-distribute.md)
- [Skill 兼容矩阵](docs/skill-compatibility-matrix.md)
- [架构说明](docs/architecture.md)
- [DSH 集成说明](docs/dsh-integration-notes.md)

## 许可证

[MIT](LICENSE)
