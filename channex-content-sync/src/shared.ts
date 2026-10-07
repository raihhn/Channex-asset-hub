export const FIELDS = ['product_name', 'usp', 'old_price', 'current_price', 'discount'] as const;
export type Field = typeof FIELDS[number] | `custom:${string}`;
export type Row = Record<string, string>;
export type Columns = { id: string; fields: Record<string, string> };
export type Issue = { kind: 'warning' | 'error'; message: string; id?: string; sheetName?: string; frameId?: string; field?: string; action?: 'ids' | 'template' | 'sync' };
export type Change = { frameId: string; frameName: string; sheetName: string; sourceId: string; field: string; nodeId: string; before: string; after: string };
export type Preview = {
  token: string;
  rows: number;
  frames: number;
  matched: number;
  changedFrames: number;
  partialFrames: number;
  unchangedFrames: number;
  skippedFrames: number;
  missingInFigma: number;
  missingInSpreadsheet: number;
  invalid: number;
  changes: Change[];
  issues: Issue[];
};
export type FrameSummary = { id: string; name: string; sourceId: string; sourceSheet: string; brandSheet: string; fields: string[] };
export type Selection = { frames: FrameSummary[]; text: { id: string; name: string; field: string } | null; template: FrameSummary | null };
export type GenerationRow = { sheetName: string; sourceId: string; productName: string; values: Record<string, string> };
export type GenerationPreview = { token: string; templateId: string; templateName: string; sheets: string[]; limitPerSheet: number; assignments: GenerationRow[]; issues: Issue[] };
export type UiMessage =
  | { type: 'inspect' }
  | { type: 'focus-frame'; frameId: string; template: boolean }
  | { type: 'set-template' }
  | { type: 'set-id'; id: string }
  | { type: 'set-brand'; frameIds: string[]; sheetName: string }
  | { type: 'set-product'; frameId: string; sheetName: string; sourceId: string }
  | { type: 'set-field'; field: string }
  | { type: 'preview-ids'; assignments: { frameId: string; sheetName: string; id: string }[] }
  | { type: 'commit-ids'; token: string }
  | { type: 'preview-propagation' }
  | { type: 'commit-propagation'; token: string }
  | { type: 'preview-sync'; sheets: { name: string; rows: Row[] }[]; sheetChoice: string; columns: Columns; stripPercent: boolean }
  | { type: 'commit-sync'; token: string }
  | { type: 'preview-generate'; sheets: { name: string; rows: Row[] }[]; selectedSheets: string[]; limitPerSheet: number; columns: Columns; stripPercent: boolean }
  | { type: 'commit-generate'; token: string }
  | { type: 'save-settings'; columns: Columns; stripPercent: boolean };

export const fieldLabel = (field: string): string => ({ product_name: 'Products Name', usp: 'USP', old_price: 'Old Price', current_price: 'Current Price', discount: 'Discount' }[field] ?? (field.startsWith('custom:') ? `Custom: ${field.slice(7).replace(/_/g, ' ')}` : field.replace(/_/g, ' ')));

export function matchSheetName(frameName: string, sheetNames: string[]): string | null {
  const normalized = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const frame = normalized(frameName);
  const matches = sheetNames.filter(name => frame.includes(normalized(name))).sort((a, b) => normalized(b).length - normalized(a).length);
  if (!matches.length || (matches.length > 1 && normalized(matches[0]) === normalized(matches[1]))) return null;
  return matches[0];
}
