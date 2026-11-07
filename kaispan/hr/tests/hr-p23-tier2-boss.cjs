/* 二三期原型第 2 档老板端：首页二三期卡与待办组、待办页逐项事项、合规设置标签、后续流程示例 */
process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');

function boot(files, params = '') {
  const memory = new Map();
  const ctx = vm.createContext({ console, URLSearchParams, localStorage: {
    getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) } });
  for (const f of files) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  ctx.slug = (a, b) => `${a}-${b}`; ctx.empScope = () => null;
  ctx.state = () => ({ params: new URLSearchParams(params), route: 'employee' });
  ctx.empToday = () => '2026-11-07'; ctx.empNow = () => '2026-11-07T12:00:00.000Z';
  ctx.app = () => {}; ctx.rerender = () => {};
  ctx.empAllStaff();
  return ctx;
}
const ALL = ['viewpoint.js', 'hr-model.js', 'employee.js', 'schedule.js', 'attend.js', 'leave.js', 'pay.js', 'hours.js', 'employee-ui-i18n.js', 'employee-ui.js', 'hr-todos.js'];

/* R1/R3 首页：二三期是可点击数据卡 + 不灰期次标签；副标题不再写“二、三期开放” */
{
  const ctx = boot(ALL);
  const home = ctx.employeeHomePage();
  assert.ok(home.includes('is-mod-sch') && home.includes('is-mod-pay'), '排班/工资真实数据卡');
  assert.ok(/emp-module is-live is-mod-sch/.test(home) && /emp-module is-live is-mod-pay/.test(home));
  assert.ok(!home.includes('aria-disabled') && !home.includes('即将开放'), '不再是灰占位');
  assert.ok(home.includes('emp-phase-tag">二期') && home.includes('emp-phase-tag">三期'));
  assert.ok(home.includes('本原型包含各期功能，正式一期范围以规格和修订为准'));
  assert.ok(!home.includes('二、三期开放'), '副标题不再是关闭式说法');
  assert.ok(home.includes('人待处理') || home.includes('提前知道') || home.includes('资料齐全'), '人事计数还在');
  assert.ok(home.includes('税务师权限'));
}

/* R2 首页待办区：人事保持，另有排班/考勤/休假/工资各组 + 期次标签 */
{
  const ctx = boot(ALL);
  const items = [...ctx.schTodoItems(), ...ctx.attTodoItems(), ...ctx.lvTodoItems(), ...ctx.payTodoItems()];
  const html = ctx.empHomeTodoSection(ctx.empSummary(null));
  assert.ok(html.includes('emp-alert-card') && !html.includes('emp-allclear') === (items.length > 0 || html.includes('is-mod-staff')));
  if (items.length) {
    assert.ok(html.includes('is-mod-sch') || html.includes('is-mod-pay'), '模块组出现');
    assert.ok(html.includes('emp-phase-tag"'), '组头有期次标签');
  }
  assert.ok(html.includes('HR-TODO-05'), '人事口径文案还在');
}
/* 全清文案涵盖各模块：人事、排班、工资清单都空时 */
{
  const ctx = boot(ALL);
  ctx.schTodoItems = () => []; ctx.attTodoItems = () => []; ctx.lvTodoItems = () => []; ctx.payTodoItems = () => [];
  ctx.empPendingPeople = () => []; ctx.empSoonPeople = () => [];
  const html = ctx.empHomeTodoSection(ctx.empSummary(null));
  assert.ok(html.includes('emp-allclear') && html.includes('排班') && html.includes('工资') && html.includes('考勤') && html.includes('休假'));
  assert.ok(!html.includes('不在这里假装有数据'));
}
/* 只有模块有事、人事全清：仍显示模块组 */
{
  const ctx = boot(ALL);
  ctx.empPendingPeople = () => []; ctx.empSoonPeople = () => [];
  ctx.schTodoItems = () => [{ type: '排班未发布', due: '本周到期', risk: '中风险', title: '下周班表还没发', de: 'x', href: '#s' }];
  ctx.attTodoItems = () => []; ctx.lvTodoItems = () => []; ctx.payTodoItems = () => [{ type: '工资待发', due: '已逾期', risk: '高风险', title: '有工资待发', de: 'y', href: '#p' }];
  const html = ctx.empHomeTodoSection(ctx.empSummary(null));
  assert.ok(!html.includes('emp-allclear') && html.includes('is-mod-sch') && html.includes('is-mod-pay') && html.includes('下周班表还没发') && html.includes('有工资待发'));
  assert.ok(html.includes('二期') && html.includes('三期') && !html.includes('is-mod-staff'));
}
/* 模块文件没加载：退回“未加载”占位，不报错 */
{
  const ctx = boot(['viewpoint.js', 'hr-model.js', 'employee.js']);
  const home = ctx.employeeHomePage();
  assert.ok(home.includes('排班与考勤') && home.includes('未加载'));
}

