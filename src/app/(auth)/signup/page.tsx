"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [retryUntilMs, setRetryUntilMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!retryUntilMs) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [retryUntilMs]);

  const retrySeconds = useMemo(() => {
    if (!retryUntilMs) return 0;
    return Math.max(0, Math.ceil((retryUntilMs - nowMs) / 1000));
  }, [retryUntilMs, nowMs]);

  const inCooldown = retrySeconds > 0;

  function friendlySignupError(err: unknown): string {
    const raw = err instanceof Error ? err.message : "Sign up failed";
    const m = raw.toLowerCase();
    if (m.includes("email rate limit exceeded")) {
      return "Too many signup attempts right now. Please wait about a minute and try again, or sign in if the account already exists.";
    }
    return raw;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inCooldown) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || undefined },
        },
      });
      if (signError) throw signError;
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = friendlySignupError(err);
      setError(msg);
      if (msg.toLowerCase().includes("too many signup attempts")) {
        setRetryUntilMs(Date.now() + 60_000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="gradient-border w-full max-w-md border border-border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
      <CardHeader className="space-y-4 text-center">
        <Link href="/" className="mx-auto block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/motiv.svg?v=2"
            alt="Motiv"
            width={192}
            height={192}
            className="mx-auto h-auto w-48 rounded-none"
          />
        </Link>
        <CardDescription className="text-muted-foreground">
          Create your account. Your profile is created automatically.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-destructive text-center text-sm">{error}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">
              Display name
            </Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-background/50"
              placeholder="Alex"
            />
          </div>
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-background/50"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="submit"
            className="ai-gradient glow-primary w-full rounded-xl border-0 text-white shadow-md hover:opacity-90 disabled:opacity-50"
            disabled={loading || inCooldown}
          >
            {loading
              ? "Creating account…"
              : inCooldown
                ? `Please wait ${retrySeconds}s`
                : "Create account"}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-medium underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
