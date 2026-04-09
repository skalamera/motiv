"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Trash2 } from "lucide-react";

export function AccountSettingsView() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function changePassword() {
    setPasswordMessage(null);
    if (newPassword.length < 8) {
      setPasswordMessage("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      setPasswordMessage(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password updated.");
  }

  async function deleteAccount() {
    if (deleteConfirm.trim().toUpperCase() !== "DELETE") return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(j.error ?? "Could not delete account.");
        return;
      }
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setDeleteConfirm("");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Account security and data.
        </p>
      </div>

      <Card className="border border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            Set a new password for your Motiv account. You must be signed in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-background/50 max-w-md"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="bg-background/50 max-w-md"
            />
          </div>
          {passwordMessage ? (
            <p
              className={
                passwordMessage === "Password updated."
                  ? "text-sm text-emerald-600 dark:text-emerald-400"
                  : "text-destructive text-sm"
              }
            >
              {passwordMessage}
            </p>
          ) : null}
          <Button
            onClick={() => void changePassword()}
            disabled={savingPassword || !newPassword}
          >
            {savingPassword ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Update password"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently remove your account and sign out. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="mr-2 size-4" />
            Delete account…
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Type <span className="text-foreground font-mono">DELETE</span> to
              confirm. Your garage data and profile may be removed according to
              your project&apos;s database rules.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="DELETE"
            className="font-mono"
            autoComplete="off"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                deleting || deleteConfirm.trim().toUpperCase() !== "DELETE"
              }
              onClick={() => void deleteAccount()}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Delete forever"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
