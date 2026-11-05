import type { NextRequest } from "next/server";
import { exerciseExists, getMachine, saveExercisePref } from "@/lib/server/repo";
import { json, notFound, readJson, withUser } from "@/lib/server/http";
import { BadRequest, exerciseId, obj, str } from "@/lib/server/validate";
import type { ExercisePref } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/exercise-prefs/:exerciseId { note?, machineId? } — your setup note for an exercise, and the machine whose stickers it uses (null for real weights). */
export async function PUT(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const id = exerciseId((await params).id);
    if (!exerciseExists(me.id, id)) return notFound("Exercise not found");
    const b = obj(await readJson(req));
    const patch: Partial<ExercisePref> = {};
    if (b.note !== undefined) patch.note = b.note == null ? "" : str(b.note, "Setup note", 500);
    if (b.machineId !== undefined) {
      if (b.machineId !== null && (typeof b.machineId !== "string" || !getMachine(me.id, b.machineId))) throw new BadRequest("Machine not found");
      patch.machineId = b.machineId as string | null;
    }
    return json(saveExercisePref(me.id, id, patch));
  });
}
