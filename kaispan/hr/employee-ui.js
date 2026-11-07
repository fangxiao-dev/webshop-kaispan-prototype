/* 员工端演示会话：每次载入从邀请页开始，资料独立保存在本机，不修改现有员工。
   规则来源：HR-ACCESS-25/26/30/43、HR-ONB-09/15/16/17/18/23/26～33/36/38/52、HR-DOC-02/06/07/09/12。 */
let euSession={step:'register',tab:'tasks',key:null,demo:'',task:null};
const EU_KEY='kaispanEmployeeUIDemoV1';
const EU_DEMO_KEY='kaispanEmployeeUIDemoScratchV1';
function euEmptyData(){return {name:'',email:'',docs:{},hours:[],availability:[],messages:[],punch:null};}
/* 演示状态单独存一份员工副本：读真实档案做底稿，但所有保存只写演示存储键（HR-ONB-52）。 */
function euDemoStoreKey(){return `${euSession.demo}::${euSession.key||'default'}`;}
function euDemoStore(){return empRead(EU_DEMO_KEY,{});}
function euDemoEntry(create){
 const all=euDemoStore(),key=euDemoStoreKey();
 if(!all[key]&&create){all[key]=JSON.parse(JSON.stringify(empRead(EU_KEY,{})[euSession.key]||euEmptyData()));empWrite(EU_DEMO_KEY,all);}
 return all[key]||null;
}
function euData(){
 if(euDemo())return euBoundData(euDemoEntry(true)||euEmptyData());
 return euBoundData(empRead(EU_KEY,{})[euSession.key]||euEmptyData());
}
/* 默认只同步邀请与店长可见的请求状态；入职填写阶段不写正式档案（HR-ONB-15/43）。 */
function euSaveDemo(d){const all=euDemoStore();all[euDemoStoreKey()]=d;empWrite(EU_DEMO_KEY,all);}
function euSave(d,opts){d.messages=Array.isArray(d.messages)?d.messages:[];if(euDemo()){euSaveDemo(d);return;}euPublishDraftProgress(d);if(opts&&opts.archive)euSyncEmployee(d);else euSyncInvite(d);empWrite(EU_KEY,{...empRead(EU_KEY,{}),[euSession.key]:d});}
function euMarkEdited(d,keys){d.profileEdited=[...new Set([...(d.profileEdited||[]),...keys])];return d;}
/* 入职后的资料修改先存本机草稿，提交店长核对前不写正式档案（HR-ONB-43） */
function euSaveDraft(d){d.messages=Array.isArray(d.messages)?d.messages:[];if(euDemo()){euSaveDemo(d);return;}euPublishDraftProgress(d);empWrite(EU_KEY,{...empRead(EU_KEY,{}),[euSession.key]:d});}
function euEmployee(d){return d?.employeeId?empById(d.employeeId):null;}
function euInvite(d){return euEmployee(d)?.invite||{};}
function euDemo(){return euSession.demo||'';}
/* 补件与资料修改共用同一个请求标识，老板端才能一次关闭两份投影（HR-ONB-43/44）。
   格式与老板端 empRequestId 一致；退回后重新提交由员工端换新 ID，旧 ID 留在 closedRequestIds。 */
