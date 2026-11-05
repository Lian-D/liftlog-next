import type { NextRequest } from "next/server";
import { ownsSubscription, setAlarm } from "@/lib/server/push";
import { json, readJson, withUser } from "@/lib/server/http";
import { BadRequest, obj, str } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/timer { endpoint, endAt, title?, label?, hidden, seq }
 * The page keeps this in step with its timer: endAt while it runs, null when it's
 * paused, reset or finished, and hidden when the app goes off screen. The alert is
 * only pushed if the app is off screen when the time comes. Browsers without
 * lock-screen alerts are ignored.
 */
export async function PUT(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    if (typeof b.endpoint !== "string" || !ownsSubscription(me.id, b.endpoint)) return json({ ok: false, reason: "not-subscribed" });
    if (typeof b.seq !== "number" || !Number.isFinite(b.seq) || b.seq < 0) throw new BadRequest("seq must be a number");
    let endAt: number | null = null;
    if (b.endAt != null) {
      if (typeof b.endAt !== "number" || !Number.isFinite(b.endAt)) throw new BadRequest("endAt must be a time in milliseconds");
      // Up to a day ahead; a time already past just clears the alarm.
      endAt = b.endAt > Date.now() && b.endAt < Date.now() + 86_400_000 ? Math.round(b.endAt) : null;
    }
    const text = (v: unknown, what: string) => (v == null ? "" : str(v, what, 120));
    setAlarm(b.endpoint, { endAt, title: text(b.title, "Title"), label: text(b.label, "Label"), hidden: b.hidden === true, seq: Math.floor(b.seq) });
    return json({ ok: true });
  });
}
