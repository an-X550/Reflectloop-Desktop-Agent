# 知己 Windows 客户端

面向不使用 CLI、Skill 或 Agent 的普通用户。本客户端与现有 `.claude/` 产品逻辑并列存在，不调用或修改既有命令、Skill 和 Agent。

## 当前 MVP

- 五个入口：今天、复盘、项目、历史、设置。
- 本地 Markdown/JSON 保存日志、复盘、项目和个人背景；默认数据目录为 Windows“文档/知己”，侧栏与设置均显示真实路径，设置可直接打开文件夹。
- 用户自己的 OpenAI 兼容 API Key；Key 仅由 Electron Main Process 使用，并通过 Windows `safeStorage` 加密。
- 支持日反馈、周报、月报、项目复盘；日志可选项目，周期复盘可补选日期范围并在生成前预览材料，生成结果直接在当前页阅读。
- 个人背景固定保存在 `<数据目录>/profile/about-me.md`，可在设置中查看、编辑、启停和清空；当前不会自动生成画像，也不会把资料注入 AI 分析。
- 设置页支持带 SHA-256 清单和业务 Schema 校验的 `.zhiji.zip` 备份与空目录恢复；导出日志、复盘、项目、个人背景和公开配置，不包含 API Key 或缓存。
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

2026-08-13 已通过 25 个测试文件、57 项自动化测试、TypeScript、Lint、真实 Electron E2E 和 Windows x64 打包。E2E 使用隔离临时数据目录验证“创建项目—关联并保存日志—从历史读取—核对 Markdown 落盘”；本轮没有执行安装程序，也没有写入真实用户数据。

为避免干扰当前电脑运行，本次未执行安装程序。Windows 11 安装/升级/卸载与数据保留、Windows 10 干净虚拟机、代码签名、自动更新和移动端仍暂缓；未真实运行前不得标记通过。当前恢复采用更安全的空目录模型，不支持向已有数据逐文件合并冲突。
