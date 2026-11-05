import type { NextRequest } from "next/server";
import { deleteRoutine, exerciseExists, updateRoutine } from "@/lib/server/repo";
import { json, notFound, readJson, withUser } from "@/lib/server/http";
import { BadRequest, obj, restSec, routineItems, str } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/routines/:id { name?, items?, restSec? } — restSec null goes back to the account default */
export async function PUT(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const { id } = await params;
    const b = obj(await readJson(req));
    const patch: Parameters<typeof updateRoutine>[2] = {};
    if (b.name !== undefined) patch.name = str(b.name, "Name", 60) || "Untitled routine";
    if (b.restSec !== undefined) patch.restSec = restSec(b.restSec);
    if (b.items !== undefined) {
      patch.items = routineItems(b.items);
      for (const it of patch.items) if (!exerciseExists(me.id, it.exerciseId)) throw new BadRequest(`Unknown exercise: ${it.exerciseId}`);
    }
    const r = updateRoutine(me.id, id, patch);
    return r ? json(r) : notFound("Routine not found");
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const { id } = await params;
    return deleteRoutine(me.id, id) ? json({ ok: true }) : notFound("Routine not found");
  });
}
