import { db } from "@/lib/server/db";
import { handle, json } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/health → 200 when the database answers. Used by the Docker healthcheck. */
export async function GET() {
  return handle(() => {
    db().prepare("SELECT 1").get();
    return json({ ok: true });
  });
}
