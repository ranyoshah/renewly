import { createMcpHandler } from "mcp-handler";
import { ready, sql } from "@/lib/db";
import type { Workspace } from "@/lib/auth";
import { registerTools, SERVER_INSTRUCTIONS } from "@/lib/mcp";
import { APP_NAME } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ key: string }> };

function baseUrl(req: Request) {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

async function handle(req: Request, { params }: Ctx) {
  const { key } = await params;
  await ready();
  const [ws] = await sql()<Workspace[]>`
    select id, name, email, base_currency, mcp_key, share_key, cal_key from workspaces where mcp_key = ${key}`;
  if (!ws) {
    return Response.json(
      { error: `Unknown connector link. Copy your link from ${APP_NAME} → Connect Claude.` },
      { status: 404 },
    );
  }
  const handler = createMcpHandler((server) => registerTools(server, ws, baseUrl(req)), {
    serverInfo: { name: APP_NAME, version: "1.0.0" },
    instructions: SERVER_INSTRUCTIONS,
  });
  return handler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
