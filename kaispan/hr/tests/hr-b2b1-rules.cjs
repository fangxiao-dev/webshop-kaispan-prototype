process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, URLSearchParams });
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}

ctx.empToday = () => '2026-11-06';
ctx.empRule = id => ({ docWarnDays: 30, docSoonDays: 90, residenceWarnDays: 60, healthRetrainYears: 2 })[id] ?? 0;
let staff = [];
ctx.empAllStaff = () => staff;
ctx.empById = id => staff.find(e => e.id === id) || null;
ctx.empSaveStaff = e => {
  ctx.__saved = JSON.parse(JSON.stringify(e));
  const i = staff.findIndex(x => x.id === e.id);
  if (i >= 0) staff[i] = e; else staff.push(e);
  return e;
};
ctx.empTopupItems = () => [{ kind: 'field', path: 'ids.iban' }];

/* 账号状态：旧数据迁移成“已激活”，离职一律停用 */
assert.equal(ctx.empAccountState({ status: 'active' }), 'none');
assert.equal(ctx.empAccountState({ status: 'active', account: { user: 'a@example.com' } }), 'active');
assert.equal(ctx.empAccountState({ status: 'invited', account: { state: 'invited' } }), 'invited');
assert.equal(ctx.empAccountState({ status: 'left', account: { state: 'active' } }), 'disabled');
assert.equal(ctx.empAccountState({ status: 'active', account: { state: 'pending_link' } }), 'pending_link');

/* 国籍三值：未回答不按欧盟/其他国籍计算材料 */
const base = { status: 'active', contract: {}, docs: {} };
assert.equal(ctx.empDocNeeded(base, ctx.empDocType('residence')), false);
ctx.hrSetNationalityClass(base, 'other');
assert.equal(ctx.empDocNeeded(base, ctx.empDocType('residence')), true);
ctx.hrSetNationalityClass(base, 'eu');
assert.equal(ctx.empDocNeeded(base, ctx.empDocType('residence')), false);
ctx.hrSetNationalityClass(base, '');
assert.equal(ctx.empDocNeeded(base, ctx.empDocType('residence')), false);

/* 居留许可 60 天预警；其他证件 30 天预警、31–90 天只算关注 */
const residence = { status: 'active', contract: { nationalityClass: 'other' },
  docs: { residence: { state: 'ok', expiry: '2026-12-21' } } };
assert.equal(ctx.empDocState(residence, 'residence', '2026-11-06').level, 'warn');
const passport = { status: 'active', contract: {}, docs: { id: { state: 'ok', expiry: '2026-12-21' } } };
assert.equal(ctx.empDocState(passport, 'id', '2026-11-06').level, 'soon');

/* 健康证：首次证明 + 最近复训日，下次复训日 = +2 年 */
const hygiene = { status: 'active', migrated: true, docs: { belehrung: { state: 'ok' } },
  health: { firstProof: 'yes', lastRetrain: '2024-11-06' } };
assert.equal(ctx.empNextRetrain(hygiene), '2026-11-06');
assert.equal(ctx.empDocState(hygiene, 'belehrung', '2026-11-06').level, 'warn');
hygiene.health.lastRetrain = '2020-01-01';
assert.equal(ctx.empDocState(hygiene, 'belehrung', '2026-11-06').level, 'expired');
hygiene.health.firstProof = 'no';
assert.equal(ctx.empDocState(hygiene, 'belehrung', '2026-11-06').level, 'missing');

/* 员工编号：同一雇主内不重复；跨公司可重复 */
staff = [
  { id: 'a', name: 'A', store: 'Martin Biergarten', employeeNo: '1001' },
  { id: 'b', name: 'B', store: 'Martin Biergarten 2', employeeNo: '1002' },
  { id: 'c', name: 'C', store: 'Martin Cafe', employeeNo: '1001' }
];
assert.equal(ctx.empEmployeeNoConflict(staff[0], '1001'), null);
assert.equal(ctx.empEmployeeNoConflict(staff[0], '1002')?.id, 'b');
assert.equal(ctx.empEmployeeNoConflict(staff[0], '1001') === null, true);
assert.equal(ctx.empCompanyOfStore('Martin Biergarten'), ctx.empCompanyOfStore('Martin Biergarten 2'));
assert.notEqual(ctx.empCompanyOfStore('Martin Biergarten'), ctx.empCompanyOfStore('Martin Cafe'));

/* 调店：生效日期校验、跨公司拒绝、账号门店不自动改 */
const mover = { id: 'm', name: 'M', status: 'active', store: 'Martin Biergarten', entryDate: '2024-01-01',
  account: { state: 'active', store: 'Martin Biergarten' }, history: [], docs: {}, ids: {}, contact: {}, contract: {} };
staff = [mover];
assert.equal(ctx.empTransferStore('m', 'Martin Biergarten 2', '2026-11-07').code, 'future');
assert.equal(ctx.empTransferStore('m', 'Martin Biergarten 2', '2023-12-31').code, 'before_entry');
assert.equal(ctx.empTransferStore('m', 'Martin Cafe', '2026-11-06').code, 'company');
assert.equal(ctx.empTransferStore('m', 'Martin Biergarten 2', '').code, 'date');
assert.equal(ctx.empTransferStore('m', 'Martin Biergarten 2', '2026-11-06').ok, true);
assert.equal(ctx.__saved.store, 'Martin Biergarten 2');
assert.equal(ctx.__saved.account.store, 'Martin Biergarten');
assert.equal(ctx.__saved.transfers.at(-1).effectiveDate, '2026-11-06');

/* 补件：同一员工同时只能有一条未结束请求 */
const req = { id: 'r', status: 'active', account: { state: 'active' }, request: { state: 'sent' },
  history: [], docs: {}, ids: {}, contact: {}, contract: {} };
staff = [req];
assert.equal(ctx.empSendRequest('r'), null);

/* 敏感值脱敏 */
assert.equal(ctx.empMaskValue('birthday', '1988-03-14'), '****-**-**');
assert.equal(ctx.empMaskValue('ids.iban', 'DE89 3704 0044 0532 0130 00'), '•••• •••• •••• 3000');
assert.equal(ctx.empMaskValue('ids.steuerId', '01234567890'), '•••••••••90');

/* 变更记录操作人取真实视角 */
const actor = { id: 'h', name: 'H', status: 'active', history: [], docs: {}, ids: {}, contact: {}, contract: { rate: 10 } };
staff = [actor];
ctx.hrSetView('manager');
const changed = JSON.parse(JSON.stringify(actor));
changed.contract.rate = 11;
ctx.empSaveWithHistory(changed);
assert.equal(ctx.__saved.history.at(-1).by, '店长');
ctx.hrSetView('owner');

/* 上传限制：银行卡/医保卡只收照片，最大 20 MB */
assert.equal(ctx.empUploadError({ type: 'image/gif', size: 10 }, true), '只收 PNG 或 JPEG 照片');
assert.equal(ctx.empUploadError({ type: 'image/jpeg', size: 21 * 1024 * 1024 }, true), '文件超过 20 MB');
assert.equal(ctx.empUploadError({ type: 'application/pdf', size: 1024 }, false), '');

console.log('PASS: account states, nationality three-way, residence 60-day warn, health retrain, employee number, store transfer, single request, masking, actor and upload rules');
