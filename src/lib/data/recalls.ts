import { fetchRecallsForCar } from "@/lib/nhtsa";
import type { Car } from "@/types/database";

export async function getRecallCountForCar(car: Car): Promise<number> {
  try {
    const modelQuery = [car.model, car.trim]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" ");
    const { recalls } = await fetchRecallsForCar({
      vin: car.vin,
      make: car.make,
      model: modelQuery || car.model,
      profileModelBase: car.model,
      modelYear: car.year,
    });
    return recalls.length;
  } catch {
    return 0;
  }
}
