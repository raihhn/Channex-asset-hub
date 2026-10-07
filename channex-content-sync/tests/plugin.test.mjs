import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';

const bundle = await readFile(new URL('../dist/code.js', import.meta.url), 'utf8');
let nextId = 0;
let activePage = null;
function node(type, name, characters = '') {
  const metadata = new Map();
  const item = {
    id: `node-${++nextId}`, type, name, parent: null, children: [], characters,
    x: 0, y: 0, width: 1080, height: 1080,
    styles: Array.from(characters, () => 'base'), hasMissingFont: false,
    fontName: { family: 'Inter', style: 'Regular' },
    _metadata: metadata,
    getPluginData(key) { return metadata.get(key) ?? ''; },
    setPluginData(key, value) { metadata.set(key, value); },
    clone() { const duplicate = cloneTree(this); add(activePage, duplicate); return duplicate; },
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); },
    findAll() { return this.children.flatMap((child) => [child, ...(child.findAll?.() ?? [])]); },
    getStyledTextSegments() {
      if (!this.characters.length) return [];
      const out = []; let start = 0;
      for (let index = 1; index <= this.characters.length; index++) if (index === this.characters.length || this.styles[index] !== this.styles[start]) {
        out.push({ start, end: index, fontName: this.fontName }); start = index;
      }
      return out;
    },
    getRangeAllFontNames() { return [this.fontName]; },
    insertCharacters(at, value, useStyle) {
      const style = useStyle === 'AFTER' ? this.styles[at] ?? this.styles[at - 1] : this.styles[at - 1] ?? this.styles[at];
      this.characters = this.characters.slice(0, at) + value + this.characters.slice(at);
      this.styles.splice(at, 0, ...Array.from(value, () => style));
    },
    deleteCharacters(start, end) {
      this.characters = this.characters.slice(0, start) + this.characters.slice(end);
      this.styles.splice(start, end - start);
    },
  };
  return item;
}
function add(parent, child) { child.parent = parent; parent.children.push(child); return child; }
function cloneTree(source) {
  const duplicate = node(source.type, source.name, source.characters);
  duplicate.styles = [...source.styles]; duplicate.fontName = source.fontName; duplicate.hasMissingFont = source.hasMissingFont;
  duplicate.x = source.x; duplicate.y = source.y; duplicate.width = source.width; duplicate.height = source.height;
  for (const [key, value] of source._metadata) duplicate.setPluginData(key, value);
  for (const child of source.children) add(duplicate, cloneTree(child));
  return duplicate;
}
async function harness(count = 10) {
  nextId = 0;
  const messages = [];
  const frames = Array.from({ length: count }, (_, index) => {
    const frame = node('FRAME', `Card ${index + 1}`);
    frame.setPluginData('channex_source_id', `SKU${String(index + 1).padStart(3, '0')}`);
    const price = add(frame, node('TEXT', 'Old price', 'Rp12.000'));
    price.setPluginData('channex_field', 'old_price');
    price.styles = Array.from(price.characters, () => 'strikethrough');
    return frame;
  });
  const page = { type: 'PAGE', children: [], selection: frames, findAll(callback) { return this.children.flatMap(frame => [frame, ...frame.findAll()]).filter(callback); } };
  frames.forEach(frame => add(page, frame)); activePage = page;
  const lookup = new Map(frames.flatMap((frame) => [frame, ...frame.findAll()]).map((item) => [item.id, item]));
  const figma = {
    currentPage: page, mixed: Symbol('mixed'), viewport: { scrollAndZoomIntoView() {} },
    ui: { postMessage(value) { messages.push(value); }, onmessage: null }, showUI() {}, on() {},
    async getNodeByIdAsync(id) { return lookup.get(id) ?? null; }, async loadFontAsync() {},
    clientStorage: { async getAsync() { return null; }, async setAsync() {} },
  };
  vm.runInNewContext(bundle, { figma, __html__: '<html></html>', console, Intl, Date, Set, Map, Promise });
  await Promise.resolve(); await Promise.resolve();
  const send = async (message) => { await figma.ui.onmessage(message); return messages.at(-1); };
  const rows = frames.map((frame) => ({ SKU: frame.getPluginData('channex_source_id'), Price: '8500' }));
  const preview = () => send({ type: 'preview-sync', sheets: [{ name: 'Products', rows }], sheetChoice: '', columns: { id: 'SKU', fields: { old_price: 'Price' } }, stripPercent: true });
  return { figma, frames, rows, messages, send, preview };
}