function euRequestId(prefix){return typeof empRequestId==='function'?empRequestId(prefix):`${prefix||'req'}${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;}
function euRequestClosed(e,requestId){return typeof empRequestClosed==='function'?empRequestClosed(e,requestId):false;}
function euCloseRequestId(e,requestId){if(typeof empCloseRequestId==='function')empCloseRequestId(e,requestId);}
function euRequestSame(a,b){if(typeof empSameRequestId==='function')return empSameRequestId(a,b);const left=a?.requestId||'',right=b?.requestId||'';return !left||!right||left===right;}
function euSupplementRequestId(req){return String(req?.requestId||req?.token||req?.id||req?.at||req?.sentAt||'');}
/* 邀请有效期在写入入口再判一次，不能只靠页面入口（HR-ACCESS-25）。 */
function euInviteExpiredForSubmit(d){
 const e=euEmployee(d);
 if(e&&typeof empInviteExpiredAt==='function')return empInviteExpiredAt(e);
 const at=euInvite(d).expiresAt||'';
 return !!at&&String(at)<String(empNow());
}
/* 合同文件版本：一律以老板端 empContractFileIsCurrent 为准，不能先按“缺 dispatchId”自行拒绝。
   旧记录只有上传时间时，老板端允许用 at 证明属于本次发送；两端判断必须一致（HR-ONB-37/53）。
   没有全局函数时按同一约定兜底：ID 不一致或两者都缺才判旧件。 */
function euContractFileCurrent(d,key,file){
 if(!file)return false;
 const e=euEmployee(d),inv=euInvite(d),dispatchId=inv.dispatchId||'';
 if(typeof empContractFileIsCurrent==='function'){
  try{return !!empContractFileIsCurrent(e,file,key);}catch(_){return false;}
 }
 const fileId=file.dispatchId||'';
 if(dispatchId&&fileId&&String(fileId)!==String(dispatchId))return false;
 if(!fileId&&!file.at)return false;
 const sentAt=inv.contractSentAt||inv.sentAt||'';
 if(!fileId&&sentAt&&String(file.at)<String(sentAt))return false;
 const returned=inv.contractReview?.[key];
 if(returned?.state==='returned'){
  const same=returned.dispatchId&&fileId&&String(returned.dispatchId)===String(fileId);
  if(same){
   if(returned.at&&(!file.at||String(file.at)<=String(returned.at)))return false;
   if(!returned.at&&!file.at)return false;
   return true;
  }
  if(file.at&&returned.at)return String(file.at)>String(returned.at);
  return !!file.at;
 }
 return true;
}
/* 演示状态：老板端那些数据状态的演示开关（正式版没有），用于本机走查 */
const EU_DEMO_STATES=[['','按档案状态'],['returned','资料被退回'],['company','公司代填，待员工确认'],['veteran','在岗老员工开通'],['link','请确认员工档案关联'],['contract','合同与问卷待签回'],['contract-returned','只退回个人问卷'],['offline','合同线下签署已归档']];

/* hr-model.js 的共用 helper 在浏览器里全局可用；单测只加载本文件，这里做最小回退，取值口径保持一致。 */
function euNatClassOf(e){if(typeof hrNationalityClass==='function')return hrNationalityClass(e);const c=e?.contract||{};if(c.nationalityClass==='eu'||c.nationalityClass==='other')return c.nationalityClass;if(typeof c.nonEU==='boolean')return c.nonEU?'other':'eu';return '';}
function euSetNatClass(e,value){if(typeof hrSetNationalityClass==='function'){hrSetNationalityClass(e,value);return;}e.contract=e.contract||{};e.contract.nationalityClass=value==='eu'||value==='other'?value:'';e.contract.nonEU=e.contract.nationalityClass==='other';}
function euIsStudentOf(e){if(typeof hrIsStudent==='function')return hrIsStudent(e);const c=e?.contract||{};return c.type==='werkstudent'||c.isStudent===true;}
function euZusatzOf(e){if(typeof hrZusatzCheck==='function')return hrZusatzCheck(e);const c=e?.contract||{};if(c.zusatzCheck==='yes'||c.zusatzCheck==='no')return c.zusatzCheck;if(c.hasZusatz===true)return 'yes';return euNatClassOf(e)==='other'?'':'no';}
function euUploadError(file,imageOnly){return typeof hrUploadError==='function'?hrUploadError(file,imageOnly):'';}
/* 员工端语言列表来自 employee-ui-i18n.js；单测只加载本文件时用同一份回退。 */
const EU_LANGUAGES_FALLBACK=[['中文','zh','中文'],['Deutsch','de','Deutsch'],['English','en','English'],['Tiếng Việt','vi','Tiếng Việt'],['한국어','ko','한국어'],['日本語','ja','日本語']];
function euLanguages(){return typeof EU_LANGUAGES!=='undefined'?EU_LANGUAGES:EU_LANGUAGES_FALLBACK;}
function euT(text){return typeof euTranslate==='function'?euTranslate(text):text;}
/* 带数字的整句：按整句翻译模板，避免只译一半；缺少译文时按中文模板填数。 */
function euTF(pattern,vars){let text=pattern;if(typeof EU_TRANSLATIONS!=='undefined'&&typeof euLang==='function'){const map=EU_TRANSLATIONS[euLang()];if(map&&map[pattern])text=map[pattern];}Object.entries(vars||{}).forEach(([key,value])=>{text=text.split('{'+key+'}').join(String(value));});return text;}

/* 国籍类别三个值：'' 未回答 / 'eu' 欧盟、欧洲经济区或瑞士 / 'other' 其他国籍（HR-DOC-02） */
/* 新三态字段一旦出现在草稿里就优先，旧 euCitizen 只在真正没有新字段时兜底（HR-DOC-02/36）。 */
function euNationalityClass(d){const p=d.profile||{};if(p.nationalityClass==='eu'||p.nationalityClass==='other')return p.nationalityClass;if(p.nationalityClass!==undefined)return '';if(p.euCitizen==='no')return 'other';if(p.euCitizen==='yes')return 'eu';return '';}
function euStudentAnswer(d){const e=euEmployee(d);if(e?.contract?.type==='werkstudent')return 'yes';const p=d.profile||{};if(p.student==='yes'||p.student==='no')return p.student;if(e&&euIsStudentOf(e))return 'yes';return '';}
/* 附加页由店长核对居留证件后勾选，员工只看到结论（HR-DOC-06） */
function euZusatzStatus(d){const p=d.profile||{};if(p.zusatzCheck==='yes'||p.zusatzCheck==='no')return p.zusatzCheck;if(!euNationalityClass(d))return '';const e=euEmployee(d);if(e)return euZusatzOf(e);return p.hasZusatz==='yes'?'yes':p.hasZusatz==='no'?'no':'';}
/* 公司代填的唯一判据是 employerCompleted===true；fillMode=company 但还没填完仍按自填走（HR-ONB-09/52）。
   演示模式单独由演示入口决定，不冒充真实数据。 */
function euFillMode(d){const demo=euDemo(),inv=euInvite(d);if(demo==='company')return 'company';if(demo==='veteran')return 'veteran';if(inv.fillMode==='veteran'||inv.kind==='activation'||inv.activation===true||inv.veteran===true)return 'veteran';if(inv.employerCompleted===true)return 'company';return 'self';}
/* 关联确认判定只留一处：accountLink.pending、旧 linkPending/pendingLink、账号 pending_link 都算待确认。 */
function euLinkPending(d){if(euDemo()==='link')return !d?.accountLinkConfirmedAt;const inv=euInvite(d),link=inv.accountLink||inv.link||{};return link.state==='pending'||inv.linkPending===true||inv.pendingLink===true||euEmployee(d)?.account?.state==='pending_link';}
function euContractSent(d){const demo=euDemo();if(demo==='contract'||demo==='contract-returned'||demo==='offline')return true;return !!(euInvite(d).contractSentAt);}
function euContractOffline(d){const inv=euInvite(d);return euDemo()==='offline'||inv.dispatchMode==='offline'||!!inv.offlineSignedAt;}
function euContractArchived(d){const inv=euInvite(d);return euContractOffline(d)||!!inv.contractSignedReviewedAt||!!inv.archivedAt;}

/* 员工端阶段：fill 填资料 / returned 被退回 / submitted 已提交锁定 / approved 审核通过 / archived 已归档 */
function euStage(d){
 if(d.demoWorkspaceAt)return 'archived';
 if(euContractArchived(d))return 'archived';
 const inv=euInvite(d),demo=euDemo();
 if(demo==='veteran'&&d.veteranConfirmedAt)return 'archived';
 if(demo==='company'&&d.demoCompanyConfirmedAt)return 'approved';
 if(demo==='returned')return 'returned';
 if(demo==='contract'||demo==='contract-returned')return 'approved';
 if(inv.state==='returned')return 'returned';
 if(inv.pendingConfirm&&inv.state!=='approved')return 'submitted';
 if(inv.state==='approved')return 'approved';
 if(euContractSent(d))return 'approved';
 if(d.materialSubmitted||inv.state==='submitted')return 'submitted';
 return 'fill';
}
/* ANS-2：员工上传签好的合同和问卷（两份）即开放工作台，不等老板核对归档；审核通过但还没回传时只有入职任务页。 */
/* AM-06 选 A：合同或问卷任一份被退回、或合同作废（该份状态回到“缺”）就关闭，重新签回两份齐备再开放。 */
function euContractReturned(d){const inv=euInvite(d);if(euContractArchived(d))return true;if(!inv.contractSignedSubmittedAt&&!d?.contractSignedSubmittedAt)return false;return ['contract','questionnaire'].every(key=>['submitted','uploaded','approved'].includes(euContractStatus(d,key).state));}
function euWorkspaceOpen(d){const stage=euStage(d);return stage==='archived'||(stage==='approved'&&euContractReturned(d));}

/* 待确认关联要先于欢迎页和设密码出现；确认前只拿得到档案姓名（HR-ACCESS-43）。 */
function euLinkPendingEmployee(){
 const invite=euInvitation();
 if(euDemo()==='link'){
  const saved=euDemoEntry(false)||{};
  if(saved.accountLinkConfirmedAt)return null;
  return invite?.employeeId?empById(invite.employeeId):null;
 }
 if(!invite?.employeeId)return null;
 const e=empById(invite.employeeId);if(!e)return null;
 return euLinkPending({employeeId:e.id})?e:null;
}

function euRender(){
 const d=euData();
 if(euInvitation()?.expired)return euShell({...d,name:'',invitation:{key:'expired-link',store:''}},`<section class="eu-note eu-expired"><h2>${euT('链接已过期')}</h2><p>${euT('这个邀请链接已超过 7 天有效期，请联系店长重新发送邀请。')}</p></section>`,{linkOnly:true});
 const linkEmployee=euLinkPendingEmployee();
 if(linkEmployee)return euShell({...d,name:linkEmployee.name,invitation:{key:d.invitation?.key,store:''}},euLinkPage({name:linkEmployee.name}),{linkOnly:true});
 if(euSession.step==='register'){euSession.tab='tasks';if(euSession.demo)euSession.step='materials';}
 if(euSession.step==='register')return euShell(d,euWelcomePage(d));
 if(euSession.step==='password')return euShell(d,euPasswordPage());
 if(euLinkPending(d))return euShell({...d,name:d.name||euInvitation()?.name||'',invitation:{key:d.invitation?.key,store:''}},euLinkPage({...d,name:d.name||euInvitation()?.name||''}),{linkOnly:true});
 const stage=euStage(d);
 if(stage==='fill'||stage==='returned')return euShell(d,euMaterialsPage(d,stage));
 if(stage==='submitted')return euShell(d,euLockedPage(d));
 if(!euWorkspaceOpen(d))return euShell(d,`<main class="eu-body" data-eu-onboarding-only="1">${euTaskPanel(d)}<p class="eu-note">审核已通过。上传签好的劳动合同和个人调查问卷（两份）后，才会开放班表、资料等工作台；在那之前这里只有入职任务页。</p></main>`);
 return euWorkspace(d);
}

function euDemoSwitch(){return `<details class="eu-demo-switch" data-no-translate><summary>演示状态</summary><div><p>演示用，正式版没有：切换老板端的数据状态，查看员工端对应画面。</p><label>当前状态<select class="eu-demo-state">${EU_DEMO_STATES.map(([value,label])=>`<option value="${value}" ${euSession.demo===value?'selected':''}>${label}</option>`).join('')}</select></label></div></details>`;}
function euShell(d,body,opts){
 const linkOnly=!!opts?.linkOnly,store=d.invitation?.store||d.contractSummary?.store||'Martin Biergarten';
 const who=linkOnly?(d.name?empEsc(d.name):'员工账号'):`${d.name?empEsc(d.name)+' · ':''}${empEsc(store)}`;
 return `<div class="page-head"><div><h1>员工端 UI</h1><p>邀请 → 设密码 → 提交材料 → 签回合同 → 员工工作台</p></div><div class="eu-head-actions">${euDemoSwitch()}<button class="ghost-btn eu-restart">重新体验注册</button></div></div>
 <div class="eu-device"><header class="eu-header"><div><strong>KaiSpan 员工端</strong><small>${who}</small></div><span class="pill purple">本机演示</span></header>${body}</div>`;
}

/* 材料清单：按国籍类别、是否学生、附加页变化（HR-DOC-02/06/07、组合表） */
function euPrepareGroups(d){
 const nat=euNationalityClass(d),student=euStudentAnswer(d)==='yes',zusatz=euZusatzStatus(d);
 if(!nat)return [
  ['每位员工都要准备',['护照或身份证（二选一）、银行卡正面照片','食品卫生指导证明（健康证）','医保卡正反面照片（可以入职后补）']],
  ['其他国籍的员工额外准备',['居留许可（必须填写截止日期）','附加页（Zusatzblatt）：待店长核对居留证件后确定是否需要']],
  ['在读学生额外准备',['在读证明（有效期填学期结束日，每学期换新）']]];
 const first=['护照或身份证（二选一）','银行卡正面照片'];
 if(nat==='other')first.splice(1,0,'居留许可');
 if(nat==='other'&&zusatz==='yes')first.splice(2,0,'附加页（Zusatzblatt）');
 if(student)first.push('在读证明');
 return [['提交入职资料时必须交齐',first],['第一个上班日前必须有',['食品卫生指导证明（健康证）','Sozialversicherungsnummer（社保号）','签好的劳动合同和个人调查问卷（审核通过后公司发给你）']],['可以之后再补',['Steuer-ID（个人税务识别号）、医保公司和卡号、医保卡正反面照片']]];
}
function euPrepareList(d){return euPrepareGroups(d).map(([title,items])=>`<section class="eu-prepare"><strong>${title}</strong><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul></section>`).join('');}

function euWelcomePage(d){
 const invite=euInvitation();
 if(!invite)return `<div class="eu-body"><span class="eu-step">邀请链接</span><h2>暂时无法识别这份邀请</h2><p>请联系店长重新提供入职链接。</p></div>`;
 const e=invite.employeeId?empById(invite.employeeId):null;
 return `<div class="eu-body"><span class="eu-step">01 / 欢迎加入</span><h2>${empEsc(invite.name)}，欢迎加入</h2><p>店长已为你准备好入职邀请。请先看下面要准备的材料，再设置登录密码并填写资料。</p><div class="eu-task"><small>邀请中的员工资料</small><h3>${empEsc(invite.name)}</h3><p>${empEsc(invite.email||'邮箱已由店长登记')}<br>${empEsc(invite.store)}</p></div>
 <h3>要准备的材料</h3><p class="eu-note">按国籍类别和是否学生变化；选好国籍后再看清单会按你的情况更新。</p>${euPrepareList(d)}
 <p class="eu-note">邀请链接 7 天有效。登录密码由你本人设置，至少 6 位。${euFillMode(d)==='company'?'这份资料公司已替你填好，登录后核对确认即可。':''}</p>
 <button type="button" class="primary-btn eu-invite-continue">继续</button><button type="button" class="ghost-btn eu-workspace-direct" style="width:100%;margin-top:12px">跳过注册过程，直接进入操作界面</button><p class="eu-note">${invite.demo?'当前为预置的示例邀请，可直接体验。':'资料来自当前链接对应的本机邀请记录。'} 无需重新输入姓名和邮箱。本机演示不进行真实邮箱验证。</p></div>`;
}

function euPasswordPage(){
 return `<div class="eu-body"><span class="eu-step">激活员工账号</span><h2>设置登录密码</h2><p>请设置你的登录密码，至少 6 位。姓名和邮箱已由邀请带入，无需重新注册。</p><form class="eu-activate-form" novalidate><label>密码<input type="password" name="password" autocomplete="new-password" minlength="6"></label><label>确认密码<input type="password" name="confirm" autocomplete="new-password" minlength="6"></label><p class="eu-activation-feedback" role="status"></p><button class="primary-btn">设置密码并继续</button></form><p class="eu-note">本机仅演示账号激活步骤，不保存密码，不创建真实登录凭证。</p><p class="eu-note">演示可不填密码，直接点击继续。</p></div>`;
}

function euLinkPage(d){
 return `<div class="eu-body"><span class="eu-step">账号关联</span><h2>请确认员工档案关联</h2><p>公司把这个账号关联到下面的员工档案。确认前只显示档案姓名。</p><div class="eu-task"><small>档案姓名</small><h3>${empEsc(d.name||'—')}</h3></div><p class="eu-note">确认后你才能看到自己的入职资料、合同和待办。如果这不是你的档案，请不要确认，并联系店长。</p><button type="button" class="primary-btn eu-link-confirm">是我本人，确认关联</button><button type="button" class="ghost-btn eu-link-reject" style="width:100%;margin-top:12px">不是我，暂不确认</button><p class="eu-validation" role="status"></p></div>`;
}

function euReturnBanner(d){
 const inv=euInvite(d),reason=inv.returnNote||inv.returnReason||inv.returnInfo?.reason||d.returnedReason||(euDemo()==='returned'?'演示：护照照片模糊、健康证有效期缺失':'') ;
 const items=euReturnItemLabels(d);
 return `<section class="eu-return-banner"><strong>资料被退回，请修改后重新提交</strong>${reason?`<p>原因：${empEsc(reason)}</p>`:''}${items.length?`<p>被退回的项目：${items.map(x=>`<span class="eu-flag is-rejected">${empEsc(euT(x))}</span>`).join('')}</p>`:''}</section>`;
}
function euReturnKeys(d){const inv=euInvite(d);const raw=inv.returnItems||inv.returnedItems||inv.returnInfo?.items||d.returnedItems||(euDemo()==='returned'?['passport','hygiene']:[]);return Array.isArray(raw)?raw.map(x=>typeof x==='string'?x:x?.key).filter(Boolean):[];}
const EU_DOC_LABEL_FALLBACK={passport:'护照 / 身份证',visa:'居留许可',zusatz:'附加页（Zusatzblatt）',student:'在读证明',hygiene:'食品卫生指导证明（健康证）',healthFront:'医保卡正面照片',healthBack:'医保卡反面照片',bankFront:'银行卡正面照片',contract:'劳动合同',questionnaire:'个人调查问卷'};
function euReturnItemLabels(d){const keys=euReturnKeys(d);if(!keys.length)return [];const all=[...euDocumentList(d),...euRequiredItems(d).filter(x=>x.type==='field')];
 return keys.map(key=>{
  const hit=all.find(x=>x.key===key||x.doc===key||x.label===key);
  if(hit)return hit.label;
  /* 退回项可能只存材料 ID（id/belehrung/personalquestionnaire），没有国籍时也要显示本地化材料名。 */
  const rawKey=String(key).replace(/^doc:/,'');
  const docKey=Object.keys(EU_EMPLOYEE_DOC_MAP).find(k=>k===rawKey||EU_EMPLOYEE_DOC_MAP[k]===rawKey);
  if(docKey&&EU_DOC_LABEL_FALLBACK[docKey])return EU_DOC_LABEL_FALLBACK[docKey];
  const fieldKey=euSupplementProfileKey(rawKey),field=EU_UPDATE_FIELDS.find(([k])=>k===fieldKey);
  return field?field[1]:key;
 });}
function euIsReturned(d,key){const keys=euReturnKeys(d);return keys.includes(key)||keys.includes('doc:'+key);}

function euMaterialsPage(d,stage){
 const mode=euFillMode(d),returned=stage==='returned',nat=euNationalityClass(d);
 const banner=returned?euReturnBanner(d):'';
 const modeNote=mode==='company'?`<section class="eu-mode-note"><strong>公司已替你填好资料</strong><p>下面显示的是公司填写的内容，只改动有误的地方，然后点“确认资料”。确认后直接通过，不再走店长审核。</p></section>`:mode==='veteran'?`<section class="eu-mode-note"><strong>在岗老员工开通员工端</strong><p>你不需要重走入职审核和合同：只需确认资料、补交缺的证件。确认后缺的资料会进入“关键资料缺失”提醒。</p></section>`:'';
 const progress=euLayerProgress(d);
 return `<div class="eu-body" data-eu-stage="${stage}"><span class="eu-step">02 / 入职资料</span><h2>${mode==='company'?'核对公司填写的资料':mode==='veteran'?'确认资料并补交证件':'完善你的入职资料'}</h2>${banner}${modeNote}
 <p>姓名与邮箱由邀请带入。先回答国籍类别和是否学生，材料清单会随你的情况变化。</p>
 <h3>第一步 · 回答两个问题</h3>${euDocumentIdentity(d)}
 ${nat?'':`<p class="eu-waiting">待确认国籍：回答国籍类别后才会列出需要哪些材料。</p>`}
 ${nat?`<details class="eu-prepare-fold" open><summary>按你的情况，需要这些材料</summary>${euPrepareList(d)}</details>`:euPrepareList(d)}
 <section class="eu-layer"><header class="eu-layer-head"><span>第一层</span><div><strong>建议提交时就有</strong><small>${euTF('{done} / {total} 项已完成，只是提示，缺项不挡提交',{done:progress[1].done,total:progress[1].total})}</small></div></header>
  ${euProfileForm(d,'1')}${euDocSection(d,1,stage)}</section>
 <section class="eu-layer"><header class="eu-layer-head"><span>第二层</span><div><strong>第一个上班日前必须有</strong><small>${euTF('{done} / {total} 项已完成，缺项只是提示',{done:progress[2].done,total:progress[2].total})}</small></div></header>
  ${euProfileForm(d,'2')}${euDocSection(d,2,stage)}<p class="eu-note">签好的劳动合同和个人调查问卷在资料审核通过后由公司发给你，签回后归档。</p></section>
 <section class="eu-layer"><header class="eu-layer-head"><span>第三层</span><div><strong>可以之后补</strong><small>${euTF('{done} / {total} 项已完成，缺项只是提示',{done:progress[3].done,total:progress[3].total})}</small></div></header>
  ${euProfileForm(d,'3')}${euDocSection(d,3,stage)}</section>
 <p class="eu-validation" role="status"></p>${euSubmissionActions(d)}
 <button type="button" class="ghost-btn eu-skip" style="width:100%;margin-top:12px">测试跳过，进入工作台（演示用，正式版没有）</button><p class="eu-note">审核通过后，员工上传签好的合同和问卷（两份）才开放工作台，之前只有入职任务页。</p>
 <p class="eu-note">草稿自动保存到本机；店长只看到你提交的版本。提交后页面锁定，可以撤回再改。</p></div>`;
}

function euLockedPage(d){
 const at=d.materialSubmitted||euInvite(d).submittedAt||'';
 return `<div class="eu-body"><span class="eu-step">02 / 入职资料</span><h2>资料已提交，等待店长审核</h2><p>提交时间：${empEsc(at)}。审核期间页面锁定，店长只看到这次提交的版本。</p>
 <div class="eu-lock-card"><strong>已冻结的提交内容</strong><p>${euT('第一层必交项')}：${euLayerProgress(d)[1].done} / ${euLayerProgress(d)[1].total}</p></div>
 <p class="eu-note">发现填错可以撤回，回到草稿修改后重新提交；审核人始终看到最后一次提交的版本。</p>
 <button type="button" class="ghost-btn eu-withdraw">撤回提交，回到草稿</button>
 <button type="button" class="ghost-btn eu-skip" style="width:100%;margin-top:12px">测试跳过，进入工作台（演示用，正式版没有）</button><p class="eu-note">审核通过后，员工上传签好的合同和问卷（两份）才开放工作台，之前只有入职任务页。</p></div>`;
}

function euComingSoonPage(tab){
 const map={home:['今日','打卡与今日班次'],schedule:['排班','班表与报可工作时间'],hours:['薪资','工时、工资单与差旅费']};
 const [title,what]=map[tab]||map.home;
 return `<span class="eu-step">${title}</span><h2>${title}</h2><section class="eu-coming-soon"><strong>即将开放</strong><p>${what}属于第二、三期功能，一期工作台只开放“任务”和“资料”。</p><small>一期员工端：指派给我的待办（人事事项和点钞记账委派）+ 我的资料。</small></section><p class="eu-note"></p>`;
}

function euWorkspace(d){
 const tabs=[['tasks','任务'],['docs','资料'],['home','今日'],['schedule','排班'],['hours','薪资']];
 const tab=tabs.some(([key])=>key===euSession.tab)?euSession.tab:'tasks';
 const nav=`<nav class="eu-nav">${tabs.map(([key,label])=>`<button data-tab="${key}" class="${tab===key?'active':''}">${label}</button>`).join('')}</nav>`;
 let body='';
 if(tab==='tasks')body=euTaskPanel(d);
 else if(tab==='docs')body=euDocsTab(d);
 else body=euComingSoonPage(tab);
 return euShell(d,`<main class="eu-body">${body}</main>${nav}`);
}

function euInvitation(){
 const preview=state().params.get('preview');
 if(preview){const e=empById(preview);return e?euEmployeeInvitation(e):null;}
 const token=state().params.get('t')||state().params.get('token');
 if(token){const e=empRoster().find(x=>x.invite?.token===token||x.request?.token===token);if(e&&e.invite?.token===token&&typeof empInviteExpiredAt==='function'&&empInviteExpiredAt(e))return {expired:true,key:'expired-link',name:'',email:'',store:''};return e?euEmployeeInvitation(e,token):null;}
 return {key:'employee-ui-default-invitation',name:'Alex Chen',email:'alex.chen@example.com',store:'Martin Biergarten',demo:true};
}


/* 材料清单：按国籍类别、是否学生、附加页计算（HR-DOC-02/06/07/09、组合表）。
   提交时必交 = 第一层；健康证 = 第二层；医保卡照片 = 第三层。 */
function euDocumentList(d){
 const nat=euNationalityClass(d),student=euStudentAnswer(d)==='yes',zusatz=euZusatzStatus(d);
 if(!nat)return [];
 const list=[{key:'passport',label:'护照 / 身份证',layer:1,expires:true}];
 if(nat==='other')list.push({key:'visa',label:'居留许可',layer:1,expires:true});
 if(nat==='other'&&zusatz==='yes')list.push({key:'zusatz',label:'附加页（Zusatzblatt）',layer:1,expires:true});
 if(student)list.push({key:'student',label:'在读证明',layer:1,expires:true});
 list.push({key:'bankFront',label:'银行卡正面照片',layer:1,imageOnly:true});
 list.push({key:'hygiene',label:'食品卫生指导证明（健康证）',layer:2,expires:true});
 list.push({key:'healthFront',label:'医保卡正面照片',layer:3,imageOnly:true});
 list.push({key:'healthBack',label:'医保卡反面照片',layer:3,imageOnly:true});
 return list.map(t=>({...t,required:t.layer===1}));
}
/* 三层必填清单（HR-ONB-26～29）：提交校验、进度、退回标记都从这里取 */
function euRequiredItems(d){
 const p=d.profile||{},parts=(d.name||'').split(' '),items=[];
 const push=(key,label,layer,done,extra={})=>items.push({key,label,layer,type:'field',done,...extra});
 push('nationality','国籍类别',1,!!euNationalityClass(d));
 push('student','是否学生',1,!!euStudentAnswer(d));
 push('name','姓名',1,!!((p.first||parts[0])&&(p.last||parts.slice(1).join(' '))));
 push('birthday','出生日期',1,!!p.birthday);
 push('address','地址',1,!!(p.street&&p.houseNo&&p.zip&&p.city));
 push('iban','IBAN',1,!!p.iban);
 euDocumentList(d).forEach(t=>items.push({key:'doc:'+t.key,doc:t.key,label:t.label,layer:t.layer,type:'doc',done:!!d.docs?.[t.key]}));
 push('rentenversicherung','Sozialversicherungsnummer（社会保险号）',2,!!p.rentenversicherung);
 push('steuerId','Steuer-ID（个人税务识别号）',3,!!p.steuerId);
 push('krankenkasse','医保公司',3,!!p.krankenkasse);
 push('healthCardNumber','医保卡号',3,!!p.healthCardNumber);
 return items;
}
function euLayerProgress(d){const items=euRequiredItems(d),out={};[1,2,3].forEach(layer=>{const list=items.filter(x=>x.layer===layer)||[];out[layer]={done:list.filter(x=>x.done).length,total:list.length};});return out;}
function euLayer1Missing(d){
 const p=d.profile||{},parts=(d.name||'').split(' '),missing=[];
 if(!euNationalityClass(d))missing.push('国籍类别');
 if(!euStudentAnswer(d))missing.push('是否学生');
 if(!(p.first||parts[0]))missing.push('名');
 if(!(p.last||parts.slice(1).join(' ')))missing.push('姓');
 if(!p.birthday)missing.push('出生日期');
 [['street','街道'],['houseNo','门牌号'],['zip','邮编'],['city','城市']].forEach(([key,label])=>{if(!p[key])missing.push(label);});
 if(!p.iban)missing.push('IBAN');
 else if(euIbanError(p.iban))missing.push('IBAN 校验位不通过');
 euDocumentList(d).filter(t=>t.layer===1&&!d.docs?.[t.key]).forEach(t=>missing.push(t.label));
 return missing;
}
/* 兼容旧调用：第一层缺项（老板端公司代填也用它校验，HR-ONB-52） */
function euProfileMissing(d){return euLayer1Missing(d);}
function euIbanError(value){
 const raw=String(value||'').replace(/\s+/g,'').toUpperCase();if(!raw)return '';
 if(!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(raw))return 'IBAN 格式不正确';
 const rearranged=raw.slice(4)+raw.slice(0,4),digits=rearranged.replace(/[A-Z]/g,ch=>String(ch.charCodeAt(0)-55));
 let rest=0;for(const ch of digits)rest=(rest*10+Number(ch))%97;
 return rest===1?'':'IBAN 校验位不通过';
}

function euProfileForm(d,section='all'){
 const p=d.profile||{},parts=(d.name||'').split(' '),first=p.first??parts[0]??'',last=p.last??parts.slice(1).join(' ');
 const field=(key,label,type='text',value=p[key]||'',star='')=>`<label><span>${label}${star}</span><input class="eu-profile-field" data-profile="${key}" type="${type}" ${type==='date'?`max="${empToday()}"`:''} value="${empEsc(value)}"></label>`;
 const identity=(key,label,hint)=>`<label><span>${label}${euRequiredStar()}</span><input class="eu-profile-field" data-profile="${key}" data-id-kind="${key}" type="text" inputmode="numeric" autocomplete="off" value="${empEsc(p[key]||'')}"><small>${hint}</small><small class="eu-id-error" role="status"></small></label>`;
 const base=`<h3>基本信息</h3><div class="eu-cols">${field('first','名','text',first,euRequiredStar())}${field('last','姓','text',last,euRequiredStar())}</div><label><span>邮箱（邀请已登记）${euRequiredStar()}</span><input value="${empEsc(d.email||'')}" readonly></label>${field('birthday','出生日期','date',p.birthday||'',euRequiredStar())}`;
 const address=`<h3>地址</h3><div class="eu-cols">${field('street','街道','text',p.street||'',euRequiredStar())}${field('houseNo','门牌号','text',p.houseNo||'',euRequiredStar())}${field('zip','邮编','text',p.zip||'',euRequiredStar())}${field('city','城市','text',p.city||'',euRequiredStar())}</div>${field('country','居住国家','text',p.country||'Deutschland',euRequiredStar())}<label><span>IBAN${euRequiredStar()}</span><input class="eu-profile-field" data-profile="iban" data-iban-check type="text" value="${empEsc(p.iban||'')}"><small class="eu-iban-error" role="status"></small></label>`;
 const optional=`<details class="eu-optional"><summary>补充信息（可选）</summary>${field('phone','电话','tel')}<div class="eu-cols">${field('emergencyName','紧急联系人姓名')}${field('emergencyPhone','紧急联系人电话','tel')}</div><label><span>沟通语言</span><select class="eu-profile-field eu-language-choice" data-profile="language" data-no-translate>${euLanguages().map(([value,code,label])=>`<option value="${value}" ${(p.language||'中文')===value?'selected':''}>${label}</option>`).join('')}</select></label><p class="eu-note">一期实际只发邮件和站内待办。</p></details>`;
 const layer2=`<h3>社保号</h3>${identity('rentenversicherung','Sozialversicherungsnummer（社会保险号）','共 12 位：前 8 位数字、第 9 位字母、最后 3 位数字。')}`;
 const layer3=`<h3>税号与医保</h3>${identity('steuerId','Steuer-ID（个人税务识别号）','11 位数字，可带空格。')}${field('krankenkasse','医保公司（Krankenkasse）')}${field('healthCardNumber','医保卡号（Krankenversichertennummer）')}`;
 if(section==='1')return `<div class="eu-profile-form">${base}${address}${optional}</div>`;
 if(section==='2')return `<div class="eu-profile-form">${layer2}</div>`;
 if(section==='3')return `<div class="eu-profile-form">${layer3}</div>`;
 return `<div class="eu-profile-form">${base}${address}${optional}${layer2}${layer3}</div>`;
}

/* 国籍类别三选一、是否学生员工自答；附加页只显示店长核对结论（HR-DOC-02/06/07）。
   入职后资料页（mode='update'）这两个控件也必须写 updateDraft，不能直改入职草稿/正式值。 */
function euDocumentIdentity(d,mode){
 const update=mode==='update',nat=euNationalityClass(d),student=euStudentAnswer(d),zusatz=euZusatzStatus(d);
 const ztext=zusatz==='yes'?'需要':zusatz==='no'?'无需':'待店长核对';
 const natValue=update?euUpdateValue(d,'nationalityClass'):(nat||''),stuValue=update?euUpdateValue(d,'student'):(student||'');
 const attrs=key=>update?`class="eu-update-field" data-update="${key}"`:`class="eu-eligibility" data-profile="${key}"`;
 const flag=(key)=>update&&euUpdateChanged(d,key)?'<span class="eu-flag is-pending">待核对</span>':'';
 const old=(key)=>update&&euUpdateChanged(d,key)?`<small class="eu-old-value">原值：${empEsc((d.profile||{})[key]||'（空）')}</small>`:'';
 return `<div class="eu-profile-form eu-identity"><label><span>国籍类别${update?flag('nationalityClass'):euRequiredStar()}</span><select ${attrs('nationalityClass')}><option value="">请选择（没回答前材料清单待确认国籍）</option><option value="eu" ${natValue==='eu'?'selected':''}>欧盟、欧洲经济区（冰岛、列支敦士登、挪威）或瑞士公民</option><option value="other" ${natValue==='other'?'selected':''}>其他国籍（含英国）</option></select>${old('nationalityClass')}</label><label><span>是否是学生${update?flag('student'):euRequiredStar()}</span><select ${attrs('student')}><option value="">请选择</option><option value="yes" ${stuValue==='yes'?'selected':''}>是（需交在读证明）</option><option value="no" ${stuValue==='no'?'selected':''}>否</option></select>${old('student')}</label><p class="eu-zusatz">附加页（Zusatzblatt）：<strong>${ztext}</strong><small>由店长核对居留证件后勾选，员工本人不选</small></p>${euEmployee(d)?.contract?.type==='werkstudent'?'<p class="eu-note">合同类型是 Werkstudent，按规则视为学生，必须交在读证明。</p>':''}</div>`;
}

/* 单据与文件行：上传限制 PDF/PNG/JPEG ≤ 20 MB，银行卡、医保卡只收照片（HR-DOC-09/12） */
function euDocSection(d,layer,stage){
 const list=euDocumentList(d).filter(t=>t.layer===layer);
 if(!list.length)return layer===1?'<p class="eu-note">回答国籍类别后才会列出需要哪些材料。</p>':'';
 return list.map(t=>euDocRow(d,t,stage)).join('');
}
function euDocRow(d,t,stage){
 const key=t.key,file=d.docs?.[key],rejected=euIsReturned(d,key);
 const flags=[`<span class="eu-flag">第${t.layer}层</span>`,rejected?'<span class="eu-flag is-rejected">被退回</span>':''].filter(Boolean).join('');
 return `<div class="eu-doc${rejected?' is-rejected':''}"><div><strong>${euT(t.label)}${flags}</strong><small>${file?empEsc(file.name):'待上传'}${t.imageOnly?' · 只收照片':''}</small>${euDocExpiryFields(d,t)}</div><label class="ghost-btn eu-upload">${file?'替换':'上传'}<input type="file" accept="${euAccept(t)}" data-doc="${key}" hidden></label>${file?`<button type="button" class="eu-delete" data-doc="${key}" aria-label="删除${t.label}">×</button>`:''}</div>`;
}
function euInvitationDownloads(d){
 const token=state().params.get('t')||state().params.get('token'),employee=token?empRoster().find(e=>e.invite?.token===token||e.request?.token===token):null;
 
 const questionnaire=employee?.invite?.questionnaireTemplate||empQuestionnaireTemplate().file;
 const card=(title,file,fallback)=>{const url=file?.dataUrl||file?.data||file?.url;return `<div class="eu-download-file"><div><strong>${title}</strong><small>${empEsc(file?.name||fallback)}</small>${!url?'<small>待店长提供原始文件</small>':''}</div>${url?`<a class="ghost-btn" href="${empEsc(url)}" download="${empEsc(file.name||fallback)}">下载</a>`:'<button type="button" class="ghost-btn" disabled>待提供</button>'}</div>`;};
 return `<section class="eu-invitation-downloads"><h3>个人调查问卷</h3>${card('个人调查问卷（Personalfragebogen）',questionnaire,'Personalfragebogen.pdf')}<p>请下载个人调查问卷，填写签字后上传。劳动合同将在资料审核通过后另行发送。</p></section>`;
}

function euSubmissionActions(d){
 const mode=euFillMode(d);
 if(mode!=='self')return `<div class="eu-submit-actions"><button type="button" class="primary-btn eu-company-confirm">${mode==='veteran'?'确认资料':'确认资料，直接通过'}</button></div><p class="eu-note">${mode==='veteran'?'在岗老员工不重走审核和合同：确认后缺的资料进入“关键资料缺失”提醒。':'公司代填：确认后不再走审核，直接进入已通过，随后公司发合同。'}</p>`;
 return `<div class="eu-submit-actions"><button type="button" class="primary-btn eu-material-submit">提交材料</button></div><p class="eu-note">三层清单只提示还缺什么，不会挡住提交；没交齐的项目，店长审核时可能退回，或由老板做特殊审批。提交后页面锁定，可以撤回再改。</p>`;
}

/* ===== 员工档案 ↔ 员工端（唯一员工 ID；工资、排班及月度记录不参与同步） ===== */
const EU_EMPLOYEE_PROFILE_MAP={first:'firstName',last:'lastName',birthday:'birthday',phone:'contact.phone',street:'contact.street',houseNo:'contact.houseNo',zip:'contact.zip',city:'contact.city',country:'contact.country',emergencyName:'contact.emergencyName',emergencyPhone:'contact.emergencyPhone',language:'contact.language',krankenkasse:'contact.krankenkasse',healthCardNumber:'ids.healthCardNumber',steuernummer:'ids.steuernummer',steuerId:'ids.steuerId',rentenversicherung:'ids.rentenversicherung',iban:'ids.iban'};
const EU_EMPLOYEE_DOC_MAP={passport:'id',visa:'residence',zusatz:'zusatz',student:'student',health:'kv',healthFront:'healthFront',healthBack:'healthBack',bankFront:'bankFront',bankBack:'bankBack',hygiene:'belehrung',contract:'contract',questionnaire:'personalquestionnaire'};
/* 档案值只做底稿：员工草稿里已有的键优先，草稿才是当前填写内容（HR-ONB-15/36）。 */
function euBoundData(saved){
 const e=saved.employeeId?empById(saved.employeeId):null;if(!e)return saved;
 const formal={};
 Object.entries(EU_EMPLOYEE_PROFILE_MAP).forEach(([key,path])=>{const value=empGetPath(e,path);if(value!==undefined&&value!==null)formal[key]=String(value);});
 const parts=(e.name||'').split(' '),submitted=e.invite?.submitted||{};
 /* 审核通过时以员工提交的 first/last 为准（快照里带）；之后又改过姓名（name 与提交快照不同）则按新姓名拆。
    旧记录没有提交快照时退回档案字段。 */
 /* 只有审核通过后档案姓名又被改过，才按档案新姓名拆；待审核时档案仍是旧名，必须用提交快照（HR-ONB-10/22）。 */
 const renamed=!!(submitted.name&&e.name&&submitted.name!==e.name&&parts.length>1&&(e.invite?.state==='approved'||e.invite?.archivedAt));
 const submittedName=String(submitted.name||submitted.fullName||'').trim(),submittedParts=submittedName.split(/\s+/).filter(Boolean);
 formal.first=renamed?parts[0]:(submitted.firstName||submittedParts[0]||e.firstName||parts[0]||'');
 formal.last=renamed?parts.slice(1).join(' '):(submitted.lastName||submittedParts.slice(1).join(' ')||e.lastName||parts.slice(1).join(' '));
 /* 正式 isStudent=null 是“员工还没回答”，要明确投影成空，不能让旧本机 profile 的 yes 复活（HR-DOC-07）。 */
 if(e.contract&&Object.prototype.hasOwnProperty.call(e.contract,'isStudent'))formal.student=e.contract.isStudent===true?'yes':e.contract.isStudent===false?'no':'';
 /* 新三态字段存在就以它为准，明确空值也投影成空；旧 nonEU 只在确实没有新字段的迁移档案里派生（HR-DOC-02/36） */
 const natField=e.contract?.nationalityClass;
 if(natField==='eu'||natField==='other')formal.nationalityClass=natField;
 else if(natField!==undefined)formal.nationalityClass='';
 else if(e.migrated&&typeof e.contract?.nonEU==='boolean')formal.euCitizen=e.contract.nonEU?'no':'yes';
 if(e.contract?.hasZusatz!=null)formal.hasZusatz=e.contract.hasZusatz?'yes':'no';
 if(e.contract?.zusatzCheck)formal.zusatzCheck=e.contract.zusatzCheck;
 /* 店长已采纳同一条修改请求：清掉本机请求和对应草稿，页面回到正式档案；
    被退回的请求保留草稿，员工按退回原因继续改。 */
 const portalUpdate=e.employeePortal?.updateRequest,savedUpdate=saved.updateRequest;
 const updateSame=!!(portalUpdate&&savedUpdate&&((portalUpdate.requestId&&savedUpdate.requestId&&String(portalUpdate.requestId)===String(savedUpdate.requestId))||(portalUpdate.at&&savedUpdate.at&&String(portalUpdate.at)===String(savedUpdate.at))));
 const updateDone=portalUpdate?.state==='done'&&savedUpdate?.state==='pending'&&updateSame;
 const doneKeys=new Set(updateDone?(portalUpdate.items||[]).filter(x=>x.kind==='field').map(x=>x.key):[]);
 /* 员工真正改过的键（profileEdited）用草稿值；没改过的键仍以正式档案为准，避免草稿里存旧副本。 */
 const edited=new Set((saved.profileEdited||[]).filter(key=>!doneKeys.has(key)));
 const profile={...formal};
 Object.entries(saved.profile||{}).forEach(([key,value])=>{if(edited.has(key)||!(key in formal))profile[key]=value;});
 /* 姓名由草稿 first/last 生成：提交与页面都读同一个值，不能再被档案旧姓名盖回（HR-ONB-15/36）。 */
 const draftName=[profile.first,profile.last].filter(Boolean).join(' ').trim();
 const name=(edited.has('first')||edited.has('last'))&&draftName?draftName:(renamed?e.name:(submittedName||e.name||draftName));
 const d={...saved,name,email:e.contact?.email||saved.email,profile,docs:{...(saved.docs||{})},contractSummary:{...e.contract,entryDate:e.entryDate,probationEnd:e.probationEnd,store:e.store,role:e.role}};
 if(updateDone){
  /* 只清掉被采纳那几项；提交后又改的其他草稿继续保留。 */
  const doneItemKeys=new Set((portalUpdate.items||[]).map(x=>x.key));
  const keepProfile={};Object.entries(saved.updateDraft?.profile||{}).forEach(([key,value])=>{if(!doneItemKeys.has(key)&&!doneItemKeys.has(key.replace(/Expiry$/,'')))keepProfile[key]=value;});
  const keepDocs={};Object.entries(saved.updateDraft?.docs||{}).forEach(([key,value])=>{if(!doneItemKeys.has(key))keepDocs[key]=value;});
  d.updateDraft=(Object.keys(keepProfile).length||Object.keys(keepDocs).length)?{...saved.updateDraft,profile:keepProfile,docs:keepDocs}:null;
  d.updateRequest=null;d.profileEdited=[...(saved.profileEdited||[])].filter(key=>!doneKeys.has(key));
 }
 d.contractSignedSubmittedAt=e.invite?.contractSignedSubmittedAt||null;
 if(e.invite?.state==='submitted'&&!d.materialSubmitted)d.materialSubmitted=e.invite.submittedAt||'（已提交）';
 /* 被退回=回到草稿：清掉残留的提交标记，避免改任一字段就自动再次提交（HR-ONB-16/23） */
 if(e.invite?.state==='returned'){d.materialSubmitted=null;d.submitActionAt=null;}
 const removed=new Set((saved.docHistory||[]).map(x=>x.key));
 Object.entries(EU_EMPLOYEE_DOC_MAP).forEach(([key,docId])=>{
  const doc=e.docs?.[docId];let local=saved.docs?.[key];
  /* 作废重发后，本机旧发送的签回草稿不能混进新发送（HR-ONB-37/53）。 */
  if(['contract','questionnaire'].includes(key)&&local&&local.source!=='archive'&&!euContractFileCurrent({employeeId:e.id},key,local)){delete d.docs[key];local=null;}
  /* 档案里的版本比本机新（例如店长刚换过护照）就刷新本机缓存；只有本机上传得更晚、还没提交时才保留本机件。 */
  const localNewer=!!(local&&local.at&&(!doc?.at||String(local.at)>String(doc.at)));
  if(doc&&(!local||!localNewer)){
   /* 正式文件本身换了新版本时，日期必须跟文件走；旧草稿里的日期属于旧文件。 */
   const formalNewer=!!(doc.at&&(!local?.at||String(doc.at)>String(local.at)));
   /* 没编辑过的日期随正式文件刷新；不能再把本机缓存的旧日期当草稿写回去（HR-ONB-52）。 */
   if(formalNewer||!edited.has(key+'Expiry'))d.profile[key+'Expiry']=doc.expiry||'';
   if(formalNewer||!edited.has(key+'HasExpiry'))d.profile[key+'HasExpiry']=doc.expiry?'yes':'';
   if(doc.state==='missing'){delete d.docs[key];return;}
   if(!doc.file){d.docs[key]={name:'档案已记录，原文件未提供',source:'archive',legacyNoFile:true};return;}
   /* 发送记录 ID 和上传时间必须一起投影：只留 at 会让员工端把本次签回件判成旧件（HR-ONB-37/53）。 */
   d.docs[key]={name:doc.file,data:doc.dataUrl||empFileUrl(doc.ref),ref:doc.ref,at:doc.at,dispatchId:doc.dispatchId||'',source:'archive',expiry:doc.expiry||''};
   return;
  }
  if(!doc||removed.has(key))return;
  if(!local&&doc.file)d.docs[key]={name:doc.file,data:doc.dataUrl||empFileUrl(doc.ref),ref:doc.ref,at:doc.at,dispatchId:doc.dispatchId||'',source:'archive',expiry:doc.expiry||''};
 });
 /* 店长已处理补件、或 requestId 已进终态后，本机旧交回记录不再保留或展示（HR-ONB-43/44）。 */
 if(euSupplementSubmissionStale(e)||euRequestClosed(e,d.supplementSubmission?.requestId)){delete d.supplementSubmission;delete d.supplementReturnedAt;}
 return d;
}
function euEnsureEmployee(d,invite){
 let e=invite.employeeId?empById(invite.employeeId):d.employeeId?empById(d.employeeId):null;
 if(!e&&invite.demo){const existing=empById('employee-ui-demo-alex');if(existing)e=existing;else{
 const base=empRoster().find(x=>x.status==='invited')||empRoster()[0];if(!base)return d;
 e=JSON.parse(JSON.stringify(base));Object.assign(e,{id:'employee-ui-demo-alex',name:invite.name,firstName:'Alex',lastName:'Chen',birthday:'',store:invite.store,status:'invited',entryDate:empToday(),probationEnd:'',docs:{},history:[],note:'员工端 UI 关联示例员工',uiDemo:true});e.contact={email:invite.email};e.ids={};e.request=null;e.contract={...base.contract};euSetNatClass(e,d.profile?.nationalityClass||'');if(d.profile?.student)e.contract.isStudent=d.profile.student==='yes';e.invite={portalVersion:2,onboardingFilesVersion:1,token:'employee-ui-demo-invite',state:'sent',createdAt:empNow(),submitted:{},reminders:[]};empSaveStaff(e);
 }}
 if(e){d.employeeId=e.id;if(!d.archiveLinkedAt){d.archiveLinkedAt=empNow();if(e.uiDemo)euSyncEmployee(d);else Object.assign(d,euBoundData(d));}}
 return d;
}
/* 提交冻结版本：按老板端 empApproveInvite / empInviteProgress 认的路径写，
   审核通过时才能一次合并进正式档案（HR-ONB-16/52）。 */
function euSubmissionSnapshot(d){
 const p=d.profile||{};
 /* 兼容只有 name 的旧草稿：拆出 first/last，同时把 name 和 firstName/lastName 都写给老板端（HR-ONB-15/16）。 */
 const name=[p.first,p.last].filter(Boolean).join(' ').trim()||d.name||'';
 const nameParts=String(name).trim().split(/\s+/).filter(Boolean);
 const firstName=p.first||(nameParts.length>1?nameParts.slice(0,-1).join(' '):nameParts[0]||''),lastName=p.last||(nameParts.length>1?nameParts[nameParts.length-1]:'');
 const snap={at:d.materialSubmitted,name,firstName,lastName,birthday:p.birthday||'',contact:{},ids:{},docs:{},contract:{},profile:{...p,first:firstName,last:lastName}};
 Object.entries(EU_EMPLOYEE_PROFILE_MAP).forEach(([key,path])=>{if(path.startsWith('contact.')||path.startsWith('ids.'))empSetPath(snap,path,p[key]??'');});
 if(p.nationalityClass!==undefined)snap.contract.nationalityClass=p.nationalityClass;
 const student=euStudentAnswer(d);if(student)snap.contract.isStudent=student==='yes';
 Object.entries(EU_EMPLOYEE_DOC_MAP).forEach(([key,docId])=>{const doc=d.docs?.[key];if(!doc||doc.legacyNoFile)return;snap.docs[docId]={state:'ok',file:doc.name,dataUrl:doc.data||null,ref:doc.ref,dispatchId:doc.dispatchId||'',expiry:p[key+'Expiry']||'',noExpiry:false,at:doc.at};});
 return snap;
}

/* opts.profile / opts.docs 决定是否把草稿写进正式档案；默认只同步邀请与请求状态。演示状态只写演示副本。 */
function euSyncStaff(d,opts){
 const cfg=opts||{};
 if(euDemo())return;
 if(!d.employeeId)return;const current=empById(d.employeeId);if(!current)return;const next=JSON.parse(JSON.stringify(current));next.contact||={};next.ids||={};next.docs||={};next.contract||={};
 if(cfg.profile){
  Object.entries(EU_EMPLOYEE_PROFILE_MAP).forEach(([key,path])=>{if(d.profile?.[key]!==undefined)empSetPath(next,path,d.profile[key]);});
  if(d.profile?.first!==undefined||d.profile?.last!==undefined)next.name=[next.firstName||'',next.lastName||''].filter(Boolean).join(' ')||next.name;
  if(d.profile?.nationalityClass!==undefined)euSetNatClass(next,d.profile.nationalityClass);
  if(d.profile?.student==='yes'||d.profile?.student==='no')next.contract.isStudent=d.profile.student==='yes';
 }
 if(cfg.docs){
  const removed=new Set((d.docHistory||[]).map(x=>x.key));
  const edited=new Set(d.profileEdited||[]);
  /* 有编辑标记的页面只写实际改过的日期；旧脚本/旧记录没有 profileEdited 时保持整份同步。 */
  const trackEdits=Array.isArray(d.profileEdited);
  Object.entries(EU_EMPLOYEE_DOC_MAP).forEach(([key,docId])=>{
   if(cfg.docKeys&&!cfg.docKeys.includes(key))return;
   const doc=d.docs?.[key],old=next.docs[docId]||{};
   /* 已核对通过的合同/问卷不能被本机草稿替换（HR-ONB-53）。 */
   if(['contract','questionnaire'].includes(key)&&euContractStatus(d,key).state==='approved')return;
   /* 旧发送期间的本机签回件不能写进新发送（HR-ONB-37/53）。 */
   if(['contract','questionnaire'].includes(key)&&doc&&doc.source!=='archive'&&!euContractFileCurrent(d,key,doc))return;
   /* 本机缓存比档案旧时不回写，避免工作台一保存就把店长刚更新的文件退回旧版（HR-ONB-15/43）。 */
   if(doc&&!doc.legacyNoFile&&old.at&&doc.at&&String(doc.at)<String(old.at))return;
   /* 只写员工实际编辑过的有效期，没编辑过的日期不能拿本机旧副本覆盖正式文件（HR-ONB-52）。 */
   if(next.docs[docId]&&(!trackEdits||edited.has(key+'Expiry')))next.docs[docId].expiry=d.profile?.[key+'Expiry']??'';
   if(next.docs[docId]&&(!trackEdits||edited.has(key+'HasExpiry')))next.docs[docId].noExpiry=false;
   if(doc?.legacyNoFile)return;
   if(doc){if(old.file&&doc.data&&old.dataUrl!==doc.data&&doc.source!=='archive')next.documentArchive=[{docId,...old,archivedAt:empNow()},...(next.documentArchive||[])];next.docs[docId]={...old,state:'ok',file:doc.name,dataUrl:doc.data||old.dataUrl,ref:doc.ref||old.ref,dispatchId:doc.dispatchId||old.dispatchId||'',expiry:(!trackEdits||edited.has(key+'Expiry'))?(d.profile?.[key+'Expiry']??''):old.expiry,noExpiry:(!trackEdits||edited.has(key+'HasExpiry'))?d.profile[key+'HasExpiry']==='no':old.noExpiry,at:doc.at||old.at,by:doc.source==='archive'?old.by:'self',needsReview:doc.source==='archive'?old.needsReview:true};}
   else if(removed.has(key)&&old.file){next.documentArchive=[{docId,...old,archivedAt:empNow()},...(next.documentArchive||[])];next.docs[docId]={...old,state:'missing'};}
  });
 }
 /* 只有员工点了“提交材料”才推进状态；改字段、传文件都不自动提交（HR-ONB-16/23） */
 if(d.submitActionAt&&!euInviteExpiredForSubmit(d)&&next.invite&&next.invite.state!=='approved'&&next.invite.lastSubmitActionAt!==d.submitActionAt){
  next.invite.portalVersion=2;if(!next.invite.contractSentAt)next.invite.onboardingFilesVersion=1;
  next.invite.state='submitted';next.invite.submittedAt=d.materialSubmitted;next.invite.lastSubmitActionAt=d.submitActionAt;
  next.invite.submitted={...(d.submitted||{}),profile:{...(d.submitted?.profile||d.profile||{})}};
  next.invite.draftProgress=null;
 }
 if(!d.materialSubmitted&&d.withdrawnAt&&next.invite?.state==='submitted'){next.invite.state='sent';next.invite.withdrawnAt=d.withdrawnAt;next.invite.lastSubmitActionAt=null;}
 /* 公司代填确认只认 employerCompleted===true 或明确的演示模式（HR-ONB-09/52）。 */
 const confirmGaps=(d.confirmedCompanyProfileAt||d.veteranConfirmedAt)&&next.invite?empConfirmGaps(next):[];
 const confirmHeld=confirmGaps.length>0&&!next.invite?.specialApproval;
 if(next.invite&&!confirmHeld&&next.invite.pendingConfirm)next.invite.pendingConfirm=null;
 if(d.confirmedCompanyProfileAt&&next.invite&&next.invite.employerCompleted===true&&next.invite.state!=='approved'&&confirmHeld){next.invite.pendingConfirm=next.invite.pendingConfirm||{mode:'company',at:d.confirmedCompanyProfileAt,items:confirmGaps.map(x=>x.key),labels:confirmGaps.map(x=>empRaw(x.label))};}
 else if(d.confirmedCompanyProfileAt&&next.invite&&next.invite.employerCompleted===true){next.invite.state='approved';next.invite.fillMode='company';next.invite.confirmedCompanyProfileAt=d.confirmedCompanyProfileAt;next.invite.approvedAt=next.invite.approvedAt||d.confirmedCompanyProfileAt;}
 /* 在岗老员工确认后直接归档：不审核、不发合同（HR-ACCESS-30、HR-ONB-52） */
 if(d.veteranConfirmedAt&&next.invite&&next.invite.state!=='approved'&&confirmHeld){next.invite.pendingConfirm=next.invite.pendingConfirm||{mode:'veteran',at:d.veteranConfirmedAt,items:confirmGaps.map(x=>x.key),labels:confirmGaps.map(x=>empRaw(x.label))};}
 else if(d.veteranConfirmedAt&&next.invite){next.invite.state='approved';next.invite.fillMode='veteran';next.invite.veteranConfirmedAt=d.veteranConfirmedAt;next.invite.approvedAt=next.invite.approvedAt||d.veteranConfirmedAt;next.invite.archivedAt=next.invite.archivedAt||d.veteranConfirmedAt;next.invite.archivedBy=next.invite.archivedBy||'员工确认';}
 if(d.contractSignedSubmittedAt&&next.invite&&(!next.invite.contractSignedSubmittedAt||String(d.contractSignedSubmittedAt)>String(next.invite.contractSignedSubmittedAt)))next.invite.contractSignedSubmittedAt=d.contractSignedSubmittedAt;
 if(d.accountLinkConfirmedAt&&next.invite){
  /* 确认后统一清理兼容标记，入口判定和页面不能一个说已确认、一个还说待确认（HR-ACCESS-43）。 */
  const link={...(next.invite.accountLink||next.invite.link||{})};
  link.state='confirmed';link.confirmedAt=d.accountLinkConfirmedAt;
  next.invite.accountLink=link;
  if(next.invite.link)next.invite.link={...next.invite.link,state:'confirmed',confirmedAt:d.accountLinkConfirmedAt};
  delete next.invite.linkPending;delete next.invite.pendingLink;
  if(next.account?.state==='pending_link')next.account={...next.account,state:'active',activatedAt:empNow()};
 }
 /* 店长已采纳/退回/撤销补件后，员工端不再保留旧的补件投影；已关闭的 requestId 也不能再写回（HR-ONB-43/44）。 */
 if(next.employeePortal?.supplementSubmission&&(euSupplementSubmissionStale(next)||euRequestClosed(next,next.employeePortal.supplementSubmission.requestId)))delete next.employeePortal.supplementSubmission;
 /* 普通保存绝不写请求/审批结果：只有显式动作经 euPublishPortal 发布，否则会把店长已处理的结果复活（HR-ONB-43/44）。 */
 if(next.employeePortal&&next.employeePortal.key!==euSession.key)next.employeePortal={...next.employeePortal,key:euSession.key};
 if(JSON.stringify(next)!==JSON.stringify(current))empSaveWithHistory(next,'员工端 UI');
}
function euSyncInvite(d){return euSyncStaff(d,{});}
function euSyncEmployee(d){return euSyncStaff(d,{profile:true,docs:true});}
function euSyncDocs(d,docKeys){return euSyncStaff(d,{docs:true,docKeys});}
/* 只发布店长可见的请求结果，不动正式档案字段（HR-ONB-43/44） */
function euPublishPortal(d,patch,extra){
 if(euDemo())return;
 if(!d.employeeId)return;const current=empById(d.employeeId);if(!current)return;
 const next=JSON.parse(JSON.stringify(current));
 const portalPatch={...(patch||{})};
 /* 补件请求已被店长处理、或 requestId 已进终态时，不再发布旧的交回投影（HR-ONB-43/44）。 */
 if(portalPatch.supplementSubmission&&(euSupplementSubmissionStale(next)||euRequestClosed(next,portalPatch.supplementSubmission.requestId)))delete portalPatch.supplementSubmission;
 /* 已采纳/退回/撤销的修改请求不能再被本机旧对象重放成 pending。 */
 if(portalPatch.updateRequest&&euRequestClosed(next,portalPatch.updateRequest.requestId))delete portalPatch.updateRequest;
 if(!Object.keys(portalPatch).length&&!extra)return;
 next.employeePortal={...(next.employeePortal||{}),...portalPatch,updatedAt:empNow()};
 if(extra)Object.assign(next,extra);
 if(JSON.stringify(next)!==JSON.stringify(current))empSaveWithHistory(next,'员工端 UI');
}
/* 入职草稿只向老板端发布三层完成度，不发布草稿值本身（HR-ONB-15/52）。 */
function euDraftProgress(d){
 const layers=euLayerProgress(d),out={};
 [1,2,3].forEach(layer=>{out[layer]={done:layers[layer].done,total:layers[layer].total};});
 return {at:empNow(),done:layers[1].done,total:layers[1].total,layers:out};
}
function euPublishDraftProgress(d){
 if(euDemo()||!d.employeeId)return;
 const e=empById(d.employeeId),inv=e?.invite;
 if(!e||!inv||!['draft','sent','returned'].includes(inv.state))return;
 const progress=euDraftProgress(d),prev=inv.draftProgress||{};
 if([1,2,3].every(layer=>prev.layers?.[layer]?.done===progress.layers[layer].done&&prev.layers?.[layer]?.total===progress.layers[layer].total))return;
 const next=JSON.parse(JSON.stringify(e));next.invite.draftProgress=progress;
 if(typeof empSaveWithHistory==='function')empSaveWithHistory(next,'员工端 UI（草稿进度）');else if(typeof empSaveStaff==='function')empSaveStaff(next);
}

function euRequiredStar(){return '<span class="eu-required-star" aria-hidden="true">*</span>';}
function euContractSummary(d){const c=d.contractSummary;if(!c)return '';
 const values=[['工作地点',c.workLocation||c.store||'未填写'],['岗位职责',c.duties||empText(empRole(c.role).name)],['合同类型',empText(empContractType(c.type).name)],['入职日期',c.entryDate||'未填写'],['合同到期',c.befristetUntil||'未约定固定到期日'],['每周约定工时',c.weeklyHours?c.weeklyHours+' h':'未单独录入'],['每月工时范围',`${c.hoursMin??'—'}–${c.hoursMax??'—'} h`],['薪资方式',c.payType==='pauschal'?'固定月薪 Brutto':'时薪 Brutto'],['合同薪资',`€${Number(c.rate||0).toFixed(2)} / ${c.payType==='pauschal'?'月':'小时'}`],['年假天数',`${c.urlaubDays??'—'}`],['试用期结束',c.probationEnd||'未设置'],['解约通知期',c.noticePeriod||'未填写'],['发薪时间与支付方式',c.paymentTerms||'未填写'],['加班与工时账户约定',c.overtimeTerms||'未填写'],['补贴 / 奖金约定',c.allowanceTerms||'未填写']];
 return `<details class="eu-task"><summary>合同摘要 · 与员工档案一致</summary><div class="eu-contract-summary">${values.map(([label,value])=>`<div><small>${label}</small><strong>${empEsc(value)}</strong></div>`).join('')}</div><p class="eu-note">合同条款由公司维护；如有差异请联系店长，签署合同原文为准。</p></details>`;
}

function euEmployeeInvitation(e,token){const linked=Object.entries(empRead(EU_KEY,{})).find(([,d])=>d.employeeId===e.id);return {employeeId:e.id,key:linked?.[0]||(token?`invitation:${token}`:`employee:${e.id}`),name:e.name,email:e.contact?.email||'',store:e.store,demo:!token};}


/* 点钞记账委派：只进入员工自己的本机档案，不写入门店正式财务账。
   一期员工端任务只含人事事项和点钞记账，HACCP 示例去掉（HR-TODO-60/61）。 */
function euAssignedTasks(){const today=empToday();return [
 {id:`cash-${today}`,kind:'cash',title:'闭店点钱与每日记账',category:'点钞记账',from:'Martin · 店长',due:'闭店后 · 22:30',instructions:'按面额清点现金，对照收银结算单，记录现金、银行卡收入及差额原因。提交后由店长核对。'}];}
function euTaskState(task,d){return d.assignedTasks?.[task.id]||{state:'todo',values:{}};}
function euTaskCard(task,d){const saved=euTaskState(task,d),labels={todo:'待处理',draft:'草稿',submitted:'待审核',done:'已完成',returned:'退回修改'};return `<article class="eu-assignment"><div class="eu-assignment-top"><span class="pill blue">${task.category}</span><span class="pill ${saved.state==='submitted'?'blue':saved.state==='done'?'green':'orange'}">${labels[saved.state]||'待处理'}</span></div><h3>${task.title}</h3><p>${task.from} 委派<br>${task.due} · ${empToday()}</p><button class="ghost-btn eu-task-open" data-task="${task.id}">${saved.state==='submitted'?'查看已提交内容':saved.state==='draft'?'继续填写':'查看并处理'}</button></article>`;}

/* 指派给我的待办：人事事项 + 点钞记账委派（HR-TODO-60/61、7.x） */
function euHrTodoItems(d){
 const items=[],stage=euStage(d),inv=euInvite(d);
 if(stage==='fill'||stage==='returned'){
  const missing=euLayer1Missing(d);items.push({title:'入职资料待补充',meta:missing.length?euTF('第一层还缺 {n} 项（只是提示，不挡提交）',{n:missing.length}):euT('第一层已齐，可以提交审核'),pill:'入职',tone:'orange',tab:'docs'});
 }
 /* 在岗老员工确认后免审核免合同，但缺的资料要单独提醒（HR-ONB-52、hr.profile_missing） */
 if(stage==='archived'){
  const missing=euLayer1Missing(d);
  if(missing.length)items.push({title:'关键资料缺失',meta:euTF('还缺 {n} 项：{items}{more}',{n:missing.length,items:missing.slice(0,4).map(x=>euT(x)).join('、'),more:missing.length>4?euT(' 等'):''}),pill:'资料',tone:'red',tab:'docs'});
 }
 const sup=euSupplementRequest(d);
 if(sup)items.push({title:sup.state==='submitted'?'补交材料已交回，等待店长核对':'店长要求补交材料',meta:euSupplementLabels(sup,d).map(x=>euT(x)).join('、')||euT('打开资料页查看要补的项目'),pill:'补件',tone:sup.state==='submitted'?'blue':'orange',tab:'docs'});
 const update=euUpdateRequest(d);
 if(update&&update.state==='pending')items.push({title:'资料修改待店长核对',meta:euTF('共 {n} 项，核对期间档案保持原值',{n:(update.items||[]).length}),pill:'资料',tone:'blue',tab:'docs'});
 else if(update&&update.state==='returned')items.push({title:'资料修改被退回',meta:update.reason||'请按店长说明修改后重新提交',pill:'资料',tone:'orange',tab:'docs'});
 euExpiryNotices(d).forEach(x=>items.push({title:x.title,meta:x.message,pill:'证件',tone:'red',tab:'docs'}));
 if(euContractSent(d)&&!euContractArchived(d))items.push({title:'签回劳动合同和个人问卷',meta:euContractTodoMeta(d),pill:'合同',tone:'orange',tab:'docs'});
 if(euLinkPending(d))items.push({title:'请确认员工档案关联',meta:'确认前只显示档案姓名',pill:'关联',tone:'orange',tab:'docs'});
 return items;
}
function euContractTodoMeta(d){
 const st=euContractStatus(d,'contract'),qs=euContractStatus(d,'questionnaire');
 if(st.state==='returned'||qs.state==='returned')return '有被退回的一份，只需重传那一份';
 if(st.state==='submitted'&&qs.state==='submitted')return '两份已交回，等待店长核对';
 return '两份一起下载、签字、上传，两份都传才算签回';
}
function euTaskPanel(d){
 const tasks=euAssignedTasks(),task=tasks.find(x=>x.id===euSession.task),items=euHrTodoItems(d);
 if(task){
 const saved=euTaskState(task,d),v=saved.values||{},locked=['submitted','done'].includes(saved.state),disabled=locked?'disabled':'';
 const field=(key,label,type='number',required=true)=>`<label>${label}<input name="${key}" type="${type}" ${type==='number'?'step="0.01"':''} value="${empEsc(String(v[key]??''))}" ${required?'required':''} ${disabled}></label>`;
 const fields=`${field('date','记账日期','date')}<h3>按面额清点现金</h3><div class="eu-denominations">${[200,100,50,20,10,5,2,1,.5,.2,.1,.05,.02,.01].map(amount=>`<label>€${amount.toFixed(2)}<input type="number" min="0" step="1" name="count_${amount}" data-denom="${amount}" value="${v['count_'+amount]??0}" aria-label="${amount} 欧元数量" ${disabled}></label>`).join('')}</div><div class="eu-cash-total">清点现金 <strong class="eu-counted">€0.00</strong></div>${field('expected','结算单应有现金 €')}${field('opening','备用金 / 起始现金 €')}${field('cashRevenue','现金收入 €')}${field('cardRevenue','银行卡收入 €')}${field('expense','现金支出 €','number',false)}<label>结算单 / 票据编号<input name="receipt" value="${empEsc(v.receipt||'')}" ${disabled}></label><div class="eu-cash-total">与应有现金差额 <strong class="eu-cash-diff">€0.00</strong></div><label>差额原因 / 备注<textarea name="note" ${disabled}>${empEsc(v.note||'')}</textarea></label>`;
 return `<button class="ghost-btn eu-task-back">‹ 我的任务</button><span class="eu-step" style="display:block;margin-top:20px">${task.category}</span><h2>${task.title}</h2><p>${task.from} 委派 · ${task.due}</p><div class="eu-task"><strong>任务要求</strong><p>${task.instructions}</p></div>${locked?`<p class="eu-notice">${saved.state==='done'?'已完成':'已提交，等待店长审核'} · ${empEsc(saved.submittedAt||'')}</p>`:''}<form id="eu-assignment-form" data-task="${task.id}" data-kind="${task.kind}">${fields}<p class="eu-note">现金清点和应有金额分别记录，差额不为零时需说明原因。本机演示，不会写入正式门店账。</p>${locked?'<button class="ghost-btn eu-task-revise" type="button">补充 / 修改提交</button>':'<div class="eu-cols"><button type="button" class="ghost-btn eu-task-draft">保存草稿</button><button class="primary-btn" type="submit">提交任务</button></div>'}</form>${saved.history?.length?`<details class="eu-task"><summary>历史提交（${saved.history.length}）</summary>${saved.history.map(h=>`<p>${empEsc(h.at)} · 已保留上一版</p>`).join('')}</details>`:''}`;}
 const list=items.length?items.map(x=>`<article class="eu-assignment"><div class="eu-assignment-top"><span class="pill ${x.tone}">${x.pill}</span></div><h3>${empEsc(x.title)}</h3><p>${empEsc(x.meta)}</p><button class="ghost-btn" data-tab="${x.tab}">打开处理</button></article>`).join(''):'<p class="eu-note">目前没有等你处理的人事事项。</p>';
 return `<span class="eu-step">指派给我的待办</span><h2>我的任务</h2><p>这里只显示分配给你本人的事项：人事待办和点钞记账委派。</p><h3>人事待办</h3>${list}<h3>委派任务</h3>${tasks.map(t=>euTaskCard(t,d)).join('')}<p class="eu-note">点钞记账为演示委派，不代表门店真实待办；正式接入后只显示分配给本人的任务。</p>`;
}
function euTaskBind(){
 const draw=()=>app();
 document.querySelectorAll('.eu-task-open').forEach(b=>b.onclick=()=>{euSession.tab='tasks';euSession.task=b.dataset.task;draw();});
 document.querySelector('.eu-task-back')?.addEventListener('click',()=>{euSession.task=null;draw();});
 const form=document.querySelector('#eu-assignment-form');if(!form)return;
 const taskId=form.dataset.task,kind=form.dataset.kind;
 const cashTotal=()=>[...form.querySelectorAll('[data-denom]')].reduce((sum,input)=>sum+Number(input.dataset.denom)*Number(input.value||0),0);
 const update=()=>{if(kind!=='cash')return;form.querySelector('.eu-counted').textContent=`€${cashTotal().toFixed(2)}`;const diff=cashTotal()-Number(form.elements.expected.value||0);form.querySelector('.eu-cash-diff').textContent=`${diff>0?'+':''}€${diff.toFixed(2)}`;};
 if(kind==='cash'){form.addEventListener('input',update);update();}
 const save=(submit,button)=>{if(submit&&!form.reportValidity())return;const values=Object.fromEntries(new FormData(form));if(submit&&kind==='cash'&&Math.abs(cashTotal()-Number(values.expected))>.005&&!String(values.note||'').trim()){empFlash(button,euT('请填写现金差额原因'));return;}
 const d=euData(),old=d.assignedTasks?.[taskId]||{};const record={...old,values,state:submit?'submitted':'draft',updatedAt:empNow()};if(kind==='cash')record.counted=Math.round(cashTotal()*100)/100;if(submit){record.submittedAt=empNow();d.messages.unshift('任务已提交，等待审核');}d.assignedTasks={...(d.assignedTasks||{}),[taskId]:record};euSave(d);draw();};
 form.addEventListener('submit',ev=>{ev.preventDefault();save(true,ev.submitter);});
 form.querySelector('.eu-task-draft')?.addEventListener('click',ev=>save(false,ev.currentTarget));
 form.querySelector('.eu-task-revise')?.addEventListener('click',()=>{const d=euData(),old=d.assignedTasks[taskId];old.history=[{at:old.submittedAt,values:old.values},...(old.history||[])];old.state='draft';euSave(d);draw();});
}

function euCompactWeek(week,d){
 return `<div class="eu-week-head"><span>日期</span><span>上班</span><span>下班</span><span>工时</span></div>${week.map((day,i)=>{
 const working=i<5,tasks=day===empToday()?euAssignedTasks():[];
 return `<div class="eu-week-day ${day===empToday()?'is-today':''}"><div class="eu-week-line"><strong>${day.slice(5)} <small>周${'一二三四五六日'[i]}</small></strong>${working?'<span>10:00</span><span>18:00</span><b>7.5h</b>':'<span class="eu-week-rest">休息</span>'}</div>${tasks.length?`<div class="eu-week-tasks"><small>时段任务</small>${tasks.map(t=>`<button class="eu-task-open" data-task="${empEsc(t.id)}"><span>${empEsc(t.due)}</span><strong>${empEsc(t.title)}</strong><span>›</span></button>`).join('')}<small>任务时间独立显示，不额外计入班次工时。</small></div>`:''}</div>`;
 }).join('')}`;
}

function euHoursModel(d,month){
 const employee=d.employeeId?empById(d.employeeId):null,store=employee?.store||d.invitation?.store,run=store?payAll()[`${store}|${month}`]||{}:{};
 const model=employee?payCalendarDays(store,month,employee.id,run):{days:{},count:new Date(+month.slice(0,4),+month.slice(5),0).getDate()};
 const days=model.days;
 (d.hours||[]).filter(x=>x.date?.startsWith(month)).forEach(x=>{const existing=days[x.date]||[];if(existing.some(y=>y.punchStart===x.start&&y.punchEnd===x.end))return;(days[x.date]||=[]).push({type:'work',planStart:'',planEnd:'',punchStart:x.start,punchEnd:x.end,hours:Number(x.hours)||0,source:x.source});});
 let example=false;
 if(employee?.uiDemo&&!Object.keys(days).length){example=true;for(let day=1;day<=model.count;day++){const date=`${month}-${String(day).padStart(2,'0')}`,weekday=new Date(date+'T12:00:00').getDay();if(![0,6].includes(weekday)&&date<=empToday())days[date]=[{type:'work',planStart:'10:00',planEnd:'18:00',punchStart:day%3===0?'10:05':'09:57',punchEnd:'18:00',hours:day%3===0?7.25:7.5}];}}
 const values=Object.values(days).flat(),work=values.filter(x=>x.type==='work').reduce((n,x)=>n+Number(x.hours||0),0),leave=values.filter(x=>x.type!=='work').reduce((n,x)=>n+Number(x.hours||0),0);
 return {...model,example,work,leave,total:work+leave};
}
const EU_TRAVEL_KEY='kaispanEmployeeTravelExpensesV1';
function euTravelExpenses(d){
 const all=empRead(EU_TRAVEL_KEY,{}),records=Array.isArray(all[euSession.key])?all[euSession.key]:[];
 return `<section class="eu-travel-expenses"><div class="eu-travel-title"><div><span class="eu-step">REISEKOSTEN</span><div class="eu-travel-heading-line"><h2>差旅费</h2><details class="eu-contract-tip"><summary aria-label="差旅打卡核对说明">!</summary><div role="note"><strong>差旅与打卡</strong><p>出差记录应与员工的上班打卡日期、时间和地点相互核对。员工填写出差目的城市后，出差期间的打卡地点按该城市限制，并在打卡时提示员工。</p><small>本机演示尚未读取定位或实施城市限制，正式系统需接入定位及核对流程。</small></div></details></div></div><span class="eu-travel-count">${records.length} 条记录</span></div><p>出差后填写行程和费用，附上凭证并提交店长审核。</p>
 <details class="eu-travel-form-fold" ${euSession.travelOpen?'open':''}><summary>＋ 填写差旅费</summary><form id="eu-travel-form" novalidate><div class="eu-cols"><label>出发日期 *<input type="date" name="startDate"></label><label>返回日期 *<input type="date" name="endDate"></label></div><label>出差事由 *<input name="purpose" placeholder="例如：跨店支援、采购"></label><div class="eu-cols"><label>出发地 *<input name="origin" placeholder="城市或地址"></label><label>目的地 *<input name="destination" placeholder="城市或地址"></label></div><div class="eu-cols"><label>交通方式<select name="transport"><option>火车 / 公共交通</option><option>私人汽车</option><option>公司车辆</option><option>飞机</option><option>其他</option></select></label><label>行驶公里数<input type="number" name="kilometers" min="0" step="0.1" placeholder="选填"></label></div><div class="eu-cols"><label>出发时间<input type="time" name="startTime"></label><label>返回时间<input type="time" name="endTime"></label></div><div class="eu-cols"><label>费用类型<select name="category"><option>交通</option><option>住宿</option><option>餐饮</option><option>其他</option></select></label><label>申请报销金额 € *<input type="number" name="amount" min="0.01" step="0.01" placeholder="0.00"></label></div><label>费用说明<textarea name="note" rows="2" placeholder="例如：票价、住宿或其他费用"></textarea></label><label>凭证照片或 PDF<input type="file" name="receipt" accept="image/*,application/pdf"></label><p class="eu-note">凭证可选，最大 1 MB。金额先由员工填写，里程及餐费是否报销由店长核对；此处不自动计算税额或补贴。</p><p class="eu-travel-error" role="status"></p><div class="eu-travel-actions"><button type="submit" name="action" value="draft" class="ghost-btn">保存草稿</button><button type="submit" name="action" value="submit" class="primary-btn">提交审核</button></div></form></details>
 <div class="eu-travel-records"><h3>差旅费记录</h3>${records.length?records.map(r=>`<article class="eu-travel-record"><div class="eu-travel-record-head"><strong>${empEsc(r.purpose||'未填写事由')}</strong><span class="eu-travel-status ${r.status==='submitted'?'is-submitted':''}">${r.status==='submitted'?'待审核 · 演示':'草稿'}</span></div><p>${empEsc(r.startDate||'未填日期')}${r.endDate&&r.endDate!==r.startDate?' 至 '+empEsc(r.endDate):''} · ${empEsc(r.origin||'出发地')} → ${empEsc(r.destination||'目的地')}</p><p>${empEsc(r.category||'费用')} · €${(Number(r.amount)||0).toFixed(2)}${r.kilometers?' · '+empEsc(r.kilometers)+' km':''}</p>${r.receiptData?`<a href="${empEsc(r.receiptData)}" download="${empEsc(r.receiptName)}">查看凭证</a>`:''}${r.status==='draft'?`<button type="button" class="eu-travel-delete" data-id="${empEsc(r.id)}">删除草稿</button>`:''}</article>`).join(''):'<p class="eu-travel-empty">暂无差旅费记录</p>'}</div><p class="eu-note">本机演示：记录与凭证保存在此浏览器；提交只模拟待审核，不会发送通知或自动进入工资。</p></section>`;
}
function euBindTravelExpenses(){
 const form=document.querySelector('#eu-travel-form');if(!form)return;
 const key=EU_TRAVEL_KEY, identity=euSession.key;
 const write=records=>{const all=empRead(key,{});all[identity]=records;localStorage.setItem(key,JSON.stringify(all));};
 form.addEventListener('submit',async ev=>{ev.preventDefault();const f=new FormData(form),action=ev.submitter?.value||'submit',error=form.querySelector('.eu-travel-error');const values=Object.fromEntries([...f.entries()].filter(([k])=>k!=='receipt'));const file=form.querySelector('[name=receipt]').files[0];
  if(action==='submit'&&(!values.startDate||!values.endDate||!values.purpose.trim()||!values.origin.trim()||!values.destination.trim()||!(Number(values.amount)>0))){error.textContent='请填写出发和返回日期、事由、地点及报销金额。';return;}
  if(values.startDate&&values.endDate&&values.endDate<values.startDate){error.textContent='返回日期不能早于出发日期。';return;}
  if(file&&(!file.type.startsWith('image/')&&file.type!=='application/pdf')){error.textContent='凭证请选择照片或 PDF。';return;}
  if(file&&file.size>1024*1024){error.textContent='凭证不能超过 1 MB。';return;}
  let receiptData='';if(file){try{receiptData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}catch{error.textContent='凭证读取失败，请重试。';return;}}
  const records=empRead(key,{})[identity]||[];records.unshift({...values,id:Date.now().toString(36)+Math.random().toString(36).slice(2),status:action==='submit'?'submitted':'draft',receiptName:file?.name||'',receiptData,createdAt:empNow()});
  try{write(records);}catch{error.textContent='本机空间不足，未保存。请缩小凭证后重试。';return;}
  euSession.travelOpen=false;app();document.querySelector('.eu-travel-expenses')?.scrollIntoView({block:'start'});
 });
 document.querySelectorAll('.eu-travel-delete').forEach(button=>button.addEventListener('click',()=>{const records=empRead(key,{})[identity]||[];try{write(records.filter(r=>!(r.id===button.dataset.id&&r.status==='draft')));app();document.querySelector('.eu-travel-expenses')?.scrollIntoView({block:'start'});}catch{form.querySelector('.eu-travel-error').textContent='删除未保存，请重试。';}}));
}
function euMonthlyHours(d){
 const month=euSession.hoursMonth||empToday().slice(0,7),model=euHoursModel(d,month),result=d.monthConfirmations?.[month]||(month<empToday().slice(0,7)?{state:'confirmed',demo:true}:null),confirmed=result?.state==='confirmed',offset=(new Date(month+'-01T12:00:00').getDay()+6)%7;
 return `<span class="eu-step">我的工时</span><div class="eu-hours-heading"><h2>月度工时核对</h2><label>选择月份<input class="eu-hours-month" type="month" value="${month}" max="${empToday().slice(0,7)}"></label></div>${result?`<p class="eu-notice">${result.state==='confirmed'?'本月工时已确认':'异议已提交，等待店长核对'}${result.message?' · '+empEsc(result.message):''}</p>`:'<p class="eu-note">本月工时待本人核对确认</p>'}<div class="eu-shift"><small>${month} · 本月核对工时${model.example?' · 演示案例':''}</small><button class="eu-month-total" type="button" aria-label="查看 ${month} 每日工时日历">${model.total.toFixed(2)} <small>h ›</small></button><p>工作 ${model.work.toFixed(2)}h · 带薪休假 / 病假 ${model.leave.toFixed(2)}h</p><span>点击总工时，逐日对照计划与实际打卡</span></div><p class="eu-note">${model.example?'当前为演示明细，不写入真实考勤。':'按本人记录展示；无打卡的日期不会虚构实际工时。'} 员工可核对和反馈，时间调整由店长处理。</p>${confirmed?`<button type="button" class="primary-btn eu-download-payslip">下载 ${month} 工资单</button><p class="eu-note">已确认月份可下载工资单；未提供原件时，演示下载带有 DEMO 标识的示例 PDF。</p>`:'<button type="button" class="ghost-btn eu-confirm-hours">工时无误，提交确认</button>'}${confirmed?'':`<form id="eu-dispute" class="eu-hours-note"><label>有异议？填写备注<textarea name="message" rows="2" placeholder="说明需要核对的日期和时间" required></textarea></label><div class="eu-hours-note-actions"><button type="submit" class="ghost-btn">发送</button></div></form>`}<dialog id="eu-hours-calendar" class="pay-travel-dialog eu-hours-calendar" aria-label="月度工时日历"><header class="pay-travel-head"><div><h2>${month} · 每日工时</h2><p>计划与打卡并列查看 · ${model.example?'演示数据':'本人记录'}</p></div><button type="button" class="ghost-btn eu-calendar-close" aria-label="关闭工时日历">×</button></header><div class="pay-calendar-body"><div class="pay-calendar-grid">${['一','二','三','四','五','六','日'].map(x=>`<strong class="pay-calendar-week">周${x}</strong>`).join('')}${'<div></div>'.repeat(offset)}${Array.from({length:model.count},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0'),entries=model.days[date]||[];return `<div class="pay-calendar-day"><strong>${i+1}</strong>${entries.length?entries.map(x=>`<div class="pay-calendar-shift is-${empEsc(x.type)}"><strong>${x.type==='urlaub'?'年假':x.type==='krank'?'病假':'正常上班'}</strong>${x.type==='work'?`<div class="pay-calendar-time"><small>计划</small>${x.planStart?empEsc(x.planStart)+'–'+empEsc(x.planEnd):'无计划记录'}</div><div class="pay-calendar-time"><small>打卡</small>${x.punchStart||x.punchEnd?empEsc(x.punchStart||'缺上班卡')+'–'+empEsc(x.punchEnd||'缺下班卡'):'未打卡'}</div>`:''}<b>${Number(x.hours||0).toFixed(2)}h ${x.type==='work'?'核对工时':'计薪'}</b></div>`).join(''):'<small class="pay-calendar-empty">无记录</small>'}</div>`;}).join('')}</div></div></dialog>`;
}

function euAvailabilityWeek(week){return week.map(day=>{const date=new Date(day+'T12:00:00');date.setDate(date.getDate()+7);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;});}
function euWeeklyAvailability(d,week){const dates=euAvailabilityWeek(week);return `<p>下周 ${dates[0]} — ${dates[6]}，每天选择是否报班；报班时填写可用时段。</p><form id="eu-weekly-availability">${dates.map((date,i)=>{const saved=d.availabilityDraft?.[date]||(d.availability||[]).find(x=>x.date===date)||{},status=saved.choice!==undefined?saved.choice:saved.available===false?'no':saved.available===true||saved.start?'yes':'';return `<section class="eu-availability-day" data-date="${date}"><div class="eu-availability-day-head"><strong>${date.slice(5)} · 周${'一二三四五六日'[i]}</strong><select name="${date}-available" data-av="available" aria-label="${date} 是否报班"><option value="">请选择</option><option value="yes" ${status==='yes'?'selected':''}>报班</option><option value="no" ${status==='no'?'selected':''}>不报班</option></select></div><div class="eu-availability-times" ${status==='yes'?'':'hidden'}><div class="eu-cols"><label>从<input type="time" data-av="start" value="${empEsc(saved.start||'10:00')}" ${status==='yes'?'required':'disabled'} aria-label="${date} 开始时间"></label><label>到<input type="time" data-av="end" value="${empEsc(saved.end||'18:00')}" ${status==='yes'?'required':'disabled'} aria-label="${date} 结束时间"></label></div><label>备注<input data-av="note" value="${empEsc(saved.note||'')}" placeholder="例如：只能上早班" ${status==='yes'?'':'disabled'} aria-label="${date} 备注"></label></div></section>`;}).join('')}<p class="eu-note">未选择的日期不提交；不报班的日期会明确告知店长。时间为可用意向，不等于正式排班。</p><p class="eu-availability-feedback" role="status"></p><button type="submit" class="primary-btn">提交本周填写的报班意向</button></form>${d.availabilitySubmittedAt?`<p class="eu-notice">报班意向已提交，等待店长安排。</p>`:''}`;}
function euBindWeeklyAvailability(){const form=document.querySelector('#eu-weekly-availability');if(!form)return;
 const read=row=>{const get=key=>row.querySelector(`[data-av="${key}"]`).value;return {date:row.dataset.date,available:get('available')==='yes',choice:get('available'),start:get('start'),end:get('end'),note:get('note')};};
 form.addEventListener('input',ev=>{const row=ev.target.closest('[data-date]');if(!row)return;const d=euData();d.availabilityDraft={...d.availabilityDraft,[row.dataset.date]:read(row)};euSave(d);});
 form.querySelectorAll('[data-av="available"]').forEach(select=>select.addEventListener('change',()=>{const row=select.closest('[data-date]'),on=select.value==='yes';row.querySelector('.eu-availability-times').hidden=!on;row.querySelectorAll('input').forEach(input=>{input.disabled=!on;input.required=on&&input.type==='time';});const d=euData();d.availabilityDraft={...d.availabilityDraft,[row.dataset.date]:read(row)};euSave(d);}));
 form.addEventListener('submit',ev=>{ev.preventDefault();const rows=[...form.querySelectorAll('[data-date]')].map(read).filter(x=>x.choice),feedback=form.querySelector('.eu-availability-feedback');if(!rows.length){feedback.textContent='请至少选择一天报班或不报班。';return;}const bad=rows.find(x=>x.available&&(!x.start||!x.end||x.end<=x.start));if(bad){feedback.textContent=bad.date+'：结束时间需晚于开始时间。';return;}const d=euData(),dates=new Set(rows.map(x=>x.date));d.availabilityHistory=[{at:empNow(),previous:(d.availability||[]).filter(x=>dates.has(x.date))},...(d.availabilityHistory||[])];d.availability=[...rows.map(({choice,...x})=>({...x,start:x.available?x.start:'',end:x.available?x.end:'',state:'pending',submittedAt:empNow()})),...(d.availability||[]).filter(x=>!dates.has(x.date))];d.availabilitySubmittedAt=empNow();euSave(d);feedback.textContent='报班意向已提交，等待店长安排。';});
}

function euDownloadPayslip(d,month){
 const employee=d.employeeId?empById(d.employeeId):null,store=employee?.store||d.invitation?.store,slip=store?payAll()[payKey(store,month)]?.slips?.[d.employeeId]:null;
 let url=slip?.dataUrl||(slip?.ref?empFileUrl(slip.ref):''),generated=false;
 if(!url){const model=euHoursModel(d,month);url=URL.createObjectURL(new Blob([payDemoPdfBytes(d.name||'Employee',month,{gross:slip?.gross??2800,net:slip?.net??1900,hours:slip?.hours??model.total})],{type:'application/pdf'}));generated=true;}
 const link=document.createElement('a');link.href=url;link.download=generated?`DEMO_Lohnabrechnung_${month}.pdf`:(slip?.file||`Lohnabrechnung_${month}.pdf`);document.body.appendChild(link);link.click();link.remove();if(generated)setTimeout(()=>URL.revokeObjectURL(url),3000);
}


function euDocExpiryFields(d,t){if(!t?.expires)return '';const p=d.profile||{},key=t.key,choice=p[key+'HasExpiry']||(p[key+'Expiry']?'yes':'');return `<label><span>有效期至${euRequiredStar()}</span><input class="eu-profile-field" data-profile="${key}Expiry" type="date" value="${empEsc(p[key+'Expiry']||'')}"></label><small>所有证件都要填写截止日期，请按材料填写完整年月日。</small>`;}

function euExpiryMissing(d){return euDocumentList(d).filter(t=>t.expires&&d.docs[t.key]).flatMap(t=>{const p=d.profile||{};return empValidExpiry(p[t.key+'Expiry'])?[]:[t.label+'有效期（年月日）'];});}

function euContractReleased(d){const e=euEmployee(d);return !!(e?.invite?.state==='approved'&&e.invite.contractSentAt);}
function euContractFile(d,key){
 const inv=euInvite(d),file=key==='contract'?inv.contractTemplate:inv.questionnaireTemplate;
 if(file?.dataUrl||file?.data||file?.url)return file;
 if(euDemo()){const name=key==='contract'?'Arbeitsvertrag-demo.html':'Personalfragebogen-demo.html',title=key==='contract'?'劳动合同':'个人调查问卷';return {name,dataUrl:'data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta charset="utf-8"><h1>'+title+'（演示）</h1><p>演示示例，并非正式文件。</p><p>填写并签字：________________</p>')};}
 return null;
}
/* 每份单独核对：待上传 / 已上传待核对 / 已通过 / 已退回（只重传被退回的那份，HR-ONB-36） */
function euContractArchiveDoc(d,key){return (euEmployee(d)?.docs||{})[EU_EMPLOYEE_DOC_MAP[key]]||null;}
/* 是否有本机新上传的版本：旧记录缺退回时间时，用档案里旧件的上传时间当锚点，旧件本身不算重传（HR-ONB-53）。 */
function euContractFreshUpload(d,key,status){
 const doc=d.docs?.[key],anchor=status?.at||euContractArchiveDoc(d,key)?.at||'';
 return !!doc&&doc.source!=='archive'&&!doc.legacyNoFile&&!!doc.at&&euContractFileCurrent(d,key,doc)&&(!anchor||String(doc.at)>String(anchor));
}
function euContractStatus(d,key){
 const inv=euInvite(d),demo=euDemo(),review=(inv.contractReview||{})[key];
 const doc=d.docs?.[key];
 /* 本机旧发送的签回草稿不能显示成“已上传/已通过”，必须重新上传当前发送的版本（HR-ONB-37/53）。 */
 const localDoc=!!doc&&doc.source!=='archive',stale=localDoc&&!euContractFileCurrent(d,key,doc)&&(!!inv.dispatchId||!!inv.contractSentAt);
 const dispatchMismatch=!!(inv.dispatchId&&doc?.dispatchId&&String(doc.dispatchId)!==String(inv.dispatchId));
 /* 重传后新版本比退回记录新，就按新版本状态算，旧 returned 不再盖住新文件（HR-ONB-53） */
 const anchor=review?.at||euContractArchiveDoc(d,key)?.at||'';
 const newer=!!(doc?.at&&anchor&&String(doc.at)>String(anchor));
 if(dispatchMismatch)return {state:'missing',stale:true};
 if(review?.state==='returned'&&!newer)return {state:'returned',reason:review.reason||'',at:anchor};
 if(stale)return {state:'missing',stale:true};
 if(review?.state==='approved')return {state:'approved'};
 if(demo==='contract-returned'&&key==='questionnaire')return {state:'returned',reason:inv.contractReturnReason||'演示：问卷第 3 页缺本人签字'};
 if(Array.isArray(inv.returnedItems)&&inv.returnedItems.includes(key)&&!newer)return {state:'returned',reason:inv.contractReturnReason||inv.returnNote||'',at:anchor||inv.reviewedAt||''};
 if(inv.returnedContractItems&&inv.returnedContractItems[key]&&!newer)return {state:'returned',reason:inv.contractReturnReason||inv.returnNote||'',at:anchor||inv.reviewedAt||''};
 if(doc?.state==='returned'&&!newer)return {state:'returned',reason:doc.reason||'',at:doc.reviewedAt||anchor};
 if(inv.contractSignedSubmittedAt)return {state:'submitted'};
 if(doc)return {state:'uploaded'};
 return {state:'missing'};
}
function euContractPanel(d){
 const inv=euInvite(d),offline=euContractOffline(d),stage=euStage(d),archived=euContractArchived(d)||stage==='archived',sent=euContractSent(d);
 if(offline&&archived)return `<section class="eu-task eu-contract"><h3>合同与问卷</h3><p class="eu-offline-tag">已归档（线下签署）</p><p>公司已上传双方签字的劳动合同和个人问卷扫描件，不需要你在线签字。</p><button type="button" class="primary-btn eu-finish-onboarding">进入员工工作台</button></section>`;
 if(archived){
  const veteran=!!inv.veteranConfirmedAt||inv.fillMode==='veteran';
   return `<section class="eu-task eu-contract"><h3>入职已完成</h3><p>${euT(veteran?'在岗老员工开通：资料确认完成，不需要审核和合同；缺的资料会进入“关键资料缺失”提醒。':'资料和签署文件已核对归档，现可进入员工工作台。')}</p><button type="button" class="primary-btn eu-finish-onboarding">进入员工工作台</button></section>`;
 }
 if(!sent)return `<section class="eu-task eu-contract"><h3>${stage==='approved'?'等待公司发送合同':'等待资料审核'}</h3><p>${stage==='approved'?'资料已审核通过，公司会发劳动合同和个人调查问卷（两份一起发）。':'资料提交后由店长审核；通过后公司发劳动合同和个人调查问卷。'}</p><small>提交资料 → 店长审核 → 公司发合同与问卷 → 你签字上传 → 店长核对归档</small></section>`;
 /* 一期固定两份一起发；旧记录缺 onboardingFilesVersion 也按两份，避免问卷不显示又要求两份（HR-ONB-36） */
 const dual=true;
 const item=(key,title,uploadLabel)=>{
  const status=euContractStatus(d,key),file=euContractFile(d,key);
  const text=status.stale?'旧版本，请重新上传':({missing:'尚未上传',uploaded:'已上传，等待店长核对',submitted:'已交回，等待店长核对',approved:'已通过核对',returned:'被退回，请重传这一份'}[status.state]||'');
  return `<div class="eu-contract-file is-${status.state}"><div><strong>${title}</strong><small>${text}</small>${status.state==='returned'&&status.reason?`<small class="eu-reason">退回原因：${empEsc(status.reason)}</small>`:''}</div><div class="eu-contract-actions">${status.stale?'<button type="button" class="ghost-btn" disabled>旧版本不可下载</button>':file?`<a class="ghost-btn" href="${empEsc(file.dataUrl||file.data||file.url)}" download="${empEsc(file.name)}">下载${title}</a>`:'<button type="button" class="ghost-btn" disabled>暂不可下载</button>'}${status.state==='approved'?'<span class="eu-flag is-approved">已通过核对</span>':status.state==='submitted'?'<span class="eu-flag is-pending">待核对</span>':`<label class="ghost-btn eu-upload">${status.state==='returned'||status.stale?'重传':'上传'}${uploadLabel}<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" data-doc="${key}" aria-label="上传${uploadLabel}" hidden></label>`}</div></div>`;
 };
 return `<section class="eu-task eu-contract"><h3>填写并签署入职文件 ${euContractEmailTip()}</h3><p>两份文件一起下载、签字、上传；两份都传才算签回。被退回时只重传被退回的那一份。</p>${item('contract','劳动合同','已签署劳动合同')}${dual?item('questionnaire','个人调查问卷','已填写并签署的个人调查问卷'):''}</p><p class="eu-validation" role="status"></p><button type="button" class="primary-btn eu-contract-signed-submit">提交签署文件</button>${inv.contractSignedSubmittedAt||d.contractSignedSubmittedAt?'<p class="eu-notice">签署文件已提交，等待店长核对。核对归档后完成入职。</p>':''}</section>`;
}

function euExpiryNotices(d){const e=d.employeeId?empById(d.employeeId):null;if(!e||typeof empAlertsFor!=='function')return [];return empAlertsFor(e,empToday()).filter(a=>a.kind==='doc'&&['expired','warn','soon','date_missing'].includes(a.level)).map(a=>{const hygiene=a.type.id==='belehrung';return {title:hygiene?'健康证 / 食品卫生培训提醒':a.title+' · 有效期提醒',message:a.level==='date_missing'?'请补充材料截止日期（年月日）。':hygiene?`截止日期 ${a.date}，${a.level==='expired'?'已到期':a.days===0?'今天到期':'即将到期'}；请联系店长安排继续培训，完成后提交新证明与截止日期。`:`有效期至 ${a.date}，${a.level==='expired'?'已过期':a.days===0?'今天到期':'即将到期'}；请及时更新材料并填写新的有效期。`};});}

function euIdentityError(kind,value){const raw=String(value||'').trim();if(!raw)return '';const compact=raw.replace(/[\s-]/g,'').toUpperCase();if(kind==='steuerId')return /^\d{11}$/.test(compact)?'':'请输入 11 位数字，空格可省略。';return /^\d{8}[A-Z]\d{3}$/.test(compact)?'':'请输入 12 位，第 9 位为字母，其余为数字。';}
function euBindIdentityHints(scope){scope.querySelectorAll('[data-id-kind]').forEach(input=>{if(input.dataset.idHintBound)return;input.dataset.idHintBound='1';const refresh=()=>{const error=euIdentityError(input.dataset.idKind,input.value),box=input.parentElement.querySelector('.eu-id-error');if(box)box.textContent=error?euT(error):'';input.setAttribute('aria-invalid',error?'true':'false');};input.addEventListener('input',refresh);refresh();});}

function euContractEmailTip(){return `<details class="eu-contract-tip"><summary aria-label="劳动合同：工作邮箱与通知渠道说明">!</summary><div role="note"><strong>合同条款建议 · 工作邮箱与通知</strong><p>公司为员工分配 KaiSpan 工作邮箱【员工邮箱】，并告知官方登录入口【登录地址】。该邮箱作为工作相关通知的官方渠道；员工应在合理工作时间内定期登录查看，并及时向公司报告无法登录、收取异常或其他邮箱问题，以便通过其他适当方式联系。</p><p>公司应确保员工能够访问邮箱，保留发送和投递记录；通知是否有效送达，以适用法律和实际送达情况为准。法律要求特定形式的文件，仍按法定方式送达。</p><small>合同条款草案，正式使用前请由德国劳动法律师审核。</small></div></details>`;}


/* ===== 入职后：我的资料（HR-ONB-43/44、HR-DOC-20） ===== */
/* 本机草稿的请求与店长写入 employeePortal 的核对结果合并：店长退回时以店长结果为准（HR-ONB-43） */
function euUpdateRequest(d){
 const portal=euEmployee(d)?.employeePortal?.updateRequest||null,local=d.updateRequest||null;
 /* 店长写入门户的结果优先；本地只在还没发布时兜底，避免采纳后本地 returned/pending 复活（HR-ONB-43）。 */
 const req=portal||local;
 return req&&req.state!=='done'?req:null;
}
/* 补件请求：店长端 e.request（topup）与员工端演示字段都认（HR-ONB-44） */
function euSupplementRequest(d){
 const e=euEmployee(d);
 const portal=e?.employeePortal?.supplementRequest||null,top=e?.request||null;
 const closed=r=>!!r&&['done','cancelled','withdrawn','accepted'].includes(r.state);
 const openPortal=portal&&!closed(portal);
 /* e.request 是老板端 topup 的主记录：已处理完就不再展示；只有老板后来又发了新请求才用新记录。 */
 if(top&&closed(top)){
  if(!openPortal)return null;
  if(String(portal.at||portal.sentAt||'')>String(top.sentAt||top.at||top.doneAt||''))return {...portal,state:portal.state==='submitted'?'submitted':'open',requestId:euSupplementRequestId(portal)};
  return null;
 }
 const raw=top?{...top,state:top.state==='submitted'?'submitted':'open',items:top.items||[],requestId:euSupplementRequestId(top)}
  :(portal||e?.supplementRequest||e?.invite?.supplementRequest||d.supplementRequest||null);
 if(!raw||closed(raw))return null;
 return {...raw,requestId:euSupplementRequestId(raw)};
}
/* 补件交回的旧投影在店长已采纳/退回后立即失效，读取和写入都以管理端结果为准。 */
function euSupplementSubmissionStale(e){
 const top=e?.request,sub=e?.employeePortal?.supplementSubmission;
 if(!top||!sub)return false;
 /* 只比较两边都明确写出的请求 ID；旧记录的 at 不能当 ID 用，否则会把当前交回误判成旧件。 */
 const topId=String(top.requestId||top.token||''),subId=String(sub.requestId||'');
 if(topId&&subId&&topId!==subId)return true;
 if(['done','cancelled','withdrawn','accepted'].includes(top.state))return true;
 if(top.returnedAt&&(!top.submittedAt||String(top.submittedAt)<=String(top.returnedAt)))return true;
 return false;
}
function euSupplementEntry(x){if(typeof x==='string')return {key:x};const key=x?.key||x?.id||x?.path||'';return {...x,key};}
function euSupplementProfileKey(key){const hit=Object.entries(EU_EMPLOYEE_PROFILE_MAP).find(([,path])=>path===key);return hit?hit[0]:key;}
/* 店长补件项目可能来自老板端 e.request（带 kind/id/path），按当前材料清单翻成中文名 */
function euSupplementLabel(d,x){
 if(typeof x==='string')return x;
 if(x.label||x.name)return x.label||x.name;
 const key=x.key||x.id||x.path||'';
 const docKey=Object.keys(EU_EMPLOYEE_DOC_MAP).find(k=>k===key||EU_EMPLOYEE_DOC_MAP[k]===key);
 if(docKey&&d){const hit=euDocumentList(d).find(t=>t.key===docKey);if(hit)return hit.label;}
 const fieldKey=euSupplementProfileKey(key),field=EU_UPDATE_FIELDS.find(([k])=>k===fieldKey);
 return field?field[1]:key;
}
function euSupplementLabels(sup,d){return (sup?.items||[]).map(x=>euSupplementLabel(d,x)).filter(Boolean);}
/* 补件交回：按店长列的项逐项核对，新文件版本或字段值必须已经准备好；空交不算（HR-ONB-44、HR-DOC-20） */
function euSupplementSubmission(d,sup){
 const entries=(sup?.items||[]).map(euSupplementEntry).filter(x=>x.key);
 const sub={requestId:euSupplementRequestId(sup),docs:{},contact:{},ids:{}},missing=[];
 /* 店长请求时间以 sentAt 为准（empSendRequest 写的是 sentAt）；旧演示字段才退回 at。 */
 const askedAt=String(sup?.sentAt||sup?.at||'');
 const validDate=value=>typeof empValidExpiry==='function'?empValidExpiry(value):/^\d{4}-\d{2}-\d{2}$/.test(value||'');
 for(const item of entries){
  const docKey=Object.keys(EU_EMPLOYEE_DOC_MAP).find(k=>k===item.key||EU_EMPLOYEE_DOC_MAP[k]===item.key);
  if(docKey){
   const t=euDocumentList(d).find(x=>x.key===docKey)||{key:docKey,label:euSupplementLabel(d,item),expires:['passport','visa','zusatz','student','hygiene'].includes(docKey)};
   const pending=d.updateDraft?.docs?.[docKey],uploaded=d.docs?.[docKey];
   /* 旧档案件和“档案已记录、无原件”都不能冒充本次补交；必须有本次上传时间且晚于店长请求。 */
   const fresh=file=>!!file&&file.source!=='archive'&&!file.legacyNoFile&&!!file.at&&(!askedAt||String(file.at)>askedAt);
   const file=fresh(pending)?pending:fresh(uploaded)?uploaded:null;
   if(!file){missing.push(euSupplementLabel(d,item));continue;}
   let expiry='';
   const keep=!!d.updateDraft?.keepExpiry?.[docKey],reason=String(d.updateDraft?.keepReason?.[docKey]||'').trim();
   if(t.expires){
    expiry=keep?((d.profile||{})[docKey+'Expiry']||file.oldExpiry||''):euUpdateValue(d,docKey+'Expiry');
    if(keep&&!reason){missing.push(t.label+'：保留原日期须写原因');continue;}
    if(!validDate(expiry)){missing.push(t.label+'有效期（年月日）');continue;}
   }
   const docId=EU_EMPLOYEE_DOC_MAP[docKey];
   sub.docs[docId]={state:'ok',file:file.name,dataUrl:file.data||file.ref||null,expiry,noExpiry:false,at:file.at||empNow(),keepExpiry:keep,keepReason:keep?reason:''};
   continue;
  }
  const key=euSupplementProfileKey(item.key||item.path||''),path=EU_EMPLOYEE_PROFILE_MAP[key];
  const draft=euDraftProfile(d),value=draft[key]!==undefined?draft[key]:((d.profile||{})[key]||'');
  if(!path||!String(value||'').trim()){missing.push(euSupplementLabel(d,item));continue;}
  if(path==='birthday')sub.birthday=value;else empSetPath(sub,path,value);
 }
 return {entries,sub,missing};
}
/* 补件交回这一轮的提交 ID：老板退回后旧 ID 已进 closedRequestIds，必须换新，
   否则发布会被当成终态重放丢弃；首次交回仍沿用店长这次请求的 ID（HR-ONB-43/44）。 */
function euSupplementSubmissionFor(d,sup){
 const result=euSupplementSubmission(d,sup),e=euEmployee(d);
 if(!euDemo()&&e&&euRequestClosed(e,result.sub.requestId))result.sub.requestId=euRequestId('topup');
 return result;
}
/* 把交回写进老板端 e.request：先冻结提交，再同步这一轮的 requestId。 */
function euPushSupplementReturn(d,sub){
 const e=euEmployee(d);if(euDemo()||!e?.request||e.request.state==='done')return null;
 if(typeof empSaveRequestDraft==='function')empSaveRequestDraft(e.request.token,sub);
 if(typeof empSubmitRequest==='function')empSubmitRequest(e.request.token);
 if(typeof empById==='function'&&typeof empSaveStaff==='function'){
  const latest=empById(e.id);
  if(latest?.request&&String(latest.request.requestId||'')!==String(sub.requestId))empSaveStaff({...latest,request:{...latest.request,requestId:sub.requestId}});
 }
 return e.id;
}
function euDaysFrom(date,days){const dt=new Date(date+'T12:00:00');dt.setDate(dt.getDate()+days);return dt.toISOString().slice(0,10);}
/* 日期格式跟界面语言走，避免德语界面里混出“12 月 1 日”。 */
function euMonthDay(date){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');if(!m)return '';const lang=typeof euLang==='function'?euLang():'zh';
 if(lang==='de')return `${Number(m[3])}.${Number(m[2])}.${m[1]}`;
 if(lang==='zh')return `${Number(m[2])} 月 ${Number(m[3])} 日`;
 return `${Number(m[3])} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m[2])-1]} ${m[1]}`;}
function euAccept(t){return t?.imageOnly?'image/png,image/jpeg':'.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';}

const EU_UPDATE_FIELDS=[['first','名','text'],['last','姓','text'],['birthday','出生日期','date'],['phone','电话','tel'],['street','街道','text'],['houseNo','门牌号','text'],['zip','邮编','text'],['city','城市','text'],['country','居住国家','text'],['emergencyName','紧急联系人姓名','text'],['emergencyPhone','紧急联系人电话','tel'],['steuerId','Steuer-ID（个人税务识别号）','text'],['rentenversicherung','Sozialversicherungsnummer（社会保险号）','text'],['iban','IBAN','text'],['krankenkasse','医保公司','text'],['healthCardNumber','医保卡号','text']];
function euDraftProfile(d){return d.updateDraft?.profile||{};}
/* 资料页展示用视图：国籍/学生以 updateDraft 为准，材料清单也跟着草稿变。 */
function euUpdateView(d){const draft=euDraftProfile(d);if(!Object.keys(draft).length)return d;const profile={...(d.profile||{})};['nationalityClass','student'].forEach(key=>{if(draft[key]!==undefined)profile[key]=draft[key];});return {...d,profile};}
function euUpdateValue(d,key){const draft=euDraftProfile(d);return draft[key]!==undefined?draft[key]:((d.profile||{})[key]||'');}
function euUpdateChanged(d,key){const draft=euDraftProfile(d);return draft[key]!==undefined&&String(draft[key]||'')!==String((d.profile||{})[key]||'');}
function euUpdateField(d,key,label,type){
 const changed=euUpdateChanged(d,key),old=(d.profile||{})[key]||'';
 return `<label class="eu-update-row${changed?' is-changed':''}"><span>${label}${changed?'<span class="eu-flag is-pending">待核对</span>':''}</span><input class="eu-update-field" data-update="${key}" type="${type}" value="${empEsc(euUpdateValue(d,key))}">${changed?`<small class="eu-old-value">原值：${empEsc(old||'（空）')}</small>`:''}</label>`;
}
function euUpdateSelect(d,key,label,options,keepNative){
 const changed=euUpdateChanged(d,key),old=(d.profile||{})[key]||'',value=euUpdateValue(d,key);
 return `<label class="eu-update-row${changed?' is-changed':''}"><span>${label}${changed?'<span class="eu-flag is-pending">待核对</span>':''}</span><select class="eu-update-field" data-update="${key}" ${keepNative?'data-no-translate':''}>${options.map(([v,l])=>`<option value="${v}" ${value===v?'selected':''}>${l}</option>`).join('')}</select>${changed?`<small class="eu-old-value">原值：${empEsc(old||'（空）')}</small>`:''}</label>`;
}
function euUpdateForm(d){
 return `<h3>个人信息</h3><div class="eu-profile-form"><div class="eu-cols">${euUpdateField(d,'first','名','text')}${euUpdateField(d,'last','姓','text')}</div>${euUpdateField(d,'birthday','出生日期','date')}${euUpdateField(d,'phone','电话','tel')}<div class="eu-cols">${euUpdateField(d,'street','街道','text')}${euUpdateField(d,'houseNo','门牌号','text')}${euUpdateField(d,'zip','邮编','text')}${euUpdateField(d,'city','城市','text')}</div>${euUpdateField(d,'country','居住国家','text')}<div class="eu-cols">${euUpdateField(d,'emergencyName','紧急联系人姓名','text')}${euUpdateField(d,'emergencyPhone','紧急联系人电话','tel')}</div>${euUpdateSelect(d,'language','沟通语言',euLanguages().map(([value,code,label])=>[value,label]),true)}${euUpdateSelect(d,'nationalityClass','国籍类别',[['','请选择'],['eu','欧盟、欧洲经济区或瑞士公民'],['other','其他国籍']])}${euUpdateSelect(d,'student','是否学生',[['','请选择'],['yes','是'],['no','否']])}</div>
 <h3>税号、社保与银行</h3><div class="eu-profile-form">${euUpdateField(d,'steuerId','Steuer-ID（个人税务识别号）','text')}${euUpdateField(d,'rentenversicherung','Sozialversicherungsnummer（社会保险号）','text')}${euUpdateField(d,'iban','IBAN','text')}${euUpdateField(d,'krankenkasse','医保公司','text')}${euUpdateField(d,'healthCardNumber','医保卡号','text')}</div>`;
}
function euUpdateDocRow(d,t){
 const key=t.key,formal=d.docs?.[key],pending=d.updateDraft?.docs?.[key],changed=!!pending,oldExpiry=(d.profile||{})[key+'Expiry']||'';
 const expiry=d.updateDraft?.profile?.[key+'Expiry']||'';
 const flags=[changed?'<span class="eu-flag is-pending">待核对</span>':''].filter(Boolean).join('');
 return `<div class="eu-doc${changed?' is-changed':''}"><div><strong>${euT(t.label)}${flags}</strong><small>现行：${formal?empEsc(formal.name):'未上传'}${t.expires&&formal?` · 有效期至 ${empEsc(oldExpiry||'待补充')}`:''}</small>${changed?`<small>新文件：${empEsc(pending.name)}</small>`:''}${t.expires?`<label><span>新版本有效期至${euRequiredStar()}</span><input class="eu-update-expiry" data-doc-expiry="${key}" type="date" value="${empEsc(expiry)}"></label>${changed&&oldExpiry?`<label class="eu-keep-date"><input type="checkbox" data-keep-expiry="${key}" ${d.updateDraft?.keepExpiry?.[key]?'checked':''}> 保留原日期 ${empEsc(oldExpiry)}（须写原因）</label>${d.updateDraft?.keepExpiry?.[key]?`<input class="eu-keep-reason" data-keep-reason="${key}" placeholder="写保留原日期的原因" value="${empEsc(d.updateDraft?.keepReason?.[key]||'')}">`:''}`:''}`:''}</div><div class="eu-doc-actions"><label class="ghost-btn eu-upload">${changed?'更换':'替换 / 上传'}<input type="file" accept="${euAccept(t)}" data-doc-update="${key}" hidden></label>${changed?`<button type="button" class="eu-delete" data-doc-cancel="${key}" aria-label="取消待核对的${t.label}">×</button>`:''}</div></div>`;
}
function euDocsTab(d){
 const sup=euSupplementRequest(d),update=euUpdateRequest(d),stage=euStage(d);
 const view=euUpdateView(d);
 const supSubmitted=sup?.state==='submitted';
 const supBlock=sup?`<section class="eu-supplement"><strong>店长要求补交材料</strong><p>要补的项目：</p><div class="eu-flags">${euSupplementLabels(sup,d).map(l=>`<span class="eu-flag">${empEsc(l)}</span>`).join('')}</div>${sup.note?`<p class="eu-note">店长说明：${empEsc(sup.note)}</p>`:''}${supSubmitted?'':`<button type="button" class="ghost-btn eu-supplement-return">已补交，交回店长核对</button>`}${d.supplementReturnedAt||supSubmitted?`<p class="eu-notice">已于 ${empEsc(d.supplementReturnedAt||sup.submittedAt||'')} 交回，等待店长核对。</p>`:''}</section>`:'';
 const updateBlock=update?`<section class="eu-update-request"><strong>${update.state==='returned'?'资料修改被退回':'资料修改待店长核对'}</strong>${update.state==='returned'&&update.reason?`<p>退回原因：${empEsc(update.reason)}</p>`:''}<p>提交时间：${empEsc(update.at||'')} · 共 ${(update.items||[]).length} 项</p>${(update.items||[]).length?`<ul class="eu-update-items">${update.items.map(x=>`<li><strong>${empEsc(x.label)}</strong>：${empEsc(x.from||'（空）')} → ${empEsc(x.to||'（空）')}</li>`).join('')}</ul>`:''}<p class="eu-note">核对期间正式档案保持原值；店长采纳后才写入正式档案。</p>${update.state==='pending'?`<button type="button" class="ghost-btn eu-update-withdraw">撤回这次修改</button><div class="eu-cols"><button type="button" class="ghost-btn eu-update-adopt">演示：店长已采纳</button><button type="button" class="ghost-btn eu-update-reject">演示：店长退回</button></div>`:''}</section>`:'';
 const changed=euUpdateChangedList(d);
 return `<span class="eu-step">我的资料</span><h2>个人资料与入职材料</h2><p>${euT(stage==='archived'?'入职已完成，可在这里更新个人资料与材料。':'入职审核已通过，可在这里更新个人资料与材料。')}修改后先提交给店长核对，采纳后才写入正式档案。</p>
 ${supBlock}${updateBlock}
 ${euContractPanel(d)}
 <h3>修改资料</h3><p class="eu-note">只改需要改的项，其他保持不填。改动的地方会标“待核对”，并显示原值。</p>${euUpdateForm(d)}
 <h3>证件与文件</h3>${euDocumentIdentity(view,'update')}${euDocumentList(view).map(t=>euUpdateDocRow(d,t)).join('')}
 <p class="eu-validation" role="status"></p>
 <div class="eu-submit-actions"><button type="button" class="primary-btn eu-update-submit">提交给店长核对${changed?`（${changed} 项）`:''}</button></div>
 <button type="button" class="ghost-btn eu-demo-link eu-demo-supplement">演示：店长发起补件</button>
 <p class="eu-note">替换带有效期的材料时，新版本有效期必须重填；确实沿用原日期的，勾选“保留原日期”并写原因（HR-DOC-20）。文件只保存在本机演示中，PDF / PNG / JPEG 最大 20 MB。</p>`;
}
function euUpdateChangedList(d){return Object.keys(euDraftProfile(d)).filter(key=>euUpdateChanged(d,key)).length+Object.keys(d.updateDraft?.docs||{}).length;}
const EU_UPDATE_LABELS={nationalityClass:'国籍类别',student:'是否学生',language:'沟通语言'};
/* 提交给店长的资料修改清单：每个有效文件版本连同有效期/保留原因一起进去（HR-ONB-43、HR-DOC-20） */
function euUpdateSubmitItems(d){
 const items=[];
 if(euIbanError(euUpdateValue(d,'iban')))return {items,error:'IBAN 校验位不通过，请核对。'};
 EU_UPDATE_FIELDS.forEach(([key,label])=>{if(euUpdateChanged(d,key))items.push({key,label,kind:'field',from:(d.profile||{})[key]||'',to:euUpdateValue(d,key)});});
 ['nationalityClass','student','language'].forEach(key=>{if(euUpdateChanged(d,key))items.push({key,label:EU_UPDATE_LABELS[key]||key,kind:'field',from:(d.profile||{})[key]||'',to:euUpdateValue(d,key)});});
 for(const [key,file] of Object.entries(d.updateDraft?.docs||{})){
  const t=euDocumentList(euUpdateView(d)).find(x=>x.key===key);if(!t)continue;
  const expiry=euUpdateValue(d,key+'Expiry'),keep=!!d.updateDraft?.keepExpiry?.[key],reason=String(d.updateDraft?.keepReason?.[key]||'').trim();
  const keptExpiry=(d.profile||{})[key+'Expiry']||'';
  const validDate=value=>typeof empValidExpiry==='function'?empValidExpiry(value):/^\d{4}-\d{2}-\d{2}$/.test(value||'');
  if(t.expires&&!keep&&!expiry)return {items,error:'替换带有效期的材料时，请重填新有效期，或勾选“保留原日期”并写原因。'};
  if(keep&&!reason)return {items,error:'勾选了“保留原日期”，必须写原因（HR-DOC-20）。'};
  if(keep&&!validDate(keptExpiry))return {items,error:'现行版本没有可保留的有效期，请改填新有效期。'};
  items.push({key,label:t.label,kind:'doc',from:(d.docs[key]?.name||'无'),to:file.name,file:{name:file.name,data:file.data||null,at:file.at||empNow()},expiry:keep?keptExpiry:expiry,keepExpiry:keep,keepReason:keep?reason:''});
 }
 return {items,error:''};
}
/* 每次提交都生成新的 requestId：老板端采纳/退回会把旧 ID 记进 closedRequestIds，
   退回后重新提交若沿用旧 ID 会被当成终态重放丢弃（HR-ONB-43/44）。 */
function euBuildUpdateRequest(d,items,prior){
 return {requestId:euRequestId('update'),state:'pending',at:empNow(),items:prior?.state==='returned'?items.concat((prior.items||[]).filter(x=>!items.some(y=>y.key===x.key))):items};
}

/* 采纳严格按冻结的请求项执行：字段取 to、文件取请求里保存的那一版；
   不读提交后又被改动的草稿，也不拿本机缓存整体覆盖档案（HR-ONB-43）。 */
function euApplyUpdateItems(e,items,at){
 const next=JSON.parse(JSON.stringify(e));next.contact||={};next.ids||={};next.docs||{};next.contract||={};
 (items||[]).forEach(item=>{
  if(item.kind==='doc'){
   const docId=EU_EMPLOYEE_DOC_MAP[item.key];if(!docId)return;
   const old=next.docs[docId]||{},file=item.file||{};
   if(old.file&&old.dataUrl&&file.data&&old.dataUrl!==file.data)next.documentArchive=[{docId,...old,archivedAt:at},...(next.documentArchive||[])];
   next.docs[docId]={...old,state:'ok',file:file.name||item.to||old.file,dataUrl:file.data||old.dataUrl,ref:file.ref||old.ref,expiry:item.expiry||'',noExpiry:false,at:file.at||at,by:(typeof empActorLabel==='function'?empActorLabel():old.by),needsReview:false};
   return;
  }
  if(item.key==='nationalityClass'){if(typeof hrSetNationalityClass==='function')hrSetNationalityClass(next,item.to);else{next.contract.nationalityClass=item.to==='eu'||item.to==='other'?item.to:'';next.contract.nonEU=next.contract.nationalityClass==='other';}return;}
  if(item.key==='student'){next.contract.isStudent=item.to==='yes'?true:item.to==='no'?false:null;return;}
  if(item.key==='first'||item.key==='last'){next[item.key==='first'?'firstName':'lastName']=item.to;const name=[next.firstName||'',next.lastName||''].filter(Boolean).join(' ');if(name)next.name=name;return;}
  if(item.key==='birthday'){next.birthday=item.to;return;}
  const path=EU_EMPLOYEE_PROFILE_MAP[item.key];if(path)empSetPath(next,path,item.to);
 });
 return next;
}

/* 员工端“店长已采纳”演示入口：采纳冻结请求，并把同一 requestId 的补件投影一起关掉。
   只关 updateRequest 会留下仍为 submitted 的 supplementSubmission，老板能再采纳一次并覆盖新值。 */
function euAdoptUpdateRequest(d,req){
 const e=euEmployee(d);if(!e)return null;
 const at=empNow(),next=euApplyUpdateItems(e,req.items,at),portal={...(next.employeePortal||{})},sup=portal.supplementSubmission;
 const reqId=req.requestId||sup?.requestId||euRequestId('update');
 portal.updateRequest={...req,requestId:reqId,state:'done',reviewedAt:at,reviewedBy:'员工端演示'};
 if(sup&&euRequestSame(sup,req)){portal.supplementSubmission={...sup,requestId:reqId,status:'accepted',reviewedAt:at,reviewedBy:'员工端演示'};portal.supplementRequest=null;}
 next.employeePortal=portal;
 euCloseRequestId(next,reqId);
 return next;
}


function euBind(){
 if(state().route!=='employee-ui')return;
 euTaskBind();
 euBindIdentityHints(document);
 const rerender=()=>app();
 document.querySelector('.eu-restart')?.addEventListener('click',()=>{euSession={step:'register',tab:'tasks',key:null,demo:''};rerender();});
 document.querySelector('.eu-demo-state')?.addEventListener('change',ev=>{const prev=euSession.demo;
  if(prev){const all=euDemoStore(),key=`${prev}::${euSession.key||'default'}`;if(all[key]?.demoWorkspaceAt){all[key].demoWorkspaceAt=null;empWrite(EU_DEMO_KEY,all);}}
  euSession.demo=ev.target.value;euSession.task=null;euSession.step=ev.target.value?'materials':'register';rerender();});
 document.querySelector('.eu-workspace-direct')?.addEventListener('click',()=>{const invite=euInvitation();if(!invite)return;euSession.key=invite.key;const d=euData();d.name=invite.name;d.email=invite.email;d.invitation={key:invite.key,store:invite.store,demo:invite.demo};d.demoWorkspaceAt=empNow();euEnsureEmployee(d,invite);euSave(d);euSession.step='materials';euSession.tab='tasks';euSession.task=null;rerender();});
 document.querySelector('.eu-invite-continue')?.addEventListener('click',()=>{const invite=euInvitation();if(!invite)return;euSession.key=invite.key;const d=euData();d.name=invite.name;d.email=invite.email;d.invitation={key:invite.key,store:invite.store,demo:invite.demo};euEnsureEmployee(d,invite);euSave(d);euSession.step='password';rerender();});
 document.querySelector('.eu-activate-form')?.addEventListener('submit',ev=>{ev.preventDefault();const form=ev.currentTarget,password=form.elements.password.value||'',confirm=form.elements.confirm.value||'',feedback=form.querySelector('.eu-activation-feedback');if(password&&password.length<6){feedback.textContent=euT('密码至少 6 位。');return;}if(password&&password!==confirm){feedback.textContent=euT('两次输入的密码不一样。');return;}const d=euData();d.activationDemoAt=empNow();euSave(d);form.reset();euSession.step='materials';rerender();});
 document.querySelector('.eu-link-confirm')?.addEventListener('click',()=>{const invite=euInvitation();if(invite&&!euSession.key)euSession.key=invite.key;const d=euData();if(invite?.employeeId)d.employeeId=d.employeeId||invite.employeeId;d.accountLinkConfirmedAt=empNow();d.messages.unshift('员工档案关联已确认');euSave(d);rerender();});
 document.querySelector('.eu-link-reject')?.addEventListener('click',()=>{const box=document.querySelector('.eu-validation');if(box)box.textContent=euT('已记录“不是我”，请联系店长核对档案。');});
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{euSession.tab=b.dataset.tab;euSession.task=null;rerender();});
 document.querySelector('.eu-skip')?.addEventListener('click',()=>{const d=euData();d.demoWorkspaceAt=empNow();euSave(d);euSession.step='materials';euSession.tab='tasks';rerender();});
 document.querySelector('.eu-finish-onboarding')?.addEventListener('click',()=>{euSession.step='materials';euSession.tab='tasks';rerender();});
 /* 第一步：国籍类别与是否学生（HR-DOC-02/07）；附加页只显示店长核对结果 */
 document.querySelectorAll('.eu-eligibility').forEach(input=>input.addEventListener('change',()=>{const d=euData();const key=input.dataset.profile;d.profile={...(d.profile||{}),[key]:input.value};euMarkEdited(d,[key]);euSave(d);rerender();}));
 document.querySelector('.eu-language-choice')?.addEventListener('change',()=>{rerender();document.querySelector('.eu-language-choice')?.scrollIntoView({block:'center'});});
 document.querySelectorAll('.eu-profile-field').forEach(input=>input.addEventListener('input',()=>{const d=euData();const key=input.dataset.profile;d.profile={...(d.profile||{}),[key]:input.value};euMarkEdited(d,[key]);if(key==='first'||key==='last')d.name=[d.profile.first,d.profile.last].filter(Boolean).join(' ');euSave(d);}));
 /* 上传：PDF / PNG / JPEG，最大 20 MB；银行卡、医保卡只收照片（HR-DOC-09/12） */
 document.querySelectorAll('.eu-upload input').forEach(input=>input.onchange=async()=>{
  const file=input.files[0];if(!file)return;
  const key=input.dataset.doc,d=euData(),t=euDocumentList(d).find(x=>x.key===key);
  const imageOnly=!!(t?.imageOnly||['bankFront','bankBack','healthFront','healthBack'].includes(key));
  if(['contract','questionnaire'].includes(key)&&euContractStatus(d,key).state==='approved'){empFlash(input.parentElement,euT('这份已通过核对，不需要重传'));input.value='';return;}
  const error=euUploadError(file,imageOnly);
  if(error){empFlash(input.parentElement,euT(error));input.value='';return;}
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  const fresh=euData();
  const inv=euInvite(fresh),stamp=inv.dispatchId?{dispatchId:inv.dispatchId}:{};
  fresh.docs[key]={name:file.name,data,at:empNow(),...stamp};fresh.profile={...(fresh.profile||{}),[key+'Expiry']:''};euMarkEdited(fresh,[key+'Expiry']);
  if(['contract','questionnaire'].includes(key)){fresh.contractUploadAt=empNow();}else{fresh.materialSubmitted=fresh.materialSubmitted||null;}
  euSave(fresh);rerender();
 });
 document.querySelectorAll('.eu-delete').forEach(b=>b.onclick=()=>{if(!b.dataset.doc)return;const d=euData();d.docHistory=[{key:b.dataset.doc,file:d.docs[b.dataset.doc],at:empNow()},...(d.docHistory||[])];delete d.docs[b.dataset.doc];d.materialSubmitted=null;euSave(d);rerender();});
 /* 提交只校验第一层（HR-ONB-17/26） */
 document.querySelector('.eu-material-submit')?.addEventListener('click',()=>{const d=euData(),box=document.querySelector('.eu-validation');if(euInviteExpiredForSubmit(d)){if(box){box.textContent=euT('邀请链接已过期，请联系店长重新发送邀请。');box.scrollIntoView({block:'center'});}return;}if(!euNationalityClass(d)){if(box){box.textContent=euT('请先回答国籍类别和是否学生。');box.scrollIntoView({block:'center'});}return;}const at=empNow();d.materialSubmitted=at;d.submitActionAt=at;d.submitted=euSubmissionSnapshot(d);d.returnedAt=null;d.messages.unshift('资料已提交，等待审核');euSave(d);euSession.step='materials';rerender();});
 document.querySelector('.eu-company-confirm')?.addEventListener('click',()=>{const d=euData(),mode=euFillMode(d),missing=mode==='veteran'?[]:euLayer1Missing(d);if(mode==='veteran')d.veteranConfirmedAt=empNow();else{if(euDemo()==='company')d.demoCompanyConfirmedAt=empNow();else d.confirmedCompanyProfileAt=empNow();}const hint=missing.length?euTF('（第一层还缺，仅提示：{items}）',{items:missing.map(x=>euT(x)).join('、')}):'';d.messages.unshift((mode==='veteran'?'资料已确认，员工端已开通':'资料已确认，等待公司发送合同')+hint);euSave(d,{archive:mode!=='company'||!euDemo()});if(euInvite(d).pendingConfirm){d.messages.unshift('第二层材料没交齐：已确认，等老板特殊审批后才生效');euSave(d);}euSession.step='materials';euSession.tab='tasks';rerender();});
 document.querySelector('.eu-withdraw')?.addEventListener('click',()=>{const d=euData();d.materialSubmitted=null;d.submitActionAt=null;d.withdrawnAt=empNow();d.messages.unshift('已撤回提交，可以继续修改');euSave(d);euSession.step='materials';rerender();});
 /* 合同与问卷：两份一起下载、签字、上传；被退回只重传那一份（HR-ONB-36/38） */
 document.querySelector('.eu-contract-signed-submit')?.addEventListener('click',()=>{const d=euData(),box=document.querySelector('.eu-validation'),need=[];['contract','questionnaire'].forEach(key=>{const status=euContractStatus(d,key);if(status.state==='approved')return;const doc=d.docs?.[key];/* 提交前再判一次：必须是当前发送的文件版本，旧发送/旧退回件都不算（HR-ONB-37/53） */if(status.stale||!doc||!euContractFileCurrent(d,key,doc)){need.push(key);return;}if(status.state==='returned'&&!euContractFreshUpload(d,key,status))need.push(key);});if(need.length){if(box){box.textContent=euTF('请先上传：{items}',{items:need.map(k=>euT(k==='contract'?'已签署劳动合同':'已填写并签署的个人调查问卷')).join('、')});box.scrollIntoView({block:'center'});}return;}d.contractSignedSubmittedAt=empNow();d.messages.unshift('签署文件已提交，等待店长核对');euSave(d);euSyncDocs(d,['contract','questionnaire']);rerender();});
 /* 入职后修改资料：先存草稿，提交店长核对（HR-ONB-43） */
 document.querySelectorAll('.eu-update-field').forEach(input=>{
  input.addEventListener('input',()=>{const d=euData();d.updateDraft=d.updateDraft||{profile:{},docs:{}};d.updateDraft.profile=d.updateDraft.profile||{};d.updateDraft.profile[input.dataset.update]=input.value;euSaveDraft(d);});
  input.addEventListener('change',()=>{const d=euData();d.updateDraft=d.updateDraft||{profile:{},docs:{}};d.updateDraft.profile=d.updateDraft.profile||{};d.updateDraft.profile[input.dataset.update]=input.value;euSaveDraft(d);rerender();});
 });
 document.querySelectorAll('.eu-update-expiry').forEach(input=>input.addEventListener('change',()=>{const d=euData();d.updateDraft=d.updateDraft||{profile:{},docs:{}};d.updateDraft.profile=d.updateDraft.profile||{};d.updateDraft.profile[input.dataset.docExpiry+'Expiry']=input.value;euSaveDraft(d);rerender();}));
 document.querySelectorAll('[data-keep-expiry]').forEach(box=>box.addEventListener('change',()=>{const d=euData(),key=box.dataset.keepExpiry;d.updateDraft=d.updateDraft||{profile:{},docs:{}};d.updateDraft.keepExpiry={...(d.updateDraft.keepExpiry||{}),[key]:box.checked};if(box.checked)d.updateDraft.profile={...(d.updateDraft.profile||{}),[key+'Expiry']:(d.profile||{})[key+'Expiry']||''};euSaveDraft(d);rerender();}));
 document.querySelectorAll('.eu-keep-reason').forEach(input=>input.addEventListener('input',()=>{const d=euData();d.updateDraft=d.updateDraft||{profile:{},docs:{}};d.updateDraft.keepReason={...(d.updateDraft.keepReason||{}),[input.dataset.keepReason]:input.value};euSaveDraft(d);}));
 document.querySelectorAll('.eu-upload input[data-doc-update]').forEach(input=>input.onchange=async()=>{
  const file=input.files[0];if(!file)return;
  const key=input.dataset.docUpdate,d=euData(),t=euDocumentList(euUpdateView(d)).find(x=>x.key===key);
  const error=euUploadError(file,!!t?.imageOnly);
  if(error){empFlash(input.parentElement,euT(error));input.value='';return;}
  const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  const fresh=euData();fresh.updateDraft=fresh.updateDraft||{profile:{},docs:{}};fresh.updateDraft.docs=fresh.updateDraft.docs||{};
  const oldExpiry=(fresh.profile||{})[key+'Expiry']||'';
  fresh.updateDraft.docs[key]={name:file.name,data,at:empNow(),oldExpiry};
  fresh.updateDraft.profile={...(fresh.updateDraft.profile||{}),[key+'Expiry']:''};
  euSaveDraft(fresh);rerender();
 });
 document.querySelectorAll('[data-doc-cancel]').forEach(b=>b.onclick=()=>{const d=euData(),key=b.dataset.docCancel;if(d.updateDraft?.docs)delete d.updateDraft.docs[key];euSaveDraft(d);rerender();});
 document.querySelector('.eu-update-submit')?.addEventListener('click',()=>{const d=euData(),box=document.querySelector('.eu-validation'),result=euUpdateSubmitItems(d),items=result.items;
  if(result.error){if(box){box.textContent=euT(result.error);box.scrollIntoView({block:'center'});}return;}
  if(!items.length){if(box)box.textContent=euT('没有改动，不需要提交。');return;}
  const prior=euUpdateRequest(d);
  d.updateRequest=euBuildUpdateRequest(d,items,prior);
  d.messages.unshift('资料修改已提交，等待店长核对');euSaveDraft(d);euPublishPortal(d,{updateRequest:d.updateRequest,materialUpdateAt:d.updateRequest.at});rerender();});
 document.querySelector('.eu-update-withdraw')?.addEventListener('click',()=>{const d=euData();d.updateRequest=null;d.updateDraft=null;euSaveDraft(d);euPublishPortal(d,{updateRequest:null});rerender();});
 document.querySelector('.eu-update-adopt')?.addEventListener('click',()=>{const d=euData(),box=document.querySelector('.eu-validation'),req=euUpdateRequest(d),e=euEmployee(d);if(!req||!Array.isArray(req.items)||!req.items.length){if(box)box.textContent=euT('没有可采纳的修改请求。');return;}if(!e){if(box)box.textContent=euT('找不到员工档案，无法采纳。');return;}
  if(euDemo()){const at=empNow(),sup=d.supplementSubmission;d.updateRequest={...req,state:'done',reviewedAt:at,reviewedBy:'员工端演示'};if(sup&&euRequestSame(sup,req))d.supplementSubmission={...sup,status:'accepted',reviewedAt:at,reviewedBy:'员工端演示'};d.updateDraft=null;euSaveDemo(d);rerender();return;}
  const next=euAdoptUpdateRequest(d,req);
  if(!next){if(box)box.textContent=euT('找不到员工档案，无法采纳。');return;}
  if(typeof empSaveWithHistory==='function')empSaveWithHistory(next,'员工端 UI（采纳资料修改）');else if(typeof empSaveStaff==='function')empSaveStaff(next);
  d.updateRequest=null;d.updateDraft=null;d.profileEdited=(d.profileEdited||[]).filter(key=>!req.items.some(x=>x.kind==='field'&&x.key===key));euSaveDraft(d);rerender();});
 document.querySelector('.eu-update-reject')?.addEventListener('click',()=>{const d=euData(),req=euUpdateRequest(d)||{};d.updateRequest={...req,state:'returned',reviewedAt:empNow(),reason:'演示：材料照片不清晰，请重拍后再交。'};euSaveDraft(d);euPublishPortal(d,{updateRequest:d.updateRequest});rerender();});
 document.querySelector('.eu-supplement-return')?.addEventListener('click',()=>{
  const d=euData(),box=document.querySelector('.eu-validation'),sup=euSupplementRequest(d);
  if(!sup){if(box)box.textContent=euT('当前没有店长发起的补件请求。');return;}
  const result=euSupplementSubmissionFor(d,sup);
  if(result.missing.length){if(box){box.textContent=euTF('还要补：{items}。请先在资料修改里填写或上传新版本。',{items:result.missing.map(x=>euT(x)).join('、')});box.scrollIntoView({block:'center'});}return;}
  const e=euEmployee(d);
  euPushSupplementReturn(d,result.sub);
  /* 已交回的文件从本机草稿移除，避免下次保存或采纳时又被当成待核对。 */
  if(e?.request&&d.updateDraft?.docs)result.entries.forEach(item=>{Object.keys(EU_EMPLOYEE_DOC_MAP).forEach(key=>{if(key===item.key||EU_EMPLOYEE_DOC_MAP[key]===item.key)delete d.updateDraft.docs[key];});});
  d.supplementReturnedAt=empNow();
  d.supplementSubmission={requestId:result.sub.requestId||euSupplementRequestId(sup),status:'submitted',state:'submitted',at:d.supplementReturnedAt,items:result.entries.map(x=>({...x,label:euSupplementLabel(d,x)})),submitted:result.sub};
  d.messages.unshift('补交材料已交回，等待店长核对');euSave(d);euPublishPortal(d,{supplementReturnedAt:d.supplementReturnedAt,supplementSubmission:d.supplementSubmission});rerender();
 });
 document.querySelector('.eu-demo-supplement')?.addEventListener('click',()=>{const d=euData();d.supplementRequest={state:'open',at:empNow(),note:'演示：请补交护照照片和健康证首次证明',items:[{key:'passport',label:'护照 / 身份证'},{key:'hygiene',label:'食品卫生指导证明（健康证）'}]};d.supplementReturnedAt=null;d.supplementSubmission=null;euSave(d);rerender();});
}

function euAvailabilityDeadline(d){const store=d.invitation?.store||d.contractSummary?.store||'Martin Biergarten',deadline=empRead('kaispanScheduleDeadlinesV1',{})[store]?.availability;return deadline?`<p class="eu-note">报班截止：${empEsc(deadline.replace('T',' '))}</p>`:'';}
