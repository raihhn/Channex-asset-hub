import { brandSheet, descendants, fieldKey, isFrame, mappedNodes, sourceId, summary, validField, type TargetFrame } from './core/metadata';
import { fieldLabel, matchSheetName } from './shared';
import { replaceStyledText } from './core/text-edit';
import type { Change, Columns, GenerationPreview, Issue, Preview, Row, UiMessage } from './shared';

figma.showUI(__html__, { width: 450, height: 720, themeColors: true });
const post = (message: unknown) => figma.ui.postMessage(message);
let templateId = '';
let serial = 0;
const token = () => `${Date.now()}-${++serial}`;
type IdPlan = { token: string; assignments: { frameId: string; before: string; beforeSheet: string; after: string; sheetName: string; name: string }[] };
type Propagation = { token: string; assignments: { frameId: string; nodeId: string; field: string }[]; issues: Issue[]; counts: Record<string, number>; targets: number };
type SyncPlan = Preview & { columns: Columns; stripPercent: boolean };
type Path = { index: number; type: string; name: string }[];
type GenerationPlan = { preview: GenerationPreview; signature: string; fields: { field: string; path: Path }[] };
let idPlan: IdPlan | null = null;
let propagation: Propagation | null = null;
let syncPlan: SyncPlan | null = null;
let generationPlan: GenerationPlan | null = null;

const selectedFrames = (): TargetFrame[] => figma.currentPage.selection.filter(isFrame);
const sourceSheet = (frame: TargetFrame): string => frame.getPluginData('channex_source_sheet');
function sheetForFrame(frame: TargetFrame, sheetNames: string[], sheetChoice = ''): string | null {
  if (sheetChoice) return sheetNames.find(name => name.toLocaleLowerCase() === sheetChoice.toLocaleLowerCase()) ?? null;
  const marked = brandSheet(frame);
  if (marked && sheetNames.some(name => name.toLocaleLowerCase() === marked.toLocaleLowerCase())) return sheetNames.find(name => name.toLocaleLowerCase() === marked.toLocaleLowerCase())!;
  const byName = matchSheetName(frame.name, sheetNames);
  if (byName) return byName;
  const stored = sourceSheet(frame);
  if (stored && sheetNames.some(name => name.toLocaleLowerCase() === stored.toLocaleLowerCase())) return sheetNames.find(name => name.toLocaleLowerCase() === stored.toLocaleLowerCase())!;
  return sheetNames.length === 1 ? sheetNames[0] : null;
}
const getFrame = async (id: string): Promise<TargetFrame | null> => {
  const node = await figma.getNodeByIdAsync(id);
  return node && 'type' in node && isFrame(node as SceneNode) ? node as TargetFrame : null;
};
const getText = async (id: string): Promise<TextNode | null> => {
  const node = await figma.getNodeByIdAsync(id);
  return node?.type === 'TEXT' ? node as TextNode : null;
};
const findTemplateOnCurrentPage = (): TargetFrame | null => {
  const found = figma.currentPage.findAll?.(node => node.getPluginData('channex_template') === 'true' && isFrame(node)) ?? [];
  return found[0] as TargetFrame | undefined ?? null;
};
const selection = async () => {
  const frames = selectedFrames().map(summary);
  const chosen = figma.currentPage.selection;
  const text = chosen.length === 1 && chosen[0].type === 'TEXT' ? chosen[0] as TextNode : null;
  const template = templateId ? await getFrame(templateId) : null;
  post({ type: 'selection', selection: { frames, text: text ? { id: text.id, name: text.name, field: fieldKey(text) } : null, template: template ? summary(template) : null } });
};

