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
const ctx = vm.createContext({ console, URLSearchParams, localStorage });
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
ctx.slug = (a, b) => `${a}-${b}`;
ctx.empScope = () => null;
ctx.state = () => ({ params: new URLSearchParams(''), route: 'employee' });
let now = '2026-11-06T12:00:00.000Z';
ctx.empNow = () => now;
ctx.empToday = () => '2026-11-06';
ctx.hrSetView('owner');
ctx.empAllStaff();

const clone = (id, patch) => {
  const base = ctx.empById(id);
  const next = JSON.parse(JSON.stringify(base));
  Object.assign(next, patch || {});
  if (next.id !== base.id) {
    next.contact = { ...(next.contact || {}), email: `${next.id}@example.com` };
    if (next.invite) next.invite = { ...next.invite, token: ctx.empToken() };
    if (next.account) next.account = { ...next.account, email: next.contact.email, user: next.contact.email };
  }
  ctx.empSaveStaff(next);
  return next;
};

/* ========================= 第 2 批（合同与入职）========================= */

/* 1. 实际写入入口校验权限与字段；提案只接收合同条件（HR-ACCESS-07、HR-LIFE-10/13） */
const leaveTarget = clone('e07', { id: 'c-leave' });
ctx.hrSetView('manager');
assert.equal(ctx.empApplyLeave('c-leave', { who: 'employee', noticeDate: '2026-11-06', lastDay: '2026-12-31' }).code, 'permission');
assert.equal(ctx.empSetLeave('c-leave', { noticeDate: '2026-11-06', lastDay: '2026-12-31' }).code, 'who');
assert.equal(ctx.empSetLeave('c-leave', { who: 'employee', lastDay: '2026-12-31' }).code, 'notice');
assert.equal(ctx.empSetLeave('c-leave', { who: 'employee', noticeDate: '2026-11-06', lastDay: '2026-11-31' }).code, 'last_day');
assert.equal(ctx.empSetLeave('c-leave', { who: 'employee', noticeDate: '2026-11-06', lastDay: '2026-12-31' }).proposal, true);
assert.equal(ctx.empById('c-leave').leave, null);

const propTarget = clone('e08', { id: 'c-prop', entryDate: '2022-01-01', probationEnd: null });
const propBefore = Number(ctx.empById('c-prop').contract.rate);
const propNext = JSON.parse(JSON.stringify(ctx.empById('c-prop')));
propNext.contract.rate = 21;
propNext.contract.validFrom = '2026-11-06';
propNext.probationEnd = '2027-06-30';
propNext.entryDate = '2020-01-01';
const propChanges = ctx.empContractConditionChanges(ctx.empById('c-prop').contract, ctx.empPrepareContractForSave(propNext.contract));
assert.equal(ctx.empSubmitContractProposal(ctx.empById('c-prop'), propNext, propChanges, '2026-11-06').ok, true);
assert.equal(ctx.empById('c-prop').probationEnd, null, '提案不能改试用期');
assert.equal(ctx.empById('c-prop').entryDate, '2022-01-01', '提案不能改入职日');
assert.equal(ctx.empSubmitContractProposal(ctx.empById('c-prop'), propNext, propChanges, '2026-11-06').code, 'proposal_pending');

/* 2. 提案基线：提交后档案被改过就拒绝确认，提案保留（HR-ACCESS-07/56） */
ctx.hrSetView('owner');
const changed = JSON.parse(JSON.stringify(ctx.empById('c-prop')));
changed.contract.hoursMax = 120;
ctx.empSaveStaff(changed);
assert.equal(ctx.empConfirmContractProposal('c-prop').code, 'stale');
assert.equal(ctx.empById('c-prop').contractProposal.state, 'pending');
assert.equal(ctx.empById('c-prop').contract.rate, propBefore);

/* 3. 未来生效版本不覆盖今天的 e.contract；到生效日才切换（HR-CONTRACT-03） */
const future = clone('e09', { id: 'c-future' });
const futureRate = Number(ctx.empById('c-future').contract.rate);
assert.equal(ctx.empRequestContractChange('c-future', { rate: 25 }, '明年涨薪', '2027-01-01').ok, true);
assert.equal(ctx.empById('c-future').contract.rate, futureRate);
const f = ctx.empById('c-future');
assert.equal(ctx.empContractVersionAt(f, '2026-11-06').data.rate, futureRate);
assert.equal(ctx.empContractVersions(f).some(v => v.validFrom === '2027-01-01' && Number(v.data.rate) === 25), true);
const futureCopy = JSON.parse(JSON.stringify(f));
assert.equal(ctx.empSyncEffectiveContract(futureCopy, '2027-01-02'), true);
assert.equal(futureCopy.contract.rate, 25);

