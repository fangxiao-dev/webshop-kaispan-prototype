process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, URLSearchParams });
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
const run = code => vm.runInContext(code, ctx);
const realEuInvitation = ctx.euInvitation;

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
d5.profile.passportExpiry = '2029-12-31';
d5.updateDraft.keepExpiry = { passport: true };
assert.match(ctx.euUpdateSubmitItems(d5).error, /必须写原因/);
d5.updateDraft.keepReason = { passport: '证件未换新' };
submit5 = ctx.euUpdateSubmitItems(d5);
assert.equal(submit5.error, '');
assert.equal(submit5.items[0].keepExpiry, true);
assert.equal(submit5.items[0].keepReason, '证件未换新');
assert.equal(submit5.items[0].expiry, '2029-12-31');

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
d7.updateDraft = { profile: { phone: '222', passportExpiry: '2030-01-01' }, docs: { passport: { name: 'pp.png', data: 'data:pp', at: '2026-11-06T09:00:00.000Z' } } };
const result7 = ctx.euSupplementSubmission(d7, sup7);
assert.deepEqual(result7.missing, []);
assert.equal(result7.sub.contact.phone, '222');
assert.equal(result7.sub.docs.id.file, 'pp.png');
assert.equal(result7.sub.docs.id.expiry, '2030-01-01');

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

