const CONSOLE_MAPS = "https://console.cloud.google.com/google/maps-apis";

/**
 * Shown when Maps JS fails to authenticate (billing, API enablement, key restrictions).
 */
export function MapsLoadFailureCard({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "border-amber-500/40 bg-amber-500/5 text-foreground rounded-xl border p-4 text-sm"
      }
    >
      <p className="font-medium text-foreground">
        Google Maps couldn&apos;t load with this API key
      </p>
      <p className="mt-2 text-xs leading-relaxed">
        In{" "}
        <a
          href={CONSOLE_MAPS}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          Google Cloud Console
        </a>
        , confirm for the project that owns your key:
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
        <li>
          <strong className="text-foreground">Billing</strong> is enabled (Maps requires a
          billed account; there is a monthly free credit).
        </li>
        <li>
          <strong className="text-foreground">Maps JavaScript API</strong> is enabled for
          that project.
        </li>
        <li>
          <strong className="text-foreground">API key restrictions</strong>: under
          Application restrictions → <em>HTTP referrers</em>, add your app origins, e.g.{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[0.7rem]">
            https://your-domain.vercel.app/*
          </code>
          ,{" "}
          <code className="bg-muted rounded px-1 py-0.5 text-[0.7rem]">
            http://localhost:3000/*
          </code>{" "}
          for local dev. Save and wait a few minutes for changes to apply.
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Set <code className="bg-muted rounded px-1 py-0.5">GOOGLE_MAPS_API</code>{" "}
        in Vercel → Project → Environment Variables, then redeploy. See{" "}
        <a
          href="https://developers.google.com/maps/documentation/javascript/get-api-key"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          Get an API key
        </a>
        .
      </p>
    </div>
  );
}
