/* ==========================================================================
   KaiSpan · 员工助手模块
   --------------------------------------------------------------------------
   独立于 app.js，在 app.js 之前以 defer 加载（顺序由 defer 保证）。
   第 0 步只建数据层，不含页面；页面在第 1 步接上来。

   依赖 app.js 的全局：currentLanguage() / slug() / state() / stores
   ========================================================================== */

/* ---------------------------------------------------------------- 存储层 --- */
/* 与 haccp.js 同构：file:// 下部分浏览器禁用 localStorage，这里做内存兜底 */
const EMP_STAFF_KEY = "kaispanEmpStaff";
const EMP_RULES_KEY = "kaispanEmpRules";
const EMP_STORE_KEY = "kaispanEmpStore";
const EMP_EMPLOYER_KEY = "kaispanEmpEmployer";
const empMemory = {};

function empRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch (error) {
    if (empMemory[key] !== undefined) return empMemory[key];
  }
  if (empMemory[key] !== undefined) return empMemory[key];
  return fallback;
}

function empWrite(key, value) {
  empMemory[key] = value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* 内存兜底已写入，静默降级 */
  }
}

/* ------------------------------------------------------------ 语言与转义 --- */
/* 2026-09-04（Mingrong：员工界面的语言是怎么决定的）——
   原来只有一个答案：店长在顶栏切的那个全局语言。可员工档案里明明有一栏
   「沟通语言」，是这个人自己选的，他自己的 app 却完全不看它 ——
   于是一个只会德语的员工打开自己的班表看到的是中文。
   现在员工端那几页按他档案里的语言渲染，其余地方照旧跟全局。 */
function empDe() {
  const forced = typeof meForcedLang === "function" ? meForcedLang() : null;
  if (forced) return forced === "de";
  return typeof currentLanguage === "function" && currentLanguage() === "de";
}

/* 用户自由输入（姓名、备注、原因、地址…）渲染前必须走这里 */
function empEsc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ------------------------------------------------------------ 上传的文件 ---
   店长要能点开员工传的那份护照 / 健康证看一眼 —— 光有个文件名等于没交。
   但护照照片不该躺在 localStorage 里（这条判断从入职自填页第一版就定了，不改），
   所以这里用一个折中：文件内容只在当前这次会话的内存里，
   刷新之后档案里仍然只剩文件名，页面照实说「原型里没存下来」，不假装存过。
   真产品里这个 ref 就是服务器上的文件地址，页面这层一行不用改。 */
const EMP_FILE_BLOBS = new Map();

function empFileRef(file) {
  const ref = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  try { EMP_FILE_BLOBS.set(ref, URL.createObjectURL(file)); } catch (error) { return ""; }
  return ref;
}

function empFileUrl(ref) {
  if (!ref) return "";
  if (EMP_FILE_BLOBS.has(ref)) return EMP_FILE_BLOBS.get(ref);
  /* 种子数据里的文件是「演示文件」，点开给一张写明白的占位图 —— 不冒充真扫描件 */
  if (ref === "demo") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="440">
      <rect width="720" height="440" fill="#f4f6fb"/>
      <rect x="24" y="24" width="672" height="392" fill="#fff" stroke="#d7dbe8" rx="14"/>
      <text x="60" y="150" font-family="sans-serif" font-size="30" fill="#0f1633">演示文件 / Beispieldatei</text>
      <text x="60" y="205" font-family="sans-serif" font-size="18" fill="#6b7390">这个原型没有后端，演示数据里没有真的扫描件。</text>
      <text x="60" y="238" font-family="sans-serif" font-size="18" fill="#6b7390">Prototyp ohne Backend — kein echtes Dokument hinterlegt.</text>
      <text x="60" y="300" font-family="sans-serif" font-size="18" fill="#6236ff">自己传一份上去，点开就是那一份。</text>
    </svg>`;
    try {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      EMP_FILE_BLOBS.set(ref, url);
      return url;
    } catch (error) { return ""; }
  }
  return "";
}

/* 文件名要么是能点开的附件，要么明说打不开，不给一个点了没反应的链接 */
function empFileLink(d) {
  if (!d || !d.file) return "";
  const url = empFileUrl(d.ref);
  if (url) return `<a class="emp-file is-open" href="${empEsc(url)}" target="_blank" rel="noopener">${empEsc(d.file)}</a>`;
  return `<span class="emp-file is-gone" title="${empT("这个原型没有后端，文件内容没有保存，只留了文件名。刷新之前传的可以直接点开看。",
    "Prototyp ohne Backend: Der Dateiinhalt wird nicht gespeichert, nur der Name. Vor dem Neuladen hochgeladene Dateien lassen sich öffnen.")}">${empEsc(d.file)}</span>`;
}

/* 取多语言显示文本：{zh, de} 或纯字符串。转义在这里统一做。 */
function empText(value) {
  return empEsc(empRaw(value));
}

function empRaw(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (empDe() && value.de) return value.de;
  return value.zh || "";
}

/* -------------------------------------------------------------- 日期工具 --- */
function empToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function empShiftDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* 加月份。用来从入职日期算试用期结束日。
   月末对齐：1月31日 + 1个月 = 2月28/29日，不要溢出到 3 月。 */
