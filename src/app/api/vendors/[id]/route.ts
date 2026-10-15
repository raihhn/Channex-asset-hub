import { saveVendor, vendorActor, vendorAudit } from "@/lib/server/vendors";
import { VendorError } from "@/lib/domain/vendor-master";
import { vendorErrorResponse } from "@/lib/server/vendor-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const actor = vendorActor(request);
    const { id } = await context.params;
    const body = await request.json();
    if (!body || typeof body !== "object")
      throw new VendorError("VALIDATION", "Invalid vendor data.");
    return Response.json(await saveVendor(body.draft, actor, id, body.version));
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
export async function GET(request: Request, context: Context) {
  try {
    return Response.json(
      await vendorAudit(vendorActor(request), (await context.params).id),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
