"use client";
import { useRef } from "react";

export function BucketSelect({ id, value, buckets, action, returnTo }: { id: string; value: string; buckets: readonly string[]; action: (f: FormData) => Promise<void>; returnTo: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form action={action} ref={ref} className="bucket-select">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="return" value={returnTo} />
      <select name="bucket" defaultValue={value} aria-label="Bucket" onChange={() => ref.current?.requestSubmit()}>
        {buckets.map((b) => <option key={b}>{b}</option>)}
      </select>
    </form>
  );
}
