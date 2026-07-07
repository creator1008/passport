export type Recommendation = "PASS" | "REVIEW" | "FAIL";
export type ApplicantStatus = "PENDING" | "REVIEW" | "APPROVED" | "REJECTED";
export type FlagSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface VerificationFlag {
  code: string;
  severity: FlagSeverity;
  message: string;
}

export interface QualityResult {
  score: number;
  issues: string[];
  width: number;
  height: number;
}

export interface PassportFields {
  passportNumber: string | null;
  surname: string | null;
  givenNames: string | null;
  nationality: string | null;
  sex: string | null;
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  dateOfExpiry: string | null;
  mrzLine1: string | null;
  mrzLine2: string | null;
  mrzValid: boolean;
}

export interface ParseResult {
  fields: PassportFields;
  quality: QualityResult;
  flags: VerificationFlag[];
  confidence: number;
  recommendation: Recommendation;
  rawExtraction: Record<string, unknown>;
  usedAi: boolean;
}

export interface Applicant {
  id: string;
  full_name: string | null;
  nationality: string;
  status: ApplicantStatus;
  created_at: string;
  updated_at: string;
}

export interface PassportRecord {
  id: string;
  applicant_id: string;
  passport_number: string | null;
  surname: string | null;
  given_names: string | null;
  nationality: string | null;
  sex: string | null;
  date_of_birth: string | null;
  date_of_issue: string | null;
  date_of_expiry: string | null;
  mrz_line1: string | null;
  mrz_line2: string | null;
  mrz_valid: boolean;
  quality_score: number | null;
  confidence: number | null;
  recommendation: Recommendation;
  flags: VerificationFlag[];
  storage_path: string;
  raw_extraction: Record<string, unknown>;
  used_ai: boolean;
  created_at: string;
}

export interface ApplicantWithPassport extends Applicant {
  passport_records: PassportRecord[];
}
