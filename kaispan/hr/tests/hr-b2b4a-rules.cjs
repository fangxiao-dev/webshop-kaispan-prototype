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
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
}

let now = '2026-11-06T12:00:00.000Z';
let staff = [];
ctx.empNow = () => now;
ctx.empToday = () => '2026-11-06';
ctx.empRule = id => ({ docWarnDays: 30, docSoonDays: 90, residenceWarnDays: 60, healthRetrainYears: 2, probationWarnDays: 30, probationMonths: 6, probationNoticeWeeks: 2 })[id] ?? 0;
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
ctx.empTopupItems = () => [{ kind: 'field', path: 'ids.iban' }];
ctx.hrSetView('owner');

const clone = (id, patch) => Object.assign(JSON.parse(JSON.stringify(ctx.empById(id))), patch || {});

function seed(patch) {
  const e = {
    id: 't1', name: 'Alex Chen', firstName: 'Alex', lastName: 'Chen', store: 'Demo',
    status: 'active', migrated: false, employeeNo: '1001',
    contact: { email: 'alex@example.com', phone: '111', krankenkasse: 'TK' },
    ids: { steuerId: '01234567890', rentenversicherung: '12123456A001', iban: 'DE89370400440532013000' },
    contract: { type: 'teilzeit', rate: 15, payType: 'hourly', nationalityClass: 'eu', isStudent: null },
    docs: { id: { state: 'ok', file: 'passport.pdf', at: '2026-01-01T00:00:00.000Z', expiry: '2027-01-01' } },
    history: []
  };
  Object.assign(e, patch || {});
  staff = staff.filter(x => x.id !== e.id).concat([e]);
  return e;
}

/* 导出：敏感列只对老板输出；店长即使有敏感查看权限，导出仍留空（HR-DATA-30/32、HR-ACCESS-04） */
const exportBase = seed({ birthday: '1990-01-01' });
let csv = ctx.empRosterCsv([exportBase]);
assert.ok(csv.includes('1990-01-01'));
assert.ok(csv.includes('01234567890'));
assert.ok(csv.includes('DE89370400440532013000'));
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: true });
csv = ctx.empRosterCsv([exportBase]);
assert.ok(!csv.includes('1990-01-01'), '店长导出不含出生日期');
assert.ok(!csv.includes('01234567890'), '店长导出不含税号');
assert.ok(!csv.includes('DE89370400440532013000'), '店长导出不含 IBAN');
assert.ok(csv.includes('TK'), '医保公司不是敏感列，可以保留');
const formula = seed({ id: 't-formula', name: '=cmd|calc' });
assert.ok(ctx.empRosterCsv([formula]).includes("'=cmd|calc"), '公式前缀');
ctx.hrSetView('owner');

/* 资料更新：严格按冻结值采纳，旧文件归档，采纳前正式档案不变（HR-ONB-43、HR-DOC-20/21） */
const update = seed({
  employeePortal: {
    updateRequest: {
      state: 'pending', at: '2026-11-06T10:00:00.000Z',
      items: [
        { key: 'phone', label: '电话', kind: 'field', from: '111', to: '222' },
        { key: 'id', label: '护照 / 身份证', kind: 'doc', from: 'passport.pdf', to: 'passport-neu.pdf',
          file: { name: 'passport-neu.pdf', data: 'data:passport-neu', at: '2026-11-06T10:00:00.000Z' }, expiry: '2028-12-31' }
      ]
    }
  }
});
update.contact.phone = '999';
ctx.empSaveStaff(update);
assert.equal(ctx.empReviewSources(ctx.empById('t1')).length, 1);
const beforeAccept = ctx.empById('t1');
assert.equal(beforeAccept.contact.phone, '999');
assert.equal(ctx.empAcceptReview('t1').ok, true);
const accepted = ctx.empById('t1');
assert.equal(accepted.contact.phone, '222', '采纳使用请求冻结的新值，不读当前草稿/档案');
assert.equal(accepted.docs.id.file, 'passport-neu.pdf');
assert.equal(accepted.docs.id.expiry, '2028-12-31');
assert.equal(accepted.documentArchive[0].file, 'passport.pdf', '旧版本进历史');
assert.equal(accepted.employeePortal.updateRequest.state, 'done');
assert.ok(accepted.history.some(h => h.field === 'review.accepted'));

/* 敏感清空也要权限：补丁包含 IBAN 就必须有“查看敏感资料”（HR-ACCESS-55） */
const clear = seed({
  id: 't-clear',
  employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [{ key: 'iban', label: 'IBAN', kind: 'field', from: 'DE89370400440532013000', to: '' }] } }
});
ctx.hrSetView('manager');
ctx.hrSetMgrPerm({ sensitive: false });
const denied = ctx.empAcceptReview('t-clear');
assert.equal(denied.code, 'permission');
assert.equal(ctx.empById('t-clear').ids.iban, 'DE89370400440532013000', '无权限时正式档案不动');
ctx.hrSetMgrPerm({ sensitive: true });
assert.equal(ctx.empAcceptReview('t-clear').ok, true);
assert.equal(ctx.empById('t-clear').ids.iban, '', '有权限才能清空');
ctx.hrSetView('owner');

