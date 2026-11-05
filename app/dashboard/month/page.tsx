import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { BUCKETS, bucketColor, listBuckets, listMonths, listTxns, monthLabel, shiftMonth, summariseMonth } from "@/lib/expenses";
import { CURRENCIES, listSubs, money, today, vendorKey } from "@/lib/subs";
import { MonthPicker } from "@/components/MonthPicker";
import { BucketSelect } from "@/components/BucketSelect";
import { APP_NAME } from "@/lib/brand";
import { addTransaction, moveTransaction, saveBucketOwners } from "../../actions";

export const metadata = { title: "This month" };

const NOTICES: Record<string, string> = {
  owners: "Bucket owners saved.",
  added: "Transaction added.",
  deleted: "Transaction deleted.",
};

export default async function MonthPage({ searchParams }: { searchParams: Promise<{ m?: string; b?: string; saved?: string; error?: string; add?: string }> }) {
  const ws = await requireWorkspace();
  const sp = await searchParams;
  const months = await listMonths(ws.id);
  const current = today().slice(0, 7);
  const month = sp.m && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m : months[0] ?? current;
  const [txns, buckets, subs] = await Promise.all([listTxns(ws.id, month), listBuckets(ws), listSubs(ws.id)]);
  const s = summariseMonth(txns, buckets, ws.base_currency);
  const filter = sp.b && BUCKETS.includes(sp.b as (typeof BUCKETS)[number]) ? sp.b : null;
  const shown = filter ? txns.filter((t) => t.bucket === filter) : txns;
  const subKeys = new Set(subs.map((x) => vendorKey(x.vendor)));
  const options = [...new Set([current, month, ...months])].sort().reverse().map((v) => ({ value: v, label: monthLabel(v) }));
  const here = `/dashboard/month?m=${month}${filter ? `&b=${encodeURIComponent(filter)}` : ""}`;
  const max = Math.max(1, ...s.buckets.map((b) => b.total));

  return (
    <>
      <div className="page-head">
        <div>
          <p className="muted small">Spend by bucket</p>
          <h1>{monthLabel(month)}</h1>
        </div>
        <MonthPicker month={month} options={options} prev={shiftMonth(month, -1)} next={shiftMonth(month, 1)} />
      </div>
      {sp.saved && NOTICES[sp.saved] && <p className="notice" role="status">{NOTICES[sp.saved]}</p>}
      {sp.error && <p className="error" role="alert">{sp.error}</p>}

      {!txns.length ? (
        <section className="panel empty">
          <h2>No spend logged for {monthLabel(month)}</h2>
          <p>Give Claude a card statement and every line lands here, sorted into buckets with an owner for each.</p>
          <p className="prompt-sample">“Log this statement in {APP_NAME}: every transaction by bucket, and our SaaS subscriptions.”</p>
          <div className="actions-row">
            <Link className="btn" href="/dashboard/connect">Connect Claude</Link>
            <a className="btn secondary" href="/sample-statement.pdf" download>Download a sample statement</a>
          </div>
          {months.length > 0 && (
            <p className="small muted">You have spend logged for {months.slice(0, 3).map((m, i) => (
              <span key={m}>{i ? ", " : ""}<Link href={`/dashboard/month?m=${m}`}>{monthLabel(m)}</Link></span>
            ))}.</p>
          )}
        </section>
      ) : (
        <>
          <section className="panel burn">
            <div className="burn-top">
              <div>
                <p className="muted small">Total spent</p>
                <p className="burn-figure num">{money(s.total, s.base)}</p>
                <p className="burn-sub">{s.count} transactions in {s.buckets.length} buckets</p>
              </div>
              <div className="burn-facts">
                {s.biggest[0] && (
                  <div className="fact">
                    <strong className="num">{money(s.inBase(s.biggest[0]), s.base)}</strong>
                    <span>largest: {s.biggest[0].merchant}</span>
                  </div>
                )}
                <div className={`fact ${s.noOwner.length ? "warn" : ""}`}>
                  <strong className="num">{s.noOwner.length}</strong>
                  <span>buckets without an owner</span>
                </div>
              </div>
            </div>
            <div className="burnline" role="img" aria-label="Spend split by bucket">
              {s.buckets.map((b) => (
                <span key={b.name} title={`${b.name}: ${money(b.total, s.base)}`} style={{ width: `${(Math.max(b.total, 0) / Math.max(s.total, 1)) * 100}%`, background: bucketColor(b.name) }} />
              ))}
            </div>
          </section>

          <div className="grid-2">
            <section className="panel">
              <div className="panel-head">
                <h2>Spend by bucket</h2>
                <span className="muted small">Select a bucket to filter</span>
              </div>
              <ul className="bars">
                {s.buckets.map((b) => {
                  const pct = s.total > 0 ? Math.round((b.total / s.total) * 100) : 0;
                  const active = filter === b.name;
                  return (
                    <li key={b.name} className={active ? "active" : ""}>
                      <Link href={active ? `/dashboard/month?m=${month}` : `/dashboard/month?m=${month}&b=${encodeURIComponent(b.name)}`} className="bar-row">
                        <span className="bar-label">
                          <span className="swatch" style={{ background: bucketColor(b.name) }} />
                          <strong>{b.name}</strong>
                          <span className="muted small">{b.owner ?? "No owner"} · {b.count}</span>
                        </span>
                        <span className="bar-track" aria-hidden>
                          <span className="bar-fill" style={{ width: `${(Math.max(b.total, 0) / max) * 100}%`, background: bucketColor(b.name) }} />
                        </span>
                        <span className="bar-amt num">{money(b.total, s.base)} <span className="muted small">{pct}%</span></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="panel">
              <div className="panel-head"><h2>Bucket owners</h2></div>
              <p className="muted small" style={{ marginBottom: 12 }}>Each owner is the person who answers for that bucket’s spend. Claude can change these too.</p>
              <form action={saveBucketOwners} className="owners-form">
                <input type="hidden" name="m" value={month} />
                {buckets.map((b) => (
                  <label key={b.name} className="owner-row">
                    <span><span className="swatch" style={{ background: bucketColor(b.name) }} /> {b.name}</span>
                    <input name={`owner:${b.name}`} defaultValue={b.owner ?? ""} placeholder="Add an owner" />
                  </label>
                ))}
                <div><button className="btn" type="submit">Save owners</button></div>
              </form>
            </section>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>{filter ? `${filter} transactions` : "All transactions"}</h2>
              <nav className="filters" aria-label="Filter by bucket">
                <Link href={`/dashboard/month?m=${month}`} aria-current={!filter ? "true" : undefined}>All</Link>
                {s.buckets.map((b) => (
                  <Link key={b.name} href={`/dashboard/month?m=${month}&b=${encodeURIComponent(b.name)}`} aria-current={filter === b.name ? "true" : undefined}>{b.name}</Link>
                ))}
              </nav>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Merchant</th>
                    <th>Bucket</th>
                    <th className="r">Amount</th>
                    <th className="r">In {s.base}</th>
                    <th>Added by</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((t) => (
                    <tr key={t.id}>
                      <td className="num muted">{Number(t.txn_date.slice(8))} {monthLabel(month).slice(0, 3)}</td>
                      <td>
                        <Link href={`/dashboard/transactions/${t.id}`} className="txn-merchant">{t.merchant}</Link>
                        {subKeys.has(vendorKey(t.merchant)) && <span className="tag sub-tag">Subscription</span>}
                        {t.description && <div className="muted small txn-desc">{t.description}</div>}
                      </td>
                      <td><BucketSelect id={t.id} value={t.bucket} buckets={BUCKETS} action={moveTransaction} returnTo={here} /></td>
                      <td className={`r num ${t.amount < 0 ? "refund" : ""}`}>{money(t.amount, t.currency)}</td>
                      <td className="r num">{money(s.inBase(t), s.base)}</td>
                      <td><span className={`tag ${t.source}`}>{t.source === "claude" ? "Claude" : "You"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <details className="panel add-txn" open={!!sp.add}>
        <summary><h2>Add a transaction by hand</h2></summary>
        <form action={addTransaction} className="form-grid" style={{ marginTop: 16 }}>
          <label className="field">Date<input name="date" type="date" required defaultValue={`${month}-01`} /></label>
          <label className="field">Merchant<input name="merchant" required placeholder="e.g. Uber" /></label>
          <label className="field">Amount<input name="amount" type="number" step="0.01" required /></label>
          <label className="field">Currency
            <select name="currency" defaultValue={ws.base_currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field">Bucket
            <select name="bucket" defaultValue="Other">{BUCKETS.map((b) => <option key={b}>{b}</option>)}</select>
          </label>
          <label className="field">Notes<input name="notes" /></label>
          <div className="full"><button className="btn" type="submit">Add transaction</button></div>
        </form>
      </details>
    </>
  );
}
