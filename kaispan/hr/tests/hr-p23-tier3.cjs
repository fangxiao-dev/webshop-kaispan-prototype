/* 二三期原型第 3 档：8.3 / 8.6 / 8.12 / 9.4 / 9.9 / 8.19 回归 */
process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');

function boot() {
  const memory = new Map();
  const ctx = vm.createContext({ console, URLSearchParams, localStorage: {
    getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) } });
  for (const f of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js', 'schedule.js', 'attend.js', 'hours.js', 'leave.js', 'pay.js'])
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  ctx.slug = (a, b) => `${a}-${b}`; ctx.empScope = () => null;
  ctx.state = () => ({ params: new URLSearchParams(), route: 'employee-ui' });
  ctx.empToday = () => '2026-11-07'; ctx.empNow = () => '2026-11-07T12:00:00.000Z';
  ctx.app = () => {}; ctx.rerender = () => {};
  ctx.empAllStaff();
  return { ctx, run: s => vm.runInContext(s, ctx) };
}

/* 8.3 补签超时的加班单只有老板能批；手动加班申请维持原状 */
{
  const { ctx, run } = boot();
  run('empWrite(HRS_OT_KEY,[])');
  ctx.hrSetView('manager');
  const fix = ctx.hrsAddOt('S', 'E', '2026-11-06', 1, '补签', undefined, 'fix')[0];
  for (const state of ['approved', 'rejected']) {
    const res = ctx.hrsDecideOt(fix.id, state);
    assert.equal(res.ok, false); assert.equal(res.code, 'owner-only');
  }
  assert.equal(ctx.hrsOt('S', 'E')[0].state, 'pending');
  assert.equal(ctx.hrsOtRange('S', 'E', '2026-11-01', '2026-11-30'), 0, '店长批不了，不进工资');
  assert.ok(ctx.hrsOtRow(ctx.hrsOt('S', 'E')[0]).includes('disabled'), '店长视角按钮置灰');
  const manual = ctx.hrsAddOt('S', 'E', '2026-11-06', 2, '手动')[0];
  const azkBefore = ctx.hrsAzkAll().length;
  const mres = ctx.hrsDecideOt(manual.id, 'approved', '', { mode: 'account' });
  assert.equal(mres.ok, false, '8.12：手动加班的付钱/存账户也由老板决定，店长不能批'); assert.equal(mres.code, 'owner-only');
  assert.equal(ctx.hrsDecideOt(manual.id, 'rejected').code, 'owner-only');
  assert.equal(ctx.hrsAzkAll().length, azkBefore, '店长被拒时不产生账户存入');
  ctx.hrSetView('owner');
  assert.equal(ctx.hrsDecideOt(manual.id, 'approved').ok, true, '老板可批手动加班');
  assert.equal(ctx.hrsDecideOt(fix.id, 'approved').ok, true);
  assert.equal(ctx.hrsOtRange('S', 'E', '2026-11-01', '2026-11-30'), 3);
  assert.match(fs.readFileSync('attend.js', 'utf8'), /hrsAddOt\(rec\.store, rec\.empId, rec\.date, hours, reason, undefined, "fix"\)/, '补签生成的单带 src=fix');
}

/* 8.6 没排班打卡：店长照打卡记 → 老板批准前、驳回后都不计薪 */
{
  const { ctx } = boot();
  const rec = ctx.attEnsure('S', 'E', '2026-11-06', null);
  rec.in = { at: '10:00' }; rec.out = { at: '14:00' };
  ctx.attWrite(rec);
  ctx.hrSetView('manager');
  ctx.attDecide('S', 'E', '2026-11-06', null, 'ok', {});
  const adj = () => ctx.attRangeAdjust('S', 'E', '2026-11-01', '2026-11-30');
  const cur = () => ctx.attAll().find(r => r.empId === 'E' && r.date === '2026-11-06');
  assert.equal(cur().cover.state, 'pending');
  assert.equal(adj(), 0, '老板批准前不计薪');
  assert.equal(ctx.attCoverDecide(cur().id, 'approved').code, 'owner-only', '店长不能批');
  assert.equal(adj(), 0);
  ctx.hrSetView('owner');
  assert.equal(ctx.attCoverDecide(cur().id, 'rejected', '没安排').ok, true);
  assert.equal(adj(), 0, '驳回不计薪');
  ctx.attDecide('S', 'E', '2026-11-06', null, 'ok', {});
  assert.equal(cur().cover.state, 'pending', '重新处理回到待审批');
  assert.equal(ctx.attCoverDecide(cur().id, 'approved').ok, true);
  assert.equal(adj(), 4, '老板批准后计入 4h');
}

