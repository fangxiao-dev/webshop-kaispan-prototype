/* ==========================================================================
   KaiSpan · 考勤（打卡 → 异常 → 处理 → 工时）
   --------------------------------------------------------------------------
   在 schedule.js 之后、hours.js 之前以 defer 加载，前缀 att。

   原来这一块是三个假页面：「员工打卡」六行写死的表、「考勤与休假」一张混在一起
   的大表、「考勤处理决议」一个填了没人读的 textarea。全删了。

   这一版的链条一条走到底，中间没有手填的环节：

     员工手机上点「上班」 → 取定位、算到门店的距离
       → 和班表上的这个班比：迟到？早退？超时？位置不符？没打下班？
       → 有问题的进店长的待处理清单，店长必须给一个决议（认可 / 补签 / 记缺勤）
       → 决议落到当天的计薪工时，直接进 hours.js 的月度结算
       → 超出班次的部分不会自动变成钱：要么店长点「转加班申请」走审批，要么不算

   两条边界写在这里，页面上也写明，不假装：
     1. 定位是浏览器给的，只能证明「打卡时手机在这个坐标附近」，
        既挡不住把手机交给同事，也挡不住模拟定位。它是个提示，不是考勤锁。
     2. 没有后端，打卡时间就是这台设备的本地时间。改系统时间就能改打卡时间。
        真实产品里时间必须由服务器盖章。
   ========================================================================== */

const ATT_KEY = "kaispanAttendance";   /* 打卡记录 */
const ATT_SITE_KEY = "kaispanAttSite"; /* 按门店存的打卡坐标 */

/* ---------------------------------------------------------------- 存储 --- */
/* 种子要读班表，而班表的种子又会调 schAutoFill → hrsPayableNet → attAdjust →
   回到这里。不设防就是无限递归（排班那边为同一件事设过 schSeeding）。
   生成期间这里一律返回空表：那一刻本来就还没有任何打卡记录。 */
let attSeeding = false;

function attAll() {
  const saved = empRead(ATT_KEY, null);
  if (saved) return saved;
  if (attSeeding) return [];
  /* 更要命的一种：排班自己正在生成种子（schSeeding）时，schRoster 对别的周返回空表。
     这时候生成考勤种子会得到一张空表，还会被写进磁盘再也不重算 ——
     第一版就是这么翻的车：73 条「整个班没打卡」，因为那一刻班表一个班都读不到。
     等排班种子生成完，下一次调用再种。 */
  if (typeof schSeeding !== "undefined" && schSeeding) return [];
  attSeeding = true;
  let seed = [];
  try { seed = attSeed(); } finally { attSeeding = false; }
  empWrite(ATT_KEY, seed);
  return seed;
}

function attSaveAll(list) {
  empWrite(ATT_KEY, list);
  return list;
}

function attSiteAll() {
  return empRead(ATT_SITE_KEY, null) || attSiteSeed();
}

/* 门店坐标故意只种一家。
   另外两家留空 = 「这家店还没设打卡位置」，正好把那条提示和那个动作演示出来；
   三家全填好看不出系统在管这件事，而且那两个坐标本来就是编的。 */
function attSiteSeed() {
  return { "Martin Biergarten": { lat: 48.13774, lng: 11.57549, setAt: null, by: null } };
}

function attSite(store) {
  const hit = attSiteAll()[store];
  return hit && typeof hit.lat === "number" && typeof hit.lng === "number" ? hit : null;
}

function attSetSite(store, lat, lng, by) {
  const all = { ...attSiteAll() };
  all[store] = { lat: Number(lat), lng: Number(lng), setAt: empNow(), by: by || empT("店长", "Leitung") };
  empWrite(ATT_SITE_KEY, all);
  return all[store];
}

function attClearSite(store) {
  const all = { ...attSiteAll() };
  delete all[store];
  empWrite(ATT_SITE_KEY, all);
}

/* --------------------------------------------------------------- 参数 --- */
function attGrace() { return Number(empRule("punchGraceMin")) || 0; }
function attRadius() { return Number(empRule("punchRadiusM")) || 0; }

/* ------------------------------------------------------------- 地理 ----- */
/* 半正矢公式。几百米的尺度上用平面近似也够，但写全了省得以后有人问准不准。 */
function attDistance(a, b) {
  if (!a || !b) return null;
  const R = 6371000;
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(s))));
}

/* 打卡那一刻的位置判定。三种结果，UI 上说的是三句不同的话：
     ok:true   在范围内
     ok:false  在范围外，写清楚差多少米
     ok:null   判不了 —— 要么门店没设坐标，要么手机没给定位 */
function attGeoJudge(store, pos) {
  const site = attSite(store);
  if (!pos || typeof pos.lat !== "number") {
    return { lat: null, lng: null, acc: null, dist: null, ok: null, why: pos?.why || "nogeo" };
  }
  const base = { lat: pos.lat, lng: pos.lng, acc: pos.acc == null ? null : Math.round(pos.acc) };
  if (!site) return { ...base, dist: null, ok: null, why: "nosite" };
  const dist = attDistance(site, pos);
  return { ...base, dist, ok: dist <= attRadius(), why: null };
}

function attByStore(store, date) {
  return attAll().filter(r => (!store || r.store === store) && (!date || r.date === date));
}

function attByMonth(store, month) {
  return attByStore(store).filter(r => String(r.date).slice(0, 7) === month);
}

function attById(id) {
  return attAll().find(r => r.id === id) || null;
}

function attNextId() {
  const list = attAll();
  let n = list.length + 1;
  while (list.some(r => r.id === `t${n}`)) n += 1;
  return `t${n}`;
}

/* 当天排的班。考勤是按「一个班」记的，不是按「一天」——
   餐饮的两头班（11–15 和 17–22）是同一天的两个班，合成一条就分不出
   哪一头迟到了。 */
function attShifts(store, empId, date) {
  if (typeof schRoster !== "function") return [];
  const roster = schRoster(store, schWeekOf(date));
  return schShiftsOf(roster, empId, date);
}

function attShiftById(store, empId, date, shiftId) {
  return attShifts(store, empId, date).find(s => s.id === shiftId) || null;
}

/* ============================================================ 时间与工时 ==
   跨夜班（17:00–01:00）在这里同样是常态，所以所有比较都换算成
   「以班次当天 00:00 为零点的绝对分钟数」，01:05 打的下班卡 = 1505 分钟。 */

function attNowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/* 把一个 HH:MM 落到参考点附近的那一天。差 12 小时以上就往前后挪一天。 */
function attNear(min, ref) {
  let v = min;
  while (v - ref > 720) v -= 1440;
  while (ref - v > 720) v += 1440;
  return v;
}

function attPlanMin(shift) {
  if (!shift) return null;
  return { start: schMin(shift.start), end: schEndMin(shift.start, shift.end) };
}

/* 一条记录实际生效的起止时间。决议会覆盖打卡：
     fix    店长补签的时间
     plan   就按班表上排的算（设备坏了、忘带手机）
     absent 这天不算工时
   没有决议时用打卡本身。 */
function attEffective(rec, shift) {
  const d = rec.decision;
  if (d && d.kind === "absent") return null;
  if (d && d.kind === "fix" && d.start && d.end) return { start: d.start, end: d.end, src: "fix" };
  if (d && d.kind === "plan" && shift) return { start: shift.start, end: shift.end, src: "plan" };
  if (rec.in && rec.in.at && rec.out && rec.out.at) return { start: rec.in.at, end: rec.out.at, src: "punch" };
  return null;
}

/* { span 在店, brk 休息, net 净 }，单位小时。休息时间和排班用同一条规则，
   不让人手填（标准 3）。 */
function attHoursOf(start, end) {
  if (!start || !end) return { span: 0, brk: 0, net: 0 };
  const s = schMin(start);
  const e = attNear(schMin(end), s + 1);
  const span = Math.max(0, e - s);
  const brk = schBreakFor(span);
  return { span: span / 60, brk, net: Math.max(0, span - brk) / 60 };
}

function attNetOf(rec, shift) {
  const eff = attEffective(rec, shift);
  return eff ? attHoursOf(eff.start, eff.end).net : 0;
}

function attPlannedNet(shift) {
  return shift ? schHours(shift).net : 0;
}

/* 计薪净工时。三条规则，都是为了不让工资被几分钟的零头带着走：
     1. 宽限之内按班表算。早两分钟到、晚三分钟走都算准时 —— 既然算准时，
        就该按排的时间计薪。否则每个班都比班表少几分钟，一个月凭空少几小时，
        而这几小时谁也说不清是哪来的。
     2. 超出宽限的迟到、早退，按实际打卡往下减。
     3. 上限永远是班表排的那么多。多干的部分不会自己变成钱 ——
        要么店长点「转加班申请」走 hours.js 的审批，要么不算。 */
function attPayableNet(rec, shift) {
  const d = rec && rec.decision;
  if (d && d.kind === "absent") return 0;
  if (d && d.kind === "plan") return attPlannedNet(shift);
  if (d && d.kind === "fix" && d.start && d.end) {
    const n = attHoursOf(d.start, d.end).net;
    return shift ? Math.min(n, attPlannedNet(shift)) : n;
  }
  if (!rec || !rec.in || !rec.in.at || !rec.out || !rec.out.at) return 0;
  if (!shift) return attHoursOf(rec.in.at, rec.out.at).net;
  const grace = attGrace();
  const plan = attPlanMin(shift);
  const inMin = attNear(schMin(rec.in.at), plan.start);
  const outMin = attNear(schMin(rec.out.at), plan.end);
  const start = inMin - plan.start > grace ? schHHMM(inMin) : shift.start;
  const end = plan.end - outMin > grace ? schHHMM(outMin) : shift.end;
  return Math.min(attHoursOf(start, end).net, attPlannedNet(shift));
}

/* 超出班次多久。量的是「比班表晚收工多少」，不是「实做减去应做」——
   后者会把迟到和超时抵掉：迟到 20 分钟又晚走 60 分钟的人，实做只多 40 分钟，
   可他确实在班次结束后又干了一小时，而迟到那 20 分钟已经在计薪里扣过了。
   两笔分开算，不然同一件事扣一次又算一次。 */
