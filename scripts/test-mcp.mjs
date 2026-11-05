// End-to-end test of the MCP endpoint, acting like Claude would.
// Usage: node scripts/test-mcp.mjs <connector-url>
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = process.argv[2];
if (!url) throw new Error("Pass the connector URL");
const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));

const tools = await client.listTools();
console.log("TOOLS:", tools.tools.map((t) => t.name).join(", "));

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  console.log(`\n=== ${name} ${r.isError ? "(ERROR)" : ""}\n` + r.content.map((c) => c.text).join("\n"));
  return r;
};

await call("add_subscriptions", {
  subscriptions: [
    { vendor: "Google Workspace", plan: "Business Standard", category: "Productivity", amount: 16560, currency: "INR", billing_cycle: "monthly", last_charged: "2026-10-02", seats: 12 },
    { vendor: "Slack", plan: "Pro", category: "Communication", amount: 218.75, currency: "USD", billing_cycle: "monthly", last_charged: "2026-10-03" },
    { vendor: "Figma", plan: "Professional", category: "Design", amount: 225, currency: "USD", billing_cycle: "monthly", last_charged: "2026-10-05" },
    { vendor: "Miro", category: "Design", amount: 80, currency: "USD", last_charged: "2026-10-12" },
    { vendor: "JetBrains", plan: "All Products Pack", category: "Engineering", amount: 779, currency: "USD", billing_cycle: "annual", last_charged: "2026-10-15" },
    { vendor: "1Password", plan: "Business", category: "Security & IT", amount: 1428, currency: "USD", billing_cycle: "annual", last_charged: "2025-11-12" },
    { vendor: "FIGMA", amount: 225, currency: "USD" },
  ],
});
// Re-adding an existing vendor should update, not duplicate.
await call("add_subscriptions", { subscriptions: [{ vendor: "slack", amount: 240, currency: "USD", seats: 25 }] });
await call("list_subscriptions", { renewing_within_days: 30 });
await call("update_subscription", { vendor: "Figma", owner: "Priya" });
await call("update_subscription", { vendor: "Miro", status: "cancelling", notes: "Overlaps with Figma" });
await call("update_subscription", { vendor: "Nonexistent" });
await call("get_spend_summary", {});
await client.close();
