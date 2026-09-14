/* ==========================================================================
   KaiSpan · 排班 Dienstplan
   --------------------------------------------------------------------------
   在 employee.js 之后、app.js 之前以 defer 加载。
   依赖 employee.js：empRead/empWrite/empToday/empShiftDate/empDaysBetween/
                    empRule/empStaff/empById/empRole/empLevel/empContractType/
                    empDocState/empDocType/empStores/empScope/empT/empEsc/empText
   依赖 app.js：slug()/state()/stores

   这个模块回答三件纸质班表回答不了的事：
     1. 这个人今天能不能排 —— 证件过期、还没入职、单日超 10h，硬拦，不许排进去。
     2. 这样排会花多少代价 —— Minijob 超月薪上限、Werkstudent 超周工时、
        两班间隔不足、跟他报的班对不上，红字警告，可强行发布但要写理由。
     3. 排不满的位置为什么排不满 —— 逐个候选人给出被排除的原因，不是一句「人手不足」。
   ========================================================================== */

const SCH_ROSTER_KEY = "kaispanSchRosters";   /* { "门店|2026-W36": roster } */
const SCH_DEMAND_KEY = "kaispanSchDemand";    /* { 门店: [rule] } */
const SCH_AVAIL_KEY = "kaispanSchAvailability"; /* { "员工|周": {days, submittedAt, by} } */
const SCH_INVITE_KEY = "kaispanSchInvitations"; /* { "员工|周": {token,deadline,openedAt,…} } */

/* ============================================================== 周与时间 === */
/* 全站按 ISO 周（周一起算）。周键形如 2026-W36。 */
function schFmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ISO 周号：以「该周的周四落在哪一年」定年份，跨年周不会算错。 */
function schWeekOf(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);   /* 挪到该周周四 */
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const firstThu = new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7) + 3);
  const week = 1 + Math.round((d - firstThu) / 604800000);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function schWeekStart(week) {
  const [y, w] = String(week).split("-W");
  const year = Number(y), num = Number(w);
  if (!year || !num) return schWeekStart(schWeekOf(empToday()));
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(year, 0, 4 - ((jan4.getDay() + 6) % 7));
  monday.setDate(monday.getDate() + (num - 1) * 7);
  return schFmt(monday);
}

function schWeekDays(week) {
  const start = schWeekStart(week);
  return [0, 1, 2, 3, 4, 5, 6].map(n => empShiftDate(start, n));
}

function schWeekAdd(week, n) {
  return schWeekOf(empShiftDate(schWeekStart(week), n * 7));
}

function schThisWeek() {
  return schWeekOf(empToday());
}

/* ISO 星期几：周一=1 … 周日=7。岗位需求规则按这个存。 */
function schDow(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return ((d.getDay() + 6) % 7) + 1;
}

const SCH_DOW_NAMES = [
  null,
  { zh: "周一", de: "Mo" }, { zh: "周二", de: "Di" }, { zh: "周三", de: "Mi" },
  { zh: "周四", de: "Do" }, { zh: "周五", de: "Fr" }, { zh: "周六", de: "Sa" },
  { zh: "周日", de: "So" }
];

function schDowName(n) {
  return empText(SCH_DOW_NAMES[n] || "");
}

/* 日期段单独拿出来：工具栏第一行读的是「哪几天」，周号是第二行的小字。 */
function schWeekRange(week) {
  const days = schWeekDays(week);
  const short = t => t.slice(5).replace("-", ".");
  return `${short(days[0])} – ${short(days[6])}`;
}


/* "08:30" → 510。非法值回落到 0，避免 NaN 顺着算式扩散。 */
function schMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return 0;
  return Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2]));
}