function attExcess(rec, shift) {
  if (!shift || !rec || !rec.out || !rec.out.at) return 0;
  if (rec.decision && (rec.decision.kind === "absent" || rec.decision.kind === "plan")) return 0;
  const plan = attPlanMin(shift);
  const outMin = attNear(schMin(rec.out.at), plan.end);
  const over = (outMin - plan.end) / 60;
  return over > attGrace() / 60 ? Math.round(over * 100) / 100 : 0;
}

/* ============================================================ 状态推导 ===
   全部算出来，一个都不让人手选（标准 3）。
   返回一串 { code, level, zh, de }，level: 'bad' 要处理 / 'note' 只提示。 */
function attIssues(rec, shift, today, store) {
  const out = [];
  const t = today || empToday();
  /* 休假优先于考勤（2026-09-03 定的口径）。批了假的那天他本来就不上班 ——
     报「整个班没有打卡记录」是错的，让店长去「记缺勤」更错：缺勤是无故不来。
     这一天归休假管，考勤这边只显示一行说明。 */
  const lvStore = store || (rec && rec.store) || null;
  const lvEmp = (rec && rec.empId) || (shift && shift.empId) || null;
  const lvDate = (rec && rec.date) || (shift && shift.date) || null;
  if (lvStore && lvEmp && lvDate && typeof lvOn === "function") {
    const lv = lvOn(lvStore, lvEmp, lvDate);
    if (lv) {
      return [{ code: "onleave", level: "note",
        zh: `${empRaw(lvType(lv.type).name.zh)}（${empFormatDate(lv.from)}–${empFormatDate(lv.to)}），这天不算考勤`,
        de: `${lvType(lv.type).name.de} (${lv.from}–${lv.to}) — kein Zeiterfassungsfall` }];
    }
  }
  const grace = attGrace();
  const past = rec ? attPastShift(rec.date, shift, t) : attPastShift(null, shift, t);
  const add = (code, level, zh, de) => out.push({ code, level, zh, de });

  /* 记录存在但一次卡都没打，也算没打卡 —— 被拦下的尝试会先建出一条空记录来，
     不这么写的话「在 449 米外试了两次」反而把缺卡这条盖掉了。 */
  if (!rec || (!rec.in && !rec.out)) {
    const tries = rec && rec.attempts ? rec.attempts.length : 0;
    if (tries) {
      const far = rec.attempts[rec.attempts.length - 1].dist;
      add("farblock", "bad", `打卡被拦下 ${tries} 次：最近一次离门店 ${far} 米，超出允许的 ${attRadius()} 米`,
          `${tries} Erfassungsversuche abgewiesen, zuletzt ${far} m von der Filiale`);
    }
    if (rec && rec.helpAsk) {
      add("helpask", "bad", "员工说自己在店里但打不上卡，等你补签",
          "Mitarbeiter bittet um Nacherfassung");
    }
    const since = attFirstDay();
    if (shift && past && !tries && (!since || (lvDate || shift.date) >= since)) {
      add("nopunch", "bad", "整个班没有打卡记录", "Keine Zeiterfassung für diese Schicht");
    }
    if (!rec) return out;
    if (!shift && !tries && !rec.helpAsk) add("unplanned", "bad", "这天没有排班，但有打卡动作", "Erfassung ohne geplante Schicht");
    return out;
  }
  if (!shift) add("unplanned", "bad", "这天没有排班，但打了卡", "Erfasst ohne geplante Schicht");
  if (rec.helpAsk) add("helpask", "bad", "员工说自己在店里但打不上卡，等你补签", "Mitarbeiter bittet um Nacherfassung");
  if ((rec.attempts || []).length) {
    const far = rec.attempts[rec.attempts.length - 1].dist;
    add("farblock", "note", `另有 ${rec.attempts.length} 次打卡被拦下（最近一次 ${far} 米）`,
        `${rec.attempts.length} Versuche abgewiesen (zuletzt ${far} m)`);
  }

  if (rec.in && !rec.out) {
    if (past) add("open", "bad", "打了上班没打下班", "Kommt erfasst, Gehen fehlt");
    else add("running", "note", "班上到一半，还没打下班", "Schicht läuft");
  }
  if (!rec.in && rec.out) add("noin", "bad", "只有下班卡，没有上班卡", "Nur Gehen erfasst");

  if (shift && rec.in && rec.in.at) {
    const plan = attPlanMin(shift);
    const inMin = attNear(schMin(rec.in.at), plan.start);
    const late = inMin - plan.start;
    if (late > grace) add("late", "bad", `迟到 ${late} 分钟`, `${late} Minuten zu spät`);
    else if (late < -60) add("early_in", "note", `提前 ${-late} 分钟到`, `${-late} Minuten früher da`);
  }
  if (shift && rec.out && rec.out.at) {
    const plan = attPlanMin(shift);
    const outMin = attNear(schMin(rec.out.at), plan.end);
    const diff = outMin - plan.end;
    if (diff < -grace) add("early", "bad", `早退 ${-diff} 分钟`, `${-diff} Minuten zu früh gegangen`);
    if (diff > grace) add("over", "bad", `超出班次 ${diff} 分钟`, `${diff} Minuten über Plan`);
  }

  /* 位置：只看上班那一次。下班时人已经在店里干了一天，再判一次没有信息量。
     ok === false 现在几乎不会出现 —— 超范围在 attPunch 里就被拦下了，进不到记录里。
     留着这一条是为了老记录和店长补的卡。 */
  const geo = rec.in && rec.in.geo;
  if (geo && geo.ok === false) {
    add("far", "bad", `打卡位置离门店 ${geo.dist} 米，超出允许范围`, `${geo.dist} m von der Filiale entfernt`);
  } else if (rec.in && (!geo || geo.ok == null)) {
    const why = geo && geo.why === "nosite" ? "门店还没设打卡位置" : "没取到定位";
    const deWhy = geo && geo.why === "nosite" ? "Für die Filiale ist kein Standort hinterlegt" : "Kein Standort verfügbar";
    add("nogeo", "note", `${why}，位置没法核对`, `${deWhy} — Standort nicht prüfbar`);
  }
  return out;
}

/* 这个班是不是已经过去了。今天的班要等到结束（加宽限）才算「该打的卡没打」，
   不然中午十二点就开始报晚班的人缺卡。 */
function attPastShift(date, shift, today) {
  const t = today || empToday();
  const d = date || (shift ? shift.date : null);
  if (!d) return false;
  if (d < t) return true;
  if (d > t) return false;
  if (!shift) return true;
  return attNowMin() > attPlanMin(shift).end + attGrace();
}

/* 要不要店长处理：有 bad 级问题且还没给决议。
   一切正常的记录不需要任何点击就直接进工时 —— 那是算出来的，不是勾出来的。 */
function attNeedsDecision(rec, shift, today, store) {
  if (rec && rec.decision) return false;
  return attIssues(rec, shift, today, store).some(i => i.level === "bad");
}

/* 这条记录在工时上算不算数了。异常没处理的先不进结算，
   月度结算页会写明「还有 N 条没处理，这个数还会变」。 */
function attSettled(rec, shift, today, store) {
  if (rec && rec.decision) return true;
  return !attNeedsDecision(rec, shift, today, store);
}

/* ============================================================ 配对与汇总 ==
   一行 = 一个班次（或一条没有班次的计划外打卡）。
   schRoster 每次调用都会深拷一份，按天调会调几百次 —— 所以按周取一次，
   范围内的班次先摊平，再和打卡记录配对。 */
function attRangePairs(store, from, to, empId) {
  const shifts = [];
  if (typeof schRoster === "function") {
    const seen = new Set();
    let week = schWeekOf(from);
    const lastWeek = schWeekOf(to);
    for (let i = 0; i < 60; i += 1) {
      if (seen.has(week)) break;
      seen.add(week);
      schRoster(store, week).shifts.forEach(s => {
        if (s.date >= from && s.date <= to && (!empId || s.empId === empId)) shifts.push(s);
      });
      if (week === lastWeek) break;
      week = schWeekAdd(week, 1);
    }
  }
  const recs = attAll().filter(r => r.store === store && r.date >= from && r.date <= to
    && (!empId || r.empId === empId));
  const used = new Set();
  const pairs = shifts.map(shift => {
    const rec = recs.find(r => r.shiftId === shift.id && r.empId === shift.empId && r.date === shift.date);
    if (rec) used.add(rec.id);
    return { shift, rec: rec || null, empId: shift.empId, date: shift.date };
  });
  recs.filter(r => !used.has(r.id)).forEach(rec => {
    pairs.push({ shift: null, rec, empId: rec.empId, date: rec.date });
  });
  return pairs.sort((a, b) => a.date.localeCompare(b.date)
    || schMin(a.shift ? a.shift.start : a.rec.in?.at || "00:00") - schMin(b.shift ? b.shift.start : b.rec.in?.at || "00:00"));
}

/* 一行要显示的全部数字，表格、清单和结算都从这里取，不各算一遍。 */
function attRow(pair, today, store) {
  const { shift, rec } = pair;
  const e = empById(pair.empId);
  /* store 一定要一路传下去：没有它就查不到这天有没有批过假，
     结果是「病假那天没打卡」照样进待处理 —— 休假优先于考勤这条口径就断了。 */
  const st = store || (rec && rec.store) || pair.store;
  const issues = attIssues(rec, shift, today, st);
  return {
    e, shift, rec, date: pair.date,
    issues,
    bad: issues.filter(i => i.level === "bad"),
    needs: attNeedsDecision(rec, shift, today, st),
    settled: attSettled(rec, shift, today, st),
    plan: attPlannedNet(shift),
    net: rec ? attNetOf(rec, shift) : 0,
    payable: rec ? attPayableNet(rec, shift) : 0,
    excess: rec ? attExcess(rec, shift) : 0
  };
}

