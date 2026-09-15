// 本地原型：与商品绑定抽屉共用库存目录，刷新后恢复示例数据。
(() => {
  const brands = inventoryBrands;
  const groups = [];
  const warehouses = ['冷冻房', '冷藏房', '常温库', '干货库', '未分组'];
  const collections = { 品牌: brands, 物品组: groups };
  Object.entries(collections).forEach(([type, entries]) => {
    document.querySelectorAll(`[data-editable-filter="${type}"] button`).forEach(button => {
      const label = button.querySelector('span');
      if (label && !['无品牌', '未分组'].includes(label.textContent.trim())) {
        const entry = { id: `local-${type}-${entries.length + 1}`, name: label.textContent.trim() };
        entries.push(entry);
        button.dataset.taxonomyId = entry.id;
      }
    });
  });

  window.openInventoryTaxonomy = function(type, select, entryId) {
    const entries = collections[type];
    if (!entries) return;
    const entry = entries.find(item => item.id === entryId);
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'width:420px;max-width:calc(100vw - 48px);border:1px solid #e5e7eb;border-radius:14px;padding:24px;box-shadow:0 20px 60px #0003';
    dialog.setAttribute('aria-label', `${entry ? '编辑' : '新增'}${type}`);
    dialog.innerHTML = `<form><h3>${entry ? '编辑' : '新增'}${type}</h3><p class="sub">保存后可在物品资料中选择。</p><div class="field" style="margin:20px 0"><label for="taxonomy-name">${type}名称</label><input id="taxonomy-name" required maxlength="80" value="${escapeHtml(entry?.name || '')}" placeholder="请输入${type}名称" autofocus></div><p data-error role="alert" style="color:var(--red)" hidden></p><div class="actions"><button type="button" class="btn" data-cancel>取消</button><button class="btn primary" type="submit">保存${type}</button></div></form>`;
    document.body.append(dialog);
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const name = dialog.querySelector('input').value.trim();
      if (!name || entries.some(item => item !== entry && item.name === name)) {
        const error = dialog.querySelector('[data-error]');
        error.textContent = name ? '名称已存在，请使用其他名称。' : '请输入名称。';
        error.hidden = false;
        return;
      }
      const saved = entry || { id: `local-taxonomy-${sequence++}` };
      saved.name = name;
      if (!entry) entries.push(saved);
      const layer = document.querySelector(`[data-editable-filter="${type}"]`);
      let button = [...layer.querySelectorAll('[data-taxonomy-id]')].find(node => node.dataset.taxonomyId === saved.id);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.taxonomyId = saved.id;
        button.innerHTML = '<span></span><i class="zone-remove" data-filter-remove>×</i>';
        layer.querySelector('[data-filter-add]').before(button);
      }
      button.querySelector('span').textContent = name;
      const target = select || document.querySelector(type === '品牌' ? '#im-brand' : '#im-group');
      if (target) {
        const previous = target.value;
        target.innerHTML = options(entries, select ? saved.id : previous) + `<option value="__add__">＋ 新增${type}…</option>`;
      }
      dialog.close();
      showToast(`已保存${type}“${name}”（本页演示）`);
    };
    dialog.showModal();
  };

  let tab = 'items';
  let sequence = 1;
  const labels = { items: '物品' };
  const records = () => tab === 'items' ? inventoryProducts : tab === 'brands' ? brands : groups;
  const field = (name, label, value = '', attributes = '') => `<div class="field"><label for="im-${name}">${label}</label><input id="im-${name}" name="${name}" value="${escapeHtml(value)}" ${attributes}></div>`;
  const options = (entries, selected) => '<option value="">未选择</option>' + entries.map(entry => `<option value="${escapeHtml(entry.id)}"${entry.id === selected ? ' selected' : ''}>${escapeHtml(entry.name)}</option>`).join('');

  function show(body) {
    drawerTitle.textContent = '物品资料';
    drawerSubtitle.textContent = '维护库存物品和规格；销售扣减关系在商品管理中设置。';
    drawerBody.innerHTML = `<div class="actions" style="margin-bottom:16px">${Object.entries(labels).map(([key, label]) => `<button type="button" class="btn ${tab === key ? 'primary' : ''}" data-im-tab="${key}" aria-pressed="${tab === key}">${label}</button>`).join('')}</div>${body}<p class="sub" style="margin-top:16px">本页为原型演示，保存后可重新打开查看；刷新后恢复示例数据，不会改变实际库存数量。</p>`;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function list() {
    show(`<div class="actions" style="margin-bottom:16px"><input class="control" type="search" data-im-search placeholder="搜索名称或编码" aria-label="搜索物品资料"><button type="button" class="btn primary" data-im-new>新增${labels[tab]}</button>${tab === 'items' ? '<button type="button" class="btn" data-toast="批量导入入口演示：后续支持上传标准 Excel 模板">批量导入</button><span class="sub">标准 Excel 模板</span><button type="button" class="link-btn" data-toast="模板下载入口演示：Excel 模板文件待配置">下载导入 Excel 模板</button>' : ''}</div><div class="table-card"><table style="min-width:560px"><thead><tr><th>名称</th><th>${tab === 'items' ? '品牌 / 物品组' : '编码'}</th><th>${tab === 'items' ? '规格' : ''}</th><th>操作</th></tr></thead><tbody>${records().map(record => `<tr data-im-row data-im-search-text="${escapeHtml(`${record.name} ${record.sku || record.code || ''}`.toLowerCase())}"><td><strong>${escapeHtml(record.name)}</strong><br><span class="sub">${escapeHtml(tab === 'items' ? record.sku || '' : '')}</span></td><td>${escapeHtml(tab === 'items' ? `${brands.find(brand => brand.id === record.brandId)?.name || '无品牌'} / ${groups.find(group => group.id === record.groupId)?.name || '未分组'}` : record.code || '—')}</td><td>${tab === 'items' ? record.specs.map(spec => escapeHtml(spec.label)).join('、') : ''}</td><td><button type="button" class="btn" data-im-edit="${escapeHtml(record.id)}">编辑</button></td></tr>`).join('')}</tbody></table><p class="sub" data-im-empty style="padding:12px" ${records().length ? 'hidden' : ''}>暂无${labels[tab]}，可点击上方新增。</p></div>`);
  }

  function specRow(spec = {}) {
    const fieldId = sequence++;
    return `<div class="form-grid" data-im-spec="${escapeHtml(spec.id || '')}" style="margin-top:12px">${field('specLabel', '规格名称', spec.label || '', 'required placeholder="例如：一箱24瓶"')}${field('specQuantity', '每个规格包含的基础单位数量', spec.baseQuantity || '', 'type="number" min="0.000001" step="any" placeholder="例如：24"')}<p class="sub full">换算单位使用上方填写的基础单位；已有规格未提供换算数据时保留空白。</p></div>`.replaceAll('im-specLabel', `im-specLabel-${fieldId}`).replaceAll('im-specQuantity', `im-specQuantity-${fieldId}`);
  }

  function edit(id, supplier = '') {
    const record = records().find(entry => entry.id === id);
    const itemFields = tab === 'items' ? `${field('sku', '物品编码', record?.sku || '')}${field('baseUnit', '基础单位', record?.baseUnit || '', 'placeholder="例如：瓶、kg、包"')}<div class="field"><label for="im-brand">品牌</label><select id="im-brand" name="brandId">${options(brands, record?.brandId)}<option value="__add__">＋ 新增品牌…</option></select></div><div class="field"><label for="im-group">物品组</label><select id="im-group" name="groupId">${options(groups, record?.groupId)}<option value="__add__">＋ 新增物品组…</option></select></div>${field('supplier', '供货商', record?.supplier || supplier)}<div class="field"><label for="im-warehouse">仓库</label><select id="im-warehouse" name="warehouse">${options(warehouses.map(name => ({ id: name, name })), record?.warehouse)}</select></div>` : field('code', '编码', record?.code || '');
    show(`<form data-im-form data-im-id="${escapeHtml(id || '')}"><h3>${record ? '编辑' : '新增'}${labels[tab]}</h3><div class="form-grid">${field('name', `${labels[tab]}名称`, record?.name || '', 'required')}${itemFields}</div>${tab === 'items' ? `<section style="margin-top:20px"><div class="card-head"><h3>库存规格</h3><button type="button" class="btn" data-im-add-spec>新增规格</button></div><div data-im-specs>${(record?.specs || []).map(specRow).join('')}</div></section>` : ''}<p data-im-error role="alert" style="color:var(--red)" hidden></p><div class="actions" style="margin-top:20px"><button type="button" class="btn" data-im-cancel>取消</button><button type="submit" class="btn primary">保存${labels[tab]}</button></div></form>`);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-inventory-master-data]')) { tab = 'items'; list(); }
    if (event.target.closest('[data-inventory-new-item]')) {
      const supplier = drawerBody.querySelector('[data-supplier-name-input]')?.value.trim() || '';
      tab = 'items';
      edit('', supplier);
    }
    const tabButton = event.target.closest('[data-im-tab]');
    if (tabButton) { tab = tabButton.dataset.imTab; list(); }
    if (event.target.closest('[data-im-new]')) edit();
    const editButton = event.target.closest('[data-im-edit]');
    if (editButton) edit(editButton.dataset.imEdit);
    if (event.target.closest('[data-im-cancel]')) list();
    if (event.target.closest('[data-im-add-spec]')) document.querySelector('[data-im-specs]').insertAdjacentHTML('beforeend', specRow());
  });

  document.addEventListener('focusin', event => {
    if (event.target.matches('#im-brand, #im-group')) event.target.dataset.previous = event.target.value;
  });
  document.addEventListener('change', event => {
    const select = event.target;
    if (!select.matches('#im-brand, #im-group')) return;
    if (select.value === '__add__') {
      select.value = select.dataset.previous || '';
      window.openInventoryTaxonomy(select.id === 'im-brand' ? '品牌' : '物品组', select);
    } else select.dataset.previous = select.value;
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-taxonomy-id]');
    if (button && !event.target.closest('[data-filter-remove]') && button.closest('.warehouse-filter-editing')) {
      window.openInventoryTaxonomy(button.closest('[data-editable-filter]').dataset.editableFilter, null, button.dataset.taxonomyId);
    }
  });

  document.addEventListener('input', event => {
    if (event.target.matches('[data-im-search]')) {
      const query = event.target.value.trim().toLowerCase();
      const rows = [...drawerBody.querySelectorAll('[data-im-row]')];
      rows.forEach(row => { row.hidden = !row.dataset.imSearchText.includes(query); });
      const empty = drawerBody.querySelector('[data-im-empty]');
      empty.hidden = rows.some(row => !row.hidden);
      empty.textContent = '没有符合条件的记录。';
    }
    if (event.target.closest('[data-im-form]')) event.target.setCustomValidity?.('');
  });

  document.addEventListener('submit', event => {
    const form = event.target.closest('[data-im-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    const id = form.dataset.imId;
    const collection = records();
    const existing = collection.find(record => record.id === id);
    const invalid = (input, message) => { input.setCustomValidity(message); input.reportValidity(); };
    if (!value('name')) return invalid(form.elements.name, '请输入名称');
    if (collection.some(record => record.id !== id && record.name === value('name'))) return invalid(form.elements.name, '名称已存在');
    const record = { ...existing, id: id || `local-${tab}-${sequence++}`, name: value('name') };
    if (tab === 'items') {
      if (value('sku') && collection.some(entry => entry.id !== id && entry.sku === value('sku'))) return invalid(form.elements.sku, '物品编码已存在');
      const rows = [...form.querySelectorAll('[data-im-spec]')];
      const specs = [];
      for (const row of rows) {
        const labelInput = row.querySelector('[name="specLabel"]');
        const quantityInput = row.querySelector('[name="specQuantity"]');
        const label = labelInput.value.trim();
        const quantity = quantityInput.value.trim();
        if (!label || specs.some(spec => spec.label === label)) return invalid(labelInput, '请填写不重复的规格名称');
        if (quantity && (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0)) return invalid(quantityInput, '请输入大于零的数量');
        if (quantity && !value('baseUnit')) return invalid(form.elements.baseUnit, '填写换算数量时，请先填写基础单位');
        const previous = existing?.specs.find(spec => spec.id === row.dataset.imSpec);
        specs.push({ ...previous, id: row.dataset.imSpec || `local-spec-${sequence++}`, label, stock: previous?.stock || '未登记', baseQuantity: quantity });
      }
      Object.assign(record, { sku: value('sku'), baseUnit: value('baseUnit'), brandId: value('brandId'), groupId: value('groupId'), supplier: value('supplier'), warehouse: value('warehouse'), stock: existing?.stock || '未登记', specs });
      // 编辑资料只更新名称；点货和库存数量仍由原工作台管理。
      if (existing) document.querySelectorAll('.warehouse-product-info > strong').forEach(node => { if (node.textContent === existing.name) node.textContent = record.name; });
    } else record.code = value('code');
    if (existing) Object.assign(existing, record);
    else collection.push(record);
    list();
    showToast(`已保存${labels[tab]}资料（本页演示）`);
  });
})();