/* 证件有效期与文件版本校验（HR-DOC-20） */
const badDate = seed({
  id: 't-bad-date',
  employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [{ key: 'id', label: '护照 / 身份证', kind: 'doc', file: { name: 'neu.pdf', data: 'x', at: '2026-11-06T10:00:00.000Z' }, expiry: '' }] } }
});
assert.equal(ctx.empAcceptReview('t-bad-date').code, 'expiry');
const oldVersion = seed({
  id: 't-old-version',
  employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [{ key: 'id', label: '护照 / 身份证', kind: 'doc', file: { name: 'alt.pdf', data: 'x', at: '2020-01-01T00:00:00.000Z' }, expiry: '2028-12-31' }] } }
});
assert.equal(ctx.empAcceptReview('t-old-version').code, 'version');
const keep = seed({
  id: 't-keep',
  employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [{ key: 'id', label: '护照 / 身份证', kind: 'doc', file: { name: 'neu.pdf', data: 'x', at: '2026-11-06T10:00:00.000Z' }, expiry: '2026-01-01', keepExpiry: true, keepReason: '证件本身没变' }] } }
});
assert.equal(ctx.empAcceptReview('t-keep').ok, true);
assert.equal(ctx.empById('t-keep').docs.id.expiry, '2026-01-01', '保留原日期按冻结值写入');

/* 补件：交齐才能采纳；退回必须写理由；退回后员工需要重新上传（HR-ONB-44） */
const topup = seed({
  id: 't-topup',
  request: { token: 'tok', kind: 'topup', state: 'submitted', sentAt: '2026-11-05T00:00:00.000Z', submittedAt: '2026-11-06T09:00:00.000Z',
    items: [{ kind: 'doc', id: 'id' }],
    submitted: { docs: { id: { state: 'ok', file: 'neu.pdf', dataUrl: 'data:neu', at: '2026-11-06T09:00:00.000Z', expiry: '2028-12-31' } } } }
});
assert.equal(ctx.empReturnReview('t-topup', '').code, 'reason');
assert.equal(ctx.empReturnReview('t-topup', '照片不清晰').ok, true);
assert.equal(ctx.empById('t-topup').request.state, 'sent');
assert.deepEqual(ctx.empById('t-topup').request.submitted, {});
assert.equal(ctx.empById('t-topup').docs.id.file, 'passport.pdf', '退回不动正式档案');
seed({
  id: 't-topup',
  request: { token: 'tok', kind: 'topup', state: 'submitted', sentAt: '2026-11-05T00:00:00.000Z', submittedAt: '2026-11-06T09:00:00.000Z',
    items: [{ kind: 'doc', id: 'id' }],
    submitted: { docs: { id: { state: 'ok', file: 'neu.pdf', dataUrl: 'data:neu', at: '2026-11-06T09:00:00.000Z', expiry: '2028-12-31' } } } }
});
assert.equal(ctx.empAcceptReview('t-topup').ok, true);
assert.equal(ctx.empById('t-topup').request.state, 'done');
assert.equal(ctx.empById('t-topup').docs.id.file, 'neu.pdf');
assert.equal(ctx.empById('t-topup').documentArchive[0].file, 'passport.pdf');

/* 员工端演示补件记录也进同一张卡（employeePortal.supplementSubmission） */
seed({
  id: 't-sup',
  employeePortal: { supplementSubmission: { at: '2026-11-06T09:30:00.000Z', items: ['护照 / 身份证'],
    submitted: { docs: { id: { state: 'ok', file: 'sup.pdf', dataUrl: 'data:sup', at: '2026-11-06T09:30:00.000Z', expiry: '2028-12-31' } } } } }
});
assert.equal(ctx.empReviewSources(ctx.empById('t-sup'))[0].kind, 'supplement');
assert.equal(ctx.empAcceptReview('t-sup').ok, true);
assert.equal(ctx.empById('t-sup').docs.id.file, 'sup.pdf');
assert.equal(ctx.empById('t-sup').employeePortal.supplementSubmission.status, 'accepted');
assert.equal(ctx.empById('t-sup').employeePortal.supplementRequest, null);
seed({
  id: 't-sup-return',
  employeePortal: { supplementSubmission: { at: '2026-11-06T09:30:00.000Z', items: ['护照 / 身份证'],
    submitted: { docs: { id: { state: 'ok', file: 'sup.pdf', dataUrl: 'data:sup', at: '2026-11-06T09:30:00.000Z', expiry: '2028-12-31' } } } } }
});
assert.equal(ctx.empReturnReview('t-sup-return', '').code, 'reason');
assert.equal(ctx.empReturnReview('t-sup-return', '照片不清晰').ok, true);
assert.equal(ctx.empById('t-sup-return').employeePortal.supplementRequest.state, 'open');
assert.equal(ctx.empById('t-sup-return').employeePortal.supplementSubmission.status, 'returned');
assert.equal(ctx.empById('t-sup-return').docs.id.file, 'passport.pdf', '退回不动正式档案');

