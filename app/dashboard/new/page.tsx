import Link from "next/link";
import { requireWorkspace } from "@/lib/auth";
import { SubForm } from "@/components/SubForm";
import { addSubscription } from "../../actions";

export const metadata = { title: "Add subscription" };

export default async function NewSub({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ws = await requireWorkspace();
  const { error } = await searchParams;
  return (
    <>
      <p className="small"><Link href="/dashboard">← Overview</Link></p>
      <h1>Add a subscription</h1>
      <section className="panel">
        {error && <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
        <SubForm action={addSubscription} submitLabel="Add subscription" base={ws.base_currency} />
      </section>
    </>
  );
}