/* 14. 续签/转不定期必须给有效生效日期，且不得早于入职日（HR-LIFE-37、HR-CONTRACT-02） */
assert.equal(ctx.empRequestContractChange('c-future', { befristetUntil: null }, '', '').code, 'date');
const lateEntry = clone('e10', { id: 'c-late-entry', entryDate: '2026-12-01' });
assert.equal(ctx.empRequestContractChange(lateEntry.id, { befristetUntil: null }, '', '2026-11-06').code, 'before_entry');

/* 4. 合同核对绑定当前发送记录、两份齐备、退回后必须重传（HR-ONB-36/37/53） */
const asset = clone('e18', { id: 'c-asset', invite: { portalVersion: 2, state: 'approved', submitted: {}, contractTemplate: { name: 'v.pdf' }, questionnaireTemplate: { name: 'q.pdf' } } });
assert.equal(ctx.empReviewContractAsset(asset.id, 'contract', 'approved', '').code, 'state');
assert.equal(ctx.empSendContractDispatch(asset.id).ok, true);
let a = ctx.empById(asset.id);
/* 签回件晚于 12:00 的发送时间（HR-ONB-37/53） */
a.docs.contract = { state: 'ok', file: 'v_signed.pdf', at: '2026-11-06T12:05:00.000Z' };
a.invite.contractSignedSubmittedAt = '2026-11-06T12:05:00.000Z';
ctx.empSaveStaff(a);
assert.equal(ctx.empReviewContractAsset(asset.id, 'contract', 'approved', '').code, 'files', '两份没齐不能通过');
a = JSON.parse(JSON.stringify(ctx.empById(asset.id)));
a.docs.personalquestionnaire = { state: 'ok', file: 'q_signed.pdf', at: '2026-11-06T12:05:00.000Z' };
ctx.empSaveStaff(a);
assert.equal(ctx.empReviewContractAsset(asset.id, 'contract', 'approved', '').ok, true);
assert.equal(ctx.empReviewContractAsset(asset.id, 'contract', 'approved', '').code, 'decided');
/* 退回时间晚于签回件上传时间，同一份文件才算“未重传”（HR-ONB-53） */
now = '2026-11-06T12:10:00.000Z';
assert.equal(ctx.empReviewContractAsset(asset.id, 'questionnaire', 'returned', '缺签字').ok, true);
assert.equal(ctx.empReviewContractAsset(asset.id, 'questionnaire', 'approved', '').code, 'reupload', '未重传不能再通过');

/* 5. 作废要完整清掉线上/线下归档标记（HR-ONB-37/53） */
const offline = clone('e18', { id: 'c-offline' });
assert.equal(ctx.empOfflineContractArchive(offline.id, { name: 'c.pdf' }, { name: 'q.pdf' }).ok, true);
assert.equal(ctx.empContractArchived(ctx.empById(offline.id)), true);
assert.equal(ctx.empVoidContractDispatch(offline.id, '签名页缺页').ok, true);
assert.equal(ctx.empById(offline.id).invite.dispatchMode, '');
assert.equal(ctx.empById(offline.id).invite.offlineSignedAt, null);
assert.equal(ctx.empContractArchived(ctx.empById(offline.id)), false);
assert.equal(ctx.empContractSignedDoc(ctx.empById(offline.id), 'contract').file, undefined);

/* 6. 试用期默认结束日统一算法：3/15、8/31、闰年 2/29（HR-LIFE-06） */
assert.equal(ctx.empProbationDefaultEndAt('2026-03-15', 6), '2026-09-14');
assert.equal(ctx.empProbationDefaultEndAt('2026-08-31', 6), '2027-02-27');
assert.equal(ctx.empProbationDefaultEndAt('2028-02-29', 6), '2028-08-28');

/* 7. 试用期内取“法定通知期”和“合同通知期”中较晚者（HR-LIFE-15） */
const noticeEmp = { entryDate: '2026-09-01', probationEnd: '2027-02-28', contract: { noticePeriod: '3 Monate zum Monatsende' } };
const later = ctx.empEarliestLastDay(noticeEmp, '2026-11-06', 'employee');
assert.equal(later.inProbation, true);
assert.equal(later.earliest, '2027-02-28');

