"use client";

import { useState } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="motiv-mesh-bg bg-background flex min-h-screen md:h-[100dvh] md:max-h-[100dvh] md:overflow-hidden">
      <div className="hidden shrink-0 md:flex md:h-full md:self-stretch">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col md:min-h-0 md:h-full md:overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4 backdrop-blur-xl md:hidden">
          <Sheet open={mobileNav} onOpenChange={setMobileNav}>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              onClick={() => setMobileNav(true)}
            >
              <Menu className="size-5" />
            </Button>
            <SheetContent side="left" className="w-64 p-0">
              <AppSidebar
                collapsed={false}
                onToggleCollapse={() => {}}
                showCollapseToggle={false}
                onNavigate={() => setMobileNav(false)}
              />
            </SheetContent>
          </Sheet>
          <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-semibold tracking-tight text-transparent">
            motiv
          </span>
          <ThemeToggle />
        </header>

        <header className="hidden h-12 shrink-0 items-center justify-end border-b border-border/50 px-4 backdrop-blur-xl md:flex">
          <ThemeToggle />
        </header>

        <main className="flex-1 min-h-0 p-4 md:overflow-y-auto md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative rounded-xl text-muted-foreground hover:text-foreground"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={() =>
        setTheme(resolvedTheme === "dark" ? "light" : "dark")
      }
    >
      <Sun
        className={cn(
          "size-[18px] transition-all duration-300",
          resolvedTheme === "dark" ? "scale-0 rotate-90" : "scale-100 rotate-0",
        )}
      />
      <Moon
        className={cn(
          "absolute size-[18px] transition-all duration-300",
          resolvedTheme === "dark" ? "scale-100 rotate-0" : "scale-0 -rotate-90",
        )}
      />
    </Button>
  );
}