function attDayRows(store, date) {
  return attRangePairs(store, date, date).map(p => attRow(p, empToday(), store))
    .filter(r => r.e)
    .sort((a, b) => (b.needs ? 1 : 0) - (a.needs ? 1 : 0)
      || schMin(a.shift ? a.shift.start : a.rec?.in?.at || "00:00") - schMin(b.shift ? b.shift.start : b.rec?.in?.at || "00:00"));
}

/* 待处理清单往回看到哪儿。
   写死 14 天是错的：9 月 3 号封 8 月的账时，工资那边要求「这个月的考勤都处理完」，
   而 8 月 1-19 号根本不在 14 天窗口里 —— 店长看不到，却封不上账。
   所以窗口跟着工资走：回看到上个月 1 号（至少 14 天）。
   再往前的月度已经封账报给税务师了，翻出来改只会让报出去的数字变。 */
function attLookback() {
  const d = new Date(`${empToday()}T00:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const first = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  return Math.max(14, empDaysBetween(first, empToday()));
}

/* 考勤是从某一天才开始有数据的（系统上线、或者门店开始用打卡）。
   在那之前的班次没有打卡记录是理所当然的，不该报「整个班没打卡」——
   否则往回翻一个月就是几十条永远处理不完的假异常，把真的那几条彻底盖住。 */
function attFirstDay() {
  const list = attAll();
  if (!list.length) return null;
  return list.reduce((m, r) => (!m || r.date < m ? r.date : m), null);
}

function attOpenRows(store, today) {
  const t = today || empToday();
  return attRangePairs(store, empShiftDate(t, -attLookback()), t)
    .map(p => attRow(p, t, store))
    .filter(r => r.e && r.needs)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function attOpenCount(store, today) {
  return attOpenRows(store, today).length;
}

/* ------------------------------------------------------------ 进工时 ---- */
/* 只看有记录的行。没有记录的未来班次不能拿来减 —— 那些工时排班里已经算过了，
   在这里再减一遍等于把整月清零。 */
function attAdjust(store, empId, month) {
  const first = `${month}-01`;
  return attRangeAdjust(store, empId, first, empShiftDate(`${hrsMonthAddRaw(month, 1)}-01`, -1));
}

/* 任意区间的考勤调整。工时页面日 / 周 / 月三个视图算的是同一条链，只是区间不同。 */
function attRangeAdjust(store, empId, from, to) {
  const t = empToday();
  return attByStore(store)
    .filter(r => r.empId === empId && String(r.date) >= from && String(r.date) <= to)
    .reduce((sum, rec) => {
      /* 这天批了假 → 归 lvAdjust 算。两边都算就会把同一天的工时加减两遍。 */
      if (typeof lvOn === "function" && lvOn(store, empId, rec.date)) return sum;
      const shift = attShiftById(store, empId, rec.date, rec.shiftId);
      if (!attSettled(rec, shift, t, store)) return sum;
      return sum + attPayableNet(rec, shift) - attPlannedNet(shift);
    }, 0);
}

/* 这个月还有几条考勤没处理。月度结算上那句「这个数还会变」就靠它。 */
function attMonthPending(store, month, empId) {
  const t = empToday();
  const first = `${month}-01`;
  const last = empShiftDate(hrsMonthAddRaw(month, 1) + "-01", -1);
  return attRangePairs(store, first, last > t ? t : last, empId)
    .map(p => attRow(p, t, store))
    .filter(r => r.e && r.needs).length;
}

/* ============================================================== 写入 =====
   打卡、补签、决议、转加班。每一笔都往 rec.log 里记一条 ——
   「这条考勤为什么是现在这个数」必须查得出来，查工来问的就是这个。 */

function attBlank(store, empId, date, shiftId) {
  return { id: attNextId(), store, empId, date, shiftId: shiftId || null,
           in: null, out: null, decision: null, otId: null, log: [] };
}

function attWrite(rec, entry) {
  const list = attAll().slice();
  if (entry) rec.log = [entry, ...(rec.log || [])].slice(0, 20);
  const i = list.findIndex(r => r.id === rec.id);
  if (i >= 0) list[i] = rec; else list.push(rec);
  attSaveAll(list);
  return rec;
}

function attEnsure(store, empId, date, shiftId) {
  const hit = attAll().find(r => r.store === store && r.empId === empId
    && r.date === date && (r.shiftId || null) === (shiftId || null));
  return hit ? JSON.parse(JSON.stringify(hit)) : attBlank(store, empId, date, shiftId);
}

/* 打卡。kind = "in" | "out"。
   班次自己认：上班卡认当天最靠近这个时间、还没人打过上班的那个班；
   下班卡认当天已经打了上班还没打下班的那条记录。
   认不出来也照记 —— 没排班却来上班是真会发生的事，记下来让店长处理，
   比拒绝打卡好。 */
function attPunch(store, empId, date, kind, opts) {
  const o = opts || {};
  const at = o.at || schHHMM(attNowMin());
  const src = o.src === "manager" ? "manager" : "self";
  const by = o.by || (src === "manager" ? empT("店长", "Leitung") : empById(empId)?.name || "");
  const geo = src === "manager" ? null : attGeoJudge(store, o.pos || null);
  const mine = attAll().filter(r => r.store === store && r.empId === empId && r.date === date);

  /* 超出允许范围就不让打卡（Mingrong 2026-09-03 拍板）。
     只在「判得出来而且确实超了」时拦 —— 门店没设坐标、手机没给定位属于「判不了」，
     不是「太远」，那两种照旧允许打卡并标出来。系统自己没配好，不该由员工来担。
     拦下不等于当没发生：把这次尝试和当时的距离记进 attempts，
     店长那边会看到「他在 449 米外试了两次」。 */
  if (geo && geo.ok === false) {
    const rec = attNoteAttempt(store, empId, date, kind, at, geo, by, mine);
    return { ok: false, code: "far", dist: geo.dist, radius: attRadius(), rec };
  }

  if (kind === "out") {
    const open = mine.filter(r => r.in && !r.out).sort((a, b) => schMin(b.in.at) - schMin(a.in.at))[0];
    /* 没有开着的那一条时，「下班打卡」还能成立的只有一种情况：忘了打上班卡，
       现在要走了 —— 那条只有下班时间的记录是真事，店长那边会看到「没打上班卡」。
       但今天已经有一条打完整的、而且是同一个班的记录时，再来一次就不是那回事了：
       会凭空多出一条只有 out 的异常，挂在店长的待处理里，谁也说不清它是什么。
       （2026-09-04：从员工端点不出来，但数据层不该留这个口子。） */
    if (!open) {
      /* 还没被任何记录认领的班：有这么一个班，才说得通「他上了这个班，只是忘了打上班卡」。
         一个都没有，而今天已经打完过卡，那这一下就是重复点，不该建记录。 */
      const claimed = new Set(mine.filter(r => r.in || r.out).map(r => r.shiftId).filter(Boolean));
      const free = attShifts(store, empId, date).filter(x => !claimed.has(x.id));
      const doneToday = mine.some(r => r.in && r.out);
      if (!free.length && doneToday) {
        return { ok: false, code: "done", rec: mine.find(r => r.in && r.out) };
      }
    }
    const rec = open ? JSON.parse(JSON.stringify(open)) : attBlank(store, empId, date, null);
    if (!open) rec.shiftId = attGuessShift(store, empId, date, at, mine)?.id || null;
    if (rec.out) return { ok: false, code: "done", rec };
    rec.out = { at, ts: empNow(), src, by, geo };
    attWrite(rec, { at: empNow(), by, what: { zh: `下班打卡 ${at}`, de: `Gehen erfasst ${at}` } });
    return { ok: true, code: "out", rec };
  }

  const shift = attGuessShift(store, empId, date, at, mine);
  const rec = attEnsure(store, empId, date, shift?.id || null);
  if (rec.in) return { ok: false, code: "done", rec };
  rec.in = { at, ts: empNow(), src, by, geo };
  /* 走近几步自己打上了，之前那条「请店长补签」就该撤回 ——
     否则店长清单上永远挂着一条已经不需要他做的事。尝试记录留着，那是事实。 */
  const hadHelp = !!rec.helpAsk;
  if (hadHelp) delete rec.helpAsk;
  attWrite(rec, { at: empNow(), by, what: hadHelp
    ? { zh: `上班打卡 ${at}（自己打上了，撤回补签请求）`, de: `Kommen erfasst ${at} — Bitte um Nacherfassung zurückgezogen` }
    : { zh: `上班打卡 ${at}`, de: `Kommen erfasst ${at}` } });
  return { ok: true, code: "in", rec };
}

/* 被拦下的那一次也要留痕。没有它，店长只看到「整个班没打卡」，
   而真相是这个人在 449 米外试了两次 —— 这两件事该做的处理完全不一样。 */
function attNoteAttempt(store, empId, date, kind, at, geo, by, mine) {
  const shift = kind === "out"
    ? ((mine || []).filter(r => r.in && !r.out)[0] || {}).shiftId || attGuessShift(store, empId, date, at, mine)?.id || null
    : attGuessShift(store, empId, date, at, mine)?.id || null;
  const rec = attEnsure(store, empId, date, shift);
  rec.attempts = [...(rec.attempts || []), { at, ts: empNow(), kind, dist: geo.dist }].slice(-10);
  attWrite(rec, { at: empNow(), by, what: {
    zh: `${kind === "out" ? "下班" : "上班"}打卡被拦下：离门店 ${geo.dist} 米，超出允许的 ${attRadius()} 米`,
    de: `Erfassung abgewiesen: ${geo.dist} m von der Filiale, zulässig sind ${attRadius()} m` } });
  return rec;
}

/* 拦下之后员工唯一能做的动作：把球踢给店长。
   不给这个出口，被拦下的人只能站在门口反复点打卡 —— 那是死路，不是闭环。 */
function attAskHelp(store, empId, date, why) {
  const mine = attAll().filter(r => r.store === store && r.empId === empId && r.date === date);
  const withTry = mine.filter(r => (r.attempts || []).length).slice(-1)[0];
  const rec = withTry ? JSON.parse(JSON.stringify(withTry))
    : attEnsure(store, empId, date, attGuessShift(store, empId, date, schHHMM(attNowMin()), mine)?.id || null);
  const last = (rec.attempts || []).slice(-1)[0];
  rec.helpAsk = { at: empNow(), dist: last ? last.dist : null, why: (why || "").trim() };
  attWrite(rec, { at: rec.helpAsk.at, by: empById(empId)?.name || "",
    what: { zh: `员工说自己在店里但打不上卡，请店长补签${rec.helpAsk.why ? `：${rec.helpAsk.why}` : ""}`,
            de: `Mitarbeiter bittet um Nacherfassung${rec.helpAsk.why ? `: ${rec.helpAsk.why}` : ""}` } });
  return rec;
}

/* 挑班次：当天还没打过上班卡的班里，开始时间离现在最近的那个。 */
function attGuessShift(store, empId, date, at, mine) {
  const taken = new Set((mine || []).filter(r => r.in).map(r => r.shiftId));
  const list = attShifts(store, empId, date).filter(s => !taken.has(s.id));
  if (!list.length) return null;
  const now = schMin(at);
  return list.slice().sort((a, b) =>
    Math.abs(attNear(schMin(a.start), now) - now) - Math.abs(attNear(schMin(b.start), now) - now))[0];
}

/* 店长的决议。四种，覆盖了实际会遇到的全部情形：
     ok      照打卡记（也用来批准「没排班但确实来上班了」）
     fix     补签：按店长填的时间记，留痕写明改前改后
     plan    按班表记（打卡机坏了、手机没电）
     absent  记缺勤，这天 0 小时 */
function attDecide(store, empId, date, shiftId, kind, opts) {
  const o = opts || {};
  const rec = attEnsure(store, empId, date, shiftId);
  const shift = attShiftById(store, empId, date, shiftId);
  const by = o.by || empT("店长", "Leitung");
  const before = attEffective(rec, shift);
  rec.decision = { kind, by, at: empNow(), why: (o.why || "").trim(),
                   start: o.start || null, end: o.end || null };
  const label = {
    ok: { zh: "认可打卡记录", de: "Erfassung bestätigt" },
    fix: { zh: `补签为 ${o.start}–${o.end}${before ? `（原 ${before.start}–${before.end}）` : "（原来没有打卡）"}`,
           de: `Nacherfassung ${o.start}–${o.end}${before ? ` (vorher ${before.start}–${before.end})` : " (keine Erfassung)"}` },
    plan: { zh: "按班表上排的时间记", de: "Nach Dienstplan gewertet" },
    absent: { zh: "记为缺勤，这天不计工时", de: "Als Fehlzeit gewertet, keine Stunden" }
  }[kind] || { zh: "处理", de: "Bearbeitet" };
  const why = rec.decision.why ? empT(`：${rec.decision.why}`, `: ${rec.decision.why}`) : "";
  attWrite(rec, { at: rec.decision.at, by, what: { zh: label.zh + why, de: label.de + why } });
  return rec;
}

/* 撤销决议。处理错了要能退回去重来 —— 不给退路，店长就只能不敢点。 */
function attUndoDecision(recId, by) {
  const rec = attById(recId);
  if (!rec || !rec.decision) return null;
  const next = JSON.parse(JSON.stringify(rec));
  next.decision = null;
  attWrite(next, { at: empNow(), by: by || empT("店长", "Leitung"),
                   what: { zh: "撤销处理，退回待处理", de: "Bearbeitung zurückgenommen" } });
  return next;
}

/* 超出班次的部分转成加班申请，走 hours.js 里已有的审批 ——
   不在这里再造一套「考勤加班」，那会变成两个地方各算一份加班。
   批准之前它一分钱都不进工资。 */
function attToOvertime(recId, by) {
  const rec = attById(recId);
  if (!rec) return null;
  const shift = attShiftById(rec.store, rec.empId, rec.date, rec.shiftId);
  const hours = attExcess(rec, shift);
  if (!hours || typeof hrsAddOt !== "function") return null;
  const reason = empT(`打卡比班表晚收工 ${Math.round(hours * 60)} 分钟`,
                      `${Math.round(hours * 60)} Minuten über Plan laut Zeiterfassung`);
  /* hrsAddOt 返回的是整张表（新的一条 unshift 在最前），不是单条记录。 */
  const list = hrsAddOt(rec.store, rec.empId, rec.date, Math.round(hours * 4) / 4, reason);
  const next = JSON.parse(JSON.stringify(attById(recId)));
  next.otId = Array.isArray(list) && list[0] ? list[0].id : null;
  next.decision = { kind: "ok", by: by || empT("店长", "Leitung"), at: empNow(),
                    why: empT("超出部分已提交加班审批", "Mehrstunden zur Freigabe eingereicht"),
                    start: null, end: null };
  attWrite(next, { at: next.decision.at, by: next.decision.by,
                   what: { zh: `认可打卡，超出的 ${schH(hours)} 提交加班审批`,
                           de: `Erfassung bestätigt, ${schH(hours)} zur Freigabe eingereicht` } });
  return next;
}

/* ============================================================== 种子 =====
   往回铺四天的打卡。绝大多数是正常的（差几分钟，位置在范围内），
   然后把每一类异常都种一条出来 —— 不然「异常处理」这条路演示时是空的，
   店长永远看不到它长什么样：

     昨天  第 1 个班  迟到 22 分钟
     昨天  第 3 个班  打卡位置离门店 450 米
     昨天           一个没排班的人打了卡（真会发生：临时被叫来顶班）
     前天  第 1 个班  打了上班没打下班
     前天  第 2 个班  比班表晚收工 50 分钟 → 可转加班
     三天前 第 1 个班 整个班一次卡都没打

   没设打卡坐标的门店，记录照样有，位置那一栏是「判不了」——
   正好把「先去设一下门店位置」那条提示演示出来。 */
function attSeedJitter(key, span) {
  let h = 7;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 99991;
  return (h % (span * 2 + 1)) - span;
}

function attSeedPos(site, meters) {
  if (!site) return { why: "nosite" };
  return { lat: site.lat + meters / 111320, lng: site.lng, acc: 12 };
}

function attSeed() {
  const t = empToday();
  const main = empStores()[0];
  const script = {
    1: { 0: { kind: "late", min: 22 }, 2: { kind: "far" } },
    2: { 0: { kind: "open" }, 1: { kind: "over", min: 50 } },
    3: { 0: { kind: "skip" } }
  };
  const out = [];
  let seq = 0;
  const nid = () => `t${(seq += 1)}`;

  empStores().forEach(store => {
    const site = attSite(store);
    /* 铺满整个待处理窗口。只铺四天，窗口里更早的十天每个班都是「整个班没打卡」，
       打开页面 73 条待处理 —— 那不是演示，那是噪音。 */
    /* 种子铺 14 天。待处理窗口比这个长（要跟工资封账对齐），但更早的日子没有打卡数据
       是理所当然的 —— attFirstDay() 会让那些日子不报缺卡，所以种子不用铺那么长。 */
    for (let back = 14; back >= 0; back -= 1) {
      const date = empShiftDate(t, -back);
      const shifts = (typeof schRoster === "function" ? schRoster(store, schWeekOf(date)).shifts : [])
        .filter(s => s.date === date)
        .sort((a, b) => schMin(a.start) - schMin(b.start) || String(a.empId).localeCompare(String(b.empId)));

      shifts.forEach((s, i) => {
        const plan = store === main ? (script[back] || {})[i] : null;
        if (plan && plan.kind === "skip") return;
        const e = empById(s.empId);
        if (!e) return;
        /* 今天只种已经开始的班：已经结束的种成一条完整记录，正在上的只种上班卡
           （员工端那张卡就是「班上着，还没打下班」的样子）。还没到点的班不种 ——
           那些卡本来就还没打，种出来就是假的。 */
        /* 批了假的那天不该有打卡记录 —— 种一条出来就是自相矛盾的演示数据。 */
        if (typeof lvOn === "function" && lvOn(store, s.empId, date)) return;
        const nowMin = attNowMin();
        const started = back > 0 || schMin(s.start) <= nowMin;
        const ended = back > 0 || schEndMin(s.start, s.end) + 20 < nowMin;
        if (!started) return;
        const jIn = attSeedJitter(`${s.empId}${date}i`, 4);
        const jOut = attSeedJitter(`${s.empId}${date}o`, 4);
        const inMin = schMin(s.start) + (plan && plan.kind === "late" ? plan.min : jIn);
        const outMin = schEndMin(s.start, s.end) + (plan && plan.kind === "over" ? plan.min : jOut);

        /* 超范围现在是硬拦，所以「位置不符」不能种成一条打成了的卡 ——
           那在新规则下根本不可能存在。种成它真实的样子：两次被拦下，然后请店长补签。 */
        if (plan && plan.kind === "far") {
          const dist = 449;
          out.push({ id: nid(), store, empId: s.empId, date, shiftId: s.id,
            in: null, out: null, decision: null, otId: null,
            attempts: [
              { at: schHHMM(schMin(s.start) - 6), ts: `${date}T${schHHMM(schMin(s.start) - 6)}`, kind: "in", dist: 462 },
              { at: schHHMM(schMin(s.start) + 2), ts: `${date}T${schHHMM(schMin(s.start) + 2)}`, kind: "in", dist }
            ],
            helpAsk: { at: `${date}T${schHHMM(schMin(s.start) + 4)}`, dist,
                       why: empT("我在后院卸货，手机定位一直飘", "Ich war im Hinterhof, die Ortung springt") },
            log: [{ at: `${date}T${schHHMM(schMin(s.start) + 4)}`, by: e.name,
                    what: { zh: "员工说自己在店里但打不上卡，请店长补签：我在后院卸货，手机定位一直飘",
                            de: "Mitarbeiter bittet um Nacherfassung: war im Hinterhof, Ortung springt" } }] });
          return;
        }

        const pos = attSeedPos(site, 30 + attSeedJitter(`${s.empId}${date}g`, 25));
        const rec = { id: nid(), store, empId: s.empId, date, shiftId: s.id,
                      in: { at: schHHMM(inMin), ts: `${date}T${schHHMM(inMin)}`, src: "self",
                            by: e.name, geo: attGeoJudge(store, pos) },
                      out: null, decision: null, otId: null, log: [] };
        if (ended && !(plan && plan.kind === "open")) {
          rec.out = { at: schHHMM(outMin), ts: `${date}T${schHHMM(outMin % 1440)}`, src: "self",
                      by: e.name, geo: null };
        }
        rec.log = [{ at: rec.in.ts, by: e.name,
                     what: { zh: `上班打卡 ${rec.in.at}`, de: `Kommen erfasst ${rec.in.at}` } }];
        out.push(rec);
      });

      /* 没排班却来上班了：昨天，主店，找一个当天没班的人。 */
      if (store === main && back === 1) {
        const busy = new Set(shifts.map(s => s.empId));
        const free = empStaff(store).find(e => !busy.has(e.id) && !empStatus(e.status).leaving
          && (!e.entryDate || e.entryDate <= date));
        if (free) {
          out.push({ id: nid(), store, empId: free.id, date, shiftId: null,
                     in: { at: "10:00", ts: `${date}T10:00`, src: "self", by: free.name,
                           geo: attGeoJudge(store, attSeedPos(site, 40)) },
                     out: { at: "14:30", ts: `${date}T14:30`, src: "self", by: free.name, geo: null },
                     decision: null, otId: null,
                     log: [{ at: `${date}T10:00`, by: free.name,
                             what: { zh: "上班打卡 10:00", de: "Kommen erfasst 10:00" } }] });
        }
      }
    }
  });
  return out;
}

/* ============================================================== 页面 ===== */
function attStore() {
  return empScope() || empStores()[0];
}

function attDate() {
  const d = state().params.get("d") || "";
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : empToday();
}

/* 考勤和工时是同一份数据的两个读法：考勤说「时间实际怎么发生的」，
   工时说「这些时间按钱怎么算」。所以这一页按时间尺度分三个视图（2026-09-03 Mingrong 定）：
     日 —— 今天谁的卡对不上，一条条处理（每天都做的事）
     周 —— 这一周排的 vs 真做的，谁已经超了、谁还差着（周中扫一眼）
     月 —— 就是工时结算那张表：已排 / 考勤 / 休假 / 加班 → 计薪工时 → 预估工资（每月做一次）
   工时结算从「工时与工资」搬了过来 —— 处理一条迟到，计薪工时当场就变，
   这条因果链本来跨着两个模块，看不见。工资那一块因此变成纯粹的钱：封账 → 工资单 → 发薪。 */
function attScale() {
  const v = state().params.get("v") || "";
  return ["week", "month"].includes(v) ? v : "day";
}

/* 切换尺度时落到哪一天（2026-09-03 Mingrong：在 9 月视图点「日」变成 9 月 15 号，是 bug）——
   原来传的锚点是月中那一天（`${month}-15`），切回「日」就落在 15 号。
   规则应该是：今天在这段时间里就落到今天；这段时间已经过完了就落到最后一天；
   还没开始就落到第一天。 */
function attScaleToggle(active, from, to) {
  const today = empToday();
  const day = today >= from && today <= to ? today : to < today ? to : from;
  const link = (id, label, patch) => `<a class="${active === id ? "is-on" : ""}" href="${attHref(patch)}">${label}</a>`;
  return `<div class="sch-period">
    ${link("day", empT("日", "Tag"), { v: null, d: day, w: null, m: null, fix: null })}
    ${link("week", empT("周", "Woche"), { v: "week", w: schWeekOf(day), d: null, m: null, fix: null })}
    ${link("month", empT("月", "Monat"), { v: "month", m: day.slice(0, 7), d: null, w: null, fix: null })}
  </div>`;
}

/* 周视图落在哪一周 / 月视图落在哪个月。都从 URL 读，读不到就回到今天所在的那一周 / 那个月。 */
function attWeek() {
  const w = state().params.get("w") || "";
  return /^\d{4}-W\d{2}$/.test(w) ? w : schThisWeek();
}

function attHref(patch) {
  const p = new URLSearchParams(state().params.toString());
  Object.keys(patch).forEach(k => {
    if (patch[k] == null || patch[k] === "") p.delete(k);
    else p.set(k, patch[k]);
  });
  const q = p.toString();
  return `#${slug("employee", "考勤")}${q ? `?${q}` : ""}`;
}

function attRowKey(row) {
  return `${row.e.id}|${row.date}|${row.shift ? row.shift.id : "x"}`;
}

function attDayLabel(date) {
  const t = empToday();
  if (date === t) return empT("今天", "Heute");
  if (date === empShiftDate(t, -1)) return empT("昨天", "Gestern");
  if (date === empShiftDate(t, 1)) return empT("明天", "Morgen");
  return schDowName(schDow(date));
}

function attGeoCell(rec) {
  const geo = rec && rec.in && rec.in.geo;
  if (rec && !rec.in && (rec.attempts || []).length) {
    const far = rec.attempts[rec.attempts.length - 1].dist;
    return `<span class="att-geo is-far">${far} m<small>${empT("被拦下", "abgewiesen")}</small></span>`;
  }
  if (!rec || !rec.in) return `<span class="att-dim">—</span>`;
  if (!geo || geo.ok == null) {
    return `<span class="att-dim" title="${geo && geo.why === "nosite"
      ? empT("这家店还没设打卡位置", "Kein Filialstandort hinterlegt")
      : empT("手机没给定位", "Kein Standort vom Gerät")}">${empT("判不了", "Nicht prüfbar")}</span>`;
  }
  return geo.ok
    ? `<span class="att-geo is-ok">${geo.dist} m</span>`
    : `<span class="att-geo is-far">${geo.dist} m</span>`;
}

/* 这个班算多少钱：计薪工时 × 时薪。固定月薪的人不摊到班上 ——
   把月薪除出来的那个数是编的，不该摆在一行记录里。 */
function attMoneySettled(row) {
  /* 班还没走完（打了上班还没打下班）时 payable 是 0 —— 那不是「这个班值 0 块」，
     是「还没结完」。这种和完全没打卡的一样，暂按班表算，并且写明是暂的。 */
  return !!(row.rec && (row.rec.decision || (row.rec.in && row.rec.out)));
}

function attMoneyOf(row) {
  const c = row.e.contract || {};
  if (c.payType === "pauschal") return 0;
  const hours = attMoneySettled(row) ? row.payable : row.plan;
  return hours * (Number(c.rate) || 0);
}

function attMoney(row) {
  const c = row.e.contract || {};
  if (c.payType === "pauschal") return `<span class="att-dim">${empT("固定月薪", "Festgehalt")}</span>`;
  const soft = !attMoneySettled(row);
  return `<span class="${soft ? "att-dim" : ""}" title="${soft
    ? empT("这个班还没结完，暂按班表算", "Schicht noch nicht abgeschlossen — vorläufig nach Plan")
    : empT("计薪工时 × 时薪", "Abrechenbare Stunden × Stundenlohn")}">${schEuro(attMoneyOf(row))}</span>`;
}

function attStatePill(row) {
  const onLeave = row.issues.find(i => i.code === "onleave");
  if (onLeave) return empPill("purple", empText({ zh: onLeave.zh.split("（")[0], de: onLeave.de.split(" (")[0] }));
  if (row.rec && row.rec.decision) {
    const k = row.rec.decision.kind;
    const name = { ok: empT("照打卡", "Bestätigt"), fix: empT("已补签", "Nacherfasst"),
                   plan: empT("按班表", "Nach Plan"), absent: empT("记缺勤", "Fehlzeit") }[k] || empT("已处理", "Erledigt");
    return empPill(k === "absent" ? "gray" : "blue", name);
  }
  if (row.needs) return empPill("red", empT("待处理", "Offen"));
  if (row.rec && row.rec.in && !row.rec.out) return empPill("orange", empT("班上着", "Läuft"));
  if (!row.rec) return empPill("gray", empT("还没打卡", "Noch nichts erfasst"));
  return empPill("green", empT("正常", "In Ordnung"));
}

function attIssueText(row) {
  if (!row.issues.length) return "";
  return `<div class="att-issues">${row.issues.map(i =>
    `<span class="att-issue is-${i.level}">${empText({ zh: i.zh, de: i.de })}</span>`).join("")}</div>`;
}

function employeeAttendancePage() {
  const store = attStore();
  const scale = attScale();
  const site = attSite(store);
  const warn = site ? "" : `<div class="card att-warn">
      <strong>${empT(`${store} 还没设打卡位置`, `Für ${store} ist kein Standort hinterlegt`)}</strong>
      <p>${empT("没有门店坐标就没法核对打卡位置，所有打卡的位置那一栏都会是「判不了」。在门店里打开合规设置，点一下「用当前位置设为门店位置」就行。",
                "Ohne Filialkoordinaten lässt sich der Erfassungsort nicht prüfen. In der Filiale die Compliance-Einstellungen öffnen und den aktuellen Standort übernehmen.")}</p>
      <a class="ghost-btn" href="#${slug("employee", "合规设置")}">${empT("去设置门店位置", "Standort hinterlegen")}</a>
    </div>`;
  /* 「定位打卡是怎么判的」这类口径说明搬进了页头的「使用说明」（2026-09-03 Mingrong）——
     它一年只需要读一次，不该每天在页底占一行。 */

  const inner = scale === "month" ? attMonthView(store, warn)
              : scale === "week" ? attWeekView(store, warn)
              : attDayView(store, warn);
  return typeof schShell === "function" ? schShell("att", inner) : inner;
}

/* --- 日：今天谁的卡对不上，一条条处理。每天都要做的事，所以是默认视图。 --- */
function attDayView(store, warn) {
  const date = attDate();
  const rows = attDayRows(store, date);
  const open = attOpenRows(store);
  return `${warn}
    <section class="sch-weekbar">
      <div class="sch-weeknav">
        ${schStepper(
          attHref({ d: empShiftDate(date, -1), fix: null }),
          date >= empToday() ? null : attHref({ d: empShiftDate(date, 1), fix: null }),
          empFormatDate(date), attDayLabel(date),
          [empT("前一天", "Vorheriger Tag"), empT("后一天", "Nächster Tag")])}
        ${date === empToday() ? "" : `<a class="sch-jump" href="${attHref({ d: empToday(), fix: null })}">${
          empT("回到今天", "Heute")}</a>`}
        <span class="sch-bar-sep"></span>
        ${attScaleToggle("day", date, date)}
      </div>
    </section>
    ${attDayTable(store, date, rows)}
    ${attOpenPanel(store, open, date)}`;
}

/* --- 周：排的 vs 真做的。排班页回答「排了多少」，这里回答「真做了多少、差多少」——
       周三扫一眼就知道谁已经超了、谁还差着，而不是等到月底结算才发现。 --- */
function attWeekView(store, warn) {
  const week = attWeek();
  const days = schWeekDays(week);
  const today = empToday();
  /* 只算到今天为止：周三看这一周，后面四天的班还没上，把它们算进「排的」
     会让每个人都挂着一个吓人的负数。「这一周总共排了多少」是排班页那一列的事。 */
  const last = days[6] < today ? days[6] : today;
  const rows = (typeof hrsStaff === "function" ? hrsStaff(store, days[3].slice(0, 7)) : [])
    .map(e => hrsRangeRow(store, e, days[0], days[6]))
    .filter(r => r.planned || r.att || r.lv || r.ot || r.attPending)
    .sort((a, b) => a.e.name.localeCompare(b.e.name));
  const plan = rows.reduce((n, r) => n + r.planned, 0);
  const real = rows.reduce((n, r) => n + r.payable, 0);

  return `${warn}
    <section class="sch-weekbar">
      <div class="sch-weeknav">
        ${schStepper(
          attHref({ w: schWeekAdd(week, -1), fix: null }),
          week >= schThisWeek() ? null : attHref({ w: schWeekAdd(week, 1), fix: null }),
          schWeekRange(week),
          `${week === schThisWeek() ? empT("本周 · ", "Diese Woche · ") : ""}${
            empT(`第 ${Number(week.slice(6))} 周`, `KW ${Number(week.slice(6))}`)}`,
          [empT("上一周", "Vorherige Woche"), empT("下一周", "Nächste Woche")])}
        ${week === schThisWeek() ? "" : `<a class="sch-jump" href="${attHref({ w: schThisWeek(), fix: null })}">${
          empT("回到本周", "Heute")}</a>`}
        <span class="sch-bar-sep"></span>
        ${attScaleToggle("week", days[0], days[6])}
      </div>
    </section>

    ${rows.length ? hrsScaleTable(store, rows, {
      title: { zh: "这一周每个人的考勤和工时", de: "Zeiten und Stunden dieser Woche" },
      note: { zh: `只算到 ${empFormatDate(last)} 为止 —— 后面还没上的班不算进来。「排的」来自班表，「考勤」是打卡处理完之后相对班表的增减；还没处理的异常不算，那些数还会变。`,
              de: `Bis ${empFormatDate(last)} — künftige Schichten zählen nicht mit. „Plan“ aus dem Dienstplan, „Ist-Zeit“ die bearbeitete Abweichung; offene Abweichungen sind nicht enthalten.` },
      right: `<span class="wl-count is-plain">${empT(`排 ${schH(plan)} · 做 ${schH(real)}`, `Plan ${schH(plan)} · Ist ${schH(real)}`)}</span>`
    }) : `<section class="card"><p class="att-empty">${days[0] > today
      ? empT("这一周还没开始。", "Diese Woche hat noch nicht begonnen.")
      : empT("这一周既没有排班，也没有打卡记录。", "Für diese Woche gibt es weder Schichten noch Erfassungen.")}</p></section>`}`;
}

/* --- 月：就是工时结算那张表。它算的就是这个月的考勤加起来该付多少小时的钱，
       所以它属于这里，不属于工资那一侧 —— 工资那边从「封账」开始。 --- */
function attMonthView(store, warn) {
  const month = state().params.get("m") && /^\d{4}-\d{2}$/.test(state().params.get("m"))
    ? state().params.get("m") : empToday().slice(0, 7);
  return `${warn}
    <section class="sch-weekbar">
      <div class="sch-weeknav">
        ${schStepper(
          attHref({ m: schMonthAdd(month, -1), fix: null }),
          month >= empToday().slice(0, 7) ? null : attHref({ m: schMonthAdd(month, 1), fix: null }),
          schMonthName(month),
          empT("到今天为止该付多少小时", "Abzurechnende Stunden bis heute"),
          [empT("上一个月", "Vorheriger Monat"), empT("下一个月", "Nächster Monat")])}
        ${month === empToday().slice(0, 7) ? "" : `<a class="sch-jump" href="${attHref({ m: empToday().slice(0, 7), fix: null })}">${
          empT("回到本月", "Aktueller Monat")}</a>`}
        <span class="sch-bar-sep"></span>
        ${attScaleToggle("month", `${month}-01`, empShiftDate(`${schMonthAdd(month, 1)}-01`, -1))}
      </div>
      <div class="sch-week-actions">
        <a class="ghost-btn" href="#${slug("employee", "工资单与发薪")}?m=${month}">${
          empT("核完去封账 →", "Weiter zum Abschluss →")}</a>
      </div>
    </section>
    ${typeof hrsView === "function" ? hrsView(store)
      : `<section class="card"><p>${empT("工时模块没有加载。", "Modul nicht geladen.")}</p></section>`}`;
}

/* 待处理清单。跨日期，因为异常不会当天就被发现 ——
   店长周一早上打开考勤，要看到的是「上周还有三条没结掉」，
   而不是自己一天一天往回翻。

   2026-09-03 三处改动（Mingrong）：
   ① 挪到「当天考勤」后面 —— 打开考勤第一件事是看今天谁的卡对不上，回头账排第二；
   ② 当天那几条不再在这里重复列一遍。它们就在上面那张表里，一行一个，
      右边还带着同一个「处理」按钮。同一件事在一屏上出现两次，
      店长处理完上面那条，会以为下面那条是另一条；
   ③ 样子照 HACCP 那张「全部表单 · 最近 7 天」来：一行一件事、横向读得完、
      动作永远在最右边同一列，而不是一张一张占半屏的卡片。 */
function attOpenPanel(store, open, date) {
  const rest = open.filter(r => r.date !== date);
  /* 2026-09-03（Mingrong：我点 8 月 13 号还能看到 9 月 3 号没处理的，是不是 bug）——
     不是数据错，是范围说错了。这张清单是「从今天往回数 33 天」的整个欠账，
     跟你正在看哪一天没关系；挂在 8 月 13 号那一天下面，就变成了在说
     「8 月 13 号还有 9 月 3 号的事没办」。
     所以只在看今天的时候把它整张列出来；翻到别的日子时收成一行，
     写清楚它属于「今天」那个视角，并且给一条回去的路。 */
  if (date !== empToday()) {
    return rest.length ? `<p class="wl-empty">${empT(
      `别的日子还有 ${rest.length} 条没处理 —— 那张清单按「今天往回数 ${attLookback()} 天」列，`,
      `An anderen Tagen sind ${rest.length} Fälle offen — die Liste zählt ${attLookback()} Tage ab heute zurück, `)}<a href="${
      attHref({ d: empToday(), fix: null })}">${empT("回到今天看 →", "zurück zu heute →")}</a></p>` : "";
  }
  if (!rest.length) {
    if (open.length) {
      return `<p class="wl-empty">${empT(
        `除了今天这几条，最近 ${attLookback()} 天没有别的没处理的。`,
        `Außer den heutigen Fällen ist in den letzten ${attLookback()} Tagen nichts offen.`)}</p>`;
    }
    return `<section class="card att-clear">
      <strong>${empT("没有待处理的考勤", "Keine offenen Abweichungen")}</strong>
      <p>${empT(`最近 ${attLookback()} 天的打卡和班表都对得上，或者都已经处理过了。这些工时已经进了月度结算。`,
                `Die letzten ${attLookback()} Tage stimmen mit dem Dienstplan überein oder sind bearbeitet. Die Stunden sind im Monatsabschluss.`)}</p></section>`;
  }
  return `<section class="card wl-card att-open">
    <div class="section-title">
      <div><h2>${empT("别的日子还没处理的", "Offen an anderen Tagen")}</h2>
      <p>${empT(`最近 ${attLookback()} 天里对不上的。处理完才进这个月的工时 —— 在此之前月度结算里的数还会变。`,
                `Abweichungen der letzten ${attLookback()} Tage. Erst nach Bearbeitung zählen sie im Monatsabschluss.`)}</p></div>
      <span class="wl-count">${empT(`${rest.length} 条`, `${rest.length}`)}</span>
    </div>
    <div class="wl-wrap">
      <table class="wl-table">
        <thead><tr>
          <th>${empT("哪天", "Tag")}</th><th>${empT("谁", "Wer")}</th>
          <th>${empT("班次", "Schicht")}</th><th>${empT("对不上什么", "Abweichung")}</th><th></th>
        </tr></thead>
        <tbody>${rest.map(r => `<tr>
          <td class="wl-day"><strong>${empFormatDate(r.date)}</strong><small>${attDayLabel(r.date)}</small></td>
          <td class="wl-who"><strong>${empEsc(r.e.name)}</strong><small>${empText(empRole(r.e.role).name)}</small></td>
          <td>${r.shift ? `${r.shift.start}–${r.shift.end}` : `<span class="att-dim">${empT("没有排班", "Ohne Schicht")}</span>`}</td>
          <td class="wl-why">${r.bad.map(i => empText({ zh: i.zh, de: i.de })).join(" · ")}</td>
          <td class="wl-act"><a class="ghost-btn att-openitem" href="${attHref({ d: r.date, fix: attRowKey(r) })}">${
            empT("处理", "Bearbeiten")}</a></td>
        </tr>`).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

function attDayTable(store, date, rows) {
  const editing = state().params.get("fix") || "";
  if (!rows.length) {
    return `<section class="card">
      <div class="section-title"><h2>${empT("当天考勤", "Tagesübersicht")}</h2></div>
      <p class="att-empty">${empT("这天既没有排班，也没有打卡记录。", "Für diesen Tag gibt es weder Schichten noch Erfassungen.")}</p>
    </section>`;
  }
  /* 日视图也要看得到工时（2026-09-03 Mingrong）：三个尺度回答的是同一件事，
     只是粒度不同 —— 这一天排了多少、真做了多少，就写在标题右边。 */
  /* 2026-09-03（Mingrong：这两个表有点重复）：日视图原来是「一行一个班的考勤表」
     加一张「一行一个人的工时表」。一天之内这两张表说的几乎是同一批数 ——
     区别只有「一个人当天两个班」这一种情况，而那一种恰恰要按班处理。
     所以合成一张：还是一行一个班（处理动作只能落在具体某个班上），
     但把钱直接加成一列 —— 这个班算多少小时、值多少钱，一行读完。 */
  const dayPlan = rows.reduce((n, r) => n + r.plan, 0);
  const dayReal = rows.reduce((n, r) => n + (attMoneySettled(r) ? r.payable : 0), 0);
  const dayCost = rows.reduce((n, r) => n + attMoneyOf(r), 0);
  return `<section class="card att-card">
    <div class="section-title">
      <div><h2>${empT("当天考勤与工时", "Zeiten und Stunden des Tages")}</h2>
      <p>${empT("一行一个班。「实做」是扣掉法定休息后的净工时，上限是班表排的那么多；多干的部分要转成加班申请才算钱。还没处理的班按班表算。",
                "Eine Zeile je Schicht. „Ist“ ist die Nettozeit nach gesetzlicher Pause, gedeckelt auf den Plan; Mehrstunden zählen erst nach Freigabe. Offene Schichten zählen nach Plan.")}</p></div>
      <span class="wl-count is-plain">${empT(`排 ${schH(dayPlan)} · 做 ${schH(dayReal)} · ${schEuro(dayCost)}`,
                                             `Plan ${schH(dayPlan)} · Ist ${schH(dayReal)} · ${schEuro(dayCost)}`)}</span>
    </div>
    <div class="att-tablewrap">
      <table class="table att-table">
        <thead><tr>
          <th>${empT("员工", "Mitarbeiter")}</th>
          <th>${empT("排班", "Plan")}</th>
          <th>${empT("打卡 · 位置", "Erfasst · Standort")}</th>
          <th>${empT("实做 / 计划", "Ist / Plan")}</th>
          <th>${empT("工资", "Lohn")}</th>
          <th>${empT("状态", "Status")}</th>
          <th></th>
        </tr></thead>
        <tbody>${rows.map(r => {
          const key = attRowKey(r);
          const on = editing === key;
          return `<tr class="${r.needs ? "att-bad" : ""} ${on ? "is-editing" : ""}">
            <td><strong>${empEsc(r.e.name)}</strong><small>${empText(empRole(r.e.role).name)}</small></td>
            <td>${r.shift ? `${r.shift.start}–${r.shift.end}` : `<span class="att-dim">${empT("没有排班", "Ohne Schicht")}</span>`}</td>
            <td class="att-punch">${r.rec && (r.rec.in || r.rec.out)
              ? `<strong>${r.rec.in ? r.rec.in.at : "—"} → ${r.rec.out ? r.rec.out.at : "—"}</strong>`
              : `<span class="att-dim">—</span>`}
              <small>${attGeoCell(r.rec)}</small></td>
            <td>${r.rec || (r.rec && r.rec.decision) ? `${schH(r.payable)} <small>/ ${schH(r.plan)}</small>` : `<span class="att-dim">— / ${schH(r.plan)}</span>`}</td>
            <td>${attMoney(r)}</td>
            <td>${attStatePill(r)}${attIssueText(r)}</td>
            <td><a class="ghost-btn att-open-btn" href="${attHref({ d: date, fix: on ? null : key })}">${
              on ? empT("收起", "Schließen") : r.needs ? empT("处理", "Bearbeiten") : empT("查看", "Ansehen")}</a></td>
          </tr>${on ? `<tr class="att-editrow"><td colspan="7">${attFixPanel(r)}</td></tr>` : ""}`;
        }).join("")}</tbody>
      </table>
    </div>
  </section>`;
}

/* 行内处理面板。不弹窗、不跳页 —— 跟排班点格子改时间是同一个做法。
   四个决议都在这里，每一个都写明它对工时的影响是多少小时，
   免得店长点完还得自己去月度结算里对一遍。 */
function attFixPanel(row) {
  const { e, shift, rec } = row;
  const eff = rec ? attEffective(rec, shift) : null;
  const start = (eff && eff.start) || (shift && shift.start) || "09:00";
  const end = (eff && eff.end) || (shift && shift.end) || "17:00";
  const key = attRowKey(row);
  const dset = `data-emp="${e.id}" data-date="${row.date}" data-shift="${shift ? shift.id : ""}" data-rec="${rec ? rec.id : ""}"`;
  /* 按钮上写的是「这么点会记多少小时」，所以必须是封顶之后的数。
     写没封顶的 4.83h，点下去记的却是 4h —— 按钮在骗人。 */
  const fixRaw = attHoursOf(start, end).net;
  const fixNet = shift ? Math.min(fixRaw, row.plan) : fixRaw;
  const d = rec && rec.decision;

  return `<div class="att-fix">
    <div class="att-fix-head">
      <strong>${empEsc(e.name)} · ${empFormatDate(row.date)}</strong>
      <span>${shift ? empT(`班表 ${shift.start}–${shift.end}，净 ${schH(row.plan)}`, `Plan ${shift.start}–${shift.end}, netto ${schH(row.plan)}`)
                    : empT("这天没有排班", "Keine geplante Schicht")}</span>
    </div>

    ${row.issues.length ? `<ul class="att-fix-issues">${row.issues.map(i =>
      `<li class="is-${i.level}">${empText({ zh: i.zh, de: i.de })}</li>`).join("")}</ul>` : ""}

    ${d ? `<p class="att-fix-done">${empT("已处理", "Bearbeitet")}：${empEsc(d.by)} · ${empStamp(d.at)}${
      d.why ? ` · ${empEsc(d.why)}` : ""} · ${empT(`计入 ${schH(row.payable)}`, `gewertet ${schH(row.payable)}`)}</p>` : ""}

    <div class="att-fix-grid">
      <label>${empT("上班", "Kommen")}<input type="time" class="att-in-start" ${dset} value="${start}"></label>
      <label>${empT("下班", "Gehen")}<input type="time" class="att-in-end" ${dset} value="${end}"></label>
      <label class="att-fix-why">${empT("理由（补签和缺勤必须写）", "Begründung (bei Nacherfassung und Fehlzeit Pflicht)")}
        <input class="att-in-why" ${dset} placeholder="${empT("例如：打卡机没反应，本人 11:00 到店，两位同事可以证明",
          "z. B. Erfassung fehlgeschlagen, Ankunft 11:00, von zwei Kollegen bestätigt")}"></label>
    </div>

    <div class="att-fix-actions">
      ${/* 按钮上的小时数跟着上面两个时间输入框走（2026-09-03 Mingrong：改了时间，
           「按这个时间记」上的总额没变）。原来这行字是渲染那一刻算出来的，
           改完时间不重算，读起来就是「我改了它没反应」。绑定在 attBindAll 里。 */""}
      <button class="primary-btn att-do" data-kind="fix" data-plan="${shift ? row.plan : ""}" ${dset}>${
        empT(`按这个时间记（净 ${schH(fixNet)}）`, `So werten (netto ${schH(fixNet)})`)}</button>
      <span class="att-fix-cap"${fixRaw > fixNet + 0.01 ? "" : ' hidden'}>${empT(
        `这段时间净 ${schH(fixRaw)}，超出班表的 ${schH(fixRaw - fixNet)} 不会自动进工资 —— 要算就走加班申请`,
        `Netto ${schH(fixRaw)}; ${schH(fixRaw - fixNet)} über Plan zählen nur nach Freigabe als Mehrstunden`)}</span>
      ${rec && rec.in && rec.out ? `<button class="ghost-btn att-do" data-kind="ok" ${dset}>${
        empT(`照打卡记（净 ${schH(attPayableNet({ ...rec, decision: null }, shift))}）`,
             `Erfassung übernehmen (${schH(attPayableNet({ ...rec, decision: null }, shift))})`)}</button>` : ""}
      ${shift ? `<button class="ghost-btn att-do" data-kind="plan" ${dset}>${
        empT(`按班表记（净 ${schH(row.plan)}）`, `Nach Plan werten (${schH(row.plan)})`)}</button>` : ""}
      <button class="ghost-btn danger-lite att-do" data-kind="absent" ${dset}>${empT("记缺勤（0h）", "Als Fehlzeit werten (0h)")}</button>
      <span class="att-sick-wrap">
        <button class="ghost-btn att-sick" ${dset}>${empT("记病假", "Krankmeldung")}</button>
        <label>${empT("到", "bis")}<input type="date" class="att-sick-to" ${dset} value="${row.date}"></label>
      </span>
      ${row.excess && rec && !rec.otId ? `<button class="ghost-btn att-ot" data-rec="${rec.id}">${
        empT(`超出的 ${schH(row.excess)} 转加班申请`, `${schH(row.excess)} zur Freigabe einreichen`)}</button>` : ""}
      ${d ? `<button class="ghost-btn att-undo" data-rec="${rec.id}">${empT("撤销处理", "Bearbeitung zurücknehmen")}</button>` : ""}
    </div>

    ${rec && rec.otId ? `<p class="att-fix-ot">${empT("超出部分已提交加班审批，批准前不进工资。",
      "Mehrstunden eingereicht; sie zählen erst nach Freigabe.")} <a href="#${slug("employee", "排班管理")}?v=month&m=${row.date.slice(0, 7)}">${
      empT("去月度结算审批 →", "Zur Freigabe →")}</a></p>` : ""}

    ${rec && rec.log && rec.log.length ? `<details class="att-fix-log"><summary>${
      empT(`这条记录的经过（${rec.log.length} 条）`, `Verlauf (${rec.log.length})`)}</summary>
      <ul>${rec.log.map(l => `<li><span>${empStamp(l.at)}</span> ${empEsc(l.by || "")} · ${empText(l.what)}</li>`).join("")}</ul>
    </details>` : ""}
  </div>`;
}

/* ============================================================== 绑定 ===== */
function attGo(href) {
  const target = String(href).replace(/^#/, "");
  if (decodeURIComponent(location.hash.replace("#", "")) === decodeURIComponent(target)) app();
  else location.hash = target;
}

function attBindAll() {
  const store = attStore();

  /* 改了上下班时间，「按这个时间记（净 xh）」那个数当场跟着变 —— 以及超出班表那句提示。
     不重算的话，屏幕上写的和点下去记的是两个数（2026-09-03 Mingrong 发现）。 */
  document.querySelectorAll(".att-fix").forEach(box => {
    const btn = box.querySelector('.att-do[data-kind="fix"]');
    const cap = box.querySelector(".att-fix-cap");
    if (!btn) return;
    const sync = () => {
      const st = box.querySelector(".att-in-start")?.value || "";
      const en = box.querySelector(".att-in-end")?.value || "";
      if (!st || !en || st === en) return;
      const raw = attHoursOf(st, en).net;
      const plan = Number(btn.dataset.plan);
      const net = btn.dataset.plan === "" ? raw : Math.min(raw, plan);
      btn.textContent = empT(`按这个时间记（净 ${schH(net)}）`, `So werten (netto ${schH(net)})`);
      if (cap) {
        cap.hidden = !(raw > net + 0.01);
        cap.textContent = empT(
          `这段时间净 ${schH(raw)}，超出班表的 ${schH(raw - net)} 不会自动进工资 —— 要算就走加班申请`,
          `Netto ${schH(raw)}; ${schH(raw - net)} über Plan zählen nur nach Freigabe als Mehrstunden`);
      }
    };
    box.querySelectorAll(".att-in-start, .att-in-end").forEach(i => i.addEventListener("input", sync));
  });

  document.querySelectorAll(".att-do").forEach(b => b.addEventListener("click", () => {
    const { emp, date, shift } = b.dataset;
    const kind = b.dataset.kind;
    const pick = cls => document.querySelector(`.${cls}[data-emp="${emp}"][data-date="${date}"]`);
    const why = (pick("att-in-why")?.value || "").trim();
    const start = pick("att-in-start")?.value || "";
    const end = pick("att-in-end")?.value || "";
    if ((kind === "fix" || kind === "absent") && !why) {
      empFlash(b, empT("先写一句理由", "Bitte Begründung angeben"));
      return;
    }
    if (kind === "fix" && (!start || !end || start === end)) {
      empFlash(b, empT("时间填全", "Zeiten angeben"));
      return;
    }
    attDecide(store, emp, date, shift || null, kind, { why, start, end });
    attGo(attHref({ d: date, fix: null }));
  }));

  /* 病假不是考勤的一种决议，是一条休假记录 —— 记完这一天就归休假管了，
     考勤这边不再报异常。多于一天的直接在这儿填到哪天，AU 跟踪才接得上。 */
  document.querySelectorAll(".att-sick").forEach(b => b.addEventListener("click", () => {
    const { emp, date } = b.dataset;
    const to = document.querySelector(`.att-sick-to[data-emp="${emp}"][data-date="${date}"]`)?.value || date;
    const why = document.querySelector(`.att-in-why[data-emp="${emp}"][data-date="${date}"]`)?.value || "";
    if (typeof lvSubmit !== "function") return;
    const r = lvSubmit(store, emp, "krank", date, to < date ? date : to, why, { src: "manager", by: "Martin" });
    if (!r.ok) {
      empFlash(b, r.code === "overlap" ? empT("这段时间他已经有一条休假了", "Zeitraum überschneidet sich")
                                       : empT("记不进去，检查一下日期", "Datum prüfen"));
      return;
    }
    attGo(attHref({ d: date, fix: null }));
  }));

  document.querySelectorAll(".att-ot").forEach(b => b.addEventListener("click", () => {
    attToOvertime(b.dataset.rec);
    app();
  }));

  document.querySelectorAll(".att-undo").forEach(b => b.addEventListener("click", () => {
    attUndoDecision(b.dataset.rec);
    app();
  }));

  document.querySelectorAll(".att-site-here").forEach(b => b.addEventListener("click", () => {
    attAskGeo().then(pos => {
      if (!pos || typeof pos.lat !== "number") {
        empFlash(b, empT("没取到定位，可以手填坐标", "Kein Standort — Koordinaten eintragen"));
        return;
      }
      attSetSite(b.dataset.store, pos.lat, pos.lng);
      empMarkSaved(`site-${b.dataset.store}`);
      app();
    });
  }));

  document.querySelectorAll(".att-site-save").forEach(b => b.addEventListener("click", () => {
    const lat = Number(document.querySelector(`.att-site-lat[data-store="${b.dataset.store}"]`)?.value);
    const lng = Number(document.querySelector(`.att-site-lng[data-store="${b.dataset.store}"]`)?.value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      empFlash(b, empT("坐标不对", "Koordinaten ungültig"));
      return;
    }
    attSetSite(b.dataset.store, lat, lng);
    empMarkSaved(`site-${b.dataset.store}`);
    app();
  }));

  document.querySelectorAll(".att-site-clear").forEach(b => b.addEventListener("click", () => {
    attClearSite(b.dataset.store);
    app();
  }));
}

/* 取一次定位。拿不到就照实说是哪一种拿不到 —— 「没开权限」和「室内定不到」
   店长要做的事不一样。 */
function attAskGeo() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve({ why: "unsupported" }); return; }
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => finish({ why: "timeout" }), 9000);
    navigator.geolocation.getCurrentPosition(
      p => finish({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      err => finish({ why: err && err.code === 1 ? "denied" : "unavailable" }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/* ==================================================== 主页待办 =========== */
/* 首页卡片没了（考勤并进「排班与考勤」那张），只留待办这一条：有对不上的考勤。
   这是有窗口的 ——
   拖到月底工资已经报出去了，再改就要走更正。 */
function attTodoItems() {
  const store = attStore();
  const open = attOpenRows(store);
  if (!open.length) return [];
  const oldest = open[0];
  const days = empDaysBetween(oldest.date, empToday());
  return [{
    type: "考勤异常",
    title: `有 ${open.length} 条考勤和班表对不上还没处理，最早的一条是 ${empFormatDate(oldest.date)}（${oldest.e.name}：${oldest.bad.map(i => i.zh).join("、")}）`,
    /* de：员工助手主页在 .emp-page 里，全站词典翻译够不着，德语得自己带 */
    de: `${open.length} ${open.length === 1 ? "Zeiterfassung weicht" : "Zeiterfassungen weichen"} vom Dienstplan ab und ${open.length === 1 ? "ist" : "sind"} unbearbeitet; die älteste vom ${empFormatDate(oldest.date)} (${oldest.e.name}: ${oldest.bad.map(i => i.de).join(", ")})`,
    module: "员工助手", store,
    due: days >= 7 ? "尽快处理" : "本周到期",
    risk: days >= 7 ? "高风险" : "中风险",
    status: "未处理",
    href: `#${slug("employee", "考勤")}?d=${oldest.date}&fix=${encodeURIComponent(attRowKey(oldest))}`
  }];
}

