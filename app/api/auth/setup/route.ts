import type { NextRequest } from "next/server";
import { AuthError, createFirstAdmin, userCount } from "@/lib/server/auth";
import { assertSameSite, handle, readJson, signedIn } from "@/lib/server/http";
import { obj, password, username } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/setup { username, password } — only while no accounts exist. Creates the admin. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameSite(req);
    if (userCount() > 0) throw new AuthError("Liftlog is already set up. Sign in instead.", 409);
    const b = obj(await readJson(req));
    const me = await createFirstAdmin(username(b.username), password(b.password));
    return signedIn(req, me, 201);
  });
}
