import { VideosView } from "@/components/videos/videos-view";

export default function VideosPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Videos</h1>
        <p className="text-muted-foreground text-sm">
          Random YouTube videos personalized from your garage&apos;s makes and models.
        </p>
      </div>
      <VideosView />
    </div>
  );
}
