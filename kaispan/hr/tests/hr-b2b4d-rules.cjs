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
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}
ctx.slug = (a, b) => `${a}-${b}`;
ctx.empScope = () => null;
ctx.state = () => ({ params: new URLSearchParams(''), route: 'employee' });
let stamp = '2026-11-06T12:00:00.000Z';
ctx.empNow = () => stamp;
ctx.empToday = () => '2026-11-06';
ctx.hrSetView('owner');
ctx.empAllStaff();

const copy = value => JSON.parse(JSON.stringify(value));
const only = (...ids) => ctx.empWrite('kaispanEmpStaff', ctx.empAllStaff().filter(e => ids.includes(e.id)));
const seed = (id = 'x', patch = {}) => {
  const e = {
    id, name: 'Alex Chen', firstName: 'Alex', lastName: 'Chen', store: 'Martin Biergarten',
    role: 'front', status: 'active', migrated: true, employeeNo: id, entryDate: '2022-01-01',
    probationEnd: null, leave: null, account: { state: 'active' },
    contact: { email: `${id}@example.com`, phone: '111', krankenkasse: 'TK', street: 'A', houseNo: '1', zip: '12345', city: 'Dortmund' },
    birthday: '1990-02-03',
    ids: { steuerId: '01234567890', rentenversicherung: '12123456A001', iban: 'DE89370400440532013000' },
    contract: { type: 'teilzeit', rate: 17, payType: 'hourly', hoursMin: 40, hoursMax: 80, weeklyHours: 20, urlaubDays: 20,
      noticePeriod: '4 Wochen', nationalityClass: 'eu', isStudent: false },
    docs: { id: { state: 'ok', file: 'passport.pdf', at: '2026-01-01T00:00:00.000Z', expiry: '2027-01-01', dataUrl: 'data:old' } },
    history: [],
    ...copy(patch)
  };
  ctx.empSaveStaff(e);
  return ctx.empById(id);
};
const approved = () => ({
  invite: {
    portalVersion: 2, state: 'approved', submitted: {},
    contractTemplate: { name: 'v.pdf', dataUrl: 'data:v' },
    questionnaireTemplate: { name: 'q.pdf', dataUrl: 'data:q' }
  }
});
const signed = (id = 'x') => {
  const e = copy(ctx.empById(id));
  e.docs.contract = { state: 'ok', file: 'signed-c.pdf', dataUrl: 'data:sc', at: '2026-11-06T12:05:00.000Z' };
  e.docs.personalquestionnaire = { state: 'ok', file: 'signed-q.pdf', dataUrl: 'data:sq', at: '2026-11-06T12:05:00.000Z' };
  e.invite.contractSignedSubmittedAt = '2026-11-06T12:05:00.000Z';
  ctx.empSaveStaff(e);
};
const advance = value => { stamp = value; };

/* A1/a. 导出参数只能缩小权限：店长传 sensitive:true 也不能导出生日/税号/IBAN（HR-ACCESS-04、HR-DATA-32） */
const exportTarget = seed('csv-target');
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: true });
const managerCsv = ctx.empRosterCsv([exportTarget], { sensitive: true });
assert.ok(!managerCsv.includes('1990-02-03'), '店长不能靠参数导出生日');
assert.ok(!managerCsv.includes('01234567890'), '店长不能靠参数导出税号');
assert.ok(!managerCsv.includes('DE89370400440532013000'), '店长不能靠参数导出 IBAN');
assert.ok(managerCsv.includes('TK'), '非敏感列保留');
ctx.hrSetView('owner');
assert.ok(ctx.empRosterCsv([exportTarget]).includes('1990-02-03'), '老板可导出敏感列');

/* A8/a. 店长门店范围 = 顶栏当前门店；跨店发送、改合同、导出全部拒绝（HR-ACCESS-01） */
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: true });
ctx.empScope = () => 'Martin Cafe';
const cross = seed('cross-store', { ...approved(), store: 'Martin Biergarten' });
assert.equal(ctx.empSendContractDispatch('cross-store').code, 'store_scope');
assert.equal(ctx.empRequestContractChange('cross-store', { rate: 25 }, '跨店', '2027-01-01').code, 'store_scope');
assert.equal(ctx.empRosterCsv([cross]).includes('Martin Biergarten'), false, '跨店名册不能导出');
ctx.empScope = () => 'Martin Biergarten';
assert.equal(ctx.empSendContractDispatch('cross-store').ok, true);
ctx.empScope = () => null;
ctx.hrSetView('owner');

