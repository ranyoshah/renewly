import { notFound } from "next/navigation";
import { ready, sql } from "@/lib/db";
import { listSubs, summarise, priceLabel, daysUntil } from "@/lib/subs";
import { BurnPanel } from "@/components/Burn";
import { SubsTable } from "@/components/SubsTable";
import { Brand } from "@/components/Brand";
import { dayMonth } from "@/lib/ui";
import { APP_NAME } from "@/lib/brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "SaaS spend", robots: { index: false } };

export default async function Share({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  await ready();
  const [ws] = await sql()<{ id: string; name: string; base_currency: string }[]>`
    select id, name, base_currency from workspaces where share_key = ${key}`;
  if (!ws) notFound();
  const subs = await listSubs(ws.id);
  const s = summarise(subs, ws.base_currency);
  return (
    <>
      <div className="share-banner"><div className="wrap">Read-only view, always up to date. Shared from {APP_NAME}.</div></div>
      <header className="topbar"><div className="wrap"><Brand /></div></header>
      <main className="wrap page">
        <h1>{ws.name}: SaaS spend</h1>
        <BurnPanel s={s} />
        <section className="panel">
          <div className="panel-head"><h2>Renewing in the next 30 days</h2></div>
          {s.upcoming.length ? (
            <ul className="renewals">
              {s.upcoming.map(({ sub, date }) => {
                const { day, month } = dayMonth(date);
                const d = daysUntil(date);
                return (
                  <li key={sub.id} className={d <= 7 ? "soon" : ""}>
                    <div className="cal num"><b>{day}</b><small>{month}</small></div>
                    <div><strong>{sub.vendor}</strong><div className="muted small">{sub.owner ?? "No owner"}</div></div>
                    <span className="num">{priceLabel(sub)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="muted">No renewals in the next 30 days.</p>}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>All tools</h2></div>
          {subs.length ? <SubsTable subs={subs} base={ws.base_currency} editable={false} /> : <p className="muted">Nothing tracked yet.</p>}
        </section>
      </main>
    </>
  );
}
