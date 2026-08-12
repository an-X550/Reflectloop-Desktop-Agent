# 知己 Windows 客户端

面向不使用 CLI、Skill 或 Agent 的普通用户。本客户端与现有 `.claude/` 产品逻辑并列存在，不调用或修改既有命令、Skill 和 Agent。

## 当前 MVP

- 五个入口：今天、复盘、项目、历史、设置。
- 本地 Markdown/JSON 保存日志、复盘和项目；默认数据目录为 Windows“文档/知己”。
- 用户自己的 OpenAI 兼容 API Key；Key 仅由 Electron Main Process 使用，并通过 Windows `safeStorage` 加密。
- 支持日反馈、周报、月报、项目复盘；日志可选项目，周期复盘可补选日期范围并在生成前预览材料。
- Renderer 禁用 Node 集成并启用上下文隔离和沙箱；文件、密钥和网络仅通过具名 IPC 访问。

## 开发验证

```powershell
npm test
npm run typecheck
npm start
```

依赖和缓存可放在 D 盘，项目中的 `node_modules` 可使用 Windows Junction 指向 D 盘目录。

## 当前发布边界

2026-08-13 已通过 15 个测试文件、27 项自动化测试、TypeScript 检查和生产依赖审计（0 漏洞）。Windows x64 Squirrel 安装包已使用 npmmirror 临时镜像和 D 盘短路径成功生成在 `D:\CodexBuilds\zhiji-desktop\make\squirrel.windows\x64\知己-1.0.0 Setup.exe`；SHA-256 为 `BB16C9AF85ECF80357ADC6B8CE1E382477D8AB36C30687C0D1DB755029EA0DC4`。为避免干扰当前电脑运行，本次未静默安装；Windows 10/11 的安装、升级、卸载和数据保留仍不得标记为已人工验收。

按第一性原理暂缓：ZIP 导入导出事务、流式文字增量、完整 Playwright 全旅程、Windows 10 虚拟机矩阵、自动更新和移动端。它们不阻塞“写日志—生成反馈—查看历史—按日期/项目复盘”的首个可用闭环。
