import Link from "next/link";
import { money, monthlyIn, priceLabel, upcomingRenewal, daysUntil, type Sub } from "@/lib/subs";
import { catColor, niceDate } from "@/lib/ui";

export function SubsTable({ subs, base, editable = true }: { subs: Sub[]; base: string; editable?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Category</th>
            <th className="r">Price</th>
            <th className="r">Per month ({base})</th>
            <th>Next renewal</th>
            <th>Owner</th>
            <th>Status</th>
            {editable && <th>Added by</th>}
          </tr>
        </thead>
        <tbody>
          {subs.map((s) => {
            const r = upcomingRenewal(s);
            const soon = r ? daysUntil(r) <= 7 : false;
            return (
              <tr key={s.id} className={s.status === "cancelled" ? "cancelled-row" : ""}>
                <td>
                  <div className="vendor-cell">
                    <span className="initial" style={{ background: catColor(s.category) }} aria-hidden>
                      {s.vendor.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      {editable ? <Link href={`/dashboard/subscriptions/${s.id}`}>{s.vendor}</Link> : <strong>{s.vendor}</strong>}
                      {s.plan && <div className="muted small">{s.plan}{s.seats ? ` · ${s.seats} seats` : ""}</div>}
                    </div>
                  </div>
                </td>
                <td className="muted">{s.category}</td>
                <td className="r num">{priceLabel(s)}</td>
                <td className="r num">{money(monthlyIn(s, base), base)}</td>
                <td className="num" style={soon ? { color: "var(--amber)", fontWeight: 600 } : undefined}>
                  {s.status === "cancelled" ? <span className="dash">—</span> : niceDate(r)}
                </td>
                <td>{s.owner ?? <span className="dash">No owner</span>}</td>
                <td><span className={`tag ${s.status}`}>{s.status}</span></td>
                {editable && (
                  <td><span className={`tag ${s.source}`}>{s.source === "claude" ? "Claude" : "You"}</span></td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
