import { parseKoreanDate, sanitizeIsoDate } from "@/lib/career-certificate/dates";
import type { CareerCertificateFields } from "@/lib/types";

const DOCUMENT_TYPE_PATTERNS = [
  { pattern: /경\s*력\s*증\s*명\s*서/i, type: "경력증명서" },
  { pattern: /재\s*직\s*증\s*명\s*서/i, type: "재직증명서" },
  { pattern: /퇴\s*직\s*증\s*명\s*서/i, type: "퇴직증명서" },
  { pattern: /CAREER\s+CERTIFICATE/i, type: "경력증명서" },
  { pattern: /EMPLOYMENT\s+CERTIFICATE/i, type: "재직증명서" },
];

const CURRENT_MARKERS = /현\s*재|재\s*직\s*중|현\s*재\s*재\s*직|present|current/i;

function normalizeOcrText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, "1")
    .replace(/[Il](?=\d)/g, "1")
    .replace(/(\d)[Oo](?=\d)/g, "$10")
    .replace(/(\d)[,.](?=\d{2}\b)/g, "$1.")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractLabeledValue(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const pattern = new RegExp(
      `${label}\\s*[:：]?\\s*([^\\n]{1,80})`,
      "i",
    );
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/\s{2,}/g, " ");
    }
  }
  return null;
}

function extractDocumentType(text: string): string | null {
  for (const { pattern, type } of DOCUMENT_TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

function extractBusinessNumber(text: string): string | null {
  const match = text.match(/(\d{3})\s*[-.]?\s*(\d{2})\s*[-.]?\s*(\d{5})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function extractCertificateNumber(text: string): string | null {
  const labeled = extractLabeledValue(text, [
    "문서\\s*번호",
    "증명서\\s*번호",
    "발급\\s*번호",
    "Certificate\\s*No",
  ]);
  if (labeled) {
    const compact = labeled.replace(/[^A-Z0-9\-]/gi, "").slice(0, 40);
    return compact || null;
  }
  return null;
}

function extractEmploymentPeriod(text: string): {
  start: string | null;
  end: string | null;
  isCurrent: boolean;
} {
  const periodBlock =
    text.match(
      /(?:근\s*무\s*기\s*간|재\s*직\s*기\s*간|근\s*무\s*기\s*간\s*등)[^\n]{0,120}/i,
    )?.[0] ?? text;

  const rangeMatch = periodBlock.match(
    /(\d{4}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]?\s*\d{0,2}\s*일?)\s*(?:~|〜|～|-|–|부터|에서)\s*(\d{4}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]?\s*\d{0,2}\s*일?|현\s*재|재\s*직\s*중|present)/i,
  );

  if (rangeMatch) {
    const start = parseKoreanDate(rangeMatch[1]);
    const endRaw = rangeMatch[2];
    const isCurrent = CURRENT_MARKERS.test(endRaw);
    const end = isCurrent ? null : parseKoreanDate(endRaw);
    return { start, end, isCurrent };
  }

  const dates = [...periodBlock.matchAll(
    /(\d{4}\s*[년.\-/]\s*\d{1,2}\s*[월.\-/]?\s*\d{0,2}\s*일?)/g,
  )]
    .map((m) => parseKoreanDate(m[1]))
    .filter((d): d is string => Boolean(d));

  const isCurrent = CURRENT_MARKERS.test(periodBlock);
  if (dates.length >= 2) {
    return { start: dates[0], end: dates[1], isCurrent: false };
  }
  if (dates.length === 1) {
    return { start: dates[0], end: null, isCurrent };
  }

  return { start: null, end: null, isCurrent: false };
}

function cleanPersonName(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/[0-9()（）]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length < 2) return null;
  return cleaned.slice(0, 40);
}

function cleanCompanyName(value: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s{2,}/g, " ").trim();
  if (cleaned.length < 2) return null;
  return cleaned.slice(0, 80);
}

export function extractCareerCertificateFields(text: string): CareerCertificateFields {
  const normalized = normalizeOcrText(text);
  const period = extractEmploymentPeriod(normalized);

  const documentType = extractDocumentType(normalized);
  const employeeName = cleanPersonName(
    extractLabeledValue(normalized, ["성\\s*명", "성\\s*함", "Name"]),
  );
  const dateOfBirth = parseKoreanDate(
    extractLabeledValue(normalized, ["생\\s*년\\s*월\\s*일", "생년월일", "Date of Birth"]) ?? "",
  );
  const companyName = cleanCompanyName(
    extractLabeledValue(normalized, [
      "회\\s*사\\s*명",
      "직\\s*장\\s*명",
      "업\\s*체\\s*명",
      "Company",
    ]),
  );
  const department = extractLabeledValue(normalized, [
    "소\\s*속",
    "부\\s*서",
    "Department",
  ]);
  const jobTitle = extractLabeledValue(normalized, [
    "직\\s*위",
    "직\\s*종",
    "직\\s*책",
    "Position",
    "Title",
  ]);
  const issueDate = parseKoreanDate(
    extractLabeledValue(normalized, ["발\\s*급\\s*일", "발급일", "Issue Date"]) ?? "",
  );
  const issuer = extractLabeledValue(normalized, [
    "발\\s*급\\s*처",
    "발급처",
    "담\\s*당\\s*자",
    "Issuer",
  ]);
  const businessNumber = extractBusinessNumber(normalized);
  const certificateNumber = extractCertificateNumber(normalized);

  return {
    documentType,
    employeeName,
    dateOfBirth: sanitizeIsoDate(dateOfBirth),
    companyName,
    businessNumber,
    department: department?.slice(0, 60) ?? null,
    jobTitle: jobTitle?.slice(0, 60) ?? null,
    employmentStart: sanitizeIsoDate(period.start),
    employmentEnd: sanitizeIsoDate(period.end),
    isCurrentlyEmployed: period.isCurrent,
    issueDate: sanitizeIsoDate(issueDate),
    issuer: issuer?.slice(0, 80) ?? null,
    certificateNumber,
    workHistory: [],
    careerSummary: null,
    careerSummaryKo: null,
    companyAddress: null,
    companyPhone: null,
    representative: null,
    employmentYears: null,
  };
}

export function isCareerCertificateDocument(text: string): boolean {
  const normalized = normalizeOcrText(text);
  if (extractDocumentType(normalized)) return true;
  const keywords = [
    /경\s*력\s*증\s*명/,
    /재\s*직\s*증\s*명/,
    /퇴\s*직\s*증\s*명/,
    /근\s*무\s*기\s*간/,
    /사\s*업\s*자\s*등\s*록/,
  ];
  const hits = keywords.filter((p) => p.test(normalized)).length;
  return hits >= 2;
}
