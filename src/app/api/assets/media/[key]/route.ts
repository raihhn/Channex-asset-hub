import { readAssetMedia } from "@/lib/server/assets";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    return await readAssetMedia(request, (await params).key);
  } catch {
    return new Response("Media unavailable", { status: 503 });
  }
}
