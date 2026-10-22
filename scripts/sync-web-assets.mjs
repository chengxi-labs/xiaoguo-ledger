#!/usr/bin/env node
/**
 * 把 web/ 的前端资源单向同步到 Android 的 assets/www/。
 *
 * Android 端不直接引用仓库根目录下的 web/，因为 aapt 只打包 module 内的 assets。
 * 为了保持"同一份前端"的可信性，这里做全量镜像删除 + 复制：
 * 目标目录里任何脚本不认识的文件都会被清掉，避免残留旧代码。
 *
 * 用法：
 *   node scripts/sync-web-assets.mjs            # 同步
 *   node scripts/sync-web-assets.mjs --check    # 只比对，不写入（CI 用）
 */

import { cp, rm, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "web");
const DEST = join(ROOT, "android", "app", "src", "main", "assets", "www");

/** 仅存在于开发环境、不进入 APK 的文件 */
const EXCLUDE = new Set(["server.js", "README.md", "node_modules", ".DS_Store"]);

const checkOnly = process.argv.includes("--check");

/** 递归收集文件清单（相对路径，统一使用 / 分隔） */
async function walk(dir, base = dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (EXCLUDE.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await walk(full, base)));
    } else if (entry.isFile()) {
      result.push(relative(base, full).split("\\").join("/"));
    }
  }
  return result.sort();
}

async function hash(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function main() {
  if (!(await stat(SRC)).isDirectory()) {
    throw new Error(`找不到前端目录：${SRC}`);
  }

  const files = await walk(SRC);

  if (checkOnly) {
    const drift = [];
    for (const rel of files) {
      const dest = join(DEST, rel);
      try {
        if ((await hash(join(SRC, rel))) !== (await hash(dest))) drift.push(rel);
      } catch {
        drift.push(`${rel} (缺失)`);
      }
    }
    if (drift.length > 0) {
      console.error("assets/www 与 web/ 不一致：");
      for (const item of drift) console.error(`  - ${item}`);
      console.error("\n请运行：node scripts/sync-web-assets.mjs");
      process.exit(1);
    }
    console.log(`✓ assets/www 与 web/ 一致（${files.length} 个文件）`);
    return;
  }

  await rm(DEST, { recursive: true, force: true });
  await mkdir(DEST, { recursive: true });
  for (const rel of files) {
    const target = join(DEST, rel);
    await mkdir(dirname(target), { recursive: true });
    await cp(join(SRC, rel), target);
  }

  console.log(`✓ 已同步 ${files.length} 个文件 -> android/app/src/main/assets/www/`);
  for (const rel of files) console.log(`  ${rel}`);
}

main().catch((error) => {
  console.error(`同步失败：${error.message}`);
  process.exit(1);
});
