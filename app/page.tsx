import Link from "next/link";
import { Brand } from "@/components/Brand";
import { APP_NAME } from "@/lib/brand";
import { currentWorkspace } from "@/lib/auth";
import { catColor } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const ws = await currentWorkspace().catch(() => null);
  return (
    <>
      <header className="topbar">
        <div className="wrap">
          <Brand />
          <nav className="nav" />
          {ws ? (
            <Link className="btn small" href="/dashboard">Open dashboard</Link>
          ) : (
            <div className="actions-row">
              <Link className="btn link" href="/login">Log in</Link>
              <Link className="btn small" href="/signup">Create account</Link>
            </div>
          )}
        </div>
      </header>
      <main className="wrap landing">
        <section className="hero">
          <div>
            <h1>Know where every rupee goes, and what renews next.</h1>
            <p className="lead">
              Give Claude your card statement. It sorts every line into buckets like Tech, Travel and Meals, and picks out
              your SaaS subscriptions. {APP_NAME} keeps it all live: an owner for every bucket, monthly totals, and each
              renewal on your calendar.
            </p>
            <div className="ctas">
              <Link className="btn" href="/signup">Create a free account</Link>
              <Link className="btn secondary" href="/login">Try the demo account</Link>
            </div>
          </div>
          <div className="flow" aria-label="Example">
            <div className="bubble user">Here’s our October card statement. Log every transaction by bucket, and our SaaS subscriptions.</div>
            <div className="bubble tool">Claude used {APP_NAME} · add_transactions (30) · add_subscriptions (18)</div>
            <div className="bubble">
              Logged 30 transactions for October: <strong>₹6.7 lakh</strong>, mostly Tech &amp; software. I also added 18
              subscriptions. 1Password renews next week for ₹1.26 lakh, and you pay for 3 design tools.
              <div className="mini-line" aria-hidden>
                {[["Engineering", 34], ["Communication", 18], ["Design", 16], ["Sales & CRM", 14], ["Productivity", 10], ["Other", 8]].map(
                  ([c, w]) => <span key={c} style={{ width: `${w}%`, background: catColor(String(c)) }} />,
                )}
              </div>
            </div>
          </div>
        </section>
        <section className="preview" aria-label="Product preview">
          <h2>Everything Claude found, in one place you can edit</h2>
          <p className="muted">Every row shows whether Claude or a person added it, and every change is kept in the history.</p>
          <div className="preview-grid">
            <figure className="browser" style={{ margin: 0 }}>
              <div className="browser-bar"><i /><i /><i /><span>This month</span></div>
              <img src="/preview-month.jpg" alt="Monthly spend split into buckets with an owner for each" width={2360} height={1478} />
            </figure>
            <figure className="browser" style={{ margin: 0 }}>
              <div className="browser-bar"><i /><i /><i /><span>Subscriptions</span></div>
              <img src="/preview-subs.jpg" alt="SaaS subscriptions with monthly burn and upcoming renewals" width={2360} height={1478} />
            </figure>
          </div>
        </section>
        <section className="how">
          <div>
            <h3>Claude does the reading</h3>
            <p className="muted">Claude, on your own plan, reads the statement, sorts each line into a bucket and spots the subscriptions.</p>
          </div>
          <div>
            <h3>{APP_NAME} keeps the record</h3>
            <p className="muted">Every cost in a bucket with an owner, plus one list of subscriptions with renewal dates. Edit anything; every change is logged.</p>
          </div>
          <div>
            <h3>It keeps working after the chat</h3>
            <p className="muted">Renewals sync to Google or Outlook Calendar, and a read-only link keeps your CFO up to date.</p>
          </div>
        </section>
        <footer className="footer">{APP_NAME} contains no AI. Claude connects to it through MCP.</footer>
      </main>
    </>
  );
}