async function previewIds(requested: { frameId: string; sheetName: string; id: string }[]) {
  const frames = selectedFrames();
  if (!frames.length || frames.length !== requested.length || new Set(requested.map(item => item.frameId)).size !== frames.length) throw new Error('Pilih semua artboard produk yang akan ditandai.');
  const byFrame = new Map(requested.map(item => [item.frameId, item]));
  if (frames.some(frame => !byFrame.has(frame.id))) throw new Error('Pilihan artboard berubah. Pilih ulang lalu periksa lagi.');
  const keys = new Set<string>();
  for (const item of requested) {
    const key = `${item.sheetName.toLocaleLowerCase()}\u0000${item.id.trim()}`;
    if (!item.sheetName || !item.id.trim() || keys.has(key)) throw new Error('Nomor produk kosong atau berulang dalam sheet yang sama. Periksa Excel.');
    keys.add(key);
  }
  idPlan = { token: token(), assignments: frames.map((frame) => {
    const item = byFrame.get(frame.id)!;
    return { frameId: frame.id, before: sourceId(frame), beforeSheet: sourceSheet(frame), after: item.id.trim(), sheetName: item.sheetName, name: frame.name };
  }) };
  post({ type: 'id-preview', plan: idPlan });
}
async function commitIds(value: string) {
  if (!idPlan || idPlan.token !== value) throw new Error('Daftar pasangan sudah berubah. Periksa pasangan lagi.');
  const plan = idPlan; idPlan = null;
  const issues: Issue[] = []; let assigned = 0;
  for (const item of plan.assignments) {
    const frame = await getFrame(item.frameId);
    if (!frame || sourceId(frame) !== item.before || sourceSheet(frame) !== item.beforeSheet) { issues.push({ kind: 'error', id: item.after, sheetName: item.sheetName, message: 'Artboard berubah setelah diperiksa. Periksa pasangan lagi.' }); continue; }
    try { frame.setPluginData('channex_source_id', item.after); frame.setPluginData('channex_source_sheet', item.sheetName); assigned++; }
    catch (error) { issues.push({ kind: 'error', id: item.after, message: String(error) }); }
  }
  post({ type: 'id-result', assigned, issues }); await selection();
}

function pathFrom(frame: TargetFrame, node: SceneNode): Path {
  const path: Path = []; let cursor: BaseNode | null = node;
  while (cursor && cursor.id !== frame.id) {
    const parent: BaseNode | null = cursor.parent;
    if (!parent || !('children' in parent)) throw new Error('Layer berada di luar frame contoh. Pilih layer di dalam frame contoh.');
    const children = parent.children as readonly SceneNode[];
    path.unshift({ index: children.findIndex((child) => child.id === cursor?.id), type: cursor.type, name: cursor.name });
    cursor = parent;
  }
  return path;
}
function locate(frame: TargetFrame, path: Path): SceneNode | null {
  let cursor: SceneNode = frame;
  for (const step of path) {
    if (!('children' in cursor)) return null;
    const children = cursor.children as readonly SceneNode[];
    const indexed = children[step.index];
    if (indexed?.type === step.type) { cursor = indexed; continue; }
    const named = children.filter((child) => child.type === step.type && child.name === step.name);
    if (named.length !== 1) return null;
    cursor = named[0];
  }
  return cursor;
}
async function previewPropagation() {
  const template = await getFrame(templateId);
  if (!template) throw new Error('Pilih satu frame contoh terlebih dahulu.');
  const mapped = descendants(template).filter((node) => fieldKey(node));
  if (!mapped.length) throw new Error('Pilih minimal satu layer teks pada frame contoh.');
  const targets = selectedFrames().filter((frame) => frame.id !== template.id);
  if (!targets.length) throw new Error('Pilih frame lain yang akan memakai susunan layer dari frame contoh.');
  const assignments: Propagation['assignments'] = []; const issues: Issue[] = []; const counts: Record<string, number> = {};
  for (const target of targets) for (const original of mapped) {
    const field = fieldKey(original);
    const found = locate(target, pathFrom(template, original));
    if (found?.type !== 'TEXT') { issues.push({ kind: 'warning', id: target.name, message: `${fieldLabel(field)}: layer tidak ditemukan.` }); continue; }
    if (fieldKey(found) && fieldKey(found) !== field) { issues.push({ kind: 'warning', id: target.name, message: `${fieldLabel(field)}: layer sudah memakai tag lain.` }); continue; }
    if ((mappedNodes(target).get(field) ?? []).some((node) => node.id !== found.id)) { issues.push({ kind: 'warning', id: target.name, message: `${fieldLabel(field)}: ada lebih dari satu layer dengan tag ini.` }); continue; }
    assignments.push({ frameId: target.id, nodeId: found.id, field }); counts[field] = (counts[field] ?? 0) + 1;
  }
  propagation = { token: token(), assignments, issues, counts, targets: targets.length };
  post({ type: 'propagation-preview', plan: propagation });
}
async function commitPropagation(value: string) {
  if (!propagation || propagation.token !== value) throw new Error('Susunan layer sudah berubah. Periksa pasangan layer lagi.');
  const plan = propagation; propagation = null; const issues = [...plan.issues]; let applied = 0;
  for (const assignment of plan.assignments) {
    const frame = await getFrame(assignment.frameId); const node = await getText(assignment.nodeId);
    if (!frame || !node || !descendants(frame).some((child) => child.id === node.id)) { issues.push({ kind: 'error', message: 'Susunan frame berubah setelah diperiksa. Periksa pasangan layer lagi.', id: assignment.frameId }); continue; }
    try { node.setPluginData('channex_field', assignment.field); applied++; }
    catch (error) { issues.push({ kind: 'error', message: String(error), id: frame.name }); }
  }
  post({ type: 'propagation-result', applied, issues }); await selection();
}

