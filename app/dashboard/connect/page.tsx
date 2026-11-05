import { headers } from "next/headers";
import { requireWorkspace } from "@/lib/auth";
import { CopyField } from "@/components/CopyField";
import { originFrom } from "@/lib/ui";
import { APP_NAME } from "@/lib/brand";
import { CURRENCIES } from "@/lib/subs";
import { clearAll, rotateLinks, saveWorkspace } from "../../actions";

export const metadata = { title: "Connect Claude" };

export default async function Connect({ searchParams }: { searchParams: Promise<{ welcome?: string; saved?: string; rotated?: string }> }) {
  const ws = await requireWorkspace();
  const sp = await searchParams;
  const origin = originFrom(await headers());
  const mcpUrl = `${origin}/mcp/${ws.mcp_key}`;
  const calUrl = `${origin}/cal/${ws.cal_key}/renewals.ics`;
  const shareUrl = `${origin}/share/${ws.share_key}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Connect Claude</h1>
          <p className="muted">Claude does the reading and thinking on your own Claude plan. {APP_NAME} stores the results and keeps them live.</p>
        </div>
      </div>
      {sp.welcome && <p className="notice">Your account is ready. Connect Claude to add your first subscriptions.</p>}
      {sp.saved && <p className="notice">Settings saved.</p>}
      {sp.rotated && <p className="notice">New link created. The old one no longer works.</p>}

      <div className="two-col">
        <section className="panel">
          <div className="panel-head"><h2>Add {APP_NAME} to Claude</h2></div>
          <ol className="steps">
            <li>
              <div>
                <h3>Copy your connector link</h3>
                <p className="muted small">This link is private to your account. Anyone with it can add to your list.</p>
                <CopyField value={mcpUrl} label="Connector link" />
              </div>
            </li>
            <li>
              <div>
                <h3>Add it as a custom connector</h3>
                <p className="muted">
                  In Claude (web or desktop), open <strong>Settings → Connectors</strong>, choose <strong>Add custom connector</strong>,
                  name it {APP_NAME}, paste the link and select <strong>Add</strong>. No sign-in or API key is needed.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Ask Claude</h3>
                <p className="muted">In a new chat, make sure {APP_NAME} is switched on in the tools menu, attach a card statement and ask:</p>
                <p className="prompt-sample" style={{ marginTop: 8 }}>“Log this statement in {APP_NAME}: every transaction by bucket, and our SaaS subscriptions.”</p>
                <p className="muted small" style={{ marginTop: 8 }}>
                  No statement handy? <a href="/sample-statement.pdf" download>Download a sample statement</a>. Later, try “What did we spend on travel this month?”,
                  “What renews in the next 30 days?” or “Make Priya the owner of the Marketing bucket.”
                </p>
              </div>
            </li>
          </ol>
        </section>

        <div style={{ display: "grid", gap: 20 }}>
          <section className="panel">
            <div className="panel-head"><h2>Renewal calendar</h2></div>
            <p className="muted small">
              Subscribe once and every renewal appears in your calendar with a reminder 3 days before. It stays in sync as your list changes.
              In Google Calendar: <strong>Other calendars → + → From URL</strong>. In Outlook: <strong>Add calendar → Subscribe from web</strong>.
            </p>
            <CopyField value={calUrl} label="Calendar link" />
          </section>
          <section className="panel">
            <div className="panel-head"><h2>Read-only link</h2></div>
            <p className="muted small">A live view for your CEO, CFO or investors. They can see spend and renewals, but can’t change anything.</p>
            <CopyField value={shareUrl} label="Read-only link" />
            <p className="small" style={{ marginTop: 8 }}><a href={shareUrl} target="_blank" rel="noreferrer">Open read-only view</a></p>
          </section>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>Settings</h2></div>
        <form action={saveWorkspace} className="form-grid">
          <label className="field">Company name<input name="name" defaultValue={ws.name} /></label>
          <label className="field">Show totals in
            <select name="currency" defaultValue={ws.base_currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <p className="muted small full">Totals convert other currencies at fixed approximate rates.</p>
          <div className="full actions-row"><button className="btn" type="submit">Save settings</button></div>
        </form>
        <div className="actions-row" style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--rule)" }}>
          <form action={rotateLinks}><input type="hidden" name="which" value="mcp" /><button className="btn secondary small">New connector link</button></form>
          <form action={rotateLinks}><input type="hidden" name="which" value="cal" /><button className="btn secondary small">New calendar link</button></form>
          <form action={rotateLinks}><input type="hidden" name="which" value="share" /><button className="btn secondary small">New read-only link</button></form>
          <form action={clearAll}><button className="btn danger small">Delete all data</button></form>
        </div>
      </section>
    </>
  );
}
