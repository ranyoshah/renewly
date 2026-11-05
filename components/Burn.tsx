import { money, summarise } from "@/lib/subs";
import { catColor } from "@/lib/ui";

type Summary = ReturnType<typeof summarise>;

export function BurnPanel({ s, title = "SaaS burn" }: { s: Summary; title?: string }) {
  const total = s.monthly || 1;
  return (
    <section className="panel burn" aria-label={title}>
      <div className="burn-top">
        <div>
          <p className="muted small">{title}</p>
          <p className="burn-figure num">
            {money(s.monthly, s.base)}
            <span className="per">per month</span>
          </p>
          <p className="burn-sub num">
            {money(s.annual, s.base)} a year across {s.activeCount} {s.activeCount === 1 ? "tool" : "tools"}
          </p>
        </div>
        <div className="burn-facts">
          <div className={`fact ${s.upcoming.length ? "warn" : ""}`}>
            <strong className="num">{s.upcoming.length}</strong>
            <span>renew in 30 days · {money(s.upcomingTotal, s.base)}</span>
          </div>
          <div className="fact">
            <strong className="num">{s.noOwner.length}</strong>
            <span>without an owner</span>
          </div>
          {s.cancelledSavings > 0 && (
            <div className="fact">
              <strong className="num">{money(s.cancelledSavings, s.base)}</strong>
              <span>saved per month</span>
            </div>
          )}
        </div>
      </div>
      <div className="burnline" role="img" aria-label="Monthly spend split by category">
        {s.categories.map((c) => (
          <span
            key={c.category}
            title={`${c.category}: ${money(c.monthly, s.base)}/mo`}
            style={{ width: `${(c.monthly / total) * 100}%`, background: catColor(c.category) }}
          />
        ))}
      </div>
      <ul className="legend">
        {s.categories.map((c) => (
          <li key={c.category}>
            <span className="swatch" style={{ background: catColor(c.category) }} />
            {c.category}
            <span className="amt num">
              {money(c.monthly, s.base)} · {c.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