function empAddMonths(dateStr, months) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, lastDay);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/* b - a，单位天。用于到期倒计时，负数表示已过期。 */
function empDaysBetween(a, b) {
  const from = new Date(`${a}T00:00:00`);
  const to = new Date(`${b}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

function empFormatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return empEsc(dateStr);
  return empDe() ? `${d}.${m}.${y}` : `${y}-${m}-${d}`;
}

/* ------------------------------------------------------------ 当前上下文 --- */
/* 按 D5：员工助手只做老板/店长视角，不分角色。 */
function empStores() {
  return typeof stores !== "undefined" ? stores : ["Martin Biergarten"];
}

/* ============================================================ 主数据定义 === */

/* 合同类型。hours 是「月度规定工时区间」，排班和工时校验都读它。
   limit 指向 empRules() 里的哪条合规参数。 */
const EMP_CONTRACT_TYPES = [
  { id: "vollzeit", name: { zh: "全职", de: "Vollzeit" }, limit: null },
  { id: "teilzeit", name: { zh: "兼职", de: "Teilzeit" }, limit: null },
  { id: "minijob", name: { zh: "Minijob", de: "Minijob" }, limit: "minijobMonthlyMax" },
  { id: "werkstudent", name: { zh: "Werkstudent", de: "Werkstudent" }, limit: "werkstudentWeeklyMax" }
];

function empContractType(id) {
  return EMP_CONTRACT_TYPES.find(t => t.id === id) || EMP_CONTRACT_TYPES[0];
}

const EMP_ROLES = [
  { id: "manager", name: { zh: "店长", de: "Filialleitung" } },
  { id: "kitchen", name: { zh: "后厨", de: "Küche" } },
  { id: "front", name: { zh: "前厅", de: "Service" } },
  { id: "bar", name: { zh: "吧台", de: "Bar" } },
  { id: "clean", name: { zh: "清洁", de: "Reinigung" } }
];

function empRole(id) {
  return EMP_ROLES.find(r => r.id === id) || EMP_ROLES[1];
}

const EMP_LEVELS = [
  { id: "lead", name: { zh: "负责人", de: "Verantwortlich" } },
  { id: "skilled", name: { zh: "熟练", de: "Erfahren" } },
  { id: "basic", name: { zh: "普通", de: "Standard" } }
];

function empLevel(id) {
  return EMP_LEVELS.find(l => l.id === id) || EMP_LEVELS[2];
}

/* 在职状态。leaving=true 的不计入在岗人数，也不参与排班。 */
const EMP_STATUS = [
  { id: "active", name: { zh: "在职", de: "Aktiv" }, tone: "green" },
  { id: "probation", name: { zh: "试用期", de: "Probezeit" }, tone: "orange" },
  { id: "invited", name: { zh: "邀请中", de: "Eingeladen" }, tone: "blue", leaving: true },
  { id: "left", name: { zh: "离职", de: "Ausgeschieden" }, tone: "red", leaving: true }
];

function empStatus(id) {
  return EMP_STATUS.find(s => s.id === id) || EMP_STATUS[0];
}

/* 7 类证件。expiry:true 的三类才进到期预警。
   need 决定这份证件对谁是必需的：all / nonEU / student。 */
const EMP_DOC_TYPES = [
  { id: "id", name: { zh: "护照 / 身份证", de: "Pass / Personalausweis" }, expiry: false, need: "all" },
  { id: "residence", name: { zh: "居留卡", de: "Aufenthaltstitel" }, expiry: true, need: "nonEU" },
  { id: "zusatz", name: { zh: "Zusatzblatt", de: "Zusatzblatt" }, expiry: false, need: "nonEU" },
  { id: "student", name: { zh: "学生入学证明", de: "Immatrikulationsbescheinigung" }, expiry: true, need: "student" },
  { id: "kv", name: { zh: "医保卡（照片）", de: "Krankenkassenkarte (Foto)" }, expiry: false, need: "all" },
  { id: "bank", name: { zh: "银行卡（照片）", de: "Bankkarte (Foto)" }, expiry: false, need: "all" },
  { id: "belehrung", name: { zh: "健康证 Belehrung", de: "Belehrung §43 IfSG" }, expiry: true, need: "all" },
  /* 第 8 类，后加的。原来合同在系统里无处安放：员工在自填页传的那份存进
     invite.submitted.contractFile 之后就断了 —— 审核通过不合并进档案，也没有任何页面查得到，
     上传等于扔掉。现在它是一份正经证件：能归档、进证件矩阵、缺了进预警、新人清单据此自动判定。
     self:"optional" 是说自填页不把它算进「你还差几项」——
     很多人上工时合同还没双方签好，卡在这一项他整张表都提交不了。 */
  { id: "contract", name: { zh: "劳动合同（双方签字）", de: "Arbeitsvertrag (unterschrieben)" },
    expiry: false, need: "all", self: "optional" }
];

/* 员工自填页真正要他交的那几份。合同不在里面，理由见上面那条注释。 */
function empSelfDocs(employee) {
  return EMP_DOC_TYPES.filter(t => empDocNeeded(employee, t) && t.self !== "optional");
}

function empDocType(id) {
  return EMP_DOC_TYPES.find(t => t.id === id) || EMP_DOC_TYPES[0];
}

/* ======================================================== 合规参数（可配） ===
   按 D15：全部做成可编辑配置，不硬编码为法规常量。
   每条都带 unit 和 note，编辑页直接照这张表渲染。
   ⚠️ 默认值是初始录入，需要 Mingrong 按当年法规和实际合同核实一遍。
   ========================================================================== */
const EMP_RULES_DEFAULT = [
  { id: "minijobMonthlyMax", value: 556, unit: { zh: "€/月", de: "€/Monat" },
    name: { zh: "Minijob 月薪上限", de: "Minijob Monatsgrenze" },
    note: { zh: "超过后不再是 Minijob，社保全变，老板需补缴。法规每年调整，请核实当年数值。",
            de: "Bei Überschreitung entfällt der Minijob-Status. Jährlich prüfen." } },
  { id: "werkstudentWeeklyMax", value: 20, unit: { zh: "h/周", de: "h/Woche" },
    name: { zh: "Werkstudent 每周工时上限", de: "Werkstudent Wochenstunden" },
    note: { zh: "学期内超过会丢学生社保身份；假期另有规则，需要时单独配置。",
            de: "Überschreitung während der Vorlesungszeit gefährdet den Studentenstatus." } },
  { id: "dailyHoursMax", value: 10, unit: { zh: "h/日", de: "h/Tag" },
    name: { zh: "单日工时上限", de: "Tägliche Höchstarbeitszeit" },
    note: { zh: "工时法上限。排班超过即告警。", de: "Grenze nach ArbZG." } },
  { id: "restBetweenShifts", value: 11, unit: "h",
    name: { zh: "两班之间最短间隔", de: "Mindestruhezeit zwischen Schichten" },
    note: { zh: "餐饮业有行业例外，若门店按例外执行可下调。", de: "Branchenausnahmen im Gastgewerbe möglich." } },
  { id: "breakAfter6h", value: 30, unit: { zh: "分钟", de: "Minuten" },
    name: { zh: "超过 6 小时的休息时间", de: "Pause ab 6 Stunden" }, note: { zh: "", de: "" } },
  { id: "breakAfter9h", value: 45, unit: { zh: "分钟", de: "Minuten" },
    name: { zh: "超过 9 小时的休息时间", de: "Pause ab 9 Stunden" }, note: { zh: "", de: "" } },
  { id: "docWarnDays", value: 30, unit: { zh: "天", de: "Tage" },
    name: { zh: "证件到期预警提前期", de: "Vorwarnzeit Dokumentablauf" },
    note: { zh: "进入这个区间的证件标红，出现在待办里。", de: "Ab hier rot und in der Aufgabenliste." } },
  { id: "docSoonDays", value: 90, unit: { zh: "天", de: "Tage" },
    name: { zh: "证件到期关注期", de: "Beobachtungszeit Dokumentablauf" },
    note: { zh: "提前知道要续，但还不用催。", de: "Frühwarnung, noch kein Handlungsbedarf." } },
  { id: "probationWarnDays", value: 30, unit: { zh: "天", de: "Tage" },
    name: { zh: "试用期到期提前提醒", de: "Vorwarnzeit Ende Probezeit" },
    note: { zh: "试用期结束前要决定转正还是解约。试用期内的解约通知期比之后短得多，错过这个窗口成本完全不同。",
            de: "Vor Ablauf der Probezeit ist zu entscheiden: übernehmen oder kündigen. In der Probezeit ist die Kündigungsfrist deutlich kürzer." } },
  { id: "probationMonths", value: 6, unit: { zh: "个月", de: "Monate" },
    name: { zh: "试用期长度", de: "Dauer der Probezeit" },
    note: { zh: "填了入职日期就按这个自动算出试用期结束日，可以逐人改。德国法定上限是 6 个月，超过就不再算试用期，解约通知期按正式合同走。",
            de: "Aus dem Eintrittsdatum wird damit das Ende der Probezeit berechnet, je Person änderbar. Gesetzliche Obergrenze in Deutschland: 6 Monate." } },
  { id: "probationNoticeWeeks", value: 2, unit: { zh: "周", de: "Wochen" },
    name: { zh: "试用期内解约通知期", de: "Kündigungsfrist in der Probezeit" },
    note: { zh: "办离职时用它算最早的最后工作日。默认按法定，合同约定更长的请改这里。",
            de: "Grundlage für den frühestmöglichen letzten Arbeitstag. Bei abweichender Vertragsregelung hier anpassen." } },
  { id: "weeklyDaysOffMin", value: 2, unit: { zh: "天/周", de: "Tage/Woche" },
    name: { zh: "每周至少休息几天", de: "Mindestruhetage pro Woche" },
    note: { zh: "自动排班不会越过这条线，手排少于这个数会红字提醒。七天全排是违法的，那一档系统直接不许排。德国法定是每周至少一个休息日（原则上是周日），两天通常来自合同或行业协议。",
            de: "Die automatische Planung hält diese Grenze ein; manuell darunter erscheint eine Warnung. Sieben Tage am Stück sind unzulässig und werden blockiert. Gesetzlich ist mindestens ein Ruhetag pro Woche vorgesehen (grundsätzlich der Sonntag); zwei Tage ergeben sich meist aus Vertrag oder Tarif." } },
  { id: "azkMaxHours", value: 40, unit: "h",
    name: { zh: "Arbeitszeitkonto 余额上限", de: "Obergrenze Arbeitszeitkonto" },
    note: { zh: "账户里最多能存多少小时。到顶之后排多的工时就只能当月发钱或者改班表，系统不会让你无限往里塞。上限多少由合同或劳资协议约定。",
            de: "Maximaler Saldo des Zeitkontos. Ist es voll, müssen Mehrstunden ausgezahlt oder der Dienstplan geändert werden. Die Höhe ergibt sich aus Vertrag oder Tarif." } },
  { id: "punchGraceMin", value: 5, unit: { zh: "分钟", de: "Minuten" },
    name: { zh: "打卡宽限", de: "Toleranz bei der Zeiterfassung" },
    note: { zh: "比班表早到晚走多少分钟之内都算准时。设成 0 会把「早两分钟走」也变成一条要处理的异常，店长每天都在点确认，真正的问题反而淹了。",
            de: "Innerhalb dieser Toleranz gilt die Erfassung als pünktlich. Bei 0 wird jede Kleinigkeit zur Abweichung und die echten Fälle gehen unter." } },
  { id: "punchRadiusM", value: 150, unit: { zh: "米", de: "Meter" },
    name: { zh: "打卡允许范围", de: "Zulässiger Erfassungsradius" },
    note: { zh: "超出这个距离就打不了卡，被拦下的尝试会记下来进待处理，员工可以请你补签。手机定位在城里本来就有几十米误差，室内更差 —— 设得太小会把真在店里的人挡在门外，然后你每天都在补签。门店没设坐标或者手机没给定位时不拦，那是「判不了」不是「太远」。",
            de: "Darüber hinaus ist keine Erfassung möglich; abgewiesene Versuche werden protokolliert und der Mitarbeiter kann um Nacherfassung bitten. Handy-Ortung ist in der Stadt zweistellig ungenau, innen schlechter — zu kleine Werte sperren Anwesende aus und erzeugen tägliche Nacherfassungen. Ohne Filialstandort oder Geräteortung wird nicht gesperrt." } },
  { id: "auAfterDays", value: 3, unit: { zh: "天", de: "Tage" },
    name: { zh: "病假第几天起要 AU", de: "AU ab Krankheitstag" },
    note: { zh: "连续病假到这个天数就要医生证明（Arbeitsunfähigkeitsbescheinigung）。法定是第 4 个日历日起，但很多合同约定第 1 天就要 —— 按你合同里写的填。",
            de: "Ab dieser Dauer ist eine Arbeitsunfähigkeitsbescheinigung nötig. Gesetzlich ab dem vierten Kalendertag, per Vertrag oft früher." } },
  { id: "lohnfortzahlungWeeks", value: 6, unit: { zh: "周", de: "Wochen" },
    name: { zh: "病假照付工资的周数", de: "Dauer der Lohnfortzahlung" },
    note: { zh: "同一疾病连续病假在这个期限内由雇主照付工资，之后由医保付 Krankengeld，工资那边要停发。法定是 6 周。",
            de: "Innerhalb dieser Frist zahlt der Arbeitgeber weiter, danach übernimmt die Krankenkasse Krankengeld. Gesetzlich sechs Wochen." } },
  { id: "payslipToleranceEuro", value: 5, unit: "€",
    name: { zh: "工资单对账容差", de: "Toleranz beim Abgleich der Abrechnung" },
    note: { zh: "税务师算出来的 Brutto 跟我们封账时估的差多少以内算正常。差在容差以内不打扰你；超出就标红，要么改登记的数，要么写清楚为什么差。休假工资按 13 周平均算、社保档位变化都会造成几欧的差，设成 0 会天天误报。",
            de: "Bis zu diesem Betrag gilt die Abweichung zwischen eigener Schätzung und Abrechnung als normal. Darüber wird markiert und muss korrigiert oder begründet werden." } },
  { id: "recordRetentionYears", value: 10, unit: { zh: "年", de: "Jahre" },
    name: { zh: "离职后档案保留年限", de: "Aufbewahrungsfrist nach Austritt" },
    note: { zh: "离职不等于删档。保留期限按税务和劳动法要求配置，到期前档案一直可查。",
            de: "Austritt heisst nicht Löschung. Frist nach steuer- und arbeitsrechtlichen Vorgaben setzen." } }
];

function empRules() {
  const saved = empRead(EMP_RULES_KEY, null);
  if (!saved) return EMP_RULES_DEFAULT.map(r => ({ ...r }));
  /* 以默认表为骨架合并，这样新增参数不会因为旧存档而消失 */
  return EMP_RULES_DEFAULT.map(def => {
    const hit = saved.find(s => s.id === def.id);
    return hit ? { ...def, value: hit.value } : { ...def };
  });
}

function empRule(id) {
  const hit = empRules().find(r => r.id === id);
  return hit ? hit.value : null;
}

function empSetRule(id, value) {
  const next = empRules().map(r => (r.id === id ? { ...r, value } : r));
  empWrite(EMP_RULES_KEY, next.map(r => ({ id: r.id, value: r.value })));
  return next;
}

/* ==================================================== 公司侧申报信息 =======
   即时申报 Sofortmeldung 要交的东西一半在员工档案里（姓名、生日、社保号、地址、上工日期），
   另一半是公司自己的 —— 而 Betriebsnummer 这个字段全站原来根本不存在。
   缺它，那张表就是填不完的，所以做成一次填、按门店存的配置。
   连锁店各门店的 Betriebsnummer 可能不同，所以按门店存不按公司存。
   ========================================================================== */
const EMP_EMPLOYER_FIELDS = [
  { id: "legalName", name: { zh: "公司法定名称", de: "Firmenname" },
    note: { zh: "合同和申报上写的全称，不是招牌名。", de: "Vollständiger Name laut Registereintrag, nicht der Schildname." } },
  { id: "betriebsnummer", name: { zh: "Betriebsnummer 企业编号", de: "Betriebsnummer" },
    note: { zh: "劳动局 Agentur für Arbeit 发的 8 位号。没有它即时申报和月度社保申报都报不上去。填一次，以后每个新人自动带上。",
            de: "Achtstellige Nummer der Agentur für Arbeit. Ohne sie ist weder Sofort- noch SV-Meldung möglich. Einmal eintragen, danach automatisch übernommen." } },
  { id: "address", name: { zh: "经营地址 Betriebsstätte", de: "Betriebsstätte" },
    note: { zh: "员工实际上工的地址。", de: "Adresse des tatsächlichen Arbeitsorts." } },
  { id: "iban", name: { zh: "付款账户 IBAN", de: "IBAN des Zahlungskontos" },
    note: { zh: "发工资从哪个账户打出去。生成 SEPA 文件要用它，缺了就生成不了。只校验格式和校验位，不查这个账户是不是真存在。",
            de: "Konto, von dem die Löhne gezahlt werden. Ohne IBAN keine SEPA-Datei. Geprüft werden Format und Prüfziffer, nicht die Existenz des Kontos." } },
  { id: "bic", name: { zh: "付款账户 BIC", de: "BIC des Zahlungskontos" },
    note: { zh: "德国境内的 SEPA 转账多数银行已经不要 BIC 了，留空也能生成文件；有些银行仍然要求，那就填上。",
            de: "Für SEPA-Inlandszahlungen meist nicht mehr erforderlich; bei Bedarf der Bank eintragen." } }
];

function empEmployerAll() {
  const saved = empRead(EMP_EMPLOYER_KEY, null);
  if (saved) return saved;
  /* Betriebsnummer 故意留空 —— 这是只有 Mingrong 手里有的号，系统编一个出来比空着更危险。 */
  const seed = {};
  empStores().forEach(store => { seed[store] = { legalName: store, betriebsnummer: "", address: "" }; });
  return seed;
}

function empEmployer(store) {
  return empEmployerAll()[store] || {};
}

function empSetEmployer(store, id, value) {
  const all = { ...empEmployerAll() };
  all[store] = { ...(all[store] || {}), [id]: value };
  empWrite(EMP_EMPLOYER_KEY, all);
  return all;
}

/* ============================================================ 种子数据 ===== */
/* 证件到期日按「相对今天」生成，这样演示数据永远停在设计好的那几档，
   不会因为放几个月就全部过期。 */
function empSeedStaff() {
  const t = empToday();
  const d = n => empShiftDate(t, n);
  const mk = (id, name, store, role, level, status, entry, contract, opts = {}) => {
  const seedDocs = { ...(opts.docs || {}) };
  /* 在册的老员工合同早就签了，默认归档；入职中的那几位没有 —— 新人清单上正好是红的那一项。 */
  if (status !== "invited" && !seedDocs.contract) seedDocs.contract = { state: "ok", file: `arbeitsvertrag_${id}.pdf` };
  return {
    id, name, store, role, level, status, entryDate: entry,
    probationEnd: opts.probationEnd || null,
    birthday: opts.birthday || "",
    contract,
    leave: opts.leave || null,
    history: opts.history || [],
    contact: {
      /* email 写成 "" 是「这个人真的没邮箱」，不是「没写所以给个默认」—— 用 == null 分开这两件事 */
      phone: opts.phone || "", email: opts.email == null ? `${id}@example.com` : opts.email,
      street: opts.street || "Hauptstrasse", houseNo: opts.houseNo || "12",
      zip: opts.zip || "44135", city: opts.city || "Dortmund",
      emergency: opts.emergency || "", language: opts.language || "Deutsch",
      notifyBy: opts.notifyBy || "Email",
      krankenkasse: opts.krankenkasse || ""
    },
    ids: {
      steuernummer: opts.steuernummer || "", rentenversicherung: opts.rv || "",
      iban: opts.iban || "", bic: opts.bic || ""
    },
    docs: seedDocs,
    note: opts.note || ""
  }; };
  /* contract：type=合同类型 id，payType=hourly|pauschal，rate=€/h 或 €/月，
     hoursMin/hoursMax=月度规定工时区间，urlaubDays=年假天数 */
  const C = (type, payType, rate, hoursMin, hoursMax, urlaubDays, extra = {}) =>
    ({ type, payType, rate, hoursMin, hoursMax, urlaubDays,
       noticePeriod: extra.noticePeriod || "4 Wochen zum 15. oder Monatsende",
       befristetUntil: extra.befristetUntil || null,
       isStudent: extra.isStudent || false, nonEU: extra.nonEU || false });
  /* docs：{ 证件id: { state:"ok"|"missing", expiry:"YYYY-MM-DD"|null } } */
  const D = obj => obj;

  return [
    mk("e01", "Olivia", "Martin Biergarten", "manager", "lead", "active", "2022-04-01",
      C("vollzeit", "hourly", 17.0, 150, 173, 28),
      { phone: "+49 171 100200", note: "最多上 5 天",
        iban: "DE89 3704 0044 0532 0130 00", bic: "COBADEFFXXX",
        steuernummer: "314/158/60000", rv: "12 123456 O 001",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(410) } }) }),

    mk("e02", "Kevin", "Martin Biergarten", "kitchen", "skilled", "active", "2024-03-12",
      C("vollzeit", "hourly", 15.5, 140, 160, 24),
      { phone: "+49 171 234567", language: "中文 / Deutsch", notifyBy: "WhatsApp",
        emergency: "Anna · +49 170 998877",
        iban: "DE83 3704 0044 0532 0130 11", bic: "COBADEFFXXX",
        steuernummer: "123/456/78901", rv: "12 123456 K 789",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(298) } }) }),

    mk("e03", "Lisa", "Martin Biergarten", "front", "basic", "active", "2024-06-01",
      C("teilzeit", "hourly", 13.5, 60, 80, 18, { nonEU: true }),
      { phone: "+49 176 981234", emergency: "Tom · +49 172 445566", notifyBy: "Email",
        iban: "DE44 5001 0517 5407 3249 31", bic: "INGDDEFFXXX",
        steuernummer: "314/158/60123", rv: "12 123456 L 456",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  residence: { state: "ok", expiry: d(21) },
                  zusatz: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(180) } }) }),

    mk("e04", "Anna", "Martin Biergarten 2", "bar", "basic", "active", "2025-01-08",
      C("minijob", "hourly", 12.8, 30, 43, 12),
      { phone: "+49 175 661122", language: "中文",
        iban: "DE77 1001 0010 0123 4567 89", bic: "PBNKDEFFXXX",
        steuernummer: "314/158/60456", rv: "12 123456 A 234",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(12) } }) }),

    mk("e05", "Tom", "Martin Cafe", "manager", "lead", "probation", "2026-07-20",
      C("vollzeit", "hourly", 18.0, 150, 173, 24),
      { phone: "+49 173 882211", probationEnd: empShiftDate(empToday(), 21),
        emergency: "Maria · +49 174 223344", notifyBy: "WhatsApp",
        iban: "DE33 1203 0000 0020 2020 20", bic: "BYLADEM1001",
        steuernummer: "314/158/60789", rv: "12 123456 T 567",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "missing" } }) }),

    mk("e06", "Maria", "Martin Cafe", "front", "skilled", "active", "2023-09-15",
      C("teilzeit", "pauschal", 1200, 60, 80, 20),
      { phone: "+49 174 223344",
        iban: "DE27 3005 0110 0300 3456 78", bic: "DUSSDEDDXXX",
        steuernummer: "314/158/61011", rv: "12 123456 M 890",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(520) } }) }),

    mk("e07", "Sophia", "Martin Biergarten", "front", "skilled", "active", "2023-05-02",
      C("teilzeit", "hourly", 13.8, 60, 80, 20),
      { phone: "+49 170 445511", note: "最多上 4 天",
        iban: "DE79 3704 0044 0111 2222 33", bic: "COBADEFFXXX",
        steuernummer: "314/158/61213", rv: "12 123456 S 112",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(240) } }) }),

    mk("e08", "Noah", "Martin Biergarten", "front", "basic", "active", "2025-03-10",
      C("minijob", "hourly", 12.8, 30, 43, 12),
      { phone: "+49 170 778899", note: "偏好午班",
        iban: "DE37 3704 0044 0999 8888 77", bic: "COBADEFFXXX",
        steuernummer: "314/158/61415", rv: "12 123456 N 334",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(75) } }) }),

    mk("e09", "James", "Martin Biergarten", "kitchen", "skilled", "active", "2022-11-07",
      C("vollzeit", "hourly", 16.2, 150, 173, 26),
      { phone: "+49 172 556677", note: "可补周末后厨",
        iban: "DE41 3704 0044 0777 6666 55", bic: "COBADEFFXXX",
        steuernummer: "314/158/61617", rv: "12 123456 J 556",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(150) } }) }),

    mk("e10", "Liam", "Martin Biergarten", "kitchen", "basic", "active", "2025-06-16",
      C("minijob", "hourly", 12.8, 30, 43, 12, { nonEU: true }),
      { phone: "+49 176 334455", note: "还没提交报班",
        iban: "DE45 3704 0044 0555 4444 33", bic: "COBADEFFXXX",
        steuernummer: "314/158/61819", rv: "12 123456 I 778",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  residence: { state: "ok", expiry: d(-9) },
                  zusatz: { state: "missing" },
                  belehrung: { state: "ok", expiry: d(320) } }) }),

    mk("e11", "Chloe", "Martin Biergarten 2", "bar", "skilled", "active", "2024-10-01",
      C("werkstudent", "hourly", 14.0, 40, 80, 20, { isStudent: true }),
      { phone: "+49 171 909090", note: "想多上周末",
        iban: "DE49 3704 0044 0333 2222 11", bic: "COBADEFFXXX",
        steuernummer: "314/158/62021", rv: "12 123456 C 990",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  student: { state: "ok", expiry: d(58) },
                  belehrung: { state: "ok", expiry: d(365) } }) }),

    mk("e12", "Emma", "Martin Cafe", "clean", "basic", "active", "2024-02-19",
      C("minijob", "hourly", 12.6, 30, 43, 12),
      { phone: "+49 175 121212", note: "只排早班",
        iban: "DE33 3704 0044 0121 2121 21", bic: "COBADEFFXXX",
        steuernummer: "314/158/62223", rv: "12 123456 E 112",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  belehrung: { state: "ok", expiry: d(430) } }) }),

    mk("e13", "Nico", "Martin Cafe", "clean", "basic", "active", "2026-08-04",
      C("minijob", "hourly", 12.5, 30, 43, 12),
      /* 邮箱也空着：他是「资料不全」那个样本，顺带演示「没邮箱就开不出员工账号」 */
      { phone: "", email: "", notifyBy: "短信",
        iban: "", bic: "", steuernummer: "", rv: "",
        docs: D({ id: { state: "ok" }, kv: { state: "missing" }, bank: { state: "missing" },
                  belehrung: { state: "missing" } }) }),

    mk("e14", "张三", "Martin Cafe", "kitchen", "basic", "left", "2025-02-15",
      C("werkstudent", "hourly", 14.2, 40, 80, 20, { isStudent: true }),
      { phone: "+49 176 313131", language: "中文",
        iban: "DE31 3704 0044 0313 1313 13", bic: "COBADEFFXXX",
        steuernummer: "314/158/62425", rv: "12 123456 Z 314",
        docs: D({ id: { state: "ok" }, kv: { state: "ok" }, bank: { state: "ok" },
                  student: { state: "missing" },
                  belehrung: { state: "ok", expiry: d(90) } }) }),

    mk("e15", "Jonas", "Martin Biergarten", "front", "basic", "invited", "",
      C("teilzeit", "hourly", 13.2, 60, 80, 18),
      { email: "jonas@example.com", phone: "", docs: D({}) }),

    mk("e16", "Yuki", "Martin Cafe", "kitchen", "basic", "invited", "",
      C("minijob", "hourly", 12.8, 30, 43, 12, { nonEU: true }),
      { email: "yuki@example.com", phone: "", docs: D({}) }),

    mk("e17", "Ben", "Martin Biergarten 2", "bar", "basic", "invited", "",
      C("teilzeit", "hourly", 13.0, 60, 80, 18),
      { email: "ben@example.com", phone: "", docs: D({}) }),

    /* 审核刚通过、还没上工的新人。加这一位是因为审查发现：
       新人清单在演示数据里一个都看不见，必须自己完整走一遍入职流程才出现 ——
       等于这个功能对着数据打不开。他也是唯一一个合同还没归档的人。 */
    mk("e18", "Marco", "Martin Biergarten", "front", "basic", "probation", empShiftDate(t, 3),
      C("teilzeit", "hourly", 13.2, 60, 80, 18),
      { email: "marco@example.com", phone: "+49 176 707070",
        street: "Lindenstrasse", houseNo: "5", zip: "44137", city: "Dortmund",
        krankenkasse: "AOK", steuernummer: "314/158/64010", rv: "12 123456 M 010",
        iban: "DE25 3704 0044 0808 0808 08", bic: "COBADEFFXXX",
        probationEnd: empAddMonths(empShiftDate(t, 3), 6),
        docs: D({ id: { state: "ok", file: "personalausweis_marco.jpg" },
                  kv: { state: "ok", file: "aok.jpg" }, bank: { state: "ok", file: "iban.pdf" },
                  contract: { state: "missing" },
                  belehrung: { state: "ok", expiry: empShiftDate(t, 690), file: "belehrung_marco.pdf" } }) })
  ].map(e => empSeedInvite(e, t)).map(e => empSeedProfile(e, t)).map(empSeedFileRefs);
}

/* 种子里那些文件名标成 demo：点开是一张写着「这是演示文件」的占位图。
   不这么做的话，附件这个功能在演示数据上永远点不开，只有当场传一份才看得见 ——
   一个只有自己操作过才存在的功能，演示时等于不存在。 */
function empSeedFileRefs(e) {
  const mark = docs => {
    Object.values(docs || {}).forEach(d => { if (d && d.file && !d.ref) d.ref = "demo"; });
  };
  mark(e.docs);
  mark(e.invite?.submitted?.docs);
  if (e.invite?.submitted?.contractFile && !e.invite.submitted.contractRef) e.invite.submitted.contractRef = "demo";
  return e;
}

/* 生日、医保、定期合同、离职记录、变更历史 —— 在 mk() 之外补，
   免得上面十七个块每个都加五行。留两个人资料不全，用来演示「资料缺失」预警。 */
function empSeedProfile(e, today) {
  /* Marco 的入职记录。放这儿不放 empSeedInvite 是因为那个函数第一行就
     `if (e.status !== "invited") return e` —— 他已经审核通过了，进不去。 */
  if (e.id === "e18") {
    const ago = d => new Date(`${empShiftDate(today, -d)}T10:00:00`).toISOString();
    e.invite = { token: empToken(), lang: "zh", createdAt: ago(12), reminders: [], returnNote: "",
                 submitted: {}, state: "approved", sentAt: ago(12), submittedAt: ago(9), reviewedAt: ago(8) };
    e.onboardingTasks = {};
  }
  const birthdays = {
    e01: "1988-03-14", e02: "1993-11-02", e03: "1999-06-21", e04: "1996-01-30",
    e05: "1990-08-09", e06: "1985-05-17", e07: "1994-02-25", e08: "2001-09-12",
    e09: "1987-12-01", e10: "2000-04-18", e11: "2002-07-07", e12: "1992-10-23",
    e14: "1998-03-03", e16: "1997-05-19", e17: "1995-11-11", e18: "1999-04-27"
    /* e13 Nico 和 e15 Jonas 故意不填：新人资料还没补齐 */
  };
  const kassen = {
    e01: "AOK Nordwest", e02: "TK", e03: "Barmer", e04: "AOK Nordwest",
    e05: "DAK-Gesundheit", e06: "TK", e07: "Barmer", e08: "AOK Nordwest",
    e09: "TK", e10: "AOK Nordwest", e11: "TK", e12: "Barmer", e14: "TK"
  };
  if (birthdays[e.id]) e.birthday = birthdays[e.id];
  if (kassen[e.id]) e.contact.krankenkasse = kassen[e.id];

  /* Maria 是定期合同，40 天后到期 —— 到期不续就是自动终止，忘了处理最麻烦 */
  if (e.id === "e06") e.contract.befristetUntil = empShiftDate(today, 40);

  /* 张三已经离职，档案按保留期留着 */
  if (e.id === "e14") {
    e.leave = { type: "resign", noticeDate: empShiftDate(today, -75), lastDay: empShiftDate(today, -40),
                reason: "回国继续学业" };
    e.history = [
      { at: `${empShiftDate(today, -75)}T10:12:00.000Z`, field: "status", from: "active", to: "left", by: "Martin" }
    ];
  }
  /* 给两个人一点变更历史，不然「变更记录」这个标签页永远是空的 */
  if (e.id === "e02") e.history = [
    { at: `${empShiftDate(today, -220)}T09:30:00.000Z`, field: "contract.rate", from: 14.5, to: 15.5, by: "Martin" },
    { at: `${empShiftDate(today, -400)}T14:05:00.000Z`, field: "status", from: "probation", to: "active", by: "Martin" }
  ];
  if (e.id === "e03") e.history = [
    { at: `${empShiftDate(today, -150)}T11:00:00.000Z`, field: "contract.hoursMax", from: 60, to: 80, by: "Olivia" }
  ];
  /* 员工账号。种子里的人都是「早就在岗的」，账号早开好了、密码也自己改过；
     只留刚审核通过的 Marco 停在「还是初始密码」那一档 ——
     不然「初始密码 / 他已改过密码」这两种样子在演示数据里只看得到一种。
     没填邮箱的（Nico）自然就开不出来 —— 正好留一个「缺邮箱所以没账号」的样子，
     不用另外造。 */
  if (!empStatus(e.status).leaving && e.status !== "invited" && e.contact.email) {
    e.account = e.id === "e18"
      ? { user: e.contact.email, pass: "kv7m2xqp", temp: true, createdAt: `${empShiftDate(today, -8)}T10:00:00.000Z` }
      : { user: e.contact.email, pass: "kaispan123", temp: false,
          createdAt: `${empShiftDate(today, -200)}T10:00:00.000Z`, changedAt: `${empShiftDate(today, -199)}T20:10:00.000Z` };
  }
  return e;
}

/* 三个演示邀请，卡在三个不同的状态上 ——
   邀请列表如果只有一种状态，看不出这是个流程。 */
function empSeedInvite(e, today) {
  if (e.status !== "invited") return e;
  const ago = (days, hour) => new Date(`${empShiftDate(today, -days)}T${hour}:00:00`).toISOString();
  const base = { token: empToken(), lang: "zh", createdAt: ago(4, "09"), reminders: [], returnNote: "", submitted: {} };
  if (e.id === "e15") {
    /* 发出去 4 天没动静，催过一次 */
    e.invite = { ...base, state: "sent", sentAt: ago(4, "09"),
      reminders: [{ at: ago(1, "10"), kind: "remind" }] };
  }
  if (e.id === "e16") {
    /* 全填完了，等店长审核 —— 这条是「卡在审核」的样子 */
    e.invite = { ...base, state: "submitted", sentAt: ago(3, "11"), submittedAt: ago(1, "20"),
      submitted: {
        contact: { phone: "+49 176 505050", street: "Kaiserstrasse", houseNo: "8", zip: "44135", city: "Dortmund",
                   emergency: "Chloe · +49 171 909090", language: "中文 / Deutsch", notifyBy: "WhatsApp" },
        ids: { steuernummer: "314/158/63001", rentenversicherung: "12 123456 Y 001",
               iban: "DE27 3704 0044 0616 1616 16", bic: "COBADEFFXXX" },
        docs: { id: { state: "ok", file: "reisepass.pdf" },
                residence: { state: "ok", expiry: empShiftDate(today, 640), file: "aufenthaltstitel.jpg" },
                zusatz: { state: "ok", file: "zusatzblatt.pdf" },
                kv: { state: "ok", file: "krankenkasse.jpg" },
                bank: { state: "ok", file: "bankkarte.jpg" },
                belehrung: { state: "ok", expiry: empShiftDate(today, 700), file: "belehrung.pdf" } },
        contract: { urlaubDays: 14, noticePeriod: "4 Wochen zum Monatsende" },
        contractNote: "合同上写的年假是 14 天，跟这里的 12 天不一样，麻烦确认一下。",
        contractFile: "arbeitsvertrag_yuki.pdf"
      } };
  }
  if (e.id === "e17") {
    /* 交了但店长退回了 */
    e.invite = { ...base, state: "returned", sentAt: ago(6, "09"), submittedAt: ago(3, "18"),
      reviewedAt: ago(2, "09"), returnNote: "健康证 Belehrung 拍得看不清到期日，麻烦重拍一张。",
      submitted: {
        contact: { phone: "+49 170 616161", street: "Bergstrasse", houseNo: "22", zip: "44139", city: "Dortmund",
                   emergency: "", language: "Deutsch", notifyBy: "Email" },
        ids: { steuernummer: "314/158/63002", rentenversicherung: "12 123456 B 002",
               iban: "DE58 3704 0044 0717 1717 17", bic: "COBADEFFXXX" },
        docs: { id: { state: "ok", file: "personalausweis.jpg" },
                kv: { state: "ok", file: "kk.jpg" },
                bank: { state: "ok", file: "iban.pdf" },
                belehrung: { state: "ok", expiry: null, file: "belehrung_unscharf.jpg" } }
      } };
  }
  return e;
}

/* -------------------------------------------------------------- 档案读写 --- */
function empAllStaff() {
  const saved = empRead(EMP_STAFF_KEY, null);
  if (saved && saved.length) {
    /* 2026-09-03：补件改为只走员工端。旧浏览器里若还留着邮件草稿或邮件请求，
       有账号的转成站内请求，没有账号的撤掉，避免页面继续出现两套流程。 */
    let changed = false;
    /* 2026-09-04 复审：状态是存下来的，可它是能算出来的 —— 试用期到没到、离没离职，
       看 probationEnd 和 leave.lastDay 就知道。存下来那一份只在「有人保存了这条记录」
       的时候才更新，于是试用期过了状态还挂在「试用期」：
       员工列表同一行上，状态标写着「试用期」（存的，旧的），
       右边「待处理」列写着「已过期」（算的，新的）—— 同一件事自相矛盾。
       代码注释里还写着「试用期过了不用点转正，状态自己变」，那句话原来是假的。
       现在读的时候就归一，变了才写回去（不是每次读都写）。 */
    saved.forEach(e => {
      const fresh = empDeriveStatus(e);
      if (e.status !== fresh) { e.status = fresh; changed = true; }
    });
    saved.forEach(e => {
      if (!e.request || e.request.state === "done") return;
      if (e.request.state === "draft" || (e.request.state === "sent" && e.request.via === "mail")) {
        if (empAccountActive(e)) {
          e.request.state = "sent";
          e.request.via = "app";
          e.request.sentAt = e.request.sentAt || empNow();
          delete e.request.lang;
          delete e.request.reminders;
        } else {
          e.request = null;
        }
        changed = true;
      }
    });
    if (changed) empWrite(EMP_STAFF_KEY, saved);
    return saved;
  }
  const seed = empSeedStaff();
  empWrite(EMP_STAFF_KEY, seed);
  return seed;
}

/* 在岗名册：不含离职和邀请中。store 省略即全部门店。 */
function empStaff(store) {
  return empAllStaff().filter(e => !empStatus(e.status).leaving && (!store || e.store === store));
}

/* 含离职和邀请中，档案页用 */
function empRoster(store) {
  return empAllStaff().filter(e => !store || e.store === store);
}

function empById(id) {
  return empAllStaff().find(e => e.id === id) || null;
}

function empByName(name) {
  return empAllStaff().find(e => e.name === name) || null;
}

function empSaveStaff(employee) {
  const list = empAllStaff();
  const index = list.findIndex(e => e.id === employee.id);
  if (index >= 0) list[index] = employee; else list.push(employee);
  empWrite(EMP_STAFF_KEY, list);
  return employee;
}

function empNextId() {
  const list = empAllStaff();
  let n = 1;
  while (list.some(e => e.id === `e${String(n).padStart(2, "0")}`)) n += 1;
  return `e${String(n).padStart(2, "0")}`;
}

/* ==================================================== 证件到期判定（核心） ===
   返回 { level, days, label }
   level：missing 未上传必需件 / expired 已过期 / warn 预警期内 /
          soon 关注期内 / ok 正常 / na 这个人不需要这份证件
   ========================================================================== */
function empDocNeeded(employee, type) {
  if (type.need === "all") return true;
  if (type.need === "student") return !!employee.contract?.isStudent;
  if (type.need === "nonEU") return !!employee.contract?.nonEU;
  return false;
}

function empDocState(employee, typeId, today) {
  const type = empDocType(typeId);
  const doc = employee.docs?.[typeId];
  if (!empDocNeeded(employee, type)) return { level: "na", days: null };
  if (!doc || doc.state === "missing") return { level: "missing", days: null };
  if (!type.expiry || !doc.expiry) return { level: "ok", days: null };
  const days = empDaysBetween(today || empToday(), doc.expiry);
  if (days < 0) return { level: "expired", days };
  if (days <= empRule("docWarnDays")) return { level: "warn", days };
  if (days <= empRule("docSoonDays")) return { level: "soon", days };
  return { level: "ok", days };
}

const EMP_DOC_LEVELS = {
  missing: { tone: "red", rank: 1, name: { zh: "缺", de: "Fehlt" } },
  expired: { tone: "red", rank: 0, name: { zh: "已过期", de: "Abgelaufen" } },
  warn: { tone: "orange", rank: 2, name: { zh: "即将到期", de: "Läuft bald ab" } },
  soon: { tone: "blue", rank: 3, name: { zh: "需关注", de: "Beobachten" } },
  ok: { tone: "green", rank: 4, name: { zh: "正常", de: "In Ordnung" } },
  na: { tone: "gray", rank: 5, name: { zh: "不适用", de: "Nicht relevant" } }
};

/* 全店预警清单，按严重度再按剩余天数排序。只含在岗员工。 */
function empDocAlerts(store, today) {
  const day = today || empToday();
  const out = [];
  empStaff(store).forEach(employee => {
    EMP_DOC_TYPES.forEach(type => {
      const s = empDocState(employee, type.id, day);
      if (s.level === "ok" || s.level === "na") return;
      out.push({ employee, type, level: s.level, days: s.days });
    });
  });
  return out.sort((a, b) => {
    const r = EMP_DOC_LEVELS[a.level].rank - EMP_DOC_LEVELS[b.level].rank;
    if (r) return r;
    if (a.days == null) return 1;
    if (b.days == null) return -1;
    return a.days - b.days;
  });
}

/* ================================================ 人事提醒（不止证件） =====
   第一版只看证件。但试用期结束日 `probationEnd` 当时是「只存不读」——
   存了、在表单里显示了，全站没有任何地方拿它算过事。定期合同到期同理。
   这两件漏了的后果比证件过期还贵：试用期一过，解约通知期就从两周变成合同约定的长度；
   定期合同到期不处理就是自动终止。所以把提醒做成一个统一的清单。
   ========================================================================== */
const EMP_ALERT_KINDS = {
  doc: { name: { zh: "证件", de: "Dokument" } },
  probation: { name: { zh: "试用期", de: "Probezeit" } },
  befristet: { name: { zh: "定期合同", de: "Befristung" } },
  profile: { name: { zh: "资料", de: "Stammdaten" } },
  newhire: { name: { zh: "新人上工", de: "Arbeitsaufnahme" } }
};

/* 工资和社保申报少不了的字段。缺了不是「不好看」，是报不上去。 */
const EMP_KEY_FIELDS = [
  { path: "birthday", name: { zh: "出生日期", de: "Geburtsdatum" }, why: { zh: "社保申报必填", de: "Für die Sozialversicherung nötig" } },
  { path: "ids.steuernummer", name: { zh: "Steuernummer", de: "Steuernummer" }, why: { zh: "工资申报必填", de: "Für die Lohnabrechnung nötig" } },
  { path: "ids.rentenversicherung", name: { zh: "Rentenversicherung Nr.", de: "Rentenversicherung Nr." }, why: { zh: "社保申报必填", de: "Für die Sozialversicherung nötig" } },
  { path: "ids.iban", name: { zh: "IBAN", de: "IBAN" }, why: { zh: "发不了工资", de: "Ohne IBAN keine Lohnzahlung" } },
  { path: "contact.krankenkasse", name: { zh: "保险公司名称", de: "Krankenkasse" }, why: { zh: "社保申报必填", de: "Für die Sozialversicherung nötig" } }
];

/* 按天数落到哪一档。到期类的提醒统一走这里，免得三处各写一套阈值。 */
function empLevelByDays(days, warnDays, soonDays) {
  const warn = warnDays == null ? empRule("docWarnDays") : warnDays;
  const soon = soonDays == null ? empRule("docSoonDays") : soonDays;
  if (days < 0) return "expired";
  if (days <= warn) return "warn";
  if (days <= soon) return "soon";
  return "ok";
}

/* 一个人身上所有待处理的事，最严重的排最前。资料页的待办条和列表的「待处理」列都读它。 */
function empAlertsFor(e, today) {
  const day = today || empToday();
  const out = [];
  if (empStatus(e.status).leaving) return out;   /* 离职和入职中的不进提醒 */

  EMP_DOC_TYPES.forEach(type => {
    const st = empDocState(e, type.id, day);
    if (st.level === "ok" || st.level === "na") return;
    out.push({ kind: "doc", employee: e, type, level: st.level, days: st.days,
               title: empRaw(type.name), date: e.docs?.[type.id]?.expiry || null });
  });

  if (e.status === "probation" && e.probationEnd) {
    const days = empDaysBetween(day, e.probationEnd);
    /* 试用期只有「到了提醒窗口」和「还早」两种，不套证件那个 90 天关注档 ——
       提前三个月提醒转正没有意义，到了窗口才要做决定。 */
    const level = empLevelByDays(days, empRule("probationWarnDays"), empRule("probationWarnDays"));
    if (level !== "ok") out.push({ kind: "probation", employee: e, level, days,
      title: empRaw({ zh: "试用期结束", de: "Ende der Probezeit" }), date: e.probationEnd });
  }

  if (e.contract?.befristetUntil) {
    const days = empDaysBetween(day, e.contract.befristetUntil);
    const level = empLevelByDays(days);
    if (level !== "ok") out.push({ kind: "befristet", employee: e, level, days,
      title: empRaw({ zh: "定期合同到期", de: "Befristung endet" }), date: e.contract.befristetUntil });
  }

  EMP_KEY_FIELDS.forEach(f => {
    const v = empGetPath(e, f.path);
    if (v == null || String(v).trim() === "") out.push({ kind: "profile", employee: e, level: "missing",
      days: null, title: empRaw(f.name), why: empRaw(f.why), path: f.path });
  });

  /* 新人清单：上工日之前没办完就该催，过了上工日还没办就是逾期 */
  if (empIsNewHire(e)) {
    const open = empNewHireOpen(e);
    const days = e.entryDate ? empDaysBetween(day, e.entryDate) : 0;
    out.push({ kind: "newhire", employee: e, level: days < 0 ? "expired" : "warn", days: days < 0 ? days : days,
      title: empRaw({ zh: `新人上工前还有 ${open.length} 件事`, de: `${open.length} Punkte vor Arbeitsaufnahme` }),
      why: open.map(t => empRaw(t.name)).join("、"), date: e.entryDate });
  }

  return out.sort((a, b) => {
    const r = EMP_DOC_LEVELS[a.level].rank - EMP_DOC_LEVELS[b.level].rank;
    if (r) return r;
    if (a.days == null) return 1;
    if (b.days == null) return -1;
    return a.days - b.days;
  });
}

/* 全店清单。主页预警区读它。 */
function empAlerts(store, today) {
  const day = today || empToday();
  const out = [];
  empStaff(store).forEach(e => out.push(...empAlertsFor(e, day)));
  return out.sort((a, b) => {
    const r = EMP_DOC_LEVELS[a.level].rank - EMP_DOC_LEVELS[b.level].rank;
    if (r) return r;
    if (a.days == null) return 1;
    if (b.days == null) return -1;
    return a.days - b.days;
  });
}

/* ================================================== 新人上工前的清单 ======
   走完「审核通过」流程只是档案建好了，人还上不了工。
   实测：通过之后系统一句话都没有 —— 待办是空的，也没提示还要办什么。
   这几件是德国餐饮开新人时绕不过去的，做成一张清单，办完打勾。

   ⚠️ 措辞上不替 Mingrong 拍板法规：即时申报是否适用、怎么报，写明「跟税务师确认」。
   能自动判定的（健康证有没有效）就不让人手动勾。
   ========================================================================== */
const EMP_NEWHIRE_TASKS = [
  { id: "sofort",
    name: { zh: "社保即时申报 Sofortmeldung", de: "Sofortmeldung zur Sozialversicherung" },
    note: { zh: "德国部分行业（餐饮在内）要求员工上工前就完成即时申报，晚了会罚。是否适用、由谁报，跟你的税务师确认一次。要交的数据下面已经凑齐了，缺哪项直接点过去补。",
            de: "In bestimmten Branchen (u. a. Gastgewerbe) ist die Sofortmeldung vor Arbeitsaufnahme vorgeschrieben. Zuständigkeit und Ablauf mit der Steuerberatung klären. Die zu meldenden Daten stehen unten." },
    auto: e => !!(e.sofortmeldung && e.sofortmeldung.at),
    panel: e => empSofortPanel(e) },
  { id: "contract",
    name: { zh: "劳动合同双方签字并归档", de: "Arbeitsvertrag beidseitig unterschrieben und abgelegt" },
    note: { zh: "归档位置是证件里的「劳动合同」那一份。员工在自填页传的审核通过时会自动进去；店长自己扫的直接在这儿传。",
            de: "Ablage erfolgt unter dem Dokument „Arbeitsvertrag“. Vom Mitarbeiter hochgeladene Verträge werden bei der Freigabe übernommen; eigene Scans direkt hier hochladen." },
    auto: e => empDocState(e, "contract").level === "ok",
    /* 上一版这里只给了一条「去证件页上传」的链接 —— 人在这张清单上，
       要办的事就该在这张清单上办完，跳过去再跳回来是白跑一趟。 */
    panel: e => empDocState(e, "contract").level === "ok"
      ? `<div class="emp-newhire-file is-done">${empFileLink(e.docs.contract) || empT("已归档", "Abgelegt")}
          <button class="ghost-btn danger-lite emp-newhire-doc-clear" data-id="${empEsc(e.id)}" data-doc="contract">${empT("换一份", "Ersetzen")}</button></div>`
      : `<div class="emp-newhire-file">
          <label class="emp-upload-btn">${empT("上传签好的合同", "Unterschriebenen Vertrag hochladen")}
            <input type="file" class="emp-newhire-doc-file" data-id="${empEsc(e.id)}" data-doc="contract"></label>
          <span class="small">${empT("传进去这一项自动打勾，同时归到证件里的「劳动合同」。", "Nach dem Hochladen wird der Punkt automatisch erledigt und unter „Arbeitsvertrag“ abgelegt.")}</span>
        </div>` },
  { id: "belehrung",
    name: { zh: "健康证 Belehrung 有效", de: "Belehrung §43 IfSG gültig" },
    note: { zh: "上工前必须有效。系统按档案里的到期日自动判断，不用手动勾。", de: "Muss vor Arbeitsaufnahme gültig sein — wird aus dem Ablaufdatum automatisch geprüft." },
    auto: e => { const st = empDocState(e, "belehrung"); return st.level === "ok" || st.level === "soon"; },
    fix: e => ({ href: `${empStaffHref(e.id)}&tab=docs`, name: { zh: "去证件页填到期日", de: "Ablaufdatum eintragen" } }) },
  { id: "shift",
    name: { zh: "排进第一周班表", de: "In den ersten Dienstplan aufgenommen" },
    note: { zh: "上工那一周的班表里有没有他的班，系统自己看，不用手动勾。", de: "Wird automatisch aus dem Dienstplan der Eintrittswoche geprüft." },
    /* 排班模块做完之后这一项就不该再手动勾了 —— 手动勾的意思是「我说排了就算排了」，
       而班表里到底有没有他的班，系统查得到。 */
    auto: e => empFirstWeekShift(e),
    fix: e => ({ href: `#${slug("employee", "排班管理")}${e.entryDate && typeof schWeekOf === "function" ? `?w=${schWeekOf(e.entryDate)}` : ""}`,
                 name: { zh: "去排他的第一周班", de: "Erste Woche einplanen" } }) },
  { id: "access",
    name: { zh: "钥匙 / 工牌 / 打卡方式交代清楚", de: "Schlüssel, Ausweis und Zeiterfassung übergeben" },
    note: { zh: "这一件只发生在店里，系统看不见，手动勾。", de: "Passiert nur im Betrieb — manuell abhaken." } }
];

/* ------------------------------------------------ 即时申报要交的那张数据单 ---
   原来第一项只有一段话和一个勾。店长看完那段话还是不知道该干什么 ——
   一个勾不叫闭环，叫备忘录。真正缺的是「要报哪些数据、我手上齐不齐、怎么交出去」。
   下面这张单子把公司侧（合规设置里填的）和员工侧（档案里的）拼到一起，
   缺的标红并给一条直达链接，凑齐了能一键复制给税务师，报完记一笔时间。 */
function empSofortRows(e) {
  const emp = empEmployer(e.store);
  const rules = { href: `#${slug("employee", "合规设置")}`, name: { zh: "去合规设置填", de: "In den Einstellungen ergänzen" } };
  const prof = { href: `${empStaffHref(e.id)}&tab=profile`, name: { zh: "去档案里补", de: "In der Akte ergänzen" } };
  const c = e.contact || {};
  const line1 = [c.street, c.houseNo].filter(Boolean).join(" ");
  const line2 = [c.zip, c.city].filter(Boolean).join(" ");
  const addr = line1 && line2 ? `${line1}, ${line2}` : (line1 || line2 || "");
  return [
    { name: { zh: "公司名称", de: "Firmenname" }, value: emp.legalName, fix: rules },
    { name: { zh: "Betriebsnummer", de: "Betriebsnummer" }, value: emp.betriebsnummer, fix: rules },
    { name: { zh: "经营地址", de: "Betriebsstätte" }, value: emp.address, fix: rules },
    { name: { zh: "员工姓名", de: "Name des Mitarbeiters" }, value: e.name, fix: prof },
    { name: { zh: "出生日期", de: "Geburtsdatum" }, value: e.birthday ? empFormatDate(e.birthday) : "", fix: prof },
    { name: { zh: "Rentenversicherung Nr.", de: "Rentenversicherung Nr." }, value: e.ids?.rentenversicherung, fix: prof },
    { name: { zh: "住址", de: "Anschrift" }, value: addr, fix: prof },
    { name: { zh: "上工日期", de: "Beginn der Beschäftigung" }, value: e.entryDate ? empFormatDate(e.entryDate) : "", fix: prof }
  ].map(r => ({ ...r, ok: r.value != null && String(r.value).trim() !== "" }));
}

function empSofortText(e) {
  return empSofortRows(e)
    .map(r => `${empRaw(r.name)}: ${r.ok ? r.value : empRaw({ zh: "【缺】", de: "[fehlt]" })}`)
    .join("\n");
}

function empSofortPanel(e) {
  const rows = empSofortRows(e);
  const gaps = rows.filter(r => !r.ok);
  const done = !!(e.sofortmeldung && e.sofortmeldung.at);
  if (done) return `<div class="emp-sofort is-done">
    <span>${empT(`已在 ${empStamp(e.sofortmeldung.at)} 记为申报完成。`, `Am ${empStamp(e.sofortmeldung.at)} als gemeldet vermerkt.`)}</span>
    <button class="ghost-btn danger-lite emp-sofort-undo" data-id="${empEsc(e.id)}">${empT("记错了，撤销", "Rückgängig")}</button>
  </div>`;
  return `<div class="emp-sofort">
    <div class="emp-sofort-head">
      <strong>${empT("要报上去的数据", "Zu meldende Daten")}</strong>
      ${gaps.length
        ? empPill("red", empT(`还缺 ${gaps.length} 项`, `${gaps.length} fehlen`))
        : empPill("green", empT("齐了", "Vollständig"))}
    </div>
    <table class="table emp-table emp-sofort-table"><tbody>
      ${rows.map(r => `<tr class="${r.ok ? "" : "is-missing"}">
        <td>${empText(r.name)}</td>
        <td>${r.ok ? empEsc(r.value) : `<span class="emp-miss">${empT("缺", "fehlt")}</span> <a href="${r.fix.href}">${empText(r.fix.name)}</a>`}</td>
      </tr>`).join("")}
    </tbody></table>
    <div class="emp-sofort-actions">
      <button class="ghost-btn emp-sofort-copy" data-id="${empEsc(e.id)}">${empT("复制这些数据", "Daten kopieren")}</button>
      <button class="ghost-btn emp-sofort-done" data-id="${empEsc(e.id)}"${gaps.length ? " disabled" : ""}>${empT("已经报上去了", "Wurde gemeldet")}</button>
      <span class="small">${gaps.length
        ? empT("缺的补齐了才能记为已申报。", "Erst nach Vervollständigung als gemeldet markierbar.")
        : empT("复制给税务师或自己在 sv.net 报，报完点右边这个记一笔。", "An die Steuerberatung schicken oder selbst über sv.net melden, danach hier vermerken.")}</span>
    </div>
  </div>`;
}

