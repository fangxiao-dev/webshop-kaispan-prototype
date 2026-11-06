/* 待办页（HR-TODO-01～65）。
   规则把这一页定成「事项类型清单」，真实待办页是 KaiSpan 现有待办页加一行「人事」
   （HR-TODO-12 / HR-TODO-55），所以这里画的是类型清单 + 分来源示意 + 当前演示档案的实例。 */

/* 一期 20 类（HR-TODO-20～39）。标题只写「员工姓名：事项类别」，不含证件号、日期、金额（HR-TODO-05）。 */
const HR_TODO_TYPE_LIST = [
 {code:'HR-TODO-20',key:'hr.document_attention',name:'证件需要处理',category:'材料',risk:'高',audience:'双方',target:'docs',open:'证件缺失、有效期待补充、已过期，或距到期进入提醒窗口（默认 30 天；居留许可 60 天，临时替代证明按居留许可算；健康证只提醒下次复训日，用词「复训到期」）。31–90 天的「需关注」不进待办',close:'证件替换并填好有效期后，规则层重新判定并自动关闭；该证件对这个人不适用时可关闭',to:'管理端一条；员工本人一条',mode:'业务事实自动关闭'},
 {code:'HR-TODO-21',key:'hr.profile_missing',name:'关键资料缺失',category:'材料',risk:'中',audience:'双方',target:'docs',open:'三层清单里审核通过后仍缺、且没有已批准暂缺的资料；在岗老员工确认后缺的同样算',close:'全部补齐',to:'管理端一条；员工本人一条',mode:'业务事实自动关闭'},
 {code:'HR-TODO-22',key:'hr.onboarding_review',name:'入职资料待审核',category:'入职',risk:'中',audience:'老板',target:'review',open:'员工提交入职资料',close:'审核通过或退回',to:'本店店长审核，老板可见',mode:'业务事实关闭'},
 {code:'HR-TODO-23',key:'hr.onboarding_returned',name:'入职资料已退回',category:'入职',risk:'中',audience:'员工',target:'review',open:'店长退回入职资料',close:'员工重新提交，或入职被取消',to:'员工本人',mode:'业务事实关闭'},
 {code:'HR-TODO-24',key:'hr.contract_prepare',name:'待发合同',category:'合同',risk:'中',audience:'老板',target:'contract',open:'资料审核通过（或公司代填确认）后合同未发；合同作废后重新打开。在岗老员工开通的档案不开',close:'合同发送，或线下签署归档',to:'管理端',mode:'业务事实关闭'},
 {code:'HR-TODO-25',key:'hr.contract_sign',name:'待员工签回合同',category:'合同',risk:'中',audience:'员工',target:'contract',open:'合同已发出；作废重发或退回后重新打开。线下签署归档不开此条',close:'员工两份签回件上传齐全',to:'员工本人',mode:'业务事实关闭'},
 {code:'HR-TODO-26',key:'hr.contract_archive',name:'待核对归档合同',category:'合同',risk:'中',audience:'老板',target:'contract',open:'员工两份签回件上传齐全',close:'核对归档完成，或合同被作废',to:'有查看敏感资料权限的店长或老板',mode:'业务事实关闭'},
 {code:'HR-TODO-27',key:'hr.newhire_pending',name:'新人上工前清单',category:'入职',risk:'中',audience:'老板',target:'docs',open:'入职状态已通过及之后，上工前清单未办完（在岗老员工开通的不开）；截止日是入职日期，当天仍未办完标逾期',close:'清单全部完成、录入离职或入职被取消',to:'管理端',mode:'业务事实自动关闭'},
 {code:'HR-TODO-28',key:'hr.update_request_pending',name:'补件待员工处理',category:'材料',risk:'中',audience:'员工',target:'docs',open:'店长推送补件，且员工有可用账号',close:'员工交回，或推送被撤销',to:'员工本人',mode:'业务事实关闭'},
 {code:'HR-TODO-29',key:'hr.update_request_review',name:'补件 / 资料更新待核对',category:'材料',risk:'中',audience:'老板',target:'docs',open:'员工交回补件，或入职后提交资料更新',close:'店长采纳（写入档案）或退回（必填原因）',to:'本店店长；改银行卡时老板同时知情',mode:'业务事实关闭'},
 {code:'HR-TODO-30',key:'hr.special_approval_pending',name:'特殊审批待批（暂缺某项材料）',category:'审批',risk:'中',audience:'老板',target:'review',open:'员工申请某项材料暂时交不了',close:'店长批准或驳回',to:'店长一条；老板一条知情条（审批结束后知情条自动关闭）',mode:'店长条业务事实关闭；知情条可「已阅」'},
 {code:'HR-TODO-31',key:'hr.special_approval_due',name:'特殊审批已到最晚补交日',category:'审批',risk:'高',audience:'双方',target:'review',open:'最晚补交日次日起该项仍缺（补交日当天仍有效）',close:'该项补齐',to:'店长、老板、员工本人',mode:'业务事实自动关闭，持续显示并标红'},
 {code:'HR-TODO-32',key:'hr.onboarding_stalled',name:'入职流程停滞',category:'入职',risk:'中',audience:'老板',target:'review',open:'邀请未提交、退回未重提、合同未签回、提交未审核，各自超过对应天数（默认各 3 天）',close:'流程状态前进，或邀请撤销 / 入职取消',to:'本店店长',mode:'业务事实自动关闭'},
 {code:'HR-TODO-33',key:'hr.probation_ending',name:'试用期即将结束',category:'合同',risk:'中',audience:'老板',target:'contract',open:'在试用期且距结束日 ≤ 30 天；待入职的人不触发',close:'结束日一过自动关闭，或结束日被改晚到提醒窗口之外、清空、录入离职',to:'管理端；要解约则办离职',mode:'日期推进自动关闭'},
 {code:'HR-TODO-34',key:'hr.fixed_term_ending',name:'定期合同即将到期 / 已到期',category:'合同',risk:'高',audience:'老板',target:'contract',open:'合同条件有定期合同到期日，且进入提醒窗口',close:'续签（改晚到期日）、转不定期（清空）或办离职',to:'管理端可见，处理由老板确认',mode:'业务事实关闭，到期不自动消失'},
 {code:'HR-TODO-35',key:'hr.offboarding_handover',name:'离职交接',category:'离职',risk:'中',audience:'老板',target:'contract',open:'录入离职时（含补录过去的最后工作日）',close:'四项清单全勾完：归还钥匙设备、核对最后工时、确认最后工资、开具离职证明',to:'管理端；老板确认离职，本店店长办理清单',mode:'逐项勾选，全部完成才算办完'},
 {code:'HR-TODO-36',key:'hr.manual_account_handling',name:'请手工处理该账号',category:'账号',risk:'高',audience:'老板',target:'docs',open:'到期关账号时该成员是老板或管理员，或平台返回受保护成员、最后一个管理员',close:'平台状态变为停用，下一轮同步后改记「已手工停用」',to:'老板',mode:'来源同步关闭'},
 {code:'HR-TODO-37',key:'hr.account_link_confirm',name:'请确认员工档案关联',category:'账号',risk:'中',audience:'员工',target:'docs',open:'老板为已有成员账号发起档案关联',close:'本人确认，或关联被撤销',to:'被关联的本人',mode:'业务事实关闭'},
 {code:'HR-TODO-38',key:'hr.retention_due',name:'保存期到期，请确认清理',category:'保存期',risk:'中',audience:'老板',target:'docs',open:'离职员工的某类资料保存期已到',close:'老板点「已处理」（记录处理人和时间）',to:'老板',mode:'业务事实关闭；一期不真的删除'},
 {code:'HR-TODO-39',key:'hr.manager_change_confirm',name:'请确认店长提交的变更',category:'变更',risk:'中',audience:'老板',target:'contract',open:'店长提交薪资、合同条件变更或离职办理',close:'老板确认（写入合同版本或离职记录）或驳回',to:'老板',mode:'业务事实关闭'}
];

