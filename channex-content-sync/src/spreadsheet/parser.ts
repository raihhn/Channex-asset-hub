import ExcelJS from 'exceljs';
import { format } from 'numfmt';
import Papa from 'papaparse';
import type { Row } from '../shared';

export type ImportedSheet = { name: string; headers: string[]; rows: Row[]; issues: string[]; hasHeaders: boolean };
export type Imported = { fileName: string; sheets: ImportedSheet[] };

function parseGrid(name: string, grid: string[][]): ImportedSheet {
  while (grid[0]?.length && !grid[0][grid[0].length - 1]?.trim() && grid.every(row => !row[row.length - 1]?.trim())) grid.forEach(row => row.pop());
  if (!grid.length || !grid[0]?.length) throw new Error(`Sheet ${name} kosong.`);
  const firstCell = String(grid[0][0] ?? '').trim();
  const secondCell = String(grid[1]?.[0] ?? '').trim();
  const headerless = grid.length > 1 && /^\d+$/.test(firstCell) && /^\d+$/.test(secondCell);
  const defaultHeaders = ['No', 'Products', 'USP', 'PRICE BEFORE', 'PRICE AFTER', 'DISC PDP', 'PRICE AFTER', 'DISC PDP'];
  const rawHeaders = headerless
    ? Array.from({ length: grid[0].length }, (_, index) => defaultHeaders[index] ?? `Column ${index + 1}`)
    : grid[0].map(value => String(value ?? '').trim());
  if (rawHeaders.some(value => !value)) throw new Error(`Sheet ${name}: ada judul kolom kosong di baris pertama.`);
  const seen = new Map<string, number>();
  const headers = rawHeaders.map(header => {
    const key = header.toLocaleLowerCase();
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    return occurrence === 1 ? header : `${header} (${occurrence})`;
  });
  const issues: string[] = [];
  const sourceRows = headerless ? grid : grid.slice(1);
  const rows = sourceRows.filter(cells => cells.some(value => String(value ?? '').trim() !== '')).map((cells, index) => {
    const row: Row = {};
    headers.forEach((header, column) => { row[header] = String(cells[column] ?? '').trim(); });
    if (cells.length > headers.length) issues.push(`Baris ${index + 2} memiliki kolom tambahan tanpa judul.`);
    return row;
  });
  if (!rows.length) throw new Error(`Sheet ${name} hanya berisi judul kolom.`);
  const duplicateNames = [...seen].filter(([, count]) => count > 1).map(([header, count]) => `${header} (${count})`);
  if (duplicateNames.length) issues.unshift(`Kolom berulang diberi nomor otomatis: ${duplicateNames.join(', ')}.`);
  return { name, headers, rows, issues, hasHeaders: !headerless };
}

export async function parseSpreadsheet(file: File, locale = 'id'): Promise<Imported> {
  const lower = file.name.toLowerCase();
  const sheets: ImportedSheet[] = [];
  if (lower.endsWith('.xlsx')) {
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(await file.arrayBuffer()); }
    catch { throw new Error('File Excel tidak dapat dibaca. Simpan ulang sebagai .xlsx lalu upload lagi.'); }
    if (!workbook.worksheets.length) throw new Error('File Excel tidak memiliki lembar data.');
    for (const sheet of workbook.worksheets) {
      const grid: string[][] = [];
      for (let r = 1; r <= sheet.rowCount; r++) {
        const row: string[] = [];
        for (let c = 1; c <= sheet.columnCount; c++) {
          const cell = sheet.getCell(r, c);
          let value = cell.value;
          if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
            if (value.result === undefined) throw new Error(`Sel ${sheet.name}!${cell.address} berisi rumus tanpa hasil tersimpan. Buka dan simpan Excel lalu upload ulang.`);
            value = value.result;
          }
          if (typeof value === 'number' || value instanceof Date) {
            row.push(format(cell.numFmt || 'General', value, { locale }).trim());
          } else if (value && typeof value === 'object' && 'error' in value) {
            throw new Error(`Sel ${sheet.name}!${cell.address} berisi error Excel (${value.error}). Perbaiki lalu upload ulang.`);
          } else row.push(value && typeof value === 'object' ? cell.text : String(value ?? ''));
        }
        grid.push(row);
      }
      if (!grid.some(row => row.some(value => value.trim()))) continue;
      sheets.push(parseGrid(sheet.name, grid));
    }
  } else if (lower.endsWith('.csv')) {
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy', dynamicTyping: false });
    if (parsed.errors.length) throw new Error(`CSV tidak terbaca di baris ${(parsed.errors[0].row ?? 0) + 1}. Periksa pemisah kolom dan tanda kutip.`);
    const sheetName = file.name.replace(/\.csv$/i, '') || 'Sheet1';
    sheets.push(parseGrid(sheetName, parsed.data));
  } else throw new Error('Pilih file .xlsx atau .csv.');
  if (!sheets.length) throw new Error('File Excel tidak memiliki sheet berisi produk.');
  return { fileName: file.name, sheets };
}
