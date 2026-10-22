# 小果管钱 · Android 工程

`com.xiaoguo.ledger` 的完整 Android Studio 工程。它本身几乎不含业务逻辑 —— 界面与记账逻辑都在 `app/src/main/assets/www/` 里，由 `MainActivity` 用 WebView 承载。

## 环境要求

| 工具 | 版本 |
| --- | --- |
| Android Studio | Ladybug (2024.2) 或更新 |
| JDK | 17 |
| Android SDK | Platform 35、Build-Tools 35.0.1 |
| Gradle | 由 Wrapper 提供（8.9），无需单独安装 |

## 打开与运行

1. Android Studio → `Open` → 选择本目录（`android/`）
2. 等待 Gradle Sync 完成
3. 连接 Android 8.0（API 26）以上设备，点 Run

## 命令行构建

```powershell
# 调试包（使用 Android 默认调试密钥，无需任何配置）
.\gradlew.bat assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk

# 清理
.\gradlew.bat clean
```

## 签名与正式包

仓库**不含**签名密钥。需要正式签名时：

```powershell
# 1. 生成自己的 keystore
keytool -genkeypair -v -keystore my-release.keystore `
  -alias xiaoguo -keyalg RSA -keysize 2048 -validity 10000

# 2. 复制配置模板并填入真实口令
Copy-Item keystore.properties.example keystore.properties
# 编辑 keystore.properties：storeFile / storePassword / keyAlias / keyPassword

# 3. 构建
.\gradlew.bat assembleRelease
# 产物：app/build/outputs/apk/release/app-release.apk
```

`keystore.properties` 与 `*.keystore` 已被 `.gitignore` 拦下。构建完请把它移出仓库目录 —— 留在原地虽然不会被提交，但容易被打包或误传。

签名配置是条件生效的：`keystore.properties` 不存在时，`release` 构建产出未签名包，`debug` 构建使用系统默认调试密钥，因此克隆即可构建。

> 已发布过的应用，后续升级必须使用**同一个** keystore，否则安装时会被系统拒绝。密钥保管见仓库根目录的 [SECURITY.md](../SECURITY.md)。

## 工程结构

```
android/
├── app/
│   ├── build.gradle                 应用配置与签名配置
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/com/xiaoguo/ledger/
│       │   └── MainActivity.java    WebView 外壳 + 资源拦截 + 导出桥接
│       ├── assets/www/              前端资源（由 ../../web/ 同步而来，勿手改）
│       └── res/drawable/app_icon.png
├── gradle/wrapper/                  Gradle Wrapper
├── build.gradle                     根构建脚本（AGP 8.7.3）
├── settings.gradle
├── gradle.properties
└── keystore.properties.example      签名配置模板
```

## 修改前端

**不要直接编辑 `app/src/main/assets/www/`。** 它是 `web/` 的单向镜像，下次同步会被覆盖：

```powershell
cd ..
node scripts/sync-web-assets.mjs           # web/ → android/app/src/main/assets/www/
node scripts/sync-web-assets.mjs --check   # 只校验是否一致（CI 用）
```

`server.js` 与 `README.md` 只存在于 `web/`，不会进入 APK。

## 打包进 APK 的数据

- `assets/www/imports/shark-ledger.json`：125 条**合成演示数据**，首次启动时自动合并，方便看到有数据的界面
- 真实账本保存在设备的 WebView `localStorage` 中，不随 APK 分发

若希望首次启动为空账本，删除该 JSON 后重新构建。

## 常见问题

**Gradle Sync 失败提示找不到 SDK 35**
在 `Settings → Languages & Frameworks → Android SDK` 中安装 Platform 35 与 Build-Tools 35.0.1。

**安装时提示「应用未安装 / 签名不一致」**
设备上已有用其他 keystore 签名的同包名应用。先卸载旧版本，或使用相同 keystore 重新签名。

**导出失败**
Android 10 及以上走 `MediaStore`，文件落在 `Downloads/`；Android 9 及以下需要存储权限。若权限被拒，导出会弹出「导出失败」提示。
