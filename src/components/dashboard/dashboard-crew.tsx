"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, MapPin, Calendar, Clock, BellRing, Users } from "lucide-react";
import Link from "next/link";
import { getGoogleMapsApiKey } from "@/lib/maps-config";

export function DashboardCrew() {
  const [pendingFriends, setPendingFriends] = useState<any[]>([]);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // 1. Pending Friend Requests
    const { data: friends } = await supabase
      .from("friends")
      .select('*, user_profile:profiles!friends_user_id_fkey(*)')
      .eq("friend_id", user.id)
      .eq("status", "pending");
    
    // We also need the user's profile information so we don't display "Unknown" if they haven't set their display name yet. Wait, no. The display_name is null by default on new users.
    // If display_name is null or empty, we could show their email, but email is not in the profiles table.
    setPendingFriends(friends || []);

    // 2. Pending Event Invites
    const { data: invites } = await supabase
      .from("event_invites")
      .select('*, event:events!inner(*, creator:profiles!events_creator_id_fkey(*))')
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingEvents(invites || []);

    // 3. Upcoming Events (Attending or Created)
    const now = new Date().toISOString();
    
    // Events I created
    const { data: createdEvts } = await supabase
      .from("events")
      .select('*, creator:profiles!events_creator_id_fkey(*)')
      .eq("creator_id", user.id)
      .gte("start_time", now)
      .order("start_time", { ascending: true });

    // Events I am attending
    const { data: attendingInvs } = await supabase
      .from("event_invites")
      .select('event_id')
      .eq("invitee_id", user.id)
      .eq("status", "attending");
      
    let attendingEvts: any[] = [];
    if (attendingInvs && attendingInvs.length > 0) {
      const eventIds = attendingInvs.map(i => i.event_id);
      const { data: aEvts } = await supabase
        .from("events")
        .select('*, creator:profiles!events_creator_id_fkey(*)')
        .in("id", eventIds)
        .gte("start_time", now)
        .order("start_time", { ascending: true });
      attendingEvts = aEvts || [];
    }

    // Merge and sort
    const allUpcoming = [...(createdEvts || []), ...attendingEvts].sort((a, b) => 
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    
    // Deduplicate in case a user is both creator and invited (shouldn't happen but just in case)
    const uniqueUpcoming = Array.from(new Map(allUpcoming.map(item => [item.id, item])).values());
    
    setUpcomingEvents(uniqueUpcoming);
    setLoading(false);
  }

  async function handleFriend(id: string, action: "accepted" | "declined") {
    if (action === "accepted") {
      await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    } else {
      await supabase.from("friends").delete().eq("id", id);
    }
    loadData();
  }

  async function handleEvent(id: string, action: "attending" | "declined") {
    await supabase.from("event_invites").update({ status: action }).eq("id", id);
    loadData();
  }

  if (loading) return null;

  const hasAlerts = pendingFriends.length > 0 || pendingEvents.length > 0;
  const hasEvents = upcomingEvents.length > 0;

  if (!hasAlerts && !hasEvents) return null;

  return (
    <div className="space-y-6">
      {hasAlerts && (
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="bg-primary/10 border-b border-border/50 px-4 py-3 flex items-center gap-2">
            <BellRing className="size-4 text-primary" />
            <h2 className="font-semibold text-primary">Action Needed</h2>
          </div>
          <CardContent className="p-0 divide-y divide-border/50">
            {pendingFriends.map(f => (
              <div key={f.id} className="p-4 flex items-center justify-between sm:flex-row flex-col gap-3">
                <div className="flex items-center gap-3 self-start">
                  <div className="size-10 rounded-full bg-accent flex items-center justify-center font-bold uppercase shadow-inner text-muted-foreground">
                    {f.user_profile?.display_name?.charAt(0) || f.user_profile?.email?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="text-sm font-medium"><span className="text-foreground">{f.user_profile?.display_name || f.user_profile?.email || "Someone"}</span> sent you a friend request.</p>
                    <p className="text-xs text-muted-foreground">Add them to your Crew to invite them to events.</p>
                  </div>
                </div>
                <div className="flex gap-2 self-end sm:self-auto w-full sm:w-auto">
                  <Button size="sm" onClick={() => handleFriend(f.id, "accepted")} className="flex-1 sm:flex-none">Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => handleFriend(f.id, "declined")} className="flex-1 sm:flex-none text-destructive hover:bg-destructive/10">Decline</Button>
                </div>
              </div>
            ))}

            {pendingEvents.map(inv => {
              const evt = inv.event;
              const dt = new Date(evt.start_time);
              const dateStr = dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

              return (
                <div key={inv.id} className="p-4 flex items-center justify-between sm:flex-row flex-col gap-3">
                  <div className="flex items-start gap-3 self-start">
                    <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner text-primary shrink-0 mt-0.5">
                      <Calendar className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium"><span className="text-foreground">{evt.creator?.display_name || evt.creator?.email || "Someone"}</span> invited you to <span className="font-bold">{evt.title}</span></p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="size-3" /> {dateStr} @ {timeStr}</span>
                        <span className="flex items-center gap-1"><MapPin className="size-3" /> {evt.location_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto w-full sm:w-auto">
                    <Button size="sm" onClick={() => handleEvent(inv.id, "attending")} className="flex-1 sm:flex-none">Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => handleEvent(inv.id, "declined")} className="flex-1 sm:flex-none text-destructive hover:bg-destructive/10">Decline</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {hasEvents && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Upcoming Events</h2>
            <Link href="/cars-and-coffee" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              View all <Users className="size-3" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingEvents.map(evt => {
              const dt = new Date(evt.start_time);
              const dateStr = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
              const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
              
              // Only embed maps if there is a specific address or location name.
              const mapQuery = evt.location_address ? `${evt.location_name}, ${evt.location_address}` : evt.location_name;

              return (
                <Card key={evt.id} className="border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
                  <div className="h-32 w-full bg-muted/30 relative">
                    {evt.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover" />
                    ) : mapQuery ? (
                      <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=${getGoogleMapsApiKey()}&q=${encodeURIComponent(mapQuery)}`}
                      ></iframe>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                        <MapPin className="size-8 text-primary/40" />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 flex gap-1 pointer-events-none">
                      {evt.state_tag && <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-[10px]">{evt.state_tag}</Badge>}
                      {evt.event_type_tag && <Badge className="bg-primary/80 backdrop-blur-md text-[10px] text-primary-foreground">{evt.event_type_tag}</Badge>}
                    </div>
                  </div>
                  <CardContent className="p-4 flex-1">
                    <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">
                      {dateStr} @ {timeStr}
                    </p>
                    <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-1">{evt.title}</h3>
                    <p className="text-sm text-muted-foreground flex items-start gap-1.5 line-clamp-2">
                      <MapPin className="size-3.5 mt-0.5 shrink-0" />
                      <span className="leading-snug">{evt.location_name}{evt.location_address ? ` · ${evt.location_address}` : ''}</span>
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
