import Link from "next/link";
import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth";
import { BUCKETS, bucketColor, getTxn, listBuckets, monthLabel } from "@/lib/expenses";
import { CURRENCIES, convert, money } from "@/lib/subs";
import { removeTransaction, saveTransaction } from "../../../actions";

export const metadata = { title: "Transaction" };

export default async function TxnPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const ws = await requireWorkspace();
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTxn(ws.id, id);
  if (!t) notFound();
  const owner = (await listBuckets(ws)).find((b) => b.name === t.bucket)?.owner;
  const m = t.txn_date.slice(0, 7);

  return (
    <>
      <p className="small"><Link href={`/dashboard/month?m=${m}`}>← {monthLabel(m)}</Link></p>
      <div className="page-head">
        <div>
          <h1>{t.merchant}</h1>
          <p className="muted num">
            {money(t.amount, t.currency)}
            {t.currency !== ws.base_currency ? ` · ≈ ${money(convert(t.amount, t.currency, ws.base_currency), ws.base_currency)}` : ""} ·{" "}
            <span className="swatch" style={{ background: bucketColor(t.bucket), display: "inline-block" }} /> {t.bucket} · owner {owner ?? "none"} ·{" "}
            <span className={`tag ${t.source}`}>Added by {t.source === "claude" ? "Claude" : "you"}</span>
          </p>
        </div>
        <form action={removeTransaction}>
          <input type="hidden" name="id" value={t.id} />
          <button className="btn danger" type="submit">Delete</button>
        </form>
      </div>
      {sp.saved && <p className="notice" role="status">Changes saved.</p>}
      {sp.error && <p className="error" role="alert">{sp.error}</p>}
      <section className="panel">
        {t.description && <p className="muted small" style={{ marginBottom: 16 }}>Statement text: {t.description}</p>}
        <form action={saveTransaction} className="form-grid">
          <input type="hidden" name="id" value={t.id} />
          <label className="field">Date<input name="date" type="date" required defaultValue={t.txn_date} /></label>
          <label className="field">Merchant<input name="merchant" required defaultValue={t.merchant} /></label>
          <label className="field">Amount<input name="amount" type="number" step="0.01" required defaultValue={t.amount} /></label>
          <label className="field">Currency
            <select name="currency" defaultValue={t.currency}>{[...new Set([t.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field">Bucket
            <select name="bucket" defaultValue={t.bucket}>{BUCKETS.map((b) => <option key={b}>{b}</option>)}</select>
          </label>
          <label className="field">Notes<input name="notes" defaultValue={t.notes ?? ""} placeholder="e.g. Client visit, Delhi" /></label>
          <div className="full"><button className="btn" type="submit">Save changes</button></div>
        </form>
      </section>
    </>
  );
}
