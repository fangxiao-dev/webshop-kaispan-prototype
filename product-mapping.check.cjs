// Run: node docs/fuji_backoffice/product-mapping.check.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/supplier-ui-editor.js`, 'utf8');
const parser = source.match(/function parseInventoryQuantity\(value\) \{[\s\S]*?\n    \}/);
assert.ok(parser, 'quantity parser exists');
const parse = vm.runInNewContext(`(${parser[0]})`);
for (const value of ['1', '0.5', '1/6', '1/24']) assert.equal(parse(value), value);
for (const value of ['', '0', '-1', '1/0', '0/6', 'abc', '9'.repeat(400)]) assert.equal(parse(value), null);
console.log('PASS: inventory mapping quantity validation');