test('10 matching frames preview, sync, and retain strikethrough styling', async () => {
  const h = await harness(); const message = await h.preview();
  assert.equal(message.type, 'sync-preview'); assert.equal(message.preview.matched, 10);
  assert.equal(message.preview.changes.length, 10);
  await h.send({ type: 'commit-sync', token: message.preview.token });
  assert.equal(h.messages.find((item) => item.type === 'sync-result').result.updatedFrames, 10);
  for (const frame of h.frames) { assert.equal(frame.children[0].characters, '8500'); assert.ok(frame.children[0].styles.every((style) => style === 'strikethrough')); }
});
test('100 frames update by ID even when spreadsheet rows are reordered', async () => {
  const h = await harness(100); h.rows.reverse();
  const message = await h.preview(); assert.equal(message.preview.matched, 100);
  await h.send({ type: 'commit-sync', token: message.preview.token });
  assert.equal(h.messages.find((item) => item.type === 'sync-result').result.updatedFrames, 100);
});
test('unknown row is reported while duplicate frames can share and sync one product', async () => {
  const h = await harness(); h.rows.push({ SKU: 'UNKNOWN', Price: '8500' });
  h.frames[1].setPluginData('channex_source_id', 'SKU001');
  const message = await h.preview();
  assert.equal(message.preview.missingInFigma, 2);
  assert.equal(message.preview.changes.filter(change => change.sourceId === 'SKU001').length, 2);
  await h.send({ type: 'commit-sync', token: message.preview.token });
  assert.equal(h.frames[0].children[0].characters, '8500');
  assert.equal(h.frames[1].children[0].characters, '8500');
});
test('missing mapped field is reported while other frames continue', async () => {
  const h = await harness(); h.frames[2].children[0].setPluginData('channex_field', '');
  const message = await h.preview();
  assert.ok(message.preview.issues.some((issue) => issue.id === 'SKU003' && issue.message.includes('belum ada layer bertag')));
  assert.equal(message.preview.partialFrames, 1);
  assert.equal(message.preview.skippedFrames, 0);
  await h.send({ type: 'commit-sync', token: message.preview.token });
  assert.equal(h.frames[2].children[0].characters, 'Rp12.000');
  assert.equal(h.frames[3].children[0].characters, '8500');
});
test('duplicate spreadsheet ID and blank required cell are skipped', async () => {
  const h = await harness(); h.rows[1].SKU = 'SKU001'; h.rows[2].Price = '';
  const message = await h.preview();
  assert.ok(message.preview.issues.some((issue) => issue.message.includes('berulang di sheet')));
  assert.ok(message.preview.issues.some((issue) => issue.message.includes('kosong di Excel')));
  assert.ok(!message.preview.changes.some((change) => ['SKU001', 'SKU003'].includes(change.sourceId)));
});
test('font failure is isolated to one frame', async () => {
  const h = await harness(); h.frames[0].children[0].hasMissingFont = true;
  const message = await h.preview(); await h.send({ type: 'commit-sync', token: message.preview.token });
  const result = h.messages.find((item) => item.type === 'sync-result').result;
  assert.equal(result.updatedFrames, 9); assert.equal(result.errors, 1);
  assert.equal(h.frames[0].children[0].characters, 'Rp12.000');
});
test('template mapping propagates to structurally matching text layers', async () => {
  const h = await harness(3);
  h.figma.currentPage.selection = [h.frames[0]];
  await h.send({ type: 'set-template' });
  h.figma.currentPage.selection = [h.frames[0].children[0]];
  await h.send({ type: 'set-field', field: 'old_price' });
  h.frames[1].children[0].setPluginData('channex_field', '');
  h.frames[2].children[0].setPluginData('channex_field', '');
  h.figma.currentPage.selection = [h.frames[1], h.frames[2]];
  const message = await h.send({ type: 'preview-propagation' });
  assert.equal(message.plan.counts.old_price, 2);
  await h.send({ type: 'commit-propagation', token: message.plan.token });
  assert.equal(h.frames[1].children[0].getPluginData('channex_field'), 'old_price');
  assert.equal(h.frames[2].children[0].getPluginData('channex_field'), 'old_price');
});
test('ID assignment requires preview and follows selected frame order', async () => {
  const h = await harness(2);
  h.figma.currentPage.selection = [h.frames[1], h.frames[0]];
  const message = await h.send({ type: 'preview-ids', assignments: [{frameId:h.frames[1].id,sheetName:'Products',id:'NEW1'},{frameId:h.frames[0].id,sheetName:'Products',id:'NEW2'}] });
  assert.equal(h.frames[1].getPluginData('channex_source_id'), 'SKU002');
  await h.send({ type: 'commit-ids', token: message.plan.token });
  assert.equal(h.frames[1].getPluginData('channex_source_id'), 'NEW1');
  assert.equal(h.frames[0].getPluginData('channex_source_id'), 'NEW2');
});
test('mixed-style replacement across several spans is skipped', async () => {
  const h = await harness(2);
  h.frames[0].children[0].styles[3] = 'different';
  const message = await h.preview(); await h.send({ type: 'commit-sync', token: message.preview.token });
  const result = h.messages.find((item) => item.type === 'sync-result').result;
  assert.equal(result.errors, 1);
  assert.equal(h.frames[0].children[0].characters, 'Rp12.000');
  assert.equal(h.frames[1].children[0].characters, '8500');
});
test('plugin works without reading a Figma user identity', async () => {
  const h = await harness(1);
  assert.equal(h.figma.currentUser, undefined);
  assert.equal(h.messages[0].type, 'init');
  assert.equal('access' in h.messages[0], false);
  await h.send({ type: 'set-id', id: 'OTHER' });
  assert.equal(h.frames[0].getPluginData('channex_source_id'), 'OTHER');
});


