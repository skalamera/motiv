"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserPlus, Check, X, MapPin, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function CrewView({ currentUser }: { currentUser: Profile }) {
  // Friend Network State
  const [searchEmail, setSearchEmail] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchedUser[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [friendsList, setFriendsList] = useState<(Friend & { friend_profile: Profile, user_profile: Profile })[]>([]);
  const [friendLoading, setFriendLoading] = useState(true);

  // Event Invites State
  const [eventInvites, setEventInvites] = useState<(EventInvite & { event: Event & { creator: Profile } })[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    loadFriends();
    loadEventInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFriends() {
    setFriendLoading(true);
    const { data: myRequests } = await supabase
      .from("friends")
      .select('*, friend_profile:profiles!friends_friend_id_fkey(*), user_profile:profiles!friends_user_id_fkey(*)')
      .or(`user_id.eq.${currentUser.id},friend_id.eq.${currentUser.id}`);
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFriendsList((myRequests || []) as any);
    setFriendLoading(false);
  }

  async function loadEventInvites() {
    setInvitesLoading(true);
    const { data: invs } = await supabase
      .from("event_invites")
      .select('*, event:events!inner(*, creator:profiles!events_creator_id_fkey(*))')
      .eq("invitee_id", currentUser.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setEventInvites((invs || []) as any);
    setInvitesLoading(false);
  }

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

  async function rsvpEvent(inviteId: string, status: "attending" | "declined") {
    await supabase.from("event_invites").update({ status }).eq("id", inviteId);
    loadEventInvites();
  }

  // Requests where I am the friend_id (received requests)
  const receivedRequests = friendsList.filter(f => f.friend_id === currentUser.id && f.status === "pending");
  // Requests where I am the user_id (sent requests)
  const sentRequests = friendsList.filter(f => f.user_id === currentUser.id && f.status === "pending");
  // Accepted friends
  const acceptedFriends = friendsList.filter(f => f.status === "accepted");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getFriendProfile(f: any) {
    return f.user_id === currentUser.id ? f.friend_profile : f.user_profile;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 items-start">
      
      {/* Left Column: Network Management */}
      <div className="space-y-6">
        
        {/* Add Friend Card */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              Add to Crew
            </CardTitle>
            <p className="text-xs text-muted-foreground">Search by exact email address to find friends.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={searchFriends} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input 
                  type="email" 
                  placeholder="Enter email address..." 
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
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
                {searchResults.map(u => {
                  const isFriend = friendsList.some(f => 
                    (f.user_id === currentUser.id && f.friend_id === u.id) || 
                    (f.friend_id === currentUser.id && f.user_id === u.id)
                  );
                  const isSelf = u.id === currentUser.id;

                  return (
                    <div key={u.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold uppercase shadow-inner">
                          {u.display_name?.charAt(0) || u.id.charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{u.display_name || "Unknown User"}</span>
                      </div>
                      {!isSelf && !isFriend && (
                        <Button size="sm" variant="default" onClick={() => sendFriendRequest(u.id)} className="h-8 text-xs rounded-full px-4">
                          <UserPlus className="size-3.5 mr-1.5" /> Add
                        </Button>
                      )}
                      {isFriend && <Badge variant="secondary" className="text-[10px]">Added</Badge>}
                      {isSelf && <Badge variant="outline" className="text-[10px]">You</Badge>}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Crew Members Card */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" />
              Crew Members ({acceptedFriends.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {friendLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading crew...
              </div>
            ) : acceptedFriends.length === 0 ? (
              <p className="text-sm text-muted-foreground">Your crew is currently empty. Add friends above to start building your network!</p>
            ) : (
              <div className="space-y-2">
                {acceptedFriends.map(f => {
                  const profile = getFriendProfile(f);
                  return (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-accent flex items-center justify-center font-bold text-base shadow-inner uppercase">
                          {profile?.display_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <span className="text-sm font-semibold">{profile?.display_name || "Unknown"}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">Crew Member</p>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="size-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => declineOrRemoveFriend(f.id)} title="Remove from Crew">
                        <X className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Invitations */}
      <div className="space-y-6">

        {/* Crew Requests */}
        {(receivedRequests.length > 0 || sentRequests.length > 0) && (
          <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Crew Requests
                {receivedRequests.length > 0 && (
                  <Badge variant="default" className="ml-1 px-1.5 min-w-5 h-5 flex items-center justify-center rounded-full text-xs">
                    {receivedRequests.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {receivedRequests.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Received</Label>
                  <div className="space-y-2">
                    {receivedRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-full bg-accent flex items-center justify-center font-bold uppercase shadow-inner">
                            {req.user_profile?.display_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium">{req.user_profile?.display_name || "Unknown"}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="default" className="h-8 rounded-full px-3 text-xs shadow-sm" onClick={() => acceptFriendRequest(req.id)}>
                            <Check className="size-3.5 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors border-destructive/30" onClick={() => declineOrRemoveFriend(req.id)}>
                            <X className="size-3.5 mr-1" /> Decline
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sentRequests.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Sent (Pending)</Label>
                  <div className="space-y-2">
                    {sentRequests.map(req => (
                      <div key={req.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card">
                        <div className="flex items-center gap-3 opacity-60">
                          <div className="size-8 rounded-full bg-accent flex items-center justify-center font-bold uppercase shadow-inner">
                            {req.friend_profile?.display_name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm font-medium">{req.friend_profile?.display_name || "Unknown"}</span>
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={() => declineOrRemoveFriend(req.id)}>
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* Event Invitations */}
        <Card className="border-border/50 bg-card/60 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-5" />
              Event Invitations
              {eventInvites.length > 0 && (
                <Badge variant="default" className="ml-1 px-1.5 min-w-5 h-5 flex items-center justify-center rounded-full text-xs">
                  {eventInvites.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invitesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading invitations...
              </div>
            ) : eventInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending event invitations.</p>
            ) : (
              <div className="space-y-4">
                {eventInvites.map(inv => {
                  const evt = inv.event;
                  const dt = new Date(evt.start_time);
                  const dateStr = dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                  const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

                  return (
                    <div key={inv.id} className="rounded-xl border border-primary/30 bg-card shadow-sm overflow-hidden flex flex-col sm:flex-row">
                      {evt.image_url ? (
                        <div className="h-24 sm:h-auto sm:w-32 shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={evt.image_url} alt={evt.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-24 sm:h-auto sm:w-32 shrink-0 flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
                          <MapPin className="size-8 text-primary/40" />
                        </div>
                      )}
                      
                      <div className="flex-1 p-4 flex flex-col justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">
                            {dateStr} @ {timeStr}
                          </p>
                          <h4 className="font-bold text-base leading-tight mb-1.5">{evt.title}</h4>
                          <p className="text-sm text-muted-foreground flex items-start gap-1.5 mb-2">
                            <MapPin className="size-3.5 mt-0.5 shrink-0" />
                            <span className="leading-snug">{evt.location_name}{evt.location_address ? ` · ${evt.location_address}` : ''}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Invited by <span className="font-medium text-foreground">{evt.creator?.display_name || "a Crew Member"}</span>
                          </p>
                        </div>
                        <div className="flex gap-2 w-full mt-auto pt-2 border-t border-border/40">
                          <Button size="sm" variant="default" className="flex-1 h-8 text-xs rounded-full shadow-sm" onClick={() => rsvpEvent(inv.id, "attending")}>
                            <Check className="size-3.5 mr-1.5" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-full text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={() => rsvpEvent(inv.id, "declined")}>
                            <X className="size-3.5 mr-1.5" /> Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
