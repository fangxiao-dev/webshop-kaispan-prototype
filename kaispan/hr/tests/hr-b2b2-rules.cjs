process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, URLSearchParams });
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
ctx.slug = (a, b) => `${a}-${b}`;
ctx.empToday = () => '2026-11-06';
ctx.empScope = () => null;
ctx.empAllStaff();

/* 试用期默认结束日 = 入职 + 月数 − 1 天；有效结束日不超过入职 + 6 个月（HR-LIFE-06/08 ★3.1） */
assert.equal(ctx.empProbationDefaultEndAt('2026-03-15', 6), '2026-09-14');
assert.equal(ctx.empProbationMaxEnd({ entryDate: '2026-03-15' }), '2026-09-14');
assert.equal(ctx.empProbationEndEffective({ entryDate: '2026-03-15', probationEnd: '2027-01-01' }), '2026-09-14');
assert.equal(ctx.empProbationEndEffective({ entryDate: '2026-03-15', probationEnd: '2026-08-31' }), '2026-08-31');

/* 通知期结构化：解析 / 生成 / 最早最后工作日（HR-CONTRACT-08 ★3.2、HR-LIFE-15） */
assert.deepEqual(ctx.empNoticeStruct({ noticePeriod: '4 Wochen zum 15. oder Monatsende' }),
  { format: 'struct', unit: 'weeks', count: 4, cutoff: 'midmonth' });
assert.deepEqual(ctx.empNoticeStruct({ noticePeriod: '3 Monate zum Monatsende' }),
  { format: 'struct', unit: 'months', count: 3, cutoff: 'end' });
assert.deepEqual(ctx.empNoticeStruct({ noticePeriod: 'jederzeit' }), { format: 'text', unit: 'weeks', count: 0, cutoff: 'none' });
assert.equal(ctx.empNoticeText({ format: 'struct', unit: 'weeks', count: 4, cutoff: 'midmonth' }), '4 Wochen zum 15. oder Monatsende');
assert.equal(ctx.empNoticeText({ format: 'struct', unit: 'months', count: 3, cutoff: 'end' }), '3 Monate zum Monatsende');
assert.equal(ctx.empNoticeEarliestDate('2026-11-06', { format: 'struct', unit: 'weeks', count: 4, cutoff: 'midmonth' }), '2026-12-15');
assert.equal(ctx.empNoticeEarliestDate('2026-11-06', { format: 'struct', unit: 'months', count: 3, cutoff: 'end' }), '2027-02-28');

/* 试用期内按周数算；“是否试用期内”由通知日判断（HR-LIFE-12 ★3.3） */
const e18 = ctx.empById('e18');
const hintIn = ctx.empEarliestLastDay({ ...e18, entryDate: '2026-09-01', probationEnd: '2027-02-28' }, '2026-11-06', 'company');
assert.equal(hintIn.inProbation, true);
assert.equal(hintIn.earliest, '2026-11-20');

/* 离职：最后工作日当天仍在岗，次日起已离职（HR-LIFE-02/18） */
assert.equal(ctx.empSetLeave('e18', { who: 'employee', noticeDate: '2026-11-01', lastDay: '2026-11-30', reason: '' }).ok, true);
assert.equal(ctx.empById('e18').status, 'leaving');
assert.equal(ctx.empStaff('Martin Biergarten').some(x => x.id === 'e18'), true);
ctx.empSetLeave('e18', { who: 'employee', noticeDate: '2026-10-01', lastDay: '2026-11-06' });
assert.equal(ctx.empById('e18').status, 'leaving');
ctx.empSetLeave('e18', { who: 'employee', noticeDate: '2026-10-01', lastDay: '2026-11-05' });
assert.equal(ctx.empById('e18').status, 'left');
assert.equal(ctx.empStaff('Martin Biergarten').some(x => x.id === 'e18'), false);

/* 撤销必须写原因；交接四项全勾才算办完（HR-LIFE-29、HR-LIFE-39 ★3.7） */
assert.equal(ctx.empUndoLeave('e18', '').code, 'reason_required');
assert.equal(ctx.empUndoLeave('e18', '录入错误').ok, true);
assert.equal(ctx.empHandoverDone(ctx.empById('e18')), false);
['keys', 'hours', 'finalPay', 'certificate'].forEach(k => ctx.empSetHandoverItem('e18', k, true));
assert.equal(ctx.empHandoverDone(ctx.empById('e18')), true);

/* 离职校验：最后工作日不早于通知日；早于参考日期必须写原因（HR-LIFE-13/14） */
assert.equal(ctx.empSetLeave('e18', { who: 'employee', noticeDate: '2026-11-10', lastDay: '2026-11-09' }).code, 'before_notice');
assert.equal(ctx.empSetLeave('e18', { who: 'company', noticeDate: '2026-11-06', lastDay: '2026-11-07' }).code, 'reason_required');
assert.equal(ctx.empSetLeave('e18', { who: 'company', noticeDate: '2026-11-06', lastDay: '2026-11-07', reason: '协商提前' }).ok, true);

