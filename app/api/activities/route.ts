import type { NextRequest } from "next/server";
import { listActivities, saveActivity } from "@/lib/server/repo";
import { json, readJson, withUser } from "@/lib/server/http";
import { activity } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withUser(req, (me) => json(listActivities(me.id)));
}

/** POST /api/activities { sport, startedAt, durationSec, distanceKm?, data, notes } — log a run, hike, game or round. */
export async function POST(req: NextRequest) {
  return withUser(req, async (me) => json(saveActivity(me.id, null, activity(await readJson(req))), 201));
}