/* 8. 离职必填项缺失直接拒绝；默认值只放表单预填（HR-LIFE-13） */
assert.equal(ctx.empSetLeave('c-leave', { who: '', noticeDate: '', lastDay: '2026-12-01' }).code, 'who');
assert.equal(ctx.empSetLeave('c-leave', { who: 'employee', noticeDate: '', lastDay: '2026-12-01' }).code, 'notice');

/* 9. 离职交接、保存期、店长提案、特殊审批、入职当天未办完都进待办（3.3-2/9/10/12） */
const left = clone('e14', {
  id: 'c-left',
  leave: { who: 'employee', noticeDate: '2014-01-01', lastDay: '2015-01-01' },
  leaveHandover: { items: {}, createdAt: '2015-01-01T09:00:00.000Z', doneAt: '' },
  retentionHandled: {}
});
assert.equal(ctx.empRetentionRows(left).length, 5);
assert.equal(ctx.empRetentionRows(left).every(r => r.until <= '2026-11-06'), true);
const proposalHold = clone('e11', {
  id: 'c-hold',
  contractProposal: { state: 'pending', at: '2026-11-05T09:00:00.000Z', by: '店长', validFrom: '2026-11-06', changes: [], data: {} }
});
const specialTodo = clone('e12', {
  id: 'c-special-todo',
  missingApprovals: [{ item: 'steuerId', label: 'Steuer-ID', status: 'approved', deadline: '2026-10-01', extensionCount: 0 }],
  employeePortal: { specialSubmission: { state: 'pending', items: ['rentenversicherung'], labels: ['SV-Nr.'], reason: '在办', at: '2026-11-05T09:00:00.000Z' } }
});
/* 这一项必须真的还缺，逾期待办才算成立（补齐后待办自动消失，HR-ONB-32） */
delete specialTodo.ids.steuerId;
delete specialTodo.ids.steuernummer;
ctx.empSaveStaff(specialTodo);
const newHireToday = clone('e18', { id: 'c-newhire-today', entryDate: '2026-11-06' });
const todos = ctx.empTodoItems();
assert.ok(todos.some(t => t.type === '离职交接未办完'));
assert.ok(todos.some(t => t.type === '离职资料保存期到期'));
assert.ok(todos.some(t => t.type === '店长合同提案待老板确认'));
assert.ok(todos.some(t => t.type === '特殊审批逾期未补交'));
assert.ok(todos.some(t => t.type === '特殊审批待批'));
const newHireAlert = ctx.empAlertsFor(ctx.empById('c-newhire-today'), '2026-11-06').find(x => x.kind === 'newhire');
assert.equal(newHireAlert.level, 'expired', '入职当天仍未办完就算逾期');

/* 10. 保存期按类别：五类各自年限，处理记录按类别（HR-LIFE-42、HR-DATA-01/04） */
assert.equal(ctx.empRetentionYears('contract'), ctx.empRetentionYears('documents'));
assert.equal(ctx.empRetentionHandledFor(left, 'contract'), null);
assert.ok(ctx.empMarkRetentionHandled('c-left', 'contract'));
assert.ok(ctx.empRetentionHandledFor(ctx.empById('c-left'), 'contract'));
assert.equal(ctx.empRetentionHandledFor(ctx.empById('c-left'), 'payroll'), null);

/* 11. 员工编号按完整重聘链识别同一个人（HR-LIFE-32、HR-CONTRACT-17） */
const seg1 = clone('e14', { id: 'c-seg1', employeeNo: '9001', store: 'Martin Cafe', leave: { who: 'employee', noticeDate: '2024-01-01', lastDay: '2024-12-31' } });
const seg2 = clone('e14', { id: 'c-seg2', employeeNo: '9001', store: 'Martin Cafe', rehireOf: 'c-seg1', status: 'left', leave: { who: 'employee', noticeDate: '2024-12-01', lastDay: '2025-12-31' } });
seg1.rehiredBy = 'c-seg2';
ctx.empSaveStaff(seg1);
const seg3 = clone('e14', { id: 'c-seg3', employeeNo: '9001', store: 'Martin Cafe', rehireOf: 'c-seg2' });
assert.equal(ctx.empEmployeeNoConflict(ctx.empById('c-seg3'), '9001'), null, '第三段不能跟第一段冲突');

