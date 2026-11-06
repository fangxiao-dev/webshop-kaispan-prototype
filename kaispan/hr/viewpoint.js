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

function hrMgrPerm() {
  return { invite: false, sensitive: true, ...hrViewRead(HR_MGR_PERM_KEY, {}) };
}

function hrSetMgrPerm(patch) {
  hrViewWrite(HR_MGR_PERM_KEY, { ...hrMgrPerm(), ...patch });
}

/* 能力表。owner：仅老板和管理员；invite / sensitive 老板恒有，店长按演示开关 */
const HR_CAN_RULES = {
  invite: { owner: true, manager: () => hrMgrPerm().invite, reason: "店长默认不能发邀请，需老板在「成员与权限」里给你打开（HR-ACCESS-05/06）" },
  sensitive: { owner: true, manager: () => hrMgrPerm().sensitive, reason: "需要「查看敏感资料」权限，老板已对你关闭（HR-ACCESS-55）" },
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

/* ★ 待老板确认事项：题号 → 默认做法。页面用 hrBossMark(题号) 打标，合规设置页用 hrBossConfirmTable() 汇总 */
const HR_BOSS_CONFIRM = {
  "1.5": ["跨公司调店", "新旧门店属于不同公司时拒绝调店，要办离职并新建入职"],
  "1.6": ["一人一个主店", "员工同一时间只挂一个主门店"],
  "1.7": ["员工必须挂门店", "总部也算门店，员工不能没有门店"],
  "1.8": ["Betriebsnummer 按门店填写", "几家店可填同一个 8 位数字"],
  "2.2": ["店长查看敏感资料", "店长默认可看，老板可对单个店长关闭；关闭后审核入职、核对归档、批准暂缺、下载文件被拒"],
  "2.3": ["岗位与权限不联动", "岗位「店长」只是名册标签，不联动系统权限；权限页新增「员工档案」开关"],
  "2.4": ["关联已有账号", "老板和店长本人也要用员工端：先待确认，本人确认后生效，可解绑"],
  "2.5": ["批量邀请在岗老员工", "一次最多 20 条，逐条给结果；老员工只确认资料、补证件，不重走审核和合同"],
  "2.6": ["无邮箱可建档", "可以建档，但要先填邮箱才能发邀请、推送补件"],
  "3.1": ["试用期结束日算法", "结束日 = 入职日 + 月数 − 1 天；最长不超过入职日 + 6 个月"],
  "3.2": ["通知期三种写法", "N 周 / N 周到当月 15 日或月底 / N 个月到月底，其余自由文本"],
  "3.3": ["离职「谁提出」四选一", "员工 / 公司 / 双方协商 / 合同到期；是否试用期内由系统按日期判断"],
  "3.6": ["离职资料保存期", "按五类资料设置年限，税务师给数字前占位 10 年；到期只给老板待办，一期不真删除"],
  "3.7": ["离职交接清单四项", "归还钥匙和设备、核对最后工时、确认最后工资、开具离职证明"],
  "4.x": ["合同类型与岗位", "合同类型五种；岗位默认五个，老板可自己新增"],
  "5.x": ["证件规则", "居留许可可无截止日期；健康证记首次证明和最近复训日（+2 年）；银行卡只收正面照片、医保卡正反面之后补"],
  "6.1": ["新人上工前清单四项", "即时申报、合同与问卷已归档、健康证、钥匙工牌；去掉「排进第一周班表」"],
  "6.4": ["公司代填由员工确认", "公司替员工填全部资料的，发邀请后由员工登录确认一遍，不再走审核"],
  "6.5": ["审核通过即开放工作台", "通过前只开放入职任务页；通过后入职日期之前也能用工作台"],
  "6.7": ["即时申报提醒与无社保号", "提前 3 天进待办，上班当天未申报标逾期；无社保号可选「已由税务师处理」"],
  "6.8": ["邀请邮件固定、7 天有效", "固定的中德英三语通用信，不能编辑；每个员工每天最多重发一次"],
  "7.x": ["提醒只用系统待办", "一期不发邮件提醒；员工端任务只含人事和点钞"],
  "导出": ["导出分工", "店长导出默认不含出生日期、税号、社保号、IBAN"]
};

function hrBossMark(code, extra) {
  const info = HR_BOSS_CONFIRM[code];
  const tip = info ? `问卷 ${code} · ${info[0]}：当前按默认「${info[1]}」，老板答复后再改` : `问卷 ${code}：老板答复前按默认做法`;
  return `<span class="hr-boss-mark" title="${tip.replace(/"/g, "&quot;")}" data-boss-code="${code}">待老板确认${extra ? " · " + extra : ""}</span>`;
}

function hrBossConfirmTable() {
  const rows = Object.entries(HR_BOSS_CONFIRM).map(([code, [title, def]]) =>
    `<tr><td>${code}</td><td><strong>${title}</strong></td><td>${def}</td></tr>`).join("");
  return `<table class="table hr-boss-table"><thead><tr><th>问卷题号</th><th>事项</th><th>原型当前默认做法</th></tr></thead><tbody>${rows}</tbody></table>`;
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
      <label><input type="checkbox" data-hr-perm="invite" ${perm.invite ? "checked" : ""}> 老板已给我开通发邀请</label>
      <label><input type="checkbox" data-hr-perm="sensitive" ${perm.sensitive ? "checked" : ""}> 可查看敏感资料</label>
      <small>演示用：正式版在「成员与权限」里由老板设置</small></div></details>` : ""}
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
