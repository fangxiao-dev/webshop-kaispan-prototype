#!/bin/sh
# Run from the supplier prototype directory; requires ego-browser.
ego-browser nodejs <<'JS'
const t = await taskSpace('price-levels-check');
try {
  const p = t.page('p1');
  await p.goto('file:///Users/panhaisa/haisa/Pan/Projects/Gao/workspace/webshop-kaispan-prototype/fujigawa/supplier/supplier-ui-editor.html');
  console.log(await p.evaluate(() => {
    document.querySelector('[data-open-drawer="productPriceNoodle"]').click();
    const root = document.querySelector('[data-product-editor]');
    const panel = root.querySelector('.product-price-levels');
    const count = () => panel.querySelectorAll('tbody tr').length;
    const add = panel.querySelector('button');
    root.querySelector('[aria-label="删除等级1"]').click();
    if (!root.querySelector('dialog').open || count() !== 10) throw Error('Used level must be blocked');
    const warning = root.querySelector('dialog p');
    if (getComputedStyle(warning).color !== 'rgb(220, 38, 38)' || getComputedStyle(warning).fontWeight !== '700') throw Error('Warning must be bold red');
    root.querySelector('dialog').close();
    root.querySelector('[aria-label="删除等级10"]').click();
    if (count() !== 10 || !root.querySelector('dialog[open] [data-confirm]')) throw Error('Confirmation required before deletion');
    root.querySelector('dialog[open] [data-cancel]').click();
    if (count() !== 10) throw Error('Cancel must preserve level');
    root.querySelector('[aria-label="删除等级10"]').click();
    root.querySelector('dialog[open] [data-confirm]').click();
    if (count() !== 9 || add.disabled) throw Error('Unused level must be removable');
    add.click();
    if (count() !== 10 || !add.disabled || !root.querySelector('[data-product-price="10"]')) throw Error('Restore level and enforce maximum');
    return 'Price level checks passed';
  }));
} finally { await t.finish({keep: []}); }
JS
