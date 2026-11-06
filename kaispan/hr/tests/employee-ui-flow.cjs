process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, URLSearchParams });
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
const run = code => vm.runInContext(code, ctx);

let staff = [];
const store = {};
ctx.empAllStaff = () => staff;
ctx.empRoster = () => staff;
ctx.empById = id => staff.find(e => e.id === id) || null;
ctx.empSaveStaff = e => {
  const i = staff.findIndex(x => x.id === e.id);
  if (i >= 0) staff[i] = e; else staff.push(e);
  return e;
};
ctx.empSaveWithHistory = next => ctx.empSaveStaff(next);
ctx.empRead = (key, fallback) => (key in store ? JSON.parse(JSON.stringify(store[key])) : fallback);
ctx.empWrite = (key, value) => { store[key] = JSON.parse(JSON.stringify(value)); };
ctx.empToday = () => '2026-11-06';
ctx.empNow = () => '2026-11-06T12:00:00.000Z';
ctx.empFileUrl = () => '';
ctx.state = () => ({ route: 'employee-ui', params: new URLSearchParams('') });
ctx.app = () => {};
ctx.empQuestionnaireTemplate = () => ({ file: null });

function seed(id, patch) {
  const e = {
    id, name: 'Alex Chen', firstName: 'Alex', lastName: 'Chen', status: 'invited', store: 'Martin Biergarten',
    contact: { email: 'alex@example.com', phone: '111' }, ids: {}, docs: {}, history: [],
    contract: { type: 'teilzeit', isStudent: false, nonEU: false },
    invite: { portalVersion: 2, onboardingFilesVersion: 1, state: 'sent', token: `t-${id}`, submitted: {}, reminders: [] },
    ...patch
  };
  staff = staff.filter(x => x.id !== id);
  staff.push(e);
  return e;
}
const emp = id => ctx.empById(id);

/* 1. 填写方式只看明确字段：建档总会写 employerEnteredAt，不能算公司代填（HR-ONB-09/52） */
const e1 = seed('e1', { invite: { portalVersion: 2, state: 'sent', employerEnteredAt: '2026-11-01T00:00:00.000Z', submitted: {} } });
run('euSession.key="k1";euSession.demo="";euSession.step="materials"');
let d1 = ctx.euBoundData({ employeeId: 'e1', profile: {}, docs: {} });
assert.equal(ctx.euFillMode(d1), 'self');
e1.invite.employerCompleted = true;
assert.equal(ctx.euFillMode(d1), 'company');
e1.invite.employerCompleted = false;
e1.invite.fillMode = 'veteran';
assert.equal(ctx.euFillMode(d1), 'veteran');

/* 2. 国籍：未回答就是未回答，旧 nonEU=false 不再派生成 EU（HR-DOC-02/36） */
const e2 = seed('e2', { contract: { type: 'teilzeit', isStudent: false, nonEU: false } });
let d2 = ctx.euBoundData({ employeeId: 'e2', profile: {}, docs: {} });
assert.equal(ctx.euNationalityClass(d2), '');
assert.ok(!('euCitizen' in d2.profile));
assert.equal(ctx.euDocumentList(d2).length, 0);
d2.profile = { ...d2.profile, nationalityClass: '', euCitizen: 'yes' };
assert.equal(ctx.euNationalityClass(d2), '');
d2.profile.nationalityClass = 'eu';
assert.equal(ctx.euNationalityClass(d2), 'eu');
assert.ok(ctx.euDocumentList(d2).some(t => t.key === 'passport'));

