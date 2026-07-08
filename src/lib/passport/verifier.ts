import type {
  PassportFields,
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

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(dateIso);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function hasEssentialFields(fields: PassportFields): boolean {
  return Boolean(
    fields.passportNumber &&
      fields.dateOfBirth &&
      fields.dateOfExpiry &&
      fields.surname,
  );
}

export function verifyPassport(
  fields: PassportFields,
  quality: QualityResult,
): {
  flags: VerificationFlag[];
  confidence: number;
  recommendation: Recommendation;
} {
  const flags: VerificationFlag[] = [];
  let confidence = 0.9;
  const essential = hasEssentialFields(fields);

  if (!fields.mrzLine1 || !fields.mrzLine2) {
    addFlag(flags, "MRZ_NOT_FOUND", "HIGH", "MRZ 영역을 인식하지 못했습니다.");
    confidence -= 0.4;
  }

  if (!fields.mrzValid) {
    if (!essential) {
      addFlag(flags, "MRZ_CHECKSUM_INVALID", "HIGH", "MRZ 체크섬이 유효하지 않습니다.");
      confidence -= 0.35;
    } else if (!fields.passportNumber?.startsWith("M")) {
      addFlag(flags, "MRZ_CHECKSUM_INVALID", "LOW", "MRZ 체크섬이 일치하지 않지만 필수 필드는 추출되었습니다.");
      confidence -= 0.05;
    }
  }

  if (!fields.passportNumber) {
    addFlag(flags, "PASSPORT_NUMBER_MISSING", "HIGH", "여권번호를 추출하지 못했습니다.");
    confidence -= 0.2;
  }

  if (!fields.dateOfBirth) {
    addFlag(flags, "DOB_MISSING", "MEDIUM", "생년월일을 추출하지 못했습니다.");
    confidence -= 0.1;
  }

  if (!fields.dateOfExpiry) {
    addFlag(flags, "EXPIRY_MISSING", "HIGH", "만료일을 추출하지 못했습니다.");
    confidence -= 0.15;
  } else {
    const remaining = daysUntil(fields.dateOfExpiry);
    if (remaining !== null && remaining < 0) {
      addFlag(flags, "PASSPORT_EXPIRED", "HIGH", "여권이 만료되었습니다.");
      confidence -= 0.3;
    } else if (remaining !== null && remaining < 180) {
      addFlag(
        flags,
        "PASSPORT_EXPIRES_SOON",
        "MEDIUM",
        `여권 만료까지 ${remaining}일 남았습니다.`,
      );
      confidence -= 0.1;
    }
  }

  if (fields.dateOfIssue && fields.dateOfExpiry) {
    const issue = new Date(fields.dateOfIssue);
    const expiry = new Date(fields.dateOfExpiry);
    if (issue >= expiry) {
      addFlag(flags, "DATE_LOGIC_ERROR", "HIGH", "발급일이 만료일보다 늦습니다.");
      confidence -= 0.25;
    }
  }

  if (quality.score < 60) {
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

  confidence = Math.max(0, Math.min(1, confidence));

  let recommendation: Recommendation = "PASS";
  const hasHigh = flags.some((f) => f.severity === "HIGH");
  const hasMedium = flags.some((f) => f.severity === "MEDIUM");

  if (hasHigh || confidence < 0.5) {
    recommendation = "FAIL";
  } else if (hasMedium || confidence < 0.8) {
    recommendation = "REVIEW";
  }

  return { flags, confidence, recommendation };
}

export function shouldUseAiFallback(
  confidence: number,
  flags: VerificationFlag[],
): boolean {
  if (!process.env.OPENAI_API_KEY) return false;
  if (confidence < 0.8) return true;
  return flags.some(
    (f) =>
      f.severity === "HIGH" &&
      ["MRZ_NOT_FOUND", "MRZ_CHECKSUM_INVALID", "PASSPORT_NUMBER_MISSING"].includes(
        f.code,
      ),
  );
}
