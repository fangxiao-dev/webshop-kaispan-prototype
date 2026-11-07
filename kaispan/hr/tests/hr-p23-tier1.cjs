process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

/* 原型二三期轮第 1 档：8 处与 HR 正式实现（AM）不一致的口径 */
function boot(files) {
  const memory = new Map();
  const localStorage = {
    getItem: key => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: key => memory.delete(key)
  };
  const ctx = vm.createContext({ console, URLSearchParams, localStorage });
  for (const file of files) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  ctx.slug = (a, b) => `${a}-${b}`;
  ctx.empScope = () => null;
  ctx.state = () => ({ params: new URLSearchParams(''), route: 'employee-ui' });
  ctx.empToday = () => '2026-11-07';
  ctx.empNow = () => '2026-11-07T12:00:00.000Z';
  ctx.app = () => {};
  ctx.rerender = () => {};
  return { ctx, run: code => vm.runInContext(code, ctx) };
}
const FULL = ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js', 'hr-todos.js'];
const clone = (ctx, id, patch = {}, base = 'e16') => Object.assign(JSON.parse(JSON.stringify(ctx.empById(base))), patch, { id });

/* ---- 1. C1 试用期默认结束日（AM-15） ---- */
{
  const full = boot(FULL).ctx;
  const alone = boot(['employee.js']).ctx;
  const cases = [['2026-03-15', 6, '2026-09-14'], ['2024-08-31', 6, '2025-02-28'], ['2026-01-31', 1, '2026-02-28'],
    ['2028-02-29', 6, '2028-08-28'], ['2024-01-31', 1, '2024-02-29'], ['2026-05-31', 1, '2026-06-30'], ['2026-01-15', 1, '2026-02-14']];
  for (const [entry, months, expected] of cases) {
    assert.equal(full.hrProbationDefaultEnd(entry, months), expected, `hr-model ${entry}+${months}`);
    assert.equal(full.empProbationDefaultEndAt(entry, months), expected, `employee ${entry}+${months}`);
    assert.equal(alone.empProbationDefaultEndAt(entry, months), expected, `本地回退算法 ${entry}+${months}`);
  }
}

