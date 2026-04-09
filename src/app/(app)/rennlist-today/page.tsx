import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { userHasPorscheInGarage } from "@/lib/data/cars";
import { RennlistTodayFeed } from "@/components/rennlist/rennlist-today-feed";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rennlist - today's posts",
  description:
    "991.2 / 991-forum threads with activity today on Rennlist (Porsche owners).",
};

export default async function RennlistTodayPage() {
  let hasPorsche = false;
  try {
    hasPorsche = await userHasPorscheInGarage();
  } catch {
    hasPorsche = false;
  }

  if (!hasPorsche) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Rennlist today</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          This reader is available when you have a{" "}
          <strong className="text-foreground font-medium">Porsche</strong> in your
          garage. Rennlist is a Porsche community forum - add your car with make{" "}
          <strong className="text-foreground font-medium">Porsche</strong> to
          unlock this page.
        </p>
        <Link href="/garage" className={cn(buttonVariants(), "inline-flex")}>
          Open Garage
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <div className="border-border/50 relative mb-2 aspect-[16/10] max-h-80 w-full overflow-hidden rounded-xl border bg-muted sm:aspect-[2/1] sm:max-h-96">
        <Image
          src="/rennlist-hero.png"
          alt="Porsche sports car on the road"
          fill
          className="object-cover object-[center_45%]"
          sizes="(max-width: 768px) 100vw, 768px"
          priority
        />
      </div>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Rennlist today</h1>
        <p className="text-muted-foreground text-sm">
          Filtered to <span className="text-foreground font-medium">991.2</span>{" "}
          and other{" "}
          <span className="text-foreground font-medium">991-generation</span>{" "}
          forums and titles (today&apos;s activity).
        </p>
      </div>
      <RennlistTodayFeed />
    </div>
  );
}
