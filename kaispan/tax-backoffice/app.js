const kaiImg = "assets/ai 女秘书形象，形象要全部统一.png";
const kaiDashboardImg = "assets/kai-dashboard-cutout-flipped.png";

const stores = ["Martin Biergarten", "Martin Cafe", "Martin Biergarten 2"];
const suppliers = ["Metro Deutschland", "Transgourmet Deutschland", "JFC Deutschland", "CHEFS CULINAR", "FrischeParadies"];
const employees = ["Martin", "Tom", "Lisa", "Anna", "Kevin"];
const LANGUAGE_KEY = "kaispanLanguage";

const nav = [
  { id: "dashboard", label: "首页", icon: "⌂" },
  { id: "todos", label: "待办事项", icon: "☑" },
  {
    id: "opening",
    label: "开店向导",
    icon: "✦",
    children: ["基础信息", "开店采购清单", "供应商搭建", "政府流程", "财务税务准备", "运营启动清单"]
  },
  {
    id: "warehouse",
    label: "仓库管理助手",
    icon: "▤",
    children: ["订单管理", "供应商管理", "运单 / 账单上传", "库存管理", "损耗记录"]
  },
  {
    id: "finance",
    label: "财务助手",
    icon: "€"
  },
  {
    id: "store",
    label: "门店助手",
    icon: "店"
  },
  {
    id: "employee",
    label: "员工助手",
    icon: "users",
    children: ["员工管理", "排班管理", "考勤与休假"]
  },
  {
    id: "business",
    label: "经营助手",
    icon: "↗",
    children: []
  },
  {
    id: "admin",
    label: "企业管理中心",
    icon: "企"
  }
];

const moduleCards = [
  { id: "warehouse", title: "仓库管理助手", sub: "采购、库存与供应商管理", todo: 2, icon: "▤", color: "purple" },
  { id: "finance", title: "财务助手", sub: "账单、付款与财务管理", todo: 1, icon: "€", color: "green" },
  { id: "store", title: "门店助手", sub: "门店运营与 HACCP", todo: 3, icon: "店", color: "blue" },
  { id: "employee", title: "员工助手", sub: "资料、请假与工资准备", todo: null, icon: "users", color: "blue" },
  { id: "business", title: "经营助手", sub: "数据分析与经营优化", todo: 1, icon: "↗", color: "orange" },
  { id: "admin", title: "企业管理中心", sub: "企业设置与信息管理", todo: null, icon: "企", color: "orange" }
];

const todos = [
  { type: "订货提醒", title: "Metro 明天要订货，截止日期 2024-05-21", module: "仓库管理助手", store: "Martin Biergarten", due: "明天过期", risk: "高风险", status: "未处理" },
  { type: "账单异常", title: "有一个账单和 Lieferschein 的数目对不起来，请审批", module: "财务助手", store: "Martin Biergarten", due: "2小时后过期", risk: "高风险", status: "待审批" },
  { type: "经营异常", title: "查看行业资讯，查看本地竞争对手本周 Google 评论变化以及与你的对比结果和分析", module: "经营助手", store: "Martin Biergarten", due: "3小时后过期", risk: "中风险", status: "未处理" },
  { type: "HACCP 未填写", title: "请注意今天及时填写 HACCP 表格", module: "门店助手", store: "Martin Biergarten", due: "5小时后过期", risk: "中风险", status: "未处理" },
  { type: "员工未打卡", title: "Kevin 今日未打卡，已超时 15 分钟", module: "门店助手", store: "Martin Biergarten", due: "今日到期", risk: "中风险", status: "未处理" },
  { type: "Google 差评", title: "Google 新增 1 条差评，等待回复", module: "门店助手", store: "Martin Cafe", due: "今日到期", risk: "普通", status: "待回复" },
  { type: "付款到期", title: "CHEFS CULINAR 账单将在 3 天内到期", module: "财务助手", store: "Martin Biergarten 2", due: "本周到期", risk: "普通", status: "未处理" },
  { type: "开店流程提醒", title: "向卫生局提交开业申请资料", module: "开店向导", store: "Martin Biergarten 2", due: "剩余10天", risk: "普通", status: "进行中" }
];

const taxClients = [
  { id: "martin", name: "Martin Biergarten", company: "Martin Gastro GmbH", owner: "Martin", month: "2026-06", stores: 3, completeness: 82, status: "需要处理", manager: "Lena", score: "B", datev: "未准备" },
  { id: "cafe", name: "Martin Cafe", company: "Cafe Martin UG", owner: "Martin", month: "2026-06", stores: 1, completeness: 94, status: "可交付", manager: "Jonas", score: "A", datev: "可导出" },
  { id: "ramen", name: "Kumo Ramen", company: "Kumo Kitchen GmbH", owner: "Chen", month: "2026-06", stores: 2, completeness: 63, status: "高风险", manager: "Lena", score: "C", datev: "未准备" },
  { id: "tapas", name: "Sol Tapas Bar", company: "Sol Dortmund GmbH", owner: "Sofia", month: "2026-06", stores: 1, completeness: 76, status: "等客户回复", manager: "Miriam", score: "B", datev: "未准备" }
];

const taxTasks = [
  { id: "task-1", clientId: "ramen", type: "高风险", title: "6 月缺少 8 天 Z-Bon，Kassenbericht 也不完整", source: "Kasse", due: "今天", status: "未处理" },
  { id: "task-2", clientId: "martin", type: "待审批", title: "Lisa Urlaub 天数和工资资料不一致，需要复核", source: "员工工资", due: "今天", status: "待审批" },
  { id: "task-3", clientId: "martin", type: "异常", title: "Metro 账单疑似重复，Kontierung 已标红", source: "账单", due: "明天", status: "未处理" },
  { id: "task-4", clientId: "tapas", type: "等客户回复", title: "现金存银行 DEP-0611 未匹配 Kontoauszug", source: "银行存钱", due: "本周", status: "已发给客户" },
  { id: "task-5", clientId: "cafe", type: "可交付", title: "6 月资料已齐，可生成 DATEV 准备包", source: "DATEV", due: "本周", status: "可处理" }
];

const taxIssues = [
  { clientId: "martin", level: "高", module: "账单", title: "Metro Rechnung INV-0611 疑似重复", detail: "两张账单金额、日期和 Lieferant 相同，建议抽查原始 PDF。", status: "未处理" },
  { clientId: "martin", level: "中", module: "工资", title: "Lisa Urlaub 已用天数和请假记录不一致", detail: "员工管理显示 3 天，本月工资资料显示 1 天。", status: "待审批" },
  { clientId: "martin", level: "中", module: "Kasse", title: "06-12 Kassenbestand 与 Z-Bon 差 €18.40", detail: "需要客户说明 Storno 或现金取出原因。", status: "未处理" },
  { clientId: "ramen", level: "高", module: "Z-Bon", title: "缺少 8 天 Z-Bon", detail: "06-03 至 06-10 未上传，需要发回客户补充。", status: "未处理" },
  { clientId: "tapas", level: "中", module: "Bank", title: "DEP-0611 未在 Kontoauszug 中匹配", detail: "等待客户上传银行入账证明。", status: "已发给客户" }
];

const taxEmployees = [
  { clientId: "martin", name: "Kevin", docStatus: "完整", role: "厨房", contract: "Vollzeit", hours: "152h", urlaub: "2天", sick: "0天", krankRefund: "否", wage: "€2,356.00", status: "完整" },
  { clientId: "martin", name: "Lisa", docStatus: "完整", role: "服务", contract: "Teilzeit", hours: "118h", urlaub: "3天", sick: "1天", krankRefund: "否", wage: "€1,675.60", status: "需复核" },
  { clientId: "martin", name: "Tom", docStatus: "完整", role: "厨房", contract: "Vollzeit", hours: "164h", urlaub: "0天", sick: "0天", krankRefund: "是", wage: "€2,706.00", status: "完整" },
  { clientId: "martin", name: "Anna", docStatus: "缺", role: "吧台", contract: "Minijob", hours: "42h", urlaub: "1天", sick: "0天", krankRefund: "否", wage: "€537.60", status: "需审批" },
  { clientId: "ramen", name: "Chen", docStatus: "完整", role: "店长", contract: "Vollzeit", hours: "168h", urlaub: "0天", sick: "0天", krankRefund: "否", wage: "€3,120.00", status: "完整" },
  { clientId: "ramen", name: "Mia", docStatus: "缺", role: "服务", contract: "Teilzeit", hours: "82h", urlaub: "0天", sick: "2天", krankRefund: "否", wage: "€1,082.40", status: "缺 Krankenkasse" }
];

const taxInvoices = [
  { clientId: "martin", supplier: "Metro Deutschland", no: "INV-0611", date: "2026-06-11", brutto: "€980.20", account: "3400 Wareneinkauf", cost: "100", status: "疑似重复", tone: "red" },
  { clientId: "martin", supplier: "CHEFS CULINAR", no: "CC-0609", date: "2026-06-09", brutto: "€1,245.60", account: "3400 Wareneinkauf", cost: "100", status: "Kontierung OK", tone: "green" },
  { clientId: "martin", supplier: "Uber Eats", no: "UE-0608", date: "2026-06-08", brutto: "€860.50", account: "8338 Provision", cost: "100", status: "抽查建议", tone: "orange" },
  { clientId: "martin", supplier: "DM", no: "DM-0605", date: "2026-06-05", brutto: "€42.10", account: "4930 Bürobedarf", cost: "100", status: "Kontierung OK", tone: "green" },
  { clientId: "ramen", supplier: "JFC Deutschland", no: "JFC-0607", date: "2026-06-07", brutto: "€486.20", account: "3400 Wareneinkauf", cost: "", status: "Kostenstelle fehlt", tone: "orange" }
];

const taxCashRows = [
  { clientId: "martin", date: "2026-06-12", zbon: "ZB-0612", abrechnung: "€2,560.00", kasse: "€1,240.00", bank: "€620.00", status: "差异 €18.40", tone: "red" },
  { clientId: "martin", date: "2026-06-11", zbon: "ZB-0611", abrechnung: "€2,410.00", kasse: "€1,080.00", bank: "€540.00", status: "已核对", tone: "green" },
  { clientId: "martin", date: "2026-06-10", zbon: "ZB-0610", abrechnung: "€2,840.00", kasse: "€1,390.00", bank: "€700.00", status: "已核对", tone: "green" },
  { clientId: "ramen", date: "2026-06-09", zbon: "缺失", abrechnung: "€1,960.00", kasse: "未提交", bank: "未提交", status: "缺资料", tone: "red" }
];

const taxAiSuggestions = [
  "帮我总结 Martin Biergarten 6 月还不能交付 DATEV 的原因",
  "把 Lisa 的 Urlaub 工资问题生成一条发给客户的消息",
  "列出本月最需要抽查的 5 张账单",
  "检查 Kassebericht、Z-Bon 和银行存钱是否一致"
];

const taxClientMatrix = [
  { clientId: "martin", period: "2026-06", readiness: 82, anomalies: 3, communication: "2 未读", unread: 2, employee: "有问题", employeeIssues: 2, invoice: "有问题", invoiceIssues: 1, income: "有问题", incomeIssues: 1, datev: "一键导出" },
  { clientId: "cafe", period: "2026-06", readiness: 94, anomalies: 1, communication: "已回复", unread: 0, employee: "正常", employeeIssues: 0, invoice: "正常", invoiceIssues: 0, income: "正常", incomeIssues: 0, datev: "已导出" },
  { clientId: "ramen", period: "2026-06", readiness: 63, anomalies: 8, communication: "4 未读", unread: 4, employee: "有问题", employeeIssues: 3, invoice: "有问题", invoiceIssues: 2, income: "有问题", incomeIssues: 3, datev: "未准备" },
  { clientId: "tapas", period: "2026-06", readiness: 76, anomalies: 4, communication: "等客户回复", unread: 1, employee: "正常", employeeIssues: 0, invoice: "有问题", invoiceIssues: 2, income: "有问题", incomeIssues: 2, datev: "未准备" },
  { clientId: "sushi", period: "2026-06", readiness: 88, anomalies: 2, communication: "1 未读", unread: 1, employee: "有问题", employeeIssues: 1, invoice: "正常", invoiceIssues: 0, income: "正常", incomeIssues: 0, datev: "一键导出", name: "Nori Sushi", company: "Nori Food UG", stores: 2, manager: "Jonas" },
  { clientId: "burger", period: "2026-06", readiness: 71, anomalies: 5, communication: "待沟通", unread: 0, employee: "有问题", employeeIssues: 2, invoice: "有问题", invoiceIssues: 3, income: "正常", incomeIssues: 0, datev: "未准备", name: "Burger Hafen", company: "Hafen Burger GmbH", stores: 1, manager: "Miriam" },
  { clientId: "pho", period: "2026-05", readiness: 97, anomalies: 0, communication: "无", unread: 0, employee: "正常", employeeIssues: 0, invoice: "正常", invoiceIssues: 0, income: "正常", incomeIssues: 0, datev: "已导出", name: "Pho Mitte", company: "Pho Mitte UG", stores: 1, manager: "Lena" }
];

const taxTodoQueue = [
  { id: "todo-zbon-ramen", clientId: "ramen", title: "Kumo Ramen 6 月缺少 8 天 Z-Bon 和 Kassenbericht", type: "缺资料", due: "今天", risk: "高", ai: "建议先发客户补资料清单，明确日期 06-03 至 06-10，并要求同时上传 Kassenbericht。", action: "生成补资料消息" },
  { id: "todo-employee-martin", clientId: "martin", title: "Martin Biergarten 员工 Lisa Urlaub 与工资资料不一致", type: "员工", due: "今天", risk: "中", ai: "建议先按员工管理里的 Urlaub 记录修正工资资料，再让客户确认 Lisa 本月实际 Urlaub 天数。", action: "生成员工确认消息" },
  { id: "todo-ja-tapas", clientId: "tapas", title: "Sol Tapas Bar Jahresabschluss 截止日期临近", type: "Jahresabschluss", due: "7 天内", risk: "高", ai: "建议检查上一年度固定资产、未结账单和银行余额，再发送客户补件提醒。", action: "创建 Abschluss 清单" },
  { id: "todo-ust-cafe", clientId: "cafe", title: "Martin Cafe Umsatzsteuer-Voranmeldung 下周截止", type: "UStVA", due: "下周一", risk: "中", ai: "资料基本齐全，可先生成 UStVA 预检查，重点复核平台账单和现金收入。", action: "生成 UStVA 检查" },
  { id: "todo-krank-martin", clientId: "martin", title: "Tom 病假 Krankenkasse 还没有退款", type: "Krankenkasse", due: "本周", risk: "中", ai: "建议核对 eAU 日期、工资继续支付天数和 Krankenkasse 退款申请状态。", action: "生成 Krankenkasse 跟进" },
  { id: "todo-kontierung-burger", clientId: "burger", title: "Burger Hafen 6 月 CHEFS CULINAR Kontierung 需人工确认", type: "Kontierung", due: "今天", risk: "中", ai: "建议点开账单抽查，确认饮料和食材是否拆分到正确 Sachkonto。", action: "打开 Kontierung 抽查" },
  { id: "todo-konto-tapas", clientId: "tapas", title: "Sol Tapas 缺账单，Kontoauszug 对不上", type: "Kontoauszug", due: "今天", risk: "高", ai: "建议列出 Kontoauszug 中未匹配交易，发给客户要求上传对应 Rechnung 或现金说明。", action: "生成缺账单列表" },
  { id: "todo-material-ramen", clientId: "ramen", title: "Kumo Ramen 员工 Mia 仍缺 Krankenkasse 材料", type: "员工材料", due: "3 天内", risk: "中", ai: "建议发送员工资料补充请求，并把缺失字段同步到工资准备状态。", action: "发送材料提醒" },
  { id: "todo-datev-sushi", clientId: "sushi", title: "Nori Sushi 6 月可导出 DATEV，但建议先抽查 2 张平台账单", type: "DATEV", due: "本周", risk: "低", ai: "建议抽查 Lieferando 和 Uber Eats 平台账单后直接生成 DATEV Export Package。", action: "抽查并导出" }
];

const taxTodoGerman = {
  "todo-zbon-ramen": {
    title: "Kumo Ramen: 8 Tage Z-Bon und Kassenbericht im Juni fehlen",
    type: "Unterlagen fehlen",
    ai: "Zuerst eine Nachforderung an den Mandanten senden, den Zeitraum 03.06. bis 10.06. klar benennen und den Kassenbericht mit anfordern."
  },
  "todo-employee-martin": {
    title: "Martin Biergarten: Urlaub von Lisa stimmt nicht mit den Lohndaten überein",
    type: "Mitarbeiter",
    ai: "Zuerst den Urlaubseintrag in der Mitarbeiterverwaltung mit den Lohndaten abgleichen und anschließend die tatsächlichen Urlaubstage von Lisa bestätigen lassen."
  },
  "todo-ja-tapas": {
    title: "Sol Tapas Bar: Frist für den Jahresabschluss rückt näher",
    type: "Jahresabschluss",
    ai: "Anlagevermögen des Vorjahres, offene Belege und Bankbestände prüfen und anschließend eine Nachforderung an den Mandanten senden."
  },
  "todo-ust-cafe": {
    title: "Martin Cafe: Umsatzsteuer-Voranmeldung nächste Woche fällig",
    type: "UStVA",
    ai: "Die Unterlagen sind weitgehend vollständig. Eine UStVA-Vorprüfung erstellen und Plattformabrechnungen sowie Bareinnahmen gezielt prüfen."
  },
  "todo-krank-martin": {
    title: "Tom: Krankenkassen-Erstattung ist noch offen",
    type: "Krankenkasse",
    ai: "eAU-Daten, Entgeltfortzahlungstage und den Status der Krankenkassen-Erstattung prüfen."
  },
  "todo-kontierung-burger": {
    title: "Burger Hafen: CHEFS CULINAR Kontierung für Juni manuell bestätigen",
    type: "Kontierung",
    ai: "Belege stichprobenartig öffnen und prüfen, ob Getränke und Lebensmittel den richtigen Sachkonten zugeordnet sind."
  },
  "todo-konto-tapas": {
    title: "Sol Tapas: Belege fehlen, Kontoauszug stimmt nicht überein",
    type: "Kontoauszug",
    ai: "Nicht zugeordnete Transaktionen aus dem Kontoauszug auflisten und den Mandanten um Rechnungen oder eine Erklärung zu Bareinnahmen bitten."
  },
  "todo-material-ramen": {
    title: "Kumo Ramen: Krankenkassen-Unterlagen für Mia fehlen weiterhin",
    type: "Mitarbeiterunterlagen",
    ai: "Eine Erinnerung zu den fehlenden Mitarbeiterunterlagen senden und die fehlenden Felder in der Lohnvorbereitung aktualisieren."
  },
  "todo-datev-sushi": {
    title: "Nori Sushi: DATEV-Export möglich, vorher 2 Plattformbelege prüfen",
    type: "DATEV",
    ai: "Lieferando- und Uber-Eats-Abrechnungen stichprobenartig prüfen und danach das DATEV-Exportpaket erstellen."
  }
};

function state() {
  const hash = location.hash.replace("#", "");
  const [routeRaw, queryRaw] = hash.split("?");
  const params = new URLSearchParams(queryRaw || "");
  return { route: routeRaw || "welcome", params };
}

function currentLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === "de" ? "de" : "zh";
  } catch (error) {
    return "zh";
  }
}

const deTranslations = {
  "欢迎使用 KaiSpan": "Willkommen bei KaiSpan",
  "让我们根据您的实际情况，为您生成最合适的业务系统。": "Wir erstellen anhand Ihrer Situation das passende Betriebssystem.",
  "您现在处于哪个阶段？": "In welcher Phase befinden Sie sich?",
  "我正在筹备新店": "Ich bereite eine neue Filiale vor",
  "我已经有正在运营的店面": "Ich betreibe bereits eine Filiale",
  "适用于准备开餐厅、加盟店、新品牌或新门店的客户。KaiSpan 将通过开店向导帮助您完成采购清单、供应商搭建、政府流程和财务准备。": "Für Kunden, die ein Restaurant, Franchise, eine neue Marke oder Filiale vorbereiten. KaiSpan begleitet Einkaufsliste, Lieferantenaufbau, Behördenprozesse und Finanzvorbereitung.",
  "适用于已经开业的餐厅、连锁店、门店或食品业务。KaiSpan 将帮助您管理采购、财务、门店和经营数据。": "Für bereits eröffnete Restaurants, Ketten, Filialen oder Food-Businesses. KaiSpan hilft bei Einkauf, Finanzen, Filialbetrieb und Geschäftsdaten.",
  "进入开店向导": "Zum Eröffnungsassistenten",
  "进入业务系统": "Zum Betriebssystem",
  "我会根据您的选择，为您生成不同的工作流程。": "Ich erstelle je nach Auswahl unterschiedliche Arbeitsabläufe.",
  "根据您的选择，为您生成不同的工作流程。": "Ich erstelle passende Abläufe basierend auf Ihrer Auswahl.",
  "Kai 提示：": "Kai Hinweis:",
  "首页": "Startseite",
  "待办事项": "Aufgaben",
  "开店向导": "Eröffnungsassistent",
  "基础信息": "Basisdaten",
  "开店采购清单": "Einkaufsliste Eröffnung",
  "供应商搭建": "Lieferanten einrichten",
  "政府流程": "Behördliche Prozesse",
  "财务税务准备": "Finanz- und Steuervorbereitung",
  "运营启动清单": "Betriebsstart-Checkliste",
  "仓库管理助手": "Lagerassistent",
  "订单管理": "Bestellungen",
  "供应商管理": "Lieferanten",
  "运单 / 账单上传": "Lieferschein / Rechnung hochladen",
  "库存管理": "Bestand",
  "损耗记录": "Verlustprotokoll",
  "财务助手": "Finanzassistent",
  "财务总览": "Finanzübersicht",
  "全面掌控财务状况，及时处理账单与付款，让现金流更健康。": "Behalten Sie Finanzen, Rechnungen und Zahlungen im Blick, damit der Cashflow gesund bleibt.",
  "财务待办事项": "Finanzaufgaben",
  "JFC 有一个账单与 Lieferschein 不匹配": "Eine JFC-Rechnung stimmt nicht mit dem Lieferschein überein",
  "Metro 有两个账单重复": "Zwei Metro-Rechnungen sind doppelt",
  "一个 Metro 账单截止 15.06 需付款": "Eine Metro-Rechnung ist bis 15.06 zu bezahlen",
  "有一个账单需要 Kontierung 确认一下": "Eine Rechnung benötigt eine Kontierungsprüfung",
  "对照 Kontoauszug 后，缺少两个账单，请尽快上传": "Beim Abgleich mit dem Kontoauszug fehlen zwei Rechnungen, bitte zeitnah hochladen",
  "外部账单上传中心": "Externer Rechnungs-Upload",
  "拖拽上传 PDF / JPG / PNG": "PDF / JPG / PNG hierher ziehen",
  "拖拽上传 PDF / JPG / PNG / Excel": "PDF / JPG / PNG / Excel hierher ziehen",
  "支持供应商账单、收据、外部平台账单": "Unterstützt Lieferantenrechnungen, Belege und Plattformabrechnungen",
  "已识别": "Erkannt",
  "识别中": "Wird erkannt",
  "待确认": "Zur Bestätigung",
  "金额待复核": "Betrag zu prüfen",
  "财务Aufgaben": "Finanzaufgaben",
  "拖拽Hochladen PDF / JPG / PNG": "PDF / JPG / PNG hierher ziehen",
  "拖拽Hochladen PDF / JPG / PNG / Excel": "PDF / JPG / PNG / Excel hierher ziehen",
  "待Bestätigen": "Zur Bestätigung",
  "Kontierung Bestätigen一下": "Kontierung prüfen",
  "请尽快Hochladen": "bitte zeitnah hochladen",
  "现金流概览": "Cashflow-Überblick",
  "采购总额": "Einkauf gesamt",
  "未付款": "Offene Zahlungen",
  "未来 7 天账户变化": "Kontoveränderung in 7 Tagen",
  "未来 15 天账户变化": "Kontoveränderung in 15 Tagen",
  "账单上传中心": "Rechnungs-Upload",
  "账单管理": "Rechnungen",
  "每日 Abrechnung": "Tägliche Abrechnung",
  "税务师": "Steuerberater",
  "3分钟匹配最适合您的税务师": "In 3 Minuten den passenden Steuerberater finden",
  "KaiSpan 为您连接餐饮行业专属税务师，自动准备所有财务资料，让您省心省力。": "KaiSpan verbindet Sie mit Steuerberatern für die Gastronomie und bereitet Ihre Finanzunterlagen automatisch vor.",
  "节省 80% 的沟通时间": "80% weniger Kommunikationsaufwand",
  "资料自动整理": "Unterlagen automatisch sortieren",
  "流程更高效": "Effizienterer Ablauf",
  "更专业的税务服务": "Professionellere Steuerberatung",
  "帮助您节省成本": "Kosten sparen",
  "一键匹配税务师&自动同步数据": "Steuerberater finden & Daten automatisch synchronisieren",
  "DATEV 导出": "DATEV-Export",
  "门店助手": "Filialassistent",
  "门店任务": "Filialaufgaben",
  "Google 评价": "Google Bewertungen",
  "外卖平台": "Lieferplattformen",
  "反馈记录": "Feedback",
  "多门店运营": "Multi-Filialbetrieb",
  "门店分析": "Filialanalyse",
  "AI 运营建议": "KI-Betriebsempfehlungen",
  "员工助手": "Mitarbeiterassistent",
  "员工管理": "Mitarbeiterverwaltung",
  "员工打卡": "Zeiterfassung",
  "排班管理": "Dienstplanung",
  "员工联络": "Mitarbeiterkontakte",
  "合同及工资资料": "Verträge und Lohndaten",
  "请假记录": "Urlaubsanträge",
  "经营助手": "Betriebsassistent",
  "月度报告": "Monatsbericht",
  "成本与利润": "Kosten und Gewinn",
  "商品分析": "Produktanalyse",
  "Google 评论分析": "Google Bewertungsanalyse",
  "行业资讯": "Branchennews",
  "营销推广": "Marketing",
  "AI 经营秘书": "KI-Betriebssekretär",
  "数据报告中心": "Daten- und Berichtszentrum",
  "企业管理中心": "Unternehmensverwaltung",
  "企业资料管理": "Unternehmensdaten",
  "门店管理": "Filialverwaltung",
  "员工与权限管理": "Mitarbeiter und Rechte",
  "系统连接": "Systemverbindungen",
  "审批流程设置": "Freigabeprozesse",
  "通知与提醒设置": "Benachrichtigungen",
  "通讯信息": "Kontaktdaten",
  "品牌与门店展示": "Marke und Filialauftritt",
  "套餐与账单": "Pakete und Abrechnung",
  "当前门店：": "Aktuelle Filiale:",
  "当前门店": "Aktuelle Filiale",
  "当前": "Aktuelle",
  "筹备项目：": "Projekt:",
  "Dortmund 新店": "Dortmund neue Filiale",
  "收起菜单": "Menü einklappen",
  "选择当前门店": "Aktuelle Filiale auswählen",
  "我的任务": "Meine Aufgaben",
  "个人中心": "Profil",
  "联系 Kai": "Kai kontaktieren",
  "帮助中心": "Hilfezentrum",
  "退出登录": "Abmelden",
  "您的智能秘书": "Ihr intelligenter Assistent",
  "您好 Martin，有什么我可以帮您的吗？": "Hallo Martin, wobei kann ich Ihnen helfen?",
  "请输入您的问题...": "Geben Sie Ihre Frage ein...",
  "有什么问题请问 Kai": "Fragen Sie Kai",
  "发送": "Senden",
  "查看其他供货商 Angebot": "Andere Lieferantenangebote ansehen",
  "你建议我可以再上哪些菜品，并帮我分析毛利率": "Welche Gerichte sollte ich ergänzen? Bitte analysiere auch die Marge",
  "我想找网红做推广，帮我询价": "Ich möchte Influencer-Marketing machen, bitte Angebote einholen",
  "对比附近的Steuerberater Angebot": "Steuerberater-Angebote in der Nähe vergleichen",
  "对比附近的 Steuerberater Angebot": "Steuerberater-Angebote in der Nähe vergleichen",
  "对比附近的税务师 Angebot": "Steuerberater-Angebote in der Nähe vergleichen",
  "哪些商品最近涨价最多？": "Welche Produkte sind zuletzt am stärksten teurer geworden?",
  "本月有哪些Filialaufgaben没完成？": "Welche Filialaufgaben sind diesen Monat offen?",
  "本月有哪些门店任务没完成？": "Welche Filialaufgaben sind diesen Monat offen?",
  "▣ 今天是 2025年5月24日，星期六": "▣ Heute ist Samstag, 24. Mai 2025",
  "您有": "Sie haben",
  "个待办事项需要处理": " Aufgaben zu bearbeiten",
  "您的智能秘书，可以直接帮您查经营、员工、账单和门店问题。": "Ihr intelligenter Assistent kann direkt Betrieb, Mitarbeiter, Rechnungen und Filialfragen prüfen.",
  "可以直接帮您查经营、员工、账单和Filiale问题。": "kann direkt Betrieb, Mitarbeiter, Rechnungen und Filialfragen prüfen.",
  "每日做账": "Tägliche Buchführung",
  "HACCP记录": "HACCP-Protokoll",
  "员工班表": "Mitarbeiter-Dienstplan",
  "单据上传": "Dokumente hochladen",
  "文件填写": "Dokumente ausfüllen",
  "任务管理": "Aufgabenverwaltung",
  "管理员工资料、请假、证件到期和每月工资资料，让餐饮人事流程更简单。": "Verwalten Sie Mitarbeiterdaten, Urlaub, Dokumentfristen und monatliche Lohndaten einfacher.",
  "轻量版员工管理": "Schlanke Mitarbeiterverwaltung",
  "在职员工": "Aktive Mitarbeiter",
  "待审批请假": "Urlaub zur Freigabe",
  "即将到期证件": "Dokumente laufen bald ab",
  "本月工资资料": "Lohndaten dieses Monats",
  "全职 12 / 兼职 10 / Minijob 6": "Vollzeit 12 / Teilzeit 10 / Minijob 6",
  "需要店长或负责人处理": "Filialleitung oder Verantwortliche müssen handeln",
  "30天内需要更新": "Innerhalb von 30 Tagen zu aktualisieren",
  "还有 2 家门店未提交": "Noch 2 Filialen nicht eingereicht",
  "未完成": "Offen",
  "完成": "Fertig",
  "待办事项": "Aufgaben",
  "查看全部": "Alle ansehen",
  "截止周三需审核排班": "Dienstplan bis Mittwoch prüfen",
  "本周班表等待店长确认，审核后可发送给员工。": "Der Wochenplan wartet auf Bestätigung und kann danach an Mitarbeiter gesendet werden.",
  "下周六人手不足，尽快审核": "Samstag nächste Woche unterbesetzt, bitte zeitnah prüfen",
  "晚班缺 2 名服务员，请尽快确认补班安排。": "In der Spätschicht fehlen 2 Servicekräfte, bitte Ersatz schnell bestätigen.",
  "Lisa 申请休假，请审批": "Lisa hat Urlaub beantragt, bitte freigeben",
  "06.18 - 06.20 Urlaub 申请等待处理。": "Urlaubsantrag 18.06 - 20.06 wartet auf Bearbeitung.",
  "去审批": "Zur Freigabe",
  "员工列表预览": "Mitarbeiterliste Vorschau",
  "查看全部": "Alle ansehen",
  "姓名": "Name",
  "门店": "Filiale",
  "岗位": "Position",
  "合同类型": "Vertragsart",
  "时薪": "Stundenlohn",
  "入职日期": "Eintrittsdatum",
  "状态": "Status",
  "证件状态": "Dokumentstatus",
  "操作": "Aktion",
  "厨师": "Koch",
  "服务员": "Servicekraft",
  "店长": "Filialleiter",
  "吧台": "Bar",
  "全职": "Vollzeit",
  "兼职": "Teilzeit",
  "在职": "Aktiv",
  "试用期": "Probezeit",
  "正常": "Normal",
  "30天到期": "Läuft in 30 Tagen ab",
  "缺少文件": "Dokument fehlt",
  "即将到期": "Läuft bald ab",
  "查看详情": "Details ansehen",
  "编辑": "Bearbeiten",
  "上传文件": "Datei hochladen",
  "标记离职": "Austritt markieren",
  "HACCP 管理": "HACCP-Verwaltung",
  "管理卫生检查、温度、入库、清洁、Belehrung、异常记录和卫生局检查资料。": "Verwalten Sie Hygienechecks, Temperaturen, Wareneingang, Reinigung, Belehrung, Abweichungen und Unterlagen für das Gesundheitsamt.",
  "新增 HACCP 记录": "Neuen HACCP-Eintrag",
  "今日待填项目": "Heute auszufüllen",
  "今日完成度": "Heutiger Fortschritt",
  "卫生局检查所需文件汇总": "Unterlagen für Gesundheitsamt",
  "异常记录": "Abweichungen",
  "点击查看": "Ansehen",
  "卫生检查表": "Hygienecheckliste",
  "害虫防治": "Schädlingsbekämpfung",
  "冰箱温度记录": "Kühlschrank-Temperaturprotokoll",
  "入库检查": "Wareneingangskontrolle",
  "清洁任务": "Reinigungsaufgaben",
  "Belehrung 到期提醒": "Belehrung-Fristen",
  "卫生异常记录": "Hygiene-Abweichungen",
  "卫生局检查资料": "Gesundheitsamt-Unterlagen",
  "总部卫生局总结反馈": "Zentrale Rückmeldung Gesundheitsamt",
  "记录害虫防治日期、合作公司和证明文件。": "Datum, Dienstleister und Nachweise zur Schädlingsbekämpfung erfassen.",
  "上传卫生局需要的检查资料、温度表和清洁记录。": "Erforderliche Prüfunterlagen, Temperaturtabellen und Reinigungsprotokolle hochladen.",
  "填写表单、上传照片或让店长确认。": "Formular ausfüllen, Foto hochladen oder durch Filialleitung bestätigen lassen.",
  "填写表单": "Formular ausfüllen",
  "上传证明": "Nachweis hochladen",
  "需处理": "Zu bearbeiten",
  "4类资料": "4 Unterlagen",
  "1项": "1 Eintrag",
  "1条": "1 Eintrag",
  "28 人": "28 Personen",
  "3 个": "3 Elemente",
  "5 个": "5 Elemente",
  "2 家门店": "2 Filialen",
  "今日": "Heute",
  "本周": "Diese Woche",
  "明天": "Morgen",
  "高风险": "Hohes Risiko",
  "中风险": "Mittleres Risiko",
  "普通": "Normal",
  "未处理": "Offen",
  "待审批": "Zur Freigabe",
  "已批准": "Genehmigt",
  "已拒绝": "Abgelehnt",
  "待回复": "Antwort ausstehend",
  "进行中": "In Bearbeitung",
  "处理": "Bearbeiten",
  "保存": "Speichern",
  "新增": "Neu",
  "上传": "Hochladen",
  "导出": "Exportieren",
  "确认": "Bestätigen",
  "取消": "Abbrechen",
  "待办队列": "Aufgabenliste",
  "税务师 backoffice 首页，优先处理高风险、临期、客户回复和可导出 DATEV 的事项。": "Steuerberater-Backoffice Startseite: priorisierte Bearbeitung von Hochrisiko-, Frist-, Kundenantwort- und DATEV-Aufgaben.",
  "客户总览": "Mandantenübersicht",
  "设置与规则": "Einstellungen und Regeln",
  "税务师客户总表": "Steuerberater-Mandantenübersicht",
  "检索客户，按月份查看 KaiSpan 准备度、异常、沟通、员工、账单、Einkommen 和 DATEV 状态。": "Mandanten suchen und pro Monat KaiSpan-Bereitschaft, Abweichungen, Kommunikation, Mitarbeiter, Belege, Einkommen und DATEV-Status prüfen.",
  "检索客户名、公司名、负责人": "Mandantenname, Firma oder Verantwortliche suchen",
  "全部": "Alle",
  "有异常": "Mit Abweichung",
  "可导出 DATEV": "DATEV exportbereit",
  "客户名": "Mandant",
  "月份": "Monat",
  "操作": "Aktion",
  "门店": "Filialen",
  "有问题": "Problem",
  "问题": "Problem",
  "已导出": "Exportiert",
  "一键导出": "Exportieren",
  "已逾期": "Überfällig",
  "7天内到期": "Fällig in 7 Tagen",
  "7天内": "7 Tage",
  "截止": "Frist",
  "待沟通": "Rückfrage offen",
  "无": "Keine",
  "负责人": "Verantwortliche",
  "沟通": "Kommunikation",
  "准备度": "Bereitschaft",
  "月度检查": "Monatsprüfung",
  "负责人": "Verantwortliche",
  "返回": "Zurück",
  "一键反馈问题": "Problem automatisch zurückmelden",
  "审批通过并准备 DATEV": "Freigeben und DATEV vorbereiten",
  "资料完整度": "Unterlagenvollständigkeit",
  "客户状态": "Mandantenstatus",
  "本月评分": "Bewertung diesen Monat",
  "待处理问题": "Offene Probleme",
  "总览": "Übersicht",
  "账单检查": "Belegprüfung",
  "收入": "Einnahmen",
  "对账": "Abstimmung",
  "工资单": "Lohnunterlagen",
  "财报": "Finanzbericht",
  "客户沟通": "Mandantenkommunikation",
  "员工月结问题": "Mitarbeiter-Monatsabschluss",
  "只显示本月需要税务师处理的员工材料、工资、Urlaub、病假、Krankenkasse 退款和 Arbeitszeitkonto。": "Zeigt nur Mitarbeiterunterlagen, Lohn, Urlaub, Krankheit, Krankenkassen-Erstattung und Arbeitszeitkonto, die diesen Monat durch die Kanzlei bearbeitet werden müssen.",
  "审批工资资料": "Lohnunterlagen freigeben",
  "员工": "Mitarbeiter",
  "材料": "Unterlagen",
  "工资": "Lohn",
  "病假": "Krankheit",
  "Krankenkasse退款": "Krankenkassen-Erstattung",
  "合同 / Steuer-ID / Krankenkasse 完整": "Vertrag / Steuer-ID / Krankenkasse vollständig",
  "缺 Steuer-ID 或 Krankenkasse": "Steuer-ID oder Krankenkasse fehlt",
  "天": "Tage",
  "否": "Nein",
  "是": "Ja",
  "查看": "Ansehen",
  "标记反馈": "Rückmeldung markieren",
  "当前月份没有员工问题。": "Für den aktuellen Monat gibt es keine Mitarbeiterprobleme.",
  "查看全部信息和编辑": "Alle Informationen ansehen und bearbeiten",
  "邀请客户": "Mandant einladen",
  "邀请朋友": "Freund einladen",
  "截止时间段": "Fristzeitraum",
  "全部时间": "Alle Zeiträume",
  "全部客户": "Alle Mandanten",
  "客户": "Mandant",
  "事项": "Aufgabe",
  "截止日期": "Frist",
  "今天到期": "Heute fällig",
  "待沟通客户": "Mandanten mit Rückfrage",
  "DATEV 可处理": "DATEV bearbeitbar",
  "高优先级": "Hohe Priorität",
  "个高优先级": "hohe Prioritäten",
  "AI 建议处理": "KI-Bearbeitungsvorschlag",
  "一键生成邮件": "E-Mail automatisch erstellen",
  "深度处理": "Tiefenbearbeitung",
  "自动生成邮件": "Automatisch erstellte E-Mail",
  "待发送": "Zum Versand bereit",
  "接收人": "Empfänger",
  "输入邮箱": "E-Mail eingeben",
  "添加": "Hinzufügen",
  "邮件主题": "E-Mail-Betreff",
  "邮件正文": "E-Mail-Text",
  "下次提醒日期": "Nächstes Erinnerungsdatum",
  "发送邮件": "E-Mail senden",
  "请补充": "Bitte ergänzen",
  "相关资料": "zugehörige Unterlagen",
  "您好": "Guten Tag",
  "请按日期范围补充缺失文件": "bitte ergänzen Sie die fehlenden Dateien für den genannten Zeitraum",
  "我们收到后会继续完成本月检查和 DATEV 准备。": "nach Eingang führen wir die Monatsprüfung und DATEV-Vorbereitung fort.",
  "高风险": "Hohes Risiko",
  "中风险": "Mittleres Risiko",
  "低风险": "Niedriges Risiko",
  "缺资料": "Unterlagen fehlen",
  "员工材料": "Mitarbeiterunterlagen",
  "客户基本信息": "Mandanten-Grunddaten",
  "发给客户填写": "Zum Ausfüllen an Mandant senden",
  "客户自助": "Mandant Self-Service",
  "保存客户档案": "Mandantenakte speichern",
  "返回首页": "Zur Startseite",
  "发送邀请邮件": "Einladungs-E-Mail senden",
  "生成 WhatsApp 文案": "WhatsApp-Text erstellen",
  "复制链接": "Link kopieren",
  "客户名称": "Mandantenname",
  "公司名称": "Firmenname",
  "联系人": "Kontaktperson",
  "电话": "Telefon",
  "门店数量": "Anzahl Filialen",
  "默认月份": "Standardmonat",
  "手动填写": "Manuell ausfüllen",
  "可交付": "Lieferbar",
  "可导出": "Exportbereit",
  "未准备": "Nicht bereit",
  "需要处理": "Zu bearbeiten",
  "等客户回复": "Warten auf Mandantenantwort",
  "已回复": "Geantwortet",
  "未读": "Ungelesen",
  "异常": "Abweichung",
  "账单": "Beleg",
  "工资": "Lohn",
  "银行存钱": "Bareinzahlung",
  "收入": "Einnahmen",
  "对账": "Abstimmung",
  "员工": "Mitarbeiter",
  "完整": "Vollständig",
  "缺": "Fehlt",
  "需复核": "Zu prüfen",
  "需审批": "Zur Freigabe",
  "已核对": "Geprüft",
  "差异": "Differenz",
  "疑似重复": "Vermutlich doppelt",
  "抽查建议": "Stichprobenempfehlung",
  "打开": "Öffnen",
  "保存设置": "Einstellungen speichern",
  "复制": "Kopieren",
  "已加入客户沟通的 Email 草稿。": "Zum E-Mail-Entwurf in der Mandantenkommunikation hinzugefügt.",
  "已模拟完成，并写入 Kanzlei 操作记录。": "simuliert abgeschlossen und im Kanzlei-Protokoll gespeichert.",
  "邮件草稿已生成，可继续编辑后发送。": "E-Mail-Entwurf wurde erstellt und kann vor dem Versand bearbeitet werden.",
  "返回": "Zurück"
};

function translateText(text) {
  if (!/[\u4e00-\u9fff]/.test(text)) return text;
  let output = text;
  Object.entries(deTranslations)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([source, target]) => {
      output = output.split(source).join(target);
    });
  return output;
}

function bilingualText(text) {
  if (!/[\u4e00-\u9fff]/.test(text)) return text;
  const leading = text.match(/^\s*/)?.[0] || "";
  const trailing = text.match(/\s*$/)?.[0] || "";
  const core = text.trim();
  if (!core || core.includes(" / ")) return text;
  const translated = translateText(core);
  if (!translated || translated === core) return text;
  return `${leading}${core} / ${translated}${trailing}`;
}

function applyLanguage() {
  const language = currentLanguage();
  document.documentElement.lang = language === "de" ? "de" : "zh-CN";
  const select = document.getElementById("languageSelect");
  if (select) select.value = language;
  if (language !== "de") return;
  const skipSelector = "[data-no-translate], .brand-title, .brand-subtitle, script, style, svg";
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (node.parentElement?.closest(skipSelector)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    node.nodeValue = translateText(node.nodeValue);
  });
  document.querySelectorAll("input, textarea").forEach(field => {
    if (field.placeholder) field.placeholder = translateText(field.placeholder);
  });
  document.querySelectorAll("[title], [aria-label]").forEach(el => {
    if (el.title) el.title = translateText(el.title);
    const aria = el.getAttribute("aria-label");
    if (aria) el.setAttribute("aria-label", translateText(aria));
  });
}

function setRoute(route) {
  location.hash = route;
}

function isOpeningRoute(route) {
  return route === "opening" || route.startsWith("opening-") || route === "opening-add-supplier";
}

function isTaxOfficeRoute(route) {
  return route === "tax-office" || route.startsWith("tax-office/");
}

function appMode(route) {
  if (isTaxOfficeRoute(route)) return "tax-office";
  const params = state().params;
  if (params.get("mode") === "opening") return "opening";
  if (isOpeningRoute(route)) return "opening";
  try {
    return localStorage.getItem("kaispanMode") === "opening" ? "opening" : "operating";
  } catch (error) {
    return "operating";
  }
}

function navForRoute(route) {
  const mode = appMode(route);
  if (isOpeningRoute(route)) return nav.filter(item => item.id === "opening");
  if (mode === "opening") return nav;
  return nav.filter(item => item.id !== "opening");
}

function app() {
  const { route, params } = state();
  if (isOpeningRoute(route) || params.get("mode") === "opening") {
    try {
      localStorage.setItem("kaispanMode", "opening");
    } catch (error) {
      // The route itself still keeps the opening guide menu visible.
    }
  }
  if (route === "welcome") {
    document.getElementById("app").innerHTML = welcomePage();
    bindWelcome();
    applyLanguage();
    return;
  }
  document.getElementById("app").innerHTML = shell(route, params);
  bindGlobal();
  applyLanguage();
}

function welcomePage() {
  const language = currentLanguage();
  return `
    <main class="welcome-wrap">
      <div class="welcome-language" data-no-translate>
        <select class="lang-select" id="languageSelect" aria-label="Language">
          <option value="zh" ${language === "zh" ? "selected" : ""}>◎ 中文</option>
          <option value="de" ${language === "de" ? "selected" : ""}>◎ Deutsch</option>
        </select>
      </div>
      <section class="welcome">
        <div class="welcome-head">
          <div class="brand" style="justify-content:center;margin-bottom:22px">
            <div class="logo-ring"></div>
            <div>
              <div class="brand-title">KaiSpan</div>
              <div class="brand-subtitle">AI Business Operating System</div>
            </div>
          </div>
          <h1>欢迎使用 KaiSpan</h1>
          <p style="font-size:18px;margin-top:12px">让我们根据您的实际情况，为您生成最合适的业务系统。</p>
          <h2 style="margin-top:28px">您现在处于哪个阶段？</h2>
        </div>
        <div class="grid grid-2">
          <article class="card choice-card recommended">
            <div>
              <div class="iconbox blue">✦</div>
              <h2>我正在筹备新店</h2>
              <p>适用于准备开餐厅、加盟店、新品牌或新门店的客户。KaiSpan 将通过开店向导帮助您完成采购清单、供应商搭建、政府流程和财务准备。</p>
            </div>
            <a class="primary-btn" href="#opening" data-go="opening">进入开店向导 →</a>
          </article>
          <article class="card choice-card">
            <div>
              <div class="iconbox purple">店</div>
              <h2>我已经有正在运营的店面</h2>
              <p>适用于已经开业的餐厅、连锁店、门店或食品业务。KaiSpan 将帮助您管理采购、财务、门店和经营数据。</p>
            </div>
            <a class="primary-btn" href="#dashboard" data-go="dashboard">进入业务系统 →</a>
          </article>
        </div>
        <div class="card" style="margin-top:22px;display:flex;align-items:center;gap:14px">
          <img class="kai-mini" src="${kaiImg}" alt="Kai" />
          <p><strong style="color:var(--ink)">Kai 提示：</strong>我会根据您的选择，为您生成不同的工作流程。</p>
        </div>
      </section>
    </main>`;
}

function shell(route, params) {
  const taxOffice = isTaxOfficeRoute(route);
  return `
    <div class="app-shell">
      ${topbar(params)}
      <div class="layout ${taxOffice ? "tax-office-layout" : ""}">
        ${sidebar(route)}
        <main class="main">${page(route)}</main>
      </div>
      ${userDropdown(params)}
      ${taxOffice ? "" : storeDropdown(params)}
      ${taxOffice ? "" : kaiWidget(params)}
    </div>`;
}

function topbar(params) {
  const { route } = state();
  if (isTaxOfficeRoute(route)) return taxOfficeTopbar();
  const openingMode = appMode(route) === "opening";
  const language = currentLanguage();
  const homeRoute = openingMode ? "opening" : "dashboard";
  const contextLabel = openingMode ? "筹备项目：" : "当前门店：";
  const contextValue = openingMode ? "Dortmund 新店" : "Martin Biergarten";
  return `
    <header class="topbar">
      <a class="brand" href="#${homeRoute}" style="text-decoration:none;color:inherit">
        <div class="logo-ring"></div>
        <div>
          <div class="brand-title">KaiSpan <span style="font-weight:500;margin:0 8px">×</span> Martin Biergarten</div>
          <div class="brand-subtitle">AI Business Operating System</div>
        </div>
      </a>
      <div class="top-center">
        <button class="store-select" id="storeToggle"><strong>${contextLabel}</strong><span>${contextValue}</span><span>⌄</span></button>
      </div>
      <div class="top-actions">
        <select class="lang-select" id="languageSelect" data-no-translate aria-label="Language">
          <option value="zh" ${language === "zh" ? "selected" : ""}>◎ 中文</option>
          <option value="de" ${language === "de" ? "selected" : ""}>◎ Deutsch</option>
        </select>
        <button class="user-trigger" id="userToggle">
          <span class="avatar martin"></span>
          <span style="text-align:left"><strong>Martin</strong><br><span class="small">Martin Biergarten</span></span>
          <span>⌄</span>
        </button>
      </div>
    </header>`;
}

function taxOfficeTopbar() {
  const language = currentLanguage();
  return `
    <header class="topbar tax-office-topbar">
      <a class="brand" href="#tax-office/dashboard" style="text-decoration:none;color:inherit">
        <div class="logo-ring"></div>
        <div>
          <div class="brand-title">Steuerberater Backoffice</div>
          <div class="brand-subtitle">Kanzlei Arbeitsbereich · Mandantenprüfung</div>
        </div>
      </a>
      <div class="top-center"><span class="tax-office-month">Kanzlei Müller · 2026-06</span></div>
      <div class="top-actions">
        <select class="lang-select" id="languageSelect" data-no-translate aria-label="Language">
          <option value="zh" ${language === "zh" ? "selected" : ""}>◎ 中文</option>
          <option value="de" ${language === "de" ? "selected" : ""}>◎ Deutsch</option>
        </select>
        <button class="user-trigger" id="userToggle">
          <span class="avatar martin"></span>
          <span style="text-align:left"><strong>Lena</strong><br><span class="small">Kanzlei Mitarbeiter</span></span>
          <span>⌄</span>
        </button>
      </div>
    </header>`;
}

function sidebar(route) {
  if (isTaxOfficeRoute(route)) return taxOfficeSidebar(route);
  const visibleNav = navForRoute(route);
  const de = currentLanguage() === "de";
  const routeMain = ["admin", "warehouse", "finance", "store", "employee", "business"].find(prefix => route.startsWith(`${prefix}-`)) || route;
  const activeMain = visibleNav.find(item => item.id === routeMain || item.children?.some(child => route === slug(item.id, child)))?.id || routeMain;
  const completeOpeningText = de ? "Eröffnung abschließen und Unternehmensverwaltung öffnen →" : "完成开店配置，进入企业管理模式 →";
  return `
    <aside class="sidebar" id="sidebar">
      ${visibleNav.map(item => `
        <a class="nav-item ${activeMain === item.id ? "active" : ""}" href="#${item.id}">
          ${navIcon(item)}
          <span class="nav-label">${item.label}</span>
          ${item.badge ? `<span class="badge">${item.badge}</span>` : ""}
          ${item.children?.length && item.id !== "warehouse" && item.id !== "employee" ? `<span class="nav-label" style="flex:0">⌄</span>` : ""}
        </a>
        ${item.children?.length && item.id !== "warehouse" && item.id !== "employee" && activeMain === item.id ? `<div class="subnav">${item.children.map(child => {
          const childRoute = slug(item.id, child);
          const href = item.id === "admin" && appMode(route) === "opening" ? `#${childRoute}?mode=opening` : `#${childRoute}`;
          return `<a class="sub-item ${route === childRoute ? "active" : ""}" href="${href}">${child}</a>`;
        }).join("")}</div>` : ""}
      `).join("")}
      ${isOpeningRoute(route) ? `<a class="complete-mode-btn" href="#dashboard">${completeOpeningText}</a>` : ""}
      <button class="collapse-btn" id="collapseBtn">‹ <span class="collapse-copy">收起菜单</span></button>
    </aside>`;
}

function taxOfficeSidebar(route) {
  const openTasksCount = taxTodoQueue.filter(todo => todo.risk === "高").length;
  const activeClass = (test) => test ? "active" : "";
  const links = [
    { href: "tax-office/dashboard", label: "待办事项", icon: "☑", badge: openTasksCount, active: route === "tax-office" || route === "tax-office/dashboard" },
    { href: "tax-office/clients", label: "客户总览", icon: "企", active: route === "tax-office/clients" },
    { href: "tax-office/settings", label: "设置与规则", icon: "⚙", active: route === "tax-office/settings" }
  ];
  return `
    <aside class="sidebar tax-office-sidebar" id="sidebar">
      ${links.map(item => `<a class="nav-item ${activeClass(item.active)}" href="#${item.href}">
        <span class="nav-icon">${item.icon === "users" ? lucideUsersIcon() : item.icon}</span>
        <span class="nav-label">${item.label}</span>
        ${item.badge ? `<span class="badge">${item.badge}</span>` : ""}
      </a>`).join("")}
      <button class="collapse-btn" id="collapseBtn">‹ <span class="collapse-copy">收起菜单</span></button>
    </aside>`;
}

function navIcon(item) {
  const icons = {
    dashboard: "home",
    todos: "todos",
    warehouse: "warehouse",
    finance: "finance",
    store: "store",
    business: "business",
    admin: "admin"
  };
  if (item.id === "employee") return `<span class="nav-icon lucide-icon">${lucideUsersIcon()}</span>`;
  return icons[item.id]
    ? `<span class="nav-icon image-icon"><img src="assets/menu-icons/${icons[item.id]}.png" alt=""></span>`
    : `<span class="nav-icon">${item.icon}</span>`;
}

function lucideUsersIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;
}

function lucideUploadIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" x2="12" y1="3" y2="15"></line></svg>`;
}

function lucideHomeIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.8V21h14V9.8"></path><path d="M9 21v-6h6v6"></path></svg>`;
}

function lucideReceiptIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 3h16v18l-3-2-3 2-2-2-2 2-3-2-3 2V3z"></path><path d="M8 7h8"></path><path d="M8 11h8"></path><path d="M8 15h5"></path></svg>`;
}

function lucideAlertIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.3 3.9 1.8 18A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`;
}

function moduleIcon(m) {
  return m.id === "employee"
    ? `<span class="dashboard-lucide-icon">${lucideUsersIcon()}</span>`
    : `<img src="assets/menu-icons/${m.id}.png" alt="">`;
}

function slug(prefix, text) {
  return `${prefix}-${encodeURIComponent(text)}`;
}

function page(route) {
  if (isTaxOfficeRoute(route)) return taxOfficePage(route);
  if (route.startsWith("opening-") || route === "opening") return openingRouter(route);
  if (route.startsWith("admin-")) return adminDetailPage(decodeURIComponent(route.replace("admin-", "")));
  if (route === slug("warehouse", "下单")) return warehousePurchasePage();
  if (route === slug("warehouse", "购物车")) return warehouseCartPage();
  if (route === slug("warehouse", "订单管理")) return warehouseOrdersPage();
  if (route === slug("warehouse", "供应商管理")) return supplierManagePage();
  if (route === slug("warehouse", "供应商单据历史")) return supplierHistoryPage();
  if (route === slug("warehouse", "编辑供应商")) return supplierAddPage("edit");
  if (route === slug("warehouse", "运单 / 账单上传")) return warehouseUploadPage();
  if (route === slug("warehouse", "损耗记录")) return warehouseLossPage();
  if (route === slug("finance", "待办事项")) return financeTodosPage();
  if (route === slug("dashboard", "单据上传")) return documentUploadChoicePage();
  if (route === "supplier-add") return supplierAddPage();
  if (route.startsWith("warehouse-") && route !== "warehouse") return placeholderPage("仓库管理助手", decodeURIComponent(route.split("-").slice(1).join("-")));
  if (route.startsWith("finance-") && route !== "finance") return financeDetailPage(decodeURIComponent(route.replace("finance-", "")));
  if (route.startsWith("store-") && route !== "store") return storeDetailPage(decodeURIComponent(route.replace("store-", "")));
  if (route === slug("employee", "员工列表")) return employeeListPage();
  if (route === slug("employee", "员工详情")) return employeeDetailPage();
  if (route.startsWith("employee-") && route !== "employee") return employeeSectionPage(decodeURIComponent(route.replace("employee-", "")));
  if (route.startsWith("business-") && route !== "business") return businessDetailPage(decodeURIComponent(route.replace("business-", "")));
  const pages = {
    dashboard: dashboardPage,
    todos: todosPage,
    warehouse: warehousePage,
    finance: financePage,
    store: storePage,
    employee: employeePage,
    business: businessPage,
    admin: adminPage
  };
  return (pages[route] || dashboardPage)();
}

function taxOfficePage(route) {
  if (route === "tax-office" || route === "tax-office/dashboard") return taxOfficeTodoHome();
  if (route === "tax-office/clients") return taxOfficeClientOverview();
  if (route === "tax-office/settings") return taxOfficeSettingsPage();
  if (route === "tax-office/invite") return taxInviteClientPage();
  if (route.startsWith("tax-office/client/")) {
    const clientId = route.split("/")[2] || "martin";
    return taxOfficeClientWorkspace(clientId);
  }
  return taxOfficeTodoHome();
}

function taxClientById(id) {
  const base = taxClients.find(client => client.id === id);
  if (base) return base;
  const matrix = taxClientMatrix.find(row => row.clientId === id);
  return matrix ? { id, name: matrix.name, company: matrix.company, owner: matrix.name, month: matrix.period, stores: matrix.stores, completeness: matrix.readiness, status: matrix.datev === "已导出" ? "可交付" : "需要处理", manager: matrix.manager, score: "B", datev: matrix.datev } : taxClients[0];
}

function taxOfficeSettingsPage() {
  const de = currentLanguage() === "de";
  const deadlineRules = de ? [
    ["UStVA", "jeden Monat am 10.", "5 Tage vorher Aufgabe erstellen", "Bei fehlenden Mandantenunterlagen automatisch als hohes Risiko markieren"],
    ["Lohnsteuer", "jeden Monat am 10.", "4 Tage vorher erinnern", "DATEV-Export sperren, solange Lohndaten nicht bestätigt sind"],
    ["SV Meldung", "jeden Monat am 25.", "7 Tage vorher erinnern", "Bei fehlenden Mitarbeiterunterlagen Mandantennachricht erstellen"],
    ["Jahresabschluss", "31. Dezember", "30 / 14 / 7 Tage vorher erinnern", "Jahresabschluss-Mandanten in die Abschluss-Warteschlange übernehmen"],
    ["Steuererklärung", "31. Juli", "30 Tage vorher erinnern", "Unterlagenliste nach Mandantentyp erstellen"]
  ] : [
    ["UStVA", "每月 10 日", "提前 5 天生成待办", "客户缺资料时自动标记高风险"],
    ["Lohnsteuer", "每月 10 日", "提前 4 天提醒", "工资资料未确认时锁定 DATEV 导出"],
    ["SV Meldung", "每月 25 日", "提前 7 天提醒", "员工材料缺失时生成客户消息"],
    ["Jahresabschluss", "12 月 31 日", "提前 30 / 14 / 7 天提醒", "年报客户进入 Abschluss 队列"],
    ["Steuererklärung", "7 月 31 日", "提前 30 天提醒", "按客户类型生成材料清单"]
  ];
  const processRules = de ? [
    ["Lohnzeit der Mitarbeiter", "Mandant lädt Arbeitszeiten, Urlaub, Krankheit und Krankenkassenangaben bis zum 3. des Monats hoch.", "Bei fehlender Fertigstellung in Aufgaben anzeigen"],
    ["Frist für Belegbearbeitung", "Rechnungen, Lieferscheine, Plattformbelege und Bargelderklärungen bis zum 5. des Monats hochladen.", "Fehlende oder doppelte Belege automatisch in die Belegprüfung übernehmen"],
    ["Z-Bon / Kasse", "Z-Bon und Kassenbericht nach Geschäftsschluss täglich hochladen.", "Bei 2 aufeinanderfolgenden Fehltagen als hohes Risiko markieren"],
    ["Antwortfrist für Mandanten", "Normale Fragen 3 Tage, Hochrisiko-Fragen 24 Stunden.", "Nach Fristüberschreitung in der Mandantenübersicht rot markieren"],
    ["Voraussetzungen für DATEV-Export", "Lohn, Belege, Einnahmen und Abstimmung müssen vollständig sein.", "Bei fehlender Voraussetzung Button als nicht bereit anzeigen"]
  ] : [
    ["员工工资时间", "每月 3 日前客户上传工时、假期、病假和 Krankenkasse 信息。", "未完成时显示在待办事项"],
    ["账单处理截止日期", "每月 5 日前完成 Rechnung、Lieferschein、平台账单和现金说明上传。", "缺失或重复自动进入账单检查"],
    ["Z-Bon / Kasse", "每天营业结束后上传 Z-Bon 和 Kassenbericht。", "连续缺失 2 天转为高风险"],
    ["客户回复期限", "普通问题 3 天，高风险问题 24 小时。", "超时后在客户总览标红"],
    ["DATEV 导出前置条件", "工资、账单、收入、对账全部完成后才允许导出。", "不满足时按钮显示未准备"]
  ];
  const reminderRules = de ? [
    ["Standardverantwortliche", "Lena", "Bei neuen Mandanten automatisch zuweisen"],
    ["Hochrisiko-Benachrichtigung", "E-Mail + Systemaufgabe", "Fehlende Unterlagen, Fristen und doppelte Belege"],
    ["Mandantennachrichten-Vorlage", "Deutsch / Chinesisch", "Automatisch nach Mandantensprache erstellen"],
    ["Exportberechtigung", "Kanzlei Mitarbeiter", "Nur Verantwortliche und Admins dürfen DATEV exportieren"]
  ] : [
    ["默认负责人", "Lena", "新客户自动分配"],
    ["高风险通知", "Email + 系统待办", "缺资料、逾期、重复账单"],
    ["客户消息模板", "中文 / 德文", "按客户语言自动生成"],
    ["导出权限", "Kanzlei Mitarbeiter", "仅负责人和管理员可导出 DATEV"]
  ];
  return `
    <div class="page-head tax-office-head">
      <div><h1>${de ? "Einstellungen und Regeln" : "设置与规则"}</h1><p>${de ? "Fristen, Bearbeitungsregeln, Erinnerungen und DATEV-Anbindung im Steuerberater-Backoffice konfigurieren." : "配置税务师 backoffice 中出现的截止日期、处理规则、提醒方式和 DATEV 链接方式。"}</p></div>
      <button class="primary-btn tax-feedback-action">${de ? "Einstellungen speichern" : "保存设置"}</button>
    </div>
    <section class="grid grid-2 tax-settings-grid">
      <div class="card tax-rule-card">
        <div class="section-title"><h2>${de ? "Fristenregeln" : "截止日期规则"}</h2><span class="pill blue">Fristen</span></div>
        <div class="tax-rule-list">
          ${deadlineRules.map(rule => `<div class="tax-rule-row">
            <div><strong>${rule[0]}</strong><span>${rule[3]}</span></div>
            <select class="tax-month-select"><option>${rule[1]}</option><option>${de ? "jeden Monat am 7." : "每月 7 日"}</option><option>${de ? "jeden Monat am 10." : "每月 10 日"}</option><option>${de ? "jeden Monat am 25." : "每月 25 日"}</option><option>${de ? "31. Dezember" : "12 月 31 日"}</option></select>
            <em>${rule[2]}</em>
          </div>`).join("")}
        </div>
      </div>
      <div class="card tax-rule-card">
        <div class="section-title"><h2>${de ? "Bearbeitungsregeln" : "处理规则"}</h2><span class="pill orange">Workflow</span></div>
        <div class="tax-rule-list">
          ${processRules.map(rule => `<div class="tax-process-row">
            <div><strong>${rule[0]}</strong><span>${rule[1]}</span></div>
            <em>${rule[2]}</em>
          </div>`).join("")}
        </div>
      </div>
    </section>
    <section class="grid grid-2 tax-settings-grid">
      <div class="card">
        <div class="section-title"><h2>${de ? "DATEV-Anbindung" : "DATEV 链接方式"}</h2><span class="pill green">${de ? "Aktiviert" : "已启用"}</span></div>
        <div class="form-grid">
          ${selectField(de ? "Verbindungsart" : "连接方式", de ? ["DATEV Unternehmen online", "DATEV Export ZIP", "SFTP-Upload", "Manueller Download"] : ["DATEV Unternehmen online", "DATEV Export ZIP", "SFTP 上传", "手动下载"])}
          ${selectField(de ? "Exportfrequenz" : "导出频率", de ? ["Manueller Export nach Monatsprüfung", "Wöchentliche automatische Vorbereitung", "Nächtliche tägliche Synchronisierung"] : ["每月检查完成后手动导出", "每周自动准备", "每天夜间同步"])}
          ${field("Beraternummer", de ? "Beraternummer eingeben" : "请输入 Beraternummer", "812345")}
          ${field(de ? "Mandantennummer-Regel" : "Mandantennummer 规则", de ? "z. B. automatische Zuordnung nach Mandantennummer" : "例如客户编号自动映射", de ? "Nach Mandantenakte abgleichen" : "按客户档案 Mandantennummer 匹配")}
          ${selectField(de ? "Belegformat" : "凭证格式", ["DATEV XML + PDF", "CSV + PDF", "ASCII Buchungsstapel"])}
          ${selectField(de ? "Freigabe vor Export" : "导出前审批", de ? ["Manuelle Freigabe erforderlich", "Nur Hochrisiko-Mandanten freigeben", "Keine Freigabe erforderlich"] : ["必须人工审批", "仅高风险客户审批", "无需审批"])}
        </div>
      </div>
      <div class="card">
        <div class="section-title"><h2>${de ? "Erinnerungen und Berechtigungen" : "提醒与权限"}</h2><span class="pill purple">Kanzlei</span></div>
        <div class="tax-rule-list">
          ${reminderRules.map(rule => `<div class="tax-process-row"><div><strong>${rule[0]}</strong><span>${rule[2]}</span></div><em>${rule[1]}</em></div>`).join("")}
        </div>
      </div>
    </section>`;
}

function taxInviteClientPage() {
  const link = "https://kaispan.app/invite/kanzlei-mueller/new-client";
  return `
    <div class="page-head tax-office-head">
      <div>
        <h1>邀请客户</h1>
        <p>先建立客户基本档案；可以发链接让客户自己填写和上传，也可以由 Kanzlei 手动填写、上传。</p>
      </div>
      <div class="button-row">
        <a class="ghost-btn" href="#tax-office/dashboard">返回首页</a>
        <button class="primary-btn tax-feedback-action">保存客户档案</button>
      </div>
    </div>
    <section class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>客户基本信息</h2><span class="pill blue">手动填写</span></div>
        <div class="form-grid">
          ${field("客户名称", "例如 Martin Biergarten")}
          ${field("公司名称", "例如 Martin Gastro GmbH")}
          ${field("联系人", "客户联系人姓名")}
          ${field("Email", "kunde@example.com")}
          ${field("电话", "+49 ...")}
          ${field("门店数量", "1")}
          ${field("Steuernummer", "如已知可填写")}
          ${field("USt-ID", "如已知可填写")}
          ${field("IBAN", "DE...")}
          ${selectField("默认月份", ["2026-06", "2026-05", "2026-04"])}
        </div>
      </div>
      <div class="card">
        <div class="section-title"><h2>发给客户填写</h2><span class="pill purple">客户自助</span></div>
        <p>客户打开链接后，可以补充公司资料、门店资料、员工资料，并上传账单、Z-Bon、Kassenbericht、Kontoauszug 等文件。</p>
        <div class="tax-invite-link"><strong>${link}</strong><button class="ghost-btn tax-feedback-action">复制链接</button></div>
        <textarea class="tax-client-message">您好，请通过这个链接补充公司基础信息并上传本月资料：${link}。完成后我们会在 Steuerberater Backoffice 中检查资料完整度。</textarea>
        <div class="button-row"><button class="primary-btn tax-feedback-action">发送邀请邮件</button><button class="ghost-btn tax-feedback-action">生成 WhatsApp 文案</button></div>
      </div>
    </section>`;
}

function taxTone(value) {
  if (["可交付", "可导出", "完整", "Kontierung OK", "已核对", "已解决"].includes(value)) return "green";
  if (["高风险", "疑似重复", "缺资料"].includes(value)) return "red";
  if (["需要处理", "等客户回复", "需复核", "需审批", "待审批", "抽查建议", "Kostenstelle fehlt", "未准备", "差异 €18.40"].includes(value)) return "orange";
  return "blue";
}

function taxCompleteness(percent) {
  const tone = percent >= 90 ? "green" : percent >= 75 ? "orange" : "red";
  return `<div class="tax-office-progress"><strong>${percent}%</strong><span><i class="${tone}" style="width:${percent}%"></i></span></div>`;
}

function taxTodoDueRank(due) {
  const ranks = {
    "今天": 1,
    "下周一": 2,
    "3 天内": 3,
    "7 天内": 4,
    "本周": 5
  };
  return ranks[due] || 9;
}

function taxTodoText(todo, key) {
  if (currentLanguage() === "de") return taxTodoGerman[todo.id]?.[key] || translateText(todo[key] || "");
  return todo[key] || "";
}

function taxRiskLabel(risk) {
  if (currentLanguage() !== "de") return `${risk}风险`;
  return risk === "高" ? "Hohes Risiko" : risk === "中" ? "Mittleres Risiko" : "Niedriges Risiko";
}

function taxDueLabel(due) {
  if (currentLanguage() !== "de") return due;
  return { "今天": "Heute", "下周一": "Nächster Montag", "3 天内": "In 3 Tagen", "7 天内": "In 7 Tagen", "本周": "Diese Woche" }[due] || translateText(due);
}

function taxOfficeTodoHome() {
  const de = currentLanguage() === "de";
  const selectedTodo = state().params.get("todo");
  const sortedTodos = [...taxTodoQueue].sort((a, b) => taxTodoDueRank(a.due) - taxTodoDueRank(b.due));
  const activeTodo = sortedTodos.find(todo => todo.id === selectedTodo) || sortedTodos[0];
  const activeClient = taxClientById(activeTodo.clientId);
  const highRisk = taxTodoQueue.filter(todo => todo.risk === "高").length;
  const dueToday = taxTodoQueue.filter(todo => todo.due === "今天").length;
  const waitingClients = taxClientMatrix.filter(row => row.communication.includes("未读") || row.communication.includes("等客户")).length;
  const datevReady = taxClientMatrix.filter(row => row.datev === "一键导出" || row.datev === "已导出").length;
  const mailSubject = de
    ? `Bitte fehlende Unterlagen für ${activeClient.name} ergänzen`
    : `请补充 ${activeClient.name} ${taxTodoText(activeTodo, "type")} 相关资料`;
  const mailBody = de
    ? `Guten Tag, ${taxTodoText(activeTodo, "title")}. Bitte ergänzen Sie die fehlenden Dateien für den genannten Zeitraum. Nach Eingang führen wir die Monatsprüfung und DATEV-Vorbereitung fort.`
    : `您好，${taxTodoText(activeTodo, "title")}。请按日期范围补充缺失文件，我们收到后会继续完成本月检查和 DATEV 准备。`;
  return `
    <div class="page-head tax-office-head">
      <div><h1>待办事项</h1><p>税务师 backoffice 首页，优先处理高风险、临期、客户回复和可导出 DATEV 的事项。</p></div>
      <div class="button-row">
        <a class="ghost-btn" href="#tax-office/clients">客户总览</a>
        <a class="primary-btn" href="#tax-office/invite">邀请朋友</a>
      </div>
    </div>
    <section class="card tax-todo-filter-bar">
      <label>截止时间段<select><option>全部时间</option><option>今天到期 · ${dueToday}</option><option>3 天内</option><option>7 天内</option><option>本周</option></select></label>
      <label>客户<select><option>全部客户</option>${taxClientMatrix.map(row => {
        const client = taxClientById(row.clientId);
        return `<option>${client.name} · ${client.company}</option>`;
      }).join("")}</select></label>
      <div class="tax-filter-chips" aria-label="待办分类筛选">
        ${[
          ["Beleg", highRisk],
          ["Kasse", dueToday],
          ["Bank", waitingClients],
          ["Lohn", taxTodoQueue.filter(todo => todo.type.includes("员工") || todo.type.includes("Krankenkasse")).length],
          ["DATEV", datevReady]
        ].map((item, index) => `<button class="filter ${index === 0 ? "active" : ""}">${item[0]} <span>${item[1]}</span></button>`).join("")}
      </div>
    </section>
    <section class="tax-office-home">
      <div class="card">
        <div class="section-title"><h2>待办队列</h2><span class="pill red">${highRisk} 个高优先级</span></div>
        <div class="tax-todo-list-head"><span>截止日期</span><span>客户</span><span>事项</span></div>
        <div class="tax-todo-scroll tax-home-todo-scroll">${sortedTodos.map(todo => {
          const client = taxClientById(todo.clientId);
          const riskTone = todo.risk === "高" ? "high" : todo.risk === "中" ? "medium" : "low";
          return `<a class="tax-todo-row ${activeTodo.id === todo.id ? "active" : ""}" href="#tax-office/dashboard?todo=${todo.id}">
            <span class="tax-todo-date">${taxDueLabel(todo.due)}<em class="risk-${riskTone}">${taxRiskLabel(todo.risk)}</em></span>
            <span class="tax-todo-client"><strong>${client.name}</strong><small>${client.company}</small></span>
            <span class="tax-todo-subject"><b>${taxTodoText(todo, "title")}</b><small>${taxTodoText(todo, "type")}</small></span>
          </a>`;
        }).join("")}</div>
      </div>
      <aside class="card tax-ai-action-panel">
        <div class="section-title"><h2>${de ? "KI-Bearbeitungsvorschlag" : "AI 建议处理"}</h2><span class="pill purple">${taxRiskLabel(activeTodo.risk)}</span></div>
        <h3>${taxTodoText(activeTodo, "title")}</h3>
        <p>${taxTodoText(activeTodo, "ai")}</p>
        <input class="tax-mail-toggle" id="tax-mail-toggle-${activeTodo.id}" type="checkbox">
        <div class="button-row"><label class="primary-btn" for="tax-mail-toggle-${activeTodo.id}">${de ? "E-Mail automatisch erstellen" : "一键生成邮件"}</label><button class="ghost-btn tax-feedback-action">${de ? "Tiefenbearbeitung" : "深度处理"}</button></div>
        <div class="tax-auto-result">
          <div class="tax-auto-result-head"><strong>${de ? "Automatisch erstellte E-Mail" : "自动生成邮件"}</strong><span class="pill blue">${de ? "Zum Versand bereit" : "待发送"}</span></div>
          <div class="tax-mail-editor">
            <div class="tax-recipient-picker">
              <span>${de ? "Empfänger" : "接收人"}</span>
              <div class="tax-recipient-options">
                <button type="button">${activeClient.owner}<span>x</span></button>
                <button type="button">${activeClient.manager}<span>x</span></button>
                <button type="button">${de ? "Buchhaltung" : "会计邮箱"}<span>x</span></button>
              </div>
              <div class="tax-recipient-add">
                <input class="tax-recipient-email" type="email" placeholder="${de ? "E-Mail eingeben" : "输入邮箱"}">
                <button type="button" class="ghost-btn tax-feedback-action">${de ? "Hinzufügen" : "添加"}</button>
              </div>
            </div>
            <label>${de ? "E-Mail-Betreff" : "邮件主题"}<input value="${mailSubject}"></label>
            <label>${de ? "E-Mail-Text" : "邮件正文"}<textarea>${mailBody}</textarea></label>
          </div>
          <div class="tax-mail-actions">
            <label>${de ? "Nächstes Erinnerungsdatum" : "下次提醒日期"}<input type="date" value="2026-06-24"></label>
            <button class="primary-btn tax-feedback-action">${de ? "E-Mail senden" : "发送邮件"}</button>
          </div>
        </div>
      </aside>
    </section>`;
}

function taxOfficeClientOverview() {
  const query = state().params.get("q") || "";
  const rows = taxClientMatrix.filter(row => {
    const client = taxClientById(row.clientId);
    return !query || `${client.name} ${client.company}`.toLowerCase().includes(query.toLowerCase());
  });
  return `
    <div class="page-head tax-office-head">
      <div><h1>税务师客户总表</h1><p>检索客户，按月份查看 KaiSpan 准备度、异常、沟通、员工、账单、Einkommen 和 DATEV 状态。</p></div>
      <a class="primary-btn" href="#tax-office/invite">邀请客户</a>
    </div>
    <section class="card tax-client-table-card">
      <div class="tax-client-toolbar">
        <div class="tax-search-box"><span>⌕</span><input value="${query}" placeholder="检索客户名、公司名、负责人"></div>
        <div class="button-row"><button class="filter active">全部</button><button class="filter">有异常</button><button class="filter">等客户回复</button><button class="filter">可导出 DATEV</button></div>
      </div>
      <div class="tax-client-scroll">
        <table class="table tax-client-matrix">
          <thead><tr><th>客户名</th><th>月份</th><th>Offene Aufgaben</th><th>DATEV</th><th>Lohn</th><th>BWA</th><th>Kommunikation</th><th>Fristen</th><th>操作</th></tr></thead>
          <tbody>${rows.map(row => taxClientMatrixRow(row)).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function taxClientMatrixRow(row) {
  const client = taxClientById(row.clientId);
  const periodOptions = ["2026-06", "2026-05", "2026-04", "2025-12"];
  const category = taxClientCategory(row.clientId);
  const employeeTone = row.employee === "正常" ? "green" : "orange";
  const invoiceTone = row.invoice === "正常" ? "green" : "orange";
  const incomeTone = row.income === "正常" ? "green" : "orange";
  const reconciliationIssues = row.incomeIssues || 0;
  const reconciliationStatus = reconciliationIssues ? "有问题" : "正常";
  const reconciliationTone = reconciliationIssues ? "orange" : "green";
  const openTasks = [
    ["Lohnunterlagen", row.employee, employeeTone, row.employeeIssues, "payroll"],
    ["Belege", row.invoice, invoiceTone, row.invoiceIssues, "invoices"],
    ["Kasse", row.income, incomeTone, row.incomeIssues, "income"],
    ["Bank", reconciliationStatus, reconciliationTone, reconciliationIssues, "reconciliation"]
  ];
  const totalOpenTasks = openTasks.reduce((sum, item) => sum + (item[3] || 0), 0);
  const allModulesReady = row.employee === "正常" && row.invoice === "正常" && row.income === "正常" && !reconciliationIssues;
  const datevStatus = row.datev === "已导出" ? "已导出" : allModulesReady ? "一键导出" : "未准备";
  const payrollSheetStatus = row.employee === "正常" ? "完成" : "未完成";
  const financialReportStatus = row.invoice === "正常" && row.income === "正常" && !reconciliationIssues ? "完成" : "未完成";
  const deadlines = taxDeadlineItems(row.clientId);
  const overdueCount = deadlines.filter(item => item[2] === "red").length;
  const dueSoonCount = deadlines.filter(item => item[2] === "orange").length;
  const fristenTone = overdueCount ? "red" : dueSoonCount ? "orange" : "green";
  const fristenLabel = overdueCount ? "已逾期" : dueSoonCount ? "7天内到期" : "正常";
  const modulePill = (label, tone, count, href) => `<a class="pill tax-module-status ${tone}" href="${href}">${label}${count ? `<em>${count}</em>` : ""}</a>`;
  const statusPill = (label, href) => `<a class="pill tax-module-status ${label === "完成" ? "green" : "orange"}" href="${href}">${label}</a>`;
  const openTaskMenu = `<div class="tax-open-tasks">
    <button class="pill tax-open-tasks-trigger ${totalOpenTasks ? "orange" : "green"}">${totalOpenTasks ? `${totalOpenTasks} offen` : "0 offen"}</button>
    <div class="tax-open-tasks-popover">${openTasks.map(item => `<a href="#tax-office/client/${row.clientId}?tab=${item[4]}" class="tax-open-task-line"><span>${item[0]}</span><strong class="pill ${item[2]}">${item[3] ? `${item[3]} 问题` : "正常"}</strong></a>`).join("")}</div>
  </div>`;
  const fristenMenu = `<div class="tax-open-tasks">
    <button class="pill tax-open-tasks-trigger ${fristenTone}">${fristenLabel}</button>
    <div class="tax-open-tasks-popover">${deadlines.map(item => `<a href="#tax-office/client/${row.clientId}?tab=detail&fristen=${encodeURIComponent(item[0])}" class="tax-open-task-line"><span>${item[0]}<small>${item[1]}</small></span><strong class="pill ${item[2]}">${item[3]}</strong></a>`).join("")}</div>
  </div>`;
  return `<tr>
    <td><div class="tax-client-name-line"><strong>${client.name}</strong><span class="pill ${category[1]}">${category[0]}</span></div><span class="small">${client.company} · ${client.stores} 门店</span></td>
    <td><select class="tax-month-select">${periodOptions.map(period => `<option ${period === row.period ? "selected" : ""}>${period}</option>`).join("")}</select></td>
    <td>${openTaskMenu}</td>
    <td><button class="ghost-btn ${datevStatus === "一键导出" ? "success-btn" : ""} tax-feedback-action">${datevStatus}</button></td>
    <td>${statusPill(payrollSheetStatus, `#tax-office/client/${row.clientId}?tab=payroll-docs`)}</td>
    <td>${statusPill(financialReportStatus, `#tax-office/client/${row.clientId}?tab=financial-report`)}</td>
    <td><a class="tax-mail-link" href="#tax-office/client/${row.clientId}?tab=communication"><span>✉</span>${row.communication}${row.unread ? `<em>${row.unread}</em>` : ""}</a></td>
    <td>${fristenMenu}</td>
    <td><a class="ghost-btn" href="#tax-office/client/${row.clientId}?tab=detail">编辑</a></td>
  </tr>`;
}

function taxClientCategory(clientId) {
  const categories = {
    martin: ["Aktiv", "green"],
    cafe: ["Pausiert", "blue"],
    ramen: ["Gründung", "purple"],
    tapas: ["Jahresabschluss", "orange"],
    burger: ["Gekündigt", "red"],
    sushi: ["Aktiv", "green"],
    pho: ["Aktiv", "green"]
  };
  return categories[clientId] || ["Aktiv", "green"];
}

function taxDeadlineItems(clientId) {
  const presets = {
    martin: [
      ["UStVA", "截止 2026-06-10", "red", "已逾期"],
      ["Lohnsteuer", "截止 2026-06-25", "orange", "7天内"],
      ["SV Meldung", "截止 2026-06-26", "orange", "7天内"],
      ["Jahresabschluss", "截止 2026-12-31", "green", "正常"],
      ["Steuererklärung", "截止 2026-07-31", "green", "正常"]
    ],
    cafe: [
      ["UStVA", "截止 2026-07-10", "green", "正常"],
      ["Lohnsteuer", "截止 2026-07-10", "green", "正常"],
      ["SV Meldung", "截止 2026-07-15", "green", "正常"],
      ["Jahresabschluss", "截止 2026-12-31", "green", "正常"],
      ["Steuererklärung", "截止 2026-07-31", "green", "正常"]
    ],
    ramen: [
      ["UStVA", "截止 2026-06-10", "red", "已逾期"],
      ["Lohnsteuer", "截止 2026-06-25", "orange", "7天内"],
      ["SV Meldung", "截止 2026-06-25", "orange", "7天内"],
      ["Jahresabschluss", "截止 2026-12-31", "green", "正常"],
      ["Steuererklärung", "截止 2026-07-31", "orange", "7天内"]
    ]
  };
  return presets[clientId] || [
    ["UStVA", "截止 2026-07-10", "green", "正常"],
    ["Lohnsteuer", "截止 2026-07-10", "green", "正常"],
    ["SV Meldung", "截止 2026-07-15", "green", "正常"],
    ["Jahresabschluss", "截止 2026-12-31", "green", "正常"],
    ["Steuererklärung", "截止 2026-07-31", "orange", "7天内"]
  ];
}

function taxClientWorkspaceCounts(clientId) {
  const row = taxClientMatrix.find(item => item.clientId === clientId) || taxClientMatrix[0];
  const unresolved = taxIssues.filter(issue => issue.clientId === clientId && issue.status !== "已解决").length;
  const reconciliationIssues = row.incomeIssues || 0;
  const allModulesReady = row.employee === "正常" && row.invoice === "正常" && row.income === "正常" && !reconciliationIssues;
  const payrollDocIssues = row.employee === "正常" ? 0 : 1;
  const financialReportIssues = row.invoice === "正常" && row.income === "正常" && !reconciliationIssues ? 0 : 1;
  const datevIssues = row.datev === "已导出" || allModulesReady ? 0 : 1;
  return {
    overview: (row.employeeIssues || 0) + (row.invoiceIssues || 0) + (row.incomeIssues || 0) + reconciliationIssues,
    payroll: row.employeeIssues || 0,
    invoices: row.invoiceIssues || 0,
    income: row.incomeIssues || 0,
    reconciliation: reconciliationIssues,
    datev: datevIssues,
    "payroll-docs": payrollDocIssues,
    "financial-report": financialReportIssues,
    communication: row.unread || 0,
    detail: unresolved
  };
}

function taxOfficeClientWorkspace(clientId) {
  const client = taxClientById(clientId);
  const tab = state().params.get("tab") || "overview";
  const period = state().params.get("period") || client.month;
  const periodOptions = ["2026-06", "2026-05", "2026-04", "2025-12"];
  const counts = taxClientWorkspaceCounts(client.id);
  const activeTab = {
    "payroll-all": "payroll",
    "invoices-all": "invoices",
    "income-all": "income",
    "reconciliation-all": "reconciliation"
  }[tab] || tab;
  const tabs = [
    ["overview", "总览"],
    ["payroll", "员工"],
    ["invoices", "账单检查"],
    ["income", "收入"],
    ["reconciliation", "对账"],
    ["datev", "DATEV"],
    ["payroll-docs", "工资单"],
    ["financial-report", "财报"],
    ["communication", "客户沟通"],
    ["detail", "操作"]
  ];
  return `
    <div class="page-head tax-office-head">
      <div>
        <div class="tax-office-title-controls">
          <select class="tax-office-title-select" onchange="location.hash='tax-office/client/'+this.value+'?tab=${tab}&period=${period}'">
            ${taxClients.map(item => `<option value="${item.id}" ${item.id === client.id ? "selected" : ""}>${item.name}</option>`).join("")}
          </select>
          <select class="tax-office-title-select period" onchange="location.hash='tax-office/client/${client.id}?tab=${tab}&period='+this.value">
            ${periodOptions.map(item => `<option ${item === period ? "selected" : ""}>${item}</option>`).join("")}
          </select>
          <h1>月度检查</h1>
        </div>
        <p>${client.company} · 负责人 ${client.manager} · DATEV：<span class="pill ${taxTone(client.datev)}">${client.datev}</span></p>
      </div>
      <div class="button-row">
        <a class="primary-btn" href="#tax-office/dashboard">返回</a>
        <button class="ghost-btn tax-feedback-action">一键反馈问题</button>
        <button class="ghost-btn success-btn tax-feedback-action">审批通过并准备 DATEV</button>
      </div>
    </div>
    <section class="card tax-client-summary">
      <div><p>资料完整度</p>${taxCompleteness(client.completeness)}</div>
      <div><p>客户状态</p><strong class="tax-summary-state ${taxTone(client.status)}">${client.status}</strong></div>
      <div><p>本月评分</p><strong class="tax-summary-state">${client.score}</strong></div>
      <div><p>待处理问题</p><strong class="tax-summary-state red">${taxIssues.filter(issue => issue.clientId === client.id && issue.status !== "已解决").length}</strong></div>
    </section>
    <nav class="tax-work-tabs">${tabs.map(item => `<a class="filter ${activeTab === item[0] ? "active" : ""}" href="#tax-office/client/${client.id}?tab=${item[0]}&period=${period}"><span>${item[1]}</span>${counts[item[0]] ? `<em class="tax-tab-badge">${counts[item[0]]}</em>` : ""}</a>`).join("")}</nav>
    ${tab === "payroll" ? taxPayrollPanel(client) : tab === "payroll-all" ? taxPayrollAllPanel(client) : tab === "invoices" ? taxInvoicePanel(client) : tab === "invoices-all" ? taxInvoiceAllPanel(client) : tab === "income" ? taxIncomePanel(client) : tab === "income-all" ? taxIncomeAllPanel(client) : tab === "reconciliation" ? taxReconciliationPanel(client) : tab === "reconciliation-all" ? taxReconciliationAllPanel(client) : tab === "datev" ? taxDatevPanel(client) : tab === "payroll-docs" ? taxPayrollDocsPanel(client) : tab === "financial-report" ? taxFinancialReportPanel(client) : tab === "communication" ? taxCommunicationPanel(client) : tab === "detail" ? taxClientDetailPanel(client) : taxOverviewPanel(client)}`;
}

function taxSelectedPeriod(client) {
  return state().params.get("period") || client.month;
}

function taxModuleEditCta(client, tab) {
  return `<div class="tax-module-footer"><a class="primary-btn" href="#tax-office/client/${client.id}?tab=${tab}&period=${taxSelectedPeriod(client)}">查看全部信息和编辑</a></div>`;
}

function taxKaispanReadinessPanel(client) {
  const items = [
    ["供应商账单", "42 张", "已整理", "green"],
    ["外部平台账单", "5 份", "已整理", "green"],
    ["每日 Abrechnung", client.id === "ramen" ? "23 / 31 天" : "31 / 31 天", client.id === "ramen" ? "缺失" : "完整", client.id === "ramen" ? "red" : "green"],
    ["工资资料", client.id === "martin" ? "4 名员工" : "6 名员工", client.id === "martin" ? "待复核" : "已准备", client.id === "martin" ? "orange" : "green"],
    ["Kassenbericht", client.id === "ramen" ? "缺 8 天" : "31 天", client.id === "ramen" ? "缺失" : "已准备", client.id === "ramen" ? "red" : "green"],
    ["Kontierung", "12 项", "需抽查", "orange"],
    ["银行对账", client.id === "tapas" ? "2 笔未匹配" : "已匹配", client.id === "tapas" ? "需处理" : "完成", client.id === "tapas" ? "orange" : "green"],
    ["税务师备注", "3 条", "已生成草稿", "blue"]
  ];
  return `<section class="card tax-package-card">
    <div class="section-title"><div><h2>KaiSpan 准备度详情</h2><p>参考老板端“税务师资料包”：看本月资料是否已经被 KaiSpan 整理好，哪些还不能交给 Steuerberater / DATEV。</p></div><button class="primary-btn tax-feedback-action">重新检查准备度</button></div>
    <div class="tax-package-grid">${items.map(item => `<div class="tax-package-item"><span>${item[0]}</span><strong>${item[1]}</strong><em class="pill ${item[3]}">${item[2]}</em></div>`).join("")}</div>
    <div class="tax-readiness-note"><strong>AI 结论</strong><p>${client.name} 当前最影响交付的是工资资料复核、Kontierung 抽查和 Kasse 差异说明。处理后可进入 DATEV 导出。</p></div>
  </section>`;
}

function taxOverviewPanel(client) {
  const issues = taxIssues.filter(issue => issue.clientId === client.id);
  return `
    <section class="tax-work-grid">
      <div class="card">
        <div class="section-title"><h2>本月检查结论</h2><span class="pill ${taxTone(client.status)}">${client.status}</span></div>
        <div class="tax-check-lines">
          ${[
            ["员工工资资料", client.id === "martin" ? "Lisa Urlaub 需复核" : "基本完整", client.id === "martin" ? "orange" : "green"],
            ["账单 Kontierung", client.id === "martin" ? "1 张重复风险" : "可抽查", client.id === "martin" ? "red" : "green"],
            ["Z-Bon / Kasse", client.id === "ramen" ? "缺资料" : "有 1 天差异", client.id === "ramen" ? "red" : "orange"],
            ["DATEV 准备", client.datev, taxTone(client.datev)]
          ].map(row => `<div class="status-line"><span>${row[0]}</span><strong class="pill ${row[2]}">${row[1]}</strong></div>`).join("")}
        </div>
      </div>
      <div class="card red-zone">
        <div class="section-title"><h2>优先问题</h2><button class="ghost-btn tax-feedback-action">生成客户消息</button></div>
        ${issues.map(issue => `<div class="warn-item"><div><strong>${issue.title}</strong><span>${issue.module} · ${issue.detail}</span></div><span class="pill ${issue.level === "高" ? "red" : "orange"}">${issue.level}</span></div>`).join("") || `<p>暂无未处理问题。</p>`}
      </div>
    </section>`;
}

function taxPayrollPanel(client) {
  const rows = taxEmployees.filter(row => row.clientId === client.id).filter(row => row.docStatus !== "完整" || row.status !== "完整" || (row.sick !== "0天" && row.krankRefund !== "是"));
  return `
    <section class="card">
      <div class="section-title"><div><h2>员工月结问题</h2><p>只显示本月需要税务师处理的员工材料、工资、Urlaub、病假、Krankenkasse 退款和 Arbeitszeitkonto。</p></div><button class="primary-btn tax-feedback-action">审批工资资料</button></div>
      <div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>员工</th><th>材料</th><th>工资</th><th>Urlaub</th><th>病假</th><th>Krankenkasse退款</th><th>Arbeitszeitkonto</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${rows.map((row, index) => {
          const timeAccount = index === 1 ? "-6.5h" : index === 3 ? "+4.0h" : "+0.5h";
          const materialNote = row.docStatus === "完整" ? "合同 / Steuer-ID / Krankenkasse 完整" : "缺 Steuer-ID 或 Krankenkasse";
          return `<tr><td><strong>${row.name}</strong><br><span class="small">${row.contract}</span></td><td><span class="pill ${row.docStatus === "完整" ? "green" : "orange"}">${row.docStatus}</span><br><span class="small">${materialNote}</span></td><td><strong>${row.wage}</strong><br><span class="small">${row.hours}</span></td><td>${row.urlaub}</td><td>${row.sick}</td><td><span class="pill ${row.krankRefund === "是" ? "green" : "orange"}">${row.krankRefund}</span></td><td><span class="pill ${timeAccount.startsWith("-") ? "orange" : "green"}">${timeAccount}</span></td><td><span class="pill ${taxTone(row.status)}">${row.status}</span></td><td><button class="ghost-btn tax-feedback-action">查看</button><button class="ghost-btn tax-feedback-action">标记反馈</button></td></tr>`;
        }).join("") || `<tr><td colspan="9">当前月份没有员工问题。</td></tr>`}
      </tbody></table></div>
      ${taxModuleEditCta(client, "payroll-all")}
    </section>`;
}

function taxInvoicePanel(client) {
  const rows = taxInvoices.filter(row => row.clientId === client.id).filter(row => row.tone !== "green");
  return `
    <section class="card">
      <div class="section-title"><div><h2>账单检查问题</h2><p>只显示 Kontierung 错误、账单格式识别错误、违背规则的账单和缺失字段。</p></div></div>
      <div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>供应商</th><th>账单号</th><th>Brutto</th><th>格式识别</th><th>规则检查</th><th>Kontierung复查</th><th>操作</th></tr></thead><tbody>
        ${rows.map(row => `<tr><td><strong>${row.supplier}</strong><br><span class="small">${row.date}</span></td><td>${row.no}</td><td><strong>${row.brutto}</strong></td><td><span class="pill ${row.tone === "green" ? "green" : "orange"}">${row.tone === "green" ? "识别正常" : "需复核"}</span></td><td><span class="pill ${row.tone}">${row.status}</span></td><td><span class="pill ${row.tone}">${row.tone === "green" ? "可通过" : "有问题"}</span></td><td><button class="ghost-btn tax-sample-doc">查看详情</button><button class="ghost-btn tax-feedback-action">标记反馈</button></td></tr>`).join("") || `<tr><td colspan="7">当前月份没有账单检查问题。</td></tr>`}
      </tbody></table></div>
      ${taxModuleEditCta(client, "invoices-all")}
    </section>`;
}

function taxCashPanel(client) {
  const rows = taxCashRows.filter(row => row.clientId === client.id);
  return `
    <section class="card">
      <div class="section-title"><div><h2>Z-Bon / Abrechnung / Kassenbericht / 银行存钱</h2><p>按天核对：老板端上传 Z-Bon、每日 Abrechnung、Kassenbericht 和现金存银行凭证。</p></div><button class="primary-btn tax-feedback-action">一键检查 Kasse</button></div>
      <div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>日期</th><th>Z-Bon</th><th>每日 Abrechnung</th><th>Kassenbericht</th><th>银行存钱</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${rows.map(row => `<tr><td><strong>${row.date}</strong></td><td>${row.zbon}</td><td>${row.abrechnung}</td><td>${row.kasse}</td><td>${row.bank}</td><td><span class="pill ${row.tone}">${row.status}</span></td><td><button class="ghost-btn tax-feedback-action">查看</button><button class="ghost-btn tax-feedback-action">发回客户</button></td></tr>`).join("")}
      </tbody></table></div>
    </section>
    <section class="grid grid-3" style="margin-top:16px">
      ${["Z-Bon 缺失检查", "Kassenbestand 差异", "银行存钱匹配"].map((title, index) => `<div class="card"><div class="section-title"><h2>${title}</h2><span class="pill ${index === 0 && client.id === "ramen" ? "red" : index === 1 ? "orange" : "green"}">${index === 2 ? "已匹配" : "需复核"}</span></div><p>点击后可查看对应原始文件和每日记录。</p><button class="ghost-btn tax-feedback-action">处理</button></div>`).join("")}
    </section>`;
}

function taxIncomePanel(client) {
  const incomeRows = [
    ["ZB-0611", "Z-Bon", "现金收入", "2026-06-11", "€2,410.00", "完整"],
    ["AR-2026-0601", "Ausgangsrechnung", "公司开出去账单", "2026-06-04", "€1,420.00", "完整"],
    ["LFD-0604", "Lieferando", "平台进项", "2026-06-04", "€1,420.00", "完整"],
    ["UE-0608", "Uber Eats", "平台进项", "2026-06-08", "€860.50", "缺结算单"],
    ["BAR-0612", "Barumsatz", "现金收入", "2026-06-12", "€1,240.00", "Kasse 差异"]
  ].filter(row => row[5] !== "完整");
  return `<section class="grid tax-income-stack">
    <div class="card">
      <div class="section-title"><div><h2>收入问题</h2><p>只显示 Z-Bon、公司开出去账单、平台收入和进项收入里的异常项。</p></div><button class="primary-btn tax-feedback-action">检查收入资料</button></div>
      <div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>编号</th><th>类型</th><th>来源</th><th>日期</th><th>金额</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${incomeRows.map(row => `<tr><td>${row[0]}</td><td><strong>${row[1]}</strong></td><td>${row[2]}</td><td>${row[3]}</td><td><strong>${row[4]}</strong></td><td><span class="pill ${row[5] === "完整" ? "green" : "orange"}">${row[5]}</span></td><td><button class="ghost-btn tax-feedback-action">查看</button></td></tr>`).join("") || `<tr><td colspan="7">当前月份没有收入问题。</td></tr>`}
      </tbody></table></div>
      ${taxModuleEditCta(client, "income-all")}
    </div>
    <div class="grid grid-3">
      ${[
        ["Z-Bon 收入", "31 天", "完整", "green"],
        ["Ausgangsrechnungen", "4 张", "1 张需复核", "orange"],
        ["平台进项", "Lieferando / Uber Eats", "缺 1 份", "orange"]
      ].map(item => `<div class="card"><div class="section-title"><h2>${item[0]}</h2><span class="pill ${item[3]}">${item[2]}</span></div><p>${item[1]}</p><button class="ghost-btn tax-feedback-action">打开</button></div>`).join("")}
    </div>
  </section>`;
}

function taxReconciliationPanel(client) {
  const kontoRows = [
    ["2026-06-03", "EC Kartenzahlung", "€312.40", "缺出项账单", "offen"],
    ["2026-06-08", "Uber Eats payout", "€860.50", "缺平台结算单", "offen"],
    ["2026-06-12", "Metro Lastschrift", "€438.90", "缺进项 Rechnung", "offen"],
    ["2026-06-15", "Lieferando payout", "€1,420.00", "已匹配", "done"]
  ].filter(row => row[4] !== "done");
  return `<section class="grid tax-income-stack">
    <div class="card red-zone">
      <div class="section-title"><div><h2>Kontoauszug 对账问题</h2><p>只显示银行流水中缺账单、缺平台结算单和需要进入 Offen Rechnung 的项目。</p></div><button class="primary-btn tax-feedback-action">一键生成补交清单</button></div>
      <div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>日期</th><th>Kontoauszug 项目</th><th>金额</th><th>问题</th><th>操作</th></tr></thead><tbody>
        ${kontoRows.map(row => `<tr><td>${row[0]}</td><td><strong>${row[1]}</strong></td><td>${row[2]}</td><td><span class="pill ${row[4] === "done" ? "green" : "orange"}">${row[3]}</span></td><td><button class="ghost-btn tax-feedback-action">提示补交</button><button class="ghost-btn tax-feedback-action">进 Offen Rechnung</button></td></tr>`).join("") || `<tr><td colspan="5">当前月份没有对账问题。</td></tr>`}
      </tbody></table></div>
      ${taxModuleEditCta(client, "reconciliation-all")}
    </div>
    <section class="grid grid-3">
      ${[
        ["缺出项", "Kontoauszug 有收入，但没有 Ausgangsrechnung", "2 项"],
        ["缺进项", "银行扣款找不到供应商 Rechnung", "1 项"],
        ["Offen Rechnung", "需进入开放账单继续处理", "3 项"]
      ].map(item => `<div class="card"><div class="section-title"><h2>${item[0]}</h2><span class="pill orange">${item[2]}</span></div><p>${item[1]}</p><button class="ghost-btn tax-feedback-action">查看详情</button></div>`).join("")}
    </section>
  </section>`;
}

function taxFullEditShell(client, title, description, rowsHtml, formHtml, uploadTitle) {
  return `<section class="grid tax-income-stack">
    <div class="card">
      <div class="section-title"><div><h2>${title}</h2><p>${description}</p></div><div class="button-row"><a class="ghost-btn" href="#tax-office/client/${client.id}?tab=overview&period=${taxSelectedPeriod(client)}">返回检查</a><button class="primary-btn tax-feedback-action">保存修改</button></div></div>
      ${rowsHtml}
    </div>
    <section class="grid grid-2">
      <div class="card"><div class="section-title"><h2>编辑表单</h2><span class="pill blue">${taxSelectedPeriod(client)}</span></div><div class="form-grid">${formHtml}</div></div>
      <div class="card"><div class="section-title"><h2>${uploadTitle}</h2><span class="pill orange">可上传</span></div><div class="upload">拖拽上传或点击选择文件</div><div class="button-row"><button class="ghost-btn tax-feedback-action">识别文件</button><button class="ghost-btn tax-feedback-action">发给客户补充</button></div></div>
    </section>
  </section>`;
}

function taxPayrollAllPanel(client) {
  const rows = taxEmployees.filter(row => row.clientId === client.id);
  const rowsHtml = `<div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>员工</th><th>合同</th><th>工时</th><th>Urlaub</th><th>病假</th><th>Krankenkasse</th><th>工资</th><th>状态</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${row.name}</strong></td><td>${row.contract}</td><td>${row.hours}</td><td>${row.urlaub}</td><td>${row.sick}</td><td>${row.krankRefund}</td><td><strong>${row.wage}</strong></td><td><span class="pill ${taxTone(row.status)}">${row.status}</span></td></tr>`).join("")}</tbody></table></div>`;
  const formHtml = `${field("员工姓名", "姓名", "Lisa")}${selectField("合同类型", ["Vollzeit", "Teilzeit", "Minijob"])}${field("本月工时", "小时", "118h")}${field("Urlaub", "天数", "3天")}${field("病假", "天数", "1天")}${selectField("Krankenkasse退款", ["否", "是"])}${field("Arbeitszeitkonto", "+/- 小时", "-6.5h")}${field("工资", "金额", "€1,675.60")}`;
  return taxFullEditShell(client, "员工全部信息和编辑", "查看选中月份内所有员工资料，并可编辑工资、请假、病假和 Arbeitszeitkonto。", rowsHtml, formHtml, "上传员工资料 / 合同 / Krankmeldung");
}

function taxInvoiceAllPanel(client) {
  const rows = taxInvoices.filter(row => row.clientId === client.id);
  const rowsHtml = `<div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>供应商</th><th>账单号</th><th>日期</th><th>Brutto</th><th>Sachkonto</th><th>Kostenstelle</th><th>状态</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${row.supplier}</strong></td><td>${row.no}</td><td>${row.date}</td><td>${row.brutto}</td><td>${row.account}</td><td>${row.cost || "缺失"}</td><td><span class="pill ${row.tone}">${row.status}</span></td></tr>`).join("")}</tbody></table></div>`;
  const formHtml = `${field("Lieferant", "供应商", "Metro Deutschland")}${field("Rechnungsnummer", "账单号", "INV-0611")}${field("Brutto", "金额", "€980.20")}${field("Sachkonto", "科目", "3400 Wareneinkauf")}${field("Kostenstelle", "成本中心", "100")}${selectField("规则状态", ["需复核", "可通过", "发给客户"])}${field("内部备注", "备注", "疑似重复，需抽查 PDF")}`;
  return taxFullEditShell(client, "账单全部信息和编辑", "查看选中月份内所有 Rechnung、Kontierung、格式识别和规则检查结果。", rowsHtml, formHtml, "上传 Rechnung / Lieferschein");
}

function taxIncomeAllPanel(client) {
  const rows = [
    ["ZB-0611", "Z-Bon", "现金收入", "2026-06-11", "€2,410.00", "完整"],
    ["AR-2026-0601", "Ausgangsrechnung", "公司开出去账单", "2026-06-04", "€1,420.00", "完整"],
    ["LFD-0604", "Lieferando", "平台进项", "2026-06-04", "€1,420.00", "完整"],
    ["UE-0608", "Uber Eats", "平台进项", "2026-06-08", "€860.50", "缺结算单"],
    ["BAR-0612", "Barumsatz", "现金收入", "2026-06-12", "€1,240.00", "Kasse 差异"]
  ];
  const rowsHtml = `<div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>编号</th><th>类型</th><th>来源</th><th>日期</th><th>金额</th><th>状态</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row[0]}</td><td><strong>${row[1]}</strong></td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td><td><span class="pill ${row[5] === "完整" ? "green" : "orange"}">${row[5]}</span></td></tr>`).join("")}</tbody></table></div>`;
  const formHtml = `${selectField("收入类型", ["Z-Bon", "Ausgangsrechnung", "Lieferando", "Uber Eats", "Barumsatz"])}${field("编号", "编号", "UE-0608")}${field("日期", "YYYY-MM-DD", "2026-06-08")}${field("金额", "金额", "€860.50")}${selectField("状态", ["缺结算单", "完整", "Kasse 差异"])}${field("备注", "备注", "等待平台结算单")}`;
  return taxFullEditShell(client, "收入全部信息和编辑", "查看选中月份内 Z-Bon、开出去账单、平台收入和进项收入资料。", rowsHtml, formHtml, "上传 Z-Bon / Ausgangsrechnung / 平台结算单");
}

function taxReconciliationAllPanel(client) {
  const rows = [
    ["2026-06-03", "EC Kartenzahlung", "€312.40", "缺出项账单", "offen"],
    ["2026-06-08", "Uber Eats payout", "€860.50", "缺平台结算单", "offen"],
    ["2026-06-12", "Metro Lastschrift", "€438.90", "缺进项 Rechnung", "offen"],
    ["2026-06-15", "Lieferando payout", "€1,420.00", "已匹配", "done"]
  ];
  const rowsHtml = `<div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>日期</th><th>Kontoauszug 项目</th><th>金额</th><th>匹配结果</th><th>状态</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row[0]}</td><td><strong>${row[1]}</strong></td><td>${row[2]}</td><td>${row[3]}</td><td><span class="pill ${row[4] === "done" ? "green" : "orange"}">${row[4] === "done" ? "完成" : "未完成"}</span></td></tr>`).join("")}</tbody></table></div>`;
  const formHtml = `${field("Kontoauszug 项目", "流水描述", "Uber Eats payout")}${field("金额", "金额", "€860.50")}${selectField("匹配类型", ["缺出项", "缺进项", "Offen Rechnung", "已匹配"])}${field("关联账单", "文件或编号", "UE-0608")}${field("备注", "备注", "缺平台结算单")}`;
  return taxFullEditShell(client, "对账全部信息和编辑", "查看选中月份内所有 Kontoauszug 匹配结果，并可进入 Offen Rechnung 或上传缺失单据。", rowsHtml, formHtml, "上传 Kontoauszug / 缺失账单");
}

function taxPayrollDocsPanel(client) {
  const docs = [
    ["2026-06", "Lohnabrechnung Kevin.pdf", "完成", "2026-06-30"],
    ["2026-06", "Lohnabrechnung Lisa.pdf", "未完成", "等待 Urlaub 确认"],
    ["2026-05", "Lohnjournal Mai.pdf", "完成", "2026-05-31"]
  ];
  return `<section class="card">
    <div class="section-title"><div><h2>工资单文档</h2><p>可按时间区间查看工资单、Lohnjournal 和工资准备文件。</p></div><div class="button-row"><select class="tax-month-select"><option>2026-06</option><option>2026-05</option><option>2026-04</option></select><button class="primary-btn tax-feedback-action">导出工资单</button></div></div>
    <div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>月份</th><th>文档</th><th>状态</th><th>日期 / 说明</th><th>操作</th></tr></thead><tbody>
      ${docs.map(row => `<tr><td>${row[0]}</td><td><strong>${row[1]}</strong></td><td><span class="pill ${row[2] === "完成" ? "green" : "orange"}">${row[2]}</span></td><td>${row[3]}</td><td><button class="ghost-btn tax-feedback-action">查看文档</button><button class="ghost-btn tax-feedback-action">发给客户</button></td></tr>`).join("")}
    </tbody></table></div>
  </section>`;
}

function taxDatevPanel(client) {
  const checks = [
    ["员工", client.id === "cafe" || client.id === "pho" ? "正常" : "有问题"],
    ["账单检查", client.id === "cafe" || client.id === "pho" ? "正常" : "有问题"],
    ["收入", client.id === "cafe" || client.id === "pho" ? "正常" : "有问题"],
    ["对账", client.id === "cafe" || client.id === "pho" ? "正常" : "有问题"]
  ];
  const ready = checks.every(row => row[1] === "正常");
  return `<section class="card">
    <div class="section-title"><div><h2>DATEV 准备</h2><p>只有员工、账单检查、收入和对账全部正常，才可以一键导出。</p></div><button class="primary-btn ${ready ? "" : "disabled"} tax-feedback-action">${ready ? "一键导出 DATEV" : "未准备"}</button></div>
    <div class="grid grid-4">
      ${checks.map(row => `<div class="card"><div class="section-title"><h2>${row[0]}</h2><span class="pill ${row[1] === "正常" ? "green" : "orange"}">${row[1]}</span></div><p>${row[1] === "正常" ? "可进入 DATEV 包" : "需先处理该模块问题"}</p></div>`).join("")}
    </div>
  </section>`;
}

function taxFinancialReportPanel(client) {
  const docs = [
    ["2026-06", "BWA Juni 2026.pdf", "未完成", "等待 Kontoauszug 对账"],
    ["2026-06", "UStVA Vorbereitung Juni.xlsx", "完成", "可复核"],
    ["2026-05", "Monatsabschluss Mai.pdf", "完成", "已归档"]
  ];
  return `<section class="card">
    <div class="section-title"><div><h2>财报文档</h2><p>按时间区间查看 BWA、UStVA 准备、月结和 Jahresabschluss 相关文档。</p></div><div class="button-row"><select class="tax-month-select"><option>2026-06</option><option>2026-Q2</option><option>2026</option></select><button class="primary-btn tax-feedback-action">生成财报包</button></div></div>
    <div class="table-scroll"><table class="table tax-office-table"><thead><tr><th>时间区间</th><th>文档</th><th>状态</th><th>说明</th><th>操作</th></tr></thead><tbody>
      ${docs.map(row => `<tr><td>${row[0]}</td><td><strong>${row[1]}</strong></td><td><span class="pill ${row[2] === "完成" ? "green" : "orange"}">${row[2]}</span></td><td>${row[3]}</td><td><button class="ghost-btn tax-feedback-action">查看文档</button><button class="ghost-btn tax-feedback-action">重新生成</button></td></tr>`).join("")}
    </tbody></table></div>
  </section>`;
}

function taxCommunicationPanel(client) {
  const messages = [
    ["客户回复", "我已上传 06-12 的 Kassenbericht，请帮我再看一下。", "未读", "orange"],
    ["税务师发出", "请补充 Metro 重复账单说明和 Lisa Urlaub 确认。", "已发送", "green"],
    ["客户回复", "Uber Eats 结算单我明天补上传。", "未读", "orange"]
  ];
  const markedFeedback = [
    ["员工", "Lisa Urlaub 和工资资料不一致，请确认本月实际 Urlaub 天数。"],
    ["员工", "Anna 仍缺 Steuer-ID 或 Krankenkasse，请补充员工材料。"],
    ["账单", "Metro Rechnung INV-0611 疑似重复，请上传原始 PDF 或说明。"],
    ["收入", "Uber Eats 06-08 缺平台结算单，请补充。"],
    ["对账", "Kontoauszug 中 €312.40 缺对应出项账单，请上传或说明。"]
  ];
  const emailBody = `您好，${client.name}：\n\n本月我们在检查资料时标记了以下需要补充或确认的问题：\n${markedFeedback.map((item, index) => `${index + 1}. 【${item[0]}】${item[1]}`).join("\n")}\n\n请您通过 KaiSpan 上传对应资料或直接回复说明。收到后我们会继续完成本月检查和 DATEV 准备。\n\n谢谢。`;
  return `<section class="grid grid-2">
    <div class="card">
      <div class="section-title"><h2>客户沟通</h2><span class="pill orange">2 未读</span></div>
      <div class="tax-message-list">${messages.map(row => `<div class="tax-message-item"><div><span>${row[0]}</span><strong>${row[1]}</strong></div><em class="pill ${row[3]}">${row[2]}</em></div>`).join("")}</div>
    </div>
    <div class="card">
      <div class="section-title"><h2>标记反馈汇总</h2><span class="pill purple">${markedFeedback.length} 个问题</span></div>
      <div class="tax-message-list">${markedFeedback.map(row => `<div class="tax-message-item"><div><span>${row[0]}</span><strong>${row[1]}</strong></div><em class="pill orange">待发送</em></div>`).join("")}</div>
    </div>
    <div class="card tax-email-draft">
      <div class="section-title"><h2>自动生成 Email</h2><span class="pill blue">可编辑</span></div>
      <div class="field"><label>收件人</label><input value="kunde@example.com"></div>
      <div class="field"><label>主题</label><input value="${client.name} ${taxSelectedPeriod(client)} 月资料补充与确认"></div>
      <textarea class="tax-client-message">${emailBody}</textarea>
      <div class="button-row"><button class="primary-btn tax-feedback-action">一键发送 Email</button><button class="ghost-btn tax-feedback-action">保存草稿</button></div>
    </div>
  </section>`;
}

function taxClientDetailPanel(client) {
  return `<section class="grid grid-2">
    <div class="card">
      <div class="section-title"><h2>客户重要信息</h2><button class="primary-btn tax-feedback-action">保存修改</button></div>
      <div class="form-grid">
        ${field("客户名", "客户名", client.name)}
        ${field("公司名", "公司名", client.company)}
        ${field("负责人", "负责人", client.manager)}
        ${field("门店数量", "门店数量", String(client.stores))}
        ${field("Beraternummer", "Beraternummer", "842918")}
        ${field("Mandantennummer", "Mandantennummer", client.id === "martin" ? "10041" : "10077")}
        ${field("SKR", "SKR03 / SKR04", client.id === "ramen" ? "SKR04" : "SKR03")}
        ${field("默认 Kostenstelle", "Kostenstelle", "100")}
      </div>
    </div>
    <div class="card">
      <div class="section-title"><h2>所有模块</h2><span class="pill blue">快速入口</span></div>
      ${[
        ["KaiSpan", "kaispan"],
        ["员工", "payroll"],
        ["账单检查", "invoices"],
        ["收入", "income"],
        ["对账", "reconciliation"],
        ["Kasse", "cash"],
        ["DATEV", "datev"],
        ["工资单", "payroll-docs"],
        ["财报", "financial-report"],
        ["客户沟通", "communication"],
        ["问题反馈", "feedback"]
      ].map(row => `<div class="status-line"><span>${row[0]}</span><a class="ghost-btn" href="#tax-office/client/${client.id}?tab=${row[1]}">打开</a></div>`).join("")}
    </div>
  </section>`;
}

function taxFeedbackPanel(client) {
  const issues = taxIssues.filter(issue => issue.clientId === client.id);
  return `
    <section class="card">
      <div class="section-title"><div><h2>问题反馈与审批</h2><p>所有问题都可以一键发回客户、标记已解决或审批通过。</p></div><button class="primary-btn tax-feedback-action">生成完整客户反馈</button></div>
      <div class="tax-feedback-list">${issues.map(issue => `<article class="tax-feedback-item">
        <div><span class="pill ${issue.level === "高" ? "red" : "orange"}">${issue.level}</span><strong>${issue.title}</strong><p>${issue.detail}</p></div>
        <div class="button-row"><button class="ghost-btn tax-feedback-action">查看</button><button class="ghost-btn tax-feedback-action">发给客户</button><button class="ghost-btn tax-feedback-action">标记已解决</button></div>
      </article>`).join("") || `<p>暂无需要反馈的问题。</p>`}</div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>AI 生成给客户的消息</h2><span class="pill purple">可编辑</span></div>
      <textarea class="tax-client-message">您好，${client.name} 6 月资料还有几项需要补充：1. 请确认账单或现金差异；2. 请补充对应 Z-Bon / Kassenbericht；3. 请确认员工 Urlaub 和工资资料。处理后我们就可以继续准备 DATEV。</textarea>
      <div class="button-row"><button class="primary-btn tax-feedback-action">发送给客户</button><button class="ghost-btn tax-feedback-action">保存草稿</button></div>
    </section>`;
}

function openingRouter(route) {
  if (route === "opening-add-supplier") return supplierAddPage("opening");
  if (route === "opening") return openingPage();
  const child = decodeURIComponent(route.replace("opening-", ""));
  const pages = {
    "开店总览": openingPage,
    "基础信息": openingBasicInfoPage,
    "开店采购清单": openingPurchasePage,
    "厨房设备清单": openingKitchenEquipmentPage,
    "供应商搭建": openingSuppliersPage,
    "政府流程": openingGovernmentPage,
    "餐厅许可详情": openingRestaurantPermitPage,
    "HACCP设置详情": openingHaccpSetupPage,
    "财务税务准备": openingFinancePrepPage,
    "同步公司信息详情": openingCompanySyncPage,
    "运营启动清单": openingOperationsPage,
    "员工招聘": openingHiringPage,
    "Handwerker联系人": openingHandwerkerContactsPage,
    "宣传推广": openingMarketingLaunchPage,
    "办理网络": openingInternetPackagesPage,
    "添加网络运营商": openingInternetProviderAddPage,
    "水电注册": openingUtilityRegistrationPage,
    "添加水电合同信息": openingUtilityContractAddPage
  };
  return (pages[child] || (() => placeholderPage("开店向导", child)))();
}

function dashboardPage() {
  return `
    <section class="hero">
      <h1>Guten Morgen, Martin! 👋</h1>
      <div class="hero-line">▣ 今天是 2025年5月24日，星期六</div>
      <div class="hero-line">您有 <strong>7</strong> 个待办事项需要处理</div>
    </section>
    ${dashboardKaiPanel()}
    ${dashboardShortcutBar()}
    <section class="dashboard-main-list" style="margin-top:22px">
      <div class="card dashboard-todos-card">
        <div class="dashboard-todos-head">
          <div>
            <h2>今日待办事项</h2>
            <p>优先处理采购、财务、门店和经营风险。</p>
          </div>
          <div class="dashboard-todos-summary">
            <span class="pill red">2 个高风险</span>
            <span class="pill orange">3 个今日到期</span>
            <a class="ghost-btn" href="#todos">查看全部 →</a>
          </div>
        </div>
        <div class="todo-list dashboard-todo-list">${todos.slice(0, 7).map(todoRow).join("")}</div>
      </div>
    </section>`;
}

function dashboardShortcutBar() {
  const shortcuts = [
    { label: "每日做账", href: `#${slug("finance", "每日 Abrechnung")}`, icon: `<img src="assets/menu-icons/finance.png" alt="">` },
    { label: "HACCP记录", href: `#${slug("store", "HACCP 管理")}`, icon: `<img src="assets/menu-icons/store.png" alt="">` },
    { label: "员工班表", href: `#${slug("employee", "排班管理")}`, icon: lucideUsersIcon() },
    { label: "单据上传", href: `#${slug("dashboard", "单据上传")}`, icon: lucideUploadIcon() },
    { label: "AI文件填写", href: `#${slug("admin", "文件填写与备档")}`, icon: lucideReceiptIcon() },
    { label: "任务管理", href: "#todos", icon: `<img src="assets/menu-icons/todos.png" alt="">` }
  ];
  return `
    <section class="dashboard-shortcuts">
      ${shortcuts.map(item=>`
        <a class="dashboard-shortcut" href="${item.href}">
          <span class="dashboard-shortcut-icon">${item.icon}</span>
          <strong>${item.label}</strong>
        </a>`).join("")}
    </section>`;
}

function documentUploadChoicePage() {
  const options = [
    {
      title: "订单",
      text: "查看采购订单、配送状态、校验结果和异常处理。",
      href: `#${slug("warehouse", "订单管理")}`,
      tag: "采购订单",
      button: "进入订单管理",
      icon: `<img src="assets/menu-icons/warehouse.png" alt="">`
    },
    {
      title: "运单",
      text: "上传 Lieferschein，并匹配采购订单、收货数量和账单记录。",
      href: `#${slug("warehouse", "运单 / 账单上传")}`,
      tag: "Lieferschein",
      button: "上传运单",
      icon: lucideUploadIcon()
    },
    {
      title: "账单上传",
      text: "上传 Rechnung、收据和外卖平台账单，AI 自动识别并检查合规性。",
      href: `#${slug("finance", "账单上传中心")}`,
      tag: "Rechnung",
      button: "上传账单",
      icon: `<img src="assets/menu-icons/finance.png" alt="">`
    }
  ];
  return `
    <div class="page-head">
      <div>
        <h1>单据上传</h1>
        <p>先选择要处理的单据类型，再进入对应的上传或管理流程。</p>
      </div>
    </div>
    <section class="grid grid-3 document-choice-grid">
      ${options.map(item=>`
        <a class="card document-choice-card" href="${item.href}">
          <div class="document-choice-top">
            <span class="document-choice-icon">${item.icon}</span>
            <span class="pill">${item.tag}</span>
          </div>
          <div>
            <h2>${item.title}</h2>
            <p>${item.text}</p>
          </div>
          <span class="primary-btn">${item.button} →</span>
        </a>`).join("")}
    </section>
    <section class="card document-choice-note">
      <h2>Kai 会自动帮您整理</h2>
      <p>订单用于跟踪采购进度；运单用于收货校验；账单用于财务识别、合规检查和对账。</p>
    </section>`;
}

function kaiQuestions() {
  return ["你建议我可以再上哪些菜品，并帮我分析毛利率", "我想找网红做推广，帮我询价", "对比附近的税务师 Angebot", "哪些商品最近涨价最多？", "本月有哪些门店任务没完成？"];
}

function dashboardKaiPanel() {
  return `
    <section class="card dashboard-kai-panel">
      <img class="dashboard-kai-figure" src="${kaiDashboardImg}" alt="Kai">
      <div class="dashboard-kai-intro">
        <div><strong>Kai</strong><p>您的智能秘书，可以直接帮您查经营、员工、账单和门店问题。</p></div>
      </div>
      <div class="dashboard-kai-chat">
        <input placeholder="Kai今天需要给你做什么？">
        <button class="primary-btn">发送</button>
      </div>
      <div class="dashboard-kai-questions">
        ${kaiQuestions().map(q=>`<button class="question">${q} ›</button>`).join("")}
      </div>
    </section>`;
}

function todoRow(t) {
  const icon = t.module.includes("仓库") ? "warehouse" : t.module.includes("财务") ? "finance" : t.module.includes("经营") ? "business" : "store";
  const riskClass = t.risk === "高风险" ? "red" : t.risk === "中风险" ? "orange" : "blue";
  return `
    <div class="todo-row">
      <div class="todo-icon"><img src="assets/menu-icons/${icon}.png" alt=""></div>
      <div class="todo-main">
        <strong>${t.title}</strong>
        <p>${t.type} · ${t.store}</p>
      </div>
      <div class="todo-status">
        <span class="pill purple">${t.module}</span>
        <span class="pill ${riskClass}">${t.risk}</span>
        <span class="pill red">${t.due}</span>
      </div>
      <button class="ghost-btn">去处理 →</button>
    </div>`;
}

function metric(label, value, tone = "purple") {
  return `<div class="card" style="box-shadow:none"><p>${label}</p><div class="metric-value">${value}</div><div class="spark"></div></div>`;
}

function todosPage() {
  return `
    <div class="page-head"><div><h1>待办事项</h1><p>集中处理采购、财务、门店与经营异常。</p></div></div>
    <div class="toolbar">${["全部", "仓库", "财务", "门店", "经营", "已过期", "今日到期", "本周到期"].map((f,i)=>`<button class="filter ${i===0?"active":""}">${f}</button>`).join("")}</div>
    <div class="card todo-table-card">
      <table class="table todo-table">
        <colgroup>
          <col class="todo-col-type">
          <col class="todo-col-title">
          <col class="todo-col-module">
          <col class="todo-col-store">
          <col class="todo-col-due">
          <col class="todo-col-risk">
          <col class="todo-col-status">
          <col class="todo-col-action">
        </colgroup>
        <thead><tr><th>任务类型</th><th>任务标题</th><th>来源模块</th><th>相关门店</th><th>截止日期</th><th>风险</th><th>处理程度</th><th>操作</th></tr></thead>
        <tbody>${todos.map(t => `
          <tr>
            <td>${t.type}</td><td><strong>${t.title}</strong></td><td>${t.module}</td><td>${t.store}</td>
            <td style="color:var(--red);font-weight:750">${t.due}</td>
            <td><span class="pill ${t.risk==="高风险"?"red":t.risk==="中风险"?"orange":"blue"}">${t.risk}</span></td>
            <td><span class="pill ${t.status==="已完成"?"green":"purple"}">${t.status}</span></td>
            <td><button class="ghost-btn">处理</button></td>
          </tr>`).join("")}</tbody>
      </table>
    </div>`;
}

function openingPage() {
  const de = currentLanguage() === "de";
  const copy = de ? {
    title: "Eröffnungsassistent",
    subtitle: "Bereiten Sie Ihre Eröffnung Schritt für Schritt vor. Kai begleitet Sie mit intelligenten Empfehlungen und Erinnerungen.",
    eta: "Geplante Eröffnung: in 35 Tagen",
    cards: [
      ["基础信息", "Basisdaten", "Persönliche Daten, Rechtsform, Adresse, Google Business Profile und Filialtyp", "Basisdaten ausfüllen", "purple", "1"],
      ["开店采购清单", "Einkaufsliste Eröffnung", "Küchengeräte, Renovierungsmaterial, Geschirr, Tische, Kasse usw.", "Einkaufsliste ansehen", "blue", "☑"],
      ["供应商搭建", "Lieferanten einrichten", "Erste Einkaufsempfehlungen nach Lieferanten aufteilen und Lieferanten direkt hinzufügen", "Einrichtung starten", "green", "▤"],
      ["政府流程", "Behördliche Prozesse", "Restaurantgenehmigung, HACCP, Gewerbeanmeldung, Ausschanklizenz, Mülltonnen usw.", "Prozesse ansehen", "orange", "⚖"],
      ["财务税务准备", "Finanz- und Steuervorbereitung", "Firmendaten synchronisieren, Steuerberater-Vollmacht und Steuernummer-Status verfolgen", "Vorbereitung starten", "purple", "€"],
      ["运营启动清单", "Betriebsstart-Checkliste", "Mitarbeitersuche, Werbung, Renovierung, Internet, Strom und Wasser", "Start-Checkliste ansehen", "blue", "↗"]
    ],
    finishTitle: "Eröffnungskonfiguration abschließen",
    finishText: "Nach der Vorbereitung können Sie in das operative Backend wechseln und Einkauf, Finanzen, Filialbetrieb und Geschäftsanalyse weiter verwalten.",
    finishButton: "Eröffnung abschließen und Unternehmensverwaltung öffnen →",
    devTitle: "Hinweis für Entwickler",
    devTag: "KI-Logik",
    devText: "Die Detail-Checklisten des Eröffnungsassistenten werden durch die Basisdaten gesteuert. Nach dem Hochladen von Filialtyp, Fläche, Sitzplätzen, Menü, Rechtsform und Adresse erstellt die KI Einkaufsliste, Lieferantenempfehlungen, Behördenprozesse, Finanz- und Steuervorbereitung sowie die Betriebsstart-Checkliste."
  } : {
    title: "开店向导",
    subtitle: "一步步完成开店准备，Kai 将全程为您提供智能建议和提醒。",
    eta: "预计开业：35天后",
    cards: [
      ["基础信息", "基础信息", "个人信息、法律形式、地址、Google 商家、店铺类型", "填写基础信息", "purple", "1"],
      ["开店采购清单", "开店采购清单", "厨房设备、装修材料、餐具、桌椅、Kasse 等", "查看采购清单", "blue", "☑"],
      ["供应商搭建", "供应商搭建", "按供应商拆分初始采购建议，可直接添加供应商", "开始搭建", "green", "▤"],
      ["政府流程", "政府流程", "餐厅许可、HACCP、商业注册、酒证、垃圾桶等", "查看流程", "orange", "⚖"],
      ["财务税务准备", "财务税务准备", "公司信息同步、税务师授权、税号进度跟进", "开始准备", "purple", "€"],
      ["运营启动清单", "运营启动清单", "员工招聘、宣传、装修、网络、水电等", "查看启动清单", "blue", "↗"]
    ],
    finishTitle: "完成开店配置",
    finishText: "开业准备完成后，可以切换到正式经营后台，继续管理采购、财务、门店运营和经营分析。",
    finishButton: "完成开店配置，进入企业管理模式 →",
    devTitle: "给开发者看的提示",
    devTag: "AI 生成逻辑",
    devText: "开店向导的详细清单由“基础信息”驱动：店铺类型、面积、座位数、菜单、法律形式、地址等信息上传后，AI 生成采购清单、供应商建议、政府流程、财务税务准备和运营启动清单。"
  };
  return `
    <div class="page-head">
      <div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div>
      <span class="pill purple">${copy.eta}</span>
    </div>
    <section class="grid grid-3" style="margin-top:18px">
      ${copy.cards.map(c=>`<a class="card module-card" href="#${slug("opening", c[0])}" style="text-decoration:none;color:inherit">
        <div class="iconbox ${c[4]}">${c[5]}</div>
        <h2>${c[1]}</h2>
        <p>${c[2]}</p>
        <span class="ghost-btn" style="margin-top:16px">${c[3]} →</span>
      </a>`).join("")}
    </section>
    <div class="card finish-card" style="margin-top:18px">
      <div>
        <h2>${copy.finishTitle}</h2>
        <p>${copy.finishText}</p>
      </div>
      <a class="primary-btn" href="#dashboard">${copy.finishButton}</a>
    </div>
    <div class="card" style="margin-top:18px">
      <div class="section-title"><h2>${copy.devTitle}</h2><span class="pill purple">${copy.devTag}</span></div>
      <p>${copy.devText}</p>
    </div>`;
}

function openingBasicInfoPage() {
  const sections = [
    {
      title: "个人信息",
      desc: "联系人姓名、手机号、邮箱、语言偏好，用于后续任务提醒和服务对接。",
      fields: [["联系人姓名", "Martin", true], ["手机号", "+49 ...", true], ["电子邮箱", "martin@example.com", true], ["语言偏好", "中文 / Deutsch / English", true]],
      unlocked: true
    },
    {
      title: "店铺类型",
      desc: "例如拉面店、啤酒花园、咖啡店、外卖店、连锁门店等。",
      fields: [["店铺类型", "拉面店", true], ["经营方式", "堂食 / 外卖 / 酒水 / 连锁", true], ["厨房类型", "热厨 / 冷厨 / 吧台", true]],
      unlocked: true
    },
    {
      title: "菜单和主要菜品",
      desc: "上传菜单或填写主打菜，用于 AI 生成设备、原材料、供应商和过敏原清单。",
      fields: [["主打菜品", "牛肉拉面、鸡肉拉面、煎饺", true], ["菜单文件", "上传 PDF / 图片 / Excel"], ["饮品类别", "啤酒 / 软饮 / 咖啡 / 茶 / 酒水", true]],
      unlocked: true
    },
    {
      title: "法律形式与注册地址",
      desc: "先选择法律形式，再填写公司或个人名字和注册地址。",
      fields: [["法律形式", "请选择法律形式", true, ["Einzelunternehmen", "UG", "KG", "GbR", "GmbH"]], ["公司或个人名字", "请输入公司名或个人姓名", true], ["注册地址", "请输入街道和门牌号", true], ["邮编", "例如 44135", true], ["城市", "Dortmund", true]],
      offer: "没有头绪？点击查看附近 Notar Angebot，并自动询价",
      locked: true
    },
    {
      title: "店铺面积",
      desc: "厨房、前厅、仓储面积，用于设备、桌椅、动线和预算估算。",
      fields: [["总面积", "120㎡"], ["厨房面积", "例如 35㎡"], ["仓储面积", "例如 12㎡"], ["户外面积", "如有请填写"]],
      locked: true
    },
    {
      title: "预计座位数",
      desc: "用于估算桌椅、餐具、员工、Kasse 和初始库存规模。",
      fields: [["室内座位", "80"], ["户外座位", "如有请填写"]],
      locked: true
    },
    {
      title: "Google 商家",
      desc: "填写或创建 Google Business Profile，后续连接评论、营业时间和地图展示。",
      fields: [["Google 商家链接", "https://..."], ["营业时间", "例如 11:30-22:00"], ["是否需要创建", "已创建 / 需要创建"]],
      locked: true,
      wide: true
    }
  ];
  return detailPage("基础信息", "先把开店项目的核心信息补齐，后续 AI 才能生成准确的采购、供应商、政府流程和预算建议。", `
    <div class="card unlock-note"><strong>填写顺序：</strong>请先完成个人信息、店铺类型、菜单和主要菜品。完成前三项后，将解锁法律形式、店铺面积、预计座位数和 Google 商家。</div>
    <section class="grid grid-2">
      ${sections.map((section,index)=>`<div class="card form-card ${section.locked ? "locked-card" : ""} ${section.wide ? "wide-card" : ""}">
        <div class="section-title numbered-title">
          <div class="numbered-heading"><span class="step-number">${index + 1}</span><h2>${section.title}</h2></div>
          <span class="pill ${section.locked ? "orange" : "green"}">${section.locked ? "未解锁" : "可填写"}</span>
        </div>
        <p>${section.desc}</p>
        <div class="mini-form">
          ${section.fields.map(field=>`<label><span>${field[0]}${field[2] ? `<em class="required-mark">*</em>` : ""}</span>${Array.isArray(field[3]) ? `<select ${section.locked ? "disabled" : ""}><option>${field[1]}</option>${field[3].map(option=>`<option>${option}</option>`).join("")}</select>` : `<input ${section.locked ? "disabled" : ""} placeholder="${field[1]}">`}</label>`).join("")}
        </div>
        ${section.offer ? `<button class="ghost-btn offer-btn">${section.offer}</button>` : ""}
        ${section.locked ? `<div class="lock-overlay">完成前三项后解锁</div>` : ""}
      </div>`).join("")}
    </section>
    <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px">
      <button class="ghost-btn">保存草稿</button>
      <button class="primary-btn">保存基础信息，并生成下一步 →</button>
    </div>
  `);
}

function openingPurchasePage() {
  const groups = [
    ["厨房设备及用品", "炉灶、冰箱、冷冻柜、洗碗机、制冰机、锅具、刀具、GN 盒、厨房小工具，以及可租用设备。"],
    ["装修材料", "地面、墙面、灯光、厨房防滑、防火材料、吧台和后厨改造材料。"],
    ["装饰品", "店内装饰、绿植、墙面元素、门店氛围物料。"],
    ["餐具", "碗、盘、杯、筷子、刀叉、托盘、儿童餐具。"],
    ["桌椅", "餐桌、餐椅、户外座椅、吧台椅、备件。"],
    ["招牌和招牌许可", "门头、灯箱、菜单板、户外展示牌，以及招牌许可办理。"],
    ["监控安防设备", "摄像头、门禁、报警器、监控硬盘、网络录像机和基础安防布线。"],
    ["Kasse", "收银机、打印机、钱箱、扫码设备、POS 连接。"]
  ];
  return detailPage("开店采购清单", "通过上传的基础信息连接 AI，为新店生成第一套开店采购清单。", `
    <div class="card red-zone"><h2>给开发者看的提示</h2><p>用户上传基础信息后，AI 根据店铺类型、面积、座位数、菜单和预算，自动生成厨房设备、装修、餐具、桌椅、招牌、Kasse 等采购清单，并可转入供应商询价或下单流程。</p></div>
    <section class="grid grid-3" style="margin-top:14px">${groups.map(g=>`<div class="card"><h2>${g[0]}</h2><p>${g[1]}</p><div class="button-row">${g[0] === "Kasse" ? `<button class="ghost-btn">填写 Kasse 信息</button><button class="primary-btn">AI 匹配推荐</button>` : g[0] === "厨房设备及用品" ? `<a class="ghost-btn" href="#${slug("opening", "厨房设备清单")}">上传清单</a><button class="primary-btn">AI 匹配供应商</button>` : `<button class="ghost-btn">上传清单</button><button class="primary-btn">AI 匹配供应商</button>`}</div></div>`).join("")}</section>
  `);
}

function openingKitchenEquipmentPage() {
  const equipment = [
    ["四眼燃气炉", "2台", "厨房主线", "€2,480", "待采购", "待上传账单", "暂无账单"],
    ["双门冷藏柜", "1台", "冷藏区", "€1,860", "完成", "账单已识别", "下载账单"],
    ["洗碗机", "1台", "后厨清洗区", "€3,200", "待传账单", "待确认型号", "下载 Angebot"],
    ["制冰机", "1台", "吧台", "€980", "待采购", "待添加供应商", "暂无账单"]
  ];
  return detailPage("厨房设备清单", "上传厨房设备清单后，Kai 会生成设备列表，并支持继续上传账单、补充设备名和关键资料。", `
    <section class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>上传原始清单</h2><span class="pill purple">AI 生成</span></div>
        <div class="upload">上传厨房设备清单 / PDF / Excel / 图片<br><span class="small">自动生成设备名称、数量、区域和预算建议</span></div>
      </div>
      <div class="card">
        <div class="section-title"><h2>设备账单上传</h2><span class="pill green">资料库</span></div>
        <div class="upload">上传设备账单 / Angebot / 合同<br><span class="small">自动关联设备名、价格、供应商和保修资料</span></div>
      </div>
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>生成的设备清单</h2><span class="pill blue">4 项示例</span></div>
      <table class="table">
        <thead><tr><th>设备名</th><th>数量</th><th>区域</th><th>预估金额</th><th>清单状态</th><th>账单状态</th><th>账单下载</th></tr></thead>
        <tbody>${equipment.map(row=>`<tr><td>${row[0]}</td><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td><td><span class="pill ${row[4] === "完成" ? "green" : row[4] === "待传账单" ? "orange" : "blue"}">${row[4]}</span></td><td>${row[5]}</td><td>${row[6] === "暂无账单" ? `<span class="small">${row[6]}</span>` : `<button class="ghost-btn">${row[6]}</button>`}</td></tr>`).join("")}</tbody>
      </table>
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>补充设备信息</h2><span class="pill red">可手动添加</span></div>
      <div class="form-grid">
        ${field("设备名称", "例如：燃气炉 / 冷藏柜 / 制冰机")}
        ${field("数量", "1台 / 2台")}
        ${field("品牌 / 型号", "例如：Rational / Winterhalter")}
        ${field("供应商", "Metro / 专业设备商")}
        ${field("放置区域", "厨房主线 / 吧台 / 清洗区")}
        ${field("购买金额", "€0.00")}
        ${field("保修期限", "12个月 / 24个月")}
        ${field("备注", "安装、租赁、维护说明")}
      </div>
      <button class="primary-btn" style="margin-top:14px">添加到设备清单</button>
    </section>
  `, openingBackButton("返回开店采购清单", "开店采购清单"));
}

function openingSuppliersPage() {
  const rows = [
    ["Metro Deutschland", "基础食材、饮料、清洁用品、部分厨房耗材", "添加供应商"],
    ["Transgourmet Deutschland", "大宗食材、冷冻品、干货、饮料配送", "添加供应商"],
    ["JFC Deutschland", "亚洲调料、米面、日式/亚洲食品、冷冻品", "添加供应商"],
    ["ille", "卫生纸、洗手液、纸巾、香氛设备和卫生间耗材服务", "添加供应商"]
  ];
  const sponsors = [
    ["Coca Cola", "饮料冰柜、可乐 / Fanta / Sprite 供货、开业物料和活动支持。"],
    ["Bitburger Brauerei", "啤酒供货、杯具、户外伞、桌牌和本地餐饮赞助合作。"],
    ["Tchibo Coffee Service", "咖啡豆、咖啡机租赁、磨豆机、杯具、开业试饮和咖啡菜单支持。"]
  ];
  return detailPage("供应商搭建", "按开店采购需求拆分供应商，每个供应商对应建议采购品类，可直接添加或新增其他供应商。", `
    <section class="grid grid-2">${rows.map(r=>`<div class="card"><div class="section-title"><h2>${r[0]}</h2><span class="pill blue">推荐</span></div><p>${r[1]}</p><a class="primary-btn" href="#opening-add-supplier" style="margin-top:14px">${r[2]} →</a></div>`).join("")}</section>
    <a class="card add-dashed" href="#opening-add-supplier" style="margin-top:14px;min-height:120px;text-decoration:none;color:inherit"><h2>+ 手动添加其他供应商</h2><p>适用于本地肉铺、蔬菜商、饮料商、清洁公司、包装供应商等。</p></a>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>附近赞助商推荐</h2><span class="pill purple">可一键联络</span></div>
      <div class="grid grid-2">
        ${sponsors.map(s=>`<div class="card" style="box-shadow:none"><div class="section-title"><h2>${s[0]}</h2><span class="pill green">赞助商</span></div><p>${s[1]}</p><div class="button-row"><button class="primary-btn">一键联络</button><button class="ghost-btn">查看合作条件</button></div></div>`).join("")}
      </div>
    </section>
  `);
}

function openingGovernmentPage() {
  const steps = [
    ["餐厅许可", "整理所需许可、图纸、负责人资料和提交窗口。", "餐厅许可详情"],
    ["HACCP 设置", "害虫防治表、冰箱温度表、店铺清洁表和服务商 Angebot。", "HACCP设置详情"],
    ["商业注册", "Gewerbeanmeldung 资料准备、预约和提交状态跟进。", ""],
    ["酒证办理", "如销售酒精，准备负责人资料、店铺信息和申请流程。", ""],
    ["定垃圾桶", "根据店铺类型和城市规则，安排 Restmüll、Bio、Papier、Gelber Sack 等。", ""]
  ];
  return detailPage("政府流程", "把开业前许可、卫生、HACCP、注册和城市流程拆成可执行步骤。", `
    <section class="grid grid-3">${steps.map(s=>`<div class="card"><h2>${s[0]}</h2><p>${s[1]}</p>${s[2] ? `<a class="ghost-btn" href="#${slug("opening", s[2])}" style="margin-top:12px">进入详情</a>` : `<button class="ghost-btn" style="margin-top:12px">进入详情</button>`}</div>`).join("")}</section>
  `);
}

function openingRestaurantPermitPage() {
  return detailPage("餐厅许可", "先确认是否已有餐厅相关许可；如果没有，Kai 会按本市流程引导准备资料和对接服务商。", `
    <section class="grid grid-2">
      <div class="card"><h2>目前是否已经有许可？</h2><p>用于判断是进入资料补全，还是启动完整申请向导。</p><div class="button-row"><button class="primary-btn">已有许可</button><button class="ghost-btn">没有许可，开始 AI 向导</button></div></div>
      <div class="card"><h2>AI 申请向导</h2><p>如果客人选择没有许可，系统会生成 Bauamt / Baugenehmigung 申请步骤、所需图纸、负责人资料和提交窗口。</p><span class="pill purple" style="margin-top:12px">Dortmund 本市流程</span></div>
    </section>
    <section class="grid grid-3" style="margin-top:14px">
      <div class="card"><h2>本市建筑师推荐</h2><p>用于图纸、用途变更、厨房/排烟/消防相关资料准备。</p><button class="ghost-btn" style="margin-top:12px">查看附近 Angebot</button></div>
      <div class="card"><h2>消防服务推荐</h2><p>消防资料、逃生路线、灭火器配置和现场检查准备。</p><button class="ghost-btn" style="margin-top:12px">查看附近 Angebot</button></div>
      <div class="card"><h2>Bauamt / Baugenehmigung</h2><p>整理申请入口、预约、材料清单和提交状态。</p><button class="ghost-btn" style="margin-top:12px">生成申请清单</button></div>
    </section>
  `, `<a class="ghost-btn accent-back-btn" href="#${slug("opening", "政府流程")}">返回政府流程</a>`);
}

function openingHaccpSetupPage() {
  return detailPage("HACCP 设置", "进入开业前 HACCP 表单和服务商配置，先建立害虫防治、温度记录和清洁任务。", `
    <section class="grid grid-2">
      <div class="card"><h2>害虫防治表</h2><p>记录检查日期、点位、发现问题、整改和下次检查。</p><button class="ghost-btn" style="margin-top:12px">设置表单</button></div>
      <div class="card"><h2>冰箱温度表</h2><p>设置冷藏、冷冻设备温度记录频率和负责人。</p><button class="ghost-btn" style="margin-top:12px">设置表单</button></div>
      <div class="card"><h2>店铺清洁表</h2><p>设置每日、每周、每月清洁任务和负责人确认。</p><button class="ghost-btn" style="margin-top:12px">设置表单</button></div>
      <div class="card"><h2>害虫防治公司</h2><p>可手动添加服务商，也可以查看附近 Angebot 并自动询价。</p><div class="button-row"><button class="ghost-btn">添加公司</button><button class="primary-btn">查看附近 Angebot</button></div></div>
    </section>
  `, openingBackButton("返回政府流程", "政府流程"));
}

function openingFinancePrepPage() {
  const de = currentLanguage() === "de";
  const title = de ? "Steuerservice" : "税务服务";
  const subtitle = de
    ? "KaiSpan unterstützt Sie gemeinsam mit Steuerberatern bei Steuerregistrierung, Steuernummer, Lohnsteuerregistrierung und laufenden Meldungen."
    : "KaiSpan 与税务师共同为您完成税务注册、税号申请、工资税登记及后续申报服务。";
  const externalAdvisor = de ? "+ Externen Steuerberater hinzufügen" : "+ 添加外部税务师";
  return detailPage(title, subtitle, `
    ${taxAdvisorAd()}
    <div class="opening-tax-actions"><button class="ghost-btn tiny-btn">${externalAdvisor}</button></div>
  `);
}

function openingCompanySyncPage() {
  const fields = [
    ["公司名称", "Martin Biergarten GmbH"],
    ["法律形式", "GmbH / UG / Einzelunternehmen"],
    ["注册地址", "请输入注册地址"],
    ["银行账户 IBAN", "DE..."],
    ["联系人姓名", "Martin"],
    ["联系人邮箱", "martin@example.com"],
    ["联系电话", "+49 ..."]
  ];
  return detailPage("同步公司信息", "填写公司、法律形式、地址、银行账户和联系人信息；也可以一键同步前面基础信息里已经填写的内容。", `
    <div class="card finish-card"><div><h2>一键同步基础信息</h2><p>从基础信息页同步公司或个人名字、法律形式、注册地址、联系人、邮箱和电话。</p></div><button class="primary-btn">一键同步之前填写的内容</button></div>
    <section class="grid grid-2" style="margin-top:14px">${fields.map(f=>`<div class="card"><div class="field"><label>${f[0]}</label><input placeholder="${f[1]}"></div></div>`).join("")}</section>
    <div style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px"><button class="ghost-btn">保存草稿</button><button class="primary-btn">保存到财务资料包 →</button></div>
  `, openingBackButton("返回财务税务准备", "财务税务准备"));
}

function openingOperationsPage() {
  const items = [
    "员工招聘",
    "宣传推广：本地网红、Google、Instagram、开业活动",
    "水工、电工、维修联系人信息备档",
    "打印菜单及海报",
    "办理网络",
    "装修方案",
    "租房流程和交接事项",
    "过敏原表上传",
    "水电注册"
  ];
  return detailPage("运营启动清单", "开业前最后一段时间需要集中推进的运营、宣传、装修、人员和基础设施任务。", `
    <section class="grid grid-2">${items.map((item,index)=>{
      const card = `<div class="section-title"><h2>${item}</h2><span class="pill ${index < 3 ? "red" : "blue"}">${index < 3 ? "优先" : "计划中"}</span></div>`;
      if (item === "打印菜单及海报" || item === "装修方案" || item === "租房流程和交接事项" || item === "过敏原表上传") {
        const uploadText = item === "打印菜单及海报"
          ? ["上传菜单 / 海报文件", "PDF / 图片 / AI / Excel"]
          : item === "装修方案"
            ? ["上传装修方案", "PDF / 图片 / CAD / Angebot"]
            : item === "租房流程和交接事项"
              ? ["上传 Protokoll", "Übergabeprotokoll / Mietvertrag / PDF"]
              : ["上传过敏原资料", "菜单 / 配方 / Excel / PDF"];
        return `<div class="card operation-upload-card">
          <div class="section-title"><h2>${item}</h2><span class="pill blue">计划中</span></div>
          <div class="inline-upload">${uploadText[0]}<br><span class="small">${uploadText[1]}</span></div>
        </div>`;
      }
      const routeMap = {
        "员工招聘": "员工招聘",
        "宣传推广：本地网红、Google、Instagram、开业活动": "宣传推广",
        "水工、电工、维修联系人信息备档": "Handwerker联系人",
        "办理网络": "办理网络",
        "水电注册": "水电注册"
      };
      return routeMap[item]
        ? `<a class="card" href="#${slug("opening", routeMap[item])}" style="text-decoration:none;color:inherit">${card}</a>`
        : `<div class="card">${card}</div>`;
    }).join("")}</section>
  `);
}

function openingMarketingLaunchPage() {
  const cities = ["Dortmund", "Düsseldorf", "Duisburg", "Dresden", "Bonn", "Bochum", "Berlin", "Bremen", "Köln", "Essen", "Frankfurt am Main", "Hamburg", "München", "Stuttgart", "Hannover", "Leipzig", "Nürnberg"];
  const influencerOffers = [
    ["Ruhr Foodie Lina", "TikTok / Instagram", "Dortmund · 38k followers", "主打 Ruhrgebiet 餐饮探店，短视频节奏快，适合开业排队氛围。", "Reel + Story + TikTok：€480，含 1 次到店拍摄与 7 天使用权"],
    ["Dortmund Eats Guide", "Instagram", "Dortmund · 22k followers", "本地学生与白领粉丝多，适合午餐套餐和开业 Gutschein。", "Post + 3 Stories：€320，含抽奖活动设计"]
  ];
  const channels = [
    ["Instagram / Facebook 赞助推广", "Meta Ads", "覆盖 Dortmund、Bochum、Essen 18-45 岁餐饮兴趣人群。", "开业 10 天预算 €350，预计触达 18k-32k 人"],
    ["Google 赞助推广", "Google Ads", "投放 Restaurant, Ramen, Biergarten, Mittagessen Dortmund 等关键词。", "搜索 + Maps 广告 €420，预计 210-360 次路线/电话动作"],
    ["当地宣传屏幕", "DOOH / City Screen", "Dortmund Hbf、Innenstadt、大学周边电子屏曝光。", "7 天屏幕轮播 €690，含 15 秒素材制作调整"]
  ];
  return detailPage("宣传推广方案", "选择推广城市后，Kai 会生成本地网红、社媒广告、Google 广告和线下屏幕推广建议。", `
    <section class="card">
      <div class="section-title"><h2>选择推广城市</h2><span class="pill red">可多选</span></div>
      <div class="marketing-city-panel">
        <div class="field">
          <label>城市检索</label>
          <input list="germanCityList" value="do" placeholder="输入城市，例如 do">
          <datalist id="germanCityList">${cities.map(city=>`<option value="${city}"></option>`).join("")}</datalist>
        </div>
        <div class="city-suggestion"><strong>Dortmund</strong><span class="pill green">匹配 do</span><button class="ghost-btn">选择城市</button></div>
        <div class="selected-city-row"><span class="pill purple">Dortmund ×</span><span class="pill blue">Bochum ×</span><span class="pill blue">Essen ×</span></div>
        <button class="primary-btn">一键生成推广方案</button>
      </div>
    </section>
    <section class="grid grid-2" style="margin-top:14px">
      <div class="card">
        <div class="section-title"><h2>1. TikTok / Instagram 网红匹配</h2><span class="pill purple">2 个 Angebot</span></div>
        ${influencerOffers.map(offer=>`<div class="marketing-offer">
          <strong>${offer[0]}</strong><span>${offer[1]} · ${offer[2]}</span>
          <p>${offer[3]}</p>
          <div class="angebot-box">${offer[4]}</div>
          <button class="primary-btn">一键联络寻求 Angebot</button>
        </div>`).join("")}
      </div>
      ${channels.map((channel,index)=>`<div class="card">
        <div class="section-title"><h2>${index + 2}. ${channel[0]}</h2><span class="pill blue">${channel[1]}</span></div>
        <p>${channel[2]}</p>
        <div class="angebot-box">${channel[3]}</div>
        <div class="button-row"><button class="primary-btn">生成投放计划</button><button class="ghost-btn">查看 Beispiel Angebot</button></div>
      </div>`).join("")}
    </section>
  `, openingBackButton("返回运营启动清单", "运营启动清单"));
}

function openingInternetPackagesPage() {
  const plans = [
    ["Telekom Business Glasfaser", "500 Mbit/s", "固定公网 IP 可选，适合 POS、监控和 Gäste-WLAN。", "€69.95 / 月", "推荐"],
    ["Vodafone Business Cable", "1000 Mbit/s", "适合门店高峰期点餐系统、外卖平台和办公设备。", "€59.99 / 月", "高速"],
    ["1&1 Business DSL", "250 Mbit/s", "适合小型门店，合同灵活，可作为备用网络。", "€39.99 / 月", "经济"]
  ];
  return detailPage("办理网络", "为新店选择网络套餐，记录合同、安装时间、路由器和紧急联系方式。", `
    <div class="button-row" style="margin:0 0 14px">
      <a class="primary-btn" href="#${slug("opening", "添加网络运营商")}">+ 添加网络运营商</a>
    </div>
    <section class="grid grid-3">
      ${plans.map(plan=>`<div class="card">
        <div class="section-title"><h2>${plan[0]}</h2><span class="pill blue">${plan[4]}</span></div>
        <p>${plan[2]}</p>
        <div class="metric-value" style="font-size:24px;margin-top:12px">${plan[1]}</div>
        <p style="margin-top:6px">${plan[3]}</p>
        <div class="button-row"><button class="primary-btn">选择套餐</button><button class="ghost-btn">查看合同条件</button></div>
      </div>`).join("")}
    </section>
  `, openingBackButton("返回运营启动清单", "运营启动清单"));
}

function openingInternetProviderAddPage() {
  return detailPage("添加网络运营商", "填写网络运营商、套餐、安装安排和合同资料，方便开业前统一跟进。", `
    <section class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>运营商与套餐信息</h2><span class="pill red">必填</span></div>
        <div class="form-grid">
          ${field("运营商名称", "Telekom / Vodafone / 1&1")}
          ${field("套餐名称", "Business Glasfaser 500")}
          ${field("网速", "500 Mbit/s / 1000 Mbit/s")}
          ${field("月费", "€69.95")}
          ${field("合同期限", "24 个月 / 12 个月")}
          ${field("安装地址", "门店地址")}
        </div>
      </div>
      <div class="card">
        <div class="section-title"><h2>安装与联系人</h2><span class="pill blue">跟进</span></div>
        <div class="form-grid">
          ${field("安装日期", "YYYY-MM-DD")}
          ${field("技术员 / Ansprechpartner", "请输入联系人")}
          ${field("联系电话", "+49 ...")}
          ${field("客户号 / Vertragsnummer", "请输入编号")}
          ${field("路由器型号", "FritzBox / Speedport")}
          ${field("备注", "固定 IP、Gäste-WLAN、备用网络等")}
        </div>
      </div>
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>合同与文件上传</h2><span class="pill green">资料库</span></div>
      <div class="grid grid-3">
        <div class="upload">上传网络合同 PDF</div>
        <div class="upload">上传安装确认 / Terminbestätigung</div>
        <div class="upload">上传路由器或设备照片</div>
      </div>
      <button class="primary-btn" style="margin-top:14px">保存网络运营商</button>
    </section>
  `, openingBackButton("返回办理网络", "办理网络"));
}

function openingUtilityRegistrationPage() {
  const offers = [
    ["Stadtwerke Dortmund Gastro Strom", "电", "固定 24 个月，适合厨房设备和高峰营业用电。", "约 €0.31 / kWh · Grundpreis €18/月", "预计年用电 42,000 kWh"],
    ["DEW21 Gas & Wasser Business", "水 / 气", "水表登记、热水与燃气联动，适合餐饮厨房。", "水费按表结算 · Gas 约 €0.095 / kWh", "含 Abschlag 建议"],
    ["Vattenfall Gewerbe Ökostrom", "电", "绿色电力，可用于品牌宣传和 ESG 展示。", "约 €0.33 / kWh · 12 个月起", "适合小型门店"]
  ];
  return detailPage("水电注册", "为新店匹配电、水、气合同 Angebot，并记录表号、供应商、合同和 Abschlag 信息。", `
    <div class="button-row" style="margin:0 0 14px">
      <a class="primary-btn" href="#${slug("opening", "添加水电合同信息")}">+ 添加合同信息</a>
    </div>
    <section class="grid grid-3">
      ${offers.map(offer=>`<div class="card">
        <div class="section-title"><h2>${offer[0]}</h2><span class="pill blue">${offer[1]}</span></div>
        <p>${offer[2]}</p>
        <div class="angebot-box" style="margin-top:12px">${offer[3]}</div>
        <p style="margin-top:10px">${offer[4]}</p>
        <div class="button-row"><button class="primary-btn">选择 Angebot</button><button class="ghost-btn">查看详情</button></div>
      </div>`).join("")}
    </section>
  `, openingBackButton("返回运营启动清单", "运营启动清单"));
}

function openingUtilityContractAddPage() {
  return detailPage("添加水电合同信息", "上传水电合同后，Kai 自动识别供应商、表号、合同期限、价格和 Abschlag；下方字段可手动修改。", `
    <section class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>上传合同</h2><span class="pill purple">AI 识别</span></div>
        <div class="upload" style="min-height:160px">上传水电合同 PDF / 图片<br><span class="small">支持 Strom、Wasser、Gas 合同与 Abschlag 通知</span></div>
      </div>
      <div class="card">
        <div class="section-title"><h2>自动识别结果</h2><span class="pill green">已识别</span></div>
        ${[
          ["供应商", "DEW21"],
          ["合同类型", "Strom + Wasser"],
          ["客户号", "KD-2025-0842"],
          ["电表号 / 水表号", "ST-88219 / WA-39402"],
          ["合同开始", "2025-06-01"],
          ["月度 Abschlag", "€420.00"]
        ].map(row=>`<div class="status-line"><span>${row[0]}</span><strong>${row[1]}</strong></div>`).join("")}
      </div>
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>德国水电气合同收费条款检查</h2><span class="pill purple">费用计算</span></div>
      <section class="grid grid-2">
        ${[
          ["Arbeitspreis / Verbrauchspreis", "按用量计算：kWh × ct/kWh；水通常 m³ × €/m³。"],
          ["Grundpreis / Grundgebühr", "固定费用：€/月或 €/年，通常按天折算到账单周期。"],
          ["Abschlag", "预付款：预计年费用 ÷ 12；年终按真实表读数结算，多退少补。"],
          ["Netzentgelte", "电/气网络使用费，常包含在单价中；企业合同有时单独列出。"],
          ["Messstellenbetrieb / Zählerkosten", "电表/气表/水表的计量、读数、设备运营费用。"],
          ["Konzessionsabgabe", "市政道路管线使用费，按 kWh 或合同类型计入价格。"],
          ["Stromsteuer / Energiesteuer", "电税、天然气能源税，通常随每 kWh 消耗计入。"],
          ["Umlagen / CO2-Kosten", "电可能有 KWKG、§19、Offshore 等 Umlage；气可能含 CO2 成本。"],
          ["Leistungspreis", "大用量/RLM 合同可能按峰值功率 kW × €/kW/年收费。"],
          ["Wasser / Abwasser", "水费按 m³；污水常按 m³，雨水按封闭/硬化面积 m²。"],
          ["MwSt.", "电/气一般 19%；饮用水常见 7%；污水多为市政 Gebühren。"],
          ["合同条款", "检查 Laufzeit、Kündigungsfrist、Preisgarantie、自动续约和 Sonderkündigung。"]
        ].map(row=>`<div class="status-line"><span>${row[0]}</span><strong>${row[1]}</strong></div>`).join("")}
      </section>
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>手动修改重要信息</h2><span class="pill blue">可编辑</span></div>
      <div class="form-grid">
        ${field("供应商名称", "DEW21 / Stadtwerke / Vattenfall")}
        ${field("合同类型", "电 / 水 / 气")}
        ${field("客户号", "请输入 Kundennummer")}
        ${field("表号", "请输入 Zählernummer")}
        ${field("合同开始日期", "YYYY-MM-DD")}
        ${field("合同期限", "12 / 24 个月")}
        ${field("单价", "€/kWh 或水费单价")}
        ${field("月度 Abschlag", "€0.00")}
        ${field("Grundpreis / Grundgebühr", "€/月 或 €/年")}
        ${field("Netzentgelt / Messstellenbetrieb", "如合同单独列出请填写")}
        ${field("Steuern / Umlagen / CO2", "Stromsteuer、CO2、Umlage 等")}
        ${field("Kündigungsfrist / Preisgarantie", "例如 1 Monat / 12 Monate Preisgarantie")}
      </div>
      <button class="primary-btn" style="margin-top:14px">保存合同信息</button>
    </section>
  `, openingBackButton("返回水电注册", "水电注册"));
}

function openingHandwerkerContactsPage() {
  const contacts = [
    ["水工", "Rohr & Sanitär Dortmund GmbH", "Herr Klein", "+49 231 456 780", "紧急漏水、厨房给排水、洗碗机接水", "Dortmund / Bochum"],
    ["电工", "Elektro Weber Service", "Frau Weber", "+49 231 892 114", "配电箱、Kasse 电源、照明、厨房设备接电", "Dortmund Innenstadt"]
  ];
  const trades = ["水工 / Sanitär", "电工 / Elektriker", "维修 / Reparatur", "装修 / Renovierung", "厨房设备维修", "制冷设备 / Kühltechnik", "暖气 / Heizung", "消防 / Brandschutz", "害虫防治 / Schädlingsbekämpfung", "清洁公司 / Reinigung", "锁匠 / Schlüsseldienst", "网络与监控 / IT & Kamera", "垃圾处理 / Entsorgung", "其他 Handwerker"];
  return detailPage("Handwerker 联系人信息", "整合水工、电工、维修等开业前常用联系人，后续可同步到企业通讯录。", `
    <section class="grid grid-2">
      ${contacts.map(c=>`<div class="card contact-card">
        <div class="section-title"><h2>${c[1]}</h2><span class="pill blue">${c[0]}</span></div>
        <strong>${c[2]}</strong>
        <p>${c[4]}</p>
        <p>${c[5]} · ${c[3]}</p>
        <div class="button-row"><button class="ghost-btn">拨打</button><button class="ghost-btn">编辑</button></div>
      </div>`).join("")}
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>添加 Handwerker 联系人</h2><span class="pill red">工种必选</span></div>
      <div class="form-grid">
        <div class="field"><label>工种 <em class="required-mark">*</em></label><select><option>请选择工种</option>${trades.map(trade=>`<option>${trade}</option>`).join("")}</select></div>
        ${field("检索", "输入公司名、工种或城市，例如 Elektriker Dortmund")}
        ${field("公司 / 联系人名称", "请输入名称")}
        ${field("联系人", "请输入联系人姓名")}
        ${field("电话", "+49 ...")}
        ${field("邮箱", "email@example.com")}
        ${field("城市 / 服务区域", "Dortmund / Essen / Bochum")}
        ${field("备注", "服务范围、报价、紧急联系时间")}
      </div>
      <button class="primary-btn" style="margin-top:14px">添加到联系人信息</button>
    </section>
  `, openingBackButton("返回运营启动清单", "运营启动清单"));
}

function openingHiringPage() {
  const archiveChecks = ["员工基础信息已填写", "合同类型已确认", "必要证件已上传", "联系方式已备档", "入职前任务已生成"];
  return detailPage("员工招聘", "填写新员工基础信息，并把合同、证件和联系方式直接备档到开店资料库。", `
    <section class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>员工基础信息</h2><span class="pill red">必填</span></div>
        <div class="form-grid">
          ${field("员工姓名", "请输入姓名")}
          ${field("手机号", "+49 ...")}
          ${field("电子邮箱", "email@example.com")}
          ${field("岗位", "厨师 / 服务员 / 店长 / 清洁")}
          ${field("合同类型", "Minijob / Teilzeit / Vollzeit")}
          ${field("预计入职日期", "YYYY-MM-DD")}
          ${field("所属门店", "Dortmund 新店")}
          ${field("紧急联系人", "姓名 + 电话")}
        </div>
        <button class="primary-btn" style="margin-top:14px">保存员工基础信息</button>
      </div>
      <div class="card">
        <div class="section-title"><h2>文件备档</h2><span class="pill blue">资料库</span></div>
        <div class="grid grid-2">
          <div class="upload">上传 Arbeitsvertrag</div>
          <div class="upload">上传 Steuer-ID</div>
          <div class="upload">上传 Sozialversicherung</div>
          <div class="upload">上传 Belehrung / 证件</div>
        </div>
      </div>
    </section>
    <section class="grid grid-2" style="margin-top:14px">
      <div class="card">
        <div class="section-title"><h2>备档确认</h2><span class="pill green">可同步</span></div>
        ${archiveChecks.map(x=>`<label class="check"><input type="checkbox"> ${x}</label>`).join("")}
        <button class="primary-btn" style="margin-top:12px">确认备档，并同步到员工管理</button>
      </div>
      <div class="card">
        <div class="section-title"><h2>入职前任务</h2><span class="pill blue">自动生成</span></div>
        ${["安排试工时间", "发送入职资料清单", "准备员工账号", "加入排班候选名单"].map(x=>`<div class="status-line">${x}<span class="pill blue">待办</span></div>`).join("")}
      </div>
    </section>
  `, openingBackButton("返回运营启动清单", "运营启动清单"));
}

function detailPage(title, subtitle, content, action = "") {
  return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>${content}`;
}

function openingBackButton(label = "返回开店向导", target = "") {
  return `<a class="ghost-btn accent-back-btn" href="#${target ? slug("opening", target) : "opening"}">${label}</a>`;
}

function warehouseBackButton(label = "返回仓库管理助手") {
  return `<a class="ghost-btn accent-back-btn" href="#warehouse">${label}</a>`;
}

function financeBackButton(label = "返回财务总览") {
  return `<a class="ghost-btn accent-back-btn" href="#finance">${label}</a>`;
}

function employeePage() {
  const employeeTodos = [
    ["截止周三需审核排班", "本周班表等待店长确认，审核后可发送给员工。", "排班管理", "orange"],
    ["下周六人手不足，尽快审核", "晚班缺 2 名服务员，请尽快确认补班安排。", "排班管理", "red"],
    ["Lisa 申请休假，请审批", "06.18 - 06.20 Urlaub 申请等待处理。", "考勤与休假", "orange"]
  ];
  return `
    <div class="page-head">
      <div>
        <h1>员工助手</h1>
        <p>管理员工资料、请假、证件到期和每月工资资料，让餐饮人事流程更简单。</p>
      </div>
      <span class="pill purple">轻量版员工管理</span>
    </div>
    <section class="employee-home-modules">
      <a class="finance-module-card employee-module-people" href="#${slug("employee", "员工管理")}">
        <div class="finance-module-head"><h2>员工管理</h2><span class="pill red">6项待补</span></div>
        <p>员工档案、合同及工资资料、员工联络方式统一管理。</p>
        <div class="finance-module-mini"><span>在职 28人 · 试用期 4人</span><span>合同 / Krankenkasse / Steuer-ID 待补</span></div>
        <span class="finance-module-cta">进入员工管理 →</span>
      </a>
      <a class="finance-module-card employee-module-schedule" href="#${slug("employee", "排班管理")}">
        <div class="finance-module-head"><h2>排班管理</h2><span class="pill orange">2个缺口</span></div>
        <p>生成班表、复制历史班表、审核工时并发送给员工确认。</p>
        <div class="finance-module-mini"><span>本周 42 个班次</span><span>周五晚班缺 1 名服务员</span></div>
        <span class="finance-module-cta">进入排班管理 →</span>
      </a>
      <a class="finance-module-card employee-module-attendance" href="#${slug("employee", "考勤与休假")}">
        <div class="finance-module-head"><h2>考勤与休假</h2><span class="pill orange">3个待批</span></div>
        <p>员工打卡、迟到异常、病假、Urlaub 和请假审批。</p>
        <div class="finance-module-mini"><span>今日未打卡 1人</span><span>Lisa Urlaub 待审批</span></div>
        <span class="finance-module-cta">进入考勤与休假 →</span>
      </a>
    </section>
    <section class="card employee-todo-card" style="margin-top:16px">
      <div class="section-title"><h2>待办事项</h2><a class="link-btn" href="#todos">查看全部 →</a></div>
      <div class="employee-todo-list">
        ${employeeTodos.map(x=>`<div class="employee-todo-item">
          <div>
            <strong>${x[0]}</strong>
            <p>${x[1]}</p>
          </div>
          <div class="employee-todo-action">
            <span class="pill ${x[3]}">${x[2]}</span>
            <button class="ghost-btn">去审批</button>
          </div>
        </div>`).join("")}
      </div>
    </section>`;
}

function employeeRows() {
  return [
    ["Kevin", "Martin Biergarten", "厨师", "全职", "€15.50", "2024-03-12", "在职", "正常"],
    ["Lisa", "Martin Biergarten", "服务员", "兼职", "€13.50", "2024-06-01", "在职", "30天到期"],
    ["Tom", "Martin Cafe", "店长", "全职", "€18.00", "2023-11-20", "试用期", "缺少文件"],
    ["Anna", "Martin Biergarten 2", "吧台", "Minijob", "€12.80", "2025-01-08", "在职", "即将到期"],
    ["张三", "Martin Cafe", "厨房助理", "Werkstudent", "€14.20", "2025-02-15", "离职", "缺少文件"]
  ];
}

function employeePayrollMap() {
  return {
    Kevin: ["126.5h", "€1,960.75", "已确认"],
    Lisa: ["84h", "€1,134.00", "待确认"],
    Tom: ["132h", "€2,376.00", "待提交"],
    Anna: ["42h", "€537.60", "缺文件"],
    张三: ["0h", "€0.00", "已归档"]
  };
}

function employeeTableRow(row) {
  const docClass = row[7] === "正常" ? "green" : row[7] === "缺少文件" ? "red" : "orange";
  const statusClass = row[6] === "离职" ? "red" : row[6] === "试用期" ? "orange" : "green";
  const detailHref = `#${slug("employee", "员工详情")}?name=${encodeURIComponent(row[0])}`;
  return `<tr>
    <td><input class="employee-row-check" type="checkbox" aria-label="选择 ${row[0]}"></td>
    <td><strong>${row[0]}</strong></td>
    <td>${row[1]}</td>
    <td>${row[2]}</td>
    <td>${row[3]}</td>
    <td>${row[4]}</td>
    <td>${row[5]}</td>
    <td><span class="pill ${statusClass}">${row[6]}</span></td>
    <td><span class="pill ${docClass}">${row[7]}</span></td>
    <td class="button-cell single-action"><a class="ghost-btn" href="${detailHref}">编辑</a></td>
  </tr>`;
}

function employeeSectionPage(child) {
  const pages = {
    "员工管理": employeeManagementPage,
    "员工打卡": employeeClockPage,
    "排班管理": employeeSchedulePage,
    "创建排班": employeeScheduleCreatePage,
    "排班逻辑": employeeScheduleRulesPage,
    "历史班表": employeeScheduleHistoryPage,
    "工时管理": employeeWorkHoursPage,
    "Arbeitszeitkonto详情": employeeArbeitszeitkontoPage,
    "考勤与休假": employeeAttendanceLeavePage,
    "考勤处理决议": employeeAttendanceDecisionPage,
    "员工联络": employeeContactPage,
    "合同及工资资料": employeeContractPayrollPage,
    "请假记录": employeeLeaveRecordsPage,
    "AI邮件编辑": employeeAiEmailPage,
    "新增员工邀请": employeeInvitePage,
    "邮件详情": employeeMailDetailPage
  };
  return (pages[child] || employeePage)();
}

function employeeStatsSection(stats) {
  return `<section class="grid grid-4 employee-stats">${stats.map(s=>`
    <div class="card employee-stat-card">
      <p>${s[0]}</p>
      <div class="metric-value" style="color:var(--${s[3]})">${s[1]}</div>
      <small>${s[2]}</small>
    </div>`).join("")}</section>`;
}

function employeeManagementPage() {
  const contactRows = [
    ["Kevin", "+49 171 234567", "kevin@example.com", "Anna · +49 170 ...", "WhatsApp"],
    ["Lisa", "+49 176 981234", "lisa@example.com", "Tom · +49 172 ...", "Email"],
    ["Tom", "+49 173 882211", "tom@example.com", "Maria · +49 174 ...", "WhatsApp"]
  ];
  return `
    <div class="page-head">
      <div><h1>员工管理</h1><p>集中管理员工档案、合同及工资资料、员工联络方式和证件提醒。</p></div>
      <div class="button-row"><a class="ghost-btn accent-back-btn" href="#employee">返回员工助手</a></div>
    </div>
    ${employeeStatsSection([
      ["在职员工", "28 人", "全职 12 / 兼职 10 / Minijob 6", "green"],
      ["新入职", "3 人", "本月完成入职", "blue"],
      ["资料待补", "6 项", "合同、Krankenkasse 或 Steuer-ID", "red"],
      ["试用期", "4 人", "需要复核转正日期", "orange"]
    ])}
    <section class="card employee-archive-card" style="margin-top:16px">
      <div class="section-title"><h2>员工档案</h2><div class="button-row"><a class="ghost-btn" href="#${slug("employee", "员工列表")}">查看全部</a><a class="primary-btn" href="#${slug("employee", "新增员工邀请")}">新增员工</a></div></div>
      <div class="table-scroll"><table class="table employee-table employee-compact-table">
          <thead><tr><th><input class="employee-row-check employee-select-all" type="checkbox" aria-label="全选员工"></th><th>姓名</th><th>门店</th><th>岗位</th><th>合同类型</th><th>时薪</th><th>入职日期</th><th>状态</th><th>证件状态</th><th>操作</th></tr></thead>
          <tbody>${employeeRows().map(row=>employeeTableRow(row)).join("")}</tbody>
        </table></div>
      <div class="employee-table-footer">
        <span class="small">可全选或多选员工后群发邮件通知。</span>
        <a class="primary-btn employee-notify-btn" href="#${slug("employee", "AI邮件编辑")}">通知员工</a>
      </div>
    </section>`;
}

function employeeClockPage() {
  const rows = [
    ["Tom", "Martin Biergarten", "午班", "08:45", "09:02", "迟到18分钟", "orange"],
    ["Lisa", "Martin Biergarten", "早班", "09:00", "09:00", "已到岗", "green"],
    ["Anna", "Martin Biergarten 2", "早班", "09:00", "08:55", "已到岗", "green"],
    ["Kevin", "Martin Cafe", "厨房", "10:00", "未打卡", "待处理", "red"],
    ["Maria", "Martin Cafe", "晚班", "17:00", "-", "未开始", "blue"]
  ];
  return `
    <div class="page-head"><div><h1>员工打卡</h1><p>查看今日签到、迟到、未打卡和异常处理。</p></div><button class="primary-btn">导出考勤</button></div>
    ${employeeStatsSection([
      ["今日员工", "9 人", "今日需要打卡", "blue"],
      ["已到岗", "7 人", "正常到岗", "green"],
      ["迟到", "1 人", "需要店长确认", "orange"],
      ["未打卡", "1 人", "等待处理", "red"]
    ])}
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>今日打卡记录</h2><span class="pill blue">实时状态</span></div>
      <table class="table employee-table">
        <thead><tr><th>员工</th><th>门店</th><th>班次</th><th>应到</th><th>实到</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${rows.map(x=>`<tr><td><strong>${x[0]}</strong></td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td><span class="pill ${x[6]}">${x[5]}</span></td><td class="button-cell"><button class="ghost-btn">确认</button><button class="ghost-btn">备注</button></td></tr>`).join("")}</tbody>
      </table>
    </section>
    <section class="grid grid-2 employee-page-grid" style="margin-top:16px">
      <div class="card red-zone"><div class="section-title"><h2>打卡异常</h2><span class="pill red">2 项</span></div>${["Kevin 未打卡，请确认是否到岗", "Tom 迟到 18 分钟，需店长备注"].map(x=>`<div class="warn-item"><strong>${x}</strong><button class="ghost-btn">处理</button></div>`).join("")}</div>
      <div class="card"><div class="section-title"><h2>打卡设置</h2></div><div class="employee-contact-actions"><button class="ghost-btn">生成门店二维码</button><button class="ghost-btn">员工 PIN 管理</button><button class="ghost-btn">导出本月考勤</button></div></div>
    </section>`;
}

function employeeSchedulePage() {
  const todoRows = [
    ["red", "未报班", "Liam 还没有提交本周可上班时间", "一键提醒"],
    ["orange", "员工备注", "Maria 备注本周想多上晚班，优先周五 / 周六", "查看备注"],
    ["blue", "调班请求", "Tom 希望把周五晚班换到周日午班", "处理请求"],
    ["purple", "工时提醒", "Kevin 本月已工作 41h，继续排班前需查看合同工时", "查看工时"]
  ];
  return `
    <div class="page-head"><div><h1>排班管理</h1><p>轻量安排本周班次，支持复制历史班表和发布给员工。</p></div><a class="ghost-btn accent-back-btn" href="#employee">返回员工助手</a></div>
    <section class="employee-schedule-shortcuts">
      ${[
        ["创建排班", "AI 自动排班结果、报班情况和本月剩余工时", "primary", "✦"],
        ["排班逻辑", "设置岗位、时段人数和员工级别", "", "☷"],
        ["历史班表", "查看和复用历史排班", "", "↺"],
        ["工时管理", "本月工时、薪资和剩余可排工时", "", "h"]
      ].map(item => `<a class="employee-schedule-shortcut ${item[2]}" href="#${slug("employee", item[0])}"><span class="schedule-shortcut-icon">${item[3]}</span><span class="schedule-shortcut-copy"><strong>${item[0]}</strong><span>${item[1]}</span></span></a>`).join("")}
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>待办事项</h2><a class="primary-btn" href="#${slug("employee", "创建排班")}">查看历史处理详情</a></div>
      <div class="schedule-todo-list">
        ${todoRows.map(row => `<div class="schedule-todo-item ${row[0]}"><span class="pill ${row[0]}">${row[1]}</span><strong>${row[2]}</strong><button class="ghost-btn">${row[3]}</button></div>`).join("")}
      </div>
    </section>
    `;
}

function employeeScheduleCreatePage() {
  const workHourRows = [
    ["Kevin", "全职", "时薪", "€15.50 / h", "160h / 月", "41h", "14 天"],
    ["Lisa", "兼职", "时薪", "€13.50 / h", "40-80h / 月", "36h", "14 天"],
    ["Tom", "兼职", "Pauschal", "€1,850 / 月", "40-80h / 月", "22h", "14 天"],
    ["Anna", "Minijob", "时薪", "€12.80 / h", "40h / 月", "18h", "14 天"],
    ["Maria", "兼职", "Pauschal", "€1,200 / 月", "40-80h / 月", "28h", "14 天"]
  ];
  const days = [["周一","5/20"],["周二","5/21"],["周三","5/22"],["周四","5/23"],["周五","5/24"],["周六","5/25"],["周日","5/26"]];
  const employeeNotes = {
    Olivia: "最多上 5 天",
    Daniel: "尽量不上周四",
    Sophia: "最多上 4 天",
    Mia: "周五尽量不排",
    Noah: "偏好午班",
    Ava: "最多上 3 天",
    James: "可补周末后厨",
    Liam: "还没提交报班",
    Chloe: "想多上周末",
    Emma: "只排早班",
    Lucas: "尽量不上周六",
    Isabella: "最多上 4 天"
  };
  const scheduleRows = [
    ["Olivia", "店长", "manager", ["FREE 09:00-17:00", "FREE 09:00-17:00", "休息", "FREE 10:00-18:00", "FREE 09:00-17:00", "FREE 09:00-17:00", "休息"], ["09:00-17:00", "09:00-17:00", "休息", "10:00-18:00", "09:00-17:00", "09:00-17:00", "休息"]],
    ["Daniel", "店长", "manager", ["FREE 09:00-17:00", "FREE 10:00-18:00", "FREE 10:00-18:00", "休息", "FREE 11:00-19:00", "FREE 11:00-19:00", "FREE 10:00-18:00"], ["FREE 09:00-17:00", "10:00-18:00", "10:00-18:00", "休息", "11:00-19:00", "11:00-19:00", "10:00-18:00"]],
    ["Sophia", "前厅", "front", ["FREE 08:00-16:00", "FREE 12:00-20:00", "FREE 12:00-20:00", "休息", "FREE 16:00-23:00", "FREE 08:00-16:00", "休息"], ["08:00-16:00", "12:00-20:00", "12:00-20:00", "休息", "16:00-23:00", "08:00-16:00", "休息"]],
    ["Mia", "前厅", "front", ["FREE 09:00-17:00", "FREE 09:00-17:00", "FREE 16:00-23:00", "FREE 16:00-23:00", "休息", "FREE 10:00-18:00", "FREE 10:00-18:00"], ["FREE 09:00-17:00", "09:00-17:00", "16:00-23:00", "16:00-23:00", "休息", "10:00-18:00", "10:00-18:00"]],
    ["Noah", "前厅", "front", ["FREE 12:00-20:00", "FREE 12:00-20:00", "FREE 09:00-17:00", "FREE 12:00-20:00", "FREE 12:00-20:00", "休息", "FREE 16:00-23:00"], ["12:00-20:00", "FREE 12:00-20:00", "09:00-17:00", "12:00-20:00", "12:00-20:00", "休息", "16:00-23:00"]],
    ["Ava", "前厅", "front", ["FREE 16:00-23:00", "FREE 16:00-23:00", "休息", "FREE 09:00-17:00", "休息", "FREE 16:00-23:00", "FREE 12:00-20:00"], ["16:00-23:00", "16:00-23:00", "休息", "09:00-17:00", "休息", "16:00-23:00", "12:00-20:00"]],
    ["James", "后厨", "kitchen", ["FREE 06:00-14:00", "FREE 06:00-14:00", "FREE 06:00-14:00", "休息", "FREE 06:00-14:00", "FREE 08:00-16:00", "休息"], ["06:00-14:00", "06:00-14:00", "06:00-14:00", "休息", "06:00-14:00", "08:00-16:00", "休息"]],
    ["Liam", "后厨", "kitchen", ["未报班", "未报班", "未报班", "未报班", "未报班", "未报班", "未报班"], ["未报班", "未报班", "未报班", "未报班", "未报班", "未报班", "未报班"]],
    ["Chloe", "吧台", "bar", ["FREE 12:00-20:00", "FREE 12:00-20:00", "休息", "FREE 16:00-23:00", "FREE 12:00-20:00", "FREE 12:00-20:00", "FREE 12:00-20:00"], ["12:00-20:00", "12:00-20:00", "休息", "16:00-23:00", "12:00-20:00", "12:00-20:00", "FREE 12:00-20:00"]],
    ["Emma", "清洁", "clean", ["FREE 07:00-15:00", "FREE 07:00-15:00", "休息", "FREE 07:00-15:00", "FREE 07:00-15:00", "FREE 07:00-15:00", "休息"], ["07:00-15:00", "07:00-15:00", "休息", "07:00-15:00", "07:00-15:00", "07:00-15:00", "休息"]],
    ["Lucas", "清洁", "clean", ["休息", "FREE 08:00-16:00", "FREE 08:00-16:00", "休息", "FREE 08:00-16:00", "休息", "FREE 08:00-16:00"], ["休息", "08:00-16:00", "08:00-16:00", "休息", "08:00-16:00", "休息", "08:00-16:00"]],
    ["Isabella", "清洁", "clean", ["FREE 08:00-16:00", "休息", "FREE 07:00-15:00", "FREE 08:00-16:00", "休息", "FREE 08:00-16:00", "FREE 08:00-16:00"], ["08:00-16:00", "休息", "07:00-15:00", "08:00-16:00", "休息", "08:00-16:00", "08:00-16:00"]]
  ];
  const renderShift = (shift, role, aiShift) => {
    const data = `data-role="${role}" data-ai-shift="${aiShift}" data-initial-shift="${shift}"`;
    if (shift === "未报班") return `<span class="shift-pill missing-shift editable-shift" ${data} data-shift="">还没报班</span>`;
    if (shift.startsWith("FREE ")) {
      const freeTime = shift.replace("FREE ", "");
      return `<span class="shift-pill free editable-shift" ${data} data-shift="${freeTime}"><span>FREE</span><strong>${freeTime}</strong></span>`;
    }
    return `<span class="shift-pill ${shift === "休息" ? "off" : role} editable-shift" ${data} data-shift="${shift === "休息" ? "" : shift}">${shift === "休息" ? "/" : shift}</span>`;
  };
  return `
    <div class="page-head"><div><h1>创建排班</h1><p>AI 已根据岗位需求、员工级别、报班情况和本月剩余工时生成建议班表。</p></div><div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("employee", "排班管理")}">返回排班管理</a></div></div>
    <section class="card">
      <div class="section-title"><h2 class="schedule-title">排班准备</h2><div class="button-row"><span class="pill blue schedule-status">待排班</span><button class="primary-btn schedule-ai-btn">AI 智能排班</button><button class="ghost-btn schedule-undo-btn is-hidden">撤回排班</button><button class="primary-btn schedule-publish-btn is-hidden">发布排班</button></div></div>
      <div class="employee-roster-table-wrap">
        <table class="employee-roster-table">
          <thead><tr><th>员工</th>${days.map(day => `<th>${day[0]}<span>${day[1]}</span></th>`).join("")}</tr></thead>
          <tbody>${scheduleRows.map(row => `<tr class="${row[3].every(shift => shift === "未报班") ? "missing-roster-row" : ""}"><td><div class="roster-employee-cell"><strong>${row[0]}</strong><span class="role-tag ${row[2]}">${row[1]}</span><small>${employeeNotes[row[0]] || ""}</small></div>${row[3].every(shift => shift === "未报班") ? `<button class="ghost-btn roster-remind-btn">一键提醒</button>` : ""}</td>${row[3].map((shift, index) => `<td>${renderShift(shift, row[2], row[4][index])}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        <div class="roster-legend">${[["manager","店长 / 管理"],["kitchen","后厨"],["front","前厅服务"],["bar","吧台 / 饮品"],["clean","清洁 / 支援"],["free","已报班未排上"],["off","休息"]].map(item => `<span><i class="${item[0]}"></i>${item[1]}</span>`).join("")}</div>
      </div>
    </section>
    <section class="grid employee-page-grid" style="margin-top:16px">
      <div class="card employee-hours-card"><div class="section-title"><h2>合同工时与剩余周期</h2><button class="ghost-btn">查看更多</button></div><table class="table employee-table employee-hours-table"><thead><tr><th>员工</th><th>合同</th><th>薪资类型</th><th>金额</th><th>规定工时</th><th>已工作</th><th>本月还剩几天</th></tr></thead><tbody>${workHourRows.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td><span class="pill ${r[2] === "Pauschal" ? "purple" : "blue"}">${r[2]}</span></td><td><strong>${r[3]}</strong></td><td>${r[4]}</td><td><strong>${r[5]}</strong></td><td>${r[6]}</td></tr>`).join("")}</tbody></table></div>
    </section>`;
}

function employeeScheduleRulesPage() {
  const rows = [["厨房", "周一至周五 10:00-15:00", "2 人", "熟练"], ["前厅", "每天 12:00-18:00", "3 人", "普通 / 熟练"], ["吧台", "周五至周日 17:00-23:00", "1 人", "熟练"], ["店长", "每天晚班", "1 人", "负责人"]];
  return `<div class="page-head"><div><h1>排班逻辑</h1><p>设置不同岗位在不同时间需要的人数，并选择员工级别要求。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("employee", "排班管理")}">返回排班管理</a></div>
    <section class="card"><div class="section-title"><h2>岗位需求规则</h2></div><table class="table employee-table"><thead><tr><th>岗位</th><th>适用时间</th><th>需要人数</th><th>员工级别</th><th>操作</th></tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}<td><button class="ghost-btn">删除</button></td></tr>`).join("")}</tbody></table></section>
    <section class="card" style="margin-top:16px"><h2>新增排班逻辑</h2><div class="form-grid">${field("岗位", "厨房 / 前厅 / 吧台")}${field("时间段", "周五 17:00-23:00")}${field("需要人数", "2 人")}${selectField("员工级别", ["普通", "熟练", "负责人"])}</div><button class="primary-btn" style="margin-top:12px">保存规则</button></section>`;
}

function employeeScheduleHistoryPage() {
  const rows = [["2025-W24", "42 班", "318h", "已发布"], ["2025-W23", "40 班", "304h", "已归档"], ["2025-W22", "43 班", "326h", "已归档"]];
  return `<div class="page-head"><div><h1>历史班表</h1><p>查看历史排班并快速复制为新一周班表。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("employee", "排班管理")}">返回排班管理</a></div>
    <section class="card"><div class="section-title"><h2>历史记录</h2><button class="ghost-btn">导出历史班表</button></div><table class="table employee-table"><thead><tr><th>周期</th><th>班次数</th><th>总工时</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td><span class="pill green">${r[3]}</span></td><td><button class="ghost-btn">查看</button><button class="ghost-btn">复制</button></td></tr>`).join("")}</tbody></table></section>`;
}

function employeeWorkHoursPage() {
  const rows = [["Kevin", "126.5h", "160h", "€15.50", "€1,960.75", "+6.5h"], ["Lisa", "84h", "60-80h", "€13.50", "€1,134.00", "-2h"], ["Tom", "132h", "160h", "€18.00", "€2,376.00", "+1h"], ["Anna", "42h", "60-80h", "€12.80", "€537.60", "0h"]];
  return `<div class="page-head"><div><h1>工时管理</h1><p>查看每个人本月工作情况、剩余可排工时、时薪和目前薪资。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("employee", "排班管理")}">返回排班管理</a></div>
    <section class="card"><div class="section-title"><h2>本月工时与薪资</h2><button class="ghost-btn">查看全部</button></div><table class="table employee-table"><thead><tr><th>员工</th><th>已排工时</th><th>合同要求工时</th><th>时薪</th><th>目前薪资</th><th>Arbeitszeitkonto</th><th>操作</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${r[0]}</strong></td><td><button class="inline-hours-btn editable-scheduled-hours" data-employee="${r[0]}" data-hours="${r[1].replace("h", "")}">${r[1]}</button></td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td><span class="pill editable-time-account ${r[5].startsWith("-") ? "red" : r[5] === "0h" ? "gray" : "green"}" data-employee="${r[0]}" data-value="${r[5].replace("h", "")}">${r[5]}</span></td><td><button class="ghost-btn">查看详情</button></td></tr>`).join("")}</tbody></table><div class="konto-suggestion" data-employee="Lisa" data-hours="10" data-action="store"><div><span class="pill orange">系统提示</span><strong>Lisa 本月工作偏多，建议将 10h 计入 Arbeitszeitkonto。</strong></div><button class="primary-btn konto-confirm-btn">一键确认</button></div><div class="konto-suggestion" data-employee="Anna" data-hours="6" data-action="take"><div><span class="pill blue">系统提示</span><strong>Anna 本月工作时间偏少，建议取出 6h 补足，避免变成 Minijob 风险。</strong></div><button class="primary-btn konto-confirm-btn">一键确认</button></div></section>
    <section class="grid grid-2 employee-page-grid" style="margin-top:16px">
      <div class="card"><div class="section-title"><h2>Arbeitszeitkonto</h2><a class="ghost-btn" href="#${slug("employee", "Arbeitszeitkonto详情")}">查看详情</a></div><div class="form-grid">${field("员工", "Kevin / Lisa / Tom")}${field("调整小时", "例如 2 或 1.5")}${field("关联日期", "YYYY-MM-DD")}${field("原因", "补休 / 误差修正 / 手动调整")}</div><div class="button-row" style="margin-top:12px"><button class="ghost-btn">取出工时</button><button class="primary-btn">存入工时</button></div></div>
      <div class="card"><div class="section-title"><h2>加班</h2><button class="ghost-btn">历史记录</button></div><div class="form-grid">${field("员工", "Kevin / Lisa / Tom")}${field("日期", "YYYY-MM-DD")}${field("加班开始", "18:00")}${field("加班结束", "22:00")}${field("加班理由", "临时客流 / 活动 / 缺人补位")}${field("当天营业额", "€0.00")}</div><button class="primary-btn" style="margin-top:12px">保存加班记录并提交审批</button></div>
    </section>`;
}

function employeeArbeitszeitkontoPage() {
  const balances = [["Kevin", "+6.5h", "本月存入 8h / 取出 1.5h"], ["Lisa", "-2h", "本月取出 2h"], ["Tom", "+1h", "本月存入 1h"], ["Anna", "0h", "暂无变动"]];
  const logs = [
    ["2025-05-24", "Kevin", "存入", "+2h", "周五晚班延长，已由店长确认"],
    ["2025-05-22", "Lisa", "取出", "-2h", "补休半天，抵扣 Arbeitszeitkonto"],
    ["2025-05-20", "Tom", "存入", "+1h", "收尾清洁超出排班时间"],
    ["2025-05-18", "Kevin", "存入", "+4.5h", "周末活动支援"],
    ["2025-05-15", "Kevin", "取出", "-1.5h", "提前下班调整"]
  ];
  return `<div class="page-head"><div><h1>Arbeitszeitkonto详情</h1><p>查看所有员工 Arbeitszeitkonto 余额，以及每次存入、取出和手动修改记录。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("employee", "工时管理")}">返回工时管理</a></div>
    <section class="card"><div class="section-title"><h2>员工账户余额</h2><button class="ghost-btn">导出记录</button></div><table class="table employee-table"><thead><tr><th>员工</th><th>当前余额</th><th>摘要</th><th>操作</th></tr></thead><tbody>${balances.map(r => `<tr><td><strong>${r[0]}</strong></td><td><span class="pill ${r[1].startsWith("-") ? "red" : r[1] === "0h" ? "gray" : "green"}">${r[1]}</span></td><td>${r[2]}</td><td><button class="ghost-btn">查看员工记录</button></td></tr>`).join("")}</tbody></table></section>
    <section class="card" style="margin-top:16px"><div class="section-title"><h2>修改明细</h2><button class="ghost-btn">筛选月份</button></div><table class="table employee-table"><thead><tr><th>日期</th><th>员工</th><th>类型</th><th>小时</th><th>原因</th></tr></thead><tbody>${logs.map(r => `<tr><td>${r[0]}</td><td><strong>${r[1]}</strong></td><td><span class="pill ${r[2] === "取出" ? "orange" : "blue"}">${r[2]}</span></td><td><strong>${r[3]}</strong></td><td>${r[4]}</td></tr>`).join("")}</tbody></table></section>`;
}

function employeeAttendanceLeavePage() {
  const clockRows = [
    ["Tom", "Martin Biergarten", "午班", "09:02", "迟到18分钟", "orange", "已同步班表", "green"],
    ["Lisa", "Martin Biergarten", "早班", "09:00", "已到岗", "green", "已同步班表", "green"],
    ["Kevin", "Martin Cafe", "厨房", "未打卡", "待处理", "red", "待审批", "orange"]
  ];
  const urlaubRows = [
    ["Lisa", "2025-06-18 - 2025-06-20", "3天", "28天", "12天", "16天", "待审批"],
    ["Anna", "2025-06-10", "1天", "24天", "8天", "16天", "待审批"],
    ["Kevin", "2025-07-01 - 2025-07-05", "5天", "30天", "10天", "20天", "已批准"]
  ];
  const sickRows = [
    ["Tom", "Krankheit", "2025-05-21", "1天", "已批准", "已退款"],
    ["Maria", "Kinderkrankheit", "2025-06-03 - 2025-06-04", "2天", "待审批", "未退款"],
    ["Sophia", "Elternzeit", "2025-07-01 - 2025-08-15", "46天", "待审批", "未退款"],
    ["Anna", "Unbezahlter Urlaub", "2025-06-10", "1天", "待审批", "未退款"]
  ];
  return `
    <div class="page-head"><div><h1>考勤与休假</h1><p>合并查看员工打卡、迟到异常、病假、Urlaub 和请假审批。</p></div><a class="ghost-btn accent-back-btn" href="#employee">返回员工助手</a></div>
    <section class="card" style="margin-top:16px">
        <div class="section-title"><h2>今日考勤</h2><button class="primary-btn">导出考勤</button></div>
        <table class="table employee-table"><thead><tr><th>员工</th><th>门店</th><th>班次</th><th>打卡</th><th>状态</th><th>处理结果</th><th>修改</th></tr></thead><tbody>
          ${clockRows.map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[5]}">${r[4]}</span></td><td>${r[6] === "待审批" ? `<details class="attendance-result-menu"><summary class="pill ${r[7]}">${r[6]}</summary><div class="attendance-result-popover"><h3>补签</h3><div class="attendance-time-grid"><label>开始时间<input value="09:00"></label><label>截止时间<input value="18:00"></label></div><div class="attendance-result-actions"><button class="primary-btn">补签</button><button class="ghost-btn danger-lite">记录缺勤</button></div></div></details>` : `<span class="pill ${r[7]}">${r[6]}</span>`}</td><td><a class="ghost-btn" href="#${slug("employee", "考勤处理决议")}?name=${encodeURIComponent(r[0])}">修改决议</a></td></tr>`).join("")}
        </tbody></table>
    </section>
    <section class="card" style="margin-top:16px">
        <div class="section-title"><h2>Urlaub</h2><button class="primary-btn">新增 Urlaub</button></div>
        <table class="table employee-table"><thead><tr><th>员工</th><th>日期</th><th>本次天数</th><th>今年总天数</th><th>已休</th><th>剩余</th><th>状态</th><th>操作</th></tr></thead><tbody>
          ${urlaubRows.map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td>${r[5]}</td><td><span class="pill ${r[6] === "已批准" ? "green" : "orange"}">${r[6]}</span></td><td class="button-cell ${r[6] === "已批准" ? "single-action" : ""}">${r[6] === "已批准" ? `<button class="ghost-btn">编辑</button>` : `<button class="ghost-btn">通过</button><button class="ghost-btn danger-lite">驳回</button>`}</td></tr>`).join("")}
        </tbody></table>
    </section>
    <section class="card red-zone" style="margin-top:16px">
        <div class="section-title"><h2>病假与特殊假</h2><button class="primary-btn">新增请假</button></div>
        <table class="table employee-table"><thead><tr><th>员工</th><th>类型</th><th>日期</th><th>天数</th><th>状态</th><th>Krankenkasse 退款</th><th>Abruf</th></tr></thead><tbody>
          ${sickRows.map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[4] === "已批准" ? "green" : "orange"}">${r[4]}</span></td><td><span class="pill ${r[5] === "已退款" ? "green" : "red"}">${r[5]}</span></td><td class="button-cell ${r[5] === "已退款" ? "single-action" : ""}">${r[5] === "已退款" ? `<button class="ghost-btn">编辑</button>` : `<button class="ghost-btn">联络</button>`}</td></tr>`).join("")}
        </tbody></table>
    </section>`;
}

function employeeAttendanceDecisionPage() {
  const params = state().params;
  const name = params.get("name") || "Tom";
  return `
    <div class="page-head"><div><h1>修改考勤处理决议</h1><p>调整考勤异常的处理结果，并决定是否同步到班表和工时记录。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("employee", "考勤与休假")}">返回考勤与休假</a></div>
    <section class="grid grid-2 employee-page-grid" style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>处理结果</h2><span class="pill orange">可修改</span></div>
        <div class="form-grid">
          ${field("员工", "员工姓名", name)}
          ${selectField("处理结果", ["已同步班表", "待处理", "待审批", "已忽略"])}
          ${selectField("同步动作", ["同步到班表和工时", "只记录备注", "提交审批后同步"])}
          ${field("修改原因", "例如：店长确认迟到原因")}
        </div>
        <div class="field" style="margin-top:12px"><label>处理备注</label><textarea placeholder="填写处理决议，例如：迟到 18 分钟计入本月考勤，班表无需调整。"></textarea></div>
        <button class="primary-btn" style="margin-top:12px">保存决议</button>
      </div>
      <div class="card">
        <div class="section-title"><h2>处理记录</h2><button class="ghost-btn">查看历史</button></div>
        <div class="employee-record-list">
          <div class="employee-record-item"><div><span>今天 09:20</span><strong>店长提交异常说明</strong><p>员工已到店，打卡设备未同步。</p></div><span class="pill blue">备注</span></div>
          <div class="employee-record-item"><div><span>今天 09:32</span><strong>系统建议处理结果</strong><p>建议标记为待审批，审批后同步班表。</p></div><span class="pill orange">待确认</span></div>
        </div>
      </div>
    </section>`;
}

function employeeContactPage() {
  const rows = [
    ["Kevin", "+49 171 234567", "kevin@example.com", "Anna · +49 170 ...", "中文 / Deutsch", "WhatsApp"],
    ["Lisa", "+49 176 981234", "lisa@example.com", "Tom · +49 172 ...", "Deutsch", "Email"],
    ["Tom", "+49 173 882211", "tom@example.com", "Maria · +49 174 ...", "Deutsch / English", "WhatsApp"],
    ["Anna", "+49 175 661122", "anna@example.com", "待补", "中文", "短信"]
  ];
  return `
    <div class="page-head"><div><h1>员工联络</h1><p>统一管理员工电话、邮箱、紧急联系人和通知方式。</p></div><div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("employee", "员工管理")}">返回员工管理</a><button class="primary-btn">保存修改</button></div></div>
    ${employeeStatsSection([
      ["通讯录", "28 人", "覆盖全部在职员工", "blue"],
      ["缺少电话", "2 人", "需要补充", "red"],
      ["紧急联系人缺失", "3 人", "入职资料待补", "orange"],
      ["本周通知", "5 条", "排班和资料提醒", "purple"]
    ])}
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>员工通讯录</h2><div class="employee-contact-actions"><button class="primary-btn">群发通知</button><button class="ghost-btn">导出通讯录</button></div></div>
      <table class="table employee-table">
        <thead><tr><th>姓名</th><th>电话</th><th>邮箱</th><th>紧急联系人</th><th>语言</th><th>通知方式</th><th>操作</th></tr></thead>
        <tbody>${rows.map(x=>`<tr>
          <td><strong>${x[0]}</strong></td>
          <td><input class="employee-edit-input" value="${x[1]}"></td>
          <td><input class="employee-edit-input" value="${x[2]}"></td>
          <td><input class="employee-edit-input" value="${x[3]}"></td>
          <td><select class="employee-edit-input"><option>${x[4]}</option><option>中文</option><option>Deutsch</option><option>Deutsch / English</option></select></td>
          <td><select class="employee-edit-input"><option>${x[5]}</option><option>WhatsApp</option><option>Email</option><option>短信</option></select></td>
          <td class="button-cell"><button class="ghost-btn">联系</button><button class="ghost-btn">保存</button></td>
        </tr>`).join("")}</tbody>
      </table>
    </section>`;
}

function employeeContractPayrollPage() {
  const rows = [
    ["Kevin", "全职", "€15.50", "126.5h", "2天", "0天", "€1,960.75", "已确认"],
    ["Lisa", "兼职", "€13.50", "84h", "0天", "1天", "€1,134.00", "待确认"],
    ["Tom", "全职", "€18.00", "132h", "1天", "0天", "€2,376.00", "待提交"],
    ["Anna", "Minijob", "€12.80", "42h", "0天", "0天", "€537.60", "缺文件"]
  ];
  return `
    <div class="page-head"><div><h1>合同及工资资料</h1><p>整理合同文件和每月工资资料，方便提交给税务师或工资服务方。</p></div><div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("employee", "员工管理")}">返回员工管理</a><button class="primary-btn">保存修改</button></div></div>
    ${employeeStatsSection([
      ["合同待签", "2 份", "需要员工确认", "orange"],
      ["工资资料待确认", "4 人", "本月工资前需处理", "red"],
      ["已提交税务师", "1 家门店", "Dortmund 新店", "green"],
      ["缺少文件", "3 项", "Krankenkasse / Steuer-ID", "red"]
    ])}
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>本月工资资料</h2><div class="employee-contact-actions"><button class="ghost-btn">上传合同</button><button class="ghost-btn">导出 CSV</button><button class="ghost-btn">导出 PDF</button><button class="primary-btn">标记已提交给税务师</button></div></div>
      <table class="table employee-table">
        <thead><tr><th>员工</th><th>合同类型</th><th>时薪</th><th>本月工时</th><th>Urlaub</th><th>病假</th><th>预计工资</th><th>资料状态</th><th>操作</th></tr></thead>
        <tbody>${rows.map(x=>`<tr>
          <td><strong>${x[0]}</strong></td>
          <td><select class="employee-edit-input"><option>${x[1]}</option><option>全职</option><option>兼职</option><option>Minijob</option></select></td>
          <td><input class="employee-edit-input" value="${x[2]}"></td>
          <td><input class="employee-edit-input" value="${x[3]}"></td>
          <td><input class="employee-edit-input" value="${x[4]}"></td>
          <td><input class="employee-edit-input" value="${x[5]}"></td>
          <td><input class="employee-edit-input" value="${x[6]}"></td>
          <td><select class="employee-edit-input"><option>${x[7]}</option><option>已确认</option><option>待确认</option><option>待提交</option><option>缺文件</option></select></td>
          <td class="button-cell"><button class="ghost-btn">上传合同</button><button class="ghost-btn">保存</button></td>
        </tr>`).join("")}</tbody>
      </table>
    </section>`;
}

function employeeLeaveRecordsPage() {
  const rows = [
    ["Lisa", "Urlaub", "2025-06-03 - 2025-06-05", "3天", "Martin Biergarten", "待审批", "Martin"],
    ["Tom", "Krankheit", "2025-05-21", "1天", "Martin Cafe", "已批准", "店长"],
    ["Anna", "Unbezahlter Urlaub", "2025-06-10", "1天", "Martin Biergarten 2", "待审批", "Martin"],
    ["Kevin", "Urlaub", "2025-06-18 - 2025-06-20", "3天", "Martin Biergarten", "已拒绝", "Martin"]
  ];
  return `
    <div class="page-head"><div><h1>请假记录</h1><p>处理员工年假、病假和无薪假申请，支持按门店筛选。</p></div><button class="primary-btn">新增请假</button></div>
    ${employeeStatsSection([
      ["待审批", "3 个", "需要店长或负责人处理", "orange"],
      ["已批准", "8 个", "本月记录", "green"],
      ["本月请假天数", "18 天", "含年假和病假", "blue"],
      ["病假", "5 天", "需要留存证明", "red"]
    ])}
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>请假申请</h2><div class="employee-contact-actions"><button class="filter active">全部门店</button><button class="filter">待审批</button><button class="filter">已批准</button><button class="filter">已拒绝</button></div></div>
      <table class="table employee-table">
        <thead><tr><th>员工</th><th>类型</th><th>起止日期</th><th>天数</th><th>门店</th><th>状态</th><th>审批人</th><th>操作</th></tr></thead>
        <tbody>${rows.map(x=>`<tr>${x.map((c,i)=>`<td>${i===0?`<strong>${c}</strong>`:i===5?`<span class="pill ${c==="已批准"?"green":c==="已拒绝"?"red":"orange"}">${c}</span>`:c}</td>`).join("")}<td class="button-cell"><button class="ghost-btn">审批</button><button class="ghost-btn">查看</button></td></tr>`).join("")}</tbody>
      </table>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>新增请假</h2></div>
      <div class="form-grid"><input placeholder="员工姓名"><input placeholder="请假类型：Urlaub / Krankheit / 无薪假"><input placeholder="开始日期"><input placeholder="结束日期"><input placeholder="相关门店"><input placeholder="备注"></div>
      <div class="employee-section-toolbar"><button class="primary-btn">保存申请</button><button class="ghost-btn">上传证明</button></div>
    </section>`;
}

function employeeListPage() {
  return `
    <div class="page-head">
      <div><h1>员工列表</h1><p>集中查看员工基本资料、合同状态、证件状态和操作入口。</p></div>
    </div>
    <section class="card employee-archive-card">
      <div class="section-title"><h2>员工档案</h2><div class="button-row"><span class="pill purple">28 人</span><a class="primary-btn" href="#${slug("employee", "新增员工邀请")}">新增员工</a></div></div>
      <div class="table-scroll"><table class="table employee-table employee-compact-table">
          <thead><tr><th><input class="employee-row-check employee-select-all" type="checkbox" aria-label="全选员工"></th><th>姓名</th><th>门店</th><th>岗位</th><th>合同类型</th><th>时薪</th><th>入职日期</th><th>状态</th><th>证件状态</th><th>操作</th></tr></thead>
          <tbody>${employeeRows().map(row=>employeeTableRow(row)).join("")}</tbody>
        </table></div>
      <div class="employee-table-footer">
        <span class="small">可全选或多选员工后群发邮件通知。</span>
        <a class="primary-btn employee-notify-btn" href="#${slug("employee", "AI邮件编辑")}">通知员工</a>
      </div>
    </section>`;
}

function employeeAiEmailPage() {
  const selectedRecipients = (state().params.get("recipients") || "").split(",").map(name => name.trim()).filter(Boolean);
  const recipients = selectedRecipients.length ? selectedRecipients : employeeRows().filter(row => row[6] !== "离职").map(row => row[0]);
  return `
    <div class="page-head">
      <div><h1>AI 邮件编辑</h1><p>根据已选员工生成群发邮件，确认内容后再发送。</p></div>
      <div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("employee", "员工管理")}">返回员工管理</a></div>
    </div>
    <section class="grid grid-2 employee-email-editor">
      <div class="card">
        <div class="section-title"><h2>收件员工</h2></div>
        <div class="employee-recipient-list">
          ${recipients.map(name => `<span class="pill blue">${name} ×</span>`).join("")}
          <button class="ghost-btn employee-add-recipient">+ 添加员工</button>
        </div>
        <div class="form-grid employee-email-fields">
          ${field("邮件主题", "请输入主题", "请确认本月员工资料与排班信息")}
          <div class="field"><label>发送语言</label><select><option>中文 + Deutsch</option><option>中文</option><option>Deutsch</option><option>English</option></select></div>
          <div class="field"><label>发件邮箱</label><select><option>martin@martin-biergarten.de</option><option>hr@martin-biergarten.de</option><option>buchhaltung@martin-biergarten.de</option><option>service@kaispan.ai</option></select></div>
        </div>
        <div class="field employee-ai-input"><label>AI 输入信息</label><textarea>请帮我生成一封群发邮件，通知已选员工在本周五 18:00 前确认本月员工资料、合同信息、Urlaubstag、工作时间和工资资料。如有错误，请回复邮件或进入 KaiSpan 员工系统更新。</textarea></div>
        <div class="button-row employee-generate-row"><button class="primary-btn">生成邮件</button><button class="ghost-btn">清空输入</button></div>
        <div class="field employee-email-body"><label>生成后的邮件正文</label><textarea>大家好，

请在本周五 18:00 前确认本月员工资料、合同信息、Urlaubstag、工作时间和工资资料是否正确。如有需要修改的内容，请直接回复本邮件或在 KaiSpan 员工系统中更新。

谢谢。</textarea></div>
        <div class="button-row"><button class="ghost-btn">保存草稿</button><button class="primary-btn">发送邮件</button></div>
      </div>
      <div class="card employee-ai-side">
        <div class="section-title"><h2>通知与反馈记录</h2><span class="pill green">跟进中</span></div>
        <div class="employee-record-layout">
          <div class="employee-record-list">
            <div class="employee-record-item"><a class="employee-record-main" href="#${slug("employee", "邮件详情")}?mail=payroll-confirm"><span>今天 10:32</span><strong>我发送了工资资料确认邮件</strong><p>请在本周五 18:00 前确认本月员工资料、合同信息、Urlaubstag、工作时间和工资资料。</p><small>查看详情</small></a><div class="employee-mail-status" tabindex="0"><span>已确认</span><strong>2 / ${recipients.length}</strong><div class="employee-confirm-popover"><h3>确认详情</h3><p><strong>已确认：</strong>Kevin、Lisa</p><p><strong>未完成：</strong>Tom、Anna、张三</p><button class="ghost-btn">一键发送确认提醒</button></div></div></div>
            <div class="employee-record-item"><div class="employee-record-main"><span>今天 10:41</span><strong>Kevin 已打开邮件</strong><p>已查看合同、工时和 Urlaubstag 确认请求。</p></div><div class="employee-mail-status done" tabindex="0"><span>已确认</span><strong>Kevin</strong><div class="employee-confirm-popover"><h3>确认详情</h3><p>Kevin 已确认资料无误。</p><button class="ghost-btn">一键发送确认提醒</button></div></div></div>
            <div class="employee-record-item employee-record-reply" tabindex="0" role="button">
              <div class="employee-record-main"><span>今天 10:48</span>
              <strong>Lisa 回复了邮件 <b class="reply-icon">↩</b></strong>
              <p>点击查看员工回复内容。</p></div>
              <div class="employee-mail-status pending" tabindex="0"><span>待复核</span><strong>Lisa</strong><div class="employee-confirm-popover"><h3>确认详情</h3><p>Lisa 已反馈 Urlaubstag 需要修改。</p><button class="ghost-btn">一键发送确认提醒</button></div></div>
              <div class="employee-reply-preview"><h3>Lisa 的回复</h3><p>我这边 Urlaubstag 已用应该是 3 天，不是 0 天。请帮我更新后再确认工资资料，谢谢。</p></div>
            </div>
            <div class="employee-record-item"><div class="employee-record-main"><span>今天 11:05</span><strong>Tom 尚未反馈</strong><p>系统将在截止前 2 小时自动提醒一次。</p></div><div class="employee-mail-status todo" tabindex="0"><span>未确认</span><strong>Tom</strong><div class="employee-confirm-popover"><h3>确认详情</h3><p>Tom 尚未打开或回复这封邮件。</p><button class="ghost-btn">一键发送确认提醒</button></div></div></div>
          </div>
        </div>
      </div>
    </section>`;
}

function employeeInvitePage() {
  return `
    <div class="page-head">
      <div><h1>新增员工邀请</h1><p>输入员工邮箱并发送资料填写链接，让员工自行上传个人资料、证件和合同。</p></div>
      <div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("employee", "员工管理")}">返回员工管理</a><button class="primary-btn">sofortanmeldung</button></div>
    </div>
    <section class="grid grid-2 employee-invite-layout">
      <div class="card">
        <div class="section-title"><h2>公司先填写的信息</h2><span class="pill purple">创建邀请</span></div>
        <div class="form-grid employee-editor-form">
          ${field("员工邮箱", "name@example.com", "")}
          ${field("员工姓名（可选）", "员工可自行补充", "")}
          <div class="field"><label>所属门店</label><select>${stores.map(store => `<option>${store}</option>`).join("")}</select></div>
          <div class="field"><label>岗位</label><select><option>厨师</option><option>服务员</option><option>店长</option><option>吧台</option><option>厨房助理</option><option>清洁</option></select></div>
          <div class="field"><label>合同类型</label><select><option>全职</option><option>兼职</option><option>Minijob</option><option>Werkstudent</option></select></div>
          ${field("预计入职日期", "YYYY-MM-DD", "")}
          <div class="field"><label>邀请语言</label><select><option>中文 + Deutsch</option><option>中文</option><option>Deutsch</option><option>English</option></select></div>
        </div>
        <div class="field employee-email-body"><label>发送给员工的邮件内容</label><textarea>您好，

请点击下方链接填写您的员工资料，并上传护照或身份证、居留卡、Zusatzblatt、医保卡、银行卡、Steuernummer、Rentenversicherung Nr.、健康证以及合同相关文件。

完成后系统会自动同步到 KaiSpan 员工档案，店长会进行最终确认。</textarea></div>
        <div class="button-row"><button class="ghost-btn">保存草稿</button><button class="primary-btn">sofortanmeldung</button></div>
      </div>
      <div class="card employee-ai-side">
        <div class="section-title"><h2>员工需要提供的信息</h2><span class="pill blue">自助资料表</span></div>
        <div class="employee-doc-grid">
          ${["姓名、电话、邮箱、地址", "Steuernummer 与 Rentenversicherung Nr.", "护照或身份证上传", "居留卡上传并识别到期日期", "Zusatzblatt 上传（如有）", "是否学生，学生上传入学证明", "医保卡 Krankenkasse 上传", "银行卡 IBAN / BIC 上传并识别", "健康证 Belehrung 上传"].map((item, index) => `
            <div class="employee-doc-row invite-doc-row">
              <span>${item}</span>
              <strong>${index < 2 || index === 5 ? "填写" : "上传"}</strong>
            </div>
          `).join("")}
        </div>
        <div class="recognition-list" style="margin-top:14px">
          <div><span>合同识别</span><strong>Urlaubstag、薪资、工作时间</strong></div>
          <div><span>合同识别</span><strong>Kündigungsfrist、试用期</strong></div>
          <div><span>提交后</span><strong>进入员工档案待审核</strong></div>
          <div><span>AI 识别</span><strong>自动读取银行卡、居留卡到期日和合同信息</strong></div>
        </div>
      </div>
    </section>`;
}

function employeeMailDetailPage() {
  return `
    <div class="page-head">
      <div><h1>邮件详情</h1><p>查看已发送邮件正文、收件人和员工确认状态。</p></div>
      <a class="ghost-btn accent-back-btn" href="#${slug("employee", "AI邮件编辑")}?recipients=Kevin%2CLisa%2CTom%2CAnna%2C%E5%BC%A0%E4%B8%89">返回邮件编辑</a>
    </div>
    <section class="grid grid-2 employee-mail-detail-page">
      <div class="card">
        <div class="section-title"><h2>工资资料确认邮件</h2><span class="pill green">已发送</span></div>
        <div class="recognition-list">
          <div><span>发送时间</span><strong>今天 10:32</strong></div>
          <div><span>发件邮箱</span><strong>martin@martin-biergarten.de</strong></div>
          <div><span>收件员工</span><strong>Kevin、Lisa、Tom、Anna、张三</strong></div>
          <div><span>邮件主题</span><strong>请确认本月员工资料与排班信息</strong></div>
        </div>
        <div class="field employee-email-body" style="margin-top:14px"><label>邮件正文</label><textarea>大家好，

请在本周五 18:00 前确认本月员工资料、合同信息、Urlaubstag、工作时间和工资资料是否正确。如有需要修改的内容，请直接回复本邮件或在 KaiSpan 员工系统中更新。

谢谢。</textarea></div>
      </div>
      <div class="card">
        <div class="section-title"><h2>确认状态</h2><button class="ghost-btn">一键发送确认提醒</button></div>
        <div class="employee-doc-grid">
          ${["Kevin · 已确认", "Lisa · 已回复需复核", "Tom · 未确认", "Anna · 未确认", "张三 · 未确认"].map((item, index) => `
            <div class="employee-doc-row invite-doc-row">
              <span>${item}</span>
              <strong>${index === 0 ? "完成" : index === 1 ? "待复核" : "提醒"}</strong>
            </div>
          `).join("")}
        </div>
      </div>
    </section>`;
}

function employeeDetailPage() {
  const selectedName = state().params.get("name") || "Kevin";
  const row = employeeRows().find(item => item[0] === selectedName) || employeeRows()[0];
  const [name, store, role, contractType, hourlyRate, startDate, status, docStatus] = row;
  const vacationDays = name === "Lisa" ? "18 天 / 已用 3 天" : name === "Tom" ? "24 天 / 已用 1 天" : "24 天 / 已用 2 天";
  const monthlyHours = name === "Lisa" ? "84 h" : name === "Anna" ? "42 h" : "126.5 h";
  const monthlySalary = name === "Lisa" ? "€1,134.00" : name === "Anna" ? "€537.60" : "€1,960.75";
  return `
    <div class="page-head">
      <div><h1>编辑员工信息</h1><p>合同识别、员工自填资料和公司内部信息统一维护。</p></div>
      <div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("employee", "员工管理")}">返回员工管理</a><button class="primary-btn">保存修改</button></div>
    </div>
    <section class="employee-editor-layout">
      <div class="card employee-editor-main">
        <div class="section-title"><h2>员工需要提供的信息</h2><span class="pill ${docStatus === "正常" ? "green" : "orange"}">${docStatus}</span></div>
        <div class="form-grid employee-editor-form">
          ${field("姓名", "员工姓名", name)}
          ${field("街道", "例如 Hauptstrasse", "Hauptstrasse")}
          ${field("门牌号", "例如 12", "12")}
          ${field("邮编", "例如 44135", "44135")}
          ${field("城市", "例如 Dortmund", "Dortmund")}
          ${field("电话", "+49 ...", name === "Kevin" ? "+49 171 234567" : "+49 176 981234")}
          ${field("邮箱", "email@example.com", `${name.toLowerCase()}@example.com`)}
          ${field("Steuernummer", "请输入 Steuernummer", "123/456/78901")}
          ${field("Rentenversicherung Nr.", "请输入 Rentenversicherung Nr.", "12 123456 A 789")}
          <div class="field"><label>是否学生</label><select><option>否</option><option>是，需要上传入学证明</option></select></div>
          ${field("银行卡信息", "IBAN / BIC", "DE89 3704 0044 0532 0130 00 · COBADEFFXXX")}
        </div>
        <div class="employee-doc-grid" style="margin-top:14px">
          ${[
            ["护照 / 身份证", "已上传", ""],
            ["居留卡", "已识别到期日 2026-11-30", "非欧盟国籍需要"],
            ["Zusatzblatt", "待上传", "如居留卡附带"],
            ["学生入学证明", "已识别到期日 2027-03-31", "学生必填"],
            ["医保卡 Krankenkasse", "已上传", ""],
            ["银行卡", "已识别 IBAN / BIC", ""],
            ["健康证 Belehrung", "已识别到期日 2027-06-30", ""]
          ].map(doc => `<div class="employee-doc-row">
            <div class="employee-doc-meta">
              <span>${doc[0]}</span>
              <strong>${doc[1]}</strong>
              ${doc[2] ? `<small>${doc[2]}</small>` : ""}
            </div>
            <div class="employee-doc-actions">
              <button class="ghost-btn">选择文件</button>
              <button class="ghost-btn">重新上传</button>
              <button class="ghost-btn danger-lite">删除</button>
            </div>
          </div>`).join("")}
        </div>
      </div>
      <div class="card employee-contract-ai compact-contract-ai">
        <div class="section-title"><h2>合同需要识别的内容</h2><span class="pill blue">AI 识别</span></div>
        <div class="upload employee-upload-box">上传 Arbeitsvertrag / 合同 PDF 或照片</div>
        <div class="button-row employee-file-actions">
          <button class="ghost-btn">选择文件</button>
          <button class="ghost-btn">重新上传</button>
          <button class="ghost-btn danger-lite">删除</button>
        </div>
        <div class="recognition-list">
          <div class="recognition-success"><span>识别状态</span><select class="recognition-input"><option>${docStatus === "缺少文件" ? "缺少合同文件" : "已识别，可编辑确认"}</option><option>待人工确认</option><option>识别失败</option></select></div>
          <div><span>Urlaubstag</span><input class="recognition-input" value="${vacationDays.split(" / ")[0]}"></div>
          <div><span>薪资类型</span><select class="recognition-input"><option>时薪</option><option>月薪</option></select></div>
          <div><span>薪资金额</span><input class="recognition-input" value="${hourlyRate}"></div>
          <div><span>每周工作时间</span><input class="recognition-input" value="${contractType === "Minijob" ? "10 h" : "38.5 h"}"></div>
          <div><span>Kündigungsfrist</span><input class="recognition-input" value="4 周"></div>
          <div><span>试用期</span><input class="recognition-input" value="${name === "Tom" ? "至 2024-05-20" : "已结束"}"></div>
        </div>
      </div>
      <div class="card employee-editor-main">
        <div class="section-title"><h2>公司填写的信息</h2><span class="pill ${status === "离职" ? "red" : status === "试用期" ? "orange" : "green"}">${status}</span></div>
        <div class="form-grid employee-editor-form">
          ${field("所属门店", "门店", store)}
          ${field("岗位", "岗位", role)}
          <div class="field"><label>员工级别</label><select><option>普通</option><option>熟练</option><option>负责人</option><option>店长</option></select></div>
        </div>
      </div>
    </section>`;
}

function warehousePage() {
  return `
    <div class="page-head"><div><h1>仓库管理助手</h1><p>管理供应商、订单、上传凭证与损耗记录，及时处理采购异常。</p></div></div>
    <section class="warehouse-shortcuts" style="margin-bottom:18px">
      <div class="warehouse-shortcut-card warehouse-shortcut-suppliers">
        <span class="warehouse-shortcut-icon">${lucideHomeIcon()}</span>
        <div class="warehouse-shortcut-copy">
          <div class="warehouse-shortcut-head">
            <strong>供货商</strong>
          </div>
          <span>供货商管理，下单</span>
        </div>
        <div class="warehouse-shortcut-body">
          <span class="warehouse-mini-section-label">快速下单</span>
          <div class="warehouse-shortcut-supplier-list">
          ${suppliers.slice(0,4).map(s=>`<a class="warehouse-mini-supplier" href="#${slug("warehouse", "下单")}?supplier=${encodeURIComponent(s.replace(" Deutschland",""))}"><b>${s.replace(" Deutschland","")}</b><span>${s}</span><small>Email / Webshop · 送货 1-3天</small></a>`).join("")}
          </div>
        </div>
        <div class="warehouse-shortcut-footer warehouse-shortcut-actions"><a class="ghost-btn" href="#${slug("warehouse", "供应商管理")}">进入供货商管理</a></div>
      </div>
      <div class="warehouse-shortcut-card warehouse-shortcut-orders">
        <span class="warehouse-shortcut-icon">${lucideReceiptIcon()}</span>
        <div class="warehouse-shortcut-copy">
          <div class="warehouse-shortcut-head">
            <strong>订单管理</strong>
          </div>
          <span>订单管理和运单 / 账单上传</span>
        </div>
        <div class="warehouse-shortcut-body">
          <div class="warehouse-upload-box">
            <b>运单 / 账单上传</b>
            <span>拖拽上传 PDF / JPG / PNG / Excel</span>
            <small>自动生成采购列表或对账</small>
          </div>
          <div class="warehouse-mini-order-list">
            ${[
              ["PO-2405-21", "Metro Deutschland", "在配送", "blue"],
              ["PO-2405-19", "Transgourmet", "已送达", "green"],
              ["PO-2405-18", "JFC Deutschland", "等待校验", "orange"]
            ].map(x=>`<div class="warehouse-mini-line"><div><b>${x[0]}</b><span>${x[1]}</span></div><em class="pill ${x[3]}">${x[2]}</em></div>`).join("")}
          </div>
        </div>
        <div class="warehouse-shortcut-footer warehouse-shortcut-actions"><a class="ghost-btn" href="#${slug("warehouse", "订单管理")}">进入订单管理</a></div>
      </div>
      <div class="warehouse-shortcut-card warehouse-shortcut-loss">
        <span class="warehouse-shortcut-icon">${lucideAlertIcon()}</span>
        <div class="warehouse-shortcut-copy">
          <div class="warehouse-shortcut-head">
            <strong>损耗记录</strong>
          </div>
          <span>集中查看损耗金额、原因和登记入口</span>
        </div>
        <div class="warehouse-shortcut-body">
          <div class="warehouse-loss-metric">本月损耗：<b>€234.50</b></div>
          <div class="warehouse-mini-loss-list">
            ${[
              ["番茄", "6kg", "过期", "€18.40", "2025-05-24"],
              ["牛奶", "4L", "破损", "€9.20", "2025-05-23"],
              ["鸡胸肉", "2.5kg", "盘点差异", "€32.80", "2025-05-21"]
            ].map(x=>`<div class="warehouse-mini-loss-row"><b>${x[0]}</b><span>${x[1]}</span><span>${x[2]}</span><span>${x[3]}</span><span>${x[4]}</span></div>`).join("")}
          </div>
        </div>
        <div class="warehouse-shortcut-footer warehouse-shortcut-actions"><a class="ghost-btn" href="#${slug("warehouse", "损耗记录")}">进入损耗记录</a><a class="primary-btn" href="#${slug("warehouse", "损耗记录")}">快速登记损耗</a></div>
      </div>
    </section>
    <section class="card red-zone">
      <div class="section-title"><h2>待办事项</h2></div>
      <div class="warehouse-quick-actions">
        <a class="ghost-btn" href="#${slug("warehouse", "下单")}">快速下单</a>
        <a class="ghost-btn" href="#${slug("warehouse", "运单 / 账单上传")}">运单账单上传</a>
        <a class="ghost-btn" href="#${slug("warehouse", "损耗记录")}">损耗添加</a>
        <a class="ghost-btn" href="#${slug("warehouse", "订单管理")}">订单快速查看</a>
      </div>
      <div class="warn-list">${["Metro 订货日期截止到周三中午 12:00", "价格变动：鸡胸肉 2.5kg 价格上涨 8%", "账单与运单不匹配：JFC 订单金额不匹配", "账单与运单不匹配：CHEFS CULINAR 运单数量差异"].map(x=>`<div class="warn-item"><strong>${x}</strong><button class="ghost-btn">处理</button></div>`).join("")}</div>
    </section>`;
}

function supplierCard(name) {
  return `<div class="card supplier-card" style="box-shadow:none"><div class="supplier-logo">${name.replace(" Deutschland","")}</div><strong>${name}</strong><p>接单方式：Email / Webshop<br>送货：1-3天</p></div>`;
}

function warehousePurchasePage() {
  const supplierParam = state().params.get("supplier");
  const recommendations = [
    ["鸡胸肉 2.5kg", "Metro", "价格较上周上涨 8%，建议锁定本周用量", "€18.90", "orange"],
    ["番茄 6kg", "Metro", "本周常用量稳定，可一起加入采购单", "€18.40", "green"],
    ["清洁湿巾 12包", "Metro", "库存低于安全线，适合本次补货", "€12.90", "blue"],
    ["水牛芝士 500g", "Transgourmet", "新品到货，适合披萨和沙拉新品测试", "€6.80", "green"],
    ["寿司米 10kg", "JFC", "库存低于安全线，预计 3 天后不足", "€24.50", "blue"],
    ["BBQ 烧烤套餐", "CHEFS CULINAR", "周末啤酒花园需求高，可补活动套餐", "€42.00", "purple"]
  ];
  const products = [
    ["Metro", "番茄 6kg", "蔬菜", "€18.40", "本周常用", "green"],
    ["Metro", "鸡胸肉 2.5kg", "肉类", "€18.90", "价格上涨", "orange"],
    ["Metro", "清洁湿巾 12包", "清洁用品", "€12.90", "库存偏低", "blue"],
    ["Transgourmet", "水牛芝士 500g", "乳制品", "€6.80", "新品", "blue"],
    ["JFC", "寿司米 10kg", "干货", "€24.50", "库存偏低", "red"],
    ["CHEFS CULINAR", "BBQ 烧烤套餐", "肉类", "€42.00", "周末推荐", "purple"]
  ];
  const filteredRecommendations = supplierParam ? recommendations.filter(x => x[1] === supplierParam) : recommendations;
  const filteredProducts = supplierParam ? products.filter(x => x[0] === supplierParam) : products;
	  const cartRows = supplierParam === "Metro"
	    ? [["Metro", "鸡胸肉 2.5kg", "2 箱", "€37.80"], ["Metro", "番茄 6kg", "1 箱", "€18.40"], ["Metro", "清洁湿巾 12包", "1 箱", "€12.90"]]
	    : [["Metro", "鸡胸肉 2.5kg", "2 箱", "€37.80"], ["Transgourmet", "水牛芝士 500g", "8 包", "€54.40"], ["JFC", "寿司米 10kg", "3 袋", "€73.50"]];
	  const total = supplierParam === "Metro" ? "€69.10" : "€165.70";
	  const bruttoTotal = supplierParam === "Metro" ? "€80.84" : "€177.44";
	  const cartHref = `#${slug("warehouse", "购物车")}${supplierParam ? `?supplier=${encodeURIComponent(supplierParam)}` : ""}`;
	  const angebotRows = [
	    ["橄榄油 Extra Vergine", "1L / 瓶", "€5.90", "€6.32", "-9%", "Metro", "有效至 2025-05-31", "olive", "适合本周补货"],
	    ["鸡胸肉 2.5kg", "2.5kg / 包", "€18.90", "€20.22", "-6%", "Metro", "有效至 2025-05-29", "meat", "价格波动，建议锁量"],
	    ["水牛芝士 500g", "500g / 包", "€6.80", "€7.28", "-12%", "Transgourmet", "有效至 2025-06-02", "cheese", "新品 Angebot"],
	    ["寿司米 10kg", "10kg / 袋", "€24.50", "€26.22", "-5%", "JFC", "有效至 2025-05-30", "rice", "库存偏低"]
	  ].filter(x => !supplierParam || x[5] === supplierParam);
	  const featuredRows = [
	    ...angebotRows.map(x => ["Angebot", x[0], x[5], `${x[1]} · ${x[8]}`, x[2], x[7] === "olive" ? "purple" : "orange", `${x[4]} · ${x[6]}`]),
	    ...filteredRecommendations.map(x => ["AI 推荐", x[0], x[1], x[2], x[3], x[4], "根据库存、价格和常用量推荐"])
	  ].slice(0, 4);
  const b2bProducts = [
    ["Metro", "鸡胸肉 2.5kg", "2.5kg/包", "MET-CH-2500", "€18.90", "€20.22", "7%", "€17.42", "+8.5%", "有货", "1箱", "箱", ["常购", "价格上涨", "推荐"], "orange", "当前库存 6箱", "正常周期 10箱", "建议订货 4箱"],
    ["Metro", "番茄 6kg", "6kg/箱", "MET-TOM-6000", "€18.40", "€19.69", "7%", "€18.20", "+1.1%", "有货", "1箱", "箱", ["常购", "收藏"], "green", "当前库存 3箱", "正常周期 8箱", "建议订货 5箱"],
    ["Metro", "清洁湿巾 12包", "12包/箱", "MET-CLE-12", "€12.90", "€15.35", "19%", "€12.90", "0%", "低库存", "1箱", "箱", ["库存风险", "推荐"], "blue", "当前库存 1箱", "正常周期 4箱", "建议订货 3箱"],
    ["Transgourmet", "水牛芝士 500g", "500g/包", "TG-MOZ-500", "€6.80", "€7.28", "7%", "€7.10", "-4.2%", "有货", "6包", "包", ["Angebot", "新品"], "green", "当前库存 8包", "正常周期 12包", "建议订货 4包"],
    ["JFC", "寿司米 10kg", "10kg/袋", "JFC-RICE-10", "€24.50", "€26.22", "7%", "€25.30", "-3.2%", "低库存", "1袋", "袋", ["库存风险", "替代商品可用"], "red", "当前库存 2袋", "正常周期 6袋", "建议订货 4袋"],
    ["CHEFS CULINAR", "BBQ 烧烤套餐", "1套/箱", "CC-BBQ-01", "€42.00", "€44.94", "7%", "€40.50", "+3.7%", "有货", "1箱", "箱", ["周末推荐", "常购"], "purple", "当前库存 2箱", "正常周期 5箱", "建议订货 3箱"]
  ].filter(x => !supplierParam || x[0] === supplierParam);
  const historyRows = [
    ["PO-2405-16", "2025-05-17", supplierParam || "Metro", "€412.16"],
    ["PO-2405-09", "2025-05-10", supplierParam || "Metro", "€386.40"],
    ["PO-2404-28", "2025-04-28", supplierParam || "Metro", "€298.70"]
  ];
  const currentUserRole = "老板";
  const directOrderNeedsApproval = currentUserRole !== "老板";
  const requireCountFirst = state().params.get("countFirst") !== "0";
  const hasCompletedCount = false;
  const orderLocked = requireCountFirst && !hasCompletedCount;
  const countFirstParams = new URLSearchParams(state().params);
  if (requireCountFirst) {
    countFirstParams.set("countFirst", "0");
  } else {
    countFirstParams.delete("countFirst");
  }
  const countFirstHref = `index.html#${state().route}${countFirstParams.toString() ? "?" + countFirstParams.toString() : ""}`;
  const purchaseBackHref = supplierParam ? `#${slug("warehouse", "供应商管理")}` : `#warehouse`;
  return `
    <div class="purchase-page">
      <div class="page-head"><div><h1>${supplierParam ? `${supplierParam} 下单` : "下单"}</h1><p>${supplierParam ? `当前只显示 ${supplierParam} 的 AI 推荐、Angebot 和可下单商品。` : "AI建议采购 → 查看 Angebot → 点货修正数量 → 商品下单 → 提交订单。"}</p></div><a class="ghost-btn accent-back-btn" href="${purchaseBackHref}">返回</a></div>
      <section class="card purchase-flow-card">
        <div>
          <h2>点货 / 下单流程</h2>
          <p>建议先完成点货，系统会根据当前库存自动修正采购数量，减少多买、漏买和库存浪费。</p>
        </div>
        <div class="flow-action-group"><div class="button-row"><button class="primary-btn">开始点货</button><span class="approval-order-action"><button class="ghost-btn" ${orderLocked ? "disabled" : ""}>直接下单</button><span class="approval-tip" tabindex="0" aria-label="${directOrderNeedsApproval ? "需老板授权。非老板账户点击“直接下单”后，会先提交给老板审批。" : "老板账户可直接下单。当前为老板账户；其他账户点击“直接下单”时需要先授权。"}">!</span><span class="approval-tooltip"><strong>${directOrderNeedsApproval ? "需老板授权" : "老板账户可直接下单"}</strong><small>${directOrderNeedsApproval ? "非老板账户点击“直接下单”后，会先提交给老板审批。" : "当前为老板账户；其他账户点击“直接下单”时需要先授权。"}</small></span></span></div></div>
        <a class="flow-toggle ${requireCountFirst ? "is-on" : ""}" id="countFirstToggle" href="${countFirstHref}" role="button" aria-pressed="${requireCountFirst ? "true" : "false"}"><span></span><strong>建议先点货后下单</strong><small>${orderLocked ? "已开启：未完成点货前，下方商品暂时不能下单" : "已关闭：下方商品可直接添加并进入购物车"}</small></a>
      </section>
      <section class="purchase-workspace">
        <div class="purchase-main">
          <section class="card ${orderLocked ? "order-locked-card" : ""}">
            <div class="section-title"><h2>商品下单</h2><span class="pill blue">B2B Webshop</span></div>
            <div class="order-search-bar">
              <input placeholder="搜索商品名称、SKU、供应商货号、条形码">
              <select><option>全部分类</option><option>肉类</option><option>蔬菜</option><option>清洁用品</option></select>
              <select><option>${supplierParam || "全部供应商"}</option><option>Metro</option><option>Transgourmet</option><option>JFC</option></select>
              <input placeholder="价格区间">
            </div>
            <div class="purchase-tabs">${["全部商品","收藏商品","Angebot"].map((x,i)=>`<button class="filter ${i===1?"active":""}">${x}</button>`).join("")}</div>
            <div class="quick-actions">
              <details class="history-picker">
                <summary>复制历史订单</summary>
                <div class="history-choice-list">
                  ${historyRows.map((x,i)=>`
                    <label class="history-choice">
                      <input type="radio" name="history-order" ${i===0 ? "checked" : ""}>
                      <span><strong>${x[0]}</strong><small>${x[2]} · ${x[1]}</small></span>
                      <b>${x[3]}</b>
                      <button class="ghost-btn" type="button">复制</button>
                    </label>`).join("")}
                </div>
              </details>
            </div>
            ${orderLocked ? `<div class="order-lock-banner"><strong>请先完成点货</strong><span>当前已开启“建议先点货后下单”，完成点货前无法添加商品或进入购物车。</span></div>` : ""}
            <div class="product-order-list">${b2bProducts.map(x=>`
              <article class="product-order-row">
                <div class="product-thumb ${x[13]}"></div>
                <div class="product-info">
                  <strong>${x[1]}</strong>
                  <p>${x[2]} · SKU ${x[3]} · ${x[0]}</p>
                  <div class="tag-row">${x[12].map(t=>`<span class="pill ${x[13]}">${t}</span>`).join("")}</div>
                  <small>Kai：${x[8].startsWith("+") ? "该商品价格比近期均价偏高，建议控制数量或查看替代商品。" : "该商品价格低于上次采购，可考虑补货。"}</small>
                </div>
                <div class="product-price"><span>Netto</span><strong>${x[4]}</strong><small>Brutto ${x[5]} · MwSt ${x[6]}</small><em>上次 ${x[7]} · ${x[8]}</em></div>
                <div class="product-side-panel">
                  <div class="stock-box"><span class="pill ${x[9]==="有货"?"green":x[9]==="低库存"?"orange":"red"}">${x[9]}</span><small>最小订购 ${x[10]}</small></div>
                  <div class="inventory-box"><span>${x[14]}</span><span>${x[15]}</span></div>
	                  <div class="order-quantity-display"><span>选购数量</span><div><input value="${x[16].replace("建议订货 ", "").replace(x[11], "")}" ${orderLocked ? "disabled" : ""}><select ${orderLocked ? "disabled" : ""}><option>${x[11]}</option><option>kg</option><option>件</option><option>包</option></select></div></div>
                </div>
		              </article>`).join("")}</div>
		            <div class="purchase-total-bar">
		              <div><span>采购金额 Netto</span><strong>${total}</strong></div>
		              <div><span>MwSt</span><strong>€11.74</strong></div>
		              <div><span>Brutto</span><strong>${bruttoTotal}</strong></div>
		              ${orderLocked ? `<button class="primary-btn" disabled>添加并进入购物车 →</button>` : `<a class="primary-btn" href="${cartHref}">添加并进入购物车 →</a>`}
		            </div>
		          </section>
		        </div>
		      </section>
		      <section class="card purchase-featured-card">
	        <div class="section-title"><h2>Angebot 和 AI 推荐商品</h2><span class="pill purple">${supplierParam || "全部供应商"}</span></div>
	        <div class="purchase-reco-row">
	          ${featuredRows.map(x=>`
	            <article class="purchase-reco ${x[5]}">
	              <span>${x[0]} · ${x[2]}</span>
	              <strong>${x[1]}</strong>
	              <p>${x[3]}</p>
	              <div><b>${x[4]}</b><button>加入</button></div>
	              <small>${x[6]}</small>
	            </article>`).join("")}
	        </div>
	      </section>
	    </div>`;
}

function warehouseCartPage() {
  const supplierParam = state().params.get("supplier");
  const cartRows = supplierParam === "Metro"
    ? [["鸡胸肉 2.5kg", "Metro", "2 箱", "7%", "€18.90", "€37.80"], ["番茄 6kg", "Metro", "1 箱", "7%", "€18.40", "€18.40"], ["清洁湿巾 12包", "Metro", "1 箱", "19%", "€12.90", "€12.90"]]
    : [["鸡胸肉 2.5kg", "Metro", "2 箱", "7%", "€18.90", "€37.80"], ["水牛芝士 500g", "Transgourmet", "8 包", "7%", "€6.80", "€54.40"], ["寿司米 10kg", "JFC", "3 袋", "7%", "€24.50", "€73.50"]];
  const netto = supplierParam === "Metro" ? "€69.10" : "€165.70";
  const mwst = supplierParam === "Metro" ? "€11.74" : "€11.74";
  const brutto = supplierParam === "Metro" ? "€80.84" : "€177.44";
  return `
    <div class="page-head"><div><h1>购物车</h1><p>确认本次采购商品、Netto / Brutto 金额、配送时间和异常提示。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("warehouse", "下单")}${supplierParam ? `?supplier=${encodeURIComponent(supplierParam)}` : ""}">返回下单</a></div>
    <section class="grid grid-4">
      ${[["当前供应商", supplierParam || "全部"],["商品数量", `${cartRows.length}件`],["Netto 合计", netto],["Brutto 合计", brutto]].map(x=>`<div class="card compact-stat"><p>${x[0]}</p><div class="metric-value">${x[1]}</div></div>`).join("")}
    </section>
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>商品明细</h2><span class="pill purple">${cartRows.length} 件商品</span></div>
        <div class="cart-detail-table">
          <div class="cart-detail-head"><span>商品</span><span>订购数量</span><span>MwSt</span><span>Netto 单价</span><span>Netto 总价</span></div>
          ${cartRows.map(x=>`<div class="cart-detail-row"><div><strong>${x[0]}</strong><small>${x[1]}</small></div><span>${x[2]}</span><span>${x[3]}</span><span>${x[4]}</span><strong>Netto ${x[5]}</strong></div>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="section-title"><h2>订单汇总</h2><span class="pill green">可提交</span></div>
        <div class="cart-summary cart-page-summary"><div><span>Netto 合计</span><strong>${netto}</strong></div><div><span>MwSt</span><strong>${mwst}</strong></div><div><span>Brutto 合计</span><strong>${brutto}</strong></div></div>
        <div class="cart-alerts"><p>预计配送：周四 09:00-12:00</p><p>已达到最低起送金额</p><p>异常：鸡胸肉价格上涨 +8.5%，建议确认采购数量。</p></div>
        <div class="button-row"><button class="ghost-btn">保存为草稿</button><button class="ghost-btn">发送审批</button><button class="primary-btn">提交订单</button></div>
      </div>
    </section>`;
}

function warehouseOrdersPage() {
  const orders = [
    ["PO-2405-21", "Metro Deutschland", "Martin Biergarten", "蔬菜 / 清洁用品", "€980.20", "今天 15:30", "在配送", "blue", "司机已出发，预计 42 分钟后到达"],
    ["PO-2405-19", "Transgourmet", "Martin Cafe", "冷冻品 / 乳制品", "€1,245.60", "今天 11:20", "已送达", "green", "等待门店确认数量"],
    ["PO-2405-18", "JFC Deutschland", "Martin Biergarten", "亚洲调料 / 米面", "€476.00", "昨天 17:10", "等待校验", "orange", "Lieferschein 已上传，账单待匹配"],
    ["PO-2405-17", "CHEFS CULINAR", "Martin Biergarten 2", "肉类 / 酱料", "€734.90", "昨天 09:35", "有问题", "red", "账单金额与运单数量不一致"],
    ["PO-2405-14", "FrischeParadies", "Martin Cafe", "海鲜 / 高端食材", "€312.40", "2025-05-22", "已完成", "purple", "已入库并完成对账"]
  ];
  return `
    <div class="page-head"><div><h1>订单管理</h1><p>跟踪采购订单配送、收货、单据校验和异常处理状态。</p></div><div class="button-row">${warehouseBackButton()}</div></div>
    <section class="grid grid-5">
      ${[["在配送","1单","blue"],["已送达","1单","green"],["等待校验","1单","orange"],["已完成","1单","purple"],["有问题","1单","red"]].map(x=>`<div class="card compact-stat"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>采购订单</h2><button class="ghost-btn">重置筛选</button></div>
      <div class="order-filter-bar">
        <label><span>日期</span><select><option>全部日期</option><option>今天</option><option>昨天</option><option>本周</option></select></label>
        <label><span>状态</span><select><option>全部状态</option><option>在配送</option><option>已送达</option><option>等待校验</option><option>已完成</option><option>有问题</option></select></label>
        <label><span>供货商</span><select><option>全部供货商</option><option>Metro Deutschland</option><option>Transgourmet</option><option>JFC Deutschland</option><option>CHEFS CULINAR</option></select></label>
        <label><span>品类</span><select><option>全部品类</option><option>蔬菜 / 清洁用品</option><option>冷冻品 / 乳制品</option><option>亚洲调料 / 米面</option><option>肉类 / 酱料</option></select></label>
      </div>
      <div class="table-scroll">
        <table class="table order-table">
          <thead><tr><th>订单号</th><th>供应商</th><th>门店</th><th>品类</th><th>金额</th><th>预计 / 实际时间</th><th>状态</th><th>下一步</th><th>操作</th></tr></thead>
          <tbody>${orders.map(r=>`<tr>
            ${r.slice(0,6).map(c=>`<td>${c}</td>`).join("")}
            <td><span class="pill ${r[7]}">${r[6]}</span></td>
            <td>${r[8]}</td>
            <td><button class="ghost-btn">查看</button></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    <section style="margin-top:16px">
      <div class="card red-zone"><div class="section-title"><h2>需要处理</h2><span class="pill red">3 个问题</span></div>${["CHEFS CULINAR：账单金额与运单数量不一致", "JFC：等待 Rechnung 上传后完成校验", "Metro：采购目录价格需要更新"].map(x=>`<div class="warn-item"><strong>${x}</strong><button class="ghost-btn">处理</button></div>`).join("")}</div>
    </section>`;
}

function supplierManagePage() {
  const supplierRows = [
    ["Metro Deutschland","基础食材 / 饮料 / 清洁","Email / Webshop","周四","周三 12:00","常用"],
    ["Transgourmet Deutschland","大宗食材 / 冷冻品","Webshop","周三 / 周五","前一日 16:00","常用"],
    ["JFC Deutschland","亚洲调料 / 米面","Email","周二","周一 14:00","常用"],
    ["CHEFS CULINAR","肉类 / 乳制品","Email / Webshop","周五","周四 12:00","常用"],
    ["FrischeParadies","高端食材 / 海鲜","Webshop","按需","提前 24 小时","备选"]
  ];
  return `
    <div class="page-head"><div><h1>供应商管理</h1><p>查看当前供货商信息、接单方式、产品类型、送货设置和合同文件。</p></div><div class="button-row">${warehouseBackButton()}</div></div>
    <section class="grid grid-4">
      ${[["当前供应商","5家","blue"],["常用供应商","4家","green"],["待补资料","2项","red"],["本周价格更新","3条","purple"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-title"><h2>当前供货商</h2><span class="pill blue">可编辑 / 删除</span></div>
      <table class="table">
        <thead><tr><th>供应商</th><th>产品类型</th><th>接单方式</th><th>送货日</th><th>订货截止</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${supplierRows.map(r=>`<tr>${r.map((c,i)=>`<td>${i===5?`<span class="pill ${c==="常用"?"green":"blue"}">${c}</span>`:c}</td>`).join("")}<td><div class="button-row"><a class="ghost-btn success-btn" href="#${slug("warehouse", "下单")}?supplier=${encodeURIComponent(r[0].replace(" Deutschland",""))}">快速下单</a><a class="ghost-btn" href="#${slug("warehouse", "供应商单据历史")}?supplier=${encodeURIComponent(r[0])}">单据/历史</a><a class="ghost-btn" href="#${slug("warehouse", "编辑供应商")}?supplier=${encodeURIComponent(r[0])}">编辑</a><button class="ghost-btn danger-btn">删除</button></div></td></tr>`).join("")}</tbody>
      </table>
    </section>
    <section class="grid grid-2" style="margin-top:14px">
      <div class="card"><h2>资料缺失提醒</h2>${["JFC 缺少最新价目表","FrischeParadies 缺少合同文件"].map(x=>`<div class="status-line">${x}<button class="ghost-btn">补充</button></div>`).join("")}</div>
      <a class="card add-dashed" href="#supplier-add" style="text-decoration:none;color:inherit;min-height:150px"><h2>+ 添加供应商</h2><p>录入基本信息、联系人、订货截止时间、预计送货日期，并上传价目表或 Katalog。</p></a>
    </section>`;
}

function supplierHistoryPage() {
  const supplier = state().params.get("supplier") || "Metro Deutschland";
  const shortName = supplier.replace(" Deutschland", "");
  const orderRows = [
    ["PO-2405-21", "2025-05-21", "3 件商品", "Netto €69.10", "Brutto €80.84", "已提交"],
    ["PO-2405-16", "2025-05-17", "12 件商品", "Netto €412.16", "Brutto €441.01", "已完成"],
    ["PO-2405-09", "2025-05-10", "10 件商品", "Netto €386.40", "Brutto €413.45", "已完成"],
    ["PO-2404-28", "2025-04-28", "8 件商品", "Netto €298.70", "Brutto €319.61", "已完成"]
  ];
  const billRows = [
    ["Metro Rechnung 2025-05-21.pdf", "Rechnung", "€80.84", "已匹配", "green"],
    ["Metro Lieferschein 2025-05-21.pdf", "Lieferschein", "3 件商品", "已匹配", "green"],
    ["Metro Preisliste Mai.xlsx", "价目表", "2025-05", "待复核", "orange"]
  ];
  return `
    <div class="page-head"><div><h1>${shortName} 历史采购记录及账单</h1><p>查看该供应商的历史订单、Rechnung、Lieferschein 和价目表文件。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("warehouse", "供应商管理")}">返回供应商管理</a></div>
    <section class="grid grid-4">
      ${[["供应商", shortName, "blue"],["历史订单", `${orderRows.length}单`, "purple"],["账单文件", `${billRows.length}份`, "green"],["待复核", "1项", "orange"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>历史采购记录</h2><span class="pill blue">${shortName}</span></div>
        <table class="table">
          <thead><tr><th>订单号</th><th>日期</th><th>商品</th><th>Netto</th><th>Brutto</th><th>状态</th></tr></thead>
          <tbody>${orderRows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td><span class="pill green">${r[5]}</span></td></tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="card">
        <div class="section-title"><h2>账单 / 运单 / 文件</h2><button class="ghost-btn">上传文件</button></div>
        ${billRows.map(r=>`<div class="doc-row"><div><strong>${r[0]}</strong><span>${r[1]} · ${r[2]}</span></div><span class="pill ${r[4]}">${r[3]}</span><button class="ghost-btn">查看</button></div>`).join("")}
      </div>
    </section>`;
}

function warehouseUploadPage() {
  const recentUploads = [
    ["Metro Rechnung.pdf", "Rechnung", "Metro Deutschland", "10:42", "已识别", "green"],
    ["JFC Lieferschein.jpg", "Lieferschein", "JFC Deutschland", "11:05", "识别中", "blue"],
    ["CHEFS CULINAR Rechnung.pdf", "Rechnung", "CHEFS CULINAR", "昨天", "需审批", "red"]
  ];
  const matchRows = [
    ["Metro Rechnung.pdf", "PO-2405-18", "Rechnung + Bestellung", "已匹配", "green"],
    ["JFC Lieferschein.jpg", "PO-2405-21", "缺少 Rechnung", "待补账单", "orange"],
    ["CHEFS CULINAR Rechnung.pdf", "PO-2405-24", "金额差异 €42.80", "需审批", "red"]
  ];
  return `
    <div class="page-head"><div><h1>运单 / 账单上传</h1><p>上传 Lieferschein 和 Rechnung，Kai 自动识别并匹配订单与采购记录。</p></div></div>
    <section class="grid grid-4">
      ${[["今日上传","3份","blue"],["识别完成","2份","green"],["待人工确认","1项","orange"],["异常匹配","2项","red"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="upload-dashboard" style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>上传文件</h2><span class="pill purple">AI 识别</span></div>
        <div class="upload upload-panel">
          <strong>拖拽上传 PDF / JPG / PNG</strong>
          <span>AI 自动识别供应商、金额、税额、日期、订单号，并匹配订单与收货记录。</span>
          <div class="doc-chip-row">
            <button class="ghost-btn">上传 Rechnung</button>
            <button class="ghost-btn">上传 Lieferschein</button>
          </div>
        </div>
      </div>
    </section>
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>订单 / 运单 / 账单匹配中心</h2><span class="pill green">自动核对</span></div>
        <div class="match-list">${matchRows.map(r=>`
          <div class="doc-row">
            <div><strong>${r[0]}</strong><span>${r[1]} · ${r[2]}</span></div>
            <span class="pill ${r[4]}">${r[3]}</span>
            <button class="ghost-btn">查看</button>
          </div>`).join("")}</div>
      </div>
      <div class="card red-zone">
        <h2>需要处理的异常</h2>
        <div class="warn-list">
          ${["JFC 订单金额与账单金额不一致", "CHEFS CULINAR 运单数量差异", "Metro 缺少送货单"].map(x=>`<div class="warn-item"><strong>${x}</strong><button class="ghost-btn">查看处理</button></div>`).join("")}
        </div>
      </div>
    </section>
    <section style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>最近上传记录</h2><button class="ghost-btn">批量导出</button></div>
        <table class="table">
          <thead><tr><th>文件</th><th>类型</th><th>供应商</th><th>时间</th><th>AI 状态</th><th>操作</th></tr></thead>
          <tbody>${recentUploads.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[5]}">${r[4]}</span></td><td><button class="ghost-btn">查看</button></td></tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function warehouseLossPage() {
  const lossRows = [
    ["番茄", "6kg", "过期", "€18.40", "Martin Biergarten", "2025-05-24", "已确认", "green"],
    ["牛奶", "4L", "破损", "€9.20", "Martin Biergarten", "2025-05-23", "已确认", "green"],
    ["鸡胸肉", "2.5kg", "盘点差异", "€32.80", "Martin Biergarten", "2025-05-21", "待店长确认", "orange"],
    ["水牛芝士", "1.5kg", "冷藏温度异常", "€41.60", "Martin Cafe", "2025-05-20", "需复核", "red"],
    ["寿司米", "3kg", "包装破损", "€12.30", "Martin Biergarten 2", "2025-05-19", "已确认", "green"]
  ];
  const categoryRows = [
    ["过期", "€68.40", "29%", "red"],
    ["破损", "€31.50", "13%", "orange"],
    ["盘点差异", "€82.80", "35%", "blue"],
    ["温度异常", "€51.80", "23%", "purple"]
  ];
  return `
    <div class="page-head"><div><h1>损耗记录</h1><p>记录商品过期、破损、报废、温度异常和盘点差异，帮助老板看到损耗金额与原因。</p></div><div class="button-row">${warehouseBackButton()}</div></div>
    <section class="grid grid-4">
      ${[["本月损耗","€234.50","red"],["待确认记录","2项","orange"],["高频损耗商品","3个","blue"],["较上月变化","-8%","green"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>新增损耗记录</h2><span class="pill purple">快速录入</span></div>
        <div class="form-grid">
          ${field("商品名称", "例如：番茄 / 鸡胸肉 / 水牛芝士")}
          ${field("数量", "例如：6kg / 4L / 2.5kg")}
          ${field("预估金额", "€0.00")}
          <div class="field"><label>损耗原因</label><select><option>过期</option><option>破损</option><option>变质</option><option>冷藏温度异常</option><option>盘点差异</option><option>报废</option></select></div>
          <div class="field"><label>相关门店</label><select>${stores.map(s=>`<option>${s}</option>`).join("")}</select></div>
          ${field("备注", "例如：收货时包装破损，已拍照")}
        </div>
        <div class="upload" style="margin-top:14px;min-height:82px">上传照片 / Liefererschein / 盘点截图<br><span class="small">可作为店长确认和供应商沟通凭证</span></div>
        <div class="button-row"><button class="ghost-btn">保存草稿</button><button class="primary-btn">提交损耗记录</button></div>
      </div>
      <div class="card">
        <div class="section-title"><h2>损耗原因分布</h2><span class="pill blue">本月</span></div>
        <div class="loss-category-grid">${categoryRows.map(x=>`
          <div class="loss-category">
            <span class="pill ${x[3]}">${x[0]}</span>
            <strong>${x[1]}</strong>
            <small>${x[2]} 占比</small>
          </div>`).join("")}</div>
        <div class="card red-zone" style="box-shadow:none;margin-top:14px">
          <h2>需要关注</h2>
          <div class="status-line">鸡胸肉连续 2 周出现盘点差异<button class="ghost-btn">查看原因</button></div>
          <div class="status-line">水牛芝士涉及冷藏温度异常<button class="ghost-btn">关联 HACCP</button></div>
        </div>
      </div>
    </section>
    <section style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>损耗明细</h2><button class="ghost-btn">导出 Excel</button></div>
        <table class="table loss-table">
          <thead><tr><th>商品</th><th>数量</th><th>原因</th><th>金额</th><th>门店</th><th>日期</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${lossRows.map(r=>`<tr>${r.slice(0,6).map(c=>`<td>${c}</td>`).join("")}<td><span class="pill ${r[7]}">${r[6]}</span></td><td><button class="ghost-btn">查看</button></td></tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function supplierAddPage(source = "warehouse") {
  const categories = ["蔬菜水果","肉类 / 禽类","鱼类 / 海鲜","乳制品 / 奶酪","饮料 / 酒水","干货 / 调料","冷冻食品","预制产品","面包 / 烘焙","清洁用品","包装用品","Non Food","其他"];
  const isEdit = source === "edit";
  const supplierName = state().params.get("supplier") || "Metro Deutschland";
  const backLink = source === "opening" ? `<a class="ghost-btn accent-back-btn" href="#${slug("opening", "供应商搭建")}">返回供应商搭建</a>` : isEdit ? `<a class="ghost-btn accent-back-btn" href="#${slug("warehouse", "供应商管理")}">返回供应商管理</a>` : "";
  const title = isEdit ? "编辑供应商" : "添加供应商";
  const subtitle = isEdit ? "编辑供应商基本信息、接单方式、产品类型、联系人和订货交货设置。" : "确认基本信息后，Kai 会识别价目表 / 账单 / Katalog 并生成采购列表。";
  return `
    <div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div>${backLink}</div>
    <div class="card"><div class="steps">${["基本信息","采购列表确认","完成"].map((s,i)=>`<div class="step ${i===0?"active":""}"><span class="step-dot">${i+1}</span>${s}</div>`).join("")}</div></div>
    <section class="card" style="margin-top:18px">
      <h2>基本信息</h2>
      <div class="form-grid">
        ${field("供应商名称 *", "请输入供应商名称，如：Metro Deutschland", isEdit ? supplierName : "")}
        ${field("品牌 / 公司名称（可选）", "如：METRO AG", isEdit ? supplierName.replace(" Deutschland", "") : "")}
        <div class="field"><label>接订单方式 *</label><select><option>Email</option><option>WhatsApp</option><option>Webshop</option></select></div>
        <div class="field"><label>VAT 税号（可选）</label><input placeholder="DE123456789"></div>
      </div>
      <h3 style="margin-top:20px">供应商产品类型 *</h3>
      <div class="checks" style="margin-top:12px">${categories.map((c,i)=>`<label class="check"><input type="checkbox" ${[0,1,4,6,7,8].includes(i)?"checked":""}> ${c}</label>`).join("")}</div>
    </section>
    <section class="card" style="margin-top:18px"><h2>订货与交货设置</h2><div class="form-grid">${field("下次订货截止日期", "选择日期 + 时间")}${field("下次订货后预计送货日期", "选择日期 + 时间")}</div></section>
    <section class="grid grid-3" style="margin-top:18px">
      <div class="card"><h2>生成采购列表</h2><div class="upload">上传价目表 / 账单 / Katalog<br><span class="small">支持 PDF / Excel / CSV / 图片</span></div></div>
      <div class="card"><h2>供应商联系人信息</h2>${["联系人姓名","职位","手机号","电子邮箱","固定电话","联系地址"].map(x=>field(x,"请输入"+x)).join("")}</div>
      <div class="card"><h2>其他信息</h2>${["供应商网站","总部地址","付款条件","备注信息"].map(x=>field(x,"请输入"+x)).join("")}<label class="check"><input type="checkbox" checked> 是否为常用供应商</label></div>
    </section>
    <div style="margin-top:18px;display:flex;justify-content:space-between"><a class="ghost-btn" href="#${slug("warehouse", "供应商管理")}">取消</a><button class="primary-btn">${isEdit ? "保存供应商信息" : "确认，检查采购列表 →"}</button></div>`;
}

function field(label, placeholder, value = "") {
  return `<div class="field"><label>${label}</label><input ${value ? `value="${value}"` : `placeholder="${placeholder}"`}></div>`;
}

function selectField(label, options) {
  return `<div class="field"><label>${label}</label><select>${options.map(option=>`<option>${option}</option>`).join("")}</select></div>`;
}

function taxAdvisorAd() {
  return `<section class="tax-ad tax-ad-slot card">kaispan和税务师组合广告位</section>`;
}

function financePage() {
  const de = currentLanguage() === "de";
  const copy = de ? {
    title: "Finanzübersicht",
    subtitle: "Behalten Sie Finanzen, Rechnungen und Zahlungen im Blick, damit der Cashflow gesund bleibt.",
    tasksTitle: "Finanzaufgaben",
    tasks: [
      "Eine JFC-Rechnung stimmt nicht mit dem Lieferschein überein",
      "Zwei Metro-Rechnungen sind doppelt",
      "Eine Metro-Rechnung ist bis 15.06 zu bezahlen",
      "Eine Rechnung benötigt eine Kontierungsprüfung",
      "Beim Abgleich mit dem Kontoauszug fehlen zwei Rechnungen, bitte zeitnah hochladen"
    ],
    action: "Bearbeiten",
    uploadTitle: "Externer Rechnungs-Upload",
    uploadMain: "PDF / JPG / PNG hierher ziehen",
    uploadSub: "Unterstützt Lieferantenrechnungen, Belege und Plattformabrechnungen",
    uploads: [
      ["Metro Rechnung.pdf", "Erkannt", "green"],
      ["JFC Invoice.png", "Wird erkannt", "blue"],
      ["Lieferando Auszahlung.pdf", "Erkannt", "green"],
      ["Uber Eats Wochenabrechnung.pdf", "Zur Bestätigung", "orange"],
      ["Transgourmet Rechnung.pdf", "Betrag zu prüfen", "red"]
    ],
    cashTitle: "Cashflow-Überblick",
    cash: [
      ["Einkauf gesamt", "€16,730", "blue"],
      ["Offene Zahlungen", "€3,245", "red"],
      ["Kontoveränderung in 7 Tagen", "-€1,420", "orange"],
      ["Kontoveränderung in 15 Tagen", "-€3,245", "red"]
    ],
    ledgerTitle: "Tägliche Abrechnung",
    ledgerButton: "Neue tägliche Abrechnung",
    done: "Abgeschlossen",
    taxChatTitle: "Steuerberater-Kommunikation",
    connected: "Verbunden",
    advisorNote: "Bitte ergänzen Sie diese Woche die Erklärung zur doppelten Metro-Rechnung und die Freigabenotiz zur JFC-Lieferscheinabweichung. Die Betriebsnummer wird voraussichtlich noch etwa eine Woche dauern.",
    uploadDocs: "Unterlagen hochladen",
    generatePack: "Steuerberater-Paket erstellen"
  } : {
    title: "财务总览",
    subtitle: "全面掌控财务状况，及时处理账单与付款，让现金流更健康。",
    tasksTitle: "财务待办事项",
    tasks: ["JFC 有一个账单与 Lieferschein 不匹配", "Metro 有两个账单重复", "一个 Metro 账单截止 15.06 需付款", "有一个账单需要 Kontierung 确认一下", "对照 Kontoauszug 后，缺少两个账单，请尽快上传"],
    action: "处理",
    uploadTitle: "外部账单上传中心",
    uploadMain: "拖拽上传 PDF / JPG / PNG",
    uploadSub: "支持供应商账单、收据、外部平台账单",
    uploads: [["Metro Rechnung.pdf","已识别","green"], ["JFC Invoice.png","识别中","blue"], ["Lieferando Auszahlung.pdf","已识别","green"], ["Uber Eats Wochenabrechnung.pdf","待确认","orange"], ["Transgourmet Rechnung.pdf","金额待复核","red"]],
    cashTitle: "现金流概览",
    cash: [["采购总额", "€16,730", "blue"], ["未付款", "€3,245", "red"], ["未来 7 天账户变化", "-€1,420", "orange"], ["未来 15 天账户变化", "-€3,245", "red"]],
    ledgerTitle: "每日 Abrechnung",
    ledgerButton: "新增每日 Abrechnung",
    done: "已完成",
    taxChatTitle: "税务师交流窗",
    connected: "已连接",
    advisorNote: "本周请补充 Metro 重复账单说明、JFC Lieferschein 不匹配的审批备注；Betriebsnummer 预计还需要约一周时间完成。",
    uploadDocs: "上传资料",
    generatePack: "生成税务师资料包"
  };
  return `
    <div class="page-head"><div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div></div>
    <section class="finance-home-modules">
      <a class="finance-module-card finance-module-bills" href="#${slug("finance", "账单管理")}">
        <div class="finance-module-head"><h2>账单管理</h2><span class="pill blue">账单上传</span></div>
        <p>上传、识别和核对供应商账单、收据、外部平台账单和 Kontoauszug。</p>
        <span class="finance-upload-quick">账单上传</span>
        <span class="finance-module-cta">进入账单管理 →</span>
      </a>
      <a class="finance-module-card finance-module-cash" href="#${slug("finance", "每日 Abrechnung")}">
        <div class="finance-module-head"><h2>每日现金账</h2><span class="pill green">${copy.done}</span></div>
        <p>记录每日 Abrechnung、现金存入银行和门店账目对齐。</p>
        <strong class="finance-cash-warning">今日现金账未完成</strong>
        <span class="finance-module-cta">进入每日现金账 →</span>
      </a>
      <a class="finance-module-card finance-module-tax" href="#${slug("finance", "税务师")}">
        <div class="finance-module-head"><h2>税务师</h2><span class="pill green">${copy.connected}</span></div>
        <div class="tax-advisor-mini">
          <strong>Steuerberater Müller</strong>
          <span>DATEV Unternehmen online · 已连接</span>
          <span>本月资料包：账单 42张 · 工资资料 4人</span>
        </div>
        <p>本周待补：Metro 重复账单说明、JFC Lieferschein 差异备注。</p>
        <span class="finance-module-cta">进入税务师 →</span>
      </a>
    </section>
    <section class="finance-cash-strip card">
      <h2>${copy.cashTitle}</h2>
      <div class="finance-flow-grid compact">${copy.cash.map(x=>`<div class="finance-flow-item ${x[2]}"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("")}</div>
    </section>
    <section class="card red-zone finance-home-todos">
      <div class="section-title"><h2>${copy.tasksTitle}</h2><a class="ghost-btn" href="#${slug("finance", "待办事项")}">查看全部</a></div>
      <div class="warn-list">${copy.tasks.map(x=>`<div class="warn-item"><strong>${x}</strong><button class="ghost-btn">${copy.action}</button></div>`).join("")}</div>
    </section>`;
}

function financeTodosPage() {
  const tasks = [
    ["账单与运单不匹配", "JFC 有一个账单与 Lieferschein 不匹配", "JFC Deutschland", "Martin Biergarten", "今天 14:00", "高风险", "待处理", "red"],
    ["重复账单", "Metro 有两个账单重复", "Metro Deutschland", "Martin Biergarten", "今天 16:00", "高风险", "待核对", "red"],
    ["付款到期", "一个 Metro 账单截止 15.06 需付款", "Metro Deutschland", "Martin Biergarten", "2026-06-15", "中风险", "待付款", "orange"],
    ["缺少账单", "缺少两个账单，请尽快上传", "外部账单", "Martin Biergarten", "本周内", "普通", "待上传", "blue"]
  ];
  return `
    <div class="page-head"><div><h1>财务待办事项</h1><p>集中处理账单匹配、重复开票、付款到期和缺少凭证等财务任务。</p></div><button class="primary-btn">+ 上传账单</button></div>
    <section class="grid grid-4">
      ${[["待处理","4项","red"],["高风险","2项","red"],["待付款","1项","orange"],["缺少凭证","2份","blue"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
    </section>
    <div class="toolbar" style="margin-top:16px">
      ${["全部", "账单异常", "重复账单", "付款到期", "缺少凭证", "高风险"].map((x,i)=>`<button class="filter ${i===0?"active":""}">${x}</button>`).join("")}
    </div>
    <section class="card">
      <div class="section-title"><h2>待办列表</h2><span class="pill red">按紧急程度排序</span></div>
      <table class="table">
        <thead><tr><th>任务类型</th><th>任务标题</th><th>供应商 / 来源</th><th>相关门店</th><th>截止时间</th><th>风险</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${tasks.map(r=>`<tr><td>${r[0]}</td><td><strong>${r[1]}</strong></td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td><span class="pill ${r[7]}">${r[5]}</span></td><td>${r[6]}</td><td><button class="ghost-btn">处理</button></td></tr>`).join("")}</tbody>
      </table>
    </section>
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card red-zone"><h2>优先处理</h2><div class="warn-list">${tasks.slice(0,2).map(x=>`<div class="warn-item"><strong>${x[1]}</strong><button class="ghost-btn">立即处理</button></div>`).join("")}</div></div>
      <div class="card tax-chat"><div class="section-title"><h2>税务师同步提示</h2><span class="pill green">可发送</span></div><p>当前有 4 个财务待办可整理成一份说明，发送给税务师或内部财务负责人。</p><div class="button-row"><button class="ghost-btn">生成说明</button><button class="primary-btn">发送给税务师</button></div></div>
    </section>`;
}

function financeDetailPage(child) {
  if (child === "财务总览") return financePage();
  if (["对账中心", "应付账款", "付款管理", "发票审批"].includes(child)) return financeInvoiceManagePage();
  const pages = {
    "账单上传中心": financeInvoiceManagePage,
    "账单管理": financeInvoiceManagePage,
    "账单Kontierung示例": financeKontierungExamplePage,
    "每日 Abrechnung": financeDailySettlementPage,
    "Kassebericht": financeKasseberichtPage,
    "银行存钱": financeBankDepositPage,
    "税务师": financeTaxAdvisorPage,
    "税务师工资资料编辑": financeTaxPayrollEditPage,
    "税务师票据编辑": financeTaxReceiptEditPage,
    "DATEV 导出": financeDatevPage
  };
  if (child === "财务分析") return financePage();
  return (pages[child] || (() => placeholderPage("财务助手", child)))();
}

function financeUploadCenterPage() {
  const de = currentLanguage() === "de";
  const copy = de ? {
    title: "Externer Rechnungs-Upload",
    subtitle: "Laden Sie Lieferantenrechnungen, Belege, Abrechnungen von Lieferplattformen sowie PDF- oder Bilddateien hoch. Die KI erkennt die Daten und übergibt sie an den Abgleich.",
    uploadButton: "+ Datei hochladen",
    uploadTitle: "Datei hochladen",
    aiBadge: "Batch-KI-Erkennung",
    dropTitle: "PDF / JPG / PNG / Excel hierher ziehen",
    dropText: "Lieferant, Betrag, Steuer, Datum und Rechnungsnummer werden automatisch erkannt und auf Plausibilität geprüft.",
    chips: ["Lieferantenrechnung", "Beleg", "Abrechnung Lieferplattform"],
    helper: [
      ["Erkannte Felder", "Lieferant / Betrag / Steuer / Datum / Rechnungsnummer"],
      ["Plausibilitätsprüfung", "Firmendaten / 250-Euro-Regel / Vollständigkeit der Rechnung"],
      ["Batch-Status", "4 zur Bestätigung · 2 mit Ergänzungsbedarf"]
    ],
    resultTitle: "Erkennungsergebnisse",
    confirm: "Bestätigen und senden",
    delete: "Löschen",
    recentTitle: "Letzte Uploads",
    export: "Protokoll exportieren",
    headers: ["Datei", "Quelle", "Typ", "Betrag", "Status", "Aktion"],
    view: "Ansehen",
    files: [
      ["Metro Rechnung.pdf", "Metro Deutschland", "Rechnung", "€980.20", "Erkannt", "green", "Lieferant, Betrag, Steuer und Rechnungsnummer vollständig"],
      ["Cafe Einkauf Beleg.jpg", "Manueller Upload", "Beleg", "€286.40", "Erkennung fehlgeschlagen", "red", "Bild unscharf, Betrag und Datum können nicht bestätigt werden"],
      ["Restaurant Equipment.pdf", "Manueller Upload", "Lieferantenrechnung", "€420.00", "Info fehlt", "orange", "Über 250 Euro, aber Firmendaten fehlen"],
      ["Lieferando Auszahlung.pdf", "Lieferando", "Plattformabrechnung", "€1,420.00", "Erkannt", "green", "Plattform, Zeitraum und Zahlungseingang vollständig"]
    ]
  } : {
    title: "外部账单上传中心",
    subtitle: "上传供应商账单、收据、外卖平台账单和 PDF 图片，AI 自动识别并进入对账流程。",
    uploadButton: "+ 上传文件",
    uploadTitle: "上传文件",
    aiBadge: "批量 AI 识别",
    dropTitle: "拖拽上传 PDF / JPG / PNG / Excel",
    dropText: "自动识别供应商、金额、税额、日期和账单号，并检查合规性。",
    chips: ["供应商账单", "收据", "外卖平台账单"],
    helper: [
      ["识别字段", "供应商 / 金额 / 税额 / 日期 / 账单号"],
      ["合规检查", "公司信息 / €250 规则 / 发票完整性"],
      ["批量状态", "4 份待确认 · 2 份需补充"]
    ],
    resultTitle: "识别结果",
    confirm: "确认提交",
    delete: "删除",
    recentTitle: "最近上传",
    export: "导出记录",
    headers: ["文件", "来源", "类型", "金额", "状态", "操作"],
    view: "查看",
    files: [
      ["Metro Rechnung.pdf", "Metro Deutschland", "Rechnung", "€980.20", "已识别", "green", "供应商、金额、税额和账单号完整"],
      ["Cafe Einkauf Beleg.jpg", "手动上传", "收据", "€286.40", "识别失败", "red", "图片模糊，无法确认金额和日期"],
      ["Restaurant Equipment.pdf", "手动上传", "供应商账单", "€420.00", "待补信息", "orange", "超过 €250，但缺少公司信息"],
      ["Lieferando Auszahlung.pdf", "Lieferando", "平台账单", "€1,420.00", "已识别", "green", "平台、周期和入账金额完整"]
    ]
  };
  return `
    <div class="page-head"><div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div>${financeBackButton()}</div>
    <section class="card upload-recognition-card">
      <div>
        <div class="section-title"><h2>${copy.uploadTitle}</h2><span class="pill purple">${copy.aiBadge}</span></div>
        <div class="upload upload-panel">
          <strong>${copy.dropTitle}</strong>
          <span>${copy.dropText}</span>
          <div class="doc-chip-row">${copy.chips.map(item=>`<button class="ghost-btn">${item}</button>`).join("")}</div>
          <div class="upload-helper-grid">
            ${copy.helper.map(item=>`<div><span>${item[0]}</span><strong>${item[1]}</strong></div>`).join("")}
          </div>
        </div>
      </div>
      <div class="recognition-result-panel">
        <div class="section-title"><h2>${copy.resultTitle}</h2></div>
        <div class="recognition-list">${copy.files.map(r=>`
          <div class="recognition-row">
            <div>
              <strong>${r[0]}</strong>
              <span>${r[1]} · ${r[2]} · ${r[3]}</span>
              <small>${r[6]}</small>
            </div>
            <span class="pill ${r[5]}">${r[4]}</span>
            <button class="ghost-btn danger-btn">${copy.delete}</button>
          </div>`).join("")}</div>
        <div class="recognition-confirm-row"><button class="primary-btn">${copy.confirm}</button></div>
      </div>
    </section>
    <section class="card" style="margin-top:16px"><div class="section-title"><h2>${copy.recentTitle}</h2><button class="ghost-btn">${copy.export}</button></div><table class="table"><thead><tr>${copy.headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${copy.files.map(r=>`<tr>${r.slice(0,4).map(c=>`<td>${c}</td>`).join("")}<td><span class="pill ${r[5]}">${r[4]}</span></td><td><button class="ghost-btn">${copy.view}</button></td></tr>`).join("")}</tbody></table></section>`;
}

function financeInvoiceManagePage() {
  const de = currentLanguage() === "de";
  const invoices = [
    { supplier: "Metro Deutschland", no: "INV-2405-11", amount: "€980.20", date: "2025-05-24", matchKey: "matched", approveKey: "approved", payKey: "payable", actionKey: "pay", color: "blue", kontierungKey: "done" },
    { supplier: "JFC Deutschland", no: "RE-2025-0519", amount: "€486.20", date: "2025-05-24", matchKey: "deliveryMismatch", approveKey: "approval", payKey: "paused", actionKey: "process", color: "red", kontierungKey: "confirm" },
    { supplier: "Metro Deutschland", no: "INV-2405-12", amount: "€860.50", date: "2025-05-24", matchKey: "duplicate", approveKey: "check", payKey: "paused", actionKey: "check", color: "orange", kontierungKey: "confirm" },
    { supplier: "CHEFS CULINAR", no: "INV-2405-18", amount: "€1,245.60", date: "2025-05-22", matchKey: "quantity", approveKey: "managerConfirm", payKey: "payable", actionKey: "view", color: "orange", kontierungKey: "confirm" },
    { supplier: "Lieferando", no: "PAY-0524", amount: "€1,420.00", date: "2025-05-21", matchKey: "matched", approveKey: "auto", payKey: "received", actionKey: "view", color: "green", kontierungKey: "done" }
  ];
  const copy = de ? {
    title: "Rechnungszentrum",
    subtitle: "Zentrale Verwaltung für Rechnungserkennung, Bestell- und Lieferscheinabgleich, Freigaben, Zahlungsstatus und Archiv.",
    stats: [["Zu prüfende Rechnungen", "12", "blue"], ["Zu zahlende Rechnungen", "3", "orange"], ["Abweichungen", "2", "red"], ["Offener Zahlungsbetrag", "€3,245.00", "purple"]],
    listTitle: "Rechnungsliste",
    filters: { all: "Alle", review: "Zur Prüfung", anomaly: "Abweichungen", payment: "Zu zahlen", archive: "Archiviert" },
    batchAll: "Alle zu zahlenden Rechnungen auswählen",
    selected: count => `${count} ausgewählt · Summe €2,225.80`,
    bankFile: "Zahlungsdatei erstellen und in die Bank hochladen",
    headers: ["Auswahl", "Lieferant", "Rechnungsnr.", "Betrag", "Datum", "Abgleichstatus", "Freigabestatus", "Zahlungsstatus", "Kontierung", "Aktion"],
    match: { matched: "Abgeglichen", deliveryMismatch: "Lieferschein passt nicht", duplicate: "Mögliche Dublette", quantity: "Mengenabweichung" },
    approve: { approved: "Freigegeben", approval: "Zur Freigabe", check: "Zur Prüfung", managerConfirm: "Filialleitung bestätigt", auto: "Automatisch freigegeben" },
    pay: { payable: "Zu zahlen", paused: "Zahlung pausiert", received: "Eingegangen" },
    action: { pay: "Zahlen", process: "Bearbeiten", check: "Prüfen", view: "Ansehen" },
    kontierung: { done: "Erledigt", confirm: "Zu prüfen" },
    uploadButton: "+ Datei hochladen",
    uploadTitle: "Rechnungen hochladen",
    aiBadge: "Batch-KI-Erkennung",
    dropTitle: "PDF / JPG / PNG / Excel hierher ziehen",
    dropText: "Lieferant, Betrag, Steuer, Datum und Rechnungsnummer werden automatisch erkannt und direkt in die Rechnungsliste übernommen.",
    chips: ["Lieferantenrechnung", "Beleg", "Plattformabrechnung"],
    helper: [
      ["Erkannte Felder", "Lieferant / Betrag / Steuer / Datum / Rechnungsnummer"],
      ["Prüfung", "Firmendaten / 250-Euro-Regel / Vollständigkeit"],
      ["Status", "4 zur Bestätigung · 2 mit Ergänzungsbedarf"]
    ],
    resultTitle: "Aktuelle Erkennung",
    confirm: "Bestätigen und übernehmen",
    delete: "Löschen",
    files: [
      ["Metro Rechnung.pdf", "Metro Deutschland", "Rechnung", "€980.20", "Erkannt", "green", "Lieferant, Betrag, Steuer und Rechnungsnummer vollständig"],
      ["Cafe Einkauf Beleg.jpg", "Manueller Upload", "Beleg", "€286.40", "Fehler", "red", "Bild unscharf, Betrag und Datum können nicht bestätigt werden"],
      ["Restaurant Equipment.pdf", "Manueller Upload", "Lieferantenrechnung", "€420.00", "Info fehlt", "orange", "Über 250 Euro, aber Firmendaten fehlen"],
      ["DM Einkauf.pdf", "DM", "Beleg", "€74.30", "Erkannt", "green", "Belegnummer und Betrag vollständig"],
      ["Uber Eats Woche 21.pdf", "Uber Eats", "Plattformabrechnung", "€860.50", "Zur Prüfung", "blue", "Zeitraum und Auszahlung prüfen"],
      ["Transgourmet Rechnung.pdf", "Transgourmet", "Rechnung", "€1,120.40", "Info fehlt", "orange", "Kontierung fehlt noch"]
    ]
  } : {
    title: "账单管理中心",
    subtitle: "集中管理账单识别、订单 / Lieferschein 对账、审批、付款状态和归档记录。",
    stats: [["待审核账单", "12项", "blue"], ["待付款账单", "3项", "orange"], ["对账异常", "2项", "red"], ["待付款金额", "€3,245.00", "purple"]],
    listTitle: "账单列表",
    filters: { all: "全部", review: "待审核", anomaly: "对账异常", payment: "待付款", archive: "已归档" },
    batchAll: "全选待付款账单",
    selected: count => `已选 ${count} 张 · 合计 €2,225.80`,
    bankFile: "生成付款文件，只需上传银行",
    headers: ["选择", "供应商", "账单号", "金额", "日期", "对账状态", "审批状态", "付款状态", "Kontierung", "操作"],
    match: { matched: "已匹配", deliveryMismatch: "Lieferschein 不匹配", duplicate: "疑似重复", quantity: "数量差异" },
    approve: { approved: "已通过", approval: "待审批", check: "待核对", managerConfirm: "店长确认中", auto: "自动通过" },
    pay: { payable: "待付款", paused: "暂停付款", received: "已到账" },
    action: { pay: "去付款", process: "处理", check: "核对", view: "查看" },
    kontierung: { done: "已完成", confirm: "需确认" },
    uploadButton: "+ 上传文件",
    uploadTitle: "账单上传",
    aiBadge: "批量 AI 识别",
    dropTitle: "拖拽上传 PDF / JPG / PNG / Excel",
    dropText: "自动识别供应商、金额、税额、日期和账单号，并直接进入下方账单列表。",
    chips: ["供应商账单", "收据", "外卖平台账单"],
    helper: [
      ["识别字段", "供应商 / 金额 / 税额 / 日期 / 账单号"],
      ["合规检查", "公司信息 / €250 规则 / 发票完整性"],
      ["批量状态", "4 份待确认 · 2 份需补充"]
    ],
    resultTitle: "当前识别结果",
    confirm: "确认并加入账单",
    delete: "删除",
    files: [
      ["Metro Rechnung.pdf", "Metro Deutschland", "Rechnung", "€980.20", "已识别", "green", "供应商、金额、税额和账单号完整"],
      ["Cafe Einkauf Beleg.jpg", "手动上传", "收据", "€286.40", "识别失败", "red", "图片模糊，无法确认金额和日期"],
      ["Restaurant Equipment.pdf", "手动上传", "供应商账单", "€420.00", "待补信息", "orange", "超过 €250，但缺少公司信息"],
      ["DM Einkauf.pdf", "DM", "收据", "€74.30", "已识别", "green", "票据号和金额完整"],
      ["Uber Eats Woche 21.pdf", "Uber Eats", "平台账单", "€860.50", "待复核", "blue", "需要确认周期和入账金额"],
      ["Transgourmet Rechnung.pdf", "Transgourmet", "Rechnung", "€1,120.40", "待补信息", "orange", "还需要 Kontierung"]
    ]
  };
  const filterAliases = { "全部": "all", "待审核": "review", "对账异常": "anomaly", "待付款": "payment", "已归档": "archive" };
  const rawFilter = state().params.get("filter") || "all";
  const activeFilter = filterAliases[rawFilter] || rawFilter;
  const filterKeys = ["all", "review", "anomaly", "payment", "archive"];
  const filteredInvoices = invoices.filter(r => {
    if (activeFilter === "review") return !["approved", "auto"].includes(r.approveKey);
    if (activeFilter === "anomaly") return r.matchKey !== "matched";
    if (activeFilter === "payment") return r.payKey === "payable";
    if (activeFilter === "archive") return ["received", "archived", "done"].includes(r.payKey);
    return true;
  });
  const payableCount = filteredInvoices.filter(r => r.payKey === "payable").length;
	  return `
    <div class="page-head"><div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div>${financeBackButton()}</div>
    <section class="card upload-recognition-card invoice-upload-merged">
      <div>
        <div class="section-title"><h2>${copy.uploadTitle}</h2><span class="pill purple">${copy.aiBadge}</span></div>
        <div class="upload upload-panel">
          <strong>${copy.dropTitle}</strong>
          <span>${copy.dropText}</span>
          <div class="doc-chip-row">${copy.chips.map(item=>`<button class="ghost-btn">${item}</button>`).join("")}</div>
          <div class="upload-helper-grid">
            ${copy.helper.map(item=>`<div><span>${item[0]}</span><strong>${item[1]}</strong></div>`).join("")}
          </div>
        </div>
      </div>
      <div class="recognition-result-panel">
        <div class="section-title"><h2>${copy.resultTitle}</h2></div>
        <div class="recognition-list">${copy.files.map(r=>`
          <div class="recognition-row">
            <div>
              <strong>${r[0]}</strong>
              <span>${r[1]} · ${r[2]} · ${r[3]}</span>
              <small>${r[6]}</small>
            </div>
            <span class="pill ${r[5]}">${r[4]}</span>
            <button class="ghost-btn danger-btn">${copy.delete}</button>
          </div>`).join("")}</div>
        <div class="recognition-confirm-row"><button class="primary-btn">${copy.confirm}</button></div>
      </div>
    </section>
    <section class="grid grid-4 invoice-stat-row">
      ${copy.stats.map(x=>`<div class="card invoice-stat"><span>${x[0]}</span><strong style="color:var(--${x[2]})">${x[1]}</strong></div>`).join("")}
	    </section>
	    <section class="card" style="margin-top:16px">
	      <div class="section-title"><h2>${copy.listTitle}</h2><div class="filter-row compact">${filterKeys.map(key=>`<a class="filter ${activeFilter === key ? "active" : ""} ${key === "payment" ? "payment-filter" : ""}" href="#${slug("finance", "账单管理")}?filter=${key}">${copy.filters[key]}</a>`).join("")}</div></div>
	      ${activeFilter === "payment" ? `<div class="payment-batch-bar">
	        <label><input type="checkbox" checked> ${copy.batchAll}</label>
	        <span>${copy.selected(payableCount)}</span>
	        <button class="primary-btn">${copy.bankFile}</button>
	      </div>` : ""}
	      <table class="table invoice-management-table">
	        <thead><tr>${copy.headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
	        <tbody>${filteredInvoices.map(r=>`<tr><td><input type="checkbox" ${activeFilter === "payment" && r.payKey === "payable" ? "checked" : ""}></td><td><strong>${r.supplier}</strong></td><td>${r.no}</td><td>${r.amount}</td><td>${r.date}</td><td><span class="pill ${r.color}">${copy.match[r.matchKey]}</span></td><td>${copy.approve[r.approveKey]}</td><td>${copy.pay[r.payKey]}</td><td><a class="pill ${r.kontierungKey === "done" ? "green" : "orange"}" href="#${slug("finance", "账单Kontierung示例")}?invoice=${encodeURIComponent(r.no)}">${copy.kontierung[r.kontierungKey]}</a></td><td><button class="ghost-btn bill-action">${copy.action[r.actionKey]}</button></td></tr>`).join("")}</tbody>
	      </table>
	    </section>
    `;
}

function financeKontierungExamplePage() {
  const lineItems = [
    ["Tomaten 6kg", "食品 / 食材", "7%", "3300 Wareneingang Lebensmittel", "厨房", "€34.80", "AI 高置信"],
    ["Hähnchenbrust 2.5kg", "食品 / 食材", "7%", "3300 Wareneingang Lebensmittel", "厨房", "€75.60", "AI 高置信"],
    ["Mineralwasser 12x1L", "饮料", "19%", "3410 Wareneingang Getränke", "吧台", "€22.80", "需老板确认"],
    ["Servietten 500 Stk", "耗材 / 餐巾纸", "19%", "4930 Betriebsbedarf", "前厅", "€18.90", "AI 高置信"],
    ["Einwegboxen", "包装耗材", "19%", "4930 Betriebsbedarf", "外卖", "€28.60", "AI 高置信"],
    ["Reinigungsmittel", "清洁用品", "19%", "4980 Reinigungsbedarf", "后厨", "€16.40", "AI 高置信"],
    ["Liefergebühr", "配送费", "19%", "4730 Ausgangsfrachten / Bezugskosten", "采购", "€9.90", "需老板确认"]
  ];
  const summaryRows = [
    ["食品 / 食材 7%", "€110.40", "€7.73", "€118.13"],
    ["饮料 19%", "€22.80", "€4.33", "€27.13"],
    ["耗材 / 清洁 / 配送 19%", "€73.80", "€14.02", "€87.82"]
  ];
  return `
    <div class="page-head">
      <div><h1>AI Kontierung 检查</h1><p>系统扫描整张账单，把每一条商品拆出来并自动分类。老板只需要检查分类、税率和成本中心，必要时手动修改后确认。</p></div>
      <a class="ghost-btn accent-back-btn" href="#${slug("finance", "账单管理")}">返回账单管理</a>
    </div>
    <section class="grid grid-3">
      <div class="card compact-stat"><p>供应商</p><div class="metric-value" style="color:var(--blue);font-size:24px">JFC</div><span class="muted">RE-2025-0519</span></div>
      <div class="card compact-stat"><p>扫描结果</p><div class="metric-value" style="color:var(--green);font-size:24px">7条</div><span class="muted">食品、饮料、耗材、清洁用品</span></div>
      <div class="card compact-stat"><p>需人工确认</p><div class="metric-value" style="color:var(--orange);font-size:24px">2条</div><span class="muted">饮料税率 / 配送费归类</span></div>
    </section>
    <section class="card kontierung-scan-card" style="margin-top:16px">
      <div class="section-title"><h2>账单扫描明细</h2><div class="button-row"><span class="pill blue">AI 已分类</span><button class="ghost-btn">重新扫描</button></div></div>
      <table class="table kontierung-line-table"><thead><tr><th>商品 / 项目</th><th>AI 分类</th><th>税率</th><th>Kontierung 科目</th><th>成本中心</th><th>金额 Netto</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${lineItems.map((r,i)=>`<tr>
          <td><strong>${r[0]}</strong></td>
          <td><select><option>${r[1]}</option><option>食品 / 食材</option><option>饮料</option><option>耗材 / 餐巾纸</option><option>清洁用品</option><option>配送费</option></select></td>
          <td><select><option>${r[2]}</option><option>7%</option><option>19%</option></select></td>
          <td><select><option>${r[3]}</option><option>3300 Wareneingang Lebensmittel</option><option>3410 Wareneingang Getränke</option><option>4930 Betriebsbedarf</option><option>4980 Reinigungsbedarf</option></select></td>
          <td><select><option>${r[4]}</option><option>厨房</option><option>吧台</option><option>前厅</option><option>外卖</option></select></td>
          <td><strong>${r[5]}</strong></td>
          <td><span class="pill ${r[6].includes("需") ? "orange" : "green"}">${r[6]}</span></td>
          <td><button class="ghost-btn bill-action">${i === 2 || i === 6 ? "修改" : "确认"}</button></td>
        </tr>`).join("")}
      </tbody></table>
      <div class="kontierung-confirm-row"><button class="primary-btn">确认 Kontierung</button></div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>AI 分类汇总</h2></div>
      <table class="table"><thead><tr><th>分类</th><th>Netto</th><th>Vorsteuer</th><th>Brutto</th></tr></thead><tbody>
        ${summaryRows.map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("")}
      </tbody></table>
      <p class="muted" style="margin-top:12px">老板确认后，系统把每行分类和税率保存给财务/税务师。具体科目编号仍可由税务师在后台 Kontenplan 中维护。</p>
    </section>`;
}

function financeDailySettlementPage() {
  const de = currentLanguage() === "de";
  const copy = de ? {
    title: "Tägliche Buchführung und Kassenbuch",
    subtitle: "Erstellen Sie das tägliche Kassenbuch und laden Sie Rechnungen, Z-Bon, Lieferplattform-Belege, Sonderbelege und Verlustnachweise hoch.",
    cashDue: "Einzuzahlender Bargeldbetrag",
    bankDeposit: "Bankeinzahlung",
    cashDeadline: "Bis gestern 12:00",
    materialStatus: "Status heutiger Unterlagen",
    materialValue: "4 / 6",
    materialHint: "2 Punkte fehlen noch",
    createTitle: "Tägliches Kassenbuch erstellen",
    todayPending: "Heute offen",
    uploadBills: "Rechnungen hochladen",
    uploadBillsText: "PDF / JPG / PNG. Lieferantenrechnungen, Belege und Lieferplattform-Abrechnungen können gesammelt hochgeladen werden.",
    uploadBillsBox: "Rechnungen hierher ziehen oder Datei auswählen",
    recognitionTitle: "Batch-Ergebnisse",
    countLabel: "3 Dateien",
    edit: "Bearbeiten",
    zbonTitle: "Z-Bon hochladen",
    zbonUpload: "Z-Bon hochladen",
    zbonResult: "Gesamt €2,840 · erkannt",
    delete: "Löschen",
    cardAmount: "Kartenzahlungen",
    syncZbon: "Z-Bon-Daten synchronisieren",
    cardHint: "Falls nicht synchronisiert, geben Sie den Kartenumsatz ein.",
    cardAria: "Kartenzahlungen",
    lossTitle: "Verlustnachweis für heute",
    product: "Produkt",
    productValue: "Tomaten",
    amount: "Betrag",
    reason: "Grund",
    reasonValue: "Abgelaufen",
    lossUpload: "Verlustfoto / Inventur-Screenshot hochladen",
    diffCheck: "Differenzprüfung erstellen",
    save: "Tägliches Kassenbuch speichern",
    historyTitle: "Frühere Buchführungen",
    viewAll: "Alle anzeigen",
    headers: ["Datum", "Einzuzahlendes Bargeld", "Z-Bon gesamt", "Karte", "Lieferplattformen", "Verlust", "Status", "Aktion"],
    view: "Ansehen",
    recognizedBills: [
      ["Metro Rechnung.pdf", "Metro", "€915.14", "€980.20", "3400 Wareneingang", "Erkannt", "green"],
      ["JFC Invoice.png", "JFC", "€454.39", "€486.20", "3400 Wareneingang", "Zur Bestätigung", "orange"],
      ["Uber Eats Wochenabrechnung.pdf", "Uber Eats", "€860.50", "€860.50", "1360 Durchlaufende Posten", "Zu bearbeiten", "blue"]
    ],
    historyRows: [
      ["2025-05-24", "€620", "€2,840", "€1,480", "€740", "€18.40", "Abgeschlossen"],
      ["2025-05-23", "€710", "€3,120", "€1,690", "€720", "€9.20", "Abgeschlossen"],
      ["2025-05-22", "€540", "€2,560", "€1,320", "€700", "€32.80", "Zu prüfen"]
    ],
    needsReview: "Zu prüfen"
  } : {
    title: "每日做账&现金账",
    subtitle: "创建当天现金账，上传账单、Z-Bon、外卖票据、特殊票据和损耗证明。",
    cashDue: "应存现金金额",
    bankDeposit: "银行存钱",
    cashDeadline: "截止到昨天 12:00",
    materialStatus: "今日资料状态",
    materialValue: "4 / 6",
    materialHint: "仍需补充 2 项",
    createTitle: "创建当天现金账",
    todayPending: "今日待完成",
    uploadBills: "上传账单",
    uploadBillsText: "PDF / JPG / PNG，可批量上传供应商账单、收据和外卖平台票据。",
    uploadBillsBox: "拖拽上传账单或点击选择文件",
    recognitionTitle: "批量识别结果",
    countLabel: "3 份",
    edit: "编辑",
    zbonTitle: "上传 Z-Bon",
    zbonUpload: "上传 Z-Bon",
    zbonResult: "总额 €2,840 · 已识别",
    delete: "删除",
    cardAmount: "刷卡金额",
    syncZbon: "同步 Z-Bon 数据",
    cardHint: "如果不同步，请填写一个刷卡总额。",
    cardAria: "刷卡金额",
    lossTitle: "当天损耗证明",
    product: "商品",
    productValue: "番茄",
    amount: "数量",
    reason: "原因",
    reasonValue: "过期",
    lossUpload: "上传损耗照片 / 盘点截图",
    diffCheck: "生成差异检查",
    save: "保存当天现金账",
    historyTitle: "往日做账记录",
    viewAll: "查看全部",
    headers: ["日期", "应存现金", "Z-Bon 总额", "刷卡", "外卖", "损耗", "状态", "操作"],
    view: "查看",
    recognizedBills: [
      ["Metro Rechnung.pdf", "Metro", "€915.14", "€980.20", "3400 Wareneingang", "已识别", "green"],
      ["JFC Invoice.png", "JFC", "€454.39", "€486.20", "3400 Wareneingang", "待确认", "orange"],
      ["Uber Eats Wochenabrechnung.pdf", "Uber Eats", "€860.50", "€860.50", "1360 Durchlaufende Posten", "需编辑", "blue"]
    ],
    historyRows: [
      ["2025-05-24", "€620", "€2,840", "€1,480", "€740", "€18.40", "已完成"],
      ["2025-05-23", "€710", "€3,120", "€1,690", "€720", "€9.20", "已完成"],
      ["2025-05-22", "€540", "€2,560", "€1,320", "€700", "€32.80", "需复核"]
    ],
    needsReview: "需复核"
  };
  return `
    <div class="page-head"><div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div>${financeBackButton()}</div>
    <section class="grid grid-4">
      <div class="card cash-deposit-stat"><p>${copy.cashDue}</p><div class="metric-value" style="color:var(--blue)">€620</div><span class="muted">${copy.cashDeadline}</span><a class="ghost-btn" href="#${slug("finance", "银行存钱")}">${copy.bankDeposit}</a></div>
      <div class="card"><p>${copy.materialStatus}</p><div class="metric-value" style="color:var(--orange)">${copy.materialValue}</div><span class="muted">${copy.materialHint}</span></div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>${copy.createTitle}</h2><span class="pill orange">${copy.todayPending}</span></div>
      <section class="daily-ledger-layout">
        <div class="ledger-upload-main">
          <h3>${copy.uploadBills}</h3>
          <p>${copy.uploadBillsText}</p>
          <div class="upload ledger-bill-upload">${copy.uploadBillsBox}</div>
        </div>
        <div class="ledger-recognition-list">
          <div class="section-title compact-title"><h3>${copy.recognitionTitle}</h3><span class="pill green">${copy.countLabel}</span></div>
          ${copy.recognizedBills.map(r=>`
            <div class="ledger-recognition-row">
              <div class="ledger-file-info"><strong>${r[0]}</strong><span>${r[1]} · ${r[5]}</span></div>
              <div class="ledger-money-pair">
                <label>Netto<input value="${r[2]}"></label>
                <label>Brutto<input value="${r[3]}"></label>
              </div>
              <div class="ledger-action-group"><button class="soft-blue-btn">${copy.edit}</button><button class="soft-purple-btn ${r[6] === "green" ? "done" : "review"}">Kontierung</button></div>
            </div>`).join("")}
        </div>
      </section>
      <section class="daily-ledger-controls">
        <div class="ledger-mini-card">
          <h3>${copy.zbonTitle}</h3>
          <p>Kasse Tagesabschluss</p>
          <div class="upload zbon-upload">${copy.zbonUpload}</div>
          <div class="zbon-result-row">
            <div><strong>Z-Bon 2025-05-24.pdf</strong><span>${copy.zbonResult}</span></div>
            <button class="danger-btn">${copy.delete}</button>
          </div>
        </div>
        <div class="ledger-mini-card">
          <div class="section-title compact-title"><h3>${copy.cardAmount}</h3><label class="sync-switch"><input type="checkbox" checked> ${copy.syncZbon}</label></div>
          <p>${copy.cardHint}</p>
          <input value="€1,480" aria-label="${copy.cardAria}">
          <div class="cash-ledger-extra">
            <div class="section-title compact-title"><h3>${de ? "Barbetrag" : "现金金额"}</h3><a class="primary-btn kassebericht-link" href="#${slug("finance", "Kassebericht")}">Kassebericht</a></div>
            <input value="€620" aria-label="${de ? "Barbetrag" : "现金金额"}">
            <label>${de ? "Trinkgeld" : "小费金额"}<input value="€86" aria-label="${de ? "Trinkgeld" : "小费金额"}"></label>
          </div>
        </div>
        <div class="ledger-mini-card">
          <h3>${copy.lossTitle}</h3>
          <div class="mini-form"><label>${copy.product}<input value="${copy.productValue}"></label><label>${copy.amount}<input value="€18.40"></label><label>${copy.reason}<input value="${copy.reasonValue}"></label></div>
          <div class="upload loss-proof-upload">${copy.lossUpload}</div>
        </div>
      </section>
      <div class="button-row" style="margin-top:14px;justify-content:flex-end"><button class="ghost-btn">${copy.diffCheck}</button><button class="primary-btn">${copy.save}</button></div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>${copy.historyTitle}</h2><button class="ghost-btn">${copy.viewAll}</button></div>
      <table class="table"><thead><tr>${copy.headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>
        ${copy.historyRows.map(row=>`<tr>${row.map((cell,i)=>`<td>${i===6 ? `<span class="pill ${cell===copy.needsReview ? "orange" : "green"}">${cell}</span>` : cell}</td>`).join("")}<td><button class="ghost-btn">${copy.view}</button></td></tr>`).join("")}
      </tbody></table>
    </section>`;
}

function financeBankDepositPage() {
  const deposits = [
    ["2025-05-24", "€620.00", "Sparkasse", "Einzahlungsbeleg-0524.pdf", "已确认"],
    ["2025-05-23", "€710.00", "Sparkasse", "Einzahlungsbeleg-0523.pdf", "已确认"],
    ["2025-05-22", "€540.00", "Deutsche Bank", "Bankbeleg-0522.jpg", "待核对"]
  ];
  return `
    <div class="page-head"><div><h1>银行存钱</h1><p>记录每日现金存入银行的金额、账户和票据，方便与现金账和 Kontoauszug 对账。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("finance", "每日 Abrechnung")}">返回每日 Abrechnung</a></div>
    <section class="grid grid-2">
      <div class="card">
        <div class="section-title"><h2>填写存钱记录</h2><span class="pill blue">今日应存 €620</span></div>
        <div class="form-grid">
          ${field("存入金额", "€620.00")}
          ${field("存款日期", "2025-05-24")}
          ${field("存入银行", "Sparkasse")}
          ${field("相关门店", "Martin Biergarten")}
        </div>
        <div class="upload bank-deposit-upload">上传银行存款票据 / Einzahlungsbeleg</div>
        <div class="button-row"><button class="ghost-btn">保存草稿</button><button class="primary-btn">确认提交</button></div>
      </div>
      <div class="card">
        <h2>对账提示</h2>
        <div class="status-line"><span>今日应存现金</span><strong>€620.00</strong></div>
        <div class="status-line"><span>已填写存入金额</span><strong>€620.00</strong></div>
        <div class="status-line"><span>票据状态</span><span class="pill orange">待上传</span></div>
        <p class="muted" style="margin-top:12px">上传银行票据后，系统会把该记录和每日现金账、Kontoauszug 自动放在一起核对。</p>
      </div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>历史存钱记录</h2><button class="ghost-btn">导出记录</button></div>
      <table class="table">
        <thead><tr><th>日期</th><th>金额</th><th>银行</th><th>票据</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>${deposits.map(r=>`<tr><td>${r[0]}</td><td><strong>${r[1]}</strong></td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[4] === "已确认" ? "green" : "orange"}">${r[4]}</span></td><td><button class="ghost-btn">查看</button></td></tr>`).join("")}</tbody>
      </table>
    </section>`;
}

function financeKasseberichtPage() {
  const de = currentLanguage() === "de";
  const bills = [
    ["100 Euro", "4", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/The_Europa_series_100_%E2%82%AC_obverse_side.jpg/120px-The_Europa_series_100_%E2%82%AC_obverse_side.jpg"],
    ["50 Euro", "8", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/The_Europa_series_50_%E2%82%AC_obverse_side.png/120px-The_Europa_series_50_%E2%82%AC_obverse_side.png"],
    ["20 Euro", "18", "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/The_Europa_series_20_%E2%82%AC_obverse_side.jpg/120px-The_Europa_series_20_%E2%82%AC_obverse_side.jpg"],
    ["10 Euro", "12", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/EUR_10_obverse_%282014_issue%29.png/120px-EUR_10_obverse_%282014_issue%29.png"],
    ["5 Euro", "14", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/EUR_5_obverse_%282013_issue%29.png/120px-EUR_5_obverse_%282013_issue%29.png"]
  ];
  const coins = [
    ["2 Euro", "22", "https://upload.wikimedia.org/wikipedia/en/thumb/6/65/Common_face_of_two_euro_coin.png/250px-Common_face_of_two_euro_coin.png"],
    ["1 Euro", "18", "https://upload.wikimedia.org/wikipedia/en/thumb/e/ef/Common_face_of_one_euro_coin_%28first_series%29.jpg/250px-Common_face_of_one_euro_coin_%28first_series%29.jpg"],
    ["50 Cent", "36", "https://upload.wikimedia.org/wikipedia/en/thumb/d/dc/Common_face_of_50_eurocent_coin_%28first_series%29.jpeg/250px-Common_face_of_50_eurocent_coin_%28first_series%29.jpeg"],
    ["20 Cent", "42", "https://upload.wikimedia.org/wikipedia/en/thumb/d/d9/Common_face_of_20_cent_euro_coin_%28first_series%29.jpeg/250px-Common_face_of_20_cent_euro_coin_%28first_series%29.jpeg"],
    ["10 Cent", "28", "https://upload.wikimedia.org/wikipedia/en/thumb/d/d2/Common_face_of_10_cent_euro_coin_%28first_series%29.jpeg/250px-Common_face_of_10_cent_euro_coin_%28first_series%29.jpeg"],
    ["5 Cent", "18", "https://upload.wikimedia.org/wikipedia/en/1/1e/5_eurocent_common_1999.png"],
    ["2 Cent", "12", "https://upload.wikimedia.org/wikipedia/en/8/8f/2_eurocent_common_1999.png"],
    ["1 Cent", "9", "https://upload.wikimedia.org/wikipedia/en/2/22/1_cent_euro_coin_common_side.png"]
  ];
  const moneyItem = (item, type) => `<label class="money-count-item ${type}"><span class="money-visual"><img src="${item[2]}" alt="${item[0]}" loading="lazy"></span><span class="money-label">${item[0]}</span><input value="${item[1]}"></label>`;
  return `
    <div class="page-head"><div><h1>Kassebericht</h1><p>${de ? "Tägliche Kassenprüfung mit Stückelung und mobiler Unterschrift." : "按日期和门店记录现金面额数量，并支持手机签字确认。"}</p></div><a class="ghost-btn accent-back-btn" href="#${slug("finance", "每日 Abrechnung")}">${de ? "Zurück" : "返回每日 Abrechnung"}</a></div>
    <section class="card kassebericht-card">
      <div class="section-title"><h2>${de ? "Kassenbericht 2025-05-24" : "2025-05-24 Kassebericht"}</h2><span class="pill green">${de ? "Bereit zur Unterschrift" : "等待签字确认"}</span></div>
      <div class="form-grid">
        ${field(de ? "Datum" : "日期", "2025-05-24", "2025-05-24")}
        ${field(de ? "Filiale" : "店铺信息", "Martin Biergarten", "Martin Biergarten")}
        ${field(de ? "Kasse" : "现金箱", "Kasse Martin", "Kasse Martin")}
        ${field(de ? "Erfasst von" : "填写人", "Martin", "Martin")}
      </div>
      <div class="money-count-layout">
        <section class="money-count-section">
          <div class="section-title compact-title"><h3>${de ? "Scheine" : "纸币"}</h3><span class="pill blue">${bills.length} ${de ? "Arten" : "种"}</span></div>
          <div class="bill-count-grid">${bills.map(item=>moneyItem(item, "bill")).join("")}</div>
        </section>
        <section class="money-count-section">
          <div class="section-title compact-title"><h3>${de ? "Münzen" : "硬币"}</h3><span class="pill orange">${coins.length} ${de ? "Arten" : "种"}</span></div>
          <div class="coin-count-grid">${coins.map(item=>moneyItem(item, "coin")).join("")}</div>
        </section>
      </div>
      <div class="kasse-total-row">
        <div><span>${de ? "Gezähltes Bargeld" : "现金合计"}</span><strong>€620.00</strong></div>
        <div><span>${de ? "Abweichung" : "差异"}</span><strong>€0.00</strong></div>
      </div>
      <div class="signature-panel">
        <div>
          <h3>${de ? "Unterschrift" : "签字确认"}</h3>
          <p>${de ? "Auf dem Handy unterschreiben oder hier bestätigen." : "可在手机上签字，也可以在这里确认签名。"}</p>
        </div>
        <div class="signature-box">${de ? "Unterschrift hier" : "手机签字区域"}</div>
      </div>
      <div class="button-row" style="justify-content:flex-end;margin-top:14px"><button class="ghost-btn">${de ? "Entwurf speichern" : "保存草稿"}</button><button class="primary-btn">${de ? "Bestätigen" : "确认签字"}</button></div>
    </section>`;
}

function financeTaxAdvisorPage() {
  const de = currentLanguage() === "de";
  const receiptTab = state().params.get("receipt") || "zbon";
  const copy = de ? {
    title: "Steuerberater",
    subtitle: "Bereiten Sie das Unterlagenpaket für den Steuerberater vor: Rechnungen, Tagesabschlüsse, Zahlungsprotokolle, DATEV-Export und Hinweise zu Abweichungen.",
    sendPack: "Unterlagenpaket senden",
    chatTitle: "Steuerberater-Kommunikation",
    connected: "Steuerberater verbunden",
    advisorNote: "Bitte ergänzen Sie die Erklärung zur doppelten Metro-Rechnung im Mai und die Notiz zur JFC-Lieferscheinabweichung.",
    kaiNote: "Rechnungen, Abrechnungen, Zahlungsprotokolle und Entwürfe für Abweichungshinweise sind vorbereitet.",
    uploadDocs: "Unterlagen hochladen",
    generatePack: "Unterlagenpaket manuell senden",
    checklistTitle: "Unterlagenliste",
    connectionTitle: "DATEV-Verbindung",
    handoffTitle: "Steuerberater-Kommunikation",
    monthlyTitle: "Monatliches Unterlagenpaket",
    advisorName: "Steuerberater Müller",
    firm: "Kanzlei Müller & Partner",
    datevMethod: "DATEV Unternehmen online",
    datevStatus: "Aktiv verbunden",
    contact: "Kanzlei E-Mail + KaiSpan Sync",
    changeAdvisor: "Steuerberater wechseln",
    packageItems: [
      ["Lieferantenrechnungen", "42 Stück", "Bereit", "green"],
      ["Plattformrechnungen", "5 Dateien", "Bereit", "green"],
      ["Tägliche Abrechnung", "31 Einträge", "Bereit", "green"],
      ["Lohnunterlagen", "4 Mitarbeiter", "Prüfen", "orange"],
      ["DATEV-Export", "1 Paket", "Bereit", "green"],
      ["Abweichungshinweise", "4 Hinweise", "Offen", "orange"]
    ],
    handoffItems: ["DATEV-Zugang prüfen", "Metro-Duplikat erklären", "JFC-Lieferscheinabweichung freigeben", "Lohn- und Stundenlisten für Mai prüfen", "Betriebsnummer-Status nachreichen", "Kassenbuch-Differenz vom 22.05 erklären", "Bankbeleg DEP-0524 bestätigen", "Kontierung für CHEFS CULINAR prüfen", "Rückfrage zur Umsatzsteuer beantworten"],
    ready: "Bereit",
    checklist: ["Lieferantenrechnungen 42 Stück", "Tägliche Abrechnung 31 Einträge", "Zahlungsprotokolle 18 Einträge", "Abweichungshinweise 4 Stück", "DATEV-Export 1 Datei", "Lohnunterlagen 4 Mitarbeiter", "Kassenbuch 31 Tage", "Kontierung 12 Positionen", "Bankabgleich 18 Buchungen", "Notizen für Steuerberater 3 Stück"],
    payrollTitle: "Lohnunterlagen",
    payrollBadge: "Monatsbeispiel",
    payrollHeaders: ["Mitarbeiter", "Stunden", "Urlaub", "Krankheit", "Stundenlohn", "Lohn"],
    receiptTitle: "Belegübersicht",
    synced: "Synchronisiert",
    receiptTabs: [
      { id: "zbon", label: "Z-Bon" },
      { id: "bill", label: "Rechnungen" },
      { id: "cash", label: "Kassenbuch" },
      { id: "kontoauszug", label: "Kontoauszug" }
    ],
    receiptHeaders: ["Datum", "Quelle", "Nummer", "Betrag", "Status"],
    statuses: { synced: "Synchronisiert", confirm: "Zur Bestätigung", recognized: "Erkannt", note: "Notiz nötig", uploaded: "Beleg hochgeladen", checked: "Geprüft", explain: "Erklärung nötig" },
    externalAdvisor: "+ Externen Steuerberater hinzufügen"
  } : {
    title: "税务师",
    subtitle: "整理给税务师的资料包，包括账单、日结、付款记录、DATEV 导出和异常说明。",
    sendPack: "发送资料包",
    chatTitle: "税务师交流窗",
    connected: "Steuerberater 已连接",
    advisorNote: "请补充 5 月 Metro 重复账单说明和 JFC 运单差异备注。",
    kaiNote: "已准备账单、Abrechnung、付款记录和异常说明草稿。",
    uploadDocs: "上传资料",
    generatePack: "手动发送资料包",
    checklistTitle: "资料清单",
    connectionTitle: "DATEV 连接方式",
    handoffTitle: "税务师交流窗",
    monthlyTitle: "每月资料包检查",
    advisorName: "Steuerberater Müller",
    firm: "Müller & Partner 税务师事务所",
    datevMethod: "DATEV Unternehmen online",
    datevStatus: "已连接",
    contact: "事务所 Email + KaiSpan 自动同步",
    changeAdvisor: "更换税务师",
    packageItems: [
      ["供应商账单", "42张", "已准备", "green"],
      ["外部平台账单", "5份", "已准备", "green"],
      ["每日 Abrechnung", "31条", "已准备", "green"],
      ["工资资料", "4名员工", "待复核", "orange"],
      ["DATEV 导出", "1个资料包", "已准备", "green"],
      ["异常说明", "4条", "待补充", "orange"]
    ],
    handoffItems: ["税务师问，上个月缺的dm账单什么时候给到", "补充 Metro 重复账单说明", "确认 JFC Lieferschein 差异审批备注", "复核 5 月员工工资和工时资料", "补充 Betriebsnummer 最新状态", "说明 22.05 现金账差异", "确认 DEP-0524 银行存款票据", "复核 CHEFS CULINAR Kontierung", "回复 Umsatzsteuer 相关问题"],
    ready: "已准备",
    checklist: ["供应商账单 42张", "每日 Abrechnung 31条", "付款记录 18笔", "异常说明 4条", "DATEV 导出文件 1份", "工资资料 4名员工", "现金账 31天", "Kontierung 12项", "银行对账 18笔", "税务师备注 3条"],
    payrollTitle: "员工工资资料",
    payrollBadge: "月结示例",
    payrollHeaders: ["员工", "工时", "Urlaub", "病假", "时薪", "工资"],
    receiptTitle: "票据一览",
    synced: "已同步",
    receiptTabs: [
      { id: "zbon", label: "Z-Bon" },
      { id: "bill", label: "账单" },
      { id: "cash", label: "现金账单" },
      { id: "kontoauszug", label: "Kontoauszug" }
    ],
    receiptHeaders: ["日期", "来源", "编号", "金额", "状态"],
    statuses: { synced: "已同步", confirm: "待确认", recognized: "已识别", note: "需备注", uploaded: "票据已上传", checked: "已核对", explain: "需说明" },
    externalAdvisor: "+ 添加外部税务师"
  };
  const day = de ? "Tg." : "天";
  const receiptRows = {
    zbon: [
      ["2025-05-24", "Martin Biergarten", "ZB-0524", "€2,840.00", "synced"],
      ["2025-05-23", "Martin Cafe", "ZB-0523", "€1,980.00", "synced"],
      ["2025-05-22", "Martin Biergarten 2", "ZB-0522", "€2,560.00", "confirm"],
      ["2025-05-21", "Martin Biergarten", "ZB-0521", "€2,410.00", "synced"],
      ["2025-05-20", "Martin Cafe", "ZB-0520", "€1,760.00", "synced"],
      ["2025-05-19", "Martin Biergarten 2", "ZB-0519", "€2,220.00", "confirm"],
      ["2025-05-18", "Martin Biergarten", "ZB-0518", "€2,930.00", "synced"]
    ],
    bill: [
      ["2025-05-24", "Metro Deutschland", "INV-2405-11", "€980.20", "recognized"],
      ["2025-05-22", "CHEFS CULINAR", "INV-2405-18", "€1,245.60", "note"],
      ["2025-05-21", "Lieferando", "PAY-0524", "€1,420.00", "recognized"],
      ["2025-05-20", "JFC Deutschland", "RE-2405-20", "€486.20", "recognized"],
      ["2025-05-19", "Transgourmet", "TG-2405-19", "€860.50", "note"],
      ["2025-05-18", "FrischeParadies", "FP-2405-18", "€345.90", "recognized"]
    ],
    cash: [
      ["2025-05-24", de ? "Bareinzahlung" : "现金存款", "DEP-0524", "€620.00", "uploaded"],
      ["2025-05-23", de ? "Kassenbuch" : "现金账", "CASH-0523", "€710.00", "checked"],
      ["2025-05-22", de ? "Kassendifferenz" : "现金差异", "DIFF-0522", "-€18.40", "explain"],
      ["2025-05-21", de ? "Bareinzahlung" : "现金存款", "DEP-0521", "€540.00", "uploaded"],
      ["2025-05-20", de ? "Kassenbuch" : "现金账", "CASH-0520", "€690.00", "checked"],
      ["2025-05-19", de ? "Kassendifferenz" : "现金差异", "DIFF-0519", "-€9.20", "explain"]
    ],
    kontoauszug: [
      ["2025-05-24", "Sparkasse", "KTO-0524", "€3,460.00", "checked"],
      ["2025-05-23", "Sparkasse", "KTO-0523", "€2,190.00", "checked"],
      ["2025-05-22", "Sparkasse", "KTO-0522", "€1,840.00", "confirm"],
      ["2025-05-21", "Sparkasse", "KTO-0521", "€2,760.00", "checked"]
    ]
  };
  const payrollRows = [
    ["Kevin", "132h", `2${day}`, `0${day}`, "€13.50", "€1,782.00"],
    ["Lisa", "118h", `1${day}`, `1${day}`, "€14.20", "€1,675.60"],
    ["Anna", "96h", `0${day}`, `2${day}`, "€12.80", "€1,228.80"],
    ["Tom", "154h", `3${day}`, `0${day}`, "€15.00", "€2,310.00"],
    ["Mia", "86h", `0${day}`, `1${day}`, "€13.20", "€1,135.20"],
    ["Jonas", "104h", `1${day}`, `0${day}`, "€13.80", "€1,435.20"],
    ["Sara", "76h", `0${day}`, `0${day}`, "€12.90", "€980.40"],
    ["Nico", "64h", `2${day}`, `0${day}`, "€12.50", "€800.00"]
  ];
  const currentRows = receiptRows[receiptTab] || receiptRows.zbon;
  return `
    <div class="page-head"><div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div>${financeBackButton()}</div>
    <section class="grid grid-2 tax-advisor-overview">
      <div class="card tax-advisor-profile">
        <div class="section-title"><h2>${copy.advisorName}</h2><span class="pill green">${copy.connected}</span></div>
        <div class="advisor-profile-grid">
          <span><small>${copy.connectionTitle}</small><strong>${copy.datevMethod}</strong><em>${copy.datevStatus}</em></span>
          <span><small>${de ? "Kanzlei" : "事务所"}</small><strong>${copy.firm}</strong><em>${copy.contact}</em></span>
        </div>
        <div class="advisor-edit-row"><button class="ghost-btn">${de ? "Bearbeiten" : "编辑"}</button><button class="ghost-btn">${copy.changeAdvisor}</button></div>
      </div>
      <div class="card tax-handoff-card">
        <div class="section-title"><h2>${copy.handoffTitle}</h2><span class="pill orange">${de ? "Diese Woche" : "本周"}</span></div>
        <div class="tax-handoff-scroll">${copy.handoffItems.map(item=>`<div class="status-line">${item}<span class="pill blue">${de ? "To-do" : "待处理"}</span></div>`).join("")}</div>
      </div>
    </section>
    <section class="card tax-package-card">
      <div class="section-title"><h2>${copy.monthlyTitle}</h2><button class="primary-btn">${copy.generatePack}</button></div>
      <div class="tax-package-grid">${copy.packageItems.map(item=>`<div class="tax-package-item"><span>${item[0]}</span><strong>${item[1]}</strong><em class="pill ${item[3]}">${item[2]}</em></div>`).join("")}</div>
    </section>
    <section class="card tax-payroll-card">
        <div class="section-title"><h2>${copy.payrollTitle}</h2><div class="button-row"><span class="pill blue">${copy.payrollBadge}</span><a class="ghost-btn" href="#${slug("finance", "税务师工资资料编辑")}">${de ? "Bearbeiten" : "编辑"}</a></div></div>
        <div class="tax-scroll-area"><table class="table compact-table">
          <thead><tr>${copy.payrollHeaders.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${payrollRows.map(r=>`<tr>${r.map((c,i)=>`<td${i === 5 ? " class=\"strong-money\"" : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>
    </section>
    <section class="tax-advisor-data">
      <div class="card tax-receipt-overview-card">
        <div class="section-title"><h2>${copy.receiptTitle}</h2><div class="button-row"><span class="pill green">${copy.synced}</span><a class="ghost-btn" href="#${slug("finance", "税务师票据编辑")}">${de ? "Bearbeiten" : "编辑"}</a></div></div>
        <div class="segmented-tabs">${copy.receiptTabs.map(t=>`<a class="filter ${receiptTab === t.id ? "active" : ""}" href="#finance-税务师?receipt=${t.id}">${t.label}</a>`).join("")}</div>
        <div class="tax-scroll-area"><table class="table compact-table tax-receipt-table">
          <thead><tr>${copy.receiptHeaders.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${currentRows.map(r=>`<tr><td>${r[0]}</td><td><strong>${r[1]}</strong></td><td>${r[2]}</td><td class="strong-money">${r[3]}</td><td><span class="pill ${["confirm","note","explain"].includes(r[4]) ? "orange" : "green"}">${copy.statuses[r[4]]}</span></td></tr>`).join("")}</tbody>
        </table></div>
      </div>
    </section>`;
}

function financeTaxPayrollEditPage() {
  const de = currentLanguage() === "de";
  const title = de ? "Lohnunterlagen bearbeiten" : "编辑员工工资资料";
  const subtitle = de ? "Ändern Sie Arbeitsstunden, Urlaub, Krankheit, Krankenkassen-Erstattung, Stundenlohn und Lohnbetrag manuell." : "手动修改员工、工时、Urlaub、病假、保险公司是否退款、时薪和工资金额。";
  const headers = de ? ["Mitarbeiter", "Stunden", "Urlaub", "Krankheit", "Krankenkasse", "Stundenlohn", "Lohn", "Hinweis"] : ["员工", "工时", "Urlaub", "病假", "保险公司是否退款", "时薪", "工资", "备注"];
  const rows = [
    ["Kevin", "132h", "2天", "0天", "无需退款", "€13.50", "€1,782.00", "厨房 · Vollzeit"],
    ["Lisa", "118h", "1天", "1天", "待申请", "€14.20", "€1,675.60", "服务 · Teilzeit"],
    ["Anna", "96h", "0天", "2天", "已退款", "€12.80", "€1,228.80", "吧台 · Teilzeit"],
    ["Tom", "154h", "3天", "0天", "无需退款", "€15.00", "€2,310.00", "厨房 · Vollzeit"]
  ];
  return `
    <div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("finance", "税务师")}">${de ? "Zurück" : "返回税务师"}</a><button class="primary-btn">${de ? "Speichern" : "保存修改"}</button></div></div>
    <section class="card">
      <div class="section-title"><h2>${de ? "Monat 2025-05" : "2025-05 月工资资料"}</h2><button class="ghost-btn">${de ? "+ Mitarbeiter" : "+ 添加员工"}</button></div>
      <table class="table editable-table">
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(row=>`<tr>${row.map(value=>`<td><input value="${value}"></td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </section>`;
}

function financeTaxReceiptEditPage() {
  const de = currentLanguage() === "de";
  const title = de ? "Belege bearbeiten" : "编辑票据资料";
  const subtitle = de ? "Prüfen Sie Z-Bon, Kontoauszug, Rechnungen, Barbelege und Kassenberichte in einer bearbeitbaren Monatsübersicht." : "按 Z-Bon、Kontoauszug、账单、现金账单和 Kassebericht 查看月度票据，可手动修改、点开原始文件、删除或新增记录。";
  const actionLabels = de ? { edit: "Bearbeiten", delete: "Löschen" } : { edit: "编辑", delete: "删除" };
  const statusOptions = de ? ["Erkannt", "Problem"] : ["已识别", "有问题"];
  const matchOptions = de ? ["Abgeglichen", "Nicht abgeglichen"] : ["已匹配", "未匹配"];
  const yesNoOptions = de ? ["Fertig", "Nicht fertig"] : ["已完成", "未完成"];
  const textCell = (value) => `<td><input value="${value}"></td>`;
  const selectCell = (value, options, hint = "") => `<td><div class="receipt-match-cell"><select>${options.map(option=>`<option ${option === value ? "selected" : ""}>${option}</option>`).join("")}</select>${hint ? `<small>${hint}</small>` : ""}</div></td>`;
  const originalCell = (name) => `<td><a class="receipt-file-link" href="${name}" target="_blank" rel="noreferrer" aria-label="${name}">${name}</a></td>`;
  const actionCell = () => `<td><div class="receipt-row-actions"><button class="ghost-btn">${actionLabels.edit}</button><button class="ghost-btn danger-btn">${actionLabels.delete}</button></div></td>`;
  const renderEditableRow = (row, options = {}) => `<tr>
              ${row.fields.map(textCell).join("")}
              ${selectCell(row.status, options.statusOptions || statusOptions, row.hint || "")}
              ${originalCell(row.original)}
              ${actionCell()}
            </tr>`;
  const renderPlainRow = (row) => `<tr>
              ${row.fields.map(textCell).join("")}
              ${originalCell(row.original)}
              ${actionCell()}
            </tr>`;
  const detailGrid = (items) => `<div class="receipt-detail-grid">${items.map(item=>`<div><span>${item[0]}</span><strong>${item[1]}</strong></div>`).join("")}</div>`;
  const overviewDetails = [[de ? "Monat" : "当前月份", "2025-05"], [de ? "Filiale" : "门店", "Martin Biergarten"], [de ? "Empfänger" : "同步对象", "Steuerberater Müller"]];
  const sections = [
    {
      title: "Z-Bon",
      status: de ? "Mai: 10 Z-Bon fehlen" : "5 月还缺少 10 个 Z-Bon",
      statusClass: "orange",
      add: de ? "+ Z-Bon hinzufügen" : "+ 添加 Z-Bon",
      detail: de ? "POS Tagesabschluss, Kartenumsatz, Barumsatz und Differenzen." : "POS 日结、刷卡金额、现金金额和差异说明。",
      headers: de ? ["Datum", "Beleg-Nr.", "Brutto", "Netto", "Status", "Original", "Aktion"] : ["日期", "账单号", "Brutto", "Netto", "状态", "原始单据", "操作"],
      details: [[de ? "Monat" : "当前月份", "2025-05"], [de ? "Filiale" : "门店", "Martin Biergarten"], [de ? "Empfänger" : "同步对象", "Steuerberater Müller"]],
      render: (row) => renderEditableRow(row),
      rows: [
        { fields: ["2025-05-24", "ZB-0524", "€2,840.00", "€2,386.55"], status: "已识别", kontierungDone: true, original: "Z-Bon_2025-05-24.pdf" },
        { fields: ["2025-05-23", "ZB-0523", "€1,980.00", "€1,663.87"], status: "已识别", kontierungDone: true, original: "Z-Bon_2025-05-23.pdf" },
        { fields: ["2025-05-22", "ZB-0522", "€2,560.00", "€2,151.26"], status: "有问题", kontierungDone: false, original: "Z-Bon_2025-05-22.jpg" }
      ]
    },
    {
      title: "Kontoauszug",
      status: de ? "Mai hochgeladen, Abgleich läuft" : "5 月已上传，正在匹配账单",
      statusClass: "green",
      add: de ? "+ Kontoauszug hinzufügen" : "+ 添加 Kontoauszug",
      detail: de ? "Uploaddatum, Auszugsmonat, Bank, Rechnungsabgleich und Originaldatei." : "上传日期、流水单月份、银行、是否完成账单匹配和原始文件。",
      headers: de ? ["Uploaddatum", "Auszugsmonat", "Bank", "Rechnungsabgleich", "Original", "Aktion"] : ["上传日期", "流水单月份", "银行", "是否完成账单匹配", "原始文件", "操作"],
      details: [[de ? "Monat" : "流水月份", "2025-05"], [de ? "Bank" : "银行", "Sparkasse"], [de ? "Empfänger" : "同步对象", "Steuerberater Müller"]],
      render: (row) => `<tr>
              ${row.fields.map(textCell).join("")}
              ${selectCell(row.status, yesNoOptions)}
              ${originalCell(row.original)}
              ${actionCell()}
            </tr>`,
      rows: [
        { fields: ["2025-05-25", "2025-05", "Sparkasse"], status: "已完成", original: "Kontoauszug_2025-05.pdf" },
        { fields: ["2025-04-25", "2025-04", "Sparkasse"], status: "已完成", original: "Kontoauszug_2025-04.pdf" },
        { fields: ["2025-03-25", "2025-03", "Deutsche Bank"], status: "未完成", original: "Kontoauszug_2025-03.pdf" }
      ]
    },
    {
      title: de ? "Rechnungen" : "账单",
      status: de ? "Mit Kontoauszug abgeglichen, keine Lücke" : "已与 Kontoauszug 比对，无缺失",
      statusClass: "green",
      add: de ? "+ Rechnung hinzufügen" : "+ 添加账单",
      detail: de ? "Lieferanten- und Plattformrechnungen mit Lieferanten-Nr., Rechnungsnummer, Brutto und Netto." : "供应商账单和外部平台账单，按供应商编号、账单号、Brutto、Netto 管理。",
      headers: de ? ["Lieferant-Nr.", "Datum", "Lieferant", "Rechnungs-Nr.", "Brutto", "Netto", "Kontoauszug-Abgleich", "Original", "Aktion"] : ["供应商编号", "日期", "供应商", "账单号", "Brutto", "Netto", "与流水单匹配", "原始单据", "操作"],
      details: [[de ? "Monat" : "当前月份", "2025-05"], [de ? "Filiale" : "门店", "Martin Biergarten"], [de ? "Empfänger" : "同步对象", "Steuerberater Müller"]],
      render: (row) => renderEditableRow(row, { statusOptions: matchOptions }),
      rows: [
        { fields: ["SUP-METRO", "2025-05-24", "Metro Deutschland", "INV-2405-11", "€980.20", "€823.70"], status: "已匹配", kontierungDone: true, original: "Metro_INV-2405-11.pdf" },
        { fields: ["SUP-UBER", "2025-05-23", "Uber Eats", "UE-0523", "€860.50", "€723.11"], status: "未匹配", hint: "下一步：加入 offene Rechnung / 移到现金账单", kontierungDone: false, original: "UberEats_0523.pdf" },
        { fields: ["SUP-DM", "2025-05-21", "DM", "DM-0521", "€74.30", "€62.44"], status: "已匹配", kontierungDone: true, original: "DM_0521.jpg" },
        { fields: ["SUP-DM", "2025-05-19", "DM", "DM-0519", "€42.10", "€35.38"], status: "已匹配", kontierungDone: true, original: "DM_0519_Dortmund.pdf" }
      ]
    },
    {
      title: de ? "Kassenbuch" : "现金账单",
      status: de ? "Nur Barbelege, kein Kontoauszug-Abgleich" : "仅现金消费账单，无 Kontoauszug 对账",
      statusClass: "blue",
      add: de ? "+ Kassenbuch hinzufügen" : "+ 添加现金账单",
      detail: de ? "Nur Rechnungen, die bar bezahlt wurden. Struktur wie Rechnungen, aber ohne Kontoauszug-Abgleich." : "这里只放花现金产生的账单；格式参考账单模块，但没有与 Kontoauszug 对账。",
      headers: de ? ["Lieferant-Nr.", "Datum", "Händler", "Rechnungs-Nr.", "Brutto", "Netto", "Original", "Aktion"] : ["供应商编号", "日期", "商家", "账单号", "Brutto", "Netto", "原始单据", "操作"],
      details: [[de ? "Monat" : "当前月份", "2025-05"], [de ? "Filiale" : "门店", "Martin Biergarten"], [de ? "Kasse" : "现金来源", "Kasse Martin"]],
      render: (row) => renderPlainRow(row),
      rows: [
        { fields: ["SUP-JFC", "2025-05-24", "JFC Deutschland", "CASH-2405-18", "€142.80", "€120.00"], status: "已识别", kontierungDone: true, original: "JFC_Cash_0524.pdf" },
        { fields: ["SUP-DM", "2025-05-23", "DM", "CASH-DM-0523", "€38.60", "€32.44"], status: "已识别", kontierungDone: true, original: "DM_Cash_0523.pdf" },
        { fields: ["SUP-LOCAL", "2025-05-20", "Local Market", "CASH-0520", "€69.00", "€57.98"], status: "有问题", kontierungDone: false, original: "LocalMarket_0520.jpg" }
      ]
    },
    {
      title: "Kassebericht",
      status: de ? "Tägliche Zählung vorhanden" : "每日现金盘点已记录",
      statusClass: "green",
      add: de ? "+ Kassebericht hinzufügen" : "+ 添加 Kassebericht",
      detail: de ? "Täglicher Kassenbestand nach Scheinen und Münzen." : "记录每天 Kasse 里有多少钱，以及 100、50、20 等面额数量。",
      headers: de ? ["Datum", "Gesamt", "100er", "50er", "20er", "10er", "Münzen", "Abgleich", "Original", "Aktion"] : ["日期", "现金总额", "100 欧", "50 欧", "20 欧", "10 欧", "硬币", "是否匹配", "原始单据", "操作"],
      details: [[de ? "Monat" : "当前月份", "2025-05"], [de ? "Kasse" : "现金箱", "Kasse Martin"], [de ? "Prüfung" : "复核", "Martin"]],
      render: (row) => `<tr>
              ${row.fields.map(textCell).join("")}
              ${selectCell(row.status, matchOptions)}
              ${originalCell(row.original)}
              ${actionCell()}
            </tr>`,
      rows: [
        { fields: ["2025-05-24", "€1,240.00", "4", "8", "18", "12", "€80.00"], status: "已匹配", original: "Kassebericht_0524.pdf" },
        { fields: ["2025-05-23", "€1,080.00", "3", "7", "16", "10", "€60.00"], status: "已匹配", original: "Kassebericht_0523.pdf" }
      ]
    },
    {
      title: de ? "Bareinzahlung" : "银行现金存钱",
      status: de ? "Mit Kontoauszug prüfen" : "需与 Kontoauszug 核对",
      statusClass: "orange",
      add: de ? "+ Einzahlung hinzufügen" : "+ 添加存钱记录",
      detail: de ? "Bar zur Bank eingezahlt, unter Kassebericht geführt und mit Kontoauszug abgeglichen." : "记录把现金存入银行的凭证，放在 Kassebericht 下方，并与 Kontoauszug 核对。",
      headers: de ? ["Datum", "Bank", "Beleg-Nr.", "Betrag", "Kontoauszug-Abgleich", "Original", "Aktion"] : ["日期", "银行", "凭证号", "金额", "与 Kontoauszug 匹配", "原始单据", "操作"],
      details: [[de ? "Monat" : "当前月份", "2025-05"], [de ? "Bank" : "银行", "Sparkasse"], [de ? "Filiale" : "门店", "Martin Biergarten"]],
      render: (row) => `<tr>
              ${row.fields.map(textCell).join("")}
              ${selectCell(row.status, matchOptions, row.hint || "")}
              ${originalCell(row.original)}
              ${actionCell()}
            </tr>`,
      rows: [
        { fields: ["2025-05-24", "Sparkasse", "DEP-0524", "€620.00"], status: "已匹配", original: "Deposit_0524.pdf" },
        { fields: ["2025-05-20", "Sparkasse", "DEP-0520", "€690.00"], status: "未匹配", hint: "下一步：等待 Kontoauszug 入账", original: "Deposit_0520.pdf" }
      ]
    }
  ];
  return `
    <div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="button-row"><a class="ghost-btn accent-back-btn" href="#${slug("finance", "税务师")}">${de ? "Zurück" : "返回税务师"}</a><button class="primary-btn">${de ? "Speichern" : "保存修改"}</button></div></div>
    <section class="card receipt-overview-card">${detailGrid(overviewDetails)}</section>
    <section class="receipt-edit-sections">
      ${sections.map((group)=>`
        <div class="card receipt-edit-category">
          <div class="section-title">
            <div>
              <div class="receipt-title-line"><h2>${group.title}</h2><span class="pill ${group.statusClass}">${group.status}</span></div>
              <p>${group.detail}</p>
            </div>
            <div class="button-row"><button class="ghost-btn">${group.add}</button></div>
          </div>
          <table class="table editable-table receipt-edit-table">
            <thead><tr>${group.headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
            <tbody>${group.rows.map(row=>group.render(row)).join("")}</tbody>
          </table>
        </div>`).join("")}
    </section>`;
}

function financeDatevPage() {
  const de = currentLanguage() === "de";
  const copy = de ? {
    title: "DATEV-Export",
    subtitle: "Exportieren Sie monatlich DATEV-Dateien oder ein Unterlagenpaket für den Steuerberater.",
    action: "DATEV exportieren",
    stats: [["Unterlagen dieses Monats", "Export läuft"], ["Rechnungen", "42 Stück"], ["Tagesabschlüsse", "31 Einträge"], ["Abweichungshinweise", "4 Stück"]],
    headers: ["Monat", "Datenumfang", "Abweichungshinweise", "Status", "Aktion"],
    rows: [["2025-05", "Rechnungen 42 Stück / Tagesabschlüsse 31 Einträge", "4 Hinweise", "Export läuft"], ["2025-04", "Rechnungen 39 Stück / Tagesabschlüsse 30 Einträge", "1 Hinweis", "Exportiert"], ["2025-03", "Rechnungen 36 Stück / Tagesabschlüsse 31 Einträge", "0 Hinweise", "Exportiert"]],
    listSuffix: "Liste",
    demo: "Demo-Daten",
    view: "Ansehen",
    quickTitle: "Schnellaktionen",
    quickActions: ["Filtern", "Excel exportieren", "An Steuerberater senden"],
    kaiTitle: "Kai Hinweis",
    kaiText: "Diese Seite kann später an echte Rechnungserkennung, Freigabeprozesse, Bankzahlungen und DATEV-Export angebunden werden."
  } : {
    title: "DATEV 导出",
    subtitle: "按月份导出 DATEV 格式或税务师需要的资料包。",
    action: "导出 DATEV",
    stats: [["本月资料", "正在导出"], ["账单", "42张"], ["日结", "31条"], ["异常说明", "4条"]],
    headers: ["月份", "资料范围", "异常说明", "状态", "操作"],
    rows: [["2025-05", "账单 42张 / 日结 31条", "异常说明 4条", "正在导出"], ["2025-04", "账单 39张 / 日结 30条", "异常说明 1条", "已导出"], ["2025-03", "账单 36张 / 日结 31条", "异常说明 0条", "已导出"]],
    listSuffix: "列表",
    demo: "Demo 数据",
    view: "查看",
    quickTitle: "快速操作",
    quickActions: ["筛选", "导出 Excel", "发送给税务师"],
    kaiTitle: "Kai 提示",
    kaiText: "此页面后续可接入真实账单识别、审批流、银行付款和 DATEV 导出。"
  };
  return financeTablePage(copy);
}

function financeTablePage(copy) {
  return `
    <div class="page-head"><div><h1>${copy.title}</h1><p>${copy.subtitle}</p></div><button class="primary-btn">${copy.action}</button></div>
    <section class="grid grid-4">${copy.stats.map((x,i)=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${["blue","orange","green","red"][i]})">${x[1]}</div>${x[2] ? `<span class="muted">${x[2]}</span>` : ""}</div>`).join("")}</section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>${copy.title}${copy.listSuffix}</h2><span class="pill blue">${copy.demo}</span></div>
      <table class="table"><thead><tr>${copy.headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${copy.rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}<td><button class="ghost-btn">${copy.view}</button></td></tr>`).join("")}</tbody></table>
    </section>
    <section class="grid grid-2" style="margin-top:16px"><div class="card"><h2>${copy.quickTitle}</h2><div class="button-row">${copy.quickActions.map(action=>`<button class="ghost-btn">${action}</button>`).join("")}</div></div><div class="card"><h2>${copy.kaiTitle}</h2><p>${copy.kaiText}</p></div></section>`;
}

function storePage() {
  const storeTasks = [
    ["HACCP 温度记录", "冷藏柜 2 温度记录还未填写", "HACCP 管理", "剩余 2 小时", "red"],
    ["Google 差评待回复", "晚餐高峰等待时间差评需要回复", "Google 评价", "今天", "orange"],
    ["开店检查", "Martin Cafe 开店检查未完成", "门店任务", "剩余 30 分钟", "orange"],
    ["总部巡店整改", "后厨清洁照片和整改备注待补充", "任务与反馈", "剩余 2 天", "blue"]
  ];
  return `
    <section class="store-home-hero">
      <div>
        <h1>门店运营中心</h1>
        <p>全方位掌握门店运营状况，让管理更简单。</p>
      </div>
      <div class="store-date-card">
        <strong>2025-05-24 星期六</strong>
        <span>天气：22°C</span>
      </div>
    </section>
    <section class="store-home-modules">
      <a class="finance-module-card store-module-haccp" href="#${slug("store", "HACCP 管理")}">
        <div class="finance-module-head"><h2>HACCP</h2><span class="pill orange">1项待办</span></div>
        <p>温度记录、卫生检查、入库检查、清洁任务和卫生局资料。</p>
        <div class="finance-module-mini"><span>今日完成度 82%</span><span>温度记录还差 1 项</span></div>
        <span class="finance-module-cta">进入 HACCP →</span>
      </a>
      <a class="finance-module-card store-module-task-feedback" href="#${slug("store", "任务与反馈")}">
        <div class="finance-module-head"><h2>任务与反馈</h2><span class="pill red">3项待处理</span></div>
        <p>开店、收店、设备检查、店长反馈、员工反馈和客户投诉。</p>
        <div class="finance-module-mini"><span>开店检查未完成</span><span>洗碗机排水慢 · 处理中</span></div>
        <span class="finance-module-cta">进入任务与反馈 →</span>
      </a>
      <a class="finance-module-card store-module-review" href="#${slug("store", "线上评价")}">
        <div class="finance-module-head"><h2>线上评价</h2><span class="pill orange">2条待回</span></div>
        <p>Google、Lieferando、Uber Eats 和 Wolt 的评价与评分。</p>
        <div class="finance-module-mini"><span>Google 4.3 · 1条差评</span><span>Lieferando 4.4 · 1条待回</span></div>
        <span class="finance-module-cta">进入线上评价 →</span>
      </a>
    </section>
    <section class="card red-zone finance-home-todos store-home-todos">
      <div class="section-title"><h2>今日待办事项</h2><a class="ghost-btn" href="#${slug("store", "待办事项")}">查看全部</a></div>
      <div class="warn-list">${storeTasks.map(x=>`<div class="warn-item"><div><strong>${x[0]}</strong><span>${x[1]} · ${x[3]}</span></div><a class="ghost-btn" href="#${slug("store", x[2])}">处理</a></div>`).join("")}</div>
    </section>`;
}

function storeDetailPage(child) {
  if (child === "门店总览") return storePage();
  if (child === "设备巡检") return storeTasksPage();
  const pages = {
    "待办事项": storeTodosPage,
    "HACCP 管理": storeHaccpPage,
    "卫生局检查所需文件汇总": storeHealthAuthorityFilesPage,
    "门店任务": storeTasksPage,
    "任务与反馈": storeTaskFeedbackPage,
    "员工管理": storeEmployeePage,
    "员工打卡": storeClockPage,
    "排班管理": storeSchedulePage,
    "Google 评价": storeGooglePage,
    "线上评价": storeOnlineReviewsPage,
    "外卖平台": storeDeliveryPage,
    "反馈记录": storeFeedbackPage,
    "多门店运营": storeMultiPage,
    "门店分析": storeAnalysisPage,
    "AI 运营建议": storeAiAdvicePage
  };
  return (pages[child] || (() => placeholderPage("门店助手", child)))();
}

function storeMiniStats(items) {
  return `<section class="grid grid-4">${items.map((x,i)=>{
    const body = `<p>${x[0]}</p><div class="metric-value" style="color:var(--${["red","blue","green","orange"][i]})">${x[1]}</div>${x[2] ? `<span class="muted">${x[2]}</span>` : ""}`;
    return x[3] ? `<a class="card stat-link-card" href="#${x[3]}">${body}</a>` : `<div class="card">${body}</div>`;
  }).join("")}</section>`;
}

function storeTodosPage() {
  const tasks = [
    ["HACCP 未填写", "请填写温度记录", "Martin Biergarten", "2小时内", "高", "HACCP 管理"],
    ["员工未打卡", "Kevin 今日未打卡", "Martin Biergarten", "已超时 15分钟", "高", "员工打卡"],
    ["Google 差评", "新增 1 条差评等待回复", "Martin Biergarten", "今天", "中", "Google 评价"],
    ["开店检查", "开店检查未完成", "Martin Cafe", "30分钟内", "中", "门店任务"],
    ["巡店整改", "总部巡店整改未完成", "Martin Biergarten 2", "2天内", "中", "多门店运营"]
  ];
  return `
    <div class="page-head"><div><h1>门店待办事项</h1><p>集中处理 HACCP、员工打卡、门店任务、评价和多门店异常。</p></div><button class="primary-btn">生成今日任务</button></div>
    ${storeMiniStats([["高风险","2项"],["今日待办","5项"],["已完成","18项"],["即将超时","2项"]])}
    <section class="card red-zone" style="margin-top:16px"><div class="section-title"><h2>优先处理</h2><div class="filter-row compact"><button class="filter active">全部</button><button class="filter">HACCP</button><button class="filter">员工</button><button class="filter">评价</button></div></div><table class="table"><thead><tr><th>类型</th><th>任务</th><th>门店</th><th>截止</th><th>风险</th><th>操作</th></tr></thead><tbody>${tasks.map(r=>`<tr><td>${r[0]}</td><td><strong>${r[1]}</strong></td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[4]==="高"?"red":"orange"}">${r[4]}</span></td><td><a class="ghost-btn bill-action" href="#${slug("store", r[5])}">查看详情</a></td></tr>`).join("")}</tbody></table></section>`;
}

function storeHaccpPage() {
  const checks = ["卫生检查表", "害虫防治", "冰箱温度记录", "入库检查", "清洁任务", "Belehrung 到期提醒", "卫生异常记录", "卫生局检查资料", "总部卫生局总结反馈"];
  return `
    <div class="page-head"><div><h1>HACCP 管理</h1><p>管理卫生检查、温度、入库、清洁、Belehrung、异常记录和卫生局检查资料。</p></div><button class="primary-btn">+ 新增 HACCP 记录</button></div>
    ${storeMiniStats([["今日待填项目","1项"],["今日完成度","82%"],["卫生局检查所需文件汇总","4类资料","点击查看", slug("store", "卫生局检查所需文件汇总")],["异常记录","1条"]])}
    <section class="grid grid-3" style="margin-top:16px">${checks.map((x,i)=>`<div class="card"><div class="section-title"><h2>${x}</h2><span class="pill ${i===2||i===6?"orange":"green"}">${i===2||i===6?"需处理":"正常"}</span></div><p>${i===1 ? "记录害虫防治日期、合作公司和证明文件。" : i===7 ? "上传卫生局需要的检查资料、温度表和清洁记录。" : "填写表单、上传照片或让店长确认。"}</p><div class="button-row"><button class="ghost-btn">填写表单</button><button class="ghost-btn">上传证明</button></div></div>`).join("")}</section>`;
}

function storeHealthAuthorityFilesPage() {
  const groups = [
    ["卫生检查表", "本周厨房卫生检查、冷藏冷冻温度、入库检查记录。", "12份", "已汇总"],
    ["害虫防治", "合作公司证明、检查日期、下一次服务时间和处理备注。", "3份", "已汇总"],
    ["员工健康证和培训记录", "员工健康证、Belehrung、食品安全培训记录和到期提醒。", "18人", "2人即将到期"],
    ["清洁检查表", "每日清洁任务、负责人、完成照片和店长确认记录。", "31条", "已汇总"]
  ];
  return `
    <div class="page-head"><div><h1>卫生局检查所需文件汇总</h1><p>统一汇总卫生检查表、害虫防治、员工健康证与培训记录、清洁检查表，方便卫生局检查时快速提供。</p></div><a class="ghost-btn accent-back-btn" href="#${slug("store", "HACCP 管理")}">返回 HACCP</a></div>
    ${storeMiniStats([["资料类别","4类"],["本月文件","64份"],["待补资料","2项"],["可导出","PDF包"]])}
    <section class="grid grid-2" style="margin-top:16px">
      ${groups.map((x,i)=>`<div class="card"><div class="section-title"><h2>${x[0]}</h2><span class="pill ${i===2 ? "orange" : "green"}">${x[3]}</span></div><p>${x[1]}</p><div class="metric-value" style="font-size:24px;margin-top:10px">${x[2]}</div><div class="button-row"><button class="ghost-btn">查看文件</button><button class="ghost-btn">上传补充</button></div></div>`).join("")}
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>检查资料包预览</h2><button class="primary-btn">生成卫生局检查资料包</button></div>
      <table class="table"><thead><tr><th>资料</th><th>范围</th><th>最近更新</th><th>状态</th><th>操作</th></tr></thead><tbody>
        ${[
          ["卫生检查表", "厨房 / 前厅 / 仓库", "2025-05-24", "完整"],
          ["害虫防治证明", "Martin Biergarten", "2025-05-20", "完整"],
          ["员工健康证和培训记录", "18名员工", "2025-05-18", "2项即将到期"],
          ["清洁检查表", "每日清洁任务", "2025-05-24", "完整"]
        ].map(x=>`<tr><td><strong>${x[0]}</strong></td><td>${x[1]}</td><td>${x[2]}</td><td><span class="pill ${x[3].includes("即将") ? "orange" : "green"}">${x[3]}</span></td><td><button class="ghost-btn">查看</button></td></tr>`).join("")}
      </tbody></table>
    </section>`;
}

function storeTasksPage() {
  const rows = [
    ["开店任务", "检查收银、灯光、桌面、厕所", "90%", "Lisa", "今日"],
    ["收店任务", "清洁厨房、关闭设备、现金确认", "70%", "Tom", "今日"],
    ["店长每日确认", "确认 HACCP、现金账、员工出勤", "100%", "Martin", "今日"],
    ["设备 / 设施检查", "冰箱、洗碗机、炸炉、空调、收银机", "80%", "Kevin", "本周"]
  ];
  return `
    <div class="page-head"><div><h1>门店任务</h1><p>管理开店、收店、店长确认、多门店任务模板和设备 / 设施检查。</p></div><button class="primary-btn">+ 新建任务模板</button></div>
    ${storeMiniStats([["未完成","3项"],["任务模板","12个"],["今日完成率","88%"],["需整改","1项"]])}
    <section class="card" style="margin-top:16px"><div class="section-title"><h2>任务清单</h2><button class="ghost-btn">一键复制到其他门店</button></div><table class="table"><thead><tr><th>任务类型</th><th>内容</th><th>完成率</th><th>负责人</th><th>周期</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}<td><button class="ghost-btn">查看详情</button></td></tr>`).join("")}</tbody></table></section>
    <section class="card" style="margin-top:16px"><h2>新增任务</h2><div class="form-grid">${field("任务名称", "检查制冰机")}${field("负责人", "Kevin")}${field("截止时间", "今天 18:00")}${selectField("任务循环", ["每日", "每周", "每月", "不循环", "自定义"])}${field("适用门店", "全部门店")}</div><button class="primary-btn" style="margin-top:12px">保存任务</button></section>`;
}

function storeTaskFeedbackPage() {
  const taskRows = [
    ["开店任务", "检查收银、灯光、桌面、厕所", "Lisa", "今日 10:00", "进行中"],
    ["收店任务", "清洁厨房、关闭设备、现金确认", "Tom", "今日 23:00", "待处理"],
    ["设备 / 设施检查", "洗碗机排水慢，需要拍照确认", "Kevin", "今日 18:00", "待处理"],
    ["店长每日确认", "HACCP、现金账、员工出勤确认", "Martin", "今日", "已完成"]
  ];
  const feedbackRows = [
    ["店长反馈", "午餐高峰人手不足", "Martin Biergarten", "待处理"],
    ["员工反馈", "洗碗机排水慢", "Martin Cafe", "处理中"],
    ["客户投诉", "等位时间过长", "Martin Biergarten", "已回复"],
    ["设备损坏", "冷藏柜噪音异常", "Biergarten 2", "待维修"]
  ];
  return `
    <div class="page-head"><div><h1>任务与反馈</h1><p>合并管理门店任务、设备检查、店长反馈、员工反馈和客户投诉。</p></div><a class="ghost-btn accent-back-btn" href="#store">返回门店助手</a></div>
    ${storeMiniStats([["未完成任务","3项"],["反馈待处理","2条"],["今日完成率","88%"],["高风险","1条"]])}
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card">
        <div class="section-title"><h2>门店任务</h2><a class="ghost-btn" href="#${slug("store", "门店任务")}">查看详情</a></div>
        <table class="table"><thead><tr><th>类型</th><th>内容</th><th>负责人</th><th>截止</th><th>状态</th></tr></thead><tbody>${taskRows.map(r=>`<tr><td>${r[0]}</td><td><strong>${r[1]}</strong></td><td>${r[2]}</td><td>${r[3]}</td><td><span class="pill ${r[4]==="已完成"?"green":r[4]==="进行中"?"blue":"orange"}">${r[4]}</span></td></tr>`).join("")}</tbody></table>
      </div>
      <div class="card red-zone">
        <div class="section-title"><h2>反馈记录</h2><a class="ghost-btn" href="#${slug("store", "反馈记录")}">查看详情</a></div>
        <div class="warn-list">${feedbackRows.map(r=>`<div class="warn-item"><div><strong>${r[0]} · ${r[2]}</strong><span>${r[1]}</span></div><span class="pill ${r[3].includes("待") ? "orange" : "blue"}">${r[3]}</span></div>`).join("")}</div>
      </div>
    </section>
    <section class="card compact-feedback-card" style="margin-top:16px">
      <div class="section-title"><h2>快速新增</h2><div class="button-row compact-action-row"><button class="primary-btn">+ 新建任务</button><button class="ghost-btn">+ 新建反馈</button></div></div>
      <div class="compact-feedback-layout">
        <div>
          <div class="form-grid">${field("类型", "任务 / 店长反馈 / 员工反馈 / 客户投诉")}${field("相关门店", "Martin Biergarten")}${field("负责人", "Martin")}${field("截止时间", "今天 18:00")}</div>
          <textarea placeholder="填写任务或反馈内容..."></textarea>
        </div>
        <div class="compact-upload-panel">
          <strong>附件</strong>
          <p>照片 / 录音 / 维修单 / 客诉截图</p>
          <div class="upload small-upload">拖拽上传或点击选择</div>
          <button class="primary-btn">保存</button>
        </div>
      </div>
    </section>`;
}

function storeEmployeePage() {
  const rows = [["Martin","老板","管理者","全部权限","正常"],["Tom","厨师","普通员工","打卡 / 报班","正常"],["Lisa","服务员","普通员工","打卡 / 报班","正常"],["Anna","服务员","普通员工","打卡 / 报班","正常"],["Kevin","洗碗工","普通员工","资料待补","待完善"]];
  return `
    <div class="page-head"><div><h1>员工管理</h1><p>维护员工档案、证件、合同、角色、岗位和联系方式。</p></div><button class="primary-btn">+ 新增员工</button></div>
    ${storeMiniStats([["资料待补","1人"],["员工总数","9人"],["已启用","8人"],["证件到期","2人"]])}
    <section class="grid grid-2" style="margin-top:16px"><div class="card"><h2>员工信息</h2><div class="form-grid">${field("姓名", "Kevin")}${field("岗位", "洗碗工")}${field("手机号", "+49 ...")}${field("合同类型", "Minijob / Teilzeit")}${field("证件到期", "2026-08-30")}${field("所属门店", "Martin Biergarten")}</div><button class="primary-btn" style="margin-top:12px">保存员工信息</button></div><div class="card"><h2>员工文件</h2><div class="upload">上传合同 / Belehrung / Aufenthaltstitel / Steuer-ID</div></div></section>
    <section class="card" style="margin-top:16px"><h2>员工列表</h2><table class="table"><thead><tr><th>员工</th><th>岗位</th><th>账号类型</th><th>权限</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.slice(0,4).map(c=>`<td>${c}</td>`).join("")}<td><span class="pill ${r[4]==="正常"?"green":"orange"}">${r[4]}</span></td><td><button class="ghost-btn">编辑</button></td></tr>`).join("")}</tbody></table></section>`;
}

function storeClockPage() {
  const rows = [["Tom","09:02","迟到18分钟","需店长确认"],["Lisa","09:00","已到岗","正常"],["Anna","08:55","已到岗","正常"],["Kevin","未打卡","超时","待处理"]];
  return `
    <div class="page-head"><div><h1>员工打卡</h1><p>查看签到、签退、迟到、缺勤和未打卡情况。</p></div><button class="primary-btn">导出考勤</button></div>
    ${storeMiniStats([["未打卡","1人"],["已到岗","7人"],["准点率","88%"],["迟到","1人"]])}
    <section class="grid grid-2" style="margin-top:16px"><div class="card red-zone"><h2>异常打卡</h2>${rows.filter(r=>r[2]!=="已到岗").map(r=>`<div class="warn-item"><strong>${r[0]} · ${r[2]}</strong><button class="ghost-btn">处理</button></div>`).join("")}</div><div class="card"><h2>补卡申请</h2><div class="form-grid">${field("员工", "Kevin")}${field("补卡时间", "09:00")}${field("原因", "忘记打卡")}${field("审批人", "Martin")}</div><button class="primary-btn" style="margin-top:12px">提交补卡</button></div></section>
    <section class="card" style="margin-top:16px"><h2>今日出勤</h2><table class="table"><thead><tr><th>员工</th><th>打卡时间</th><th>状态</th><th>处理</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}<td><button class="ghost-btn">查看</button></td></tr>`).join("")}</tbody></table></section>`;
}

function storeSchedulePage() {
  return `
    <div class="page-head"><div><h1>排班管理</h1><p>查看和安排员工班次，后续可接入智能排班。</p></div><button class="primary-btn">+ 新增班次</button></div>
    ${storeMiniStats([["缺口班次","2个"],["本周班次","42个"],["已确认","36个"],["加班风险","1人"]])}
    <section class="grid grid-2" style="margin-top:16px"><div class="card"><h2>本周排班</h2>${["周一 Tom 10:00-18:00 厨房","周二 Lisa 11:00-20:00 服务","周三 Anna 12:00-21:00 服务","周五 Kevin 17:00-23:00 清洁"].map(x=>`<div class="status-line">${x}<button class="ghost-btn">调整</button></div>`).join("")}</div><div class="card"><h2>员工报班</h2><div class="form-grid">${field("员工", "Lisa")}${field("可上班时间", "周三 / 周五 晚班")}${field("不可上班", "周日")}${field("备注", "考试周")}</div><button class="primary-btn" style="margin-top:12px">保存报班</button></div></section>`;
}

function storeGooglePage() {
  return `
    <div class="page-head"><div><h1>Google 评价</h1><p>分析评分、关键词、差评并生成 AI 回复建议。</p></div><button class="primary-btn">同步 Google 评价</button></div>
    ${storeMiniStats([["差评待回","1条"],["本周新增","12条"],["平均评分","4.3"],["评分变化","-0.3"]])}
    <section class="grid grid-2" style="margin-top:16px"><div class="card red-zone"><h2>待回复差评</h2><p>“服务等待时间过长，晚餐高峰体验不佳。”</p><textarea placeholder="AI 回复建议：感谢您的反馈，我们会优化晚餐高峰的排队和出餐流程..."></textarea><div class="button-row"><button class="ghost-btn">重新生成</button><button class="primary-btn">发布回复</button></div></div><div class="card"><h2>关键词分析</h2>${["等待时间 5次","服务态度 4次","牛肉拉面 6次","啤酒花园氛围 8次"].map(x=>`<div class="status-line">${x}<span class="pill blue">趋势</span></div>`).join("")}</div></section>`;
}

function storeDeliveryPage() {
  return `
    <div class="page-head"><div><h1>外卖平台</h1><p>管理 Lieferando / Uber Eats / Wolt 的订单、营业额、评分和取消率。</p></div><button class="primary-btn">连接平台</button></div>
    ${storeMiniStats([["取消率","3.2%"],["今日订单","48单"],["外卖营业额","€740"],["平均评分","4.4"]])}
    <section class="grid grid-3" style="margin-top:16px">${["Lieferando","Uber Eats","Wolt"].map((x,i)=>`<div class="card"><div class="section-title"><h2>${x}</h2><span class="pill ${i===0?"green":"blue"}">${i===0?"已连接":"可连接"}</span></div><p>同步订单、营业额、评分和取消原因。</p><div class="form-grid">${field("账号 / API Key", "请输入")}${field("同步频率", "实时 / 每小时")}</div><button class="ghost-btn" style="margin-top:12px">设置</button></div>`).join("")}</section>`;
}

function storeOnlineReviewsPage() {
  const reviewRows = [
    ["Google", "4.3", "服务等待时间过长，晚餐高峰体验不佳。", "待回复", "orange"],
    ["Lieferando", "4.4", "包装很好，但配送时间偏慢。", "待回复", "orange"],
    ["Uber Eats", "4.5", "牛肉拉面很好吃。", "已回复", "green"],
    ["Wolt", "4.2", "少了一份饮料，需要退款说明。", "需处理", "red"]
  ];
  return `
    <div class="page-head"><div><h1>线上评价</h1><p>统一处理 Google、Lieferando、Uber Eats 和 Wolt 的评价、评分与回复。</p></div><a class="ghost-btn accent-back-btn" href="#store">返回门店助手</a></div>
    ${storeMiniStats([["待回复评价","2条"],["平台平均分","4.35"],["本周新增","28条"],["差评/投诉","2条"]])}
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card red-zone">
        <div class="section-title"><h2>待处理评价</h2><button class="ghost-btn">批量生成回复</button></div>
        <div class="warn-list">${reviewRows.map(r=>`<div class="warn-item"><div><strong>${r[0]} · ${r[1]}</strong><span>${r[2]}</span></div><span class="pill ${r[4]}">${r[3]}</span></div>`).join("")}</div>
      </div>
      <div class="card">
        <div class="section-title"><h2>平台概览</h2><span class="pill green">已同步</span></div>
        <table class="table"><thead><tr><th>平台</th><th>评分</th><th>本周新增</th><th>待回复</th><th>操作</th></tr></thead><tbody>
          ${[["Google","4.3","12","1"],["Lieferando","4.4","9","1"],["Uber Eats","4.5","5","0"],["Wolt","4.2","2","0"]].map(r=>`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><button class="ghost-btn">查看</button></td></tr>`).join("")}
        </tbody></table>
      </div>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="section-title"><h2>AI 回复草稿</h2><span class="pill purple">可编辑</span></div>
      <textarea>感谢您的反馈。很抱歉晚餐高峰等待时间影响了您的体验，我们会优化排队和出餐流程，并欢迎您下次再来体验。</textarea>
      <div class="button-row" style="margin-top:12px"><button class="ghost-btn">重新生成</button><button class="primary-btn">发布回复</button></div>
    </section>`;
}

function storeFeedbackPage() {
  const rows = [["店长反馈","午餐高峰人手不足","Martin Biergarten","待处理"],["员工反馈","洗碗机排水慢","Martin Cafe","处理中"],["客户投诉","等位时间过长","Martin Biergarten","已回复"],["设备损坏","冷藏柜噪音异常","Biergarten 2","待维修"]];
  return `
    <div class="page-head"><div><h1>反馈记录</h1><p>记录店长反馈、员工反馈、客户投诉、设备问题和异常事件。</p></div><button class="primary-btn">+ 新增反馈</button></div>
    ${storeMiniStats([["待处理","2条"],["本周新增","8条"],["已完成","21条"],["高风险","1条"]])}
    <section class="card compact-feedback-card" style="margin-top:16px">
      <div class="section-title"><h2>新增反馈</h2><span class="pill blue">支持附件</span></div>
      <div class="compact-feedback-layout">
        <div>
          <div class="form-grid">${field("反馈类型", "店长反馈 / 员工反馈 / 客户投诉")}${field("相关门店", "Martin Biergarten")}${field("负责人", "Martin")}${field("截止时间", "今天 18:00")}</div>
          <textarea placeholder="填写反馈内容..."></textarea>
        </div>
        <div class="compact-upload-panel">
          <strong>附件</strong>
          <p>照片 / 录音 / 维修单 / 客诉截图</p>
          <div class="upload small-upload">拖拽上传或点击选择</div>
          <button class="primary-btn">保存反馈</button>
        </div>
      </div>
    </section>
    <section class="card" style="margin-top:16px"><h2>反馈列表</h2><table class="table"><thead><tr><th>类型</th><th>内容</th><th>门店</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}<td><button class="ghost-btn">查看</button></td></tr>`).join("")}</tbody></table></section>`;
}

function storeMultiPage() {
  return `
    <div class="page-head"><div><h1>多门店运营</h1><p>巡店检查、多门店运营检查、多门店对比和一键导出给管理方。</p></div><button class="primary-btn">导出巡店报告</button></div>
    ${storeMiniStats([["问题门店","1家"],["门店数量","3家"],["平均完成率","86%"],["巡店待办","4项"]])}
    <section class="card" style="margin-top:16px"><h2>门店对比</h2><table class="table"><thead><tr><th>门店</th><th>营业额</th><th>HACCP</th><th>员工出勤</th><th>Google</th><th>巡店状态</th><th>操作</th></tr></thead><tbody>${stores.map((s,i)=>`<tr><td>${s}</td><td>€${[2840,1930,3210][i]}</td><td>${[82,76,91][i]}%</td><td>${[7,5,8][i]}/9</td><td>${[4.3,4.1,4.5][i]}</td><td><span class="pill ${i===1?"red":"green"}">${i===1?"需整改":"正常"}</span></td><td><button class="ghost-btn">巡店检查</button></td></tr>`).join("")}</tbody></table></section>`;
}

function storeAnalysisPage() {
  return businessStoreAnalysisPage();
}

function storeAiAdvicePage() {
  return `
    <div class="page-head"><div><h1>AI 运营建议</h1><p>Kai 根据门店数据生成备货、排班、评价回复和营销建议。</p></div><button class="primary-btn">生成新建议</button></div>
    ${storeMiniStats([["高优先级","2条"],["本周建议","8条"],["已采纳","5条"],["预计收益","€450"]])}
    <section class="grid grid-2" style="margin-top:16px">${[
      ["备货建议", "本周牛肉拉面销量上涨 32%，建议增加牛肉和面条备货。", "仓库管理助手"],
      ["排班建议", "周三营业额最低，可减少 1 名晚班服务员，推出午餐套餐。", "排班管理"],
      ["评价建议", "Google 评分下降 0.3，建议优先回复等待时间相关差评。", "Google 评价"],
      ["推广建议", "发现 3 名本地美食博主适合合作，预计推广预算 €450。", "营销推广"]
    ].map(x=>`<div class="card"><div class="section-title"><h2>${x[0]}</h2><span class="pill purple">Kai</span></div><p>${x[1]}</p><button class="ghost-btn">转到${x[2]}</button></div>`).join("")}</section>`;
}

function businessPage() {
  const news = ["德国餐饮业 2025 Q1 财报分析报告","REWE 集团 2025 Q1 财报：餐饮渠道增长 6.2%","Dortmund 区域菜单价格对比分析","Dortmund 主要竞争对手 Google 评论数变化","2025 年食品安全法规更新重点","Instagram 本地餐饮话题热度变化"];
  return `
    <div class="page-head"><div><h1>经营总览</h1><p>基于上个月数据，全面掌握经营健康状况。</p></div></div>
    <section class="card business-news-home" style="margin-top:16px">
      <div class="section-title"><h2>行业资讯</h2><a class="ghost-btn" href="#business-行业资讯">查看全部 →</a></div>
      <div class="h-scroll">${news.map(x=>`<article class="news-card"><span class="pill purple" style="align-self:flex-start">行业资讯</span><h3>${x}</h3><p>来自公开渠道与匿名汇总趋势，Kai 已提炼可行动建议。</p><a class="ghost-btn" style="margin-top:12px">查看详情</a></article>`).join("")}</div>
    </section>
    <section class="card monthly-pie-card business-overview-hero" style="margin-top:16px">
      <div class="section-title">
        <div>
          <h2>数据分析</h2>
          <p>一眼看清利润、食材、饮料、人工和固定支出的整体占比。</p>
        </div>
        <div class="business-analysis-actions">
          <a class="analysis-action-btn tone-stat" href="#business-详细数据分析">统计分析</a>
          <a class="analysis-action-btn tone-product" href="#business-商品分析">单品毛利分析</a>
          <a class="analysis-action-btn tone-employee" href="#business-员工分析">员工分析</a>
          <a class="analysis-action-btn tone-store" href="#business-门店运营分析">门店运营分析</a>
        </div>
      </div>
      <div class="monthly-pie-layout business-overview-layout">
        <div>
          <div class="business-overview-chart report-pie-image-wrap">
            <img class="report-pie-image" src="assets/business-cost-profit-report.png?v=2" alt="数据分析饼图" />
          </div>
        </div>
        <div class="business-overview-side">
          <div class="business-kpi-grid">
            <div class="business-kpi-card">
              <span>Brutto 营业额</span>
              <strong>€54,820</strong>
              <small>含税总收入</small>
            </div>
            <div class="business-kpi-card">
              <span>Netto 营业额</span>
              <strong>€46,067</strong>
              <small>不含税收入</small>
            </div>
            <div class="business-kpi-card">
              <span>上月利润</span>
              <strong class="profit">€12,480</strong>
              <small>利润率 22.8%</small>
            </div>
            <div class="business-kpi-card">
              <span>经营结果</span>
              <strong class="profit">盈利</strong>
              <small>关键指标健康度 82/100</small>
            </div>
          </div>
          <div class="business-overview-note">
            <p><strong>重点提醒：</strong>货物库存与上个月同一时间对比，当前多出 €2,340，主要集中在饮料与干货备货。</p>
          </div>
        </div>
      </div>
    </section>
    <section class="grid grid-2" style="margin-top:18px">
      <div class="card red-zone"><h2>经营异常提醒</h2>${["Dortmund 人工成本占比高于平均 18%","Metro 供应商价格上涨 9%","发现 2 张异常账单","Google 评分下降 0.3","鸡胸肉损耗增加 22%","部分门店清洁任务完成率低于 80%"].map(x=>`<div class="status-line"><span>${x}</span><button class="ghost-btn">查看详情</button></div>`).join("")}</div>
      <div class="card rating-promo-card">
        <div class="section-title">
          <h2>评分及推广</h2>
          <a class="ghost-btn" href="#business-评分及推广">详情</a>
        </div>
        ${[
          ["Google 评分变化", "4.3 → 4.0", "本周新增 12 条评论", "orange"],
          ["高频关键词", "等待时间 · 服务态度", "负面提及 6 次", "red"],
          ["推广机会", "午餐套餐 / 啤酒花园", "匹配 8 个达人", "purple"],
          ["建议预算", "€420 - €680", "预计覆盖 18k 人", "blue"]
        ].map(x=>`<div class="rating-promo-line"><div><strong>${x[0]}</strong><span>${x[1]}</span></div><button class="promo-signal ${x[3]}">${x[2]}</button></div>`).join("")}
      </div>
    </section>`;
}

function businessCostStructureAnalysisPage() {
  const selectedStore = state().params.get("store") || "Martin Biergarten";
  const moduleData = {
    "Martin Biergarten 2": [
      ["Netto 营业收入", "€46,920", "€48,380", "€47,640", "€50,240", "€58,260", "€58,260", "+16.0%", "团队订位和周末套餐带动 Netto 收入增长"],
      ["食材原材料", "20.8%", "20.2%", "19.9%", "19.6%", "19.7%", "€11,480", "+0.1%", "采购结构稳定，肉类用量随团队订位增加"],
      ["饮料原材料", "8.5%", "8.2%", "8.0%", "8.4%", "8.8%", "€5,128", "+0.4%", "啤酒花园消费提升饮料占比"],
      ["人工", "28.4%", "27.9%", "27.5%", "27.1%", "26.8%", "€15,616", "-0.3%", "排班效率优于其他门店"],
      ["房租", "9.6%", "9.3%", "9.1%", "8.8%", "8.2%", "€4,778", "-0.6%", "收入增长摊薄固定成本"],
      ["水电网络", "9.2%", "9.5%", "9.8%", "9.7%", "9.4%", "€5,476", "-0.3%", "厨房能耗稳定"],
      ["平台与银行费用", "4.1%", "4.2%", "4.0%", "4.1%", "4.3%", "€2,505", "+0.2%", "外卖订单略增"],
      ["其他支出", "6.7%", "6.4%", "6.2%", "6.4%", "6.0%", "€3,496", "-0.4%", "维修和清洁支出下降"],
      ["净利润", "22.7%", "23.1%", "23.5%", "24.9%", "25.2%", "€14,680", "+0.3%", "高客单和人工效率带来最佳利润率"]
    ],
    "Martin Biergarten": [
      ["Netto 营业收入", "€43,260", "€44,180", "€42,940", "€43,296", "€46,067", "€46,067", "+6.4%", "Netto 收入：周末堂食和外卖订单同步增长"],
      ["食材原材料", "22.7%", "23.6%", "21.9%", "22.1%", "21.4%", "€11,731", "-0.7%", "Metro 肉类价格回落，JFC 调味品仍偏高"],
      ["饮料原材料", "8.1%", "8.7%", "9.4%", "8.5%", "8.9%", "€4,879", "+0.4%", "啤酒与软饮备货高于上月同期"],
      ["人工", "29.8%", "30.6%", "31.2%", "29.5%", "28.7%", "€15,729", "-0.8%", "排班优化后晚班成本下降"],
      ["房租", "10.9%", "10.8%", "10.7%", "10.6%", "10.6%", "€5,809", "0.0%", "固定成本稳定"],
      ["水电网络", "9.8%", "10.3%", "10.9%", "11.2%", "11.5%", "€5,693", "+0.3%", "厨房用电和天然气消耗上升"],
      ["平台与银行费用", "4.6%", "4.8%", "4.5%", "4.7%", "4.9%", "€2,421", "+0.2%", "外卖平台订单占比提高"],
      ["其他支出", "7.4%", "7.9%", "8.1%", "7.8%", "7.6%", "€4,166", "-0.2%", "清洁与维修费用回落"],
      ["净利润", "16.7%", "15.3%", "13.3%", "15.6%", "22.8%", "€12,480", "+7.2%", "收入增长叠加人工占比下降"]
    ],
    "Martin Cafe": [
      ["Netto 营业收入", "€32,460", "€33,180", "€34,760", "€35,920", "€37,410", "€37,410", "+4.1%", "咖啡与午餐套餐带动 Netto 收入增长"],
      ["食材原材料", "19.6%", "19.2%", "18.8%", "18.6%", "18.9%", "€7,071", "+0.3%", "甜点原材料略有增加"],
      ["饮料原材料", "10.8%", "11.2%", "11.6%", "11.9%", "12.4%", "€4,639", "+0.5%", "咖啡豆与软饮采购占比上升"],
      ["人工", "32.8%", "33.5%", "32.6%", "31.9%", "31.4%", "€11,747", "-0.5%", "低峰时段仍有压缩空间"],
      ["房租", "11.5%", "11.2%", "10.9%", "10.6%", "10.2%", "€3,816", "-0.4%", "固定成本随收入增长被摊薄"],
      ["水电网络", "8.4%", "8.6%", "8.9%", "9.1%", "9.5%", "€3,554", "+0.4%", "咖啡设备使用时长增加"],
      ["平台与银行费用", "4.8%", "4.7%", "4.9%", "5.0%", "5.2%", "€1,945", "+0.2%", "外带平台订单增加"],
      ["其他支出", "7.1%", "7.5%", "7.0%", "7.3%", "6.6%", "€2,469", "-0.7%", "维修费用下降"],
      ["净利润", "20.0%", "18.1%", "18.7%", "20.6%", "23.9%", "€8,940", "+3.3%", "午餐套餐改善利润率"]
    ],
    "Dortmund Nord": [
      ["Netto 营业收入", "€30,120", "€29,860", "€30,540", "€30,940", "€31,680", "€31,680", "+2.4%", "Netto 收入小幅增长但成本压力较高"],
      ["食材原材料", "22.4%", "23.1%", "23.5%", "23.2%", "23.6%", "€7,476", "+0.4%", "采购结构偏重肉类和高价供应商"],
      ["饮料原材料", "7.9%", "8.1%", "8.4%", "8.7%", "9.0%", "€2,851", "+0.3%", "饮料库存周转偏慢"],
      ["人工", "33.1%", "33.8%", "34.5%", "34.0%", "34.2%", "€10,835", "+0.2%", "低峰排班过重"],
      ["房租", "12.2%", "12.4%", "12.1%", "11.9%", "11.7%", "€3,707", "-0.2%", "固定成本压力仍高"],
      ["水电网络", "10.6%", "11.0%", "11.4%", "11.7%", "12.2%", "€3,865", "+0.5%", "设备巡检逾期可能推高能耗"],
      ["平台与银行费用", "4.7%", "4.9%", "5.0%", "5.1%", "5.2%", "€1,647", "+0.1%", "外卖占比增加但转化一般"],
      ["其他支出", "8.0%", "8.4%", "8.1%", "8.0%", "8.6%", "€2,724", "+0.6%", "维修和清洁费用上升"],
      ["净利润", "17.1%", "15.2%", "14.9%", "16.2%", "18.5%", "€5,860", "+2.3%", "需优先复盘人工和采购结构"]
    ]
  };
  const moduleRows = moduleData[selectedStore] || moduleData["Martin Biergarten"];
  const storeRows = [
    ["Martin Biergarten 2", "€58,260", "€14,680", "25.2%", "26.8%", "19.7%", "4.6", "最佳门店", "继续放大周末套餐和团队订位"],
    ["Martin Biergarten", "€54,820", "€12,480", "22.8%", "28.7%", "21.4%", "4.3", "稳定盈利", "关注水电网络与饮料库存"],
    ["Martin Cafe", "€37,410", "€8,940", "23.9%", "31.4%", "18.9%", "4.1", "人工偏高", "压缩低峰时段排班"],
    ["Dortmund Nord", "€31,680", "€5,860", "18.5%", "34.2%", "23.6%", "3.9", "需关注", "复盘采购结构和差评关键词"]
  ];
  return `
    <div class="page-head">
      <div>
        <h1>详细数据分析</h1>
        <p>按月追踪经营模块占比，并横向对比各门店的收入、利润、成本和评分表现。</p>
      </div>
      <a class="ghost-btn" href="#business">返回经营总览</a>
    </div>
    <section class="card analysis-card" style="margin-top:16px">
      <div class="section-title">
        <div>
          <h2>各门店经营情况对比</h2>
          <p>点击门店后，下方会显示该门店的各模块每月占比情况。</p>
        </div>
        <button class="ghost-btn">导出对比表</button>
      </div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table store-compare-table">
          <thead><tr><th>选择门店</th><th>营业额</th><th>净利润</th><th>利润率</th><th>人工占比</th><th>食材占比</th><th>Google</th><th>状态</th><th>建议动作</th></tr></thead>
          <tbody>${storeRows.map(row=>`<tr>${row.map((cell, i)=>{
            const storeHref = `#business-详细数据分析?store=${encodeURIComponent(row[0])}`;
            const selectedClass = row[0] === selectedStore ? " selected-store-row" : "";
            if (i === 0) return `<td class="analysis-name${selectedClass}"><a href="${storeHref}">${cell}</a></td>`;
            if (i === 7) return `<td><span class="pill ${cell === "需关注" ? "red" : cell === "人工偏高" ? "orange" : "green"}">${cell}</span></td>`;
            return `<td><a class="store-row-link" href="${storeHref}">${cell}</a></td>`;
          }).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    <section class="card analysis-card" style="margin-top:16px">
      <div class="section-title">
        <div>
          <h2>${selectedStore} · 各模块每月占比情况</h2>
          <p>显示该门店最近五个月每个经营模块在 Netto 营业收入中的占比，以及本月金额和趋势。</p>
        </div>
        <span class="pill purple">Netto 基准</span>
      </div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table">
          <thead><tr><th>模块</th><th>1月</th><th>2月</th><th>3月</th><th>4月</th><th>5月</th><th>本月金额</th><th>环比</th><th>AI 判断</th></tr></thead>
          <tbody>${moduleRows.map(row=>`<tr>${row.map((cell, i)=>`<td${i === 0 ? ' class="analysis-name"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function businessRatingPromotionPage() {
  const ratingRows = [
    ["2025-01", "4.5", "38", "服务热情、啤酒花园", "稳定"],
    ["2025-02", "4.4", "42", "出餐速度、牛肉拉面", "轻微下降"],
    ["2025-03", "4.4", "35", "环境、价格", "稳定"],
    ["2025-04", "4.3", "49", "等待时间、服务态度", "需关注"],
    ["2025-05", "4.0", "61", "等待时间、排队、外卖延迟", "优先处理"]
  ];
  const keywordRows = [
    ["等待时间", "18 次", "+44%", "晚餐高峰", "优化排队提醒和出餐节奏"],
    ["服务态度", "11 次", "+22%", "新员工班次", "安排服务话术训练"],
    ["牛肉拉面", "16 次", "+19%", "正向菜品", "作为 Instagram 主推内容"],
    ["啤酒花园", "14 次", "+31%", "正向场景", "适合达人探店短视频"],
    ["外卖延迟", "7 次", "+40%", "平台履约", "调整平台备餐时间"]
  ];
  const promotionCards = [
    ["智能匹配网红", "Foodie Dortmund · 18k 粉丝", "匹配度 92%", "建议邀请周五晚餐探店，主推啤酒花园和牛肉拉面。", "查看达人"],
    ["Google 推广", "搜索词：Dortmund Restaurant", "预计 €18/天", "覆盖附近 3km 内搜索人群，重点拉回评分下降后的新客转化。", "生成广告"],
    ["Instagram 推广", "Reels + Story 套餐", "预计触达 12k", "用短视频展示后院氛围、午餐套餐和高评分菜品。", "创建素材"],
    ["本地合作推广", "Campus Blog / Ruhr Guide", "报价 €180 起", "适合学生午餐套餐和工作日低峰时段拉新。", "发起询价"]
  ];
  return `
    <div class="page-head">
      <div>
        <h1>评分及推广</h1>
        <p>汇总 Google 评分变化、评论关键词和推广机会，把口碑问题直接转成可执行的营销动作。</p>
      </div>
      <a class="ghost-btn" href="#business">返回经营总览</a>
    </div>
    <section class="grid grid-4">
      ${[["当前 Google 评分","4.0"],["本月新增评论","61 条"],["负面关键词","等待时间"],["推荐推广预算","€420 - €680"]].map((x,i)=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${["orange","blue","red","purple"][i]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="grid grid-2 rating-analysis-layout" style="margin-top:16px">
      <div class="card rating-trend-card">
        <div class="section-title">
          <div><h2>Google 评分变化</h2><p>最近 5 个月评分、评论数量和主要关键词。</p></div>
          <span class="pill orange">-0.3 本月</span>
        </div>
        <div class="rating-bars">
          ${ratingRows.map(row=>`<div class="rating-bar-row"><span>${row[0].replace("2025-", "")}月</span><div class="rating-bar-track"><b style="width:${Number(row[1]) / 5 * 100}%"></b></div><strong>${row[1]}</strong></div>`).join("")}
        </div>
        <div class="analysis-table-wrap">
          <table class="table rating-mini-table">
            <thead><tr><th>月份</th><th>评分</th><th>评论数</th><th>关键词</th><th>状态</th></tr></thead>
            <tbody>${ratingRows.map(row=>`<tr>${row.map((cell,i)=>`<td>${i === 4 ? `<span class="pill ${cell === "需关注" ? "red" : cell === "轻微下降" ? "orange" : "green"}">${cell}</span>` : cell}</td>`).join("")}</tr>`).join("")}</tbody>
          </table>
        </div>
      </div>
      <div class="card review-action-card">
        <div class="section-title">
          <div><h2>评论分析与回复</h2><p>自动识别高风险评论，并生成可直接发布的回复建议。</p></div>
          <button class="ghost-btn">生成回复</button>
        </div>
        <div class="review-quote">
          <strong>待回复差评</strong>
          <p>“周六晚上等位太久，点餐后又等了 40 分钟，服务员没有解释。”</p>
        </div>
        <div class="reply-draft">
          <strong>AI 回复建议</strong>
          <p>感谢您的反馈。周六晚高峰确实出现了排队和出餐延迟，我们已经调整排班并优化等位提醒。欢迎您下次再来，我们会为您安排更顺畅的用餐体验。</p>
        </div>
      </div>
    </section>
    <section class="card keyword-card" style="margin-top:16px">
      <div class="section-title">
        <div><h2>关键词与经营动作</h2><p>把评论关键词拆成问题、机会和对应动作。</p></div>
        <span class="pill blue">Google 评论</span>
      </div>
      <div class="keyword-grid">
        ${keywordRows.map(row=>`<div class="keyword-tile"><div><strong>${row[0]}</strong><span>${row[1]} · ${row[2]}</span></div><p>${row[3]}</p><button class="ghost-btn">${row[4]}</button></div>`).join("")}
      </div>
    </section>
    <section class="card promotion-workbench" style="margin-top:16px">
      <div class="section-title">
        <div><h2>推广界面</h2><p>根据评分、关键词和城市热度，自动组合适合本店的推广渠道。</p></div>
        <button class="primary-btn">生成推广计划</button>
      </div>
      <div class="promotion-grid">
        ${promotionCards.map(card=>`<article class="promotion-card"><span class="pill purple">${card[0]}</span><h3>${card[1]}</h3><strong>${card[2]}</strong><p>${card[3]}</p><button class="ghost-btn">${card[4]}</button></article>`).join("")}
      </div>
    </section>`;
}

function businessEmployeeAnalysisPage() {
  const selectedStore = state().params.get("store") || "Martin Biergarten";
  const storeRows = [
    ["Martin Biergarten 2", "€168/h", "94%", "1.8%", "93%", "26.8%", "最佳人效", "保持团队订位排班模板"],
    ["Martin Biergarten", "€142/h", "89%", "3.2%", "86%", "28.7%", "服务压力", "晚高峰增设迎宾和传菜岗"],
    ["Martin Cafe", "€118/h", "86%", "4.7%", "81%", "31.4%", "低峰偏重", "压缩周二午间兼职工时"],
    ["Dortmund Nord", "€96/h", "79%", "6.1%", "72%", "34.2%", "需关注", "复盘班表和病假替补机制"]
  ];
  const employeeData = {
    "Martin Biergarten 2": [
      ["Anna Keller", "店长", "€24/h", "168 h", "98%", "0 天", "96%", "带班稳定"],
      ["Tom Weber", "厨房", "€18/h", "154 h", "95%", "1 天", "92%", "晚高峰表现好"],
      ["Mia Schulz", "服务", "€15/h", "122 h", "93%", "0 天", "94%", "客评提及正向"],
      ["Leo Braun", "Minijob", "€13/h", "62 h", "90%", "0 天", "88%", "可增加周末班"]
    ],
    "Martin Biergarten": [
      ["Lisa Meyer", "服务主管", "€19/h", "156 h", "92%", "1 天", "89%", "需强化等位沟通"],
      ["Kevin Roth", "厨房", "€17/h", "148 h", "88%", "0 天", "84%", "出餐节奏需稳定"],
      ["Sofia Klein", "服务", "€15/h", "118 h", "86%", "2 天", "82%", "晚高峰迟到 2 次"],
      ["Nico Hart", "清洁", "€14/h", "74 h", "90%", "0 天", "78%", "闭店任务漏填"]
    ],
    "Martin Cafe": [
      ["Emma Vogel", "店长", "€20/h", "144 h", "91%", "1 天", "86%", "午餐套餐执行好"],
      ["Paul Fischer", "咖啡师", "€16/h", "136 h", "87%", "2 天", "83%", "早班替补不足"],
      ["Nina Wolf", "服务", "€14/h", "104 h", "84%", "1 天", "79%", "低峰工时偏多"],
      ["Jonas Beck", "Minijob", "€13/h", "58 h", "81%", "0 天", "76%", "任务确认不及时"]
    ],
    "Dortmund Nord": [
      ["Omar Hassan", "店长", "€21/h", "162 h", "83%", "2 天", "78%", "需加强班表复盘"],
      ["Elena Rossi", "厨房", "€17/h", "150 h", "80%", "3 天", "74%", "病假替补压力大"],
      ["Max Kruger", "服务", "€15/h", "126 h", "76%", "1 天", "70%", "迟到和任务逾期"],
      ["Aylin Demir", "清洁", "€14/h", "82 h", "77%", "0 天", "68%", "闭店检查完成低"]
    ]
  };
  const employeeRows = employeeData[selectedStore] || employeeData["Martin Biergarten"];
  return `
    <div class="page-head">
      <div><h1>员工分析</h1><p>分析人工成本、排班效率、出勤稳定性和门店服务表现，找到影响利润和评分的人员因素。</p></div>
      <a class="ghost-btn" href="#business">返回经营总览</a>
    </div>
    <section class="card analysis-card" style="margin-top:16px">
      <div class="section-title"><div><h2>各门店员工表现对比</h2><p>对比每个门店的人效、打卡准时率、病假率和任务准时完成率。</p></div><span class="pill orange">点击选择门店</span></div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table store-compare-table">
          <thead><tr><th>选择门店</th><th>人效</th><th>打卡准时率</th><th>病假率</th><th>任务准时完成率</th><th>人工占比</th><th>状态</th><th>建议动作</th></tr></thead>
          <tbody>${storeRows.map(row=>`<tr>${row.map((cell,i)=>{
            const href = `#business-员工分析?store=${encodeURIComponent(row[0])}`;
            const selectedClass = row[0] === selectedStore ? " selected-store-row" : "";
            if (i === 0) return `<td class="analysis-name${selectedClass}"><a href="${href}">${cell}</a></td>`;
            if (i === 6) return `<td><span class="pill ${cell === "需关注" ? "red" : cell === "低峰偏重" || cell === "服务压力" ? "orange" : "green"}">${cell}</span></td>`;
            return `<td><a class="store-row-link" href="${href}">${cell}</a></td>`;
          }).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    <section class="card analysis-card" style="margin-top:16px">
      <div class="section-title"><div><h2>${selectedStore} · 员工指标明细</h2><p>显示该门店各员工的岗位、时薪、工时、打卡准时率、病假和任务完成情况。</p></div><button class="ghost-btn">导出员工明细</button></div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table">
          <thead><tr><th>员工</th><th>岗位</th><th>时薪</th><th>本月工时</th><th>打卡准时率</th><th>病假</th><th>任务准时完成率</th><th>AI 判断</th></tr></thead>
          <tbody>${employeeRows.map(row=>`<tr>${row.map((cell,i)=>`<td${i === 0 ? ' class="analysis-name"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function businessStoreOperationAnalysisPage() {
  const selectedStore = state().params.get("store") || "Martin Biergarten";
  const operationRows = [
    ["Martin Biergarten", "82%", "7/9", "4.0", "96%", "外卖延迟", "优化备餐时间和高峰分流"],
    ["Martin Biergarten 2", "91%", "9/9", "4.6", "98%", "运营稳定", "复制团队订位流程"],
    ["Martin Cafe", "76%", "5/9", "4.1", "89%", "闭店检查漏填", "加强收尾任务提醒"],
    ["Dortmund Nord", "68%", "4/9", "3.9", "84%", "设备巡检逾期", "优先安排设备维修复查"]
  ];
  const detailRows = {
    "Martin Biergarten": [
      ["2025-05-04", "外卖平台", "晚餐高峰外卖延迟 18 分钟", "关键词：等待时间、外卖延迟", "已调整备餐时间"],
      ["2025-05-09", "Google 差评", "客人反馈等位久且无人解释", "关键词：等待、服务态度", "待店长回复"],
      ["2025-05-15", "门店任务", "冷柜温度记录晚填 1 次", "HACCP：冷链记录", "已补填并提醒"],
      ["2025-05-22", "设备巡检", "咖啡机清洁记录缺失", "关键词：设备保养", "本周复查"]
    ],
    "Martin Biergarten 2": [
      ["2025-05-03", "门店任务", "闭店检查全部准时完成", "关键词：流程稳定", "可复制给其他门店"],
      ["2025-05-10", "Google 好评", "团队订位服务被提及 6 次", "关键词：团队订位、服务", "用于推广素材"],
      ["2025-05-18", "HACCP", "9 项食品安全记录全部完成", "HACCP：温度、清洁、留样", "保持"],
      ["2025-05-26", "外卖平台", "准时率 98%，取消率低", "关键词：履约稳定", "保持当前备餐节奏"]
    ],
    "Martin Cafe": [
      ["2025-05-05", "门店任务", "闭店清洁检查漏填", "关键词：收尾、清洁", "加强收尾提醒"],
      ["2025-05-12", "Google 评论", "客人提到桌面清理慢", "关键词：清洁、服务", "安排低峰巡台"],
      ["2025-05-19", "HACCP", "冷藏温度记录缺 2 次", "HACCP：冷藏记录", "店长复核"],
      ["2025-05-24", "外卖平台", "早餐时段备餐慢", "关键词：早餐、等待", "调整早班准备"]
    ],
    "Dortmund Nord": [
      ["2025-05-02", "设备巡检", "洗碗机巡检逾期 3 天", "关键词：设备巡检、维修", "优先安排维修复查"],
      ["2025-05-08", "HACCP", "冷柜温度记录缺失", "HACCP：温度记录", "店长当天补查"],
      ["2025-05-16", "Google 差评", "客人反馈服务慢、菜品出错", "关键词：等待时间、出餐错误", "待回复并复盘班表"],
      ["2025-05-23", "门店任务", "闭店清洁任务逾期", "关键词：清洁、收尾", "安排闭店检查人"]
    ]
  }[selectedStore] || [];
  return `
    <div class="page-head">
      <div><h1>门店运营分析</h1><p>对比各门店任务、HACCP、外卖平台、设备巡检和评分表现，定位运营短板。</p></div>
      <a class="ghost-btn" href="#business">返回经营总览</a>
    </div>
    <section class="grid grid-4">
      ${[["平均任务完成率","79%"],["HACCP 合规","25/36"],["外卖准时率","92%"],["待处理运营项","8 个"]].map((x,i)=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${["blue","green","orange","red"][i]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="card analysis-card" style="margin-top:16px">
      <div class="section-title"><div><h2>各门店运营情况对比</h2><p>点击门店后，下方会显示该店未完成任务、差评、关键词和处理动作。</p></div><button class="ghost-btn">导出运营报告</button></div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table store-compare-table">
          <thead><tr><th>选择门店</th><th>任务完成率</th><th>HACCP</th><th>Google</th><th>外卖准时率</th><th>主要问题</th><th>建议动作</th></tr></thead>
          <tbody>${operationRows.map(row=>`<tr>${row.map((cell,i)=>{
            const href = `#business-门店运营分析?store=${encodeURIComponent(row[0])}`;
            const selectedClass = row[0] === selectedStore ? " selected-store-row" : "";
            if (i === 0) return `<td class="analysis-name${selectedClass}"><a href="${href}">${cell}</a></td>`;
            return `<td><a class="store-row-link" href="${href}">${cell}</a></td>`;
          }).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    <section class="card analysis-card" style="margin-top:16px">
      <div class="section-title"><div><h2>${selectedStore} · 运营细节</h2><p>显示具体日期、未完成任务、差评内容、关键词和处理动作。</p></div><button class="ghost-btn">导出明细</button></div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table store-compare-table">
          <thead><tr><th>日期</th><th>类型</th><th>具体情况</th><th>关键词 / 关联项</th><th>处理动作</th></tr></thead>
          <tbody>${detailRows.map(row=>`<tr>${row.map((cell,i)=>`<td${i === 2 ? ' class="analysis-name"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function businessDetailPage(child) {
  if (child === "经营总览") return businessPage();
  if (child === "财务异常分析") return businessPage();
  const pages = {
    "月度报告": businessMonthlyReportPage,
    "详细数据分析": businessCostStructureAnalysisPage,
    "员工分析": businessEmployeeAnalysisPage,
    "门店运营分析": businessStoreOperationAnalysisPage,
    "评分及推广": businessRatingPromotionPage,
    "成本与利润": businessCostProfitPage,
    "商品分析": businessProductAnalysisPage,
    "全部菜品": businessAllProductsPage,
    "单品利润排名": businessProductProfitRankingPage,
    "门店分析": businessStoreAnalysisPage,
    "Google 评论分析": businessGoogleAnalysisPage,
    "行业资讯": businessIndustryNewsPage,
    "营销推广": businessMarketingPage,
    "AI 经营秘书": businessAiSecretaryPage,
    "数据报告中心": businessReportCenterPage
  };
  return (pages[child] || (() => placeholderPage("经营助手", child)))();
}

function businessMonthlyReportPage() {
  return `
    <div class="page-head"><div><h1>月度报告</h1><p>自动生成月度经营摘要，包含利润、人工、采购、成本、库存、账单、门店任务和评论情况。</p></div><button class="primary-btn">生成完整月报 PDF</button></div>
    <section class="grid grid-4">${[["报告月份","2025年5月"],["上月营业额","€54,820"],["上月利润","€12,480"],["关键健康度","82/100"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value">${x[1]}</div></div>`).join("")}</section>
    <section class="grid grid-2" style="margin-top:16px">
      <div class="card monthly-pie-card">
        <div class="section-title"><h2>本月经营统计</h2><span class="pill purple">点击分类查看账单</span></div>
        <div class="monthly-pie-layout">
          <div class="monthly-donut" aria-label="本月经营占比扇形图">
            <div class="donut-center"><strong>€54,820</strong><span>本月营业额</span></div>
          </div>
          <div class="monthly-pie-legend">
            ${[
              ["采购账单", "42 张", "€16,730", "30.5%", "purple", "Metro Rechnung.pdf · CHEFS CULINAR Rechnung.pdf"],
              ["人工工资", "28 人", "€15,732", "28.7%", "blue", "5 月工资资料 · Minijob 工时汇总"],
              ["门店收入", "31 条日结", "€18,940", "34.5%", "green", "Z-Bon 2025-05 · 外卖平台账单"],
              ["损耗库存", "12 条记录", "€1,240", "2.3%", "orange", "损耗记录 · 库存调整单"],
              ["账单异常", "4 条说明", "€2,178", "4.0%", "red", "JFC 差异单 · Metro 重复账单"]
            ].map(x=>`
              <details class="bill-drilldown" ${x[0] === "采购账单" ? "open" : ""}>
                <summary><span class="legend-dot ${x[4]}"></span><strong>${x[0]}</strong><span>${x[1]} · ${x[2]}</span><b>${x[3]}</b></summary>
                <div class="bill-chip-list">${x[5].split(" · ").map(item=>`<a class="bill-chip" href="#finance-账单管理">${item}</a>`).join("")}</div>
              </details>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="card"><h2>报告包含模块</h2>${["利润与人工","采购与供应商","库存与损耗","账单异常","门店任务","Google 评论"].map(x=>`<div class="status-line">${x}<span class="pill green">已生成</span></div>`).join("")}</div>
    </section>`;
}

function businessCostProfitPage() {
  const rows = [["人工成本", "€15,732", "28.7%", "高于目标 3.7%", "优化排班"],["采购成本", "€16,730", "30.5%", "Metro 上涨 9%", "谈判价格"],["房租固定成本", "€5,400", "9.8%", "稳定", "保持"],["外卖平台费用", "€2,180", "4.0%", "略高", "调整平台活动"]];
  return businessTablePage("成本与利润", "分析成本变化、采购成本、供应商价格变化、品类占比、利润率和异常成本。", [["上月利润","€12,480"],["利润率","22.8%"],["人工占比","28.7%"],["采购成本","€16,730"]], ["成本项","金额","占比","异常说明","建议","操作"], rows, "生成利润分析");
}

function businessProductAnalysisPage() {
  const productRows = [
    ["牛肉拉面", "€14.90", "€4.86", "67.4%", "€3,860", "€2.12", "牛肉 120g · 面 180g · 高汤 350ml", "推荐加大推广"],
    ["啤酒花园拼盘", "€24.50", "€8.92", "63.6%", "€3,240", "€3.40", "香肠 160g · 薯条 180g · 沙拉 80g", "适合达人短视频"],
    ["水牛芝士披萨", "€16.90", "€6.46", "61.8%", "€2,180", "€2.05", "面团 220g · 芝士 90g · 番茄酱 60g", "新品可继续测试"],
    ["鸡胸肉沙拉", "€13.80", "€5.74", "58.4%", "€1,460", "€1.18", "鸡胸肉 150g · 生菜 120g · 酱汁 35g", "损耗偏高，复盘备料"]
  ];
  const materialRows = [
    ["牛肉", "Metro", "€18.60/kg", "120g", "€2.23"],
    ["拉面", "JFC", "€4.20/kg", "180g", "€0.76"],
    ["高汤底", "自制", "€2.40/L", "350ml", "€0.84"],
    ["青葱 / 配菜", "本地供应商", "€6.80/kg", "35g", "€0.24"],
    ["包装 / 调料", "混合", "按份估算", "1 份", "€0.79"]
  ];
  return `
    <div class="page-head">
      <div><h1>商品分析</h1><p>分析商品销量、配方物料成本、损耗和毛利率，帮助判断哪些菜品值得推广或调整。</p></div>
      <div class="button-row"><a class="ghost-btn" href="#business">返回经营总览</a><a class="primary-btn" href="#business-全部菜品">查看全部菜品</a></div>
    </div>
    <section class="grid grid-4">
      ${[["已建商品关系","18 个"],["平均毛利率","62.8%"],["待识别配方","3 份"],["物料成本异常","2 项"]].map((x,i)=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${["blue","green","orange","red"][i]})">${x[1]}</div></div>`).join("")}
    </section>
    <section class="card analysis-card" style="margin-top:16px">
      <div class="section-title">
        <div><h2>商品毛利分析</h2><p>按上月利润金额排序，同时显示售价、物料成本、毛利率和损耗。</p></div>
        <a class="ghost-btn" href="#business-单品利润排名">显示全部</a>
      </div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table store-compare-table">
          <thead><tr><th>商品</th><th>售价</th><th>物料成本</th><th>毛利率</th><th>上月利润</th><th>损耗成本</th><th>主要原材料</th><th>AI 建议</th></tr></thead>
          <tbody>${productRows.map(row=>`<tr>${row.map((cell,i)=>`<td${i === 0 ? ' class="analysis-name"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
    <section class="card recipe-recognition-card" style="margin-top:16px">
      <div class="section-title"><div><h2>配方识别与成本确认</h2><p>左侧上传配方文件，右侧查看识别出的商品、原材料用量和毛利率，确认后写入商品关系。</p></div><span class="pill purple">AI 识别</span></div>
      <div class="recipe-recognition-layout">
        <div class="recipe-upload-zone">
          <strong>上传配方文件</strong>
          <span>支持菜单配方、厨房 SOP、PDF、图片、Excel 成本表和供应商规格单</span>
          <button class="primary-btn">选择文件并识别</button>
        </div>
        <div class="recipe-result-panel">
          <div class="section-title compact-title"><div><h2>识别结果预览</h2><p>牛肉拉面 · 已匹配 5 个原材料</p></div><button class="ghost-btn">调整匹配</button></div>
          <div class="analysis-table-wrap">
            <table class="table material-cost-table">
              <thead><tr><th>原材料</th><th>供应商</th><th>单价</th><th>用量</th><th>成本</th></tr></thead>
              <tbody>${materialRows.map(row=>`<tr>${row.map((cell,i)=>`<td${i === 0 ? ' class="analysis-name"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
            </table>
          </div>
          <div class="material-summary"><span>单份物料成本</span><strong>€4.86</strong><span>售价 €14.90</span><strong class="profit">毛利率 67.4%</strong></div>
          <div class="recipe-confirm-row"><button class="ghost-btn">保存草稿</button><button class="primary-btn">确认并写入商品关系</button></div>
        </div>
      </div>
    </section>`;
}

function businessAllProductsPage() {
  const products = [
    ["牛肉拉面", "€14.90", "€4.86", "67.4%", "牛肉 120g · 面 180g · 高汤 350ml", "已确认"],
    ["啤酒花园拼盘", "€24.50", "€8.92", "63.6%", "香肠 160g · 薯条 180g · 沙拉 80g", "已确认"],
    ["鸡胸肉沙拉", "€13.80", "€5.74", "58.4%", "鸡胸肉 150g · 生菜 120g · 酱汁 35g", "待复核"],
    ["水牛芝士披萨", "€16.90", "€6.46", "61.8%", "面团 220g · 芝士 90g · 番茄酱 60g", "待复核"],
    ["午餐套餐", "€11.90", "€3.98", "66.6%", "米饭 180g · 鸡肉 110g · 蔬菜 90g", "已确认"]
  ];
  return `
    <div class="page-head">
      <div><h1>全部菜品</h1><p>查看并修改所有菜品的售价、物料成本、配方关系和毛利率。</p></div>
      <a class="ghost-btn" href="#business-商品分析">返回商品分析</a>
    </div>
    <section class="card analysis-card">
      <div class="section-title"><div><h2>菜品配方与毛利率</h2><p>可直接修改售价、成本和原材料关系，保存后用于商品毛利计算。</p></div><button class="primary-btn">保存全部修改</button></div>
      <div class="analysis-table-wrap">
        <table class="table editable-product-table">
          <thead><tr><th>菜品</th><th>售价</th><th>物料成本</th><th>毛利率</th><th>原材料关系</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${products.map(row=>`<tr>
            <td><input value="${row[0]}"></td>
            <td><input value="${row[1]}"></td>
            <td><input value="${row[2]}"></td>
            <td><input value="${row[3]}"></td>
            <td><textarea>${row[4]}</textarea></td>
            <td><span class="pill ${row[5] === "已确认" ? "green" : "orange"}">${row[5]}</span></td>
            <td><button class="ghost-btn">保存</button></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function businessProductProfitRankingPage() {
  const month = state().params.get("month") || "2025-05";
  const rankingRows = [
    ["1", "牛肉拉面", "€3,860", "426", "€14.90", "€4.86", "67.4%", "€2.12", "销量 +32%，适合继续推广"],
    ["2", "啤酒花园拼盘", "€3,240", "208", "€24.50", "€8.92", "63.6%", "€3.40", "客单价高，适合周末套餐"],
    ["3", "水牛芝士披萨", "€2,180", "139", "€16.90", "€6.46", "61.8%", "€2.05", "新品表现稳定，可继续测试"],
    ["4", "午餐套餐", "€1,920", "286", "€11.90", "€3.98", "66.6%", "€1.42", "低峰拉新效果好"],
    ["5", "鸡胸肉沙拉", "€1,460", "181", "€13.80", "€5.74", "58.4%", "€1.18", "损耗偏高，复盘备料"],
    ["6", "素食意面", "€980", "96", "€12.90", "€4.12", "68.1%", "€0.72", "毛利好但销量低"]
  ];
  return `
    <div class="page-head">
      <div><h1>单品利润排名</h1><p>选择月份后，按该月各单品利润金额排序，查看销量、售价、成本、损耗和经营建议。</p></div>
      <a class="ghost-btn" href="#business-商品分析">返回商品分析</a>
    </div>
    <section class="card analysis-card">
      <div class="section-title">
        <div><h2>${month} 单品利润排行</h2><p>默认按利润金额从高到低排序。</p></div>
        <div class="month-switcher">
          <a class="${month === "2025-03" ? "active" : ""}" href="#business-单品利润排名?month=2025-03">3月</a>
          <a class="${month === "2025-04" ? "active" : ""}" href="#business-单品利润排名?month=2025-04">4月</a>
          <a class="${month === "2025-05" ? "active" : ""}" href="#business-单品利润排名?month=2025-05">5月</a>
        </div>
      </div>
      <div class="analysis-table-wrap">
        <table class="table analysis-table product-profit-table">
          <thead><tr><th>排名</th><th>单品</th><th>利润金额</th><th>销量</th><th>售价</th><th>物料成本</th><th>毛利率</th><th>损耗成本</th><th>重要信息</th></tr></thead>
          <tbody>${rankingRows.map(row=>`<tr>${row.map((cell,i)=>`<td${i === 1 || i === 2 ? ' class="analysis-name"' : ""}>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>`;
}

function businessStoreAnalysisPage() {
  const rows = [["Martin Biergarten 2", "€18,900", "91%", "4.5", "8/9", "表现最好"],["Martin Biergarten", "€17,420", "82%", "4.3", "7/9", "稳定"],["Martin Cafe", "€12,840", "76%", "4.1", "5/9", "需关注任务完成率"]];
  return businessTablePage("门店分析", "分析单店和多门店营业额、采购结构、成本结构、任务完成、评论和经营表现。", [["门店数量","3家"],["最佳门店","Biergarten 2"],["待关注门店","Martin Cafe"],["平均评分","4.3"]], ["门店","上月营业额","HACCP","Google评分","员工出勤","AI 判断","操作"], rows, "导出门店对比");
}

function businessGoogleAnalysisPage() {
  const rows = [["本周评分", "4.3", "-0.3", "服务等待时间", "需要回复"],["新增评价", "12条", "+4", "食物味道", "正常"],["差评", "1条", "+1", "高峰等待", "优先处理"],["竞争对手评论数", "+18条", "高于本店", "活动推广", "观察"]];
  return businessTablePage("Google 评论分析", "分析 Google 评论评分变化、评论数量变化、关键词、服务问题、食物问题和竞争对手评论变化。", [["本周评分","4.3"],["新增评价","12条"],["差评","1条"],["竞争变化","+18条"]], ["指标","当前值","变化","关键词","处理建议","操作"], rows, "生成回复建议");
}

function businessIndustryNewsPage() {
  const news = ["德国餐饮业 2025 Q1 财报分析报告","REWE 集团 2025 Q1 财报：餐饮渠道增长 6.2%","Dortmund 区域菜单价格对比分析","Dortmund 主要竞争对手 Google 评论数变化","2025 年食品安全法规更新重点","Instagram 本地餐饮话题热度变化"];
  return `
    <div class="page-head"><div><h1>行业资讯</h1><p>展示餐饮、食品、供应链、法规、市场、竞争对手和公开渠道相关资讯。</p></div><button class="primary-btn">订阅行业报告</button></div>
    <section class="card"><div class="section-title"><h2>资讯流</h2><span class="pill purple">横向滑动</span></div><div class="h-scroll">${news.map(x=>`<article class="news-card"><span class="pill purple" style="align-self:flex-start">行业资讯</span><h3>${x}</h3><p>来自公开渠道与匿名汇总趋势，Kai 已提炼可行动建议。</p><a class="ghost-btn" style="margin-top:12px">查看详情</a></article>`).join("")}</div></section>`;
}

function businessMarketingPage() {
  const rows = [["Foodie Dortmund", "Instagram", "18k followers", "€250-350", "适合拉面新品"],["Ruhr Food Guide", "TikTok", "42k followers", "€450", "适合开业活动"],["Local Gastro Agentur", "Agentur", "本地餐饮推广", "按项目", "可做 Google Ads"],["Dortmund Campus Blog", "社区媒体", "学生群体", "€180", "适合午餐套餐"]];
  return businessTablePage("营销推广", "链接对应城市的本地网红和 Agentur，展示联系方式，帮助店主直接发起推广和询价。", [["推荐合作方","4个"],["预计预算","€450"],["适合活动","午餐套餐"],["可询价","3个"]], ["合作方","渠道","影响力","预算","AI 建议","操作"], rows, "发起推广询价");
}

function businessAiSecretaryPage() {
  return `
    <div class="page-head"><div><h1>AI 经营秘书</h1><p>用户可直接问成本、账单、商品涨价、门店表现和推广建议，系统从四大模块查找答案。</p></div><button class="primary-btn">开始提问</button></div>
    <section class="grid grid-2"><div class="card"><h2>常见问题</h2>${["为什么成本变高？","哪张账单异常？","哪些商品涨价最多？","饮料供应商占比为什么突然升高？","哪家店表现最差？","应该推什么新品？"].map(x=>`<div class="status-line">${x}<button class="ghost-btn">提问</button></div>`).join("")}</div><div class="card tax-chat"><div class="section-title"><h2>Kai 分析示例</h2><span class="pill green">在线</span></div><div class="chat-line advisor"><strong>Martin</strong><p>饮料供应商占比为什么突然升高？</p></div><div class="chat-line user"><strong>Kai</strong><p>可能原因：Leergut 未退、活动备货、新品采购增加或账单重复。我已标记 2 张需要复核的饮料账单。</p></div></div></section>`;
}

function businessReportCenterPage() {
  const rows = [["月度经营报告", "PDF", "2025-05", "已生成", "老板 / 税务师"],["门店对比报告", "Excel", "上月", "可生成", "管理层"],["采购分析报告", "Excel", "上月", "可生成", "采购负责人"],["Google 评论分析", "PDF", "本周", "已生成", "店长"],["匿名行业报告", "PDF", "季度", "订阅中", "老板"]];
  return businessTablePage("数据报告中心", "生成 PDF / Excel 报告，包括月报、门店对比、采购分析、供应商分析、评论分析和匿名行业报告。", [["可生成报告","5类"],["PDF","3份"],["Excel","2份"],["订阅报告","1份"]], ["报告名称","格式","范围","状态","接收人","操作"], rows, "新建报告");
}

function businessTablePage(title, subtitle, stats, headers, rows, actionLabel) {
  const filters = `<div class="business-filter-inline">${field("时间范围", "上个月 / 本月 / 自定义")}${field("门店", "Martin Biergarten / 全部门店")}${field("数据来源", "财务 / 仓库 / 门店 / Google")}${field("报告格式", "PDF / Excel")}<button class="ghost-btn">应用筛选</button></div>`;
  return `
    <div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><button class="primary-btn">${actionLabel}</button></div>
    <section class="grid grid-4">${stats.map((x,i)=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${["blue","green","orange","red"][i]})">${x[1]}</div></div>`).join("")}</section>
    <section class="card business-detail-card" style="margin-top:16px"><div class="section-title"><h2>${title}明细</h2><span class="pill blue">Demo 数据</span></div>${filters}<table class="table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}<td><button class="ghost-btn">查看</button></td></tr>`).join("")}</tbody></table></section>`;
}

function adminPage() {
  const de = currentLanguage() === "de";
  const cards = de ? [
    { id: "企业资料管理", title: "Unternehmensdaten", desc: "Firmenname, Steuernummer, Adresse, Bankkonto, Ansprechpartner, Gewerbeanmeldung, Steuernummer und USt-ID.", icon: "▦" },
    { id: "文件填写与备档", title: "Dokumente ausfüllen & archivieren", desc: "Formulare hochladen, mit KI ausfüllen, herunterladen und automatisch im Unternehmensarchiv ablegen.", icon: "▤" },
    { id: "门店管理", title: "Filialverwaltung", desc: "Neue Filialen, Menü-Uploads, Filialwechsel, Adresse, Öffnungszeiten, Google-Profil, Lieferplattformen und Filialleitung.", icon: "店" },
    { id: "员工与权限管理", title: "Mitarbeiter und Rechte", desc: "Mitarbeiterkonten, Rollen, Rechte für Filialleitung, Finanzen, Einkauf und Betrieb, Freigaben und Deaktivierung beim Austritt.", icon: "员" },
    { id: "系统连接", title: "Systemverbindungen", desc: "DATEV, Bank, POS-Kassensysteme und Lieferplattformen zentral verbinden.", icon: "∞" },
    { id: "审批流程设置", title: "Freigabeprozesse", desc: "Bestellfreigaben, Rechnungsfreigaben, Urlaubsfreigaben, HACCP-Erinnerungen und Betragsgrenzen für Ausnahmen.", icon: "☑" },
    { id: "通知与提醒设置", title: "Benachrichtigungen", desc: "Warnungen für Lagerbestand, Rechnungsabweichungen, Google-Bewertungen, Zeiterfassung und fehlende HACCP-Einträge.", icon: "●" },
    { id: "通讯信息", title: "Kontaktdaten", desc: "Elektriker, Installateure, Wartungskontakte, Sponsoren und Dienstleister aus dem Eröffnungsassistenten synchronisieren oder selbst hinzufügen.", icon: "☎" },
    { id: "品牌与门店展示", title: "Marke und Filialauftritt", desc: "Logo, Hintergrundbilder, Unternehmensfarben und Darstellung auf der Startseite verwalten.", icon: "▣" },
    { id: "套餐与账单", title: "Pakete und Abrechnung", desc: "KaiSpan-Abonnement, Zahlungsprotokoll und Rechnungsdownload verwalten.", icon: "♛" }
  ] : [
    { id: "企业资料管理", title: "企业资料管理", desc: "公司名称、税号、地址、银行账户、联系人、营业执照 / Steuernummer、USt-ID。", icon: "▦" },
    { id: "文件填写与备档", title: "文件填写与备档", desc: "上传需要填写的表格，AI 调用企业资料自动填写，支持下载、自动备档和历史查询。", icon: "▤" },
    { id: "门店管理", title: "门店管理", desc: "新增门店、菜单上传、切换门店、门店地址、营业时间、Google 店铺链接、外卖平台账号、店长绑定。", icon: "店" },
    { id: "员工与权限管理", title: "员工与权限管理", desc: "员工账号、角色权限、店长 / 财务 / 采购 / 运营权限、审批权限、离职禁用账号。", icon: "员" },
    { id: "系统连接", title: "系统连接", desc: "DATEV / 银行 / POS 收银系统 / 外卖平台。", icon: "∞" },
    { id: "审批流程设置", title: "审批流程设置", desc: "订货审批、账单审批、请假审批、HACCP 提醒、异常金额阈值。", icon: "☑" },
    { id: "通知与提醒设置", title: "通知与提醒设置", desc: "库存预警、账单异常、Google 差评、员工考勤、HACCP 未填写。", icon: "●" },
    { id: "通讯信息", title: "通讯信息", desc: "同步开店向导里的电工、水工、维修联系人、赞助商和服务商联系方式，也可自行添加。", icon: "☎" },
    { id: "品牌与门店展示", title: "品牌与门店展示", desc: "Logo、店铺背景图、企业颜色、首页展示风格。", icon: "▣" },
    { id: "套餐与账单", title: "套餐与账单", desc: "KaiSpan 订阅套餐、付款记录、发票下载。", icon: "♛" }
  ];
  const suffix = appMode(state().route) === "opening" ? "?mode=opening" : "";
  const title = de ? "Unternehmensverwaltung" : "企业管理中心";
  const subtitle = de
    ? "Zentrale Unternehmenseinstellungen. Verwalten Sie Unternehmensdaten, Filialen, Mitarbeiterrechte, Systemverbindungen, Freigabeprozesse, Benachrichtigungen, Kontakte, Markenauftritt, Pakete und Abrechnung."
    : "公司级设置中心。管理企业资料、门店、员工权限、系统连接、审批流程、通知提醒、通讯信息、品牌展示、套餐账单，以便系统自动调用，一键发送邮件或传送讯息。";
  const linkText = de ? "Einstellungen öffnen →" : "进入设置 →";
  return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div></div><section class="grid grid-3">${cards.map((c,i)=>`<a class="card module-card" href="#${slug("admin", c.id)}${suffix}" style="text-decoration:none;color:inherit"><div class="iconbox ${["purple","blue","green","orange"][i%4]}">${c.icon}</div><h2>${c.title}</h2><p>${c.desc}</p><span class="link-btn">${linkText}</span></a>`).join("")}</section>`;
}

function adminDetailPage(name) {
  const suffix = appMode(state().route) === "opening" ? "?mode=opening" : "";
  const pages = {
    "企业资料管理": ["企业资料库", "集中保存公司、个人负责人、商业注册、税务编号、Betriebsnummer 和银行文件。", `
      <section class="grid grid-4">
        ${[["资料完整度","72%","blue"],["待补资料","5项","orange"],["已上传文件","8份","green"],["需要确认","2项","red"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
      </section>
      <section class="grid grid-2" style="margin-top:14px">
        <div class="card"><div class="section-title"><h2>公司主体资料</h2><span class="pill green">已建立</span></div><div class="form-grid">${field("公司 / 店铺法人名称", "Martin Biergarten GmbH")}${field("法律形式", "GmbH / UG / KG / GbR / Einzelunternehmen")}${field("注册地址", "街道、门牌号、邮编、城市")}${field("营业地址", "如与注册地址不同，请填写")}${field("商业注册号 / HRB", "如有请填写")}${field("Gewerbeanmeldung 日期", "YYYY-MM-DD")}</div><div class="grid grid-2" style="margin-top:14px"><div class="upload">上传商业注册 / Gewerbeanmeldung</div><div class="upload">上传 Handelsregister 文件</div></div></div>
        <div class="card"><div class="section-title"><h2>个人负责人资料</h2><span class="pill orange">待补充</span></div><div class="form-grid">${field("负责人姓名", "Martin")}${field("出生日期", "YYYY-MM-DD")}${field("联系电话", "+49 ...")}${field("电子邮箱", "martin@example.com")}${field("身份证 / 护照号", "仅作资料库占位")}${field("居住地址", "私人地址")}</div><div class="grid grid-3" style="margin-top:14px"><div class="upload">上传身份证明</div><div class="upload">上传 Vollmacht</div><div class="upload">上传授权文件</div></div></div>
      </section>
      <section class="grid grid-2" style="margin-top:14px">
        <div class="card"><div class="section-title"><h2>税务编号资料</h2><span class="pill blue">税务师可用</span></div><div class="form-grid">${field("Steuernummer", "请输入税号")}${field("USt-ID / VAT", "DE...")}${field("Finanzamt", "Dortmund Finanzamt")}${field("税务师联系人", "Steuerberater Name")}${field("授权状态", "未授权 / 已授权")}${field("申报频率", "月度 / 季度 / 年度")}</div><div class="upload" style="margin-top:14px">上传 Steuernummer 通知 / USt-ID 文件 / Steuerberater Vollmacht</div></div>
        <div class="card"><div class="section-title"><h2>Betriebsnummer / BGN</h2><span class="pill orange">待跟进</span></div><div class="form-grid">${field("Betriebsnummer", "请输入 Betriebsnummer")}${field("BGN Unternehmensnummer", "请输入 BGN 编号")}${field("BGN PIN", "上传或填写 PIN")}${field("注册状态", "未开始 / 已提交 / 已完成")}${field("员工登记状态", "待处理")}${field("负责人员", "Martin / 财务")}</div><div class="upload" style="margin-top:14px">上传 BGN 注册资料 / Betriebsnummer 通知 / PIN 信件</div></div>
      </section>
      <section class="grid grid-2" style="margin-top:14px">
        <div class="card"><h2>银行与账单资料</h2><div class="form-grid">${field("银行账户 IBAN", "DE...")}${field("BIC", "请输入 BIC")}${field("开户银行", "Sparkasse / Deutsche Bank")}${field("账单邮箱", "invoice@example.com")}${field("付款联系人", "Martin")}${field("SEPA 授权状态", "未上传 / 已上传")}</div><div class="upload" style="margin-top:14px">上传银行证明 / SEPA 授权 / 付款协议</div></div>
        <a class="card file-fill-entry-card" href="#${slug("admin", "文件填写与备档")}">
          <div class="section-title"><div><h2>文件填写与备档</h2><p>上传需要填写的表格，AI 自动调用企业资料并生成可下载文件。</p></div><span class="pill purple">AI 填写</span></div>
          <div class="file-fill-flow">
            <span>上传表格</span>
            <span>调用资料</span>
            <span>生成文件</span>
            <span>自动备档</span>
          </div>
          <div class="file-fill-history-preview">
            ${["Gewerbeanmeldung 补充表 · 已备档","SEPA 授权表 · 可下载","税务师 Vollmacht · 待确认"].map((x,i)=>`<div><strong>${x}</strong><span class="pill ${i===2?"orange":"green"}">${i===2?"待确认":"完成"}</span></div>`).join("")}
          </div>
          <span class="primary-btn">进入填写工作台 →</span>
        </a>
      </section>`],
    "文件填写与备档": ["文件填写与备档", "上传各种需要填写的表格，AI 调用企业资料、税务资料、银行资料和负责人文件完成填写，并自动归档。", `
      <section class="grid grid-4">
        ${[["待填写表格","4份","orange"],["AI 已完成","12份","green"],["自动备档","18份","blue"],["需要确认","2份","red"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
      </section>
      <section class="card file-fill-workspace" style="margin-top:14px">
        <div class="file-fill-panel">
          <div class="section-title"><div><h2>上传待填写表格</h2><p>支持 PDF、图片、Word 和 Excel 表格。</p></div><span class="pill purple">AI 识别</span></div>
          <div class="upload file-form-upload"><strong>上传表格文件</strong><span>例如 Gewerbeanmeldung、SEPA 授权、税务师 Vollmacht、BGN 表格</span><button class="primary-btn">选择文件并识别</button></div>
          <div class="file-fill-steps">
            <span>1. 识别字段</span>
            <span>2. 匹配资料</span>
            <span>3. 自动填写</span>
            <span>4. 下载并备档</span>
          </div>
        </div>
        <div class="file-fill-panel">
          <div class="section-title"><div><h2>需要调用的资料</h2><p>AI 会先列出来源，确认后再填表。</p></div><button class="ghost-btn">查看来源</button></div>
          ${[
            ["公司主体资料", "Martin Biergarten GmbH · HRB / 地址 / 法律形式", "已匹配"],
            ["负责人资料", "Martin · 联系方式 · 身份证明", "需确认"],
            ["税务编号资料", "Steuernummer · USt-ID · Finanzamt", "已匹配"],
            ["银行资料", "IBAN · BIC · SEPA 状态", "已匹配"]
          ].map((x,i)=>`<div class="status-line file-source-line"><div><strong>${x[0]}</strong><p>${x[1]}</p></div><span class="pill ${i===1?"orange":"green"}">${x[2]}</span></div>`).join("")}
        </div>
        <div class="file-fill-panel">
          <div class="section-title"><div><h2>填写完成的表格</h2><p>可下载、发送，也可自动归档到资料库。</p></div><span class="pill green">已生成</span></div>
          <div class="filled-file-preview">
            <strong>SEPA_Mandat_Martin_Biergarten.pdf</strong>
            <p>已填入公司名、IBAN、BIC、负责人和日期。等待老板确认签名。</p>
            <div class="button-row"><button class="ghost-btn">预览</button><button class="ghost-btn">下载</button></div>
          </div>
        </div>
      </section>
      <section class="card" style="margin-top:14px">
        <div class="section-title"><div><h2>历史填写文件</h2><p>查看所有 AI 填写过的文件、调用资料、下载记录和备档位置。</p></div><button class="ghost-btn">查看全部历史</button></div>
        <table class="table">
          <thead><tr><th>文件</th><th>类型</th><th>调用资料</th><th>备档位置</th><th>操作</th></tr></thead>
          <tbody>
            ${[
              ["Gewerbeanmeldung Ergänzung.pdf", "商业注册", "公司主体 / 负责人 / 地址", "已备档", "企业资料库 / 商业注册"],
              ["SEPA Mandat.pdf", "银行授权", "银行资料 / 公司主体", "已生成", "银行与账单资料"],
              ["BGN Anmeldung.pdf", "BGN", "Betriebsnummer / 负责人", "需确认", "Betriebsnummer / BGN"],
              ["Steuerberater Vollmacht.pdf", "税务师授权", "税务编号 / 负责人", "待补资料", "税务编号资料"]
            ].map(x=>`<tr><td><strong>${x[0]}</strong></td><td>${x[1]}</td><td>${x[2]}</td><td>${x[4]}</td><td><button class="ghost-btn">详情</button></td></tr>`).join("")}
          </tbody>
        </table>
      </section>`],
    "门店管理": ["门店管理", "新增门店、维护地址、营业时间、菜单、Google 店铺和外卖平台账号。", `
      <section class="grid grid-2">
        <div class="card"><h2>门店资料</h2><div class="form-grid">${field("门店名称", "Martin Biergarten")}${field("门店地址", "Dortmund ...")}${field("营业时间", "11:30-22:00")}${field("店长", "Martin / Lisa")}${field("Google 店铺链接", "https://...")}${field("外卖平台账号", "Lieferando / Uber Eats / Wolt")}</div></div>
        <div class="card"><h2>菜单与门店文件</h2><div class="upload">上传菜单 PDF / 图片 / Excel</div><div class="upload" style="margin-top:12px">上传门店照片 / 背景图</div><div class="button-row"><button class="ghost-btn">新增门店</button><button class="primary-btn">保存门店信息</button></div></div>
      </section><div class="card" style="margin-top:14px"><h2>门店列表</h2>${stores.map(s=>`<div class="status-line"><strong>${s}</strong><span class="pill green">已启用</span></div>`).join("")}</div>`],
    "员工与权限管理": ["员工与权限管理", "管理员工账号、普通员工功能、管理者细分权限、审批权限和离职禁用。", `
      <section class="card employee-permission-card">
        <div class="section-title"><div><h2>员工列表</h2><p>点击“编辑权限”后，在下方先选择岗位，再基于岗位默认权限细调。</p></div><span class="pill blue">${employees.length} 人</span></div>
        <table class="table"><thead><tr><th>员工</th><th>岗位</th><th>账号类型</th><th>权限摘要</th><th>状态</th><th>操作</th></tr></thead><tbody>${employees.map((e,i)=>`<tr><td>${e}</td><td>${["老板","厨师","服务员","服务员","洗碗工"][i]}</td><td><span class="pill ${i===0?"purple":"blue"}">${i===0?"管理者":"普通员工"}</span></td><td>${i===0?"全部管理权限":"打卡 / mailbox / 报班"}</td><td><span class="pill ${i===4?"orange":"green"}">${i===4?"待完善":"正常"}</span></td><td><a class="ghost-btn" href="#admin-员工与权限管理?edit=${encodeURIComponent(e)}">编辑权限</a></td></tr>`).join("")}</tbody></table>
      </section>
      <section class="card employee-permission-card" style="margin-top:14px">
        <div class="section-title"><div><h2>权限编辑</h2><p>当前编辑：${state().params.get("edit") || "Martin"}。先选择岗位，系统会自动套用该岗位默认权限，然后可在下方细调。</p></div><button class="ghost-btn">展开权限下拉</button></div>
        <div class="role-permission-panel">
          <div class="role-select-stack">
            <div class="field"><label>选择岗位</label><select><option>老板 / 管理者</option><option>店长</option><option>厨师</option><option>服务员</option><option>洗碗工</option><option>财务</option></select></div>
            <details class="role-template-editor">
              <summary>编辑岗位</summary>
              <div class="role-template-body">
                <div class="role-template-list">
                  <button class="role-template-pill active">老板 / 管理者</button>
                  <button class="role-template-pill">店长</button>
                  <button class="role-template-pill">厨师</button>
                  <button class="role-template-pill">服务员</button>
                  <button class="role-template-pill">洗碗工</button>
                  <button class="role-template-pill">财务</button>
                  <button class="role-template-add">+ 添加岗位</button>
                </div>
                <div class="role-template-form">
                  <div class="form-grid compact-form-grid">
                    ${field("岗位名称", "例如：吧台负责人", "老板 / 管理者")}
                    ${field("默认权限摘要", "填写该岗位默认权限说明", "默认全部管理权限：门店、财务、采购、经营与企业。")}
                  </div>
                  <div class="role-template-defaults">
                    <label class="check"><input type="checkbox" checked> 默认勾选门店运营权限</label>
                    <label class="check"><input type="checkbox" checked> 默认勾选财务权限</label>
                    <label class="check"><input type="checkbox" checked> 默认勾选仓库 / 采购权限</label>
                    <label class="check"><input type="checkbox" checked> 默认勾选经营与企业权限</label>
                    <label class="check"><input type="checkbox"> 仅允许查看，不允许编辑</label>
                    <label class="check"><input type="checkbox"> 新员工创建时自动套用</label>
                  </div>
                  <div class="button-row role-template-actions">
                    <button class="ghost-btn">复制当前岗位</button>
                    <button class="primary-btn">保存岗位默认值</button>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
        <div class="permission-smart-note"><strong>智能分类：</strong>系统按“门店运营、财务、仓库 / 采购、经营与企业”分组，岗位默认权限会先自动勾选，再允许单项增删。</div>
        ${[
          ["门店运营", "日常门店执行、食品安全、员工现场管理和平台运营。", ["HACCP 管理", "门店任务（含设备 / 设施检查）", "员工打卡查看", "排班管理", "Google 评价回复", "外卖平台数据", "反馈记录", "多门店运营查看"]],
          ["财务", "账单、付款、税务资料和 DATEV 对接。", ["账单上传中心", "账单管理（含对账、审批、应付与付款）", "每日 Abrechnung", "税务师资料", "DATEV 导出"]],
          ["仓库 / 采购", "采购订单、供应商、库存、损耗和价格变动。", ["订单管理", "供应商管理", "运单 / 账单上传", "库存管理", "损耗记录", "价格变动查看", "采购待办处理"]],
          ["经营与企业", "经营分析、企业资料、权限和审批流程。", ["经营总览", "月度报告", "成本与利润", "商品分析", "行业资讯", "营销推广", "企业资料管理", "员工权限管理", "审批流程设置"]]
        ].map(group=>`<details class="permission-group" open><summary>${group[0]} <span>${group[1]}</span></summary><div class="permission-grid">${group[2].map((x,i)=>`<label class="check"><input type="checkbox" ${i<2?"checked":""}> ${x}</label>`).join("")}</div></details>`).join("")}
        <div class="button-row" style="margin-top:14px"><button class="ghost-btn">取消</button><button class="primary-btn">保存设置</button></div>
      </section>`],
    "系统连接": ["系统连接", "连接 DATEV、银行、POS 收银系统和外卖平台。", `
      <section class="grid grid-2">
        ${["DATEV","银行账户 / SEPA","POS 收银系统"].map((x,i)=>`<div class="card"><div class="section-title"><h2>${x}</h2><span class="pill ${i===0?"green":"blue"}">${i===0?"已连接":"可连接"}</span></div><p>用于同步账单、付款、营业额、订单和平台评分。</p><div class="form-grid">${field("接口账号 / API Key", "请输入连接信息")}${field("同步频率", "每日 / 每小时 / 手动")}</div><button class="primary-btn" style="margin-top:12px">连接 / 更新</button></div>`).join("")}
        <div class="card delivery-ad-card">
          <div class="section-title"><h2>Lieferando / Uber Eats / Wolt</h2><span class="pill blue">可合作</span></div>
          <h3>与 Delivery 平台合作，一个设备完成接单。</h3>
          <p>实时同步 Lieferando、Uber Eats、Wolt 的新订单、取消、备注和营业状态，店员不需要在多个平板之间切换。</p>
          <div class="delivery-points">
            <span>实时订单消息</span>
            <span>统一接单设备</span>
            <span>自动同步营业额</span>
          </div>
          <button class="primary-btn" style="margin-top:14px">申请外卖平台聚合接单</button>
        </div>
      </section>`],
    "审批流程设置": ["审批与自动化中心", "配置订货、账单、请假、HACCP、库存损耗和异常金额的自动审批、提醒与升级规则。", `
      <section class="grid grid-4">
        ${[["已启用规则数量","8条","green"],["今日待审批","12项","orange"],["超时未处理","3项","red"],["AI自动通过数量","26项","blue"]].map(x=>`<div class="card"><p>${x[0]}</p><div class="metric-value" style="color:var(--${x[2]})">${x[1]}</div></div>`).join("")}
      </section>
      <section class="grid grid-2 approval-grid" style="margin-top:14px">
        ${approvalRuleCard({
          title: "订货审批",
          trigger: ["无需审批", "超过 €200", "超过 €500", "超过 €1000", "超过预算 10%", "新供应商订单", "商品价格上涨超过 10%"],
          approver: ["店长", "区域经理", "财务", "老板", "多级审批：店员 → 店长 → 财务"],
          deadline: "2小时内处理",
          escalation: "超时自动升级给老板",
          notice: "系统消息 / Email / WhatsApp",
          ai: "风险：建议人工审核"
        })}
        ${approvalRuleCard({
          title: "账单审批",
          trigger: ["系统自动核对订单、Lieferschein 和 Rechnung", "缺订单", "缺运单", "金额异常", "税率异常", "重复账单"],
          approver: ["财务", "老板", "多级审批：财务 → 老板"],
          deadline: "当日处理",
          escalation: "异常账单进入红色待办",
          notice: "系统消息 / 财务邮箱",
          auto: ["金额误差 ≤ 2%", "供应商已认证", "账单信息完整"],
          ai: "正常：建议自动通过"
        })}
        ${approvalRuleCard({
          title: "请假审批",
          trigger: ["病假", "年假", "无薪假", "3天以内：店长审批", "超过3天：店长 + 区域经理", "超过7天：老板审批"],
          approver: ["店长", "区域经理", "老板"],
          deadline: "24小时内处理",
          escalation: "超时提醒上一级审批人",
          notice: "系统消息 / 员工 mailbox",
          ai: "正常：建议自动通过"
        })}
        ${approvalRuleCard({
          title: "HACCP检查提醒",
          trigger: ["检查频率：每日 / 每周", "截止时间：每天 10:00 前", "超时2小时提醒", "连续3天未填写通知老板"],
          approver: ["店长", "厨房主管"],
          deadline: "每天 10:00 前",
          escalation: "连续未填写自动升级老板",
          notice: "系统消息 / WhatsApp",
          ai: "风险：建议人工审核"
        })}
        ${approvalRuleCard({
          title: "财务异常监控",
          trigger: ["单张账单超过 €500", "同商品涨价超过 15%", "月采购超预算 20%", "库存损耗超过 10%", "重复付款风险"],
          approver: ["财务", "老板"],
          deadline: "2小时内确认",
          escalation: "高风险事项直接通知老板",
          notice: "系统红色待办 / Email",
          ai: "高风险：建议老板确认"
        })}
        ${approvalRuleCard({
          title: "供应商审批",
          trigger: ["新增供应商", "修改供应商银行账户", "供应商价格表更新"],
          approver: ["采购负责人", "财务", "老板"],
          deadline: "当日处理",
          escalation: "银行账户变更必须老板确认",
          notice: "系统消息 / 财务邮箱",
          ai: "风险：建议人工审核"
        })}
        ${approvalRuleCard({
          title: "库存损耗审批",
          trigger: ["单次损耗超过 €100", "损耗率超过 5%", "高频损耗商品"],
          approver: ["店长", "区域经理"],
          deadline: "当班结束前",
          escalation: "连续高损耗自动进入经营异常",
          notice: "系统消息 / 店长 mailbox",
          ai: "风险：建议人工审核"
        })}
        ${approvalRuleCard({
          title: "员工入职与离职审批",
          trigger: ["新增员工", "员工离职", "修改工资信息"],
          approver: ["店长", "HR", "财务"],
          deadline: "3天内完成",
          escalation: "工资信息修改需财务二次确认",
          notice: "系统消息 / HR mailbox",
          ai: "正常：建议自动通过"
        })}
      </section>`, `<div class="button-row" style="margin-top:18px"><button class="primary-btn">保存设置</button><button class="ghost-btn">恢复默认规则</button><button class="ghost-btn">预览审批流程</button></div>`],
    "通知与提醒设置": ["通知与提醒设置", "配置库存、账单、Google 差评、员工考勤和 HACCP 未填写提醒。", `
      <section class="grid grid-2">${["库存预警","账单异常","Google 差评","员工考勤","HACCP 未填写"].map((x,i)=>`<div class="card"><div class="section-title"><h2>${x}</h2><span class="pill green">启用</span></div><div class="form-grid">${field("提醒对象", "Martin / 店长 / 财务")}${field("提醒渠道", "系统 / Email / WhatsApp")}${field("提前时间", i===0 ? "低于安全库存立即提醒" : "当日 / 2小时前")}</div><label class="check"><input type="checkbox" checked> 开启红色待办提醒</label></div>`).join("")}<button class="card add-dashed add-reminder-card"><h2>+ 添加其他提醒</h2><p>自定义提醒对象、触发条件、通知渠道和是否生成红色待办。</p></button></section>`],
    "通讯信息": ["通讯信息", "同步开店向导中的电工、水工、维修联系人、赞助商和服务商联系方式，并支持自行添加。", `
      <section class="card finish-card">
        <div><h2>同步开店向导通讯录</h2><p>从运营启动清单同步电工、水工、维修、装修、网络、赞助商、啤酒 / 饮料供应商等联系人。</p></div>
        <button class="primary-btn">一键同步开店向导信息</button>
      </section>
      <section class="grid grid-3" style="margin-top:14px">
        ${[
          ["电工", "Elektro Dortmund", "+49 231 000000", "装修 / 设备接电"],
          ["水工", "Sanitär Service Ruhr", "+49 231 111111", "厨房水路 / 漏水维修"],
          ["维修联系人", "Küche Technik Müller", "+49 231 222222", "冰箱、洗碗机、制冰机"],
          ["网络 / 电话", "Telekom Business", "+49 800 3300000", "办网、路由器、电话"],
          ["赞助商", "Dortmund Bier Partner", "+49 231 333333", "啤酒赞助、杯具、遮阳伞"],
          ["饮料供应商", "Coca-Cola Vertrieb", "+49 231 444444", "软饮、冰箱、促销物料"]
        ].map(x=>`<div class="card contact-card"><div class="section-title"><h2>${x[0]}</h2><span class="pill blue">已同步</span></div><strong>${x[1]}</strong><p>${x[2]}</p><p>${x[3]}</p><div class="button-row"><button class="ghost-btn">拨打</button><button class="ghost-btn">编辑</button></div></div>`).join("")}
      </section>
      <section class="grid grid-2" style="margin-top:14px">
        <div class="card"><h2>手动添加联系人</h2><div class="form-grid">${field("联系人 / 公司名称", "请输入名称")}${field("类型", "电工 / 水工 / 赞助商 / 其他")}${field("电话", "+49 ...")}${field("邮箱", "email@example.com")}${field("城市", "Dortmund")}${field("备注", "服务范围、报价、联系人说明")}</div><button class="primary-btn" style="margin-top:12px">添加到通讯录</button></div>
        <div class="card"><h2>通讯录分类</h2>${["紧急维修联系人","开店服务商","赞助商与品牌合作","政府 / 许可联系人","税务 / 财务联系人","供应商联系人"].map(x=>`<label class="check"><input type="checkbox" checked> ${x}</label>`).join("")}</div>
      </section>`],
    "品牌与门店展示": ["品牌与门店展示", "设置 Logo、店铺背景图、企业颜色和首页展示风格。", `
      <section class="grid grid-2">
        <div class="card"><h2>品牌素材</h2><div class="upload">上传企业 Logo</div><div class="upload" style="margin-top:12px">上传店铺背景图 / Hero 图片</div><div class="form-grid" style="margin-top:12px">${field("企业主色", "紫色 / 蓝色")}${field("门店展示名", "Martin Biergarten")}</div></div>
        <div class="card"><h2>首页展示风格</h2>${["显示今日待办","显示经营快照","显示门店背景图","使用 KaiSpan × 门店品牌"].map(x=>`<label class="check"><input type="checkbox" checked> ${x}</label>`).join("")}<button class="primary-btn" style="margin-top:12px">预览展示效果</button></div>
      </section>`],
    "套餐与账单": ["套餐与账单", "查看 KaiSpan 订阅套餐、付款记录和发票下载。", `
      <section class="grid grid-2">
        <div class="card"><h2>当前套餐</h2><div class="metric-value">KaiSpan Business OS</div><p>3 家门店 · AI 助手 · 财务 / 仓库 / 门店 / 经营模块</p><button class="primary-btn" style="margin-top:12px">升级套餐</button></div>
        <div class="card"><h2>付款方式</h2><div class="form-grid">${field("付款账户", "SEPA / Kreditkarte")}${field("账单邮箱", "billing@example.com")}</div><button class="ghost-btn" style="margin-top:12px">更新付款方式</button></div>
      </section><div class="card" style="margin-top:14px"><h2>付款记录与发票</h2><table class="table"><tbody>${["2025-05 KaiSpan 订阅 €249.00","2025-04 KaiSpan 订阅 €249.00","2025-03 KaiSpan 订阅 €249.00"].map(x=>`<tr><td>${x}</td><td><span class="pill green">已付款</span></td><td><button class="ghost-btn">下载发票</button></td></tr>`).join("")}</tbody></table></div>`]
  };
  const page = pages[name] || ["企业管理设置", "请选择一个企业管理模块。", ""];
  return `<div class="page-head"><div><h1>${page[0]}</h1><p>${page[1]}</p></div><a class="ghost-btn accent-back-btn" href="#admin${suffix}">返回企业管理中心</a></div>${page[2]}${page[3] || `<div class="button-row" style="margin-top:18px"><button class="ghost-btn">取消</button><button class="primary-btn">保存设置</button></div>`}`;
}

function approvalRuleCard(rule) {
  const aiClass = rule.ai.includes("高风险") ? "red" : rule.ai.includes("风险") ? "orange" : "green";
  return `<div class="card approval-rule">
    <div class="section-title"><h2>${rule.title}</h2><span class="pill green">已启用</span></div>
    <div class="rule-block"><strong>触发条件</strong><div class="option-list">${rule.trigger.map(x=>`<span>${x}</span>`).join("")}</div></div>
    ${rule.auto ? `<div class="rule-block auto-pass"><strong>自动通过条件</strong><div class="option-list">${rule.auto.map(x=>`<span>${x}</span>`).join("")}</div></div>` : ""}
    <div class="rule-config">
      <div><span>审批人</span><strong>${rule.approver.join(" / ")}</strong></div>
      <div><span>处理时限</span><strong>${rule.deadline}</strong></div>
      <div><span>超时处理</span><strong>${rule.escalation}</strong></div>
      <div><span>通知方式</span><strong>${rule.notice}</strong></div>
    </div>
    <div class="rule-switches">
      <label class="check"><input type="checkbox" checked> 是否启用</label>
      <label class="check"><input type="checkbox" checked> AI审核建议</label>
    </div>
    <div class="ai-review ${aiClass}"><strong>AI审核建议</strong><span>${rule.ai}</span></div>
  </div>`;
}

function placeholderPage(section, child) {
  return `<div class="page-head"><div><h1>${child}</h1><p>${section} 的二级页面占位。后续开发可在这里接入真实数据、表单和审批流程。</p></div></div><div class="card placeholder"><div><div class="iconbox purple" style="margin:auto auto 18px">✦</div><h2>${child}</h2><p>当前 Demo 已保留完整菜单结构与页面入口，点击左侧其他菜单可继续浏览核心页面。</p></div></div>`;
}

function userDropdown(params) {
  return `<div class="user-menu ${params.get("userMenu") === "1" ? "open" : ""}" id="userMenu"><p style="padding:10px"><strong>当前门店</strong></p>${stores.map((s,i)=>`<a class="menu-row" href="#"><span>${i===0?"✓":""}</span><span>${s}</span></a>`).join("")}<div class="menu-sep"></div>${["个人中心","我的任务","联系 Kai","帮助中心"].map(x=>`<a class="menu-row" href="#"><span>${x==="个人中心"?"♙":x==="我的任务"?"☑":x==="联系 Kai"?"☏":"?"}</span>${x}</a>`).join("")}<div class="menu-sep"></div><a class="menu-row logout" href="#welcome">↪ 退出登录</a></div>`;
}

function storeDropdown(params) {
  return `<div class="store-menu ${params.get("storeMenu") === "1" ? "open" : ""}" id="storeMenu"><p style="padding:10px"><strong>选择当前门店</strong></p>${stores.map((s,i)=>`<a class="menu-row" href="#"><span>${i===0?"✓":""}</span>${s}</a>`).join("")}</div>`;
}

function kaiWidget(params) {
  const open = params.get("kai") === "1";
  const route = state().route;
  const supplierNudge = route === slug("warehouse", "供应商管理");
  const tipText = supplierNudge ? "查看其他供货商 Angebot →" : "有什么问题请问 Kai";
  return `<div class="kai-chat ${open ? "open" : ""}" id="kaiChat"><div class="kai-chat-head"><img class="kai-mini" src="${kaiImg}" alt="Kai"><div><strong>Kai</strong><p>您的智能秘书</p></div></div><div class="kai-body"><p>您好 Martin，有什么我可以帮您的吗？</p>${kaiQuestions().map(q=>`<button class="question">${q} ›</button>`).join("")}</div><div class="chat-input"><input placeholder="请输入您的问题..."><button class="primary-btn">→</button></div></div><button class="kai-float" id="kaiToggle" aria-label="Kai"><img src="${kaiImg}" alt="Kai"><span class="online-dot"></span><span class="kai-tip ${supplierNudge ? "persistent" : ""}">${tipText}</span></button>`;
}

function bindWelcome() {
  document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => {
    try {
      localStorage.setItem("kaispanMode", btn.dataset.go === "opening" ? "opening" : "operating");
    } catch (error) {
      // Some local file previews block storage; the link still handles navigation.
    }
  }));
  bindLanguageSelect();
}

function bindLanguageSelect() {
  document.getElementById("languageSelect")?.addEventListener("change", event => {
    try {
      localStorage.setItem(LANGUAGE_KEY, event.target.value === "de" ? "de" : "zh");
    } catch (error) {
      // The next render still reflects the selected value when storage is available.
    }
    app();
  });
}

function updateParam(key) {
  const { route, params } = state();
  const on = params.get(key) === "1";
  params.delete("userMenu");
  params.delete("storeMenu");
  if (key !== "kai") params.delete("kai");
  if (!on) params.set(key, "1"); else params.delete(key);
  location.hash = `${route}${params.toString() ? "?" + params.toString() : ""}`;
}

function bindEmployeeSelection() {
  document.querySelectorAll(".employee-select-all").forEach(selectAll => {
    const table = selectAll.closest("table");
    selectAll.addEventListener("change", () => {
      table?.querySelectorAll("tbody .employee-row-check").forEach(input => {
        input.checked = selectAll.checked;
      });
    });
  });
  document.querySelectorAll(".employee-notify-btn").forEach(button => {
    button.addEventListener("click", event => {
      const card = button.closest(".card");
      const selected = Array.from(card?.querySelectorAll("tbody .employee-row-check:checked") || [])
        .map(input => input.closest("tr")?.querySelector("td:nth-child(2)")?.textContent.trim())
        .filter(Boolean);
      if (!selected.length) return;
      event.preventDefault();
      location.hash = `${slug("employee", "AI邮件编辑")}?recipients=${encodeURIComponent(selected.join(","))}`;
    });
  });
}

function bindScheduleEditor() {
  const closeEditor = () => document.querySelector(".shift-editor-popover")?.remove();
  const setShiftVisual = (shift, value) => {
    if (value === "未报班") {
      shift.className = "shift-pill missing-shift editable-shift";
      shift.dataset.shift = "";
      shift.textContent = "还没报班";
      return;
    }
    if (value.startsWith("FREE ")) {
      const freeTime = value.replace("FREE ", "");
      shift.className = "shift-pill free editable-shift";
      shift.dataset.shift = freeTime;
      shift.innerHTML = `<span>FREE</span><strong>${freeTime}</strong>`;
      return;
    }
    if (value === "休息" || !value) {
      shift.className = "shift-pill off editable-shift";
      shift.dataset.shift = "";
      shift.textContent = "/";
      return;
    }
    shift.className = `shift-pill ${shift.dataset.role || ""} editable-shift`;
    shift.dataset.shift = value;
    shift.textContent = value;
  };
  document.querySelectorAll(".editable-shift").forEach(shift => {
    shift.addEventListener("click", event => {
      event.stopPropagation();
      closeEditor();
      const [start = "", end = ""] = (shift.dataset.shift || "").split("-");
      const rect = shift.getBoundingClientRect();
      const popover = document.createElement("div");
      popover.className = "shift-editor-popover";
      popover.innerHTML = `
        <strong>${shift.classList.contains("missing-shift") ? "手动添加班次" : "修改班次时间"}</strong>
        <div class="shift-editor-fields">
          <label><span>开始时间</span><input type="time" class="shift-start" value="${start}"></label>
          <label><span>结束时间</span><input type="time" class="shift-end" value="${end}"></label>
        </div>
        <div class="button-row">
          <button class="ghost-btn shift-off-btn">今天不排班</button>
          <button class="primary-btn shift-save-btn">保存</button>
        </div>
      `;
      document.body.appendChild(popover);
      const popoverRect = popover.getBoundingClientRect();
      const left = Math.min(window.innerWidth - popoverRect.width - 16, Math.max(16, rect.left));
      const top = Math.min(window.innerHeight - popoverRect.height - 16, rect.bottom + 8);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
      popover.addEventListener("click", innerEvent => innerEvent.stopPropagation());
      setTimeout(() => document.addEventListener("click", closeEditor, { once: true }), 0);
      popover.querySelector(".shift-save-btn")?.addEventListener("click", () => {
        const nextStart = popover.querySelector(".shift-start")?.value;
        const nextEnd = popover.querySelector(".shift-end")?.value;
        if (!nextStart || !nextEnd) return;
        const nextShift = `${nextStart}-${nextEnd}`;
        setShiftVisual(shift, nextShift);
        closeEditor();
      });
      popover.querySelector(".shift-off-btn")?.addEventListener("click", () => {
        const nextStart = popover.querySelector(".shift-start")?.value;
        const nextEnd = popover.querySelector(".shift-end")?.value;
        const freeShift = nextStart && nextEnd ? `${nextStart}-${nextEnd}` : shift.dataset.shift;
        if (!freeShift) return;
        setShiftVisual(shift, `FREE ${freeShift}`);
        closeEditor();
      });
    });
  });
  document.querySelector(".schedule-ai-btn")?.addEventListener("click", () => {
    document.querySelectorAll(".editable-shift").forEach(shift => setShiftVisual(shift, shift.dataset.aiShift || shift.dataset.initialShift || "休息"));
    document.querySelector(".schedule-title").textContent = "AI 自动排班结果";
    const status = document.querySelector(".schedule-status");
    status.textContent = "可发布";
    status.className = "pill green schedule-status";
    document.querySelector(".schedule-ai-btn")?.classList.add("is-hidden");
    document.querySelector(".schedule-undo-btn")?.classList.remove("is-hidden");
    document.querySelector(".schedule-publish-btn")?.classList.remove("is-hidden");
  });
  document.querySelector(".schedule-undo-btn")?.addEventListener("click", () => {
    closeEditor();
    document.querySelectorAll(".editable-shift").forEach(shift => setShiftVisual(shift, shift.dataset.initialShift || "休息"));
    document.querySelector(".schedule-title").textContent = "排班准备";
    const status = document.querySelector(".schedule-status");
    status.textContent = "待排班";
    status.className = "pill blue schedule-status";
    document.querySelector(".schedule-ai-btn")?.classList.remove("is-hidden");
    document.querySelector(".schedule-undo-btn")?.classList.add("is-hidden");
    document.querySelector(".schedule-publish-btn")?.classList.add("is-hidden");
  });
}

function bindArbeitszeitkontoEditor() {
  const closeEditor = () => document.querySelectorAll(".time-account-popover, .scheduled-hours-popover").forEach(el => el.remove());
  const styleAccount = (badge, value) => {
    const numberValue = Number.parseFloat(value);
    const display = `${numberValue > 0 ? "+" : ""}${Number.isNaN(numberValue) ? 0 : numberValue}h`;
    badge.textContent = display;
    badge.dataset.value = String(Number.isNaN(numberValue) ? 0 : numberValue);
    badge.className = `pill editable-time-account ${numberValue < 0 ? "red" : numberValue === 0 || Number.isNaN(numberValue) ? "gray" : "green"}`;
  };
  const formatHours = value => `${Math.max(0, Math.round(value * 10) / 10)}h`;
  const updateScheduledHours = (row, delta) => {
    const hoursButton = row?.querySelector(".editable-scheduled-hours");
    if (!hoursButton) return;
    const current = Number.parseFloat(hoursButton.dataset.hours || hoursButton.textContent);
    const next = Number.isNaN(current) ? 0 : current + delta;
    hoursButton.dataset.hours = String(Math.max(0, Math.round(next * 10) / 10));
    hoursButton.textContent = formatHours(next);
  };
  document.querySelectorAll(".editable-time-account").forEach(badge => {
    badge.addEventListener("click", event => {
      event.stopPropagation();
      closeEditor();
      const rect = badge.getBoundingClientRect();
      const popover = document.createElement("div");
      popover.className = "shift-editor-popover time-account-popover";
      popover.innerHTML = `
        <strong>修改 Arbeitszeitkonto</strong>
        <div class="field"><label>处理方式</label><select class="time-account-action"><option value="store">存入工时</option><option value="take">取出工时</option></select></div>
        <div class="field"><label>小时数</label><input class="time-account-input" type="number" min="0" step="0.5" placeholder="例如 2 或 1.5"></div>
        <div class="button-row" style="margin-top:12px">
          <button class="ghost-btn time-account-zero">一键清零</button>
          <button class="primary-btn time-account-save">保存</button>
        </div>
      `;
      document.body.appendChild(popover);
      const popoverRect = popover.getBoundingClientRect();
      popover.style.left = `${Math.min(window.innerWidth - popoverRect.width - 16, Math.max(16, rect.left))}px`;
      popover.style.top = `${Math.min(window.innerHeight - popoverRect.height - 16, rect.bottom + 8)}px`;
      popover.addEventListener("click", innerEvent => innerEvent.stopPropagation());
      setTimeout(() => document.addEventListener("click", closeEditor, { once: true }), 0);
      popover.querySelector(".time-account-save")?.addEventListener("click", () => {
        const amount = Number.parseFloat(popover.querySelector(".time-account-input")?.value || "0");
        if (Number.isNaN(amount) || amount <= 0) return;
        const action = popover.querySelector(".time-account-action")?.value;
        const current = Number.parseFloat(badge.dataset.value || "0");
        const signedAmount = action === "take" ? -amount : amount;
        styleAccount(badge, (Number.isNaN(current) ? 0 : current) + signedAmount);
        updateScheduledHours(badge.closest("tr"), action === "take" ? amount : -amount);
        closeEditor();
      });
      popover.querySelector(".time-account-zero")?.addEventListener("click", () => {
        styleAccount(badge, "0");
        closeEditor();
      });
    });
  });
  document.querySelectorAll(".editable-scheduled-hours").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      closeEditor();
      const rect = button.getBoundingClientRect();
      const employee = button.dataset.employee || "员工";
      const popover = document.createElement("div");
      popover.className = "shift-editor-popover scheduled-hours-popover";
      popover.innerHTML = `
        <strong>${employee} 已排工时修改记录</strong>
        <div class="scheduled-history-list">
          <p><span>今天 10:20</span><b>存入 2h 到 Arbeitszeitkonto</b></p>
          <p><span>昨天 18:40</span><b>晚班延长 +1.5h</b></p>
          <p><span>05-21</span><b>手动修正排班 0.5h</b></p>
        </div>
      `;
      document.body.appendChild(popover);
      const popoverRect = popover.getBoundingClientRect();
      popover.style.left = `${Math.min(window.innerWidth - popoverRect.width - 16, Math.max(16, rect.left))}px`;
      popover.style.top = `${Math.min(window.innerHeight - popoverRect.height - 16, rect.bottom + 8)}px`;
      popover.addEventListener("click", innerEvent => innerEvent.stopPropagation());
      setTimeout(() => document.addEventListener("click", closeEditor, { once: true }), 0);
    });
  });
}

function bindKontoSuggestions() {
  document.querySelectorAll(".konto-confirm-btn").forEach(button => {
    button.addEventListener("click", () => {
      const suggestion = button.closest(".konto-suggestion");
      const employee = suggestion?.dataset.employee;
      const hours = Number.parseFloat(suggestion?.dataset.hours || "0");
      const signedHours = suggestion?.dataset.action === "take" ? -hours : hours;
      const badge = document.querySelector(`.editable-time-account[data-employee="${employee}"]`);
      if (!badge) return;
      badge.textContent = `${signedHours > 0 ? "+" : ""}${signedHours}h`;
      badge.dataset.value = String(signedHours);
      badge.className = `pill editable-time-account ${signedHours < 0 ? "red" : signedHours === 0 ? "gray" : "green"}`;
      const hoursButton = badge.closest("tr")?.querySelector(".editable-scheduled-hours");
      if (hoursButton) {
        const current = Number.parseFloat(hoursButton.dataset.hours || hoursButton.textContent);
        const next = (Number.isNaN(current) ? 0 : current) + (suggestion?.dataset.action === "take" ? hours : -hours);
        hoursButton.dataset.hours = String(Math.max(0, Math.round(next * 10) / 10));
        hoursButton.textContent = `${Math.max(0, Math.round(next * 10) / 10)}h`;
      }
      button.textContent = "已确认";
      button.classList.remove("primary-btn");
      button.classList.add("ghost-btn");
      button.disabled = true;
    });
  });
}

function showTaxOfficeToast(message, tone = "green") {
  document.querySelector(".tax-office-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `tax-office-toast ${tone}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

function bindTaxOfficeActions() {
  document.querySelector(".tax-search-box input")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      location.hash = `tax-office/dashboard?q=${encodeURIComponent(event.currentTarget.value.trim())}`;
    }
  });
  document.querySelectorAll(".tax-month-select").forEach(select => {
    select.addEventListener("change", () => showTaxOfficeToast(`已切换到 ${select.value} 月份。`, "blue"));
  });
  document.querySelectorAll(".tax-feedback-action").forEach(button => {
    button.addEventListener("click", () => {
      const text = button.textContent.trim();
      const tone = text.includes("反馈") || text.includes("发给客户") ? "orange" : text.includes("审批") || text.includes("通过") || text.includes("DATEV") ? "green" : "blue";
      const message = text.includes("标记反馈") ? "已加入客户沟通的 Email 草稿。" : `${text || "操作"} 已模拟完成，并写入 Kanzlei 操作记录。`;
      if (text.includes("标记反馈")) {
        button.textContent = "已标记";
        button.classList.add("success-btn");
        button.disabled = true;
      }
      showTaxOfficeToast(message, tone);
    });
  });
  document.querySelectorAll(".tax-sample-doc").forEach(button => {
    button.addEventListener("click", () => {
      showTaxOfficeToast("已打开账单抽查预览：Kontierung、税率和重复风险可复核。", "orange");
    });
  });
}

function bindGlobal() {
  document.getElementById("collapseBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar")?.classList.toggle("collapsed");
    document.querySelector(".layout")?.classList.toggle("sidebar-collapsed");
  });
  document.getElementById("userToggle")?.addEventListener("click", () => updateParam("userMenu"));
  document.getElementById("storeToggle")?.addEventListener("click", () => updateParam("storeMenu"));
  document.getElementById("kaiToggle")?.addEventListener("click", () => updateParam("kai"));
  bindEmployeeSelection();
  bindScheduleEditor();
  bindArbeitszeitkontoEditor();
  bindKontoSuggestions();
  bindTaxOfficeActions();
  bindLanguageSelect();
}

window.addEventListener("hashchange", app);
app();
