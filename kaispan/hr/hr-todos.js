/* 待办页（HR-TODO-01～65）。
   规则把这一页定成「事项类型清单」，真实待办页是 KaiSpan 现有待办页加一行「人事」
   （HR-TODO-12 / HR-TODO-55），所以这里画的是类型清单 + 分来源示意 + 当前演示档案的实例。 */

/* 一期 18 类（HR-TODO-20～39，31、35 已按答复取消）。标题只写「员工姓名：事项类别」，不含证件号、日期、金额（HR-TODO-05）。 */
const HR_TODO_TYPE_LIST = [
 {code:'HR-TODO-20',key:'hr.document_attention',name:'证件需要处理',category:'材料',risk:'高',audience:'双方',target:'docs',open:'证件缺失、有效期待补充、已过期，或距到期进入提醒窗口（默认 30 天；居留许可 60 天，健康证只提醒下次复训日，用词「复训到期」）。31–90 天的「需关注」不进待办',close:'证件替换并填好有效期后，规则层重新判定并自动关闭；该证件对这个人不适用时可关闭',to:'管理端一条；员工本人一条',mode:'业务事实自动关闭'},
 {code:'HR-TODO-21',key:'hr.profile_missing',name:'关键资料缺失',category:'材料',risk:'中',audience:'双方',target:'docs',open:'三层清单里审核通过后仍缺、的资料；在岗老员工确认后缺的同样算',close:'全部补齐',to:'管理端一条；员工本人一条',mode:'业务事实自动关闭'},
 {code:'HR-TODO-22',key:'hr.onboarding_review',name:'入职资料待审核',category:'入职',risk:'中',audience:'老板',target:'review',open:'员工提交入职资料',close:'审核通过或退回',to:'本店店长审核，老板可见',mode:'业务事实关闭'},
 {code:'HR-TODO-23',key:'hr.onboarding_returned',name:'入职资料已退回',category:'入职',risk:'中',audience:'员工',target:'review',open:'店长退回入职资料',close:'员工重新提交，或入职被取消',to:'员工本人',mode:'业务事实关闭'},
 {code:'HR-TODO-24',key:'hr.contract_prepare',name:'待发合同',category:'合同',risk:'中',audience:'老板',target:'contract',open:'资料审核通过（或公司代填确认）后合同未发；合同作废后重新打开。在岗老员工开通的档案不开',close:'合同发送，或线下签署归档',to:'管理端',mode:'业务事实关闭'},
 {code:'HR-TODO-25',key:'hr.contract_sign',name:'待员工签回合同',category:'合同',risk:'中',audience:'员工',target:'contract',open:'合同已发出；作废重发或退回后重新打开。线下签署归档不开此条',close:'员工两份签回件上传齐全',to:'员工本人',mode:'业务事实关闭'},
 {code:'HR-TODO-26',key:'hr.contract_archive',name:'待核对归档合同',category:'合同',risk:'中',audience:'老板',target:'contract',open:'员工两份签回件上传齐全',close:'核对归档完成，或合同被作废',to:'有查看敏感资料权限的店长或老板',mode:'业务事实关闭'},
 {code:'HR-TODO-27',key:'hr.newhire_pending',name:'新人上工前清单',category:'入职',risk:'中',audience:'老板',target:'docs',open:'入职状态已通过及之后，上工前清单未办完（在岗老员工开通的不开）；截止日是入职日期，当天仍未办完标逾期',close:'清单全部完成、录入离职或入职被取消',to:'管理端',mode:'业务事实自动关闭'},
 {code:'HR-TODO-28',key:'hr.update_request_pending',name:'补件待员工处理',category:'材料',risk:'中',audience:'员工',target:'docs',open:'店长推送补件，且员工有可用账号',close:'员工交回，或推送被撤销',to:'员工本人',mode:'业务事实关闭'},
 {code:'HR-TODO-29',key:'hr.update_request_review',name:'补件 / 资料更新待核对',category:'材料',risk:'中',audience:'老板',target:'docs',open:'员工交回补件，或入职后提交资料更新',close:'店长采纳（写入档案）或退回（必填原因）',to:'本店店长；改银行卡时老板同时知情',mode:'业务事实关闭'},
 {code:'HR-TODO-32',key:'hr.onboarding_stalled',name:'入职流程停滞',category:'入职',risk:'中',audience:'老板',target:'review',open:'邀请未提交、退回未重提、合同未签回、提交未审核，各自超过对应天数（默认各 3 天）',close:'流程状态前进，或邀请撤销 / 入职取消',to:'本店店长',mode:'业务事实自动关闭'},
 {code:'HR-TODO-33',key:'hr.probation_ending',name:'试用期即将结束',category:'合同',risk:'中',audience:'老板',target:'contract',open:'在试用期且距结束日 ≤ 30 天；待入职的人不触发',close:'结束日一过自动关闭，或结束日被改晚到提醒窗口之外、清空、录入离职',to:'管理端；要解约则办离职',mode:'日期推进自动关闭'},
 {code:'HR-TODO-34',key:'hr.fixed_term_ending',name:'定期合同即将到期 / 已到期',category:'合同',risk:'高',audience:'老板',target:'contract',open:'合同条件有定期合同到期日，且进入提醒窗口',close:'续签（改晚到期日）、转不定期（清空）或办离职',to:'管理端可见，处理由老板确认',mode:'业务事实关闭，到期不自动消失'},
 {code:'HR-TODO-36',key:'hr.manual_account_handling',name:'请手工处理该账号',category:'账号',risk:'高',audience:'老板',target:'docs',open:'到期关账号时该成员是老板或管理员，或平台返回受保护成员、最后一个管理员',close:'平台状态变为停用，下一轮同步后改记「已手工停用」',to:'老板',mode:'来源同步关闭'},
 {code:'HR-TODO-37',key:'hr.account_link_confirm',name:'请确认员工档案关联',category:'账号',risk:'中',audience:'员工',target:'docs',open:'老板为已有成员账号发起档案关联',close:'本人确认，或关联被撤销',to:'被关联的本人',mode:'业务事实关闭'},
 {code:'HR-TODO-38',key:'hr.retention_due',name:'保存期到期，请确认清理',category:'保存期',risk:'中',audience:'老板',target:'docs',open:'离职员工的某类资料保存期已到',close:'老板点「已处理」（记录处理人和时间）',to:'老板',mode:'业务事实关闭；一期不真的删除'},
 {code:'HR-TODO-39',key:'hr.manager_change_confirm',name:'请确认店长提交的变更',category:'变更',risk:'中',audience:'老板',target:'contract',open:'店长提交薪资、合同条件变更或离职办理',close:'老板确认（写入合同版本或离职记录）或驳回',to:'老板',mode:'业务事实关闭'}
];

