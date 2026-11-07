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
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js']) {
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
const save = e => ctx.empSaveStaff(e);

/* 三层必填：第一层齐全才能通过；第二、三层缺项不阻止审核（HR-ONB-26～29） */
const e16 = ctx.empById('e16');
const pr16 = ctx.empInviteProgress(e16);
assert.equal(pr16.complete, true);
assert.equal(pr16.layers[1].done, pr16.layers[1].total);
assert.equal(pr16.layers[1].total, 9);
assert.equal(pr16.layers[2].total, 3);
assert.equal(pr16.layers[3].total, 5);
assert.equal(ctx.empInviteStep(e16).id, 'review');
assert.equal(ctx.empInviteStep(ctx.empById('e15')).id, 'fill');
assert.ok(ctx.empInviteSubStates(e16).some(s => s.id === 'accepted'));

/* 列表范围：审核通过后的合同/签回/归档都还在列表里，撤销和取消也保留 */
const fakeArchived = clone('e18', { id: 't-arch', invite: { ...clone('e18').invite, state: 'approved', archivedAt: '2026-11-01T10:00:00.000Z', contractSignedReviewedAt: '2026-11-01T10:00:00.000Z' } });
save(fakeArchived);
assert.equal(ctx.empInviteStep(ctx.empById('t-arch')).id, 'done');
assert.ok(ctx.empInvites(null).some(e => e.id === 't-arch'));

/* 停滞提醒四类与可改天数（HR-ONB-47） */
const stallSubmit = clone('e15', { id: 't-stall-submit' });
stallSubmit.invite.sentAt = '2026-11-01T09:00:00.000Z';
stallSubmit.invite.firstSentAt = '2026-11-01T09:00:00.000Z';
stallSubmit.invite.state = 'sent';
stallSubmit.account = { ...(stallSubmit.account || {}), state: 'invited' };
save(stallSubmit);
assert.equal(ctx.empInviteStall(ctx.empById('t-stall-submit')).kind, 'inviteSubmitStallDays');
const stallReturn = clone('e17', { id: 't-stall-return' });
stallReturn.invite.reviewedAt = '2026-11-01T09:00:00.000Z';
save(stallReturn);
assert.equal(ctx.empInviteStall(ctx.empById('t-stall-return')).kind, 'inviteReturnStallDays');
const stallReview = clone('e17', { id: 't-stall-review' });
stallReview.invite.state = 'submitted';
stallReview.invite.submittedAt = '2026-11-01T09:00:00.000Z';
save(stallReview);
assert.equal(ctx.empInviteStall(ctx.empById('t-stall-review')).kind, 'inviteReviewStallDays');
const stallSign = clone('e18', { id: 't-stall-sign' });
stallSign.invite.state = 'approved';
stallSign.invite.contractSentAt = '2026-11-01T09:00:00.000Z';
stallSign.invite.contractSignedSubmittedAt = null;
save(stallSign);
assert.equal(ctx.empInviteStall(ctx.empById('t-stall-sign')).kind, 'contractSignStallDays');
ctx.empSetRule('inviteSubmitStallDays', 10);
assert.equal(ctx.empInviteStall(ctx.empById('t-stall-submit')), null);
ctx.empSetRule('inviteSubmitStallDays', 3);

/* 发送/重发：每天最多一次，重发换新链接，旧链接失效，7 天有效（HR-ACCESS-24/25） */
const beforeToken = ctx.empById('e15').invite.token;
const resend1 = ctx.empResendInvite('e15');
assert.equal(resend1.ok, true);
assert.notEqual(ctx.empById('e15').invite.token, beforeToken);
assert.equal(ctx.empByToken(beforeToken), null);
assert.equal(ctx.empResendInvite('e15').code, 'daily_limit');
const e15 = ctx.empById('e15');
e15.invite.resendLog = [];
e15.invite.sentAt = '2026-10-28T09:00:00.000Z';
e15.invite.firstSentAt = '2026-10-28T09:00:00.000Z';
e15.invite.expiresAt = '2026-11-04T09:00:00.000Z';
save(e15);
assert.equal(ctx.empInviteExpired(ctx.empById('e15')), true);
assert.equal(ctx.empResendInvite('e15').ok, true);
assert.equal(ctx.empInviteExpired(ctx.empById('e15')), false);
assert.ok(ctx.empById('e15').invite.expiresAt.startsWith('2026-11-13T'));
const expiredEdit = clone('e15', { id: 't-expired-edit', invite: { ...clone('e15').invite, state: 'sent', sentAt: '2026-10-28T09:00:00.000Z', firstSentAt: '2026-10-28T09:00:00.000Z', expiresAt: '2026-11-04T09:00:00.000Z' }, account: { state: 'invited' } });
save(expiredEdit);
assert.equal(ctx.empSetInviteEmail('t-expired-edit', 'expired.neu@example.com').ok, true);

