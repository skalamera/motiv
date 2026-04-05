"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RecallsView } from "@/components/recalls/recalls-view";

function Inner() {
  const sp = useSearchParams();
  return <RecallsView initialCarId={sp.get("car")} />;
}

export default function RecallsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recalls & campaigns</h1>
        <p className="text-muted-foreground text-sm">
          Pulled from the NHTSA recalls API for your vehicle&apos;s make, model,
          and year. Always confirm with a dealer or{" "}
          <a
            href="https://www.nhtsa.gov/recalls"
            className="text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            NHTSA
          </a>
          .
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <Inner />
      </Suspense>
    </div>
  );
}
