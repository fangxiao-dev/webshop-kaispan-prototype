/* ==========================================================================
   KaiSpan · HACCP 模块
   --------------------------------------------------------------------------
   独立于 app.js，在 app.js 之前以 defer 加载（顺序由 defer 保证）。
   对外暴露的入口：
     haccpHomePage()        HACCP 主页（统一视图，不分角色）
     haccpFillPage()        填表页（桌面端）
     haccpMyRecordsPage()   全部记录（可复核 / 作废）\n     haccpMonthlyPage()     月度表（打印 / CSV 导出）\n     haccpTemplateListPage() 店长：表单管理\n     haccpTemplateEditPage() 店长：列编辑器
     haccpBindAll()         事件绑定，由 app.js 的 bindGlobal() 调用
   依赖 app.js 的全局：currentLanguage() / slug() / state() / stores
   填写人从 employee.js 的员工档案取（haccpPeople），不再用 app.js 那个写死的 employees
   ========================================================================== */

/* ---------------------------------------------------------------- 存储层 --- */
/* file:// 下部分浏览器会禁用 localStorage，这里做内存兜底，功能在本次会话内仍可用 */
const HACCP_TPL_KEY = "kaispanHaccpTemplates";
const HACCP_ENTRY_KEY = "kaispanHaccpEntries";
const haccpMemory = {};

function haccpRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch (error) {
    if (haccpMemory[key] !== undefined) return haccpMemory[key];
  }
  if (haccpMemory[key] !== undefined) return haccpMemory[key];
  return fallback;
}

function haccpWrite(key, value) {
  haccpMemory[key] = value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* 内存兜底已写入，静默降级 */
  }
}

/* ------------------------------------------------------------ 语言与日期 --- */
/* 员工在自己的 app 里打开派给他的表时，这张表要说**他**的语言，
   跟界面外壳一致 —— 不然会出现外面是德语、里面那张表是中文的一页。
   跟 empDe() 用同一个判据（员工档案里的「沟通语言」）。（2026-09-04） */
function haccpDe() {
  const forced = typeof meForcedLang === "function" ? meForcedLang() : null;
  if (forced) return forced === "de";
  return typeof currentLanguage === "function" && currentLanguage() === "de";
}

/* 选项与状态的德语对照。
   放在这里而不是 app.js 的 deTranslations，是因为全局词典靠整页文本替换，
   加「鱼」这种单字词条会误伤其他句子（见 PROJECT_LOG 已知问题）。
   HACCP 内部自己查表，互不干扰。 */
const haccpTermDe = {
  "已完成": "Erledigt", "未完成": "Nicht erledigt", "不适用": "Nicht zutreffend",
  "无发现": "Kein Befund", "有痕迹": "Spuren gefunden", "发现活体": "Lebende Schädlinge",
  "热菜": "Warme Speisen", "冷菜 / 沙拉": "Kalte Speisen / Salate",
  "冷冻品": "Tiefkühlware", "肉与肉制品": "Fleisch und Fleischerzeugnisse", "鱼": "Fisch",
  "禽类 / 野味 / 绞肉": "Geflügel / Wild / Hackfleisch",
  "EU 绞肉（未开封）": "EU-Hackfleisch (ungeöffnet)",
  "其他（不测温）": "Sonstiges (ohne Messung)", "其他": "Sonstiges",
  "初次培训": "Erstschulung", "复训": "Folgeschulung",
  "R 清洁": "R Reinigung", "D 消毒": "D Desinfektion", "R+D 清洁并消毒": "R+D Reinigung und Desinfektion",
  "无污染": "Keine Verunreinigung", "包装完好": "Verpackung einwandfrei",
  "气味正常": "Geruch einwandfrei", "保质期有效": "MHD gültig",
  "运输车况正常": "Lieferfahrzeug in Ordnung", "司机情况正常": "Fahrer in Ordnung",
  "已记录": "Erfasst", "已确认": "Freigegeben", "已处理": "Erledigt", "有异常待处理": "Abweichung offen",
  "待复核": "Zur Freigabe",   /* 旧数据里可能还有 */
  "正常": "In Ordnung", "待修": "Reparatur nötig", "维修中": "In Reparatur", "已停用": "Außer Betrieb"
};

/* 取多语言显示文本：{zh, de, en} 或纯字符串。
   数字 / 布尔也要能过 —— 之前只处理 string 和对象，
   数值型的值会被当成对象取 .zh 拿到 undefined，结果整格空掉。 */
/* 所有渲染进 HTML 的文案都从这里出去，所以转义放在这里 —— 65 个调用点全部在
   模板串里（属性或文本节点），没有一处赋给 textContent，所以不会双重转义。
   需要原始值做比较或存储时用 haccpValueOf / haccpRaw。 */
function haccpText(value) {
  return haccpEsc(haccpRaw(value));
}

function haccpRaw(value) {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return haccpDe() ? (haccpTermDe[value] || value) : value;
  if (haccpDe()) {
    if (value.de) return value.de;
    if (value.zh && haccpTermDe[value.zh]) return haccpTermDe[value.zh];
  }
  return value.zh || value.en || "";
}

/* 存储值永远用中文原文，与 breachOn / limitBy 的键保持一致。
   显示走 haccpText()，两者分离，切德语不会让判定失配。 */
function haccpValueOf(option) {
  return typeof option === "string" ? option : (option.zh || option.en || "");
}

/* 把存下来的值按当时的列定义显示出来 */
function haccpDisplayValue(column, raw) {
  if (raw === "" || raw == null) return "—";
  if (Array.isArray(raw)) return `${raw.length}/${(column.items || []).length}`;
  if (column.type === "photo") return haccpDe() ? "Foto" : "已附照片";
  return haccpText(raw);
}

function haccpToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function haccpWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7;            // 周一 = 0
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function haccpWeekdayIndex(dateStr) {
  return (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;   // 周一 0 … 周日 6
}

function haccpFormatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const wdZh = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const wdDe = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const wd = (haccpDe() ? wdDe : wdZh)[haccpWeekdayIndex(dateStr)];
  /* 德语是 日.月.，不是月.日 —— 原来会把 8月31日 写成「8.31」，德国人读成 8 月 31 日之外的东西 */
  return haccpDe()
    ? `${d.getDate()}.${d.getMonth() + 1}. ${wd}`
    : `${d.getMonth() + 1}月${d.getDate()}日 ${wd}`;
}

/* 用户自由输入（表单名、列名、纠正措施、设备名、作废理由、参与人姓名…）全都要
   经过这里再进模板串。实测：把纠正措施写成 <img src=y onerror="..."> 会真的执行；
   表单名里写 <b> 会被当标签渲染。店长打一个「Martin's」或一对引号也会撑破属性。 */
function haccpEsc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* 不带星期的短日期：「8月31日」。标题和句子里塞「8月31日 周一」太碎。 */
function haccpShortDate(dateStr) {
  return haccpFormatDate(dateStr).split(" ")[0];
}

/* ISO 时间戳 → 「2026-08-31 18:04」。
   卫生局会问「这条是什么时候复核的」，光有复核人答不上来。 */
function haccpStamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}


/* ---------------------------------------------------------------- 时段 --- */
/* 员工脑子里不是「储存温度表、清洁表」，是「开店要做什么、收店要做什么」。
   给每张表标一个时段，主页把「现在该做的」排在最前面，省掉「在列表里找」这个动作。 */
const HACCP_SLOTS = [
  { id: "morning", zh: "开店前", de: "Vor Öffnung", to: 11 },
  { id: "day", zh: "营业中", de: "Im Betrieb", to: 17 },
  { id: "evening", zh: "收店", de: "Nach Schluss", to: 24 },
  { id: "any", zh: "随时", de: "jederzeit" }
];

function haccpSlot(id) {
  return HACCP_SLOTS.find(x => x.id === id) || HACCP_SLOTS[HACCP_SLOTS.length - 1];
}

function haccpCurrentSlot() {
  const h = new Date().getHours();
  return (HACCP_SLOTS.find(s => s.to != null && h < s.to) || haccpSlot("evening")).id;
}

/* -------------------------------------------------------------- 当前上下文 --- */
/* HACCP 不分店长/员工视图，所有人看同一个页面。
   这里只回答「谁在填」和「填哪家店」两个问题。 */
/* 2026-09-04（Mingrong：这个填写人是哪来的，和员工助手的人对起来了么）——
   答案原来是：没对起来。这个下拉一直读 app.js 顶上那句
   `const employees = ["Martin","Tom","Lisa","Anna","Kevin"]` ——
   最早期的写死数组，跟员工档案毫无关系，也不分门店。
   于是 Martin Biergarten 的表单上列着 Tom（Martin Cafe）和 Anna（Martin Biergarten 2），
   却没有真正在这家店上班的 James、Noah、Olivia、Sophia。
   签在卫生局记录上的名字是这么来的，这件事本身就是问题。

   现在从员工档案取这家店在册的人。员工模块没加载时才回落到那个老数组。 */
/* 员工是从自己的 app 点进这张表的，所以「取消」「提交完去哪」都得回到他那一侧。
   写死 #store-HACCP 管理 的话，他一提交就被扔进店长的整套界面出不来了。（2026-09-04） */
function haccpInMeShell() {
  if (typeof state !== "function") return false;
  const route = state().route || "";
  return route === "me" || route.startsWith("me-");
}

function haccpExitHash() {
  return haccpInMeShell() ? `me-${encodeURIComponent("班表")}` : slug("store", "HACCP 管理");
}

function haccpFillHash(qs) {
  const base = haccpInMeShell() ? `me-${encodeURIComponent("填表")}` : slug("store", "HACCP填写");
  return `${base}${qs ? `?${qs}` : ""}`;
}

function haccpPeople(store) {
  const shop = store || haccpCurrentStore();
  if (typeof empStaff === "function" && typeof empStatus === "function") {
    const list = empStaff(shop)
      .filter(e => !empStatus(e.status).leaving)
      .map(e => e.name)
      .filter(Boolean);
    if (list.length) return list;
  }
  return typeof employees !== "undefined" ? employees : ["Martin"];
}

/* 默认选中的人。店长自己在册就选他，否则选这家店的第一个人 ——
   不能再无条件写死 "Martin"：他不一定在这家店的名单里。 */
function haccpCurrentUser(store) {
  const list = haccpPeople(store);
  return list.includes("Martin") ? "Martin" : list[0];
}

const HACCP_STORE_KEY = "kaispanHaccpStore";

/* 月度签核：取代逐条复核。
   法规要的不是「店长在每一条上签字」，而是记录齐、异常有处理、有人负责。
   德国店实际的节奏也是月底整理一次资料，所以签核按月做一次，留下人和时间。 */
const HACCP_SIGNOFF_KEY = "kaispanHaccpSignoff";

function haccpSignoffs() {
  return haccpRead(HACCP_SIGNOFF_KEY, {}) || {};
}

function haccpSignoffKey(store, month) { return `${store}|${month}`; }

function haccpSignoff(store, month) {
  return haccpSignoffs()[haccpSignoffKey(store, month)] || null;
}

function haccpSetSignoff(store, month, on, note) {
  const all = haccpSignoffs();
  const key = haccpSignoffKey(store, month);
  if (on) all[key] = { by: haccpCurrentUser(), at: new Date().toISOString(), note: note || "" };
  else delete all[key];
  haccpWrite(HACCP_SIGNOFF_KEY, all);
  return all[key] || null;
}

function haccpStores() {
  return typeof stores !== "undefined" ? stores : ["Martin Biergarten"];
}

function haccpCurrentStore() {
  /* 员工在自己的 app 里打开派给他的那张表时，门店必须是**他的**门店，不是顶栏那个。
     顶栏是店长手上这台设备的选择；这条记录要落在填表那个人上班的店里。
     不这么判的话，Martin Biergarten 2 的 Anna 填的冷藏温度会存进 Martin Biergarten
     —— 一张签了名、日期、门店的卫生局记录，门店那一栏是错的。（2026-09-04） */
  if (typeof meEmp === "function" && typeof state === "function") {
    const route = state().route || "";
    if (route === "me" || route.startsWith("me-")) {
      const e = meEmp();
      if (e && haccpStores().includes(e.store)) return e.store;
    }
  }
  /* 门店范围跟全站顶栏走（app.js 的 currentStore）。HACCP 必须落在一家具体门店上，
     所以顶栏选「全部门店」时回落到第一家。 */
  if (typeof currentStore === "function") {
    const global = currentStore();
    if (global && haccpStores().includes(global)) return global;
    if (global === "") return haccpStores()[0];
  }
  const saved = haccpRead(HACCP_STORE_KEY, null);
  return haccpStores().includes(saved) ? saved : haccpStores()[0];
}

function haccpSetStore(store) {
  if (!haccpStores().includes(store)) return;
  if (typeof setCurrentStore === "function") setCurrentStore(store);
  haccpWrite(HACCP_STORE_KEY, store);
}

/* ============================================================ 预置模板 ===
   来源：kaispan UI/Haccp/ 下 7 份 PDF，列结构与临界值照原表录入。
   临界值可由店长在表单编辑器中修改（Mingrong 2026-08-31 决定）。
   limit 语义：
     min       低于此值 = 超标
     max       高于此值 = 超标
     tolerance 对 max 的短暂容许值，超过 max 但不超过 tolerance = 警告
     limitBy   限值随另一列的取值变化 { field, map }
   =========================================================================== */
function haccpSeedTemplates() {
  const store = "Martin Biergarten";
  /* 模板是全部门店共享的 —— 以前这里挂着 scope: [store] 和 retention: "3年"，
     但 haccpTemplates() 从不按 scope 过滤、也没有任何地方读 retention，
     留着只会让人以为系统在管分店和保存期。 */
  const common = { version: 1, status: "启用", createdAt: haccpToday() };

  return [
    /* ---------------------------------------------------- 1 储存/冷藏温度 --- */
    Object.assign({
      id: "storage-temp",
      timing: "morning",
      icon: { zh: "°C", de: "°C" },
      name: { zh: "储存 / 冷藏温度", de: "Lager- / Kühltemperaturen", en: "Storage / Cooling temperatures" },
      layout: "monthly-grid",
      frequency: { kind: "daily" },
      header: { operation: "Martin Biergarten GmbH", inspector: "Martin" },
      columns: [
        { id: "c1", label: { zh: "冷藏间", de: "Kühlraum" }, type: "temp", unit: "°C", limit: { min: 4, max: 7 }, note: { zh: "绞肉 / 禽类 max +4°C，鱼 max +2°C", de: "Hackfleisch/Geflügel max. +4 °C, Fisch max. +2 °C" } },
        { id: "c2", label: { zh: "冷藏柜 1", de: "Kühltheke 1" }, type: "temp", unit: "°C", limit: { min: 4, max: 7 } },
        { id: "c3", label: { zh: "冷藏柜 2", de: "Kühltheke 2" }, type: "temp", unit: "°C", limit: { min: 4, max: 7 } },
        { id: "c4", label: { zh: "冷藏 1", de: "Kühlschrank 1" }, type: "temp", unit: "°C", limit: { min: 4, max: 7 } },
        { id: "c5", label: { zh: "冷藏 2", de: "Kühlschrank 2" }, type: "temp", unit: "°C", limit: { min: 4, max: 7 } }
      ],
      footnotes: [
        { zh: "临界值：冷冻 / 冷冻间 −18 °C（短暂 −15 °C）；冷藏 +4 ~ +7 °C；绞肉 / 禽类 max +4 °C；鱼 max +2 °C；EU 绞肉未开封 +2 °C；冰淇淋柜（售卖）−10 °C。", de: "Grenzwerte: Tiefkühler/Tiefkühlraum −18 °C (kurzzeitig −15 °C); Kühlschrank +4 bis +7 °C; Hackfleisch/Geflügel max. +4 °C; Fisch max. +2 °C; Hackfleisch aus EU-Betrieben, ungeöffnet +2 °C; Eistheke zur Ausgabe −10 °C." },
        { zh: "纠正措施：出现感官变化时移出并可能废弃货物，通知负责人；修正冷藏温度或向专业公司报修。", de: "Korrekturmaßnahme: Bei sensorischen Veränderungen Ware entfernen und ggf. entsorgen, verantwortliche Person informieren. Kühltemperatur korrigieren oder Reparaturauftrag an eine Fachfirma erteilen." }
      ]
    }, common),

    /* -------------------------------------------------------- 2 清洁与消毒 --- */
    Object.assign({
      id: "cleaning",
      timing: "evening",
      icon: { zh: "洁", de: "RD" },
      name: { zh: "清洁与消毒", de: "Reinigung und Desinfektion", en: "Cleaning and Disinfection" },
      layout: "monthly-grid",
      frequency: { kind: "daily" },
      header: { operation: "Martin Biergarten GmbH", inspector: "Martin" },
      settings: [
        { id: "s1", label: { zh: "使用的商用清洁剂（R）", de: "Reinigungsmittel (R)" }, value: "" },
        { id: "s2", label: { zh: "使用的商用消毒剂（D）", de: "Desinfektionsmittel (D)" }, value: "" }
      ],
      columns: [
        { id: "c0", label: { zh: "执行人", de: "Wer" }, type: "person" },
        { id: "c1", label: { zh: "方式 R / D", de: "R / D" }, type: "choice", options: [{ zh: "R 清洁" }, { zh: "D 消毒" }, { zh: "R+D 清洁并消毒" }] },
        { id: "c2", label: { zh: "销售区 / 柜台", de: "Verkaufsraum / Theke" }, type: "choice", options: [{ zh: "已完成" }, { zh: "未完成" }, { zh: "不适用" }], breachOn: ["未完成"] },
        { id: "c3", label: { zh: "备餐区 / 厨房", de: "Vorbereitung / Küche" }, type: "choice", options: [{ zh: "已完成" }, { zh: "未完成" }, { zh: "不适用" }], breachOn: ["未完成"] },
        { id: "c4", label: { zh: "仓库", de: "Lager" }, type: "choice", options: [{ zh: "已完成" }, { zh: "未完成" }, { zh: "不适用" }], breachOn: ["未完成"] },
        { id: "c5", label: { zh: "设备 / 区域", de: "Geräte / Bereiche" }, type: "choice", options: [{ zh: "已完成" }, { zh: "未完成" }, { zh: "不适用" }], breachOn: ["未完成"] },
        { id: "c6", label: { zh: "厕所", de: "Toiletten" }, type: "choice", options: [{ zh: "已完成" }, { zh: "未完成" }, { zh: "不适用" }], breachOn: ["未完成"] }
      ],
      footnotes: [{ zh: "清洁 / 消毒不充分时，必须补做清洁或消毒。R = Reinigung 清洁，D = Desinfektion 消毒。", de: "Bei unzureichender Reinigung/Desinfektion ist eine nachfolgende Reinigung/Desinfektion erforderlich. R = Reinigung, D = Desinfektion." }]
    }, common),

    /* ---------------------------------------------------------- 3 加热温度 --- */
    Object.assign({
      id: "heating-temp",
      timing: "day",
      icon: { zh: "热", de: "KT" },
      name: { zh: "加热温度", de: "Erhitzungstemperatur", en: "Heating Temperature" },
      layout: "log",
      frequency: { kind: "weekly", times: 2 },
      header: { operation: "Martin Biergarten GmbH", inspector: "Martin" },
      columns: [
        { id: "c1", label: { zh: "产品", de: "Produkt" }, type: "text", placeholder: { zh: "例如：红烧肉 / Gulasch", de: "z. B. Gulasch" } },
        { id: "c2", label: { zh: "实测核心温度", de: "Gemessene Kerntemperatur" }, type: "temp", unit: "°C", limit: { min: 70 }, note: { zh: "适当作用时间后测量，例如 70 °C 保持 10 分钟", de: "Messung nach angemessener Einwirkzeit, z. B. 70 °C für 10 min" } }
      ],
      footnotes: [
        { zh: "临界值（烹饪完成时检查）：切开样品观察外观；测量核心温度，例如 70 °C 保持 10 分钟。", de: "Kritischer Grenzwert (Prüfung bei Garende): Anschnitt einer Probe – Aussehen; Prüfung der Kerntemperatur (Messung nach angemessener Einwirkzeit, z. B. 70 °C für 10 min)." },
        { zh: "纠正措施：重新加热（reheating）。", de: "Korrekturmaßnahme: Nacherhitzen." }
      ]
    }, common),

    /* ---------------------------------------------------------- 4 出餐温度 --- */
    Object.assign({
      id: "output-temp",
      timing: "day",
      icon: { zh: "出", de: "AT" },
      name: { zh: "出餐温度", de: "Ausgabetemperatur", en: "Output Temperature" },
      layout: "log",
      frequency: { kind: "weekly", times: 2 },
      header: { operation: "Martin Biergarten GmbH", inspector: "Martin" },
      columns: [
        { id: "c1", label: { zh: "菜品类型", de: "Art der Speise" }, type: "choice", options: [{ zh: "热菜" }, { zh: "冷菜 / 沙拉" }] },
        { id: "c2", label: { zh: "产品 / 菜品", de: "Produkt / Speise" }, type: "text", placeholder: { zh: "例如：牛肉汤 / Kartoffelsalat", de: "z. B. Kartoffelsalat" } },
        {
          id: "c3", label: { zh: "出餐温度", de: "Ausgabetemperatur" }, type: "temp", unit: "°C",
          limitBy: { field: "c1", map: { "热菜": { min: 65 }, "冷菜 / 沙拉": { max: 7 } } },
          note: { zh: "热菜 ≥ 65 °C；冷菜与沙拉 max 7 °C", de: "Warme Speisen ≥ 65 °C; kalte Speisen und Salate max. 7 °C" }
        }
      ],
      footnotes: [{ zh: "临界值：热菜至少 65 °C；冷菜与沙拉最高 7 °C。", de: "Kritischer Grenzwert: Warme Speisen mindestens 65 °C; kalte Speisen und Salate max. 7 °C." }]
    }, common),

    /* ---------------------------------------------------------- 5 入库验收 --- */
    Object.assign({
      id: "incoming-goods",
      timing: "day",
      icon: { zh: "验", de: "WE" },
      name: { zh: "入库验收", de: "Wareneingangskontrolle", en: "Incoming Goods Inspection" },
      layout: "log",
      frequency: { kind: "weekly", times: 2 },
      header: { operation: "Martin Biergarten GmbH", inspector: "Martin" },
      columns: [
        /* 供应商读全站主数据（app.js 的 suppliers），仓库模块加了新供应商这里自动跟上，
           不再各存一份 —— 两处名单对不上是迟早的事 */
        { id: "c1", label: { zh: "供应商", de: "Lieferant" }, type: "choice",
          options: (typeof suppliers !== "undefined" ? suppliers : []).map(n => ({ zh: n })).concat([{ zh: "其他" }]) },
        { id: "c2", label: { zh: "商品类别", de: "Warengruppe" }, type: "choice", options: [{ zh: "冷冻品" }, { zh: "肉与肉制品" }, { zh: "鱼" }, { zh: "禽类 / 野味 / 绞肉" }, { zh: "EU 绞肉（未开封）" }, { zh: "其他（不测温）" }] },
        {
          id: "c3", label: { zh: "实测温度", de: "Gemessene Temperatur" }, type: "temp", unit: "°C", optional: true,
          limitBy: {
            field: "c2",
            map: {
              "冷冻品": { max: -18, tolerance: -15 },
              "肉与肉制品": { max: 4 },
              "鱼": { max: 2 },
              "禽类 / 野味 / 绞肉": { max: 4 },
              "EU 绞肉（未开封）": { max: 2 }
            }
          }
        },
        {
          id: "c4", label: { zh: "感官检查", de: "Sensorik" }, type: "checklist",
          items: [{ zh: "无污染" }, { zh: "包装完好" }, { zh: "气味正常" }, { zh: "保质期有效" }, { zh: "运输车况正常" }, { zh: "司机情况正常" }],
          requireAll: true
        },
        { id: "c5", label: { zh: "发现的问题", de: "Festgestellte Mängel" }, type: "text", optional: true, multiline: true, placeholder: { zh: "无问题可留空", de: "Leer lassen, wenn keine Mängel" } }
      ],
      footnotes: [
        { zh: "临界值 — 温度：冷冻品 −18 °C（短暂 −15 °C）；肉与肉制品 +4 °C；鱼 +2 °C；禽类 / 野味 / 绞肉 +4 °C；EU 来源绞肉未开封 +2 °C。", de: "Kritische Grenzwerte – Temperaturen: Tiefkühlware −18 °C (kurzzeitig −15 °C); Fleisch/Fleischerzeugnisse +4 °C; Fisch +2 °C; Geflügel/Wild/Hackfleisch +4 °C; Hackfleisch aus EU-Betrieben, ungeöffnet +2 °C." },
        { zh: "临界值 — 感官：无污染、包装完好、气味正常、保质期有效、运输车辆状况与司机情况正常。", de: "Kritische Grenzwerte – Sensorik: keine Verunreinigung, Verpackung einwandfrei, Geruch einwandfrei, gültiges Mindesthaltbarkeitsdatum, Zustand des Lieferfahrzeugs und des Fahrers." },
        { zh: "纠正措施：退货（Return of goods）。", de: "Korrekturmaßnahme: Rückgabe der Ware." }
      ]
    }, common),

    /* ---------------------------------------------------------- 6 害虫防治 --- */
    Object.assign({
      id: "pest-control",
      timing: "any",
      icon: { zh: "虫", de: "SB" },
      name: { zh: "害虫防治", de: "Schädlingsbekämpfung", en: "Pest Control" },
      layout: "log",
      frequency: { kind: "weekly", times: 1 },
      header: { operation: "Martin Biergarten GmbH", inspector: "Martin" },
      settings: [
        { id: "s1", label: { zh: "专业防治公司 · 名称", de: "Fachfirma · Name" }, value: "" },
        { id: "s2", label: { zh: "专业防治公司 · 地址 / 电话", de: "Fachfirma · Adresse / Tel." }, value: "" }
      ],
      columns: [
        { id: "c1", label: { zh: "备餐区 / 厨房", de: "Vorbereitung / Küche" }, type: "choice", options: [{ zh: "无发现" }, { zh: "有痕迹" }, { zh: "发现活体" }], breachOn: ["有痕迹", "发现活体"] },
        { id: "c2", label: { zh: "冷藏储存", de: "Kühllagerung" }, type: "choice", options: [{ zh: "无发现" }, { zh: "有痕迹" }, { zh: "发现活体" }], breachOn: ["有痕迹", "发现活体"] },
        { id: "c3", label: { zh: "仓库", de: "Lager" }, type: "choice", options: [{ zh: "无发现" }, { zh: "有痕迹" }, { zh: "发现活体" }], breachOn: ["有痕迹", "发现活体"] },
        { id: "c4", label: { zh: "销售区", de: "Verkaufsraum" }, type: "choice", options: [{ zh: "无发现" }, { zh: "有痕迹" }, { zh: "发现活体" }], breachOn: ["有痕迹", "发现活体"] }
      ],
      footnotes: [{ zh: "每周检查是否有老鼠、大鼠、蟑螂、蚂蚁、苍蝇侵扰。发现粪便 / 其他痕迹或活体害虫：通知负责人，并委托专业公司处理（需登记地址与电话）。", de: "Wöchentliche Kontrolle auf Befall durch Mäuse, Ratten, Schaben, Ameisen, Fliegen. Bei Kot/anderen Spuren oder lebenden Schädlingen: verantwortliche Person informieren und eine Fachfirma beauftragen (Adresse/Tel. hinterlegen)." }]
    }, common),

    /* ---------------------------------------------------------- 7 员工培训 --- */
    Object.assign({
      id: "staff-training",
      timing: "any",
      icon: { zh: "培", de: "MS" },
      name: { zh: "员工培训", de: "Mitarbeiterschulung", en: "Staff Training" },
      layout: "training",
      frequency: { kind: "yearly", times: 1 },
      header: { operation: "Martin Biergarten GmbH", referent: "", topic: "" },
      columns: [
        { id: "c1", label: { zh: "参与人", de: "Teilnehmer" }, type: "person" },
        { id: "c2", label: { zh: "培训类型", de: "Schulungsart" }, type: "choice", options: [{ zh: "初次培训" }, { zh: "复训" }] },
        { id: "c3", label: { zh: "签名", de: "Unterschrift" }, type: "signature" }
      ],
      footnotes: [{ zh: "至少每年一次。表头需填写讲师（Referent）与培训主题（Training topic）。", de: "Mindestens einmal jährlich. Im Kopf sind Referent und Schulungsthema anzugeben." }]
    }, common)
  ];
}

