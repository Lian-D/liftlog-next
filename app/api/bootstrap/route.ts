import type { NextRequest } from "next/server";
import { bootstrap } from "@/lib/server/repo";
import { json, withUser } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/bootstrap → everything the signed-in user's app needs on load. */
export async function GET(req: NextRequest) {
  return withUser(req, (me) => json(bootstrap(me)));
}