test('Discount preserves percentage or strips only its symbol, including legacy disc tags', async () => {
  for (const stripPercent of [false, true]) {
    const h = await harness(1);
    h.frames[0].children[0].setPluginData('channex_field', 'custom:disc');
    const msg = await h.send({ type: 'preview-sync', sheets: [{name:'Products',rows:[{ No:'SKU001', Disc:'20%' }]}], sheetChoice:'', columns:{id:'No',fields:{discount:'Disc'}},stripPercent });
    assert.equal(msg.preview.changes[0].after, stripPercent ? '20' : '20%');
    await h.send({type:'commit-sync',token:msg.preview.token});
    assert.equal(h.frames[0].children[0].characters, stripPercent ? '20' : '20%');
  }
});
test('Decimal prices and currencies are copied without conversion', async () => {
  const h = await harness(3);
  ['51,8','37,05','RM37.05'].forEach((value,i)=>h.rows[i].Price=value);
  const msg=await h.preview();
  assert.deepEqual(Array.from(msg.preview.changes,c=>c.after),['51,8','37,05','RM37.05']);
});

test('Kahf and Wardah artboards read matching sheets even when product numbers overlap', async () => {
  const h = await harness(2);
  h.frames[0].name = 'Kahf — 1';
  h.frames[1].name = 'Wardah — 1';
  h.frames[0].setPluginData('channex_source_id', '1');
  h.frames[1].setPluginData('channex_source_id', '1');
  h.frames[0].setPluginData('channex_source_sheet', 'Wardah');
  h.frames[0].children[0].characters = 'Kahf old';
  h.frames[1].children[0].characters = 'Wardah old';
  for (const frame of h.frames) frame.children[0].styles = Array.from(frame.children[0].characters, () => 'base');
  const message = await h.send({
    type: 'preview-sync',
    sheets: [
      { name: 'Kahf', rows: [{ No: '1', Price: 'Kahf price' }] },
      { name: 'Wardah', rows: [{ No: '1', Price: 'Wardah price' }] },
    ],
    sheetChoice: '', columns: { id: 'No', fields: { old_price: 'Price' } }, stripPercent: true,
  });
  assert.equal(message.preview.changes.length, 2);
  assert.deepEqual(Array.from(message.preview.changes, change => [change.sheetName, change.after]), [['Kahf', 'Kahf price'], ['Wardah', 'Wardah price']]);
  await h.send({ type: 'commit-sync', token: message.preview.token });
  assert.equal(h.frames[0].children[0].characters, 'Kahf price');
  assert.equal(h.frames[1].children[0].characters, 'Wardah price');
});

