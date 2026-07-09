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

export interface WorkExperienceEntry {
  companyName: string | null;
  companyNameKo: string | null;
  companyAddress: string | null;
  companyAddressKo: string | null;
  companyPhone: string | null;
  representative: string | null;
  representativeKo: string | null;
  jobTitle: string | null;
  jobTitleKo: string | null;
  department: string | null;
  departmentKo: string | null;
  employmentStart: string | null;
  employmentEnd: string | null;
  employmentYears: number | null;
  isCurrentlyEmployed: boolean;
  durationLabel: string | null;
  durationLabelKo: string | null;
  responsibilities: string | null;
  responsibilitiesKo: string | null;
  location: string | null;
}

export interface CareerCertificateFields {
  documentType: string | null;
  employeeName: string | null;
  dateOfBirth: string | null;
  companyName: string | null;
  companyAddress: string | null;
  companyPhone: string | null;
  representative: string | null;
  businessNumber: string | null;
  department: string | null;
  jobTitle: string | null;
  employmentStart: string | null;
  employmentEnd: string | null;
  employmentYears: number | null;
  isCurrentlyEmployed: boolean;
  issueDate: string | null;
  issuer: string | null;
  certificateNumber: string | null;
  workHistory: WorkExperienceEntry[];
  careerSummary: string | null;
  careerSummaryKo: string | null;
}

export interface CareerCertificateFieldsKo {
  documentType: string | null;
  employeeName: string | null;
  companyName: string | null;
  companyAddress: string | null;
  representative: string | null;
  department: string | null;
  jobTitle: string | null;
  issuer: string | null;
  careerSummary: string | null;
  workHistory: WorkExperienceEntry[];
}

export interface CareerCertificateParseResult {
  fields: CareerCertificateFields;
  fieldsKo: CareerCertificateFieldsKo;
  quality: QualityResult;
  flags: VerificationFlag[];
  confidence: number;
  recommendation: Recommendation;
  rawExtraction: Record<string, unknown>;
  usedAi: boolean;
  sourceMimeType: string;
}

export interface CareerCertificateRecord {
  id: string;
  applicant_id: string;
  document_type: string | null;
  employee_name: string | null;
  date_of_birth: string | null;
  company_name: string | null;
  company_address: string | null;
  company_phone: string | null;
  representative: string | null;
  business_number: string | null;
  department: string | null;
  job_title: string | null;
  employment_start: string | null;
  employment_end: string | null;
  employment_years: number | null;
  is_currently_employed: boolean;
  issue_date: string | null;
  issuer: string | null;
  certificate_number: string | null;
  work_history: WorkExperienceEntry[];
  career_summary: string | null;
  career_summary_ko: string | null;
  fields_ko: CareerCertificateFieldsKo | null;
  source_mime_type: string | null;
  quality_score: number | null;
  confidence: number | null;
  recommendation: Recommendation;
  flags: VerificationFlag[];
  storage_path: string;
  raw_extraction: Record<string, unknown>;
  used_ai: boolean;
  created_at: string;
}

export interface ApplicantWithDocuments extends Applicant {
  passport_records: PassportRecord[];
  career_certificate_records: CareerCertificateRecord[];
}
