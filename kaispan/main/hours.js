/* ==========================================================================
   KaiSpan · 工时与 Arbeitszeitkonto
   --------------------------------------------------------------------------
   在 schedule.js 之后、app.js 之前以 defer 加载，前缀 hrs。

   原来这一页是六行写死的假数据，加两个「一键确认」的死按钮，其中一句提示
   还是反的：「Anna 本月工作时间偏少，建议取出 6h 补足，避免变成 Minijob 风险」——
   取出会让计薪工时变多，只会离上限更近。Arbeitszeitkonto 熨平 Minijob 的正确方向
   是**排多了往里存**，本月计薪就压回上限以内。

   这一版的算式一条链走到底，中间没有手填的环节：

     排班净工时（schedule.js 算的）
       + 已批准的加班
       = 实做工时
       − 存进 Arbeitszeitkonto
       + 从 Arbeitszeitkonto 取出
       = 本月计薪工时  → × 时薪 = 预估工资 → 判 Minijob 上限、判合同区间

   所以 AZK 上按一下按钮，排班页那条 Minijob 警告会当场消失 —— 它们读的是同一个数。
   ========================================================================== */

const HRS_AZK_KEY = "kaispanHrsAzk";        /* Arbeitszeitkonto 存取记录 */
const HRS_OT_KEY = "kaispanHrsOvertime";    /* 加班记录 */

/* ---------------------------------------------------------------- 存储 --- */
function hrsAzkAll() {
  const saved = empRead(HRS_AZK_KEY, null);
  if (saved) return saved;
  const seed = hrsSeedAzk();
  empWrite(HRS_AZK_KEY, seed);
  return seed;
}

function hrsOtAll() {
  const saved = empRead(HRS_OT_KEY, null);
  if (saved) return saved;
  const seed = hrsSeedOt();
  empWrite(HRS_OT_KEY, seed);
  return seed;
}

