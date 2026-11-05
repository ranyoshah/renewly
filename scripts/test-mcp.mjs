// End-to-end test of the MCP endpoint, acting the way Claude does with the sample statement.
// Usage: node scripts/test-mcp.mjs <connector-url>
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = process.argv[2];
if (!url) throw new Error("Pass the connector URL");
const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(url)));
console.log("TOOLS:", (await client.listTools()).tools.map((t) => t.name).join(", "));

const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  console.log(`\n=== ${name}${r.isError ? " (ERROR)" : ""}\n` + r.content.map((c) => c.text).join("\n"));
  return r;
};

const FX = 88.4;
const T = (date, merchant, description, amount, currency, bucket) => ({ date, merchant, description, amount, currency, bucket, ...(currency === "USD" ? { amount_in_home_currency: Math.round(amount * FX * 100) / 100 } : {}) });
const lines = [
  T("2026-10-01", "Uber", "UBER INDIA SYSTEMS PVT LTD BANGALORE", 482, "INR", "Travel"),
  T("2026-10-02", "Google Workspace", "GOOGLE*WORKSPACE ACMELABS.IN", 16560, "INR", "Tech & software"),
  T("2026-10-03", "Slack", "SLACK T03ACME DUBLIN IE", 218.75, "USD", "Tech & software"),
  T("2026-10-03", "Swiggy", "SWIGGY BANGALORE", 1236, "INR", "Meals & entertainment"),
  T("2026-10-04", "Notion", "NOTION LABS INC SAN FRANCISCO US", 300, "USD", "Tech & software"),
  T("2026-10-05", "Figma", "FIGMA* MONTHLY SAN FRANCISCO US", 225, "USD", "Tech & software"),
  T("2026-10-06", "Canva", "CANVA PTY LTD SURRY HILLS AU", 3999, "INR", "Tech & software"),
  T("2026-10-07", "GitHub", "GITHUB, INC. SAN FRANCISCO US", 84, "USD", "Tech & software"),
  T("2026-10-08", "AWS", "AWS EMEA AWS.AMAZON.CO LU", 1842.37, "USD", "Tech & software"),
  T("2026-10-09", "Vercel", "VERCEL INC. WALNUT US", 60, "USD", "Tech & software"),
  T("2026-10-09", "IndiGo", "INDIGO 6E BLR-DEL GURGAON", 8940, "INR", "Travel"),
  T("2026-10-10", "HubSpot", "HUBSPOT INC. CAMBRIDGE US", 890, "USD", "Marketing"),
  T("2026-10-11", "Zoom", "ZOOM.US 888-799-9666 US", 149.9, "USD", "Tech & software"),
  T("2026-10-12", "Miro", "MIRO.COM AMSTERDAM NL", 80, "USD", "Tech & software"),
  T("2026-10-13", "Amazon", "AMAZON IN OFFICE FURNITURE", 23450, "INR", "Office & admin"),
  T("2026-10-14", "Claude Team", "ANTHROPIC CLAUDE TEAM SAN FRANCISCO US", 150, "USD", "Tech & software"),
  T("2026-10-15", "JetBrains", "JETBRAINS ALL PRODUCTS PACK ANNUAL PRAGUE CZ", 779, "USD", "Tech & software"),
  T("2026-10-16", "Third Wave Coffee", "THIRD WAVE COFFEE KORAMANGALA", 840, "INR", "Meals & entertainment"),
  T("2026-10-17", "Swiggy (refund)", "REFUND SWIGGY BANGALORE", -320, "INR", "Meals & entertainment"),
  T("2026-10-18", "Linear", "LINEAR ORBIT INC SAN FRANCISCO US", 96, "USD", "Tech & software"),
  T("2026-10-19", "Uber", "UBER INDIA SYSTEMS PVT LTD BANGALORE", 612, "INR", "Travel"),
  T("2026-10-20", "Zoho Books", "ZOHO CORPORATION BOOKS CHENNAI", 4999, "INR", "Tech & software"),
  T("2026-10-21", "MakeMyTrip", "MAKEMYTRIP HOTEL BOOKING GURGAON", 12300, "INR", "Travel"),
  T("2026-10-22", "Calendly", "CALENDLY LLC ATLANTA US", 48, "USD", "Tech & software"),
  T("2026-10-24", "Swiggy Instamart", "SWIGGY INSTAMART BANGALORE", 2180, "INR", "Office & admin"),
  T("2026-10-25", "1Password", "1PASSWORD BUSINESS ANNUAL TORONTO CA", 1428, "USD", "Tech & software"),
  T("2026-10-27", "WeWork", "WEWORK DAY PASS BANGALORE", 1500, "INR", "Office & admin"),
  T("2026-10-28", "Loom", "LOOM INC SAN FRANCISCO US", 75, "USD", "Tech & software"),
  T("2026-10-31", "Card markup fee", "FOREIGN CURRENCY MARKUP FEE 3.5%", 19882.11, "INR", "Bank & card fees"),
  T("2026-10-31", "IGST on markup", "IGST @18% ON MARKUP FEE", 3578.78, "INR", "Bank & card fees"),
];
await call("add_transactions", { transactions: lines });
await call("add_transactions", { transactions: lines.slice(0, 3) }); // re-send: should skip duplicates

const S = (vendor, category, amount, currency, billing_cycle, last_charged, plan) => ({ vendor, category, amount, currency, billing_cycle, last_charged, ...(plan ? { plan } : {}) });
await call("add_subscriptions", {
  subscriptions: [
    S("Google Workspace", "Productivity", 16560, "INR", "monthly", "2026-10-02"),
    S("Slack", "Communication", 218.75, "USD", "monthly", "2026-10-03"),
    S("Notion", "Productivity", 300, "USD", "monthly", "2026-10-04"),
    S("Figma", "Design", 225, "USD", "monthly", "2026-10-05"),
    S("Canva", "Design", 3999, "INR", "monthly", "2026-10-06"),
    S("GitHub", "Engineering", 84, "USD", "monthly", "2026-10-07"),
    S("AWS", "Cloud & Hosting", 1842.37, "USD", "monthly", "2026-10-08"),
    S("Vercel", "Cloud & Hosting", 60, "USD", "monthly", "2026-10-09"),
    S("HubSpot", "Sales & CRM", 890, "USD", "monthly", "2026-10-10"),
    S("Zoom", "Communication", 149.9, "USD", "monthly", "2026-10-11"),
    S("Miro", "Design", 80, "USD", "monthly", "2026-10-12"),
    S("Claude Team", "AI tools", 150, "USD", "monthly", "2026-10-14"),
    S("JetBrains", "Engineering", 779, "USD", "annual", "2026-10-15", "All Products Pack"),
    S("Linear", "Engineering", 96, "USD", "monthly", "2026-10-18"),
    S("Zoho Books", "Finance & HR", 4999, "INR", "monthly", "2026-10-20"),
    S("Calendly", "Productivity", 48, "USD", "monthly", "2026-10-22"),
    S("1Password", "Security & IT", 1428, "USD", "annual", "2025-11-12", "Business"),
    S("Loom", "Communication", 75, "USD", "monthly", "2026-10-28"),
  ],
});
await call("set_bucket_owner", { bucket: "Marketing", owner: "Priya Nair" });
await call("get_monthly_spend", {});
await call("update_subscription", { vendor: "Miro", status: "cancelling", notes: "Overlaps with Figma" });
await call("get_spend_summary", {});
await client.close();
