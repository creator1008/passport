import { getSupabaseAdmin } from "@/lib/supabase/server";

const PASSPORT_BUCKET = "passports";
const CAREER_BUCKET = "career-certificates";
const SIGNED_URL_TTL = 60 * 15;

export async function getPassportImageUrl(storagePath: string): Promise<string | null> {
  return getSignedImageUrl(PASSPORT_BUCKET, storagePath);
}

export async function getCareerCertificateImageUrl(
  storagePath: string,
): Promise<string | null> {
  return getSignedImageUrl(CAREER_BUCKET, storagePath);
}

async function getSignedImageUrl(
  bucket: string,
  storagePath: string,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export async function deletePassportImage(storagePath: string): Promise<void> {
  await deleteStorageFile(PASSPORT_BUCKET, storagePath);
}

export async function deleteCareerCertificateImage(storagePath: string): Promise<void> {
  await deleteStorageFile(CAREER_BUCKET, storagePath);
}

async function deleteStorageFile(bucket: string, storagePath: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) {
    console.warn(`Failed to delete storage file: ${storagePath}`, error.message);
  }
}

export async function uploadPassportImage(
  applicantId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  return uploadDocumentImage(PASSPORT_BUCKET, applicantId, buffer, mimeType);
}

export async function uploadCareerCertificateImage(
  applicantId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  return uploadDocumentImage(CAREER_BUCKET, applicantId, buffer, mimeType);
}

async function uploadDocumentImage(
  bucket: string,
  applicantId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const extension = mimeType.includes("pdf")
    ? "pdf"
    : mimeType.includes("png")
      ? "png"
      : "jpg";
  const storagePath = `${applicantId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return storagePath;
}
