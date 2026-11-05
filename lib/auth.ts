import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ready, sql } from "./db";

export type Workspace = {
  id: string;
  name: string;
  email: string;
  base_currency: string;
  mcp_key: string;
  share_key: string;
  cal_key: string;
};

const COOKIE = "rn_session";

function secret() {
  return (
    process.env.SESSION_SECRET ||
    createHash("sha256").update("rn:" + (process.env.DATABASE_URL || process.env.POSTGRES_URL || "dev")).digest("hex")
  );
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export async function setSession(workspaceId: string) {
  const jar = await cookies();
  jar.set(COOKIE, `${workspaceId}.${sign(workspaceId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentWorkspace(): Promise<Workspace | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  const id = raw.slice(0, dot);
  const sig = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(id));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  await ready();
  const [ws] = await sql()<Workspace[]>`
    select id, name, email, base_currency, mcp_key, share_key, cal_key from workspaces where id = ${id}`;
  return ws ?? null;
}

export async function requireWorkspace() {
  const ws = await currentWorkspace();
  if (!ws) redirect("/login");
  return ws;
}
