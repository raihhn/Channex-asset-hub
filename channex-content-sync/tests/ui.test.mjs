import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

test('artboard brand selects the matching CSV sheet and all sheet data reaches sync preview', async () => {
  const html = await readFile('dist/ui.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://plugin.test' });
  const w = dom.window; const sent = []; w.postMessage = message => sent.push(message.pluginMessage);
  w.eval(w.document.querySelector('script').textContent);
  const receive = data => w.onmessage({ data: { pluginMessage: data } });
  const click = selector => { const el = w.document.querySelector(selector); assert.ok(el, selector); el.click(); };
  receive({ type: 'init' });

  const input = w.document.querySelector('#file');
  const file = new File(['No,Products,USP,PRICE BEFORE,PRICE AFTER,DISC PDP\n1,Brightening Cream,Soft skin,"51,8","37,05",20%\n'], 'Wardah.csv');
  Object.defineProperty(input, 'files', { value: [file] });
  await input.onchange({ target: input });
  assert.match(w.document.querySelector('#content').textContent, /1 sheet/);

  receive({ type: 'selection', selection: { frames: [{ id: 'wardah-frame', name: 'Wardah — 1', sourceId: '1', sourceSheet: '', brandSheet: '', fields: ['product_name', 'old_price', 'discount'] }], text: null, template: null } });
  assert.match(w.document.querySelector('#content').textContent, /Preview: Wardah/);
  assert.match(w.document.querySelector('#content').textContent, /Brightening Cream/);
  assert.match(w.document.querySelector('#content').textContent, /Hapus tanda %/);
  assert.doesNotMatch(w.document.querySelector('#content').textContent, /Rupiah/);

  click('#preview-sync');
  assert.deepEqual(Array.from(sent.at(-1).sheets, sheet => sheet.name), ['Wardah']);
  assert.equal(sent.at(-1).sheetChoice, '');
  assert.equal(sent.at(-1).columns.id, 'No');
  click('[data-go="ids"]');
  assert.match(w.document.querySelector('#content').textContent, /Tandai brand artboard/);
  w.document.querySelector('#brand-sheet').value = 'Wardah';
  click('#save-brand');
  assert.equal(sent.at(-1).type, 'set-brand');
  assert.deepEqual(Array.from(sent.at(-1).frameIds), ['wardah-frame']);
  assert.equal(sent.at(-1).sheetName, 'Wardah');
  receive({ type: 'selection', selection: { frames: [{ id: 'wardah-frame', name: 'Promo 1', sourceId: '1', sourceSheet: 'Wardah', brandSheet: 'Wardah', fields: ['product_name', 'old_price', 'discount'] }], text: null, template: null } });
  assert.equal(w.document.querySelector('#brand-sheet').value, 'Wardah');
  w.document.querySelector('#frame-product').value = '1';
  click('#save-product');
  assert.equal(sent.at(-1).type, 'set-product');
  assert.equal(sent.at(-1).frameId, 'wardah-frame');
  assert.equal(sent.at(-1).sourceId, '1');
  assert.doesNotMatch(w.document.querySelector('#content').textContent, /Hubungkan artboard sekali/);
  click('[data-go="sync"]');
  receive({ type: 'sync-preview', preview: {
    token: 'preview-1', rows: 1, frames: 1, matched: 1, changedFrames: 1, partialFrames: 0, unchangedFrames: 0, skippedFrames: 0,
    changes: [{ frameId: 'wardah-frame', frameName: 'Wardah — 1', sheetName: 'Wardah', sourceId: '1', field: 'product_name', before: 'Old Name', after: 'Brightening Cream', nodeId: 'product-layer' }],
    issues: [],
  } });
  assert.match(w.document.querySelector('#content').textContent, /Wardah · 1 — Brightening Cream/);
  click('#confirm-sync');
  assert.equal(sent.at(-1).type, 'commit-sync');
  dom.window.close();
});

test('Buat Artboard sends the selected brand and product limit for a master frame', async () => {
  const html = await readFile('dist/ui.html', 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://plugin.test' });
  const w = dom.window; const sent = []; w.postMessage = message => sent.push(message.pluginMessage);
  w.eval(w.document.querySelector('script').textContent);
  const receive = data => w.onmessage({ data: { pluginMessage: data } });
  const click = selector => { const el = w.document.querySelector(selector); assert.ok(el, selector); el.click(); };
  receive({ type: 'init' });
  const input = w.document.querySelector('#file');
  const file = new File(['No,Products,PRICE BEFORE,PRICE AFTER,DISC PDP\n1,Sunscreen,51,25,20%\n'], 'Wardah.csv');
  Object.defineProperty(input, 'files', { value: [file] });
  await input.onchange({ target: input });
  const template = { id: 'master', name: 'Wardah Master', sourceId: '', sourceSheet: '', brandSheet: '', fields: ['product_name', 'old_price', 'current_price', 'discount'] };
  receive({ type: 'selection', selection: { frames: [template], text: null, template } });
  click('[data-go="generate"]');
  assert.match(w.document.querySelector('#content').textContent, /Brand dan jumlah produk/);
  const limit = w.document.querySelector('#generation-limit'); limit.value = '1'; limit.onchange();
  click('#preview-generate');
  assert.equal(sent.at(-1).type, 'preview-generate');
  assert.deepEqual(Array.from(sent.at(-1).selectedSheets), ['Wardah']);
  assert.equal(sent.at(-1).limitPerSheet, 1);
  receive({ type: 'generation-preview', preview: {
    token: 'generate-1', templateId: 'master', templateName: 'Wardah Master', sheets: ['Wardah'], limitPerSheet: 1,
    assignments: [{ sheetName: 'Wardah', sourceId: '1', productName: 'Sunscreen', values: { product_name: 'Sunscreen', current_price: '25' } }], issues: [],
  } });
  assert.match(w.document.querySelector('#content').textContent, /Siap dibuat: 1 artboard/);
  click('#commit-generate');
  assert.equal(sent.at(-1).type, 'commit-generate');
  assert.equal(sent.at(-1).token, 'generate-1');
  dom.window.close();
});
