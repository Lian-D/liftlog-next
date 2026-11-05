import type { NextRequest } from "next/server";
import { deleteActivity, getActivity, saveActivity } from "@/lib/server/repo";
import { json, notFound, readJson, withUser } from "@/lib/server/http";
import { activity } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const a = getActivity(me.id, (await params).id);
    return a ? json(a) : notFound("Activity not found");
  });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const a = saveActivity(me.id, (await params).id, activity(await readJson(req)));
    return a ? json(a) : notFound("Activity not found");
  });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => (deleteActivity(me.id, (await params).id) ? json({ ok: true }) : notFound("Activity not found")));
}