/* 3. 入职填写只存草稿；提交时才生成老板端认的冻结快照（HR-ONB-15/16/52） */
const e3 = seed('e3');
let d3 = ctx.euBoundData({ employeeId: 'e3', name: 'Alex Chen', profile: {}, docs: {} });
Object.assign(d3.profile, { first: 'Alex', last: 'Chen', birthday: '1990-01-01', phone: '222', iban: 'DE89370400440532013000', nationalityClass: 'eu' });
ctx.euMarkEdited(d3, ['first', 'last', 'birthday', 'phone', 'iban', 'nationalityClass']);
d3.docs = { passport: { name: 'passport.png', data: 'data:passport', at: '2026-11-06T09:00:00.000Z' }, bankFront: { name: 'bank.png', data: 'data:bank', at: '2026-11-06T09:01:00.000Z' } };
ctx.euSyncInvite(d3);
assert.equal(emp('e3').contact.phone, '111', '入职草稿不能直接改正式档案');
assert.equal(emp('e3').docs.id, undefined, '入职草稿文件不能直接进正式档案');
assert.equal(emp('e3').invite.state, 'sent');
d3.materialSubmitted = '2026-11-06T10:00:00.000Z';
d3.submitActionAt = d3.materialSubmitted;
d3.submitted = ctx.euSubmissionSnapshot(d3);
ctx.euSyncInvite(d3);
assert.equal(emp('e3').invite.state, 'submitted');
assert.equal(emp('e3').invite.submitted.at, d3.materialSubmitted);
assert.equal(emp('e3').invite.submitted.contact.phone, '222');
assert.equal(emp('e3').invite.submitted.ids.iban, 'DE89370400440532013000');
assert.equal(emp('e3').invite.submitted.birthday, '1990-01-01');
assert.equal(emp('e3').invite.submitted.contract.nationalityClass, 'eu');
assert.equal(emp('e3').invite.submitted.docs.id.file, 'passport.png');

/* 4. 被退回=回到草稿：残留提交标记被清掉，改字段不会自动再次提交（HR-ONB-16/23） */
const e4 = seed('e4');
e4.invite.state = 'returned';
e4.invite.submittedAt = '2026-11-06T08:00:00.000Z';
let d4 = ctx.euBoundData({ employeeId: 'e4', profile: {}, docs: {}, materialSubmitted: '2026-11-05T10:00:00.000Z', submitActionAt: '2026-11-05T10:00:00.000Z' });
assert.equal(d4.materialSubmitted, null);
assert.equal(d4.submitActionAt, null);
assert.equal(ctx.euStage(d4), 'returned');
ctx.euSyncInvite(d4);
assert.equal(emp('e4').invite.state, 'returned', '改字段不能把已退回自动变回已提交');
d4.materialSubmitted = '2026-11-06T11:00:00.000Z';
d4.submitActionAt = d4.materialSubmitted;
ctx.euSyncInvite(d4);
assert.equal(emp('e4').invite.state, 'submitted');

