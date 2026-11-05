import type { NextRequest } from "next/server";
import { getRoutine, getSession, repeatSession, startSession } from "@/lib/server/repo";
import { json, notFound, readJson, withUser } from "@/lib/server/http";
import { int, obj, pastTime, str } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sessions { routineId?, fromSessionId?, name?, at?, pastMin? } → starts a
 * workout, from a routine, as a repeat of a past workout, or empty. With `at` (a past
 * start time) and `pastMin` (its length) it's a workout logged afterwards. If one is
 * already in progress, that one is returned instead.
 */
export async function POST(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    const when = b.at != null ? { at: pastTime(b.at, "Start time"), min: int(b.pastMin ?? 60, "Length", 1, 600) } : undefined;
    if (b.fromSessionId != null) {
      const past = getSession(me.id, str(b.fromSessionId, "fromSessionId", 64));
      if (!past) return notFound("Workout not found");
      return json(repeatSession(me.id, past, when), 201);
    }
    let routine = null;
    if (b.routineId != null) {
      routine = getRoutine(me.id, str(b.routineId, "routineId", 64));
      if (!routine) return notFound("Routine not found");
    }
    const name = b.name != null ? str(b.name, "Name", 60) : undefined;
    return json(startSession(me.id, routine, name || undefined, when), 201);
  });
}
