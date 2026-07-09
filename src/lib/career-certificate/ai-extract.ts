import { sanitizeIsoDate } from "@/lib/career-certificate/dates";
import type {
  CareerCertificateFields,
  CareerCertificateFieldsKo,
  WorkExperienceEntry,
} from "@/lib/types";

const MODEL = "gpt-4o-mini";

const NULLABLE_STRING = {
  anyOf: [{ type: "string" }, { type: "null" }],
} as const;

const NULLABLE_NUMBER = {
  anyOf: [{ type: "number" }, { type: "null" }],
} as const;

const WORK_ENTRY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    companyName: NULLABLE_STRING,
    companyNameKo: NULLABLE_STRING,
    companyAddress: NULLABLE_STRING,
    companyAddressKo: NULLABLE_STRING,
    companyPhone: NULLABLE_STRING,
    representative: NULLABLE_STRING,
    representativeKo: NULLABLE_STRING,
    jobTitle: NULLABLE_STRING,
    jobTitleKo: NULLABLE_STRING,
    department: NULLABLE_STRING,
    departmentKo: NULLABLE_STRING,
    employmentStart: NULLABLE_STRING,
    employmentEnd: NULLABLE_STRING,
    employmentYears: NULLABLE_NUMBER,
    isCurrentlyEmployed: { type: "boolean" },
    durationLabel: NULLABLE_STRING,
    durationLabelKo: NULLABLE_STRING,
    responsibilities: NULLABLE_STRING,
    responsibilitiesKo: NULLABLE_STRING,
    location: NULLABLE_STRING,
  },
  required: [
    "companyName",
    "companyNameKo",
    "companyAddress",
    "companyAddressKo",
    "companyPhone",
    "representative",
    "representativeKo",
    "jobTitle",
    "jobTitleKo",
    "department",
    "departmentKo",
    "employmentStart",
    "employmentEnd",
    "employmentYears",
    "isCurrentlyEmployed",
    "durationLabel",
    "durationLabelKo",
    "responsibilities",
    "responsibilitiesKo",
    "location",
  ],
} as const;

/** OpenAI Structured Outputs schema (strict) */
export const CAREER_CERTIFICATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    isEmploymentDocument: { type: "boolean" },
    confidence: { type: "number" },
    documentType: NULLABLE_STRING,
    documentTypeKo: NULLABLE_STRING,
    employeeName: NULLABLE_STRING,
    employeeNameKo: NULLABLE_STRING,
    dateOfBirth: NULLABLE_STRING,
    companyName: NULLABLE_STRING,
    companyNameKo: NULLABLE_STRING,
    companyAddress: NULLABLE_STRING,
    companyAddressKo: NULLABLE_STRING,
    companyPhone: NULLABLE_STRING,
    representative: NULLABLE_STRING,
    representativeKo: NULLABLE_STRING,
    businessNumber: NULLABLE_STRING,
    department: NULLABLE_STRING,
    departmentKo: NULLABLE_STRING,
    jobTitle: NULLABLE_STRING,
    jobTitleKo: NULLABLE_STRING,
    employmentStart: NULLABLE_STRING,
    employmentEnd: NULLABLE_STRING,
    employmentYears: NULLABLE_NUMBER,
    isCurrentlyEmployed: { type: "boolean" },
    issueDate: NULLABLE_STRING,
    issuer: NULLABLE_STRING,
    issuerKo: NULLABLE_STRING,
    certificateNumber: NULLABLE_STRING,
    workHistory: {
      type: "array",
      items: WORK_ENTRY_SCHEMA,
    },
    careerSummary: NULLABLE_STRING,
    careerSummaryKo: NULLABLE_STRING,
  },
  required: [
    "isEmploymentDocument",
    "confidence",
    "documentType",
    "documentTypeKo",
    "employeeName",
    "employeeNameKo",
    "dateOfBirth",
    "companyName",
    "companyNameKo",
    "companyAddress",
    "companyAddressKo",
    "companyPhone",
    "representative",
    "representativeKo",
    "businessNumber",
    "department",
    "departmentKo",
    "jobTitle",
    "jobTitleKo",
    "employmentStart",
    "employmentEnd",
    "employmentYears",
    "isCurrentlyEmployed",
    "issueDate",
    "issuer",
    "issuerKo",
    "certificateNumber",
    "workHistory",
    "careerSummary",
    "careerSummaryKo",
  ],
} as const;