function templateSignature(template: TargetFrame): string {
  return JSON.stringify(descendants(template).filter(node => fieldKey(node)).map(node => ({ id: node.id, field: fieldKey(node), type: node.type, characters: node.type === 'TEXT' ? node.characters : '' })).sort((a, b) => a.id.localeCompare(b.id)));
}
function previewGeneration(sheets: { name: string; rows: Row[] }[], selectedSheets: string[], limitPerSheet: number, columns: Columns, stripPercent: boolean): GenerationPreview {
  if (!columns.id) throw new Error('Pilih kolom nomor produk di tab Sync dulu.');
  const template = findTemplateOnCurrentPage();
  if (!template || template.id !== templateId) throw new Error('Pilih artboard master lalu tekan “Jadikan contoh” di tab Template.');
  if (!Number.isInteger(limitPerSheet) || limitPerSheet < 0 || limitPerSheet > 500) throw new Error('Jumlah produk per brand harus 0–500. Isi 0 untuk memakai semua produk.');
  const selected = [...new Set(selectedSheets)].map(name => sheets.find(sheet => sheet.name === name)).filter((sheet): sheet is { name: string; rows: Row[] } => Boolean(sheet));
  if (!selected.length) throw new Error('Pilih minimal satu brand atau sheet.');
  const masterSheet = sheetForFrame(template, sheets.map(sheet => sheet.name));
  if (masterSheet && selected.some(sheet => sheet.name.toLocaleLowerCase() !== masterSheet.toLocaleLowerCase())) throw new Error(`Artboard master cocok ke brand ${masterSheet}. Untuk membuat brand lain, pilih artboard master brand tersebut lalu tekan “Jadikan contoh”.`);
  const mapped = mappedNodes(template);
  const fields: GenerationPlan['fields'] = [];
  for (const [field, nodes] of mapped) {
    if (nodes.length !== 1 || nodes[0].type !== 'TEXT') throw new Error(`${fieldLabel(field)} memiliki tag berulang atau bukan layer teks. Rapikan tag pada artboard master dulu.`);
    fields.push({ field, path: pathFrom(template, nodes[0]) });
  }
  if (!fields.length) throw new Error('Artboard master belum punya tag layer teks yang bisa diisi. Tandai layer dulu di tab Template.');
  if (!fields.some(({ field }) => columns.fields[field])) throw new Error('Tidak ada kolom Excel yang cocok dengan tag pada artboard master. Cocokkan kolom dulu di tab Sync.');
  const issues: Issue[] = [];
  for (const { field } of fields) if (!columns.fields[field]) issues.push({ kind: 'warning', field, action: 'sync', message: `${fieldLabel(field)} belum dicocokkan ke kolom Excel; isi dari artboard master akan ikut tersalin.` });
  for (const [field, column] of Object.entries(columns.fields)) if (column && !mapped.has(field)) issues.push({ kind: 'warning', field, action: 'template', message: `Kolom ${column} tidak punya layer ${fieldLabel(field)} bertag di artboard master; nilainya tidak disalin.` });
  const existingKeys = new Set((figma.currentPage.findAll?.(node => isFrame(node)) ?? [])
    .map(node => node as TargetFrame)
    .map(frame => `${(sourceSheet(frame) || brandSheet(frame)).toLocaleLowerCase()}\u0000${sourceId(frame).trim()}`)
    .filter(key => !key.endsWith('\u0000')));
  const assignments: GenerationPreview['assignments'] = [];
  for (const sheet of selected) {
    const idCounts = new Map<string, number>();
    for (const row of sheet.rows) {
      const id = String(row[columns.id] ?? '').trim();
      if (id) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    }
    const rows = limitPerSheet ? sheet.rows.slice(0, limitPerSheet) : sheet.rows;
    for (const [index, row] of rows.entries()) {
      const id = String(row[columns.id] ?? '').trim();
      if (!id) { issues.push({ kind: 'warning', sheetName: sheet.name, message: `Baris ${index + 2}: nomor produk kosong, dilewati.` }); continue; }
      if (idCounts.get(id)! > 1) { issues.push({ kind: 'warning', id, sheetName: sheet.name, message: 'Nomor produk berulang di sheet ini, dilewati.' }); continue; }
      if (existingKeys.has(`${sheet.name.toLocaleLowerCase()}\u0000${id}`)) { issues.push({ kind: 'warning', id, sheetName: sheet.name, message: 'Artboard untuk produk ini sudah ada di halaman ini, dilewati.' }); continue; }
      const values: Record<string, string> = {};
      for (const { field } of fields) {
        const column = columns.fields[field];
        if (!column) continue;
        let value = String(row[column] ?? '').trim();
        if (field === 'discount' && stripPercent) value = value.replace(/[%％]/g, '').trim();
        values[field] = value;
        if (!value) issues.push({ kind: 'warning', id, sheetName: sheet.name, field, message: `${fieldLabel(field)} kosong di Excel; layer ini akan dikosongkan.` });
      }
      const productName = String(row[columns.fields.product_name] ?? '').trim() || id;
      assignments.push({ sheetName: sheet.name, sourceId: id, productName, values });
      existingKeys.add(`${sheet.name.toLocaleLowerCase()}\u0000${id}`);
    }
  }
  if (!assignments.length) throw new Error('Tidak ada produk baru yang bisa dibuat. Cek pilihan sheet, nomor produk, atau artboard yang sudah ada.');
  if (assignments.length > 500) throw new Error('Pilihan ini menghasilkan lebih dari 500 artboard. Kurangi jumlah produk per brand.');
  const preview: GenerationPreview = { token: token(), templateId: template.id, templateName: template.name, sheets: selected.map(sheet => sheet.name), limitPerSheet, assignments, issues };
  generationPlan = { preview, signature: templateSignature(template), fields };
  return preview;
}
async function commitGeneration(value: string) {
  if (!generationPlan || generationPlan.preview.token !== value) throw new Error('Pratinjau sudah berubah. Periksa lagi sebelum membuat artboard.');
  const plan = generationPlan; generationPlan = null;
  const template = await getFrame(plan.preview.templateId);
  if (!template || templateSignature(template) !== plan.signature) throw new Error('Artboard master berubah setelah diperiksa. Periksa lagi sebelum membuat artboard.');
  const bounds = template.absoluteBoundingBox ?? { x: template.x, y: template.y, width: template.width, height: template.height };
  const issues = [...plan.preview.issues]; const created: TargetFrame[] = [];
  for (const [index, assignment] of plan.preview.assignments.entries()) {
    let duplicate: TargetFrame | null = null;
    try {
      duplicate = template.clone() as TargetFrame;
      duplicate.name = `${assignment.sheetName} - ${assignment.sourceId} - ${assignment.productName}`.slice(0, 120);
      const column = index % 4; const row = Math.floor(index / 4);
      duplicate.x = bounds.x + (column + 1) * (bounds.width + 80);
      duplicate.y = bounds.y + row * (bounds.height + 80);
      duplicate.setPluginData('channex_source_id', assignment.sourceId);
      duplicate.setPluginData('channex_source_sheet', assignment.sheetName);
      duplicate.setPluginData('channex_brand_sheet', assignment.sheetName);
      for (const field of plan.fields) {
        const node = locate(duplicate, field.path);
        if (!node || node.type !== 'TEXT') throw new Error(`${fieldLabel(field.field)} tidak ditemukan pada hasil duplikasi.`);
        node.setPluginData('channex_field', field.field);
        if (field.field in assignment.values) await replaceStyledText(node as TextNode, assignment.values[field.field]);
      }
      created.push(duplicate);
    } catch (error) {
      duplicate?.remove();
      issues.push({ kind: 'error', id: assignment.sourceId, sheetName: assignment.sheetName, message: `Artboard gagal dibuat. ${error instanceof Error ? error.message : 'Coba lagi.'}` });
    }
  }
  if (created.length) {
    figma.currentPage.selection = created;
    figma.viewport.scrollAndZoomIntoView(created.slice(0, 20));
  }
  post({ type: 'generation-result', created: created.length, issues });
  await selection();
}

