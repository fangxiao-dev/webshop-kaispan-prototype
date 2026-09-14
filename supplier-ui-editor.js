const pages = document.querySelectorAll('.page');
    const navButtons = document.querySelectorAll('[data-page-target]');
    const toast = document.getElementById('toast');
    const drawer = document.getElementById('drawer');
    const drawerTitle = document.getElementById('drawerTitle');
    const drawerSubtitle = document.getElementById('drawerSubtitle');
    const drawerBody = document.getElementById('drawerBody');

    const templateProducts = [
      ['F432', 'Ramen Noodle I4', '80pc*140g'],
      ['F431', 'Chicken Paitan', '6*2kg'],
      ['F480', 'Miso Tare', '1*10kg'],
      ['F490', 'Spicy Miso Tare', '1*10kg'],
      ['F410', 'Tonkotsu Base', '1*10kg'],
      ['F491', 'Red Tare', '1*10kg']
    ];
    const templateLevels = Array.from({ length: 10 }, (_, index) => [String(index + 1), `等级${index + 1}`]);
    document.querySelectorAll('[data-template-sku]').forEach(select => {
      templateLevels.slice(3).forEach(([, label]) => select.add(new Option(`${label} · 待设置价格`)));
    });
    const priceTemplates = [
      { id: 'template-1', name: '模版1', levels: makeTemplateLevels('1') },
      { id: 'template-2', name: '模版2', levels: makeTemplateLevels('2') },
      { id: 'template-3', name: '模版3', levels: makeTemplateLevels('3') }
    ];
    const templateNameAliases = new Map();
    const customerPriceConfigs = new Map();
    const inventoryProducts = [
      { id: 'inventory-noodles', name: '拉面面条', supplier: 'Fujigawa 自有产品', stock: '24 包', specs: [{ id: 'inventory-noodles-pack', label: '包', stock: '24 包' }] },
      { id: 'inventory-sauce', name: '拉面汁', supplier: 'Fujigawa 自有产品', stock: '18 桶', specs: [{ id: 'inventory-sauce-bucket', label: '桶', stock: '18 桶' }] },
      { id: 'inventory-chicken', name: '鸡胸肉 2.5kg', supplier: 'Metro Deutschland', stock: '6 箱', specs: [{ id: 'inventory-chicken-case', label: '箱', stock: '6 箱' }] },
      { id: 'inventory-tomato', name: '番茄 6kg', supplier: 'Metro Deutschland', stock: '3 箱', specs: [{ id: 'inventory-tomato-case', label: '箱', stock: '3 箱' }] },
      { id: 'inventory-mozzarella', name: '水牛芝士 500g', supplier: 'Transgourmet', stock: '8 包', specs: [{ id: 'inventory-mozzarella-pack', label: '包', stock: '8 包' }] },
      { id: 'inventory-rice', name: '寿司米 10kg', supplier: 'JFC Deutschland', stock: '2 袋', specs: [{ id: 'inventory-rice-bag', label: '袋', stock: '2 袋' }] }
    ];
    const inventoryBrands = [];
    const productMappings = new Map();
    const productDrawerRecords = {
      productPriceNoodle: { name: 'Ramen Noodle I4', sku: 'F432', specification: '80pc*140g', source: '自产产品', category: '拉面面条 / 拉面汁', cost: '€18.60', prices: ['€31.80', '€30.60', '€29.80'] },
      productPricePaitan: { name: 'Chicken Paitan', sku: 'F431', specification: '6*2kg', source: '自产产品', category: '拉面面条 / 拉面汁', cost: '€31.20', prices: ['€48.60', '€46.80', '€44.90'] },
      productPriceMiso: { name: 'Miso Tare', sku: 'F480', specification: '1*10kg', source: '自产产品', category: '拉面面条 / 拉面汁', cost: '€35.40', prices: ['€56.20', '€54.80', '€52.40'] },
      productPriceSpicy: { name: 'Spicy Miso Tare', sku: 'F490', specification: '1*10kg', source: '自产产品', category: '拉面面条 / 拉面汁', cost: '€37.80', prices: ['€59.90', '€57.60', '€55.20'] },
      productPriceGyoza: { name: 'Gyoza Mix 50pc', sku: 'GM-50', specification: '冷冻', source: '进货产品', category: '冷冻 / 调味', cost: '€14.80', prices: ['€21.40', '€20.90', '€20.20'] },
      productPriceRice: { name: '寿司米 10kg', sku: 'JFC-RICE-10', specification: '10kg', source: '进货产品', category: '冷冻 / 调味', cost: '€18.20', prices: ['€24.50', '€23.80', '€22.90'] }
    };
    let nextProductDrawerId = 1;
    let catalogPriceBaseline = null;
    let nextTemplateId = 4;
    let templateManagerSelectedId = null;
    let templateManagerDraft = null;

    function makeTemplateLevels(level) {
      const levels = {};
      templateProducts.forEach(([sku]) => {
        levels[sku] = level;
      });
      return levels;
    }

    function clonePriceTemplate(template) {
      return {
        id: template.id,
        name: template.name,
        originalName: template.name,
        levels: { ...template.levels }
      };
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character]));
    }

    function resolvePriceTemplate(name) {
      const direct = priceTemplates.find(template => template.name === name);
      if (direct) return direct;
      const aliasedId = templateNameAliases.get(name);
      return priceTemplates.find(template => template.id === aliasedId);
    }

    function renderPersonalTemplateRadios(selectedName) {
      const container = document.getElementById('personalTemplate');
      if (!container) return;
      const selectedTemplate = selectedName === null ? null : resolvePriceTemplate(selectedName) || priceTemplates[0];
      container.innerHTML = (selectedName === null ? '<span>自定义配置（仅当前客户）</span>' : '') + priceTemplates.map(template => `
        <label><input type="radio" name="priceTemplate" value="${escapeHtml(template.name)}"${template.id === selectedTemplate?.id ? ' checked' : ''}> ${escapeHtml(template.name)}</label>`).join('');
    }

    function applyPriceTemplateToCatalog(template) {
      if (!template) return;
      document.querySelectorAll('[data-template-sku]').forEach(select => {
        select.selectedIndex = Number(template.levels[select.dataset.templateSku] || '1') - 1;
      });
      catalogPriceBaseline = { name: template.name || null, levels: { ...template.levels } };
      document.getElementById('templateMismatchAlert')?.classList.remove('show');
    }

    function saveCustomerPrices(action) {
      const customer = document.getElementById('personalCustomer').textContent;
      const nameInput = document.getElementById('newTemplateName');
      const error = document.getElementById('newTemplateError');
      error.hidden = true;
      nameInput.removeAttribute('aria-invalid');
      if (action === 'cancel') {
        const baseline = catalogPriceBaseline || priceTemplates[0];
        renderPersonalTemplateRadios(baseline.name);
        applyPriceTemplateToCatalog(baseline);
        showToast('已取消本次价格修改');
        return;
      }
      const levels = Object.fromEntries([...document.querySelectorAll('[data-template-sku]')]
        .map(select => [select.dataset.templateSku, String(select.selectedIndex + 1)]));
      let template = null;
      if (action === 'new') {
        const name = nameInput.value.trim();
        if (!name || priceTemplates.some(item => item.name === name)) {
          error.textContent = name ? '模板名称已存在，请换一个名称' : '请输入新模板名称';
          error.hidden = false;
          nameInput.setAttribute('aria-invalid', 'true');
          nameInput.focus();
          return;
        }
        template = { id: `template-${nextTemplateId++}`, name, levels };
        priceTemplates.push(template);
      }
      customerPriceConfigs.set(customer, { templateId: template?.id || null, levels: { ...levels } });
      renderPersonalTemplateRadios(template?.name || null);
      applyPriceTemplateToCatalog(template || { levels });
      showToast(template ? '已保存新模板并用于当前客户，其他客户不变（本页演示）' : '已仅保存当前客户配置，共享模板及其他客户不变（本页演示）');
    }

    const drawerTemplates = {
      newCustomer: ['手动新增客户', '展示版表单，不连接后端。', customerForm('新客户', 'Berlin', 'contact@example.com', '待审核')],
      customerRamen: ['Ramen Haus Mitte', '客户资料和专属产品都在客户管理里。', customerForm('Ramen Haus Mitte', 'Berlin', 'kunden@ramenhaus.de', '待审核')],
      customerSakura: ['Sakura Kitchen', '客户资料和专属产品都在客户管理里。', customerForm('Sakura Kitchen', 'Hamburg', 'orders@sakura-kitchen.de', '已通过')],
      customerSushi: ['Sushi Bar Nord', '新客户申请审核。', customerForm('Sushi Bar Nord', 'Berlin', 'hello@sushinord.de', '新申请')],
      customerRamenFull: ['Ramen Haus Mitte', '完整客户档案：资料、材料、订单和付款情况。', customerFullDetail('Ramen Haus Mitte', 'Anna Keller', 'Berlin', '待审核', '完整', '缺失')],
      customerSakuraFull: ['Sakura Kitchen', '完整客户档案：资料、材料、订单和付款情况。', customerFullDetail('Sakura Kitchen', 'Kenji Mori', 'Hamburg', '已通过', '完整', '完整')],
      customerSushiFull: ['Sushi Bar Nord', '新客户申请审核：先检查资料和 Gewerbeanmeldung。', customerFullDetail('Sushi Bar Nord', 'Mina Ito', 'Berlin', '新申请', '缺失', '完整')],
      customerNoodleFull: ['Noodle Lab', '完整客户档案：资料、材料、订单和付款情况。', customerFullDetail('Noodle Lab', 'Lisa Wagner', 'Munich', '老客户', '完整', '完整')],
      basicRamen: ['Ramen Haus Mitte · 基础信息', '包含账单地址、送货地址、联系人信息、电话和邮箱。', basicInfoDetail('Ramen Haus Mitte', 'Anna Keller', '完整', 'Brunnenstr. 12, 10119 Berlin', 'Torstr. 88, 10119 Berlin', '+49 30 8842 1100', 'kunden@ramenhaus.de')],
      basicSakura: ['Sakura Kitchen · 基础信息', '包含账单地址、送货地址、联系人信息、电话和邮箱。', basicInfoDetail('Sakura Kitchen', 'Kenji Mori', '完整', 'Kanalstr. 6, 22085 Hamburg', 'Lagerhof 3, 22083 Hamburg', '+49 40 3312 8800', 'orders@sakura-kitchen.de')],
      basicSushi: ['Sushi Bar Nord · 基础信息', '基础信息缺失，需要补全后再通过审核。', basicInfoDetail('Sushi Bar Nord', 'Mina Ito', '缺失', '缺少账单地址', 'Prenzlauer Allee 41, 10405 Berlin', '缺少电话', 'hello@sushinord.de')],
      basicNoodle: ['Noodle Lab · 基础信息', '包含账单地址、送货地址、联系人信息、电话和邮箱。', basicInfoDetail('Noodle Lab', 'Lisa Wagner', '完整', 'Augustenstr. 15, 80333 Munich', 'Schwanthalerstr. 22, 80336 Munich', '+49 89 4421 7810', 'buying@noodlelab.de')],
      gewRamen: ['Ramen Haus Mitte · Gewerbeanmeldung', '当前缺失，可以在这里查看状态或上传文件。', gewerbeDetail('Ramen Haus Mitte', '缺失')],
      gewSakura: ['Sakura Kitchen · Gewerbeanmeldung', '文件已上传，可查看或替换。', gewerbeDetail('Sakura Kitchen', '完整')],
      gewSushi: ['Sushi Bar Nord · Gewerbeanmeldung', '文件已上传，可查看或替换。', gewerbeDetail('Sushi Bar Nord', '完整')],
      gewNoodle: ['Noodle Lab · Gewerbeanmeldung', '文件已上传，可查看或替换。', gewerbeDetail('Noodle Lab', '完整')],
      newProductConfig: ['个性化配置', '按顾客维护产品售价、上下架和生效价格。', priceConfigDetail('Ramen Haus Mitte', '老客1')],
      priceRamen: ['Ramen Haus Mitte · 个性化配置', '按顾客维护产品售价、上下架和生效价格。', priceConfigDetail('Ramen Haus Mitte', '老客1')],
      priceSakura: ['Sakura Kitchen · 个性化配置', '按顾客维护产品售价、上下架和生效价格。', priceConfigDetail('Sakura Kitchen', '加盟商')],
      priceSushi: ['Sushi Bar Nord · 个性化配置', '按顾客维护产品售价、上下架和生效价格。', priceConfigDetail('Sushi Bar Nord', '散户1')],
      priceNoodle: ['Noodle Lab · 个性化配置', '按顾客维护产品售价、上下架和生效价格。', priceConfigDetail('Noodle Lab', '老客2')],
      newOrder: ['创建订单', '展示版订单录入。', orderDetail('NEW', 'Ramen Haus Mitte', '草稿', '€0.00')],
      order2051: ['订单 ORD-2051', '详细订单信息，可编辑产品、配送、利润、运费和客户沟通。', orderDetail('ORD-2051', 'Ramen Haus Mitte', 'Ramen Haus GmbH', '新客户', '待付款', '€842.50', '22%', '€185.35')],
      order2049: ['订单 ORD-2049', '详细订单信息，可编辑产品、配送、利润、运费和客户沟通。', orderDetail('ORD-2049', 'Sakura Kitchen', 'Sakura Foods GmbH', '老客户', '已付款', '€391.20', '18%', '€70.42')],
      order2048: ['订单 ORD-2048', '详细订单信息，可编辑产品、配送、利润、运费和客户沟通。', orderDetail('ORD-2048', 'Noodle Lab', 'Noodle Lab UG', '老客户', '逾期', '€618.00', '15%', '€92.70')],
      document8836: ['订单 ORD-2048', '详细订单信息，可编辑产品、配送、利润、运费和客户沟通。', orderDetail('ORD-2048', 'Noodle Lab', 'Noodle Lab UG', '老客户', '逾期', '€618.00', '15%', '€92.70')],
      productAnalysis: ['产品分析详情', '核心产品的成本、售价、销量、毛利、库存和趋势。', productAnalysisDetail()],
      warehousePurchase: ['产品状态详情', '按供货商和生产部门查看所有产品库存、送货、订货和生产状态。', warehousePurchaseDetail()],
      warehouseSuppliers: ['供货商管理', '从库存系统复制：供货商、接单方式、产品类型和快速下单入口。', warehouseSuppliersDetail()],
      supplierRules: ['供货商编辑', '添加供货商、设置订货条件、截止时间、送货时间和上传商品/价格列表。', supplierRulesDetail()],
      warehouseZones: ['仓库区编辑', '维护仓库分组、商品归属、状态，以及合并拆分规则。', warehouseZonesDetail()],
      warehouseOrders: ['采购订单管理', '从库存系统复制：采购订单、配送、收货、单据校验和异常处理状态。', warehouseOrdersDetail()],
      warehouseUpload: ['运单 / 账单上传', '从库存系统复制：上传 PDF / JPG / PNG / Excel，自动生成采购列表或对账。', warehouseUploadDetail()],
      warehouseLoss: ['损耗记录', '从库存系统复制：损耗金额、原因、门店、日期和处理状态。', warehouseLossDetail(false)],
      warehouseLossNew: ['快速登记损耗', '从库存系统复制：记录商品过期、破损、报废、温度异常和盘点差异。', warehouseLossDetail(true)],
      shipping2051: ['出货 ORD-2051', '查看当天出库订单，确认出库并生成账单。', shippingDetail('ORD-2051', 'Ramen Haus Mitte', 'Ramen Haus GmbH', '09:00', 'Berlin 早班', '已备货', '€842.50')],
      shipping2049: ['出货 ORD-2049', '查看当天出库订单，确认出库并生成账单。', shippingDetail('ORD-2049', 'Sakura Kitchen', 'Sakura Foods GmbH', '11:30', 'Hamburg', '待复核', '€391.20')],
      shipping2053: ['出货 ORD-2053', '查看当天出库订单，确认出库并生成账单。', shippingDetail('ORD-2053', 'Noodle Lab', 'Noodle Lab UG', '14:00', 'Berlin 午班', '待拣货', '€612.80')],
      shipping2054: ['出货 ORD-2054', '查看当天出库订单，确认出库并生成账单。', shippingDetail('ORD-2054', 'Sushi Bar Nord', 'Sushi Nord GmbH', '16:00', 'Berlin 午班', '已出库', '€1,125.40')],
      productionRequest: ['制作生产计划', '订购拉面面条和拉面汁，选择需要入库时间后发送生产部门。', productionRequestDetail()],
      productionSchedule: ['生产排程', '安排生产线、时间、负责人和预计完成时间。', productionScheduleDetail()],
      productionMaterial: ['自产产品生产关系', '维护自产成品和原料之间的用量、损耗率、产出单位和扣减规则。', productionMaterialDetail()],
      productionTonkotsu: ['Tonkotsu Base 2kg · 生产单', '待排产生产单，可确认原料扣减并安排生产。', productionOrderDetail('PRD-REQ-1024', 'Tonkotsu Base 2kg', '80 桶', '汤底线', '待排产')],
      productionNoodles: ['Special Noodles 1kg · 生产单', '生产中，可更新进度并准备成品入库。', productionOrderDetail('PRD-REQ-1023', 'Special Noodles 1kg', '240 包', '制面线', '生产中')],
      productionGyoza: ['Gyoza Mix 50pc · 生产单', '生产完成后质检，确认成品入冷冻库。', productionOrderDetail('PRD-REQ-1022', 'Gyoza Mix 50pc', '160 箱', '冷冻线', '待入库')],
      stockIn: ['新增入库', '展示版库存入库。', inventoryForm('新入库', 'Berlin Warehouse', '0')],
      restockTonkotsu: ['Tonkotsu Base 2kg 补货', '库存低于安全线。', inventoryForm('Tonkotsu Base 2kg', 'Berlin Warehouse', '12 包')],
      inventoryGyoza: ['Gyoza Mix 50pc', '库存详情。', inventoryForm('Gyoza Mix 50pc', 'Hamburg Cold Storage', '76 箱')],
      inventoryNoodles: ['Special Noodles 1kg', '库存详情。', inventoryForm('Special Noodles 1kg', 'Berlin Warehouse', '24 包')],
      productPriceNoodle: ['Ramen Noodle I4 · 价格等级设置', '维护 webshop 中不同价格等级、对应售价、成本和毛利。', productPriceSettings('Ramen Noodle I4', 'F432', '€18.60', '€31.80', '€30.60', '€29.80')],
      productPricePaitan: ['Chicken Paitan · 价格等级设置', '维护 webshop 中不同价格等级、对应售价、成本和毛利。', productPriceSettings('Chicken Paitan', 'F431', '€31.20', '€48.60', '€46.80', '€44.90')],
      productPriceMiso: ['Miso Tare · 价格等级设置', '维护 webshop 中不同价格等级、对应售价、成本和毛利。', productPriceSettings('Miso Tare', 'F480', '€35.40', '€56.20', '€54.80', '€52.40')],
      productPriceSpicy: ['Spicy Miso Tare · 价格等级设置', '维护 webshop 中不同价格等级、对应售价、成本和毛利。', productPriceSettings('Spicy Miso Tare', 'F490', '€37.80', '€59.90', '€57.60', '€55.20')],
      productPriceGyoza: ['Gyoza Mix 50pc · 价格等级设置', '维护 webshop 中不同价格等级、对应售价、成本和毛利。', productPriceSettings('Gyoza Mix 50pc', 'GM-50', '€14.80', '€21.40', '€20.90', '€20.20')],
      productPriceRice: ['寿司米 10kg · 价格等级设置', '维护 webshop 中不同价格等级、对应售价、成本和毛利。', productPriceSettings('寿司米 10kg', 'JFC-RICE-10', '€18.20', '€24.50', '€23.80', '€22.90')]
    };

    function filterOrderCatalog() {
      const ordering = document.querySelector('[data-mode="order"]').classList.contains('active');
      const supplier = document.querySelector('[data-supplier-name].active')?.dataset.supplierName;
      const scope = document.querySelector('[data-order-catalog].active')?.dataset.orderCatalog;
      document.querySelector('[data-order-catalog-tabs]').hidden = !ordering;
      document.querySelectorAll('[data-order-catalog]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.orderCatalog === scope));
      });
      let visible = 0;
      // 原型中的收藏标记仅用于演示筛选，不代表真实采购历史。
      document.querySelectorAll('.warehouse-product-card').forEach(card => {
        card.hidden = ordering && ((supplier !== '全部供货商' && card.dataset.catalogSupplier !== supplier)
          || (scope === 'favorites' && card.dataset.catalogFavorite !== 'true'));
        if (!card.hidden) visible++;
      });
      document.querySelector('[data-order-catalog-empty]').hidden = !ordering || visible > 0;
    }

    function goToPage(name) {
      pages.forEach(page => page.classList.toggle('active', page.dataset.page === name));
      navButtons.forEach(button => button.classList.toggle('active', button.dataset.pageTarget === name));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.goToPage = goToPage;

    function openPersonalization(customer, templateName) {
      const customerNode = document.getElementById('personalCustomer');
      if (customerNode) customerNode.textContent = customer;
      const saved = customerPriceConfigs.get(customer);
      const selectedTemplate = saved
        ? priceTemplates.find(template => template.id === saved.templateId) || { name: null, levels: saved.levels }
        : resolvePriceTemplate(templateName) || priceTemplates[0];
      templateManagerSelectedId = selectedTemplate?.id || null;
      renderPersonalTemplateRadios(selectedTemplate?.name);
      const templateAlert = document.getElementById('templateMismatchAlert');
      const templateNameInput = document.getElementById('newTemplateName');
      if (templateAlert) templateAlert.classList.remove('show');
      if (templateNameInput) templateNameInput.value = `${customer} 专属模板`;
      applyPriceTemplateToCatalog(selectedTemplate);
      goToPage('personalization');
    }
    window.openPersonalization = openPersonalization;

    function showToast(message) {
      toast.textContent = message;
      toast.classList.add('show');
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => toast.classList.remove('show'), 1800);
    }

    function getInventoryProduct(id) {
      return inventoryProducts.find(item => item.id === id) || null;
    }

    function getInventorySpec(productId, specId) {
      return getInventoryProduct(productId)?.specs.find(spec => spec.id === specId) || null;
    }

    function parseInventoryQuantity(value) {
      const normalized = String(value || '').trim().replace(/\s+/g, '');
      const decimalMatch = normalized.match(/^\d+(?:\.\d+)?$/);
      if (decimalMatch && Number.isFinite(Number(normalized)) && Number(normalized) > 0) return normalized;
      const fractionMatch = normalized.match(/^(\d+)\/(\d+)$/);
      if (fractionMatch && Number.isFinite(Number(fractionMatch[1])) && Number.isFinite(Number(fractionMatch[2])) && Number(fractionMatch[1]) > 0 && Number(fractionMatch[2]) > 0) return normalized;
      return null;
    }

    function inventoryProductLabel(product) {
      const sku = product.sku ? ` · SKU ${product.sku}` : '';
      return `${product.name} · ${product.supplier}${sku}`;
    }

    function readProductMapping(root) {
      return {
        inventoryProductId: root.querySelector('[data-inventory-product]')?.value || '',
        inventorySpecId: root.querySelector('[data-inventory-spec]')?.value || '',
        quantity: root.querySelector('[data-inventory-quantity]')?.value.trim() || ''
      };
    }

    function productMappingSummary(mapping) {
      const product = getInventoryProduct(mapping.inventoryProductId);
      if (!product) return '当前未绑定库存商品；可在这里选择库存商品、规格和扣减数量。';
      const spec = getInventorySpec(mapping.inventoryProductId, mapping.inventorySpecId);
      if (!spec) return `已选择库存商品：${product.name} · ${product.supplier}，请选择库存规格。`;
      if (!mapping.quantity) return `已选择库存规格：${spec.label}，请输入每售卖 1 份的扣减数量。`;
      return `每售卖 1 份，扣减 ${mapping.quantity} ${spec.label}；库存商品：${product.name} · ${product.supplier}`;
    }

    function inventoryMappingDetail(sku) {
      const mapping = productMappings.get(sku) || {};
      const selectedProduct = getInventoryProduct(mapping.inventoryProductId);
      const suppliers = [...new Set(inventoryProducts.map(product => product.supplier))];
      const productOptions = [
        '<option value="">未绑定库存商品</option>',
        ...inventoryProducts.map(product => `<option value="${product.id}" data-inventory-option data-inventory-search="${escapeHtml(`${product.name} ${product.sku || ''} ${product.supplier}`.toLowerCase())}"${product.id === mapping.inventoryProductId ? ' selected' : ''}>${escapeHtml(inventoryProductLabel(product))}</option>`)
      ].join('');
      const specOptions = selectedProduct
        ? [`<option value="">请选择库存规格</option>`, ...selectedProduct.specs.map(spec => `<option value="${spec.id}"${spec.id === mapping.inventorySpecId ? ' selected' : ''}>${escapeHtml(spec.label)} · 当前库存 ${escapeHtml(spec.stock)}</option>`)].join('')
        : '<option value="">请先选择库存商品</option>';
      return `
        <div class="detail-block inventory-mapping" data-inventory-mapping data-product-sku="${escapeHtml(sku)}">
          <div class="card-head" style="margin-bottom:0">
            <div>
              <h3>关联库存商品</h3>
              <p class="sub">商品管理与库存管理分开维护；这里选择销售商品对应的库存商品和库存规格。</p>
            </div>
            <span class="badge blue">单商品单库存记录</span>
          </div>
          <div class="form-grid">
            <div class="field">
              <label for="inventorySearch-${escapeHtml(sku)}">搜索库存商品</label>
              <input id="inventorySearch-${escapeHtml(sku)}" type="search" data-inventory-search placeholder="搜索名称或 SKU">
            </div>
            <div class="field">
              <label for="inventorySupplier-${escapeHtml(sku)}">供货商筛选</label>
              <select id="inventorySupplier-${escapeHtml(sku)}" data-inventory-supplier>
                <option value="">全部供货商</option>
                ${suppliers.map(supplier => `<option value="${escapeHtml(supplier)}">${escapeHtml(supplier)}</option>`).join('')}
              </select>
            </div>
            <div class="field full">
              <label for="inventoryProduct-${escapeHtml(sku)}">库存商品</label>
              <select id="inventoryProduct-${escapeHtml(sku)}" data-inventory-product>${productOptions}</select>
              <span class="field-error" data-inventory-error="product" role="alert" hidden></span>
            </div>
            <div class="field">
              <label for="inventorySpec-${escapeHtml(sku)}">库存规格</label>
              <select id="inventorySpec-${escapeHtml(sku)}" data-inventory-spec>${specOptions}</select>
              <span class="field-error" data-inventory-error="spec" role="alert" hidden></span>
            </div>
            <div class="field">
              <label for="inventoryQuantity-${escapeHtml(sku)}">每售卖 1 份扣减数量</label>
              <input id="inventoryQuantity-${escapeHtml(sku)}" type="text" inputmode="decimal" data-inventory-quantity value="${escapeHtml(mapping.quantity || '')}" placeholder="例如 1、0.5 或 1/6">
              <span class="field-error" data-inventory-error="quantity" role="alert" hidden></span>
            </div>
          </div>
          <div class="mapping-summary" data-inventory-summary>${escapeHtml(productMappingSummary(mapping))}</div>
        </div>`;
    }

    function refreshInventoryMapping(root) {
      const mapping = readProductMapping(root);
      const product = getInventoryProduct(mapping.inventoryProductId);
      const specSelect = root.querySelector('[data-inventory-spec]');
      const currentSpec = mapping.inventorySpecId;
      if (specSelect && product) {
        specSelect.innerHTML = [`<option value="">请选择库存规格</option>`, ...product.specs.map(spec => `<option value="${spec.id}"${spec.id === currentSpec ? ' selected' : ''}>${escapeHtml(spec.label)} · 当前库存 ${escapeHtml(spec.stock)}</option>`)].join('');
      } else if (specSelect) {
        specSelect.innerHTML = '<option value="">请先选择库存商品</option>';
      }
      const summary = root.querySelector('[data-inventory-summary]');
      if (summary) summary.textContent = productMappingSummary(readProductMapping(root));
    }

    function filterInventoryProducts(root) {
      const search = root.querySelector('[data-inventory-search]')?.value.trim().toLowerCase() || '';
      const supplier = root.querySelector('[data-inventory-supplier]')?.value || '';
      const productSelect = root.querySelector('[data-inventory-product]');
      if (!productSelect) return;
      const selected = getInventoryProduct(productSelect.value);
      if (selected && supplier && selected.supplier !== supplier) {
        productSelect.value = '';
        refreshInventoryMapping(root);
      }
      productSelect.querySelectorAll('[data-inventory-option]').forEach(option => {
        const matchesSearch = !search || option.dataset.inventorySearch.includes(search);
        const matchesSupplier = !supplier || getInventoryProduct(option.value)?.supplier === supplier;
        option.hidden = !(matchesSearch && matchesSupplier);
      });
    }

    function setInventoryError(root, field, message) {
      const error = root.querySelector(`[data-inventory-error="${field}"]`);
      const input = root.querySelector(`[data-inventory-${field}]`);
      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }
      if (input) {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
    }

    function validateProductMapping(root) {
      ['product', 'spec', 'quantity'].forEach(field => setInventoryError(root, field, ''));
      const mapping = readProductMapping(root);
      if (!mapping.inventoryProductId && !mapping.inventorySpecId && !mapping.quantity) return { valid: true, mapping: null };
      if (!mapping.inventoryProductId) {
        setInventoryError(root, 'product', '请选择库存商品，或清空其他映射字段');
        return { valid: false };
      }
      if (!mapping.inventorySpecId) {
        setInventoryError(root, 'spec', '请选择库存规格');
        return { valid: false };
      }
      const quantity = parseInventoryQuantity(mapping.quantity);
      if (!quantity) {
        setInventoryError(root, 'quantity', '请输入大于 0 的小数或分数，例如 0.5 或 1/6');
        return { valid: false };
      }
      return { valid: true, mapping: { ...mapping, quantity } };
    }

    function productLevelRows(prices = []) {
      return templateLevels.map(([level, label], index) => `<tr>
        <td><strong>${index === 0 ? '默认' : ''}${label}</strong></td>
        <td><input class="control" data-product-price="${level}" type="text" value="${escapeHtml(prices[index] || '')}" placeholder="请输入售价" aria-label="${label}售价" style="width:110px"></td>
        <td>—</td><td>—</td>
        <td><select class="select" aria-label="${label}启用状态"><option>启用</option><option>停用</option></select></td>
        <td>${index < 3 ? '现有价格等级' : '待设置价格'}</td>
      </tr>`).join('');
    }

    function productBrandField(brandId = '') {
      return `<div class="field"><label for="productBrand">品牌</label><select id="productBrand" data-product-field="brandId"><option value="">无品牌</option>${inventoryBrands.map(brand => `<option value="${escapeHtml(brand.id)}"${brand.id === brandId ? ' selected' : ''}>${escapeHtml(brand.name)}</option>`).join('')}</select></div>`;
    }

    function productCardDescription(record) {
      const brand = inventoryBrands.find(item => item.id === record.brandId);
      return [brand?.name, record.specification || '售卖规格待设置', record.source || '未设置来源'].filter(Boolean).join(' · ');
    }

    function newProductDetail() {
      const defaultPrices = ['', '', ''];
      return `
        <div class="product-editor" data-product-editor data-product-mode="new" data-product-drawer="newProduct" data-product-sku="__new__">
          <div class="detail-block">
            <div class="card-head" style="margin-bottom:0">
              <div><h3>商品基本信息</h3><p class="sub">新增一个 webshop 售卖商品，再选择它对应的库存商品。</p></div>
              <span class="badge blue">新增商品</span>
            </div>
            <div class="form-grid">
              <div class="field"><label for="newProductName">商品名</label><input id="newProductName" data-product-field="name" value="新商品"><span class="field-error" data-product-error="name" role="alert" hidden></span></div>
              <div class="field"><label for="newProductSku">SKU / Lieferantencode</label><input id="newProductSku" data-product-field="sku" value="F500" placeholder="例如 F500"><span class="field-error" data-product-error="sku" role="alert" hidden></span></div>
              <div class="field"><label>商品来源</label><select data-product-field="source"><option>自产产品</option><option>进货产品</option></select></div>
              <div class="field"><label>分类</label><select data-product-field="category"><option>拉面面条 / 拉面汁</option><option>冷冻 / 调味</option><option>未分组</option></select></div>
              ${productBrandField()}
              <div class="field full"><label for="newProductSpecification">售卖规格</label><input id="newProductSpecification" data-product-field="specification" value="" placeholder="例如 500ml / 1 瓶"></div>
              <div class="field"><label for="newProductCost">成本价</label><input id="newProductCost" data-product-field="cost" value="" placeholder="例如 €12.00"></div>
              <div class="field"><label>默认上下架</label><select data-product-field="status"><option>上架</option><option>下架</option></select></div>
            </div>
          </div>
          <div class="table-card product-price-levels" style="margin-top:14px">
            <div class="card-head"><div><h3>价格等级</h3><p class="sub">最多维护 10 个等级，客户按商品选择对应等级。</p></div></div>
            <table style="min-width:760px"><thead><tr><th>价格等级</th><th>对应售价</th><th>适用客户</th><th>预计毛利</th><th>启用</th><th>备注</th></tr></thead><tbody>${productLevelRows(defaultPrices)}</tbody></table>
          </div>
          ${inventoryMappingDetail('__new__')}
          <div class="detail-block" style="margin-top:14px"><h3>其他设置</h3><div class="form-grid"><div class="field"><label>最小订购量</label><input data-product-field="minimumOrder" value="1"></div><div class="field full"><label>顾客可见备注</label><textarea data-product-field="customerNote">价格按当前客户价格等级显示。</textarea></div></div></div>
          <div class="actions" style="margin-top:14px"><button class="btn" type="button" data-product-cancel>取消</button><button class="btn primary" type="button" data-product-save>保存商品</button></div>
        </div>`;
    }

    function productRecordForDrawer(key) {
      return productDrawerRecords[key] || null;
    }

    function productCardInitials(name) {
      return escapeHtml([...String(name || '商品')].slice(0, 2).join(''));
    }

    function productCardMapping(record) {
      const mapping = productMappings.get(record.sku);
      const product = mapping && getInventoryProduct(mapping.inventoryProductId);
      const spec = mapping && getInventorySpec(mapping.inventoryProductId, mapping.inventorySpecId);
      return {
        inventory: product ? `${product.name} · ${product.stock}` : '未绑定库存商品',
        quantity: product && spec && mapping.quantity ? `${mapping.quantity} ${spec.label}` : '未设置'
      };
    }

    function createProductCard(record, drawerKey) {
      const status = record.status || '上架';
      const specification = record.specification || '售卖规格待设置';
      const source = record.source || '未设置来源';
      const mapping = productCardMapping(record);
      return `<article class="product-manage-card" data-product-drawer="${escapeHtml(drawerKey)}" data-product-sku="${escapeHtml(record.sku)}">
        <button class="product-edit-delete" type="button" data-product-delete aria-label="删除商品">×</button>
        <div class="shop-photo product-placeholder" role="img" aria-label="${escapeHtml(record.name)}"><strong>${productCardInitials(record.name)}</strong></div>
        <div class="product-manage-body"><div><h3>${escapeHtml(record.name)}${record.sku ? ` <span class="shop-product-code">${escapeHtml(record.sku)}</span>` : ''}</h3><small>${escapeHtml(productCardDescription(record))}</small></div><div class="product-stock-grid"><div><span>关联库存</span><strong>${escapeHtml(mapping.inventory)}</strong></div><div><span>每售卖 1 份扣减</span><strong>${escapeHtml(mapping.quantity)}</strong></div></div></div>
        <div class="product-card-actions"><select class="select"><option${status === '上架' ? ' selected' : ''}>上架</option><option${status === '下架' ? ' selected' : ''}>下架</option></select><button class="chevron-btn" type="button" data-open-drawer="${escapeHtml(drawerKey)}" aria-label="商品详情"><svg class="icon" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></div>
      </article>`;
    }

    function updateProductCard(record, drawerKey) {
      const card = document.querySelector(`[data-product-drawer="${drawerKey}"]`);
      if (!card) return;
      const title = card.querySelector('.product-manage-body h3');
      const small = card.querySelector('.product-manage-body small');
      const mapping = productCardMapping(record);
      if (title) title.innerHTML = `${escapeHtml(record.name)}${record.sku ? ` <span class="shop-product-code">${escapeHtml(record.sku)}</span>` : ''}`;
      if (small) small.textContent = productCardDescription(record);
      const mappingCells = card.querySelectorAll('.product-stock-grid strong');
      card.dataset.productSku = record.sku;
      if (mappingCells[0]) mappingCells[0].textContent = mapping.inventory;
      if (mappingCells[1]) mappingCells[1].textContent = mapping.quantity;
    }

    function saveProductEditor(root) {
      const validation = validateProductMapping(root);
      if (!validation.valid) {
        showToast('请先完善库存商品映射');
        return;
      }
      const mode = root.dataset.productMode;
      const drawerKey = root.dataset.productDrawer;
      const nameInput = root.querySelector('[data-product-field="name"]');
      const skuInput = root.querySelector('[data-product-field="sku"]');
      const name = nameInput?.value.trim() || '';
      const sku = skuInput?.value.trim() || '';
      if (!name) {
        const error = root.querySelector('[data-product-error="name"]');
        if (error) { error.textContent = '请输入商品名'; error.hidden = false; }
        nameInput?.setAttribute('aria-invalid', 'true');
        nameInput?.focus();
        return;
      }
      if (mode === 'new' && !sku) {
        const error = root.querySelector('[data-product-error="sku"]');
        if (error) { error.textContent = '请输入 SKU / Lieferantencode'; error.hidden = false; }
        skuInput?.setAttribute('aria-invalid', 'true');
        skuInput?.focus();
        return;
      }
      const duplicate = Object.entries(productDrawerRecords).find(([key, item]) => key !== drawerKey && item.sku === sku);
      if (duplicate) {
        const error = root.querySelector('[data-product-error="sku"]');
        if (error) { error.textContent = '该 SKU 已存在，请换一个 SKU'; error.hidden = false; }
        skuInput?.setAttribute('aria-invalid', 'true');
        skuInput?.focus();
        return;
      }
      const mapping = validation.mapping;
      const record = mode === 'new'
        ? { name, sku, brandId: root.querySelector('[data-product-field="brandId"]').value, specification: root.querySelector('[data-product-field="specification"]')?.value.trim() || '', source: root.querySelector('[data-product-field="source"]')?.value || '', category: root.querySelector('[data-product-field="category"]')?.value || '', cost: root.querySelector('[data-product-field="cost"]')?.value.trim() || '', status: root.querySelector('[data-product-field="status"]')?.value || '上架', prices: [...root.querySelectorAll('[data-product-price]')].map(input => input.value.trim()) }
        : productRecordForDrawer(drawerKey);
      if (!record) return;
      if (mode === 'edit') {
        const oldSku = record.sku;
        record.brandId = root.querySelector('[data-product-field="brandId"]').value;
        record.specification = root.querySelector('[data-product-field="specification"]').value.trim();
        record.name = name || record.name;
        record.sku = sku || record.sku;
        record.cost = root.querySelector('[data-product-field="cost"]')?.value.trim() || record.cost;
        record.prices = [...root.querySelectorAll('[data-product-price]')].map(input => input.value.trim());
        if (oldSku !== record.sku && productMappings.has(oldSku)) productMappings.set(record.sku, productMappings.get(oldSku));
        if (oldSku !== record.sku) productMappings.delete(oldSku);
      } else {
        productDrawerRecords[`productPriceNew${nextProductDrawerId++}`] = record;
        const newKey = Object.keys(productDrawerRecords).find(key => productDrawerRecords[key] === record);
        if (mapping) productMappings.set(record.sku, mapping);
        document.querySelector('.product-manage-grid')?.insertAdjacentHTML('beforeend', createProductCard(record, newKey));
      }
      const mappingKey = record.sku;
      if (mapping) productMappings.set(mappingKey, mapping);
      else productMappings.delete(mappingKey);
      if (mode === 'edit') updateProductCard(record, drawerKey);
      closeDrawer();
      showToast(mode === 'new' ? '已保存商品并加入商品目录（本页演示）' : '已保存商品详情和库存映射（本页演示）');
    }

    function openDrawer(key) {
      const record = productRecordForDrawer(key);
      const item = key === 'newProduct'
        ? ['新增商品', '维护商品基本信息、价格等级和关联库存商品。', newProductDetail()]
        : record
          ? [`${record.name} · 商品详情`, '维护商品基本信息、价格等级和关联库存商品。', productPriceSettings(record.name, record.sku, record.cost, ...(record.prices || []).slice(0, 3), key, record.prices || [])]
          : drawerTemplates[key] || ['详情', '前端展示数据', '<p>暂无内容。</p>'];
      drawerTitle.textContent = item[0];
      drawerSubtitle.textContent = item[1];
      drawerBody.innerHTML = item[2];
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    }

    function templateManagerDetail(selectedId) {
      const selectedTemplate = priceTemplates.find(template => template.id === selectedId);
      const isNew = !selectedTemplate;
      templateManagerDraft = selectedTemplate
        ? clonePriceTemplate(selectedTemplate)
        : { id: null, name: '', originalName: '', levels: makeTemplateLevels('1') };
      templateManagerSelectedId = selectedTemplate?.id || null;
      const templateOptions = [
        ...(isNew ? ['<option value="" selected>新建模板</option>'] : []),
        ...priceTemplates.map(template => `<option value="${escapeHtml(template.id)}"${template.id === selectedTemplate?.id ? ' selected' : ''}>${escapeHtml(template.name)}</option>`)
      ].join('');
      const levelOptions = templateLevels.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
      const productRows = templateProducts.map(([sku, name, specification]) => {
        const currentLevel = templateManagerDraft.levels[sku] || '1';
        return `<tr>
          <td><strong>${escapeHtml(name)}</strong><br><span style="color:var(--muted)">${escapeHtml(sku)} · ${escapeHtml(specification)}</span></td>
          <td><select class="control" data-template-level="${escapeHtml(sku)}" aria-label="${escapeHtml(name)}价格等级">${levelOptions.replace(`value="${currentLevel}"`, `value="${currentLevel}" selected`)}</select></td>
        </tr>`;
      }).join('');
      return `
        <div class="detail-block">
          <div class="card-head" style="margin-bottom:0">
            <div>
              <h3>共享价格模板</h3>
              <p class="sub">模板由每个商品对应的价格等级组成，保存当前模板后，下方商品卡片同步更新。</p>
            </div>
            <button class="btn" type="button" data-template-create>新建模板</button>
          </div>
          <div class="field">
            <label for="templateManagerSelect">查看模板</label>
            <select id="templateManagerSelect" class="control" data-template-manager-select>${templateOptions}</select>
          </div>
          <div class="field">
            <label for="templateManagerName">模板名称</label>
            <input class="control" id="templateManagerName" data-template-name value="${escapeHtml(templateManagerDraft.name)}" aria-describedby="templateManagerError">
            <p class="template-manager-error" id="templateManagerError" hidden></p>
          </div>
        </div>
        <div class="table-card">
          <table style="min-width:560px">
            <thead><tr><th>商品</th><th>客户使用的价格等级</th></tr></thead>
            <tbody>${productRows}</tbody>
          </table>
        </div>
        <p class="sub">本页为原型演示；刷新页面后恢复示例数据。</p>
        <div class="actions">
          <button class="btn" type="button" data-template-manager-cancel>取消</button>
          <button class="btn primary" type="button" data-template-manager-save>保存并应用</button>
        </div>`;
    }

    function renderTemplateManager() {
      drawerBody.innerHTML = templateManagerDetail(templateManagerSelectedId);
    }

    function openTemplateManager() {
      const selectedRadio = document.querySelector('[name="priceTemplate"]:checked');
      const selectedTemplate = resolvePriceTemplate(selectedRadio?.value);
      if (!priceTemplates.some(template => template.id === templateManagerSelectedId)) {
        templateManagerSelectedId = selectedTemplate?.id || priceTemplates[0]?.id || null;
      }
      drawerTitle.textContent = '价格模板管理';
      drawerSubtitle.textContent = '查看、创建和修改共享价格模板。';
      renderTemplateManager();
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
    }

    function setTemplateManagerError(message) {
      const input = document.getElementById('templateManagerName');
      const error = document.getElementById('templateManagerError');
      if (input) {
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      }
      if (error) {
        error.textContent = message;
        error.hidden = !message;
      }
    }

    function readTemplateManagerDraft() {
      if (!templateManagerDraft) return null;
      const nameInput = document.getElementById('templateManagerName');
      templateManagerDraft.name = nameInput?.value.trim() || '';
      templateProducts.forEach(([sku]) => {
        const levelInput = document.querySelector(`[data-template-level="${sku}"]`);
        if (levelInput) templateManagerDraft.levels[sku] = levelInput.value;
      });
      return templateManagerDraft;
    }

    function saveTemplateManager() {
      const draft = readTemplateManagerDraft();
      if (!draft?.name) {
        setTemplateManagerError('请输入模板名称');
        document.getElementById('templateManagerName')?.focus();
        showToast('请先填写模板名称');
        return;
      }
      const duplicate = priceTemplates.find(template => template.name === draft.name && template.id !== draft.id);
      if (duplicate) {
        setTemplateManagerError('模板名称已存在，请换一个名称');
        document.getElementById('templateManagerName')?.focus();
        showToast('模板名称已存在');
        return;
      }
      if (draft.id && !window.confirm('更新此共享模板将影响所有明确使用它的客户；仅保存的客户自定义配置不受影响。确认更新？')) return;
      const selectedRadio = document.querySelector('[name="priceTemplate"]:checked');
      const selectedRadioTemplate = resolvePriceTemplate(selectedRadio?.value);
      if (draft.id) {
        const target = priceTemplates.find(template => template.id === draft.id);
        if (target) {
          if (target.name !== draft.name) templateNameAliases.set(target.name, target.id);
          target.name = draft.name;
          target.levels = { ...draft.levels };
          templateManagerSelectedId = target.id;
        }
      } else {
        const created = { id: `template-${nextTemplateId++}`, name: draft.name, levels: { ...draft.levels } };
        priceTemplates.push(created);
        templateManagerSelectedId = created.id;
      }
      renderPersonalTemplateRadios(selectedRadioTemplate?.name || null);
      if (draft.id === selectedRadioTemplate?.id) applyPriceTemplateToCatalog(selectedRadioTemplate);
      renderTemplateManager();
      showToast(`已保存共享价格模板“${draft.name}”，已更新本页模板配置`);
    }

    function closeDrawer() {
      drawer.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
    }

    function customerForm(name, city, email, status) {
      return `
        <div class="form-grid">
          <div class="field full"><label>客户名称</label><input value="${name}"></div>
          <div class="field"><label>城市</label><input value="${city}"></div>
          <div class="field"><label>审核状态</label><select><option>${status}</option><option>待审核</option><option>已通过</option><option>已暂停</option></select></div>
          <div class="field full"><label>邮箱</label><input value="${email}"></div>
          <div class="field"><label>账期</label><select><option>Net 14</option><option>Net 30</option><option>Prepaid</option></select></div>
          <div class="field"><label>客户等级</label><select><option>普通</option><option>重点客户</option></select></div>
          <div class="field full"><label>备注</label><textarea>这里可以放客户审核意见、配送要求和专属产品说明。</textarea></div>
        </div>
        <div class="actions" style="margin-top:14px"><button class="btn" type="button" data-close-drawer>取消</button><button class="btn primary" type="button" data-toast="已模拟保存客户">保存</button></div>`;
    }

    function basicInfoDetail(customer, contact, status, billingAddress, deliveryAddress, phone, email) {
      const statusClass = status === '完整' ? 'green' : 'red';
      const billing = splitAddress(billingAddress);
      const delivery = splitAddress(deliveryAddress);
      return `
        <div class="detail-block" style="margin-top:14px">
          <div class="card-head" style="margin-bottom:0">
            <h3>基础信息状态</h3>
            <span class="badge ${statusClass}">${status}</span>
          </div>
          <div class="form-grid">
            <div class="field full"><label>客户名称</label><input value="${customer}"></div>
            <div class="field"><label>账单地址 · 街道</label><input value="${billing.street}"></div>
            <div class="field"><label>账单地址 · 街道号</label><input value="${billing.houseNumber}"></div>
            <div class="field"><label>账单地址 · 邮编</label><input value="${billing.postcode}"></div>
            <div class="field"><label>账单地址 · 城市</label><input value="${billing.city}"></div>
            <div class="field"><label>送货地址 · 街道</label><input value="${delivery.street}"></div>
            <div class="field"><label>送货地址 · 街道号</label><input value="${delivery.houseNumber}"></div>
            <div class="field"><label>送货地址 · 邮编</label><input value="${delivery.postcode}"></div>
            <div class="field"><label>送货地址 · 城市</label><input value="${delivery.city}"></div>
            <div class="field"><label>联系人</label><input value="${contact}"></div>
            <div class="field"><label>电话</label><input value="${phone}"></div>
            <div class="field full"><label>邮箱</label><input value="${email}"></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟一键发送基础信息补全提醒">一键发送提醒</button>
          <button class="btn primary" type="button" data-toast="已模拟保存基础信息">编辑并保存</button>
        </div>`;
    }

    function splitAddress(value) {
      const empty = { street: '', houseNumber: '', postcode: '', city: '' };
      if (!value || value.includes('缺少')) return empty;
      const match = value.match(/^(.+?)\s+([^,\s]+),\s*(\d{5})\s+(.+)$/);
      if (!match) return { ...empty, street: value };
      return {
        street: match[1],
        houseNumber: match[2],
        postcode: match[3],
        city: match[4]
      };
    }

    function gewerbeDetail(customer, status) {
      const complete = status === '完整';
      return `
        <div class="detail-block">
          <div class="card-head" style="margin-bottom:0">
            <h3>Gewerbeanmeldung</h3>
            <span class="badge ${complete ? 'green' : 'red'}">${status}</span>
          </div>
          <div class="info-list">
            <div class="info-row"><span>客户</span><strong>${customer}</strong></div>
            <div class="info-row"><span>文件状态</span><strong>${complete ? '已上传，可查看' : '尚未上传'}</strong></div>
            <div class="info-row"><span>文件名</span><strong>${complete ? customer.replaceAll(' ', '_') + '_Gewerbeanmeldung.pdf' : '缺失'}</strong></div>
            <div class="info-row"><span>审核备注</span><strong>${complete ? '营业登记信息清晰，可用于客户审核。' : '需要客户上传 Gewerbeanmeldung 后才能完成审核。'}</strong></div>
          </div>
        </div>
        <div class="upload-box" style="margin-top:14px">
          <strong>上传或替换文件</strong>
          <span class="sub">展示版上传区域：可用于告诉程序员这里需要文件上传控件和文件预览。</span>
          <input type="file" aria-label="上传 Gewerbeanmeldung 文件">
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟一键发送 Gewerbeanmeldung 上传提醒">一键发送提醒</button>
          <button class="btn" type="button" data-toast="已模拟查看 Gewerbeanmeldung">查看文件</button>
          <button class="btn primary" type="button" data-toast="已模拟上传 Gewerbeanmeldung">上传</button>
        </div>`;
    }

    function customerFullDetail(customer, contact, city, status, basicStatus, gewerbeStatus) {
      const missingItems = [];
      if (basicStatus !== '完整') missingItems.push('基础信息');
      if (gewerbeStatus !== '完整') missingItems.push('Gewerbeanmeldung');
      const missingText = missingItems.length ? missingItems.join('、') : '暂无缺失材料';
      const emailText = missingItems.length
        ? `您好 ${contact}，\n\n为了完成 ${customer} 的客户审核，请补充以下材料：${missingText}。\n\n您可以直接回复邮件或在客户入口上传文件。谢谢。`
        : `您好 ${contact}，\n\n${customer} 的客户资料目前完整。如后续资料变更，请及时更新账单地址、送货地址和联系人信息。谢谢。`;
      const reviewAction = status === '已通过'
        ? '<button class="btn danger" type="button" data-toast="已模拟停用客户">停用</button>'
        : '<button class="btn primary" type="button" data-toast="已模拟通过客户审核">通过</button>';
      const generateButton = missingItems.length
        ? '<button class="btn" type="button" data-toast="已模拟智能生成缺材料邮件">智能生成邮件</button>'
        : '';
      return `
        <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="stat"><span>客户状态</span><strong style="font-size:20px">${status}</strong><small>${city}</small></div>
          <div class="stat"><span>付款情况</span><strong style="font-size:20px">€0 overdue</strong><small>账期正常</small></div>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>基础信息</h3>
          <div class="info-list">
            <div class="info-row"><span>联系人</span><strong>${contact}</strong></div>
            <div class="info-row"><span>电话</span><strong>${basicStatus === '完整' ? '+49 30 8842 1100' : '缺失'}</strong></div>
            <div class="info-row"><span>邮箱</span><strong>${customer.toLowerCase().replaceAll(' ', '')}@example.de</strong></div>
            <div class="info-row"><span>账单地址</span><strong>${basicStatus === '完整' ? city + ' billing address' : '缺失'}</strong></div>
            <div class="info-row"><span>送货地址</span><strong>${city} delivery address</strong></div>
            <div class="info-row"><span>资料状态</span><strong>${basicStatus}</strong></div>
          </div>
        </div>
        <div class="detail-block">
          <h3>客户材料</h3>
          <div class="info-list">
            <div class="info-row"><span>Gewerbeanmeldung</span><strong>${gewerbeStatus}</strong></div>
            <div class="info-row"><span>营业执照/注册资料</span><strong>${gewerbeStatus === '完整' ? '已上传' : '缺失'}</strong></div>
            <div class="info-row"><span>个性化配置</span><strong>老客1 / 加盟商 / 散户1 可在表格按钮中调整</strong></div>
          </div>
        </div>
        <div class="detail-block">
          <h3>历史订单</h3>
          <div class="table-card">
            <table style="min-width:0">
              <thead><tr><th>订单</th><th>日期</th><th>金额</th><th>状态</th></tr></thead>
              <tbody>
                <tr><td>ORD-2051</td><td>明天配送</td><td>€842.50</td><td><span class="badge orange">待确认</span></td></tr>
                <tr><td>ORD-2038</td><td>上周</td><td>€516.20</td><td><span class="badge green">已完成</span></td></tr>
                <tr><td>ORD-2027</td><td>上月</td><td>€724.10</td><td><span class="badge green">已付款</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="detail-block">
          <h3>付款情况</h3>
          <div class="info-list">
            <div class="info-row"><span>账期</span><strong>Net 14</strong></div>
            <div class="info-row"><span>未付款</span><strong>€0.00</strong></div>
            <div class="info-row"><span>最近付款</span><strong>€724.10 · 已到账</strong></div>
            <div class="info-row"><span>风险提示</span><strong>正常</strong></div>
          </div>
        </div>
        <div class="detail-block">
          <div class="card-head" style="margin-bottom:0">
            <h3>邮件提醒</h3>
            <span class="badge ${missingItems.length ? 'orange' : 'green'}">${missingItems.length ? '缺材料' : '资料完整'}</span>
          </div>
          <div class="field">
            <label>智能邮件内容</label>
            <textarea>${emailText}</textarea>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          ${generateButton}
          <button class="btn" type="button" data-toast="已模拟一键发送客户邮件">一键发送</button>
          ${reviewAction}
          <button class="btn" type="button" data-toast="已模拟保存客户档案">保存档案</button>
        </div>`;
    }

    function productConfigForm(customer, product, price) {
      return priceConfigDetail(customer, '老客1');
    }

    function productPriceSettings(product, sku, cost, level1, level2, level3, drawerKey = '', prices = []) {
      const record = productDrawerRecords[drawerKey] || {};
      const safeProduct = escapeHtml(product);
      const safeSku = escapeHtml(sku);
      const safeCost = escapeHtml(cost);
      const savedPrices = prices.length ? prices : [level1, level2, level3];
      return `
        <div class="product-editor" data-product-editor data-product-mode="edit" data-product-drawer="${escapeHtml(drawerKey)}" data-product-sku="${safeSku}">
          <div class="detail-block">
            <div class="card-head">
              <div>
                <h3>${safeProduct}</h3>
                <p class="sub">SKU ${safeSku} · 这些价格会影响顾客 webshop 看到的价格。</p>
              </div>
              <span class="badge green">上架中</span>
            </div>
            <div class="form-grid">
              <div class="field"><label>商品名称</label><input data-product-field="name" value="${safeProduct}"></div>
              <div class="field"><label>SKU / Lieferantencode</label><input data-product-field="sku" value="${safeSku}"></div>
              ${productBrandField(record.brandId)}
              <div class="field"><label for="productSpecification">售卖规格</label><input id="productSpecification" data-product-field="specification" value="${escapeHtml(record.specification || '')}" placeholder="例如 一瓶 500ml"></div>
              <div class="field"><label>成本价</label><input data-product-field="cost" value="${safeCost}"></div>
              <div class="field"><label>默认上下架</label><select data-product-field="status"><option>上架</option><option>下架</option></select></div>
            </div>
          </div>
          <div class="table-card product-price-levels" style="margin-top:14px">
            <table style="min-width:760px">
              <thead><tr><th>价格等级</th><th>对应售价</th><th>适用客户</th><th>预计毛利</th><th>启用</th><th>备注</th></tr></thead>
              <tbody>
                <tr><td><strong>默认等级1</strong></td><td><input class="control" data-product-price="1" value="${escapeHtml(savedPrices[0] || '')}" style="width:110px"></td><td>普通老客户</td><td><span class="badge green">约 39%</span></td><td><select class="select"><option>启用</option><option>停用</option></select></td><td>默认 webshop 售价</td></tr>
                <tr><td><strong>等级2</strong></td><td><input class="control" data-product-price="2" value="${escapeHtml(savedPrices[1] || '')}" style="width:110px"></td><td>大客户 / 高频客户</td><td><span class="badge green">约 36%</span></td><td><select class="select"><option>启用</option><option>停用</option></select></td><td>批量采购价格</td></tr>
                <tr><td><strong>等级3</strong></td><td><input class="control" data-product-price="3" value="${escapeHtml(savedPrices[2] || '')}" style="width:110px"></td><td>加盟商 / 特批客户</td><td><span class="badge orange">约 32%</span></td><td><select class="select"><option>启用</option><option>停用</option></select></td><td>需要管理层确认</td></tr>
                ${templateLevels.slice(3).map(([level, label]) => `<tr><td><strong>${label}</strong></td><td><input class="control" data-product-price="${level}" type="text" value="${escapeHtml(savedPrices[Number(level) - 1] || '')}" placeholder="请输入售价" aria-label="${label}售价" style="width:110px"></td><td>—</td><td>—</td><td><select class="select" aria-label="${label}启用状态"><option>启用</option><option>停用</option></select></td><td>待设置价格</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
          ${inventoryMappingDetail(sku)}
          <div class="detail-block" style="margin-top:14px">
            <h3>其他设置</h3>
            <div class="form-grid">
              <div class="field"><label>最小订购量</label><input value="1"></div>
              <div class="field full"><label>顾客可见备注</label><textarea>价格按当前客户价格等级显示，缺货或下架时 webshop 不允许加入购物车。</textarea></div>
            </div>
          </div>
          <div class="actions" style="margin-top:14px">
            <button class="btn" type="button" data-product-cancel>取消</button>
            <button class="btn primary" type="button" data-product-save>保存商品</button>
          </div>
        </div>`;
    }

    function priceConfigDetail(customer, templateName) {
      return `
        <div class="detail-block">
          <h3>顾客 online shop 预览配置</h3>
          <div class="catalog-toolbar">
            <div class="field"><label>搜索产品</label><input value="" placeholder="搜索品名、SKU、分类"></div>
            <div class="field"><label>选择顾客</label><select><option>${customer}</option><option>Ramen Haus Mitte</option><option>Sakura Kitchen</option><option>Sushi Bar Nord</option><option>Noodle Lab</option></select></div>
            <div class="field"><label>选择价格模板</label><select><option>${templateName}</option><option>老客1</option><option>老客2</option><option>加盟商</option><option>散户1</option></select></div>
            <div class="field"><label>目录分类</label><select><option>全部分类</option><option>汤底</option><option>面条</option><option>冷冻品</option><option>调味</option></select></div>
          </div>
        </div>

        <div class="catalog-grid">
          <div class="catalog-card">
            <div class="catalog-card-head">
              <div class="catalog-product"><span class="catalog-thumb">TB</span><div><strong>Tonkotsu Base 2kg</strong><span>冷藏汤底 · SKU TB-2000</span><span>顾客目录分类：Soup Base</span></div></div>
              <span class="badge green">总上架</span>
            </div>
            <div class="catalog-controls">
              <div class="field"><label>价格等级</label><select><option>老客1 · €18.90</option><option>老客2 · €18.50</option><option>加盟商 · €17.90</option><option>散户1 · €20.50</option></select></div>
              <div class="field"><label>对应价格</label><input value="€18.90"></div>
              <div class="field"><label>上下架</label><select><option>上架</option><option>下架</option></select></div>
            </div>
            <div class="catalog-price"><span class="catalog-meta">顾客 online shop 当前看到</span><strong>€18.90</strong><span class="badge green">可购买</span></div>
          </div>

          <div class="catalog-card">
            <div class="catalog-card-head">
              <div class="catalog-product"><span class="catalog-thumb">SN</span><div><strong>Special Noodles 1kg</strong><span>拉面面条 · SKU SN-1000</span><span>顾客目录分类：Noodles</span></div></div>
              <span class="badge green">总上架</span>
            </div>
            <div class="catalog-controls">
              <div class="field"><label>价格等级</label><select><option>老客1 · €6.80</option><option>老客2 · €6.50</option><option>加盟商 · €6.20</option><option>散户1 · €7.50</option></select></div>
              <div class="field"><label>对应价格</label><input value="€6.80"></div>
              <div class="field"><label>上下架</label><select><option>上架</option><option>下架</option></select></div>
            </div>
            <div class="catalog-price"><span class="catalog-meta">顾客 online shop 当前看到</span><strong>€6.80</strong><span class="badge green">可购买</span></div>
          </div>

          <div class="catalog-card">
            <div class="catalog-card-head">
              <div class="catalog-product"><span class="catalog-thumb">GM</span><div><strong>Gyoza Mix 50pc</strong><span>速冻饺子 · SKU GM-50</span><span>顾客目录分类：Frozen</span></div></div>
              <span class="badge green">总上架</span>
            </div>
            <div class="catalog-controls">
              <div class="field"><label>价格等级</label><select><option>老客1 · €21.40</option><option>老客2 · €20.90</option><option>加盟商 · €20.20</option><option>散户1 · €23.00</option></select></div>
              <div class="field"><label>对应价格</label><input value="€21.40"></div>
              <div class="field"><label>上下架</label><select><option>上架</option><option>下架</option></select></div>
            </div>
            <div class="catalog-price"><span class="catalog-meta">顾客 online shop 当前看到</span><strong>€21.40</strong><span class="badge green">可购买</span></div>
          </div>

          <div class="catalog-card">
            <div class="catalog-card-head">
              <div class="catalog-product"><span class="catalog-thumb">MS</span><div><strong>Miso Soup Base 1kg</strong><span>常温调味 · SKU MS-1000</span><span>顾客目录分类：Sauce</span></div></div>
              <span class="badge gray">总下架</span>
            </div>
            <div class="catalog-controls">
              <div class="field"><label>价格等级</label><select><option>老客1 · €8.90</option><option>老客2 · €8.40</option><option>加盟商 · €8.10</option><option>散户1 · €9.80</option></select></div>
              <div class="field"><label>对应价格</label><input value="€8.90"></div>
              <div class="field"><label>上下架</label><select><option>下架</option><option>上架</option></select></div>
            </div>
            <div class="catalog-price"><span class="catalog-meta">顾客 online shop 当前看到</span><strong>不显示</strong><span class="badge gray">不可购买</span></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟应用价格模板">应用模板</button>
          <button class="btn" type="button" data-toast="已模拟预览顾客商城">预览顾客商城</button>
          <button class="btn primary" type="button" data-toast="已模拟保存个性化配置">保存个性化配置</button>
        </div>`;
    }

    function productAnalysisDetail() {
      return `
        <div class="stats">
          <div class="stat"><span>本月销售额</span><strong>€18.4k</strong><small>核心产品</small></div>
          <div class="stat"><span>平均毛利</span><strong>37.7%</strong><small style="color:var(--green)">健康</small></div>
          <div class="stat"><span>销量</span><strong>702</strong><small>包 / 箱 / 桶</small></div>
          <div class="stat"><span>低毛利产品</span><strong>1</strong><small style="color:var(--orange)">需要复核</small></div>
        </div>

        <div class="detail-block" style="margin-top:14px">
          <h3>筛选条件</h3>
          <div class="form-grid">
            <div class="field"><label>时间范围</label><select><option>本月</option><option>最近 7 天</option><option>最近 30 天</option><option>本季度</option></select></div>
            <div class="field"><label>产品分类</label><select><option>全部产品</option><option>汤底</option><option>面条</option><option>冷冻品</option></select></div>
            <div class="field"><label>客户类型</label><select><option>全部客户</option><option>老客户</option><option>新客户</option><option>加盟商</option></select></div>
            <div class="field"><label>排序</label><select><option>按销售额</option><option>按毛利率</option><option>按销量</option><option>按库存风险</option></select></div>
          </div>
        </div>

        <div class="table-card" style="margin-top:14px">
          <table style="min-width:840px">
            <thead><tr><th>产品</th><th>成本价</th><th>平均售价</th><th>平均毛利</th><th>销量</th><th>销售额</th><th>库存</th><th>趋势</th></tr></thead>
            <tbody>
              <tr><td><strong>Tonkotsu Base 2kg</strong><br><span style="color:var(--muted)">汤底 · 自有生产</span></td><td>€11.40</td><td>€18.90</td><td><span class="badge green">39.7%</span></td><td>186 包</td><td><strong>€3,515.40</strong><br><span style="color:var(--green);font-weight:800">利润 €1,395.61</span></td><td>12 包</td><td><span class="badge orange">销量上升 12%</span></td></tr>
              <tr><td><strong>Special Noodles 1kg</strong><br><span style="color:var(--muted)">拉面面条 · 自有生产</span></td><td>€3.90</td><td>€6.80</td><td><span class="badge green">42.6%</span></td><td>420 包</td><td><strong>€2,856.00</strong><br><span style="color:var(--green);font-weight:800">利润 €1,217.86</span></td><td>24 包</td><td><span class="badge green">稳定</span></td></tr>
              <tr><td><strong>Gyoza Mix 50pc</strong><br><span style="color:var(--muted)">冷冻品</span></td><td>€14.80</td><td>€21.40</td><td><span class="badge orange">30.8%</span></td><td>96 箱</td><td><strong>€2,054.40</strong><br><span style="color:var(--green);font-weight:800">利润 €632.76</span></td><td>76 箱</td><td><span class="badge orange">毛利偏低</span></td></tr>
              <tr><td><strong>Chashu Pork 1kg</strong><br><span style="color:var(--muted)">肉类</span></td><td>€9.60</td><td>€15.20</td><td><span class="badge green">36.8%</span></td><td>128 包</td><td><strong>€1,945.60</strong><br><span style="color:var(--green);font-weight:800">利润 €715.98</span></td><td>34 包</td><td><span class="badge green">销量上升 8%</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟导出产品分析">导出</button>
          <button class="btn" type="button" data-toast="已模拟刷新分析数据">刷新数据</button>
          <button class="btn primary" type="button" data-toast="已模拟打开价格复核">价格复核</button>
        </div>`;
    }

    function orderDetail(number, customer, company, customerType, paymentStatus, amount, marginRate, marginEuro) {
      return `
        <div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">
          <div class="stat"><span>订单号</span><strong style="font-size:20px">${number}</strong><small>${customer}</small></div>
          <div class="stat"><span>客户状态</span><strong style="font-size:20px">${customerType}</strong><small>${company}</small></div>
          <div class="stat"><span>客户付款状态</span><strong style="font-size:20px">${paymentStatus}</strong><small>${amount}</small></div>
          <div class="stat"><span>该单利润率</span><strong style="font-size:20px">${marginRate}</strong><small>${marginEuro}</small></div>
        </div>

        <div class="detail-block" style="margin-top:14px">
          <h3>订单基础信息</h3>
          <div class="form-grid">
            <div class="field"><label>店铺名字</label><input value="${customer}"></div>
            <div class="field"><label>公司名字</label><input value="${company}"></div>
            <div class="field"><label>送货时间</label><input value="明天 09:00"></div>
            <div class="field"><label>预计到达时间</label><input value="明天 09:45"></div>
            <div class="field"><label>客户状态</label><select><option>${customerType}</option><option>新客户</option><option>老客户</option><option>加盟商</option></select></div>
            <div class="field"><label>客户付款状态</label><select><option>${paymentStatus}</option><option>待付款</option><option>已付款</option><option>逾期</option></select></div>
            <div class="field"><label>该单利润率</label><input value="${marginRate}"></div>
            <div class="field"><label>预计利润</label><input value="${marginEuro}"></div>
          </div>
        </div>

        <div class="table-card" style="margin-top:14px">
          <table style="min-width:820px">
          <thead><tr><th>产品</th><th>数量</th><th>单价</th><th>VAT</th><th>Netto</th><th>Brutto</th><th>Sum</th></tr></thead><tbody>
            <tr><td><input class="control" value="Tonkotsu Base 2kg"></td><td><input class="control" value="8" style="width:72px"></td><td><input class="control" value="€18.90" style="width:96px"></td><td><input class="control" value="7%" style="width:72px"></td><td>€141.31</td><td>€151.20</td><td><strong>€151.20</strong></td></tr>
            <tr><td><input class="control" value="Gyoza Mix 50pc"></td><td><input class="control" value="6" style="width:72px"></td><td><input class="control" value="€21.40" style="width:96px"></td><td><input class="control" value="7%" style="width:72px"></td><td>€120.00</td><td>€128.40</td><td><strong>€128.40</strong></td></tr>
            <tr><td><input class="control" value="Special Noodles 1kg"></td><td><input class="control" value="24" style="width:72px"></td><td><input class="control" value="€6.80" style="width:96px"></td><td><input class="control" value="7%" style="width:72px"></td><td>€152.52</td><td>€163.20</td><td><strong>€163.20</strong></td></tr>
          </tbody></table>
        </div>

        <div class="detail-block" style="margin-top:14px">
          <h3>费用和客户沟通</h3>
          <div class="form-grid">
            <div class="field"><label>运费 <span class="help-dot" title="查看运费计算过程">!</span></label><input value="€28.00"></div>
            <div class="field"><label>订单总计</label><input value="${amount}"></div>
            <div class="field full">
              <label>运费计算过程</label>
              <div class="info-list">
                <div class="info-row"><span>送货区域</span><strong>Berlin Zone A · 市区冷链配送</strong></div>
                <div class="info-row"><span>订单重量</span><strong>42 kg · 3 个温控箱</strong></div>
                <div class="info-row"><span>基础运费</span><strong>€18.00</strong></div>
                <div class="info-row"><span>重量附加费</span><strong>€10.00 · 超过 30 kg 后按 €0.83/kg</strong></div>
                <div class="info-row"><span>最终运费</span><strong>€28.00</strong></div>
              </div>
            </div>
            <div class="field full"><label>联系顾客</label><textarea>您好，您的订单 ${number} 已收到。请确认送货时间和收货地址是否正确。</textarea></div>
            <div class="field full"><label>配送备注</label><textarea>请在上午配送到后门冷藏区。</textarea></div>
          </div>
        </div>

        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟发送顾客消息">发送给顾客</button>
          <button class="btn" type="button" data-toast="已模拟保存订单">保存订单</button>
          <button class="btn primary" type="button" data-toast="已模拟确认订单并生成 Lieferschein">确认订单并生成 Lieferschein</button>
        </div>`;
    }

    function documentDetail() {
      return `
        <div class="form-grid">
          <div class="field"><label>单据号</label><input value="DN-8836"></div>
          <div class="field"><label>关联订单</label><input value="ORD-2048"></div>
          <div class="field full"><label>错误信息</label><textarea>客户地址缺少街道门牌号。修复后可重新生成 Delivery Note。</textarea></div>
        </div>
        <div class="actions" style="margin-top:14px"><button class="btn" type="button" data-toast="已模拟重新检查">重新检查</button><button class="btn primary" type="button" data-toast="已模拟重新生成单据">重新生成</button></div>`;
    }

    function warehousePurchaseDetail() {
      return `
        <div class="detail-block">
          <h3>分组查看</h3>
          <div class="tabs" data-tabs>
            <button class="active" type="button">全部</button>
            <button type="button">Metro</button>
            <button type="button">Transgourmet</button>
            <button type="button">JFC</button>
            <button type="button">CHEFS CULINAR</button>
            <button type="button">生产部门</button>
          </div>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>搜索和筛选</h3>
          <div class="form-grid">
            <div class="field"><label>搜索产品</label><input placeholder="搜索产品名称、SKU、供货商、生产部门"></div>
            <div class="field"><label>产品来源</label><select><option>全部来源</option><option>外部供货商</option><option>生产部门</option></select></div>
            <div class="field"><label>状态</label><select><option>全部状态</option><option>库存正常</option><option>需要订货</option><option>低于最低库存</option><option>生产中</option></select></div>
            <div class="field"><label>下次送货 / 入库</label><select><option>全部时间</option><option>今天</option><option>明天</option><option>本周</option><option>未安排</option></select></div>
          </div>
        </div>
        <div class="table-card" style="margin-top:14px">
          <table style="min-width:900px">
            <thead><tr><th>来源</th><th>产品</th><th>库存</th><th>建议订货</th><th>状态</th><th>备注</th></tr></thead>
            <tbody>
              <tr><td><strong>Metro</strong><br><span style="color:var(--muted)">Metro Deutschland</span></td><td><strong>鸡胸肉 2.5kg</strong><br><span style="color:var(--muted)">MET-CH-2500</span></td><td><strong style="font-size:16px">6 箱</strong><br><span style="color:var(--muted);white-space:nowrap">建议库存 18 箱</span></td><td><input class="control" value="4 箱" style="width:82px"><br><span style="color:var(--muted)">下次送货 明天 09:00</span></td><td><span class="badge orange">需要订货</span></td><td>价格上涨 8%，建议确认 Angebot。</td></tr>
              <tr><td><strong>Metro</strong><br><span style="color:var(--muted)">Metro Deutschland</span></td><td><strong>清洁湿巾 12包</strong><br><span style="color:var(--muted)">MET-CLE-12</span></td><td><strong style="font-size:16px">1 箱</strong><br><span style="color:var(--muted);white-space:nowrap">建议库存 8 箱</span></td><td><input class="control" value="3 箱" style="width:82px"><br><span style="color:var(--muted)">下次送货 周三 12:00</span></td><td><span class="badge red">低于最低库存</span></td><td>清洁用品库存偏低。</td></tr>
              <tr><td><strong>Transgourmet</strong><br><span style="color:var(--muted)">Transgourmet Deutschland</span></td><td><strong>水牛芝士 500g</strong><br><span style="color:var(--muted)">TRG-MOZ-500</span></td><td><strong style="font-size:16px">8 包</strong><br><span style="color:var(--muted);white-space:nowrap">建议库存 20 包</span></td><td><input class="control" value="4 包" style="width:82px"><br><span style="color:var(--muted)">下次送货 周四 10:30</span></td><td><span class="badge orange">需要订货</span></td><td>适合本周补货。</td></tr>
              <tr><td><strong>JFC</strong><br><span style="color:var(--muted)">JFC Deutschland</span></td><td><strong>寿司米 10kg</strong><br><span style="color:var(--muted)">JFC-RICE-10</span></td><td><strong style="font-size:16px">2 袋</strong><br><span style="color:var(--muted);white-space:nowrap">建议库存 12 袋</span></td><td><input class="control" value="4 袋" style="width:82px"><br><span style="color:var(--muted)">下次送货 后天 14:00</span></td><td><span class="badge red">低于最低库存</span></td><td>需更新价格表后下单。</td></tr>
              <tr><td><strong>CHEFS CULINAR</strong><br><span style="color:var(--muted)">CHEFS CULINAR</span></td><td><strong>BBQ 烧烤套餐</strong><br><span style="color:var(--muted)">CHEF-BBQ-SET</span></td><td><strong style="font-size:16px">7 箱</strong><br><span style="color:var(--muted);white-space:nowrap">建议库存 10 箱</span></td><td><input class="control" value="0 箱" style="width:82px"><br><span style="color:var(--muted)">下次送货 下周一 08:30</span></td><td><span class="badge green">库存正常</span></td><td>无需补货。</td></tr>
              <tr><td><strong>生产部门</strong><br><span style="color:var(--muted)">Fujigawa 自有产品</span></td><td><strong>拉面面条</strong><br><span style="color:var(--muted)">Ramen Noodles 1kg</span></td><td><strong style="font-size:16px">24 包</strong><br><span style="color:var(--muted);white-space:nowrap">建议库存 160 包</span></td><td><input class="control" value="240 包" style="width:90px"><br><span style="color:var(--muted)">下次入库 明天 08:00</span></td><td><span class="badge orange">待生产</span></td><td>从制作生产计划发送。</td></tr>
              <tr><td><strong>生产部门</strong><br><span style="color:var(--muted)">Fujigawa 自有产品</span></td><td><strong>拉面汁</strong><br><span style="color:var(--muted)">Ramen Sauce</span></td><td><strong style="font-size:16px">18 桶</strong><br><span style="color:var(--muted);white-space:nowrap">建议库存 120 桶</span></td><td><input class="control" value="80 桶" style="width:90px"><br><span style="color:var(--muted)">下次入库 明天 08:00</span></td><td><span class="badge orange">待生产</span></td><td>完成后扣减原料库存。</td></tr>
            </tbody>
          </table>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>状态说明</h3>
          <div class="info-list">
            <div class="info-row"><span>外部供货商</span><strong>按送货时间和最低库存判断是否需要订货。</strong></div>
            <div class="info-row"><span>生产部门</span><strong>按自有产品库存和计划入库时间判断是否需要制作生产计划。</strong></div>
            <div class="info-row"><span>红色状态</span><strong>已经低于最低库存，需要优先处理。</strong></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟导出产品状态">导出</button>
          <button class="btn" type="button" data-toast="已模拟刷新产品状态">刷新状态</button>
          <button class="btn primary" type="button" data-open-drawer="productionRequest">制作生产计划</button>
        </div>`;
    }

    function warehouseSuppliersDetail() {
      return `
        <div class="table-card">
          <table style="min-width:820px">
            <thead><tr><th>供货商</th><th>接单方式</th><th>产品类型</th><th>送货</th><th>合同/文件</th><th>状态</th><th></th></tr></thead>
            <tbody>
              <tr><td><strong>Metro Deutschland</strong><br><span style="color:var(--muted)">食品 / 清洁 / 饮料</span></td><td>Email / Webshop</td><td>常用采购</td><td>1-3 天</td><td>价格表已上传</td><td><span class="badge green">常用</span></td><td><button class="btn" type="button" data-open-drawer="warehousePurchase">快速下单</button></td></tr>
              <tr><td><strong>Transgourmet</strong><br><span style="color:var(--muted)">乳制品 / 冷冻</span></td><td>Webshop</td><td>补充采购</td><td>2 天</td><td>账单历史完整</td><td><span class="badge blue">备用</span></td><td><button class="btn" type="button" data-open-drawer="warehousePurchase">快速下单</button></td></tr>
              <tr><td><strong>JFC Deutschland</strong><br><span style="color:var(--muted)">米 / 亚洲调料</span></td><td>Email</td><td>干货</td><td>2-4 天</td><td>需更新价格表</td><td><span class="badge orange">待更新</span></td><td><button class="btn" type="button" data-open-drawer="warehousePurchase">快速下单</button></td></tr>
              <tr><td><strong>CHEFS CULINAR</strong><br><span style="color:var(--muted)">肉类 / 活动套餐</span></td><td>Email / 电话</td><td>活动采购</td><td>1-2 天</td><td>合同有效</td><td><span class="badge green">常用</span></td><td><button class="btn" type="button" data-open-drawer="warehousePurchase">快速下单</button></td></tr>
            </tbody>
          </table>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟新增供货商">新增供货商</button>
          <button class="btn primary" type="button" data-toast="已模拟保存供货商设置">保存设置</button>
        </div>`;
    }

    function supplierRulesDetail() {
      return `
        <div class="table-card">
          <table style="min-width:840px">
            <thead><tr><th>供货商</th><th>订货截止</th><th>下次送货</th><th>商品范围</th><th>状态</th><th>编辑</th></tr></thead>
            <tbody>
              <tr><td><strong>Fujigawa 自有产品</strong></td><td>今天 16:00</td><td>明天 08:00</td><td>拉面面条 / 拉面汁</td><td><span class="badge orange">需要订货</span></td><td><button class="btn" type="button" data-toast="已选择 Fujigawa 自有产品，可在下方编辑">编辑</button></td></tr>
              <tr><td><strong>Metro Deutschland</strong></td><td>今天 12:00</td><td>明天 09:00</td><td>冷藏 / 常温</td><td><span class="badge orange">需要订货</span></td><td><button class="btn" type="button" data-toast="已选择 Metro Deutschland，可在下方编辑">编辑</button></td></tr>
              <tr><td><strong>Transgourmet</strong></td><td>明天 10:00</td><td>周四 10:30</td><td>乳制品 / 冷冻</td><td><span class="badge orange">需要订货</span></td><td><button class="btn" type="button" data-toast="已选择 Transgourmet，可在下方编辑">编辑</button></td></tr>
              <tr><td><strong>JFC Deutschland</strong></td><td>今天 15:00</td><td>后天 14:00</td><td>米 / 亚洲调料</td><td><span class="badge red">价格表待更新</span></td><td><button class="btn" type="button" data-toast="已选择 JFC Deutschland，可在下方编辑">编辑</button></td></tr>
            </tbody>
          </table>
        </div>
        <div class="detail-block">
          <div class="card-head">
            <div>
              <h3>新增 / 编辑供货商</h3>
              <p class="sub">先从上方选择供货商，再在这里维护点货、订货提醒和自动采购单条件。</p>
            </div>
            <button class="btn primary" type="button" data-toast="已模拟新增供货商">新增供货商</button>
          </div>
          <div class="form-grid">
            <div class="field"><label>供货商名称</label><input value="Metro Deutschland" data-supplier-name-input></div>
            <div class="field"><label>联系人 / 邮箱</label><input value="order@metro.de"></div>
            <div class="field"><label>接单方式</label><select><option>Webshop</option><option>Email</option><option>电话</option></select></div>
            <div class="field"><label>默认仓库区</label><select><option>全部区域</option><option>冷冻房</option><option>冷藏房</option><option>常温库</option><option>干货库</option></select></div>
          </div>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>订货条件</h3>
          <div class="form-grid">
            <div class="field"><label>最低起订金额</label><input value="€150"></div>
            <div class="field"><label>订货截止时间</label><input value="今天 12:00"></div>
            <div class="field"><label>下次送货时间</label><input value="明天 09:00"></div>
            <div class="field"><label>价格有效期</label><input value="2026/09/30"></div>
            <div class="field"><label>缺货提醒</label><select><option>库存低于建议库存时提醒</option><option>库存低于最低库存时提醒</option><option>不提醒</option></select></div>
          </div>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <div class="card-head">
            <h3>上传列表</h3>
            <button class="btn" type="button" data-inventory-new-item>手动添加商品</button>
          </div>
          <div class="form-grid">
            <div class="upload-box" style="grid-column:1 / -1"><strong>上传物品列表</strong><span class="sub">Excel / CSV / PDF，自动识别物品、规格和供应商货号。</span><input type="file" aria-label="上传物品列表"></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟识别上传列表">识别列表</button>
          <button class="btn" type="button" data-toast="已模拟应用订货条件">应用条件</button>
          <button class="btn primary" type="button" data-toast="已模拟保存供货商设置">保存供货商设置</button>
        </div>`;
    }

    function warehouseZonesDetail() {
      return `
        <div class="detail-block">
          <div class="card-head">
            <div>
              <h3>仓库区设置</h3>
              <p class="sub">管理商品所在区域、是否启用、未分组商品，以及点货时显示的库存分组。</p>
            </div>
            <button class="btn primary" type="button" data-toast="已模拟新增仓库区">新增仓库区</button>
          </div>
          <div class="form-grid">
            <div class="field"><label>区域名称</label><input value="冷冻房"></div>
            <div class="field"><label>区域状态</label><select><option>启用</option><option>暂停使用</option><option>仅后台可见</option></select></div>
            <div class="field"><label>温度条件</label><input value="-18°C 以下"></div>
            <div class="field"><label>默认盘点频率</label><select><option>每日</option><option>每周</option><option>每月</option></select></div>
          </div>
        </div>
        <div class="table-card" style="margin-top:14px">
          <table style="min-width:880px">
            <thead><tr><th>商品</th><th>当前仓库区</th><th>状态</th><th>库存量</th><th>建议库存</th><th>操作</th></tr></thead>
            <tbody>
              <tr><td><strong>拉面面条</strong><br><span style="color:var(--muted)">Ramen Noodles · Fujigawa 自有产品</span></td><td><select class="control"><option>常温库</option><option>冷藏房</option><option>未分组</option></select></td><td><span class="badge green">启用</span></td><td>24 包</td><td>160 包</td><td><button class="btn" type="button" data-toast="已模拟编辑商品仓库区">编辑状态</button></td></tr>
              <tr><td><strong>拉面汁</strong><br><span style="color:var(--muted)">Ramen Sauce · Fujigawa 自有产品</span></td><td><select class="control"><option>常温库</option><option>冷藏房</option><option>未分组</option></select></td><td><span class="badge green">启用</span></td><td>18 桶</td><td>60 桶</td><td><button class="btn" type="button" data-toast="已模拟编辑商品仓库区">编辑状态</button></td></tr>
              <tr><td><strong>鸡胸肉 2.5kg</strong><br><span style="color:var(--muted)">Metro Deutschland</span></td><td><select class="control"><option>冷藏房</option><option>冷冻房</option><option>未分组</option></select></td><td><span class="badge orange">待确认</span></td><td>6 箱</td><td>10 箱</td><td><button class="btn" type="button" data-toast="已模拟编辑商品仓库区">编辑状态</button></td></tr>
              <tr><td><strong>番茄 6kg</strong><br><span style="color:var(--muted)">Metro Deutschland</span></td><td><select class="control"><option>常温库</option><option>冷藏房</option><option>未分组</option></select></td><td><span class="badge green">启用</span></td><td>3 箱</td><td>8 箱</td><td><button class="btn" type="button" data-toast="已模拟编辑商品仓库区">编辑状态</button></td></tr>
              <tr><td><strong>寿司海苔</strong><br><span style="color:var(--muted)">JFC Deutschland</span></td><td><select class="control"><option>未分组</option><option>干货库</option><option>常温库</option></select></td><td><span class="badge red">未分组</span></td><td>12 包</td><td>24 包</td><td><button class="btn" type="button" data-toast="已模拟编辑商品仓库区">编辑状态</button></td></tr>
            </tbody>
          </table>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>合并 / 拆分</h3>
          <div class="form-grid">
            <div class="field"><label>选择源区域</label><select><option>未分组</option><option>冷冻房</option><option>冷藏房</option><option>常温库</option><option>干货库</option></select></div>
            <div class="field"><label>目标区域</label><select><option>干货库</option><option>冷冻房</option><option>冷藏房</option><option>常温库</option></select></div>
            <div class="field"><label>拆分新区域</label><input value="调味料区"></div>
            <div class="field"><label>匹配条件</label><input value="商品名包含 Sauce / Tare"></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟删除空仓库区">删除空区域</button>
          <button class="btn" type="button" data-toast="已模拟合并仓库区">合并区域</button>
          <button class="btn" type="button" data-toast="已模拟拆分仓库区">拆分区域</button>
          <button class="btn primary" type="button" data-toast="已模拟保存仓库区设置">保存仓库区设置</button>
        </div>`;
    }

    function warehouseOrdersDetail() {
      return `
        <div class="table-card">
          <table style="min-width:860px">
            <thead><tr><th>采购单</th><th>供应商</th><th>门店</th><th>金额</th><th>预计送达</th><th>状态</th><th>备注</th></tr></thead>
            <tbody>
              <tr><td><strong>PO-2405-21</strong></td><td>Metro Deutschland</td><td>Martin Biergarten</td><td>€428.60</td><td>2025-05-25 09:00</td><td><span class="badge blue">在配送</span></td><td>等待 Lieferschein</td></tr>
              <tr><td><strong>PO-2405-19</strong></td><td>Transgourmet</td><td>Martin Cafe</td><td>€186.90</td><td>2025-05-23 12:30</td><td><span class="badge green">已送达</span></td><td>已入库并完成对账</td></tr>
              <tr><td><strong>PO-2405-18</strong></td><td>JFC Deutschland</td><td>Ramen Haus Mitte</td><td>€246.20</td><td>2025-05-24 10:00</td><td><span class="badge orange">等待校验</span></td><td>账单与运单金额不匹配</td></tr>
              <tr><td><strong>PO-2405-14</strong></td><td>FrischeParadies</td><td>Martin Cafe</td><td>€312.40</td><td>2025-05-22 08:00</td><td><span class="badge green">已完成</span></td><td>已完成对账</td></tr>
            </tbody>
          </table>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-open-drawer="warehouseUpload">上传单据</button>
          <button class="btn primary" type="button" data-open-drawer="warehousePurchase">创建采购单</button>
        </div>`;
    }

    function warehouseUploadDetail() {
      return `
        <div class="upload-box">
          <strong>上传运单 / 账单</strong>
          <span class="sub">支持 PDF / JPG / PNG / Excel。上传后可自动生成采购列表、匹配订单或做账单对账。</span>
          <input type="file" aria-label="上传运单账单文件">
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>自动识别结果</h3>
          <div class="info-list">
            <div class="info-row"><span>供应商</span><strong>JFC Deutschland</strong></div>
            <div class="info-row"><span>关联采购单</span><strong>PO-2405-18</strong></div>
            <div class="info-row"><span>识别金额</span><strong>€246.20</strong></div>
            <div class="info-row"><span>异常</span><strong>账单与运单金额不匹配，需要人工确认。</strong></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟生成采购列表">生成采购列表</button>
          <button class="btn" type="button" data-toast="已模拟重新识别">重新识别</button>
          <button class="btn primary" type="button" data-toast="已模拟确认并归档单据">确认并归档</button>
        </div>`;
    }

    function warehouseLossDetail(isNew) {
      return `
        <div class="detail-block">
          <h3>${isNew ? '快速登记损耗' : '损耗记录表'}</h3>
          <div class="form-grid">
            <div class="field"><label>商品</label><input value="${isNew ? '' : '番茄 6kg'}" placeholder="例如 番茄 6kg"></div>
            <div class="field"><label>数量</label><input value="${isNew ? '' : '6kg'}" placeholder="例如 2.5kg / 1箱"></div>
            <div class="field"><label>损耗原因</label><select><option>过期</option><option>破损</option><option>变质</option><option>冷藏温度异常</option><option>盘点差异</option><option>报废</option></select></div>
            <div class="field"><label>损耗金额</label><input value="${isNew ? '' : '€18.40'}" placeholder="€0.00"></div>
            <div class="field"><label>门店</label><select><option>Martin Biergarten</option><option>Ramen Haus Mitte</option><option>Sakura Kitchen</option></select></div>
            <div class="field"><label>日期</label><input value="2025-05-24"></div>
            <div class="field full"><label>备注</label><textarea>可记录过期、破损、报废、温度异常或盘点差异原因。</textarea></div>
          </div>
        </div>
        <div class="upload-box" style="margin-top:14px">
          <strong>上传照片 / Lieferschein / 盘点截图</strong>
          <span class="sub">可作为店长确认和供应商沟通凭证。</span>
          <input type="file" aria-label="上传损耗凭证">
        </div>
        <div class="table-card" style="margin-top:14px">
          <table style="min-width:720px">
            <thead><tr><th>商品</th><th>数量</th><th>原因</th><th>金额</th><th>日期</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td>番茄</td><td>6kg</td><td>过期</td><td>€18.40</td><td>2025-05-24</td><td><span class="badge orange">待确认</span></td></tr>
              <tr><td>牛奶</td><td>4L</td><td>破损</td><td>€9.20</td><td>2025-05-23</td><td><span class="badge green">已确认</span></td></tr>
              <tr><td>鸡胸肉</td><td>2.5kg</td><td>盘点差异</td><td>€32.80</td><td>2025-05-21</td><td><span class="badge orange">待店长确认</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟通知店长确认">通知店长确认</button>
          <button class="btn primary" type="button" data-toast="已模拟保存损耗记录">保存损耗记录</button>
        </div>`;
    }

    function shippingDetail(orderNo, customer, company, time, route, pickStatus, amount) {
      const shipped = pickStatus === '已出库';
      return `
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="stat"><span>订单</span><strong style="font-size:20px">${orderNo}</strong><small>${amount}</small></div>
          <div class="stat"><span>配送</span><strong style="font-size:20px">${time}</strong><small>${route}</small></div>
          <div class="stat"><span>出库状态</span><strong style="font-size:20px">${pickStatus}</strong><small>${shipped ? '账单已生成' : '确认后生成账单'}</small></div>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>客户和出货信息</h3>
          <div class="form-grid">
            <div class="field"><label>店铺名字</label><input value="${customer}"></div>
            <div class="field"><label>公司名字</label><input value="${company}"></div>
            <div class="field"><label>出货日期</label><input type="date" value="2026-06-20"></div>
            <div class="field"><label>配送时间</label><input value="${time}"></div>
            <div class="field"><label>配送路线</label><select><option>${route}</option><option>Berlin 早班</option><option>Berlin 午班</option><option>Hamburg</option></select></div>
            <div class="field"><label>状态</label><select><option>${pickStatus}</option><option>待拣货</option><option>待复核</option><option>已备货</option><option>已出库</option></select></div>
          </div>
        </div>
        <div class="table-card" style="margin-top:14px">
          <table style="min-width:760px">
            <thead><tr><th>产品</th><th>订购数量</th><th>已拣货</th><th>仓库</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td><strong>Tonkotsu Base 2kg</strong><br><span style="color:var(--muted)">冷藏汤底</span></td><td>8 包</td><td><input class="control" value="8 包" style="width:90px"></td><td>Berlin Warehouse</td><td><span class="badge green">完成</span></td></tr>
              <tr><td><strong>Gyoza Mix 50pc</strong><br><span style="color:var(--muted)">速冻饺子</span></td><td>6 箱</td><td><input class="control" value="6 箱" style="width:90px"></td><td>Cold Storage</td><td><span class="badge green">完成</span></td></tr>
              <tr><td><strong>Special Noodles 1kg</strong><br><span style="color:var(--muted)">定制面条</span></td><td>24 包</td><td><input class="control" value="24 包" style="width:90px"></td><td>Berlin Warehouse</td><td><span class="badge orange">待复核</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>单据</h3>
          <div class="info-list">
            <div class="info-row"><span>Lieferschein</span><strong>${orderNo.replace('ORD', 'LS')} · 可下载</strong></div>
            <div class="info-row"><span>账单</span><strong>${shipped ? orderNo.replace('ORD', 'INV') + ' · 已生成' : '确认出库后自动生成'}</strong></div>
            <div class="info-row"><span>备注</span><strong>确认出库后，系统锁定拣货数量并生成账单。</strong></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟下载 ${orderNo} Lieferschein">下载 Lieferschein</button>
          <button class="btn" type="button" data-toast="已模拟保存出货修改">保存修改</button>
          <button class="btn primary" type="button" data-toast="已模拟确认 ${orderNo} 出库并生成账单">确认出库并生成账单</button>
        </div>`;
    }

    function summarizeProductionMaterials(lines) {
      const totals = new Map();
      for (const line of lines) {
        for (const material of line.materials) {
          const total = totals.get(material.id) || { ...material, required: 0 };
          total.required += line.quantity * material.perUnit;
          totals.set(material.id, total);
        }
      }
      return [...totals.values()].filter(item => item.required - item.available > 1e-9);
    }

    function checkProductionMaterials(sending = false) {
      const summary = drawerBody.querySelector('[data-production-summary]');
      if (!summary) return;
      summary.dataset.checked = 'true';
      const rows = [...drawerBody.querySelectorAll('[data-production-row]')];
      const selected = [];
      let invalid = false;
      for (const row of rows) {
        const input = row.querySelector('[data-production-quantity]');
        const warning = row.querySelector('[data-material-warning]');
        warning.hidden = true;
        warning.textContent = '';
        input.removeAttribute('aria-invalid');
        input.style.borderColor = '';
        if (!row.querySelector('input[type="checkbox"]').checked) continue;
        const quantity = Number(input.value);
        if (!Number.isFinite(quantity) || quantity <= 0) {
          invalid = true;
          input.setAttribute('aria-invalid', 'true');
          input.style.borderColor = 'var(--red)';
          warning.textContent = '请输入大于 0 的订购数量';
          warning.hidden = false;
          continue;
        }
        selected.push({ row, quantity, materials: JSON.parse(row.dataset.materials) });
      }
      const shortages = summarizeProductionMaterials(selected);
      const format = value => String(Number(value.toFixed(4)));
      summary.textContent = invalid ? '请先修正订购数量。' : !selected.length ? '请至少选择一个需要生产的产品。' : shortages.map(item =>
        `${item.name}不足：本批共需 ${format(item.required)} ${item.unit}，现有 ${format(item.available)} ${item.unit}，缺少 ${format(item.required - item.available)} ${item.unit}。`
      ).join('\n');
      summary.hidden = !summary.textContent;
      for (const line of selected) {
        const missing = shortages.filter(item => line.materials.some(material => material.id === item.id));
        const warning = line.row.querySelector('[data-material-warning]');
        warning.textContent = missing.map(item => `需要${item.name}，库存不足。`).join('\n');
        warning.hidden = !missing.length;
      }
      drawerBody.querySelector('[data-production-preview]').textContent = selected.map(line =>
        `${line.row.querySelector('strong').textContent} ${line.quantity} ${line.row.querySelector('select').value}`
      ).join('，') || '未选择产品';
      if (sending) showToast(invalid || !selected.length ? '请检查生产计划' : shortages.length ? '原料不足，请调整生产数量后再发送' : '原料检查通过，已模拟发送生产部门');
    }

    document.addEventListener('input', event => {
      if (event.target.closest('[data-production-row]') && drawerBody.querySelector('[data-production-summary]')?.dataset.checked) checkProductionMaterials();
    });
    document.addEventListener('change', event => {
      if (event.target.closest('[data-production-row]') && drawerBody.querySelector('[data-production-summary]')?.dataset.checked) checkProductionMaterials();
    });

    function productionRequestDetail() {
      return `
        <div class="detail-block">
          <h3>生产部门订购</h3>
          <div class="form-grid">
            <div class="field"><label>申请来源</label><select><option>仓库助手</option><option>手动新增</option><option>销售预测</option></select></div>
            <div class="field"><label>入库仓库</label><select><option>Berlin Warehouse</option><option>Hamburg Cold Storage</option><option>Production Cold Room</option></select></div>
            <div class="field"><label>需要入库日期</label><input type="date" value="2026-06-21"></div>
            <div class="field"><label>需要入库时间</label><input type="time" value="08:00"></div>
            <div class="field full"><label>备注</label><textarea>请生产部门按下面数量制作，完成后入库并同步扣减原料库存。</textarea></div>
          </div>
        </div>
        <div class="table-card" style="margin-top:14px">
          <table style="min-width:720px">
            <thead><tr><th>订购</th><th>产品</th><th>当前库存</th><th>最低库存</th><th>订购数量</th><th>单位</th></tr></thead>
            <tbody>
              <tr data-production-row data-materials='[{"id":"flour","name":"小麦粉","unit":"kg","perUnit":0.4,"available":42}]'>
                <td><input type="checkbox" checked aria-label="订购拉面面条"></td>
                <td><strong>拉面面条</strong><br><span style="color:var(--muted)">Ramen Noodles · Fujigawa 自有产品</span><span class="material-warning" data-material-warning hidden></span></td>
                <td>24 包</td>
                <td>80 包</td>
                <td><input class="control" data-production-quantity type="number" min="0.01" step="any" aria-label="拉面面条订购数量" value="240" style="width:96px"></td>
                <td><select class="select"><option>包</option></select></td>
              </tr>
              <tr data-production-row data-materials='[{"id":"flour","name":"小麦粉","unit":"kg","perUnit":0.4,"available":42},{"id":"soy","name":"酱油","unit":"L","perUnit":0.125,"available":3}]'>
                <td><input type="checkbox" checked aria-label="订购拉面汁"></td>
                <td><strong>拉面汁</strong><br><span style="color:var(--muted)">Ramen Sauce · Fujigawa 自有产品</span><span class="material-warning" data-material-warning hidden></span></td>
                <td>18 桶</td>
                <td>60 桶</td>
                <td><input class="control" data-production-quantity type="number" min="0.01" step="any" aria-label="拉面汁订购数量" value="80" style="width:96px"></td>
                <td><select class="select"><option>桶</option></select></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>发送内容预览</h3>
          <div class="info-list">
            <div class="info-row"><span>接收部门</span><strong>生产部门</strong></div>
            <div class="info-row"><span>入库要求</span><strong>2026-06-21 08:00 前入 Berlin Warehouse</strong></div>
            <div class="info-row"><span>生产内容</span><strong data-production-preview>拉面面条 240 包，拉面汁 80 桶</strong></div>
          </div>
        </div>
        <div class="material-warning" data-production-summary role="alert" hidden></div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟保存生产草稿">保存草稿</button>
          <button class="btn primary" type="button" data-check-production-materials>发送生产部门</button>
        </div>`;
    }

    function productionScheduleDetail() {
      return `
        <div class="detail-block">
          <h3>今日生产线排程</h3>
          <div class="form-grid">
            <div class="field"><label>生产日期</label><input type="date" value="2026-06-20"></div>
            <div class="field"><label>班次</label><select><option>早班</option><option>午班</option><option>晚班</option></select></div>
            <div class="field"><label>负责人</label><select><option>Lin Wei</option><option>Mei Chen</option><option>Ken Tanaka</option></select></div>
            <div class="field"><label>生产线</label><select><option>汤底线</option><option>制面线</option><option>冷冻线</option></select></div>
          </div>
        </div>
        <div class="table-card" style="margin-top:14px">
          <table style="min-width:760px">
            <thead><tr><th>时间</th><th>生产线</th><th>产品</th><th>目标量</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td>08:00 - 11:30</td><td>汤底线</td><td>Tonkotsu Base 2kg</td><td>80 桶</td><td>Lin Wei</td><td><span class="badge orange">待开始</span></td></tr>
              <tr><td>12:00 - 15:00</td><td>制面线</td><td>Special Noodles 1kg</td><td>240 包</td><td>Mei Chen</td><td><span class="badge blue">生产中</span></td></tr>
              <tr><td>15:30 - 17:00</td><td>冷冻线</td><td>Gyoza Mix 50pc</td><td>160 箱</td><td>Ken Tanaka</td><td><span class="badge green">待质检</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟重新计算排程">重新计算排程</button>
          <button class="btn primary" type="button" data-toast="已模拟保存生产排程">保存排程</button>
        </div>`;
    }

    function productionMaterialDetail() {
      return `
        <div class="detail-block">
          <h3>成品关系</h3>
          <div class="form-grid">
            <div class="field"><label>自产产品</label><select><option>Tonkotsu Base 2kg</option><option>Special Noodles 1kg</option><option>Gyoza Mix 50pc</option><option>Ramen Sauce 10kg</option></select></div>
            <div class="field"><label>产出单位</label><select><option>桶</option><option>包</option><option>箱</option><option>kg</option></select></div>
            <div class="field"><label>标准批量</label><input value="80 桶"></div>
            <div class="field"><label>默认损耗率</label><input value="3%"></div>
            <div class="field full"><label>扣减规则</label><textarea>发送生产部门后先检查原料库存；确认生产时扣减原料，成品完成后按产出单位入库。</textarea></div>
          </div>
        </div>
        <div class="table-card">
          <table style="min-width:780px">
            <thead><tr><th>原料</th><th>仓库区</th><th>原料单位</th><th>每 1 成品用量</th><th>标准批量用量</th><th>损耗率</th><th>操作</th></tr></thead>
            <tbody>
              <tr><td><strong>猪骨汤底原料</strong></td><td><select class="control"><option>冷藏房</option><option>常温库</option><option>未分组</option></select></td><td><select class="control"><option>kg</option><option>L</option><option>个</option></select></td><td><input class="control" value="2 kg"></td><td><input class="control" value="160 kg"></td><td><input class="control" value="3%"></td><td><button class="btn" type="button" data-toast="已模拟删除原料关系">删除</button></td></tr>
              <tr><td><strong>包装桶 2kg</strong></td><td><select class="control"><option>干货库</option><option>常温库</option><option>未分组</option></select></td><td><select class="control"><option>个</option><option>箱</option><option>包</option></select></td><td><input class="control" value="1 个"></td><td><input class="control" value="80 个"></td><td><input class="control" value="0%"></td><td><button class="btn" type="button" data-toast="已模拟删除原料关系">删除</button></td></tr>
              <tr><td><strong>酱油</strong></td><td><select class="control"><option>常温库</option><option>冷藏房</option><option>未分组</option></select></td><td><select class="control"><option>L</option><option>kg</option><option>瓶</option></select></td><td><input class="control" value="0.8 L"></td><td><input class="control" value="64 L"></td><td><input class="control" value="2%"></td><td><button class="btn" type="button" data-toast="已模拟删除原料关系">删除</button></td></tr>
            </tbody>
          </table>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟新增原料行">新增原料</button>
          <button class="btn" type="button" data-toast="已模拟测试扣减关系">测试扣减</button>
          <button class="btn primary" type="button" data-toast="已模拟保存生产关系">保存生产关系</button>
        </div>`;
    }

    function productionOrderDetail(requestNo, product, quantity, line, status) {
      return `
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div class="stat"><span>生产请求</span><strong style="font-size:20px">${requestNo}</strong><small>来自仓库助手</small></div>
          <div class="stat"><span>目标产量</span><strong style="font-size:20px">${quantity}</strong><small>${product}</small></div>
          <div class="stat"><span>状态</span><strong style="font-size:20px">${status}</strong><small>${line}</small></div>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>生产信息</h3>
          <div class="form-grid">
            <div class="field"><label>产品</label><input value="${product}"></div>
            <div class="field"><label>目标数量</label><input value="${quantity}"></div>
            <div class="field"><label>生产线</label><select><option>${line}</option><option>汤底线</option><option>制面线</option><option>冷冻线</option></select></div>
            <div class="field"><label>负责人</label><select><option>Lin Wei</option><option>Mei Chen</option><option>Ken Tanaka</option></select></div>
            <div class="field"><label>开始时间</label><input value="今天 08:00"></div>
            <div class="field"><label>预计完成</label><input value="今天 15:00"></div>
            <div class="field"><label>生产状态</label><select><option>${status}</option><option>待排产</option><option>生产中</option><option>待质检</option><option>待入库</option><option>已完成</option></select></div>
            <div class="field"><label>质检状态</label><select><option>待质检</option><option>通过</option><option>需复查</option></select></div>
          </div>
        </div>
        <div class="table-card" style="margin-top:14px">
          <table style="min-width:760px">
            <thead><tr><th>物料</th><th>计划用量</th><th>实际扣减</th><th>剩余库存</th><th>状态</th></tr></thead>
            <tbody>
              <tr><td>主原料</td><td>160 kg</td><td><input class="control" value="160 kg" style="width:100px"></td><td>260 kg</td><td><span class="badge green">正常</span></td></tr>
              <tr><td>包装材料</td><td>80 个</td><td><input class="control" value="80 个" style="width:100px"></td><td>16 个</td><td><span class="badge red">需要补货</span></td></tr>
              <tr><td>标签</td><td>80 张</td><td><input class="control" value="80 张" style="width:100px"></td><td>540 张</td><td><span class="badge green">正常</span></td></tr>
            </tbody>
          </table>
        </div>
        <div class="detail-block" style="margin-top:14px">
          <h3>成品入库</h3>
          <div class="form-grid">
            <div class="field"><label>实际产出</label><input value="${quantity}"></div>
            <div class="field"><label>入库仓库</label><select><option>Berlin Warehouse</option><option>Hamburg Cold Storage</option><option>Production Cold Room</option></select></div>
            <div class="field"><label>批次号</label><input value="${requestNo.replace('PRD-REQ', 'BATCH')}"></div>
            <div class="field"><label>保质期</label><input type="date" value="2026-09-20"></div>
          </div>
        </div>
        <div class="actions" style="margin-top:14px">
          <button class="btn" type="button" data-toast="已模拟保存生产进度">保存进度</button>
          <button class="btn primary" type="button" data-toast="已模拟确认成品入库">确认成品入库</button>
        </div>`;
    }

    function inventoryForm(product, warehouse, stock) {
      return `
        <div class="form-grid">
          <div class="field full"><label>商品</label><input value="${product}"></div>
          <div class="field"><label>仓库</label><input value="${warehouse}"></div>
          <div class="field"><label>当前库存</label><input value="${stock}"></div>
          <div class="field"><label>安全库存</label><input value="30 包"></div>
          <div class="field"><label>本次入库</label><input value="48 包"></div>
          <div class="field full"><label>备注</label><textarea>库存展示版，可以继续细化成批次、保质期、仓库位置。</textarea></div>
        </div>
        <div class="actions" style="margin-top:14px"><button class="btn primary" type="button" data-toast="已模拟保存库存">保存</button></div>`;
    }

    navButtons.forEach(button => button.addEventListener('click', () => goToPage(button.dataset.pageTarget)));
    document.addEventListener('click', event => {
      const productSaveButton = event.target.closest('[data-product-save]');
      if (productSaveButton) {
        const editor = productSaveButton.closest('[data-product-editor]');
        if (editor) saveProductEditor(editor);
        return;
      }
      if (event.target.closest('[data-product-cancel]')) {
        closeDrawer();
        showToast('已取消商品编辑，未保存更改');
        return;
      }
      const customerPriceAction = event.target.closest('[data-customer-price-action]');
      if (customerPriceAction) {
        saveCustomerPrices(customerPriceAction.dataset.customerPriceAction);
        return;
      }
      const templateManagerButton = event.target.closest('[data-open-template-manager]');
      if (templateManagerButton) {
        openTemplateManager();
        return;
      }
      if (event.target.closest('[data-template-manager-select]')) return;
      if (event.target.closest('[data-template-create]')) {
        templateManagerSelectedId = null;
        renderTemplateManager();
        return;
      }
      if (event.target.closest('[data-template-manager-save]')) {
        saveTemplateManager();
        return;
      }
      if (event.target.closest('[data-template-manager-cancel]')) {
        closeDrawer();
        showToast('已取消模板编辑，未保存更改');
        return;
      }
      const jump = event.target.closest('[data-page-jump]');
      if (jump) goToPage(jump.dataset.pageJump);
      const toastButton = event.target.closest('[data-toast]');
      if (toastButton) showToast(toastButton.dataset.toast);
      const materialCheckButton = event.target.closest('[data-check-production-materials]');
      if (materialCheckButton) {
        checkProductionMaterials(true);
      }
      const zoneEditToggle = event.target.closest('[data-zone-edit-toggle]');
      if (zoneEditToggle) {
        const zoneLayer = zoneEditToggle.closest('[data-zone-layer]');
        const productGrid = document.querySelector('.warehouse-product-grid');
        const isEditing = !zoneLayer.classList.contains('warehouse-zone-editing');
        zoneLayer.classList.toggle('warehouse-zone-editing', isEditing);
        productGrid?.classList.toggle('warehouse-products-zone-editing', isEditing);
        zoneEditToggle.textContent = isEditing ? '完成' : '编辑';
        showToast(isEditing ? '仓库区和商品分区已进入编辑状态' : '已退出仓库区编辑状态');
        return;
      }
      if (event.target.closest('[data-zone-remove]')) {
        showToast('已模拟删除该仓库区，相关商品会进入未分组');
        return;
      }
      if (event.target.closest('[data-zone-add]')) {
        showToast('已模拟新增仓库区');
        return;
      }
      const filterEditToggle = event.target.closest('[data-filter-edit-toggle]');
      if (filterEditToggle) {
        const layer = filterEditToggle.closest('[data-editable-filter]');
        const isEditing = !layer.classList.contains('warehouse-filter-editing');
        layer.classList.toggle('warehouse-filter-editing', isEditing);
        filterEditToggle.textContent = isEditing ? '完成' : '编辑';
        return;
      }
      const filterRemove = event.target.closest('[data-filter-remove]');
      if (filterRemove) {
        const layer = filterRemove.closest('[data-editable-filter]');
        const name = filterRemove.parentElement.querySelector('span').textContent;
        filterRemove.parentElement.remove();
        showToast(`已删除${layer.dataset.editableFilter}“${name}”（本页演示）`);
        return;
      }
      const filterAdd = event.target.closest('[data-filter-add]');
      if (filterAdd) {
        const layer = filterAdd.closest('[data-editable-filter]');
        const type = layer.dataset.editableFilter;
        const name = prompt(`请输入新${type}名称`);
        if (!name?.trim()) return;
        const button = document.createElement('button');
        button.type = 'button';
        const label = document.createElement('span');
        label.textContent = name.trim();
        const remove = document.createElement('i');
        remove.className = 'zone-remove';
        remove.dataset.filterRemove = '';
        remove.textContent = '×';
        button.append(label, remove);
        filterAdd.before(button);
        showToast(`已新增${type}“${name.trim()}”（本页演示）`);
        return;
      }
      const productEditToggle = event.target.closest('[data-product-edit-toggle]');
      if (productEditToggle) {
        const catalog = productEditToggle.closest('.shop-catalog');
        const isEditing = !catalog?.classList.contains('product-catalog-editing');
        catalog?.classList.toggle('product-catalog-editing', isEditing);
        productEditToggle.textContent = isEditing ? '完成' : '编辑商品';
        showToast(isEditing ? '商品目录已进入编辑状态' : '已退出商品编辑状态');
        return;
      }
      if (event.target.closest('[data-product-delete]')) {
        showToast('已模拟删除该商品');
        return;
      }
      const stockAction = event.target.closest('[data-stock-action]');
      if (stockAction) {
        if (stockAction.dataset.actionMode === 'order') {
          openDrawer('warehousePurchase');
        } else {
          const hasMismatch = Array.from(document.querySelectorAll('.warehouse-product-card')).some(card => {
            const stockText = card.querySelector('.product-stock-grid strong')?.textContent || '';
            const recorded = Number.parseInt(stockText, 10);
            const input = Number.parseInt(card.querySelector('.warehouse-product-actions input')?.value || '', 10);
            return Number.isFinite(recorded) && Number.isFinite(input) && recorded !== input;
          });
          const alert = document.getElementById('stockRegisterAlert');
          if (alert) alert.classList.toggle('show', hasMismatch);
          showToast(hasMismatch ? '登记数量与记录库存不同，请上传 Lieferschein 或登记报损' : '库存数量已登记');
        }
      }
      const choiceButton = event.target.closest('[data-choice-group] button');
      if (choiceButton) {
        choiceButton.parentElement.querySelectorAll('button').forEach(button => button.classList.remove('active'));
        choiceButton.classList.add('active');
        if (choiceButton.dataset.mode) {
          const zoneLayer = document.querySelector('[data-zone-layer]');
          if (zoneLayer) zoneLayer.hidden = choiceButton.dataset.mode === 'order';
          const stockActionButton = document.querySelector('[data-stock-action]');
          if (stockActionButton) {
            stockActionButton.dataset.actionMode = choiceButton.dataset.mode;
            stockActionButton.textContent = choiceButton.dataset.mode === 'order' ? '加入并进入购物车' : '登记库存';
          }
          if (choiceButton.dataset.mode === 'order') {
            document.getElementById('stockRegisterAlert')?.classList.remove('show');
          }
        }
        if (choiceButton.dataset.supplierName) {
          const schedule = document.getElementById('supplierSchedule');
          if (schedule) {
            schedule.innerHTML = `<span>选中：<strong>${choiceButton.dataset.supplierName}</strong></span><span>订货截止：${choiceButton.dataset.deadline}</span><span>下次送货：${choiceButton.dataset.delivery}</span>`;
          }
        }
        if (choiceButton.dataset.mode || choiceButton.dataset.supplierName || choiceButton.dataset.orderCatalog) filterOrderCatalog();
      }
      const stepButton = event.target.closest('[data-step]');
      if (stepButton) {
        const input = stepButton.parentElement.querySelector('input');
        const nextValue = Math.max(0, (Number.parseInt(input.value, 10) || 0) + Number.parseInt(stepButton.dataset.step, 10));
        input.value = nextValue;
      }
      const zoneSelect = event.target.closest('.warehouse-zone-field select');
      if (zoneSelect) {
        const label = zoneSelect.parentElement.querySelector('b');
        if (label) label.textContent = zoneSelect.value;
      }
      const drawerButton = event.target.closest('[data-open-drawer]');
      if (drawerButton) openDrawer(drawerButton.dataset.openDrawer);
      if (event.target.closest('[data-close-drawer]')) closeDrawer();
      const toggle = event.target.closest('.toggle');
      if (toggle) toggle.classList.toggle('on');
      const tab = event.target.closest('[data-tabs] button');
      if (tab) {
        tab.parentElement.querySelectorAll('button').forEach(button => button.classList.remove('active'));
        tab.classList.add('active');
      }
    });

    document.addEventListener('change', event => {
      if (event.target.matches('[data-inventory-product]')) {
        const mapping = event.target.closest('[data-inventory-mapping]');
        if (mapping) refreshInventoryMapping(mapping);
      }
      if (event.target.matches('[data-inventory-supplier]')) {
        const mapping = event.target.closest('[data-inventory-mapping]');
        if (mapping) filterInventoryProducts(mapping);
      }
      if (event.target.matches('[data-inventory-spec]')) {
        const mapping = event.target.closest('[data-inventory-mapping]');
        if (mapping) refreshInventoryMapping(mapping);
      }
      if (event.target.matches('[data-template-manager-select]')) {
        templateManagerSelectedId = event.target.value || null;
        renderTemplateManager();
      }
      if (event.target.matches('[data-template-level]') && templateManagerDraft) {
        templateManagerDraft.levels[event.target.dataset.templateLevel] = event.target.value;
      }
      if (event.target.matches('[name="priceTemplate"]')) {
        const template = resolvePriceTemplate(event.target.value);
        templateManagerSelectedId = template?.id || null;
        applyPriceTemplateToCatalog(template);
        document.getElementById('templateMismatchAlert')?.classList.remove('show');
      }
    });

    document.addEventListener('input', event => {
      if (event.target.matches('[data-template-name]')) setTemplateManagerError('');
      if (event.target.matches('[data-inventory-search]')) {
        const mapping = event.target.closest('[data-inventory-mapping]');
        if (mapping) filterInventoryProducts(mapping);
      }
      if (event.target.matches('[data-inventory-quantity]')) {
        const mapping = event.target.closest('[data-inventory-mapping]');
        if (mapping) refreshInventoryMapping(mapping);
      }
      if (event.target.matches('[data-product-field="name"], [data-product-field="sku"]')) {
        event.target.removeAttribute('aria-invalid');
        event.target.parentElement.querySelector('[data-product-error]')?.setAttribute('hidden', '');
      }
    });

    document.querySelectorAll('[data-template-select]').forEach(select => {
      select.addEventListener('change', () => {
        document.getElementById('templateMismatchAlert')?.classList.add('show');
      });
    });

    document.querySelectorAll('.warehouse-zone-field select').forEach(select => {
      select.addEventListener('change', () => {
        const label = select.parentElement.querySelector('b');
        if (label) label.textContent = select.value;
      });
    });

    document.querySelectorAll('[data-filter]').forEach(input => {
      input.addEventListener('input', () => {
        const table = input.closest('.page').querySelector('tbody');
        const query = input.value.trim().toLowerCase();
        table.querySelectorAll('tr').forEach(row => {
          row.style.display = !query || row.dataset.searchRow?.includes(query) ? '' : 'none';
        });
      });
    });

    document.querySelectorAll('[data-customer-group]').forEach(button => {
      button.addEventListener('click', () => {
        const group = button.dataset.customerGroup;
        const page = button.closest('.page');
        page.querySelectorAll('[data-customer-group]').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        page.querySelectorAll('[data-customer-group-row]').forEach(row => {
          row.style.display = group === 'all' || row.dataset.customerGroupRow === group ? '' : 'none';
        });
      });
    });

    document.getElementById('globalSearch').addEventListener('keydown', event => {
      if (event.key === 'Enter') showToast(`已模拟搜索：${event.currentTarget.value || '全部内容'}`);
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeDrawer();
    });

    document.addEventListener('click', event => {
      const action = event.target.closest('[data-note-edit], [data-note-save], [data-note-cancel]');
      if (!action) return;
      const row = action.closest('[data-customer-note]');
      const text = row.querySelector('[data-note-text]');
      const editor = row.querySelector('[data-note-editor]');
      const input = editor.querySelector('textarea');
      const editing = action.hasAttribute('data-note-edit');
      if (editing) input.value = text.textContent;
      if (action.hasAttribute('data-note-save')) text.textContent = input.value.trim();
      editor.hidden = !editing;
      text.hidden = editing;
      row.querySelector('[data-note-edit]').hidden = editing;
      if (editing) input.focus();
      else row.querySelector('[data-note-edit]').focus();
    });