/* HR-TODO-30（特殊审批待批）已取消：特殊审批不另建待办（AM-05）。第二层材料没交齐时，老板在同一次审核通过 / 公司代填确认 / 在岗老员工确认上勾选特殊审批并写原因，留审批人、时间和缺项名单。
   所以类型清单里没有这一行，也没有独立的“特殊审批”待办。 */

/* 二、三期或后续阶段的事项：恢复为老板原版的逐项事项和处理入口，正常展示、不灰；每行带期次标签。
   一期范围以规格和修订为准（HR-TODO-61 ★7.x）。列：分类 / 事项 / 何时提醒 / 员工做什么 / 老板做什么 / 通知对象 / 风险 / 入口 / 期次 */
const HR_TODO_LATER_ROWS = [
['排班','新班表已发布','店长发布下一周班表','查看自己的班次与门店安排','查看发布结果；仅在有冲突时跟进','员工','低','schedule','二期'],
['排班','班次时间发生变更','已发布班次被调整','核对新时间，及时联系店长反馈冲突','查看调整记录与员工反馈','双方','中','schedule','二期'],
['排班','提交下周可工作时间','到达门店设定的意向收集时间','提交可工作的日期和时段','汇总意向后安排班次','员工','中','schedule','二期'],
['考勤','漏打卡 / 打卡异常','有班次但缺上班或下班记录','补交时间与说明','核对排班与原始打卡，修正计薪记录','双方','高','hours','二期'],
['考勤','补交工时等待审核','员工手动提交或修改了一天的工时','查看处理结果，补充说明','审核提交的时段和休息时间，避免重复计入','老板','中','hours','二期'],
['工时','本月工时需要确认','员工本月最后一个工作日结束','核对排班、打卡、计薪规则和休假，回复确认或提出异议','查看员工确认状态；未回复时可催办','双方','中','pay','三期'],
['工时','员工对工时提出异议','员工回复“某一天的时间不对”','说明日期和正确时段，等待回复','查看沟通内容，核对并调整后重新请员工确认','双方','高','pay','三期'],
['工时','工时账户存取建议','本月工时高于或低于合同约定范围','查看本月计薪工时与账户余额','决定是否存入或取出；提交前可手动调整','老板','中','pay','三期'],
['休假','年假申请等待审批','员工提交休假日期','查看申请结果','结合排班审核申请，通过后计入工时日历','老板','中','leave','二期'],
['休假','休假结果 / 病假材料待补','休假已处理，或病假证明需要补交','查看审批结果，按要求补交病假材料','核对病假日期与记录，更新计薪工时','双方','中','leave','二期'],
['薪资','月度工资资料待移交','到达门店约定的月末核对节点','查看自己的工时确认消息','核对工时、奖金、差旅等，确认后移交税务师','老板','高','pay','三期'],
['薪资','等待税务师工资单','本月资料已移交，工资单尚未回传','等待工资单发布通知','跟进税务师上传，回传后识别 Brutto / Netto','老板','中','pay','三期'],
['薪资','工资单金额不匹配','回传 PDF 的 Brutto 与本月预期不一致','等待核对后的工资单','打开 PDF 比较金额，必要时提交修改','老板','高','pay','三期'],
['薪资','工资单已可查看','税务师回传后，老板选择发送工资单','查看本人当月工资单','查看发送记录，处理发送失败或缺失文件','员工','低','pay','三期'],
['薪资','待发薪 / 修改待跟进','工资单已回传但未标记打款，或更正尚未回传','查看工资单及打款状态','选择员工生成 SEPA XML，跟进更正与打款状态','老板','高','pay','三期'],
['委派','HACCP 表格待填写','当班员工被委派温度或清洁检查','按任务要求填表，提交异常说明','查看任务结果并跟进异常','员工','中','tasks','后续']
].map((x,i)=>({id:'later-'+i,category:x[0],title:x[1],trigger:x[2],employee:x[3],owner:x[4],audience:x[5],risk:x[6],target:x[7],phase:x[8]}));

