"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserPlus, Check, X, MapPin, Users, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Profile, Event, Friend, EventInvite } from "@/types/database";

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
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);

  // Friend Network State
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [friendsList, setFriendsList] = useState<(Friend & { friend_profile: Profile, user_profile: Profile })[]>([]);
  const [friendLoading, setFriendLoading] = useState(false);

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
    setFriendLoading(true);
    // Fetch friends where I am user_id or friend_id
    const { data: myRequests } = await supabase
      .from("friends")
      .select('*, friend_profile:profiles!friends_friend_id_fkey(*), user_profile:profiles!friends_user_id_fkey(*)')
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFriendsList((myRequests || []) as any);
    setFriendLoading(false);
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

  async function searchFriends(e: React.FormEvent) {
    e.preventDefault();
    if (!searchEmail.trim()) return;
    setSearching(true);
    const { data } = await supabase.rpc("search_users_by_email", { search_email: searchEmail.trim() });
    setSearchResults((data || []) as SearchedUser[]);
    setSearching(false);
  }

  async function sendFriendRequest(friendId: string) {
    await supabase.from("friends").insert({
      user_id: currentUser.id,
      friend_id: friendId,
      status: "pending"
    });
    setSearchEmail("");
    setSearchResults([]);
    loadFriends();
  }

  async function acceptFriendRequest(id: string) {
    await supabase.from("friends").update({ status: "accepted" }).eq("id", id);
    loadFriends();
  }

  async function declineOrRemoveFriend(id: string) {
    await supabase.from("friends").delete().eq("id", id);
    loadFriends();
  }

  // Pending requests where I am the friend_id
  const pendingRequests = friendsList.filter(f => f.friend_id === currentUser.id && f.status === "pending");
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

    const { data: newEvt, error: evtErr } = await supabase.from("events").insert({
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

  return (
    <div className="flex h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cars & Coffee</h1>
          <p className="text-muted-foreground text-sm mt-1">Discover local events and connect with enthusiasts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setFriendsOpen(true)} className="relative">
            <Users className="mr-2 size-4" />
            Network
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {pendingRequests.length}
              </span>
            )}
          </Button>
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
          <h2 className="text-sm font-semibold mb-3 tracking-wide uppercase text-muted-foreground">Your Network Events</h2>
          <ScrollArea className="w-full whitespace-nowrap pb-4">
            <div className="flex w-max space-x-4">
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
                    <CardFooter className="p-4 pt-0 flex justify-between items-center bg-card/40 border-t border-border/30 mt-auto">
                      <div className="text-xs text-muted-foreground">
                        {isCreator ? "Created by you" : `Invited by ${evt.creator?.display_name || "a friend"}`}
                      </div>
                      {!isCreator && myInvite && myInvite.status === "pending" ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="default" className="h-7 text-xs px-2.5" onClick={() => rsvpEvent(myInvite.id, "attending")}>Accept</Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5" onClick={() => rsvpEvent(myInvite.id, "declined")}>Decline</Button>
                        </div>
                      ) : myInvite && myInvite.status !== "pending" ? (
                        <Badge variant="outline" className={myInvite.status === 'attending' ? "text-emerald-500 border-emerald-500/30" : "text-muted-foreground"}>
                          {myInvite.status === 'attending' ? 'Attending' : 'Declined'}
                        </Badge>
                      ) : (
                        <div className="flex -space-x-2">
                          {evt.invites.filter((i: any) => i.status === 'attending').map((inv: any, i: number) => (
                            <div key={inv.id} className="size-6 rounded-full bg-accent border-2 border-background flex items-center justify-center text-[9px] uppercase z-10" style={{ zIndex: 10 - i }}>
                              {inv.invitee?.display_name?.charAt(0) || '?'}
                            </div>
                          ))}
                          <div className="text-[10px] text-muted-foreground pl-3">
                            {evt.invites.filter((i: any) => i.status === 'attending').length} attending
                          </div>
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      ) : null}

      <div className="flex-1 w-full bg-background relative overflow-hidden rounded-xl border border-border/50">
        <iframe
          src={iframeUrl}
          className="absolute inset-0 w-full h-full border-0"
          title="Cars and Coffee Events"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>

      {/* Friends Network Dialog */}
      <Dialog open={friendsOpen} onOpenChange={setFriendsOpen}>
        <DialogContent className="sm:max-w-md h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Friend Network</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            
            {/* Search */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Find Friends</h3>
              <form onSubmit={searchFriends} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input 
                    type="email" 
                    placeholder="Search by exact email..." 
                    className="pl-9"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={!searchEmail.trim() || searching}>
                  {searching ? <Loader2 className="size-4 animate-spin" /> : "Search"}
                </Button>
              </form>
              
              {searchResults.length > 0 && (
                <div className="rounded-md border border-border/50 bg-muted/30 p-2 space-y-2">
                  {searchResults.map(u => {
                    const isFriend = friendsList.some(f => 
                      (f.user_id === currentUser.id && f.friend_id === u.id) || 
                      (f.friend_id === currentUser.id && f.user_id === u.id)
                    );
                    const isSelf = u.id === currentUser.id;

                    return (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-md bg-background/50">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold uppercase">
                            {u.display_name?.charAt(0) || u.id.charAt(0)}
                          </div>
                          <span className="text-sm font-medium">{u.display_name || "Unknown User"}</span>
                        </div>
                        {!isSelf && !isFriend && (
                          <Button size="sm" variant="ghost" onClick={() => sendFriendRequest(u.id)}>
                            <UserPlus className="size-4 mr-1.5" /> Add
                          </Button>
                        )}
                        {isFriend && <Badge variant="secondary" className="text-[10px]">Added</Badge>}
                        {isSelf && <Badge variant="outline" className="text-[10px]">You</Badge>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Friend Requests <Badge variant="secondary" className="bg-primary/20 text-primary">{pendingRequests.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-accent flex items-center justify-center font-bold uppercase">
                          {req.user_profile?.display_name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm font-medium">{req.user_profile?.display_name || "Unknown"}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="icon" variant="default" className="size-7 rounded-full" onClick={() => acceptFriendRequest(req.id)}>
                          <Check className="size-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="size-7 rounded-full text-destructive hover:text-destructive" onClick={() => declineOrRemoveFriend(req.id)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My Friends */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">My Friends ({acceptedFriends.length})</h3>
              {acceptedFriends.length === 0 ? (
                <p className="text-xs text-muted-foreground">Search for a friend's email above to start building your network.</p>
              ) : (
                <div className="space-y-2">
                  {acceptedFriends.map(f => {
                    const profile = getFriendProfile(f);
                    return (
                      <div key={f.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-full bg-accent flex items-center justify-center font-bold uppercase">
                            {profile?.display_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium">{profile?.display_name || "Unknown"}</span>
                        </div>
                        <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => declineOrRemoveFriend(f.id)}>
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
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
                          <div className="size-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold uppercase">
                            {profile?.display_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium">{profile?.display_name || "Unknown"}</span>
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
