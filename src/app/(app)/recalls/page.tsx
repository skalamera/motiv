"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RecallsView } from "@/components/recalls/recalls-view";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function Inner() {
  const sp = useSearchParams();
  return <RecallsView initialCarId={sp.get("car")} />;
}

const NHTSA_EMAIL_SUBSCRIPTIONS = "https://www.nhtsa.gov/email-subscriptions";

export default function RecallsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recalls & campaigns</h1>
        <p className="text-muted-foreground text-sm">
          When you save a valid VIN, we decode it with NHTSA VPIC and query
          recalls (trying VPIC trim codes like E350 when the generic model name
          returns no rows). Otherwise we use your Settings vehicle. Confirm with
          a dealer or{" "}
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

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">NHTSA email subscriptions</CardTitle>
          <CardDescription>
            Sign up on NHTSA.gov for recall notices and updates.{" "}
            <a
              href={NHTSA_EMAIL_SUBSCRIPTIONS}
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Open the subscriptions page in a new tab
            </a>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
