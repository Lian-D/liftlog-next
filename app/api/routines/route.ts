import type { NextRequest } from "next/server";
import { createRoutine, exerciseExists, listRoutines } from "@/lib/server/repo";
import { json, readJson, withUser } from "@/lib/server/http";
import { BadRequest, obj, restSec, routineItems, str } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withUser(req, (me) => json(listRoutines(me.id)));
}

/** POST /api/routines { name, items: [{ exerciseId, sets, reps, restSec? }], restSec? } */
export async function POST(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    const name = str(b.name, "Name", 60) || "New routine";
    const items = routineItems(b.items ?? []);
    for (const it of items) if (!exerciseExists(me.id, it.exerciseId)) throw new BadRequest(`Unknown exercise: ${it.exerciseId}`);
    return json(createRoutine(me.id, name, items, restSec(b.restSec)), 201);
  });
}
