import { readAssetCatalog, readInternalWarehouses } from "@/lib/server/assets";
import { vendorErrorResponse } from "@/lib/server/vendor-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(
      {
        assets: await readAssetCatalog(request),
        internalWarehouses: await readInternalWarehouses(request),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
