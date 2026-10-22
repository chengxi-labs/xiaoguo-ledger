# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)：`主版本.次版本.修订号`。
`versionCode` 与 `versionName` 的对应关系记录在 [android/app/build.gradle](android/app/build.gradle)。

## [1.0.3] - 2026-10-22

首个开源版本。功能与交付到真机上的 1.0.3 版本一致。

### 新增

- 支出 / 收入记账，支持金额、日期、备注与十个支出分类
- 月度汇总卡片，支持前后翻月与月份选择器跳转
- 全历史搜索，可按备注、分类、金额、日期检索
- 分类支出统计（本月 / 本年），横向条形对比
- 单笔删除
- 导出全部账单（UTF-8 BOM CSV）与完整备份（JSON）
- 按 `id` 去重的合并导入
- PWA 清单与 Service Worker 离线缓存，可安装到主屏幕
- Android WebView 外壳，含 `XiaoguoAndroid.saveToDownloads()` 原生导出桥接
- 旧记账软件账单迁移通道，含分类映射与日期修正

### 变更（相对发布给个人的交付包）

- 移除签名文件、签名口令、APK 产物与真实账目导出文件，仓库内不保留任何密钥与真实数据
- 内置账目数据替换为由 `scripts/gen-demo-ledger.mjs` 生成的合成演示数据
- `SHARK_CATEGORY_OVERRIDES` 中两处带个人色彩的分类名替换为通用条目（不影响已导入的数据）
- 目录结构标准化为 `android/`、`web/`、`docs/`、`assets/`、`scripts/`
- 补充 MIT 许可证、贡献指南、安全策略与发布指南
- 修正 3 张截图的扩展名（实为 JPEG 却命名为 `.png`）