/* A2/a. 提案从当前正式档案构造，只接收合同字段白名单（HR-ACCESS-07/55） */
const proposalTarget = seed('proposal-only');
const proposalBefore = copy(proposalTarget);
const proposalNext = copy(proposalTarget);
proposalNext.contract.rate = 22;
proposalNext.ids.iban = 'DE00_UNAUTHORIZED';
proposalNext.docs.contract = { state: 'ok', file: 'forged.pdf' };
proposalNext.invite = { state: 'approved', archivedAt: '2026-11-06T10:00:00.000Z' };
proposalNext.entryDate = '2020-01-01';
proposalNext.probationEnd = '2027-06-30';
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: false });
const submitted = ctx.empSubmitContractProposal(proposalTarget, proposalNext,
  ctx.empContractConditionChanges(proposalTarget.contract, proposalNext.contract), '2027-02-01');
assert.equal(submitted.ok, true);
const afterProposal = ctx.empById('proposal-only');
assert.equal(afterProposal.ids.iban, proposalBefore.ids.iban, '提案不能写 IBAN');
assert.equal(afterProposal.entryDate, '2022-01-01', '提案不能改入职日');
assert.equal(afterProposal.probationEnd, null, '提案不能改试用期');
assert.equal(afterProposal.docs.contract, undefined, '提案不能夹带归档件');
assert.equal(afterProposal.invite, undefined, '提案不能夹带邀请状态');
assert.equal(afterProposal.contractProposal.changes.every(x => x.path.startsWith('contract.')), true);
ctx.hrSetView('owner');
assert.equal(ctx.empConfirmContractProposal('proposal-only').ok, true);
assert.equal(ctx.empContractVersionAt(ctx.empById('proposal-only'), '2027-02-02').data.rate, 22,
  '确认后写入生效日对应的新版本');

/* A3/a. 确认提案要比较最新合同版本 ID（含未来版本），未来版本不能被旧提案覆盖（HR-ACCESS-56） */
const futureProposal = seed('proposal-future', { entryDate: '2022-01-01' });
ctx.hrSetView('manager');
const futureNext = copy(futureProposal);
futureNext.contract.hoursMax = 100;
assert.equal(ctx.empSubmitContractProposal(futureProposal, futureNext,
  ctx.empContractConditionChanges(futureProposal.contract, futureNext.contract), '2027-03-01').ok, true);
ctx.hrSetView('owner');
assert.equal(ctx.empRequestContractChange('proposal-future', { hoursMax: 120 }, '未来版本', '2027-04-01').ok, true);
assert.equal(ctx.empConfirmContractProposal('proposal-future').code, 'stale');
assert.equal(ctx.empContractVersionAt(ctx.empById('proposal-future'), '2027-04-02').data.hoursMax, 120);

/* A13/a. 同生效日、同毫秒的两版按单调序号取最新（HR-CONTRACT-02/03） */
const versionTarget = seed('version-seq');
ctx.empRequestContractChange('version-seq', { rate: 21 }, 'one', '2026-11-06');
ctx.empRequestContractChange('version-seq', { rate: 22 }, 'two', '2026-11-06');
assert.equal(ctx.empById('version-seq').contract.rate, 22);
assert.equal(ctx.empContractVersionAt(ctx.empById('version-seq'), '2026-11-06').data.rate, 22);
const seqs = ctx.empContractVersions(ctx.empById('version-seq')).filter(v => v.validFrom === '2026-11-06').map(v => v.seq);
assert.equal(new Set(seqs).size, seqs.length, '版本序号单调唯一');