function makeSyncPreview(sheets: { name: string; rows: Row[] }[], sheetChoice: string, columns: Columns, stripPercent: boolean): SyncPlan {
  if (!columns.id) throw new Error('Pilih kolom nomor produk, misalnya No.');
  const frames = selectedFrames();
  if (!frames.length) throw new Error('Pilih artboard yang ingin diperbarui.');
  if (!sheets.length) throw new Error('Workbook tidak memiliki sheet berisi produk.');
  const issues: Issue[] = []; const rowGroups = new Map<string, Row[]>(); const invalidRows = new Set<Row>();
  const rowKey = (sheetName: string, id: string) => `${sheetName.toLocaleLowerCase()}\u0000${id}`;
  const sheetNames = sheets.map(sheet => sheet.name);
  const canonicalSheetName = (value: string) => sheetNames.find(name => name.toLocaleLowerCase() === value.toLocaleLowerCase()) ?? value;
  for (const sheet of sheets) for (const [index, row] of sheet.rows.entries()) {
    const id = String(row[columns.id] ?? '').trim();
    if (!id) { invalidRows.add(row); issues.push({ kind: 'warning', sheetName: sheet.name, message: `${sheet.name}, baris ${index + 2}: nomor produk kosong.` }); continue; }
    const key = rowKey(sheet.name, id);
    rowGroups.set(key, [...(rowGroups.get(key) ?? []), row]);
  }
  for (const [key, group] of rowGroups) if (group.length > 1) {
    group.forEach((row) => invalidRows.add(row));
    const [rawSheetName, id] = key.split('\u0000'); const sheetName = canonicalSheetName(rawSheetName);
    issues.push({ kind: 'warning', id, sheetName, action: 'sync', message: 'Nomor produk ini berulang di sheet. Produk dilewati.' });
  }
  const frameGroups = new Map<string, TargetFrame[]>();
  const frameSheets = new Map<string, string>();
  for (const frame of frames) {
    const id = sourceId(frame).trim();
    const sheetName = sheetForFrame(frame, sheetNames, sheetChoice);
    if (!sheetName) { issues.push({ kind: 'warning', id: frame.name, frameId: frame.id, action: 'ids', message: 'Sheet produk tidak dikenali dari nama artboard. Tandai artboard di Penanda Frame.' }); continue; }
    if (!id) { issues.push({ kind: 'warning', id: frame.name, sheetName, frameId: frame.id, action: 'ids', message: 'Artboard ini belum punya nomor produk.' }); continue; }
    const key = rowKey(sheetName, id);
    frameSheets.set(frame.id, sheetName);
    frameGroups.set(key, [...(frameGroups.get(key) ?? []), frame]);
  }
  const changes: Change[] = []; const matchedFrameIds = new Set<string>(); let matched = 0; let missingInFigma = 0; let missingInSpreadsheet = 0;
  for (const [key, group] of rowGroups) {
    if (group.length !== 1) continue;
    const [rawSheetName, id] = key.split('\u0000'); const sheetName = canonicalSheetName(rawSheetName);
    const target = frameGroups.get(key);
    if (!target) { missingInFigma++; continue; }
    matched += target.length;
    for (const frame of target) {
      matchedFrameIds.add(frame.id);
      const fields = mappedNodes(frame);
      for (const [field, column] of Object.entries(columns.fields)) {
        if (!column) continue;
        const value = String(group[0][column] ?? '').trim();
        if (!value) { invalidRows.add(group[0]); issues.push({ kind: 'warning', id, sheetName, frameId: frame.id, field, action: 'sync', message: `${fieldLabel(field)} kosong di Excel. Teks lama dibiarkan.` }); continue; }
        const nodes = fields.get(field) ?? [];
        if (nodes.length !== 1) { issues.push({ kind: 'warning', id, sheetName, frameId: frame.id, field, action: 'template', message: `${fieldLabel(field)}: ${nodes.length ? 'tag dipakai lebih dari sekali' : 'belum ada layer bertag'}.` }); continue; }
        if (nodes[0].type !== 'TEXT') { issues.push({ kind: 'warning', id, sheetName, field, frameId: frame.id, action: 'template', message: `${fieldLabel(field)} harus ditandai pada layer teks.` }); continue; }
        const after = field === 'discount' && stripPercent ? value.replace(/[%％]/g, '').trim() : value;
        if (nodes[0].characters !== after) changes.push({ frameId: frame.id, frameName: frame.name, sheetName, sourceId: id, field, nodeId: nodes[0].id, before: nodes[0].characters, after });
      }
    }
  }
  for (const [key, group] of frameGroups) if (!rowGroups.has(key)) {
    missingInSpreadsheet += group.length;
    const [rawSheetName, id] = key.split('\u0000'); const sheetName = canonicalSheetName(rawSheetName);
    for (const frame of group) issues.push({ kind: 'warning', id, sheetName, frameId: frame.id, action: 'ids', message: `Nomor produk tidak ada di sheet ${sheetName}.` });
  }
  const changedIds = new Set(changes.map(change => change.frameId));
  const problemIds = new Set(issues.filter(issue => issue.frameId && matchedFrameIds.has(issue.frameId)).map(issue => issue.frameId!));
  const partialFrames = problemIds.size;
  const changedFrames = [...changedIds].filter(id => matchedFrameIds.has(id) && !problemIds.has(id)).length;
  const unchangedFrames = frames.filter(frame => {
    const sheetName = frameSheets.get(frame.id);
    const key = sheetName ? rowKey(sheetName, sourceId(frame)) : '';
    return key && matchedFrameIds.has(frame.id) && rowGroups.get(key)?.length === 1 && !problemIds.has(frame.id) && !changedIds.has(frame.id);
  }).length;
  const skippedFrames = frames.length - matchedFrameIds.size;
  return { changedFrames, partialFrames, unchangedFrames, skippedFrames, token: token(), rows: sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0), frames: frames.length, matched, missingInFigma, missingInSpreadsheet, invalid: invalidRows.size, changes, issues, columns, stripPercent };
}
async function commitSync(value: string) {
  if (!syncPlan || syncPlan.token !== value) throw new Error('Hasil pemeriksaan sudah berubah. Klik Periksa perubahan lagi.');
  const plan = syncPlan; syncPlan = null; const issues = [...plan.issues]; const updated = new Set<string>();
  for (const change of plan.changes) {
    try {
      const frame = await getFrame(change.frameId); const node = await getText(change.nodeId);
      if (!frame || sourceId(frame) !== change.sourceId || !node || !descendants(frame).some((child) => child.id === node.id) || fieldKey(node) !== change.field || node.characters !== change.before) {
        issues.push({ kind: 'error', id: change.sourceId, message: `${fieldLabel(change.field)}: desain berubah setelah diperiksa. Periksa perubahan lagi sebelum menerapkan.` }); continue;
      }
      await replaceStyledText(node, change.after); updated.add(change.frameId);
    }
    catch (error) { issues.push({ kind: 'error', id: change.sourceId, message: `${fieldLabel(change.field)} gagal diperbarui. ${error instanceof Error ? error.message : 'Periksa akses edit dan font, lalu coba lagi.'}` }); }
  }
  const plannedFrames = new Set(plan.changes.map((change) => change.frameId));
  const unchangedFrames = plan.unchangedFrames;
  post({ type: 'sync-result', result: { updatedFrames: updated.size, partialFrames: plan.partialFrames, unchangedFrames, skippedFrames: plan.skippedFrames, errors: issues.filter((issue) => issue.kind === 'error').length, issues } });
  await selection();
}