/* 12. 学生工周工时用未舍入值比较（HR-CONTRACT-06/12） */
const hint = ctx.empContractHint({ contract: { type: 'werkstudent', hoursMax: 86.8, rate: 14 }, role: 'front', entryDate: '2026-01-01' });
assert.ok(hint.includes('已超过'));
assert.ok(hint.includes('20.03'));

/* 13. 每次保存新增一版，同内容同生效日也追加（HR-CONTRACT-02） */
const ver = clone('e13', { id: 'c-ver' });
const verTarget = ctx.empById('c-ver');
const beforeCount = ctx.empContractVersions(verTarget).length;
ctx.empPushContractVersion(verTarget, '2026-11-06', '老板', verTarget.contract);
ctx.empPushContractVersion(verTarget, '2026-11-06', '老板', verTarget.contract);
assert.equal(ctx.empContractVersions(verTarget).length, beforeCount + 2);

/* ========================= 第 3 批（新增员工与邀请）========================= */

/* 1. 对照表两列都脱敏（HR-ACCESS-55） */
const maskEmp = clone('e16', { id: 'v-mask' });
maskEmp.birthday = '1980-02-02';
maskEmp.ids.iban = 'DE00SECRETIBAN00000000';
maskEmp.invite.submitted.birthday = '1980-02-02';
maskEmp.invite.submitted.ids.iban = 'DE00SECRETIBAN00000000';
ctx.empSaveStaff(maskEmp);
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: false });
ctx.state = () => ({ params: new URLSearchParams('id=v-mask'), route: 'employee' });
const maskedPage = ctx.employeeInviteDetailPage();
assert.ok(!maskedPage.includes('1980-02-02'));
assert.ok(!maskedPage.includes('DE00SECRETIBAN00000000'));
ctx.hrSetView('owner');
ctx.hrSetMgrPerm({ sensitive: true });

/* 2. 申请理由和时间线自由文本统一转义（存储型脚本注入） */
const xss = clone('e16', { id: 'v-xss' });
xss.invite.state = 'submitted';
xss.employeePortal = { specialSubmission: { state: 'pending', items: ['steuerId'], labels: ['Steuer-ID'], reason: '<img src=x onerror=alert(1)>', at: '2026-11-05T09:00:00.000Z' } };
ctx.empSaveStaff(xss);
ctx.state = () => ({ params: new URLSearchParams('id=v-xss'), route: 'employee' });
const xssPage = ctx.employeeInviteDetailPage();
assert.ok(!xssPage.includes('<img src=x onerror=alert(1)>'));
assert.ok(xssPage.includes('&lt;img src=x onerror=alert(1)&gt;'));

/* 3. 发送邀请：首次只允许未发送的草稿；已接受/已退回不能直接重发（HR-ACCESS-24/53） */
const draftInv = clone('e15', { id: 'v-draft', invite: { ...clone('e15').invite, state: 'draft', token: ctx.empToken() } });
assert.equal(ctx.empSendInvite(draftInv.id).ok, true);
assert.equal(ctx.empSendInvite(draftInv.id).code, 'state');
const acceptedInv = clone('e17', { id: 'v-accepted', invite: { ...clone('e17').invite, state: 'returned' } });
assert.equal(ctx.empSendInvite(acceptedInv.id, { resend: true }).code, 'accepted');
assert.equal(ctx.empById(acceptedInv.id).invite.state, 'returned');

/* 4. 完整到期时间判断：到期当天过了具体时刻就失效（HR-ACCESS-25） */
const exp = clone('e15', { id: 'v-exp', invite: { ...clone('e15').invite, state: 'sent', sentAt: '2026-11-01T09:00:00', firstSentAt: '2026-11-01T09:00:00', expiresAt: '2026-11-08T09:00:00' }, account: { state: 'invited' } });
/* expiresAt 存的是本地时间字符串，比较时两边都交给 Date 解析，不能直接比字符串 */
const beforeEnd = new Date('2026-11-08T08:59:59').toISOString();
const afterEnd = new Date('2026-11-08T09:00:01').toISOString();
assert.equal(ctx.empInviteExpiredAt(ctx.empById('v-exp'), beforeEnd), false);
assert.equal(ctx.empInviteExpiredAt(ctx.empById('v-exp'), afterEnd), true);
now = afterEnd;
assert.equal(ctx.empSubmitInvite(ctx.empById('v-exp').invite.token), null, '过期 token 不能提交');
now = '2026-11-06T12:00:00.000Z';