/* A6/a. 存在未作废发送记录时拒绝再次发送；作废后新发送拿新的 dispatchId（HR-ONB-53） */
seed('dispatch-repeat', approved());
assert.equal(ctx.empSendContractDispatch('dispatch-repeat').ok, true);
const firstDispatch = ctx.empById('dispatch-repeat').invite.dispatchId;
assert.ok(firstDispatch);
assert.equal(ctx.empSendContractDispatch('dispatch-repeat').code, 'active');
assert.equal(ctx.empVoidContractDispatch('dispatch-repeat', '金额写错').ok, true);
assert.equal(ctx.empById('dispatch-repeat').invite.dispatchId, '');
assert.equal(ctx.empById('dispatch-repeat').invite.contractVoid.dispatchId, firstDispatch, '作废记录保留旧发送 ID');
const again = ctx.empById('dispatch-repeat');
again.invite.contractTemplate = { name: 'v2.pdf' };
again.invite.questionnaireTemplate = { name: 'q2.pdf' };
ctx.empSaveStaff(again);
assert.equal(ctx.empSendContractDispatch('dispatch-repeat').ok, true);
assert.notEqual(ctx.empById('dispatch-repeat').invite.dispatchId, firstDispatch, '重发必须换新的发送 ID');

/* A10/a. 退回一份后另一份仍可处理；两份可以一次退回（HR-ONB-53） */
seed('review-both', approved());
ctx.empSendContractDispatch('review-both');
signed('review-both');
assert.equal(ctx.empReviewContractAsset('review-both', 'contract', 'returned', '合同缺签名').ok, true);
assert.ok(ctx.empById('review-both').invite.contractSignedSubmittedAt, '退回一份不能清掉整批签回');
assert.equal(ctx.empReviewContractAsset('review-both', 'questionnaire', 'returned', '问卷缺签名').ok, true);
assert.equal(ctx.empById('review-both').invite.contractReview.questionnaire.state, 'returned');

/* A4/a + C-B3. 旧发送期间的草稿不能混进新发送；被退回的必须是退回后的新版本 */
seed('review-version', approved());
ctx.empSendContractDispatch('review-version');
signed('review-version');
assert.equal(ctx.empReviewContractAsset('review-version', 'questionnaire', 'returned', '缺签字').ok, true);
let oldDraft = copy(ctx.empById('review-version'));
oldDraft.docs.contract = { state: 'ok', file: 'old-dispatch-c.pdf', dataUrl: 'data:oldc', at: '2026-11-06T11:00:00.000Z' };
oldDraft.docs.personalquestionnaire = { state: 'ok', file: 'old-dispatch-q.pdf', dataUrl: 'data:oldq', at: '2026-11-06T11:00:00.000Z' };
ctx.empSaveStaff(oldDraft);
advance('2026-11-06T12:20:00.000Z');
assert.equal(ctx.empVoidContractDispatch('review-version', '更正发出件').ok, true);
oldDraft = copy(ctx.empById('review-version'));
oldDraft.invite.contractTemplate = { name: 'new-v.pdf' };
oldDraft.invite.questionnaireTemplate = { name: 'new-q.pdf' };
ctx.empSaveStaff(oldDraft);
advance('2026-11-06T12:25:00.000Z');
assert.equal(ctx.empSendContractDispatch('review-version').ok, true);
const oldDraftAgain = copy(ctx.empById('review-version'));
oldDraftAgain.docs.contract = { state: 'ok', file: 'old-dispatch-c.pdf', dataUrl: 'data:oldc', at: '2026-11-06T11:00:00.000Z' };
oldDraftAgain.docs.personalquestionnaire = { state: 'ok', file: 'old-dispatch-q.pdf', dataUrl: 'data:oldq', at: '2026-11-06T11:00:00.000Z' };
oldDraftAgain.invite.contractSignedSubmittedAt = '2026-11-06T12:30:00.000Z';
ctx.empSaveStaff(oldDraftAgain);
assert.equal(ctx.empReviewContractAsset('review-version', 'contract', 'approved', '').code, 'stale_file');
assert.equal(ctx.empReviewContractAsset('review-version', 'questionnaire', 'approved', '').code, 'stale_file');
const freshUpload = copy(ctx.empById('review-version'));
freshUpload.docs.contract = { state: 'ok', file: 'new-c.pdf', dataUrl: 'data:newc', at: '2026-11-06T12:31:00.000Z' };
freshUpload.docs.personalquestionnaire = { state: 'ok', file: 'new-q.pdf', dataUrl: 'data:newq', at: '2026-11-06T12:31:00.000Z' };
ctx.empSaveStaff(freshUpload);
assert.equal(ctx.empReviewContractAsset('review-version', 'contract', 'approved', '').ok, true);
assert.equal(ctx.empReviewContractAsset('review-version', 'questionnaire', 'approved', '').ok, true);
assert.equal(ctx.empContractArchived(ctx.empById('review-version')), true);