function hrTodoHref(target,audience,id){
 if(audience==='employee')return '#employee-ui'+(id?'?preview='+encodeURIComponent(id):'');
 if(target==='review')return id?'#'+slug('employee','邀请详情')+'?id='+encodeURIComponent(id):'#'+slug('employee','入职邀请');
 if(target==='docs'||target==='contract')return id?`#${slug("employee","员工资料")}?id=${encodeURIComponent(id)}&tab=${target==='contract'?'contract':'docs'}`:'#'+slug('employee','员工档案');
 return '#'+slug('employee',({schedule:'排班管理',hours:'排班管理',pay:'工资单与发薪',leave:'排班管理',tasks:'员工档案'})[target]||'员工档案');
}

/* 当前演示档案里的真实提醒，映射到上面的事项类型；标题仍只写「姓名：类别」。 */
const HR_TODO_ALERT_TYPES={
 doc:['证件需要处理','材料','docs'],
 profile:['关键资料缺失','材料','docs'],
 probation:['试用期即将结束','合同','contract'],
 befristet:['定期合同即将到期','合同','contract'],
 newhire:['新人上工前清单','入职','docs']
};

function hrTodoLiveItems(scope){
 return empRoster().filter(e=>!scope||e.store===scope).flatMap(e=>empAlertsFor(e,empToday())
  .filter(a=>!(a.kind==='doc'&&a.type?.id==='contract'&&!e.invite?.contractSentAt))
  .map(a=>{
   const meta=HR_TODO_ALERT_TYPES[a.kind]||['人事事项','材料','docs'];
   const detail=a.kind==='doc'
    ? `${empRaw(a.type.name)} · ${a.level==='expired'?'证件已过期':a.days===0?'今天到期':a.level==='missing'?'材料尚未上传':a.level==='date_missing'?'已记录材料，有效期待补充':'证件进入到期提醒窗口'}`
    : a.kind==='profile'?'关键资料还没补齐，具体缺项在员工资料里看'
    : a.kind==='newhire'?'上工前清单还没办完'
    : '合同日期进入提醒窗口';
   const hygiene=a.type?.id==='belehrung';
   return {
    id:e.id,category:meta[1],title:e.name+'：'+meta[0],trigger:detail,
    employee:hygiene?'查看健康证截止日期，联系店长安排继续培训；完成后上传新证明与截止日期。':'查看本人资料，补交材料或联系店长。',
    owner:hygiene?'同时通知员工，安排继续培训，核对新证明及截止日期并跟进完成。':'核对本人档案，跟进缺项或到期安排。',
    audience:a.kind==='doc'||a.kind==='profile'?'双方':'老板',
    risk:a.level==='expired'||a.level==='missing'?'高':'中',
    target:meta[2]
   };
  }));
}

