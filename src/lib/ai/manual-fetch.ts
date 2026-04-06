import { createServiceRoleClient } from "@/lib/supabase/server";

async function downloadManualBuffer(
  storagePath: string,
  fileName: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  const admin = createServiceRoleClient();
  const { data: file, error: dlError } = await admin.storage
    .from("manuals")
    .download(storagePath);

  if (dlError || !file) {
    console.error("manual download", dlError);
    return null;
  }

  const ab = await file.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    fileName: fileName || "manual.pdf",
  };
}

export async function fetchPrimaryManualPdf(
  carId: string,
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const admin = createServiceRoleClient();
    const { data: manual, error } = await admin
      .from("manuals")
      .select("storage_path, file_name")
      .eq("car_id", carId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !manual?.storage_path) return null;

    return downloadManualBuffer(manual.storage_path, manual.file_name ?? "manual.pdf");
  } catch (e) {
    console.error("fetchPrimaryManualPdf", e);
    return null;
  }
}

/**
 * Load a specific manual PDF after verifying the car belongs to the user.
 */
export async function fetchManualPdfByIdForUser(
  manualId: string,
  userId: string,
): Promise<{ buffer: Buffer; fileName: string; carId: string } | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const admin = createServiceRoleClient();
    const { data: manual, error: mErr } = await admin
      .from("manuals")
      .select("id, storage_path, file_name, car_id")
      .eq("id", manualId)
      .maybeSingle();

    if (mErr || !manual?.storage_path) return null;

    const { data: car, error: cErr } = await admin
      .from("cars")
      .select("user_id")
      .eq("id", manual.car_id)
      .maybeSingle();

    if (cErr || !car || car.user_id !== userId) return null;

    const dl = await downloadManualBuffer(
      manual.storage_path,
      manual.file_name ?? "manual.pdf",
    );
    if (!dl) return null;

    return { ...dl, carId: manual.car_id };
  } catch (e) {
    console.error("fetchManualPdfByIdForUser", e);
    return null;
  }
}
