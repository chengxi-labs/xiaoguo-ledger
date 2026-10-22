const STORAGE_KEY = "xiaoguo-ledger-transactions-v1";
const MAPPING_VERSION_KEY = "xiaoguo-ledger-mapping-version";
/* 旧记账软件里的自定义分类名 -> 本应用的分类 id。
 * 公开版本只保留通用名称：原版本里带有个人色彩的标签没有随仓库发布。
 * 如果你自己的备份中存在自定义分类名，在这里追加即可，例如：
 *   ["我的分类名", "date"],
 */
const SHARK_CATEGORY_OVERRIDES = new Map([
  ["其他支出", "date"],
]);

const CATEGORIES = [
  { id: "food", name: "餐饮", icon: "./assets/categories/food.png" },
  { id: "daily", name: "日用", icon: "./assets/categories/daily.png" },
  { id: "snack", name: "零食", icon: "./assets/categories/snack.png" },
  { id: "sport", name: "运动", icon: "./assets/categories/sport.png" },
  { id: "entertainment", name: "娱乐", icon: "./assets/categories/entertainment.png" },
  { id: "date", name: "约会", icon: "./assets/categories/date.png" },
  { id: "study", name: "学习", icon: "./assets/categories/study.png" },
  { id: "gift", name: "礼物", icon: "./assets/categories/gift.png" },
  { id: "home", name: "住房", icon: "./assets/categories/home.png" },
  { id: "taxi", name: "打车", icon: "./assets/categories/taxi.png" },
];

const categoryMap = new Map(CATEGORIES.map((category) => [category.id, category]));

