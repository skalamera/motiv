import { createClient } from "@/lib/supabase/server";
import { fetchRecallsByVehicle } from "@/lib/nhtsa";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const carId = new URL(req.url).searchParams.get("carId");
  if (!carId) {
    return Response.json({ error: "carId required" }, { status: 400 });
  }

  const { data: car, error } = await supabase
    .from("cars")
    .select("id, make, model, year, user_id")
    .eq("id", carId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !car) {
    return Response.json({ error: "Car not found" }, { status: 404 });
  }

  try {
    const recalls = await fetchRecallsByVehicle(
      car.make,
      car.model,
      car.year,
    );
    return Response.json({ recalls, car });
  } catch (e) {
    console.error(e);
    return Response.json(
      { error: e instanceof Error ? e.message : "NHTSA request failed" },
      { status: 502 },
    );
  }
}
