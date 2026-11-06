/* 税务师权限（HR-TAX-01～05、11、12、20～23）。
   一期没有税务端页面，这里只做老板这一侧：看连接、按雇主开关、看变更记录。
   授权是 HR 自己的记录，键为「客户组织 + 税务师连接 + 雇主」，默认不存在。 */
const HR_TAX_KEY = "kaispanHrTaxConnections";

/* 演示数据：一条有效连接、一条已暂停连接；授权默认关闭，只留一条已打开的用于展示打开人和时间。 */
function hrTaxSeed() {
  return {
    empty: false,
    connections: [
      {
        id: "conn-berger",
        office: "Kanzlei Berger & Partner mbB",
        status: "active",
        since: "2025-09-18",
        employers: [
          {
            id: "gmbh",
            company: "Martin Biergarten GmbH",
            store: "Dortmund",
            grant: null
          },
          {
            id: "catering",
            company: "Martin Biergarten Catering GmbH",
            store: "Essen",
            grant: null
          }
        ]
      },
      {
        id: "conn-kaya",
        office: "Kaya Steuerberatung",
        status: "paused",
        since: "2024-06-02",
        pausedAt: "2026-10-21",
        employers: [
          {
            id: "gmbh",
            company: "Martin Biergarten GmbH",
            store: "Dortmund",
            grant: { enabled: true, by: "老板", at: "2025-02-11 08:40" }
          }
        ]
      }
    ],
    log: [
      { at: "2026-11-04 10:22", by: "老板", action: "on", office: "Kanzlei Berger & Partner mbB", employer: "Martin Biergarten GmbH" },
      { at: "2025-02-11 08:40", by: "老板", action: "on", office: "Kaya Steuerberatung", employer: "Martin Biergarten GmbH" }
    ]
  };
}

function hrTaxState() {
  const saved = empRead(HR_TAX_KEY, null);
  if (!saved || typeof saved !== "object" || !Array.isArray(saved.connections)) {
    const seed = hrTaxSeed();
    empWrite(HR_TAX_KEY, seed);
    return seed;
  }
  return saved;
}

function hrTaxSave(next) {
  empWrite(HR_TAX_KEY, next);
}

function hrTaxNowLabel() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/* 开关：只有老板和管理员能改；暂停期间仍可撤销授权（HR-TAX-02）。 */
function hrTaxToggleGrant(connectionId, employerId) {
  if (!hrCan("ownerOnly")) return;
  const next = hrTaxState();
  const connection = next.connections.find(x => x.id === connectionId);
  const employer = connection?.employers.find(x => x.id === employerId);
  if (!connection || !employer) return;
  const enabled = !employer.grant?.enabled;
  const at = hrTaxNowLabel();
  employer.grant = { enabled, by: hrActorLabel(), at };
  next.log = [
    { at, by: hrActorLabel(), action: enabled ? "on" : "off", office: connection.office, employer: employer.company },
    ...(Array.isArray(next.log) ? next.log : [])
  ].slice(0, 20);
  hrTaxSave(next);
  app();
}

/* 页内演示开关：有连接 / 无连接两种样子，用来核对空态文案。 */
function hrTaxToggleDemo() {
  const next = hrTaxState();
  next.empty = !next.empty;
  hrTaxSave(next);
  app();
}

function hrTaxStatusPill(connection) {
  if (connection.status === "paused") {
    return `<span class="pill orange">${empT("已暂停", "Pausiert")}</span>`;
  }
  return `<span class="pill green">${empT("有效", "Aktiv")}</span>`;
}

function hrTaxGrantLine(employer, connection) {
  const grant = employer.grant;
  if (!grant) {
    return `<span class="tax-grant-state is-off">${empT("尚未打开：税务师读不到这家雇主的 HR 资料", "Nicht freigegeben: Der Steuerberater kann keine HR-Daten dieses Arbeitgebers lesen.")}</span>`;
  }
  if (!grant.enabled) {
    return `<span class="tax-grant-state is-off">${empT("当前关闭", "Derzeit aus")} · ${empT("关闭人", "Geschlossen von")} ${empEsc(grant.by)} · ${empEsc(grant.at)}</span>`;
  }
  const paused = connection.status === "paused"
    ? ` · <span class="pill orange">${empT("暂停期间不生效", "Während der Pause unwirksam")}</span>`
    : "";
  return `<span class="tax-grant-state is-on">${empT("打开人", "Geöffnet von")} ${empEsc(grant.by)} · ${empT("打开时间", "Zeitpunkt")} ${empEsc(grant.at)}</span>${paused}`;
}