test('manual brand marker selects a sheet when the artboard name has no brand', async () => {
  const h = await harness(1);
  h.frames[0].name = 'Promo frame 1';
  h.frames[0].setPluginData('channex_source_id', '1');
  const marked = await h.send({ type: 'set-brand', frameIds: [h.frames[0].id], sheetName: 'Wardah' });
  assert.equal(marked.type, 'selection');
  assert.equal(h.frames[0].getPluginData('channex_brand_sheet'), 'Wardah');
  const message = await h.send({
    type: 'preview-sync',
    sheets: [
      { name: 'Kahf', rows: [{ No: '1', Price: 'Kahf price' }] },
      { name: 'Wardah', rows: [{ No: '1', Price: 'Wardah price' }] },
    ],
    sheetChoice: '', columns: { id: 'No', fields: { old_price: 'Price' } }, stripPercent: true,
  });
  assert.deepEqual(Array.from(message.preview.changes, change => [change.sheetName, change.after]), [['Wardah', 'Wardah price']]);
});

test('one duplicated frame can be relinked to another product without changing its copy', async () => {
  const h = await harness(1);
  const duplicate = node('FRAME', 'Promo copy');
  duplicate.setPluginData('channex_source_id', h.frames[0].getPluginData('channex_source_id'));
  duplicate.setPluginData('channex_source_sheet', 'Wardah');
  const text = add(duplicate, node('TEXT', 'Old price', 'Rp12.000'));
  text.setPluginData('channex_field', 'old_price');
  h.figma.currentPage.selection = [duplicate];
  const message = await h.send({ type: 'set-product', frameId: duplicate.id, sheetName: 'Wardah', sourceId: '2' });
  assert.equal(message.type, 'selection');
  assert.equal(duplicate.getPluginData('channex_source_id'), '2');
  assert.equal(h.frames[0].getPluginData('channex_source_id'), 'SKU001');
  assert.equal(duplicate.getPluginData('channex_source_sheet'), 'Wardah');
});