interface AiWorkEntry {
  companyName?: string | null;
  companyNameKo?: string | null;
  companyAddress?: string | null;
  companyAddressKo?: string | null;
  companyPhone?: string | null;
  representative?: string | null;
  representativeKo?: string | null;
  jobTitle?: string | null;
  jobTitleKo?: string | null;
  department?: string | null;
  departmentKo?: string | null;
  employmentStart?: string | null;
  employmentEnd?: string | null;
  employmentYears?: number | null;
  isCurrentlyEmployed?: boolean | null;
  durationLabel?: string | null;
  durationLabelKo?: string | null;
  responsibilities?: string | null;
  responsibilitiesKo?: string | null;
  location?: string | null;
}

export interface AiCareerExtraction {
  isEmploymentDocument?: boolean;
  documentType?: string | null;
  documentTypeKo?: string | null;
  employeeName?: string | null;
  employeeNameKo?: string | null;
  dateOfBirth?: string | null;
  companyName?: string | null;
  companyNameKo?: string | null;
  companyAddress?: string | null;
  companyAddressKo?: string | null;
  companyPhone?: string | null;
  representative?: string | null;
  representativeKo?: string | null;
  businessNumber?: string | null;
  department?: string | null;
  departmentKo?: string | null;
  jobTitle?: string | null;
  jobTitleKo?: string | null;
  employmentStart?: string | null;
  employmentEnd?: string | null;
  employmentYears?: number | null;
  isCurrentlyEmployed?: boolean | null;
  issueDate?: string | null;
  issuer?: string | null;
  issuerKo?: string | null;
  certificateNumber?: string | null;
  workHistory?: AiWorkEntry[];
  careerSummary?: string | null;
  careerSummaryKo?: string | null;
  confidence?: number | null;
}

const SYSTEM_PROMPT = `당신은 각국 경력증명서·재직증명서·고용증명서를 분석하는 전문가입니다.
문서는 정형 양식이 아닙니다. 파일(이미지 또는 PDF)의 문맥을 이해하고 아래 정보를 추출하세요.

추출 대상:
1. 인적사항: 성명, 생년월일
2. 경력정보(근무처마다): 회사명, 회사주소, 회사전화번호, 대표자, 근무기간(시작·종료), 근무년수, 직책, 직무내용
3. 발급일자, 발급처/발급자
4. 문서에 여러 근무 이력이 있으면 workHistory에 모두 넣고, 최신(또는 주) 근무처는 상위 평탄 필드에도 반영

규칙:
- 날짜는 YYYY-MM-DD. 불명확하면 null
- 근무년수는 문서에 있으면 그 값, 없으면 기간으로 계산(소수점 가능)
- 원문 필드와 *Ko 한국어 번역을 함께 채움
- workHistory는 오래된 순
- 고용/경력 관련 문서가 아니면 isEmploymentDocument=false`;

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "bin";
}

function filenameForMime(mimeType: string): string {
  return `career-certificate.${extensionForMime(mimeType)}`;
}

