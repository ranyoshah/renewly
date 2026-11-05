"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function MonthPicker({ month, options, prev, next }: { month: string; options: { value: string; label: string }[]; prev: string; next: string }) {
  const router = useRouter();
  return (
    <div className="month-picker">
      <Link className="btn secondary small" href={`/dashboard/month?m=${prev}`} aria-label="Previous month">‹</Link>
      <select aria-label="Choose month" value={month} onChange={(e) => router.push(`/dashboard/month?m=${e.target.value}`)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Link className="btn secondary small" href={`/dashboard/month?m=${next}`} aria-label="Next month">›</Link>
    </div>
  );
}
