/* ==========================================================================
   KaiSpan · 员工视角（手机端）
   --------------------------------------------------------------------------
   在 hours.js 之后、app.js 之前以 defer 加载，前缀 me。

   D5 修订（2026-09-02 Mingrong）：员工端不再是「以后另做一个产品」，
   而是**同一个 app、同一份数据、按角色分视角**。所以这里不复制任何业务逻辑 ——
   班表、报班、工时全部读 schedule.js / hours.js 已经算好的那几个函数，
   区别只在两条：

     1. 范围：员工只看得到自己。别人的班次、别人的姓名、门店合计一律不出现。
     2. 金额：只看得到自己的工时和自己的工资估算；
        看不到自己的时薪以外的任何单价，更看不到门店人工成本。
        班表页上那行「当日人工成本」是店长的工作面，员工端没有这个概念。

   形态是手机：餐饮员工就是掏手机看班表。桌面上把它居中成一条 420px 的列，
   不是为了好看，是为了别让人误以为这一页也要按桌面排版去改。
   ========================================================================== */

const ME_KEY = "kaispanViewer";   /* { empId, via: "login" | "switch" } */

function meViewer() {
  const v = empRead(ME_KEY, null);
  return v && v.empId && empById(v.empId) ? v : null;
}

function meSetViewer(empId, via) {
  if (!empId) empWrite(ME_KEY, null);
  else empWrite(ME_KEY, { empId, via: via || "switch" });
  meLangCache = { key: null, lang: null };
}

/* ============================================================ 界面语言 ====
   员工端按员工自己档案里的「沟通语言」渲染，不跟店长顶栏那个全局开关。
   理由很简单：那一栏是这个人自己选的，我们已经拿它决定给他发什么语言的通知，
   却让他自己的 app 说另一种语言 —— 一个只会德语的员工，从店长手机切过去
   看到的是一屏中文，而他明明填过「Deutsch」。

   写成「中文 / Deutsch」这种双语的不强制，跟全局走 —— 他两种都读得懂，
   这时候更该听店长手上那台设备的设置。

   empDe() 每渲染一屏要调几百次，而这里要读 localStorage + 查员工，
   所以按 hash 缓存一次；换人（meSetViewer）时手动清掉。 */
let meLangCache = { key: null, lang: null };

function meForcedLang() {
  if (typeof state !== "function") return null;
  const route = state().route || "";
  if (route !== "me" && !route.startsWith("me-")) return null;
  const key = location.hash;
  if (meLangCache.key === key) return meLangCache.lang;
  const e = meEmp();
  const raw = e && e.contact ? String(e.contact.language || "") : "";
  const lang = /^Deutsch/.test(raw) ? "de" : raw === "中文" ? "zh" : null;
  meLangCache = { key, lang };
  return lang;
}

function meEmp() {
  const v = meViewer();
  return v ? empById(v.empId) : null;
}

/* 只有「店长自己切过来看」这一种身份能切回去。
   报班链接进来的、自己登录进来的，都是员工本人 —— 员工端上不该有一个「店长视角」按钮，
   那是把老板的门开在员工的手机上。 */
function meCanExit() {
  return meViewer()?.via === "switch";
}

function meTab() {
  const route = state().route;
  const name = route.startsWith("me-") ? decodeURIComponent(route.slice(3)) : "";
  /* 「填表」不是一个 tab，是从「等你处理」点进来的一页 —— 底下四个 tab 里没有它，
     但它必须留在员工这个壳里。走 #store-HACCP填写 会把人扔进店长的整套界面。 */
  return ["班表", "报班", "工时", "我的", "填表"].includes(name) ? name : "班表";
}

function meHref(tab, patch) {
  const p = new URLSearchParams();
  Object.keys(patch || {}).forEach(k => { if (patch[k] != null && patch[k] !== "") p.set(k, patch[k]); });
  const q = p.toString();
  return `#me-${encodeURIComponent(tab)}${q ? `?${q}` : ""}`;
}

function meWeek() {
  const w = state().params.get("w") || "";
  return /^\d{4}-W\d{2}$/.test(w) ? w : schThisWeek();
}

/* 该报还没报的那一周：先看下周（多数时候是它），再看本周。
   班表已经发布、或者截止时间过了，就不用再催他 —— 那时候报了也没用。 */
function meOpenAvailWeek(e) {
  if (!e || !schNeedsAvailability(e)) return null;
  const weeks = [schWeekAdd(schThisWeek(), 1), schThisWeek()];
  /* 过了截止时间也照样提醒他：那一周的班表还没发布，店长还在等这个人的时间，
     甚至还在「催」他。这时候把员工端的提醒收掉，等于两边说的不是一件事。
     真正关门的是发布。 */
  return weeks.find(w => !schAvail(e.id, w)
    && schRoster(e.store, w).state !== "published") || null;
}

/* 报班页的默认周：本周已经发布就没什么可报的了，直接落到下周。
   不然员工点「报班」进来看到的是一张灰掉的表单，还得自己想到去点「下周」。 */
function meAvailWeek(e) {
  const w = state().params.get("w") || "";
  if (/^\d{4}-W\d{2}$/.test(w)) return w;
  const now = schThisWeek();
  return schRoster(e.store, now).state === "published" ? schWeekAdd(now, 1) : now;
}

/* ============================================================== 外壳 ====== */
function meShell(inner) {
  const e = meEmp();
  const tab = meTab();
  /* [路由键, 中文标签, 德语标签, 图标]。标签和路由键分开：第一个 tab 的路由一直叫
     「班表」（链接和测试都在用），但它显示的是「今天」——
     一个上班的人掏手机问的是今天要不要打卡、下一个班什么时候，不是要看一张表。
     叫「班表」的时候，那一页前三分之二讲的是打卡和待办，名字和内容对不上。 */
  const tabs = [
    ["班表", "今天", "Heute", "▤"],
    ["报班", "报班", "Zeiten", "✓"],
    ["工时", "工时", "Stunden", "Σ"],
    ["我的", "我的", "Meins", "☰"]
  ];
  /* 有要他补的东西就在「我的」上点个红点 —— 员工不会主动去翻这一页 */
  const todo = e && empHasRequest(e) && e.request.state === "sent" ? empRequestProgress(e).missing.length : 0;
  /* 报班同理：该报还没报，「报班」那一格上点个点，不用他自己记着每周去看 */
  const availDue = e && meOpenAvailWeek(e) ? 1 : 0;
  return `<div class="me-app" data-no-translate>
    <div class="me-phone">
      <header class="me-top">
        <div><span>KaiSpan</span><strong>${empEsc(e ? e.name : "")}</strong>
          <small>${empEsc(e ? e.store : "")}${e ? ` · ${empRaw(empRole(e.role).name)}` : ""}</small></div>
        ${meCanExit() ? `<a class="me-exit" href="#${slug("employee", "排班管理")}">${empT("店长视角", "Leitung")}</a>` : ""}
      </header>
      <main class="me-body">${inner}</main>
      <nav class="me-tabs">
        ${tabs.map(t => `<a class="${tab === t[0] ? "is-on" : ""}" href="${meHref(t[0])}">
          <i>${t[3]}${t[0] === "我的" && todo ? `<b class="me-dot">${todo}</b>` : ""}${
            t[0] === "报班" && availDue ? `<b class="me-dot is-plain"></b>` : ""}</i><span>${empT(t[1], t[2])}</span></a>`).join("")}
      </nav>
    </div>
  </div>`;
}

/* 没有身份的时候：登录。
   员工现在有自己的账号了（建档通过时开的，用户名就是他的邮箱），所以这一页是登录页，
   不再是「先选一个人」。演示用的选人入口收进下面那个折叠里 —— 它是演示脚手架，
   不该占着一个真产品里根本不存在的位置。 */
let meLoginMsg = "";

