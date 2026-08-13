# 知己 Windows 客户端

面向不使用 CLI、Skill 或 Agent 的普通用户。本客户端与现有 `.claude/` 产品逻辑并列存在，不调用或修改既有命令、Skill 和 Agent。

## 当前 MVP

- 五个入口：今天、复盘、项目、历史、设置。
- 本地 Markdown/JSON 保存日志、复盘和项目；默认数据目录为 Windows“文档/知己”。
- 用户自己的 OpenAI 兼容 API Key；Key 仅由 Electron Main Process 使用，并通过 Windows `safeStorage` 加密。
- 支持日反馈、周报、月报、项目复盘；日志可选项目，周期复盘可补选日期范围并在生成前预览材料。
- 设置页支持带 SHA-256 清单的 `.zhiji.zip` 备份与校验后恢复；只导出日志、复盘、项目和公开配置，不包含 API Key 或缓存，恢复仅允许写入空数据目录。
- Renderer 禁用 Node 集成并启用上下文隔离和沙箱；文件、密钥和网络仅通过具名 IPC 访问。

## 开发验证

```powershell
npm test
npm run typecheck
npm run package
npm run test:e2e
npm start
```

依赖和缓存可放在 D 盘，项目中的 `node_modules` 可使用 Windows Junction 指向 D 盘目录。

## 当前发布边界

2026-08-13 已通过 23 个测试文件、48 项自动化测试、TypeScript 检查和生产依赖审计（0 漏洞）。真实 Electron E2E 已在隔离临时数据目录完成“创建项目—关联并保存日志—从历史读取—核对 Markdown 落盘”闭环。Windows x64 Squirrel 安装包已使用 npmmirror 临时镜像和 D 盘短路径生成在 `D:\CodexBuilds\zhiji-desktop\make\squirrel.windows\x64\知己-1.0.0 Setup.exe`；大小 140,006,400 字节，SHA-256 为 `118FBDBCD3C59B7A8F002BC09F26DDE7F1D7A4793C1558D9EA85601AA3F9A29B`。ASAR 文件名检查未发现 `.env`、凭据、测试夹具或个人日志/复盘。

为避免干扰当前电脑运行，本次未执行安装程序。Windows 11 安装/升级/卸载与数据保留、Windows 10 干净虚拟机、代码签名、自动更新和移动端仍暂缓；未真实运行前不得标记通过。当前恢复采用更安全的空目录模型，不支持向已有数据逐文件合并冲突。
