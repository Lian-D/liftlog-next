import type { NextRequest } from "next/server";
import { finishSession, getSession } from "@/lib/server/repo";
import { json, notFound, withUser } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/sessions/:id/finish → keeps checked sets only; discards the workout if none are checked. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withUser(req, async (me) => {
    const { id } = await params;
    if (!getSession(me.id, id)) return notFound("Workout not found");
    return json(finishSession(me.id, id));
  });
}
