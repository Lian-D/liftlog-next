import type { NextRequest } from "next/server";
import { deleteSession, exerciseExists, getSession, saveSession } from "@/lib/server/repo";
import { json, notFound, readJson, withUser } from "@/lib/server/http";
import { BadRequest, int, obj, pastTime, restSec, sessionExercises, str } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const s = getSession(me.id, (await params).id);
    return s ? json(s) : notFound("Workout not found");
  });
}

/** PUT /api/sessions/:id { name?, notes?, restSec?, pastMin?, startedAt?, exercises? } — autosave while training. Start and length only change on a workout logged afterwards. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const { id } = await params;
    const b = obj(await readJson(req));
    const patch: Parameters<typeof saveSession>[2] = {};
    if (b.name !== undefined) patch.name = str(b.name, "Name", 60) || "Workout";
    if (b.notes !== undefined) patch.notes = str(b.notes, "Notes", 2000);
    if (b.restSec !== undefined) patch.restSec = restSec(b.restSec);
    if (b.pastMin != null) patch.pastMin = int(b.pastMin, "Length", 1, 600);
    if (b.startedAt != null) patch.startedAt = pastTime(b.startedAt, "Start time");
    if (b.exercises !== undefined) {
      patch.exercises = sessionExercises(b.exercises);
      for (const e of patch.exercises) if (!exerciseExists(me.id, e.exerciseId)) throw new BadRequest(`Unknown exercise: ${e.exerciseId}`);
    }
    const s = saveSession(me.id, id, patch);
    return s ? json(s) : notFound("Workout not found");
  });
}

/** DELETE /api/sessions/:id — discard a workout in progress or remove one from history. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const { id } = await params;
    return deleteSession(me.id, id) ? json({ ok: true }) : notFound("Workout not found");
  });
}