/* A4/b. empContractFileIsCurrent 的边界：dispatchId 优先、旧记录看 sentAt、无法证明一律 false、重传带 at 必须能过 */
const current = {
  invite: {
    dispatchId: 'd-new', sentAt: '2026-11-06T12:00:00.000Z',
    contractReview: { contract: { state: 'returned', at: '2026-11-06T12:10:00.000Z', dispatchId: 'd-new' } }
  }
};
assert.equal(ctx.empContractFileIsCurrent(current, { file: 'a.pdf', dispatchId: 'd-new', at: '2026-11-06T12:11:00.000Z' }, 'contract'), true);
assert.equal(ctx.empContractFileIsCurrent(current, { file: 'a.pdf', dispatchId: 'd-old', at: '2026-11-06T12:11:00.000Z' }, 'contract'), false);
assert.equal(ctx.empContractFileIsCurrent(current, { file: 'a.pdf', at: '2026-11-06T12:11:00.000Z' }, 'contract'), true, '缺 dispatchId 时用 at 证明');
assert.equal(ctx.empContractFileIsCurrent(current, { file: 'a.pdf' }, 'contract'), false, '缺 at 又缺 dispatchId 不能放行');
assert.equal(ctx.empContractFileIsCurrent(current, { file: 'a.pdf', dispatchId: 'd-new', at: '2026-11-06T12:09:00.000Z' }, 'contract'), false, '退回前的版本不能再次通过');
const returnedNoAt = { invite: { dispatchId: 'd-new', sentAt: '2026-11-06T12:00:00.000Z',
  contractReview: { contract: { state: 'returned', dispatchId: 'd-new' } } } };
assert.equal(ctx.empContractFileIsCurrent(returnedNoAt, { file: 'a.pdf', dispatchId: 'd-new', at: '2026-11-06T12:12:00.000Z' }, 'contract'), true,
  '旧退回记录缺时间时，真正重传带 at 的新版本必须能通过');
const legacy = { invite: { sentAt: '2026-11-06T12:00:00.000Z' } };
assert.equal(ctx.empContractFileIsCurrent(legacy, { file: 'a.pdf', at: '2026-11-06T11:59:00.000Z' }, 'contract'), false);
assert.equal(ctx.empContractFileIsCurrent(legacy, { file: 'a.pdf', at: '2026-11-06T12:00:00.000Z' }, 'contract'), true);

/* A7/a. 关闭敏感权限后，发出件和签回件的文件名与下载链接都隐藏（HR-ACCESS-11/55） */
seed('panel-mask', approved());
ctx.empSendContractDispatch('panel-mask');
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: false });
const maskedPanel = ctx.empContractDispatchPanel(ctx.empById('panel-mask'));
assert.ok(!maskedPanel.includes('v.pdf'), '发出件文件名不能露出');
assert.ok(!maskedPanel.includes('href="data:v"'), '发出件下载链接不能露出');
assert.ok(!maskedPanel.includes('q.pdf'), '问卷发出件文件名不能露出');
ctx.hrSetView('owner');

/* A12/a + A9/A11. 作废不要求敏感读取；清掉待用扫描件；新线下归档清掉旧作废标记 */
seed('void-manager', approved());
ctx.empSendContractDispatch('void-manager');
let voidTarget = copy(ctx.empById('void-manager'));
voidTarget.invite.offlineContractFile = { name: 'old-offline-c.pdf', dataUrl: 'data:oldc' };
voidTarget.invite.offlineQuestionnaireFile = { name: 'old-offline-q.pdf', dataUrl: 'data:oldq' };
ctx.empSaveStaff(voidTarget);
advance('2026-11-06T12:10:00.000Z');
assert.equal(ctx.empOfflineContractArchive('void-manager', voidTarget.invite.offlineContractFile, voidTarget.invite.offlineQuestionnaireFile).ok, false,
  '已有电子发送时不能直接线下归档');