function meLoginPage() {
  const list = empAllStaff().filter(e => !empStatus(e.status).leaving);
  const demo = list.find(e => e.account);
  return `<div class="me-app" data-no-translate><div class="me-phone">
    <header class="me-top"><div><span>KaiSpan</span><strong>${empT("员工端", "Mitarbeiter-App")}</strong>
      <small>${empT("班表 · 报班 · 工时 · 要补的材料", "Plan · Zeiten · Stunden · Unterlagen")}</small></div>
      <a class="me-exit" href="#${slug("employee", "排班管理")}">${empT("店长视角", "Leitung")}</a></header>
    <main class="me-body">
      <section class="me-login">
        <h2>${empT("登录", "Anmelden")}</h2>
        <label><span>${empT("用户名（你的邮箱）", "Benutzername (Ihre E-Mail)")}</span>
          <input type="email" class="me-login-user" autocomplete="username" value="${empEsc(demo ? demo.account.user : "")}"></label>
        <label><span>${empT("密码", "Passwort")}</span>
          <input type="password" class="me-login-pass" autocomplete="current-password"></label>
        ${meLoginMsg ? `<p class="me-login-msg">${empEsc(meLoginMsg)}</p>` : ""}
        <button class="primary-btn me-login-btn">${empT("登录", "Anmelden")}</button>
        <p class="me-note">${empT("账号是店长在你入职通过时开的，初始密码在那封邮件里。忘了就找店长重置。",
                                  "Der Zugang wird bei der Freigabe Ihrer Unterlagen angelegt; das Startpasswort steht in der E-Mail. Bei Verlust die Leitung um Zurücksetzen bitten.")}</p>
      </section>
      <details class="me-demo">
        <summary>${empT("演示：直接以某个人的身份进去", "Demo: als Person öffnen")}</summary>
        <p class="me-note">${empT("这个原型没有后端，密码是明文存在浏览器里的。下面这个入口只为了演示方便。",
                                  "Prototyp ohne Backend: Passwörter liegen im Klartext im Browser. Dieser Zugang dient nur der Demo.")}</p>
        <div class="me-picklist">${list.map(e => `<a class="me-pick" href="#me?id=${encodeURIComponent(e.id)}">
          <strong>${empEsc(e.name)}</strong>
          <span>${empText(empRole(e.role).name)} · ${empText(empContractType(e.contract?.type).name)} · ${empEsc(e.store)}</span></a>`).join("")}</div>
      </details>
    </main>
  </div></div>`;
}

/* ============================================================== 我的 ====== */
/* 两件事：店里要我补的材料（原来靠邮件，现在就在这儿办完），和我的账号。 */
function meMineView(e) {
  const req = empHasRequest(e) ? e.request : null;
  const pr = req ? empRequestProgress(e) : null;
  const acc = e.account;
  return `
    ${req && req.state === "sent" ? `<section class="me-topup">
      <h3>${empT(`店里要你补 ${pr.total} 项`, `${pr.total} Unterlagen angefordert`)}</h3>
      <p class="me-note">${empT("传完点提交，店里核对一下就归档，不用再跑一趟。", "Nach dem Absenden prüft der Betrieb kurz und legt alles ab.")}</p>
      ${req.note ? `<div class="emp-returned"><strong>${empT("店里的退回说明", "Hinweis der Leitung")}</strong><p>${empEsc(req.note)}</p></div>` : ""}
      ${empTopupForm(e, req.token)}
    </section>` : ""}
    ${req && req.state === "submitted" ? `<section class="me-topup is-done">
      <h3>${empT("交了，等店里核对", "Abgegeben — wird geprüft")}</h3>
      <p class="me-note">${empT(`${empStamp(req.submittedAt)} 提交。有问题店里会再发给你。`, `Abgegeben ${empStamp(req.submittedAt)}. Bei Rückfragen meldet sich der Betrieb.`)}</p>
      <button class="ghost-btn emp-topup-edit" data-token="${empEsc(req.token)}">${empT("我还要改一下", "Noch etwas ändern")}</button>
    </section>` : ""}
    ${!req ? `<p class="me-note me-topup-none">${empT("店里没有要你补的材料。需要什么会推到这里，不再单独发邮件。",
      "Es liegt keine Anforderung vor. Bei Bedarf erscheint sie hier — keine separate E-Mail mehr.")}</p>` : ""}

    ${meContractCard(e)}
    ${meDocsCard(e)}

    <section class="me-account">
      <h3>${empT("我的账号", "Mein Zugang")}</h3>
      <div class="me-account-row"><span>${empT("用户名", "Benutzername")}</span><strong>${empEsc(acc ? acc.user : e.contact.email || "—")}</strong></div>
      ${acc ? `<div class="me-account-row"><span>${empT("密码", "Passwort")}</span>
        <strong>${acc.temp ? empT("还是店里给的初始密码", "noch das Startpasswort") : empT("你自己设的", "selbst gesetzt")}</strong></div>
      ${/* 2026-09-04：改密码原来常驻展开，是整页唯一的主按钮 —— 一年用一次的东西
            不该长期占着这个位置。初始密码还没改过的人例外：那一条该催，所以默认展开。 */""}
      <details class="me-pass-new-box" ${acc.temp ? "open" : ""}>
        <summary>${acc.temp ? empT("改掉初始密码", "Startpasswort ändern") : empT("改密码", "Passwort ändern")}</summary>
        <div class="me-pass">
          <label><span>${empT("当前密码", "Aktuelles Passwort")}</span><input type="password" class="me-pass-old" autocomplete="current-password"></label>
          <label><span>${empT("新密码（至少 6 位）", "Neues Passwort (min. 6 Zeichen)")}</span><input type="password" class="me-pass-new" autocomplete="new-password"></label>
          <button class="primary-btn me-pass-save" data-emp="${empEsc(e.id)}">${empT("改密码", "Passwort ändern")}</button>
        </div>
      </details>` : `<p class="me-note">${empT("你还没有账号，这是店长切过来看的视角。", "Kein eigener Zugang — dies ist die Ansicht der Leitung.")}</p>`}
      ${/* 2026-09-04：这一栏原来只有店长在员工档案里改得了，员工自己看不见也改不了，
            而它决定的正是他自己这个 app 说什么语言。谁用谁改。 */""}
      <div class="me-account-row me-lang-row">
        <span>${empT("界面语言", "Sprache der App")}</span>
        <select class="me-lang" data-emp="${empEsc(e.id)}">${empLangOptions().map(o =>
          `<option value="${empEsc(o[0])}"${o[0] === (e.contact.language || "") ? " selected" : ""}>${empEsc(o[1])}</option>`).join("")}</select>
      </div>
      <p class="me-note">${empT("选单一语言就固定用那一种；选双语的跟着设备设置走。",
                               "Eine Sprache = fest; zweisprachig folgt der Geräteeinstellung.")}</p>
      ${meCanExit() ? "" : `<button class="ghost-btn me-logout">${empT("退出登录", "Abmelden")}</button>`}
    </section>`;
}

/* 2026-09-04（Mingrong：优化员工端界面）——「我的」这一页原来只有两张卡，
   下面六成是空白，而员工问店长最多的两件事恰恰都不在这儿：
   「我合同是多少小时、时薪多少、年假几天」和「我哪张证件什么时候到期」。
   这些数店长那边全都有，只是从来没往员工这一侧露出来，于是每次都要开口问。
   两张卡都是只读的：改合同是店长的事，这里只回答「我的是什么」。 */
function meContractCard(e) {
  const c = e.contract || {};
  const type = empContractType(c.type);
  const hourly = c.payType !== "pauschal";
  const bal = typeof lvBalance === "function" ? lvBalance(e.store, e, lvYear()) : null;
  const kv = (label, value) => value ? `<div class="me-account-row"><span>${label}</span><strong>${value}</strong></div>` : "";
  return `<section class="me-account">
    <h3>${empT("我的合同", "Mein Vertrag")}</h3>
    ${kv(empT("合同类型", "Vertragsart"), empText(type.name))}
    ${kv(empT("岗位", "Position"), `${empText(empRole(e.role).name)} · ${empText(empLevel(e.level).name)}`)}
    ${kv(empT("薪资", "Vergütung"), hourly ? `€${Number(c.rate).toFixed(2)} / ${empT("小时", "Stunde")}`
                                           : empT(`€${Number(c.rate).toFixed(2)} / 月（固定）`, `€${Number(c.rate).toFixed(2)} / Monat (fest)`))}
    ${kv(empT("月工时", "Monatsstunden"), c.hoursMin || c.hoursMax
      ? (c.hoursMin === c.hoursMax ? `${c.hoursMax}h` : `${c.hoursMin}\u2013${c.hoursMax}h`) : "")}
    ${bal ? kv(empT(`${lvYear()} 年假`, `Urlaub ${lvYear()}`),
      empT(`还剩 ${lvD(bal.left)} / ${lvD(bal.days)} 天`, `${lvD(bal.left)} von ${lvD(bal.days)} Tagen`)) : ""}
    ${kv(empT("入职", "Eintritt"), e.entryDate ? empFormatDate(e.entryDate) : "")}
    ${c.befristetUntil ? kv(empT("合同到期", "Befristet bis"), empFormatDate(c.befristetUntil)) : ""}
    <p class="me-note">${empT("合同条件要改得跟店长谈，这里只是给你查。",
                             "Vertragsdaten nur zur Ansicht — Änderungen bitte mit der Leitung besprechen.")}</p>
  </section>`;
}

