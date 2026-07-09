import { monthsBetween } from "@/lib/career-certificate/dates";
import type {
  CareerCertificateFields,
  QualityResult,
  Recommendation,
  VerificationFlag,
} from "@/lib/types";

function addFlag(
  flags: VerificationFlag[],
  code: string,
  severity: VerificationFlag["severity"],
  message: string,
) {
  flags.push({ code, severity, message });
}

function normalizeName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z가-힣]/g, "");
}

function namesMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return true;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return true;

  const aParts = na.match(/[A-Z]{2,}|[가-힣]{2,}/g) ?? [];
  const bParts = nb.match(/[A-Z]{2,}|[가-힣]{2,}/g) ?? [];
  for (const part of [...aParts, ...bParts]) {
    if (na.includes(part) && nb.includes(part)) return true;
  }

  return na.includes(nb) || nb.includes(na);
}

function hasEssentialFields(fields: CareerCertificateFields, usedGpt: boolean): boolean {
  if (fields.workHistory.length > 0) return true;
  if (usedGpt) {
    return Boolean(
      fields.employeeName &&
        (fields.companyName || fields.careerSummary || fields.workHistory.length > 0),
    );
  }
  return Boolean(
    fields.employeeName &&
      fields.companyName &&
      (fields.employmentStart || fields.isCurrentlyEmployed),
  );
}

export function verifyCareerCertificate(
  fields: CareerCertificateFields,
  quality: QualityResult,
  options?: {
    applicantName?: string | null;
    isDocument?: boolean;
    usedGpt?: boolean;
    aiConfidence?: number;
  },
): {
  flags: VerificationFlag[];
  confidence: number;
  recommendation: Recommendation;
} {
  const flags: VerificationFlag[] = [];
  const usedGpt = options?.usedGpt ?? false;
  let confidence = usedGpt ? (options?.aiConfidence ?? 0.85) : 0.88;
  const essential = hasEssentialFields(fields, usedGpt);
  const isDocument = options?.isDocument ?? true;

  if (!isDocument) {
    addFlag(
      flags,
      "DOCUMENT_TYPE_UNKNOWN",
      usedGpt ? "MEDIUM" : "HIGH",
      "고용/경력 관련 문서로 확인되지 않았습니다.",
    );
    confidence -= usedGpt ? 0.2 : 0.4;
  }

  if (!fields.documentType && !usedGpt) {
    addFlag(
      flags,
      "DOCUMENT_TYPE_MISSING",
      "LOW",
      "문서 유형을 확인하지 못했습니다.",
    );
    confidence -= 0.05;
  }

  if (!fields.employeeName && fields.workHistory.length === 0) {
    addFlag(flags, "EMPLOYEE_NAME_MISSING", "HIGH", "성명을 추출하지 못했습니다.");
    confidence -= 0.25;
  }

  if (!fields.companyName && fields.workHistory.length === 0) {
    addFlag(
      flags,
      "COMPANY_NAME_MISSING",
      usedGpt ? "MEDIUM" : "HIGH",
      "회사명을 추출하지 못했습니다.",
    );
    confidence -= usedGpt ? 0.1 : 0.2;
  }

  if (
    !fields.employmentStart &&
    !fields.isCurrentlyEmployed &&
    fields.workHistory.length === 0
  ) {
    addFlag(
      flags,
      "EMPLOYMENT_PERIOD_MISSING",
      usedGpt ? "MEDIUM" : "HIGH",
      "근무기간을 추출하지 못했습니다.",
    );
    confidence -= usedGpt ? 0.1 : 0.2;
  }

  if (!fields.issueDate && !usedGpt) {
    addFlag(flags, "ISSUE_DATE_MISSING", "LOW", "발급일을 추출하지 못했습니다.");
    confidence -= 0.05;
  }

  if (
    fields.employmentStart &&
    fields.employmentEnd &&
    fields.employmentStart >= fields.employmentEnd
  ) {
    addFlag(
      flags,
      "DATE_LOGIC_ERROR",
      "MEDIUM",
      "근무 시작일이 종료일보다 늦거나 같습니다.",
    );
    confidence -= 0.15;
  }

  for (const entry of fields.workHistory) {
    if (
      entry.employmentStart &&
      entry.employmentEnd &&
      entry.employmentStart >= entry.employmentEnd
    ) {
      addFlag(
        flags,
        "DATE_LOGIC_ERROR",
        "LOW",
        `${entry.companyName ?? "근무처"}의 기간이 역전되어 있습니다.`,
      );
      confidence -= 0.05;
    }
  }

  if (fields.employmentStart && fields.employmentEnd) {
    const months = monthsBetween(fields.employmentStart, fields.employmentEnd);
    if (months < 3) {
      addFlag(
        flags,
        "EMPLOYMENT_TOO_SHORT",
        "LOW",
        `최근 근무 기간이 ${months}개월로 짧습니다.`,
      );
      confidence -= 0.05;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  if (fields.issueDate && fields.issueDate > today) {
    addFlag(flags, "FUTURE_ISSUE_DATE", "MEDIUM", "발급일이 미래 날짜입니다.");
    confidence -= 0.1;
  }

  if (
    options?.applicantName &&
    fields.employeeName &&
    !namesMatch(fields.employeeName, options.applicantName)
  ) {
    addFlag(
      flags,
      "NAME_MISMATCH",
      "LOW",
      `증명서 성명(${fields.employeeName})과 지원자 등록명(${options.applicantName})이 다릅니다. 여권명과 대조해 주세요.`,
    );
    confidence -= 0.05;
  }

  if (quality.score < 60 && !usedGpt) {
    addFlag(
      flags,
      "LOW_IMAGE_QUALITY",
      quality.score < 40 ? "HIGH" : "MEDIUM",
      `이미지 품질 점수: ${quality.score}/100`,
    );
    confidence -= 0.15;
  }

  for (const issue of quality.issues) {
    addFlag(flags, "QUALITY_ISSUE", "LOW", issue);
  }

  if (fields.workHistory.length === 0 && !fields.careerSummary) {
    addFlag(
      flags,
      "WORK_HISTORY_EMPTY",
      "MEDIUM",
      "근무 이력 항목을 추출하지 못했습니다.",
    );
    confidence -= 0.1;
  }

  confidence = Math.max(0, Math.min(1, confidence));

  let recommendation: Recommendation = "PASS";
  const hasHigh = flags.some((f) => f.severity === "HIGH");
  const hasMedium = flags.some((f) => f.severity === "MEDIUM");

  if (!essential || hasHigh || confidence < 0.45) {
    recommendation = "FAIL";
  } else if (hasMedium || confidence < 0.75) {
    recommendation = "REVIEW";
  }

  return { flags, confidence, recommendation };
}
