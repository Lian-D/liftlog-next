import type { NextRequest } from "next/server";
import { AuthError, checkLogin, clearFailures, lockedFor, noteFailure } from "@/lib/server/auth";
import { assertSameSite, clientIp, handle, readJson, signedIn } from "@/lib/server/http";
import { obj } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/login { username, password } */
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertSameSite(req);
    const b = obj(await readJson(req));
    const name = typeof b.username === "string" ? b.username.trim() : "";
    const pass = typeof b.password === "string" ? b.password : "";
    if (!name || !pass) throw new AuthError("Enter your username and password.");

    // Limit guessing per address and per account
    const keys = [`ip:${clientIp(req)}`, `user:${name.toLowerCase()}`];
    const wait = Math.max(...keys.map(lockedFor));
    if (wait) throw new AuthError(`Too many attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`, 429);

    const me = await checkLogin(name, pass);
    if (!me) {
      keys.forEach(noteFailure);
      throw new AuthError("Wrong username or password.", 401);
    }
    keys.forEach(clearFailures);
    return signedIn(req, me);
  });
}
