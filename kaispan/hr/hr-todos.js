/* 人事通知场景：真实档案提醒和流程示例分别展示，不生成真实通知。 */
function hrTodoScenarios(){return [
 ['材料','签证即将到期 / 已到期','到期前进入提醒窗口，或证件已过期','补交有效签证并填写有效期','核对新证件，跟进员工；同步查看排班提示','双方','高','docs'],
 ['材料','入职材料尚未交齐','邀请已发出，个人资料或必交附件缺失','填写个人资料，上传所缺材料','查看缺项，联系员工补交','双方','中','docs'],
 ['材料','健康证到期，需继续培训','健康证截止日期进入提醒窗口或已到期','联系店长安排继续培训，完成后上传新证明和截止日期','收到同一提醒，安排培训并跟进新证明与日期','双方','高','docs'],
 ['材料','学生在读证明到期','学生身份已选，证明需要更新','上传新学期在读证明及有效期','核对材料并更新档案','双方','高','docs'],
 ['材料','新材料等待核对','员工替换了护照、医保或银行资料','查看提交进度，必要时补充说明','核对新文件与资料，保留旧版本','老板','中','docs'],
 ['材料','特殊审批申请','税号、社保号、医保或卫生证明暂缺，员工提交原因','查看审批进度与补交要求','店长审核原因、约定补交时间，同时提醒老板','双方','高','docs'],
 ['排班','新班表已发布','店长发布下一周班表','查看自己的班次与门店安排','查看发布结果；仅在有冲突时跟进','员工','低','schedule'],
 ['排班','班次时间发生变更','已发布班次被调整','核对新时间，及时联系店长反馈冲突','查看调整记录与员工反馈','双方','中','schedule'],
 ['排班','提交下周可工作时间','到达门店设定的意向收集时间','提交可工作的日期和时段','汇总意向后安排班次','员工','中','schedule'],
 ['考勤','漏打卡 / 打卡异常','有班次但缺上班或下班记录','补交时间与说明','核对排班与原始打卡，修正计薪记录','双方','高','hours'],
 ['考勤','补交工时等待审核','员工手动提交或修改了一天的工时','查看处理结果，补充说明','审核提交的时段和休息时间，避免重复计入','老板','中','hours'],
 ['工时','本月工时需要确认','员工本月最后一个工作日结束','核对排班、打卡、计薪规则和休假，回复确认或提出异议','查看员工确认状态；未回复时可催办','双方','中','pay'],
 ['工时','员工对工时提出异议','员工回复“某一天的时间不对”','说明日期和正确时段，等待回复','查看沟通内容，核对并调整后重新请员工确认','双方','高','pay'],
 ['工时','工时账户存取建议','本月工时高于或低于合同约定范围','查看本月计薪工时与账户余额','决定是否存入或取出；提交前可手动调整','老板','中','pay'],
 ['休假','年假申请等待审批','员工提交休假日期','查看申请结果','结合排班审核申请，通过后计入工时日历','老板','中','leave'],
 ['休假','休假结果 / 病假材料待补','休假已处理，或病假证明需要补交','查看审批结果，按要求补交病假材料','核对病假日期与记录，更新计薪工时','双方','中','leave'],
 ['薪资','月度工资资料待移交','到达门店约定的月末核对节点','查看自己的工时确认消息','核对工时、奖金、差旅等，确认后移交税务师','老板','高','pay'],
 ['薪资','等待税务师工资单','本月资料已移交，工资单尚未回传','等待工资单发布通知','跟进税务师上传，回传后识别 Brutto / Netto','老板','中','pay'],
 ['薪资','工资单金额不匹配','回传 PDF 的 Brutto 与本月预期不一致','等待核对后的工资单','打开 PDF 比较金额，必要时提交修改','老板','高','pay'],
 ['薪资','工资单已可查看','税务师回传后，老板选择发送工资单','查看本人当月工资单','查看发送记录，处理发送失败或缺失文件','员工','低','pay'],
 ['薪资','待发薪 / 修改待跟进','工资单已回传但未标记打款，或更正尚未回传','查看工资单及打款状态','选择员工生成 SEPA XML，跟进更正与打款状态','老板','高','pay'],
 ['委派','HACCP 表格待填写','当班员工被委派温度或清洁检查','按任务要求填表，提交异常说明','查看任务结果并跟进异常','员工','中','tasks'],
 ['委派','每日点钱与记账','收班时需要清点现金并登记','填写实点现金、交接金额与差额说明','核对差额与交接结果，必要时退回补充','双方','高','tasks'],
 ['材料','员工已提交入职资料，待老板审核','员工完成个人资料、证件与问卷提交','资料已提交，等待老板审核','打开员工资料核对，通过后进入制作合同环节','老板','高','review'],
 ['合同','资料审核通过，可以制作合同','老板确认入职资料无误','等待老板发送劳动合同','制作劳动合同，上传待签 PDF 并发送给员工','老板','中','docs'],
 ['合同','员工已收到劳动合同，待签署上传','老板上传并发送审核后的劳动合同','下载合同，签字后上传签署版本并提交','等待员工签回，必要时跟进','员工','中','docs'],
 ['合同','员工已上传签署合同，待老板核对归档','员工提交签署版本','等待老板核对签署合同','核对签字与合同内容，确认归档后办结','老板','中','docs'],
 ['合同','试用期 / 定期合同临近结束','进入档案中设定的提醒窗口','查看公司发来的后续安排','检查合同期限，安排沟通与后续处理','老板','高','contract']
 ].map((x,i)=>({id:'example-'+i,category:x[0],title:x[1],trigger:x[2],employee:x[3],owner:x[4],audience:x[5],risk:x[6],target:x[7],example:true}));}