function schHHMM(min) {
  const v = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

/* 跨夜班（17:00–01:00）在餐饮里是常态。结束 <= 开始就当作到了第二天，
   这样时长、两班间隔、重叠判定全都能用同一套绝对分钟数算。 */
function schEndMin(start, end) {
  const s = schMin(start), e = schMin(end);
  return e <= s ? e + 1440 : e;
}

function schSpan(shift) {
  return schEndMin(shift.start, shift.end) - schMin(shift.start);
}

/* 法定休息时间不让人手填 —— 班次一长它自己就出来了（标准 3）。
   超过 9 小时 45 分钟、超过 6 小时 30 分钟，阈值读合规设置。 */
function schBreakFor(spanMin) {
  if (spanMin > 9 * 60) return Number(empRule("breakAfter9h")) || 0;
  if (spanMin > 6 * 60) return Number(empRule("breakAfter6h")) || 0;
  return 0;
}

/* 一个班次的 { 在店时长, 休息, 净工时 }，单位小时。计薪和工时上限都按净工时。 */
function schHours(shift) {
  const span = schSpan(shift);
  const brk = schBreakFor(span);
  return { span: span / 60, brk, net: Math.max(0, span - brk) / 60 };
}

function schH(n) {
  const v = Math.round(n * 100) / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(/0$/, "")}h`;
}




/* ==================================================== 岗位需求规则（可配） ===
   { id, role, days:[1..7], start, end, count, level }
   level = 这个位置最低要什么级别（lead > skilled > basic）。 */
const SCH_DEMAND_SEED = {
  "Martin Biergarten": [
    { id: "d1", role: "manager", days: [1, 2, 3, 4, 5, 6, 7], start: "10:00", end: "18:00", count: 1, level: "lead" },
    { id: "d2", role: "kitchen", days: [1, 2, 3, 4, 5, 6, 7], start: "11:00", end: "14:30", count: 1, level: "skilled" },
    /* 晚市平日一个厨子够，周四到周日才要两个 —— 一开始七天都写 2 人，
       而这家店能上灶的只有三个人（其中一个证件过期），结果整月都在报缺口，
       缺口数大到没人会去看。需求配错了，缺口清单就没有信息量。 */
    { id: "d3", role: "kitchen", days: [1, 2, 3], start: "17:00", end: "22:00", count: 1, level: "skilled" },
    { id: "d4", role: "kitchen", days: [4, 5, 6, 7], start: "17:00", end: "22:00", count: 2, level: "skilled" },
    { id: "d5", role: "front", days: [1, 2, 3, 4, 5, 6, 7], start: "11:00", end: "15:00", count: 2, level: "basic" },
    { id: "d6", role: "front", days: [4, 5, 6, 7], start: "17:00", end: "23:00", count: 2, level: "basic" }
  ],
  "Martin Biergarten 2": [
    { id: "d1", role: "bar", days: [1, 2, 3, 4, 5, 6, 7], start: "16:00", end: "23:00", count: 1, level: "basic" },
    { id: "d2", role: "bar", days: [6, 7], start: "12:00", end: "16:00", count: 1, level: "skilled" }
  ],
  "Martin Cafe": [
    { id: "d1", role: "manager", days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", count: 1, level: "lead" },
    { id: "d2", role: "front", days: [1, 2, 3, 4, 5, 6, 7], start: "08:00", end: "14:00", count: 1, level: "basic" },
    { id: "d3", role: "clean", days: [1, 2, 3, 4, 5, 6, 7], start: "07:00", end: "09:00", count: 1, level: "basic" }
  ]
};

/* 没有预置需求的门店（将来新开的）：按这家店实际有的岗位生成一条兜底规则，
   总比给一张空表或者一堆永远排不满的假需求强。 */
function schDemandFallback(store) {
  const roles = [...new Set(empStaff(store).map(e => e.role))];
  return roles.map((role, i) => ({
    id: `d${i + 1}`, role, days: [1, 2, 3, 4, 5, 6, 7],
    start: "11:00", end: "18:00", count: 1, level: "basic"
  }));
}

function schDemand(store) {
  const all = empRead(SCH_DEMAND_KEY, null) || {};
  if (all[store]) return all[store].map(r => ({ ...r }));
  return (SCH_DEMAND_SEED[store] || schDemandFallback(store)).map(r => ({ ...r }));
}

function schSaveDemand(store, list) {
  const all = { ...(empRead(SCH_DEMAND_KEY, null) || {}) };
  all[store] = list;
  empWrite(SCH_DEMAND_KEY, all);
  return list;
}

function schDemandFor(store, date) {
  const dow = schDow(date);
  return schDemand(store).filter(r => (r.days || []).includes(dow));
}

/* ========================================================== 员工报班 ====
   餐厅里「报班」不是员工排班：兼职员工报自己能来的时间，全职员工只报例外；
   最终班次仍由 AI 生成、店长审核。经理端没有代填入口，避免责任混淆。 */
function schAvailKey(empId, week) { return `${empId}|${week}`; }
function schAvailAll() { return empRead(SCH_AVAIL_KEY, null) || {}; }
function schNeedsAvailability(e) { return empContractType(e?.contract?.type).id !== "vollzeit"; }

function schSeedAvailability(e, week) {
  if (!e || !schNeedsAvailability(e) || week > schWeekAdd(schThisWeek(), 1)) return null;
  /* 留两个未提交样本，让经理端能看懂「等员工 → 再让 AI 排」的状态。 */
  if (["e08", "e10"].includes(e.id) && week >= schThisWeek()) return null;
  const days = {};
  schWeekDays(week).forEach(date => {
    const rule = schDemandFor(e.store, date).find(r => r.role === e.role);
    days[date] = rule
      ? { mode: "free", start: rule.start, end: rule.end }
      : { mode: "free", start: "10:00", end: "20:00" };
  });
  return { empId: e.id, week, days, by: "employee", submittedAt: `${schWeekStart(week)}T09:00` };
}

function schAvail(empId, week) {
  const hit = schAvailAll()[schAvailKey(empId, week)];
  if (hit) return JSON.parse(JSON.stringify(hit));
  return schSeedAvailability(empById(empId), week);
}

function schSaveAvail(empId, week, days) {
  const all = { ...schAvailAll() };
  all[schAvailKey(empId, week)] = {
    empId, week, days, by: "employee", submittedAt: new Date().toISOString()
  };
  empWrite(SCH_AVAIL_KEY, all);
  return all[schAvailKey(empId, week)];
}


function schAvailabilityIssue(e, shift) {
  const rec = schAvail(e.id, schWeekOf(shift.date));
  if (!rec) return schNeedsAvailability(e)
    ? { zh: "员工这周还没报可上时间", de: "Verfügbarkeit für diese Woche fehlt" }
    : null;
  const day = rec.days?.[shift.date];
  if (!day || day.mode === "off") {
    return { zh: "员工报的是这天不能上班", de: "Mitarbeiter hat diesen Tag als nicht verfügbar gemeldet" };
  }
  const from = schMin(day.start), to = schEndMin(day.start, day.end);
  const shiftFrom = schMin(shift.start), shiftTo = schEndMin(shift.start, shift.end);
  if (shiftFrom < from || shiftTo > to) {
    return { zh: `员工报的是 ${day.start}–${day.end} 可上`, de: `Gemeldete Verfügbarkeit: ${day.start}–${day.end}` };
  }
  return null;
}

/* 报班不再发链接（2026-09-03 Mingrong）：员工有自己的账号和 App，
   下周该报班这件事在他那边每周自己出现，店长不用给每个人生成一条专属 token 链接
   ——「复制专属链接 / 用 Email 发送」那一套是没有员工端时的权宜之计，现在是多余的一步。
   这里只留两样东西：这一周的截止时间（算出来的，不存），和「店长提醒过谁」。 */
function schInviteKey(empId, week) { return `${empId}|${week}`; }
function schInviteAll() { return empRead(SCH_INVITE_KEY, null) || {}; }
/* 截止时间：那一周开始前 4 天的 18:00（周四晚），算出来就行，不必每人存一份 */
function schInviteDeadline(week) { return `${empShiftDate(schWeekStart(week), -4)}T18:00`; }
function schInvite(empId, week) { return schInviteAll()[schInviteKey(empId, week)] || null; }

function schUpdateInvite(empId, week, patch) {
  const all = { ...schInviteAll() };
  const key = schInviteKey(empId, week);
  const e = empById(empId);
  all[key] = { empId, store: e ? e.store : "", week, reminders: [], ...(all[key] || {}), ...patch };
  empWrite(SCH_INVITE_KEY, all);
  return all[key];
}

/* 提醒一个人报班：推到他的员工端（跟补件材料同一个道理，不发邮件也不发链接）。
   已经报过的人不提醒 —— 提醒一个已经办完的人，是这套系统最容易犯的蠢。 */
function schRemindAvailability(empId, week) {
  if (schAvail(empId, week)) return null;
  const prev = schInvite(empId, week);
  return schUpdateInvite(empId, week, {
    reminders: [...((prev && prev.reminders) || []), { at: new Date().toISOString() }]
  });
}

/* 员工回执（确认收到 / 反馈班次冲突）整套删了 —— 见下面周视图里那段说明。 */

/* ============================================================== 班表 ======
   roster = { store, week, state:"draft"|"published", shifts:[…],
              publishedAt, overrides:[{code, empId, reason, at}], log:[…] }
   shift  = { id, empId, date, start, end, role, src:"ai"|"manual"|"copy" } */
/* 种子生成的两个把手：schSeeding 防递归，schSeedCache 存算好的周。
   声明放在这里是因为 schMonthNet 也要读缓存（见那里的注释）。 */
let schSeeding = false;
const schSeedCache = {};

function schRosterKey(store, week) {
  return `${store}|${week}`;
}

function schRosterAll() {
  return empRead(SCH_ROSTER_KEY, null) || {};
}

function schBlank(store, week) {
  return { store, week, state: "draft", shifts: [], publishedAt: null, rev: 0, overrides: [], log: [] };
}

function schRoster(store, week) {
  const all = schRosterAll();
  const hit = all[schRosterKey(store, week)];
  if (hit) return JSON.parse(JSON.stringify(hit));
  const seeded = schSeedRoster(store, week);
  if (seeded) return schSaveRoster(seeded);
  return schBlank(store, week);
}

/* 存在磁盘上的才算「排过」。空白周不写盘，翻到 2027 年不会凭空产生一堆空班表。 */
function schRosterExists(store, week) {
  return !!schRosterAll()[schRosterKey(store, week)] || !!schSeedRoster(store, week);
}

function schSaveRoster(roster) {
  const all = { ...schRosterAll() };
  all[schRosterKey(roster.store, roster.week)] = roster;
  empWrite(SCH_ROSTER_KEY, all);
  return roster;
}

function schShiftId(roster) {
  let n = roster.shifts.length + 1;
  while (roster.shifts.some(s => s.id === `s${n}`)) n += 1;
  return `s${n}`;
}

/* 种子：上周和本周各排一份并发布，下周故意留空 ——
   打开页面第一眼是一张排好的表，往后翻一周就是「还没排」，
   正好是「AI 自动排班」这个动作要解决的场景。

   种子是用自动排班算出来的，而自动排班里的 Minijob 月薪校验又要读别的周的班表 ——
   不设防就是无限递归。所以：生成中不再生成第二份种子（schSeeding），
   算完缓存起来（schSeedCache），并且先补更早的那一周，让月度累计每次都算出同一个数。 */
/* 铺几周历史。月视图翻到上个月要看得见东西，只铺两周的话上个月是空的 ——
   「历史班表」这条需求就等于没接上。 */
function schSeedWeeks() {
  const t = schThisWeek();
  return [-5, -4, -3, -2, -1, 0].map(n => schWeekAdd(t, n));
}

function schSeedRoster(store, week) {
  const weeks = schSeedWeeks();
  const idx = weeks.indexOf(week);
  if (idx < 0) return null;
  const key = schRosterKey(store, week);
  if (schSeedCache[key]) return JSON.parse(JSON.stringify(schSeedCache[key]));
  if (schSeeding) return null;
  if (idx > 0) schSeedRoster(store, weeks[idx - 1]);
  let filled;
  schSeeding = true;
  try {
    /* 第一周用排班算法算，后面几周复制上一周再补缺口 ——
       既快（复制是 O(n)，补缺口在几乎排满的表上没什么可做），也更像真实门店的做法：
       一份用顺手的班表反复用，只在有人请假、有人新来的时候动几笔。 */
    const prevKey = idx > 0 ? schRosterKey(store, weeks[idx - 1]) : null;
    const prev = prevKey ? schSeedCache[prevKey] : null;
    let base = prev ? schCopyFrom(schBlank(store, week), prev) : schBlank(store, week);
    /* 复制上一周会把班原样搬过来，而这一周可能有人还没入职、有人证件到期了。
       种子出来的是已发布的班表，不该带着一屏警告，所以先把这两类剔掉，
       剩下的缺口交给自动排班补。
       注意这只是种子的做法：店长手点「复制上一周」时不做这个剔除，
       那种情况下他需要看见问题，而不是被系统悄悄删掉几个班。 */
    base.shifts = base.shifts.filter(sh => {
      const e = empById(sh.empId);
      /* ⚠️ 报班这一关一定要过：Noah 上周报了、本周故意种成没报，
         复制那一步不剔的话，他 4 个班原样搬进本周，然后系统对着自己排的班
         报 4 次「员工这周还没报可上时间」—— 种子自己造出一屏警告。 */
      return e && !schEmployedIssue(e, sh.date) && !schDocIssue(e, sh.date)
        && !schAvailabilityIssue(e, sh);
    });
    filled = schAutoFill(base, { src: "ai" });
    filled.state = "published";
    filled.publishedAt = `${schWeekStart(week)}T18:30`;
    filled.rev = 1;
    filled.log = [{ at: `${schWeekStart(week)}T18:30`, what: { zh: "自动生成并发布", de: "Automatisch erstellt und freigegeben" } }];
  } finally {
    schSeeding = false;
  }
  schSeedCache[key] = filled;
  return JSON.parse(JSON.stringify(filled));
}

/* ---------------------------------------------------------------- 取数 --- */
function schShiftsOf(roster, empId, date) {
  return roster.shifts
    .filter(s => s.empId === empId && (!date || s.date === date))
    .sort((a, b) => schMin(a.start) - schMin(b.start));
}

function schDayNet(roster, empId, date) {
  return schShiftsOf(roster, empId, date).reduce((sum, s) => sum + schHours(s).net, 0);
}

function schWeekNet(roster, empId) {
  return roster.shifts.filter(s => s.empId === empId).reduce((sum, s) => sum + schHours(s).net, 0);
}

/* 月度净工时：跨周表累加。Minijob 的月薪上限只有按月看才有意义，
   而一个月总是横跨五个周表 —— 只看本周永远发现不了超限。 */
/* upto：只算到这一天为止（含）。工时页面用它做「截止今天」的口径 ——
   9 月 3 号看这个月，4 号到 6 号已经排上的班还没上，不该算进「该付多少小时」。 */
function schMonthNet(store, empId, date, draft, upto) {
  const month = String(date).slice(0, 7);
  const last = empShiftDate(`${schMonthAdd(month, 1)}-01`, -1);
  return schRangeNet(store, empId, `${month}-01`, upto && upto < last ? upto : last, draft);
}

/* 任意区间的已排净工时。工时页面的日 / 周 / 月三个视图算的是同一条链，
   只是区间不同 —— 所以底下只留一个按区间算的函数，月份那个只是它的一层壳。 */
function schRangeNet(store, empId, from, to, draft) {
  const all = schRosterAll();
  const seen = new Set();
  let sum = 0;
  const add = roster => {
    if (!roster) return;
    roster.shifts.forEach(s => {
      if (s.empId === empId && String(s.date) >= from && String(s.date) <= to
          && !seen.has(`${roster.week}|${s.id}`)) {
        seen.add(`${roster.week}|${s.id}`);
        sum += schHours(s).net;
      }
    });
  };
  /* 手上正在改的那一份优先于磁盘上的同一周，否则会拿旧数据算 */
  if (draft) add(draft);
  Object.keys(all).forEach(key => {
    const [s, w] = key.split("|");
    if (s !== store) return;
    if (draft && w === draft.week) return;
    add(all[key]);
  });
  /* 种子周还没落盘时也要算进去。
     ⚠️ 先查种子缓存再调 schSeedRoster：生成种子的过程中 schSeeding 是 true，
     那时 schSeedRoster 一律返回 null，前面几周就白算了 ——
     结果是排第三周时看不见前两周的工时，合同上限那道闸拦不住，
     种子出来的班表自己带着一屏「超合同月工时」。 */
  schSeedWeeks().forEach(w => {
    const key = schRosterKey(store, w);
    if (all[key]) return;
    if (draft && w === draft.week) return;
    add(schSeedCache[key] || schSeedRoster(store, w));
  });
  return sum;
}

/* ============================================================ 人工成本 ====
   老板天天盯的就是这个数，而纸质班表上算不出来 —— 排的时候看不见成本，
   等工资出来才发现周末排多了，已经晚了一个月。
   口径写在界面上：时薪 × 计薪工时，不含社保和雇主附加成本。
   Pauschal（固定月薪）的人按合同工时区间中位数折算一个等效时薪，
   否则一个拿固定薪的店长在班表上会显示成零成本。 */
function schRate(e) {
  const c = e.contract || {};
  const rate = Number(c.rate) || 0;
  if (c.payType !== "pauschal") return { rate, exact: true };
  const mid = ((Number(c.hoursMin) || 0) + (Number(c.hoursMax) || 0)) / 2;
  return { rate: mid > 0 ? rate / mid : 0, exact: false };
}

function schShiftCost(shift) {
  const e = empById(shift.empId);
  if (!e) return 0;
  return schHours(shift).net * schRate(e).rate;
}

function schDayCost(roster, date) {
  return roster.shifts.filter(s => s.date === date)
    .reduce((sum, s) => sum + schShiftCost(s), 0);
}

function schWeekCost(roster) {
  return roster.shifts.reduce((sum, s) => sum + schShiftCost(s), 0);
}

function schEuro(n) {
  return `€${Math.round(n).toLocaleString(empDe() ? "de-DE" : "en-US")}`;
}

/* 合同月工时区间的中位数，折成周。自动排班拿它做公平度基准。 */
function schWeeklyTarget(e) {
  const c = e.contract || {};
  const mid = ((Number(c.hoursMin) || 0) + (Number(c.hoursMax) || 0)) / 2;
  return mid / 4.33;
}

/* =========================================================== 合规校验 =====
   分级按 Mingrong 2026-09-02 的拍板：违法的硬拦，成本类的软警告。
   阈值一律读 empRule()，不在这里写死任何法规数字（D15）。

   block  证件过期/缺失还在岗、不在职期内、单日净工时超上限、同一天两班重叠
   warn   Minijob 月薪估算超上限、Werkstudent 周工时超上限、
          两班间隔不足、与报班冲突、月工时超合同上限
   ========================================================================== */
const SCH_CODES = {
  doc: { level: "block", name: { zh: "证件", de: "Dokument" } },
  leave: { level: "block", name: { zh: "已批休假", de: "Genehmigte Abwesenheit" } },
  employed: { level: "block", name: { zh: "不在职", de: "Nicht beschäftigt" } },
  daily: { level: "block", name: { zh: "单日工时", de: "Tageshöchstzeit" } },
  overlap: { level: "block", name: { zh: "班次重叠", de: "Überschneidung" } },
  /* 一周七天连上是违法的（ArbZG 有周日休息的规定），所以是硬拦；
     少于合同/设置给的休息天数是软警告 —— 同一件事的两个档，不会同时报。 */
  noday: { level: "block", name: { zh: "整周没休息", de: "Kein Ruhetag" } },
  minijob: { level: "warn", name: { zh: "Minijob 上限", de: "Minijob-Grenze" } },
  werkstudent: { level: "warn", name: { zh: "Werkstudent 周工时", de: "Werkstudent-Wochenstunden" } },
  rest: { level: "warn", name: { zh: "两班间隔", de: "Ruhezeit" } },
  daysoff: { level: "warn", name: { zh: "休息天数", de: "Ruhetage" } },
  avail: { level: "warn", name: { zh: "报班冲突", de: "Verfügbarkeit" } },
  contract: { level: "warn", name: { zh: "合同工时", de: "Vertragsstunden" } }
};

function schIssue(code, e, date, zh, de) {
  return { code, level: SCH_CODES[code].level, empId: e.id, name: e.name, date: date || null,
           title: SCH_CODES[code].name, detail: { zh, de } };
}

/* 那一天他有没有一份有效的必需证件。跟档案页同一套判定（empDocState），
   区别是按班次那天算，不是按今天算 —— 下周三到期的证件，下周四的班就是违法的。 */
function schDocIssue(e, date) {
  const bad = EMP_DOC_TYPES
    .map(t => ({ t, s: empDocState(e, t.id, date) }))
    .filter(x => x.s.level === "expired" || (x.s.level === "missing" && x.t.expiry));
  if (!bad.length) return null;
  const x = bad[0];
  const name = empRaw(x.t.name);
  return x.s.level === "expired"
    ? { doc: name, zh: `${name}在 ${empFormatDate(e.docs[x.t.id].expiry)} 到期，这天已经无效`,
        de: `${name} läuft am ${empFormatDate(e.docs[x.t.id].expiry)} ab und ist an diesem Tag ungültig` }
    : { doc: name, zh: `${name}还没上传`, de: `${name} fehlt` };
}

/* 在职区间：入职之前、离职之后、还在邀请中，都不能排。 */
function schEmployedIssue(e, date) {
  if (e.status === "invited") return { zh: "还在入职流程里，没上工", de: "noch im Onboarding" };
  if (e.entryDate && date < e.entryDate) return { zh: `${empFormatDate(e.entryDate)} 才入职`, de: `Eintritt erst am ${empFormatDate(e.entryDate)}` };
  const last = e.leave && e.leave.lastDay;
  if (last && date > last) return { zh: `${empFormatDate(last)} 已离职`, de: `seit ${empFormatDate(last)} ausgeschieden` };
  return null;
}


/* 绝对分钟数，用来算两班间隔和重叠。基准随便取一天，只比较差值。 */
function schAbs(shift) {
  const base = empDaysBetween("2020-01-01", shift.date) * 1440;
  return { from: base + schMin(shift.start), to: base + schEndMin(shift.start, shift.end) };
}

/* 整张班表跑一遍。返回按人按日展开的问题清单。 */
function schCheck(roster) {
  const out = [];
  const ids = [...new Set(roster.shifts.map(s => s.empId))];
  ids.forEach(id => {
    const e = empById(id);
    if (!e) return;
    const mine = roster.shifts.filter(s => s.empId === id)
      .sort((a, b) => schAbs(a).from - schAbs(b).from);
    const dates = [...new Set(mine.map(s => s.date))];

    mine.forEach(shift => {
      const avail = schAvailabilityIssue(e, shift);
      if (avail) out.push(schIssue("avail", e, shift.date, avail.zh, avail.de));
    });

    /* --- 逐日：证件 / 在职 / 单日上限 / 重叠 --- */
    dates.forEach(date => {
      /* 批了假的人那天不在。只拦今天起的班 —— 过去那几天已经用考勤结掉了，
         把历史周表刷成一屏红没有任何用，反而把真正要处理的盖住。 */
      const lv = typeof lvOn === "function" && date >= empToday() ? lvOn(roster.store, id, date) : null;
      if (lv) {
        out.push(schIssue("leave", e, date,
          `${empRaw(lvType(lv.type).name.zh)}已经批了（${empFormatDate(lv.from)}–${empFormatDate(lv.to)}），这天他不在`,
          `${lvType(lv.type).name.de} genehmigt (${lv.from}–${lv.to}) — an diesem Tag nicht verfügbar`));
      }
      const doc = schDocIssue(e, date);
      if (doc) out.push(schIssue("doc", e, date, doc.zh, doc.de));
      const emp = schEmployedIssue(e, date);
      if (emp) out.push(schIssue("employed", e, date, emp.zh, emp.de));
      const net = schDayNet(roster, id, date);
      const max = Number(empRule("dailyHoursMax")) || 10;
      if (net > max + 0.001) {
        out.push(schIssue("daily", e, date,
          `这天净工时 ${schH(net)}，超过上限 ${max}h（休息时间已按规则扣除）`,
          `${schH(net)} netto an diesem Tag, Grenze ${max}h (Pausen bereits abgezogen)`));
      }
    });
    for (let i = 1; i < mine.length; i += 1) {
      const prev = schAbs(mine[i - 1]), cur = schAbs(mine[i]);
      if (cur.from < prev.to) {
        out.push(schIssue("overlap", e, mine[i].date,
          `${mine[i - 1].start}–${mine[i - 1].end} 和 ${mine[i].start}–${mine[i].end} 时间重叠`,
          `${mine[i - 1].start}–${mine[i - 1].end} überschneidet sich mit ${mine[i].start}–${mine[i].end}`));
      } else if (mine[i].date !== mine[i - 1].date) {
        /* 同一天里的两段班是「分体班」（餐饮常态：午市 + 晚市），中间那段是间歇不是休息时间。
           休息时间（Ruhezeit）说的是当天下班到第二天上班之间，所以只在跨天时判。
           同一天排太多由「单日工时上限」那条硬拦兜着。 */
        const rest = (cur.from - prev.to) / 60;
        const need = Number(empRule("restBetweenShifts")) || 11;
        if (rest < need - 0.001) {
          out.push(schIssue("rest", e, mine[i].date,
            `跟上一班之间只隔 ${schH(rest)}，规定至少 ${need}h`,
            `nur ${schH(rest)} Ruhezeit zur Vorschicht, mindestens ${need}h`));
        }
      }
    }

    /* --- 逐周：休息天数 --- */
    const off = 7 - dates.length;
    const needOff = Number(empRule("weeklyDaysOffMin")) || 2;
    if (off <= 0) {
      out.push(schIssue("noday", e, null,
        "这周七天都排了班，一天休息都没有",
        "an allen sieben Tagen eingeplant — kein Ruhetag"));
    } else if (off < needOff) {
      out.push(schIssue("daysoff", e, null,
        `这周只休 ${off} 天，设置里要求至少 ${needOff} 天`,
        `nur ${off} freie Tage, mindestens ${needOff} vorgesehen`));
    }

    /* --- 逐周 / 逐月：合同与身份上限 --- */
    const type = empContractType(e.contract?.type);
    const weekNet = schWeekNet(roster, id);
    if (type.id === "werkstudent") {
      const max = Number(empRule("werkstudentWeeklyMax")) || 20;
      if (weekNet > max + 0.001) {
        out.push(schIssue("werkstudent", e, null,
          `这周排了 ${schH(weekNet)}，超过 ${max}h/周。学期内超了会丢学生社保身份`,
          `${schH(weekNet)} in dieser Woche, Grenze ${max}h/Woche — gefährdet den Studentenstatus`));
      }
    }
    const monthDates = [...new Set(mine.map(s => s.date))];
    const months = [...new Set(monthDates.map(d => d.slice(0, 7)))];
    months.forEach(month => {
      /* 计薪工时，不是排班工时 —— 加班算进来，存进 / 取出 Arbeitszeitkonto 也算进来。
         hours.js 不在时回落到排班工时，模块之间不硬绑。 */
      const net = typeof hrsPayableNet === "function"
        ? hrsPayableNet(roster.store, id, month, roster)
        : schMonthNet(roster.store, id, `${month}-01`, roster);
      if (type.id === "minijob" && (e.contract?.payType) === "hourly") {
        const cap = Number(empRule("minijobMonthlyMax")) || 556;
        const pay = net * (Number(e.contract.rate) || 0);
        if (pay > cap + 0.01) {
          out.push(schIssue("minijob", e, null,
            `${month} 排了 ${schH(net)} × €${e.contract.rate} ≈ €${pay.toFixed(2)}，超过 Minijob 月薪上限 €${cap}`,
            `${month}: ${schH(net)} × €${e.contract.rate} ≈ €${pay.toFixed(2)} über der Minijob-Grenze von €${cap}`));
        }
      }
      const hMax = Number(e.contract?.hoursMax) || 0;
      if (hMax && net > hMax + 0.001) {
        out.push(schIssue("contract", e, null,
          `${month} 排了 ${schH(net)}，合同上限 ${hMax}h/月`,
          `${month}: ${schH(net)} geplant, Vertragsobergrenze ${hMax}h/Monat`));
      }
    });
  });
  const order = { block: 0, warn: 1 };
  return out.sort((a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name));
}

function schBlocks(roster) {
  return schCheck(roster).filter(i => i.level === "block");
}

/* 「把这个班排给这个人会怎样」。加一份影子班表跑同一套校验，
   只取跟这个人这一天相关的结果 —— 校验逻辑只有一份，不会出现
   点的时候说没事、发布的时候又拦下来。 */
function schTryAdd(roster, shift) {
  const shadow = JSON.parse(JSON.stringify(roster));
  shadow.shifts = shadow.shifts.filter(s => s.id !== shift.id);
  shadow.shifts.push({ ...shift, id: shift.id || "tmp" });
  return schCheck(shadow).filter(i => i.empId === shift.empId && (!i.date || i.date === shift.date));
}

/* =========================================================== 覆盖与缺口 ===
   按半小时槽数人头，而不是「一个班算覆盖一条需求」。
   差别在于：需求 17:00–23:00 要 3 人，来了三个 17:00–20:00 的班，
   按班算是满的，按槽算才看得出 20:00 以后只剩 0 人。
   ========================================================================== */
function schOnDuty(roster, date, role, at) {
  return roster.shifts.filter(s =>
    s.date === date && s.role === role &&
    schMin(s.start) <= at && schEndMin(s.start, s.end) > at).length;
}

/* 一条需求在某天的缺口区间，连续的槽合成一段。 */
function schRuleGaps(roster, date, rule) {
  const from = schMin(rule.start), to = schEndMin(rule.start, rule.end);
  const out = [];
  let cur = null;
  for (let t = from; t < to; t += 30) {
    const short = rule.count - schOnDuty(roster, date, rule.role, t);
    if (short > 0) {
      if (cur && cur.to === t && cur.short === short) cur.to = t + 30;
      else { cur = { from: t, to: t + 30, short, rule, date }; out.push(cur); }
    } else cur = null;
  }
  return out;
}







/* 自动排班遇到这三条就停手，交给店长手动决定 */
/* 整周还差多少人 —— 自动排班就是照着这个补的。
   界面上不铺缺口清单（2026-09-02 Mingrong：先不做），但这个概念本身没消失，
   它是 AI 的输入；测试也照着它验「AI 按岗位需求补人」。 */
function schGaps(roster) {
  const out = [];
  schWeekDays(roster.week).forEach(date => {
    schDemandFor(roster.store, date).forEach(rule => {
      schRuleGaps(roster, date, rule).forEach(g => out.push(g));
    });
  });
  return out;
}

const SCH_AI_STOP = ["minijob", "werkstudent", "contract"];

function schLevelRank(id) {
  const i = EMP_LEVELS.findIndex(l => l.id === id);
  return i < 0 ? EMP_LEVELS.length - 1 : i;
}

/* ==================================================== 候选人与排除原因 =====
   这是整个模块最该说清楚的地方：排不满的时候，不许只说「人手不足」。
   同岗位的人一个一个过，谁被排除、为什么，原样端出来。
   ========================================================================== */
function schCandidates(roster, spec) {
  const out = { ok: [], no: [] };
  const need = { from: schMin(spec.start), to: schEndMin(spec.start, spec.end) };
  empStaff(roster.store).forEach(e => {
    /* 岗位不符的不进原因列表 —— 否则每个缺口都要把全店的人列一遍，等于没说 */
    if (e.role !== spec.role) return;
    /* kind 决定了缺口面板能给出什么解法：级别不够去改需求、没报班去催、
       时间对不上去问一句、会超上限则是「你确认就能排」。
       没有 kind 的话，界面只能把原因念一遍，念完还是不知道该干什么。 */
    const no = (kind, zh, de, extra) => out.no.push({ e, kind, why: { zh, de }, ...(extra || {}) });

    if (schLevelRank(e.level) > schLevelRank(spec.level)) {
      return no("level", `级别是${empRaw(empLevel(e.level).name)}，这个位置要${empRaw(empLevel(spec.level).name)}及以上`,
                `Stufe ${empRaw(empLevel(e.level).name)}, benötigt ${empRaw(empLevel(spec.level).name)} oder höher`);
    }
    const emp = schEmployedIssue(e, spec.date);
    if (emp) return no("employed", emp.zh, emp.de);
    const lv = typeof lvOn === "function" ? lvOn(roster.store, e.id, spec.date) : null;
    if (lv) {
      return no("leave", `${empRaw(lvType(lv.type).name.zh)}（${empFormatDate(lv.from)}–${empFormatDate(lv.to)}）`,
                `${lvType(lv.type).name.de} (${lv.from}–${lv.to})`);
    }
    const doc = schDocIssue(e, spec.date);
    if (doc) return no("doc", doc.zh, doc.de, { doc: doc.doc });

    /* 休息天数：一周该休几天由合规设置说了算。自动排班不会把人排满七天，
       也不会越过这条线 —— 谁排得少谁先上，正好也是公平轮换。 */
    const worked = new Set(roster.shifts.filter(x => x.empId === e.id).map(x => x.date));
    const needOff = Number(empRule("weeklyDaysOffMin")) || 2;
    if (!worked.has(spec.date) && worked.size >= 7 - needOff) {
      return no("daysoff", `这周已经排了 ${worked.size} 天，按设置至少要休 ${needOff} 天`,
                `bereits ${worked.size} Tage geplant, mindestens ${needOff} Ruhetage vorgesehen`);
    }
    const rec = schAvail(e.id, roster.week);
    if (schNeedsAvailability(e) && !rec) {
      return no("noavail", "这周还没报可上时间", "Verfügbarkeit für diese Woche fehlt");
    }
    const day = rec?.days?.[spec.date];
    if (day?.mode === "off") {
      return no("off", "这天报的是不能上班", "an diesem Tag nicht verfügbar");
    }
    const win = day?.mode === "free"
      ? { from: Math.max(need.from, schMin(day.start)), to: Math.min(need.to, schEndMin(day.start, day.end)) }
      : { from: need.from, to: need.to };
    if (win.to - win.from < 120) {
      return no("window", day ? `可上时间只有 ${day.start}–${day.end}，跟这个班对不上` : "可上时间跟这个班对不上",
                day ? `Verfügbar ${day.start}–${day.end}; passt nicht zu dieser Schicht` : "Verfügbarkeit passt nicht");
    }

    /* 已经在这个时段上着班的人，不能再排一次去补同一个缺口。
       不写这一条的话，原因栏会给出「17:00–20:00 和 17:00–20:00 时间重叠」这种自己撞自己的话。 */
    const busy = schShiftsOf(roster, e.id, spec.date).find(s =>
      schMin(s.start) < win.to && schEndMin(s.start, s.end) > win.from);
    if (busy) {
      return no("busy", `这个时段已经排了他（${busy.start}–${busy.end}）`,
                `bereits eingeplant (${busy.start}–${busy.end})`);
    }

    /* 跟当天已有的班次首尾相接就并成一个班，别给人排出两段中间空 0 分钟的班 */
    let cand = { empId: e.id, date: spec.date, role: spec.role,
                 start: schHHMM(win.from), end: schHHMM(win.to), src: "ai" };
    const adj = schShiftsOf(roster, e.id, spec.date).find(s =>
      schEndMin(s.start, s.end) === win.from || win.to === schMin(s.start));
    if (adj) {
      cand = { ...adj, start: schHHMM(Math.min(schMin(adj.start), win.from)),
               end: schHHMM(Math.max(schEndMin(adj.start, adj.end), win.to)) };
    }

    const issues = schTryAdd(roster, cand);
    const blocked = issues.find(i => i.level === "block");
    if (blocked) return no(blocked.code, empRaw(blocked.detail), empRaw(blocked.detail));
    /* 这三条不是违法，是要花钱或者要改合同的决定：超 Minijob 月薪上限、
       超 Werkstudent 周工时、超合同月工时。自动排班不替老板做这种决定 ——
       宁可把位置空着并写明「再排他就超了」，也不要悄悄把 James 排到 190h。
       店长自己点进去手排照样排得进，那时给的是软警告。 */
    const costly = issues.find(i => SCH_AI_STOP.includes(i.code));
    if (costly) {
      return no("costly", empRaw(costly.detail), empRaw(costly.detail),
                { shift: cand, code: costly.code });
    }
    const warns = issues.filter(i => i.level === "warn");
    /* 打分：越低越先排。主项是「离合同工时还差多少」—— 谁排得少谁先上，
       这同时解决了公平和「兼职工时不达标要照付钱」两件事。软警告每条重罚。 */
    const after = schWeekNet(roster, e.id) + schHours(cand).net;
    const score = (after - schWeeklyTarget(e)) + warns.length * 20 + schLevelRank(e.level) * 0.1;
    out.ok.push({ e, shift: cand, warns, score });
  });
  out.ok.sort((a, b) => a.score - b.score || a.e.id.localeCompare(b.e.id));
  return out;
}

/* ============================================================ 自动排班 ====
   贪心：按天、按需求规则，反复找当前最深的缺口，挑分数最低的候选人填进去。
   默认只补缺口，不动店长已经排好的班（opts.clear=true 才推翻重排）。
   ========================================================================== */
function schAutoFill(roster, opts) {
  const o = opts || {};
  const next = JSON.parse(JSON.stringify(roster));
  if (o.clear) next.shifts = [];
  let added = 0;
  schWeekDays(next.week).forEach(date => {
    schDemandFor(next.store, date).forEach(rule => {
      /* 每条规则最多补 12 次，防止判定出意外时空转 */
      for (let guard = 0; guard < 12; guard += 1) {
        const gap = schRuleGaps(next, date, rule)[0];
        if (!gap) break;
        const c = schCandidates(next, { date, role: rule.role, level: rule.level,
                                        start: schHHMM(gap.from), end: schHHMM(gap.to) });
        if (!c.ok.length) break;
        const pick = c.ok[0];
        const shift = { ...pick.shift, src: o.src || "ai" };
        const i = next.shifts.findIndex(s => s.id === shift.id);
        if (i >= 0) next.shifts[i] = shift;
        else next.shifts.push({ ...shift, id: schShiftId(next) });
        added += 1;
      }
    });
  });
  next.added = added;
  return next;
}

/* 复制上一周：同一个人、同一个星期几、同一个时间，日期整体后移七天。
   复制完不做任何静默丢弃 —— 复制进来的班照样跑校验，
   谁的证件在这七天里过期了、谁离职了，会在合规面板里红出来。 */
function schCopyWeek(roster, fromWeek) {
  return schCopyFrom(roster, schRoster(roster.store, fromWeek));
}

function schCopyFrom(roster, src) {
  const next = JSON.parse(JSON.stringify(roster));
  const days = schWeekDays(next.week);
  src.shifts.forEach(s => {
    const date = days[schDow(s.date) - 1];
    if (next.shifts.some(x => x.empId === s.empId && x.date === date && x.start === s.start)) return;
    next.shifts.push({ id: schShiftId(next), empId: s.empId, date, role: s.role,
                       start: s.start, end: s.end, src: "copy" });
  });
  return next;
}

/* ========================================================== 发布与通知 ====
   没有后端，系统发不出邮件 —— 这一点在界面上写明，不用「已发送」糊弄过去（标准 1）。
   发布做的是：锁定这一版、生成每个人的班表文本、留下发布时间和强行发布的理由。
   ========================================================================== */
function schPublish(roster, reason) {
  const next = JSON.parse(JSON.stringify(roster));
  const warns = schCheck(next).filter(i => i.level === "warn");
  next.state = "published";
  next.publishedAt = new Date().toISOString().slice(0, 16);
  next.rev = (next.rev || 0) + 1;
  next.log = next.log || [];
  next.log.unshift({ at: next.publishedAt, what: { zh: "发布班表", de: "Dienstplan freigegeben" },
                     note: reason || "" });
  if (warns.length && reason) {
    next.overrides = next.overrides || [];
    next.overrides.push({ at: next.publishedAt, reason,
                          codes: [...new Set(warns.map(w => w.code))] });
  }
  return next;
}

function schUnpublish(roster) {
  const next = JSON.parse(JSON.stringify(roster));
  next.state = "draft";
  next.log = next.log || [];
  next.log.unshift({ at: new Date().toISOString().slice(0, 16),
                     what: { zh: "撤回发布，改回草稿", de: "Freigabe zurückgezogen" } });
  return next;
}

/* 整周班表的群发文案。班表是贴在员工群里、贴在后厨墙上的东西，
   不是一个人一封信 —— 主动作就该是「复制这一整周」。
   逐人那份留着，用在「某某问我这周几个班」的时候。 */
function schGroupText(roster) {
  const de = empDe();
  const lines = [de ? `Dienstplan ${roster.week} — ${roster.store}` : `${roster.week} 班表 — ${roster.store}`,
                 `${schWeekDays(roster.week)[0]} – ${schWeekDays(roster.week)[6]}`, ""];
  schWeekDays(roster.week).forEach(date => {
    const list = roster.shifts.filter(s => s.date === date)
      .sort((a, b) => schMin(a.start) - schMin(b.start));
    lines.push(`${schDowName(schDow(date))} ${date.slice(5)}`);
    if (!list.length) lines.push(`  ${de ? "keine Schicht" : "没有排班"}`);
    list.forEach(s => {
      const e = empById(s.empId);
      lines.push(`  ${s.start}–${s.end}  ${e ? e.name : s.empId}${e ? `（${empRaw(empRole(e.role).name)}）` : ""}`);
    });
    lines.push("");
  });
  lines.push(de ? "Fragen bitte direkt an die Leitung." : "有问题直接找店长。");
  return lines.join("\n");
}

/* 单个员工的班表文本。有人单独问的时候用。 */
function schNoticeText(roster, empId) {
  const e = empById(empId);
  if (!e) return "";
  const de = empDe();
  const lines = schWeekDays(roster.week).map(date => {
    const list = schShiftsOf(roster, empId, date);
    const day = `${schDowName(schDow(date))} ${date.slice(5)}`;
    if (!list.length) return `${day}  ${de ? "frei" : "休息"}`;
    return `${day}  ${list.map(s => `${s.start}–${s.end}`).join(" / ")}`;
  });
  const net = schWeekNet(roster, empId);
  return [
    de ? `Dienstplan ${roster.week} — ${roster.store}` : `${roster.week} 班表 — ${roster.store}`,
    `${e.name}`, "", ...lines, "",
    de ? `Summe: ${schH(net)} (Pausen abgezogen)` : `合计 ${schH(net)}（已扣除休息时间）`
  ].join("\n");
}

function schWeekCsv(roster) {
  const days = schWeekDays(roster.week);
  const head = ["Mitarbeiter", "Rolle", ...days.map(d => `${schDowName(schDow(d))} ${d}`), "Netto h"];
  const rows = schRosterRows(roster).map(r => [
    r.e.name, empRaw(empRole(r.e.role).name),
    ...days.map(d => schShiftsOf(roster, r.e.id, d).map(s => `${s.start}-${s.end}`).join(" / ")),
    schWeekNet(roster, r.e.id).toFixed(2)
  ]);
  return [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

/* 网格的行：按岗位分组，岗位内按姓名。在岗的人全列出来 ——
   这周一个班都没排的人也要在表上，否则「谁被漏掉了」看不出来。 */
function schRosterRows(roster) {
  const order = EMP_ROLES.map(r => r.id);
  return empStaff(roster.store)
    .slice()
    .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name))
    .map(e => ({ e }));
}

/* 一周汇总，状态条和工时列共用 */
function schSummary(roster) {
  const issues = schCheck(roster);
  return {
    shifts: roster.shifts.length,
    net: roster.shifts.reduce((s, x) => s + schHours(x).net, 0),
    cost: schWeekCost(roster),
    people: new Set(roster.shifts.map(s => s.empId)).size,
    blocks: issues.filter(i => i.level === "block"),
    warns: issues.filter(i => i.level === "warn")
  };
}

/* ============================================================== 页面 ======
   两个主视图：周排班负责日常动作；月度结算把月历、工时与工资口径放在一起。
   设计上按餐饮老板的顺序走：先看这周谁上班、这周花多少钱，
   有没有排出违法的班；然后发出去。别的都是次要的。

   刻意没有的东西：
   - 班次模板。排班就是点格子，系统按他上周同一天排过的班给个默认时间，不对再改。
     五个「早班/午班/中班/晚班/收尾班」的按钮是把一件一秒的事做成了两步选择。
   - 经理代填员工可上时间。员工只报自己的可上时间，经理根据它审核 AI 班表。
   - 「排不满的位置」清单。先不做（同上）。岗位需求仍然是自动排班的输入，
     只是不再把排不满逐条摊在店长面前。
   ========================================================================== */
function schStore() {
  return empScope() || empStores()[0];
}

function schWeekParam() {
  const w = state().params.get("w") || "";
  return /^\d{4}-W\d{2}$/.test(w) ? w : schThisWeek();
}

function schHref(patch) {
  const p = new URLSearchParams(state().params.toString());
  Object.keys(patch).forEach(k => {
    if (patch[k] == null || patch[k] === "") p.delete(k);
    else p.set(k, patch[k]);
  });
  const q = p.toString();
  return `#${slug("employee", "排班管理")}${q ? `?${q}` : ""}`;
}