/* 5/11. 草稿与提交快照分开；未提交时进度读草稿，审核区不读草稿值（HR-ONB-15/55） */
const draftSep = clone('e17', { id: 'v-draft-sep' });
ctx.empSaveInviteDraft(draftSep.invite.token, { name: 'Draft Name' });
assert.equal(ctx.empById('v-draft-sep').invite.submitted.name, 'Ben');
assert.equal(ctx.empInviteView(ctx.empById('v-draft-sep'), 'submitted').name, 'Ben');
const sentDraft = clone('e16', { id: 'v-sent-draft' });
sentDraft.invite.state = 'sent';
sentDraft.invite.draft = { ...sentDraft.invite.submitted, name: 'Draft Name' };
ctx.empSaveStaff(sentDraft);
assert.equal(ctx.empInviteProgress(ctx.empById('v-sent-draft')).complete, true, '草稿完成度要能算出来');
assert.equal(ctx.empInviteView(ctx.empById('v-sent-draft'), 'submitted').name, 'Yuki', '审核区读提交快照');
assert.equal(ctx.empInviteView(ctx.empById('v-sent-draft'), 'draft').name, 'Draft Name');

/* 6. 被驳回的暂缺项按必交项处理，不能通过（HR-ONB-32） */
const rejected = clone('e16', { id: 'v-rejected' });
rejected.invite.state = 'submitted';
delete rejected.invite.submitted.ids.steuernummer;
rejected.missingApprovals = [{ item: 'steuerId', label: 'Steuer-ID', status: 'rejected', reason: '不接受' }];
ctx.empSaveStaff(rejected);
assert.equal(ctx.empApproveInvite('v-rejected', { entryDate: '2026-12-01' }).code, 'special_rejected');
ctx.state = () => ({ params: new URLSearchParams('id=v-rejected'), route: 'employee' });
assert.ok(ctx.employeeInviteDetailPage().includes('暂缺申请被驳回的项还没补齐'));

/* 7. 同一项不能重复审批；延期只能走延期函数（HR-ONB-34） */
const twice = clone('e18', {
  id: 'v-twice',
  entryDate: '2026-11-20',
  invite: { ...clone('e18').invite, state: 'approved', approvedAt: '2026-11-01T09:00:00.000Z' },
  employeePortal: { specialSubmission: { state: 'pending', items: ['steuerId', 'rentenversicherung'], labels: ['Steuer-ID', 'SV-Nr.'], reason: '在办', at: '2026-11-05T09:00:00.000Z' } }
});
assert.equal(ctx.empResolveSpecialSubmission('v-twice', 'approved', '2026-12-06', '', 'steuerId').ok, true);
assert.equal(ctx.empResolveSpecialSubmission('v-twice', 'approved', '2026-12-10', '', 'steuerId').code, 'decided');
assert.equal(ctx.empExtendMissingApproval('v-twice', 'steuerId', '2026-12-20', '宽限').ok, true);
assert.equal(ctx.empResolveSpecialSubmission('v-twice', 'approved', '2026-12-25', '', 'steuerId').code, 'decided');

/* 8. 改入职日期后，未结束的暂缺期限按新的“入职日 + 60 天”收紧（HR-ONB-34） */
const recheck = clone('e16', { id: 'v-recheck' });
recheck.invite.state = 'submitted';
recheck.entryDate = '2026-11-20';
recheck.missingApprovals = [{ item: 'steuerId', label: 'Steuer-ID', status: 'approved', deadline: '2027-01-19', extensionCount: 0 }];
ctx.empSaveStaff(recheck);
assert.equal(ctx.empApproveInvite('v-recheck', { entryDate: '2026-10-01' }).ok, true);
assert.equal(ctx.empById('v-recheck').missingApprovals[0].deadline, '2026-11-30');

/* 9. 审核通过时 first/last 同步生成 name（HR-ONB-10/22） */
const named = clone('e16', { id: 'v-name' });
named.invite.state = 'submitted';
named.invite.submitted.name = 'New Name';
named.invite.submitted.firstName = 'New';
named.invite.submitted.lastName = 'Name';
ctx.empSaveStaff(named);
assert.equal(ctx.empApproveInvite('v-name', { entryDate: '2026-11-20' }).ok, true);
assert.equal(ctx.empById('v-name').name, 'New Name');
assert.equal(ctx.empById('v-name').firstName, 'New');
/* 员工端资料修改被采纳后同样重算 name（不是只写 first/last 留下旧姓名） */
const adopt = clone('e18', { id: 'v-adopt', firstName: 'Old', lastName: 'Name', name: 'Old Name' });
adopt.employeePortal = { updateRequest: { state: 'pending', at: '2026-11-05T09:00:00.000Z', items: [
  { kind: 'field', key: 'first', to: 'New' }, { kind: 'field', key: 'last', to: 'Person' }
] } };
ctx.empSaveStaff(adopt);
assert.equal(ctx.empAcceptReview('v-adopt').ok, true);
assert.equal(ctx.empById('v-adopt').name, 'New Person');

