process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const memory = new Map();
const localStorage = {
  getItem: key => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key)
};
const FIXED_NOW = new Date('2026-11-06T10:00:00').getTime();
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
  static now() { return FIXED_NOW; }
}
const ctx = vm.createContext({ console, URLSearchParams, localStorage, Date: FixedDate });
for (const file of ['viewpoint.js', 'hr-answers.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
ctx.slug = (a, b) => `${a}-${b}`;
ctx.empToday = () => '2026-11-06';
ctx.empScope = () => null;
ctx.state = () => ({ params: new URLSearchParams('id=e16'), route: 'employee' });
ctx.hrSetView('owner');
ctx.empAllStaff();

const clone = (id, patch) => {
  const base = ctx.empById(id);
  const next = JSON.parse(JSON.stringify(base));
  next.id = patch && patch.id ? patch.id : base.id;
  if (patch && patch.id && patch.id !== base.id) {
    if (next.invite) next.invite = { ...next.invite, token: ctx.empToken() };
    next.contact = { ...(next.contact || {}), email: `${patch.id}@example.com` };
    if (next.account) next.account = { ...next.account, email: next.contact.email, user: next.contact.email };
  }
  return Object.assign(next, patch || {});
};
const run = code => vm.runInContext(code, ctx);
const save = e => ctx.empSaveStaff(e);

/* B37：所有证件必须填截止日期，没有“无截止日期”选项 */
assert.equal(ctx.empDocType('residence').expiryOptional, undefined);
const noDate = { id: 'a1', contract: { nationalityClass: 'other' }, docs: { residence: { state: 'ok', file: 'r.pdf', noExpiry: true } }, contact: {}, ids: {} };
assert.equal(ctx.empDocState(noDate, 'residence', '2026-11-06').level, 'date_missing', '勾了 noExpiry 也不能免填日期');
assert.ok(!ctx.employeeDocPage().includes('无截止日期'));
assert.ok(!ctx.euDocExpiryFields({ profile: {}, docs: {} }, { key: 'visa', expires: true, expiryOptional: true }).includes('无明确截止日期'));

/* B30：不再有临时替代证明与工作许可栏 */
assert.ok(!ctx.empDocType('residence').name.zh.includes('临时替代证明'));
assert.ok(!fs.readFileSync('employee.js', 'utf8').includes('docs.residence.temporary'));

/* B40/B31：过期只提示；没有首次证明 → 标记不能排接触食品的班 */
const expired = { id: 'a2', status: 'active', contract: { nationalityClass: 'eu' }, docs: { id: { state: 'ok', file: 'p.pdf', expiry: '2026-10-01' } }, contact: {}, ids: {} };
assert.equal(ctx.empDocState(expired, 'id', '2026-11-06').level, 'expired');
assert.equal(ctx.empFoodShiftBlocked({ id: 'a3', status: 'active', docs: {}, health: { firstProof: 'no' } }), true);
assert.equal(ctx.empFoodShiftBlocked({ id: 'a4', status: 'active', docs: {}, health: { firstProof: 'yes' } }), false);

/* B26：员工可挂在部门、仓库等非门店单位下 */
assert.ok(ctx.empStores().includes('Zentrallager') && ctx.empStores().includes('Zentrale Büro'));
assert.equal(ctx.hrUnitKind('Zentrallager'), 'warehouse');
assert.ok(ctx.employeeNewPage().includes('Zentrallager'));

/* B07/B08/B14/B17/B18：离职不记“谁提出”、不算最早离职日、无交接清单；无 Minijob/Werkstudent 提醒 */
const leaver = clone('e18', { id: 'a5' });
save(leaver);
assert.equal(ctx.empSetLeave('a5', { noticeDate: '2026-11-06', lastDay: '2026-11-07' }).ok, true);
assert.equal(ctx.empById('a5').leave.who, undefined);
const leaveHtml = ctx.employeeStaffPage ? ctx.empLeaveSection(ctx.empById('a5'), '2026-11-06') : '';
assert.ok(!leaveHtml.includes('交接') && !leaveHtml.includes('谁提出'));
ctx.hrSetView('owner');
assert.ok(!ctx.empLeaveSection(clone('e19', { id: 'a6', leave: null }), '2026-11-06').includes('最早可到'));

/* B58：即时申报“齐全”只看姓名、生日、地址 */
const sofort = ctx.empSofortRows({ name: 'Lea Test', birthday: '1999-01-01', store: 'Martin Biergarten', contact: { street: 'A', houseNo: '1', zip: '12345', city: 'Dortmund' }, ids: {} });
assert.deepEqual(sofort.filter(r => r.required).map(r => r.ok), [true, true, true]);
assert.ok(sofort.filter(r => !r.required && !r.ok).length > 0, '其余项可以后补');
const sofortGap = ctx.empSofortRows({ name: 'Lea', birthday: '', store: 'Martin Biergarten', contact: {}, ids: {} });
assert.equal(sofortGap.filter(r => r.required && !r.ok).length, 2);

/* B62：员工端默认德语 */
ctx.empWrite('kaispanEmployeeUIDemoV1', { x: { profile: {} }, y: { profile: { language: '中文' } } });
run('euSession.key="x"');
assert.equal(ctx.euLang(), 'de');
run('euSession.key="y"');
assert.equal(ctx.euLang(), 'zh', '员工自己选了中文就尊重');

/* ANS-1：缺第一、二层材料不挡提交；老板特殊审批要原因，店长不能做 */
const gap = clone('e16', { id: 'a7' });
gap.invite.state = 'submitted';
gap.invite.submitted = {};
save(gap);
assert.ok(ctx.empOnbGaps(ctx.empById('a7'), 'submitted').length > 0);
ctx.hrSetView('manager');
assert.equal(ctx.empApproveInvite('a7', { entryDate: '2026-12-01', specialReason: 'x' }).code, 'special_owner');
ctx.hrSetView('owner');
assert.equal(ctx.empApproveInvite('a7', { entryDate: '2026-12-01' }).code, 'special_reason');
assert.equal(ctx.empApproveInvite('a7', { entryDate: '2026-12-01', specialReason: '出国中' }).ok, true);
const rec = ctx.empById('a7').invite.specialApproval;
assert.ok(rec.reason && rec.by && rec.at, '留原因、审批人、时间');

/* ANS-2：上传两份签好的合同即开放工作台，不等核对归档 */
const portalA = { employeeId: 'a7', profile: {}, docs: {} };
ctx.empRoster = () => ctx.empAllStaff();
ctx.euInvitation = () => ({ key: 'k', employeeId: 'a7' });
run('euSession.demo="";euSession.key="k"');
ctx.state = () => ({ params: new URLSearchParams(''), route: 'employee-ui' });
const a7 = ctx.empAllStaff().find(e => e.id === 'a7');
a7.invite.contractSentAt = '2026-11-02T09:00:00.000Z';
save(a7);
assert.equal(ctx.euWorkspaceOpen(ctx.euBoundData(portalA)), false, '审核通过未回传：只有入职任务页');
a7.invite.contractSignedSubmittedAt = '2026-11-05T09:00:00.000Z';
save(a7);
assert.equal(ctx.euWorkspaceOpen(ctx.euBoundData(portalA)), true, '员工上传即开放，不等老板核对');

/* ANS-3：发给店长的待办超过 2 个工作日，老板待办里才出现同一条；店长视角照常显示 */
assert.equal(ctx.empWorkdaysElapsed('2026-11-05', '2026-11-06'), 1);
assert.equal(ctx.empWorkdaysElapsed('2026-11-06', '2026-11-09'), 1, '周末不算工作日');
assert.equal(ctx.empWorkdaysElapsed('2026-11-02', '2026-11-05'), 3);
const submitted = clone('e16', { id: 'a8' });
submitted.invite.state = 'submitted';
submitted.invite.submittedAt = '2026-11-05T09:00:00.000Z';
save(submitted);
ctx.hrSetView('owner');
assert.equal(ctx.empPendingEntries(ctx.empById('a8'), '2026-11-06').some(x => x.key === 'review'), false, '1 个工作日：老板待办里没有');
const old = ctx.empById('a8');
old.invite.submittedAt = '2026-11-02T09:00:00.000Z';
save(old);
const escalated = ctx.empPendingEntries(ctx.empById('a8'), '2026-11-06').find(x => x.key === 'review');
assert.ok(escalated && escalated.escalated, '超过 2 个工作日升级到老板');
assert.ok(ctx.empHomeTodoRow(escalated, 'now').includes('店长 2 个工作日未处理'));
ctx.hrSetView('manager');
const fresh = ctx.empById('a8');
fresh.invite.submittedAt = '2026-11-05T09:00:00.000Z';
save(fresh);
assert.ok(ctx.empPendingEntries(ctx.empById('a8'), '2026-11-06').some(x => x.key === 'review' && !x.escalated), '店长视角照常显示');
ctx.hrSetView('owner');

/* H04-C1：只能员工本人办的事不计入待处理人数，显示为状态 */
const waiting = clone('e16', { id: 'a9', account: { state: 'pending_link' } });
waiting.invite.state = 'sent';
waiting.invite.sentAt = '2026-10-01T09:00:00.000Z';
save(waiting);
const sideKeys = ctx.empEmployeeSideEntries(ctx.empById('a9'), '2026-11-06').map(x => x.key);
assert.ok(sideKeys.includes('waitSubmit') && sideKeys.includes('waitLink'));
assert.equal(ctx.empPendingEntries(ctx.empById('a9'), '2026-11-06').some(x => ['linkConfirm', 'stalled'].includes(x.key)), false);

/* ANS-4：店长默认权限 */
ctx.hrSetView('manager');
const perm = ctx.hrMgrPerm();
assert.equal(perm.invite && perm.sensitive && perm.docWarn, true, '①发邀请 ②审核 ⑧改证件提醒天数默认可以');
assert.equal(perm.sendContract || perm.editTerms || perm.offboard || perm.exportSensitive || perm.finance, false, '其余默认不可以');
assert.equal(perm.export, true, 'AM-13：导出名单（不含敏感列）店长默认开启');
assert.equal(ctx.hrCan('exportSensitive'), false);
ctx.hrSetMgrPerm({ export: true });
assert.equal(ctx.hrCan('exportSensitive'), false, '敏感列导出默认关，需老板单独授予');
ctx.hrSetMgrPerm({ export: true });
ctx.hrSetView('owner');
assert.equal(ctx.hrCan('exportSensitive'), true);

/* 待老板确认黄标已去掉，改为已确认答复汇总 */
assert.equal(typeof ctx.hrBossMark, 'undefined');
const rules = ctx.employeeRulesPage();
assert.ok(rules.includes('已确认答复') && !rules.includes('待老板确认'));
const answers = run('HR_ANSWERS');
const chapters = new Set(answers.map(r => r[0]).filter(code => /^\d/.test(code)));
assert.equal(chapters.size, 83, '第 1–9 章 83 题都有一行');
assert.ok(answers.some(r => r[0] === 'H04-C1'));

console.log('PASS: answers 2026-11-07 — B37/B30/B40/B31/B26/B07/B08/B14/B17/B18/B58/B62, ANS-1/2/3/4, H04-C1, answers summary');
