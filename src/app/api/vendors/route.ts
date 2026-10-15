import { listVendors, saveVendor, vendorActor } from "@/lib/server/vendors";
import { vendorErrorResponse } from "@/lib/server/vendor-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(await listVendors(vendorActor(request)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = vendorActor(request);
    const saved = await saveVendor(await request.json(), actor);
    return Response.json(saved, { status: 201 });
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
