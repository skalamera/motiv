"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { MaintenanceTracker } from "@/components/maintenance/maintenance-tracker";

function Inner() {
  const sp = useSearchParams();
  return <MaintenanceTracker initialCarId={sp.get("car")} />;
}

export default function MaintenancePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Maintenance</h1>
        <p className="text-muted-foreground text-sm">
          AI-generated factory-style schedules, your custom intervals, and
          service logs per vehicle.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <Inner />
      </Suspense>
    </div>
  );
}
