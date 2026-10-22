#!/usr/bin/env node
/**
 * 开源仓库自检：提交前跑一遍，确保没有把私密内容带进版本库。
 *
 * 检查项：
 *   1. 敏感文件名（keystore / 签名信息 / keystore.properties）
 *   2. 硬编码口令特征（password= 后面跟的不是占位符）
 *   3. 真实账单特征（旧记账软件导出的 source 标识、超量账目记录）
 *   4. 前端与 Android assets 是否同步
 *
 * 用法：
 *   node scripts/check-repo.mjs
 * 退出码 0 表示通过，1 表示发现问题。
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([".git", "node_modules", "build", ".gradle", ".idea", "assets-www-check"]);
const TEXT_EXT = new Set([".md", ".js", ".mjs", ".json", ".gradle", ".properties", ".xml", ".txt", ".yml", ".yaml", ".html", ".css", ".java"]);

const FORBIDDEN_NAME = [
  /\.keystore$/i,
  /\.jks$/i,
  /^keystore\.properties$/i,
  /签名信息/,
  /\.apk$/i,
  /\.aab$/i,
];

/** 真实数据标记：旧软件名称、以及旧账本里出现过的个人标签 */
const REAL_DATA_MARKERS = [
  { pattern: "鲨鱼记账", why: "旧记账软件导出的 source 字段，说明是真实账单" },
  { pattern: "见蒽宝", why: "个人昵称，曾经出现在真实账单备注与分类映射里" },
  { pattern: "一起长胖", why: "个人化的分类标签，不应随公开仓库发布" },
];

/** 演示数据里允许出现的 source 值 */
const ALLOWED_SOURCES = new Set(["演示数据"]);

const problems = [];
const warnings = [];

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = await walk(ROOT);

/* 1. 文件名 ---------------------------------------------------------- */
for (const file of files) {
  const rel = relative(ROOT, file).split("\\").join("/");
  const name = rel.split("/").pop();
  if (FORBIDDEN_NAME.some((re) => re.test(name))) {
    problems.push(`敏感文件不应提交：${rel}`);
  }
}

/* 2. 文本内容 -------------------------------------------------------- */
for (const file of files) {
  const rel = relative(ROOT, file).split("\\").join("/");
  if (!TEXT_EXT.has(extname(file).toLowerCase())) continue;
  if (rel.startsWith("scripts/")) continue; // 自检脚本自身包含特征字符串

  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    continue;
  }

  for (const { pattern, why } of REAL_DATA_MARKERS) {
    if (text.includes(pattern)) {
      problems.push(`${rel} 命中真实数据特征「${pattern}」（${why}）`);
    }
  }

  // 明文口令：password 值既不是占位符也不是空
  const passwordLine = /(storePassword|keyPassword)\s*=\s*(.+)/g;
  for (const match of text.matchAll(passwordLine)) {
    const value = match[2].trim();
    if (value && !/^(YOUR_|CHANGE_ME|<|\.\.\.)/i.test(value)) {
      problems.push(`${rel} 含明文签名口令`);
    }
  }
}

/* 3. 账目 JSON ------------------------------------------------------- */
const ledgerFiles = files.filter((file) => file.endsWith("shark-ledger.json"));
if (ledgerFiles.length === 0) {
  warnings.push("未找到 imports/shark-ledger.json，首次启动将没有演示数据");
}
for (const file of ledgerFiles) {
  const rel = relative(ROOT, file).split("\\").join("/");
  let records;
  try {
    records = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    problems.push(`${rel} 不是合法 JSON：${error.message}`);
    continue;
  }
  if (!Array.isArray(records)) {
    problems.push(`${rel} 顶层应为数组`);
    continue;
  }
  if (records.length > 400) {
    problems.push(`${rel} 含 ${records.length} 条记录，超过演示数据上限（400），疑似真实账单`);
  }
  for (const record of records) {
    if (record?.source && !ALLOWED_SOURCES.has(record.source)) {
      problems.push(`${rel} 出现非演示数据来源「${record.source}」`);
      break;
    }
  }
}

/* 4. 前端与 assets 同步 ---------------------------------------------- */
try {
  execFileSync(process.execPath, [join(ROOT, "scripts", "sync-web-assets.mjs"), "--check"], {
    stdio: "pipe",
  });
} catch (error) {
  const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
  problems.push(`前端资源未同步：\n${output || "详见 sync-web-assets.mjs --check"}`);
}

/* 结果 --------------------------------------------------------------- */
for (const warning of warnings) console.warn(`⚠ ${warning}`);
if (problems.length > 0) {
  console.error(`\n✗ 自检未通过，发现 ${problems.length} 个问题：`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`✓ 自检通过（扫描 ${files.length} 个文件，${ledgerFiles.length} 份账目数据）`);
