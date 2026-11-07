/* 二三期原型第 2 档（员工端）：R4 三个页签恢复、R5 HACCP 后续示例、9.9 差旅提交、8.28 换班、8.4 出差打卡 */
process.chdir(require('path').join(__dirname, '..'));
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const STORE = 'Martin Biergarten';

function boot() {
  const memory = new Map();
  const handlers = {};
  const present = {};
  const fakeEl = sel => (present[sel] = present[sel] || { value: '', textContent: '', _sel: sel,
    addEventListener(type, fn) { (handlers[sel] = handlers[sel] || {})[type] = fn; }, scrollIntoView() {} });
  const document = {
    querySelector: sel => (sel in present ? present[sel] : null),
    querySelectorAll: () => [],
    createElement: () => ({})
  };
  const ctx = vm.createContext({ console, URLSearchParams, document, localStorage: {
    getItem: k => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) } });
  for (const f of ['viewpoint.js', 'hr-model.js', 'employee.js', 'employee-ui-i18n.js', 'employee-ui.js', 'schedule.js', 'attend.js', 'hours.js', 'leave.js', 'pay.js'])
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  ctx.slug = (a, b) => `${a}-${b}`; ctx.empScope = () => null;
  ctx.state = () => ({ params: new URLSearchParams(), route: 'employee-ui' });
  ctx.empToday = () => '2026-11-07'; ctx.empNow = () => '2026-11-07T12:00:00.000Z';
  ctx.app = () => {};
  ctx.empAllStaff();
  return { ctx, run: s => vm.runInContext(s, ctx), handlers, present, fakeEl };
}

const b = boot();
const { ctx, run } = b;
ctx.hrSetView('owner');
const staff = ctx.empStaff(STORE).filter(e => e.status === 'active');
assert.ok(staff.length >= 3, '门店至少 3 个在岗员工才能演示换班');
const actor = staff[0], mate = staff[1], mate2 = staff[2];

/* 员工端默认德语（B62）；这里按 testLang 切换，默认中文，另验英文、德文 */
run("var testLang='zh';globalThis.euLang=function(){return testLang;}");
/* 员工端数据：工作台已开放（demoWorkspaceAt） */
run('euSession.key="p23t2";euSession.step="materials";euSession.demo="";euSession.tab="tasks";euSession.task=null');
function writeData(patch) {
  const all = ctx.empRead(run('EU_KEY'), {});
  all.p23t2 = ctx.euBoundData({ employeeId: actor.id, name: actor.name, profile: { language: '中文' }, docs: {}, messages: [], hours: [], availability: [],
    demoWorkspaceAt: '2026-11-07T10:00:00.000Z', ...(patch || {}) });
  ctx.empWrite(run('EU_KEY'), all);
}
writeData();
const render = tab => { run(`euSession.tab=${JSON.stringify(tab)};euSession.task=null`); return ctx.euRender(); };

/* ---- R4：今日 / 排班 / 薪资 三个页签恢复，带期次小标签 ---- */
{
  assert.equal(run('euWorkspaceOpen(euData())'), true);
  for (const tab of ['home', 'schedule', 'hours']) {
    const html = render(tab);
    assert.ok(!html.includes('即将开放') && !html.includes('eu-coming-soon'), `${tab} 不再是占位页`);
    assert.ok(!/undefined|NaN/.test(html), `${tab} 渲染出现 undefined / NaN`);
    assert.ok(html.includes('data-tab="tasks"') && html.includes('data-tab="docs"'), '一期任务/资料页签仍在');
  }
  const home = render('home');
  assert.ok(home.includes('eu-phase-tag">二期') && home.includes('eu-punch') && home.includes('今日班次'), '今日：二期标签 + 打卡');
  const sch = render('schedule');
  assert.ok(sch.includes('eu-phase-tag">二期') && sch.includes('本周工作安排') && sch.includes('报可工作时间') && sch.includes('申请换班'), '排班：二期标签 + 班表 + 报班 + 换班');
  const hours = render('hours');
  assert.ok(hours.includes('eu-phase-tag">三期') && hours.includes('月度工时核对') && hours.includes('eu-travel-expenses'), '薪资：三期标签 + 工时 + 差旅');
  assert.ok(!sch.includes('eu-phase-tag" disabled') && !/class="[^"]*(is-disabled|greyed)/.test(hours), '期次标签不灰');
  /* 德文新文案 */
  run("testLang='de'");
  const de = render('schedule');
  assert.ok(de.includes('Schichttausch beantragen') && !de.includes('申请换班</summary>'), '换班入口有德文');
  run("testLang='en'");
  assert.ok(render('schedule').includes('Request a shift swap'), '换班入口有英文');
  assert.ok(render('home').includes('Phase 2') && render('hours').includes('Phase 3'), '期次标签有英文');
  run("testLang='zh'");
}

