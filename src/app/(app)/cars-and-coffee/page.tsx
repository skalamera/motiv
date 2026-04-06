import { createClient } from "@/lib/supabase/server";
import { RedirectType, redirect } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

const statesMap = [
  { name: "Alabama", abbr: "AL" }, { name: "Alaska", abbr: "AK" }, { name: "Arizona", abbr: "AZ" },
  { name: "Arkansas", abbr: "AR" }, { name: "California", abbr: "CA" }, { name: "Colorado", abbr: "CO" },
  { name: "Connecticut", abbr: "CT" }, { name: "Delaware", abbr: "DE" }, { name: "Florida", abbr: "FL" },
  { name: "Georgia", abbr: "GA" }, { name: "Hawaii", abbr: "HI" }, { name: "Idaho", abbr: "ID" },
  { name: "Illinois", abbr: "IL" }, { name: "Indiana", abbr: "IN" }, { name: "Iowa", abbr: "IA" },
  { name: "Kansas", abbr: "KS" }, { name: "Kentucky", abbr: "KY" }, { name: "Louisiana", abbr: "LA" },
  { name: "Maine", abbr: "ME" }, { name: "Maryland", abbr: "MD" }, { name: "Massachusetts", abbr: "MA" },
  { name: "Michigan", abbr: "MI" }, { name: "Minnesota", "abbr": "MN" }, { name: "Mississippi", abbr: "MS" },
  { name: "Missouri", abbr: "MO" }, { name: "Montana", abbr: "MT" }, { name: "Nebraska", abbr: "NE" },
  { name: "Nevada", abbr: "NV" }, { name: "New Hampshire", abbr: "NH" }, { name: "New Jersey", abbr: "NJ" },
  { name: "New Mexico", abbr: "NM" }, { name: "New York", abbr: "NY" }, { name: "North Carolina", abbr: "NC" },
  { name: "North Dakota", abbr: "ND" }, { name: "Ohio", abbr: "OH" }, { name: "Oklahoma", abbr: "OK" },
  { name: "Oregon", abbr: "OR" }, { name: "Pennsylvania", abbr: "PA" }, { name: "Rhode Island", abbr: "RI" },
  { name: "South Carolina", abbr: "SC" }, { name: "South Dakota", abbr: "SD" }, { name: "Tennessee", abbr: "TN" },
  { name: "Texas", abbr: "TX" }, { name: "Utah", abbr: "UT" }, { name: "Vermont", abbr: "VT" },
  { name: "Virginia", abbr: "VA" }, { name: "Washington", abbr: "WA" }, { name: "West Virginia", abbr: "WV" },
  { name: "Wisconsin", abbr: "WI" }, { name: "Wyoming", abbr: "WY" }
];

function extractStateSlug(address: string | null): string | null {
  if (!address) return null;
  const lower = address.toLowerCase();

  for (const state of statesMap) {
    // Check for full name
    if (lower.includes(state.name.toLowerCase())) {
      return state.name.toLowerCase().replace(/\s+/g, "-");
    }
    
    // Check for abbreviation with word boundaries (e.g., " NY ", ", NY", "NY 10001")
    const abbrRegex = new RegExp(`\\b${state.abbr}\\b`, "i");
    if (abbrRegex.test(address)) {
      return state.name.toLowerCase().replace(/\s+/g, "-");
    }
  }

  return null;
}

import { CarsAndCoffeeView } from "@/components/cars-and-coffee/cars-and-coffee-view";
import type { Profile } from "@/types/database";

export default async function CarsAndCoffeePage() {
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

  const stateSlug = extractStateSlug(profile?.location_address);

  if (!stateSlug) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="text-center max-w-md space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Location Required</h2>
          <p className="text-muted-foreground">
            We need to know your state to show local Cars and Coffee events. Please update your home address or state in Settings.
          </p>
          <Link href="/settings" className={buttonVariants()}>
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  const iframeUrl = `https://carsandcoffeeevents.com/${stateSlug}-car-and-bike-events/`;

  return <CarsAndCoffeeView iframeUrl={iframeUrl} stateSlug={stateSlug} currentUser={profile as Profile} />;
}
