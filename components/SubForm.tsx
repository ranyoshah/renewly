import { CATEGORIES, CURRENCIES, CYCLES, STATUSES, upcomingRenewal, type Sub } from "@/lib/subs";

export function SubForm({ sub, action, submitLabel, base }: { sub?: Sub; action: (f: FormData) => Promise<void>; submitLabel: string; base: string }) {
  return (
    <form action={action} className="form-grid">
      {sub && <input type="hidden" name="id" value={sub.id} />}
      <label className="field">Tool<input name="vendor" required defaultValue={sub?.vendor} placeholder="Figma" /></label>
      <label className="field">Plan<input name="plan" defaultValue={sub?.plan ?? ""} placeholder="Professional" /></label>
      <label className="field">Price per billing cycle<input name="amount" type="number" step="0.01" min="0" required defaultValue={sub?.amount} /></label>
      <label className="field">Currency
        <select name="currency" defaultValue={sub?.currency ?? base}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="field">Billing cycle
        <select name="billing_cycle" defaultValue={sub?.billing_cycle ?? "monthly"}>{CYCLES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>
      </label>
      <label className="field">Next renewal<input name="next_renewal" type="date" defaultValue={(sub && (upcomingRenewal(sub) ?? sub.next_renewal)) ?? ""} /></label>
      <label className="field">Category
        <select name="category" defaultValue={sub?.category ?? "Other"}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="field">Status
        <select name="status" defaultValue={sub?.status ?? "active"}>{STATUSES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>
      </label>
      <label className="field">Owner<input name="owner" defaultValue={sub?.owner ?? ""} placeholder="Who decides on renewal" /></label>
      <label className="field">Seats<input name="seats" type="number" min="1" step="1" defaultValue={sub?.seats ?? ""} /></label>
      <label className="field full">Notes<textarea name="notes" defaultValue={sub?.notes ?? ""} placeholder="e.g. Ask design team before renewing" /></label>
      <div className="full actions-row"><button className="btn" type="submit">{submitLabel}</button></div>
    </form>
  );
}