function hrTodoHref(target,audience,id){
 if(audience==='employee')return '#employee-ui'+(id?'?preview='+encodeURIComponent(id):'');
 if(target==='review')return id?'#'+slug('employee','邀请详情')+'?id='+encodeURIComponent(id):'#'+slug('employee','入职邀请');
 if(target==='docs'||target==='contract')return id?`#${slug("employee","员工资料")}?id=${encodeURIComponent(id)}&tab=${target==='docs'?'docs':'contract'}`:'#'+slug('employee','员工档案');
 return '#'+slug('employee',({schedule:'排班管理',hours:'排班管理',pay:'工资单与发薪',leave:'排班管理',tasks:'员工档案'})[target]||'员工档案');
}
function hrTodosPage(){
 const audience=state().params.get('view')==='owner'?'owner':'employee',category=state().params.get('kind')||'全部',scope=empScope();
 const examples=hrTodoScenarios().filter(x=>(x.audience==='双方'||x.audience===(audience==='owner'?'老板':'员工'))&&(category==='全部'||x.category===category));
 const documentItems=empRoster().filter(e=>!scope||e.store===scope).flatMap(e=>empAlertsFor(e,empToday()).filter(a=>!(a.kind==='doc'&&a.type?.id==='contract'&&!e.invite?.contractSentAt)).map(a=>({id:e.id,category:a.kind==='doc'?'材料':'合同',title:e.name+' · '+a.title,trigger:a.kind==='doc'?(a.level==='expired'?'证件已过期':a.days===0?'今天到期':a.level==='missing'?'材料尚未上传':a.level==='date_missing'?'已记录材料，有效期待补充':'证件进入到期提醒窗口'):'合同日期进入提醒窗口',employee:a.type?.id==='belehrung'?'查看健康证截止日期，联系店长安排继续培训；完成后上传新证明与截止日期。':'查看本人资料，补交材料或联系店长。',owner:a.type?.id==='belehrung'?'同时通知员工，安排继续培训，核对新证明及截止日期并跟进完成。':'核对本人档案，跟进缺项或到期安排。',audience:a.kind==='doc'?'双方':'老板',risk:a.level==='expired'||a.level==='missing'?'高':'中',target:a.kind==='doc'?'docs':'contract',example:false,date:a.date}))).filter(x=>(audience==='owner'||x.audience==='双方')&&(category==='全部'||x.category===category));
 const current=[...hrContractTodoItems(scope).filter(x=>(x.audience==='双方'||x.audience===(audience==='owner'?'老板':'员工'))&&(category==='全部'||x.category===category)),...documentItems];
 const row=x=>`<tr><td><span class="pill ${x.risk==='高'?'red':x.risk==='中'?'orange':'blue'}">${x.category}</span></td><td><strong>${empEsc(x.title)}</strong><small>${x.example?'流程示例 · ':''}${empEsc(x.trigger)}${x.date?' · '+empEsc(x.date):''}</small></td><td><span class="pill ${x.audience==='双方'?'purple':'gray'}">${x.audience==='双方'?'员工 + 老板':x.audience+'端'}</span></td><td>${empEsc(audience==='owner'?x.owner:x.employee)}</td><td><a class="ghost-btn" href="${hrTodoHref(x.target,audience,x.example?null:x.id)}">${x.example?'查看入口':'查看档案'} →</a></td></tr>`;
 return `<div class="page-head"><div><h1>待办事项</h1><p>人事通知中心 · 从员工与老板两个视角，查看谁需要知道、下一步由谁处理。</p></div><span class="pill purple">本机演示</span></div>
 <div class="hr-todo-audience"><a class="${audience==='employee'?'active':''}" href="#todos?view=employee">员工端 <small>我的资料、班次与工时</small></a><a class="${audience==='owner'?'active':''}" href="#todos?view=owner">老板端 <small>审核、跟进与发薪</small></a></div>
 <p class="hr-todo-context">${audience==='employee'?'员工端通知场景预览：正式员工只会看到与本人有关的通知；列表按当前门店汇总，供你检查双向通知设计。':'老板端：汇总当前门店的人事事项，区分需要你审核的事项和需要员工补充的事项。'}</p>
 <div class="toolbar">${['全部','材料','合同','排班','考勤','工时','休假','薪资','委派'].map(c=>`<a class="filter ${c===category?'active':''}" href="#todos?view=${audience}&kind=${encodeURIComponent(c)}">${c}</a>`).join('')}</div>

 <section class="card"><div class="section-title"><div><h2>${audience==='owner'?'老板端':'员工端'} · 通知场景提醒实例</h2><p>档案中的待处理事项和流程示例统一列在这里。</p></div><span class="pill blue">${current.length+examples.length} 项提醒</span></div><div class="hr-todo-scroll"><table class="table hr-todo-table"><thead><tr><th>分类</th><th>事项 / 何时提醒</th><th>通知对象</th><th>${audience==='owner'?'老板下一步做什么':'员工下一步做什么'}</th><th>操作</th></tr></thead><tbody>${[...current,...examples].map(row).join('')||'<tr><td colspan="5">该视角暂无此类通知示例，请切换另一视角查看。</td></tr>'}</tbody></table></div></section>
 <p class="small" style="margin-top:12px">“员工 + 老板”表示同一事项分别通知双方，各自看到相应的处理内容。老板端包含店长审核与老板跟进；当前仅展示本地提醒与示例，不实际发送通知或执行审批。</p>`;
}