test('a text layer role can be changed or cleared after it was tagged', async () => {
  const h = await harness(1);
  const text = h.frames[0].children[0];
  h.figma.currentPage.selection = [text];
  let message = await h.send({ type: 'set-field', field: 'current_price' });
  assert.equal(message.type, 'selection');
  assert.equal(text.getPluginData('channex_field'), 'current_price');
  message = await h.send({ type: 'set-field', field: '' });
  assert.equal(message.type, 'selection');
  assert.equal(text.getPluginData('channex_field'), '');
});
test('changing a text layer to an occupied role swaps the existing roles without deleting tags first', async () => {
  const h = await harness(1);
  const oldPrice = h.frames[0].children[0];
  const currentPrice = add(h.frames[0], node('TEXT', 'Current price', '25,9'));
  currentPrice.setPluginData('channex_field', 'current_price');
  h.figma.currentPage.selection = [oldPrice];

  const message = await h.send({ type: 'set-field', field: 'current_price' });

  assert.equal(message.type, 'selection');
  assert.equal(oldPrice.getPluginData('channex_field'), 'current_price');
  assert.equal(currentPrice.getPluginData('channex_field'), 'old_price');
});
test('master artboards duplicate selected spreadsheet rows with values and brand markers', async () => {
  const h = await harness(1);
  const master = h.frames[0];
  master.name = 'Wardah Master';
  master.setPluginData('channex_source_sheet', 'Wardah');
  add(master, node('TEXT', 'Product name', 'Master product')).setPluginData('channex_field', 'product_name');
  add(master, node('TEXT', 'Current price', 'RM0')).setPluginData('channex_field', 'current_price');
  add(master, node('TEXT', 'Discount', '0')).setPluginData('channex_field', 'discount');
  h.figma.currentPage.selection = [master];
  await h.send({ type: 'set-template' });
  const sheets = [
    { name: 'Wardah', rows: [
      { SKU: 'SKU001', Product: 'Master row', Price: '10', Disc: '10%' },
      { SKU: 'SKU002', Product: 'Sunscreen', Price: '25,9', Disc: '20%' },
      { SKU: 'SKU003', Product: 'Face wash', Price: '19,5', Disc: '30%' },
    ] },
    { name: 'Kahf', rows: [{ SKU: 'SKU002', Product: 'Kahf product', Price: '31', Disc: '40%' }] },
  ];
  const columns = { id: 'SKU', fields: { product_name: 'Product', old_price: 'Price', current_price: 'Price', discount: 'Disc' } };
  const preview = await h.send({ type: 'preview-generate', sheets, selectedSheets: ['Wardah'], limitPerSheet: 2, columns, stripPercent: true });
  assert.equal(preview.type, 'generation-preview');
  assert.deepEqual(Array.from(preview.preview.assignments, row => row.sourceId), ['SKU002']);
  assert.equal(h.figma.currentPage.children.length, 1);
  await h.send({ type: 'commit-generate', token: preview.preview.token });
  const result = h.messages.find(message => message.type === 'generation-result');
  assert.equal(result.created, 1);
  assert.equal(h.figma.currentPage.children.length, 2);
  const created = h.figma.currentPage.children[1];
  assert.equal(created.getPluginData('channex_source_id'), 'SKU002');
  assert.equal(created.getPluginData('channex_source_sheet'), 'Wardah');
  assert.equal(created.getPluginData('channex_brand_sheet'), 'Wardah');
  assert.equal(created.children.find(child => child.name === 'Product name').characters, 'Sunscreen');
  assert.equal(created.children.find(child => child.name === 'Current price').characters, '25,9');
  assert.equal(created.children.find(child => child.name === 'Discount').characters, '20');
  assert.equal(created.children.find(child => child.name === 'Current price').getPluginData('channex_field'), 'current_price');
});
test('a brand-specific master cannot generate artboards for another brand sheet', async () => {
  const h = await harness(1);
  const master = h.frames[0]; master.setPluginData('channex_source_id', '1'); master.setPluginData('channex_source_sheet', 'Wardah');
  master.setPluginData('channex_template', 'true');
  h.figma.currentPage.selection = [master]; await h.send({ type: 'set-template' });
  const preview = await h.send({
    type: 'preview-generate',
    sheets: [
      { name: 'Wardah', rows: [{ No: '1', Price: 'Wardah price' }] },
      { name: 'Kahf', rows: [{ No: '1', Price: 'Kahf price' }] },
    ],
    selectedSheets: ['Wardah', 'Kahf'], limitPerSheet: 0,
    columns: { id: 'No', fields: { old_price: 'Price' } }, stripPercent: false,
  });
  assert.equal(preview.type, 'error');
  assert.match(preview.message, /master cocok ke brand Wardah/);
  assert.equal(h.figma.currentPage.children.length, 1);
});
