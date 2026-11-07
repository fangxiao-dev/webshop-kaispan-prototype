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
const EMP_RULE_AUDIT_KEY = "kaispanEmpRuleAudit";
const EMP_DOC_WARN_RULES = ["docWarnDays", "docSoonDays", "residenceWarnDays"];

function empRuleAudit() {
  const list = empRead(EMP_RULE_AUDIT_KEY, []);
  return Array.isArray(list) ? list : [];
}

function empCanSetRule(id) {
  return empCan("ownerOnly") || (EMP_DOC_WARN_RULES.includes(id) && empCan("docWarn"));
}
const EMP_STORE_KEY = "kaispanEmpStore";
const EMP_EMPLOYER_KEY = "kaispanEmpEmployer";
const EMP_QUESTIONNAIRE_TEMPLATE_KEY = "kaispanEmpQuestionnaireTemplate";
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

function empQuestionnaireTemplate() {
  const saved = empRead(EMP_QUESTIONNAIRE_TEMPLATE_KEY, null) || {};
  return {
    bodyZh: saved.bodyZh ?? "您好，欢迎加入我们。请完成个人调查问卷，并通过入职链接提交个人资料。",
    bodyDe: saved.bodyDe ?? "Willkommen im Team. Bitte füllen Sie den Personalfragebogen aus und reichen Sie Ihre Angaben über den Einladungslink ein.",
    file: saved.file || null,
    /* 组织级默认问卷的版本引用（HR-ONB-50）：发送记录只认版本 ID，之后换默认问卷不影响已发出的那份 */
    versionId: saved.versionId || (saved.file ? "qv-legacy" : ""),
    version: Number(saved.version) || (saved.file ? 1 : 0),
    at: saved.at || "",
    history: Array.isArray(saved.history) ? saved.history.map(row => ({ ...row })) : []
  };
}

function empSaveQuestionnaireTemplate(value) {
  /* 组织级默认问卷只有老板/管理员能写；页面禁用之外，写入入口自己也要拦（HR-ACCESS-04、HR-DOC-40） */
  if (!empCan("ownerOnly")) return false;
  const prev = empRead(EMP_QUESTIONNAIRE_TEMPLATE_KEY, null) || {};
  const nextIn = value || {};
  const prevFile = prev.file || null;
  const nextFile = nextIn.file || null;
  const fileChanged = JSON.stringify(prevFile) !== JSON.stringify(nextFile);
  const prevVersion = Number(prev.version) || (prevFile ? 1 : 0);
  const version = nextFile ? (fileChanged ? prevVersion + 1 : prevVersion || 1) : 0;
  const versionId = nextFile
    ? (fileChanged || !prev.versionId ? `qv${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` : prev.versionId)
    : "";
  const history = Array.isArray(prev.history) ? prev.history.map(row => ({ ...row })) : [];
  /* 旧默认问卷保留为组织级历史版本，删除/替换都不动已发出的发送记录引用 */
  if (fileChanged && prevFile) {
    history.unshift({ file: prevFile, versionId: prev.versionId || "", version: prevVersion, at: prev.at || "", replacedAt: empNow() });
  }
  const next = {
    bodyZh: nextIn.bodyZh ?? prev.bodyZh,
    bodyDe: nextIn.bodyDe ?? prev.bodyDe,
    file: nextFile,
    versionId,
    version,
    at: fileChanged ? empNow() : (prev.at || empNow()),
    history
  };
  empMemory[EMP_QUESTIONNAIRE_TEMPLATE_KEY] = next;
  try {
    localStorage.setItem(EMP_QUESTIONNAIRE_TEMPLATE_KEY, JSON.stringify(next));
    return true;
  } catch (error) {
    return false;
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
function empFileLink(d, hideName) {
  if (!d || !d.file) return "";
  if (hideName) return `<span class="emp-file is-hidden-name">${empT("已上传（文件名已隐藏）", "Hochgeladen (Dateiname ausgeblendet)")}</span>`;
  const url = d.dataUrl || empFileUrl(d.ref);
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

function empMonthDayLabel(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = String(dateStr).split("-");
  if (!m || !d) return empEsc(dateStr);
  return empDe() ? `${Number(d)}.${Number(m)}.` : `${Number(m)} 月 ${Number(d)} 日`;
}

/* ------------------------------------------------------------ 当前上下文 --- */
/* 按 D5：员工助手只做老板/店长视角，不分角色。 */
function empStores() {
  const base = typeof stores !== "undefined" ? stores : ["Martin Biergarten"];
  const extra = typeof hrExtraUnitNames === "function" ? hrExtraUnitNames() : [];
  return [...base, ...extra.filter(name => !base.includes(name))];
}

function empUnitLabel(name) {
  return typeof hrUnitLabel === "function" ? hrUnitLabel(name) : String(name || "");
}

/* ============================================================ 主数据定义 === */

/* 合同类型。hours 是「月度规定工时区间」，排班和工时校验都读它。
   limit 指向 empRules() 里的哪条合规参数。 */
const EMP_CONTRACT_TYPES = [
  { id: "werkstudent", name: { zh: "学生工", de: "Werkstudent" }, limit: "werkstudentWeeklyMax" },
  { id: "teilzeit", name: { zh: "兼职", de: "Teilzeit" }, limit: null },
  { id: "minijob", name: { zh: "Minijob", de: "Minijob" }, limit: "minijobMonthlyMax" },
  { id: "vollzeit", name: { zh: "全职", de: "Vollzeit" }, limit: null },
  { id: "praktikum", name: { zh: "实习", de: "Praktikum" }, limit: null }
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

const EMP_CUSTOM_ROLES_KEY = "kaispanEmpCustomRoles";

/* 岗位默认五个，老板可以自己加（HR-CONTRACT-05 ★4.x）。
   岗位只是名册标签，不联动任何系统权限；新增项只存名字，不做权限映射。 */
function empCustomRoles() {
  const saved = empRead(EMP_CUSTOM_ROLES_KEY, []);
  return Array.isArray(saved) ? saved.filter(r => r && r.id && r.name?.zh) : [];
}

function empRoles() {
  return [...EMP_ROLES, ...empCustomRoles()];
}

function empRole(id) {
  return empRoles().find(r => r.id === id) || EMP_ROLES[1];
}

function empAddRole(name, employeeId) {
  /* 新增岗位是老板/管理员动作；岗位本身仍只是名册标签（HR-CONTRACT-05、HR-ACCESS-15） */
  if (!empCan("ownerOnly")) return { ok: false, reason: "permission", message: empDenyReason("ownerOnly") };
  const zh = String(name || "").trim();
  if (!zh) return { ok: false, reason: "empty" };
  const exists = empRoles().find(r => empRaw(r.name) === zh || r.name?.zh === zh);
  if (exists) return { ok: false, reason: "exists", role: exists };
  const role = { id: `custom_${Date.now().toString(36)}`, name: { zh, de: zh }, custom: true };
  empWrite(EMP_CUSTOM_ROLES_KEY, [...empCustomRoles(), role]);
  if (employeeId) {
    const e = empById(employeeId);
    if (e) {
      const next = JSON.parse(JSON.stringify(e));
      next.role = role.id;
      empSaveWithHistory(next, empActorLabel());
    }
  }
  return { ok: true, role };
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
  /* 已录离职但最后工作日还没过：按 HR-LIFE-02/18 仍算在岗，名册上标离开日期 */
  { id: "leaving", name: { zh: "已提离职", de: "Austritt gemeldet" }, tone: "orange", leaving: false },
  /* 审核已通过但入职日在将来：待入职，不计入在岗人数（HR-LIFE-02） */
  { id: "pending", name: { zh: "待入职", de: "Eintritt ausstehend" }, tone: "blue", leaving: true },
  { id: "invited", name: { zh: "邀请中", de: "Eingeladen" }, tone: "blue", leaving: true },
  { id: "left", name: { zh: "离职", de: "Ausgeschieden" }, tone: "red", leaving: true }
];

function empStatus(id) {
  return EMP_STATUS.find(s => s.id === id) || EMP_STATUS[0];
}

/* ================================================== 与 hr-model / viewpoint 的桥 ===
   hr-model.js 与 viewpoint.js 在页面里先加载；测试里有时只加载 employee.js，
   所以这里统一做一次薄包装，缺依赖时用同一套默认值，避免规则散成两份。 */
function empCan(action) {
  return typeof hrCan === "function" ? hrCan(action) : true;
}

function empDenyReason(action) {
  return typeof hrDenyReason === "function" ? hrDenyReason(action) : "";
}

function empActorLabel() {
  return typeof hrActorLabel === "function" ? hrActorLabel() : "老板";
}

/* 门店范围（HR-ACCESS-01、HR-ACCESS-55）：老板看全部门店；店长只处理顶栏当前门店。
   店长视角没有单独的“所属门店”状态，所以直接把 empScope() 当作范围；无法判断时（没有门店上下文）
   不放宽也不误拦，按原流程继续。写入入口要自己调用，不能只靠按钮置灰。 */
function empIsOwnerView() {
  return typeof hrIsOwner === "function" ? hrIsOwner() : true;
}

function empStoreInScope(e) {
  if (empIsOwnerView()) return true;
  const scope = typeof empScope === "function" ? empScope() : null;
  if (!scope) return true;
  return !!e && e.store === scope;
}

function empStoreScopeError(e) {
  if (empStoreInScope(e)) return null;
  const scope = typeof empScope === "function" ? empScope() : "";
  return { ok: false, code: "store_scope",
    message: empT(`这个人不在当前门店范围（${scope || "—"}）内，店长只能处理本店员工（HR-ACCESS-01）。`,
      `Diese Person liegt außerhalb der aktuellen Filiale (${scope || "—"}); Filialleitungen bearbeiten nur eigene Mitarbeitende (HR-ACCESS-01).`) };
}

function empNationalityClass(e) {
  if (typeof hrNationalityClass === "function") return hrNationalityClass(e);
  const c = e?.contract || {};
  if (c.nationalityClass === "eu" || c.nationalityClass === "other") return c.nationalityClass;
  if (typeof c.nonEU === "boolean") return c.nonEU ? "other" : "eu";
  return "";
}

function empSetNationality(e, value) {
  if (typeof hrSetNationalityClass === "function") return hrSetNationalityClass(e, value);
  e.contract = e.contract || {};
  e.contract.nationalityClass = value === "eu" || value === "other" ? value : "";
  e.contract.nonEU = e.contract.nationalityClass === "other";
}

function empStudentValue(e) {
  if (typeof hrIsStudent === "function") return hrIsStudent(e);
  const c = e?.contract || {};
  return c.type === "werkstudent" || c.isStudent === true;
}

/* 员工还没回答「是否学生」时，材料清单显示待确认，而不是默认按“不是学生”算 */
function empStudentAnswered(e) {
  const c = e?.contract || {};
  return c.type === "werkstudent" || typeof c.isStudent === "boolean";
}

function empZusatzValue(e) {
  if (typeof hrZusatzCheck === "function") return hrZusatzCheck(e);
  const c = e?.contract || {};
  if (c.zusatzCheck === "yes" || c.zusatzCheck === "no") return c.zusatzCheck;
  if (c.zusatzCheck === "") return "";
  return c.hasZusatz === true ? "yes" : "";
}

function empSetZusatz(e, value) {
  if (typeof hrSetZusatzCheck === "function") return hrSetZusatzCheck(e, value);
  e.contract = e.contract || {};
  e.contract.zusatzCheck = value === "yes" || value === "no" ? value : "";
  e.contract.hasZusatz = e.contract.zusatzCheck === "yes";
}

function empAccountStateLabel(state) {
  if (typeof HR_ACCOUNT_STATES !== "undefined" && HR_ACCOUNT_STATES[state]) return HR_ACCOUNT_STATES[state];
  return ({
    none: "未邀请", invited: "已邀请待接受", accepted: "已接受，绑定中", pending_link: "待确认关联",
    active: "已激活", disabled: "已停用", expired: "邀请已过期", revoked: "已撤销", send_failed: "发送失败"
  })[state] || "未邀请";
}

const EMP_ACCOUNT_TONES = {
  none: "gray", invited: "blue", accepted: "orange", pending_link: "orange",
  active: "green", disabled: "gray", expired: "red", revoked: "gray", send_failed: "red"
};

function empUploadError(file, imageOnly) {
  if (typeof hrUploadError === "function") return hrUploadError(file, imageOnly);
  if (!file) return "";
  const okType = imageOnly ? /^image\/(png|jpeg)$/i.test(file.type) : /^(application\/pdf|image\/(png|jpeg))$/i.test(file.type);
  if (!okType) return imageOnly ? "只收 PNG 或 JPEG 照片" : "只收 PDF、PNG 或 JPEG";
  if (file.size > 20 * 1024 * 1024) return "文件超过 20 MB";
  return "";
}

/* 员工资料与 Lark「Mitarbeiterlist」附件字段对应。expiry:true 的证件进入到期预警。
   need 决定这份证件对谁是必需的：all / nonEU / student。
   layer 是入职必填分层（HR-DOC-09、HR-ONB-26～29）：submit 提交时必须有 /
   beforeStart 第一个上班日前必须有 / later 可以之后补。 */
const EMP_DOC_TYPES = [
  { id: "id", name: { zh: "护照 / 身份证", de: "Reisepass / Personalausweis" }, expiry: true, need: "all", layer: "submit" },
  { id: "residence", name: { zh: "居留许可", de: "Aufenthaltstitel" },
    expiry: true, need: "nonEU", layer: "submit" },
  { id: "zusatz", name: { zh: "附加页（Zusatzblatt）", de: "Zusatzblatt" }, expiry: true, need: "nonEU", layer: "submit" },
  { id: "student", name: { zh: "在读证明", de: "Immatrikulationsbescheinigung" }, expiry: true, need: "student", layer: "submit" },
  { id: "kv", name: { zh: "原医保卡文件（保留）", de: "Bisherige Krankenversicherungskarte" }, expiry: false, need: "legacy" },
  { id: "healthFront", name: { zh: "医保卡正面照片", de: "Krankenkarte Vorderseite" }, expiry: false, need: "all", layer: "later", imageOnly: true },
  { id: "healthBack", name: { zh: "医保卡反面照片", de: "Krankenkarte Rückseite" }, expiry: false, need: "all", layer: "later", imageOnly: true },
  { id: "bankFront", name: { zh: "银行卡照片（正面）", de: "Bankkarte Vorderseite" }, expiry: false, need: "all", layer: "submit", imageOnly: true },
  /* 银行卡只收正面（HR-DOC-09 ★5.4）；反面不再单独收取，旧档案里的文件仍可查看 */
  { id: "bankBack", name: { zh: "银行卡反面照片（不再单独收取）", de: "Bankkarte Rückseite (nicht mehr erhoben)" }, expiry: false, need: "legacy" },
  { id: "belehrung", name: { zh: "食品卫生指导证明（健康证；Belehrung nach §43 IfSG）", de: "Lebensmittelbelehrung nach §43 IfSG" }, expiry: true, need: "all", layer: "beforeStart" },
  /* 第 8 类，后加的。原来合同在系统里无处安放：员工在自填页传的那份存进
     invite.submitted.contractFile 之后就断了 —— 审核通过不合并进档案，也没有任何页面查得到，
     上传等于扔掉。现在它是一份正经证件：能归档、进证件矩阵、缺了进预警、新人清单据此自动判定。
     self:"optional" 是说自填页不把它算进「你还差几项」——
     很多人上工时合同还没双方签好，卡在这一项他整张表都提交不了。 */
  { id: "contract", name: { zh: "劳动合同（Vertrag）", de: "Arbeitsvertrag (Vertrag)" },
    expiry: false, need: "all", self: "optional" },
  { id: "personalquestionnaire", name: { zh: "个人资料问卷（Personalfragebogen）", de: "Personalfragebogen" },
    expiry: false, need: "all" }
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
  { id: "minijobMonthlyMax", value: 603, unit: { zh: "€/月", de: "€/Monat" },
    name: { zh: "Minijob 月薪上限", de: "Minijob Monatsgrenze" },
    note: { zh: "2026 年参考值为每月平均 603 欧元；个别月份超过不一定立即改变身份，需结合年度预计收入及例外情况核对。已保存的参数不会自动覆盖。",
            de: "Bei Überschreitung entfällt der Minijob-Status. Jährlich prüfen." } },
  { id: "werkstudentWeeklyMax", value: 20, unit: { zh: "h/周", de: "h/Woche" },
    name: { zh: "Werkstudent 每周工时上限", de: "Werkstudent Wochenstunden" },
    note: { zh: "20 小时为学期内常用核对线；假期、夜间和周末等情况可能有例外，应结合就业情况及医保机构判断。",
            de: "Überschreitung während der Vorlesungszeit gefährdet den Studentenstatus." } },
  { id: "dailyHoursMax", value: 10, unit: { zh: "h/日", de: "h/Tag" },
    name: { zh: "单日工时上限", de: "Tägliche Höchstarbeitszeit" },
    note: { zh: "一般以每工作日 8 小时为基础；延长至 10 小时需满足法定平均工时补偿条件。这里是排班预警值。", de: "Grenze nach ArbZG." } },
  { id: "restBetweenShifts", value: 11, unit: "h",
    name: { zh: "两班之间最短间隔", de: "Mindestruhezeit zwischen Schichten" },
    note: { zh: "餐饮业在符合条件时可缩短至 10 小时，须在规定期限内以至少 12 小时的休息时间补偿；不能只下调数值而忽略补偿。", de: "Branchenausnahmen im Gastgewerbe möglich." } },
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
  { id: "residenceWarnDays", value: 60, unit: { zh: "天", de: "Tage" },
    name: { zh: "居留许可到期预警提前期", de: "Vorwarnzeit Aufenthaltstitel" },
    note: { zh: "居留许可比其他证件提前到 60 天进待办（HR-DOC-23、HR-CONTRACT-41）；31–90 天仍只在证件总览里提示。",
            de: "Aufenthaltstitel erscheinen ab 60 Tagen in der Aufgabenliste; 31–90 Tage nur in der Übersicht." } },
  { id: "healthRetrainYears", value: 2, unit: { zh: "年", de: "Jahre" },
    name: { zh: "健康证复训周期", de: "Zyklus der Hygieneschulung" },
    note: { zh: "下次复训日 = 最近一次复训日 + 这个周期（HR-CONTRACT-42）。只提醒复训到期，不把首次指导证明标成过期。",
            de: "Nächste Schulung = letzte Schulung + dieser Zyklus. Erinnerung nur an die Schulung, nicht an ein Ablaufdatum der Erstbelehrung." } },
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
    note: { zh: "自动排班不会越过这条线，手排少于这个数会红字提醒。这是排班偏好，并非单独的通用法定结论；餐饮业周日工作及补休日等规则需结合实际排班核对。",
            de: "Die automatische Planung hält diese Grenze ein; manuell darunter erscheint eine Warnung. Sieben Tage am Stück sind unzulässig und werden blockiert. Gesetzlich ist mindestens ein Ruhetag pro Woche vorgesehen (grundsätzlich der Sonntag); zwei Tage ergeben sich meist aus Vertrag oder Tarif." } },
  { id: "azkMaxHours", value: 40, unit: "h",
    name: { zh: "Arbeitszeitkonto 余额上限", de: "Obergrenze Arbeitszeitkonto" },
    note: { zh: "作为提醒参考，上限由合同或相关协议约定；老板已答复：工时账户允许为负数（员工可以欠工时），负数只显示，不阻断；账户调整仍由负责人决定。",
            de: "Maximaler Saldo des Zeitkontos. Ist es voll, müssen Mehrstunden ausgezahlt oder der Dienstplan geändert werden. Die Höhe ergibt sich aus Vertrag oder Tarif." } },
  { id: "punchGraceMin", value: 5, unit: { zh: "分钟", de: "Minuten" },
    name: { zh: "打卡宽限", de: "Toleranz bei der Zeiterfassung" },
    note: { zh: "比班表早到晚走多少分钟之内都算准时。设成 0 会把「早两分钟走」也变成一条要处理的异常，店长每天都在点确认，真正的问题反而淹了。",
            de: "Innerhalb dieser Toleranz gilt die Erfassung als pünktlich. Bei 0 wird jede Kleinigkeit zur Abweichung und die echten Fälle gehen unter." } },
  { id: "punchRadiusM", value: 150, unit: { zh: "米", de: "Meter" },
    name: { zh: "打卡允许范围", de: "Zulässiger Erfassungsradius" },
    note: { zh: "超出这个距离就打不了卡，被拦下的尝试会记下来进待处理，员工可以请你补签。手机定位在城里本来就有几十米误差，室内更差 —— 设得太小会把真在店里的人挡在门外，然后你每天都在补签。门店没设坐标或者手机没给定位时不拦，那是「判不了」不是「太远」。",
            de: "Darüber hinaus ist keine Erfassung möglich; abgewiesene Versuche werden protokolliert und der Mitarbeiter kann um Nacherfassung bitten. Handy-Ortung ist in der Stadt zweistellig ungenau, innen schlechter — zu kleine Werte sperren Anwesende aus und erzeugen tägliche Nacherfassungen. Ohne Filialstandort oder Geräteortung wird nicht gesperrt." } },
  { id: "auAfterDays", value: 1, unit: { zh: "天", de: "Tage" },
    name: { zh: "病假第几天起要 AU", de: "AU ab Krankheitstag" },
    note: { zh: "连续病假到这个天数就要医生证明（Arbeitsunfähigkeitsbescheinigung）。老板已答复：第一天就要（默认 1）；法定是第 4 个日历日起，要改回去按合同填。",
            de: "Ab dieser Dauer ist eine Arbeitsunfähigkeitsbescheinigung nötig. Gesetzlich ab dem vierten Kalendertag, per Vertrag oft früher." } },
  { id: "lohnfortzahlungWeeks", value: 6, unit: { zh: "周", de: "Wochen" },
    name: { zh: "病假照付工资的周数", de: "Dauer der Lohnfortzahlung" },
    note: { zh: "一般情况下同一疾病的雇主继续支付期限最多为 6 周；具体资格、复发及后续待遇须由税务师或医保机构核对。",
            de: "Innerhalb dieser Frist zahlt der Arbeitgeber weiter, danach übernimmt die Krankenkasse Krankengeld. Gesetzlich sechs Wochen." } },
  { id: "payslipToleranceEuro", value: 0, unit: "€",
    name: { zh: "工资单对账容差", de: "Toleranz beim Abgleich der Abrechnung" },
    note: { zh: "税务师算出来的 Brutto 跟我们封账时估的差多少以内算正常。老板已答复：税前工资要完全一样（默认 0）；休假工资按 13 周平均算、社保档位变化可能造成几欧的差，那时再改这里。",
            de: "Bis zu diesem Betrag gilt die Abweichung zwischen eigener Schätzung und Abrechnung als normal. Darüber wird markiert und muss korrigiert oder begründet werden." } },
  { id: "lateRoundingMinutes", value: 15, unit: { zh: "分钟", de: "Minuten" }, name: { zh: "迟到计薪取整", de: "Rundung bei Verspätung" }, note: { zh: "迟到后按打卡时间向上取整。", de: "Bei Verspätung aufrunden." } },
  { id: "recordRetentionYears", value: 10, unit: { zh: "年", de: "Jahre" },
    name: { zh: "离职后档案保留年限", de: "Aufbewahrungsfrist nach Austritt" },
    note: { zh: "离职不等于删档。保留期限按税务和劳动法要求配置，到期前档案一直可查。",
            de: "Austritt heisst nicht Löschung. Frist nach steuer- und arbeitsrechtlichen Vorgaben setzen." } },
  /* 五类资料分别设年限（HR-DATA-01/07、HR-LIFE-42）；recordRetentionYears 保留为旧存档兜底。 */
  { id: "recordRetentionContractYears", value: 10, unit: { zh: "年", de: "Jahre" },
    name: { zh: "合同与问卷保存年限", de: "Aufbewahrung: Vertrag und Fragebogen" },
    note: { zh: "税务师给数字前占位 10 年；到期只提醒老板确认，不自动删除。", de: "Platzhalter 10 Jahre bis zur Steuerberatung; keine automatische Löschung." } },
  { id: "recordRetentionPayrollYears", value: 10, unit: { zh: "年", de: "Jahre" },
    name: { zh: "工资相关资料保存年限", de: "Aufbewahrung: Lohnunterlagen" },
    note: { zh: "一期没有工资数据，为三期预留；税务师给数字前占位 10 年。", de: "In Phase 1 keine Lohndaten; Platzhalter 10 Jahre." } },
  { id: "recordRetentionDocumentsYears", value: 10, unit: { zh: "年", de: "Jahre" },
    name: { zh: "证件保存年限", de: "Aufbewahrung: Ausweisdokumente" },
    note: { zh: "护照/身份证、居留许可、附加页、在读证明、银行卡与医保卡照片。", de: "Ausweis, Aufenthaltstitel, Zusatzblatt, Immatrikulation, Kartenfotos." } },
  { id: "recordRetentionHealthYears", value: 10, unit: { zh: "年", de: "Jahre" },
    name: { zh: "健康证保存年限", de: "Aufbewahrung: Belehrung" },
    note: { zh: "健康证文件与最近复训日；到期只提醒，不改变首次证明已有的事实。", de: "Belehrungsdatei und letzte Schulung; nur Erinnerung." } },
  { id: "recordRetentionOtherYears", value: 10, unit: { zh: "年", de: "Jahre" },
    name: { zh: "其他资料保存年限", de: "Aufbewahrung: Sonstiges" },
    note: { zh: "档案、个人数据、入职记录、暂缺、更新请求、变更记录、离职记录等。", de: "Akte, Stammdaten, Onboarding, Befreiungen, Änderungen, Austritt." } },
  { id: "defaultHourlyWage", value: "", unit: { zh: "€/小时", de: "€/Stunde" },
    name: { zh: "默认时薪", de: "Standard-Stundenlohn" },
    note: { zh: "留空表示新建档案不预填时薪；填写后按这个值预填，可逐人修改（HR-CONTRACT-11/39）。", de: "Leer = keine Vorbelegung. Sonst Vorbelegung für neue Akten, je Person änderbar." } },
  { id: "probationMaxMonths", value: 6, unit: { zh: "个月", de: "Monate" }, fixed: true,
    name: { zh: "法定最长试用期", de: "Gesetzliche Höchstdauer Probezeit" },
    note: { zh: "固定 6 个月，只读；这是法定上限，不是可改的业务参数（HR-LIFE-07/08）。", de: "Fest 6 Monate, nur lesen; gesetzliche Obergrenze (HR-LIFE-07/08)." } },
  { id: "internshipNoticeMonths", value: 3, unit: { zh: "个月", de: "Monate" },
    name: { zh: "实习超过几个月提示", de: "Praktikum-Hinweis ab Monaten" },
    note: { zh: "实习超过这个月数时显示黄色提示；这是参考值，以合同和税务师意见为准（HR-CONTRACT-15/24）。", de: "Gelber Hinweis ab dieser Dauer; Referenzwert, keine Rechtsberatung." } },
  { id: "sofortmeldungRemindDays", value: 3, unit: { zh: "天", de: "Tage" },
    name: { zh: "即时申报提前提醒", de: "Sofortmeldung: Erinnerung vorab" },
    note: { zh: "上班前这个天数起进待办；上班当天仍未记“已申报”即标逾期（HR-ONB-40/43）。", de: "Ab dieser Frist vor Arbeitsbeginn in der Aufgabenliste; am ersten Tag ohne Meldung überfällig." } },
  /* 入职停滞提醒（HR-ONB-47）：四个天数各自独立，默认都是 3 天，老板可在合规设置里改。
     参数键名与合规设置页（第 4 批）约定：inviteSubmitStallDays / inviteReturnStallDays /
     contractSignStallDays / inviteReviewStallDays。 */
  { id: "inviteSubmitStallDays", value: 3, unit: { zh: "天", de: "Tage" },
    name: { zh: "邀请发出后几天未提交算停滞", de: "Einladung ohne Abgabe" },
    note: { zh: "邀请发出超过这个天数、员工还没提交，进待办提醒店长（HR-ONB-47）。条件消失后待办自动关闭。",
            de: "Nach dieser Frist ohne Abgabe erscheint die Einladung als hängend (HR-ONB-47)." } },
  { id: "inviteReturnStallDays", value: 3, unit: { zh: "天", de: "Tage" },
    name: { zh: "退回后几天未重新提交算停滞", de: "Rückgabe ohne erneute Abgabe" },
    note: { zh: "资料被退回后超过这个天数、员工还没重新提交，进待办（HR-ONB-47）。",
            de: "Nach dieser Frist ohne erneute Abgabe erscheint die Rückgabe als hängend (HR-ONB-47)." } },
  { id: "contractSignStallDays", value: 3, unit: { zh: "天", de: "Tage" },
    name: { zh: "合同发出后几天未签回算停滞", de: "Vertrag ohne Unterschrift" },
    note: { zh: "合同与问卷发出后超过这个天数、员工还没签回，进待办（HR-ONB-47）。",
            de: "Nach dieser Frist ohne Rücklauf erscheint der Versand als hängend (HR-ONB-47)." } },
  { id: "inviteReviewStallDays", value: 3, unit: { zh: "天", de: "Tage" },
    name: { zh: "员工提交后几天未审核算停滞", de: "Abgabe ohne Prüfung" },
    note: { zh: "员工提交后超过这个天数、店长还没审核，进待办（HR-ONB-47）。",
            de: "Nach dieser Frist ohne Prüfung erscheint die Abgabe als hängend (HR-ONB-47)." } }
];

/* 参数范围与“能否设为 0”（HR-CONTRACT-19/20/40）。
   fixed 的参数只读；allowBlank 表示允许留空（默认时薪）。 */
const EMP_RULE_LIMITS = {
  docWarnDays: { min: 1, max: 365 },
  docSoonDays: { min: 1, max: 365 },
  residenceWarnDays: { min: 1, max: 365 },
  healthRetrainYears: { min: 1, max: 5 },
  probationWarnDays: { min: 1, max: 90 },
  probationMonths: { min: 1, max: 6 },
  probationNoticeWeeks: { min: 1, max: 8 },
  probationMaxMonths: { min: 6, max: 6, fixed: true },
  recordRetentionYears: { min: 1, max: 30 },
  recordRetentionContractYears: { min: 1, max: 30 },
  recordRetentionPayrollYears: { min: 1, max: 30 },
  recordRetentionDocumentsYears: { min: 1, max: 30 },
  recordRetentionHealthYears: { min: 1, max: 30 },
  recordRetentionOtherYears: { min: 1, max: 30 },
  defaultHourlyWage: { min: 0.01, max: 200, allowBlank: true },
  internshipNoticeMonths: { min: 1, max: 12 },
  sofortmeldungRemindDays: { min: 1, max: 14 },
  minijobMonthlyMax: { min: 1, max: 2000 },
  werkstudentWeeklyMax: { min: 1, max: 48 },
  dailyHoursMax: { min: 1, max: 12 },
  restBetweenShifts: { min: 9, max: 24 },
  lohnfortzahlungWeeks: { min: 1, max: 52 },
  payslipToleranceEuro: { min: 0, max: 1000, allowZero: true },
  lateRoundingMinutes: { allowed: [15, 30, 60] },
  inviteSubmitStallDays: { min: 1, max: 30 },
  inviteReturnStallDays: { min: 1, max: 30 },
  contractSignStallDays: { min: 1, max: 30 },
  inviteReviewStallDays: { min: 1, max: 30 },
  breakAfter6h: { min: 0, max: 120, allowZero: true },
  breakAfter9h: { min: 0, max: 120, allowZero: true },
  weeklyDaysOffMin: { min: 0, max: 7, allowZero: true },
  azkMaxHours: { min: 0, max: 400, allowZero: true },
  punchGraceMin: { min: 0, max: 30, allowZero: true },
  punchRadiusM: { min: 0, max: 2000, allowZero: true },
  auAfterDays: { min: 0, max: 14, allowZero: true }
};

function empRuleLimit(id) {
  return EMP_RULE_LIMITS[id] || null;
}

function empRuleRangeText(r) {
  const limit = empRuleLimit(r.id);
  if (!limit) return "";
  if (limit.fixed) return empT(`固定 ${limit.max}，只读`, `Fest ${limit.max}, nur lesen`);
  if (Array.isArray(limit.allowed)) return empT(`可选 ${limit.allowed.join(" / ")}`, `Zulässig: ${limit.allowed.join(" / ")}`);
  const zero = limit.allowZero ? empT("，可设为 0", ", 0 erlaubt") : "";
  const blank = limit.allowBlank ? empT("，可留空", ", leer erlaubt") : "";
  return empT(`范围 ${limit.min}–${limit.max}${zero}${blank}`, `Bereich ${limit.min}–${limit.max}${zero}${blank}`);
}

function empRuleZeroHint(r) {
  const limit = empRuleLimit(r.id);
  if (!limit?.allowZero) return "";
  return {
    breakAfter6h: empT("0 = 该档不扣休息", "0 = keine Pause in dieser Stufe"),
    breakAfter9h: empT("0 = 该档不扣休息", "0 = keine Pause in dieser Stufe"),
    weeklyDaysOffMin: empT("0 = 不检查最少休息天数", "0 = keine Prüfung der Ruhetage"),
    azkMaxHours: empT("0 = 工时账户不可存入", "0 = kein Guthaben möglich"),
    punchGraceMin: empT("0 = 任何偏差都判异常", "0 = jede Abweichung zählt"),
    punchRadiusM: empT("0 = 不限制打卡范围", "0 = kein Radius"),
    auAfterDays: empT("0 = 从第 1 天起要证明", "0 = ab dem ersten Tag")
  }[r.id] || "";
}

/* 空值判断和范围校验分开：默认时薪允许空；其余参数按上下限。 */
function empRuleInputValid(id, raw) {
  const limit = empRuleLimit(id);
  const text = String(raw == null ? "" : raw).trim();
  if (limit?.allowBlank && text === "") return { ok: true, value: "" };
  const value = Number(text);
  if (!Number.isFinite(value)) return { ok: false, message: empT("请填数字", "Bitte eine Zahl eingeben") };
  if (limit) {
    if (limit.fixed) return { ok: false, message: empT("这一项是固定值，不能修改", "Dieser Wert ist fest") };
    if (Array.isArray(limit.allowed) && !limit.allowed.includes(value)) {
      return { ok: false, message: empT(`只能选 ${limit.allowed.join(" / ")}`, `Nur ${limit.allowed.join(" / ")} zulässig`) };
    }
    if (!limit.allowZero && value === 0) return { ok: false, message: empT("这一项不能设为 0", "Dieser Wert darf nicht 0 sein") };
    if (value < limit.min || value > limit.max) {
      return { ok: false, message: empT(`范围 ${limit.min}–${limit.max}`, `Bereich ${limit.min}–${limit.max}`) };
    }
  }
  return { ok: true, value };
}

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

/* 参数之间的固定关系（HR-CONTRACT-19/20/40）。页面保存和直接 setter 共用这一处，
   否则页面拦住、脚本调用还能写进互相矛盾的组合。 */
function empRuleRelationError(ruleMap) {
  const num = id => Number(ruleMap.has(id) ? ruleMap.get(id) : empRule(id));
  if ((ruleMap.has("docSoonDays") || ruleMap.has("docWarnDays")) && num("docSoonDays") <= num("docWarnDays")) {
    return empT("关注期天数必须大于提醒天数", "Beobachtungszeit muss größer als die Vorwarnzeit sein");
  }
  if ((ruleMap.has("residenceWarnDays") || ruleMap.has("docSoonDays")) && num("residenceWarnDays") >= num("docSoonDays")) {
    return empT("居留许可预警期必须小于关注期", "Aufenthaltstitel-Vorwarnzeit muss kleiner als die Beobachtungszeit sein");
  }
  return "";
}

function empSetRule(id, value) {
  if (!empCanSetRule(id)) return empRules();
  const limit = empRuleLimit(id);
  if (!empRules().some(r => r.id === id)) return empRules();
  /* 固定值、允许的枚举、上下限和参数关联都在这里统一执行（HR-CONTRACT-19/20/40） */
  if (limit?.fixed) return empRules();
  const checked = empRuleInputValid(id, value);
  if (!checked.ok) return empRules();
  if (empRuleRelationError(new Map([[id, checked.value]]))) return empRules();
  const before = empRules().find(r => r.id === id)?.value;
  const next = empRules().map(r => (r.id === id ? { ...r, value: checked.value } : r));
  empWrite(EMP_RULES_KEY, next.map(r => ({ id: r.id, value: r.value })));
  if (String(before) !== String(checked.value)) {
    empWrite(EMP_RULE_AUDIT_KEY, [{ at: empNow(), by: empActorLabel(), id, from: before, to: checked.value }, ...empRuleAudit()].slice(0, 200));
  }
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
  empStores().forEach(store => {
    const cafe = /cafe/i.test(store);
    seed[store] = {
      legalName: cafe ? "Martin Cafe GmbH" : "Martin Gastro GmbH",
      betriebsnummer: "",
      address: cafe ? "Kaiserstrasse 8, 44135 Dortmund" : "Hauptstrasse 12, 44135 Dortmund"
    };
  });
  return seed;
}

function empEmployer(store) {
  return empEmployerAll()[store] || {};
}

function empSetEmployer(store, id, value) {
  if (!empCan("ownerOnly")) return empEmployerAll();
  /* Betriebsnummer 是劳动局的 8 位号，写错即时申报和社保申报都报不上去（HR-ORG-13、HR-ONB-41） */
  if (id === "betriebsnummer") {
    const text = String(value == null ? "" : value).trim();
    if (text && !/^\d{8}$/.test(text)) return empEmployerAll();
    value = text;
  }
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

    /* 发出去 8 天，已超过 7 天有效期：列表应显示“已过期”，详情可一键重发。 */
    mk("e19", "Lena", "Martin Cafe", "front", "basic", "invited", "",
      C("teilzeit", "hourly", 13.1, 60, 80, 18),
      { email: "lena@example.com", phone: "", docs: D({}) }),

    /* 审核刚通过、还没上工的新人。加这一位是因为审查发现：
       新人清单在演示数据里一个都看不见，必须自己完整走一遍入职流程才出现 ——
       等于这个功能对着数据打不开。他也是唯一一个合同还没归档的人。 */
    mk("e18", "Marco", "Martin Biergarten", "front", "basic", "probation", empShiftDate(t, 3),
      C("teilzeit", "hourly", 13.2, 60, 80, 18),
      { email: "marco@example.com", phone: "+49 176 707070",
        street: "Lindenstrasse", houseNo: "5", zip: "44137", city: "Dortmund",
        krankenkasse: "AOK", steuernummer: "314/158/64010", rv: "12 123456 M 010",
        iban: "DE25 3704 0044 0808 0808 08", bic: "COBADEFFXXX",
        probationEnd: empProbationDefaultEndAt(empShiftDate(t, 3), 6),
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
    e.invite = { portalVersion: 2, onboardingFilesVersion: 1, token: empToken(), lang: "zh",
                 createdAt: ago(12), reminders: [], returnNote: "", returnItems: [], submitted: {},
                 fillMode: "self", sendResult: "sent", sendResultAt: ago(12), resendLog: [],
                 state: "approved", sentAt: ago(12), firstSentAt: ago(12),
                 expiresAt: `${empShiftDate(today, -5)}T10:00:00`,
                 submittedAt: ago(9), reviewedAt: ago(8), approvedAt: ago(8) };
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
  const employeeNos = {
    e01: "1001", e02: "1002", e03: "1003", e04: "1004", e05: "2001",
    e06: "2002", e07: "1005", e08: "1006", e09: "1007", e10: "1008",
    e11: "1009", e12: "2003", e13: "2004", e14: "2005", e18: "1010"
  };
  if (birthdays[e.id]) e.birthday = birthdays[e.id];
  if (kassen[e.id]) e.contact.krankenkasse = kassen[e.id];
  if (employeeNos[e.id]) e.employeeNo = employeeNos[e.id];
  /* 迁移进系统的老员工允许“仅记录、无文件”；新入职的人每一项都必须有文件（HR-DOC-19） */
  e.migrated = e.status !== "invited" && e.id !== "e18";

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
  /* 给一个人留一份已被替换的证件版本，演示“历史版本”入口（HR-DOC-21） */
  if (e.id === "e03") {
    e.documentArchive = [{
      docId: "id", state: "replaced", file: "personalausweis_alt.jpg", ref: "demo",
      expiry: empShiftDate(today, -120), version: 1,
      archivedAt: `${empShiftDate(today, -100)}T09:00:00.000Z`, replacedBy: "店长"
    }];
  }
  /* 员工账号状态（HR-ACCESS-26/53）。不再有初始密码：
     · 在岗老员工：已激活
     · Tom（店长本人）：待确认关联，用来演示“关联已有账号”
     · Marco / 三个邀请中的人：已邀请待接受
     · 张三：离职后停用
     没填邮箱的 Nico 留一个“未邀请”的样子。
     e01 保留一个旧 pass，只给旧 #me 演示入口登录用，HR 页面不显示。 */
  if (e.id === "e14") {
    e.account = { state: "disabled", user: e.contact.email, email: e.contact.email, store: e.store };
  } else if (e.status === "invited" && e.contact.email) {
    /* 邀请已发还没动静 = 已邀请待接受；已经交过资料 = 已接受、绑定中 */
    e.account = { state: e.invite?.state === "sent" ? "invited" : "accepted", user: e.contact.email, email: e.contact.email, store: e.store,
                  invitedAt: `${empShiftDate(today, -4)}T09:00:00.000Z`, lastSentAt: `${empShiftDate(today, -4)}T09:00:00.000Z`, sentCount: 1 };
  } else if (e.id === "e18" && e.contact.email) {
    e.account = { state: "accepted", user: e.contact.email, email: e.contact.email, store: e.store,
                  invitedAt: `${empShiftDate(today, -8)}T10:00:00.000Z`, lastSentAt: `${empShiftDate(today, -8)}T10:00:00.000Z`, sentCount: 1 };
  } else if (e.id === "e05" && e.contact.email) {
    e.account = { state: "pending_link", user: "tom@example.com", email: "tom@example.com", store: e.store,
                  candidate: { name: "Tom Weber", email: "tom@example.com", role: "店长" },
                  requestedAt: `${empShiftDate(today, -1)}T15:00:00.000Z`, requestedBy: "老板" };
  } else if (!empStatus(e.status).leaving && e.contact.email) {
    e.account = { state: "active", user: e.contact.email, email: e.contact.email, store: e.store,
                  createdAt: `${empShiftDate(today, -200)}T10:00:00.000Z` };
    if (e.id === "e01") e.account.pass = "kaispan123";   /* 仅旧 #me 演示入口 */
  }
  return e;
}

/* 三个演示邀请，卡在三个不同的状态上 ——
   邀请列表如果只有一种状态，看不出这是个流程。 */
function empSeedInvite(e, today) {
  if (e.status !== "invited") return e;
  const ago = (days, hour) => new Date(`${empShiftDate(today, -days)}T${hour}:00:00`).toISOString();
  const base = {
    portalVersion: 2, onboardingFilesVersion: 1, token: empToken(), lang: "zh",
    createdAt: ago(4, "09"), reminders: [], returnNote: "", returnItems: [], submitted: {},
    fillMode: "self", sendResult: "sent", sendResultAt: ago(4, "09"), resendLog: []
  };
  if (e.id === "e15") {
    /* 发出去 4 天没动静，催过一次 */
    e.invite = { ...base, state: "sent", sentAt: ago(4, "09"), firstSentAt: ago(4, "09"),
      expiresAt: `${empShiftDate(today, 3)}T09:00:00`,
      reminders: [{ at: ago(1, "10"), kind: "remind" }] };
  }
  if (e.id === "e16") {
    /* 全填完了，等店长审核 —— 这条是「卡在审核」的样子 */
    e.invite = { ...base, state: "submitted", sentAt: ago(3, "11"), firstSentAt: ago(3, "11"),
      expiresAt: `${empShiftDate(today, 4)}T11:00:00`, submittedAt: ago(1, "20"),
      submitted: {
        name: "Yuki", birthday: "1997-05-19",
        contact: { phone: "+49 176 505050", street: "Kaiserstrasse", houseNo: "8", zip: "44135", city: "Dortmund",
                   emergency: "Chloe · +49 171 909090", language: "中文 / Deutsch", notifyBy: "WhatsApp" },
        ids: { steuernummer: "314/158/63001", rentenversicherung: "12 123456 Y 001",
               iban: "DE27 3704 0044 0616 1616 16", bic: "COBADEFFXXX" },
        docs: { id: { state: "ok", file: "reisepass.pdf" },
                residence: { state: "ok", expiry: empShiftDate(today, 640), file: "aufenthaltstitel.jpg" },
                zusatz: { state: "ok", file: "zusatzblatt.pdf" },
                kv: { state: "ok", file: "krankenkasse.jpg" },
                bank: { state: "ok", file: "bankkarte.jpg" },
                bankFront: { state: "ok", file: "bankkarte.jpg" },
                healthFront: { state: "ok", file: "krankenkasse.jpg" },
                belehrung: { state: "ok", expiry: empShiftDate(today, 700), file: "belehrung.pdf" } },
        contract: { nationalityClass: "other", isStudent: false, urlaubDays: 14, noticePeriod: "4 Wochen zum Monatsende" },
        contractNote: "合同上写的年假是 14 天，跟这里的 12 天不一样，麻烦确认一下。",
        contractFile: "arbeitsvertrag_yuki.pdf"
      } };
  }
  if (e.id === "e17") {
    /* 交了但店长退回了 */
    e.invite = { ...base, state: "returned", sentAt: ago(6, "09"), firstSentAt: ago(6, "09"),
      expiresAt: `${empShiftDate(today, 1)}T09:00:00`, submittedAt: ago(3, "18"),
      reviewedAt: ago(2, "09"), returnNote: "健康证 Belehrung 拍得看不清到期日，麻烦重拍一张。",
      returnItems: ["hygiene"],
      submitted: {
        name: "Ben", birthday: "1995-11-11",
        contact: { phone: "+49 170 616161", street: "Bergstrasse", houseNo: "22", zip: "44139", city: "Dortmund",
                   emergency: "", language: "Deutsch", notifyBy: "Email" },
        ids: { steuernummer: "314/158/63002", rentenversicherung: "12 123456 B 002",
               iban: "DE58 3704 0044 0717 1717 17", bic: "COBADEFFXXX" },
        contract: { nationalityClass: "eu", isStudent: false },
        docs: { id: { state: "ok", file: "personalausweis.jpg" },
                kv: { state: "ok", file: "kk.jpg" },
                bank: { state: "ok", file: "iban.pdf" },
                bankFront: { state: "ok", file: "iban.pdf" },
                belehrung: { state: "ok", expiry: null, file: "belehrung_unscharf.jpg" } }
      } };
  }
  if (e.id === "e19") {
    e.invite = { ...base, createdAt: ago(9, "09"), state: "sent", sentAt: ago(8, "09"), firstSentAt: ago(8, "09"),
      expiresAt: `${empShiftDate(today, -1)}T09:00:00`, reminders: [], resendLog: [] };
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
      if (empNormalizeAccount(e)) changed = true;
      /* 合同条件到生效日才切换：读档案时把 e.contract 拉回“今天有效”的版本 */
      if (empSyncEffectiveContract(e, empToday())) changed = true;
      /* 旧存档没有 migrated 字段：按“升级前就在册的人”处理，避免把老员工的
         “仅记录、无文件”误判成新员工缺文件 */
      if (e.migrated === undefined) { e.migrated = e.status !== "invited"; changed = true; }
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
  return empAllStaff().filter(e => !empStatusHidden(e) && !empStatus(e.status).leaving && (!store || e.store === store));
}

/* 含离职和邀请中，档案页用 */
function empRoster(store) {
  return empAllStaff().filter(e => !store || e.store === store);
}

/* 证件提醒/总览/矩阵的范围：在岗 + 待入职（审核通过、入职日在将来）。
   待入职的人证件也可能先过期，漏掉就会在入职当天才发现（HR-LIFE-02、HR-ONB-22）。 */
function empDocRoster(store) {
  return empAllStaff().filter(e => !empStatusHidden(e) && (!store || e.store === store)
    && (e.status === "pending" || !empStatus(e.status).leaving));
}

/* 已撤销 / 已取消入职默认从名册隐藏（HR-LIFE-02）；需要看记录时去「入职邀请」。 */
function empStatusHidden(e) {
  const inv = e?.invite?.state;
  return inv === "revoked" || inv === "cancelled" || e?.status === "revoked" || e?.status === "cancelled";
}

function empRosterVisible(store) {
  return empRoster(store).filter(e => !empStatusHidden(e));
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
  /* 国籍未回答时不出材料清单，也不按欧盟/其他国籍计算（HR-DOC-02/36） */
  if (!empNationalityClass(employee)) return false;
  if (type.id === "zusatz" && (empNationalityClass(employee) !== "other" || empZusatzValue(employee) !== "yes")) return false;
  if (type.need === "all") return true;
  if (type.need === "student") return empStudentValue(employee);
  if (type.need === "nonEU") return empNationalityClass(employee) === "other";
  return false;
}

/* 材料叫法以 HR-DOC-01 / HR_DOC_LABELS 为准；没有专门条目的沿用类型名。 */
function empDocName(type) {
  const key = type.id === "id" ? "passport" : type.id === "residence" ? "visa" : "";
  const zh = (key && typeof HR_DOC_LABELS !== "undefined" && HR_DOC_LABELS[key]) || type.name.zh;
  return { zh, de: type.name.de };
}

function empDocLabel(type) {
  return empRaw(empDocName(type));
}

/* 健康证：首次指导证明（一次性，有/无 + 文件）和最近一次复训日分开存。
   旧数据只有一个 expiry，读取时换算成“最近复训日 = expiry − 复训周期”，
   这样演示数据里的复训日期不会因为升级而整体跳档（HR-DOC-31/35）。 */
function empHealthRetrainYears() {
  const value = Number(empRule("healthRetrainYears"));
  return [1, 2, 3, 4, 5].includes(value) ? value : 2;
}

function empHealth(e) {
  const saved = e?.health || {};
  const doc = e?.docs?.belehrung || {};
  const legacyExpiry = doc.expiry && empValidExpiry(doc.expiry) ? doc.expiry : "";
  const lastRetrain = saved.lastRetrain
    || (legacyExpiry ? empAddMonths(legacyExpiry, -12 * empHealthRetrainYears()) : "");
  const firstProof = saved.firstProof === "yes" || saved.firstProof === "no"
    ? saved.firstProof
    : (doc.state === "ok" || !!doc.file ? "yes" : "");
  return { firstProof, lastRetrain };
}

/* 答复 B31/B40：证件过期只提示、不阻断。唯一例外——没有健康证首次证明的人不能排接触食品的班。
   二期排班读这个标记；原型只在名册和健康证卡片上显示，不挡任何一期操作。 */
function empFoodShiftBlocked(e) {
  if (!e || e.status === "left" || e.status === "invited") return false;
  return empHealth(e).firstProof !== "yes";
}

function empNextRetrain(e) {
  const { lastRetrain } = empHealth(e);
  return lastRetrain ? empAddMonths(lastRetrain, 12 * empHealthRetrainYears()) : "";
}

function empDocState(employee, typeId, today) {
  const type = empDocType(typeId);
  const doc = employee.docs?.[typeId];
  if (!empDocNeeded(employee, type)) return { level: "na", days: null };
  if (type.id === "belehrung") {
    const health = empHealth(employee);
    if (health.firstProof !== "yes") return { level: "missing", days: null };
    /* 新员工每项材料必须有文件；只有迁移老员工允许“仅记录”（HR-DOC-19） */
    if (!doc?.file && employee.migrated !== true) return { level: "missing", days: null };
    const next = empNextRetrain(employee);
    if (!next) return { level: "ok", days: null };
    const days = empDaysBetween(today || empToday(), next);
    const warnDays = empRule("docWarnDays");
    if (days < 0) return { level: "expired", days };
    if (days <= warnDays) return { level: "warn", days };
    if (days <= empRule("docSoonDays")) return { level: "soon", days };
    return { level: "ok", days };
  }
  if (!doc || doc.state === "missing") return { level: "missing", days: null };
  /* 新员工每项材料必须有文件；只有迁移老员工允许“仅记录”（HR-DOC-19/25） */
  if (!doc.file && employee.migrated !== true) return { level: "missing", days: null };
  if (!type.expiry) return { level: "ok", days: null };
  if (!empValidExpiry(doc.expiry)) return { level: "date_missing", days: null };
  const days = empDaysBetween(today || empToday(), doc.expiry);
  if (days < 0) return { level: "expired", days };
  /* 居留许可的预警期单独 60 天（HR-DOC-23 / HR-CONTRACT-41） */
  const warnDays = type.id === "residence" ? empRule("residenceWarnDays") : empRule("docWarnDays");
  if (days <= warnDays) return { level: "warn", days };
  if (days <= empRule("docSoonDays")) return { level: "soon", days };
  return { level: "ok", days };
}

const EMP_DOC_LEVELS = {
  date_missing: { tone: "orange", rank: 2, name: { zh: "有效期待补充", de: "Gültigkeit fehlt" } },
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
  empDocRoster(store).forEach(employee => {
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
  { path: "ids.steuerId", name: { zh: "Steuer-ID（个人税务识别号）", de: "Steuer-ID" }, why: { zh: "工资申报必填", de: "Für die Lohnabrechnung nötig" } },
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
  /* 离职和邀请中的不进提醒；待入职（审核通过、入职日在将来）只查证件，不套试用期/新人清单（HR-LIFE-02、HR-ONB-22） */
  const pendingEntry = e.status === "pending";
  if (empStatus(e.status).leaving && !pendingEntry) return out;

  EMP_DOC_TYPES.forEach(type => {
    const st = empDocState(e, type.id, day);
    if (st.level === "ok" || st.level === "na") return;
    /* 关注期（31–90 天）只在证件总览/矩阵提示，不进待办（HR-DOC-24） */
    if (st.level === "soon") return;
    out.push({ kind: "doc", employee: e, type, level: st.level, days: st.days,
               title: empDocLabel(type), date: type.id === "belehrung" ? empNextRetrain(e) : (e.docs?.[type.id]?.expiry || null) });
  });

  if (!pendingEntry && e.status === "probation" && e.probationEnd && !e.leave) {
    const end = empProbationEndEffective(e) || e.probationEnd;
    const days = empDaysBetween(day, end);
    /* 试用期只有「到了提醒窗口」和「还早」两种，不套证件那个 90 天关注档 ——
       提前三个月提醒转正没有意义，到了窗口才要做决定。 */
    const level = empLevelByDays(days, empRule("probationWarnDays"), empRule("probationWarnDays"));
    if (level !== "ok") out.push({ kind: "probation", employee: e, level, days,
      title: empRaw({ zh: "试用期结束", de: "Ende der Probezeit" }), date: end });
  }

  if (!pendingEntry && e.contract?.befristetUntil && !e.leave) {
    const days = empDaysBetween(day, e.contract.befristetUntil);
    const level = empLevelByDays(days);
    if (level !== "ok") out.push({ kind: "befristet", employee: e, level, days,
      title: empRaw({ zh: "定期合同到期", de: "Befristung endet" }), date: e.contract.befristetUntil });
  }

  if (!pendingEntry) EMP_KEY_FIELDS.forEach(f => {
    const v = empGetPath(e, f.path);
    if (v == null || String(v).trim() === "") out.push({ kind: "profile", employee: e, level: "missing",
      days: null, title: empRaw(f.name), why: empRaw(f.why), path: f.path });
  });

  /* 新人清单：上工日之前没办完就该催，过了上工日还没办就是逾期 */
  if (!pendingEntry && empIsNewHire(e)) {
    const open = empNewHireOpen(e);
    const days = e.entryDate ? empDaysBetween(day, e.entryDate) : 0;
    /* 入职当天仍未办完（即时申报等）就算逾期，不再只标“提醒”（HR-ONB-39/40） */
    out.push({ kind: "newhire", employee: e, level: days <= 0 ? "expired" : "warn", days: days,
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
  /* 与 empDocAlerts 同一范围：在岗 + 待入职，待入职只在 empAlertsFor 里出证件项 */
  empDocRoster(store).forEach(e => out.push(...empAlertsFor(e, day)));
  return out.sort((a, b) => {
    const r = EMP_DOC_LEVELS[a.level].rank - EMP_DOC_LEVELS[b.level].rank;
    if (r) return r;
    if (a.days == null) return 1;
    if (b.days == null) return -1;
    return a.days - b.days;
  });
}

/* 一期 20 类事项（HR-TODO-20～39）。首页和档案列表只显示标题「姓名：类别」，
   证件号、日期、金额和缺项明细都留在档案里（HR-TODO-05）。 */
const EMP_TODO_CODES = {
  doc: { code: "20", name: { zh: "证件需要处理", de: "Dokument prüfen" } },
  profile: { code: "21", name: { zh: "关键资料缺失", de: "Pflichtangaben fehlen" } },
  review: { code: "22", name: { zh: "入职资料待审核", de: "Onboarding prüfen" } },
  returned: { code: "23", name: { zh: "入职资料已退回", de: "Onboarding zurückgegeben" } },
  contract: { code: "24", name: { zh: "待发合同", de: "Vertrag senden" } },
  sign: { code: "25", name: { zh: "待员工签回合同", de: "Unterschrift ausstehend" } },
  archive: { code: "26", name: { zh: "待核对归档合同", de: "Vertrag ablegen" } },
  newhire: { code: "27", name: { zh: "新人上工前清单", de: "Vor Arbeitsbeginn" } },
  topup: { code: "28", name: { zh: "补件待员工处理", de: "Nachreichung offen" } },
  reviewUpdate: { code: "29", name: { zh: "补件 / 资料更新待核对", de: "Nachreichung prüfen" } },
  specialPending: { code: "30", name: { zh: "特殊审批待批（材料没交齐）", de: "Sonderfreigabe offen (Unterlagen fehlen)" } },
  stalled: { code: "32", name: { zh: "入职流程停滞", de: "Onboarding hängt" } },
  probation: { code: "33", name: { zh: "试用期即将结束", de: "Probezeit endet" } },
  befristet: { code: "34", name: { zh: "定期合同即将到期", de: "Befristung endet" } },
  manualAccount: { code: "36", name: { zh: "请手工处理该账号", de: "Konto manuell bearbeiten" } },
  linkConfirm: { code: "37", name: { zh: "请确认员工档案关联", de: "Kontoverknüpfung bestätigen" } },
  retention: { code: "38", name: { zh: "保存期到期，请确认清理", de: "Aufbewahrungsfrist erreicht" } },
  managerChange: { code: "39", name: { zh: "请确认店长提交的变更", de: "Änderung bestätigen" } }
};

function empTodoEntry(e, key, level, extra = {}) {
  const meta = EMP_TODO_CODES[key];
  return { employee: e, key, code: meta?.code || "", typeName: meta?.name || { zh: key, de: key }, level, days: null, ...extra };
}

/* 管理端能看到、需要店长或老板处理的事情。员工端的 23/25/28 不放在这里。 */
function empWorkflowEntries(e, today) {
  const day = today || empToday();
  const out = [];
  const inv = e.invite;
  if (inv) {
    if (inv.state === "submitted") out.push(empTodoEntry(e, "review", "warn", { mgrOnly: true, since: inv.submittedAt }));
    if (inv.state === "approved" && !inv.contractSentAt && !empContractArchived(e) && inv.fillMode !== "veteran") {
      out.push(empTodoEntry(e, "contract", "warn"));
    }
    if (inv.contractSignedSubmittedAt && !empContractArchived(e)) out.push(empTodoEntry(e, "archive", "warn", { mgrOnly: true, since: inv.contractSignedSubmittedAt }));
    const stall = empInviteStall(e, day);
    if (stall) {
      const reviewStall = stall.kind === "inviteReviewStallDays";
      out.push(empTodoEntry(e, "stalled", "warn", reviewStall ? { mgrOnly: true, since: inv.submittedAt } : { employeeOnly: true, label: stall.label }));
    }
  }
  if (e.employeePortal?.supplementSubmission?.status === "submitted" || e.request?.state === "submitted") {
    out.push(empTodoEntry(e, "reviewUpdate", "warn", { mgrOnly: true, since: e.employeePortal?.supplementSubmission?.at || e.request?.submittedAt || "" }));
  }
  if (empSpecialNeeded(e)) out.push(empTodoEntry(e, "specialPending", "warn"));
  if (e.account?.state === "pending_link" || e.accountLinkRequest?.state === "pending") {
    out.push(empTodoEntry(e, "linkConfirm", "warn", { employeeOnly: true }));
  }
  if (e.account?.manualRequired || e.account?.state === "manual_required") {
    out.push(empTodoEntry(e, "manualAccount", "expired"));
  }
  if (e.retentionHandled?.at === undefined) {
    const due = empRetentionRows(e).find(r => r.until && r.until <= day && !empRetentionHandledFor(e, r.id));
    if (due) out.push(empTodoEntry(e, "retention", "warn"));
  }
  if (e.contractProposal?.state === "pending" || e.leaveProposal?.state === "pending") {
    out.push(empTodoEntry(e, "managerChange", "warn"));
  }
  return out;
}

/* 答复 ANS-3：周一至周五算工作日，不扣法定假日。since 当天不算，之后每个工作日算 1 天。 */
function empWorkdaysElapsed(since, today) {
  const start = String(since || "").slice(0, 10);
  if (!empValidExpiry(start)) return 0;
  let count = 0;
  for (let day = empShiftDate(start, 1); day <= today; day = empShiftDate(day, 1)) {
    const weekday = new Date(`${day}T12:00:00`).getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

const EMP_ESCALATE_WORKDAYS = 2;
const EMP_ESCALATE_NOTE = { zh: "店长 2 个工作日未处理", de: "Filialleitung seit 2 Arbeitstagen untätig" };

/* 答复 ANS-3：发给店长的人事待办，老板视角里默认不出现；店长超过 2 个工作日没处理，
   老板待办里出现同一条并标明“店长 2 个工作日未处理”，不发邮件。 */
function empApplyEscalation(entries, day) {
  return entries.filter(item => {
    if (!item.mgrOnly) return true;
    if (typeof hrIsOwner !== "function" || !hrIsOwner()) return true;
    if (empWorkdaysElapsed(item.since, day) > EMP_ESCALATE_WORKDAYS) {
      item.escalated = true;
      return true;
    }
    return false;
  });
}

/* 答复 H04-C1：只能由员工本人办的事（待签回合同、补交退回、资料待提交、待确认绑定）显示为状态，不计入待处理人数。 */
function empEmployeeSideEntries(e, today) {
  const day = today || empToday();
  if (empStatusHidden(e)) return [];
  const out = [];
  const inv = e.invite;
  if (inv) {
    if (inv.state === "sent") out.push({ key: "waitSubmit", label: { zh: "等员工提交资料", de: "Wartet auf Abgabe" } });
    if (inv.state === "returned") out.push({ key: "waitResubmit", label: { zh: "已退回，等员工补交", de: "Zurückgegeben, Mitarbeiter ergänzt" } });
    if (inv.state === "approved" && inv.contractSentAt && !inv.contractSignedSubmittedAt) out.push({ key: "waitSign", label: { zh: "等员工签回合同", de: "Wartet auf Unterschrift" } });
  }
  if (e.account?.state === "pending_link" || e.accountLinkRequest?.state === "pending") out.push({ key: "waitLink", label: { zh: "待员工确认账号绑定", de: "Wartet auf Kontobestätigung" } });
  return out;
}

/* 名单页每行「待处理」列和首页数人共用这一份清单，避免两处口径不一样。
   只含老板/店长能办的事项（H04-C1）；员工本人要办的见 empEmployeeSideEntries。 */
function empPendingEntries(e, today) {
  const day = today || empToday();
  if (empStatusHidden(e)) return [];
  const out = [];
  /* 保存期到期是离职之后才出现的待办，不能因为 status=left 就整行清空 */
  if (e.status !== "left") empAlertsFor(e, day).forEach(a => {
    const key = a.kind === "doc" ? "doc" : a.kind === "profile" ? "profile" : a.kind === "newhire" ? "newhire"
      : a.kind === "probation" ? "probation" : a.kind === "befristet" ? "befristet" : "doc";
    out.push(empTodoEntry(e, key, a.level, { alert: a, days: a.days, detail: a }));
  });
  out.push(...empApplyEscalation(empWorkflowEntries(e, day).filter(x => !x.employeeOnly), day));
  const byKey = new Map();
  out.forEach(item => {
    const prev = byKey.get(item.key);
    if (!prev || EMP_DOC_LEVELS[item.level].rank < EMP_DOC_LEVELS[prev.level].rank) byKey.set(item.key, item);
  });
  return [...byKey.values()].sort((a, b) => {
    const r = EMP_DOC_LEVELS[a.level].rank - EMP_DOC_LEVELS[b.level].rank;
    if (r) return r;
    return a.code.localeCompare(b.code);
  });
}

/* 31–90 天的关注期只在总览和首页「提前知道」里出现，不进待办、不通知员工（HR-DOC-24）。 */
function empSoonEntries(store, today) {
  const day = today || empToday();
  const seen = new Set();
  return empDocAlerts(store, day)
    .filter(a => a.level === "soon")
    .filter(a => {
      if (seen.has(a.employee.id)) return false;
      seen.add(a.employee.id);
      return true;
    })
    .map(a => empTodoEntry(a.employee, "doc", "soon", { alert: a, days: a.days, soon: true }));
}

function empPendingPeople(store, today) {
  const day = today || empToday();
  /* 离职后的保存期到期和合同提案也是待办，不能因为 status=left 就从首页人数里消失；
     首页和档案列表「需要处理」共用这一份口径（HR-TODO-41/50/51）。 */
  return empRosterVisible(store).filter(e => empPendingEntries(e, day).length);
}

function empSoonPeople(store, today) {
  return empSoonEntries(store, today);
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
    note: { zh: "上工前 3 天起进待办提醒，上班当天仍未记录“已申报”即标逾期。系统只提供数据，不代为申报；是否适用、由谁报，跟税务师确认。",
            de: "Ab 3 Tagen vor Arbeitsbeginn in der Aufgabenliste; am ersten Arbeitstag ohne Meldung gilt es als überfällig. Das System liefert nur die Daten." },
    auto: e => !!(e.sofortmeldung && e.sofortmeldung.at),
    panel: e => empSofortPanel(e) },
  { id: "contract",
    name: { zh: "劳动合同与问卷已签字归档", de: "Arbeitsvertrag und Fragebogen unterschrieben abgelegt" },
    note: { zh: "以入职状态“已归档”判定，不以“文件存在”判定；合同与问卷两份都核对通过（或线下签署归档）才打勾。",
            de: "Gilt erst bei Status „abgelegt“; beide Dateien geprüft (oder offline abgelegt)." },
    auto: e => empContractArchived(e),
    panel: e => `<div class="emp-newhire-file ${empContractArchived(e) ? "is-done" : ""}">
      <span>${empContractArchived(e)
        ? empT("合同与问卷已归档。", "Vertrag und Fragebogen sind abgelegt.")
        : empT("还没归档：到“合同”页签上传两份发出件、发送，员工签回后逐份核对。", "Noch nicht abgelegt: im Reiter „Vertrag“ senden und prüfen.")}</span>
      <a class="ghost-btn" href="${empStaffHref(e.id)}&tab=contract">${empT("去合同页签", "Zum Vertrag")} →</a></div>` },
  { id: "belehrung",
    name: { zh: "健康证 Belehrung 有效", de: "Belehrung §43 IfSG gültig" },
    note: { zh: "以“已有首次指导证明”判定；复训到期由证件提醒单独处理，不重复占这张清单。", de: "Gilt bei vorhandener Erstbelehrung; die Schulungsfrist wird separat überwacht." },
    auto: e => empHealth(e).firstProof === "yes",
    fix: e => ({ href: `${empStaffHref(e.id)}&tab=docs`, name: { zh: "去证件页填到期日", de: "Ablaufdatum eintragen" } }) },
  { id: "access",
    name: { zh: "钥匙 / 工牌 / 打卡方式交代清楚", de: "Schlüssel, Ausweis und Zeiterfassung übergeben" },
    note: { zh: "这一件只发生在店里，系统看不见，手动勾。", de: "Passiert nur im Betrieb — manuell abhaken." } }
];

/* ------------------------------------------------ 即时申报要交的那张数据单 ---
   原来第一项只有一段话和一个勾。店长看完那段话还是不知道该干什么 ——
   一个勾不叫闭环，叫备忘录。真正缺的是「要报哪些数据、我手上齐不齐、怎么交出去」。
   下面这张单子把公司侧（合规设置里填的）和员工侧（档案里的）拼到一起，
   缺的标红并给一条直达链接，凑齐了能一键复制给税务师，报完记一笔时间。 */
function empSofortRows(e, noSv) {
  const emp = empEmployer(e.store);
  const rules = { href: `#${slug("employee", "合规设置")}`, name: { zh: "去合规设置填", de: "In den Einstellungen ergänzen" } };
  const prof = { href: `${empStaffHref(e.id)}&tab=profile`, name: { zh: "去档案里补", de: "In der Akte ergänzen" } };
  const c = e.contact || {};
  const line1 = [c.street, c.houseNo].filter(Boolean).join(" ");
  const line2 = [c.zip, c.city].filter(Boolean).join(" ");
  const addr = line1 && line2 ? `${line1}, ${line2}` : (line1 || line2 || "");
  /* 法定名称不能拿招牌名兜底；缺失就要在数据单上标出来（HR-ONB-41） */
  const legal = emp.legalName && emp.legalName !== e.store ? emp.legalName : "";
  const alt = e.sofortmeldung?.alt || {};
  /* 答复 B58：数据单“齐全”只看姓名、生日、地址（required）；其余项照列但可以后补（later），不挡“已报”，也不算缺项 */
  const rows = [
    { name: { zh: "公司法定名称", de: "Firmenname" }, value: legal, fix: rules, later: true },
    { name: { zh: "Betriebsnummer", de: "Betriebsnummer" }, value: emp.betriebsnummer, fix: rules, later: true,
      valid: /^\d{8}$/.test(String(emp.betriebsnummer || "").trim()) },
    { name: { zh: "经营地址", de: "Betriebsstätte" }, value: emp.address, fix: rules, later: true },
    { name: { zh: "员工姓名", de: "Name des Mitarbeiters" }, value: e.name, fix: prof, required: true },
    { name: { zh: "出生日期", de: "Geburtsdatum" }, value: e.birthday ? empFormatDate(e.birthday) : "", fix: prof, required: true },
    { name: { zh: "Rentenversicherung Nr.", de: "Rentenversicherung Nr." }, value: noSv ? empT("无社保号，已由税务师处理", "Keine SV-Nr., durch Steuerberatung geklärt") : e.ids?.rentenversicherung, fix: prof, later: true },
    { name: { zh: "住址", de: "Anschrift" }, value: addr, fix: prof, required: true },
    { name: { zh: "上工日期", de: "Beginn der Beschäftigung" }, value: e.entryDate ? empFormatDate(e.entryDate) : "", fix: prof, later: true }
  ];
  if (noSv) {
    [
      ["birthPlace", { zh: "出生地（税务师要求的替代资料）", de: "Geburtsort (Ersatzangabe)" }],
      ["nationality", { zh: "国籍", de: "Staatsangehörigkeit" }],
      ["gender", { zh: "性别", de: "Geschlecht" }]
    ].forEach(([key, name]) => rows.push({ name, value: alt[key] || "", fix: prof, optional: true }));
  }
  return rows.map(r => ({ ...r, ok: r.optional || ((r.value != null && String(r.value).trim() !== "") && r.valid !== false) }));
}

function empSofortText(e) {
  return empSofortRows(e, !!e.sofortmeldung?.noSv)
    .map(r => `${empRaw(r.name)}: ${r.ok ? r.value : empRaw(r.required ? { zh: "【缺】", de: "[fehlt]" } : { zh: "【后补】", de: "[später]" })}`)
    .join("\n");
}

function empSofortPanel(e) {
  const noSv = !!e.sofortmeldung?.noSv;
  const rows = empSofortRows(e, noSv);
  const gaps = rows.filter(r => r.required && !r.ok);
  const later = rows.filter(r => !r.required && !r.optional && !r.ok);
  const done = !!(e.sofortmeldung && e.sofortmeldung.at);
  const sofort = empSofortState(e);
  if (done) return `<div class="emp-sofort is-done">
    <span>${empT(`已在 ${empStamp(e.sofortmeldung.at)} 由 ${e.sofortmeldung.by || "—"} 记为申报完成。`, `Am ${empStamp(e.sofortmeldung.at)} durch ${e.sofortmeldung.by || "—"} als gemeldet vermerkt.`)}</span>
    ${noSv ? `<span class="small">${empT("按“无社保号，已由税务师处理”记录。", "Als „keine SV-Nr., Steuerberatung“ erfasst.")}</span>` : ""}
    <button class="ghost-btn danger-lite emp-sofort-undo" data-id="${empEsc(e.id)}">${empT("记错了，撤销", "Rückgängig")}</button>
  </div>`;
  return `<div class="emp-sofort">
    <div class="emp-sofort-head">
      <strong>${empT("要报上去的数据", "Zu meldende Daten")}</strong>
     
      ${empPill(sofort.tone, empT(sofort.label, sofort.labelDe))}
      ${gaps.length
        ? empPill("red", empT(`还缺 ${gaps.length} 项`, `${gaps.length} fehlen`))
        : empPill("green", empT("齐了", "Vollständig"))}
      ${later.length ? empPill("gray", empT(`${later.length} 项可后补`, `${later.length} später`)) : ""}
    </div>
    <table class="table emp-table emp-sofort-table"><tbody>
      ${rows.map(r => `<tr class="${r.ok ? "" : r.required ? "is-missing" : "is-later"}">
        <td>${empText(r.name)}${r.required ? ` <small>${empT("必须有", "Pflicht")}</small>` : ""}</td>
        <td>${r.ok ? empEsc(r.value) : `<span class="emp-miss">${r.required ? empT("缺", "fehlt") : empT("可后补", "später")}</span> <a href="${r.fix.href}">${empText(r.fix.name)}</a>`}</td>
      </tr>`).join("")}
    </tbody></table>
    <label class="emp-check emp-sofort-nosv"><input type="checkbox" class="emp-sofort-nosv-box" data-id="${empEsc(e.id)}"${noSv ? " checked" : ""}>
      ${empT("员工还没有社保号，已由税务师处理（需税务师确认）", "Keine SV-Nr. — durch Steuerberatung geklärt (bestätigen lassen)")}</label>
    ${noSv ? `<div class="form-grid emp-sofort-alt">
      <label class="field"><span>${empT("出生地", "Geburtsort")}</span><input class="emp-sofort-alt-input" data-field="birthPlace" value="${empEsc(e.sofortmeldung?.alt?.birthPlace || "")}"></label>
      <label class="field"><span>${empT("国籍", "Staatsangehörigkeit")}</span><input class="emp-sofort-alt-input" data-field="nationality" value="${empEsc(e.sofortmeldung?.alt?.nationality || "")}"></label>
      <label class="field"><span>${empT("性别", "Geschlecht")}</span><input class="emp-sofort-alt-input" data-field="gender" value="${empEsc(e.sofortmeldung?.alt?.gender || "")}"></label>
    </div><p class="small">${empT("替代资料以税务师给的清单为准；这里只做登记。", "Ersatzangaben nach Liste der Steuerberatung; nur Erfassung.")}</p>` : ""}
    ${!empEmployer(e.store)?.legalName || !String(empEmployer(e.store)?.address || "").trim()
      ? `<p class="small">${empT("公司法定名称或经营地址还没填：不挡申报，可以后补。", "Firmenname oder Betriebsstätte fehlt: kein Hindernis, später ergänzen.")} <a href="#${slug("employee", "合规设置")}">${empT("去合规设置", "Zu Einstellungen")}</a></p>` : ""}
    <p class="small">${empT("即时申报原则上只需要姓名、生日和注册地址，其余可后补（答复 B58，覆盖 HR-ONB-41）。", "Für die Sofortmeldung genügen grundsätzlich Name, Geburtsdatum und Anschrift; Weiteres kann nachgereicht werden (B58).")}</p>
    <div class="emp-sofort-actions">
      <button class="ghost-btn emp-sofort-copy" data-id="${empEsc(e.id)}">${empT("复制这些数据", "Daten kopieren")}</button>
      <button class="ghost-btn emp-sofort-done" data-id="${empEsc(e.id)}"${gaps.length ? " disabled" : ""}>${empT("已经报上去了", "Wurde gemeldet")}</button>
      <span class="small">${gaps.length
        ? empT("缺的补齐了才能记为已申报。", "Erst nach Vervollständigung als gemeldet markierbar.")
        : empT("复制给税务师或自己在 sv.net 报，报完点右边这个记一笔。", "An die Steuerberatung schicken oder selbst über sv.net melden, danach hier vermerken.")}</span>
    </div>
  </div>`;
}

/* 即时申报的提醒窗口：上班前 N 天起提醒，上班当天未记录即逾期（HR-ONB-40 ★6.7）。 */
function empSofortState(e, today) {
  const day = today || empToday();
  const done = !!e?.sofortmeldung?.at;
  if (!e?.entryDate) return { tone: "gray", label: "未定入职日", labelDe: "Kein Eintritt", overdue: false };
  if (done) return { tone: "green", label: "已申报", labelDe: "Gemeldet", overdue: false };
  const remindDays = Number(empRule("sofortmeldungRemindDays")) || 3;
  const from = empShiftDate(e.entryDate, -remindDays);
  if (day >= e.entryDate) return { tone: "red", label: "已逾期，尽快申报", labelDe: "Überfällig", overdue: true };
  if (day >= from) return { tone: "orange", label: `应申报（${empFormatDate(e.entryDate)} 上班）`, labelDe: "Jetzt melden", overdue: false, from };
  return { tone: "gray", label: `${empFormatDate(from)} 起提醒`, labelDe: `Erinnerung ab ${empFormatDate(from)}`, overdue: false, from };
}

/* 记一笔「已申报」。这不是系统替你报了，是把「谁在什么时候报的」留在档案里 ——
   查账的时候要的就是这个时间点。 */
function empMarkSofort(id, on, extra = {}) {
  const e = empById(id);
  if (!e) return null;
  if (empStoreScopeError(e)) return null;
  e.sofortmeldung = on ? { at: empNow(), by: empActorLabel(), noSv: !!extra.noSv, alt: extra.noSv ? { ...(extra.alt || {}) } : {} } : null;
  e.history = [...(e.history || []), {
    at: empNow(), field: "sofortmeldung",
    from: on ? "" : empRaw({ zh: "已申报", de: "gemeldet" }),
    to: on ? empRaw({ zh: "已申报", de: "gemeldet" }) : "",
    by: empActorLabel()
  }];
  return empSaveStaff(e);
}

/* 特殊审批（ANS-1）：三层材料清单只提示缺什么，不挡员工提交，也不挡审核按钮的存在；
   审核通过时第一、二层还有缺项（入职后才产生的“签好的合同”不算），必须由老板做一次特殊审批，
   留下原因、审批人和时间。暂缺申请、延期次数一期不做。 */
function empOnbGaps(e, force) {
  return empOnbItems(e, force).filter(x => !x.done && x.layer <= 2 && x.key !== "contract");
}

function empSpecialNeeded(e) {
  return e?.invite?.state === "submitted" && empOnbGaps(e, "submitted").length > 0;
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
  if (empStoreScopeError(e)) return null;
  const next = JSON.parse(JSON.stringify(e));
  empReplaceDoc(next, docId, { file, ref, by: "manager" });
  return empSaveWithHistory(next);
}

function empClearDoc(id, docId) {
  const e = empById(id);
  if (!e) return null;
  if (empStoreScopeError(e)) return null;
  const next = JSON.parse(JSON.stringify(e));
  next.docs = { ...(next.docs || {}) };
  delete next.docs[docId];
  return empSaveWithHistory(next);
}

/* 证件替换的唯一入口（HR-DOC-20/21）：旧版本进历史、新版本按补丁里的版本时间和有效期生效。
   管理端上传、补件采纳、资料更新采纳都走这里，避免三条路径各写一套。 */
function empReplaceDoc(next, docId, patch) {
  if (!next || !docId || !patch || !patch.file) return null;
  const old = next.docs?.[docId] || {};
  const at = patch.at || empNow();
  const healthBefore = docId === "belehrung" ? empHealth(next) : null;
  const version = (Number(old.version) || 1) + (old.file ? 1 : 0);
  if (old.file) {
    next.documentArchive = [{ docId, ...old, state: "replaced", archivedAt: empNow(), replacedBy: patch.by || empActorLabel(), reason: patch.keepReason || "" }, ...(next.documentArchive || [])];
  }
  next.docs = {
    ...(next.docs || {}),
    [docId]: {
      ...old,
      state: "ok",
      file: patch.file,
      dataUrl: patch.dataUrl || old.dataUrl || null,
      ref: patch.ref || old.ref || null,
      at,
      by: patch.by || empActorLabel(),
      needsReview: false,
      version,
      expiry: patch.expiry || null,
      expiryKeptReason: patch.keepReason || ""
    }
  };
  if (docId === "belehrung") {
    const cycle = 12 * empHealthRetrainYears();
    const expiry = next.docs.belehrung.expiry;
    const lastRetrain = patch.keepExpiry && healthBefore?.lastRetrain
      ? healthBefore.lastRetrain
      : empValidExpiry(expiry) ? empAddMonths(expiry, -cycle) : (healthBefore?.lastRetrain || "");
    next.health = { firstProof: "yes", lastRetrain };
    next.docs.belehrung.expiry = lastRetrain ? empAddMonths(lastRetrain, cycle) : null;
  }
  return next.docs[docId];
}

/* 这个人算不算「新人」：走过入职审核、已经在岗、清单还没办完。 */
function empIsNewHire(e) {
  if (empStatus(e.status).leaving || e.leave) return false;
  if (!e.invite || e.invite.state !== "approved") return false;
  if (e.invite.fillMode === "veteran") return false;
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
  if (empStoreScopeError(e)) return null;
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
  if (item.kind === "doc") return empDocLabel(empDocType(item.id));
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
  if (empStoreScopeError(e)) return null;
  const items = empTopupItems(e);
  if (!items.length) return null;
  /* 同一员工同时只能有一条未结束的补件请求（HR-ONB-44） */
  if (empHasRequest(e)) return null;
  /* 员工自己的资料修改也占同一条“未结束请求”的名额（HR-ONB-43/44） */
  if (empHasOpenUpdateRequest(e)) return null;
  if (empOpenSupplementSnapshot(e)) return null;
  e.request = {
    requestId: empRequestId("topup"),
    token: empToken(),
    kind: "topup",
    state: "sent",
    items,
    note: note != null ? note : "",
    via: "app",
    sentAt: empNow(),
    submitted: {}
  };
  return empSaveStaff(e);
}

function empCancelRequest(id) {
  const e = empById(id);
  if (!e || !e.request) return null;
  if (empStoreScopeError(e)) return null;
  /* 撤销时同一请求的第二份投影也要关闭，不能留下可被再次采纳的补件记录（HR-ONB-43/44） */
  const other = e.employeePortal?.supplementSubmission;
  if (other && empSameRequestId(other, e.request)) {
    e.employeePortal = {
      ...(e.employeePortal || {}),
      supplementRequest: null,
      supplementSubmission: { ...other, requestId: e.request.requestId || other.requestId || "", status: "cancelled", reviewedAt: empNow(), reviewedBy: empActorLabel() }
    };
  }
  empCloseRequestId(e, e.request.requestId || other?.requestId);
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
  return empAcceptReview(id);
}

function empReturnRequest(id, note) {
  return empReturnReview(id, note);
}

/* ------------------------------------------------ 老板端统一核对卡 ---
   员工入职后的资料修改（employeePortal.updateRequest）和补件交回（e.request /
   employeePortal.supplementSubmission）共用同一张核对卡：逐项显示原值/新值，
   采纳或退回；采纳前正式档案不动（HR-ONB-43/44）。 */
function empHasOpenUpdateRequest(e) {
  return ["pending", "returned"].includes(e?.employeePortal?.updateRequest?.state);
}

function empOpenSupplementSnapshot(e) {
  const sup = e?.employeePortal?.supplementSubmission;
  if (!sup) return null;
  const status = sup.status || sup.state || "submitted";
  if (empRequestClosed(e, sup.requestId)) return null;
  return ["accepted", "returned", "done", "cancelled"].includes(status) ? null : sup;
}

function empPortalDocId(key) {
  return EMP_PORTAL_DOC_MAP[key] || key;
}

function empPortalFieldPath(key) {
  return EMP_PORTAL_FIELD_MAP[key] || EMP_PORTAL_SPECIAL_FIELDS[key] || key;
}

function empUpdateReviewItems(e, req) {
  return (req?.items || []).map(item => {
    if (item.kind === "doc") {
      const docId = empPortalDocId(item.key);
      const old = e.docs?.[docId] || {};
      return {
        key: item.key, kind: "doc", docId,
        label: item.label || empDocLabel(empDocType(docId)),
        from: item.from !== undefined ? item.from : (old.file || ""),
        to: item.file?.name || item.to || "",
        file: item.file || null,
        expiry: item.expiry || "",
        keepExpiry: item.keepExpiry === true,
        keepReason: item.keepReason || "",
        sensitive: true
      };
    }
    const path = empPortalFieldPath(item.key);
    return {
      key: item.key, kind: "field", path,
      label: item.label || item.key,
      from: item.from !== undefined ? item.from : (empGetPath(e, path) || ""),
      to: item.to !== undefined ? item.to : (empGetPath(e, path) || ""),
      sensitive: empSensitivePath(path)
    };
  });
}

function empTopupReviewItems(e, req) {
  const sub = req?.submitted || {};
  return (req?.items || []).map(item => {
    if (item.kind === "field") {
      const path = item.path;
      return {
        key: path, kind: "field", path,
        label: empItemName(item),
        from: empGetPath(e, path) || "",
        to: empGetPath(sub, path) || "",
        sensitive: empSensitivePath(path)
      };
    }
    const doc = sub.docs?.[item.id] || {};
    return {
      key: item.id, kind: "doc", docId: item.id,
      label: empItemName(item),
      from: e.docs?.[item.id]?.file || "",
      to: doc.file || "",
      file: doc.file ? { name: doc.file, data: doc.dataUrl || null, ref: doc.ref, at: doc.at || "" } : null,
      expiry: doc.expiry || "",
      /* 保留原日期的原因随冻结的补件版本一起进入核对卡和采纳记录（HR-DOC-20） */
      keepExpiry: doc.keepExpiry === true,
      keepReason: doc.keepReason || "",
      sensitive: true
    };
  });
}

function empHistoryFieldLabel(path) {
  const tracked = empTrackedField(path);
  if (tracked) return empRaw(tracked.name);
  const labels = {
    "contact.phone": { zh: "电话", de: "Telefon" },
    "contact.street": { zh: "街道", de: "Straße" },
    "contact.houseNo": { zh: "门牌号", de: "Hausnummer" },
    "contact.zip": { zh: "邮编", de: "PLZ" },
    "contact.city": { zh: "城市", de: "Ort" },
    "contact.emergencyPhone": { zh: "紧急联系人电话", de: "Notfalltelefon" },
    "contact.language": { zh: "沟通语言", de: "Sprache" }
  };
  return labels[path] ? empRaw(labels[path]) : path;
}

function empSupplementReviewItems(e, sup) {
  const sub = sup?.submitted || {};
  const out = [];
  Object.keys(sub.contact || {}).forEach(key => {
    const path = `contact.${key}`;
    out.push({ key: path, kind: "field", path, label: empHistoryFieldLabel(path), from: empGetPath(e, path) || "", to: sub.contact[key] || "", sensitive: empSensitivePath(path) });
  });
  Object.keys(sub.ids || {}).forEach(key => {
    const path = `ids.${key}`;
    out.push({ key: path, kind: "field", path, label: empHistoryFieldLabel(path), from: empGetPath(e, path) || "", to: sub.ids[key] || "", sensitive: empSensitivePath(path) });
  });
  if (sub.birthday !== undefined) {
    out.push({ key: "birthday", kind: "field", path: "birthday", label: empHistoryFieldLabel("birthday"), from: e.birthday || "", to: sub.birthday || "", sensitive: true });
  }
  Object.entries(sub.docs || {}).forEach(([docId, doc]) => {
    out.push({
      key: docId, kind: "doc", docId,
      label: empDocLabel(empDocType(docId)),
      from: e.docs?.[docId]?.file || "",
      to: doc.file || "",
      file: doc.file ? { name: doc.file, data: doc.dataUrl || null, ref: doc.ref, at: doc.at || "" } : null,
      expiry: doc.expiry || "",
      keepExpiry: doc.keepExpiry === true,
      keepReason: doc.keepReason || "",
      sensitive: true
    });
  });
  return out;
}

/* 同一张补件请求会同时投影到 e.request 和 employeePortal.supplementSubmission/updateRequest。
   两条投影用同一个 requestId 标记；采纳、退回、撤销时一起关闭，避免核对卡再次复活（HR-ONB-43/44）。 */
function empRequestId(prefix) {
  return `${prefix || "req"}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* 已采纳 / 退回 / 撤销的请求把 requestId 记进 closedRequestIds；旧投影再被发布时按 requestId 拒绝重新打开。
   退回后员工重新提交会换新的 requestId，不受影响。 */
function empRequestClosed(e, requestId) {
  return !!requestId && Array.isArray(e?.closedRequestIds) && e.closedRequestIds.includes(requestId);
}

function empCloseRequestId(e, requestId) {
  if (!e || !requestId) return;
  const list = Array.isArray(e.closedRequestIds) ? e.closedRequestIds : [];
  if (!list.includes(requestId)) e.closedRequestIds = [...list, requestId];
}

function empSameRequestId(a, b) {
  const left = a?.requestId || "";
  const right = b?.requestId || "";
  return !left || !right || left === right;
}

/* 退回后重新开放的补件项必须带稳定键（phone、passport…）。旧记录只留了展示文字，
   此时从冻结的 submitted.contact / ids / birthday / docs 反推键。 */
function empSupplementRestoreItems(req) {
  const items = Array.isArray(req?.items) ? req.items : [];
  if (items.every(x => x && typeof x === "object" && (x.key || x.id || x.path))) return items;
  const sub = req?.submitted || {};
  const keyOf = path => Object.keys(EMP_PORTAL_FIELD_MAP).find(k => EMP_PORTAL_FIELD_MAP[k] === path);
  const out = [];
  Object.keys(sub.contact || {}).forEach(k => { const key = keyOf(`contact.${k}`); if (key) out.push({ key }); });
  Object.keys(sub.ids || {}).forEach(k => { const key = keyOf(`ids.${k}`); if (key) out.push({ key }); });
  if (sub.birthday !== undefined) out.push({ key: "birthday" });
  Object.keys(sub.docs || {}).forEach(docId => {
    const key = Object.keys(EMP_PORTAL_DOC_MAP).find(k => EMP_PORTAL_DOC_MAP[k] === docId);
    if (key) out.push({ key });
  });
  return out.length ? out : items;
}

function empReviewSources(e) {
  const out = [];
  const update = e?.employeePortal?.updateRequest;
  if (update && update.state === "pending" && !empRequestClosed(e, update.requestId)) {
    out.push({ kind: "update", req: update, requestId: update.requestId || "", at: update.at || "", items: empUpdateReviewItems(e, update) });
  }
  if (e?.request && e.request.state === "submitted" && !empRequestClosed(e, e.request.requestId)) {
    out.push({ kind: "topup", req: e.request, requestId: e.request.requestId || "", at: e.request.submittedAt || e.request.sentAt || "", items: empTopupReviewItems(e, e.request) });
  }
  const supplement = empOpenSupplementSnapshot(e);
  /* 已经有一条补件请求时不再把同一件事的第二份投影当成第二张卡 */
  if (supplement && !out.some(x => x.kind === "topup")) {
    out.push({ kind: "supplement", req: supplement, requestId: supplement.requestId || "", at: supplement.at || "", items: empSupplementReviewItems(e, supplement) });
  }
  return out;
}

function empReviewNeedsSensitive(sources) {
  return sources.some(src => src.items.some(item => item.sensitive));
}

function empReviewAllItems(sources) {
  return sources.flatMap(src => src.items);
}

function empReviewValidate(e, sources) {
  if (empReviewNeedsSensitive(sources) && !empCan("sensitive")) {
    return { ok: false, code: "permission", message: empDenyReason("sensitive") };
  }
  if (!empReviewAllItems(sources).length) {
    return { ok: false, code: "empty", message: empT("请求里没有可核对的项。", "Keine prüfbaren Positionen in der Anfrage.") };
  }
  for (const src of sources) {
    if (src.kind === "topup") {
      const progress = empRequestProgress(e);
      if (!progress.complete) {
        return { ok: false, code: "incomplete", message: empT("补件还没交齐，先退回让员工补齐。", "Nachreichung unvollständig, bitte zurückgeben.") };
      }
      /* 补件必须是这次请求之后的新版本；旧记录没有时间就不认（HR-DOC-20/38） */
      const sentAt = src.req.sentAt || "";
      for (const item of src.items) {
        if (item.kind !== "doc") continue;
        if (!item.file?.at) {
          return { ok: false, code: "version", message: empT(`${item.label}：无法确认是新版本，请让员工重新上传。`, `${item.label}: neue Version nicht nachweisbar, bitte neu hochladen.`) };
        }
        if (sentAt && String(item.file.at) <= String(sentAt)) {
          return { ok: false, code: "version", message: empT(`${item.label}：文件早于本次补件请求，请重新上传。`, `${item.label}: Datei älter als die Anfrage, bitte neu hochladen.`) };
        }
      }
    }
  }
  for (const item of empReviewAllItems(sources)) {
    if (item.kind === "field") {
      if (item.to === undefined || item.to === null) {
        return { ok: false, code: "value", message: empT(`${item.label}：请求里没有新值。`, `${item.label}: kein neuer Wert in der Anfrage.`) };
      }
      if (item.path === "contract.isStudent" && !["", "yes", "no"].includes(String(item.to))) {
        return { ok: false, code: "value", message: empT("学生身份只能回答“是”或“否”。", "Studienstatus nur ja/nein.") };
      }
      if (item.path === "contract.nationalityClass" && !["", "eu", "other"].includes(String(item.to))) {
        return { ok: false, code: "value", message: empT("国籍类别取值不正确。", "Staatsangehörigkeit ungültig.") };
      }
      continue;
    }
    const old = e.docs?.[item.docId] || {};
    if (!item.file || !item.file.name) {
      return { ok: false, code: "file", message: empT(`${item.label}：请求里没有文件版本。`, `${item.label}: keine Dateiversion in der Anfrage.`) };
    }
    if (!item.file.data && !item.file.ref && !item.file.dataUrl) {
      return { ok: false, code: "file", message: empT(`${item.label}：文件内容缺失，请让员工重新上传。`, `${item.label}: Datei fehlt, bitte neu hochladen.`) };
    }
    if (old.file) {
      if (!item.file.at) {
        return { ok: false, code: "version", message: empT(`${item.label}：无法确认是新版本，请让员工重新上传。`, `${item.label}: neue Version nicht nachweisbar, bitte neu hochladen.`) };
      }
      if (old.at && String(item.file.at) <= String(old.at)) {
        return { ok: false, code: "version", message: empT(`${item.label}：请求里的文件不是比现行版本更新的版本。`, `${item.label}: Datei ist nicht neuer als die aktuelle Version.`) };
      }
    }
    const type = empDocType(item.docId);
    if (type.expiry) {
      if (item.keepExpiry) {
        if (!String(item.keepReason || "").trim()) {
          return { ok: false, code: "expiry_reason", message: empT(`${item.label}：保留原日期必须写原因（HR-DOC-20）。`, `${item.label}: Begründung für bisheriges Datum nötig (HR-DOC-20).`) };
        }
        if (!empValidExpiry(item.expiry)) {
          return { ok: false, code: "expiry", message: empT(`${item.label}：现行版本没有可保留的有效期。`, `${item.label}: kein bisheriges Ablaufdatum vorhanden.`) };
        }
      } else if (!empValidExpiry(item.expiry)) {
        return { ok: false, code: "expiry", message: empT(`${item.label}：新版本必须填有效期（HR-DOC-20）。`, `${item.label}: neues Ablaufdatum erforderlich (HR-DOC-20).`) };
      }
    }
  }
  return { ok: true };
}

function empApplyPortalField(next, path, value) {
  if (path === "contract.nationalityClass") {
    empSetNationality(next, value === "eu" || value === "other" ? value : "");
    return;
  }
  if (path === "contract.isStudent") {
    next.contract = { ...(next.contract || {}) };
    next.contract.isStudent = value === "yes" ? true : value === "no" ? false : null;
    return;
  }
  empSetPath(next, path, value);
}

function empApplyReviewItem(next, item, e, actor) {
  if (item.kind === "field") {
    empApplyPortalField(next, item.path, item.to);
    return;
  }
  empReplaceDoc(next, item.docId, {
    file: item.file.name,
    dataUrl: item.file.data || item.file.dataUrl || null,
    ref: item.file.ref || null,
    at: item.file.at,
    expiry: item.expiry,
    keepExpiry: item.keepExpiry,
    keepReason: item.keepReason,
    by: actor
  });
}

function empReviewSummary(sources) {
  const labels = sources.map(src => src.kind === "update" ? empT("资料修改", "Datenänderung") : empT("补件", "Nachreichung"));
  return labels.join(" / ");
}

function empAcceptReview(id) {
  const e = empById(id);
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  const sources = empReviewSources(e);
  if (!sources.length) return { ok: false, code: "missing" };
  const valid = empReviewValidate(e, sources);
  if (!valid.ok) return valid;
  const actor = empActorLabel();
  const now = empNow();
  const next = JSON.parse(JSON.stringify(e));
  sources.forEach(src => {
    src.items.forEach(item => empApplyReviewItem(next, item, e, actor));
    const portal = next.employeePortal || {};
    const reqId = src.req.requestId || (src.kind === "topup" ? portal.supplementSubmission?.requestId : "") || empRequestId(src.kind);
    empCloseRequestId(next, reqId);
    if (src.kind === "update") {
      next.employeePortal = { ...portal, updateRequest: { ...src.req, requestId: reqId, state: "done", reviewedAt: now, reviewedBy: actor } };
      /* 同一请求在员工端还有一份补件投影时一起关闭，不能留一条可被再次采纳的记录 */
      if (portal.supplementSubmission && empSameRequestId(portal.supplementSubmission, src.req)) {
        next.employeePortal.supplementSubmission = { ...portal.supplementSubmission, requestId: reqId, status: "accepted", reviewedAt: now, reviewedBy: actor };
        next.employeePortal.supplementRequest = null;
      }
    } else if (src.kind === "topup") {
      next.request = { ...next.request, requestId: reqId, state: "done", acceptedAt: now, acceptedBy: actor };
      if (portal.supplementSubmission) {
        next.employeePortal = { ...portal, supplementRequest: null,
          supplementSubmission: { ...portal.supplementSubmission, requestId: reqId, status: "accepted", reviewedAt: now, reviewedBy: actor } };
      }
    } else {
      next.employeePortal = { ...portal, supplementRequest: null,
        supplementSubmission: { ...src.req, requestId: reqId, status: "accepted", reviewedAt: now, reviewedBy: actor } };
      if (next.request && next.request.state !== "done" && empSameRequestId(next.request, src.req)) {
        next.request = { ...next.request, requestId: next.request.requestId || reqId, state: "done", acceptedAt: now, acceptedBy: actor };
      }
      if (portal.updateRequest?.state === "pending" && empSameRequestId(portal.updateRequest, src.req)) {
        next.employeePortal.updateRequest = { ...portal.updateRequest, requestId: reqId, state: "done", reviewedAt: now, reviewedBy: actor };
      }
    }
  });
  const count = empReviewAllItems(sources).length;
  empLogEvent(next, "review.accepted", `${empReviewSummary(sources)}：采纳 ${count} 项`, actor);
  empSaveWithHistory(next, actor);
  return { ok: true };
}

function empReturnReview(id, reason) {
  const e = empById(id);
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  const sources = empReviewSources(e);
  if (!sources.length) return { ok: false, code: "missing" };
  const note = String(reason || "").trim();
  if (!note) return { ok: false, code: "reason", message: empT("退回必须写理由（HR-ONB-43/44）。", "Rückgabe nur mit Begründung (HR-ONB-43/44).") };
  const actor = empActorLabel();
  const now = empNow();
  const next = JSON.parse(JSON.stringify(e));
  sources.forEach(src => {
    const portal = next.employeePortal || {};
    const reqId = src.req.requestId || (src.kind === "topup" ? portal.supplementSubmission?.requestId : "") || empRequestId(src.kind);
    empCloseRequestId(next, reqId);
    if (src.kind === "update") {
      next.employeePortal = { ...portal, updateRequest: { ...src.req, requestId: reqId, state: "returned", reviewedAt: now, reviewedBy: actor, reason: note } };
      if (portal.supplementSubmission && empSameRequestId(portal.supplementSubmission, src.req)) {
        next.employeePortal.supplementSubmission = { ...portal.supplementSubmission, requestId: reqId, status: "returned", reviewedAt: now, reviewedBy: actor, reason: note };
        next.employeePortal.supplementRequest = null;
      }
    } else if (src.kind === "topup") {
      next.request = { ...next.request, requestId: reqId, state: "sent", note, returnedAt: now, returnedBy: actor, submitted: {}, sentAt: now };
      if (portal.supplementSubmission) {
        next.employeePortal = { ...portal, supplementRequest: null,
          supplementSubmission: { ...portal.supplementSubmission, requestId: reqId, status: "returned", reviewedAt: now, reviewedBy: actor, reason: note } };
      }
    } else {
      next.employeePortal = {
        ...portal,
        supplementRequest: { requestId: reqId, state: "open", at: now, note, items: empSupplementRestoreItems(src.req) },
        supplementSubmission: { ...src.req, requestId: reqId, status: "returned", reviewedAt: now, reviewedBy: actor, reason: note },
        supplementReturnedAt: null
      };
      if (next.request && next.request.state !== "done" && empSameRequestId(next.request, src.req)) {
        next.request = { ...next.request, requestId: next.request.requestId || reqId, state: "sent", note, returnedAt: now, returnedBy: actor, submitted: {}, sentAt: now };
      }
      if (portal.updateRequest?.state === "pending" && empSameRequestId(portal.updateRequest, src.req)) {
        next.employeePortal.updateRequest = { ...portal.updateRequest, requestId: reqId, state: "returned", reviewedAt: now, reviewedBy: actor, reason: note };
      }
    }
  });
  empLogEvent(next, "review.returned", `${empReviewSummary(sources)}：退回，原因：${note}`, actor);
  empSaveWithHistory(next, actor);
  return { ok: true };
}

/* ================================================================ 员工账号 ==
   HR-ACCESS-26/53：KaiSpan 没有“公司发初始密码”这件事。账号由邀请 + 员工自己
   设密码开通；需要重设密码时员工走平台的找回密码。所以这一张卡只展示状态和
   邀请动作，不再有密码、复制账号邮件、重置密码。
   状态存 e.account.state，旧数据（只有 user/pass/temp）读取时迁移成“已激活”。 */
const EMP_PASS_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";   /* 只留给旧 #me 演示入口登录用 */

function empMakePassword() {
  let out = "";
  for (let i = 0; i < 8; i += 1) out += EMP_PASS_CHARS[Math.floor(Math.random() * EMP_PASS_CHARS.length)];
  return out;
}

function empNormalizeAccount(e) {
  if (!e?.account) return false;
  let changed = false;
  const known = ["none", "invited", "accepted", "pending_link", "active", "disabled", "expired", "revoked", "send_failed"];
  if (!known.includes(e.account.state)) {
    /* 旧数据里只要建过账号就是能用密码登录的，迁移成“已激活”；离职的按停用读 */
    e.account.state = e.status === "left" ? "disabled"
      : e.status === "invited" ? (e.invite?.state === "sent" ? "invited" : "accepted")
      : "active";
    changed = true;
  }
  if (e.account.user && !e.account.email) { e.account.email = e.account.user; changed = true; }
  return changed;
}

function empAccountState(e) {
  if (!e?.account) return "none";
  /* 注意不能直接用 empStatus(status).leaving：邀请中也带 leaving 标记，
     但邀请中的人账号状态应是“已邀请待接受”，不是“已停用”。 */
  if (e.status === "left") return e.account.state === "none" ? "none" : "disabled";
  return e.account.state || "active";
}

/* 只有“已激活”才算员工已接受邀请并确认绑定。绑定中、待确认都不算。 */
function empAccountActive(e) {
  return !!e && e.status !== "left" && empAccountState(e) === "active";
}

function empAccountPushable(e) {
  return empAccountActive(e);
}

function empAccountStore(e) {
  return e?.account?.store || e?.store || "";
}

function empAccountInvitedToday(e) {
  const at = e?.account?.lastSentAt;
  return !!at && String(at).slice(0, 10) === empToday();
}

/* 发邀请 / 重新发送 / 重新邀请。三者在数据上都是把账号置为“已邀请待接受”，
   差别只在是不是第一次和当天是否已经重发过（HR-ACCESS-24）。 */
function empInviteAccount(id, mode) {
  const e = empById(id);
  if (!e) return { ok: false, reason: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return { ...scope, reason: scope.code };
  if (!empCan("invite")) return { ok: false, reason: "permission", message: empDenyReason("invite") };
  const mail = (e.contact?.email || "").trim();
  if (!mail) return { ok: false, reason: "email" };
  /* 与其他邀请入口共用同一套邮箱唯一性校验，批量邀请也不能给两个档案发同一个邮箱（HR-ACCESS-23/30） */
  const conflict = empInviteEmailConflict(mail, e.id);
  if (conflict) return { ok: false, reason: "conflict", message: conflict.message };
  if (mode !== "invite" && empAccountInvitedToday(e)) return { ok: false, reason: "cooldown" };
  const state = empAccountState(e);
  if (mode === "resend" && !["invited", "expired", "send_failed"].includes(state)) return { ok: false, reason: "state" };
  if (mode === "reinvite" && !["revoked", "expired", "send_failed"].includes(state)) return { ok: false, reason: "state" };
  const next = JSON.parse(JSON.stringify(e));
  next.account = {
    ...(next.account || {}),
    state: "invited",
    user: mail,
    email: mail,
    store: empAccountStore(e),
    invitedAt: next.account?.invitedAt || empNow(),
    lastSentAt: empNow(),
    sentCount: (Number(next.account?.sentCount) || 0) + 1
  };
  if (mode === "reinvite") next.account.reinvitedAt = empNow();
  const now = empNow();
  if (!next.invite) {
    /* 在岗老员工开通：建立一条正式邀请记录（token、7 天有效期、veteran 模式），
       员工进去只确认资料、补证件，不重走审核和合同（HR-ACCESS-30、HR-ONB-52）。 */
    next.invite = {
      state: "sent",
      fillMode: "veteran",
      token: empToken(),
      createdAt: now,
      sentAt: now,
      firstSentAt: now,
      expiresAt: empInviteExpiryFrom(now),
      sendResult: "sent",
      sendResultAt: now,
      reminders: [],
      resendLog: [],
      draft: null,
      submitted: {}
    };
  }
  /* 还在入职流程里的人：账号卡上的“发邀请/重新发送”同时推进入职邀请，
     避免账号状态说已发送、邀请详情还说草稿（邀请详情仍由第 5 批细化）。 */
  if (next.invite && next.invite.state !== "approved") {
    const inv = next.invite;
    if (inv.state === "revoked") {
      inv.previousInvites = [{ token: inv.token, createdAt: inv.createdAt, sentAt: inv.sentAt, state: inv.state, revokedAt: inv.revokedAt || now },
        ...(inv.previousInvites || [])];
      inv.token = empToken();
      inv.state = "sent";
      inv.sentAt = now;
      inv.firstSentAt = now;
      inv.expiresAt = empInviteExpiryFrom(now);
      inv.revokeReason = "";
      inv.revokedAt = null;
    } else if (mode === "invite" && inv.state === "draft") {
      inv.state = "sent";
      inv.sentAt = inv.sentAt || now;
      inv.expiresAt = inv.expiresAt || empInviteExpiryFrom(inv.sentAt);
    } else if (mode !== "invite" && next.invite.state === "sent") {
      inv.reminders = [...(inv.reminders || []), { at: now, kind: "resend" }];
    }
    /* 旧记录可能只有账号、没有 token/有效期；补上，否则员工端拿不到可进入的邀请（HR-ONB-52） */
    if (!inv.token) inv.token = empToken();
    if (!inv.expiresAt) inv.expiresAt = empInviteExpiryFrom(inv.sentAt || now);
  }
  empSaveStaff(next);
  return { ok: true };
}

/* 关联已有账号（HR-ACCESS-43 ★2.4）：先在档案里写一条待确认绑定，
   给本人发“请确认员工档案关联”待办；本人确认前员工端只显示档案姓名。 */
const EMP_MEMBER_CANDIDATES = [
  { name: "Olivia Martin", email: "olivia@example.com", role: "店长" },
  { name: "Martin Chen", email: "martin@example.com", role: "老板" },
  { name: "Tom Weber", email: "tom@example.com", role: "店长" }
];

function empMemberCandidates(e) {
  const own = String(e?.name || "").trim();
  return EMP_MEMBER_CANDIDATES.map(c => ({ ...c }))
    .sort((a, b) => (b.name.includes(own) ? 1 : 0) - (a.name.includes(own) ? 1 : 0));
}

function empLinkAccount(id, email) {
  const e = empById(id);
  if (!e) return { ok: false, reason: "missing" };
  if (!empCan("invite")) return { ok: false, reason: "permission", message: empDenyReason("invite") };
  const candidate = empMemberCandidates(e).find(c => c.email === email) || { name: email, email, role: "" };
  const next = JSON.parse(JSON.stringify(e));
  next.account = {
    ...(next.account || {}),
    state: "pending_link",
    user: candidate.email,
    email: candidate.email,
    store: empAccountStore(e),
    candidate,
    requestedAt: empNow(),
    requestedBy: empActorLabel()
  };
  empSaveStaff(next);
  return { ok: true, candidate };
}

function empUnlinkAccount(id) {
  const e = empById(id);
  if (!e?.account) return null;
  const next = JSON.parse(JSON.stringify(e));
  const was = empAccountState(next);
  next.account = {
    ...next.account,
    state: "none",
    user: "",
    email: "",
    unlinkedAt: empNow(),
    unlinkedFrom: was
  };
  return empSaveStaff(next);
}

/* 旧 #me 入口继续可用；HR 页面不再显示密码 */
function empSetPassword(id, pass) {
  const e = empById(id);
  if (!e || !e.account || !pass || String(pass).length < 6) return null;
  e.account = { ...e.account, pass: String(pass), state: "active", changedAt: empNow() };
  return empSaveStaff(e);
}

function empLogin(user, pass) {
  const u = String(user || "").trim().toLowerCase();
  const hit = empAllStaff().find(e => e.account && String(e.account.user || "").toLowerCase() === u && e.account.pass === pass);
  if (!hit) return { ok: false, code: "bad" };
  if (!empAccountActive(hit)) return { ok: false, code: "left" };
  return { ok: true, employee: hit };
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
  if (empStatusHidden(e)) return "invited";
  const day = today || empToday();
  /* 最后工作日当天及以前仍在岗，次日起才是已离职（HR-LIFE-02/18） */
  if (e.leave && e.leave.lastDay) return day > e.leave.lastDay ? "left" : "leaving";
  /* 审核通过但入职日在将来：待入职，不计入在岗人数（HR-LIFE-02） */
  if (e.invite?.state === "approved" && e.entryDate && day < e.entryDate) return "pending";
  const end = empProbationEndEffective(e);
  if (end && day <= end) return "probation";
  return "active";
}

/* 存进去之前先把状态摆正，免得存下来的又是矛盾的 */
function empNormalizeStatus(e, today) {
  e.status = empDeriveStatus(e, today);
  return e;
}

/* 试用期设置对不对。返回一条要显示的问题，没问题就返回 null。 */
/* 默认结束日 = 入职日 + 月数 − 1 天（HR-LIFE-06 ★3.1）。
   hr-model.js 里已有同一算法，单独加载 employee.js 的测试也能用本地兜底。 */
function empProbationDefaultEndAt(entryDate, months) {
  if (typeof hrProbationDefaultEnd === "function") return hrProbationDefaultEnd(entryDate, months);
  if (!entryDate || !months) return "";
  const date = new Date(entryDate + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + Number(months));
  if (date.getUTCDate() !== day) date.setUTCDate(0);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/* 法定上限日固定按 6 个月算，与可改的“默认试用期月数”分开（HR-LIFE-07/08） */
function empProbationMaxEnd(e) {
  return e?.entryDate ? empProbationDefaultEndAt(e.entryDate, 6) : "";
}

/* 有效试用期结束日 = 档案结束日与上限日中较早的一个（HR-LIFE-08） */
function empProbationEndEffective(e) {
  if (!e?.probationEnd) return "";
  const max = empProbationMaxEnd(e);
  return max && e.probationEnd > max ? max : e.probationEnd;
}

function empProbationIssue(e, today) {
  if (!e.probationEnd) return null;
  const day = today || empToday();
  if (e.entryDate && e.probationEnd < e.entryDate) {
    return { tone: "red", text: empT("试用期结束日排在入职日期前面，改一下。", "Das Ende der Probezeit liegt vor dem Eintrittsdatum.") };
  }
  if (e.entryDate) {
    /* 上限固定 6 个月；超过部分一律按正式员工处理，只提醒，不代替老板改合同（HR-LIFE-08） */
    const max = empProbationMaxEnd(e);
    if (e.probationEnd > max) {
      return { tone: "red", text: empT(
        `超过法定上限：合同写的结束日是 ${empFormatDate(e.probationEnd)}，但有效试用期只到 ${empFormatDate(max)}（入职日 + 6 个月）。超过的部分按正式员工处理，解约通知期按合同走；请核对合同写法。`,
        `Über der gesetzlichen Grenze: vertraglich ${empFormatDate(e.probationEnd)}, wirksam aber nur bis ${empFormatDate(max)} (Eintritt + 6 Monate). Danach gilt die reguläre Kündigungsfrist. Bitte Vertrag prüfen.`) };
    }
  }
  if (empDaysBetween(day, empProbationEndEffective(e)) < 0) {
    return { tone: "blue", text: empT(
      `试用期 ${empFormatDate(e.probationEnd)} 就结束了，这个人现在算正式员工。要留记录就把日期清空。`,
      `Die Probezeit endete am ${empFormatDate(e.probationEnd)} — die Person gilt jetzt als regulär beschäftigt.`) };
  }
  return null;
}

/* 在职时长。只在花名册显示，资料详情不再重复一遍。 */
function empTenure(e, today) {
  if (!e.entryDate) return null;
  const end = e.leave?.lastDay ? e.leave.lastDay : (today || empToday());
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

/* 通知日是否落在有效试用期内（HR-LIFE-12：由系统按日期判断） */
function empLeaveInProbation(e, noticeDate) {
  const end = empProbationEndEffective(e);
  if (!noticeDate || !end) return false;
  return noticeDate <= end;
}

/* 档案保留到哪天。离职不等于删档，税务和劳动法都要求留着。 */
function empRetentionUntil(e) {
  if (!e.leave?.lastDay) return null;
  const rows = empRetentionRows(e);
  return rows.reduce((latest, row) => (!latest || row.until > latest ? row.until : latest), "");
}

/* +N 年；2 月 29 日落到非闰年时取 3 月 1 日（HR-LIFE-34） */
function empAddYears(dateStr, years) {
  if (!dateStr) return "";
  const [y, m, d] = String(dateStr).split("-").map(Number);
  if (!y || !m || !d) return "";
  const year = y + Number(years || 0);
  const date = new Date(Date.UTC(year, m - 1, d, 12));
  if (date.getUTCMonth() !== m - 1) {
    return new Date(Date.UTC(year, m, 1, 12)).toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/* 五类资料各自一个保存年限（HR-DATA-01/07、HR-LIFE-42）。
   旧存档只有 recordRetentionYears 时作为兜底，新设置按类别分别读取。 */
const EMP_RETENTION_CATEGORIES = [
  { id: "contract", rule: "recordRetentionContractYears", name: { zh: "合同与问卷", de: "Vertrag und Fragebogen" } },
  { id: "payroll", rule: "recordRetentionPayrollYears", name: { zh: "工资相关", de: "Lohnunterlagen" } },
  { id: "documents", rule: "recordRetentionDocumentsYears", name: { zh: "证件", de: "Ausweisdokumente" } },
  { id: "health", rule: "recordRetentionHealthYears", name: { zh: "健康证", de: "Belehrung" } },
  { id: "other", rule: "recordRetentionOtherYears", name: { zh: "其他资料", de: "Sonstiges" } }
];

function empRetentionYears(category) {
  const cat = EMP_RETENTION_CATEGORIES.find(c => c.id === category);
  const value = cat ? empRule(cat.rule) : empRule("recordRetentionYears");
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : Number(empRule("recordRetentionYears")) || 10;
}

function empRetentionRows(e) {
  if (!e?.leave?.lastDay) return [];
  return EMP_RETENTION_CATEGORIES.map(c => {
    const years = empRetentionYears(c.id);
    return { ...c, years, until: empAddYears(e.leave.lastDay, years) };
  });
}

/* 处理记录按类别存；旧存档的 {at, by} 视为五类都已处理过一次。 */
function empRetentionHandledFor(e, category) {
  const handled = e?.retentionHandled;
  if (!handled) return null;
  if (handled.at && !handled[category]) return handled;
  return handled[category] || null;
}

/* ------------------------------------------------------ 合同通知期写法 ----- */
/* 结构化三种：N 周 / N 周到当月 15 日或月底 / N 个月到月底；其余保存自由文本（HR-CONTRACT-08 ★3.2）。 */
function empNoticeStruct(contract) {
  const c = contract || {};
  if (c.notice && c.notice.format === "struct" && Number(c.notice.count) > 0) {
    return {
      format: "struct",
      unit: c.notice.unit === "months" ? "months" : "weeks",
      count: Number(c.notice.count),
      cutoff: c.notice.cutoff === "midmonth" || c.notice.cutoff === "end" ? c.notice.cutoff : "none"
    };
  }
  const text = String(c.noticePeriod || "");
  let m = text.match(/(\d+)\s*Wochen?[^0-9]*zum\s+15/i);
  if (m) return { format: "struct", unit: "weeks", count: Number(m[1]), cutoff: "midmonth" };
  m = text.match(/(\d+)\s*Wochen?.*Monatsende/i);
  if (m) return { format: "struct", unit: "weeks", count: Number(m[1]), cutoff: "end" };
  m = text.match(/(\d+)\s*Monate?.*Monatsende/i);
  if (m) return { format: "struct", unit: "months", count: Number(m[1]), cutoff: "end" };
  m = text.match(/^(\d+)\s*Wochen?$/i);
  if (m) return { format: "struct", unit: "weeks", count: Number(m[1]), cutoff: "none" };
  if (c.notice && c.notice.format === "struct") return { format: "struct", unit: "weeks", count: 0, cutoff: "none" };
  return { format: text ? "text" : "", unit: "weeks", count: 0, cutoff: "none" };
}

function empNoticeText(notice) {
  if (!notice || notice.format !== "struct" || !Number(notice.count)) return "";
  const n = Number(notice.count);
  if (notice.unit === "months") return `${n} Monate zum Monatsende`;
  if (notice.cutoff === "midmonth") return `${n} Wochen zum 15. oder Monatsende`;
  if (notice.cutoff === "end") return `${n} Wochen zum Monatsende`;
  return `${n} Wochen`;
}

/* 保存前把通知期整理成结构化值，并同步回展示字段 noticePeriod（旧页面、员工端都读它）。 */
function empPrepareContractForSave(contract) {
  const c = contract || {};
  const notice = c.notice || {};
  /* 没有通知期数据、也没选自由文本时，不凭空造一个 notice 对象 */
  if (!c.notice && !Number(notice.count) && !String(c.noticePeriod || "").trim()) return c;
  if (notice.format === "text") {
    c.notice = { format: "text", text: String(c.noticePeriod || "") };
    return c;
  }
  c.notice = {
    format: "struct",
    unit: notice.unit === "months" ? "months" : "weeks",
    count: Number(notice.count) || 0,
    cutoff: notice.unit === "months" ? "end"
      : (["none", "midmonth", "end"].includes(notice.cutoff) ? notice.cutoff : "none")
  };
  const text = empNoticeText(c.notice);
  if (text) c.noticePeriod = text;
  return c;
}

/* 最早最后工作日的参考日期（HR-LIFE-15 ★3.2）。返回 null 表示合同写法算不出来，交给老板填。 */
function empNoticeEarliestDate(noticeDate, notice) {
  if (!noticeDate || !notice) return "";
  const count = Number(notice.count);
  if (!count) return "";
  if (notice.unit === "months") {
    const base = empAddMonths(noticeDate, count);
    if (!base) return "";
    return empMonthEnd(base);
  }
  let date = empShiftDate(noticeDate, count * 7);
  if (notice.cutoff === "midmonth" || notice.cutoff === "end") {
    date = notice.cutoff === "midmonth" ? empNextMidmonthOrEnd(date) : empMonthEnd(date);
  }
  return date;
}

function empMonthEnd(dateStr) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
}

/* 最近的 15 日或月底（含当天） */
function empNextMidmonthOrEnd(dateStr) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getUTCFullYear(), m = date.getUTCMonth(), d = date.getUTCDate();
  if (d <= 15) return new Date(Date.UTC(y, m, 15, 12)).toISOString().slice(0, 10);
  return new Date(Date.UTC(y, m + 1, 0, 12)).toISOString().slice(0, 10);
}

/* --------------------------------------------------------- 变更记录 ------ */
/* 只记有法律或金钱意义的字段。电话改了没人会回头查，时薪改了会。 */
const EMP_TRACKED = [
  { path: "status", name: { zh: "在职状态", de: "Status" } },
  { path: "store", name: { zh: "所属门店", de: "Filiale" } },
  { path: "role", name: { zh: "岗位", de: "Position" } },
  { path: "level", name: { zh: "员工级别", de: "Qualifikation" } },
  { path: "employeeNo", name: { zh: "员工编号", de: "Personalnummer" } },
  { path: "entryDate", name: { zh: "入职日期", de: "Eintritt" } },
  { path: "probationEnd", name: { zh: "试用期结束", de: "Ende Probezeit" } },
  { path: "birthday", name: { zh: "出生日期", de: "Geburtsdatum" } },
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
  { path: "contract.nationalityClass", name: { zh: "国籍类别", de: "Staatsangehörigkeit" } },
  { path: "contract.zusatzCheck", name: { zh: "附加页核对", de: "Zusatzblatt geprüft" } },
  { path: "ids.iban", name: { zh: "IBAN", de: "IBAN" } },
  { path: "ids.steuerId", name: { zh: "Steuer-ID（个人税务识别号）", de: "Steuer-ID" } },
  { path: "ids.steuernummer", name: { zh: "原 Steuernummer", de: "Steuernummer (alt)" } },
  { path: "ids.rentenversicherung", name: { zh: "Rentenversicherung Nr.", de: "Rentenversicherung Nr." } },
  { path: "contact.krankenkasse", name: { zh: "保险公司", de: "Krankenkasse" } },
  { path: "ids.healthCardNumber", name: { zh: "医保卡号", de: "Krankenversichertennummer" } },
  { path: "firstName", name: { zh: "名", de: "名" } },
  { path: "lastName", name: { zh: "姓", de: "姓" } },
  { path: "contact.emergencyName", name: { zh: "紧急联系人姓名", de: "紧急联系人姓名" } },
  { path: "contact.country", name: { zh: "居住国家", de: "居住国家" } },
  { path: "contract.hasZusatz", name: { zh: "持有 Zusatzblatt", de: "持有 Zusatzblatt" } },
  { path: "contract.weeklyHours", name: { zh: "每周约定工时", de: "每周约定工时" } },
  { path: "contract.workLocation", name: { zh: "工作地点", de: "工作地点" } },
  { path: "contract.duties", name: { zh: "岗位职责", de: "岗位职责" } },
  { path: "contract.paymentTerms", name: { zh: "发薪时间与支付方式", de: "发薪时间与支付方式" } },
  { path: "contract.overtimeTerms", name: { zh: "加班与工时账户约定", de: "加班与工时账户约定" } },
  { path: "contract.allowanceTerms", name: { zh: "补贴 / 奖金约定", de: "补贴 / 奖金约定" } },
  /* 地址、电话、邮箱、紧急联系人电话故意不记（HR-DATA-15）：
     改得勤、法律后果轻，记进来只会把变更记录冲成流水账。 */
];

/* 变更记录里几个不是「字段被改了」而是「发生了一件事」的条目（HR-DATA-14）。
   写入由后续批次接；这一批先把结构、展示和脱敏做好。 */
const EMP_EVENTS = {
  onboarding: { zh: "入职审核通过", de: "Einstellung freigegeben" },
  "onboarding.submitted": { zh: "员工提交入职资料", de: "Unterlagen eingereicht" },
  "onboarding.confirmed": { zh: "员工确认公司代填资料", de: "Vorausgefüllte Angaben bestätigt" },
  "onboarding.veteran": { zh: "在岗老员工确认资料", de: "Bestandskraft bestätigt" },
  "onboarding.returned": { zh: "入职资料退回", de: "Einstellungsunterlagen zurückgegeben" },
  "onboarding.cancelled": { zh: "取消入职", de: "Einstellung abgesagt" },
  "invite.sent": { zh: "邀请发送", de: "Einladung gesendet" },
  "invite.resend": { zh: "邀请重发", de: "Einladung erneut gesendet" },
  "invite.revoked": { zh: "撤销邀请", de: "Einladung zurückgezogen" },
  "invite.reinvited": { zh: "重新邀请", de: "Erneut eingeladen" },
  leave: { zh: "办理离职", de: "Austritt erfasst" },
  "leave.undo": { zh: "撤销离职", de: "Austritt rückgängig" },
  "leave.proposal": { zh: "离职提案待确认", de: "Austritt zur Bestätigung" },
  "leave.confirmed": { zh: "老板确认离职", de: "Austritt bestätigt" },
  "leave.rejected": { zh: "老板驳回离职", de: "Austritt abgelehnt" },
  "leave.handover": { zh: "离职交接清单", de: "Offboarding-Checkliste" },
  "contract.sent": { zh: "合同发送", de: "Vertrag versendet" },
  "contract.signed": { zh: "合同签回", de: "Vertrag zurückerhalten" },
  "contract.archived": { zh: "核对归档", de: "Geprüft und abgelegt" },
  "contract.proposal": { zh: "合同条件提案待确认", de: "Vertragsbedingungen zur Bestätigung" },
  "contract.confirmed": { zh: "老板确认合同条件", de: "Vertragsbedingungen bestätigt" },
  "contract.rejected": { zh: "老板驳回合同条件", de: "Vertragsbedingungen abgelehnt" },
  "contract.returned": { zh: "退回重签一份", de: "Eine Datei zurückgegeben" },
  "contract.void": { zh: "合同作废", de: "Vertrag storniert" },
  "contract.offline": { zh: "线下签署归档", de: "Offline unterschrieben abgelegt" },
  "probation.confirmed": { zh: "提前转正", de: "Vorzeitige Übernahme" },
  "sofortmeldung": { zh: "即时申报", de: "Sofortmeldung" },
  "approval.special": { zh: "特殊审批结果", de: "Sonderfreigabe" },
  "review.accepted": { zh: "采纳资料更新/补件", de: "Datenänderung/Nachreichung übernommen" },
  "review.returned": { zh: "退回资料更新/补件", de: "Datenänderung/Nachreichung zurückgegeben" }
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
  if (path === "birthday") return empFormatDate(String(value));
  if (path === "employeeNo") return String(value);
  if (path === "contract.type") return empRaw(empContractType(value).name);
  if (path === "contract.payType") return value === "pauschal" ? empRaw({ zh: "Pauschal 月薪", de: "Pauschale" }) : empRaw({ zh: "时薪", de: "Stundenlohn" });
  if (path === "contract.rate") return `€${Number(value).toFixed(2)}`;
  if (path === "contract.nationalityClass") return empRaw({
    eu: { zh: "欧盟 / 欧洲经济区 / 瑞士", de: "EU / EWR / Schweiz" },
    other: { zh: "其他国籍", de: "Sonstige Staatsangehörigkeit" },
    "": { zh: "未回答", de: "Nicht beantwortet" }
  }[value] || { zh: "未回答", de: "Nicht beantwortet" });
  if (path === "contract.zusatzCheck") return empRaw({
    yes: { zh: "是", de: "Ja" },
    no: { zh: "否", de: "Nein" },
    "": { zh: "未核对", de: "Nicht geprüft" }
  }[value] || { zh: "未核对", de: "Nicht geprüft" });
  if (path === "health.firstProof") return empRaw(value === "yes" ? { zh: "有", de: "Vorhanden" } : { zh: "无", de: "Fehlt" });
  return String(value);
}

/* 敏感字段统一清单（HR-ACCESS-11）：税号、社保号、IBAN、医保号、出生日期、证件文件。
   变更记录、导出、待办都引用同一份判定，页面不各写一套（HR-DATA-42）。 */
const EMP_SENSITIVE_PATHS = ["birthday", "ids.steuerId", "ids.steuernummer", "ids.rentenversicherung", "ids.iban", "ids.healthCardNumber"];

function empSensitivePath(path) {
  return EMP_SENSITIVE_PATHS.includes(path) || String(path || "").startsWith("docs.");
}

/* 员工端资料更新请求用的键 ↔ 正式档案路径 / 证件位。
   员工端 employee-ui.js 先加载还是老板端先加载都不影响：这里只用固定约定，不依赖对方常量。 */
const EMP_PORTAL_FIELD_MAP = {
  first: "firstName", last: "lastName", birthday: "birthday", phone: "contact.phone",
  street: "contact.street", houseNo: "contact.houseNo", zip: "contact.zip", city: "contact.city",
  country: "contact.country", emergencyName: "contact.emergencyName", emergencyPhone: "contact.emergencyPhone",
  language: "contact.language", steuerId: "ids.steuerId", rentenversicherung: "ids.rentenversicherung",
  iban: "ids.iban", krankenkasse: "contact.krankenkasse", healthCardNumber: "ids.healthCardNumber"
};
const EMP_PORTAL_SPECIAL_FIELDS = { nationalityClass: "contract.nationalityClass", student: "contract.isStudent" };
const EMP_PORTAL_DOC_MAP = {
  passport: "id", visa: "residence", zusatz: "zusatz", student: "student", health: "kv",
  healthFront: "healthFront", healthBack: "healthBack", bankFront: "bankFront", bankBack: "bankBack",
  hygiene: "belehrung", contract: "contract", questionnaire: "personalquestionnaire"
};

function empMaskValue(path, value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return "—";
  if (path === "birthday") return "****-**-**";
  if (path.endsWith("iban")) {
    const tail = text.replace(/\s/g, "").slice(-4);
    return `•••• •••• •••• ${tail}`;
  }
  if (path.endsWith("steuerId") || path.endsWith("steuernummer") || path.endsWith("rentenversicherung")) {
    return `•••••••••${text.replace(/\s/g, "").slice(-2)}`;
  }
  if (path.endsWith("healthCardNumber")) return `••••••${text.slice(-2)}`;
  return "••••";
}

function empActorTone(by) {
  if (by === "老板") return "purple";
  if (by === "店长") return "blue";
  if (by === "税务师") return "orange";
  return "gray";
}

/* 事件类记录的统一入口；本批只定义，离职/合同等写入由后续批次调用 */
function empLogEvent(next, field, detail, by, effectiveDate) {
  next.history = [...(next.history || []), {
    at: empNow(), field, kind: "event", detail: detail || "",
    by: by || empActorLabel(), effectiveDate: effectiveDate || ""
  }];
}

/* 存档案时对比一遍，变了的写进 history。合并逻辑在这里，四个入口共用。 */
function empSaveWithHistory(next, by, meta) {
  if(next.firstName !== undefined || next.lastName !== undefined) next.name=[next.firstName||"",next.lastName||""].filter(Boolean).join(" ")||next.name;
  if(next.contract?.hasZusatz === "yes")next.contract.hasZusatz=true;
  if(next.contract?.hasZusatz === "no")next.contract.hasZusatz=false;
  const prev = empById(next.id);
  const log = [...(next.history || prev?.history || [])];
  const actor = by || empActorLabel();
  if (prev) {
    /* 员工端提交/确认不经过老板端动作，事件在这里补记，3.5 的变更记录才完整。 */
    const a = prev.invite || {};
    const b = next.invite || {};
    if (b.submittedAt && b.submittedAt !== a.submittedAt) {
      log.push({ at: empNow(), field: "onboarding.submitted", kind: "event", detail: empT("员工提交最后一版", "Letzte Abgabe"), by: actor });
    }
    if (b.confirmedCompanyProfileAt && b.confirmedCompanyProfileAt !== a.confirmedCompanyProfileAt) {
      log.push({ at: empNow(), field: "onboarding.confirmed", kind: "event", detail: empT("公司代填，员工已确认", "Vorausgefüllt, bestätigt"), by: actor });
    }
    if (b.veteranConfirmedAt && b.veteranConfirmedAt !== a.veteranConfirmedAt) {
      log.push({ at: empNow(), field: "onboarding.veteran", kind: "event", detail: empT("在岗老员工确认资料，直接归档", "Bestandskraft bestätigt, direkt abgelegt"), by: actor });
    }
    empDocDiffs(prev, next).forEach(d => {
      log.push({ at: empNow(), field: d.path, from: d.from, to: d.to,
                 by: actor, effectiveDate: meta?.effectiveDate || "" });
    });
    EMP_TRACKED.forEach(f => {
      const a = empGetPath(prev, f.path);
      const b = empGetPath(next, f.path);
      if (String(a == null ? "" : a) === String(b == null ? "" : b)) return;
      log.push({ at: empNow(), field: f.path, from: a == null ? "" : a, to: b == null ? "" : b,
                 by: actor, effectiveDate: meta?.effectiveDate || "" });
    });
  }
  next.history = log;
  return empSaveStaff(next);
}

/* ------------------------------------------------------ 合同条件版本 ----- */
/* 合同条件按生效日期分版本，每次保存新增一版，旧版保留（HR-CONTRACT-01/02/03）。 */
const EMP_CONTRACT_CONDITION_FIELDS = [
  ["contract.type", { zh: "合同类型", de: "Vertragsart" }],
  ["contract.payType", { zh: "薪资方式", de: "Vergütungsart" }],
  ["contract.rate", { zh: "薪资金额", de: "Betrag" }],
  ["contract.weeklyHours", { zh: "每周约定工时（参考）", de: "Wochenstunden (Referenz)" }],
  ["contract.hoursMin", { zh: "月工时下限", de: "Sollstunden min." }],
  ["contract.hoursMax", { zh: "月工时上限", de: "Sollstunden max." }],
  ["contract.urlaubDays", { zh: "年假天数", de: "Urlaubstage" }],
  ["contract.noticePeriod", { zh: "通知期", de: "Kündigungsfrist" }],
  ["contract.befristetUntil", { zh: "定期合同到期", de: "Befristung bis" }],
  ["contract.workLocation", { zh: "工作地点", de: "Arbeitsort" }],
  ["contract.duties", { zh: "岗位职责", de: "Aufgaben" }],
  ["contract.paymentTerms", { zh: "发薪时间与支付方式", de: "Zahlungsmodalitäten" }],
  ["contract.overtimeTerms", { zh: "加班与工时账户约定", de: "Überstunden / Zeitkonto" }],
  ["contract.allowanceTerms", { zh: "补贴 / 奖金约定", de: "Zulagen / Boni" }]
];

function empContractSnapshot(contract) {
  const c = contract || {};
  return {
    type: c.type || "", payType: c.payType || "", rate: c.rate ?? "", weeklyHours: c.weeklyHours ?? "",
    hoursMin: c.hoursMin ?? "", hoursMax: c.hoursMax ?? "", urlaubDays: c.urlaubDays ?? "",
    noticePeriod: c.noticePeriod || "", befristetUntil: c.befristetUntil || null,
    workLocation: c.workLocation || "", duties: c.duties || "", paymentTerms: c.paymentTerms || "",
    overtimeTerms: c.overtimeTerms || "", allowanceTerms: c.allowanceTerms || "",
    notice: c.notice ? { ...c.notice } : null
  };
}

function empContractConditionChanges(prev, next) {
  const a = empContractSnapshot(prev), b = empContractSnapshot(next);
  const out = [];
  EMP_CONTRACT_CONDITION_FIELDS.forEach(([path, name]) => {
    const key = path.replace(/^contract\./, "");
    const from = empGetPath({ contract: a }, path);
    const to = empGetPath({ contract: b }, path);
    if (String(from == null ? "" : from) === String(to == null ? "" : to)) return;
    out.push({ path, name, from: from == null ? "" : from, to: to == null ? "" : to });
  });
  return out;
}

/* 展示用：一版合同条件的起止时间。实际版本取 e.contractVersions；老档案没有记录时按当前值兜底。 */
function empContractVersionSeq(v) {
  const n = Number(v?.seq);
  return Number.isFinite(n) ? n : 0;
}

function empContractVersionId(v) {
  if (!v) return "";
  return v.id || `legacy:${v.validFrom || ""}:${v.at || ""}:${empContractVersionSeq(v)}`;
}

function empContractVersions(e) {
  const list = Array.isArray(e?.contractVersions) ? e.contractVersions.slice() : [];
  if (!list.length && e?.contract) {
    list.push({ id: "legacy", seq: 0, validFrom: e.entryDate || "", at: "", by: "", source: "initial", data: empContractSnapshot(e.contract) });
  }
  /* 同生效日、同毫秒保存两版时，靠单调序号决定谁是最新，不能退回旧值（HR-CONTRACT-02/03） */
  return list.sort((a, b) => String(b.validFrom || "").localeCompare(String(a.validFrom || ""))
    || empContractVersionSeq(b) - empContractVersionSeq(a)
    || String(b.at || "").localeCompare(String(a.at || "")));
}

function empContractVersionAt(e, date) {
  const day = date || empToday();
  return empContractVersions(e).filter(v => v.validFrom && v.validFrom <= day)[0] || null;
}

/* 最近“保存过”的版本，按保存顺序而不是生效日期排 —— 未来版本也算（HR-ACCESS-56）。 */
function empLatestContractVersion(e) {
  const list = empContractVersions(e);
  return list.reduce((best, v) => {
    if (!best) return v;
    const seqDiff = empContractVersionSeq(v) - empContractVersionSeq(best);
    if (seqDiff) return seqDiff > 0 ? v : best;
    const atDiff = String(v.at || "").localeCompare(String(best.at || ""));
    if (atDiff) return atDiff > 0 ? v : best;
    return String(v.validFrom || "") > String(best.validFrom || "") ? v : best;
  }, null);
}

function empPushContractVersion(e, validFrom, by, prevContract) {
  /* 第一次保存前把原值作为初始版本留下，否则“旧版保留”只剩一句口号 */
  if (!Array.isArray(e.contractVersions) || !e.contractVersions.length) {
    const baselineFrom = prevContract?.validFrom || e.entryDate || "";
    e.contractVersions = baselineFrom ? [{
      id: "legacy", seq: 0, validFrom: baselineFrom, at: "", by: "", source: "initial", data: empContractSnapshot(prevContract || {})
    }] : [];
  }
  const seq = e.contractVersions.reduce((max, v) => Math.max(max, empContractVersionSeq(v)), 0) + 1;
  e.contractVersions = [...(e.contractVersions || []), {
    id: `cv${seq}`, seq, validFrom, at: empNow(), by: by || empActorLabel(), source: "saved", data: empContractSnapshot(e.contract)
  }];
  e.contract.validFrom = validFrom;
  return e.contractVersions;
}

/* 合同条件的版本化字段。员工端 employee-ui.js 直接读 e.contract，
   所以 e.contract 必须始终等于“今天有效的版本”，未来版本只留在版本列表里（HR-CONTRACT-03）。 */
const EMP_CONTRACT_VERSION_FIELDS = EMP_CONTRACT_CONDITION_FIELDS.map(([path]) => path.replace(/^contract\./, ""));

function empApplyEffectiveContract(e, day) {
  const version = empContractVersionAt(e, day || empToday());
  if (!version?.data) return e;
  const contract = { ...(e.contract || {}) };
  EMP_CONTRACT_VERSION_FIELDS.forEach(key => {
    contract[key] = version.data[key] === undefined ? "" : version.data[key];
  });
  contract.notice = version.data.notice ? { ...version.data.notice } : null;
  contract.validFrom = version.validFrom || "";
  e.contract = contract;
  return e;
}

/* 读档案时把 e.contract 拉回今天有效的版本；改了才写盘，不每次读都写 */
function empSyncEffectiveContract(e, day) {
  if (!Array.isArray(e?.contractVersions) || !e.contractVersions.length) return false;
  const before = `${JSON.stringify(empContractSnapshot(e.contract || {}))}|${e.contract?.validFrom || ""}`;
  empApplyEffectiveContract(e, day);
  const after = `${JSON.stringify(empContractSnapshot(e.contract || {}))}|${e.contract?.validFrom || ""}`;
  return before !== after;
}

/* 定期合同续签/转不定期等单点改动：老板直接写新版本，店长走提案。 */
function empRequestContractChange(id, patch, note, effectiveDate) {
  const e = empById(id);
  if (!e) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("editTerms")) return { ok: false, code: "permission", message: empDenyReason("editTerms") };
  const from = String(effectiveDate || "").trim();
  if (!empValidExpiry(from)) return { ok: false, code: "date", message: empT("请填有效的生效日期", "Gültiges Wirksamkeitsdatum angeben") };
  if (e.entryDate && from < e.entryDate) {
    return { ok: false, code: "before_entry", message: empT(`生效日期不得早于入职日 ${empFormatDate(e.entryDate)}`, `Wirksamkeit nicht vor Eintritt ${empFormatDate(e.entryDate)}`) };
  }
  const next = JSON.parse(JSON.stringify(e));
  const beforeContract = JSON.parse(JSON.stringify(next.contract || {}));
  next.contract = { ...(next.contract || {}), ...patch, validFrom: from };
  const changes = empContractConditionChanges(e.contract || {}, next.contract);
  if (!changes.length) return { ok: false, code: "nochange", message: empT("没有变化", "Keine Änderung") };
  if (!empCan("confirmProposal")) {
    const submitted = empSubmitContractProposal(e, next, changes, from);
    if (!submitted?.ok) return submitted;
    return { ok: true, proposal: true };
  }
  empPushContractVersion(next, from, empActorLabel(), beforeContract);
  empApplyEffectiveContract(next, empToday());
  empLogEvent(next, "contract.confirmed", note || `生效日期 ${from} · ${changes.length} 项改动`, empActorLabel(), from);
  empSaveWithHistory(next, empActorLabel(), { effectiveDate: from });
  return { ok: true };
}

function empClearProbation(id) {
  const e = empById(id);
  if (!e) return { ok: false, code: "missing" };
  if (!empCan("ownerOnly")) return { ok: false, code: "permission", message: empDenyReason("ownerOnly") };
  const next = JSON.parse(JSON.stringify(e));
  next.probationEnd = null;
  empNormalizeStatus(next);
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

function empContractVersionLabel(value) {
  if (!value) return "—";
  if (typeof value === "string") return value;
  return empRaw(value);
}

function empContractChangeDiff(changes) {
  return changes.map(d => ({
    path: d.path,
    label: d.name,
    from: empContractVersionLabel(d.from),
    to: empContractVersionLabel(d.to)
  }));
}

/* 店长的合同条件/薪资改动先形成提案，老板确认后才写新版本（HR-ACCESS-07、旅程 J5）。 */
function empSubmitContractProposal(prev, nextIn, changes, validFrom) {
  if (!prev) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(prev);
  if (scope) return scope;
  if (prev.contractProposal?.state === "pending") {
    return { ok: false, code: "proposal_pending", message: empT("已有一份合同条件提案在等老板确认，先处理那一份。", "Es liegt bereits ein Vorschlag zur Bestätigung vor.") };
  }
  if (!empValidExpiry(validFrom)) return { ok: false, code: "date", message: empT("请填有效的生效日期", "Gültiges Wirksamkeitsdatum angeben") };
  if (prev.entryDate && validFrom < prev.entryDate) {
    return { ok: false, code: "before_entry", message: empT(`生效日期不得早于入职日 ${empFormatDate(prev.entryDate)}`, `Wirksamkeit nicht vor Eintritt ${empFormatDate(prev.entryDate)}`) };
  }
  /* 结果从“当前正式档案”构造，只接收合同字段白名单；调用方带来的 ids、docs、
     归档状态都不能整份复制进来（HR-ACCESS-07/55）。 */
  const next = JSON.parse(JSON.stringify(prev));
  const allowedContract = { ...(prev.contract || {}) };
  EMP_CONTRACT_VERSION_FIELDS.forEach(key => {
    if (nextIn?.contract?.[key] !== undefined) allowedContract[key] = nextIn.contract[key];
  });
  if (nextIn?.contract?.notice !== undefined) {
    allowedContract.notice = nextIn.contract.notice ? { ...nextIn.contract.notice } : null;
  }
  next.contract = allowedContract;
  const proposed = empContractSnapshot(next.contract);
  /* 改动清单也按白名单重算，避免调用方伪造一条不存在的改动 */
  const safeChanges = empContractConditionChanges(prev.contract || {}, allowedContract);
  if (!safeChanges.length) {
    return { ok: false, code: "nochange", message: empT("没有可提案的合同条件改动", "Keine zulässige Vertragsänderung") };
  }
  const latest = empLatestContractVersion(prev);
  next.contractProposal = {
    id: `cp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    state: "pending", at: empNow(), by: empActorLabel(), validFrom,
    data: proposed,
    changes: empContractChangeDiff(safeChanges),
    /* 基线：提交时今天有效的快照 + 最新版本 ID（含未来版本）。期间任何一版被加进来都不能直接确认（HR-ACCESS-07/56） */
    baseline: {
      at: empNow(),
      entryDate: prev.entryDate || "",
      validFrom: empContractVersions(prev)[0]?.validFrom || "",
      versionId: empContractVersionId(latest),
      versionCount: empContractVersions(prev).length,
      data: empContractSnapshot(prev.contract || {})
    }
  };
  /* 提案期间正式档案保持原值 */
  next.contract = JSON.parse(JSON.stringify(prev.contract || {}));
  empLogEvent(next, "contract.proposal", `生效日期 ${validFrom} · ${safeChanges.length} 项改动`);
  empSaveWithHistory(next);
  return { ok: true };
}

/* 兼容旧调用；现在“提前转正”必须填转正日期，只有老板能做（HR-LIFE-10） */
function empConfirmProbation(id, date) {
  return empSetProbationConfirm(id, date);
}

function empSetProbationConfirm(id, date) {
  const e = empById(id);
  if (!e) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("ownerOnly")) return { ok: false, code: "permission", message: empDenyReason("ownerOnly") };
  const day = date || empToday();
  if (!empValidExpiry(day)) return { ok: false, code: "date", message: "请填转正日期" };
  if (e.entryDate && day <= e.entryDate) return { ok: false, code: "before_entry", message: "转正日期必须晚于入职日" };
  const next = JSON.parse(JSON.stringify(e));
  next.probationEnd = empShiftDate(day, -1);
  next.probationConfirm = { date: day, at: empNow(), by: empActorLabel() };
  empNormalizeStatus(next);
  empLogEvent(next, "probation.confirmed", `转正日期 ${day}，试用期结束日改为 ${next.probationEnd}`, empActorLabel(), day);
  empSaveWithHistory(next, empActorLabel(), { effectiveDate: day });
  return { ok: true, probationEnd: next.probationEnd };
}

/* 老板确认提案 = 写入合同条件新版本 */
function empConfirmContractProposal(id) {
  const e = empById(id);
  if (!e?.contractProposal || e.contractProposal.state !== "pending") return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("confirmProposal")) return { ok: false, code: "permission", message: empDenyReason("confirmProposal") };
  const p = e.contractProposal;
  /* 基线冲突：店长提交提案后，档案又被改过（薪资、工时、入职日）→ 拒绝确认，提案保留待重新提交 */
  if (p.baseline) {
    const baselineData = JSON.stringify(p.baseline.data || {});
    const currentData = JSON.stringify(empContractSnapshot(e.contract || {}));
    if (baselineData !== currentData || String(p.baseline.entryDate || "") !== String(e.entryDate || "")) {
      return { ok: false, code: "stale", message: empT("提交提案后档案已被修改，请让店长按当前条件重新提交。", "Die Akte wurde nach dem Vorschlag geändert — bitte neu einreichen.") };
    }
    /* 只比“今天有效的内容”会漏掉未来版本：老板后加一版 2027 生效的工时，
       旧提案仍能把之后的有效值覆盖回去。这里比最新保存的版本 ID（含未来版本）与版本数。 */
    const versions = empContractVersions(e);
    const latest = empLatestContractVersion(e);
    const latestId = empContractVersionId(latest);
    if ((p.baseline.versionId !== undefined && latestId !== p.baseline.versionId)
      || (p.baseline.versionCount !== undefined && versions.length !== Number(p.baseline.versionCount))) {
      return { ok: false, code: "stale", message: empT("提交提案后又保存了合同版本（含未来生效版本），请让店长按最新版本重新提交。", "Nach dem Vorschlag wurde eine neue Vertragsversion gespeichert — bitte neu einreichen.") };
    }
    /* 旧提案没有版本 ID：只要有比基线更晚保存的版本就按冲突处理 */
    if (p.baseline.versionId === undefined && p.baseline.at && latest?.at && String(latest.at) > String(p.baseline.at)) {
      return { ok: false, code: "stale", message: empT("提交提案后又保存了合同版本，请让店长重新提交。", "Nach dem Vorschlag wurde eine neue Vertragsversion gespeichert.") };
    }
  }
  if (!empValidExpiry(p.validFrom)) return { ok: false, code: "date", message: empT("提案的生效日期无效", "Wirksamkeitsdatum ungültig") };
  if (e.entryDate && p.validFrom < e.entryDate) {
    return { ok: false, code: "before_entry", message: empT(`提案生效日期早于入职日 ${empFormatDate(e.entryDate)}`, `Wirksamkeit vor Eintritt ${empFormatDate(e.entryDate)}`) };
  }
  const next = JSON.parse(JSON.stringify(e));
  const beforeContract = JSON.parse(JSON.stringify(next.contract || {}));
  next.contract = { ...(next.contract || {}), ...(p.data || {}) };
  if (p.data?.notice) next.contract.notice = { ...p.data.notice };
  empPushContractVersion(next, p.validFrom, empActorLabel(), beforeContract);
  empApplyEffectiveContract(next, empToday());
  next.contractProposal = null;
  empLogEvent(next, "contract.confirmed", `生效日期 ${p.validFrom}；提交人 ${p.by}；确认人 ${empActorLabel()}`,
    empActorLabel(), p.validFrom);
  empSaveWithHistory(next, empActorLabel(), { effectiveDate: p.validFrom });
  return { ok: true };
}

function empRejectContractProposal(id, reason) {
  const e = empById(id);
  if (!e?.contractProposal || e.contractProposal.state !== "pending") return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("confirmProposal")) return { ok: false, code: "permission", message: empDenyReason("confirmProposal") };
  const next = JSON.parse(JSON.stringify(e));
  const p = next.contractProposal;
  next.contractProposal = null;
  empLogEvent(next, "contract.rejected", `提交人 ${p.by}；驳回人 ${empActorLabel()}${reason ? "；原因：" + reason : ""}`);
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 办理离职。最后工作日当天及以前仍在岗；店长提交只形成待确认提案（HR-LIFE-12/13、HR-ACCESS-07）。 */
function empSetLeave(id, leave, options = {}) {
  const e = empById(id);
  if (!e) return { ok: false, code: "missing", message: "找不到员工档案" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("offboard")) return { ok: false, code: "permission", message: empDenyReason("offboard") };
  if (!leave || typeof leave !== "object") return { ok: false, code: "input", message: empT("离职记录为空", "Austrittsdaten fehlen") };
  /* 答复 B08：离职不记录“谁提出”。通知日由人来填；默认值只放在表单预填，入口不再兜底（HR-LIFE-13） */
  const noticeDate = String(leave.noticeDate || "").trim();
  if (!empValidExpiry(noticeDate)) return { ok: false, code: "notice", message: empT("请填有效的通知日期", "Gültiges Kündigungsdatum angeben") };
  const lastDay = String(leave.lastDay || "").trim();
  const reason = String(leave.reason || "").trim();
  if (!empValidExpiry(lastDay)) return { ok: false, code: "last_day", message: empT("请填有效的最后工作日", "Gültigen letzten Arbeitstag angeben") };
  if (lastDay < noticeDate) {
    return { ok: false, code: "before_notice", message: empT("最后工作日不得早于通知日（HR-LIFE-13）", "Letzter Arbeitstag darf nicht vor dem Kündigungsdatum liegen (HR-LIFE-13)") };
  }
  /* 答复 B07：页面不再自动算“最早离职日”，最后工作日由老板填；empEarliestLastDay 的算法保留备用，不展示也不校验 */
  const record = {
    noticeDate, lastDay, reason,
    inProbation: empLeaveInProbation(e, noticeDate),
    contractEnd: !!(e.contract?.befristetUntil && lastDay === e.contract.befristetUntil)
  };
  /* 店长：等待老板确认（HR-ACCESS-07） */
  if (!empCan("confirmProposal")) {
    const next = JSON.parse(JSON.stringify(e));
    next.leaveProposal = { state: "pending", at: empNow(), by: empActorLabel(), leave: record };
    empLogEvent(next, "leave.proposal", `最后工作日 ${record.lastDay}`);
    empSaveWithHistory(next);
    return { ok: true, proposal: true };
  }
  return empApplyLeave(id, record);
}

function empApplyLeave(id, record) {
  const e = empById(id);
  if (!e) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  /* 实际写入入口同样要校验权限与记录本身：不能靠调用方先判断（HR-ACCESS-07） */
  if (!empCan("confirmProposal")) return { ok: false, code: "permission", message: empDenyReason("confirmProposal") };
  if (!empValidExpiry(record.noticeDate)) return { ok: false, code: "notice", message: empT("离职记录的通知日期无效", "Kündigungsdatum ungültig") };
  if (!empValidExpiry(record.lastDay)) return { ok: false, code: "last_day", message: empT("离职记录的最后工作日无效", "Letzter Arbeitstag ungültig") };
  if (record.lastDay < record.noticeDate) {
    return { ok: false, code: "before_notice", message: empT("最后工作日不得早于通知日（HR-LIFE-13）", "Letzter Arbeitstag darf nicht vor dem Kündigungsdatum liegen (HR-LIFE-13)") };
  }
  const next = JSON.parse(JSON.stringify(e));
  next.leave = record;
  empNormalizeStatus(next);
  empLogEvent(next, "leave",
    `通知日 ${record.noticeDate} · 最后工作日 ${record.lastDay}${record.reason ? " · 原因：" + record.reason : ""}`,
    empActorLabel(), record.lastDay);
  empSaveWithHistory(next, empActorLabel(), { effectiveDate: record.lastDay });
  return { ok: true };
}

function empConfirmLeaveProposal(id) {
  const e = empById(id);
  if (!e?.leaveProposal || e.leaveProposal.state !== "pending") return { ok: false, code: "missing" };
  if (!empCan("confirmProposal")) return { ok: false, code: "permission", message: empDenyReason("confirmProposal") };
  const p = e.leaveProposal;
  const result = empApplyLeave(id, p.leave);
  if (!result.ok) return result;
  const fresh = empById(id);
  fresh.leaveProposal = null;
  empLogEvent(fresh, "leave.confirmed", `提交人 ${p.by}；确认人 ${empActorLabel()}`, empActorLabel(), p.leave.lastDay);
  empSaveStaff(fresh);
  return { ok: true };
}

function empRejectLeaveProposal(id, reason) {
  const e = empById(id);
  if (!e?.leaveProposal || e.leaveProposal.state !== "pending") return { ok: false, code: "missing" };
  if (!empCan("confirmProposal")) return { ok: false, code: "permission", message: empDenyReason("confirmProposal") };
  const next = JSON.parse(JSON.stringify(e));
  const p = next.leaveProposal;
  next.leaveProposal = null;
  empLogEvent(next, "leave.rejected", `提交人 ${p.by}；驳回人 ${empActorLabel()}${reason ? "；原因：" + reason : ""}`);
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 误操作可以撤销；撤销必须写原因（HR-LIFE-29）。账号已关闭时提示去成员与权限重开（HR-LIFE-31）。 */
function empUndoLeave(id, reason) {
  const e = empById(id);
  if (!e?.leave) return { ok: false, code: "missing", message: "没有可撤销的离职记录" };
  const note = String(reason || "").trim();
  if (!note) return { ok: false, code: "reason_required", message: empT("撤销离职必须写原因", "Begründung erforderlich") };
  const accountClosed = empAccountState(e) === "disabled";
  const next = JSON.parse(JSON.stringify(e));
  next.leave = null;
  empNormalizeStatus(next);
  empLogEvent(next, "leave.undo", note + (accountClosed ? "（账号已关闭，需到成员与权限重新开通）" : ""));
  empSaveWithHistory(next);
  return { ok: true, accountClosed };
}

/* 门店 → 公司（HR-ORG-02）。优先读合规设置里的公司资料；演示数据没填公司名时，
   用两家演示公司兜底，这样“跨公司调店”在原型里是看得见的。 */
function empCompanyOfStore(store) {
  const info = (typeof empEmployer === "function" ? empEmployer(store) : null) || {};
  if (info.company) return String(info.company);
  if (info.legalName && info.legalName !== store) return String(info.legalName);
  return /cafe/i.test(String(store || "")) ? "Martin Cafe GmbH" : "Martin Gastro GmbH";
}

/* 员工编号按“雇主内的人”唯一（HR-CONTRACT-17） */
/* 重聘链：第三段沿用第二段编号时，要能追溯到第一段属于同一个人（HR-LIFE-32） */
function empEmploymentChain(e) {
  const list = empAllStaff();
  const byId = new Map(list.map(x => [x.id, x]));
  const ids = new Set([e?.id].filter(Boolean));
  const queue = [e].filter(Boolean);
  while (queue.length) {
    const cur = queue.shift();
    const linked = new Set();
    if (cur.rehireOf) linked.add(cur.rehireOf);
    if (cur.rehiredBy) linked.add(cur.rehiredBy);
    list.forEach(x => {
      if (x.rehireOf === cur.id) linked.add(x.id);
      if (x.rehiredBy === cur.id) linked.add(x.id);
    });
    linked.forEach(id => {
      if (!id || ids.has(id)) return;
      ids.add(id);
      const node = byId.get(id);
      if (node) queue.push(node);
    });
  }
  return ids;
}

function empEmployeeNoConflict(e, employeeNo) {
  const no = String(employeeNo || "").trim();
  if (!no || !e) return null;
  const company = empCompanyOfStore(e.store);
  const chain = empEmploymentChain(e);
  return empAllStaff().find(other => other.id !== e.id
    && !chain.has(other.id)
    && String(other.employeeNo || "").trim() === no
    && empCompanyOfStore(other.store) === company) || null;
}

/* 调店（HR-ORG-20～27）：
   · 生效日期必填，默认今天；不得早于入职日、不得早于上次调店日、不能是将来
   · 新旧门店属于不同公司时拒绝，要办离职并新建入职（★1.5）
   · 调店只动档案；平台账号门店不自动改，页面提示去“成员与权限”调整 */
function empTransferStore(id, store, effectiveDate) {
  const e = empById(id);
  if (!e) return { ok: false, code: "missing", message: "找不到员工档案" };
  if (!empCan("ownerOnly")) {
    return { ok: false, code: "permission", message: empDenyReason("ownerOnly") || "只有老板和管理员可以调店" };
  }
  if (!store) return { ok: false, code: "store", message: "请选择新门店" };
  if (store === e.store) return { ok: false, code: "same", message: "新门店和当前门店相同" };
  if (!effectiveDate) return { ok: false, code: "date", message: "请填生效日期" };
  if (!empValidExpiry(effectiveDate)) return { ok: false, code: "date", message: "生效日期不合法" };
  if (effectiveDate > empToday()) return { ok: false, code: "future", message: "一期不支持未来生效的调店" };
  if (e.entryDate && effectiveDate < e.entryDate) {
    return { ok: false, code: "before_entry", message: `生效日期不能早于入职日 ${empFormatDate(e.entryDate)}` };
  }
  const last = [...(e.transfers || [])].sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)))[0];
  if (last?.effectiveDate && effectiveDate < last.effectiveDate) {
    return { ok: false, code: "before_last", message: `生效日期不能早于上次调店日 ${empFormatDate(last.effectiveDate)}` };
  }
  if (empCompanyOfStore(e.store) !== empCompanyOfStore(store)) {
    return { ok: false, code: "company", message: "跨公司调动请办离职并新建入职" };
  }
  const next = JSON.parse(JSON.stringify(e));
  /* 账号门店停在调店前的门店；平台账号不随 HR 调店自动改 */
  if (next.account && !next.account.store) next.account.store = e.store;
  next.transfers = [...(next.transfers || []), {
    from: e.store, to: store, effectiveDate, at: empNow(), by: empActorLabel()
  }];
  next.lastTransferDate = effectiveDate;
  next.store = store;
  empSaveWithHistory(next, empActorLabel(), { effectiveDate });
  return { ok: true, previousStore: e.store, accountStore: empAccountStore(next) };
}

/* 最早的最后工作日：通知日 + 通知期。试用期内的通知期短得多，所以要分开算。
   返回 { weeks, earliest, source } —— source 说明这个数是哪来的，别让人以为是系统算的法规。 */
function empEarliestLastDay(e, noticeDate, who) {
  /* 只有员工/公司/协商三种才受通知期约束；合同到期按到期日本身（HR-LIFE-15/16） */
  const inProbation = empLeaveInProbation(e, noticeDate);
  if (who === "contractEnd" && e.contract?.befristetUntil) {
    return { inProbation, weeks: null, earliest: e.contract.befristetUntil,
             source: empRaw({ zh: `定期合同到期日 ${e.contract.befristetUntil}`, de: `Befristung bis ${e.contract.befristetUntil}` }) };
  }
  const notice = empNoticeStruct(e.contract);
  const contractEarliest = notice.format === "struct" && Number(notice.count) > 0
    ? empNoticeEarliestDate(noticeDate, notice) : "";
  if (inProbation) {
    const weeks = Number(empRule("probationNoticeWeeks")) || 2;
    const probationEarliest = empShiftDate(noticeDate, weeks * 7);
    /* 试用期也有“约定长于法定”的情形：合同写了 4 周就不能只给 2 周（HR-LIFE-15） */
    if (contractEarliest && contractEarliest > probationEarliest) {
      return { inProbation, weeks: notice.unit === "weeks" ? notice.count : null, earliest: contractEarliest,
               source: empRaw({ zh: `试用期内按合同通知期 ${empNoticeText(notice)}（长于试用期默认 ${weeks} 周）`, de: `In der Probezeit gilt die vertragliche Frist ${empNoticeText(notice)} (länger als ${weeks} Wochen)` }) };
    }
    return { inProbation, weeks, earliest: probationEarliest,
             source: empRaw({ zh: `试用期内通知期 ${weeks} 周（合规设置里可改）`, de: `Kündigungsfrist in der Probezeit: ${weeks} Wochen (änderbar)` }) };
  }
  if (notice.format === "struct" && Number(notice.count) > 0) {
    return { inProbation, weeks: notice.unit === "weeks" ? notice.count : null,
             earliest: contractEarliest,
             source: empRaw({ zh: `合同通知期：${empNoticeText(notice)}`, de: `Laut Vertrag: ${empNoticeText(notice)}` }) };
  }
  return { inProbation, weeks: null, earliest: "",
           source: empRaw({ zh: `合同约定：${e.contract?.noticePeriod || "未填，请自行确认最后工作日"}`,
                            de: `Laut Vertrag: ${e.contract?.noticePeriod || "nicht erfasst — bitte selbst prüfen"}` }) };
}

/* ============================================================ 全站汇总 ===== */
/* 只放确实有人读的字段 —— HACCP 那次 haccpSummary 从 11 个砍到 3 个的教训。 */
function empSummary(store, today) {
  const day = today || empToday();
  const onDuty = empStaff(store);
  const alerts = empAlerts(store, day);
  const pendingPeople = empPendingPeople(store, day);
  const soonPeople = empSoonEntries(store, day);
  return {
    headcount: onDuty.length,
    probation: onDuty.filter(e => e.status === "probation").length,
    invited: empRosterVisible(store).filter(e => e.status === "invited").length,
    pending: empRoster(store).filter(e => e.status === "pending" && !empStatusHidden(e)).length,
    /* 员工已提交、等店长审核的 —— 卡在这一步不动就等于新人上不了岗 */
    review: empInvites(store).filter(e => e.invite.state === "submitted").length,
    /* 首页和列表都数人，不数事项条数（HR-TODO-50/51） */
    urgentPeople: pendingPeople.length,
    soonPeople: soonPeople.length,
    /* 兼容旧调用：事项条数 */
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
  { id: "approved", tone: "green", name: { zh: "已通过", de: "Freigegeben" } },
  { id: "revoked", tone: "gray", name: { zh: "已撤销", de: "Zurückgezogen" } },
  { id: "cancelled", tone: "gray", name: { zh: "已取消入职", de: "Einstellung abgesagt" } }
];

function empInviteState(id) {
  return EMP_INVITE_STATES.find(s => s.id === id) || EMP_INVITE_STATES[0];
}

/* 入职列表的范围：已建档一直到已归档，撤销和取消作为旁支也留着记录（HR-ONB-02、HR-ONB-45/46）。 */
function empInvites(store) {
  return empRoster(store).filter(e => e.invite);
}

/* 入职卡在哪一步。状态本身只记流程状态，合同发出/签回/归档按 invite 上的时间点推。 */
function empInviteStep(e) {
  const inv = e.invite || {};
  if (inv.state === "revoked") return { id: "revoked", tone: "gray", name: { zh: "已撤销", de: "Zurückgezogen" } };
  if (inv.state === "cancelled") return { id: "cancelled", tone: "gray", name: { zh: "已取消入职", de: "Einstellung abgesagt" } };
  if (inv.state === "draft") return { id: "draft", tone: "gray", name: { zh: "已建档，未发邀请", de: "Angelegt, nicht gesendet" } };
  if (inv.state === "sent") return { id: "fill", tone: "blue", name: { zh: "等员工填写", de: "Wartet auf Mitarbeiter" } };
  if (inv.state === "submitted") return { id: "review", tone: "orange", name: { zh: "待审核", de: "Zur Prüfung" } };
  if (inv.state === "returned") return { id: "returned", tone: "red", name: { zh: "已退回，等员工重提", de: "Zurück, wartet auf erneute Abgabe" } };
  if (inv.state === "approved") {
    if (empContractArchived(e) || inv.archivedAt) return { id: "done", tone: "green", name: { zh: "已归档", de: "Abgelegt" } };
    if (inv.contractSignedSubmittedAt) return { id: "archive", tone: "orange", name: { zh: "待核对归档", de: "Prüfung der Unterschriften" } };
    if (inv.contractSentAt) {
      const returned = ["contract", "questionnaire"].some(k => (inv.contractReview || {})[k]?.state === "returned");
      if (returned) return { id: "sign", tone: "red", name: { zh: "已退回一份，等员工重传", de: "Eine Datei zurückgegeben" } };
      return { id: "sign", tone: "blue", name: { zh: "待员工签回", de: "Wartet auf Unterschrift" } };
    }
    return { id: "contract", tone: "green", name: { zh: "已通过，待发合同", de: "Freigegeben, Versand offen" } };
  }
  return { id: "fill", tone: "blue", name: { zh: "等员工填写", de: "Wartet auf Mitarbeiter" } };
}

/* 邀请子状态（HR-ONB-01、HR-ACCESS-53）：发送失败 / 已过期 / 已接受，绑定中 / 已撤销。 */
function empInviteSendResult(inv) {
  const map = {
    sent: { id: "sent", tone: "green", name: { zh: "已发送", de: "Gesendet" } },
    failed: { id: "failed", tone: "red", name: { zh: "发送失败", de: "Versand fehlgeschlagen" } },
    skipped: { id: "skipped", tone: "gray", name: { zh: "跳过", de: "Übersprungen" } },
    unconfirmed: { id: "unconfirmed", tone: "orange", name: { zh: "未确认", de: "Unbestätigt" } }
  };
  if (inv?.sendResult && map[inv.sendResult]) return map[inv.sendResult];
  if (inv?.state === "draft") return { id: "none", tone: "gray", name: { zh: "还没发送", de: "Noch nicht gesendet" } };
  return map.sent;
}

function empInviteSentAt(inv) {
  return inv?.firstSentAt || inv?.sentAt || "";
}

function empInviteExpiresAt(inv) {
  if (!inv) return "";
  if (inv.expiresAt) return inv.expiresAt;
  const base = inv.sentAt || inv.firstSentAt;
  return base ? `${empShiftDate(String(base).slice(0, 10), 7)}T${String(base).slice(11, 19) || "09:00:00"}` : "";
}

function empInviteDaysLeft(inv, today) {
  const until = empInviteExpiresAt(inv);
  if (!until) return null;
  return empDaysBetween(today || empToday(), String(until).slice(0, 10));
}

function empInviteAccepted(e) {
  const state = e?.account?.state;
  if (["accepted", "pending_link", "active"].includes(state)) return true;
  /* 员工用过链接（提交或退回）就说明已经接受邀请，重发/撤销都不再适用（HR-ACCESS-53）。 */
  return ["submitted", "returned", "approved"].includes(e?.invite?.state);
}

/* 完整到期时间判断：到期当天过了具体时刻也算过期（HR-ACCESS-25）。
   员工端 employee-ui.js 的 euInvitation 也要调用这个函数，不要只比日期。 */
function empInviteExpiredAt(e, nowIso) {
  const inv = e?.invite;
  if (!inv) return false;
  if (empInviteAccepted(e)) return false;
  const until = empInviteExpiresAt(inv);
  if (!until) return false;
  const end = new Date(until);
  if (Number.isNaN(end.getTime())) return false;
  const now = new Date(nowIso || empNow());
  if (Number.isNaN(now.getTime())) return false;
  return now.getTime() > end.getTime();
}

/* 列表/按钮按“天”判断：到期日当天仍显示有效，次日起才标已过期 */
function empInviteExpired(e, today) {
  const inv = e?.invite;
  if (!inv || inv.state !== "sent") return false;
  if (empInviteAccepted(e)) return false;
  if (today) {
    const until = empInviteExpiresAt(inv);
    return !!until && String(until).slice(0, 10) < today;
  }
  return empInviteExpiredAt(e);
}

function empInviteSubStates(e, today) {
  const inv = e.invite || {};
  const out = [];
  const send = empInviteSendResult(inv);
  if (send.id === "failed" || send.id === "unconfirmed") out.push(send);
  if (empInviteExpired(e, today)) out.push({ id: "expired", tone: "red", name: { zh: "已过期", de: "Abgelaufen" } });
  if (inv.state === "revoked") out.push({ id: "revoked", tone: "gray", name: { zh: "已撤销", de: "Zurückgezogen" } });
  else if (inv.state === "cancelled") out.push({ id: "cancelled", tone: "gray", name: { zh: "已取消入职", de: "Einstellung abgesagt" } });
  else if (["accepted", "pending_link"].includes(e.account?.state) && inv.state !== "approved") {
    out.push({ id: "accepted", tone: "blue", name: { zh: "已接受，绑定中", de: "Angenommen, Verknüpfung" } });
  }
  return out;
}

function empInviteResendToday(inv, today) {
  const day = today || empToday();
  /* “重发结果未确认”允许再次重发；确认成功的重发才占用当天次数（HR-ACCESS-24/57）。 */
  return (inv?.resendLog || []).some(x => String(x.at || "").slice(0, 10) === day && x.result !== "unconfirmed");
}

/* 同一邮箱已有待接受邀请时先拦住，避免第二条邀请（HR-ACCESS-23）。 */
function empInviteEmailConflict(email, excludeId) {
  const mail = String(email || "").trim().toLowerCase();
  if (!mail) return null;
  const hit = empAllStaff().find(e => {
    if (e.id === excludeId) return false;
    if (String(e.contact?.email || "").trim().toLowerCase() !== mail) return false;
    const inv = e.invite || {};
    if (inv.state === "revoked" || inv.state === "cancelled") return false;
    return true;
  });
  if (!hit) return null;
  const pending = ["draft", "sent"].includes(hit.invite?.state) && !empInviteAccepted(hit);
  return {
    id: hit.id,
    pending,
    message: pending
      ? empT(`这个邮箱已有一条待接受的邀请（${hit.name}），先处理那条，不要重复建档。`, `Für diese E-Mail besteht bereits eine offene Einladung (${hit.name}).`)
      : empT(`这个邮箱已被档案 ${hit.name} 使用。同一邮箱不能建两份档案。`, `Diese E-Mail wird bereits von ${hit.name} verwendet.`)
  };
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
  return `#${e.invite.portalVersion===2?"employee-ui":"onboarding"}?t=${encodeURIComponent(e.invite.token)}`;
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

function empGetPath(obj, path) {
  return path.split(".").reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}

/* ==================================================== 入职必填三层 =======
   HR-ONB-26～29：提交层 / 第一个上班日前 / 可以之后补。提交校验、审核页、
   列表进度、退回标记都读同一份清单，页面不再各列一套。
   员工提交时读冻结快照；审核通过后读正式档案。 */
const EMP_ONB_LAYER_NAMES = {
  1: { zh: "提交时必须有", de: "Pflicht bei Abgabe" },
  2: { zh: "第一个上班日前必须有", de: "Pflicht vor dem ersten Arbeitstag" },
  3: { zh: "可以之后补", de: "Später nachreichbar" }
};

const EMP_ONB_DOC_LABELS = {
  id: { zh: "护照 / 身份证", de: "Reisepass / Personalausweis" },
  residence: { zh: "居留许可", de: "Aufenthaltstitel" },
  zusatz: { zh: "附加页（Zusatzblatt）", de: "Zusatzblatt" },
  student: { zh: "在读证明", de: "Immatrikulationsbescheinigung" },
  bankFront: { zh: "银行卡正面照片", de: "Bankkarte Vorderseite" },
  healthFront: { zh: "医保卡正面照片", de: "Krankenkarte Vorderseite" },
  healthBack: { zh: "医保卡反面照片", de: "Krankenkarte Rückseite" },
  belehrung: { zh: "食品卫生指导证明（健康证首次证明）", de: "Erstbelehrung nach §43 IfSG" }
};

/* 退回项要用员工端认识的证件键（passport/visa/hygiene…），否则员工端标不出被退回的证件。 */
const EMP_DOC_PORTAL_KEYS = {
  id: "passport", residence: "visa", zusatz: "zusatz", student: "student",
  bankFront: "bankFront", healthFront: "healthFront", healthBack: "healthBack", belehrung: "hygiene"
};

/* 员工提交的版本和正式档案分开看：审核只看最后一版，预览永远不带草稿值（HR-ONB-15/55）。 */
function empMergeDeep(base, patch) {
  const out = { ...(base || {}) };
  Object.entries(patch || {}).forEach(([key, value]) => {
    out[key] = value && typeof value === "object" && !Array.isArray(value)
      ? empMergeDeep(out[key], value) : value;
  });
  return out;
}

/* 草稿与提交快照分开：员工改到一半，审核区和预览不能跟着变（HR-ONB-15/16/55） */
function empInviteDraftData(inv) {
  return empMergeDeep(inv?.submitted || {}, inv?.draft || {});
}

function empInviteView(e, force) {
  const inv = e?.invite || {};
  const sub = force === "draft" ? empInviteDraftData(inv) : (inv.submitted || {});
  const useSub = force === "draft" || force === "submitted" || (!force && ["submitted", "returned"].includes(inv.state));
  if (useSub) {
    const p = sub.profile || {};
    return {
      source: force === "draft" ? "draft" : "submitted",
      name: sub.name || "",
      birthday: sub.birthday || p.birthday || "",
      contact: sub.contact || {},
      ids: sub.ids || {},
      profile: p,
      docs: sub.docs || {},
      nationality: sub.contract?.nationalityClass ?? p.nationalityClass ?? "",
      student: typeof sub.contract?.isStudent === "boolean" ? (sub.contract.isStudent ? "yes" : "no") : (p.student || ""),
      zusatz: empZusatzValue(e)
    };
  }
  return {
    source: "formal",
    name: e?.name || "",
    birthday: e?.birthday || "",
    contact: e?.contact || {},
    ids: e?.ids || {},
    profile: {},
    docs: e?.docs || {},
    nationality: empNationalityClass(e),
    student: empStudentAnswered(e) ? (empStudentValue(e) ? "yes" : "no") : "",
    zusatz: empZusatzValue(e)
  };
}

function empOnbDocOk(docs, id) {
  const doc = docs?.[id];
  return !!(doc && doc.state === "ok" && doc.file);
}

/* 员工端材料清单的组合表：国籍、学生、附加页决定要哪几份（HR-DOC-02/06/07/09）。 */
function empOnbDocList(v) {
  if (!v.nationality) return [];
  const list = [{ id: "id", layer: 1 }];
  if (v.nationality === "other") list.push({ id: "residence", layer: 1 });
  if (v.nationality === "other" && v.zusatz === "yes") list.push({ id: "zusatz", layer: 1 });
  if (v.student === "yes") list.push({ id: "student", layer: 1 });
  list.push({ id: "bankFront", layer: 1 });
  list.push({ id: "belehrung", layer: 2 });
  list.push({ id: "healthFront", layer: 3 });
  list.push({ id: "healthBack", layer: 3 });
  return list;
}

function empOnbItems(e, force) {
  const v = empInviteView(e, force);
  const items = [];
  const push = (key, label, layer, done, extra = {}) =>
    items.push({ key, label, layer, done: !!done, type: extra.type || "field", special: !!extra.special, doc: extra.doc || "" });
  push("nationality", { zh: "国籍类别", de: "Staatsangehörigkeit" }, 1, !!v.nationality);
  push("student", { zh: "是否学生", de: "Studierend" }, 1, v.student === "yes" || v.student === "no");
  push("name", { zh: "姓名", de: "Name" }, 1, !!String(v.name || "").trim());
  push("birthday", { zh: "出生日期", de: "Geburtsdatum" }, 1, !!v.birthday);
  push("address", { zh: "地址", de: "Anschrift" }, 1,
    !!(v.contact.street && v.contact.houseNo && v.contact.zip && v.contact.city));
  push("iban", { zh: "IBAN", de: "IBAN" }, 1, !!v.ids.iban);
  empOnbDocList(v).forEach(t => push(EMP_DOC_PORTAL_KEYS[t.id] || t.id, EMP_ONB_DOC_LABELS[t.id] || empDocType(t.id).name, t.layer,
    empOnbDocOk(v.docs, t.id), { type: "doc", doc: t.id }));
  push("rentenversicherung", { zh: "Sozialversicherungsnummer（社会保险号）", de: "Sozialversicherungsnummer" }, 2,
    !!v.ids.rentenversicherung, { special: true });
  push("contract", { zh: "签好的劳动合同与个人问卷", de: "Unterschriebener Vertrag und Fragebogen" }, 2,
    empContractArchived(e), { type: "doc" });
  push("steuerId", { zh: "Steuer-ID（个人税务识别号）", de: "Steuer-ID" }, 3,
    !!(v.ids.steuerId || v.ids.steuernummer), { special: true });
  push("krankenkasse", { zh: "医保公司", de: "Krankenkasse" }, 3, !!v.contact.krankenkasse, { special: true });
  push("healthCardNumber", { zh: "医保卡号", de: "Krankenversichertennummer" }, 3, !!v.ids.healthCardNumber, { special: true });
  return items;
}

function empOnbLayerProgress(e, force) {
  const items = empOnbItems(e, force);
  const out = {};
  [1, 2, 3].forEach(layer => {
    const list = items.filter(x => x.layer === layer);
    out[layer] = { done: list.filter(x => x.done).length, total: list.length };
  });
  return out;
}

/* 兼容原来的调用：total/done/missing 指第一层（提交时必须有）。 */
function empInviteProgress(e) {
  /* 还没提交时只看草稿的完成度（不展示草稿值）；已提交后看冻结的提交版本；
     通过后看正式档案（公司代填/老员工没有提交版本）。
     员工端保存草稿时只发布各层“已填/总数”（invite.draftProgress），老板端据此显示，不读草稿值。 */
  const state = e?.invite?.state;
  const published = e?.invite?.draftProgress?.layers;
  if (published && ["draft", "sent", "returned"].includes(state) && published[1]) {
    const layers = { 1: { ...published[1] }, 2: { ...(published[2] || { done: 0, total: 0 }) }, 3: { ...(published[3] || { done: 0, total: 0 }) } };
    return { total: layers[1].total, done: layers[1].done, missing: [], complete: layers[1].done >= layers[1].total, layers };
  }
  const force = state === "approved" ? undefined
    : (state === "draft" || state === "sent") ? (e.invite.draft ? "draft" : "submitted")
    : "submitted";
  return empInviteItemsProgress(e, force);
}

/* 员工自填页自己的进度：退回后继续改草稿，也要按草稿实时算，不能拿旧提交版挡提交。 */
function empInviteFillProgress(e) {
  return empInviteItemsProgress(e, "draft");
}

function empInviteItemsProgress(e, force) {
  const items = empOnbItems(e, force);
  const layer1 = items.filter(x => x.layer === 1);
  const missing = layer1.filter(x => !x.done).map(x => ({ kind: x.type, name: x.label, path: x.key, doc: x.doc }));
  return {
    total: layer1.length,
    done: layer1.length - missing.length,
    missing,
    complete: missing.length === 0,
    layers: empOnbLayerProgress(e, force)
  };
}

function empLayerCountsText(layers) {
  return `1 层 ${layers[1].done}/${layers[1].total} · 2 层 ${layers[2].done}/${layers[2].total} · 3 层 ${layers[3].done}/${layers[3].total}`;
}

/* 邀请邮件固定为中德英三语通用信，不能自选语言、不能写材料清单（HR-ACCESS-25 ★6.8）。 */
function empInviteMail(e) {
  const link = empInviteLink(e);
  const subject = `${e.store}: 请填写入职资料 / Bitte Einstellungsunterlagen ausfüllen / Please complete your onboarding`;
  const body = [
    `您好${e.name ? " " + e.name : ""}，`,
    `欢迎加入 ${e.store}。请打开下面的链接，设置密码后填写入职资料：`,
    link,
    "链接 7 天内有效。打开后第一屏会列出你需要准备哪些材料；有问题请直接回复这封邮件。",
    "——",
    `Hallo${e.name ? " " + e.name : ""},`,
    `willkommen bei ${e.store}. Bitte öffnen Sie den folgenden Link, legen Sie ein Passwort fest und füllen Sie Ihre Angaben aus:`,
    link,
    "Der Link ist 7 Tage gültig. Auf der ersten Seite sehen Sie, welche Unterlagen Sie brauchen.",
    "——",
    `Hello${e.name ? " " + e.name : ""},`,
    `welcome to ${e.store}. Please open the link below, set a password and complete your onboarding details:`,
    link,
    "The link is valid for 7 days. The first screen lists the documents you need."
  ].join("\n");
  return { subject, body, fixed: true };
}

/* ------------------------------------------------------------ 状态迁移 --- */
function empInviteExpiryFrom(iso) {
  const day = String(iso || empNow()).slice(0, 10);
  const time = String(iso || "").slice(11, 19) || "09:00:00";
  return `${empShiftDate(day, 7)}T${time}`;
}

function empSendInvite(id, opts) {
  const e = empById(id);
  if (!e || !e.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("invite")) return { ok: false, code: "permission", message: empDenyReason("invite") };
  const resend = !!(opts && opts.resend);
  /* 首次发送只允许“已建档、未发送”；其它状态一律走重发校验（HR-ACCESS-24/53） */
  if (!resend && e.invite.state !== "draft") {
    return { ok: false, code: "state", message: empT("这条邀请已经发过；需要再发请用“重新发送”。", "Bereits gesendet — bitte „erneut senden“ verwenden.") };
  }
  if (["submitted", "approved", "revoked", "cancelled"].includes(e.invite.state)) {
    return { ok: false, code: "state", message: empT("这个状态不能再发邀请", "In diesem Status nicht möglich") };
  }
  if (empInviteAccepted(e)) {
    return { ok: false, code: "accepted", message: empT("员工已接受邀请，重发按钮不可用；进度不变。", "Einladung bereits angenommen.") };
  }
  if (resend) {
    if (empInviteResendToday(e.invite)) return { ok: false, code: "daily_limit", message: empT("这个员工今天已经重发过一次，明天再发（HR-ACCESS-24）。", "Heute bereits einmal erneut gesendet (HR-ACCESS-24).") };
  } else if (empInviteResendToday(e.invite)) {
    return { ok: false, code: "daily_limit", message: empT("这个员工今天已经发过一次，明天再发（HR-ACCESS-24）。", "Heute bereits gesendet (HR-ACCESS-24).") };
  }
  const email = String(e.contact?.email || "").trim();
  if (!email) return { ok: false, code: "email", message: empT("需要先填邮箱才能发邀请", "Zuerst E-Mail eintragen") };
  const conflict = empInviteEmailConflict(email, e.id);
  if (conflict) return { ok: false, code: "conflict", message: conflict.message };
  const next = JSON.parse(JSON.stringify(e));
  const inv = next.invite;
  if (inv.token) {
    inv.previousInvites = [{ token: inv.token, createdAt: inv.createdAt, sentAt: inv.sentAt, state: inv.state, replacedAt: empNow() },
      ...(inv.previousInvites || [])];
  }
  inv.token = empToken();
  inv.state = "sent";
  inv.sentAt = empNow();
  inv.firstSentAt = inv.firstSentAt || inv.sentAt;
  inv.expiresAt = empInviteExpiryFrom(inv.sentAt);
  inv.sendResult = "sent";
  inv.sendResultAt = inv.sentAt;
  if (resend) {
    inv.reminders = [...(inv.reminders || []), { at: inv.sentAt, kind: "resend" }];
    inv.resendLog = [...(inv.resendLog || []), { at: inv.sentAt, kind: "resend", result: "sent" }];
  }
  next.account = {
    ...(next.account || {}), state: "invited", user: email, email, store: next.store,
    invitedAt: next.account?.invitedAt || inv.sentAt, lastSentAt: inv.sentAt,
    sentCount: (Number(next.account?.sentCount) || 0) + 1
  };
  empLogEvent(next, resend ? "invite.resend" : "invite.sent",
    resend ? empT("重发：换新链接，旧链接失效，进度不变", "Erneut gesendet: neuer Link, alter ungültig") : empT("邀请邮件已发送", "Einladung gesendet"),
    empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 已建档还没发邀请时补邮箱；一旦有未接受的邀请，邮箱就锁住（HR-ACCESS-27/31）。 */
function empSetInviteEmail(id, email) {
  const e = empById(id);
  if (!e || !e.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("invite")) return { ok: false, code: "permission", message: empDenyReason("invite") };
  const canEdit = e.invite.state === "draft" || (e.invite.state === "sent" && empInviteExpired(e));
  if (!canEdit) return { ok: false, code: "state", message: empT("已有未过期的邀请，邮箱不能直接改；撤销后可换邮箱重新邀请。", "E-Mail bei offener Einladung gesperrt.") };
  const mail = String(email || "").trim();
  if (!mail) return { ok: false, code: "email", message: empT("请填邮箱", "Bitte E-Mail eingeben") };
  const conflict = empInviteEmailConflict(mail, e.id);
  if (conflict) return { ok: false, code: "conflict", message: conflict.message };
  const next = JSON.parse(JSON.stringify(e));
  next.contact = { ...(next.contact || {}), email: mail };
  if (next.account) next.account = { ...next.account, email: mail, user: mail };
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 重新发送和催一下是同一个动作：同一封邮件换新链接，旧链接立即失效（HR-ACCESS-24）。 */
function empResendInvite(id) {
  return empSendInvite(id, { resend: true });
}

/* 撤销不再删档案：标“已撤销”、写原因、记录保留，之后可换邮箱重新邀请（HR-ONB-45）。 */
function empRevokeInvite(id, reason) {
  const e = empById(id);
  if (!e || !e.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("invite")) return { ok: false, code: "permission", message: empDenyReason("invite") };
  if (e.invite.state === "draft") return { ok: false, code: "state", message: empT("还没发邀请，不需要撤销。", "Noch nicht gesendet — kein Zurückziehen nötig.") };
  if (["approved", "cancelled", "revoked"].includes(e.invite.state) || ["done", "archive", "sign", "contract"].includes(empInviteStep(e).id)) {
    return { ok: false, code: "approved", message: empT("审核已通过，不能撤销；要结束入职请用“取消入职”。", "Nach Freigabe nur „Einstellung absagen“.") };
  }
  const note = String(reason || "").trim();
  if (!note) return { ok: false, code: "reason", message: empT("撤销必须写原因", "Begründung nötig") };
  if (empInviteAccepted(e)) {
    return { ok: false, code: "accepted", message: empT("员工已接受邀请，不能撤销。", "Einladung bereits angenommen.") };
  }
  const next = JSON.parse(JSON.stringify(e));
  const inv = next.invite;
  inv.previousInvites = [{ token: inv.token, createdAt: inv.createdAt, sentAt: inv.sentAt, state: inv.state, revokedAt: empNow() },
    ...(inv.previousInvites || [])];
  inv.state = "revoked";
  inv.token = "";
  inv.revokeReason = note;
  inv.revokedAt = empNow();
  inv.revokedBy = empActorLabel();
  next.account = { ...(next.account || {}), state: "revoked", revokedAt: inv.revokedAt };
  empLogEvent(next, "invite.revoked", note, empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 撤销后重新邀请：新建一条平台邀请，旧邀请保留；有未接受的邀请时邮箱不能改（HR-ACCESS-27）。 */
function empReinvite(id, email) {
  const e = empById(id);
  if (!e || !e.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("invite")) return { ok: false, code: "permission", message: empDenyReason("invite") };
  if (e.invite.state !== "revoked") return { ok: false, code: "state", message: empT("只有已撤销的邀请可以重新邀请", "Nur zurückgezogene Einladungen") };
  const nextMail = String(email || e.contact?.email || "").trim();
  if (!nextMail) return { ok: false, code: "email", message: empT("需要先填邮箱", "E-Mail fehlt") };
  const conflict = empInviteEmailConflict(nextMail, e.id);
  if (conflict) return { ok: false, code: "conflict", message: conflict.message };
  const next = JSON.parse(JSON.stringify(e));
  next.contact = { ...(next.contact || {}), email: nextMail };
  const inv = next.invite;
  inv.token = empToken();
  inv.state = "sent";
  inv.sentAt = empNow();
  inv.firstSentAt = inv.sentAt;
  inv.expiresAt = empInviteExpiryFrom(inv.sentAt);
  inv.sendResult = "sent";
  inv.sendResultAt = inv.sentAt;
  inv.reinvitedAt = inv.sentAt;
  inv.reinviteFrom = inv.revokedAt || "";
  inv.revokeReason = "";
  inv.revokedAt = null;
  next.account = {
    ...(next.account || {}), state: "invited", user: nextMail, email: nextMail, store: next.store,
    invitedAt: inv.sentAt, lastSentAt: inv.sentAt, sentCount: (Number(next.account?.sentCount) || 0) + 1
  };
  empLogEvent(next, "invite.reinvited", empT(`重新邀请到 ${nextMail}`, `Erneut eingeladen: ${nextMail}`), empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 审核通过后不再撤销，改走“取消入职”；已经上过班的走离职（HR-ONB-46）。 */
function empCancelOnboarding(id, reason) {
  const e = empById(id);
  if (!e || !e.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("invite")) return { ok: false, code: "permission", message: empDenyReason("invite") };
  const note = String(reason || "").trim();
  if (!note) return { ok: false, code: "reason", message: empT("取消入职必须写原因", "Begründung nötig") };
  if (e.invite.state !== "approved") return { ok: false, code: "state", message: empT("只有审核已通过的入职可以取消", "Nur freigegebene Einstellungen") };
  if (e.leave || (e.entryDate && e.entryDate < empToday())) {
    return { ok: false, code: "worked", message: empT("已经上过班的人不能取消入职，请办理离职。", "Bereits gearbeitet — bitte Austritt erfassen.") };
  }
  const next = JSON.parse(JSON.stringify(e));
  next.invite.state = "cancelled";
  next.invite.token = "";
  next.invite.cancelReason = note;
  next.invite.cancelledAt = empNow();
  next.invite.cancelledBy = empActorLabel();
  /* 取消入职只结束入职流程，不擅自关闭平台账号；账号由“成员与权限”单独处理（HR-ONB-46、HR-ACCESS-40） */
  next.status = "invited";
  if (next.account) next.account = { ...next.account, cancelledAt: next.invite.cancelledAt };
  empLogEvent(next, "onboarding.cancelled", note, empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 员工提交。只接受还在流程里的 token；撤销、取消、过期的链接都失效。 */
function empSubmitInvite(token) {
  const e = empByToken(token);
  if (!e || !e.invite) return null;
  if (!["draft", "sent", "returned"].includes(e.invite.state)) return null;
  if (empInviteExpiredAt(e)) return null;
  const next = JSON.parse(JSON.stringify(e));
  /* 提交时把草稿冻结成“最后一版”；草稿本身不再被审核端读取 */
  if (next.invite.draft) {
    next.invite.submitted = empInviteDraftData(next.invite);
    next.invite.draft = null;
  }
  next.invite.state = "submitted";
  next.invite.submittedAt = empNow();
  next.invite.returnNote = "";
  next.invite.returnItems = [];
  return empSaveWithHistory(next, "员工");
}

/* 员工每改一次就存一次暂存，别让人填一半刷新就没了 */
function empSaveInviteDraft(token, patch) {
  const e = empByToken(token);
  if (!e || !e.invite) return null;
  if (!["draft", "sent", "returned"].includes(e.invite.state)) return null;
  if (empInviteExpiredAt(e)) return null;
  /* 草稿单独存，退回后保存未提交的修改不会立刻改掉审核区的“最后一版” */
  e.invite.draft = empMergeDeep(e.invite.draft || {}, patch || {});
  e.invite.savedAt = empNow();
  return empSaveStaff(e);
}

/* 退回必须写理由并可标出被退回项；员工修改后整份重提（HR-ONB-23）。 */
function empReturnInvite(id, note, items) {
  const e = empById(id);
  if (!e || !e.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("sensitive")) return { ok: false, code: "permission", message: empDenyReason("sensitive") };
  if (e.invite.state !== "submitted") return { ok: false, code: "state", message: empT("只有待审核的提交可以退回", "Nur eingereichte Angaben") };
  const text = String(note || "").trim();
  if (!text) return { ok: false, code: "reason", message: empT("退回必须写理由", "Begründung nötig") };
  const next = JSON.parse(JSON.stringify(e));
  next.invite.state = "returned";
  next.invite.returnNote = text;
  next.invite.returnItems = Array.isArray(items) ? items.filter(Boolean) : [];
  next.invite.reviewedAt = empNow();
  next.invite.reviewedBy = empActorLabel();
  empLogEvent(next, "onboarding.returned",
    `${text}${next.invite.returnItems.length ? `（${next.invite.returnItems.join("、")}）` : ""}`, empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

/* 审核通过：把暂存快照里的个人信息合并进正式档案，合同条件保持公司值（HR-ONB-10/22）。 */
function empApproveInvite(id, options) {
  const e = empById(id);
  if (!e || !e.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("sensitive")) return { ok: false, code: "permission", message: empDenyReason("sensitive") };
  if (e.invite.state !== "submitted") return { ok: false, code: "state", message: empT("只有待审核的提交可以通过", "Nur eingereichte Angaben") };
  const gaps = empOnbGaps(e, "submitted");
  const specialReason = String(options?.specialReason || "").trim();
  if (gaps.length) {
    if (!empCan("ownerOnly")) {
      return { ok: false, code: "special_owner", message: empT("第一、二层材料没交齐，通过需要老板做“特殊审批”；店长只能退回补充或等老板处理。", "Unterlagen Ebene 1/2 fehlen: Freigabe nur per Sonderfreigabe des Inhabers.") };
    }
    if (!specialReason) {
      return { ok: false, code: "special_reason", message: empT("材料没交齐就通过，必须写特殊审批的原因。", "Für die Sonderfreigabe ist eine Begründung nötig.") };
    }
  }
  const entryDate = String(options?.entryDate || "").trim();
  if (!empValidExpiry(entryDate)) return { ok: false, code: "entry_date", message: empT("通过时必须填有效的入职日期", "Gültiges Eintrittsdatum nötig") };
  const next = JSON.parse(JSON.stringify(e));
  const sub = next.invite.submitted || {};
  next.contact = { ...(next.contact || {}), ...(sub.contact || {}) };
  next.ids = { ...(next.ids || {}), ...(sub.ids || {}) };
  next.docs = { ...(next.docs || {}), ...(sub.docs || {}) };
  if (sub.contractFile && !next.docs.contract?.file) {
    next.docs.contract = { state: "ok", file: sub.contractFile, ref: sub.contractRef, by: "self" };
  }
  /* 个人信息以员工为准；合同条件（岗位、工资、工时、年假）以公司为准（HR-ONB-10）。
     姓名先同步 first/last，再统一生成 name，避免下一行被旧 first/last 覆盖（HR-ONB-10/22）。 */
  if (sub.firstName !== undefined || sub.lastName !== undefined) {
    if (sub.firstName !== undefined) next.firstName = sub.firstName;
    if (sub.lastName !== undefined) next.lastName = sub.lastName;
    const composedName = [next.firstName, next.lastName].filter(Boolean).join(" ").trim();
    if (composedName) next.name = composedName;
  } else if (sub.name && String(sub.name).trim()) {
    /* 遗留提交只有整名：不能再用旧 first/last 拼回去。拆成第一段 + 最后一段，
       并同步 first/last，保证下次保存不会把新名字覆盖回旧名（HR-ONB-10/22）。 */
    const full = String(sub.name).trim().replace(/\s+/g, " ");
    const parts = full.split(" ");
    next.name = full;
    next.firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : full;
    next.lastName = parts.length > 1 ? parts[parts.length - 1] : (next.lastName || "");
  }
  if (sub.birthday) next.birthday = sub.birthday;
  const nat = sub.contract?.nationalityClass ?? sub.profile?.nationalityClass;
  if (nat === "eu" || nat === "other" || nat === "") empSetNationality(next, nat);
  const student = sub.contract?.isStudent ?? (sub.profile?.student === "yes" ? true : sub.profile?.student === "no" ? false : undefined);
  if (typeof student === "boolean") next.contract = { ...(next.contract || {}), isStudent: student };
  next.entryDate = entryDate;
  next.probationEnd = options?.probationEnd ? options.probationEnd : null;
  next.status = "active";
  empNormalizeStatus(next);
  next.invite.state = "approved";
  next.invite.approvedAt = empNow();
  next.invite.reviewedAt = empNow();
  next.invite.reviewedBy = empActorLabel();
  if (gaps.length) {
    next.invite.specialApproval = {
      items: gaps.map(x => x.key), labels: gaps.map(x => empRaw(x.label)), layers: [...new Set(gaps.map(x => x.layer))],
      reason: specialReason, by: empActorLabel(), at: empNow()
    };
    empLogEvent(next, "approval.special", `特殊审批通过：${gaps.map(x => empRaw(x.label)).join("、")}没交齐；原因：${specialReason}`, empActorLabel());
  }
  next.invite.returnNote = "";
  next.invite.returnItems = [];
  const mail = (next.contact?.email || "").trim();
  if (mail) {
    next.account = {
      ...(next.account || {}), state: next.account?.state === "active" ? "active" : "accepted",
      user: mail, email: mail, store: next.store
    };
  }
  empLogEvent(next, "onboarding", `入职日期 ${entryDate}${next.probationEnd ? `，试用期结束 ${next.probationEnd}` : "，无试用期"}`, empActorLabel());
  empSaveWithHistory(next, empActorLabel(), { effectiveDate: entryDate });
  return { ok: true };
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

function empDocLevelPill(level, kind, docId) {
  const meta = EMP_DOC_LEVELS[level];
  /* 「出生日期未上传」是错的 —— 资料是填的，证件才是传的 */
  if (level === "missing") {
    return empPill(meta.tone, kind === "profile" ? empT("未填写", "Fehlt") : empT("未上传", "Fehlt"));
  }
  /* 健康证只有“复训到期”，不写“过期”（HR-DOC-32） */
  if (docId === "belehrung" && (level === "expired" || level === "warn")) {
    return empPill(meta.tone, empT("复训到期", "Schulung fällig"));
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

/* 健康证专用的措辞：只有“复训到期”，不出现“过期”（HR-DOC-32） */
function empRetrainDaysLabel(days) {
  if (days == null) return "";
  if (days < 0) return empT(`复训已到期 ${-days} 天`, `Schulung seit ${-days} Tagen fällig`);
  if (days === 0) return empT("今天复训到期", "Schulung heute fällig");
  return empT(`下次复训还有 ${days} 天`, `nächste Schulung in ${days} Tagen`);
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
  const urgentCount = sum.urgentPeople;
  const soonCount = sum.soonPeople;
  const staffBadge = urgentCount
    ? empT(`${urgentCount} 人待处理${soonCount ? ` · 提前知道 ${soonCount} 人` : ""}`, `${urgentCount} offen${soonCount ? ` · ${soonCount} Frühwarnung` : ""}`)
    : soonCount
      ? empT(`提前知道 ${soonCount} 人`, `${soonCount} Frühwarnung`)
      : empT("资料齐全", "Vollständig");
  const staffHref = urgentCount
    ? `#${slug("employee", "员工档案")}?f=todo&u=now`
    : soonCount ? `#${slug("employee", "员工档案")}?f=todo&u=soon` : `#${slug("employee", "员工档案")}`;
  return `
    <div class="page-head">
      <div><h1>${empT("员工助手", "Mitarbeiterassistent")}</h1>
      <p>${empT("员工档案、证件到期和入职流程集中在这里；排班、考勤和工资在二、三期开放。", "Mitarbeiterakten, Dokumentfristen und Onboarding an einem Ort; Dienstplan, Zeiten und Lohn folgen in Phase 2/3.")}</p></div>
      <div class="button-row"><a class="ghost-btn" href="#${slug("employee", "税务师权限")}">${empT("税务师权限", "Steuerberater-Zugriff")}</a><a class="ghost-btn" href="#${slug("employee", "合规设置")}">${empT("合规设置", "Compliance")}</a></div>
    </div>

    <section class="emp-modules">
      <a class="emp-module is-live is-mod-staff" href="${staffHref}">
        <div class="emp-module-head"><h2>${empT("员工档案", "Mitarbeiterakte")}</h2>${urgentCount
          ? empPill("red", staffBadge)
          : soonCount ? empPill("blue", staffBadge) : empPill("green", staffBadge)}</div>
        <p>${empT("资料、合同、证件、试用期与离职，一个人从入职到离职都在这里。", "Stammdaten, Vertrag, Dokumente, Probezeit und Austritt — der gesamte Lebenszyklus.")}</p>
        <div class="emp-module-mini">
          <span>${empT(`在岗 ${sum.headcount} 人 · 试用期 ${sum.probation} 人`, `${sum.headcount} aktiv · ${sum.probation} in Probezeit`)}</span>
          <span>${sum.review ? empT(`${sum.review} 人已提交资料，等你审核`, `${sum.review} warten auf Prüfung`)
                              : empT(`入职中 ${sum.invited} 人`, `${sum.invited} im Onboarding`)}</span>
          ${sum.pending ? `<span>${empT(`待入职 ${sum.pending} 人（不计入在岗）`, `${sum.pending} vor Eintritt (nicht aktiv)`)}</span>` : ""}
        </div>
        <span class="emp-module-cta">${empT("进入员工档案 →", "Zur Mitarbeiterakte →")}</span>
      </a>
      ${empModulePlaceholder("排班与考勤", "Dienstplan und Zeiten", "班表、打卡和工时在二期开放；现在由排班模块自己的提醒承载。", "Dienstplan, Zeiterfassung und Stunden folgen in Phase 2.")}
      ${empModulePlaceholder("工资与发薪", "Lohn und Auszahlung", "工资单、工时结算和发薪在三期开放；现在没有可用的真实数据。", "Lohnabrechnung und Auszahlung folgen in Phase 3.")}
    </section>

    ${empHomeTodoSection(sum)}`;
}

function empModulePlaceholder(zh, de, noteZh, noteDe) {
  return `<div class="emp-module is-soon" aria-disabled="true">
    <div class="emp-module-head"><h2>${empT(zh, de)}</h2>${empPill("gray", empT("即将开放", "Demnächst"))}</div>
    <p>${empT(noteZh, noteDe)}</p>
    <span class="emp-module-cta is-muted">${empT("二、三期使用", "Phase 2/3")}</span>
  </div>`;
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
  { id: "staff", name: { zh: "员工档案", de: "Mitarbeiterakte" } }
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

function empHomeTodoSection(sum) {
  const store = empScope();
  const today = empToday();
  const pending = empPendingPeople(store, today);
  const soon = empSoonPeople(store, today);
  const rows = [
    ...pending.flatMap(e => empPendingEntries(e, today).map(item => empHomeTodoRow(item, "now"))),
    ...soon.map(item => empHomeTodoRow(item, "soon"))
  ].join("");
  if (!rows) {
    return `<section class="card emp-allclear">
      <strong>${empT("员工档案和证件现在没有要处理的事", "Mitarbeiterakte und Dokumente sind aktuell offen")}</strong>
      <p>${empT(`证件、试用期、定期合同和关键资料都是齐的，最近 ${empRule("docSoonDays")} 天内也没有到关注期的。排班、考勤和工资在二、三期开放，不在这里假装有数据。`,
                `Dokumente, Probezeiten, Befristungen und Stammdaten sind vollständig; auch in den nächsten ${empRule("docSoonDays")} Tagen läuft nichts ab. Dienstplan, Zeiten und Lohn folgen später.`)}</p>
      <a class="ghost-btn" href="#${slug("employee", "证件到期")}">${empT("查看全部证件", "Alle Dokumente ansehen")}</a>
    </section>`;
  }
  const label = [
    pending.length ? empT(`${pending.length} 人待处理`, `${pending.length} offen`) : "",
    soon.length ? empT(`提前知道 ${soon.length} 人`, `${soon.length} Frühwarnung`) : ""
  ].filter(Boolean).join(" · ");
  const tools = `<a class="ghost-btn" href="#${slug("employee", "员工档案")}?f=todo&u=now">${empT(`查看这 ${pending.length} 人`, `${pending.length} Personen ansehen`)}</a>`
    + (soon.length ? `<a class="ghost-btn" href="#${slug("employee", "员工档案")}?f=todo&u=soon">${empT(`只看提前知道 ${soon.length} 人`, `Nur Frühwarnung: ${soon.length}`)}</a>` : "")
    + `<a class="ghost-btn" href="#${slug("employee", "证件到期")}">${empT("按证件看", "Nach Dokument")}</a>`;
  return `<section class="card emp-alert-card">
    <div class="section-title">
      <div><h2>${empT("需要处理的人事事项", "Offene Personalthemen")}</h2>
      <p>${empT("这里只列已开放的员工档案事项。标题只写员工姓名和事项类别，证件号、日期、金额都在档案里看（HR-TODO-05）。31–90 天的证件关注期单独写“提前知道”，不进待办。",
                "Nur offene Themen der Mitarbeiterakte. Titel nennen nur Name und Kategorie; Details stehen in der Akte (HR-TODO-05). 31–90 Tage gelten als Frühwarnung, nicht als Aufgabe.")}</p></div>
    </div>
    <div class="emp-alert-mod is-mod-staff">
      <details class="emp-alert-mod-details" open>
        <summary class="emp-alert-mod-head">
          <h3>${empText(EMP_HOME_GROUPS[0].name)}<i>${label}</i></h3>
          <span class="emp-alert-mod-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="emp-alert-mod-body">
          <div class="button-row">${tools}</div>
          ${rows}
        </div>
      </details>
    </div>
  </section>`;
}

function empHomeTodoRow(item, urgency) {
  const due = urgency === "soon"
    ? { zh: "需关注", de: "Beobachten", tone: "blue" }
    : item.level === "expired" ? EMP_DUE_LABELS["已逾期"]
      : item.level === "missing" || item.level === "date_missing" ? EMP_DUE_LABELS["尽快处理"]
        : EMP_DUE_LABELS["待审核"];
  const escalated = item.escalated ? ` · ${empRaw(EMP_ESCALATE_NOTE)}` : "";
  const title = empT(`${item.employee.name}：${empRaw(item.typeName)}${escalated}`, `${item.employee.name}: ${empRaw(item.typeName)}${escalated}`);
  return `<a class="emp-alert-line is-${item.level}" href="${empTodoItemHref(item)}">
    <span class="emp-kind-tag">${empEsc(item.code ? `HR-TODO-${item.code}` : empText(item.typeName))}</span>
    <strong class="emp-line-text">${empEsc(title)}</strong>
    ${empPill(due.tone, empText(due))}
    <i class="emp-kind-go">${empT("去处理 →", "Bearbeiten →")}</i>
  </a>`;
}

function empTodoItemHref(item) {
  if (item.key === "review") return `#${slug("employee", "邀请详情")}?id=${encodeURIComponent(item.employee.id)}`;
  if (item.key === "stalled") return `#${slug("employee", "邀请详情")}?id=${encodeURIComponent(item.employee.id)}`;
  const tab = ["probation", "befristet", "contract", "archive", "managerChange", "retention"].includes(item.key) ? "contract" : "profile";
  return `${empStaffHref(item.employee.id)}&tab=${tab}`;
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
  { id: "store", name: { zh: "门店 / 单位", de: "Filiale / Einheit" } }
];

function employeeStaffPage() {
  const store = empScope();
  const params = state().params;
  const filter = params.get("f") || "active";
  const sort = params.get("s") || "alert";
  const today = empToday();
  const all = empRosterVisible(store);
  const canInvite = empCan("invite");
  const counts = {
    all: all.length,
    active: all.filter(e => !empStatus(e.status).leaving).length,
    todo: all.filter(e => empPendingEntries(e, today).length).length,
    probation: all.filter(e => e.status === "probation").length,
    invited: all.filter(e => e.status === "invited").length,
    pending: all.filter(e => e.status === "pending").length,
    left: all.filter(e => e.status === "left").length
  };
  let list = all;
  /* 主页的分类概览点进来会带 kind，这里只留那一类的人 —— 不然点「4 人缺申报资料」
     结果看到的是全部待处理的人，等于白点一下。 */
  const kind = params.get("kind");
  const urgency = params.get("u");
  /* 首页那几行写的是「立刻处理」这一档的人数，点进来要是把「提前知道」的也算上，
     数字就对不上了（写 5 人、列出来 7 行）。所以 kind 和紧急度一起带过来。 */
  const matchAlert = a => (!kind || a.key === kind)
    && (!urgency || (urgency === "soon" ? a.level === "soon" : a.level !== "soon"));
  if (filter === "active") list = all.filter(e => !empStatus(e.status).leaving);
  else if (filter === "todo") list = all.filter(e => urgency === "soon" ? empSoonEntries(store, today).some(a => a.employee.id === e.id) : empPendingEntries(e, today).some(matchAlert));
  else if (filter === "probation") list = all.filter(e => e.status === "probation");
  else if (filter === "invited") list = all.filter(e => e.status === "invited");
  else if (filter === "pending") list = all.filter(e => e.status === "pending");
  else if (filter === "left") list = all.filter(e => e.status === "left");

  const worst = e => { const a = empPendingEntries(e, today)[0]; return a ? EMP_DOC_LEVELS[a.level].rank : 9; };
  list = [...list].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "de");
    if (sort === "entry") return String(b.entryDate || "").localeCompare(String(a.entryDate || ""));
    if (sort === "store") return a.store.localeCompare(b.store, "de") || a.name.localeCompare(b.name, "de");
    return worst(a) - worst(b) || a.name.localeCompare(b.name, "de");
  });

  const tabs = [["active", "在岗", "Aktiv", counts.active], ["todo", "需要处理", "Zu erledigen", counts.todo],
                ["probation", "试用期", "Probezeit", counts.probation], ["invited", "入职中", "Onboarding", counts.invited],
                ["pending", "待入职", "Vor Eintritt", counts.pending],
                ["left", "已离职", "Ausgeschieden", counts.left], ["all", "全部", "Alle", counts.all]];
  /* 表头徽标数的是当前这张表里的待办事项，不是员工人数。
     上面的「需要处理」筛选数的是人，两处数字各自回答一个问题，避免重复计数。 */
  const tableAlertCount = list.reduce((sum, e) => sum + empPendingEntries(e, today).filter(matchAlert).length, 0);
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
        <button class="ghost-btn emp-export-btn"${empCan("export") ? "" : ` disabled title="${empEsc(empDenyReason("export"))}"`}>${empT("导出这个列表", "Diese Liste exportieren")}</button>
        <button class="ghost-btn emp-batch-invite"${canInvite ? "" : " disabled"}>${empT("批量发邀请（在岗老员工）", "Sammel-Einladung (Bestand)")}</button>
       
       
       

      </div>
    </section>

    ${canInvite ? "" : `<p class="emp-disabled-reason emp-list-perm">${empEsc(empDenyReason("invite"))}</p>`}

    ${filter === "invited" && counts.invited ? `<section class="card emp-tabnote">
      <span>${empT(`${counts.invited} 人正在入职。发邮件、催办、审核他们提交的资料都在入职邀请里。`, `${counts.invited} im Onboarding. Einladen, erinnern und prüfen unter „Einladungen“.`)}</span>
      <a class="primary-btn" href="#${slug("employee", "入职邀请")}">${empT("去处理入职邀请", "Zu den Einladungen")}</a>
    </section>` : ""}
    <section class="card">
      ${list.length ? `<div class="table-scroll"><table class="table emp-table emp-roster">
        <thead><tr>
          <th><input class="employee-row-check employee-select-all" type="checkbox" aria-label="${empT("全选员工", "Alle auswählen")}"></th>
          <th>${empT("员工", "Mitarbeiter")}</th><th>${empT("合同", "Vertrag")}</th>
          <th>${empT("在职", "Beschäftigung")}</th><th><span class="emp-th-label">${empT("待处理", "Zu erledigen")}${empAttentionBadge(tableAlertCount)}</span><details class="emp-pending-tip"><summary aria-label="待处理范围说明">!</summary><div role="note"><strong>待处理范围</strong><p>汇总员工所有与有效期或截止日期有关、需要处理的事项，包括证件到期、即将到期，以及试用期和合同期限等。</p><p>也包括缺少或待补交的资料、证件和信息；通过特殊审批暂缺的材料，仍需在这里持续提示，直到补齐并完成处理。</p><p>员工提交入职资料后，也要提示老板审核；审核通过后，提示生成并发送个人调查问卷（Personalfragebogen）和劳动合同，员工签署上传后再提醒核对归档。</p></div></details></th><th></th>
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
    pending: [empT("没有待入职的人", "Niemand vor Eintritt"), empT("审核通过、入职日在将来的员工会出现在这里。", "Freigegebene Einstellungen mit künftigem Eintritt erscheinen hier.")],
    left: [empT("没有离职记录", "Keine Austritte"), ""],
    all: [empT("这家店还没有员工", "Noch keine Mitarbeiter"), empT("从「新增员工」建档并发邀请开始。", "Über „Mitarbeiter anlegen“ starten.")]
  }[filter] || ["", ""];
  return `<div class="emp-allclear"><strong>${msg[0]}</strong>${msg[1] ? `<p>${msg[1]}</p>` : ""}
    ${filter === "active" || filter === "all" ? `<a class="primary-btn" href="#${slug("employee", "新增员工")}">${empT("新增员工", "Mitarbeiter anlegen")}</a>` : ""}</div>`;
}

function empNoEmail(e) {
  return !String(e?.contact?.email || "").trim();
}

/* 推送补件的前置条件（HR-ONB-44、HR-ACCESS-31）：已接受邀请并确认绑定、仍在岗、有邮箱。 */
function empPushBlockReason(e, today) {
  if (empNoEmail(e)) return empT("需要先填邮箱，不能推送补件", "E-Mail fehlt — keine Nachreichung möglich");
  if (empStatus(e.status).leaving) return empT("不在岗，不能推送补件", "Nicht aktiv — keine Nachreichung");
  if (!empAccountActive(e)) return empT("员工接受邀请并确认绑定后才能推送", "Erst nach bestätigter Verknüpfung möglich");
  if (!empTopupItems(e, today).length) return empT("没有要补的材料", "Nichts nachzureichen");
  if (empHasRequest(e) || empHasOpenUpdateRequest(e) || empOpenSupplementSnapshot(e)) {
    return empT("已有一条未结束的补件请求", "Bereits eine offene Nachreichung");
  }
  return "";
}

function empStaffRow(e, today) {
  const st = empStatus(e.status);
  const c = e.contract;
  const entries = empPendingEntries(e, today);
  const top = entries[0];
  const pay = c.payType === "pauschal"
    ? (c.rate === "" || c.rate == null ? empT("薪资待填写", "Lohn offen") : `€${Number(c.rate).toLocaleString(empDe() ? "de-DE" : "en-US", { minimumFractionDigits: 2 })} ${empT("/ 月", "/ Mon.")}`)
    : (c.rate === "" || c.rate == null ? empT("时薪待填写", "Stundenlohn offen") : `€${Number(c.rate).toFixed(2)} / h`);
  const tenure = empTenure(e, today);
  const pushReason = empPushBlockReason(e, today);
  const showPush = empTopupItems(e, today).length || empNoEmail(e);
  const statusPill = e.status === "leaving"
    ? empPill("orange", empT(`${empMonthDayLabel(e.leave.lastDay)}离职`, `Austritt ${empFormatDate(e.leave.lastDay)}`))
    : e.status === "active" ? "" : empPill(st.tone, empText(st.name));
  /* data-find 把这一行所有可搜的字段拼一起，搜索直接在 DOM 里筛，不重渲染、不丢焦点 */
  const find = [e.name, e.store, empRaw(empRole(e.role).name), empRaw(empContractType(c.type).name),
                e.contact.phone, e.contact.email, e.note].filter(Boolean).join(" ").toLowerCase();
  return `<tr data-id="${empEsc(e.id)}" data-find="${empEsc(find)}" class="${top && (top.level === "expired" || top.level === "missing") ? "emp-alert-tr is-expired" : top && top.level === "warn" ? "emp-alert-tr is-warn" : ""}">
    <td><input class="employee-row-check" type="checkbox" aria-label="${empEsc(e.name)}"></td>
    <td class="emp-cell-who">
      <a class="emp-name-link" href="${empStaffHref(e.id)}">${empEsc(e.name)}</a>
      ${statusPill}
      <span>${empText(empRole(e.role).name)} · ${empText(empLevel(e.level).name)} · ${empEsc(e.store)}</span>
      ${empNoEmail(e) ? `<small class="emp-note emp-email-needed">${empT("需要先填邮箱", "E-Mail fehlt")}</small>` : ""}
      ${empFoodShiftBlocked(e) ? `<small class="emp-note emp-food-flag">${empT("不能排接触食品的班（没有健康证首次证明）", "Kein Lebensmitteldienst (Erstbelehrung fehlt)")}</small>` : ""}
      ${e.note ? `<small class="emp-note">${empEsc(e.note)}</small>` : ""}
    </td>
    <td class="emp-cell-contract">
      <strong>${empText(empContractType(c.type).name)}</strong>
      <span>${pay} · ${c.hoursMin === c.hoursMax ? `${c.hoursMax}h` : `${c.hoursMin}–${c.hoursMax}h`} ${empT("/ 月", "/ Mon.")}</span>
      ${c.befristetUntil ? `<small class="emp-note">${empT("定期至", "befristet bis")} ${empFormatDate(c.befristetUntil)}</small>` : ""}
    </td>
    <td class="emp-cell-job">
      ${e.entryDate ? `<strong>${tenure ? tenure.label : "—"}</strong><span>${empT("入职", "seit")} ${empFormatDate(e.entryDate)}</span>` : `<span>${empT("未入职", "Kein Eintritt")}</span>`}
      ${e.status === "probation" && e.probationEnd ? `<small class="emp-note">${empT("试用期至", "Probezeit bis")} ${empFormatDate(e.probationEnd)}</small>` : ""}
    </td>
    <td class="emp-cell-todo">
      ${empEmployeeSideEntries(e, today).map(x => `<small class="emp-note emp-employee-side">${empPill("gray", empText(x.label))}</small>`).join("")}
      ${top ? `<span class="emp-todo-line">${top.key === "doc" ? empDocLevelPill(top.level, "doc") : empPill(EMP_DOC_LEVELS[top.level].tone, empT("待办", "Offen"))}<b>${empEsc(empRaw(top.typeName))}</b>${top.escalated ? `<i>${empText(EMP_ESCALATE_NOTE)}</i>` : ""}${
          top.days != null ? `<i>${top.key === "doc" ? empDaysLabel(top.days) : empDaysLabel(top.days)}</i>` : ""}${
          entries.length > 1 ? `<i>${empT(`+${entries.length - 1} 项`, `+${entries.length - 1}`)}</i>` : ""}</span>
        ${empHasRequest(e) ? `<small class="emp-note emp-req-flag">${e.request.state === "submitted"
          ? empT("已交回，等你核对", "Abgegeben — prüfen")
          : empT("已推送到员工端", "In Mitarbeiter-App gesendet")}</small>` : ""}`
        : `<span class="emp-ok-dash">—</span>`}
    </td>
    <td class="button-cell single-action">
      <a class="ghost-btn" href="${empStaffHref(e.id)}">${empT("打开", "Öffnen")}</a>
      ${showPush ? `<button class="ghost-btn emp-row-push" data-id="${empEsc(e.id)}"${pushReason ? " disabled" : ""}>${empT("推送补件", "Nachfordern")}</button>` : ""}
      ${showPush && pushReason ? `<small class="emp-disabled-reason">${empEsc(pushReason)}</small>` : ""}
    </td>
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
  { id: "contract", name: { zh: "合同与入职", de: "Vertrag und Eintritt" } },
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
      <div class="button-row">${empBack(`#${slug("employee", "员工档案")}`, "员工档案", "Mitarbeiterakte")}<a class="ghost-btn" href="#employee-ui?preview=${encodeURIComponent(e.id)}">查看员工端 UI</a></div>
    </div>

    ${e.leave ? `<section class="card emp-left-banner">
      <strong>${e.status === "left" ? empT("已离职", "Ausgeschieden") : empT("已提离职，最后工作日当天仍在岗", "Austritt gemeldet — bis zum letzten Tag im Team")}</strong>
      <p>${empT(`最后工作日 ${empFormatDate(e.leave.lastDay)}，通知日 ${empFormatDate(e.leave.noticeDate)}。${e.leave.reason ? "原因：" + e.leave.reason : ""}`,
                `Letzter Arbeitstag ${empFormatDate(e.leave.lastDay)}, Kündigung am ${empFormatDate(e.leave.noticeDate)}.${e.leave.reason ? " Grund: " + e.leave.reason : ""}`)}</p>
      <span>${empT(`档案按资料类别保留至 ${empFormatDate(empRetentionUntil(e))}（最长一类），期间随时可查。撤销离职在“合同”页签。`, `Akte wird je Kategorie bis ${empFormatDate(empRetentionUntil(e))} (längste Frist) aufbewahrt. Rücknahme im Reiter „Vertrag“.`)}</span>
    </section>` : ""}

    <div class="emp-person">
      <div class="emp-person-main">
        ${empReviewSources(e).length ? empRequestBanner(e) : ""}

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
  const reviewOpen = empReviewSources(e).length > 0;
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
            : a.level === "date_missing" ? empT("已记录材料，请补填截止日期", "Dokument erfasst; Ablaufdatum ergänzen")
            : a.days == null ? empT("还没上传", "noch nicht hochgeladen")
            : `${a.date ? empFormatDate(a.date) + " · " : ""}${a.type?.id === "belehrung" ? empRetrainDaysLabel(a.days) : empDaysLabel(a.days)}`}</span></div>
        ${empDocLevelPill(a.level, a.kind, a.type?.id)}
      </a>`).join("")
      : `<p class="emp-rail-empty">${empT("证件、资料、试用期都是齐的。", "Dokumente, Stammdaten und Fristen sind vollständig.")}</p>`}
      ${!req && !reviewOpen && items.length ? (empAccountPushable(e)
        ? `<div class="emp-rail-action">
            <span>${empT("把上面可由员工补齐的项目一次推到他的员工端。", "Die vom Mitarbeiter ergänzbaren Punkte gesammelt in seine App senden.")}</span>
            <button class="primary-btn emp-request-send" data-id="${empEsc(e.id)}">${empT(`推送 ${items.length} 项到员工端`, `${items.length} Punkte senden`)}</button>
          </div>`
        : `<p class="emp-rail-account-needed">${empT(
            `员工接受邀请后才能推送（当前：${empAccountStateLabel(empAccountState(e))}）。`,
            `Nachforderungen erst nach Annahme der Einladung (aktuell: ${empAccountStateLabel(empAccountState(e))}).`)}</p>`)
        : ""}
      <p class="emp-rail-foot">${empT(`证件 ${docCount - badDocs} / ${docCount} 齐`, `Dokumente ${docCount - badDocs} / ${docCount}`)}</p>
    </section>`;
}

/* ---------------------------------------------------------- 员工账号卡 ---- */
function empAccountCard(e) {
  const state = empAccountState(e);
  const leaving = e.status === "left";
  const mail = (e.contact?.email || "").trim();
  const tone = EMP_ACCOUNT_TONES[state] || "gray";
  const canInvite = empCan("invite");
  const inviteReason = !canInvite ? empDenyReason("invite") : !mail ? empT("需要先填邮箱才能发邀请（HR-ACCESS-31）", "Zuerst E-Mail-Adresse ergänzen") : "";
  const canSend = canInvite && !!mail && !leaving;
  const cooldown = empAccountInvitedToday(e);
  const actionButton = (mode, label, disabled) => `<button class="ghost-btn emp-account-invite" data-id="${empEsc(e.id)}" data-mode="${mode}"${canSend && !disabled ? "" : " disabled"}>${label}</button>`;
  const accountStore = empAccountStore(e);
  const accountStoreMoved = state !== "none" && accountStore && e.store && accountStore !== e.store;
  const candidate = e.account?.candidate;
  const user = (e.account?.user || mail || "").trim();

  let actions = "";
  if (!leaving) {
    if (state === "none") actions = actionButton("invite", empT("发邀请", "Einladung senden"));
    else if (["invited", "expired", "send_failed"].includes(state)) actions = actionButton("resend", cooldown ? empT("今天已重发", "Heute bereits gesendet") : empT("重新发送", "Erneut senden"), cooldown);
    else if (state === "revoked") actions = actionButton("reinvite", empT("重新邀请", "Neu einladen"));
    else if (["active", "pending_link"].includes(state)) actions = `<button class="ghost-btn danger-lite emp-account-unlink" data-id="${empEsc(e.id)}">${empT("解绑", "Verknüpfung lösen")}</button>`;
  }

  const linkPanel = !leaving && ["none", "revoked", "expired"].includes(state)
    ? `<details class="emp-account-link">
        <summary>${empT("关联已有账号", "Bestehendes Konto verknüpfen")}</summary>
        <p class="small">${empT("老板和店长本人也要用员工端。发起后先“待确认”，给本人发待办“请确认员工档案关联”；本人确认前员工端只显示档案姓名。",
                               "Auch Inhaber und Filialleitung nutzen die Mitarbeiter-App. Nach dem Start steht die Verknüpfung auf „zu bestätigen“; vorher zeigt die App nur den Aktennamen.")}</p>
        <div class="emp-link-row">
          <select class="emp-member-pick">${empMemberCandidates(e).map(c => `<option value="${empEsc(c.email)}">${empEsc(c.name)} · ${empEsc(c.role)}</option>`).join("")}</select>
          <button class="ghost-btn emp-account-link-start" data-id="${empEsc(e.id)}"${canInvite ? "" : " disabled"}>${empT("发起关联", "Verknüpfen")}</button>
        </div>
        <small>${empT("候选成员来自“成员与权限”；可解绑。", "Kandidaten stammen aus „Mitglieder & Rechte“; Verknüpfung ist lösbar.")}</small>
      </details>`
    : "";

  return `<section class="card emp-rail-card emp-account is-${state}${leaving ? " is-off" : ""}">
    <div class="emp-rail-head"><h2>${empT("员工账号", "Mitarbeiterzugang")}</h2><span>${empPill(tone, empAccountStateLabel(state))}</span></div>
    <div class="emp-account-rows">
      <div><span>${empT("状态", "Status")}</span><strong>${empAccountStateLabel(state)}</strong></div>
      <div><span>${empT("账号邮箱", "Konto-E-Mail")}</span><strong>${user ? empEsc(user) : empT("还没有", "noch keine")}</strong></div>
      ${e.account?.lastSentAt ? `<div><span>${empT("最近发送", "Zuletzt gesendet")}</span><strong>${empStamp(e.account.lastSentAt)}</strong></div>` : ""}
      ${accountStore ? `<div><span>${empT("账号门店", "Konto-Filiale")}</span><strong>${empEsc(accountStore)}</strong></div>` : ""}
    </div>
    ${leaving ? `<span class="small">${empT("离职即停用；撤销离职后重新邀请。", "Mit dem Austritt deaktiviert; nach Rücknahme neu einladen.")}</span>` : ""}
    ${state === "pending_link" ? `<div class="emp-account-pending">
      <strong>${empT("等待本人确认关联", "Verknüpfung wartet auf Bestätigung")}</strong>
      <p>${empT(`已发给 ${candidate?.name || user} 一条待办“请确认员工档案关联”。确认前员工端只显示档案姓名。`, `Aufgabe „Mitarbeiterakte verknüpfen“ an ${candidate?.name || user} gesendet. Vorher zeigt die App nur den Aktennamen.`)}</p>
    </div>` : ""}
    ${state === "active" ? `<span class="small">${empT("已接受邀请并确认绑定。重设密码由员工在登录页用“忘记密码”自己完成，HR 不设置、也看不到密码。",
                                                    "Einladung angenommen und verknüpft. Passwort setzt die Person selbst über „Passwort vergessen“ zurück.")}</span>` : ""}
    ${state === "accepted" ? `<span class="small">${empT("已接受邀请，正在绑定成员身份；绑定完成后才会变成“已激活”，也才能推送补件。", "Einladung angenommen, Verknüpfung läuft; erst danach „aktiv“ und für Nachforderungen nutzbar.")}</span>` : ""}
    ${state === "none" && !mail ? `<span class="small">${empT("档案里还没有邮箱。没有邮箱可以建档，但发不了邀请，也推不了补件。", "Noch keine E-Mail-Adresse. Die Akte darf existieren, Einladung/Nachforderung sind aber erst danach möglich.")}</span>
      <a class="ghost-btn" href="${empStaffHref(e.id)}&tab=profile">${empT("去填邮箱", "E-Mail ergänzen")}</a>` : ""}
    ${(state === "invited" || state === "expired" || state === "send_failed") ? `<span class="small">${empT("重新发送只重发邮件，不改变员工填到哪一步；每个员工每天最多一次。", "Erneut senden verschickt nur die E-Mail; höchstens einmal pro Tag.")}</span>` : ""}
    ${actions ? `<div class="button-row emp-account-actions">${actions}</div>` : ""}
    ${inviteReason && !leaving && ["none", "invited", "expired", "send_failed", "revoked"].includes(state) ? `<p class="emp-disabled-reason">${empEsc(inviteReason)}</p>` : ""}
    ${accountStoreMoved ? `<p class="emp-account-store-note">${empT(`账号门店仍为 ${accountStore}，请到成员与权限调整。`, `Die Konto-Filiale ist weiterhin ${accountStore}; bitte unter „Mitglieder & Rechte“ anpassen.`)}
      <a href="#${typeof slug === "function" ? slug("admin", "员工与权限管理") : "admin-员工与权限管理"}">${empT("去成员与权限", "Zu Mitglieder & Rechte")}</a></p>` : ""}
    ${linkPanel}
  </section>`;
}

/* 员工交回后在资料主栏就地核对。等待员工填写的状态已经合并到右侧待处理卡。 */
function empRequestBanner(e) {
  const sources = empReviewSources(e);
  if (!sources.length) return "";
  const sensitiveOK = empCan("sensitive");
  /* 采纳含敏感值或文件的资料更新需要“查看敏感资料”权限（HR-ACCESS-55） */
  const needsSensitive = empReviewNeedsSensitive(sources);
  const sourceLabel = { update: empT("员工资料修改", "Datenänderung"), topup: empT("补件交回", "Nachreichung"), supplement: empT("补件交回（员工端记录）", "Nachreichung (App-Eintrag)") };
  const stamp = sources.map(src => `${sourceLabel[src.kind]} ${empStamp(src.at)}`).join(" · ");
  return `<section class="card emp-request-bar is-submitted emp-review-card">
    <div>
      <strong>${empT(`${e.name} 交上来了，核对一下`, `${e.name} hat abgegeben — bitte prüfen`)} ${empPill("orange", empT("待核对", "Zur Prüfung"))}</strong>
      <span>${stamp}</span>
    </div>
    ${sources.map(src => `<div class="emp-review-source">
      <h3>${sourceLabel[src.kind]}<small>${empStamp(src.at)}</small></h3>
      <div class="emp-request-items">
        ${src.items.map(item => {
          const masked = item.sensitive && !sensitiveOK;
          if (item.kind === "field") {
            return `<div class="emp-request-item"><span>${empEsc(item.label)}</span>
              <strong>${masked ? "••••" : item.to ? empEsc(item.to) : `<i class="emp-miss">${empT("（空）", "(leer)")}</i>`}</strong>
              <small>${empT("原值", "bisher")} ${masked ? "••••" : empEsc(item.from || empT("（空）", "(leer)"))}</small></div>`;
          }
          const type = empDocType(item.docId);
          const expiry = item.keepExpiry ? empT(`保留原日期 ${item.expiry || "—"}（${item.keepReason}）`, `bisheriges Datum ${item.expiry || "—"} (${item.keepReason})`) : item.expiry ? empT(`新有效期 ${empFormatDate(item.expiry)}`, `neues Datum ${empFormatDate(item.expiry)}`) : "";
          return `<div class="emp-request-item"><span>${empEsc(item.label)}</span>
            <strong>${item.to ? (masked ? empT("已上传（文件名已隐藏）", "Hochgeladen (Name ausgeblendet)") : (item.file?.data || item.file?.dataUrl || item.file?.ref) ? empFileLink({ file: item.to, dataUrl: item.file?.data || item.file?.dataUrl, ref: item.file?.ref }) : empEsc(item.to)) : `<i class="emp-miss">${empT("没传", "fehlt")}</i>`}</strong>
            <small>${empT("现行", "aktuell")} ${masked ? "••••" : empEsc(item.from || empT("无", "keine"))}${type.expiry ? ` · ${expiry || empT("有效期待补", "Datum offen")}` : ""}</small></div>`;
        }).join("")}
      </div>
    </div>`).join("")}
    ${sources.length > 1 ? `<p class="emp-request-warning">${empT("该员工同时有两条未结束请求；同一员工应只有一条，请退回多余的一条（HR-ONB-43/44）。", "Zwei offene Anfragen; pro Person ist nur eine zulässig (HR-ONB-43/44).")}</p>` : ""}
    <div class="field"><label>${empT("要退回就写清楚哪里不行", "Bei Rückgabe bitte begründen")}</label>
      <textarea class="emp-request-note" rows="2" placeholder="${empT("例如：到期日那一栏还是看不清，麻烦重拍。", "z. B.: Ablaufdatum weiterhin unleserlich, bitte neu fotografieren.")}"></textarea></div>
    <div class="emp-request-rules">
      <strong>${empT("这张卡怎么用", "Regeln für diese Prüfung")}</strong>
      <span>${empT("采纳严格按员工提交时冻结的字段、文件版本和日期写入；采纳前正式档案保持原值；替换证件时旧版本进历史（HR-ONB-43/44、HR-DOC-20/21）。", "Übernommen werden ausschließlich die bei der Abgabe eingefrorenen Werte, Dateiversionen und Daten; bis dahin bleibt die Akte unverändert (HR-ONB-43/44, HR-DOC-20/21).")}</span>
    </div>
    <div class="button-row">
      <button class="ghost-btn danger-lite emp-request-return" data-id="${empEsc(e.id)}">${empT("退回重来", "Zurückgeben")}</button>
      <button class="primary-btn emp-request-accept" data-id="${empEsc(e.id)}"${needsSensitive && !sensitiveOK ? " disabled" : ""}>${empT("采纳并归档", "Übernehmen und ablegen")}</button>
    </div>
    ${needsSensitive && !sensitiveOK ? `<p class="emp-disabled-reason">${empT("采纳含敏感值或文件的资料更新需要“查看敏感资料”权限（HR-ACCESS-55）。", "Für die Übernahme vertraulicher Werte/Dateien ist die Berechtigung nötig (HR-ACCESS-55).")}</p>` : ""}
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

function empHiddenField(label) {
  return `<div class="field emp-field-hidden"><label>${label}</label>
    <div class="emp-hidden-value">${empT("已隐藏", "Ausgeblendet")}</div>
    <small>${empT("需要“查看敏感资料”权限（HR-ACCESS-11）", "Erfordert „Vertrauliche Daten ansehen“ (HR-ACCESS-11)")}</small></div>`;
}

function empSensitiveInput(label, path, value, type = "text") {
  return empCan("sensitive") ? empInput(label, path, value, type) : empHiddenField(label);
}

/* 门店只读 + 调店。调店表单故意不用 data-emp-field：
   门店不是“保存修改”顺手能改的字段，必须走单独的调店动作和生效日期（HR-ORG-20～27）。 */
function empStoreTransferBlock(e) {
  const canTransfer = empCan("ownerOnly");
  const lastTransfer = [...(e.transfers || [])].sort((a, b) => String(b.effectiveDate).localeCompare(String(a.effectiveDate)))[0];
  const accountStoreMoved = empAccountState(e) !== "none" && empAccountStore(e) && empAccountStore(e) !== e.store;
  return `<div class="field emp-readonly-field"><label>${empT("所属单位", "Einheit")}</label>
      <div class="emp-readonly-value"><strong>${empEsc(empUnitLabel(e.store))}</strong>
        <span>${empT("只读；调店走下面的按钮，并填生效日期。", "Schreibgeschützt; Filialwechsel über die Schaltfläche mit Wirksamkeitsdatum.")}</span></div>
      <div class="button-row">
        <button class="ghost-btn emp-transfer-open" data-id="${empEsc(e.id)}"${canTransfer ? "" : " disabled"}>${empT("调店 / 调单位", "Einheit wechseln")}</button>
      </div>
      ${canTransfer ? "" : `<small class="emp-disabled-reason">${empEsc(empDenyReason("ownerOnly"))}</small>`}
      ${accountStoreMoved ? `<small class="emp-account-store-note">${empT(`账号门店仍为 ${empAccountStore(e)}，请到成员与权限调整。`, `Konto-Filiale bleibt ${empAccountStore(e)}; bitte unter „Mitglieder & Rechte“ anpassen.`)}
        <a href="#${typeof slug === "function" ? slug("admin", "员工与权限管理") : "admin-员工与权限管理"}">${empT("去成员与权限", "Zu Mitglieder & Rechte")}</a></small>` : ""}
    </div>
    <div class="emp-transfer-form is-hidden" data-id="${empEsc(e.id)}">
      <div class="form-grid">
        <label class="field"><span>${empT("新门店", "Neue Filiale")}</span>
          <select class="emp-transfer-store">${empStores().filter(s => s !== e.store).map(s => `<option value="${empEsc(s)}">${empEsc(empUnitLabel(s))}</option>`).join("")}</select></label>
        <label class="field"><span>${empT("生效日期", "Wirksam ab")}</span>
          <input type="date" class="emp-transfer-date" value="${empToday()}"></label>
      </div>
      <p class="emp-transfer-note">${empT(
        `生效日期不能早于入职日 ${empFormatDate(e.entryDate)}${lastTransfer?.effectiveDate ? `、上次调店日 ${empFormatDate(lastTransfer.effectiveDate)}` : ""}，也不能是将来。`,
        `Nicht vor Eintritt ${empFormatDate(e.entryDate)}${lastTransfer?.effectiveDate ? ` oder letztem Wechsel ${empFormatDate(lastTransfer.effectiveDate)}` : ""}, nicht in der Zukunft.`)}
        ${empT("新旧门店属于不同公司时会被拒绝：请办离职并新建入职。", "Bei unterschiedlichen Firmen abgelehnt: Austritt und Neueintritt.")}</p>
      <p class="emp-transfer-error" role="status"></p>
      <div class="button-row"><button class="ghost-btn emp-transfer-cancel">${empT("取消", "Abbrechen")}</button>
        <button class="primary-btn emp-transfer-confirm" data-id="${empEsc(e.id)}">${empT("确认调店", "Wechsel bestätigen")}</button></div>
    </div>`;
}

function empTabProfile(e) {
  const nationality = empNationalityClass(e);
  const student = empStudentValue(e);
  const studentLocked = e.contract.type === "werkstudent";
  const zusatz = empZusatzValue(e);
  return `    <section class="card"><div class="section-title"><div><h2>${empT("基本信息", "Stammdaten")}</h2>
      <p class="small">${empT("与员工端填写的个人信息和身份条件保持一致。国籍、学生身份由员工回答；附加页由店长核对居留证件后勾选。", "Angaben aus der Mitarbeiter-App. Staatsangehörigkeit und Studium beantwortet die Person; das Zusatzblatt prüft die Leitung am Aufenthaltstitel.")}</p></div></div>
      <div class="form-grid">
        ${empInput("名", "firstName", e.firstName ?? e.name.split(" ")[0])}
        ${empInput("姓", "lastName", e.lastName ?? e.name.split(" ").slice(1).join(" "))}
        ${empInput("邮箱（邀请已登记）", "contact.email", e.contact.email)}
        ${empSensitiveInput(empT("出生日期", "Geburtsdatum"), "birthday", e.birthday || "", "date")}
        ${empInput("电话", "contact.phone", e.contact.phone)}
        ${empSelect(empT("国籍类别", "Staatsangehörigkeit"), "contract.nationalityClass", [
          ["", empT("未回答", "Nicht beantwortet")],
          ["eu", empT("欧盟、欧洲经济区或瑞士公民", "EU / EWR / Schweiz")],
          ["other", empT("其他国籍（含英国）", "Sonstige (inkl. UK)")]
        ], nationality)}
      </div>
      <div class="emp-inline-note">${empT("国籍未回答时，材料清单显示“待确认国籍”，不按欧盟或其他国籍计算。", "Ohne Antwort zeigt die Unterlagenliste „Staatsangehörigkeit offen“ und rechnet nicht mit EU oder Nicht-EU.")}</div>
      <div class="form-grid">
        <div class="field"><label>${empT("是否是学生（需在读证明）", "Studierend (Nachweis erforderlich)")}</label>
          <select data-emp-field="contract.isStudent"${studentLocked ? " disabled" : ""}>
            <option value=""${!empStudentAnswered(e) ? " selected" : ""}>${empT("未回答（由员工在员工端回答）", "Nicht beantwortet (Angabe der Person)")}</option>
            <option value="yes"${empStudentAnswered(e) && student ? " selected" : ""}>${empT("是", "Ja")}</option>
            <option value="no"${empStudentAnswered(e) && !student ? " selected" : ""}>${empT("否", "Nein")}</option>
          </select>
          <small>${studentLocked ? empT("合同类型是学生工，自动视为学生并强制要求在读证明。", "Vertragsart Werkstudent: automatisch Studierende/r, Nachweis erforderlich.") : empT("这是员工在个人信息里回答的字段，不是合同条件；选学生工合同也会自动视为学生。", "Antwort der Person, keine Vertragsbedingung; Werkstudent gilt automatisch als Studium.")}</small></div>
        ${nationality === "other" ? `<div class="field"><label>${empT("附加页（Zusatzblatt）", "Zusatzblatt")}</label>
          <select data-emp-field="contract.zusatzCheck"${empCan("sensitive") ? "" : " disabled"}>
            <option value=""${zusatz === "" ? " selected" : ""}>${empT("未核对", "Nicht geprüft")}</option>
            <option value="no"${zusatz === "no" ? " selected" : ""}>${empT("否", "Nein")}</option>
            <option value="yes"${zusatz === "yes" ? " selected" : ""}>${empT("是", "Ja")}</option>
          </select><small>${empT("店长核对居留证件后勾选；员工本人不选。", "Nach Prüfung des Aufenthaltstitels durch die Leitung; die Person selbst wählt nicht.")}${empCan("sensitive") ? "" : ` ${empT("需要“查看敏感资料”权限才能核对居留证件。", "Zum Prüfen des Aufenthaltstitels ist die Berechtigung nötig.")}`}</small></div>`
          : `<div class="field"><label>${empT("附加页（Zusatzblatt）", "Zusatzblatt")}</label><div class="emp-readonly-value">${empT("只对其他国籍适用", "Nur bei sonstiger Staatsangehörigkeit")}</div></div>`}
      </div></section>
    <section class="card"><div class="section-title"><h2>${empT("地址与联系方式", "Adresse und Kontakt")}</h2></div><div class="form-grid">
      ${empInput("街道", "contact.street", e.contact.street)}${empInput("门牌号", "contact.houseNo", e.contact.houseNo)}
      ${empInput("邮编", "contact.zip", e.contact.zip)}${empInput("城市", "contact.city", e.contact.city)}
      ${empInput("居住国家", "contact.country", e.contact.country || "Deutschland")}
      ${empInput("紧急联系人姓名", "contact.emergencyName", e.contact.emergencyName || "")}
      ${empInput("紧急联系人电话", "contact.emergencyPhone", e.contact.emergencyPhone || "")}
      ${e.contact.emergency ? `<p class="small">原联系人记录：${empEsc(e.contact.emergency)}</p>` : ""}
      ${empSelect("沟通语言", "contact.language", empLangOptions(), e.contact.language)}
      ${empSelect(empT("通知方式", "Benachrichtigung"), "contact.notifyBy", empNotifyOptions(), e.contact.notifyBy)}
    </div>
    <p class="small">${empT("一期实际只发邮件和站内待办；短信、WhatsApp 等选项保留，正式版按渠道开通情况启用。", "Phase 1 versendet nur E-Mail und In-App-Aufgaben; weitere Kanäle bleiben als Option.")}</p></section>
    <section class="card"><div class="section-title"><div><h2>${empT("税号、社保与银行", "Steuer, Sozialversicherung und Bank")}</h2>
      <p class="small">${empCan("sensitive") ? empT("这些是敏感资料；只有具备“查看敏感资料”权限的人能看到完整值。", "Vertrauliche Daten; vollständig nur mit entsprechender Berechtigung.") : empT("当前视角没有“查看敏感资料”权限，敏感字段显示为已隐藏。", "Ohne Berechtigung werden vertrauliche Felder ausgeblendet.")}</p></div>
      <a class="ghost-btn" href="#${slug('employee','员工资料')}?id=${encodeURIComponent(e.id)}&tab=docs">查看证件</a></div><div class="form-grid">
      ${empInput("医保名称（Krankenkasse Name）", "contact.krankenkasse", e.contact.krankenkasse || "")}
      ${empSensitiveInput("医保卡号（Krankenversichertennummer）", "ids.healthCardNumber", e.ids?.healthCardNumber || "")}
      ${empCan("sensitive") ? empIdentityInput('Steuer-ID（个人税务识别号）','ids.steuerId',e.ids?.steuerId||'','steuerId') : empHiddenField("Steuer-ID（个人税务识别号）")}
      ${empCan("sensitive") ? empIdentityInput('Sozialversicherungsnummer（社会保险号）','ids.rentenversicherung',e.ids?.rentenversicherung||'','rentenversicherung') : empHiddenField("Sozialversicherungsnummer（社会保险号）")}
      ${empSensitiveInput("IBAN", "ids.iban", e.ids?.iban || "")}
    </div></section>
    <section class="card"><div class="section-title"><h2>${empT("公司管理信息", "Interne Angaben")}</h2></div><div class="form-grid">
      ${empInput(empT("员工编号", "Personalnummer"), "employeeNo", e.employeeNo || "")}
      ${empSelect(empT("岗位", "Position"), "role", empRoles().map(r => [r.id, empRaw(r.name)]), e.role)}
      ${empSelect(empT("员工级别", "Qualifikation"), "level", EMP_LEVELS.map(l => [l.id, empRaw(l.name)]), e.level)}
      ${empInput(empT("排班备注", "Dienstplan-Notiz"), "note", e.note)}
    </div>
    <p class="small emp-field-note">${empT("员工编号由税务师分配，老板和店长可填写或更正，以最后一次为准；同一雇主下不重复，重聘沿用原编号（HR-CONTRACT-17）。", "Personalnummer vergibt die Steuerberatung; letzte Eingabe gilt, eindeutig je Arbeitgeber, bei Wiedereinstellung weiterverwenden.")}</p>
    ${e.rehireOf && empById(e.rehireOf) ? `<p class="small emp-rehire-link">${empT("重聘自旧档案", "Wiedereinstellung aus Akte")}
      <a href="${empStaffHref(e.rehireOf)}">${empEsc(empById(e.rehireOf).name)}</a>${empT("；员工编号沿用，账号由老板重新开通。", "; Personalnummer übernommen, Konto durch Inhaber neu aktivieren.")}</p>` : ""}
    ${e.rehiredBy && empById(e.rehiredBy) ? `<p class="small emp-rehire-link">${empT("已由新档案重聘", "Durch neue Akte wieder eingestellt")}
      <a href="${empStaffHref(e.rehiredBy)}">${empEsc(empById(e.rehiredBy).name)}</a>${empT("；旧档案保留供查。", "; alte Akte bleibt einsehbar.")}</p>` : ""}
    <p class="small emp-role-note">${empT("岗位只是名册标签，不联动系统权限；店长的系统权限仍在“成员与权限”单独设置。", "Die Position ist nur ein Listenmerkmal und steuert keine Rechte; Rechte der Filialleitung stehen unter „Mitglieder & Rechte“.")}</p>
    <details class="emp-role-add"><summary>${empT("新增岗位", "Position hinzufügen")}</summary>
      <div class="emp-link-row"><input class="emp-new-role-name" placeholder="${empT("例如：洗碗工、外卖员", "z. B. Spülkraft, Lieferung")}">
        <button class="ghost-btn emp-add-role" data-id="${empEsc(e.id)}"${empCan("ownerOnly") ? "" : " disabled"}>${empT("保存并选为当前岗位", "Speichern und zuweisen")}</button></div>
      ${empCan("ownerOnly") ? "" : `<small class="emp-disabled-reason">${empEsc(empDenyReason("ownerOnly"))}</small>`}
    </details>
    ${empStoreTransferBlock(e)}
    </section>`;
}

/* ------------------------------------------------ 合同与问卷的发出/签回/核对 ---
   字段名必须与员工端 employee-ui.js 的读法一致：
   invite.contractTemplate / questionnaireTemplate / contractSentAt /
   contractSignedSubmittedAt / contractSignedReviewedAt / contractReview /
   dispatchMode / offlineSignedAt / onboardingFilesVersion。
   HR-ONB-35～38、53。 */
function empContractArchived(e) {
  const inv = e?.invite || {};
  return !!(inv.contractSignedReviewedAt || inv.archivedAt || inv.dispatchMode === "offline" || inv.offlineSignedAt);
}

function empContractSignedDoc(e, key) {
  const doc = (e?.docs || {})[key === "contract" ? "contract" : "personalquestionnaire"] || {};
  /* 作废后旧件只留在历史里：state=missing 的不能算“这次发送的签回件” */
  return doc.state === "missing" ? {} : doc;
}

function empContractDispatchId() {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* 签回件是否属于“当前这次发送”（HR-ONB-37/53，员工端用同一函数做提交前校验）。
   file 是 e.docs.contract / e.docs.personalquestionnaire（或员工端上传的文件对象），
   kind 是 "contract" 或 "questionnaire"。返回 true 当且仅当：
   1) 文件带 dispatchId 且等于 invite.dispatchId；或
   2) 邀请没有 dispatchId 的旧记录：file.at 不早于 invite.sentAt；
   3) 如果这一份被退回，还必须是退回之后的新版本（file.at 晚于退回时间，或 dispatchId 与被退回那版不同）。
   缺 at 又缺 dispatchId 无法证明更新 → 一律 false；真正重传后带 at 的新版本必须能通过。 */
function empContractFileIsCurrent(e, file, kind) {
  if (!file) return false;
  const name = file.file || file.name;
  if (!name) return false;
  const inv = e?.invite || {};
  const currentId = inv.dispatchId || "";
  const fileId = file.dispatchId || "";
  if (currentId && fileId && String(fileId) !== String(currentId)) return false;
  if (!fileId) {
    /* 没有发送记录 ID 时只能靠上传时间证明；旧记录缺 at 的不能放行 */
    if (!file.at) return false;
    /* 新发送（有 dispatchId）以合同发出时间为锚；没有 dispatchId 的旧记录才用邀请发出时间 */
    const anchor = currentId ? (inv.contractSentAt || "") : (inv.sentAt || "");
    if (anchor && String(file.at) < String(anchor)) return false;
  }
  const returned = inv.contractReview?.[kind];
  if (returned?.state === "returned") {
    const sameDispatch = returned.dispatchId && fileId && String(returned.dispatchId) === String(fileId);
    if (sameDispatch) {
      if (returned.at) {
        if (!file.at || String(file.at) <= String(returned.at)) return false;
      } else if (!file.at) {
        return false;
      }
      return true;
    }
    if (file.at && returned.at) return String(file.at) > String(returned.at);
    /* 退回记录缺时间（旧数据）：只要求这一次上传带 at，不能永远卡在“请重传” */
    return !!file.at;
  }
  return true;
}

function empContractSignedReady(e) {
  return !!empContractSignedDoc(e, "contract").file && !!empContractSignedDoc(e, "questionnaire").file;
}

/* 发合同前公司法定名称和经营地址不能缺（HR-ONB-35） */
function empDispatchCompanyMissing(e) {
  const info = (typeof empEmployer === "function" ? empEmployer(e.store) : null) || {};
  const legal = info.legalName && info.legalName !== e.store ? info.legalName : "";
  const missing = [];
  if (!String(legal || "").trim()) missing.push(empT("公司法定名称", "Firmenname"));
  if (!String(info.address || "").trim()) missing.push(empT("经营地址", "Betriebsstätte"));
  return missing;
}

function empContractDispatchState(e) {
  const inv = e.invite || {};
  if (empContractArchived(e)) return { id: "archived", tone: "green", name: { zh: inv.dispatchMode === "offline" ? "已归档（线下签署）" : "已核对归档", de: inv.dispatchMode === "offline" ? "Abgelegt (offline)" : "Geprüft und abgelegt" } };
  const returned = ["contract", "questionnaire"].some(k => (inv.contractReview || {})[k]?.state === "returned");
  if (inv.contractSentAt && returned) return { id: "sent", tone: "orange", name: { zh: "已退回一份，等员工重传", de: "Eine Datei zurückgegeben" } };
  if (inv.contractSentAt && inv.contractSignedSubmittedAt) return { id: "review", tone: "orange", name: { zh: "已签回，待逐份核对", de: "Zurück, Prüfung offen" } };
  if (inv.contractSentAt) return { id: "sent", tone: "blue", name: { zh: "已发出，待员工签回", de: "Gesendet, Unterschrift offen" } };
  return { id: "prepare", tone: "gray", name: { zh: "待发合同与问卷", de: "Zu versenden" } };
}

function empDispatchFileLink(file, label, hideName) {
  if (!file) return `<span class="emp-miss">${empT("还没上传", "fehlt")}</span>`;
  if (hideName) return `<span>${empT("已上传（文件名已隐藏）", "Hochgeladen (Name ausgeblendet)")}</span>`;
  const url = file.dataUrl || file.data || file.url || "";
  return url ? `<a class="ghost-btn" href="${empEsc(url)}" download="${empEsc(file.name || label)}">${empEsc(file.name || label)}</a>`
             : `<span>${empEsc(file.name || label)}</span>`;
}

function empContractDispatchPanel(e) {
  const inv = e.invite;
  if (!inv) return "";
  const state = empContractDispatchState(e);
  if (inv.fillMode === "veteran") {
    return `<section class="card emp-dispatch">
      <div class="section-title"><div><h2>${empT("合同与问卷", "Vertrag und Fragebogen")}</h2>
        <p>${empT("在岗老员工开通：只确认资料、补证件，不重走审核和合同（HR-ONB-52）。", "Bestandskräfte: nur Daten bestätigen und Unterlagen ergänzen, kein neuer Vertrag (HR-ONB-52).")}</p></div>
        ${empPill("gray", empT("不适用", "Nicht erforderlich"))}</div>
    </section>`;
  }
  if (inv.state !== "approved") {
    return `<section class="card emp-dispatch">
      <div class="section-title"><div><h2>${empT("合同与问卷", "Vertrag und Fragebogen")}</h2>
        <p>${empT("员工资料审核通过后才能发合同；现在是“未通过”阶段。", "Versand erst nach Freigabe der Angaben.")}</p></div>
        ${empPill("gray", empText(empInviteState(inv.state).name))}</div>
      <a class="ghost-btn" href="#${slug("employee", "邀请详情")}?id=${encodeURIComponent(e.id)}">${empT("查看资料审核", "Prüfung ansehen")}</a>
    </section>`;
  }
  const missing = empDispatchCompanyMissing(e);
  const review = inv.contractReview || {};
  const sensitiveOK = empCan("sensitive");
  const defaultQuestionnaire = empQuestionnaireTemplate().file;
  const row = (key, label) => {
    const outgoing = key === "contract" ? inv.contractTemplate : inv.questionnaireTemplate;
    const signed = empContractSignedDoc(e, key);
    const rv = review[key] || {};
    const signedTone = rv.state === "approved" ? "green" : rv.state === "returned" ? "red" : signed.file ? "orange" : "gray";
    const signedText = rv.state === "approved" ? empT("已通过核对", "Geprüft")
      : rv.state === "returned" ? empT("已退回，等员工重传", "Zurückgegeben")
      : signed.file ? empT("已上传，待核对", "Hochgeladen, Prüfung offen") : empT("员工还没上传", "Noch nicht hochgeladen");
    /* 只核对属于当前发送的签回件；被退回的那份必须是退回之后的新版本（HR-ONB-37/53） */
    const current = empContractFileIsCurrent(e, signed, key);
    const canReview = inv.contractSentAt && !empContractArchived(e) && !inv.contractVoid && empContractSignedReady(e)
      && signed.file && rv.state !== "approved" && current && sensitiveOK;
    return `<div class="emp-dispatch-row">
      <div class="emp-dispatch-info">
        <strong>${label}</strong>
        <span>${empT("发出件", "Versandt")}：${empDispatchFileLink(outgoing, label, !sensitiveOK)}</span>
        <span>${empT("签回件", "Unterschrieben")}：${empDispatchFileLink(signed, label, !empCan("sensitive"))} ${empPill(signedTone, signedText)}</span>
        ${signed.file && !current ? `<small class="emp-reason">${empT("这份不是本次发送的签回件，需员工重新上传后才能核对。", "Diese Datei gehört nicht zum aktuellen Versand — bitte neu hochladen lassen.")}</small>` : ""}
        ${rv.state === "returned" && rv.reason ? `<small class="emp-reason">${empT("退回原因", "Grund")}：${empEsc(rv.reason)}</small>` : ""}
      </div>
      ${canReview ? `<div class="emp-dispatch-review">
        <input class="emp-dispatch-reason" data-key="${key}" placeholder="${empT("退回要写原因", "Begründung bei Rückgabe")}">
        <div class="button-row">
          <button class="ghost-btn danger-lite emp-dispatch-return" data-id="${empEsc(e.id)}" data-key="${key}">${empT("退回这一份", "Dieses zurückgeben")}</button>
          <button class="primary-btn emp-dispatch-approve" data-id="${empEsc(e.id)}" data-key="${key}">${empT("这份通过", "Dieses prüfen")}</button>
        </div>
      </div>` : ""}
    </div>`;
  };
  const upload = (key, label) => `<label class="emp-upload-btn">${empT("上传", "Hochladen")} ${label}
    <input type="file" class="emp-dispatch-upload" data-id="${empEsc(e.id)}" data-key="${key}" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" hidden></label>`;
  const voidBox = (inv.contractSentAt || empContractArchived(e)) && !inv.contractVoid ? `<details class="emp-dispatch-void">
    <summary>${empT("发错了，作废重发", "Fehlerhaft — stornieren und neu senden")}</summary>
    <p class="small">${empT("作废要写原因；旧件保留备查，员工端不再能下载；重新发要重新上传两份发出件。", "Stornierung mit Begründung; alte Dateien bleiben, Mitarbeiter können nicht mehr herunterladen.")}</p>
    <div class="emp-link-row"><input class="emp-dispatch-void-reason" placeholder="${empT("作废原因", "Grund der Stornierung")}">
      <button class="ghost-btn danger-lite emp-dispatch-void-btn" data-id="${empEsc(e.id)}">${empT("作废这次发送", "Stornieren")}</button></div>
  </details>` : "";
  return `<section class="card emp-dispatch">
    <div class="section-title"><div><h2>${empT("合同与问卷 · 发送、签回、核对", "Vertrag und Fragebogen · Versand, Unterschrift, Prüfung")}</h2>
      <p>${empT("两份一起发；员工两份都上传才算签回；逐份核对，只退回没通过的那一份。", "Beide zusammen senden; zurück erst, wenn beide hochgeladen sind; einzeln prüfen und nur das beanstandete zurückgeben.")}</p></div>
      ${empPill(state.tone, empText(state.name))}</div>
    ${inv.contractVoid ? `<p class="emp-approve-warn">${empT(`已作废：${empStamp(inv.contractVoid.at)} · ${empEsc(inv.contractVoid.reason)}`, `Storniert: ${empStamp(inv.contractVoid.at)} · ${empEsc(inv.contractVoid.reason)}`)}</p>` : ""}
    ${!inv.contractSentAt && !empContractArchived(e) ? `<div class="emp-dispatch-prepare">
      <div class="button-row">${upload("contract", empT("劳动合同发出件", "Arbeitsvertrag"))}${upload("questionnaire", empT("个人问卷发出件", "Personalfragebogen"))}</div>
      ${!inv.questionnaireTemplate && defaultQuestionnaire ? `<div class="emp-dispatch-default">
        <span>${empT("组织默认问卷", "Standard der Organisation")}：<strong>${empEsc(defaultQuestionnaire.name)}</strong> ${empT("（发送时自动带出，发出后固定当次版本）", "(wird beim Senden übernommen und eingefroren)")}</span>
        <button class="ghost-btn emp-dispatch-use-default" data-id="${empEsc(e.id)}">${empT("使用默认问卷", "Standard übernehmen")}</button>
      </div>` : ""}
      ${missing.length ? `<p class="emp-approve-warn">${empT(`公司资料缺：${missing.join("、")}。请先补全公司资料（合规设置）。`, `Firmendaten fehlen: ${missing.join(", ")}.`)} <a href="#${slug("employee", "合规设置")}">${empT("去补公司资料", "Firmendaten ergänzen")}</a></p>` : ""}
      <button class="primary-btn emp-dispatch-send" data-id="${empEsc(e.id)}"${(inv.contractTemplate && (inv.questionnaireTemplate || defaultQuestionnaire) && !missing.length && empCan("sendContract")) ? "" : " disabled"}>${empT("发送合同与问卷给员工", "Vertrag und Fragebogen senden")}</button>
      ${empCan("sendContract") ? "" : `<p class="emp-disabled-reason">${empEsc(empDenyReason("sendContract"))}</p>`}
    </div>` : ""}
    ${inv.contractSentAt || empContractArchived(e) ? `<div class="emp-dispatch-rows">${row("contract", empT("劳动合同", "Arbeitsvertrag"))}${row("questionnaire", empT("个人调查问卷", "Personalfragebogen"))}</div>` : ""}
    ${inv.contractSentAt && !inv.contractSignedSubmittedAt ? `<p class="small">${empT("等员工下载、签字并上传两份签回件；两份齐了才会进入核对。", "Warten auf beide unterschriebene Dateien.")}</p>` : ""}
    ${inv.contractSignedSubmittedAt && !empContractArchived(e) ? `<p class="small">${empT(`签回提交于 ${empStamp(inv.contractSignedSubmittedAt)}。两份都通过后自动归档。`, `Zurück am ${empStamp(inv.contractSignedSubmittedAt)}. Nach zwei Freigaben automatisch abgelegt.`)}</p>` : ""}
    ${empContractArchived(e) ? `<p class="small">${empT(`${inv.dispatchMode === "offline" ? "线下签署" : "线上核对"}归档于 ${empStamp(inv.contractSignedReviewedAt || inv.offlineSignedAt || inv.archivedAt)}（${inv.archivedBy || "—"}）。`, `${inv.dispatchMode === "offline" ? "Offline" : "Online"} abgelegt am ${empStamp(inv.contractSignedReviewedAt || inv.offlineSignedAt || inv.archivedAt)} (${inv.archivedBy || "—"}).`)}</p>` : ""}
    ${!inv.contractSentAt && !empContractArchived(e) ? `<details class="emp-dispatch-offline">
      <summary>${empT("线下纸质签署：直接上传两份签署扫描件，一步归档", "Offline unterschrieben: zwei Scans hochladen und direkt ablegen")}</summary>
      <p class="small">${empT("只在还没发出电子件时可用；上传后标“线下签署”，不产生待签回和待核对待办（HR-ONB-38）。", "Nur ohne laufenden Versand; wird als „offline“ markiert (HR-ONB-38).")}</p>
      <div class="button-row">${upload("offlineContract", empT("已签劳动合同扫描件", "Unterschriebener Vertrag"))}${upload("offlineQuestionnaire", empT("已签问卷扫描件", "Unterschriebener Fragebogen"))}</div>
      <button class="ghost-btn emp-dispatch-offline-btn" data-id="${empEsc(e.id)}"${sensitiveOK ? "" : " disabled"}>${empT("线下签署，直接归档", "Offline ablegen")}</button>
      ${sensitiveOK ? "" : `<p class="emp-disabled-reason">${empEsc(empDenyReason("sensitive"))}</p>`}
    </details>` : ""}
    ${voidBox}
  </section>`;
}

function empSendContractDispatch(id) {
  const e = empById(id);
  if (!e?.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("sendContract")) return { ok: false, code: "permission", message: empDenyReason("sendContract") };
  if (e.invite.state !== "approved") return { ok: false, code: "state", message: empT("资料审核通过后才能发合同", "Erst nach Freigabe") };
  /* 同一档案同时至多一条未作废的发送记录；重发必须先作废（HR-ONB-53） */
  if (e.invite.contractSentAt && !e.invite.contractVoid) {
    return { ok: false, code: "active", message: empT("已有一条未作废的发送记录。要重发请先作废这次发送。", "Es gibt bereits einen laufenden Versand — bitte zuerst stornieren.") };
  }
  const template = empQuestionnaireTemplate();
  const defaultQuestionnaire = template.file;
  if (!e.invite.contractTemplate || (!e.invite.questionnaireTemplate && !defaultQuestionnaire)) {
    return { ok: false, code: "files", message: empT("劳动合同要上传；问卷可以用组织默认问卷", "Arbeitsvertrag nötig; Fragebogen aus Standard möglich") };
  }
  const missing = empDispatchCompanyMissing(e);
  if (missing.length) return { ok: false, code: "company", message: empT(`公司资料缺：${missing.join("、")}`, `Firmendaten fehlen: ${missing.join(", ")}`) };
  const next = JSON.parse(JSON.stringify(e));
  if (!next.invite.questionnaireTemplate && defaultQuestionnaire) {
    next.invite.questionnaireTemplate = { ...defaultQuestionnaire, at: empNow(), by: empActorLabel(), fromDefault: true, versionId: template.versionId || "" };
    /* 发送记录只保存组织级问卷版本引用；之后换默认问卷不影响这次发出的内容（HR-ONB-50） */
    next.invite.questionnaireVersionId = template.versionId || "";
    next.invite.questionnaireSource = "default";
  } else if (next.invite.questionnaireTemplate?.fromDefault) {
    next.invite.questionnaireVersionId = next.invite.questionnaireTemplate.versionId || template.versionId || "";
    next.invite.questionnaireSource = "default";
  } else {
    next.invite.questionnaireVersionId = "";
    next.invite.questionnaireSource = "uploaded";
  }
  /* 每次发送（含作废后重发）生成新的唯一发送 ID；作废不复用旧值 */
  next.invite.dispatchId = empContractDispatchId();
  next.invite.contractSentAt = empNow();
  next.invite.onboardingFilesVersion = 1;
  next.invite.contractReview = {};
  next.invite.contractSignedSubmittedAt = null;
  next.invite.contractSignedReviewedAt = null;
  next.invite.archivedAt = null;
  next.invite.archivedBy = "";
  next.invite.dispatchMode = "online";
  next.invite.contractVoid = null;
  empLogEvent(next, "contract.sent", `${next.invite.contractTemplate.name} + ${next.invite.questionnaireTemplate.name}`, empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

function empReviewContractAsset(id, key, decision, reason) {
  const e = empById(id);
  if (!e?.invite) return { ok: false, code: "missing" };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (!empCan("sensitive")) return { ok: false, code: "permission", message: empDenyReason("sensitive") };
  const label = key === "contract" ? "劳动合同" : "个人调查问卷";
  const inv = e.invite;
  /* 只核对“这一次发送”的签回件：没发过、已归档、已作废都不能再点通过（HR-ONB-36/37/53） */
  if (!inv.contractSentAt || inv.contractVoid) {
    return { ok: false, code: "state", message: empT("没有正在进行的合同发送记录，先发送合同。", "Kein laufender Vertragsversand.") };
  }
  if (empContractArchived(e)) {
    return { ok: false, code: "archived", message: empT("这次发送已经归档，不能重复核对。", "Bereits abgelegt — keine erneute Prüfung.") };
  }
  /* 两份都上传才算签回；只有一份时不能逐份通过（HR-ONB-36） */
  if (!empContractSignedReady(e)) {
    return { ok: false, code: "files", message: empT("两份签回件都上传后才能核对。", "Erst prüfen, wenn beide Dateien vorliegen.") };
  }
  const signed = empContractSignedDoc(e, key);
  if (!signed.file) return { ok: false, code: "file", message: empT("这一份员工还没上传", "Noch nicht hochgeladen") };
  const previous = inv.contractReview?.[key];
  /* 只接受属于当前发送的版本；作废重发后旧草稿、旧件不能混进来（HR-ONB-37/53） */
  if (!empContractFileIsCurrent(e, signed, key)) {
    if (previous?.state === "returned" && signed.at && previous.at
      && String(signed.at) <= String(previous.at)
      && String(previous.dispatchId || "") === String(inv.dispatchId || "")) {
      return { ok: false, code: "reupload", message: empT("员工还没重传这一份，不能再次核对。", "Noch keine neue Datei — bitte neu hochladen lassen.") };
    }
    return { ok: false, code: "stale_file", message: empT("这份不是本次发送的签回件，员工需要重新上传。", "Diese Datei gehört nicht zum aktuellen Versand — bitte neu hochladen lassen.") };
  }
  if (previous?.state === "approved") {
    return { ok: false, code: "decided", message: empT("这一份已经核对通过，不能重复通过。", "Bereits geprüft.") };
  }
  if (!inv.contractSignedSubmittedAt) {
    return { ok: false, code: "state", message: empT("员工还没有提交签回件。", "Noch keine Abgabe der unterschriebenen Dateien.") };
  }
  const note = String(reason || "").trim();
  if (decision === "returned" && !note) return { ok: false, code: "reason", message: empT("退回必须写原因", "Begründung nötig") };
  const next = JSON.parse(JSON.stringify(e));
  /* 员工签回写一条事件（HR-DATA-14）；同一份签回只记一次 */
  if (e.invite.contractSignedSubmittedAt && next.invite.contractSignedLoggedFor !== e.invite.contractSignedSubmittedAt) {
    next.invite.contractSignedLoggedFor = e.invite.contractSignedSubmittedAt;
    empLogEvent(next, "contract.signed", `签回提交于 ${empStamp(e.invite.contractSignedSubmittedAt)}`, empActorLabel());
  }
  next.invite.contractReview = { ...(next.invite.contractReview || {}) };
  next.invite.contractReview[key] = {
    state: decision === "approved" ? "approved" : "returned",
    reason: decision === "approved" ? "" : note,
    at: empNow(), by: empActorLabel(),
    dispatchId: inv.dispatchId || "",
    fileAt: signed.at || ""
  };
  const docKey = key === "contract" ? "contract" : "personalquestionnaire";
  next.docs = { ...(next.docs || {}) };
  next.docs[docKey] = { ...(next.docs[docKey] || {}) };
  if (decision === "approved") {
    next.docs[docKey].state = "ok";
    next.docs[docKey].needsReview = false;
    next.docs[docKey].reviewedAt = empNow();
    next.docs[docKey].reviewedBy = empActorLabel();
  } else {
    next.docs[docKey].state = "returned";
    next.docs[docKey].reason = note;
    next.docs[docKey].needsReview = false;
    /* 退回一份不结束这一批：另一份还能继续核对，两份都能一次退回（HR-ONB-53） */
  }
  const both = ["contract", "questionnaire"].every(k => next.invite.contractReview[k]?.state === "approved");
  if (both) {
    next.invite.contractSignedReviewedAt = empNow();
    next.invite.archivedAt = empNow();
    next.invite.archivedBy = empActorLabel();
    next.invite.dispatchMode = "online";
    empLogEvent(next, "contract.archived", "两份签回件均通过核对", empActorLabel());
  } else if (decision === "returned") {
    empLogEvent(next, "contract.returned", `${label}：${note}`, empActorLabel());
  }
  empSaveWithHistory(next, empActorLabel());
  return { ok: true, archived: both };
}

function empVoidContractDispatch(id, reason) {
  const e = empById(id);
  if (!e?.invite) return { ok: false, code: "missing" };
  /* 作废不读取文件内容，只需要操作与门店权限；关掉“查看敏感资料”的店长仍可作废（HR-ACCESS-55） */
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  const note = String(reason || "").trim();
  if (!note) return { ok: false, code: "reason", message: empT("作废要写原因", "Begründung nötig") };
  const inv = e.invite;
  if (!inv.contractSentAt && !empContractArchived(e)) return { ok: false, code: "state" };
  const next = JSON.parse(JSON.stringify(e));
  const contractFile = next.invite.contractTemplate;
  const questionnaireFile = next.invite.questionnaireTemplate;
  next.invite.contractTemplateHistory = contractFile ? [contractFile, ...(next.invite.contractTemplateHistory || [])] : (next.invite.contractTemplateHistory || []);
  next.invite.questionnaireTemplateHistory = questionnaireFile ? [questionnaireFile, ...(next.invite.questionnaireTemplateHistory || [])] : (next.invite.questionnaireTemplateHistory || []);
  next.invite.contractVoid = {
    at: empNow(), by: empActorLabel(), reason: note,
    dispatchId: next.invite.dispatchId || "",
    files: [contractFile, questionnaireFile].filter(Boolean).map(f => f.name)
  };
  next.invite.contractTemplate = null;
  next.invite.questionnaireTemplate = null;
  next.invite.dispatchId = "";
  next.invite.contractSentAt = null;
  next.invite.contractSignedSubmittedAt = null;
  next.invite.contractSignedReviewedAt = null;
  next.invite.archivedAt = null;
  next.invite.archivedBy = "";
  /* 线下归档标记也要清，否则两端仍显示“已归档”，新人合同项还打勾（HR-ONB-37/53） */
  next.invite.dispatchMode = "";
  next.invite.offlineSignedAt = null;
  /* 待用的线下扫描件属于被作废的这次准备，必须清掉，不能在下一次归档里复用（HR-ONB-37/53） */
  next.invite.offlineContractFile = null;
  next.invite.offlineQuestionnaireFile = null;
  next.invite.contractReview = {};
  /* 签回件转已取消，旧件保留在历史里 */
  next.docs = { ...(next.docs || {}) };
  ["contract", "personalquestionnaire"].forEach(k => {
    const doc = next.docs[k];
    if (doc?.file) {
      next.documentArchive = [{ docId: k, ...doc, state: "cancelled", archivedAt: empNow() }, ...(next.documentArchive || [])];
      next.docs[k] = { ...doc, state: "missing", needsReview: false };
    }
  });
  empLogEvent(next, "contract.void", note, empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

function empOfflineContractArchive(id, contractFile, questionnaireFile) {
  const e = empById(id);
  if (!e?.invite) return { ok: false, code: "missing" };
  if (!empCan("sensitive")) return { ok: false, code: "permission", message: empDenyReason("sensitive") };
  const scope = empStoreScopeError(e);
  if (scope) return scope;
  if (e.invite.state !== "approved") return { ok: false, code: "state", message: empT("资料审核通过后才能归档", "Erst nach Freigabe") };
  if (e.invite.contractSentAt) return { ok: false, code: "state", message: empT("已有电子发送记录，要先作废才能走线下签署", "Erst laufenden Versand stornieren") };
  if (!contractFile || !questionnaireFile) return { ok: false, code: "files", message: empT("两份签署扫描件都要上传", "Beide Scans nötig") };
  const next = JSON.parse(JSON.stringify(e));
  /* 新的线下归档是独立的一条发送记录：旧作废标记只进历史，不能继续显示旧原因、也不能
     把新的作废按钮藏起来（HR-ONB-38/53）。 */
  if (next.invite.contractVoid) {
    next.invite.contractVoidHistory = [next.invite.contractVoid, ...(next.invite.contractVoidHistory || [])];
    next.invite.contractVoid = null;
  }
  next.invite.dispatchId = empContractDispatchId();
  next.invite.contractTemplate = contractFile;
  next.invite.questionnaireTemplate = questionnaireFile;
  next.invite.contractSentAt = empNow();
  next.invite.contractSignedSubmittedAt = empNow();
  next.invite.contractSignedReviewedAt = empNow();
  next.invite.archivedAt = empNow();
  next.invite.archivedBy = empActorLabel();
  next.invite.dispatchMode = "offline";
  next.invite.offlineSignedAt = empNow();
  next.invite.onboardingFilesVersion = 1;
  next.invite.contractReview = {
    contract: { state: "approved", at: empNow(), by: empActorLabel(), offline: true,
      dispatchId: next.invite.dispatchId, fileAt: next.invite.offlineSignedAt },
    questionnaire: { state: "approved", at: empNow(), by: empActorLabel(), offline: true,
      dispatchId: next.invite.dispatchId, fileAt: next.invite.offlineSignedAt }
  };
  next.docs = { ...(next.docs || {}) };
  next.docs.contract = { ...(next.docs.contract || {}), state: "ok", file: contractFile.name, dataUrl: contractFile.dataUrl, at: empNow(), by: empActorLabel(), needsReview: false, offline: true, dispatchId: next.invite.dispatchId };
  next.docs.personalquestionnaire = { ...(next.docs.personalquestionnaire || {}), state: "ok", file: questionnaireFile.name, dataUrl: questionnaireFile.dataUrl, at: empNow(), by: empActorLabel(), needsReview: false, offline: true, dispatchId: next.invite.dispatchId };
  /* 扫描件已经从待用槽位转成归档件，清空待用槽位以免被下一次复用 */
  next.invite.offlineContractFile = null;
  next.invite.offlineQuestionnaireFile = null;
  empLogEvent(next, "contract.offline", "线下签署两份扫描件直接归档", empActorLabel());
  empSaveWithHistory(next, empActorLabel());
  return { ok: true };
}

function empMarkRetentionHandled(id, category) {
  const e = empById(id);
  if (!e) return null;
  if (empStoreScopeError(e)) return null;
  if (!empCan("ownerOnly")) return { ok: false, code: "permission", message: empDenyReason("ownerOnly") };
  const cat = EMP_RETENTION_CATEGORIES.find(c => c.id === category);
  if (!cat) return { ok: false, code: "category", message: empT("请选择要处理的资料类别", "Bitte Kategorie wählen") };
  const next = JSON.parse(JSON.stringify(e));
  const old = next.retentionHandled && next.retentionHandled.at && !next.retentionHandled[cat.id]
    ? { ...EMP_RETENTION_CATEGORIES.reduce((acc, c) => ({ ...acc, [c.id]: next.retentionHandled }), {}) }
    : { ...(next.retentionHandled || {}) };
  next.retentionHandled = { ...old, [cat.id]: { at: empNow(), by: empActorLabel(), code: "retention_due" } };
  return empSaveWithHistory(next, empActorLabel());
}

function empTabContract(e, today) {
  const c = e.contract;
  const notice = empNoticeStruct(c);
  const probationIssue = empProbationIssue(e, today);
  const probationEnd = empProbationEndEffective(e);
  const defaultEnd = e.entryDate ? empProbationDefaultEndAt(e.entryDate, empRule("probationMonths")) : "";
  return `${empContractProposalCard(e)}
    ${empContractDispatchPanel(e)}
    ${empContractVersionCard(e)}
    <section class="card">
      <div class="section-title"><div><h2>${empT("合同关键条款", "Vertragsbedingungen")}</h2>
        <p class="small">${empT("按生效日期分版本：每次保存新增一版，旧版保留，历史随时可查。", "Versioniert nach Wirksamkeitsdatum: jede Speicherung erzeugt eine neue Version, alte bleiben erhalten.")}</p></div>
        <span class="small">${empT("排班和工时校验读这里", "Grundlage für Dienstplan- und Stundenprüfung")}</span></div>
      <div class="form-grid">
        ${empInput(`${empT("生效日期（必填，可追溯）", "Wirksam ab (Pflicht, auch rückwirkend)")}<small>${empT("不早于入职日", "nicht vor Eintritt")}</small>`, "contract.validFrom", c.validFrom || empToday(), "date")}
        ${empSelect(empT("合同类型", "Vertragsart"), "contract.type", EMP_CONTRACT_TYPES.map(t => [t.id, empRaw(t.name)]), c.type)}
        ${empSelect(empT("薪资方式", "Vergütungsart"), "contract.payType", [["hourly", empT("时薪", "Stundenlohn")], ["pauschal", empT("Pauschal 月薪", "Pauschale monatlich")]], c.payType)}
        ${empInput(c.payType === "pauschal" ? empT("固定月薪 Brutto €", "Monatsbrutto €") : empT("时薪 Brutto €", "Bruttostundenlohn €"), "contract.rate", c.rate, "number")}
        ${empInput(`${empT("月工时下限", "Sollstunden min. / Monat")}<small>${empT("合同以月工时范围为准", "Maßgeblich ist der Monatsrahmen")}</small>`, "contract.hoursMin", c.hoursMin, "number")}
        ${empInput(empT("月工时上限", "Sollstunden max. / Monat"), "contract.hoursMax", c.hoursMax, "number")}
        ${empInput(`${empT("每周约定工时", "Wochenstunden")}<small>${empT("仅作参考，不覆盖月工时范围", "nur Referenz, ersetzt den Monatsrahmen nicht")}</small>`, "contract.weeklyHours", c.weeklyHours || "", "number")}
        ${empInput(empT("年假天数 Urlaubstag", "Urlaubstage"), "contract.urlaubDays", c.urlaubDays, "number")}
        ${empInput(empT("定期合同到期日（不定期就留空）", "Befristet bis (leer = unbefristet)"), "contract.befristetUntil", c.befristetUntil || "", "date")}
        ${empInput("工作地点", "contract.workLocation", c.workLocation || e.store)}
        ${empInput("岗位 / 工作内容", "contract.duties", c.duties || empText(empRole(e.role).name))}
        ${empInput("发薪时间与支付方式（按合同）", "contract.paymentTerms", c.paymentTerms || "")}
        ${empInput("加班与工时账户约定", "contract.overtimeTerms", c.overtimeTerms || "")}
        ${empInput("补贴 / 奖金约定（无则填无）", "contract.allowanceTerms", c.allowanceTerms || "")}
      </div>
      <div class="emp-notice-editor">
        <div class="section-title"><div><h3>${empT("通知期（结构化）", "Kündigungsfrist (strukturiert)")}</h3>
          <p class="small">${empT("三种可计算写法：N 周 / N 周到当月 15 日或月底 / N 个月到月底。其余约定用自由文本，只作展示，离职时由老板自己填最后工作日。", "Drei berechenbare Formen: N Wochen / N Wochen zum 15. oder Monatsende / N Monate zum Monatsende. Andere Vereinbarungen als Freitext, nur Anzeige.")}</p></div></div>
        <div class="form-grid">
          ${empSelect(empT("写法", "Form"), "contract.notice.format", [["struct", empT("结构化", "Strukturiert")], ["text", empT("自由文本", "Freitext")]], notice.format === "text" ? "text" : "struct")}
          ${empSelect(empT("单位", "Einheit"), "contract.notice.unit", [["weeks", empT("周", "Wochen")], ["months", empT("个月", "Monate")]], notice.unit)}
          ${empInput(empT("数量", "Anzahl"), "contract.notice.count", notice.count || "", "number")}
          ${empSelect(empT("截止规则", "Endregel"), "contract.notice.cutoff", [
            ["none", empT("无（N 周）", "keine (N Wochen)")],
            ["midmonth", empT("到当月 15 日或月底", "zum 15. oder Monatsende")],
            ["end", empT("到月底", "zum Monatsende")]
          ], notice.cutoff)}
          ${empInput(`${empT("自由文本 / 展示文案", "Freitext / Anzeigetext")}<small>${empT("结构化写法保存时会自动生成这句", "wird bei strukturierter Form automatisch erzeugt")}</small>`, "contract.noticePeriod", c.noticePeriod || "")}
        </div>
      </div>
      ${empContractHint(e)}
    </section>
    ${empContractExpiryCard(e)}
    <section class="card">
      <div class="section-title"><div><h2>${empT("在职与试用期", "Beschäftigung und Probezeit")}</h2>
        <p>${empT("状态按日期算出来，不用手选。试用期结束日 = 入职日 + 月数 − 1 天，默认按合规设置；有效结束日不超过入职日 + 6 个月。", "Status wird aus Daten abgeleitet. Ende der Probezeit = Eintritt + Monate − 1 Tag; wirksam höchstens Eintritt + 6 Monate.")}</p></div>
        ${empPill(empStatus(e.status).tone, empText(empStatus(e.status).name))}</div>
      <div class="form-grid">
        ${empInput(empT("入职日期", "Eintrittsdatum"), "entryDate", e.entryDate, "date")}
        ${empInput(`${empT("试用期结束", "Ende der Probezeit")}<small>${empT("留空 = 这个人没有试用期；只有老板和管理员能直接改", "leer = keine Probezeit; nur Inhaber/Admin")}</small>`, "probationEnd", e.probationEnd || "", "date")}
      </div>
      <p class="small">${empT(`按当前设置（${empRule("probationMonths")} 个月）的默认结束日：${defaultEnd ? empFormatDate(defaultEnd) : "先填入职日期"}。有效结束日：${probationEnd ? empFormatDate(probationEnd) : "—"}。`, `Standard nach Einstellung (${empRule("probationMonths")} Monate): ${defaultEnd ? empFormatDate(defaultEnd) : "erst Eintritt erfassen"}. Wirksam bis: ${probationEnd ? empFormatDate(probationEnd) : "—"}.`)}</p>
      ${probationIssue ? `<div class="emp-hint is-${probationIssue.tone}"><strong>${probationIssue.text}</strong></div>` : ""}
      ${e.probationConfirm ? `<p class="small">${empT(`提前转正登记：转正日期 ${empFormatDate(e.probationConfirm.date)}（${e.probationConfirm.by || "—"}）。`, `Vorzeitige Übernahme: ${empFormatDate(e.probationConfirm.date)} (${e.probationConfirm.by || "—"}).`)}</p>` : ""}
      ${empProbationBox(e, today)}
    </section>
    ${empLeaveSection(e, today)}
    <div hidden>${empContractOverview(e)}</div>`;
}

/* 试用期动作：按默认重算、清空、提前转正。结束日直接修改只有老板/管理员（HR-LIFE-10）。 */
function empProbationBox(e, today) {
  const ownerOnly = empCan("ownerOnly");
  const deny = ownerOnly ? "" : `<p class="emp-disabled-reason">${empEsc(empDenyReason("ownerOnly"))}</p>`;
  if (!e.probationEnd) {
    return `<div class="emp-hint">
      <strong>${empT("这个人没有设试用期", "Für diese Person ist keine Probezeit hinterlegt")}</strong>
      <span>${empT(`合同里约定了就填上结束日，或者按合规设置里的 ${empRule("probationMonths")} 个月自动算。`, `Bei vereinbarter Probezeit das Enddatum eintragen oder automatisch berechnen lassen.`)}</span>
      ${e.entryDate ? `<div class="button-row" style="margin-top:10px">
        <button class="ghost-btn emp-probation-fill" data-id="${empEsc(e.id)}"${ownerOnly ? "" : " disabled"}>${empT(`按入职日期 + ${empRule("probationMonths")} 个月填上`, `Aus Eintritt + ${empRule("probationMonths")} Monaten berechnen`)}</button>
      </div>${deny}` : ""}
    </div>`;
  }
  const days = empDaysBetween(today, empProbationEndEffective(e));
  return `<div class="emp-hint">
    <strong>${empT(`试用期到 ${empFormatDate(e.probationEnd)} · ${empDaysLabel(days)}`, `Probezeit bis ${empFormatDate(e.probationEnd)} · ${empDaysLabel(days)}`)}</strong>
    <p>${empT(`结束前要决定：留人就什么都不用做，到期自动转正；不留就得在这之前解约 —— 试用期内通知期按合规设置是 ${empRule("probationNoticeWeeks")} 周，过了这天就变成合同约定的「${empEsc(e.contract.noticePeriod || "未填")}」。`, `Vor Ablauf entscheiden: ohne Kündigung wird automatisch übernommen. In der Probezeit gilt eine Frist von ${empRule("probationNoticeWeeks")} Wochen, danach „${empEsc(e.contract.noticePeriod || "nicht erfasst")}“.`)}</p>
    <div class="emp-probation-confirm">
      <label class="field"><span>${empT("提前转正日期", "Datum der vorzeitigen Übernahme")}</span>
        <input type="date" class="emp-probation-date" value="${empToday()}"></label>
      <button class="ghost-btn emp-probation-consider" data-id="${empEsc(e.id)}"${ownerOnly ? "" : " disabled"}>${empT("提前转正（结束日改为前一天）", "Vorzeitig übernehmen (Ende = Vortag)")}</button>
      <button class="ghost-btn emp-probation-clear" data-id="${empEsc(e.id)}"${ownerOnly ? "" : " disabled"}>${empT("清空（没有试用期）", "Leeren (keine Probezeit)")}</button>
    </div>
    ${deny}
  </div>`;
}

function empContractProposalCard(e) {
  const p = e.contractProposal;
  if (!p || p.state !== "pending") return "";
  const canConfirm = empCan("confirmProposal");
  return `<section class="card emp-proposal">
    <div class="section-title"><div><h2>${empT("薪资 / 合同条件变更待确认", "Vergütung / Vertragsbedingungen zur Bestätigung")}</h2>
      <p>${empT(`${p.by || "店长"} 于 ${empStamp(p.at)} 提交，生效日期 ${empFormatDate(p.validFrom)}。老板确认后才写入新版本。`, `Eingereicht von ${p.by || "Filialleitung"} am ${empStamp(p.at)}, wirksam ab ${empFormatDate(p.validFrom)}. Erst nach Bestätigung wird eine neue Version gespeichert.`)}</p></div>
      ${empPill(canConfirm ? "orange" : "blue", canConfirm ? empT("等你确认", "Zu bestätigen") : empT("等待老板确认", "Wartet auf Inhaber"))}</div>
    <table class="table emp-table emp-proposal-table"><thead><tr><th>${empT("项目", "Feld")}</th><th>${empT("原值", "Bisher")}</th><th>${empT("改为", "Neu")}</th></tr></thead>
      <tbody>${(p.changes || []).map(d => `<tr><td>${empEsc(d.label)}</td><td>${empEsc(d.from)}</td><td><strong>${empEsc(d.to)}</strong></td></tr>`).join("")}</tbody></table>
    ${canConfirm ? `<div class="field"><label>${empT("驳回原因（可选）", "Ablehnungsgrund (optional)")}</label><input class="emp-proposal-reason"></div>
      <div class="button-row"><button class="ghost-btn danger-lite emp-proposal-reject" data-id="${empEsc(e.id)}">${empT("驳回", "Ablehnen")}</button>
        <button class="primary-btn emp-proposal-confirm" data-id="${empEsc(e.id)}">${empT("确认并写入新版本", "Bestätigen und neue Version speichern")}</button></div>`
      : `<p class="small">${empT("店长提交的薪资、合同条件改动只形成提案；老板确认前档案保持原值（HR-ACCESS-07）。", "Änderungen der Filialleitung sind Vorschläge; bis zur Bestätigung bleibt die Akte unverändert.")}</p>`}
  </section>`;
}

function empContractVersionCard(e) {
  const versions = empContractVersions(e);
  const current = empContractVersionAt(e);
  return `<details class="card emp-contract-versions">
    <summary><strong>${empT("合同版本列表", "Vertragsversionen")}</strong>
      <span class="small">${empT(`${versions.length} 版 · 当前生效 ${current?.validFrom ? empFormatDate(current.validFrom) : "—"}`, `${versions.length} Versionen · wirksam ${current?.validFrom ? empFormatDate(current.validFrom) : "—"}`)}</span></summary>
    <div class="table-scroll"><table class="table emp-table">
      <thead><tr><th>${empT("生效日期", "Wirksam ab")}</th><th>${empT("记录时间 / 来源", "Erfasst / Quelle")}</th><th>${empT("类型 / 薪资", "Art / Vergütung")}</th><th>${empT("月工时", "Sollstunden")}</th><th>${empT("年假 / 通知期", "Urlaub / Frist")}</th><th>${empT("定期到期", "Befristet bis")}</th></tr></thead>
      <tbody>${versions.map(v => {
        const d = v.data || {};
        const future = v.validFrom && v.validFrom > empToday();
        return `<tr><td><strong>${v.validFrom ? empFormatDate(v.validFrom) : "—"}</strong>${current && current.validFrom === v.validFrom && !future ? ` ${empPill("green", empT("现行", "Aktuell"))}` : ""}${future ? ` ${empPill("blue", empT("待生效", "Geplant"))}` : ""}</td>
          <td>${v.at ? empStamp(v.at) : "—"}<small>${empEsc(v.by || "—")}</small></td>
          <td>${empEsc(empRaw(empContractType(d.type).name))} · €${Number(d.rate || 0).toFixed(2)} ${d.payType === "pauschal" ? "/ 月" : "/ h"}</td>
          <td>${d.hoursMin ?? "—"}–${d.hoursMax ?? "—"} h</td>
          <td>${d.urlaubDays ?? "—"} / ${empEsc(d.noticePeriod || "—")}</td>
          <td>${d.befristetUntil ? empFormatDate(d.befristetUntil) : empT("不定期", "unbefristet")}</td></tr>`;
      }).join("")}</tbody>
    </table></div>
    <p class="small">${empT("旧版保留备查；排班、工资等按“生效日期不晚于当天的最新一版”取值（HR-CONTRACT-03）。", "Alte Versionen bleiben erhalten; verwendet wird die neueste Version mit Wirksamkeit ≤ Tag (HR-CONTRACT-03).")}</p>
  </details>`;
}

/* 定期合同到期后三选一：续签 / 转不定期 / 办离职（HR-LIFE-36/37）。 */
function empContractExpiryCard(e) {
  const until = e.contract?.befristetUntil;
  if (!until) return "";
  const today = empToday();
  const expired = today > until;
  const soon = !expired && empDaysBetween(today, until) <= Number(empRule("docSoonDays"));
  if (!expired && !soon) return "";
  return `<section class="card ${expired ? "emp-expired" : ""}">
    <div class="section-title"><div><h2>${empT(expired ? "定期合同已到期" : "定期合同即将到期", expired ? "Befristeter Vertrag abgelaufen" : "Befristung läuft aus")}</h2>
      <p>${empT(`到期日 ${empFormatDate(until)}。到期日当天仍有效，次日起不能再排新班；请三选一：续签、转不定期或办离职。`, `Bis ${empFormatDate(until)} gültig; ab dem Folgetag keine neuen Dienste. Bitte eine Option wählen: verlängern, entfristen oder Austritt.`)}</p></div>
      ${empPill(expired ? "red" : "orange", expired ? empT("已到期", "Abgelaufen") : empT("即将到期", "Läuft aus"))}</div>
    <div class="emp-expiry-actions">
      <div class="emp-expiry-renew">
        <label class="field"><span>${empT("续签：新的到期日", "Verlängern: neues Ende")}</span>
          <input type="date" class="emp-expiry-date" value="${empShiftDate(until, 365)}"></label>
        <button class="ghost-btn emp-expiry-renew-btn" data-id="${empEsc(e.id)}">${empT("续签并新增版本", "Verlängern und Version anlegen")}</button>
      </div>
      <label class="field"><span>${empT("本次变更生效日期（必填，不早于入职日）", "Wirksam ab (Pflicht, nicht vor Eintritt)")}</span>
        <input type="date" class="emp-expiry-effective" value="${empToday()}"></label>
      <button class="ghost-btn emp-expiry-permanent" data-id="${empEsc(e.id)}">${empT("转为不定期（清空到期日）", "Entfristen (Ende leeren)")}</button>
      <button class="ghost-btn danger-lite emp-expiry-leave" data-id="${empEsc(e.id)}">${empT("办离职（预选合同到期）", "Austritt (Ende der Befristung)")}</button>
    </div>
    <p class="small">${empT("续签和转不定期都会新增一版合同条件；生效日期按上面填的日期，不能早于入职日。店长操作时同样先形成老板待确认提案。", "Verlängern/Entfristen erzeugt eine neue Version zum oben gewählten Datum; bei Filialleitung als Vorschlag.")}</p>
  </section>`;
}

/* ------------------------------------------------------------ 离职 ----- */
function empLeaveSection(e, today) {
  if (e.leave) return empLeaveSummary(e, today);
  const proposal = e.leaveProposal;
  if (proposal?.state === "pending") {
    const canConfirm = empCan("confirmProposal");
    const l = proposal.leave || {};
    return `<section class="card emp-danger emp-proposal">
      <div class="section-title"><div><h2>${empT("离职办理待老板确认", "Austritt zur Bestätigung")}</h2>
        <p>${empT(`${proposal.by || "店长"} 于 ${empStamp(proposal.at)} 提交。老板确认后才写入离职记录。`, `Eingereicht von ${proposal.by || "Filialleitung"} am ${empStamp(proposal.at)}. Erst nach Bestätigung wird der Austritt gespeichert.`)}</p></div>
        ${empPill(canConfirm ? "orange" : "blue", canConfirm ? empT("等你确认", "Zu bestätigen") : empT("等待老板确认", "Wartet auf Inhaber"))}</div>
      <table class="table emp-table"><tbody>
        <tr><th>${empT("通知日", "Kündigung am")}</th><td>${empFormatDate(l.noticeDate)}</td></tr>
        <tr><th>${empT("最后工作日", "Letzter Arbeitstag")}</th><td><strong>${empFormatDate(l.lastDay)}</strong></td></tr>
        <tr><th>${empT("是否试用期内", "In der Probezeit")}</th><td>${l.inProbation ? empT("是（按通知日判断）", "Ja (nach Kündigungsdatum)") : empT("否", "Nein")}</td></tr>
        <tr><th>${empT("原因", "Grund")}</th><td>${empEsc(l.reason || "—")}</td></tr>
      </tbody></table>
      ${canConfirm ? `<div class="field"><label>${empT("驳回原因（可选）", "Ablehnungsgrund (optional)")}</label><input class="emp-leave-reject-reason"></div>
        <div class="button-row"><button class="ghost-btn danger-lite emp-leave-reject" data-id="${empEsc(e.id)}">${empT("驳回", "Ablehnen")}</button>
          <button class="primary-btn danger-solid emp-leave-confirm-proposal" data-id="${empEsc(e.id)}">${empT("确认离职", "Austritt bestätigen")}</button></div>`
        : `<p class="small">${empT("店长办理离职只形成提案，老板确认后生效（HR-ACCESS-07）。", "Austritt der Filialleitung ist ein Vorschlag; wirksam nach Bestätigung.")}</p>`}
    </section>`;
  }
  if (!empCan("offboard")) {
    return `<section class="card emp-danger"><div class="section-title"><div><h2>${empT("办理离职", "Austritt erfassen")}</h2>
      <p class="emp-disabled-reason">${empEsc(empDenyReason("offboard"))}</p></div></div></section>`;
  }
  const notice = empToday();
  const prefill = e.contract?.befristetUntil && e.contract.befristetUntil >= notice ? e.contract.befristetUntil : empShiftDate(notice, 30);
  return `<section class="card emp-danger">
    <div class="section-title"><div><h2>${empT("办理离职", "Austritt erfassen")}</h2>
      <p>${empT("最后工作日当天及以前仍在岗，名册标离开日期；次日起才是已离职。店长提交只形成待老板确认的提案。", "Bis zum letzten Arbeitstag inklusive bleibt die Person im Team; ab dem Folgetag ausgeschieden. Filialleitung: Vorschlag zur Bestätigung.")}</p></div>
      <button class="ghost-btn danger-lite emp-leave-open">${empT("办理离职", "Austritt erfassen")}</button></div>
    <div class="emp-leave-form is-hidden" data-id="${empEsc(e.id)}">
      <div class="form-grid">
        ${empInput(empT("通知日期", "Datum der Kündigung"), "leave.noticeDate", notice, "date")}
        ${empInput(empT("最后工作日", "Letzter Arbeitstag"), "leave.lastDay", prefill, "date")}
        ${empInput(empT("原因（可选）", "Grund (optional)"), "leave.reason", "")}
      </div>
      <p class="small">${empT("最后工作日由你填写，系统不再自动算“最早可离开日”，也不记录谁提出（答复 B07 / B08：未来再做）。", "Der letzte Arbeitstag wird von Ihnen eingetragen; es gibt keine automatische Berechnung und keine Angabe, wer gekündigt hat.")}</p>
      <div class="button-row"><button class="ghost-btn emp-leave-cancel">${empT("取消", "Abbrechen")}</button>
        <button class="primary-btn danger-solid emp-leave-confirm" data-id="${empEsc(e.id)}">${empT(empCan("confirmProposal") ? "确认离职" : "提交老板确认", empCan("confirmProposal") ? "Austritt bestätigen" : "Zur Bestätigung senden")}</button></div>
    </div>
  </section>`;
}

function empLeaveSummary(e, today) {
  const l = e.leave;
  const inProbation = l.inProbation === true || (l.inProbation === undefined && empLeaveInProbation(e, l.noticeDate));
  const retention = empRetentionRows(e);
  const due = retention.filter(r => r.until && r.until <= today);
  return `<section class="card emp-left-block">
    <div class="section-title"><div><h2>${empT("离职记录", "Austritt")}</h2>
      <p>${empT(`通知日 ${empFormatDate(l.noticeDate)} · 最后工作日 ${empFormatDate(l.lastDay)}${inProbation ? " · 试用期内" : ""}。`, `Kündigung ${empFormatDate(l.noticeDate)} · letzter Tag ${empFormatDate(l.lastDay)}${inProbation ? " · in der Probezeit" : ""}.`)}</p></div>
      ${empPill(e.status === "left" ? "red" : "orange", e.status === "left" ? empT("已离职", "Ausgeschieden") : empT(`最后工作日 ${empFormatDate(l.lastDay)}`, `Letzter Tag ${empFormatDate(l.lastDay)}`))}</div>
    ${l.reason ? `<p class="small">${empT("原因", "Grund")}：${empEsc(l.reason)}</p>` : ""}
    <div class="emp-revoke-leave">
      <label class="field"><span>${empT("撤销离职必须写原因", "Rücknahme nur mit Begründung")}</span><input class="emp-undo-leave-reason"></label>
      <button class="ghost-btn emp-undo-leave" data-id="${empEsc(e.id)}">${empT("撤销离职", "Austritt rückgängig")}</button>
      ${empAccountState(e) === "disabled" ? `<p class="small">${empT("账号已关闭：撤销后请老板或管理员到“成员与权限”重新开通。", "Konto deaktiviert: nach Rücknahme unter „Mitglieder & Rechte“ neu aktivieren.")}</p>` : ""}
    </div>
  </section>
  <section class="card emp-retention">
    <div class="section-title"><div><h2>${empT("离职资料保存期", "Aufbewahrungsfrist")}</h2>
      <p>${empT("从最后工作日起算，按五类资料分别设置年限；税务师给数字前占位 10 年。一期到期只提醒老板点“已处理”，不真的删除。", "Ab letztem Arbeitstag, je Kategorie; bis zur Steuerberatung Platzhalter 10 Jahre. In Phase 1 nur „erledigt“ vermerken, keine Löschung.")}</p></div></div>
    <table class="table emp-table"><thead><tr><th>${empT("资料类别", "Kategorie")}</th><th>${empT("年限", "Jahre")}</th><th>${empT("保留至", "Aufbewahren bis")}</th></tr></thead>
      <tbody>${retention.map(r => `<tr class="${due.some(d => d.id === r.id) ? "is-due" : ""}"><td>${empText(r.name)}</td><td>${r.years}</td><td>${empFormatDate(r.until)}</td></tr>`).join("")}</tbody></table>
    ${due.length ? `<div class="emp-retention-due"><strong>${empT("保存期到期，请确认清理", "Aufbewahrungsfrist erreicht")}</strong>
      ${due.map(r => {
        const handled = empRetentionHandledFor(e, r.id);
        return `<div class="emp-retention-cat"><span>${empText(r.name)}</span>${handled
          ? `<span class="small">${empT(`已处理：${empStamp(handled.at)}（${handled.by || "—"}）。`, `Erledigt: ${empStamp(handled.at)} (${handled.by || "—"}).`)}</span>`
          : empCan("ownerOnly") ? `<button class="ghost-btn emp-retention-handle" data-id="${empEsc(e.id)}" data-category="${r.id}">${empT("已处理", "Erledigt")}</button>`
            : `<span class="small">${empEsc(empDenyReason("ownerOnly"))}</span>`}</div>`;
      }).join("")}</div>`
      : `<p class="small">${empT("还没到期。到期当天会给老板生成待办。", "Noch nicht fällig. Am Fälligkeitstag entsteht eine Aufgabe für den Inhaber.")}</p>`}
  </section>`;
}

const EMP_DOC_LAYER_META = {
  submit: { zh: "提交时必须有", de: "Bei Einreichung" },
  beforeStart: { zh: "第一个上班日前必须有", de: "Vor Arbeitsbeginn" },
  later: { zh: "之后补", de: "Später nachreichbar" }
};

function empDocLayerTag(type) {
  const meta = EMP_DOC_LAYER_META[type.layer];
  if (!meta) return "";
  return `<span class="emp-doc-layer is-${type.layer}">${empText(meta)}</span>`;
}

function empDocFileBlock(e, type, doc, st) {
  const sensitive = empCan("sensitive");
  const file = doc.file
    ? (sensitive ? empFileLink(doc) : `<span class="emp-file is-hidden-name">${empT("已上传（文件名已隐藏）", "Hochgeladen (Dateiname ausgeblendet)")}</span>`)
    : "";
  const uploadLabel = doc.file ? empT("替换文件", "Datei ersetzen") : empT("上传文件", "Datei hochladen");
  const accept = type.imageOnly ? "image/png,image/jpeg" : "application/pdf,image/png,image/jpeg";
  return `<div class="emp-doc-file">
      ${file || `<span class="emp-doc-nofile">${st.level === "missing" ? empT("还没有文件", "Noch keine Datei") : e.migrated ? empT("档案里只有记录，没有文件", "Nur Eintrag, keine Datei") : empT("缺少文件", "Datei fehlt")}</span>`}
      <label class="ghost-btn">${uploadLabel}<input type="file" class="emp-shared-doc-upload" data-id="${empEsc(e.id)}" data-doc="${type.id}" accept="${accept}" hidden></label>
      ${doc.version ? `<span class="emp-doc-version">v${Number(doc.version) || 2}</span>` : ""}
    </div>`;
}

function empDocHistory(e, docId) {
  const list = (e.documentArchive || []).filter(a => a.docId === docId);
  if (!list.length) return "";
  const sensitive = empCan("sensitive");
  return `<details class="emp-doc-history"><summary>${empT(`历史版本（${list.length}）`, `Frühere Versionen (${list.length})`)}</summary>
    <ul>${list.map(a => `<li><span class="pill gray">${empT("已被替换", "Ersetzt")}</span>
      <span>v${Number(a.version) || 1}</span>
      ${a.file ? (sensitive ? empFileLink(a) : `<span>${empT("文件名已隐藏", "Dateiname ausgeblendet")}</span>`) : `<span>${empT("无文件", "keine Datei")}</span>`}
      ${a.expiry ? `<span>${empFormatDate(a.expiry)}</span>` : ""}
      ${a.replacedBy ? `<span>· ${empEsc(a.replacedBy)}</span>` : ""}
      ${a.reason ? `<span>· ${empEsc(a.reason)}</span>` : ""}</li>`).join("")}</ul>
  </details>`;
}

function empTabDocs(e, today) {
  const nationality = empNationalityClass(e);
  const studentAnswered = empStudentAnswered(e);
  const zusatz = empZusatzValue(e);
  const identityNote = nationality === ""
    ? `<div class="emp-hint is-warn"><strong>${empT("待确认国籍", "Staatsangehörigkeit offen")}</strong>
        <p>${empT("国籍还没回答：回答前不按欧盟或其他国籍计算材料。请到“个人资料”补齐国籍类别。", "Noch nicht beantwortet: bis dahin werden keine EU-/Nicht-EU-Unterlagen berechnet. Bitte unter „Stammdaten“ ergänzen.")}</p>
        <a href="${empStaffHref(e.id)}&tab=profile">${empT("去个人资料回答", "Zu den Stammdaten")}</a></div>`
    : `<div class="emp-hint"><strong>${empT("身份与证件要求", "Identität und Unterlagen")}</strong>
        <p class="small">${empT(`国籍：${nationality === "eu" ? "欧盟 / 欧洲经济区 / 瑞士" : "其他国籍"} · 学生：${studentAnswered ? (empStudentValue(e) ? "是" : "否") : "待确认"} · 附加页：${zusatz === "yes" ? "是" : zusatz === "no" ? "否" : "待核对"}`,
                              `Staatsangehörigkeit: ${nationality === "eu" ? "EU / EWR / Schweiz" : "sonstige"} · Studium: ${studentAnswered ? (empStudentValue(e) ? "ja" : "nein") : "offen"} · Zusatzblatt: ${zusatz === "yes" ? "ja" : zusatz === "no" ? "nein" : "offen"}`)}</p>
        <p class="small">${empT("国籍、学生身份在“个人资料”回答；附加页只对其他国籍适用，由店长核对居留证件后勾选。", "Staatsangehörigkeit/Studium unter „Stammdaten“; Zusatzblatt nur bei sonstiger Staatsangehörigkeit nach Prüfung durch die Leitung.")} <a href="${empStaffHref(e.id)}&tab=profile">${empT("去个人资料", "Zu den Stammdaten")}</a></p></div>`;
  return `<section class="card emp-doc-card emp-doc-wide">
      <div class="section-title"><div><h2>${empT("证件", "Dokumente")}</h2>
        <span class="small">${empT("材料叫法按 HR-DOC-01；每项材料都显示它属于哪一层必填。", "Bezeichnungen nach HR-DOC-01; jede Unterlage zeigt ihre Pflichtstufe.")}</span></div>
       </div>
      ${identityNote}
      ${EMP_DOC_TYPES.filter(type=>type.id!=="kv").map(type => empDocRow(e, type, today)).join("")}
      ${e.docs?.kv?.file ? `<details class="emp-hint"><summary>${empT("原医保卡文件（保留）", "Bisherige Krankenversicherungskarte (archiviert)")}</summary>${empCan("sensitive") ? empFileLink(e.docs.kv) : `<span>${empT("文件名已隐藏", "Dateiname ausgeblendet")}</span>`}</details>` : ""}
      ${e.docs?.bank?.file ? `<details class="emp-hint"><summary>${empT("原银行卡 / 账户证明（保留）", "Bisheriger Banknachweis (archiviert)")}</summary>${empCan("sensitive") ? empFileLink(e.docs.bank) : `<span>${empT("文件名已隐藏", "Dateiname ausgeblendet")}</span>`}</details>` : ""}
      <p class="emp-doc-foot">${empT("只有迁移进系统的老员工允许“仅记录、无文件”，并单独标记；新员工每一项材料都必须有文件。已上传但没填有效期的显示“有效期待补充”。银行卡只收正面照片，医保卡正反面可以之后补；上传限 PDF / PNG / JPEG，最大 20 MB。",
                                    "Nur migrierte Bestandsdaten dürfen „nur Eintrag, keine Datei“ sein und werden separat markiert; neue Beschäftigte brauchen zu jeder Unterlage eine Datei. Bankkarte nur Vorderseite, Krankenkarte beidseitig später. PDF/PNG/JPEG, max. 20 MB.")}
        <a href="#${slug("employee", "合规设置")}">${empT("改提前期", "Vorwarnzeit ändern")}</a></p>
    </section>`;
}

function empTabHistory(e) {
  const log = [...(e.history || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const sensitive = empCan("sensitive");
  return `<section class="card">
      <div class="section-title"><div><h2>${empT("变更记录", "Änderungsverlauf")}</h2>
        <p>${empT("只记有法律或金钱意义的字段和事件：状态、门店、岗位、合同条件、薪资、工时、年假、IBAN，以及离职、合同发送与签回、核对归档、特殊审批、入职审核通过、出生日期修改、离职撤销。电话、地址、邮箱、紧急联系人电话不记。", "Erfasst werden rechtlich/finanziell relevante Felder und Ereignisse; Kontaktdaten wie Telefon, Adresse, E-Mail und Notfalltelefon nicht.")}</p>
        <p class="small">${sensitive ? empT("当前视角有“查看敏感资料”权限，敏感字段显示完整值。", "Mit Berechtigung werden vertrauliche Werte vollständig angezeigt.") : empT("当前视角没有“查看敏感资料”权限：敏感字段只显示“已修改”和脱敏值。", "Ohne Berechtigung: vertrauliche Felder nur als „geändert“ mit maskiertem Wert.")}</p></div>
        <span class="small">${log.length}</span></div>
      ${log.length ? `<div class="table-scroll"><table class="table emp-table">
        <thead><tr><th>${empT("时间", "Zeitpunkt")}</th><th>${empT("字段 / 事件", "Feld / Ereignis")}</th><th>${empT("改前", "Vorher")}</th><th>${empT("改后", "Nachher")}</th><th>${empT("操作人", "Durch")}</th></tr></thead>
        <tbody>${log.map(h => {
          const event = EMP_EVENTS[h.field];
          const isEvent = !!event || h.kind === "event";
          const f = event ? { name: event } : empTrackedField(h.field);
          const masked = empSensitivePath(h.field) && !sensitive;
          const before = isEvent ? "—" : masked ? empT("已修改", "Geändert") : empEsc(empHistoryValue(h.field, h.from));
          const after = isEvent
            ? `<strong>${empEsc(h.detail || empHistoryValue(h.field, h.to) || "—")}</strong>`
            : masked
              ? `<span class="emp-history-mask">${empT("已修改", "Geändert")} · ${empEsc(empMaskValue(h.field, h.to))}</span>`
              : `<strong>${empEsc(empHistoryValue(h.field, h.to))}</strong>`;
          const when = h.effectiveDate
            ? `${empFormatDate(h.effectiveDate)} <small class="emp-effective-tag">${empT("生效", "wirksam")}</small>`
            : empStamp(h.at);
          return `<tr>
          <td>${when}</td>
          <td>${f ? empText(f.name) : empEsc(h.field)}</td>
          <td>${before}</td>
          <td>${after}</td>
          <td>${empPill(empActorTone(h.by), empEsc(h.by || "—"))}</td>
        </tr>`; }).join("")}</tbody>
      </table></div>` : `<p class="emp-empty">${empT("还没有变更记录。改了合同、薪资或状态之后会出现在这里。", "Noch keine Änderungen. Nach Anpassung von Vertrag, Vergütung oder Status erscheinen sie hier.")}</p>`}
    </section>`;
}

/* CSV：给税务师、保险或劳工局检查的员工名单。UTF-8 BOM，不然 Excel 打开中文是乱码。
   ⚠️ 传的是「要导哪些人」，不是门店 —— 上一版签名是 (store)，结果屏幕上筛出 1 个人、
   导出来 17 个，筛选和搜索完全没算数。导出必须等于你眼前看到的这一份。 */
/* 敏感列只对拥有导出授权的老板/管理员输出；店长默认留空（HR-DATA-30/32、HR-ACCESS-04）。
   权限检查放在函数内，不能只靠按钮置灰。 */
function empCanExportSensitive() {
  return empCan("exportSensitive");
}

function empRosterCsv(list, opts) {
  const today = empToday();
  if (!empCan("export")) return "";
  /* 参数只能缩小输出，不能放大权限：店长传 {sensitive:true} 也不能导出生日/税号/社保号/IBAN（HR-ACCESS-04、HR-DATA-32） */
  const canSensitive = empCanExportSensitive();
  const sensitive = canSensitive && (opts?.sensitive === undefined ? true : opts.sensitive === true);
  /* 店长只能导出当前门店范围内的档案，即使明确传了一个跨店列表（HR-ACCESS-01） */
  const scoped = (list || empRoster(empScope())).filter(empStoreInScope);
  const head = [empT("姓名", "Name"), empT("出生日期", "Geburtsdatum"), empT("门店", "Filiale"), empT("岗位", "Position"),
                empT("合同类型", "Vertragsart"), empT("薪资方式", "Vergütungsart"), empT("金额", "Betrag"),
                empT("月工时下限", "Std. min"), empT("月工时上限", "Std. max"), empT("年假", "Urlaubstage"),
                empT("入职日期", "Eintritt"), empT("状态", "Status"), empT("最后工作日", "Letzter Tag"),
                "Steuer-ID", "Rentenversicherung", "IBAN", "Krankenkasse",
                empT("待处理项", "Offene Punkte")];
  const rows = scoped.map(e => [
    e.name, sensitive ? (e.birthday || "") : "", e.store, empRaw(empRole(e.role).name),
    empRaw(empContractType(e.contract.type).name), e.contract.payType === "pauschal" ? "Pauschal" : empRaw({ zh: "时薪", de: "Stundenlohn" }),
    e.contract.rate, e.contract.hoursMin, e.contract.hoursMax, e.contract.urlaubDays,
    e.entryDate || "", empRaw(empStatus(e.status).name), e.leave?.lastDay || "",
    sensitive ? (e.ids.steuerId || "") : "", sensitive ? (e.ids.rentenversicherung || "") : "",
    sensitive ? (e.ids.iban || "") : "", e.contact.krankenkasse || "",
    empAlertsFor(e, today).map(a => a.title).join(" / ")
  ]);
  /* 公式注入防护：以 = + - @ 开头的单元格加前缀（HR-DATA-33） */
  const esc = v => {
    let t = String(v == null ? "" : v);
    if (/^[=+\-@]/.test(t)) t = `'${t}`;
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + [head, ...rows].map(r => r.map(esc).join(",")).join("\r\n");
}


/* 语言与通知方式的可选值：存中文原值不变（换界面语言不能改数据），显示按界面语言走 */
function empLangOptions() {
  return [["中文", empT("中文", "Chinesisch")], ["Deutsch", "Deutsch"], ["English", "English"], ["Tiếng Việt", "Tiếng Việt"], ["한국어", "한국어"], ["日本語", "日本語"],
          ["中文 / Deutsch", empT("中文 / Deutsch", "Chinesisch / Deutsch")],
          ["Deutsch / English", "Deutsch / English"]];
}
function empNotifyOptions() {
  return [["Email", "E-Mail"], ["WhatsApp", "WhatsApp"], ["短信", empT("短信", "SMS")]];
}

/* 合同条件与合规阈值的当场对照 —— 这是这个模块的「临界值」，
   对应 HACCP 里温度超标当场判定那件事。 */
function empContractHint(e) {
  const c = e.contract || {};
  const hints = [];
  /* 答复 B17/B18：一期不做 Minijob 收入超限提醒，也不做 Werkstudent 每周 20 小时提醒（工时只和合同挂钩，不阻断）；
     参数留着给二、三期的排班和工资页用。 */
  /* 实习：到期日晚于入职 + 3 个月，或没填到期日（HR-CONTRACT-15） */
  if (c.type === "praktikum") {
    const months = Number(empRule("internshipNoticeMonths")) || 3;
    const limitDate = e.entryDate ? empAddMonths(e.entryDate, months) : "";
    const late = !c.befristetUntil || (limitDate && c.befristetUntil > limitDate);
    if (late) {
      hints.push(`<p class="is-warn">${empT(
        `超过 ${months} 个月的实习可能需要支付最低工资；请核对合同期限${limitDate ? `（入职 + ${months} 个月：${empFormatDate(limitDate)}）` : ""}。`,
        `Praktika über ${months} Monate können Mindestlohnpflicht auslösen; Vertragsdauer prüfen.`)}</p>`);
    }
  }
  if (!hints.length) return "";
  return `<div class="emp-hint emp-contract-hint">
    <strong>${empT("合规提示", "Compliance-Hinweis")}</strong>
    ${hints.join("")}
    <span>${empT("这是参考值，以合同和税务师意见为准（HR-CONTRACT-20）。", "Referenzwert — maßgeblich sind Vertrag und Steuerberatung (HR-CONTRACT-20).")}
      <a href="#${slug("employee", "合规设置")}">${empT("改参数", "Parameter ändern")}</a></span>
  </div>`;
}

/* 证件一行。na 的也画出来但压暗，让人知道「系统知道你不需要这份」，
   而不是以为漏了。 */
function empDocRow(e, type, today) {
  const st = empDocState(e, type.id, today);
  const doc = e.docs?.[type.id] || {};
  if (st.level === "na") {
    const nationality = empNationalityClass(e);
    const why = type.id === "bankBack"
      ? empT("银行卡只收正面，不再单独收取反面（HR-DOC-09）", "Nur Vorderseite; Rückseite wird nicht mehr erhoben.")
      : type.id === "zusatz"
        ? (nationality === "other" ? empT("附加页待核对：店长核对居留证件后勾选是/否", "Zusatzblatt offen: nach Prüfung des Aufenthaltstitels ja/nein wählen") : empT("附加页只对其他国籍适用", "Zusatzblatt nur bei sonstiger Staatsangehörigkeit"))
      : type.need === "student" && !empStudentAnswered(e)
        ? empT("待确认是否学生", "Studium noch offen")
        : type.need === "nonEU" && nationality === ""
          ? empT("待确认国籍", "Staatsangehörigkeit offen")
          : type.need === "student"
            ? empT("勾选“学生”后需要", "Nur bei Studierenden erforderlich")
            : empT("其他国籍才需要", "Nur bei sonstiger Staatsangehörigkeit");
    return `<div class="emp-doc is-na"><div class="emp-doc-head"><strong>${empText(type.name)}</strong>${empDocLevelPill("na")}</div>
      <span class="emp-doc-why">${why}</span></div>`;
  }
  if (type.id === "belehrung") return empHealthDocRow(e, type, today);
  const migrated = e.migrated === true;
  const noFile = !doc.file;
  const recordedOnly = migrated && noFile && st.level !== "missing";
  return `<div class="emp-doc is-${st.level}">
    <div class="emp-doc-head"><strong>${empText(type.name)}</strong><span class="emp-doc-head-tags">${empDocLayerTag(type)}${empDocLevelPill(st.level, "doc", type.id)}</span></div>
    <div class="emp-doc-body">
      ${empDocFileBlock(e, type, doc, st)}
      ${doc.needsReview ? `<span class="pill orange">员工提交 · 待核对</span>` : ""}
      ${recordedOnly ? `<span class="pill gray">${empT("仅记录、无文件", "Nur Eintrag, keine Datei")}</span>
        <label class="emp-doc-toggle"><input type="checkbox" class="emp-doc-have" data-doc="${type.id}" checked> ${empT("迁移老员工：仅记录", "Bestandsdaten: nur Eintrag")}</label>` : ""}
      ${!migrated && noFile && st.level !== "missing" ? `<span class="pill red">${empT("缺少文件", "Datei fehlt")}</span>` : ""}
      ${type.expiry ? `<label class="emp-doc-exp"><span>${empT("到期日", "Ablaufdatum")} <b class="field-need">*</b></span><input type="date" required class="emp-doc-date" data-doc="${type.id}" value="${empEsc(doc.expiry || "")}"></label>` : ""}
      ${st.days != null ? `<span class="emp-doc-days">${empDaysLabel(st.days)}</span>` : ""}
      ${doc.file && type.expiry ? `<div class="emp-replace-controls">
        <span class="emp-replace-hint">${empT("替换时按这里给新版本定期限：填新日期，或勾选“保留原日期”并写原因。", "Beim Ersetzen: neues Datum eintragen oder bisheriges Datum mit Begründung behalten.")}</span>
        <label><input type="checkbox" class="emp-replace-keep"> ${empT("保留原日期", "Bisheriges Datum behalten")}</label>
        <input class="emp-replace-reason" placeholder="${empT("保留原日期的原因（必填）", "Begründung (Pflicht)")}">
      </div>` : ""}
    </div>
    ${type.id === "bankFront" ? `<p class="emp-doc-flag">${empT("银行卡只收正面照片，属“提交时必须有”；反面不再单独收取。", "Nur Vorderseite, Pflicht bei Einreichung; Rückseite wird nicht mehr erhoben.")}</p>` : ""}
    ${type.id === "healthFront" || type.id === "healthBack" ? `<p class="emp-doc-flag">${empT("医保卡正反面只收照片，属“之后补”。", "Krankenkarte beidseitig nur als Foto, später nachreichbar.")}</p>` : ""}
    ${empDocHistory(e, type.id)}
  </div>`;
}

/* 健康证：首次指导证明和最近复训日分开；只对下次复训日提醒，用词“复训到期”。 */
function empHealthDocRow(e, type, today) {
  const st = empDocState(e, "belehrung", today);
  const doc = e.docs?.belehrung || {};
  const health = empHealth(e);
  const next = empNextRetrain(e);
  const days = next ? empDaysBetween(today, next) : null;
  const migrated = e.migrated === true;
  const recordedOnly = migrated && !doc.file && health.firstProof === "yes";
  return `<div class="emp-doc emp-health is-${st.level}">
    <div class="emp-doc-head"><strong>${empText(type.name)}</strong><span class="emp-doc-head-tags">${empDocLayerTag(type)}${empDocLevelPill(st.level, "doc", "belehrung")}</span></div>
    <div class="emp-health-grid">
      <label class="field"><span>${empT("首次指导证明", "Erstbelehrung")}</span>
        <select data-emp-field="health.firstProof">
          <option value=""${health.firstProof === "" ? " selected" : ""}>${empT("未记录", "Nicht erfasst")}</option>
          <option value="yes"${health.firstProof === "yes" ? " selected" : ""}>${empT("有（附文件）", "Vorhanden (mit Datei)")}</option>
          <option value="no"${health.firstProof === "no" ? " selected" : ""}>${empT("无", "Fehlt")}</option>
        </select></label>
      <label class="field"><span>${empT("最近一次复训日", "Letzte Schulung")}</span>
        <input type="date" data-emp-field="health.lastRetrain" value="${empEsc(health.lastRetrain || "")}"></label>
      <div class="field"><span>${empT("下次复训日", "Nächste Schulung")}</span>
        <div class="emp-readonly-value"><strong>${next ? empFormatDate(next) : empT("未记录", "Nicht erfasst")}</strong>
          ${days != null ? `<span>${empRetrainDaysLabel(days)}</span>` : ""}</div></div>
    </div>
    <div class="emp-doc-body">
      ${empDocFileBlock(e, type, doc, st)}
      ${recordedOnly ? `<span class="pill gray">${empT("仅记录、无文件", "Nur Eintrag, keine Datei")}</span>
        <label class="emp-doc-toggle"><input type="checkbox" class="emp-doc-have" data-doc="belehrung" checked> ${empT("迁移老员工：仅记录", "Bestandsdaten: nur Eintrag")}</label>` : ""}
      ${!migrated && health.firstProof === "yes" && !doc.file ? `<span class="pill red">${empT("首次证明缺少文件", "Erstbelehrung ohne Datei")}</span>` : ""}
      ${doc.needsReview ? `<span class="pill orange">${empT("员工提交 · 待核对", "Von Mitarbeiter · zu prüfen")}</span>` : ""}
    </div>
    <p class="emp-doc-flag">${empT("提醒只看下次复训日（最近复训日 + 2 年）；首次证明没有才报缺。措辞用“复训到期”，不写“过期”。证件过期只提示，不阻断任何操作。", "Erinnert wird nur an die nächste Schulung (letzte + 2 Jahre); fehlt die Erstbelehrung, wird sie als fehlend gemeldet. Abgelaufene Nachweise sind nur ein Hinweis.")}</p>
    ${empFoodShiftBlocked(e) ? `<p class="emp-doc-flag emp-food-flag">${empT("没有首次证明：标记“不能排接触食品的班”，二期排班时生效；一期不阻止任何操作。", "Ohne Erstbelehrung: Markierung „kein Lebensmitteldienst“ für die Dienstplanung (Phase 2); in Phase 1 wird nichts blockiert.")}</p>` : ""}
    ${empDocHistory(e, "belehrung")}
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
  const allDocAlerts = empDocAlerts(store, today);
  const alerts = allDocAlerts.filter(a => a.level !== "soon");
  const soonAlerts = allDocAlerts.filter(a => a.level === "soon");
  const roster = empDocRoster(store);
  const canEditWarn = empCan("docWarn");
  const cols = [["姓名", "Name"], ["门店", "Filiale"], ["材料", "Unterlage"], ["到期日 / 下次复训日", "Ablauf / nächste Schulung"], ["剩余", "Verbleibend"], ["状态", "Status"], ["操作", "Aktion"]];
  return `
    <div class="page-head">
      <div><h1>${empT("证件到期总览", "Übersicht Dokumentfristen")}</h1>
      <p>${empT("按证件看：哪一类证件问题最多、谁的哪一份要续。想按人看就去员工档案的「需要处理」。", "Nach Dokument sortiert: welche Art am häufigsten fehlt und wessen Nachweis abläuft. Die Sicht nach Person steht in der Mitarbeiterakte unter „Zu erledigen“.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}<a class="ghost-btn" href="#${slug("employee", "员工档案")}?f=todo">${empT("按人看", "Nach Person")}</a>${canEditWarn
        ? `<a class="ghost-btn" href="#${slug("employee", "合规设置")}">${empT("改提前期", "Vorwarnzeit ändern")}</a>`
        : `<button class="ghost-btn" disabled title="${empEsc(empDenyReason("docWarn"))}">${empT("改提前期", "Vorwarnzeit ändern")}</button><span class="emp-disabled-reason">${empEsc(empDenyReason("docWarn"))}</span>`}</div>
    </div>
    ${alerts.length ? `<section class="card">
      <div class="section-title"><h2>${empT("需要处理", "Zu erledigen")}</h2><span class="small">${alerts.length}</span></div>
      <div class="table-scroll"><table class="table emp-table">
        <thead><tr>${cols.map(c => `<th>${empT(c[0], c[1])}</th>`).join("")}</tr></thead>
        <tbody>${alerts.map(a => `<tr class="emp-alert-tr is-${a.level}">
          <td><a class="emp-name-link" href="${empStaffHref(a.employee.id)}">${empEsc(a.employee.name)}</a></td>
          <td>${empEsc(a.employee.store)}</td>
          <td>${empText(empDocName(a.type))}</td>
          <td>${a.type.id === "belehrung" ? (empNextRetrain(a.employee) ? empFormatDate(empNextRetrain(a.employee)) : "—") : a.employee.docs[a.type.id]?.expiry ? empFormatDate(a.employee.docs[a.type.id].expiry) : "—"}</td>
          <td>${a.days == null ? "—" : a.type.id === "belehrung" ? empRetrainDaysLabel(a.days) : empDaysLabel(a.days)}</td>
          <td>${empDocLevelPill(a.level, a.kind, a.type.id)}</td>
          <td class="button-cell single-action"><a class="ghost-btn" href="${empStaffHref(a.employee.id)}">${empT("去处理", "Bearbeiten")}</a></td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>` : `<section class="card emp-allclear"><strong>${empT("没有需要处理的证件", "Keine offenen Dokumente")}</strong>
      <p>${soonAlerts.length
        ? empT(`在岗及待入职 ${roster.length} 人的必需证件都齐全，没有进入预警期的；下面 ${soonAlerts.length} 份只是提前知道。`, `Alle Pflichtdokumente von ${roster.length} aktiven und künftigen Mitarbeitern liegen vor; ${soonAlerts.length} nur zur Frühwarnung.`)
        : empT(`在岗及待入职 ${roster.length} 人的必需证件都齐全，且 ${empRule("docSoonDays")} 天内没有到期的。`, `Alle Pflichtdokumente von ${roster.length} aktiven und künftigen Mitarbeitern liegen vor, keine Frist in ${empRule("docSoonDays")} Tagen.`)}</p></section>`}

    ${soonAlerts.length ? `<section class="card emp-soon-docs" style="margin-top:16px">
      <div class="section-title"><div><h2>${empT("提前知道（关注期，31–90 天）", "Frühwarnung (31–90 Tage)")}</h2>
        <p>${empT("这里只显示，不进待办、不通知员工；进入预警期后才出现在上面的“需要处理”里（HR-DOC-24）。", "Nur Anzeige, keine Aufgabe und keine Benachrichtigung; erst in der Vorwarnzeit erscheint es oben (HR-DOC-24).")}</p></div><span class="small">${soonAlerts.length}</span></div>
      <div class="table-scroll"><table class="table emp-table">
        <thead><tr>${cols.map(c => `<th>${empT(c[0], c[1])}</th>`).join("")}</tr></thead>
        <tbody>${soonAlerts.map(a => `<tr class="emp-alert-tr is-soon">
          <td><a class="emp-name-link" href="${empStaffHref(a.employee.id)}">${empEsc(a.employee.name)}</a></td>
          <td>${empEsc(a.employee.store)}</td>
          <td>${empText(empDocName(a.type))}</td>
          <td>${a.type.id === "belehrung" ? (empNextRetrain(a.employee) ? empFormatDate(empNextRetrain(a.employee)) : "—") : a.employee.docs[a.type.id]?.expiry ? empFormatDate(a.employee.docs[a.type.id].expiry) : "—"}</td>
          <td>${a.type.id === "belehrung" ? empRetrainDaysLabel(a.days) : empDaysLabel(a.days)}</td>
          <td>${empDocLevelPill(a.level, a.kind, a.type.id)}</td>
          <td class="button-cell single-action"><a class="ghost-btn" href="${empStaffHref(a.employee.id)}">${empT("查看", "Ansehen")}</a></td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>` : ""}

    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>${empT("全员证件矩阵", "Dokumentmatrix")}</h2><span class="small">${roster.length} × ${EMP_DOC_TYPES.length}</span></div>
      <div class="table-scroll"><table class="table emp-table emp-matrix">
        <thead><tr><th>${empT("姓名", "Name")}</th>${EMP_DOC_TYPES.map(t => `<th>${t.id === "belehrung" ? empT("下次复训日", "Nächste Schulung") : empText(empDocName(t))}</th>`).join("")}</tr></thead>
        <tbody>${roster.map(e => `<tr>
          <td><a class="emp-name-link" href="${empStaffHref(e.id)}">${empEsc(e.name)}</a></td>
          ${EMP_DOC_TYPES.map(t => {
            const s = empDocState(e, t.id, today);
            const meta = EMP_DOC_LEVELS[s.level];
            const recordOnly = e.migrated === true && !!e.docs?.[t.id] && e.docs[t.id].state === "ok" && !e.docs[t.id].file;
            const mark = recordOnly ? empT("仅记录", "Nur erfasst")
              : s.level === "date_missing" ? empT("有效期待补充", "Gültigkeit fehlt")
                : s.level === "soon" ? empT("关注期", "Beobachten") : "";
            return `<td class="emp-cell is-${s.level}${recordOnly ? " is-record-only" : ""}" title="${empEsc(empRaw(t.name))} · ${empEsc(empRaw(meta.name))}${recordOnly ? " · " + empT("仅记录、无文件", "Nur erfasst, keine Datei") : ""}"><i class="emp-dot ${meta.tone}"></i>${mark ? `<small class="emp-matrix-mark">${mark}</small>` : ""}${s.days != null && s.level !== "ok" ? `<small>${s.days < 0 ? `−${-s.days}` : s.days}d</small>` : ""}</td>`;
          }).join("")}
        </tr>`).join("")}</tbody>
      </table></div>
    </section>`;
}

/* ============================================================ 合规设置 ==== */
function empRuleDefaultText(r) {
  if (r.id === "defaultHourlyWage") return empT("默认：留空（不预填）", "Standard: leer (keine Vorbelegung)");
  const def = EMP_RULES_DEFAULT.find(x => x.id === r.id);
  const value = def ? def.value : "";
  return empT(`默认：${value === "" ? "留空" : value} ${empRaw(r.unit)}`, `Standard: ${value === "" ? "leer" : value} ${empRaw(r.unit)}`);
}

function empRuleEditor(r, canEditAll) {
  const canEdit = canEditAll || empCanSetRule(r.id);
  const fixed = r.fixed || empRuleLimit(r.id)?.fixed;
  return `<div class="emp-rule${fixed ? " is-readonly" : ""}">
    <div class="emp-rule-head"><strong>${empText(r.name)}</strong>${fixed
      ? `<span class="emp-rule-fixed">${r.value} ${empText(r.unit)} · ${empT("只读", "nur lesen")}</span>`
      : `<span class="emp-rule-input"><input type="number" step="any" data-rule="${r.id}" value="${empEsc(r.value)}"${canEdit ? "" : " disabled"}><i>${empText(r.unit)}</i></span>`}</div>
    <p class="small emp-rule-meta">${empRuleDefaultText(r)} · ${empRuleRangeText(r)}${empRuleZeroHint(r) ? " · " + empRuleZeroHint(r) : ""}</p>
    ${empRaw(r.note) ? `<p>${empText(r.note)}</p>` : ""}
  </div>`;
}

function empRuleAuditCard() {
  const rows = empRuleAudit();
  const nameOf = id => { const rule = empRules().find(r => r.id === id); return rule ? empRaw(rule.name) : id; };
  return `<section class="card emp-rule-audit" style="margin-top:16px">
    <div class="section-title"><div><h2>${empT("参数修改记录", "Änderungsprotokoll der Parameter")}</h2>
      <p>${empT("证件提醒天数全公司一套，谁改了什么都留在这里（答复 ANS-4 ⑧）。", "Die Vorwarntage gelten firmenweit; jede Änderung wird protokolliert (ANS-4).")}</p></div></div>
    ${rows.length ? `<table class="table emp-table"><thead><tr><th>${empT("时间", "Zeit")}</th><th>${empT("修改人", "Von")}</th><th>${empT("参数", "Parameter")}</th><th>${empT("旧值 → 新值", "Alt → Neu")}</th></tr></thead>
      <tbody>${rows.slice(0, 20).map(r => `<tr><td>${empStamp(r.at)}</td><td>${empEsc(r.by)}</td><td>${empEsc(nameOf(r.id))}</td><td>${empEsc(r.from)} → ${empEsc(r.to)}</td></tr>`).join("")}</tbody></table>`
      : `<p class="small">${empT("还没有修改记录。", "Noch keine Änderungen.")}</p>`}
  </section>`;
}

function employeeRulesPage() {
  const customDeadlineRules = empRead("kaispan-employee-custom-deadline-rules", []);
  const canEdit = empCan("ownerOnly");
  const qTemplate = empQuestionnaireTemplate();
  const groups = [
    { title: "合同与试用期", de: "Vertrag und Probezeit", ids: ["defaultHourlyWage", "probationMonths", "probationMaxMonths", "probationWarnDays", "probationNoticeWeeks", "internshipNoticeMonths"], ref: true },
    { title: "证件与期限", de: "Dokumente und Fristen", ids: ["docWarnDays", "docSoonDays", "residenceWarnDays", "healthRetrainYears", "sofortmeldungRemindDays"], ref: true },
    { title: "入职流程", de: "Onboarding", ids: ["inviteSubmitStallDays", "inviteReturnStallDays", "contractSignStallDays", "inviteReviewStallDays"], ref: true },
    { title: "离职资料保存", de: "Aufbewahrung nach Austritt", ids: EMP_RETENTION_CATEGORIES.map(c => c.rule), ref: true },
    { title: "排班与工时", de: "Dienstplan und Arbeitszeit", ids: ["dailyHoursMax", "restBetweenShifts", "breakAfter6h", "breakAfter9h", "weeklyDaysOffMin", "azkMaxHours"], later: true },
    { title: "打卡与考勤", de: "Zeiterfassung", ids: ["punchGraceMin", "punchRadiusM"], later: true },
    { title: "工资与病假", de: "Lohn und Krankheit", ids: ["minijobMonthlyMax", "werkstudentWeeklyMax", "auAfterDays", "lohnfortzahlungWeeks", "payslipToleranceEuro"], later: true }
  ];
  return `
    <div class="page-head">
      <div><h1>${empT("合规设置", "Compliance-Einstellungen")}</h1>
      <p>${empT("全公司一套，不按门店或合同类型区分；只有老板和管理员可以修改。参数都写清默认值、范围和单位。", "Ein Satz für die ganze Firma, nicht je Filiale oder Vertragsart; nur Inhaber und Admin dürfen ändern. Jeweils mit Standard, Bereich und Einheit.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}<button class="ghost-btn emp-rules-reset"${canEdit ? "" : " disabled"}>${empT("恢复默认值", "Standardwerte")}</button><button class="primary-btn emp-rules-save"${canEdit || empCan("docWarn") ? "" : " disabled"}>${empT("保存", "Speichern")}</button></div>
    </div>
    ${canEdit ? "" : `<p class="emp-disabled-reason">${empEsc(empDenyReason("ownerOnly"))}${empCan("docWarn") ? empT(" 你可以改“证件与期限”里的提醒天数（全公司一套，改动留审计）。", " Sie dürfen nur die Vorwarntage der Dokumente ändern (firmenweit, mit Protokoll).") : ""}</p>`}
    <section class="card emp-employer-card">
      <div class="section-title"><div><h2>${empT("公司与门店 / 单位申报信息", "Firma, Filial- und Einheitsdaten")}</h2>
        <p>${empT("即时申报要用 Betriebsnummer：8 位数字，几家店可以填同一个；填一次，以后每个新人自动带上。", "Für die Sofortmeldung: 8-stellige Betriebsnummer, mehrere Filialen dürfen dieselbe nutzen.")}</p></div></div>
      ${empStores().map(store => {
        const info = empEmployer(store);
        return `<div class="emp-employer-store">
          <h3>${empEsc(empUnitLabel(store))}</h3>
          <div class="form-grid">
            <label class="field"><span>${empT("公司法定名称", "Firmenname")}</span><input data-store="${empEsc(store)}" data-employer="legalName" value="${empEsc(info.legalName || "")}"${canEdit ? "" : " disabled"}></label>
            <label class="field"><span>${empT("Betriebsnummer（8 位数字）", "Betriebsnummer (8 Ziffern)")}</span><input data-store="${empEsc(store)}" data-employer="betriebsnummer" inputmode="numeric" pattern="\\d{8}" maxlength="8" value="${empEsc(info.betriebsnummer || "")}" placeholder="12345678"${canEdit ? "" : " disabled"}><small>${empT("几家店可以填同一个号；没有它即时申报报不上去。", "Mehrere Filialen dürfen dieselbe Nummer nutzen; ohne sie keine Sofortmeldung.")}</small></label>
            <label class="field"><span>${empT("经营地址", "Betriebsstätte")}</span><input data-store="${empEsc(store)}" data-employer="address" value="${empEsc(info.address || "")}"${canEdit ? "" : " disabled"}></label>
            <label class="field"><span>${empT("付款账户 IBAN", "IBAN des Zahlungskontos")}</span><input data-store="${empEsc(store)}" data-employer="iban" value="${empEsc(info.iban || "")}"${canEdit ? "" : " disabled"}></label>
          </div>
        </div>`;
      }).join("")}
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><div><h2>${empT("默认个人调查问卷", "Standard-Personalfragebogen")}</h2>
        <p>${empT("组织级一份，发合同时自动带出；发出后固定当次版本，之后换默认问卷不影响已发出的合同（HR-ONB-50）。", "Eine Datei für die Organisation; wird beim Vertragsversand vorbelegt und danach als Version eingefroren (HR-ONB-50).")}</p></div></div>
      <div class="emp-questionnaire-template">
        <div class="emp-questionnaire-file-row">
          <div><strong>${empT("当前默认问卷", "Aktueller Standard")}</strong><span>${qTemplate.file
            ? (qTemplate.file.dataUrl ? `<a href="${empEsc(qTemplate.file.dataUrl)}" target="_blank" rel="noopener">${empEsc(qTemplate.file.name)}</a>` : empEsc(qTemplate.file.name))
            : empT("还没有上传默认问卷", "Noch keine Datei")}</span><small>${empT("支持 PDF、PNG、JPEG，最大 20 MB。", "PDF, PNG, JPEG, max. 20 MB.")}</small></div>
          <div class="button-row">
            <label class="ghost-btn">${empT("上传 / 替换", "Hochladen / ersetzen")}<input type="file" class="emp-questionnaire-file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"${canEdit ? "" : " disabled"} hidden></label>
            ${qTemplate.file ? `<button class="ghost-btn danger-lite emp-questionnaire-delete"${canEdit ? "" : " disabled"}>${empT("删除默认问卷", "Entfernen")}</button>` : ""}
          </div>
        </div>
        <p class="emp-questionnaire-error small" role="status"></p>
      </div>
    </section>
    ${typeof attSitePanel === "function" ? attSitePanel(typeof schStore === "function" ? schStore() : (empScope() || empStores()[0])) : ""}
    <section class="card" style="margin-top:16px">
      <div class="section-title"><div><h2>${empT("阈值参数", "Grenzwerte")}</h2><p>${empT("带法规色彩的参数是参考值，以合同和税务师意见为准（HR-CONTRACT-19/20/40）。", "Rechtsnahe Werte sind Referenzwerte; Vertrag und Steuerberatung gehen vor (HR-CONTRACT-19/20/40).")}</p></div></div>
      <div class="emp-rule"><div class="emp-rule-head"><strong>迟到计薪取整</strong><select data-rule="lateRoundingMinutes" aria-label="迟到计薪取整"><option value="15" ${empRule('lateRoundingMinutes')===15?'selected':''}>向上取整至 15 分钟</option><option value="30" ${empRule('lateRoundingMinutes')===30?'selected':''}>向上取整至半小时</option><option value="60" ${empRule('lateRoundingMinutes')===60?'selected':''}>向上取整至一小时</option></select></div><p>早到按计划上班时间；迟到时按所选间隔向上取整。保留实际打卡记录，人工核定优先；正式规则须符合合同和适用法律。</p></div>
      <p class="small emp-rules-scope">参数按用途分组。保存时保留原有数值；证件提醒适用于护照、签证 / 居留许可、在读证明及适用的 Zusatzblatt。医保卡和银行卡不设置有效期提醒。</p>
      <div class="emp-rule emp-document-guide"><strong>证件和餐饮卫生提醒</strong><p>证件按填写的有效期进行关注和到期提醒，所有证件都必须填截止日期；过期只提示、不阻断，缺少有效期或材料继续列入待处理。</p><p>食品卫生：首次证明与后续培训记录分开核对；依法由雇主在开始工作后及此后每两年组织复训并留存记录。这里的证件日期是演示中录入的提醒日期，不自动认定证明失效。</p></div>
      ${groups.map(g => `<section class="emp-rule-group${g.later ? " is-later" : ""}">
        <div class="emp-rule-group-heading"><h3>${empT(g.title, g.de)}${g.later ? ` <span class="pill gray">${empT("二、三期使用", "Phase 2/3")}</span>` : ""}</h3></div>
        ${g.ref ? `<p class="small emp-rule-ref">${empT("这是参考值，以合同和税务师意见为准。", "Referenzwert; Vertrag und Steuerberatung gehen vor.")}</p>` : ""}
        <div class="emp-rules">${empRules().filter(r => g.ids.includes(r.id)).map(r => empRuleEditor(r, canEdit)).join("")}</div>
      </section>`).join("")}
      <section class="emp-rule-group">
        <div class="emp-rule-group-heading"><h3>${empT("自定义期限说明", "Eigene Frist-Hinweise")}</h3>
          <div class="emp-rule-heading-actions"><button type="button" class="ghost-btn emp-rule-add"${canEdit ? "" : " disabled"}>${empT("＋ 添加规则", "+ Hinweis")}</button></div></div>
        <p class="small">${empT("这里只保存说明文字，不会自动触发提醒；正式系统需由开发者接入。", "Nur Textnotizen, keine automatische Erinnerung; die produktive Anbindung folgt.")}</p>
        <div class="emp-custom-rule-list">${(Array.isArray(customDeadlineRules) ? customDeadlineRules : []).map(rule => `<div class="emp-custom-rule"><label>${empT("规则名称", "Bezeichnung")}<input class="emp-custom-rule-name" value="${empEsc(rule.name || "")}" placeholder="${empT("例如：签证到期前提醒", "z. B. Hinweis vor Visumablauf")}"${canEdit ? "" : " disabled"}></label><label>${empT("规则说明", "Beschreibung")}<textarea class="emp-custom-rule-description" rows="2" placeholder="${empT("填写触发条件、提醒对象和处理方式", "Auslöser, Empfänger und Ablauf")}"${canEdit ? "" : " disabled"}>${empEsc(rule.description || "")}</textarea></label><button type="button" class="ghost-btn emp-custom-rule-remove"${canEdit ? "" : " disabled"}>${empT("删除", "Entfernen")}</button></div>`).join("")}</div>
      </section>
    </section>
    ${empRuleAuditCard()}
    ${typeof hrAnswersSection === "function" ? hrAnswersSection() : ""}`;
}

/* ============================================================ 新增员工 ==== */
function employeeNewPage() {
  const defaultStore = empScope() || empStores()[0];
  const rehireOptions = [["", empT("不关联（新员工）", "Nicht verknüpfen (neu)")]]
    .concat(empRoster()
      .filter(e => e.leave && !e.rehiredBy && empCompanyOfStore(e.store) === empCompanyOfStore(defaultStore))
      .map(e => [e.id, `${e.name} · ${e.store} · ${empT("最后工作日", "letzter Tag")} ${empFormatDate(e.leave.lastDay)}`]));
  const canInvite = empCan("invite");
  return `
    <div class="page-head">
      <div><h1>${empT("新增员工", "Mitarbeiter anlegen")}</h1>
      <p>${empT("最少只填姓名、门店和入职日期；邮箱可以之后再补，但没邮箱不能发邀请。其余合同条件折叠在下面，不改就用默认值。", "Mindestens Name, Filiale und Eintrittsdatum; E-Mail kann später ergänzt werden, ohne E-Mail aber keine Einladung. Vertragsbedingungen sind eingeklappt.")}</p></div>
      <div class="button-row">${empBack(`#${slug("employee", "员工档案")}`, "员工档案", "Mitarbeiterakte")}</div>
    </div>
    <section class="grid grid-2 emp-new-layout">
      <div class="card">
        <div class="section-title"><h2>${empT("公司先填的部分", "Vom Betrieb auszufüllen")}</h2>
          <span class="small">${empT("带 * 的是最少字段", "Mit * = Mindestangaben")}</span></div>
        <div class="form-grid">
          ${empInput(`${empT("名", "Vorname")} <b class="field-need">*</b>`, "firstName", "")}
          ${empInput(`${empT("姓", "Nachname")} <b class="field-need">*</b>`, "lastName", "")}
          ${empInput(empT("邮箱（可留空，先建档）", "E-Mail (optional, Akte zuerst)"), "contact.email", "")}
          ${empSelect(`${empT("所属单位（门店 / 部门 / 仓库）", "Einheit (Filiale / Abteilung / Lager)")} <b class="field-need">*</b>`, "store", empStores().map(x => [x, empUnitLabel(x)]), defaultStore)}
          ${empInput(`${empT("入职日期", "Eintrittsdatum")} <b class="field-need">*</b>`, "entryDate", "", "date")}
          ${empSelect(empT("重聘：关联旧档案", "Wiedereinstellung: alte Akte verknüpfen"), "rehireOf", rehireOptions, "")}
        </div>
        <p class="small">${empT("入职日期就是第一个上班日，也是即时申报里填的开始工作日期（HR-ONB-24）。留空邮箱也能建档，但页面会提示“需要先填邮箱才能发邀请”；同一邮箱已有待接受邀请时会被拦住。", "Das Eintrittsdatum ist der erste Arbeitstag und das Startdatum der Sofortmeldung (HR-ONB-24). Ohne E-Mail kann die Akte angelegt, aber nicht eingeladen werden.")}</p>
        <label class="emp-check emp-company-filled"><input type="checkbox" class="emp-company-filled-box"> ${empT("公司已替员工填好全部资料：发邀请后由员工登录确认一遍，不再走审核（HR-ONB-09）", "Alle Angaben vom Betrieb vorausgefüllt: Der Mitarbeiter bestätigt nur, keine Prüfung (HR-ONB-09).")}</label>
        <p class="small">${empT("重聘要新建一份档案走完整入职流程；旧档案保留、两边可互相查看，员工编号沿用原编号，账号由老板重新开通（HR-LIFE-32）。试用期、年假、工龄从新入职段重新起算。", "Wiedereinstellung: neue Akte mit vollem Onboarding; alte Akte bleibt, Personalnummer wird übernommen, Konto durch Inhaber neu aktiviert (HR-LIFE-32).")}</p>
        <details class="emp-more">
          <summary>${empT("合同条件与国籍/附加页（不改就用默认值）", "Vertragsbedingungen, Staatsangehörigkeit, Zusatzblatt")}</summary>
          <div class="form-grid">
            ${empSelect(empT("岗位", "Position"), "role", empRoles().map(r => [r.id, empRaw(r.name)]), "front")}
            ${empSelect(empT("合同类型", "Vertragsart"), "contract.type", EMP_CONTRACT_TYPES.map(t => [t.id, empRaw(t.name)]), "teilzeit")}
            ${empSelect(empT("员工级别", "Qualifikation"), "level", EMP_LEVELS.map(l => [l.id, empRaw(l.name)]), "basic")}
            ${empSelect(empT("薪资方式", "Vergütungsart"), "contract.payType", [["hourly", empT("时薪", "Stundenlohn")], ["pauschal", empT("Pauschal 月薪", "Pauschale monatlich")]], "hourly")}
            ${empInput(empT("薪资金额 €", "Betrag €"), "contract.rate", empRule("defaultHourlyWage") === "" ? "" : Number(empRule("defaultHourlyWage")), "number")}
            ${empInput(empT("月工时下限", "Sollstunden min. / Monat"), "contract.hoursMin", 60, "number")}
            ${empInput(empT("月工时上限", "Sollstunden max. / Monat"), "contract.hoursMax", 80, "number")}
            ${empInput(empT("年假天数", "Urlaubstage"), "contract.urlaubDays", 20, "number")}
            ${empSelect(empT("附加页（店长核对居留证件后勾）", "Zusatzblatt (nach Prüfung)"), "contract.zusatzCheck",
              [["", empT("未核对", "Nicht geprüft")], ["no", empT("无需", "Nicht erforderlich")], ["yes", empT("需要", "Erforderlich")]], "")}
          </div>
        </details>
        <p class="small emp-preset-hint"></p>
        <p class="small">${empT("邀请邮件是固定的中德英三语通用信，不能改语言、主题或正文；要准备的材料只在员工打开链接后的第一屏列出（HR-ACCESS-25）。", "Die Einladungs-E-Mail ist ein festes dreisprachiges Schreiben und nicht editierbar (HR-ACCESS-25).")}</p>
      </div>
      <div class="card emp-new-personal-card">
        <div class="section-title"><div><h2>员工个人资料与材料</h2><p>与员工端 UI 使用同一套字段。你可以代填、上传已有材料，也可以直接邀请员工自己补充。三层清单只提示缺什么，不挡员工提交；第一、二层没交齐时，通过需要老板特殊审批。</p></div></div>
        <div class="emp-new-personal">${empNewPersonalEditor()}</div>
        <div class="button-row" style="margin-top:16px">
          <button class="ghost-btn emp-create-btn" data-send="0">${empT("只建档，不发邀请", "Nur Akte anlegen")}</button>
          <button class="primary-btn emp-create-btn" data-send="1"${canInvite ? "" : " disabled"}>${empT("建档并发邀请", "Akte anlegen und einladen")}</button>
        </div>
        ${canInvite ? "" : `<p class="emp-disabled-reason">${empEsc(empDenyReason("invite"))}</p>`}
        <p class="small emp-new-feedback" role="status"></p>
      </div>
    </section>`;
}

/* ============================================================ 入职邀请 ==== */
function employeeInviteListPage() {
  const store = empScope();
  const list = empInvites(store);
  const today = empToday();
  const stalls = empOnboardingStalls(store, today);
  const order = ["draft", "fill", "review", "returned", "contract", "sign", "archive", "done", "revoked", "cancelled"];
  const groups = order.map(id => [id, list.filter(e => empInviteStep(e).id === id)]).filter(g => g[1].length);
  return `
    <div class="page-head">
      <div><h1>${empT("入职邀请", "Einstellungseinladungen")}</h1>
      <p>${empT("范围从已邀请一直到已归档，每行写清卡在哪一步；撤销和取消入职作为旁支保留记录。", "Von Einladung bis Ablage; jede Zeile zeigt, wo der Vorgang hängt. Zurückgezogen/abgesagt bleiben als Nebenzweig erhalten.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}<a class="primary-btn" href="#${slug("employee", "新增员工")}">${empT("新增员工", "Mitarbeiter anlegen")}</a></div>
    </div>
    ${stalls.length ? `<section class="card emp-stall-banner">
      <div class="section-title"><div><h2>${empT("入职停滞提醒", "Hängende Einstellungen")}</h2>
        <p>${empT(`四类天数在合规设置里各自可改，默认各 ${empRule("inviteSubmitStallDays")} 天；条件消失后提醒自动关闭（HR-ONB-47）。`, `Vier getrennte Fristen, Standard ${empRule("inviteSubmitStallDays")} Tage (HR-ONB-47).`)}</p></div>
        <span class="pill orange">${stalls.length}</span></div>
      <ul class="emp-stall-list">${stalls.map(s => `<li><a href="#${slug("employee", "邀请详情")}?id=${encodeURIComponent(s.id)}">${empEsc(s.name)}</a><span>${empEsc(s.label)}</span></li>`).join("")}</ul>
    </section>` : ""}
    ${groups.length ? groups.map(([state, rows]) => `<section class="card" style="margin-top:16px">
      <div class="section-title">
        <div><h2>${empText(empInviteStepName(state))}</h2><p>${empInviteGroupHint(state)}</p></div>
        <span class="small">${rows.length}</span>
      </div>
      <div class="table-scroll"><table class="table emp-table">
        <thead><tr>${[["姓名", "Name"], ["门店", "Filiale"], ["岗位 · 合同", "Position · Vertrag"], ["三层必填", "Drei Ebenen"], ["卡在哪一步", "Schritt"], ["最近动作", "Zuletzt"], ["操作", "Aktion"]]
          .map(c => `<th>${empT(c[0], c[1])}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(e => empInviteRow(e, today)).join("")}</tbody>
      </table></div>
    </section>`).join("") : `<section class="card emp-allclear">
      <strong>${empT("没有进行中的入职邀请", "Keine laufenden Einladungen")}</strong>
      <p>${empT("新招的人从「新增员工」开始建档。", "Neue Mitarbeiter über „Mitarbeiter anlegen“ starten.")}</p>
      <a class="primary-btn" href="#${slug("employee", "新增员工")}">${empT("新增员工", "Mitarbeiter anlegen")}</a>
    </section>`}`;
}

function empInviteStepName(id) {
  return {
    draft: { zh: "已建档，未发邀请", de: "Angelegt, nicht gesendet" },
    fill: { zh: "等员工填写", de: "Wartet auf Mitarbeiter" },
    review: { zh: "待审核", de: "Zur Prüfung" },
    returned: { zh: "已退回，等员工重提", de: "Zurück, wartet auf erneute Abgabe" },
    contract: { zh: "已通过，待发合同", de: "Freigegeben, Versand offen" },
    sign: { zh: "待员工签回", de: "Wartet auf Unterschrift" },
    archive: { zh: "待核对归档", de: "Prüfung der Unterschriften" },
    done: { zh: "已归档", de: "Abgelegt" },
    revoked: { zh: "已撤销", de: "Zurückgezogen" },
    cancelled: { zh: "已取消入职", de: "Einstellung abgesagt" }
  }[id] || { zh: "其他", de: "Sonstiges" };
}

function empInviteGroupHint(state) {
  return {
    draft: empT("已建档但邀请还没发；补上邮箱后可以直接发邀请（HR-ACCESS-31）。", "Angelegt, Einladung noch nicht gesendet."),
    fill: empT("邮件已发出，等员工点链接填写；超过提醒天数会进停滞提醒。", "E-Mail ist raus, wartet auf den Mitarbeiter."),
    review: empT("员工已经提交最后一版，等店长审核；缺提交层项目只能退回。", "Abgegeben — Prüfung offen."),
    returned: empT("已退回给员工补充，等他重新提交整份。", "Zur Ergänzung zurückgegeben."),
    contract: empT("审核已通过，等公司上传并发送合同与问卷。", "Freigegeben — Vertrag und Fragebogen senden."),
    sign: empT("合同与问卷已发出，等员工两份签回。", "Gesendet — Unterschriften offen."),
    archive: empT("两份签回件都到了，等逐份核对归档。", "Unterschriften da — Prüfung offen."),
    done: empT("两份都核对通过，入职记录完成归档。", "Geprüft und abgelegt."),
    revoked: empT("邀请已撤销，记录保留；可以换邮箱重新邀请（HR-ONB-45）。", "Zurückgezogen — erneute Einladung möglich."),
    cancelled: empT("审核通过后取消了入职，记录保留。", "Einstellung abgesagt.")
  }[state] || "";
}

function empInviteRow(e, today) {
  const pr = empInviteProgress(e);
  const inv = e.invite;
  const step = empInviteStep(e);
  const sub = empInviteSubStates(e, today);
  const stall = empInviteStall(e, today);
  const href = `#${slug("employee", "邀请详情")}?id=${encodeURIComponent(e.id)}`;
  return `<tr class="${stall ? "emp-alert-tr is-warn" : ""}">
    <td><a class="emp-name-link" href="${href}">${empEsc(e.name || empT("（未填姓名）", "(ohne Namen)"))}</a>
      <small class="emp-note">${empEsc(e.contact.email || empT("没有邮箱：不能发邀请", "Keine E-Mail: keine Einladung"))}</small>
      ${sub.length ? `<div class="emp-invite-substates">${sub.map(s => empPill(s.tone, empText(s.name))).join("")}</div>` : ""}</td>
    <td>${empEsc(e.store)}</td>
    <td>${empText(empRole(e.role).name)} · ${empText(empContractType(e.contract.type).name)}</td>
    <td><span class="emp-layer-counts">${empLayerCountsText(pr.layers)}</span></td>
    <td><span class="emp-step-label">${empText(step.name)}</span>${stall ? `<small class="emp-stall-flag">${empEsc(stall.label)}</small>` : ""}</td>
    <td>${empInviteLastAction(e)}</td>
    <td class="button-cell single-action"><a class="ghost-btn" href="${href}">${
      step.id === "review" ? empT("审核", "Prüfen") : empT("查看", "Ansehen")}</a></td>
  </tr>`;
}

function empInviteLastAction(e) {
  const inv = e.invite || {};
  if (inv.cancelledAt) return empT(`取消于 ${empStamp(inv.cancelledAt)}`, `Abgesagt ${empStamp(inv.cancelledAt)}`);
  if (inv.revokedAt) return empT(`撤销于 ${empStamp(inv.revokedAt)}`, `Zurückgezogen ${empStamp(inv.revokedAt)}`);
  if (inv.archivedAt || inv.contractSignedReviewedAt) return empT(`归档于 ${empStamp(inv.archivedAt || inv.contractSignedReviewedAt)}`, `Abgelegt ${empStamp(inv.archivedAt || inv.contractSignedReviewedAt)}`);
  if (inv.contractSignedSubmittedAt) return empT(`签回于 ${empStamp(inv.contractSignedSubmittedAt)}`, `Unterschrift ${empStamp(inv.contractSignedSubmittedAt)}`);
  if (inv.contractSentAt) return empT(`合同发出于 ${empStamp(inv.contractSentAt)}`, `Vertrag gesendet ${empStamp(inv.contractSentAt)}`);
  if (inv.state === "approved") return empT(`通过于 ${empStamp(inv.approvedAt || inv.reviewedAt)}`, `Freigegeben ${empStamp(inv.approvedAt || inv.reviewedAt)}`);
  if (inv.state === "submitted") return empT(`提交于 ${empStamp(inv.submittedAt)}`, `Abgegeben ${empStamp(inv.submittedAt)}`);
  if (inv.state === "returned") return empT(`退回于 ${empStamp(inv.reviewedAt)}`, `Zurück ${empStamp(inv.reviewedAt)}`);
  if (inv.state === "sent") return empT(`发送于 ${empStamp(inv.sentAt)}${inv.resendLog?.length ? ` · 重发 ${inv.resendLog.length} 次` : ""}`,
                                        `Gesendet ${empStamp(inv.sentAt)}${inv.resendLog?.length ? ` · ${inv.resendLog.length}× erneut` : ""}`);
  return empT("还没发送", "Noch nicht gesendet");
}

/* 四类停滞：邀请未提交 / 退回未重提 / 合同未签回 / 提交未审核（HR-ONB-47）。 */
function empInviteStall(e, today) {
  const inv = e?.invite || {};
  const day = today || empToday();
  const check = (since, ruleId, label) => {
    if (!since) return null;
    const start = String(since).slice(0, 10);
    const days = empDaysBetween(start, day);
    const limit = Number(empRule(ruleId)) || 3;
    return days >= limit ? { kind: ruleId, days, label } : null;
  };
  if (inv.state === "sent") return check(empInviteSentAt(inv), "inviteSubmitStallDays", empT("邀请已发出，员工还没提交", "Einladung ohne Abgabe"));
  if (inv.state === "submitted") return check(inv.submittedAt, "inviteReviewStallDays", empT("员工已提交，还没审核", "Abgabe ohne Prüfung"));
  if (inv.state === "returned") return check(inv.reviewedAt, "inviteReturnStallDays", empT("已退回，员工还没重提", "Rückgabe ohne erneute Abgabe"));
  if (inv.state === "approved" && inv.contractSentAt && !inv.contractSignedSubmittedAt) {
    return check(inv.contractSentAt, "contractSignStallDays", empT("合同已发出，员工还没签回", "Vertrag ohne Unterschrift"));
  }
  return null;
}

function empOnboardingStalls(store, today) {
  return empInvites(store)
    .map(e => ({ id: e.id, name: e.name || empT("（未填姓名）", "(ohne Namen)"), store: e.store, stall: empInviteStall(e, today) }))
    .filter(x => x.stall)
    .map(x => ({ id: x.id, name: x.name, store: x.store, label: `${x.stall.label}（${x.stall.days} 天）` }));
}

/* ============================================================ 邀请详情 ==== */
function employeeInviteDetailPage() {
  const e = empById(state().params.get("id"));
  if (!e || !e.invite) return `<div class="page-head"><h1>${empT("邀请详情", "Einladung")}</h1></div>
    <section class="card"><p class="emp-empty">${empT("找不到这条邀请，可能已经撤销或审核通过了。", "Einladung nicht gefunden — evtl. zurückgezogen oder bereits freigegeben.")}</p>
    <div style="text-align:center"><a class="ghost-btn" href="#${slug("employee", "入职邀请")}">${empT("返回入职邀请", "Zurück zu den Einladungen")}</a></div></section>`;
  const inv = e.invite;
  const step = empInviteStep(e);
  const pr = empInviteProgress(e);
  const mail = empInviteMail(e);
  const subStates = empInviteSubStates(e);
  const gaps = inv.state === "submitted" ? empOnbGaps(e, "submitted") : [];
  const canInvite = empCan("invite");
  const canSensitive = empCan("sensitive");
  const accepted = empInviteAccepted(e);
  const resendToday = empInviteResendToday(inv);
  const daysLeft = empInviteDaysLeft(inv);
  const stall = empInviteStall(e);
  const mailSend = empInviteSendResult(inv);
  const email = String(e.contact?.email || "").trim();
  const canRevoke = canInvite && !accepted && inv.state === "sent";
  const canResend = canInvite && inv.state === "sent" && !accepted && !resendToday;
  const canCancel = canInvite && inv.state === "approved" && !e.leave && !(e.entryDate && e.entryDate < empToday());
  const expired = empInviteExpired(e);
  return `
    <div class="page-head">
      <div><h1>${empEsc(e.name || empT("（未填姓名）", "(ohne Namen)"))}</h1>
      <p>${empEsc(e.store)} · ${empText(empRole(e.role).name)} · ${empText(empContractType(e.contract.type).name)}　${empPill(step.tone, empText(step.name))} ${subStates.map(s => empPill(s.tone, empText(s.name))).join(" ")}</p></div>
      <div class="button-row">${empBack(`#${slug("employee", "入职邀请")}`, "入职邀请", "Einladungen")}</div>
    </div>
    ${empInviteFlow(step.id)}
    ${inv.state === "returned" ? `<section class="card emp-returned">
      <strong>${empT("已退回给员工补充", "Zur Ergänzung zurückgegeben")}</strong>
      <p>${empEsc(inv.returnNote) || empT("（没写理由）", "(ohne Begründung)")}</p>
      ${(inv.returnItems || []).length ? `<div class="emp-return-items">${inv.returnItems.map(k => `<span class="pill red">${empEsc(empReturnItemLabel(k))}</span>`).join("")}</div>` : ""}
      <span>${empT(`退回于 ${empStamp(inv.reviewedAt)}`, `Am ${empStamp(inv.reviewedAt)}`)}</span>
    </section>` : ""}
    ${inv.state === "cancelled" ? `<section class="card emp-returned">
      <strong>${empT("已取消入职", "Einstellung abgesagt")}</strong>
      <p>${empEsc(inv.cancelReason || "")}</p>
      <span>${empStamp(inv.cancelledAt)} · ${empEsc(inv.cancelledBy || "")}</span>
    </section>` : ""}
    ${inv.state === "revoked" ? `<section class="card emp-returned">
      <strong>${empT("邀请已撤销", "Einladung zurückgezogen")}</strong>
      <p>${empEsc(inv.revokeReason || "")}</p>
      <span>${empStamp(inv.revokedAt)} · ${empEsc(inv.revokedBy || "")}</span>
    </section>` : ""}
    ${stall ? `<p class="emp-stall-inline">${empT("停滞提醒", "Hängend")}：${empEsc(stall.label)}（${stall.days} 天）</p>` : ""}

    <div class="emp-invite-grid" data-id="${empEsc(e.id)}">
      <section class="card">
        <div class="section-title"><div><h2>${empT("邀请状态", "Einladungsstatus")}</h2>
          <p>${empT("邀请邮件固定为中德英三语通用信，不能改语言、主题或正文；材料清单只在员工打开链接后的第一屏出现。", "Die Einladungs-E-Mail ist ein festes dreisprachiges Schreiben; die Unterlagen erscheinen erst auf dem ersten Bildschirm beim Mitarbeiter.")}</p></div>
         </div>
        <div class="emp-invite-status">
          <div><small>${empT("收件人", "Empfänger")}</small>
            ${inv.state === "draft" || (inv.state === "sent" && expired) ? `<div class="emp-link-row"><input class="emp-invite-email" value="${empEsc(email)}" placeholder="name@example.com"><button class="ghost-btn emp-invite-email-save" data-id="${empEsc(e.id)}"${canInvite ? "" : " disabled"}>${empT("保存邮箱", "Speichern")}</button></div>`
              : `<strong>${empEsc(email || empT("（没有邮箱）", "(keine E-Mail)"))}</strong>`}
            <span>${empT("有待接受的邀请时邮箱不能改（HR-ACCESS-27）；没有邮箱只能建档，不能发邀请（HR-ACCESS-31）。", "Bei offener Einladung ist die E-Mail gesperrt; ohne E-Mail keine Einladung (HR-ACCESS-27/31).")}</span></div>
          <div><small>${empT("邮件发送结果", "Versandergebnis")}</small><strong>${empPill(mailSend.tone, empText(mailSend.name))}</strong><span>${empStamp(inv.sendResultAt || inv.sentAt)}</span></div>
          <div><small>${empT("邀请有效期", "Gültigkeit")}</small><strong>${!empInviteSentAt(inv) ? "—" : inv.state === "sent" ? (expired ? empT("已过期", "Abgelaufen") : empT(`剩余 ${Math.max(0, daysLeft)} 天`, `Noch ${Math.max(0, daysLeft)} Tage`)) : (accepted ? empT("已接受，不再按 7 天计", "Angenommen") : "—")}</strong><span>${empT("7 天有效；过期后一键重发会新建平台邀请（HR-ACCESS-25）", "7 Tage gültig; nach Ablauf wird eine neue Plattform-Einladung erzeugt.")}</span></div>
          <div><small>${empT("账号状态", "Kontostatus")}</small><strong>${empEsc(empAccountStateLabel(empAccountState(e)))}</strong><span>${empT("员工接受邀请即成为有效成员；重发/撤销在已接受后不可用", "Nach Annahme sind erneut senden/zurückziehen gesperrt.")}</span></div>
        </div>
        <details class="emp-invite-mail"><summary>${empT("查看固定邀请邮件（只读）", "Feste Einladungs-E-Mail ansehen (nur lesen)")}</summary>
          <div class="field"><label>${empT("主题", "Betreff")}</label><input value="${empEsc(mail.subject)}" readonly></div>
          <div class="field"><label>${empT("正文", "Text")}</label><textarea rows="9" readonly>${empEsc(mail.body)}</textarea></div>
        </details>
        <div class="button-row" style="margin-top:12px">
          ${inv.state === "draft"
            ? `<button class="primary-btn emp-send-invite" data-id="${empEsc(e.id)}"${canInvite && email ? "" : " disabled"}>${empT("发送邀请邮件", "Einladung senden")}</button>`
            : inv.state === "sent" ? `<button class="ghost-btn emp-resend-invite" data-id="${empEsc(e.id)}"${canResend ? "" : " disabled"}>${expired ? empT("已过期，一键重发", "Abgelaufen — erneut senden") : empT("重新发送（催一下）", "Erneut senden (erinnern)")}</button>` : ""}
          ${inv.state === "revoked" ? `<button class="primary-btn emp-reinvite-open" data-id="${empEsc(e.id)}"${canInvite ? "" : " disabled"}>${empT("重新邀请", "Erneut einladen")}</button>` : ""}
          ${canRevoke ? `<button class="ghost-btn danger-lite emp-revoke-invite" data-id="${empEsc(e.id)}">${empT("撤销邀请", "Zurückziehen")}</button>` : ""}
          ${inv.state === "approved" ? `<button class="ghost-btn danger-lite emp-cancel-open" data-id="${empEsc(e.id)}"${canCancel ? "" : " disabled"}>${empT("取消入职", "Einstellung absagen")}</button>` : ""}
          ${inv.state === "approved" ? `<a class="ghost-btn" href="${empStaffHref(e.id)}">${empT("去员工档案发合同", "Zur Akte: Vertrag senden")}</a>` : ""}
        </div>
        ${!canInvite ? `<p class="emp-disabled-reason">${empEsc(empDenyReason("invite"))}</p>` : ""}
        ${inv.state === "sent" && resendToday ? `<p class="small">${empT("今天已经重发过一次，明天再发；每个员工每天最多一次（HR-ACCESS-24）。", "Heute bereits einmal erneut gesendet (HR-ACCESS-24).")}</p>` : ""}
        ${inv.state === "sent" && !email ? `<p class="emp-approve-warn">${empT("没有邮箱不能发邀请。补上邮箱后才能发送。", "Ohne E-Mail keine Einladung.")}</p>` : ""}
        ${["submitted", "returned"].includes(inv.state) ? `<p class="small">${empT("员工已接受邀请，撤销和重发都不可用；需要结束入职请按流程处理。", "Einladung angenommen — erneut senden/zurückziehen nicht möglich.")}</p>` : ""}
        ${inv.state === "approved" && !canCancel ? `<p class="small">${empT("已经上过班或已录离职，不能取消入职；请走离职流程（HR-ONB-46）。", "Bereits gearbeitet oder Austritt erfasst — bitte Austritt erfassen (HR-ONB-46).")}</p>` : ""}
        <div class="emp-revoke-confirm is-hidden" data-id="${empEsc(e.id)}">
          <strong>${empT("撤销后链接失效、入职记录标“已撤销”，档案和员工已填内容保留（HR-ONB-45）。", "Link wird ungültig; Akte und Angaben bleiben erhalten (HR-ONB-45).")}</strong>
          <div class="field"><label>${empT("撤销原因（必填）", "Begründung (Pflicht)")}</label><textarea class="emp-revoke-reason" rows="2"></textarea></div>
          <div class="button-row"><button class="ghost-btn emp-revoke-cancel">${empT("取消", "Abbrechen")}</button><button class="primary-btn danger-solid emp-revoke-yes" data-id="${empEsc(e.id)}">${empT("确认撤销", "Zurückziehen")}</button></div>
        </div>
        <div class="emp-cancel-confirm is-hidden" data-id="${empEsc(e.id)}">
          <strong>${empT("审核已通过，不能撤销；取消入职会保留档案和原因，关闭相关待办。已经上过班的请办理离职。", "Nach Freigabe nur Absage; Akte und Grund bleiben erhalten. Bereits gearbeitet = Austritt.")}</strong>
          <div class="field"><label>${empT("取消原因（必填）", "Begründung (Pflicht)")}</label><textarea class="emp-cancel-reason" rows="2"></textarea></div>
          <div class="button-row"><button class="ghost-btn emp-cancel-close">${empT("取消", "Abbrechen")}</button><button class="primary-btn danger-solid emp-cancel-yes" data-id="${empEsc(e.id)}">${empT("确认取消入职", "Einstellung absagen")}</button></div>
        </div>
        <div class="emp-reinvite-box is-hidden" data-id="${empEsc(e.id)}">
          <div class="field"><label>${empT("重新邀请到邮箱（可换邮箱）", "Erneut einladen an (änderbar)")}</label><input class="emp-reinvite-email" value="${empEsc(email)}"></div>
          <div class="button-row"><button class="ghost-btn emp-reinvite-cancel">${empT("取消", "Abbrechen")}</button><button class="primary-btn emp-reinvite-yes" data-id="${empEsc(e.id)}">${empT("发送新邀请", "Neue Einladung senden")}</button></div>
        </div>
        <details class="emp-invite-preview"><summary>${empT("预览员工端（只读）", "Mitarbeiteransicht (nur lesen)")}</summary>
          ${empInvitePreview(e)}
        </details>
        ${empInviteTimeline(e)}
      </section>

      <section class="card">
        <div class="section-title">
          <div><h2>${empT("员工提交的最后一版", "Letzte eingereichte Version")}</h2>
          <p>${empT("审核只看最后一次提交；员工草稿只显示“已填 X / Y 项”，不展示草稿内容（HR-ONB-15）。", "Nur die letzte Abgabe wird geprüft; Entwürfe nur als „X / Y ausgefüllt“ (HR-ONB-15).")}</p></div>
          <span class="emp-layer-counts">${empLayerCountsText(pr.layers)}</span>
        </div>
        ${inv.state === "draft" || inv.state === "sent"
          ? `<p class="emp-empty">${pr.done ? empT(`员工草稿：已填 ${pr.done}/${pr.total} 项（提交层），还没提交。`, `Entwurf: ${pr.done}/${pr.total} Pflichtangaben, noch nicht abgegeben.`)
                                              : empT("员工还没开始填；草稿内容对审核人不可见。", "Noch nichts ausgefüllt; Entwürfe sind nicht sichtbar.")}</p>`
          : empInviteReview(e, pr)}
        ${empSpecialApprovalBlock(e)}
      </section>
    </div>

    ${inv.state === "submitted" ? `<section class="card emp-approve" data-id="${empEsc(e.id)}">
      <div class="section-title"><div><h2>${empT("审核", "Prüfung")}</h2>
        <p>${empT("个人信息以员工为准、合同条件以公司为准；材料清单只提示缺什么，不挡审核；第一、二层没交齐时，通过需要老板做特殊审批（答复 ANS-1，覆盖 HR-ONB-20）。", "Persönliche Daten gelten nach Mitarbeiter, Vertragsbedingungen nach Betrieb; fehlende Unterlagen nur als Hinweis, bei Lücken in Ebene 1/2 Sonderfreigabe durch den Inhaber (ANS-1).")}</p></div>
        ${empPill(canSensitive ? "blue" : "gray", canSensitive ? empT("可审核", "Prüfung möglich") : empT("需要查看敏感资料权限", "Vertrauliche Daten nötig"))}</div>
      ${canSensitive ? "" : `<p class="emp-approve-warn">${empT("审核（通过与退回）需要“查看敏感资料”权限；没有权限时按钮置灰，由老板或其他有权限的人处理（HR-ACCESS-55）。", "Prüfung erfordert „Vertrauliche Daten ansehen“ (HR-ACCESS-55).")}</p>`}
      <div class="form-grid">
        ${empInput(`${empT("入职日期", "Eintrittsdatum")} <b class="field-need">*</b><small>${empT("第一个上班日，也是即时申报的开始工作日期", "Erster Arbeitstag und Startdatum der Sofortmeldung")}</small>`, "approve.entryDate", e.entryDate || empToday(), "date")}
        ${empInput(`${empT("试用期结束", "Ende der Probezeit")}<small>${empT("留空 = 不设试用期", "leer = keine Probezeit")}</small>`,
          "approve.probationEnd", empProbationDefaultEndAt(e.entryDate || empToday(), empRule("probationMonths")), "date")}
      </div>
      <p class="small">${empT("在职状态由日期推算，不再手选。默认结束日 = 入职日 + 月数 − 1 天；有效结束日不超过入职日 + 6 个月。", "Status wird aus Daten abgeleitet. Standard: Eintritt + Monate − 1 Tag; wirksam höchstens Eintritt + 6 Monate.")}</p>
      ${gaps.length ? `<div class="emp-special-gap">
        <p class="emp-approve-warn">${empT(`第一、二层还差 ${gaps.length} 项：${gaps.map(m => empRaw(m.label)).join("、")}。这只是提示，员工提交和审核都没有被挡；但通过时需要老板做特殊审批并写原因。`,
          `Ebene 1/2: ${gaps.length} Angaben fehlen: ${gaps.map(m => empRaw(m.label)).join(", ")}. Nur ein Hinweis; zur Freigabe ist eine Sonderfreigabe des Inhabers mit Begründung nötig.`)}</p>
        ${empCan("ownerOnly")
          ? `<div class="field"><label>${empT("特殊审批原因（必填；会记录原因、审批人和时间）", "Begründung der Sonderfreigabe (Pflicht; mit Person und Zeit protokolliert)")}</label>
              <input class="emp-special-reason" data-emp-field="approve.specialReason" placeholder="${empT("例如：员工出国中，医保卡号下周补", "z. B.: Person im Ausland, Nummer folgt nächste Woche")}"></div>`
          : `<p class="emp-disabled-reason">${empT("店长不能做特殊审批：请退回补充，或等老板处理（老板待办里已有“特殊审批待批”）。", "Filialleitung kann keine Sonderfreigabe erteilen: zurückgeben oder auf den Inhaber warten.")}</p>`}
      </div>` : ""}
      <div class="field" style="margin-top:12px"><label>${empT("退回理由（退回时必填）", "Begründung (bei Rückgabe nötig)")}</label>
        <textarea class="emp-return-note" rows="2" placeholder="${empT("例如：健康证拍得看不清到期日，麻烦重拍一张。", "z. B.: Ablaufdatum der Belehrung ist unleserlich, bitte neu fotografieren.")}"></textarea></div>
      <div class="emp-return-picks"><strong>${empT("标出被退回的项（可多选）", "Beanstandete Positionen markieren")}</strong>
        <div class="emp-return-grid">${empOnbItems(e, "submitted").map(x => `<label class="emp-check"><input type="checkbox" class="emp-return-item" data-item="${empEsc(x.key)}"${(inv.returnItems || []).includes(x.key) ? " checked" : ""}> ${empText(x.label)}</label>`).join("")}</div>
      </div>
      <div class="button-row" style="margin-top:12px">
        <button class="ghost-btn danger-lite emp-return-btn" data-id="${empEsc(e.id)}"${canSensitive ? "" : " disabled"}>${empT("退回补充", "Zur Ergänzung zurückgeben")}</button>
        <button class="primary-btn emp-approve-btn" data-id="${empEsc(e.id)}"${canSensitive && (!gaps.length || empCan("ownerOnly")) ? "" : " disabled"}>${gaps.length ? empT("特殊审批并通过，建立正式档案", "Mit Sonderfreigabe freigeben") : empT("审核通过，建立正式档案", "Freigeben und Akte anlegen")}</button>
      </div>
    </section>` : ""}`;
}

function empInviteFlow(current) {
  const steps = [
    ["draft", { zh: "建档", de: "Angelegt" }],
    ["fill", { zh: "员工填写", de: "Mitarbeiter" }],
    ["review", { zh: "审核", de: "Prüfung" }],
    ["contract", { zh: "发合同", de: "Versand" }],
    ["sign", { zh: "签回", de: "Unterschrift" }],
    ["done", { zh: "归档", de: "Ablage" }]
  ];
  const now = ({
    draft: 0, fill: 1, review: 2, returned: 1, contract: 3, sign: 4, archive: 5, done: 6
  })[current] ?? 0;
  return `<ol class="emp-flow emp-flow-wide">${steps.map((st, i) => `<li class="${i < now ? "is-done" : i === now ? "is-now" : ""}">
    <i>${i < now ? "✓" : i + 1}</i><span>${empText(st[1])}</span></li>`).join("")}</ol>`;
}

const EMP_RETURN_ITEM_LABELS = {
  nationality: { zh: "国籍类别", de: "Staatsangehörigkeit" },
  student: { zh: "是否学生", de: "Studierend" },
  name: { zh: "姓名", de: "Name" },
  birthday: { zh: "出生日期", de: "Geburtsdatum" },
  address: { zh: "地址", de: "Anschrift" },
  iban: { zh: "IBAN", de: "IBAN" },
  rentenversicherung: { zh: "社会保险号", de: "Sozialversicherungsnummer" },
  contract: { zh: "签好的劳动合同与个人问卷", de: "Vertrag und Fragebogen" },
  steuerId: { zh: "Steuer-ID", de: "Steuer-ID" },
  krankenkasse: { zh: "医保公司", de: "Krankenkasse" },
  healthCardNumber: { zh: "医保卡号", de: "Krankenversichertennummer" },
  healthPhotos: { zh: "医保卡正反面照片", de: "Krankenkarte beidseitig" },
  passport: { zh: "护照 / 身份证", de: "Reisepass / Personalausweis" },
  visa: { zh: "居留许可", de: "Aufenthaltstitel" },
  zusatz: { zh: "附加页（Zusatzblatt）", de: "Zusatzblatt" },
  student: { zh: "在读证明", de: "Immatrikulationsbescheinigung" },
  bankFront: { zh: "银行卡正面照片", de: "Bankkarte Vorderseite" },
  healthFront: { zh: "医保卡正面照片", de: "Krankenkarte Vorderseite" },
  healthBack: { zh: "医保卡反面照片", de: "Krankenkarte Rückseite" },
  hygiene: { zh: "食品卫生指导证明（健康证首次证明）", de: "Erstbelehrung nach §43 IfSG" }
};

function empReturnItemLabel(key) {
  if (String(key).startsWith("doc:")) {
    const id = String(key).slice(4);
    return empRaw(EMP_ONB_DOC_LABELS[id] || { zh: id, de: id });
  }
  return empRaw(EMP_RETURN_ITEM_LABELS[key] || { zh: key, de: key });
}

/* 逐项对照：公司填的 vs 员工填的。个人信息以员工为准，合同条件以公司为准（HR-ONB-10）。 */
function empInviteCompare(e) {
  const hasSub = !!Object.keys(e.invite?.submitted || {}).length;
  const formal = empInviteView(e, "formal");
  const sub = empInviteView(e, "submitted");
  const base = e.invite?.companyBaseline?.personal || null;
  const company = base ? {
    name: base.name || "", birthday: base.birthday || "",
    contact: base.contact || {}, ids: base.ids || {},
    nationality: base.nationality || "", student: base.student || ""
  } : formal;
  const employee = hasSub && e.invite?.state !== "approved" ? sub : formal;
  const show = hasSub || !!base || e.invite?.state === "approved";
  const addressOf = v => [v.contact?.street, v.contact?.houseNo, v.contact?.zip, v.contact?.city].filter(Boolean).join(" ");
  const row = (label, a, b, sensitive) => ({ label, company: a || "", employee: b || "", sensitive: !!sensitive,
    diff: String(a || "") !== String(b || "") });
  const rows = show ? [
    row(empRaw({ zh: "姓名", de: "Name" }), company.name, employee.name),
    row(empRaw({ zh: "出生日期", de: "Geburtsdatum" }), company.birthday, employee.birthday, true),
    row(empRaw({ zh: "地址", de: "Anschrift" }), addressOf(company), addressOf(employee)),
    row("IBAN", company.ids?.iban, employee.ids?.iban, true),
    row("Steuer-ID", company.ids?.steuerId || company.ids?.steuernummer, employee.ids?.steuerId || employee.ids?.steuernummer, true),
    row(empRaw({ zh: "社会保险号", de: "Sozialversicherungsnummer" }), company.ids?.rentenversicherung, employee.ids?.rentenversicherung, true),
    row(empRaw({ zh: "医保公司", de: "Krankenkasse" }), company.contact?.krankenkasse, employee.contact?.krankenkasse),
    row(empRaw({ zh: "医保卡号", de: "Krankenversichertennummer" }), company.ids?.healthCardNumber, employee.ids?.healthCardNumber, true),
    row(empRaw({ zh: "国籍类别", de: "Staatsangehörigkeit" }), company.nationality, employee.nationality),
    row(empRaw({ zh: "是否学生", de: "Studierend" }), company.student, employee.student)
  ] : [];
  const c = e.invite?.submitted?.contract || {};
  const contractValue = (key, value) => {
    if (value == null || value === "") return "";
    if (key === "type") return empRaw(empContractType(value).name);
    if (key === "payType") return value === "pauschal" ? empRaw({ zh: "Pauschal 月薪", de: "Pauschale" }) : empRaw({ zh: "时薪", de: "Stundenlohn" });
    return value;
  };
  /* 合同差异要覆盖岗位、合同类型、月工时下限等全部条件字段（HR-ONB-10） */
  const contractFields = [
    ["type", empRaw({ zh: "合同类型", de: "Vertragsart" })],
    ["payType", empRaw({ zh: "薪资方式", de: "Vergütungsart" })],
    ["urlaubDays", empRaw({ zh: "年假天数", de: "Urlaubstage" })],
    ["noticePeriod", "Kündigungsfrist"],
    ["rate", empRaw({ zh: "薪资金额 €", de: "Betrag €" })],
    ["hoursMin", empRaw({ zh: "月工时下限", de: "Sollstunden min." })],
    ["hoursMax", empRaw({ zh: "月工时上限", de: "Sollstunden max." })],
    ["weeklyHours", empRaw({ zh: "每周约定工时", de: "Wochenstunden" })]
  ];
  const contractRows = contractFields
    .filter(([key]) => c[key] != null && String(c[key]) !== String(e.contract?.[key] ?? ""))
    .map(([key, label]) => ({ label, company: contractValue(key, e.contract?.[key]), employee: contractValue(key, c[key]) }));
  if (c.position != null && String(c.position) !== String(empRaw(empRole(e.role).name))) {
    contractRows.unshift({ label: empRaw({ zh: "岗位", de: "Position" }), company: empRaw(empRole(e.role).name), employee: c.position });
  }
  return { rows, contractRows, hasSub };
}

function empSensitiveCell(row) {
  if (!row.employee) return `<span class="emp-miss">${empT("没填", "fehlt")}</span>`;
  if (row.sensitive && !empCan("sensitive")) return `<span class="emp-history-mask">••••</span>`;
  return empEsc(row.employee);
}

/* 对照表两列都要过敏感权限：公司列也可能有生日、IBAN 等原值（HR-ACCESS-55） */
function empCompareCell(value, sensitive) {
  if (!value) return `<span class="emp-miss">—</span>`;
  if (sensitive && !empCan("sensitive")) return `<span class="emp-history-mask">••••</span>`;
  return empEsc(value);
}

function empInviteLayerBlock(e, pr) {
  const force = e?.invite?.state === "approved" ? undefined : "submitted";
  const items = empOnbItems(e, force);
  return [1, 2, 3].map(layer => {
    const list = items.filter(x => x.layer === layer);
    return `<div class="emp-layer-block is-${layer}">
      <div class="emp-layer-head"><strong>${empText(EMP_ONB_LAYER_NAMES[layer])}</strong>
        <span>${pr.layers[layer].done}/${pr.layers[layer].total}</span></div>
      <div class="emp-layer-items">${list.map(x => `<span class="emp-layer-item${x.done ? " is-done" : " is-missing"}">${x.done ? "✓" : "✗"} ${empText(x.label)}</span>`).join("")}</div>
    </div>`;
  }).join("");
}

function empInviteReview(e, pr) {
  const compare = empInviteCompare(e);
  const view = empInviteView(e, e.invite?.state === "approved" ? undefined : (compare.hasSub ? "submitted" : undefined));
  const docs = empOnbDocList(view).map(t => ({ type: t, doc: view.docs?.[t.id] }));
  return `
    <div class="emp-review-block">
      <h3>${empT("必填三层", "Drei Pflichtebenen")}</h3>
      ${empInviteLayerBlock(e, pr)}
      <p class="small">${empT("三层清单只提示缺什么，不挡员工提交；第一、二层没交齐时，通过需要老板做特殊审批并留记录；第三层缺项不影响通过（答复 ANS-1）。", "Die drei Ebenen zeigen nur, was fehlt, und blockieren die Abgabe nicht; bei Lücken in Ebene 1/2 braucht die Freigabe eine Sonderfreigabe des Inhabers; Ebene 3 stört nicht (ANS-1).")}</p>
    </div>
    ${compare.rows.length ? `<div class="emp-review-block">
      <h3>${empT("公司填的 vs 员工填的", "Betrieb vs. Mitarbeiter")}</h3>
      <table class="table emp-table emp-review-table">
        <thead><tr><th>${empT("项目", "Feld")}</th><th>${empT("公司填的", "Betrieb")}</th><th>${empT("员工填的", "Mitarbeiter")}</th></tr></thead>
        <tbody>${compare.rows.map(r => `<tr class="${r.diff ? "is-diff" : ""}">
          <td>${r.label}</td><td>${empCompareCell(r.company, r.sensitive)}</td><td>${empSensitiveCell(r)}</td>
        </tr>`).join("")}</tbody>
      </table>
      <p class="small">${empT("个人信息（姓名、地址、证件号、IBAN、国籍、是否学生）以员工为准；合同条件以公司为准，员工填的合同值不会被采纳（HR-ONB-10）。", "Persönliche Daten gelten nach Mitarbeiter; Vertragsbedingungen nach Betrieb (HR-ONB-10).")}</p>
    </div>` : ""}
    <div class="emp-review-block">
      <h3>${empT("证件与文件", "Dokumente")}</h3>
      ${docs.length ? docs.map(d => {
        const doc = d.doc || {};
        const ok = doc.state === "ok" && doc.file;
        const layerClass = d.type.layer === 1 ? "submit" : d.type.layer === 2 ? "beforeStart" : "later";
        return `<div class="emp-doc is-${ok ? "ok" : "missing"}">
          <div class="emp-doc-head"><strong>${empRaw(EMP_ONB_DOC_LABELS[d.type.id])}</strong>
            <span class="emp-doc-head-tags"><span class="emp-doc-layer is-${layerClass}">${empText(EMP_ONB_LAYER_NAMES[d.type.layer])}</span>
            ${ok ? empPill("green", empT("已上传", "Hochgeladen")) : empPill("red", empT("未上传", "Fehlt"))}</span></div>
          <div class="emp-doc-body">${doc.file ? empFileLink(doc, !empCan("sensitive")) : ""}
            ${doc.expiry ? `<span class="emp-doc-days">${empT("到期", "Ablauf")} ${empFormatDate(doc.expiry)}</span>` : ""}</div>
        </div>`;
      }).join("") : `<p class="emp-empty">${empT("国籍类别还没回答，材料清单待确认。", "Staatsangehörigkeit offen — Unterlagenliste noch unklar.")}</p>`}
    </div>
    ${compare.contractRows.length || e.invite.submitted?.contractNote ? `<div class="emp-review-block">
      <h3>${empT("合同条件差异（以公司为准）", "Vertragsabweichungen (Betrieb gilt)")}</h3>
      ${compare.contractRows.length ? `<table class="table emp-table emp-review-table">
        <thead><tr><th>${empT("项目", "Feld")}</th><th>${empT("公司填的", "Betrieb")}</th><th>${empT("员工填的（不采纳）", "Mitarbeiter (nicht übernommen)")}</th></tr></thead>
        <tbody>${compare.contractRows.map(r => `<tr class="is-diff"><td>${r.label}</td><td>${empEsc(r.company)}</td><td>${empEsc(r.employee)}</td></tr>`).join("")}</tbody>
      </table>` : ""}
      ${e.invite.submitted?.contractNote ? `<p class="emp-review-note">${empEsc(e.invite.submitted.contractNote)}</p>` : ""}
    </div>` : ""}`;
}

function empSpecialApprovalBlock(e) {
  const record = e.invite?.specialApproval;
  if (!record) return "";
  return `<div class="emp-review-block emp-special-block">
    <h3>${empT("特殊审批记录", "Sonderfreigabe (Protokoll)")}</h3>
    <p>${empT(`通过时第一、二层没交齐：${empEsc((record.labels || []).join("、"))}`, `Bei Freigabe fehlten: ${empEsc((record.labels || []).join(", "))}`)}</p>
    <p class="small">${empT("原因", "Begründung")}：${empEsc(record.reason || "—")} · ${empT("审批人", "Freigegeben von")}：${empEsc(record.by || "—")} · ${empStamp(record.at)}</p>
  </div>`;
}

function empInvitePreview(e) {
  const view = empInviteView(e);
  const items = empOnbItems(e, view.source === "submitted" ? "submitted" : undefined);
  const pr = view.source === "submitted" ? empInviteProgress(e) : { layers: empOnbLayerProgress(e) };
  const docs = empOnbDocList(view);
  const address = [view.contact.street, view.contact.houseNo, view.contact.zip, view.contact.city].filter(Boolean).join(" ");
  const mask = (value) => empCan("sensitive") ? (value || "—") : (value ? "••••" : "—");
  return `<div class="emp-preview">
    <p class="small">${empT("这是员工打开链接后会看到的只读页面；读的是最后一次提交的版本或正式档案，永远不含员工草稿值，预览不改变任何状态（HR-ONB-55）。", "Schreibgeschützte Mitarbeiteransicht: letzte Abgabe bzw. Akte, nie Entwürfe; keine Statusänderung (HR-ONB-55).")}</p>
    <div class="emp-preview-block"><strong>${empT("第一屏：要准备的材料", "Erster Bildschirm: Unterlagen")}</strong>
      ${docs.length ? `<p>${docs.map(d => empRaw(EMP_ONB_DOC_LABELS[d.id])).join("、")}</p>` : `<p>${empT("待确认国籍：回答国籍类别后才会列出需要哪些材料。", "Staatsangehörigkeit offen — Liste folgt nach Antwort.")}</p>`}
    </div>
    <div class="emp-preview-block"><strong>${empT("三层进度", "Drei Ebenen")}</strong><p>${empLayerCountsText(pr.layers)}</p></div>
    <div class="emp-preview-block"><strong>${empT("个人信息（只读）", "Persönliche Daten (nur lesen)")}</strong>
      <table class="table emp-table emp-review-table"><tbody>
        <tr><td>${empT("姓名", "Name")}</td><td>${empEsc(view.name || "—")}</td></tr>
        <tr><td>${empT("出生日期", "Geburtsdatum")}</td><td>${empEsc(mask(view.birthday))}</td></tr>
        <tr><td>${empT("地址", "Anschrift")}</td><td>${empEsc(address || "—")}</td></tr>
        <tr><td>IBAN</td><td>${empEsc(mask(view.ids.iban))}</td></tr>
        <tr><td>${empT("国籍类别", "Staatsangehörigkeit")}</td><td>${empEsc(view.nationality || "—")}</td></tr>
        <tr><td>${empT("是否学生", "Studierend")}</td><td>${empEsc(view.student || "—")}</td></tr>
      </tbody></table>
    </div>
    <div class="emp-preview-block"><strong>${empT("证件状态", "Dokumentstatus")}</strong>
      ${docs.length ? docs.map(d => `<div class="emp-preview-doc"><span>${empRaw(EMP_ONB_DOC_LABELS[d.id])}</span><span>${empOnbDocOk(view.docs, d.id) ? empT("已上传", "Hochgeladen") : empT("待上传", "Fehlt")}</span></div>`).join("") : ""}
    </div>
    <div class="emp-preview-block"><strong>${empT("合同与问卷", "Vertrag und Fragebogen")}</strong><p>${empText(empContractDispatchState(e).name)}</p></div>
    <p class="small">${empT("预览只读，不提供填写链接或复制按钮，也不能代员工填写；审核人只看最后一次提交（清单 5.详情第 1 条）。", "Nur lesen: kein Ausfüll-Link, kein Kopieren, keine Eingabe für den Mitarbeiter; nur letzte Abgabe (Liste 5.1).")}</p>
  </div>`;
}

function empInviteTimeline(e) {
  const inv = e.invite || {};
  const items = [];
  const push = (at, label) => { if (at) items.push([at, label]); };
  push(inv.createdAt, empT("建档", "Angelegt"));
  /* 首次发送时间用 firstSentAt：重发会覆盖 sentAt，不能让首次发送从时间线消失（HR-ACCESS-24） */
  if (empInviteSentAt(inv)) push(empInviteSentAt(inv), empT(`发送邀请邮件（${empRaw(empInviteSendResult(inv).name)}）`, `Einladung gesendet (${empRaw(empInviteSendResult(inv).name)})`));
  (inv.resendLog || []).forEach(r => push(r.at, empT("重发：换新链接，旧链接失效", "Erneut gesendet: neuer Link, alter ungültig")));
  (inv.previousInvites || []).forEach(p => push(p.sentAt, empT("旧链接发送记录", "Frühere Einladung")));
  (inv.reminders || []).filter(r => r.kind !== "resend").forEach(r => push(r.at, empT("催办", "Erinnerung")));
  if (inv.submittedAt) push(inv.submittedAt, empT("员工提交（最后一版）", "Abgabe (letzte Version)"));
  if (inv.state === "returned") push(inv.reviewedAt, empT("退回补充", "Zurückgegeben"));
  if (inv.approvedAt || (inv.state === "approved" && inv.reviewedAt)) push(inv.approvedAt || inv.reviewedAt, empT("审核通过", "Freigegeben"));
  if (inv.contractSentAt) push(inv.contractSentAt, empT("合同与问卷发出", "Vertrag und Fragebogen gesendet"));
  ["contract", "questionnaire"].forEach(k => {
    const r = inv.contractReview?.[k];
    if (r?.at) push(r.at, empT(`${k === "contract" ? "劳动合同" : "个人问卷"}核对${r.state === "approved" ? "通过" : "退回"}`, `${k === "contract" ? "Vertrag" : "Fragebogen"}: ${r.state === "approved" ? "geprüft" : "zurückgegeben"}`));
  });
  if (inv.contractSignedSubmittedAt) push(inv.contractSignedSubmittedAt, empT("员工签回两份", "Beide unterschrieben zurück"));
  if (inv.contractVoid?.at) push(inv.contractVoid.at, empT(`合同作废：${inv.contractVoid.reason}`, `Vertrag storniert: ${inv.contractVoid.reason}`));
  if (inv.archivedAt || inv.contractSignedReviewedAt) push(inv.archivedAt || inv.contractSignedReviewedAt, empT(inv.dispatchMode === "offline" ? "线下签署归档" : "核对归档", inv.dispatchMode === "offline" ? "Offline abgelegt" : "Geprüft und abgelegt"));
  if (inv.revokedAt) push(inv.revokedAt, empT(`撤销邀请：${inv.revokeReason || ""}`, `Zurückgezogen: ${inv.revokeReason || ""}`));
  if (inv.cancelledAt) push(inv.cancelledAt, empT(`取消入职：${inv.cancelReason || ""}`, `Abgesagt: ${inv.cancelReason || ""}`));
  if (inv.reinvitedAt) push(inv.reinvitedAt, empT("重新邀请", "Erneut eingeladen"));
  (e.history || []).forEach(h => {
    if (!["approval.special", "contract.void", "contract.offline"].includes(h.field)) return;
    push(h.at, `${empRaw(EMP_EVENTS[h.field] || { zh: h.field, de: h.field })}${h.detail ? ` · ${h.detail}` : ""}`);
  });
  const seen = new Set();
  const uniq = items.filter(([at, label]) => {
    const key = `${at}|${label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return `<div class="emp-invite-timeline"><h3>${empT("时间线", "Verlauf")}</h3>
    <ul class="emp-timeline">${uniq.map(i => `<li><span>${empStamp(i[0])}</span><strong>${empEsc(i[1])}</strong></li>`).join("")}</ul></div>`;
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

  /* 链接过了具体到期时刻就不再接受填写（HR-ACCESS-25）；员工端 employee-ui 同样要拦 */
  if (empInviteExpiredAt(e)) return empOnboardShell(`
    <div class="emp-onboard-msg">
      <h1>${empT("链接已过期", "Link abgelaufen")}</h1>
      <p>${empT("这个填写链接已经过期。请联系店长重新发一份，旧链接里的内容不会丢。", "Dieser Link ist abgelaufen. Bitte die Filiale um eine neue Einladung — bereits gespeicherte Angaben bleiben erhalten.")}</p>
    </div>`);

  /* 自填页显示“上次提交 + 本地草稿”的合并值，方便员工继续改 */
  const sub = empInviteDraftData(e.invite);
  const pr = empInviteFillProgress(e);
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
          ${empInput("Steuer-ID（个人税务识别号）", "ids.steuerId", val("ids.steuerId"))}
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
  if(typeof euBindIdentityHints==='function')euBindIdentityHints(document);
  empBindContractDispatch();
  empBindNewPersonal();
  document.querySelectorAll('.emp-shared-doc-upload').forEach(input=>input.addEventListener('change',async()=>{
    const file=input.files?.[0];if(!file)return;
    const key=input.dataset.doc;
    const type=empDocType(key);
    const uploadError=empUploadError(file, type.imageOnly === true || ["bankFront","bankBack","healthFront","healthBack"].includes(key));
    if(uploadError){empFlash(input.parentElement,uploadError);input.value='';return;}
    const current=empById(input.dataset.id);if(!current)return;
    const row=input.closest('.emp-doc');
    const old=current.docs?.[key]||{};
    const dateInput=row?.querySelector('.emp-doc-date');
    const keepOld=row?.querySelector('.emp-replace-keep')?.checked === true;
    const keepReason=(row?.querySelector('.emp-replace-reason')?.value||'').trim();
    const dateValue=dateInput?(dateInput.value||''):'';
    let expiry=dateValue;
    let keptReason='';
    /* 替换文件（HR-DOC-20）：新版本有效期初始为空 —— 必须填新日期，或明确保留原日期并写原因 */
    if(type.expiry && key!=='belehrung' && old.file){
      const isNewDate=!!dateValue && dateValue!==old.expiry;
      if(!isNewDate && !keepOld){empFlash(input.parentElement,empT('请填新的有效期，或勾选“保留原日期”并写原因','Neues Datum eintragen oder „bisheriges Datum behalten“ mit Begründung wählen'));input.value='';return;}
      if(!isNewDate && keepOld && !keepReason){empFlash(input.parentElement,empT('保留原日期必须写原因','Begründung ist Pflicht'));input.value='';return;}
      if(!isNewDate && keepOld){expiry=old.expiry||'';keptReason=keepReason;}
    }
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    const next=JSON.parse(JSON.stringify(current));
    /* 健康证旧档案只有 expiry 时，先算出最近复训日再覆盖，别把推算出的日期弄丢（HR-DOC-31/35） */
    empReplaceDoc(next,key,{file:file.name,dataUrl,at:empNow(),by:empActorLabel(),expiry:type.expiry?(expiry||null):null,keepExpiry:keepOld,keepReason:keptReason||keepReason});
    empSaveWithHistory(next,empActorLabel());app();
  }));
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
      /* 国籍三值与附加页三值存新字段，旧 nonEU / hasZusatz 由 hr-model 同步派生 */
      if (next.contract && next.contract.nationalityClass !== undefined
          && next.contract.nationalityClass !== empNationalityClass(e)) empSetNationality(next, next.contract.nationalityClass);
      if (next.contract && next.contract.zusatzCheck !== undefined
          && next.contract.zusatzCheck !== empZusatzValue(e)) empSetZusatz(next, next.contract.zusatzCheck);
      /* 学生身份是员工回答的三态字段：空字符串表示未回答，存 null 而不是 false */
      if (next.contract && typeof next.contract.isStudent === "string") {
        next.contract.isStudent = next.contract.isStudent === "yes" ? true : next.contract.isStudent === "no" ? false : null;
      }
      if (next.contract?.type === "werkstudent") next.contract.isStudent = true;
      next.employeeNo = String(next.employeeNo || "").trim();
      const noConflict = empEmployeeNoConflict(next, next.employeeNo);
      if (noConflict) {
        empFlash(button, empT(`员工编号已被 ${noConflict.name} 使用`, `Personalnummer bereits bei ${noConflict.name}`));
        return;
      }
      /* 状态按日期推出来，不从表单读 —— 表单里已经没有这个下拉了 */
      empNormalizeStatus(next);
      /* 试用期结束日只有老板/管理员能直接改（HR-LIFE-10） */
      if (String(next.probationEnd || "") !== String(e.probationEnd || "") && !empCan("ownerOnly")) {
        empFlash(button, empT("试用期结束日（含提前转正）只有老板和管理员能改；店长请让老板改。", "Ende der Probezeit (inkl. vorzeitiger Übernahme) nur durch Inhaber/Admin."));
        return;
      }
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
      /* 健康证的提醒日期由“最近复训日 + 周期”算出来，同步写进旧字段给员工端读 */
      if (next.health?.lastRetrain) {
        next.docs.belehrung = { ...(next.docs.belehrung || {}), expiry: empNextRetrain(next) || null };
      }
      /* 新员工每一项材料必须有文件；只有迁移老员工允许“仅记录、无文件”（HR-DOC-19） */
      if (!next.migrated) {
        const missingFiles = EMP_DOC_TYPES.filter(type => empDocNeeded(next, type) && type.id !== "belehrung"
          && next.docs?.[type.id]?.state === "ok" && !next.docs[type.id].file);
        const healthNoFile = empHealth(next).firstProof === "yes" && !next.docs.belehrung?.file;
        if (missingFiles.length || healthNoFile) {
          empFlash(button, empT("新员工每项材料都必须有文件；迁移老员工才允许“仅记录”", "Neue Beschäftigte brauchen zu jeder Unterlage eine Datei"));
          return;
        }
      }
      /* 合同条件按生效日期分版本；店长的改动先形成提案（HR-CONTRACT-02、HR-ACCESS-07）。
         只有合同页签的保存才走版本化，避免在个人资料页保存时误生成“通知期”改动。 */
      const contractForm = !!root.querySelector('[data-emp-field="contract.validFrom"]');
      const contractChanges = contractForm ? empContractConditionChanges(e.contract || {}, empPrepareContractForSave(JSON.parse(JSON.stringify(next.contract || {})))) : [];
      if (contractForm) next.contract = empPrepareContractForSave(next.contract || {});
      if (contractForm) {
        const validFrom = String(next.contract.validFrom || "").trim();
        if (!validFrom || !empValidExpiry(validFrom)) {
          empFlash(button, empT("请填合同条件的生效日期（必填）", "Wirksamkeitsdatum ist Pflicht"));
          return;
        }
        if (e.entryDate && validFrom < e.entryDate) {
          empFlash(button, empT(`生效日期不得早于入职日 ${empFormatDate(e.entryDate)}`, `Wirksamkeit nicht vor Eintritt ${empFormatDate(e.entryDate)}`));
          return;
        }
        /* HR-CONTRACT-02：每次保存新增一版，同一内容同一生效日也照样留痕 */
        if (!empCan("confirmProposal")) {
          if (contractChanges.length && !empCan("editTerms")) {
            empFlash(button, empDenyReason("editTerms"));
            return;
          }
          if (contractChanges.length) {
            const submitted = empSubmitContractProposal(e, next, contractChanges, validFrom);
            if (!submitted.ok) {
              empFlash(button, submitted.message || empT("提案提交失败", "Vorschlag fehlgeschlagen"));
              return;
            }
            empMarkSaved(button.dataset.id);
            app();
            return;
          }
          /* 没有条件改动：店长不能只改生效日期，正式档案保持原值 */
          next.contract = JSON.parse(JSON.stringify(e.contract || {}));
        } else {
          empPushContractVersion(next, validFrom, empActorLabel(), e.contract || {});
          /* 未来生效的版本只进版本列表，e.contract 仍是今天有效的版本 */
          empApplyEffectiveContract(next, empToday());
          empLogEvent(next, "contract.confirmed", `生效日期 ${validFrom} · ${contractChanges.length} 项改动`, empActorLabel(), validFrom);
        }
      }
      empSaveWithHistory(next, empActorLabel());
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
      const pickedStaff = picked.map(n => empByName(n)).filter(Boolean);
      const askable = pickedStaff.filter(e => !empPushBlockReason(e, empToday()));
      footer.classList.toggle("is-hidden", picked.length === 0);
      if (count) count.textContent = !picked.length ? ""
        : askable.length
          ? empT(`已选 ${picked.length} 人，其中 ${askable.length} 人可推送${picked.length > askable.length ? `，${picked.length - askable.length} 人不能推送（无邮箱/未绑定/不在岗）` : ""}`,
                  `${picked.length} ausgewählt, ${askable.length} möglich${picked.length > askable.length ? `, ${picked.length - askable.length} nicht (E-Mail/Bindung/Status)` : ""}`)
          : empT(`已选 ${picked.length} 人，都不能推送：需要先填邮箱、接受邀请并确认绑定，而且仍在岗`, `${picked.length} ausgewählt — E-Mail, bestätigte Verknüpfung und aktiver Status nötig`);
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
      if (!empCan("export")) { empFlash(button, empDenyReason("export")); return; }
      const blob = new Blob([empRosterCsv(list)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `KaiSpan_Mitarbeiter_${empToday()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      empFlash(button, empT(`已导出 ${list.length} 人${empCanExportSensitive() ? "" : "（敏感列已留空）"}`, `${list.length} exportiert${empCanExportSensitive() ? "" : " (vertrauliche Spalten leer)"}`));
    });
  });
  document.querySelectorAll(".emp-batch-invite").forEach(button => {
    button.addEventListener("click", () => {
      if (!empCan("invite")) { empFlash(button, empDenyReason("invite")); return; }
      /* 按所选行的档案 ID 定位，不能再拿姓名反查 —— 同名员工会发给第一个（HR-ACCESS-54）。
         兼容旧 DOM：没有 data-id 时退回姓名，但优先检查姓名是否唯一。 */
      const rows = [...document.querySelectorAll(".emp-roster tbody .employee-row-check:checked")]
        .map(input => input.closest("tr"))
        .filter(Boolean);
      const picked = [];
      const seen = new Set();
      rows.forEach(row => {
        const id = row.dataset?.id || "";
        const name = row.querySelector(".emp-name-link")?.textContent.trim() || "";
        if (id) {
          if (seen.has(id)) return;
          seen.add(id);
          const e = empById(id);
          if (e) picked.push({ id, name: e.name });
          else picked.push({ id, name, missing: true });
          return;
        }
        const same = empAllStaff().filter(e => e.name === name);
        if (same.length === 1) { picked.push({ id: same[0].id, name }); return; }
        picked.push({ id: "", name, missing: true, duplicateName: same.length > 1 });
      });
      if (!picked.length) { empFlash(button, empT("先勾选员工", "Erst Mitarbeiter auswählen")); return; }
      if (picked.length > 20) { empFlash(button, empT("一次最多 20 条，请分批勾选（HR-ACCESS-54）", "Maximal 20 pro Lauf (HR-ACCESS-54)")); return; }
      const results = picked.map(p => {
        const name = p.name;
        if (p.missing) return { name, ok: false, reason: p.duplicateName
          ? empT("同名档案不止一个，请在表格里重新勾选", "Mehrere Akten mit diesem Namen — bitte neu auswählen")
          : empT("找不到档案", "Akte nicht gefunden") };
        const e = empById(p.id);
        if (!e) return { name, ok: false, reason: empT("找不到档案", "Akte nicht gefunden") };
        if (empNoEmail(e)) return { name, ok: false, reason: empT("需要先填邮箱", "E-Mail fehlt") };
        if (empStatus(e.status).leaving) return { name, ok: false, reason: empT("不在岗，不能发邀请", "Nicht aktiv") };
        const state = empAccountState(e);
        if (empAccountActive(e) || ["invited", "accepted", "pending_link"].includes(state)) {
          return { name, ok: false, reason: empT("已有账号或邀请，未重复发送", "Konto/Einladung vorhanden") };
        }
        const result = empInviteAccount(p.id, "invite");
        return result.ok
          ? { name, ok: true, reason: empT("已发出邀请", "Einladung gesendet") }
          : { name, ok: false, reason: result.message || empT(result.reason === "email" ? "需要先填邮箱" : "发送失败", result.reason === "email" ? "E-Mail fehlt" : "Fehlgeschlagen") };
      });
      const okCount = results.filter(r => r.ok).length;
      app();
      document.querySelector(".emp-listbar")?.insertAdjacentHTML("afterend",
        `<section class="card emp-batch-result" role="status">
          <div class="section-title"><h2>${empT("批量发邀请结果", "Ergebnis der Sammel-Einladung")}</h2>
            <span class="small">${empT(`${okCount} / ${results.length} 成功`, `${okCount} / ${results.length} gesendet`)}</span></div>
          <ul>${results.map(r => `<li class="${r.ok ? "is-ok" : "is-fail"}"><strong>${empEsc(r.name)}</strong><span>${empEsc(r.reason)}</span></li>`).join("")}</ul>
        </section>`);
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
      if (!preset) {
        const hint = document.querySelector(".emp-preset-hint");
        if (hint) hint.textContent = typeSelect.value === "praktikum" ? empT("实习的工时和薪资请按具体合同填写。", "Arbeitszeit und Vergütung für ein Praktikum bitte nach Vertrag eintragen.") : "";
        return;
      }
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
      /* HR-LIFE-06：结束日 = 入职 + 月数 − 1 天，与审核页和老板端共用同一算法 */
      probInput.value = empProbationDefaultEndAt(entryInput.value, empRule("probationMonths"));
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
    button.addEventListener("click", () => {
      const panel = button.closest(".emp-sofort");
      const noSv = !!panel?.querySelector(".emp-sofort-nosv-box")?.checked;
      const alt = {};
      panel?.querySelectorAll(".emp-sofort-alt-input").forEach(input => { alt[input.dataset.field] = input.value.trim(); });
      empMarkSofort(button.dataset.id, true, { noSv, alt });
      app();
    });
  });
  document.querySelectorAll(".emp-sofort-undo").forEach(button => {
    button.addEventListener("click", () => { empMarkSofort(button.dataset.id, false); app(); });
  });
  document.querySelectorAll(".emp-sofort-nosv-box").forEach(box => {
    box.addEventListener("change", () => {
      const e = empById(box.dataset.id);
      if (!e) return;
      const next = JSON.parse(JSON.stringify(e));
      next.sofortmeldung = { ...(next.sofortmeldung || {}), noSv: box.checked, alt: box.checked ? (next.sofortmeldung?.alt || {}) : {} };
      empSaveStaff(next);
      app();
    });
  });
  document.querySelectorAll(".emp-sofort-alt-input").forEach(input => {
    input.addEventListener("change", () => {
      const e = empById(input.closest(".emp-sofort")?.querySelector(".emp-sofort-nosv-box")?.dataset.id);
      if (!e) return;
      const next = JSON.parse(JSON.stringify(e));
      next.sofortmeldung = { ...(next.sofortmeldung || {}), noSv: true, alt: { ...(next.sofortmeldung?.alt || {}), [input.dataset.field]: input.value.trim() } };
      empSaveStaff(next);
    });
  });
  /* --- 员工账号 --- */
  document.querySelectorAll(".emp-account-invite").forEach(button => {
    button.addEventListener("click", () => {
      const result = empInviteAccount(button.dataset.id, button.dataset.mode);
      if (result.ok) { app(); return; }
      const reason = result.message || ({
        email: empT("需要先填邮箱才能发邀请", "Zuerst E-Mail-Adresse ergänzen"),
        cooldown: empT("今天已经重发过，明天再试", "Heute bereits gesendet — morgen erneut"),
        state: empT("当前状态不能这样操作", "In diesem Status nicht möglich"),
        permission: empT("没有发邀请权限", "Keine Berechtigung zum Einladen")
      })[result.reason] || empT("操作失败", "Aktion fehlgeschlagen");
      empFlash(button, reason);
    });
  });
  document.querySelectorAll(".emp-account-link-start").forEach(button => {
    button.addEventListener("click", () => {
      const mail = button.closest(".emp-account-link")?.querySelector(".emp-member-pick")?.value || "";
      const result = empLinkAccount(button.dataset.id, mail);
      if (result.ok) app(); else empFlash(button, result.message || empT("关联失败", "Verknüpfung fehlgeschlagen"));
    });
  });
  document.querySelectorAll(".emp-account-unlink").forEach(button => {
    button.addEventListener("click", () => { empUnlinkAccount(button.dataset.id); app(); });
  });

  /* --- 调店：门店只读，必须单独确认生效日期 --- */
  document.querySelectorAll(".emp-transfer-open").forEach(button => {
    button.addEventListener("click", () => button.closest(".card")?.querySelector(".emp-transfer-form")?.classList.remove("is-hidden"));
  });
  document.querySelectorAll(".emp-transfer-cancel").forEach(button => {
    button.addEventListener("click", () => button.closest(".emp-transfer-form")?.classList.add("is-hidden"));
  });
  document.querySelectorAll(".emp-transfer-confirm").forEach(button => {
    button.addEventListener("click", () => {
      const form = button.closest(".emp-transfer-form");
      const store = form?.querySelector(".emp-transfer-store")?.value || "";
      const date = form?.querySelector(".emp-transfer-date")?.value || "";
      const result = empTransferStore(button.dataset.id, store, date);
      if (!result.ok) {
        const box = form?.querySelector(".emp-transfer-error");
        if (box) box.textContent = result.message;
        else empFlash(button, result.message);
        return;
      }
      app();
    });
  });

  /* --- 岗位只作名册标签，新增不联动权限（HR-CONTRACT-05 / HR-ACCESS-15） --- */
  document.querySelectorAll(".emp-add-role").forEach(button => {
    button.addEventListener("click", () => {
      const input = button.closest(".emp-role-add")?.querySelector(".emp-new-role-name");
      const result = empAddRole(input?.value, button.dataset.id);
      if (!result.ok) {
        empFlash(button, result.reason === "permission" ? (result.message || empDenyReason("ownerOnly"))
          : result.reason === "exists" ? empT("这个岗位已经存在", "Position existiert bereits")
          : empT("请先填岗位名", "Bitte Positionsname eingeben"));
        return;
      }
      app();
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
      const e = empById(button.dataset.id);
      if (e && empHasRequest(e)) { empFlash(button, empT("已有一条未结束的补件请求", "Es gibt bereits eine offene Anfrage")); return; }
      if (e && (empHasOpenUpdateRequest(e) || empOpenSupplementSnapshot(e))) { empFlash(button, empT("员工已有一条未结束的资料修改/补件，先核对完再推送", "Es gibt bereits eine offene Datenänderung/Nachreichung")); return; }
      if (!empSendRequest(button.dataset.id)) {
        empFlash(button, empT("员工接受邀请后才能推送", "Erst nach Annahme der Einladung möglich"));
        return;
      }
      app();
    });
  });
  document.querySelectorAll(".emp-request-cancel").forEach(button => {
    button.addEventListener("click", () => { empCancelRequest(button.dataset.id); app(); });
  });
  document.querySelectorAll(".emp-request-accept").forEach(button => {
    button.addEventListener("click", () => {
      const result = empAcceptReview(button.dataset.id);
      if (!result.ok) { empFlash(button, result.message || empT("现在不能采纳，请核对请求内容", "Übernahme derzeit nicht möglich")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-request-return").forEach(button => {
    button.addEventListener("click", () => {
      const note = button.closest(".emp-request-bar")?.querySelector(".emp-request-note");
      if (!note || !note.value.trim()) { empFlash(button, empT("写清楚哪里不行", "Bitte begründen")); note?.focus(); return; }
      const result = empReturnReview(button.dataset.id, note.value.trim());
      if (!result.ok) { empFlash(button, result.message || empT("现在不能退回", "Rückgabe derzeit nicht möglich")); return; }
      app();
    });
  });
  /* 批量：只推给已经有员工账号的人；没有账号的保留在待处理里，不走邮件兜底。 */
  document.querySelectorAll(".emp-row-push").forEach(button => {
    button.addEventListener("click", () => {
      const e = empById(button.dataset.id);
      if (!e) return;
      const reason = empPushBlockReason(e, empToday());
      if (reason) { empFlash(button, reason); return; }
      if (!empSendRequest(e.id)) { empFlash(button, empT("现在不能推送", "Derzeit nicht möglich")); return; }
      app();
    });
  });
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
          ? empT("所选员工里有人还没接受邀请；接受邀请并确认绑定后才能推送", "Einige haben die Einladung noch nicht angenommen; erst danach möglich")
          : empT("勾选的人没有要补的", "Nichts anzufordern"));
        return;
      }
      app();
      if (skipped) {
        document.querySelector(".emp-listbar")?.insertAdjacentHTML("afterend",
          `<p class="emp-inline-result" role="status">${empT(`已推送 ${pushed} 人；${skipped} 人还没有已确认的账号，未推送。`, `${pushed} gesendet; ${skipped} ohne bestätigtes Konto.`)}</p>`);
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

  /* --- 试用期：按默认重算 / 提前转正 / 清空（HR-LIFE-06/10） --- */
  document.querySelectorAll(".emp-probation-consider").forEach(button => {
    button.addEventListener("click", () => {
      const date = button.closest(".emp-probation-confirm")?.querySelector(".emp-probation-date")?.value || "";
      const result = empSetProbationConfirm(button.dataset.id, date);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-probation-clear").forEach(button => {
    button.addEventListener("click", () => {
      const result = empClearProbation(button.dataset.id);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-probation-fill").forEach(button => {
    button.addEventListener("click", () => {
      const e = empById(button.dataset.id);
      if (!e || !e.entryDate) return;
      if (!empCan("ownerOnly")) { empFlash(button, empDenyReason("ownerOnly")); return; }
      const next = JSON.parse(JSON.stringify(e));
      next.probationEnd = empProbationDefaultEndAt(e.entryDate, empRule("probationMonths"));
      empNormalizeStatus(next);
      empSaveWithHistory(next, empActorLabel(), { effectiveDate: next.probationEnd });
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
      const result = empSetLeave(button.dataset.id, leave);
      if (!result.ok) { empFlash(button, result.message || empT("保存失败", "Speichern fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-leave-confirm-proposal").forEach(button => {
    button.addEventListener("click", () => {
      const result = empConfirmLeaveProposal(button.dataset.id);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-leave-reject").forEach(button => {
    button.addEventListener("click", () => {
      const reason = button.closest(".emp-proposal")?.querySelector(".emp-leave-reject-reason")?.value || "";
      empRejectLeaveProposal(button.dataset.id, reason);
      app();
    });
  });
  document.querySelectorAll(".emp-undo-leave").forEach(button => {
    button.addEventListener("click", () => {
      const reason = button.closest(".emp-revoke-leave")?.querySelector(".emp-undo-leave-reason")?.value || "";
      const result = empUndoLeave(button.dataset.id, reason);
      if (!result.ok) { empFlash(button, result.message || empT("撤销失败", "Rücknahme fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-retention-handle").forEach(button => {
    button.addEventListener("click", () => { empMarkRetentionHandled(button.dataset.id, button.dataset.category); app(); });
  });

  /* --- 合同条件提案：老板确认 / 驳回 --- */
  document.querySelectorAll(".emp-proposal-confirm").forEach(button => {
    button.addEventListener("click", () => {
      const result = empConfirmContractProposal(button.dataset.id);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-proposal-reject").forEach(button => {
    button.addEventListener("click", () => {
      const reason = button.closest(".emp-proposal")?.querySelector(".emp-proposal-reason")?.value || "";
      const result = empRejectContractProposal(button.dataset.id, reason);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });

  /* --- 定期合同到期三选一 --- */
  document.querySelectorAll(".emp-expiry-renew-btn").forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest(".emp-expiry-actions");
      const until = card?.querySelector(".emp-expiry-date")?.value || "";
      const effective = card?.querySelector(".emp-expiry-effective")?.value || "";
      if (!until) { empFlash(button, empT("请填新的到期日", "Neues Ende angeben")); return; }
      if (!effective) { empFlash(button, empT("请填本次变更的生效日期", "Wirksamkeitsdatum angeben")); return; }
      const result = empRequestContractChange(button.dataset.id, { befristetUntil: until }, `续签至 ${until}`, effective);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-expiry-permanent").forEach(button => {
    button.addEventListener("click", () => {
      const effective = button.closest(".emp-expiry-actions")?.querySelector(".emp-expiry-effective")?.value || "";
      if (!effective) { empFlash(button, empT("请填本次变更的生效日期", "Wirksamkeitsdatum angeben")); return; }
      const result = empRequestContractChange(button.dataset.id, { befristetUntil: null }, "转为不定期", effective);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-expiry-leave").forEach(button => {
    button.addEventListener("click", () => {
      const form = button.closest(".card")?.parentElement?.querySelector(".emp-leave-form");
      const e = empById(button.dataset.id);
      if (!form || !e) return;
      const until = e.contract?.befristetUntil || "";
      const notice = form.querySelector('[data-emp-field="leave.noticeDate"]');
      const last = form.querySelector('[data-emp-field="leave.lastDay"]');
      if (notice) notice.value = empToday();
      if (last) last.value = until && until >= empToday() ? until : empToday();
      form.classList.remove("is-hidden");
      form.scrollIntoView({ block: "center" });
    });
  });

  /* --- 新人个人调查问卷默认邮件与附件模板 --- */
  const questionnaireBody = document.querySelector(".emp-questionnaire-body");
  questionnaireBody?.addEventListener("input", () => {
    if (!empCan("ownerOnly")) return;
    const template = empQuestionnaireTemplate();
    if (empDe()) template.bodyDe = questionnaireBody.value;
    else template.bodyZh = questionnaireBody.value;
    empSaveQuestionnaireTemplate(template);
  });
  document.querySelector(".emp-questionnaire-file")?.addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!empCan("ownerOnly")) {
      const message = document.querySelector(".emp-questionnaire-error");
      if (message) message.textContent = empDenyReason("ownerOnly");
      event.target.value = "";
      return;
    }
    const error = empUploadError(file, false);
    if (error) {
      empFlash(event.target.closest(".emp-questionnaire-template"), error);
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const template = empQuestionnaireTemplate();
      template.file = { name: file.name, size: file.size, dataUrl: String(reader.result || "") };
      if (!empSaveQuestionnaireTemplate(template)) {
        const message = document.querySelector(".emp-questionnaire-error");
        if (message) message.textContent = empCan("ownerOnly")
          ? empT("本机存储空间不足，请使用较小的问问卷文件。", "Nicht genügend lokaler Speicher. Bitte eine kleinere Fragebogendatei verwenden.")
          : empDenyReason("ownerOnly");
        return;
      }
      app();
    };
    reader.readAsDataURL(file);
  });
  document.querySelector(".emp-questionnaire-delete")?.addEventListener("click", () => {
    if (!empCan("ownerOnly")) return;
    const template = empQuestionnaireTemplate();
    template.file = null;
    empSaveQuestionnaireTemplate(template);
    app();
  });

  /* --- 新增员工 --- */
  document.querySelectorAll(".emp-create-btn").forEach(button => {
    button.addEventListener("click", () => {
      const sendNow = button.dataset.send !== "0";
      const draft = {
        id: empNextId(), name: "", firstName: "", lastName: "", store: empScope() || empStores()[0], role: "front", level: "basic",
        status: "invited", migrated: false, entryDate: "", probationEnd: null,
        contract: { type: "teilzeit", payType: "hourly", rate: empRule("defaultHourlyWage") === "" ? "" : Number(empRule("defaultHourlyWage")), hoursMin: 60, hoursMax: 80,
                    urlaubDays: 20, noticePeriod: "4 Wochen zum 15. oder Monatsende", zusatzCheck: "", isStudent: null },
        contact: { phone: "", email: "", street: "", houseNo: "", zip: "", city: "",
                   emergency: "", language: "Deutsch", notifyBy: "Email" },
        ids: { steuernummer: "", rentenversicherung: "", iban: "", bic: "" },
        docs: {}, note: ""
      };
      document.querySelectorAll(".emp-page [data-emp-field]").forEach(input => {
        empSetPath(draft, input.dataset.empField, empFieldValue(input));
      });
      if (empRule("defaultHourlyWage") === "" && Number(draft.contract.rate) === 0) draft.contract.rate = "";
      draft.name = [draft.firstName, draft.lastName].map(value => String(value || "").trim()).filter(Boolean).join(" ");
      draft.probationEnd = draft.entryDate ? empProbationDefaultEndAt(draft.entryDate, empRule("probationMonths")) : null;

      if (!draft.name) { empFlash(button, empT("请先填写名和姓", "Bitte Vor- und Nachnamen eingeben")); return; }
      if (!String(draft.store || "").trim()) { empFlash(button, empT("请选择门店", "Bitte Filiale wählen")); return; }
      if (!String(draft.entryDate || "").trim()) { empFlash(button, empT("请先填入职日期", "Bitte Eintrittsdatum eingeben")); return; }
      const email = String(draft.contact.email || "").trim();
      if (sendNow && !empCan("invite")) { empFlash(button, empDenyReason("invite")); return; }
      if (sendNow && !email) {
        empFlash(button, empT("没有邮箱不能发邀请；可以先点“只建档”，补上邮箱后再发（HR-ACCESS-31）。", "Ohne E-Mail keine Einladung — zuerst „Nur Akte anlegen“."));
        return;
      }
      if (email) {
        const conflict = empInviteEmailConflict(email, draft.id);
        if (conflict) { empFlash(button, conflict.message); return; }
      }
      const companyFilled = !!document.querySelector(".emp-company-filled-box")?.checked;
      const personal=empRead('kaispanNewEmployeeDraftV1',{profile:{},docs:{}});
      personal.name=draft.name;personal.email=email;personal.profile={country:"Deutschland",language:"Deutsch",...personal.profile,first:draft.firstName,last:draft.lastName};
      draft.invite = {
        portalVersion: 2, onboardingFilesVersion: 1, token: empToken(), state: "draft",
        createdAt: empNow(), reminders: [], returnNote: "", returnItems: [], submitted: {},
        fillMode: companyFilled ? "company" : "self",
        employerEntered: true, employerCompleted: companyFilled, employerEnteredAt: empNow(),
        sendResult: "none", resendLog: []
      };
      /* 重聘：沿用旧档案的员工编号，新旧档案互相可查；账号由老板重新开通（HR-LIFE-32） */
      const rehire = draft.rehireOf ? empById(draft.rehireOf) : null;
      if (rehire) {
        draft.employeeNo = rehire.employeeNo || "";
        draft.rehireFromStore = rehire.store;
      } else {
        delete draft.rehireOf;
      }
      empSaveStaff(draft);
      if (rehire) {
        const old = empById(rehire.id);
        old.rehiredBy = draft.id;
        old.rehiredAt = empNow();
        empSaveStaff(old);
      }
      personal.employeeId=draft.id;euSyncEmployee(personal);
      const created=empById(draft.id);
      Object.values(created.docs||{}).forEach(doc=>{doc.by='company';doc.needsReview=false;});
      /* 公司侧原始值留一份：员工确认后要能指出“个人信息以员工为准、合同条件以公司为准”（HR-ONB-10）。 */
      created.invite.companyBaseline = {
        personal: {
          name: created.name, birthday: created.birthday || "",
          contact: { ...(created.contact || {}) }, ids: { ...(created.ids || {}) },
          nationality: empNationalityClass(created),
          student: empStudentAnswered(created) ? (empStudentValue(created) ? "yes" : "no") : ""
        },
        contract: {
          role: created.role, type: created.contract?.type, rate: created.contract?.rate,
          hoursMin: created.contract?.hoursMin, hoursMax: created.contract?.hoursMax,
          urlaubDays: created.contract?.urlaubDays, noticePeriod: created.contract?.noticePeriod
        }
      };
      empSaveStaff(created);
      if (sendNow) empSendInvite(draft.id);
      empWrite('kaispanNewEmployeeDraftV1',{profile:{},docs:{}});
      location.hash = `${slug("employee", "邀请详情")}?id=${encodeURIComponent(draft.id)}`;
    });
  });

  /* --- 邀请：发送 / 重发（=催一下）/ 撤销 / 重新邀请 / 取消入职 --- */
  document.querySelectorAll(".emp-send-invite").forEach(button => {
    button.addEventListener("click", () => {
      const res = empSendInvite(button.dataset.id);
      if (!res.ok) { empFlash(button, res.message || empT("发送失败", "Versand fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-resend-invite").forEach(button => {
    button.addEventListener("click", () => {
      const res = empResendInvite(button.dataset.id);
      if (!res.ok) { empFlash(button, res.message || empT("重发失败", "Erneut senden fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-invite-email-save").forEach(button => {
    button.addEventListener("click", () => {
      const email = button.closest(".emp-link-row")?.querySelector(".emp-invite-email")?.value || "";
      const res = empSetInviteEmail(button.dataset.id, email);
      if (!res.ok) { empFlash(button, res.message || empT("保存失败", "Speichern fehlgeschlagen")); return; }
      app();
    });
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
      const reason = button.closest(".emp-revoke-confirm")?.querySelector(".emp-revoke-reason")?.value || "";
      const res = empRevokeInvite(button.dataset.id, reason);
      if (!res.ok) { empFlash(button, res.message || empT("撤销失败", "Zurückziehen fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-reinvite-open").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector(`.emp-reinvite-box[data-id="${button.dataset.id}"]`)?.classList.remove("is-hidden");
    });
  });
  document.querySelectorAll(".emp-reinvite-cancel").forEach(button => {
    button.addEventListener("click", () => button.closest(".emp-reinvite-box")?.classList.add("is-hidden"));
  });
  document.querySelectorAll(".emp-reinvite-yes").forEach(button => {
    button.addEventListener("click", () => {
      const email = button.closest(".emp-reinvite-box")?.querySelector(".emp-reinvite-email")?.value || "";
      const res = empReinvite(button.dataset.id, email);
      if (!res.ok) { empFlash(button, res.message || empT("重新邀请失败", "Erneut einladen fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-cancel-open").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelector(`.emp-cancel-confirm[data-id="${button.dataset.id}"]`)?.classList.remove("is-hidden");
    });
  });
  document.querySelectorAll(".emp-cancel-close").forEach(button => {
    button.addEventListener("click", () => button.closest(".emp-cancel-confirm")?.classList.add("is-hidden"));
  });
  document.querySelectorAll(".emp-cancel-yes").forEach(button => {
    button.addEventListener("click", () => {
      const reason = button.closest(".emp-cancel-confirm")?.querySelector(".emp-cancel-reason")?.value || "";
      const res = empCancelOnboarding(button.dataset.id, reason);
      if (!res.ok) { empFlash(button, res.message || empT("取消失败", "Absage fehlgeschlagen")); return; }
      app();
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
      const res = empApproveInvite(button.dataset.id, opts);
      if (!res.ok) { empFlash(button, res.message || empT("审核失败", "Freigabe fehlgeschlagen")); return; }
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
      const items = [...(button.closest(".emp-approve")?.querySelectorAll(".emp-return-item:checked") || [])].map(x => x.dataset.item);
      const res = empReturnInvite(button.dataset.id, note.value.trim(), items);
      if (!res.ok) { empFlash(button, res.message || empT("退回失败", "Rückgabe fehlgeschlagen")); return; }
      app();
    });
  });

  /* --- 员工自填页 --- */
  const onboard = document.querySelector(".emp-onboard");
  if (onboard) {
    const token = onboard.dataset.token;
    const topup = onboard.classList.contains("emp-topup");
    const readSub = () => {
      const e = empByToken(token);
      return topup ? (e?.request?.submitted || {}) : empInviteDraftData(e?.invite || {});
    };
    const writeDraft = patch => (topup ? empSaveInviteDraftTopup(token, patch) : empSaveInviteDraft(token, patch));
    const progress = () => { const e = empByToken(token); return topup ? empRequestProgress(e) : empInviteFillProgress(e); };
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
      if (!pr.complete && topup) {
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
  /* 自定义期限规则作为本地说明保存，不改变现有自动提醒。 */
  document.querySelectorAll(".emp-rule-add").forEach(button => button.addEventListener("click", () => {
    const list = document.querySelector(".emp-custom-rule-list");
    const row = document.createElement("div");
    row.className = "emp-custom-rule";
    row.innerHTML = `<label>规则名称<input class="emp-custom-rule-name" placeholder="例如：签证到期前提醒"></label><label>规则说明<textarea class="emp-custom-rule-description" rows="2" placeholder="填写触发条件、提醒对象和处理方式"></textarea></label><button type="button" class="ghost-btn emp-custom-rule-remove">删除</button>`;
    list.appendChild(row);
    row.querySelector("input").focus();
  }));
  document.querySelectorAll(".emp-custom-rule-list").forEach(list => list.addEventListener("click", event => {
    const button = event.target.closest(".emp-custom-rule-remove");
    if (button) button.closest(".emp-custom-rule").remove();
  }));
  document.querySelectorAll(".emp-rules-save").forEach(button => {
    button.addEventListener("click", () => {
      if (!empCan("ownerOnly") && !empCan("docWarn")) { empFlash(button, empDenyReason("docWarn")); return; }
      const ownerSave = empCan("ownerOnly");
      const customRuleList = document.querySelector(".emp-custom-rule-list");
      if (ownerSave && customRuleList) empWrite("kaispan-employee-custom-deadline-rules", Array.from(customRuleList.querySelectorAll(".emp-custom-rule")).map(row => ({ name: row.querySelector(".emp-custom-rule-name").value.trim(), description: row.querySelector(".emp-custom-rule-description").value.trim() })).filter(rule => rule.name || rule.description));
      const values = [];
      for (const input of document.querySelectorAll("[data-rule]")) {
        if (!ownerSave && !EMP_DOC_WARN_RULES.includes(input.dataset.rule)) continue;
        const checked = empRuleInputValid(input.dataset.rule, input.value);
        if (!checked.ok) {
          empFlash(input.closest(".emp-rule") || button, checked.message || empT("参数不合法", "Ungültiger Wert"));
          input.focus();
          return;
        }
        values.push([input.dataset.rule, checked.value]);
      }
      for (const input of ownerSave ? document.querySelectorAll('[data-employer="betriebsnummer"]') : []) {
        const value = input.value.trim();
        if (value && !/^\d{8}$/.test(value)) {
          empFlash(input.closest(".emp-employer-store") || button, empT("Betriebsnummer 必须是 8 位数字", "Betriebsnummer muss 8 Ziffern haben"));
          input.focus();
          return;
        }
      }
      const ruleMap = new Map(values);
      const num = id => Number(ruleMap.has(id) ? ruleMap.get(id) : empRule(id));
      if (ruleMap.has("docSoonDays") && ruleMap.has("docWarnDays") && num("docSoonDays") <= num("docWarnDays")) {
        empFlash(button, empT("关注期天数必须大于提醒天数", "Beobachtungszeit muss größer als die Vorwarnzeit sein"));
        return;
      }
      if (ruleMap.has("residenceWarnDays") && ruleMap.has("docSoonDays") && num("residenceWarnDays") >= num("docSoonDays")) {
        empFlash(button, empT("居留许可预警期必须小于关注期", "Aufenthaltstitel-Vorwarnzeit muss kleiner als die Beobachtungszeit sein"));
        return;
      }
      values.forEach(([id, value]) => empSetRule(id, value));
      if (ownerSave) {
        document.querySelectorAll("[data-employer]").forEach(input => {
          empSetEmployer(input.dataset.store, input.dataset.employer, input.value.trim());
        });
      }
      app();
    });
  });
  document.querySelectorAll(".emp-rules-reset").forEach(button => {
    button.addEventListener("click", () => {
      if (!empCan("ownerOnly")) { empFlash(button, empDenyReason("ownerOnly")); return; }
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
  /* 入职停滞四类也进待办，标题只写姓名和事项类别（HR-ONB-47、HR-TODO-05）。 */
  const stalls = empOnboardingStalls(empScope()).map(s => ({
    type: "入职流程停滞",
    title: `${s.name}：入职流程停滞`,
    module: "员工助手", store: s.store,
    due: "已超过提醒天数", risk: "普通", status: "未处理",
    href: `#${slug("employee", "邀请详情")}?id=${encodeURIComponent(s.id)}`
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
        : a.level === "date_missing" ? `${a.employee.name} 的${a.title}有效期待补充`
        : `${a.employee.name} 的${a.title} ${a.days < 0 ? `已过期 ${-a.days} 天` : `还有 ${a.days} 天`}`,
    module: "员工助手", store: a.employee.store,
    due: a.level === "expired" ? "已逾期" : a.level === "missing" ? "尽快处理" : "本月到期",
    risk: a.kind === "profile" ? "普通" : "高风险", status: "未处理",
    href: empStaffHref(a.employee.id)
  }));
  /* 流程类待办（保存期、店长提案、特殊审批）也要进首页；
     它们不属于“证件到期”，但都是老板/店长真正要动手的事（HR-TODO-20～39）。 */
  const flowMeta = {
    retention: { type: "离职资料保存期到期", risk: "普通", due: "尽快处理" },
    managerChange: { type: "店长变更待老板确认", risk: "高风险", due: "尽快处理" },
    specialPending: { type: "特殊审批待批（材料没交齐）", risk: "普通", due: "尽快处理" }
  };
  const flow = [];
  empRosterVisible(empScope()).forEach(emp => {
    empWorkflowEntries(emp).forEach(item => {
      const meta = flowMeta[item.key];
      if (!meta) return;
      const type = item.key === "managerChange"
        ? (emp.contractProposal?.state === "pending" ? "店长合同提案待老板确认" : "离职办理待老板确认")
        : meta.type;
      flow.push({
        type,
        title: `${emp.name}：${type}`,
        module: "员工助手", store: emp.store,
        due: meta.due, risk: meta.risk, status: "未处理",
        href: empStaffHref(emp.id)
      });
    });
  });
  return [...review, ...stalls, ...docs, ...flow];
}

function empContractOverview(e){const c=e.contract;return `<section class="card"><div class="section-title"><div><h2>合同摘要</h2><p>提取已签合同的重要条款；所有数值按本人合同填写，原文与摘要有差异时请核对原文。</p></div>${e.docs.contract?.file?empFileLink(e.docs.contract):'<span class="pill orange">合同原件待上传</span>'}</div><div class="emp-contract-overview"><div><small>薪酬约定</small><strong>€${Number(c.rate||0).toFixed(2)} / ${c.payType==='pauschal'?'月 · 固定 Brutto':'小时 · Brutto'}</strong></div><div><small>Workload · 工时</small><strong>${c.weeklyHours?c.weeklyHours+' h/周 · ':''}${c.hoursMin??'—'}–${c.hoursMax??'—'} h/月</strong></div><div><small>合同期限</small><strong>${empEsc(e.entryDate||'未填写')} → ${empEsc(c.befristetUntil||'不定期')}</strong></div><div><small>年假 / 通知期</small><strong>${c.urlaubDays??'—'} 天 / ${empEsc(c.noticePeriod||'未填写')}</strong></div></div><p class="small">周工时与月工时范围分别保留合同口径，不自动互相覆盖。补贴、发薪时间及加班安排在下方单列。参考 <a href="https://www.gesetze-im-internet.de/nachwg/__2.html" target="_blank" rel="noopener">NachwG §2</a> 的条款分类。</p></section>`;}

function empNewPersonalEditor(){
 const d=empRead('kaispanNewEmployeeDraftV1',{profile:{},docs:{}});d.docs=d.docs||{};
 let form=euProfileForm(d).replace(/<section class="eu-invitation-downloads">[\s\S]*?<\/section>/,'').replace(/<h3>基本信息<\/h3>[\s\S]*?<label><span>邮箱（邀请已登记）[\s\S]*?<\/label>/,'<h3>基本信息</h3><p class="small">名、姓和邮箱使用左侧公司资料。</p>');
 return form+'<h3>证件与文件</h3>'+euDocumentIdentity(d)+euDocumentList(d).filter(t=>!t.inline).map(t=>`<div class="eu-doc"><div><strong>${t.label}${t.required?euRequiredStar():''}</strong><small>${empEsc(d.docs[t.key]?.name||'待上传')}</small>${euDocExpiryFields(d,t)}</div><label class="ghost-btn eu-upload">${d.docs[t.key]?'替换':'上传'}<input type="file" data-doc="${t.key}" accept="application/pdf,image/*" hidden></label>${d.docs[t.key]?`<button type="button" class="eu-delete" data-doc="${t.key}">移除</button>`:''}</div>`).join('');
}
function empBindNewPersonal(){
 const host=document.querySelector('.emp-new-personal');if(!host)return;if(typeof euBindIdentityHints==='function')euBindIdentityHints(host);
 const save=input=>{const d=empRead('kaispanNewEmployeeDraftV1',{profile:{},docs:{}});d.profile={...d.profile,[input.dataset.profile]:input.value};empWrite('kaispanNewEmployeeDraftV1',d);};
 host.querySelectorAll('[data-profile]').forEach(input=>input.addEventListener('input',()=>save(input)));
 host.querySelectorAll('.eu-eligibility').forEach(input=>input.addEventListener('change',()=>{save(input);host.innerHTML=empNewPersonalEditor();empBindNewPersonal();}));
 host.querySelectorAll('.eu-upload input').forEach(input=>input.addEventListener('change',async()=>{const f=input.files[0];if(!f)return;if(f.size>2*1024*1024){empFlash(input.parentElement,'请选择 2 MB 内的文件');return;}if(['bankFront','bankBack','healthFront','healthBack'].includes(input.dataset.doc)&&!f.type.startsWith('image/')){empFlash(input.parentElement,'请选择照片文件');return;}const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f);});const d=empRead('kaispanNewEmployeeDraftV1',{profile:{},docs:{}});d.docs[input.dataset.doc]={name:f.name,data,at:empNow()};d.profile={...d.profile,[input.dataset.doc+'Expiry']:'',[input.dataset.doc+'HasExpiry']:''};empWrite('kaispanNewEmployeeDraftV1',d);host.innerHTML=empNewPersonalEditor();empBindNewPersonal();}));
 host.querySelectorAll('.eu-delete').forEach(b=>b.onclick=()=>{const d=empRead('kaispanNewEmployeeDraftV1',{profile:{},docs:{}});d.docHistory=[{key:b.dataset.doc,file:d.docs[b.dataset.doc],at:empNow()},...(d.docHistory||[])];delete d.docs[b.dataset.doc];empWrite('kaispanNewEmployeeDraftV1',d);host.innerHTML=empNewPersonalEditor();empBindNewPersonal();});
}

function empValidExpiry(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const date=new Date(value+'T12:00:00Z');return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;}


function empIdentityInput(label,path,value,kind){const n=empNeedMark(path,value);return `<div class="field${n.cls}" data-need-path="${empEsc(path)}"><label>${label}${n.mark}</label><input type="text" data-emp-field="${path}" data-id-kind="${kind}" inputmode="${kind==='steuerId'?'numeric':'text'}" value="${empEsc(value||'')}"><small>${kind==='steuerId'?'11 位数字，可带空格。':'共 12 位：前 8 位数字、第 9 位字母、最后 3 位数字。'}</small><small class="eu-id-error" role="status"></small>${n.why}</div>`;}

/* 合同与问卷：上传发出件、发送、逐份核对、作废、线下签署（HR-ONB-36～38/53）。
   字段写法与员工端 employee-ui.js 约定一致。 */
function empBindContractDispatch() {
  document.querySelectorAll(".emp-dispatch-use-default").forEach(button => {
    button.addEventListener("click", () => {
      const e = empById(button.dataset.id);
      const template = empQuestionnaireTemplate();
      const file = template.file;
      if (!e?.invite || !file) return;
      const next = JSON.parse(JSON.stringify(e));
      next.invite.questionnaireTemplate = { ...file, at: empNow(), by: empActorLabel(), fromDefault: true, versionId: template.versionId || "" };
      next.invite.questionnaireVersionId = template.versionId || "";
      next.invite.questionnaireSource = "default";
      empSaveStaff(next);
      app();
    });
  });
  document.querySelectorAll(".emp-dispatch-upload").forEach(input => {
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const error = empUploadError(file, false);
      if (error) { empFlash(input.parentElement, error); input.value = ""; return; }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const e = empById(input.dataset.id);
      if (!e) return;
      const next = JSON.parse(JSON.stringify(e));
      next.invite = next.invite || {};
      const rec = { name: file.name, dataUrl, at: empNow(), by: empActorLabel() };
      const key = input.dataset.key;
      if (key === "contract") next.invite.contractTemplate = rec;
      else if (key === "questionnaire") {
        next.invite.questionnaireTemplate = rec;
        next.invite.questionnaireVersionId = "";
        next.invite.questionnaireSource = "uploaded";
      }
      else if (key === "offlineContract") next.invite.offlineContractFile = rec;
      else if (key === "offlineQuestionnaire") next.invite.offlineQuestionnaireFile = rec;
      empSaveStaff(next);
      app();
    });
  });
  document.querySelector(".emp-dispatch-send")?.addEventListener("click", event => {
    const result = empSendContractDispatch(event.currentTarget.dataset.id);
    if (!result.ok) { empFlash(event.currentTarget, result.message || empT("发送失败", "Versand fehlgeschlagen")); return; }
    app();
  });
  document.querySelectorAll(".emp-dispatch-approve").forEach(button => {
    button.addEventListener("click", () => {
      const result = empReviewContractAsset(button.dataset.id, button.dataset.key, "approved", "");
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelectorAll(".emp-dispatch-return").forEach(button => {
    button.addEventListener("click", () => {
      const reason = button.closest(".emp-dispatch-review")?.querySelector(".emp-dispatch-reason")?.value || "";
      const result = empReviewContractAsset(button.dataset.id, button.dataset.key, "returned", reason);
      if (!result.ok) { empFlash(button, result.message || empT("操作失败", "Aktion fehlgeschlagen")); return; }
      app();
    });
  });
  document.querySelector(".emp-dispatch-void-btn")?.addEventListener("click", event => {
    const reason = event.currentTarget.closest(".emp-dispatch-void")?.querySelector(".emp-dispatch-void-reason")?.value || "";
    const result = empVoidContractDispatch(event.currentTarget.dataset.id, reason);
    if (!result.ok) { empFlash(event.currentTarget, result.message || empT("作废失败", "Stornierung fehlgeschlagen")); return; }
    app();
  });
  document.querySelector(".emp-dispatch-offline-btn")?.addEventListener("click", event => {
    const e = empById(event.currentTarget.dataset.id);
    if (!e) return;
    const result = empOfflineContractArchive(e.id, e.invite?.offlineContractFile, e.invite?.offlineQuestionnaireFile);
    if (!result.ok) { empFlash(event.currentTarget, result.message || empT("归档失败", "Ablage fehlgeschlagen")); return; }
    app();
  });
}
