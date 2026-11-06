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
let clock = '2026-11-06T10:00:00.000Z';
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
ctx.empToday = () => clock.slice(0, 10);
ctx.empNow = () => clock;
ctx.empFileUrl = () => '';
ctx.state = () => ({ route: 'employee-ui', params: new URLSearchParams('') });
ctx.app = () => {};
ctx.rerender = () => {};
ctx.empQuestionnaireTemplate = () => ({ file: null });

const handlers = {};
const box = { textContent: '', scrollIntoView() {} };
ctx.document = {
  querySelector: sel => {
    if (sel === '.eu-validation') return box;
    if (sel === '.eu-supplement-return') return { addEventListener: (type, fn) => { handlers.ret = fn; } };
    return null;
  },
  querySelectorAll: () => []
};

const emp = id => ctx.empById(id);
const EU_KEY = run('EU_KEY');
const SESSION = 'resubmit-key';

function seed(id, itemKey) {
  const e = {
    id, name: 'Alex Chen', firstName: 'Alex', lastName: 'Chen', status: 'active', store: 'Martin Biergarten',
    contact: { email: 'alex@example.com', phone: '111' }, ids: {}, docs: {}, history: [],
    contract: { type: 'teilzeit', isStudent: false, nationalityClass: 'eu' },
    employeePortal: { supplementRequest: { requestId: `portal-${id}`, state: 'open', at: '2026-11-06T09:00:00.000Z', sentAt: '2026-11-06T09:00:00.000Z', items: [{ key: itemKey }] } }
  };
  staff = staff.filter(x => x.id !== id);
  staff.push(e);
  run(`euSession.key=${JSON.stringify(SESSION)};euSession.demo=""`);
  store[EU_KEY] = { [SESSION]: { employeeId: id, profile: {}, docs: {}, messages: [] } };
  return e;
}
function patchLocal(patch) {
  const all = ctx.empRead(EU_KEY, {});
  all[SESSION] = { ...all[SESSION], ...patch };
  ctx.empWrite(EU_KEY, all);
}
function fillField(key, value) { patchLocal({ updateDraft: { profile: { [key]: value }, docs: {} } }); }
function fillPassport(name) {
  patchLocal({ updateDraft: { profile: { passportExpiry: '2035-01-01' }, docs: { passport: { name, data: 'data:x', at: clock } } } });
}
function submit() {
  run('euBind()');
  box.textContent = '';
  handlers.ret();
}
function currentReq(id) { return emp(id).employeePortal.supplementRequest; }
function sub(id) { return emp(id).employeePortal.supplementSubmission; }

/* 1. 字段类（电话）：交回 → 退回 → 重交 → 采纳 */
seed('p1', 'phone');
clock = '2026-11-06T10:30:00.000Z';
fillField('phone', '222');
submit();
assert.equal(box.textContent, '', '首次交回不应报缺项');
assert.equal(sub('p1').status, 'submitted');
assert.equal(sub('p1').items[0].key, 'phone', '交回记录保留结构化键');
assert.equal(sub('p1').items[0].label, '电话', '展示文字单独放 label');
assert.equal(ctx.empReviewSources(emp('p1')).length, 1);
assert.equal(ctx.empReturnReview('p1', '请重填').ok, true);
assert.equal(currentReq('p1').items[0].key, 'phone', '退回后新一轮请求用结构化键');
clock = '2026-11-06T12:30:00.000Z';
fillField('phone', '333');
submit();
assert.equal(box.textContent, '', '退回后重交不应报缺项');
assert.equal(sub('p1').status, 'submitted');
assert.equal(sub('p1').submitted.contact.phone, '333');
assert.equal(ctx.empAcceptReview('p1').ok, true);
assert.equal(emp('p1').contact.phone, '333');

/* 2. 证件类（护照） */
seed('p2', 'passport');
clock = '2026-11-06T10:30:00.000Z';
fillPassport('pp1.png');
submit();
assert.equal(box.textContent, '');
assert.equal(sub('p2').items[0].key, 'passport');
assert.equal(ctx.empReturnReview('p2', '照片不清晰').ok, true);
assert.equal(currentReq('p2').items[0].key, 'passport');
clock = '2026-11-06T12:30:00.000Z';
fillPassport('pp2.png');
submit();
assert.equal(box.textContent, '', '护照退回后重交不应报缺项');
assert.equal(ctx.empReviewSources(emp('p2')).length, 1, '老板能重新看到核对卡');
assert.equal(ctx.empAcceptReview('p2').ok, true);

/* 3. 连续两次退回仍可重交 */
seed('p3', 'phone');
clock = '2026-11-06T10:30:00.000Z';
fillField('phone', '222');
submit();
ctx.empReturnReview('p3', '第一次退回');
clock = '2026-11-06T11:30:00.000Z';
fillField('phone', '333');
submit();
assert.equal(box.textContent, '');
ctx.empReturnReview('p3', '第二次退回');
assert.equal(currentReq('p3').items[0].key, 'phone');
clock = '2026-11-06T12:30:00.000Z';
fillField('phone', '444');
submit();
assert.equal(box.textContent, '', '连续两次退回后仍可重交');
assert.equal(ctx.empAcceptReview('p3').ok, true);
assert.equal(emp('p3').contact.phone, '444');

/* 4. 旧纯文字记录兼容：从冻结的 submitted 重建键 */
seed('p4', 'phone');
const legacy = {
  requestId: 'legacy-1', status: 'submitted', state: 'submitted', at: '2026-11-06T10:30:00.000Z',
  items: ['电话', '护照 / 身份证'],
  submitted: { requestId: 'legacy-1', contact: { phone: '222' }, ids: {}, docs: { id: { state: 'ok', file: 'pp.png', expiry: '2035-01-01', at: '2026-11-06T10:30:00.000Z' } } }
};
staff[staff.length - 1].employeePortal = { supplementRequest: null, supplementSubmission: legacy };
clock = '2026-11-06T11:00:00.000Z';
assert.equal(ctx.empReturnReview('p4', '旧记录退回').ok, true);
const restored = currentReq('p4').items.map(x => x.key).sort();
assert.deepEqual(restored, ['passport', 'phone'], '旧纯文字记录退回后重建出稳定键');
clock = '2026-11-06T12:30:00.000Z';
fillField('phone', '555');
patchLocal({ updateDraft: { profile: { phone: '555', passportExpiry: '2035-01-01' }, docs: { passport: { name: 'pp2.png', data: 'data:x', at: clock } } } });
submit();
assert.equal(box.textContent, '', '旧记录退回后可重交');
assert.equal(sub('p4').status, 'submitted');
assert.notEqual(sub('p4').requestId, 'legacy-1');

console.log('PASS: portal supplement resubmit works after return (field, document, double return, legacy text records)');
