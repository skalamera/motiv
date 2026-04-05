import { fetchRecallsByVehicle } from "@/lib/nhtsa";
import type { Car } from "@/types/database";

export async function getRecallCountForCar(car: Car): Promise<number> {
  try {
    const list = await fetchRecallsByVehicle(car.make, car.model, car.year);
    return list.length;
  } catch {
    return 0;
  }
}
