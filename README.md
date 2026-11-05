# Renewly

**Every SaaS tool your company pays for, and when it renews.**

Renewly is a SaaS spend tracker for startup founders and finance teams. You upload a card statement to Claude, and Claude picks out the subscriptions and saves them to Renewly through MCP. Renewly then gives you one live list with owners, monthly spend, renewal dates, a calendar feed and a read-only link for your CFO.

## No AI inside

Renewly contains **no AI models, AI SDKs or AI API keys**. Claude, on the customer's own Claude plan, does all the reading and reasoning. Renewly does everything else in plain code: storage, editing, deduplication, currency conversion, totals, renewal dates, the calendar feed and sharing.

To check, scan the dependencies:

```bash
grep -iE '"(openai|@anthropic-ai/[^"]*|ai|@ai-sdk/[^"]*|langchain[^"]*|@langchain/[^"]*|@google/generative-ai|cohere-ai|groq-sdk|@mistralai/[^"]*)"' package.json package-lock.json   # no results
```

`@modelcontextprotocol/server` is the open MCP protocol library (the "plug" Claude connects to), not an AI model.

## How it works

```
You (in Claude)            Claude                         Renewly (this app)
"Log our SaaS from    →    reads the PDF, finds     →     add_subscriptions(...)
 this statement"            recurring SaaS charges         saves, dedupes, computes totals,
                                                           logs "added by Claude"
                                                           → dashboard, calendar, share link
```

### MCP tools

| Tool | What it does |
|---|---|
| `add_subscriptions` | Saves many subscriptions at once. Vendors already tracked are updated rather than duplicated. Works out the next renewal from the last charge date. |
| `list_subscriptions` | Lists subscriptions, filtered by status, category, no owner or renewing within N days. |
| `update_subscription` | Changes owner, price, seats, plan, renewal date, notes or status (active, cancelling, cancelled). |
| `get_spend_summary` | Returns totals the app calculates: monthly and annual burn, spend by category, upcoming renewals, tools with no owner, possible overlaps. |

Each account has its own private connector URL: `https://<app>/mcp/<private-key>`. It uses Streamable HTTP with no sign-in.

### In the web app

- **Overview:** monthly and annual burn, the "burn line" by category, renewals in the next 30 days, things worth a look, and a filterable table
- **Subscription page:** edit every field, mark as cancelling or cancelled, delete, and see the full history of changes by Claude and by you
- **Activity:** every change, labelled Claude or You
- **Connect Claude:** your connector link, calendar feed (`.ics` with a reminder 3 days before) and read-only share link

## Try it

- Demo login: `demo@renewly.app` / `volopay2026`
- Sample statement to give Claude: `/sample-statement.pdf` (a fictional corporate card statement with SaaS mixed in among Uber, Swiggy, flights and fees)

### Connect to Claude

1. Log in and open **Connect Claude**. Copy the connector link.
2. In Claude, open **Settings → Connectors → Add custom connector**. Name it "Renewly", paste the link and select **Add**.
3. In a new chat, turn on Renewly in the tools menu, attach the statement and ask: *"Log our SaaS subscriptions from this statement in Renewly."*

## Stack

Next.js 16 (App Router, server actions) · Postgres (Neon) via `postgres` · `mcp-handler` + `@modelcontextprotocol/server` · hosted on Vercel. Passwords are hashed with scrypt, and sessions use signed cookies.

## Run locally

```bash
npm install
echo 'DATABASE_URL=postgres://postgres@localhost:5432/renewly' > .env.local
npm run dev
# Test the MCP endpoint like Claude would:
node scripts/test-mcp.mjs http://localhost:3000/mcp/<your-key>
```

Tables and the demo account are created automatically on first request.