/* ---- 2/3. C2 + AM-05：公司代填、在岗老员工确认遇第二层缺项 ---- */
function confirmCase(mode, withDocs) {
  const b = boot(FULL);
  const c = b.ctx;
  c.hrSetView('owner');
  c.empAllStaff();
  const e = clone(c, `p23-${mode}`);
  e.contact = { ...e.contact, email: `${e.id}@example.com` };
  e.invite = { portalVersion: 2, state: 'sent', token: 'tk', fillMode: mode, employerCompleted: mode === 'company' };
  e.ids = {};
  e.docs = {};
  c.empSaveStaff(e);
  const d = {
    employeeId: e.id, name: 'Test User', messages: [], docs: {},
    profile: { nationalityClass: 'eu', student: 'no', first: 'Test', last: 'User', birthday: '1990-01-01', street: 'A', houseNo: '1', zip: '12345', city: 'Dortmund', iban: 'DE89370400440532013000' }
  };
  if (withDocs) d.profile.rentenversicherung = '12 123456 A 123';
  let handler;
  const box = { textContent: '', scrollIntoView() {} };
  c.document = {
    querySelector: sel => (sel === '.eu-company-confirm' ? { addEventListener: (_, fn) => { handler = fn; } } : sel === '.eu-validation' ? box : null),
    querySelectorAll: () => []
  };
  c.euData = () => d;
  b.run('euSession.key="p23";euSession.demo="";euBind()');
  handler();
  return { c, id: e.id, d, box };
}
for (const mode of ['company', 'veteran']) {
  const { c, id, d, box } = confirmCase(mode, false);
  const held = c.empById(id);
  assert.equal(box.textContent, '', `${mode}：第一层缺项只提示，不挡确认`);
  assert.ok(d.messages.some(m => m.includes('第一层还缺') || m.includes('第二层')), `${mode}：有提示`);
  assert.notEqual(held.invite.state, 'approved', `${mode}：第二层缺项，确认不直接生效`);
  assert.equal(!!held.invite.archivedAt, false);
  assert.equal(held.invite.pendingConfirm.mode, mode);
  assert.ok(held.invite.pendingConfirm.labels.length > 0, '缺项名单');
  assert.ok(c.empConfirmGaps(held).length > 0);
  assert.equal(c.empWorkflowEntries(held).some(x => x.key === 'specialPending'), false, '不另建独立特殊审批待办');
  assert.ok(c.empWorkflowEntries(held).some(x => x.key === 'review' && x.mgrOnly), '沿用“入职资料待审核”这一条');
  assert.equal(c.euStage(c.euBoundData(d)), 'submitted', '员工端显示已确认、等待');

  c.hrSetView('manager');
  assert.equal(c.empApproveConfirmation(id, { specialReason: '想放行' }).code, 'special_owner', '店长不能做特殊审批');
  assert.notEqual(c.empById(id).invite.state, 'approved');
  c.hrSetView('owner');
  assert.equal(c.empApproveConfirmation(id, {}).code, 'special_reason', '老板也要写原因');
  assert.equal(c.empApproveConfirmation(id, { specialReason: '社保号下周补' }).ok, true);
  const done = c.empById(id);
  assert.equal(done.invite.state, 'approved');
  assert.equal(done.invite.fillMode, mode);
  assert.equal(!!done.invite.archivedAt, mode === 'veteran', '老员工直接归档，公司代填还要走合同');
  assert.equal(done.invite.pendingConfirm, null);
  const rec = done.invite.specialApproval;
  assert.ok(rec.by && rec.at && rec.reason && rec.labels.length > 0 && rec.path === mode, '留审批人、时间、原因、缺项名单');
  assert.ok(done.history.some(h => h.field === 'approval.special'));
  assert.equal(c.empWorkflowEntries(done).some(x => x.key === 'review'), false, '审批后待办关闭');
}
{
  const { c, id } = confirmCase('company', true);
  const ok = c.empById(id);
  assert.equal(c.empConfirmGaps(ok).filter(x => x.key === 'rentenversicherung').length, 0);
  /* 社保号齐但健康证首次证明未传，依旧是第二层缺项；这里只验证社保号已不在缺项名单 */
  if (!c.empConfirmGaps(ok).length) assert.equal(ok.invite.state, 'approved', '第二层齐全：直接生效');
}
{
  const b = boot(FULL);
  assert.equal(b.run("HR_TODO_TYPE_LIST.some(x => x.code === 'HR-TODO-30')"), false, '类型清单不再有独立的特殊审批待办');
  assert.equal(b.run('EMP_TODO_CODES.specialPending'), undefined);
  assert.ok(fs.readFileSync('hr-todos.js', 'utf8').includes('不另建待办'), '类型清单里有说明');
}

/* ---- 4. C3 合同或问卷任一份被退回后关闭工作台，重新签回齐备再开放 ---- */
{
  const c = boot(FULL).ctx;
  c.hrSetView('owner');
  c.empAllStaff();
  const e = clone(c, 'p23-return', {}, 'e18');
  e.docs = {};
  e.contact = { ...e.contact, email: 'p23-return@example.com' };
  e.invite = { portalVersion: 2, state: 'approved', submitted: {}, contractTemplate: { name: 'v.pdf' }, questionnaireTemplate: { name: 'q.pdf' } };
  c.empSaveStaff(e);
  assert.equal(c.empSendContractDispatch(e.id).ok, true);
  const sent = c.empById(e.id);
  for (const key of ['contract', 'personalquestionnaire']) sent.docs[key] = { state: 'ok', file: `${key}.pdf`, at: '2026-11-07T12:01:00.000Z', dispatchId: sent.invite.dispatchId };
  sent.invite.contractSignedSubmittedAt = '2026-11-07T12:01:00.000Z';
  c.empSaveStaff(sent);
  const local = { employeeId: e.id, docs: {}, messages: [] };
  assert.equal(c.euWorkspaceOpen(c.euBoundData(local)), true, '两份签回：开放');
  c.empNow = () => '2026-11-07T12:02:00.000Z';
  assert.equal(c.empReviewContractAsset(e.id, 'questionnaire', 'returned', '重新签署').ok, true);
  assert.equal(c.euWorkspaceOpen(c.euBoundData(local)), false, '退回一份：工作台关闭（含服务端时间戳仍在、本机缓存仍在）');
  const cache = { ...local, contractSignedSubmittedAt: '2026-11-07T12:01:00.000Z' };
  assert.equal(c.euWorkspaceOpen(cache), false, '本机缓存的旧签回时间不能让它重新开放');
  const after = c.empById(e.id);
  const resigned = { ...local, docs: { questionnaire: { name: 'new.pdf', data: 'data:x', at: '2026-11-07T12:05:00.000Z', dispatchId: after.invite.dispatchId } } };
  assert.equal(c.euWorkspaceOpen(c.euBoundData(resigned)), true, '重新签回两份齐备：再开放');
  c.empNow = () => '2026-11-07T12:06:00.000Z';
  assert.equal(c.empVoidContractDispatch(e.id, '重发').ok, true);
  assert.equal(c.euWorkspaceOpen(c.euBoundData(local)), false, '作废：保持关闭');
}