assert.equal(ctx.empVoidContractDispatch('void-manager', '改线下').ok, true);
assert.equal(ctx.empById('void-manager').invite.offlineContractFile, null, '作废要清掉待用线下扫描件');
assert.equal(ctx.empById('void-manager').invite.offlineQuestionnaireFile, null);
assert.equal(ctx.empOfflineContractArchive('void-manager',
  ctx.empById('void-manager').invite.offlineContractFile,
  ctx.empById('void-manager').invite.offlineQuestionnaireFile).code, 'files', '作废后不能复用旧扫描件');
advance('2026-11-06T13:00:00.000Z');
assert.equal(ctx.empOfflineContractArchive('void-manager',
  { name: 'off-c.pdf', dataUrl: 'data:offc' }, { name: 'off-q.pdf', dataUrl: 'data:offq' }).ok, true);
assert.equal(ctx.empById('void-manager').invite.contractVoid, null, '新归档是独立记录');
assert.equal(ctx.empById('void-manager').invite.contractVoidHistory[0].reason, '改线下', '旧作废标记只留历史');
assert.equal(ctx.empById('void-manager').invite.offlineContractFile, null, '归档后清空待用槽位');
assert.ok(ctx.empContractDispatchPanel(ctx.empById('void-manager')).includes('emp-dispatch-void-btn'), '新记录仍有作废入口');

/* A12/b. 敏感权限关闭时店长仍可作废（HR-ACCESS-55） */
seed('void-no-sensitive', approved());
ctx.empSendContractDispatch('void-no-sensitive');
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: false });
assert.equal(ctx.empVoidContractDispatch('void-no-sensitive', '写错需重发').ok, true);
ctx.hrSetView('owner');

/* B3. 默认问卷写入入口校验 ownerOnly；发送记录保存版本引用，换默认问卷不影响已发出内容（HR-ONB-50） */
ctx.hrSetView('owner');
assert.equal(ctx.empSaveQuestionnaireTemplate({ file: { name: 'default-v1.pdf', dataUrl: 'data:v1' } }), true);
const v1 = ctx.empQuestionnaireTemplate();
assert.ok(v1.versionId);
seed('questionnaire-freeze', {
  invite: { portalVersion: 2, state: 'approved', submitted: {},
    contractTemplate: { name: 'contract.pdf', dataUrl: 'data:c' } }
});
assert.equal(ctx.empSendContractDispatch('questionnaire-freeze').ok, true);
assert.equal(ctx.empById('questionnaire-freeze').invite.questionnaireVersionId, v1.versionId);
assert.equal(ctx.empSaveQuestionnaireTemplate({ file: { name: 'default-v2.pdf', dataUrl: 'data:v2' } }), true);
assert.equal(ctx.empById('questionnaire-freeze').invite.questionnaireTemplate.name, 'default-v1.pdf', '已发出的问卷不能随默认问卷替换');
assert.equal(ctx.empQuestionnaireTemplate().history[0].file.name, 'default-v1.pdf', '旧默认问卷版本保留');
ctx.hrSetView('manager');
assert.equal(ctx.empSaveQuestionnaireTemplate({ file: { name: 'unauthorized.pdf', dataUrl: 'data:bad' } }), false);
assert.equal(ctx.empQuestionnaireTemplate().file.name, 'default-v2.pdf', '店长不能写默认问卷');
ctx.hrSetView('owner');

/* B6/B7. 参数与公司资料写入校验（HR-ORG-13、HR-CONTRACT-19/20/40） */
ctx.empSetEmployer('Martin Biergarten', 'betriebsnummer', '12345678');
ctx.empSetEmployer('Martin Biergarten', 'betriebsnummer', 'bad');
assert.equal(ctx.empEmployer('Martin Biergarten').betriebsnummer, '12345678', '非法 Betriebsnummer 不能写入');
assert.equal(ctx.empSofortRows({ store: 'Martin Biergarten', contact: {}, ids: {} })
  .find(x => x.name.zh === 'Betriebsnummer').ok, true);
ctx.empSetEmployer('Martin Biergarten', 'betriebsnummer', '1234567');
assert.equal(ctx.empEmployer('Martin Biergarten').betriebsnummer, '12345678');
const employerStore = ctx.empEmployerAll();
ctx.empWrite('kaispanEmpEmployer', { ...employerStore,
  'Martin Biergarten': { ...employerStore['Martin Biergarten'], betriebsnummer: 'bad' } });