/* 记一笔「已申报」。这不是系统替你报了，是把「谁在什么时候报的」留在档案里 ——
   查账的时候要的就是这个时间点。 */
function empMarkSofort(id, on) {
  const e = empById(id);
  if (!e) return null;
  e.sofortmeldung = on ? { at: empNow() } : null;
  e.history = [...(e.history || []), {
    at: empNow(), field: "sofortmeldung",
    from: on ? "" : empRaw({ zh: "已申报", de: "gemeldet" }),
    to: on ? empRaw({ zh: "已申报", de: "gemeldet" }) : "",
    by: empRaw({ zh: "老板", de: "Inhaber" })
  }];
  return empSaveStaff(e);
}

/* 上工那一周的班表里有没有他的班。没定入职日期、排班模块没加载、那周还没排 —— 都算没有。
   ⚠️ 这里不能用 schRoster()：它读不到就会**顺手把种子班表写盘**。
   一个「判断这一项办没办完」的函数带着写盘的副作用，等于光是打开某个人的资料页
   就凭空生成一周班表 —— 考勤那边当场受影响（att.cjs 立刻红了两条）。只读着看。 */
function empFirstWeekShift(e) {
  if (!e.entryDate || typeof schWeekOf !== "function" || typeof schRosterAll !== "function") return false;
  const week = schWeekOf(e.entryDate);
  const saved = typeof schRosterKey === "function" ? schRosterAll()[schRosterKey(e.store, week)] : null;
  const roster = saved || (typeof schSeedRoster === "function" ? schSeedRoster(e.store, week) : null);
  return !!(roster && (roster.shifts || []).some(s => s.empId === e.id));
}

/* 店长在新人清单上直接传合同：跟证件页传的是同一份东西，走同一个归档位置。 */
function empUploadDoc(id, docId, file, ref) {
  const e = empById(id);
  if (!e || !file) return null;
  const next = JSON.parse(JSON.stringify(e));
  next.docs = { ...(next.docs || {}), [docId]: { state: "ok", file, ref, by: "manager", at: empNow() } };
  return empSaveWithHistory(next);
}

function empClearDoc(id, docId) {
  const e = empById(id);
  if (!e) return null;
  const next = JSON.parse(JSON.stringify(e));
  next.docs = { ...(next.docs || {}) };
  delete next.docs[docId];
  return empSaveWithHistory(next);
}

/* 这个人算不算「新人」：走过入职审核、已经在岗、清单还没办完。 */
function empIsNewHire(e) {
  if (empStatus(e.status).leaving) return false;
  if (!e.invite || e.invite.state !== "approved") return false;
  return empNewHireOpen(e).length > 0;
}

function empNewHireDone(e, task) {
  if (task.auto) return task.auto(e);
  return !!(e.onboardingTasks && e.onboardingTasks[task.id]);
}

function empNewHireOpen(e) {
  return EMP_NEWHIRE_TASKS.filter(t => !empNewHireDone(e, t));
}

function empSetNewHireTask(id, taskId, done) {
  const e = empById(id);
  if (!e) return null;
  e.onboardingTasks = { ...(e.onboardingTasks || {}), [taskId]: !!done };
  return empSaveStaff(e);
}

/* 五项全办完，卡片自己收起来（empIsNewHire 里 open.length === 0）。
   这里以前还有个 empFinishNewHire —— 一个「都办好了」按钮把所有非自动项一键打勾。
   加了即时申报数据单和合同归档之后它就该走了：三项能自动判的都有自己的出口，
   留着那个按钮只是给人一条绕过去的路，而绕过去正是「一个勾不叫闭环」的老毛病。 */

/* ==================================================== 补件请求 ============
   店长看到缺口后，只做一个动作：推送到员工端。员工在自己的「我的」页补齐，
   交回来后店长确认归档。补件不再生成邮件，也不再有第二个管理页面。

   token 仍然保留，它只是把员工端表单和这条请求关联起来，不再作为发给员工的链接。
   ========================================================================== */
const EMP_REQUEST_STATES = [
  { id: "sent", tone: "blue", name: { zh: "已推送员工端", de: "In Mitarbeiter-App" } },
  { id: "submitted", tone: "orange", name: { zh: "待确认", de: "Zur Prüfung" } }
];

function empRequestState(id) {
  return EMP_REQUEST_STATES.find(x => x.id === id) || EMP_REQUEST_STATES[0];
}

/* 把提醒清单转成「要补的项」。doc 用证件 id，profile 用字段路径。 */
function empAlertToItem(a) {
  return a.kind === "doc" ? { kind: "doc", id: a.type.id } : { kind: "field", path: a.path };
}

function empItemName(item) {
  if (item.kind === "doc") return empRaw(empDocType(item.id).name);
  const f = EMP_KEY_FIELDS.find(x => x.path === item.path);
  return f ? empRaw(f.name) : item.path;
}

/* 这个人现在缺的、能让员工自己补的项。合同到期和试用期不在内 —— 那是老板要做的决定。 */
function empTopupItems(e, today) {
  return empAlertsFor(e, today)
    .filter(a => a.kind === "doc" || a.kind === "profile")
    .map(empAlertToItem);
}

function empHasRequest(e) {
  return !!(e.request && e.request.state !== "done");
}

/* 一键推送。没有可用员工账号就不创建请求，避免又回到邮件和 App 两套入口。 */
function empSendRequest(id, note) {
  const e = empById(id);
  if (!e || !empAccountActive(e)) return null;
  const items = empTopupItems(e);
  if (!items.length) return null;
  const prev = empHasRequest(e) ? e.request : null;
  e.request = {
    token: prev?.token || empToken(),
    kind: "topup",
    state: "sent",
    items,
    note: note != null ? note : (prev?.note || ""),
    via: "app",
    sentAt: prev?.sentAt || empNow(),
    submitted: prev?.submitted || {}
  };
  return empSaveStaff(e);
}

function empCancelRequest(id) {
  const e = empById(id);
  if (!e || !e.request) return null;
  e.request = null;
  return empSaveStaff(e);
}

/* 员工那边填了多少 */
function empRequestProgress(e) {
  const sub = e.request?.submitted || {};
  const missing = [];
  (e.request?.items || []).forEach(item => {
    if (item.kind === "field") {
      const v = empGetPath(sub, item.path);
      if (!v || !String(v).trim()) missing.push(item);
      return;
    }
    const doc = sub.docs?.[item.id];
    if (!doc || doc.state !== "ok") { missing.push(item); return; }
    if (empDocType(item.id).expiry && !doc.expiry) missing.push({ ...item, needExpiry: true });
  });
  const total = (e.request?.items || []).length;
  return { total, done: total - missing.length, missing, complete: missing.length === 0 };
}

function empSubmitRequest(token) {
  const e = empByToken(token);
  if (!e || !empHasRequest(e)) return null;
  e.request.state = "submitted";
  e.request.submittedAt = empNow();
  return empSaveStaff(e);
}

function empSaveInviteDraftTopup(token, patch) { return empSaveRequestDraft(token, patch); }

function empSaveRequestDraft(token, patch) {
  const e = empByToken(token);
  if (!e || !empHasRequest(e)) return null;
  e.request.submitted = { ...(e.request.submitted || {}), ...patch };
  return empSaveStaff(e);
}

/* 采纳：把员工补的东西合并进正式档案，请求归档 */
function empAcceptRequest(id) {
  const e = empById(id);
  if (!e || !e.request) return null;
  const sub = e.request.submitted || {};
  const next = JSON.parse(JSON.stringify(e));
  if (sub.docs) next.docs = { ...(next.docs || {}), ...sub.docs };
  if (sub.contact) next.contact = { ...next.contact, ...sub.contact };
  if (sub.ids) next.ids = { ...next.ids, ...sub.ids };
  if (sub.birthday) next.birthday = sub.birthday;
  next.request = { ...next.request, state: "done", acceptedAt: empNow() };
  return empSaveWithHistory(next);
}

function empReturnRequest(id, note) {
  const e = empById(id);
  if (!e || !e.request) return null;
  e.request.state = "sent";
  e.request.note = note || "";
  e.request.returnedAt = empNow();
  return empSaveStaff(e);
}

/* ================================================================ 员工账号 ==
   员工端不再只是「店长发个链接」——他有自己的界面，就得有自己的账号。
   规则定死三条，别的都不做：
     · 用户名就是他自己的邮箱，不另发明一套工号 —— 少一个要记的东西。
     · 建档通过时自动开号，给一个初始密码，他第一次登录进去自己改。
     · 离职即失效。这一条不存字段，从 status 推 —— 存一个 active 字段迟早会跟
       离职状态各说各话（跟当初「在职状态」那个自由下拉犯的是同一个错）。
   密码在这个原型里是明文存在 localStorage 的，页面上照实说清楚，不装作有加密。 */
const EMP_PASS_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";   /* 去掉 l/1/o/0/i —— 电话里念不清 */

function empMakePassword() {
  let out = "";
  for (let i = 0; i < 8; i += 1) out += EMP_PASS_CHARS[Math.floor(Math.random() * EMP_PASS_CHARS.length)];
  return out;
}

/* 账号只在有邮箱的时候开得出来 —— 用户名就是邮箱 */
function empEnsureAccount(e) {
  const mail = (e.contact?.email || "").trim();
  if (!mail || e.account) return e.account || null;
  e.account = { user: mail, pass: empMakePassword(), temp: true, createdAt: empNow() };
  return e.account;
}

function empOpenAccount(id) {
  const e = empById(id);
  if (!e) return null;
  if (!empEnsureAccount(e)) return null;
  return empSaveStaff(e);
}

function empResetPassword(id) {
  const e = empById(id);
  if (!e || !e.account) return null;
  e.account = { ...e.account, pass: empMakePassword(), temp: true, resetAt: empNow() };
  return empSaveStaff(e);
}

function empSetPassword(id, pass) {
  const e = empById(id);
  if (!e || !e.account || !pass || String(pass).length < 6) return null;
  e.account = { ...e.account, pass: String(pass), temp: false, changedAt: empNow() };
  return empSaveStaff(e);
}

/* 离职的号自动作废，不用谁去关 */
function empAccountActive(e) {
  return !!(e && e.account && !empStatus(e.status).leaving);
}

function empLogin(user, pass) {
  const u = String(user || "").trim().toLowerCase();
  const hit = empAllStaff().find(e => e.account && String(e.account.user).toLowerCase() === u && e.account.pass === pass);
  if (!hit) return { ok: false, code: "bad" };
  if (!empAccountActive(hit)) return { ok: false, code: "left" };
  return { ok: true, employee: hit };
}

/* 把账号发给他。跟补件不一样：初始密码只能走邮件 —— 他还没登录，App 里没法通知。 */
function empAccountMail(e, lang) {
  const l = lang || (e.contact.language === "Deutsch" ? "de" : "zh");
  const link = `${location.origin}${location.pathname}#me`;
  const zh = {
    subject: `${e.store}：你的 KaiSpan 员工账号`,
    body: `${e.name} 你好，\n\n你的员工账号已经开好了，班表、报班、工时、要补交的材料都在里面：\n\n登录地址：${link}\n用户名：${e.account.user}\n初始密码：${e.account.pass}\n\n第一次登录后请自己改一个密码。有问题直接找店长。`
  };
  const de = {
    subject: `${e.store}: Ihr KaiSpan-Mitarbeiterzugang`,
    body: `Hallo ${e.name},\n\nIhr Zugang ist eingerichtet — Dienstplan, Zeiten melden, Stunden und fehlende Unterlagen finden Sie dort:\n\nLogin: ${link}\nBenutzername: ${e.account.user}\nStartpasswort: ${e.account.pass}\n\nBitte vergeben Sie nach der ersten Anmeldung ein eigenes Passwort.`
  };
  return l === "de" ? de : zh;
}

/* ================================================== 在职状态与生命周期 ===== */
/* ==================================================== 在职状态怎么来的 ====
   以前「在职状态」是个自由下拉，跟入职日期和试用期结束日各说各话：
   状态写着试用期但结束日是空的 —— 提醒直接静默失效，谁也不知道；
   状态写着在职但结束日在未来 —— 两个字段互相打架；
   入职 27 个月还标着试用期 —— 没有任何人拦一下。
   现在状态不再手选，由数据推出来，矛盾从源头上没了。

   规则：离职记录 > 试用期结束日 > 在职。
   「试用期结束日留空」就是「这个人没有试用期」，不需要另一个开关表达同一件事。
   试用期过了不用点转正 —— 德国实务里没解约就是自动转正，状态自己变。 */
function empDeriveStatus(e, today) {
  if (e.status === "invited") return "invited";
  if (e.leave && e.leave.lastDay) return "left";
  if (e.probationEnd && empDaysBetween(today || empToday(), e.probationEnd) >= 0) return "probation";
  return "active";
}

/* 存进去之前先把状态摆正，免得存下来的又是矛盾的 */
function empNormalizeStatus(e, today) {
  e.status = empDeriveStatus(e, today);
  return e;
}

/* 试用期设置对不对。返回一条要显示的问题，没问题就返回 null。 */
function empProbationIssue(e, today) {
  if (!e.probationEnd) return null;
  const day = today || empToday();
  if (e.entryDate && e.probationEnd < e.entryDate) {
    return { tone: "red", text: empT("试用期结束日排在入职日期前面，改一下。", "Das Ende der Probezeit liegt vor dem Eintrittsdatum.") };
  }
  if (e.entryDate) {
    const max = empAddMonths(e.entryDate, empRule("probationMonths"));
    if (e.probationEnd > max) {
      return { tone: "orange", text: empT(
        `比上限长：按合规设置试用期最多 ${empRule("probationMonths")} 个月，到 ${empFormatDate(max)} 为止。超过这个日期解约通知期按正式合同走，不再是试用期的短通知期。`,
        `Länger als zulässig: laut Einstellungen max. ${empRule("probationMonths")} Monate, also bis ${empFormatDate(max)}. Danach gilt die reguläre Kündigungsfrist.`) };
    }
  }
  if (empDaysBetween(day, e.probationEnd) < 0) {
    return { tone: "blue", text: empT(
      `试用期 ${empFormatDate(e.probationEnd)} 就结束了，这个人现在算正式员工。要留记录就把日期清空。`,
      `Die Probezeit endete am ${empFormatDate(e.probationEnd)} — die Person gilt jetzt als regulär beschäftigt.`) };
  }
  return null;
}

/* 在职时长。只在花名册显示，资料详情不再重复一遍。 */
function empTenure(e, today) {
  if (!e.entryDate) return null;
  const end = e.leave?.lastDay && empStatus(e.status).leaving ? e.leave.lastDay : (today || empToday());
  const days = empDaysBetween(e.entryDate, end);
  if (days < 0) return { days, months: 0, label: empRaw({ zh: "还没入职", de: "Noch nicht eingetreten" }) };
  const months = Math.floor(days / 30.44);
  const years = Math.floor(months / 12);
  const label = years >= 1
    ? empRaw({ zh: `${years} 年${months % 12 ? ` ${months % 12} 个月` : ""}`, de: `${years} J.${months % 12 ? ` ${months % 12} M.` : ""}` })
    : months >= 1 ? empRaw({ zh: `${months} 个月`, de: `${months} Mon.` })
                  : empRaw({ zh: `${days} 天`, de: `${days} Tage` });
  return { days, months, label };
}

const EMP_LEAVE_TYPES = [
  { id: "resign", name: { zh: "员工辞职", de: "Eigenkündigung" } },
  { id: "dismissal", name: { zh: "公司解约", de: "Kündigung durch den Betrieb" } },
  { id: "probation", name: { zh: "试用期内解约", de: "Kündigung in der Probezeit" } },
  { id: "befristet", name: { zh: "定期合同到期", de: "Ende der Befristung" } },
  { id: "mutual", name: { zh: "协商解除", de: "Aufhebungsvertrag" } }
];

function empLeaveType(id) {
  return EMP_LEAVE_TYPES.find(t => t.id === id) || EMP_LEAVE_TYPES[0];
}

/* 档案保留到哪天。离职不等于删档，税务和劳动法都要求留着。 */
function empRetentionUntil(e) {
  if (!e.leave?.lastDay) return null;
  const [y, m, d] = e.leave.lastDay.split("-");
  return `${Number(y) + empRule("recordRetentionYears")}-${m}-${d}`;
}

/* --------------------------------------------------------- 变更记录 ------ */
/* 只记有法律或金钱意义的字段。电话改了没人会回头查，时薪改了会。 */
const EMP_TRACKED = [
  { path: "status", name: { zh: "在职状态", de: "Status" } },
  { path: "store", name: { zh: "所属门店", de: "Filiale" } },
  { path: "role", name: { zh: "岗位", de: "Position" } },
  { path: "level", name: { zh: "员工级别", de: "Qualifikation" } },
  { path: "entryDate", name: { zh: "入职日期", de: "Eintritt" } },
  { path: "probationEnd", name: { zh: "试用期结束", de: "Ende Probezeit" } },
  { path: "contract.type", name: { zh: "合同类型", de: "Vertragsart" } },
  { path: "contract.payType", name: { zh: "薪资方式", de: "Vergütungsart" } },
  { path: "contract.rate", name: { zh: "薪资金额", de: "Betrag" } },
  { path: "contract.hoursMin", name: { zh: "月工时下限", de: "Sollstunden min." } },
  { path: "contract.hoursMax", name: { zh: "月工时上限", de: "Sollstunden max." } },
  { path: "contract.urlaubDays", name: { zh: "年假天数", de: "Urlaubstage" } },
  { path: "contract.befristetUntil", name: { zh: "定期合同到期", de: "Befristung bis" } },
  /* 下面这几条是审查补的。原来 14 项里没有它们，改了一行记录都不留：
     - Kündigungsfrist 是合同里法律后果最直接的字段之一
     - isStudent / nonEU 这两个开关直接决定这个人要交哪几份证件，
       一改整张证件表就变了，改错了事后查不出来是谁改的
     - 社保号、税号、保险公司错了，之前报上去的全是错的 */
  { path: "contract.noticePeriod", name: { zh: "解约通知期", de: "Kündigungsfrist" } },
  { path: "contract.isStudent", name: { zh: "学生身份", de: "Studentenstatus" } },
  { path: "contract.nonEU", name: { zh: "非欧盟身份", de: "Nicht-EU-Staatsangehörigkeit" } },
  { path: "ids.iban", name: { zh: "IBAN", de: "IBAN" } },
  { path: "ids.steuernummer", name: { zh: "Steuernummer", de: "Steuernummer" } },
  { path: "ids.rentenversicherung", name: { zh: "Rentenversicherung Nr.", de: "Rentenversicherung Nr." } },
  { path: "contact.krankenkasse", name: { zh: "保险公司", de: "Krankenkasse" } }
  /* 地址、电话这些故意不记：改得勤、法律后果轻，记进来只会把变更记录冲成流水账。 */
];

/* 变更记录里几个不是「字段被改了」而是「发生了一件事」的条目 */
const EMP_EVENTS = {
  onboarding: { zh: "入职审核通过", de: "Einstellung freigegeben" }
};

function empTrackedField(path) {
  if (EMP_EVENTS[path]) return { path, name: EMP_EVENTS[path] };
  if (path.startsWith("docs.")) {
    const t = EMP_DOC_TYPES.find(x => path === `docs.${x.id}`);
    if (t) return { path, name: { zh: `${empRaw(t.name)}（证件）`, de: `${t.name.de} (Dokument)` } };
  }
  return EMP_TRACKED.find(f => f.path === path) || null;
}

/* 证件的变化不是一个标量字段，单独比。记「换了文件」和「到期日从 A 改成 B」两件事 ——
   查工问「你什么时候核过他的居留卡」，答案得在变更记录里查得到。 */
function empDocDiffs(prev, next) {
  const out = [];
  EMP_DOC_TYPES.forEach(t => {
    const a = prev?.docs?.[t.id] || {};
    const b = next?.docs?.[t.id] || {};
    const label = v => [v.state === "ok" ? (v.file || empRaw({ zh: "已归档", de: "abgelegt" })) : "",
                        v.expiry ? empFormatDate(v.expiry) : ""].filter(Boolean).join(" · ");
    const from = label(a);
    const to = label(b);
    if (from !== to) out.push({ path: `docs.${t.id}`, from, to });
  });
  return out;
}

/* 显示用：合同类型 id 之类的存的是内部值，记录里要看得懂 */
function empHistoryValue(path, value) {
  if (path === "onboarding") return value ? empFormatDate(value) : empRaw({ zh: "已通过", de: "Freigegeben" });
  if (value == null || value === "") return empRaw({ zh: "（空）", de: "(leer)" });
  if (path === "status") return empRaw(empStatus(value).name);
  if (path === "store") return String(value);
  if (path === "role") return empRaw(empRole(value).name);
  if (path === "level") return empRaw(empLevel(value).name);
  if (path === "contract.type") return empRaw(empContractType(value).name);
  if (path === "contract.payType") return value === "pauschal" ? empRaw({ zh: "Pauschal 月薪", de: "Pauschale" }) : empRaw({ zh: "时薪", de: "Stundenlohn" });
  if (path === "contract.rate") return `€${Number(value).toFixed(2)}`;
  return String(value);
}

/* 存档案时对比一遍，变了的写进 history。合并逻辑在这里，四个入口共用。 */
function empSaveWithHistory(next, by) {
  const prev = empById(next.id);
  const log = [...(next.history || prev?.history || [])];
  if (prev) {
    empDocDiffs(prev, next).forEach(d => {
      log.push({ at: empNow(), field: d.path, from: d.from, to: d.to,
                 by: by || empRaw({ zh: "老板", de: "Inhaber" }) });
    });
    EMP_TRACKED.forEach(f => {
      const a = empGetPath(prev, f.path);
      const b = empGetPath(next, f.path);
      if (String(a == null ? "" : a) === String(b == null ? "" : b)) return;
      log.push({ at: empNow(), field: f.path, from: a == null ? "" : a, to: b == null ? "" : b,
                 by: by || empRaw({ zh: "老板", de: "Inhaber" }) });
    });
  }
  next.history = log;
  return empSaveStaff(next);
}

/* 试用期转正 */
/* 提前转正 = 清空试用期结束日。状态跟着自己变，不用单独写一次。 */
function empConfirmProbation(id) {
  const e = empById(id);
  if (!e || !e.probationEnd) return null;
  const next = JSON.parse(JSON.stringify(e));
  next.probationEnd = null;
  empNormalizeStatus(next);
  return empSaveWithHistory(next);
}

/* 办理离职。档案不删，只是不再进在岗名册和提醒。 */
function empSetLeave(id, leave) {
  const e = empById(id);
  if (!e) return null;
  const next = JSON.parse(JSON.stringify(e));
  next.leave = { type: leave.type, noticeDate: leave.noticeDate || empToday(),
                 lastDay: leave.lastDay || empToday(), reason: leave.reason || "" };
  empNormalizeStatus(next);
  return empSaveWithHistory(next);
}

/* 误操作可以撤销，回到在职 */
function empUndoLeave(id) {
  const e = empById(id);
  if (!e || e.status !== "left") return null;
  const next = JSON.parse(JSON.stringify(e));
  next.leave = null;
  empNormalizeStatus(next);
  return empSaveWithHistory(next);
}

/* 最早的最后工作日：通知日 + 通知期。试用期内的通知期短得多，所以要分开算。
   返回 { weeks, earliest, source } —— source 说明这个数是哪来的，别让人以为是系统算的法规。 */
function empEarliestLastDay(e, noticeDate, type) {
  const inProbation = type === "probation" || (e.status === "probation");
  if (inProbation) {
    const weeks = empRule("probationNoticeWeeks");
    return { weeks, earliest: empShiftDate(noticeDate, weeks * 7),
             source: empRaw({ zh: "试用期内解约通知期（合规设置里可改）", de: "Kündigungsfrist in der Probezeit (in den Einstellungen änderbar)" }) };
  }
  return { weeks: null, earliest: null,
           source: empRaw({ zh: `合同约定：${e.contract?.noticePeriod || "未填"}`, de: `Laut Vertrag: ${e.contract?.noticePeriod || "nicht erfasst"}` }) };
}

/* ============================================================ 全站汇总 ===== */
/* 只放确实有人读的字段 —— HACCP 那次 haccpSummary 从 11 个砍到 3 个的教训。 */
function empSummary(store, today) {
  const day = today || empToday();
  const onDuty = empStaff(store);
  const alerts = empAlerts(store, day);
  return {
    headcount: onDuty.length,
    probation: onDuty.filter(e => e.status === "probation").length,
    invited: empRoster(store).filter(e => e.status === "invited").length,
    /* 员工已提交、等店长审核的 —— 卡在这一步不动就等于新人上不了岗 */
    review: empInvites(store).filter(e => e.invite.state === "submitted").length,
    /* 需要立刻处理的：已过期 + 未上传 + 预警期内 */
    urgent: alerts.filter(a => a.level !== "soon").length,
    alerts
  };
}

/* ==================================================== 入职邀请状态机 =======
   闭环：公司建档 → 发邀请邮件（含链接）→ 员工点链接自填 → 店长审核 → 进正式档案

     draft      建了档还没发邮件
     sent       邮件已发，等员工填（可催办、可撤销）
     submitted  员工提交了，等店长审核
     returned   店长退回补充，员工可以再改再交
     approved   审核通过，档案生效，人进在岗名册

   员工填的东西先放在 invite.submitted 这个暂存快照里，审核通过才合并进正式档案。
   这样店长审核时能逐项看到「公司填的 / 员工填的」，也不会有人没审核就进了名册。
   ========================================================================== */
const EMP_INVITE_STATES = [
  { id: "draft", tone: "gray", name: { zh: "待发送", de: "Nicht gesendet" } },
  { id: "sent", tone: "blue", name: { zh: "等员工填写", de: "Wartet auf Mitarbeiter" } },
  { id: "submitted", tone: "orange", name: { zh: "待审核", de: "Zur Prüfung" } },
  { id: "returned", tone: "red", name: { zh: "已退回", de: "Zurückgewiesen" } },
  { id: "approved", tone: "green", name: { zh: "已通过", de: "Freigegeben" } }
];

function empInviteState(id) {
  return EMP_INVITE_STATES.find(s => s.id === id) || EMP_INVITE_STATES[0];
}

/* 还在入职流程里的（已通过的就不算了，他们已经是正式档案） */
function empInvites(store) {
  return empRoster(store).filter(e => e.invite && e.invite.state !== "approved");
}