function hrTaxGrantSwitch(employer, connection, canEdit) {
  const on = !!employer.grant?.enabled;
  const disabled = canEdit ? "" : ` disabled aria-disabled="true"`;
  return `<button type="button" class="tax-toggle${on ? " is-on" : ""}${canEdit ? "" : " is-disabled"}"
    role="switch" aria-checked="${on ? "true" : "false"}"${disabled}
    data-tax-grant-conn="${empEsc(connection.id)}" data-tax-grant="${empEsc(employer.id)}"
    title="${canEdit ? "" : empEsc(hrDenyReason("ownerOnly"))}">
    <span class="tax-toggle-track"><i></i></span>
    <strong>${on ? empT("已打开", "Freigegeben") : empT("已关闭", "Nicht freigegeben")}</strong>
  </button>`;
}

function hrTaxConnectionCard(connection, canEdit) {
  const paused = connection.status === "paused";
  return `<section class="card tax-conn">
    <div class="section-title">
      <div>
        <h2>${empEsc(connection.office)}</h2>
        <p>${empT("税务所连接", "Verbindung zur Kanzlei")} · ${empT("建立于", "seit")} ${empEsc(connection.since)}${paused ? ` · ${empT("暂停于", "pausiert seit")} ${empEsc(connection.pausedAt || "")}` : ""}</p>
      </div>
      ${hrTaxStatusPill(connection)}
    </div>
    ${paused ? `<p class="tax-conn-note">${empT("连接暂停期间，税务师的 HR 读取和回写全部被拒绝，授权记录保留；连接恢复为有效后，原来的授权自动重新生效（HR-TAX-03）。", "Während der Pause werden alle HR-Lese- und Schreibzugriffe abgelehnt; die Freigabe bleibt gespeichert und gilt nach dem Fortsetzen wieder (HR-TAX-03).")}</p>` : ""}
    <div class="table-scroll"><table class="table tax-grant-table">
      <thead><tr>
        <th>${empT("雇主", "Arbeitgeber")}</th>
        <th>${empT("税务师可读 HR 资料", "HR-Daten für Steuerberater lesbar")}</th>
        <th>${empT("打开人 / 打开时间", "Freigegeben von / am")}</th>
      </tr></thead>
      <tbody>${connection.employers.map(employer => `<tr>
        <td><strong>${empEsc(employer.company)}</strong><small>${empEsc(employer.store)}</small></td>
        <td>${hrTaxGrantSwitch(employer, connection, canEdit)}</td>
        <td>${hrTaxGrantLine(employer, connection)}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="small tax-conn-foot">${empT("关闭后，税务师的后续请求立即被拒绝；此前已签发的文件下载链接在 60 秒内仍可使用（HR-TAX-02）。", "Nach dem Ausschalten werden weitere Anfragen sofort abgelehnt; bereits ausgestellte Download-Links bleiben 60 Sekunden gültig (HR-TAX-02).")}</p>
  </section>`;
}

function hrTaxLogCard() {
  const log = hrTaxState().log;
  const rows = Array.isArray(log) ? log.slice(0, 5) : [];
  return `<section class="card tax-log-card">
    <div class="section-title">
      <div><h2>${empT("变更记录", "Änderungsprotokoll")}</h2><p>${empT("每次打开和撤销都记下谁、何时、哪个连接、哪个雇主（HR-TAX-02）。", "Jede Freigabe und jeder Widerruf wird mit Person, Zeitpunkt, Verbindung und Arbeitgeber protokolliert (HR-TAX-02).")}</p></div>
      <span class="small">${empT("最近 5 条", "letzte 5")}</span>
    </div>
    ${rows.length ? `<ul class="tax-log">${rows.map(entry => `<li>
      <span class="tax-log-time">${empEsc(entry.at)}</span>
      <span class="pill ${entry.action === "on" ? "green" : "gray"}">${entry.action === "on" ? empT("打开", "Freigegeben") : empT("撤销", "Widerrufen")}</span>
      <strong>${empEsc(entry.by)}</strong>
      <span class="tax-log-where">${empEsc(entry.office)} · ${empEsc(entry.employer)}</span>
    </li>`).join("")}</ul>` : `<p class="small">${empT("还没有变更记录。打开或关闭上面的开关后，这里会记下谁在什么时候改的。", "Noch keine Einträge. Nach dem Umschalten erscheint hier, wer wann geändert hat.")}</p>`}
  </section>`;
}

function employeeTaxAccessPage() {
  const data = hrTaxState();
  const connections = data.empty ? [] : data.connections;
  const canEdit = hrCan("ownerOnly");
  const granted = connections.reduce((sum, connection) => sum + connection.employers.filter(x => x.grant?.enabled).length, 0);
  const pausedCount = connections.filter(x => x.status === "paused").length;
  const switcher = `<button type="button" class="ghost-btn tax-demo-toggle" data-tax-demo>${data.empty ? empT("模拟：有连接", "Demo: mit Verbindung") : empT("模拟：无连接", "Demo: ohne Verbindung")}</button>`;
  const head = `
    <nav class="tax-crumb" aria-label="${empT("面包屑", "Brotkrümelnavigation")}">
      <a href="#employee">${empT("员工助手", "Mitarbeiterassistent")}</a>
      <span aria-hidden="true">›</span>
      <span>${empT("税务师权限", "Steuerberater-Zugriff")}</span>
    </nav>
    <div class="page-head">
      <div><h1>${empT("税务师权限", "Steuerberater-Zugriff")}</h1>
      <p>${empT("按雇主决定税务师能不能读 HR 资料。默认是关的；开关只影响 HR 资料，不改变财务那边的账套授权。", "Legen Sie je Arbeitgeber fest, ob der Steuerberater HR-Daten lesen darf. Standard ist aus; die Freigabe gilt nur für HR-Daten, nicht für die Finanzbuchhaltung.")}</p></div>
      <div class="button-row">${empBack("#employee", "员工助手", "Mitarbeiterassistent")}${switcher}</div>
    </div>
    ${canEdit ? "" : `<div class="tax-deny-banner"><strong>${empT("当前是店长视角", "Ansicht Filialleitung")}</strong><span>${empEsc(hrDenyReason("ownerOnly"))}</span></div>`}`;

  if (!connections.length) {
    return `${head}
    <section class="card tax-empty">
      <h2>${empT("尚未连接税务师", "Noch keine Steuerberater-Verbindung")}</h2>
      <p>${empT("本组织当前没有未被撤销的税务师连接，所以没有可以授权的雇主。连接由税务所在财务助手的「税务师」页接受后才会出现在这里。", "Es gibt derzeit keine aktive Verbindung. Verbindungen erscheinen hier, sobald die Kanzlei sie im Finanzbereich unter „Steuerberater“ angenommen hat.")}</p>
      <p class="small">${empT("已撤销的连接不再显示；与同一家税务所重新建立的是新连接，需要老板重新授权（HR-TAX-03）。", "Widerrufene Verbindungen werden nicht angezeigt; eine neue Verbindung muss erneut freigegeben werden (HR-TAX-03).")}</p>
    </section>
    ${hrTaxLogCard()}`;
  }

  return `${head}
  <section class="grid grid-3 tax-summary">
    <div class="card compact-stat"><p>${empT("未撤销的税务师连接", "Offene Verbindungen")}</p><div class="metric-value">${connections.length}</div><small>${empT("含已暂停", "inkl. pausierter")}</small></div>
    <div class="card compact-stat"><p>${empT("已打开授权的雇主", "Freigegebene Arbeitgeber")}</p><div class="metric-value">${granted}</div><small>${empT("含暂停连接（暂停期间不生效）", "inkl. pausierter Verbindungen")}</small></div>
    <div class="card compact-stat"><p>${empT("暂停中的连接", "Pausierte Verbindungen")}</p><div class="metric-value">${pausedCount}</div><small>${empT("暂停期间读取与回写都被拒绝", "Lesen und Schreiben gesperrt")}</small></div>
  </section>
  ${connections.map(connection => hrTaxConnectionCard(connection, canEdit)).join("")}

  <section class="grid grid-3 tax-scope">
    <section class="card">
      <div class="section-title"><h2>${empT("可读的员工资料", "Lesbare Mitarbeiterdaten")}</h2><span class="pill blue">HR-TAX-10/11</span></div>
      <p class="small">${empT("只限当前雇主已被授权、且入职审核已通过的员工（含已提离职和已离职）。", "Nur Mitarbeiter dieses Arbeitgebers mit abgeschlossener Onboarding-Prüfung (auch austretende und ausgetretene).")}</p>
      <ul class="tax-scope-list">
        <li>${empT("姓名、出生日期、住址", "Name, Geburtsdatum, Anschrift")}</li>
        <li>${empT("税号、社保号、医保公司与医保号", "Steuer-ID, Sozialversicherungsnummer, Krankenkasse und -nummer")}</li>
        <li>${empT("IBAN 与收款户名", "IBAN und Kontoinhaber")}</li>
        <li>${empT("入职日期、在职状态与最后工作日", "Eintrittsdatum, Status, letzter Arbeitstag")}</li>
        <li>${empT("合同条件：合同类型、薪资方式与金额、每周约定工时、月工时上下限、年假天数、定期合同到期日", "Vertragsbedingungen: Art, Entgeltart und -höhe, Wochenstunden, Monatsstunden, Urlaubstage, Befristung")}</li>
        <li>${empT("员工编号、门店名与门店企业编号、即时申报状态", "Personalnummer, Filiale und Betriebsnummer, Status der Sofortmeldung")}</li>
      </ul>
      <p class="small">${empT("这些值不脱敏；其余字段以后按税务师实际需要增量加入。", "Diese Werte werden nicht maskiert; weitere Felder folgen später nach Bedarf.")}</p>
    </section>
    <section class="card">
      <div class="section-title"><h2>${empT("可下载的文件", "Herunterladbare Dateien")}</h2><span class="pill blue">HR-TAX-12</span></div>
      <p>${empT("只有三类：个人问卷和劳动合同只给“已归档的现行版本”，在读证明只给现行版本：", "Nur drei Arten: Personalfragebogen und Arbeitsvertrag nur in der archivierten aktuellen Fassung, die Studienbescheinigung in der aktuellen Fassung:")}</p>
      <ul class="tax-scope-list">
        <li>${empT("个人问卷", "Personalfragebogen")}</li>
        <li>${empT("劳动合同", "Arbeitsvertrag")}</li>
        <li>${empT("在读证明", "Studienbescheinigung")}</li>
      </ul>
      <p class="small">${empT("下载走受保护文件通道，授权通过后签发短期链接。证件扫描、居留许可、银行卡与医保卡照片、健康证一律拒绝，且不说明拒绝原因（HR-TAX-14）。", "Download über den geschützten Dateikanal mit kurzlebigen Links. Ausweisscans, Aufenthaltstitel, Bank- und Gesundheitskarten sowie Hygienenachweise werden ohne Begründung abgelehnt (HR-TAX-14).")}</p>
    </section>
    <section class="card">
      <div class="section-title"><h2>${empT("可回写的内容", "Rückschreibbare Felder")}</h2><span class="pill blue">HR-TAX-20/21</span></div>
      <ul class="tax-scope-list">
        <li>${empT("员工编号：可与老板、店长互相更正，同一雇主下不重复，以最后一次为准。", "Personalnummer: änderbar durch Kanzlei, Chef und Filialleitung; je Arbeitgeber eindeutig, letzter Wert gilt.")}</li>
        <li>${empT("即时申报已完成（含申报日期）：也可撤销；员工没有社保号时，税务师记录即视为「已由税务师处理」。", "Sofortmeldung erledigt (mit Datum): auch widerrufbar; ohne Sozialversicherungsnummer gilt die Meldung als „durch Kanzlei erledigt“.")}</li>
      </ul>
      <p class="small">${empT("每次写入都进变更记录并标明来源；即时申报记为已完成后，对应待办自动关闭（HR-TAX-22）。", "Jede Änderung wird mit Quelle protokolliert; nach erledigter Sofortmeldung schließt sich die Aufgabe (HR-TAX-22).")}</p>
    </section>
  </section>

  <section class="card tax-note">
    <p><strong>${empT("一期的边界", "Grenzen der ersten Phase")}</strong> · ${empT("一期没有税务端页面，互通用测试桩验收；这个页面只做老板这一侧。授权是 HR 自己的记录，不使用财务的账套授权（HR-TAX-01、HR-TAX-40）。", "In Phase 1 gibt es keine Kanzlei-Oberfläche; die Schnittstelle wird mit einem Teststub geprüft. Diese Seite ist die Arbeitgeber-Seite; die Freigabe ist ein HR-Datensatz, keine Finanzbuchhaltungs-Vollmacht (HR-TAX-01, HR-TAX-40).")}</p>
  </section>
  ${hrTaxLogCard()}`;
}

/* 页面每次重绘都会换掉 DOM，所以绑定放在 document 上，不随页面一起消失。 */
if (typeof document !== "undefined") {
  document.addEventListener("click", event => {
    const target = event.target;
    if (!target || typeof target.closest !== "function") return;
    if (target.closest("[data-tax-demo]")) {
      hrTaxToggleDemo();
      return;
    }
    const grant = target.closest("[data-tax-grant]");
    if (grant) hrTaxToggleGrant(grant.dataset.taxGrantConn, grant.dataset.taxGrant);
  });
}
