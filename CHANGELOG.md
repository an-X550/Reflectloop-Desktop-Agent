---
last_updated: 2026-08-21
---

# 更新记录

## [2026-08-21 21:36] [修复] 修复 Windows 发布包遗漏 DSH 运行时依赖 (v2.0.4 -> v2.0.5)

- **受影响文件**: `package.json`、`package-lock.json`、`VERSION`、`README.md`、`e2e/desktop.spec.ts`
- **改动摘要**: 将 DSH Utility 实际需要的 peer 依赖声明为应用的直接生产依赖，确保 `app.asar` 自包含；E2E 改为从隔离工作目录启动打包入口，避免开发机 `node_modules` 掩盖发布包缺依赖。
