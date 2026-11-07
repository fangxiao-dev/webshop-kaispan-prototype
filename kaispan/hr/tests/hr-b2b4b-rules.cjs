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
for (const file of ['viewpoint.js', 'hr-answers.js', 'hr-model.js', 'employee.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}

let now = '2026-11-06T12:00:00.000Z';
let staff = [];
ctx.empNow = () => now;
ctx.empToday = () => '2026-11-06';
ctx.empAllStaff = () => staff;
ctx.empById = id => staff.find(e => e.id === id) || null;
ctx.empSaveStaff = employee => {
  const index = staff.findIndex(e => e.id === employee.id);
  if (index >= 0) staff[index] = employee; else staff.push(employee);
  return employee;
};
ctx.empScope = () => null;
ctx.slug = (a, b) => `${a}-${b}`;
ctx.state = () => ({ params: new URLSearchParams(''), route: 'employee' });
ctx.hrSetView('owner');

const clone = (id, patch) => Object.assign(JSON.parse(JSON.stringify(ctx.empById(id))), patch || {});
function seed(id, patch) {
  const e = {
    id, name: 'Alex Chen', firstName: 'Alex', lastName: 'Chen', store: 'Demo',
    status: 'active', migrated: false, employeeNo: '1001', entryDate: '2026-01-01',
    contact: { email: 'alex@example.com', phone: '111', krankenkasse: 'TK' },
    ids: { steuerId: '01234567890', rentenversicherung: '12123456A001', iban: 'DE89370400440532013000' },
    contract: { type: 'teilzeit', rate: 15, payType: 'hourly', nationalityClass: 'eu', isStudent: null },
    birthday: '1990-01-01',
    docs: { id: { state: 'ok', file: 'passport.pdf', at: '2026-01-01T00:00:00.000Z', expiry: '2027-01-01' } },
    history: []
  };
  Object.assign(e, patch || {});
  e.status = ctx.empDeriveStatus(e, '2026-11-06');
  staff = staff.filter(x => x.id !== e.id).concat([e]);
  return e;
}

/* 状态：未来最后工作日仍在岗；审核通过但入职在未来是待入职；撤销/取消默认隐藏（HR-LIFE-02） */
seed('active');
seed('leaving', { leave: { lastDay: '2026-11-20', noticeDate: '2026-11-01' } });
seed('left', { leave: { lastDay: '2026-10-01', noticeDate: '2026-09-01' } });
seed('pending', { entryDate: '2026-12-01', invite: { state: 'approved' } });
seed('revoked', { invite: { state: 'revoked' } });
seed('cancelled', { invite: { state: 'cancelled' } });
assert.equal(ctx.empDeriveStatus(ctx.empById('leaving')), 'leaving');
assert.equal(ctx.empDeriveStatus(ctx.empById('left')), 'left');
assert.equal(ctx.empDeriveStatus(ctx.empById('pending')), 'pending');
assert.ok(ctx.empStaff().some(e => e.id === 'leaving'), '最后工作日未过仍算在岗');
assert.ok(!ctx.empStaff().some(e => e.id === 'pending'), '待入职不计入在岗');
assert.ok(!ctx.empRosterVisible().some(e => e.id === 'revoked' || e.id === 'cancelled'), '撤销/取消默认隐藏');
assert.equal(ctx.empSummary(null, '2026-11-06').headcount, 2);

/* 待处理列：等我审核 / 等我发合同 / 等我核对归档（HR-TODO-52） */
const review = seed('review', { invite: { state: 'submitted', submittedAt: '2026-11-01T09:00:00.000Z' } });
assert.ok(ctx.empPendingEntries(review, '2026-11-06').some(x => x.code === '22'));
review.invite = { state: 'approved', approvedAt: '2026-11-01T09:00:00.000Z' };
assert.ok(ctx.empPendingEntries(review, '2026-11-06').some(x => x.code === '24'));
review.invite = { state: 'approved', contractSentAt: '2026-11-01T09:00:00.000Z', contractSignedSubmittedAt: '2026-11-02T09:00:00.000Z' };
assert.ok(ctx.empPendingEntries(review, '2026-11-06').some(x => x.code === '26'));
const archiveRow = seed('archive-row', {
  invite: { state: 'approved', fillMode: 'veteran', contractSentAt: '2026-11-01T09:00:00.000Z', contractSignedSubmittedAt: '2026-11-02T09:00:00.000Z' },
  docs: {
    id: { state: 'ok', file: 'passport.pdf', expiry: '2027-01-01' },
    healthFront: { state: 'ok', file: 'health-front.png' },
    healthBack: { state: 'ok', file: 'health-back.png' },
    bankFront: { state: 'ok', file: 'bank.png' },
    belehrung: { state: 'ok', file: 'hygiene.pdf', expiry: '2028-01-01' },
    contract: { state: 'ok', file: 'contract.pdf' },
    personalquestionnaire: { state: 'ok', file: 'questionnaire.pdf' }
  }
});
const html = ctx.empStaffRow(archiveRow, '2026-11-06');
assert.ok(html.includes('待核对归档合同'), '行内显示最严重的一项');

/* 推送补件：无邮箱、未绑定、不在岗都不能推送（HR-ACCESS-31、HR-ONB-44） */
const noMail = seed('nomail', { contact: { email: '', phone: '111', krankenkasse: 'TK' }, docs: { id: { state: 'missing' } } });
assert.ok(ctx.empPushBlockReason(noMail, '2026-11-06').includes('邮箱'));
const unbound = seed('unbound', { docs: { id: { state: 'missing' } }, account: { state: 'invited' } });
assert.ok(ctx.empPushBlockReason(unbound, '2026-11-06').includes('确认绑定'));
const ready = seed('ready', { docs: { id: { state: 'missing' } }, account: { state: 'active' } });
assert.equal(ctx.empPushBlockReason(ready, '2026-11-06'), '');
const pendingPush = seed('pendingpush', { entryDate: '2026-12-01', invite: { state: 'approved' }, docs: { id: { state: 'missing' } }, account: { state: 'active' } });
assert.ok(ctx.empPushBlockReason(pendingPush, '2026-11-06').includes('不在岗'));

/* 首页：数人、占位卡、无排班工资假数据（HR-TODO-50/51/53） */
const home = ctx.employeeHomePage();
assert.ok(home.includes('人待处理'));
assert.ok(home.includes('即将开放'));
assert.ok(!home.includes('本月计薪工时') && !home.includes('本周人工成本'), '不再显示假数据');
assert.ok(home.includes('税务师权限'));

/* 证件总览：关注期单独显示、健康证列叫下次复训日、仅记录单独标记（HR-DOC-19/24/31） */
const soonDoc = seed('soon', { docs: { id: { state: 'ok', file: 'passport.pdf', expiry: '2027-01-05' } } });
assert.equal(ctx.empAlertsFor(soonDoc, '2026-11-06').some(a => a.kind === 'doc' && a.level === 'soon'), false, '关注期不进待办');
assert.ok(ctx.empSoonEntries(null, '2026-11-06').some(a => a.employee.id === 'soon'));
seed('recordonly', { migrated: true, docs: { id: { state: 'ok', expiry: '2027-01-01' } } });
const docPage = ctx.employeeDocPage();
assert.ok(docPage.includes('下次复训日'));
assert.ok(docPage.includes('提前知道（关注期'));
assert.ok(docPage.includes('仅记录'));
ctx.hrSetView('manager');
assert.ok(!ctx.employeeDocPage().includes('老板已对你关闭「改证件提醒天数」'), 'ANS-4：店长默认可以改证件提醒天数');
ctx.empSetRule('docWarnDays', 21);
assert.equal(ctx.empRule('docWarnDays'), 21, '店长可改证件提醒天数');
assert.equal(ctx.empRuleAudit()[0].by, '店长', '改动留审计');
ctx.empSetRule('probationMonths', 5);
assert.notEqual(ctx.empRule('probationMonths'), 5, '店长不能改其他参数');
ctx.empSetRule('docWarnDays', 30);
ctx.hrSetMgrPerm({ docWarn: false });
assert.ok(ctx.employeeDocPage().includes('老板已对你关闭「改证件提醒天数」'));
ctx.empSetRule('docWarnDays', 10);
assert.equal(ctx.empRule('docWarnDays'), 30, '老板关闭后店长改不了');
ctx.hrSetMgrPerm({ docWarn: true });
ctx.hrSetView('owner');

/* 合规设置：Betriebsnummer、默认问卷、五类保存年限、只读法定上限、待老板确认汇总 */
const rulesPage = ctx.employeeRulesPage();
assert.ok(rulesPage.includes('Betriebsnummer'));
assert.ok(rulesPage.includes('默认个人调查问卷'));
assert.ok(rulesPage.includes('合同与问卷保存年限'));
assert.ok(rulesPage.includes('工资相关资料保存年限'));
assert.ok(rulesPage.includes('证件保存年限'));
assert.ok(rulesPage.includes('健康证保存年限'));
assert.ok(rulesPage.includes('其他资料保存年限'));
assert.ok(rulesPage.includes('法定最长试用期'));
assert.ok(rulesPage.includes('只读'));
assert.ok(rulesPage.includes('已确认答复'), '答复 83/83 后，待老板确认清单改为已确认答复汇总');
assert.ok(!rulesPage.includes('待老板确认'), '页面上不再有待老板确认黄标');
assert.ok(rulesPage.includes('二、三期使用'));

/* 参数默认值、范围和 0 值规则（HR-CONTRACT-19/20/39～47） */
assert.equal(ctx.empRule('defaultHourlyWage'), '');
assert.equal(ctx.empRule('probationMaxMonths'), 6);
assert.equal(ctx.empRules().some(r => /^deferral/.test(r.id)), false, 'ANS-1：暂缺期限/延期参数一期不做');
assert.equal(ctx.empRuleInputValid('defaultHourlyWage', '').ok, true);
assert.equal(ctx.empRuleInputValid('probationMonths', 6).ok, true);
assert.equal(ctx.empRuleInputValid('probationMonths', 7).ok, false);
assert.equal(ctx.empRuleInputValid('probationMonths', 0).ok, false);
assert.equal(ctx.empRuleInputValid('residenceWarnDays', 0).ok, false);
ctx.hrSetView('manager');
ctx.empSetRule('probationMonths', 3);
assert.equal(ctx.empRule('probationMonths'), 6, '店长不能改');
assert.ok(ctx.employeeRulesPage().includes('只有老板和管理员可以操作'));
ctx.hrSetView('owner');
ctx.empSetRule('probationMonths', 3);
assert.equal(ctx.empRule('probationMonths'), 3);

/* 保存期按五类分别读取和处理（HR-LIFE-42、HR-DATA-01/04） */
ctx.empSetRule('recordRetentionContractYears', 5);
const retired = seed('retired', { leave: { lastDay: '2020-02-29', noticeDate: '2020-01-01' } });
let rows = ctx.empRetentionRows(retired);
assert.equal(rows.find(r => r.id === 'contract').years, 5);
assert.equal(rows.find(r => r.id === 'contract').until, '2025-03-01');
assert.equal(rows.find(r => r.id === 'documents').years, 10);
ctx.empMarkRetentionHandled('retired', 'contract');
assert.ok(ctx.empRetentionHandledFor(ctx.empById('retired'), 'contract'));
assert.equal(ctx.empRetentionHandledFor(ctx.empById('retired'), 'documents'), null);

/* 默认问卷在发合同时自动带出并冻结当次版本（HR-ONB-50） */
const dispatched = seed('dispatch', {
  store: 'Martin Biergarten',
  invite: { state: 'approved', approvedAt: '2026-11-01T09:00:00.000Z', contractTemplate: { name: 'vertrag.pdf', dataUrl: 'data:vertrag' } }
});
ctx.empSaveQuestionnaireTemplate({ bodyZh: '', bodyDe: '', file: { name: 'fragebogen.pdf', dataUrl: 'data:fragebogen' } });
const result = ctx.empSendContractDispatch('dispatch');
assert.equal(result.ok, true);
assert.equal(ctx.empById('dispatch').invite.questionnaireTemplate.name, 'fragebogen.pdf');
assert.equal(ctx.empById('dispatch').invite.questionnaireTemplate.fromDefault, true);

console.log('PASS: B2-b4b status/pending/push/home/doc-overview/compliance/retention/default-questionnaire rules');
