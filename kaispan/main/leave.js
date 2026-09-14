/* ==========================================================================
   KaiSpan · 休假（年假 / 病假 / 无薪假 / 特殊假）
   --------------------------------------------------------------------------
   在 attend.js 之后、hours.js 之前以 defer 加载，前缀 lv。

   原来这一块是「请假记录」一个假页面：三行写死的申请，一个填了没人读的表单。

   放在哪儿是 Mingrong 2026-09-03 拍板的：**排班与工时的第三个入口**，
   跟「周排班 / 月度结算」并列。理由是年假和报班是同一个问题的两种粒度 ——
   报班说「我这周哪几个时段能来」，年假说「这几天整天不能来」，
   而且顺序上它必须在前面：AI 排班要先知道谁休假才排得出草稿。

   病假在**考勤页**登记（它是「那天为什么没来」的答案），登记完自动汇到这里。
   同一份数据两个入口，各解决不同的问题：考勤那边是「结掉这一天」，
   休假这边是「这个月谁病了几天、AU 交了没、额度还剩多少」。

   四条口径写在这儿，页面上也写明：
     1. 额度不让人手填 —— 从合同的 Urlaubstage 来，入职/离职当年按整月 1/12 折算。
     2. 天数不让人手填 —— 班表已经排了的日子数实际排班天数，没排的按周工作天数折算。
     3. 批准的休假在排班里是硬拦，但只拦今天起的班。过去那几天已经用考勤结掉了。
     4. 有薪假按前 13 周日均净工时折算成计薪工时（§11 BUrlG 的口径），
        而不是「合同月工时 ÷ 30」—— 餐饮的班长短差很多，后者算出来谁都不认。
   ========================================================================== */

const LV_KEY = "kaispanLeave";

/* 四种假。paid 决定它进不进计薪工时；quota 决定它扣不扣年假额度。 */
const LV_TYPES = [
  { id: "urlaub", paid: true, quota: true,
    name: { zh: "年假", de: "Urlaub" },
    note: { zh: "扣年假额度，照付工资。", de: "Zählt auf den Urlaubsanspruch, wird bezahlt." } },
  { id: "krank", paid: true, quota: false,
    name: { zh: "病假", de: "Krankmeldung" },
    note: { zh: "不扣年假。6 周内照付（Lohnfortzahlung），超过转 Krankengeld。连续 3 天以上要 AU。",
            de: "Kein Urlaubsabzug. Bis 6 Wochen Lohnfortzahlung, danach Krankengeld. Ab dem 3. Tag AU nötig." } },
  { id: "unbezahlt", paid: false, quota: false,
    name: { zh: "无薪假", de: "Unbezahlter Urlaub" },
    note: { zh: "不扣年假，也不计工资。要双方同意。", de: "Kein Urlaubsabzug, keine Vergütung. Beidseitig zu vereinbaren." } },
  { id: "sonder", paid: true, quota: false,
    name: { zh: "特殊假", de: "Sonderurlaub" },
    note: { zh: "婚丧、搬家等。照付但不扣年假，具体几天看合同或行业协议。",
            de: "Hochzeit, Trauerfall, Umzug. Bezahlt, ohne Urlaubsabzug; Dauer laut Vertrag oder Tarif." } }
];

function lvType(id) {
  return LV_TYPES.find(t => t.id === id) || LV_TYPES[0];
}

const LV_STATES = {
  pending: { tone: "orange", name: { zh: "待审批", de: "Zur Freigabe" } },
  approved: { tone: "green", name: { zh: "已批准", de: "Genehmigt" } },
  rejected: { tone: "gray", name: { zh: "已驳回", de: "Abgelehnt" } },
  cancelled: { tone: "gray", name: { zh: "已撤销", de: "Zurückgezogen" } }
};

/* ---------------------------------------------------------------- 存储 --- */
let lvSeeding = false;

function lvAll() {
  const saved = empRead(LV_KEY, null);
  if (saved) return saved;
  if (lvSeeding) return [];
  /* 跟考勤同一个坑：种子要读班表，班表种子又会回头调这里。
     排班还在种的时候读到的是空表，那时候定型就废了。 */
  if (typeof schSeeding !== "undefined" && schSeeding) return [];
  lvSeeding = true;
  let seed = [];
  try { seed = lvSeed(); } finally { lvSeeding = false; }
  empWrite(LV_KEY, seed);
  return seed;
}

function lvSaveAll(list) {
  empWrite(LV_KEY, list);
  return list;
}

function lvById(id) {
  return lvAll().find(x => x.id === id) || null;
}

function lvNextId() {
  const list = lvAll();
  let n = list.length + 1;
  while (list.some(x => x.id === `l${n}`)) n += 1;
  return `l${n}`;
}

function lvOf(store, empId, state) {
  return lvAll().filter(x => (!store || x.store === store)
    && (!empId || x.empId === empId)
    && (!state || x.state === state));
}

/* --------------------------------------------------------------- 日期 --- */
function lvYearOf(date) { return String(date).slice(0, 4); }
function lvYear() { return lvYearOf(empToday()); }

function lvRangeDates(from, to) {
  const out = [];
  let d = from;
  for (let i = 0; i < 400 && d <= to; i += 1) { out.push(d); d = empShiftDate(d, 1); }
  return out;
}

function lvOverlapsMonth(x, month) {
  return x.from.slice(0, 7) <= month && x.to.slice(0, 7) >= month;
}

/* 这一天有没有一条已批准的休假。排班、考勤、工时三处都读它 —— 休假优先于考勤：
   批了假的那天不是「缺卡」，是「他今天不上班」。 */
function lvOn(store, empId, date) {
  return lvOf(store, empId, "approved").find(x => x.from <= date && x.to >= date) || null;
}

function lvDatesInMonth(x, month) {
  return lvRangeDates(x.from, x.to).filter(d => d.slice(0, 7) === month);
}

/* ==================================================== 一周上几天、一天几小时 ===
   两个数都不让人填，都从最近 13 周的实际班表来（§11 BUrlG 算休假工资也是 13 周口径）。
   餐饮的班长短差很多，用「合同月工时 ÷ 30」折出来的日均谁都不认。
   新人或者刚开的店没有 13 周数据，才退回按合同和合规参数折算，并且在页面上写明用的是哪种。 */
/* 窗口里的班表。**不能直接读 schRosterAll()** —— 那里面只有「已经被访问过所以落了盘」
   的周表，种子周在没人打开过之前根本不在里面。第一版就是这么翻的车：
   在首页直接跳到休假页时窗口是空的，每个人都退回按合同折算。
   所以走 schRoster()，它会把种子实体化。 */