/* 完整操作方法只在需要时展开。周页面不再常驻三张流程卡；相同状态只在工具栏出现一次。 */
/* 使用说明按当前这一段给（2026-09-03 Mingrong：定位怎么判这类说明应该收进使用说明）。
   排班、考勤、休假三段各有自己的一套「怎么用」和「口径是什么」；
   把口径写在页面正文里，等于每次打开都读一遍一年只需要读一次的东西。 */
/* active 可以是 SCH_GUIDES 里的键，也可以直接传一份同样形状的说明进来
   （工资那一页用的就是后者 —— 说明的排版全项目一套，内容各页自己的）。 */
function schGuide(active) {
  const g = (active && typeof active === "object") ? active : (SCH_GUIDES[active] || SCH_GUIDES.week);
  return `<details class="sch-guide">
    <summary class="ghost-btn">${empT("使用说明", "Anleitung")}</summary>
    <div class="sch-guide-panel">
      <div class="sch-guide-head"><strong>${empText(g.title)}</strong>
        <span>${empText(g.sub)}</span></div>
      <ol>${g.steps.map((x, i) => `<li><b>${i + 1}</b><div>
        <strong>${empText(x.h)}</strong><span>${empText(x.p)}</span></div></li>`).join("")}</ol>
      ${g.notes.map(n => `<p>${empText(n)}</p>`).join("")}
    </div>
  </details>`;
}

