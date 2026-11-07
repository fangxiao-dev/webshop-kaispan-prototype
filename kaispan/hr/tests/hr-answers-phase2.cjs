process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

/* R5-10：补签晚于班表收工 → 超出部分一律提交老板审批 */
const otCalls = [];
const writes = [];
const base = {
  URL, Math, Number, String, Date, JSON, Object, Array,
  empRule: id => (id === 'punchGraceMin' ? 5 : 15),
  empT: zh => zh,
  empNow: () => '2026-11-06T12:00:00',
  schMin: s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; },
  schEndMin: (start, end) => { const s = base.schMin(start), e = base.schMin(end); return e <= s ? e + 1440 : e; },
  schH: n => `${n}h`
};
const ctx = vm.createContext(base);
vm.runInContext(fs.readFileSync('attend.js', 'utf8'), ctx);
const shift = { id: 's1', start: '07:00', end: '15:00' };
const rec = { id: 'r1', store: 'Demo', empId: 'e1', date: '2026-11-05', shiftId: 's1', in: null, out: null, decision: null, otId: null, log: [] };
ctx.attEnsure = () => rec;
ctx.attShiftById = () => shift;
ctx.attEffective = () => null;
ctx.attWrite = (r, entry) => { writes.push(entry); return r; };
ctx.hrsAddOt = (store, empId, date, hours, reason) => { otCalls.push({ hours, reason }); return [{ id: 'ot1' }]; };
ctx.attDecide('Demo', 'e1', '2026-11-05', 's1', 'fix', { start: '07:00', end: '16:00', why: '晚收工' });
assert.equal(otCalls.length, 1, '补签晚收工一律提交老板审批');
assert.equal(otCalls[0].hours, 1);
assert.equal(rec.otId, 'ot1');
rec.otId = null;
ctx.attDecide('Demo', 'e1', '2026-11-05', 's1', 'fix', { start: '07:00', end: '15:00', why: '准点' });
assert.equal(otCalls.length, 1, '没有超出班表就不需要审批');

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
