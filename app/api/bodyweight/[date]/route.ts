import type { NextRequest } from "next/server";
import { saveBodyWeight } from "@/lib/server/repo";
import { json, readJson, withUser } from "@/lib/server/http";
import { BadRequest, date, num, obj, str } from "@/lib/server/validate";
import { addDays, pacificDate } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ date: string }> };

/** PUT /api/bodyweight/:date { kg, note } — one day's bodyweight and note. Both empty removes the day. Returns every day. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  return withUser(req, async (me) => {
    const day = date((await params).date);
    if (day > addDays(pacificDate(), 1)) throw new BadRequest("That day hasn't happened yet");
    const b = obj(await readJson(req));
    const kg = b.kg == null ? null : num(b.kg, "Bodyweight", 20, 400, 3);
    const note = b.note == null ? "" : str(b.note, "Note", 300);
    return json(saveBodyWeight(me.id, day, kg, note));
  });
}
