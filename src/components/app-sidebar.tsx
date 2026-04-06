"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Gauge,
  AlertTriangle,
  Newspaper,
  Video,
  MapPin,
  BookOpen,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Ask Motiv", icon: MessageSquare },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/upgrades", label: "Upgrades", icon: Gauge },
  { href: "/manuals", label: "User manuals", icon: BookOpen },
  { href: "/recalls", label: "Recalls", icon: AlertTriangle },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/local-drives", label: "Local Drives", icon: MapPin },
  { href: "/settings", label: "Settings", icon: Settings },
];

type AppSidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  showCollapseToggle?: boolean;
  onNavigate?: () => void;
};

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  showCollapseToggle = true,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasPorsche, setHasPorsche] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    void supabase
      .from("cars")
      .select("make")
      .then(({ data }) => {
        if (data && data.some(car => car.make.toLowerCase() === "porsche")) {
          setHasPorsche(true);
        }
      });
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "bg-sidebar flex h-full flex-col border-r border-sidebar-border/50 transition-[width] duration-250 ease-out",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3">
        {collapsed ? (
          <Link href="/" className="flex flex-1 justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_border_no_text.svg"
              alt="Motiv"
              width={40}
              height={40}
              className="h-9 w-9 shrink-0 object-contain dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/motiv_dark_notext.svg"
              alt="Motiv"
              width={40}
              height={40}
              className="hidden h-9 w-9 shrink-0 object-contain dark:block"
            />
          </Link>
        ) : (
          <Link href="/" className="flex flex-1 items-center justify-center py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_border_no_text.svg"
              alt="Motiv"
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 object-contain dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/motiv_dark_notext.svg"
              alt="Motiv"
              width={40}
              height={40}
              className="hidden h-10 w-10 shrink-0 object-contain dark:block"
            />
          </Link>
        )}
        {showCollapseToggle ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                onClick={() => onNavigate?.()}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                {active && (
                  <span className="bg-primary absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                )}
                <Icon className={cn("size-[18px] shrink-0 transition-colors", active && "text-primary")} />
                {!collapsed ? label : null}
              </Link>
            );
          })}
          {hasPorsche ? (
            <Link
              href="/pca"
              title={collapsed ? "PCA" : undefined}
              onClick={() => onNavigate?.()}
              className={cn(
                "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200",
                pathname === "/pca" || pathname.startsWith("/pca/")
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed && "justify-center px-2",
              )}
            >
              {pathname === "/pca" || pathname.startsWith("/pca/") ? (
                <span className="bg-primary absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pca.svg"
                alt="PCA"
                className={cn(
                  "size-[22px] shrink-0 transition-colors opacity-70 group-hover:opacity-100",
                  (pathname === "/pca" || pathname.startsWith("/pca/")) && "opacity-100 invert-[.4] sepia-[1] saturate-[5] hue-rotate-[190deg]",
                  collapsed && "size-6"
                )}
              />
              {!collapsed ? "PCA" : null}
            </Link>
          ) : null}
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border/50 p-2">
        <Button
          variant="ghost"
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "text-muted-foreground hover:text-destructive w-full justify-start gap-3 rounded-xl",
            collapsed && "justify-center px-0",
          )}
          onClick={() => void signOut()}
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed ? "Sign out" : null}
        </Button>
      </div>
    </aside>
  );
}