/* 健康证：旧数据只有 expiry 时替换不丢复训日；采纳后同步首次证明（HR-DOC-31/35） */
const health = { id: 't-health', migrated: true, contract: { nationalityClass: 'eu' }, docs: { belehrung: { state: 'ok', file: 'alt.pdf', expiry: '2027-06-01' } } };
ctx.empReplaceDoc(health, 'belehrung', { file: 'neu.pdf', dataUrl: 'data:neu', at: '2026-11-06T10:00:00.000Z' });
assert.equal(health.health.firstProof, 'yes');
assert.equal(health.health.lastRetrain, '2025-06-01');
assert.equal(health.docs.belehrung.expiry, '2027-06-01', '旧 expiry 换算出的复训日不能丢');
const healthNo = seed({
  id: 't-health-no',
  docs: { belehrung: { state: 'ok', file: 'alt.pdf', expiry: '2027-06-01' } },
  health: { firstProof: 'no', lastRetrain: '2025-06-01' },
  employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [{ key: 'hygiene', label: '健康证', kind: 'doc', file: { name: 'hygiene.pdf', data: 'x', at: '2026-11-06T10:00:00.000Z' }, expiry: '2029-06-01' }] } }
});
assert.equal(ctx.empAcceptReview('t-health-no').ok, true);
assert.equal(ctx.empById('t-health-no').health.firstProof, 'yes');
assert.equal(ctx.empById('t-health-no').health.lastRetrain, '2027-06-01');

/* 新员工无文件判缺失；迁移老员工允许仅记录；国籍未回答时材料清单为空（HR-DOC-19/36） */
assert.equal(ctx.empDocState({ migrated: false, contract: { nationalityClass: 'eu' }, docs: { bankFront: { state: 'ok' } } }, 'bankFront').level, 'missing');
assert.equal(ctx.empDocState({ migrated: true, contract: { nationalityClass: 'eu' }, docs: { bankFront: { state: 'ok' } } }, 'bankFront').level, 'ok');
assert.equal(ctx.empDocNeeded({ contract: {}, docs: {} }, ctx.empDocType('id')), false);
assert.equal(ctx.empDocState({ contract: {}, docs: {} }, 'id').level, 'na');

/* 岗位新增只有老板/管理员；待办标题必须是字符串（HR-CONTRACT-05、清单 3.1.4） */
seed({ id: 't-role' });
ctx.hrSetView('manager');
assert.equal(ctx.empAddRole('洗碗工', 't-role').reason, 'permission');
ctx.hrSetView('owner');
assert.equal(ctx.empAddRole('洗碗工', 't-role').ok, true);
const alertEmployee = seed({ id: 't-alert', docs: {} });
const alerts = ctx.empAlertsFor(ctx.empById('t-alert'));
const docAlert = alerts.find(a => a.kind === 'doc');
assert.ok(docAlert && typeof docAlert.title === 'string');
assert.ok(!String(docAlert.title).includes('[object Object]'));

/* 学生身份 null = 未回答，不按“否”处理；Werkstudent 仍视为学生（HR-DOC-07） */
assert.equal(ctx.empStudentValue({ contract: { isStudent: null } }), false);
assert.equal(ctx.empStudentAnswered({ contract: { isStudent: null } }), false);
assert.equal(ctx.empDocNeeded({ contract: { isStudent: null, nationalityClass: 'eu' } }, ctx.empDocType('student')), false);
assert.equal(ctx.empStudentValue({ contract: { type: 'werkstudent', isStudent: null } }), true);

/* 同一员工只有一条未结束请求：有资料修改待核对时不再推送补件（HR-ONB-43/44） */
seed({ id: 't-busy', account: { state: 'active' }, employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [] } } });
assert.equal(ctx.empSendRequest('t-busy'), null);
seed({ id: 't-idle', account: { state: 'active' } });
assert.ok(ctx.empSendRequest('t-idle'));

/* 核对卡渲染冒烟：资料修改与补件都显示，且不泄漏 [object Object] */
seed({
  id: 't-card',
  employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [{ key: 'phone', label: '电话', kind: 'field', from: '111', to: '222' }] } }
});
const card = ctx.empRequestBanner(ctx.empById('t-card'));
assert.ok(card.includes('员工资料修改'));
assert.ok(card.includes('电话'));
assert.ok(!card.includes('[object Object]'));
seed({
  id: 't-card-doc',
  employeePortal: { updateRequest: { state: 'pending', at: '2026-11-06T10:00:00.000Z', items: [{ key: 'id', label: '护照 / 身份证', kind: 'doc', file: { name: 'neu.pdf', data: 'data:neu', at: '2026-11-06T10:00:00.000Z' }, expiry: '2029-01-01' }] } }
});
const cardDoc = ctx.empRequestBanner(ctx.empById('t-card-doc'));
assert.ok(cardDoc.includes('neu.pdf'));
assert.ok(cardDoc.includes('data:neu'));

console.log('PASS: B2-b4a export sensitive columns/formula guard, frozen update adoption + file archive/expiry/version, sensitive clearing permission, topup accept/return, supplement snapshot card, health legacy retrain, new-hire file rule, nationality-empty materials, role permission, alert title string, null student, single open request, review card smoke');
