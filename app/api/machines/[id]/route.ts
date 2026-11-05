import type { NextRequest } from "next/server";
import { deleteMachine, saveMachine } from "@/lib/server/repo";
import { json, notFound, readJson, withUser } from "@/lib/server/http";
import { machine } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** PUT /api/machines/:id { name, realKg, sticker } — recalibrate or rename. Sets already logged keep their weights. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const m = saveMachine(me.id, (await params).id, machine(await readJson(req)));
    return m ? json(m) : notFound("Machine not found");
  });
}

/** DELETE /api/machines/:id — exercises using it go back to real weights. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => (deleteMachine(me.id, (await params).id) ? json({ ok: true }) : notFound("Machine not found")));
}
