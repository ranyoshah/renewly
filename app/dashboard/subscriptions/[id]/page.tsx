import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { getSub, listActivity, money, monthlyIn, priceLabel, upcomingRenewal } from "@/lib/subs";
import { SubForm } from "@/components/SubForm";
import { niceDate, timeAgo } from "@/lib/ui";
import { removeSubscription, saveSubscription, setStatus } from "../../../actions";

export const metadata = { title: "Subscription" };

export default async function SubPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const ws = await requireWorkspace();
  const { id } = await params;
  const sp = await searchParams;
  const sub = await getSub(ws.id, id);
  if (!sub) notFound();
  const history = await listActivity(ws.id, 50, sub.id);
  const renewal = upcomingRenewal(sub);

  return (
    <>
      <p className="small"><Link href="/dashboard">← Overview</Link></p>
      <div className="page-head">
        <div>
          <h1>{sub.vendor}</h1>
          <p className="muted num">
            {priceLabel(sub)} · {money(monthlyIn(sub, ws.base_currency), ws.base_currency)}/mo ·{" "}
            {sub.status === "cancelled" ? "cancelled" : `renews ${niceDate(renewal)}`} ·{" "}
            <span className={`tag ${sub.source}`}>Added by {sub.source === "claude" ? "Claude" : "you"}</span>
          </p>
        </div>
        <div className="actions-row">
          {sub.status !== "cancelled" ? (
            <form action={setStatus}>
              <input type="hidden" name="id" value={sub.id} />
              <input type="hidden" name="status" value={sub.status === "active" ? "cancelling" : "cancelled"} />
              <button className="btn secondary" type="submit">{sub.status === "active" ? "Mark to cancel" : "Mark cancelled"}</button>
            </form>
          ) : (
            <form action={setStatus}>
              <input type="hidden" name="id" value={sub.id} />
              <input type="hidden" name="status" value="active" />
              <button className="btn secondary" type="submit">Reactivate</button>
            </form>
          )}
          <form action={removeSubscription}>
            <input type="hidden" name="id" value={sub.id} />
            <button className="btn danger" type="submit">Delete</button>
          </form>
        </div>
      </div>
      {sp.saved && <p className="notice">{sp.saved === "added" ? "Subscription added." : "Changes saved."}</p>}
      {sp.error && <p className="error" role="alert">{sp.error}</p>}
      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h2>Details</h2></div>
          <SubForm sub={sub} action={saveSubscription} submitLabel="Save changes" base={ws.base_currency} />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>History</h2></div>
          {history.length ? (
            <ul className="feed">
              {history.map((a) => (
                <li key={a.id}>
                  <time dateTime={new Date(a.created_at).toISOString()}>{timeAgo(a.created_at)}</time>
                  <div>
                    <div className="what">
                      <span className={`tag ${a.actor}`}>{a.actor === "claude" ? "Claude" : "You"}</span>
                      {a.action}
                    </div>
                    {a.detail && <p className="detail">{a.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No history yet.</p>
          )}
        </section>
      </div>
    </>
  );
}
