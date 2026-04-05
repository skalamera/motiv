import { createServiceRoleClient } from "@/lib/supabase/server";

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

    const { data: file, error: dlError } = await admin.storage
      .from("manuals")
      .download(manual.storage_path);

    if (dlError || !file) {
      console.error("manual download", dlError);
      return null;
    }

    const ab = await file.arrayBuffer();
    return {
      buffer: Buffer.from(ab),
      fileName: manual.file_name ?? "manual.pdf",
    };
  } catch (e) {
    console.error("fetchPrimaryManualPdf", e);
    return null;
  }
}