/* 二、三期或后续阶段的事项：本页只做灰行示意，不当作一期内容（HR-TODO-61 ★7.x）。 */
const HR_TODO_LATER_LIST = [
 {module:'排班',items:'新班表已发布、班次时间变更、提交下周可工作时间',why:'排班管理二期开放，现在归排班模块自己的提醒'},
 {module:'考勤',items:'漏打卡 / 打卡异常、补交工时等待审核',why:'打卡与考勤二、三期开放'},
 {module:'工时',items:'本月工时需要确认、员工对工时提出异议、工时账户存取建议',why:'工时结算二、三期开放'},
 {module:'休假',items:'年假申请等待审批、休假结果与病假材料待补',why:'休假二、三期开放'},
 {module:'薪资',items:'工资资料待移交、等待税务师工资单、工资单金额不匹配、工资单已可查看、待发薪',why:'工资单与发薪二、三期开放'},
 {module:'HACCP',items:'HACCP 表格待填写、温度与清洁检查',why:'由 HACCP 模块自己的待办承载（HR-TODO-64）'}
];

function hrTodoHref(target,audience,id){
 if(audience==='employee')return '#employee-ui'+(id?'?preview='+encodeURIComponent(id):'');
 if(target==='review')return id?'#'+slug('employee','邀请详情')+'?id='+encodeURIComponent(id):'#'+slug('employee','入职邀请');
 if(id)return `#${slug("employee","员工资料")}?id=${encodeURIComponent(id)}&tab=${target==='contract'?'contract':'docs'}`;
 return '#'+slug('employee','员工档案');
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
 const live=[...hrContractTodoItems(scope).filter(visible),...hrTodoLiveItems(scope).filter(visible),...hrTodoStallItems(scope).filter(visible)];
 const liveRow=x=>`<tr><td><span class="pill ${x.risk==='高'?'red':x.risk==='中'?'orange':'blue'}">${empEsc(x.category)}</span></td><td><strong>${empEsc(x.title)}</strong><small>${empEsc(x.trigger)}</small></td><td><span class="pill ${x.audience==='双方'?'purple':'gray'}">${x.audience==='双方'?'员工 + 老板':x.audience+'端'}</span></td><td>${empEsc(audience==='owner'?x.owner:x.employee)}</td><td><a class="ghost-btn" href="${hrTodoHref(x.target,audience,x.id)}">查看档案 →</a></td></tr>`;
 const categories=['全部','材料','合同','入职','审批','离职','账号','保存期','变更'];
 return `<div class="page-head"><div><h1>待办事项</h1><p>人事待办的事项类型清单 · 用来核对一期规则是否齐全，不当作真实待办页使用。</p></div><span class="pill purple">本机演示</span></div>
 <div class="hr-todo-audience"><a class="${audience==='employee'?'active':''}" href="#todos?view=employee">员工端 <small>我只看到与本人有关的条目</small></a><a class="${audience==='owner'?'active':''}" href="#todos?view=owner">老板端 <small>审核、跟进与确认</small></a></div>
 <p class="hr-todo-context">${audience==='employee'?'员工端视角：员工本人只会看到派给自己的条目，入口在员工端「任务」页签。':'老板端视角：管理端条目按门店和档案权限可见，老板另有确认和清理类条目。'} 这一页是事项类型清单（HR-TODO-55），真实待办页是 KaiSpan 现有待办页加一行「人事」（HR-TODO-12）。</p>
 <div class="toolbar">${categories.map(c=>`<a class="filter ${c===category?'active':''}" href="#todos?view=${audience}&kind=${encodeURIComponent(c)}">${c}</a>`).join('')}</div>

 <section class="card"><div class="section-title"><div><h2>一期事项类型（HR-TODO-20～39）</h2><p>标题只写「员工姓名：事项类别」，证件号、日期、金额和缺项明细都在 HR 页面查看（HR-TODO-05）。</p></div><span class="pill blue">${types.length} / 20 类</span></div>
 <div class="hr-todo-scroll"><table class="table hr-todo-table hr-todo-type-table"><thead><tr><th>编号</th><th>事项类别</th><th>标题写法</th><th>何时开</th><th>何时关</th><th>给谁 / 关闭方式</th></tr></thead><tbody>${types.map(hrTodoTypeRow).join('')||'<tr><td colspan="6">该视角下没有这一类的事项。</td></tr>'}</tbody></table></div></section>

 <section class="card" style="margin-top:16px"><div class="section-title"><div><h2>真实待办页的样子：按来源分行</h2><p>KaiSpan 现有待办页加一行「人事」。员工本人的条目也在「人事」这一行，由 HR 接口校验是不是本人（HR-TODO-06 / HR-TODO-12）。</p></div><span class="pill blue">静态示意</span></div>
 <div class="hr-todo-scroll"><table class="table hr-todo-table"><thead><tr><th>来源</th><th>待办条目</th><th>通知对象</th><th>处理入口</th></tr></thead><tbody>
  <tr><td rowspan="2"><span class="pill purple">人事</span></td><td><strong>Liam：证件需要处理</strong><small>管理端的一条，按员工档案权限可见</small></td><td><span class="pill gray">店长 / 老板</span></td><td>员工助手 · 员工资料</td></tr>
  <tr><td><strong>Liam：证件需要处理</strong><small>员工本人的一条，指派给本人</small></td><td><span class="pill gray">员工端</span></td><td>员工端 · 任务</td></tr>
  <tr><td><span class="pill blue">财务</span></td><td><strong>点钱与记账委派</strong><small>一期员工端任务只含人事和点钞（HR-TODO-61）</small></td><td><span class="pill gray">员工端</span></td><td>员工端 · 任务</td></tr>
  <tr><td><span class="pill blue">仓储</span></td><td><strong>点货、损耗记录</strong><small>由仓库管理助手自己的待办承载</small></td><td><span class="pill gray">仓库 / 店长</span></td><td>仓库管理助手</td></tr>
  <tr class="is-muted"><td><span class="pill gray">排班</span></td><td><strong>班表发布、漏打卡</strong><small>二、三期开放，不在本期范围</small></td><td><span class="pill gray">后续</span></td><td>—</td></tr>
 </tbody></table></div></section>

 <section class="card" style="margin-top:16px"><div class="section-title"><div><h2>按当前演示档案生成的待办</h2><p>只有这一块读本机档案；上方是类型清单和版式示意。</p></div><span class="pill blue">${live.length} 条</span></div>
 <div class="hr-todo-scroll"><table class="table hr-todo-table"><thead><tr><th>分类</th><th>事项 / 触发点</th><th>通知对象</th><th>${audience==='owner'?'老板下一步做什么':'员工下一步做什么'}</th><th>操作</th></tr></thead><tbody>${live.map(liveRow).join('')||'<tr><td colspan="5">当前门店没有这一类的待办。</td></tr>'}</tbody></table></div></section>

 <details class="card hr-todo-live" style="margin-top:16px"><summary>二、三期或后续阶段的事项 <span class="pill gray">不进一期</span>${typeof hrBossMark==='function'?hrBossMark('7.x'):''}<small>${HR_TODO_LATER_LIST.length} 个模块</small></summary>
 <p class="small">一期员工助手的待办和员工端任务只有人事类事项和点钞记账委派；HACCP、清洁检查、开收店清单放到后续阶段（HR-TODO-61 ★7.x）。</p>
 <div class="hr-todo-scroll"><table class="table hr-todo-table hr-todo-later-table"><thead><tr><th>模块</th><th>示例事项</th><th>为什么不在本期</th></tr></thead><tbody>${HR_TODO_LATER_LIST.map(x=>`<tr class="is-muted"><td><strong>${x.module}</strong><small><span class="pill gray">二、三期或后续</span></small></td><td>${x.items}</td><td>${x.why}</td></tr>`).join('')}</tbody></table></div></details>
 <p class="small" style="margin-top:12px">“员工 + 老板”表示同一事项分别通知双方，各自看到相应的处理内容。当前仅展示本地提醒与示例，不实际发送通知或执行审批。</p>`;
}