/* ---- 5. C4 + AM-08 + AM-13 导出权限 ---- */
{
  const c = boot(FULL).ctx;
  c.hrSetView('manager');
  const perm = c.hrMgrPerm();
  assert.equal(perm.export, true, '导出名单（不含敏感列）默认开启');
  assert.equal(perm.exportSensitive, false, '导出敏感列默认关闭');
  assert.equal(c.hrCan('export'), true);
  assert.equal(c.hrCan('exportSensitive'), false);
  const target = clone(c, 'p23-export', { birthday: '1990-02-03', ids: { steuerId: '01234567890', rentenversicherung: '12 123456 A 123', iban: 'DE89370400440532013000' } });
  c.empAllStaff();
  for (const opts of [undefined, { sensitive: true }, { sensitive: true, includeSensitive: true }]) {
    const csv = c.empRosterCsv([target], opts);
    assert.ok(csv.length > 0, '默认店长能导出名单');
    assert.ok(csv.includes(target.name));
    for (const secret of ['1990-02-03', '01234567890', '12 123456 A 123', 'DE89370400440532013000']) assert.equal(csv.includes(secret), false, `越权请求敏感列返回空列：${secret}`);
    assert.ok(csv.includes('Steuer-ID'), '表头保留，列为空');
  }
  c.hrSetMgrPerm({ exportSensitive: true });
  assert.equal(c.hrCan('exportSensitive'), true, '老板单独授予后可导出敏感列');
  assert.ok(c.empRosterCsv([target], { sensitive: true }).includes('1990-02-03'));
  c.hrSetMgrPerm({ sensitive: false });
  assert.equal(c.hrCan('exportSensitive'), false, '敏感列需要同时有查看敏感资料');
  c.hrSetMgrPerm({ sensitive: true, export: false });
  assert.equal(c.hrCan('exportSensitive'), false, '没有导出名单权限时敏感列也不行');
  assert.equal(c.empRosterCsv([target], { sensitive: true }), '', '关闭导出名单：整体拒绝');
  c.hrSetMgrPerm({ export: true, exportSensitive: false });
  c.hrSetView('owner');
  assert.ok(c.empRosterCsv([target]).includes('1990-02-03'), '老板默认可导出敏感列');
  c.hrSetView('manager');
  assert.ok(c.hrViewSwitch().includes('data-hr-perm="exportSensitive"'), '演示开关里有“导出敏感列”');
}

/* ---- 6. AM-07 两个工作日按时刻升级 ---- */
{
  const c = boot(FULL).ctx;
  c.hrSetView('owner');
  const fmt = date => (date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : null);
  assert.equal(fmt(c.empEscalationDeadline('2026-11-05T10:00:00')), '2026-11-09T10:00', '周四 10:00 → 下周一 10:00');
  assert.equal(fmt(c.empEscalationDeadline('2026-11-06T15:00:00')), '2026-11-10T15:00', '周五 15:00 → 下周二 15:00');
  assert.equal(fmt(c.empEscalationDeadline('2026-11-07T18:30:00')), '2026-11-11T00:00', '周六 → 下周三 00:00');
  assert.equal(fmt(c.empEscalationDeadline('2026-11-08T09:00:00')), '2026-11-11T00:00', '周日同周六');
  assert.equal(fmt(c.empEscalationDeadline('2026-11-02T08:00:00')), '2026-11-04T08:00', '周一 → 周三');
  const visible = (since, now) => c.empApplyEscalation([{ mgrOnly: true, since }], now).length;
  assert.equal(visible('2026-11-05T10:00:00', '2026-11-09T09:59:00'), 0, '周一 09:59 还没到');
  assert.equal(visible('2026-11-05T10:00:00', '2026-11-09T10:00:00'), 1, '周一 10:00 到点升级');
  assert.equal(visible('2026-11-05T10:00:00', '2026-11-09T10:01:00'), 1, '10:01 仍在老板待办里');
  assert.equal(visible('2026-11-05T10:00:00', '2026-11-08T23:00:00'), 0, '周末不算，也没到');
  assert.equal(visible('2026-11-05T10:00:00', '2026-11-07T10:00:00'), 0, '只按日期会错：周六不算工作日');
  assert.equal(visible('2026-11-07T18:30:00', '2026-11-10T12:00:00'), 0, '周末开始的从周一起算');
  assert.equal(visible('2026-11-07T18:30:00', '2026-11-11T00:00:00'), 1);
  assert.equal(visible('2026-11-06T15:00:00', '2026-11-10T14:59:00'), 0);
  assert.equal(visible('2026-11-06T15:00:00', '2026-11-10T15:00:00'), 1);
  const entries = [{ mgrOnly: true, since: '2026-11-05T10:00:00' }];
  c.empApplyEscalation(entries, '2026-11-09T10:00:00');
  assert.equal(entries[0].escalated, true);
  assert.equal(fmt(c.empEscalationDeadline(entries[0].since)), '2026-11-09T10:00', '同一事项起点不重置');
  c.hrSetView('manager');
  assert.equal(c.empApplyEscalation([{ mgrOnly: true, since: '2026-11-09T09:00:00' }], '2026-11-09T09:00:00').length, 1, '店长视角照常显示');
}

