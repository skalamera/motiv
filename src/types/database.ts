export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  location_address: string | null;
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
