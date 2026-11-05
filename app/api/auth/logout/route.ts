import type { NextRequest } from "next/server";
import { SESSION_COOKIE, cookieOptions, endAuthSession } from "@/lib/server/auth";
import { assertSameSite, handle, isSecure, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/logout → ends this device's session. */
export async function POST(req: NextRequest) {
  return handle(() => {
    assertSameSite(req);
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    if (token) endAuthSession(token);
    const res = json({ ok: true });
    res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(isSecure(req)), maxAge: 0 });
    return res;
  });
}
