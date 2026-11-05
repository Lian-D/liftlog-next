import type { NextRequest } from "next/server";
import { createUser, listUsers } from "@/lib/server/auth";
import { json, readJson, withAdmin } from "@/lib/server/http";
import { obj, password, username } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/users → every account with its workout count and last sign-in. */
export async function GET(req: NextRequest) {
  return withAdmin(req, () => json(listUsers()));
}

/** POST /api/admin/users { username, password, isAdmin? } → an admin adds an account. */
export async function POST(req: NextRequest) {
  return withAdmin(req, async () => {
    const b = obj(await readJson(req));
    await createUser(username(b.username), password(b.password), b.isAdmin === true);
    return json(listUsers(), 201);
  });
}
