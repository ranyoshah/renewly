import { notFound } from "next/navigation";
import { ready, sql } from "@/lib/db";
import { listSubs, summarise, priceLabel, daysUntil } from "@/lib/subs";
import { BurnPanel } from "@/components/Burn";
import { SubsTable } from "@/components/SubsTable";
import { Brand } from "@/components/Brand";
import { dayMonth } from "@/lib/ui";
import { APP_NAME } from "@/lib/brand";
import { bucketColor, listBuckets, listMonths, listTxns, monthLabel, summariseMonth } from "@/lib/expenses";
import { money } from "@/lib/subs";

export const dynamic = "force-dynamic";
export const metadata = { title: "SaaS spend", robots: { index: false } };

export default async function Share({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  await ready();
  const [ws] = await sql()<{ id: string; name: string; email: string; base_currency: string }[]>`
    select id, name, email, base_currency from workspaces where share_key = ${key}`;
  if (!ws) notFound();
  const subs = await listSubs(ws.id);
  const s = summarise(subs, ws.base_currency);
  const latest = (await listMonths(ws.id))[0];
  const ms = latest ? summariseMonth(await listTxns(ws.id, latest), await listBuckets(ws), ws.base_currency) : null;
  return (
    <>
      <div className="share-banner"><div className="wrap">Read-only view, always up to date. Shared from {APP_NAME}.</div></div>
      <header className="topbar"><div className="wrap"><Brand /></div></header>
      <main className="wrap page">
        <h1>{ws.name}: company spend</h1>
        {ms && latest && (
          <section className="panel">
            <div className="panel-head">
              <h2>{monthLabel(latest)}: {money(ms.total, ms.base)}</h2>
              <span className="muted small">{ms.count} transactions</span>
            </div>
            <ul className="bars">
              {ms.buckets.map((b) => (
                <li key={b.name}>
                  <div className="bar-row">
                    <span className="bar-label">
                      <span className="swatch" style={{ background: bucketColor(b.name) }} />
                      <strong>{b.name}</strong>
                      <span className="muted small">{b.owner ?? "No owner"} · {b.count}</span>
                    </span>
                    <span className="bar-track" aria-hidden>
                      <span className="bar-fill" style={{ width: `${(Math.max(b.total, 0) / Math.max(1, ms.buckets[0].total)) * 100}%`, background: bucketColor(b.name) }} />
                    </span>
                    <span className="bar-amt num">{money(b.total, ms.base)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <BurnPanel s={s} title="SaaS subscriptions" />
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
