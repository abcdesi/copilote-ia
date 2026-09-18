"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function TimezoneBootstrap({
  currentTimezone,
  canSet,
}: {
  currentTimezone: string | null;
  canSet: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (currentTimezone || !canSet) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    const controller = new AbortController();
    void fetch("/api/company/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (result?.changed) router.refresh();
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [canSet, currentTimezone, router]);

  return null;
}
