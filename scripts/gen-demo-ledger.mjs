#!/usr/bin/env node
/**
 * 生成「小果管钱」的演示账目数据。
 *
 * 仓库中分发的 imports/shark-ledger.json 必须完全是合成数据，
 * 不得包含任何真实用户的记账记录。本脚本用固定种子的伪随机数生成器
 * 产出可复现的演示数据，任何人运行都会得到完全相同的结果。
 *
 * 用法：
 *   node scripts/gen-demo-ledger.mjs
 *   node scripts/gen-demo-ledger.mjs --out web/imports/shark-ledger.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/* ------------------------------------------------------------------ */
/* 确定性随机数（mulberry32）：同一种子 => 同一份数据，便于复现与审查   */
/* ------------------------------------------------------------------ */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261022);

const pick = (list) => list[Math.floor(rand() * list.length)];
const int = (min, max) => min + Math.floor(rand() * (max - min + 1));
const money = (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100;

/* ------------------------------------------------------------------ */
/* 分类配置：与 web/app.js 中的 CATEGORIES 保持一致                    */
/* ------------------------------------------------------------------ */

const EXPENSE_PROFILES = [
  {
    category: "food",
    weight: 46,
    amount: () => money(8, 45),
    notes: ["早餐", "午餐", "晚餐", "食堂", "外卖", "快餐", "面馆", "工作餐"],
  },
  {
    category: "daily",
    weight: 12,
    amount: () => money(9, 160),
    notes: ["纸巾", "洗衣液", "牙膏", "生活用品", "超市采购", "快递", "热水壶"],
  },
  {
    category: "snack",
    weight: 9,
    amount: () => money(5, 40),
    notes: ["水果", "酸奶", "奶茶", "零食", "面包", "咖啡"],
  },
  {
    category: "taxi",
    weight: 10,
    amount: () => money(8, 60),
    notes: ["打车", "地铁", "公交", "共享单车"],
  },
  {
    category: "entertainment",
    weight: 6,
    amount: () => money(30, 220),
    notes: ["电影", "游戏", "KTV", "演出", "桌游"],
  },
  {
    category: "date",
    weight: 6,
    amount: () => money(40, 300),
    notes: ["一起吃饭", "看电影", "逛街", "咖啡店", "周末出游"],
  },
  {
    category: "study",
    weight: 4,
    amount: () => money(20, 200),
    notes: ["买书", "网课", "会员充值", "打印资料", "文具"],
  },
  {
    category: "home",
    weight: 4,
    amount: () => money(50, 1400),
    notes: ["房租", "电费", "水费", "燃气费", "物业费"],
  },
  {
    category: "sport",
    weight: 2,
    amount: () => money(30, 400),
    notes: ["健身卡", "运动鞋", "蛋白粉", "羽毛球", "游泳"],
  },
  {
    category: "gift",
    weight: 1,
    amount: () => money(50, 500),
    notes: ["生日礼物", "节日红包", "伴手礼", "鲜花"],
  },
];

const TOTAL_WEIGHT = EXPENSE_PROFILES.reduce((sum, item) => sum + item.weight, 0);

function pickExpenseProfile() {
  let ticket = rand() * TOTAL_WEIGHT;
  for (const profile of EXPENSE_PROFILES) {
    ticket -= profile.weight;
    if (ticket <= 0) return profile;
  }
  return EXPENSE_PROFILES[0];
}

/* ------------------------------------------------------------------ */
/* 生成                                                                 */
/* ------------------------------------------------------------------ */

const START = { year: 2026, month: 7, day: 1 };
const END = { year: 2026, month: 10, day: 22 };

const pad = (value) => String(value).padStart(2, "0");
const dayKey = (date) =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const records = [];
const start = Date.UTC(START.year, START.month - 1, START.day);
const end = Date.UTC(END.year, END.month - 1, END.day);

let seedId = 0;
const nextId = () => `demo-${String(++seedId).padStart(4, "0")}`;

function pushExpense(dateKey, createdAt, profile, amount, note) {
  records.push({
    id: nextId(),
    type: "expense",
    amount,
    category: profile.category,
    note,
    date: dateKey,
    createdAt,
    source: "演示数据",
    sourceId: seedId,
    sourceCategory: profile.category,
  });
}

/* 每月固定支出：房租 + 水电 */
const FIXED_MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];
const fixedByMonth = new Set();

