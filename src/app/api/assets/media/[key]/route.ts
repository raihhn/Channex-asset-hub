import { ActorResolutionError } from "@/server/auth/actor-context";
import { actorErrorResponse } from "@/server/auth/resolve-actor";
import { readAssetMedia } from "@/lib/server/assets";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    return await readAssetMedia(request, (await params).key);
  } catch (error) {
    if (error instanceof ActorResolutionError) return actorErrorResponse(error);
    return new Response("Media unavailable", { status: 503 });
  }
}
