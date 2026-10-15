import { VendorError } from "@/lib/domain/vendor-master";
export function vendorErrorResponse(error: unknown) {
  if (error instanceof VendorError)
    return Response.json(
      { code: error.code, message: error.message },
      {
        status: {
          VALIDATION: 400,
          FORBIDDEN: 403,
          DISABLED: 503,
          NOT_FOUND: 404,
          STALE: 409,
          CONFLICT: 409,
        }[error.code],
      },
    );
  if (error instanceof SyntaxError)
    return Response.json(
      { code: "VALIDATION", message: "Invalid JSON payload." },
      { status: 400 },
    );
  console.error(
    "Vendor database command failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return Response.json(
    {
      code: "UNEXPECTED",
      message: "Could not access the vendor database. Try again.",
    },
    { status: 500 },
  );
}
