"use client";

import { useRef } from "react";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { CarSelector, carDisplayName } from "@/components/car-selector";
import type { Car } from "@/types/database";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  carId: string | null;
  car: Car | null;
  baseImageUrl: string | null;
  generatingStock: boolean;
  onCarChange: (id: string | null) => void;
  onImageSelected: (url: string, source: "profile" | "upload" | "generated") => void;
};

export function BuildHero({
  carId,
  car,
  baseImageUrl,
  generatingStock,
  onCarChange,
  onImageSelected,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onImageSelected(reader.result, "upload");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div>
      {/* Car name — above the image */}
      {baseImageUrl && car && !generatingStock ? (
        <div className="px-3 pb-2 pt-3 sm:px-4">
          <p
            className="wcc-neon-orange text-lg font-black uppercase tracking-wide sm:text-2xl lg:text-3xl"
            style={{ color: "oklch(0.7 0.25 40)" }}
          >
            {carDisplayName(car)}
          </p>
        </div>
      ) : null}

      {/* Car image — cinematic, full bleed */}
      <div className="wcc-scanlines relative aspect-[16/9] w-full overflow-hidden sm:aspect-[21/9] lg:aspect-[24/9]">
        <AnimatePresence mode="wait">
          {generatingStock ? (
            <motion.div
              key="gen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex size-full flex-col items-center justify-center gap-3"
              style={{ background: "oklch(0.06 0.015 270)" }}
            >
              <Loader2 className="size-10 animate-spin" style={{ color: "oklch(0.7 0.25 40)" }} />
              <p className="ai-thinking text-xs uppercase tracking-widest text-muted-foreground">
                Loading Garage...
              </p>
            </motion.div>
          ) : baseImageUrl ? (
            <motion.img
              key={baseImageUrl}
              src={baseImageUrl}
              alt={car ? carDisplayName(car) : "Car"}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="size-full object-cover"
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex size-full flex-col items-center justify-center gap-4"
              style={{ background: "oklch(0.06 0.015 270)" }}
            >
              <p className="wcc-neon-orange text-xl font-black uppercase tracking-widest" style={{ color: "oklch(0.7 0.25 40)" }}>
                Select Your Ride
              </p>
              <p className="text-xs text-muted-foreground">Choose a car to enter the garage</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom gradient fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[oklch(0.06_0.015_270)] to-transparent" />

        {/* Image swap buttons — top right */}
        {carId && baseImageUrl && !generatingStock ? (
          <div className="absolute right-3 top-3 z-10 flex gap-1.5">
            {car?.image_url ? (
              <button
                type="button"
                onClick={() => onImageSelected(car.image_url!, "profile")}
                className="wcc-hud flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 transition-colors hover:text-white active:scale-95"
              >
                <Camera className="size-3" />
                Profile
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="wcc-hud flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/80 transition-colors hover:text-white active:scale-95"
            >
              <ImagePlus className="size-3" />
              Upload
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </div>
        ) : null}
      </div>

      {/* Car selector — below the image, normal flow */}
      <div className="px-3 pt-4 pb-2 sm:px-6">
        <div className="mx-auto max-w-md">
          <CarSelector
            value={carId}
            onChange={onCarChange}
            label=""
            className="[&_button]:wcc-hud [&_button]:border-[oklch(0.7_0.25_40_/_0.2)] [&_button]:text-white"
            selectContentClassName="dark"
          />
        </div>
      </div>
    </div>
  );
}
