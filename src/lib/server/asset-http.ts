import { vendorErrorResponse } from "./vendor-http";
import { VendorError } from "@/lib/domain/vendor-master";
import { ActorResolutionError } from "@/server/auth/actor-context";
import { MediaError } from "@/server/assets/local-media-storage";
export function assetErrorResponse(error: unknown) {
  if (error instanceof MediaError)
    return Response.json(
      { code: "VALIDATION", message: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if (
    error instanceof VendorError ||
    error instanceof ActorResolutionError ||
    error instanceof SyntaxError
  )
    return vendorErrorResponse(error);
  console.error(
    "Asset command failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    {
      code: "UNEXPECTED",
      message:
        "Asset operation failed. Retry the same submission if its outcome is uncertain.",
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
