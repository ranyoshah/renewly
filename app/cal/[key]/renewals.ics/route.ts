import { ready, sql } from "@/lib/db";
import { listSubs, priceLabel } from "@/lib/subs";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const ymd = (d: string) => d.replace(/-/g, "");
function nextDay(d: string) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
// Fold long lines at 74 octets as required by RFC 5545.
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

const RRULE: Record<string, string> = {
  monthly: "FREQ=MONTHLY",
  quarterly: "FREQ=MONTHLY;INTERVAL=3",
  annual: "FREQ=YEARLY",
  weekly: "FREQ=WEEKLY",
};

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  await ready();
  const [ws] = await sql()<{ id: string; name: string }[]>`select id, name from workspaces where cal_key = ${key}`;
  if (!ws) return new Response("Not found", { status: 404 });
  const host = new URL(req.url).host;
  const subs = (await listSubs(ws.id)).filter((s) => s.status !== "cancelled" && s.next_renewal);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${APP_NAME}//Renewals//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`${ws.name} SaaS renewals`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const s of subs) {
    const d = s.next_renewal!;
    const cancelling = s.status === "cancelling";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${s.id}@${host}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(d))}`,
      `RRULE:${RRULE[s.billing_cycle] ?? RRULE.monthly}`,
      `SUMMARY:${esc(`${cancelling ? "Cancel before renewal: " : ""}${s.vendor} renews · ${priceLabel(s)}`)}`,
      `DESCRIPTION:${esc(`Owner: ${s.owner ?? "none"}. Category: ${s.category}.${s.notes ? ` Notes: ${s.notes}` : ""} Manage in ${APP_NAME}: https://${host}/dashboard/subscriptions/${s.id}`)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(`${s.vendor} renews in 3 days`)}`,
      "TRIGGER:-P3D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="renewals.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
