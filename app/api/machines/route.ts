import type { NextRequest } from "next/server";
import { saveMachine } from "@/lib/server/repo";
import { json, readJson, withUser } from "@/lib/server/http";
import { machine } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/machines { name, realKg, sticker } — a machine whose stack reading `sticker` really weighs realKg. */
export async function POST(req: NextRequest) {
  return withUser(req, async (me) => json(saveMachine(me.id, null, machine(await readJson(req))), 201));
}