function hrTodoTypeRow(x){
 const who=x.audience==='双方'?'员工 + 老板':x.audience+'端';
 return `<tr>
  <td><span class="hr-todo-code">${x.code}</span></td>
  <td><span class="pill ${x.risk==='高'?'red':x.risk==='中'?'orange':'blue'}">${empEsc(x.category)}</span><strong>${empEsc(x.name)}</strong><small>${empEsc(x.key)}</small></td>
  <td>${empEsc('Liam：'+x.name)}</td>
  <td>${empEsc(x.open)}</td>
  <td>${empEsc(x.close)}</td>
  <td>${empEsc(x.to)}<small>${who} · ${empEsc(x.mode)}</small></td>
 </tr>`;
}

function hrTodosPage(){
 const audience=state().params.get('view')==='owner'?'owner':'employee',category=state().params.get('kind')||'全部',scope=empScope();
 const isAll=category==='全部';
 const visible=x=>(isAll||x.category===category)&&(audience==='owner'||x.audience==='双方'||x.audience==='员工');
 const types=HR_TODO_TYPE_LIST.filter(visible);
 const live=hrTodoEntryItems(scope).filter(visible);
 const liveRow=x=>`<tr><td><span class="pill ${x.risk==='高'?'red':x.risk==='中'?'orange':'blue'}">${empEsc(x.category)}</span></td><td><strong>${empEsc(x.title)}</strong><small>${empEsc(x.trigger)}</small></td><td><span class="pill ${x.audience==='双方'?'purple':'gray'}">${x.audience==='双方'?'员工 + 老板':x.audience+'端'}</span></td><td>${empEsc(audience==='owner'?x.owner:x.employee)}</td><td><a class="ghost-btn" href="${hrTodoHref(x.target,audience,x.id)}">查看档案 →</a></td></tr>`;
 const categories=['全部','材料','合同','入职','审批','离职','账号','保存期','变更','排班','考勤','工时','休假','薪资','委派'];
 const later=HR_TODO_LATER_ROWS.filter(x=>(x.audience==='双方'||x.audience===(audience==='owner'?'老板':'员工'))&&(isAll||x.category===category));
 const phaseTone=p=>p==='三期'?'orange':p==='后续'?'blue':'purple';
 const laterRow=x=>`<tr><td><span class="pill ${x.risk==='高'?'red':x.risk==='中'?'orange':'blue'}">${empEsc(x.category)}</span><span class="pill ${phaseTone(x.phase)} hr-todo-phase">${x.phase}</span></td><td><strong>${empEsc(x.title)}</strong><small>流程示例 · ${empEsc(x.trigger)}</small></td><td><span class="pill ${x.audience==='双方'?'purple':'gray'}">${x.audience==='双方'?'员工 + 老板':x.audience+'端'}</span></td><td>${empEsc(audience==='owner'?x.owner:x.employee)}</td><td><a class="ghost-btn" href="${hrTodoHref(x.target,audience,null)}">查看入口 →</a></td></tr>`;
 return `<div class="page-head"><div><h1>待办事项</h1><p>人事待办的事项类型清单 · 用来核对一期规则是否齐全，不当作真实待办页使用。</p></div><span class="pill purple">本机演示</span></div>
 <div class="hr-todo-audience"><a class="${audience==='employee'?'active':''}" href="#todos?view=employee">员工端 <small>我只看到与本人有关的条目</small></a><a class="${audience==='owner'?'active':''}" href="#todos?view=owner">老板端 <small>审核、跟进与确认</small></a></div>
 <p class="hr-todo-context">${audience==='employee'?'员工端视角：员工本人只会看到派给自己的条目，入口在员工端「任务」页签。':'老板端视角：管理端条目按门店和档案权限可见，老板另有确认和清理类条目。'} 这一页是事项类型清单（HR-TODO-55），真实待办页是 KaiSpan 现有待办页加一行「人事」（HR-TODO-12）。</p>
 <div class="toolbar">${categories.map(c=>`<a class="filter ${c===category?'active':''}" href="#todos?view=${audience}&kind=${encodeURIComponent(c)}">${c}</a>`).join('')}</div>

 <section class="card"><div class="section-title"><div><h2>一期事项类型（HR-TODO-20～39；30 特殊审批待批、31 暂缺逾期、35 离职交接已取消）</h2><p>标题只写「员工姓名：事项类别」，证件号、日期、金额和缺项明细都在 HR 页面查看（HR-TODO-05）。</p></div><span class="pill blue">${types.length} / ${HR_TODO_TYPE_LIST.length} 类</span></div>
 <div class="hr-todo-scroll"><table class="table hr-todo-table hr-todo-type-table"><thead><tr><th>编号</th><th>事项类别</th><th>标题写法</th><th>何时开</th><th>何时关</th><th>给谁 / 关闭方式</th></tr></thead><tbody>${types.map(hrTodoTypeRow).join('')||'<tr><td colspan="6">该视角下没有这一类的事项。</td></tr>'}</tbody></table></div></section>

 <section class="card" style="margin-top:16px"><div class="section-title"><div><h2>真实待办页的样子：按来源分行</h2><p>KaiSpan 现有待办页加一行「人事」。员工本人的条目也在「人事」这一行，由 HR 接口校验是不是本人（HR-TODO-06 / HR-TODO-12）。</p></div><span class="pill blue">静态示意</span></div>
 <div class="hr-todo-scroll"><table class="table hr-todo-table"><thead><tr><th>来源</th><th>待办条目</th><th>通知对象</th><th>处理入口</th></tr></thead><tbody>
  <tr><td rowspan="2"><span class="pill purple">人事</span></td><td><strong>Liam：证件需要处理</strong><small>管理端的一条，按员工档案权限可见</small></td><td><span class="pill gray">店长 / 老板</span></td><td>员工助手 · 员工资料</td></tr>
  <tr><td><strong>Liam：证件需要处理</strong><small>员工本人的一条，指派给本人</small></td><td><span class="pill gray">员工端</span></td><td>员工端 · 任务</td></tr>
  <tr><td><span class="pill blue">财务</span></td><td><strong>点钱与记账委派</strong><small>一期员工端任务只含人事和点钞（HR-TODO-61）</small></td><td><span class="pill gray">员工端</span></td><td>员工端 · 任务</td></tr>
  <tr><td><span class="pill blue">仓储</span></td><td><strong>点货、损耗记录</strong><small>由仓库管理助手自己的待办承载</small></td><td><span class="pill gray">仓库 / 店长</span></td><td>仓库管理助手</td></tr>
  <tr><td><span class="pill purple">排班</span><span class="pill purple hr-todo-phase">二期</span></td><td><strong>班表发布、漏打卡</strong><small>二、三期事项，见下方逐项清单</small></td><td><span class="pill gray">员工 + 老板</span></td><td>排班管理</td></tr>
 </tbody></table></div></section>

 <section class="card" style="margin-top:16px"><div class="section-title"><div><h2>按当前演示档案生成的待办</h2><p>只有这一块读本机档案；上方是类型清单和版式示意。</p></div><span class="pill blue">${live.length} 条</span></div>
 <div class="hr-todo-scroll"><table class="table hr-todo-table"><thead><tr><th>分类</th><th>事项 / 触发点</th><th>通知对象</th><th>${audience==='owner'?'老板下一步做什么':'员工下一步做什么'}</th><th>操作</th></tr></thead><tbody>${live.map(liveRow).join('')||'<tr><td colspan="5">当前门店没有这一类的待办。</td></tr>'}</tbody></table></div></section>

 <section class="card" style="margin-top:16px"><div class="section-title"><div><h2>二、三期事项（带期次标签）</h2><p>本原型包含各期功能，正式一期范围以规格和修订为准。一期员工助手的待办和员工端任务只有人事类事项和点钞记账委派；下面是老板原版里的排班、考勤、工时、休假、薪资和 HACCP 事项，仅作流程示例，不实际发送通知。</p></div><span class="pill purple">${later.length} 项</span></div>
 <div class="hr-todo-scroll"><table class="table hr-todo-table hr-todo-later-table"><thead><tr><th>分类 / 期次</th><th>事项 / 何时提醒</th><th>通知对象</th><th>${audience==='owner'?'老板下一步做什么':'员工下一步做什么'}</th><th>操作</th></tr></thead><tbody>${later.map(laterRow).join('')||'<tr><td colspan="5">该视角下没有这一类的二、三期事项。</td></tr>'}</tbody></table></div></section>
 <p class="small" style="margin-top:12px">“员工 + 老板”表示同一事项分别通知双方，各自看到相应的处理内容。当前仅展示本地提醒与示例，不实际发送通知或执行审批。</p>`;
}