/* -------------------------------------------------------------- 模板读写 --- */
/* 存的是「模板版本列表」：同一个 id 可以有多条，version 递增。
   历史记录按 (id, version) 锁定，改版后旧记录仍按当时的表结构显示。 */
function haccpAllVersions() {
  let list = haccpRead(HACCP_TPL_KEY, null);
  if (!Array.isArray(list) || !list.length) {
    list = haccpSeedTemplates();
    haccpWrite(HACCP_TPL_KEY, list);
  }
  return list;
}

/* 每个 id 的最新版本 */
function haccpTemplates(includeDisabled) {
  const latest = {};
  haccpAllVersions().forEach(t => {
    if (!latest[t.id] || t.version > latest[t.id].version) latest[t.id] = t;
  });
  return Object.values(latest).filter(t => includeDisabled || t.status === "启用");
}

function haccpTemplate(id) {
  return haccpTemplates(true).find(t => t.id === id) || null;
}

/* 按版本取，用于渲染历史记录 */
function haccpTemplateAt(id, version) {
  return haccpAllVersions().find(t => t.id === id && t.version === version)
      || haccpTemplate(id);
}

/* -------------------------------------------------------------- 记录读写 --- */
function haccpEntries() {
  const list = haccpRead(HACCP_ENTRY_KEY, null);
  return Array.isArray(list) ? list : [];
}

function haccpSaveEntry(entry) {
  const list = haccpEntries();
  const index = list.findIndex(e => e.id === entry.id);
  if (index >= 0) list[index] = entry; else list.push(entry);
  haccpWrite(HACCP_ENTRY_KEY, list);
  return entry;
}

function haccpEntriesFor(templateId, store, date) {
  return haccpEntries().filter(e =>
    !e.voided &&
    e.templateId === templateId &&
    (!store || e.store === store) &&
    (!date || e.date === date));
}

function haccpEntriesInWeek(templateId, store, dateStr) {
  const week = haccpWeekKey(dateStr);
  return haccpEntries().filter(e =>
    !e.voided && e.templateId === templateId && e.store === store && haccpWeekKey(e.date) === week);
}

/* ======================================================== 临界值判定 ======= */
/* 返回 { level: "ok" | "warn" | "breach" | "empty", message } */
function haccpResolveLimit(column, values) {
  if (column.limitBy) {
    const driver = values ? values[column.limitBy.field] : null;
    return (driver && column.limitBy.map[driver]) || null;
  }
  return column.limit || null;
}

function haccpCheck(column, value, values) {
  const empty = value === "" || value == null ||
    (Array.isArray(value) && !value.length);
  if (empty) return { level: column.optional ? "ok" : "empty", message: "" };

  if (column.type === "temp") {
    const num = Number(value);
    if (Number.isNaN(num)) return { level: "empty", message: "" };
    const limit = haccpResolveLimit(column, values);
    if (!limit) return { level: "ok", message: "" };
    if (limit.max != null && num > limit.max) {
      if (limit.tolerance != null && num <= limit.tolerance) {
        return { level: "warn", message: haccpDe() ? `Über ${limit.max} °C, kurzzeitig bis ${limit.tolerance} °C zulässig` : `高于 ${limit.max} °C，短暂容许至 ${limit.tolerance} °C` };
      }
      return { level: "breach", message: haccpDe() ? `Grenzwert überschritten (max ${limit.max} °C)` : `超出临界值（上限 ${limit.max} °C）` };
    }
    if (limit.min != null && num < limit.min) {
      return { level: "breach", message: haccpDe() ? `Grenzwert unterschritten (min ${limit.min} °C)` : `低于临界值（下限 ${limit.min} °C）` };
    }
    return { level: "ok", message: "" };
  }

  if (column.type === "choice" && column.breachOn && column.breachOn.includes(value)) {
    return { level: "breach", message: haccpDe() ? "Abweichung festgestellt" : "发现异常" };
  }

  if (column.type === "checklist" && column.requireAll) {
    const checked = Array.isArray(value) ? value.length : 0;
    if (checked < column.items.length) {
      return { level: "breach", message: haccpDe() ? `${column.items.length - checked} Punkt(e) nicht bestätigt` : `还有 ${column.items.length - checked} 项未确认` };
    }
  }

  return { level: "ok", message: "" };
}

/* 整行判定 */
function haccpCheckRow(template, values) {
  const breaches = [];

  const missing = [];
  template.columns.forEach(column => {
    const result = haccpCheck(column, values[column.id], values);
    if (result.level === "breach") breaches.push(column.id);
    if (result.level === "empty") missing.push(column.id);
  });
  return { breaches, missing, hasBreach: breaches.length > 0 };
}

/* ============================================================ 排程计算 ===== */
/* 返回今天该填哪些表，以及各自完成情况 */
function haccpSchedule(store, date) {
  return haccpTemplates().map(template => {
    const frequency = template.frequency || { kind: "daily" };

    if (frequency.kind === "daily") {
      const done = haccpEntriesFor(template.id, store, date).length;
      return { template, kind: "daily", done, target: 1, due: done < 1 };
    }

    if (frequency.kind === "weekly") {
      const target = frequency.times || 1;
      const done = haccpEntriesInWeek(template.id, store, date).length;
      /* 「每周随机 1–2 次」不生成每日待办：周四（index 3）起才提醒 */
      const nagging = haccpWeekdayIndex(date) >= 3;
      return {
        template, kind: "weekly", done, target,
        due: done < target && nagging
      };
    }

    /* yearly：本年度没做的，过了 3 月进「计划内」，过了 10 月才真正催 */
    const year = date.slice(0, 4);
    const month = Number(date.slice(5, 7));
    const target = frequency.times || 1;
    const done = haccpEntries().filter(e =>
      !e.voided && e.templateId === template.id && e.store === store && e.date.startsWith(year)).length;
    const open = done < target;
    return {
      template, kind: "yearly", done, target,
      due: open && month >= 10
    };
  });
}

/* 全站共用的 HACCP 汇总。app.js 的门店助手主页、门店待办、首页待办都读它，
   避免再出现「HACCP 说填完了、别的页面还显示 82%」这种自相矛盾。 */
function haccpSummary(store, date) {
  store = store || haccpCurrentStore();
  date = date || haccpToday();
  const schedule = haccpSchedule(store, date);
  const daily = schedule.filter(s => s.kind === "daily");
  const dailyDone = daily.filter(s => s.done > 0).length;
  const due = schedule.filter(s => s.due);
  const entries = haccpEntries().filter(e => e.store === store && !e.voided);
  /* 只返回真的有人读的三样：
       due       主页「今天要填」、填表页「提交并填下一张」、首页待办、门店卡片
       percent   门店卡片的「今日完成度」
       breaches  首页待办、门店卡片的「N 项异常待处理」
     以前还返回 schedule / planned / done / dailyTotal / dailyDone / pending /
     templateCount / entryCount 共 8 个字段，全站零读取 —— 每个都要算一遍，
     还让人以为「这里有现成的数可以拿」。 */
  return {
    due,
    percent: daily.length ? Math.round((dailyDone / daily.length) * 100) : 100,
    breaches: entries.filter(e => e.hasBreach && e.status !== "已确认" && e.status !== "已处理")
  };
}


/* 某张表最近一次记录（可指定截止日期之前） */
function haccpLastEntry(templateId, store, beforeDate) {
  return haccpEntries()
    .filter(e => !e.voided && e.templateId === templateId && e.store === store && (!beforeDate || e.date < beforeDate))
    .sort((a, b) => (b.date + (b.filledAt || "")).localeCompare(a.date + (a.filledAt || "")))[0] || null;
}

function haccpShiftDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 图标用简短缩写。德语界面下用德语缩写（WE = Wareneingang 等），
   汉字图标在德语界面里说不通。自定义表单退回取名称首字。 */
function haccpTemplateIcon(template) {
  const icon = haccpText(template.icon);
  return icon || (haccpText(template.name) || "?").trim().charAt(0) || "?";
}

/* ================================================================ 页面 ===== */

/* -------------------------------------------------------------- 主页 ------ */
/* 排序原则：出事了 > 今天要做 > 本周内 > 已完成。
   之前异常区在页面最底下 —— 最急的事在最下面，这是错的。 */

/* 异常按「设备 / 测量点」聚合，不按记录逐条列。
   冷藏柜 2 连续三天 8.6°C 是一个问题（这台冰箱坏了），不是三件事。
   聚合之后能直接连到设备详情：那里有趋势图和维修单。 */
function haccpIssueGroups(store) {
  const open = haccpEntries().filter(e =>
    !e.voided && e.store === store && e.hasBreach &&
    e.status !== "已确认" && e.status !== "已处理");
  const map = {};
  open.forEach(entry => {
    const template = haccpTemplateAt(entry.templateId, entry.templateVersion);
    (entry.breaches || []).forEach(columnId => {
      const key = `${entry.templateId}|${columnId}`;
      if (!map[key]) {
        map[key] = {
          templateId: entry.templateId, columnId, template,
          column: (template.columns || []).find(c => c.id === columnId) || null,
          entries: []
        };
      }
      map[key].entries.push({ date: entry.date, value: entry.values[columnId] });
    });
  });
  const devices = haccpDevices(store);
  return Object.values(map).map(group => {
    group.entries.sort((a, b) => a.date.localeCompare(b.date));
    group.device = devices.find(d => d.link
      && d.link.templateId === group.templateId && d.link.columnId === group.columnId) || null;
    return group;
  }).sort((a, b) => b.entries.length - a.entries.length);
}

function haccpAttentionSection(store) {
  const de = haccpDe();
  const groups = haccpIssueGroups(store);
  /* 旧数据里残留的「待复核」：新模型下不再产生，但存量得有地方结清 */
  const pending = haccpEntries().filter(e => !e.voided && e.store === store && e.status === "待复核");
  if (!groups.length && !pending.length) return "";

  return `
    <section class="hc-attention">
      <div class="hc-attention-head">
        <h2>${de ? "Zu erledigen" : "需要处理"}</h2>
        <em>${groups.length + (pending.length ? 1 : 0)}</em>
      </div>

      ${groups.map(group => {
        const last = group.entries[group.entries.length - 1];
        const first = group.entries[0];
        const name = group.device ? haccpText(group.device.name) : (group.column ? haccpText(group.column.label) : group.columnId);
        const unit = group.column && group.column.type === "temp" ? (group.column.unit || "") : "";
        const repeated = group.entries.length > 1;
        return `
          <div class="hc-issue">
            <span class="hc-tpl-icon is-crit">${haccpTemplateIcon(group.template)}</span>
            <div class="hc-issue-main">
              <strong>${name}${repeated ? `<span class="hc-issue-streak">${de ? `${group.entries.length} Tage in Folge` : `连续 ${group.entries.length} 天`}</span>` : ""}</strong>
              <span>${haccpText(group.template.name)} · ${de ? "seit" : "最早"} ${first.date}${repeated ? ` · ${de ? "zuletzt" : "最近"} ${last.date}` : ""}</span>
            </div>
            <div class="hc-issue-val">
              <b>${last.value}${unit}</b>
              <span>${group.column && group.column.limit && group.column.limit.max != null
                ? (de ? `Grenzwert ${group.column.limit.max}${unit}` : `临界值 ${group.column.limit.max}${unit}`) : ""}</span>
            </div>
            <div class="hc-issue-act">
              ${group.device
                ? `<a class="primary-btn" href="#${slug("store", "HACCP设备详情")}?id=${encodeURIComponent(group.device.id)}">${de ? "Gerät ansehen" : "看这台设备"}</a>`
                : `<a class="primary-btn" href="#${slug("store", "HACCP记录")}?filter=open">${de ? "Bearbeiten" : "去处理"}</a>`}
            </div>
          </div>`;
      }).join("")}

      ${pending.length ? `
        <a class="hc-issue is-soft" href="#${slug("store", "HACCP记录")}?filter=open">
          <span class="hc-tpl-icon">✓</span>
          <div class="hc-issue-main">
            <strong>${de ? `${pending.length} Altbestand zur Freigabe` : `${pending.length} 条旧记录还挂着「待复核」`}</strong>
            <span>${de ? "Aus der alten Freigabe-Logik. Einmal abschließen, dann kommt nichts mehr nach."
                       : "来自旧的逐条复核逻辑。结清一次就不会再有了 —— 现在正常记录填完即归档。"}</span>
          </div>
          <span class="hc-issue-go">›</span>
        </a>` : ""}
    </section>`;
}


/* 「上次填写」这一格：日期 + 填写人 + 上次的实测温度。
   量冰箱时「昨天 4°C」是最有用的参照 —— 设备快坏时温度是缓慢爬升的，只看日期看不出来。
   总表和任务行共用同一段，免得两处各写一份、日后改一处漏一处。 */
/* maxVals 兼当宽度开关：
     0（任务行，横向宽）→ 完整日期 + 最多 6 个读数
     5（总表那一列，窄）→ 省掉年份，最多 5 个读数 */
function haccpLastCellHtml(template, store, maxVals) {
  const de = haccpDe();
  const last = haccpLastEntry(template.id, store);
  if (!last) return `<span class="muted">${de ? "noch kein Eintrag" : "还没有记录"}</span>`;
  const lastTpl = haccpTemplateAt(last.templateId, last.templateVersion);
  const nums = (lastTpl.columns || []).filter(c => c.type === "temp")
    .map(c => {
      const v = last.values[c.id];
      if (v === "" || v == null) return null;
      const bad = (last.breaches || []).includes(c.id);
      return `<span class="hc-lastval ${bad ? "is-bad" : ""}" title="${haccpText(c.label)}">${v}${c.unit || ""}</span>`;
    }).filter(Boolean).slice(0, maxVals || 6).join("");
  const when = maxVals ? last.date.slice(5) : last.date;
  return `${when} · ${haccpEsc(last.filledBy)}${last.hasBreach ? ` · <b class="is-crit">${de ? "Abweichung" : "有异常"}</b>` : ""}
    ${nums ? `<span class="hc-lastvals">${nums}</span>` : ""}`;
}

/* ------------------------------------------------------- 最近 7 天回顾 --- */
/* 7 张表全部显示。第一版只画每日表，理由是「周表在 7 格里大半是空的，像漏填」——
   那是呈现问题不是数据问题：正确做法是区分「未填」和「当天本来就不用填」。
   而且周表整周一次没做，恰恰是最该知道的事。
   三种行为：
     每日  每格都该有 → 空 = ○ 未填（可点补填）
     每周  够次数就行 → 没填的日子 = ·（不适用），行尾给「本周 n/m」
     每年  同上，行尾给「2026 年 n/m」
   状态用形状 + 颜色双重编码，不靠颜色单独承担。 */
function haccpRecapSection(store, date) {
  const today = haccpToday();
  const de = haccpDe();
  const templates = haccpTemplates();
  if (!templates.length) return "";
  const days = Array.from({ length: 7 }, (_, i) => haccpShiftDate(date, -(6 - i)));
  const year = date.slice(0, 4);
  const isToday = date === today;
  const thisWeek = haccpWeekKey(date) === haccpWeekKey(today);
  const thisYear = year === today.slice(0, 4);
  const schedule = haccpSchedule(store, date);
  const sched = id => schedule.find(s => s.template.id === id) || {};

  const rowOf = template => {
    const kind = (template.frequency || {}).kind || "daily";
    const born = template.createdAt || "";
    const cells = days.map(day => {
      if (born && day < born) {
        return { s: "na", title: de ? "Formular existierte noch nicht" : "当时还没有这张表" };
      }
      const es = haccpEntriesFor(template.id, store, day);
      if (es.length) {
        const bad = es.some(e => e.hasBreach);
        return { s: bad ? "bad" : "ok", day,
          title: `${day} ${bad ? (de ? "Abweichung" : "有异常") : (de ? "im Grenzwert" : "正常")}` };
      }
      /* 只有每日表的空格才算「未填」；周表/年表当天本来就不一定要填 */
      return kind === "daily"
        ? { s: "miss", day, title: `${day} ${de ? "nicht erfasst — nachtragen" : "未填 — 点击补填"}` }
        : { s: "off", day, title: `${day} ${de ? "an diesem Tag nicht erforderlich" : "当天不需要填"}` };
    });

    /* 「进度 / 期限」这一格：每张表的期限本来就不一样，写在行里比写在分组标题上准。
       语气分三档：达标=绿；真的落后（周四之后还没做完 / 年度表过了 10 月）=橙；
       只是还没轮到=中性灰。周二显示「本周 0/2」就喊未达标是虚报。 */
    const item = sched(template.id);
    const done = item.done || 0;
    const target = item.target || 1;
    const short = Math.max(0, target - done);
    /* 翻看历史日期时说的是那一天、那一周 —— 「周日前」对已经过去的一周毫无意义 */
    let state;
    if (kind === "daily") {
      state = done > 0
        ? { text: isToday ? (de ? "heute erfasst" : "今天已填") : (de ? "erfasst" : "这天已填"), tone: "ok" }
        : { text: isToday ? (de ? "heute offen" : "今天还没填") : (de ? "nicht erfasst" : "这天没填"), tone: "due" };
    } else if (kind === "weekly") {
      state = short === 0
        ? { text: de ? `${thisWeek ? "diese Woche" : "Woche"} ${done}/${target}` : `${thisWeek ? "本周" : "那周"} ${done}/${target}`, tone: "ok" }
        /* 「还剩 N 天」对每张周表都一样，逐行重复是噪音 —— 放到表头说一次 */
        : thisWeek
          ? { text: de ? `noch ${short}× · bis So.` : `还差 ${short} 次 · 周日前`, tone: item.due ? "due" : "idle" }
          : { text: de ? `Woche ${done}/${target}` : `那周 ${done}/${target}`, tone: "due" };
    } else {
      state = short === 0
        ? { text: de ? `${year} ${done}/${target}` : `${year} 年 ${done}/${target}`, tone: "ok" }
        : thisYear
          ? { text: de ? `noch ${short}× · bis 31.12.` : `还差 ${short} 次 · 12/31 前`, tone: item.due ? "due" : "idle" }
          : { text: de ? `${year} ${done}/${target}` : `${year} 年 ${done}/${target}`, tone: "due" };
    }
    return { template, cells, kind, state };
  };

  const rows = templates.map(rowOf);
  /* 药丸只说这张矩阵自己的结论 —— 每行的进度已经由行尾那一格负责，不再重复 */
  const missCount = rows.reduce((n, r) => n + r.cells.filter(c => c.s === "miss").length, 0);
  const badCount = rows.reduce((n, r) => n + r.cells.filter(c => c.s === "bad").length, 0);

  const cellHtml = (row, c) => c.s === "miss"
    ? `<a class="hc-cell is-miss" href="#${slug("store", "HACCP填写")}?t=${encodeURIComponent(row.template.id)}&d=${c.day}" title="${c.title}">○</a>`
    /* is-na（那天这张表还不存在）留白 —— 画成「·」会和图例里的「当天不需填」冲突，
       而每日表的「·」看着更像是在说「今天不用填」，正好说反了。 */
    : `<span class="hc-cell is-${c.s}" title="${c.title}">${c.s === "ok" ? "●" : c.s === "bad" ? "▲" : c.s === "off" ? "·" : ""}</span>`;

  return `
    <section class="hc-recap">
      <div class="hc-recap-head">
        <h2>${isToday
          ? (de ? "Alle Formulare · letzte 7 Tage" : "全部表单 · 最近 7 天")
          : (de ? `Alle Formulare · 7 Tage bis ${haccpShortDate(date)}` : `全部表单 · 截至 ${haccpShortDate(date)} 的 7 天`)}</h2>
        <span class="hc-recap-legend">
          <b class="is-ok">●</b>${de ? "im Grenzwert" : "正常"}
          <b class="is-bad">▲</b>${de ? "Abweichung" : "有异常"}
          <b class="is-miss">○</b>${de ? "offen" : "未填"}
          <b class="is-off">·</b>${de ? "nicht erforderlich" : "当天不需填"}
        </span>
        <span class="pill ${missCount || badCount ? "orange" : "green"}">
          ${missCount || badCount
            ? `${de ? "7 Tage: " : (isToday ? "过去 7 天" : "这 7 天") + "："}${[
                badCount ? (de ? `${badCount} Abweichung(en)` : `${badCount} 次异常`) : "",
                missCount ? (de ? `${missCount} offen` : `${missCount} 格未填`) : ""
              ].filter(Boolean).join(" · ")}`
            : (de ? "7 Tage lückenlos" : `${isToday ? "过去 7 天" : "这 7 天"}没有断档`)}
        </span>
      </div>
      <div class="hc-recap-grid" style="--cols:${days.length}">
        <span></span>
        ${days.map(d => `<span class="hc-recap-day ${d === today ? "is-today" : ""}">${Number(d.slice(8, 10))}</span>`).join("")}
        <span class="hc-recap-th">${de ? "Stand / Frist" : "进度 / 期限"}${(() => {
          if (!thisWeek) return "";   /* 已经过去的一周不倒数 */
          /* 倒数是「现在」的事实，从今天算，不从翻看的那一天算 —— 否则
             周二翻回周一会说「本周还剩 6 天」，比实际多一天 */
          const left = 6 - haccpWeekdayIndex(today);
          return left > 0 ? `<em>${de ? `Woche: noch ${left} T.` : `本周还剩 ${left} 天`}</em>`
                          : `<em>${de ? "letzter Tag" : "本周最后一天"}</em>`;
        })()}</span>
        <span class="hc-recap-th">${de ? "Zuletzt" : "上次填写"}</span>
        <span></span>
        ${rows.map(row => `
          <a class="hc-recap-name" href="#${slug("store", "HACCP记录")}?t=${encodeURIComponent(row.template.id)}"
             title="${de ? "Alle Einträge dieses Formulars" : "查看这张表的全部记录"}">
            <em class="hc-recap-icon">${haccpTemplateIcon(row.template)}</em>${haccpText(row.template.name)}
          </a>
          ${row.cells.map(c => cellHtml(row, c)).join("")}
          <span class="hc-recap-state is-${row.state.tone}"><b>${row.state.text}</b></span>
          <span class="hc-recap-last">${haccpLastCellHtml(row.template, store, 5)}</span>
          <a class="${row.state.tone === "due" ? "primary-btn" : "ghost-btn"} hc-recap-btn"
             href="#${slug("store", "HACCP填写")}?t=${encodeURIComponent(row.template.id)}&d=${date}">
            ${row.state.tone === "ok" ? (de ? "nochmal" : "再填")
              : isToday ? (de ? "Ausfüllen" : "填写") : (de ? "Nachtragen" : "补填")}
          </a>
        `).join("")}
      </div>
    </section>`;
}

