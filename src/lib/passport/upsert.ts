import { sanitizeIsoDate } from "@/lib/passport/mrz-engine";
import { deletePassportImage, uploadPassportImage } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ParseResult } from "@/lib/types";

interface UpsertPassportInput {
  applicantId: string;
  buffer: Buffer;
  mimeType: string;
  parseResult: ParseResult;
  applicantFullName: string | null;
}

interface UpsertPassportResult {
  passportRecord: Record<string, unknown>;
  applicantId: string;
  updated: boolean;
  duplicateApplicantRemoved: boolean;
}

function buildPassportPayload(
  applicantId: string,
  parseResult: ParseResult,
  storagePath: string,
) {
  return {
    applicant_id: applicantId,
    passport_number: parseResult.fields.passportNumber,
    surname: parseResult.fields.surname,
    given_names: parseResult.fields.givenNames,
    nationality: parseResult.fields.nationality,
    sex: parseResult.fields.sex,
    date_of_birth: sanitizeIsoDate(parseResult.fields.dateOfBirth),
    date_of_issue: sanitizeIsoDate(parseResult.fields.dateOfIssue),
    date_of_expiry: sanitizeIsoDate(parseResult.fields.dateOfExpiry),
    mrz_line1: parseResult.fields.mrzLine1,
    mrz_line2: parseResult.fields.mrzLine2,
    mrz_valid: parseResult.fields.mrzValid,
    quality_score: parseResult.quality.score,
    confidence: parseResult.confidence,
    recommendation: parseResult.recommendation,
    flags: parseResult.flags,
    storage_path: storagePath,
    raw_extraction: parseResult.rawExtraction,
    used_ai: parseResult.usedAi,
  };
}

function resolveApplicantStatus(recommendation: string): string {
  if (recommendation === "PASS") return "APPROVED";
  if (recommendation === "FAIL") return "REJECTED";
  return "REVIEW";
}

async function removeEmptyApplicant(applicantId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { count } = await supabase
    .from("passport_records")
    .select("id", { count: "exact", head: true })
    .eq("applicant_id", applicantId);

  if (count && count > 0) {
    return false;
  }

  const { error } = await supabase.from("applicants").delete().eq("id", applicantId);
  return !error;
}

export async function upsertPassportRecord(
  input: UpsertPassportInput,
): Promise<UpsertPassportResult> {
  const supabase = getSupabaseAdmin();
  const { applicantId, buffer, mimeType, parseResult, applicantFullName } = input;

  const displayName =
    [parseResult.fields.surname, parseResult.fields.givenNames]
      .filter(Boolean)
      .join(" ")
      .trim() || applicantFullName;

  const applicantStatus = resolveApplicantStatus(parseResult.recommendation);
  const passportNumber = parseResult.fields.passportNumber;

  let ownerApplicantId = applicantId;
  let existingRecord: { id: string; storage_path: string; applicant_id: string } | null =
    null;

  if (passportNumber) {
    const { data } = await supabase
      .from("passport_records")
      .select("id, storage_path, applicant_id")
      .eq("passport_number", passportNumber)
      .maybeSingle();

    existingRecord = data;
  }

  if (!existingRecord) {
    const { data } = await supabase
      .from("passport_records")
      .select("id, storage_path, applicant_id")
      .eq("applicant_id", applicantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    existingRecord = data;
  }

  if (existingRecord) {
    ownerApplicantId = existingRecord.applicant_id;
    const storagePath = await uploadPassportImage(ownerApplicantId, buffer, mimeType);
    const payload = buildPassportPayload(ownerApplicantId, parseResult, storagePath);

    const { data: passportRecord, error } = await supabase
      .from("passport_records")
      .update(payload)
      .eq("id", existingRecord.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (existingRecord.storage_path !== storagePath) {
      await deletePassportImage(existingRecord.storage_path);
    }

    await supabase
      .from("applicants")
      .update({
        full_name: displayName || applicantFullName,
        status: applicantStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ownerApplicantId);

    let duplicateApplicantRemoved = false;
    if (applicantId !== ownerApplicantId) {
      duplicateApplicantRemoved = await removeEmptyApplicant(applicantId);
    }

    return {
      passportRecord,
      applicantId: ownerApplicantId,
      updated: true,
      duplicateApplicantRemoved,
    };
  }

  const storagePath = await uploadPassportImage(applicantId, buffer, mimeType);
  const payload = buildPassportPayload(applicantId, parseResult, storagePath);

  const { data: passportRecord, error } = await supabase
    .from("passport_records")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabase
    .from("applicants")
    .update({
      full_name: displayName || applicantFullName,
      status: applicantStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicantId);

  return {
    passportRecord,
    applicantId,
    updated: false,
    duplicateApplicantRemoved: false,
  };
}