const SCH_GUIDES = {
  week: {
    title: { zh: "排班怎么用", de: "So funktioniert die Dienstplanung" },
    sub: { zh: "从收集时间到审核发布，共四步。", de: "Vier Schritte von der Verfügbarkeit bis zur Freigabe." },
    steps: [
      { h: { zh: "收集可上时间", de: "Verfügbarkeit sammeln" },
        p: { zh: "兼职和 Minijob 每周在自己的 App 里报下周能上的时间。班表上他名字后面写着「已报 / 没报」，没报的点「催」就把提醒推过去。",
             de: "Teilzeit und Minijob melden ihre Zeiten in der App. Im Plan steht hinter dem Namen „gemeldet/offen“; offene per „Erinnern“ anstoßen." } },
      { h: { zh: "AI 排班", de: "Mit KI planen" },
        p: { zh: "「本周班表」标题旁点 AI 排班。它按报的时间、岗位需求和合规上限补齐空缺，不覆盖你手动改过的班。撞上要花钱的决定（比如加班）会停下来留给你。",
             de: "KI neben „Wochenplan“ starten: ergänzt nach gemeldeten Zeiten, Bedarf und Grenzen, ohne manuelle Änderungen zu überschreiben; kostenrelevante Entscheidungen bleiben bei Ihnen." } },
      { h: { zh: "直接调整", de: "Direkt anpassen" },
        p: { zh: "点空格直接排一个班，点已有班次改时间或删掉。深红格子＝排不了，发布前必须改；浅红格子＝要确认，发布时写一句理由。停在格子上看具体原因。",
             de: "Leere Zelle anklicken, bestehende Schicht ändern oder löschen. Dunkelrot = blockiert, hellrot = bei der Freigabe begründen. Details per Mouseover." } },
      { h: { zh: "审核并发布", de: "Prüfen und freigeben" },
        p: { zh: "发布后班表立刻出现在员工端。撤回、复制文本、导出 CSV 都收在工具栏的「更多」里。",
             de: "Nach der Freigabe erscheint der Plan sofort in der Mitarbeiter-App. Zurückziehen, Text kopieren und CSV-Export unter „Mehr“." } }
    ],
    notes: [{ zh: "当日人工成本按薪资 × 计薪工时估算（休息时间已扣），不含社保和雇主附加成本；员工端不显示成本。",
              de: "Tageskosten = Vergütung × abrechenbare Zeit (Pausen abgezogen), ohne Sozialabgaben und Arbeitgeberanteile; die Mitarbeiter-App zeigt keine Kosten." }]
  },
  att: {
    title: { zh: "考勤与工时怎么用", de: "So funktionieren Zeiten und Stunden" },
    sub: { zh: "同一件事的三个尺度：日看异常、周看进度、月看该付多少。", de: "Drei Zeitmaßstäbe: Tag, Woche, Monat." },
    steps: [
      { h: { zh: "日：处理对不上的班", de: "Tag: Abweichungen klären" },
        p: { zh: "打卡和班表对不上的班标成「待处理」。点「处理」在那一行里给一个决议，四选一：<b>照打卡</b>（打卡记录是对的，按它算）；<b>按这个时间记</b>（补签 —— 手填上下班时间，必须写理由，按钮上的小时数跟着你填的时间走）；<b>按班表记</b>（人来了但卡没打上，按排的时间算）；<b>记缺勤</b>（人没来，这天 0 小时，必须写理由）。还有一个「记病假」直接把这天转成病假。给了决议才算数 —— 在此之前一律按班表算，月度那个数还会变。",
             de: "Abweichungen sind „offen“. Per „Bearbeiten“ in der Zeile eine von vier Entscheidungen: <b>Erfassung übernehmen</b>, <b>So werten</b> (Nacherfassung mit Begründung — die Stundenzahl folgt den eingegebenen Zeiten), <b>Nach Plan werten</b>, <b>Als Fehlzeit</b> (0 h, Begründung nötig). Zusätzlich „Krankmeldung“. Bis zur Entscheidung zählt der Plan." } },
      { h: { zh: "周：排的 vs 真做的", de: "Woche: Plan vs. Ist" },
        p: { zh: "到今天为止每个人排了多少、真做了多少。后面还没上的班不算进来 —— 那是排班页回答的问题。周三就能看出谁已经超了、谁还差着，不用等到月底。",
             de: "Bis heute: geplante und tatsächliche Stunden je Person. Künftige Schichten zählen nicht mit." } },
      { h: { zh: "月：这个月该付多少小时", de: "Monat: abzurechnende Stunden" },
        p: { zh: "一行一个人，从左往右是一条算式。<b>合同工时</b>：合同里约定的月工时区间，右边那两个红字判断对着的就是它。<b>排班工时</b>：班表上排给他的净工时（休息已扣）。后面四列是让计薪工时不等于排班工时的四件事 —— <b>考勤增减</b>：打卡处理完之后相对班表的增减（迟到早退往下减，记缺勤减掉整个班）；<b>带薪缺勤</b>：年假病假这类照付工资而人没来的小时；<b>批准加班</b>：已经批准的加班，没批的不算；<b>工时账户</b>：这个月的存取，存进去记负、取出来记正。四个加完就是<b>计薪工时</b>，乘时薪就是<b>预估税前工资</b>（不含社保和雇主附加成本）。核完点右上角「核完去封账」进工资那一段。",
             de: "Je Zeile eine Person, von links nach rechts eine Rechnung. <b>Vertragsstunden</b>: der vereinbarte Monatsrahmen, auf den sich die Markierungen rechts beziehen. <b>Planstunden</b>: Nettostunden aus dem Dienstplan. Die vier Spalten danach erklären die Abweichung — <b>Ist-Abweichung</b>: Korrektur nach bearbeiteter Erfassung; <b>Bez. Abwesenheit</b>: bezahlte Stunden ohne Anwesenheit; <b>Überstunden</b>: nur genehmigte; <b>Zeitkonto</b>: Einzahlung negativ, Entnahme positiv. Summe = <b>abzurechnende Stunden</b>, mal Stundenlohn = <b>Brutto (Schätzung)</b>, ohne Sozialabgaben." } },
      { h: { zh: "「待处理事项」那一列是什么", de: "Die Spalte „Zu klären“" },
        p: { zh: "只有这一列需要你做决定，所以一格写三行：<b>第一行红字</b>说出了什么事（例如「超合同上限 30h，多了 4h」）；<b>第二行灰字</b>说这个数怎么算出来的、按下去之后会变成多少；<b>第三行</b>是那一个动作。结论有两类：<b>超上限</b>（合同月工时上限，或者 Minijob 的月收入上限）→ 按钮是「存 N 小时进工时账户」，存完这个月就回到区间内；<b>不达下限</b>（合同约定的工时没排够）→ 按钮是「从工时账户取 N 小时」补上，账户也空的话就没有按钮，只能去改班表，或者按 Annahmeverzug 跟税务师确认口径。存取多少是按那条线倒推算好的，不用手填。整月排完之后才给结论 —— 月中排到一半说「超了」或者「没超」都不作数，后面的班还没排。",
             de: "Nur diese Spalte verlangt eine Entscheidung, daher drei Zeilen je Feld: <b>rot</b> das Problem (z. B. „4 h über der Vertragsobergrenze 30 h“), <b>grau</b> die Herleitung und die Wirkung, darunter <b>eine</b> Aktion. Zwei Fälle: <b>über der Grenze</b> (Vertragsobergrenze oder Minijob-Monatsgrenze) → „N Stunden aufs Zeitkonto“; <b>unter der Untergrenze</b> → „N Stunden vom Zeitkonto“. Ist das Konto leer, bleibt nur der Dienstplan oder die Klärung (Annahmeverzug) mit der Steuerkanzlei. Ein Fazit gibt es erst bei vollständig geplantem Monat." } },
      { h: { zh: "工时账户 Arbeitszeitkonto", de: "Zeitkonto" },
        p: { zh: "超出上限的小时先<b>存</b>进账户，不进这个月的工资；以后哪个月不够了再<b>取</b>出来补上。余额有上限（合规设置里改），存不下的会明说。表里按时间列着每一笔和之后的余额，点「撤销」可以退回去。",
             de: "Stunden über der Grenze werden <b>eingezahlt</b> und zählen nicht im Monat; in einem schwächeren Monat wieder <b>entnommen</b>. Das Konto hat eine Obergrenze (Compliance-Einstellungen). Jede Bewegung ist mit Stand danach gelistet und kann zurückgenommen werden." } }
    ],
    notes: [
      { zh: "怎么算的：① 排班工时 = 班次时长减去规则里的休息时间，只算到今天为止。② 计薪工时 = 排班工时 ± 考勤增减 ± 带薪缺勤 + 已批准加班 − 存入账户 + 从账户取出。③ 工资估算：时薪员工按计薪工时 × 时薪，固定月薪按合同月薪。工资估算不含社保、雇主附加成本、夜班或节假日补贴；最终发薪以考勤和工资系统为准。",
        de: "Berechnung: 1. Geplante Nettostunden = Schichtdauer abzüglich Pausen, nur bis heute. 2. Abzurechnen = Netto ± Ist-Abweichung ± Abwesenheit + genehmigte Überstunden − Einzahlung + Entnahme. 3. Lohnschätzung: Stundenlohn × abrechenbare Stunden bzw. Festgehalt — ohne Sozialabgaben, Arbeitgeberanteile und Zuschläge; endgültig sind Zeiterfassung und Lohnabrechnung." },
      { zh: `定位打卡：超出 ${typeof attRadius === "function" ? attRadius() : 150} 米打不了卡，被拦下的尝试会记下来并出现在待处理里，员工可以点「请店长补签」。门店没设坐标、或者手机压根没给定位，属于「判不了」不是「太远」，这两种照旧允许打卡并标出来 —— 系统自己没配好不该由员工来担。`,
        de: `Standort: Über ${typeof attRadius === "function" ? attRadius() : 150} m ist keine Erfassung möglich; abgewiesene Versuche werden protokolliert, der Mitarbeiter kann um Nacherfassung bitten. Fehlender Filialstandort oder fehlende Geräteortung gelten als „nicht prüfbar“, nicht als „zu weit“.` },
      { zh: "两条说明白的边界：① 定位只能证明打卡时这台手机在门店附近，挡不住把手机交给同事，也挡不住模拟定位。② 这个原型没有后端，打卡时间是员工手机上的本地时间；真实产品里这个时间必须由服务器盖章。",
        de: "Zwei Grenzen: 1. Der Standort belegt nur, dass dieses Gerät in Filialnähe war — weder Gerätetausch noch Spoofing werden verhindert. 2. Ohne Backend ist der Zeitstempel die lokale Gerätezeit; produktiv muss der Server stempeln." },
      { zh: "「实做」是扣掉法定休息后的净工时，上限是班表排的那么多；多干的部分要转成加班申请，批了才算钱。",
        de: "„Ist“ ist die Nettozeit nach gesetzlicher Pause, gedeckelt auf den Plan; Mehrstunden zählen erst nach Freigabe." }
    ]
  },
  leave: {
    title: { zh: "休假怎么用", de: "So funktionieren Abwesenheiten" },
    sub: { zh: "员工在 App 里申请，你在这里批。", de: "Mitarbeitende beantragen in der App, Sie entscheiden hier." },
    steps: [
      { h: { zh: "看两件事再批", de: "Zwei Dinge vor der Freigabe" },
        p: { zh: "他今年的年假还够不够，以及那几天他本来有没有班。两条都写在展开的那一行里，撞班的会给一个跳去排班的链接。",
             de: "Reicht der Jahresanspruch, und sind für diese Tage Schichten geplant? Beides steht in der aufgeklappten Zeile." } },
      { h: { zh: "批准之后", de: "Nach der Freigabe" },
        p: { zh: "那几天在排班里就排不进去了，AI 排班也会自动绕开；有薪假按班表小时数进计薪工时。",
             de: "Die Tage sind im Dienstplan gesperrt, die KI plant um sie herum; bezahlte Abwesenheit fließt in die Abrechnung." } },
      { h: { zh: "病假证明（AU）", de: "Krankmeldung (AU)" },
        p: { zh: `连续 ${typeof lvAuAfter === "function" ? lvAuAfter() : 3} 天以上的病假要医生证明。收到之后在「病假证明」那张表里登记，它像证件一样有到期日。`,
             de: `Ab ${typeof lvAuAfter === "function" ? lvAuAfter() : 3} Tagen ist eine AU nötig; nach Erhalt in der Tabelle erfassen — sie hat ein Ablaufdatum.` } }
    ],
    notes: [{ zh: "年假额度来自合同上的 Urlaubstage，入职和离职当年按整月 1/12 折算后向上取到半天（§5 Abs. 2 BUrlG）。休假天数按班表数：排到的日子数实际排班，没排到的按这个人最近 13 周的每周上班天数折算（§11 BUrlG）。",
              de: "Der Urlaubsanspruch stammt aus den Vertrags-Urlaubstagen; im Ein- und Austrittsjahr anteilig (1/12), aufgerundet auf halbe Tage (§5 Abs. 2 BUrlG). Urlaubstage nach Dienstplan, sonst nach den Arbeitstagen der letzten 13 Wochen (§11 BUrlG)." }]
  }
};

