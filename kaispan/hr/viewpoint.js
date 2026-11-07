/* 视角切换（老板 / 店长）与「待老板确认」标记。
   规则来源：HR-ACCESS-04/05/06/07/55、HR-LIFE-10、HR-ORG-27。
   在 employee.js 之前加载；只依赖浏览器 localStorage（file:// 下失败时回落到内存）。 */
const HR_VIEW_KEY = "kaispanHrView";
const HR_MGR_PERM_KEY = "kaispanHrMgrPerm";
const hrViewMemory = {};

function hrViewRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? (key in hrViewMemory ? hrViewMemory[key] : fallback) : JSON.parse(raw);
  } catch (error) {
    return key in hrViewMemory ? hrViewMemory[key] : fallback;
  }
}

function hrViewWrite(key, value) {
  hrViewMemory[key] = value;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* 回落到内存 */ }
}

function hrView() {
  return hrViewRead(HR_VIEW_KEY, "owner") === "manager" ? "manager" : "owner";
}

function hrSetView(view) {
  hrViewWrite(HR_VIEW_KEY, view === "manager" ? "manager" : "owner");
}

function hrIsOwner() {
  return hrView() === "owner";
}

/* 答复 ANS-4（覆盖 HR-ACCESS-05/06）：店长默认可以 ①发邀请 ②审核入职资料（含看敏感资料）⑧改证件提醒天数；
   其余默认都不可以，老板可在权限页对单个店长单独授予：发合同、提案改工资/合同条件、提案办离职、导出敏感列。
   AM-13：“导出名单（不含敏感列）”是独立开关，店长默认开启，老板可关；“导出敏感列”默认关，老板可单独授给店长，
   且要同时有“导出名单”和“查看敏感资料”。 */
function hrMgrPerm() {
  return { invite: true, sensitive: true, docWarn: true, export: true, exportSensitive: false, finance: false, sendContract: false, editTerms: false, offboard: false, ...hrViewRead(HR_MGR_PERM_KEY, {}) };
}

function hrSetMgrPerm(patch) {
  hrViewWrite(HR_MGR_PERM_KEY, { ...hrMgrPerm(), ...patch });
}

/* 能力表。owner：仅老板和管理员；invite / sensitive 老板恒有，店长按演示开关 */
const HR_CAN_RULES = {
  invite: { owner: true, manager: () => hrMgrPerm().invite, reason: "老板已对你关闭「发邀请」权限；店长默认可以发邀请（答复 ANS-4）" },
  sensitive: { owner: true, manager: () => hrMgrPerm().sensitive, reason: "需要「查看敏感资料」权限，老板已对你关闭（HR-ACCESS-55）" },
  docWarn: { owner: true, manager: () => hrMgrPerm().docWarn, reason: "老板已对你关闭「改证件提醒天数」权限（全公司一套，改动会留审计）" },
  export: { owner: true, manager: () => hrMgrPerm().export, reason: "老板已对你关闭「导出名单」权限；店长默认可以导出不含敏感列的名单（答复 B75、AM-13）" },
  exportSensitive: { owner: true, manager: () => { const perm = hrMgrPerm(); return !!(perm.exportSensitive && perm.export && perm.sensitive); }, reason: "含出生日期、税号、社保号、IBAN 的名单默认只有老板能导出，需要老板单独授予「导出敏感列」（答复 ANS-4 ⑦、AM-13）" },
  finance: { owner: true, manager: () => hrMgrPerm().finance, reason: "实发工资、工资单和银行账号只有老板和老板单独授权的财务人员能看、能做；店长默认没有（答复 R6-29）" },
  sendContract: { owner: true, manager: () => hrMgrPerm().sendContract, reason: "发合同默认只有老板，店长需要老板单独授予（答复 ANS-4 ③）" },
  editTerms: { owner: true, manager: () => hrMgrPerm().editTerms, reason: "改工资和合同条件默认只有老板；老板单独授予后，店长的改动仍是提案，需老板确认（答复 ANS-4 ⑤）" },
  offboard: { owner: true, manager: () => hrMgrPerm().offboard, reason: "办离职默认只有老板；老板单独授予后，店长的办理仍是提案，需老板确认（答复 ANS-4 ⑥）" },
  ownerOnly: { owner: true, manager: () => false, reason: "只有老板和管理员可以操作（HR-LIFE-10 / HR-ORG-27 / HR-ACCESS-04）" },
  confirmProposal: { owner: true, manager: () => false, reason: "店长的薪资、合同条件、离职改动需老板确认（HR-ACCESS-07）" }
};

function hrCan(action) {
  const rule = HR_CAN_RULES[action];
  if (!rule) return true;
  return hrIsOwner() ? rule.owner : !!rule.manager();
}

function hrDenyReason(action) {
  return HR_CAN_RULES[action]?.reason || "";
}

function hrActorLabel() {
  return hrIsOwner() ? "老板" : "店长";
}

function hrViewSwitch() {
  const view = hrView();
  const perm = hrMgrPerm();
  return `<div class="hr-view-switch" data-no-translate>
    <span class="hr-view-label">视角</span>
    <div class="hr-view-seg" role="group" aria-label="演示视角">
      <button type="button" class="${view === "owner" ? "active" : ""}" data-hr-view="owner">老板</button>
      <button type="button" class="${view === "manager" ? "active" : ""}" data-hr-view="manager">店长</button>
    </div>
    ${view === "manager" ? `<details class="hr-view-perm"><summary>店长权限</summary><div>
      <b>默认开启</b>
      <label><input type="checkbox" data-hr-perm="invite" ${perm.invite ? "checked" : ""}> 发邀请</label>
      <label><input type="checkbox" data-hr-perm="sensitive" ${perm.sensitive ? "checked" : ""}> 审核入职资料 / 查看敏感资料</label>
      <label><input type="checkbox" data-hr-perm="docWarn" ${perm.docWarn ? "checked" : ""}> 改证件提醒天数（留审计）</label>
      <label><input type="checkbox" data-hr-perm="export" ${perm.export ? "checked" : ""}> 导出名单（不含敏感列）</label>
      <b>默认关闭 · 老板单独授予</b>
      <label><input type="checkbox" data-hr-perm="exportSensitive" ${perm.exportSensitive ? "checked" : ""}> 导出敏感列（出生日期、税号、社保号、IBAN）</label>
      <label><input type="checkbox" data-hr-perm="finance" ${perm.finance ? "checked" : ""}> 工资财务（实发工资、工资单、银行账号）</label>
      <label><input type="checkbox" data-hr-perm="sendContract" ${perm.sendContract ? "checked" : ""}> 发合同</label>
      <label><input type="checkbox" data-hr-perm="editTerms" ${perm.editTerms ? "checked" : ""}> 提案改工资 / 合同条件</label>
      <label><input type="checkbox" data-hr-perm="offboard" ${perm.offboard ? "checked" : ""}> 提案办离职</label>
      <small>特殊审批永远只有老板，不能下放。演示用：正式版在「成员与权限」页由老板设置。</small></div></details>` : ""}
  </div>`;
}

function hrBindViewSwitch() {
  document.querySelectorAll("[data-hr-view]").forEach(button => {
    button.onclick = () => { hrSetView(button.dataset.hrView); app(); };
  });
  document.querySelectorAll("[data-hr-perm]").forEach(box => {
    box.onchange = () => { hrSetMgrPerm({ [box.dataset.hrPerm]: box.checked }); app(); };
  });
}