function meDocsCard(e) {
  const today = empToday();
  const rows = EMP_DOC_TYPES
    .map(t => ({ t, s: empDocState(e, t.id, today) }))
    .filter(x => x.s.level !== "na");
  if (!rows.length) return "";
  const tone = lv => ({ missing: "red", expired: "red", warn: "orange", soon: "blue" })[lv] || "green";
  const word = x => x.s.level === "missing" ? empT("还没交", "fehlt")
    : x.s.days == null ? empT("已归档", "abgelegt")
    : x.s.days < 0 ? empT(`过期 ${-x.s.days} 天`, `seit ${-x.s.days} T. abgelaufen`)
    : empT(`还有 ${x.s.days} 天`, `noch ${x.s.days} T.`);
  const bad = rows.filter(x => ["missing", "expired", "warn"].includes(x.s.level));
  return `<section class="me-account">
    <h3>${empT("我的证件", "Meine Unterlagen")}</h3>
    ${rows.map(x => `<div class="me-account-row">
      <span>${empText(x.t.name)}</span>
      ${empPill(tone(x.s.level), word(x))}</div>`).join("")}
    <p class="me-note">${bad.length
      ? empT("红的和橙的那几项要你自己去办（续证、体检），办好交给店长归档。",
             "Die rot und orange markierten Punkte musst du selbst erledigen und danach abgeben.")
      : empT("都齐了，没有要你办的。到期前会提前提醒你。",
             "Alles vollständig. Vor Ablauf wirst du rechtzeitig erinnert.")}</p>
  </section>`;
}

function employeeMePage() {
  const e = meEmp();
  if (!e) return meLoginPage();
  /* 离职之后账号就不认了。人还在页面上开着的，下一次渲染直接踢回登录页。 */
  if (meViewer()?.via === "login" && !empAccountActive(e)) { meSetViewer(null); return meLoginPage(); }
  const tab = meTab();
  if (tab === "填表") return meShell(meFormView(e));
  if (tab === "报班") return meShell(meAvailabilityView(e) + (typeof meLeaveSection === "function" ? meLeaveSection(e) : ""));
  if (tab === "工时") return meShell(meHoursView(e));
  if (tab === "我的") return meShell(meMineView(e));
  return meShell(meScheduleView(e));
}

/* ======================================================= 派到手的那张表 ==
   店长在 HACCP 主页把当天的表派给那天班上的人。点进来的是同一张填表页
   （haccpFillPage 那一段原样复用，不另抄一份），只是套在员工这个壳里 ——
   走 #store-HACCP填写 会把员工扔进店长的整套界面：左侧导航、门店切换、全部记录。 */
function meFormView(e) {
  if (typeof haccpFillPage !== "function") {
    return `<section class="me-days-none"><strong>${empT("这张表打不开", "Formular nicht verfügbar")}</strong></section>`;
  }
  const tid = state().params.get("t") || "";
  const date = state().params.get("d") || empToday();
  /* 只让他打开真派给他的那一张。别人的表、别的日子的表，从这儿进不去 ——
     员工端的可见性边界跟工时、工资那几页是同一条。 */
  const mine = typeof haccpMineFor === "function" ? haccpMineFor(e.store, e.id, date) : [];
  const ok = mine.some(x => x.template.id === tid);
  if (!ok) {
    return `<section class="me-days-none">
      <strong>${empT("这张表不在你名下", "Nicht dir zugewiesen")}</strong>
      <p>${empT("可能已经有人填过了，或者店长把它派给了别人。",
                "Es wurde bereits erfasst oder jemand anderem zugewiesen.")}</p>
      <a class="ghost-btn" href="${meHref("班表")}">${empT("回今天", "Zurück zu Heute")}</a>
    </section>`;
  }
  return `<div class="me-form">
    <a class="me-form-back" href="${meHref("班表")}">${empT("‹ 回今天", "‹ Zurück")}</a>
    ${haccpFillPage()}
  </div>`;
}

/* ============================================================ 我的班表 ==== */
/* 员工掏手机最想知道的一句话：我下一个班是什么时候。放在最上面，别让他自己去表里找。 */
function meNextShift(e) {
  const today = empToday();
  for (let i = 0; i < 3; i += 1) {
    const week = schWeekAdd(schThisWeek(), i);
    const roster = schRoster(e.store, week);
    if (roster.state !== "published") continue;
    /* 已经上完的班不算「下一个班」。只按日期过滤的话，晚上八点打开还在说
       「下一个班 今天 10:00–18:00」，而上面那张打卡卡片已经写着今天打完卡了 ——
       同一屏两句话互相打脸。 */
    const nowMin = typeof attNowMin === "function" ? attNowMin() : 0;
    const hit = roster.shifts
      .filter(s => s.empId === e.id
        && (s.date > today || (s.date === today && schEndMin(s.start, s.end) > nowMin)))
      .sort((a, b) => a.date.localeCompare(b.date) || schMin(a.start) - schMin(b.start))[0];
    if (hit) return hit;
  }
  return null;
}

/* 2026-09-04（Mingrong：这个本周下周不太直观，能不能加上日期）——
   原来两个 tab 上只有「本周」「下周」，日期另挂在右边一个灰角落里，
   而且只写当前选中那一周的 —— 于是「下周」到底是哪几天，得先点进去才知道。
   现在日期写进各自的标签里：不用点就看得出这两个按钮各代表哪一段。 */
function meWeekTabs(tab, week, right) {
  const short = d => d.slice(5).replace("-", ".");
  const range = w => { const d = schWeekDays(w); return `${short(d[0])}–${short(d[6])}`; };
  const now = schThisWeek();
  const next = schWeekAdd(now, 1);
  const one = (w, name) => `<a class="${week === w ? "is-on" : ""}" href="${meHref(tab, { w })}">
    <b>${name}</b><i>${range(w)}</i></a>`;
  return `<section class="me-weekbar">
    ${one(now, empT("本周", "Diese Woche"))}
    ${one(next, empT("下周", "Nächste"))}
    ${right || ""}
  </section>`;
}

function meDayLabel(date) {
  const today = empToday();
  if (date === today) return empT("今天", "Heute");
  if (date === empShiftDate(today, 1)) return empT("明天", "Morgen");
  return `${schDowName(schDow(date))}`;
}

/* 证件到期是员工自己该管的事（健康证要去续），所以提醒放在他这一侧，
   不只是店长那边红一下。只显示他自己的。 */
function meDocAlerts(e) {
  const today = empToday();
  return EMP_DOC_TYPES
    .map(t => ({ t, s: empDocState(e, t.id, today) }))
    .filter(x => ["expired", "warn", "missing"].includes(x.s.level) && (x.t.expiry || x.s.level === "missing"));
}

/* 2026-09-04（Mingrong：首页也不知道啥意思）——
   原来这一屏是七块卡片竖着堆，轻重一样、没有小标题：提醒条、打卡、下一个班、
   证件提醒、周切换、七天、一句说明。每一块单看都对，合起来读不出这是干什么的一页。
   而且这个 tab 叫「班表」，可它前三分之二讲的是打卡和待办 —— 名字承诺的是一张表，
   给的是一块仪表盘，第一眼当然对不上。

   重做成一天里真实的顺序，三段，每段有标题：
     现在   —— 这一刻要不要动手（打卡）。班上到一半的时候，这是全屏唯一重要的东西。
     等你处理 —— 报班没交、材料没补、证件要续，原来散在三处，现在一处一行。
     接下来 —— 下一个班是什么时候，再往下才是这一周怎么排的。
   tab 也跟着改叫「今天」：一个上班的人掏手机问的是今天，不是一张表。 */
