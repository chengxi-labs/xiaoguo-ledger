# 小果管钱 · 网页版 / PWA

面向手机浏览器的轻量记账应用。数据只保存在当前设备，可安装到主屏幕并离线使用。

## 运行

```bash
cd web
node server.js
# 打开 http://127.0.0.1:4173/
```

也可以用任意静态服务器托管本目录：

```bash
python -m http.server 4173
# 或 npx serve .
```

`server.js` 只做一件事：把本目录作为静态站点提供。它不是构建步骤，也没有依赖 —— 应用本身是一堆纯静态文件。

带演示账目的界面：

```text
http://127.0.0.1:4173/?demo=1
```

## 功能

- 记录支出与收入（金额、日期、备注、分类）
- 十个支出分类：餐饮、日用、零食、运动、娱乐、约会、学习、礼物、住房、打车
- 月度汇总卡片，前后翻月
- 月份选择器，直接跳到任意年月
- 全历史搜索：按备注、分类、金额或日期查找任意账单，结果分批加载
- 分类支出统计（本月 / 本年）
- 最近账目列表与单笔删除
- 刷新后数据仍在（`localStorage`）
- 导出全部账单 CSV 或 JSON 完整备份
- 合并导入 JSON 备份，按 `id` 去重
- PWA：可添加到主屏幕，Service Worker 离线缓存

## 文件说明

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面结构（含记账、导出、月份选择、统计四个浮层模板） |
| `styles.css` | 移动端样式，CSS 变量定义配色 |
| `app.js` | 全部逻辑：状态、存储、渲染、记账、导出、导入 |
| `manifest.webmanifest` | PWA 安装信息（名称、图标、主题色） |
| `sw.js` | 离线缓存策略（缓存优先 + 回填） |
| `server.js` | 本地静态服务器，仅开发用，不进入 APK |
| `assets/icons/` | 应用图标 192 / 512 / 原图 |
| `assets/categories/` | 十个分类图标 |
| `imports/shark-ledger.json` | 演示账目（125 条合成数据） |

## 演示数据

`imports/shark-ledger.json` 是**合成数据**，由 [`scripts/gen-demo-ledger.mjs`](../scripts/gen-demo-ledger.mjs) 生成，不含任何真实用户信息：

- 125 条记录，2026-07-01 ~ 2026-10-22
- 覆盖全部 10 个支出分类，含工资与零星收入
- `source` 字段统一为 `演示数据`

重新生成：

```bash
node scripts/gen-demo-ledger.mjs
node scripts/sync-web-assets.mjs    # 同步进 Android 工程
```

## 与 Android 版的关系

本目录是前端的**唯一源头**。`android/app/src/main/assets/www/` 是它的镜像，由 `scripts/sync-web-assets.mjs` 单向同步（排除 `server.js`、`README.md`）。两端的逻辑完全一致，只有导出路径不同：浏览器用 `Blob` 下载，Android 调用原生 `XiaoguoAndroid.saveToDownloads()`。

## 添加新分类

1. 在 `app.js` 的 `CATEGORIES` 数组里追加 `{ id, name, icon }`
2. 把图标放进 `assets/categories/`
3. 在 `sw.js` 的 `APP_SHELL` 里加上图标路径，并升级 `CACHE_NAME`
4. 运行 `node scripts/sync-web-assets.mjs` 同步到 Android

## 兼容性

- 目标浏览器：Chrome / Edge / Safari 近两年版本，iOS Safari 15+
- 依赖 `localStorage`、`fetch`、`URLSearchParams`、`replaceChildren()`、CSS 变量
- 不使用可选链以外的实验性语法（`window.XiaoguoAndroid?.` 为可选链，Safari 13.1+ 支持）