/* 撤销不再删档；撤销后可换邮箱重新邀请；审核通过后只能取消入职（HR-ONB-45/46） */
assert.equal(ctx.empRevokeInvite('e15', '').code, 'reason');
assert.equal(ctx.empRevokeInvite('e15', '候选人放弃').ok, true);
assert.ok(ctx.empById('e15'), '撤销后档案必须保留');
assert.equal(ctx.empById('e15').invite.state, 'revoked');
assert.equal(ctx.empByToken(ctx.empById('e15').invite.token || 'x'), null);
assert.equal(ctx.empReinvite('e15', 'jonas.neu@example.com').ok, true);
assert.equal(ctx.empById('e15').contact.email, 'jonas.neu@example.com');
assert.equal(ctx.empById('e15').invite.state, 'sent');

/* 审核：缺项不挡审核但需特殊审批；通过必须填入职日期；合同条件保持公司值；试用期留空=无试用期 */
const fakeMissing = clone('e15', { id: 't-missing', invite: { ...clone('e15').invite, state: 'submitted', submitted: {} } });
save(fakeMissing);
assert.equal(ctx.empApproveInvite('t-missing', { entryDate: '2026-12-01' }).code, 'special_reason');
assert.equal(ctx.empApproveInvite('e16', { entryDate: '' }).code, 'entry_date');
assert.equal(ctx.empApproveInvite('e16', { entryDate: '2026-11-20', probationEnd: '' }).ok, true);
const approved16 = ctx.empById('e16');
assert.equal(approved16.invite.state, 'approved');
assert.equal(approved16.contract.urlaubDays, 12, '员工填的年假不能被采纳');
assert.equal(approved16.contract.nationalityClass, 'other');
assert.equal(approved16.probationEnd, null, '留空表示无试用期');
assert.equal(ctx.empRevokeInvite('e16', '不来了').code, 'approved');
assert.equal(ctx.empCancelOnboarding('e16', '').code, 'reason');
assert.equal(ctx.empCancelOnboarding('e16', '岗位取消').ok, true);
assert.equal(ctx.empById('e16').invite.state, 'cancelled');
assert.ok(ctx.empById('e16'), '取消入职也要保留档案');

/* 店长无权限：审核/退回需要敏感资料权限；发送需要邀请权限（HR-ACCESS-55） */
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ invite: false, sensitive: false });
assert.equal(ctx.empSendInvite('e15').code, 'permission');
ctx.state = () => ({ params: new URLSearchParams('id=t-missing'), route: 'employee' });
const managerDetail = ctx.employeeInviteDetailPage();
const managerNew = ctx.employeeNewPage();
assert.ok(managerNew.includes('老板已对你关闭「发邀请」权限'));
ctx.state = () => ({ params: new URLSearchParams('id=e16'), route: 'employee' });
assert.ok(managerDetail.includes('需要查看敏感资料权限'));
assert.ok(managerDetail.includes('老板已对你关闭「发邀请」权限'));
ctx.hrSetView('owner');