function meScheduleView(e) {
  const week = meWeek();
  const roster = schRoster(e.store, week);
  const days = schWeekDays(week);
  const own = roster.shifts.filter(s => s.empId === e.id);
  const net = own.reduce((sum, s) => sum + schHours(s).net, 0);
  const next = meNextShift(e);
  const published = roster.state === "published";
  const docs = meDocAlerts(e);
  const req = empHasRequest(e) && e.request.state === "sent" ? e.request : null;
  const openWeek = meOpenAvailWeek(e);
  /* 上面「现在」那张卡已经在讲今天这个班了，「下一个班」就别再说一遍。
     今天还有第二个班的话它照样出现 —— 那确实是下一个，不是同一个。 */
  const focused = mePunchFocus(e).shift;
  const showNext = next && !(focused && focused.id === next.id);

  /* 三处提醒收成一张清单。原来它们一条在最上面、一条在中间、一条夹在
     「下一个班」下面 —— 同一类东西（有人在等你做点什么）散在三个高度上，
     人就只会读到最上面那条。 */
  const todos = [];
  if (openWeek) todos.push({
    href: meHref("报班", { w: openWeek }),
    what: openWeek === schWeekAdd(schThisWeek(), 1)
      ? empT("报下周能上的时间", "Zeiten für nächste Woche melden")
      : empT("报这周能上的时间", "Zeiten für diese Woche melden"),
    why: empT(`截止 ${String(schInviteDeadline(openWeek)).replace("T", " ")}，报了店长才排得上你`,
              `Frist ${String(schInviteDeadline(openWeek)).replace("T", " ")} — ohne Meldung keine Einplanung`),
    level: "warn"
  });
  if (req) todos.push({
    href: meHref("我的"),
    what: empT(`补 ${empRequestProgress(e).missing.length} 项材料`,
               `${empRequestProgress(e).missing.length} Unterlagen nachreichen`),
    why: empEsc(req.items.map(empItemName).join("、")),
    level: "warn"
  });
  /* 2026-09-04（Mingrong：当日的 HACCP 可以推给当日的上班员工么，员工界面会出现）——
     店长在 HACCP 主页把当天的表派给那天班上的人，派到谁头上就出现在谁这儿。
     填完了自动消失（判据是那天有没有记录，不是另存一个「做完了」的勾）。
     入口就用「等你处理」这一条 —— 这一段的定义本来就是「有人在等你做点什么」，
     为它单开第五个 tab 是错的：这是一天里的一件事，不是一个常驻的地方。 */
  if (typeof haccpMineFor === "function") {
    haccpMineFor(e.store, e.id, empToday()).forEach(x => todos.push({
      href: meHref("填表", { t: x.template.id, d: x.date }),
      what: empT(`填「${empEsc(empRaw(x.template.name))}」`, `„${empEsc(empRaw(x.template.name))}“ ausfüllen`),
      why: empT(`店长派给你的 · ${(x.template.columns || []).length} 项`,
                `Von der Leitung zugewiesen · ${(x.template.columns || []).length} Felder`),
      level: "warn"
    }));
  }

  docs.forEach(d => todos.push({
    href: meHref("我的"),
    what: empText(d.t.name),
    why: d.s.level === "missing" ? empT("还没交给店长", "noch nicht abgegeben")
      : d.s.days < 0 ? empT(`已经过期 ${-d.s.days} 天，先去续`, `seit ${-d.s.days} Tagen abgelaufen`)
      : empT(`还有 ${d.s.days} 天到期，记得去续`, `läuft in ${d.s.days} Tagen ab`),
    level: d.s.level === "warn" ? "warn" : "bad"
  }));

  return `
    <h2 class="me-h">${empT("现在", "Jetzt")}</h2>
    ${typeof mePunchCard === "function" ? mePunchCard(e) : ""}

    ${todos.length ? `<h2 class="me-h">${empT("等你处理", "Zu erledigen")}
      <b>${todos.length}</b></h2>
    <section class="me-todos">${todos.map(t => `<a class="me-todo is-${t.level}" href="${t.href}">
      <span><strong>${t.what}</strong><small>${t.why}</small></span><i aria-hidden="true">›</i></a>`).join("")}</section>` : ""}

    <h2 class="me-h">${empT("接下来", "Als Nächstes")}</h2>
    ${showNext ? `<section class="me-next">
      <span>${empT("下一个班", "Nächste Schicht")}</span>
      <strong>${meDayLabel(next.date)} ${next.start}–${next.end}</strong>
      <small>${empFormatDate(next.date)} · ${empT(`计 ${schH(schHours(next).net)}`, `${schH(schHours(next).net)} netto`)}</small>
    </section>` : ""}

    ${meWeekTabs("班表", week)}

    ${published ? `${own.length ? `<section class="me-days">
      ${days.map(date => {
        const list = own.filter(s => s.date === date).sort((a, b) => schMin(a.start) - schMin(b.start));
        return `<div class="me-day ${list.length ? "" : "is-off"} ${date === empToday() ? "is-today" : ""}">
          <span class="me-day-when"><b>${schDowName(schDow(date))}</b><i>${date.slice(5).replace("-", ".")}</i></span>
          <span class="me-day-what">${list.length
            ? list.map(s => `<em>${s.start}–${s.end}</em>`).join("")
            : `<u>${empT("休息", "frei")}</u>`}</span>
          ${list.length ? `<span class="me-day-h">${schH(list.reduce((x, s) => x + schHours(s).net, 0))}</span>` : ""}
        </div>`;
      }).join("")}
      <div class="me-days-sum">${empT(`这周 ${own.length} 个班 · 计 ${schH(net)}`, `${own.length} Schichten · ${schH(net)}`)}</div>
    </section>

    <p class="me-note">${empT("这周的班就是照你报的时间排的。有来不了的，直接跟店长说一声。",
      "Der Plan folgt deinen gemeldeten Zeiten. Wenn etwas nicht passt, sag der Leitung kurz Bescheid.")}</p>`
    /* 整周一个班都没有的时候，原来照样摆七行一模一样的「休息」—— 半屏手机屏幕，
       七遍同一个字。现在就说那一句，为什么没班也一并说了，那才是他真正想问的。 */
    : `<section class="me-days-none">
      <strong>${empT("这周没有你的班", "Diese Woche keine Schichten")}</strong>
      <p>${schAvail(e.id, week)
        ? empT("班表已经发布了，这一周没排到你。下一周的时间记得报。",
               "Der Plan ist freigegeben — diese Woche ohne dich. Denk an die Zeiten für nächste Woche.")
        : empT("这一周你没报可上时间，所以排不上。下一周记得先报。",
               "Für diese Woche hast du keine Zeiten gemeldet und wurdest deshalb nicht eingeplant.")}</p>
      <details><summary>${empT("还是看看这七天", "Die sieben Tage ansehen")}</summary>
        <div class="me-days">${days.map(date => `<div class="me-day is-off ${date === empToday() ? "is-today" : ""}">
          <span class="me-day-when"><b>${schDowName(schDow(date))}</b><i>${date.slice(5).replace("-", ".")}</i></span>
          <span class="me-day-what"><u>${empT("休息", "frei")}</u></span>
        </div>`).join("")}</div>
      </details>
    </section>`}` : `<section class="me-wait">
      <strong>${empT("店长还在排这一周", "Die Leitung plant noch")}</strong>
      <p>${empT("发布之后你会在这里看到自己的班。先去「报班」把能来的时间交了。",
                "Nach der Freigabe stehen deine Schichten hier. Bitte zuerst die Verfügbarkeit melden.")}</p>
      <a class="primary-btn" href="${meHref("报班", { w: week })}">${empT("去报可上时间", "Verfügbarkeit melden")}</a>
    </section>`}`;
}


/* ============================================================== 打卡 ======
   员工掏手机的第一个动作。放在班表页最上面，不单开一个 tab ——
   一天里只有上工和收工两次要点它，为它占一个常驻 tab 不值当。

   定位：点下去先取一次位置，再写记录。取不到照样能打卡，只是那条记录上
   写明「没取到定位」，店长那边会看到。挡在这里不让人打卡是更糟的做法 ——
   人已经在店里了，系统拒绝记录只会让他去找店长手工补，等于没做。 */
/* 上一次打卡的结果。被拦下时要在页面上说清楚差多少米，
   而这个信息只有那一次调用知道 —— 重渲染之后记录里查不到（因为压根没写成打卡）。 */
let mePunchMsg = null;

/* 打卡卡片这一刻讲的是哪个班。抽出来是因为「现在」和「接下来」都要用它：
   不共用的话，今天那个还没打卡的班会被说两遍 —— 上面一个「今天 10:00–18:00」，
   紧接着一个「下一个班 今天 10:00–18:00」，同一件事占两块屏幕。 */
function mePunchFocus(e) {
  const today = empToday();
  const rows = (typeof attRangePairs === "function"
    ? attRangePairs(e.store, today, today, e.id).map(p => attRow(p, today)) : []);
  const open = rows.find(r => r.rec && r.rec.in && !r.rec.out);
  /* 「还没打上卡」不等于「没有记录」：被拦下的尝试和补签请求会先建出一条空记录来。
     只判 !r.rec 的话，被拦下一次之后这张卡就变成「今天没有你的班」—— 班明明还在。 */
  const todo = rows.find(r => r.shift && (!r.rec || (!r.rec.in && !r.rec.out)));
  const doneRows = rows.filter(r => r.rec && r.rec.out);
  const focus = open || todo || null;
  return { rows, open, todo, doneRows, shift: focus && focus.shift ? focus.shift : null };
}

