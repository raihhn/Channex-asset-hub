import type { Asset } from "../src/types/prototype";
import type { AssetUnit } from "../src/lib/domain/asset-units";
export type SourceWarehouse = {
  vendor: string;
  warehouse: string;
  vendor_id: string;
  warehouse_id: string;
  address: string;
  active: boolean;
  address_verified: boolean;
  legal_name?: string;
};
export type AssetSourceRow = {
  sheet: string;
  row: number;
  values: Record<string, string>;
  photos: Array<{
    key: string;
    mimeType: string;
    size?: number;
    sourceCell?: string;
  }>;
};
export function parseQuantity(
  value: unknown,
  unit: unknown,
): { quantity: number | null; unit: AssetUnit | null; conflict: boolean };
export function buildWarehouseAliases(
  warehouses: SourceWarehouse[],
  sourceVendors: Array<{
    vendor: string;
    warehouse: string;
    address: string;
    legalName?: string;
  }>,
): Map<string, SourceWarehouse[]>;
export function mapSourceRow(
  source: AssetSourceRow,
  aliases: Map<string, SourceWarehouse[]>,
): { record: Asset; warehouse: SourceWarehouse | null; sourceKey: string };
