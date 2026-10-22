# 贡献指南

感谢你愿意改进小果管钱。这个项目很小，所以约定也尽量少。

## 开始之前

- 提 Issue / PR 时**不要附带真实账目**。需要复现数据时，请用 `scripts/gen-demo-ledger.mjs` 生成，或手写两三条假记录。
- 截图请打码金额与备注，或直接用 `?demo=1` 的演示界面。
- 不要提交任何 `.keystore`、`keystore.properties`、口令、APK 产物。

## 环境

| 目标 | 需要 |
| --- | --- |
| 改网页版 | Node.js 20+（仅用于本地静态服务器，无依赖） |
| 改 Android | Android Studio Ladybug+、JDK 17、Android SDK 35 |

## 工作流

```bash
git clone https://github.com/chengxi-labs/xiaoguo-ledger.git
cd xiaoguo-ledger

# 网页版
cd web && node server.js     # http://127.0.0.1:4173/

# 改完前端后同步到 Android
node scripts/sync-web-assets.mjs

# 提交前自检（必须通过）
node scripts/check-repo.mjs
```

## 代码风格

- **前端**：原生 ES2020，不引入框架与构建工具。2 空格缩进，双引号，语句结尾带分号，与现有 `web/app.js` 保持一致。
- **Java**：4 空格缩进，遵循 Android 默认代码风格；`MainActivity` 保持单文件、无第三方依赖。
- **提交信息**：`<类型>: <一句话说明>`，类型取 `feat` / `fix` / `docs` / `refactor` / `build` / `chore`，例如：

  ```text
  feat: 支持按月导出 CSV
  fix: 月份选择器在 12 月跨年时错位
  ```

## 提交 PR

1. 从 `main` 切出分支：`git checkout -b feat/monthly-export`
2. 说明动机与验证方式（真机型号 / 浏览器版本）。
3. 确认 `node scripts/check-repo.mjs` 通过、`node scripts/sync-web-assets.mjs --check` 无漂移。
4. 一个 PR 只做一件事；涉及界面改动的请附前后对比截图。

## 新增功能时的取舍

这个项目刻意保持"零依赖、零后端、零网络"。以下方向通常不会被合并：

- 引入 React / Vue / 打包器
- 云同步、账号体系、任何形式的数据上报
- 需要常驻后台服务的功能

如果你的需求超出这个边界，欢迎 fork 后自行演进 —— MIT 许可证允许这样做。
