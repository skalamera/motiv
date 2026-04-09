import { createClient } from "@/lib/supabase/server";
import type { Car, MaintenanceSchedule, Manual } from "@/types/database";
import { getRecallCountForCar } from "@/lib/data/recalls";
import type { MaintenanceLogForSuggestion } from "@/lib/maintenance/suggested-next";

export async function getCarsForUser(): Promise<Car[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("cars")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getCarsForUser", error);
    return [];
  }
  return (data ?? []) as Car[];
}

/** At least one garage vehicle with make Porsche — used for Porsche-only features (PCA, Rennlist reader, etc.). */
export async function userHasPorscheInGarage(): Promise<boolean> {
  const cars = await getCarsForUser();
  return cars.some((c) => c.make?.toLowerCase().trim() === "porsche");
}

export async function getSchedulesForCar(
  carId: string,
): Promise<MaintenanceSchedule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_schedules")
    .select("*")
    .eq("car_id", carId)
    .order("task");

  if (error) {
    console.error("getSchedulesForCar", error);
    return [];
  }
  return (data ?? []) as MaintenanceSchedule[];
}

export async function getLogsForSuggestionForCar(
  carId: string,
): Promise<MaintenanceLogForSuggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_logs")
    .select("schedule_id, completed_at, mileage_at, title")
    .eq("car_id", carId)
    .order("completed_at", { ascending: false })
    .limit(120);

  if (error) {
    console.error("getLogsForSuggestionForCar", error);
    return [];
  }
  return (data ?? []).map((row) => ({
    schedule_id: (row as { schedule_id?: string | null }).schedule_id ?? null,
    completed_at: (row as { completed_at: string }).completed_at,
    mileage_at: (row as { mileage_at: number | null }).mileage_at,
    title: (row as { title: string | null }).title,
  }));
}

export async function getManualsForCar(carId: string): Promise<Manual[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("manuals")
    .select("*")
    .eq("car_id", carId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getManualsForCar", error);
    return [];
  }
  return (data ?? []) as Manual[];
}

export type CarWithMeta = {
  car: Car;
  schedules: MaintenanceSchedule[];
  logs: MaintenanceLogForSuggestion[];
  recallCount: number;
};

export async function getDashboardCars(): Promise<CarWithMeta[]> {
  const cars = await getCarsForUser();
  return Promise.all(
    cars.map(async (car) => {
      const [schedules, logs, recallCount] = await Promise.all([
        getSchedulesForCar(car.id),
        getLogsForSuggestionForCar(car.id),
        getRecallCountForCar(car),
      ]);
      return { car, schedules, logs, recallCount };
    }),
  );
}