/* 5. 资料修改请求：有效文件版本和有效期/保留原因都要进请求（HR-ONB-43、HR-DOC-20） */
const e5 = seed('e5', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' } });
let d5 = ctx.euBoundData({ employeeId: 'e5', profile: {}, docs: { passport: { name: 'old.png', at: '2026-01-01T00:00:00.000Z' } } });
d5.updateDraft = { profile: { passportExpiry: '' }, docs: { passport: { name: 'new.png', data: 'data:new', at: '2026-11-06T09:00:00.000Z' } } };
assert.match(ctx.euUpdateSubmitItems(d5).error, /重填新有效期/);
d5.updateDraft.profile.passportExpiry = '2030-01-01';
let submit5 = ctx.euUpdateSubmitItems(d5);
assert.equal(submit5.error, '');
assert.equal(submit5.items.length, 1);
assert.deepEqual([submit5.items[0].key, submit5.items[0].kind, submit5.items[0].to, submit5.items[0].expiry], ['passport', 'doc', 'new.png', '2030-01-01']);
d5.updateDraft.keepExpiry = { passport: true };
assert.match(ctx.euUpdateSubmitItems(d5).error, /必须写原因/);
d5.updateDraft.keepReason = { passport: '证件未换新' };
submit5 = ctx.euUpdateSubmitItems(d5);
assert.equal(submit5.error, '');
assert.equal(submit5.items[0].keepExpiry, true);
assert.equal(submit5.items[0].keepReason, '证件未换新');

/* 6. 员工端请求与店长核对结果合并；提交只发布请求状态，不动正式档案（HR-ONB-43） */
let d6 = ctx.euBoundData({ employeeId: 'e5', profile: {}, docs: {}, updateRequest: { state: 'pending', at: '2026-11-06T09:00:00.000Z', items: [] } });
emp('e5').employeePortal = { updateRequest: { state: 'returned', at: '2026-11-06T10:00:00.000Z', reason: '照片不清晰' } };
assert.equal(ctx.euUpdateRequest(d6).state, 'returned');
assert.equal(ctx.euUpdateRequest(d6).reason, '照片不清晰');
ctx.euPublishPortal(d6, { updateRequest: { state: 'pending', at: '2026-11-06T11:00:00.000Z', items: [] } });
assert.equal(emp('e5').employeePortal.updateRequest.state, 'pending');
assert.equal(emp('e5').contact.phone, '111');

/* 7. 补件交回：按店长列的项逐项核对，空交不成立（HR-ONB-44） */
const e7 = seed('e7', { status: 'active', contact: { email: 'alex@example.com', phone: '' }, contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' } });
e7.request = { token: 't7', state: 'sent', at: '2026-11-01T00:00:00.000Z', items: [{ kind: 'doc', id: 'id' }, { kind: 'field', path: 'contact.phone' }] };
let d7 = ctx.euBoundData({ employeeId: 'e7', profile: {}, docs: {} });
const sup7 = ctx.euSupplementRequest(d7);
assert.equal(sup7.items.length, 2);
assert.deepEqual(ctx.euSupplementSubmission(d7, sup7).missing, ['护照 / 身份证', '电话']);
d7.updateDraft = { profile: { phone: '222' }, docs: { passport: { name: 'pp.png', data: 'data:pp', at: '2026-11-06T09:00:00.000Z' } } };
const result7 = ctx.euSupplementSubmission(d7, sup7);
assert.deepEqual(result7.missing, []);
assert.equal(result7.sub.contact.phone, '222');
assert.equal(result7.sub.docs.id.file, 'pp.png');

/* 8. 合同退回：旧文件不能算重传，新版本要盖过退回记录（HR-ONB-36/53） */
const e8 = seed('e8', { invite: { portalVersion: 2, state: 'approved', contractSentAt: '2026-11-01T00:00:00.000Z', onboardingFilesVersion: 1, contractReview: { questionnaire: { state: 'returned', reason: '缺签字', at: '2026-11-06T10:00:00.000Z' } } } });
assert.equal(ctx.euContractStatus({ employeeId: 'e8', docs: { questionnaire: { name: 'old.pdf', at: '2026-11-06T09:00:00.000Z' } } }, 'questionnaire').state, 'returned');
const fresh8 = { employeeId: 'e8', docs: { questionnaire: { name: 'new.pdf', at: '2026-11-06T11:00:00.000Z' } } };
assert.equal(ctx.euContractStatus(fresh8, 'questionnaire').state, 'uploaded');
assert.equal(ctx.euContractStatus(fresh8, 'contract').state, 'missing');

/* 9. 待确认关联先于欢迎页；确认后同步 invite 与账号状态（HR-ACCESS-43） */
const e9 = seed('e9', { account: { state: 'pending_link' }, invite: { portalVersion: 2, state: 'sent', accountLink: { state: 'pending' } } });
ctx.euInvitation = () => ({ employeeId: 'e9', key: 'k9', name: 'Only Name', store: 'Martin Biergarten' });
assert.equal(ctx.euLinkPendingEmployee(), e9);
assert.equal(ctx.euLinkPending({ employeeId: 'e9', profile: {}, docs: {} }), true);
ctx.euSyncInvite({ employeeId: 'e9', accountLinkConfirmedAt: '2026-11-06T11:00:00.000Z' });
assert.equal(emp('e9').invite.accountLink.state, 'confirmed');
assert.equal(emp('e9').account.state, 'active');

/* 10. 在岗老员工确认后是归档终态：不发合同，缺资料单独提醒（HR-ACCESS-30、HR-ONB-52） */
const e10 = seed('e10', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' } });
let d10 = ctx.euBoundData({ employeeId: 'e10', profile: {}, docs: {} });
d10.profile = { ...d10.profile, first: 'Alex', last: 'Chen', birthday: '1990-01-01', nationalityClass: 'eu' };
ctx.euMarkEdited(d10, ['first', 'last', 'birthday', 'nationalityClass']);
d10.veteranConfirmedAt = '2026-11-06T11:00:00.000Z';
ctx.euSyncInvite(d10);
assert.equal(emp('e10').invite.state, 'approved');
assert.equal(emp('e10').invite.fillMode, 'veteran');
assert.equal(emp('e10').invite.archivedAt, d10.veteranConfirmedAt);
d10 = ctx.euBoundData({ employeeId: 'e10', profile: d10.profile, docs: {} });
assert.equal(ctx.euStage(d10), 'archived');
assert.match(ctx.euContractPanel(d10), /入职已完成/);
assert.match(ctx.euContractPanel(d10), /在岗老员工/);
assert.ok(ctx.euHrTodoItems(d10).some(x => x.title === '关键资料缺失'));

/* 11. 旧记录缺 onboardingFilesVersion 也按两份；暂缺按状态显示（HR-ONB-31～33/36） */
const e11 = seed('e11', { invite: { portalVersion: 2, state: 'approved', contractSentAt: '2026-11-01T00:00:00.000Z' } });
const panel11 = ctx.euContractPanel(ctx.euBoundData({ employeeId: 'e11', profile: {}, docs: {} }));
assert.match(panel11, /个人调查问卷/);
assert.match(panel11, /下载个人调查问卷|已填写并签署的个人调查问卷/);
assert.equal(ctx.euApprovalText({ status: 'approved', deadline: '2026-12-01' }), '已批准暂缺（12 月 1 日 前）');
assert.equal(ctx.euApprovalText({ status: 'rejected', deadline: '2026-12-01' }), '暂缺已驳回');
assert.match(ctx.euApprovalText({ status: 'approved', deadline: '2026-11-01' }), /已逾期未补交/);
assert.equal(ctx.euApprovalText({ status: 'pending' }), '等待审批');
const demo11 = ctx.euBoundData({ employeeId: 'e1', profile: {}, docs: {}, demoWorkspaceAt: '2026-11-06T11:00:00.000Z' });
assert.equal(ctx.euStage(demo11), 'archived', '测试跳过要真正进入工作台');

/* 12. 各演示状态 × 页签渲染烟测：不能漏 undefined / NaN */
ctx.euInvitation = () => ({ key: 'k1', employeeId: 'e1', name: 'Alex Chen', email: 'alex@example.com', store: 'Martin Biergarten', demo: true });
for (const demo of ['', 'returned', 'company', 'veteran', 'link', 'contract', 'contract-returned', 'missing-approved', 'offline']) {
  for (const tab of ['tasks', 'docs', 'home']) {
    run(`euSession.demo=${JSON.stringify(demo)};euSession.key="k1";euSession.step="materials";euSession.tab=${JSON.stringify(tab)};euSession.preview=null`);
    const html = ctx.euRender();
    assert.ok(!/undefined|NaN/.test(html), `${demo || '默认'} / ${tab} 渲染出现 undefined 或 NaN`);
  }
}

console.log('PASS: fill mode flags, three-state nationality, onboarding draft isolation + frozen submission, returned no auto-resubmit, update request items/merge, supplement item checks, contract re-upload versioning, link-pending first, veteran archived end-state, two-file contract, approval states, demo skip, render smoke');
