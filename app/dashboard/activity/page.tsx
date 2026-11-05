import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { listActivity } from "@/lib/subs";
import { timeAgo } from "@/lib/ui";

export const metadata = { title: "Activity" };

export default async function Activity() {
  const ws = await requireWorkspace();
  const items = await listActivity(ws.id, 200);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="muted">Every change, and whether Claude or a person made it.</p>
        </div>
      </div>
      <section className="panel">
        {items.length ? (
          <ul className="feed">
            {items.map((a) => (
              <li key={a.id}>
                <time dateTime={new Date(a.created_at).toISOString()}>{timeAgo(a.created_at)}</time>
                <div>
                  <div className="what">
                    <span className={`tag ${a.actor}`}>{a.actor === "claude" ? "Claude" : "You"}</span>
                    <span>
                      {a.action}{" "}
                      {a.vendor && (a.subscription_id ? <Link href={`/dashboard/subscriptions/${a.subscription_id}`}><strong>{a.vendor}</strong></Link> : <strong>{a.vendor}</strong>)}
                    </span>
                  </div>
                  {a.detail && <p className="detail">{a.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing has happened yet. Changes from Claude and from you will be listed here.</p>
        )}
      </section>
    </>
  );
}