/* R6 待办页：二三期逐项事项正常展示、带期次标签，一期类型清单保留 */
for (const view of ['owner', 'employee']) {
  const ctx = boot(ALL, `view=${view}`);
  const page = ctx.hrTodosPage();
  assert.equal(vm.runInContext('HR_TODO_TYPE_LIST.length', ctx), 17, '一期类型清单保留（17 类，未改动）');
  assert.ok(page.includes('HR-TODO-20') && (view === 'employee' || page.includes('HR-TODO-39')));
  assert.ok(!page.includes('不进一期') && !page.includes('class="is-muted"') && !page.includes('tr class="is-muted"'), '没有灰行');
  assert.ok(page.includes('hr-todo-phase') && page.includes('二期') && page.includes('三期') && (view === 'employee' ? page.includes('后续') : true), 'HACCP 行是员工端事项，只在员工视角');
  assert.ok(page.includes('本原型包含各期功能，正式一期范围以规格和修订为准'));
  assert.ok(page.includes('漏打卡 / 打卡异常') || view === 'employee', '考勤逐项');
  assert.ok(page.includes('班次时间发生变更') && page.includes('年假申请等待审批') || view === 'employee');
  assert.ok(page.includes('休假结果 / 病假材料待补'));
  assert.equal(page.includes('新班表已发布'), view === 'employee');
  assert.equal(page.includes('HACCP 表格待填写'), view === 'employee');
  assert.ok(view === 'employee' ? page.includes('href="#employee-ui"') : /href="#[^"]*排班管理"/.test(page), '处理入口：老板端到模块页，员工端到员工端');
  assert.ok(view === 'employee' || /href="#[^"]*工资单与发薪"/.test(page), '处理入口指向工资');
}
{
  const ctx = boot(ALL, 'view=owner&kind=薪资');
  const page = ctx.hrTodosPage();
  assert.ok(page.includes('等待税务师工资单') && page.includes('待发薪 / 修改待跟进'));
  assert.ok(!page.includes('漏打卡 / 打卡异常'), '分类筛选生效');
}

/* R5 合规设置：二、三期使用标签不灰 */
{
  const ctx = boot(ALL);
  const page = ctx.employeeRulesPage ? ctx.employeeRulesPage() : '';
  if (page) {
    assert.ok(page.includes('二、三期使用'));
    assert.ok(!/pill gray">[^<]*二、三期使用/.test(page), '标签不灰');
  } else {
    assert.ok(!/pill gray">\$\{empT\("二、三期使用"/.test(fs.readFileSync('employee.js', 'utf8')));
  }
}

/* 后续流程示例：合同页签、证件页签，静态只读，不进待办 */
{
  const ctx = boot(ALL);
  const e = ctx.empRoster()[0];
  const before = JSON.stringify(ctx.empById(e.id));
  const todoBefore = JSON.stringify(ctx.hrTodoEntryItems(null));
  const contract = ctx.empTabContract(e, '2026-11-07');
  assert.ok(contract.includes('data-future-flow="contract"') && contract.includes('后续流程示例（一期不做）'));
  for (const w of ['归还钥匙和设备', '核对最后工时', '确认最后工资', '开具离职证明', '员工提出', '公司提出', '双方协商', '合同到期', '最早最后工作日参考']) assert.ok(contract.includes(w), w);
  const docs = ctx.empTabDocs(e, '2026-11-07');
  assert.ok(docs.includes('data-future-flow="docs"') && docs.includes('后续流程示例（一期不做）'));
  for (const w of ['Fiktionsbescheinigung', '同一项最多延期 1 次', '最长 60 天']) assert.ok(docs.includes(w), w);
  assert.ok(contract.includes('emp-phase-tag') && !/emp-future-flow[^>]*class="[^"]*gray/.test(contract));
  assert.equal(JSON.stringify(ctx.empById(e.id)), before, '渲染不改档案');
  assert.equal(JSON.stringify(ctx.hrTodoEntryItems(null)), todoBefore, '不进待办');
  assert.ok(!/<input|<select|<button|data-emp-field/.test(contract.slice(contract.indexOf('data-future-flow="contract"'))) || true);
  const block = contract.slice(contract.indexOf('data-future-flow="contract"'), contract.indexOf('<div hidden>'));
  assert.ok(!/<input|<select|<button|data-emp-field/.test(block), '示例区块只读，没有表单控件');
  const dblock = docs.slice(docs.indexOf('data-future-flow="docs"'));
  assert.ok(!/<input|<select|<button|data-emp-field/.test(dblock), '证件示例只读');
}
console.log('PASS: p23 tier2 boss — R1/R2/R3 首页卡与待办组, R6 待办页逐项事项, R5 标签不灰, 后续流程示例只读不进待办');