function hrContractTodoItems(scope){return empRoster().filter(e=>!scope||e.store===scope).flatMap(e=>{const inv=e.invite;if(!inv||(!inv.portalVersion&&!e.employeePortal?.submittedAt&&!inv.contractSentAt))return [];let item;
 if(inv.state==='submitted')item={category:'材料',title:'入职资料已提交，待审核',trigger:'员工已提交个人资料与证件',employee:'等待老板审核；如退回则补充资料。',owner:'审核员工入职资料，确认无误后制作劳动合同。',audience:'老板',target:'review'};
 else if(inv.state==='approved'&&!inv.contractSentAt)item={category:'合同',title:'资料审核通过，待生成入职文件',trigger:'资料审核完成，尚未向员工发送文件',employee:'等待老板发送入职文件。',owner:'生成并核对劳动合同和个人调查问卷，再发送给员工。',audience:'老板',target:'docs'};
 else if(inv.state==='approved'&&inv.contractSentAt&&!inv.contractSignedSubmittedAt)item={category:'合同',title:'入职文件已收到，待填写签署上传',trigger:'老板已发送劳动合同和个人调查问卷',employee:'下载两份文件，填写签字后上传并提交。',owner:'等待员工签署上传。',audience:'员工',target:'docs'};
 else if(inv.contractSignedSubmittedAt&&!inv.contractSignedReviewedAt)item={category:'合同',title:'签署文件已交回，待核对归档',trigger:'员工已提交签署版本',employee:'等待店长核对。',owner:'核对合同及个人调查问卷，确认归档后完成入职。',audience:'老板',target:'docs'};
 return item?[{...item,id:e.id,title:e.name+' · '+item.title,risk:'中',example:false}]:[];});}