/* 「复制上一周」和「清空本周班表」删了（2026-09-03 Mingrong）：
   前者排出来的是一版没人看过的班（AI 排班本来就按上周的班和报班时间给建议，更靠谱）；
   后者是一个一键毁掉整周工作的按钮，而它省下的只是逐个删几下。
   剩下的都是发布之后才用得上的东西 —— 草稿状态下这个菜单是空的，那就整个不出现。 */
function schWeekMoreActions(roster) {
  if (roster.state !== "published") return "";
  const rows = schRosterRows(roster).filter(({ e }) => schShiftsOf(roster, e.id).length);
  return `<details class="sch-more-actions">
    <summary class="ghost-btn">${empT("更多", "Mehr")}</summary>
    <div class="sch-more-menu">
      <button class="ghost-btn sch-copy-group">${empT("复制班表文本", "Plantext kopieren")}</button>
      <button class="ghost-btn sch-csv">${empT("导出 CSV", "CSV exportieren")}</button>
      ${rows.length && typeof meEnterHref === "function" ? `<a class="ghost-btn" href="${meEnterHref(rows[0].e.id)}">${empT("查看员工端", "Mitarbeiter-Ansicht")}</a>` : ""}
      <button class="ghost-btn sch-unpublish">${empT("撤回发布", "Freigabe zurückziehen")}</button>
    </div>
  </details>`;
}

/* 点空格子时给的默认时间：先按他上周同一天排过的班，再按这周他最近一天的班，
   再按这个岗位那天的营业需求，最后才是 10:00–18:00。
   餐饮的班表本来就是一周一周照着来的，默认给对了，多数格子点一下就完事。 */
function schSuggestShift(roster, e, date) {
  const busy = schShiftsOf(roster, e.id, date);
  const free = win => !busy.some(s =>
    schMin(s.start) < schEndMin(win.start, win.end) && schEndMin(s.start, s.end) > schMin(win.start));

  /* 这天已经排了班，说明店长要加的是第二个班（餐饮的午市 + 晚市）。
     ⚠️ 之前这里不看已有班次，一律建议「上周同一天那个班」——
     结果 56 个格子里 27 个点下去直接报「班次重叠」或「单日工时超上限」，
     店长看到的是一次闪烁，而他其实完全可以排一个晚班。
     按钮不是死的，但拦得是错的，比死按钮更难受。
     所以有班的时候先去岗位需求里找当天同岗位、跟已有班次不冲突的另一个时段。 */
  if (busy.length) {
    const rule = schDemandFor(roster.store, date)
      .filter(r => r.role === e.role)
      .find(r => free({ start: r.start, end: r.end }));
    if (rule) return { start: rule.start, end: rule.end };
    /* 没有第二条需求：接在最后一个班之后留一小时间歇。
       长度按当天还剩多少工时余量裁 —— 建议一个注定超单日上限的班，
       等于让店长点一下再看一次「超上限」，那是系统自己没算。
       余量不足两小时就不建议了，那时候「单日工时」这个提示才是对的。 */
    const roomH = (Number(empRule("dailyHoursMax")) || 10) - schDayNet(roster, e.id, date);
    const len = Math.min(240, Math.floor(roomH * 60 / 15) * 15);
    if (len >= 120) {
      const lastEnd = Math.max(...busy.map(s => schEndMin(s.start, s.end)));
      if (lastEnd + 60 + len <= 24 * 60) return { start: schHHMM(lastEnd + 60), end: schHHMM(lastEnd + 60 + len) };
      const first = Math.min(...busy.map(s => schMin(s.start)));
      if (first - 60 - len >= 0) return { start: schHHMM(first - 60 - len), end: schHHMM(first - 60) };
    }
  }

  const last = schRoster(roster.store, schWeekAdd(roster.week, -1));
  const sameDow = last.shifts.find(s => s.empId === e.id && schDow(s.date) === schDow(date));
  if (sameDow && free(sameDow)) return { start: sameDow.start, end: sameDow.end };
  const rule = schDemandFor(roster.store, date).find(r => r.role === e.role && free(r));
  if (rule) return { start: rule.start, end: rule.end };
  const own = schShiftsOf(roster, e.id).slice(-1)[0];
  if (own && free(own)) return { start: own.start, end: own.end };
  return { start: "10:00", end: "18:00" };
}

/* ==============================================================================
   排班与考勤：一个外壳，三段（2026-09-03 Mingrong 定）
   --------------------------------------------------------------------------
   这三件事回答的是同一个问题 ——「谁什么时候在店里」：
   排班是计划，考勤是当天真的来没来，休假是谁不来。
   原来考勤单独成一块，可它唯一的产出就是工时，而且店长每天都要看一眼；
   跟排班隔一层首页卡片，等于每天多走两步。
   所以「排班管理」和「考勤」两个路由现在渲染同一个外壳，只是高亮的那一段不同。
   2026-09-03 再调一次：工时结算从「工时与工资」搬进「考勤」那一段，成为它的月视图。
   考勤和工时是同一份数据的两个读法 —— 考勤说时间实际怎么发生，工时说这些时间按钱怎么算；
   处理一条迟到，计薪工时当场就变，这条因果链不该跨模块。工资那一块因此从「封账」开始。
   ============================================================================== */
