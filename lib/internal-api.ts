import type { NextRequest } from "next/server";

export function verifyInternalApiKey(req: NextRequest | Request): boolean {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return false;
  return req.headers.get("x-internal-key") === expected;
}
