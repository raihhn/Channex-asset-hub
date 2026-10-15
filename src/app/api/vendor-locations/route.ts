import {
  operationalVendorActor,
  operationalVendorLocations,
} from "@/lib/server/vendors";
import { vendorErrorResponse } from "@/lib/server/vendor-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return Response.json(
      await operationalVendorLocations(operationalVendorActor(request)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