/* 10. 取消入职保留平台账号状态，名册和提醒不再继续（HR-ONB-46、HR-ACCESS-40） */
const cancel = clone('e18', { id: 'v-cancel', account: { state: 'accepted', email: 'v-cancel@example.com', user: 'v-cancel@example.com' } });
assert.equal(ctx.empCancelOnboarding('v-cancel', '岗位取消').ok, true);
assert.equal(ctx.empById('v-cancel').account.state, 'accepted');
assert.equal(ctx.empById('v-cancel').status, 'invited');
assert.equal(ctx.empRosterVisible().some(e => e.id === 'v-cancel'), false);

/* 12. 审批结果由管理端持有；员工端旧 pending 副本不能写回（HR-ONB-31/32） */
const held = clone('e18', {
  id: 'v-held',
  missingApprovals: [{ item: 'steuerId', label: 'Steuer-ID', status: 'approved', deadline: '2026-12-06', extensionCount: 0 }],
  employeePortal: { specialSubmission: { state: 'approved', items: ['steuerId'], labels: ['Steuer-ID'], resolutions: [{ item: 'steuerId', status: 'approved', deadline: '2026-12-06' }], at: '2026-11-05T09:00:00.000Z' } }
});
ctx.euSyncInvite({ employeeId: 'v-held', key: 'v-held-key', specialSubmission: { state: 'pending', items: ['steuerId'], labels: ['Steuer-ID'] } });
assert.equal(ctx.empById('v-held').employeePortal.specialSubmission.state, 'approved');

/* 13. 补交日必须是真实日历日期，空值不再自动批准（HR-ONB-32） */
const badDate = clone('e18', {
  id: 'v-bad-date',
  entryDate: '2026-11-20',
  employeePortal: { specialSubmission: { state: 'pending', items: ['steuerId'], labels: ['Steuer-ID'], reason: '在办', at: '2026-11-05T09:00:00.000Z' } }
});
assert.equal(ctx.empResolveSpecialSubmission('v-bad-date', 'approved', '2026-11-31', '', 'steuerId').code, 'deadline');
assert.equal(ctx.empResolveSpecialSubmission('v-bad-date', 'approved', '', '', 'steuerId').code, 'deadline');

/* 15. 合同差异比较补上合同类型、月工时下限、岗位（HR-ONB-10） */
const compare = clone('e16', { id: 'v-compare' });
compare.invite.submitted.contract = { ...(compare.invite.submitted.contract || {}), type: 'vollzeit', hoursMin: 120, position: 'Koch' };
ctx.empSaveStaff(compare);
const cmp = ctx.empInviteCompare(ctx.empById('v-compare'));
assert.ok(cmp.contractRows.some(r => r.label.includes('合同类型')));
assert.ok(cmp.contractRows.some(r => r.label.includes('月工时下限')));
assert.ok(cmp.contractRows.some(r => r.label.includes('岗位')));

/* 16. 重发后时间线仍保留首次发送（HR-ACCESS-24） */
const timeline = clone('e15', {
  id: 'v-timeline',
  invite: { ...clone('e15').invite, state: 'sent', sentAt: '2026-11-06T09:00:00.000Z', firstSentAt: '2026-11-01T09:00:00.000Z', resendLog: [{ at: '2026-11-06T09:00:00.000Z', kind: 'resend', result: 'sent' }] }
});
const tl = ctx.empInviteTimeline(ctx.empById('v-timeline'));
assert.ok(tl.includes('11-01') || tl.includes('01.11'), '首次发送时间不能消失');
assert.ok(tl.includes('重发'));

console.log('PASS: batch2 permissions/baseline/future-version/asset-state/void/probation/notice/leave/todos/retention/rehire-number/werkstudent/versions; batch3 masking/xss/send-state/expiry/draft/rejected-special/repeat-decision/deadline-recheck/name/cancel/held-approval/date/compare/timeline');
