import { NextRequest } from "next/server";

/**
 * Standard error handler for API routes.
 * Returns a JSON error response with status 500.
 * Logs the error to console.
 */
export function handleApiError(
  error: unknown,
  _req?: NextRequest
): Response {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Internal server error";

  console.error("API error:", error);

  return Response.json(
    { error: message },
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