/* ==================================================== 合规设置里的一段 ===
   打卡半径和宽限做成合规参数（跟着那张表走），门店坐标按门店存在这里。
   坐标不编：默认只有主店有，其余两家是空的，店长站在店里按一下就设上了。 */
function attSitePanel(scope) {
  const list = scope ? [scope] : empStores();
  return `<section class="card att-site" id="att-site">
    <div class="section-title">
      <div><h2>${empT("打卡位置", "Standort für die Zeiterfassung")}</h2>
      <p>${empT("员工打卡时系统拿手机定位和门店坐标比距离，超出上面配的半径就标出来给你看。没设坐标不影响打卡，只是位置那一栏会写「判不了」。",
                "Beim Erfassen wird der Geräte-Standort mit der Filiale verglichen. Ohne Koordinaten wird weiterhin erfasst, der Ort aber nicht geprüft.")}</p></div>
    </div>
    ${list.map(store => {
      const site = attSite(store);
      return `<div class="att-site-row">
        <div class="att-site-name"><strong>${empEsc(store)}</strong>
          ${site ? empPill("green", empT(`已设 · ${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`, `Gesetzt · ${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`))
                 : empPill("orange", empT("还没设", "Nicht gesetzt"))}
          ${empSavedBanner(`site-${store}`)}</div>
        <div class="att-site-fields">
          <label>${empT("纬度", "Breite")}<input class="att-site-lat" data-store="${empEsc(store)}" value="${site ? site.lat : ""}" placeholder="48.13774"></label>
          <label>${empT("经度", "Länge")}<input class="att-site-lng" data-store="${empEsc(store)}" value="${site ? site.lng : ""}" placeholder="11.57549"></label>
          <button class="ghost-btn att-site-here" data-store="${empEsc(store)}">${empT("用当前位置", "Aktuellen Standort übernehmen")}</button>
          <button class="primary-btn att-site-save" data-store="${empEsc(store)}">${empT("保存", "Speichern")}</button>
          ${site ? `<button class="ghost-btn danger-lite att-site-clear" data-store="${empEsc(store)}">${empT("清除", "Löschen")}</button>` : ""}
        </div>
        ${site && site.setAt ? `<small class="att-site-when">${empT("设于", "Gesetzt am")} ${empStamp(site.setAt)}${site.by ? ` · ${empEsc(site.by)}` : ""}</small>` : ""}
      </div>`;
    }).join("")}
    <p class="att-site-note">${empT("「用当前位置」要在门店里点，浏览器会先问你要不要给定位权限。手填也行，坐标可以在地图上右键取。",
      "„Aktuellen Standort übernehmen“ in der Filiale antippen; der Browser fragt nach der Standortfreigabe. Koordinaten lassen sich auch von einer Karte übernehmen.")}</p>
  </section>`;
}