function mePunchCard(e) {
  const today = empToday();
  const { rows, open, todo, doneRows } = mePunchFocus(e);
  const site = typeof attSite === "function" ? attSite(e.store) : null;
  const radius = typeof attRadius === "function" ? attRadius() : 0;
  const btn = (kind, label) => `<button class="primary-btn me-punch-btn" data-kind="${kind}"
      data-emp="${e.id}" data-store="${empEsc(e.store)}">${label}</button>`;

  let body;
  if (open) {
    const since = attNowMin() - attNear(schMin(open.rec.in.at), attNowMin());
    body = `<div class="me-punch-state is-on">
        <span>${empT("已打上班卡", "Kommen erfasst")}</span>
        <strong>${open.rec.in.at}</strong>
        <small>${empT(`到现在 ${Math.max(0, Math.floor(since / 60))} 小时 ${Math.max(0, since % 60)} 分`,
                      `seit ${Math.max(0, Math.floor(since / 60))} h ${Math.max(0, since % 60)} min`)}${
          open.shift ? empT(` · 班表排到 ${open.shift.end}`, ` · Plan bis ${open.shift.end}`) : ""}</small>
      </div>
      ${btn("out", empT("下班打卡", "Gehen erfassen"))}`;
  } else if (todo) {
    const lateBy = attNowMin() - schMin(todo.shift.start);
    body = `<div class="me-punch-state">
        <span>${empT("今天的班", "Heute")}</span>
        <strong>${todo.shift.start}–${todo.shift.end}</strong>
        <small>${lateBy > (typeof attGrace === "function" ? attGrace() : 5)
          ? empT(`已经过了上班时间 ${lateBy} 分钟`, `${lateBy} Minuten nach Schichtbeginn`)
          : empT(`计 ${schH(todo.plan)}`, `${schH(todo.plan)} netto`)}</small>
      </div>
      ${btn("in", empT("上班打卡", "Kommen erfassen"))}`;
  } else if (doneRows.length) {
    const r = doneRows[doneRows.length - 1];
    body = `<div class="me-punch-state is-done">
        <span>${empT("今天已经打完卡", "Heute erfasst")}</span>
        <strong>${r.rec.in.at} – ${r.rec.out.at}</strong>
        <small>${empT(`计 ${schH(r.payable)}`, `${schH(r.payable)} netto`)}</small>
      </div>
      <button class="ghost-btn me-punch-btn" data-kind="in" data-emp="${e.id}" data-store="${empEsc(e.store)}"
        >${empT("又来上班了？再打一次", "Nochmal Kommen erfassen")}</button>`;
  } else {
    /* 2026-09-04：这一支原来也给了一个满屏宽的紫色主按钮「没排班也要打卡」。
       主按钮是「这一屏你该做的那件事」，可今天没你的班，你该做的事就是没有事。
       临时顶班一年几次，让它当整屏最重的东西，等于天天冲人喊一件几乎不会发生的事。
       降成次要按钮：要用的时候它在，不用的时候它不喊。 */
    body = `<div class="me-punch-state is-quiet">
        <span>${empT("今天", "Heute")}</span>
        <strong>${empT("今天没有你的班", "Heute keine Schicht")}</strong>
        <small>${empT("临时被叫来顶班的话在这儿打卡，店长那边会看到是没排班的。",
                      "Bei kurzfristigem Einspringen hier erfassen — die Leitung sieht, dass keine Schicht geplant war.")}</small>
      </div>
      <button class="ghost-btn me-punch-btn" data-kind="in" data-emp="${e.id}" data-store="${empEsc(e.store)}"
        >${empT("临时顶班，打卡", "Trotzdem erfassen")}</button>`;
  }

  const asked = rows.some(r => r.rec && r.rec.helpAsk);
  const blocked = mePunchMsg && mePunchMsg.code === "far" && Date.now() - mePunchMsg.t < 120000;
  const issues = rows.flatMap(r => r.issues).filter(i => i.level === "bad" && i.code !== "helpask" && i.code !== "farblock");
  return `<section class="me-punch ${blocked ? "is-blocked" : ""}">
    ${body}
    ${blocked ? `<div class="me-punch-far">
      <strong>${empT(`打不了卡：你离门店 ${mePunchMsg.dist} 米，允许范围是 ${mePunchMsg.radius} 米`,
                     `Erfassung nicht möglich: ${mePunchMsg.dist} m entfernt, zulässig sind ${mePunchMsg.radius} m`)}</strong>
      <p>${empT("走近一点再试一次。如果你确实在店里（后院、地下室、信号差），点下面告诉店长，他会补签 —— 这次尝试和距离已经记下来了。",
                "Bitte näher an die Filiale und erneut versuchen. Wenn du wirklich vor Ort bist (Hinterhof, Keller, schlechter Empfang), bitte unten die Leitung um Nacherfassung — Versuch und Entfernung sind protokolliert.")}</p>
      <input class="me-punch-why" placeholder="${empT("说一句在哪儿（可不填）", "Wo bist du? (optional)")}">
      <button class="ghost-btn me-punch-ask" data-emp="${e.id}" data-store="${empEsc(e.store)}">${
        empT("我在店里，请店长补签", "Um Nacherfassung bitten")}</button>
    </div>` : ""}
    ${asked && !blocked ? `<p class="me-punch-issue">${empT("已经告诉店长了，等他补签这个班。",
      "Die Leitung wurde informiert und erfasst die Schicht nach.")}</p>` : ""}
    ${issues.length ? `<p class="me-punch-issue">${issues.map(i => empText({ zh: i.zh, de: i.de })).join(" · ")}${
      empT("。店长会处理这条，处理完才算工时。", " — die Leitung bearbeitet das.")}</p>` : ""}
    <p class="me-punch-geo">${site
      ? empT(`打卡要在门店 ${radius} 米以内，超出打不了。定位取不到的时候（室内、没给权限）照样能打，记录上会写明。`,
             `Erfassung nur innerhalb von ${radius} m um die Filiale. Ohne verfügbaren Standort wird trotzdem erfasst und vermerkt.`)
      : empT("这家店还没设打卡位置，所以位置核对不了 —— 打卡不受影响。",
             "Für diese Filiale ist kein Standort hinterlegt; die Erfassung funktioniert weiterhin.")}</p>
  </section>`;
}

/* ============================================================ 报可上时间 == */
function meAvailabilityView(e) {
  const week = meAvailWeek(e);
  const rec = schAvail(e.id, week);
  const fulltime = !schNeedsAvailability(e);
  const days = schWeekDays(week);
  const roster = schRoster(e.store, week);
  const invite = schInvite(e.id, week);
  const deadline = schInviteDeadline(week);
  const reminded = (invite && invite.reminders || []).length;
  /* 截止时间是催促，不是墙：只要这一周还没发布，店长就还在排、还能用得上他报的时间。
     以前过点就把表单禁掉，可店长那边还在催他 —— 催一个交不了的人是最没用的提醒。 */
  const expired = new Date() > new Date(deadline);
  const locked = roster.state === "published";
  const lockText = locked
    ? empT("这周班表已经发布，改不了了；有问题去「班表」那一页反馈。", "Der Plan ist freigegeben. Konflikte bitte im Plan melden.") : "";
  /* 每周要从零勾七行、填十四个时间，而大多数人每周报的其实差不多。
     上周报过就给一个「跟上周一样」，填进来再改两处就交得出去。
     只在上周真交过的时候出现 —— 没有的东西不做成一个按不动的按钮。 */
  const lastWeekRec = schAvail(e.id, schWeekAdd(week, -1));

  return `
    ${meWeekTabs("报班", week,
      empSavedBanner(e.id) || (rec ? empPill("green", empT("已提交", "Gemeldet")) : empPill("orange", empT("还没交", "Offen"))))}

    <p class="me-note">${fulltime
      ? empT("你是全职，默认按合同都能排。只把来不了的日子取消掉就行。",
             "Als Vollzeitkraft bist du grundsätzlich verfügbar — nur nicht mögliche Tage abwählen.")
      : empT("勾上能来的日子，填最早到、最晚走。店长看得到结果，但改不了你填的内容。",
             "Mögliche Tage anhaken und Zeitfenster angeben. Die Leitung sieht das Ergebnis, kann es aber nicht ändern.")}</p>
    ${locked ? "" : `<p class="me-note ${expired ? "is-late" : ""}">${expired
        ? empT(`已经过了 ${deadline.replace("T", " ")} 这个点，不过班表还没发 —— 现在交还来得及。`,
               `Die Frist ${deadline.replace("T", " ")} ist vorbei, der Plan steht aber noch nicht — jetzt melden geht noch.`)
        : empT(`截止 ${deadline.replace("T", " ")}`, `Frist: ${deadline.replace("T", " ")}`)}</p>`}
    ${!rec && !locked && reminded ? `<p class="me-note is-remind">${
      empT("店长提醒你交一下这一周的可上时间。", "Die Leitung bittet um deine Zeiten für diese Woche.")}</p>` : ""}

    ${lockText ? `<div class="me-lock">${lockText}</div>` : ""}

    ${locked ? "" : `<div class="me-av-quick">
      <button class="ghost-btn me-av-all">${empT("七天都能来", "Alle sieben Tage")}</button>
      <button class="ghost-btn me-av-none">${empT("全部清掉", "Alle abwählen")}</button>
      ${lastWeekRec ? `<button class="ghost-btn me-av-copy" data-week="${schWeekAdd(week, -1)}">${
        empT("跟上周报的一样", "Wie letzte Woche")}</button>` : ""}
    </div>`}

    <section class="me-avail ${locked ? "is-locked" : ""}">
      ${days.map(date => {
        const saved = rec?.days?.[date];
        const rule = schDemandFor(e.store, date).find(r => r.role === e.role);
        const on = saved ? saved.mode === "free" : fulltime;
        const start = saved?.start || rule?.start || "10:00";
        const end = saved?.end || rule?.end || "18:00";
        return `<label class="me-av-day ${on ? "is-on" : ""}" data-date="${date}">
          <span class="me-av-when">
            <input type="checkbox" class="me-av-on" ${on ? "checked" : ""} ${locked ? "disabled" : ""}>
            <b>${schDowName(schDow(date))}</b><i>${date.slice(5).replace("-", ".")}</i>
          </span>
          <span class="me-av-time">
            <input type="time" class="me-av-start" value="${start}" ${on && !locked ? "" : "disabled"}>
            <em>–</em>
            <input type="time" class="me-av-end" value="${end}" ${on && !locked ? "" : "disabled"}>
          </span>
        </label>`;
      }).join("")}
    </section>

    ${locked ? "" : `<p class="me-av-echo">${empT("交上去的是：", "Gemeldet wird: ")}<b></b></p>
    <button class="primary-btn me-av-submit" data-emp="${empEsc(e.id)}" data-week="${week}">${rec
      ? empT("更新我的可上时间", "Verfügbarkeit aktualisieren") : empT("交给店长", "An die Leitung senden")}</button>`}`;
}

