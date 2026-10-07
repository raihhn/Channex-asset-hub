type Segment = { start: number; end: number; fontName: FontName };

export async function replaceStyledText(node: TextNode, next: string): Promise<void> {
  if (node.characters === next) return;
  if (node.hasMissingFont) throw new Error('Font pada teks ini belum tersedia. Pasang font yang digunakan atau ganti font di Figma, lalu coba lagi.');
  const before = node.characters;
  const segments = before.length ? node.getStyledTextSegments(['fontName', 'fontSize', 'fills', 'textDecoration', 'letterSpacing', 'lineHeight', 'textStyleId', 'fillStyleId']) as Segment[] : [];
  const fonts = before.length ? node.getRangeAllFontNames(0, before.length) : node.fontName === figma.mixed ? [] : [node.fontName];
  if (!fonts.length) throw new Error('Font teks tidak dapat diedit. Periksa font di Figma.');
  try { await Promise.all(fonts.map((font) => figma.loadFontAsync(font))); } catch { throw new Error('Font gagal dimuat. Pastikan font tersedia di Figma lalu coba lagi.'); }

  const oldPoints = Array.from(before);
  const newPoints = Array.from(next);
  let prefixCount = 0;
  while (prefixCount < oldPoints.length && prefixCount < newPoints.length && oldPoints[prefixCount] === newPoints[prefixCount]) prefixCount++;
  let suffixCount = 0;
  while (suffixCount < oldPoints.length - prefixCount && suffixCount < newPoints.length - prefixCount && oldPoints[oldPoints.length - 1 - suffixCount] === newPoints[newPoints.length - 1 - suffixCount]) suffixCount++;
  const prefix = oldPoints.slice(0, prefixCount).join('').length;
  const suffix = oldPoints.slice(oldPoints.length - suffixCount).join('').length;
  const end = before.length - suffix;
  const replacement = next.slice(prefix, next.length - suffix);
  const affected = segments.filter((part) => part.end > prefix && part.start < end);
  if (affected.length > 1) throw new Error('Teks ini memiliki beberapa gaya berbeda pada bagian yang diganti. Pisahkan menjadi layer teks atau edit secara manual.');
  if (prefix === end && segments.length > 1 && prefix > 0 && prefix < before.length) {
    const left = segments.find((part) => part.start < prefix && part.end === prefix);
    const right = segments.find((part) => part.start === prefix && part.end > prefix);
    if (left && right && left !== right) throw new Error('Teks baru berada di batas dua gaya teks. Pisahkan layer atau edit secara manual.');
  }
  // Insert/delete keeps styles on every unchanged character. The new span inherits the adjacent style.
  if (!before.length) { node.characters = next; return; }
  if (replacement) node.insertCharacters(prefix, replacement, prefix === before.length ? 'BEFORE' : 'AFTER');
  if (end > prefix) node.deleteCharacters(prefix + replacement.length, end + replacement.length);
}
