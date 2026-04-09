"use client";

import { cn } from "@/lib/utils";

type UserAvatarCircleProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  email?: string | null;
  /** When name/email are empty, first character of this string (e.g. user id). */
  fallbackKey?: string | null;
  /** Size and outer shape, e.g. `size-9` or `size-10 border-2 border-background`. */
  className: string;
  /** Styles for the initial-letter fallback (background, text size, colors). */
  fallbackClassName: string;
};

/**
 * Profile photo when `avatar_url` is set; otherwise a circle with the first initial.
 */
export function UserAvatarCircle({
  avatarUrl,
  displayName,
  email,
  fallbackKey,
  className,
  fallbackClassName,
}: UserAvatarCircleProps) {
  const url = avatarUrl?.trim();
  const letterSource =
    displayName?.trim() || email?.trim() || fallbackKey?.trim() || "?";
  const initial = (letterSource.charAt(0) || "?").toUpperCase();

  const base = cn("shrink-0 overflow-hidden rounded-full", className);

  if (url) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element -- public profile URL */}
        <img src={url} alt="" className="size-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        base,
        "flex items-center justify-center font-bold uppercase shadow-inner",
        fallbackClassName,
      )}
    >
      {initial}
    </div>
  );
}