/* ---- 7. AM-08 没有“发合同”权限的店长不能作废合同 ---- */
{
  const c = boot(FULL).ctx;
  c.hrSetView('owner');
  c.empAllStaff();
  const e = clone(c, 'p23-void', {}, 'e18');
  e.docs = {};
  e.contact = { ...e.contact, email: 'p23-void@example.com' };
  e.invite = { portalVersion: 2, state: 'approved', submitted: {}, contractTemplate: { name: 'v.pdf' }, questionnaireTemplate: { name: 'q.pdf' } };
  c.empSaveStaff(e);
  assert.equal(c.empSendContractDispatch(e.id).ok, true);
  c.hrSetView('manager');
  assert.equal(c.hrCan('sendContract'), false);
  const denied = c.empVoidContractDispatch(e.id, '发错了');
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'permission');
  assert.ok(denied.message.includes('发合同'), '写明原因');
  assert.ok(c.empById(e.id).invite.contractSentAt, '合同没被作废');
  assert.ok(!c.empById(e.id).invite.contractVoid);
  c.hrSetMgrPerm({ sendContract: true });
  assert.equal(c.empVoidContractDispatch(e.id, '发错了').ok, true, '授予发合同后可作废');
  const html = fs.readFileSync('employee.js', 'utf8');
  assert.ok(/emp-dispatch-void-btn[^`]*empCan\("sendContract"\)/.test(html), '按钮按“发合同”权限置灰');
}

/* ---- 8. AM-12 雇主法定名为空：即时申报不能记“已申报” ---- */
{
  const c = boot(FULL).ctx;
  c.hrSetView('owner');
  c.empAllStaff();
  const e = clone(c, 'p23-sofort', { name: 'Test Person', birthday: '1990-01-01', sofortmeldung: null });
  e.contact = { ...e.contact, street: 'A', houseNo: '1', zip: '12345', city: 'Dortmund' };
  c.empSaveStaff(e);
  let employer = { legalName: '', address: 'Street 1', betriebsnummer: '' };
  c.empEmployer = () => employer;
  const saved = c.empById(e.id);
  assert.equal(c.empSofortRows(saved, false).filter(x => x.required && !x.ok).length, 0, '姓名/生日/地址齐全仍是唯一的“齐全”判据');
  const panel = c.empSofortPanel(saved);
  assert.ok(panel.includes('请先补全公司资料'));
  assert.ok(/emp-sofort-done[^>]*disabled/.test(panel), '按钮置灰');
  assert.equal(c.empMarkSofort(e.id, true), null, '函数入口拒绝');
  assert.equal(!!c.empById(e.id).sofortmeldung, false, '没有记录');
  employer = { legalName: 'Muster GmbH', address: '', betriebsnummer: '' };
  assert.equal(c.empSofortPanel(c.empById(e.id)).includes('请先补全公司资料'), false);
  assert.ok(!/emp-sofort-done[^>]*disabled/.test(c.empSofortPanel(c.empById(e.id))), '法定名补全后可记录；经营地址和企业编号只待补');
  assert.ok(c.empMarkSofort(e.id, true).sofortmeldung.at, '补全公司资料后可记录');
}

console.log('PASS: hr p23 tier1 — probation end, special approval paths, workspace after return, export defaults, escalation by time, void permission, sofort employer gate');
