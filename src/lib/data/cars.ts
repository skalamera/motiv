import { createClient } from "@/lib/supabase/server";
import type { Car, MaintenanceSchedule, Manual } from "@/types/database";
import { getRecallCountForCar } from "@/lib/data/recalls";

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
  recallCount: number;
};

export async function getDashboardCars(): Promise<CarWithMeta[]> {
  const cars = await getCarsForUser();
  return Promise.all(
    cars.map(async (car) => {
      const [schedules, recallCount] = await Promise.all([
        getSchedulesForCar(car.id),
        getRecallCountForCar(car),
      ]);
      return { car, schedules, recallCount };
    }),
  );
}
