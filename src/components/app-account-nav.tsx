"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, CarFront, Users, Cog } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const items = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/garage", label: "Garage", icon: CarFront },
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/settings", label: "Settings", icon: Cog },
] as const;

export function AppAccountNav({
  className,
  collapsed = false,
  onItemClick,
}: {
  className?: string;
  /** When true (narrow sidebar), stack icons vertically */
  collapsed?: boolean;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      Promise.all([
        supabase
          .from("friends")
          .select("*", { count: "exact", head: true })
          .eq("friend_id", user.id)
          .eq("status", "pending"),
        supabase
          .from("event_invites")
          .select("*", { count: "exact", head: true })
          .eq("invitee_id", user.id)
          .eq("status", "pending"),
      ]).then(([friendsRes, invitesRes]) => {
        const friendCount = friendsRes.count ?? 0;
        const inviteCount = invitesRes.count ?? 0;
        setPendingInvitesCount(friendCount + inviteCount);
      });
    });
  }, []);

  return (
    <nav
      className={cn(
        collapsed
          ? "flex flex-col items-center gap-1"
          : "grid w-full grid-cols-4 gap-1",
        className,
      )}
      aria-label="Account and crew"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href || pathname.startsWith(`${href}/`);
        const showCrewBadge = label === "Crew" && pendingInvitesCount > 0;
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => onItemClick?.()}
            className={cn(
              "relative flex shrink-0 items-center justify-center rounded-xl text-sm transition-colors",
              collapsed ? "size-9" : "h-10 w-full",
              active
                ? "bg-primary/15 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" />
            {showCrewBadge ? (
              <span className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full border-2 border-background px-0.5 text-[9px] font-bold leading-none">
                {pendingInvitesCount > 9 ? "9+" : pendingInvitesCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