function hrTodoStallItems(scope){
 if(typeof empOnboardingStalls!=='function')return [];
 return empOnboardingStalls(scope,empToday()).map(x=>({id:x.id,category:'入职',title:x.name+'：入职流程停滞',trigger:'入职流程超过设定天数没有前进，详情在邀请页查看',employee:'',owner:'打开邀请详情，催员工、退回重提或继续审核。',audience:'老板',risk:'中',target:'review',example:false}));
}

function hrContractTodoItems(scope){return empRoster().filter(e=>!scope||e.store===scope).flatMap(e=>{const inv=e.invite;if(!inv||(!inv.portalVersion&&!e.employeePortal?.submittedAt&&!inv.contractSentAt))return [];let item;
 if(inv.state==='submitted')item={category:'入职',label:'入职资料待审核',trigger:'员工已提交个人资料与证件',employee:'等待老板审核；如退回则补充资料。',owner:'审核员工入职资料，确认无误后制作劳动合同。',audience:'老板',target:'review'};
 else if(inv.state==='approved'&&!inv.contractSentAt)item={category:'合同',label:'待发合同',trigger:'资料审核完成，尚未向员工发送文件',employee:'等待老板发送入职文件。',owner:'生成并核对劳动合同和个人调查问卷，再发送给员工。',audience:'老板',target:'contract'};
 else if(inv.state==='approved'&&inv.contractSentAt&&!inv.contractSignedSubmittedAt)item={category:'合同',label:'待员工签回合同',trigger:'老板已发送劳动合同和个人调查问卷',employee:'下载两份文件，填写签字后上传并提交。',owner:'等待员工签署上传。',audience:'员工',target:'contract'};
 else if(inv.contractSignedSubmittedAt&&!inv.contractSignedReviewedAt)item={category:'合同',label:'待核对归档合同',trigger:'员工已提交签署版本',employee:'等待店长核对。',owner:'核对合同及个人调查问卷，确认归档后完成入职。',audience:'老板',target:'contract'};
 return item?[{...item,id:e.id,title:e.name+'：'+item.label,risk:'中',example:false}]:[];});}