function haccpHomePage() {
  const de = haccpDe();
  const store = haccpCurrentStore();
  const today = haccpToday();
  const date = state().params.get("d") || today;
  const isToday = date === today;

  const { due } = haccpSummary(store, date);
  const missed = isToday ? haccpMissedDays(store, today) : [];
  const missedByTemplate = {};
  missed.forEach(m => {
    if (!missedByTemplate[m.template.id]) missedByTemplate[m.template.id] = { template: m.template, dates: [] };
    missedByTemplate[m.template.id].dates.push(m.date);
  });
  const missedGroups = Object.values(missedByTemplate);

  const dateHref = d => `#${slug("store", "HACCP 管理")}?d=${d}`;
  const links = [
    [slug("store", "HACCP记录"), de ? "Alle Einträge" : "全部记录"],
    [slug("store", "HACCP月度表"), de ? "Monatsübersicht" : "月度表"],
    [slug("store", "HACCP设备台账"), de ? "Geräte" : "设备台账"],
    [slug("store", "HACCP检查模式"), de ? "Prüfmodus" : "检查模式"],
    [slug("store", "HACCP表单管理"), de ? "Formulare" : "表单管理"]
  ];

  return `
   <div data-no-translate class="hc-page hc-home">
    <div class="hc-home-head">
      <h1>${de ? "HACCP" : "HACCP 管理"}</h1>
      <nav class="hc-links">
        ${links.map(([href, label]) => `<a href="#${href}">${label}</a>`).join("")}
      </nav>
    </div>

    <section class="hc-bar">
      <div class="hc-bar-date">
        <a class="hc-daynav" href="${dateHref(haccpShiftDate(date, -1))}" title="${de ? "Vortag" : "前一天"}">‹</a>
        <div class="hc-bar-day">
          <strong>${haccpFormatDate(date)}</strong>
          <!-- 门店不在这里选了：全站顶栏已经有一个「当前门店」，同屏两个选择器会互相矛盾。
               这里只显示当前是哪家店，切换去顶栏。 -->
          <span>${haccpEsc(store)}</span>
        </div>
        <a class="hc-daynav ${isToday ? "is-off" : ""}" href="${isToday ? "#" + slug("store", "HACCP 管理") : dateHref(haccpShiftDate(date, 1))}" title="${de ? "Folgetag" : "后一天"}">›</a>
        ${isToday ? "" : `<a class="hc-today-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Heute" : "回到今天"}</a>`}
      </div>
      <!-- 翻到 8 月 31 日还说「今天的表都填完了」是错的：说的是哪一天，就写哪一天 -->
      <div class="hc-bar-sum">
        ${due.length
          ? `<span class="hc-dot is-due"></span>${de
              ? `${isToday ? "Heute" : haccpShortDate(date)}: ${due.length} Formular(e) offen`
              : isToday ? `今天还有 ${due.length} 张表要填`
                        : `${haccpShortDate(date)} 有 ${due.length} 张表没填`}`
          : `<span class="hc-dot is-ok"></span>${de
              ? `${isToday ? "Heute" : haccpShortDate(date)}: alles erledigt`
              : `${isToday ? "今天" : haccpShortDate(date)}的表都填完了`}`}
        ${missed.length ? `<span class="hc-bar-sep"></span><span class="hc-dot is-warn"></span>${de ? `${missed.length} Tag(e) nachzutragen` : `${missed.length} 天待补填`}` : ""}
      </div>
    </section>

    ${haccpAttentionSection(store)}

    ${(due.length || missedGroups.length) ? `
      <section class="hc-group hc-group-due">
        <!-- 今天没有要填的、只剩漏填要补时，标题不能还写「今天要填 0」 -->
        <div class="hc-group-head">
          <h2>${due.length
            ? (de ? "Heute ausfüllen" : "今天要填")
            : (de ? "Nachzutragen" : "待补填")}</h2>
          <em>${due.length || missedGroups.length}</em>
        </div>
        <div class="hc-rows">
          ${(() => {
            if (!isToday || due.length < 2) return due.map(item => haccpTaskRow(item, date, store)).join("");
            const now = haccpCurrentSlot();
            const mine = due.filter(x => (x.template.timing || "any") === now);
            const rest = due.filter(x => (x.template.timing || "any") !== now);
            if (!mine.length) return due.map(item => haccpTaskRow(item, date, store)).join("");
            return `
              <div class="hc-slotlabel is-now">${de ? `Jetzt · ${haccpText(haccpSlot(now))}` : `现在 · ${haccpText(haccpSlot(now))}`}</div>
              ${mine.map(item => haccpTaskRow(item, date, store)).join("")}
              ${rest.length ? `<div class="hc-slotlabel">${de ? "Später heute" : "今天其余"}</div>
                ${rest.map(item => haccpTaskRow(item, date, store)).join("")}` : ""}`;
          })()}
          ${missedGroups.map(g => `
            <div class="hc-rowwrap">
              <div class="hc-row is-missed">
                <span class="hc-tpl-icon">${haccpTemplateIcon(g.template)}</span>
                <div class="hc-row-main">
                  <strong>${haccpText(g.template.name)}</strong>
                  <span>${de ? `${g.dates.length} Tag(e) nicht erfasst` : `漏填 ${g.dates.length} 天`} · ${de ? "zuletzt" : "最近"} ${g.dates[0]}</span>
                </div>
                <div class="hc-row-last">
                  <span class="hc-row-last-label">${de ? "Nachtragen" : "补填"}</span>
                  <span>${g.dates.slice(0, 4).join("、")}${g.dates.length > 4 ? "…" : ""}</span>
                </div>
                <a class="ghost-btn hc-row-btn" href="#${slug("store", "HACCP填写")}?t=${encodeURIComponent(g.template.id)}&d=${g.dates[0]}">
                  ${de ? "Nachtragen" : "去补填"}
                </a>
              </div>
            </div>`).join("")}
        </div>
      </section>` : ""}
      <!-- 每周表 / 年度表不再单独成组：它们在下面的总表里已经有一行，
           带自己的期限、上次读数和填写按钮。以前两处各占一份，
           7 张表里有 5 张同时出现在任务组和矩阵里，同一件事说了三遍。 -->

    <!-- 总表在任何日期都渲染，7 天窗口跟着当前日期走。
         之前只在今天渲染，结果是「退回前一天 → 页面几乎空白」。
         翻到某天要看的恰恰是那天前后一周什么样，这正是总表干的事。 -->
    ${haccpRecapSection(store, date)}
   </div>`;
}

/* ====================================================== 派给当班的人 =====
   2026-09-04（Mingrong：当日的填写可以推给当日的上班员工么，然后员工界面出现）。

   原来这些表只有店长一个人看得见，也只有他填得了 —— 可冷藏温度是后厨早上开门时
   顺手量的，清洁是收店的人做的。店长不在店里的那天，这一整页没人看得见。

   所以：**派给那天真正上班的人**。人选不是全体员工，是那一天班表上排了班的人 ——
   派给一个今天不来的人，那张表今天一定填不成。

   只存一件事：这张表这一天派给了谁（store|date|templateId → empId）。
   「填没填」不存 —— 那是记录本身回答的（haccpEntriesFor），存第二份就会对不上。 */
const HACCP_ASSIGN_KEY = "kaispanHaccpAssign";

function haccpAssignAll() { return haccpRead(HACCP_ASSIGN_KEY, null) || {}; }
function haccpAssignKey(store, date, templateId) { return `${store}|${date}|${templateId}`; }

function haccpAssignee(store, date, templateId) {
  return haccpAssignAll()[haccpAssignKey(store, date, templateId)] || null;
}

function haccpSetAssignee(store, date, templateId, empId) {
  const all = { ...haccpAssignAll() };
  const key = haccpAssignKey(store, date, templateId);
  if (empId) all[key] = empId; else delete all[key];
  haccpWrite(HACCP_ASSIGN_KEY, all);
  return all;
}

/* 那天班表上排了班的人。班表没发布就没有「当班的人」这回事 ——
   这时候不给派，也不假装给了：下拉里会写明先去发布班表。 */
function haccpOnShift(store, date) {
  if (typeof schRoster !== "function" || typeof schWeekOf !== "function") return [];
  const roster = schRoster(store, schWeekOf(date));
  if (!roster || roster.state !== "published") return [];
  const seen = new Set();
  return roster.shifts
    .filter(x => x.date === date)
    .sort((a, b) => schMin(a.start) - schMin(b.start))
    .map(x => (typeof empById === "function" ? empById(x.empId) : null))
    .filter(e => e && !seen.has(e.id) && seen.add(e.id))
    .map(e => ({ id: e.id, name: e.name, shift: roster.shifts
      .filter(x => x.date === date && x.empId === e.id)
      .map(x => `${x.start}–${x.end}`).join("、") }));
}

/* 一个员工那天被派到的表。员工端就读这个。
   已经有记录的不再算「等你填」—— 填完了就该从他那边消失。 */
function haccpMineFor(store, empId, date) {
  const all = haccpAssignAll();
  return haccpTemplates().filter(t => {
    if (all[haccpAssignKey(store, date, t.id)] !== empId) return false;
    return !haccpEntriesFor(t.id, store, date).length;
  }).map(t => ({ template: t, store, date }));
}

/* 派单那一格：写着派给了谁，点开换人。人选只有那天在班上的。 */
function haccpAssignCell(template, date, store) {
  const de = haccpDe();
  const people = haccpOnShift(store, date);
  const who = haccpAssignee(store, date, template.id);
  const hit = people.find(x => x.id === who);
  if (!people.length) {
    return `<span class="hc-assign is-none" title="${de
      ? "Für diesen Tag ist kein Plan freigegeben — es gibt noch keine Schicht, der man das zuweisen könnte."
      : "这一天的班表还没发布，没有「当班的人」可派。"}">${de ? "kein Plan" : "班表未发布"}</span>`;
  }
  return `<label class="hc-assign${hit ? " is-set" : ""}">
    <span>${de ? "Zuständig" : "派给"}</span>
    <select data-haccp-assign="${haccpEsc(template.id)}" data-date="${date}">
      <option value="">${de ? "niemand" : "没派"}</option>
      ${people.map(x => `<option value="${haccpEsc(x.id)}"${x.id === who ? " selected" : ""}
        >${haccpEsc(x.name)} · ${haccpEsc(x.shift)}</option>`).join("")}
    </select>
  </label>`;
}

/* 过去 7 天漏填的每日表单。
   现实里漏填不是「今天忘了」，而是「上周三忘了、月底做资料时才发现」。
   等到月度表才暴露就太晚了，主页要主动说。 */
function haccpMissedDays(store, today) {
  const misses = [];
  haccpTemplates().filter(t => (t.frequency || {}).kind === "daily").forEach(template => {
    for (let i = 1; i <= 7; i += 1) {
      const day = haccpShiftDate(today, -i);
      if (template.createdAt && day < template.createdAt) continue;
      if (!haccpEntriesFor(template.id, store, day).length) misses.push({ template, date: day });
    }
  });
  return misses.sort((a, b) => b.date.localeCompare(a.date));
}

/* 能不能在主页一行里直接填完 */
function haccpQuickFillable(template) {
  const cols = template.columns || [];
  if (!cols.length || cols.length > 6) return false;
  return cols.every(c => ["temp", "choice", "person"].includes(c.type))
      && !(template.settings || []).length
      && template.layout !== "training";
}

/* 单行任务：图标 + 名称 + 频次/测量点 + 上次填写 + 填写按钮 */
function haccpTaskRow(item, date, store) {
  const de = haccpDe();
  const template = item.template;
  /* 这一行只在「今天要填 / 待补填」里出现，全部来自 sum.due，
     而 due 三个分支都蕴含 done < target —— 所以不存在「已完成」的任务行，
     以前这里有一整套 finished 分支（is-done 类、「再填一次」按钮），永远走不到。 */
  const href = `#${slug("store", "HACCP填写")}?t=${encodeURIComponent(template.id)}&d=${date}`;
  const last = haccpLastEntry(template.id, store);

  const freq = template.frequency.kind === "daily"
    ? (de ? "täglich" : "每日")
    : template.frequency.kind === "weekly"
      ? (de ? `${template.frequency.times}×/Woche` : `每周 ${template.frequency.times} 次`)
      : (de ? "jährlich" : "每年");

  const timing = template.timing && template.timing !== "any" ? haccpText(haccpSlot(template.timing)) : "";
  const meta = [freq, `${(template.columns || []).length} ${de ? "Felder" : "项"}`];
  if (timing) meta.unshift(timing);
  /* 「本周 1/2」是个比分，不是指令。没做完时直接说还差几次。 */
  if (item.kind !== "daily") {
    const short = (item.target || 1) - (item.done || 0);
    /* 期限已经写在分组标题上（「本周内还要做 · 到周日」），这里不重复，只说差几次 */
    meta.push(de ? `noch ${short}×` : `还差 ${short} 次`);
  }

  /* 「上次填写」和总表那一列是同一段 —— 真的共用 haccpLastCellHtml，
     之前这里另抄了一份，注释却写着「共用」。 */
  const lastText = haccpLastCellHtml(template, store, 0);

  return `
   <div class="hc-rowwrap">
    <div class="hc-row is-due">
      <span class="hc-tpl-icon">${haccpTemplateIcon(template)}</span>
      <div class="hc-row-main">
        <strong>${haccpText(template.name)}</strong>
        <span>${meta.join(" · ")}</span>
      </div>
      <div class="hc-row-last">
        <span class="hc-row-last-label">${de ? "Zuletzt" : "上次填写"}</span>
        <span>${lastText}</span>
      </div>
      ${date === haccpToday() ? haccpAssignCell(template, date, store) : ""}
      ${haccpQuickFillable(template) ? `
        <button type="button" class="primary-btn hc-row-btn" data-haccp-quick="${template.id}" data-date="${date}">
          ${de ? "Ausfüllen" : "填写"} <span class="hc-quick-caret">▾</span>
        </button>` : `
        <a class="primary-btn hc-row-btn" href="${href}">${de ? "Ausfüllen" : "填写"}</a>`}
    </div>
    ${haccpQuickFillable(template) ? `
      <div class="hc-quick" data-haccp-quick-panel="${template.id}" data-template="${template.id}" data-date="${date}" hidden>
        <div class="hc-quick-fields">
          ${(template.columns || []).map(column => {
            const prev = last && last.values ? last.values[column.id] : "";
            if (column.type === "temp") {
              return `<label class="hc-quick-field">
                <span>${haccpText(column.label)}</span>
                <div class="hc-quick-input">
                  <input type="text" inputmode="decimal" data-haccp-quick-input="${column.id}" placeholder="${prev !== "" && prev != null ? prev : "0.0"}">
                  <em>${haccpEsc(column.unit)}</em>
                </div>
                <b class="hc-quick-verdict" data-haccp-quick-verdict="${column.id}"></b>
              </label>`;
            }
            const options = column.type === "person"
              ? haccpPeople().map(n => ({ zh: n }))
              : (column.options || []);
            return `<label class="hc-quick-field">
              <span>${haccpText(column.label)}</span>
              <select data-haccp-quick-input="${column.id}">
                <option value="">${de ? "wählen" : "请选择"}</option>
                ${options.map(o => `<option value="${haccpEsc(haccpValueOf(o))}">${haccpText(o)}</option>`).join("")}
              </select>
              <b class="hc-quick-verdict" data-haccp-quick-verdict="${column.id}"></b>
            </label>`;
          }).join("")}
        </div>
        <div class="hc-quick-corrective" data-haccp-quick-corrective hidden>
          <span data-haccp-quick-why></span>
          <input type="text" data-haccp-quick-corrective-input placeholder="${de ? "Korrekturmaßnahme" : "填写纠正措施后才能提交"}">
        </div>
        <div class="hc-quick-actions">
          <span class="hc-quick-status" data-haccp-quick-status></span>
          <a class="ghost-btn" href="${href}">${de ? "Vollständiges Formular" : "打开完整表单"}</a>
          <button type="button" class="primary-btn" data-haccp-quick-submit disabled>${de ? "Absenden" : "提交"}</button>
        </div>
      </div>` : ""}
   </div>`;
}

/* 原表的表头栏（Operation / Inspector；员工培训还有 Referent 和 Training topic）。
   之前这些字段只存不显示，导致员工培训表填出来缺原表要求的两项信息。 */
function haccpHeaderMarkup(template, haccpFillDate) {
  const de = haccpDe();
  const header = template.header || {};
  const fields = [
    { key: "operation", label: { zh: "企业 / 门店（Operation）", de: "Betrieb (Operation)" }, value: header.operation || haccpCurrentStore(), readonly: true },
    { key: "inspector", label: { zh: "负责人（Inspector）", de: "Verantwortlich (Inspector)" }, value: header.inspector || "" }
  ];
  if (template.layout === "training") {
    fields.push({ key: "referent", label: { zh: "讲师（Referent）", de: "Referent" }, value: header.referent || "", required: true });
    fields.push({ key: "topic", label: { zh: "培训主题（Training topic)", de: "Schulungsthema" }, value: header.topic || "", required: true });
  }
  return `
    <section class="card hc-header-card">
      <div class="section-title">
        <div>
          <h2>${de ? "Formularkopf" : "表头信息"}</h2>
          <p>${de ? "Wird mit dem Eintrag gespeichert und in den Behördenunterlagen ausgewiesen." : "会随记录一起保存，卫生局资料里要显示。"}</p>
        </div>
      </div>
      <div class="form-grid">
        <label class="hc-setting-field">
          <span class="hc-label">${de ? "Datum des Eintrags" : "记录日期"}</span>
          <input class="hc-input" type="date" data-haccp-date value="${haccpFillDate}" max="${haccpToday()}">
        </label>
        ${/* 2026-09-04：员工在自己那一侧填的时候，「填写人」就是登录的这个人 ——
              给他一个七选一的下拉，等于允许他把一张卫生局记录签成别人的名字。
              店长那边照旧是下拉：他确实可能替不在场的人代录，那是他的职责。 */""}
        <label class="hc-setting-field">
          <span class="hc-label">${de ? "Erfasst von" : "填写人"}<span class="hc-required">*</span></span>
          ${(() => {
            const me = haccpInMeShell() && typeof meEmp === "function" ? meEmp() : null;
            if (me && haccpPeople().includes(me.name)) {
              return `<input class="hc-input" data-haccp-filler value="${haccpEsc(me.name)}" readonly
                title="${de ? "Wird auf Ihren Namen erfasst." : "这条记录签你的名字。"}">`;
            }
            return `<select class="hc-input" data-haccp-filler>
              ${haccpPeople().map(n =>
                `<option ${n === haccpCurrentUser() ? "selected" : ""}>${haccpEsc(n)}</option>`).join("")}
            </select>`;
          })()}
        </label>
        ${fields.map(f => `
          <label class="hc-setting-field">
            <span class="hc-label">${haccpText(f.label)}${f.required ? `<span class="hc-required">*</span>` : ""}</span>
            <input class="hc-input" data-haccp-header="${f.key}" value="${haccpEsc(f.value)}"
              ${f.readonly ? "readonly" : ""} ${f.required ? 'data-required="1"' : ""}
              placeholder="${f.readonly ? "" : (de ? "eintragen" : "请填写")}">
          </label>`).join("")}
      </div>
    </section>`;
}

/* ------------------------------------------------------------ 复核流程 ---- */
/* 原表最后一列 Control / Signature 就是「员工填、店长签」。
   之前只做了第一级，「待复核」和「有异常待处理」是永远无法流转的死状态。 */
/* 「还没收尾」= 有异常且没处理。正常记录填完就是终态（已记录），不再排队等人点确认。
   「待复核」是旧数据留下的状态，这里一并算作没收尾，点一次就能结清。 */
function haccpIsOpen(entry) {
  if (!entry || entry.voided) return false;
  if (entry.status === "待复核") return true;
  return !!entry.hasBreach && entry.status !== "已处理" && entry.status !== "已确认";
}

function haccpReviewEntry(entryId, action, note) {
  const list = haccpEntries();
  const entry = list.find(e => e.id === entryId);
  if (!entry) return null;
  if (action === "confirm") {
    /* 正常记录不需要逐条确认了，所以 confirm 只对异常有意义；
       旧数据里残留的「待复核」点一下也照样能收尾。 */
    entry.status = entry.hasBreach ? "已处理" : "已确认";
    entry.controlBy = haccpCurrentUser();
    entry.controlAt = new Date().toISOString();
    if (note) entry.controlNote = note;
  } else if (action === "reopen") {
    entry.status = entry.hasBreach ? "有异常待处理" : "已记录";
    entry.controlBy = null; entry.controlAt = null; delete entry.controlNote;
  } else if (action === "void") {
    entry.voided = true;
    entry.voidReason = note || "";
    entry.voidedBy = haccpCurrentUser();
    entry.voidedAt = new Date().toISOString();
  }
  haccpWrite(HACCP_ENTRY_KEY, list);
  return entry;
}