assert.equal(ctx.empSofortRows({ store: 'Martin Biergarten', contact: {}, ids: {} })
  .find(x => x.name.zh === 'Betriebsnummer').ok, false, '数据单要再次校验格式');
ctx.empWrite('kaispanEmpEmployer', employerStore);
for (const id of ['minijobMonthlyMax', 'werkstudentWeeklyMax', 'dailyHoursMax', 'restBetweenShifts', 'lohnfortzahlungWeeks', 'payslipToleranceEuro']) {
  assert.ok(ctx.empRuleRangeText({ id }), `${id} 需要范围说明`);
  assert.equal(ctx.empRuleInputValid(id, 0).ok, id === 'payslipToleranceEuro');
}
assert.equal(ctx.empRuleInputValid('lateRoundingMinutes', 45).ok, false);
ctx.empSetRule('probationMaxMonths', 99);
assert.equal(ctx.empRule('probationMaxMonths'), 6, '固定值不能被 setter 改掉');
ctx.empSetRule('deferralMaxExtensions', 99);
assert.equal(ctx.empRule('deferralMaxExtensions'), 1, '超出范围不能写入');
ctx.empSetRule('dailyHoursMax', 0);
assert.equal(ctx.empRule('dailyHoursMax'), 10);
ctx.empSetRule('lateRoundingMinutes', 45);
assert.equal(ctx.empRule('lateRoundingMinutes'), 15);
ctx.empSetRule('docSoonDays', 20);
assert.equal(ctx.empRule('docSoonDays'), 90, '关注期不能小于预警期');
ctx.empSetRule('deferralMaxExtensions', 3);
assert.equal(ctx.empRule('deferralMaxExtensions'), 3);

/* B8. 延期按钮与延期函数共用配置：允许 3 次时按钮出现，0 次时入口隐藏（HR-CONTRACT-47） */
seed('extend-config', {
  entryDate: '2026-11-20',
  missingApprovals: [{ item: 'steuerId', label: 'Steuer-ID', status: 'approved', deadline: '2026-11-20', extensionCount: 1 }]
});
ctx.empSetRule('deferralMaxExtensions', 3);
assert.ok(ctx.empSpecialApprovalBlock(ctx.empById('extend-config')).includes('emp-special-extend'));
assert.equal(ctx.empExtendMissingApproval('extend-config', 'steuerId', '2026-11-25', '再延期').ok, true);
ctx.empSetRule('deferralMaxExtensions', 0);
const hiddenBlock = ctx.empSpecialApprovalBlock(ctx.empById('extend-config'));
assert.ok(!hiddenBlock.includes('emp-special-extend'), '0 次时延期入口要隐藏');

/* B4. 待入职（审核通过、入职日在将来）纳入证件提醒/总览/矩阵，但不套试用期提醒（HR-LIFE-02、HR-ONB-22） */
const pending = seed('pending-doc', { ...approved(), entryDate: '2026-12-01', status: 'active', probationEnd: '2027-03-01' });
const pendingNow = copy(ctx.empById('pending-doc'));
pendingNow.docs.id = { state: 'ok', file: 'exp.pdf', expiry: '2026-11-05' };
ctx.empSaveStaff(pendingNow);
only('pending-doc');
assert.equal(ctx.empById('pending-doc').status, 'pending');
assert.equal(ctx.empDocState(ctx.empById('pending-doc'), 'id').level, 'expired');
assert.ok(ctx.empDocAlerts().some(x => x.employee.id === 'pending-doc'));
assert.ok(ctx.empAlerts().some(x => x.employee.id === 'pending-doc'), '首页预警也包含待入职证件');
assert.ok(ctx.employeeDocPage().includes('Alex Chen'), '矩阵要有待入职的人');
const pendingEntries = ctx.empPendingEntries(ctx.empById('pending-doc')).map(x => x.key);
assert.ok(pendingEntries.includes('doc'));
assert.ok(!pendingEntries.includes('probation'), '待入职不提醒试用期');
ctx.empScope = () => null;
ctx.empWrite('kaispanEmpStaff', ctx.empAllStaff());

