import { NextResponse, type NextRequest } from "next/server";
import { exportAll } from "@/lib/server/repo";
import { withUser } from "@/lib/server/http";
import { pacificDate } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/export → a JSON file with the signed-in user's routines and workouts. */
export async function GET(req: NextRequest) {
  return withUser(
    req,
    (me) =>
      new NextResponse(JSON.stringify(exportAll(me), null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="liftlog-${me.username}-${pacificDate()}.json"`,
          "Cache-Control": "no-store",
        },
      })
  );
}
