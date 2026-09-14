// Run: node docs/fuji_backoffice/production-materials.check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/supplier-ui-editor.js`, 'utf8');
const start = source.indexOf('    function summarizeProductionMaterials(');
const end = source.indexOf('    function checkProductionMaterials(', start);
const context = {};
vm.runInNewContext(source.slice(start, end), context);
const flour = { id: 'flour', name: '小麦粉', unit: 'kg', perUnit: 1, available: 10 };
const soy = { id: 'soy', name: '酱油', unit: 'L', perUnit: 1, available: 10 };
const check = context.summarizeProductionMaterials;
const shortage = check([
  { quantity: 6, materials: [flour] },
  { quantity: 6, materials: [flour] },
  { quantity: 2, materials: [soy] },
]);
assert.equal(shortage.length, 1);
assert.equal(shortage[0].id, 'flour');
assert.equal(shortage[0].required, 12);
assert.equal(shortage[0].required - shortage[0].available, 2);
assert.equal(check([{ quantity: 10, materials: [flour] }]).length, 0);
assert.equal(check([]).length, 0);
console.log('PASS: shared material totals, unrelated material, exact stock, empty batch');
