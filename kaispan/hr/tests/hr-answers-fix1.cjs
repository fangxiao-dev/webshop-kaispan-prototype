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
for (const file of ['viewpoint.js', 'hr-answers.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js', 'hr-todos.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}
const run = code => vm.runInContext(code, ctx);
ctx.slug = (a, b) => `${a}-${b}`;
ctx.empToday = () => '2026-11-06';
ctx.empNow = () => '2026-11-06T10:00:00.000Z';
ctx.empScope = () => null;
ctx.app = () => {};
ctx.rerender = () => {};
ctx.state = () => ({ params: new URLSearchParams(''), route: 'employee-ui' });
ctx.hrSetView('owner');
ctx.empAllStaff();

const handlers = {};
const box = { textContent: '', scrollIntoView() {} };
ctx.document = {
  querySelector: sel => {
    if (sel === '.eu-validation') return box;
    if (sel === '.eu-material-submit') return { addEventListener: (type, fn) => { handlers.submit = fn; } };
    return null;
  },
  querySelectorAll: () => []
};

const EU_KEY = run('EU_KEY');
const SESSION = 'fix1-key';
const clone = (id, patch) => {
  const base = ctx.empById(id);
  const next = JSON.parse(JSON.stringify(base));
  next.id = patch.id;
  next.invite = { ...next.invite, token: ctx.empToken() };
  next.contact = { ...(next.contact || {}), email: `${patch.id}@example.com` };
  if (next.account) next.account = { ...next.account, email: next.contact.email, user: next.contact.email };
  return Object.assign(next, patch);
};
function employeeSubmits(id, local) {
  const e = clone('e16', { id });
  e.invite = { portalVersion: 2, state: 'sent', token: ctx.empToken(), sentAt: '2026-11-04T09:00:00.000Z', submitted: {}, reminders: [], resendLog: [] };
  e.docs = {};
  e.ids = {};
  e.contact = { email: `${id}@example.com` };
  e.birthday = '';
  ctx.empSaveStaff(e);
  run(`euSession.key=${JSON.stringify(SESSION)};euSession.demo="";euSession.step="materials"`);
  const all = ctx.empRead(EU_KEY, {});
  all[SESSION] = { employeeId: id, messages: [], docs: {}, ...local, profile: { language: '中文', ...(local.profile || {}) } };
  ctx.empWrite(EU_KEY, all);
  run('euBind()');
  box.textContent = '';
  handlers.submit();
  return { box: box.textContent, employee: ctx.empById(id) };
}

/* P1-1：第一层缺 IBAN / 护照 / 银行卡，员工提交按钮照样能提交；国籍必须先回答 */
const hygiene = { name: 'hygiene.pdf', data: 'data:x', at: '2026-11-05T09:00:00.000Z' };
const profile = { nationalityClass: 'eu', student: 'no', first: 'Lea', last: 'Test', birthday: '1999-01-01', street: 'A', houseNo: '1', zip: '12345', city: 'Dortmund', rentenversicherung: '12 123456 A 001' };
const noNat = employeeSubmits('f1-nat', { profile: { first: 'Lea', last: 'Test' } });
assert.notEqual(noNat.employee.invite.state, 'submitted', '国籍没回答：不能提交（国籍决定要交哪些材料）');
assert.ok(noNat.box.includes('国籍'));

const layer1Only = employeeSubmits('f1-l1', { profile, docs: { hygiene } });
assert.equal(layer1Only.employee.invite.state, 'submitted', '第一层缺 IBAN/护照/银行卡仍可提交');
const missing1 = ctx.empOnbItems(layer1Only.employee, 'submitted').filter(x => !x.done && x.layer === 1).map(x => x.key);
assert.ok(missing1.includes('iban') && missing1.includes('passport') && missing1.includes('bankFront'), '第一层确实缺这几项：' + missing1);
assert.equal(ctx.empOnbGaps(layer1Only.employee, 'submitted').length, 0, '只缺第一层：不触发特殊审批');
assert.equal(ctx.empSpecialNeeded(layer1Only.employee), false);

/* 只缺第一层：店长直接审核通过 */
ctx.hrSetView('manager');
assert.equal(ctx.empApproveInvite('f1-l1', { entryDate: '2026-12-01' }).ok, true, '只缺第一层：店长可直接通过');
assert.equal(ctx.empById('f1-l1').invite.specialApproval, undefined, '不留特殊审批记录');

/* 缺第二层：店长 special_owner，老板填原因后通过并留记录 */
const layer2Gap = employeeSubmits('f1-l2', { profile: { ...profile, rentenversicherung: '' }, docs: { hygiene } });
assert.equal(layer2Gap.employee.invite.state, 'submitted');
assert.deepEqual(JSON.parse(JSON.stringify(ctx.empOnbGaps(layer2Gap.employee, 'submitted').map(x => x.key))), ['rentenversicherung']);
ctx.hrSetView('manager');
assert.equal(ctx.empApproveInvite('f1-l2', { entryDate: '2026-12-01', specialReason: '想放行' }).code, 'special_owner');
ctx.hrSetView('owner');
assert.equal(ctx.empApproveInvite('f1-l2', { entryDate: '2026-12-01' }).code, 'special_reason');
assert.equal(ctx.empApproveInvite('f1-l2', { entryDate: '2026-12-01', specialReason: '社保号下周补' }).ok, true);
const rec = ctx.empById('f1-l2').invite.specialApproval;
assert.deepEqual(JSON.parse(JSON.stringify(rec.items)), ['rentenversicherung']);
assert.ok(rec.reason && rec.by && rec.at);

/* P2-1：新增员工端文案 de/en 不含中文 */
const keys = Object.keys(run('EU_ANSWERS_COPY.en'));
assert.ok(keys.length >= 9);
for (const lang of ['de', 'en']) {
  for (const key of keys) {
    const out = key.includes('{') ? ctx.euTF(key, { done: 1, total: 4, n: 2 }) : ctx.euTranslate(key, lang);
    if (key.includes('{')) {
      const map = run(`EU_TRANSLATIONS.${lang}`);
      assert.ok(map[key] && !/[一-龥]/.test(map[key]), `${lang}: ${key}`);
    } else {
      assert.ok(!/[一-龥]/.test(out) && out !== key, `${lang}: ${key} -> ${out}`);
    }
  }
}
const sentence = ctx.euTranslate('审核已通过。上传签好的劳动合同和个人调查问卷（两份）后，才会开放班表、资料等工作台；在那之前这里只有入职任务页。', 'de');
assert.ok(!/[一-龥]/.test(sentence));
assert.ok(/[一-龥]/.test(ctx.euTranslate('这句话没有翻译', 'de')), '校验方法本身能识别漏译');

/* P2-2：全站待办与 empPendingEntries 同一事项集合、同一升级结果；员工本人才能办的停滞不进管理端 */
const mk = (id, patch) => { const e = clone('e16', { id }); Object.assign(e.invite, patch.invite || {}); ctx.empSaveStaff(Object.assign(e, patch.top || {})); return e; };
ctx.hrSetView('owner');
mk('g-fresh', { invite: { state: 'submitted', submittedAt: '2026-11-05T09:00:00.000Z' } });
mk('g-old', { invite: { state: 'submitted', submittedAt: '2026-11-02T09:00:00.000Z' } });
mk('g-wait', { invite: { state: 'sent', sentAt: '2026-10-01T09:00:00.000Z' } });
const entriesOf = id => ctx.empPendingEntries(ctx.empById(id), '2026-11-06');
const isolate = ids => { const keep = new Set(ids); const all = ctx.empAllStaff().filter(e => keep.has(e.id)); ctx.empAllStaff = () => all; ctx.empRoster = () => all; ctx.empRosterVisible = () => all; };
isolate(['g-fresh', 'g-old', 'g-wait']);
ctx.empAllStaff().forEach((e, i) => { e.name = ['Only Fresh', 'Only Old', 'Only Wait'][i]; });
const globalItems = ctx.empTodoItems().filter(t => t.module === '员工助手');
const titles = globalItems.map(t => t.title);
assert.equal(entriesOf('g-fresh').some(x => x.key === 'review'), false);
assert.equal(titles.some(t => t.startsWith('Only Fresh')), false, '1 个工作日：全站待办也不出现');
const oldEntries = entriesOf('g-old');
assert.equal(oldEntries.filter(x => x.key === 'review' && x.escalated).length, 1);
const oldReview = globalItems.filter(t => t.type === '入职待审核' && t.title.startsWith('Only Old'));
assert.equal(oldReview.length, oldEntries.filter(x => x.key === 'review').length, '超过 2 个工作日：两处事项数量一致');
assert.ok(oldReview[0].title.includes('店长 2 个工作日未处理'), '带升级标识');
const oldStall = globalItems.filter(t => t.type === '入职流程停滞' && t.title.startsWith('Only Old'));
assert.equal(oldStall.length, oldEntries.filter(x => x.key === 'stalled').length, '审核停滞也一致');
assert.ok(oldStall.every(t => t.title.includes('店长 2 个工作日未处理')));
assert.equal(titles.some(t => t.startsWith('Only Wait')), false, '员工本人才能办的停滞事项不进管理端全站待办');
assert.equal(entriesOf('g-wait').some(x => x.key === 'stalled'), false);

ctx.hrSetView('manager');
const managerTitles = ctx.empTodoItems().map(t => t.title);
assert.ok(managerTitles.some(t => t.startsWith('Only Fresh')), '店长视角：1 个工作日的就能看到');
assert.ok(!managerTitles.some(t => t.includes('店长 2 个工作日未处理')), '店长自己的视角没有升级标识');
ctx.hrSetView('owner');

console.log('PASS: fix1 — 第二层才触发特殊审批（走员工提交按钮）、de/en 文案、全站待办与 empPendingEntries 同口径');