function lvWindowRosters(store, to) {
  const out = [];
  if (typeof schRoster !== "function") return out;
  let w = schWeekOf(empShiftDate(to, -91));
  const last = schWeekOf(to);
  for (let i = 0; i < 20; i += 1) {
    if (schRosterExists(store, w)) out.push(schRoster(store, w));
    if (w === last) break;
    w = schWeekAdd(w, 1);
  }
  return out;
}

function lvWorkPattern(store, empId, refDate, rosters) {
  const to = refDate || empToday();
  const from = empShiftDate(to, -91);
  const list = rosters || lvWindowRosters(store, to);
  const days = new Set();
  /* 分母是「窗口里真的有班表的周数」，不是写死的 13。
     种子只铺了 6 周班表，除以 13 会把每周上班天数直接砍一半 ——
     第一版就是这么把「1 天无薪假」算成了 0 天。 */
  const weeks = new Set();
  let net = 0;
  list.forEach(r => {
    if (!r || r.store !== store) return;
    if ((r.shifts || []).some(s => s.date >= from && s.date <= to)) weeks.add(r.week);
    (r.shifts || []).forEach(s => {
      if (s.empId !== empId || s.date < from || s.date > to) return;
      days.add(s.date);
      net += schHours(s).net;
    });
  });
  const worked = days.size;
  if (worked >= 5 && weeks.size) {
    return { src: "roster", worked, weeks: weeks.size,
             daysPerWeek: Math.min(7, Math.round((worked / weeks.size) * 10) / 10),
             hoursPerDay: Math.round((net / worked) * 100) / 100 };
  }
  const c = (empById(empId) || {}).contract || {};
  const dpw = Math.max(1, 7 - (Number(empRule("weeklyDaysOffMin")) || 2));
  const min = Number(c.hoursMin) || 0, max = Number(c.hoursMax) || 0;
  const monthly = min && max ? (min + max) / 2 : max || min;
  const monthDays = dpw * 4.33;
  return { src: "contract", worked, daysPerWeek: dpw,
           hoursPerDay: monthDays ? Math.round((monthly / monthDays) * 100) / 100 : 0 };
}

/* ============================================================ 年假额度 ====
   合同上的 Urlaubstage 是整年的。入职当年和离职当年按整月 1/12 折算 ——
   9 月 5 号入职的人今年不该有 28 天。 */
function lvEntitlement(e, year) {
  const y = String(year || lvYear());
  const base = Number(e?.contract?.urlaubDays) || 0;
  const startM = e?.entryDate && e.entryDate.slice(0, 4) === y ? Number(e.entryDate.slice(5, 7)) : 1;
  const lastDay = e?.leave && e.leave.lastDay;
  const endM = lastDay && lastDay.slice(0, 4) === y ? Number(lastDay.slice(5, 7)) : 12;
  const months = Math.max(0, endM - startM + 1);
  if (e?.entryDate && e.entryDate.slice(0, 4) > y) return { days: 0, months: 0, base, partial: true };
  if (lastDay && lastDay.slice(0, 4) < y) return { days: 0, months: 0, base, partial: true };
  if (months >= 12) return { days: base, months: 12, base, partial: false };
  const raw = base * months / 12;
  /* 折算后向上取到半天。§5 Abs. 2 BUrlG 说满半天的进位到整天，
     具体怎么取整各家合同和行业协议不一样 —— 页面上写明这一条要核实，不替他定死。 */
  return { days: Math.ceil(raw * 2) / 2, months, base, partial: true };
}

/* ============================================================ 天数计算 ====
   休假天数 = 区间内他「本来要上班」的天数，不是日历天数。
   班表已经排到的日子按班表数（最准）；还没排的按每周工作天数折算。
   每一天存一个权重，这样跨年、跨月、日历渲染、工资折算全都能从同一份数据切出来。 */
function lvDayMap(store, e, from, to) {
  const pat = lvWorkPattern(store, e.id);
  const factor = Math.min(1, pat.daysPerWeek / 7);
  const map = {};
  lvRangeDates(from, to).forEach(date => {
    const week = schWeekOf(date);
    if (typeof schRosterExists === "function" && schRosterExists(store, week)) {
      map[date] = schShiftsOf(schRoster(store, week), e.id, date).length ? 1 : 0;
    } else {
      map[date] = Math.round(factor * 100) / 100;
    }
  });
  return map;
}

function lvDaysTotal(x) {
  return lvDaysIn(x, "");
}

/* prefix 可以是 ""（全部）、"2026"（某年）、"2026-09"（某月） */
function lvDaysIn(x, prefix) {
  const map = x.dayMap || {};
  return Object.keys(map)
    .filter(d => !prefix || d.startsWith(prefix))
    .reduce((sum, d) => sum + (Number(map[d]) || 0), 0);
}