/* ------------------------------------------------------------ 填表页 ------ */
function haccpFillPage() {
  const de = haccpDe();
  const params = state().params;
  const templateId = params.get("t") || "";
  const date = params.get("d") || haccpToday();
  const template = haccpTemplate(templateId);
  const store = haccpCurrentStore();
  const backHref = `#${haccpExitHash()}`;

  if (!template) {
    return `<div data-no-translate class="hc-page"><div class="page-head"><div><h1>${de ? "Formular nicht gefunden" : "找不到该表单"}</h1></div></div>
      <div class="card"><p>${de ? "Dieses Formular existiert nicht oder wurde deaktiviert." : "该表单不存在或已被停用。"}</p>
      <a class="primary-btn" href="${backHref}">${de ? "Zurück" : "返回 HACCP"}</a></div></div>`;
  }

  const existing = haccpEntriesFor(template.id, store, date);
  const alreadyDone = template.layout === "monthly-grid" && existing.length > 0;
  /* 今天还没填的下一张表 —— 填完一张不用回主页再点一次 */
  const nextDue = haccpSummary(store, date).due.find(item => item.template.id !== template.id) || null;
  const freq = template.frequency.kind === "daily"
    ? (de ? "täglich" : "每日填写")
    : template.frequency.kind === "weekly"
      ? (de ? `${template.frequency.times}× pro Woche` : `每周 ${template.frequency.times} 次`)
      : (de ? "jährlich" : "每年一次");

  return `
    <div data-no-translate class="hc-page hc-fill" data-haccp-fill data-template="${template.id}" data-date="${date}">
      <div class="page-head">
        <div>
          <h1>${haccpText(template.name)}</h1>
          <p>${template.name.en || ""} · ${haccpFormatDate(date)} · ${store}</p>
        </div>
        <a class="ghost-btn accent-back-btn" href="${backHref}">${de ? "Zurück zu HACCP" : "返回 HACCP"}</a>
      </div>

      ${alreadyDone ? `
        <div class="card hc-note hc-note-done">
          ${de ? "Für heute wurde bereits ein Eintrag erfasst. Ein weiterer Eintrag wird zusätzlich gespeichert." : "今天已经填过一次，再次提交会作为一条新增记录保存。"}
        </div>` : ""}

      ${haccpHeaderMarkup(template, date)}

      ${/* 门店设置（用的是哪种清洁剂、哪种消毒剂）是**整店一次性**定下来的东西，
            改了对以后每一条记录都生效。员工填自己那一张日报时不该动它 ——
            那不是他这一次填报的一部分，是店长的配置。
            所以员工端只读着看（他需要知道该用哪一瓶），改不了。（2026-09-04） */""}
      ${template.settings && template.settings.length ? `
        <section class="card hc-settings">
          <div class="section-title">
            <div>
              <h2>${de ? "Filialeinstellung" : "门店设置"}</h2>
              <p>${haccpInMeShell()
                ? (de ? "Vom Betrieb hinterlegt — bitte diese Mittel verwenden."
                      : "店里定好的，按这个用。改动要找店长。")
                : (de ? "Einmal hinterlegen, gilt für alle Einträge." : "填一次即可，不用每天重填。")}</p>
            </div>
          </div>
          <div class="form-grid">
            ${template.settings.map(setting => `
              <label class="hc-setting-field">
                <span class="hc-label">${haccpText(setting.label)}</span>
                <input type="text" class="hc-input" data-haccp-setting="${setting.id}" value="${haccpEsc(setting.value)}"
                  ${haccpInMeShell() ? "readonly" : ""}
                  ${haccpInMeShell() && !setting.value ? `placeholder="${de ? "vom Betrieb noch nicht hinterlegt" : "店里还没填"}"` : ""}>
              </label>`).join("")}
          </div>
        </section>` : ""}

      <section class="card hc-formcard">
        <div class="section-title">
          <div>
            <h2>${de ? "Eintrag" : "本次填报"}</h2>
            <p>${freq} · ${de ? "Werte außerhalb der Grenzwerte werden sofort markiert." : "超出临界值的数值会立即标出，并要求填写纠正措施。"}</p>
          </div>
          <span class="pill blue">${haccpFormatDate(date)}</span>
        </div>

        ${template.layout === "training" ? haccpRosterMarkup(template) : `
        ${(() => {
          const std = haccpStandardColumns(template);
          const temps = (template.columns || []).filter(c => c.type === "temp").length;
          if (!std.length) return "";
          return `
          <div class="hc-quickbar">
            <button type="button" class="ghost-btn" data-haccp-fill-standard>
              ${de ? `Alle ${std.length} Punkte als „in Ordnung" setzen` : `全部按标准完成（${std.length} 项）`}
            </button>
            <span>${de
              ? (temps ? `Temperaturen bleiben leer — die werden gemessen.` : `Danach nur noch die Ausnahmen ändern.`)
              : (temps ? `温度不会被填 —— 那是量出来的。铺好后只改例外。` : `铺好后只改例外。`)}</span>
          </div>`;
        })()}
        <div class="hc-fields">
          ${template.columns.map(column => haccpFieldMarkup(column)).join("")}
        </div>`}

        <section class="hc-corrective" data-haccp-corrective hidden>
          <div class="hc-corrective-head">
            <strong>${de ? "Korrekturmaßnahme erforderlich" : "需要填写纠正措施"}</strong>
            <p data-haccp-corrective-why></p>
          </div>
          <textarea class="hc-input hc-textarea" data-haccp-corrective-input rows="3"
            placeholder="${de ? "Was wurde unternommen?" : "已经做了什么处理？例如：调低冷藏温度并报修，货物已移出。"}"></textarea>
        </section>

        <div class="hc-actionrow">
          <span class="hc-submit-status" data-haccp-status></span>
          <a class="ghost-btn" href="${backHref}">${de ? "Abbrechen" : "取消"}</a>
          ${nextDue && !haccpInMeShell() ? `<button type="button" class="ghost-btn" data-haccp-submit data-next="${encodeURIComponent(nextDue.template.id)}">
            ${de ? "Absenden und weiter" : "提交并填下一张"}</button>` : ""}
          <button type="button" class="primary-btn" data-haccp-submit>${de ? "Eintrag absenden" : "提交记录"}</button>
        </div>
      </section>

      <section class="card hc-footnotes">
        <details>
          <summary>${de ? "Grenzwerte und Korrekturmaßnahmen" : "临界值与纠正措施说明"}</summary>
          ${(template.footnotes || []).map(note => `<p>${haccpText(note)}</p>`).join("")}
        </details>
      </section>
    </div>`;
}

/* ------------------------------------------------ 培训表：多参与者 ------- */
/* 一次培训是「Martin 讲卫生规范，8 个人参加，签一张表」。
   原来一次只能填一个人，8 个人要提交 8 遍、每遍重填讲师和主题。
   纸质表本身就是一人一行，所以这里勾人 → 生成行 → 一次提交存 N 条，
   数据模型不用动，每条记录仍然等于纸上的一行。 */
function haccpRosterPersonColumn(template) {
  return (template.columns || []).find(c => c.type === "person") || null;
}

function haccpRosterMarkup(template) {
  const de = haccpDe();
  const people = haccpPeople();
  const personCol = haccpRosterPersonColumn(template);
  const rest = (template.columns || []).filter(c => c !== personCol);

  return `
    <div class="hc-roster" data-haccp-roster>
      <div class="hc-roster-pick">
        <span class="hc-label">${personCol ? haccpText(personCol.label) : (de ? "Teilnehmer" : "参与人")}
          <span class="hc-required">*</span></span>
        <p class="muted small">${de ? "Mehrere auswählen — pro Person wird ein Eintrag gespeichert."
                                    : "可以多选。每选一个人就多一条记录，讲师和主题只填一次。"}</p>
        <div class="hc-roster-chips">
          ${people.map(name => `
            <label class="hc-rosterchip">
              <input type="checkbox" data-haccp-participant value="${haccpEsc(name)}">
              <span>${haccpEsc(name)}</span>
            </label>`).join("")}
        </div>
        <div class="hc-roster-guest">
          <input class="hc-input" data-haccp-guest
            placeholder="${de ? "Nicht auf der Liste? Name eingeben und Enter" : "不在名单上的人：输入姓名后按回车"}">
          <button type="button" class="ghost-btn" data-haccp-guest-add>${de ? "Hinzufügen" : "加入"}</button>
        </div>
      </div>
      <div class="hc-roster-rows" data-haccp-roster-rows>
        <p class="muted small hc-roster-empty">${de ? "Noch niemand ausgewählt." : "还没有选参与人。"}</p>
      </div>
    </div>`;
}

/* 单个参与者一行：姓名 + 该表除「参与人」外的其余列 */
function haccpRosterRowMarkup(template, name) {
  const de = haccpDe();
  const personCol = haccpRosterPersonColumn(template);
  const rest = (template.columns || []).filter(c => c !== personCol);
  const control = column => {
    if (column.type === "choice") {
      return `<select class="hc-input" data-haccp-cell="${column.id}">
        <!-- value 必须是中文原文（存储值），德语只是显示。
             写成 haccpText 会在德语界面把「Erstschulung」存进 values，
             切回中文就成了乱码，breachOn / limitBy 的键也对不上。 -->
        ${(column.options || []).map(o =>
          `<option value="${haccpEsc(haccpValueOf(o))}">${haccpText(o)}</option>`).join("")}
      </select>`;
    }
    if (column.type === "temp") {
      return `<input class="hc-input" type="number" step="0.1" data-haccp-cell="${column.id}">`;
    }
    return `<input class="hc-input" type="text" data-haccp-cell="${column.id}"
      placeholder="${column.type === "signature" ? (de ? "Name als Unterschrift" : "输入姓名作为签名") : ""}">`;
  };
  return `
    <div class="hc-roster-row" data-haccp-roster-row data-name="${haccpEsc(name)}">
      <strong class="hc-roster-name">${haccpEsc(name)}</strong>
      ${rest.map(column => `
        <label class="hc-roster-cell">
          <span class="hc-label">${haccpText(column.label)}</span>
          ${control(column)}
        </label>`).join("")}
      <button type="button" class="ghost-btn is-danger hc-roster-drop" data-haccp-roster-drop="${haccpEsc(name)}"
        title="${de ? "entfernen" : "移出"}">×</button>
    </div>`;
}

/* ---------------------------------------------------- 填表快捷方式 ------ */
/* 员工填这几张表，时间主要花在两处：一是逐个点选（清洁 5 个区域、入库 5 项感官），
   二是在输入框之间来回摸鼠标。所以：
     ① 勾选/选项类给一个「全部按标准完成」，一次铺满，再改例外；
     ② 温度框自动聚焦、Enter 串到下一个、最后一个 Enter 直接提交；
     ③ 供应商、商品类别、执行人这类**非测量**字段带上次的值。
   刻意不做的：温度值不预填、不提供「同上」。
   HACCP 记录是证据，预填读数会让它退化成走过场 —— 连续 30 天一模一样的 4.0 °C，
   卫生局一眼就看出来，整本记录的可信度当场归零，比漏填还糟。 */

/* 一个列有没有「标准答案」：勾选题是全勾；选项题要有 breachOn 才知道哪个是合规项 */
function haccpStandardValue(column) {
  if (column.type === "checklist") return (column.items || []).map(i => haccpValueOf(i));
  if (column.type === "choice" && (column.breachOn || []).length) {
    const bad = column.breachOn;
    const good = (column.options || []).map(o => haccpValueOf(o)).find(v => !bad.includes(v));
    return good == null ? null : good;
  }
  return null;
}

function haccpStandardColumns(template) {
  return (template.columns || []).filter(c => haccpStandardValue(c) != null);
}

/* 上次那条记录里可以安全带过来的字段：非测量、非照片、非签名。
   供应商这周还是那家、清洁执行人还是那个人 —— 这些重复输入没有证据价值。 */
function haccpCarryOver(template, store) {
  const last = haccpLastEntry(template.id, store);
  if (!last) return {};
  const out = {};
  (template.columns || []).forEach(c => {
    if (["temp", "photo", "signature", "checklist"].includes(c.type)) return;
    if (c.type === "choice" && (c.breachOn || []).length) return;   /* 合规判定项必须每次自己选 */
    const v = last.values ? last.values[c.id] : "";
    if (v !== "" && v != null && !Array.isArray(v)) out[c.id] = v;
  });
  return out;
}

function haccpFieldMarkup(column) {
  const de = haccpDe();
  const label = haccpText(column.label);
  const note = column.note ? `<span class="hc-note-inline">${haccpText(column.note)}</span>` : "";
  const optional = column.optional ? `<span class="hc-optional">${de ? "optional" : "选填"}</span>` : "";
  const head = `<span class="hc-label">${label}${optional}</span>${note}`;

  if (column.type === "temp") {
    return `
      <div class="hc-field hc-field-temp" data-haccp-field="${column.id}" data-type="temp">
        ${head}
        <div class="hc-input-row">
          <input type="text" inputmode="decimal" class="hc-input hc-input-num" data-haccp-input="${column.id}"
            placeholder="0.0" aria-label="${label}">
          <span class="hc-unit">${haccpEsc(column.unit)}</span>
        </div>
        <span class="hc-verdict" data-haccp-verdict="${column.id}"></span>
      </div>`;
  }

  if (column.type === "choice") {
    return `
      <div class="hc-field" data-haccp-field="${column.id}" data-type="choice">
        ${head}
        <div class="hc-choices">
          ${column.options.map(option =>
            `<button type="button" class="hc-choice" data-haccp-choice="${column.id}" data-value="${haccpEsc(haccpValueOf(option))}">${haccpText(option)}</button>`
          ).join("")}
        </div>
        <span class="hc-verdict" data-haccp-verdict="${column.id}"></span>
      </div>`;
  }

  if (column.type === "checklist") {
    return `
      <div class="hc-field hc-field-wide" data-haccp-field="${column.id}" data-type="checklist">
        ${head}
        <div class="hc-checklist">
          ${column.items.map(item =>
            `<label class="hc-check"><input type="checkbox" data-haccp-check="${column.id}" value="${haccpEsc(haccpValueOf(item))}"><span>${haccpText(item)}</span></label>`
          ).join("")}
        </div>
        <span class="hc-verdict" data-haccp-verdict="${column.id}"></span>
      </div>`;
  }

  if (column.type === "person") {
    const list = haccpPeople();
    /* 2026-09-04（Mingrong：已经派给该员工了，填写的时候还要写执行人么）——
       不用。表是派给他的、他正在填，默认执行人就是他，不该再从七个人里挑一遍自己。
       但也不能直接写死不让改：店长把「清洁与消毒」派给 Kevin，Kevin 做了大部分，
       厕所那一格是 Lisa 做的 —— HACCP 记的必须是真正动手的人。
       所以：默认就是他，那一格直接写他的名字，旁边一个「不是我做的」才展开名单。
       不写「就是你」这种话 —— 页头上就是他的名字和门店，再解释一遍是句废话。
       常规情况零次点击，换人的情况仍然说得出实话。 */
    const me = haccpInMeShell() && typeof meEmp === "function" ? meEmp() : null;
    const mine = me && list.includes(me.name) ? me.name : null;
    return `
      <div class="hc-field${mine ? " is-mine" : ""}" data-haccp-field="${column.id}" data-type="person">
        ${head}
        ${mine ? `<p class="hc-mine"><b>${haccpEsc(mine)}</b>
          <button type="button" class="hc-mine-swap" data-haccp-swap="${column.id}">${
            haccpDe() ? "war jemand anderes" : "不是我做的"}</button></p>` : ""}
        <div class="hc-choices"${mine ? " hidden" : ""}>
          ${list.map(name => `<button type="button" class="hc-choice${name === mine ? " is-on" : ""}"
            data-haccp-choice="${column.id}" data-value="${haccpEsc(name)}">${haccpEsc(name)}</button>`).join("")}
        </div>
        <span class="hc-verdict" data-haccp-verdict="${column.id}"></span>
      </div>`;
  }

  if (column.type === "photo") {
    return `
      <div class="hc-field hc-field-wide" data-haccp-field="${column.id}" data-type="photo">
        ${head}
        <div class="hc-photo">
          <label class="hc-photo-pick">
            <input type="file" accept="image/*" data-haccp-photo="${column.id}" hidden>
            <span>${de ? "Foto auswählen" : "选择照片"}</span>
          </label>
          <div class="hc-photo-preview" data-haccp-photo-preview="${column.id}"></div>
        </div>
        <span class="hc-verdict" data-haccp-verdict="${column.id}"></span>
      </div>`;
  }

  if (column.type === "signature") {
    return `
      <div class="hc-field" data-haccp-field="${column.id}" data-type="signature">
        ${head}
        <input type="text" class="hc-input hc-input-sign" data-haccp-input="${column.id}"
          placeholder="${de ? "Name als Unterschrift eingeben" : "输入姓名作为签名"}">
        <span class="hc-verdict" data-haccp-verdict="${column.id}"></span>
      </div>`;
  }

  /* text */
  const field = column.multiline
    ? `<textarea class="hc-input hc-textarea" data-haccp-input="${column.id}" rows="3" placeholder="${haccpText(column.placeholder) || ""}"></textarea>`
    : `<input type="text" class="hc-input" data-haccp-input="${column.id}" placeholder="${haccpText(column.placeholder) || ""}">`;
  return `
    <div class="hc-field ${column.multiline ? "hc-field-wide" : ""}" data-haccp-field="${column.id}" data-type="text">
      ${head}
      ${field}
      <span class="hc-verdict" data-haccp-verdict="${column.id}"></span>
    </div>`;
}

/* ---------------------------------------------------------- 全部记录 ------ */
/* 异常在这里收尾。正常记录填完即「已记录」，不需要逐条确认。
   记录不能物理删除（卫生局资料会出洞），只能作废并注明理由。

   标签和状态药丸说的不是一回事，别混：
     药丸（已记录 / 有异常待处理 / 已处理）说的是「这一条是什么状态」
     标签（待处理 / 异常记录）说的是「筛出哪一批」
   上一版这两个标签筛的几乎是同一批 —— 那是重复。现在分开：
     待处理   还要你做事的（有异常没处理 + 旧数据里的「待复核」）
     异常记录 历史上所有出过异常的（含已处理完的），卫生局会问「今年出过几次」 */
const HACCP_PAGE_SIZE = 25;

function haccpMyRecordsPage() {
  const de = haccpDe();
  const params = state().params;
  const store = haccpCurrentStore();
  const filter = params.get("filter") || "";
  const tplFilter = params.get("t") || "";
  const monthFilter = params.get("m") || "";
  /* ?p=abc -> Number("abc") 是 NaN，Math.max(1, NaN) 仍是 NaN，
     分页器显示「第 NaN/3 页」且一条记录都不渲染 */
  const page = Math.max(1, Math.floor(Number(params.get("p"))) || 1);
  const showVoided = params.get("voided") === "1";

  const base = `#${slug("store", "HACCP记录")}`;
  const q = (over) => {
    const o = Object.assign({ filter, t: tplFilter, m: monthFilter, voided: showVoided ? "1" : "" }, over);
    const parts = Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
    return base + (parts.length ? `?${parts.join("&")}` : "");
  };

  const matched = haccpEntries()
    .filter(e => e.store === store)
    .filter(e => showVoided ? true : !e.voided)
    .filter(e => filter === "breach" ? !!e.hasBreach
               : filter === "open" ? haccpIsOpen(e)
               : true)
    .filter(e => !tplFilter || e.templateId === tplFilter)
    .filter(e => !monthFilter || e.date.startsWith(monthFilter))
    .sort((a, b) => (b.date + (b.filledAt || "")).localeCompare(a.date + (a.filledAt || "")));

  const pages = Math.max(1, Math.ceil(matched.length / HACCP_PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = matched.slice((current - 1) * HACCP_PAGE_SIZE, current * HACCP_PAGE_SIZE);

  const months = [...new Set(haccpEntries().filter(e => e.store === store).map(e => e.date.slice(0, 7)))].sort().reverse();
  const statusTone = { "已记录": "blue", "待复核": "orange", "已确认": "green",
                       "已处理": "green", "有异常待处理": "red" };
  const mine = haccpEntries().filter(e => e.store === store && !e.voided);
  const openCount = mine.filter(haccpIsOpen).length;
  const breachCount = mine.filter(e => e.hasBreach).length;
  const tabs = [["", de ? "Alle" : "全部"],
                ["open", (de ? "Offen" : "待处理") + (openCount ? ` ${openCount}` : "")],
                ["breach", (de ? "Abweichungen" : "异常记录") + (breachCount ? ` ${breachCount}` : "")]];

  return `
   <div data-no-translate class="hc-page">
    <div class="page-head">
      <div><h1>${de ? "Alle Einträge" : "全部记录"}</h1>
        <p>${de ? "Abweichungen werden hier abgeschlossen. Gelöscht wird nicht — nur storniert mit Begründung."
                : "异常在这里收尾。正常记录填完即归档，不需要逐条确认。记录不能删除，只能作废并注明理由。"}</p></div>
      <div class="button-row">
        <a class="ghost-btn accent-back-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Zurück zu HACCP" : "返回 HACCP"}</a>
        ${tplFilter ? `<button type="button" class="ghost-btn" data-haccp-export="${tplFilter}" data-month="${monthFilter}">${de ? "CSV" : "导出 CSV"}</button>` : ""}
      </div>
    </div>

    <div class="hc-filters">
      ${tabs.map(([v, label]) => `<a class="hc-filter ${filter === v ? "is-on" : ""}" href="${q({ filter: v, p: "" })}">${label}</a>`).join("")}
      <select class="hc-input hc-fselect" data-haccp-jump="t">
        <option value="">${de ? "Alle Formulare" : "全部表单"}</option>
        ${haccpTemplates(true).map(t => `<option value="${t.id}" ${t.id === tplFilter ? "selected" : ""}>${haccpText(t.name)}</option>`).join("")}
      </select>
      <select class="hc-input hc-fselect" data-haccp-jump="m">
        <option value="">${de ? "Alle Monate" : "全部月份"}</option>
        ${months.map(m => `<option value="${m}" ${m === monthFilter ? "selected" : ""}>${m}</option>`).join("")}
      </select>
      <a class="hc-filter ${showVoided ? "is-on" : ""}" href="${q({ voided: showVoided ? "" : "1", p: "" })}">${de ? "storniert einblenden" : "显示已作废"}</a>
    </div>

    <p class="muted small" style="margin:12px 0 0">${de ? `${matched.length} Einträge` : `共 ${matched.length} 条`}${pages > 1 ? (de ? ` · Seite ${current}/${pages}` : ` · 第 ${current}/${pages} 页`) : ""}</p>

    ${shown.length ? `
      <div class="hc-record-list">
        ${shown.map(entry => {
          const template = haccpTemplateAt(entry.templateId, entry.templateVersion);
          const settled = entry.status === "已确认" || entry.status === "已处理";
          /* 看到「冷藏间 12°C 超标」时，下一个问题一定是「这台机器最近是不是一直在爬」。
             设备详情里趋势图和维修记录都有，以前从这里过不去。 */
          const devices = haccpDevices(entry.store);
          const hit = (entry.breaches || []).map(cid =>
            devices.find(d => d.link && d.link.templateId === entry.templateId && d.link.columnId === cid)
          ).filter(Boolean);
          const linked = hit.filter((d, i) => hit.indexOf(d) === i).slice(0, 3);
          return `
            <div class="hc-record ${entry.voided ? "is-voided" : entry.hasBreach ? "is-breach" : ""}">
              <div class="hc-record-main">
                <strong>${haccpText(template.name)}</strong>
                <span>${entry.date} · ${haccpEsc(entry.filledBy)} · v${entry.templateVersion}${entry.controlBy
                  ? ` · ${de ? "freigegeben von" : "复核"} ${haccpEsc(entry.controlBy)}${entry.controlAt
                      ? `（${haccpStamp(entry.controlAt)}）` : ""}`
                  : ""}</span>
              </div>
              <div class="hc-record-jump">
                <a href="#${slug("store", "HACCP月度表")}?t=${encodeURIComponent(entry.templateId)}&m=${entry.date.slice(0, 7)}">
                  ${de ? "Monatsübersicht" : "看当月整表"} ›</a>
                ${linked.map(d => `
                  <a class="is-dev" href="#${slug("store", "HACCP设备详情")}?id=${encodeURIComponent(d.id)}">
                    ${haccpText(d.name)} ${de ? "· Verlauf" : "· 温度趋势"} ›</a>`).join("")}
              </div>
              <div class="hc-record-values">
                ${template.columns.map(column => {
                  const shown = haccpDisplayValue(column, entry.values[column.id]);
                  const bad = (entry.breaches || []).includes(column.id);
                  const unit = (shown !== "—" && column.type === "temp") ? (column.unit || "") : "";
                  return `<span class="hc-rv ${bad ? "is-bad" : ""}"><em>${haccpText(column.label)}</em>${shown}${unit}</span>`;
                }).join("")}
              </div>
              ${entry.corrective ? `<p class="hc-record-corrective"><strong>${de ? "Korrektur" : "纠正措施"}：</strong>${haccpEsc(entry.corrective)}</p>` : ""}
              ${entry.controlNote ? `<p class="hc-record-corrective"><strong>${de ? "Freigabenotiz" : "复核备注"}：</strong>${haccpEsc(entry.controlNote)}</p>` : ""}
              ${entry.voided ? `<p class="hc-record-corrective is-void"><strong>${de ? "Storniert" : "已作废"}：</strong>${haccpEsc(entry.voidReason) || (de ? "ohne Angabe" : "未注明理由")} · ${haccpEsc(entry.voidedBy)}${entry.voidedAt ? `（${haccpStamp(entry.voidedAt)}）` : ""}</p>` : ""}
              <span class="pill ${entry.voided ? "blue" : (statusTone[entry.status] || "blue")}">${entry.voided ? (de ? "storniert" : "已作废") : haccpText(entry.status)}</span>
              ${entry.voided ? "" : `
                <!-- 正常记录填完就是终态，不再给「确认」按钮：
                     7 张表 x 每天逐条点，两周就会被放弃，然后「待复核」堆成三位数，
                     把真正要处理的异常淹掉。只有异常（和旧数据残留的待复核）才需要收尾。 -->
                <div class="hc-record-actions">
                  ${settled
                    ? `<button type="button" class="ghost-btn" data-haccp-review="reopen" data-id="${entry.id}">${de ? "Abschluss zurücknehmen" : "撤销处理"}</button>`
                    : haccpIsOpen(entry)
                      ? `<button type="button" class="primary-btn" data-haccp-review="confirm" data-id="${entry.id}">${entry.hasBreach ? (de ? "Als erledigt markieren" : "标记已处理") : (de ? "Freigeben" : "确认")}</button>
                         <button type="button" class="ghost-btn" data-haccp-note-toggle>${de ? "mit Notiz" : "写备注再处理"}</button>`
                      : ""}
                  <button type="button" class="ghost-btn is-danger" data-haccp-review="void" data-id="${entry.id}">${de ? "Stornieren" : "作废"}</button>
                </div>

                ${haccpIsOpen(entry) ? `
                <div class="hc-inline-panel" data-haccp-note-panel="${entry.id}" hidden>
                  <label class="hc-label">${de ? "Freigabenotiz" : "复核备注"}</label>
                  <textarea class="hc-input hc-textarea" rows="2" placeholder="${de ? "z. B. Wert geprüft, Gerät läuft normal" : "例如：已核对温度计，设备运行正常"}"></textarea>
                  <div class="button-row">
                    <button type="button" class="ghost-btn" data-haccp-note-toggle>${de ? "Abbrechen" : "取消"}</button>
                    <button type="button" class="primary-btn" data-haccp-note-submit>${de ? "Mit Notiz freigeben" : "保存备注并确认"}</button>
                  </div>
                </div>` : ""}

                <div class="hc-inline-panel is-danger" data-haccp-void-panel="${entry.id}" hidden>
                  <label class="hc-label">${de ? "Grund für die Stornierung" : "作废理由"}<span class="hc-required">*</span></label>
                  <p class="muted small">${de ? "Einträge werden nie gelöscht — sie bleiben mit Begründung im Nachweis stehen."
                                              : "记录永远不会被删除，只会带着理由留在档案里。卫生局看到的是完整的更正痕迹。"}</p>
                  <textarea class="hc-input hc-textarea" rows="2" placeholder="${de ? "z. B. Temperatur versehentlich falsch eingetragen" : "例如：温度填错了，实际是 5.2 而不是 12.0"}"></textarea>
                  <div class="button-row">
                    <span class="hc-void-hint" data-haccp-void-hint>${de ? "Grund erforderlich" : "作废必须写明理由"}</span>
                    <button type="button" class="ghost-btn" data-haccp-void-cancel>${de ? "Abbrechen" : "取消"}</button>
                    <button type="button" class="ghost-btn is-danger" data-haccp-void-submit disabled>${de ? "Stornieren" : "确认作废"}</button>
                  </div>
                </div>`}
            </div>`;
        }).join("")}
      </div>

      ${pages > 1 ? `
        <div data-no-translate class="hc-pager">
          <a class="hc-daynav ${current === 1 ? "is-off" : ""}" href="${q({ p: String(current - 1) })}">‹</a>
          <span>${current} / ${pages}</span>
          <a class="hc-daynav ${current === pages ? "is-off" : ""}" href="${q({ p: String(current + 1) })}">›</a>
        </div>` : ""}
      ` : `
      <div class="card hc-empty">
        <p>${de ? "Keine Einträge für diese Auswahl." : "当前筛选下没有记录。"}</p>
        <a class="primary-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Zur HACCP-Startseite" : "去填表"}</a>
      </div>`}
   </div>`;
}


/* ========================================================== 温度趋势图 ==== */
/* 单序列时间线：一条线 + 临界值带 + 超标点。
   为什么值得做：冰箱不是突然坏的，温度会先缓慢爬升几周。
   纸质表一天一行、翻不出趋势；这张图是数字化真正赢过纸的地方。
   规范取舍：
   - 单序列不需要图例，标题已经说清是什么
   - 超标点不能只靠红色 —— 同时放大并加白色描边环，做双重编码
   - 网格与坐标轴保持弱化，线本身 2px
   - 附一个可展开的数据表，供读屏与打印 */
function haccpTrendData(templateId, columnId, store, days) {
  const today = haccpToday();
  const from = haccpShiftDate(today, -(days - 1));
  const entries = haccpEntries()
    .filter(e => !e.voided && e.templateId === templateId && e.store === store && e.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));
  const out = [];
  entries.forEach(e => {
    const raw = e.values[columnId];
    if (raw === "" || raw == null) return;
    const value = Number(raw);
    if (Number.isNaN(value)) return;
    out.push({ date: e.date, value, breach: (e.breaches || []).includes(columnId) });
  });
  return out;
}

function haccpTrendChart(points, opts) {
  const de = haccpDe();
  const o = Object.assign({ limit: null, unit: "°C", height: 170, id: "t" + Math.random().toString(36).slice(2, 7), label: "" }, opts);
  if (!points.length) {
    return `<div class="hc-chart-empty">${de ? "Noch keine Messwerte." : "还没有测量数据。"}</div>`;
  }

  const W = 640, H = o.height, padL = 40, padR = 14, padT = 12, padB = 24;
  const values = points.map(p => p.value);
  const limit = o.limit || {};
  const candidates = values.concat([limit.min, limit.max, limit.tolerance].filter(v => v != null));
  let lo = Math.min.apply(null, candidates);
  let hi = Math.max.apply(null, candidates);
  if (hi - lo < 2) { const mid = (hi + lo) / 2; lo = mid - 1.5; hi = mid + 1.5; }
  const pad = (hi - lo) * 0.14;
  lo -= pad; hi += pad;

  const x = i => padL + (points.length === 1 ? (W - padL - padR) / 2 : i * (W - padL - padR) / (points.length - 1));
  const y = v => padT + (hi - v) * (H - padT - padB) / (hi - lo);

  /* 临界值带：合规区间画成一条极淡的底，越界一眼看得出 */
  let band = "";
  if (limit.min != null || limit.max != null) {
    const top = y(limit.max != null ? limit.max : hi);
    const bottom = y(limit.min != null ? limit.min : lo);
    band = `<rect class="hc-chart-band" x="${padL}" y="${Math.min(top, bottom)}" width="${W - padL - padR}" height="${Math.abs(bottom - top)}"></rect>`;
    if (limit.max != null) band += `<line class="hc-chart-limit" x1="${padL}" x2="${W - padR}" y1="${y(limit.max)}" y2="${y(limit.max)}"></line>
      <text class="hc-chart-axis" x="${padL - 6}" y="${y(limit.max) + 3}" text-anchor="end">${limit.max}</text>`;
    if (limit.min != null) band += `<line class="hc-chart-limit" x1="${padL}" x2="${W - padR}" y1="${y(limit.min)}" y2="${y(limit.min)}"></line>
      <text class="hc-chart-axis" x="${padL - 6}" y="${y(limit.min) + 3}" text-anchor="end">${limit.min}</text>`;
  }

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const dots = points.map((p, i) => p.breach
    ? `<circle class="hc-chart-dot is-breach" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="5.5"></circle>`
    : `<circle class="hc-chart-dot" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3.2"></circle>`).join("");

  /* 只标首尾 + 第一个超标点 + 最严重的那个。
     超标连成一串时全标会挤成一团，反而看不清 —— 规范里说得明白：
     选择性直接标注，绝不给每个点都写数字。 */
  const labelIdx = new Set([0, points.length - 1]);
  const firstBreach = points.findIndex(p => p.breach);
  if (firstBreach >= 0) {
    labelIdx.add(firstBreach);
    let worst = firstBreach;
    points.forEach((p, i) => {
      if (!p.breach) return;
      const over = limit.max != null ? p.value - limit.max : (limit.min != null ? limit.min - p.value : 0);
      const bestOver = limit.max != null ? points[worst].value - limit.max : (limit.min != null ? limit.min - points[worst].value : 0);
      if (over > bestOver) worst = i;
    });
    labelIdx.add(worst);
  }
  const labels = [...labelIdx].map(i => {
    const p = points[i];
    const anchor = i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
    return `<text class="hc-chart-val ${p.breach ? "is-breach" : ""}" x="${x(i).toFixed(1)}" y="${(y(p.value) - 10).toFixed(1)}" text-anchor="${anchor}">${p.value}</text>`;
  }).join("");

  const hotspots = points.map((p, i) =>
    `<rect class="hc-chart-hit" x="${(x(i) - 9).toFixed(1)}" y="${padT}" width="18" height="${H - padT - padB}"
       data-hc-x="${x(i).toFixed(1)}" data-hc-date="${p.date}" data-hc-value="${p.value}${o.unit}" data-hc-breach="${p.breach ? "1" : ""}"></rect>`).join("");

  return `
    <div class="hc-chart" data-hc-chart>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
           aria-label="${o.label} ${de ? "Verlauf" : "温度趋势"}">
        ${band}
        <line class="hc-chart-axisline" x1="${padL}" x2="${W - padR}" y1="${H - padB}" y2="${H - padB}"></line>
        <path class="hc-chart-line" d="${path}"></path>
        ${dots}${labels}
        <line class="hc-chart-cursor" data-hc-cursor y1="${padT}" y2="${H - padB}" style="display:none"></line>
        ${hotspots}
        <text class="hc-chart-axis" x="${padL}" y="${H - 7}" text-anchor="start">${points[0].date.slice(5)}</text>
        <text class="hc-chart-axis" x="${W - padR}" y="${H - 7}" text-anchor="end">${points[points.length - 1].date.slice(5)}</text>
      </svg>
      <div class="hc-chart-tip" data-hc-tip hidden></div>
      <details class="hc-chart-table">
        <summary>${de ? "Werte als Tabelle" : "以表格查看数据"}</summary>
        <table class="table">
          <thead><tr><th>${de ? "Datum" : "日期"}</th><th>${o.label || (de ? "Wert" : "数值")}</th><th>${de ? "Status" : "状态"}</th></tr></thead>
          <tbody>${points.map(p => `<tr><td>${p.date}</td><td>${p.value}${o.unit}</td>
            <td>${p.breach ? `<span class="pill red">${de ? "über Grenzwert" : "超出临界值"}</span>` : `<span class="pill green">${de ? "im Grenzwert" : "正常"}</span>`}</td></tr>`).join("")}</tbody>
        </table>
      </details>
    </div>`;
}

/* 迷你走势线，用在设备列表里 */
function haccpSparkline(points) {
  if (points.length < 2) return `<span class="hc-spark-none">—</span>`;
  const W = 96, H = 26;
  const vs = points.map(p => p.value);
  let lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const x = i => i * W / (points.length - 1);
  const y = v => 3 + (hi - v) * (H - 6) / (hi - lo);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  return `<svg class="hc-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <path d="${d}"></path>
    <circle cx="${x(points.length - 1).toFixed(1)}" cy="${y(last.value).toFixed(1)}" r="${last.breach ? 4 : 2.6}" class="${last.breach ? "is-breach" : ""}"></circle>
  </svg>`;
}

function haccpBindChart() {
  document.querySelectorAll("[data-hc-chart]").forEach(chart => {
    const tip = chart.querySelector("[data-hc-tip]");
    const cursor = chart.querySelector("[data-hc-cursor]");
    const svg = chart.querySelector("svg");
    chart.querySelectorAll(".hc-chart-hit").forEach(hit => {
      const show = () => {
        const box = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const px = Number(hit.dataset.hcX) / vb.width * box.width;
        cursor.setAttribute("x1", hit.dataset.hcX);
        cursor.setAttribute("x2", hit.dataset.hcX);
        cursor.style.display = "";
        tip.hidden = false;
        tip.className = "hc-chart-tip" + (hit.dataset.hcBreach ? " is-breach" : "");
        tip.innerHTML = `<b>${hit.dataset.hcValue}</b><span>${hit.dataset.hcDate}</span>`;
        tip.style.left = `${Math.max(4, Math.min(box.width - 96, px - 44))}px`;
      };
      hit.addEventListener("mouseenter", show);
      hit.addEventListener("focus", show);
    });
    chart.addEventListener("mouseleave", () => { tip.hidden = true; cursor.style.display = "none"; });
  });
}


/* ========================================================== 设备台账 ====== */
/* 之前「冷藏柜 2」只是表单的一列。现实里它是一台机器：有位置、品牌、保修、维修史。
   温度超标 → 报修 → 修好 → 记录，这条链接上之后，
   HACCP 就从「填表工具」变成「设备管理」。 */
const HACCP_DEVICE_KEY = "kaispanHaccpDevices";

function haccpSeedDevices() {
  const store = haccpStores()[0];
  const mk = (id, zh, de, columnId, location) => ({
    id, name: { zh, de }, store, type: { zh: "冷藏设备", de: "Kühlgerät" },
    location, brand: "", model: "", warrantyUntil: "",
    link: { templateId: "storage-temp", columnId },
    status: "正常", repairs: []
  });
  return [
    mk("dev-coldroom", "冷藏间", "Kühlraum", "c1", "后厨北侧"),
    mk("dev-counter1", "冷藏柜 1", "Kühltheke 1", "c2", "备餐台"),
    mk("dev-counter2", "冷藏柜 2", "Kühltheke 2", "c3", "备餐台"),
    mk("dev-fridge1", "冷藏 1", "Kühlschrank 1", "c4", "厨房入口"),
    mk("dev-fridge2", "冷藏 2", "Kühlschrank 2", "c5", "吧台后")
  ];
}

function haccpDevices(store) {
  let list = haccpRead(HACCP_DEVICE_KEY, null);
  if (!Array.isArray(list)) { list = haccpSeedDevices(); haccpWrite(HACCP_DEVICE_KEY, list); }
  return store ? list.filter(d => d.store === store) : list;
}

function haccpDevice(id) { return haccpDevices().find(d => d.id === id) || null; }

function haccpSaveDevice(device) {
  const list = haccpDevices();
  const i = list.findIndex(d => d.id === device.id);
  if (i >= 0) list[i] = device; else list.push(device);
  haccpWrite(HACCP_DEVICE_KEY, list);
}

/* 设备关联的那一列现在的限值与最近读数 */
function haccpDeviceContext(device, days) {
  if (!device.link) return { template: null, column: null, points: [], last: null, breachCount: 0, limit: null, unit: "" };
  const template = haccpTemplate(device.link.templateId);
  const column = template ? (template.columns || []).find(c => c.id === device.link.columnId) : null;
  const points = template ? haccpTrendData(template.id, device.link.columnId, device.store, days || 30) : [];
  const last = points[points.length - 1] || null;
  const breachCount = points.filter(p => p.breach).length;
  return { template, column, points, last, breachCount, limit: column ? (column.limit || null) : null, unit: column ? (column.unit || "") : "" };
}

/* 设备行右边只能有一个结论。
   以前那里挂的是 device.status —— 一个手填字段，从不看温度数据，
   于是出现了「近 14 天 3 次超标」和绿色「正常」并排的情况，
   店长看两眼就不再相信这个徽章了。
   现在维修状态优先（停用/待修/维修中是人已经知道的事实），
   没有维修状态时才由数据说话。 */
function haccpDeviceVerdict(device, ctx) {
  const de = haccpDe();
  if (device.status === "已停用") return { text: de ? "Außer Betrieb" : "已停用", tone: "" };
  if (device.status === "维修中") return { text: de ? "In Reparatur" : "维修中", tone: "orange" };
  if (device.status === "待修") return { text: de ? "Reparatur nötig" : "待修", tone: "red" };
  if (ctx.last && ctx.last.breach) return { text: de ? "zuletzt über Grenzwert" : "最近一次超标", tone: "red" };
  if (ctx.breachCount >= 3) return { text: de ? "beobachten" : "需要关注", tone: "orange" };
  if (ctx.breachCount > 0) return { text: de ? `${ctx.breachCount}× Abweichung` : `${ctx.breachCount} 次超标`, tone: "orange" };
  if (!ctx.points.length) return { text: de ? "keine Daten" : "暂无数据", tone: "" };
  return { text: de ? "im Grenzwert" : "温度正常", tone: "green" };
}

/* ---------------------------------------------------------- 台账列表 ----- */
function haccpDeviceListPage() {
  const de = haccpDe();
  const store = haccpCurrentStore();
  const devices = haccpDevices(store);
  const openRepairs = devices.reduce((n, d) => n + (d.repairs || []).filter(r => !r.doneAt).length, 0);

  return `
   <div data-no-translate class="hc-page">
    <div class="page-head">
      <div>
        <h1>${de ? "Geräte" : "设备台账"}</h1>
        <p>${de ? "Jeder Messpunkt gehört zu einem Gerät. Temperaturverlauf und Reparaturen an einem Ort."
                : "每个测量点背后是一台机器。温度趋势和维修记录放在一起看 —— 设备快坏的时候，温度会先慢慢爬。"}</p>
      </div>
      <div class="button-row">
        ${openRepairs ? `<span class="pill red">${openRepairs} ${de ? "offene Reparaturen" : "项维修未完成"}</span>` : ""}
        <a class="ghost-btn accent-back-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Zurück" : "返回 HACCP"}</a>
        <button type="button" class="primary-btn" data-haccp-dev-add>+ ${de ? "Gerät" : "添加设备"}</button>
      </div>
    </div>

    <div class="hc-inline-panel" data-haccp-dev-panel hidden>
      <label class="hc-label">${de ? "Gerätename" : "设备名称"}<span class="hc-required">*</span></label>
      <input class="hc-input" data-haccp-dev-new-name placeholder="${de ? "z. B. Kühlschrank 3" : "例如：后厨立式冷柜"}">
      <label class="hc-label" style="margin-top:10px">${de ? "Standort" : "位置"}</label>
      <input class="hc-input" data-haccp-dev-new-loc placeholder="${de ? "optional" : "选填，例如：后厨北侧"}">
      <label class="hc-label" style="margin-top:10px">${de ? "Verknüpfter Messpunkt" : "关联哪个测量点"}</label>
      <select class="hc-input" data-haccp-dev-new-link>
        <option value="">${de ? "keiner (nur Stammdaten)" : "先不关联（只做台账）"}</option>
        ${haccpTemplates().flatMap(t => (t.columns || []).filter(c => c.type === "temp")
          .map(c => `<option value="${t.id}|${c.id}">${haccpText(t.name)} · ${haccpText(c.label)}</option>`)).join("")}
      </select>
      <p class="muted small">${de ? "Die Verknüpfung liefert Temperaturverlauf und Abweichungen für dieses Gerät."
                                  : "关联之后，这台设备就能读出自己的温度趋势和超标记录。"}</p>
      <div class="button-row">
        <span class="hc-void-hint" data-haccp-dev-hint2>${de ? "Name erforderlich" : "名称必填"}</span>
        <button type="button" class="ghost-btn" data-haccp-dev-cancel>${de ? "Abbrechen" : "取消"}</button>
        <button type="button" class="primary-btn" data-haccp-dev-save disabled>${de ? "Anlegen" : "添加"}</button>
      </div>
    </div>

    <div class="hc-devlist">
      ${devices.map(device => {
        const ctx = haccpDeviceContext(device, 14);
        const verdict = haccpDeviceVerdict(device, ctx);
        return `
          <a class="hc-devrow ${ctx.last && ctx.last.breach ? "is-breach" : ""}" href="#${slug("store", "HACCP设备详情")}?id=${encodeURIComponent(device.id)}">
            <span class="hc-tpl-icon">${(haccpText(device.name).trim().charAt(0) || "?").toUpperCase()}</span>
            <div class="hc-devrow-main">
              <strong>${haccpText(device.name)}</strong>
              <span>${haccpText(device.type)} · ${haccpEsc(device.location) || (de ? "kein Standort" : "未填位置")}${device.brand ? ` · ${haccpEsc(device.brand)}` : ""}</span>
            </div>
            <div class="hc-devrow-read">
              <span class="hc-devrow-label">${de ? "Letzter Wert" : "最近读数"}</span>
              <b class="${ctx.last && ctx.last.breach ? "is-crit" : ""}">${ctx.last ? `${ctx.last.value}${ctx.unit}` : "—"}</b>
              ${ctx.last ? `<span class="hc-devrow-date">${ctx.last.date}</span>` : ""}
            </div>
            <div class="hc-devrow-spark">
              ${haccpSparkline(ctx.points)}
              <!-- 超标次数交给右边的结论徽章说，这里不再重复一遍 -->
              <span class="hc-devrow-label">${de ? "14 Tage" : "近 14 天"}</span>
            </div>
            <span class="pill ${verdict.tone}">${verdict.text}</span>
          </a>`;
      }).join("")}
    </div>
   </div>`;
}

/* ---------------------------------------------------------- 设备详情 ----- */
function haccpDeviceDetailPage() {
  const de = haccpDe();
  const id = state().params.get("id") || "";
  const device = haccpDevice(id);
  if (!device) {
    return `<div data-no-translate class="hc-page"><div class="page-head"><div><h1>${de ? "Gerät nicht gefunden" : "找不到该设备"}</h1></div></div>
      <div class="card"><a class="primary-btn" href="#${slug("store", "HACCP设备台账")}">${de ? "Zurück" : "返回台账"}</a></div></div>`;
  }
  const ctx = haccpDeviceContext(device, 30);
  const repairs = (device.repairs || []).slice().sort((a, b) => (b.openedAt || "").localeCompare(a.openedAt || ""));
  const openRepair = repairs.find(r => !r.doneAt);

  return `
   <div data-no-translate class="hc-page hc-devpage" data-haccp-device="${device.id}">
    <div class="page-head">
      <div>
        <h1>${haccpText(device.name)}</h1>
        <p>${haccpText(device.type)} · ${haccpEsc(device.location) || "—"} · ${de ? "Messpunkt" : "关联测量点"}：${ctx.column ? haccpText(ctx.column.label) : "—"}</p>
      </div>
      <div class="button-row">
        <a class="ghost-btn accent-back-btn" href="#${slug("store", "HACCP设备台账")}">${de ? "Zurück" : "返回台账"}</a>
        ${ctx.template ? `<a class="ghost-btn" href="#${slug("store", "HACCP月度表")}?t=${encodeURIComponent(ctx.template.id)}">${de ? "Monatsübersicht" : "看月度表"}</a>` : ""}
      </div>
    </div>

    <section class="card">
      <div class="section-title">
        <div>
          <h2>${de ? "Temperaturverlauf · 30 Tage" : "温度趋势 · 近 30 天"}</h2>
          <p>${ctx.limit ? (de ? `Grenzwert ${ctx.limit.min != null ? `${ctx.limit.min} bis ` : "max "}${ctx.limit.max != null ? ctx.limit.max : ""} ${ctx.unit}`
                               : `临界值 ${ctx.limit.min != null ? ctx.limit.min + " ~ " : "≤ "}${ctx.limit.max != null ? ctx.limit.max : ""} ${ctx.unit}`) : ""}</p>
        </div>
        ${ctx.breachCount ? `<span class="pill red">${ctx.breachCount} ${de ? "Abweichungen" : "次超标"}</span>` : `<span class="pill green">${de ? "durchgehend im Grenzwert" : "全部在临界值内"}</span>`}
      </div>
      ${haccpTrendChart(ctx.points, { limit: ctx.limit, unit: ctx.unit, label: haccpText(device.name) })}
    </section>

    <section class="card">
      <div class="section-title"><h2>${de ? "Gerätedaten" : "设备资料"}</h2>
        <span class="hc-save-hint" data-haccp-dev-hint></span></div>
      <div class="form-grid">
        ${[["name.zh", de ? "Name" : "设备名称", haccpText(device.name)],
           ["location", de ? "Standort" : "位置", device.location || ""],
           ["brand", de ? "Hersteller" : "品牌", device.brand || ""],
           ["model", de ? "Modell" : "型号", device.model || ""],
           ["warrantyUntil", de ? "Garantie bis" : "保修到期", device.warrantyUntil || ""]].map(([k, label, v]) => `
          <label class="hc-setting-field">
            <span class="hc-label">${label}</span>
            <input class="hc-input" data-haccp-dev-field="${k}" value="${haccpEsc(v)}" ${k === "warrantyUntil" ? 'type="date"' : ""}>
          </label>`).join("")}
        <label class="hc-setting-field">
          <span class="hc-label">${de ? "Wartungsstatus" : "维修状态"}</span>
          <select class="hc-input" data-haccp-dev-field="status">
            ${["正常", "待修", "维修中", "已停用"].map(v => `<option value="${v}" ${device.status === v ? "selected" : ""}>${haccpText(v)}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="card">
      <div class="section-title">
        <div>
          <h2>${de ? "Reparaturen" : "维修记录"}</h2>
          <p>${de ? "Bei Grenzwertüberschreitung hier den Auftrag anlegen — der Nachweis gehört zur Korrekturmaßnahme."
                  : "温度超标后在这里开维修单。维修记录本身就是纠正措施的证据。"}</p>
        </div>
        ${openRepair ? "" : `<button type="button" class="primary-btn" data-haccp-repair-open>+ ${de ? "Reparatur anlegen" : "开维修单"}</button>`}
      </div>

      <div class="hc-inline-panel" data-haccp-repair-panel hidden>
        <label class="hc-label">${de ? "Was ist das Problem?" : "什么问题？"}</label>
        <textarea class="hc-input hc-textarea" rows="2" data-haccp-repair-issue
          placeholder="${de ? "z. B. Temperatur steigt seit drei Wochen langsam an" : "例如：温度连续三周缓慢上升，怀疑密封条老化"}"></textarea>
        <label class="hc-label" style="margin-top:10px">${de ? "Fachfirma / Kontakt" : "维修方 / 联系人"}</label>
        <input class="hc-input" data-haccp-repair-vendor placeholder="${de ? "optional" : "选填"}">
        <div class="button-row">
          <span class="hc-void-hint" data-haccp-repair-hint>${de ? "Problembeschreibung erforderlich" : "问题描述必填"}</span>
          <button type="button" class="ghost-btn" data-haccp-repair-cancel>${de ? "Abbrechen" : "取消"}</button>
          <button type="button" class="primary-btn" data-haccp-repair-submit disabled>${de ? "Anlegen" : "创建维修单"}</button>
        </div>
      </div>

      ${repairs.length ? `
        <div class="hc-repair-list">
          ${repairs.map(r => `
            <div class="hc-repair ${r.doneAt ? "is-done" : ""}">
              <div>
                <strong>${haccpEsc(r.issue)}</strong>
                <span>${de ? "angelegt" : "开单"} ${r.openedAt}${r.openedBy ? ` · ${haccpEsc(r.openedBy)}` : ""}${r.vendor ? ` · ${haccpEsc(r.vendor)}` : ""}${r.doneAt ? ` · ${de ? "erledigt" : "完成"} ${r.doneAt}` : ""}</span>
                ${r.result ? `<p class="hc-repair-result">${haccpEsc(r.result)}</p>` : ""}
              </div>
              ${r.doneAt
                ? `<span class="pill green">${de ? "erledigt" : "已完成"}</span>`
                : `<div class="hc-repair-close">
                     <input class="hc-input" data-haccp-repair-result="${r.id}" placeholder="${de ? "Was wurde gemacht?" : "做了什么处理？"}">
                     <button type="button" class="ghost-btn" data-haccp-repair-done="${r.id}">${de ? "Als erledigt" : "标记完成"}</button>
                   </div>`}
            </div>`).join("")}
        </div>` : `<p class="muted" style="margin-top:12px">${de ? "Noch keine Reparaturen." : "还没有维修记录。"}</p>`}
    </section>
   </div>`;
}

/* 派单：选完就存，不用再点保存 —— 这一格只有一个字段，一个「保存」按钮是多余的一步。 */
function haccpBindAssign() {
  document.querySelectorAll("[data-haccp-assign]").forEach(sel => {
    sel.addEventListener("change", () => {
      haccpSetAssignee(haccpCurrentStore(), sel.dataset.date, sel.dataset.haccpAssign, sel.value);
      sel.closest(".hc-assign")?.classList.toggle("is-set", !!sel.value);
    });
  });
}

function haccpBindQuickFill() {
  const de = haccpDe();
  document.querySelectorAll("[data-haccp-quick]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = document.querySelector(`[data-haccp-quick-panel="${button.dataset.haccpQuick}"]`);
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.classList.toggle("is-open", !panel.hidden);
      if (!panel.hidden) panel.querySelector("input, select")?.focus();
    });
  });

  document.querySelectorAll("[data-haccp-quick-panel]").forEach(panel => {
    const template = haccpTemplate(panel.dataset.template);
    if (!template) return;
    const date = panel.dataset.date;
    const values = {};
    template.columns.forEach(c => { values[c.id] = ""; });

    const box = panel.querySelector("[data-haccp-quick-corrective]");
    const why = panel.querySelector("[data-haccp-quick-why]");
    const corrective = panel.querySelector("[data-haccp-quick-corrective-input]");
    const status = panel.querySelector("[data-haccp-quick-status]");
    const submit = panel.querySelector("[data-haccp-quick-submit]");

    function refresh() {
      const reasons = [];
      template.columns.forEach(column => {
        const result = haccpCheck(column, values[column.id], values);
        const field = panel.querySelector(`[data-haccp-quick-input="${column.id}"]`)?.closest(".hc-quick-field");
        const verdict = panel.querySelector(`[data-haccp-quick-verdict="${column.id}"]`);
        if (!field || !verdict) return;
        field.classList.remove("is-breach", "is-warn");
        verdict.textContent = "";
        if (result.level === "breach") {
          field.classList.add("is-breach");
          verdict.textContent = result.message;
          reasons.push(`${haccpText(column.label)}：${result.message}`);
        } else if (result.level === "warn") {
          field.classList.add("is-warn");
          verdict.textContent = result.message;
        }
      });
      const check = haccpCheckRow(template, values);
      box.hidden = !check.hasBreach;
      why.textContent = reasons.join("；");
      const needCorrective = check.hasBreach && !corrective.value.trim();
      submit.disabled = check.missing.length > 0 || needCorrective;
      status.textContent = check.missing.length
        ? (de ? `${check.missing.length} offen` : `还差 ${check.missing.length} 项`)
        : needCorrective ? (de ? "Korrektur nötig" : "请填纠正措施")
        : (de ? "bereit" : "可以提交");
      status.className = "hc-quick-status" + (check.missing.length ? "" : needCorrective ? " is-crit" : " is-ok");
    }

    panel.querySelectorAll("[data-haccp-quick-input]").forEach(input => {
      const ev = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(ev, () => { values[input.dataset.haccpQuickInput] = input.value.trim(); refresh(); });
    });
    corrective.addEventListener("input", refresh);

    submit.addEventListener("click", () => {
      const check = haccpCheckRow(template, values);
      if (check.missing.length) return;
      if (check.hasBreach && !corrective.value.trim()) return;
      haccpSaveEntry({
        id: `hc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        templateId: template.id, templateVersion: template.version,
        store: haccpCurrentStore(), date,
        header: Object.assign({}, template.header || {}),
        values: JSON.parse(JSON.stringify(values)),
        breaches: check.breaches, hasBreach: check.hasBreach,
        corrective: corrective.value.trim(),
        filledBy: haccpCurrentUser(), filledAt: new Date().toISOString(),
        status: check.hasBreach ? "有异常待处理" : "已记录",
        controlBy: null, controlAt: null
      });
      haccpPendingToast = {
        tone: check.hasBreach ? "warn" : "ok",
        message: check.hasBreach
          ? (de ? "Erfasst — Abweichung vermerkt." : `${haccpText(template.name)} 已提交，异常已记录。`)
          : (de ? "Erfasst." : `${haccpText(template.name)} 已提交。`)
      };
      if (typeof app === "function") app();
    });

    refresh();
  });
}