/* B5. 首页人数与档案列表「需要处理」都包含离职后的交接 / 保存期 / 特殊审批（HR-TODO-41/50/51） */
ctx.empAllStaff();
seed('left-exceptions', {
  leave: { who: 'employee', noticeDate: '2014-12-01', lastDay: '2015-01-01' },
  leaveHandover: { items: {} }, retentionHandled: {},
  ids: { steuerId: '', rentenversicherung: '', iban: '' },
  missingApprovals: [{ item: 'steuerId', label: 'Steuer-ID', status: 'approved', deadline: '2026-10-01' }]
});
only('left-exceptions');
const leftEntries = ctx.empPendingEntries(ctx.empById('left-exceptions')).map(x => x.key);
assert.ok(leftEntries.includes('handover'));
assert.ok(leftEntries.includes('retention'));
assert.ok(leftEntries.includes('specialDue'));
assert.equal(ctx.empPendingPeople().length, 1);
assert.equal(ctx.empSummary().urgentPeople, 1);
assert.ok(ctx.employeeHomePage().includes('1'), '首页数字和列表口径一致');

/* B9. 逾期暂缺在该项补齐后自动消失（HR-ONB-32） */
assert.ok(ctx.empWorkflowEntries(ctx.empById('left-exceptions')).some(x => x.key === 'specialDue'));
const filled = copy(ctx.empById('left-exceptions'));
filled.ids.steuerId = '01234567890';
ctx.empSaveStaff(filled);
assert.ok(!ctx.empWorkflowEntries(ctx.empById('left-exceptions')).some(x => x.key === 'specialDue'), '补齐后逾期待办要消失');

/* B2. 邀请账号：同邮箱冲突要拦；没有邀请记录的在岗老员工建立 token/有效期/veteran 模式（HR-ACCESS-23/30/54、HR-ONB-52） */
ctx.empWrite('kaispanEmpStaff', ctx.empAllStaff());
const mailA = seed('mail-a', { account: null, invite: null });
const mailB = seed('mail-b', { account: null, invite: null });
only('mail-a', 'mail-b');
assert.equal(ctx.empInviteAccount('mail-a', 'invite').ok, true);
assert.equal(ctx.empInviteAccount('mail-a', 'resend').reason, 'cooldown');
const duplicateMail = copy(ctx.empById('mail-b'));
duplicateMail.contact = { ...duplicateMail.contact, email: 'mail-a@example.com' };
ctx.empSaveStaff(duplicateMail);
assert.equal(ctx.empInviteAccount('mail-b', 'invite').reason, 'conflict');
const invited = ctx.empById('mail-a');
assert.ok(invited.invite.token);
assert.ok(invited.invite.expiresAt);
assert.equal(invited.invite.fillMode, 'veteran');
assert.equal(invited.account.state, 'invited');
ctx.empWrite('kaispanEmpStaff', ctx.empAllStaff());

/* B1. 批量邀请按所选行 ID 定位，同名员工不会发给第一个（HR-ACCESS-54） */
seed('same-a', { name: 'Same Name', firstName: 'Same', lastName: 'Name', account: null, invite: null, contact: { email: 'same-a@example.com', phone: '1', krankenkasse: 'TK' } });
seed('same-b', { name: 'Same Name', firstName: 'Same', lastName: 'Name', account: null, invite: null, contact: { email: 'same-b@example.com', phone: '1', krankenkasse: 'TK' } });
only('same-a', 'same-b');
const selectedRow = id => ({ dataset: { id }, querySelector: () => ({ textContent: 'Same Name' }) });
const batchButton = { dataset: {}, addEventListener: (event, fn) => { batchButton.click = fn; }, classList: { contains: () => false } };
const batchFlash = [];
ctx.document = {
  querySelectorAll: selector => selector === '.emp-batch-invite' ? [batchButton]
    : selector === '.emp-roster tbody .employee-row-check:checked' ? [{ closest: () => selectedRow('same-b') }] : [],
  querySelector: selector => selector === '.emp-listbar' ? { insertAdjacentHTML: () => {} } : null,
  addEventListener: () => {}
};
ctx.app = () => {};
ctx.empFlash = (el, message) => batchFlash.push(message);
ctx.empBindAll();
batchButton.click();
assert.equal(ctx.empById('same-a').account?.state || 'none', 'none', '未勾选的第一名不能被发送');
assert.equal(ctx.empById('same-b').account?.state, 'invited', '勾选的那名员工收到邀请');
ctx.empWrite('kaispanEmpStaff', ctx.empAllStaff());