function hrsPrevMonth(n) {
  const d = new Date(`${empToday()}T00:00:00`);
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* 种子少而具体：一笔存、一笔取、一条待审批的加班。
   够把三条路径都演示出来，又不至于让余额看着像编的。 */
function hrsSeedAzk() {
  const last = hrsPrevMonth(1);
  return [
    { id: "a1", empId: "e02", store: "Martin Biergarten", month: last, type: "in", hours: 6.5,
      reason: "周末活动延时收尾，超出班表的部分存入", at: `${last}-28T20:10`, by: "Martin" },
    { id: "a2", empId: "e03", store: "Martin Biergarten", month: last, type: "out", hours: 2,
      reason: "补休半天，从账户抵扣", at: `${last}-22T09:30`, by: "Martin" }
  ];
}

function hrsSeedOt() {
  return [
    { id: "o1", empId: "e09", store: "Martin Biergarten", date: empShiftDate(empToday(), -4),
      hours: 2, reason: "周六临时客流，延后一小时收工", state: "pending", at: `${empShiftDate(empToday(), -4)}T23:40` }
  ];
}

function hrsAzk(store, empId) {
  return hrsAzkAll().filter(x => (!store || x.store === store) && (!empId || x.empId === empId));
}

function hrsOt(store, empId) {
  return hrsOtAll().filter(x => (!store || x.store === store) && (!empId || x.empId === empId));
}

/* ------------------------------------------------------------ 核心算式 --- */
/* 账户余额：到这个月底为止，存进去的减去取出来的。 */
function hrsBalance(store, empId, month) {
  return hrsAzk(store, empId)
    .filter(x => !month || x.month <= month)
    .reduce((sum, x) => sum + (x.type === "in" ? x.hours : -x.hours), 0);
}

/* 这个月在账户上的动作，对计薪工时的净影响：取出加、存入减。 */
function hrsAzkDelta(store, empId, month) {
  return hrsAzk(store, empId)
    .filter(x => x.month === month)
    .reduce((sum, x) => sum + (x.type === "out" ? x.hours : -x.hours), 0);
}

/* 已批准的加班。待审批的不算 —— 没批的钱不能进工资。 */
function hrsOvertime(store, empId, month, upto) {
  const last = empShiftDate(`${hrsMonthAddRaw(month, 1)}-01`, -1);
  return hrsOtRange(store, empId, `${month}-01`, upto && upto < last ? upto : last);
}

function hrsOtRange(store, empId, from, to) {
  return hrsOt(store, empId)
    .filter(x => x.state === "approved" && String(x.date) >= from && String(x.date) <= to)
    .reduce((sum, x) => sum + x.hours, 0);
}

/* 实做工时 = 排班排出来的 + 考勤调整 + 批准的加班。
   考勤调整 = Σ（每条已处理的打卡记录：实际计薪净工时 − 那个班排的净工时）。
   所以：没打卡也没处理的日子照排班算（未来的班本来就只有排班），
   处理过的日子按打卡或店长的决议算，迟到早退往下减、记缺勤减掉整个班。
   超出班次的部分不在这里，它要走加班审批 —— 没人批准的加班不进工资。 */
function hrsWorked(store, empId, month, draft) {
  const planned = typeof schMonthNet === "function" ? schMonthNet(store, empId, `${month}-01`, draft) : 0;
  const att = typeof attAdjust === "function" ? attAdjust(store, empId, month) : 0;
  /* 休假调整：有薪假把那几天的工时照付上（排了班的按那天排的，没排的按 13 周日均），
     无薪假把已排的减掉。休假的日子考勤那边会跳过，不会同一天算两遍。 */
  const lv = typeof lvAdjust === "function" ? lvAdjust(store, empId, month) : 0;
  return planned + att + lv + hrsOvertime(store, empId, month);
}

/* 本月计薪工时。schedule.js 的 Minijob 和合同工时判定读的就是这个函数。 */
function hrsPayableNet(store, empId, month, draft) {
  return hrsWorked(store, empId, month, draft) + hrsAzkDelta(store, empId, month);
}

function hrsRound(n) {
  return Math.round(n * 4) / 4;
}

/* 存取都按一刻钟取整，但方向不能随便：
   存入往上取（少存 0.2h 就压不回上限以内，€556.80 还是超），
   取出往下取（多取就超过账户余额了）。 */
function hrsCeil(n) {
  return Math.ceil(n * 4 - 1e-9) / 4;
}

function hrsFloor(n) {
  return Math.floor(n * 4 + 1e-9) / 4;
}

/* 一个人一个月的全部数字，表格和建议都从这里取，不各算一遍。 */
/* 口径：截止今天（2026-09-03 Mingrong）。
   9 月 3 号看 9 月，班表上 4–6 号已经排好的班还没上，把它们算进「该付多少小时」
   是把还没发生的事当成已经发生。所以 planned / lv / ot 都只算到今天为止；
   过去的月份 upto 就是月末，未来的月份什么都还没发生。
   （原来还并排算一份「整月口径」给预测用；预测那套当天下午删了，这份也跟着删。） */
function hrsUpto(month) {
  const today = empToday();
  const cur = today.slice(0, 7);
  if (month < cur) return empShiftDate(`${hrsMonthAddRaw(month, 1)}-01`, -1);
  if (month > cur) return `${month}-00`;
  return today;
}

/* 一个人在一段时间里的工时链：排的 ± 考勤 ± 休假 + 加班（+ 账户调整，只有整月才有）
   → 计薪工时 → 工资。日 / 周 / 月三个视图问的是同一件事，只是区间不同
   （2026-09-03 Mingrong：日周月每个员工的考勤和工时）。 */
function hrsRangeRow(store, e, from, to) {
  const c = e.contract || {};
  const today = empToday();
  const end = to > today ? today : to;   /* 还没到的日子不算 —— 跟月视图一个口径 */
  const blank = from > end;
  const planned = blank || typeof schRangeNet !== "function" ? 0 : schRangeNet(store, e.id, from, end);
  const att = blank || typeof attRangeAdjust !== "function" ? 0 : attRangeAdjust(store, e.id, from, end);
  const lv = blank || typeof lvRangeAdjust !== "function" ? 0 : lvRangeAdjust(store, e.id, from, end);
  const lvPaid = blank || typeof lvRangePaid !== "function" ? 0 : lvRangePaid(store, e.id, from, end);
  const ot = blank ? 0 : hrsOtRange(store, e.id, from, end);
  const payable = planned + att + lv + ot;
  const hourly = c.payType !== "pauschal";
  return {
    e, from, to: end, planned, att, lv, lvPaid, ot, delta: 0, payable, hourly,
    pay: hourly ? payable * (Number(c.rate) || 0) : 0,
    rate: Number(c.rate) || 0, min: 0, max: 0, balance: 0, range: true,
    attPending: typeof attRangePairs === "function"
      ? attRangePairs(store, from, end, e.id).map(x => attRow(x, today, store)).filter(r => r.needs).length : 0,
    type: empContractType(c.type)
  };
}

/* 三个尺度共用的那张表。月视图多两列：「账户调整」（工时账户按月存取，日和周没有这个动作）
   和「要处理」（结论也是按月给的）。 */
function hrsScaleTable(store, rows, opts) {
  const o = opts || {};
  return `<section class="card hrs-people-card">
    <div class="section-title">
      <div><h2>${empText(o.title || { zh: "全部员工", de: "Alle Mitarbeiter" })}</h2>
      <p>${empText(o.note || { zh: "", de: "" })}</p></div>
      ${o.right || ""}
    </div>
    <div class="table-scroll"><table class="table employee-table hrs-table">
      <thead><tr>
        <th>${empT("员工", "Mitarbeiter")}</th>
        ${o.month ? `<th title="${empT("合同里约定的每月工时区间，来自员工档案的合同页", "Vertraglich vereinbarte Monatsstunden, aus der Mitarbeiterakte")}">${
          empT("合同工时", "Vertragsstunden")}</th>` : ""}
        <th title="${empT("班表上排给他的净工时，休息时间已扣", "Netto-Planstunden aus dem Dienstplan, Pausen abgezogen")}">${
          empT("排班工时", "Planstunden")}</th>
        <th title="${empT("打卡处理完之后相对班表的增减", "Abweichung nach bearbeiteter Erfassung")}">${
          empT("考勤增减", "Ist-Abweichung")}</th>
        <th title="${empT("年假、病假等照付工资、人没来的小时", "Bezahlte Abwesenheit: Urlaub, Krankheit")}">${
          empT("带薪缺勤", "Bez. Abwesenheit")}</th>
        <th title="${empT("已经批准的加班工时", "Genehmigte Überstunden")}">${
          empT("批准加班", "Überstunden")}</th>
        ${o.month ? `<th title="${empT("工时账户存取：存入记负、取出记正", "Zeitkonto: Einzahlung negativ, Entnahme positiv")}">${
          empT("工时账户", "Zeitkonto")}</th>` : ""}
        <th title="${empT("前面几列相加，这个月按这个数发工资", "Summe der Spalten davor — danach wird abgerechnet")}">${
          empT("计薪工时", "Abzurechnende Std.")}</th>
        <th title="${empT("计薪工时 × 时薪，税前，不含社保和雇主附加成本", "Abzurechnende Stunden × Satz, brutto, ohne Sozialabgaben")}">${
          empT("预估税前工资", "Brutto (Schätzung)")}</th>
        ${o.fix ? `<th>${empT("待处理事项", "Zu klären")}</th>` : ""}
      </tr></thead>
      <tbody>${rows.map(r => hrsTableRow(r, o.month, o.fix)).join("")}</tbody>
    </table></div>
    ${o.foot || ""}
  </section>`;
}

function hrsRow(store, e, month, draft) {
  const c = e.contract || {};
  const upto = hrsUpto(month);
  const planned = typeof schMonthNet === "function" ? schMonthNet(store, e.id, `${month}-01`, draft, upto) : 0;
  const att = typeof attAdjust === "function" ? attAdjust(store, e.id, month) : 0;
  const lv = typeof lvAdjust === "function" ? lvAdjust(store, e.id, month, upto) : 0;
  const lvPaid = typeof lvPaidHours === "function" ? lvPaidHours(store, e.id, month, upto) : 0;
  const ot = hrsOvertime(store, e.id, month, upto);
  const delta = hrsAzkDelta(store, e.id, month);
  const payable = planned + att + lv + ot + delta;
  const hourly = c.payType !== "pauschal";
  const pay = hourly ? payable * (Number(c.rate) || 0) : Number(c.rate) || 0;
  return {
    e, month, upto, planned, att, lv, lvPaid, ot, delta, payable, hourly, pay,
    attPending: typeof attMonthPending === "function" ? attMonthPending(store, month, e.id) : 0,
    progress: hrsMonthProgress(store, month, draft),
    rate: Number(c.rate) || 0,
    min: Number(c.hoursMin) || 0,
    max: Number(c.hoursMax) || 0,
    balance: hrsBalance(store, e.id, month),
    type: empContractType(c.type)
  };
}

/* 这个月在册的人。Marco 是 9 月 5 号入职的，八月的工时表里不该有他，
   更不该跟他说「你八月比合同下限少 60 小时」—— 那个月他还不是员工。 */
function hrsStaff(store, month) {
  const first = `${month}-01`;
  const last = empShiftDate(hrsMonthAddRaw(month, 1) + "-01", -1);
  return empStaff(store).filter(e => {
    if (e.entryDate && e.entryDate > last) return false;
    const left = e.leave && e.leave.lastDay;
    if (left && left < first) return false;
    return true;
  });
}

/* ---------------------------------------------------------- 月份进度 ---- */
/* 9 月 2 号跟人说「你这个月比合同下限少 119.5 小时」是废话 —— 这个月才排了六天。
   所以下限那一类判定必须知道「这个月排到哪儿了」：
     covered  这个月已经有班表的天数
     factor   按目前进度外推到月末的倍数
   不达下限只在整月都排完之后才说（那时数字才是定的，也才真的补不回来了）；
   还没排完的月份只做「按进度推算会超」的预警，不给按钮 —— 预测值不该直接落账。 */
function hrsMonthProgress(store, month, draft) {
  const first = `${month}-01`;
  const days = Number(empShiftDate(hrsMonthAddRaw(month, 1) + "-01", -1).slice(8));
  let covered = 0;
  for (let d = 1; d <= days; d += 1) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    const week = schWeekOf(date);
    const has = (draft && draft.week === week) || schRosterExists(store, week);
    if (has) covered = d; else break;
  }
  return { days, covered, done: covered >= days, factor: covered ? days / covered : null, first };
}