/* 店长办离职只形成提案，老板确认后生效（HR-ACCESS-07） */
ctx.hrSetView('manager');
assert.equal(ctx.empSetLeave('e01', { who: 'mutual', noticeDate: '2026-11-06', lastDay: '2027-01-31', reason: '协商' }).proposal, true);
assert.equal(ctx.empById('e01').leave, null);
assert.equal(ctx.empById('e01').leaveProposal.state, 'pending');
ctx.hrSetView('owner');
assert.equal(ctx.empConfirmLeaveProposal('e01').ok, true);
assert.equal(ctx.empById('e01').status, 'leaving');

/* 合同版本与提案：确认前档案保持原值，确认后新增版本并保留旧版（HR-CONTRACT-02/03） */
ctx.hrSetView('manager');
const before = ctx.empById('e01').contract.rate;
const proposed = JSON.parse(JSON.stringify(ctx.empById('e01')));
proposed.contract.rate = 20;
proposed.contract.validFrom = '2026-11-06';
const changes = ctx.empContractConditionChanges(ctx.empById('e01').contract, ctx.empPrepareContractForSave(proposed.contract));
assert.deepEqual(changes.map(c => c.path), ['contract.rate']);
ctx.empSubmitContractProposal(ctx.empById('e01'), proposed, changes, '2026-11-06');
assert.equal(ctx.empById('e01').contract.rate, before);
assert.equal(ctx.empById('e01').contractProposal.state, 'pending');
assert.equal(ctx.empById('e01').history.at(-1).by, '店长');
ctx.hrSetView('owner');
assert.equal(ctx.empConfirmContractProposal('e01').ok, true);
assert.equal(ctx.empById('e01').contract.rate, 20);
assert.ok(ctx.empContractVersions(ctx.empById('e01')).length >= 2, '旧版必须保留');
assert.equal(ctx.empById('e01').history.at(-1).by, '老板');

/* 合同与问卷：两份发出、逐份核对、只退回一份、作废、线下一步归档（HR-ONB-35～38/53） */
const target = ctx.empById('e18');
target.invite = { portalVersion: 2, state: 'approved', submitted: {} };
target.invite.contractTemplate = { name: 'vertrag.pdf', dataUrl: 'data:application/pdf;base64,AA==' };
target.invite.questionnaireTemplate = { name: 'fragebogen.pdf', dataUrl: 'data:application/pdf;base64,AA==' };
ctx.empSaveStaff(target);
assert.equal(ctx.empSendContractDispatch('e18').ok, true);
let inv = ctx.empById('e18').invite;
assert.ok(inv.contractSentAt);
assert.equal(inv.onboardingFilesVersion, 1);
assert.equal(inv.contractReview && Object.keys(inv.contractReview).length, 0);
/* 员工端按同一组字段能进入“待签回”阶段 */
const uiData = { employeeId: 'e18', profile: {}, docs: {} };
const panel = ctx.euContractPanel(uiData);
assert.ok(panel.includes('下载劳动合同') && panel.includes('下载个人调查问卷'));

