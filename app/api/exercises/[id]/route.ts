import type { NextRequest } from "next/server";
import { deleteCustomExercise } from "@/lib/server/repo";
import { json, notFound, withUser } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/exercises/:id — your own exercises only; logged sets stay in history. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withUser(req, async (me) => {
    const { id } = await params;
    return deleteCustomExercise(me.id, id) ? json({ ok: true }) : notFound("Custom exercise not found");
  });
}
