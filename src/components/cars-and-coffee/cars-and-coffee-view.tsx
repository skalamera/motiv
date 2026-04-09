"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Search,
  UserPlus,
  Check,
  X,
  MapPin,
  Users,
  Plus,
  Trash2,
  LogOut,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Profile, Event, Friend, EventInvite } from "@/types/database";
import { UserAvatarCircle } from "@/components/user-avatar-circle";

type SearchedUser = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

type EventRow = Event & {
  creator: Profile;
  invites: (EventInvite & { invitee: Profile })[];
};

export function CarsAndCoffeeView({ 
  iframeUrl, 
  stateSlug, 
  currentUser 
}: { 
  iframeUrl: string; 
  stateSlug: string; 
  currentUser: Profile;
}) {
  const [createEventOpen, setCreateEventOpen] = useState(false);

  // Friend Network State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [friendsList, setFriendsList] = useState<(Friend & { friend_profile: Profile, user_profile: Profile })[]>([]);

  // Event State
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const supabase = createClient();

  // Create Event Form State
  const [evtTitle, setEvtTitle] = useState("");
  const [evtDate, setEvtDate] = useState("");
  const [evtTime, setEvtTime] = useState("");
  const [evtLocName, setEvtLocName] = useState("");
  const [evtLocAddr, setEvtLocAddr] = useState("");
  const [selectedInvites, setSelectedInvites] = useState<string[]>([]);
  const [creatingEvt, setCreatingEvt] = useState(false);

  async function loadFriends() {
    // Fetch friends where I am user_id or friend_id
    const { data: myRequests } = await supabase
      .from("friends")
      .select('*, friend_profile:profiles!friends_friend_id_fkey(*), user_profile:profiles!friends_user_id_fkey(*)')
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFriendsList((myRequests || []) as any);
  }

  async function loadEvents() {
    setEventsLoading(true);
    const { data: evts } = await supabase
      .from("events")
      .select('*, creator:profiles!events_creator_id_fkey(*)')
      .order("start_time", { ascending: true });

    if (evts) {
      // Also fetch invites for these events
      const eventIds = evts.map(e => e.id);
      if (eventIds.length > 0) {
        const { data: invs } = await supabase
          .from("event_invites")
          .select('*, invitee:profiles!event_invites_invitee_id_fkey(*)')
          .in("event_id", eventIds);

        const merged = evts.map(e => ({
          ...e,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          invites: (invs || []).filter((i: any) => i.event_id === e.id)
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEvents(merged as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEvents(evts as any);
      }
    }
    setEventsLoading(false);
  }

  useEffect(() => {
    loadFriends();
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Accepted friends (I can be user_id or friend_id)
  const acceptedFriends = friendsList.filter(f => f.status === "accepted");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getFriendProfile(f: any) {
    return f.user_id === currentUser.id ? f.friend_profile : f.user_profile;
  }

  async function handleCreateEvent() {
    if (!evtTitle || !evtDate || !evtTime || !evtLocName) return;
    setCreatingEvt(true);

    // Combine date and time
    const startDateTime = new Date(`${evtDate}T${evtTime}`);

    const { data: newEvt } = await supabase.from("events").insert({
      creator_id: currentUser.id,
      title: evtTitle,
      start_time: startDateTime.toISOString(),
      location_name: evtLocName,
      location_address: evtLocAddr,
      state_tag: stateSlug.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
      event_type_tag: "Cars and Coffee"
    }).select().single();

    if (newEvt && selectedInvites.length > 0) {
      const invitesToInsert = selectedInvites.map(invitee_id => ({
        event_id: newEvt.id,
        inviter_id: currentUser.id,
        invitee_id,
        status: "pending"
      }));
      await supabase.from("event_invites").insert(invitesToInsert);
    }

    setCreatingEvt(false);
    setCreateEventOpen(false);
    // Reset form
    setEvtTitle(""); setEvtDate(""); setEvtTime(""); setEvtLocName(""); setEvtLocAddr(""); setSelectedInvites([]);
    loadEvents();
  }

  async function rsvpEvent(inviteId: string, status: "attending" | "declined") {
    await supabase.from("event_invites").update({ status }).eq("id", inviteId);
    loadEvents();
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
    loadEvents();
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
    loadEvents();
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-8">
      <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cars & Coffee</h1>
          <p className="text-muted-foreground text-sm mt-1">Discover local events and connect with enthusiasts.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCreateEventOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create Event
          </Button>
        </div>
      </div>

      {eventsLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading events...
        </div>
      ) : events.length > 0 ? (
        <div className="shrink-0">
          <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wide uppercase">
            Your Network Events
          </h2>
          <ScrollArea className="h-[min(40vh,380px)] w-full whitespace-nowrap pb-2">
            <div className="flex w-max space-x-4 pb-1">
              {events.map((evt) => {
                const isCreator = evt.creator_id === currentUser.id;
                const myInvite = evt.invites.find((i: any) => i.invitee_id === currentUser.id);
                const dt = new Date(evt.start_time);
                const dateStr = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

                return (
                  <Card key={evt.id} className="w-[320px] shrink-0 border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
                    <div className="h-32 w-full bg-muted/30 relative">
                      {evt.image_url ? (
                        <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                          <MapPin className="size-8 text-primary/40" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 flex gap-1">
                        {evt.state_tag && <Badge variant="secondary" className="bg-background/80 backdrop-blur-md text-[10px]">{evt.state_tag}</Badge>}
                        {evt.event_type_tag && <Badge className="bg-primary/80 backdrop-blur-md text-[10px] text-primary-foreground hover:bg-primary/80">{evt.event_type_tag}</Badge>}
                      </div>
                    </div>
                    <CardContent className="p-4 flex-1">
                      <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">
                        {dateStr} @ {timeStr}
                      </p>
                      <h3 className="font-bold text-base leading-tight mb-2 line-clamp-2">{evt.title}</h3>
                      <p className="text-sm text-muted-foreground flex items-start gap-1.5 line-clamp-2">
                        <MapPin className="size-3.5 mt-0.5 shrink-0" />
                        <span className="leading-snug">{evt.location_name}{evt.location_address ? ` · ${evt.location_address}` : ''}</span>
                      </p>
                    </CardContent>
                    <CardFooter className="border-border/30 bg-card/40 mt-auto flex flex-col gap-2 border-t p-4 pt-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-muted-foreground min-w-0 text-xs">
                          {isCreator
                            ? "Created by you"
                            : `Invited by ${evt.creator?.display_name || evt.creator?.email || "a Crew Member"}`}
                        </div>
                        {!isCreator &&
                        myInvite &&
                        myInvite.status === "pending" ? (
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2.5 text-xs"
                              onClick={() =>
                                rsvpEvent(myInvite.id, "attending")
                              }
                            >
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs"
                              onClick={() =>
                                rsvpEvent(myInvite.id, "declined")
                              }
                            >
                              Decline
                            </Button>
                          </div>
                        ) : myInvite && myInvite.status === "attending" ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 shrink-0 text-emerald-500"
                          >
                            Attending
                          </Badge>
                        ) : myInvite && myInvite.status === "declined" ? (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground shrink-0"
                          >
                            Declined
                          </Badge>
                        ) : isCreator ? (
                          <div className="flex max-w-[55%] flex-wrap items-center justify-end gap-1">
                            {evt.invites
                              .filter((i: { status: string }) => i.status === "attending")
                              .map(
                                (
                                  inv: {
                                    id: string;
                                    invitee?: {
                                      display_name?: string | null;
                                      email?: string | null;
                                      avatar_url?: string | null;
                                    };
                                  },
                                  i: number,
                                ) => (
                                  <div
                                    key={inv.id}
                                    className="border-background"
                                    style={{ zIndex: 10 - i }}
                                  >
                                    <UserAvatarCircle
                                      avatarUrl={inv.invitee?.avatar_url}
                                      displayName={inv.invitee?.display_name}
                                      email={inv.invitee?.email}
                                      className="size-6 border-2 border-background"
                                      fallbackClassName="bg-accent text-[9px]"
                                    />
                                  </div>
                                ),
                              )}
                            <span className="text-muted-foreground pl-1 text-[10px]">
                              {
                                evt.invites.filter(
                                  (i: { status: string }) =>
                                    i.status === "attending",
                                ).length
                              }{" "}
                              attending
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isCreator ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() => void deleteEvent(evt.id)}
                          >
                            <Trash2 className="mr-1 size-3" />
                            Delete event
                          </Button>
                        ) : null}
                        {!isCreator &&
                        myInvite &&
                        myInvite.status === "attending" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => void leaveEvent(myInvite.id)}
                          >
                            <LogOut className="mr-1 size-3" />
                            Leave event
                          </Button>
                        ) : null}
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      ) : null}

      {/* Tall iframe: avoid flex-1 in a fixed-height column (it shrinks when events render above). */}
      <div
        className="border-border/50 relative w-full overflow-hidden rounded-xl border bg-background min-h-[28rem] h-[68dvh] sm:min-h-[32rem] sm:h-[72dvh]"
      >
        <iframe
          src={iframeUrl}
          className="absolute inset-0 h-full w-full border-0"
          title="Cars and Coffee Events"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>

      {/* Friends Network Dialog */}
      <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Event Name</Label>
              <Input placeholder="e.g. Cars and Coffee at the Beanery" value={evtTitle} onChange={(e) => setEvtTitle(e.target.value)} />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={evtDate} onChange={(e) => setEvtDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={evtTime} onChange={(e) => setEvtTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Location Name</Label>
              <Input placeholder="e.g. Coffee Beanery Ocean City" value={evtLocName} onChange={(e) => setEvtLocName(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Location Address <span className="text-muted-foreground font-normal">(Optional)</span></Label>
              <Input placeholder="e.g. Coastal Highway, Ocean City, MD" value={evtLocAddr} onChange={(e) => setEvtLocAddr(e.target.value)} />
            </div>

            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label>Invite Friends</Label>
              {acceptedFriends.length === 0 ? (
                <p className="text-xs text-muted-foreground">You don't have any friends in your network yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto p-1">
                  {acceptedFriends.map(f => {
                    const profile = getFriendProfile(f);
                    const friendId = f.user_id === currentUser.id ? f.friend_id : f.user_id;
                    const isSelected = selectedInvites.includes(friendId);
                    return (
                      <label key={f.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                        <div className="relative flex items-center justify-center">
                          <input 
                            type="checkbox" 
                            className="peer sr-only"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedInvites(prev => [...prev, friendId]);
                              else setSelectedInvites(prev => prev.filter(id => id !== friendId));
                            }}
                          />
                          <div className="size-4 rounded border border-primary/50 peer-checked:bg-primary peer-checked:border-primary flex items-center justify-center">
                            {isSelected && <Check className="size-3 text-primary-foreground" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <UserAvatarCircle
                            avatarUrl={profile?.avatar_url}
                            displayName={profile?.display_name}
                            email={profile?.email}
                            className="size-6"
                            fallbackClassName="bg-accent text-[10px]"
                          />
                          <span className="text-sm font-medium">{profile?.display_name || profile?.email || "Someone"}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEventOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateEvent} 
              disabled={creatingEvt || !evtTitle || !evtDate || !evtTime || !evtLocName}
            >
              {creatingEvt && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create & Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
