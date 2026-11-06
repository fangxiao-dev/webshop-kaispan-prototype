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
ctx.empToday = () => '2026-11-06';

const e = JSON.parse(JSON.stringify(ctx.empAllStaff().find(x => x.invite?.state === 'sent')));
e.invite.draftProgress = { at: '2026-11-06T10:00:00.000Z', done: 8, total: 8, layers: { 1: { done: 8, total: 8 }, 2: { done: 1, total: 3 }, 3: { done: 0, total: 3 } } };
const progress = ctx.empInviteProgress(e);
assert.equal(progress.done, 8, '员工草稿第一层已填 8/8，老板端显示 8/8');
assert.equal(progress.total, 8);
assert.equal(progress.complete, true);
assert.equal(progress.layers[2].done, 1);
assert.equal(progress.layers[3].total, 3);
assert.ok(ctx.empLayerCountsText(progress.layers).includes('2 层 1/3'));
assert.ok(!JSON.stringify(progress).includes('Hauptstrasse'), '只含数量，不含草稿值');

const submitted = JSON.parse(JSON.stringify(e));
submitted.invite.state = 'submitted';
assert.notEqual(ctx.empInviteProgress(submitted).layers[2].done, 1, '已提交后按冻结提交版计数，不再读草稿进度');

console.log('PASS: draft progress published by employee side is shown on the owner side without draft values; submitted state ignores it');