figma.ui.onmessage = async (message: UiMessage) => {
  try {
    switch (message.type) {
      case 'focus-frame': {
        const frame = await getFrame(message.frameId);
        if (!frame) throw new Error('Frame tidak ditemukan. Pilih ulang di kanvas.');
        figma.currentPage.selection = [frame];
        figma.viewport.scrollAndZoomIntoView([frame]);
        if (message.template) templateId = frame.id;
        await selection(); break;
      }
      case 'inspect': await selection(); break;
      case 'set-template': {
        const frames = selectedFrames();
        if (frames.length !== 1 || figma.currentPage.selection.length !== 1) throw new Error('Pilih satu frame di Figma sebagai contoh susunan teks.');
        for (const oldTemplate of figma.currentPage.findAll?.(node => node.getPluginData('channex_template') === 'true') ?? []) oldTemplate.setPluginData('channex_template', '');
        frames[0].setPluginData('channex_template', 'true');
        templateId = frames[0].id;
        await selection(); break;
      }
      case 'set-id': {
        const frames = selectedFrames();
        if (frames.length !== 1 || figma.currentPage.selection.length !== 1) throw new Error('Pilih satu frame di kanvas Figma untuk dihubungkan ke produk.');
        if (!message.id.trim()) throw new Error('Pilih produk untuk frame ini.');
        frames[0].setPluginData('channex_source_id', message.id.trim()); await selection(); break;
      }
      case 'set-brand': {
        const frames = selectedFrames();
        if (!frames.length || frames.length !== message.frameIds.length || new Set(message.frameIds).size !== frames.length || frames.some(frame => !message.frameIds.includes(frame.id))) throw new Error('Pilihan artboard berubah. Pilih artboard lagi lalu simpan brand.');
        for (const frame of frames) {
          frame.setPluginData('channex_brand_sheet', message.sheetName.trim());
          if (!message.sheetName.trim()) frame.setPluginData('channex_source_sheet', '');
        }
        post({ type: 'brand-result', count: frames.length, sheetName: message.sheetName.trim() });
        await selection(); break;
      }
      case 'set-product': {
        const frames = selectedFrames();
        if (frames.length !== 1 || figma.currentPage.selection.length !== 1 || frames[0].id !== message.frameId) throw new Error('Pilih satu artboard lalu pilih produknya lagi.');
        if (!message.sourceId.trim() || !message.sheetName.trim()) throw new Error('Pilih produk dari sheet yang tersedia.');
        frames[0].setPluginData('channex_source_id', message.sourceId.trim());
        frames[0].setPluginData('channex_source_sheet', message.sheetName.trim());
        post({ type: 'product-result', sourceId: message.sourceId.trim(), sheetName: message.sheetName.trim() });
        await selection(); break;
      }
      case 'set-field': {
        if (message.field && !validField(message.field)) throw new Error('Isi nama custom field dengan huruf, angka, atau garis bawah.');
        const chosen = figma.currentPage.selection;
        if (chosen.length !== 1 || chosen[0].type !== 'TEXT') throw new Error('Pilih satu layer teks di dalam artboard.');
        let parent: BaseNode | null = chosen[0].parent; let owner: TargetFrame | null = null;
        while (parent) {
          if ('type' in parent && isFrame(parent as SceneNode)) { owner = parent as TargetFrame; break; }
          parent = parent.parent;
        }
        if (!owner) throw new Error('Pilih layer teks yang berada di dalam artboard.');
        const previousField = fieldKey(chosen[0]);
        const conflicts = message.field ? (mappedNodes(owner).get(message.field) ?? []).filter((node) => node.id !== chosen[0].id) : [];
        // Changing a layer's role should not force the user to clear another tag manually.
        // If the requested role is occupied, exchange roles when possible; otherwise transfer
        // the requested role and leave the previous owner untagged.
        if (conflicts.length) {
          const otherPreviousOwners = previousField
            ? (mappedNodes(owner).get(previousField) ?? []).filter((node) => node.id !== chosen[0].id && !conflicts.some(conflict => conflict.id === node.id))
            : [];
          conflicts.forEach((node, index) => node.setPluginData('channex_field', index === 0 && previousField && !otherPreviousOwners.length ? previousField : ''));
        }
        chosen[0].setPluginData('channex_field', message.field); await selection(); break;
      }
      case 'preview-ids': await previewIds(message.assignments); break;
      case 'commit-ids': await commitIds(message.token); break;
      case 'preview-propagation': await previewPropagation(); break;
      case 'commit-propagation': await commitPropagation(message.token); break;
      case 'preview-sync': syncPlan = makeSyncPreview(message.sheets, message.sheetChoice, message.columns, message.stripPercent); post({ type: 'sync-preview', preview: syncPlan }); break;
      case 'commit-sync': await commitSync(message.token); break;
      case 'preview-generate': post({ type: 'generation-preview', preview: previewGeneration(message.sheets, message.selectedSheets, message.limitPerSheet, message.columns, message.stripPercent) }); break;
      case 'commit-generate': await commitGeneration(message.token); break;
      case 'save-settings': {
        const preferences = await figma.clientStorage.getAsync('preferences') ?? {};
        await figma.clientStorage.setAsync('preferences', { ...preferences, columns: message.columns, stripPercent: message.stripPercent }); break;
      }
    }
  } catch (error) { post({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
};
figma.on('selectionchange', () => { idPlan = null; propagation = null; syncPlan = null; generationPlan = null; void selection(); });
figma.on('currentpagechange', () => { templateId = findTemplateOnCurrentPage()?.id ?? ''; generationPlan = null; void selection(); });
void (async () => {
  const settings = await figma.clientStorage.getAsync('preferences');
  templateId = findTemplateOnCurrentPage()?.id ?? '';
  post({ type: 'init', settings });
  await selection();
})();