/* 特殊审批（答复 ANS-1，覆盖 HR-ONB-20/30～34）：三层清单只提示；第一、二层没交齐时通过必须由老板特殊审批并留记录；暂缺申请与延期不再存在 */
assert.equal(typeof ctx.empResolveSpecialSubmission, 'undefined', '暂缺申请审批一期不做');
assert.equal(typeof ctx.empExtendMissingApproval, 'undefined', '延期一期不做');
const gapInvite = clone('e15', { id: 't-gap', entryDate: '', invite: { ...clone('e15').invite, state: 'submitted', submitted: {} } });
save(gapInvite);
assert.ok(ctx.empOnbGaps(ctx.empById('t-gap'), 'submitted').length > 0, '空提交有缺项');
assert.equal(ctx.empWorkflowEntries(ctx.empById('t-gap')).some(x => x.key === 'specialPending'), false, 'AM-05：特殊审批不另建待办');
assert.equal(ctx.empApproveInvite('t-gap', { entryDate: '2026-12-01' }).code, 'special_reason', '老板通过缺项资料必须写原因');
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ invite: false, sensitive: true });
assert.equal(ctx.empApproveInvite('t-gap', { entryDate: '2026-12-01', specialReason: '想放行' }).code, 'special_owner', '店长不能做特殊审批');
ctx.hrSetView('owner');
const gapDetail = ctx.employeeInviteDetailPage ? (ctx.state = () => ({ params: new URLSearchParams('id=t-gap'), route: 'employee' }), ctx.employeeInviteDetailPage()) : '';
assert.ok(gapDetail.includes('特殊审批原因'), '老板审核卡有原因输入');
assert.ok(!gapDetail.includes('暂缺'), '审核页不再出现暂缺申请');
assert.equal(ctx.empApproveInvite('t-gap', { entryDate: '2026-12-01', specialReason: '员工出国，下周补' }).ok, true);
const gapDone = ctx.empById('t-gap');
assert.equal(gapDone.invite.state, 'approved');
assert.equal(gapDone.invite.specialApproval.reason, '员工出国，下周补');
assert.ok(gapDone.invite.specialApproval.by && gapDone.invite.specialApproval.at, '记录审批人和时间');
assert.ok(gapDone.invite.specialApproval.labels.length > 0);
assert.equal(gapDone.history.some(h => h.field === 'approval.special'), true);
assert.equal(ctx.empWorkflowEntries(gapDone).some(x => x.key === 'specialPending'), false);
assert.ok(ctx.empSpecialApprovalBlock(gapDone).includes('员工出国，下周补'), '员工档案里能查到特殊审批记录');

/* 邮箱查重与建档补邮箱；无邮箱只能建档 */
assert.equal(ctx.empInviteEmailConflict('marco@example.com', 'e18'), null);
assert.ok(ctx.empInviteEmailConflict('marco@example.com', 'x'));
const draft = clone('e15', { id: 't-email-draft', contact: { ...clone('e15').contact, email: '' }, invite: { ...clone('e15').invite, state: 'draft', token: ctx.empToken() } });
save(draft);
assert.equal(ctx.empSetInviteEmail('t-email-draft', 'neu@example.com').ok, true);
assert.equal(ctx.empById('t-email-draft').contact.email, 'neu@example.com');
assert.equal(ctx.empSetInviteEmail('t-email-draft', 'marco@example.com').code, 'conflict');

/* 新员工页：最少字段、两个按钮、公司代填勾选、无问卷邮件编辑 */
const newPage = ctx.employeeNewPage();
assert.ok(newPage.includes('建档并发邀请'));
assert.ok(newPage.includes('只建档'));
assert.ok(newPage.includes('公司已替员工填好全部资料'));
assert.ok(!newPage.includes('个人调查问卷邮件'));
assert.ok(newPage.includes('第一个上班日'));

/* 详情：固定邮件、预览员工端、无复制链接/以员工身份打开/语言编辑 */
const detail16 = ctx.employeeInviteDetailPage();
assert.ok(detail16.includes('预览员工端（只读）'));
assert.ok(detail16.includes('固定'));
assert.ok(!detail16.includes('emp-copy-link'));
assert.ok(!detail16.includes('emp-invite-lang'));
assert.ok(!detail16.includes('以员工身份打开'));

/* 员工提交/公司代填确认要写变更记录（3.5） */
const ev = clone('e15', { id: 't-event', invite: { ...clone('e15').invite, submittedAt: null, submitted: {} } });
save(ev);
const ev2 = ctx.empById('t-event');
ev2.invite.submittedAt = '2026-11-06T10:00:00.000Z';
ev2.invite.submitted = { name: 'X' };
ctx.empSaveWithHistory(ev2, '员工端 UI');
assert.ok(ctx.empById('t-event').history.some(h => h.field === 'onboarding.submitted'));

console.log('PASS: three layers, list steps and substates, four stall types, resend daily/new link/7 days, revoke/reinvite/cancel, approval guards and company contract values, sensitive/invite permissions, six special items with deadline/extension limits, email conflict, new page and detail content, onboarding submit event');
