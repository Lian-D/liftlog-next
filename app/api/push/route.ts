import type { NextRequest } from "next/server";
import { pushHostAllowed, rememberSiteAddress, removeSubscription, saveSubscription, vapidKeys } from "@/lib/server/push";
import { isSecure, json, readJson, withUser } from "@/lib/server/http";
import { BadRequest, obj } from "@/lib/server/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const B64URL = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

const endpointOf = (v: unknown) => {
  if (typeof v !== "string" || v.length > 1000 || !pushHostAllowed(v)) throw new BadRequest("That push endpoint isn't from a known push service.");
  return v;
};

/** GET /api/push — the key a browser needs to subscribe. */
export async function GET(req: NextRequest) {
  return withUser(req, () => json({ publicKey: vapidKeys().publicKey }));
}

/** POST /api/push { endpoint, keys: { p256dh, auth } } — turn on lock-screen alerts for this browser. */
export async function POST(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req));
    const keys = obj(b.keys, "keys");
    const endpoint = endpointOf(b.endpoint);
    if (typeof keys.p256dh !== "string" || !B64URL.test(keys.p256dh) || typeof keys.auth !== "string" || !B64URL.test(keys.auth))
      throw new BadRequest("The subscription keys look wrong.");
    if (isSecure(req)) rememberSiteAddress(`https://${req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""}`);
    saveSubscription(me.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth }, req.headers.get("user-agent") ?? "");
    return json({ ok: true }, 201);
  });
}

/** DELETE /api/push { endpoint } — turn them off again. */
export async function DELETE(req: NextRequest) {
  return withUser(req, async (me) => {
    const b = obj(await readJson(req).catch(() => ({})));
    if (typeof b.endpoint === "string") removeSubscription(me.id, b.endpoint);
    return json({ ok: true });
  });
}
