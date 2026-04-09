import { getDashboardCars } from "@/lib/data/cars";
import { DashboardHome } from "@/components/dashboard/dashboard-home";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const [data, supabase] = await Promise.all([
    getDashboardCars(),
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profileGreeting: {
    displayName: string | null;
    avatarUrl: string | null;
  } = { displayName: null, avatarUrl: null };

  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    if (prof) {
      profileGreeting = {
        displayName: (prof as { display_name?: string | null }).display_name ?? null,
        avatarUrl: (prof as { avatar_url?: string | null }).avatar_url ?? null,
      };
    }
  }

  return (
    <DashboardHome data={data} profileGreeting={profileGreeting} />
  );
}
