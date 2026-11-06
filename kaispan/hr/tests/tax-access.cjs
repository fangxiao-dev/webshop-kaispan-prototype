process.chdir(require('path').join(__dirname,'..'));
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const store={};
const ctx={
  console,
  empRead:(key,fallback)=>key in store?JSON.parse(JSON.stringify(store[key])):fallback,
  empWrite:(key,value)=>{store[key]=JSON.parse(JSON.stringify(value));},
  empT:(zh)=>zh,
  empEsc:value=>String(value==null?'':value),
  empBack:()=>'',
  hrActorLabel:()=>'老板',
  hrCan:()=>ctx.__can,
  hrDenyReason:()=>'只有老板和管理员可以操作（HR-LIFE-10 / HR-ORG-27 / HR-ACCESS-04）',
  app:()=>{}
};
ctx.__can=true;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('tax-access.js','utf8'),ctx);

let data=ctx.hrTaxState();
assert.equal(data.connections.length,2);
assert.equal(data.connections.filter(x=>x.status==='paused').length,1);
assert.equal(data.connections[0].employers[1].grant,null,'新雇主默认没有授权');

let html=ctx.employeeTaxAccessPage();
assert(html.includes('员工助手'));
assert(html.includes('税务师权限'));
assert(html.includes('已暂停'));
assert(html.includes('尚未打开'),'没有授权的雇主写「尚未打开」');
assert.equal(data.connections[0].employers.every(x=>!x.grant),true,'有效连接下所有雇主默认关闭');
assert(html.includes('个人问卷')&&html.includes('劳动合同')&&html.includes('在读证明'));
assert(html.includes('员工编号'));
assert(html.includes('即时申报已完成'));

ctx.hrTaxToggleGrant('conn-berger','catering');
data=ctx.hrTaxState();
assert.equal(data.connections[0].employers[1].grant.enabled,true);
assert(ctx.employeeTaxAccessPage().includes('打开人 老板'),'已授权的雇主显示打开人');
assert.equal(data.log[0].action,'on');
assert.equal(data.log[0].by,'老板');
assert.equal(data.log[0].employer,'Martin Biergarten Catering GmbH');
assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(data.log[0].at),'记录时间');
assert(ctx.employeeTaxAccessPage().includes('Martin Biergarten Catering GmbH'));

ctx.hrTaxToggleGrant('conn-berger','catering');
data=ctx.hrTaxState();
assert.equal(data.connections[0].employers[1].grant.enabled,false);
assert.equal(data.log[0].action,'off');
assert(ctx.employeeTaxAccessPage().includes('当前关闭'));

ctx.__can=false;
const before=JSON.stringify(ctx.hrTaxState());
ctx.hrTaxToggleGrant('conn-berger','catering');
assert.equal(JSON.stringify(ctx.hrTaxState()),before,'店长不能改授权');
html=ctx.employeeTaxAccessPage();
assert(html.includes('当前是店长视角'));
assert(html.includes('disabled'));
assert(html.includes('只有老板和管理员可以操作'));

ctx.hrTaxToggleDemo();
html=ctx.employeeTaxAccessPage();
assert(html.includes('尚未连接税务师'));
assert(html.includes('模拟：有连接'));
ctx.hrTaxToggleDemo();
assert(ctx.employeeTaxAccessPage().includes('Kanzlei Berger & Partner mbB'));

console.log('PASS: tax connections seed (active+paused), grant defaults off, owner-only toggle with audit log, manager read-only, empty-state demo');
