"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  Wrench,
  AlertTriangle,
  Newspaper,
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
  { href: "/recalls", label: "Recalls", icon: AlertTriangle },
  { href: "/news", label: "News", icon: Newspaper },
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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "border-sidebar-border bg-sidebar/80 flex h-full flex-col border-r backdrop-blur-xl transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-white/5 px-3">
        {collapsed ? (
          <Link href="/" className="flex flex-1 justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_border_no_text.svg"
              alt="Motiv"
              width={40}
              height={40}
              className="h-9 w-9 rounded-lg"
            />
          </Link>
        ) : (
          <Link href="/" className="flex flex-1 items-center justify-center py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_full.svg"
              alt="Motiv"
              width={160}
              height={56}
              className="h-10 w-auto max-w-[140px]"
            />
          </Link>
        )}
        {showCollapseToggle ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-0.5 px-2">
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
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary/15 text-sidebar-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  collapsed && "justify-center px-2",
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {!collapsed ? label : null}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />
      <div className="p-2">
        <Button
          variant="ghost"
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "text-muted-foreground hover:text-destructive w-full justify-start gap-3",
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
