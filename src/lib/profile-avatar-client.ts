import type { SupabaseClient } from "@supabase/supabase-js";
import { carImageUrlWithCacheBust } from "@/lib/car-image-url";

const BUCKET = "profile-avatars";

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("heic")) return "heic";
  if (m.includes("heif")) return "heif";
  return "jpg";
}

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
 * Upload a profile image and set `profiles.avatar_url`.
 */
export async function uploadProfileAvatar(
  supabase: SupabaseClient,
  params: { userId: string; file: File },
): Promise<string> {
  const type = params.file.type || extFromFile(params.file).contentType;
  if (!ALLOWED.has(type.toLowerCase())) {
    throw new Error("Use a JPEG, PNG, WebP, GIF, or HEIC image.");
  }
  const { ext, contentType } = extFromFile(params.file);
  const path = `${params.userId}/avatar.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, params.file, {
      contentType: type || contentType,
      upsert: true,
    });
  if (upErr) throw new Error(upErr.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = carImageUrlWithCacheBust(data.publicUrl);

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", params.userId);
  if (dbErr) throw new Error(dbErr.message);

  return publicUrl;
}

/**
 * Save a generated or captured in-memory image as the profile avatar.
 */
export async function uploadProfileAvatarBlob(
  supabase: SupabaseClient,
  params: { userId: string; blob: Blob; contentType: string },
): Promise<string> {
  const ct = params.contentType.toLowerCase();
  if (!ALLOWED.has(ct)) {
    throw new Error("Unsupported image type for avatar.");
  }
  const ext = extFromMime(ct);
  const path = `${params.userId}/avatar.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, params.blob, { contentType: params.contentType, upsert: true });
  if (upErr) throw new Error(upErr.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = carImageUrlWithCacheBust(data.publicUrl);

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", params.userId);
  if (dbErr) throw new Error(dbErr.message);

  return publicUrl;
}
