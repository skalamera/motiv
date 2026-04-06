"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signError) throw signError;
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="gradient-border w-full max-w-md border border-border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
      <CardHeader className="space-y-4 text-center">
        <Link href="/" className="mx-auto block">
          {/* Light mode: wordmark; dark mode: mark only */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_full.svg"
            alt="Motiv"
            width={200}
            height={80}
            className="mx-auto h-auto w-auto max-w-[200px] rounded-none dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/motiv.svg?v=2"
            alt="Motiv"
            width={192}
            height={192}
            className="mx-auto hidden h-auto w-48 rounded-none dark:block"
          />
        </Link>
        <CardDescription className="text-muted-foreground">
          Sign in to manage your vehicles and ask Motiv anything.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-destructive text-center text-sm">{error}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-background/50"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="ai-gradient glow-primary w-full rounded-xl border-0 text-white shadow-md hover:opacity-90 disabled:opacity-50" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            No account?{" "}
            <Link href="/signup" className="text-primary font-medium underline">
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