function haccpBindDeviceAdd() {
  const de = haccpDe();
  const panel = document.querySelector("[data-haccp-dev-panel]");
  if (!panel) return;
  const name = panel.querySelector("[data-haccp-dev-new-name]");
  const save = panel.querySelector("[data-haccp-dev-save]");
  document.querySelector("[data-haccp-dev-add]").addEventListener("click", () => {
    panel.hidden = false; name.focus();
  });
  panel.querySelector("[data-haccp-dev-cancel]").addEventListener("click", () => { panel.hidden = true; });
  name.addEventListener("input", () => { save.disabled = !name.value.trim(); });
  save.addEventListener("click", () => {
    if (!name.value.trim()) return;
    const linkRaw = panel.querySelector("[data-haccp-dev-new-link]").value;
    const [templateId, columnId] = linkRaw ? linkRaw.split("|") : [null, null];
    haccpSaveDevice({
      id: `dev-${Date.now().toString(36)}`,
      name: { zh: name.value.trim() },
      store: haccpCurrentStore(),
      type: { zh: "冷藏设备", de: "Kühlgerät" },
      location: panel.querySelector("[data-haccp-dev-new-loc]").value.trim(),
      brand: "", model: "", warrantyUntil: "",
      link: templateId ? { templateId, columnId } : null,
      status: "正常", repairs: []
    });
    haccpPendingToast = { tone: "ok", message: de ? "Gerät angelegt." : "设备已添加。" };
    if (typeof app === "function") app();
  });
}

function haccpBindDevice() {
  const root = document.querySelector("[data-haccp-device]");
  if (!root) return;
  const de = haccpDe();
  const device = haccpDevice(root.dataset.haccpDevice);
  if (!device) return;
  const hint = root.querySelector("[data-haccp-dev-hint]");

  /* 资料字段：改完即存，不做保存按钮 —— 这类台账没人愿意点两次 */
  root.querySelectorAll("[data-haccp-dev-field]").forEach(input => {
    const commit = () => {
      const key = input.dataset.haccpDevField;
      if (key === "name.zh") device.name = Object.assign({}, device.name, { zh: input.value });
      else device[key] = input.value;
      haccpSaveDevice(device);
      hint.textContent = de ? "gespeichert" : "已保存";
      hint.className = "hc-save-hint is-on";
      setTimeout(() => { hint.className = "hc-save-hint"; }, 1600);
    };
    input.addEventListener("change", commit);
  });

  const panel = root.querySelector("[data-haccp-repair-panel]");
  const issue = root.querySelector("[data-haccp-repair-issue]");
  const submit = root.querySelector("[data-haccp-repair-submit]");
  root.querySelector("[data-haccp-repair-open]")?.addEventListener("click", () => {
    panel.hidden = false; issue.focus();
  });
  root.querySelector("[data-haccp-repair-cancel]")?.addEventListener("click", () => { panel.hidden = true; });
  issue?.addEventListener("input", () => { submit.disabled = !issue.value.trim(); });
  submit?.addEventListener("click", () => {
    if (!issue.value.trim()) return;
    device.repairs = device.repairs || [];
    device.repairs.push({
      id: `rp-${Date.now().toString(36)}`,
      issue: issue.value.trim(),
      vendor: root.querySelector("[data-haccp-repair-vendor]").value.trim(),
      openedAt: haccpToday(), openedBy: haccpCurrentUser(), doneAt: null, result: ""
    });
    device.status = "待修";
    haccpSaveDevice(device);
    haccpPendingToast = { tone: "warn", message: de ? "Reparatur angelegt." : "维修单已创建，设备状态改为「待修」。" };
    if (typeof app === "function") app();
  });

  root.querySelectorAll("[data-haccp-repair-done]").forEach(button => {
    button.addEventListener("click", () => {
      const rid = button.dataset.haccpRepairDone;
      const repair = (device.repairs || []).find(r => r.id === rid);
      if (!repair) return;
      repair.doneAt = haccpToday();
      repair.result = root.querySelector(`[data-haccp-repair-result="${rid}"]`).value.trim();
      if (!(device.repairs || []).some(r => !r.doneAt)) device.status = "正常";
      haccpSaveDevice(device);
      haccpPendingToast = { tone: "ok", message: de ? "Reparatur abgeschlossen." : "维修已完成，设备恢复正常。" };
      if (typeof app === "function") app();
    });
  });
}