/* 纯算月份，不碰路由。月份切换的链接由 schedule.js 那边的月度栏统一给。 */
function hrsMonthAddRaw(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------ 建议 ------ */
/* 「建议存 8.5h」这个数不该让人手填，它是从上限倒推出来的。
   三种情形，优先级从贵到便宜：
     1. Minijob 月薪超上限 —— 超了社保全变，最贵，先处理
     2. 计薪工时超合同上限 —— 要付加班费或者协商
     3. 计薪工时低于合同下限 —— 兼职合同不达标同样要照付，从账户取出来补
   存入还受账户上限约束（合规设置里的「Arbeitszeitkonto 余额上限」）。 */
function hrsAdvice(store, row) {
  const cap = Number(empRule("azkMaxHours")) || 40;
  const room = cap - row.balance;
  const pr = row.progress || hrsMonthProgress(store, row.month);
  /* what = 一句话说清「这一行为什么会出现在待处理里」，why = 数字怎么来的、动作会带来什么。
     原来只有 why，还只挂在按钮的 title 上 —— 表格里看到的就是一个「存 4h」，
     谁也说不出这是在处理什么（Mingrong：要处理下面每项不知道是什么意思）。 */
  const mk = (kind, hours, what, why, capped) => ({ kind, hours, what, why, capped });
  /* 2026-09-03（Mingrong：去掉预测风险，只在当月排班结束后显示当月风险）——
     「按目前进度推算会超」这类预警整个删了。月中乘一个班表覆盖系数得出来的数本身就不准
     （排到 13 号 × 2.31 = 537h），而且不可执行：能做的动作要么现在就成立（已经越线了），
     要么等排完整月再说。现在只剩这两种。 */

  if (row.type.id === "minijob" && row.hourly && row.rate > 0) {
    const limit = Number(empRule("minijobMonthlyMax")) || 556;
    if (row.pay > limit + 0.01) {
      const need = row.payable - limit / row.rate;
      const put = Math.min(hrsCeil(need), hrsFloor(Math.max(0, room)));
      if (put >= 0.25) {
        return mk("in", put,
          { zh: `工资超 Minijob 上限 €${limit}`, de: `Über der Minijob-Grenze von €${limit}` },
          { zh: `本月计薪 ${schH(row.payable)} × €${row.rate} ≈ €${row.pay.toFixed(2)}，超 Minijob 上限 €${limit}。存 ${schH(put)} 进账户，本月计薪降到 €${((row.payable - put) * row.rate).toFixed(2)}`,
            de: `${schH(row.payable)} × €${row.rate} ≈ €${row.pay.toFixed(2)} über der Minijob-Grenze von €${limit}. ${schH(put)} einzahlen senkt auf €${((row.payable - put) * row.rate).toFixed(2)}` },
          put < hrsCeil(need) - 0.001);
      }
      return mk(null, 0,
        { zh: `工资超 Minijob 上限 €${limit}，账户也满了`, de: `Über der Minijob-Grenze, Zeitkonto voll` },
        { zh: `超了 Minijob 上限，但账户余额已经到上限 ${cap}h，存不进去了。只能改班表或者改合同。`,
                           de: `Über der Minijob-Grenze, aber das Zeitkonto ist bei ${cap}h am Limit. Nur über Dienstplan oder Vertrag lösbar.` });
    }
  }
  if (row.max && row.payable > row.max + 0.24) {
    const need = row.payable - row.max;
    const put = Math.min(hrsCeil(need), hrsFloor(Math.max(0, room)));
    if (put >= 0.25) {
      return mk("in", put,
        { zh: `超合同上限 ${schH(row.max)}，多了 ${schH(need)}`, de: `${schH(need)} über der Vertragsobergrenze ${schH(row.max)}` },
        { zh: `本月计薪 ${schH(row.payable)}，合同上限 ${row.max}h。存 ${schH(put)} 进账户就回到区间内`,
          de: `${schH(row.payable)} geplant, Vertragsobergrenze ${row.max}h. ${schH(put)} einzahlen bringt es in den Rahmen` },
        put < hrsCeil(need) - 0.001);
    }
  }
  /* 不达下限：只在整月排完之后说。没排完的月份这句话没有意义，还能再排。 */
  if (row.min && !pr.done) return null;
  if (row.min && row.payable < row.min - 0.24) {
    /* 一小时都没排的人，先说清楚为什么没排。
       只报「你欠他 30 小时工资」而不说「他的居留卡过期了」或者「他一次班都没报」，
       是把结论说反了 —— 该先修的是那个原因。 */
    if (row.payable < 0.25) {
      const why = hrsWhyZero(store, row);
      return mk(null, 0,
        { zh: "整月一个班都没排", de: "Diesen Monat keine einzige Schicht" },
        { zh: `这个月一小时都没排：${why.zh}。先把这件事解决掉；这段时间的工资口径跟你的税务师确认一次。`,
          de: `Diesen Monat keine Stunden: ${why.de}. Zuerst das klären; die Lohnfrage mit der Steuerkanzlei abstimmen.` });
    }
    const gap = row.min - row.payable;
    const take = hrsFloor(Math.min(gap, Math.max(0, row.balance)));
    if (take >= 0.25) {
      return mk("out", take,
        { zh: `不到合同下限 ${schH(row.min)}，差 ${schH(gap)}`, de: `${schH(gap)} unter der Vertragsuntergrenze ${schH(row.min)}` },
        { zh: `整月排完了，计薪 ${schH(row.payable)}，合同下限 ${row.min}h。从账户取 ${schH(take)} 补上${take < gap - 0.24 ? "一部分" : ""}`,
          de: `Monat abgeschlossen: ${schH(row.payable)}, Vertragsuntergrenze ${row.min}h. ${schH(take)} aus dem Zeitkonto entnehmen` },
        take < gap - 0.24);
    }
    return mk(null, 0,
      { zh: `不到合同下限 ${schH(row.min)}，账户也空了`, de: `Unter der Vertragsuntergrenze ${schH(row.min)}, Zeitkonto leer` },
      { zh: `整月排完了，计薪 ${schH(row.payable)}，比合同下限 ${row.min}h 少 ${schH(row.min - row.payable)}，账户里也没余额可抵。合同约定的下限工时按德国法通常仍要照付（Annahmeverzug），具体跟你的税务师确认一次。`,
        de: `Monat abgeschlossen: ${schH(row.payable)}, ${schH(row.min - row.payable)} unter der Vertragsuntergrenze, Zeitkonto leer. Vertraglich zugesagte Stunden sind in der Regel trotzdem zu vergüten (Annahmeverzug) — bitte mit der Steuerkanzlei klären.` });
  }
  return null;
}

/* 一个人整月零工时，先说清楚是哪一种：证件挡着（违法用工，最硬），
   还是排班的时候就没排到他。 */
function hrsWhyZero(store, row) {
  const doc = typeof schDocIssue === "function" ? schDocIssue(row.e, `${row.month}-15`) : null;
  if (doc) return { zh: `${doc.zh}，按规定不能上工`, de: `${doc.de} — Beschäftigung nicht zulässig` };
  return { zh: "排班的时候没有排到他", de: "im Dienstplan nicht berücksichtigt" };
}

/* --------------------------------------------------------------- 写入 --- */
function hrsNextId(list, prefix) {
  let n = list.length + 1;
  while (list.some(x => x.id === `${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

function hrsAddAzk(store, empId, month, type, hours, reason) {
  const all = hrsAzkAll().slice();
  all.unshift({ id: hrsNextId(all, "a"), empId, store, month, type,
                hours: hrsRound(hours), reason: reason || "", at: empNow(), by: "Martin" });
  empWrite(HRS_AZK_KEY, all);
  return all;
}

function hrsDropAzk(id) {
  empWrite(HRS_AZK_KEY, hrsAzkAll().filter(x => x.id !== id));
}

/* by: "self" = 员工在自己 App 里报的；不写就是店长在班表下面录的。
   两条路进的是同一份数据、同一个待审批状态 —— 批准之前一分钟都不进工资。 */
function hrsAddOt(store, empId, date, hours, reason, by) {
  const all = hrsOtAll().slice();
  all.unshift({ id: hrsNextId(all, "o"), empId, store, date, hours: hrsRound(hours),
                reason: reason || "", state: "pending", by: by || "manager", at: empNow() });
  empWrite(HRS_OT_KEY, all);
  return all;
}

function hrsDecideOt(id, state, note) {
  const all = hrsOtAll().map(x => x.id !== id ? x
    : { ...x, state, note: note || "", decidedAt: empNow() });
  empWrite(HRS_OT_KEY, all);
  return all;
}

/* ============================================================== 页面 ====== */
function hrsMonth() {
  const m = state().params.get("m") || "";
  return /^\d{4}-\d{2}$/.test(m) ? m : empToday().slice(0, 7);
}



/* 工时不再是单独页面，也不再是藏在第三个小标签里的视图。
   它直接接在月历下面：上半页核对排班，下半页完成工时与工资口径的月结。 */
/* 月视图（2026-09-03 Mingrong 连着提了三轮「信息太多」，这是第三轮）。
   现在这一页只剩四块：一行结论、两条要办的事（加班待批 / 考勤没处理）、一张表、一个折叠的工时账户。
   删掉的：三格摘要（收成标题右边一行）、「合同区间」和「账户余额」两列、
   没有风险时那张整卡的空状态、以及整块「这些数字怎么算」—— 口径搬进了页头的「使用说明」。
   表本身也从十列收到六列：考勤 / 休假 / 加班 / 账户调整 这四列绝大多数格子是「—」，
   它们说的是同一件事「为什么计薪 ≠ 排的」，并成一格「调整」，带标签的小药丸列出来。
   最后一列是「要处理」—— 按 Mingrong 说的，不挂在行下面，就是一列。 */
function hrsView(store) {
  const month = hrsMonth();
  const progress = hrsMonthProgress(store, month);
  const upto = hrsUpto(month);
  const staff = hrsStaff(store, month);
  const rows = staff.map(e => hrsRow(store, e, month))
    .sort((a, b) => a.e.name.localeCompare(b.e.name));
  const advices = rows.map(r => ({ r, a: hrsAdvice(store, r) })).filter(x => x.a);
  const wage = rows.reduce((s, r) => s + r.pay, 0);
  const payable = rows.reduce((s, r) => s + r.payable, 0);
  const pendingOt = hrsOt(store).filter(x => x.state === "pending" && String(x.date).slice(0, 7) === month);
  const attPend = typeof attMonthPending === "function" ? attMonthPending(store, month) : 0;
  const closed = month < empToday().slice(0, 7);

  return `
    <div class="section-title hrs-month-title">
      <div><h2>${closed ? empT("工时结算", "Stundenabrechnung") : empT("工时 · 截止今天", "Stunden · bis heute")}</h2>
      <p>${empT(`到 ${empFormatDate(upto)} 为止已经发生的工时。已处理的考勤按打卡算，还没处理的暂按班表算；后面还没上的班不算进来。`,
        `Stunden bis einschließlich ${empFormatDate(upto)}. Bearbeitete Erfassung nach Ist, offene vorläufig nach Plan; künftige Schichten zählen nicht mit.`)}</p></div>
      <span class="hrs-month-sum"><strong>${schH(payable)}</strong> ≈ <strong>€${wage.toFixed(0)}</strong>
        <i>· ${empT(`${staff.length} 人`, `${staff.length} Personen`)}</i></span></div>

    ${pendingOt.length ? `<a class="card hrs-otlink" href="#${slug("employee", "排班管理")}?w=${
      typeof schWeekOf === "function" ? schWeekOf(pendingOt[0].date) : ""}">
      <strong>${empT(`${pendingOt.length} 笔加班等你批`, `${pendingOt.length} Überstunden warten auf Freigabe`)}</strong>
      <span>${empT(`最早的一笔是 ${empFormatDate(pendingOt[0].date)}。批准和录入都在那一周的班表下面 —— 加班是对着班表想起来的事。`,
                    `Die früheste vom ${empFormatDate(pendingOt[0].date)}. Erfassen und Freigeben direkt unter dem Wochenplan.`)} →</span>
    </a>` : ""}

    ${attPend ? `<a class="card hrs-attpend-card" href="#${slug("employee", "考勤")}">
      <strong>${empT(`还有 ${attPend} 条考勤没处理，上面这两个数还会变`, `${attPend} Erfassungen offen — die Werte oben ändern sich noch`)}</strong>
      <span>${empT("对不上的日子在店长给出决议之前一律按班表算。去处理 →", "Bis zur Entscheidung wird nach Plan gerechnet. Jetzt bearbeiten →")}</span>
    </a>` : ""}

    ${hrsScaleTable(store, rows, {
      month: true,
      note: { zh: "「合同工时」是这个人合同里约定的区间，右边那两个红字判断都对着它。「排班工时」来自班表，后面四列是让计薪工时不等于排班工时的四件事：考勤增减、带薪缺勤、批准加班、工时账户存取。都只算到今天为止。",
              de: "„Vertragsstunden“ ist der vertraglich vereinbarte Rahmen, auf den sich die Markierungen rechts beziehen. „Planstunden“ kommt aus dem Dienstplan; die vier Spalten danach erklären die Abweichung: Ist-Abweichung, bezahlte Abwesenheit, genehmigte Überstunden, Zeitkonto — jeweils bis heute." },
      /* 一格三层：出了什么事 → 按了会发生什么 → 一个动作。
         原来这一格只有一个「存 4h」的按钮，理由藏在 title 里 —— 鼠标停上去才看得见，
         手机上根本看不见，而这一列恰恰是整张表唯一需要人做决定的地方。 */
      fix: r => {
        const hit = advices.find(x => x.r.e.id === r.e.id);
        if (!hit) return `<span class="att-dim">—</span>`;
        const a = hit.a;
        const why = `${empRaw(a.why)}${a.capped ? empRaw({ zh: "（账户上限只放得下这么多，剩下的还得改班表或改合同）",
                                                          de: " (mehr passt nicht aufs Konto)" }) : ""}`;
        return `<div class="hrs-fix">
          <strong class="hrs-fix-what">${empText(a.what)}</strong>
          <span class="hrs-fix-why">${empEsc(why)}</span>
          ${a.kind
            ? `<button class="primary-btn hrs-apply"
                 data-emp="${empEsc(r.e.id)}" data-month="${month}"
                 data-type="${a.kind}" data-hours="${a.hours}">${a.kind === "in"
                   ? empT(`存 ${schH(a.hours)} 进工时账户`, `${schH(a.hours)} aufs Zeitkonto`)
                   : empT(`从工时账户取 ${schH(a.hours)}`, `${schH(a.hours)} vom Zeitkonto`)}</button>`
            : `<a class="ghost-btn" href="${schHref({ v: null, m: null })}">${
                empT("去班表看这个月", "Zum Dienstplan")}</a>`}
        </div>`;
      },
      /* 结论只在整月排完之后给（Mingrong）。月中排到一半就说「都在区间内」是句假话 ——
         后面还有半个月的班没排，谁也不知道最后落在哪儿。所以那种情况直接说清楚。 */
      right: advices.length
        ? `<span class="wl-count is-soft">${empT(`${advices.length} 人要处理`, `${advices.length} zu klären`)}</span>`
        : progress.done
          ? `<span class="wl-count is-plain">${empT("都在合同区间内", "Alle im Rahmen")}</span>`
          : `<span class="wl-count is-plain">${empT(`班表排到 ${progress.covered} 号，排完整月才给结论`,
              `Geplant bis Tag ${progress.covered} — Fazit erst bei vollständigem Plan`)}</span>`,
      foot: `<div class="button-row hrs-export">
        <button class="ghost-btn hrs-csv" data-month="${month}">${empT("导出这个月给税务师（CSV）", "Monat für den Steuerberater exportieren (CSV)")}</button>
        <span>${empT("合同条件在员工档案，工时在这儿，没必要再抄一遍 —— 这里直接从上面这张表导。",
                     "Vertragsdaten in der Mitarbeiterakte, Stunden hier — exportiert wird direkt aus dieser Tabelle.")}</span>
      </div>`
    })}

    ${hrsAzkCard(store, month)}`;
}

/* 一行一个人。四个调整项各占一列（2026-09-03 Mingrong：还是用单独的列）——
   合成一格试过，读起来是省地方了，但「这个月谁的考勤扣了多少」就得一格一格看进去。
   分开之后每一列自己能横着扫，表头上停一下写着这一列是什么意思。 */
/* 合同工时（Mingrong：月工时表要加上合同工时）。这一列不是又一个统计数 ——
   它是右边「计薪工时」旁边那个「超上限 / 不达下限」判断的分母。原来判断在，
   参照的数只在 title 里，等于让人对着一个看不见的标准看一个红字。
   区间来自员工档案的合同页，这里不重算也不能改。 */
function hrsContractCell(r) {
  if (!r.min && !r.max) return `<span class="att-dim" title="${
    empT("合同里没写月工时区间 —— 去员工档案的合同页补", "Keine Monatsstunden im Vertrag hinterlegt")}">—</span>`;
  const label = r.min && r.max
    ? (Math.abs(r.min - r.max) < 0.01 ? `${schH(r.max)}` : `${schH(r.min)}\u00a0–\u00a0${schH(r.max)}`)
    : r.max ? empT(`最多 ${schH(r.max)}`, `max. ${schH(r.max)}`)
    : empT(`至少 ${schH(r.min)}`, `min. ${schH(r.min)}`);
  return `<span class="hrs-range">${label}</span><small>${empT("每月", "pro Monat")}</small>`;
}

function hrsTableRow(r, withDelta, fix) {
  const over = r.max && r.payable > r.max + 0.24;
  const under = r.min && r.progress && r.progress.done && r.payable < r.min - 0.24;
  const minijobOver = r.type.id === "minijob" && r.hourly && r.pay > (Number(empRule("minijobMonthlyMax")) || 556);
  return `<tr>
    <td><a class="emp-name-link" href="${empStaffHref(r.e.id)}"><strong>${empEsc(r.e.name)}</strong></a>${empSavedBanner(r.e.id)}
      <small>${empText(r.type.name)} · ${r.hourly ? `€${r.rate}/h` : empT(`€${r.rate}/月`, `€${r.rate}/Monat`)}</small></td>
    ${withDelta ? `<td class="hrs-contract">${hrsContractCell(r)}</td>` : ""}
    <td>${schH(r.planned)}</td>
    <td>${r.att ? `<span class="pill ${r.att > 0 ? "blue" : "orange"}">${r.att > 0 ? "+" : ""}${schH(r.att)}</span>` : "—"}
      ${r.attPending ? `<a class="hrs-attpend" href="#${slug("employee", "考勤")}">${
        empT(`${r.attPending} 条待处理`, `${r.attPending} offen`)}</a>` : ""}</td>
    <td>${r.lvPaid ? `<span class="pill purple" title="${empT("休假照付的工时", "Bezahlte Abwesenheit")}">${schH(r.lvPaid)}</span>`
      : r.lv ? `<span class="pill gray">${schH(r.lv)}</span>` : "—"}</td>
    <td>${r.ot ? `<span class="pill blue">+${schH(r.ot)}</span>` : "—"}</td>
    ${withDelta ? `<td>${r.delta
      ? `<span class="pill ${r.delta > 0 ? "blue" : "purple"}">${r.delta > 0 ? "+" : ""}${schH(r.delta)}</span>` : "—"}</td>` : ""}
    <td><strong class="${over || under ? "hrs-off" : ""}">${schH(r.payable)}</strong>
      ${over ? `<span class="pill orange" title="${empT(`合同上限 ${r.max}h/月`, `Vertrag max. ${r.max}h`)}">${empT("超上限", "über")}</span>`
        : under ? `<span class="pill gray" title="${empT(`合同下限 ${r.min}h/月`, `Vertrag min. ${r.min}h`)}">${empT("不达下限", "unter")}</span>` : ""}</td>
    <td>${r.hourly
      ? `<strong>€${r.pay.toFixed(2)}</strong>${minijobOver
          ? `<span class="pill red">${empT(`超 Minijob €${empRule("minijobMonthlyMax")}`, `über €${empRule("minijobMonthlyMax")}`)}</span>` : ""}`
      : r.range
        ? `<span class="att-dim">${empT("固定月薪", "Festgehalt")}</span>`
        : `<strong>€${r.pay.toFixed(2)}</strong><small>${empT("固定薪，与工时无关", "Pauschale, unabhängig von Stunden")}</small>`}</td>
    ${fix ? `<td class="hrs-fix-col">${fix(r)}</td>` : ""}
  </tr>`;
}

/* 加班有两个来源：考勤页上「超出班次的部分转加班申请」推过来的，和店长手工录的。
   两边都只是待审批，批了才进计薪工时 —— 没批的钱不能进工资。

   2026-09-03 挪了位置（Mingrong）：这张卡放在**本周班表下面**。
   加班是「周六临时客流，James 多留了一小时」—— 店长是对着那一周的班表想起这件事的，
   不是月底翻结算表时想起的。所以录入和批准跟着班表走，按周过滤；
   月度那张工时表里仍有「加班」一列，只是不再重复摆一遍录入表单。
   scope 传 { days, week } 就是一周，传月份字符串就是一个月。 */
/* 加班卡重做（2026-09-03 Mingrong）。原来是「一条录入表单 + 一列长得一模一样的记录」，
   要批的和已经办完的混在同一堆里，一样的边框、一样的大小。
   现在按「谁在等我」分层：
     · 要批的排在最上面，橙色，两个按钮就在那一行上；
     · 已经批过 / 驳回的收进一个默认折叠的 details，需要查才展开；
     · 手动录入也收起来 —— 员工现在自己在 App 里报加班，店长绝大多数时候是在批，不是在录。 */
function hrsOvertimeCard(store, scope) {
  const week = scope && scope.days ? scope : null;
  const month = week ? null : scope;
  const list = hrsOt(store)
    .filter(x => week ? week.days.includes(String(x.date)) : String(x.date).slice(0, 7) === month)
    .sort((a, b) => b.date.localeCompare(a.date));
  const staff = hrsStaff(store, (week ? week.days[3] : month).slice(0, 7));
  const pend = list.filter(x => x.state === "pending");
  const done = list.filter(x => x.state !== "pending");
  const pendH = pend.reduce((n, x) => n + Number(x.hours || 0), 0);

  return `<div class="card hrs-card hrs-ot-card">
    <div class="section-title"><div><h2>${empT("加班", "Überstunden")}${
      pend.length ? ` <b class="emp-attention-count">${pend.length}</b>` : ""}</h2>
      <p>${week
        ? empT("这一周的。批准之后才计入计薪工时 —— 没批的钱不进工资。", "Diese Woche. Erst nach Genehmigung abrechnungsrelevant.")
        : empT("批准之后才计入本月计薪工时。", "Erst nach Genehmigung abrechnungsrelevant.")}</p></div>
      <details class="hrs-ot-new">
        <summary class="ghost-btn">${empT("手动加一笔", "Manuell erfassen")}</summary>
        <div class="hrs-ot-form">
          <label>${empT("谁", "Wer")}
            <select class="hrs-ot-emp">${staff.map(e => `<option value="${empEsc(e.id)}">${empEsc(e.name)}</option>`).join("")}</select></label>
          <label>${empT("哪天", "Wann")}
            <input type="date" class="hrs-ot-date" value="${empEsc(week && !week.days.includes(empToday()) ? week.days[0] : empToday())}"${
              week ? ` min="${week.days[0]}" max="${week.days[6]}"` : ""}></label>
          <label>${empT("几小时", "Stunden")}
            <span class="hrs-ot-unit"><input type="number" class="hrs-ot-hours" step="0.25" min="0.25" max="12" value="1"><i>h</i></span></label>
          <label class="is-wide">${empT("为什么", "Grund")}
            <input type="text" class="hrs-ot-reason" placeholder="${empT("比如：周六临时客流", "z. B. Andrang am Samstag")}"></label>
          <button class="primary-btn hrs-ot-add" data-store="${empEsc(store)}">${empT("录入", "Erfassen")}</button>
        </div>
      </details>
    </div>

    ${pend.length ? `<div class="hrs-ot-todo">
      <p class="hrs-ot-todo-head">${empT(`等你批 ${pend.length} 笔，一共 ${schH(pendH)}`, `${pend.length} offen, zusammen ${schH(pendH)}`)}</p>
      ${pend.map(x => hrsOtRow(x)).join("")}
    </div>` : `<p class="hrs-empty">${week
      ? empT("这一周没有等着批的加班。", "Diese Woche nichts zu genehmigen.")
      : empT("这个月没有等着批的加班。", "Nichts zu genehmigen in diesem Monat.")}</p>`}

    ${done.length ? `<details class="hrs-ot-done">
      <summary>${empT(`已经处理的 ${done.length} 笔`, `${done.length} bereits bearbeitet`)}</summary>
      ${done.map(x => hrsOtRow(x)).join("")}
    </details>` : ""}
  </div>`;
}

/* 一笔加班长什么样，只写一遍：要批的多两个按钮，办完的多一句结果。 */
function hrsOtRow(x) {
  const e = empById(x.empId);
  return `<div class="hrs-item is-${x.state}">
    <div><strong>${empEsc(e ? e.name : x.empId)} +${schH(x.hours)}</strong>
      <span>${empFormatDate(x.date)} · ${x.reason
        ? `<i data-user-text>${empEsc(x.reason)}</i>` : empT("没写原因", "kein Grund")}${
        x.by === "self" ? ` · ${empT("他自己报的", "selbst gemeldet")}` : ""}</span></div>
    ${x.state === "pending"
      ? `<div class="button-row"><button class="ghost-btn hrs-ot-no" data-id="${x.id}">${empT("驳回", "Ablehnen")}</button>
         <button class="primary-btn hrs-ot-ok" data-id="${x.id}">${empT("批准", "Genehmigen")}</button></div>`
      : `<b class="hrs-ot-state is-${x.state}">${x.state === "approved"
          ? empT("已批准，计入本月", "genehmigt") : empT("已驳回", "abgelehnt")}</b>`}
  </div>`;
}

/* 工时账户明细（2026-09-03 Mingrong：重新设计，可以默认收起）。
   原来是三张跟「加班」长得一模一样的大卡片，每张里面一个药丸一句话一个撤销按钮。
   这东西一个月看一次 —— 收进一个默认折叠的 details，展开是一行一笔的紧凑表。
   summary 上就写着「本月几笔、每个人现在还剩多少」，不展开也知道有没有事。 */
function hrsAzkCard(store, month) {
  const list = hrsAzk(store).filter(x => x.month === month);
  const cap = Number(empRule("azkMaxHours")) || 40;
  const staff = hrsStaff(store, month)
    .map(e => ({ e, bal: hrsBalance(store, e.id, month) }))
    .filter(x => Math.abs(x.bal) > 0.01)
    .sort((a, b) => Math.abs(b.bal) - Math.abs(a.bal));
  return `<details class="card hrs-azk">
    <summary>
      <strong>${empT("工时账户 Arbeitszeitkonto", "Zeitkonto")}</strong>
      <span>${list.length
        ? empT(`本月 ${list.length} 笔存取`, `${list.length} Bewegungen`)
        : empT("本月没有存取", "Keine Bewegungen")}${staff.length
        ? ` · ${staff.map(x => `${empRaw(x.e.name)} ${x.bal > 0 ? "+" : ""}${schH(x.bal)}`).join("、")}`
        : ` · ${empT("所有人余额都是 0", "Alle Konten auf 0")}`}</span>
    </summary>
    <div class="hrs-azk-body">
      <p class="hrs-azk-note">${empT(`余额上限 ${cap}h，在合规设置里改。存进去的小时不进这个月的工资，取出来的进。`,
        `Obergrenze ${cap}h — änderbar in den Compliance-Einstellungen. Eingezahlte Stunden zählen nicht im Monat, entnommene schon.`)}
        <a href="#${slug("employee", "合规设置")}">${empT("合规设置 →", "Compliance →")}</a></p>
      ${list.length ? `<div class="wl-wrap"><table class="wl-table">
        <thead><tr>
          <th>${empT("什么时候", "Wann")}</th><th>${empT("谁", "Wer")}</th>
          <th>${empT("存还是取", "Art")}</th><th>${empT("多少", "Stunden")}</th>
          <th>${empT("之后余额", "Stand danach")}</th><th>${empT("为什么", "Grund")}</th><th></th>
        </tr></thead>
        <tbody>${(() => {
          /* 按时间正着排，并且一行一行把余额累起来 —— 「这个人现在到底还剩多少」
             原来要自己一条条加。倒着列还看不出先后。 */
          const asc = list.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
          const run = {};
          return asc.map(x => {
            const e = empById(x.empId);
            run[x.empId] = (run[x.empId] || 0) + (x.type === "in" ? x.hours : -x.hours);
            return `<tr>
              <td class="wl-day"><strong>${empStamp(x.at).split(" ")[0]}</strong><small>${
                (empStamp(x.at).split(" ")[1] || "")}</small></td>
              <td class="wl-who"><strong>${empEsc(e ? e.name : x.empId)}</strong></td>
              <td>${empPill(x.type === "in" ? "blue" : "purple",
                x.type === "in" ? empT("存入", "Einzahlung") : empT("取出", "Entnahme"))}</td>
              <td><strong>${x.type === "in" ? "+" : "−"}${schH(x.hours)}</strong></td>
              <td><span class="hrs-run">${run[x.empId] > 0 ? "+" : ""}${schH(run[x.empId])}</span></td>
              <td class="wl-why is-soft" data-user-text>${empEsc(x.reason)}</td>
              <td class="wl-act"><button class="ghost-btn is-danger hrs-azk-undo" data-id="${x.id}">${
                empT("撤销", "Rückgängig")}</button></td>
            </tr>`;
          }).join("");
        })()}</tbody>
      </table></div>` : `<p class="hrs-empty">${empT("这个月账户上没有动作。存取是在上面那张表里按建议做的。",
        "Keine Bewegungen in diesem Monat — sie entstehen aus den Vorschlägen in der Tabelle oben.")}</p>`}
    </div>
  </details>`;
}

/* ============================================================ 事件绑定 ==== */
/* 导出给税务师。这是原来那个假页面唯一真正有用的动作，
   现在直接从月度结算这张表导 —— 数据只有一份，不再抄第二份。 */
function hrsCsv(store, month) {
  const staff = hrsStaff(store, month);
  const head = ["Mitarbeiter", "Vertrag", "Satz", "Geplant", "Ist-Abweichung", "Abwesenheit bezahlt",
                "Ueberstunden", "Zeitkonto", "Abzurechnen", "Lohn (Schaetzung)", "Urlaubstage", "Kranktage"];
  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const year = month.slice(0, 4);
  const lines = [head.map(esc).join(",")];
  staff.map(e => hrsRow(store, e, month)).sort((a, b) => a.e.name.localeCompare(b.e.name)).forEach(r => {
    const lvDaysU = typeof lvOf === "function"
      ? lvOf(store, r.e.id, "approved").filter(x => x.type === "urlaub").reduce((s2, x) => s2 + lvDaysIn(x, month), 0) : 0;
    const lvDaysK = typeof lvOf === "function"
      ? lvOf(store, r.e.id, "approved").filter(x => x.type === "krank").reduce((s2, x) => s2 + lvDaysIn(x, month), 0) : 0;
    lines.push([r.e.name, empRaw(r.type.name.de), r.hourly ? `${r.rate} EUR/h` : `${r.rate} EUR/Monat`,
      r.planned, r.att, r.lvPaid, r.ot, r.delta, Math.round(r.payable * 100) / 100,
      Math.round(r.pay * 100) / 100, Math.round(lvDaysU * 2) / 2, Math.round(lvDaysK * 2) / 2]
      .map(esc).join(","));
  });
  return `\ufeff${lines.join("\n")}`;
}

function hrsBindAll() {
  document.querySelectorAll(".hrs-csv").forEach(b => b.addEventListener("click", () => {
    const store = typeof schStore === "function" ? schStore() : empStores()[0];
    const month = b.dataset.month;
    if (typeof schDownload === "function") {
      schDownload(`KaiSpan_Lohndaten_${store.replace(/\s+/g, "_")}_${month}.csv`, hrsCsv(store, month), "text/csv");
      empFlash(b, empT("已导出", "Exportiert"));
    }
  }));

  const month = hrsMonth();
  const store = schStore();

  if (state().params.get("focus") === "hours") {
    requestAnimationFrame(() => document.querySelector("#sch-month-hours")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  document.querySelectorAll(".hrs-apply").forEach(b => b.addEventListener("click", () => {
    const e = empById(b.dataset.emp);
    const hours = Number(b.dataset.hours);
    const kind = b.dataset.type;
    if (!e || !(hours > 0)) return;
    hrsAddAzk(store, e.id, b.dataset.month, kind, hours,
      kind === "in" ? empT("按建议存入，把本月计薪压回上限以内", "Einzahlung laut Vorschlag")
                    : empT("按建议取出，补足合同工时", "Entnahme laut Vorschlag"));
    empMarkSaved(e.id);
    app();
  }));

  document.querySelectorAll(".hrs-azk-undo").forEach(b => b.addEventListener("click", () => {
    hrsDropAzk(b.dataset.id);
    app();
  }));

  document.querySelectorAll(".hrs-ot-add").forEach(b => b.addEventListener("click", () => {
    const empId = document.querySelector(".hrs-ot-emp")?.value;
    const date = document.querySelector(".hrs-ot-date")?.value;
    const hours = Number(document.querySelector(".hrs-ot-hours")?.value);
    const reason = document.querySelector(".hrs-ot-reason")?.value.trim();
    if (!empId || !date) { empFlash(b, empT("选一个人和日期", "Person und Datum wählen")); return; }
    if (!(hours > 0)) { empFlash(b, empT("加班小时要大于 0", "Stunden müssen > 0 sein")); return; }
    if (!reason) { empFlash(b, empT("写一句原因，将来查得清", "Bitte einen Grund angeben")); return; }
    hrsAddOt(b.dataset.store, empId, date, hours, reason);
    app();
  }));

  document.querySelectorAll(".hrs-ot-ok").forEach(b => b.addEventListener("click", () => {
    hrsDecideOt(b.dataset.id, "approved");
    app();
  }));
  document.querySelectorAll(".hrs-ot-no").forEach(b => b.addEventListener("click", () => {
    hrsDecideOt(b.dataset.id, "rejected");
    app();
  }));
}
