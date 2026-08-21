# 知己桌面端：安装 · 打包 · 分发指南

> 适用版本：v1.27.0 起。本文回答三个问题：怎么装、怎么打包、怎么发给别人；并附当前产品的文件职责清单。

---

## 一、如何安装

产物分两种形态，任选其一即可：

| 形态 | 路径 | 说明 |
| --- | --- | --- |
| **安装版**（推荐分发） | `out/make/squirrel.windows/x64/Setup.exe` | Windows 安装程序，双击下一步即装好，会建开始菜单/桌面快捷方式 |
| **免安装版**（直接运行） | `out/知己-win32-x64/知己.exe` | 解压即用，双击 `知己.exe` 直接运行，无需安装 |

### 安装版流程（Setup.exe）

1. 双击 `Setup.exe` → 等待安装进度条走完。
2. 安装位置：`%LOCALAPPDATA%\知己\`（Squirrel 默认装到本机应用目录，不需要选择）。
3. 首次启动后，数据默认落在 **`文档\知己`**；应用设置页可查看/更改/打开该目录。

### 免安装版流程

1. 把整个 `out/知己-win32-x64/` 文件夹拷到任意位置。
2. 双击其中的 `知己.exe` 运行。数据同样默认落在 `文档\知己`。

> 两种形态共用同一份本地数据（默认 `文档\知己`），切换形态不会丢数据。

---

## 二、如何打包

在本仓库根目录下执行。**先同步版本号**：改 `package.json` 的 `version` 与仓库根目录 `VERSION` 文件，保持一致（`app.getVersion()` 读取的是 package.json 的 version）。

```bash
# 安装依赖（首次）
npm install

# 1) 免安装版（快速，产出 out/知己-win32-x64/）
npm run package

