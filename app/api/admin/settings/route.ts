import type { NextRequest } from "next/server";
import { setSignupOpen, signupOpen } from "@/lib/server/auth";
import { json, readJson, withAdmin } from "@/lib/server/http";
import { BadRequest, obj } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/admin/settings { signupOpen } → whether people can create their own accounts. */
export async function PUT(req: NextRequest) {
  return withAdmin(req, async () => {
    const b = obj(await readJson(req));
    if (typeof b.signupOpen !== "boolean") throw new BadRequest("signupOpen must be true or false");
    setSignupOpen(b.signupOpen);
    return json({ signupOpen: signupOpen() });
  });
}
