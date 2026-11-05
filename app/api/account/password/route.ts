import type { NextRequest } from "next/server";
import { AuthError, SESSION_COOKIE, findUser, setPassword, verifyPassword } from "@/lib/server/auth";
import { json, readJson, withUser } from "@/lib/server/http";
import { obj, password } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/account/password { current, next } → changes your password and signs out your other devices. */
export async function PUT(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    const current = typeof b.current === "string" ? b.current : "";
    const next = password(b.next, "New password");
    const u = findUser(me.id);
    if (!u || !(await verifyPassword(current, u.password_hash))) throw new AuthError("Your current password isn't right.", 403);
    await setPassword(me.id, next, req.cookies.get(SESSION_COOKIE)?.value);
    return json({ ok: true });
  });
}