/* ============================================================ 我的工时 ==== */
/* 员工看得到自己的工时和自己的工资估算 —— 那是他自己的钱。
   看不到的是：别人的任何数字、门店人工成本合计、别人的时薪。 */
function meHoursView(e) {
  const month = state().params.get("m") && /^\d{4}-\d{2}$/.test(state().params.get("m"))
    ? state().params.get("m") : empToday().slice(0, 7);
  const row = hrsRow(e.store, e, month);
  const ot = hrsOt(e.store, e.id).filter(x => String(x.date).slice(0, 7) === month)
    .sort((a, b) => b.date.localeCompare(a.date));
  const azk = hrsAzk(e.store, e.id).filter(x => x.month === month);
  const pct = row.max ? Math.min(100, Math.round((row.payable / row.max) * 100)) : 0;
  const minijob = row.type.id === "minijob" && row.hourly;
  const cap = Number(empRule("minijobMonthlyMax")) || 556;
  const monthLast = empShiftDate(hrsMonthAddRaw(month, 1) + "-01", -1);
  const attRows = (typeof attRangePairs === "function"
    ? attRangePairs(e.store, `${month}-01`, monthLast, e.id).map(p => attRow(p, empToday()))
        .filter(r => r.rec).sort((a, b) => b.date.localeCompare(a.date)) : []);

  return `
    <section class="me-weekbar">
      <a href="${meHref("工时", { m: hrsMonthAddRaw(month, -1) })}">←</a>
      <strong class="me-month">${schMonthName(month)}</strong>
      <a href="${meHref("工时", { m: hrsMonthAddRaw(month, 1) })}">→</a>
    </section>

    <section class="me-big">
      <div><strong>${schH(row.payable)}</strong><span>${empT("本月计薪工时", "Abzurechnende Stunden")}</span></div>
      <div><strong>€${row.pay.toFixed(2)}</strong><span>${empT("预估工资（税前）", "Lohn brutto (Schätzung)")}</span></div>
    </section>

    ${row.min || row.max ? `<section class="me-bar">
      <div class="me-bar-track"><i style="width:${pct}%"></i>${
        /* 2026-09-04：原来这条只有一截进度，没有刻度 —— 30 和 43 在哪儿看不出来，
           那条进度也就没有参照物。把合同下限画成一道线，上限就是整条的右端。 */
        row.min && row.max && row.max > 0
          ? `<u style="left:${Math.min(100, Math.round((row.min / row.max) * 100))}%"></u>` : ""}</div>
      ${/* 2026-09-04（Mingrong：上限下限文字重叠了）—— 下限那个标是绝对定位到刻度线上的，
            合同区间贴得近的时候（140–160，下限落在 87.5%）就压在右端的「上限」上。
            所以：下限的标只在离右端够远时才挂到刻度线上，否则跟上限并排写在一行。 */""}
      ${(() => {
        const at = row.min && row.max ? Math.min(100, Math.round((row.min / row.max) * 100)) : null;
        const apart = at != null && at < 78;
        return `<div class="me-bar-scale"><span>0h</span>${
          apart ? `<span class="is-mark" style="left:${at}%">${empT(`下限 ${row.min}h`, `min. ${row.min}h`)}</span>` : ""}
          ${row.max ? `<span>${at != null && !apart
            ? empT(`下限 ${row.min}h · 上限 ${row.max}h`, `min. ${row.min}h · max. ${row.max}h`)
            : empT(`上限 ${row.max}h`, `max. ${row.max}h`)}</span>` : ""}</div>`;
      })()}
      <p>${empT(`合同 ${row.min}–${row.max} 小时/月，到今天为止 ${schH(row.payable)}`,
                `Vertrag ${row.min}–${row.max} h/Monat, bis heute ${schH(row.payable)}`)}</p>
    </section>` : ""}

    ${minijob ? `<section class="me-hint ${row.pay > cap ? "is-warn" : ""}">
      ${row.pay > cap
        ? empT(`这个月已经到 €${row.pay.toFixed(2)}，超过 Minijob 上限 €${cap}。店长会跟你商量把多的小时存进工时账户。`,
               `€${row.pay.toFixed(2)} — über der Minijob-Grenze von €${cap}. Die Leitung klärt den Ausgleich über das Zeitkonto.`)
        : empT(`Minijob 月薪上限 €${cap}，你还剩 €${(cap - row.pay).toFixed(2)}。`,
               `Minijob-Grenze €${cap} — noch €${(cap - row.pay).toFixed(2)} frei.`)}
    </section>` : ""}

    ${/* 2026-09-04：下面四段原来是四张一样高的卡，其中三四张写着「没有动作」「还没出来」
          「还没有记录」——空的和有内容的一样重，一屏滚下去全是「没有」。
          空的时候压成一行（.is-empty），有内容的时候才展开成一张卡。 */""}
    <section class="me-list ${azk.length || row.balance ? "" : "is-empty"}">
      <h3>${empT("工时账户 Arbeitszeitkonto", "Arbeitszeitkonto")}</h3>
      ${azk.length || row.balance ? `<div class="me-kv"><span>${empT("当前余额", "Saldo")}</span><strong>${row.balance > 0 ? "+" : ""}${schH(row.balance)}</strong></div>` : ""}
      ${azk.length ? azk.map(x => `<div class="me-row">
        <span>${x.type === "in" ? empT("存入", "Einzahlung") : empT("取出", "Entnahme")} ${x.type === "in" ? "+" : "−"}${schH(x.hours)}</span>
        <i data-user-text>${empEsc(x.reason)}</i>${x.by === "self" ? `<u>${empT("你报的", "von dir")}</u>` : ""}</div>`).join("")
        : `<p class="me-empty">${row.balance ? empT("这个月没有新的存取。", "Keine neuen Bewegungen.")
                                            : empT("余额 0，这个月也没有存取。", "Saldo 0, keine Bewegungen.")}</p>`}
    </section>

    ${typeof payMine === "function" ? (() => {
      const mine = payMine(e.store, e.id, month);
      return `<section class="me-list ${mine.slip ? "" : "is-empty"}">
        <h3>${empT("我的工资单", "Meine Abrechnung")}</h3>
        ${mine.slip ? `<div class="me-kv"><span>${empT("Brutto（税前）", "Brutto")}</span><strong>€${mine.slip.gross.toFixed(2)}</strong></div>
          <div class="me-kv"><span>${empT("Netto（到手）", "Netto")}</span><strong>€${mine.slip.net.toFixed(2)}</strong></div>
          <div class="me-row"><span>${empT("打款", "Zahlung")}</span>
            ${empPill(mine.paid ? "green" : "orange", mine.paid ? empT("已打款", "bezahlt") : empT("还没打", "offen"))}
            <i>${empT(`工资单上的工时 ${schH(mine.slip.hours)}`, `${schH(mine.slip.hours)} laut Abrechnung`)}</i></div>`
        : `<p class="me-empty">${empT("还没出来，上面的数是估的。", "Liegt noch nicht vor — die Werte oben sind geschätzt.")}</p>`}
      </section>`;
    })() : ""}

    <section class="me-list ${attRows.length ? "" : "is-empty"}">
      <h3>${empT("我的考勤", "Meine Zeiterfassung")}</h3>
      ${attRows.length ? attRows.map(r => `<div class="me-row">
        <span>${empFormatDate(r.date)} ${r.rec && r.rec.in ? r.rec.in.at : "—"}${r.rec && r.rec.out ? `–${r.rec.out.at}` : ""}</span>
        ${r.rec && r.rec.decision
          ? empPill(r.rec.decision.kind === "absent" ? "gray" : "blue",
              { ok: empT("照打卡", "bestätigt"), fix: empT("店长补签", "nacherfasst"),
                plan: empT("按班表", "nach Plan"), absent: empT("记缺勤", "Fehlzeit") }[r.rec.decision.kind] || empT("已处理", "erledigt"))
          : r.needs ? empPill("orange", empT("店长在看", "in Prüfung")) : empPill("green", empT("正常", "in Ordnung"))}
        <i>${r.bad.length ? r.bad.map(x => empText({ zh: x.zh, de: x.de })).join(" · ")
                          : empT(`计 ${schH(r.payable)}`, `${schH(r.payable)} netto`)}</i></div>`).join("")
        : `<p class="me-empty">${empT("这个月还没打过卡。", "Noch keine Erfassungen.")}</p>`}
      ${attRows.some(r => r.needs) ? `<p class="me-empty">${empT("标着「店长在看」的那几条还没算进上面的工时。",
        "Die Zeilen „in Prüfung“ zählen oben noch nicht mit.")}</p>` : ""}
    </section>

    <section class="me-list me-ot ${ot.length ? "" : "is-empty"}">
      <h3>${empT("加班", "Überstunden")}</h3>
      ${ot.length ? ot.map(x => `<div class="me-row">
        <span>${empFormatDate(x.date)} +${schH(x.hours)}</span>
        ${empPill(x.state === "approved" ? "green" : x.state === "rejected" ? "gray" : "orange",
          x.state === "approved" ? empT("已批准", "genehmigt")
            : x.state === "rejected" ? empT("已驳回", "abgelehnt") : empT("等店长批", "in Prüfung"))}
        <i data-user-text>${empEsc(x.reason)}</i></div>`).join("")
        : `<p class="me-empty">${empT("这个月没有加班。", "Keine Überstunden.")}</p>`}
      ${/* 2026-09-04：这个表单原来常驻展开，三个输入框加一个大紫按钮占了整屏三分之一。
            一个月用一次的东西不该长期占着位置，更不该是这一页唯一的主按钮。 */""}
      <details class="me-ot-new">
        <summary>${empT("报一笔加班", "Überstunden melden")}</summary>
        <p class="me-note">${empT("多干的时间在这儿报一笔，店长批了才算进工资。", "Mehrarbeit hier melden — sie zählt erst nach Freigabe der Leitung.")}</p>
        <div class="me-ot-form">
          <input type="date" class="me-ot-date" value="${empEsc(empToday().slice(0, 7) === month ? empToday() : `${month}-01`)}"
            min="${month}-01" max="${empEsc(monthLast)}">
          <input type="number" class="me-ot-hours" step="0.25" min="0.25" max="12" value="1" aria-label="${empT("小时", "Stunden")}">
          <input type="text" class="me-ot-reason" placeholder="${empT("原因，比如：周六晚市延后收工", "Grund, z. B. später Feierabend")}">
          <button class="primary-btn me-ot-add" data-emp="${empEsc(e.id)}" data-store="${empEsc(e.store)}">${empT("申请加班", "Melden")}</button>
        </div>
      </details>
    </section>

    <p class="me-note">${empT("已经处理过的考勤按打卡算，其余按已发布的班表算；月底以工资单为准。",
      "Bearbeitete Erfassungen zählen nach Ist, der Rest nach freigegebenem Plan; verbindlich ist die Lohnabrechnung.")}</p>`;
}

