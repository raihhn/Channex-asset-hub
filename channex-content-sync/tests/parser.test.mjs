import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { build } from 'esbuild';
import ExcelJS from 'exceljs';

const output = await build({ entryPoints: ['src/spreadsheet/parser.ts'], bundle: true, platform: 'browser', format: 'esm', write: false });
await writeFile('dist/parser-test.mjs', output.outputFiles[0].text);

const { parseSpreadsheet } = await import(new URL('../dist/parser-test.mjs', import.meta.url));

test('CSV import detects headers and preserves text IDs with leading zeros', async () => {
  const file = new File(['SKU,Product Name,Old Price\n001,Product A,8500\n'], 'content.csv', { type: 'text/csv' });
  const result = await parseSpreadsheet(file);
  assert.deepEqual(result.sheets[0].headers, ['SKU', 'Product Name', 'Old Price']);
  assert.equal(result.sheets[0].rows[0].SKU, '001');
  assert.equal(result.sheets[0].rows[0]['Old Price'], '8500');
});
test('XLSX import reads worksheets locally', async () => {
  const bytes = await readFile('tests/fixtures/sample.xlsx');
  const file = new File([bytes], 'sample.xlsx');
  const result = await parseSpreadsheet(file);
  assert.deepEqual(result.sheets[0].headers, ['SKU', 'Product Name', 'Old Price']);
  assert.equal(result.sheets[0].rows[0].SKU, '001');
  assert.equal(result.sheets[0].rows[0]['Old Price'], '8500');
});
test('invalid file is rejected', async () => {
  await assert.rejects(parseSpreadsheet(new File(['broken'], 'broken.xlsx')));
});


test('XLSX header is not data and percentages, decimals, zero padding and currency retain display formats', async () => {
  const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Products');
  sheet.addRow(['No','Products','PRICE BEFORE','PRICE AFTER','DISC PDP','Currency','Code']);
  sheet.addRow([1,'2pcs Best Seller Face Wash',51.8,37.05,0.3,37.05,1]);
  sheet.getCell('C2').numFmt='0.0';sheet.getCell('D2').numFmt='0.00';sheet.getCell('E2').numFmt='0%';
  sheet.getCell('F2').numFmt='"RM"0.00';sheet.getCell('G2').numFmt='000';
  const result=await parseSpreadsheet(new File([await book.xlsx.writeBuffer()],'display.xlsx'));
  assert.equal(result.sheets[0].rows.length,1);assert.equal(result.sheets[0].rows[0].No,'1');
  assert.equal(result.sheets[0].rows[0]['PRICE BEFORE'],'51,8');assert.equal(result.sheets[0].rows[0]['PRICE AFTER'],'37,05');
  assert.equal(result.sheets[0].rows[0]['DISC PDP'],'30%');assert.equal(result.sheets[0].rows[0].Currency,'RM37,05');assert.equal(result.sheets[0].rows[0].Code,'001');
});

test('XLSX import keeps multiple sheet names when product IDs overlap', async () => {
  const book = new ExcelJS.Workbook();
  for (const [name, product] of [['Kahf', 'Facial Wash'], ['Wardah', 'Brightening Cream']]) {
    const sheet = book.addWorksheet(name);
    sheet.addRow(['No', 'Products', 'Price']);
    sheet.addRow([1, product, 50000]);
  }
  const result = await parseSpreadsheet(new File([await book.xlsx.writeBuffer()], 'brands.xlsx'));
  assert.deepEqual(result.sheets.map(sheet => sheet.name), ['Kahf', 'Wardah']);
  assert.equal(result.sheets[0].rows[0].No, result.sheets[1].rows[0].No);
  assert.equal(result.sheets[0].rows[0].Products, 'Facial Wash');
  assert.equal(result.sheets[1].rows[0].Products, 'Brightening Cream');
});
