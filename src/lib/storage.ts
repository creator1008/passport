import { getSupabaseAdmin } from "@/lib/supabase/server";

const BUCKET = "passports";
const SIGNED_URL_TTL = 60 * 15;

export async function getPassportImageUrl(storagePath: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function deletePassportImage(storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    console.warn(`Failed to delete storage file: ${storagePath}`, error.message);
  }
}

export async function uploadPassportImage(
  applicantId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const extension = mimeType.includes("png") ? "png" : "jpg";
  const storagePath = `${applicantId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return storagePath;
}