/* ========================================================== 月度表 ======== */
/* 卫生局检查的主场景：一屏看完整月，长得跟原来那张纸一样，能打印。
   月度网格是原表的天然形态（1–31 天每天一行），流水表则按记录逐条列。 */
function haccpMonthKey(dateStr) { return dateStr.slice(0, 7); }

/* 月度表和检查模式的默认月份。
   这两页的用途都是「回头看」——月底存档打印上个月、卫生局上门查最近几个月，
   没人在 1 号打开月度表看当月。默认当月的结果是：每个月 1 号打开必定是空页，
   而上个月满满一张表就在旁边。所以当月没有记录时，落到最近有记录的那个月。
   templateId 传入时只看那张表的记录（月度表是按表切的）。 */
function haccpLatestMonthWithData(store, templateId) {
  const now = haccpMonthKey(haccpToday());
  const months = haccpEntries()
    .filter(e => !e.voided && e.store === store && (!templateId || e.templateId === templateId))
    .map(e => haccpMonthKey(e.date))
    .filter(m => m <= now);
  if (!months.length) return now;
  if (months.includes(now)) return now;
  return months.sort().pop();
}

function haccpShiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function haccpDaysInMonth(monthStr) {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/* 月度网格是「一天一行」的纸表形态，但同一天完全可以有第二条记录 ——
   填表页自己就写着「再次提交会作为一条新增记录保存」。
   以前这里是 byDay[day] = e，后写覆盖先写：早上 9 点记的超标
   会被晚上 18 点那条正常记录顶掉，在月度表和卫生局检查模式里彻底看不见。
   现在：有异常的那条优先占这一行（异常永远藏不住），其余的用「+N」标出来。 */
function haccpByDay(rows) {
  const map = {};
  rows.forEach(e => {
    const day = Number(e.date.slice(8, 10));
    if (!map[day]) { map[day] = { entry: e, extra: 0 }; return; }
    map[day].extra += 1;
    const cur = map[day].entry;
    if (e.hasBreach && !cur.hasBreach) map[day].entry = e;
    else if (!!e.hasBreach === !!cur.hasBreach
      && (e.filledAt || "") > (cur.filledAt || "")) map[day].entry = e;
  });
  return map;
}

/* 月度表和检查模式渲染的是同一种东西 —— 一张表的一个月，长得跟原来那张纸一样。
   区别只有范围（一张 vs 全部 7 张）和模式（可操作 vs 只读）。
   以前各写了一份：160 行里 52 行逐行相同，修「同日第二条记录被顶掉」那个 bug 时
   得改两个地方，改一处漏一处只是时间问题。现在合成一个。
   opts.compact = 检查模式：状态列用 ✓ 而不是药丸、不给「去填这张表」按钮、
                  加记录数、给一条「单独看这张 ›」回月度表。 */
function haccpSheetMarkup(template, month, store, opts) {
  const de = haccpDe();
  const o = opts || {};
  const cols = template.columns || [];
  const list = haccpEntries()
    .filter(e => !e.voided && e.templateId === template.id && e.store === store && e.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.filledAt || "").localeCompare(b.filledAt || ""));
  const head = list.length && list[0].header ? list[0].header : (template.header || {});
  const isGrid = template.layout === "monthly-grid";

  const cell = (entry, column) => {
    if (!entry) return "";
    const bad = (entry.breaches || []).includes(column.id);
    const shown = haccpDisplayValue(column, entry.values[column.id]);
    if (shown === "—") return o.compact ? "" : `<span class="muted">—</span>`;
    const unit = column.type === "temp" ? (column.unit || "") : "";
    /* 打印出来是黑白的，红色就没了 —— 超标格额外加符号，做双重编码 */
    return `<span class="${bad ? "hc-cell-bad" : ""}">${shown}${haccpEsc(unit)}${bad ? '<b class="hc-cell-mark" aria-label="超标">!</b>' : ""}</span>`;
  };

  const done = entry => entry && (entry.status === "已确认" || entry.status === "已处理");
  const statusCell = entry => {
    if (!entry) return "";
    if (o.compact) return done(entry) ? "✓" : "";
    return `<span class="pill ${done(entry) ? "green" : entry.hasBreach ? "red" : "blue"}">${haccpText(entry.status)}</span>`;
  };

  /* 同一天的第二条记录不能被藏起来 —— 纸表一天只有一行，所以给个可点的 +N */
  const moreMark = slot => !slot || !slot.extra ? "" : (o.compact
    ? `<b class="hc-mmore">+${slot.extra}</b>`
    : `<a class="hc-mmore" href="#${slug("store", "HACCP记录")}?t=${encodeURIComponent(template.id)}&m=${month}" title="${de ? "weitere Einträge an diesem Tag" : "这一天还有别的记录"}">+${slot.extra}</a>`);

  const tr = (entry, dayLabel, slot) => `
    <tr class="${entry ? (entry.hasBreach ? "hc-mrow-bad" : "") : "hc-mrow-empty"}">
      <td class="hc-mday">${dayLabel}${moreMark(slot)}</td>
      ${cols.map(c => `<td>${cell(entry, c)}</td>`).join("")}
      <td class="hc-mcorr">${entry ? haccpEsc(entry.corrective) : ""}</td>
      <td>${entry ? haccpEsc(entry.filledBy) : ""}</td>
      <td>${statusCell(entry)}</td>
    </tr>`;

  let body;
  if (isGrid) {
    const byDay = haccpByDay(list);
    body = Array.from({ length: haccpDaysInMonth(month) }, (_, i) => {
      const slot = byDay[i + 1];
      return tr(slot && slot.entry, String(i + 1), slot);
    }).join("");
  } else {
    body = list.length
      ? list.map(e => tr(e, e.date.slice(5), null)).join("")
      : `<tr><td colspan="${cols.length + 4}" class="muted" style="text-align:center;padding:${o.compact ? 18 : 26}px">
           ${de ? "keine Einträge" : "本月无记录"}</td></tr>`;
  }
  /* 一张全空的 31 行网格没有信息量，只是让人以为系统坏了 */
  if (isGrid && !list.length) {
    body = `<tr><td colspan="${cols.length + 4}" class="hc-mempty">
      <strong>${de ? "Für diesen Monat liegen keine Einträge vor." : "本月没有记录。"}</strong>
      ${o.compact ? "" : `<a class="primary-btn" href="#${slug("store", "HACCP填写")}?t=${encodeURIComponent(template.id)}">${de ? "Jetzt erfassen" : "去填这张表"}</a>`}
    </td></tr>`;
  }

  return {
    rows: list,
    html: `
      <section class="${o.compact ? "hc-isheet" : "card hc-msheet"}">
        <div class="hc-msheet-head">
          <h2>${haccpText(template.name)}</h2>
          <p>${haccpEsc(template.name.en)}</p>
          <div class="hc-msheet-meta">
            <span><em>Operation:</em> ${haccpEsc(head.operation) || haccpEsc(store)}</span>
            <span><em>Inspector:</em> ${haccpEsc(head.inspector) || "—"}</span>
            ${template.layout === "training"
              ? `<span><em>Referent:</em> ${haccpEsc(head.referent) || "—"}</span><span><em>Topic:</em> ${haccpEsc(head.topic) || "—"}</span>`
              : ""}
            <span><em>${de ? "Monat" : "月份"}:</em> ${month}</span>
            ${o.compact ? `<span><em>${de ? "Einträge" : "记录数"}:</em> ${list.length}</span>` : ""}
            ${o.signLine ? `<span><em>${de ? "Freigabe" : "月度核对"}:</em> ${o.signLine}</span>` : ""}
          </div>
          ${o.compact ? `<a class="hc-isheet-link hc-noprint" href="#${slug("store", "HACCP月度表")}?t=${encodeURIComponent(template.id)}&m=${month}">${de ? "einzeln ansehen ›" : "单独看这张 ›"}</a>` : ""}
        </div>
        <div class="hc-mtablewrap">
          <table class="table hc-mtable">
            <thead><tr>
              <th class="hc-mday">${de ? "Datum" : "日期"}</th>
              ${cols.map(c => `<th>${haccpText(c.label)}${c.type === "temp" && c.unit ? ` <small>${haccpEsc(c.unit)}</small>` : ""}</th>`).join("")}
              <th>${de ? "Korrekturmaßnahme" : "纠正措施"}</th>
              <th>${de ? "Erfasst von" : "填写人"}</th>
              <th>${de ? "Status" : "状态"}</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        ${(template.footnotes || []).length
          ? `<div class="hc-mfoot">${(template.footnotes || []).map(n => `<p>${haccpText(n)}</p>`).join("")}</div>`
          : ""}
      </section>`
  };
}

function haccpMonthlyPage() {
  const de = haccpDe();
  const params = state().params;
  const store = haccpCurrentStore();
  const templates = haccpTemplates();
  const templateId = params.get("t") || (templates[0] && templates[0].id) || "";
  const month = params.get("m") || haccpLatestMonthWithData(store, templateId);
  const template = haccpTemplate(templateId);
  const base = `#${slug("store", "HACCP月度表")}`;

  if (!template) {
    return `<div data-no-translate class="hc-page"><div class="page-head"><div><h1>${de ? "Kein Formular" : "没有可用表单"}</h1></div></div>
      <div class="card"><a class="primary-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Zurück" : "返回 HACCP"}</a></div></div>`;
  }

  const sheet = haccpSheetMarkup(template, month, store, {
    /* 打印出来交给卫生局时，签核人和时间要在纸上 */
    signLine: (() => {
      const sg = haccpSignoff(store, month);
      return sg ? `${haccpEsc(sg.by)} · ${haccpStamp(sg.at)}` : (haccpDe() ? "offen" : "未核对");
    })()
  });
  const rows = sheet.rows;
  const filled = rows.length;
  const breaches = rows.filter(e => e.hasBreach).length;
  const open = rows.filter(haccpIsOpen).length;
  /* 月度签核是整月一次，跟当前看的是哪张表无关 —— 它签的是「这个月的资料我核过了」 */
  const sign = haccpSignoff(store, month);
  const monthOpen = haccpEntries()
    .filter(e => e.store === store && e.date.startsWith(month) && haccpIsOpen(e)).length;

  return `
    <div data-no-translate class="hc-page hc-monthly">
      <div class="page-head hc-noprint">
        <div>
          <h1>${de ? "Monatsübersicht" : "月度表"}</h1>
          <p>${haccpText(template.name)} · ${store} · ${month}</p>
        </div>
        <div class="button-row">
          <a class="ghost-btn accent-back-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Zurück" : "返回 HACCP"}</a>
          <button type="button" class="ghost-btn" data-haccp-export="${template.id}" data-month="${month}">${de ? "CSV exportieren" : "导出 CSV"}</button>
          <!-- 这一页是「一张表的一个月」；整月全套在检查模式。关系写在页面上，不靠导航猜 -->
          <a class="ghost-btn" href="#${slug("store", "HACCP检查模式")}?m=${month}">${de ? `Alle ${templates.length} Formulare` : `全部 ${templates.length} 张表 ›`}</a>
          <button type="button" class="primary-btn" data-haccp-print>${de ? "Drucken / PDF" : "打印 / 存 PDF"}</button>
        </div>
      </div>

      <div class="hc-mtoolbar hc-noprint">
        <select class="hc-input hc-mselect" data-haccp-month-template>
          ${templates.map(t => `<option value="${t.id}" ${t.id === template.id ? "selected" : ""}>${haccpText(t.name)}</option>`).join("")}
        </select>
        <div class="hc-mnav">
          <a class="hc-daynav" href="${base}?t=${encodeURIComponent(template.id)}&m=${haccpShiftMonth(month, -1)}">‹</a>
          <strong>${month}</strong>
          <a class="hc-daynav" href="${base}?t=${encodeURIComponent(template.id)}&m=${haccpShiftMonth(month, 1)}">›</a>
        </div>
        <div class="hc-mstats">
          <span>${de ? "Einträge" : "记录"} <b>${filled}</b></span>
          <span class="${open ? "is-warn" : ""}">${de ? "offen" : "待处理"} <b>${open}</b></span>
          <span class="${breaches ? "is-crit" : ""}">${de ? "Abweichungen" : "异常"} <b>${breaches}</b></span>
        </div>
      </div>

      <!-- 月度签核：取代逐条复核。签的是整月，不是某一张表。 -->
      <section class="hc-signoff ${sign ? "is-signed" : ""}" data-haccp-signoff="${month}">
        <div class="hc-signoff-main">
          <strong>${sign
            ? (de ? `${month} freigegeben` : `${month} 已核对`)
            : (de ? `${month} noch nicht freigegeben` : `${month} 还没有核对`)}</strong>
          <span>${sign
            ? `${de ? "von" : "核对人"} ${haccpEsc(sign.by)} · ${haccpStamp(sign.at)}${sign.note ? ` · ${haccpEsc(sign.note)}` : ""}`
            : monthOpen
              ? (de ? `${monthOpen} Abweichung(en) noch offen — zuerst abschließen.`
                    : `本月还有 ${monthOpen} 条异常没处理，建议先处理完再核对。`)
              : (de ? "Alle Formulare dieses Monats auf einmal gegenzeichnen."
                    : "月底核对一次，覆盖本月全部表单 —— 不需要逐条确认。")}</span>
        </div>
        ${sign
          ? `<button type="button" class="ghost-btn" data-haccp-unsign="${month}">${de ? "Freigabe zurücknehmen" : "撤销核对"}</button>`
          : `<button type="button" class="primary-btn" data-haccp-sign="${month}">${de ? "Monat freigeben" : "核对本月"}</button>`}
      </section>

      ${sheet.html}
    </div>`;
}

function haccpBindReview() {
  const de = haccpDe();

  /* 确认：直接生效。要写备注的话展开行内输入框，不弹窗。 */
  document.querySelectorAll("[data-haccp-review]").forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.haccpReview;
      const id = button.dataset.id;
      const card = button.closest(".hc-record");

      if (action === "void") {
        const panel = card.querySelector("[data-haccp-void-panel]");
        panel.hidden = false;
        panel.querySelector("textarea").focus();
        return;
      }
      haccpReviewEntry(id, action, "");
      haccpPendingToast = {
        tone: "ok",
        message: action === "reopen"
          ? (de ? "Abschluss zurückgenommen." : "已撤销处理。")
          : (de ? "Abweichung abgeschlossen." : "异常已标记处理。")
      };
      if (typeof app === "function") app();
    });
  });

  /* 作废：行内面板，理由必填 */
  document.querySelectorAll("[data-haccp-void-panel]").forEach(panel => {
    const textarea = panel.querySelector("textarea");
    const submit = panel.querySelector("[data-haccp-void-submit]");
    const cancel = panel.querySelector("[data-haccp-void-cancel]");
    const hint = panel.querySelector("[data-haccp-void-hint]");
    const sync = () => { submit.disabled = !textarea.value.trim(); };
    textarea.addEventListener("input", () => {
      sync();
      hint.textContent = textarea.value.trim() ? "" : (de ? "Grund erforderlich" : "作废必须写明理由");
    });
    cancel.addEventListener("click", () => { panel.hidden = true; textarea.value = ""; sync(); });
    submit.addEventListener("click", () => {
      if (!textarea.value.trim()) return;
      haccpReviewEntry(panel.dataset.haccpVoidPanel, "void", textarea.value.trim());
      haccpPendingToast = { tone: "warn", message: de ? "Eintrag storniert." : "记录已作废，理由已留档。" };
      if (typeof app === "function") app();
    });
    sync();
  });

  /* 备注：可选，展开写 */
  document.querySelectorAll("[data-haccp-note-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = button.closest(".hc-record").querySelector("[data-haccp-note-panel]");
      panel.hidden = !panel.hidden;
      if (!panel.hidden) panel.querySelector("textarea").focus();
    });
  });
  document.querySelectorAll("[data-haccp-note-submit]").forEach(button => {
    button.addEventListener("click", () => {
      const panel = button.closest("[data-haccp-note-panel]");
      haccpReviewEntry(panel.dataset.haccpNotePanel, "confirm", panel.querySelector("textarea").value.trim());
      haccpPendingToast = { tone: "ok", message: de ? "Abgeschlossen — Notiz gespeichert." : "已标记处理，备注已留档。" };
      if (typeof app === "function") app();
    });
  });

  document.querySelectorAll("[data-haccp-jump]").forEach(select => {
    select.addEventListener("change", () => {
      const key = select.dataset.haccpJump;
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      if (select.value) params.set(key, select.value); else params.delete(key);
      params.delete("p");
      const qs = params.toString();
      location.hash = slug("store", "HACCP记录") + (qs ? `?${qs}` : "");
    });
  });

  document.querySelectorAll("[data-haccp-export]").forEach(button => {
    /* 不需要防重复绑定：app() 每次都重建 #app 的 innerHTML，
       元素是新的，dataset.bound 永远不存在。 */
    button.addEventListener("click", () => haccpExportCsv(button.dataset.haccpExport, button.dataset.month || ""));
  });
}

function haccpBindMonthly() {
  const select = document.querySelector("[data-haccp-month-template]");
  if (select) {
    select.addEventListener("change", () => {
      /* 换表时不带 m —— 让新表自己落到它最近有记录的月份，
         否则会把当前这张表的月份钉到一张那个月根本没记录的表上。 */
      const month = new URLSearchParams(location.hash.split("?")[1] || "").get("m") || "";
      location.hash = `${slug("store", "HACCP月度表")}?t=${encodeURIComponent(select.value)}${month ? `&m=${month}` : ""}`;
    });
  }
  document.querySelector("[data-haccp-print]")?.addEventListener("click", () => window.print());

  const de = haccpDe();
  const signBtn = document.querySelector("[data-haccp-sign]");
  if (signBtn) signBtn.addEventListener("click", () => {
    const month = signBtn.dataset.haccpSign;
    haccpSetSignoff(haccpCurrentStore(), month, true);
    haccpPendingToast = { tone: "ok",
      message: de ? `${month} freigegeben.` : `${month} 已核对，核对人和时间已留档。` };
    if (typeof app === "function") app();
  });
  const unsignBtn = document.querySelector("[data-haccp-unsign]");
  if (unsignBtn) unsignBtn.addEventListener("click", () => {
    haccpSetSignoff(haccpCurrentStore(), unsignBtn.dataset.haccpUnsign, false);
    haccpPendingToast = { tone: "warn", message: de ? "Freigabe zurückgenommen." : "已撤销本月核对。" };
    if (typeof app === "function") app();
  });
}

/* CSV 导出：Excel 中文乱码是常见坑，加 BOM */
function haccpExportCsv(templateId, month) {
  const de = haccpDe();
  const template = haccpTemplate(templateId);
  const store = haccpCurrentStore();
  /* URL 是可以被复制、收藏、手改的。?t= 指到一张已删除或不存在的表时，
     以前这里直接 template.columns 抛错，导出按钮变成哑弹。 */
  if (!template) {
    haccpToast(de ? "Formular nicht gefunden." : "找不到这张表，可能已被删除。", "warn");
    return;
  }
  const rows = haccpEntries()
    .filter(e => !e.voided && e.templateId === templateId && e.store === store && (!month || e.date.startsWith(month)))
    .sort((a, b) => a.date.localeCompare(b.date));

  const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const head = [de ? "Datum" : "日期", ...template.columns.map(c => haccpText(c.label) + (c.unit ? `(${c.unit})` : "")),
                de ? "Korrekturmaßnahme" : "纠正措施", de ? "Erfasst von" : "填写人",
                de ? "Status" : "状态", de ? "Abgeschlossen von" : "处理人", "Version"];
  const lines = [head.map(esc).join(",")];
  rows.forEach(e => {
    const tpl = haccpTemplateAt(e.templateId, e.templateVersion);
    lines.push([e.date,
      ...template.columns.map(c => {
        const col = (tpl.columns || []).find(x => x.id === c.id) || c;
        const v = haccpDisplayValue(col, e.values[c.id]);
        return v === "—" ? "" : v;
      }),
      e.corrective || "", e.filledBy, e.status, e.controlBy || "", `v${e.templateVersion}`
    ].map(esc).join(","));
  });

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `HACCP_${templateId}_${month || "all"}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* 照片压缩：原图动辄几 MB，localStorage 只有约 5 MB，必须先缩。
   最长边 900px、JPEG 0.72，一张现场照约 60–120 KB。 */
function haccpShrinkImage(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      done(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => done("");
    img.src = reader.result;
  };
  reader.onerror = () => done("");
  reader.readAsDataURL(file);
}

/* 顶部轻提示，取代 alert。不阻塞、自动消失、可手动关。 */
let haccpPendingToast = null;

/* 跳转后才提示的场景（保存完回列表页）用这个 */
function haccpFlushToast() {
  if (!haccpPendingToast) return;
  const t = haccpPendingToast;
  haccpPendingToast = null;
  haccpToast(t.message, t.tone);
}

function haccpToast(message, tone) {
  document.querySelector(".hc-toast")?.remove();
  const el = document.createElement("div");
  el.className = `hc-toast is-${tone || "ok"}`;
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${message}</span><button type="button" aria-label="close">×</button>`;
  el.querySelector("button").addEventListener("click", () => el.remove());
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("is-in"));
  setTimeout(() => { el.classList.remove("is-in"); setTimeout(() => el.remove(), 250); }, 4200);
}


/* ======================================================== 卫生局模式 ====== */
/* 检查员站在旁边，屏幕转过去给他看。所以：只读、无操作按钮、按月一次给全、
   打印出来就是一叠可交的表。退出按钮做得小而明确，不会误触。 */
function haccpInspectionPage() {
  const de = haccpDe();
  const params = state().params;
  const store = haccpCurrentStore();
  const month = params.get("m") || haccpLatestMonthWithData(store, "");
  const templates = haccpTemplates();
  const base = `#${slug("store", "HACCP检查模式")}`;

  const sheet = template => haccpSheetMarkup(template, month, store, { compact: true }).html;

  const total = haccpEntries().filter(e => !e.voided && e.store === store && e.date.startsWith(month)).length;

  return `
   <div data-no-translate class="hc-page hc-inspection">
    <div class="hc-ibar hc-noprint">
      <div>
        <strong>${de ? "Prüfmodus" : "卫生局检查模式"}</strong>
        <span>${de ? "Nur Lesen. Alle HACCP-Nachweise dieses Monats auf einer Seite." : "只读视图。本月全部 HACCP 记录，一页给全。"}</span>
      </div>
      <div class="hc-imonth">
        <a class="hc-daynav" href="${base}?m=${haccpShiftMonth(month, -1)}">‹</a>
        <strong>${month}</strong>
        <a class="hc-daynav" href="${base}?m=${haccpShiftMonth(month, 1)}">›</a>
      </div>
      <div class="button-row">
        <button type="button" class="ghost-btn" data-haccp-print>${de ? "Drucken / PDF" : "打印 / 存 PDF"}</button>
        <a class="primary-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Prüfmodus verlassen" : "退出检查模式"}</a>
      </div>
    </div>

    <header class="hc-icover">
      <h1>${de ? "HACCP-Nachweise" : "HACCP 记录汇总"}</h1>
      <div class="hc-icover-meta">
        <span><em>${de ? "Betrieb" : "门店"}:</em> ${store}</span>
        <span><em>${de ? "Zeitraum" : "期间"}:</em> ${month}</span>
        <span><em>${de ? "Formulare" : "表单"}:</em> ${templates.length}</span>
        <span><em>${de ? "Einträge" : "记录"}:</em> ${total}</span>
        <span><em>${de ? "Erstellt" : "生成时间"}:</em> ${haccpToday()}</span>
      </div>
    </header>

    ${haccpReadinessBlock(store, month, templates)}

    ${total ? templates.map(sheet).join("") : `
      <section class="hc-allclear" style="margin-top:20px">
        <strong>${de ? "Für diesen Monat liegen noch keine Einträge vor." : "本月还没有任何记录。"}</strong>
        <span>${de ? "Sobald Einträge erfasst sind, erscheinen hier alle Formulare als druckbare Nachweise."
                   : "开始填表之后，这里会按月生成可直接打印的全部表单。"}</span>
      </section>`}
   </div>`;
}

/* 检查前的自查：哪张表本月缺记录、缺多少、一键去补。
   这块来自原来那张独立的「卫生局检查所需文件汇总」页 —— 那页零入站链接、
   和检查模式功能重叠，已合并到这里。打印时隐藏（自查是给自己看的，不给检查员看）。 */