/* ============================================================ 请假 ========
   放在「报班」这一页，因为员工在这儿做的就是同一件事：告诉店长什么时候不能来。
   报班说的是「这周哪几个时段能上」，请假说的是「这几天整天不来」。
   金额边界照旧：这里只有天数，没有钱。 */
function meLeaveSection(e) {
  if (typeof lvBalance !== "function") return "";
  const year = lvYear();
  const bal = lvBalance(e.store, e, year);
  const mine = lvOf(e.store, e.id)
    .filter(x => x.to >= empShiftDate(empToday(), -120))
    .sort((a, b) => b.from.localeCompare(a.from));
  const t = empToday();
  return `<section class="me-list me-leave">
    <h3>${empT("请假", "Abwesenheit")}</h3>
    <div class="me-kv"><span>${empT(`${year} 年假`, `Urlaub ${year}`)}</span>
      <strong>${empT(`还剩 ${lvD(bal.left)} / ${lvD(bal.days)} 天`, `${lvD(bal.left)} von ${lvD(bal.days)} Tagen`)}</strong></div>
    ${bal.partial ? `<p class="me-empty">${empT(
      `你今年是 ${bal.months} 个月的在职期，所以按合同的 ${bal.base} 天折算成 ${lvD(bal.days)} 天。`,
      `Anteilig für ${bal.months} Monate: ${lvD(bal.days)} von ${bal.base} Tagen.`)}</p>` : ""}

    ${/* 2026-09-04 复审：交上去之后就没有回头路了 —— 还没批的也撤不回来。
          批过的归店长撤（已经影响班表了），还没批的是他自己的一句话，自己就能收回。 */""}
    ${mine.length ? mine.map(x => `<div class="me-row">
      <span>${empText(lvType(x.type).name)} ${empFormatDate(x.from)}${x.to !== x.from ? `–${empFormatDate(x.to)}` : ""}</span>
      ${empPill(LV_STATES[x.state].tone, empText(LV_STATES[x.state].name))}
      <i data-user-text>${empEsc(x.decideNote || x.reason || "")}</i>
      ${x.state === "pending" ? `<button class="ghost-btn me-lv-withdraw" data-id="${empEsc(x.id)}">${
        empT("撤回", "Zurückziehen")}</button>` : ""}</div>`).join("")
      : `<p class="me-empty">${empT("你今年还没提交过请假。", "Noch keine Anträge in diesem Jahr.")}</p>`}

    <details class="me-leave-new">
      <summary>${empT("申请请假", "Abwesenheit beantragen")}</summary>
      <div class="me-leave-grid">
        <label>${empT("类型", "Art")}<select class="me-lv-type">${LV_TYPES.map(x =>
          `<option value="${x.id}">${empText(x.name)}</option>`).join("")}</select></label>
        <label>${empT("从", "Von")}<input type="date" class="me-lv-from" value="${empShiftDate(t, 7)}"></label>
        <label>${empT("到", "Bis")}<input type="date" class="me-lv-to" value="${empShiftDate(t, 7)}"></label>
      </div>
      <input class="me-lv-reason" placeholder="${empT("说一句原因，店长批起来快一点", "Kurze Begründung")}">
      <button class="primary-btn me-lv-send" data-emp="${e.id}" data-store="${empEsc(e.store)}">${
        empT("提交给店长", "An die Leitung senden")}</button>
      <p class="me-empty">${empT("提交之后店长会批。批了那几天就不会再给你排班；没批之前班表不变。",
        "Nach der Freigabe werden diese Tage nicht mehr verplant; bis dahin bleibt der Plan unverändert.")}</p>
    </details>
  </section>`;
}

