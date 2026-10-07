import { FIELDS, fieldLabel, matchSheetName, type Columns, type GenerationPreview, type Issue, type Preview, type Selection, type UiMessage } from './shared';
import { parseSpreadsheet, type Imported, type ImportedSheet } from './spreadsheet/parser';
type Tab = 'sync' | 'ids' | 'template' | 'generate' | 'review' | 'settings';
type IdPlan = { token: string; assignments: { frameId: string; before: string; beforeSheet: string; after: string; sheetName: string; name: string }[] };
type Propagation = { token: string; targets: number; counts: Record<string, number>; issues: Issue[] };
const app = document.querySelector<HTMLElement>('#app')!;
let workbook: Imported | null = null;
let imported: ImportedSheet | null = null;
let sourceFile: File | null = null;
let decimalLocale = 'id';
let selected: Selection = { frames: [], text: null, template: null };
let columns: Columns = { id: '', fields: {} };
let stripPercent = true;
let tab: Tab = 'sync';
let syncPreview: Preview | null = null;
let generationPreview: GenerationPreview | null = null;
let generationSheets: string[] = [];
let generationLimitPerSheet = 0;
let idPreview: IdPlan | null = null;
let propagation: Propagation | null = null;
let report = '';
let reportIssues: Issue[] = [];
let busy = false;
const send = (message: UiMessage) => parent.postMessage({ pluginMessage: message }, '*');
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const option = (value: string, current: string, text: string) => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(text)}</option>`;
const button = (id: string, text: string, disabled = false, secondary = false) => `<button id="${id}" ${disabled || busy ? 'disabled' : ''} class="${secondary ? 'secondary' : ''}">${text}</button>`;
const fieldKeys = () => [...new Set([...FIELDS, ...(selected.template?.fields ?? []), ...selected.frames.flatMap(frame => frame.fields), ...Object.keys(columns.fields)])];
const save = () => send({ type: 'save-settings', columns, stripPercent });
function sheetForFrame(frame: Selection['frames'][number]): string | null {
  const names = workbook?.sheets.map(sheet => sheet.name) ?? [];
  if (frame.brandSheet && names.some(name => name.toLocaleLowerCase() === frame.brandSheet.toLocaleLowerCase())) return names.find(name => name.toLocaleLowerCase() === frame.brandSheet.toLocaleLowerCase())!;
  const byName = matchSheetName(frame.name, names);
  if (byName) return byName;
  if (frame.sourceSheet && names.some(name => name.toLocaleLowerCase() === frame.sourceSheet.toLocaleLowerCase())) return names.find(name => name.toLocaleLowerCase() === frame.sourceSheet.toLocaleLowerCase())!;
  return names.length === 1 ? names[0] : null;
}
function refreshImportedSheet() {
  if (!workbook?.sheets.length) { imported = null; return; }
  const resolved = [...new Set(selected.frames.map(sheetForFrame).filter((name): name is string => Boolean(name)))];
  const preferred = resolved.length === 1 ? resolved[0] : selected.frames.map(sheetForFrame).find(Boolean) ?? workbook.sheets[0].name;
  imported = workbook.sheets.find(sheet => sheet.name === preferred) ?? workbook.sheets[0];
}
function makeIdAssignments(): { assignments?: { frameId: string; sheetName: string; id: string }[]; error?: string } {
  if (!workbook || !columns.id) return { error: 'Upload Excel di tab Sync dulu.' };
  if (!selected.frames.length) return { error: 'Pilih artboard produk dulu.' };
  const groups = new Map<string, Selection['frames']>();
  for (const frame of selected.frames) {
    const sheetName = sheetForFrame(frame);
    if (!sheetName) return { error: `Sheet untuk “${frame.name}” belum dikenali. Tandai brand artboard atau sesuaikan nama artboard.` };
    groups.set(sheetName, [...(groups.get(sheetName) ?? []), frame]);
  }
  const assignments: { frameId: string; sheetName: string; id: string }[] = [];
  for (const [sheetName, frames] of groups) {
    const sheet = workbook.sheets.find(item => item.name === sheetName)!;
    if (frames.length !== sheet.rows.length) return { error: `${sheetName}: ${frames.length} artboard dipilih untuk ${sheet.rows.length} produk.` };
    frames.forEach((frame, index) => assignments.push({ frameId: frame.id, sheetName, id: String(sheet.rows[index][columns.id] ?? '') }));
  }
  return { assignments };
}
const product = (id: string, sheetName = '') => {
  const source = workbook?.sheets.find(sheet => sheet.name === sheetName) ?? imported;
  const row = source?.rows.find(row => row[columns.id] === id);
  const name = row?.[columns.fields.product_name] ?? '';
  return `${id}${name ? ` — ${name}` : ''}`;
};
const issuesHtml = (issues: Issue[]) => issues.length ? `<ul class="issues">${issues.map(issue => `<li class="${issue.kind}"><strong>${esc(issue.id ? `${issue.sheetName ? `${issue.sheetName} · ` : ''}Produk ${product(issue.id, issue.sheetName)}` : 'Perlu dicek')}</strong><p>${esc(issue.message)}</p>${issue.action ? `<button class="secondary" data-go="${issue.action}" data-frame="${esc(issue.frameId ?? '')}">${issue.action === 'ids' ? 'Tandai artboard' : issue.action === 'template' ? 'Pilih layer teks' : 'Cek kolom Excel'}</button>` : ''}${issue.field ? `<button class="secondary" data-ignore="${esc(issue.field)}">Lewati ${esc(fieldLabel(issue.field))}</button>` : ''}</li>`).join('')}</ul>` : '<p class="success">Tidak ada masalah.</p>';
const on = (id: string, action: () => void) => { const el = app.querySelector<HTMLButtonElement>(`#${id}`); if (el) el.onclick = action; };
function go(next: Tab) { tab = next; report = ''; render(); }
function render() {
  const tabs: [Tab,string][] = [['sync','Sync'],['template','Template'],['ids','Penanda Frame'],['generate','Buat Artboard']];
  app.innerHTML = `<header><h1>Channex Content Sync</h1></header><nav aria-label="Langkah sinkronisasi">${tabs.map(([key,name]) => `<button data-go="${key}" class="tab ${tab === key ? 'active' : ''}">${name}</button>`).join('')}<button data-go="settings" class="tab ${tab === 'settings' ? 'active' : ''}" aria-label="Pengaturan">⚙</button></nav>${busy ? '<p role="status">Sedang diproses…</p>' : ''}<div id="content"></div>${report ? `<section class="card result" role="status"><h2>${esc(report)}</h2>${reportIssues.length ? issuesHtml(reportIssues) : ''}</section>` : ''}`;
  const content = app.querySelector<HTMLElement>('#content')!;
  if (tab === 'sync') {
    content.innerHTML = '<div id="import-area"></div><div id="preview-area"></div>';
    renderImport(content.querySelector<HTMLElement>('#import-area')!);
    renderReview(content.querySelector<HTMLElement>('#preview-area')!);
  }
  if (tab === 'ids') renderIds(content);
  if (tab === 'template') renderTemplate(content);
  if (tab === 'generate') renderGeneration(content);
  if (tab === 'review') renderReview(content);
  if (tab === 'settings') { content.innerHTML = `<section class="card"><h2>Pengaturan</h2><p class="muted">Pilihan kolom dan simbol % tersimpan di perangkat ini. File Excel tidak disimpan.</p></section>`; }
  app.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(el => el.onclick = () => { if (el.dataset.frame) send({type:'focus-frame',frameId:el.dataset.frame,template:el.dataset.go==='template'}); go(el.dataset.go as Tab); });
  app.querySelectorAll<HTMLButtonElement>('[data-ignore]').forEach(el => el.onclick = () => { columns.fields[el.dataset.ignore!] = ''; syncPreview = null; report = 'Kolom dilewati. Periksa perubahan lagi.'; save(); render(); });
}
function renderImport(content: HTMLElement) {
  content.innerHTML = `<section class="card"><h2>File Excel</h2><div class="file-picker"><button type="button" id="choose-file" class="secondary">Pilih file</button><span>${workbook ? esc(workbook.fileName) : 'Belum ada file'}</span></div><input id="file" type="file" accept=".xlsx,.csv" hidden ${busy ? 'disabled' : ''}/>${workbook ? `<p>${workbook.sheets.length} sheet · ${workbook.sheets.map(sheet => esc(sheet.name)).join(', ')}</p><p class="muted">Sheet dipilih dari penanda brand atau nama artboard.</p>` : '<p class="muted">Baris pertama boleh berisi judul atau data produk.</p>'}${imported ? `<p><b>Preview: ${esc(imported.name)}</b> · ${imported.rows.length} produk</p><p class="muted">${imported.hasHeaders ? 'Baris 1 dibaca sebagai judul. Produk pertama mulai di baris 2.' : 'Baris 1 dibaca sebagai produk pertama.'}</p><div class="table-wrap"><table><thead><tr>${imported.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${imported.rows.slice(0,5).map(row => `<tr>${imported!.headers.map(h => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><label>Pemisah desimal <select id="decimal-locale">${option('id',decimalLocale,'Koma (51,8)')}${option('en',decimalLocale,'Titik (51.8)')}</select></label>${imported.issues.map(issue => `<p class="warning">${esc(issue)}</p>`).join('')}` : ''}</section>${imported ? `<section class="card"><h2>Kolom nomor produk</h2><label>Nomor produk ${columnSelect('id', columns.id, false)}</label></section>` : ''}`;
  on('choose-file', () => app.querySelector<HTMLInputElement>('#file')!.click());
  app.querySelector<HTMLInputElement>('#file')!.onchange = async event => {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    syncPreview = null; generationPreview = null; idPreview = null; imported = null; workbook = null; generationSheets = []; busy = true; report = ''; render();
    try {
      sourceFile = file; workbook = await parseSpreadsheet(file, decimalLocale);
      generationSheets = workbook.sheets.map(item => item.name);
      refreshImportedSheet();
      const sheet = imported!;
      const find = (aliases: string[]) => sheet.headers.find(h => aliases.includes(h.toLowerCase().trim())) ?? '';
      columns.id = find(['no','no.','nomor']) || (sheet.headers.includes(columns.id) ? columns.id : find(['id','sku']));
      const aliases: Record<string,string[]> = { product_name: ['products','product name','products name','nama produk'], usp:['usp','usp copy'], old_price:['price before','old price','harga coret'], current_price:['price after','current price','harga promo'], discount:['disc pdp','discount','disc','diskon'] };
      for (const field of fieldKeys()) {
        const previous = columns.fields[field];
        columns.fields[field] = previous && sheet.headers.includes(previous) ? previous : find(aliases[field] ?? [field.replace('custom:','')]);
      }
      save();
    } catch (error) { report = error instanceof Error ? error.message : 'File tidak dapat dibaca. Simpan ulang lalu coba lagi.'; reportIssues = []; workbook = null; imported = null; }
    finally { busy = false; render(); }
  };
  const locale = app.querySelector<HTMLSelectElement>('#decimal-locale');
  if(locale) locale.onchange = async () => { decimalLocale=locale.value; syncPreview=null; idPreview=null; if(sourceFile) { busy=true;render();try { workbook=await parseSpreadsheet(sourceFile,decimalLocale);refreshImportedSheet(); } catch(error){workbook=null;imported=null;report=error instanceof Error?error.message:'File tidak dapat dibaca.';} finally {busy=false;render();} } };
  bindColumns(); on('next-products', () => go('ids'));
}
function columnSelect(key: string, current: string, ignore = true) {
  return `<select data-column="${esc(key)}">${option('',current,ignore ? 'Tidak digunakan' : 'Pilih kolom No')}${(imported?.headers ?? []).map(h => option(h,current,h)).join('')}</select>`;
}
function bindColumns() { app.querySelectorAll<HTMLSelectElement>('[data-column]').forEach(el => el.onchange = () => { if(el.dataset.column === 'id') columns.id = el.value; else columns.fields[el.dataset.column!] = el.value; syncPreview = null; generationPreview = null; idPreview = null; save(); render(); }); }
function renderIds(content: HTMLElement) {
  const linked = selected.frames.filter(f => f.sourceId).length;
  const preparation = makeIdAssignments();
  const markerSheets = [...new Set(selected.frames.map(frame => frame.brandSheet).filter(Boolean))];
  const sameMarker = selected.frames.length > 0 && selected.frames.every(frame => frame.brandSheet === selected.frames[0].brandSheet);
  const brandValue = sameMarker ? selected.frames[0].brandSheet : markerSheets.length ? '__mixed' : '';
  const showBulkLink = !selected.frames.length || selected.frames.some(frame => !frame.sourceId);
  const single = selected.frames.length === 1 ? selected.frames[0] : null;
  const productSheetName = single ? sheetForFrame(single) : null;
  const productSheet = workbook?.sheets.find(sheet => sheet.name === productSheetName);
  const productRows = productSheet?.rows ?? [];
  content.innerHTML = `${workbook ? `<section class="card"><h2>Tandai brand artboard</h2><p>Pilih artboard, lalu pilih brand-nya. Penanda ini menentukan sheet walau nama artboard tidak memuat brand.</p><p>${selected.frames.length ? `${selected.frames.length} artboard dipilih · ${markerSheets.length ? `sudah bertanda ${markerSheets.map(esc).join(', ')}` : 'belum ada penanda'}` : 'Pilih artboard di kanvas dulu.'}</p><label>Brand <select id="brand-sheet" ${!selected.frames.length ? 'disabled' : ''}>${brandValue === '__mixed' ? '<option value="__mixed" selected disabled>Penanda berbeda</option>' : ''}${option('',brandValue,'Otomatis dari nama artboard')}${workbook.sheets.map(sheet => option(sheet.name,brandValue,sheet.name)).join('')}</select></label><p class="muted">Pilih “Otomatis” untuk menghapus penanda manual.</p>${button('save-brand','Simpan penanda brand',!selected.frames.length || !workbook)}${button('cancel-brand','Batal',false,true)}</section><section class="card"><h2>Ganti produk untuk satu artboard</h2>${single && productSheet ? `<p>Sheet: <b>${esc(productSheet.name)}</b> · Frame: ${esc(single.name)}</p><label>Produk <select id="frame-product">${productRows.map(row => {const id=String(row[columns.id]??'').trim();return id?option(id,single.sourceId,`${id}${row[columns.fields.product_name]?` — ${row[columns.fields.product_name]}`:''}`):'';}).join('')}</select></label>${button('save-product','Simpan produk',!productRows.length)}<p class="muted">Duplikat mewarisi produk yang sama. Pilih produk lain di sini untuk mengubah duplikat ini saja.</p>` : `<p>${selected.frames.length > 1 ? 'Pilih satu artboard untuk mengganti produknya.' : selected.frames.length === 1 ? 'Sheet belum dikenali. Tandai brand atau gunakan nama artboard yang memuat nama sheet.' : 'Pilih satu artboard di kanvas dulu.'}</p>`}</section>` : `<section class="card"><h2>Tandai brand artboard</h2><p>Upload workbook di tab Sync dulu supaya pilihan brand tersedia.</p></section>`}${showBulkLink ? `<section class="card"><h2>Hubungkan artboard sekali</h2><p>${selected.frames.length} dipilih · ${linked} terhubung</p><p>Pilih artboard yang belum terhubung sesuai urutan produk di setiap sheet. Penanda brand menentukan sheet; kalau kosong, nama artboard dipakai.</p>${preparation.error ? `<p class="${selected.frames.length ? 'warning' : 'muted'}">${esc(preparation.error)}</p>` : button('preview-ids',`Periksa ${preparation.assignments!.length} pasangan`)}${idPreview ? `<div class="change-list">${idPreview.assignments.map((item,index) => `<div class="change"><b>${index+1}. ${esc(item.name)}</b><p>${esc(item.sheetName)} · ${esc(product(item.after,item.sheetName))}</p></div>`).join('')}</div>${button('commit-ids','Simpan pasangan')}${button('cancel-ids','Batal',false,true)}` : ''}</section>` : ''}`;
  on('save-brand',()=>{const choice=app.querySelector<HTMLSelectElement>('#brand-sheet')?.value;if(choice===undefined||choice==='__mixed')return;send({type:'set-brand',frameIds:selected.frames.map(frame=>frame.id),sheetName:choice});});
  on('save-product',()=>{if(single&&productSheet){const sourceId=app.querySelector<HTMLSelectElement>('#frame-product')?.value;if(sourceId)send({type:'set-product',frameId:single.id,sheetName:productSheet.name,sourceId});}});
  on('cancel-brand',()=>{render();});
  on('preview-ids', () => { const current = makeIdAssignments(); if(current.assignments) send({type:'preview-ids',assignments:current.assignments}); });
  on('commit-ids', () => { if(idPreview) send({type:'commit-ids',token:idPreview.token}); idPreview=null; render(); });
  on('cancel-ids', () => {idPreview=null;render();});
}
function renderGeneration(content: HTMLElement) {
  if (!workbook) {
    content.innerHTML = '<section class="card"><h2>Buat artboard dari Excel</h2><p>Upload workbook di tab Sync dulu.</p></section>';
    return;
  }
  const sheets = workbook.sheets;
  const template = selected.template;
  const masterSheet = template ? sheetForFrame(template) : null;
  const chosen = generationSheets.filter(name => sheets.some(sheet => sheet.name === name) && (!masterSheet || name.toLocaleLowerCase() === masterSheet.toLocaleLowerCase()));
  content.innerHTML = `<section class="card"><h2>Artboard master</h2><p>${template ? esc(template.name) : 'Belum ada artboard master.'}</p><p class="muted">Pilih satu artboard di kanvas, lalu tekan “Jadikan contoh” di tab Template. Tag teksnya akan dipakai untuk mengisi salinan.</p></section><section class="card"><h2>Brand dan jumlah produk</h2><p>Pilih sheet/brand yang mau dibuat. Satu artboard dibuat untuk setiap baris produk terpilih.</p>${masterSheet ? `<p class="muted">Master ini cocok ke ${esc(masterSheet)}. Untuk brand lain, pilih artboard master brand itu dan jadikan contoh dulu.</p>` : ''}${sheets.map(sheet => `<label class="check"><input type="checkbox" data-generate-sheet="${esc(sheet.name)}" ${chosen.includes(sheet.name) ? 'checked' : ''} ${masterSheet && sheet.name.toLocaleLowerCase() !== masterSheet.toLocaleLowerCase() ? 'disabled' : ''}/> ${esc(sheet.name)} · ${sheet.rows.length} produk</label>`).join('')}<label>Produk per brand <input id="generation-limit" type="number" min="0" max="500" value="${generationLimitPerSheet}"/></label><small class="muted">Isi 0 untuk semua produk. Jumlah maksimum 500 artboard per proses.</small>${button('preview-generate','Periksa artboard',!template || !columns.id || !chosen.length)}</section>${generationPreview ? `<section class="card"><h2>Siap dibuat: ${generationPreview.assignments.length} artboard</h2><p>${generationPreview.sheets.map(esc).join(', ')}${generationPreview.limitPerSheet ? ` · maks. ${generationPreview.limitPerSheet} produk per brand` : ' · semua produk'}</p><div class="change-list">${generationPreview.assignments.map(item => `<article class="change"><b>${esc(item.sheetName)} · ${esc(item.sourceId)} — ${esc(item.productName)}</b>${Object.entries(item.values).map(([field,value]) => `<div>${esc(fieldLabel(field))}: <span class="after">${value ? esc(value) : '(kosong)'}</span></div>`).join('')}</article>`).join('')}</div>${generationPreview.issues.length ? `<h3>Perlu dicek</h3>${issuesHtml(generationPreview.issues)}` : '<p class="success">Semua nilai siap disalin dari Excel.</p>'}<p class="muted">Artboard baru ditata di samping artboard master dan langsung terhubung ke sheet serta nomor produknya.</p>${button('commit-generate',`Buat & isi ${generationPreview.assignments.length} artboard`)}${button('cancel-generate','Batal',false,true)}</section>` : ''}`;
  content.querySelectorAll<HTMLInputElement>('[data-generate-sheet]').forEach(input => input.onchange = () => {
    generationSheets = Array.from(content.querySelectorAll<HTMLInputElement>('[data-generate-sheet]:checked')).map(item => item.dataset.generateSheet!);
    generationPreview = null; render();
  });
  const limit = content.querySelector<HTMLInputElement>('#generation-limit');
  if (limit) limit.onchange = () => { generationLimitPerSheet = Math.min(500, Math.max(0, Math.floor(Number(limit.value) || 0))); generationPreview = null; render(); };
  on('preview-generate', () => send({ type: 'preview-generate', sheets: sheets.map(sheet => ({ name: sheet.name, rows: sheet.rows })), selectedSheets: chosen, limitPerSheet: generationLimitPerSheet, columns, stripPercent }));
  on('commit-generate', () => { if (generationPreview) { busy = true; send({ type: 'commit-generate', token: generationPreview.token }); generationPreview = null; render(); } });
  on('cancel-generate', () => { generationPreview = null; render(); });
}
function renderTemplate(content: HTMLElement) {
  const template = selected.template;
  content.innerHTML = `<section class="card"><h2>Artboard contoh</h2><p>${template ? esc(template.name) : 'Pilih satu artboard sebagai contoh.'}</p>${button('set-template','Jadikan contoh',selected.frames.length!==1)}</section><section class="card"><h2>Tandai layer teks</h2><p>${selected.text ? `Layer dipilih: <b>${esc(selected.text.name)}</b> · ${esc(selected.text.field ? fieldLabel(selected.text.field) : 'Belum ditandai')}` : 'Pilih layer teks di kanvas untuk menandai atau mengubah fungsinya.'}</p><label>Fungsi layer <select id="field">${option('',selected.text?.field ?? '', 'Tidak ditandai')}${FIELDS.map(f=>option(f,selected.text?.field ?? '',fieldLabel(f))).join('')}${selected.text?.field.startsWith('custom:') ? option(selected.text.field,selected.text.field,fieldLabel(selected.text.field)):''}${option('custom','','Custom')}</select></label><input id="custom-field" placeholder="Nama custom" hidden/>${button('set-field','Simpan tag',!selected.text)}${!selected.text ? '<p class="muted">Pilih layer teks di kanvas.</p>' : ''}<ul>${fieldKeys().map(field=>`<li>${esc(fieldLabel(field))}: ${template?.fields.includes(field) ? 'Sudah ditandai' : 'Belum ditandai'} pada frame contoh</li>`).join('')}</ul></section><section class="card"><h2>Pakai tag di artboard lain</h2><p>Pilih artboard lain dengan susunan layer yang sama.</p>${button('preview-propagation','Periksa susunan',!template || !selected.frames.some(f=>f.id!==template.id))}${propagation ? `<p>${propagation.targets} artboard · ${Object.entries(propagation.counts).map(([field,count])=>`${fieldLabel(field)} ${count}`).join(' · ')}</p>${issuesHtml(propagation.issues)}${button('commit-propagation','Terapkan tag',!Object.keys(propagation.counts).length)}${button('cancel-propagation','Batal',false,true)}`:''}</section>`;
  on('set-template',()=>send({type:'set-template'}));
  const field=app.querySelector<HTMLSelectElement>('#field')!;const custom=app.querySelector<HTMLInputElement>('#custom-field')!;
  field.onchange=()=>{custom.hidden=field.value!=='custom';};
  on('set-field',()=>send({type:'set-field',field:field.value==='custom'?`custom:${custom.value.trim().toLowerCase().replace(/\s+/g,'_')}`:field.value}));
  on('preview-propagation',()=>send({type:'preview-propagation'}));
  on('commit-propagation',()=>{if(propagation)send({type:'commit-propagation',token:propagation.token});propagation=null;render();});
  on('cancel-propagation',()=>{propagation=null;render();});
}
function renderReview(content: HTMLElement) {
  const keys = fieldKeys();
  const sample = imported?.rows.find(r => r[columns.fields.discount])?.[columns.fields.discount] ?? '20%';
  const active = Object.values(columns.fields).some(Boolean);
  const frameIds = new Set(syncPreview?.changes.map(change=>change.frameId) ?? []);
  if (!imported) { content.innerHTML = ''; return; }
  content.innerHTML = `<section class="card"><h2>Cocokkan kolom Excel</h2>${keys.map(field=>`<label>${esc(fieldLabel(field))} ${columnSelect(field,columns.fields[field] ?? '')}</label>`).join('')}<label class="check"><input id="strip-percent" type="checkbox" ${stripPercent?'checked':''}/> Hapus tanda % dari teks diskon</label><small class="muted">Centang jika tanda % sudah ada di layer terpisah · Contoh: ${esc(sample)} → ${esc(stripPercent?sample.replace(/[%％]/g,'').trim():sample)}</small></section><section class="card"><h2>Artboard yang dipilih</h2><p>${selected.frames.length} dipilih · ${selected.frames.filter(f=>f.sourceId).length} terhubung</p>${button('preview-sync','Periksa perubahan',!columns.id || !active || !selected.frames.length)}${selected.frames.length && selected.frames.some(f=>!f.sourceId) ? `<p class="warning">${selected.frames.filter(f=>!f.sourceId).length} artboard belum terhubung. Buka <b>Penanda Frame</b>.</p>` : !selected.frames.length ? '<p class="muted">Pilih artboard yang ingin diperbarui.</p>' : ''}</section>${syncPreview ? `<section class="card"><h2>Hasil pemeriksaan</h2><p>${syncPreview.rows} produk di ${workbook?.sheets.length ?? 0} sheet · ${syncPreview.frames} artboard dipilih</p><div class="stats"><span>Berubah <b>${syncPreview.changedFrames}</b></span><span>Sebagian <b>${syncPreview.partialFrames}</b></span><span>Sesuai <b>${syncPreview.unchangedFrames}</b></span><span>Dilewati <b>${syncPreview.skippedFrames}</b></span></div>${[...frameIds].map(id=>{const changes=syncPreview!.changes.filter(c=>c.frameId===id);return `<article class="change"><b>${esc(changes[0].sheetName)} · ${esc(product(changes[0].sourceId,changes[0].sheetName))} · ${esc(changes[0].frameName)}</b>${changes.map(c=>`<div>${esc(fieldLabel(c.field))}: ${esc(c.before)} → <b>${esc(c.after)}</b></div>`).join('')}</article>`;}).join('')}<h3>${syncPreview.issues.length ? 'Yang perlu dicek' : 'Siap diterapkan'}</h3>${issuesHtml(syncPreview.issues)}${button('confirm-sync',`Terapkan ${frameIds.size} artboard`,!frameIds.size)}${button('cancel-sync','Batal',false,true)}</section>`:''}`;
  bindColumns();
  const check=app.querySelector<HTMLInputElement>('#strip-percent');if(check)check.onchange=()=>{stripPercent=check.checked;syncPreview=null;save();render();};
  on('preview-sync',()=>{if(workbook)send({type:'preview-sync',sheets:workbook.sheets.map(sheet=>({name:sheet.name,rows:sheet.rows})),sheetChoice:'',columns,stripPercent});});
  on('confirm-sync',()=>{if(syncPreview){busy=true;send({type:'commit-sync',token:syncPreview.token});syncPreview=null;render();}});
  on('cancel-sync',()=>{syncPreview=null;render();});
}
window.onmessage=(event:MessageEvent)=>{
  const data=event.data.pluginMessage;if(!data || typeof data!=='object')return;
  switch(data.type){
    case 'init':if(data.settings){columns=data.settings.columns??columns;stripPercent=data.settings.stripPercent??true;for(const old of ['custom:disc','custom:discount']){if(columns.fields[old]&&!columns.fields.discount)columns.fields.discount=columns.fields[old];delete columns.fields[old];}}break;
    case 'selection':selected=data.selection;refreshImportedSheet();syncPreview=null;generationPreview=null;idPreview=null;propagation=null;break;
    case 'sync-preview':syncPreview=data.preview;report='';break;
    case 'generation-preview':generationPreview=data.preview;report='';break;
    case 'id-preview':idPreview=data.plan;report='';break;
    case 'propagation-preview':propagation=data.plan;report='';break;
    case 'sync-result':busy=false;report=`Sync selesai: ${data.result.updatedFrames} artboard berubah, ${data.result.partialFrames} masih perlu dicek sebagian, ${data.result.unchangedFrames} sudah sesuai, ${data.result.skippedFrames} dilewati.`;reportIssues=data.result.issues;break;
    case 'generation-result':busy=false;report=`${data.created} artboard berhasil dibuat dan diisi dari Excel.`;reportIssues=data.issues;break;
    case 'id-result':report=`${data.assigned} artboard terhubung.`;reportIssues=data.issues;break;
    case 'brand-result':report=data.sheetName?`Brand ${data.sheetName} ditandai ke ${data.count} artboard.`:`Penanda brand dihapus dari ${data.count} artboard.`;reportIssues=[];break;
    case 'product-result':report=`Produk ${data.sourceId} dari sheet ${data.sheetName} disimpan ke artboard.`;reportIssues=[];break;
    case 'propagation-result':report=`Tag diterapkan ke ${data.applied} layer.`;reportIssues=data.issues;break;
    case 'error':busy=false;report=data.message;reportIssues=[];break;
  }render();
};render();