/* ---- R4 门槛：工作台没开放（审核/签回规则不变）时，三个页签进不去 ---- */
{
  const gate = JSON.parse(JSON.stringify(actor));
  Object.assign(gate, { id: 'p23t2-gate', name: 'Gate Test', status: 'invited',
    invite: { portalVersion: 2, onboardingFilesVersion: 1, state: 'approved', token: 'p23t2gate', submitted: {} } });
  ctx.empSaveStaff(gate);
  run('euSession.key="p23t2gate"');
  const all = ctx.empRead(run('EU_KEY'), {});
  all.p23t2gate = ctx.euBoundData({ employeeId: 'p23t2-gate', name: 'Gate Test', profile: { language: '中文' }, docs: {}, messages: [], hours: [], availability: [] });
  ctx.empWrite(run('EU_KEY'), all);
  assert.equal(run('euWorkspaceOpen(euData())'), false, '审核通过但没签回：工作台关闭');
  for (const tab of ['home', 'schedule', 'hours']) {
    run(`euSession.tab=${JSON.stringify(tab)}`);
    const html = ctx.euRender();
    assert.ok(html.includes('data-eu-onboarding-only') && !html.includes('eu-punch') && !html.includes('eu-nav') && !html.includes('eu-travel-expenses') && !html.includes('eu-phase-tag'), `${tab} 在工作台关闭时进不去`);
  }
  run('euSession.key="p23t2"');
}

/* ---- R5：HACCP 后续任务示例，放在人事待办和点钞之后 ---- */
{
  const tasks = render('tasks');
  const iTodo = tasks.indexOf('人事待办'), iCash = tasks.indexOf('闭店点钱与每日记账'), iHaccp = tasks.indexOf('填写冷藏温度检查表'), iTag = tasks.indexOf('后续任务示例');
  assert.ok(iTodo >= 0 && iCash > iTodo && iTag > iCash && iHaccp > iTag, '顺序：人事待办 → 点钞 → 后续任务示例(HACCP)');
  assert.ok(tasks.includes('HACCP'), '卡片标 HACCP');
  run(`euSession.tab="tasks";euSession.task=${JSON.stringify('haccp-2026-11-07')}`);
  const detail = ctx.euRender();
  assert.ok(detail.includes('name="temperature"') && detail.includes('value="abnormal"') && detail.includes('后续任务示例') && detail.includes('温度范围按本门店要求填写'), 'HACCP 填表表单');
  run('euSession.task=null');
  assert.ok(!render('home').includes('冷藏温度'), 'HACCP 示例不进今日待办');
  assert.ok(!render('schedule').includes('冷藏温度'), 'HACCP 示例不进排班页');
  const src = fs.readFileSync('employee-ui.js', 'utf8');
  assert.ok(src.includes("kind==='haccp'&&values.result==='abnormal'"), '异常必须写处理情况的校验接回');
}