/* 员工签回两份 */
let signed = JSON.parse(JSON.stringify(ctx.empById('e18')));
signed.docs = signed.docs || {};
signed.docs.contract = { state: 'ok', file: 'vertrag_signed.pdf', dataUrl: 'data:,', at: '2026-11-06T09:00:00.000Z' };
signed.docs.personalquestionnaire = { state: 'ok', file: 'fragebogen_signed.pdf', dataUrl: 'data:,', at: '2026-11-06T09:00:00.000Z' };
signed.invite.contractSignedSubmittedAt = '2026-11-06T09:00:00.000Z';
ctx.empSaveStaff(signed);
/* 只通过一份不能归档 */
assert.equal(ctx.empReviewContractAsset('e18', 'contract', 'approved', '').ok, true);
assert.equal(ctx.empContractArchived(ctx.empById('e18')), false);
/* 退回必须写原因；退回后要等重传才能再核对 */
assert.equal(ctx.empReviewContractAsset('e18', 'questionnaire', 'returned', '').code, 'reason');
assert.equal(ctx.empReviewContractAsset('e18', 'questionnaire', 'returned', '缺签字').ok, true);
assert.equal(ctx.empById('e18').invite.contractReview.questionnaire.state, 'returned');
assert.equal(ctx.empContractDispatchState(ctx.empById('e18')).id, 'sent');
/* 员工重传被退回的一份，再核对通过 → 归档 */
signed = JSON.parse(JSON.stringify(ctx.empById('e18')));
signed.docs.personalquestionnaire = { state: 'ok', file: 'fragebogen_signed_v2.pdf', dataUrl: 'data:,', at: '2026-11-06T10:00:00.000Z' };
signed.invite.contractSignedSubmittedAt = '2026-11-06T10:00:00.000Z';
ctx.empSaveStaff(signed);
assert.equal(ctx.empReviewContractAsset('e18', 'questionnaire', 'approved', '').ok, true);
assert.equal(ctx.empContractArchived(ctx.empById('e18')), true);
assert.ok(ctx.empById('e18').history.some(h => h.field === 'contract.archived'));
assert.ok(ctx.empById('e18').history.some(h => h.field === 'contract.signed'));
/* 作废必须写原因，旧件保留 */
assert.equal(ctx.empVoidContractDispatch('e18', '').code, 'reason');
assert.equal(ctx.empVoidContractDispatch('e18', '金额写错').ok, true);
assert.equal(ctx.empById('e18').invite.contractSentAt, null);
assert.equal(ctx.empContractArchived(ctx.empById('e18')), false);
assert.ok(ctx.empById('e18').invite.contractTemplateHistory.length >= 1);
/* 线下签署：两份扫描件一步归档 */
assert.equal(ctx.empOfflineContractArchive('e18', { name: 'sc.pdf', dataUrl: 'data:,' }, { name: 'sq.pdf', dataUrl: 'data:,' }).ok, true);
assert.equal(ctx.empById('e18').invite.dispatchMode, 'offline');
assert.equal(ctx.empContractArchived(ctx.empById('e18')), true);
assert.equal(ctx.empNewHireOpen(ctx.empById('e18')).some(t => t.id === 'contract'), false);

/* 新人清单四项，排班项不进一期（HR-ONB-39 ★6.1） */
const taskIds = vm.runInContext('EMP_NEWHIRE_TASKS.map(t => t.id)', ctx);
assert.deepEqual(taskIds, ['sofort', 'contract', 'belehrung', 'access']);

/* 即时申报：提前 3 天提醒、上班当天未报即逾期；无社保号可记录替代资料（HR-ONB-40/42 ★6.7） */
const sofortEmp = { id: 's1', name: 'S', store: 'Martin Biergarten', entryDate: '2026-11-09', contact: {}, ids: {}, docs: {}, contract: {} };
assert.equal(ctx.empSofortState(sofortEmp, '2026-11-06').tone, 'orange');
assert.equal(ctx.empSofortState(sofortEmp, '2026-11-09').overdue, true);
const rows = ctx.empSofortRows(sofortEmp, true);
assert.ok(rows.some(r => r.name.zh.includes('公司法定名称')));
assert.ok(rows.some(r => r.name.zh.includes('工商') || r.name.zh.includes('经营地址')));
assert.ok(rows.some(r => r.name.zh.includes('Betriebsnummer')));
assert.ok(rows.some(r => String(r.value).includes('无社保号')));
assert.ok(rows.filter(r => r.optional).length === 3);

/* 保存期从最后工作日算，2 月 29 日 + N 年取 3 月 1 日（HR-LIFE-34） */
assert.equal(ctx.empAddYears('2024-02-29', 1), '2025-03-01');
assert.equal(ctx.empRetentionRows({ leave: { lastDay: '2026-11-05' } }).length, 5);

/* 重聘沿用员工编号，不触发重复校验；新旧档案互相可查（HR-LIFE-32/33） */
const old = ctx.empById('e14');
const neo = { id: 'zz', name: 'Neo', store: old.store, employeeNo: old.employeeNo, rehireOf: old.id, contract: {}, docs: {} };
ctx.empSaveStaff(neo);
old.rehiredBy = 'zz';
ctx.empSaveStaff(old);
assert.equal(ctx.empEmployeeNoConflict(neo, old.employeeNo), null);
assert.equal(ctx.empById('e14').rehiredBy, 'zz');

/* 特殊审批结果写入变更记录（HR-DATA-14；HR-ONB-32） */
const sp = ctx.empById('e18');
sp.employeePortal = { specialSubmission: { state: 'pending', items: ['steuerId'], labels: ['Steuer-ID'], reason: '未收到' } };
ctx.empSaveStaff(sp);
assert.equal(ctx.empResolveSpecialSubmission('e18', 'rejected', '', '').code, 'reason');
assert.equal(ctx.empResolveSpecialSubmission('e18', 'approved', '2026-12-01', '').ok, true);
assert.equal(ctx.empById('e18').missingApprovals[0].status, 'approved');
assert.equal(ctx.empById('e18').history.at(-1).field, 'approval.special');

console.log('PASS: probation default/effective end, structured notice, leave status/proposal/handover, contract versions/proposal, dispatch send/review/return/void/offline, newhire 4 items, sofort states and no-SV, retention leap day, rehire number, special approval event');
