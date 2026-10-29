import {
  createInternalContact,
  listInternalContacts,
} from "@/server/contacts/service";
import { vendorErrorResponse } from "@/lib/server/vendor-http";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store", Vary: "Cookie, Origin" };
export async function GET(request: Request) {
  try {
    return Response.json(await listInternalContacts(request), { headers });
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    return Response.json(await createInternalContact(request), { headers });
  } catch (error) {
    return vendorErrorResponse(error);
  }
}
