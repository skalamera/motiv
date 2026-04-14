"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Wrench,
  Gauge,
  Flame,
  AlertTriangle,
  Newspaper,
  Rss,
  Video,
  MapPin,
  Library,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  ChevronDown,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { AppAccountNav } from "@/components/app-account-nav";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Ask Motiv", icon: MessageSquare },
  { href: "/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/upgrades", label: "Upgrade Advisor", icon: Gauge },
  { href: "/west-coast-customs", label: "Customize", icon: Flame },
  { href: "/manuals", label: "Library", icon: Library },
  { href: "/recalls", label: "Recalls", icon: AlertTriangle },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/videos", label: "Videos", icon: Video },
  { href: "/local-drives", label: "Local Drives", icon: MapPin },
  { href: "/local-shops", label: "Local Shops", icon: Building2 },
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
  const [porscheExclusivesOpen, setPorscheExclusivesOpen] = useState(true);
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

  useEffect(() => {
    if (
      pathname === "/pca" ||
      pathname.startsWith("/pca/") ||
      pathname === "/rennlist-today" ||
      pathname.startsWith("/rennlist-today/")
    ) {
      setPorscheExclusivesOpen(true);
    }
  }, [pathname]);

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
      <div className="border-sidebar-border/50 shrink-0 border-b">
        <div className={cn("px-2 py-2", collapsed && "px-1.5")}>
          <AppAccountNav
            collapsed={collapsed}
            onItemClick={onNavigate}
          />
        </div>
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
                <span className="flex-1 text-left">
                  {!collapsed ? label : null}
                </span>
              </Link>
            );
          })}
          <Link
            href="/cars-and-coffee"
            title={collapsed ? "Cars & Coffee" : undefined}
            onClick={() => onNavigate?.()}
            className={cn(
              "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-all duration-200",
              pathname === "/cars-and-coffee" || pathname.startsWith("/cars-and-coffee/")
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            {pathname === "/cars-and-coffee" || pathname.startsWith("/cars-and-coffee/") ? (
              <span className="bg-primary absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/carscoffee.svg"
              alt="Cars & Coffee"
              className={cn(
                "size-[22px] shrink-0 transition-colors opacity-70 group-hover:opacity-100 dark:invert",
                (pathname === "/cars-and-coffee" || pathname.startsWith("/cars-and-coffee/")) && "opacity-100",
                collapsed && "size-6"
              )}
            />
            {!collapsed ? "Cars & Coffee" : null}
          </Link>
          {hasPorsche ? (
            collapsed ? (
              <>
                <Link
                  href="/pca"
                  title="PCA"
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "group relative flex items-center justify-center gap-2.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-all duration-200",
                    pathname === "/pca" || pathname.startsWith("/pca/")
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {pathname === "/pca" || pathname.startsWith("/pca/") ? (
                    <span className="bg-primary absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                  ) : null}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/pca.svg"
                    alt=""
                    className={cn(
                      "size-6 shrink-0 transition-colors opacity-70 group-hover:opacity-100",
                      (pathname === "/pca" || pathname.startsWith("/pca/")) &&
                        "opacity-100 invert-[.4] sepia-[1] saturate-[5] hue-rotate-[190deg]",
                    )}
                  />
                </Link>
                <Link
                  href="/rennlist-today"
                  title="Rennlist today"
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "group relative flex items-center justify-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-all duration-200",
                    pathname === "/rennlist-today" ||
                      pathname.startsWith("/rennlist-today/")
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {pathname === "/rennlist-today" ||
                  pathname.startsWith("/rennlist-today/") ? (
                    <span className="bg-primary absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                  ) : null}
                  <Rss
                    className={cn(
                      "size-[18px] shrink-0 transition-colors",
                      (pathname === "/rennlist-today" ||
                        pathname.startsWith("/rennlist-today/")) &&
                        "text-primary",
                    )}
                  />
                </Link>
              </>
            ) : (
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => setPorscheExclusivesOpen((o) => !o)}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold tracking-wide uppercase transition-colors"
                  aria-expanded={porscheExclusivesOpen}
                >
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 transition-transform duration-200",
                      !porscheExclusivesOpen && "-rotate-90",
                    )}
                    aria-hidden
                  />
                  <span className="leading-tight">Porsche Owner Exclusives</span>
                </button>
                {porscheExclusivesOpen ? (
                  <div className="border-border/40 ml-2 flex flex-col gap-1 border-l pl-2">
                    <Link
                      href="/pca"
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
                        pathname === "/pca" || pathname.startsWith("/pca/")
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {pathname === "/pca" || pathname.startsWith("/pca/") ? (
                        <span className="bg-primary absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                      ) : null}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/pca.svg"
                        alt=""
                        className={cn(
                          "size-[22px] shrink-0 transition-colors opacity-70 group-hover:opacity-100",
                          (pathname === "/pca" ||
                            pathname.startsWith("/pca/")) &&
                            "opacity-100 invert-[.4] sepia-[1] saturate-[5] hue-rotate-[190deg]",
                        )}
                      />
                      <span className="flex-1 text-left">PCA</span>
                    </Link>
                    <Link
                      href="/rennlist-today"
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200",
                        pathname === "/rennlist-today" ||
                          pathname.startsWith("/rennlist-today/")
                          ? "bg-primary/10 text-primary shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {pathname === "/rennlist-today" ||
                      pathname.startsWith("/rennlist-today/") ? (
                        <span className="bg-primary absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full" />
                      ) : null}
                      <Rss
                        className={cn(
                          "size-[18px] shrink-0 transition-colors",
                          (pathname === "/rennlist-today" ||
                            pathname.startsWith("/rennlist-today/")) &&
                            "text-primary",
                        )}
                      />
                      <span className="flex-1 text-left">Rennlist today</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </nav>
      </ScrollArea>

      {showCollapseToggle ? (
        <div
          className={cn(
            "border-sidebar-border/50 hidden shrink-0 border-t px-2 py-2 md:flex",
            collapsed ? "justify-center" : "justify-end",
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        </div>
      ) : null}

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
