"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the reader's own timezone.
 *
 * Formatting on the server would use the server's clock (UTC in
 * production), so an owner in Memphis would see their responses stamped
 * five or six hours off. The first paint keeps the raw ISO date to match
 * what the server sent, then swaps to local time once mounted.
 */
export function LocalTime({ iso }: { iso: string }) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    setLocal(new Date(iso).toLocaleString());
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {local ?? iso.slice(0, 16).replace("T", " ")}
    </time>
  );
}
