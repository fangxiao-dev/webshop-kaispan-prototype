/* ==========================================================================
   KaiSpan · 工资单与发薪（第 5 步）
   --------------------------------------------------------------------------
   在 leave.js 之后、hours.js 之前以 defer 加载，前缀 pay。

   原来这一块是两个假页面：「工资单与发薪」一张写死的打包表，「发薪」一张写死的
   SEPA 列表加一个不生成任何东西的按钮。

   **D25 定的口径边界（2026-09-03 Mingrong 要求写进日志）：**

     排班与工时  算「应发多少小时、税前大概多少钱」—— 自己算的，用来做决策和给税务师
     工资单与发薪 管「税务师算完之后回来的工资单和真正打款」—— 外部回来的，用来发钱和存档

   所以这一页**不再算一遍工资**。它从「封账」开始，接的是月度结算算完的那个数。
   四步一条线，每一步只有一个下一个动作：

     1. 封账   把这个月定下来。定之前系统先查考勤、休假、加班、班表是不是都收干净了 ——
               没收干净不让封。封的那一刻拍一张快照，之后底层再变也不动它。
     2. 发给税务师  没有邮件后端，所以给的是能下载的 CSV 和能复制的正文，
               发出去之后自己标一下「已发」，系统记下发给了谁、什么时候。
     3. 收工资单核对  税务师算完把 Lohnabrechnung 发回来，逐人登记 Brutto / Netto / 工时。
               系统拿它跟第 1 步的快照比 —— **对不上的标出来，这是这一页唯一真正值钱的动作**。
     4. 发薪   生成真的 SEPA pain.001 XML（不是一个假按钮），逐人标记已打款，
               再把工资单发给员工（员工端看得到自己的）。

   做不到的两件事，页面上写明，不假装：
     · 没有后端，发不出邮件，也没法真的把工资单 PDF 发给员工 —— 只能导出和标记状态。
     · 工资单上的 Brutto / Netto 是手工登记的。真实产品里这里是上传 PDF、AI 读出这三个数；
       这里可以选文件（文件名是你真选的那个文件），但数字要自己填。
   ========================================================================== */

const PAY_KEY = "kaispanPayroll";

const PAY_STATES = {
  open:   { tone: "yellow", name: { zh: "待提交", de: "Ausstehende Einreichung" } },
  closed: { tone: "blue",   name: { zh: "已封账", de: "Abgeschlossen" } },
  sent:   { tone: "purple", name: { zh: "已封账 · 已提交税务师", de: "An Steuerberater" } },
  back:   { tone: "orange", name: { zh: "已封账 · 工资单已回", de: "Abrechnungen erhalten" } },
  paid:   { tone: "green",  name: { zh: "已封账 · 已发薪", de: "Ausgezahlt" } }
};

const PAY_STEPS = ["closed", "sent", "back", "paid"];

/* ---------------------------------------------------------------- 存储 --- */
/* 跟考勤、休假同一个坑：种子要读班表和工时，而班表的种子又会往回调。
   排班还在种的时候读到的是空表，那时候定型就废了。 */
function payAll() {
  const saved = empRead(PAY_KEY, null);
  if (saved) return saved;
  if (paySeeding) return {};
  if (typeof schSeeding !== "undefined" && schSeeding) return {};
  paySeeding = true;
  let seed = {};
  try { seed = paySeed(); } finally { paySeeding = false; }
  empWrite(PAY_KEY, seed);
  return seed;
}

function payKey(store, month) {
  return `${store}|${month}`;
}

function payBlank(store, month) {
  return { store, month, state: "open", closedAt: null, closedBy: null,
           sentAt: null, sentTo: "", paidAt: null,
           snap: {}, slips: {}, pays: {}, sentToEmp: {}, log: [] };
}

function payGet(store, month) {
  const hit = payAll()[payKey(store, month)];
  const run = hit ? JSON.parse(JSON.stringify(hit)) : payBlank(store, month);
  const deadline = `${payMonthAdd(month, 1)}-02`;
  if (!paySeeding && typeof hrsAddAzk === "function" && empToday() >= deadline && !run.monthlyExamplesV2) {
    payPrepareClosedExamples(run, deadline);
    const all = { ...payAll(), [payKey(store, month)]: run };
    empWrite(PAY_KEY, all);
  }
  if (run.monthlyExamplesV2 && !run.monthlyExamplesV3) {
    run.beforeMonthlyExamplesV3 = JSON.parse(JSON.stringify(run));
    Object.entries(run.snap).forEach(([id, snap], i) => {
      if (snap.payType === "pauschal" && snap.actual === 182) snap.actual = snap.payable = snap.planned = 181.2;
      snap.gross += Number(run.extras?.[id]?.bonus || 0);
      const old = run.slips[id];
      const older = month < payPrevMonth();
      if (older || (i !== 1 && (!old || /^Lohnabrechnung_/.test(old.file || "") || !old.file))) {
        const gross = Math.round((snap.gross + (!older && i === 3 ? 35 : 0)) * 100) / 100;
        run.slips[id] = { gross, net: Math.round(gross * .718 * 100) / 100, hours: snap.payable,
          file: !older && i === 6 ? "" : `Lohnabrechnung_${snap.name}_${month}.pdf`,
          note: "", at: `${deadline}T12:00:00`, by: "Martin" };
        if (older) run.pays[id] = { state: "paid", at: `${deadline}T14:00:00`, iban: snap.iban };
      }
    });
    run.state = month < payPrevMonth() ? "paid" : "back";
    run.monthlyExamplesV3 = true;
    empWrite(PAY_KEY, { ...payAll(), [payKey(store, month)]: run });
  }
  if (run.state === "open" && month === "2026-10" && !run.openExamplesV1) {
    run.beforeOpenExamplesV1 = JSON.parse(JSON.stringify(run));
    run.openDrafts = {...(run.openDrafts || {})};
    const values=[181.2,169.2,84,39,35,173.2,28];
    empStaff(store).filter(e=>e.status!=="invited").forEach((e,i)=>{
      if(run.openDrafts[e.id])return;
      const contract={...e.contract};
      if(i===3)Object.assign(contract,{type:"werkstudent",hoursMin:30,hoursMax:80});
      if(i===5)Object.assign(contract,{payType:"pauschal",rate:3000});
      run.openDrafts[e.id]={hours:values[i%values.length],contract,bonus:i===0?120:0,urlaubDays:i===2?2:0,krankDays:i===1?1:0,travel:i===2?46.8:0};
      if(i===2)run.travelClaims={...(run.travelClaims||{}),[e.id]:{claimed:46.8,receipts:["车票-示例.pdf"],state:"approved",approved:46.8,at:empNow(),decidedAt:empNow(),note:""}};
    });
    run.confirmations={...(run.confirmations||{})};
    Object.keys(run.openDrafts).forEach((id,i)=>{if(i===0||i===2)run.confirmations[id]={at:`${month}-28T18:00:00`,by:empById(id)?.name,source:"employee_reply_demo"};});
    run.openExamplesV1=true;
    empWrite(PAY_KEY,{...payAll(),[payKey(store,month)]:run});
  }
  return run;
}

/* 演示月份按次月 2 日完结。旧数据留在备份里，后续修改不覆盖封账快照。 */
function payPrepareClosedExamples(run, deadline) {
  run.beforeMonthlyExamplesV2 = JSON.parse(JSON.stringify(run));
  const employees = empStaff(run.store).filter(e => e.status !== "invited" && (!e.entryDate || e.entryDate <= `${run.month}-31`));
  const actuals = [181.2, 169.2, 74, 86, 35, 182, 28, 72];
  run.snap = {};
  run.confirmations = {};
  run.extras = {};
  employees.forEach((e, i) => {
    const contract = { ...e.contract };
    if (i === 3) Object.assign(contract, { type: "werkstudent", isStudent: true, hoursMin: 40, hoursMax: 80 });
    if (i === 5) Object.assign(contract, { payType: "pauschal", rate: 3000 });
    const actual = actuals[i % actuals.length];
    const hourly = contract.payType !== "pauschal";
    run.snap[e.id] = { name: e.name, role: e.role, type: empRaw(empContractType(contract.type).name.de),
      contract, actual, payable: actual, planned: actual, att: 0, lv: 0, lvPaid: 0, ot: 0, delta: 0,
      payType: hourly ? "hourly" : "pauschal", rate: Number(contract.rate) || 0,
      gross: Math.round((hourly ? actual * contract.rate : contract.rate) * 100) / 100,
      urlaubDays: i === 2 ? 2 : 0, krankDays: i === 1 ? 1 : 0,
      iban: e.ids?.iban || "", bic: e.ids?.bic || "" };
    run.confirmations[e.id] = { at: `${deadline}T08:00:00`, by: e.name };
    run.extras[e.id] = { bonus: i === 0 ? 120 : 0, travel: i === 2 ? 46.8 : 0 };
    if (i === 2) run.travelClaims = { ...(run.travelClaims || {}), [e.id]: { claimed: 46.8, receipts: ["车票-示例.pdf"], state: "approved", approved: 46.8, at: empNow(), decidedAt: empNow(), note: "" } };
    if (i === 1 && !hrsAzkAll().some(a => a.payrollOpening && a.store === run.store && a.empId === e.id)) {
      const records = hrsAddAzk(run.store, e.id, payMonthAdd(run.month, -1), "in", 12, "月度结算演示：上期结转余额");
      records[0].payrollOpening = `${run.store}|${run.month}|${e.id}`;
      empWrite(HRS_AZK_KEY, records);
    }
  });
  run.state = ["back", "paid"].includes(run.state) ? run.state : "sent";
  run.closedAt = run.closedAt || `${deadline}T09:00:00`;
  run.closedBy = run.closedBy || "Martin";
  run.sentAt = run.sentAt || `${deadline}T10:00:00`;
  run.sentTo = run.sentTo || "steuerkanzlei.weber@example.de";
  run.monthlyExamplesV2 = true;
  run.deadline = deadline;
  run.log = [{ at: `${deadline}T10:00:00`, by: "Martin", what: {
    zh: "次月 2 日前完成工时确认、封账并提交税务师；后续通过提交修改处理。",
    de: "Bis zum 2. des Folgemonats abgeschlossen und gemeldet. Änderungen erfolgen als Korrektur." } }, ...(run.log || [])];
}

function paySave(run, entry) {
  const all = { ...payAll() };
  if (entry) run.log = [entry, ...(run.log || [])].slice(0, 40);
  all[payKey(run.store, run.month)] = run;
  empWrite(PAY_KEY, all);
  return run;
}

function payLog(run, what, by) {
  return { at: empNow(), by: by || empT("店长", "Leitung"), what };
}

/* ============================================================ 封账前置 ====
   「封账」这个动作的全部意义就是**定下来**。定之前必须确认前四步都收干净了，
   否则封的是一个还会变的数，发给税务师之后再变就要走更正 —— 那是真花钱的。
   四条检查各自给直达链接，不是只报个数让人自己找。 */
function payBlockers(store, month) {
  const out = [];
  const add = (code, zh, de, href) => out.push({ code, zh, de, href });

  /* 1. 班表排完了没有。没排完，工时本身就还是预测。 */
  if (typeof hrsMonthProgress === "function") {
    const pr = hrsMonthProgress(store, month);
    if (!pr.done) {
      add("roster", `班表只排到 ${pr.covered} 号，全月 ${pr.days} 天 —— 工时还是预测值，不能封账`,
          `Plan nur bis Tag ${pr.covered} von ${pr.days} — die Stunden sind noch eine Hochrechnung`,
          `#${slug("employee", "排班管理")}?v=month&m=${month}`);
    }
  }
  /* 2. 考勤异常没处理完，工时数还会变。 */
  const att = typeof attMonthPending === "function" ? attMonthPending(store, month) : 0;
  if (att) {
    add("att", `还有 ${att} 条考勤没处理，处理完工时才是定的`,
        `${att} offene Zeiterfassungen — die Stunden stehen erst danach fest`,
        `#${slug("employee", "考勤")}`);
  }
  /* 3. 休假待批的，批不批直接改这个月的工时和天数。 */
  if (typeof lvOpen === "function") {
    const pend = lvOpen(store).filter(x => lvOverlapsMonth(x, month));
    if (pend.length) {
      add("leave", `还有 ${pend.length} 条休假申请压在这个月里没批`,
          `${pend.length} Abwesenheitsanträge für diesen Monat offen`,
          `#${slug("employee", "排班管理")}?v=leave&m=${month}`);
    }
  }
  /* 4. 加班待审的，批了就是钱。 */
  if (typeof hrsOt === "function") {
    const ot = hrsOt(store).filter(x => x.state === "pending" && String(x.date).slice(0, 7) === month);
    if (ot.length) {
      add("ot", `还有 ${ot.length} 条加班没审批 —— 批了就进工资`,
          `${ot.length} Überstunden-Anträge offen — nach Freigabe lohnrelevant`,
          `#${slug("employee", "排班管理")}?v=month&m=${month}`);
    }
  }
  return out;
}

/* ============================================================ 快照 ========
   封账那一刻把每个人的数字抄下来。之后店长再去改考勤、批休假，
   这张快照都不动 —— 已经报给税务师的数不能被人在背后改掉。
   差异由 payDrift() 显式报出来，让人决定是重开封账还是留到下月更正。 */
function paySnapshot(store, month) {
  if (typeof hrsStaff !== "function") return {};
  const snap = {};
  hrsStaff(store, month).forEach(e => {
    const r = hrsRow(store, e, month);
    const dayCount = (type) => typeof lvOf === "function"
      ? lvOf(store, e.id, "approved").filter(x => x.type === type)
          .reduce((s, x) => s + lvDaysIn(x, month), 0) : 0;
    snap[e.id] = {
      name: e.name, role: e.role,
      type: empRaw(r.type.name.de), payType: r.hourly ? "hourly" : "pauschal",
      rate: r.rate, planned: r.planned, att: r.att, lv: r.lv, lvPaid: r.lvPaid,
      ot: r.ot, delta: r.delta,
      payable: Math.round(r.payable * 100) / 100,
      gross: Math.round(r.pay * 100) / 100,
      urlaubDays: Math.round(dayCount("urlaub") * 2) / 2,
      krankDays: Math.round(dayCount("krank") * 2) / 2,
      iban: (e.ids && e.ids.iban) || "", bic: (e.ids && e.ids.bic) || ""
    };
  });
  return snap;
}

/* 封账之后底层又变了多少。餐饮里这事天天发生：工资单都发出去了，
   有人拿着一张三周前的 AU 过来。所以不能悄悄跟着变，也不能装作没发生。 */
function payDrift(store, month) {
  const run = payGet(store, month);
  if (run.state === "open") return [];
  const now = paySnapshot(store, month);
  const out = [];
  Object.keys({ ...run.snap, ...now }).forEach(id => {
    const a = run.snap[id], b = now[id];
    if (!a && b) {
      out.push({ id, name: b.name, kind: "added",
        zh: `封账之后新出现在这个月里（${schH(b.payable)}）`, de: `Nach Abschluss neu hinzugekommen (${schH(b.payable)})` });
      return;
    }
    if (a && !b) {
      out.push({ id, name: a.name, kind: "gone",
        zh: "封账之后从这个月里消失了", de: "Nach Abschluss nicht mehr im Monat" });
      return;
    }
    const dh = Math.round((b.payable - a.payable) * 100) / 100;
    const dg = Math.round((b.gross - a.gross) * 100) / 100;
    if (Math.abs(dh) > 0.01 || Math.abs(dg) > 0.01) {
      out.push({ id, name: a.name, kind: "changed", dh, dg,
        zh: `封账时 ${schH(a.payable)} / €${a.gross.toFixed(2)}，现在 ${schH(b.payable)} / €${b.gross.toFixed(2)}`,
        de: `Bei Abschluss ${schH(a.payable)} / €${a.gross.toFixed(2)}, jetzt ${schH(b.payable)} / €${b.gross.toFixed(2)}` });
    }
  });
  return out;
}

/* ============================================================== 动作 ===== */
function payClose(store, month, by, override = false) {
  if (!override && payBlockers(store, month).length) return { ok: false, code: "blocked" };
  const run = payGet(store, month);
  if (run.state !== "open") return { ok: false, code: "already" };
  run.snap = paySnapshot(store, month);
  Object.entries(run.openDrafts||{}).forEach(([id,d])=>{const snap=run.snap[id];if(!snap)return;const hours=Number(d.hours)+(Number(hrsRow(store,empById(id),month).delta)||0);Object.assign(snap,{contract:d.contract,payable:hours,actual:hours,rate:d.contract.rate,payType:d.contract.payType,gross:(d.contract.payType==="pauschal"?Number(d.contract.rate):hours*Number(d.contract.rate))+Number(d.bonus||0),urlaubDays:d.urlaubDays,krankDays:d.krankDays});run.extras={...(run.extras||{}),[id]:{bonus:d.bonus,travel:d.travel}};});
  run.state = "closed";
  run.closedAt = empNow();
  run.closedBy = by || empT("店长", "Leitung");
  const total = Object.keys(run.snap).reduce((s, k) => s + run.snap[k].gross, 0);
  paySave(run, payLog(run, {
    zh: `封账：${Object.keys(run.snap).length} 人，税前合计 €${total.toFixed(2)}`,
    de: `Abgeschlossen: ${Object.keys(run.snap).length} Personen, brutto €${total.toFixed(2)}` }, by));
  return { ok: true, run };
}

/* 重开封账。发现封错了要能退回去 —— 不给退路，店长就只能不敢封。
   已经登记的工资单和付款记录保留，因为那些是外面发生过的事实。 */
function payReopen(store, month, why, by) {
  const run = payGet(store, month);
  if (run.state === "open") return null;
  run.state = "open";
  run.closedAt = null; run.closedBy = null; run.sentAt = null;
  paySave(run, payLog(run, {
    zh: `重开封账${why ? `：${why}` : ""}。已登记的工资单和付款记录留着，那是外面已经发生的事。`,
    de: `Abschluss zurückgenommen${why ? `: ${why}` : ""}. Erfasste Abrechnungen und Zahlungen bleiben erhalten.` }, by));
  return run;
}

function payMarkSent(store, month, to, by) {
  const run = payGet(store, month);
  if (run.state !== "closed") return null;
  run.state = "sent";
  run.sentAt = empNow();
  run.sentTo = (to || "").trim();
  paySave(run, payLog(run, {
    zh: `标记为已发给税务师${run.sentTo ? `：${run.sentTo}` : ""}（系统没有邮件后端，邮件是你自己发的）`,
    de: `Als versendet markiert${run.sentTo ? `: ${run.sentTo}` : ""} (kein E-Mail-Backend — Versand erfolgt manuell)` }, by));
  return run;
}

/* 登记税务师回来的工资单。三个数手填，文件名来自真选的那个文件。 */
function paySetSlip(store, month, empId, slip, by) {
  const run = payGet(store, month);
  if (!run.snap[empId]) return null;
  run.slips[empId] = {
    gross: Number(slip.gross) || 0,
    net: Number(slip.net) || 0,
    hours: Number(slip.hours) || 0,
    file: slip.file || "", note: (slip.note || "").trim(),
    at: empNow(), by: by || empT("店长", "Leitung")
  };
  if (run.state === "sent") run.state = "back";
  const d = payDiff(run, empId);
  paySave(run, payLog(run, {
    zh: `登记 ${run.snap[empId].name} 的工资单：Brutto €${run.slips[empId].gross.toFixed(2)} · Netto €${run.slips[empId].net.toFixed(2)} · ${schH(run.slips[empId].hours)}${
      d && d.off ? `　⚠ 跟封账时的数对不上（${d.dg >= 0 ? "+" : ""}€${d.dg.toFixed(2)} / ${d.dh >= 0 ? "+" : ""}${schH(d.dh)}）` : ""}`,
    de: `Abrechnung ${run.snap[empId].name}: brutto €${run.slips[empId].gross.toFixed(2)}, netto €${run.slips[empId].net.toFixed(2)}, ${schH(run.slips[empId].hours)}${
      d && d.off ? `　⚠ Abweichung zum Abschluss (${d.dg >= 0 ? "+" : ""}€${d.dg.toFixed(2)} / ${d.dh >= 0 ? "+" : ""}${schH(d.dh)})` : ""}` }, by));
  return run;
}

