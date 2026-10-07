import type { Field, FrameSummary } from '../shared';

export type TargetFrame = FrameNode | ComponentNode | InstanceNode;
export const isFrame = (node: SceneNode): node is TargetFrame => ['FRAME', 'COMPONENT', 'INSTANCE'].includes(node.type);
export const sourceId = (frame: TargetFrame): string => frame.getPluginData('channex_source_id');
export const sourceSheet = (frame: TargetFrame): string => frame.getPluginData('channex_source_sheet');
export const brandSheet = (frame: TargetFrame): string => frame.getPluginData('channex_brand_sheet');
export const fieldKey = (node: SceneNode): string => { const key = node.getPluginData('channex_field'); return ['custom:disc', 'custom:discount'].includes(key) ? 'discount' : key; };
export const descendants = (frame: TargetFrame): SceneNode[] => frame.findAll();
export function mappedNodes(frame: TargetFrame): Map<string, SceneNode[]> {
  const result = new Map<string, SceneNode[]>();
  for (const node of descendants(frame)) {
    const key = fieldKey(node);
    if (key) result.set(key, [...(result.get(key) ?? []), node]);
  }
  return result;
}
export function summary(frame: TargetFrame): FrameSummary {
  return { id: frame.id, name: frame.name, sourceId: sourceId(frame), sourceSheet: sourceSheet(frame), brandSheet: brandSheet(frame), fields: [...mappedNodes(frame).keys()] };
}
export function validField(value: string): value is Field {
  return ['product_name', 'usp', 'old_price', 'current_price', 'discount'].includes(value) || /^custom:[a-z][a-z0-9_]*$/.test(value);
}
