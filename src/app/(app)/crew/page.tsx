import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CrewView } from "@/components/crew/crew-view";
import type { Profile } from "@/types/database";

export default async function CrewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Your Crew</h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Add members to your Crew, view pending invitations, and respond to event invites.
        </p>
      </div>
      <CrewView currentUser={profile as Profile} />
    </div>
  );
}