function schShell(active, inner) {
  const store = schStore();
  const leavePend = typeof lvOpen === "function" ? lvOpen(store).length : 0;
  const attOpen = typeof attOpenCount === "function" ? attOpenCount(store) : 0;
  /* 标签用全站那一套（员工档案、员工资料页上的药丸标签），不再自己发明一个灰底分段控件 ——
     同一个模块里两种长得不一样的标签，本身就是「界面做得不好」的来源。 */
  const tab = (id, href, label, badge) => `<a class="emp-tab${active === id ? " is-on" : ""}" href="${href}">${label}${
    badge ? `<b class="emp-attention-count">${badge}</b>` : ""}</a>`;
  return `
    <div class="page-head">
      <div><h1>${empT("排班与考勤", "Dienstplan und Zeiten")}</h1>
      <p>${empT("一周谁上什么班、当天谁真的来了、这个月加起来该付多少小时 —— 都在这里。",
                "Wer wann eingeplant ist, wer tatsächlich da war und wie viele Stunden der Monat kostet — alles an einem Ort.")}</p></div>
      <div class="button-row">
        <a class="ghost-btn accent-back-btn" href="#employee">${empT("返回员工助手", "Zurück: Mitarbeiter")}</a>
        ${active === "att"
          ? `<a class="ghost-btn" href="#${slug("employee", "合规设置")}">${empT("打卡设置", "Erfassung einrichten")}</a>`
          : `<a class="ghost-btn" href="#${slug("employee", "排班规则")}">${empT("岗位需求", "Personalbedarf")}</a>`}
        ${schGuide(active)}
      </div>
    </div>
    <nav class="emp-tabs sch-primary-tabs">
      ${tab("week", `#${slug("employee", "排班管理")}`, empT("排班", "Dienstplan"), 0)}
      ${tab("att", `#${slug("employee", "考勤")}`, empT("考勤与工时", "Zeiten und Stunden"), attOpen)}
      ${tab("leave", `#${slug("employee", "排班管理")}?v=leave`, empT("休假", "Abwesenheiten"), leavePend)}
    </nav>
    ${empScope() ? "" : `<p class="sch-scope-hint">${empT(`按门店看。现在看的是 ${store}，换一家请用顶栏的门店选择器。`,
        `Filialbezogen. Angezeigt wird ${store} — Filiale oben in der Kopfzeile wechseln.`)}</p>`}
    ${inner}`;
}

function employeeSchedulePage() {
  const store = schStore();
  const view = schView();

  if (view === "leave") {
    return schShell("leave", typeof lvView === "function" ? lvView(store)
      : `<section class="card"><p>${empT("休假模块没有加载。", "Modul nicht geladen.")}</p></section>`);
  }
  if (view === "month") return schShell("week", schMonthView(store));

  const week = schWeekParam();
  const roster = schRoster(store, week);
  const sum = schSummary(roster);
  const days = schWeekDays(week);
  const issues = schCheck(roster);
  const isThis = week === schThisWeek();
  const stateTag = roster.state === "published"
    ? empPill("green", empT(`已发布 · ${(roster.publishedAt || "").slice(5).replace("T", " ")}`, `Freigegeben · ${(roster.publishedAt || "").slice(5).replace("T", " ")}`))
    : roster.shifts.length
      ? empPill("orange", empT("草稿，还没发", "Entwurf"))
      : empPill("gray", empT("还没排", "Offen"));

  return schShell("week", `
    <section class="sch-weekbar">
      <div class="sch-weeknav">
        ${schStepper(
          schHref({ w: schWeekAdd(week, -1), edit: null, pub: null }),
          schHref({ w: schWeekAdd(week, 1), edit: null, pub: null }),
          schWeekRange(week),
          `${isThis ? empT("本周 · ", "Diese Woche · ")
            : week === schWeekAdd(schThisWeek(), 1) ? empT("下周 · ", "Nächste Woche · ")
            : week === schWeekAdd(schThisWeek(), -1) ? empT("上周 · ", "Letzte Woche · ") : ""}${
            empT(`第 ${Number(week.slice(6))} 周`, `KW ${Number(week.slice(6))}`)}`,
          [empT("上一周", "Vorherige Woche"), empT("下一周", "Nächste Woche")])}
        ${isThis ? "" : `<a class="sch-jump" href="${schHref({ w: schThisWeek(), edit: null, pub: null })}">${
          empT("回到本周", "Heute")}</a>`}
        <span class="sch-bar-sep"></span>
        ${schPeriodToggle("week", week)}
      </div>

      <div class="sch-week-actions">
        ${stateTag}
        ${roster.state === "published" ? "" : roster.shifts.length
          ? `<a class="primary-btn sch-review-link" href="${schHref({ pub: "1", edit: null })}">${empT("审核发布", "Prüfen & freigeben")}</a>`
          : `<button class="primary-btn" disabled>${empT("审核发布", "Prüfen & freigeben")}</button>`}
        ${schWeekMoreActions(roster)}
      </div>
    </section>

    ${schPublishPanel(roster, sum)}

    <section class="card sch-grid-card">
      <div class="section-title">
        <div><div class="sch-grid-title"><h2>${empT("本周班表", "Wochenplan")}</h2>
          <button class="primary-btn sch-ai">${empT("AI 排班", "KI-Planung")}</button></div>
        <p>${empT("点空格直接排班，点班次改时间或删掉。", "Leere Zelle direkt anklicken; Schicht anklicken zum Ändern oder Löschen.")}</p></div>
      </div>
      <div class="sch-grid-wrap">
        <table class="sch-grid">
          <thead><tr><th>${empT("员工", "Mitarbeiter")}</th>
            ${days.map(d => `<th class="${d === empToday() ? "is-today" : ""} ${schDow(d) >= 6 ? "is-weekend" : ""}">${
              schDowName(schDow(d))}<span>${d.slice(5).replace("-", ".")}</span></th>`).join("")}
            <th class="sch-sum-col">${empT("本周", "Woche")}</th></tr></thead>
          <tbody>${schGridRows(roster, days, issues)}</tbody>
          ${schCostFoot(roster, days, sum)}
        </table>
      </div>
      ${schIssueLegend(sum)}
      <details class="sch-cost-note"><summary>${empT("成本口径", "Kostenbasis")}</summary>
        <p>${empT("当日成本按员工薪资 × 计薪工时估算（休息时间已扣），不含社保和雇主附加成本。只显示每天和整周合计，不显示个人金额；员工端不会显示成本。",
          "Die Tageskosten werden aus Vergütung × abrechenbarer Zeit geschätzt (Pausen abgezogen), ohne Sozialabgaben und Arbeitgeberanteile. Nur Tages- und Wochensummen werden angezeigt; die Mitarbeiter-App zeigt keine Kosten.")}</p></details>
    </section>


    ${typeof hrsOvertimeCard === "function" ? hrsOvertimeCard(store, { days, week }) : ""}`);
}

/* 周 / 月只是同一张班表的两种看法，不是两个功能，所以是周导航旁边的一个小开关，
   不占一整段导航。月视图（月历）点某一天就跳回那一周去改。 */
/* 日期两边各一个箭头，中间是标题 —— 跟日历、跟任何一个「上一页/下一页」都是同一个读法：
   `‹ 这一段时间 ›`。上一版把两个箭头并成一个小控件塞在最左边，
   眼睛得先找到控件、再横跨过去找日期，中间还夹着两个不同形状的药丸，多走了两跳。 */
function schStepper(prev, next, title, meta, labels, opts) {
  /* next 传 null = 往后没有可看的（考勤那三个视图：还没发生的日子没有考勤可看）。
     不是把箭头藏掉 —— 位置留着、变灰，这样使用者知道「到头了」，而不是「按钮跑哪去了」。 */
  const off = (opts && opts.noNext) || !next;
  return `<div class="sch-weekpick">
    <a class="sch-step" href="${prev}" aria-label="${labels[0]}">‹</a>
    <div class="sch-weekname"><strong>${title}</strong><span>${meta}</span></div>
    ${off ? `<span class="sch-step is-off" aria-disabled="true" title="${
      empT("再往后还没发生", "Noch nicht eingetreten")}">›</span>`
      : `<a class="sch-step" href="${next}" aria-label="${labels[1]}">›</a>`}
  </div>`;
}

function schPeriodToggle(active, week) {
  const month = active === "week" ? schWeekDays(week)[3].slice(0, 7) : schMonthParam();
  return `<div class="sch-period">
    <a class="${active === "week" ? "is-on" : ""}" href="#${slug("employee", "排班管理")}?w=${encodeURIComponent(week || schThisWeek())}">${empT("周", "Woche")}</a>
    <a class="${active === "month" ? "is-on" : ""}" href="#${slug("employee", "排班管理")}?v=month&m=${month}">${empT("月", "Monat")}</a>
  </div>`;
}

/* 这一周整周都排不了的人（证件过期、还没入职、已离职）：
   他们的行永远是空的，却跟能排的人一样高，八个人的表里有三行是白占的。
   收成一行，要看的时候点开 —— 信息一条没少，眼睛少扫三行。 */
function schBlockedAllWeek(e, days) {
  if (days.some(d => !schDocIssue(e, d) && !schEmployedIssue(e, d))) return null;
  const doc = schDocIssue(e, days[3]) || schDocIssue(e, days[0]);
  if (doc) return { tone: "red", text: empT(`${doc.doc}有问题，这周排不了`, `${doc.doc} — diese Woche nicht einsetzbar`) };
  const emp = schEmployedIssue(e, days[3]) || schEmployedIssue(e, days[0]);
  return { tone: "gray", text: empText(emp) };
}

function schGridRows(roster, days, issues) {
  const all = schRosterRows(roster);
  if (!all.length) {
    return `<tr><td colspan="${days.length + 2}" class="sch-empty">${empT("这家店还没有在岗员工。先去员工档案建档。", "Noch keine aktiven Mitarbeiter in dieser Filiale.")}</td></tr>`;
  }
  const blocked = all.map(x => ({ ...x, why: schBlockedAllWeek(x.e, days) })).filter(x => x.why);
  const rows = all.filter(x => !blocked.some(b => b.e.id === x.e.id));
  const editing = state().params.get("edit") || "";
  const foot = blocked.length ? `<tr class="sch-blocked-row"><td colspan="${days.length + 2}">
    <details><summary>${empT(`${blocked.length} 人这周排不了`, `${blocked.length} diese Woche nicht einsetzbar`)}</summary>
      <ul>${blocked.map(x => `<li><a href="${empStaffHref(x.e.id)}">${empEsc(x.e.name)}</a>
        <b class="sch-who-flag is-${x.why.tone}">${empEsc(x.why.text)}</b></li>`).join("")}</ul>
    </details></td></tr>` : "";
  return rows.map(({ e }) => {
    const net = schWeekNet(roster, e.id);
    const target = schWeeklyTarget(e);
    const mine = issues.filter(i => i.empId === e.id);
    /* 姓名这一列以前挂了四样东西：姓名、岗位药丸、合同类型、报班药丸，再加一行蓝字备注 ——
       五个东西抢同一块地方，扫一眼谁都读不出来。现在压成固定两行：
       第一行只回答「谁」和「他报班了没有」（这两件事决定店长下一步动作），
       第二行是安静的一句 `岗位 · 合同 · 这周的特殊情况`，颜色只留岗位那个小圆点。 */
    const note = schWhoNote(e, days);
    return `<tr>
      <td class="sch-who">
        <div class="sch-who-top">
          <a href="${empStaffHref(e.id)}"><strong>${empEsc(e.name)}</strong></a>
          ${schAvailTag(e, roster.week)}
        </div>
        <div class="sch-who-sub"><i class="sch-role-dot ${e.role}"></i>${
          empText(empRole(e.role).name)} · ${empText(empContractType(e.contract?.type).name)}${note}</div>
      </td>
      ${days.map(date => schCell(roster, e, date, issues, editing)).join("")}
      ${(() => {
        /* 不落在某一天的问题（整周超合同上限、Minijob 月额这类）标在「本周」这一格上 ——
           那正是它说的那个数。不然图例上写着「2 个要确认」，格子里一个都找不到。 */
        const wide = issues.filter(i => i.empId === e.id && !i.date);
        const tone = wide.some(i => i.level === "block") ? "is-block" : wide.length ? "is-warn" : "";
        const why = wide.map(i => `${empRaw(i.title)}：${empRaw(i.detail)}`).join("\n");
        return `<td class="sch-sum-col ${net > target * 1.25 ? "is-over" : ""} ${tone}"${why ? ` title="${empEsc(why)}"` : ""}>
        <strong>${schH(net)}</strong><small>${empT(`目标 ${schH(target)}`, `Ziel ${schH(target)}`)}</small></td>`;
      })()}
    </tr>
    ${state().params.get("av") === e.id ? schAvailRow(e, roster.week, days.length + 2) : ""}`;
  }).join("") + foot;
}

/* 整周都排不了的人，在他那一行就说清楚。放在这里而不是另开一张提醒卡：
   同一件事只说一遍。 */
/* 报没报班，就写在他那一行 —— 店长排到这个人的时候正好要知道这件事，
   不用先翻上面那张报班进度表。全职不用报班，不显示。 */
/* 报没报班跟姓名同一行（2026-09-03 Mingrong）：
   报了的点开就是他报的那几天几点 —— 店长正要按这个排班，不该再去别处查；
   没报的后面直接给一个「催」，一步就把提醒推到他 App 上。
   全职不用报班，那一格写合同类型就完了。 */
function schAvailTag(e, week) {
  if (!schNeedsAvailability(e)) return "";
  const rec = schAvail(e.id, week);
  if (!rec) {
    /* 「催过 9 次」记的是失败次数，不改变店长下一步做什么（2026-09-03 Mingrong 问的）。
       真正决定要不要再点一下的是「上次什么时候催的」：今天刚催过就先等等，
       昨天催的可以再催一次。所以显示时间距离，不显示计数。 */
    const rem = schInvite(e.id, week)?.reminders || [];
    const last = rem.length ? String(rem[rem.length - 1].at || "") : "";
    const today = last.slice(0, 10) === empToday();
    return `<span class="sch-avail">${empT("没报", "offen")}</span>
      <button class="sch-nudge ${today ? "is-done" : ""}" data-emp="${empEsc(e.id)}" data-week="${empEsc(week)}"
        title="${last ? empT(`上次催是 ${empStamp(last)}`, `Zuletzt ${empStamp(last)}`)
                      : empT("把提醒推到他的员工端", "Erinnerung in seine App")}">${
        today ? empT("今天催过", "heute") : last ? empT("再催", "nochmal") : empT("催", "Erinnern")}</button>`;
  }
  /* 点开看他报的时间，原来是一张绝对定位的浮层 —— 姓名列是 sticky 的（横向滚动时钉住），
     sticky 单元格自己就是一个层叠上下文，浮层再高的 z-index 也压不过下面几行的姓名格，
     结果卡片出来了、字被盖住（2026-09-03 Mingrong：点开看不见）。
     改成在这一行下面**展开一整行** —— 跟改班次、处理考勤、批休假是同一个做法：
     不弹面板、不跳页，就在行里展开。既没有层叠问题，也不会被表格的横向滚动裁掉。 */
  const on = state().params.get("av") === e.id;
  return `<a class="sch-avail is-on ${on ? "is-open" : ""}"
    href="${schHref({ av: on ? null : e.id, edit: null })}"
    title="${empT("点开看他报的几点到几点", "Klicken für die gemeldeten Zeiten")}">${empT("已报", "gemeldet")}</a>`;
}

/* 展开的那一行：七天一格一格摆开，他哪天能来、几点到几点。 */
function schAvailRow(e, week, cols) {
  const rec = schAvail(e.id, week);
  if (!rec) return "";
  const days = schWeekDays(week);
  return `<tr class="sch-avail-row"><td colspan="${cols}">
    <div class="sch-availbar">
      <strong>${empT(`${e.name} 报的可上时间`, `Gemeldete Zeiten — ${e.name}`)}</strong>
      <ul>${days.map(d => {
        const x = rec.days?.[d];
        return `<li class="${x && x.mode === "free" ? "" : "is-off"}">
          <b>${schDowName(schDow(d))}</b>${x && x.mode === "free"
            ? `${schClock(x.start)}–${schClock(x.end)}` : empT("来不了", "nicht möglich")}</li>`;
      }).join("")}</ul>
      <span>${rec.submittedAt ? empT(`${empStamp(rec.submittedAt)} 提交`, `Abgegeben ${empStamp(rec.submittedAt)}`)
                              : empT("演示数据", "Demo-Daten")}</span>
      <a class="ghost-btn" href="${schHref({ av: null })}">${empT("收起", "Schließen")}</a>
    </div>
  </td></tr>`;
}

function schWhoNote(e, days) {
  /* 整周都排不了的人已经收进表尾那一行了，这里只说「这周里从哪天起 / 到哪天止」——
     比如周日才入职，那前六天是空的，第七天照排。跟岗位、合同挤在同一行，
     所以写成 `09.06 起` 这种最短的形式；完整日期在他的档案页上。 */
  const short = d => String(d).slice(5).replace("-", ".");
  const from = schEmployedIssue(e, days[0]);
  const till = schEmployedIssue(e, days[6]);
  if (from && !till) {
    return ` · <b class="sch-who-flag is-blue">${e.entryDate && e.entryDate > days[0]
      ? empT(`${short(e.entryDate)} 起`, `ab ${short(e.entryDate)}`) : empText(from)}</b>`;
  }
  if (!from && till) {
    const last = e.leave && e.leave.lastDay;
    return ` · <b class="sch-who-flag is-blue">${last
      ? empT(`到 ${short(last)}`, `bis ${short(last)}`) : empText(till)}</b>`;
  }
  return "";
}

/* 格子里的时间写短一点：整点不写 :00（11:00–14:30 → 11–14:30）。
   七列各省 20 来像素，省出来的宽度给「员工」那一列 —— 报班状态要跟姓名同一行放得下。
   完整时间在 title 里，点开班次也是完整的。 */
function schClock(t) {
  return String(t).endsWith(":00") ? String(t).slice(0, -3) : t;
}

function schCell(roster, e, date, issues, editing) {
  const list = schShiftsOf(roster, e.id, date);
  const mine = issues.filter(i => i.empId === e.id && i.date === date);
  const tone = mine.some(i => i.level === "block") ? "is-block" : mine.some(i => i.level === "warn") ? "is-warn" : "";
  const open = list.find(s => s.id === editing);
  if (open) return `<td class="sch-cellwrap is-editing ${tone}">${schCellEditor(roster, open, mine)}</td>`;
  const inner = list.length
    ? list.map(s => {
        const h = schHours(s);
        return `<button class="sch-shift ${e.role} sch-open" data-id="${s.id}"
          title="${s.start}–${s.end} · ${schH(h.net)} · ${empT("点一下改时间或删掉", "klicken zum Ändern oder Löschen")}">${
          schClock(s.start)}<i>–</i>${schClock(s.end)}<em>${schH(h.net)}</em></button>`;
      }).join("")
    : "";
  const why = mine.length ? mine.map(i => `${empRaw(i.title)}：${empRaw(i.detail)}`).join("\n") : "";
  return `<td class="sch-cellwrap ${tone} ${date === empToday() ? "is-today" : ""} ${
    schDow(date) >= 6 ? "is-weekend" : ""}"${why ? ` title="${empEsc(why)}"` : ""}>
    ${inner}
    <button class="sch-add ${list.length ? "is-inline" : ""}" data-emp="${empEsc(e.id)}" data-date="${date}"
      aria-label="${empEsc(e.name)} ${date} ${empT("排班", "Schicht")}">+</button></td>`;
}

/* 改时间就在格子里改，不弹面板也不跳页。两个时间输入竖着放，一次只有一个格子是这个状态。 */
function schCellEditor(roster, shift, mine) {
  const h = schHours(shift);
  return `<div class="sch-inline">
    <input type="time" class="sch-in-start" data-id="${shift.id}" value="${shift.start}" aria-label="${empT("开始", "Von")}">
    <input type="time" class="sch-in-end" data-id="${shift.id}" value="${shift.end}" aria-label="${empT("结束", "Bis")}">
    <div class="sch-inline-row">
      <button class="primary-btn sch-in-save" data-id="${shift.id}">${empT("保存", "OK")}</button>
      <button class="ghost-btn is-danger sch-in-del" data-id="${shift.id}">${empT("删", "Löschen")}</button>
    </div>
    <small>${empT(`计 ${schH(h.net)}`, `${schH(h.net)} netto`)}${h.brk ? empT(` · 扣休息 ${h.brk} 分`, ` · ${h.brk} min Pause`) : ""}</small>
    ${mine.length ? `<u class="sch-inline-warn">${empText(mine[0].detail)}</u>` : ""}
  </div>`;
}

/* 成本行钉在表格底下：哪天贵、贵多少，排的时候就看得见 —— 这是纸质班表给不了的。 */
function schCostFoot(roster, days, sum) {
  return `<tfoot><tr>
    <td class="sch-foot-label">${empT("当日人工成本", "Personalkosten je Tag")}</td>
    ${days.map(date => {
      /* 「4 个班」这个数没人拿它做决定 —— 班次就在上面那一列里数得到。
         这一行只回答两件事：这天多少钱、多少工时。 */
      const cost = schDayCost(roster, date);
      const hours = roster.shifts.filter(s => s.date === date).reduce((x, s) => x + schHours(s).net, 0);
      return `<td class="sch-foot ${date === empToday() ? "is-today" : ""} ${schDow(date) >= 6 ? "is-weekend" : ""}">
        <strong>${cost ? schEuro(cost) : "—"}</strong>
        ${hours ? `<small>${schH(hours)}</small>` : ""}</td>`;
    }).join("")}
    <td class="sch-foot is-total"><strong>${schEuro(sum.cost)}</strong><small>${schH(sum.net)}</small></td>
  </tr></tfoot>`;
}

/* 只剩两组：排不了的、要确认的。「排不满」按 Mingrong 2026-09-02 的要求先不做。 */
/* 同一个人同一个原因，一周撞四天也只算一件事 —— 图例上的数字和发布时要确认的条数都读它。 */
function schMergeIssues(list) {
  const map = new Map();
  list.forEach(i => {
    const key = `${i.empId}|${i.code}`;
    if (!map.has(key)) map.set(key, { ...i, dates: [], count: 0 });
    const hit = map.get(key);
    hit.count += 1;
    if (i.date) hit.dates.push(i.date);
  });
  return [...map.values()];
}

/* 排班检查那张单子删了（2026-09-03 Mingrong）：
   它把格子上已经用颜色说过的事又抄成一张列表，而真正要拦人的地方在「审核发布」——
   排不了的班在那儿会挡住发布，要确认的在那儿写一句理由存档。
   格子本身红 / 橙已经能定位，鼠标停上去有原因，点开班次编辑器里也写着。
   这里只留一行图例，告诉店长这两种颜色是什么意思。 */
function schIssueLegend(sum) {
  if (!sum.blocks.length && !sum.warns.length) return "";
  return `<p class="sch-legend-issue">
    ${sum.blocks.length ? `<b class="is-block"></b>${empT(`深红 ${schMergeIssues(sum.blocks).length} 个：排不了，发布前必须改`, `${schMergeIssues(sum.blocks).length} dunkelrot: blockiert — vor der Freigabe ändern`)}` : ""}
    ${sum.warns.length ? `<b class="is-warn"></b>${empT(`浅红 ${schMergeIssues(sum.warns).length} 个：要确认，发布时写一句理由`, `${schMergeIssues(sum.warns).length} hellrot: zu bestätigen — bei der Freigabe begründen`)}` : ""}
    <span>${empT("停在格子上看具体原因；点开班次也写着。", "Details per Mouseover oder beim Öffnen der Schicht.")}</span>
  </p>`;
}

/* -------------------------------------------------------------- 发布 ----- */
function schPublishPanel(roster, sum) {
  if (state().params.get("pub") !== "1" || roster.state === "published") return "";
  const canPublish = !sum.blocks.length;
  return `<section class="card sch-publish">
    <div class="section-title">
      <div><h2>${empT("发布这周班表", "Diese Woche freigeben")}</h2>
      <p>${empT("发布后，这一版会立即显示在员工端。", "Nach der Freigabe erscheint diese Fassung sofort in der Mitarbeiter-App.")}</p></div>
      <a class="ghost-btn" href="${schHref({ pub: null })}">${empT("取消", "Abbrechen")}</a>
    </div>
    ${sum.blocks.length ? `<div class="sch-pub-block">
      <strong>${empT(`还有 ${sum.blocks.length} 个班不许排，发布不了`, `${sum.blocks.length} blockierte Schichten — Freigabe nicht möglich`)}</strong>
      <p>${empT("证件过期或缺失还在岗、不在职期内、单日工时超上限，这三类是违法用工，系统不给强行发布的口子。先改掉这些班。",
                "Abgelaufene oder fehlende Dokumente, Einsatz ausserhalb des Beschäftigungszeitraums und Überschreiten der Tageshöchstzeit sind unzulässig — dafür gibt es keine Übersteuerung.")}</p>
      <ul>${sum.blocks.slice(0, 6).map(i => `<li>${empEsc(i.name)}${i.date ? ` · ${empFormatDate(i.date)}` : ""} — ${empText(i.detail)}</li>`).join("")}</ul>
    </div>` : ""}
    ${sum.warns.length ? `<div class="sch-pub-warn">
      <strong>${empT(`有 ${sum.warns.length} 条要你确认`, `${sum.warns.length} Punkte zu bestätigen`)}</strong>
      <ul>${sum.warns.slice(0, 8).map(i => `<li>${empEsc(i.name)} — ${empText(i.detail)}</li>`).join("")}</ul>
      <label>${empT("为什么还是这样排？这条理由会跟着班表存下来。", "Warum trotzdem so? Die Begründung wird mit dem Plan gespeichert.")}
        <textarea class="sch-pub-reason" rows="2" placeholder="${empT("例如：Anna 本月自愿多上，已跟她确认改成 Teilzeit 从下月起。", "z. B.: Mit Anna abgestimmt, ab nächstem Monat Teilzeit.")}"></textarea></label>
    </div>` : ""}
    <div class="button-row">
      <button class="primary-btn sch-publish-do" ${canPublish ? "" : "disabled"}>${empT("确认发布", "Jetzt freigeben")}</button>
    </div>
  </section>`;
}

/* 员工确认收到 / 反馈班次冲突那一套删了（2026-09-03 Mingrong）：
   班表本来就是照着他自己报的时间排的 —— 再让他确认一遍，等于把「我报过了」问第二遍；
   真有事他直接找店长，或者下一周报班时避开。少一个谁也不看的状态机。 */

/* ============================================================ 岗位需求 ====
   自动排班按这里的规则补人：什么时候、什么岗位、要几个人、最低什么级别。 */
function employeeScheduleRulesPage() {
  const store = schStore();
  const rules = schDemand(store);
  const dows = [1, 2, 3, 4, 5, 6, 7];
  return `
    <div class="page-head">
      <div><h1>${empT("岗位需求", "Personalbedarf")}</h1>
      <p>${empT(`自动排班按这张表给 ${store} 补人。这里只维护每天各时段需要几个岗位，不再维护另一套班次模板。`,
                `Die automatische Planung besetzt ${store} nach diesen Regeln. Hier wird nur der Personalbedarf gepflegt, keine zweite Sammlung von Schichtvorlagen.`)}</p></div>
      <a class="ghost-btn accent-back-btn" href="#${slug("employee", "排班管理")}">${empT("返回排班管理", "Zurück: Dienstplan")}</a>
    </div>

    <section class="card">
      <div class="section-title"><div><h2>${empT("岗位需求", "Personalbedarf")}</h2>
        <p>${empT("一条规则 = 某几天的某个时段，这个岗位要几个人、最低什么级别。", "Eine Regel = an bestimmten Tagen in einem Zeitfenster: wie viele Personen welcher Rolle und Stufe.")}</p></div></div>
      <div class="table-scroll"><table class="table employee-table sch-rule-table">
        <thead><tr><th>${empT("岗位", "Rolle")}</th><th>${empT("星期", "Tage")}</th><th>${empT("时段", "Zeit")}</th>
          <th>${empT("人数", "Anzahl")}</th><th>${empT("最低级别", "Mindeststufe")}</th><th>${empT("操作", "Aktion")}</th></tr></thead>
        <tbody>
        ${rules.map(r => `<tr class="sch-rule-row" data-id="${empEsc(r.id)}">
          <td><select data-f="role">${EMP_ROLES.map(x => `<option value="${x.id}" ${x.id === r.role ? "selected" : ""}>${empText(x.name)}</option>`).join("")}</select></td>
          <td class="sch-dow-cell">${dows.map(d => `<label><input type="checkbox" data-dow="${d}" ${(r.days || []).includes(d) ? "checked" : ""}>${schDowName(d)}</label>`).join("")}</td>
          <td class="sch-time-cell"><input type="time" data-f="start" value="${r.start}"><input type="time" data-f="end" value="${r.end}"></td>
          <td><input type="number" min="1" max="20" data-f="count" value="${r.count}"></td>
          <td><select data-f="level">${EMP_LEVELS.map(x => `<option value="${x.id}" ${x.id === r.level ? "selected" : ""}>${empText(x.name)}</option>`).join("")}</select></td>
          <td><button class="ghost-btn sch-rule-save" data-id="${empEsc(r.id)}">${empT("保存", "Speichern")}</button>
              <button class="ghost-btn is-danger sch-rule-del" data-id="${empEsc(r.id)}">${empT("删除", "Löschen")}</button>
              ${empSavedBanner(r.id)}</td>
        </tr>`).join("")}
        ${rules.length ? "" : `<tr><td colspan="6" class="sch-empty">${empT("这家店还没有岗位需求。加一条，班表才知道什么叫排满。", "Noch kein Bedarf hinterlegt.")}</td></tr>`}
        </tbody>
      </table></div>
      <div class="sch-rule-new">
        <strong>${empT("新增一条", "Neue Regel")}</strong>
        <select class="sch-new-role">${EMP_ROLES.map(x => `<option value="${x.id}">${empText(x.name)}</option>`).join("")}</select>
        <span class="sch-dow-cell">${dows.map(d => `<label><input type="checkbox" class="sch-new-dow" data-dow="${d}" checked>${schDowName(d)}</label>`).join("")}</span>
        <input type="time" class="sch-new-start" value="11:00"><input type="time" class="sch-new-end" value="15:00">
        <input type="number" class="sch-new-count" min="1" max="20" value="1">
        <select class="sch-new-level">${EMP_LEVELS.map(x => `<option value="${x.id}" ${x.id === "basic" ? "selected" : ""}>${empText(x.name)}</option>`).join("")}</select>
        <button class="primary-btn sch-rule-add">${empT("添加", "Hinzufügen")}</button>
      </div>
    </section>

    <p class="sch-rule-foot">${empT("排班时点空格子，系统按他上周同一天排过的班给个默认时间，不对再改 —— 所以这里不需要维护一套班次模板。",
      "Beim Planen wird die Zeit aus der Vorwoche vorgeschlagen und kann direkt geändert werden — Schichtvorlagen sind dafür nicht nötig.")}</p>`;
}

/* ============================================================ 事件绑定 ====
   由 app.js 的 bindGlobal() 调用。全部动作都真写存储，没有只改 DOM 的假交互。 */
function schGo(href) {
  const target = String(href).replace(/^#/, "");
  if (decodeURIComponent(location.hash.replace("#", "")) === decodeURIComponent(target)) app();
  else location.hash = target;
}

function schMutate(fn) {
  const roster = schRoster(schStore(), schWeekParam());
  const next = fn(roster);
  if (next) schSaveRoster(next);
  app();
}

function schAddShift(roster, empId, date, start, end) {
  const e = empById(empId);
  if (!e) return { roster, id: null };
  const id = schShiftId(roster);
  roster.shifts.push({ id, empId, date, role: e.role,
                       start: schHHMM(schMin(start)), end: schHHMM(schMin(end)), src: "manual" });
  return { roster, id };
}

/* 已发布的班表只要改一笔就重新变草稿。否则员工拿到的是旧版本，
   店长页面却已经是新版本，两边都显示「已发布」会造成真正的现场事故。 */
function schMarkDraft(roster) {
  roster.state = "draft";
  roster.publishedAt = null;
  return roster;
}

function schDownload(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: type || "text/plain;charset=utf-8" }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function schBindAll() {
  const store = schStore();
  const week = schWeekParam();

  /* 从下面的冲突卡点进来时，要编辑的格子在屏幕上方看不见 —— 跳过去。
     本来就在视野里的（在格子里点开的）不动，免得页面无缘无故弹一下。 */
  const openCell = document.querySelector(".sch-cellwrap.is-editing");
  if (openCell) {
    const box = openCell.getBoundingClientRect();
    if (box.top < 80 || box.bottom > window.innerHeight - 40) {
      openCell.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  document.querySelectorAll(".sch-nudge").forEach(b => b.addEventListener("click", event => {
    event.preventDefault();
    schRemindAvailability(b.dataset.emp, b.dataset.week);
    b.textContent = empT("今天催过", "heute");
    b.classList.add("is-done");
  }));


  /* --- 点空格子：当场排上，并把这个班打开等着改时间 ---
     之前是点格子弹一张面板、面板上五个班次模板里再选一个。
     排一个班是一秒钟的事，不该做成两步选择。默认时间按他上周同一天排过的班给。 */
  document.querySelectorAll(".sch-add").forEach(cell => {
    cell.addEventListener("click", event => {
      event.stopPropagation();
      const roster = schRoster(store, week);
      const e = empById(cell.dataset.emp);
      if (!e) return;
      const guess = schSuggestShift(roster, e, cell.dataset.date);
      const candidate = { id: "tmp", empId: e.id, date: cell.dataset.date, role: e.role,
                          start: guess.start, end: guess.end, src: "manual" };
      const blocked = schTryAdd(roster, candidate).find(i => i.level === "block");
      if (blocked) {
        /* 说的是「Liam 的居留卡已经过期」，不是「证件」两个字。
           格子小，所以 CSS 里让闪烁文案换行显示。 */
        /* 前面加一句「排不进去」：这些数字（比如「这天净工时 16h」）说的是
           「加上这个班之后」，不是现在，不带这个前缀容易被读成现在就 16h 了。 */
        /* 用 sch-flash 而不是全站那个 is-flash：后者是「已保存」用的绿底，
           套在「排不进去」上就成了绿底红字，说的是反话（2026-09-03 Mingrong 指出）。 */
        const old = cell.textContent;
        cell.textContent = empT("排不进去 · ", "Nicht möglich · ") + empText(blocked.detail);
        cell.classList.add("sch-flash");
        setTimeout(() => { cell.textContent = old; cell.classList.remove("sch-flash"); }, 2200);
        return;
      }
      const r = schAddShift(roster, e.id, cell.dataset.date, guess.start, guess.end);
      schSaveRoster(schMarkDraft(r.roster));
      schGo(schHref({ edit: r.id }));
    });
  });

  /* --- 点已有的班：在格子里改时间或删掉，不弹面板不跳页 --- */
  document.querySelectorAll(".sch-open").forEach(b => b.addEventListener("click", event => {
    event.stopPropagation();
    const same = (state().params.get("edit") || "") === b.dataset.id;
    schGo(schHref({ edit: same ? null : b.dataset.id }));
  }));
  document.querySelectorAll(".sch-in-save").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id;
    const start = document.querySelector(`.sch-in-start[data-id="${id}"]`)?.value;
    const end = document.querySelector(`.sch-in-end[data-id="${id}"]`)?.value;
    if (!start || !end || start === end) { empFlash(b, empT("时间填全", "Zeiten angeben")); return; }
    const roster = schRoster(store, week);
    const s = roster.shifts.find(x => x.id === id);
    if (!s) return;
    const candidate = { ...s, start, end, src: "manual" };
    const blocked = schTryAdd(roster, candidate).find(i => i.level === "block");
    if (blocked) { empFlash(b, empText(blocked.title)); return; }
    s.start = start; s.end = end; s.src = "manual";
    schSaveRoster(schMarkDraft(roster));
    schGo(schHref({ edit: null }));
  }));
  document.querySelectorAll(".sch-in-del").forEach(b => b.addEventListener("click", () => {
    const roster = schRoster(store, week);
    roster.shifts = roster.shifts.filter(s => s.id !== b.dataset.id);
    schSaveRoster(schMarkDraft(roster));
    schGo(schHref({ edit: null }));
  }));

  /* --- 顶部动作 --- */
  document.querySelectorAll(".sch-ai").forEach(b => b.addEventListener("click", () => {
    schMutate(r => {
      const next = schAutoFill(r, {});
      next.log = (next.log || []);
      next.log.unshift({ at: new Date().toISOString().slice(0, 16),
        what: { zh: `自动排了 ${next.added} 个班`, de: `${next.added} Schichten automatisch geplant` } });
      delete next.added;
      return schMarkDraft(next);
    });
  }));
  document.querySelectorAll(".sch-unpublish").forEach(b => b.addEventListener("click", () => {
    schMutate(r => schUnpublish(r));
  }));
  document.querySelectorAll(".sch-publish-do").forEach(b => b.addEventListener("click", () => {
    const roster = schRoster(store, week);
    const sum = schSummary(roster);
    const box = document.querySelector(".sch-pub-reason");
    const reason = box ? box.value.trim() : "";
    if (sum.blocks.length) { empFlash(b, empT("先把排不了的班改掉", "Zuerst blockierte Schichten ändern")); return; }
    if (sum.warns.length && !reason) { empFlash(b, empT("先写一句理由", "Bitte Begründung angeben")); box?.focus(); return; }
    schSaveRoster(schPublish(roster, reason));
    schGo(schHref({ pub: null }));
  }));

  /* --- 发出去 --- */
  document.querySelectorAll(".sch-copy-group").forEach(b => b.addEventListener("click", () => {
    empCopy(schGroupText(schRoster(store, week)), b);
  }));
  document.querySelectorAll(".sch-csv").forEach(b => b.addEventListener("click", () => {
    const roster = schRoster(store, week);
    if (!roster.shifts.length) { empFlash(b, empT("这周还没排班", "Noch nichts geplant")); return; }
    schDownload(`KaiSpan_Dienstplan_${week}.csv`, schWeekCsv(roster), "text/csv;charset=utf-8");
  }));

  /* --- 岗位需求 --- */
  document.querySelectorAll(".sch-rule-save").forEach(b => b.addEventListener("click", () => {
    const row = document.querySelector(`.sch-rule-row[data-id="${b.dataset.id}"]`);
    if (!row) return;
    const days = [...row.querySelectorAll("[data-dow]")].filter(x => x.checked).map(x => Number(x.dataset.dow));
    if (!days.length) { empFlash(b, empT("至少选一天", "Mindestens einen Tag wählen")); return; }
    const next = schDemand(store).map(r => r.id !== b.dataset.id ? r : {
      ...r, role: row.querySelector('[data-f="role"]').value,
      days, start: row.querySelector('[data-f="start"]').value,
      end: row.querySelector('[data-f="end"]').value,
      count: Math.max(1, Number(row.querySelector('[data-f="count"]').value) || 1),
      level: row.querySelector('[data-f="level"]').value
    });
    schSaveDemand(store, next);
    empMarkSaved(b.dataset.id);
    app();
  }));
  document.querySelectorAll(".sch-rule-del").forEach(b => b.addEventListener("click", () => {
    schSaveDemand(store, schDemand(store).filter(r => r.id !== b.dataset.id));
    app();
  }));
  document.querySelectorAll(".sch-rule-add").forEach(b => b.addEventListener("click", () => {
    const days = [...document.querySelectorAll(".sch-new-dow")].filter(x => x.checked).map(x => Number(x.dataset.dow));
    if (!days.length) { empFlash(b, empT("至少选一天", "Mindestens einen Tag wählen")); return; }
    const list = schDemand(store);
    let n = list.length + 1;
    while (list.some(r => r.id === `d${n}`)) n += 1;
    list.push({ id: `d${n}`, role: document.querySelector(".sch-new-role").value, days,
      start: document.querySelector(".sch-new-start").value, end: document.querySelector(".sch-new-end").value,
      count: Math.max(1, Number(document.querySelector(".sch-new-count").value) || 1),
      level: document.querySelector(".sch-new-level").value });
    schSaveDemand(store, list);
    app();
  }));
}


/* ==================================================== 接首页与员工助手主页 ===
   排班做完了就得接出去，不然又是一个「做好了但界面上看不见」的模块。 */
function schHomeStat(store) {
  const next = schWeekAdd(schThisWeek(), 1);
  const nextR = schRoster(store, next);
  const thisR = schRoster(store, schThisWeek());
  return {
    store, next, nextR,
    nextState: nextR.state === "published" ? "published" : nextR.shifts.length ? "draft" : "empty",
    thisCost: schWeekCost(thisR),
    thisBlocks: schBlocks(thisR).length
  };
}

/* 员工助手主页上的那张卡。跟员工档案那张同级。
   2026-09-03 起这一块叫「排班与考勤」：工时结算搬去了工资那一侧，考勤并了进来。
   角标只说一件最要紧的事 —— 有对不上的考勤先说考勤（那是每天的事、有窗口），
   否则说下周班表发了没有。两件事都堆上去，角标就成了第二条待办清单。 */
function schHomeCard() {
  const store = schStore();
  const s = schHomeStat(store);
  const attOpen = typeof attOpenCount === "function" ? attOpenCount(store) : 0;
  const lvPend = typeof lvOpen === "function" ? lvOpen(store).length : 0;
  const tag = attOpen
    ? empPill("red", empT(`${attOpen} 条考勤对不上`, `${attOpen} Abweichungen`))
    : s.nextState === "published" ? empPill("green", empT("下周已发布", "Nächste Woche freigegeben"))
    : s.nextState === "draft" ? empPill("orange", empT("下周还是草稿", "Nächste Woche Entwurf"))
    : empPill("red", empT("下周还没排", "Nächste Woche offen"));
  const today = typeof attDayRows === "function" ? attDayRows(store, empToday()) : [];
  const punched = today.filter(r => r.rec).length;
  /* 2026-09-03（下午）：工时结算搬进这一块（考勤的月视图），所以第一行改说
     「这个月要付多少小时」—— 那才是这一块最后交出去的东西。 */
  const month = empToday().slice(0, 7);
  const hRows = typeof hrsRow === "function" && typeof hrsStaff === "function"
    ? hrsStaff(store, month).map(e => hrsRow(store, e, month)) : [];
  const payable = hRows.reduce((sum, r) => sum + r.payable, 0);
  return `<a class="emp-module is-live is-mod-sch" href="#${slug("employee", "排班管理")}">
    <div class="emp-module-head"><h2>${empT("排班与考勤", "Dienstplan und Zeiten")}</h2>${tag}</div>
    <p>${empT("员工报时间，AI 排一版，店长审核发布；当天谁真的来了、谁请假，这个月加起来该付多少小时，都在同一块。",
              "Mitarbeiter melden Zeiten, die KI plant, die Leitung gibt frei; wer da war, wer fehlt und wie viele Stunden der Monat kostet — alles hier.")}</p>
    <div class="emp-module-mini">
      <span>${empT(`本月计薪工时 ${schH(payable)} · 本周人工成本 ${schEuro(s.thisCost)}`,
                    `${schH(payable)} abzurechnen · ${schEuro(s.thisCost)} diese Woche`)}</span>
      <span>${empT(`今天 ${today.filter(r => r.shift).length} 个班，${punched} 个打了卡`,
                    `Heute ${today.filter(r => r.shift).length} Schichten, ${punched} erfasst`)}${
        lvPend ? empT(` · ${lvPend} 条休假等审批`, ` · ${lvPend} Abwesenheiten offen`) : ""}</span>
    </div>
    <span class="emp-module-cta">${empT("进入排班与考勤 →", "Zu Dienstplan und Zeiten →")}</span>
  </a>`;
}

/* 首页待办只出一件事：下周班表还没发。这是有窗口的 —— 到了周一就来不及了。
   成本、警告这些是排班页上的事，首页再放一遍就是第二遍。 */
function schTodoItems() {
  const store = schStore();
  const s = schHomeStat(store);
  const out = [];
  const days = empDaysBetween(empToday(), schWeekStart(s.next));
  if (s.nextState !== "published") {
    out.push({
      type: "排班未发布",
      title: `下周（${s.next}）的班表${s.nextState === "empty" ? "还没排" : "还是草稿，没发给员工"}，距离下周一还有 ${days} 天`,
      /* de：员工助手主页在 .emp-page 里，全站词典翻译够不着，德语得自己带 */
      de: `Dienstplan für nächste Woche (${s.next}) ${s.nextState === "empty" ? "ist noch nicht erstellt" : "ist noch ein Entwurf und nicht freigegeben"} — noch ${days} Tage bis Montag`,
      module: "员工助手", store,
      due: days <= 2 ? "尽快处理" : "本周到期", risk: days <= 2 ? "高风险" : "中风险", status: "未处理",
      href: `#${slug("employee", "排班管理")}?w=${s.next}`
    });
  }
  return out;
}

