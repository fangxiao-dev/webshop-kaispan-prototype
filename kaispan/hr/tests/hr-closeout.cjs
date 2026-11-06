process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const ctx = vm.createContext({ console, URLSearchParams, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
for (const file of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
}

const e = {};
for (let i = 0; i < 80; i++) ctx.empCloseRequestId(e, 'req-' + i);
assert.equal(e.closedRequestIds.length, 80, '关闭记录不因数量被淘汰');
assert.equal(ctx.empRequestClosed(e, 'req-0'), true, '最早的请求仍是终态，重放不能复活');

ctx.empById = id => (id === 'x' ? { id: 'x', closedRequestIds: ['old'] } : null);
ctx.euDemo = () => false;
ctx.euEmployee = () => ({ id: 'x', closedRequestIds: ['old'] });
ctx.euSupplementSubmission = () => ({ entries: [], sub: { requestId: 'old' }, missing: [] });
const result = ctx.euSupplementSubmissionFor({}, {});
assert.notEqual(result.sub.requestId, 'old', '只有门户投影（没有 e.request）时，退回后重交也换新 requestId');

console.log('PASS: closed request ids are never evicted; portal-only supplement resubmit gets a fresh requestId');