/* ---- 9.9：差旅提交接到 payTravelSubmit，状态读 run.travelClaims ---- */
const MONTH = '2026-11';
const rec = { id: 'tr1', startDate: '2026-11-06', endDate: '2026-11-08', purpose: '跨店支援', origin: 'München', destination: 'Hamburg', amount: 86.5, receipts: ['zug.pdf'], status: 'draft' };
function storeRecords(list) { const all = ctx.empRead('kaispanEmployeeTravelExpensesV1', {}); all.p23t2 = list; ctx.empWrite('kaispanEmployeeTravelExpensesV1', all); }
{
  const d = () => ctx.euData();
  assert.equal(ctx.payGet(STORE, MONTH).state, 'open', '演示月份是开账状态');
  assert.match(ctx.euTravelSubmitRecord(d(), { ...rec, amount: 0 }), /差旅金额|金额/, '金额须 > 0');
  assert.match(ctx.euTravelSubmitRecord(d(), { ...rec, receipts: [] }), /票据/, '至少一张票据');
  assert.equal(ctx.payTravelClaim(ctx.payGet(STORE, MONTH), actor.id)?.recordId, undefined, '被拒的提交不留痕');
  const mine = { ...rec };
  assert.equal(ctx.euTravelSubmitRecord(d(), mine), '');
  assert.equal(mine.status, 'submitted');
  const claim = ctx.payTravelClaim(ctx.payGet(STORE, MONTH), actor.id);
  assert.equal(claim.state, 'submitted'); assert.equal(claim.claimed, 86.5); assert.deepEqual([...claim.receipts], ['zug.pdf']);
  assert.equal(claim.city, 'Hamburg'); assert.equal(claim.startDate, '2026-11-06'); assert.equal(claim.recordId, 'tr1');
  assert.match(ctx.euTravelSubmitRecord(d(), { ...rec, id: 'tr2' }), /重复提交/, '待审时不能再交第二份');
  storeRecords([mine]);
  let hours = render('hours');
  assert.ok(hours.includes('待老板审核') && !hours.includes('店长审核'), '员工端写“老板审核”，不再写店长审核');
  /* 老板退回 → 显示理由，可以重提 */
  assert.equal(ctx.payTravelReview(STORE, MONTH, actor.id, 'returned', { note: '票据看不清' }).ok, true);
  hours = render('hours');
  assert.ok(hours.includes('老板退回：票据看不清') && hours.includes('eu-travel-send'), '退回显示理由和重新提交');
  assert.equal(ctx.euTravelSubmitRecord(d(), mine), '', '退回后可以重提');
  assert.equal(ctx.payTravelClaim(ctx.payGet(STORE, MONTH), actor.id).state, 'submitted');
  assert.equal(ctx.payTravelReview(STORE, MONTH, actor.id, 'approved', { amount: 80 }).ok, true);
  assert.ok(render('hours').includes('老板已批准 €80.00'), '批准后显示批准金额');
  assert.match(ctx.euTravelSubmitRecord(d(), { ...rec, id: 'tr3' }), /重复提交/, '已批准不能被覆盖');
}

