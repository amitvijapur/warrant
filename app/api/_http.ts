// Tiny uniform response helpers shared by every route handler. Kept in a
// leading-underscore file so Next's App Router treats it as private (not a
// route). Routes return `ok(data)` on success and `fail(message, status)` on
// invalid input (400) or a thrown error (500).

/** JSON success response. */
export function ok(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** JSON error response of the shape `{ error }`. */
export function fail(message: string, status = 500): Response {
  return Response.json({ error: message }, { status });
}

/** Normalize an unknown thrown value to a message string. */
export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
