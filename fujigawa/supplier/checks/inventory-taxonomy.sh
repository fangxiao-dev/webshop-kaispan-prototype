#!/bin/sh
ego-browser nodejs <<'JS'
const t=await taskSpace('inventory-taxonomy-check');
try {
const p=t.page('p1');
await p.goto('file:///Users/panhaisa/haisa/Pan/Projects/Gao/workspace/webshop-kaispan-prototype/fujigawa/supplier/supplier-ui-editor.html');
console.log(await p.evaluate(()=>{
 const assert=(x,m)=>{if(!x)throw Error(m)};
 document.querySelector('[data-inventory-master-data]').click();
 assert(document.querySelector('[data-im-edit]'),'Edit item exists');
 document.querySelector('[data-im-new]').click();
 document.querySelector('#im-name').value='保留草稿';
 for(const [id,name] of [['im-brand','测试品牌'],['im-group','测试物品组']]) {
 const select=document.getElementById(id);
 select.value='__add__'; select.dispatchEvent(new Event('change',{bubbles:true}));
 const dialog=document.querySelector('dialog[open]'); assert(dialog,'Dialog opened');
 dialog.querySelector('input').value=name;
 dialog.querySelector('form').requestSubmit();
 assert(select.selectedOptions[0].text===name,'New entry selected');
 assert(document.querySelector('#im-name').value==='保留草稿','Draft retained');
 }
 document.querySelector('[data-editable-filter="品牌"] [data-filter-add]').click();
 assert(document.querySelector('dialog[open]'),'Quick add dialog');
 document.querySelector('dialog[open] [data-cancel]').click();
 return 'Inventory taxonomy checks passed';
}));
}finally{await t.finish({keep:[]});}
JS
