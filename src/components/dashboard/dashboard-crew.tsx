"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Calendar,
  Clock,
  BellRing,
  Users,
  Trash2,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { getGoogleMapsApiKey } from "@/lib/maps-config";
import { UserAvatarCircle } from "@/components/user-avatar-circle";

export function useDashboardCrewData() {
  const [pendingFriends, setPendingFriends] = useState<any[]>([]);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: friends } = await supabase
      .from("friends")
      .select("*, user_profile:profiles!friends_user_id_fkey(*)")
      .eq("friend_id", user.id)
      .eq("status", "pending");

    setPendingFriends(friends || []);

    const { data: invites } = await supabase
      .from("event_invites")
      .select(
        "*, event:events!inner(*, creator:profiles!events_creator_id_fkey(*))",
      )
      .eq("invitee_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    setPendingEvents(invites || []);

    const now = new Date().toISOString();

    const { data: createdEvts } = await supabase
      .from("events")
      .select("*, creator:profiles!events_creator_id_fkey(*)")
      .eq("creator_id", user.id)
      .gte("start_time", now)
      .order("start_time", { ascending: true });

    const { data: attendingInvs } = await supabase
      .from("event_invites")
      .select("id, event_id")
      .eq("invitee_id", user.id)
      .eq("status", "attending");

    const attendingInviteByEventId: Record<string, string> = {};
    for (const row of attendingInvs ?? []) {
      attendingInviteByEventId[row.event_id] = row.id;
    }

    let attendingEvts: any[] = [];
    if (attendingInvs && attendingInvs.length > 0) {
      const eventIds = attendingInvs.map((i) => i.event_id);
      const { data: aEvts } = await supabase
        .from("events")
        .select("*, creator:profiles!events_creator_id_fkey(*)")
        .in("id", eventIds)
        .gte("start_time", now)
        .order("start_time", { ascending: true });
      attendingEvts = (aEvts || []).map((e: { id: string }) => ({
        ...e,
        _attendingInviteId: attendingInviteByEventId[e.id],
      }));
    }

    const allUpcoming = [...(createdEvts || []), ...attendingEvts].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );

    const uniqueUpcoming = Array.from(
      new Map(allUpcoming.map((item) => [item.id, item])).values(),
    );

    setUpcomingEvents(uniqueUpcoming);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleFriend(id: string, action: "accepted" | "declined") {
    if (action === "accepted") {
      await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    } else {
      await supabase.from("friends").delete().eq("id", id);
    }
    void loadData();
  }

  async function handleEvent(id: string, action: "attending" | "declined") {
    await supabase.from("event_invites").update({ status: action }).eq("id", id);
    void loadData();
  }

  async function deleteEvent(eventId: string) {
    if (
      !confirm(
        "Delete this event for everyone? All invitations will be removed.",
      )
    ) {
      return;
    }
    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      alert(error.message);
      return;
    }
    void loadData();
  }

  async function leaveEvent(inviteId: string) {
    if (!confirm("Remove yourself from this event?")) return;
    const { error } = await supabase
      .from("event_invites")
      .delete()
      .eq("id", inviteId);
    if (error) {
      alert(error.message);
      return;
    }
    void loadData();
  }

  return {
    loading,
    userId,
    pendingFriends,
    pendingEvents,
    upcomingEvents,
    handleFriend,
    handleEvent,
    deleteEvent,
    leaveEvent,
  };
}

export type DashboardCrewData = ReturnType<typeof useDashboardCrewData>;

