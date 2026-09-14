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
  open:   { tone: "gray",   name: { zh: "还没封账", de: "Nicht abgeschlossen" } },
  closed: { tone: "blue",   name: { zh: "已封账", de: "Abgeschlossen" } },
  sent:   { tone: "purple", name: { zh: "已发税务师", de: "An Steuerberater" } },
  back:   { tone: "orange", name: { zh: "工资单已回", de: "Abrechnungen erhalten" } },
  paid:   { tone: "green",  name: { zh: "已发薪", de: "Ausgezahlt" } }
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
  return hit ? JSON.parse(JSON.stringify(hit)) : payBlank(store, month);
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
function payClose(store, month, by) {
  if (payBlockers(store, month).length) return { ok: false, code: "blocked" };
  const run = payGet(store, month);
  if (run.state !== "open") return { ok: false, code: "already" };
  run.snap = paySnapshot(store, month);
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
function payTolerance() { return Number(empRule("payslipToleranceEuro")) || 5; }

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

function paySepaXml(store, month) {
  const c = empEmployer(store);
  const rows = payPayable(store, month).filter(r => !r.why && !r.paid);
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
    { zh: "封账之后底层又变了（有人补了一条考勤），系统不会偷偷跟着改，而是在页面顶上单列一条，让你决定重开封账还是留到下个月更正。",
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
  const month = payMonth();
  return `
    <div class="page-head">
      <div><h1>${empT("工资与发薪", "Lohn und Auszahlung")}</h1>
      <p>${empT("封账 → 发给税务师 → 工资单跟我们算的对一遍 → SEPA 打款。工资不在这儿重算，只管外面回来的数和真正的钱。",
                "Abschluss → Steuerberater → Abrechnungen prüfen → SEPA-Zahlung. Hier wird nicht neu gerechnet.")}</p></div>
      <div class="button-row">
        <a class="ghost-btn accent-back-btn" href="#employee">${empT("返回员工助手", "Zurück: Mitarbeiter")}</a>
        <a class="ghost-btn" href="#${slug("employee", "考勤")}?v=month&m=${month}">${
          empT("这个月的工时结算", "Stunden dieses Monats")}</a>
        ${schGuide(PAY_GUIDE)}
      </div>
    </div>
    ${empScope() ? "" : `<p class="sch-scope-hint">${empT(`按门店算。现在看的是 ${store}，换一家请用顶栏的门店选择器。`,
        `Filialbezogen. Angezeigt wird ${store} — Filiale oben in der Kopfzeile wechseln.`)}</p>`}
    ${inner}`;
}

function employeePayrollPage() {
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
      ${empScope() ? "" : `<span class="att-scope">${empT(`看的是 ${store}，换一家用顶栏的门店选择器`, `Angezeigt: ${store}`)}</span>`}
    </section>

    <!-- 这儿先后删过两样东西：一条五格摘要（封账人数 / 工资单已回 / 对不上 / 已打款 /
         Netto 合计），和一条四步流程条。都是同一个毛病 —— 下面每张卡的标题就是
         「1 · 已封账」「3 · 收工资单」，走到哪一步、各自多少钱，卡片自己都写着。
         流程条里唯一别处没有的是「这四步分别要干什么」，那条搬进了右上角的使用说明。 -->
    ${payDriftPanel(store, month, drift)}
    ${payClosePanel(store, month, run)}
    ${payReached(run, "closed") ? paySendPanel(store, month, run) : ""}
    ${payReached(run, "sent") ? paySlipPanel(store, month, run) : ""}
    ${payReached(run, "sent") ? payPayPanel(store, month, run) : ""}
    ${run.log && run.log.length ? `<details class="card pay-log"><summary>${
      empT(`这个月的经过（${run.log.length} 条）`, `Verlauf (${run.log.length})`)}</summary>
      <ul>${run.log.map(l => `<li><span>${empStamp(l.at)}</span> ${empEsc(l.by || "")} · ${empText(l.what)}</li>`).join("")}</ul>
    </details>` : ""}`);
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
      <div class="pay-acts">
        <input class="pay-reopen-why" placeholder="${empT("重开的理由（会记进这个月的经过）", "Begründung für die Rücknahme")}">
        <button class="ghost-btn danger-lite pay-reopen" data-month="${month}">${empT("重开封账", "Abschluss zurücknehmen")}</button>
      </div>
    </section>`;
  }
  const bl = payBlockers(store, month);
  return `<section class="card pay-close">
    <div class="section-title">
      <div><h2>${empT("1 · 封账", "1 · Monat abschließen")}</h2>
      <p>${empT("封账就是把这个月定下来。定之前系统先查前面四步是不是都收干净了 —— 封的是一个还会变的数，发给税务师之后再变就要走更正，那是真花钱的。",
                "Abschließen heisst festschreiben. Vorher wird geprüft, ob alle Vorstufen sauber sind — ein nachträglich geänderter Wert bedeutet eine kostenpflichtige Korrektur.")}</p></div>
      ${bl.length ? empPill("red", empT(`${bl.length} 件没收干净`, `${bl.length} offen`)) : empPill("green", empT("都收干净了", "Alles bereit"))}
    </div>
    ${bl.length ? `<ul class="pay-blockers">${bl.map(x => `<li>
      <span>${empText({ zh: x.zh, de: x.de })}</span>
      <a class="ghost-btn" href="${x.href}">${empT("去处理 →", "Bearbeiten →")}</a></li>`).join("")}</ul>
      <p class="pay-hint">${empT("这四条都过了才能封账。不是为了卡你 —— 是因为封账之后这些数就固定了。",
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
    <b aria-hidden="true">PDF</b>${empEsc(slip.file)}</span>`;
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
  const rows = payPayable(store, month);
  const bl = paySepaBlockers(store, month);
  const ready = rows.filter(r => !r.why && !r.paid);
  const sum = ready.reduce((s, r) => s + r.net, 0);
  const off = payOffRows(store, month);
  return `<section class="card pay-pay">
    <div class="section-title">
      <div><h2>${empT("4 · 发薪", "4 · Auszahlung")}</h2>
      <p>${empT("净额用工资单上的数 —— 只有税务师算得出来，系统自己从来不算它。所以工资单没登记的人这里付不了。",
                "Der Nettobetrag stammt aus der Abrechnung — das System berechnet ihn nie selbst. Ohne erfasste Abrechnung ist keine Zahlung möglich.")}</p></div>
      ${empPill(ready.length ? "orange" : "green", empT(`待打款 ${ready.length}`, `${ready.length} offen`))}
    </div>

    ${off.length ? `<p class="pay-hint is-warn">${empT(
      `还有 ${off.length} 份工资单跟封账的数对不上而且没写说明（${off.map(r => r.snap.name).join("、")}）。可以照付，但那笔差额没人说得清就这么打出去了 —— 建议先在上面那张表里说明。`,
      `${off.length} unerklärte Abweichungen — Zahlung ist möglich, die Differenz bleibt aber unbegründet.`)}</p>` : ""}

    ${paySepaBox(store, month, ready, sum, bl)}

    <div class="table-scroll"><table class="table employee-table pay-table">
      <thead><tr>
        <th>${empT("员工", "Mitarbeiter")}</th><th>${empT("应付净额 Netto", "Auszahlung (Netto)")}</th>
        <th>${empT("收款账户 IBAN", "Empfängerkonto (IBAN)")}</th>
        <th>${empT("打款状态", "Zahlung")}</th><th>${empT("工资单已交本人", "Abrechnung an MA")}</th>
      </tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td><strong>${empEsc(r.name)}</strong></td>
        <td>${!r.slip ? `<span class="att-dim">${empT("工资单还没回来", "Abrechnung fehlt")}</span>`
          : r.why === "zero" ? `<span class="att-dim">€0.00</span>`
          : `<strong>€${r.net.toFixed(2)}</strong>`}</td>
        <td>${r.iban ? `<span class="pay-iban ${payIbanOk(r.iban) ? "" : "is-bad"}">${empEsc(r.iban)}</span>`
          : `<a class="pay-iban is-bad" href="${empStaffHref(r.id)}">${empT("没填 IBAN →", "IBAN fehlt →")}</a>`}</td>
        <td>${r.why === "zero" ? `<span class="att-dim">${empT("这个月没有要打的钱", "Nichts auszuzahlen")}</span>`
          : r.why ? `<span class="att-dim">—</span>`
          : `<button class="ghost-btn pay-paid ${r.paid ? "is-on" : ""}" data-id="${r.id}" data-month="${month}" data-on="${r.paid ? "" : "1"}">${
              r.paid ? empT("已打款 ✓", "Bezahlt ✓") : empT("标记已打款", "Als bezahlt markieren")}</button>`}</td>
        <td>${!r.slip ? `<span class="att-dim">—</span>`
          : run.sentToEmp[r.id] ? `<span class="pay-sent-tag">${empT("已发", "Versendet")} · ${empStamp(run.sentToEmp[r.id])}</span>`
          : `<button class="ghost-btn pay-toemp" data-id="${r.id}" data-month="${month}">${empT("标记已发给本人", "Als versendet markieren")}</button>`}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="pay-hint">${empT("员工在自己那一侧的「工时」页能看到这个月的工资单（Brutto / Netto / 打款没打款），不用等你发。",
                               "Mitarbeitende sehen ihre Abrechnung in der App unter „Stunden“.")}</p>
  </section>`;
}

/* ============================================================== 绑定 ===== */
function payGo(href) {
  const target = String(href).replace(/^#/, "");
  if (decodeURIComponent(location.hash.replace("#", "")) === decodeURIComponent(target)) app();
  else location.hash = target;
}

function payBindAll() {
  const store = payStore();

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
    <p>${empT("封账 → 发给税务师 → 工资单跟我们算的对一遍 → SEPA 打款。工资不在这儿重算，只管外面回来的数和真正的钱。",
              "Abschluss → Steuerberater → Abrechnungen prüfen → SEPA-Zahlung. Hier wird nicht neu gerechnet.")}</p>
    <div class="emp-module-mini">
      <span>${gross ? empT(`工资单合计 €${gross.toFixed(0)}`, `Abrechnungen gesamt €${gross.toFixed(0)}`)
                    : empT("这个月还没有工资单", "Noch keine Abrechnungen")}</span>
      <span>${schMonthName(month)} · ${line2}</span>
    </div>
    <span class="emp-module-cta">${empT("进入工资与发薪 →", "Zu Lohn und Auszahlung →")}</span>
  </a>`;
}