/* 8.12 加班批准时二选一：付钱 / 存账户，不能既付又存 */
{
  const { ctx, run } = boot();
  run('empWrite(HRS_OT_KEY,[]);empWrite(HRS_AZK_KEY,[])');
  const pay = ctx.hrsAddOt('S', 'E', '2026-11-03', 2, 'a')[0];
  ctx.hrsDecideOt(pay.id, 'approved', '', { mode: 'pay' });
  assert.equal(ctx.hrsOtRange('S', 'E', '2026-11-01', '2026-11-30'), 2);
  assert.equal(ctx.hrsBalance('S', 'E', '2026-11'), 0);
  const acc = ctx.hrsAddOt('S', 'E', '2026-11-04', 3, 'b')[0];
  ctx.hrsDecideOt(acc.id, 'approved', '', { mode: 'account' });
  assert.equal(ctx.hrsOtRange('S', 'E', '2026-11-01', '2026-11-30'), 2, '存账户的 3h 不进当期计薪');
  assert.equal(ctx.hrsOvertime('S', 'E', '2026-11'), 2);
  assert.equal(ctx.hrsBalance('S', 'E', '2026-11'), 3, '账户 +3h');
  assert.equal(ctx.hrsAzkDelta('S', 'E', '2026-11'), 0, '不再二次扣减计薪');
  ctx.hrsRevokeOt(acc.id, '撤回');
  assert.equal(ctx.hrsBalance('S', 'E', '2026-11'), 0, '撤回后账户入账一并撤掉');
}

/* 9.4 已发工资更正：提交只记意见；老板录入税务师已采纳后才生效 */
{
  const { ctx, run } = boot();
  ctx.payGet = () => ({ store: 'S', month: '2026-11', state: 'paid', snap: { E: { name: 'E', payType: 'hourly', rate: 20, gross: 100, payable: 5 } },
    slips: { E: { file: 'slip.pdf', gross: 100, hours: 5 } }, pays: { E: { state: 'paid' } } });
  let saved; ctx.paySave = x => (saved = x);
  run('empWrite(HRS_AZK_KEY,[])');
  const res = ctx.paySubmitCorrection('S', '2026-11', 'E', { hours: 5, gross: 100, bonus: 0, travel: 0, urlaubDays: 0, krankDays: 0 }, { type: 'out', hours: 1 });
  assert.equal(res.ok, true);
  assert.equal(res.run.corrections, undefined, '提交不改对账预期');
  assert.equal(ctx.hrsBalance('S', 'E', '2026-11'), 0, '提交不改工时账户');
  assert.equal(ctx.payPayslipComparison(res.run, 'E').expected, 100);
  assert.equal(res.run.correctionProposals[0].status, 'proposed');
  ctx.payGet = () => res.run;
  ctx.hrSetView('manager');
  assert.equal(ctx.payDecideCorrection('S', '2026-11', res.proposal.id, true).ok, false, '税务师决定由老板录入');
  ctx.hrSetView('owner');
  const adopted = ctx.payDecideCorrection('S', '2026-11', res.proposal.id, true);
  assert.equal(adopted.ok, true);
  assert.equal(ctx.hrsBalance('S', 'E', '2026-11'), -1, '采纳后账户才变');
  assert.equal(ctx.payPayslipComparison(adopted.run, 'E').expected, 120, '采纳后预期才变');
  assert.equal(adopted.run.correctionProposals[0].status, 'adopted');
}

/* 9.9 差旅：员工申报 + 票据 → 老板批准金额才入账；系统不自动写入费用 */
{
  const { ctx } = boot();
  const runObj = { store: 'S', month: '2026-11', state: 'open', extras: { E: { bonus: 0, travel: 0 } }, snap: {}, log: [] };
  ctx.payGet = () => runObj; ctx.paySave = x => Object.assign(runObj, x);
  assert.equal(ctx.payTravelSubmit('S', '2026-11', 'E', { amount: 50, receipts: [] }).ok, false, '要上传票据');
  assert.equal(ctx.payTravelSubmit('S', '2026-11', 'E', { amount: 80, receipts: ['t.pdf'] }).ok, true);
  assert.equal(runObj.extras.E.travel, 0, '申报不入账');
  ctx.hrSetView('manager');
  assert.equal(ctx.payTravelReview('S', '2026-11', 'E', 'approved').ok, false, '只有老板能审');
  ctx.hrSetView('owner');
  assert.equal(ctx.payTravelReview('S', '2026-11', 'E', 'returned', {}).ok, false, '退回要写理由');
  assert.equal(ctx.payTravelReview('S', '2026-11', 'E', 'approved', { amount: 70 }).ok, true);
  assert.equal(runObj.extras.E.travel, 70, '老板批准金额入账');
  assert.equal(runObj.travelClaims.E.claimed, 80);
  const src = fs.readFileSync('pay.js', 'utf8');
  assert.ok(!/travel:amount\}\}/.test(src), '行程编辑不再把自动计算写进费用');
  assert.ok(src.includes('参考值，不入账'));
}

/* 8.19 特殊假：下拉里是不可选灰项，不恢复类型与计算 */
{
  const { run } = boot();
  assert.ok(!run("LV_TYPES.some(t => t.id === 'sonder')"));
  assert.match(fs.readFileSync('leave.js', 'utf8'), /<option value="sonder" disabled[^>]*>\$\{empT\("特殊假（本项目不做）"/);
}

console.log('PASS: p23 tier3 — 8.3 补签加班只老板批, 8.6 顶班老板批后计薪, 8.12 付钱/存账户二选一, 9.4 更正需税务师采纳, 9.9 差旅申报+老板批准, 8.19 特殊假灰项');