/** Pending friend requests + event invites — keep directly under the dashboard intro, above stat widgets. */
export function DashboardCrewPendingAlerts({
  crew,
}: {
  crew: DashboardCrewData;
}) {
  const { loading, pendingFriends, pendingEvents, handleFriend, handleEvent } =
    crew;

  if (loading) return null;

  const hasAlerts =
    pendingFriends.length > 0 || pendingEvents.length > 0;
  if (!hasAlerts) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className="border-border/50 bg-card/60 overflow-hidden backdrop-blur-sm">
        <div className="border-border/50 bg-primary/10 flex items-center gap-2 border-b px-4 py-3">
          <BellRing className="text-primary size-4" />
          <h2 className="text-primary font-semibold">Action needed</h2>
        </div>
        <CardContent className="divide-border/50 divide-y p-0">
          {pendingFriends.map((f) => (
            <div
              key={f.id}
              className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row"
            >
              <div className="flex items-center gap-3 self-start">
                <UserAvatarCircle
                  avatarUrl={f.user_profile?.avatar_url}
                  displayName={f.user_profile?.display_name}
                  email={f.user_profile?.email}
                  className="size-10"
                  fallbackClassName="bg-accent text-muted-foreground"
                />
                <div>
                  <p className="text-sm font-medium">
                    <span className="text-foreground">
                      {f.user_profile?.display_name ||
                        f.user_profile?.email ||
                        "Someone"}
                    </span>{" "}
                    sent you a friend request.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Add them to your Crew to invite them to events.
                  </p>
                </div>
              </div>
              <div className="flex w-full gap-2 self-end sm:w-auto sm:self-auto">
                <Button
                  size="sm"
                  onClick={() => void handleFriend(f.id, "accepted")}
                  className="flex-1 sm:flex-none"
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleFriend(f.id, "declined")}
                  className="text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}

          {pendingEvents.map((inv) => {
            const evt = inv.event;
            const dt = new Date(evt.start_time);
            const dateStr = dt.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const timeStr = dt.toLocaleTimeString(undefined, {
              hour: "numeric",
              minute: "2-digit",
            });

            return (
              <div
                key={inv.id}
                className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row"
              >
                <div className="mt-0.5 flex items-start gap-3 self-start">
                  <div className="bg-primary/10 text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl shadow-inner">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      <span className="text-foreground">
                        {evt.creator?.display_name ||
                          evt.creator?.email ||
                          "Someone"}
                      </span>{" "}
                      invited you to{" "}
                      <span className="font-bold">{evt.title}</span>
                    </p>
                    <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {dateStr} @ {timeStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" /> {evt.location_name}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex w-full gap-2 self-end sm:w-auto sm:self-auto">
                  <Button
                    size="sm"
                    onClick={() => void handleEvent(inv.id, "attending")}
                    className="flex-1 sm:flex-none"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleEvent(inv.id, "declined")}
                    className="text-destructive hover:bg-destructive/10 flex-1 sm:flex-none"
                  >
                    Decline
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Upcoming events grid — stays in the main column with vehicles. */
export function DashboardCrewUpcomingEvents({
  crew,
}: {
  crew: DashboardCrewData;
}) {
  const { loading, userId, upcomingEvents, deleteEvent, leaveEvent } = crew;

  if (loading) return null;

  if (upcomingEvents.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight">
          Upcoming events
        </h2>
        <Link
          href="/cars-and-coffee"
          className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs transition-colors"
        >
          View all <Users className="size-3" />
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {upcomingEvents.map((evt) => {
          const dt = new Date(evt.start_time);
          const dateStr = dt.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
          const timeStr = dt.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          });

          const mapQuery = evt.location_address
            ? `${evt.location_name}, ${evt.location_address}`
            : evt.location_name;

          const isCreator = userId != null && evt.creator_id === userId;
          const attendInviteId = evt._attendingInviteId as string | undefined;

          return (
            <Card
              key={evt.id}
              className="border-border/50 bg-card/60 flex flex-col overflow-hidden backdrop-blur-sm"
            >
              <div className="bg-muted/30 relative h-32 w-full">
                {evt.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={evt.image_url}
                    alt={evt.title}
                    className="h-full w-full object-cover"
                  />
                ) : mapQuery ? (
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps/embed/v1/place?key=${getGoogleMapsApiKey()}&q=${encodeURIComponent(mapQuery)}`}
                  />
                ) : (
                  <div className="from-primary/10 to-accent/10 flex h-full w-full items-center justify-center bg-gradient-to-br">
                    <MapPin className="text-primary/40 size-8" />
                  </div>
                )}
                <div className="pointer-events-none absolute top-2 left-2 flex gap-1">
                  {evt.state_tag ? (
                    <Badge
                      variant="secondary"
                      className="bg-background/80 text-[10px] backdrop-blur-md"
                    >
                      {evt.state_tag}
                    </Badge>
                  ) : null}
                  {evt.event_type_tag ? (
                    <Badge className="bg-primary/80 text-primary-foreground text-[10px] backdrop-blur-md">
                      {evt.event_type_tag}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <CardContent className="flex-1 p-4">
                <p className="text-primary mb-1 text-xs font-semibold tracking-wide uppercase">
                  {dateStr} @ {timeStr}
                </p>
                <h3 className="mb-2 line-clamp-1 text-lg leading-tight font-bold">
                  {evt.title}
                </h3>
                <p className="text-muted-foreground flex items-start gap-1.5 text-sm line-clamp-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" />
                  <span className="leading-snug">
                    {evt.location_name}
                    {evt.location_address
                      ? ` · ${evt.location_address}`
                      : ""}
                  </span>
                </p>
              </CardContent>
              <CardFooter className="border-border/50 flex flex-wrap gap-2 border-t p-4 pt-3">
                {isCreator ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 text-xs"
                    onClick={() => void deleteEvent(evt.id)}
                  >
                    <Trash2 className="mr-1.5 size-3.5" />
                    Delete event
                  </Button>
                ) : null}
                {!isCreator && attendInviteId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => void leaveEvent(attendInviteId)}
                  >
                    <LogOut className="mr-1.5 size-3.5" />
                    Leave event
                  </Button>
                ) : null}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
