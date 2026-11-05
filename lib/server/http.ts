import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { AuthError, SESSION_COOKIE, cookieOptions, startAuthSession, userForToken } from "./auth";
import { BadRequest } from "./validate";
import type { Me } from "@/lib/types";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const notFound = (what = "Not found") => json({ error: what }, 404);

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new BadRequest("Request body must be JSON");
  }
}

/** Behind the Cloudflare tunnel the request arrives as http with X-Forwarded-Proto: https. */
export const isSecure = (req: NextRequest) =>
  req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" || req.nextUrl.protocol === "https:";

export const clientIp = (req: NextRequest) =>
  req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Refuse writes started by another website. Browsers label every request with
 * Sec-Fetch-Site; together with SameSite=Lax cookies and JSON-only bodies this
 * stops cross-site request forgery without needing tokens.
 */
export function assertSameSite(req: NextRequest) {
  if (!WRITES.has(req.method)) return;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new AuthError("Requests from other sites aren't allowed.", 403);
  const type = req.headers.get("content-type") ?? "";
  if (req.method !== "DELETE" && !type.includes("application/json")) throw new BadRequest("Send JSON with Content-Type: application/json");
}

/** Run a handler, turning validation and auth errors into clear responses and anything else into a logged 500. */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof BadRequest) return json({ error: err.message }, 400);
    if (err instanceof AuthError) return json({ error: err.message }, err.status);
    console.error("[api]", err);
    return json({ error: "Something went wrong on the server. Check the container log." }, 500);
  }
}

/** Requires a signed-in user. Extends the cookie when the session was renewed. */
export function withUser(req: NextRequest, fn: (me: Me) => Promise<Response> | Response, opts: { admin?: boolean } = {}) {
  return handle(async () => {
    assertSameSite(req);
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const auth = userForToken(token);
    if (!auth) return json({ error: "You're signed out. Sign in again." }, 401);
    if (opts.admin && !auth.me.isAdmin) return json({ error: "Only an admin can do that." }, 403);
    const res = await fn(auth.me);
    if (auth.renewed && token && res instanceof NextResponse) res.cookies.set(SESSION_COOKIE, token, cookieOptions(isSecure(req)));
    return res;
  });
}

export const withAdmin = (req: NextRequest, fn: (me: Me) => Promise<Response> | Response) => withUser(req, fn, { admin: true });

/** Respond with the user and a fresh session cookie. */
export function signedIn(req: NextRequest, me: Me, status = 200) {
  const res = json({ me }, status);
  res.cookies.set(SESSION_COOKIE, startAuthSession(me.id), cookieOptions(isSecure(req)));
  return res;
}