function payDropSlip(store, month, empId, by) {
  const run = payGet(store, month);
  if (!run.slips[empId]) return null;
  const name = run.snap[empId] ? run.snap[empId].name : empId;
  delete run.slips[empId];
  delete run.pays[empId];
  if (run.state === "back" && !Object.keys(run.slips).length) run.state = "sent";
  paySave(run, payLog(run, { zh: `撤掉 ${name} 的工资单登记`, de: `Abrechnung ${name} entfernt` }, by));
  return run;
}

/* ============================================================ 对账 ======== */
function payTolerance() { const euro = Number(empRule("payslipToleranceEuro")); return Number.isFinite(euro) && euro >= 0 ? euro : 0; }

/* 工时差按一刻钟看 —— 工时模块本来就按一刻钟取整，比这更细的差没有意义。 */
function payDiff(run, empId) {
  const s = run.snap[empId], slip = run.slips[empId];
  if (!s || !slip) return null;
  const dg = Math.round((slip.gross - s.gross) * 100) / 100;
  const dh = Math.round((slip.hours - s.payable) * 100) / 100;
  const tol = payTolerance();
  return { dg, dh, tol, off: Math.abs(dg) > tol || Math.abs(dh) > 0.25, explained: !!slip.note };
}

function payOffRows(store, month) {
  const run = payGet(store, month);
  return Object.keys(run.slips).map(id => ({ id, d: payDiff(run, id), snap: run.snap[id], slip: run.slips[id] }))
    .filter(r => r.d && r.d.off && !r.d.explained);
}

