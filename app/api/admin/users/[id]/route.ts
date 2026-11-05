import type { NextRequest } from "next/server";
import { AuthError, deleteUser, findUser, listUsers, setAdmin, setPassword } from "@/lib/server/auth";
import { json, notFound, readJson, withAdmin } from "@/lib/server/http";
import { obj, password } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/users/:id { isAdmin?, password? }
 * A new password signs that person out everywhere.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async (me) => {
    const { id } = await params;
    if (!findUser(id)) return notFound("Account not found.");
    const b = obj(await readJson(req));
    if (b.isAdmin !== undefined) {
      if (id === me.id) throw new AuthError("You can't change your own admin role. Ask another admin.", 409);
      setAdmin(id, b.isAdmin === true);
    }
    if (b.password !== undefined) await setPassword(id, password(b.password, "New password"));
    return json(listUsers());
  });
}

/** DELETE /api/admin/users/:id → removes the account with its routines and workouts. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return withAdmin(req, async (me) => {
    const { id } = await params;
    if (id === me.id) throw new AuthError("You can't delete your own account here.", 409);
    deleteUser(id);
    return json(listUsers());
  });
}
