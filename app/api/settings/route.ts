import type { NextRequest } from "next/server";
import { saveSettings } from "@/lib/server/repo";
import { json, readJson, withUser } from "@/lib/server/http";
import { BadRequest, distanceUnit, int, obj, unit } from "@/lib/server/validate";
import type { Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/settings { unit?, distanceUnit?, restSec?, restAuto?, timerSound?, keepAwake? } — your own preferences */
export async function PUT(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    const patch: Partial<Settings> = {};
    if (b.unit !== undefined) patch.unit = unit(b.unit);
    if (b.distanceUnit !== undefined) patch.distanceUnit = distanceUnit(b.distanceUnit);
    if (b.restSec !== undefined) patch.restSec = int(b.restSec, "Rest time", 5, 3600);
    for (const k of ["restAuto", "timerSound", "keepAwake"] as const) {
      if (b[k] === undefined) continue;
      if (typeof b[k] !== "boolean") throw new BadRequest(`${k} must be true or false`);
      patch[k] = b[k] as boolean;
    }
    return json(saveSettings(me.id, patch));
  });
}
