---
last_updated: 2026-08-22
---

# 更新记录

## [2026-08-22] [配置] 同步 ReflectLoop Desktop 仓库地址与包元数据（v2.6.5 -> v2.6.5）

- 仓库改名后，将 README、克隆命令、Release、Issues、主页和 Git remote 统一到 `an-X550/ReflectLoop-Desktop`，主项目链接更新为 `an-X550/Reflectloop`。
- 私有 npm 包名与锁文件根名称同步为 `reflectloop-desktop`；应用显示名“知己”、可执行文件、数据目录、版本和发布制品均不改变。
- 旧桌面仓库地址在当前文档与 metadata 中完成零残留检查；历史 CHANGELOG 保留当时事实。

## [2026-08-22] [文档] 采用 ReflectLoop Desktop 英文项目名（v2.6.5 -> v2.6.5）

- 保留“知己 Windows 客户端”作为中文产品名，采用 ReflectLoop Desktop 作为英文项目名；版本和发布制品保持 2.6.5。
- README 改为面向普通用户的入口顺序，前置下载、适用范围和第一次使用，再说明主要能力、Agent 边界、数据隐私与开发方式。
- Agent 继续作为受控复盘能力，不再承担产品根定义；仓库 URL 与 GitHub About 简介本次不改，等待维护者在平台设置中另行完成。

## [2026-08-22] [修复] 同步 Agent 受控联网与 v2.6.5 桌面端源码

- 以 `@tavily/core@0.7.7` keyless `search/extract` 替换 DuckDuckGo HTML 直连和任意 URL 读取；搜索结果只向 Agent 暴露 sourceId、标题、域名、摘要和时间。
- 补齐搜索不可用、超时、共享限额、空结果和来源不可读错误；同一 query 每轮最多自动重试一次，并抑制非重试错误后的重复调用。
- Agent 的本地证据检索、受控公开来源读取、有限工具回合和预览—确认—执行边界在桌面端 README 中明确；增加 provider smoke 与回归测试，当前源码版本为 2.6.5。
- 验证：54 files / 330 tests、typecheck、lint 0 errors / 6 existing warnings、provider smoke、package 和 `test:e2e` 5 passed / 2 skipped；v2.6.5 Windows 三件套已生成并验收，随本仓库的 v2.6.5 Release 发布。

## [2026-08-22] [发布] v2.6.3 Windows 桌面端

- 设置页整理为“通用 / AI 与个性化 / 数据与隐私”三个区域，补齐实际可用的保存、测试、数据位置和备份恢复按钮，并移除应用内更新入口。
- 修复长日志页面的本地数据区滚动边界与深色主题下拉箭头显示。
- 日反馈继续使用受控修复与错误分级；Agent、历史本地搜索和受控 Web 查询保持当前能力边界。
- Windows 发布包将 DSH 生产依赖完整装入 `app.asar`；普通用户下载 `Zhiji-Setup-v2.6.3.exe`，源码压缩包不是安装程序。
- 本次发布不承诺代码签名或自动更新；真实 AI 服务生成未在无安全凭据的环境中宣称通过。

## [2026-08-21 21:36] [修复] 修复 Windows 发布包遗漏 DSH 运行时依赖 (v2.0.4 -> v2.0.5)

- **受影响文件**: `package.json`、`package-lock.json`、`VERSION`、`README.md`、`forge.config.ts`、`e2e/desktop.spec.ts`
- **改动摘要**: 将 DSH Utility 实际需要的 peer 依赖声明为应用的直接生产依赖，确保 `app.asar` 自包含；同时固定 Windows 可执行文件为 ASCII 安全的 `zhiji.exe`，避免 Squirrel nupkg 解包时损坏中文文件名；E2E 从隔离工作目录启动打包入口，避免开发机 `node_modules` 掩盖发布包缺依赖。