/* ============================================================== 月视图 ====
   周视图回答「这周怎么排」，月视图回答「这个月长什么样、上个月是怎么排的」。
   原来的「历史班表」是三行假记录，翻历史只能靠一周一周点箭头 —— 换成日历。
   一格一天：几个班、都有谁、净工时、有没有排不满。点一天跳回那周的周视图。
   ========================================================================== */
function schMonthParam() {
  const m = state().params.get("m") || "";
  return /^\d{4}-\d{2}$/.test(m) ? m : empToday().slice(0, 7);
}

function schView() {
  const v = state().params.get("v");
  if (v === "leave") return "leave";
  /* v=hours 是旧书签：工时结算现在是「考勤与工时」的月视图，由 app.js 在路由里转过去。
     这里只认周和月两种看法。 */
  return v === "month" ? "month" : "week";
}

function schMonthAdd(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function schMonthName(month) {
  const [y, m] = month.split("-").map(Number);
  const de = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  return empDe() ? `${de[m - 1]} ${y}` : `${y} 年 ${m} 月`;
}

/* 一个月要跨五六个周表，按周缓存，别一天读一次。 */
function schMonthCells(store, month) {
  const first = `${month}-01`;
  const start = schWeekStart(schWeekOf(first));
  const last = empShiftDate(schMonthAdd(month, 1) + "-01", -1);
  const total = empDaysBetween(start, last) + 1;
  const rows = Math.ceil(total / 7);
  const cache = {};
  const out = [];
  for (let i = 0; i < rows * 7; i += 1) {
    const date = empShiftDate(start, i);
    const w = schWeekOf(date);
    if (!cache[w]) cache[w] = schRoster(store, w);
    const roster = cache[w];
    const shifts = roster.shifts.filter(s => s.date === date)
      .sort((a, b) => schMin(a.start) - schMin(b.start));
    out.push({
      date, week: w, shifts, cost: schDayCost(roster, date),
      published: roster.state === "published",
      net: shifts.reduce((s, x) => s + schHours(x).net, 0),
      inMonth: date.slice(0, 7) === month
    });
  }
  return out;
}

function schMonthGrid(store, month) {
  const cells = schMonthCells(store, month);
  const head = [1, 2, 3, 4, 5, 6, 7].map(d => `<th>${schDowName(d)}</th>`).join("");
  const body = [];
  for (let i = 0; i < cells.length; i += 7) {
    body.push(`<tr>${cells.slice(i, i + 7).map(c => schMonthCell(c)).join("")}</tr>`);
  }
  return `<table class="sch-month"><thead><tr>${head}</tr></thead><tbody>${body.join("")}</tbody></table>`;
}

function schMonthCell(c) {
  const names = c.shifts.map(s => {
    const e = empById(s.empId);
    return e ? { name: e.name, role: e.role } : null;
  }).filter(Boolean);
  const uniq = [];
  names.forEach(x => { if (!uniq.some(u => u.name === x.name)) uniq.push(x); });
  const show = uniq.slice(0, 3);
  const rest = uniq.length - show.length;
  return `<td class="sch-mcell ${c.inMonth ? "" : "is-out"} ${c.date === empToday() ? "is-today" : ""}">
    <a href="${schHref({ v: null, w: c.week, m: null, sel: null, gap: null, gaps: null })}">
      <span class="sch-mday">${Number(c.date.slice(8))}${c.shifts.length
        ? `<i class="sch-mdot ${c.published ? "is-pub" : "is-draft"}" title="${c.published ? empT("已发布", "freigegeben") : empT("草稿", "Entwurf")}"></i>` : ""}</span>
      ${c.shifts.length ? `<span class="sch-mcount">${empT(`${c.shifts.length} 个班`, `${c.shifts.length} Schichten`)}</span>` : ""}
      <span class="sch-mnames">${show.map(x => `<i class="sch-mchip ${x.role}">${empEsc(x.name)}</i>`).join("")}${rest ? `<i class="sch-mmore">+${rest}</i>` : ""}</span>
      ${c.shifts.length ? `<span class="sch-mnet">${schH(c.net)} · ${schEuro(c.cost)}</span>` : ""}
    </a></td>`;
}

function schMonthView(store) {
  const month = schMonthParam();
  const cells = schMonthCells(store, month).filter(c => c.inMonth);
  /* 「47 个班」这个数没人拿它做决定（2026-09-03 Mingrong）：月历里每天写着几个班，
     真正要看的是这个月一共多少工时、多少钱。 */
  const net = cells.reduce((s, c) => s + c.net, 0);
  const cost = cells.reduce((s, c) => s + c.cost, 0);
  const draftWeeks = [...new Set(cells.filter(c => !c.published && c.shifts.length).map(c => c.week))];
  return `
    <section class="sch-weekbar">
      <div class="sch-weeknav">
        ${schStepper(
          schHref({ m: schMonthAdd(month, -1) }),
          schHref({ m: schMonthAdd(month, 1) }),
          schMonthName(month),
          empT(`${schH(net)} · 人工成本 ${schEuro(cost)}`, `${schH(net)} · ${schEuro(cost)}`),
          [empT("上一个月", "Vorheriger Monat"), empT("下一个月", "Nächster Monat")])}
        ${month === empToday().slice(0, 7) ? "" : `<a class="sch-jump" href="${schHref({ m: empToday().slice(0, 7) })}">${
          empT("回到本月", "Aktueller Monat")}</a>`}
        <span class="sch-bar-sep"></span>
        ${schPeriodToggle("month", schWeekOf(`${month}-15`))}
      </div>
    </section>

    <section class="card sch-month-card" id="sch-month-calendar">
      <div class="section-title">
        <div><h2>${empT("月历", "Monatsübersicht")}</h2>
        <p>${empT("点任意一天，回到那一周的班表去改。", "Auf einen Tag klicken, um zur Wochenansicht zu wechseln.")}</p></div>
        ${draftWeeks.length ? empPill("orange", empT(`${draftWeeks.length} 周还是草稿`, `${draftWeeks.length} Wochen im Entwurf`)) : ""}
      </div>
      ${schMonthGrid(store, month)}
      <div class="sch-legend">
        <span><i class="sch-mdot is-pub"></i>${empT("已发布", "Freigegeben")}</span>
        <span><i class="sch-mdot is-draft"></i>${empT("草稿，还没发给员工", "Entwurf")}</span>
        <a href="#${slug("employee", "考勤")}?v=month&m=${month}">${empT("这个月的工时结算 →", "Zur Stundenabrechnung →")}</a>
      </div>
    </section>`;
}
