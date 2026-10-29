import { editCatalogAsset } from "@/lib/server/assets";
import { vendorErrorResponse } from "@/lib/server/vendor-http";
export const runtime = "nodejs";
export async function PATCH(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    return Response.json(
      await editCatalogAsset(request, (await context.params).assetId),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
