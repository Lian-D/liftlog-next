import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { sendPush } from "@/lib/server/push";
import { json, readJson, withUser } from "@/lib/server/http";
import { BadRequest, obj } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/push/test { endpoint } — send a test alert to one of your browsers right now. */
export async function POST(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    const sub = db().prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ? AND user_id = ?").get(b.endpoint, me.id) as
      | { endpoint: string; p256dh: string; auth: string }
      | undefined;
    if (!sub) throw new BadRequest("Lock-screen alerts aren't on for this browser.");
    const r = await sendPush(sub, { title: "Liftlog alerts are on", body: "This is how the end of a rest will look.", tag: "liftlog-test" });
    return r.ok ? json({ ok: true }) : json({ error: `The push service refused it (${r.detail}).` }, 502);
  });
}
