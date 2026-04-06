"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChatInterface } from "@/components/chat/chat-interface";

function ChatInner() {
  const sp = useSearchParams();
  const car = sp.get("car");
  const initialQuery = sp.get("q");
  return <ChatInterface initialCarId={car} initialQuery={initialQuery} />;
}

export default function ChatPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ask Motiv</h1>
        <p className="text-muted-foreground text-sm">
          Guided diagnostics, maintenance from your manual, and web-backed
          forum-style fixes.
        </p>
      </div>
      <Suspense fallback={<div className="text-muted-foreground text-sm">Loading…</div>}>
        <ChatInner />
      </Suspense>
    </div>
  );
}
