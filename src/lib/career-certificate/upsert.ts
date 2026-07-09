import { sanitizeIsoDate } from "@/lib/career-certificate/dates";
import {
  deleteCareerCertificateImage,
  uploadCareerCertificateImage,
} from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { CareerCertificateParseResult } from "@/lib/types";

interface UpsertCareerCertificateInput {
  applicantId: string;
  buffer: Buffer;
  mimeType: string;
  parseResult: CareerCertificateParseResult;
}

interface UpsertCareerCertificateResult {
  careerCertificateRecord: Record<string, unknown>;
  applicantId: string;
  updated: boolean;
}

function buildPayload(
  applicantId: string,
  parseResult: CareerCertificateParseResult,
  storagePath: string,
) {
  const { fields, fieldsKo } = parseResult;
  return {
    applicant_id: applicantId,
    document_type: fields.documentType,
    employee_name: fields.employeeName,
    date_of_birth: sanitizeIsoDate(fields.dateOfBirth),
    company_name: fields.companyName,
    company_address: fields.companyAddress,
    company_phone: fields.companyPhone,
    representative: fields.representative,
    business_number: fields.businessNumber,
    department: fields.department,
    job_title: fields.jobTitle,
    employment_start: sanitizeIsoDate(fields.employmentStart),
    employment_end: sanitizeIsoDate(fields.employmentEnd),
    employment_years: fields.employmentYears,
    is_currently_employed: fields.isCurrentlyEmployed,
    issue_date: sanitizeIsoDate(fields.issueDate),
    issuer: fields.issuer,
    certificate_number: fields.certificateNumber,
    work_history: fields.workHistory,
    career_summary: fields.careerSummary,
    career_summary_ko: fields.careerSummaryKo,
    fields_ko: fieldsKo,
    source_mime_type: parseResult.sourceMimeType,
    quality_score: parseResult.quality.score,
    confidence: parseResult.confidence,
    recommendation: parseResult.recommendation,
    flags: parseResult.flags,
    storage_path: storagePath,
    raw_extraction: parseResult.rawExtraction,
    used_ai: parseResult.usedAi,
  };
}

export async function upsertCareerCertificateRecord(
  input: UpsertCareerCertificateInput,
): Promise<UpsertCareerCertificateResult> {
  const supabase = getSupabaseAdmin();
  const { applicantId, buffer, mimeType, parseResult } = input;

  let existingRecord: {
    id: string;
    storage_path: string;
    applicant_id: string;
  } | null = null;

  const certificateNumber = parseResult.fields.certificateNumber;
  if (certificateNumber) {
    const { data } = await supabase
      .from("career_certificate_records")
      .select("id, storage_path, applicant_id")
      .eq("certificate_number", certificateNumber)
      .maybeSingle();
    existingRecord = data;
  }

  if (!existingRecord) {
    const { data } = await supabase
      .from("career_certificate_records")
      .select("id, storage_path, applicant_id")
      .eq("applicant_id", applicantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    existingRecord = data;
  }

  if (existingRecord) {
    const storagePath = await uploadCareerCertificateImage(applicantId, buffer, mimeType);
    const payload = buildPayload(applicantId, parseResult, storagePath);

    const { data: careerCertificateRecord, error } = await supabase
      .from("career_certificate_records")
      .update(payload)
      .eq("id", existingRecord.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (existingRecord.storage_path !== storagePath) {
      await deleteCareerCertificateImage(existingRecord.storage_path);
    }

    return {
      careerCertificateRecord,
      applicantId,
      updated: true,
    };
  }

  const storagePath = await uploadCareerCertificateImage(applicantId, buffer, mimeType);
  const payload = buildPayload(applicantId, parseResult, storagePath);

  const { data: careerCertificateRecord, error } = await supabase
    .from("career_certificate_records")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    careerCertificateRecord,
    applicantId,
    updated: false,
  };
}