async function uploadFileToOpenAi(
  apiKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    filenameForMime(mimeType),
  );

  const response = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI 파일 업로드 실패: ${response.status} ${errorText.slice(0, 200)}`);
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id) {
    throw new Error("OpenAI 파일 업로드 응답에 file id가 없습니다.");
  }
  return payload.id;
}

async function deleteOpenAiFile(apiKey: string, fileId: string): Promise<void> {
  try {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch {
    // best-effort cleanup
  }
}

function extractOutputText(payload: {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
}): string | null {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output ?? []) {
    for (const part of item.content ?? []) {
      if ((part.type === "output_text" || part.type === "text") && part.text) {
        return part.text;
      }
    }
  }
  return null;
}

function mapWorkEntry(entry: AiWorkEntry): WorkExperienceEntry {
  return {
    companyName: entry.companyName ?? null,
    companyNameKo: entry.companyNameKo ?? null,
    companyAddress: entry.companyAddress ?? null,
    companyAddressKo: entry.companyAddressKo ?? null,
    companyPhone: entry.companyPhone ?? null,
    representative: entry.representative ?? null,
    representativeKo: entry.representativeKo ?? null,
    jobTitle: entry.jobTitle ?? null,
    jobTitleKo: entry.jobTitleKo ?? null,
    department: entry.department ?? null,
    departmentKo: entry.departmentKo ?? null,
    employmentStart: sanitizeIsoDate(entry.employmentStart ?? null),
    employmentEnd: sanitizeIsoDate(entry.employmentEnd ?? null),
    employmentYears:
      typeof entry.employmentYears === "number" && Number.isFinite(entry.employmentYears)
        ? entry.employmentYears
        : null,
    isCurrentlyEmployed: Boolean(entry.isCurrentlyEmployed),
    durationLabel: entry.durationLabel ?? null,
    durationLabelKo: entry.durationLabelKo ?? null,
    responsibilities: entry.responsibilities ?? null,
    responsibilitiesKo: entry.responsibilitiesKo ?? null,
    location: entry.location ?? null,
  };
}

function syncPrimaryFromHistory(
  parsed: AiCareerExtraction,
  workHistory: WorkExperienceEntry[],
): void {
  if (workHistory.length === 0) return;
  const latest = workHistory[workHistory.length - 1];
  if (!parsed.companyName && latest.companyName) parsed.companyName = latest.companyName;
  if (!parsed.companyNameKo && latest.companyNameKo) parsed.companyNameKo = latest.companyNameKo;
  if (!parsed.companyAddress && latest.companyAddress) {
    parsed.companyAddress = latest.companyAddress;
  }
  if (!parsed.companyAddressKo && latest.companyAddressKo) {
    parsed.companyAddressKo = latest.companyAddressKo;
  }
  if (!parsed.companyPhone && latest.companyPhone) parsed.companyPhone = latest.companyPhone;
  if (!parsed.representative && latest.representative) {
    parsed.representative = latest.representative;
  }
  if (!parsed.representativeKo && latest.representativeKo) {
    parsed.representativeKo = latest.representativeKo;
  }
  if (!parsed.jobTitle && latest.jobTitle) parsed.jobTitle = latest.jobTitle;
  if (!parsed.jobTitleKo && latest.jobTitleKo) parsed.jobTitleKo = latest.jobTitleKo;
  if (!parsed.department && latest.department) parsed.department = latest.department;
  if (!parsed.employmentStart && latest.employmentStart) {
    parsed.employmentStart = latest.employmentStart;
  }
  if (!parsed.employmentEnd && latest.employmentEnd) parsed.employmentEnd = latest.employmentEnd;
  if (parsed.employmentYears == null && latest.employmentYears != null) {
    parsed.employmentYears = latest.employmentYears;
  }
  if (parsed.isCurrentlyEmployed == null) {
    parsed.isCurrentlyEmployed = latest.isCurrentlyEmployed;
  }
}

export function mapAiExtractionToFields(parsed: AiCareerExtraction): {
  fields: CareerCertificateFields;
  fieldsKo: CareerCertificateFieldsKo;
  aiConfidence: number;
  isEmploymentDocument: boolean;
} {
  const workHistory = (parsed.workHistory ?? []).map(mapWorkEntry);
  syncPrimaryFromHistory(parsed, workHistory);

  const fields: CareerCertificateFields = {
    documentType: parsed.documentType ?? null,
    employeeName: parsed.employeeName ?? null,
    dateOfBirth: sanitizeIsoDate(parsed.dateOfBirth ?? null),
    companyName: parsed.companyName ?? null,
    companyAddress: parsed.companyAddress ?? null,
    companyPhone: parsed.companyPhone ?? null,
    representative: parsed.representative ?? null,
    businessNumber: parsed.businessNumber ?? null,
    department: parsed.department ?? null,
    jobTitle: parsed.jobTitle ?? null,
    employmentStart: sanitizeIsoDate(parsed.employmentStart ?? null),
    employmentEnd: sanitizeIsoDate(parsed.employmentEnd ?? null),
    employmentYears:
      typeof parsed.employmentYears === "number" && Number.isFinite(parsed.employmentYears)
        ? parsed.employmentYears
        : null,
    isCurrentlyEmployed: Boolean(parsed.isCurrentlyEmployed),
    issueDate: sanitizeIsoDate(parsed.issueDate ?? null),
    issuer: parsed.issuer ?? null,
    certificateNumber: parsed.certificateNumber ?? null,
    workHistory,
    careerSummary: parsed.careerSummary ?? null,
    careerSummaryKo: parsed.careerSummaryKo ?? null,
  };

  const fieldsKo: CareerCertificateFieldsKo = {
    documentType: parsed.documentTypeKo ?? parsed.documentType ?? null,
    employeeName: parsed.employeeNameKo ?? parsed.employeeName ?? null,
    companyName: parsed.companyNameKo ?? parsed.companyName ?? null,
    companyAddress: parsed.companyAddressKo ?? parsed.companyAddress ?? null,
    representative: parsed.representativeKo ?? parsed.representative ?? null,
    department: parsed.departmentKo ?? parsed.department ?? null,
    jobTitle: parsed.jobTitleKo ?? parsed.jobTitle ?? null,
    issuer: parsed.issuerKo ?? parsed.issuer ?? null,
    careerSummary: parsed.careerSummaryKo ?? parsed.careerSummary ?? null,
    workHistory,
  };

  return {
    fields,
    fieldsKo,
    aiConfidence: parsed.confidence ?? 0.85,
    isEmploymentDocument: Boolean(parsed.isEmploymentDocument),
  };
}

export async function extractCareerCertificateWithGpt(
  buffer: Buffer,
  mimeType: string,
  options?: { applicantName?: string | null; filename?: string },
): Promise<{
  fields: CareerCertificateFields;
  fieldsKo: CareerCertificateFieldsKo;
  raw: Record<string, unknown>;
  aiConfidence: number;
  isEmploymentDocument: boolean;
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY가 설정되지 않았습니다. 경력증명서 분석에는 GPT가 필요합니다.",
    );
  }

  const userText = [
    "첨부된 경력/재직 증명서 파일에서 인적사항과 경력정보를 Structured Output 스키마에 맞게 추출하세요.",
    options?.applicantName
      ? `지원자 등록명(참고): ${options.applicantName}. 문서에 적힌 성명을 그대로 추출하세요.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const fileId = await uploadFileToOpenAi(apiKey, buffer, mimeType);

  try {
    const isPdf = mimeType.includes("pdf");
    const fileContent = isPdf
      ? { type: "input_file" as const, file_id: fileId }
      : { type: "input_image" as const, file_id: fileId, detail: "high" as const };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        text: {
          format: {
            type: "json_schema",
            name: "career_certificate_extraction",
            strict: true,
            schema: CAREER_CERTIFICATE_JSON_SCHEMA,
          },
        },
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              fileContent,
              {
                type: "input_text",
                text: userText,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GPT 분석 실패: ${response.status} ${errorText.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
      status?: string;
      error?: { message?: string };
    };

    if (payload.error?.message) {
      throw new Error(`GPT 분석 실패: ${payload.error.message}`);
    }

    const content = extractOutputText(payload);
    if (!content) {
      throw new Error("GPT가 빈 응답을 반환했습니다.");
    }

    const parsed = JSON.parse(content) as AiCareerExtraction;
    const mapped = mapAiExtractionToFields(parsed);

    return {
      ...mapped,
      raw: {
        gpt: parsed,
        model: MODEL,
        fileId,
        filename: options?.filename ?? filenameForMime(mimeType),
        api: "responses",
      },
    };
  } finally {
    await deleteOpenAiFile(apiKey, fileId);
  }
}

/** @deprecated use extractCareerCertificateWithGpt(buffer, mimeType) */
export async function aiCareerCertificateFallback(
  imageBase64: string,
  mimeType: string,
  currentFields: CareerCertificateFields,
): Promise<{ fields: CareerCertificateFields; raw: Record<string, unknown> }> {
  const buffer = Buffer.from(imageBase64, "base64");
  const result = await extractCareerCertificateWithGpt(buffer, mimeType, {
    applicantName: currentFields.employeeName,
  });
  return { fields: result.fields, raw: result.raw };
}