/* ---- 8.4：出差打卡只认已提交的差旅申报 ---- */
{
  const d = () => ctx.euData();
  assert.equal(ctx.attTravelTrip(STORE, actor.id, '2026-11-07').city, 'Hamburg');
  assert.equal(ctx.attTravelTrip(STORE, actor.id, '2026-11-09'), null, '行程以外的日子不适用');
  assert.equal(ctx.attTripGeoJudge(STORE, actor.id, '2026-11-07', { city: 'hamburg' }).ok, true);
  assert.equal(ctx.attTripGeoJudge(STORE, actor.id, '2026-11-07', { city: 'Berlin' }).ok, false);
  assert.equal(ctx.attTripGeoJudge(STORE, actor.id, '2026-11-07', { lat: 53.55, lng: 9.99 }).ok, true, '坐标落在 Hamburg 附近也行');
  assert.equal(ctx.attTripGeoJudge(STORE, actor.id, '2026-11-07', {}).ok, null, '没给城市：判不了');
  assert.equal(ctx.attTripGeoJudge(STORE, actor.id, '2026-11-09', { city: 'Hamburg' }), null, '无申报返回 null → 调用方回到门店定位');
  const home = render('home');
  assert.ok(home.includes('今天出差：按差旅申报城市 Hamburg 核对定位') && home.includes('eu-punch-city'), '打卡卡片显示出差提示');

  const site = ctx.attSite(STORE);
  assert.ok(site, '演示门店有坐标');
  const hit = ctx.attPunch(STORE, actor.id, '2026-11-07', 'in', { pos: { city: 'Hamburg' }, src: 'self' });
  assert.equal(hit.ok, true, '该城市打卡被接受');
  assert.equal(hit.rec.in.geo.trip, true);
  const miss = ctx.attPunch(STORE, mate.id, '2026-11-07', 'in', { pos: { lat: site.lat, lng: site.lng }, src: 'self' });
  assert.equal(miss.ok, true, '没申报差旅的同事仍按门店定位');
  const far = ctx.attPunch(STORE, mate2.id, '2026-11-07', 'in', { pos: { lat: site.lat + 0.05, lng: site.lng }, src: 'self' });
  assert.equal(far.code, 'far', '没申报的人离店太远仍被拦');
  const wrong = ctx.attPunch(STORE, actor.id, '2026-11-07', 'out', { pos: { city: 'Berlin' }, src: 'self' });
  assert.equal(wrong.ok, false); assert.equal(wrong.code, 'wrongcity');
  assert.ok(ctx.attGeoCell(ctx.attAll().find(r => r.empId === actor.id && r.date === '2026-11-07')).includes('Hamburg'), '考勤页位置列显示出差城市');

  /* 员工端打卡按钮：用假 DOM 触发 euBind 里的 .eu-punch 处理 */
  const cityBox = b.fakeEl('.eu-punch-city'), feedback = b.fakeEl('.eu-punch-feedback'), button = b.fakeEl('.eu-punch');
  run('euSession.tab="home"'); run('euBind()');
  const click = b.handlers['.eu-punch'].click;
  click(); assert.ok(feedback.textContent.includes('请先填写当前所在城市') && !d().punch, '没填城市：不打卡');
  cityBox.value = 'Berlin'; click(); assert.ok(feedback.textContent.includes('应在 Hamburg') && !d().punch, '填错城市：不打卡');
  cityBox.value = 'Hamburg'; click(); assert.equal(d().punch?.city, 'Hamburg', '填对城市：打上卡');
  assert.ok(d().messages[0].includes('上班打卡成功'));

  /* 被老板退回的申报不再算许可；随手填的本机行程更不算 */
  assert.equal(ctx.payTravelReview(STORE, MONTH, actor.id, 'approved', { amount: 80 }).ok, false, '已批准的不能再审（前置确认）');
  const run2 = ctx.payGet(STORE, MONTH);
  run2.travelClaims[actor.id] = { ...run2.travelClaims[actor.id], state: 'returned', note: 'x' };
  ctx.paySave(run2);
  assert.equal(ctx.attTravelTrip(STORE, actor.id, '2026-11-07'), null, '退回的申报不算');
  storeRecords([{ ...rec, id: 'free', destination: 'Berlin', status: 'draft' }]);
  assert.equal(ctx.attTravelTrip(STORE, actor.id, '2026-11-07'), null, '本机随手填的行程不算');
  assert.ok(!render('home').includes('今天出差'), '没有有效申报：打卡卡片回到门店定位');
  const run3 = ctx.payGet(STORE, MONTH);
  run3.travelClaims[mate.id] = { claimed: 10, receipts: ['a.pdf'], state: 'submitted', approved: null, note: '', city: 'Berlin' };
  ctx.paySave(run3);
  assert.equal(ctx.attTravelTrip(STORE, mate.id, '2026-11-07'), null, '没有起止日期的申报不算');
}

