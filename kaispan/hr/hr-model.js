/* 老板端 / 员工端共用的资料约定（HR-DOC-02/06/07）。两边都从这里读，不各写一套。
   存储位置不变：员工档案 e.contract.*，旧字段 nonEU / hasZusatz / isStudent 保留并由新字段派生，旧代码继续可读。 */

/* 国籍类别：'' 未回答 / 'eu' 欧盟、欧洲经济区或瑞士公民 / 'other' 其他国籍。 */
function hrNationalityClass(e) {
  const c = e?.contract || {};
  if (c.nationalityClass === "eu" || c.nationalityClass === "other") return c.nationalityClass;
  if (c.nationalityClass === "") return "";
  if (typeof c.nonEU === "boolean") return c.nonEU ? "other" : "eu";
  return "";
}

function hrSetNationalityClass(e, value) {
  e.contract = e.contract || {};
  e.contract.nationalityClass = value === "eu" || value === "other" ? value : "";
  e.contract.nonEU = e.contract.nationalityClass === "other";
}

function hrIsNonEu(e) {
  return hrNationalityClass(e) === "other";
}

/* 学生：员工自答 contract.isStudent，或合同类型是 Werkstudent 即视为学生。 */
function hrIsStudent(e) {
  const c = e?.contract || {};
  return c.type === "werkstudent" || c.isStudent === true;
}

/* Zusatzblatt：店长核对居留证件后勾选。'' 未核对 / 'no' / 'yes'。员工本人不选。 */
function hrZusatzCheck(e) {
  const c = e?.contract || {};
  if (c.zusatzCheck === "yes" || c.zusatzCheck === "no") return c.zusatzCheck;
  if (c.zusatzCheck === "") return "";
  if (c.hasZusatz === true) return "yes";
  return hrIsNonEu(e) ? "" : "no";
}

function hrSetZusatzCheck(e, value) {
  e.contract = e.contract || {};
  e.contract.zusatzCheck = value === "yes" || value === "no" ? value : "";
  e.contract.hasZusatz = e.contract.zusatzCheck === "yes";
}

/* 员工账号状态（HR-ACCESS-26/53）：none 未邀请 / invited 已邀请待接受 / accepted 已接受绑定中 /
   pending_link 待确认关联 / active 已激活 / disabled 已停用 / expired 邀请已过期 / revoked 已撤销 / send_failed 发送失败 */
const HR_ACCOUNT_STATES = {
  none: "未邀请", invited: "已邀请待接受", accepted: "已接受，绑定中", pending_link: "待确认关联",
  active: "已激活", disabled: "已停用", expired: "邀请已过期", revoked: "已撤销", send_failed: "发送失败"
};

/* 材料叫法统一（HR-DOC-01） */
const HR_DOC_LABELS = {
  passport: "护照 / 身份证",
  visa: "居留许可（含临时替代证明）"
};

/* 上传限制（HR-DOC-12）：PDF、PNG、JPEG，最大 20 MB；银行卡、医保卡只收照片 */
const HR_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
function hrUploadError(file, imageOnly) {
  if (!file) return "";
  const okType = imageOnly ? /^image\/(png|jpeg)$/i.test(file.type) : /^(application\/pdf|image\/(png|jpeg))$/i.test(file.type);
  if (!okType) return imageOnly ? "只收 PNG 或 JPEG 照片" : "只收 PDF、PNG 或 JPEG";
  if (file.size > HR_UPLOAD_MAX_BYTES) return "文件超过 20 MB";
  return "";
}

/* 试用期结束日 = 入职日 + 月数 − 1 天；有效结束日不超过入职日 + 6 个月（HR-LIFE-05～08） */
function hrProbationDefaultEnd(entryDate, months) {
  if (!entryDate || !months) return "";
  const date = new Date(entryDate + "T12:00:00Z");
  if (Number.isNaN(date.getTime())) return "";
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + Number(months));
  if (date.getUTCDate() !== day) date.setUTCDate(0);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/* 学生工周工时折算：月上限 × 12 ÷ 52（HR-CONTRACT-12） */
function hrWeeklyFromMonthly(monthlyHours) {
  return Math.round((Number(monthlyHours) || 0) * 12 / 52 * 10) / 10;
}
