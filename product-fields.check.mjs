// 运行：ego-browser nodejs < docs/fuji_backoffice/product-fields.check.mjs
const task = await taskSpace('商品品牌规格检查');
const page = task.page('p1');
try {
  await page.goto('file:///Users/panhaisa/haisa/Pan/Projects/Gao/workspace/food-supplier-webapp/docs/fuji_backoffice/supplier-ui-editor.html');
  console.log(await page.evaluate(() => {
    const assert = (value, message) => { if (!value) throw new Error(message); };
    const click = selector => document.querySelector(selector).click();
    const field = name => document.querySelector(`[data-product-field="${name}"]`);
    goToPage('inventory'); click('[data-inventory-master-data]');
    click('[data-im-tab="brands"]'); click('[data-im-new]');
    document.querySelector('[data-im-form] [name="name"]').value = '检查品牌';
    document.querySelector('[data-im-form]').requestSubmit();
    closeDrawer(); goToPage('products'); openDrawer('productPriceNoodle');
    assert(field('specification').value === '80pc*140g', '原规格回显');
    assert(field('brandId').options[1].text === '检查品牌', '复用品牌列表');
    field('brandId').selectedIndex = 1;
    const brandId = field('brandId').value;
    field('specification').value = '一瓶 500ml'; click('[data-product-save]');
    openDrawer('productPriceNoodle');
    assert(field('brandId').value === brandId && field('specification').value === '一瓶 500ml', '编辑保存回显');
    assert(document.querySelector('[data-product-drawer="productPriceNoodle"] small').textContent.includes('检查品牌 · 一瓶 500ml'), '卡片同步');
    field('specification').value = '取消的规格'; closeDrawer(); openDrawer('productPriceNoodle');
    assert(field('specification').value === '一瓶 500ml', '取消不保存');
    closeDrawer(); openDrawer('newProduct');
    field('name').value = '检查售卖商品'; field('sku').value = 'CHECK-SALE';
    field('brandId').value = brandId; field('specification').value = '一箱 12瓶';
    click('[data-product-save]');
    const card = document.querySelector('[data-product-sku="CHECK-SALE"]');
    assert(card, '新增保存'); openDrawer(card.dataset.productDrawer);
    assert(field('brandId').value === brandId && field('specification').value === '一箱 12瓶', '新增后编辑回显');
    field('brandId').value = ''; field('specification').value = ''; click('[data-product-save]');
    openDrawer(card.dataset.productDrawer);
    assert(field('brandId').value === '' && field('specification').value === '', '允许无品牌和空规格');
    return 'PASS: 品牌复用、规格回显、新增、编辑、卡片同步、取消和清空';
  }));
} finally { await task.finish({ keep: [] }); }