/* B10. 补件/资料修改用同一 requestId；采纳、退回时两份投影一起关闭，不能二次采纳；保留日期原因贯穿核对（HR-DOC-20） */
const reviewSeed = seed('review-id');
const reviewDoc = copy(reviewSeed);
reviewDoc.docs.id = { state: 'ok', file: 'old.pdf', expiry: '2027-06-01' };
reviewDoc.employeePortal = {
  supplementSubmission: {
    at: '2026-11-06T10:00:00.000Z', items: ['护照'],
    submitted: { docs: { id: { state: 'ok', file: 'new.pdf', dataUrl: 'data:new', at: '2026-11-06T10:00:00.000Z', expiry: '2027-06-01',
      keepExpiry: true, keepReason: '证件正在换发' } } }
  }
};
ctx.empSaveStaff(reviewDoc);
const banner = ctx.empRequestBanner(ctx.empById('review-id'));
assert.ok(banner.includes('证件正在换发'), '核对卡要显示保留原日期的原因');
assert.equal(ctx.empAcceptReview('review-id').ok, true);
assert.equal(ctx.empById('review-id').docs.id.expiryKeptReason, '证件正在换发', '采纳后历史要保留原因');
assert.equal(ctx.empOpenSupplementSnapshot(ctx.empById('review-id')), null, '采纳后另一份投影也要关闭');
assert.equal(ctx.empAcceptReview('review-id').code, 'missing', '不能二次采纳');

const topupSeed = seed('topup-id');
const topupDoc = copy(topupSeed);
topupDoc.request = {
  requestId: 'topup-fixed', token: 't-topup', kind: 'topup', state: 'submitted',
  sentAt: '2026-11-05T10:00:00.000Z', items: [{ kind: 'field', path: 'contact.phone' }],
  submitted: { contact: { phone: '222' } }
};
topupDoc.employeePortal = {
  supplementSubmission: { requestId: 'topup-fixed', status: 'submitted', at: '2026-11-06T10:00:00.000Z',
    submitted: { contact: { phone: '222' } } }
};
ctx.empSaveStaff(topupDoc);
assert.equal(ctx.empAcceptReview('topup-id').ok, true);
assert.equal(ctx.empById('topup-id').request.state, 'done');
assert.equal(ctx.empById('topup-id').employeePortal.supplementSubmission.status, 'accepted');
assert.equal(ctx.empById('topup-id').employeePortal.supplementRequest, null);
assert.equal(ctx.empReviewSources(ctx.empById('topup-id')).length, 0, '两份投影都关闭后不能再生出核对卡');

/* B11. 邀请审核兼容只有整名的遗留提交（HR-ONB-10/22） */
seed('legacy-name', { invite: { state: 'submitted', draft: null, submitted: {
  name: 'New Name', birthday: '1990-01-01',
  contact: { street: 'A', houseNo: '1', zip: '12345', city: 'Dortmund' },
  ids: { iban: 'DE89370400440532013000' },
  contract: { nationalityClass: 'eu', isStudent: false },
  profile: { student: 'no' },
  docs: {
    id: { state: 'ok', file: 'id.pdf' },
    bankFront: { state: 'ok', file: 'bank.pdf' },
    belehrung: { state: 'ok', file: 'health.pdf' }
  }
} } });
const legacyBefore = copy(ctx.empById('legacy-name'));
legacyBefore.firstName = 'Old';
legacyBefore.lastName = 'Name';
legacyBefore.name = 'Old Name';
ctx.empSaveStaff(legacyBefore);
assert.equal(ctx.empApproveInvite('legacy-name', { entryDate: '2026-11-20' }).ok, true);
assert.equal(ctx.empById('legacy-name').name, 'New Name');
assert.equal(ctx.empById('legacy-name').firstName, 'New');
assert.equal(ctx.empById('legacy-name').lastName, 'Name');

console.log('PASS: B2-b4d final review — CSV/scope/proposal/version/dispatch/review/void/offline/invite/rules/pending/left/topup naming');