/* ============================================================ 事件绑定 ==== */
function meBindAll() {
  const e = meEmp();

  /* --- 登录 / 账号 --- */
  const login = () => {
    const user = document.querySelector(".me-login-user")?.value || "";
    const pass = document.querySelector(".me-login-pass")?.value || "";
    const r = empLogin(user, pass);
    if (!r.ok) {
      meLoginMsg = r.code === "left"
        ? empT("这个账号已经失效了（已离职）。", "Dieser Zugang ist deaktiviert (ausgeschieden).")
        : empT("用户名或密码不对。", "Benutzername oder Passwort falsch.");
      app();
      return;
    }
    meLoginMsg = "";
    meSetViewer(r.employee.id, "login");
    location.hash = `me-${encodeURIComponent("班表")}`;
  };
  document.querySelector(".me-login-btn")?.addEventListener("click", login);
  document.querySelector(".me-login-pass")?.addEventListener("keydown", event => {
    if (event.key === "Enter") login();
  });

  document.querySelector(".me-pass-save")?.addEventListener("click", event => {
    const b = event.currentTarget;
    const me = empById(b.dataset.emp);
    const old = document.querySelector(".me-pass-old")?.value || "";
    const next = document.querySelector(".me-pass-new")?.value || "";
    if (!me || !me.account || me.account.pass !== old) { empFlash(b, empT("当前密码不对", "Aktuelles Passwort falsch")); return; }
    if (next.length < 6) { empFlash(b, empT("新密码至少 6 位", "Mindestens 6 Zeichen")); return; }
    if (next === old) { empFlash(b, empT("跟旧的一样", "Wie bisher")); return; }
    empSetPassword(me.id, next);
    app();
  });

  document.querySelector(".me-logout")?.addEventListener("click", () => {
    meSetViewer(null);
    location.hash = "me";
    app();
  });

  /* 勾选某天 → 时间输入跟着开关，不用先存再看。
     顺带把这一行报的时段用 24 小时制写在右边：原生 time 控件按看的人手机的地区显示，
     手机设成英语的话是 03:00 PM —— 界面是中文德文，读的人容易看错半天。
     交上去的永远是 24 小时的那个值，所以把它原样写出来。 */
  const meAvEcho = () => {
    const out = document.querySelector(".me-av-echo b");
    if (!out) return;
    const parts = [];
    document.querySelectorAll(".me-av-day").forEach(row => {
      if (!row.querySelector(".me-av-on")?.checked) return;
      const d = row.dataset.date;
      parts.push(`${schDowName(schDow(d))} ${row.querySelector(".me-av-start")?.value || "--:--"}\u2013${
        row.querySelector(".me-av-end")?.value || "--:--"}`);
    });
    out.textContent = parts.length ? parts.join("、") : empT("一天都没勾", "kein Tag ausgewählt");
    out.parentElement.classList.toggle("is-none", !parts.length);
  };
  const meAvSync = row => {
    const box = row.querySelector(".me-av-on");
    if (!box) return;
    row.classList.toggle("is-on", box.checked);
    row.querySelectorAll("input[type=time]").forEach(i => { i.disabled = !box.checked; });
    meAvEcho();
  };
  document.querySelectorAll(".me-av-day").forEach(row => {
    if (!row.querySelector(".me-av-on")) return;
    row.addEventListener("change", () => meAvSync(row));
    row.addEventListener("input", () => meAvSync(row));
  });
  meAvEcho();

  /* 还没批的假，员工自己撤回。批过的不给 —— 那是店长那一侧的动作。 */
  document.querySelectorAll(".me-lv-withdraw").forEach(btn => btn.addEventListener("click", () => {
    const hit = lvAll().find(x => x.id === btn.dataset.id);
    if (!hit || hit.state !== "pending" || hit.empId !== e.id) return;
    lvCancel(hit.id, e.name, empT("员工自己撤回", "vom Mitarbeiter zurückgezogen"));
    empMarkSaved(e.id);
    app();
  }));

  /* 员工自己改界面语言：写进他自己档案里的那一栏，跟店长在档案页改的是同一个字段。 */
  document.querySelector(".me-lang")?.addEventListener("change", event => {
    const sel = event.currentTarget;
    const staff = empById(sel.dataset.emp);
    if (!staff) return;
    staff.contact = staff.contact || {};
    staff.contact.language = sel.value;
    empSaveStaff(staff);
    meLangCache = { key: null, lang: null };
    app();
  });

  /* 每周从零勾七行是这一页最大的摩擦。三条捷径都只动界面上的值，
     不写盘 —— 按完还是要自己看一眼再点「交给店长」。 */
  const meAvSet = (row, on, start, end) => {
    const box = row.querySelector(".me-av-on");
    if (!box) return;
    box.checked = on;
    if (on && start) { const i = row.querySelector(".me-av-start"); if (i) i.value = start; }
    if (on && end) { const i = row.querySelector(".me-av-end"); if (i) i.value = end; }
    meAvSync(row);
  };
  document.querySelector(".me-av-all")?.addEventListener("click", () => {
    document.querySelectorAll(".me-av-day").forEach(row => meAvSet(row, true));
  });
  document.querySelector(".me-av-none")?.addEventListener("click", () => {
    document.querySelectorAll(".me-av-day").forEach(row => meAvSet(row, false));
  });
  document.querySelector(".me-av-copy")?.addEventListener("click", event => {
    const prev = schAvail(e.id, event.currentTarget.dataset.week);
    if (!prev) return;
    /* 上周和这周的日期对不上，按星期几对齐 */
    const byDow = {};
    Object.keys(prev.days || {}).forEach(d => { byDow[schDow(d)] = prev.days[d]; });
    document.querySelectorAll(".me-av-day").forEach(row => {
      const src = byDow[schDow(row.dataset.date)];
      if (!src || src.mode !== "free") meAvSet(row, false);
      else meAvSet(row, true, src.start, src.end);
    });
    empFlash(event.currentTarget, empT("填好了，看一眼再交", "Übernommen — bitte prüfen"));
  });

  document.querySelectorAll(".me-av-submit").forEach(b => b.addEventListener("click", () => {
    const days = {};
    let bad = "";
    document.querySelectorAll(".me-av-day").forEach(row => {
      const date = row.dataset.date;
      const on = row.querySelector(".me-av-on")?.checked;
      const start = row.querySelector(".me-av-start")?.value;
      const end = row.querySelector(".me-av-end")?.value;
      if (!on) { days[date] = { mode: "off" }; return; }
      if (!start || !end || start === end) { bad = date; return; }
      days[date] = { mode: "free", start, end };
    });
    if (bad) { empFlash(b, empT("有一天的时间没填全", "Bei einem Tag fehlt die Zeit")); return; }
    if (!Object.values(days).some(d => d.mode === "free")) {
      empFlash(b, empT("至少勾一天，一天都来不了就直接跟店长说", "Mindestens einen Tag wählen"));
      return;
    }
    schSaveAvail(b.dataset.emp, b.dataset.week, days);
    schUpdateInvite(b.dataset.emp, b.dataset.week, { submittedAt: new Date().toISOString() });
    empMarkSaved(b.dataset.emp);
    app();
  }));

  /* 打卡：先取定位再写记录。取定位要等一两秒，按钮当场变成「正在取定位…」并锁住，
     不然人会以为没反应连点三下，打出三条记录。 */
  document.querySelectorAll(".me-punch-btn").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.busy) return;
    b.dataset.busy = "1";
    b.disabled = true;
    b.textContent = empT("正在取定位…", "Standort wird geholt…");
    attAskGeo().then(pos => {
      const r = attPunch(b.dataset.store, b.dataset.emp, empToday(), b.dataset.kind, { pos, src: "self" });
      mePunchMsg = r && r.ok === false && r.code === "far"
        ? { code: "far", dist: r.dist, radius: r.radius, t: Date.now() } : null;
      app();
    });
  }));

  document.querySelectorAll(".me-punch-ask").forEach(b => b.addEventListener("click", () => {
    const why = document.querySelector(".me-punch-why")?.value || "";
    attAskHelp(b.dataset.store, b.dataset.emp, empToday(), why);
    mePunchMsg = null;
    app();
  }));

  /* 员工自己报一笔加班。跟店长在班表下面录的是同一条数据、同一个待审批状态，
     只是多记一个 by:"self" —— 店长那边看得出这是员工报的。 */
  document.querySelector(".me-ot-add")?.addEventListener("click", event => {
    const b = event.currentTarget;
    const date = document.querySelector(".me-ot-date")?.value;
    const hours = Number(document.querySelector(".me-ot-hours")?.value);
    const reason = (document.querySelector(".me-ot-reason")?.value || "").trim();
    if (!date || !(hours > 0)) { empFlash(b, empT("日期和小时数填一下", "Datum und Stunden angeben")); return; }
    if (!reason) { empFlash(b, empT("写一句原因，店长才知道批什么", "Kurze Begründung angeben")); return; }
    hrsAddOt(b.dataset.store, b.dataset.emp, date, hours, reason, "self");
    empMarkSaved(b.dataset.emp);
    app();
  });

  document.querySelectorAll(".me-lv-send").forEach(b => b.addEventListener("click", () => {
    const pick = c => document.querySelector(`.${c}`)?.value || "";
    const r = lvSubmit(b.dataset.store, b.dataset.emp, pick("me-lv-type"),
      pick("me-lv-from"), pick("me-lv-to"), pick("me-lv-reason"), { src: "self" });
    if (!r.ok) {
      empFlash(b, r.code === "overlap" ? empT("这几天你已经交过一条了", "Zeitraum bereits beantragt")
        : r.code === "dates" ? empT("日期填反了", "Datum prüfen") : empT("提交不了", "Nicht möglich"));
      return;
    }
    empMarkSaved(b.dataset.emp);
    app();
  }));
}

/* ==================================================== 经理端进入员工视角 === */
/* 真产品里店长要能看到「员工到底看到了什么」，所以这不是调试开关，是个功能。 */
function meEnterHref(empId) {
  return `#me?id=${encodeURIComponent(empId)}`;
}

/* 由 app.js 在路由分发前调用：#me?id=xxx 是店长切过来看，认完身份落到班表页。
   2026-09-03 起没有 ?t=token 这条路了 —— 员工用自己的账号登录，
   报班这件事每周在他 App 里自己出现，不需要店长发一条专属链接。 */
/* 2026-09-04 复审：这里原来是「URL 上带 id 就换成那个人」，不问当前是谁。
   于是一个真正登录的员工，手打 #me?id=e02 就变成了同事：看得到他的工时、
   预估工资、合同、证件，页面上还多出一个「店长视角」的出口。
   ?id= 本来是店长那一侧的入口（从员工档案点「以员工身份打开」），
   以及演示时选人用的 —— 它从来不该是一个已登录员工手上的开关。

   现在：只有「还没有人登录」或者「已经是店长切过来的视角」才认这个参数。
   真正 via:"login" 的员工带着 ?id= 进来，直接忽略，留在他自己那一侧。
   （测试里那些「只看得到自己」的断言都是直接调 meSetViewer 设的，
   从来没走过 URL 这条路，所以一直没暴露。） */
function meResolveEntry() {
  const { route, params } = state();
  if (route !== "me" && route !== "availability") return false;
  const id = params.get("id");
  if (!id || !empById(id)) return false;
  const now = meViewer();
  if (now && now.via === "login" && now.empId !== id) {
    /* 已经登录的人不能靠改地址栏换成别人。悄悄忽略就行 ——
       没必要提示「你不能看别人」，那等于告诉他这里有东西可看。 */
    location.hash = `me-${encodeURIComponent(route === "availability" ? "报班" : "班表")}`;
    return true;
  }
  meSetViewer(id, now && now.via === "login" ? "login" : "switch");
  location.hash = `me-${encodeURIComponent(route === "availability" ? "报班" : "班表")}`;
  return true;
}