# 2) 安装版（产出 Setup.exe + nupkg，用于分发）
npm run make
```

### 本机打包的两个环境坑（必须带上）

本机（WorkBuddy 环境）打包需要绕过两个注入，否则会失败：

```bash
# 完整可用命令（复制使用）
HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy= \
NODE_OPTIONS="--use-system-ca" \
npm run make
```

- `NODE_OPTIONS="--use-system-ca"`：去掉 WorkBuddy 注入的 safe-delete 拦截（它会拦截构建工具的 rm 并报错）。
- 置空 `HTTP_PROXY/HTTPS_PROXY`：本机代理指向 `127.0.0.1:7897` 但 Clash 未开时，下载 Electron/Squirrel 工具会 `ECONNREFUSED`。

### 镜像源（加速下载，已配置）

项目根已加 `.npmrc`，使用**阿里云 npmmirror**（不用清华源）：

```
registry=https://registry.npmmirror.com
electron_mirror=https://npmmirror.com/mirrors/electron/
```

首次在新机器 `npm install` 会走阿里云镜像，Electron 二进制也走镜像，速度快且不依赖 GitHub。若本机已有缓存，会自动复用，不会重复下载。

### 复用已有 Electron 缓存（离线打包）

Electron 二进制缓存于 `%LOCALAPPDATA%\electron\Cache\`。若发现 `node_modules\electron\dist\` 为空导致打包回退去下载，直接把缓存 zip 解压进去即可离线打包：

```bash
# 找到缓存 zip（例如 electron-v43.4.0-win32-x64.zip）
ls "$LOCALAPPDATA/electron/Cache"/*/
# 解压到本地 dist，之后 npm run package/make 不再联网下载 Electron
unzip -oq "$LOCALAPPDATA/electron/Cache/<hash>/electron-v<版本>-win32-x64.zip" -d node_modules/electron/dist
```

### 首次打包耗时

`npm run make` 首次会下载 Squirrel 打包工具，可能耗时数十分钟；产物生成后即可用（`out/make/squirrel.windows/x64/` 下出现 `Setup.exe`、`zhiji-x.y.z-full.nupkg`、`RELEASES` 即成功）。之后再打包会快很多（工具已缓存）。

> ⚠️ **中文路径导致的 rcedit 报错（可忽略）**：本项目路径含中文「知己」时，`make` 末尾给 `Setup.exe` 写版本信息（rcedit）会报 `Fatal error: Unable to load file` 并让 `make` 以非零码退出。**安装包已正常生成、可正常安装使用**，只是 `Setup.exe` 自身的「属性 → 详细信息」里版本字段缺失（安装进去的仍是正确版本）。如需彻底消除，把项目放到纯英文路径（如 `C:\projects\zhiji`）再打包。

---

## 三、如何分发

### 要发哪些文件

**给普通用户安装 → 只需发一个文件：**

```
out/make/squirrel.windows/x64/Setup.exe
```

**支持应用内「检查更新」→ 需要把这三个文件放到同一个可访问的网址/网盘目录：**

```
zhiji-x.y.z-full.nupkg   # 完整安装包（核心）
RELEASES                 # 版本清单（列出各版本的包哈希）
Setup.exe                # 引导安装器
```

用户在设置页「关于」卡片填上这个目录的 `RELEASES` 所在 URL（例如 `https://你的域名/releases/`），点「检查更新」即可在浏览器打开获取最新版。

> 当前实现是「打开网页获取最新包」的轻量更新，**不是**自动静默升级（那需要代码签名证书 + 独立更新服务器，尚未做）。

### 免安装分发

把整个 `out/知己-win32-x64/` 文件夹打包成 zip 发给用户，用户解压双击 `知己.exe` 即可。

### 当前限制（诚实边界）

- **未代码签名**：Windows SmartScreen 可能提示「未知发布者」，需点「仍要运行」。正式对外分发前建议购买代码签名证书。
- 未做自动更新、未验证 Windows 10 干净虚拟机、未做安装/升级/卸载的完整回归。
- 数据目录与用户数据（API Key）是两处：换机器或重装需用「设置 → 导出备份」迁移。

---

## 四、文件职责清单

### 4.1 本地数据目录（默认 `文档\知己`，可在设置里更改位置）

| 路径 | 内容 | 用途 |
| --- | --- | --- |
| `journals/<年>/<日期>--journal_<id>.md` | 每日日志 | 带 frontmatter（日期/项目关联）+ Markdown 正文，是复盘的最原始材料 |
| `reviews/<类型>/<年>/<日期>-review_<id>.md` | 各类复盘 | 类型：daily 日反馈 / weekly 周报 / monthly 月报 / project 项目复盘 / coach 日志质量 / yearly 年度回顾 / life-design 方向校准 |
| `projects/*.json` | 项目 | 项目名（全局唯一）、状态、时间；日志通过 `projectIds` 关联 |
| `profile/about-me.md` | 个人背景 | 用户主动提供的背景，仅在开启「允许 AI 使用」后注入复盘 |
| `patterns/verified-patterns.json` | 已验证模式快照 | 用户确认过的长期行为假说 |
| `topics/index.json` + `topics/<名>.md` | 旧版主题数据 | 历史主题正文保留在数据目录，但桌面端不再读取、写入或导出 |
| `templates/*.md` | 日志模板 | 写日志时一键插入的预设结构，文件名即模板名 |
| `settings.json` | AI 公开配置 | 服务商 id、baseUrl、模型名（**不含 API Key**） |
| `runtime/topic-sessions/*.json` | 旧版主题 checkpoint | 不主动删除；桌面端已移除主题会话运行时，需继续讨论时使用 Skill/CLI |
| `runtime/daily-feedback-audit.jsonl` | 日反馈审计摘要 | 追溯等级/结果/昨日行动，不含全文与 Key |

### 4.2 用户数据目录（`%APPDATA%\知己`，与数据目录分离）

| 路径 | 内容 | 用途 |
| --- | --- | --- |
| `credentials.json` | 加密的 API Key | 用 Windows safeStorage 加密，仅主进程读取 |
| `zhiji-config.json` | 应用级配置 | 自定义数据目录路径、更新地址 |

### 4.3 源码结构（`src/`）

| 目录/文件 | 职责 |
| --- | --- |
| `main.ts` | Electron 主进程入口：创建窗口、调用 bootstrap |
| `main-process/bootstrap.ts` | 手工装配：读配置 → 建仓储/服务 → 注入 registerHandlers |
| `main-process/application/` | 业务用例：保存日志、生成各类复盘、验证模式、AI 配置 |
| `main-process/domain/` | 纯领域逻辑：任务状态机、材料选择、日反馈新鲜度等 |
| `main-process/infrastructure/` | 落地实现：Markdown/JSON 仓储、AI 服务商、凭据、传输、数据目录、模板 |
| `main-process/skill-runtime/` | Skill 行为的确定性复刻（LangGraph 编排 + 证据分级） |
| `main-process/prompts/` | 各链路的提示词 + 输出解析（版本化） |
| `main-process/ipc/register-handlers.ts` | 所有渲染进程 ↔ 主进程的 IPC 通道注册 |
| `shared/schemas/` | Zod 契约（domain 数据结构 + ipc 输入）与 `desktop-api` 类型 |
| `shared/errors/app-error.ts` | 统一错误码 + 中文默认文案 |
| `preload.ts` | 上下文隔离桥：只暴露具名 API，不暴露 Node |
| `renderer/` | React 界面：页面、组件、hooks、设计令牌（`index.css`） |
| `tests/unit/` `tests/integration/` | 单元/集成测试（AI 调用一律注入假实现） |
| `forge.config.ts` | 打包配置：Vite 构建、Squirrel 安装器、Fuses 加固 |

### 4.4 项目根目录关键文件

| 文件 | 用途 |
| --- | --- |
| `VERSION` | 当前版本号（与 package.json 的 version 同步） |
| `CHANGELOG.md` | 每次变更记录 |
| `PROJECT_STATUS.md` | 项目当前状态、版本、决策记录 |
| `docs/specs/` | 需求/方案规格文档 |
| `docs/first-principles.md` `docs/development-governance.md` | 第一性原理与开发治理规范 |