function empToken() {
  let t = "";
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  for (let i = 0; i < 16; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

/* 入职邀请和补件请求共用 #onboarding?t= 这条路由，所以两边的 token 都要认 */
function empByToken(token) {
  if (!token) return null;
  const list = empAllStaff();
  return list.find(e => e.invite && e.invite.token === token)
      || list.find(e => e.request && e.request.token === token && e.request.state !== "done")
      || null;
}

/* 这个 token 是入职的还是补件的 */
function empTokenKind(token) {
  const e = empByToken(token);
  if (!e) return null;
  if (e.invite && e.invite.token === token) return "onboarding";
  if (e.request && e.request.token === token) return "topup";
  return null;
}

function empInviteLink(e) {
  return `#onboarding?t=${encodeURIComponent(e.invite.token)}`;
}

function empNow() {
  return new Date().toISOString();
}

function empStamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = n => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${empFormatDate(date)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* 员工需要自己补齐的字段。docs 另算，因为要按合同条件过滤。 */
const EMP_SELF_FIELDS = [
  /* 出生日期和 Krankenkasse 以前不在这张表里 —— 结果新人审核一通过，
     立刻就出现在「需要处理」里欠着这两项。入职的时候就该一次收齐。 */
  { path: "birthday", name: { zh: "出生日期", de: "Geburtsdatum" } },
  { path: "contact.phone", name: { zh: "电话", de: "Telefon" } },
  { path: "contact.street", name: { zh: "街道", de: "Strasse" } },
  { path: "contact.houseNo", name: { zh: "门牌号", de: "Hausnummer" } },
  { path: "contact.zip", name: { zh: "邮编", de: "PLZ" } },
  { path: "contact.city", name: { zh: "城市", de: "Stadt" } },
  { path: "ids.steuernummer", name: { zh: "Steuernummer", de: "Steuernummer" } },
  { path: "ids.rentenversicherung", name: { zh: "Rentenversicherung Nr.", de: "Rentenversicherung Nr." } },
  { path: "ids.iban", name: { zh: "IBAN", de: "IBAN" } },
  { path: "contact.krankenkasse", name: { zh: "保险公司名称", de: "Krankenkasse" } }
];

function empGetPath(obj, path) {
  return path.split(".").reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

/* 员工自填的完成度。合同条件决定要几份证件，所以学生和非欧盟的人项数更多。 */
function empInviteProgress(e) {
  const sub = e.invite?.submitted || {};
  const missing = [];
  EMP_SELF_FIELDS.forEach(f => {
    const v = empGetPath(sub, f.path);
    if (!v || !String(v).trim()) missing.push({ kind: "field", name: f.name, path: f.path });
  });
  empSelfDocs(e).forEach(type => {
    const doc = sub.docs?.[type.id];
    if (!doc || doc.state !== "ok") { missing.push({ kind: "doc", name: type.name, path: type.id }); return; }
    if (type.expiry && !doc.expiry) missing.push({ kind: "expiry", name: type.name, path: type.id });
  });
  const total = EMP_SELF_FIELDS.length + empSelfDocs(e).length;
  return { total, done: total - missing.length, missing, complete: missing.length === 0 };
}

/* 邀请邮件正文。语言跟着邀请走，不跟界面走 —— 收信的是员工不是老板。 */
function empInviteMail(e, lang) {
  const l = lang || e.invite?.lang || "zh";
  const link = empInviteLink(e);
  const zh = {
    subject: `${e.store}：请填写您的入职资料`,
    body: `您好${e.name ? " " + e.name : ""}，

欢迎加入 ${e.store}。请点击下面的链接填写您的个人资料并上传证件：

${link}

需要准备：出生日期、身份证件、医保卡（哪一家）、银行账户信息（IBAN）、健康证 Belehrung${e.contract?.nonEU ? "、居留卡" : ""}${e.contract?.isStudent ? "、学生入学证明" : ""}。

填完提交后，店长会核对一遍，通过后您就正式进入排班和工资系统。

有问题直接回复这封邮件。`
  };
  const de = {
    subject: `${e.store}: Bitte Ihre Einstellungsunterlagen ausfüllen`,
    body: `Hallo${e.name ? " " + e.name : ""},

willkommen bei ${e.store}. Bitte füllen Sie über den folgenden Link Ihre Daten aus und laden Sie Ihre Dokumente hoch:

${link}

Bereithalten: Geburtsdatum, Ausweisdokument, Krankenkassenkarte (Name der Kasse), Bankverbindung (IBAN), Belehrung nach §43 IfSG${e.contract?.nonEU ? ", Aufenthaltstitel" : ""}${e.contract?.isStudent ? ", Immatrikulationsbescheinigung" : ""}.

Nach dem Absenden prüft die Filialleitung Ihre Angaben. Danach sind Sie im Dienstplan und in der Lohnabrechnung angelegt.

Bei Fragen antworten Sie einfach auf diese E-Mail.`
  };
  if (l === "de") return de;
  if (l === "both") return { subject: `${zh.subject} / ${de.subject}`, body: `${zh.body}

———

${de.body}` };
  return zh;
}

/* ------------------------------------------------------------ 状态迁移 --- */
function empSendInvite(id) {
  const e = empById(id);
  if (!e || !e.invite) return null;
  const first = !e.invite.sentAt;
  e.invite.state = "sent";
  e.invite.sentAt = e.invite.sentAt || empNow();
  if (!first) e.invite.reminders = [...(e.invite.reminders || []), { at: empNow(), kind: "resend" }];
  return empSaveStaff(e);
}

function empRemindInvite(id) {
  const e = empById(id);
  if (!e || !e.invite || e.invite.state === "approved") return null;
  e.invite.reminders = [...(e.invite.reminders || []), { at: empNow(), kind: "remind" }];
  return empSaveStaff(e);
}

function empRevokeInvite(id) {
  const list = empAllStaff().filter(x => x.id !== id);
  empWrite(EMP_STAFF_KEY, list);
}

/* 员工提交。只接受还在流程里的 token，已通过的链接失效。 */
function empSubmitInvite(token) {
  const e = empByToken(token);
  if (!e || !e.invite || e.invite.state === "approved") return null;
  e.invite.state = "submitted";
  e.invite.submittedAt = empNow();
  e.invite.returnNote = "";
  return empSaveStaff(e);
}

/* 员工每改一次就存一次暂存，别让人填一半刷新就没了 */
function empSaveInviteDraft(token, patch) {
  const e = empByToken(token);
  if (!e || !e.invite || e.invite.state === "approved") return null;
  e.invite.submitted = { ...(e.invite.submitted || {}), ...patch };
  e.invite.savedAt = empNow();
  return empSaveStaff(e);
}

function empReturnInvite(id, note) {
  const e = empById(id);
  if (!e || !e.invite) return null;
  e.invite.state = "returned";
  e.invite.returnNote = note || "";
  e.invite.reviewedAt = empNow();
  return empSaveStaff(e);
}

/* 审核通过：把暂存快照合并进正式档案，人进在岗名册 */
function empApproveInvite(id, options) {
  const e = empById(id);
  if (!e || !e.invite) return null;
  const sub = e.invite.submitted || {};
  e.contact = { ...e.contact, ...(sub.contact || {}) };
  e.ids = { ...e.ids, ...(sub.ids || {}) };
  e.docs = { ...(e.docs || {}), ...(sub.docs || {}) };
  /* 员工传的合同以前就断在这一行前面：进了 submitted.contractFile 就再没人管。
     现在归进 docs.contract —— 证件页查得到，新人清单据此自动打勾。 */
  if (sub.contractFile && !e.docs.contract?.file) {
    e.docs.contract = { state: "ok", file: sub.contractFile, ref: sub.contractRef, by: "self" };
  }
  if (sub.contract) e.contract = { ...e.contract, ...sub.contract };
  if (sub.name && String(sub.name).trim()) e.name = sub.name;
  if (sub.birthday) e.birthday = sub.birthday;
  if (options && options.entryDate) e.entryDate = options.entryDate;
  e.probationEnd = options && options.probationEnd ? options.probationEnd : null;
  e.status = "active";
  empNormalizeStatus(e);
  e.invite.state = "approved";
  e.invite.reviewedAt = empNow();
  /* 建档通过 = 这个人正式存在了，账号跟着开。没填邮箱就开不出来，
     资料页那张卡会写明白缺的是邮箱，而不是让人以为系统忘了。 */
  empEnsureAccount(e);
  /* 入职通过是档案里最该留痕的一件事（谁、什么时候、按什么条件进来的）。
     之前这里走的是 empSaveStaff，一条记录都没有 —— 离职记了，入职不记，不对称。 */
  e.history = [...(e.history || []), {
    at: empNow(), field: "onboarding", from: "", to: e.entryDate || empToday(),
    by: empRaw({ zh: "老板", de: "Inhaber" })
  }];
  return empSaveWithHistory(e);
}

/* ================================================================ 页面 ===== */
/* 说明：第 1 步只重做「档案 + 证件到期」这条链。排班 / 考勤 / 休假 / 工资
   四个模块仍是 app.js 里的示例页面，主页卡片上明确标「示例数据」，
   不假装它们已经接上真数据。

   语言：这里的页面自己出中德文（empT），外层 .emp-page 带 data-no-translate，
   全站那套「按词典全文替换 DOM」的翻译不进来。原因跟 HACCP 一样 ——
   这个模块大量文案是拼出来的（「在岗 13 人」「还有 2 项」「150–173h / 月」），
   词典匹配不到整串，硬走全站翻译只会得到「Aktiv 13 人」这种半截货。 */

function empT(zh, de) {
  return empDe() ? de : zh;
}

/* 页面外壳。data-no-translate 挡住全站翻译；.emp-page 同时让全站的
   「按钮说明」气泡跳过员工助手 —— 这里的按钮是真会存数据的，
   那段「程序实现时需要读取…」的说明放这儿就是错的。 */
/* 保存反馈。以前保存完直接 app() 重渲染，empFlash 那句「已保存」当场被冲掉，
   点了保存屏幕上什么都不变 —— 存没存全靠猜。这里记一笔，重渲染后照样显示得出来。 */
let empSavedMark = null;

function empMarkSaved(id) {
  empSavedMark = { id, at: Date.now() };
}

function empSavedBanner(id) {
  if (!empSavedMark || empSavedMark.id !== id) return "";
  if (Date.now() - empSavedMark.at > 8000) return "";
  return `<span class="emp-saved-tag">${empT("已保存", "Gespeichert")}</span>`;
}

function empPage(html) {
  return `<div data-no-translate class="emp-page">${html}</div>`;
}

function empPill(tone, text) {
  return `<span class="pill ${tone}">${text}</span>`;
}

function empDocLevelPill(level, kind) {
  const meta = EMP_DOC_LEVELS[level];
  /* 「出生日期未上传」是错的 —— 资料是填的，证件才是传的 */
  if (level === "missing") {
    return empPill(meta.tone, kind === "profile" ? empT("未填写", "Fehlt") : empT("未上传", "Fehlt"));
  }
  return empPill(meta.tone, empText(meta.name));
}

/* 剩余天数的人话：「已过期 9 天」「还有 12 天」 */
function empDaysLabel(days) {
  if (days == null) return "";
  if (days < 0) return empT(`已过期 ${-days} 天`, `seit ${-days} Tagen abgelaufen`);
  if (days === 0) return empT("今天到期", "läuft heute ab");
  return empT(`还有 ${days} 天`, `noch ${days} Tage`);
}

function empStaffHref(id) {
  return `#${slug("employee", "员工资料")}?id=${encodeURIComponent(id)}`;
}

function empBack(href, zh, de) {
  return `<a class="ghost-btn accent-back-btn" href="${href}">${empT("返回" + zh, "Zurück: " + de)}</a>`;
}

/* null 表示全部门店 */
function empScope() {
  if (typeof currentStore !== "function") return null;
  const store = currentStore();
  return store && empStores().includes(store) ? store : null;
}

/* ============================================================== 主页 ====== */
/* 版式（2026-09-03 Mingrong 定）：四张卡在上，一张汇总待办区在下。
   卡片回答「这一块是什么、现在什么状态」，下面回答「所以现在要我做什么」，
   两边用同一套颜色对上号。
   顶上那条状态条撤了 —— 在岗 / 试用期 / 入职中 / 待审核 员工档案那张卡里写过一遍，
   待处理事项下面整块都在说，状态条是第三遍。
   「入职邀请」那个按钮也撤了 —— 跟员工档案里的「新增员工」是同一件事的两个入口。 */
function employeeHomePage() {
  const store = empScope();
  const sum = empSummary(store);
  const urgent = sum.alerts.filter(a => a.level !== "soon");
  const soon = sum.alerts.filter(a => a.level === "soon");
  return `
    <div class="page-head">
      <div><h1>${empT("员工助手", "Mitarbeiterassistent")}</h1>
      <p>${empT("员工档案、证件到期、排班、考勤和工资资料集中在这里。", "Mitarbeiterakten, Dokumentfristen, Dienstplan, Zeiterfassung und Lohndaten an einem Ort.")}</p></div>
      <div class="button-row"><a class="ghost-btn" href="#${slug("employee", "合规设置")}">${empT("合规设置", "Compliance")}</a></div>
    </div>

    <section class="emp-modules">
      <a class="emp-module is-live is-mod-staff" href="#${slug("employee", "员工档案")}">
        <div class="emp-module-head"><h2>${empT("员工档案", "Mitarbeiterakte")}</h2>${urgent.length
          ? empPill("red", empT(`${urgent.length} 项待处理`, `${urgent.length} offen`))
          : empPill("green", empT("资料齐全", "Vollständig"))}</div>
        <p>${empT("资料、合同、证件、试用期与离职，一个人从入职到离职都在这里。", "Stammdaten, Vertrag, Dokumente, Probezeit und Austritt — der gesamte Lebenszyklus.")}</p>
        <div class="emp-module-mini">
          <span>${empT(`在岗 ${sum.headcount} 人 · 试用期 ${sum.probation} 人`, `${sum.headcount} aktiv · ${sum.probation} in Probezeit`)}</span>
          <span>${sum.review ? empT(`${sum.review} 人已提交资料，等你审核`, `${sum.review} warten auf Prüfung`)
                              : empT(`入职中 ${sum.invited} 人`, `${sum.invited} im Onboarding`)}</span>
        </div>
        <span class="emp-module-cta">${empT("进入员工档案 →", "Zur Mitarbeiterakte →")}</span>
      </a>
      ${typeof schHomeCard === "function" ? schHomeCard() : ""}
      ${typeof payHomeCard === "function" ? payHomeCard() : ""}
    </section>

    ${empHomeTodoSection(urgent, soon, sum)}`;
}

/* 待办汇总区 = 上面四张卡各自要办的事，一处看完。
   卡片回答「这一块是什么、现在什么状态」，这里回答「所以现在要我做什么」，
   每一组的颜色跟上面对应的那张卡一致，一眼知道这几行归哪一块。

   员工档案那一组仍然是按问题类型聚合，一类一行 —— 逐人逐条处理去档案页，
   那里有完整上下文（合同、在职、多列），还能勾多人批量。
   排班 / 考勤 / 工资三组直接读各自模块给全站待办用的那份清单（sch/att/lv/payTodoItems），
   不另算一遍，保证首页待办、待办页和这里说的是同一件事。 */
/* 2026-09-03：三块。原来的四块把一条流水线切错了地方 ——
   工时挂在排班下面（它的下家其实是工资），考勤单独一块（它唯一的产出就是工时）。
   现在按「多久做一次」分：每天每周的现场（排班·考勤·休假）/ 每月一次的结算（工时→工资）。 */
const EMP_HOME_GROUPS = [
  { id: "staff", name: { zh: "员工档案", de: "Mitarbeiterakte" } },
  { id: "sch", name: { zh: "排班与考勤", de: "Dienstplan und Zeiten" } },
  { id: "pay", name: { zh: "工资与发薪", de: "Lohn und Auszahlung" } }
];

/* 待办条目的 type 是全站统一的字符串（待办页也在用），这里只负责把它压成
   一个够短的标签 —— 标签列 64px，超过四个字就要换行。 */
const EMP_TODO_TAGS = {
  "入职待审核": { zh: "入职", de: "Onboarding" },
  "排班未发布": { zh: "排班", de: "Plan" },
  "考勤异常": { zh: "考勤", de: "Zeit" },
  "休假待批": { zh: "休假", de: "Urlaub" },
  "病假证明": { zh: "病假", de: "AU" },
  "工资未封账": { zh: "封账", de: "Abschluss" },
  "工资单对不上": { zh: "工资单", de: "Lohn" },
  "工资待发": { zh: "打款", de: "Zahlung" }
};

/* 主页在 .emp-page 里，全站那套词典翻译够不着（data-no-translate），
   所以待办条目的德语得自己带（各模块的 *TodoItems 里的 de 字段）。 */
const EMP_DUE_LABELS = {
  "已逾期": { zh: "已逾期", de: "Überfällig", tone: "red" },
  "尽快处理": { zh: "尽快处理", de: "Dringend", tone: "red" },
  "今日到期": { zh: "今日到期", de: "Heute fällig", tone: "orange" },
  "本周到期": { zh: "本周到期", de: "Diese Woche", tone: "orange" },
  "本月到期": { zh: "本月到期", de: "Diesen Monat", tone: "blue" },
  "待审核": { zh: "待审核", de: "Zur Prüfung", tone: "blue" }
};

function empHomeTodoSection(urgent, soon, sum) {
  /* 各模块是独立文件、按需加载的，取不到就当没有 —— 跟卡片那边一个写法 */
  const sch = typeof schTodoItems === "function" ? schTodoItems() : [];
  const lv = typeof lvTodoItems === "function" ? lvTodoItems() : [];
  const att = typeof attTodoItems === "function" ? attTodoItems() : [];
  const pay = typeof payTodoItems === "function" ? payTodoItems() : [];
  const review = sum.review ? [{
    type: "入职待审核", due: "待审核", risk: "普通",
    title: `${sum.review} 人已提交入职资料，等你审核`,
    de: `${sum.review} ${sum.review === 1 ? "Person hat" : "Personen haben"} Onboarding-Unterlagen eingereicht — warten auf Prüfung`,
    href: `#${slug("employee", "入职邀请")}`
  }] : [];
  /* 组头那个数要跟上面那张卡的角标对得上 —— 员工档案卡上写的是「16 项待处理」，
     这里就不能只写「6 件」（那是折起来的类数，不是事的件数），
     否则同一块东西在同一屏上出现两个不一样的数。
     所以这一组按「待处理 / 提前知道 / 待审核」分开写，第一个数就是卡片上那个数。 */
  const staffLabel = [
    urgent.length ? empT(`${urgent.length} 项待处理`, `${urgent.length} offen`) : "",
    soon.length ? empT(`${soon.length} 项提前知道`, `${soon.length} Frühwarnung`) : "",
    review.length ? empT(`${sum.review} 人待审核`, `${sum.review} zur Prüfung`) : ""
  ].filter(Boolean).join(" · ");
  const groups = [
    { id: "staff",
      rows: empAlertKindRows(urgent, "now") + empAlertKindRows(soon, "soon") + empModuleRows(review),
      label: staffLabel,
      tools: `<a class="ghost-btn" href="#${slug("employee", "证件到期")}">${empT("按证件看", "Nach Dokument")}</a>` },
    { id: "sch", items: [...sch, ...att, ...lv] },
    { id: "pay", items: pay }
  ].map(g => g.items
      ? { ...g, rows: empModuleRows(g.items),
          label: empT(`${g.items.length} 件`, `${g.items.length} ${g.items.length === 1 ? "Punkt" : "Punkte"}`) }
      : g)
   .filter(g => g.rows);

  if (!groups.length) {
    return `<section class="card emp-allclear">
      <strong>${empT("这四块现在都没有要处理的事", "In allen vier Bereichen ist nichts offen")}</strong>
      <p>${empT(`证件、试用期、定期合同和关键资料都是齐的，班表已发布、考勤对得上、工资也走完了，最近 ${empRule("docSoonDays")} 天内没有到期的。`,
                `Dokumente, Probezeiten, Befristungen und Stammdaten sind vollständig, der Plan ist freigegeben, die Zeiten stimmen und der Lohn ist durch — auch in den nächsten ${empRule("docSoonDays")} Tagen läuft nichts ab.`)}</p>
      <a class="ghost-btn" href="#${slug("employee", "证件到期")}">${empT("查看全部证件", "Alle Dokumente ansehen")}</a>
    </section>`;
  }
  return `<section class="card emp-alert-card">
    <div class="section-title">
      <div><h2>${empT("需要处理的人事事项", "Offene Personalthemen")}</h2>
      <p>${empT("上面四块里现在要办的事，按块列在这里。证件过期或缺失还在岗属于违法用工；试用期和定期合同错过窗口，解约成本完全不同。",
                "Was in den vier Bereichen oben zu tun ist — nach Bereich sortiert. Abgelaufene oder fehlende Dokumente bedeuten unzulässige Beschäftigung; verpasste Probezeit- und Befristungsfristen ändern die Kündigungskosten erheblich.")}</p></div>
    </div>
    ${groups.map(g => {
      const meta = EMP_HOME_GROUPS.find(x => x.id === g.id);
      return `<div class="emp-alert-mod is-mod-${g.id}">
        <div class="emp-alert-mod-head">
          <h3>${empText(meta.name)}<i>${g.label}</i></h3>
          <div class="button-row">${g.tools || ""}</div>
        </div>
        ${g.rows}
      </div>`;
    }).join("")}
  </section>`;
}

/* 排班 / 考勤 / 休假 / 工资那几条：一条一行，直接用各模块待办清单里的原句。
   跟员工档案那几行长得一样（标签 / 说的什么事 / 急不急 / 去处理），只是中间不拆两栏 ——
   那几条本来就是一件具体的事，没有「几个人」可聚合。 */
function empModuleRows(items) {
  return items.map(item => {
    const level = item.risk === "高风险" ? "expired" : item.risk === "中风险" ? "warn" : "soon";
    const due = EMP_DUE_LABELS[item.due] || { zh: item.due, de: item.due, tone: "blue" };
    const tag = EMP_TODO_TAGS[item.type] || { zh: item.type, de: item.type };
    return `<a class="emp-alert-line is-${level}" href="${empEsc(item.href || "#employee")}">
      <span class="emp-kind-tag">${empText(tag)}</span>
      <strong class="emp-line-text">${empEsc(empDe() && item.de ? item.de : item.title)}</strong>
      ${empPill(due.tone, empText(due))}
      <i class="emp-kind-go">${empT("去处理 →", "Bearbeiten →")}</i>
    </a>`;
  }).join("");
}

/* 一类一行：这类是什么、几个人、最急的是谁、点进去处理。 */
function empAlertKindRows(list, urgency) {
  const order = ["newhire", "doc", "profile", "probation", "befristet"];
  return order.map(kind => {
    const items = list.filter(a => a.kind === kind);
    if (!items.length) return "";
    const top = items[0];
    const names = [...new Set(items.map(a => a.employee.name))];
    const worst = items.reduce((a, b) => (EMP_DOC_LEVELS[a.level].rank <= EMP_DOC_LEVELS[b.level].rank ? a : b));
    const detail = worst.kind === "profile"
      ? empT(`${worst.employee.name} 缺${worst.title}`, `${worst.employee.name}: ${worst.title} fehlt`)
      : worst.days == null
        ? empT(`${worst.employee.name} 的${worst.title}还没上传`, `${worst.employee.name}: ${worst.title} fehlt`)
        : empT(`${worst.employee.name} 的${worst.title} ${empDaysLabel(worst.days)}`, `${worst.employee.name}: ${worst.title} ${empDaysLabel(worst.days)}`);
    return `<a class="emp-alert-kind is-${worst.level}" href="#${slug("employee", "员工档案")}?f=todo&kind=${kind}&u=${urgency}">
      <span class="emp-kind-tag">${empText(EMP_ALERT_KINDS[kind].name)}</span>
      <strong>${empT(`${names.length} 人${empKindSummary(kind)}`, `${names.length}× ${empKindSummary(kind)}`)}</strong>
      <span class="emp-kind-detail">${empEsc(detail)}${names.length > 1 ? ` · ${empEsc(names.slice(0, 4).join("、"))}${names.length > 4 ? "…" : ""}` : ""}</span>
      ${empDocLevelPill(worst.level, kind)}
      <i class="emp-kind-go">${empT("去处理 →", "Bearbeiten →")}</i>
    </a>`;
  }).join("");
}

function empKindSummary(kind) {
  return {
    doc: empT("证件有问题", "Dokumentprobleme"),
    profile: empT("缺申报要用的资料", "fehlende Meldedaten"),
    probation: empT("试用期快到了", "Probezeit endet"),
    befristet: empT("定期合同快到期", "Befristung endet"),
    newhire: empT("新人上工前的事没办完", "offene Punkte vor Arbeitsaufnahme")
  }[kind];
}

/* ============================================================ 员工档案 ====
   重做的重点：一行回答三个问题 —— 这是谁 / 合同是什么 / 现在有什么要处理。
   旧版十列平铺（姓名 门店 岗位 合同 薪资 月工时 入职 状态 证件 操作），
   列多但每列只有一个词，眼睛要横着扫十次才拼得出一个人。
   现在压成五列，每列两行，主次分明；「待处理」列直接写清是哪件事、还剩几天。
   ========================================================================== */
const EMP_SORTS = [
  { id: "alert", name: { zh: "待处理优先", de: "Nach Dringlichkeit" } },
  { id: "name", name: { zh: "姓名", de: "Name" } },
  { id: "entry", name: { zh: "入职时间", de: "Eintritt" } },
  { id: "store", name: { zh: "门店", de: "Filiale" } }
];

function employeeStaffPage() {
  const store = empScope();
  const params = state().params;
  const filter = params.get("f") || "active";
  const sort = params.get("s") || "alert";
  const today = empToday();
  const all = empRoster(store);
  const counts = {
    all: all.length,
    active: all.filter(e => !empStatus(e.status).leaving).length,
    todo: all.filter(e => empAlertsFor(e, today).length).length,
    probation: all.filter(e => e.status === "probation").length,
    invited: all.filter(e => e.status === "invited").length,
    left: all.filter(e => e.status === "left").length
  };
  let list = all;
  /* 主页的分类概览点进来会带 kind，这里只留那一类的人 —— 不然点「4 人缺申报资料」
     结果看到的是全部待处理的人，等于白点一下。 */
  const kind = params.get("kind");
  const urgency = params.get("u");
  /* 首页那几行写的是「立刻处理」这一档的人数，点进来要是把「提前知道」的也算上，
     数字就对不上了（写 5 人、列出来 7 行）。所以 kind 和紧急度一起带过来。 */
  const matchAlert = a => (!kind || a.kind === kind)
    && (!urgency || (urgency === "soon" ? a.level === "soon" : a.level !== "soon"));
  if (filter === "active") list = all.filter(e => !empStatus(e.status).leaving);
  else if (filter === "todo") list = all.filter(e => empAlertsFor(e, today).some(matchAlert));
  else if (filter === "probation") list = all.filter(e => e.status === "probation");
  else if (filter === "invited") list = all.filter(e => e.status === "invited");
  else if (filter === "left") list = all.filter(e => e.status === "left");

  const worst = e => { const a = empAlertsFor(e, today)[0]; return a ? EMP_DOC_LEVELS[a.level].rank : 9; };
  list = [...list].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "de");
    if (sort === "entry") return String(b.entryDate || "").localeCompare(String(a.entryDate || ""));
    if (sort === "store") return a.store.localeCompare(b.store, "de") || a.name.localeCompare(b.name, "de");
    return worst(a) - worst(b) || a.name.localeCompare(b.name, "de");
  });

  const tabs = [["active", "在岗", "Aktiv", counts.active], ["todo", "需要处理", "Zu erledigen", counts.todo],
                ["probation", "试用期", "Probezeit", counts.probation], ["invited", "入职中", "Onboarding", counts.invited],
                ["left", "已离职", "Ausgeschieden", counts.left], ["all", "全部", "Alle", counts.all]];
  /* 表头徽标数的是当前这张表里的待办事项，不是员工人数。
     上面的「需要处理」筛选数的是人，两处数字各自回答一个问题，避免重复计数。 */
  const tableAlertCount = list.reduce((sum, e) => sum + empAlertsFor(e, today).filter(matchAlert).length, 0);
  return `
    <div class="page-head">
      <div><h1>${empT("员工档案", "Mitarbeiterakte")}</h1>
      <p>${empT("每个人的资料、合同、证件和在职情况。点姓名进去看全部并修改。", "Stammdaten, Vertrag, Dokumente und Beschäftigung. Zum Bearbeiten auf den Namen klicken.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}<a class="primary-btn" href="#${slug("employee", "新增员工")}">${empT("新增员工", "Mitarbeiter anlegen")}</a></div>
    </div>

    <section class="emp-listbar">
      <div class="emp-tabs">${tabs.map(t => `<a class="emp-tab${filter === t[0] ? " is-on" : ""}" href="#${slug("employee", "员工档案")}?f=${t[0]}&s=${sort}">${empT(t[1], t[2])}<b>${t[3]}</b></a>`).join("")}
        ${kind && filter === "todo" ? `<a class="emp-tab is-on emp-kind-chip" href="#${slug("employee", "员工档案")}?f=todo&s=${sort}">${
          empText(EMP_ALERT_KINDS[kind].name)}${urgency === "soon" ? empT(" · 提前知道", " · Frühwarnung") : ""}<b>${list.length}</b> ×</a>` : ""}</div>
      <div class="emp-listtools">
        <label class="emp-search"><input type="search" class="emp-search-input" placeholder="${empT("搜姓名、门店、岗位、电话…", "Name, Filiale, Position, Telefon …")}" aria-label="${empT("搜索员工", "Mitarbeiter suchen")}"></label>
        <label class="emp-store-switch"><span>${empT("排序", "Sortierung")}</span>
          <select class="emp-sort-select">${EMP_SORTS.map(o => `<option value="${o.id}"${sort === o.id ? " selected" : ""}>${empText(o.name)}</option>`).join("")}</select></label>
        <button class="ghost-btn emp-export-btn">${empT("导出这个列表", "Diese Liste exportieren")}</button>

      </div>
    </section>

    ${filter === "invited" && counts.invited ? `<section class="card emp-tabnote">
      <span>${empT(`${counts.invited} 人正在入职。发邮件、催办、审核他们提交的资料都在入职邀请里。`, `${counts.invited} im Onboarding. Einladen, erinnern und prüfen unter „Einladungen“.`)}</span>
      <a class="primary-btn" href="#${slug("employee", "入职邀请")}">${empT("去处理入职邀请", "Zu den Einladungen")}</a>
    </section>` : ""}
    <section class="card">
      ${list.length ? `<div class="table-scroll"><table class="table emp-table emp-roster">
        <thead><tr>
          <th><input class="employee-row-check employee-select-all" type="checkbox" aria-label="${empT("全选员工", "Alle auswählen")}"></th>
          <th>${empT("员工", "Mitarbeiter")}</th><th>${empT("合同", "Vertrag")}</th>
          <th>${empT("在职", "Beschäftigung")}</th><th><span class="emp-th-label">${empT("待处理", "Zu erledigen")}${empAttentionBadge(tableAlertCount)}</span></th><th></th>
        </tr></thead>
        <tbody>${list.map(e => empStaffRow(e, today)).join("")}</tbody>
      </table></div>
      <p class="emp-noresult is-hidden">${empT("没有匹配的员工。", "Keine Treffer.")}</p>
      <div class="employee-table-footer is-hidden">
        <span class="small emp-selected-count"></span>
        <div class="button-row">
          <button class="primary-btn emp-request-bulk">${empT("推送补件到员工端", "In Mitarbeiter-App senden")}</button>
        </div>
      </div>` : empStaffEmpty(filter)}
    </section>`;
}

function empStaffEmpty(filter) {
  const msg = {
    active: [empT("这家店还没有在岗员工", "Noch keine aktiven Mitarbeiter"), empT("从「新增员工」建档并发邀请开始。", "Über „Mitarbeiter anlegen“ starten.")],
    todo: [empT("没有要处理的事", "Nichts zu erledigen"), empT("证件、试用期、定期合同和关键资料都是齐的。", "Dokumente, Probezeiten, Befristungen und Stammdaten sind vollständig.")],
    probation: [empT("没有人在试用期", "Niemand in der Probezeit"), ""],
    invited: [empT("没有进行中的入职", "Kein laufendes Onboarding"), ""],
    left: [empT("没有离职记录", "Keine Austritte"), ""],
    all: [empT("这家店还没有员工", "Noch keine Mitarbeiter"), empT("从「新增员工」建档并发邀请开始。", "Über „Mitarbeiter anlegen“ starten.")]
  }[filter] || ["", ""];
  return `<div class="emp-allclear"><strong>${msg[0]}</strong>${msg[1] ? `<p>${msg[1]}</p>` : ""}
    ${filter === "active" || filter === "all" ? `<a class="primary-btn" href="#${slug("employee", "新增员工")}">${empT("新增员工", "Mitarbeiter anlegen")}</a>` : ""}</div>`;
}

function empStaffRow(e, today) {
  const st = empStatus(e.status);
  const c = e.contract;
  const alerts = empAlertsFor(e, today);
  const top = alerts[0];
  const pay = c.payType === "pauschal"
    ? `€${Number(c.rate).toLocaleString(empDe() ? "de-DE" : "en-US", { minimumFractionDigits: 2 })} ${empT("/ 月", "/ Mon.")}`
    : `€${Number(c.rate).toFixed(2)} / h`;
  const tenure = empTenure(e, today);
  /* data-find 把这一行所有可搜的字段拼一起，搜索直接在 DOM 里筛，不重渲染、不丢焦点 */
  const find = [e.name, e.store, empRaw(empRole(e.role).name), empRaw(empContractType(c.type).name),
                e.contact.phone, e.contact.email, e.note].filter(Boolean).join(" ").toLowerCase();
  return `<tr data-find="${empEsc(find)}" class="${top && (top.level === "expired" || top.level === "missing") ? "emp-alert-tr is-expired" : top && top.level === "warn" ? "emp-alert-tr is-warn" : ""}">
    <td><input class="employee-row-check" type="checkbox" aria-label="${empEsc(e.name)}"></td>
    <td class="emp-cell-who">
      <a class="emp-name-link" href="${empStaffHref(e.id)}">${empEsc(e.name)}</a>
      ${e.status === "active" ? "" : empPill(st.tone, empText(st.name))}
      <span>${empText(empRole(e.role).name)} · ${empText(empLevel(e.level).name)} · ${empEsc(e.store)}</span>
      ${e.note ? `<small class="emp-note">${empEsc(e.note)}</small>` : ""}
    </td>
    <td class="emp-cell-contract">
      <strong>${empText(empContractType(c.type).name)}</strong>
      <span>${pay} · ${c.hoursMin === c.hoursMax ? `${c.hoursMax}h` : `${c.hoursMin}–${c.hoursMax}h`} ${empT("/ 月", "/ Mon.")}</span>
      ${c.befristetUntil ? `<small class="emp-note">${empT("定期至", "befristet bis")} ${empFormatDate(c.befristetUntil)}</small>` : ""}
    </td>
    <td class="emp-cell-job">
      ${e.entryDate ? `<strong>${tenure ? tenure.label : "—"}</strong><span>${empT("入职", "seit")} ${empFormatDate(e.entryDate)}</span>` : `<span>${empT("未入职", "Kein Eintritt")}</span>`}
      ${e.status === "left" && e.leave ? `<small class="emp-note">${empT("最后工作日", "Letzter Tag")} ${empFormatDate(e.leave.lastDay)}</small>` : ""}
      ${e.status === "probation" && e.probationEnd ? `<small class="emp-note">${empT("试用期至", "Probezeit bis")} ${empFormatDate(e.probationEnd)}</small>` : ""}
    </td>
    <td class="emp-cell-todo">
      ${top ? `<span class="emp-todo-line">${empDocLevelPill(top.level, top.kind)}<b>${empEsc(top.title)}</b>${
          top.days != null ? `<i>${empDaysLabel(top.days)}</i>` : ""}${
          alerts.length > 1 ? `<i>${empT(`+${alerts.length - 1} 项`, `+${alerts.length - 1}`)}</i>` : ""}</span>
        ${empHasRequest(e) ? `<small class="emp-note emp-req-flag">${e.request.state === "submitted"
          ? empT("已交回，等你核对", "Abgegeben — prüfen")
          : empT("已推送到员工端", "In Mitarbeiter-App gesendet")}</small>` : ""}`
        : `<span class="emp-ok-dash">—</span>`}
    </td>
    <td class="button-cell single-action"><a class="ghost-btn" href="${empStaffHref(e.id)}">${empT("打开", "Öffnen")}</a></td>
  </tr>`;
}

/* ============================================================ 员工资料 ====
   旧版是四张卡片竖着排，改个电话要滚到底再滚回顶去点保存。
   现在：顶部一条人物摘要 + 这个人身上待处理的事，下面分四个标签页，
   保存钮固定在页头。离职这种不可逆的动作单独放危险区。
   标签页状态走 URL 参数（?tab=），这样保存后重渲染还停在原来那一页。
   ========================================================================== */
const EMP_TABS = [
  /* 新人的上工准备优先于普通资料；办完后整个标签自动消失，老员工仍从个人资料开始。 */
  { id: "newhire", name: { zh: "上工准备", de: "Arbeitsaufnahme" }, when: e => empIsNewHire(e) },
  { id: "profile", name: { zh: "个人资料", de: "Stammdaten" } },
  { id: "contract", name: { zh: "合同与薪资", de: "Vertrag und Vergütung" } },
  { id: "docs", name: { zh: "证件", de: "Dokumente" } },
  { id: "history", name: { zh: "变更记录", de: "Änderungen" } }
];

function empPersonTabs(e) {
  return EMP_TABS.filter(t => !t.when || t.when(e));
}

/* 红色数字只表示「这个标签里现在真有事要办」。
   变更记录的数字是历史条数，不是提醒，继续用中性的灰色计数。 */
function empProfileTabAlertCount(e, tab, today) {
  if (tab === "newhire") return empNewHireOpen(e).length;
  const alerts = empAlertsFor(e, today);
  if (tab === "profile") return alerts.filter(a => a.kind === "profile").length;
  if (tab === "docs") return alerts.filter(a => a.kind === "doc").length;
  if (tab === "contract") return alerts.filter(a => a.kind === "probation" || a.kind === "befristet").length;
  return 0;
}

function empAttentionBadge(count) {
  const n = Number(count) || 0;
  if (!n) return "";
  return `<span class="emp-attention-count" title="${empT(`${n} 项待处理`, `${n} offene Punkte`)}">${n}</span>`;
}

/* ==============================================================================
   员工资料页（2026-09-03 版式：左资料 / 右待办）
   点进来第一眼就该是这个人的资料，不是一叠横幅。
   所以：左边一栏从上到下就是「他是谁 + 他的资料」，
   右边一条窄栏收所有「要办的事」—— 账号、缺的证件和资料、补件进度。
   上一版把待办、新人清单、补件横幅全铺在资料上面，资料被挤到第二屏。
   顶部在职时长、试用期和年假又与花名册及合同页重复，这次整条删除；缺口计数只留在右栏。
   ============================================================================== */
function employeeProfilePage() {
  const e = empById(state().params.get("id")) || empRoster()[0];
  if (!e) return `<div class="page-head"><h1>${empT("员工资料", "Mitarbeiterdaten")}</h1></div>
    <section class="card"><p class="emp-empty">${empT("还没有员工。", "Noch keine Mitarbeiter.")}</p></section>`;
  const tabs = empPersonTabs(e);
  const asked = state().params.get("tab");
  const tab = tabs.some(t => t.id === asked) ? asked : "profile";
  const today = empToday();
  const c = e.contract;
  const st = empStatus(e.status);
  const href = t => `${empStaffHref(e.id)}&tab=${t}`;
  const req = empHasRequest(e) ? e.request : null;

  return `
    <div class="page-head">
      <div><h1>${empEsc(e.name)}</h1>
      <p>${empText(empRole(e.role).name)} · ${empEsc(e.store)} · ${empText(empContractType(c.type).name)}　${empPill(st.tone, empText(st.name))}</p></div>
      <div class="button-row">${empBack(`#${slug("employee", "员工档案")}`, "员工档案", "Mitarbeiterakte")}</div>
    </div>

    ${e.status === "left" && e.leave ? `<section class="card emp-left-banner">
      <strong>${empT("已离职", "Ausgeschieden")} · ${empText(empLeaveType(e.leave.type).name)}</strong>
      <p>${empT(`最后工作日 ${empFormatDate(e.leave.lastDay)}，通知日 ${empFormatDate(e.leave.noticeDate)}。${e.leave.reason ? "原因：" + e.leave.reason : ""}`,
                `Letzter Arbeitstag ${empFormatDate(e.leave.lastDay)}, Kündigung am ${empFormatDate(e.leave.noticeDate)}.${e.leave.reason ? " Grund: " + e.leave.reason : ""}`)}</p>
      <span>${empT(`档案按设置保留至 ${empFormatDate(empRetentionUntil(e))}，期间随时可查。`, `Akte wird bis ${empFormatDate(empRetentionUntil(e))} aufbewahrt.`)}
        <button class="ghost-btn emp-undo-leave" data-id="${empEsc(e.id)}">${empT("撤销离职", "Austritt rückgängig")}</button></span>
    </section>` : ""}

    <div class="emp-person">
      <div class="emp-person-main">
        ${req && req.state !== "sent" ? empRequestBanner(e) : ""}

        <!-- 标签栏 + 保存钮。另外还有一条只在「有改动」时浮出来的保存条（见下面 .emp-savedock）——
             试过把这条做成吸顶，但全站这套 body 滚动的布局里 sticky 不生效（top 设 0 或 80 都停在 -62），
             与其跟 CSS 缠斗，不如用一个不会失效的办法：改了东西，保存条自己冒出来。 -->
        <div class="emp-stickybar">
          <nav class="emp-tabs emp-tabbar">${tabs.map(t => `<a class="emp-tab${tab === t.id ? " is-on" : ""}" data-tab="${t.id}" href="${href(t.id)}">${empText(t.name)}${
            empAttentionBadge(empProfileTabAlertCount(e, t.id, today)) ||
            (t.id === "history" && e.history?.length ? `<b>${e.history.length}</b>` : "")}</a>`).join("")}</nav>
          <div class="emp-stickybar-right">
            ${empSavedBanner(e.id)}<span class="emp-dirty-tag is-hidden"></span>
            <button class="primary-btn emp-save-btn" data-id="${empEsc(e.id)}">${empT("保存修改", "Speichern")}</button>
          </div>
        </div>

        <div class="emp-savedock is-hidden">
          <span class="emp-savedock-text"></span>
          <button class="ghost-btn emp-savedock-discard">${empT("撤销改动", "Verwerfen")}</button>
          <button class="primary-btn emp-save-btn" data-id="${empEsc(e.id)}">${empT("保存修改", "Speichern")}</button>
        </div>

        <div class="emp-profile" data-id="${empEsc(e.id)}">
          ${tab === "profile" ? empTabProfile(e) : ""}
          ${tab === "contract" ? empTabContract(e, today) : ""}
          ${tab === "docs" ? empTabDocs(e, today) : ""}
          ${tab === "newhire" ? empNewHireCard(e, today) : ""}
          ${tab === "history" ? empTabHistory(e) : ""}
        </div>
      </div>

      <aside class="emp-person-side">${empPersonRail(e, today)}</aside>
    </div>`;
}

/* ---------------------------------------------------------------- 右栏 ----
   账号单独一张卡，因为它是登录能力；其余所有缺口和补件状态合成一张「待处理」。
   缺什么只列一次，请求状态和动作放在同一张卡顶部，不再上下两张卡重复同一份材料。 */
function empPersonRail(e, today) {
  const href = t => `${empStaffHref(e.id)}&tab=${t}`;
  const alerts = empAlertsFor(e, today);
  const target = a => href(a.kind === "doc" ? "docs"
    : a.kind === "profile" ? "profile"
    : a.kind === "newhire" ? "newhire" : "contract");
  const docCount = EMP_DOC_TYPES.filter(t => empDocNeeded(e, t)).length;
  const badDocs = alerts.filter(a => a.kind === "doc").length;
  const items = empTopupItems(e, today);
  const req = empHasRequest(e) ? e.request : null;
  const pr = req ? empRequestProgress(e) : null;
  return `
    ${empAccountCard(e)}
    <section class="card emp-rail-card emp-person-todo">
      <div class="emp-rail-head">
        <h2>${empT("待处理", "Offene Punkte")}</h2>
        ${alerts.length ? empAttentionBadge(alerts.length) : empPill("green", empT("没有", "Keine"))}
      </div>
      ${req?.state === "sent" ? `<div class="emp-request-status">
        <div><strong>${empT("已推送到员工端", "In die Mitarbeiter-App gesendet")}</strong>
          <span>${empStamp(req.sentAt)} · ${empT(`已完成 ${pr.done}/${pr.total}`, `${pr.done}/${pr.total} erledigt`)}</span></div>
        <div class="button-row">
          <a class="ghost-btn" href="${meEnterHref(e.id)}">${empT("预览员工端", "Mitarbeiter-App ansehen")}</a>
          <button class="ghost-btn danger-lite emp-request-cancel" data-id="${empEsc(e.id)}">${empT("撤销推送", "Zurückziehen")}</button>
        </div>
      </div>` : ""}
      ${alerts.length ? alerts.map(a => `<a class="emp-rail-row is-${a.level}" href="${target(a)}">
        <div><strong>${empEsc(a.title)}</strong>
          <span>${a.kind === "profile" ? empEsc(a.why)
            : a.kind === "newhire" ? empEsc(a.why)
            : a.days == null ? empT("还没上传", "noch nicht hochgeladen")
            : `${a.date ? empFormatDate(a.date) + " · " : ""}${empDaysLabel(a.days)}`}</span></div>
        ${empDocLevelPill(a.level, a.kind)}
      </a>`).join("")
      : `<p class="emp-rail-empty">${empT("证件、资料、试用期都是齐的。", "Dokumente, Stammdaten und Fristen sind vollständig.")}</p>`}
      ${!req && items.length ? (empAccountActive(e)
        ? `<div class="emp-rail-action">
            <span>${empT("把上面可由员工补齐的项目一次推到他的员工端。", "Die vom Mitarbeiter ergänzbaren Punkte gesammelt in seine App senden.")}</span>
            <button class="primary-btn emp-request-send" data-id="${empEsc(e.id)}">${empT(`推送 ${items.length} 项到员工端`, `${items.length} Punkte senden`)}</button>
          </div>`
        : `<p class="emp-rail-account-needed">${empT("先开通上方员工账号，再把这些项目推送给他。补件不再通过邮件发送。", "Zuerst oben den Mitarbeiterzugang anlegen. Nachforderungen werden nicht mehr per E-Mail versendet.")}</p>`)
        : ""}
      <p class="emp-rail-foot">${empT(`证件 ${docCount - badDocs} / ${docCount} 齐`, `Dokumente ${docCount - badDocs} / ${docCount}`)}</p>
    </section>`;
}

/* ---------------------------------------------------------- 员工账号卡 ---- */
function empAccountCard(e) {
  const left = empStatus(e.status).leaving;
  if (!e.account) {
    const mail = (e.contact?.email || "").trim();
    return `<section class="card emp-rail-card emp-account is-none">
      <div class="emp-rail-head"><h2>${empT("员工账号", "Mitarbeiterzugang")}</h2><span>${empPill("gray", empT("还没有", "Kein Zugang"))}</span></div>
      ${mail
        ? `<span class="small">${empT("开了之后他就能自己登录看班表、报班、补材料。用户名就是他的邮箱。", "Danach kann er sich selbst anmelden: Dienstplan, Zeiten, fehlende Unterlagen. Benutzername ist seine E-Mail.")}</span>
           <button class="primary-btn emp-account-open" data-id="${empEsc(e.id)}">${empT("开通账号", "Zugang anlegen")}</button>`
        : `<span class="small">${empT("开不了：他的档案里还没有邮箱。用户名就是邮箱，先把邮箱填上。", "Nicht möglich: Es fehlt die E-Mail-Adresse — sie ist der Benutzername.")}</span>
           <a class="ghost-btn" href="${empStaffHref(e.id)}&tab=profile">${empT("去填邮箱", "E-Mail ergänzen")}</a>`}
    </section>`;
  }
  return `<section class="card emp-rail-card emp-account${left ? " is-off" : ""}">
    <div class="emp-rail-head"><h2>${empT("员工账号", "Mitarbeiterzugang")}</h2>
      <span>${left ? empPill("gray", empT("已失效", "Deaktiviert")) : e.account.temp ? empPill("orange", empT("初始密码", "Startpasswort")) : empPill("green", empT("他已改过密码", "Passwort geändert"))}</span></div>
    <div class="emp-account-rows">
      <div><span>${empT("用户名", "Benutzername")}</span><strong>${empEsc(e.account.user)}</strong></div>
      <div><span>${empT("密码", "Passwort")}</span><strong>${e.account.temp ? `<code>${empEsc(e.account.pass)}</code>` : empT("他自己设的，看不到", "selbst gesetzt — nicht einsehbar")}</strong></div>
    </div>
    ${left
      ? `<span class="small">${empT("离职即失效，不用手动关。撤销离职就自动恢复。", "Mit dem Austritt automatisch deaktiviert — bei Rücknahme wieder aktiv.")}</span>`
      : `<span class="small">${empT("初始密码只能靠邮件送出去 —— 他还没登录，App 里通知不到他。登录后他自己改。",
                                   "Das Startpasswort geht nur per E-Mail — vor der ersten Anmeldung ist er in der App nicht erreichbar.")}</span>
         <div class="button-row">
           <button class="ghost-btn emp-copy-account" data-id="${empEsc(e.id)}">${empT("复制账号邮件", "Zugangs-E-Mail kopieren")}</button>
           <button class="ghost-btn emp-account-reset" data-id="${empEsc(e.id)}">${empT("重置密码", "Passwort zurücksetzen")}</button>
         </div>`}
  </section>`;
}

/* 员工交回后在资料主栏就地核对。等待员工填写的状态已经合并到右侧待处理卡。 */
function empRequestBanner(e) {
  if (!empHasRequest(e) || e.request.state !== "submitted") return "";
  const req = e.request;
  const st = empRequestState(req.state);
  return `<section class="card emp-request-bar is-submitted">
    <div>
      <strong>${empT(`${e.name} 交上来了，核对一下`, `${e.name} hat abgegeben — bitte prüfen`)} ${empPill(st.tone, empText(st.name))}</strong>
      <span>${empT(`${empStamp(req.submittedAt)} 提交`, `Abgegeben ${empStamp(req.submittedAt)}`)}</span>
    </div>
    <div class="emp-request-items">
      ${req.items.map(item => {
        const sub = req.submitted || {};
        if (item.kind === "field") {
          const v = empGetPath(sub, item.path);
          const old = empGetPath(e, item.path);
          return `<div class="emp-request-item"><span>${empEsc(empItemName(item))}</span>
            <strong>${v ? empEsc(v) : `<i class="emp-miss">${empT("没填", "fehlt")}</i>`}</strong>
            ${old ? `<small>${empT("原值", "bisher")} ${empEsc(old)}</small>` : ""}</div>`;
        }
        const d = sub.docs?.[item.id] || {};
        const type = empDocType(item.id);
        return `<div class="emp-request-item"><span>${empEsc(empItemName(item))}</span>
          <strong>${d.file ? empFileLink(d) : `<i class="emp-miss">${empT("没传", "fehlt")}</i>`}</strong>
          ${type.expiry ? `<small>${empT("到期日", "Ablauf")} ${d.expiry ? empFormatDate(d.expiry) : "—"}</small>` : ""}</div>`;
      }).join("")}
    </div>
    <div class="field"><label>${empT("要退回就写清楚哪里不行", "Bei Rückgabe bitte begründen")}</label>
      <textarea class="emp-request-note" rows="2" placeholder="${empT("例如：到期日那一栏还是看不清，麻烦重拍。", "z. B.: Ablaufdatum weiterhin unleserlich, bitte neu fotografieren.")}"></textarea></div>
    <div class="button-row">
      <button class="ghost-btn danger-lite emp-request-return" data-id="${empEsc(e.id)}">${empT("退回重来", "Zurückgeben")}</button>
      <button class="primary-btn emp-request-accept" data-id="${empEsc(e.id)}">${empT("采纳并归档", "Übernehmen und ablegen")}</button>
    </div>
  </section>`;
}

/* 新人清单。审核通过之后「然后呢」的答案就是这张卡。 */
function empNewHireCard(e, today) {
  if (!empIsNewHire(e)) return "";
  const open = empNewHireOpen(e);
  const days = e.entryDate ? empDaysBetween(today, e.entryDate) : null;
  const late = days != null && days < 0;
  return `<section class="card emp-newhire ${late ? "is-late" : ""}">
    <div class="section-title">
      <div><h2>${empT("新人上工前还要办的事", "Vor der Arbeitsaufnahme zu erledigen")}</h2>
      <p>${e.entryDate
        ? empT(`入职日期 ${empFormatDate(e.entryDate)}${late ? `，已经过了 ${-days} 天` : `，还有 ${days} 天`}。`,
               `Eintritt ${empFormatDate(e.entryDate)}${late ? `, seit ${-days} Tagen` : `, in ${days} Tagen`}.`)
        : empT("还没定入职日期。", "Kein Eintrittsdatum gesetzt.")}
        ${empT("档案建好了不等于人能上工，下面这几件办完才算。", "Eine angelegte Akte reicht nicht — diese Punkte gehören dazu.")}</p></div>
      <div class="button-row"><span class="small">${empT(`还剩 ${open.length} 件`, `${open.length} offen`)}</span></div>
    </div>
    ${EMP_NEWHIRE_TASKS.map(t => {
      const done = empNewHireDone(e, t);
      const fix = !done && t.fix ? t.fix(e) : null;
      return `<div class="emp-newhire-item ${done ? "is-done" : ""}">
        ${t.auto
          ? `<span class="emp-newhire-auto">${done ? "✓" : "!"}</span>`
          : `<input type="checkbox" class="emp-newhire-check" data-id="${empEsc(e.id)}" data-task="${t.id}"${done ? " checked" : ""}>`}
        <div>
          <strong>${empText(t.name)}${t.auto ? `<i>${empT("自动判断", "automatisch geprüft")}</i>` : ""}</strong>
          ${empRaw(t.note) ? `<span>${empText(t.note)}</span>` : ""}
          ${fix ? `<a class="emp-newhire-fix" href="${fix.href}">${empText(fix.name)} →</a>` : ""}
          ${t.panel ? t.panel(e) : ""}
        </div>
      </div>`;
    }).join("")}
  </section>`;
}

function empTabProfile(e) {
  return `<section class="card">
      <div class="section-title"><h2>${empT("基本资料", "Stammdaten")}</h2></div>
      <div class="form-grid">
        ${empInput(empT("姓名", "Name"), "name", e.name)}
        ${empInput(empT("出生日期", "Geburtsdatum"), "birthday", e.birthday || "", "date")}
        ${empSelect(empT("所属门店", "Filiale"), "store", empStores().map(x => [x, x]), e.store)}
        ${empSelect(empT("岗位", "Position"), "role", EMP_ROLES.map(r => [r.id, empRaw(r.name)]), e.role)}
        ${empSelect(empT("员工级别", "Qualifikation"), "level", EMP_LEVELS.map(l => [l.id, empRaw(l.name)]), e.level)}
        ${empInput(empT("排班备注", "Dienstplan-Notiz"), "note", e.note)}
      </div>
    </section>
    <section class="card">
      <div class="section-title"><h2>${empT("联络方式", "Kontakt")}</h2></div>
      <div class="form-grid">
        ${empInput(empT("电话", "Telefon"), "contact.phone", e.contact.phone)}
        ${empInput(empT("邮箱", "E-Mail"), "contact.email", e.contact.email)}
        ${empInput(empT("街道", "Strasse"), "contact.street", e.contact.street)}
        ${empInput(empT("门牌号", "Hausnummer"), "contact.houseNo", e.contact.houseNo)}
        ${empInput(empT("邮编", "PLZ"), "contact.zip", e.contact.zip)}
        ${empInput(empT("城市", "Stadt"), "contact.city", e.contact.city)}
        ${empInput(empT("紧急联系人", "Notfallkontakt"), "contact.emergency", e.contact.emergency)}
        ${empSelect(empT("沟通语言", "Sprache"), "contact.language", empLangOptions(), e.contact.language)}
        ${empSelect(empT("通知方式", "Benachrichtigung"), "contact.notifyBy", empNotifyOptions(), e.contact.notifyBy)}
      </div>
    </section>
    <section class="card">
      <div class="section-title"><h2>${empT("社保、税号与银行", "Sozialversicherung, Steuer und Bank")}</h2>
        <span class="small">${empT("工资和社保申报要用，缺一项就报不上去", "Ohne diese Angaben ist keine Lohn- und SV-Meldung möglich")}</span></div>
      <div class="form-grid">
        ${empInput(empT("保险公司名称 Krankenkasse", "Krankenkasse"), "contact.krankenkasse", e.contact.krankenkasse || "")}
        ${empInput("Steuernummer", "ids.steuernummer", e.ids.steuernummer)}
        ${empInput("Rentenversicherung Nr.", "ids.rentenversicherung", e.ids.rentenversicherung)}
        ${empInput("IBAN", "ids.iban", e.ids.iban)}
        ${empInput("BIC", "ids.bic", e.ids.bic)}
      </div>
    </section>`;
}

function empTabContract(e, today) {
  const c = e.contract;
  return `<section class="card">
      <div class="section-title"><h2>${empT("合同条件", "Vertragsbedingungen")}</h2><span class="small">${empT("排班和工时校验读这里", "Grundlage für Dienstplan- und Stundenprüfung")}</span></div>
      <div class="form-grid">
        ${empSelect(empT("合同类型", "Vertragsart"), "contract.type", EMP_CONTRACT_TYPES.map(t => [t.id, empRaw(t.name)]), c.type)}
        ${empSelect(empT("薪资方式", "Vergütungsart"), "contract.payType", [["hourly", empT("时薪", "Stundenlohn")], ["pauschal", empT("Pauschal 月薪", "Pauschale monatlich")]], c.payType)}
        ${empInput(c.payType === "pauschal" ? empT("月薪 €", "Monatsbetrag €") : empT("时薪 €", "Stundenlohn €"), "contract.rate", c.rate, "number")}
        ${empInput(empT("月工时下限", "Sollstunden min. / Monat"), "contract.hoursMin", c.hoursMin, "number")}
        ${empInput(empT("月工时上限", "Sollstunden max. / Monat"), "contract.hoursMax", c.hoursMax, "number")}
        ${empInput(empT("年假天数 Urlaubstag", "Urlaubstage"), "contract.urlaubDays", c.urlaubDays, "number")}
        ${empInput("Kündigungsfrist", "contract.noticePeriod", c.noticePeriod)}
        ${empInput(empT("定期合同到期日（不定期就留空）", "Befristet bis (leer = unbefristet)"), "contract.befristetUntil", c.befristetUntil || "", "date")}
        ${empCheck(empT("在读学生（需入学证明）", "Studierend (Immatrikulationsbescheinigung nötig)"), "contract.isStudent", c.isStudent)}
        ${empCheck(empT("非欧盟国籍（需居留卡）", "Nicht-EU (Aufenthaltstitel nötig)"), "contract.nonEU", c.nonEU)}
      </div>
      ${empContractHint(e)}
    </section>
    <section class="card">
      <div class="section-title"><div><h2>${empT("在职与试用期", "Beschäftigung und Probezeit")}</h2>
        <p>${empT("状态是按日期算出来的，不用手选 —— 以前两个字段能各说各话（写着试用期却没填结束日，提醒就静默失效了）。", "Der Status wird aus den Daten abgeleitet, nicht manuell gesetzt — so können sich Datum und Status nicht mehr widersprechen.")}</p></div>
        ${empPill(empStatus(e.status).tone, empText(empStatus(e.status).name))}</div>
      <div class="form-grid">
        ${empInput(empT("入职日期", "Eintrittsdatum"), "entryDate", e.entryDate, "date")}
        ${empInput(`${empT("试用期结束", "Ende der Probezeit")}<small>${empT("留空 = 这个人没有试用期", "leer = keine Probezeit")}</small>`, "probationEnd", e.probationEnd || "", "date")}
      </div>
      ${empProbationBox(e, today)}
    </section>
    ${e.status === "left" ? "" : empLeaveSection(e, today)}`;
}

/* 试用期那一块的说明与动作。三种情形分别说清楚：正在试用期 / 没有试用期 / 设置有问题。 */
function empProbationBox(e, today) {
  const issue = empProbationIssue(e, today);
  if (issue) {
    return `<div class="emp-hint is-${issue.tone}">
      <strong>${issue.text}</strong>
      ${e.entryDate ? `<div class="button-row" style="margin-top:10px">
        <button class="ghost-btn emp-probation-fill" data-id="${empEsc(e.id)}">${empT(`按 ${empRule("probationMonths")} 个月重算`, `Auf ${empRule("probationMonths")} Monate setzen`)}</button>
        <button class="ghost-btn emp-probation-clear" data-id="${empEsc(e.id)}">${empT("清空（没有试用期）", "Leeren (keine Probezeit)")}</button>
      </div>` : ""}
    </div>`;
  }
  if (!e.probationEnd) {
    return `<div class="emp-hint">
      <strong>${empT("这个人没有设试用期", "Für diese Person ist keine Probezeit hinterlegt")}</strong>
      <span>${empT(`合同里约定了就填上结束日，或者按合规设置里的 ${empRule("probationMonths")} 个月自动算。`, `Bei vereinbarter Probezeit das Enddatum eintragen oder automatisch berechnen lassen.`)}</span>
      ${e.entryDate ? `<div class="button-row" style="margin-top:10px">
        <button class="ghost-btn emp-probation-fill" data-id="${empEsc(e.id)}">${empT(`按入职日期 + ${empRule("probationMonths")} 个月填上`, `Aus Eintritt + ${empRule("probationMonths")} Monaten berechnen`)}</button>
      </div>` : ""}
    </div>`;
  }
  const days = empDaysBetween(today, e.probationEnd);
  return `<div class="emp-hint">
    <strong>${empT(`试用期到 ${empFormatDate(e.probationEnd)} · ${empDaysLabel(days)}`, `Probezeit bis ${empFormatDate(e.probationEnd)} · ${empDaysLabel(days)}`)}</strong>
    <p>${empT(`结束前要决定：留人就什么都不用做，到期自动转正；不留就得在这之前解约 —— 试用期内通知期按合规设置是 ${empRule("probationNoticeWeeks")} 周，过了这天就变成合同约定的「${empEsc(e.contract.noticePeriod || "未填")}」。`,
              `Vor Ablauf entscheiden: ohne Kündigung wird automatisch übernommen. In der Probezeit gilt eine Frist von ${empRule("probationNoticeWeeks")} Wochen, danach „${empEsc(e.contract.noticePeriod || "nicht erfasst")}“.`)}</p>
    <div class="button-row" style="margin-top:10px">
      <button class="ghost-btn emp-probation-clear" data-id="${empEsc(e.id)}">${empT("提前转正（清空试用期）", "Vorzeitig übernehmen")}</button>
    </div>
  </div>`;
}

/* 危险区。离职会把人从在岗名册、排班和提醒里拿掉，所以要二次确认。 */
function empLeaveSection(e, today) {
  const notice = empToday();
  const hint = empEarliestLastDay(e, notice, e.status === "probation" ? "probation" : "resign");
  return `<section class="card emp-danger">
    <div class="section-title"><div><h2>${empT("办理离职", "Austritt erfassen")}</h2>
      <p>${empT("离职后这个人不再进在岗名册、排班和提醒，但档案按保留期留着，随时可查。", "Danach nicht mehr im Team, Dienstplan oder in den Warnungen — die Akte bleibt für die Aufbewahrungsfrist erhalten.")}</p></div>
      <button class="ghost-btn danger-lite emp-leave-open">${empT("办理离职", "Austritt erfassen")}</button></div>
    <div class="emp-leave-form is-hidden" data-id="${empEsc(e.id)}">
      <div class="form-grid">
        ${empSelect(empT("离职类型", "Art des Austritts"), "leave.type", EMP_LEAVE_TYPES.map(t => [t.id, empRaw(t.name)]),
          e.status === "probation" ? "probation" : e.contract.befristetUntil ? "befristet" : "resign")}
        ${empInput(empT("通知日期", "Datum der Kündigung"), "leave.noticeDate", notice, "date")}
        ${empInput(empT("最后工作日", "Letzter Arbeitstag"), "leave.lastDay", hint.earliest || e.contract.befristetUntil || empShiftDate(notice, 30), "date")}
        ${empInput(empT("原因（可选）", "Grund (optional)"), "leave.reason", "")}
      </div>
      <p class="emp-approve-warn">${empT(`通知期参考：${hint.source}${hint.earliest ? `，最早可到 ${empFormatDate(hint.earliest)}` : "，请按合同自行确认最后工作日"}。这是按你在合规设置里填的数算的，不是系统给的法律意见。`,
        `Frist laut ${hint.source}${hint.earliest ? `, frühestens ${empFormatDate(hint.earliest)}` : ", letzten Arbeitstag bitte laut Vertrag prüfen"}. Berechnet aus Ihren Compliance-Einstellungen, keine Rechtsberatung.`)}</p>
      <div class="button-row"><button class="ghost-btn emp-leave-cancel">${empT("取消", "Abbrechen")}</button>
        <button class="primary-btn danger-solid emp-leave-confirm" data-id="${empEsc(e.id)}">${empT("确认离职", "Austritt bestätigen")}</button></div>
    </div>
  </section>`;
}

function empTabDocs(e, today) {
  return `<section class="card emp-doc-card emp-doc-wide">
      <div class="section-title"><h2>${empT("证件", "Dokumente")}</h2>
        <span class="small">${empT("按合同条件显示：勾了在读学生要入学证明，非欧盟要居留卡", "Abhängig vom Vertrag: Studierende brauchen die Immatrikulationsbescheinigung, Nicht-EU den Aufenthaltstitel")}</span></div>
      ${EMP_DOC_TYPES.map(type => empDocRow(e, type, today)).join("")}
      <p class="emp-doc-foot">${empT("居留卡、学生入学证明、健康证 Belehrung 这三类带到期日，会进主页预警。",
                                    "Aufenthaltstitel, Immatrikulationsbescheinigung und Belehrung haben ein Ablaufdatum und erscheinen in der Warnliste.")}
        <a href="#${slug("employee", "合规设置")}">${empT("改提前期", "Vorwarnzeit ändern")}</a></p>
    </section>`;
}

function empTabHistory(e) {
  const log = [...(e.history || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return `<section class="card">
      <div class="section-title"><div><h2>${empT("变更记录", "Änderungsverlauf")}</h2>
        <p>${empT("只记有法律或金钱意义的字段：状态、门店、岗位、合同条件、薪资、工时、年假、IBAN。电话改了不记。", "Erfasst werden nur rechtlich oder finanziell relevante Felder: Status, Filiale, Position, Vertrag, Vergütung, Stunden, Urlaub, IBAN.")}</p></div>
        <span class="small">${log.length}</span></div>
      ${log.length ? `<div class="table-scroll"><table class="table emp-table">
        <thead><tr><th>${empT("时间", "Zeitpunkt")}</th><th>${empT("字段", "Feld")}</th><th>${empT("改前", "Vorher")}</th><th>${empT("改后", "Nachher")}</th><th>${empT("操作人", "Durch")}</th></tr></thead>
        <tbody>${log.map(h => { const f = empTrackedField(h.field); return `<tr>
          <td>${empStamp(h.at)}</td>
          <td>${f ? empText(f.name) : empEsc(h.field)}</td>
          <td>${empEsc(empHistoryValue(h.field, h.from))}</td>
          <td><strong>${empEsc(empHistoryValue(h.field, h.to))}</strong></td>
          <td>${empEsc(h.by || "—")}</td>
        </tr>`; }).join("")}</tbody>
      </table></div>` : `<p class="emp-empty">${empT("还没有变更记录。改了合同、薪资或状态之后会出现在这里。", "Noch keine Änderungen. Nach Anpassung von Vertrag, Vergütung oder Status erscheinen sie hier.")}</p>`}
    </section>`;
}

/* CSV：给税务师、保险或劳工局检查的员工名单。UTF-8 BOM，不然 Excel 打开中文是乱码。
   ⚠️ 传的是「要导哪些人」，不是门店 —— 上一版签名是 (store)，结果屏幕上筛出 1 个人、
   导出来 17 个，筛选和搜索完全没算数。导出必须等于你眼前看到的这一份。 */
function empRosterCsv(list) {
  const today = empToday();
  const head = [empT("姓名", "Name"), empT("出生日期", "Geburtsdatum"), empT("门店", "Filiale"), empT("岗位", "Position"),
                empT("合同类型", "Vertragsart"), empT("薪资方式", "Vergütungsart"), empT("金额", "Betrag"),
                empT("月工时下限", "Std. min"), empT("月工时上限", "Std. max"), empT("年假", "Urlaubstage"),
                empT("入职日期", "Eintritt"), empT("状态", "Status"), empT("最后工作日", "Letzter Tag"),
                "Steuernummer", "Rentenversicherung", "IBAN", "Krankenkasse",
                empT("待处理项", "Offene Punkte")];
  const rows = (list || empRoster(empScope())).map(e => [
    e.name, e.birthday || "", e.store, empRaw(empRole(e.role).name),
    empRaw(empContractType(e.contract.type).name), e.contract.payType === "pauschal" ? "Pauschal" : empRaw({ zh: "时薪", de: "Stundenlohn" }),
    e.contract.rate, e.contract.hoursMin, e.contract.hoursMax, e.contract.urlaubDays,
    e.entryDate || "", empRaw(empStatus(e.status).name), e.leave?.lastDay || "",
    e.ids.steuernummer, e.ids.rentenversicherung, e.ids.iban, e.contact.krankenkasse || "",
    empAlertsFor(e, today).map(a => a.title).join(" / ")
  ]);
  const esc = v => { const t = String(v == null ? "" : v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return "﻿" + [head, ...rows].map(r => r.map(esc).join(",")).join("\r\n");
}


/* 语言与通知方式的可选值：存中文原值不变（换界面语言不能改数据），显示按界面语言走 */
function empLangOptions() {
  return [["中文", empT("中文", "Chinesisch")], ["Deutsch", "Deutsch"],
          ["中文 / Deutsch", empT("中文 / Deutsch", "Chinesisch / Deutsch")],
          ["Deutsch / English", "Deutsch / English"]];
}
function empNotifyOptions() {
  return [["Email", "E-Mail"], ["WhatsApp", "WhatsApp"], ["短信", empT("短信", "SMS")]];
}

/* 合同条件与合规阈值的当场对照 —— 这是这个模块的「临界值」，
   对应 HACCP 里温度超标当场判定那件事。 */
function empContractHint(e) {
  const c = e.contract;
  const type = empContractType(c.type);
  if (!type.limit) return "";
  const rule = empRules().find(r => r.id === type.limit);
  if (!rule) return "";
  let projection = "";
  if (type.id === "minijob" && c.payType === "hourly") {
    const maxPay = c.hoursMax * c.rate;
    const over = maxPay > rule.value;
    projection = `<p class="${over ? "is-over" : ""}">${empT(
      `按上限 ${c.hoursMax}h × €${Number(c.rate).toFixed(2)} = <strong>€${maxPay.toFixed(2)}</strong> / 月，${over ? `已超过上限 €${rule.value}` : `在上限 €${rule.value} 以内`}。`,
      `${c.hoursMax}h × €${Number(c.rate).toFixed(2)} = <strong>€${maxPay.toFixed(2)}</strong> / Monat — ${over ? `über der Grenze von €${rule.value}` : `innerhalb der Grenze von €${rule.value}`}.`)}</p>`;
  }
  if (type.id === "werkstudent") {
    const weekly = (c.hoursMax / 4.33).toFixed(1);
    const over = Number(weekly) > rule.value;
    projection = `<p class="${over ? "is-over" : ""}">${empT(
      `月上限 ${c.hoursMax}h ≈ <strong>${weekly}h / 周</strong>，${over ? `已超过 ${rule.value}h` : `在 ${rule.value}h 以内`}。`,
      `${c.hoursMax}h / Monat ≈ <strong>${weekly}h / Woche</strong> — ${over ? `über ${rule.value}h` : `innerhalb ${rule.value}h`}.`)}</p>`;
  }
  return `<div class="emp-hint">
    <strong>${empText(rule.name)}：${rule.value} ${empText(rule.unit)}</strong>
    ${projection}
    <span>${empText(rule.note)} <a href="#${slug("employee", "合规设置")}">${empT("改这个值", "Wert ändern")}</a></span>
  </div>`;
}

/* 证件一行。na 的也画出来但压暗，让人知道「系统知道你不需要这份」，
   而不是以为漏了。 */
function empDocRow(e, type, today) {
  const st = empDocState(e, type.id, today);
  const doc = e.docs?.[type.id] || {};
  if (st.level === "na") {
    return `<div class="emp-doc is-na"><div class="emp-doc-head"><strong>${empText(type.name)}</strong>${empDocLevelPill("na")}</div>
      <span class="emp-doc-why">${type.need === "student"
        ? empT("勾选「在读学生」后需要", "Nur bei Studierenden erforderlich")
        : empT("勾选「非欧盟国籍」后需要", "Nur bei Nicht-EU erforderlich")}</span></div>`;
  }
  return `<div class="emp-doc is-${st.level}">
    <div class="emp-doc-head"><strong>${empText(type.name)}</strong>${empDocLevelPill(st.level)}</div>
    <div class="emp-doc-body">
      <label class="emp-doc-toggle"><input type="checkbox" class="emp-doc-have" data-doc="${type.id}"${st.level !== "missing" ? " checked" : ""}> ${empT("已上传", "Hochgeladen")}</label>
      ${doc.file ? empFileLink(doc) : ""}
      ${type.expiry ? `<label class="emp-doc-exp"><span>${empT("到期日", "Ablaufdatum")}</span><input type="date" class="emp-doc-date" data-doc="${type.id}" value="${empEsc(doc.expiry || "")}"></label>` : ""}
      ${st.days != null ? `<span class="emp-doc-days">${empDaysLabel(st.days)}</span>` : ""}
    </div>
  </div>`;
}

/* ------------------------------------------------------------ 表单小件 --- */
/* 2026-09-03（Mingrong：需要个人资料补充的地方要标红）——
   哪些字段是「缺了就报不上去」，EMP_KEY_FIELDS 里本来就写着，员工列表和提醒清单
   一直在用它算预警。可到了真正要填的这张表上，那五个格子跟「排班备注」长得一模一样：
   人从预警点进来，还得自己猜是哪一格。现在标红标在格子上，缺的还写出为什么要填。
   判断是当场从值算的，不另存一份状态；填进去红就掉（下面的实时监听）。 */
function empFieldNeed(path) {
  return EMP_KEY_FIELDS.find(f => f.path === path) || null;
}

function empNeedMark(path, value) {
  const need = empFieldNeed(path);
  if (!need) return { cls: "", mark: "", why: "" };
  const empty = value == null || String(value).trim() === "";
  return {
    cls: ` is-need${empty ? " is-missing" : ""}`,
    mark: `<b class="field-need">${empT("必填", "Pflicht")}</b>`,
    why: `<small class="field-need-why">${empText(need.why)}</small>`
  };
}

function empInput(label, path, value, type = "text") {
  const n = empNeedMark(path, value);
  return `<div class="field${n.cls}" data-need-path="${empEsc(path)}"><label>${label}${n.mark}</label><input type="${type}" data-emp-field="${path}" value="${empEsc(value == null ? "" : value)}">${n.why}</div>`;
}

function empSelect(label, path, options, value) {
  const n = empNeedMark(path, value);
  return `<div class="field${n.cls}" data-need-path="${empEsc(path)}"><label>${label}${n.mark}</label><select data-emp-field="${path}">${options.map(o => `<option value="${empEsc(o[0])}"${o[0] === value ? " selected" : ""}>${empEsc(o[1])}</option>`).join("")}</select>${n.why}</div>`;
}

function empCheck(label, path, value) {
  return `<div class="field emp-check"><label><input type="checkbox" data-emp-field="${path}"${value ? " checked" : ""}> ${label}</label></div>`;
}

/* ============================================================ 证件到期 ==== */
function employeeDocPage() {
  const store = empScope();
  const today = empToday();
  const alerts = empDocAlerts(store, today);
  const roster = empStaff(store);
  const cols = [["姓名", "Name"], ["门店", "Filiale"], ["证件", "Dokument"], ["到期日", "Ablauf"], ["剩余", "Verbleibend"], ["状态", "Status"], ["操作", "Aktion"]];
  return `
    <div class="page-head">
      <div><h1>${empT("证件到期总览", "Übersicht Dokumentfristen")}</h1>
      <p>${empT("按证件看：哪一类证件问题最多、谁的哪一份要续。想按人看就去员工档案的「需要处理」。", "Nach Dokument sortiert: welche Art am häufigsten fehlt und wessen Nachweis abläuft. Die Sicht nach Person steht in der Mitarbeiterakte unter „Zu erledigen“.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}<a class="ghost-btn" href="#${slug("employee", "员工档案")}?f=todo">${empT("按人看", "Nach Person")}</a><a class="ghost-btn" href="#${slug("employee", "合规设置")}">${empT("改提前期", "Vorwarnzeit ändern")}</a></div>
    </div>
    ${alerts.length ? `<section class="card">
      <div class="section-title"><h2>${empT("需要处理", "Zu erledigen")}</h2><span class="small">${alerts.length}</span></div>
      <div class="table-scroll"><table class="table emp-table">
        <thead><tr>${cols.map(c => `<th>${empT(c[0], c[1])}</th>`).join("")}</tr></thead>
        <tbody>${alerts.map(a => `<tr class="emp-alert-tr is-${a.level}">
          <td><a class="emp-name-link" href="${empStaffHref(a.employee.id)}">${empEsc(a.employee.name)}</a></td>
          <td>${empEsc(a.employee.store)}</td>
          <td>${empText(a.type.name)}</td>
          <td>${a.employee.docs[a.type.id]?.expiry ? empFormatDate(a.employee.docs[a.type.id].expiry) : "—"}</td>
          <td>${a.days == null ? "—" : empDaysLabel(a.days)}</td>
          <td>${empDocLevelPill(a.level, a.kind)}</td>
          <td class="button-cell single-action"><a class="ghost-btn" href="${empStaffHref(a.employee.id)}">${empT("去处理", "Bearbeiten")}</a></td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>` : `<section class="card emp-allclear"><strong>${empT("没有需要处理的证件", "Keine offenen Dokumente")}</strong>
      <p>${empT(`在岗 ${roster.length} 人的必需证件都齐全，且 ${empRule("docSoonDays")} 天内没有到期的。`,
                `Alle Pflichtdokumente von ${roster.length} aktiven Mitarbeitern liegen vor, keine Frist in ${empRule("docSoonDays")} Tagen.`)}</p></section>`}

    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>${empT("全员证件矩阵", "Dokumentmatrix")}</h2><span class="small">${roster.length} × ${EMP_DOC_TYPES.length}</span></div>
      <div class="table-scroll"><table class="table emp-table emp-matrix">
        <thead><tr><th>${empT("姓名", "Name")}</th>${EMP_DOC_TYPES.map(t => `<th>${empText(t.name)}</th>`).join("")}</tr></thead>
        <tbody>${roster.map(e => `<tr>
          <td><a class="emp-name-link" href="${empStaffHref(e.id)}">${empEsc(e.name)}</a></td>
          ${EMP_DOC_TYPES.map(t => {
            const s = empDocState(e, t.id, today);
            const meta = EMP_DOC_LEVELS[s.level];
            return `<td class="emp-cell is-${s.level}" title="${empEsc(empRaw(t.name))} · ${empEsc(empRaw(meta.name))}"><i class="emp-dot ${meta.tone}"></i>${s.days != null && s.level !== "ok" ? `<small>${s.days < 0 ? `−${-s.days}` : s.days}d</small>` : ""}</td>`;
          }).join("")}
        </tr>`).join("")}</tbody>
      </table></div>
    </section>`;
}

/* ============================================================ 合规设置 ==== */
function employeeRulesPage() {
  return `
    <div class="page-head">
      <div><h1>${empT("合规设置", "Compliance-Einstellungen")}</h1>
      <p>${empT("这些阈值不是写死的法规常量，是可以按当年法规和实际合同改的参数。", "Diese Grenzwerte sind keine fest codierten Rechtskonstanten, sondern nach Gesetzeslage und Vertrag änderbare Parameter.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}<button class="ghost-btn emp-rules-reset">${empT("恢复默认值", "Standardwerte")}</button><button class="primary-btn emp-rules-save">${empT("保存", "Speichern")}</button></div>
    </div>
    <section class="card emp-rules-note">
      <strong>⚠️ ${empT("默认值需要核实", "Standardwerte prüfen")}</strong>
      <p>${empT("下面的默认值是初始录入。Minijob 上限和工时法数字每年可能调整，各州和各类合同也有例外。上线前请按当年法规和门店实际合同逐条确认。",
                "Die Standardwerte sind Erstwerte. Minijob-Grenze und Arbeitszeitwerte können sich jährlich ändern, je nach Bundesland und Vertragsart gelten Ausnahmen. Vor dem Livegang bitte einzeln prüfen.")}</p>
    </section>
    ${empStores().some(x => !empEmployer(x).betriebsnummer) ? `<section class="card emp-rules-note emp-bn-warn" style="margin-top:16px">
      <strong>${empT("还有门店没填 Betriebsnummer", "Betriebsnummer fehlt noch")}</strong>
      <p>${empT("没有这个号，新人的即时申报单就是缺的，报不上去。这个号在劳动局的登记材料和以往的社保申报单上都能找到。",
                "Ohne diese Nummer bleibt das Sofortmeldungs-Datenblatt unvollständig. Sie steht auf den Unterlagen der Agentur für Arbeit und auf früheren SV-Meldungen.")}</p>
    </section>` : ""}
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>${empT("公司信息（申报要用）", "Betriebsdaten (für Meldungen)")}</h2>
        <span class="small">${empT("填一次，每个新人的即时申报单自动带上", "Einmal eintragen — erscheint bei jeder Sofortmeldung")}</span></div>
      <p class="small">${empT("即时申报要交的数据里有一半是公司自己的。这几项填在这儿，新人清单上那张数据单就自己凑齐了。连锁店各门店的 Betriebsnummer 可能不同，所以按门店填。",
                              "Ein Teil der Meldedaten betrifft den Betrieb selbst. Hier eingetragen, vervollständigen sie automatisch das Datenblatt bei jeder Neueinstellung. Filialen können unterschiedliche Betriebsnummern haben.")}</p>
      <div class="emp-employer">
        ${empStores().map(store => {
          const v = empEmployer(store);
          return `<div class="emp-employer-store">
            <h3>${empEsc(store)}</h3>
            <div class="form-grid">
              ${EMP_EMPLOYER_FIELDS.map(f => `<div class="field">
                <label>${empText(f.name)}</label>
                <input type="text" data-employer="${f.id}" data-store="${empEsc(store)}" value="${empEsc(v[f.id] || "")}">
                ${empRaw(f.note) ? `<small>${empText(f.note)}</small>` : ""}
              </div>`).join("")}
            </div>
          </div>`;
        }).join("")}
      </div>
    </section>
    ${typeof attSitePanel === "function" ? attSitePanel(null) : ""}
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>${empT("阈值参数", "Grenzwerte")}</h2></div>
      <div class="emp-rules">
        ${empRules().map(r => `<div class="emp-rule">
          <div class="emp-rule-head"><strong>${empText(r.name)}</strong><span class="emp-rule-input"><input type="number" step="any" data-rule="${r.id}" value="${r.value}"><i>${empText(r.unit)}</i></span></div>
          ${empRaw(r.note) ? `<p>${empText(r.note)}</p>` : ""}
        </div>`).join("")}
      </div>
    </section>`;
}

/* ============================================================ 新增员工 ==== */
function employeeNewPage() {
  return `
    <div class="page-head">
      <div><h1>${empT("新增员工", "Mitarbeiter anlegen")}</h1>
      <p>${empT("第 1 步：公司先填合同条件。建档后生成邀请邮件和链接，员工自己补资料，最后由店长审核。", "Schritt 1: Vertragsbedingungen erfassen. Danach werden Einladung und Link erzeugt, der Mitarbeiter ergänzt seine Daten, die Filialleitung prüft.")}</p></div>
      <div class="button-row">${empBack(`#${slug("employee", "员工档案")}`, "员工档案", "Mitarbeiterakte")}<button class="primary-btn emp-create-btn">${empT("建档并生成邀请", "Anlegen und Einladung erstellen")}</button></div>
    </div>
    <section class="grid grid-2 emp-new-layout">
      <div class="card">
        <div class="section-title"><h2>${empT("公司先填的部分", "Vom Betrieb auszufüllen")}</h2>
          <span class="small">${empT("五项就能发邀请，其余的选了合同类型自动带默认值", "Fünf Angaben genügen; der Rest kommt aus der Vertragsart")}</span></div>
        <div class="form-grid">
          ${empInput(empT("姓名", "Name"), "name", "")}
          ${empInput(empT("邮箱", "E-Mail"), "contact.email", "")}
          ${empSelect(empT("所属门店", "Filiale"), "store", empStores().map(x => [x, x]), empScope() || empStores()[0])}
          ${empSelect(empT("岗位", "Position"), "role", EMP_ROLES.map(r => [r.id, empRaw(r.name)]), "front")}
          ${empSelect(empT("合同类型", "Vertragsart"), "contract.type", EMP_CONTRACT_TYPES.map(t => [t.id, empRaw(t.name)]), "teilzeit")}
        </div>
        <details class="emp-more">
          <summary>${empT("更多合同条件（不改就用默认值）", "Weitere Vertragsbedingungen (sonst Standardwerte)")}</summary>
          <div class="form-grid">
            ${empSelect(empT("员工级别", "Qualifikation"), "level", EMP_LEVELS.map(l => [l.id, empRaw(l.name)]), "basic")}
            ${empSelect(empT("薪资方式", "Vergütungsart"), "contract.payType", [["hourly", empT("时薪", "Stundenlohn")], ["pauschal", empT("Pauschal 月薪", "Pauschale monatlich")]], "hourly")}
            ${empInput(empT("薪资金额 €", "Betrag €"), "contract.rate", 13.5, "number")}
            ${empInput(empT("月工时下限", "Sollstunden min. / Monat"), "contract.hoursMin", 60, "number")}
            ${empInput(empT("月工时上限", "Sollstunden max. / Monat"), "contract.hoursMax", 80, "number")}
            ${empInput(empT("年假天数", "Urlaubstage"), "contract.urlaubDays", 20, "number")}
            ${empInput(empT("预计入职日期", "Geplanter Eintritt"), "entryDate", "", "date")}
            ${empCheck(empT("在读学生", "Studierend"), "contract.isStudent", false)}
            ${empCheck(empT("非欧盟国籍", "Nicht-EU"), "contract.nonEU", false)}
          </div>
        </details>
        <p class="small emp-preset-hint"></p>
      </div>
      <div class="card">
        <div class="section-title"><h2>${empT("员工自己要补的部分", "Vom Mitarbeiter zu ergänzen")}</h2>${empPill("blue", empT("自助资料表", "Selbstauskunft"))}</div>
        <p class="small" style="margin-bottom:10px">${empT("邀请链接里会按上面勾的合同条件，只要求这个人真正需要的证件。", "Der Einladungslink fordert nur die Dokumente an, die nach den gewählten Vertragsbedingungen nötig sind.")}</p>
        <div class="emp-doc-preview">
          ${EMP_DOC_TYPES.map(t => `<div class="emp-doc-preview-row"><span>${empText(t.name)}</span><strong>${
            (t.need === "all" ? empT("所有人", "Alle") : t.need === "student" ? empT("学生", "Studierende") : empT("非欧盟", "Nicht-EU"))
            + (t.expiry ? empT(" · 带到期日", " · mit Ablaufdatum") : "")}</strong></div>`).join("")}
        </div>
        <div class="emp-doc-preview" style="margin-top:12px">
          ${[["地址与电话", "Adresse und Telefon", "填写", "Eingeben"],
             ["Steuernummer", "Steuernummer", "填写", "Eingeben"],
             ["Rentenversicherung Nr.", "Rentenversicherung Nr.", "填写", "Eingeben"],
             ["IBAN / BIC", "IBAN / BIC", "上传银行卡后 AI 识别", "KI liest die Bankkarte aus"],
             ["合同条件", "Vertragsbedingungen", "上传合同后 AI 读取 Urlaubstag、工时、Kündigungsfrist", "KI liest Urlaubstage, Arbeitszeit und Kündigungsfrist aus"]
            ].map(x => `<div class="emp-doc-preview-row"><span>${empT(x[0], x[1])}</span><strong>${empT(x[2], x[3])}</strong></div>`).join("")}
        </div>
        ${empFlowSteps(0)}
      </div>
    </section>`;
}

/* 入职三步的进度条。四个页面共用，让人随时知道自己在哪一步。 */
function empFlowSteps(current) {
  const steps = [["公司建档", "Betrieb legt an"], ["员工填写", "Mitarbeiter füllt aus"], ["店长审核", "Leitung prüft"]];
  return `<ol class="emp-flow">${steps.map((st, i) => `<li class="${i < current ? "is-done" : i === current ? "is-now" : ""}">
    <i>${i < current ? "✓" : i + 1}</i><span>${empT(st[0], st[1])}</span></li>`).join("")}</ol>`;
}

/* ============================================================ 入职邀请 ==== */
function employeeInviteListPage() {
  const store = empScope();
  const list = empInvites(store);
  const groups = [
    ["submitted", list.filter(e => e.invite.state === "submitted")],
    ["returned", list.filter(e => e.invite.state === "returned")],
    ["sent", list.filter(e => e.invite.state === "sent")],
    ["draft", list.filter(e => e.invite.state === "draft")]
  ].filter(g => g[1].length);
  return `
    <div class="page-head">
      <div><h1>${empT("入职邀请", "Einstellungseinladungen")}</h1>
      <p>${empT("公司建档 → 发邀请邮件 → 员工点链接自填 → 店长审核通过后进正式档案。", "Anlegen → Einladung senden → Mitarbeiter füllt aus → Freigabe durch die Leitung.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}<a class="primary-btn" href="#${slug("employee", "新增员工")}">${empT("新增员工", "Mitarbeiter anlegen")}</a></div>
    </div>
    ${groups.length ? groups.map(([state, rows]) => `<section class="card" style="margin-top:16px">
      <div class="section-title">
        <div><h2>${empText(empInviteState(state).name)}</h2><p>${empInviteGroupHint(state)}</p></div>
        <span class="small">${rows.length}</span>
      </div>
      <div class="table-scroll"><table class="table emp-table">
        <thead><tr>${[["姓名", "Name"], ["门店", "Filiale"], ["岗位 · 合同", "Position · Vertrag"], ["完成度", "Fortschritt"], ["最近动作", "Zuletzt"], ["操作", "Aktion"]]
          .map(c => `<th>${empT(c[0], c[1])}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(e => empInviteRow(e)).join("")}</tbody>
      </table></div>
    </section>`).join("") : `<section class="card emp-allclear">
      <strong>${empT("没有进行中的入职邀请", "Keine laufenden Einladungen")}</strong>
      <p>${empT("新招的人从「新增员工」开始建档。", "Neue Mitarbeiter über „Mitarbeiter anlegen“ starten.")}</p>
      <a class="primary-btn" href="#${slug("employee", "新增员工")}">${empT("新增员工", "Mitarbeiter anlegen")}</a>
    </section>`}`;
}

function empInviteGroupHint(state) {
  return {
    submitted: empT("员工已经交了，卡在这里就等于新人上不了岗。", "Der Mitarbeiter hat abgegeben — hier bleibt der Start hängen."),
    returned: empT("已退回给员工补充，等他重新提交。", "Zur Ergänzung zurückgegeben, wartet auf erneute Abgabe."),
    sent: empT("邮件已发出，等员工点链接填写。", "E-Mail ist raus, wartet auf den Mitarbeiter."),
    draft: empT("档案建好了但邀请邮件还没发。", "Angelegt, Einladung noch nicht gesendet.")
  }[state] || "";
}

function empInviteRow(e) {
  const pr = empInviteProgress(e);
  const inv = e.invite;
  const href = `#${slug("employee", "邀请详情")}?id=${encodeURIComponent(e.id)}`;
  const last = inv.state === "submitted" ? empT(`提交于 ${empStamp(inv.submittedAt)}`, `Abgegeben ${empStamp(inv.submittedAt)}`)
    : inv.state === "returned" ? empT(`退回于 ${empStamp(inv.reviewedAt)}`, `Zurück ${empStamp(inv.reviewedAt)}`)
    : inv.state === "sent" ? empT(`发送于 ${empStamp(inv.sentAt)}${inv.reminders?.length ? ` · 催过 ${inv.reminders.length} 次` : ""}`,
                                  `Gesendet ${empStamp(inv.sentAt)}${inv.reminders?.length ? ` · ${inv.reminders.length}× erinnert` : ""}`)
    : empT("还没发送", "Noch nicht gesendet");
  const stale = inv.state === "sent" && inv.sentAt && empDaysBetween(inv.sentAt.slice(0, 10), empToday()) >= 3;
  return `<tr class="${stale ? "emp-alert-tr is-warn" : ""}">
    <td><a class="emp-name-link" href="${href}">${empEsc(e.name || empT("（未填姓名）", "(ohne Namen)"))}</a>
      <small class="emp-note">${empEsc(e.contact.email)}</small></td>
    <td>${empEsc(e.store)}</td>
    <td>${empText(empRole(e.role).name)} · ${empText(empContractType(e.contract.type).name)}</td>
    <td><span class="emp-progress"><i style="width:${pr.total ? Math.round(pr.done / pr.total * 100) : 0}%"></i></span> ${pr.done}/${pr.total}</td>
    <td>${last}</td>
    <td class="button-cell single-action"><a class="ghost-btn" href="${href}">${
      inv.state === "submitted" ? empT("审核", "Prüfen") : empT("查看", "Ansehen")}</a></td>
  </tr>`;
}

/* ============================================================ 邀请详情 ==== */
function employeeInviteDetailPage() {
  const e = empById(state().params.get("id"));
  if (!e || !e.invite) return `<div class="page-head"><h1>${empT("邀请详情", "Einladung")}</h1></div>
    <section class="card"><p class="emp-empty">${empT("找不到这条邀请，可能已经撤销或审核通过了。", "Einladung nicht gefunden — evtl. zurückgezogen oder bereits freigegeben.")}</p>
    <div style="text-align:center"><a class="ghost-btn" href="#${slug("employee", "入职邀请")}">${empT("返回入职邀请", "Zurück zu den Einladungen")}</a></div></section>`;
  const inv = e.invite;
  const st = empInviteState(inv.state);
  const pr = empInviteProgress(e);
  const mail = empInviteMail(e, inv.lang);
  const step = inv.state === "draft" ? 0 : inv.state === "submitted" ? 2 : 1;
  return `
    <div class="page-head">
      <div><h1>${empEsc(e.name || empT("（未填姓名）", "(ohne Namen)"))}</h1>
      <p>${empEsc(e.store)} · ${empText(empRole(e.role).name)} · ${empText(empContractType(e.contract.type).name)}　${empPill(st.tone, empText(st.name))}</p></div>
      <div class="button-row">${empBack(`#${slug("employee", "入职邀请")}`, "入职邀请", "Einladungen")}</div>
    </div>
    ${empFlowSteps(step)}
    ${inv.state === "returned" ? `<section class="card emp-returned">
      <strong>${empT("已退回给员工补充", "Zur Ergänzung zurückgegeben")}</strong>
      <p>${empEsc(inv.returnNote) || empT("（没写理由）", "(ohne Begründung)")}</p>
      <span>${empT(`退回于 ${empStamp(inv.reviewedAt)}`, `Am ${empStamp(inv.reviewedAt)}`)}</span>
    </section>` : ""}

    <div class="emp-invite-grid" data-id="${empEsc(e.id)}">
      <section class="card">
        <div class="section-title"><h2>${empT("邀请邮件", "Einladungs-E-Mail")}</h2>
          <label class="emp-store-switch"><span>${empT("语言", "Sprache")}</span>
            <select class="emp-invite-lang" data-id="${empEsc(e.id)}">
              ${[["zh", "中文"], ["de", "Deutsch"], ["both", empT("中文 + Deutsch", "Chinesisch + Deutsch")]]
                .map(o => `<option value="${o[0]}"${inv.lang === o[0] ? " selected" : ""}>${empEsc(o[1])}</option>`).join("")}
            </select></label>
        </div>
        <div class="field"><label>${empT("收件人", "Empfänger")}</label><input data-emp-field="contact.email" value="${empEsc(e.contact.email)}"></div>
        <div class="field"><label>${empT("主题", "Betreff")}</label><input value="${empEsc(mail.subject)}" readonly></div>
        <div class="field"><label>${empT("正文", "Text")}</label><textarea rows="11" readonly>${empEsc(mail.body)}</textarea></div>
        <div class="emp-link-row">
          <span>${empT("填写链接", "Ausfüll-Link")}</span>
          <code class="emp-link">${empEsc(empInviteLink(e))}</code>
          <button class="ghost-btn emp-copy-link" data-link="${empEsc(empInviteLink(e))}">${empT("复制", "Kopieren")}</button>
          <a class="ghost-btn" href="${empInviteLink(e)}" target="_self">${empT("以员工身份打开", "Als Mitarbeiter öffnen")}</a>
        </div>
        <div class="button-row" style="margin-top:12px">
          ${inv.state === "draft"
            ? `<button class="primary-btn emp-send-invite" data-id="${empEsc(e.id)}">${empT("发送邀请邮件", "Einladung senden")}</button>`
            : `<button class="ghost-btn emp-send-invite" data-id="${empEsc(e.id)}">${empT("重新发送", "Erneut senden")}</button>
               ${inv.state === "sent" || inv.state === "returned" ? `<button class="ghost-btn emp-remind-invite" data-id="${empEsc(e.id)}">${empT("催一下", "Erinnern")}</button>` : ""}`}
          <button class="ghost-btn danger-lite emp-revoke-invite" data-id="${empEsc(e.id)}">${empT("撤销邀请", "Zurückziehen")}</button>
        </div>
        <div class="emp-revoke-confirm is-hidden" data-id="${empEsc(e.id)}">
          <strong>${empT("撤销后这条档案和链接都会删掉，确定吗？", "Beim Zurückziehen werden Datensatz und Link gelöscht. Sicher?")}</strong>
          <div class="button-row"><button class="ghost-btn emp-revoke-cancel">${empT("取消", "Abbrechen")}</button><button class="primary-btn danger-solid emp-revoke-yes" data-id="${empEsc(e.id)}">${empT("确认撤销", "Zurückziehen")}</button></div>
        </div>
        ${empInviteTimeline(inv)}
      </section>

      <section class="card">
        <div class="section-title">
          <div><h2>${empT("员工提交的内容", "Angaben des Mitarbeiters")}</h2>
          <p>${empT("审核通过前，这些只是暂存，不进正式档案。", "Bis zur Freigabe nur zwischengespeichert, nicht in der Akte.")}</p></div>
          <span class="small">${pr.done}/${pr.total}</span>
        </div>
        ${inv.state === "draft" || inv.state === "sent"
          ? `<p class="emp-empty">${pr.done ? empT(`员工填了一部分（${pr.done}/${pr.total}），还没提交。`, `Teilweise ausgefüllt (${pr.done}/${pr.total}), noch nicht abgegeben.`)
                                              : empT("员工还没开始填。", "Noch nichts ausgefüllt.")}</p>`
          : empInviteReview(e, pr)}
      </section>
    </div>

    ${inv.state === "submitted" ? `<section class="card emp-approve" data-id="${empEsc(e.id)}">
      <div class="section-title"><div><h2>${empT("审核", "Prüfung")}</h2>
        <p>${empT("通过后，员工提交的资料合并进正式档案，人进在岗名册，证件开始进到期预警。", "Nach Freigabe werden die Angaben in die Akte übernommen, die Person erscheint im Team und die Dokumentfristen werden überwacht.")}</p></div></div>
      <div class="form-grid">
        ${empSelect(empT("通过后的状态", "Status nach Freigabe"), "approve.status", [["probation", empRaw(empStatus("probation").name)], ["active", empRaw(empStatus("active").name)]], "probation")}
        ${empInput(empT("入职日期", "Eintrittsdatum"), "approve.entryDate", e.entryDate || empToday(), "date")}
        ${empInput(`${empT("试用期结束", "Ende der Probezeit")}<small>${empT("留空 = 不设试用期", "leer = keine Probezeit")}</small>`,
          "approve.probationEnd", empAddMonths(e.entryDate || empToday(), empRule("probationMonths")), "date")}
      </div>
      ${pr.complete ? "" : `<p class="emp-approve-warn">${empT(`还差 ${pr.missing.length} 项没填齐：${pr.missing.map(m => empRaw(m.name)).join("、")}。可以先退回补充。`,
        `${pr.missing.length} Angaben fehlen: ${pr.missing.map(m => empRaw(m.name)).join(", ")}. Besser zurückgeben.`)}</p>`}
      <div class="field" style="margin-top:12px"><label>${empT("退回理由（退回时必填）", "Begründung (bei Rückgabe nötig)")}</label>
        <textarea class="emp-return-note" rows="2" placeholder="${empT("例如：健康证拍得看不清到期日，麻烦重拍一张。", "z. B.: Ablaufdatum der Belehrung ist unleserlich, bitte neu fotografieren.")}"></textarea></div>
      <div class="button-row" style="margin-top:12px">
        <button class="ghost-btn danger-lite emp-return-btn" data-id="${empEsc(e.id)}">${empT("退回补充", "Zur Ergänzung zurückgeben")}</button>
        <button class="primary-btn emp-approve-btn" data-id="${empEsc(e.id)}">${empT("审核通过，建立正式档案", "Freigeben und Akte anlegen")}</button>
      </div>
    </section>` : ""}`;
}

function empInviteTimeline(inv) {
  const items = [[inv.createdAt, empT("建档", "Angelegt")]];
  if (inv.sentAt) items.push([inv.sentAt, empT("发送邀请邮件", "Einladung gesendet")]);
  (inv.reminders || []).forEach(r => items.push([r.at, r.kind === "resend" ? empT("重新发送", "Erneut gesendet") : empT("催办", "Erinnerung")]));
  if (inv.submittedAt) items.push([inv.submittedAt, empT("员工提交", "Mitarbeiter hat abgegeben")]);
  if (inv.reviewedAt) items.push([inv.reviewedAt, inv.state === "approved" ? empT("审核通过", "Freigegeben") : empT("退回补充", "Zurückgegeben")]);
  items.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return `<ul class="emp-timeline">${items.map(i => `<li><span>${empStamp(i[0])}</span><strong>${i[1]}</strong></li>`).join("")}</ul>`;
}

/* 逐项对照：公司填的 vs 员工填的。不一致的高亮，这是审核真正要看的东西。 */
function empInviteReview(e, pr) {
  const sub = e.invite.submitted || {};
  const rows = EMP_SELF_FIELDS.map(f => {
    const mine = empGetPath(e, f.path);
    const theirs = empGetPath(sub, f.path);
    return { name: f.name, mine, theirs, filled: theirs != null && String(theirs).trim() !== "" };
  });
  const docs = empSelfDocs(e).map(t => {
    const d = sub.docs?.[t.id];
    return { type: t, doc: d, ok: d && d.state === "ok", needExpiry: t.expiry && (!d || !d.expiry) };
  });
  const c = sub.contract || {};
  const diffs = [];
  if (c.urlaubDays != null && Number(c.urlaubDays) !== Number(e.contract.urlaubDays))
    diffs.push([empT("年假天数", "Urlaubstage"), `${e.contract.urlaubDays}`, `${c.urlaubDays}`]);
  if (c.noticePeriod && c.noticePeriod !== e.contract.noticePeriod)
    diffs.push(["Kündigungsfrist", e.contract.noticePeriod, c.noticePeriod]);
  return `
    <div class="emp-review-block">
      <h3>${empT("个人资料", "Persönliche Daten")}</h3>
      <table class="table emp-table emp-review-table">
        <thead><tr><th>${empT("项目", "Feld")}</th><th>${empT("员工填的", "Angabe")}</th></tr></thead>
        <tbody>${rows.map(r => `<tr class="${r.filled ? "" : "is-missing"}">
          <td>${empText(r.name)}</td>
          <td>${r.filled ? empEsc(r.theirs) : `<span class="emp-miss">${empT("没填", "fehlt")}</span>`}</td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="emp-review-block">
      <h3>${empT("证件", "Dokumente")}</h3>
      ${docs.map(d => `<div class="emp-doc is-${d.ok ? (d.needExpiry ? "warn" : "ok") : "missing"}">
        <div class="emp-doc-head"><strong>${empText(d.type.name)}</strong>${
          d.ok ? (d.needExpiry ? empPill("orange", empT("缺到期日", "Ablauf fehlt")) : empPill("green", empT("已上传", "Hochgeladen")))
               : empPill("red", empT("未上传", "Fehlt"))}</div>
        <div class="emp-doc-body">
          ${d.doc?.file ? empFileLink(d.doc) : ""}
          ${d.type.expiry && d.doc?.expiry ? `<span class="emp-doc-days">${empT("到期", "Ablauf")} ${empFormatDate(d.doc.expiry)}</span>` : ""}
        </div>
      </div>`).join("")}
    </div>
    ${sub.contractFile || sub.contractNote || diffs.length ? `<div class="emp-review-block">
      <h3>${empT("合同核对", "Vertragsabgleich")}</h3>
      ${sub.contractFile ? `<p>${empFileLink({ file: sub.contractFile, ref: sub.contractRef })}</p>` : ""}
      ${diffs.length ? `<table class="table emp-table emp-review-table">
        <thead><tr><th>${empT("项目", "Feld")}</th><th>${empT("公司填的", "Betrieb")}</th><th>${empT("员工核对后", "Mitarbeiter")}</th></tr></thead>
        <tbody>${diffs.map(d => `<tr class="is-diff"><td>${d[0]}</td><td>${empEsc(d[1])}</td><td><strong>${empEsc(d[2])}</strong></td></tr>`).join("")}</tbody>
      </table>` : ""}
      ${sub.contractNote ? `<p class="emp-review-note">${empEsc(sub.contractNote)}</p>` : ""}
    </div>` : ""}`;
}

/* ======================================================== 员工自填页 ======
   由邀请邮件里的链接进来：#onboarding?t=<token>
   这是全站唯一给员工看的页面，所以没有左侧导航（照 welcome 的做法），
   也不假设对方懂系统 —— 一屏之内说清「你是谁、要填什么、还差几项」。
   D5 定的是「员工助手只做老板/店长视角」，这一页不违反：它不是员工的工作台，
   是一次性的表单，填完就没了。
   ========================================================================== */
function employeeOnboardingPage() {
  const token = state().params.get("t");
  if (empTokenKind(token) === "topup") return employeeTopupPage(token);
  const e = empByToken(token);
  if (!e) return empOnboardShell(`
    <div class="emp-onboard-msg">
      <h1>${empT("链接无效", "Link ungültig")}</h1>
      <p>${empT("这个填写链接不存在，可能已经被撤销。请联系店长重新发一份。", "Dieser Link existiert nicht mehr — evtl. zurückgezogen. Bitte die Filialleitung um eine neue Einladung bitten.")}</p>
    </div>`);
  if (e.invite.state === "approved") return empOnboardShell(`
    <div class="emp-onboard-msg is-done">
      <h1>${empT("资料已通过审核", "Angaben freigegeben")}</h1>
      <p>${empT(`${e.name}，您的资料已经通过 ${e.store} 的审核，这个链接不再需要了。`, `${e.name}, Ihre Angaben wurden von ${e.store} freigegeben. Dieser Link wird nicht mehr benötigt.`)}</p>
    </div>`);
  if (e.invite.state === "submitted") return empOnboardShell(`
    <div class="emp-onboard-msg is-done">
      <h1>${empT("已提交，等店长核对", "Abgegeben — Prüfung läuft")}</h1>
      <p>${empT(`${e.name}，您在 ${empStamp(e.invite.submittedAt)} 提交了资料，${e.store} 的店长会核对一遍。有问题会退回给您补充。`,
                `${e.name}, Ihre Angaben sind am ${empStamp(e.invite.submittedAt)} eingegangen. Die Leitung von ${e.store} prüft sie und meldet sich bei Rückfragen.`)}</p>
      <button class="ghost-btn emp-onboard-edit" data-token="${empEsc(token)}">${empT("我还要改一下", "Noch etwas ändern")}</button>
    </div>`);

  const sub = e.invite.submitted || {};
  const pr = empInviteProgress(e);
  const c = e.contract;
  const need = empSelfDocs(e);
  const val = path => { const v = empGetPath(sub, path); return v == null ? "" : v; };
  return empOnboardShell(`
    <header class="emp-onboard-head">
      <div>
        <span class="emp-onboard-store">${empEsc(e.store)}</span>
        <h1>${empT("请填写您的入职资料", "Bitte Ihre Einstellungsunterlagen ausfüllen")}</h1>
        <p>${empT("填完提交后由店长核对。资料只用于劳动合同、社保申报和工资发放。", "Nach dem Absenden prüft die Filialleitung. Die Daten werden nur für Arbeitsvertrag, Sozialversicherung und Lohnabrechnung verwendet.")}</p>
      </div>
      <label class="emp-store-switch"><span>${empT("语言", "Sprache")}</span>
        <select class="emp-lang-select">
          <option value="zh"${empDe() ? "" : " selected"}>中文</option>
          <option value="de"${empDe() ? " selected" : ""}>Deutsch</option>
        </select></label>
    </header>

    ${e.invite.state === "returned" ? `<div class="emp-returned">
      <strong>${empT("店长把资料退回来了，请按下面这条补充后重新提交", "Die Leitung hat Ihre Angaben zurückgegeben — bitte ergänzen und erneut absenden")}</strong>
      <p>${empEsc(e.invite.returnNote)}</p>
    </div>` : ""}

    <div class="emp-onboard-progress">
      <span class="emp-progress"><i style="width:${pr.total ? Math.round(pr.done / pr.total * 100) : 0}%"></i></span>
      <strong>${pr.done} / ${pr.total}</strong>
      <span>${pr.complete ? empT("都填好了，可以提交了", "Vollständig — Sie können absenden")
                          : empT(`还差 ${pr.missing.length} 项`, `Noch ${pr.missing.length} offen`)}</span>
    </div>

    <form class="emp-onboard" data-token="${empEsc(token)}" onsubmit="return false">
      <section class="card">
        <div class="section-title"><h2>${empT("个人资料", "Persönliche Daten")}</h2></div>
        <div class="form-grid">
          ${empInput(empT("姓名", "Name"), "name", sub.name != null ? sub.name : e.name)}
          ${empInput(`${empT("出生日期", "Geburtsdatum")}<small>${empT("社保申报必填", "Für die Sozialversicherung nötig")}</small>`, "birthday", val("birthday"), "date")}
          ${empInput(empT("电话", "Telefon"), "contact.phone", val("contact.phone"))}
          ${empInput(empT("邮箱", "E-Mail"), "contact.email", val("contact.email") || e.contact.email)}
          ${empInput(empT("街道", "Strasse"), "contact.street", val("contact.street"))}
          ${empInput(empT("门牌号", "Hausnummer"), "contact.houseNo", val("contact.houseNo"))}
          ${empInput(empT("邮编", "PLZ"), "contact.zip", val("contact.zip"))}
          ${empInput(empT("城市", "Stadt"), "contact.city", val("contact.city"))}
          ${empInput(empT("紧急联系人", "Notfallkontakt"), "contact.emergency", val("contact.emergency"))}
          ${empSelect(empT("沟通语言", "Sprache"), "contact.language", empLangOptions(), val("contact.language") || e.contact.language)}
        </div>
      </section>

      <section class="card">
        <div class="section-title"><h2>${empT("税号与银行", "Steuer und Bank")}</h2>
          <span class="small">${empT("发工资要用", "Für die Lohnzahlung nötig")}</span></div>
        <div class="form-grid">
          ${empInput(`${empT("保险公司名称 Krankenkasse", "Krankenkasse")}<small>${empT("例如 AOK、TK、Barmer", "z. B. AOK, TK, Barmer")}</small>`, "contact.krankenkasse", val("contact.krankenkasse"))}
          ${empInput("Steuernummer", "ids.steuernummer", val("ids.steuernummer"))}
          ${empInput("Rentenversicherung Nr.", "ids.rentenversicherung", val("ids.rentenversicherung"))}
          ${empInput("IBAN", "ids.iban", val("ids.iban"))}
          ${empInput("BIC", "ids.bic", val("ids.bic"))}
        </div>
      </section>

      <section class="card">
        <div class="section-title"><h2>${empT("证件", "Dokumente")}</h2>
          <span class="small">${empT(`您需要交 ${need.length} 份`, `${need.length} Dokumente erforderlich`)}</span></div>
        <p class="small emp-upload-note">${empT("这是静态演示原型，没有后端，选中的文件不会真的上传，只记下文件名。",
                                                "Statischer Prototyp ohne Backend: Dateien werden nicht hochgeladen, nur der Dateiname wird notiert.")}</p>
        ${need.map(t => {
          const d = sub.docs?.[t.id] || {};
          const done = d.state === "ok";
          return `<div class="emp-doc is-${done ? (t.expiry && !d.expiry ? "warn" : "ok") : "missing"}">
            <div class="emp-doc-head"><strong>${empText(t.name)}</strong>${
              done ? (t.expiry && !d.expiry ? empPill("orange", empT("还差到期日", "Ablauf fehlt")) : empPill("green", empT("已选好", "Ausgewählt")))
                   : empPill("red", empT("待上传", "Offen"))}</div>
            <div class="emp-doc-body">
              <label class="emp-upload-btn">${empT("选择文件", "Datei wählen")}
                <input type="file" class="emp-doc-file" data-doc="${t.id}"></label>
              ${d.file ? empFileLink(d) : ""}
              ${t.expiry ? `<label class="emp-doc-exp"><span>${empT("证件上的到期日", "Ablaufdatum")}</span>
                <input type="date" class="emp-doc-date" data-doc="${t.id}" value="${empEsc(d.expiry || "")}"></label>` : ""}
              ${d.file ? `<button type="button" class="ghost-btn danger-lite emp-doc-clear" data-doc="${t.id}">${empT("移除", "Entfernen")}</button>` : ""}
            </div>
          </div>`;
        }).join("")}
      </section>

      <section class="card">
        <div class="section-title"><h2>${empT("核对合同条件", "Vertragsbedingungen prüfen")}</h2></div>
        <p class="small">${empT("下面是公司登记的条件。请对照您手里签的合同，如果哪一项不一样，直接改掉并在备注里说明。",
                               "Das sind die vom Betrieb erfassten Werte. Bitte mit Ihrem unterschriebenen Vertrag abgleichen; bei Abweichungen ändern und im Feld unten erklären.")}</p>
        <div class="emp-contract-check">
          ${[[empT("岗位", "Position"), empRaw(empRole(e.role).name)],
             [empT("合同类型", "Vertragsart"), empRaw(empContractType(c.type).name)],
             [empT("薪资", "Vergütung"), c.payType === "pauschal" ? `€${c.rate} ${empT("/ 月", "/ Monat")}` : `€${Number(c.rate).toFixed(2)} / h`],
             [empT("月工时", "Sollstunden/Monat"), `${c.hoursMin}–${c.hoursMax}h`]]
            .map(x => `<div class="emp-contract-row"><span>${x[0]}</span><strong>${empEsc(x[1])}</strong></div>`).join("")}
        </div>
        <div class="form-grid" style="margin-top:12px">
          ${empInput(empT("年假天数 Urlaubstag", "Urlaubstage"), "contract.urlaubDays", val("contract.urlaubDays") !== "" ? val("contract.urlaubDays") : c.urlaubDays, "number")}
          ${empInput("Kündigungsfrist", "contract.noticePeriod", val("contract.noticePeriod") || c.noticePeriod)}
        </div>
        <div class="emp-doc" style="margin-top:12px">
          <div class="emp-doc-head"><strong>${empT("上传劳动合同（可选）", "Arbeitsvertrag hochladen (optional)")}</strong></div>
          <div class="emp-doc-body">
            <label class="emp-upload-btn">${empT("选择文件", "Datei wählen")}<input type="file" class="emp-contract-file"></label>
            ${sub.contractFile ? empFileLink({ file: sub.contractFile, ref: sub.contractRef }) : ""}
          </div>
        </div>
        <div class="field" style="margin-top:12px"><label>${empT("有哪里不一样？写在这里", "Abweichungen bitte hier notieren")}</label>
          <textarea data-emp-field="contractNote" rows="2" placeholder="${empT("例如：合同上写的年假是 14 天。", "z. B.: Im Vertrag stehen 14 Urlaubstage.")}">${empEsc(sub.contractNote || "")}</textarea></div>
      </section>

      <div class="emp-onboard-actions">
        <button type="button" class="ghost-btn emp-onboard-save">${empT("先存着，稍后再填", "Zwischenspeichern")}</button>
        <button type="button" class="primary-btn emp-onboard-submit">${empT("提交给店长", "An die Leitung senden")}</button>
      </div>
      <p class="emp-approve-warn${pr.complete ? " is-hidden" : ""}">${pr.complete ? "" : empT(
        `还差：${pr.missing.map(m => empRaw(m.name) + (m.kind === "expiry" ? "（到期日）" : "")).join("、")}`,
        `Es fehlen: ${pr.missing.map(m => empRaw(m.name) + (m.kind === "expiry" ? " (Ablaufdatum)" : "")).join(", ")}`)}</p>
    </form>`);
}

/* 补件页。跟入职页共用外壳和存盘逻辑，但只列该他补的那几项 ——
   让一个只是要重传健康证的人再把地址税号全填一遍，他就不填了。 */
function employeeTopupPage(token) {
  const e = empByToken(token);
  const req = e.request;
  if (req.state === "submitted") return empOnboardShell(`
    <div class="emp-onboard-msg is-done">
      <h1>${empT("已收到，等店里核对", "Eingegangen — wird geprüft")}</h1>
      <p>${empT(`${e.name}，你在 ${empStamp(req.submittedAt)} 交了资料，${e.store} 会核对一下。有问题会再发给你。`,
                `${e.name}, Ihre Unterlagen sind am ${empStamp(req.submittedAt)} eingegangen. ${e.store} prüft sie und meldet sich bei Rückfragen.`)}</p>
      <button class="ghost-btn emp-topup-edit" data-token="${empEsc(token)}">${empT("我还要改一下", "Noch etwas ändern")}</button>
    </div>`);

  const pr = empRequestProgress(e);
  return empOnboardShell(`
    <header class="emp-onboard-head">
      <div>
        <span class="emp-onboard-store">${empEsc(e.store)}</span>
        <h1>${empT("请补交这几份材料", "Bitte diese Unterlagen nachreichen")}</h1>
        <p>${empT(`${e.name}，下面 ${pr.total} 项需要你补一下。传完点提交，店里核对后就归档，不用再跑一趟。`,
                  `${e.name}, ${pr.total} Angaben fehlen noch. Nach dem Absenden prüft der Betrieb kurz und legt alles ab.`)}</p>
      </div>
      <label class="emp-store-switch"><span>${empT("语言", "Sprache")}</span>
        <select class="emp-lang-select">
          <option value="zh"${empDe() ? "" : " selected"}>中文</option>
          <option value="de"${empDe() ? " selected" : ""}>Deutsch</option>
        </select></label>
    </header>

    ${req.note ? `<div class="emp-returned">
      <strong>${empT("店里的留言", "Nachricht vom Betrieb")}</strong>
      <p>${empEsc(req.note)}</p>
    </div>` : ""}

    <div class="emp-onboard-progress">
      <span class="emp-progress"><i style="width:${pr.total ? Math.round(pr.done / pr.total * 100) : 0}%"></i></span>
      <strong>${pr.done} / ${pr.total}</strong>
      <span>${pr.complete ? empT("都好了，可以提交", "Vollständig — Sie können absenden")
                          : empT(`还差 ${pr.missing.length} 项`, `Noch ${pr.missing.length} offen`)}</span>
    </div>

    ${empTopupForm(e, token)}`);
}

/* 要补的那几项做成一块，补件链接页和员工端「我的」共用 —— 两处长一样、行为一样，
   本来就该是同一段代码。绑定也共用 empBindAll 里那一套（认的是 .emp-onboard[data-token]）。 */
function empTopupForm(e, token) {
  const req = e.request;
  const pr = empRequestProgress(e);
  const sub = req.submitted || {};
  const val = path => { const v = empGetPath(sub, path); return v == null ? "" : v; };
  return `
    <form class="emp-onboard emp-topup" data-token="${empEsc(token)}" onsubmit="return false">
      ${req.items.filter(i => i.kind === "field").length ? `<section class="card">
        <div class="section-title"><h2>${empT("要填的", "Auszufüllen")}</h2></div>
        <div class="form-grid">
          ${req.items.filter(i => i.kind === "field").map(i => {
            const f = EMP_KEY_FIELDS.find(x => x.path === i.path);
            const label = `${empText(f.name)}<small>${empText(f.why)}</small>`;
            return empInput(label, i.path, val(i.path), i.path === "birthday" ? "date" : "text");
          }).join("")}
        </div>
      </section>` : ""}

      ${req.items.filter(i => i.kind === "doc").length ? `<section class="card">
        <div class="section-title"><h2>${empT("要传的", "Hochzuladen")}</h2></div>
        <p class="small emp-upload-note">${empT("这是静态演示原型，没有后端，选中的文件不会真的上传，只记下文件名。",
                                                "Statischer Prototyp ohne Backend: Dateien werden nicht hochgeladen, nur der Dateiname wird notiert.")}</p>
        ${req.items.filter(i => i.kind === "doc").map(i => {
          const type = empDocType(i.id);
          const d = sub.docs?.[i.id] || {};
          const done = d.state === "ok";
          const old = e.docs?.[i.id];
          return `<div class="emp-doc is-${done ? (type.expiry && !d.expiry ? "warn" : "ok") : "missing"}">
            <div class="emp-doc-head"><strong>${empText(type.name)}</strong>${
              done ? (type.expiry && !d.expiry ? empPill("orange", empT("还差到期日", "Ablauf fehlt")) : empPill("green", empT("已选好", "Ausgewählt")))
                   : empPill("red", empT("待上传", "Offen"))}</div>
            ${old?.expiry ? `<span class="emp-doc-why">${empT(`店里存的那份 ${empFormatDate(old.expiry)} 到期，需要换新的。`,
                                                              `Die hinterlegte Fassung läuft am ${empFormatDate(old.expiry)} ab.`)}</span>` : ""}
            <div class="emp-doc-body">
              <label class="emp-upload-btn">${empT("选择文件", "Datei wählen")}
                <input type="file" class="emp-doc-file" data-doc="${type.id}"></label>
              ${d.file ? empFileLink(d) : ""}
              ${type.expiry ? `<label class="emp-doc-exp"><span>${empT("新证件上的到期日", "Neues Ablaufdatum")}</span>
                <input type="date" class="emp-doc-date" data-doc="${type.id}" value="${empEsc(d.expiry || "")}"></label>` : ""}
              ${d.file ? `<button type="button" class="ghost-btn danger-lite emp-doc-clear" data-doc="${type.id}">${empT("移除", "Entfernen")}</button>` : ""}
            </div>
          </div>`;
        }).join("")}
      </section>` : ""}

      <div class="emp-onboard-actions">
        <button type="button" class="ghost-btn emp-onboard-save">${empT("先存着", "Zwischenspeichern")}</button>
        <button type="button" class="primary-btn emp-onboard-submit">${empT("提交", "Absenden")}</button>
      </div>
      <p class="emp-approve-warn${pr.complete ? " is-hidden" : ""}">${pr.complete ? "" : empT(
        `还差：${pr.missing.map(m => empItemName(m) + (m.needExpiry ? "（到期日）" : "")).join("、")}`,
        `Es fehlen: ${pr.missing.map(m => empItemName(m) + (m.needExpiry ? " (Ablaufdatum)" : "")).join(", ")}`)}</p>
    </form>`;
}

/* 无侧栏外壳。照 welcome 的做法直接接管 #app。 */
function empOnboardShell(inner) {
  return `<main class="emp-onboard-wrap"><div data-no-translate class="emp-page emp-onboard-page">
    <div class="brand emp-onboard-brand">
      <div class="logo-ring"></div>
      <div><div class="brand-title">KaiSpan</div><div class="brand-subtitle">AI Business Operating System</div></div>
    </div>
    ${inner}
  </div></main>`;
}

/* ================================================================ 绑定 ===== */
function empBindAll() {
  /* --- 员工资料保存 --- */
  document.querySelectorAll(".emp-save-btn").forEach(button => {
    button.addEventListener("click", () => {
      const root = document.querySelector(".emp-profile");
      const e = empById(button.dataset.id);
      if (!root || !e) return;
      const next = JSON.parse(JSON.stringify(e));
      root.querySelectorAll("[data-emp-field]").forEach(input => {
        /* 离职表单里的字段归离职流程管，别被「保存修改」顺手写进档案 */
        if (input.dataset.empField.startsWith("leave.")) return;
        empSetPath(next, input.dataset.empField, empFieldValue(input));
      });
      /* 状态按日期推出来，不从表单读 —— 表单里已经没有这个下拉了 */
      empNormalizeStatus(next);
      next.docs = next.docs || {};
      root.querySelectorAll(".emp-doc-have").forEach(box => {
        const key = box.dataset.doc;
        next.docs[key] = next.docs[key] || {};
        next.docs[key].state = box.checked ? "ok" : "missing";
      });
      root.querySelectorAll(".emp-doc-date").forEach(input => {
        const key = input.dataset.doc;
        next.docs[key] = next.docs[key] || { state: "missing" };
        next.docs[key].expiry = input.value || null;
      });
      empSaveWithHistory(next);
      empMarkSaved(button.dataset.id);
      app();
    });
  });

  /* --- 勾选：没勾人的时候不显示批量条，省得占一行还点不动 ---
     注意这一条和下面的搜索共用 .is-hidden。搜索原来写的是「有结果就显示 footer」，
     跟这里的「没勾人就藏起来」互相打架 —— 清空搜索框会把没勾人的批量条又显出来。
     现在统一由 syncSelection() 说了算，搜索只在无结果时强制藏。 */
  const footer = document.querySelector(".emp-roster")?.closest(".card")?.querySelector(".employee-table-footer");
  let syncSelection = () => {};
  if (footer) {
    const count = footer.querySelector(".emp-selected-count");
    const sync = () => {
      const picked = [...document.querySelectorAll(".emp-roster tbody .employee-row-check:checked")]
        .map(input => input.closest("tr")?.querySelector(".emp-name-link")?.textContent.trim())
        .filter(Boolean);
      const askable = picked.map(n => empByName(n)).filter(e => e && !empHasRequest(e) && empTopupItems(e).length);
      footer.classList.toggle("is-hidden", picked.length === 0);
      if (count) count.textContent = !picked.length ? ""
        : askable.length
          ? empT(`已选 ${picked.length} 人，其中 ${askable.length} 人有东西要补`, `${picked.length} ausgewählt, davon ${askable.length} mit offenen Punkten`)
          : empT(`已选 ${picked.length} 人，都没有要补的东西`, `${picked.length} ausgewählt — nichts anzufordern`);
      footer.querySelector(".emp-request-bulk")?.classList.toggle("is-hidden", askable.length === 0);
    };
    document.querySelectorAll(".emp-roster .employee-row-check").forEach(box => box.addEventListener("change", sync));
    /* 表头的全选。原来这一段在 app.js 的 bindEmployeeSelection 里，
       它只改 checked 不派发 change —— 结果点全选，下面的批量条一动不动。
       挪到这儿跟 sync 放一起，勾完当场重算。 */
    document.querySelectorAll(".emp-roster .employee-select-all").forEach(all => {
      all.addEventListener("change", () => {
        document.querySelectorAll(".emp-roster tbody .employee-row-check")
          .forEach(box => { box.checked = all.checked; });
        sync();
      });
    });
    syncSelection = sync;
    sync();
  }

  /* --- 列表：搜索 / 排序 / 导出 --- */
  /* 搜索直接在 DOM 里筛，不重渲染 —— 一边打字一边重建表格会把输入框的焦点弄丢 */
  const search = document.querySelector(".emp-search-input");
  if (search) {
    const rows = [...document.querySelectorAll(".emp-roster tbody tr")];
    const none = document.querySelector(".emp-noresult");
    const foot = document.querySelector(".employee-table-footer");
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      let hit = 0;
      rows.forEach(tr => {
        const on = !q || (tr.dataset.find || "").includes(q);
        tr.classList.toggle("is-hidden", !on);
        if (on) hit += 1;
      });
      none?.classList.toggle("is-hidden", hit > 0);
      if (hit === 0) foot?.classList.add("is-hidden");
      else syncSelection();   /* 有结果时交回给勾选逻辑，别硬显出来 */
    });
  }
  document.querySelectorAll(".emp-sort-select").forEach(select => {
    select.addEventListener("change", () => {
      const params = state().params;
      params.set("s", select.value);
      location.hash = `${state().route}?${params.toString()}`;
    });
  });
  document.querySelectorAll(".emp-export-btn").forEach(button => {
    button.addEventListener("click", () => {
      /* 导出「眼前这一份」：搜索是在 DOM 里筛的，所以直接读没被隐藏的那些行 */
      const names = [...document.querySelectorAll(".emp-roster tbody tr:not(.is-hidden) .emp-name-link")]
        .map(a => a.textContent.trim());
      const list = names.map(n => empByName(n)).filter(Boolean);
      if (!list.length) { empFlash(button, empT("这个列表是空的", "Liste ist leer")); return; }
      const blob = new Blob([empRosterCsv(list)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `KaiSpan_Mitarbeiter_${empToday()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      empFlash(button, empT(`已导出 ${list.length} 人`, `${list.length} exportiert`));
    });
  });

  /* --- 新增员工：选了合同类型就把默认工时和年假带出来 ---
     全职和 Minijob 的工时区间差着五倍，让人每次手填是没必要的。
     带出来的值仍然可改，只是省掉最常见那一次输入。 */
  const typeSelect = document.querySelector('.emp-new-layout [data-emp-field="contract.type"]');
  if (typeSelect) {
    const presets = {
      vollzeit: { hoursMin: 150, hoursMax: 173, urlaubDays: 24, rate: 15 },
      teilzeit: { hoursMin: 60, hoursMax: 80, urlaubDays: 20, rate: 13.5 },
      minijob: { hoursMin: 30, hoursMax: 43, urlaubDays: 12, rate: 12.8 },
      werkstudent: { hoursMin: 40, hoursMax: 80, urlaubDays: 20, rate: 14 }
    };
    typeSelect.addEventListener("change", () => {
      const preset = presets[typeSelect.value];
      if (!preset) return;
      Object.entries({ "contract.hoursMin": preset.hoursMin, "contract.hoursMax": preset.hoursMax,
                       "contract.urlaubDays": preset.urlaubDays, "contract.rate": preset.rate })
        .forEach(([path, value]) => {
          const input = document.querySelector(`.emp-new-layout [data-emp-field="${path}"]`);
          if (input) input.value = value;
        });
      const studentBox = document.querySelector('.emp-new-layout [data-emp-field="contract.isStudent"]');
      if (studentBox) studentBox.checked = typeSelect.value === "werkstudent";
      const hint = document.querySelector(".emp-preset-hint");
      if (hint) hint.textContent = empT(
        `已按${empRaw(empContractType(typeSelect.value).name)}带出默认值：${preset.hoursMin}–${preset.hoursMax}h / 月 · 年假 ${preset.urlaubDays} 天 · €${preset.rate} / h。要改展开下面那一栏。`,
        `Standardwerte für ${empRaw(empContractType(typeSelect.value).name)}: ${preset.hoursMin}–${preset.hoursMax} h/Monat · ${preset.urlaubDays} Urlaubstage · €${preset.rate}/h. Änderbar unten.`);
    });
  }

  /* --- 资料页：改了什么当场看得见 ---
     两件事以前都没有：改证件到期日，上面的状态标和剩余天数不动（要保存后才变，
     于是会出现「到期日 2027-10-05」配「已过期 9 天」这种自相矛盾的画面）；
     以及改完没有任何「还没保存」的提示。 */
  const profile = document.querySelector(".emp-profile");
  if (profile) {
    const dirtyTag = document.querySelector(".emp-dirty-tag");
    const saveBtn = document.querySelector(".emp-save-btn");
    const snapshot = new Map();
    const fields = () => profile.querySelectorAll("[data-emp-field]:not([data-emp-field^='leave.']), .emp-doc-have, .emp-doc-date");
    fields().forEach((input, i) => snapshot.set(i, input.type === "checkbox" ? input.checked : input.value));

    /* 证件卡片就地重算：不改数据，只把这一张卡按输入框里的值重画状态 */
    const recalcDocs = () => {
      const e = empById(profile.dataset.id);
      if (!e) return;
      profile.querySelectorAll(".emp-doc").forEach(card => {
        const have = card.querySelector(".emp-doc-have");
        const dateInput = card.querySelector(".emp-doc-date");
        if (!have) return;
        const key = have.dataset.doc;
        const probe = JSON.parse(JSON.stringify(e));
        probe.docs = probe.docs || {};
        probe.docs[key] = { state: have.checked ? "ok" : "missing",
                            expiry: dateInput ? (dateInput.value || null) : probe.docs[key]?.expiry || null };
        const st = empDocState(probe, key);
        card.className = `emp-doc is-${st.level}`;
        const pill = card.querySelector(".emp-doc-head .pill");
        if (pill) {
          const meta = EMP_DOC_LEVELS[st.level];
          pill.className = `pill ${meta.tone}`;
          pill.textContent = st.level === "missing" ? empT("未上传", "Fehlt") : empRaw(meta.name);
        }
        let days = card.querySelector(".emp-doc-days");
        if (st.days != null) {
          if (!days) {
            days = document.createElement("span");
            days.className = "emp-doc-days";
            card.querySelector(".emp-doc-body")?.appendChild(days);
          }
          days.textContent = empDaysLabel(st.days);
        } else if (days) {
          days.remove();
        }
      });
    };

    const syncDirty = () => {
      let changed = 0;
      fields().forEach((input, i) => {
        const now = input.type === "checkbox" ? input.checked : input.value;
        if (snapshot.get(i) !== now) changed += 1;
      });
      dirtyTag?.classList.toggle("is-hidden", changed === 0);
      if (dirtyTag) dirtyTag.textContent = empT(`${changed} 处未保存`, `${changed} nicht gespeichert`);
      document.querySelectorAll(".emp-save-btn").forEach(b => b.classList.toggle("is-dirty", changed > 0));
      document.querySelector(".emp-saved-tag")?.classList.toggle("is-hidden", changed > 0);
      /* 浮动保存条：改了才出现，所以不管滚到哪儿都有地方存 */
      const dock = document.querySelector(".emp-savedock");
      dock?.classList.toggle("is-hidden", changed === 0);
      const dockText = dock?.querySelector(".emp-savedock-text");
      if (dockText) dockText.textContent = empT(`改了 ${changed} 处，还没保存`, `${changed} Änderungen, nicht gespeichert`);
    };

    /* 必填字段的红标：填进去当场掉，不用等保存。红是「现在缺」，不是「这一格特殊」——
       保存之后才变的话，人会以为自己填的没算数。 */
    const syncNeeds = () => {
      profile.querySelectorAll(".field.is-need").forEach(f => {
        const input = f.querySelector("[data-emp-field]");
        f.classList.toggle("is-missing", !input || String(input.value || "").trim() === "");
      });
    };
    syncNeeds();

    document.querySelector(".emp-savedock-discard")?.addEventListener("click", () => app());
    profile.addEventListener("input", event => {
      if (event.target.closest(".emp-leave-form")) return;
      recalcDocs();
      syncNeeds();
      syncDirty();
    });
    profile.addEventListener("change", event => {
      if (event.target.closest(".emp-leave-form")) return;
      recalcDocs();
      syncNeeds();
      syncDirty();
    });
  }

  /* --- 入职日期填了，试用期结束日自动带出来（只在它还空着的时候）--- */
  const entryInput = document.querySelector('.emp-profile [data-emp-field="entryDate"]');
  const probInput = document.querySelector('.emp-profile [data-emp-field="probationEnd"]');
  if (entryInput && probInput) {
    entryInput.addEventListener("change", () => {
      if (!entryInput.value || probInput.value) return;
      probInput.value = empAddMonths(entryInput.value, empRule("probationMonths"));
      probInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  /* --- 新人清单 --- */
  document.querySelectorAll(".emp-newhire-check").forEach(box => {
    box.addEventListener("change", () => { empSetNewHireTask(box.dataset.id, box.dataset.task, box.checked); app(); });
  });
  document.querySelectorAll(".emp-sofort-copy").forEach(button => {
    button.addEventListener("click", () => {
      const e = empById(button.dataset.id);
      if (e) empCopy(empSofortText(e), button);
    });
  });
  document.querySelectorAll(".emp-sofort-done").forEach(button => {
    button.addEventListener("click", () => { empMarkSofort(button.dataset.id, true); app(); });
  });
  document.querySelectorAll(".emp-sofort-undo").forEach(button => {
    button.addEventListener("click", () => { empMarkSofort(button.dataset.id, false); app(); });
  });

  /* --- 员工账号 --- */
  document.querySelectorAll(".emp-account-open").forEach(button => {
    button.addEventListener("click", () => { empOpenAccount(button.dataset.id); app(); });
  });
  document.querySelectorAll(".emp-account-reset").forEach(button => {
    button.addEventListener("click", () => { empResetPassword(button.dataset.id); app(); });
  });
  document.querySelectorAll(".emp-copy-account").forEach(button => {
    button.addEventListener("click", () => {
      const e = empById(button.dataset.id);
      if (!e || !e.account) return;
      const mail = empAccountMail(e);
      empCopy(`${mail.subject}\n\n${mail.body}`, button);
    });
  });

  /* --- 新人清单上就地传合同 --- */
  document.querySelectorAll(".emp-newhire-doc-file").forEach(input => {
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      empUploadDoc(input.dataset.id, input.dataset.doc, file.name, empFileRef(file));
      app();
    });
  });
  document.querySelectorAll(".emp-newhire-doc-clear").forEach(button => {
    button.addEventListener("click", () => { empClearDoc(button.dataset.id, button.dataset.doc); app(); });
  });

  /* --- 补件请求：只推员工端，不再生成邮件草稿 --- */
  document.querySelectorAll(".emp-request-send").forEach(button => {
    button.addEventListener("click", () => {
      if (!empSendRequest(button.dataset.id)) {
        empFlash(button, empT("先开通员工账号", "Zuerst Mitarbeiterzugang anlegen"));
        return;
      }
      app();
    });
  });
  document.querySelectorAll(".emp-request-cancel").forEach(button => {
    button.addEventListener("click", () => { empCancelRequest(button.dataset.id); app(); });
  });
  document.querySelectorAll(".emp-request-accept").forEach(button => {
    button.addEventListener("click", () => { empAcceptRequest(button.dataset.id); app(); });
  });
  document.querySelectorAll(".emp-request-return").forEach(button => {
    button.addEventListener("click", () => {
      const note = button.closest(".emp-request-bar")?.querySelector(".emp-request-note");
      if (!note || !note.value.trim()) { empFlash(button, empT("写清楚哪里不行", "Bitte begründen")); note?.focus(); return; }
      empReturnRequest(button.dataset.id, note.value.trim());
      app();
    });
  });
  /* 批量：只推给已经有员工账号的人；没有账号的保留在待处理里，不走邮件兜底。 */
  document.querySelectorAll(".emp-request-bulk").forEach(button => {
    button.addEventListener("click", () => {
      const names = [...document.querySelectorAll(".emp-roster tbody .employee-row-check:checked")]
        .map(input => input.closest("tr")?.querySelector(".emp-name-link")?.textContent.trim())
        .filter(Boolean);
      if (!names.length) { empFlash(button, empT("先勾选员工", "Erst Mitarbeiter auswählen")); return; }
      let pushed = 0;
      let skipped = 0;
      names.forEach(name => {
        const e = empByName(name);
        if (!e || empHasRequest(e) || !empTopupItems(e).length) return;
        if (empSendRequest(e.id)) pushed += 1;
        else skipped += 1;
      });
      if (!pushed) {
        empFlash(button, skipped
          ? empT("所选员工还没有账号，先到个人档案开通", "Die ausgewählten Mitarbeiter haben noch keinen Zugang")
          : empT("勾选的人没有要补的", "Nichts anzufordern"));
        return;
      }
      app();
      if (skipped) {
        document.querySelector(".emp-listbar")?.insertAdjacentHTML("afterend",
          `<p class="emp-inline-result" role="status">${empT(`已推送 ${pushed} 人；${skipped} 人没有员工账号，未推送。`, `${pushed} gesendet; ${skipped} ohne Mitarbeiterzugang.`)}</p>`);
      }
    });
  });
  /* 补件页的「我还要改一下」 */
  document.querySelectorAll(".emp-topup-edit").forEach(button => {
    button.addEventListener("click", () => {
      const e = empByToken(button.dataset.token);
      if (!e) return;
      e.request.state = "sent";
      empSaveStaff(e);
      app();
    });
  });

  /* --- 试用期转正 / 离职 / 撤销离职 --- */
  document.querySelectorAll(".emp-probation-clear").forEach(button => {
    button.addEventListener("click", () => { empConfirmProbation(button.dataset.id); app(); });
  });
  document.querySelectorAll(".emp-probation-fill").forEach(button => {
    button.addEventListener("click", () => {
      const e = empById(button.dataset.id);
      if (!e || !e.entryDate) return;
      const next = JSON.parse(JSON.stringify(e));
      next.probationEnd = empAddMonths(e.entryDate, empRule("probationMonths"));
      empNormalizeStatus(next);
      empSaveWithHistory(next);
      app();
    });
  });
  document.querySelectorAll(".emp-leave-open").forEach(button => {
    button.addEventListener("click", () => button.closest(".card")?.querySelector(".emp-leave-form")?.classList.remove("is-hidden"));
  });
  document.querySelectorAll(".emp-leave-cancel").forEach(button => {
    button.addEventListener("click", () => button.closest(".emp-leave-form")?.classList.add("is-hidden"));
  });
  document.querySelectorAll(".emp-leave-confirm").forEach(button => {
    button.addEventListener("click", () => {
      const form = button.closest(".emp-leave-form");
      const leave = {};
      form?.querySelectorAll("[data-emp-field]").forEach(input => {
        leave[input.dataset.empField.replace("leave.", "")] = empFieldValue(input);
      });
      empSetLeave(button.dataset.id, leave);
      app();
    });
  });
  document.querySelectorAll(".emp-undo-leave").forEach(button => {
    button.addEventListener("click", () => { empUndoLeave(button.dataset.id); app(); });
  });

  /* --- 新增员工 --- */
  document.querySelectorAll(".emp-create-btn").forEach(button => {
    button.addEventListener("click", () => {
      const draft = {
        id: empNextId(), name: "", store: empScope() || empStores()[0], role: "front", level: "basic",
        status: "invited", entryDate: "", probationEnd: null,
        contract: { type: "teilzeit", payType: "hourly", rate: 13.5, hoursMin: 60, hoursMax: 80,
                    urlaubDays: 20, noticePeriod: "4 Wochen zum 15. oder Monatsende", isStudent: false, nonEU: false },
        contact: { phone: "", email: "", street: "", houseNo: "", zip: "", city: "",
                   emergency: "", language: "Deutsch", notifyBy: "Email" },
        ids: { steuernummer: "", rentenversicherung: "", iban: "", bic: "" },
        docs: {}, note: ""
      };
      document.querySelectorAll(".emp-page [data-emp-field]").forEach(input => {
        empSetPath(draft, input.dataset.empField, empFieldValue(input));
      });
      if (!String(draft.name).trim()) { empFlash(button, empT("请先填姓名", "Bitte Namen eingeben")); return; }
      if (!String(draft.contact.email).trim()) { empFlash(button, empT("请先填邮箱", "Bitte E-Mail eingeben")); return; }
      draft.invite = { token: empToken(), state: "draft", lang: empDe() ? "de" : "zh",
                       createdAt: empNow(), reminders: [], returnNote: "", submitted: {} };
      empSaveStaff(draft);
      location.hash = `${slug("employee", "邀请详情")}?id=${encodeURIComponent(draft.id)}`;
    });
  });

  /* --- 邀请：语言 / 发送 / 催办 / 撤销 --- */
  document.querySelectorAll(".emp-invite-lang").forEach(select => {
    select.addEventListener("change", () => {
      const e = empById(select.dataset.id);
      if (!e) return;
      e.invite.lang = select.value;
      empSaveStaff(e);
      app();
    });
  });
  document.querySelectorAll(".emp-send-invite").forEach(button => {
    button.addEventListener("click", () => {
      const mailInput = document.querySelector('[data-emp-field="contact.email"]');
      const e = empById(button.dataset.id);
      if (e && mailInput) { e.contact.email = mailInput.value; empSaveStaff(e); }
      empSendInvite(button.dataset.id);
      app();
    });
  });
  document.querySelectorAll(".emp-remind-invite").forEach(button => {
    button.addEventListener("click", () => { empRemindInvite(button.dataset.id); app(); });
  });
  /* 撤销走行内确认面板，不用原生 confirm（全站零弹窗约定） */
  document.querySelectorAll(".emp-revoke-invite").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector(`.emp-revoke-confirm[data-id="${button.dataset.id}"]`)?.classList.remove("is-hidden");
    });
  });
  document.querySelectorAll(".emp-revoke-cancel").forEach(button => {
    button.addEventListener("click", () => button.closest(".emp-revoke-confirm")?.classList.add("is-hidden"));
  });
  document.querySelectorAll(".emp-revoke-yes").forEach(button => {
    button.addEventListener("click", () => {
      empRevokeInvite(button.dataset.id);
      location.hash = slug("employee", "入职邀请");
    });
  });
  document.querySelectorAll(".emp-copy-link").forEach(button => {
    button.addEventListener("click", () => {
      empCopy(location.href.split("#")[0] + button.dataset.link, button);
    });
  });

  /* --- 审核：通过 / 退回 --- */
  document.querySelectorAll(".emp-approve-btn").forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest(".emp-approve");
      const opts = {};
      card?.querySelectorAll("[data-emp-field]").forEach(input => {
        opts[input.dataset.empField.replace("approve.", "")] = empFieldValue(input);
      });
      empApproveInvite(button.dataset.id, opts);
      location.hash = `${slug("employee", "员工资料")}?id=${encodeURIComponent(button.dataset.id)}`;
    });
  });
  document.querySelectorAll(".emp-return-btn").forEach(button => {
    button.addEventListener("click", () => {
      const note = button.closest(".emp-approve")?.querySelector(".emp-return-note");
      if (!note || !note.value.trim()) {
        empFlash(button, empT("请先写退回理由", "Bitte Begründung angeben"));
        note?.focus();
        return;
      }
      empReturnInvite(button.dataset.id, note.value.trim());
      app();
    });
  });

  /* --- 员工自填页 --- */
  const onboard = document.querySelector(".emp-onboard");
  if (onboard) {
    const token = onboard.dataset.token;
    const topup = onboard.classList.contains("emp-topup");
    const readSub = () => { const e = empByToken(token); return (topup ? e?.request?.submitted : e?.invite?.submitted) || {}; };
    const writeDraft = patch => (topup ? empSaveInviteDraftTopup(token, patch) : empSaveInviteDraft(token, patch));
    const progress = () => { const e = empByToken(token); return topup ? empRequestProgress(e) : empInviteProgress(e); };
    const submit = () => (topup ? empSubmitRequest(token) : empSubmitInvite(token));
    /* 把表单当前状态收成一份 patch。每次操作都存，填一半刷新不会丢。 */
    const collect = () => {
      const patch = {};
      onboard.querySelectorAll("[data-emp-field]").forEach(input => {
        empSetPath(patch, input.dataset.empField, empFieldValue(input));
      });
      patch.docs = { ...(readSub().docs || {}) };
      onboard.querySelectorAll(".emp-doc-date").forEach(input => {
        const key = input.dataset.doc;
        if (patch.docs[key]) patch.docs[key] = { ...patch.docs[key], expiry: input.value || null };
      });
      const keep = readSub().contractFile;
      if (keep) patch.contractFile = keep;
      return patch;
    };
    /* 存完就地刷新完成度和证件卡片状态。
       不能直接 app() —— 那会重建 DOM 让输入框失焦，员工正打字打到一半。 */
    const refresh = () => {
      const e = empByToken(token);
      if (!e) return;
      const pr = progress();
      const bar = document.querySelector(".emp-onboard-progress");
      if (bar) {
        const fill = bar.querySelector(".emp-progress i");
        if (fill) fill.style.width = `${pr.total ? Math.round(pr.done / pr.total * 100) : 0}%`;
        const num = bar.querySelector("strong");
        if (num) num.textContent = `${pr.done} / ${pr.total}`;
        const hint = bar.querySelector("span:last-child");
        if (hint) hint.textContent = pr.complete
          ? empT("都填好了，可以提交了", "Vollständig — Sie können absenden")
          : empT(`还差 ${pr.missing.length} 项`, `Noch ${pr.missing.length} offen`);
      }
      /* 到期日填上了，卡片就该从「还差到期日」变绿 */
      onboard.querySelectorAll(".emp-doc-date").forEach(input => {
        const card = input.closest(".emp-doc");
        const doc = readSub().docs?.[input.dataset.doc];
        if (!card || !doc || doc.state !== "ok") return;
        const okNow = !!doc.expiry;
        card.classList.toggle("is-ok", okNow);
        card.classList.toggle("is-warn", !okNow);
        const pill = card.querySelector(".emp-doc-head .pill");
        if (pill) {
          pill.className = `pill ${okNow ? "green" : "orange"}`;
          pill.textContent = okNow ? empT("已选好", "Ausgewählt") : empT("还差到期日", "Ablauf fehlt");
        }
      });
      const warn = onboard.querySelector(".emp-approve-warn");
      if (warn) {
        warn.textContent = pr.complete ? "" : empT(
          `还差：${pr.missing.map(m => (topup ? empItemName(m) : empRaw(m.name)) + (m.kind === "expiry" || m.needExpiry ? "（到期日）" : "")).join("、")}`,
          `Es fehlen: ${pr.missing.map(m => (topup ? empItemName(m) : empRaw(m.name)) + (m.kind === "expiry" || m.needExpiry ? " (Ablaufdatum)" : "")).join(", ")}`);
        warn.classList.toggle("is-hidden", pr.complete);
      }
    };
    const save = () => { writeDraft(collect()); refresh(); };

    onboard.querySelectorAll(".emp-doc-file").forEach(input => {
      input.addEventListener("change", () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const patch = collect();
        /* 没有后端，档案里只存文件名和大小，不存内容 —— 护照照片不该躺在 localStorage 里。
           ref 指向本次会话内存里的那份，店长这会儿点得开；刷新之后只剩文件名，页面照实说。 */
        patch.docs[input.dataset.doc] = { ...(patch.docs[input.dataset.doc] || {}),
          state: "ok", file: file.name, size: file.size, ref: empFileRef(file) };
        writeDraft(patch);
        app();
      });
    });
    onboard.querySelectorAll(".emp-doc-clear").forEach(button => {
      button.addEventListener("click", () => {
        const patch = collect();
        delete patch.docs[button.dataset.doc];
        writeDraft(patch);
        app();
      });
    });
    onboard.querySelector(".emp-contract-file")?.addEventListener("change", event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const patch = collect();
      patch.contractFile = file.name;
      patch.contractRef = empFileRef(file);
      writeDraft(patch);
      app();
    });
    onboard.querySelectorAll("input:not([type=file]), select, textarea").forEach(input => {
      input.addEventListener("change", save);
    });
    onboard.querySelector(".emp-onboard-save")?.addEventListener("click", event => {
      save();
      empFlash(event.currentTarget, empT("已保存，链接随时可以再打开", "Gespeichert — Link bleibt gültig"));
    });
    onboard.querySelector(".emp-onboard-submit")?.addEventListener("click", event => {
      save();
      const pr = progress();
      if (!pr.complete) {
        empFlash(event.currentTarget, empT(`还差 ${pr.missing.length} 项`, `Noch ${pr.missing.length} offen`));
        app();
        return;
      }
      submit();
      app();
    });
  }
  /* 已提交页面上的「我还要改一下」：退回可编辑状态 */
  document.querySelectorAll(".emp-onboard-edit").forEach(button => {
    button.addEventListener("click", () => {
      const e = empByToken(button.dataset.token);
      if (!e) return;
      e.invite.state = "sent";
      empSaveStaff(e);
      app();
    });
  });
  /* 员工自填页自己的语言切换（这一页没有全站顶栏） */
  document.querySelectorAll(".emp-lang-select").forEach(select => {
    select.addEventListener("change", () => {
      try { localStorage.setItem(LANGUAGE_KEY, select.value); } catch (error) { /* 忽略 */ }
      app();
    });
  });

  /* --- 合规参数 --- */
  document.querySelectorAll(".emp-rules-save").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-rule]").forEach(input => {
        const v = Number(input.value);
        if (Number.isFinite(v)) empSetRule(input.dataset.rule, v);
      });
      document.querySelectorAll("[data-employer]").forEach(input => {
        empSetEmployer(input.dataset.store, input.dataset.employer, input.value.trim());
      });
      app();
    });
  });
  document.querySelectorAll(".emp-rules-reset").forEach(button => {
    button.addEventListener("click", () => {
      empWrite(EMP_RULES_KEY, EMP_RULES_DEFAULT.map(r => ({ id: r.id, value: r.value })));
      app();
    });
  });
}

function empFieldValue(input) {
  if (input.type === "checkbox") return input.checked;
  if (input.type === "number") {
    const v = Number(input.value);
    return Number.isFinite(v) ? v : 0;
  }
  return input.value;
}

function empSetPath(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  keys.slice(0, -1).forEach(k => {
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
}

/* 复制到剪贴板。
   之前这里写的是 try{ navigator.clipboard.writeText() }catch{} 然后无论如何都闪「已复制」——
   file:// 下 Chrome 经常直接拒绝，用户以为复制成功了，粘出来是上一次的东西。
   现在两条路都试，都失败就直说失败并把文字选中，让人自己 Ctrl+C。 */
function empCopy(text, button) {
  const done = () => empFlash(button, empT("已复制", "Kopiert"));
  const fail = () => {
    empFlash(button, empT("复制不了，请手动选中", "Bitte manuell markieren"));
    const box = button.closest(".emp-request-bar, .card")?.querySelector("textarea, .emp-link");
    if (box && box.select) { box.focus(); box.select(); }
    else if (box && window.getSelection) {
      const range = document.createRange();
      range.selectNodeContents(box);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => { if (!empCopyFallback(text)) fail(); else done(); });
      return;
    }
  } catch (error) { /* 往下走兜底 */ }
  if (empCopyFallback(text)) done(); else fail();
}

/* 老办法：塞一个临时 textarea 再 execCommand。file:// 下这条通常是能走的。 */
function empCopyFallback(text) {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:-1000px;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch (error) {
    return false;
  }
}

/* 不用 alert（全站零弹窗约定），按钮上闪一下文字 */
function empFlash(button, text) {
  const old = button.textContent;
  button.textContent = text;
  button.classList.add("is-flash");
  setTimeout(() => { button.textContent = old; button.classList.remove("is-flash"); }, 1600);
}

/* ========================================================== 全站待办接入 === */
/* 首页和待办页读 liveTodos()，证件预警从真实档案实时算，不写死。
   这些条目渲染在 .emp-page 之外，所以走全站词典翻译，中文文案要留在 deTranslations 里。 */
function empTodoItems() {
  const review = empInvites(empScope()).filter(e => e.invite.state === "submitted").map(e => ({
    type: "入职待审核",
    title: `${e.name} 已提交入职资料，等待审核`,
    module: "员工助手", store: e.store,
    due: "尽快处理", risk: "普通", status: "待审批",
    href: `#${slug("employee", "邀请详情")}?id=${encodeURIComponent(e.id)}`
  }));
  const kindText = { doc: "员工证件到期", probation: "试用期即将结束", befristet: "定期合同即将到期", profile: "员工资料缺失", newhire: "新人上工前待办" };
  /* 首页待办要控制条数，但控制方式有讲究：
     1. 同一个人同一类只出一条 —— 否则 Nico 缺五项资料就是五行。
     2. 按严重度取前四条。
     3. 试用期和定期合同到期一定补上，哪怕严重度排在后面。
        它们是有窗口的决定：错过了，解约通知期和成本完全不同，
        而「缺一份健康证」什么时候补都还来得及。 */
  const seenPair = new Set();
  const ranked = empAlerts(empScope()).filter(a => {
    if (a.level === "soon") return false;
    const key = `${a.employee.id}|${a.kind}`;
    if (seenPair.has(key)) return false;
    seenPair.add(key);
    return true;
  });
  /* 试用期、定期合同、新人上工 —— 这三类都是有窗口的事，错过窗口成本完全不同，
     所以先把它们全放进去，剩下的名额再按严重度补。
     ⚠️ 上一版是反过来写的：先 slice(0,4) 再 push 这三类，最后 slice(0,6)。
     种进第 18 个人（一个新人）之后立刻现原形 —— 补进来的试用期又被末尾那个 slice 切掉了，
     首页待办里「试用期即将结束」凭空消失。保底逻辑被截断兜底，等于没写。 */
  const MUST = ["probation", "befristet", "newhire"];
  const must = ranked.filter(a => MUST.includes(a.kind));
  const rest = ranked.filter(a => !MUST.includes(a.kind));
  const picked = [...must, ...rest].slice(0, Math.max(6, must.length));
  const docs = picked.map(a => ({
    type: a.kind === "doc" && a.level === "missing" ? "员工证件未上传" : kindText[a.kind],
    title: a.kind === "newhire"
      ? `${a.employee.name} ${a.title}${a.date ? `（${empFormatDate(a.date)} 上工）` : ""}`
      : a.level === "missing"
        ? `${a.employee.name} 的${a.title}还没有${a.kind === "profile" ? "填" : "上传"}`
        : `${a.employee.name} 的${a.title} ${a.days < 0 ? `已过期 ${-a.days} 天` : `还有 ${a.days} 天`}`,
    module: "员工助手", store: a.employee.store,
    due: a.level === "expired" ? "已逾期" : a.level === "missing" ? "尽快处理" : "本月到期",
    risk: a.kind === "profile" ? "普通" : "高风险", status: "未处理",
    href: empStaffHref(a.employee.id)
  }));
  return [...review, ...docs];
}