function hrTodoEntryItems(scope){
 if(typeof empPendingEntries!=='function')return [];
 const types=new Map(HR_TODO_TYPE_LIST.map(t=>[t.code,t]));
 return empRoster().filter(e=>!scope||e.store===scope).flatMap(e=>empPendingEntries(e,empToday()).map(entry=>{
  const type=types.get('HR-TODO-'+entry.code);
  if(!type)return null;
  return {id:e.id,category:type.category,title:e.name+'：'+type.name+(entry.escalated?'（店长 2 个工作日未处理）':''),trigger:'详情在员工档案里查看',employee:'',owner:'打开员工档案处理“'+type.name+'”。',audience:type.audience,risk:type.risk,target:type.target,example:false};
 }).filter(Boolean));
}

function hrContractTodoItems(scope){return empRoster().filter(e=>!scope||e.store===scope).flatMap(e=>{const inv=e.invite;if(!inv||(!inv.portalVersion&&!e.employeePortal?.submittedAt&&!inv.contractSentAt))return [];let item;
 if(inv.state==='submitted')item={category:'入职',label:'入职资料待审核',trigger:'员工已提交个人资料与证件',employee:'等待老板审核；如退回则补充资料。',owner:'审核员工入职资料，确认无误后制作劳动合同。',audience:'老板',target:'review'};
 else if(inv.state==='approved'&&!inv.contractSentAt)item={category:'合同',label:'待发合同',trigger:'资料审核完成，尚未向员工发送文件',employee:'等待老板发送入职文件。',owner:'生成并核对劳动合同和个人调查问卷，再发送给员工。',audience:'老板',target:'contract'};
 else if(inv.state==='approved'&&inv.contractSentAt&&!inv.contractSignedSubmittedAt)item={category:'合同',label:'待员工签回合同',trigger:'老板已发送劳动合同和个人调查问卷',employee:'下载两份文件，填写签字后上传并提交。',owner:'等待员工签署上传。',audience:'员工',target:'contract'};
 else if(inv.contractSignedSubmittedAt&&!inv.contractSignedReviewedAt)item={category:'合同',label:'待核对归档合同',trigger:'员工已提交签署版本',employee:'等待店长核对。',owner:'核对合同及个人调查问卷，确认归档后完成入职。',audience:'老板',target:'contract'};
 return item?[{...item,id:e.id,title:e.name+'：'+item.label,risk:'中',example:false}]:[];});}