/* 13. F1 档案新版本刷新本机缓存；采纳只写请托项，不整体回滚正式文件 */
const e13 = seed('e13', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' }, docs: { id: { state: 'ok', file: 'passport-new.png', dataUrl: 'data:new-pp', at: '2026-11-06T10:00:00.000Z', expiry: '2031-01-01' } } });
const d13 = ctx.euBoundData({ employeeId: 'e13', profile: {}, docs: { passport: { name: 'passport-old.png', data: 'data:old-pp', at: '2026-01-01T00:00:00.000Z' } } });
assert.equal(d13.docs.passport.name, 'passport-new.png', '档案新版本要盖过本机旧缓存');
assert.equal(d13.docs.passport.source, 'archive');
assert.equal(d13.profile.passportExpiry, '2031-01-01');
const adopted13 = ctx.euApplyUpdateItems(emp('e13'), [{ key: 'phone', kind: 'field', to: '222' }], '2026-11-06T12:00:00.000Z');
assert.equal(adopted13.contact.phone, '222');
assert.equal(adopted13.docs.id.file, 'passport-new.png', '只采纳电话不能回滚护照');
assert.equal(adopted13.docs.id.at, '2026-11-06T10:00:00.000Z');

/* 14. F2 采纳严格按冻结请求，不读提交后又改动的草稿 */
const req14 = { state: 'pending', at: '2026-11-06T09:00:00.000Z', items: [{ key: 'phone', label: '电话', kind: 'field', from: '111', to: '222' }] };
const d14 = ctx.euBoundData({ employeeId: 'e13', profile: {}, docs: {}, updateRequest: req14, updateDraft: { profile: { phone: '333' } } });
assert.equal(ctx.euUpdateValue(d14, 'phone'), '333');
assert.equal(ctx.euUpdateRequest(d14).items[0].to, '222');
assert.equal(ctx.euApplyUpdateItems(emp('e13'), ctx.euUpdateRequest(d14).items, '2026-11-06T12:00:00.000Z').contact.phone, '222');
const e14 = seed('e14', { status: 'active', contact: { email: 'alex@example.com', phone: '222' }, contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' }, employeePortal: { updateRequest: { state: 'done', at: '2026-11-06T09:00:00.000Z', items: [{ key: 'phone', kind: 'field', from: '111', to: '222' }] } } });
const d14done = ctx.euBoundData({ employeeId: 'e14', profile: { phone: '333' }, profileEdited: ['phone'], updateDraft: { profile: { phone: '333' } }, updateRequest: { state: 'pending', at: '2026-11-06T09:00:00.000Z', items: [{ key: 'phone', kind: 'field', from: '111', to: '222' }] }, docs: {} });
assert.equal(d14done.updateDraft, null, '采纳后清掉本机草稿');
assert.equal(ctx.euUpdateValue(d14done, 'phone'), '222', '页面回到正式档案的新值');
ctx.euSyncInvite(d14done);
assert.equal(emp('e14').employeePortal.updateRequest.state, 'done');

/* 15. F3 姓名修改进入冻结提交：提交快照与老板端读取都用草稿 first/last */
seed('e15', { name: 'Old Name', firstName: 'Old', lastName: 'Name' });
const d15 = ctx.euBoundData({ employeeId: 'e15', name: 'Old Name', profile: { first: 'New', last: 'Name' }, profileEdited: ['first', 'last'], docs: {} });
d15.materialSubmitted = '2026-11-06T10:00:00.000Z';
assert.equal(d15.name, 'New Name');
assert.equal(ctx.euSubmissionSnapshot(d15).name, 'New Name');

/* 16. F4 普通保存不写请求状态：店长已处理的结果不会被本机 pending 复活 */
const e16 = seed('e16', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' }, employeePortal: { updateRequest: { state: 'done', at: '2026-11-06T10:00:00.000Z', items: [] }, specialSubmission: { state: 'approved', items: ['steuerId'], labels: ['Steuer-ID（个人税务识别号）'], at: '2026-11-05T10:00:00.000Z' } } });
const d16 = ctx.euBoundData({ employeeId: 'e16', profile: {}, docs: {}, updateRequest: { state: 'pending', at: '2026-11-06T09:00:00.000Z', items: [] }, specialSubmission: { state: 'pending', items: ['steuerId'], labels: ['Steuer-ID（个人税务识别号）'] } });
ctx.euSyncInvite(d16);
assert.equal(emp('e16').employeePortal.updateRequest.state, 'done', '普通保存不能把已采纳请求改回 pending');
assert.equal(emp('e16').employeePortal.specialSubmission.state, 'approved', '普通保存不能把已批准暂缺改回 pending');
assert.equal(ctx.euSpecialPending(d16, 'steuerId'), false);
assert.ok(!/等待审批/.test(ctx.euSpecialBlock(d16)), '店长批准后不再显示等待审批');

/* 17. F5 资料页身份控件写 updateDraft，材料清单按草稿算 */
const e17 = seed('e17', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' } });
const d17 = ctx.euBoundData({ employeeId: 'e17', profile: {}, docs: {}, updateDraft: { profile: { nationalityClass: 'other' } } });
assert.equal(ctx.euNationalityClass(d17), 'eu', '没提交的改动不能写正式值');
assert.equal(ctx.euNationalityClass(ctx.euUpdateView(d17)), 'other');
assert.ok(ctx.euDocumentList(ctx.euUpdateView(d17)).some(t => t.key === 'visa'), '材料清单按草稿国籍计算');
const items17 = ctx.euUpdateSubmitItems(d17).items;
assert.equal(items17.length, 1);
assert.deepEqual([items17[0].key, items17[0].to], ['nationalityClass', 'other']);
const docsHtml17 = ctx.euDocsTab(d17);
assert.match(docsHtml17, /data-update="nationalityClass"/);
assert.ok(!docsHtml17.includes('data-profile="nationalityClass"'), '资料页身份控件不能再写入职草稿');
const d17adopt = { ...d17, updateRequest: { state: 'pending', at: '2026-11-06T09:00:00.000Z', items: [{ key: 'phone', kind: 'field', to: '222' }] }, updateDraft: { profile: { nationalityClass: 'other', phone: '222' } } };
const adopted17 = ctx.euApplyUpdateItems(emp('e17'), ctx.euUpdateRequest(d17adopt).items, '2026-11-06T12:00:00.000Z');
assert.equal(adopted17.contract.nationalityClass, 'eu', '采纳其他修改不能顺带写入未提交的国籍');
assert.equal(adopted17.contact.phone, '222');

/* 18. F6 补件要新版本 + 本次草稿有效期；旧档案件不能算补交 */
const e18 = seed('e18', { status: 'active', contact: { email: 'alex@example.com', phone: '111' }, contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' }, docs: { id: { state: 'ok', file: 'old-passport.png', at: '2026-01-01T00:00:00.000Z' } }, request: { token: 't18', state: 'sent', sentAt: '2026-11-05T00:00:00.000Z', items: [{ kind: 'doc', id: 'id' }] } });
const d18 = ctx.euBoundData({ employeeId: 'e18', profile: {}, docs: {} });
assert.equal(ctx.euSupplementRequest(d18).sentAt, '2026-11-05T00:00:00.000Z');
assert.deepEqual(ctx.euSupplementSubmission(d18, ctx.euSupplementRequest(d18)).missing, ['护照 / 身份证']);
d18.updateDraft = { profile: {}, docs: { passport: { name: 'new-passport.png', data: 'data:pp', at: '2026-11-06T09:00:00.000Z' } } };
assert.deepEqual(ctx.euSupplementSubmission(d18, ctx.euSupplementRequest(d18)).missing, ['护照 / 身份证有效期（年月日）']);
d18.updateDraft.profile.passportExpiry = '2030-01-01';
const result18 = ctx.euSupplementSubmission(d18, ctx.euSupplementRequest(d18));
assert.deepEqual(result18.missing, []);
assert.equal(result18.sub.docs.id.expiry, '2030-01-01');

/* 19. F7 正式国籍明确空值阻止旧 euCitizen 兜底 */
const e19 = seed('e19', { migrated: true, contract: { type: 'teilzeit', isStudent: false, nationalityClass: '', nonEU: false } });
const d19 = ctx.euBoundData({ employeeId: 'e19', profile: { euCitizen: 'yes' }, docs: {} });
assert.equal(ctx.euNationalityClass(d19), '', '正式空国籍不能被旧 euCitizen=yes 变成欧盟');
assert.equal(ctx.euDocumentList(d19).length, 0);

/* 20. F8 旧退回记录缺时间：用档案文件版本当锚点，旧件不算重传 */
const e20 = seed('e20', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' }, docs: { personalquestionnaire: { state: 'returned', file: 'old-q.pdf', at: '2026-11-05T00:00:00.000Z' } }, invite: { portalVersion: 2, state: 'approved', contractSentAt: '2026-11-01T00:00:00.000Z', contractReview: { questionnaire: { state: 'returned', reason: '缺签字' } } } });
const d20 = ctx.euBoundData({ employeeId: 'e20', profile: {}, docs: {} });
const status20 = ctx.euContractStatus(d20, 'questionnaire');
assert.equal(status20.state, 'returned');
assert.equal(ctx.euContractFreshUpload(d20, 'questionnaire', status20), false, '旧档案件不能证明重传');
d20.docs.questionnaire = { name: 'new-q.pdf', at: '2026-11-06T09:00:00.000Z' };
assert.equal(ctx.euContractFreshUpload(d20, 'questionnaire', status20), true);

/* 21. F9 关联页先于欢迎页，且外壳只含档案姓名 */
seed('e21', { name: 'Only Name', contact: { email: 'secret@example.com' }, invite: { portalVersion: 2, state: 'sent', linkPending: true, submitted: {} } });
ctx.euInvitation = () => ({ employeeId: 'e21', key: 'k21', name: 'Only Name', email: 'secret@example.com', store: 'Martin Biergarten' });
run('euSession.key="k21";euSession.demo="";euSession.step="register";euSession.tab="tasks"');
const linkHtml = ctx.euRender();
assert.ok(linkHtml.includes('Only Name'));
assert.ok(!linkHtml.includes('Martin Biergarten'), '关联页外壳不能显示门店');
assert.ok(!linkHtml.includes('secret@example.com'), '关联页不能显示邮箱');

/* 22. F10 公司代填只认 employerCompleted===true；演示模式单独走演示入口 */
const e22 = seed('e22', { invite: { portalVersion: 2, state: 'sent', fillMode: 'company', employerCompleted: false, submitted: {} } });
const d22 = ctx.euBoundData({ employeeId: 'e22', profile: {}, docs: {} });
assert.equal(ctx.euFillMode(d22), 'self', '没填完的公司代填不能直接通过');
run('euSession.demo="company"');
assert.equal(ctx.euFillMode(d22), 'company');
run('euSession.demo=""');

/* 23. F11 动态整句与日期跟界面语言走（德语） */
run('empWrite("kaispanEmployeeUIDemoV1",{kde:{profile:{language:"Deutsch"}}});euSession.key="kde";euSession.demo=""');
assert.equal(ctx.euMonthDay('2026-12-01'), '1.12.2026');
assert.ok(ctx.euApprovalText({ status: 'approved', deadline: '2026-12-01' }).includes('Genehmigt'));
assert.notEqual(ctx.euT('入职已完成，可在这里更新个人资料与材料。'), '入职已完成，可在这里更新个人资料与材料。');
assert.ok(ctx.euTF('还要补：{items}。请先在资料修改里填写或上传新版本。', { items: 'Reisepass' }).includes('Noch nötig'));

{
  const keepInvitation = ctx.euInvitation;
  ctx.euInvitation = realEuInvitation;
  staff = [{ id: 'e-exp', name: 'Old Link', store: 'Martin Biergarten', invite: { token: 'tok-old', state: 'sent', sentAt: '2026-10-01T10:00:00.000Z', expiresAt: '2026-10-08T10:00:00.000Z' } }];
  ctx.state = () => ({ route: 'employee-ui', params: new URLSearchParams('t=tok-old') });
  assert.equal(ctx.euInvitation().expired, true, '过期 token 不进入填写页');
  run('euSession.key=""');
  assert.ok(ctx.euRender().includes('链接已过期'), '员工端显示链接已过期');
  ctx.state = () => ({ route: 'employee-ui', params: new URLSearchParams('') });
  ctx.euInvitation = keepInvitation;
}

/* 24. 有效期：未编辑的日期随正式文件刷新，只写实际修改项（HR-ONB-52） */
const e24 = seed('e24', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' }, docs: { id: { state: 'ok', file: 'passport-new.png', dataUrl: 'data:new-pp', at: '2026-11-06T10:00:00.000Z', expiry: '2031-01-01' } } });
const d24 = ctx.euBoundData({ employeeId: 'e24', profileEdited: [], profile: { passportExpiry: '2028-01-01' }, docs: { passport: { name: 'passport-old.png', at: '2026-01-01T00:00:00.000Z' } } });
assert.equal(d24.profile.passportExpiry, '2031-01-01', '没编辑过的日期要跟正式文件走');
const d24b = ctx.euBoundData({ employeeId: 'e24', profileEdited: ['passportExpiry'], profile: { passportExpiry: '2028-01-01' }, docs: { passport: { name: 'passport-old.png', at: '2026-01-01T00:00:00.000Z' } } });
assert.equal(d24b.profile.passportExpiry, '2031-01-01', '正式文件换新版本时，旧草稿日期不能让新版退回旧值');
d24.profile.passportExpiry = '2028-01-01';
ctx.euSyncDocs(d24, ['passport']);
assert.equal(emp('e24').docs.id.expiry, '2031-01-01', '未编辑日期不能把正式值写回旧值');
d24.profileEdited = ['passportExpiry'];
d24.profile.passportExpiry = '2027-12-31';
ctx.euSyncDocs(d24, ['passport']);
assert.equal(emp('e24').docs.id.expiry, '2027-12-31', '员工实际改过的日期要写入');

/* 25. 正式 isStudent=null 明确投影为空回答，旧 profile 的 yes 不再复活（HR-DOC-07） */
const e25 = seed('e25', { contract: { type: 'teilzeit', isStudent: null, nationalityClass: 'eu' } });
const d25 = ctx.euBoundData({ employeeId: 'e25', profile: { student: 'yes' }, docs: {} });
assert.equal(d25.profile.student, '', '正式 null 不能投影成已答“是”');
assert.equal(ctx.euStudentAnswer(d25), '');
assert.ok(!ctx.euDocumentList(d25).some(t => t.key === 'student'), '未回答学生身份不能要求在读证明');

/* 26. 关联确认后统一清理 linkPending/pendingLink/link.state（HR-ACCESS-43） */
const e26 = seed('e26', { account: { state: 'pending_link' }, invite: { portalVersion: 2, state: 'sent', accountLink: { state: 'pending' }, link: { state: 'pending' }, linkPending: true, pendingLink: true, submitted: {} } });
ctx.euSyncInvite({ employeeId: 'e26', accountLinkConfirmedAt: '2026-11-06T11:00:00.000Z' });
assert.equal(emp('e26').invite.accountLink.state, 'confirmed');
assert.equal(emp('e26').invite.link.state, 'confirmed');
assert.ok(!('linkPending' in emp('e26').invite) && !('pendingLink' in emp('e26').invite), '兼容标记要清掉');
assert.equal(ctx.euLinkPending({ employeeId: 'e26' }), false, '确认后不能还停在关联页');
assert.equal(emp('e26').account.state, 'active');

/* 27. 作废重发后旧本机签回草稿不能混入新发送（HR-ONB-37/53） */
const e27 = seed('e27', { status: 'approved', invite: { portalVersion: 2, state: 'approved', sentAt: '2026-11-06T10:00:00.000Z', contractSentAt: '2026-11-06T10:00:00.000Z', dispatchId: 'd-new', submitted: {} } });
const oldFile27 = { name: 'old.pdf', at: '2026-11-06T09:00:00.000Z', dispatchId: 'd-old' };
const currentFile27 = { name: 'new.pdf', at: '2026-11-06T11:00:00.000Z', dispatchId: 'd-new' };
const d27 = ctx.euBoundData({ employeeId: 'e27', docs: { contract: oldFile27, questionnaire: currentFile27 } });
assert.equal(d27.docs.contract, undefined, '旧发送的本机草稿要移除');
assert.equal(d27.docs.questionnaire.name, 'new.pdf', '当前发送的文件要保留');
const status27 = ctx.euContractStatus({ employeeId: 'e27', docs: { contract: oldFile27 } }, 'contract');
assert.equal(status27.state, 'missing');
assert.equal(status27.stale, true);
assert.equal(ctx.euContractFreshUpload({ employeeId: 'e27', docs: { contract: oldFile27 } }, 'contract', status27), false);
assert.equal(ctx.euContractFreshUpload({ employeeId: 'e27', docs: { contract: currentFile27 } }, 'contract', { state: 'missing' }), true, '带新 dispatchId/at 的重传要能通过');
assert.equal(ctx.euContractFileCurrent({ employeeId: 'e27', docs: {} }, 'contract', { name: 'no-id.pdf', at: '2026-11-06T10:30:00.000Z' }), false, '新发送已编号时，无编号旧件不能冒充当前件');
ctx.euSyncDocs({ employeeId: 'e27', docs: { contract: oldFile27 } }, ['contract']);
assert.equal(emp('e27').docs.contract, undefined, '旧件不能被同步写进正式档案');
const keepFileCurrent = ctx.empContractFileIsCurrent;
ctx.empContractFileIsCurrent = undefined;
assert.equal(ctx.euContractFileCurrent({ employeeId: 'e27', docs: {} }, 'contract', oldFile27), false, '无全局函数时旧 dispatchId 也判旧件');
assert.equal(ctx.euContractFileCurrent({ employeeId: 'e27', docs: {} }, 'contract', currentFile27), true);
ctx.empContractFileIsCurrent = keepFileCurrent;

/* 28. 演示状态使用独立员工副本与存储键，不写回真实档案（HR-ONB-52） */
const e28 = seed('e28', { invite: { portalVersion: 2, state: 'sent', employerCompleted: false, submitted: {} } });
run('euSession={step:"materials",tab:"tasks",key:"k28",demo:"company",task:null}');
const d28 = ctx.euData();
d28.confirmedCompanyProfileAt = '2026-11-06T12:00:00.000Z';
d28.demoCompanyConfirmedAt = '2026-11-06T12:00:00.000Z';
ctx.euSave(d28, { archive: true });
ctx.euPublishPortal(d28, { updateRequest: { state: 'pending', at: '2026-11-06T12:00:00.000Z', items: [] } });
assert.equal(emp('e28').invite.state, 'sent', '演示确认不能把真实邀请改成 approved');
assert.equal(emp('e28').employeePortal, undefined, '演示发布不能写真实门户');
assert.ok(run('Object.keys(empRead("kaispanEmployeeUIDemoScratchV1",{})).length') > 0, '演示副本要写独立存储键');
run('euSession={step:"register",tab:"tasks",key:null,demo:"",task:null}');

/* 29. 补件交回与老板端结果同 requestId；采纳/退回后不再保留旧投影（HR-ONB-43/44） */
const e29 = seed('e29', { status: 'active', request: { token: 'r29', state: 'submitted', sentAt: '2026-11-05T00:00:00.000Z', submitted: { docs: { id: { file: 'pp.png', at: '2026-11-06T09:00:00.000Z' } } } }, employeePortal: { supplementSubmission: { requestId: 'r29', status: 'submitted', at: '2026-11-06T09:00:00.000Z', submitted: { docs: {} } } } });
ctx.euSyncInvite({ employeeId: 'e29' });
assert.ok(emp('e29').employeePortal.supplementSubmission, '核对中的补件不能提前清掉');
emp('e29').request.state = 'done';
emp('e29').employeePortal.supplementSubmission.status = 'accepted';
const d29 = ctx.euBoundData({ employeeId: 'e29', docs: {}, supplementSubmission: { at: '2026-11-06T09:00:00.000Z' }, supplementReturnedAt: '2026-11-06T09:00:00.000Z' });
assert.equal(ctx.euSupplementRequest(d29), null, '老板端已采纳后不再显示补件请求');
assert.equal(d29.supplementSubmission, undefined, '本机旧交回记录要清掉');
ctx.euSyncInvite(d29);
assert.equal(emp('e29').employeePortal.supplementSubmission, undefined, '门店已处理的门户投影不再保留');
const e29b = seed('e29b', { status: 'active', contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' }, request: { token: 'r29b', state: 'sent', sentAt: '2026-11-05T00:00:00.000Z', items: [{ kind: 'doc', id: 'id' }] }, docs: { id: { file: 'old.png', at: '2026-01-01T00:00:00.000Z', expiry: '2031-01-01' } } });
const d29b = ctx.euBoundData({ employeeId: 'e29b', docs: {}, updateDraft: { profile: { passportExpiry: '2031-01-01' }, docs: { passport: { name: 'new.png', data: 'data:new', at: '2026-11-06T09:00:00.000Z' } }, keepExpiry: { passport: true }, keepReason: { passport: '证件未换新' } } });
const result29 = ctx.euSupplementSubmission(d29b, ctx.euSupplementRequest(d29b));
assert.deepEqual(result29.missing, []);
assert.equal(result29.sub.requestId, 'r29b');
assert.equal(result29.sub.docs.id.keepExpiry, true);
assert.equal(result29.sub.docs.id.keepReason, '证件未换新');
const prior29 = { state: 'returned', requestId: 'req-29', items: [{ key: 'phone', kind: 'field', from: '111', to: '222' }] };
const next29 = ctx.euBuildUpdateRequest(d29b, [{ key: 'phone', kind: 'field', from: '111', to: '333' }], prior29);
assert.equal(next29.requestId, 'req-29', '退回后重新提交沿用同一 requestId');

/* 30. 兼容只有 name 的提交格式：员工端同时写 name 与 firstName/lastName（HR-ONB-10/15） */
const e30 = seed('e30', { name: 'Old Name', firstName: 'Old', lastName: 'Name', invite: { portalVersion: 2, state: 'submitted', submitted: { name: 'New Name' } } });
const d30 = ctx.euBoundData({ employeeId: 'e30', name: 'Old Name', profile: {}, docs: {} });
assert.equal(d30.name, 'New Name', '只有 name 的提交也要显示新姓名');
assert.deepEqual([d30.profile.first, d30.profile.last], ['New', 'Name']);
const snap30 = ctx.euSubmissionSnapshot({ name: 'Solo Name', profile: {}, docs: {}, materialSubmitted: '2026-11-06T10:00:00.000Z' });
assert.equal(snap30.name, 'Solo Name');
assert.ok(snap30.firstName && snap30.lastName, '快照必须同时写 firstName/lastName');

/* 31. 资料退回卡按材料 ID 显示本地化名称，不透出 passport/hygiene 键（清单 10.6） */
const e31 = seed('e31', { invite: { portalVersion: 2, state: 'returned', returnItems: ['passport', 'hygiene', 'id'], submitted: {} } });
const d31 = ctx.euBoundData({ employeeId: 'e31', docs: {} });
assert.deepEqual(ctx.euReturnItemLabels(d31), ['护照 / 身份证', '食品卫生指导证明（健康证）', '护照 / 身份证']);
const banner31 = ctx.euReturnBanner(d31);
assert.ok(!/>passport<|>hygiene</.test(banner31), '退回卡不能显示英文键');

/* 32. 德/英新增整句翻译：过期链接、保留日期错误、医保卡正反面、缺项待办 */
run('euSession={step:"materials",tab:"docs",key:"kde3",demo:"",task:null};empWrite("kaispanEmployeeUIDemoV1",{kde3:{profile:{language:"Deutsch"}}})');
assert.notEqual(ctx.euT('链接已过期'), '链接已过期');
assert.notEqual(ctx.euT('这个邀请链接已超过 7 天有效期，请联系店长重新发送邀请。'), '这个邀请链接已超过 7 天有效期，请联系店长重新发送邀请。');
assert.notEqual(ctx.euT('现行版本没有可保留的有效期，请改填新有效期。'), '现行版本没有可保留的有效期，请改填新有效期。');
assert.notEqual(ctx.euT('医保卡正面照片'), '医保卡正面照片');
assert.notEqual(ctx.euT('医保卡反面照片'), '医保卡反面照片');
assert.notEqual(ctx.euT('第一层已齐，可以提交审核'), '第一层已齐，可以提交审核');
assert.ok(ctx.euTF('还缺 {n} 项：{items}{more}', { n: 2, items: 'Reisepass', more: '' }).includes('fehlen noch'));
const d32 = { name: 'Alex Chen', profile: { nationalityClass: 'eu' }, docs: {} };
const t32 = ctx.euDocumentList(d32).find(t => t.key === 'healthFront');
assert.ok(ctx.euDocRow(d32, t32).includes('Vorderseite'), '医保卡正面照片要走德语翻译');
const keepInvitation32 = ctx.euInvitation;
ctx.euInvitation = () => ({ expired: true, key: 'expired-link' });
const expiredHtml32 = ctx.euRender();
assert.ok(expiredHtml32.includes('Link abgelaufen'), '过期链接页要走德语翻译');
assert.ok(expiredHtml32.includes('älter als 7 Tage'));
ctx.euInvitation = keepInvitation32;
run('euSession={step:"register",tab:"tasks",key:null,demo:"",task:null}');

/* 33. 过期邀请不能再同步写成 submitted（HR-ACCESS-25） */
const e33 = seed('e33', { invite: { portalVersion: 2, state: 'sent', expiresAt: '2026-11-01T00:00:00.000Z', submitted: {} } });
ctx.euSyncInvite({ employeeId: 'e33', submitActionAt: '2026-11-06T10:00:00.000Z', materialSubmitted: '2026-11-06T10:00:00.000Z', submitted: { name: 'Alex Chen' } });
assert.equal(emp('e33').invite.state, 'sent', '过期邀请不能通过同步写入变成 submitted');

/* 34. 已核对通过的合同项不能被本机草稿替换（HR-ONB-53） */
const e34 = seed('e34', { status: 'approved', docs: { contract: { file: 'old.pdf', dataUrl: 'data:old', at: '2026-11-06T09:00:00.000Z' } }, invite: { portalVersion: 2, state: 'approved', sentAt: '2026-11-06T08:00:00.000Z', contractSentAt: '2026-11-06T08:00:00.000Z', dispatchId: 'd34', contractReview: { contract: { state: 'approved' } }, submitted: {} } });
const d34 = ctx.euBoundData({ employeeId: 'e34', docs: { contract: { name: 'new.pdf', data: 'data:new', at: '2026-11-06T11:00:00.000Z', dispatchId: 'd34' } } });
ctx.euSyncDocs(d34, ['contract']);
assert.equal(emp('e34').docs.contract.file, 'old.pdf', '已通过的合同不能被替换');
assert.equal(ctx.euContractStatus(d34, 'contract').state, 'approved');

/* 35. 员工保存草稿只向老板端发布三层完成度，不发布草稿值（HR-ONB-15/52） */
const e35 = seed('e35', { invite: { portalVersion: 2, state: 'sent', submitted: {} } });
const d35 = ctx.euBoundData({ employeeId: 'e35', profile: { first: 'Alex', last: 'Chen', birthday: '1990-01-01', phone: '222', nationalityClass: 'eu', student: 'no' }, profileEdited: ['first', 'last', 'birthday', 'phone', 'nationalityClass', 'student'], docs: {} });
ctx.euPublishDraftProgress(d35);
const progress35 = emp('e35').invite.draftProgress;
assert.equal(progress35.layers[1].total, 8);
assert.equal(progress35.layers[1].done, 4, '第一层：姓名/生日/国籍/学生已填，地址/IBAN/证件未填');
assert.equal(progress35.done, progress35.layers[1].done);
const progressText = JSON.stringify(progress35);
assert.ok(!/Alex|Chen|1990-01-01|222/.test(progressText), '草稿进度不能带草稿值');

console.log('PASS: fill mode flags, three-state nationality, onboarding draft isolation + frozen submission, returned no auto-resubmit, update request items/merge, supplement item checks, contract re-upload versioning, link-pending first, veteran archived end-state, two-file contract, approval states, demo skip, render smoke, round2 archive refresh/adopt freeze/name freeze/no request resurrection/docs draft/supplement version/link shell/company fill/i18n, round3 expiry refresh/student-null/link cleanup/dispatch currency/demo isolation/supplement requestId/name-only/return labels/round3 i18n/expired-submit/approved contract lock/draft progress only');
