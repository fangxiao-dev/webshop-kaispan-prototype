process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

/* R5-10：补签晚于班表收工 → 超出部分一律提交老板审批，且和补签保持同步。
   用真实 hours.js（hrsAddOt / hrsDecideOt / hrsOtRange）和真实 attend.js；只用内存容器代替班表查找和考勤记录存取。 */
const store = {};
const base = {
  URL, Math, Number, String, Date, JSON, Object, Array,
  empRule: id => (id === 'punchGraceMin' ? 5 : 15),
  empT: zh => zh,
  empNow: () => '2026-11-06T12:00:00',
  empToday: () => '2026-11-06',
  empShiftDate: (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); },
  empRead: (k, f) => (k in store ? JSON.parse(JSON.stringify(store[k])) : f),
  empWrite: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); },
  schMin: s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; },
  schEndMin: (start, end) => { const a = base.schMin(start), e = base.schMin(end); return e <= a ? e + 1440 : e; },
  schH: n => `${n}h`
};
const ctx = vm.createContext(base);
vm.runInContext(fs.readFileSync('hours.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('attend.js', 'utf8'), ctx);
store[vm.runInContext('HRS_OT_KEY', ctx)] = [];
const shift = { id: 's1', start: '07:00', end: '15:00' };
let rec = { id: 'r1', store: 'Demo', empId: 'e1', date: '2026-11-05', shiftId: 's1', in: null, out: null, decision: null, otId: null, log: [] };
ctx.attEnsure = () => rec;
ctx.attById = () => JSON.parse(JSON.stringify(rec));
ctx.attShiftById = () => shift;
ctx.attEffective = () => null;
ctx.attWrite = (r, entry) => { r.log = [...(r.log || []), entry]; rec = JSON.parse(JSON.stringify(r)); return rec; };
const ots = () => ctx.hrsOt('Demo', 'e1');
const approved = () => ctx.hrsOtRange('Demo', 'e1', '2026-11-05', '2026-11-05');
const fix = end => ctx.attDecide('Demo', 'e1', '2026-11-05', 's1', 'fix', { start: '07:00', end, why: '补签' });

fix('16:00');
assert.equal(ots().length, 1, '补签晚收工一律提交老板审批');
assert.equal(ots()[0].hours, 1);
assert.equal(ots()[0].state, 'pending');
assert.equal(approved(), 0, '批准前不进工资');

fix('17:00');
assert.equal(ots().length, 1, '再次补签更新同一张待审批单，不留旧单');
assert.equal(ots()[0].hours, 2);
assert.equal(ots()[0].state, 'pending');

fix('16:00');
assert.equal(ots()[0].hours, 1, '16:00→17:00→16:00 回到 1 小时');

fix('15:00');
assert.equal(approved(), 0);
assert.equal(ots().filter(x => x.state === 'pending').length, 0, '改回不超时：待审批单撤回');
assert.equal(rec.otId, null);
assert.ok(ots().every(x => x.state === 'rejected' && x.revoked), '被撤回的单标记 revoked');

fix('16:00');
const first = ots().find(x => x.state === 'pending').id;
ctx.attUndoDecision('r1');
assert.equal(ots().find(x => x.id === first).state, 'rejected', '撤销补签决议：加班单撤回');
assert.equal(rec.otId, null);
assert.equal(approved(), 0);

fix('16:00');
const second = ots().find(x => x.state === 'pending').id;
ctx.hrsDecideOt(second, 'approved');
assert.equal(approved(), 1, '批准后进工资');
fix('17:00');
assert.equal(approved(), 0, '已批准后修改补签：原批准撤销，被撤销的小时不再进工资');
const pendingAfter = ots().filter(x => x.state === 'pending');
assert.equal(pendingAfter.length, 1);
assert.equal(pendingAfter[0].hours, 2, '按新超时重新提交老板审批');
ctx.hrsDecideOt(pendingAfter[0].id, 'approved');
assert.equal(approved(), 2);
fix('15:00');
assert.equal(approved(), 0, '已批准后改回不超时：撤销原批准');

/* fix2：已撤回的单不能再批准（也不能被旧回调复活），新单批准后旧单重放不重复计薪；工资快照不变 */
const staffE1 = { id: 'e1', name: 'E One', status: 'active', entryDate: '2020-01-01', contact: {}, ids: {}, contract: { type: 'teilzeit', payType: 'hourly', rate: 20, hoursMin: 0, hoursMax: 80 } };
Object.assign(ctx, { empStaff: () => [staffE1], empById: id => (id === 'e1' ? staffE1 : null), empRaw: x => x, empContractType: t => ({ name: { de: t, zh: t }, id: t }) });
ctx.attAdjust = () => 0;
ctx.attMonthPending = () => 0;
ctx.attRangePairs = () => [];
ctx.hrsMonthProgress = () => ({ ready: true, issues: [] });
vm.runInContext(fs.readFileSync('pay.js', 'utf8'), ctx);
const overtimeFor = () => ctx.hrsOtRange('Demo', 'e1', '2026-11-01', '2026-11-30');
const payOt = () => ctx.paySnapshot('Demo', '2026-11').e1.ot;
store[vm.runInContext('HRS_OT_KEY', ctx)] = [];
fix('15:00');
fix('16:00');
const staleId = rec.otId;
fix('15:00');
assert.equal(ots().find(x => x.id === staleId).revoked, true);
const beforeRange = overtimeFor();
const beforePay = payOt();
const replay = ctx.hrsDecideOt(staleId, 'approved');
assert.equal(replay.ok, false);
assert.equal(replay.code, 'revoked', '撤回旧单再批准被拒，返回明确错误码');
assert.equal(ots().find(x => x.id === staleId).state, 'rejected', '被拒后不改状态');
assert.equal(ctx.hrsDecideOt(staleId, 'rejected').code, 'revoked');
assert.equal(overtimeFor(), beforeRange);
assert.equal(payOt(), beforePay, '工资快照不变');
fix('16:00');
const newId = ots().find(x => x.state === 'pending').id;
assert.notEqual(newId, staleId);
assert.equal(ctx.hrsDecideOt(newId, 'approved').ok, true);
assert.equal(overtimeFor(), 1);
const paidOnce = payOt();
ctx.hrsDecideOt(staleId, 'approved');
assert.equal(overtimeFor(), 1, '新单批准后旧单重放不重复计薪');
assert.equal(payOt(), paidOnce);
assert.equal(ctx.hrsOtRange('Demo', 'e1', '2026-11-05', '2026-11-05'), 1);
/* 即使有人直接把 revoked 单的 state 写成 approved，累计也始终排除 revoked */
const forced = ctx.hrsOtAll().map(x => (x.id === staleId ? { ...x, state: 'approved' } : x));
ctx.empWrite(vm.runInContext('HRS_OT_KEY', ctx), forced);
assert.equal(overtimeFor(), 1, 'hrsOtRange 始终排除 revoked');

/* fix2：撤销补签决议只撤回自动生成的单；手动“转加班申请”的 pending/approved 单不变 */
for (const finalState of ['pending', 'approved']) {
  store[vm.runInContext('HRS_OT_KEY', ctx)] = [];
  rec = { id: 'r2', store: 'Demo', empId: 'e1', date: '2026-11-05', shiftId: 's1', in: { at: '07:00' }, out: { at: '16:00' }, decision: null, otId: null, otSource: null, log: [] };
  ctx.attExcess = () => 1;
  const converted = ctx.attToOvertime('r2', 'manager');
  assert.equal(converted.otSource, 'manual');
  const manualId = rec.otId;
  if (finalState === 'approved') ctx.hrsDecideOt(manualId, 'approved');
  const manualBefore = ots().find(x => x.id === manualId);
  ctx.attUndoDecision('r2');
  const manualAfter = ots().find(x => x.id === manualId);
  assert.equal(manualAfter.state, finalState, `手动单 ${finalState} 撤销决议后保持原状态`);
  assert.equal(manualAfter.hours, manualBefore.hours);
  assert.ok(!manualAfter.revoked);
  assert.equal(overtimeFor(), finalState === 'approved' ? manualBefore.hours : 0);
}

/* R5-25/R5-29：休假页没有特殊假；R5-30：病假第一天起要 AU */
const leaveCtx = vm.createContext({ ...base, empRule: id => (id === 'auAfterDays' ? 1 : 6) });
vm.runInContext(fs.readFileSync('leave.js', 'utf8'), leaveCtx);
assert.equal(vm.runInContext('LV_TYPES.map(t => t.id).join()', leaveCtx), 'urlaub,krank,unbezahlt');
assert.equal(vm.runInContext('lvAuAfter()', leaveCtx), 1);

/* R5-30 / R6-14 / R6-21：规则默认值 */
const rulesCtx = vm.createContext({ console, URLSearchParams, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), rulesCtx);
assert.equal(rulesCtx.empRule('auAfterDays'), 1);
assert.equal(rulesCtx.empRule('payslipToleranceEuro'), 0);
assert.ok(rulesCtx.empRules().find(r => r.id === 'azkMaxHours').note.zh.includes('允许为负数'));

/* R6-29：工资页只有老板和被授权的财务人员 */
const payCtx = vm.createContext({ ...base, hrCan: () => false, hrDenyReason: () => '只有老板和财务', empEsc: x => x });
vm.runInContext(fs.readFileSync('pay.js', 'utf8'), payCtx);
assert.ok(payCtx.employeePayrollPage().includes('只有老板和财务'));

console.log('PASS: phase 2/3 answers — 补签审批, 无特殊假, AU 第一天, 税前零容差, 工时账户负数, 工资财务权限');