/* ---- 8.28：换班最小演示 ---- */
{
  const week = ctx.schWeekOf('2026-11-10');
  const roster = ctx.schBlank(STORE, week);
  roster.shifts.push({ id: 's1', empId: actor.id, date: '2026-11-10', role: actor.role, start: '10:00', end: '18:00', src: 'manual' },
                     { id: 's2', empId: mate2.id, date: '2026-11-10', role: mate2.role, start: '12:00', end: '20:00', src: 'manual' });
  roster.state = 'published'; roster.rev = 1;
  ctx.schSaveRoster(roster);
  const shift = { id: 's1', date: '2026-11-10', start: '10:00', end: '18:00' };
  const owner = () => ctx.schRoster(STORE, week).shifts.find(x => x.id === 's1').empId;

  assert.deepEqual([...ctx.schSwapColleagues(STORE, actor.id, '2026-11-10').map(e => e.id)].includes(mate2.id), false, '那天已有班的同事不能接班');
  assert.equal(ctx.schSwapRequest(STORE, actor.id, shift, mate2.id).ok, false, '选了那天有班的同事：拒绝');
  assert.equal(ctx.schSwapRequest(STORE, actor.id, shift, actor.id).ok, false, '不能换给自己');
  assert.equal(ctx.schSwapRequest(STORE, actor.id, { ...shift, date: '2026-11-01' }, mate.id).ok, false, '过去的班不能换');
  const ask = ctx.schSwapRequest(STORE, actor.id, shift, mate.id, '家里有事');
  assert.equal(ask.ok, true);
  assert.equal(ctx.schSwapRequest(STORE, actor.id, shift, mate.id).ok, false, '同一个班不能重复申请');
  assert.equal(owner(), actor.id, '批准前班次仍是申请人的');
  assert.ok(ctx.schSwapCard(STORE).includes('sch-swap-approve') && ctx.schSwapCard(STORE).includes(actor.name), '老板/店长排班页出现待批换班卡');
  assert.ok(ctx.employeeSchedulePage().includes('sch-swap-card'), '排班页渲染了待批卡');
  assert.ok(render('schedule').includes('待店长批准'), '员工端显示待批状态');

  ctx.hrSetView('manager');
  assert.equal(ctx.schSwapDecide(ask.req.id, 'rejected', '').ok, false, '驳回要写理由');
  assert.equal(ctx.schSwapDecide(ask.req.id, 'rejected', '那天缺人').ok, true);
  assert.equal(owner(), actor.id, '驳回：班表不变');
  assert.equal(ctx.schSwapAll().find(r => r.id === ask.req.id).state, 'rejected');
  assert.ok(render('schedule').includes('被驳回：那天缺人'), '员工端看到驳回理由');

  const again = ctx.schSwapRequest(STORE, actor.id, shift, mate.id);
  assert.equal(again.ok, true, '被驳回后可以重新申请');
  assert.equal(ctx.schSwapDecide(again.req.id, 'approved').ok, true, '店长批准');
  assert.equal(owner(), mate.id, '批准：班表上换人');
  const after = ctx.schRoster(STORE, week);
  assert.equal(after.shifts.find(x => x.id === 's1').swappedFrom, actor.id);
  assert.equal(after.rev, 2); assert.equal(after.state, 'published', '换班不把整张班表退回草稿');
  assert.ok(after.log[0].what.zh.includes('换班'));
  assert.equal(ctx.schSwapDecide(again.req.id, 'approved').ok, false, '已处理的不能再批');
  assert.equal(ctx.schSwapOpen(STORE).length, 0);
  assert.ok(render('schedule').includes('已批准，班表已换人'), '员工端看到已批准');

  /* 演示班次：班表上没有排给他的班时，批准后在班表上给接班人加这个班 */
  const loner = JSON.parse(JSON.stringify(actor));
  Object.assign(loner, { id: 'p23t2-loner', name: 'Loner Test' });
  ctx.empSaveStaff(loner);
  assert.equal(ctx.schSwapShifts(STORE, loner.id, '2026-11-07', 14).length, 0, '这位员工班表上没有班');
  writeData({ employeeId: loner.id, name: loner.name });
  const { shifts, demo } = run('euSwapShifts(euData())');
  assert.equal(demo, true); assert.ok(shifts.length > 0 && shifts.every(s => s.id === ''));
  const day = shifts[0].date, dweek = ctx.schWeekOf(day);
  const dreq = ctx.schSwapRequest(STORE, loner.id, shifts[0], mate.id);
  assert.equal(dreq.ok, true); assert.equal(dreq.req.demo, true);
  assert.equal(ctx.schSwapDecide(dreq.req.id, 'approved').ok, true);
  assert.ok(ctx.schRoster(STORE, dweek).shifts.some(x => x.empId === mate.id && x.date === day && x.start === '10:00'), '演示班次批准后接班人有班');
  writeData();
  ctx.hrSetView('owner');
}

/* ---- 走查发现：未入职的演示员工提交差旅不进老板工资表，差旅区要明说，在职员工不显示 ---- */
{
  assert.ok(!render('hours').includes('eu-travel-demo-note'), '在职员工不显示演示提示');
  const demoGuy = JSON.parse(JSON.stringify(actor));
  Object.assign(demoGuy, { id: 'p23t2-uidemo', name: 'UI Demo', status: 'invited', uiDemo: true });
  ctx.empSaveStaff(demoGuy);
  writeData({ employeeId: demoGuy.id, name: demoGuy.name });
  assert.ok(render('hours').includes('eu-travel-demo-note'), '演示员工显示提示');
  writeData();
}

/* ---- 提交表单的假 DOM 冒烟：换班表单与差旅按钮的绑定函数能跑 ---- */
{
  assert.doesNotThrow(() => { run('euBindSwap()'); run('euBindTravelExpenses()'); });
  const src = fs.readFileSync('employee-ui.js', 'utf8');
  assert.ok(!/店长审核/.test(src.slice(src.indexOf('function euTravelExpenses'), src.indexOf('function euMonthlyHours'))), '差旅区块没有“店长审核”文案');
}
console.log('PASS: p23 tier2 employee side (R4 tabs/gate, R5 HACCP example, 9.9 travel submit, 8.28 swap, 8.4 trip punch)');