function haccpReadinessBlock(store, month, templates) {
  const de = haccpDe();
  const isThisMonth = month === haccpMonthKey(haccpToday());
  const rows = templates.map(template => {
    const es = haccpEntries().filter(e => !e.voided && e.templateId === template.id
      && e.store === store && e.date.startsWith(month));
    const open = es.filter(haccpIsOpen).length;
    let expected = 0;
    if ((template.frequency || {}).kind === "daily") {
      expected = isThisMonth ? Number(haccpToday().slice(8, 10)) : haccpDaysInMonth(month);
    } else if (template.frequency.kind === "weekly") {
      expected = (template.frequency.times || 1) * 4;
    } else { expected = template.frequency.times || 1; }
    return { template, count: es.length, expected, open, gap: Math.max(0, expected - es.length) };
  });
  const gaps = rows.filter(r => r.gap > 0);
  const pending = rows.reduce((n, r) => n + r.open, 0);

  return `
    <section class="hc-readiness hc-noprint">
      <div class="hc-readiness-head">
        <h2>${de ? "Vor der Kontrolle prüfen" : "检查前自查"}</h2>
        ${(() => {
          /* 卫生局要看的一件事：这个月有没有人核对过。放在自查区最显眼处。 */
          const sign = haccpSignoff(store, month);
          return sign
            ? `<span class="pill green">${de ? `freigegeben · ${sign.by}` : `已核对 · ${haccpEsc(sign.by)}`}</span>`
            : `<a class="pill orange" href="#${slug("store", "HACCP月度表")}?m=${month}">${de ? "Monat noch nicht freigegeben" : "本月还没核对 ›"}</a>`;
        })()}
        <span class="pill ${gaps.length || pending ? "orange" : "green"}">
          ${gaps.length || pending
            ? (de ? `${gaps.length} Formular(e) unvollständig` : `${gaps.length} 张表不齐${pending ? ` · ${pending} 条异常未处理` : ""}`)
            : (de ? "vollständig" : "全部齐备")}
        </span>
      </div>
      <div class="hc-readiness-grid">
        ${rows.map(r => `
          <div class="hc-ready ${r.gap ? "is-gap" : ""}">
            <span class="hc-tpl-icon ${r.gap ? "is-crit" : ""}">${haccpTemplateIcon(r.template)}</span>
            <div>
              <strong>${haccpText(r.template.name)}</strong>
              <span>${r.count} / ${r.expected} ${de ? "erfasst" : "条"}${r.open ? ` · ${r.open} ${de ? "offen" : "异常未处理"}` : ""}</span>
            </div>
            ${r.gap
              ? `<a class="ghost-btn" href="#${slug("store", "HACCP填写")}?t=${encodeURIComponent(r.template.id)}">${de ? "nachtragen" : "补填"}</a>`
              : `<span class="hc-ready-ok">✓</span>`}
          </div>`).join("")}
      </div>
    </section>`;
}

/* ============================================================== 事件 ====== */
/* 培训表的提交：一次培训 → N 条参与记录，共用同一个表头（讲师、主题、日期） */
function haccpBindRoster(root, template, date) {
  const de = haccpDe();
  const rowsBox = root.querySelector("[data-haccp-roster-rows]");
  const guestInput = root.querySelector("[data-haccp-guest]");
  const statusEl = root.querySelector("[data-haccp-status]");
  const submitBtns = Array.from(root.querySelectorAll("[data-haccp-submit]"));
  const headerInputs = Array.from(root.querySelectorAll("[data-haccp-header]"));
  const fillerSelect = root.querySelector("[data-haccp-filler]");
  const dateInput = root.querySelector("[data-haccp-date]");
  const personCol = haccpRosterPersonColumn(template);
  const rest = (template.columns || []).filter(c => c !== personCol);
  const names = [];

  /* 姓名是自由输入 —— 「Anna "Anni" Weber」这种会撑破属性选择器。
     不再用 [data-name="…"] 反查，直接拿 Map 存元素引用。 */
  const rowEl = new Map();

  const emptyNote = () => {
    const p = rowsBox.querySelector(".hc-roster-empty");
    if (p) p.hidden = names.length > 0;
  };

  function renderRows() {
    [...rowEl.keys()].forEach(name => {
      if (names.includes(name)) return;
      rowEl.get(name).remove();
      rowEl.delete(name);
    });
    names.forEach(name => {
      if (rowEl.has(name)) return;
      rowsBox.insertAdjacentHTML("beforeend", haccpRosterRowMarkup(template, name));
      const row = rowsBox.lastElementChild;
      rowEl.set(name, row);
      row.querySelector("[data-haccp-roster-drop]").addEventListener("click", () => drop(name));
      row.querySelectorAll("[data-haccp-cell]").forEach(el => el.addEventListener("input", refresh));
      /* 签名列默认填本人姓名 —— 电脑端签名就是打名字，让人再打一遍没有意义 */
      rest.filter(c => c.type === "signature").forEach(c => {
        const el = row.querySelector(`[data-haccp-cell="${c.id}"]`);
        if (el && !el.value) el.value = name;
      });
    });
    emptyNote();
    refresh();
  }

  function drop(name) {
    const i = names.indexOf(name);
    if (i >= 0) names.splice(i, 1);
    const box = Array.from(root.querySelectorAll("[data-haccp-participant]"))
      .find(el => el.value === name);
    if (box) box.checked = false;
    renderRows();
  }

  function rowValues(name) {
    const row = rowEl.get(name);
    const values = {};
    (template.columns || []).forEach(c => { values[c.id] = c.type === "checklist" ? [] : ""; });
    if (personCol) values[personCol.id] = name;
    if (row) {
      rest.forEach(c => {
        const el = row.querySelector(`[data-haccp-cell="${c.id}"]`);
        values[c.id] = el ? el.value.trim() : "";
      });
    }
    return values;
  }

  function refresh() {
    const missingHeader = headerInputs.filter(i => i.dataset.required && !i.value.trim());
    missingHeader.forEach(i => i.classList.add("is-missing"));
    headerInputs.filter(i => i.value.trim()).forEach(i => i.classList.remove("is-missing"));

    let incomplete = 0;
    names.forEach(name => {
      const row = rowEl.get(name);
      if (!row) return;
      const check = haccpCheckRow(template, rowValues(name));
      row.classList.toggle("is-incomplete", check.missing.length > 0);
      if (check.missing.length) incomplete += 1;
    });

    const blocked = !names.length || missingHeader.length > 0 || incomplete > 0;
    submitBtns.forEach(b => { b.disabled = blocked; });
    if (!names.length) {
      statusEl.textContent = de ? "Mindestens eine Person auswählen" : "至少选一名参与人";
      statusEl.className = "hc-submit-status is-open";
    } else if (missingHeader.length) {
      statusEl.textContent = de ? "Formularkopf unvollständig" : `表头还有 ${missingHeader.length} 项必填未写`;
      statusEl.className = "hc-submit-status is-crit";
    } else if (incomplete) {
      statusEl.textContent = de ? `${incomplete} Zeile(n) unvollständig` : `还有 ${incomplete} 人的信息没填完`;
      statusEl.className = "hc-submit-status is-crit";
    } else {
      statusEl.textContent = de ? `${names.length} Einträge werden gespeichert` : `提交后会存 ${names.length} 条记录`;
      statusEl.className = "hc-submit-status is-ok";
    }
  }

  root.querySelectorAll("[data-haccp-participant]").forEach(box => {
    box.addEventListener("change", () => {
      if (box.checked) { if (!names.includes(box.value)) names.push(box.value); }
      else drop(box.value);
      renderRows();
    });
  });

  const addGuest = () => {
    const name = (guestInput.value || "").trim();
    if (!name || names.includes(name)) { guestInput.value = ""; return; }
    names.push(name);
    guestInput.value = "";
    renderRows();
  };
  root.querySelector("[data-haccp-guest-add]")?.addEventListener("click", addGuest);
  guestInput?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addGuest(); } });

  const header = {};
  headerInputs.forEach(i => { header[i.dataset.haccpHeader] = i.value.trim(); });
  headerInputs.forEach(i => i.addEventListener("input", () => {
    header[i.dataset.haccpHeader] = i.value.trim();
    refresh();
  }));
  dateInput?.addEventListener("change", refresh);

  submitBtns.forEach(btn => btn.addEventListener("click", () => {
    const when = dateInput && dateInput.value ? dateInput.value : date;
    if (!names.length) return;
    if (headerInputs.some(i => i.dataset.required && !i.value.trim())) return;
    let saved = 0;
    names.slice().forEach(name => {
      const values = rowValues(name);
      const check = haccpCheckRow(template, values);
      if (check.missing.length) return;
      haccpSaveEntry({
        id: `hc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${saved}`,
        templateId: template.id, templateVersion: template.version,
        store: haccpCurrentStore(), date: when,
        header: Object.assign({}, template.header || {}, header),
        values, breaches: check.breaches, hasBreach: check.hasBreach, corrective: "",
        filledBy: fillerSelect ? fillerSelect.value : haccpCurrentUser(),
        filledAt: new Date().toISOString(),
        status: "已记录", controlBy: null, controlAt: null
      });
      saved += 1;
    });
    haccpPendingToast = { tone: "ok",
      message: de ? `${saved} Teilnehmer erfasst.` : `已记录 ${saved} 名参与者的培训。` };
    location.hash = haccpExitHash();
    if (typeof app === "function") app();
  }));

  refresh();
}

