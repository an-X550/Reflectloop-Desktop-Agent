---
last_updated: 2026-08-21
---

# 更新记录

## [2026-08-22] [发布] v2.6.3 Windows 桌面端

- 设置页整理为“通用 / AI 与个性化 / 数据与隐私”三个区域，补齐实际可用的保存、测试、数据位置和备份恢复按钮，并移除应用内更新入口。
- 修复长日志页面的本地数据区滚动边界与深色主题下拉箭头显示。
- 日反馈继续使用受控修复与错误分级；Agent、历史本地搜索和受控 Web 查询保持当前能力边界。
- Windows 发布包将 DSH 生产依赖完整装入 `app.asar`；普通用户下载 `Zhiji-Setup-v2.6.3.exe`，源码压缩包不是安装程序。
- 本次发布不承诺代码签名或自动更新；真实 AI 服务生成未在无安全凭据的环境中宣称通过。

## [2026-08-21 21:36] [修复] 修复 Windows 发布包遗漏 DSH 运行时依赖 (v2.0.4 -> v2.0.5)

- **受影响文件**: `package.json`、`package-lock.json`、`VERSION`、`README.md`、`forge.config.ts`、`e2e/desktop.spec.ts`
- **改动摘要**: 将 DSH Utility 实际需要的 peer 依赖声明为应用的直接生产依赖，确保 `app.asar` 自包含；同时固定 Windows 可执行文件为 ASCII 安全的 `zhiji.exe`，避免 Squirrel nupkg 解包时损坏中文文件名；E2E 从隔离工作目录启动打包入口，避免开发机 `node_modules` 掩盖发布包缺依赖。