const elements = {
  todayLabel: document.querySelector("#todayLabel"),
  previousMonth: document.querySelector("#previousMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  currentMonth: document.querySelector("#currentMonth"),
  balance: document.querySelector("#balance"),
  incomeTotal: document.querySelector("#incomeTotal"),
  expenseTotal: document.querySelector("#expenseTotal"),
  recordTitle: document.querySelector("#recordTitle"),
  recordCount: document.querySelector("#recordCount"),
  recordList: document.querySelector("#recordList"),
  recordTemplate: document.querySelector("#recordTemplate"),
  searchInput: document.querySelector("#searchInput"),
  clearSearch: document.querySelector("#clearSearch"),
  categoryStats: document.querySelector("#categoryStats"),
  statsPeriod: document.querySelector("#statsPeriod"),
  statsTotal: document.querySelector("#statsTotal"),
  statsButton: document.querySelector("#statsButton"),
  addButton: document.querySelector("#addButton"),
  exportButton: document.querySelector("#exportButton"),
  sheetLayer: document.querySelector("#sheetLayer"),
  sheetBackdrop: document.querySelector("#sheetBackdrop"),
  closeSheet: document.querySelector("#closeSheet"),
  exportLayer: document.querySelector("#exportLayer"),
  exportBackdrop: document.querySelector("#exportBackdrop"),
  closeExport: document.querySelector("#closeExport"),
  importData: document.querySelector("#importData"),
  exportCsv: document.querySelector("#exportCsv"),
  exportJson: document.querySelector("#exportJson"),
  monthPickerLayer: document.querySelector("#monthPickerLayer"),
  monthPickerBackdrop: document.querySelector("#monthPickerBackdrop"),
  closeMonthPicker: document.querySelector("#closeMonthPicker"),
  previousPickerYear: document.querySelector("#previousPickerYear"),
  nextPickerYear: document.querySelector("#nextPickerYear"),
  monthPickerYear: document.querySelector("#monthPickerYear"),
  monthGrid: document.querySelector("#monthGrid"),
  goCurrentMonth: document.querySelector("#goCurrentMonth"),
  statsLayer: document.querySelector("#statsLayer"),
  statsBackdrop: document.querySelector("#statsBackdrop"),
  closeStats: document.querySelector("#closeStats"),
  entryForm: document.querySelector("#entryForm"),
  amountInput: document.querySelector("#amountInput"),
  dateInput: document.querySelector("#dateInput"),
  noteInput: document.querySelector("#noteInput"),
  categoryFieldset: document.querySelector("#categoryFieldset"),
  categoryGrid: document.querySelector("#categoryGrid"),
  toast: document.querySelector("#toast"),
};

const now = new Date();
const state = {
  transactions: loadTransactions(),
  viewingYear: now.getFullYear(),
  viewingMonth: now.getMonth(),
  entryType: "expense",
  selectedCategory: "food",
  statsRange: "month",
  searchQuery: "",
  searchLimit: 60,
  pickerYear: now.getFullYear(),
};

let toastTimer = null;

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function loadTransactions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

function applyCategoryMigrations() {
  if (localStorage.getItem(MAPPING_VERSION_KEY) === "2026-10-22-date-overrides-v1") {
    return;
  }

  let changed = false;
  state.transactions = state.transactions.map((transaction) => {
    const override = SHARK_CATEGORY_OVERRIDES.get(transaction.sourceCategory);
    if (!override || transaction.type !== "expense" || transaction.category === override) {
      return transaction;
    }
    changed = true;
    return { ...transaction, category: override };
  });

  if (changed) saveTransactions();
  localStorage.setItem(MAPPING_VERSION_KEY, "2026-10-22-date-overrides-v1");
}

function formatMoney(value) {
  return `¥${Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatClock(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRecordDate(key) {
  const date = parseLocalDate(key);
  const today = parseLocalDate(localDateKey());
  const diffDays = Math.round((today - date) / 86_400_000);
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "昨天";
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFullDate(key) {
  const date = parseLocalDate(key);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function getCategory(transaction) {
  if (transaction.type === "income") {
    return { id: "income", name: "收入", icon: "./assets/icons/app-icon-192.png" };
  }
  return categoryMap.get(transaction.category) || CATEGORIES[0];
}

function transactionsForViewedMonth() {
  return state.transactions
    .filter((transaction) => {
      const date = parseLocalDate(transaction.date);
      return (
        date.getFullYear() === state.viewingYear &&
        date.getMonth() === state.viewingMonth
      );
    })
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      return byDate || String(b.createdAt).localeCompare(String(a.createdAt));
    });
}

function render() {
  const currentMonth = new Date(state.viewingYear, state.viewingMonth, 1);
  elements.currentMonth.textContent = `${currentMonth.getFullYear()}年${currentMonth.getMonth() + 1}月`;

  const monthlyTransactions = transactionsForViewedMonth();
  const searchQuery = elements.searchInput.value.trim().toLowerCase();
  state.searchQuery = searchQuery;
  elements.clearSearch.hidden = !searchQuery;
  const income = monthlyTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = monthlyTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  elements.balance.textContent = formatMoney(income - expense);
  elements.incomeTotal.textContent = formatMoney(income);
  elements.expenseTotal.textContent = formatMoney(expense);
  renderCategoryStats();

  const searchResults = searchQuery
    ? state.transactions
        .filter((transaction) => {
          const category = getCategory(transaction);
          const date = parseLocalDate(transaction.date);
          const searchable = [
            transaction.note,
            category.name,
            transaction.sourceCategory,
            transaction.source,
            transaction.date,
            `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`,
            Number(transaction.amount).toFixed(2),
            String(transaction.amount),
          ]
            .join(" ")
            .toLowerCase();
          return searchable.includes(searchQuery);
        })
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            String(b.createdAt).localeCompare(String(a.createdAt)),
        )
    : null;

  const displayedTransactions = searchResults
    ? searchResults.slice(0, state.searchLimit)
    : monthlyTransactions;

  elements.recordTitle.textContent = searchResults ? "搜索结果" : "当月记录";
  elements.recordCount.textContent = `${searchResults ? searchResults.length : monthlyTransactions.length} 笔`;
  elements.recordList.replaceChildren();

  if (displayedTransactions.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = searchResults
      ? "<strong>没有找到匹配的账单</strong><span>试试备注里的关键词、分类名称、金额或日期。</span>"
      : "<strong>这个月还没有账目</strong><span>点下面的“记一笔”，开始记录第一笔收支。</span>";
    elements.recordList.append(emptyState);
    return;
  }

  displayedTransactions.forEach((transaction) => {
    const category = getCategory(transaction);
    const fragment = elements.recordTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".record-item");
    const icon = fragment.querySelector(".record-icon");
    const title = fragment.querySelector(".record-title");
    const meta = fragment.querySelector(".record-meta");
    const amount = fragment.querySelector(".record-amount");
    const deleteButton = fragment.querySelector(".delete-button");

    item.dataset.id = transaction.id;
    icon.src = category.icon;
    icon.alt = `${category.name}分类`;
    title.textContent = transaction.note?.trim() || category.name;
    const sourceLabel = transaction.source ? ` · ${transaction.source}` : "";
    const sourceCategoryLabel = transaction.sourceCategory ? ` · ${transaction.sourceCategory}` : "";
    const dateLabel = searchResults ? formatFullDate(transaction.date) : formatRecordDate(transaction.date);
    meta.textContent = `${dateLabel} · ${formatClock(transaction.createdAt)}${sourceCategoryLabel}${sourceLabel}`;
    amount.textContent = `${transaction.type === "income" ? "+" : "-"}${formatMoney(transaction.amount)}`;
    amount.classList.toggle("is-income", transaction.type === "income");
    deleteButton.addEventListener("click", () => deleteTransaction(transaction.id));
    elements.recordList.append(fragment);
  });

  if (searchResults && searchResults.length > displayedTransactions.length) {
    const showMore = document.createElement("button");
    showMore.type = "button";
    showMore.className = "show-more-button";
    showMore.textContent = `再显示 ${Math.min(60, searchResults.length - displayedTransactions.length)} 笔`;
    showMore.addEventListener("click", () => {
      state.searchLimit += 60;
      render();
    });
    elements.recordList.append(showMore);
  }
}

function renderCategoryStats() {
  const year = state.viewingYear;
  const month = state.viewingMonth;
  const isYear = state.statsRange === "year";
  const periodTransactions = state.transactions.filter((transaction) => {
    if (transaction.type !== "expense") return false;
    const date = parseLocalDate(transaction.date);
    return date.getFullYear() === year && (isYear || date.getMonth() === month);
  });

  const totals = new Map(CATEGORIES.map((category) => [category.id, 0]));
  periodTransactions.forEach((transaction) => {
    const categoryId = totals.has(transaction.category) ? transaction.category : "daily";
    totals.set(categoryId, totals.get(categoryId) + Number(transaction.amount || 0));
  });

  const maxAmount = Math.max(...totals.values(), 1);
  const totalAmount = [...totals.values()].reduce((sum, amount) => sum + amount, 0);
  const sortedCategories = CATEGORIES.map((category) => ({
    ...category,
    amount: totals.get(category.id),
  })).sort((a, b) => b.amount - a.amount);

  elements.statsPeriod.textContent = isYear ? `${year}年共支出` : `${month + 1}月共支出`;
  elements.statsTotal.textContent = formatMoney(totalAmount);
  elements.categoryStats.replaceChildren();

  sortedCategories.forEach((category) => {
    const row = document.createElement("div");
    row.className = "category-stat-row";
    row.innerHTML = `
      <img src="${category.icon}" alt="" />
      <span></span>
      <div class="category-stat-bar" aria-hidden="true"><i></i></div>
      <strong></strong>
    `;
    row.querySelector("span").textContent = category.name;
    row.querySelector("i").style.setProperty(
      "--bar-width",
      `${Math.max(3, (category.amount / maxAmount) * 100)}%`,
    );
    row.querySelector("strong").textContent = formatMoney(category.amount);
    elements.categoryStats.append(row);
  });
}

function renderCategoryOptions() {
  elements.categoryGrid.replaceChildren();
  CATEGORIES.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-option";
    button.dataset.category = category.id;
    button.innerHTML = `<img src="${category.icon}" alt="" /><span>${category.name}</span>`;
    button.addEventListener("click", () => {
      state.selectedCategory = category.id;
      updateCategorySelection();
    });
    elements.categoryGrid.append(button);
  });
  updateCategorySelection();
}

function updateCategorySelection() {
  elements.categoryGrid.querySelectorAll(".category-option").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.category === state.selectedCategory);
  });
}

function updateEntryType(type) {
  state.entryType = type;
  document.querySelectorAll(".type-option").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.type === type);
  });
  elements.categoryFieldset.hidden = type === "income";
}

function openEntrySheet() {
  state.entryType = "expense";
  state.selectedCategory = "food";
  elements.entryForm.reset();
  elements.dateInput.value = localDateKey();
  elements.amountInput.value = "";
  elements.noteInput.value = "";
  updateEntryType("expense");
  updateCategorySelection();
  elements.sheetLayer.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => elements.amountInput.focus());
}

function closeEntrySheet() {
  elements.sheetLayer.hidden = true;
  document.body.style.overflow = "";
  elements.addButton.focus();
}

function addTransaction(event) {
  event.preventDefault();
  const amount = Number.parseFloat(elements.amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    showToast("请输入正确的金额");
    elements.amountInput.focus();
    return;
  }

  const date = elements.dateInput.value || localDateKey();
  const transaction = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: state.entryType,
    amount: Math.round(amount * 100) / 100,
    category: state.entryType === "income" ? "income" : state.selectedCategory,
    note: elements.noteInput.value.trim(),
    date,
    createdAt: new Date().toISOString(),
  };

  state.transactions.push(transaction);
  saveTransactions();

  const transactionDate = parseLocalDate(date);
  state.viewingYear = transactionDate.getFullYear();
  state.viewingMonth = transactionDate.getMonth();
  closeEntrySheet();
  render();
  showToast("记账成功");
}

function deleteTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;
  const category = getCategory(transaction);
  if (!window.confirm(`删除“${transaction.note || category.name}”这笔记录吗？`)) return;
  state.transactions = state.transactions.filter((item) => item.id !== id);
  saveTransactions();
  render();
  showToast("已删除");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 1800);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  if (window.XiaoguoAndroid?.saveToDownloads) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
      window.XiaoguoAndroid.saveToDownloads(filename, type, base64);
    });
    reader.readAsDataURL(blob);
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportTransactionsCsv() {
  const header = ["日期", "类型", "分类", "金额", "备注", "原分类", "来源", "记录ID"];
  const rows = [...state.transactions]
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map((transaction) => {
      const category = getCategory(transaction);
      return [
        transaction.date,
        transaction.type === "income" ? "收入" : "支出",
        category.name,
        Number(transaction.amount).toFixed(2),
        transaction.note || "",
        transaction.sourceCategory || "",
        transaction.source || "",
        transaction.sourceId || transaction.id,
      ].map(csvCell).join(",");
    });
  const csv = `\uFEFF${[header.map(csvCell).join(","), ...rows].join("\r\n")}`;
  downloadFile(`小果管钱-全部账单-${localDateKey()}.csv`, csv, "text/csv;charset=utf-8");
  closeExportSheet();
  showToast(`已导出 ${state.transactions.length} 笔账目`);
}

function exportTransactionsJson() {
  downloadFile(
    `小果管钱-完整备份-${localDateKey()}.json`,
    JSON.stringify(state.transactions, null, 2),
    "application/octet-stream",
  );
  closeExportSheet();
  showToast(`已导出 ${state.transactions.length} 笔账目`);
}

function openExportSheet() {
  elements.exportLayer.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeExportSheet() {
  elements.exportLayer.hidden = true;
  document.body.style.overflow = "";
  elements.exportButton.focus();
}

function renderMonthPicker() {
  elements.monthPickerYear.textContent = String(state.pickerYear);
  elements.monthGrid.replaceChildren();
  const today = new Date();

  for (let month = 0; month < 12; month += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "month-choice";
    button.textContent = `${month + 1}月`;
    button.classList.toggle(
      "is-current",
      state.pickerYear === today.getFullYear() && month === today.getMonth(),
    );
    button.addEventListener("click", () => {
      state.viewingYear = state.pickerYear;
      state.viewingMonth = month;
      elements.searchInput.value = "";
      state.searchLimit = 60;
      closeMonthPickerSheet();
      render();
    });
    elements.monthGrid.append(button);
  }
}

function openMonthPickerSheet() {
  state.pickerYear = state.viewingYear;
  renderMonthPicker();
  elements.monthPickerLayer.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeMonthPickerSheet() {
  elements.monthPickerLayer.hidden = true;
  document.body.style.overflow = "";
  elements.currentMonth.focus();
}

function openStatsSheet() {
  renderCategoryStats();
  elements.statsLayer.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeStatsSheet() {
  elements.statsLayer.hidden = true;
  document.body.style.overflow = "";
  elements.statsButton.focus();
}

function mergeTransactions(importedTransactions) {
  if (!Array.isArray(importedTransactions)) {
    throw new Error("账单文件格式不正确");
  }

  const knownIds = new Set(state.transactions.map((transaction) => transaction.id));
  let importedCount = 0;

  importedTransactions.forEach((transaction) => {
    if (
      !transaction ||
      typeof transaction.id !== "string" ||
      !["expense", "income"].includes(transaction.type) ||
      !Number.isFinite(Number(transaction.amount)) ||
      Number(transaction.amount) <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
    ) {
      return;
    }
    if (knownIds.has(transaction.id)) return;

    state.transactions.push({
      ...transaction,
      amount: Math.round(Number(transaction.amount) * 100) / 100,
    });
    knownIds.add(transaction.id);
    importedCount += 1;
  });

  if (importedCount > 0) {
    saveTransactions();
    render();
  }
  return importedCount;
}

async function importBundledLedger({ notify = true } = {}) {
  try {
    const response = await fetch("./imports/shark-ledger.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const transactions = await response.json();
    const count = mergeTransactions(transactions);
    if (notify) {
      showToast(count > 0 ? `已导入 ${count} 笔账目` : "账单已经导入过了");
    }
    return count;
  } catch (error) {
    if (notify) showToast("导入失败，请稍后重试");
    console.error(error);
    return 0;
  }
}

function shiftMonth(offset) {
  const date = new Date(state.viewingYear, state.viewingMonth + offset, 1);
  state.viewingYear = date.getFullYear();
  state.viewingMonth = date.getMonth();
  render();
}

function seedDemoData() {
  if (state.transactions.length > 0) return;
  const today = new Date();
  const dateOnDay = (dayOffset) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset);
    return localDateKey(date);
  };
  const makeTimestamps = (index) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19 - index, 10).toISOString();

  state.transactions = [
    {
      id: "demo-1",
      type: "expense",
      amount: 32.8,
      category: "food",
      note: "午饭",
      date: dateOnDay(0),
      createdAt: makeTimestamps(0),
    },
    {
      id: "demo-2",
      type: "expense",
      amount: 16,
      category: "taxi",
      note: "打车回家",
      date: dateOnDay(0),
      createdAt: makeTimestamps(1),
    },
    {
      id: "demo-3",
      type: "expense",
      amount: 12.5,
      category: "snack",
      note: "水果和酸奶",
      date: dateOnDay(1),
      createdAt: makeTimestamps(2),
    },
    {
      id: "demo-4",
      type: "expense",
      amount: 68.9,
      category: "daily",
      note: "生活用品",
      date: dateOnDay(2),
      createdAt: makeTimestamps(3),
    },
    {
      id: "demo-5",
      type: "income",
      amount: 5000,
      category: "income",
      note: "本月工资",
      date: dateOnDay(5),
      createdAt: makeTimestamps(4),
    },
  ];
  saveTransactions();
}

elements.todayLabel.textContent = now.toLocaleDateString("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "long",
});
elements.dateInput.value = localDateKey();
renderCategoryOptions();

async function initialize() {
  applyCategoryMigrations();
  const parameters = new URLSearchParams(window.location.search);
  const isNativeAndroid = navigator.userAgent.includes("XiaoguoLedgerAndroid");
  const nativeImportDone = localStorage.getItem("xiaoguo-native-initial-import") === "1";

  if (isNativeAndroid && !nativeImportDone && state.transactions.length === 0) {
    await importBundledLedger({ notify: false });
    localStorage.setItem("xiaoguo-native-initial-import", "1");
  } else if (parameters.get("import") === "shark") {
    if (parameters.get("reset") === "1") {
      state.transactions = [];
      saveTransactions();
    }
    await importBundledLedger({ notify: false });
    window.history.replaceState({}, "", window.location.pathname);
  } else if (parameters.has("demo")) {
    seedDemoData();
  }
  render();
}

elements.addButton.addEventListener("click", openEntrySheet);
elements.exportButton.addEventListener("click", openExportSheet);
elements.closeSheet.addEventListener("click", closeEntrySheet);
elements.sheetBackdrop.addEventListener("click", closeEntrySheet);
elements.closeExport.addEventListener("click", closeExportSheet);
elements.exportBackdrop.addEventListener("click", closeExportSheet);
elements.importData.addEventListener("click", async () => {
  const count = await importBundledLedger();
  if (count > 0) closeExportSheet();
});
elements.exportCsv.addEventListener("click", exportTransactionsCsv);
elements.exportJson.addEventListener("click", exportTransactionsJson);
elements.monthPickerBackdrop.addEventListener("click", closeMonthPickerSheet);
elements.closeMonthPicker.addEventListener("click", closeMonthPickerSheet);
elements.previousPickerYear.addEventListener("click", () => {
  state.pickerYear -= 1;
  renderMonthPicker();
});
elements.nextPickerYear.addEventListener("click", () => {
  state.pickerYear += 1;
  renderMonthPicker();
});
elements.goCurrentMonth.addEventListener("click", () => {
  const today = new Date();
  state.viewingYear = today.getFullYear();
  state.viewingMonth = today.getMonth();
  state.pickerYear = today.getFullYear();
  elements.searchInput.value = "";
  state.searchLimit = 60;
  closeMonthPickerSheet();
  render();
});
elements.statsButton.addEventListener("click", openStatsSheet);
elements.statsBackdrop.addEventListener("click", closeStatsSheet);
elements.closeStats.addEventListener("click", closeStatsSheet);
elements.entryForm.addEventListener("submit", addTransaction);
elements.previousMonth.addEventListener("click", () => {
  elements.searchInput.value = "";
  state.searchLimit = 60;
  shiftMonth(-1);
});
elements.nextMonth.addEventListener("click", () => {
  elements.searchInput.value = "";
  state.searchLimit = 60;
  shiftMonth(1);
});
elements.currentMonth.addEventListener("click", openMonthPickerSheet);
elements.searchInput.addEventListener("input", () => {
  state.searchLimit = 60;
  render();
});
elements.clearSearch.addEventListener("click", () => {
  elements.searchInput.value = "";
  state.searchLimit = 60;
  render();
  elements.searchInput.focus();
});

document.querySelectorAll(".type-option").forEach((button) => {
  button.addEventListener("click", () => updateEntryType(button.dataset.type));
});

document.querySelectorAll(".stats-switch button").forEach((button) => {
  button.addEventListener("click", () => {
    state.statsRange = button.dataset.range;
    document.querySelectorAll(".stats-switch button").forEach((option) => {
      option.classList.toggle("is-active", option === button);
    });
    renderCategoryStats();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.sheetLayer.hidden) {
    closeEntrySheet();
  } else if (event.key === "Escape" && !elements.exportLayer.hidden) {
    closeExportSheet();
  } else if (event.key === "Escape" && !elements.monthPickerLayer.hidden) {
    closeMonthPickerSheet();
  } else if (event.key === "Escape" && !elements.statsLayer.hidden) {
    closeStatsSheet();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // The app remains fully usable if service workers are unavailable.
    });
  });
}

initialize();
