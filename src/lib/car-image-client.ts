import type { SupabaseClient } from "@supabase/supabase-js";
import { carImageUrlWithCacheBust } from "@/lib/car-image-url";

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function extFromFile(file: File): { ext: string; contentType: string } {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".png")) return { ext: "png", contentType: "image/png" };
  if (lower.endsWith(".webp")) return { ext: "webp", contentType: "image/webp" };
  if (lower.endsWith(".gif")) return { ext: "gif", contentType: "image/gif" };
  if (lower.endsWith(".heic"))
    return { ext: "heic", contentType: "image/heic" };
  if (lower.endsWith(".heif"))
    return { ext: "heif", contentType: "image/heif" };
  return { ext: "jpg", contentType: "image/jpeg" };
}

/**
 * Upload a user-selected photo to the public `car-images` bucket and set `cars.image_url`.
 */
export async function uploadCarHeroImage(
  supabase: SupabaseClient,
  params: { userId: string; carId: string; file: File },
): Promise<string> {
  const type = params.file.type || extFromFile(params.file).contentType;
  if (!ALLOWED.has(type.toLowerCase())) {
    throw new Error("Use a JPEG, PNG, WebP, GIF, or HEIC image.");
  }
  const { ext, contentType } = extFromFile(params.file);
  const path = `${params.userId}/${params.carId}/cover.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("car-images")
    .upload(path, params.file, { contentType: type || contentType, upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { data } = supabase.storage.from("car-images").getPublicUrl(path);
  const publicUrl = carImageUrlWithCacheBust(data.publicUrl);

  const { error: dbErr } = await supabase
    .from("cars")
    .update({
      image_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.carId)
    .eq("user_id", params.userId);
  if (dbErr) throw new Error(dbErr.message);

  return publicUrl;
}

export async function removeCarImagesFromStorage(
  supabase: SupabaseClient,
  userId: string,
  carId: string,
): Promise<void> {
  const folder = `${userId}/${carId}`;
  const { data: list } = await supabase.storage.from("car-images").list(folder);
  if (!list?.length) return;
  const paths = list.map((f) => `${folder}/${f.name}`);
  await supabase.storage.from("car-images").remove(paths);
}