function haccpBindFill() {
  const root = document.querySelector("[data-haccp-fill]");
  if (!root) return;

  const template = haccpTemplate(root.dataset.template);
  if (!template) return;
  const date = root.dataset.date;
  if (root.querySelector("[data-haccp-roster]")) { haccpBindRoster(root, template, date); return; }
  const values = {};
  /* 员工在自己那一侧填派给他的表：执行人默认就是他 —— 界面上那一格已经写着他的名字，
     值也要跟着预置，否则那一格算「还没填」，提交按钮永远不亮。（2026-09-04） */
  const filler = haccpInMeShell() && typeof meEmp === "function" ? meEmp() : null;
  const fillerName = filler && haccpPeople().includes(filler.name) ? filler.name : "";
  template.columns.forEach(column => {
    values[column.id] = column.type === "checklist" ? []
      : (column.type === "person" && fillerName) ? fillerName
      : "";
  });

  const fillerSelect = root.querySelector("[data-haccp-filler]");
  const headerInputs = Array.from(root.querySelectorAll("[data-haccp-header]"));
  const header = {};
  headerInputs.forEach(input => { header[input.dataset.haccpHeader] = input.value.trim(); });

  const correctiveBox = root.querySelector("[data-haccp-corrective]");
  const correctiveWhy = root.querySelector("[data-haccp-corrective-why]");
  const correctiveInput = root.querySelector("[data-haccp-corrective-input]");
  const statusEl = root.querySelector("[data-haccp-status]");
  const submitBtns = Array.from(root.querySelectorAll("[data-haccp-submit]"));
  const submitBtn = { set disabled(v) { submitBtns.forEach(b => { b.disabled = v; }); },
                      get disabled() { return submitBtns[0] ? submitBtns[0].disabled : true; } };
  const de = haccpDe();

  function refresh() {
    const reasons = [];
    template.columns.forEach(column => {
      const result = haccpCheck(column, values[column.id], values);
      const field = root.querySelector(`[data-haccp-field="${column.id}"]`);
      const verdict = root.querySelector(`[data-haccp-verdict="${column.id}"]`);
      if (!field || !verdict) return;
      field.classList.remove("is-breach", "is-warn", "is-ok");
      if (result.level === "breach") {
        field.classList.add("is-breach");
        verdict.textContent = result.message;
        reasons.push(`${haccpText(column.label)}：${result.message}`);
      } else if (result.level === "warn") {
        field.classList.add("is-warn");
        verdict.textContent = result.message;
      } else if (result.level === "ok" && values[column.id] !== "" && (!Array.isArray(values[column.id]) || values[column.id].length)) {
        field.classList.add("is-ok");
        /* 只有真的有临界值的字段才说「在临界值内」；
           供应商、商品类别这类选项字段没有限值，说这句是错的 */
        const hasLimit = !!(column.limit || column.limitBy || column.breachOn || column.requireAll);
        verdict.textContent = hasLimit ? (de ? "im Grenzwert" : "在临界值内") : "";
      } else {
        verdict.textContent = "";
      }
    });

    const missingHeader = headerInputs.filter(i => i.dataset.required && !i.value.trim());
    missingHeader.forEach(i => i.classList.add("is-missing"));
    headerInputs.filter(i => i.value.trim()).forEach(i => i.classList.remove("is-missing"));

    const check = haccpCheckRow(template, values);
    if (check.hasBreach) {
      correctiveBox.hidden = false;
      correctiveWhy.textContent = reasons.join("；");
    } else {
      correctiveBox.hidden = true;
    }

    const needCorrective = check.hasBreach && !correctiveInput.value.trim();
    const blocked = check.missing.length > 0 || needCorrective || missingHeader.length > 0;
    submitBtn.disabled = blocked;
    if (missingHeader.length) {
      statusEl.textContent = de ? "Formularkopf unvollständig" : `表头还有 ${missingHeader.length} 项必填未写`;
      statusEl.className = "hc-submit-status is-crit";
    } else if (check.missing.length) {
      statusEl.textContent = de ? `${check.missing.length} Feld(er) offen` : `还有 ${check.missing.length} 项未填`;
      statusEl.className = "hc-submit-status is-open";
    } else if (needCorrective) {
      statusEl.textContent = de ? "Korrekturmaßnahme erforderlich" : "请先填写纠正措施";
      statusEl.className = "hc-submit-status is-crit";
    } else {
      statusEl.textContent = de ? "Bereit zum Absenden" : "可以提交";
      statusEl.className = "hc-submit-status is-ok";
    }
  }

  root.querySelectorAll("[data-haccp-input]").forEach(input => {
    input.addEventListener("input", () => {
      values[input.dataset.haccpInput] = input.value.trim();
      refresh();
    });
  });

  /* 「不是我做的」：把名单展开，那一句收起来。真要换人的时候才多这一步。 */
  root.querySelectorAll("[data-haccp-swap]").forEach(button => {
    button.addEventListener("click", () => {
      const field = button.closest(".hc-field");
      if (!field) return;
      field.classList.remove("is-mine");
      field.querySelector(".hc-mine")?.remove();
      const box = field.querySelector(".hc-choices");
      if (box) { box.hidden = false; box.querySelector(".hc-choice")?.focus(); }
    });
  });

  root.querySelectorAll("[data-haccp-choice]").forEach(button => {
    button.addEventListener("click", () => {
      const columnId = button.dataset.haccpChoice;
      values[columnId] = button.dataset.value;
      root.querySelectorAll(`[data-haccp-choice="${columnId}"]`).forEach(sibling => {
        sibling.classList.toggle("is-on", sibling === button);
      });
      refresh();
    });
  });

  root.querySelectorAll("[data-haccp-check]").forEach(box => {
    box.addEventListener("change", () => {
      const columnId = box.dataset.haccpCheck;
      const checked = Array.from(root.querySelectorAll(`[data-haccp-check="${columnId}"]:checked`)).map(el => el.value);
      values[columnId] = checked;
      refresh();
    });
  });

  root.querySelectorAll("[data-haccp-photo]").forEach(input => {
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const columnId = input.dataset.haccpPhoto;
      const preview = root.querySelector(`[data-haccp-photo-preview="${columnId}"]`);
      preview.innerHTML = `<span class="muted">${de ? "wird verarbeitet…" : "处理中…"}</span>`;
      haccpShrinkImage(file, dataUrl => {
        values[columnId] = dataUrl;
        preview.innerHTML = dataUrl
          ? `<img src="${dataUrl}" alt=""><button type="button" class="hc-photo-drop" data-haccp-photo-drop="${columnId}">${de ? "entfernen" : "移除"}</button>`
          : `<span class="muted">${de ? "Fehler beim Laden" : "读取失败"}</span>`;
        preview.querySelector("[data-haccp-photo-drop]")?.addEventListener("click", () => {
          values[columnId] = ""; preview.innerHTML = ""; input.value = ""; refresh();
        });
        refresh();
      });
    });
  });

  /* ---------------------------------------------- 快捷方式 ① 一键铺满 --- */
  const setChoice = (columnId, value) => {
    values[columnId] = value;
    root.querySelectorAll(`[data-haccp-choice="${columnId}"]`).forEach(el => {
      el.classList.toggle("is-on", el.dataset.value === value);
    });
  };
  const fillStandard = () => {
    let n = 0;
    haccpStandardColumns(template).forEach(column => {
      const std = haccpStandardValue(column);
      if (column.type === "checklist") {
        values[column.id] = std.slice();
        root.querySelectorAll(`[data-haccp-check="${column.id}"]`).forEach(box => { box.checked = true; });
      } else {
        setChoice(column.id, std);
      }
      n += 1;
    });
    refresh();
    if (n) haccpToast(de ? `${n} Punkte gesetzt — jetzt nur noch Ausnahmen ändern.`
                         : `已按标准填好 ${n} 项，改掉例外就能提交。`, "ok");
  };
  root.querySelector("[data-haccp-fill-standard]")?.addEventListener("click", fillStandard);

  /* ------------------------------------------ 快捷方式 ③ 带上次的非测量项 --- */
  Object.entries(haccpCarryOver(template, haccpCurrentStore())).forEach(([columnId, v]) => {
    const column = template.columns.find(c => c.id === columnId);
    if (!column) return;
    if (column.type === "choice" || column.type === "person") {
      const hit = root.querySelector(`[data-haccp-choice="${columnId}"][data-value="${CSS.escape(String(v))}"]`);
      if (hit) setChoice(columnId, String(v));
    } else {
      const el = root.querySelector(`[data-haccp-input="${columnId}"]`);
      if (el && !el.value) { el.value = v; values[columnId] = String(v); }
    }
  });

  /* -------------------------------------------- 快捷方式 ② 键盘一路填到底 --- */
  /* 员工拿测温枪走一圈回来打 5 个数，全程不该碰鼠标 */
  const flow = Array.from(root.querySelectorAll(".hc-fields [data-haccp-input]"));
  flow.forEach((el, i) => {
    el.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const next = flow.slice(i + 1).find(x => !x.value);
      if (next) { next.focus(); next.select && next.select(); return; }
      const btn = root.querySelector(".primary-btn[data-haccp-submit]");
      if (btn && !btn.disabled) btn.click();
    });
  });
  const firstEmpty = flow.find(el => !el.value);
  if (firstEmpty) setTimeout(() => firstEmpty.focus(), 0);

  correctiveInput.addEventListener("input", refresh);
  headerInputs.forEach(input => input.addEventListener("input", () => {
    header[input.dataset.haccpHeader] = input.value.trim();
    refresh();
  }));

  root.querySelectorAll("[data-haccp-setting]").forEach(input => {
    input.addEventListener("change", () => {
      const list = haccpAllVersions();
      const target = list.find(t => t.id === template.id && t.version === template.version);
      if (!target || !target.settings) return;
      const setting = target.settings.find(s => s.id === input.dataset.haccpSetting);
      if (setting) { setting.value = input.value; haccpWrite(HACCP_TPL_KEY, list); }
    });
  });

  root.querySelectorAll("[data-haccp-submit]").forEach(btn => btn.addEventListener("click", () => {
    const check = haccpCheckRow(template, values);
    if (check.missing.length) return;
    if (check.hasBreach && !correctiveInput.value.trim()) return;
    if (headerInputs.some(i => i.dataset.required && !i.value.trim())) return;

    haccpSaveEntry({
      id: `hc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      templateId: template.id,
      templateVersion: template.version,     /* 版本锁定：改版后旧记录仍按当时结构显示 */
      store: haccpCurrentStore(),
      date,
      header: JSON.parse(JSON.stringify(header)),
      values: JSON.parse(JSON.stringify(values)),
      breaches: check.breaches,
      hasBreach: check.hasBreach,
      corrective: correctiveInput.value.trim(),
      filledBy: fillerSelect ? fillerSelect.value : haccpCurrentUser(),
      filledAt: new Date().toISOString(),
      status: check.hasBreach ? "有异常待处理" : "已记录",
      controlBy: null,
      controlAt: null
    });

    const next = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.next : null;
    haccpPendingToast = { tone: check.hasBreach ? "warn" : "ok",
      message: haccpDe() ? "Eintrag gespeichert." : `${haccpText(template.name)} 已提交。` };
    location.hash = next
      ? haccpFillHash(`t=${next}&d=${date}`)
      : haccpExitHash();
  }));

  refresh();
}


/* ==========================================================================
   店长：表单管理与列编辑器
   --------------------------------------------------------------------------
   店长真正要改的不是表单结构，是「测量点」这几列 —— 每家店冷柜数量和叫法都不同。
   所以编辑器重心是加 / 删 / 改名 / 设临界值，不做通用拖拽表单构建器。
   保存 = 生成新版本（version + 1），旧版本保留，历史记录按 templateVersion 锁定（D7）。
   删除 = 停用 + 归档，绝不物理删除 —— 已有记录的表单被删掉会让卫生局资料出洞。
   ========================================================================== */

const HACCP_COL_TYPES = [
  { v: "temp", zh: "温度 / 数值", de: "Temperatur / Zahl" },
  { v: "choice", zh: "单选", de: "Auswahl" },
  { v: "checklist", zh: "勾选清单", de: "Checkliste" },
  { v: "text", zh: "文本", de: "Text" },
  { v: "person", zh: "人员", de: "Person" },
  { v: "signature", zh: "签名", de: "Unterschrift" },
  { v: "photo", zh: "照片", de: "Foto" }
];

/* 新列 id 必须全局唯一且不复用已删除列的 id，
   否则历史记录里旧列的值会被新列错认。 */
function haccpNextColumnId(template) {
  const used = new Set();
  haccpAllVersions().filter(t => t.id === template.id)
    .forEach(t => (t.columns || []).forEach(c => used.add(c.id)));
  (template.columns || []).forEach(c => used.add(c.id));
  let n = 1;
  while (used.has(`c${n}`)) n += 1;
  return `c${n}`;
}

/* 保存为新版本 */
function haccpSaveTemplateVersion(draft) {
  const list = haccpAllVersions();
  const maxVersion = list.filter(t => t.id === draft.id)
    .reduce((max, t) => Math.max(max, t.version || 1), 0);
  const next = Object.assign({}, draft, {
    version: maxVersion + 1,
  });
  list.push(next);
  haccpWrite(HACCP_TPL_KEY, list);
  return next;
}

/* 停用 / 启用：改的是最新版本的 status，不新增版本 */
function haccpSetTemplateStatus(id, status) {
  const list = haccpAllVersions();
  const latest = list.filter(t => t.id === id)
    .sort((a, b) => (b.version || 1) - (a.version || 1))[0];
  if (latest) { latest.status = status; haccpWrite(HACCP_TPL_KEY, list); }
}

function haccpDuplicateTemplate(id) {
  const source = haccpTemplate(id);
  if (!source) return null;
  const list = haccpAllVersions();
  let newId = `${source.id}-copy`;
  let n = 2;
  while (list.some(t => t.id === newId)) { newId = `${source.id}-copy${n}`; n += 1; }
  const copy = JSON.parse(JSON.stringify(source));
  copy.id = newId;
  copy.version = 1;
  copy.status = "启用";
  copy.createdAt = haccpToday();
  copy.name = Object.assign({}, source.name, {
    zh: `${haccpText(source.name)}（副本）`,
    de: source.name.de ? `${source.name.de} (Kopie)` : undefined
  });
  list.push(copy);
  haccpWrite(HACCP_TPL_KEY, list);
  return copy;
}

function haccpBlankTemplate() {
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: { zh: "", de: "", en: "" },
    layout: "log",
    frequency: { kind: "daily" },
    header: { operation: "", inspector: "" },
    columns: [{ id: "c1", label: { zh: "" }, type: "temp", unit: "°C", limit: {} }],
    footnotes: [],
    status: "启用",
    version: 0,          /* 保存时会变成 1 */
    createdAt: haccpToday()
  };
}

/* --------------------------------------------------------- 模板列表页 ---- */
function haccpTemplateListPage() {
  const de = haccpDe();
  const all = haccpTemplates(true).sort((a, b) => (a.status === b.status ? 0 : a.status === "启用" ? -1 : 1));

  const freqLabel = t => t.frequency.kind === "daily" ? (de ? "täglich" : "每日")
    : t.frequency.kind === "weekly" ? (de ? `${t.frequency.times}×/Woche` : `每周 ${t.frequency.times} 次`)
    : (de ? "jährlich" : "每年");

  return `
   <div data-no-translate class="hc-page">
    <div class="page-head">
      <div>
        <h1>${de ? "Formulare verwalten" : "表单管理"}</h1>
        <p>${de ? "Messpunkte umbenennen, hinzufügen oder entfernen und Grenzwerte anpassen. Jede Änderung erzeugt eine neue Version; bestehende Einträge behalten ihre alte Version."
                : "重命名、增加或删除测量点，调整临界值。每次保存生成新版本，已有记录仍按填写时的版本显示。"}</p>
      </div>
      <div class="button-row">
        <a class="ghost-btn accent-back-btn" href="#${slug("store", "HACCP 管理")}">${de ? "Zurück" : "返回 HACCP"}</a>
        <a class="primary-btn" href="#${slug("store", "HACCP表单编辑")}?id=new">+ ${de ? "Neues Formular" : "新建表单"}</a>
      </div>
    </div>

    <section class="card">
      <table class="table hc-tpl-table">
        <thead><tr>
          <th>${de ? "Formular" : "表单"}</th>
          <th>${de ? "Häufigkeit" : "频次"}</th>
          <th>${de ? "Messpunkte" : "测量点"}</th>
          <th>${de ? "Version" : "版本"}</th>
          <th>${de ? "Einträge" : "已有记录"}</th>
          <th>${de ? "Status" : "状态"}</th>
          <th>${de ? "Aktion" : "操作"}</th>
        </tr></thead>
        <tbody>
          ${all.map(t => {
            const entries = haccpEntries().filter(e => e.templateId === t.id).length;
            const off = t.status !== "启用";
            return `<tr class="${off ? "hc-tpl-off" : ""}">
              <td><strong>${haccpText(t.name) || (de ? "(ohne Namen)" : "(未命名)")}</strong><br><span class="muted small">${t.name.en || ""}</span></td>
              <td>${freqLabel(t)}</td>
              <td class="hc-num">${(t.columns || []).length}</td>
              <td class="hc-num">v${t.version}</td>
              <td class="hc-num">${entries}</td>
              <td><span class="pill ${off ? "orange" : "green"}">${off ? (de ? "Deaktiviert" : "已停用") : (de ? "Aktiv" : "启用中")}</span></td>
              <td>
                <div class="hc-tpl-actions">
                  <a class="ghost-btn" href="#${slug("store", "HACCP表单编辑")}?id=${encodeURIComponent(t.id)}">${de ? "Bearbeiten" : "编辑"}</a>
                  <button type="button" class="ghost-btn" data-haccp-tpl-toggle="${t.id}" data-status="${off ? "启用" : "停用"}">${off ? (de ? "Aktivieren" : "启用") : (de ? "Deaktivieren" : "停用")}</button>
                </div>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <div class="hc-tpl-reset">
        <button type="button" class="ghost-btn is-danger" data-haccp-reset>${de ? "Demodaten zurücksetzen" : "重置演示数据"}</button>
        <span class="muted small">${de ? "Setzt Formulare auf die 7 Vorlagen zurück und löscht alle Einträge. Nur für Demozwecke."
                                       : "把表单恢复成 7 张预置模板，并清空全部记录。仅用于演示，真实使用时不该出现在这里。"}</span>
        <div class="hc-inline-panel is-danger" data-haccp-reset-panel hidden>
          <strong>${de ? "Wirklich zurücksetzen?" : "确定重置？"}</strong>
          <p class="muted small">${de ? "Alle Einträge werden gelöscht, die Formulare kehren auf die 7 Vorlagen zurück. Nicht umkehrbar."
                                      : "全部记录会被清空，表单恢复成 7 张预置模板。此操作不可撤销。"}</p>
          <div class="button-row">
            <button type="button" class="ghost-btn" data-haccp-reset-cancel>${de ? "Abbrechen" : "取消"}</button>
            <button type="button" class="ghost-btn is-danger" data-haccp-reset-confirm>${de ? "Zurücksetzen" : "确认重置"}</button>
          </div>
        </div>
      </div>
      <p class="muted small hc-tpl-note">
        ${de ? "Formulare werden deaktiviert, nicht gelöscht — sonst entstehen Lücken in den Unterlagen für die Lebensmittelüberwachung."
             : "表单只能停用，不能真删除 —— 已有记录的表单被删掉，卫生局资料包会出洞。"}
      </p>
    </section>
   </div>`;
}

/* ----------------------------------------------------------- 编辑器 ------ */
function haccpTemplateEditPage() {
  const de = haccpDe();
  const id = state().params.get("id") || "";
  const isNew = id === "new";
  const template = isNew ? haccpBlankTemplate() : haccpTemplate(id);

  if (!template) {
    return `<div data-no-translate class="hc-page"><div class="page-head"><div><h1>${de ? "Formular nicht gefunden" : "找不到该表单"}</h1></div></div>
      <div class="card"><a class="primary-btn" href="#${slug("store", "HACCP表单管理")}">${de ? "Zurück" : "返回表单管理"}</a></div></div>`;
  }

  const entryCount = haccpEntries().filter(e => e.templateId === template.id).length;

  return `
    <div data-no-translate class="hc-page hc-editor" data-haccp-editor data-id="${template.id}" data-new="${isNew ? "1" : ""}"
         data-draft="${haccpEsc(encodeURIComponent(JSON.stringify(template)))}">
      <div class="page-head">
        <div>
          <h1>${isNew ? (de ? "Neues Formular" : "新建表单") : (de ? "Formular bearbeiten" : "编辑表单")}</h1>
          <p>${isNew ? (de ? "Messpunkte und Grenzwerte festlegen." : "定义测量点和临界值。")
                     : `${haccpText(template.name)} · ${de ? "aktuell" : "当前"} v${template.version}${entryCount ? ` · ${entryCount} ${de ? "Einträge" : "条已有记录"}` : ""}`}</p>
        </div>
        ${isNew ? "" : `<button type="button" class="ghost-btn" data-haccp-tpl-dup="${template.id}">${de ? "Als neues Formular kopieren" : "复制为新表单"}</button>`}
        <a class="ghost-btn accent-back-btn" href="#${slug("store", "HACCP表单管理")}">${de ? "Zurück" : "返回表单管理"}</a>
      </div>

      ${entryCount ? `
        <div class="card hc-note hc-note-version">
          ${de ? `Dieses Formular hat bereits ${entryCount} Einträge. Beim Speichern entsteht v${template.version + 1}; vorhandene Einträge bleiben auf ihrer Version und werden unverändert angezeigt.`
               : `这张表已经有 ${entryCount} 条记录。保存后会生成 v${template.version + 1}，已有记录仍锁定在原版本上，显示不受影响。`}
        </div>` : ""}

      <section class="card">
        <div class="section-title"><h2>${de ? "Grunddaten" : "基本信息"}</h2></div>
        <div class="form-grid">
          <label class="hc-setting-field">
            <span class="hc-label">${de ? "Name (Chinesisch)" : "表单名称（中文）"}</span>
            <input class="hc-input" data-haccp-meta="name.zh" value="${haccpEsc(template.name.zh)}" placeholder="${de ? "z. B. Lagertemperaturen" : "例如：储存 / 冷藏温度"}">
          </label>
          <label class="hc-setting-field">
            <span class="hc-label">${de ? "Name (Deutsch)" : "表单名称（德语）"}</span>
            <input class="hc-input" data-haccp-meta="name.de" value="${haccpEsc(template.name.de)}" placeholder="Lager- / Kühltemperaturen">
          </label>
          <label class="hc-setting-field">
            <span class="hc-label">${de ? "Formularart" : "表格版式"}</span>
            <select class="hc-input" data-haccp-meta="layout">
              <option value="monthly-grid" ${template.layout === "monthly-grid" ? "selected" : ""}>${de ? "Monatsraster (1–31)" : "月度网格（1–31 天每天一行）"}</option>
              <option value="log" ${template.layout === "log" ? "selected" : ""}>${de ? "Fortlaufend" : "流水记录（抽查时逐条加）"}</option>
              <option value="training" ${template.layout === "training" ? "selected" : ""}>${de ? "Schulung" : "培训记录（带讲师与主题）"}</option>
            </select>
          </label>
          <label class="hc-setting-field">
            <span class="hc-label">${de ? "Wann auszufüllen" : "什么时候填"}</span>
            <select class="hc-input" data-haccp-meta="timing">
              ${HACCP_SLOTS.map(x => `<option value="${x.id}" ${(template.timing || "any") === x.id ? "selected" : ""}>${haccpText(x)}</option>`).join("")}
            </select>
          </label>
          <label class="hc-setting-field">
            <span class="hc-label">${de ? "Häufigkeit" : "填写频次"}</span>
            <select class="hc-input" data-haccp-meta="frequency.kind">
              <option value="daily" ${template.frequency.kind === "daily" ? "selected" : ""}>${de ? "täglich" : "每日"}</option>
              <option value="weekly" ${template.frequency.kind === "weekly" ? "selected" : ""}>${de ? "wöchentlich" : "每周"}</option>
              <option value="yearly" ${template.frequency.kind === "yearly" ? "selected" : ""}>${de ? "jährlich" : "每年"}</option>
            </select>
          </label>
          <label class="hc-setting-field">
            <span class="hc-label">${de ? "Anzahl pro Zeitraum" : "每个周期填几次"}</span>
            <input class="hc-input" type="number" min="1" data-haccp-meta="frequency.times" value="${template.frequency.times || 1}">
          </label>
        </div>
      </section>

      <section class="card">
        <div class="section-title">
          <div>
            <h2>${de ? "Grenzwert- und Korrekturhinweise" : "临界值与纠正措施说明"}</h2>
            <p>${de ? "Erscheint unten im Formular und in der Monatsübersicht. Eine Zeile pro Absatz. Sie bearbeiten hier die deutsche Fassung; die chinesische bleibt erhalten."
                    : "显示在填表页底部和月度表下方。每行一段。当前编辑的是中文版，德语版保留不变。"}</p>
          </div>
        </div>
        <textarea class="hc-input hc-textarea" rows="4" data-haccp-footnotes
          placeholder="${de ? "z. B. Grenzwerte: Kühlschrank +4 bis +7 °C …" : "例如：临界值：冷藏 +4 ~ +7 °C；纠正措施：……"}">${(template.footnotes || []).map(n => haccpText(n)).join("\n")}</textarea>
      </section>

      <section class="card hc-cols-card">
        <div class="section-title">
          <div>
            <h2>${de ? "Messpunkte" : "测量点 / 字段"}</h2>
            <p>${de ? "Jede Filiale hat andere Kühlgeräte — hier umbenennen, hinzufügen oder entfernen."
                    : "每家店的冷柜数量和叫法都不一样，在这里改名、增加或删除。"}</p>
          </div>
          <button type="button" class="primary-btn" data-haccp-col-add>+ ${de ? "Messpunkt" : "添加测量点"}</button>
        </div>
        <div class="hc-col-list" data-haccp-col-list></div>
      </section>

      <section class="card">
        <div class="section-title">
          <h2>${de ? "Vorschau" : "填写界面预览"}</h2>
          <span class="pill blue">${de ? "live" : "实时"}</span>
        </div>
        <div class="hc-fields" data-haccp-preview></div>
      </section>

      <section class="card">
        <div class="hc-actionrow">
          <span class="hc-submit-status" data-haccp-editor-status></span>
          <a class="ghost-btn" href="#${slug("store", "HACCP表单管理")}">${de ? "Abbrechen" : "取消"}</a>
          <button type="button" class="primary-btn" data-haccp-editor-save>
            ${isNew ? (de ? "Formular anlegen" : "创建表单") : (de ? `Als v${template.version + 1} speichern` : `保存为 v${template.version + 1}`)}
          </button>
        </div>
      </section>
    </div>`;
}

/* 编辑器里单个列的编辑行 */
function haccpColumnEditorRow(column, index, total) {
  const de = haccpDe();
  const t = column.type || "text";
  const limit = column.limit || {};
  const hasLimitBy = !!column.limitBy;

  const typeOptions = HACCP_COL_TYPES.map(o =>
    `<option value="${o.v}" ${t === o.v ? "selected" : ""}>${de ? o.de : o.zh}</option>`).join("");

  const optionsText = (column.options || column.items || []).map(o => haccpValueOf(o)).join("\n");

  return `
    <div class="hc-col-row" data-haccp-col-index="${index}">
      <div class="hc-col-top">
        <span class="hc-col-num">${index + 1}</span>
        <input class="hc-input hc-col-main" data-haccp-col-field="label.zh" value="${haccpEsc(column.label && column.label.zh)}"
          placeholder="${de ? "Name (Chinesisch)" : "测量点名称，例如：后厨立式冷柜"}">
        <input class="hc-input" data-haccp-col-field="label.de" value="${haccpEsc(column.label && column.label.de)}"
          placeholder="${de ? "Name (Deutsch)" : "德语名称（选填）"}">
        <select class="hc-input hc-col-type" data-haccp-col-field="type">${typeOptions}</select>
        <div class="hc-col-tools">
          <button type="button" class="hc-icon-btn" data-haccp-col-move="up" ${index === 0 ? "disabled" : ""} title="${de ? "nach oben" : "上移"}">↑</button>
          <button type="button" class="hc-icon-btn" data-haccp-col-move="down" ${index === total - 1 ? "disabled" : ""} title="${de ? "nach unten" : "下移"}">↓</button>
          <button type="button" class="hc-icon-btn is-danger" data-haccp-col-remove title="${de ? "entfernen" : "删除"}">✕</button>
        </div>
      </div>

      <details class="hc-col-detail">
        <summary>
          <span class="hc-col-sum">${(() => {
            if (t === "temp") {
              if (hasLimitBy) return de ? "Grenzwert abhängig von anderer Spalte" : "限值随其他列变化";
              const bits = [];
              if (limit.min != null) bits.push(`≥ ${limit.min}`);
              if (limit.max != null) bits.push(`≤ ${limit.max}`);
              if (limit.tolerance != null) bits.push(de ? `kurzz. ${limit.tolerance}` : `短暂 ${limit.tolerance}`);
              return bits.length ? `${bits.join(" · ")} ${column.unit || ""}` : (de ? "kein Grenzwert" : "未设临界值");
            }
            if (t === "choice" || t === "checklist") {
              const n = (column.options || column.items || []).length;
              return de ? `${n} Optionen` : `${n} 个选项`;
            }
            return de ? "Einstellungen" : "设置";
          })()}</span>
          <span class="hc-col-expand">${de ? "bearbeiten" : "展开编辑"}</span>
        </summary>
      <div class="hc-col-body">
        ${t === "temp" ? (hasLimitBy ? `
          <div class="hc-col-locked">
            ${de ? `Grenzwert richtet sich nach der Spalte „${column.limitBy.field}" — im Editor nicht änderbar.`
                 : `该列的临界值随「${column.limitBy.field}」列的取值变化，编辑器暂不支持改这种条件限值。`}
          </div>` : `
          <label class="hc-col-mini"><span>${de ? "Einheit" : "单位"}</span>
            <input class="hc-input" data-haccp-col-field="unit" value="${haccpEsc(column.unit)}" placeholder="°C"></label>
          <label class="hc-col-mini"><span>${de ? "Untergrenze" : "下限"}</span>
            <input class="hc-input" type="number" step="any" data-haccp-col-field="limit.min" value="${limit.min != null ? limit.min : ""}" placeholder="—"></label>
          <label class="hc-col-mini"><span>${de ? "Obergrenze" : "上限"}</span>
            <input class="hc-input" type="number" step="any" data-haccp-col-field="limit.max" value="${limit.max != null ? limit.max : ""}" placeholder="—"></label>
          <label class="hc-col-mini"><span>${de ? "kurzz. zulässig" : "短暂容许"}</span>
            <input class="hc-input" type="number" step="any" data-haccp-col-field="limit.tolerance" value="${limit.tolerance != null ? limit.tolerance : ""}" placeholder="—"></label>`) : ""}

        ${(t === "choice" || t === "checklist") ? `
          <label class="hc-col-mini hc-col-wide"><span>${de ? "Optionen — eine pro Zeile, optional „中文|Deutsch\u201c" : "选项（每行一个；要德语写成「中文|Deutsch」）"}</span>
            <textarea class="hc-input" rows="3" data-haccp-col-field="options">${optionsText}</textarea></label>
          ${t === "choice" ? `
            <label class="hc-col-mini hc-col-wide"><span>${de ? "Welche Optionen gelten als Abweichung? (Komma)" : "哪些选项算超标（逗号分隔）"}</span>
              <input class="hc-input" data-haccp-col-field="breachOn" value="${haccpEsc((column.breachOn || []).join("、"))}" placeholder="${de ? "z. B. Nicht erledigt" : "例如：未完成、发现活体"}"></label>` : `
            <label class="hc-col-check"><input type="checkbox" data-haccp-col-field="requireAll" ${column.requireAll ? "checked" : ""}>
              <span>${de ? "Alle Punkte müssen bestätigt sein" : "必须全部勾选，否则算超标"}</span></label>`}` : ""}

        <details class="hc-col-more">
          <summary>${de ? "Weitere Optionen" : "更多设置"}${(column.note && column.note.zh) || column.optional
            ? `<b>${de ? "gesetzt" : "已设置"}</b>` : ""}</summary>
          <div class="hc-col-more-body">
            <label class="hc-col-mini hc-col-wide"><span>${de ? "Hinweis unter dem Feld" : "字段下方提示"}</span>
              <input class="hc-input" data-haccp-col-field="note.zh" value="${haccpEsc(column.note && column.note.zh)}"
                placeholder="${de ? "optional" : "选填，例如：绞肉 / 禽类 max +4°C"}"></label>
            <label class="hc-col-check"><input type="checkbox" data-haccp-col-field="optional" ${column.optional ? "checked" : ""}>
              <span>${de ? "optionales Feld" : "选填（不填也能提交）"}</span></label>
          </div>
        </details>
      </div>
      </details>
    </div>`;
}

/* ------------------------------------------------------ 编辑器事件 ------ */
function haccpBindTemplateList() {
  const resetBtn = document.querySelector("[data-haccp-reset]");
  const resetPanel = document.querySelector("[data-haccp-reset-panel]");
  if (resetBtn && resetPanel) {
    resetBtn.addEventListener("click", () => { resetPanel.hidden = false; resetBtn.hidden = true; });
    resetPanel.querySelector("[data-haccp-reset-cancel]").addEventListener("click", () => {
      resetPanel.hidden = true; resetBtn.hidden = false;
    });
    resetPanel.querySelector("[data-haccp-reset-confirm]").addEventListener("click", () => {
      haccpWrite(HACCP_TPL_KEY, haccpSeedTemplates());
      haccpWrite(HACCP_ENTRY_KEY, []);
      haccpWrite(HACCP_DEVICE_KEY, haccpSeedDevices());
      haccpPendingToast = { tone: "warn", message: haccpDe() ? "Demodaten zurückgesetzt." : "演示数据已重置。" };
      if (typeof app === "function") app();
    });
  }

  document.querySelectorAll("[data-haccp-tpl-dup]").forEach(button => {
    button.addEventListener("click", () => {
      const copy = haccpDuplicateTemplate(button.dataset.haccpTplDup);
      if (copy) location.hash = `${slug("store", "HACCP表单编辑")}?id=${encodeURIComponent(copy.id)}`;
    });
  });
  document.querySelectorAll("[data-haccp-tpl-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      haccpSetTemplateStatus(button.dataset.haccpTplToggle, button.dataset.status);
      if (typeof app === "function") app();
    });
  });
}

function haccpBindTemplateEditor() {
  const root = document.querySelector("[data-haccp-editor]");
  if (!root) return;

  const de = haccpDe();
  const isNew = root.dataset.new === "1";
  /* 解析失败不能连累整个 haccpBindAll —— 那会让全站的事件绑定一起停在这里。
     单引号截断属性的老问题已在渲染侧修掉，这里再兜一层。 */
  let draft;
  try {
    draft = JSON.parse(decodeURIComponent(root.dataset.draft));
  } catch (err) {
    const fallback = haccpTemplate(root.dataset.id);
    if (!fallback) return;
    draft = JSON.parse(JSON.stringify(fallback));
  }
  const listEl = root.querySelector("[data-haccp-col-list]");
  const previewEl = root.querySelector("[data-haccp-preview]");
  const statusEl = root.querySelector("[data-haccp-editor-status]");
  const saveBtn = root.querySelector("[data-haccp-editor-save]");

  function setDeep(target, path, value) {
    const parts = path.split(".");
    let node = target;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!node[parts[i]] || typeof node[parts[i]] !== "object") node[parts[i]] = {};
      node = node[parts[i]];
    }
    if (value === "" || value == null) delete node[parts[parts.length - 1]];
    else node[parts[parts.length - 1]] = value;
  }

  function validate() {
    const problems = [];
    if (!draft.name.zh || !draft.name.zh.trim()) problems.push(de ? "Formularname fehlt" : "表单名称未填");
    if (!draft.columns.length) problems.push(de ? "mindestens ein Messpunkt nötig" : "至少要有一个测量点");
    draft.columns.forEach((c, i) => {
      if (!c.label || !c.label.zh || !c.label.zh.trim()) problems.push(`${de ? "Messpunkt" : "第"} ${i + 1} ${de ? "ohne Namen" : "个测量点未命名"}`);
    });
    saveBtn.disabled = problems.length > 0;
    statusEl.textContent = problems.length
      ? problems.join("；")
      : (de ? "Bereit zum Speichern" : `准备就绪 · ${draft.columns.length} 个测量点`);
    statusEl.className = "hc-submit-status" + (problems.length ? " is-crit" : " is-ok");
  }

  function renderColumns() {
    listEl.innerHTML = draft.columns
      .map((column, index) => haccpColumnEditorRow(column, index, draft.columns.length)).join("");
  }

  function renderPreview() {
    previewEl.innerHTML = draft.columns.length
      ? draft.columns.map(column => haccpFieldMarkup(column)).join("")
      : `<p class="muted">${de ? "Noch keine Messpunkte." : "还没有测量点。"}</p>`;
  }

  function refresh(structural) {
    if (structural) renderColumns();
    renderPreview();
    validate();
  }

  /* 基本信息 */
  root.querySelectorAll("[data-haccp-meta]").forEach(input => {
    input.addEventListener("input", () => {
      const path = input.dataset.haccpMeta;
      const value = input.type === "number" ? Number(input.value) : input.value;
      setDeep(draft, path, value);
      refresh(false);
    });
    input.addEventListener("change", () => {
      setDeep(draft, input.dataset.haccpMeta, input.type === "number" ? Number(input.value) : input.value);
      refresh(false);
    });
  });

  const footnotesEl = root.querySelector("[data-haccp-footnotes]");
  if (footnotesEl) {
    footnotesEl.addEventListener("input", () => {
      /* 按行索引合并：只覆盖当前语言那一份，另一种语言原样保留。
         之前不管什么语言都写进 zh，德语用户一编辑就把中文说明覆盖掉了。 */
      const lang = haccpDe() ? "de" : "zh";
      const prev = draft.footnotes || [];
      draft.footnotes = footnotesEl.value.split("\n").map(v => v.trim()).filter(Boolean)
        .map((line, i) => Object.assign({}, prev[i] || {}, { [lang]: line }));
      refresh(false);
    });
  }

  /* 列编辑：事件委托，结构变化才重渲染 */
  listEl.addEventListener("input", event => {
    const field = event.target.closest("[data-haccp-col-field]");
    if (!field) return;
    const index = Number(field.closest("[data-haccp-col-index]").dataset.haccpColIndex);
    const column = draft.columns[index];
    const path = field.dataset.haccpColField;

    if (path === "options") {
      const values = field.value.split("\n").map(v => v.trim()).filter(Boolean).map(v => ({ zh: v }));
      if (column.type === "checklist") { column.items = values; delete column.options; }
      else { column.options = values; delete column.items; }
    } else if (path === "breachOn") {
      const values = field.value.split(/[、,，]/).map(v => v.trim()).filter(Boolean);
      if (values.length) column.breachOn = values; else delete column.breachOn;
    } else if (field.type === "checkbox") {
      if (field.checked) column[path] = true; else delete column[path];
    } else if (field.type === "number") {
      setDeep(column, path, field.value === "" ? "" : Number(field.value));
    } else {
      setDeep(column, path, field.value);
    }
    refresh(false);
  });

  listEl.addEventListener("change", event => {
    const field = event.target.closest("[data-haccp-col-field]");
    if (!field) return;
    const index = Number(field.closest("[data-haccp-col-index]").dataset.haccpColIndex);
    const column = draft.columns[index];

    if (field.dataset.haccpColField === "type") {
      column.type = field.value;
      /* 换类型时清掉不再适用的配置，避免残留 */
      if (column.type !== "temp") { delete column.limit; delete column.unit; delete column.limitBy; }
      else if (!column.limit) { column.limit = {}; column.unit = column.unit || "°C"; }
      if (column.type !== "choice") delete column.breachOn;
      if (column.type !== "checklist") delete column.requireAll;
      if (column.type !== "choice" && column.type !== "checklist") { delete column.options; delete column.items; }
      if (column.type === "photo") column.optional = column.optional || undefined;
      if (column.type === "choice" && !column.options) column.options = [];
      if (column.type === "checklist" && !column.items) column.items = [];
      refresh(true);
      return;
    }
    if (field.type === "checkbox") {
      if (field.checked) column[field.dataset.haccpColField] = true;
      else delete column[field.dataset.haccpColField];
      refresh(false);
    }
  });

  listEl.addEventListener("click", event => {
    const row = event.target.closest("[data-haccp-col-index]");
    if (!row) return;
    const index = Number(row.dataset.haccpColIndex);

    if (event.target.closest("[data-haccp-col-remove]")) {
      /* 行内二次确认：把这一行换成确认条，不打断操作流 */
      const name = (draft.columns[index].label && draft.columns[index].label.zh) || (de ? "dieser Messpunkt" : "这个测量点");
      row.classList.add("hc-col-confirming");
      row.innerHTML = `
        <div class="hc-col-confirm">
          <div>
            <strong>${de ? `„${haccpEsc(name)}" entfernen?` : `确定删除「${haccpEsc(name)}」？`}</strong>
            <span>${de ? "Bereits erfasste Einträge bleiben unverändert." : "已经填过的记录不受影响，仍按原版本显示。"}</span>
          </div>
          <div class="button-row">
            <button type="button" class="ghost-btn" data-haccp-col-cancel>${de ? "Abbrechen" : "取消"}</button>
            <button type="button" class="ghost-btn is-danger" data-haccp-col-confirm>${de ? "Entfernen" : "删除"}</button>
          </div>
        </div>`;
      return;
    }
    if (event.target.closest("[data-haccp-col-cancel]")) { refresh(true); return; }
    if (event.target.closest("[data-haccp-col-confirm]")) {
      draft.columns.splice(index, 1);
      refresh(true);
      return;
    }
    const move = event.target.closest("[data-haccp-col-move]");
    if (move) {
      const to = move.dataset.haccpColMove === "up" ? index - 1 : index + 1;
      if (to < 0 || to >= draft.columns.length) return;
      const [moved] = draft.columns.splice(index, 1);
      draft.columns.splice(to, 0, moved);
      refresh(true);
    }
  });

  root.querySelector("[data-haccp-col-add]").addEventListener("click", () => {
    draft.columns.push({ id: haccpNextColumnId(draft), label: { zh: "" }, type: "temp", unit: "°C", limit: {} });
    refresh(true);
    const rows = listEl.querySelectorAll(".hc-col-main");
    if (rows.length) rows[rows.length - 1].focus();
  });

  saveBtn.addEventListener("click", () => {
    /* 清掉空的 limit 对象，保持数据干净 */
    draft.columns.forEach(column => {
      if (column.limit && !Object.keys(column.limit).length) delete column.limit;
    });
    if (draft.frequency.kind === "daily") delete draft.frequency.times;
    const saved = haccpSaveTemplateVersion(draft);
    haccpPendingToast = isNew
      ? { tone: "ok", message: de ? `Formular angelegt (v${saved.version}).` : `表单已创建（v${saved.version}）。` }
      : { tone: "ok", message: de ? `Als v${saved.version} gespeichert — vorhandene Einträge bleiben auf ihrer Version.`
                                  : `已保存为 v${saved.version}。已有记录仍锁定在原版本，显示不受影响。` };
    location.hash = slug("store", "HACCP表单管理");
  });

  refresh(true);
}

function haccpBindFillDate() {
  const input = document.querySelector("[data-haccp-date]");
  if (!input) return;
  /* 培训表自己管日期（提交时读 dateInput.value）。这里再挂一个「改日期就重刷整页」，
     会把已经勾好的参与人、签名、培训类型全部冲掉。 */
  if (document.querySelector("[data-haccp-roster]")) return;
  input.addEventListener("change", () => {
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    params.set("d", input.value || haccpToday());
    location.hash = haccpFillHash(params.toString());
  });
}

function haccpBindStore() {
  const select = document.querySelector("[data-haccp-store]");
  if (!select) return;
  select.addEventListener("change", () => {
    haccpSetStore(select.value);
    if (typeof app === "function") app();
  });
}

function haccpBindAll() {
  haccpFlushToast();
  haccpBindChart();
  haccpBindQuickFill();
  haccpBindAssign();
  haccpBindDeviceAdd();
  haccpBindDevice();
  haccpBindStore();
  haccpBindFillDate();
  haccpBindMonthly();
  haccpBindReview();
  haccpBindFill();
  haccpBindTemplateList();
  haccpBindTemplateEditor();
}
