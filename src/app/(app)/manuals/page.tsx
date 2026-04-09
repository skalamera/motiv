import { ManualsView } from "@/components/manuals/manuals-view";

export default function ManualsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Library</h1>
        <p className="text-muted-foreground text-sm">
          Owner&apos;s manual, maintenance/service references, and other files per
          vehicle. Ask Motiv about owner&apos;s manuals from here.
        </p>
      </div>
      <ManualsView />
    </div>
  );
}
