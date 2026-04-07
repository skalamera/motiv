export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  location_address: string | null;
  email: string | null;
  created_at: string;
};

export type Car = {
  id: string;
  user_id: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  vin: string | null;
  mileage: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Manual = {
  id: string;
  car_id: string;
  storage_path: string;
  file_name: string;
  created_at: string;
};

export type MaintenanceSchedule = {
  id: string;
  car_id: string;
  task: string;
  interval_miles: number | null;
  interval_months: number | null;
  is_custom: boolean;
  source: "manual" | "web" | "custom";
  notes: string | null;
  last_completed_at: string | null;
  last_mileage_at: number | null;
  created_at: string;
};

export type MaintenanceLog = {
  id: string;
  schedule_id: string | null;
  car_id: string;
  completed_at: string;
  mileage_at: number | null;
  notes: string | null;
  cost: number | null;
  /** Set for manual history rows (no schedule); schedule-linked rows usually use the join for task name. */
  title: string | null;
};

export type Event = {
  id: string;
  creator_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location_name: string;
  location_address: string | null;
  state_tag: string | null;
  event_type_tag: string | null;
  image_url: string | null;
  created_at: string;
};

export type Friend = {
  id: string;
  user_id: string;
  friend_id: string;
  status: "pending" | "accepted";
  created_at: string;
  updated_at: string;
};

export type EventInvite = {
  id: string;
  event_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "attending" | "declined";
  created_at: string;
  updated_at: string;
};
