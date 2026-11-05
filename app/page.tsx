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
            <h1>Know every SaaS tool you pay for, before it renews.</h1>
            <p className="lead">
              Upload a card statement to Claude. It picks out the subscriptions and logs them in {APP_NAME}. You get one
              live list with owners, monthly burn and every renewal on your calendar.
            </p>
            <div className="ctas">
              <Link className="btn" href="/signup">Create a free account</Link>
              <Link className="btn secondary" href="/login">Try the demo account</Link>
            </div>
          </div>
          <div className="flow" aria-label="Example">
            <div className="bubble user">Here’s our October card statement. Log our SaaS subscriptions.</div>
            <div className="bubble tool">Claude used {APP_NAME} · add_subscriptions (14 tools)</div>
            <div className="bubble">
              Added 14 subscriptions. You’re spending <strong>₹1,86,400 a month</strong>. Slack and Notion renew in the
              next 9 days, and Design has 3 overlapping tools.
              <div className="mini-line" aria-hidden>
                {[["Engineering", 34], ["Communication", 18], ["Design", 16], ["Sales & CRM", 14], ["Productivity", 10], ["Other", 8]].map(
                  ([c, w]) => <span key={c} style={{ width: `${w}%`, background: catColor(String(c)) }} />,
                )}
              </div>
            </div>
          </div>
        </section>
        <section className="how">
          <div>
            <h3>Claude does the reading</h3>
            <p className="muted">Claude, on your own plan, reads statements and invoices and separates SaaS from travel and food.</p>
          </div>
          <div>
            <h3>{APP_NAME} keeps the record</h3>
            <p className="muted">One list with owners, seats and renewal dates. Edit anything, and every change is logged.</p>
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