/* ============================================================ 付款 ======== */
/* 净额只有税务师算得出来，所以没登记工资单的人不能付 —— 我们不知道该打多少钱。 */
function payPayable(store, month) {
  const run = payGet(store, month);
  return Object.keys(run.snap).map(id => {
    const slip = run.slips[id];
    const s = run.snap[id];
    const paid = run.pays[id] && run.pays[id].state === "paid";
    /* 净额 0 的人（比如整月一个班都没排的）不进付款列表：SEPA 不收金额为 0 的笔，
       银行会整份文件退回来。这不是「缺东西」，所以也不当拦截 —— 是这个月本来就不用打。 */
    const why = !slip ? "noslip" : slip.net <= 0 ? "zero" : !s.iban ? "noiban" : null;
    return { id, name: s.name, iban: s.iban, bic: s.bic, net: slip ? slip.net : 0, slip, paid, why };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function payMarkPaid(store, month, empId, on, by) {
  const run = payGet(store, month);
  if (!run.slips[empId] || !run.snap[empId].iban) return null;
  if (on) run.pays[empId] = { state: "paid", at: empNow(), iban: run.snap[empId].iban };
  else delete run.pays[empId];
  const rows = payPayable(store, month);
  const done = rows.filter(r => !r.why).every(r => run.pays[r.id]);
  if (done && rows.some(r => !r.why)) { run.state = "paid"; run.paidAt = empNow(); }
  else if (run.state === "paid") { run.state = "back"; run.paidAt = null; }
  paySave(run, payLog(run, {
    zh: `${run.snap[empId].name} ${on ? `已打款 €${run.slips[empId].net.toFixed(2)}` : "取消已打款标记"}`,
    de: `${run.snap[empId].name} ${on ? `bezahlt €${run.slips[empId].net.toFixed(2)}` : "Zahlung zurückgenommen"}` }, by));
  return run;
}

function paySendSelectedDemo(store,month,ids) {
  const run=payGet(store,month), unique=[...new Set(ids)];
  const valid=unique.filter(id=>run.snap[id] && run.slips[id]?.file && empById(id)?.contact?.email);
  if(!valid.length) return {ok:false,message:"请选择有工资单和邮箱的员工"};
  const at=empNow();
  run.slipDemoDispatches=run.slipDemoDispatches || [];
  run.sentToEmpDemo=run.sentToEmpDemo || {};
  valid.forEach(id=>{
    const record={empId:id,to:empById(id).contact.email,file:run.slips[id].file,month,at,state:"simulated"};
    run.slipDemoDispatches.unshift(record);run.sentToEmpDemo[id]=at;
  });
  run.lastDemoDispatch={count:valid.length,at};
  paySave(run,payLog(run,{zh:`模拟发送 ${valid.length} 份工资单给对应员工（离线演示，未实际发出邮件）`,de:`Demo-Versand: ${valid.length} Abrechnungen; keine E-Mails versendet`},"Martin"));
  return {ok:true,count:valid.length,skipped:unique.length-valid.length};
}

function payMarkSlipSent(store, month, empId, by) {
  const run = payGet(store, month);
  if (!run.slips[empId]) return null;
  run.sentToEmp[empId] = empNow();
  paySave(run, payLog(run, {
    zh: `把 ${run.snap[empId].name} 的工资单标记为已发给本人（系统发不出去，是你线下发的）`,
    de: `Abrechnung ${run.snap[empId].name} als an den Mitarbeiter versendet markiert` }, by));
  return run;
}

/* ============================================================ 导出 ======== */
/* 给税务师的那份。从**快照**导，不是从当前值导 ——
   封账之后底层再变也不该改变已经报出去的数。 */
function payAdvisorCsv(store, month) {
  const run = payGet(store, month);
  const head = ["Mitarbeiter", "Vertrag", "Satz", "Abzurechnende Stunden", "davon bezahlte Abwesenheit",
                "Ueberstunden", "Zeitkonto", "Brutto (Schaetzung)", "Urlaubstage", "Kranktage", "IBAN"];
  const esc = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(",")];
  Object.keys(run.snap).map(id => run.snap[id]).sort((a, b) => a.name.localeCompare(b.name))
    .forEach(s => lines.push([s.name, s.type,
      s.payType === "hourly" ? `${s.rate} EUR/h` : `${s.rate} EUR/Monat`,
      s.payable, s.lvPaid, s.ot, s.delta, s.gross, s.urlaubDays, s.krankDays, s.iban].map(esc).join(",")));
  return `﻿${lines.join("\n")}`;
}

function payAdvisorMail(store, month) {
  const run = payGet(store, month);
  const n = Object.keys(run.snap).length;
  const total = Object.keys(run.snap).reduce((s, k) => s + run.snap[k].gross, 0);
  return empT(
`Betreff: Lohndaten ${month} – ${store}

Guten Tag,

anbei die Lohndaten für ${month} (${n} Mitarbeitende, Bruttosumme nach unserer Rechnung ca. €${total.toFixed(2)}).
Die CSV enthält je Person: abzurechnende Stunden, davon bezahlte Abwesenheit, Überstunden, Zeitkonto-Bewegung, Urlaubs- und Kranktage.

Bitte um die Abrechnungen. Rückfragen jederzeit.

Viele Grüße
${empEmployer(store).legalName || store}`,
`Betreff: Lohndaten ${month} – ${store}

Guten Tag,

anbei die Lohndaten für ${month} (${n} Mitarbeitende, Bruttosumme nach unserer Rechnung ca. €${total.toFixed(2)}).
Die CSV enthält je Person: abzurechnende Stunden, davon bezahlte Abwesenheit, Überstunden, Zeitkonto-Bewegung, Urlaubs- und Kranktage.

Bitte um die Abrechnungen. Rückfragen jederzeit.

Viele Grüße
${empEmployer(store).legalName || store}`);
}

/* ============================================================ SEPA ========
   真的 pain.001.001.03，不是一个假按钮。下载下来就是银行能收的那份 XML。
   付款账户在合规设置里填一次（公司 IBAN / BIC / 法定名称），缺了就不让生成。 */
function paySepaBlockers(store, month) {
  const out = [];
  const c = empEmployer(store);
  if (!c.legalName) out.push({ code: "name", zh: "公司法定名称没填", de: "Firmenname fehlt" });
  if (!payIbanOk(c.iban)) out.push({ code: "iban", zh: "公司付款账户 IBAN 没填或者格式不对", de: "Firmen-IBAN fehlt oder ungültig" });
  const rows = payPayable(store, month);
  const noSlip = rows.filter(r => r.why === "noslip");
  const noIban = rows.filter(r => r.why === "noiban");
  if (noSlip.length) {
    out.push({ code: "noslip", zh: `还有 ${noSlip.length} 人的工资单没登记 —— 净额只有税务师算得出来，不知道该打多少钱`,
               de: `${noSlip.length} Abrechnungen fehlen — ohne Nettobetrag keine Zahlung`, who: noSlip.map(r => r.name) });
  }
  if (noIban.length) {
    out.push({ code: "noiban", zh: `${noIban.length} 人没有 IBAN，钱打不出去`,
               de: `${noIban.length} ohne IBAN — Zahlung nicht möglich`, who: noIban.map(r => r.name) });
  }
  return out;
}

/* 只做长度和字符校验加 mod-97 校验位，不查银行是否存在 —— 页面上写明这一条。 */
function payIbanOk(raw) {
  const s = String(raw || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const re = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (let i = 0; i < re.length; i += 1) {
    const ch = re[i];
    const val = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (let j = 0; j < val.length; j += 1) rem = (rem * 10 + Number(val[j])) % 97;
  }
  return rem === 1;
}

function payXmlEsc(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paySepaXml(store, month, selectedIds = null, manualRows = null) {
  const c = empEmployer(store);
  const rows = (manualRows || payPayable(store, month)).filter(r => !r.why && !r.paid && (!selectedIds || selectedIds.includes(r.id)));
  const iban = s => String(s || "").replace(/\s+/g, "").toUpperCase();
  const sum = rows.reduce((s, r) => s + r.net, 0);
  const now = new Date();
  const stamp = now.toISOString().slice(0, 19);
  const msgId = `KAISPAN-${month.replace("-", "")}-${now.getTime().toString().slice(-6)}`;
  const exec = empShiftDate(empToday(), 1);
  const tx = rows.map((r, i) => `      <CdtTrfTxInf>
        <PmtId><EndToEndId>${payXmlEsc(`LOHN-${month}-${r.id}`)}</EndToEndId></PmtId>
        <Amt><InstdAmt Ccy="EUR">${r.net.toFixed(2)}</InstdAmt></Amt>
${r.bic ? `        <CdtrAgt><FinInstnId><BIC>${payXmlEsc(iban(r.bic))}</BIC></FinInstnId></CdtrAgt>\n` : ""}        <Cdtr><Nm>${payXmlEsc(r.name)}</Nm></Cdtr>
        <CdtrAcct><Id><IBAN>${payXmlEsc(iban(r.iban))}</IBAN></Id></CdtrAcct>
        <RmtInf><Ustrd>${payXmlEsc(`Lohn ${month}`)}</Ustrd></RmtInf>
      </CdtTrfTxInf>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${payXmlEsc(msgId)}</MsgId>
      <CreDtTm>${stamp}</CreDtTm>
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${sum.toFixed(2)}</CtrlSum>
      <InitgPty><Nm>${payXmlEsc(c.legalName || store)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${payXmlEsc(`${msgId}-1`)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${rows.length}</NbOfTxs>
      <CtrlSum>${sum.toFixed(2)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
      <ReqdExctnDt>${exec}</ReqdExctnDt>
      <Dbtr><Nm>${payXmlEsc(c.legalName || store)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${payXmlEsc(iban(c.iban))}</IBAN></Id></DbtrAcct>
${c.bic ? `      <DbtrAgt><FinInstnId><BIC>${payXmlEsc(iban(c.bic))}</BIC></FinInstnId></DbtrAgt>\n` : ""}      <ChrgBr>SLEV</ChrgBr>
${tx}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;
}

/* ==================================================== 员工端要的那一条 ==== */
function payMine(store, empId, month) {
  const run = payGet(store, month);
  const slip = run.slips[empId];
  if (!slip) return { state: run.state, slip: null, paid: false, sentAt: null };
  return { state: run.state, slip, paid: !!(run.pays[empId] && run.pays[empId].state === "paid"),
           sentAt: run.sentToEmp[empId] || null };
}

/* ============================================================== 待办 ===== */
function payPrevMonth() {
  const d = new Date(`${empToday()}T00:00:00`);
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function payTodoItems() {
  const store = typeof schStore === "function" ? schStore() : empStores()[0];
  const month = payPrevMonth();
  const run = payGet(store, month);
  const href = `#${slug("employee", "工资单与发薪")}?m=${month}`;
  const out = [];
  if (run.state === "open") {
    const bl = payBlockers(store, month);
    out.push({ type: "工资未封账", store, module: "员工助手",
      title: bl.length
        ? `${schMonthName(month)}还没封账，有 ${bl.length} 件事没收干净：${bl.map(x => x.zh.split("，")[0]).join("；")}`
        : `${schMonthName(month)}的工时都收干净了，可以封账发给税务师`,
      /* de：员工助手主页在 .emp-page 里，全站词典翻译够不着，德语得自己带 */
      de: bl.length
        ? `${schMonthName(month)} ist noch nicht abgeschlossen — ${bl.length} offene Punkte: ${bl.map(x => x.de.split(" — ")[0]).join("; ")}`
        : `Die Stunden für ${schMonthName(month)} sind vollständig — Monat kann abgeschlossen und an den Steuerberater gesendet werden`,
      due: "尽快处理", risk: bl.length ? "中风险" : "普通", status: "未处理", href });
    return out;
  }
  const off = payOffRows(store, month);
  if (off.length) {
    out.push({ type: "工资单对不上", store, module: "员工助手",
      title: `${schMonthName(month)}有 ${off.length} 份工资单跟封账时的数对不上，还没说明（${off.map(r => r.snap.name).join("、")}）`,
      de: `${off.length} ${off.length === 1 ? "Abrechnung für" : "Abrechnungen für"} ${schMonthName(month)} ${off.length === 1 ? "weicht" : "weichen"} von den Abschlusswerten ab und ${off.length === 1 ? "ist" : "sind"} nicht erklärt (${off.map(r => r.snap.name).join(", ")})`,
      due: "尽快处理", risk: "高风险", status: "未处理", href });
  }
  if (["back", "sent"].includes(run.state)) {
    const rows = payPayable(store, month);
    const wait = rows.filter(r => !r.why && !r.paid).length;
    const miss = rows.filter(r => r.why).length;
    if (wait || miss) {
      out.push({ type: "工资待发", store, module: "员工助手",
        title: miss ? `${schMonthName(month)}还差 ${miss} 人的工资单或 IBAN，钱打不出去`
                    : `${schMonthName(month)}有 ${wait} 人的工资已核对好，还没打款`,
        de: miss ? `Für ${schMonthName(month)} ${miss === 1 ? "fehlt bei 1 Person" : `fehlen bei ${miss} Personen`} Abrechnung oder IBAN — es kann nicht gezahlt werden`
                 : `${wait} ${wait === 1 ? "geprüfter Lohn" : "geprüfte Löhne"} für ${schMonthName(month)} ${wait === 1 ? "ist" : "sind"} noch nicht ausgezahlt`,
        due: "本周到期", risk: miss ? "中风险" : "普通", status: "未处理", href });
    }
  }
  return out;
}

/* ============================================================== 种子 =====
   只种上个月一条，停在「工资单回来了一部分」这一步 —— 四步流程里最有信息量的那一步。
   Netto 是外面回来的数（税务师算的），系统自己从来不算它；种子里给的是一个像样的演示值，
   不是任何计算结果。故意留三样东西不完美，把这一页真正要干的活演示出来：
     · 一个人的工资单还没回来（发薪那一步会被它拦住）
     · 一个人的 Brutto 跟封账时差 €18.40（对账那一步要么改数要么写说明）
     · 一个人的快照被改小了 2 小时，模拟「封账之后又有人补了一条考勤」（漂移提示） */
let paySeeding = false;

function paySeed() {
  const store = empStores()[0];
  const month = payPrevMonth();
  const run = payBlank(store, month);
  run.snap = paySnapshot(store, month);
  const ids = Object.keys(run.snap).sort((a, b) => run.snap[a].name.localeCompare(run.snap[b].name));
  if (ids.length < 4) return {};
  run.state = "back";
  run.closedAt = `${month}-28T19:40:00.000Z`;
  run.closedBy = "Martin";
  run.sentAt = `${month}-28T19:55:00.000Z`;
  run.sentTo = "steuerkanzlei.weber@example.de";

  /* 先做「封账之后底层又变了」这一条：把第 4 个人的快照调小 2 小时，
     模拟封账之后有人补了一条考勤。**必须在生成工资单之前做** ——
     顺序反了的话这个人的工资单会连带跟快照对不上，
     「漂移」和「对账差额」两件不同的事就搅在一起，演示反而看不懂。 */
  if (run.snap[ids[3]]) {
    const s = run.snap[ids[3]];
    s.payable = Math.round((s.payable - 2) * 100) / 100;
    if (s.payType === "hourly") s.gross = Math.round((s.gross - 2 * s.rate) * 100) / 100;
  }
  /* 差 €18.40 的那条要落在一个真有工时的人身上。落在 0 小时的人身上
     （比如证件过期整月排不了班的 Liam）会变成「0 小时却发 18.4 欧」，看着就是错的。 */
  const offId = ids.find((id, i) => i !== 1 && run.snap[id].gross > 100) || ids[2];
  /* 第 3 个人的工资单是照着邮件正文里的数手敲进来的，PDF 忘了挂 —— 这是真会发生的一种，
     也是「工资单文件」那一列存在的理由：数进来了，凭证没留下，年底查账翻不出原始那张。
     所以种一条出来，那一列才有两种状态可看（Mingrong：图三应该显示工资单文件）。 */
  const noFileId = ids[2];
  ids.forEach((id, i) => {
    if (i === 1) return;                                   /* 这一份还没回来 */
    const s = run.snap[id];
    const gross = Math.round((s.gross + (id === offId ? 18.4 : 0)) * 100) / 100;
    run.slips[id] = { gross, net: Math.round(gross * 0.718 * 100) / 100,
      hours: s.payable, file: id === noFileId ? "" : `Lohnabrechnung_${s.name}_${month}.pdf`, note: "",
      at: `${month}-30T10:12:00.000Z`, by: "Martin" };
  });
  run.log = [
    { at: run.sentAt, by: "Martin", what: {
      zh: `标记为已发给税务师：${run.sentTo}（系统没有邮件后端，邮件是你自己发的）`,
      de: `Als versendet markiert: ${run.sentTo} (kein E-Mail-Backend)` } },
    { at: run.closedAt, by: "Martin", what: {
      zh: `封账：${ids.length} 人，税前合计 €${ids.reduce((s2, id) => s2 + run.snap[id].gross, 0).toFixed(2)}`,
      de: `Abgeschlossen: ${ids.length} Personen` } }
  ];
  const all = {};
  all[payKey(store, month)] = run;
  return all;
}

/* ============================================================== 页面 ===== */
function payStore() { return empScope() || empStores()[0]; }

function payMonth() {
  const m = state().params.get("m") || "";
  return /^\d{4}-\d{2}$/.test(m) ? m : payPrevMonth();
}

function payHref(patch) {
  const p = new URLSearchParams(state().params.toString());
  Object.keys(patch).forEach(k => {
    if (patch[k] == null || patch[k] === "") p.delete(k); else p.set(k, patch[k]);
  });
  const q = p.toString();
  return `#${slug("employee", "工资单与发薪")}${q ? `?${q}` : ""}`;
}

function payMonthAdd(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function payReached(run, step) {
  return PAY_STEPS.indexOf(step) <= PAY_STEPS.indexOf(run.state);
}

/* 2026-09-03（Mingrong：这条流程条整理成使用说明放到右上角）——
   四步条本来是页面上第二大的东西，可它说的每一件事下面的卡片自己都写着：
   1 封账 / 2 已发给税务师 / 3 收工资单 / 4 发薪，每张卡的标题就是步骤号和状态。
   横在中间的那条因此是第二遍。真正只有它在说的是「这四步各自要干什么、为什么」——
   那是说明，不是状态，所以搬进右上角的「使用说明」里，跟排班、考勤、休假一套排版。 */
const PAY_GUIDE = {
  title: { zh: "这一页怎么用", de: "So funktioniert diese Seite" },
  sub: { zh: "从封账到钱真的到账，一共四步。", de: "Vier Schritte vom Abschluss bis zur Auszahlung." },
  steps: [
    { h: { zh: "封账", de: "Monat abschließen" },
      p: { zh: "把这个月的工时定下来。封之前系统先查班表排满了没有、考勤处理完了没有、休假和加班批完了没有 —— 四条都过了才让封。封账那一刻的数会存成快照，之后再改考勤也不动它：已经报给税务师的数不能在背后被改掉。",
           de: "Die Stunden des Monats werden festgeschrieben. Vorher wird geprüft, ob Plan, Zeiterfassung, Abwesenheiten und Überstunden vollständig sind. Der Abschluss speichert einen Snapshot — spätere Änderungen verändern ihn nicht." } },
    { h: { zh: "发给税务师", de: "An den Steuerberater" },
      p: { zh: "下载一份 CSV（每人一行：工时、时薪、税前），连同现成的邮件正文用你自己的邮箱发出去。系统没有邮件后端，发不出去 —— 发完回来点「我已经发出去了」，只是记一笔你什么时候发给了谁。",
           de: "CSV herunterladen (eine Zeile je Person: Stunden, Satz, Brutto) und mit der Textvorlage aus dem eigenen Postfach senden. Das System versendet nichts selbst; die Markierung dokumentiert nur Ihren Versand." } },
    { h: { zh: "收工资单，逐人核对", de: "Abrechnungen erfassen und prüfen" },
      p: { zh: "税务师算完把 Lohnabrechnung 发回来，逐人登记 Brutto / Netto / 工时，并挂上那份文件。系统拿它跟封账时的数比：差超过容差就标红。这是整页唯一真正值钱的动作 —— 对不上要么是我们的工时错了，要么是他算错了，两种都得当月发现。",
           de: "Die Abrechnungen werden je Person mit Brutto, Netto, Stunden und Datei erfasst und gegen den Abschluss geprüft. Abweichungen über der Toleranz werden markiert — sie sind noch im selben Monat zu klären." } },
    { h: { zh: "发薪", de: "Auszahlung" },
      p: { zh: "净额只有税务师算得出来，所以工资单登记完了才付得了。按钮生成的是一份真的 SEPA pain.001 XML 文件，下载到电脑上，再到网银的「批量转账 / Sammelüberweisung」里上传它 —— 系统不连银行，钱是你在网银里按的。打完款逐人标记，再把工资单发给本人。",
           de: "Der Nettobetrag stammt aus der Abrechnung, daher ist eine Zahlung erst nach deren Erfassung möglich. Erzeugt wird eine echte SEPA-pain.001-Datei zum Hochladen im Online-Banking (Sammelüberweisung) — das System ist nicht mit der Bank verbunden." } }
  ],
  notes: [
    { zh: "封账之后底层又变了（有人补了一条考勤），系统不会偷偷跟着改，而是在页面顶上单列一条，通过提交修改记录更正，保留原始封账数据。",
      de: "Ändert sich nach dem Abschluss etwas, wird der fixierte Wert nicht stillschweigend angepasst — die Änderung erscheint oben als Hinweis zur Entscheidung." },
    { zh: "两条做不到的事：① 没有后端，系统发不出邮件，也没法真的把工资单发给员工 —— 导出和「标记已发」是你线下动作的记录。② 工资单上的 Brutto / Netto / 工时是手工登记的；选文件只会记下文件名，不解析内容。IBAN 只做格式和校验位检查，不查这个账户是不是真存在。",
      de: "Zwei Grenzen: 1. Ohne Backend versendet das System keine E-Mails und keine Abrechnungen — Export und Markierung dokumentieren nur Ihr eigenes Handeln. 2. Brutto/Netto/Stunden werden manuell erfasst; die Dateiauswahl merkt sich nur den Dateinamen. Die IBAN wird auf Format und Prüfziffer geprüft, nicht auf Existenz."
    }
  ]
};

/* ==============================================================================
   工时与工资：一条链，两段（2026-09-03 Mingrong 定）
   --------------------------------------------------------------------------
   工时结算原来挂在排班下面（「月度结算」），可它算完的数唯一的去处就是封账 →
   税务师 → 工资单 → 打款。把它跟工资放一起，这一页从上到下就是这个月钱的全过程：
   这个月干了多少 → 封账 → 发出去 → 对回来的数 → 真的打款。
   排班那边只留月历（看每天排了谁），不再重复摆一遍工时。
   ============================================================================== */
/* 2026-09-03 再调一次：工时结算搬进了「考勤与工时」的月视图 —— 它算的就是这个月的
   考勤加起来该付多少小时，处理一条迟到那个数当场就变，不该跟考勤隔一个模块。
   这一块因此变成纯粹的钱：封账 → 发给税务师 → 工资单对一遍 → SEPA 打款。
   只剩一段，所以也不再有分段标签 —— 一个标签的标签栏是装饰，不是导航。 */
function payShell(active, inner) {
  const store = payStore();
  return `
    <div class="page-head">
      <div><h1>${empT("工资与发薪", "Lohn und Auszahlung")}</h1>
      <p>${empT("月度工时确认 → 次月 2 日前封账 → 提交税务师 → 工资单核对与发薪。封账后通过提交修改更正。",
                "Abschluss → Steuerberater → Abrechnungen prüfen → SEPA-Zahlung. Hier wird nicht neu gerechnet.")}</p></div>
      <div class="button-row">
        <a class="ghost-btn accent-back-btn" href="#employee">${empT("返回员工助手", "Zurück: Mitarbeiter")}</a>
        ${schGuide(PAY_GUIDE)}
      </div>
    </div>
    ${empScope() ? "" : `<p class="sch-scope-hint">${empT(`按门店算。现在看的是 ${store}，换一家请用顶栏的门店选择器。`,
        `Filialbezogen. Angezeigt wird ${store} — Filiale oben in der Kopfzeile wechseln.`)}</p>`}
    ${inner}`;
}

function employeePayrollPage() {
  if (typeof hrCan === "function" && !hrCan("finance")) {
    return `<div class="page-head"><div><h1>${empT("工资与发薪", "Lohn und Auszahlung")}</h1></div></div>
      <section class="card"><p class="emp-disabled-reason">${empEsc(hrDenyReason("finance"))}</p>
      <p class="small">${empT("封账、交给税务师、生成付款文件也需要这个权限（答复 R6-29）。老板可以在「店长权限」里单独授予。", "Abschluss, Übergabe an die Steuerberatung und Zahlungsdatei brauchen dieselbe Berechtigung (R6-29).")}</p></section>`;
  }
  const store = payStore();
  const month = payMonth();
  const run = payGet(store, month);
  const drift = payDrift(store, month);
  const staff = Object.keys(run.snap);
  const gross = staff.reduce((s, id) => s + run.snap[id].gross, 0);

  return payShell("pay", `
    <section class="sch-weekbar">
      <div class="sch-weeknav">
        <a class="ghost-btn" href="${payHref({ m: payMonthAdd(month, -1), slip: null })}">←</a>
        <div class="sch-weekname"><strong>${schMonthName(month)}</strong>
          <span>${empPill(PAY_STATES[run.state].tone, empText(PAY_STATES[run.state].name))}
            ${staff.length ? empT(`${staff.length} 人 · 税前 €${gross.toFixed(2)}`, `${staff.length} Personen · brutto €${gross.toFixed(2)}`) : ""}</span></div>
        <a class="ghost-btn" href="${payHref({ m: payMonthAdd(month, 1), slip: null })}">→</a>
        ${month === payPrevMonth() ? "" : `<a class="ghost-btn" href="${payHref({ m: payPrevMonth(), slip: null })}">${empT("上个月", "Vormonat")}</a>`}
      </div>
      <label class="pay-month-picker">选择月份 <input type="month" class="pay-select-month" value="${month}"></label>
      ${empScope() ? "" : `<span class="att-scope">${empT(`看的是 ${store}，换一家用顶栏的门店选择器`, `Angezeigt: ${store}`)}</span>`}
    </section>

    ${payWorkConfirmPanel(store, month, run)}
    ${payPayPanel(store, month, run)}
    ${payReached(run, "closed") && state().params.get("corr") ? payCorrectionPanel(store, month, run) : ""}


    <!-- 这儿先后删过两样东西：一条五格摘要（封账人数 / 工资单已回 / 对不上 / 已打款 /
         Netto 合计），和一条四步流程条。都是同一个毛病 —— 下面每张卡的标题就是
         「1 · 已封账」「3 · 收工资单」，走到哪一步、各自多少钱，卡片自己都写着。
         流程条里唯一别处没有的是「这四步分别要干什么」，那条搬进了右上角的使用说明。 -->
    ${run.monthlyExamplesV2 ? "" : payDriftPanel(store, month, drift)}
    
    ${run.state === "closed" ? paySendPanel(store, month, run) : ""}



    ${run.log && run.log.length ? `<details class="card pay-log"><summary>${
      empT(`这个月的经过（${run.log.length} 条）`, `Verlauf (${run.log.length})`)}</summary>
      <ul>${run.log.map(l => `<li><span>${empStamp(l.at)}</span> ${empEsc(l.by || "")} · ${empText(l.what)}</li>`).join("")}</ul>
    </details>` : ""}
    <dialog id="pay-edit-dialog" class="pay-travel-dialog" aria-label="编辑本月工时"></dialog>
    <dialog id="pay-travel-dialog" class="pay-travel-dialog" aria-label="差旅费明细"></dialog>
    <dialog id="pay-pdf-dialog" class="pay-pdf-dialog" aria-label="工资单 PDF 预览"></dialog>`);
}

/* 月度工时确认：把班表、已处理考勤和合同工时放在一张表里。确认记录、补贴和更正都
   留在工资月份记录中；AZK 仍调用工时模块的公共写入函数，保证其他页面立即读到。 */
function payCanNudgeEmployee(store, month, empId) {
  if (typeof schWeekOf !== "function" || typeof schRosterExists !== "function") return false;
  const today = empToday(), currentMonth = today.slice(0, 7);
  if (month > currentMonth) return false;
  const count = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const weeks = new Set(Array.from({ length: count }, (_, i) => schWeekOf(`${month}-${String(i + 1).padStart(2, "0")}`)));
  const shifts = [];
  for (const week of weeks) {
    const exists = schRosterExists(store, week);
    const roster = exists ? schRoster(store, week) : null;
    // 本月未来班表尚未公布时，无法确定最后一个班次。
    if (month === currentMonth && (!roster || roster.state !== "published") && schWeekStart(week) <= `${month}-${String(count).padStart(2, "0")}` && empShiftDate(schWeekStart(week), 6) >= today) return false;
    if (roster?.state === "published") shifts.push(...(roster.shifts || []).filter(s => s.empId === empId && s.date?.startsWith(month) && s.start && s.end));
  }
  if (!shifts.length) return false;
  return shifts.every(shift => {
    let endDate = shift.date;
    if (shift.end <= shift.start) endDate = empShiftDate(endDate, 1);
    if (endDate !== today) return endDate < today;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    return shift.end <= time;
  });
}

function payWorkConfirmPanel(store, month, run) {
  const saved = run.confirmations || (run.confirmations = {});
  const extras = run.extras || (run.extras = {});
  const source = run.snap && Object.keys(run.snap).length
    ? Object.keys(run.snap).map(id => ({ id, snap: run.snap[id], e: run.snap[id].contract ? { ...empById(id), contract: run.snap[id].contract } : empById(id) }))
    : (typeof hrsStaff === "function" ? hrsStaff(store, month).map(e => ({ id: e.id, e })) : []);
  const currentMonth = month === empToday().slice(0, 7);
  const rows = source.map(x => {
    const draft=run.state === "open" ? run.openDrafts?.[x.id] : null;
    const e = draft?.contract ? {...x.e,contract:draft.contract} : x.e || {};
    const snap = x.snap;
    const liveRow = !snap && typeof hrsRow === "function" ? hrsRow(store,e,month) : {};
    const h = snap ? { payable: snap.payable, actual: snap.actual == null ? Number(snap.payable || 0) - Number(snap.delta || 0) : snap.actual, gross: snap.gross, rate: snap.rate, hourly: snap.payType === "hourly",
      balance: typeof hrsBalance === "function" ? hrsBalance(store, x.id, month) : 0,
      planned: snap.planned, att: snap.att, lv: snap.lv, lvPaid: snap.lvPaid, ot: snap.ot, delta: snap.delta }
      : { ...liveRow, gross:liveRow.pay || 0, actual:typeof hrsWorked === "function" ? hrsWorked(store,e.id,month) : liveRow.payable };
    if(draft){ h.payable=Number(draft.hours)+(Number(liveRow.delta)||0); h.actual=h.payable; h.hourly=e.contract.payType!=="pauschal"; h.rate=Number(e.contract.rate)||0; h.gross=(h.hourly?h.payable*h.rate:h.rate)+Number(draft.bonus||0); }
    const c = e.contract || {};
    const fullTime = c.type === "vollzeit";
    const low = fullTime ? 40 * 4.33 : Number(c.hoursMin || 0);
    const high = fullTime ? low : Number(c.hoursMax || low);
    const actual = Number(run.corrections?.[x.id]?.hours ?? h.payable ?? h.actual) || 0;
    h.monthHours = actual;
    const diff = Math.round((actual < low ? actual - low : actual > high ? actual - high : 0) * 100) / 100;
    const leaveDays = type => typeof lvOf === "function" ? lvOf(store, x.id, "approved")
      .filter(v => v.type === type).reduce((n, v) => n + lvDaysIn(v, month), 0) : 0;
    return { ...x, e, h, low, high, diff, extras: { ...(draft || {}), ...(extras[x.id] || {}), ...(run.corrections?.[x.id]?.bonus != null ? {bonus: run.corrections[x.id].bonus} : {}), ...(run.corrections?.[x.id]?.travel != null ? {travel: run.corrections[x.id].travel} : {}) }, vacation: run.corrections?.[x.id]?.urlaubDays ?? draft?.urlaubDays ?? snap?.urlaubDays ?? leaveDays("urlaub"), sick: run.corrections?.[x.id]?.krankDays ?? draft?.krankDays ?? snap?.krankDays ?? leaveDays("krank") };
  });
  const showPdf=Object.values(run.slips||{}).some(s=>s.file);
  const contactLink = id => empStaffHref(id);
  return `<section class="card pay-work-confirm">
    <div class="section-title"><div><h2>${empT("本月员工工时确认", "Monatliche Stundenbestätigung")}</h2>
      <p>${run.deadline ? `本月已于 ${empEsc(run.deadline)} 前完成封账；原始数据保留，后续请提交修改。 ` : ""}${empT("核对实做工时与合同月工时，并记录奖金、休假、病假和差旅。点员工姓名可查看邮箱、电话等档案信息。超出合同范围的差额可计入 Arbeitszeitkonto。",
        "Ist-Stunden mit den vertraglichen Monatsstunden abgleichen; Bonus, Urlaub, Krankheit und Reisekosten erfassen.")}</p></div>
      ${empPill("blue", empT(`${rows.filter(r => saved[r.id]).length}/${rows.length} 人已确认`, `${rows.filter(r => saved[r.id]).length}/${rows.length} bestätigt`))}
    </div>
    <div class="table-scroll"><table class="table employee-table pay-table pay-confirm-table"><thead><tr>
      <th>${empT("员工 / 确认", "Mitarbeiter / Bestätigung")}</th><th>${empT("本月工时 / 合同工时", "Monatsstunden / Vertrag")}</th>
      <th>${empT("差额", "Differenz")}</th><th>Arbeitszeitkonto</th><th>${empT("Brutto / 时薪", "Brutto / Stundenlohn")}</th>
      <th>${empT("Bonus", "Bonus")}</th><th>${empT("差旅费", "Reisekosten")}</th>
      ${showPdf ? "<th>工资单 PDF</th>" : ""}${run.state!=="open"?`<th>${empT("操作", "Aktion")}</th>`:""}</tr></thead><tbody>
      ${rows.map(r => {
        const weekly = r.e.contract?.type === "vollzeit" ? "40" : r.high
          ? `${(r.low / 4.33).toFixed(1)}–${(r.high / 4.33).toFixed(1)}` : "—";
        const contact = r.e.contact || {};
        const balance = Number(r.h.balance || 0);
        const balanceText = balance ? `${balance > 0 ? "+" : "−"}${schH(Math.abs(balance))}` : schH(0);
        const clockRows = typeof attRangePairs === "function" ? attRangePairs(store, `${month}-01`, `${month}-31`, r.id) : [];
        const clockText = clockRows.map(p => {
          const eff = typeof attEffective === "function" ? attEffective(p.rec || {}, p.shift) : null;
          return eff ? `${p.date}: ${eff.start}–${eff.end}` : "";
        }).filter(Boolean).join("\n") || empT("无完整打卡时间", "Keine vollständigen Zeitstempel");
        const eligible = payCanNudgeEmployee(store, month, r.id);
        const weeklyEmail = empT(`您好 ${r.e.name || ""}，\n\n请确认 ${month} 的工作时间。\n合同每周参考工时：${weekly} 小时；本月实际计薪工时：${Number(r.h.monthHours || 0).toFixed(2)} 小时。\n打卡记录：\n${clockText}\n\n规则：以已批准的考勤调整、休假和加班记录为准；休息时间按排班规则扣除。如有差异，请回复此邮件。`,
          `Hallo ${r.e.name || ""}, bitte bestätige deine Arbeitszeiten für ${month}.\nVertragliche Wochenstunden: ${weekly}; erfasste Monatsstunden: ${Number(r.h.monthHours || 0).toFixed(2)}.\nZeitstempel:\n${clockText}\n\nEs gelten die freigegebenen Zeiterfassungen, Abwesenheiten und Überstunden; Pausen werden nach Dienstplanregel abgezogen.`);
        const mail = `mailto:${encodeURIComponent(contact.email || "")}?subject=${encodeURIComponent(empT(`请确认 ${month} 工时`, `Bitte Arbeitszeiten ${month} bestätigen`))}&body=${encodeURIComponent(weeklyEmail)}`;
        const diffCell = !r.diff ? empPill("green", empT("合同范围内", "Im Vertragsrahmen"))
          : `<span class="pay-off">${r.diff > 0 ? "+" : "−"}${schH(Math.abs(r.diff))} ${r.diff > 0 ? empT("多", "mehr") : empT("少", "weniger")}</span>`;
        const bonus = Number(r.extras.bonus || 0), travel = Number(r.extras.travel || 0);
        const currentGross = run.corrections?.[r.id]?.gross ?? r.h.gross ?? 0;
        const advice = payAccountAdvice({ diff: r.diff, balance, hours: r.h.monthHours, high: r.high,
          gross: currentGross, hourly: r.h.hourly, rate: r.h.rate, type: r.e.contract?.type });
        const replyData = run.employeeReplies?.[r.id];
        const replyItems = (Array.isArray(replyData) ? replyData : replyData?.text ? [replyData] : []).filter(x => x?.text);
        const demoReplies = replyItems.length ? [] : r.id === rows[0]?.id ? ["工时已核对，谢谢。"] : r.id === rows[1]?.id ? ["请问工资单什么时候可以查看？", "收到，谢谢！"] : [];
        const replyCount = replyItems.length || demoReplies.length;
        const slip = run.slips[r.id];
        const mismatch = slip && (Math.abs(slip.gross - currentGross) > payTolerance() || Math.abs(slip.hours - r.h.monthHours) > .25);
        return `<tr>
          <td><div class="pay-employee-name"><details class="pay-contact"><summary>${empEsc(r.e.name || r.snap?.name || r.id)}</summary>
            <div class="pay-contact-drawer"><div class="pay-contact-head"><strong>${empEsc(r.e.name || r.id)}</strong><button type="button" class="pay-contact-close" aria-label="关闭联系方式">×</button></div>
              <div><small>电话</small>${contact.phone ? `<a href="tel:${empEsc(contact.phone)}">${empEsc(contact.phone)}</a>` : "未填写"}</div>
              <div><small>邮箱</small>${contact.email ? `<a href="mailto:${empEsc(contact.email)}">${empEsc(contact.email)}</a>` : "未填写"}</div>
              <div class="pay-contact-actions">${contact.email ? `<a class="primary-btn" href="${mail}">快捷邮件通知</a>` : ""}<a class="ghost-btn" href="${contactLink(r.id)}">员工档案</a></div>
            </div></details>
            <details class="pay-message"><summary aria-label="${empEsc(r.e.name || r.id)} 员工沟通${replyCount ? `，${replyCount} 条消息` : '，暂无消息'}"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path></svg>${replyCount ? `<span class="pay-message-count">${replyCount}</span>` : ""}</summary><div class="pay-message-popover"><strong>员工沟通</strong>${replyItems.length ? replyItems.map(reply => `<p>${empEsc(reply.text)}</p>`).join("") : demoReplies.length ? `${demoReplies.map(text => `<p>${empEsc(text)}</p>`).join("")}<small>演示消息</small>` : `<p>暂无员工消息</p>`}${contact.email ? `<a href="${mail}" aria-label="回复 ${empEsc(r.e.name)}">邮件联系 ↗</a>` : ""}</div></details>
            <div class="pay-confirm-state">${saved[r.id] ? empPill("green", "员工已确认") : `${empPill("orange", "未确认")}${eligible && contact.email ? `<a class="pay-nudge" href="${mail}" aria-label="催 ${empEsc(r.e.name)} 确认工时">催</a>` : ""}`} </div></div><small>${empText(empContractType(r.e.contract?.type).name)}</small></td>
          <td><button type="button" class="pay-hours-open" data-id="${r.id}" data-month="${month}">${schH(r.h.monthHours)}</button><small>含 Urlaub ${Number(r.vacation).toFixed(1)} 天 · 病假 ${Number(r.sick).toFixed(1)} 天</small><small>${r.e.contract?.type === "vollzeit"
            ? `${empT("40h/周固定", "40h/Woche fest")} · ${schH(r.low)} ${empT("本月应计", "Monatssoll")}`
            : `${schH(r.low)}–${schH(r.high)} ${empT("月合同范围", "Vertragsbereich/Monat")} · ${weekly}h/${empT("周", "Woche")}`}</small>${run.corrections?.[r.id] ? `<small>原封账 ${schH(r.snap?.payable || 0)}</small>` : ""}</td>
          <td>${diffCell}</td>
          <td class="pay-account-cell"><div class="pay-account-summary"><strong>${balanceText}</strong>${run.state === "open" && advice ? `<span class="pay-account-advice">${empEsc(advice.text)}</span>` : ""}</div>
            ${run.state === "open" ? `<div class="pay-account-adjust"><input type="number" class="pay-account-hours" data-id="${r.id}" min="0.01" step="0.01" value="${advice?.hours || Math.abs(r.diff) || 1}" aria-label="${empEsc(r.e.name || r.id)} 工时账户调整小时">
              <button type="button" class="${advice?.type === "in" ? "primary-btn" : "ghost-btn"} pay-account-transfer" data-id="${r.id}" data-month="${month}" data-type="in" title="存入账户会减少本月计薪工时">存入</button>
              <button type="button" class="${advice?.type === "out" ? "primary-btn" : "ghost-btn"} pay-account-transfer" data-id="${r.id}" data-month="${month}" data-type="out" title="从账户取出会增加本月计薪工时">取出</button></div>` : ""}
          </td>
          <td><strong>€${Number(currentGross).toFixed(2)}</strong><small>${r.h.hourly ? empT(`€${Number(r.h.rate || 0).toFixed(2)} / 小时`, `€${Number(r.h.rate || 0).toFixed(2)} / Std.`) : empT("固定工资", "Festgehalt")}</small></td>
          <td>€${bonus.toFixed(2)}</td>

          <td>${(() => {
            const claim = payTravelClaim(run, r.id);
            const status = !claim ? "" : claim.state === "submitted" ? `员工申报 €${claim.claimed.toFixed(2)} · 待老板审核`
              : claim.state === "approved" ? `员工申报 €${claim.claimed.toFixed(2)} · 老板已批准 €${Number(claim.approved).toFixed(2)}` : `员工申报 €${claim.claimed.toFixed(2)} · 已退回：${empEsc(claim.note)}`;
            const review = claim && claim.state === "submitted" && run.state === "open"
              ? `<span class="pay-travel-review"><button type="button" class="ghost-btn pay-travel-open" data-id="${r.id}" data-month="${month}">${empT("退回…", "Zurück…")}</button>
                  <button type="button" class="primary-btn pay-travel-approve" data-id="${r.id}" data-month="${month}"${hrIsOwner() ? "" : ' disabled title="差旅只有老板能审核"'}>${empT("批准", "Genehmigen")}</button></span>` : "";
            return `<button type="button" class="pay-travel-open" data-id="${r.id}" data-month="${month}" aria-label="${empEsc(r.e.name || r.id)} 差旅费明细"><strong>€${travel.toFixed(2)}</strong><small>${status || "未申报 · 查看明细 ›"}</small></button>${review}`;
          })()}${run.state === "open" ? `<input type="hidden" class="pay-extra" data-id="${r.id}" data-kind="travel" value="${travel}">` : ""}</td>
          ${showPdf ? `<td><a href="#" class="pay-pdf-open" data-id="${r.id}" data-month="${month}" title="${empEsc(slip?.file || '待上传工资单')}">${slip?.file ? 'PDF' : '待上传 PDF'}</a>
            ${slip?.file ? `<small><button type="button" class="pay-pdf-open pay-pdf-status ${mismatch ? 'is-mismatch' : 'is-match'}" data-id="${r.id}" data-month="${month}">${mismatch ? '不匹配' : '匹配'}</button></small>` : ''}${run.sentToEmpDemo?.[r.id] ? `<small class="pay-mail-demo-tag">模拟已发送</small>` : ''}</td>` : ''}
          ${run.state!=="open"?`<td><a class="ghost-btn" href="${payHref({corr:r.id})}">提交修改</a></td>`:""}</tr>`;
      }).join("")}
    </tbody></table></div>
    ${run.state === "open" ? `<div class="pay-acts"><button type="button" class="ghost-btn pay-refresh">刷新核对</button><button type="button" class="primary-btn pay-handover" data-month="${month}">确认无误，移交税务师</button></div><p class="pay-hint">员工在本月最后一个工作日结束后收到工时邮件，回复确认后更新状态。当前为离线演示，不会自动收发邮件；移交不代替员工确认。</p>` : ""}
    <p class="pay-hint">${empT("邮件按钮会打开你自己的邮件客户端并预填工时、打卡时间和计算规则；最终发送由你在邮件客户端确认。", "Die Erinnerung öffnet einen vorbereiteten E-Mail-Entwurf in deinem Mailprogramm.")}</p>
  </section>`;
}

function payCorrectionPanel(store, month, run) {
  if (!["closed", "sent", "back", "paid"].includes(run.state)) return "";
  const ids = Object.keys(run.snap || {}).sort((a, b) => run.snap[a].name.localeCompare(run.snap[b].name));
  if (!ids.length) return "";
  const id = ids.includes(state().params.get("corr")) ? state().params.get("corr") : ids[0];
  const snap = run.snap[id], saved = (run.corrections || {})[id];
  const additions = run.extras?.[id] || {};
  const value = (key, fallback) => saved?.[key] ?? fallback ?? 0;
  const employee = empById(id), contract = snap.contract || employee?.contract || {};
  const currentHours = Number(saved?.hours ?? snap.payable), currentGross = Number(saved?.gross ?? snap.gross);
  const low = contract.type === "vollzeit" ? 173.2 : Number(contract.hoursMin || 0), high = contract.type === "vollzeit" ? low : Number(contract.hoursMax || low);
  const diff = currentHours < low ? currentHours-low : currentHours > high ? currentHours-high : 0;
  const balance = hrsBalance(store,id,month), advice = payAccountAdvice({ diff, balance, hours:currentHours,high,gross:currentGross,hourly:snap.payType === "hourly",rate:snap.rate,type:contract.type });
  return `<section class="card pay-correction"><div class="section-title"><div><h2>${empT("提交给税务师的修改", "Korrektur an Steuerberatung")}</h2>
    <p>${empT("已发工资的月份只向税务师提交修改意见，由税务师决定怎么处理（答复 R6-12）。选择员工后先显示原申报数据，再填写修改值；提交只记一条修改意见，税务师决定前不改工时账户、不改对账预期；老板录入“税务师已采纳”后才生效。", "Für ausgezahlte Monate nur ein Änderungsvorschlag an die Steuerberatung; sie entscheidet (R6-12). Originalmeldung bleibt erhalten.")}</p></div></div>
    <label class="pay-correction-select">${empT("员工", "Mitarbeiter")}<select class="pay-correction-employee">${ids.map(i => `<option value="${i}" ${i === id ? "selected" : ""}>${empEsc(run.snap[i].name)}</option>`).join("")}</select></label>
    <div class="pay-correction-account" data-balance="${balance}" data-rate="${snap.rate}" data-hourly="${snap.payType === "hourly" ? "1" : ""}">
      <strong>Arbeitszeitkonto · 当前余额 ${balance < 0 ? "−" : ""}${schH(Math.abs(balance))}</strong><small>${advice ? empEsc(advice.text) : "存入或取出由你决定"} · 紫色仅为建议；点击下方提交修改后才保存。</small>
      <input type="hidden" class="pay-corr-account-type" value="">
      <div class="pay-account-adjust"><input type="number" class="pay-corr-account-hours" min="0.01" step="0.01" value="${advice?.hours || 1}" aria-label="修改中的账户调整小时">
      <button type="button" class="${advice?.type === "in" ? "primary-btn" : "ghost-btn"} pay-corr-direction" data-type="in" aria-pressed="false">存入</button>
      <button type="button" class="${advice?.type === "out" ? "primary-btn" : "ghost-btn"} pay-corr-direction" data-type="out" aria-pressed="false">取出</button>
      <button type="button" class="ghost-btn pay-corr-direction" data-type="" aria-pressed="true">不调整账户</button></div>
      <p class="pay-corr-account-preview" aria-live="polite">尚未选择账户调整。</p>
    </div>
    <div class="pay-correction-lines"><div><strong>${empT("原申报", "Ursprünglich")}</strong><span>${schH(snap.payable)} · Brutto €${Number(snap.gross).toFixed(2)} · Bonus €${Number(additions.bonus || 0).toFixed(2)} · Urlaub ${snap.urlaubDays || 0} 天 · Krank ${snap.krankDays || 0} 天 · Reisekosten €${Number(additions.travel || 0).toFixed(2)}</span></div>
      <div><strong>${empT("修改后", "Korrektur")}</strong><label>${empT("工时", "Stunden")}<input type="number" step="0.25" class="pay-corr-hours" value="${saved ? saved.hours : snap.payable}"></label>
      <label>Brutto €<input type="number" step="0.01" class="pay-corr-gross" value="${saved ? saved.gross : snap.gross}"></label>
      <label>Bonus €<input type="number" min="0" step="0.01" class="pay-corr-bonus" value="${value("bonus", additions.bonus)}"></label>
      <label>Urlaub 天<input type="number" min="0" step="0.5" class="pay-corr-urlaub" value="${value("urlaubDays", snap.urlaubDays)}"></label>
      <label>Krank 天<input type="number" min="0" step="0.5" class="pay-corr-krank" value="${value("krankDays", snap.krankDays)}"></label>
      <label>Reisekosten €<input type="number" min="0" step="0.01" class="pay-corr-travel" value="${value("travel", additions.travel)}"></label>
      <button class="primary-btn pay-corr-save" data-id="${id}" data-month="${month}">${empT("提交修改", "Korrektur einreichen")}</button></div></div>
      ${(() => {
        const props = (run.correctionProposals || []).filter(x => x.empId === id);
        if (!props.length) return "";
        const label = { proposed: "等税务师决定", adopted: "税务师已采纳，已生效", declined: "税务师未采纳，保持原数" };
        return `<div class="pay-proposals"><strong>${empT("修改意见记录", "Änderungsvorschläge")}</strong>${props.map(x => `<div class="pay-proposal is-${x.status}">
          <span>${empStamp(x.at)} · ${schH(x.values.hours)} · Brutto €${Number(x.values.gross).toFixed(2)}${x.account ? ` · ${x.account.type === "in" ? "存入" : "取出"} ${schH(x.account.hours)}` : ""} · ${label[x.status]}</span>
          ${x.status === "proposed" ? `<button type="button" class="ghost-btn pay-prop-no" data-month="${month}" data-id="${x.id}"${hrIsOwner() ? "" : ' disabled title="税务师的决定由老板录入"'}>${empT("税务师未采纳", "Nicht übernommen")}</button>
          <button type="button" class="primary-btn pay-prop-ok" data-month="${month}" data-id="${x.id}"${hrIsOwner() ? "" : ' disabled title="税务师的决定由老板录入"'}>${empT("录入：税务师已采纳（演示）", "Übernommen (Demo)")}</button>` : ""}</div>`).join("")}</div>`;
      })()}
      ${saved ? `<p class="pay-hint">${empT(`已保存修改：${schH(saved.hours)} · Brutto €${Number(saved.gross).toFixed(2)}（${empStamp(saved.at)}）`, `Gespeichert: ${schH(saved.hours)} · Brutto €${Number(saved.gross).toFixed(2)}`)}</p>` : ""}</section>`;
}

/* -------------------------------------------------------- 1 封账 -------- */
function payClosePanel(store, month, run) {
  if (run.state !== "open") {
    return `<section class="card pay-done">
      <div class="pay-done-head"><strong>${empT("1 · 已封账", "1 · Abgeschlossen")}</strong>
        <span>${empStamp(run.closedAt)} · ${empEsc(run.closedBy || "")} · ${empT(
          `${Object.keys(run.snap).length} 人，税前合计 €${Object.keys(run.snap).reduce((s, k) => s + run.snap[k].gross, 0).toFixed(2)}`,
          `${Object.keys(run.snap).length} Personen, brutto €${Object.keys(run.snap).reduce((s, k) => s + run.snap[k].gross, 0).toFixed(2)}`)}</span></div>
      <p>${empT("封账那一刻的数字已经存下来了。之后改考勤、批休假都不会动它 —— 已经报出去的数不能在背后被改掉。",
                "Die Werte des Abschlusses sind fixiert. Spätere Änderungen an Zeiterfassung oder Abwesenheiten verändern sie nicht.")}</p>
      <a class="ghost-btn" href="${payHref({corr: Object.keys(run.snap)[0] || ""})}">${empT("提交修改", "Korrektur einreichen")}</a>
    </section>`;
  }
  const bl = payBlockers(store, month);
  return `<section class="card pay-close">
    <div class="section-title">
      <div><h2>${empT("移交前检查", "Abschlussprüfung")}</h2>
      <p>${empT("同步检查班表、考勤、休假和加班。移交前可继续编辑；移交后保留原始快照，通过提交修改更正。",
                "Abschließen heisst festschreiben. Vorher wird geprüft, ob alle Vorstufen sauber sind — ein nachträglich geänderter Wert bedeutet eine kostenpflichtige Korrektur.")}</p></div>
      <button type="button" class="ghost-btn pay-refresh">刷新检查</button>${bl.length ? empPill("red", empT(`${bl.length} 件没收干净`, `${bl.length} offen`)) : empPill("green", empT("都收干净了", "Alles bereit"))}
    </div>
    ${bl.length ? `<ul class="pay-blockers">${bl.map(x => `<li>
      <span>${empText({ zh: x.zh, de: x.de })}</span>
      <a class="ghost-btn" href="${x.href}">${empT("去处理 →", "Bearbeiten →")}</a></li>`).join("")}</ul>
      <p class="pay-hint">${empT("待办会随数据重新核对；你可返回处理，也可在移交时查看并确认继续。",
                                 "Erst wenn alle Punkte erledigt sind, kann abgeschlossen werden.")}</p>`
    : `<p class="pay-hint">${empT(
        `班表排满了整月，考勤都处理完了，休假都批完了，加班都审完了。可以封账。`,
        `Plan vollständig, Zeiterfassung bearbeitet, Abwesenheiten und Überstunden freigegeben. Der Monat kann abgeschlossen werden.`)}</p>
      <div class="pay-acts"><button class="primary-btn pay-close-btn" data-month="${month}">${
        empT(`封账 ${schMonthName(month)}`, `${schMonthName(month)} abschließen`)}</button></div>`}
  </section>`;
}

/* 封账之后底层又变了。不悄悄跟着变，也不装作没发生。 */
function payDriftPanel(store, month, drift) {
  if (!drift.length) return "";
  return `<section class="card pay-drift">
    <div class="section-title">
      <div><h2>${empT("封账之后底层又变了", "Änderungen nach dem Abschluss")}</h2>
      <p>${empT("封账时存下的数没有跟着变（这是对的），但你要决定怎么办：要么重开封账重新报，要么留到下个月更正。",
                "Die fixierten Werte bleiben unverändert. Zu entscheiden: Abschluss zurücknehmen und neu melden — oder im Folgemonat korrigieren.")}</p></div>
      ${empPill("orange", String(drift.length))}
    </div>
    <ul class="pay-driftlist">${drift.map(x => `<li>
      <strong>${empEsc(x.name)}</strong><span>${empText({ zh: x.zh, de: x.de })}</span></li>`).join("")}</ul>
  </section>`;
}

/* -------------------------------------------------- 2 发给税务师 -------- */
function paySendPanel(store, month, run) {
  if (payReached(run, "sent")) {
    return `<section class="card pay-done">
      <div class="pay-done-head"><strong>${empT("2 · 已发给税务师", "2 · An den Steuerberater gesendet")}</strong>
        <span>${empStamp(run.sentAt)}${run.sentTo ? ` · ${empEsc(run.sentTo)}` : ""}</span></div>
      <div class="pay-acts">
        <button class="ghost-btn pay-csv" data-month="${month}">${empT("再下载一次 CSV", "CSV erneut laden")}</button>
      </div>
    </section>`;
  }
  return `<section class="card pay-send">
    <div class="section-title">
      <div><h2>${empT("2 · 发给税务师", "2 · An den Steuerberater")}</h2>
      <p>${empT("系统没有邮件后端，发不出去。给你的是能下载的 CSV 和能复制的正文 —— 用自己的邮箱发出去之后，回来在这儿标一下。",
                "Kein E-Mail-Backend: hier gibt es CSV und Textvorlage. Nach dem Versand aus dem eigenen Postfach bitte hier markieren.")}</p></div>
    </div>
    <div class="pay-acts">
      <button class="primary-btn pay-csv" data-month="${month}">${empT("下载 CSV", "CSV herunterladen")}</button>
      <button class="ghost-btn pay-copy" data-month="${month}">${empT("复制邮件正文", "Text kopieren")}</button>
    </div>
    <details class="pay-mail"><summary>${empT("看一眼正文", "Textvorlage ansehen")}</summary>
      <pre>${empEsc(payAdvisorMail(store, month))}</pre></details>
    <div class="pay-acts">
      <input class="pay-sent-to" placeholder="${empT("发给了谁（邮箱或名字，会记进经过）", "An wen gesendet (E-Mail oder Name)")}"
        value="${empEsc(run.sentTo || "")}">
      <button class="ghost-btn pay-sent" data-month="${month}">${empT("我已经发出去了", "Als versendet markieren")}</button>
    </div>
  </section>`;
}

/* ---------------------------------------------- 3 收工资单核对 ---------- */
function paySlipPanel(store, month, run) {
  const open = state().params.get("slip") || "";
  const ids = Object.keys(run.snap).sort((a, b) => run.snap[a].name.localeCompare(run.snap[b].name));
  return `<section class="card pay-slips">
    <div class="section-title">
      <div><h2>${empT("3 · 收工资单，跟封账的数对一遍", "3 · Abrechnungen prüfen")}</h2>
      <p>${empT(`税务师算完把 Lohnabrechnung 发回来，逐人登记 Brutto / Netto / 工时。系统拿它跟封账时的数比 —— 差超过 €${payTolerance()} 或者一刻钟就标出来。这是这一页唯一真正值钱的动作：对不上的地方，要么是我们的工时错了，要么是他算错了，两种都得当月发现。`,
                `Die Abrechnungen des Steuerberaters werden je Person erfasst und gegen den Abschluss geprüft — Abweichungen über €${payTolerance()} oder eine Viertelstunde werden markiert.`)}</p></div>
    </div>
    <div class="table-scroll"><table class="table employee-table pay-table">
      <thead><tr>
        <th>${empT("员工", "Mitarbeiter")}</th>
        <th>${empT("封账时（我们算的）", "Abschluss (eigene Rechnung)")}</th>
        <th>${empT("工资单（税务师算的）", "Abrechnung (Steuerberater)")}</th>
        <th>${empT("差额", "Abweichung")}</th>
        <th>${empT("应付净额 Netto", "Auszahlung (Netto)")}</th>
        <th title="${empT("税务师发回来的那份 Lohnabrechnung。没有后端，存的是文件名，不是文件本身。",
                          "Die erhaltene Lohnabrechnung. Ohne Backend wird nur der Dateiname gespeichert.")}">${
          empT("工资单文件", "Datei")}</th>
        <th></th>
      </tr></thead>
      <tbody>${ids.map(id => {
        const s = run.snap[id];
        const slip = run.slips[id];
        const d = payDiff(run, id);
        const on = open === id;
        return `<tr class="${d && d.off && !d.explained ? "att-bad" : ""} ${on ? "is-editing" : ""}">
          <td><strong>${empEsc(s.name)}</strong><small>${empEsc(s.type)}</small></td>
          <td>${schH(s.payable)} <small>€${s.gross.toFixed(2)}</small></td>
          <td>${slip ? `${schH(slip.hours)} <small>€${slip.gross.toFixed(2)}</small>` : `<span class="att-dim">${empT("还没回来", "Ausstehend")}</span>`}</td>
          <td>${!d ? `<span class="att-dim">—</span>`
            : d.off ? `<span class="pay-off">${d.dg >= 0 ? "+" : ""}€${d.dg.toFixed(2)}${
                Math.abs(d.dh) > 0.25 ? ` · ${d.dh >= 0 ? "+" : ""}${schH(d.dh)}` : ""}</span>${
                d.explained ? `<small data-user-text>${empEsc(slip.note)}</small>` : ""}`
            : empPill("green", empT("对得上", "Stimmt"))}</td>
          <td>${slip ? `<strong>€${slip.net.toFixed(2)}</strong>` : `<span class="att-dim">—</span>`}</td>
          <td>${payFileCell(slip, id)}</td>
          <td><a class="ghost-btn" href="${payHref({ slip: on ? null : id })}">${
            on ? empT("收起", "Schließen") : slip ? empT("改", "Ändern") : empT("登记", "Erfassen")}</a></td>
        </tr>${on ? `<tr class="att-editrow"><td colspan="7">${paySlipForm(store, month, run, id)}</td></tr>` : ""}`;
      }).join("")}</tbody>
    </table></div>
  </section>`;
}

/* 工资单那份文件。没有后端，存不下 PDF 本身 —— 存的是你登记时选的那个文件名。
   与其把这一列做成一个点了没反应的假下载按钮，不如老实显示文件名，
   并且在没挂文件的时候直接说「登记了，但没挂文件」——
   那是一个真实的漏洞：数登记进来了，凭证没留下，年底查账翻不出来。 */
function payFileCell(slip, id) {
  if (!slip) return `<span class="att-dim">—</span>`;
  if (!slip.file) return `<a class="pay-nofile" href="${payHref({ slip: id })}"
    title="${empT("数登记了，但没留下凭证文件。年底查账时这一笔翻不出原始工资单。",
                  "Werte erfasst, aber kein Beleg hinterlegt.")}">${empT("没挂文件 →", "Keine Datei →")}</a>`;
  return `<span class="pay-file" title="${empT(`登记时选的文件：${slip.file}（没有后端，系统只记住文件名，不保存文件本身）`,
    `Bei der Erfassung gewählte Datei: ${slip.file} (ohne Backend wird nur der Name gespeichert)`)}">
    <b aria-hidden="true">PDF</b><span class="pay-file-name">${empEsc(slip.file)}</span></span>`;
}

function paySlipForm(store, month, run, id) {
  const s = run.snap[id];
  const slip = run.slips[id] || {};
  const d = payDiff(run, id);
  return `<div class="att-fix pay-form">
    <div class="att-fix-head">
      <strong>${empEsc(s.name)} · ${schMonthName(month)}</strong>
      <span>${empT(`封账时：${schH(s.payable)} · 税前 €${s.gross.toFixed(2)}${
        s.payType === "hourly" ? ` · €${s.rate}/h` : ` · 固定月薪 €${s.rate}`}`,
        `Abschluss: ${schH(s.payable)} · brutto €${s.gross.toFixed(2)}`)}</span>
    </div>
    <div class="pay-form-grid">
      <label>${empT("Brutto（工资单上的）", "Brutto laut Abrechnung")}<input type="number" step="0.01" class="pay-in-gross" data-id="${id}" value="${slip.gross != null ? slip.gross : s.gross}"></label>
      <label>${empT("Netto（要打给他的）", "Netto (Auszahlung)")}<input type="number" step="0.01" class="pay-in-net" data-id="${id}" value="${slip.net != null ? slip.net : ""}"></label>
      <label>${empT("工资单上的工时", "Stunden laut Abrechnung")}<input type="number" step="0.25" class="pay-in-hours" data-id="${id}" value="${slip.hours != null ? slip.hours : s.payable}"></label>
      <label class="pay-form-file">${empT("工资单文件（只记文件名，不解析内容）", "Datei (nur Dateiname)")}
        <input type="file" class="pay-in-file" data-id="${id}" accept="application/pdf">
        ${slip.file ? `<small>${empEsc(slip.file)}</small>` : ""}</label>
    </div>
    ${d && d.off ? `<p class="pay-off-note">${empT(
      `跟封账时差 ${d.dg >= 0 ? "+" : ""}€${d.dg.toFixed(2)}${Math.abs(d.dh) > 0.25 ? `、${d.dh >= 0 ? "+" : ""}${schH(d.dh)}` : ""} —— 要么改上面的数，要么写清楚为什么差（例如：税务师按 13 周平均算了休假工资）。不写说明它会一直挂在待办里。`,
      `Abweichung ${d.dg >= 0 ? "+" : ""}€${d.dg.toFixed(2)} — bitte Werte korrigieren oder begründen.`)}</p>` : ""}
    <div class="att-fix-grid">
      <label class="att-fix-why">${empT("差额说明", "Begründung der Abweichung")}
        <input class="pay-in-note" data-id="${id}" value="${empEsc(slip.note || "")}"
          placeholder="${empT("例如：税务师把 Urlaubsentgelt 按前 13 周平均算，比我们的估算高 €18", "z. B. Urlaubsentgelt nach 13-Wochen-Schnitt")}"></label>
    </div>
    <div class="att-fix-actions">
      <button class="primary-btn pay-slip-save" data-id="${id}" data-month="${month}">${empT("登记", "Erfassen")}</button>
      ${run.slips[id] ? `<button class="ghost-btn danger-lite pay-slip-drop" data-id="${id}" data-month="${month}">${empT("撤掉这条登记", "Erfassung entfernen")}</button>` : ""}
    </div>
  </div>`;
}

/* -------------------------------------------------------- 4 发薪 -------- */
function paySepaName(store, month) {
  return `KaiSpan_Lohnzahlung_${String(store).replace(/\s+/g, "_")}_${month}.xml`;
}

/* 2026-09-03（Mingrong：「怎么生成 xml，没有下载按钮，不太明白这个逻辑」）——
   这就是原来的毛病：只要有一条拦路的（有人工资单还没回来），整块 pay-acts
   连同那个按钮一起不渲染，页面上剩下一张光秃秃的清单，谁也看不出这一页最后
   会产出一个文件。按钮从此永远在，不能按的时候是禁用状态，旁边写着还差什么。
   顺带把这个文件本身说清楚：叫什么、几笔、多少钱、从哪个账户出、哪天执行，
   下载前能先展开看一眼真正的 XML，下载后拿它干什么。 */
function paySepaBox(store, month, ready, sum, bl) {
  const c = empEmployer(store);
  const ok = !bl.length && ready.length > 0;
  const exec = empShiftDate(empToday(), 1);
  return `<div class="pay-sepa-box ${ok ? "" : "is-blocked"}">
    <div class="pay-sepa-head">
      <div>
        <strong>${empT("SEPA 批量转账文件（pain.001.001.03）", "SEPA-Sammelüberweisung (pain.001.001.03)")}</strong>
        <code>${empEsc(paySepaName(store, month))}</code>
      </div>
      <button class="primary-btn pay-sepa" data-month="${month}" ${ok ? "" : "disabled"}>${
        empT("生成并下载 XML", "XML erzeugen und herunterladen")}</button>
    </div>
    <dl class="pay-sepa-facts">
      <div><dt>${empT("笔数", "Zahlungen")}</dt><dd>${empT(`${ready.length} 笔`, `${ready.length}`)}</dd></div>
      <div><dt>${empT("合计", "Summe")}</dt><dd><strong>€${sum.toFixed(2)}</strong></dd></div>
      <div><dt>${empT("从哪个账户出", "Auftraggeberkonto")}</dt>
        <dd>${c.legalName ? empEsc(c.legalName) : `<span class="pay-iban is-bad">${empT("公司名称没填", "Firmenname fehlt")}</span>`}
          ${c.iban ? `<span class="pay-iban ${payIbanOk(c.iban) ? "" : "is-bad"}">${empEsc(c.iban)}</span>`
            : `<span class="pay-iban is-bad">${empT("IBAN 没填", "IBAN fehlt")}</span>`}</dd></div>
      <div><dt>${empT("执行日", "Ausführung")}</dt><dd>${empFormatDate(exec)}</dd></div>
    </dl>
    ${bl.length ? `<ul class="pay-blockers">${bl.map(x => `<li>
      <span>${empText({ zh: x.zh, de: x.de })}${x.who ? `：${x.who.join("、")}` : ""}</span>
      <a class="ghost-btn" href="${x.code === "name" || x.code === "iban"
        ? `#${slug("employee", "合规设置")}` : `#${slug("employee", "员工档案")}`}">${empT("去补 →", "Ergänzen →")}</a></li>`).join("")}</ul>`
      : !ready.length ? `<p class="pay-hint">${empT("这个月该打的都打完了，没有待生成的付款。",
                                                    "Alle Zahlungen dieses Monats sind erledigt.")}</p>` : ""}
    ${ok ? `<details class="pay-sepa-peek"><summary>${empT("下载之前先看一眼文件内容", "Datei vorab ansehen")}</summary>
      <pre>${empEsc(paySepaXml(store, month))}</pre></details>` : ""}
    <p class="pay-hint">${empT(
      "系统不连银行。下载下来的这个文件，到网银里选「批量转账 / Sammelüberweisung / SEPA-Datei 导入」上传，钱是你在网银里按出去的 —— 所以打完款要回来逐人标记，这一页才知道谁收到了。",
      "Das System ist nicht mit der Bank verbunden. Die Datei wird im Online-Banking unter „Sammelüberweisung / SEPA-Datei importieren“ hochgeladen; die Zahlung lösen Sie dort aus — danach hier je Person markieren.")}</p>
  </div>`;
}

function payPayPanel(store, month, run) {
  if (!Object.keys(run.slips || {}).length) return `<section class="card pay-pay pay-pay-waiting"><div class="section-title"><div><h2>发薪</h2><p>收到税务师工资单后，核对金额并生成 SEPA XML 文件。</p></div>${empPill("orange", "未完成")}</div><div class="pay-waiting-message"><strong>等待税务师上传工资单</strong><p>工资单尚未收到，收到后将在这里显示应付金额、打款状态和批量发送工资单操作。</p></div></section>`;
  const rows = payPayable(store, month);
  return `<section class="card pay-pay pay-pay-compact"><div class="section-title"><div><h2>发薪</h2><p>金额来自工资单记录的 Netto；选择待打款员工，生成本月 SEPA XML 文件。</p></div>
    <label class="pay-month-picker">月份 <input type="month" class="pay-select-month" value="${month}"></label></div>
    <div class="table-scroll"><table class="table employee-table pay-table"><thead><tr><th><input type="checkbox" class="pay-payment-all" aria-label="全选可打款员工"><label class="pay-mail-selection"><input type="checkbox" class="pay-mail-all" aria-label="全选可发送工资单的员工"></label></th><th>员工</th><th>工资单 Netto</th><th>收款账户 IBAN</th><th>打款状态</th></tr></thead>
    <tbody>${rows.map(r => {
      const enabled = !r.paid && !r.why && payIbanOk(r.iban);
      return `<tr><td><input type="checkbox" class="pay-payment-check" data-id="${r.id}" data-net="${r.net}" ${enabled ? "" : "disabled"} aria-label="选择打款 ${empEsc(r.name)}"><label class="pay-mail-selection"><input type="checkbox" class="pay-mail-check" data-id="${r.id}" ${r.slip?.file && empById(r.id)?.contact?.email ? "" : "disabled"} aria-label="发送工资单给 ${empEsc(r.name)}" title="${!r.slip?.file ? "缺少工资单 PDF" : !empById(r.id)?.contact?.email ? "未填写员工邮箱" : "选择该员工"}"></label></td>
        <td><strong>${empEsc(r.name)}</strong></td><td>${r.slip ? `€${r.net.toFixed(2)}` : "待工资单"}</td><td>${r.iban ? empEsc(r.iban) : "未填 IBAN"}</td>
        <td>${empPill(r.paid ? "green" : "orange", r.paid ? "已打款" : "未打款")}${!r.paid && !enabled ? `<small>${!r.slip ? "缺少工资单" : !payIbanOk(r.iban) ? "IBAN 待补正" : "无应付金额"}</small>` : ""}
        ${enabled ? `<button class="ghost-btn pay-paid" data-id="${r.id}" data-month="${month}" data-on="1">标记已打款</button>` : ""}<small>${run.sentToEmpDemo?.[r.id] ? "工资单：模拟已发送" : run.sentToEmp?.[r.id] ? "工资单：已发送" : "工资单：未发送"}</small></td></tr>`;
    }).join("")}</tbody></table></div>
    <div class="pay-acts pay-mail-bulk-footer"><span class="pay-mail-result" role="status">${run.lastDemoDispatch ? `模拟发送完成：${run.lastDemoDispatch.count} 份工资单（未实际发出邮件）` : ""}</span><span class="pay-payment-summary">已选 0 人 · €0.00</span><button class="primary-btn pay-sepa-selected" data-month="${month}" disabled>生成 SEPA XML 文件</button>
      <button type="button" class="ghost-btn pay-mail-start">批量选择发送工资单</button>
      <div class="pay-mail-actions" hidden><span class="pay-mail-count">已选 0 人</span><button type="button" class="ghost-btn pay-mail-cancel">取消</button><button type="button" class="primary-btn pay-mail-send" data-month="${month}" disabled>发送所选工资单</button></div>
    </div><p class="pay-mail-hint" hidden>离线演示：模拟向每位员工单独发送工资单，不会实际发出邮件。</p>
    ${!empEmployer(store).legalName || !payIbanOk(empEmployer(store).iban) ? `<p class="pay-hint">生成前请在<a href="#${slug("employee", "合规设置")}">合规设置</a>补齐公司付款名称和有效 IBAN。</p>` : ""}</section>`;
}

function payAccountAdvice(row) {
  if (row.diff > .01) return { type: "in", hours: row.diff, text: `工时多 ${schH(row.diff)}，建议存入` };
  if (row.diff < -.01) return { type: "out", hours: -row.diff, text: `工时少 ${schH(-row.diff)}，建议取出` };
  const threshold = Number(empRule("minijobMonthlyMax")) || 556;
  if (row.type === "werkstudent" && row.hourly && row.rate > 0 && row.gross <= threshold) {
    const hours = (Math.floor(Math.max(0,threshold-row.gross)/row.rate*4+1e-8)+1)/4;
    return { type: "out", hours, text: `学生工 Brutto ≤ €${threshold}（配置门槛），建议取出 ${schH(hours)}` };
  }
  return null;
}

function payTransferAccount(store, month, id, type, rawHours) {
  const run = payGet(store, month);
  if (run.state !== "open") return { ok: false, message: "已封账，请从右侧提交修改" };
  if (!["in", "out"].includes(type) || !Number.isFinite(rawHours) || rawHours <= 0)
    return { ok: false, message: "请输入有效小时数" };
  const hours = Math.round(rawHours*100)/100;
  if (hours <= 0) return { ok: false, message: "最少调整 0.01 小时" };
  const liveHours = hrsRow(store, empById(id), month);
  const beforeHours = run.openDrafts?.[id] ? Number(run.openDrafts[id].hours)+Number(liveHours.delta||0) : liveHours.payable;
  const signed = type === "in" ? -hours : hours;
  const entry = hrsAddAzk(store, id, month, type, hours, `工资月度调整：${type === "in" ? "存入账户，减少" : "取出账户，增加"}本月工时（店长决定）`, true)[0];
  if(run.confirmations?.[id]){run.confirmationHistory=[{id,confirmation:run.confirmations[id],at:empNow()},...(run.confirmationHistory||[])];delete run.confirmations[id];}
  run.azkAdded = { ...(run.azkAdded || {}), [id]: entry.id };
  paySave(run, payLog(run, { zh: `${empById(id)?.name || id} ${type === "in" ? "存入" : "取出"} ${schH(hours)}，本月工时 ${schH(beforeHours)} → ${schH(beforeHours + signed)}`, de: `Zeitkonto ${type}: ${hours}h` }, "Martin"));
  return { ok: true, hours, entry };
}

/* 答复 9.9（推荐）：差旅由员工填金额并上传票据，老板审核后把批准金额交税务师；系统不自己算补贴。
   run.travelClaims[empId] = { claimed: 员工申报金额, receipts: [票据文件名], state: "submitted"|"approved"|"returned",
                              approved: 老板批准金额|null, note: 退回理由, at, decidedAt }。
   只有 approved 的金额写入 run.extras[empId].travel（工资页和交给税务师的数）；下面的自动计算只是灰色参考，不入账。
   员工端（employee-ui.js）提交时调用 payTravelSubmit，或直接按上述结构写 travelClaims。 */
function payTravelClaim(run, id) {
  return run && run.travelClaims ? run.travelClaims[id] || null : null;
}

function payTravelSubmit(store, month, id, claim) {
  const run = payGet(store, month);
  if (run.state !== "open") return { ok: false, message: "已封账，请从右侧提交修改" };
  const claimed = Math.round(Number(claim && claim.amount) * 100) / 100;
  if (!(claimed > 0)) return { ok: false, message: "请填写差旅金额" };
  const receipts = (claim.receipts || []).filter(Boolean);
  if (!receipts.length) return { ok: false, message: "请上传票据" };
  run.travelClaims = { ...(run.travelClaims || {}), [id]: { claimed, receipts, state: "submitted", approved: null, note: "", at: empNow(), decidedAt: null } };
  paySave(run, payLog(run, { zh: `${empById(id)?.name || id} 申报差旅 €${claimed.toFixed(2)}，等老板审核`, de: "Reisekosten eingereicht" }, empById(id)?.name || id));
  return { ok: true, run };
}

function payTravelReview(store, month, id, decision, opts) {
  if (typeof hrIsOwner === "function" && !hrIsOwner()) return { ok: false, message: "差旅只有老板能审核" };
  const run = payGet(store, month), claim = payTravelClaim(run, id);
  if (run.state !== "open") return { ok: false, message: "已封账，请从右侧提交修改" };
  if (!claim || claim.state !== "submitted") return { ok: false, message: "没有待审核的差旅申报" };
  const o = opts || {};
  let next;
  if (decision === "approved") {
    const amount = Math.round(Number(o.amount ?? claim.claimed) * 100) / 100;
    if (!(amount >= 0) || !Number.isFinite(amount)) return { ok: false, message: "批准金额无效" };
    next = { ...claim, state: "approved", approved: amount, note: o.note || "", decidedAt: empNow() };
    run.extras = { ...(run.extras || {}), [id]: { ...(run.extras?.[id] || {}), travel: amount } };
    if (run.openDrafts?.[id]) run.openDrafts[id].travel = amount;
  } else {
    const note = String(o.note || "").trim();
    if (!note) return { ok: false, message: "退回要写理由" };
    next = { ...claim, state: "returned", approved: null, note, decidedAt: empNow() };
    run.extras = { ...(run.extras || {}), [id]: { ...(run.extras?.[id] || {}), travel: 0 } };
    if (run.openDrafts?.[id]) run.openDrafts[id].travel = 0;
  }
  run.travelClaims = { ...run.travelClaims, [id]: next };
  paySave(run, payLog(run, { zh: `${empById(id)?.name || id} 差旅${decision === "approved" ? `老板批准 €${next.approved.toFixed(2)}` : `被退回：${next.note}`}`, de: decision === "approved" ? "Reisekosten genehmigt" : "Reisekosten zurückgegeben" }, "老板"));
  return { ok: true, run };
}

/* 德国境内出差参考计算（参考值，不入账）。行程公里和票据由记录提供，不从城市名称推断。 */
/* 明确标注的演示 PDF；真实上传文件通过 dataUrl/ref 显示。 */
function payDemoPdfBytes(name, month, slip) {
  const ascii = value => String(value ?? '').replace(/[^\x20-\x7e]/g,'?');
  const esc = value => ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  const text = (x,y,size,value,bold=false) => `BT /${bold?'F2':'F1'} ${size} Tf ${x} ${y} Td (${esc(value)}) Tj ET\n`;
  let stream='0.12 0.16 0.25 rg\n';
  stream+=text(48,788,22,'LOHNABRECHNUNG',true)+text(48,764,11,'DEMO PDF - NOT AN OFFICIAL PAYSLIP');
  stream+='0.84 0.86 0.90 RG 48 744 m 547 744 l S\n';
  stream+=text(48,712,11,'Employee')+text(230,712,12,name,true)+text(48,686,11,'Payroll month')+text(230,686,12,month,true);
  stream+='0.95 0.96 0.98 rg 48 567 499 73 re f 0.12 0.16 0.25 rg\n';
  stream+=text(64,613,11,'BRUTTO / GROSS PAY')+text(64,584,24,`EUR ${Number(slip.gross||0).toFixed(2)}`,true);
  stream+=text(64,526,12,'NETTO / NET PAYMENT')+text(365,526,15,`EUR ${Number(slip.net||0).toFixed(2)}`,true);
  stream+=text(64,488,12,'PAYROLL HOURS')+text(365,488,15,`${Number(slip.hours||0).toFixed(2)} h`,true);
  stream+='0.84 0.86 0.90 RG 48 461 m 547 461 l S\n';
  stream+=text(48,419,11,'Preview generated from the registered payroll values.')+text(48,398,11,'No original PDF was supplied for this demonstration record.')+text(48,377,11,'Upload the actual PDF to display the original document here.');
  stream+='0.45 0.49 0.57 rg\n'+text(48,64,9,'KaiSpan local demonstration - not issued by a tax advisor.')+text(511,64,9,'1 / 1');
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset=>pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`);
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

function payPayslipComparison(run,id) {
  const slip=run.slips?.[id], snap=run.snap?.[id];
  const expected=Number(run.corrections?.[id]?.gross ?? snap?.gross ?? 0);
  const hours=Number(run.corrections?.[id]?.hours ?? snap?.payable ?? 0);
  if(!slip) return {expected,hours,actual:null,matched:null,difference:null};
  const actual=Number(slip.gross || 0), difference=Math.round((actual-expected)*100)/100;
  return {expected,hours,actual,difference,matched:slip.file ? Math.abs(difference)<=payTolerance() && Math.abs(Number(slip.hours||0)-hours)<=.25 : null};
}

async function payRenderPdf(container,url,dialog) {
  const session=Symbol('pdf');dialog._pdfSession=session;
  container.textContent='正在加载 PDF…';
  try {
    const library=await import('./assets/vendor/pdfjs/pdf.mjs');
    const base=new URL('./assets/vendor/pdfjs/',location.href);
    library.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.mjs',base).href;
    const source=url.startsWith('data:') ? {data:Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0))} : {url};
    const task=library.getDocument({...source,standardFontDataUrl:new URL('standard_fonts/',base).href,cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,wasmUrl:new URL('wasm/',base).href,isEvalSupported:false});
    dialog._pdfTask=task;
    const pdf=await task.promise;
    if(dialog._pdfSession!==session || !dialog.open) {await task.destroy();return;}
    container.innerHTML='<div class="pay-pdf-pagination"></div><div class="pay-pdf-canvas-wrap"></div>';
    const toolbar=container.querySelector('.pay-pdf-pagination'),wrap=container.querySelector('.pay-pdf-canvas-wrap');
    let pageNumber=1,rendering=false;
    const draw=async()=>{
      if(rendering || dialog._pdfSession!==session) return;
      rendering=true;
      toolbar.innerHTML=`<button type="button" class="ghost-btn pay-pdf-prev" ${pageNumber===1?'disabled':''}>上一页</button><span>第 ${pageNumber} / ${pdf.numPages} 页</span><button type="button" class="ghost-btn pay-pdf-next" ${pageNumber===pdf.numPages?'disabled':''}>下一页</button>`;
      const page=await pdf.getPage(pageNumber);
      if(dialog._pdfSession!==session || !dialog.open) return;
      const initial=page.getViewport({scale:1}),width=Math.max(240,Math.min(820,container.clientWidth-38));
      const viewport=page.getViewport({scale:width/initial.width}),pixelRatio=Math.min(window.devicePixelRatio||1,2);
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width*pixelRatio);canvas.height=Math.ceil(viewport.height*pixelRatio);canvas.style.width=`${viewport.width}px`;canvas.style.height=`${viewport.height}px`;
      canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`工资单 PDF 第 ${pageNumber} 页`);
      wrap.replaceChildren(canvas);
      await page.render({canvasContext:canvas.getContext('2d'),viewport,transform:pixelRatio===1?null:[pixelRatio,0,0,pixelRatio,0,0]}).promise;
      rendering=false;
      toolbar.querySelector('.pay-pdf-prev').onclick=()=>{if(!rendering&&pageNumber>1){pageNumber--;draw();}};
      toolbar.querySelector('.pay-pdf-next').onclick=()=>{if(!rendering&&pageNumber<pdf.numPages){pageNumber++;draw();}};
    };
    await draw();
  } catch(error) {
    if(dialog._pdfSession===session && dialog.open) container.textContent='PDF 暂时无法预览，可点击上方下载 PDF 查看原文件。';
  }
}

function payOpenPayslip(store,month,id) {
  const dialog=document.querySelector('#pay-pdf-dialog'); if(!dialog) return;
  const run=payGet(store,month),slip=run.slips?.[id],snap=run.snap?.[id];
  const name=snap?.name || empById(id)?.name || id, compare=payPayslipComparison(run,id);
  let url=(/^data:application\/pdf;base64,/i.test(slip?.dataUrl||"") ? slip.dataUrl : "") || (slip?.ref && typeof empFileUrl==='function' ? empFileUrl(slip.ref) : '');
  let demo=false;
  if(!url && slip?.file && run.monthlyExamplesV2 && /^Lohnabrechnung_/.test(slip.file)) {
    url=URL.createObjectURL(new Blob([payDemoPdfBytes(name,month,slip)],{type:'application/pdf'}));demo=true;
  }
  dialog.innerHTML=`<header class="pay-pdf-head"><div><h2>${empEsc(name)} · 工资单 PDF</h2><p>${empEsc(month)}${slip?.file ? ` · ${empEsc(slip.file)}`:''}</p></div><button type="button" class="pay-pdf-close" aria-label="关闭工资单预览">×</button></header>
    <div class="pay-pdf-comparison"><div><small>我们计算的 Brutto</small><strong>€${compare.expected.toFixed(2)}</strong></div><div><small>工资单上的 Brutto</small><strong>${compare.actual == null ? '待登记' : `€${compare.actual.toFixed(2)}`}</strong></div><div>${compare.matched == null ? empPill('gray','待核对') : empPill(compare.matched?'green':'red',compare.matched?'匹配':'不匹配')}<small>${compare.difference == null ? '' : `Brutto 差额 ${compare.difference>0?'+':''}€${compare.difference.toFixed(2)}`}</small>${slip && Math.abs(Number(slip.hours||0)-compare.hours)>.25 ? `<small>工资单工时 ${schH(slip.hours)} / 本月 ${schH(compare.hours)}</small>` : ''}</div></div>
    ${demo ? `<p class="pay-pdf-notice">演示 PDF：根据已登记值生成，非税务师原始工资单。</p>`:''}
    <div class="pay-pdf-toolbar">${url ? `<a class="ghost-btn" href="${empEsc(url)}" target="_blank" rel="noopener" download="${empEsc(slip?.file||'Lohnabrechnung.pdf')}">下载 PDF</a>`:''}<label class="ghost-btn pay-pdf-upload-label">${slip?.dataUrl||slip?.ref?'替换原始 PDF':'上传原始 PDF'}<input class="pay-preview-upload" type="file" accept="application/pdf,.pdf"></label><small>上传文件保存在本机；Brutto 使用已登记的工资单数值。</small></div>
    ${url ? `<div class="pay-pdf-pages" aria-label="${empEsc(name)} 工资单 PDF 预览"></div>` : `<div class="pay-pdf-empty">${slip?.file?'原 PDF 未保存在本机，请重新上传原始文件。':'尚未上传工资单 PDF。'}</div>`}`;
  dialog.querySelector('.pay-pdf-close').addEventListener('click',()=>dialog.close());
  dialog.onclose=()=>{ dialog._pdfSession=null;dialog._pdfTask?.destroy().catch(()=>{});dialog._pdfTask=null;if(demo && url) URL.revokeObjectURL(url); };
  dialog.querySelector('.pay-preview-upload').addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const feedback=dialog.querySelector('.pay-pdf-toolbar small');
    if(file.size>2*1024*1024) {feedback.textContent='本机演示最多保存 2 MB 的 PDF。';return;}
    if(await file.slice(0,5).text()!=='%PDF-') {feedback.textContent='请选择有效的 PDF 文件。';return;}
    try {
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const fresh=payGet(store,month);
      fresh.slips[id]={...(fresh.slips[id]||{}),file:file.name,dataUrl,at:empNow()};
      const saved=empWrite(PAY_KEY,{...payAll(),[payKey(store,month)]:fresh});
      if(saved===false) {feedback.textContent='本机空间不足，PDF 未保存。';return;}
      dialog.close();app();payOpenPayslip(store,month,id);
    } catch(error) {feedback.textContent='文件读取失败，请重新选择。';}
  });
  if(!dialog.open) dialog.showModal();
  if(url) payRenderPdf(dialog.querySelector(".pay-pdf-pages"),url,dialog);
}

function payTravelBreakdown(trip) {
  const money = n => Math.round((Number(n) || 0)*100)/100;
  const km = Math.max(0,Number(trip.km) || 0);
  const rate = trip.transport === "own_car" ? .30 : trip.transport === "other_motor" ? .20 : 0;
  const mileage = money(km*rate), tickets = rate ? 0 : money(trip.tickets);
  const mealDays = (trip.days || []).map(day => {
    const base = trip.country && trip.country !== "DE" ? 0 : Number(day.hours)>=24 ? 28 : day.overnight && (day.arrival || day.departure) ? 14 : Number(day.hours)>8 ? 14 : 0;
    const reduction = Math.max(0, (day.breakfast ? 5.6 : 0) + (day.lunch ? 11.2 : 0) + (day.dinner ? 11.2 : 0) - (Number(day.ownMealPayment)||0));
    return { ...day, base, reduction:money(Math.min(base,reduction)), allowance:money(Math.max(0,base-reduction)) };
  });
  const meals = money(mealDays.reduce((sum,day)=>sum+day.allowance,0));
  const hotel=money(trip.hotel), parking=money(trip.parking), tolls=money(trip.tolls), other=money(trip.other);
  return {km,rate,mileage,tickets,mealDays,meals,hotel,parking,tolls,other,total:money(mileage+tickets+meals+hotel+parking+tolls+other)};
}

function payTravelExample(month) {
  return { example:true, country:"DE", from:"Dortmund", to:"Düsseldorf", back:"Dortmund", purpose:"门店支援 / 供应商拜访（示例）",
    departure:`${month}-12T09:00`, returned:`${month}-12T16:30`, hours:7.5, km:156, transport:"own_car",
    days:[{date:`${month}-12`,hours:7.5,breakfast:false,lunch:false,dinner:false}],
    tickets:0,hotel:0,parking:0,tolls:0,other:0,receipts:[] };
}

function payTravelDrawerContent(store, month, id) {
  const run=payGet(store,month), employee=empById(id), correction=run.corrections?.[id];
  const reported=Number(correction?.travel ?? run.extras?.[id]?.travel ?? 0);
  const stored=correction?.travelDetails ?? run.travelDetails?.[id];
  const records=Array.isArray(stored) ? stored : stored ? [stored] : [];
  const exampleTotalMatch=run.monthlyExamplesV2 && Math.abs(reported-46.8)<.01;
  const shown=records.length ? records : [payTravelExample(month)];
  const euro=n=>`€${Number(n||0).toFixed(2)}`;
  const renderTrip=(trip,index)=>{
    const cost=payTravelBreakdown(trip);
    const hours=Number(trip.hours ?? ((new Date(trip.returned)-new Date(trip.departure))/3600000));
    const transport={own_car:"私人自有汽车",other_motor:"其他私人机动车",public:"火车 / 公共交通",flight:"飞机"}[trip.transport] || "其他交通";
    const costRow=(label,amount)=>`<div><dt>${label}</dt><dd>${euro(amount)}</dd></div>`;
    return `<section class="pay-travel-trip"><div class="pay-travel-trip-title"><h3>${trip.example ? "示例行程" : `行程 ${index+1}`}</h3><span>${trip.example ? "示例数据 · 参考值，不入账" : "参考行程 · 参考值，不入账"}</span></div>
      <div class="pay-travel-route"><strong>${empEsc(trip.from||"未填写")}</strong><span>→</span><strong>${empEsc(trip.to||"未填写")}</strong>${trip.back ? `<span>→</span><strong>${empEsc(trip.back)}</strong>` : ""}</div>
      <p>${empEsc(trip.purpose||"未填写出差事由")}</p>
      <dl class="pay-travel-facts"><div><dt>出发</dt><dd>${empEsc(String(trip.departure||"未填写").replace("T"," "))}</dd></div><div><dt>返回</dt><dd>${empEsc(String(trip.returned||"未填写").replace("T"," "))}</dd></div>
        <div><dt>外出时长</dt><dd>${Number.isFinite(hours) ? `${hours.toFixed(1)} 小时` : "未填写"}</dd></div><div><dt>交通方式</dt><dd>${transport}</dd></div><div><dt>总行驶里程（含返程）</dt><dd>${cost.km} km</dd></div><div><dt>计费方式</dt><dd>${cost.rate ? `€${cost.rate.toFixed(2)} / km` : "按实际车票 / 机票"}</dd></div></dl>
      <dl class="pay-travel-costs">${costRow(cost.rate ? `里程费：${cost.km} km × €${cost.rate.toFixed(2)}` : "车票 / 机票",cost.mileage+cost.tickets)}${costRow("餐食定额（扣减后）",cost.meals)}${costRow("酒店（按凭证）",cost.hotel)}${costRow("停车费",cost.parking)}${costRow("过路费",cost.tolls)}${costRow("其他费用",cost.other)}<div class="pay-travel-total pay-travel-ref"><dt>参考值，不入账</dt><dd>${euro(cost.total)}</dd></div></dl>
      ${cost.mealDays.length ? `<div class="pay-travel-meals"><h4>每日餐食补助</h4>${cost.mealDays.map(day=>`<p>${empEsc(day.date||"")} · 外出 ${Number(day.hours)||0}h · 基础 ${euro(day.base)} − 已提供餐食扣减 ${euro(day.reduction)} = <strong>${euro(day.allowance)}</strong><small>${day.breakfast||day.lunch||day.dinner ? `提供餐食：${[day.breakfast?"早餐":"",day.lunch?"午餐":"",day.dinner?"晚餐":""].filter(Boolean).join("、")}` : "未提供餐食"}</small></p>`).join("")}</div>` : ""}
      <p class="pay-travel-receipts">凭证：${trip.receipts?.length ? trip.receipts.map(item=>empEsc(typeof item==="string"?item:item.name||"未命名凭证")).join("、") : trip.example ? "示例未上传实际凭证" : "暂无凭证"}</p></section>`;
  };
  return `<header class="pay-travel-head"><div><h2>差旅费明细 · Reisekosten</h2><p>${empEsc(employee?.name || id)} · ${empEsc(month)}</p></div><button type="button" class="pay-travel-close" aria-label="关闭差旅明细">×</button></header>
    <div class="pay-travel-body"><div class="pay-travel-reported"><span>入账金额（老板已批准）</span><strong>${euro(reported)}</strong><small>${run.state!=="open" ? "已封账，费用修改请从主表右侧提交修改。" : "当前月份未封账。"}</small></div>
    ${(() => {
      const claim=payTravelClaim(run,id);
      if(!claim) return `<p class="pay-travel-empty">员工还没有申报差旅。员工在自己的页面填金额并上传票据；系统不自己算补贴。</p>`;
      const rec=claim.receipts?.length ? claim.receipts.map(x=>empEsc(typeof x==="string"?x:x.name||"票据")).join("、") : "无";
      const review=claim.state==="submitted" && run.state==="open" ? `<div class="pay-travel-review-form"><label>批准金额 €<input type="number" min="0" step="0.01" class="pay-travel-amount" value="${claim.claimed}"></label>
        <label>退回理由<input type="text" class="pay-travel-note" placeholder="退回时必填"></label>
        <div class="pay-acts"><button type="button" class="ghost-btn pay-travel-return" data-id="${id}" data-month="${month}"${hrIsOwner()?"":' disabled title="差旅只有老板能审核"'}>退回</button><button type="button" class="primary-btn pay-travel-approve-form" data-id="${id}" data-month="${month}"${hrIsOwner()?"":' disabled title="差旅只有老板能审核"'}>批准并交税务师</button></div></div>` : "";
      return `<section class="pay-travel-claim is-${claim.state}"><h3>员工申报</h3><p>员工申报 <strong>${euro(claim.claimed)}</strong> · 票据：${rec}</p><p>${claim.state==="submitted"?"待老板审核":claim.state==="approved"?`老板已批准 ${euro(claim.approved)}，这个金额交给税务师`:`已退回：${empEsc(claim.note)}`}</p>${review}</section>`;
    })()}
    ${!records.length ? `<p class="pay-travel-empty">${exampleTotalMatch ? "以下为当前演示费用的行程示例。" : reported ? "已记录费用总额，尚未录入对应行程。以下计算示例不计入本月金额。" : "本月暂无申报行程。以下计算示例不计入本月金额。"}</p>` : ""}
    ${run.state==="open" ? `<button type="button" class="ghost-btn pay-travel-edit" data-id="${id}" data-month="${month}">编辑行程与费用</button>` : ""}
    ${shown.map(renderTrip).join("")}
    <details class="pay-travel-rules" open><summary>德国境内出差参考规则 · 2026（灰色参考，不入账）</summary><ul><li>私人汽车：按实际行驶公里计 €0.30/km；其他私人机动车 €0.20/km。</li><li>当天外出超过 8 小时：餐食定额 €14；不超过 8 小时：€0。</li><li>完整外出 24 小时：€28；有外宿的抵达日、离开日各 €14。</li><li>提供早餐扣 €5.60；午餐、晚餐各扣 €11.20，当日补助最低为 €0。</li><li>酒店、车票和停车等按凭证展示；国外差旅及长期驻点另按相应规则核对。</li></ul>
      <p>适用于离开住所和第一工作地点的业务出差；普通上下班通勤使用另一套规则。</p>
      <a href="https://esth.bundesfinanzministerium.de/lsth/2026/tabellarische-Uebersicht/Reisekosten-bei-Ausw%C3%A4rtst%C3%A4tigkeiten.html" target="_blank" rel="noopener noreferrer">BMF 2026 官方差旅标准 ↗</a> · <a href="https://www.gesetze-im-internet.de/estg/__9.html" target="_blank" rel="noopener noreferrer">EStG §9 ↗</a></details></div>`;
}

/* 答复 9.4：已发工资的更正“只给税务师提修改意见，由税务师决定”。
   提交只是一条独立的修改意见记录（run.correctionProposals），不改工时账户、不改对账预期（corrections 不动）；
   老板录入“税务师已采纳”（payAdoptCorrection）之后才生效。 */
function paySubmitCorrection(store, month, id, values, account = {}) {
  const run = payGet(store, month), original = run.snap[id];
  if (!original) return { ok: false, message: "找不到原封账记录" };
  if (Object.values(values).some(n => !Number.isFinite(n))) return { ok: false, message: "请输入有效数值" };
  let hours = 0;
  if (account.type) {
    if (!["in", "out"].includes(account.type) || !Number.isFinite(account.hours) || account.hours <= 0)
      return { ok: false, message: "请输入有效的账户调整小时" };
    hours = Math.round(account.hours*100)/100;
    if (hours <= 0) return { ok: false, message: "最少调整 0.01 小时" };
  }
  const list = run.correctionProposals || [];
  let n = list.length + 1;
  while (list.some(x => x.id === `cp${n}`)) n += 1;
  const proposal = { id: `cp${n}`, empId: id, values: { ...values }, account: account.type ? { type: account.type, hours } : null,
    status: "proposed", at: empNow(), by: "Martin" };
  run.correctionProposals = [proposal, ...list];
  paySave(run, payLog(run, { zh: `向税务师提交 ${original.name} 的修改意见：${schH(values.hours)} · Brutto €${Number(values.gross).toFixed(2)}${account.type ? ` · 建议工时账户${account.type === "in" ? "存入" : "取出"} ${schH(hours)}` : ""}（税务师决定前不生效）`, de: `Änderungsvorschlag für ${original.name} (wirkt erst nach Entscheidung der Steuerberatung)` }, "Martin"));
  return { ok: true, run, proposal, entry: null };
}

/* 老板录入税务师的决定。“采纳”才把修改写进对账预期，并按意见调整工时账户；“未采纳”只留记录。 */
function payDecideCorrection(store, month, proposalId, adopted) {
  if (typeof hrIsOwner === "function" && !hrIsOwner()) return { ok: false, message: "税务师的决定由老板录入" };
  const run = payGet(store, month);
  const proposal = (run.correctionProposals || []).find(x => x.id === proposalId);
  if (!proposal || proposal.status !== "proposed") return { ok: false, message: "这条修改意见已经有结果" };
  const id = proposal.empId, original = run.snap[id];
  if (!original) return { ok: false, message: "找不到原封账记录" };
  let entry = null;
  if (adopted) {
    const values = proposal.values, account = proposal.account;
    const hours = account ? account.hours : 0;
    const signed = account ? (account.type === "in" ? -hours : hours) : 0;
    entry = account ? hrsAddAzk(store, id, month, account.type, hours, "税务师已采纳修改意见：调整工时账户", true)[0] : null;
    run.correctionHistory = [{ empId: id, original, previous: run.corrections?.[id] || null, at: empNow() }, ...(run.correctionHistory || [])];
    run.corrections = { ...(run.corrections || {}), [id]: { ...values,
      hours: Math.round((values.hours + signed)*100)/100,
      gross: original.payType === "hourly" ? Math.round((values.gross + signed*original.rate)*100)/100 : values.gross,
      ...(entry ? { azkEntry: entry.id } : {}), at: empNow(), by: "Martin", status: "advisor_adopted", proposalId } };
    if (entry) run.azkAdded = { ...(run.azkAdded || {}), [id]: entry.id };
  }
  run.correctionProposals = run.correctionProposals.map(x => x.id !== proposalId ? x
    : { ...x, status: adopted ? "adopted" : "declined", decidedAt: empNow(), decidedBy: "老板", ...(entry ? { azkEntry: entry.id } : {}) });
  paySave(run, payLog(run, { zh: `${original.name} 的修改意见：税务师${adopted ? "已采纳，已生效" : "未采纳，保持原数"}`, de: adopted ? "Steuerberatung hat übernommen" : "Steuerberatung hat abgelehnt" }, "老板"));
  return { ok: true, run, entry };
}

/* ============================================================== 绑定 ===== */
function payGo(href) {
  const target = String(href).replace(/^#/, "");
  if (decodeURIComponent(location.hash.replace("#", "")) === decodeURIComponent(target)) app();
  else location.hash = target;
}

function payBindAll() {
  const store = payStore();
  if (state().params.get("corr")) document.querySelector(".pay-correction")?.scrollIntoView({ block: "start" });

  document.querySelectorAll(".pay-close-btn").forEach(b => b.addEventListener("click", () => {
    const r = payClose(store, b.dataset.month, "Martin");
    if (!r.ok) { empFlash(b, empT("还有没收干净的", "Noch offene Punkte")); return; }
    payGo(payHref({}));
  }));

  document.querySelectorAll(".pay-reopen").forEach(b => b.addEventListener("click", () => {
    payReopen(store, b.dataset.month, document.querySelector(".pay-reopen-why")?.value || "", "Martin");
    app();
  }));

  document.querySelectorAll(".pay-csv").forEach(b => b.addEventListener("click", () => {
    const m = b.dataset.month;
    schDownload(`KaiSpan_Lohndaten_${store.replace(/\s+/g, "_")}_${m}.csv`, payAdvisorCsv(store, m), "text/csv");
    empFlash(b, empT("已下载", "Heruntergeladen"));
  }));

  document.querySelectorAll(".pay-copy").forEach(b => b.addEventListener("click", () => {
    empCopy(payAdvisorMail(store, b.dataset.month), b);
  }));

  document.querySelectorAll(".pay-sent").forEach(b => b.addEventListener("click", () => {
    payMarkSent(store, b.dataset.month, document.querySelector(".pay-sent-to")?.value || "", "Martin");
    app();
  }));

  /* 选文件只取文件名 —— 没有后端，也没有 PDF 解析。页面上写明了。 */
  document.querySelectorAll(".pay-in-file").forEach(inp => inp.addEventListener("change", () => {
    inp.dataset.picked = (inp.files && inp.files[0] && inp.files[0].name) || "";
  }));

  document.querySelectorAll(".pay-slip-save").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id;
    const pick = c => document.querySelector(`.${c}[data-id="${id}"]`);
    const gross = Number(pick("pay-in-gross")?.value);
    const net = Number(pick("pay-in-net")?.value);
    const hours = Number(pick("pay-in-hours")?.value);
    if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(net) || net <= 0) {
      empFlash(b, empT("Brutto 和 Netto 都要填", "Brutto und Netto angeben"));
      return;
    }
    if (net > gross) { empFlash(b, empT("Netto 比 Brutto 还大，检查一下", "Netto größer als Brutto")); return; }
    const fileInput = pick("pay-in-file");
    const run = payGet(store, b.dataset.month);
    paySetSlip(store, b.dataset.month, id, {
      gross, net, hours: Number.isFinite(hours) ? hours : 0,
      file: (fileInput && fileInput.dataset.picked) || (run.slips[id] && run.slips[id].file) || "",
      note: pick("pay-in-note")?.value || ""
    }, "Martin");
    payGo(payHref({ slip: null }));
  }));

  document.querySelectorAll(".pay-slip-drop").forEach(b => b.addEventListener("click", () => {
    payDropSlip(store, b.dataset.month, b.dataset.id, "Martin");
    payGo(payHref({ slip: null }));
  }));

  document.querySelectorAll(".pay-select-month").forEach(input => input.addEventListener("change", () => {
    if (/^\d{4}-\d{2}$/.test(input.value)) payGo(payHref({m:input.value,corr:null,slip:null}));
  }));
  const paymentChecks = () => [...document.querySelectorAll(".pay-payment-check")];
  const updatePayments = () => {
    const selected = paymentChecks().filter(x => x.checked && !x.disabled);
    const total = selected.reduce((n,x)=>n+Number(x.dataset.net),0);
    const summary = document.querySelector(".pay-payment-summary");
    if (summary) summary.textContent = `已选 ${selected.length} 人 · €${total.toFixed(2)}`;
    const button = document.querySelector(".pay-sepa-selected"); if (button) button.disabled = !selected.length;
    const eligible = paymentChecks().filter(x=>!x.disabled), all = document.querySelector(".pay-payment-all");
    if (all) { all.checked = !!eligible.length && selected.length === eligible.length; all.indeterminate = selected.length > 0 && selected.length < eligible.length; }
  };
  document.querySelectorAll(".pay-payment-check").forEach(x=>x.addEventListener("change",updatePayments));
  document.querySelector(".pay-payment-all")?.addEventListener("change",e=>{paymentChecks().filter(x=>!x.disabled).forEach(x=>x.checked=e.target.checked);updatePayments();});
  document.querySelector(".pay-sepa-selected")?.addEventListener("click",e=>{
    const button=e.currentTarget, month=button.dataset.month;
    const ids=paymentChecks().filter(x=>x.checked&&!x.disabled).map(x=>x.dataset.id);
    if (!ids.length) return;
    const company=empEmployer(store);
    if (!company.legalName || !payIbanOk(company.iban)) { empFlash(button,"请先补齐公司付款名称和有效 IBAN"); return; }
    const eligible = payPayable(store,month).filter(r=>!r.paid&&!r.why&&payIbanOk(r.iban)).map(r=>r.id);
    if (!ids.every(id=>eligible.includes(id))) { app();return; }
    schDownload(paySepaName(store,month),paySepaXml(store,month,ids),"application/xml");
    empFlash(button,"已生成选中员工的 SEPA XML");
  });

  document.querySelectorAll(".pay-sepa").forEach(b => b.addEventListener("click", () => {
    const m = b.dataset.month;
    if (paySepaBlockers(store, m).length) { empFlash(b, empT("还差东西", "Noch unvollständig")); return; }
    schDownload(paySepaName(store, m), paySepaXml(store, m), "application/xml");
    empFlash(b, empT("已下载，去网银上传这个文件", "Heruntergeladen — im Banking hochladen"));
  }));

  document.querySelectorAll(".pay-paid").forEach(b => b.addEventListener("click", () => {
    payMarkPaid(store, b.dataset.month, b.dataset.id, !!b.dataset.on, "Martin");
    app();
  }));

  document.querySelectorAll(".pay-toemp").forEach(b => b.addEventListener("click", () => {
    payMarkSlipSent(store, b.dataset.month, b.dataset.id, "Martin");
    app();
  }));

  document.querySelectorAll(".pay-refresh").forEach(b=>b.addEventListener("click",()=>app()));
  document.querySelectorAll(".pay-handover").forEach(b=>b.addEventListener("click",()=>{
    const month=b.dataset.month,run=payGet(store,month),issues=payBlockers(store,month),dialog=document.querySelector("#pay-edit-dialog");
    dialog.innerHTML=`<header class="pay-travel-head"><div><h2>确认移交税务师</h2><p>${month} · 离线演示，不会实际发送资料</p></div></header><div class="pay-edit-form"><p>移交后锁定本月数据，后续通过提交修改处理。员工未回复的状态会继续保留。</p>${issues.length?`<p>仍有以下待办，由你决定是否继续：</p><ul>${issues.map(x=>`<li>${empEsc(x.zh)}</li>`).join("")}</ul>`:"<p>当前检查无待办。</p>"}<div class="pay-acts"><button class="ghost-btn pay-handover-cancel">返回核对</button><button class="primary-btn pay-handover-go">确认移交（模拟）</button></div></div>`;
    dialog.querySelector(".pay-handover-cancel").onclick=()=>dialog.close();
    dialog.querySelector(".pay-handover-go").onclick=()=>{const result=payClose(store,month,"Martin",true);if(!result.ok)return;const r=result.run;r.state="sent";r.sentAt=empNow();r.sentTo="离线演示：税务师待接收";r.handoverIssues=issues;paySave(r,payLog(r,{zh:"已核对并模拟移交税务师；员工确认状态独立保留。",de:"Demo-Übergabe"},"Martin"));dialog.close();app();};dialog.showModal();
  }));
  document.querySelectorAll(".pay-hours-open").forEach(b=>b.addEventListener("click",()=>payOpenCalendar(store,b.dataset.month,b.dataset.id)));
  document.querySelectorAll(".pay-edit").forEach(b=>b.addEventListener("click",()=>payOpenEdit(store,b.dataset.month,b.dataset.id)));

  const mailSection=document.querySelector(".pay-pay");
  const mailChecks=()=>[...document.querySelectorAll(".pay-mail-check")];
  const updateMailSelection=()=>{
    const available=mailChecks().filter(x=>!x.disabled),selected=available.filter(x=>x.checked);
    const all=document.querySelector(".pay-mail-all");if(all){all.checked=!!available.length&&selected.length===available.length;all.indeterminate=selected.length>0&&selected.length<available.length;}
    const count=document.querySelector(".pay-mail-count");if(count)count.textContent=`已选 ${selected.length} 人`;
    const send=document.querySelector(".pay-mail-send");if(send)send.disabled=!selected.length;
  };
  const setMailSelection=(active)=>{
    if(active){
      const paymentIds=new Set(paymentChecks().filter(x=>x.checked&&!x.disabled).map(x=>x.dataset.id));
      mailChecks().forEach(x=>x.checked=!x.disabled&&paymentIds.has(x.dataset.id));
    }
    mailSection?.classList.toggle("is-mail-select",active);
    document.querySelector(".pay-mail-start").hidden=active;
    document.querySelector(".pay-mail-actions").hidden=!active;
    document.querySelector(".pay-mail-hint").hidden=!active;
    if(!active)mailChecks().forEach(x=>x.checked=false);
    updateMailSelection();updatePayments();
    const exportButton=document.querySelector(".pay-sepa-selected");if(active&&exportButton)exportButton.disabled=true;
  };
  document.querySelector(".pay-mail-start")?.addEventListener("click",()=>setMailSelection(true));
  document.querySelector(".pay-mail-cancel")?.addEventListener("click",()=>setMailSelection(false));
  document.querySelector(".pay-mail-all")?.addEventListener("change",e=>{mailChecks().filter(x=>!x.disabled).forEach(x=>x.checked=e.target.checked);updateMailSelection();});
  mailChecks().forEach(x=>x.addEventListener("change",updateMailSelection));
  document.querySelector(".pay-mail-send")?.addEventListener("click",e=>{
    const button=e.currentTarget,ids=mailChecks().filter(x=>x.checked&&!x.disabled).map(x=>x.dataset.id);
    const result=paySendSelectedDemo(store,button.dataset.month,ids);
    if(!result.ok){empFlash(button,result.message);return;}
    app();
  });

  document.querySelectorAll(".pay-pdf-open").forEach(b=>b.addEventListener("click",e=>{
    e.preventDefault();payOpenPayslip(store,b.dataset.month,b.dataset.id);
  }));
  document.querySelectorAll(".pay-travel-open").forEach(b=>b.addEventListener("click",()=>{
    const dialog=document.querySelector("#pay-travel-dialog"); if(!dialog) return;
    dialog.innerHTML=payTravelDrawerContent(store,b.dataset.month,b.dataset.id);
    dialog.querySelector(".pay-travel-close").addEventListener("click",()=>dialog.close());
    dialog.querySelector(".pay-travel-edit")?.addEventListener("click",()=>{payTravelEdit(store,b.dataset.month,b.dataset.id);});
    dialog.querySelector(".pay-travel-approve-form")?.addEventListener("click",ev=>{
      const res=payTravelReview(store,b.dataset.month,b.dataset.id,"approved",{amount:Number(dialog.querySelector(".pay-travel-amount")?.value)});
      if(!res.ok){empFlash(ev.currentTarget,res.message);return;} dialog.close(); app();
    });
    dialog.querySelector(".pay-travel-return")?.addEventListener("click",ev=>{
      const res=payTravelReview(store,b.dataset.month,b.dataset.id,"returned",{note:dialog.querySelector(".pay-travel-note")?.value});
      if(!res.ok){empFlash(ev.currentTarget,res.message);return;} dialog.close(); app();
    });
    dialog.showModal();
  }));
  document.querySelectorAll(".pay-travel-approve").forEach(b=>b.addEventListener("click",()=>{
    const res=payTravelReview(store,b.dataset.month,b.dataset.id,"approved");
    if(!res.ok){empFlash(b,res.message);return;} app();
  }));

  document.querySelectorAll(".pay-contact-close").forEach(b => b.addEventListener("click", () => {
    const details = b.closest("details"); details.open = false; details.querySelector("summary")?.focus();
  }));
  document.querySelectorAll(".pay-contact").forEach(details => details.addEventListener("toggle", () => {
    if (details.open) document.querySelectorAll(".pay-contact").forEach(other => { if (other !== details) other.open = false; });
  }));
  document.querySelectorAll(".pay-account-transfer").forEach(b => b.addEventListener("click", () => {
    const input = document.querySelector(`.pay-account-hours[data-id="${b.dataset.id}"]`);
    const result = payTransferAccount(store, b.dataset.month, b.dataset.id, b.dataset.type, Number(input?.value));
    if (!result.ok) { empFlash(b, result.message); return; }
    app();
  }));

  document.querySelectorAll(".pay-correction-employee").forEach(sel => sel.addEventListener("change", () => {
    payGo(payHref({ corr: sel.value }));
  }));
  const updateAccountPreview = () => {
    const box = document.querySelector(".pay-correction-account"); if (!box) return;
    const type = document.querySelector(".pay-corr-account-type").value;
    const amount = Math.round((Number(document.querySelector(".pay-corr-account-hours").value) || 0)*100)/100;
    const signed = type === "in" ? -amount : type === "out" ? amount : 0;
    const hours = Number(document.querySelector(".pay-corr-hours").value) || 0;
    const gross = Number(document.querySelector(".pay-corr-gross").value) || 0;
    const nextBalance = Number(box.dataset.balance) - signed;
    const nextGross = gross + (box.dataset.hourly ? signed * Number(box.dataset.rate) : 0);
    box.querySelector(".pay-corr-account-preview").textContent = `${type ? (type === "in" ? "存入" : "取出") + " " + amount + "h；" : "不调整账户；"}税务师采纳后余额 ${nextBalance.toFixed(2)}h · 本月工时 ${(hours+signed).toFixed(2)}h · Brutto €${nextGross.toFixed(2)}`;
    document.querySelectorAll(".pay-corr-direction").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.type === type)));
  };
  document.querySelectorAll(".pay-corr-direction").forEach(b=>b.addEventListener("click",()=>{
    document.querySelector(".pay-corr-account-type").value=b.dataset.type; updateAccountPreview();
  }));
  document.querySelectorAll(".pay-corr-account-hours, .pay-corr-hours, .pay-corr-gross").forEach(input=>input.addEventListener("input",updateAccountPreview));
  document.querySelectorAll(".pay-prop-ok, .pay-prop-no").forEach(b => b.addEventListener("click", () => {
    const res = payDecideCorrection(store, b.dataset.month, b.dataset.id, b.classList.contains("pay-prop-ok"));
    if (!res.ok) { empFlash(b, res.message); return; }
    app();
  }));
  document.querySelectorAll(".pay-corr-save").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.id, run = payGet(store, b.dataset.month);
    const hours = Number(document.querySelector(".pay-corr-hours")?.value), gross = Number(document.querySelector(".pay-corr-gross")?.value);
    const additions = Object.fromEntries([["bonus", ".pay-corr-bonus"], ["travel", ".pay-corr-travel"], ["urlaubDays", ".pay-corr-urlaub"], ["krankDays", ".pay-corr-krank"]].map(([key, selector]) => [key, Number(document.querySelector(selector)?.value || 0)]));
    const result = paySubmitCorrection(store,b.dataset.month,id,{hours,gross,...additions},{
      type:document.querySelector(".pay-corr-account-type")?.value || "",
      hours:Number(document.querySelector(".pay-corr-account-hours")?.value)
    });
    if (!result.ok) { empFlash(b,result.message); return; }
    app();
  }));

  document.querySelectorAll(".pay-bulk-draft").forEach(b => b.addEventListener("click", () => {
    const ids = [...document.querySelectorAll(".pay-bulk-check:checked")].map(x => x.dataset.id);
    if (!ids.length) { empFlash(b, empT("先选择员工", "Bitte Mitarbeitende auswählen")); return; }
    const to = ids.map(id => empById(id)?.contact?.email).filter(Boolean).join(",");
    const run = payGet(store, b.dataset.month);
    const names = ids.map(id => `${run.snap[id]?.name || id} — ${run.slips[id]?.file || empT("请附上工资单文件", "Abrechnung anhängen")}`).join("\n");
    location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(empT(`工资单 ${b.dataset.month}`, `Lohnabrechnung ${b.dataset.month}`))}&body=${encodeURIComponent(empT(`您好，\n\n请查收本月工资单。请在邮件中添加以下附件：\n${names}\n\n谢谢。`, `Guten Tag,\n\nbitte die Abrechnungen im Anhang ergänzen:\n${names}\n\nViele Grüße`))}`;
  }));
  document.querySelectorAll(".pay-bulk-sent").forEach(b => b.addEventListener("click", () => {
    const ids = [...document.querySelectorAll(".pay-bulk-check:checked")].map(x => x.dataset.id);
    if (!ids.length) { empFlash(b, empT("先选择员工", "Bitte Mitarbeitende auswählen")); return; }
    ids.forEach(id => payMarkSlipSent(store, b.dataset.month, id, "Martin"));
    app();
  }));
}

/* ==================================================== 员工助手主页那张卡 == */
function payHomeCard() {
  const store = payStore();
  const month = payPrevMonth();
  const run = payGet(store, month);
  const off = payOffRows(store, month);
  const rows = payPayable(store, month);
  const ready = rows.filter(r => !r.why);
  const paid = rows.filter(r => r.paid).length;
  const tag = run.state === "open"
    ? (payBlockers(store, month).length ? empPill("orange", empT("还没封账", "Nicht abgeschlossen"))
                                        : empPill("blue", empT("可以封账了", "Bereit zum Abschluss")))
    : off.length ? empPill("red", empT(`${off.length} 份对不上`, `${off.length} ${off.length === 1 ? "Abweichung" : "Abweichungen"}`))
    : run.state === "paid" ? empPill("green", empT("已发薪", "Ausgezahlt"))
    : empPill("orange", empText(PAY_STATES[run.state].name));
  const line2 = run.state === "open"
    ? empT("封账之前先把考勤、休假、加班收干净", "Vor dem Abschluss: Zeiterfassung, Abwesenheiten, Überstunden klären")
    : ready.length ? empT(`${paid} / ${ready.length} 人已打款`, `${paid} / ${ready.length} bezahlt`)
    : empT("工资单还没回来", "Abrechnungen ausstehend");
  /* 2026-09-03（下午）：工时结算又搬走了 —— 它成了「考勤与工时」的月视图。
     这张卡因此只说钱：这个月要打多少、走到哪一步了。工时那个数在考勤那张卡上。 */
  const gross = Object.keys(run.snap || {}).reduce((sum, id) => sum + (run.snap[id].gross || 0), 0);
  return `<a class="emp-module is-live is-mod-pay" href="#${slug("employee", "工资单与发薪")}">
    <div class="emp-module-head"><h2>${empT("工资与发薪", "Lohn und Auszahlung")}</h2>${tag}</div>
    <p>${empT("月度工时确认 → 次月 2 日前封账 → 提交税务师 → 工资单核对与发薪。封账后通过提交修改更正。",
              "Abschluss → Steuerberater → Abrechnungen prüfen → SEPA-Zahlung. Hier wird nicht neu gerechnet.")}</p>
    <div class="emp-module-mini">
      <span>${gross ? empT(`工资单合计 €${gross.toFixed(0)}`, `Abrechnungen gesamt €${gross.toFixed(0)}`)
                    : empT("这个月还没有工资单", "Noch keine Abrechnungen")}</span>
      <span>${schMonthName(month)} · ${line2}</span>
    </div>
    <span class="emp-module-cta">${empT("进入工资与发薪 →", "Zu Lohn und Auszahlung →")}</span>
  </a>`;
}


function payOpenEdit(store,month,id){
 const run=payGet(store,month);if(run.state!=="open")return;
 const button=[...document.querySelectorAll(".pay-edit")].find(b=>b.dataset.id===id),row=button?.closest("tr");if(!row||row.classList.contains("is-editing"))return;
 row.classList.add("is-editing");const e=empById(id),h=hrsRow(store,e,month),delta=Number(h.delta)||0;
 const d=run.openDrafts?.[id]||{hours:h.payable-delta,contract:{...e.contract},bonus:run.extras?.[id]?.bonus||0,travel:run.extras?.[id]?.travel||0},c=d.contract||e.contract;
 const cells=row.querySelectorAll("td"),original=[...cells].map(x=>x.innerHTML);
 const field=(key,label,value)=>`<label class="pay-inline-field">${label}<input data-edit="${key}" type="number" step="0.01" value="${Number(value)||0}" required></label>`;
 cells[1].innerHTML=field("hours","本月工时",Number(d.hours)+delta)+field("min","合同下限",c.type==="vollzeit"?173.2:c.hoursMin)+field("max","合同上限",c.type==="vollzeit"?173.2:c.hoursMax);
 cells[4].innerHTML=field("rate",c.payType==="pauschal"?"固定工资 €":"时薪 €",c.rate);
 cells[5].innerHTML=field("bonus","Bonus €",d.bonus);
 cells[6].innerHTML=field("urlaubDays","Urlaub 天",d.urlaubDays);
 cells[7].innerHTML=field("krankDays","病假 天",d.krankDays);
 button.parentElement.innerHTML=`<button type="button" class="primary-btn pay-inline-save">保存</button><button type="button" class="ghost-btn pay-inline-cancel">取消</button>`;
 row.querySelector(".pay-inline-cancel").onclick=()=>app();
 row.querySelector(".pay-inline-save").onclick=ev=>{
 const inputs=[...row.querySelectorAll("[data-edit]")];if(inputs.some(x=>!x.reportValidity()))return;
 const v=Object.fromEntries(inputs.map(x=>[x.dataset.edit,Number(x.value)]));if(v.max<v.min){empFlash(ev.currentTarget,"上限不能小于下限");return;}
 const latest=payGet(store,month);if(latest.state!=="open")return;
 latest.editHistory=[{id,before:d,at:empNow()},...(latest.editHistory||[])];
 latest.openDrafts={...(latest.openDrafts||{}),[id]:{...d,hours:v.hours-delta,contract:{...c,type:c.type==="vollzeit"&&(v.min!==173.2||v.max!==173.2)?"teilzeit":c.type,hoursMin:v.min,hoursMax:v.max,rate:v.rate},bonus:v.bonus,urlaubDays:v.urlaubDays,krankDays:v.krankDays}};
 latest.extras={...(latest.extras||{}),[id]:{...(latest.extras?.[id]||{}),bonus:v.bonus}};
 payInvalidateEmployeeReply(latest,id);paySave(latest,payLog(latest,{zh:`编辑 ${e.name} 本月工时与费用`,de:"Monatsdaten bearbeitet"},"Martin"));app();};
}
function payInvalidateEmployeeReply(run,id){
 if(run.confirmations?.[id]){run.confirmationHistory=[{id,confirmation:run.confirmations[id],at:empNow()},...(run.confirmationHistory||[])];delete run.confirmations[id];}
}

function payCalendarDays(store,month,id,run){
 const count=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate(),last=`${month}-${String(count).padStart(2,"0")}`,days={};
 attRangePairs(store,`${month}-01`,last,id).forEach(p=>{const rec=p.rec||{},eff=attEffective(rec,p.shift),plan=p.shift;if(!eff&&!plan&&!rec.in&&!rec.out)return;(days[p.date]||=[]).push({type:"work",start:eff?(eff.src==="punch"?attPayrollStart(eff.start,plan):eff.start):"",end:eff?.end||"",hours:eff?attPayableNet(rec,plan):0,planStart:plan?.start||"",planEnd:plan?.end||"",punchStart:rec.in?.at||"",punchEnd:rec.out?.at||""});});
 if(typeof lvOf==="function")lvOf(store,id,"approved").filter(l=>["urlaub","krank"].includes(l.type)).forEach(l=>Object.entries(l.dayMap||{}).filter(([date])=>date.startsWith(month)).forEach(([date,n])=>{const planned=(days[date]||[]).reduce((v,x)=>v+(x.planStart?attHoursOf(x.planStart,x.planEnd).net:0),0);days[date]=[{type:l.type,hours:planned||Number(n)*8,dayFraction:Number(n),start:"",end:""}];}));
 Object.entries(run.calendarDays?.[id]||{}).forEach(([date,items])=>days[date]=JSON.parse(JSON.stringify(items)));
 return {days,count};
}
function payOpenCalendar(store,month,id){
 const dialog=document.querySelector("#pay-edit-dialog"),run=payGet(store,month),e=empById(id),model=payCalendarDays(store,month,id,run),original=JSON.parse(JSON.stringify(model.days));let days=model.days,editing=false;
 const label={work:"正常上班",urlaub:"Urlaub 年假",krank:"病假"};
 const render=()=>{const offset=(new Date(`${month}-01T12:00:00`).getDay()+6)%7;
 dialog.classList.add("pay-calendar-dialog");dialog.innerHTML=`<header class="pay-travel-head"><div><h2>${empEsc(e.name)} · ${month} 工时日历</h2><p>早到按排班开始，迟到按设置向上取整 ${Number(empRule("lateRoundingMinutes"))||15} 分钟；人工核定优先。计薪总工时包含带薪休假</p></div><div>${run.state==="open"?`<button class="${editing?"primary-btn":"ghost-btn"} pay-calendar-edit">${editing?"保存修改":"编辑"}</button>${editing?'<button class="ghost-btn pay-calendar-cancel">取消</button>':""}`:'<small>已提交，调整请从主表提交修改</small>'}<button class="pay-calendar-close" aria-label="关闭工时日历">×</button></div></header><div class="pay-calendar-body"><p class="pay-hint">排班与原始打卡保留供对照。日历修改只调整本月计薪记录，不覆盖原始打卡；保存后需员工重新确认。未有日期明细的历史手动调整仍保留在月度总数中。</p><div class="pay-calendar-grid">${["一","二","三","四","五","六","日"].map(x=>`<strong class="pay-calendar-week">周${x}</strong>`).join("")}${Array.from({length:offset},()=>'<div></div>').join("")}${Array.from({length:model.count},(_,i)=>{const date=`${month}-${String(i+1).padStart(2,"0")}`,items=days[date]||[];return `<div class="pay-calendar-day"><strong>${i+1}</strong>${items.map((x,j)=>`<div class="pay-calendar-shift is-${x.type}" data-date="${date}" data-index="${j}">${editing?`<select data-cal="type" aria-label="${date} 性质">${Object.entries(label).map(([v,n])=>`<option value="${v}" ${x.type===v?"selected":""}>${n}</option>`).join("")}</select><label>开始<input type="time" data-cal="start" value="${x.start||""}"></label><label>结束<input type="time" data-cal="end" value="${x.end||""}"></label><label>计薪小时<input type="number" data-cal="hours" min="0" step="0.01" value="${x.hours||0}"></label><button type="button" class="pay-cal-delete">删除</button>`:`<strong>${label[x.type]}</strong>${x.type==="work"?`<div class="pay-calendar-time is-plan"><small>排班</small>${x.planStart?`${empEsc(x.planStart)}–${empEsc(x.planEnd)}`:"无排班记录"}</div><div class="pay-calendar-time"><small>打卡</small>${x.punchStart||x.punchEnd?`${empEsc(x.punchStart||"缺上班卡")}–${empEsc(x.punchEnd||"缺下班卡")}`:"未打卡"}</div>${x.start?`<small>核定 ${empEsc(x.start)}–${empEsc(x.end)}</small>`:""}`:""}<b>${schH(x.hours||0)} 计薪</b>`}</div>`).join("")}${editing?`<button class="ghost-btn pay-cal-add" data-date="${date}">＋ 添加</button>`:!items.length?'<small class="pay-calendar-empty">无记录</small>':""}</div>`;}).join("")}</div></div>`;
 dialog.querySelector(".pay-calendar-close").onclick=()=>dialog.close();dialog.querySelector(".pay-calendar-cancel")?.addEventListener("click",()=>{days=JSON.parse(JSON.stringify(original));editing=false;render();});
 const collect=()=>dialog.querySelectorAll("[data-date][data-index]").forEach(el=>{const x=days[el.dataset.date][Number(el.dataset.index)];el.querySelectorAll("[data-cal]").forEach(input=>x[input.dataset.cal]=input.type==="number"?Number(input.value):input.value);});
 dialog.querySelectorAll("[data-cal=type]").forEach(input=>input.onchange=()=>{const el=input.closest("[data-index]"),x=days[el.dataset.date][Number(el.dataset.index)],hours=el.querySelector("[data-cal=hours]");if(input.value!=="work"&&!Number(hours.value)){hours.value=x.planStart?attHoursOf(x.planStart,x.planEnd).net:((e.contract?.type==="vollzeit")?8:4);} });
 dialog.querySelectorAll("[data-cal=start],[data-cal=end]").forEach(input=>input.onchange=()=>{const el=input.closest("[data-index]"),a=el.querySelector("[data-cal=start]").value,b=el.querySelector("[data-cal=end]").value;if(a&&b)el.querySelector("[data-cal=hours]").value=attHoursOf(a,b).net;});
 dialog.querySelectorAll(".pay-cal-add").forEach(b=>b.onclick=()=>{collect();(days[b.dataset.date]||=[]).push({type:"work",start:"09:00",end:"17:00",hours:7.5});render();});
 dialog.querySelectorAll(".pay-cal-delete").forEach(b=>b.onclick=()=>{collect();const el=b.closest("[data-index]");days[el.dataset.date].splice(Number(el.dataset.index),1);render();});
 dialog.querySelector(".pay-calendar-edit")?.addEventListener("click",ev=>{if(!editing){editing=true;render();return;}collect();if([...dialog.querySelectorAll("input")].some(x=>!x.reportValidity()))return;
 const latest=payGet(store,month);if(latest.state!=="open")return;
 const total=obj=>Object.values(obj).flat().reduce((n,x)=>n+Number(x.hours||0),0),change=Math.round((total(days)-total(original))*100)/100,h=hrsRow(store,e,month),d=latest.openDrafts?.[id]||{hours:h.payable-(h.delta||0),contract:{...e.contract},bonus:latest.extras?.[id]?.bonus||0,travel:latest.extras?.[id]?.travel||0};
 latest.calendarHistory=[{id,days:original,at:empNow(),change},...(latest.calendarHistory||[])];latest.calendarDays={...(latest.calendarDays||{}),[id]:days};
 const dayCount=(obj,type)=>Object.values(obj).reduce((n,items)=>n+items.filter(x=>x.type===type).reduce((sum,x)=>sum+Number(x.dayFraction??1),0),0);
 latest.openDrafts={...(latest.openDrafts||{}),[id]:{...d,hours:Number(d.hours)+change,urlaubDays:Math.max(0,Number(d.urlaubDays||0)+dayCount(days,"urlaub")-dayCount(original,"urlaub")),krankDays:Math.max(0,Number(d.krankDays||0)+dayCount(days,"krank")-dayCount(original,"krank"))}};
 payInvalidateEmployeeReply(latest,id);paySave(latest,payLog(latest,{zh:`调整 ${e.name} 工时日历，计薪工时变化 ${change}h`,de:"Kalender bearbeitet"},"Martin"));dialog.close();app();payOpenCalendar(store,month,id);});
 };render();dialog.onclose=()=>dialog.classList.remove("pay-calendar-dialog");dialog.showModal();
}
function payTravelEdit(store,month,id){
 const run=payGet(store,month);if(run.state!=="open")return;
 const dialog=document.querySelector("#pay-travel-dialog"),stored=run.travelDetails?.[id];
 let trips=JSON.parse(JSON.stringify(Array.isArray(stored)?stored:stored?[stored]:[]));
 const backup=JSON.parse(JSON.stringify(trips));
 const render=()=>{
 dialog.innerHTML=`<header class="pay-travel-head"><div><h2>编辑差旅行程 · ${empEsc(empById(id)?.name)}</h2><p>${month} · 仅作参考行程，保存后不会改动入账的差旅金额</p></div></header><form class="pay-trip-form"><div class="pay-trip-list">${trips.map((t,i)=>`<fieldset data-trip="${i}"><legend>行程 ${i+1}</legend><div class="pay-edit-grid">${[["from","出发城市","text"],["to","到达城市","text"],["back","返程城市","text"],["purpose","事由","text"],["departure","出发时间","datetime-local"],["returned","返回时间","datetime-local"],["km","总里程 km","number"],["tickets","车票 / 机票 €","number"],["hotel","酒店 €","number"],["parking","停车 €","number"],["tolls","过路费 €","number"],["other","其他 €","number"]].map(([key,label,type])=>`<label>${label}<input data-key="${key}" type="${type}" ${type==="number"?'min="0" step="0.01"':''} value="${empEsc(String(t[key]??""))}"></label>`).join("")}<label>交通方式<select data-key="transport">${[["own_car","私人汽车"],["other_motor","其他机动车"],["public","公共交通"],["flight","飞机"]].map(([v,n])=>`<option value="${v}" ${t.transport===v?'selected':''}>${n}</option>`).join("")}</select></label></div><button type="button" class="ghost-btn pay-trip-delete" data-index="${i}">删除此行程</button></fieldset>`).join("")||'<p class="pay-hint">暂无行程，点击下方新增。</p>'}</div><button type="button" class="ghost-btn pay-trip-add">＋ 新增行程</button><p class="pay-hint">按里程、票据及境内每日餐补参考规则汇总，仅作灰色参考值，不入账；入账金额只来自员工申报、老板批准。取消不会修改原记录。</p><div class="pay-acts"><button type="button" class="ghost-btn pay-trip-cancel">取消</button><button type="submit" class="primary-btn">保存行程</button></div></form>`;
 const collect=()=>dialog.querySelectorAll("[data-trip]").forEach(el=>{const t=trips[Number(el.dataset.trip)];el.querySelectorAll("[data-key]").forEach(x=>t[x.dataset.key]=x.type==="number"?Number(x.value):x.value);if(t.departure&&t.returned){t.hours=(new Date(t.returned)-new Date(t.departure))/3600000;const oldDays=t.days||[];t.days=[];let day=t.departure.slice(0,10),end=t.returned.slice(0,10);for(let limit=0;day<=end&&limit<366;limit++){const old=oldDays.find(x=>x.date===day)||{};const arrival=day===t.departure.slice(0,10),departure=day===end;const multi=t.departure.slice(0,10)!==end;t.days.push({...old,date:day,hours:multi?(arrival||departure?0:24):t.hours,overnight:multi,arrival,departure});const next=new Date(`${day}T12:00:00`);next.setDate(next.getDate()+1);day=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}-${String(next.getDate()).padStart(2,"0")}`;}}});
 dialog.querySelectorAll(".pay-trip-delete").forEach(b=>b.onclick=()=>{collect();trips.splice(Number(b.dataset.index),1);render();});
 dialog.querySelector(".pay-trip-add").onclick=()=>{collect();trips.push({from:"",to:"",transport:"own_car",km:0});render();};
 dialog.querySelector(".pay-trip-cancel").onclick=()=>{dialog.innerHTML=payTravelDrawerContent(store,month,id);bindView();};
 dialog.querySelector("form").onsubmit=ev=>{ev.preventDefault();collect();if(trips.some(t=>!t.from||!t.to||t.hours<0)){empFlash(ev.submitter,"请填写起止城市，并检查时间");return;}
 const fresh=payGet(store,month);if(fresh.state!=="open")return;const amount=Math.round(trips.reduce((n,t)=>n+payTravelBreakdown(t).total,0)*100)/100;
 fresh.travelHistory=[{id,before:backup,amount:fresh.extras?.[id]?.travel,at:empNow()},...(fresh.travelHistory||[])];fresh.travelDetails={...(fresh.travelDetails||{}),[id]:trips};fresh.travelRefAmount={...(fresh.travelRefAmount||{}),[id]:amount};payInvalidateEmployeeReply(fresh,id);paySave(fresh,payLog(fresh,{zh:`更新 ${empById(id)?.name} 差旅参考行程：${trips.length} 条，参考 €${amount.toFixed(2)}（不入账）`,de:"Reisen bearbeitet"},"Martin"));dialog.close();app();};
 };
 const bindView=()=>{dialog.querySelector(".pay-travel-close").onclick=()=>dialog.close();dialog.querySelector(".pay-travel-edit").onclick=()=>render();};render();
}
