import type { NextRequest } from "next/server";
import { createCustomExercise, listCustomExercises } from "@/lib/server/repo";
import { json, readJson, withUser } from "@/lib/server/http";
import { BadRequest, measure, muscles, obj, str } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withUser(req, (me) => json(listCustomExercises(me.id)));
}

/** POST /api/exercises { name, equipment, primary: Muscle[], secondary?: Muscle[], measure } */
export async function POST(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    const name = str(b.name, "Name", 60);
    if (!name) throw new BadRequest("Give the exercise a name");
    const primary = muscles(b.primary, "Main muscle", 1);
    const secondary = muscles(b.secondary ?? [], "Other muscles").filter((m) => !primary.includes(m));
    return json(
      createCustomExercise(me.id, {
        name,
        equipment: str(b.equipment ?? "", "Equipment", 40),
        primary,
        secondary,
        measure: measure(b.measure ?? "weight"),
      }),
      201
    );
  });
}