function lvD(n) {
  const v = Math.round(n * 2) / 2;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/* 某人某年的年假账：额度 / 已批 / 待批 / 剩余。全是算出来的，一个都不手填。 */
function lvBalance(store, e, year) {
  const y = String(year || lvYear());
  const ent = lvEntitlement(e, y);
  const mine = lvOf(store, e.id).filter(x => lvType(x.type).quota);
  const taken = mine.filter(x => x.state === "approved").reduce((s, x) => s + lvDaysIn(x, y), 0);
  const pending = mine.filter(x => x.state === "pending").reduce((s, x) => s + lvDaysIn(x, y), 0);
  return { e, year: y, ...ent, taken, pending, left: ent.days - taken - pending };
}

/* ============================================================== 写入 =====
   提交 → 审批 → （病假）补 AU。每一步留痕，撤销能退回去。 */
function lvCalendarDays(x) {
  return lvRangeDates(x.from, x.to).length;
}

function lvWrite(x, entry) {
  const list = lvAll().slice();
  if (entry) x.log = [entry, ...(x.log || [])].slice(0, 20);
  const i = list.findIndex(y => y.id === x.id);
  if (i >= 0) list[i] = x; else list.unshift(x);
  lvSaveAll(list);
  return x;
}

/* 同一个人同一段时间只能有一条。重叠的直接拒绝提交 ——
   两条重叠的假会让天数、工资和排班同时算两遍。 */
function lvOverlap(store, empId, from, to, exceptId) {
  return lvOf(store, empId).find(x => x.id !== exceptId
    && ["pending", "approved"].includes(x.state)
    && x.from <= to && x.to >= from) || null;
}

function lvSubmit(store, empId, type, from, to, reason, opts) {
  const o = opts || {};
  const e = empById(empId);
  if (!e) return { ok: false, code: "noemp" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
    return { ok: false, code: "dates" };
  }
  if (lvRangeDates(from, to).length > 180) return { ok: false, code: "toolong" };
  const clash = lvOverlap(store, empId, from, to);
  if (clash) return { ok: false, code: "overlap", clash };

  const src = o.src === "manager" ? "manager" : "self";
  const by = o.by || (src === "manager" ? empT("店长", "Leitung") : e.name);
  const x = {
    id: lvNextId(), store, empId, type, from, to,
    dayMap: lvDayMap(store, e, from, to),
    /* 店长自己录的直接算批准 —— 他就是审批人，再让他给自己点一次「批准」是走过场。
       员工提交的进待审批。 */
    state: src === "manager" ? "approved" : "pending",
    reason: (reason || "").trim(), src, by, at: empNow(),
    decidedBy: src === "manager" ? by : null,
    decidedAt: src === "manager" ? empNow() : null,
    decideNote: "", au: null, log: []
  };
  lvWrite(x, { at: x.at, by, what: {
    zh: `${empRaw(lvType(type).name.zh)} ${empFormatDate(from)}–${empFormatDate(to)}，${lvD(lvDaysTotal(x))} 天${
      src === "manager" ? "（店长代录，直接生效）" : "，等审批"}${x.reason ? `：${x.reason}` : ""}`,
    de: `${lvType(type).name.de} ${from}–${to}, ${lvD(lvDaysTotal(x))} Tage${
      src === "manager" ? " (von der Leitung erfasst)" : ", zur Freigabe"}${x.reason ? `: ${x.reason}` : ""}` } });
  return { ok: true, x };
}

/* 审批。批准的时候重算一次天数 —— 提交到批准之间班表可能又排了几天，
   按提交那一刻的估算落账会跟班表对不上。 */
function lvDecide(id, state, note, by) {
  const cur = lvById(id);
  if (!cur) return null;
  const x = JSON.parse(JSON.stringify(cur));
  const e = empById(x.empId);
  const before = lvDaysTotal(x);
  if (state === "approved" && e) x.dayMap = lvDayMap(x.store, e, x.from, x.to);
  const after = lvDaysTotal(x);
  x.state = state;
  x.decidedBy = by || empT("店长", "Leitung");
  x.decidedAt = empNow();
  x.decideNote = (note || "").trim();
  const name = empText(LV_STATES[state].name);
  lvWrite(x, { at: x.decidedAt, by: x.decidedBy, what: {
    zh: `${name}${x.decideNote ? `：${x.decideNote}` : ""}${
      Math.abs(after - before) > 0.01 ? `（天数按最新班表重算：${lvD(before)} → ${lvD(after)} 天）` : ""}`,
    de: `${name}${x.decideNote ? `: ${x.decideNote}` : ""}${
      Math.abs(after - before) > 0.01 ? ` (Tage neu berechnet: ${lvD(before)} → ${lvD(after)})` : ""}` } });
  return x;
}

/* 撤销。批错了要能退回去 —— 不给退路，店长就只敢不批。 */
function lvCancel(id, by, why) {
  return lvDecide(id, "cancelled", why || "", by);
}

/* --------------------------------------------------------------- AU ---- */
/* 连续病假到第几天要医生证明，是合规参数不是硬编码：法定是第 4 天起，
   但很多雇主在合同里约定第 1 天就要。 */
function lvAuAfter() { return Number(empRule("auAfterDays")) || 3; }
function lvPayWeeks() { return Number(empRule("lohnfortzahlungWeeks")) || 6; }

function lvAuNeeded(x) {
  return x.type === "krank" && x.state === "approved" && lvCalendarDays(x) >= lvAuAfter();
}

/* AU 的三种不对：没交、交了但覆盖不到病假结束、病假超过 6 周该转 Krankengeld。 */
function lvAuIssue(x) {
  if (!lvAuNeeded(x)) return null;
  if (!x.au || !x.au.submittedAt) {
    return { code: "missing",
      zh: `病假 ${lvCalendarDays(x)} 天，连续 ${lvAuAfter()} 天以上要 AU（医生证明），还没交`,
      de: `${lvCalendarDays(x)} Tage krank — ab ${lvAuAfter()} Tagen ist eine AU nötig, sie fehlt noch` };
  }
  if (x.au.until && x.au.until < x.to) {
    return { code: "short",
      zh: `AU 只开到 ${empFormatDate(x.au.until)}，病假到 ${empFormatDate(x.to)} —— 后面这几天还缺证明`,
      de: `AU nur bis ${x.au.until}, Krankmeldung bis ${x.to} — für die Resttage fehlt der Nachweis` };
  }
  return null;
}

function lvPayIssue(x) {
  if (x.type !== "krank" || x.state !== "approved") return null;
  const days = lvCalendarDays(x);
  const limit = lvPayWeeks() * 7;
  if (days <= limit) return null;
  return { code: "krankengeld",
    zh: `连续病假 ${days} 天，超过 ${lvPayWeeks()} 周的 Lohnfortzahlung —— 第 ${limit + 1} 天起由医保付 Krankengeld，工资那边要停发`,
    de: `${days} Tage am Stück — über die ${lvPayWeeks()} Wochen Lohnfortzahlung hinaus; ab Tag ${limit + 1} zahlt die Krankenkasse Krankengeld` };
}

function lvSetAu(id, file, until, by) {
  const cur = lvById(id);
  if (!cur) return null;
  const x = JSON.parse(JSON.stringify(cur));
  x.au = { file: file || empT("AU 已收到", "AU erhalten"), until: until || null, submittedAt: empNow() };
  lvWrite(x, { at: x.au.submittedAt, by: by || empT("店长", "Leitung"),
    what: { zh: `收到 AU${until ? `，开到 ${empFormatDate(until)}` : ""}`,
            de: `AU erhalten${until ? `, gültig bis ${until}` : ""}` } });
  return x;
}

/* ======================================================== 冲排班 / 冲工时 ==
   批准的休假会在排班里硬拦（schCheck 的 leave 码），但只拦今天起的班：
   过去那几天已经用考勤结掉了，再把历史周表刷成一屏红没有任何用。 */
function lvPlannedNet(store, empId, date) {
  if (typeof schRoster !== "function") return 0;
  return schDayNet(schRoster(store, schWeekOf(date)), empId, date);
}

/* 批准之前先告诉店长：这几天他本来有几个班，批了就得找人顶。 */
function lvShiftClash(store, empId, from, to) {
  const today = empToday();
  const out = [];
  lvRangeDates(from, to).forEach(date => {
    if (date < today) return;
    if (typeof schRoster !== "function") return;
    schShiftsOf(schRoster(store, schWeekOf(date)), empId, date)
      .forEach(s => out.push({ date, start: s.start, end: s.end, net: schHours(s).net }));
  });
  return out;
}

/* 休假对这个月计薪工时的净影响。
   口径：**排了班的日子按那天排的小时数照付**（店长的直觉就是「他那天本来排 7.5h」），
   **还没排班的日子按前 13 周日均**（§11 BUrlG 的口径）。
   所以给已排班的日子批年假，月度总工时不变，变的只是这些小时的性质；
   给还没排的日子批年假，工时按日均补上，AI 排班也不会再把班排给他。
   无薪假相反：把那天已排的工时减掉，一分钱不给。 */
function lvAdjust(store, empId, month, upto) {
  const last = empShiftDate(`${schMonthAdd(month, 1)}-01`, -1);
  return lvRangeAdjust(store, empId, `${month}-01`, upto && upto < last ? upto : last);
}

/* 任意区间的休假调整。日 / 周 / 月三个视图算的是同一条链，只是区间不同。 */
function lvRangeAdjust(store, empId, from, to) {
  const pat = lvWorkPattern(store, empId);
  let sum = 0;
  lvOf(store, empId, "approved").forEach(x => {
    const paid = lvType(x.type).paid;
    lvRangeDates(x.from, x.to).forEach(date => {
      if (date < from || date > to) return;
      const w = Number(x.dayMap[date]) || 0;
      const planned = lvPlannedNet(store, empId, date);
      const hours = planned > 0 ? planned : w * pat.hoursPerDay;
      sum += (paid ? hours : 0) - planned;
    });
  });
  return Math.round(sum * 100) / 100;
}

/* 这个月有多少小时是「休假照付」而不是「真上了班」。工时表单列一格，
   否则店长看到工时对得上，却不知道其中三天这个人根本没来。 */
function lvPaidHours(store, empId, month, upto) {
  const last = empShiftDate(`${schMonthAdd(month, 1)}-01`, -1);
  return lvRangePaid(store, empId, `${month}-01`, upto && upto < last ? upto : last);
}

function lvRangePaid(store, empId, from, to) {
  const pat = lvWorkPattern(store, empId);
  let sum = 0;
  lvOf(store, empId, "approved").filter(x => lvType(x.type).paid)
    .forEach(x => lvRangeDates(x.from, x.to).forEach(date => {
      if (date < from || date > to) return;
      const w = Number(x.dayMap[date]) || 0;
      const planned = lvPlannedNet(store, empId, date);
      sum += planned > 0 ? planned : w * pat.hoursPerDay;
    }));
  return Math.round(sum * 100) / 100;
}

/* ============================================================== 待办 ===== */
function lvOpen(store) {
  return lvOf(store, null, "pending").sort((a, b) => a.from.localeCompare(b.from));
}

function lvAuOpen(store) {
  return lvOf(store, null, "approved").map(x => ({ x, issue: lvAuIssue(x) || lvPayIssue(x) }))
    .filter(r => r.issue);
}

function lvTodoItems() {
  const store = typeof schStore === "function" ? schStore() : empStores()[0];
  const out = [];
  const pend = lvOpen(store);
  if (pend.length) {
    const first = pend[0];
    const days = empDaysBetween(empToday(), first.from);
    out.push({
      type: "休假待批",
      title: `有 ${pend.length} 条休假申请等审批，最早的一条是 ${empById(first.empId)?.name || ""} ${empFormatDate(first.from)} 起的${empRaw(lvType(first.type).name.zh)}${days >= 0 ? `（还有 ${days} 天就到）` : ""}`,
      /* de：员工助手主页在 .emp-page 里，全站词典翻译够不着，德语得自己带 */
      de: `${pend.length} ${pend.length === 1 ? "Abwesenheitsantrag wartet" : "Abwesenheitsanträge warten"} auf Freigabe, der früheste: ${empById(first.empId)?.name || ""} ab ${empFormatDate(first.from)} (${lvType(first.type).name.de})${days >= 0 ? ` — noch ${days} Tage` : ""}`,
      module: "员工助手", store,
      due: days <= 7 ? "尽快处理" : "本周到期",
      risk: days <= 7 ? "高风险" : "中风险",
      status: "待审批",
      href: `#${slug("employee", "排班管理")}?v=leave`
    });
  }
  const au = lvAuOpen(store);
  if (au.length) {
    out.push({
      type: "病假证明",
      title: `${au.length} 条病假的证明有问题：${empRaw(au[0].issue.zh)}`,
      de: `${au.length} ${au.length === 1 ? "Krankmeldung mit Problem" : "Krankmeldungen mit Problemen"} bei der AU-Bescheinigung: ${empRaw(au[0].issue.de)}`,
      module: "员工助手", store, due: "尽快处理", risk: "中风险", status: "未处理",
      href: `#${slug("employee", "排班管理")}?v=leave`
    });
  }
  return out;
}

/* ============================================================== 种子 =====
   五条，把每一条路径都演示出来，又不至于多到看不清：
     待批年假（员工提交，还没批）· 已批年假（在还没排班的那一周，AI 排班要绕开他）
     病假 3 天 AU 没交（AU 跟踪）· 病假 3 天 AU 已交（对照）· 无薪假 1 天（不计工资）
   病假故意放在考勤种子那 14 天窗口里 —— 考勤那边会跳过休假的日子，
   正好把「休假优先于考勤」这条演示出来：批了病假的那天不会再报「整个班没打卡」。 */
function lvSeed() {
  const store = empStores()[0];
  const t = empToday();
  /* 按「最近三周排了多少班」排序后再挑人。按 id 挑的话会挑到 Liam ——
     他证件过期排不了班，给他种一条病假，天数算出来是 0 天，演示反而看不出东西。 */
  const since = empShiftDate(t, -21);
  const busy = {};
  lvWindowRosters(store, t).forEach(r => {
    (r.shifts || []).forEach(x => {
      if (x.date >= since) busy[x.empId] = (busy[x.empId] || 0) + 1;
    });
  });
  const staff = empStaff(store)
    .filter(e => !empStatus(e.status).leaving && (!e.entryDate || e.entryDate <= t))
    .sort((a, b) => (busy[b.id] || 0) - (busy[a.id] || 0) || String(a.id).localeCompare(String(b.id)));
  if (staff.length < 5) return [];
  const pick = i => staff[i % staff.length];
  const d = n => empShiftDate(t, n);

  /* 种子里的「什么时候提交的 / 什么时候批的」是按假期开始日往前推算的。
     假期在将来的话，这么推出来的时间戳会落在今天之后 —— 一条「三天后提交的申请」。
     没人看得见这个数，可它是所有「最近一条」排序的依据，排出来的顺序就是错的。
     所以封顶到现在：提交和批准都不可能发生在未来。 */
  const notLater = iso => { const now = empNow(); return iso > now ? now : iso; };

  const mk = (e, type, from, to, state, o) => {
    const opt = o || {};
    const x = { id: `l${opt.n}`, store, empId: e.id, type, from, to,
      dayMap: lvDayMap(store, e, from, to),
      state, reason: opt.reason || "",
      src: opt.src || "self", by: opt.src === "manager" ? "Martin" : e.name,
      at: notLater(`${empShiftDate(from, -opt.lead || -3)}T09:12:00.000Z`),
      decidedBy: state === "approved" ? "Martin" : null,
      decidedAt: state === "approved" ? notLater(`${empShiftDate(from, -2)}T18:20:00.000Z`) : null,
      decideNote: opt.note || "", au: opt.au || null, log: [] };
    x.log = [{ at: x.at, by: x.by, what: {
      zh: `${empRaw(lvType(type).name.zh)} ${empFormatDate(from)}–${empFormatDate(to)}，${lvD(lvDaysTotal(x))} 天${x.reason ? `：${x.reason}` : ""}`,
      de: `${lvType(type).name.de} ${from}–${to}, ${lvD(lvDaysTotal(x))} Tage${x.reason ? `: ${x.reason}` : ""}` } }];
    return x;
  };

  return [
    mk(pick(0), "urlaub", d(12), d(16), "pending",
       { n: 1, reason: "想回家一趟，机票还没订，等你批了再订", lead: 10 }),
    mk(pick(1), "urlaub", d(5), d(6), "approved",
       { n: 2, reason: "朋友婚礼", lead: 9 }),
    mk(pick(2), "krank", d(-7), d(-5), "approved",
       { n: 3, reason: "发烧，去了医院", lead: 0 }),
    mk(pick(3), "krank", d(-25), d(-23), "approved",
       { n: 4, reason: "肠胃炎", lead: 0,
         au: { file: "AU_Praxis_Dr_Weber.pdf", until: d(-23), submittedAt: `${d(-24)}T11:05:00.000Z` } }),
    mk(pick(4), "unbezahlt", d(8), d(8), "approved",
       { n: 5, reason: "搬家，愿意不计薪", lead: 6, src: "manager" })
  ];
}

/* ============================================================== 页面 ===== */
function lvMonth() {
  const m = state().params.get("m") || "";
  return /^\d{4}-\d{2}$/.test(m) ? m : empToday().slice(0, 7);
}

function lvHref(patch) {
  return schHref({ v: "leave", ...patch });
}

function lvTypeTag(x) {
  return `<span class="lv-type is-${x.type}">${empText(lvType(x.type).name)}</span>`;
}

function lvRangeLabel(x) {
  return x.from === x.to ? empFormatDate(x.from) : `${empFormatDate(x.from)} – ${empFormatDate(x.to)}`;
}

function lvView(store) {
  const month = lvMonth();
  const year = month.slice(0, 4);
  const pend = lvOpen(store);
  const auBad = lvAuOpen(store);
  const staff = empStaff(store).filter(e => !empStatus(e.status).leaving)
    .sort((a, b) => a.name.localeCompare(b.name));
  const monthLeaves = lvOf(store).filter(x => x.state === "approved" && lvOverlapsMonth(x, month));
  const monthDays = monthLeaves.reduce((s, x) => s + lvDaysIn(x, month), 0);

  return `
    <section class="sch-weekbar">
      <div class="sch-weeknav">
        ${schStepper(
          lvHref({ m: schMonthAdd(month, -1), p: null, add: null }),
          lvHref({ m: schMonthAdd(month, 1), p: null, add: null }),
          schMonthName(month),
          empT(`${monthLeaves.length} 段休假 · 合计 ${lvD(monthDays)} 天`,
               `${monthLeaves.length} Abwesenheiten · ${lvD(monthDays)} Tage`),
          [empT("上一个月", "Vorheriger Monat"), empT("下一个月", "Nächster Monat")])}
        ${month === empToday().slice(0, 7) ? "" : `<a class="sch-jump" href="${lvHref({ m: empToday().slice(0, 7), p: null, add: null })}">${
          empT("回到本月", "Aktueller Monat")}</a>`}
      </div>
      <div class="sch-week-actions">
        ${/* 不在这儿再挂一个「x 条等你批」：「休假」标签上是这个数，
             下面「等你批」标题右边也是这个数。同一个数说三遍。 */""}
        <a class="ghost-btn" href="${lvHref({ add: state().params.get("add") ? null : "1", p: null })}">${
          state().params.get("add") ? empT("收起", "Schließen") : empT("代录一条休假", "Abwesenheit erfassen")}</a>
      </div>
    </section>

<!-- 原来这儿有一条四格摘要（待审批 / 本月休假天数 / 病假证明有问题 / 年假已用）。
         删了：待审批和病假证明下面各有一整块在说，本月天数月导航那一行就写着，
         年假已用是每个人自己的数、在下面那张表里按人列着。四个数没有一个是这里独有的。 -->


    ${lvAddPanel(store, staff)}
    ${lvAuPanel(store, auBad)}
    ${lvBalanceCard(store, staff, year, pend)}
    ${lvCalendarCard(store, month)}

    <p class="lv-note">${empT(
      `年假额度来自合同上的 Urlaubstage，入职和离职当年按整月 1/12 折算后向上取到半天 —— §5 Abs. 2 BUrlG 规定满半天的进位到整天，具体取整方式请按合同或行业协议核实。休假天数按班表数：排到的日子数实际排班，没排到的按这个人最近 13 周的每周上班天数折算。有薪假进计薪工时的口径是：已排班的日子照那天排的小时数付，没排班的按最近 13 周日均（§11 BUrlG）。`,
      `Der Urlaubsanspruch stammt aus den Vertrags-Urlaubstagen; im Ein- und Austrittsjahr anteilig nach vollen Monaten (1/12), aufgerundet auf halbe Tage — nach §5 Abs. 2 BUrlG sind mindestens halbe Tage aufzurunden, die genaue Rundung bitte nach Vertrag oder Tarif prüfen. Urlaubstage werden nach Dienstplan gezählt; für ungeplante Zeiträume nach den Arbeitstagen der letzten 13 Wochen. Bezahlte Abwesenheit fließt mit den geplanten Stunden bzw. dem 13-Wochen-Schnitt (§11 BUrlG) in die Abrechnung.`)}</p>`;
}

/* --------------------------------------------------- AU 与 6 周上限 ----- */
function lvAuPanel(store, list) {
  if (!list.length) return "";
  return `<section class="card wl-card lv-au">
    <div class="section-title">
      <div><h2>${empT("病假证明", "Krankmeldungen")}</h2>
      <p>${empT(`连续 ${lvAuAfter()} 天以上的病假要 AU（医生证明）。收到之后在这里登记，它像证件一样有到期日。`,
                `Ab ${lvAuAfter()} Tagen ist eine AU nötig. Hier erfassen — sie hat wie ein Dokument ein Ablaufdatum.`)}</p></div>
      <span class="wl-count">${empT(`${list.length} 条`, `${list.length}`)}</span>
    </div>
    <div class="wl-wrap">
      <table class="wl-table">
        <thead><tr>
          <th>${empT("哪几天", "Zeitraum")}</th><th>${empT("谁", "Wer")}</th>
          <th>${empT("缺什么", "Was fehlt")}</th><th></th>
        </tr></thead>
        <tbody>${list.map(({ x, issue }) => {
          const e = empById(x.empId);
          return `<tr>
            <td class="wl-when"><strong>${lvRangeLabel(x)}</strong></td>
            <td class="wl-who"><strong>${empEsc(e ? e.name : "")}</strong></td>
            <td class="wl-why">${empText({ zh: issue.zh, de: issue.de })}</td>
            <td class="wl-act">${issue.code === "krankengeld" ? "" : `<span class="lv-au-form">
              <input type="date" class="lv-au-until" data-id="${x.id}" value="${x.to}"
                aria-label="${empT("AU 开到哪天", "AU gültig bis")}">
              <button class="primary-btn lv-au-save" data-id="${x.id}">${empT("登记收到 AU", "AU erfassen")}</button>
            </span>`}</td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

/* ------------------------------------------------------------ 日历 ------ */
/* 「这个月谁不在」一眼看全。这是单开这一页最主要的理由 ——
   拆进周排班的话，跨周的休假永远要翻四次才看得全。 */
function lvMonthCells(store, month) {
  const first = `${month}-01`;
  const start = schWeekStart(schWeekOf(first));
  const last = empShiftDate(schMonthAdd(month, 1) + "-01", -1);
  const rows = Math.ceil((empDaysBetween(start, last) + 1) / 7);
  const approved = lvOf(store, null, "approved");
  const out = [];
  for (let i = 0; i < rows * 7; i += 1) {
    const date = empShiftDate(start, i);
    const on = approved.filter(x => x.from <= date && x.to >= date)
      .map(x => ({ x, e: empById(x.empId) }))
      .filter(r => r.e);
    out.push({ date, on, inMonth: date.slice(0, 7) === month });
  }
  return out;
}

function lvCalendarCard(store, month) {
  const cells = lvMonthCells(store, month);
  const head = [1, 2, 3, 4, 5, 6, 7].map(d => `<th>${schDowName(d)}</th>`).join("");
  const body = [];
  for (let i = 0; i < cells.length; i += 7) {
    body.push(`<tr>${cells.slice(i, i + 7).map(c => `
      <td class="lv-cell ${c.inMonth ? "" : "is-out"} ${c.date === empToday() ? "is-today" : ""}">
        <span class="lv-cell-day">${Number(c.date.slice(8))}</span>
        ${c.on.map(r => `<a class="lv-chip is-${r.x.type}" href="${lvHref({ p: null, add: null, m: month })}"
          title="${empEsc(r.e.name)} · ${empText(lvType(r.x.type).name)}">${empEsc(r.e.name.split(" ")[0])}</a>`).join("")}
      </td>`).join("")}</tr>`);
  }
  const used = [...new Set(cells.flatMap(c => c.on.map(r => r.x.type)))];
  /* 「这个月谁不在」有必要留着（Mingrong 问）：跨周的休假在周班表上永远要翻四次才看得全，
     这张月历是唯一一眼看完的地方。但它是**排下个月班的时候才看**的东西，
     一个月看一次 —— 所以默认收起，标题上就写着这个月有几个人不在、哪几天。 */
  const names = [...new Set(cells.filter(c => c.inMonth).flatMap(c => c.on.map(r => r.e.name)))];
  return `<details class="card lv-cal-card">
    <summary>
      <strong>${empT("这个月谁不在", "Abwesenheiten im Monat")}</strong>
      <span>${names.length
        ? empT(`${names.length} 人有假：${names.join("、")}`, `${names.length} abwesend: ${names.join(", ")}`)
        : empT("这个月没有人休假", "Diesen Monat keine Abwesenheiten")} · ${
        empT("只显示已批准的", "Nur genehmigte")}</span>
    </summary>
    <div class="lv-cal-wrap"><table class="lv-cal"><thead><tr>${head}</tr></thead><tbody>${body.join("")}</tbody></table></div>
    ${used.length ? `<div class="sch-legend">${used.map(t =>
      `<span><i class="lv-dot is-${t}"></i>${empText(lvType(t).name)}</span>`).join("")}</div>` : ""}
  </details>`;
}

/* ------------------------------------------------------------ 余额 ------ */
/* 「等你批」原来是单独一张卡（2026-09-03 Mingrong：跟年假余额表结合，待审批放在前几行）。
   合了：这张表本来就有「待批」那一列，等你批的那几个人只是需要排到最前面、
   并且在自己那一行上给一个动作。批之前要看的两件事（年假够不够、那几天有没有班）
   点开在行下面展开 —— 那是一段带输入框和两个按钮的面板，塞不进一格。 */
function lvBalanceCard(store, staff, year, pend) {
  const open = state().params.get("p") || "";
  const seen = state().params.get("seen") || "";
  const pending = pend || [];
  const byEmp = new Map();
  pending.forEach(x => { if (!byEmp.has(x.empId)) byEmp.set(x.empId, []); byEmp.get(x.empId).push(x); });
  const rows = staff.map(e => ({ e, b: lvBalance(store, e, year), reqs: byEmp.get(e.id) || [],
    krank: lvOf(store, e.id, "approved").filter(x => x.type === "krank")
      .reduce((s, x) => s + lvDaysIn(x, year), 0),
    unpaid: lvOf(store, e.id, "approved").filter(x => x.type === "unbezahlt")
      .reduce((s, x) => s + lvDaysIn(x, year), 0) }))
    .sort((a, b) => (b.reqs.length ? 1 : 0) - (a.reqs.length ? 1 : 0) || a.e.name.localeCompare(b.e.name));

  return `<section class="card wl-card">
    <div class="section-title">
      <div><h2>${empT(`${year} 年假`, `Urlaub ${year}`)}</h2>
      <p>${empT("等你批的排在最前面。额度从合同的 Urlaubstage 来，入职当年按整月折算，不是手填的 —— 点姓名去改合同。",
                "Offene Anträge stehen oben. Der Anspruch stammt aus dem Vertrag, im Eintrittsjahr anteilig — nicht manuell gepflegt.")}</p></div>
      ${pending.length ? `<span class="wl-count is-soft">${empT(`${pending.length} 条等你批`, `${pending.length} offen`)}</span>` : ""}
    </div>
    <div class="table-scroll"><table class="table employee-table lv-table">
      <thead><tr>
        <th>${empT("员工", "Mitarbeiter")}</th>
        <th title="${empT("合同里的 Urlaubstage，入职当年按整月折算", "Urlaubstage laut Vertrag, im Eintrittsjahr anteilig")}">${
          empT("全年年假额度", "Jahresanspruch")}</th>
        <th title="${empT("已经批准的年假天数", "Bereits genehmigte Urlaubstage")}">${empT("已批年假", "Genehmigt")}</th>
        <th title="${empT("已经申请、还等着你决定的年假天数", "Beantragt, noch nicht entschieden")}">${empT("待批年假", "Beantragt")}</th>
        <th title="${empT("额度减已批、再减待批之后还剩的天数", "Anspruch abzüglich genehmigter und beantragter Tage")}">${
          empT("可用余额", "Restanspruch")}</th>
        <th title="${empT("今年已登记的病假天数，不占年假额度", "Krankheitstage in diesem Jahr, nicht auf den Urlaub angerechnet")}">${
          empT("病假天数", "Krankheitstage")}</th>
        <th title="${empT("今年已批准的无薪假天数，不占年假额度也不发工资", "Genehmigte unbezahlte Tage — weder Urlaub noch Lohn")}">${
          empT("无薪假天数", "Unbezahlt")}</th>
        <th title="${empT("等着你批准或拒绝的申请，点开在下面那一行里决定", "Offene Anträge — Entscheidung in der aufklappenden Zeile")}">${
          empT("等你决定的申请", "Zu entscheiden")}</th>
      </tr></thead>
      <tbody>${rows.map(({ e, b, reqs, krank, unpaid }) => `<tr class="${reqs.length ? "is-open-req" : ""}">
        <td><a class="emp-name-link" href="${empStaffHref(e.id)}"><strong>${empEsc(e.name)}</strong></a>
          <small>${empText(empContractType(e.contract?.type).name)}</small></td>
        <td><strong>${lvD(b.days)}</strong>${b.partial
          ? `<small>${empT(`合同 ${b.base} 天，今年只算 ${b.months} 个月`, `${b.base} Tage/Jahr, anteilig ${b.months} Monate`)}</small>` : ""}</td>
        <td>${b.taken > 0.01 ? `<a class="lv-taken-link" href="${lvHref({ seen: seen === e.id ? null : e.id, p: null, add: null })}"
          >${lvD(b.taken)}</a>` : lvD(b.taken)}</td>
        <td>${b.pending ? `<span class="pill orange">${lvD(b.pending)}</span>` : "—"}</td>
        <td><strong class="${b.left < -0.01 ? "hrs-off" : ""}">${lvD(b.left)}</strong></td>
        <td>${krank ? `<span class="pill purple">${lvD(krank)}</span>` : "—"}</td>
        <td>${unpaid ? lvD(unpaid) : "—"}</td>
        <td class="lv-req-col">${reqs.length ? reqs.map(x => `<a class="${open === x.id ? "primary-btn" : "ghost-btn"}"
          href="${lvHref({ p: open === x.id ? null : x.id, add: null })}">${open === x.id
            ? empT("收起", "Schließen")
            : `${lvRangeLabel(x)} · ${empT(`${lvD(lvDaysIn(x, ""))} 天`, `${lvD(lvDaysIn(x, ""))} Tage`)}`}</a>`).join("")
          : `<span class="att-dim">—</span>`}</td>
      </tr>
      ${reqs.filter(x => x.id === open).map(x => `<tr class="wl-editrow"><td colspan="8">${
        lvDecidePanel(store, e, x, b)}</td></tr>`).join("")}
      ${seen === e.id ? `<tr class="wl-editrow"><td colspan="8">${lvTakenPanel(store, e, year)}</td></tr>` : ""}`).join("")}</tbody>
    </table></div>
  </section>`;
}

/* 批之前要看的两件事，加上批准 / 驳回。 */
/* 2026-09-04 复审：批过的假原来撤不回来。
   `lvCancel()` 早就写好了，`.lv-cancel` 的点击监听也早就绑着 ——
   可整个项目里没有一个地方渲染过那个按钮，等于一条一直没接上的线。
   于是店长手一抖批错了，或者员工的行程黄了，这一条就永远占着他今年的年假额度：
   这个模块里别的动作（撤销考勤决议、撤销账户存取、重开封账、撤掉工资单登记）
   全都有回头路，只有这里没有。

   出口按角色分：**批过的**只有店长能撤（那是已经影响到班表的决定），
   **还没批的**员工自己就能撤回（那还只是他自己的一句话）—— 后者在 me.js 里。 */
function lvTakenPanel(store, e, year) {
  const list = lvOf(store, e.id, "approved")
    .filter(x => lvDaysIn(x, year) > 0)
    .sort((a, b) => b.from.localeCompare(a.from));
  if (!list.length) {
    return `<p class="lv-taken-empty">${empT(`${year} 年还没有批过的假。`, `Keine genehmigten Abwesenheiten ${year}.`)}</p>`;
  }
  return `<div class="lv-taken">
    <p class="lv-taken-head">${empT(`${e.name} 在 ${year} 年批过的假`, `Genehmigte Abwesenheiten ${year} · ${e.name}`)}</p>
    ${list.map(x => `<div class="lv-taken-row">
      <span>${lvTypeTag(x)} <strong>${lvRangeLabel(x)}</strong>
        <i>${empT(`${lvD(lvDaysIn(x, year))} 天`, `${lvD(lvDaysIn(x, year))} Tage`)}</i></span>
      <i class="lv-taken-why" data-user-text>${empEsc(x.decideNote || x.reason || "")}</i>
      <span class="lv-taken-act">
        <input class="lv-note-in" data-id="${x.id}" placeholder="${
          empT("撤销的理由（会记进这条假的经过）", "Grund der Rücknahme")}">
        <button class="ghost-btn danger-lite lv-cancel" data-id="${x.id}">${
          empT("撤销这次批准", "Genehmigung zurücknehmen")}</button>
      </span>
    </div>`).join("")}
    <p class="lv-taken-note">${empT(
      "撤销之后这几天的额度立刻还回去；已经按这个假改过的班表不会自动变回来，那几天要重新排。",
      "Nach der Rücknahme steht der Anspruch sofort wieder zur Verfügung; der Dienstplan wird nicht automatisch zurückgesetzt.")}</p>
  </div>`;
}

function lvDecidePanel(store, e, x, bal) {
  const over = lvType(x.type).quota && bal.left < -0.01;
  const clash = lvShiftClash(store, x.empId, x.from, x.to);
  return `<div class="lv-decide">
    <p class="lv-req-head">${lvTypeTag(x)} <strong>${lvRangeLabel(x)}</strong>
      <span>${empT(`${lvD(lvDaysIn(x, ""))} 天`, `${lvD(lvDaysIn(x, ""))} Tage`)}</span>
      <i data-user-text>${empEsc(x.reason) || empT("没写理由", "Ohne Begründung")}</i></p>
    <div class="lv-facts">
      ${lvType(x.type).quota ? `<span class="${over ? "is-bad" : ""}">${empT(
        `${x.from.slice(0, 4)} 年假：额度 ${lvD(bal.days)} 天，已批 ${lvD(bal.taken)} 天，含这一条待批 ${lvD(bal.pending)} 天 → ${over ? `超了 ${lvD(-bal.left)} 天` : `批完还剩 ${lvD(bal.left)} 天`}`,
        `Urlaub ${x.from.slice(0, 4)}: ${lvD(bal.days)} Tage Anspruch, ${lvD(bal.taken)} genehmigt, ${lvD(bal.pending)} beantragt → ${over ? `${lvD(-bal.left)} Tage zu viel` : `${lvD(bal.left)} Tage übrig`}`)}</span>`
        : `<span>${empText(lvType(x.type).note)}</span>`}
      ${clash.length ? `<span class="is-bad">${empT(
        `这几天他已经排了 ${clash.length} 个班（${clash.map(c => `${c.date.slice(5)} ${c.start}–${c.end}`).join("、")}）—— 批了要找人顶，排班页会标红`,
        `Für diese Tage sind ${clash.length} Schichten geplant — nach der Freigabe im Dienstplan markiert`)} <a href="${schHref({ v: null, m: null, w: schWeekOf(x.from) })}">${empT("去排班 →", "Zum Plan →")}</a></span>`
        : `<span>${empT("那几天他本来就没有班，批了不影响现在的班表", "Für diese Tage sind keine Schichten geplant")}</span>`}
    </div>
    <input class="lv-note-in" data-id="${x.id}" placeholder="${over
      ? empT("超额了，批的话必须写清楚为什么（例如：预支明年的）", "Über dem Anspruch — Begründung erforderlich")
      : empT("给员工的一句话（可不填）", "Kurze Rückmeldung (optional)")}">
    <div class="lv-acts">
      <button class="primary-btn lv-ok" data-id="${x.id}" data-over="${over ? "1" : ""}">${empT("批准", "Genehmigen")}</button>
      <button class="ghost-btn danger-lite lv-no" data-id="${x.id}">${empT("驳回（要写理由）", "Ablehnen (mit Begründung)")}</button>
    </div>
  </div>`;
}

/* ---------------------------------------------------------- 代录 -------- */
/* 员工没手机、或者是店长直接口头准的假，也得有个录入口 ——
   但要标明是店长录的，跟员工自己提交的分得清。 */
function lvAddPanel(store, staff) {
  if (state().params.get("add") !== "1") return "";
  const t = empToday();
  return `<section class="card lv-add">
    <div class="section-title"><div><h2>${empT("代录一条休假", "Abwesenheit erfassen")}</h2>
      <p>${empT("店长录的直接生效，不再走审批 —— 你就是审批人。记录上会标明是你录的。",
                "Von der Leitung erfasste Einträge gelten sofort und sind als solche gekennzeichnet.")}</p></div></div>
    <div class="lv-add-grid">
      <label>${empT("员工", "Mitarbeiter")}<select class="lv-add-emp">${staff.map(e =>
        `<option value="${e.id}">${empEsc(e.name)}</option>`).join("")}</select></label>
      <label>${empT("类型", "Art")}<select class="lv-add-type">${LV_TYPES.map(x =>
        `<option value="${x.id}">${empText(x.name)}</option>`).join("")}</select></label>
      <label>${empT("从", "Von")}<input type="date" class="lv-add-from" value="${t}"></label>
      <label>${empT("到", "Bis")}<input type="date" class="lv-add-to" value="${t}"></label>
      <label class="lv-add-why">${empT("理由", "Grund")}<input class="lv-add-reason" placeholder="${
        empT("例如：口头请的年假，本人不用手机", "z. B. mündlich vereinbart")}"></label>
    </div>
    <div class="lv-acts"><button class="primary-btn lv-add-save">${empT("录入并生效", "Erfassen")}</button></div>
  </section>`;
}

/* ============================================================== 绑定 ===== */
function lvBindAll() {
  const store = typeof schStore === "function" ? schStore() : empStores()[0];

  document.querySelectorAll(".lv-ok").forEach(b => b.addEventListener("click", () => {
    const note = document.querySelector(`.lv-note-in[data-id="${b.dataset.id}"]`)?.value || "";
    /* 超额还要批是可以的（预支明年、合同外的约定都真实存在），
       但必须写清楚为什么 —— 跟排班「强行发布要写理由」同一条规矩。 */
    if (b.dataset.over && !note.trim()) {
      empFlash(b, empT("超额了，先写一句为什么能批", "Über dem Anspruch — bitte begründen"));
      return;
    }
    lvDecide(b.dataset.id, "approved", note, "Martin");
    schGo(lvHref({ p: null }));
  }));

  document.querySelectorAll(".lv-no").forEach(b => b.addEventListener("click", () => {
    const note = document.querySelector(`.lv-note-in[data-id="${b.dataset.id}"]`)?.value || "";
    if (!note.trim()) {
      empFlash(b, empT("驳回要给一句理由，员工那边看得到", "Ablehnung bitte begründen"));
      return;
    }
    lvDecide(b.dataset.id, "rejected", note, "Martin");
    schGo(lvHref({ p: null }));
  }));

  document.querySelectorAll(".lv-au-save").forEach(b => b.addEventListener("click", () => {
    const until = document.querySelector(`.lv-au-until[data-id="${b.dataset.id}"]`)?.value || "";
    lvSetAu(b.dataset.id, "", until, "Martin");
    app();
  }));

  document.querySelectorAll(".lv-add-save").forEach(b => b.addEventListener("click", () => {
    const pick = c => document.querySelector(`.${c}`)?.value || "";
    const r = lvSubmit(store, pick("lv-add-emp"), pick("lv-add-type"),
      pick("lv-add-from"), pick("lv-add-to"), pick("lv-add-reason"), { src: "manager", by: "Martin" });
    if (!r.ok) {
      empFlash(b, r.code === "overlap"
        ? empT(`这段时间他已经有一条${empRaw(lvType(r.clash.type).name.zh)}了`, "Zeitraum überschneidet sich")
        : r.code === "dates" ? empT("日期填反了或者没填全", "Datum prüfen")
        : empT("这条录不进去", "Nicht möglich"));
      return;
    }
    schGo(lvHref({ add: null, m: r.x.from.slice(0, 7) }));
  }));

  document.querySelectorAll(".lv-cancel").forEach(b => b.addEventListener("click", () => {
    lvCancel(b.dataset.id, "Martin", document.querySelector(`.lv-note-in[data-id="${b.dataset.id}"]`)?.value || "");
    app();
  }));
}
