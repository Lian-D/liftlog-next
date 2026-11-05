import type { NextRequest } from "next/server";
import { AuthError, createUser, signupOpen, userCount } from "@/lib/server/auth";
import { assertSameSite, handle, readJson, signedIn } from "@/lib/server/http";
import { obj, password, username } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/signup { username, password } — only when an admin has opened sign-ups. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameSite(req);
    if (userCount() === 0) throw new AuthError("Liftlog isn't set up yet. Create the admin account first.", 409);
    if (!signupOpen()) throw new AuthError("Sign-ups are closed. Ask the admin for an account.", 403);
    const b = obj(await readJson(req));
    const me = await createUser(username(b.username), password(b.password), false);
    return signedIn(req, me, 201);
  });
}