for (let stamp = start; stamp <= end; stamp += 86400000) {
  const date = new Date(stamp);
  const dateKey = dayKey(date);
  const monthKey = dateKey.slice(0, 7);

  /* 每月 5 号房租 */
  if (dateKey.endsWith("-05") && !fixedByMonth.has(`${monthKey}-rent`)) {
    fixedByMonth.add(`${monthKey}-rent`);
    pushExpense(
      dateKey,
      new Date(stamp + 10 * 3600000).toISOString(),
      { category: "home" },
      1350,
      "房租",
    );
  }

  /* 每月 12 号水电燃气 */
  if (dateKey.endsWith("-12") && FIXED_MONTHS.includes(monthKey)) {
    fixedByMonth.add(`${monthKey}-bill`);
    pushExpense(
      dateKey,
      new Date(stamp + 20 * 3600000).toISOString(),
      { category: "home" },
      money(80, 220),
      "水电燃气",
    );
  }

  /* 日常消费：每天 0~2 笔 */
  const dailyCount = rand() < 0.32 ? 0 : rand() < 0.72 ? 1 : 2;
  for (let index = 0; index < dailyCount; index += 1) {
    const profile = pickExpenseProfile();
    const hour = 8 + Math.floor(rand() * 14);
    const minute = Math.floor(rand() * 60);
    const createdAt = new Date(stamp + hour * 3600000 + minute * 60000).toISOString();
    pushExpense(dateKey, createdAt, profile, profile.amount(), pick(profile.notes));
  }
}

/* 每月工资收入 */
for (const monthKey of FIXED_MONTHS) {
  const dateKey = `${monthKey}-10`;
  if (dateKey > dayKey(new Date(end))) continue;
  records.push({
    id: nextId(),
    type: "income",
    amount: 8000,
    category: "income",
    note: "工资",
    date: dateKey,
    createdAt: new Date(`${dateKey}T09:00:00.000Z`).toISOString(),
    source: "演示数据",
    sourceId: seedId,
    sourceCategory: "收入",
  });
}

/* 零星收入：红包 / 报销 */
for (const [dateKey, note, amount] of [
  ["2026-08-15", "报销", 320],
  ["2026-09-28", "朋友还款", 200],
  ["2026-10-06", "节日红包", 500],
]) {
  records.push({
    id: nextId(),
    type: "income",
    amount,
    category: "income",
    note,
    date: dateKey,
    createdAt: new Date(`${dateKey}T12:00:00.000Z`).toISOString(),
    source: "演示数据",
    sourceId: seedId,
    sourceCategory: "收入",
  });
}

/* 按时间排序，与真实导出文件的顺序习惯保持一致 */
records.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

/* ------------------------------------------------------------------ */
/* 输出                                                                 */
/* ------------------------------------------------------------------ */

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outPath = resolve(
  outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : "web/imports/shark-ledger.json",
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");

const expenseTotal = records
  .filter((item) => item.type === "expense")
  .reduce((sum, item) => sum + item.amount, 0);
const incomeTotal = records
  .filter((item) => item.type === "income")
  .reduce((sum, item) => sum + item.amount, 0);

console.log(`已生成 ${records.length} 条演示账目 -> ${outPath}`);
console.log(`  支出合计：¥${expenseTotal.toFixed(2)}`);
console.log(`  收入合计：¥${incomeTotal.toFixed(2)}`);
console.log(`  日期范围：${records[0].date} ~ ${records[records.length - 1].date}`);
