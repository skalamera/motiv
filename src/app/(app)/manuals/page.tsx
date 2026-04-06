import { ManualsView } from "@/components/manuals/manuals-view";

export default function ManualsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User manuals</h1>
        <p className="text-muted-foreground text-sm">
          Read your uploaded PDFs here and ask Motiv questions about them.
        </p>
      </div>
      <ManualsView />
    </div>
  );
}
