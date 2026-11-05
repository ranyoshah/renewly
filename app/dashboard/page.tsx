import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { listSubs, summarise, priceLabel, daysUntil, upcomingRenewal } from "@/lib/subs";
import { BurnPanel } from "@/components/Burn";
import { SubsTable } from "@/components/SubsTable";
import { dayMonth } from "@/lib/ui";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: "Overview" };

const FILTERS = [
  { key: "live", label: "Active" },
  { key: "renewing", label: "Renewing in 30 days" },
  { key: "noowner", label: "No owner" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All" },
];

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; deleted?: string; cleared?: string }>;
}) {
  const ws = await requireWorkspace();
  const sp = await searchParams;
  const show = FILTERS.some((f) => f.key === sp.show) ? sp.show! : "live";
  const subs = await listSubs(ws.id);
  const s = summarise(subs, ws.base_currency);

  if (!subs.length) {
    return (
      <>
        {sp.cleared && <p className="notice">All subscriptions were removed.</p>}
        <section className="panel empty">
          <h1>Nothing tracked yet</h1>
          <p>Connect Claude, upload a card statement and ask it to log your subscriptions. They’ll show up here with totals and renewal dates.</p>
          <p className="prompt-sample">“Here’s our card statement. Log our SaaS subscriptions in {APP_NAME}.”</p>
          <div className="actions-row">
            <Link className="btn" href="/dashboard/connect">Connect Claude</Link>
            <a className="btn secondary" href="/sample-statement.pdf" download>Download a sample statement</a>
            <Link className="btn secondary" href="/dashboard/new">Add one by hand</Link>
          </div>
        </section>
      </>
    );
  }

  const shown = subs.filter((x) => {
    if (show === "all") return true;
    if (show === "cancelled") return x.status === "cancelled";
    if (x.status === "cancelled") return false;
    if (show === "noowner") return !x.owner;
    if (show === "renewing") {
      const r = upcomingRenewal(x);
      return !!r && daysUntil(r) <= 30;
    }
    return true;
  });

  return (
    <>
      {sp.deleted && <p className="notice">Subscription deleted.</p>}
      <div className="page-head">
        <h1>{ws.name}</h1>
        <div className="actions-row">
          <Link className="btn secondary" href="/dashboard/new">Add subscription</Link>
        </div>
      </div>

      <BurnPanel s={s} />

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head">
            <h2>Renewing in the next 30 days</h2>
            <span className="muted small">Calendar sync on Connect page</span>
          </div>
          {s.upcoming.length ? (
            <ul className="renewals">
              {s.upcoming.map(({ sub, date }) => {
                const { day, month } = dayMonth(date);
                const d = daysUntil(date);
                return (
                  <li key={sub.id} className={d <= 7 ? "soon" : ""}>
                    <div className="cal num"><b>{day}</b><small>{month}</small></div>
                    <div>
                      <Link href={`/dashboard/subscriptions/${sub.id}`}>{sub.vendor}</Link>
                      <div className="muted small">
                        {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`} · {sub.owner ?? "No owner"}
                        {sub.status === "cancelling" ? " · cancelling" : ""}
                      </div>
                    </div>
                    <span className="num">{priceLabel(sub)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">No renewals in the next 30 days.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h2>Worth a look</h2></div>
          <div className="attention">
            {s.overlaps.map((o) => (
              <div className="attention-item" key={o.category}>
                <b className="num">{o.count}</b>
                <p><strong>{o.category}</strong> tools: {o.vendors.join(", ")}. Check whether you need all of them.</p>
              </div>
            ))}
            {s.noOwner.length > 0 && (
              <div className="attention-item">
                <b className="num">{s.noOwner.length}</b>
                <p>Tools with no owner. <Link href="/dashboard?show=noowner">Assign owners</Link> so someone decides on each renewal.</p>
              </div>
            )}
            {s.noRenewalDate.length > 0 && (
              <div className="attention-item">
                <b className="num">{s.noRenewalDate.length}</b>
                <p>Tools without a renewal date: {s.noRenewalDate.map((x) => x.vendor).join(", ")}.</p>
              </div>
            )}
            {s.cancelling.length > 0 && (
              <div className="attention-item">
                <b className="num">{s.cancelling.length}</b>
                <p>Marked to cancel: {s.cancelling.map((x) => x.vendor).join(", ")}. Cancel before the renewal date.</p>
              </div>
            )}
            {!s.overlaps.length && !s.noOwner.length && !s.noRenewalDate.length && !s.cancelling.length && (
              <p className="muted">Everything has an owner and a renewal date.</p>
            )}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Subscriptions</h2>
          <nav className="filters" aria-label="Filter subscriptions">
            {FILTERS.map((f) => (
              <Link key={f.key} href={f.key === "live" ? "/dashboard" : `/dashboard?show=${f.key}`} aria-current={show === f.key ? "true" : undefined}>
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        {shown.length ? <SubsTable subs={shown} base={ws.base_currency} /> : <p className="muted">Nothing here.</p>}
      </section>
    </>
  );
}
